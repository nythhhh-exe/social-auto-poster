import asyncio
import httpx
import json
from typing import Optional
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Social Auto Poster API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FB_GRAPH_BASE = "https://graph.facebook.com/v21.0"


@app.get("/")
def root():
    return {"status": "ok", "service": "social-auto-poster-api"}


def _format_fb_error(data: dict) -> str:
    err = data.get("error", {})
    msg = err.get("message", "Unknown Facebook API error")
    code = err.get("code")
    subcode = err.get("error_subcode")

    if code == 190:
        return f"Token expired (Code 190): {msg}. Please generate a new User Access Token in Meta Graph API Explorer."
    elif code == 200 and "blocked" in msg.lower():
        return f"API access blocked (Code 200): Meta blocked API access with this token. Check your App mode (Dev vs Live) or test account permissions in Meta Developer Portal."
    elif code == 200:
        return f"Permission error (Code 200): {msg}. Make sure your token has 'pages_show_list', 'pages_read_engagement', and 'pages_manage_posts' permissions."
    elif code in (4, 17):
        return f"Rate limited (Code {code}): Meta is throttling requests. Please wait a few minutes."

    extra = f" (code: {code})" if code else ""
    return f"{msg}{extra}"


@app.get("/validate-token")
async def validate_token(token: str, page_id: str):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{FB_GRAPH_BASE}/{page_id}",
            params={"fields": "name,id,fan_count", "access_token": token},
        )
    data = r.json()
    if "error" in data:
        raise HTTPException(status_code=400, detail=_format_fb_error(data))
    return {
        "valid": True,
        "page_name": data.get("name"),
        "page_id": data.get("id"),
        "fans": data.get("fan_count"),
    }


@app.get("/fetch-pages")
async def fetch_pages(token: str, app_id: Optional[str] = None, app_secret: Optional[str] = None):
    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Token is required")

    active_token = token.strip()
    is_permanent = False

    async with httpx.AsyncClient(timeout=25) as client:
        # If App ID & Secret provided, auto-upgrade short-lived token to 60-day Long-Lived Token
        if app_id and app_secret and app_id.strip() and app_secret.strip():
            try:
                ex_res = await client.get(
                    f"{FB_GRAPH_BASE}/oauth/access_token",
                    params={
                        "grant_type": "fb_exchange_token",
                        "client_id": app_id.strip(),
                        "client_secret": app_secret.strip(),
                        "fb_exchange_token": active_token,
                    },
                )
                ex_data = ex_res.json()
                if "access_token" in ex_data:
                    active_token = ex_data["access_token"]
                    is_permanent = True
                    logger.info("Successfully converted short-lived token to long-lived permanent page token generator!")
            except Exception as e:
                logger.warning(f"Could not auto-extend token: {e}")

        pages = []
        url = f"{FB_GRAPH_BASE}/me/accounts"
        params = {
            "fields": "id,name,access_token,fan_count,category,picture{url}",
            "limit": "100",
            "access_token": active_token,
        }

        # Loop to handle pagination up to 10 pages (1,000 Facebook Pages max)
        for _ in range(10):
            try:
                r = await client.get(url, params=params)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")

            data = r.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=_format_fb_error(data))

            for item in data.get("data", []):
                pic_url = item.get("picture", {}).get("data", {}).get("url") if item.get("picture") else None
                pages.append({
                    "pageId": str(item.get("id")),
                    "name": item.get("name"),
                    "token": item.get("access_token"),
                    "fans": item.get("fan_count", 0),
                    "category": item.get("category", ""),
                    "avatar": pic_url,
                    "isPermanent": is_permanent,
                })

            paging = data.get("paging", {})
            next_url = paging.get("next")
            if not next_url:
                break
            url = next_url
            params = None

    return {"total": len(pages), "pages": pages, "isPermanent": is_permanent, "activeToken": active_token}


