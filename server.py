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

import html
import json
import os
import re
import sys
import urllib.request
from urllib.parse import parse_qs, urlparse
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

    # Deployed via the official mcr.microsoft.com/playwright/python Docker
    # image, which already bundles a Chromium build that exactly matches the
    # installed `playwright` pip version. (An earlier attempt pointed
    # Playwright at a Nix-installed system Chromium instead, to avoid
    # downloading a browser inside the Nixpacks build — but that version
    # mismatch made the page load [200 OK, correct title] while silently
    # failing to execute enough of the site's JS to render any content.)
    launch_kwargs = {
        "args": ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-setuid-sandbox"],
    }

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


def fetch_standings():
    from playwright.sync_api import sync_playwright

    launch_kwargs = {
        "args": ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-setuid-sandbox"],
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kwargs)
        try:
            page = browser.new_page()
            page.goto(SOURCE_URL, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_selector("#standingTable tbody tr", timeout=15000)
            rows = page.query_selector_all("#standingTable tbody tr")
            standings = []
            for row in rows:
                cells = row.query_selector_all("td")
                if len(cells) < 4:
                    continue
                standings.append({
                    "club": cells[1].inner_text().strip(),
                    "played": cells[2].inner_text().strip(),
                    "points": cells[3].inner_text().strip(),
                })
        finally:
            browser.close()

    return standings


WOMEN_BASE_URL = "https://shlw.nl"


def _fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (WeerdhofGraphics)"})
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode("utf-8", errors="replace")


def _clean(text):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text))).strip()


def parse_women_results(page):
    """shlw.nl/results is plain server-rendered HTML: one <a class="match"> per
    played match with two team <span>s and two score <span>s."""
    results = []
    for block in re.findall(r'<a class="match".*?</a>', page, re.S):
        teams = re.search(r'<div class="teams">(.*?)</div>', block, re.S)
        score = re.search(r'<div class="score">(.*?)</div>', block, re.S)
        if not teams or not score:
            continue
        names = [_clean(t) for t in re.findall(r"<span[^>]*>(.*?)</span>", teams.group(1), re.S)]
        scores = [_clean(t) for t in re.findall(r"<span[^>]*>(.*?)</span>", score.group(1), re.S)]
        if len(names) != 2 or len(scores) != 2 or not all(x.isdigit() for x in scores):
            continue
        date = re.search(r'<div class="date">(.*?)</div>', block, re.S)
        results.append({
            "teamA": names[0], "teamB": names[1],
            "scoreA": int(scores[0]), "scoreB": int(scores[1]),
            "date": _clean(date.group(1)) if date else "",
        })
    return results


def parse_women_standings(page):
    rows = []
    for tr in re.findall(r"<tr>\s*<td class=\"ranking.*?</tr>", page, re.S):
        name = re.search(r'<span class="hide-for-small">(.*?)</span>', tr, re.S)
        cells = re.findall(r'<td class="text-center(?: points)?">(.*?)</td>', tr, re.S)
        if not name or len(cells) < 2:
            continue
        rows.append({"club": _clean(name.group(1)), "played": _clean(cells[0]), "points": _clean(cells[1])})
    return rows


def fetch_women_results():
    return parse_women_results(_fetch_html(WOMEN_BASE_URL + "/results"))


def fetch_women_standings():
    return parse_women_standings(_fetch_html(WOMEN_BASE_URL + "/standings"))


# ---------- Schedule (fixtures with date + time), used by the "Check schema" button ----------
NL_MONTHS = {"januari": 1, "februari": 2, "maart": 3, "april": 4, "mei": 5, "juni": 6, "juli": 7, "augustus": 8,
             "september": 9, "oktober": 10, "november": 11, "december": 12}
EN_MONTHS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
MEN_API = "https://api.superhandballeague.com/general/api/sportsuite"
MEN_COMPETITION_ID_FALLBACK = "42272"


def _fetch_json(url):
    return json.loads(_fetch_html(url))


