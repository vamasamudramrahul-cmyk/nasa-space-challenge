# Implementation Report: Home Screen prototype

Run date: 2026-11-02 · Environment: headless Chromium 153 (Playwright) on Linux, emulated viewports. Nothing was tested on real devices or other browsers.
Automated result: **175 / 175 checks passed** (full list in the appendix; script `tests/acceptance.py`, raw output `tests/results.json`, screenshots `tests/screenshots/`).
Two real bugs were found by the tests and fixed during the build: (1) hover-opened desktop dropdowns were closed again by the click; (2) the "Mission" search entry named only one rover for a two-rover mission.

## Acceptance checklist

| Item | Status | Notes |
|---|---|---|
| Exact section order | **Implemented** | Tested. Recently Viewed is absent until something is viewed. |
| Exact hero title/subtitle + supplied background | **Implemented** | Snippet is byte-identical (tested) and runs unchanged inside an iframe sized to the hero, so its full-viewport CSS/JS cannot affect the page. Canvas, 3 nebulae and 2 shooting stars confirmed rendering. Descriptive paragraph is **draft copy**. |
| Three destination cards, exact descriptions | **Implemented** | Exact text, order and targets tested; 3 / 2 / 1 columns tested; cards overlap the dark→white edge. |
| Six exact categories + category preselection | **Partial** | Names, order, 3/2/1-col layout and preselection (change, reset, empty state) tested. The photorealistic 3D illustrations **do not exist yet**: each card has a labelled placeholder. |
| Six curated Featured records from a data file | **Implemented** | Selection in `featured_selection.json`; IDs validated (missing/duplicate/count tested). |
| Coverflow, 6 s autoplay, 700 ms, dots, Prev/Next, Pause/Play, swipe | **Implemented** | Measured 5.99 s between automatic changes; Play resumed with a fresh 6.08 s; no pause on hover; transition 0.7 s; swipe tested with synthetic touch pointer events + Playwright tap (not a physical device). |
| View Full Details opens the matching full equipment page | **Partial** | Routes to the correct record (tested, mouse, keyboard, touch tap). The full details page is out of scope, so it is a **clearly labelled placeholder route**. |
| No separate small-details section on Home | **Implemented** | |
| Recently Viewed (10 unique, localStorage, newest first, hidden when empty) | **Implemented** | Tested: hidden when empty, move-to-top, no duplicates, cap of 10, persistence across reload, unknown IDs ignored. A view is recorded when the detail route opens. |
| Permanently expanded FAQs, no links | **Implemented** | No links, buttons, details or numbered lists (tested). Copy is **draft**, derived only from the supplied records. |
| Exact closing message | **Implemented** | |
| Four-column responsive footer, footer-only Back to Top | **Implemented** | 4/2/1 columns tested; button hidden at top, visible after scrolling, inside the footer, same row as copyright on mobile. Website name is the placeholder `[Final Website Name]`. No contact details invented. |
| Header, dropdowns, search, bell, mobile drawer | **Partial** | Everything below tested, except: **Popular Searches is Blocked** (needs a privacy-conscious server-side aggregation service; the UI says so and shows no fake numbers); glossary, timeline and discovery content does not exist so it is not indexed; the optional browser-notification opt-in is not built; "Updates" content is **mock**. |
| Keyboard, screen reader, reduced motion, responsive, contrast | **Partial** | Keyboard, reduced motion, overflow (320 / 390 / 820 / 1440 px) and computed contrast for key colour pairs tested. **Not done:** real screen-reader testing, an axe/Lighthouse scan (axe could not be installed in this sandbox), and a full WCAG 2.2 AA audit. |
| NASA attribution and no invented content | **Partial** | Credits and source-page links are shown from the JSON. **No NASA photograph is displayed** (see Blocked). No facts were added beyond the supplied records. |

## Blocked / missing inputs

- **NASA photographs:** the JSON has source pages, not direct image URLs, and nasa.gov was unreachable from the build environment. Needed: one verified direct image URL, alt text, credit and usage confirmation per record (`data/images.json`).
- **Category illustrations:** six photorealistic transparent 3D images, not supplied.
- **Visual reference screenshots:** not supplied, so fidelity to the approved hero/overlap and search layouts is **unverified**; both follow the written spec only.
- **Popular Searches:** needs a backend aggregation service.

## Deviations (all reversible)

1. **Transparent header uses white text, not navy.** Navy `#000080` on the dark hero is 1.20:1 (fails AA); white is 19.1:1. Solid white header uses navy as specified.
2. **Duplicate section headings.** The spec gives "Browse Equipment by Their Type" the same heading as the destination section ("Meet the Explorers of the Moon and Mars"). Implemented as written; the second section has `aria-label="Browse Equipment by Their Type"`. Needs confirmation (likely a copy error).
3. **Destination heading placement:** it sits in the dark hero area above the overlapping cards (assumption, no reference image).
4. **Reduced motion:** the hero canvas is frozen from the parent after its first frame (file untouched); carousel transitions become instant but autoplay still runs (the Pause control is available). Say if autoplay should be off by default in this mode.
5. **Side carousel cards** are not keyboard-focusable (keyboard users use Previous/Next/dots); clicking a side card brings it forward. Mouse drag is not a swipe (touch/pen only).
6. **Placeholder labels inside category cards** ("Illustration placeholder") are part of the placeholder image, to be removed with real assets.
7. **Hash routing** (`#/…`) chosen so it works on any static host with Back/Forward.
8. **Extra placeholder pages** (equipment directory with working category filter, destinations, library pages, etc.) exist only so navigation can be tested. **Sources & Evidence** lists the real sources from the supplied JSON.

## Draft or mock content needing approval

Hero paragraph, footer description, all FAQ answers (`data/faqs.json`), and the three mock updates (`data/updates.json`, labelled on screen as mock).

## Known limitations

Chromium only (no Safari/Firefox/real phones/tablets); on-screen keyboard behaviour not testable; Space Grotesk/Inter were blocked during tests (fallback fonts in screenshots), so final typography is unverified; search covers equipment, missions, destinations, categories, FAQs, updates and placeholder pages only.

## Decisions needed from you

1. Heading duplication (deviation 2) and hero heading placement (3).
2. Approve white header text in the transparent state (1).
3. Supply image URLs/credits and category illustrations.
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
| PASS | Broken verified image → neutral placeholder (never other imagery) + issue recorded |
| PASS | Unverified image URL is never loaded |
| PASS | All six cards show labelled placeholder + credit line |
| PASS | Credit shows NASA/JPL-Caltech for Mars rovers |
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
