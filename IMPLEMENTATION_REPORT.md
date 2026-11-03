# Implementation Report: Home Screen prototype (image-enhanced package)

Run date: 2026-11-02 · Environment: headless Chromium 153 (Playwright) on Linux, emulated viewports. Nothing was tested on real devices or other browsers.
Automated result: **190 / 190 checks passed** (appendix; script `tests/acceptance.py`, raw output `tests/results.json`, screenshots `tests/screenshots/`).

## IMPORTANT: what could not be verified

**The six NASA/JPL photograph URLs were NOT fetched successfully from the build environment** (every request failed with no connection; this sandbox cannot reach assets.science.nasa.gov or the JPL CloudFront host). So:
- Whether each URL still returns a valid image is **unverified**. Please open the prototype and look at all six carousel cards.
- The image *rendering path* (src and alt from the JSON, credit, source link, testbed label, object-fit: contain, loading and failure states) was tested with a **labelled stub PNG** ("TEST STUB - NOT A NASA IMAGE") served in place of the NASA hosts. Screenshots named `*stubbed-photos*` show that stub, not NASA imagery.
- Failure behaviour was tested by blocking those hosts: all six cards fall back to a neutral placeholder, failures are recorded, and nothing else is substituted.

## Acceptance checklist

| Item | Status | Notes |
|---|---|---|
| Exact section order | **Implemented** | Tested. Recently Viewed is absent until something is viewed. |
| Exact hero title/subtitle + supplied background | **Implemented** | Snippet byte-identical (tested), run unchanged inside an iframe. Descriptive paragraph is **draft copy**. |
| Three destination cards, exact descriptions | **Implemented** | Exact text, order, targets, 3/2/1 columns, overlap tested. |
| Six exact categories + preselection | **Implemented** | Names/order, 3/2/1 layout and preselection (change, reset, empty state) tested. The six supplied transparent PNGs load (720×560, transparent corners verified), `object-fit: contain`, alt text from the manifest, cards contain only illustration + name. |
| Six curated Featured records from a data file | **Implemented** | `featured_selection.json` + `featured_equipment.json`; IDs validated (missing/duplicate/count/missing image URL flagged). |
| Coverflow, 6 s autoplay, 700 ms, dots, Prev/Next, Pause/Play, swipe | **Implemented** | Measured about 6.0 s between automatic changes; Play restarts a fresh interval; no pause on hover; 0.7 s transition; swipe tested with synthetic touch pointer events and Playwright tap (not a physical device). |
| View Full Details opens the matching full equipment page | **Partial** | Routes to the correct record (mouse, keyboard, touch). The full page is out of scope, so it is a **labelled placeholder route** (it does show the image, credit, image note and NASA sources). |
| No separate small-details section on Home | **Implemented** | |
| Recently Viewed | **Implemented** | Hidden when empty, 10 unique, newest first, move-to-top, persistence, unknown IDs ignored (tested). Uses the same NASA photo as the carousel. |
| Permanently expanded FAQs, no links | **Implemented** | Tested. Copy is **draft**. |
| Exact closing message | **Implemented** | |
| Four-column responsive footer, footer-only Back to Top | **Implemented** | 4/2/1 columns; button hidden at top, shown after scrolling, inside footer. Name is `[Final Website Name]`; no contact details invented. |
| Header, dropdowns, search, bell, mobile drawer | **Partial** | All tested, except: **Popular Searches is Blocked** (needs a privacy-conscious aggregation backend; UI says so, no fake numbers); glossary, timeline and discovery content does not exist so is not indexed; optional browser-notification opt-in not built; Updates are **mock**. |
| Keyboard, screen reader, reduced motion, responsive, contrast | **Partial** | Keyboard, reduced motion, overflow (320/390/820/1440 px) and computed contrast for key colour pairs tested. **Not done:** real screen-reader testing, axe/Lighthouse (could not be installed here), full WCAG 2.2 AA audit. |
| NASA attribution, no invented content | **Partial** | Code displays each record's supplied credit and source page; testbed photographs are labelled; nothing was added beyond supplied facts. **Live photo loading unverified** (see top). |

## Image handling details

