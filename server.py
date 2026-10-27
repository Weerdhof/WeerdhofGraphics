#!/usr/bin/env python3
"""
Server for the SHL Visuals Dashboard: static files plus a small JSON API.

Data sites (superhandballeague.com's sportsuite API for the men, shlw.nl for the women) are fetched into ONE
persisted store (DATA_DIR/sitedata.json) every 30 minutes and whenever a "Check" button asks for a refresh.
Everything else reads from that store:

    GET /api/results?comp=     played matches with scores     (?refresh=1 re-fetches the sites first)
    GET /api/schedule?comp=    full fixture list (played + upcoming)
    GET /api/standings?comp=   league table
    GET /api/stream-state|stream-matches|stream-config, PUT /api/stream-config   stream dashboard (stream.html)
    GET|PUT /api/narrowcasting, GET /api/weather   the narrowcasting screen (/narrowcasting) and its agenda editor (/narrowcasting/beheer)
    GET /api/movers?comp=&since=0  table before the latest matchday + position changes (since = matchdays back)
    GET /api/overview?comp=    results + upcoming for the home page and the ticker
    GET /api/sync-status       when each competition was last checked / last changed

Plus per-item persistence (/api/item, /api/photo, /api/items, /api/backup, /api/restore).

Exports (so images can be fetched with a plain download, without driving the browser):

    PUT  /api/export?name=X.webp   every Export button also stores its image here (DATA_DIR/exports)
    GET  /exports/X.webp           download a stored export
    GET  /api/exports              list of stored exports (newest first)
    GET  /api/preview?asset=results&comp=men&format=story
                                   small preview image of any asset, rendered with real data (cached ~20 min)
    POST /api/usage, GET /api/usage  log of what was opened/exported when (for the "Uitgelicht" section)
    GET /api/plan                    the planning of the "Uitgelicht" section: learned from the usage log (auto) or the fixed planning
    GET|POST /api/thumbnail        render a livestream thumbnail server-side with a headless browser (Playwright) from
                                   kind=shl|shlw|nextmen|nextwomen, home, away, date (YYYY-MM-DD or DD-MM), time,
                                   format=webp|jpg|png (+ optional title, label, variant=highlights, homeLabel, awayLabel,
                                   homeName, awayName); answers with the image, or JSON with its URL when json=1.

Usage:
    python3 server.py [port]

The port can also be supplied via the PORT environment variable (Railway sets it).
"""

import base64
import calendar
import html
import json
import os
import queue
import re
import sys
import threading
import time
import urllib.request
from urllib.parse import parse_qs, unquote, urlparse
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
        row = {"club": _clean(name.group(1)), "played": _clean(cells[0]), "points": _clean(cells[1])}
        if len(cells) >= 8:
            row.update({"w": _clean(cells[2]), "d": _clean(cells[3]), "l": _clean(cells[4]), "gf": _clean(cells[5]), "ga": _clean(cells[6]), "gd": _clean(cells[7])})
        form = re.findall(r'<span class="(win|draw|loss|lose)"', tr)
        if form:
            row["form"] = ["w" if f == "win" else "d" if f == "draw" else "l" for f in form]
        rows.append(row)
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
import unicodedata
from datetime import datetime

ITEM_DIR = os.path.join(DATA_DIR, "items")
PHOTO_DIR = os.path.join(DATA_DIR, "photos")
EXPORT_DIR = os.path.join(DATA_DIR, "exports")
USAGE_FILE = os.path.join(DATA_DIR, "usage.json")
MAX_EXPORT_BYTES = 64 * 1024 * 1024
EXPORT_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.(png|jpe?g|webp|zip|mp4|webm)$", re.I)
EXPORT_TYPES = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "zip": "application/zip",
                "mp4": "video/mp4", "webm": "video/webm"}
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
    return [{"club": r.get("name") or "", "played": str(r.get("games", "")), "points": str(r.get("points", "")),
             "w": str(r.get("wins", "")), "d": str(r.get("draws", "")), "l": str(r.get("losses", ""))} for r in rows]


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


# club name (as the feeds write it) -> club code, to join the results feed with the standings feed (their names differ)
CLUB_ALIASES = {
    "men": {"SAB": ["bocholt"], "IZE": ["izegem"], "EUP": ["eupen"], "HCS": ["sprimont"], "BEV": ["bevo"], "PEL": ["pelt"],
            "BWH": ["hercules", "whc"], "DFS": ["arnhem"], "HUP": ["hurry"], "HCV": ["vise"], "HVA": ["aalsmeer", "royalfloraholland"],
            "HUB": ["hubo"], "VOL": ["volendam"], "TAC": ["tachos", "mossel", "witte ster"]},
    "women": {"DSVD": ["dsvd", "aqqo"], "E&O": ["misker", "oosting"], "FOR": ["foreholte"], "KWI": ["kwiek"], "MHV": ["m.h.v"],
              "PSV": ["hypotheekvisie", "eindhoven"], "QUI": ["quintus"], "SEW": ["westfriesland"], "V&L": ["geonius"],
              "VEN": ["venlo", "cabooter"], "VOC": ["ruitenheer"], "VOL": ["volendam"], "VZV": ["juro"], "WPK": ["westlandia"]},
}


def _club_code(comp, name):
    n = unicodedata.normalize("NFD", name or "")
    n = "".join(ch for ch in n if not unicodedata.combining(ch)).lower()
    for code, words in CLUB_ALIASES[comp].items():
        if any(w in n for w in words):
            return code
    return None


def _group_matchdays(comp, results):
    """Results grouped into matchdays, oldest first: [(key, [results])]. Men: by round; women: by consecutive dates."""
    by_round = comp == "men" and all(r.get("round") is not None for r in results)
    groups = {}
    if by_round:
        for r in results:
            groups.setdefault(("r", r["round"]), []).append(r)
    else:
        cluster, last = 0, None
        for r in sorted(results, key=lambda x: x["ord"]):
            if last is not None and r["ord"] - last > 1:
                cluster += 1
            last = r["ord"]
            groups.setdefault(("d", cluster), []).append(r)
    return sorted(groups.items(), key=lambda kv: max(x["ord"] for x in kv[1]))


