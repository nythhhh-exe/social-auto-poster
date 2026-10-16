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
async def fetch_pages(token: str):
    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Token is required")

    pages = []
    url = f"{FB_GRAPH_BASE}/me/accounts"
    params = {
        "fields": "id,name,access_token,fan_count,category,picture{url}",
        "limit": "100",
        "access_token": token.strip(),
    }

    async with httpx.AsyncClient(timeout=25) as client:
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
                })

            paging = data.get("paging", {})
            next_url = paging.get("next")
            if not next_url:
                break
            url = next_url
            params = None

    return {"total": len(pages), "pages": pages}


async def _post_photo(page_id: str, token: str, caption: str, image_bytes, image_filename):
    async with httpx.AsyncClient(timeout=60) as client:
        if image_bytes:
            r = await client.post(
                f"{FB_GRAPH_BASE}/{page_id}/photos",
                data={"caption": caption, "access_token": token},
                files={"source": (image_filename or "photo.jpg", image_bytes, "image/jpeg")},
            )
        else:
            r = await client.post(
                f"{FB_GRAPH_BASE}/{page_id}/feed",
                data={"message": caption, "access_token": token},
            )
    result = r.json()
    if "error" in result:
        raise Exception(result["error"]["message"])
    return result.get("post_id") or result.get("id")


async def _post_video(page_id: str, token: str, caption: str, video_bytes: bytes, video_filename: str):
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{FB_GRAPH_BASE}/{page_id}/videos",
            data={"description": caption, "access_token": token},
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


@app.post("/post")
async def post_to_accounts(
    caption: str = Form(...),
    comment: str = Form(""),
    delay: int = Form(3),
    accounts: str = Form(...),
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
                post_id = await _post_video(page_id, token, caption, media_bytes, media_filename)
            else:
                post_id = await _post_photo(page_id, token, caption, media_bytes, media_filename)

            logger.info(f"[{name}] Posted -> {post_id}")

            comment_id = None
            comment_err = None
            if comment.strip() and post_id:
                try:
                    await asyncio.sleep(delay)
                    comment_id = await _add_comment(post_id, token, comment)
                    logger.info(f"[{name}] Comment -> {comment_id}")
                except Exception as ce:
                    logger.warning(f"[{name}] Comment error: {ce}")
                    comment_err = str(ce)

            if comment_id:
                msg = f"Posted! Comment added after {delay}s."
            elif comment_err:
                msg = f"Posted successfully! (Comment failed: {comment_err})"
            else:
                msg = "Posted successfully!"

            return {
                "accountId": acc.get("id"), "accountName": name,
                "status": "success", "postId": post_id,
                "commentId": comment_id, "message": msg,
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

