# UI integration notes

- Prototype 2 remains the application base; its router, DOM hooks, data contracts, and interactive behaviors are retained.
- Prototype 1's NASA-blue/white visual language and cinematic animated home hero are applied through `prototype1-ui/` styles and script.
- Redesigned screens: Home, destination views, equipment directory, full-page equipment details, mission map, planet explorer, compare, quiz, glossary, sources/evidence, FAQs, and Space Classroom.
- Timeline is intentionally excluded from the new light-theme screen-specific styling so its existing Prototype 2 presentation remains intact.
- Data files were preserved from the merged Prototype 2 data bundle.

## Validation status

`app.js` passes `node --check`; all JSON files parse; the detail-screen section, route, renderer, and responsive CSS were checked statically. These checks do not replace browser-based interaction testing. Test all routes, map controls, search, filters, equipment detail navigation, quiz, classroom lesson navigation, and mobile layout before deployment.

## Follow-up decisions (26 Oct 2026)
- Header branding/logo is retained from the current Prototype 2 header, while the navigation layout is reorganized to the requested structure: Home, Destinations, Learn, Updates, About / Sources & Evidence.
- Timeline is not in the menu and the home timeline preview is removed. The existing Prototype 2 dedicated Timeline view is retained, with destination-specific Moon/Mars timeline links left in place.
- Equipment card/search/map-linked records now open a full-page dossier adapted from Prototype 1. It reads Prototype 2’s existing camelCase data fields and includes claim-level source rows only when present in the data, otherwise showing the primary record source without inventing individual claims. The dossier’s five-question quiz action stores the selected artifact context and opens the existing quiz view. Contextual per-item question selection and mission/planet-specific five-question quizzes still require implementation and browser validation.
- The Updates navigation destination needs a dedicated rendered view before that menu item is considered complete.