def compute_movers(comp, since=0, force=False):
    """The table before the chosen matchday and the position changes since then.
    The results are grouped into matchdays (men: by round, women: by consecutive dates); `since` counts back from the latest
    matchday (0 = latest). The earlier table = current table minus the results of that matchday and everything after it
    (win = 2 points, draw = 1)."""
    d = get_comp_data(comp, force=force)
    standings = d.get("standings") or []
    results = [r for r in d.get("results", []) if r.get("homeScore") is not None and r.get("awayScore") is not None]
    if not standings or not results:
        raise RuntimeError("geen stand of uitslagen beschikbaar")
    days = _group_matchdays(comp, results)
    clusters = []
    for idx, (key, items) in enumerate(days):
        a, b = min(items, key=lambda x: x["ord"]), max(items, key=lambda x: x["ord"])
        clusters.append({"id": idx, "round": key[1] if key[0] == "r" else None, "matches": len(items),
                         "from": {"day": a["day"], "month": a["month"]}, "to": {"day": b["day"], "month": b["month"]}})
    since = max(0, min(int(since or 0), len(clusters) - 1))
    sel = len(clusters) - 1 - since
    dropped = [r for i, (_k, items) in enumerate(days) if i >= sel for r in items]
    kept = [r for i, (_k, items) in enumerate(days) if i < sel for r in items]

    def num(v):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return 0

    cur = []
    for i, row in enumerate(standings):
        cur.append({"club": row["club"], "code": _club_code(comp, row["club"]), "pos": i + 1,
                    "points": num(row.get("points")), "played": num(row.get("played"))})
    pts, played, gd = {}, {}, {}
    for r in cur:
        pts[r["code"]], played[r["code"]] = r["points"], r["played"]
    for r in dropped:                                  # take the dropped matchdays back out of the table
        h, a = _club_code(comp, r["home"]), _club_code(comp, r["away"])
        hs, as_ = num(r["homeScore"]), num(r["awayScore"])
        for code, mine, theirs in ((h, hs, as_), (a, as_, hs)):
            if code in pts:
                pts[code] -= 2 if mine > theirs else 1 if mine == theirs else 0
                played[code] -= 1
    for r in kept:
        h, a = _club_code(comp, r["home"]), _club_code(comp, r["away"])
        hs, as_ = num(r["homeScore"]), num(r["awayScore"])
        gd[h] = gd.get(h, 0) + hs - as_
        gd[a] = gd.get(a, 0) + as_ - hs
    # Tie-break on goal difference only when that reproduces the site's current order; otherwise teams level on points keep
    # their current relative order (no position change is claimed that the data cannot support).
    gd_all = {}
    for r in results:
        h, a = _club_code(comp, r["home"]), _club_code(comp, r["away"])
        hs, as_ = num(r["homeScore"]), num(r["awayScore"])
        gd_all[h] = gd_all.get(h, 0) + hs - as_
        gd_all[a] = gd_all.get(a, 0) + as_ - hs
    gd_rule = [r["code"] for r in sorted(cur, key=lambda r: (-r["points"], -gd_all.get(r["code"], 0), r["pos"]))] == [r["code"] for r in cur]
    order = sorted(cur, key=lambda r: (-pts.get(r["code"], 0), -gd.get(r["code"], 0) if gd_rule else 0, r["pos"]))
    prev_pos = {r["code"]: i + 1 for i, r in enumerate(order)}
    rows = []
    for r in cur:
        pp = prev_pos.get(r["code"]) if r["code"] else None
        rows.append({**r, "prevPos": pp, "delta": (pp - r["pos"]) if pp else 0,
                     "prevPoints": pts.get(r["code"]), "prevPlayed": played.get(r["code"])})
    return {"comp": comp, "clusters": clusters, "selected": sel, "since": since, "goalDiffRule": gd_rule, "rows": rows,
            "fetchedAt": d.get("fetchedAt")}


# ---------------------------------------------------------------------------
# Stream dashboard (stream.html): a full-screen page for a live stream that shows, relative to the kick-off of a match,
# the other results, the standings, a big title and then nothing (clean). Men only. The planning is stored here (stream.json).
# (In handball there is no kick-off: it is the throw-off. Variable names still say kickoff.)
# ---------------------------------------------------------------------------
STREAM_FILE = os.path.join(DATA_DIR, "stream.json")
STREAM_SCENES = ("round", "results", "h2h", "standings", "title", "form", "schedule", "clean")
STREAM_DEFAULT = {
    "match": {"mode": "auto", "comp": "men", "home": "", "away": "", "day": 0, "month": 0},   # auto: the next match to start (men only)
    "segments": [{"from": 30, "scene": "round"}, {"from": 22, "scene": "h2h"}, {"from": 15, "scene": "standings"},
                 {"from": 5, "scene": "title"}, {"from": 3, "scene": "clean"}],
    # option: the title all the way from `start` to `end` minutes before the start, cycling through `scenes` every `every` minutes
    # (`seconds` per slide); after `end` the steps above (title, then clean) apply as usual
    "cycle": {"on": False, "start": 30, "end": 5, "every": 5, "seconds": 30, "scenes": ["round", "h2h", "standings"]},
    "rotate": 12,          # seconds per page when a scene has more than fits
    "graceMin": 20,        # auto mode keeps a match selected this long after its kick-off
    "theme": "transparent",  # transparent (graphics over the live picture) | solid (with a background colour)
}


def _clean_stream_config(raw):
    raw = raw if isinstance(raw, dict) else {}
    d = json.loads(json.dumps(STREAM_DEFAULT))
    m = raw.get("match") if isinstance(raw.get("match"), dict) else {}
    d["match"]["mode"] = "manual" if m.get("mode") == "manual" else "auto"
    d["match"]["comp"] = "men"        # the stream dashboard is for the men's competition only
    for k in ("home", "away"):
        d["match"][k] = re.sub(r"[^A-Za-z0-9&.\- ]", "", str(m.get(k) or ""))[:40]
    for k, lo, hi in (("day", 0, 31), ("month", 0, 12)):
        try:
            d["match"][k] = max(lo, min(hi, int(m.get(k) or 0)))
        except (TypeError, ValueError):
            pass
    segs = []
    for x in (raw.get("segments") if isinstance(raw.get("segments"), list) else d["segments"])[:10]:
        if isinstance(x, dict) and x.get("scene") in STREAM_SCENES:
            try:
                segs.append({"from": max(0, min(240, int(x.get("from")))), "scene": x["scene"]})
            except (TypeError, ValueError):
                pass
    if segs:
        d["segments"] = sorted(segs, key=lambda x: -x["from"])
    cy = raw.get("cycle") if isinstance(raw.get("cycle"), dict) else {}
    dc = d["cycle"]
    dc["on"] = cy.get("on") is True
    for k, lo, hi in (("start", 2, 240), ("end", 0, 239), ("every", 1, 60), ("seconds", 5, 120)):
        try:
            dc[k] = max(lo, min(hi, int(cy.get(k, dc[k]))))
        except (TypeError, ValueError):
            pass
    dc["end"] = min(dc["end"], dc["start"] - 1)
    sc = [x for x in (cy.get("scenes") if isinstance(cy.get("scenes"), list) else dc["scenes"]) if x in STREAM_SCENES and x not in ("clean", "title")]
    dc["scenes"] = sc[:6] or ["round", "h2h", "standings"]
    for k, lo, hi in (("rotate", 4, 60), ("graceMin", 0, 180)):
        try:
            d[k] = max(lo, min(hi, int(raw.get(k, d[k]))))
        except (TypeError, ValueError):
            pass
    d["theme"] = raw.get("theme") if raw.get("theme") in ("solid", "transparent") else d["theme"]
    return d