@app.post("/auth/facebook/exchange")
async def exchange_facebook_auth(
    code: Optional[str] = Form(None),
    token: Optional[str] = Form(None),
    app_id: str = Form(...),
    app_secret: str = Form(...),
    redirect_uri: Optional[str] = Form(None),
):
    """
    1-Click OAuth flow:
    1. Exchanges OAuth 'code' (or short-lived user token) for a user token.
    2. Exchanges that user token for a 60-day Long-Lived User Token.
    3. Fetches /me/accounts using the Long-Lived Token, which generates PERMANENT (never-expiring) Page Access Tokens!
    """
    async with httpx.AsyncClient(timeout=25) as client:
        user_token = token.strip() if token else None

        if code and code.strip():
            # Step 1: Exchange code for user access token
            token_res = await client.get(
                f"{FB_GRAPH_BASE}/oauth/access_token",
                params={
                    "client_id": app_id.strip(),
                    "client_secret": app_secret.strip(),
                    "redirect_uri": redirect_uri or "",
                    "code": code.strip(),
                },
            )
            token_data = token_res.json()
            if "error" in token_data:
                raise HTTPException(status_code=400, detail=_format_fb_error(token_data))
            user_token = token_data.get("access_token")

        if not user_token:
            raise HTTPException(status_code=400, detail="Missing authorization code or token from Facebook")

        # Step 2: Convert to Long-Lived Token (60 days)
        exchange_res = await client.get(
            f"{FB_GRAPH_BASE}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": app_id.strip(),
                "client_secret": app_secret.strip(),
                "fb_exchange_token": user_token,
            },
        )
        exchange_data = exchange_res.json()
        long_lived_token = exchange_data.get("access_token", user_token)

        # Step 3: Fetch all pages using the long-lived token -> Permanent Page Tokens
        pages = []
        url = f"{FB_GRAPH_BASE}/me/accounts"
        params = {
            "fields": "id,name,access_token,fan_count,category,picture{url}",
            "limit": "100",
            "access_token": long_lived_token,
        }

        for _ in range(10):
            r = await client.get(url, params=params)
            data = r.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=_format_fb_error(data))

            for item in data.get("data", []):
                pic_url = item.get("picture", {}).get("data", {}).get("url") if item.get("picture") else None
                pages.append({
                    "pageId": str(item.get("id")),
                    "name": item.get("name"),
                    "token": item.get("access_token"),
                    "fans": item.get("fan_count", 0),
                    "category": item.get("category", ""),
                    "avatar": pic_url,
                    "isPermanent": True,
                })

            paging = data.get("paging", {})
            next_url = paging.get("next")
            if not next_url:
                break
            url = next_url
            params = None

        return {
            "success": True,
            "total": len(pages),
            "pages": pages,
            "isPermanent": True,
            "userToken": long_lived_token,
        }


try:
    from backend.browser_sync import browser_sync_manager
except ImportError:
    from browser_sync import browser_sync_manager


@app.post("/auth/facebook/browser-login")
def start_browser_login():
    """Launches visible Chrome or Brave window for user to log into Facebook."""
    return browser_sync_manager.start_browser_login()


@app.get("/auth/facebook/browser-status")
def get_browser_login_status():
    """Polls status of the browser login session."""
    return browser_sync_manager.get_status()


@app.post("/auth/facebook/browser-reset")
def reset_browser_login():
    browser_sync_manager.reset()
    return {"status": "reset"}


@app.post("/browser-sync-pages")
async def receive_browser_sync(data: dict):
    """
    Receives session from 1-Click Bookmarklet running directly on facebook.com!
    """
    c_user = data.get("c_user")
    cookie_str = data.get("cookies", "")
    if not c_user:
        raise HTTPException(status_code=400, detail="Missing c_user")

    try:
        warmup_manager.import_admin_cookies(
            name=f"Admin ({str(c_user)[-4:]})",
            cookie_string=cookie_str,
            c_user=str(c_user),
            xs="",
        )
    except Exception as e:
        logger.warning(f"Could not seed admin profile: {e}")

    return {
        "status": "success",
        "total": 1,
        "c_user": c_user,
        "message": "Cookies received from browser! Profile is synced."
    }


