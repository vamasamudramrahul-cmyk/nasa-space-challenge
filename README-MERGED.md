# Abandoned but Not Forgotten — merged prototype

This build combines the upgraded visual direction from Prototype 1 with the existing application engine, controls, and production data bundle from Prototype 2.

## What changed

- Added a Space Classroom / eLearning area with four short teaching modules, learning goals, discussion prompts, educator activity structure, and previous/next lesson controls.
- Added a searchable FAQ screen covering catalog scope, map interpretation, evidence labels, comparison, classroom use, and corrections.
- Integrated Prototype 1’s full-page equipment dossier into Prototype 2: breadcrumb/title bar, status, verified-image-only area, mission summary, technical specifications, scientific instruments and discoveries, chronological milestones, evidence register, quick facts, coordinate/uncertainty notes, known data gaps, and comparison/catalogue/quiz actions. The detail renderer maps Prototype 1’s fields to Prototype 2’s existing data schema.
- Added Classroom and FAQ shortcuts to the navigation and map menus.

- Replaced the original plain home hero with Prototype 1's animated starfield/nebula hero.
- Applied the Prototype 1 visual language to the site: dark NASA-style header and footer, white content surfaces, NASA-blue accents, brighter cards, and simplified borders/shadows.
- Added responsive styles for the upgraded hero and destination cards.
- The animated hero runs only while the Home route is active and respects reduced-motion preferences.
- Set the default theme to Light to match Prototype 1. The existing theme toggle remains available; an already-saved theme in the browser still takes precedence.

## What was preserved

- Prototype 2's `app.js` route system and screen markup/IDs.
- The existing bundled 100-record equipment dataset and associated mission, timeline, quiz, glossary, source, update, and planet data.
- Existing 3D canvas globe/map logic, directory filters, grid/table toggle, comparison, quiz, search, recently explored history, notifications, feedback modal, tutorial, theme toggle, and local-storage behavior. Equipment links now route to a full-page dossier instead of opening the old short detail modal; the old modal markup remains in the project but is not used by the equipment detail route.
- Hash routes such as `#home`, `#filters`, `#destination-moon`, `#destination-mars`, `#mission-map`, `#timeline`, `#compare`, `#quiz`, `#glossary`, `#sources`, and `#about`.

## Run locally

Open `index.html` in a modern browser. `data/bundle.js` is retained so the prototype can initialize without fetching the JSON files; the raw JSON datasets are included as well.

## GitHub Pages deployment

Upload the contents of this folder to the repository root (or replace the files in the target branch) and keep the same relative paths. GitHub Pages should serve `index.html` from that root. Test the main routes and interactive controls on the published site after deployment.

## Validation

The app JavaScript passes `node --check` and all JSON datasets parse successfully. The full-page equipment detail route and its responsive dossier styles are present. JavaScript syntax and JSON parsing checks pass. Full browser interaction testing and live deployment have not been completed; before replacing the published site, test equipment links, back navigation, source links, quiz entry, navigation, lessons, FAQ search, map controls, theme toggle, filters, comparison, and mobile layout.