def stream_config():
    try:
        with open(STREAM_FILE, "r", encoding="utf-8") as f:
            return _clean_stream_config(json.load(f))
    except (OSError, ValueError):
        return _clean_stream_config({})


def _ams_now_parts(ts):
    try:
        from zoneinfo import ZoneInfo
        return datetime.fromtimestamp(ts, ZoneInfo("Europe/Amsterdam"))
    except Exception:
        return datetime.fromtimestamp(ts)


def _kickoff_epoch(day, month, hhmm, now=None):
    """Unix time of a kick-off given as day, month and 'HH:MM' in Dutch local time (the year is inferred)."""
    mt = re.match(r"^(\d{1,2})[:.](\d{2})", hhmm or "")
    if not mt or not day or not month:
        return None
    now = now or time.time()
    year = _ams_now_parts(now).year
    for y in (year, year + 1, year - 1):
        try:
            naive = datetime(y, month, day, int(mt.group(1)), int(mt.group(2)))
        except ValueError:
            continue
        try:
            from zoneinfo import ZoneInfo
            ts = naive.replace(tzinfo=ZoneInfo("Europe/Amsterdam")).timestamp()
        except Exception:
            ts = naive.timestamp()
        if abs(ts - now) < 200 * 86400:
            return ts
    return None


def _clean_club(name):
    return re.sub(r"\s+(HS|DS)\d+\s*$", "", name or "").strip()


def stream_matches(comps=("men",)):
    """Upcoming matches (and the ones that started less than a day ago) of the men's competition, by start time."""
    out, now = [], time.time()
    for comp in comps:
        try:
            d = get_comp_data(comp)
        except Exception:
            continue
        for m in d.get("upcoming", []):
            ko = _kickoff_epoch(m.get("day"), m.get("month"), m.get("time"), now)
            out.append({"comp": comp, "home": _clean_club(m["home"]), "away": _clean_club(m["away"]),
                        "homeCode": _club_code(comp, m["home"]), "awayCode": _club_code(comp, m["away"]),
                        "day": m["day"], "month": m["month"], "time": m.get("time") or "", "round": m.get("round"),
                        "kickoff": ko, "ord": m.get("ord", 0)})
    out = [m for m in out if m["kickoff"] is None or m["kickoff"] > now - 86400]
    out.sort(key=lambda m: (m["kickoff"] if m["kickoff"] is not None else 9e12, m["ord"]))
    return out


def _pick_match(cfg, query):
    """The match the stream is about: ?comp=&home=&away= wins, then a manual choice, else the next kick-off."""
    now = time.time()
    mm = dict(cfg["match"])
    if query.get("home") and query.get("away"):
        mm = {"mode": "manual", "comp": "men", "home": query["home"][0], "away": query["away"][0], "day": 0, "month": 0}
    if mm["mode"] == "manual":
        cands = [m for m in stream_matches()
                 if m["homeCode"] == mm["home"] and m["awayCode"] == mm["away"] or (m["home"] == mm["home"] and m["away"] == mm["away"])]
        if mm.get("day"):
            cands = [m for m in cands if m["day"] == mm["day"] and (not mm.get("month") or m["month"] == mm["month"])]
        return cands[0] if cands else None
    grace = cfg["graceMin"] * 60
    for m in stream_matches():
        if m["kickoff"] is not None and m["kickoff"] + grace >= now:
            return m
    return None


def stream_state(query):
    cfg = stream_config()
    match = _pick_match(cfg, query)
    state = {"now": int(time.time() * 1000), "config": cfg, "match": match}
    if not match:
        return state
    comp = match["comp"]
    d = get_comp_data(comp)
    results = [r for r in d.get("results", []) if r.get("homeScore") is not None and r.get("awayScore") is not None]
    days = _group_matchdays(comp, results)
    latest = days[-1][1] if days else []
    label = None
    if days:
        a, b = min(latest, key=lambda x: x["ord"]), max(latest, key=lambda x: x["ord"])
        label = {"round": days[-1][0][1] if days[-1][0][0] == "r" else None, "from": {"day": a["day"], "month": a["month"]}, "to": {"day": b["day"], "month": b["month"]}}

    def res_row(r):
        return {"home": _clean_club(r["home"]), "away": _clean_club(r["away"]), "homeCode": _club_code(comp, r["home"]),
                "awayCode": _club_code(comp, r["away"]), "homeScore": r["homeScore"], "awayScore": r["awayScore"], "day": r["day"], "month": r["month"]}

    state["matchday"] = label
    state["results"] = [res_row(r) for r in sorted(latest, key=lambda x: x["ord"])]
    form = {}
    for r in sorted(results, key=lambda x: x["ord"]):                      # last 5 results per club, oldest first
        for code, mine, theirs in ((_club_code(comp, r["home"]), r["homeScore"], r["awayScore"]), (_club_code(comp, r["away"]), r["awayScore"], r["homeScore"])):
            if code:
                form.setdefault(code, []).append({"res": "W" if mine > theirs else "D" if mine == theirs else "L", "gf": mine, "ga": theirs,
                                                  "opp": _club_code(comp, r["away"] if code == _club_code(comp, r["home"]) else r["home"])})
    state["form"] = {k: v[-5:] for k, v in form.items()}
    state["standings"] = [dict(x, code=_club_code(comp, x["club"]), name=_clean_club(x["club"]), pos=i + 1)
                          for i, x in enumerate(d.get("standings") or [])]
    day = [m for m in stream_matches((comp,)) if m["day"] == match["day"] and m["month"] == match["month"]]
    state["schedule"] = day

    # the whole round of this match: played ones with their score, the rest with the kick-off time
    def rm(m, played):
        return {"home": _clean_club(m["home"]), "away": _clean_club(m["away"]), "homeCode": _club_code(comp, m["home"]),
                "awayCode": _club_code(comp, m["away"]), "day": m["day"], "month": m["month"], "time": m.get("time") or "",
                "played": played, "homeScore": m.get("homeScore") if played else None, "awayScore": m.get("awayScore") if played else None,
                "ord": m.get("ord", 0), "round": m.get("round")}
    pool = [rm(m, True) for m in d.get("results", []) if m.get("homeScore") is not None] + [rm(m, False) for m in d.get("upcoming", [])]
    me_ord = _season_order(match["day"], match["month"])
    if comp == "men" and match.get("round") is not None:
        rnd = [m for m in pool if m["round"] == match["round"]]
    else:
        near, last = [], None
        for m in sorted(pool, key=lambda x: x["ord"]):
            if last is None or m["ord"] - last > 1:
                near.append([])
            near[-1].append(m)
            last = m["ord"]
        rnd = next((g for g in near if any(x["ord"] == me_ord for x in g)), [])
    rnd.sort(key=lambda x: (x["ord"], x["time"] or "99:99"))
    for m in rnd:
        m["me"] = m["homeCode"] == match["homeCode"] and m["awayCode"] == match["awayCode"]
    state["round"] = {"round": match.get("round"), "matches": rnd}

    # previous meeting of the two clubs this season (most recent first)
    meet = None
    for r in sorted(results, key=lambda x: -x["ord"]):
        pair = {_club_code(comp, r["home"]), _club_code(comp, r["away"])}
        if pair == {match["homeCode"], match["awayCode"]}:
            meet = res_row(r)
            break
    state["meeting"] = meet
    return state


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
        # then get today's planned assets ready (preview + pre-filled data) in the background
        threading.Thread(target=lambda: (time.sleep(2), warm_previews()), daemon=True).start()
        time.sleep(MONITOR_INTERVAL)



