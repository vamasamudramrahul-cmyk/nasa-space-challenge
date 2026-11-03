// Fixed copy from HOME_SCREEN_SPECIFICATION.md (exact wording) plus navigation structure.

export const BRAND = 'NASA SPACE APPS CHALLENGE 2026';
// Final public website name is undecided: never hardcode the working project name as a public brand.
export const FINAL_NAME_PLACEHOLDER = '[Final Website Name]';

export const HERO = {
  title: 'Abandoned but Not Forgotten',
  subtitle: 'Every Mission Leaves a Story',
  // DRAFT descriptive paragraph (spec gives no wording). Needs project-lead approval.
  description: 'Explore the machines that NASA missions left behind on the Moon and Mars, and the discoveries they made along the way.'
};

export const EXPLORE_HEADING = 'Meet the Explorers of the Moon and Mars';
export const DESTINATIONS = [
  { id: 'moon', title: 'Moon', href: '#/destination/moon', label: 'Explore Moon',
    text: 'Discover the missions, machines and scientific discoveries that shaped our exploration of the Moon.' },
  { id: 'mars', title: 'Mars', href: '#/destination/mars', label: 'Explore Mars',
    text: 'Explore the missions, robotic explorers and discoveries that reveal the mysteries of the Red Planet.' },
  { id: 'planets', title: 'Planets', href: '#/destination/planets', label: 'Explore Planets',
    text: 'Journey across our solar system and discover the worlds beyond Earth.' }
];

// NOTE: the specification gives this section the SAME heading as the destination section.
// Implemented exactly as written; flagged in IMPLEMENTATION_REPORT.md for confirmation.
export const BROWSE_HEADING = 'Meet the Explorers of the Moon and Mars';
export const BROWSE_SECTION_LABEL = 'Browse Equipment by Their Type';
export const CATEGORIES = ['Rovers', 'Landers', 'Spacecraft', 'Orbiters', 'Helicopters', 'Descent Stages'];

export const FEATURED_HEADING = 'The Legends of Space Exploration';
export const RECENT_HEADING = 'Recently Viewed';
export const FAQ_HEADING = 'Frequently Asked Questions';
export const CLOSING = "There's always more to discover beyond Earth. Keep exploring!";

export const NAV = [
  { label: 'Home', href: '#/' },
  { label: 'Destination', children: [
    { label: 'Explore Moon', href: '#/destination/moon' },
    { label: 'Explore Mars', href: '#/destination/mars' },
    { label: 'Explore Planets', href: '#/destination/planets' } ] },
  { label: 'Library', children: [
    { label: 'Compare', href: '#/library/compare' },
    { label: 'Glossary', href: '#/library/glossary' },
    { label: 'Quiz', href: '#/library/quiz' } ] },
  { label: 'About', children: [
    { label: 'About Website', href: '#/about/website' },
    { label: 'Sources & Evidence', href: '#/about/sources' } ] },
  { label: 'eLearning', href: '#/elearning' }
];

export const FOOTER_COLUMNS = [
  { heading: 'Explore', links: [
    { label: 'Home', href: '#/' },
    { label: 'Explore Moon', href: '#/destination/moon' },
    { label: 'Explore Mars', href: '#/destination/mars' },
    { label: 'Explore Planets', href: '#/destination/planets' } ] },
  { heading: 'Resources', links: [
    { label: 'Equipment Library', href: '#/equipment' },
    { label: 'Compare', href: '#/library/compare' },
    { label: 'Glossary', href: '#/library/glossary' },
    { label: 'Quiz', href: '#/library/quiz' },
    { label: 'eLearning', href: '#/elearning' } ] },
  { heading: 'Contact & Feedback', links: [
    { label: 'Contact Us', href: '#/contact' },
    { label: 'Send Feedback', href: '#/feedback' },
    { label: 'Report an Issue', href: '#/report' },
    { label: 'Sources & Evidence', href: '#/about/sources' } ] }
];
// DRAFT short description for the footer identity column. Needs approval.
export const FOOTER_DESCRIPTION = 'Explore the equipment NASA missions left behind on the Moon and Mars.';

// Titles for placeholder routes (pages outside the Home Screen prototype).
export const PLACEHOLDER_ROUTES = {
  '/destination/moon': 'Explore Moon',
  '/destination/mars': 'Explore Mars',
  '/destination/planets': 'Explore Planets',
  '/library/compare': 'Compare',
  '/library/glossary': 'Glossary',
  '/library/quiz': 'Quiz',
  '/about/website': 'About Website',
  '/elearning': 'eLearning',
  '/contact': 'Contact Us',
  '/feedback': 'Send Feedback',
  '/report': 'Report an Issue'
};