- Credits shown exactly as supplied in `carousel_image.credit` (e.g. NASA/Harrison Schmitt, NASA/JPL for the two testbed images, NASA/JPL-Caltech/ASU/MSSS for Ingenuity).
- Spirit and Opportunity cards carry the visible line "Engineering testbed photograph, not taken on Mars" (detected from the supplied image note, tested to appear on those two only).
- The Apollo Lunar Module Descent Stage card uses the supplied Apollo 11 photograph of the whole Lunar Module, per its note; the descent stage is part of that image.
- Images are loaded with `referrerpolicy="no-referrer"`. Carousel images are not lazy-loaded so swiping never shows a blank card.
- Category artwork is disclosed as AI-generated on the Sources & Evidence page (not on the cards, which must contain only illustration and name).

## Deviations (all reversible)

1. **Transparent header uses white text, not navy.** Navy on the dark hero is 1.20:1 (fails AA); white is 19.1:1. The solid white header uses navy as specified.
2. **Duplicate section headings.** The spec gives "Browse Equipment by Their Type" the same heading as the destination section. Implemented as written; the second section has `aria-label="Browse Equipment by Their Type"`. Needs confirmation (likely a copy error).
3. **Destination heading placement** inside the dark hero above the overlapping cards (assumption, no reference image supplied).
4. **Category artwork mapping is inferred.** The six illustrations arrived as unnamed image attachments in display order. I mapped them to the manifest names in alphabetical filename order and confirmed visually that each picture matches its category (lander with mast, helicopter, rover, descent stage, etc.). **Please confirm** Orbiters vs Spacecraft in particular, since both are satellite-style images.
5. **Reduced motion:** hero canvas frozen from the parent after the first frame (file untouched); carousel transitions become instant but autoplay still runs (Pause is available).
6. **Side carousel cards** are not keyboard-focusable (use Previous/Next/dots); clicking a side card brings it forward. Mouse drag is not a swipe.
7. **Hash routing** (`#/…`) so it works on any static host with Back/Forward.
8. **Extra placeholder pages** exist only so navigation can be tested. Sources & Evidence lists the real sources and image notes from the supplied JSON.

## Draft or mock content needing approval

Hero paragraph, footer description, all FAQ answers (`data/faqs.json`), and the three mock updates (`data/updates.json`, labelled on screen).

## Known limitations

Chromium only; no real devices; on-screen keyboard not testable; Space Grotesk/Inter were blocked in tests (fallback fonts in screenshots), so final typography is unverified; search covers equipment, missions, destinations, categories, FAQs, updates and placeholder pages only.

## Decisions needed from you

1. Open the prototype and confirm all six NASA photos load (and look right in the cards).
2. Confirm the Orbiters/Spacecraft illustration mapping.
3. Duplicate heading (2) and hero heading placement (3); white transparent-header text (1).
4. Approve or edit the draft copy.

## Appendix: automated checks