# ---------------------------------------------------------------------------
# Server-side thumbnail rendering. The drawing code lives in the browser (canvas), so a real headless browser
# (Playwright, already in the Docker image) opens the app once, keeps it open, and calls window.ThumbAPI.render(...).
# One worker thread owns the browser (Playwright's sync API is bound to its thread); requests queue up behind it.
# Locally, set THUMB_BROWSER_CHANNEL=chrome to use the installed Google Chrome instead of Playwright's own Chromium.
# ---------------------------------------------------------------------------
class RendererBusy(Exception):
    pass


class RendererUnavailable(Exception):
    pass


class ThumbError(Exception):
    """A problem with the request (unknown club, bad date, ...): shown to the caller as a 400."""


class ThumbRenderer:
    MAX_PENDING = 6

    def __init__(self):
        self.jobs = queue.Queue()
        self.lock = threading.Lock()
        self.pending = 0
        self.thread = None
        self.unavailable = None

    def render(self, params, timeout=120, op="thumb"):
        if self.unavailable:
            raise RendererUnavailable(self.unavailable)
        with self.lock:
            if self.pending >= self.MAX_PENDING:
                raise RendererBusy("te druk: probeer het over een paar seconden opnieuw")
            self.pending += 1
            if self.thread is None:
                self.thread = threading.Thread(target=self._run, daemon=True)
                self.thread.start()
        job = {"params": params, "op": op, "done": threading.Event(), "result": None, "error": None}
        self.jobs.put(job)
        try:
            if not job["done"].wait(timeout):
                raise RendererUnavailable("renderen duurde te lang")
        finally:
            with self.lock:
                self.pending -= 1
        if job["error"]:
            raise job["error"]
        return job["result"]

    def _open(self):
        from playwright.sync_api import sync_playwright
        pw = sync_playwright().start()
        kw = {"args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if os.environ.get("THUMB_BROWSER_CHANNEL"):
            kw["channel"] = os.environ["THUMB_BROWSER_CHANNEL"]
        browser = pw.chromium.launch(**kw)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{PORT}/?thumbapi=1", wait_until="load", timeout=60000)
        page.wait_for_function("window.ThumbAPI !== undefined", timeout=60000)
        page.evaluate("() => window.ThumbAPI.ready")
        return pw, browser, page

    @staticmethod
    def _close(pw, browser):
        for closer in (lambda: browser and browser.close(), lambda: pw and pw.stop()):
            try:
                closer()
            except Exception:
                pass

    def _run(self):
        pw = browser = page = None
        while True:
            job = self.jobs.get()
            try:
                if page is None:
                    try:
                        pw, browser, page = self._open()
                    except ImportError:
                        self.unavailable = "Playwright is niet geïnstalleerd op deze server"
                        raise RendererUnavailable(self.unavailable)
                    except Exception as err:
                        self._close(pw, browser)
                        pw = browser = page = None
                        raise RendererUnavailable(f"browser starten mislukt: {err}")
                if job["op"] == "asset":
                    # an asset preview drives the editor itself: start from a fresh page every time
                    page.goto(f"http://127.0.0.1:{PORT}/?thumbapi=1", wait_until="load", timeout=60000)
                    page.wait_for_function("window.AssetAPI !== undefined", timeout=60000)
                    job["result"] = page.evaluate("p => window.AssetAPI.render(p)", job["params"])
                else:
                    job["result"] = page.evaluate("p => window.ThumbAPI.render(p)", job["params"])
            except RendererUnavailable as err:
                job["error"] = err
            except Exception as err:
                msg = str(err)
                m = re.search(r"(?:ThumbAPI|AssetAPI): ([^\n]*)", msg)
                if m:
                    job["error"] = ThumbError(m.group(1).strip())
                else:
                    job["error"] = RuntimeError(msg.splitlines()[0][:300] if msg else "renderen mislukt")
                    self._close(pw, browser)       # start from a clean browser next time
                    pw = browser = page = None
            finally:
                job["done"].set()


RENDERER = ThumbRenderer()


# ---------------------------------------------------------------------------
# "Uitgelicht": previews of the assets in the weekly planning, and a log of what is used when.
# ---------------------------------------------------------------------------
PREVIEW_ASSETS = {"movers", "results", "schedule", "ranking", "match", "matchresult", "prediction", "headtohead", "playerweek", "topscorer", "nowlive"}
PREVIEW_TTL = 20 * 60
preview_cache = {}               # (asset, comp, format) -> (time, webp bytes)
preview_locks = {}
preview_locks_guard = threading.Lock()
# weekday (0 = Monday) -> the assets of that day's planning; warmed up in the background so a click shows data at once
WEEK_PLAN = {
    5: [("results", "story"), ("prediction", "story")],
    6: [("matchresult", "story"), ("ranking", "story")],
    0: [("results", "post"), ("results", "story")],
    1: [("playerweek", "post"), ("ranking", "post")],
    2: [("schedule", "story"), ("schedule", "post")],
    3: [("match", "story"), ("headtohead", "story")],
    4: [("match", "story"), ("headtohead", "story")],
}


def get_preview(asset, comp, fmt, fresh=False):
    key = (asset, comp, fmt)
    with preview_locks_guard:
        lock = preview_locks.setdefault(key, threading.Lock())
    with lock:
        hit = preview_cache.get(key)
        if hit and not fresh and time.time() - hit[0] < PREVIEW_TTL:
            return hit[1], int(time.time() - hit[0])
        result = RENDERER.render({"asset": asset, "comp": comp, "format": fmt}, timeout=90, op="asset")
        data = base64.b64decode(result["dataUrl"].split(",", 1)[1])
        preview_cache[key] = (time.time(), data)
        return data, 0


DAY_WEEKDAYS = {"za": [5], "zo": [6], "ma": [0], "di": [1], "wo": [2], "dovr": [3, 4]}
PLAN_MIN_DAYS = 2            # an asset must have been used on at least this many different days of that weekday group to count
PLAN_HALF_LIFE_DAYS = 28.0   # recent use counts more than old use
PLAN_WINDOW_DAYS = 120
USE_WEIGHT = {"open": 1.0, "export": 3.0}


def _day_key(wd):
    for key, wds in DAY_WEEKDAYS.items():
        if wd in wds:
            return key
    return None


def _dash_settings():
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f).get("dash") or {}
    except (OSError, ValueError, TypeError):
        return {}


