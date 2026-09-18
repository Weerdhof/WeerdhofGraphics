#!/usr/bin/env python3
"""
Static file server for the SHL Story Generator, plus one on-demand endpoint:

    GET /api/results

Launches a headless Chromium (Playwright), loads
https://superhandballeague.com/competition-overview/, waits for its
JS-rendered results feed to appear, and returns the parsed matches as JSON.
The site has no public API and blocks direct browser fetches via CORS, and
its results are rendered client-side (not present in the raw HTML), so a
plain requests/urllib fetch can't see them — a real browser is needed to
run the page's own JavaScript. The browser is started fresh for each
request and closed immediately after, so nothing runs in the background
between clicks.

Usage:
    python3 server.py [port]

The port can also be supplied via the PORT environment variable (this is
what Railway and most other hosting platforms do automatically), which
takes precedence when no command-line argument is given.
"""

import json
import os
import re
import shutil
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "story-generator")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8760))
SOURCE_URL = "https://superhandballeague.com/competition-overview/"
SCORE_RE = re.compile(r"^(\d{1,3})\s*[-–]\s*(\d{1,3})$")

# Server-side save file. NOTE: Railway's filesystem is ephemeral by default —
# this survives restarts/crashes of the running container, but a fresh
# deploy (new container) starts with a clean disk. Good enough as a manual
# "also save this somewhere besides my own browser" button; not a database.
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
SAVE_FILE = os.path.join(DATA_DIR, "saved_state.json")


def fetch_results():
    from playwright.sync_api import sync_playwright

    # On Railway (Nixpacks), we install a system Chromium via nixPkgs instead
    # of Playwright's own ~300MB browser download, because that download's
    # shared-library expectations don't match the Nix container and fails to
    # launch. Nix's chromium build is self-contained, so pointing Playwright
    # at it (still via Playwright's own driver/protocol) works reliably. On a
    # normal dev machine there's no system chromium on PATH, so it falls back
    # to whatever `playwright install chromium` already set up locally.
    system_chromium = shutil.which("chromium") or shutil.which("chromium-browser")
    launch_kwargs = {
        "args": ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-setuid-sandbox"],
    }
    if system_chromium:
        launch_kwargs["executable_path"] = system_chromium

    console_errors = []
    page_errors = []
    failed_requests = []
    bad_responses = []

    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kwargs)
        try:
            page = browser.new_page()
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))
            page.on("requestfailed", lambda req: failed_requests.append(
                f"{req.method} {req.url} -> {req.failure}" if req.failure else f"{req.method} {req.url}"
            ))
            page.on("response", lambda res: bad_responses.append(f"{res.status} {res.url}") if res.status >= 400 else None)
            response = page.goto(SOURCE_URL, wait_until="domcontentloaded", timeout=20000)
            # The results are injected client-side after load, on a timeline
            # that isn't reliably captured by "networkidle" alone (seen in
            # practice: a container behind a different network path can end
            # up racing the AJAX call). Wait for the actual score text to
            # show up in the DOM instead of a generic network/selector signal.
            try:
                page.wait_for_function(
                    "() => /\\d{1,3}\\s*[-\\u2013]\\s*\\d{1,3}/.test(document.body.innerText)",
                    timeout=15000,
                )
            except Exception:
                pass  # fall through and parse whatever is there — diagnosable via the debug field below
            text = page.inner_text("body")
            status = response.status if response else None
            title = page.title()
            final_url = page.url
        finally:
            browser.close()

    lines = [l.strip() for l in text.split("\n") if l.strip()]
    results = []
    for i in range(1, len(lines) - 1):
        m = SCORE_RE.match(lines[i])
        if not m:
            continue
        results.append({
            "teamA": lines[i - 1],
            "scoreA": int(m.group(1)),
            "scoreB": int(m.group(2)),
            "teamB": lines[i + 1],
        })

    debug = None
    if not results:
        debug = {
            "http_status": status,
            "title": title,
            "final_url": final_url,
            "text_length": len(text),
            "raw_sample": text[:400],
            "console_errors": console_errors[:10],
            "page_errors": page_errors[:10],
            "failed_requests": failed_requests[:15],
            "bad_responses": bad_responses[:15],
        }
    return results, debug


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/results"):
            self.handle_results()
        elif self.path.startswith("/api/save"):
            self.handle_load_state()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/save"):
            self.handle_save_state()
        else:
            self.send_error(404)

    def handle_save_state(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            payload = json.loads(raw)
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(SAVE_FILE, "w", encoding="utf-8") as f:
                json.dump(payload, f)
            body = json.dumps({"ok": True}).encode("utf-8")
            self.send_response(200)
        except Exception as err:
            body = json.dumps({"error": str(err)}).encode("utf-8")
            self.send_response(400)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_load_state(self):
        try:
            with open(SAVE_FILE, "r", encoding="utf-8") as f:
                body = f.read().encode("utf-8")
            self.send_response(200)
        except FileNotFoundError:
            body = json.dumps({}).encode("utf-8")
            self.send_response(200)
        except Exception as err:
            body = json.dumps({"error": str(err)}).encode("utf-8")
            self.send_response(500)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_results(self):
        try:
            results, debug = fetch_results()
            payload = {"results": results}
            if debug is not None:
                payload["debug"] = debug
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
        except Exception as err:
            body = json.dumps({"error": str(err)}).encode("utf-8")
            self.send_response(502)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Serving {STATIC_DIR} on port {PORT}")
    server.serve_forever()
