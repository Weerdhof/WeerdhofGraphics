# WeerdhofGraphics

## SHL Visuals Dashboard

Static tool for generating Coinmerce Super Handball League Instagram Story
graphics (Results and Schedule) from `story-generator/assets/schedule_dataset_all_rounds.csv`.

Run locally:

```
python3 -m http.server 8000 --directory story-generator
```

Then open http://localhost:8000.

Deployed on Railway as a plain static file server (see `Procfile` / `railway.json`).


## API for other tools (images without the browser)

Everything the editor exports is also stored on the server and can be fetched with a plain download.

| | |
|---|---|
| `GET /api/thumbnail?kind=shl&home=HUB&away=PEL&date=2026-10-14&format=webp` | Renders a livestream thumbnail **on the server** (headless Chromium via Playwright) and returns the image. Add `&json=1` to get `{"url": ".../exports/SHL_20261014_HUB-PEL.webp", ...}` instead. `POST /api/thumbnail` with the same fields as JSON works too. |
| `GET /exports/<name>` | Download a stored export, e.g. `/exports/SHL_20261014_HUB-PEL.webp`. |
| `GET /api/movers?comp=men&since=0` | Standings movers: the table before the chosen matchday and each club's position change (`since` = matchdays back, `refresh=1` re-fetches the sites first). |
| `GET /api/plan` | The "Uitgelicht" planning per weekday: learned from the usage log (auto) or the fixed planning (manual). |
| `GET /api/stream-state` | Everything the stream dashboard (`/stream.html`) shows, plus the server's clock: match, results of the latest matchday, standings, form, day schedule and the planning. Optional `comp=`, `home=`, `away=` (club codes) pick a fixed match. |
| `GET /api/stream-matches` | Upcoming matches of both competitions (with kick-off time) and the stream planning, for `/stream-setup.html`. |
| `GET/PUT /api/stream-config` | The stream planning: which match (auto/manual), which scene from how many minutes before kick-off, page rotation, theme. |
| `GET /api/exports` | List of stored exports (newest first) with their URLs. |
| `PUT /api/export?name=<name>.png` | Store an image (the editor's Export buttons do this automatically). |

`/api/thumbnail` parameters: `kind` = `shl` \| `shlw` \| `nextmen` \| `nextwomen`; `home`, `away` = club codes (shl: `HUB`, `PEL`, ...; shlw: `VEN`, `V&L`, ...; next: ids such as `artemis`) or names; `date` = `YYYY-MM-DD` or `DD-MM`
(optional when the pairing is in the server's schedule: date and kick-off time then come from the schedule, so midweek matches are right); `time` = `HH:MM` (overrides the schedule);
`format` = `webp` (default) \| `jpg` \| `png`. Optional: `title`, `label`, `variant=highlights` (shl), `homeLabel`, `awayLabel` (shlw), `homeName`, `awayName` (next).
Errors come back as `{"error": "..."}` (400 unknown club/date, 429 busy, 501 no browser available).

Locally the renderer needs Playwright; use the installed Chrome with `THUMB_BROWSER_CHANNEL=chrome python3 server.py`.


## Stream dashboard

`/stream.html` is a 1920x1080 page for an OBS Browser source. It follows the kick-off of a match (chosen automatically or on `/stream-setup.html`) and switches scene by the minutes left: other results, standings, a big title, then clean (nothing). Test any moment with `?sim=20` (pretend 20 min before kick-off; add `&speed=60` to run through the timeline quickly, `&debug=1` to show the clock and scene). A fixed match: `?comp=men&home=HUB&away=PEL`.