def _manual_plan():
    """Per day group the [asset, format] list from the settings page (dash.plan), else the built-in WEEK_PLAN."""
    saved = _dash_settings().get("plan") or {}
    plan = {}
    for key, wds in DAY_WEEKDAYS.items():
        items = []
        if isinstance(saved.get(key), list):
            items = [(a, f) for a, f in (tuple(x) for x in saved[key] if isinstance(x, (list, tuple)) and len(x) == 2)
                     if a in PREVIEW_ASSETS and f in ("story", "post", "")]
        plan[key] = items or list(WEEK_PLAN.get(wds[0], []))
    return plan


def _local_day(ts):
    """(date, weekday) of a unix time in Dutch local time."""
    try:
        from zoneinfo import ZoneInfo
        d = datetime.fromtimestamp(ts, ZoneInfo("Europe/Amsterdam"))
    except Exception:
        d = datetime.fromtimestamp(ts)
    return d.date(), d.weekday()


def learned_plan(now=None):
    """What is really used per weekday group, from the usage log: {key: [{asset, format, score, days}] best first}.
    One day counts once per asset (an export outweighs an open); recent days count more than old ones."""
    now = now or time.time()
    best = {}                                  # (key, asset, fmt, date) -> weight of that day
    for e in _usage_read():
        t, asset, action = e.get("t"), e.get("asset"), e.get("action", "open")
        if not isinstance(t, (int, float)) or asset not in PREVIEW_ASSETS or e.get("comp") not in ("men", "women"):
            continue
        w = USE_WEIGHT.get(action)
        age = (now - t) / 86400.0
        if not w or age > PLAN_WINDOW_DAYS or age < 0:
            continue
        day, wd = _local_day(t)
        key = _day_key(wd)
        fmt = e.get("format") if e.get("format") in ("story", "post") else "story"
        k = (key, asset, fmt, day)
        best[k] = max(best.get(k, 0.0), w * 0.5 ** (age / PLAN_HALF_LIFE_DAYS))
    agg = {}
    for (key, asset, fmt, _day), score in best.items():
        a = agg.setdefault((key, asset, fmt), {"score": 0.0, "days": 0})
        a["score"] += score
        a["days"] += 1
    out = {key: [] for key in DAY_WEEKDAYS}
    for (key, asset, fmt), a in agg.items():
        out[key].append({"asset": asset, "format": fmt, "score": round(a["score"], 2), "days": a["days"]})
    for key in out:
        out[key].sort(key=lambda x: (-x["score"], x["asset"]))
    return out


def effective_plan():
    """The planning shown on the dashboard: in 'auto' mode the two most used assets of that weekday (when each has been
    used on at least PLAN_MIN_DAYS days), completed from the fixed planning; in 'manual' mode only the fixed planning."""
    mode = "manual" if _dash_settings().get("planMode") == "manual" else "auto"
    manual, learned = _manual_plan(), learned_plan()
    plan = {}
    for key in DAY_WEEKDAYS:
        picks = []
        if mode == "auto":
            picks = [{"asset": x["asset"], "format": x["format"], "source": "usage", "score": x["score"], "days": x["days"]}
                     for x in learned[key] if x["days"] >= PLAN_MIN_DAYS][:2]
        for asset, fmt in manual[key]:
            if len(picks) >= 2:
                break
            if not any(p["asset"] == asset and p["format"] == (fmt or "story") for p in picks):
                picks.append({"asset": asset, "format": fmt or "story", "source": "fixed"})
        plan[key] = picks
    return {"mode": mode, "plan": plan, "learned": learned, "minDays": PLAN_MIN_DAYS}


def _plan_for_today():
    """Today's [asset, format] list (the effective planning)."""
    key = _day_key(datetime.now().weekday())
    return [(p["asset"], p["format"]) for p in effective_plan()["plan"].get(key, [])]


def warm_previews():
    """Render today's planned assets (both competitions) so the preview and the pre-filled data are ready."""
    if RENDERER.unavailable or RENDERER.pending:
        return
    for asset, fmt in _plan_for_today():
        for comp in ("men", "women"):
            try:
                get_preview(asset, comp, fmt)
            except Exception:
                pass


usage_lock = threading.Lock()
photo_changed = {}               # 'comp:asset:format' -> time of the last photo change (upload, move, removal): the preview is stale after it


def _usage_read():
    try:
        with open(USAGE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def usage_add(entry):
    with usage_lock:
        log = _usage_read()
        log.append(entry)
        log = log[-3000:]
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            tmp = USAGE_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(log, f)
            os.replace(tmp, USAGE_FILE)
        except OSError:
            pass


def usage_summary(limit=40):
    log = _usage_read()
    last, counts = {}, {}
    for e in log:
        k = f"{e.get('comp')}:{e.get('asset')}:{e.get('format') or ''}"
        last.setdefault(k, {})[e.get("action", "open")] = e.get("t")
        counts[k] = counts.get(k, 0) + 1
    return {"recent": log[-limit:][::-1], "last": last, "counts": counts, "photo": dict(photo_changed)}


def _safe_export_name(name):
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name or "")
    return name if EXPORT_NAME_RE.match(name) else None


# ---------------------------------------------------------------------------
# Narrowcasting (narrowcasting.html on a screen): the agenda is filled in by hand on /narrowcasting/beheer and stored here
# (narrowcasting.json); the weather comes from Open-Meteo, fetched by the server (the TV's browser then needs no
# certificates or CORS) and kept for 15 minutes.
# ---------------------------------------------------------------------------
NARROW_FILE = os.path.join(DATA_DIR, "narrowcasting.json")
NARROW_PILLARS = ("productie", "jump", "marketing", "content", "standaard", "navy")
WEATHER_PLACE = {"name": "Veenendaal", "lat": 52.0267, "lon": 5.5583}
_weather = {"at": 0, "data": None}


NARROW_COMPS = ("shl", "shlw", "lvlm", "lvlw")
NARROW_SPORTS = ("basketbal", "volleybal", "handbal", "voetbal", "tennis", "padel", "hockey", "zwemmen", "hardlopen", "wielrennen", "turnen",
                 "vechtsport", "honkbal", "rugby", "golf", "schaatsen", "skien", "fitness", "roeien", "zeilen", "esports", "finish")