async def _post_photo(page_id: str, token: str, caption: str, image_bytes, image_filename, scheduled_time: Optional[int] = None):
    async with httpx.AsyncClient(timeout=60) as client:
        if image_bytes:
            data = {"caption": caption, "access_token": token}
            if scheduled_time:
                data["published"] = "false"
                data["scheduled_publish_time"] = str(scheduled_time)
            r = await client.post(
                f"{FB_GRAPH_BASE}/{page_id}/photos",
                data=data,
                files={"source": (image_filename or "photo.jpg", image_bytes, "image/jpeg")},
            )
        else:
            data = {"message": caption, "access_token": token}
            if scheduled_time:
                data["published"] = "false"
                data["scheduled_publish_time"] = str(scheduled_time)
            r = await client.post(
                f"{FB_GRAPH_BASE}/{page_id}/feed",
                data=data,
            )
    result = r.json()
    if "error" in result:
        raise Exception(result["error"]["message"])
    return result.get("post_id") or result.get("id")


async def _post_video(page_id: str, token: str, caption: str, video_bytes: bytes, video_filename: str, scheduled_time: Optional[int] = None):
    async with httpx.AsyncClient(timeout=180) as client:
        data = {"description": caption, "access_token": token}
        if scheduled_time:
            data["published"] = "false"
            data["scheduled_publish_time"] = str(scheduled_time)
        r = await client.post(
            f"{FB_GRAPH_BASE}/{page_id}/videos",
            data=data,
            files={"source": (video_filename, video_bytes, "video/mp4")},
        )
    result = r.json()
    if "error" in result:
        raise Exception(result["error"]["message"])
    return result.get("id")


async def _add_comment(post_id: str, token: str, text: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{FB_GRAPH_BASE}/{post_id}/comments",
            data={"message": text, "access_token": token},
        )
    result = r.json()
    if "error" in result:
        raise Exception(result["error"]["message"])
    return result.get("id")


@app.get("/scheduled-posts")
async def get_scheduled_posts(page_id: str, token: str):
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{FB_GRAPH_BASE}/{page_id}/scheduled_posts",
            params={
                "fields": "id,message,scheduled_publish_time,created_time,is_published",
                "access_token": token,
            },
        )
    result = r.json()
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"]["message"])
    return {"posts": result.get("data", [])}


@app.delete("/scheduled-posts/{post_id}")
async def delete_scheduled_post(post_id: str, token: str):
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.delete(
            f"{FB_GRAPH_BASE}/{post_id}",
            params={"access_token": token},
        )
    result = r.json()
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"]["message"])
    return {"success": True, "deleted": post_id}


@app.post("/scheduled-posts/{post_id}/reschedule")
async def reschedule_post(
    post_id: str,
    scheduled_time: int = Form(...),
    token: str = Form(...),
):
    """
    Updates scheduled_publish_time on Facebook for an unpublished scheduled post or photo.
    Facebook requires the time to be between 10 minutes and 75 days in the future.
    """
    if not token or token.strip() == "browser_session":
        raise HTTPException(status_code=400, detail="Valid Meta Page token required to reschedule")

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{FB_GRAPH_BASE}/{post_id.strip()}",
            data={
                "scheduled_publish_time": str(scheduled_time),
                "access_token": token.strip(),
            },
        )
    result = r.json()
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"]["message"])
    return {"success": True, "postId": post_id, "scheduledTime": scheduled_time}


