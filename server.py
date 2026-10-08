#!/usr/bin/env python3
"""
Server for the SHL Visuals Dashboard: static files plus a small JSON API.

Data sites (superhandballeague.com's sportsuite API for the men, shlw.nl for the women) are fetched into ONE
persisted store (DATA_DIR/sitedata.json) every 30 minutes and whenever a "Check" button asks for a refresh.
Everything else reads from that store:

    GET /api/results?comp=     played matches with scores     (?refresh=1 re-fetches the sites first)
    GET /api/schedule?comp=    full fixture list (played + upcoming)
    GET /api/standings?comp=   league table
    GET /api/overview?comp=    results + upcoming for the home page and the ticker
    GET /api/sync-status       when each competition was last checked / last changed

Plus per-item persistence (/api/item, /api/photo, /api/items, /api/backup, /api/restore). No headless browser needed.

Usage:
    python3 server.py [port]

The port can also be supplied via the PORT environment variable (Railway sets it).
"""

import html
import json
import os
import re
import sys
import threading
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
DATA_DIR = os.environ.get("DATA_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
SAVE_FILE = os.path.join(DATA_DIR, "saved_state.json")


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


# ---------- Per-item storage (settings, typed data and the photo of each round/match/etc.) ----------
# One JSON file per item key plus an optional photo file, both named after a hash of the key.
# Survives restarts; for deploys the DATA_DIR must live on a Railway Volume.
import hashlib
import io
import shutil
import time
import zipfile
from datetime import datetime

ITEM_DIR = os.path.join(DATA_DIR, "items")
PHOTO_DIR = os.path.join(DATA_DIR, "photos")
LOGO_DIR = os.path.join(DATA_DIR, "logos")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
MAX_SETTINGS_BYTES = 1024 * 1024
MAX_LOGO_BYTES = 3 * 1024 * 1024
LOGO_ID_RE = re.compile(r"^[a-z0-9:_.-]{1,60}$")
MAX_ITEM_BYTES = 2 * 1024 * 1024
MAX_PHOTO_BYTES = 25 * 1024 * 1024
MAX_RESTORE_BYTES = 400 * 1024 * 1024
HASH_RE = re.compile(r"^[0-9a-f]{40}$")


def _key_hash(key):
    return hashlib.sha1(key.encode("utf-8")).hexdigest()


def _valid_key(key):
    return bool(key) and len(key) <= 200



# ---------- Site data: ONE store that everything reads from ----------
# A background job (every 30 min) and the "Check" buttons refresh this store from the data sites; the
# check buttons, the home overview, the ticker and the schedule sync all read from it instead of
# fetching the sites themselves. It is persisted, so it survives restarts and a site outage just
# means slightly older data (with the time it was fetched shown in the UI).
SITE_FILE = os.path.join(DATA_DIR, "sitedata.json")
MONITOR_INTERVAL = int(os.environ.get("MONITOR_INTERVAL", 1800))
site_lock = threading.RLock()
refresh_locks = {"men": threading.Lock(), "women": threading.Lock()}
site_data = {"men": {}, "women": {}}   # comp -> {results, upcoming, standings, fetchedAt, checkedAt, changedAt, changes, error}


def _season_order(day, month):
    return ((month - 8) % 12) * 100 + day   # season runs Aug..Jul


def _fetch_matches(comp):
    """-> (results, upcoming), both lists of {home, away, day, month, time, round, ord[, homeScore, awayScore]}."""
    results, upcoming = [], []
    if comp == "women":
        for r in parse_women_results(_fetch_html(WOMEN_BASE_URL + "/results")):
            day, month = _en_day_month(r.get("date"))
            if day is None:
                continue
            results.append({"home": r["teamA"], "away": r["teamB"], "homeScore": r["scoreA"], "awayScore": r["scoreB"],
                            "day": day, "month": month, "time": "", "round": None, "ord": _season_order(day, month)})
        for f in parse_women_matches(_fetch_html(WOMEN_BASE_URL + "/matches")):
            upcoming.append({"home": f["home"], "away": f["away"], "day": f["day"], "month": f["month"], "time": f["time"],
                             "round": None, "ord": _season_order(f["day"], f["month"])})
    else:
        cid = _men_competition_id()
        for endpoint, bucket in (("match-result/ALL", results), ("match-program/ALL", upcoming)):
            for x in _fetch_json(f"{MEN_API}/{endpoint}/{cid}").get("data", []):
                d = re.match(r"\s*\w*\s*(\d+)\s+([a-z]+)", (x.get("date") or "").lower())
                if not d or d.group(2) not in NL_MONTHS:
                    continue
                day, month = int(d.group(1)), NL_MONTHS[d.group(2)]
                item = {"home": x.get("home_team_short") or x.get("home_team") or "",
                        "away": x.get("away_team_short") or x.get("away_team") or "",
                        "day": day, "month": month, "time": x.get("match_time") or "",
                        "round": x.get("round"), "ord": _season_order(day, month)}
                if bucket is results:
                    item["homeScore"], item["awayScore"] = x.get("home_result"), x.get("away_result")
                bucket.append(item)
    seen, uniq = set(), []     # the results feed can list the same match twice
    for r in results:
        k = (r["home"], r["away"], r["day"], r["month"])
        if k not in seen:
            seen.add(k)
            uniq.append(r)
    return uniq, upcoming


def _fetch_standings(comp):
    """-> [{club, played, points}] in table order."""
    if comp == "women":
        return fetch_women_standings()
    cid = _men_competition_id()
    rows = sorted(_fetch_json(f"{MEN_API}/pool-standing/{cid}").get("data", []), key=lambda r: r.get("position") or 99)
    return [{"club": r.get("name") or "", "played": str(r.get("games", "")), "points": str(r.get("points", ""))} for r in rows]


def _snapshot(d):
    return {
        "schedule": {f"{m['home']}|{m['away']}|{m['round']}": f"{m['day']}/{m['month']} {m['time']}" for m in d.get("upcoming", [])},
        "results": {f"{m['home']}|{m['away']}|{m['day']}/{m['month']}": f"{m.get('homeScore')}-{m.get('awayScore')}" for m in d.get("results", [])},
        "standings": {r["club"]: f"{r['played']}/{r['points']}" for r in d.get("standings", [])},
    }


def _diff_counts(old, new):
    out = {}
    for part in ("schedule", "results", "standings"):
        a, b = old.get(part, {}), new.get(part, {})
        out[part] = sum(1 for k in set(a) | set(b) if a.get(k) != b.get(k))
    return out


def _save_site():
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        tmp = SITE_FILE + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(site_data, fh)
        os.replace(tmp, SITE_FILE)
    except OSError:
        pass


def refresh_comp(comp):
    """Fetch everything for one competition into the store. Each part keeps its old value if its fetch fails."""
    with refresh_locks[comp]:
        now = int(time.time())
        with site_lock:
            old = dict(site_data.get(comp) or {})
        new, errors = dict(old), []
        try:
            new["results"], new["upcoming"] = _fetch_matches(comp)
            new["fetchedAt"] = now
        except Exception as err:
            errors.append(f"uitslagen/schema: {err}")
        try:
            new["standings"] = _fetch_standings(comp)
        except Exception as err:
            errors.append(f"stand: {err}")
        new["checkedAt"] = now
        if errors:
            new["error"] = "; ".join(errors)[:300]
        else:
            new.pop("error", None)
        if old.get("results") is not None or old.get("upcoming") is not None:
            counts = _diff_counts(_snapshot(old), _snapshot(new))
            if any(counts.values()):
                new["changedAt"] = now
                new["changes"] = counts
        with site_lock:
            site_data[comp] = new
            _save_site()
        return new


def get_comp_data(comp, force=False):
    """The stored data for a competition; fetches it first when forced, missing, or really stale."""
    with site_lock:
        d = site_data.get(comp) or {}
    stale = time.time() - d.get("fetchedAt", 0) > MONITOR_INTERVAL * 2
    if force or stale or (not d.get("results") and not d.get("upcoming")):
        d = refresh_comp(comp)
    if not d.get("results") and not d.get("upcoming"):
        raise RuntimeError(d.get("error") or "geen data beschikbaar")
    return d


_MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
_DAY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _en_date_label(m):
    """'Sat 3 Oct' — the format the site shows (the editor localizes it)."""
    today = datetime.now()
    start = today.year if today.month >= 8 else today.year - 1
    year = start if m["month"] >= 8 else start + 1
    try:
        wd = _DAY_EN[datetime(year, m["month"], m["day"]).weekday()]
    except ValueError:
        wd = ""
    return f"{wd} {m['day']} {_MONTH_EN[m['month'] - 1]}".strip()


def legacy_results(d):
    return [{"teamA": m["home"], "teamB": m["away"], "scoreA": m["homeScore"], "scoreB": m["awayScore"], "date": _en_date_label(m)}
            for m in d.get("results", []) if m.get("homeScore") is not None]


def legacy_schedule(d):
    out = []
    for played, items in ((True, d.get("results", [])), (False, d.get("upcoming", []))):
        for m in items:
            f = {"home": m["home"], "away": m["away"], "day": m["day"], "month": m["month"], "time": m["time"], "played": played}
            if m.get("round") is not None:
                f["round"] = m["round"]
            out.append(f)
    return out


def public_sync_status():
    with site_lock:
        return {"interval": MONITOR_INTERVAL,
                "status": {c: {k: v for k, v in d.items() if k in ("checkedAt", "fetchedAt", "changedAt", "changes", "error")}
                           for c, d in site_data.items()}}


def _monitor_loop():
    try:
        with open(SITE_FILE) as fh:
            loaded = json.load(fh)
        for c in ("men", "women"):
            site_data[c] = loaded.get(c, {})
    except (OSError, ValueError):
        pass
    time.sleep(5)
    while True:
        for comp in ("men", "women"):
            try:
                refresh_comp(comp)
            except Exception:
                pass
        time.sleep(MONITOR_INTERVAL)


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
        elif self.path.startswith("/api/overview"):
            self.handle_overview()
        elif self.path.startswith("/api/sync-status"):
            self.handle_sync_status()
        elif self.path.startswith("/api/settings"):
            self.handle_settings_get()
        elif self.path.startswith("/api/logo"):
            self.handle_logo_get()
        elif self.path.startswith("/api/items"):
            self.handle_items_list()
        elif self.path.startswith("/api/item"):
            self.handle_item_get()
        elif self.path.startswith("/api/photo"):
            self.handle_photo_get()
        elif self.path.startswith("/api/backup"):
            self.handle_backup()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/save"):
            self.handle_save_state()
        elif self.path.startswith("/api/restore"):
            self.handle_restore()
        elif self.path.startswith("/api/photo"):
            self.handle_photo_put()
        elif self.path.startswith("/api/item"):
            self.handle_item_put()
        else:
            self.send_error(404)

    def do_PUT(self):
        if self.path.startswith("/api/settings"):
            self.handle_settings_put()
        elif self.path.startswith("/api/logo"):
            self.handle_logo_put()
        elif self.path.startswith("/api/item"):
            self.handle_item_put()
        elif self.path.startswith("/api/photo"):
            self.handle_photo_put()
        else:
            self.send_error(404)

    def do_DELETE(self):
        if self.path.startswith("/api/logo"):
            self.handle_logo_delete()
        elif self.path.startswith("/api/photo"):
            self.handle_photo_delete()
        elif self.path.startswith("/api/item"):
            self.handle_item_delete()
        else:
            self.send_error(404)

    # --- per-item storage ---
    def _query_key(self):
        key = parse_qs(urlparse(self.path).query).get("key", [""])[0]
        return key if _valid_key(key) else None

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_item_get(self):
        key = self._query_key()
        if not key:
            return self._send_json(400, {"error": "bad key"})
        path = os.path.join(ITEM_DIR, _key_hash(key) + ".json")
        try:
            with open(path, "r", encoding="utf-8") as f:
                self._send_json(200, json.load(f))
        except FileNotFoundError:
            self._send_json(200, {})
        except Exception as err:
            self._send_json(500, {"error": str(err)})

    def handle_item_put(self):
        key = self._query_key()
        if not key:
            return self._send_json(400, {"error": "bad key"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > MAX_ITEM_BYTES:
                return self._send_json(413, {"error": "item too large"})
            payload = json.loads(self.rfile.read(length))
            if isinstance(payload, dict):
                payload["_key"] = key
                payload["_savedAt"] = int(time.time())
            os.makedirs(ITEM_DIR, exist_ok=True)
            tmp = os.path.join(ITEM_DIR, _key_hash(key) + ".tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(payload, f)
            os.replace(tmp, os.path.join(ITEM_DIR, _key_hash(key) + ".json"))
            self._send_json(200, {"ok": True})
        except Exception as err:
            self._send_json(400, {"error": str(err)})

    def handle_items_list(self):
        """Everything stored: one row per item hash (JSON record and/or photo), plus disk usage."""
        rows = {}
        def row(h):
            return rows.setdefault(h, {"hash": h, "key": "", "savedAt": 0, "bytes": 0, "photoBytes": 0})
        for folder, ext, field in ((ITEM_DIR, ".json", "bytes"), (PHOTO_DIR, ".bin", "photoBytes")):
            if not os.path.isdir(folder):
                continue
            for name in os.listdir(folder):
                h = name[:-len(ext)]
                if not name.endswith(ext) or not HASH_RE.match(h):
                    continue
                path = os.path.join(folder, name)
                r = row(h)
                r[field] = os.path.getsize(path)
                r["savedAt"] = max(r["savedAt"], int(os.path.getmtime(path)))
                if ext == ".json":
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        r["key"] = data.get("_key", "")
                        r["savedAt"] = data.get("_savedAt", r["savedAt"])
                    except Exception:
                        pass
        items = sorted(rows.values(), key=lambda x: x["savedAt"], reverse=True)
        usage = {"items": len(items), "bytes": sum(i["bytes"] + i["photoBytes"] for i in items)}
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            du = shutil.disk_usage(DATA_DIR)
            usage["diskTotal"], usage["diskFree"] = du.total, du.free
        except Exception:
            pass
        self._send_json(200, {"items": items, "usage": usage})

    def handle_item_delete(self):
        qs = parse_qs(urlparse(self.path).query)
        h = qs.get("hash", [""])[0]
        if not HASH_RE.match(h):
            key = qs.get("key", [""])[0]
            if not _valid_key(key):
                return self._send_json(400, {"error": "bad key"})
            h = _key_hash(key)
        for folder, ext in ((ITEM_DIR, ".json"), (PHOTO_DIR, ".bin"), (PHOTO_DIR, ".type")):
            try:
                os.remove(os.path.join(folder, h + ext))
            except FileNotFoundError:
                pass
        self._send_json(200, {"ok": True})

    def handle_backup(self):
        """A zip with every stored item and photo — the whole app state worth keeping."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
            for folder, prefix in ((ITEM_DIR, "items"), (PHOTO_DIR, "photos"), (LOGO_DIR, "logos")):
                if os.path.isdir(folder):
                    for name in sorted(os.listdir(folder)):
                        if name.endswith(".tmp"):
                            continue
                        z.write(os.path.join(folder, name), f"{prefix}/{name}")
            if os.path.isfile(SETTINGS_FILE):
                z.write(SETTINGS_FILE, "settings.json")
        data = buf.getvalue()
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", f'attachment; filename="shl-backup-{datetime.now():%Y%m%d-%H%M}.zip"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_restore(self):
        """Merge a backup zip back in (overwrites items/photos with the same key)."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > MAX_RESTORE_BYTES:
                return self._send_json(413, {"error": "backup too large"})
            z = zipfile.ZipFile(io.BytesIO(self.rfile.read(length)))
            restored = 0
            for info in z.infolist():
                if info.filename == "settings.json" and info.file_size <= MAX_SETTINGS_BYTES:
                    os.makedirs(DATA_DIR, exist_ok=True)
                    with z.open(info) as src, open(SETTINGS_FILE, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    restored += 1
                    continue
                m = re.match(r"^(items|photos|logos)/([0-9a-f]{40})\.(json|bin|type)$", info.filename)
                if not m or (m.group(1) == "items") != (m.group(3) == "json"):
                    continue
                folder = {"items": ITEM_DIR, "photos": PHOTO_DIR, "logos": LOGO_DIR}[m.group(1)]
                os.makedirs(folder, exist_ok=True)
                with z.open(info) as src, open(os.path.join(folder, f"{m.group(2)}.{m.group(3)}"), "wb") as dst:
                    shutil.copyfileobj(src, dst)
                restored += 1
            self._send_json(200, {"ok": True, "restored": restored})
        except zipfile.BadZipFile:
            self._send_json(400, {"error": "not a zip file"})
        except Exception as err:
            self._send_json(400, {"error": str(err)})

    # --- settings (default names, texts, logo overrides) ---
    def handle_settings_get(self):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            data = {}
        self._send_json(200, data)

    def handle_settings_put(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > MAX_SETTINGS_BYTES:
                return self._send_json(413, {"error": "settings too large"})
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(data, dict):
                return self._send_json(400, {"error": "settings must be an object"})
            os.makedirs(DATA_DIR, exist_ok=True)
            tmp = SETTINGS_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f)
            os.replace(tmp, SETTINGS_FILE)
            self._send_json(200, {"ok": True})
        except Exception as err:
            self._send_json(400, {"error": str(err)})

    def _logo_base(self):
        lid = parse_qs(urlparse(self.path).query).get("id", [""])[0]
        if not LOGO_ID_RE.match(lid):
            return None
        return os.path.join(LOGO_DIR, _key_hash(lid))

    def handle_logo_get(self):
        base = self._logo_base()
        if not base:
            return self.send_error(400)
        try:
            with open(base + ".bin", "rb") as f:
                data = f.read()
            ctype = "image/jpeg"
            try:
                with open(base + ".type", "r", encoding="utf-8") as f:
                    ctype = f.read().strip() or ctype
            except FileNotFoundError:
                pass
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self.send_error(404)

    def handle_logo_put(self):
        base = self._logo_base()
        if not base:
            return self._send_json(400, {"error": "bad id"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > MAX_LOGO_BYTES:
                return self._send_json(413, {"error": "logo too large"})
            data = self.rfile.read(length)
            os.makedirs(LOGO_DIR, exist_ok=True)
            with open(base + ".bin", "wb") as f:
                f.write(data)
            ctype = (self.headers.get("Content-Type") or "image/jpeg").split(";")[0]
            if not ctype.startswith("image/"):
                ctype = "image/jpeg"
            with open(base + ".type", "w", encoding="utf-8") as f:
                f.write(ctype)
            self._send_json(200, {"ok": True})
        except Exception as err:
            self._send_json(400, {"error": str(err)})

    def handle_logo_delete(self):
        base = self._logo_base()
        if not base:
            return self._send_json(400, {"error": "bad id"})
        for ext in (".bin", ".type"):
            try:
                os.remove(base + ext)
            except FileNotFoundError:
                pass
        self._send_json(200, {"ok": True})

    def handle_photo_get(self):
        key = self._query_key()
        if not key:
            return self.send_error(400)
        base = os.path.join(PHOTO_DIR, _key_hash(key))
        try:
            with open(base + ".bin", "rb") as f:
                data = f.read()
            ctype = "image/jpeg"
            try:
                with open(base + ".type", "r", encoding="utf-8") as f:
                    ctype = f.read().strip() or ctype
            except FileNotFoundError:
                pass
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self.send_error(404)

    def handle_photo_put(self):
        key = self._query_key()
        if not key:
            return self._send_json(400, {"error": "bad key"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > MAX_PHOTO_BYTES:
                return self._send_json(413, {"error": "photo too large"})
            data = self.rfile.read(length)
            os.makedirs(PHOTO_DIR, exist_ok=True)
            base = os.path.join(PHOTO_DIR, _key_hash(key))
            with open(base + ".bin", "wb") as f:
                f.write(data)
            ctype = (self.headers.get("Content-Type") or "image/jpeg").split(";")[0]
            if not ctype.startswith("image/"):
                ctype = "image/jpeg"
            with open(base + ".type", "w", encoding="utf-8") as f:
                f.write(ctype)
            self._send_json(200, {"ok": True})
        except Exception as err:
            self._send_json(400, {"error": str(err)})

    def handle_photo_delete(self):
        key = self._query_key()
        if not key:
            return self._send_json(400, {"error": "bad key"})
        base = os.path.join(PHOTO_DIR, _key_hash(key))
        for ext in (".bin", ".type"):
            try:
                os.remove(base + ext)
            except FileNotFoundError:
                pass
        self._send_json(200, {"ok": True})


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

    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _comp_data(self):
        """Stored data for ?comp=; ?refresh=1 re-fetches from the sites first."""
        qs = parse_qs(urlparse(self.path).query)
        comp = "women" if qs.get("comp", [""])[0] == "women" else "men"
        return get_comp_data(comp, force=bool(qs.get("refresh", [""])[0]))

    def handle_overview(self):
        try:
            d = self._comp_data()
            self._json(200, {"results": d.get("results", []), "upcoming": d.get("upcoming", []), "fetchedAt": d.get("fetchedAt")})
        except Exception as err:
            self._json(502, {"error": str(err)})

    def handle_sync_status(self):
        qs = parse_qs(urlparse(self.path).query)
        comp = qs.get("comp", [""])[0]
        if qs.get("refresh", [""])[0] and comp in ("men", "women"):
            refresh_comp(comp)
        self._json(200, public_sync_status())

    def handle_results(self):
        try:
            d = self._comp_data()
            self._json(200, {"results": legacy_results(d), "fetchedAt": d.get("fetchedAt")})
        except Exception as err:
            self._json(502, {"error": str(err)})

    def handle_schedule(self):
        try:
            d = self._comp_data()
            self._json(200, {"fixtures": legacy_schedule(d), "fetchedAt": d.get("fetchedAt")})
        except Exception as err:
            self._json(502, {"error": str(err)})

    def handle_standings(self):
        try:
            d = self._comp_data()
            self._json(200, {"standings": d.get("standings", []), "fetchedAt": d.get("fetchedAt")})
        except Exception as err:
            self._json(502, {"error": str(err)})

    def end_headers(self):
        # Always revalidate: otherwise a browser keeps running an older script.js/CSV after a deploy.
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Serving {STATIC_DIR} on port {PORT}")
    threading.Thread(target=_monitor_loop, daemon=True).start()
    server.serve_forever()