def _clean_narrow(raw):
    raw = raw if isinstance(raw, dict) else {}
    items = []
    def valid_date(v):
        try:
            datetime.strptime(str(v or ""), "%Y-%m-%d")
            return str(v)
        except ValueError:
            return ""
    def hhmm(v):
        v = str(v or "")
        return v if re.match(r"^([01]\d|2[0-3]):[0-5]\d$", v) else ""
    for x in (raw.get("items") if isinstance(raw.get("items"), list) else [])[:300]:
        if not isinstance(x, dict):
            continue
        date = valid_date(x.get("date"))
        if not date:
            continue
        end_date = valid_date(x.get("endDate"))
        if end_date <= date:
            end_date = ""
        all_day = x.get("allDay") is True
        pillars = x.get("pillars") if isinstance(x.get("pillars"), list) else ([x.get("pillar")] if x.get("pillar") else [])
        pillars = [p for i, p in enumerate(pillars) if p in NARROW_PILLARS and p not in pillars[:i]][:4] or ["standaard"]
        items.append({
            "id": re.sub(r"[^A-Za-z0-9_-]", "", str(x.get("id") or ""))[:24] or "i%d" % int(time.time() * 1000 + len(items)),
            "date": date, "endDate": end_date, "time": "" if all_day else hhmm(x.get("time")), "end": "" if all_day else hhmm(x.get("end")),
            "title": str(x.get("title") or "").strip()[:80], "place": str(x.get("place") or "").strip()[:60],
            "pillars": pillars, "sport": x.get("sport") if x.get("sport") in NARROW_SPORTS else "",
            "featured": x.get("featured") is True, "jump": x.get("jump") is not False, "allDay": all_day,
        })
    items.sort(key=lambda i: (i["date"], i["time"] or "00:00", i["title"]))
    show_raw = raw.get("show") if isinstance(raw.get("show"), dict) else {}
    show = {k: show_raw.get(k) is not False for k in NARROW_COMPS}          # which competitions the programme slide shows (default: all)
    return {"items": items, "show": show}


def narrow_data():
    try:
        with open(NARROW_FILE, "r", encoding="utf-8") as f:
            return _clean_narrow(json.load(f))
    except (OSError, ValueError):
        return _clean_narrow({})


def _season_date(day, month, today):
    """The date (YYYY-MM-DD) of a fixture given as day + month: the year is the one that puts it closest after today."""
    for y in (today.year, today.year + 1, today.year - 1):
        try:
            d = datetime(y, month, day).date()
        except ValueError:
            continue
        if -120 <= (d - today).days <= 245:
            return d.isoformat()
    return ""


def _clean_team(name):
    return re.sub(r"\s+[HD]S\d+$", "", str(name or "")).strip()


def narrow_matches():
    """The next matches of SHL, SHLW and the Lotto Volley League (men and women) for the programme slide."""
    today = _ams_now_parts(time.time()).date()
    out = []
    for comp, key in (("men", "shl"), ("women", "shlw")):
        try:
            for m in get_comp_data(comp).get("upcoming", []):
                date = _season_date(int(m.get("day") or 0), int(m.get("month") or 0), today)
                if date and date >= today.isoformat():
                    out.append({"comp": key, "home": _clean_team(m.get("home")), "away": _clean_team(m.get("away")), "date": date, "time": str(m.get("time") or "")[:5]})
        except Exception:
            pass
    rows = None
    try:                                             # a programme that was read in on the LVL thumbnails page wins over the file that ships with the app
        with open(os.path.join(ITEM_DIR, _key_hash("lvl:schedule") + ".json"), "r", encoding="utf-8") as f:
            rows = (json.load(f).get("data") or {}).get("rows")
    except (OSError, ValueError, AttributeError):
        rows = None
    if not rows:
        try:
            import csv
            with open(os.path.join(STATIC_DIR, "assets", "lvl", "schedule.csv"), "r", encoding="utf-8-sig", newline="") as f:
                rows = list(csv.DictReader(f))
        except OSError:
            rows = []
    for r in rows or []:
        try:
            name, when = str(r.get("Naam") or ""), str(r.get("TijdText") or "")
            tag = re.match(r"^\[(LVL[MW])\]\s*", name)
            body = name[tag.end():] if tag else name
            teams = re.split(r"\s+[\u2013\u2014-]\s+", body, maxsplit=1)
            mt = re.match(r"^(\d{1,2})/(\d{1,2})(?:\s*-\s*(\d{1,2}[:.]\d{2}))?", when)
            if not mt or len(teams) != 2:
                continue
            date = _season_date(int(mt.group(1)), int(mt.group(2)), today)
            if date and date >= today.isoformat():
                out.append({"comp": "lvlw" if (tag and tag.group(1) == "LVLW") else "lvlm", "home": teams[0].strip(), "away": teams[1].strip(), "date": date,
                            "time": (mt.group(3) or "").replace(".", ":").rjust(5, "0") if mt.group(3) else ""})
        except Exception:
            continue
    out.sort(key=lambda m: (m["date"], m["time"] or "00:00", m["home"]))
    counts, res = {}, []
    for m in out:
        counts[m["comp"]] = counts.get(m["comp"], 0) + 1
        if counts[m["comp"]] <= 12:
            res.append(m)
    return {"matches": res}


def get_weather():
    """Weather for the place of the screen (Open-Meteo, no key), trimmed to what the screen shows."""
    now = time.time()
    if _weather["data"] and now - _weather["at"] < 900:
        return _weather["data"]
    url = ("https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&timezone=Europe%%2FAmsterdam&forecast_days=4"
           "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day"
           "&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max") % (WEATHER_PLACE["lat"], WEATHER_PLACE["lon"])
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ByTomorrow-narrowcasting"})
        with urllib.request.urlopen(req, timeout=15) as res:
            j = json.loads(res.read().decode("utf-8"))
        c, d, hr = j["current"], j["daily"], j["hourly"]
        cur_hour = c["time"][:13]
        start = next((i for i, t in enumerate(hr["time"]) if t[:13] >= cur_hour), 0) + 1
        hours = [{"time": hr["time"][i][11:16], "temp": round(hr["temperature_2m"][i]), "code": hr["weather_code"][i], "rain": hr["precipitation_probability"][i]}
                 for i in range(start, min(len(hr["time"]), start + 12), 2)]
        data = {"place": WEATHER_PLACE["name"], "fetchedAt": int(now),
                "now": {"temp": round(c["temperature_2m"]), "feels": round(c["apparent_temperature"]), "code": c["weather_code"],
                        "wind": round(c["wind_speed_10m"]), "day": bool(c.get("is_day", 1))},
                "hours": hours, "rain": d["precipitation_probability_max"][0],
                "days": [{"date": d["time"][i], "code": d["weather_code"][i], "max": round(d["temperature_2m_max"][i]),
                          "min": round(d["temperature_2m_min"][i]), "rain": d["precipitation_probability_max"][i]} for i in range(len(d["time"]))]}
        _weather["data"], _weather["at"] = data, now
    except Exception:
        if not _weather["data"]:
            raise
        _weather["at"] = now - 600       # keep showing the last weather and try again in 5 minutes
    return _weather["data"]