@app.post("/scheduled-posts/{post_id}/update")
async def update_scheduled_post(
    post_id: str,
    scheduled_time: Optional[int] = Form(None),
    caption: Optional[str] = Form(None),
    token: str = Form(...),
):
    """
    Updates caption and/or scheduled_publish_time on Facebook for an unpublished scheduled post or photo.
    """
    if not token or token.strip() == "browser_session":
        raise HTTPException(status_code=400, detail="Valid Meta Page token required to update post")

    clean_post_id = post_id.strip()
    data = {"access_token": token.strip()}
    if scheduled_time is not None:
        data["scheduled_publish_time"] = str(scheduled_time)
    if caption is not None:
        data["message"] = caption
        data["caption"] = caption

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{FB_GRAPH_BASE}/{clean_post_id}", data=data)
        result = r.json()
        if "error" in result:
            # Handle photo vs feed node field naming
            if "caption" in data:
                data.pop("caption")
                r2 = await client.post(f"{FB_GRAPH_BASE}/{clean_post_id}", data=data)
                result2 = r2.json()
                if "error" not in result2:
                    result = result2

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"]["message"])
    return {"success": True, "postId": clean_post_id}


@app.get("/post-media")
async def get_post_media(post_id: str, token: str):
    """Fetches media/image source URL for a scheduled or published Facebook post or photo."""
    if not token or token.strip() == "browser_session":
        logger.warning(f"[/post-media] Invalid or browser_session token passed for post_id={post_id}")
        return {"url": None, "error": "No valid Meta API token available"}

    clean_post_id = post_id.strip()
    logger.info(f"[/post-media] Requesting media for post_id={clean_post_id}")
    
    url = None
    async with httpx.AsyncClient(timeout=20) as client:
        # 1. Try fetching photo fields first
        try:
            r = await client.get(
                f"{FB_GRAPH_BASE}/{clean_post_id}",
                params={"fields": "images,source,full_picture,picture", "access_token": token.strip()},
            )
            data = r.json()
            logger.info(f"[/post-media] Photo query response: {data}")

            if "images" in data and isinstance(data["images"], list) and len(data["images"]) > 0:
                url = data["images"][0].get("source")
            if not url:
                url = data.get("source") or data.get("full_picture")

            # 2. If photo lookup didn't yield an image, try post fields (attachments & full_picture)
            if not url or "error" in data:
                r2 = await client.get(
                    f"{FB_GRAPH_BASE}/{clean_post_id}",
                    params={"fields": "full_picture,picture,attachments{media,subattachments}", "access_token": token.strip()},
                )
                data2 = r2.json()
                logger.info(f"[/post-media] Post query response: {data2}")

                if not url and data2.get("full_picture"):
                    url = data2.get("full_picture")

                # Check attachments
                attachments = data2.get("attachments", {}).get("data", [])
                if not url and attachments:
                    att_img = attachments[0].get("media", {}).get("image", {}).get("src")
                    if att_img:
                        url = att_img

                if not url:
                    url = data2.get("picture") or data.get("picture")
        except Exception as e:
            logger.error(f"[/post-media] Error fetching media for {clean_post_id}: {e}")
            return {"url": None, "error": str(e)}

    logger.info(f"[/post-media] Resolved URL: {url}")
    return {"url": url}


