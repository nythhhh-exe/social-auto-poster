import os
import sys
import time
import json
import random
import logging
import asyncio
import threading
from pathlib import Path
from typing import Optional, List, Dict
from playwright.sync_api import sync_playwright

logger = logging.getLogger("warmup")
logger.setLevel(logging.INFO)

PROFILES_BASE = Path(__file__).parent / "profiles"
PROFILES_BASE.mkdir(parents=True, exist_ok=True)
ADMINS_FILE = PROFILES_BASE / "admins.json"


def get_brave_executable() -> Optional[str]:
    possible_paths = [
        os.path.expandvars(r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"),
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
    ]
    for p in possible_paths:
        if os.path.exists(p):
            return p
    return None


class WarmupManager:
    def __init__(self):
        self.is_running = False
        self.status = "idle"
        self.seconds_elapsed = 0
        self.total_seconds = 0
        self.posts_viewed = 0
        self.videos_watched = 0
        self.reactions_given = 0
        self.current_admin_name = ""
        self.current_action = "Idle"
        self.error: Optional[str] = None
        self._thread: Optional[threading.Thread] = None

        # Auto-migrate legacy admin_profile if exists
        self._init_admins()

    def _init_admins(self):
        if not ADMINS_FILE.exists():
            legacy_profile = PROFILES_BASE / "admin_profile"
            legacy_cookies = legacy_profile / "cookies.json"
            admins = []
            if legacy_cookies.exists():
                try:
                    with open(legacy_cookies, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    c_user = next((c["value"] for c in data if c["name"] == "c_user"), "Unknown")
                    admins.append({
                        "id": f"admin_{c_user}",
                        "name": f"Admin ({c_user[-4:]})",
                        "c_user": c_user,
                        "addedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                        "lastWarmedUp": time.strftime("%Y-%m-%d %H:%M:%S"),
                        "profileDir": str(legacy_profile.name),
                    })
                except Exception as e:
                    logger.warning(f"Failed to migrate legacy cookies: {e}")
            with open(ADMINS_FILE, "w", encoding="utf-8") as f:
                json.dump(admins, f, indent=2)

    def get_admins(self) -> List[Dict]:
        if not ADMINS_FILE.exists():
            return []
        try:
            with open(ADMINS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def save_admins(self, admins: List[Dict]):
        with open(ADMINS_FILE, "w", encoding="utf-8") as f:
            json.dump(admins, f, indent=2)

    def delete_admin(self, admin_id: str) -> dict:
        admins = self.get_admins()
        new_admins = [a for a in admins if a["id"] != admin_id]
        self.save_admins(new_admins)
        return {"status": "ok", "deleted": admin_id}

    def get_status(self) -> dict:
        admins = self.get_admins()
        return {
            "isRunning": self.is_running,
            "status": self.status,
            "secondsElapsed": self.seconds_elapsed,
            "totalSeconds": self.total_seconds,
            "postsViewed": self.posts_viewed,
            "videosWatched": self.videos_watched,
            "reactionsGiven": self.reactions_given,
            "currentAdminName": self.current_admin_name,
            "currentAction": self.current_action,
            "error": self.error,
            "hasProfile": len(admins) > 0,
            "adminsCount": len(admins),
            "admins": admins,
        }

    def import_admin_cookies(self, name: str = "", cookie_string: str = "", c_user: str = "", xs: str = "") -> dict:
        if self.is_running:
            raise Exception("Warmup is currently running. Stop it first.")

        cookies_to_add = []

        if cookie_string and cookie_string.strip():
            raw = cookie_string.strip()
            if raw.lower().startswith("cookie:"):
                raw = raw[7:].strip()
            for part in raw.split(";"):
                if "=" in part:
                    k, v = part.strip().split("=", 1)
                    k = k.strip()
                    v = v.strip()
                    if k and v:
                        cookies_to_add.append({
                            "name": k,
                            "value": v,
                            "domain": ".facebook.com",
                            "path": "/",
                            "secure": True,
                        })

        if c_user and c_user.strip():
            cookies_to_add = [c for c in cookies_to_add if c["name"] != "c_user"]
            cookies_to_add.append({
                "name": "c_user",
                "value": c_user.strip(),
                "domain": ".facebook.com",
                "path": "/",
                "secure": True,
            })

        if xs and xs.strip():
            cookies_to_add = [c for c in cookies_to_add if c["name"] != "xs"]
            cookies_to_add.append({
                "name": "xs",
                "value": xs.strip(),
                "domain": ".facebook.com",
                "path": "/",
                "secure": True,
                "httpOnly": True,
            })

        c_user_val = next((c["value"] for c in cookies_to_add if c["name"] == "c_user"), None)
        xs_val = next((c["value"] for c in cookies_to_add if c["name"] == "xs"), None)

        if not c_user_val or not xs_val:
            raise Exception("Both 'c_user' and 'xs' are required in cookie data!")

        admin_dir_name = f"admin_{c_user_val}"
        target_dir = PROFILES_BASE / admin_dir_name
        target_dir.mkdir(parents=True, exist_ok=True)

        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

        try:
            with sync_playwright() as p:
                args = [
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                ]
                launch_kwargs = {
                    "user_data_dir": str(target_dir),
                    "headless": True,
                    "no_viewport": True,
                    "ignore_default_args": ["--enable-automation"],
                    "args": args,
                }
                brave_bin = get_brave_executable()
                if brave_bin:
                    launch_kwargs["executable_path"] = brave_bin

                context = p.chromium.launch_persistent_context(**launch_kwargs)
                context.add_cookies(cookies_to_add)

                page = context.pages[0] if context.pages else context.new_page()
                page.goto("https://www.facebook.com", timeout=30000)
                # Wait for Facebook to set all session cookies (datr, sb, fr, etc.)
                time.sleep(5)
                final_url = page.url

                # Harvest the FULL cookie jar — not just the seed cookies
                all_cookies = context.cookies("https://www.facebook.com")
                cookie_file = target_dir / "cookies.json"
                with open(cookie_file, "w", encoding="utf-8") as f:
                    json.dump(all_cookies, f, indent=2)
                logger.info(f"Saved {len(all_cookies)} cookies for {c_user_val}: {[c['name'] for c in all_cookies]}")

                context.close()

                if "login" in final_url.lower() or "two_step_verification" in final_url.lower():
                    return {
                        "status": "warning",
                        "c_user": c_user_val,
                        "message": "Cookies injected, but Facebook redirected to login. Verify your cookies.",
                    }

                # Save or update in admins.json
                admins = self.get_admins()
                admin_name = name.strip() or f"Admin ({c_user_val[-4:]})"
                existing = next((a for a in admins if a.get("c_user") == c_user_val), None)
                if existing:
                    existing["name"] = admin_name
                    existing["lastUpdated"] = time.strftime("%Y-%m-%d %H:%M:%S")
                else:
                    admins.append({
                        "id": f"admin_{c_user_val}",
                        "name": admin_name,
                        "c_user": c_user_val,
                        "addedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                        "lastWarmedUp": "Never",
                        "profileDir": admin_dir_name,
                    })
                self.save_admins(admins)

                return {
                    "status": "ok",
                    "c_user": c_user_val,
                    "name": admin_name,
                    "message": f"Successfully verified & saved Admin: {admin_name} (ID: {c_user_val})!",
                }
        except Exception as e:
            raise Exception(f"Failed to verify cookies: {str(e)}")

    def start_warmup(
        self,
        admin_ids: Optional[List[str]] = None,
        duration_minutes: int = 10,
        headless: bool = True,
        enable_reactions: bool = True,
    ):
        if self.is_running:
            return {"status": "already_running"}

        admins = self.get_admins()
        if not admins:
            raise Exception("No Admin accounts found. Please add an Admin via cookies first.")

        # Filter target admins
        target_admins = []
        if admin_ids and len(admin_ids) > 0 and admin_ids != ["all"]:
            target_admins = [a for a in admins if a["id"] in admin_ids]
        if not target_admins:
            target_admins = admins  # default to all

        self.is_running = True
        self.status = "running"
        self.seconds_elapsed = 0
        self.total_seconds = duration_minutes * 60 * len(target_admins)
        self.posts_viewed = 0
        self.videos_watched = 0
        self.reactions_given = 0
        self.current_action = f"Starting warmup for {len(target_admins)} Admin(s)..."
        self.error = None

        self._thread = threading.Thread(
            target=self._multi_warmup_worker,
            args=(target_admins, duration_minutes, headless, enable_reactions),
            daemon=True,
        )
        self._thread.start()
        return {"status": "started", "adminsCount": len(target_admins), "duration": duration_minutes}

    def stop_warmup(self):
        if not self.is_running:
            return {"status": "not_running"}

        self.is_running = False
        self.status = "stopped"
        self.current_action = "Warm-up stopped by user"
        return {"status": "stopped"}

    def _multi_warmup_worker(
        self,
        target_admins: List[Dict],
        duration_per_admin_mins: int,
        headless: bool,
        enable_reactions: bool,
    ):
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

        total_target_seconds = duration_per_admin_mins * 60
        overall_start = time.time()

        for idx, admin in enumerate(target_admins):
            if not self.is_running:
                break

            self.current_admin_name = admin["name"]
            self.current_action = f"[{idx+1}/{len(target_admins)}] Launching session for {admin['name']}..."

            admin_dir = PROFILES_BASE / admin.get("profileDir", f"admin_{admin['c_user']}")
            admin_dir.mkdir(parents=True, exist_ok=True)

            try:
                self._run_single_admin_session(
                    admin=admin,
                    admin_dir=admin_dir,
                    duration_seconds=total_target_seconds,
                    headless=headless,
                    enable_reactions=enable_reactions,
                    overall_start=overall_start,
                )
            except Exception as e:
                logger.error(f"Error warming up {admin['name']}: {e}")

            # Update lastWarmedUp in admins.json
            admins = self.get_admins()
            for a in admins:
                if a["id"] == admin["id"]:
                    a["lastWarmedUp"] = time.strftime("%Y-%m-%d %H:%M:%S")
            self.save_admins(admins)

            if idx < len(target_admins) - 1 and self.is_running:
                self.current_action = f"Cooling down 10s before next Admin..."
                time.sleep(10)

        self.is_running = False
        if self.status != "stopped":
            self.status = "completed"
            self.current_action = f"Completed all {len(target_admins)} Admin(s)! {self.posts_viewed} posts viewed, {self.videos_watched} videos watched, {self.reactions_given} reactions given!"

    def _run_single_admin_session(
        self,
        admin: Dict,
        admin_dir: Path,
        duration_seconds: int,
        headless: bool,
        enable_reactions: bool,
        overall_start: float,
    ):
        if sys.platform != "win32" and not os.environ.get("DISPLAY"):
            headless = True

        with sync_playwright() as p:
            args = [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ]
            if not headless:
                args.append("--start-maximized")

            launch_kwargs = {
                "user_data_dir": str(admin_dir),
                "headless": headless,
                "no_viewport": True,
                "ignore_default_args": ["--enable-automation"],
                "args": args,
            }
            brave_bin = get_brave_executable()
            if brave_bin:
                launch_kwargs["executable_path"] = brave_bin

            context = p.chromium.launch_persistent_context(**launch_kwargs)

            cookie_file = admin_dir / "cookies.json"
            if cookie_file.exists():
                try:
                    with open(cookie_file, "r", encoding="utf-8") as f:
                        saved_cookies = json.load(f)
                    context.add_cookies(saved_cookies)
                    logger.info(f"[{admin['name']}] Loaded {len(saved_cookies)} cookies")
                except Exception as e:
                    logger.warning(f"Failed to load cookies for {admin['name']}: {e}")

            page = context.pages[0] if context.pages else context.new_page()
            self.current_action = f"[{admin['name']}] Navigating to Facebook feed..."
            try:
                page.goto("https://www.facebook.com", timeout=60000)
            except Exception as e:
                logger.warning(f"[{admin['name']}] Navigation warning: {e}")
            time.sleep(4)

            # Check if we landed on login page — if so, skip this admin
            current_url = page.url
            if "login" in current_url.lower() or "two_step_verification" in current_url.lower():
                self.current_action = f"[{admin['name']}] ⚠️ Redirected to login! Please re-import cookies for this admin."
                logger.warning(f"[{admin['name']}] Session expired - redirected to {current_url}")
                try:
                    context.close()
                except Exception:
                    pass
                return

            # Refresh & save cookie jar with any new cookies Facebook set this session
            try:
                refreshed = context.cookies("https://www.facebook.com")
                if refreshed:
                    with open(cookie_file, "w", encoding="utf-8") as f:
                        json.dump(refreshed, f, indent=2)
                    logger.info(f"[{admin['name']}] Refreshed {len(refreshed)} cookies")
            except Exception as e:
                logger.warning(f"[{admin['name']}] Cookie refresh failed: {e}")

            admin_start = time.time()

            while self.is_running and (time.time() - admin_start < duration_seconds):
                if page.is_closed():
                    logger.info(f"[{admin['name']}] Page closed by user")
                    break

                self.seconds_elapsed = int(time.time() - overall_start)

                # 1. Human Scroll Down
                scroll_pixels = random.randint(220, 500)
                self.current_action = f"[{admin['name']}] Scrolling feed ({self.posts_viewed} viewed, {self.reactions_given} reacted)..."
                try:
                    page.evaluate(f"window.scrollBy({{ top: {scroll_pixels}, behavior: 'smooth' }});")
                    self.posts_viewed += 1
                except Exception as ex:
                    if page.is_closed():
                        break
                    time.sleep(1)

                # 2. Random Reading Pause
                pause_seconds = random.uniform(3.5, 7.5)
                self.current_action = f"[{admin['name']}] Reading post ({int(pause_seconds)}s)..."
                step_pause = 0
                while step_pause < pause_seconds and self.is_running:
                    time.sleep(0.5)
                    step_pause += 0.5
                    self.seconds_elapsed = int(time.time() - overall_start)

                if page.is_closed() or not self.is_running:
                    break

                # 3. Auto-Reaction (~20% chance if enabled)
                if enable_reactions and random.random() < 0.20:
                    try:
                        self._give_human_reaction(page, admin["name"])
                    except Exception as ex:
                        logger.debug(f"Reaction attempt skipped: {ex}")

                # 4. Occasional Video / Reel Watching (~25% chance)
                if random.random() < 0.25:
                    video_seconds = random.uniform(10.0, 20.0)
                    self.videos_watched += 1
                    self.current_action = f"[{admin['name']}] Watching video / reel ({int(video_seconds)}s)..."
                    step_video = 0
                    while step_video < video_seconds and self.is_running:
                        time.sleep(0.5)
                        step_video += 0.5
                        self.seconds_elapsed = int(time.time() - overall_start)

                if page.is_closed() or not self.is_running:
                    break

                # 5. Occasional Scroll Up (Human behavior, ~12% chance)
                if random.random() < 0.12:
                    up_pixels = random.randint(100, 200)
                    self.current_action = f"[{admin['name']}] Re-reading previous post..."
                    try:
                        page.evaluate(f"window.scrollBy({{ top: -{up_pixels}, behavior: 'smooth' }});")
                    except Exception:
                        pass
                    time.sleep(random.uniform(2.0, 3.5))

            try:
                context.close()
            except Exception:
                pass

    def _give_human_reaction(self, page, admin_name: str):
        """
        Finds a visible Like button in the viewport and gives a natural Like or Love reaction.
        """
        btn_info = page.evaluate("""
            (() => {
                const buttons = Array.from(document.querySelectorAll('div[role="button"], span[role="button"]'));
                for (const b of buttons) {
                    const label = (b.getAttribute('aria-label') || '').toLowerCase();
                    const text = (b.innerText || '').toLowerCase();
                    const isLike = (label === 'like' || label.includes('thích') || text.trim() === 'like');
                    const isAlreadyReacted = label.includes('unlike') || label.includes('remove') || label.includes('bỏ thích');
                    
                    if (isLike && !isAlreadyReacted) {
                        const rect = b.getBoundingClientRect();
                        if (rect.top >= 60 && rect.bottom <= (window.innerHeight - 50) && rect.width > 20) {
                            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, found: true };
                        }
                    }
                }
                return { found: false };
            })()
        """)

        if btn_info and btn_info.get("found"):
            x = btn_info["x"]
            y = btn_info["y"]
            react_type = "Love ❤️" if random.random() < 0.40 else "Like 👍"
            self.current_action = f"[{admin_name}] Giving {react_type} reaction..."

            # Move mouse naturally
            page.mouse.move(x, y, steps=5)
            time.sleep(0.3)

            if "Love" in react_type:
                # Hover to open reaction palette
                time.sleep(1.0)
                # Look for Love reaction button popup
                love_btn = page.query_selector('div[aria-label="Love"], div[aria-label="Yêu thích"]')
                if love_btn:
                    love_btn.click()
                else:
                    # Fallback to normal click
                    page.mouse.click(x, y)
            else:
                page.mouse.click(x, y)

            self.reactions_given += 1
            time.sleep(random.uniform(1.5, 2.5))


warmup_manager = WarmupManager()