# Pretty links into the single-page app: /shl, /shl/schedule, /shlw/results, /handbalnl/next-men, /lvl/thumbnails-men,
# /socials/wedstrijd, /settings. They all serve index.html; the page reads the path and opens that view.
SPA_ROOTS = {"shl", "shlw", "handbalnl", "lvl", "socials", "settings"}
SPA_ASSET_DIRS = {"api", "assets", "fonts", "socials", "exports", "data"}


def spa_rewrite(raw_path):
    """Returns the path to serve for a request path: index.html for an app route, the plain file for a relative URL the
    page asked for from inside a route (/shl/script.js, /socials/socials/templates.js), the same path otherwise."""
    u = urlparse(raw_path)
    segs = [unquote(x) for x in u.path.split("/") if x]
    if segs and segs[0] == "narrowcasting" and len(segs) <= 2 and (len(segs) == 1 or segs[1] == "beheer"):
        return ("/narrowcasting.html" if len(segs) == 1 else "/narrowcasting-beheer.html") + (("?" + u.query) if u.query else "")
    if not segs or segs[0] not in SPA_ROOTS:
        return raw_path
    tail = ("?" + u.query) if u.query else ""
    if os.path.isfile(os.path.join(STATIC_DIR, *segs)):          # a real file, e.g. /socials/templates.js
        return raw_path
    rest = segs[1:]
    if rest and (rest[0] in SPA_ASSET_DIRS or "." in rest[-1]):  # relative URLs of the page, resolved against the route
        return "/" + "/".join(rest) + tail
    return "/index.html" + tail


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_HEAD(self):
        self.path = spa_rewrite(self.path)
        super().do_HEAD()

    def do_GET(self):
        self.path = spa_rewrite(self.path)
        if self.path.startswith("/api/results"):
            self.handle_results()
        elif self.path.startswith("/api/standings"):
            self.handle_standings()
        elif self.path.startswith("/api/movers"):
            self.handle_movers()
        elif self.path.startswith("/api/stream-state"):
            self.handle_stream_state()
        elif self.path.startswith("/api/stream-matches"):
            self.handle_stream_matches()
        elif self.path.startswith("/api/stream-config"):
            self._json(200, stream_config())
        elif self.path.startswith("/api/narrowcasting-matches"):
            try:
                self._nocache_json(200, narrow_matches())
            except Exception as err:
                self._json(502, {"error": str(err)})
        elif self.path.startswith("/api/narrowcasting-shl"):
            try:
                st = stream_state({})
                self._nocache_json(200, {"standings": st.get("standings", []), "results": st.get("results", []), "round": (st.get("matchday") or {}).get("round")})
            except Exception as err:
                self._json(502, {"error": str(err)})
        elif self.path.startswith("/api/narrowcasting"):
            d = narrow_data()
            d["wall"] = int(calendar.timegm(_ams_now_parts(time.time()).timetuple()) * 1000)   # the Dutch wall clock, for screens with a wrong clock
            self._nocache_json(200, d)
        elif self.path.startswith("/api/weather"):
            try:
                self._nocache_json(200, get_weather())
            except Exception as err:
                self._json(502, {"error": str(err)})
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
        elif self.path.startswith("/api/exports"):
            self.handle_exports_list()
        elif self.path.startswith("/api/preview"):
            self.handle_preview()
        elif self.path.startswith("/api/plan"):
            self._send_json(200, effective_plan())
        elif self.path.startswith("/api/usage"):
            self._send_json(200, usage_summary(int((parse_qs(urlparse(self.path).query).get("limit", ["40"])[0] or 40))))
        elif self.path.startswith("/api/thumbnail"):
            self.handle_thumbnail()
        elif self.path.startswith("/exports/"):
            self.handle_export_get()
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
        elif self.path.startswith("/api/thumbnail"):
            self.handle_thumbnail()
        elif self.path.startswith("/api/usage"):
            self.handle_usage_post()
        else:
            self.send_error(404)

    def do_PUT(self):
        if self.path.startswith("/api/export"):
            self.handle_export_put()
        elif self.path.startswith("/api/stream-config"):
            self.handle_stream_config_put()
        elif self.path.startswith("/api/narrowcasting"):
            self.handle_narrow_put()
        elif self.path.startswith("/api/settings"):
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



    # --- previews + usage ---
    def handle_preview(self):
        q = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
        asset, comp, fmt = q.get("asset", ""), q.get("comp", "men"), q.get("format", "")
        if asset not in PREVIEW_ASSETS or comp not in ("men", "women") or fmt not in ("", "story", "post"):
            return self._send_json(400, {"error": "asset, comp (men|women) of format (story|post) ongeldig"})
        try:
            data, age = get_preview(asset, comp, fmt, fresh=q.get("fresh") == "1")
        except ThumbError as err:
            return self._send_json(400, {"error": str(err)})
        except RendererBusy as err:
            return self._send_json(429, {"error": str(err)})
        except RendererUnavailable as err:
            return self._send_json(501, {"error": str(err)})
        except Exception as err:
            return self._send_json(500, {"error": str(err)})
        self.send_response(200)
        self.send_header("Content-Type", "image/webp")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Preview-Age", str(age))
        self.end_headers()
        self.wfile.write(data)

    def handle_usage_post(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode("utf-8")) if 0 < length < 5000 else {}
            clean = lambda v: re.sub(r"[^a-z0-9_-]", "", str(v or "").lower())[:30]
            asset, comp = clean(body.get("asset")), clean(body.get("comp"))
            if not asset or comp not in ("men", "women", "hnl", "th"):
                return self._send_json(400, {"error": "asset en comp nodig"})
            action = clean(body.get("action")) or "open"
            if action == "photo":
                # not a usage entry: the photo of this asset changed, so its cached preview is out of date
                fmt = clean(body.get("format"))
                photo_changed[f"{comp}:{asset}:{fmt}"] = int(time.time())
                preview_cache.pop((asset, comp, fmt), None)
                return self._send_json(200, {"ok": True})
            usage_add({"t": int(time.time()), "asset": asset, "comp": comp, "format": clean(body.get("format")), "action": action})
            self._send_json(200, {"ok": True})
        except ValueError:
            self._send_json(400, {"error": "ongeldige JSON"})

    # --- exports (stored images) ---
    def _public_base(self):
        proto = (self.headers.get("X-Forwarded-Proto") or "http").split(",")[0].strip()
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or f"localhost:{PORT}"
        return f"{proto}://{host}"

    def _store_export(self, name, data):
        os.makedirs(EXPORT_DIR, exist_ok=True)
        tmp = os.path.join(EXPORT_DIR, name + ".tmp")
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, os.path.join(EXPORT_DIR, name))
        return {"name": name, "path": "/exports/" + name, "url": self._public_base() + "/exports/" + name, "bytes": len(data)}

    def handle_export_put(self):
        name = _safe_export_name(parse_qs(urlparse(self.path).query).get("name", [""])[0])
        if not name:
            return self._send_json(400, {"error": "name ontbreekt of is ongeldig (png, jpg, webp, zip, mp4 of webm)"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > MAX_EXPORT_BYTES:
                return self._send_json(413, {"error": "bestand te groot of leeg"})
            self._send_json(200, self._store_export(name, self.rfile.read(length)))
        except Exception as err:
            self._send_json(400, {"error": str(err)})

    def handle_export_get(self):
        name = _safe_export_name(unquote(urlparse(self.path).path[len("/exports/"):]))
        path = os.path.join(EXPORT_DIR, name) if name else None
        if not path or not os.path.isfile(path):
            return self._send_json(404, {"error": "niet gevonden"})
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", EXPORT_TYPES.get(name.rsplit(".", 1)[-1].lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Disposition", f'inline; filename="{name}"')
        self.end_headers()
        self.wfile.write(data)

    def handle_exports_list(self):
        base = self._public_base()
        rows = []
        try:
            for name in os.listdir(EXPORT_DIR):
                p = os.path.join(EXPORT_DIR, name)
                if os.path.isfile(p) and EXPORT_NAME_RE.match(name):
                    st = os.stat(p)
                    rows.append({"name": name, "path": "/exports/" + name, "url": base + "/exports/" + name, "bytes": st.st_size, "modified": int(st.st_mtime)})
        except OSError:
            pass
        rows.sort(key=lambda r: r["modified"], reverse=True)
        self._send_json(200, {"exports": rows[:300]})

    # --- server-side thumbnail rendering ---
    def handle_thumbnail(self):
        params = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
        if self.command == "POST":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length).decode("utf-8")) if 0 < length < 100_000 else {}
                if isinstance(body, dict):
                    params.update({k: v for k, v in body.items() if isinstance(v, (str, int, float))})
            except ValueError:
                return self._send_json(400, {"error": "ongeldige JSON"})
        want_json = str(params.pop("json", "")).lower() in ("1", "true", "yes")
        params = {k: str(v) for k, v in params.items() if len(str(v)) <= 200}
        try:
            result = RENDERER.render(params)
        except ThumbError as err:
            return self._send_json(400, {"error": str(err)})
        except RendererBusy as err:
            return self._send_json(429, {"error": str(err)})
        except RendererUnavailable as err:
            return self._send_json(501, {"error": str(err)})
        except Exception as err:
            return self._send_json(500, {"error": str(err)})
        try:
            data = base64.b64decode(result["dataUrl"].split(",", 1)[1])
            name = _safe_export_name(result.get("fileName")) or ("thumbnail-%d.%s" % (int(time.time()), result.get("format", "webp")))
            saved = self._store_export(name, data)
        except Exception as err:
            return self._send_json(500, {"error": "opslaan mislukt: " + str(err)})
        if want_json:
            return self._send_json(200, {**saved, "format": result.get("format"), "data": result.get("data")})
        self.send_response(200)
        self.send_header("Content-Type", EXPORT_TYPES.get(name.rsplit(".", 1)[-1].lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Disposition", f'inline; filename="{name}"')
        self.send_header("X-Export-Url", saved["url"])
        self.end_headers()
        self.wfile.write(data)

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
        """A zip with every stored item and photo, the settings, the usage log and the stored export images."""
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
            if os.path.isfile(USAGE_FILE):           # what was used when
                z.write(USAGE_FILE, "usage.json")
            if os.path.isdir(EXPORT_DIR):            # stored export images (zips/videos are left out: they can be recreated)
                for name in sorted(os.listdir(EXPORT_DIR)):
                    if re.search(r"\.(png|jpe?g|webp)$", name, re.I) and EXPORT_NAME_RE.match(name):
                        z.write(os.path.join(EXPORT_DIR, name), f"exports/{name}")
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
                if info.filename == "usage.json" and info.file_size <= 5_000_000:
                    # merge with the log that is already there (no duplicates, newest 3000 kept)
                    try:
                        incoming = json.loads(z.read(info).decode("utf-8"))
                    except ValueError:
                        incoming = []
                    if isinstance(incoming, list):
                        with usage_lock:
                            merged = {}
                            for e in _usage_read() + [x for x in incoming if isinstance(x, dict)]:
                                merged[(e.get("t"), e.get("asset"), e.get("comp"), e.get("format"), e.get("action"))] = e
                            log = sorted(merged.values(), key=lambda e: e.get("t") or 0)[-3000:]
                            os.makedirs(DATA_DIR, exist_ok=True)
                            with open(USAGE_FILE, "w", encoding="utf-8") as f:
                                json.dump(log, f)
                        restored += 1
                    continue
                em = re.match(r"^exports/(.+)$", info.filename)
                if em:
                    ename = _safe_export_name(em.group(1))
                    if ename and info.file_size <= MAX_EXPORT_BYTES:
                        os.makedirs(EXPORT_DIR, exist_ok=True)
                        with z.open(info) as src, open(os.path.join(EXPORT_DIR, ename), "wb") as dst:
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

    def handle_stream_state(self):
        try:
            self._json(200, stream_state(parse_qs(urlparse(self.path).query)))
        except Exception as err:
            self._json(502, {"error": str(err)})

    def handle_stream_matches(self):
        try:
            self._json(200, {"matches": stream_matches(), "config": stream_config()})
        except Exception as err:
            self._json(502, {"error": str(err)})

    def _nocache_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_narrow_put(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 200000:
                return self._send_json(413, {"error": "te groot"})
            data = _clean_narrow(json.loads(self.rfile.read(length).decode("utf-8")))
            os.makedirs(DATA_DIR, exist_ok=True)
            tmp = NARROW_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f)
            os.replace(tmp, NARROW_FILE)
            self._send_json(200, data)
        except Exception as err:
            self._send_json(400, {"error": str(err)})

    def handle_stream_config_put(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 20000:
                return self._send_json(413, {"error": "te groot"})
            cfg = _clean_stream_config(json.loads(self.rfile.read(length).decode("utf-8")))
            os.makedirs(DATA_DIR, exist_ok=True)
            tmp = STREAM_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(cfg, f)
            os.replace(tmp, STREAM_FILE)
            self._send_json(200, cfg)
        except Exception as err:
            self._send_json(400, {"error": str(err)})

    def handle_movers(self):
        try:
            qs = parse_qs(urlparse(self.path).query)
            comp = "women" if qs.get("comp", [""])[0] == "women" else "men"
            self._json(200, compute_movers(comp, qs.get("since", ["0"])[0], force=bool(qs.get("refresh", [""])[0])))
        except Exception as err:
            self._json(502, {"error": str(err)})

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
