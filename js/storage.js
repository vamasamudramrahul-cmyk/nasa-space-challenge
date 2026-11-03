// localStorage wrappers. Every access is guarded: storage can be blocked, full or cleared.

export const KEYS = {
  recent: 'abnf.recentlyViewed.v1',
  searches: 'abnf.recentSearches.v1',
  read: 'abnf.readUpdates.v1'
};
export const MAX_RECENT_VIEWS = 10;
export const MAX_RECENT_SEARCHES = 10;

function load(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// ---- Recently viewed (equipment ids, newest first, unique, max 10) ----
export const getRecentViews = () => load(KEYS.recent).slice(0, MAX_RECENT_VIEWS);
export function recordView(id) {
  if (!id) return getRecentViews();
  const next = [id, ...load(KEYS.recent).filter((x) => x !== id)].slice(0, MAX_RECENT_VIEWS);
  save(KEYS.recent, next);
  return next;
}

// ---- Recent searches (unique case-insensitively, newest first, max 10) ----
export const getRecentSearches = () => load(KEYS.searches).slice(0, MAX_RECENT_SEARCHES);
export function addRecentSearch(q) {
  const term = String(q || '').trim();
  if (term.length < 2) return getRecentSearches();
  const next = [term, ...load(KEYS.searches).filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
  save(KEYS.searches, next);
  return next;
}
export function clearRecentSearches() { save(KEYS.searches, []); }

// ---- Read updates ----
export const getReadUpdates = () => load(KEYS.read);
export function markUpdateRead(id) {
  const cur = load(KEYS.read);
  if (cur.includes(id)) return cur;
  cur.push(id);
  save(KEYS.read, cur);
  window.dispatchEvent(new CustomEvent('abnf:readstate'));
  return cur;
}
