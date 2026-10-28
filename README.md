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
| `GET /api/stream-state` | Everything the stream dashboard (`/stream.html`) shows, plus the server's clock: match, results of the latest matchday, standings, form, day schedule and the planning. Optional `home=`, `away=` (club codes) pick a fixed match. Men only. |
| `GET /api/stream-matches` | Upcoming men's matches (with start time) and the stream planning, for `/stream-setup.html`. |
| `GET/PUT /api/stream-config` | The stream planning: which match (auto/manual), which scene from how many minutes before the start, page rotation, theme. |
| `GET /api/exports` | List of stored exports (newest first) with their URLs. |
| `PUT /api/export?name=<name>.png` | Store an image (the editor's Export buttons do this automatically). |

`/api/thumbnail` parameters: `kind` = `shl` \| `shlw` \| `nextmen` \| `nextwomen`; `home`, `away` = club codes (shl: `HUB`, `PEL`, ...; shlw: `VEN`, `V&L`, ...; next: ids such as `artemis`) or names; `date` = `YYYY-MM-DD` or `DD-MM`
(optional when the pairing is in the server's schedule: date and start time then come from the schedule, so midweek matches are right); `time` = `HH:MM` (overrides the schedule);
`format` = `webp` (default) \| `jpg` \| `png`. Optional: `title`, `label`, `variant=highlights` (shl), `homeLabel`, `awayLabel` (shlw), `homeName`, `awayName` (next).
Errors come back as `{"error": "..."}` (400 unknown club/date, 429 busy, 501 no browser available).

Locally the renderer needs Playwright; use the installed Chrome with `THUMB_BROWSER_CHANNEL=chrome python3 server.py`.


## Stream dashboard

`/stream.html` is a 1920x1080 page for an OBS Browser source. It follows the start of a match (men only; chosen automatically or on `/stream-setup.html`) and switches scene by the minutes left: other results, standings, a big title, then clean (nothing). Test any moment with `?sim=20` (pretend 20 min before kick-off; add `&speed=60` to run through the timeline quickly, `&debug=1` to show the clock and scene). A fixed match: `?home=HUB&away=PEL`.

Option "cycle" (stream-config): the title stays on screen from `start` to `end` minutes before the start and every `every` minutes cycles through `scenes` (`seconds` per slide); after `end` the normal steps apply.

## Lotto Volley League thumbnails

Home tab "Volley": `LVL Heren` and `LVL Dames` (1920x1080, Monologue font). The assets come from `Lotto Volley/thumbnail2026` (background, crests, the dark wave from the PSD) in `story-generator/assets/lvl/`. The programme is a CSV (`Naam,bg,LogoLinks,LogoRechts,TijdText`) that can be read in again in the editor; it is stored on the server. Via the API: `/api/thumbnail?kind=lvlm&home=MEN&away=ROE&dt=16/10 - 20:30` (or `date=` and `time=`); club codes are the file names of the crests (MEN, ROE, CGENT, ANT, ...).

## ByTomorrow Graphics

The tool is branded as ByTomorrow Graphics. `bytomorrow.css` (loaded after `style.css`) holds the ByTomorrow frame: navy `#060228`, blue `#3D5AFE`, Niveau Grotesk Bold for titles and Open Sans for text (`fonts/bt/`). The home page lists the clients; each client has its own landing page (SHL, SHLW, HandbalNL, Lotto Volley League) in the client's own colours and display font. Those client looks live only in the `theme-men|women|hnl|lvl` variables (`--accent`, `--bg`, `--panel`, `--c-font`) at the top of `bytomorrow.css`; the thumbnails of each client sit on its landing page. The editors use the ByTomorrow chrome with the client colour as a small mark.

### ByTomorrow Socials

The "Socials" tab holds the social templates from the ByTomorrow design handoff. `socials/build_socials.py` converts the handoff's `*.dc.html` files (HTML with `{{ holes }}`, the pillar/sport logic block, `<image-slot>` and the Logo/Monogram imports) into `socials/templates.js`; `socials.js` renders them at native size, with fields, pillar and sport pickers, a draggable/zoomable photo and a PNG export (SVG foreignObject with the fonts embedded; also stored on the server via `/api/export`). To add a template, add its folder to `ENABLED` in the script and run `python3 socials/build_socials.py [path to design_handoff_bytomorrow]`. Fonts: Niveau Grotesk and Open Sans (`socials/fonts`, `fonts/bt`), a Material Symbols Rounded subset for the sport icons.

### Announcement and postponed (SHL)

- **Announcement** (men only): a label, a headline and an optional text on the SHL background (Story or Post), with an optional photo behind it under a navy veil. Code: `buildAnnouncementRow` and `renderAnnouncement` in `script.js`.
- **Postponed:** on Match and Head to head a checkbox shows POSTPONED (UITGESTELD for the women) instead of the date. Clear the time field if the time should go as well. The option is stored with the item (`smState.postponed`).


## Links (deep links)

Every page has its own address; the server (`spa_rewrite` in `server.py`) serves `index.html` for them and the page opens that view.
The address follows you through the app, and the browser's back and forward buttons work.

| Address | Opens |
| --- | --- |
| `/` | Home (dashboard) |
| `/shl`, `/shlw`, `/handbalnl`, `/lvl`, `/socials` | landing page of that client |
| `/shl/<graphic>`, `/shlw/<graphic>` | the editor: `results`, `schedule`, `match`, `prediction`, `headtohead`, `nowlive` (SHL only), `matchresult`, `topscorer`, `playerweek`, `ranking`, `movers`, `announcement` (SHL only) |
| `/shl/thumbnails`, `/shlw/thumbnails` | thumbnails editor |
| `/handbalnl/announcement`, `/handbalnl/next-men`, `/handbalnl/next-women` | HandbalNL editors |
| `/handbalnl/thumbnails-men`, `/handbalnl/thumbnails-women` | Next Handball League thumbnails |
| `/lvl/thumbnails-men`, `/lvl/thumbnails-women` | Lotto Volley League thumbnails |
| `/socials/<template>` | ByTomorrow Socials: `wedstrijd`, `artikel`, `story`, `video-thumbnail` |
| `/settings` | settings |

Aliases that also work: `matchschedule` and `programma` (schedule), `uitslagen` and `matchresults` (results), `h2h` (head to head), `stand` (ranking), `topscore` (top scorer) and a few more (`ASSET_ALIAS` in `script.js`).
An unknown page under a client opens that client's landing page. `stream.html`, `stream-setup.html` and `ticker.html` keep their own addresses.

## Narrowcasting (scherm voor op kantoor, LG webOS)

| Adres | Wat |
| --- | --- |
| `/narrowcasting` | Het scherm: slides die om de beurt in beeld komen met een rustige cross-fade (30 seconden elk, "Alle sporters zijn helden" 70 seconden). |
| `/narrowcasting/beheer` | Hier beheer je de streamagenda, kies je de programma-slides en zet je de meeting-modus aan of uit. |
| `/narrowcasting?slide=agenda,weather` | Toont alleen die slides (om ze te bekijken): `agenda`, `featured`, `streams`, `stand` (met `&comp=men` of `women`), `matches`, `quote`, `news1`, `news2`, `platforms`, `instagram`, `countdown`, `slogan`, `weather`, `logo`. |

Slides: **Streamagenda** (alle streams: wat je invult plus automatisch alle wedstrijden van de komende 7 dagen uit het SHL-, SHLW- en LVL-programma en uit de livestream-agenda van handbalnl.tv (paarse tag HandbalNL TV, wat al in het SHL/SHLW-programma staat wordt overgeslagen), met "LIVE" bij een
lopende stream), **Uitgelicht** (aangevinkte afspraken als grote kaarten), per SHL en SHLW de **komende 7 streams** en daarna **stand en uitslagen** (in de stijl van de SHL-stream),
**Alle sporters zijn helden** (met het logo), **LVL-wedstrijden**, **Quote** (een sportquote per dag), **Weer in Veenendaal** en een slide met alleen het ByTomorrow-logo.
Alles staat op het donkerblauw van ByTomorrow.

**Meeting-modus** (knop op de beheerpagina): het scherm toont alleen "Alle sporters zijn helden" of "Welkom [klant]" met het logo, binnen 15 seconden. Zet je hem uit, dan draaien de normale slides weer.

**Pijlers:** op de slide "Alle sporters zijn helden" en in de meeting-modus staan onderin vier bolletjes met het icoon van Marketing, Content, Productie en JUMP. Eerst rekken ze een voor een uit tot een pil met de volledige naam en gaan weer terug, daarna alle vier tegelijk; die routine draait een keer per 3 minuten (de iconen staan in `assets/pillars/`).
**Inbranden voorkomen (OLED):** na elke 45 minuten draait het scherm 10 seconden omgekeerd (blauw wordt wit en andersom); met `?burn=8` probeer je het na 8 seconden.

**Beheerpagina:** bovenaan voorbeelden van alle slides met een vinkje voor welke wel en niet draaien, een tabel met alle wedstrijden (uit de programma's, HandbalNL TV en handmatig, met filters per bron) en daaronder het beheer van eigen wedstrijden.

Sportnieuws komt van de NOS-feed (`feeds.nos.nl/nossportalgemeen`, via `/api/narrowcasting-news`, 10 minuten bewaard; de foto's lopen via `/api/narrowcasting-img`). Slide `news1` toont het laatste bericht groot (40 seconden), `news2` de drie daarna klein.

Slide `platforms` ("Powered by JUMP") toont de homepage van alle platformen in één horizontaal scrollende strook (60 seconden). De server maakt die screenshots zelf met Playwright, elke ochtend rond 08:00 (Nederlandse tijd) opnieuw, en direct met `POST /api/narrowcasting-platforms/refresh` (`DATA_DIR/platforms/`, lijst `PLATFORMS` in `server.py`), met het grootste icoon van de site als logo en cookiemeldingen weggeklikt of verborgen. Hoofdklasse Coach zit achter een login: daarvan staan screenshot en logo met de hand in `story-generator/assets/platforms/` (`hoofdklasse.jpg`, `hoofdklasse-logo.png`) en worden niet automatisch ververst.

Slide `instagram` toont de laatste post of reel van @superhandball_league en SHL Women, naast elkaar; een reel speelt (zonder geluid, in een lus). De posts komen uit een Behold-JSON-feed per account (feed-URL's in het beheer, `DATA_DIR/narrowcasting.json`); de server controleert elke 2 uur en bewaart foto/video in `DATA_DIR/instagram/` zodat het scherm alleen onze eigen server nodig heeft.

Slide `countdown` ("Volgende live") toont vier kaarten met de volgende wedstrijd van SHL, SHLW, Hoofdklasse Hockey (agenda-items met `hhd`/`hhh`) en de Lotto Volley League, elk met een eigen aftel-timer. De kleur van de competitie is alleen accent op een donkere kaart. Gaat een andere klant (bijv. HandbalNL TV) eerder live dan de laatste van die vier, dan neemt die (één kaart per klant, met het logo van het platform) een plek in op volgorde van starttijd. Er staan nooit meer dan vier kaarten: de vier die het eerst live gaan. De slide draait alleen mee als de eerstvolgende wedstrijd binnen een dag begint.

De beheerpagina (`/narrowcasting/beheer`) is opgeruimd tot de gastfuncties: de gastmodus aan/uit (Welkom [klant] of alleen "Alle sporters zijn helden"), meetings plannen (klant, datum, van-tot; het scherm schakelt zelf aan en uit, handmatig aan gaat voor) en de achtergrondfoto. Slides, wedstrijdagenda en Instagram staan onder "Overige instellingen". Geplande meetings staan in `narrowcasting.json` (`meetings`); `/api/narrowcasting` geeft naast `meeting` (wat je instelt) ook `effective` (wat het scherm nu toont).

De agenda staat in `DATA_DIR/narrowcasting.json` (op Railway op het volume), het weer komt van Open-Meteo via de server (`/api/weather`, 15 minuten bewaard). De klok volgt de Nederlandse
tijd van de server, ook als het scherm een verkeerde tijd heeft. De pagina is bewust ES5 en zonder moderne CSS, zodat hij ook op oudere webOS-browsers draait.
