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
data/featured_equipment.json   the six supplied records v1.1, incl. direct NASA/JPL image URL, credit, source page, note (unchanged)
data/featured_selection.json   WHICH records are featured, and in what order
data/equipment_category_illustrations.json   category artwork manifest (supplied)
assets/category-illustrations/ six transparent PNGs (supplied, AI-generated, conceptual)
IMAGE_ASSET_NOTES.md           image provenance notes (supplied)
data/updates.json              MOCK updates for testing the bell
data/faqs.json                 DRAFT FAQ copy
tests/acceptance.py            automated Playwright run; tests/results.json; tests/screenshots/
```

## Change the featured carousel (no code edits)

Edit `data/featured_selection.json` (`featured_ids`). Every ID is validated against `featured_equipment.json`; missing, duplicate or wrong-count IDs are reported in the console and skipped.

## Images

- **Featured carousel / Recently Viewed:** each card loads the direct NASA/JPL URL in that record's `carousel_image`, and shows its credit and source-page link. Spirit and Opportunity are NASA/JPL **engineering-testbed** photographs; their cards say "Engineering testbed photograph, not taken on Mars", and the full image note appears on the detail route and Sources & Evidence. If a URL fails, the card shows a neutral "NASA photograph unavailable" placeholder (never other imagery) and the failure is logged to `window.__imageIssues` and the console.
- **Category cards:** the six supplied transparent PNGs, mapped by the manifest. They are AI-generated conceptual artwork, not NASA photographs, and are never used in the carousel.
- **Please open the prototype in your own browser and confirm all six NASA photos load.** The build environment could not reach NASA hosts, so those URLs were not fetched during testing (see `IMPLEMENTATION_REPORT.md`).

## Run the automated tests

Needs `pip install playwright` and `playwright install chromium`, with the server above running:

```bash
python3 tests/acceptance.py
```

See `IMPLEMENTATION_REPORT.md` for what is and is not covered.


## Expanded prototype update (v1)

Added working hash routes: `#/library/compare`, `#/library/glossary`, `#/library/quiz`, `#/about/sources`, and `#/about/website`. The existing Home Screen and its original six featured records remain intact. The equipment dataset now contains 10 NASA mission records (four text-only additions).

### Prototype data and limitations
- `data/glossary.json`: 20 starter glossary entries. Definitions are educational draft content; source attribution must be completed claim-by-claim before production.
- `data/sources_library.json`: source index derived from the equipment records' primary source links. These links are not a completed claim-level evidence audit.
- `data/quiz_sample.json`: five sample questions for UI demonstration only. The approved production target of 15 questions per equipment, derived solely from each equipment Full Details screen, is not met.
- Compare displays available fields and explicitly labels missing values.
- About Website includes project purpose, methodology, scope, limitations and acknowledgements placeholders.
- No production backend, authentication, CMS publishing, admin permissions, or Supabase connection is added by this update.

Run locally with `python3 -m http.server 8765` from this folder and open `http://localhost:8765/`.
