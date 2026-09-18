# WeerdhofGraphics

## SHL Story Generator

Static tool for generating Coinmerce Super Handball League Instagram Story
graphics (Results and Schedule) from `story-generator/assets/schedule_dataset_all_rounds.csv`.

Run locally:

```
python3 -m http.server 8000 --directory story-generator
```

Then open http://localhost:8000.

Deployed on Railway as a plain static file server (see `Procfile` / `railway.json`).
