import os
import sys
import time
import json
import logging
import threading
import asyncio
import traceback
from pathlib import Path
from typing import Optional, List, Dict
from playwright.sync_api import sync_playwright

logger = logging.getLogger("browser_sync")
logger.setLevel(logging.INFO)

PROFILES_BASE = Path(__file__).parent / "profiles"
PROFILES_BASE.mkdir(parents=True, exist_ok=True)
LOGIN_PROFILE_DIR = PROFILES_BASE / "browser_login_profile"
LOGIN_PROFILE_DIR.mkdir(parents=True, exist_ok=True)


def get_system_browser() -> Optional[str]:
    """Find installed Chrome, Brave, or Edge on Windows."""
    possible_paths = [
        # Google Chrome (Priority for standard compatibility)
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        # Brave Browser
        os.path.expandvars(r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"),
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        # Microsoft Edge
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for p in possible_paths:
        if os.path.exists(p):
            return p
    return None


class BrowserSyncManager:
    def __init__(self):
        self.state = "idle"  # idle | opening | waiting_login | extracting | success | error
        self.message = ""
        self.discovered_pages: List[Dict] = []
        self.c_user: Optional[str] = None
        self.admin_name: str = ""
        self.error: Optional[str] = None
        self._thread: Optional[threading.Thread] = None

    def get_status(self) -> Dict:
        return {
            "state": self.state,
            "message": self.message,
            "c_user": self.c_user,
            "admin_name": self.admin_name,
            "pages": self.discovered_pages,
            "total": len(self.discovered_pages),
            "error": self.error,
        }

    def reset(self):
        self.state = "idle"
        self.message = ""
        self.discovered_pages = []
        self.c_user = None
        self.admin_name = ""
        self.error = None

    def start_browser_login(self) -> Dict:
        if self.state in ("opening", "waiting_login", "extracting"):
            return {"status": "already_running", "message": "Login window is already active"}

        self.reset()
        self.state = "opening"
        self.message = "Launching browser window..."

        self._thread = threading.Thread(target=self._run_login_session, daemon=True)
        self._thread.start()

        return {"status": "started", "message": "Browser login window launched"}

    def _run_login_session(self):
        browser_exe = get_system_browser()
        if not browser_exe:
            self.state = "error"
            self.error = "No supported browser (Chrome, Brave, or Edge) found on system."
            return

        logger.info(f"Launching browser login using: {browser_exe}")

        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=False,
                    executable_path=browser_exe,
                    args=[
                        "--no-first-run",
                        "--no-default-browser-check",
                        "--disable-blink-features=AutomationControlled",
                        "--start-maximized",
                    ],
                )
                context = browser.new_context(no_viewport=True)
                page = context.new_page()

                self.state = "waiting_login"
                self.message = "Facebook window is open. Please log in with your Facebook account..."

                page.goto("https://www.facebook.com", timeout=60000)

                # Poll up to 180 seconds (3 mins) waiting for user to log in
                logged_in = False
                c_user_val = None
                start_time = time.time()

                while time.time() - start_time < 180:
                    time.sleep(2)
                    try:
                        cookies = context.cookies("https://www.facebook.com")
                    except Exception:
                        self.state = "error"
                        self.error = "Browser window was closed before login was completed."
                        return

                    c_user_cookie = next((c for c in cookies if c["name"] == "c_user"), None)
                    current_url = page.url.lower()

                    if c_user_cookie and "login" not in current_url:
                        c_user_val = c_user_cookie["value"]
                        logged_in = True
                        break

                if not logged_in:
                    self.state = "error"
                    self.error = "Login timed out after 3 minutes. Please try again."
                    try:
                        browser.close()
                    except Exception:
                        pass
                    return

                # Successfully logged in!
                self.c_user = c_user_val
                self.state = "extracting"
                self.message = f"Logged in as user {c_user_val}! Extracting your managed Facebook Pages..."

                # Save cookies for future auto-posting and warmup
                all_cookies = context.cookies("https://www.facebook.com")
                admin_dir = PROFILES_BASE / f"admin_{c_user_val}"
                admin_dir.mkdir(parents=True, exist_ok=True)
                with open(admin_dir / "cookies.json", "w", encoding="utf-8") as f:
                    json.dump(all_cookies, f, indent=2)

                # Navigate to Pages list to extract all managed pages
                page.goto("https://www.facebook.com/pages/?category=your_pages", timeout=45000)
                time.sleep(4)

                # Extract page links and names from DOM (strictly pages, filtering out notification jewels)
                extracted = page.evaluate("""
                    () => {
                        const results = [];
                        const seenIds = new Set();
                        const seenNames = new Set();
                        
                        const notificationKeywords = [
                            "notification", "unread", "tagged", "has new views", "new views",
                            "reel is ready", "your reel", "commented", "liked your", "shared", "shared your",
                            "story", "friend request", "messages", "see all", "create new page",
                            "switch into", "view reel", "views.", "in a post", "mentioned", "replied",
                            "reacted", "sent you", "has 6", "has 5", "has 4", "has 3", "has 2", "has 1"
                        ];
                        
                        // Restrict strictly to main content area to avoid top header nav, notification flyouts, and dock
                        const mainContainer = document.querySelector('[role="main"]') || document.querySelector('main') || document.body;
                        
                        // Strictly query page and profile links within main content
                        const elements = mainContainer.querySelectorAll('a[href*="/pages/"], a[href*="/profile.php?id="]');
                        
                        elements.forEach(el => {
                            const href = el.getAttribute('href') || '';
                            
                            // Skip notification URLs, reels, stories, messages, marketplace, groups
                            if (
                                href.includes('/notifications') || 
                                href.includes('/stories') || 
                                href.includes('/reels') || 
                                href.includes('/reel') ||
                                href.includes('/watch') ||
                                href.includes('/messages') ||
                                href.includes('/marketplace') ||
                                href.includes('/groups')
                            ) {
                                return;
                            }
                            
                            // Look for heading or bold title element first
                            const headingEl = el.querySelector('h2, h3, [role="heading"], strong, span[dir="auto"]');
                            let text = headingEl ? headingEl.innerText.trim() : (el.innerText ? el.innerText.trim() : '');
                            
                            if (!text) return;
                            
                            // Split by newline and take the first line (the page title)
                            const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
                            let cleanName = lines[0] || text;
                            
                            // Check if name contains notification phrases
                            const lower = cleanName.toLowerCase();
                            if (notificationKeywords.some(kw => lower.includes(kw))) {
                                return;
                            }
                            
                            if (lower.startsWith('unread') || lower === 'notifications' || lower === 'pages') {
                                return;
                            }
                            
                            // Strip timestamps and extra metrics (e.g., "· 14h", "· 22h")
                            cleanName = cleanName.replace(/\\s*·\\s*\\d+[hmdw].*$/i, '').trim();
                            
                            if (cleanName.length < 2 || cleanName.length > 50) return;
                            
                            // Extract numeric page ID
                            let id = null;
                            const idMatch = href.match(/id=(\\d+)/) || href.match(/pages\\/[^\\/]+\\/(\\d+)/) || href.match(/\\/(\\d{12,})/);
                            if (idMatch) {
                                id = idMatch[1];
                            }
                            
                            if (id && !seenIds.has(id) && !seenNames.has(cleanName.toLowerCase())) {
                                seenIds.add(id);
                                seenNames.add(cleanName.toLowerCase());
                                
                                let avatar = null;
                                
                                // Walk up to the parent card container to find the page avatar
                                let card = el;
                                for (let depth = 0; depth < 8; depth++) {
                                    if (!card.parentElement || card.parentElement === mainContainer) break;
                                    card = card.parentElement;
                                    
                                    // 1. Check for SVG image elements (standard in modern Facebook web)
                                    const svgImg = card.querySelector('image[*|href], image[href]');
                                    if (svgImg) {
                                        const src = svgImg.getAttribute('xlink:href') || svgImg.getAttribute('href');
                                        if (src && (src.includes('fbcdn.net') || src.includes('scontent'))) {
                                            avatar = src;
                                            break;
                                        }
                                    }
                                    
                                    // 2. Check for standard img elements pointing to fbcdn / scontent
                                    const cardImgs = card.querySelectorAll('img[src*="fbcdn.net"], img[src*="scontent"]');
                                    for (const cardImg of cardImgs) {
                                        const src = cardImg.getAttribute('src');
                                        if (src && !src.includes('/rsrc.php/')) { // exclude Facebook static UI icons
                                            avatar = src;
                                            break;
                                        }
                                    }
                                    if (avatar) break;
                                }
                                
                                results.push({
                                    pageId: id,
                                    name: cleanName,
                                    avatar: avatar,
                                    category: "Facebook Page",
                                    fans: 0
                                });
                            }
                        });
                        
                        return results;
                    }
                """)

                logger.info(f"DOM extraction found {len(extracted)} potential pages")

                # If DOM didn't catch specific format, fallback to basic profile info
                if not extracted:
                    extracted = [{
                        "pageId": c_user_val,
                        "name": f"Admin Profile ({c_user_val[-4:]})",
                        "avatar": None,
                        "category": "Main Profile",
                        "fans": 0,
                    }]

                self.discovered_pages = extracted
                self.state = "success"
                self.message = f"Success! Discovered {len(extracted)} Facebook Pages/Profiles."

                # Brief delay so user sees confirmation before window closes
                time.sleep(1.5)
                try:
                    browser.close()
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"Error during browser login session: {e}")
            self.state = "error"
            self.error = str(e)


# Global singleton instance
browser_sync_manager = BrowserSyncManager()
