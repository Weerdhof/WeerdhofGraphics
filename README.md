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
| `GET /api/exports` | List of stored exports (newest first) with their URLs. |
| `PUT /api/export?name=<name>.png` | Store an image (the editor's Export buttons do this automatically). |

`/api/thumbnail` parameters: `kind` = `shl` \| `shlw` \| `nextmen` \| `nextwomen`; `home`, `away` = club codes (shl: `HUB`, `PEL`, ...; shlw: `VEN`, `V&L`, ...; next: ids such as `artemis`) or names; `date` = `YYYY-MM-DD` or `DD-MM`
(optional when the pairing is in the server's schedule: date and kick-off time then come from the schedule, so midweek matches are right); `time` = `HH:MM` (overrides the schedule);
`format` = `webp` (default) \| `jpg` \| `png`. Optional: `title`, `label`, `variant=highlights` (shl), `homeLabel`, `awayLabel` (shlw), `homeName`, `awayName` (next).
Errors come back as `{"error": "..."}` (400 unknown club/date, 429 busy, 501 no browser available).

Locally the renderer needs Playwright; use the installed Chrome with `THUMB_BROWSER_CHANNEL=chrome python3 server.py`.
