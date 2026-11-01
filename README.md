# Home Screen prototype: Abandoned but Not Forgotten

A separate, new prototype of the Home Screen and its shared header/footer, built from `HOME_SCREEN_SPECIFICATION.md`.
It does **not** modify the existing ZIP. No build step, no backend, no dependencies: plain HTML, CSS and ES modules.

## Run it

ES modules and `fetch()` need HTTP (opening `index.html` by double-click will not work):

```bash
cd abnf-home-prototype
python3 -m http.server 8765
# open http://localhost:8765/
```

Any static host works (the router is hash-based: `#/`, `#/equipment/mars_spirit`, …), so Back/Forward work without server rewrites.
Fonts (Space Grotesk, Inter) load from Google Fonts; offline, system fonts are used.

## Structure

```
index.html                     entry point
css/styles.css                 all styles, approved colour tokens at the top
js/main.js                     boot, hash router, footer
js/header.js                   header, dropdowns, mobile drawer, scroll behaviour, bell dot
js/search.js                   universal search overlay + local index
js/home.js                     Home sections (hero → footer order)
js/carousel.js                 3-card coverflow (reads records, knows nothing about specific equipment)
js/pages.js                    placeholder routes, equipment directory/detail, Updates, Sources & Evidence
js/storage.js                  localStorage (recently viewed, recent searches, read updates)
js/data.js, js/media.js        data loading + validation, image/placeholder handling
js/content.js                  exact spec copy and navigation
assets/universe/animated-universe.html   the supplied hero snippet, byte-for-byte unchanged
data/featured_equipment.json   the six supplied NASA records (unchanged)
data/featured_selection.json   WHICH records are featured, and in what order
data/images.json               verified NASA image URLs (all empty for now, see below)
data/updates.json              MOCK updates for testing the bell
data/faqs.json                 DRAFT FAQ copy
tests/acceptance.py            automated Playwright run; tests/results.json; tests/screenshots/
```

## Change the featured carousel (no code edits)

Edit `data/featured_selection.json` (`featured_ids`). Every ID is validated against `featured_equipment.json`; missing, duplicate or wrong-count IDs are reported in the console and skipped.

## Add real NASA photographs

The supplied JSON only has NASA **source pages**, not image file URLs, and nasa.gov was unreachable from the build environment, so no photo has been verified. Until then every card shows a labelled placeholder. To enable one: open the record's `image_source_page`, pick the photo, confirm credit and usage terms, then in `data/images.json` set `src`, `alt`, `credit` and `"verified": true`. Unverified entries are never displayed. If a verified image fails to load, the card falls back to the placeholder (never to other imagery).

## Run the automated tests

Needs `pip install playwright` and `playwright install chromium`, with the server above running:

```bash
python3 tests/acceptance.py
```

See `IMPLEMENTATION_REPORT.md` for what is and is not covered.