@app.post("/post")
async def post_to_accounts(
    caption: str = Form(...),
    comment: str = Form(""),
    delay: int = Form(3),
    accounts: str = Form(...),
    scheduled_time: Optional[int] = Form(None),
    media: Optional[UploadFile] = File(None),
):
    try:
        account_list = json.loads(accounts)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid accounts JSON")

    media_bytes = None
    media_filename = None
    media_type = None
    if media and media.filename:
        media_bytes = await media.read()
        media_filename = media.filename
        media_type = "video" if (media.content_type and media.content_type.startswith("video")) else "image"

    async def handle_account(acc: dict) -> dict:
        name = acc.get("name", "Unknown")
        token = acc.get("token", "")
        page_id = acc.get("pageId", "")

        if not token or not page_id:
            return {
                "accountId": acc.get("id"), "accountName": name,
                "status": "error", "postId": None,
                "message": "Missing token or page ID",
            }

        try:
            if media_bytes and media_type == "video":
                post_id = await _post_video(page_id, token, caption, media_bytes, media_filename, scheduled_time=scheduled_time)
            else:
                post_id = await _post_photo(page_id, token, caption, media_bytes, media_filename, scheduled_time=scheduled_time)

            logger.info(f"[{name}] Posted -> {post_id} (scheduled: {scheduled_time})")

            comment_id = None
            comment_err = None
            if not scheduled_time and comment.strip() and post_id:
                try:
                    await asyncio.sleep(delay)
                    comment_id = await _add_comment(post_id, token, comment)
                    logger.info(f"[{name}] Comment -> {comment_id}")
                except Exception as ce:
                    logger.warning(f"[{name}] Comment error: {ce}")
                    comment_err = str(ce)

            if scheduled_time:
                import datetime
                dt_str = datetime.datetime.fromtimestamp(scheduled_time).strftime("%b %d, %I:%M %p")
                msg = f"Scheduled on Facebook for {dt_str}."
            elif comment_id:
                msg = f"Posted! Comment added after {delay}s."
            elif comment_err:
                msg = f"Posted successfully! (Comment failed: {comment_err})"
            else:
                msg = "Posted successfully!"

            return {
                "accountId": acc.get("id"), "accountName": name,
                "status": "success", "postId": post_id,
                "commentId": comment_id, "message": msg,
                "isScheduled": bool(scheduled_time),
                "scheduledTime": scheduled_time,
            }

        except Exception as e:
            logger.error(f"[{name}] Error: {e}")
            return {
                "accountId": acc.get("id"), "accountName": name,
                "status": "error", "postId": None, "message": str(e),
            }

    results = await asyncio.gather(*[handle_account(a) for a in account_list])
    success = sum(1 for r in results if r["status"] == "success")
    return {
        "results": list(results),
        "summary": {"total": len(results), "success": success, "failed": len(results) - success},
    }

try:
    from warmup import warmup_manager
except ImportError:
    from backend.warmup import warmup_manager


@app.get("/warmup/status")
def get_warmup_status():
    return warmup_manager.get_status()


@app.get("/warmup/admins")
def get_warmup_admins():
    return {"admins": warmup_manager.get_admins()}


@app.post("/warmup/admins")
def add_warmup_admin(
    name: str = Form(""),
    cookie_string: str = Form(""),
    c_user: str = Form(""),
    xs: str = Form(""),
):
    try:
        return warmup_manager.import_admin_cookies(
            name=name,
            cookie_string=cookie_string,
            c_user=c_user,
            xs=xs,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/warmup/admins/{admin_id}")
def delete_warmup_admin(admin_id: str):
    return warmup_manager.delete_admin(admin_id)


@app.post("/warmup/import-cookie")
def import_cookie_legacy(
    cookie_string: str = Form(""),
    c_user: str = Form(""),
    xs: str = Form(""),
):
    try:
        return warmup_manager.import_admin_cookies(
            name="",
            cookie_string=cookie_string,
            c_user=c_user,
            xs=xs,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/warmup/start")
def start_warmup(
    admin_ids: str = Form("all"),
    duration: int = Form(10),
    headless: str = Form("true"),
    enable_reactions: str = Form("true"),
):
    is_headless = str(headless).lower() in ("true", "1", "yes")
    do_reactions = str(enable_reactions).lower() in ("true", "1", "yes")

    selected_admins = None
    if admin_ids and admin_ids != "all":
        try:
            # check if JSON list
            selected_admins = json.loads(admin_ids)
        except Exception:
            selected_admins = [x.strip() for x in admin_ids.split(",") if x.strip()]

    try:
        return warmup_manager.start_warmup(
            admin_ids=selected_admins,
            duration_minutes=duration,
            headless=is_headless,
            enable_reactions=do_reactions,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/warmup/stop")
def stop_warmup():
    return warmup_manager.stop_warmup()


@app.get("/warmup/schedule")
def get_warmup_schedule():
    return warmup_manager.get_schedule()


@app.post("/warmup/schedule")
def update_warmup_schedule(data: dict):
    return warmup_manager.update_schedule(data)

