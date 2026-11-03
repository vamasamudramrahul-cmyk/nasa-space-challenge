# Expanded Screens Prototype — Build Report

## Added
- Compare: two equipment selectors, side-by-side attribute table, similarity/difference highlighting and unavailable-value labels.
- Glossary: live search, A–Z filter, category filter popover, always-visible term definitions and no-result state.
- Quiz: equipment selection, immediate answer feedback, correct/incorrect highlighting, mission explanation, score and answer review.
- Source & Evidence: searchable source cards, source-type filter, publisher/mission/equipment context and original NASA source links.
- About Website: project introduction, rationale, objectives, methodology, NASA-only scope, limitations and acknowledgements.
- Dataset expanded from 6 to 10 equipment records.

## Validation boundaries
This is a front-end prototype. It has not been connected to a production database or admin CMS. The four added equipment records contain concise NASA-linked summaries and require full claim-level verification. Glossary source titles are provisional. The quiz has five sample questions only; it does not satisfy the approved 15-questions-per-equipment production requirement. Existing NASA image URLs were not re-fetched during this build.

## Suggested next QA
1. Run on a local HTTP server.
2. Test each route and browser Back/Forward.
3. Test Compare selectors, equal selections and missing values.
4. Test glossary search, A–Z, category popover and empty state.
5. Test quiz answer locking, retry and result review.
6. Check source links, keyboard use, mobile layout and console errors.
7. Complete NASA claim-level research before public deployment.