def _men_competition_id():
    # the id sits in the page's own API calls (match-result/ALL/<id>)
    try:
        m = re.search(r"match-result/ALL/(\d+)", _fetch_html(SOURCE_URL))
        if m:
            return m.group(1)
    except Exception:
        pass
    return MEN_COMPETITION_ID_FALLBACK


def fetch_men_schedule():
    cid = _men_competition_id()
    fixtures = []
    for endpoint, played in (("match-result/ALL", True), ("match-program/ALL", False)):
        for x in _fetch_json(f"{MEN_API}/{endpoint}/{cid}").get("data", []):
            d = re.match(r"\s*\w*\s*(\d+)\s+([a-z]+)", (x.get("date") or "").lower())
            if not d or d.group(2) not in NL_MONTHS:
                continue
            fixtures.append({
                "home": x.get("home_team_short") or x.get("home_team") or "",
                "away": x.get("away_team_short") or x.get("away_team") or "",
                "day": int(d.group(1)), "month": NL_MONTHS[d.group(2)],
                "time": x.get("match_time") or "", "played": played, "round": x.get("round"),
            })
    # the results feed can list the same match twice (seen for round 2)
    seen, unique = set(), []
    for f in fixtures:
        key = (f["home"], f["away"], f["day"], f["month"])
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique


def _en_day_month(text):
    m = re.search(r"(\d+)\s+([A-Za-z]{3})", text or "")
    if not m or m.group(2).lower() not in EN_MONTHS:
        return None, None
    return int(m.group(1)), EN_MONTHS[m.group(2).lower()]


def parse_women_matches(page):
    """shlw.nl/matches: upcoming fixtures with date, time and team names."""
    out = []
    for block in re.findall(r'<a class="match".*?</a>', page, re.S):
        date = re.search(r'<span class="date">(.*?)</span>', block, re.S)
        time = re.search(r'<span class="time">(.*?)</span>', block, re.S)
        names = [_clean(n) for n in re.findall(r'<span class="hide-for-small">(.*?)</span>', block, re.S)]
        if not date or len(names) != 2:
            continue
        day, month = _en_day_month(_clean(date.group(1)))
        if day is None:
            continue
        out.append({"home": names[0], "away": names[1], "day": day, "month": month,
                    "time": _clean(time.group(1)) if time else "", "played": False})
    return out


def fetch_women_schedule():
    upcoming = parse_women_matches(_fetch_html(WOMEN_BASE_URL + "/matches"))
    played = []
    for r in parse_women_results(_fetch_html(WOMEN_BASE_URL + "/results")):
        day, month = _en_day_month(r.get("date"))
        if day is None:
            continue
        # the results page has no kickoff time — the client keeps the existing one
        played.append({"home": r["teamA"], "away": r["teamB"], "day": day, "month": month, "time": "", "played": True})
    return played + upcoming


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/results"):
            self.handle_results()
        elif self.path.startswith("/api/standings"):
            self.handle_standings()
        elif self.path.startswith("/api/schedule"):
            self.handle_schedule()
        elif self.path.startswith("/api/save"):
            self.handle_load_state()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/save"):
            self.handle_save_state()
        else:
            self.send_error(404)

    def wants_women(self):
        return parse_qs(urlparse(self.path).query).get("comp", [""])[0] == "women"

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
            if self.wants_women():
                results, debug = fetch_women_results(), None
            else:
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

    def handle_schedule(self):
        try:
            fixtures = fetch_women_schedule() if self.wants_women() else fetch_men_schedule()
            body = json.dumps({"fixtures": fixtures}).encode("utf-8")
            self.send_response(200)
        except Exception as err:
            body = json.dumps({"error": str(err)}).encode("utf-8")
            self.send_response(502)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_standings(self):
        try:
            standings = fetch_women_standings() if self.wants_women() else fetch_standings()
            body = json.dumps({"standings": standings}).encode("utf-8")
            self.send_response(200)
        except Exception as err:
            body = json.dumps({"error": str(err)}).encode("utf-8")
            self.send_response(502)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # Always revalidate: otherwise a browser keeps running an older script.js/CSV after a deploy.
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Serving {STATIC_DIR} on port {PORT}")
    server.serve_forever()