| Result | Check |
|---|---|
| PASS | No JS errors on first load |
| PASS | Section order (recent hidden when empty) |
| PASS | Recently Viewed hidden when nothing viewed |
| PASS | No separate small-details section on Home |
| PASS | Hero H1 exact |
| PASS | Hero subtitle exact |
| PASS | Hero has descriptive paragraph |
| PASS | Hero background file byte-identical to supplied snippet |
| PASS | Hero canvas renders stars + nebulae + shooting stars |
| PASS | Hero background covers upper part, not whole page |
| PASS | Brand text exact |
| PASS | Desktop nav order |
| PASS | Search then bell at right |
| PASS | Brand left, nav centred, actions right |
| PASS | Header transparent w/ dark gradient at top |
| PASS | Header hides on scroll down |
| PASS | Header reappears on scroll up, solid white |
| PASS | Destination dropdown items/order |
| PASS | Dropdown aria-expanded true |
| PASS | Escape closes dropdown |
| PASS | Library dropdown opens on hover; items/order |
| PASS | About dropdown items/order |
| PASS | Dropdown link navigates in-app (hash route, no reload) |
| PASS | Browser Back returns Home |
| PASS | Destination cards: order, exact descriptions, targets |
| PASS | Explore section heading exact |
| PASS | Destination cards: 3 columns on desktop |
| PASS | Destination cards overlap dark→white transition |
| PASS | Mars card → Explore Mars |
| PASS | Six categories exact order |
| PASS | Category cards contain only illustration + name |
| PASS | Category grid: 3 columns on desktop |
| PASS | Category click preselects in directory |
| PASS | Directory shows matching record only |
| PASS | Visitor can change category |
| PASS | Visitor can reset category |
| PASS | Empty category shows empty state |
| PASS | Featured heading exact |
| PASS | Six featured cards from data file |
| PASS | Card order matches featured_selection.json |
| PASS | Exactly three cards visible (centre + 2 sides) |
| PASS | Transition duration 700 ms |
| PASS | Card content: image, name, description, View Full Details, no mission badge |
| PASS | Description clamped to 3 lines |
| PASS | Dots above controls; controls below carousel |
| PASS | Controls order: Previous, Pause, Next |
| PASS | Autoplay advances automatically every ~6 s (interval between two automatic changes) |
| PASS | Autoplay does NOT pause on hover |
| PASS | Pause toggle label becomes Play |
| PASS | Pause freezes current position |
| PASS | Play resumes from same position with fresh ~6 s interval |
| PASS | Next advances one |
| PASS | Previous goes back (wraps) |
| PASS | Dot jumps to slide |
| PASS | Only centre card exposed to AT; others aria-hidden |
| PASS | Six Next presses loop back (6 unique slides) |
| PASS | Clicking a side card brings it to centre |
| PASS | View Full Details → matching record route |
| PASS | Detail page is a labelled placeholder |
| PASS | Recently Viewed appears after a view |
| PASS | Recently Viewed shows viewed item |
| PASS | Recently Viewed sits between Featured and FAQs |
| PASS | Recently Viewed card is a single link, no button, no badge |
| PASS | Recently Viewed background #F8FAFC |
| PASS | Revisited item moves to top; no duplicates |
| PASS | Storage keeps max 10 unique, newest first |
| PASS | Unknown stored ids ignored; section hidden |
| PASS | Recently Viewed persists across reload |
| PASS | FAQ heading exact |
| PASS | FAQs: text-only, always expanded, no links/accordion/numbering |
| PASS | Closing message exact text |
| PASS | Closing message after FAQ, before footer, no button |
| PASS | Footer 4 columns on desktop |
| PASS | Footer column headings |
| PASS | Footer links exact |
| PASS | Footer has NASA Space Apps Challenge 2026 + no invented contact details |
| PASS | Copyright uses placeholder name, not working title |
| PASS | Back to Top hidden at page top |
| PASS | Back to Top inside footer (not floating) |
| PASS | Back to Top visible after scrolling |
| PASS | Back to Top scrolls to top |
| PASS | No external footer links to mishandle |
| PASS | Search opens as modal dialog |
| PASS | Search input focused on open |
| PASS | Recent + Popular sections before typing |
| PASS | Popular searches not faked |
| PASS | No results/live search before 2 characters |
| PASS | Debounce: no results before 300 ms |
| PASS | Results appear after debounce; suggestions hidden |
| PASS | Match highlighted (mark, navy) |
| PASS | Each result: name + type + one-line description |
| PASS | Initial list ~5 visible, scrolls for more |
| PASS | No-results text |
| PASS | Clear × empties input and restores suggestions |
| PASS | Result click navigates and closes overlay |
| PASS | Recent searches stored (latest first) |
| PASS | Repeat search deduplicated (case-insensitive) and moved to top |
| PASS | Recent searches cap 10 |
| PASS | Clear control removes recent searches |
| PASS | Escape closes search; focus restored to opener |
| PASS | Outside click closes search |
| PASS | Close button closes search |
| PASS | '/' shortcut opens search |
| PASS | '/' not intercepted while typing in the field |
| PASS | Ctrl+K opens search |
| PASS | Focus stays trapped inside dialog |
| PASS | Search failure: 'Something went wrong' + Retry, query preserved |
| PASS | Retry recovers |
| PASS | Offline Mode label shown offline |
| PASS | Local search still works offline |
| PASS | Red dot shown for first-time visitor (unread non-minor updates exist) |
| PASS | Dot has no count; colour #EF4444 |
| PASS | Bell goes straight to Updates (no popup) |
| PASS | Updates newest first |
| PASS | NEW on unread; ANNOUNCEMENT on important |
| PASS | Opening Updates alone does not clear the dot (needs viewing) |
| PASS | Dot disappears once all non-minor updates have been viewed |
| PASS | Read state persists in localStorage |
| PASS | Clearing storage resets dot |
| PASS | Tablet: no horizontal overflow |
| PASS | Tablet: destination cards 2 columns |
| PASS | Tablet: categories 2 columns |
| PASS | Tablet: footer 2 columns |
| PASS | Tablet: uses compact header (burger visible) |
| PASS | Mobile: no horizontal overflow (top) |
| PASS | Mobile: header shows brand, search, burger; bell hidden |
| PASS | Mobile: 1-col destination cards |
| PASS | Mobile: footer 1 column |
| PASS | Drawer opens (dialog, from right) |
| PASS | Background scroll locked while drawer open |
| PASS | Nested items expand inside drawer |
| PASS | Library + About expand |
| PASS | eLearning, Search and Notifications reachable in drawer |
| PASS | Drawer shows unread dot on Notifications |
| PASS | Escape closes drawer; scroll restored |
| PASS | Outside tap closes drawer |
| PASS | Drawer closes after navigation |
| PASS | Search reachable from drawer |
| PASS | Swipe left → next slide |
| PASS | Swipe right → previous slide |
| PASS | Tiny drag ignored |
| PASS | Mobile carousel: card fits viewport, no overflow |
| PASS | Touch tap on View Full Details routes to record |
| PASS | Mobile: no horizontal overflow (full page) |
| PASS | Mobile: copyright left, back-to-top right on same row |
| PASS | 320px wide: no horizontal overflow |
| PASS | 320px wide: categories single column |
| PASS | Skip link is first tab stop |
| PASS | Tab order reaches header → cards in DOM order |
| PASS | Visible focus ring on focused element |
| PASS | Keyboard: Enter opens dropdown |
| PASS | Keyboard: Enter on category card navigates |
| PASS | Keyboard: Space toggles pause |
| PASS | Keyboard: Enter on Next advances |
| PASS | Keyboard: Enter on View Full Details routes |
| PASS | Focus moves to page heading after route change |
| PASS | Reduced motion: carousel transition ~0 |
| PASS | Reduced motion: reveals shown immediately |
| PASS | Reduced motion: hero canvas frozen (static starfield still visible) |
| PASS | Reduced motion: carousel still operable |
| PASS | Data load failure → error state with Retry (no blank page) |
| PASS | Carousel <img> src/alt come from each record's carousel_image |
| PASS | Photos rendered (stubbed host), no placeholders, object-fit: contain |
| PASS | Each card shows the record's image credit from JSON |
| PASS | Each card links to the record's image source page |
| PASS | Testbed label shown on Spirit and Opportunity ONLY |
| PASS | Images are NOT taken from category artwork (no local PNG in carousel) |
| PASS | No lazy blank: carousel images requested immediately (6 NASA URLs) |
| PASS | Category artwork never requests NASA hosts |
| PASS | Detail route shows the testbed image note |
| PASS | Sources & Evidence lists every image note + AI-illustration disclosure |
| PASS | Six category cards use the six local PNGs from the manifest (name, path, alt) |
| PASS | Category PNGs load, object-fit: contain |
| PASS | No placeholder text left in category cards |
| PASS | Category PNGs are transparent (corner alpha 0) |
| PASS | Category art not used in featured carousel |
| PASS | All photo URLs failing -> 6 neutral placeholders, 0 images, credits kept |
| PASS | Failures recorded for reporting |
| PASS | Placeholder never shows other imagery; categories still render |
| PASS | One broken photo -> only that card shows a placeholder |
| PASS | Featured IDs validated against equipment records (missing/duplicate/count flagged) |
| PASS | Contrast AA: Navy on white (headings/brand, solid header) |
| PASS | Contrast AA: Description #4B5563 on white |
| PASS | Contrast AA: Description #4B5563 on #F8FAFC |
| PASS | Contrast AA: White on navy button |
| PASS | Contrast AA: Footer grey #CBD5E1 on navy |
| PASS | Contrast AA: White header text on Space Dark (transparent header) |
| PASS | Contrast AA: Hero subtitle #BFD3FF on #0B0F1A |
| PASS | Contrast AA: Hero desc #D6DEEF on #0B0F1A |
| PASS | INFO spec navy brand on dark hero would FAIL AA (reason white is used in transparent state) |
