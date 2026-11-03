// Universal search overlay (local index only).
// Popular Searches are NOT faked: they need a privacy-conscious server-side aggregation service.
import { store } from './data.js';
import { DESTINATIONS, CATEGORIES, PLACEHOLDER_ROUTES } from './content.js';
import { $, $$, ICONS, esc, highlight, trapFocus, setScrollLock, reducedMotion, announce } from './util.js';
import { getRecentSearches, addRecentSearch, clearRecentSearches } from './storage.js';

const MIN_CHARS = 2, DEBOUNCE_MS = 300, SLOW_MS = 150;
let forceFailure = false; // test seam only
export const _setFailureForTest = (v) => { forceFailure = !!v; };

// ---------- Index ----------
let index = null;
export function buildIndex() {
  const items = [];
  for (const r of store.records) {
    items.push({ title: r.name, type: 'Equipment', desc: r.short_description, href: `#/equipment/${r.id}`,
      kw: [r.category, r.destination, r.mission, ...(r.educational_value || [])].join(' ') });
    items.push({ title: `${r.name}: full details`, type: 'Equipment Details', desc: r.story_hook, href: `#/equipment/${r.id}`, kw: r.mission });
  }
  // One entry per mission, listing every record that belongs to it.
  const missions = new Map();
  for (const r of store.records) if (r.mission) missions.set(r.mission, [...(missions.get(r.mission) || []), r]);
  for (const [mission, recs] of missions) {
    const names = recs.map((x) => x.name);
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
    items.push({ title: mission, type: 'Mission', desc: `NASA mission featuring ${list}.`, href: `#/equipment/${recs[0].id}`, kw: recs[0].destination });
  }
  for (const d of DESTINATIONS) items.push({ title: d.label, type: 'Destination', desc: d.text, href: d.href, kw: d.title });
  for (const c of CATEGORIES) items.push({ title: c, type: 'Category', desc: `Browse ${c.toLowerCase()} in the equipment directory.`, href: `#/equipment?category=${encodeURIComponent(c)}`, kw: 'equipment type' });
  for (const [path, label] of Object.entries(PLACEHOLDER_ROUTES)) {
    if (path.startsWith('/destination')) continue;
    const type = path.startsWith('/library/quiz') || path === '/elearning' ? 'Quiz / eLearning'
      : path === '/about/website' ? 'About' : path.startsWith('/library') ? 'Library' : 'Site';
    items.push({ title: label, type, desc: 'Placeholder page: not built in this prototype.', href: '#' + path, kw: '' });
  }
  items.push({ title: 'Sources & Evidence', type: 'Sources & Evidence', desc: 'NASA sources for the featured equipment records.', href: '#/about/sources', kw: 'references provenance' });
  items.push({ title: 'Updates', type: 'Updates', desc: 'Site updates and announcements.', href: '#/updates', kw: 'notifications news' });
  for (const u of store.updates) items.push({ title: u.title, type: 'Updates', desc: u.body, href: '#/updates', kw: '' });
  for (const f of store.faqs) items.push({ title: f.q, type: 'FAQ', desc: (f.a.find((x) => x.p) || {}).p || '', href: '#/', kw: '' });
  // Glossary terms, timelines and discoveries: no content exists yet, so nothing is indexed (reported as a limitation).
  return items;
}

export function runSearch(query) {
  if (forceFailure) throw new Error('forced failure (test)');
  if (!index) index = buildIndex();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];
  for (const it of index) {
    const title = it.title.toLowerCase(), hay = `${title} ${it.desc.toLowerCase()} ${(it.kw || '').toLowerCase()}`;
    if (!tokens.every((t) => hay.includes(t))) continue; // partial keyword matching, all words must match
    let s = 0;
    for (const t of tokens) s += (title.startsWith(t) ? 5 : 0) + (title.includes(t) ? 3 : 0) + (it.desc.toLowerCase().includes(t) ? 1 : 0) + 1;
    scored.push({ it, s });
  }
  scored.sort((a, b) => b.s - a.s || a.it.title.localeCompare(b.it.title));
  return { tokens, results: scored.map((x) => x.it) };
}

// ---------- Overlay ----------
let root, panel, input, body, status, opener, releaseTrap, debounceT, slowT, token = 0, isOpen = false;

export function initSearch() {
  root = document.getElementById('search-root');
  root.innerHTML = `
    <div class="search-overlay" id="search-overlay" hidden>
      <div class="search-backdrop" data-search-close></div>
      <div class="search-panel" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <h2 id="search-title" class="sr-only">Search</h2>
        <div class="search-top">
          <span class="search-ico">${ICONS.search}</span>
          <input id="search-input" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"
                 placeholder="Search equipment, missions, destinations…" aria-label="Search" aria-controls="search-body">
          <button type="button" class="search-clear" data-search-clear aria-label="Clear search" hidden>×</button>
          <button type="button" class="search-esc" data-search-close aria-label="Close search">${ICONS.close}<span class="esc-hint" aria-hidden="true">Esc</span></button>
        </div>
        <p class="offline-label" id="search-offline" hidden>Offline Mode</p>
        <div class="search-body" id="search-body"></div>
        <p class="sr-only" id="search-status" role="status" aria-live="polite"></p>
      </div></div>`;
  panel = $('.search-panel', root); input = $('#search-input'); body = $('#search-body'); status = $('#search-status');

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-search-close]')) close();
    else if (e.target.closest('[data-search-clear]')) { input.value = ''; onInput(); input.focus(); }
    else if (e.target.closest('[data-clear-recents]')) { clearRecentSearches(); renderSuggestions(); input.focus(); }
    else if (e.target.closest('[data-recent]')) { input.value = e.target.closest('[data-recent]').dataset.recent; onInput(true); input.focus(); }
    else if (e.target.closest('[data-retry]')) { onInput(true); }
    else if (e.target.closest('a.result')) { addRecentSearch(input.value); close(false); }
  });
  input.addEventListener('input', () => onInput());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = $('a.result', body);
      if (first) { e.preventDefault(); addRecentSearch(input.value); close(false); location.hash = first.getAttribute('href'); }
      else if (input.value.trim().length >= MIN_CHARS) onInput(true);
    } else if (e.key === 'ArrowDown') { const f = $('a.result', body); if (f) { e.preventDefault(); f.focus(); } }
  });
  body.addEventListener('keydown', (e) => {
    const links = $$('a.result', body), i = links.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); links[Math.min(i + 1, links.length - 1)].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i === 0 ? input : links[i - 1]).focus(); }
  });

  // Desktop shortcuts. Never intercept while typing in a form field.
  document.addEventListener('keydown', (e) => {
    if (isOpen || e.defaultPrevented) return;
    const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (typing) return;
    const k = e.key;
    if ((k === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'k')) {
      e.preventDefault(); open(document.activeElement);
    }
  });
  const net = () => { $('#search-offline').hidden = navigator.onLine; };
  window.addEventListener('online', net); window.addEventListener('offline', net);
}

export function open(from) {
  if (isOpen) return;
  isOpen = true; opener = from instanceof HTMLElement ? from : document.activeElement;
  const ov = $('#search-overlay');
  ov.hidden = false;
  $('#search-offline').hidden = navigator.onLine;
  setScrollLock(true);
  input.value = ''; onInput();
  requestAnimationFrame(() => { ov.classList.add('is-open'); input.focus(); });
  releaseTrap = trapFocus(panel, () => close());
}

export function close(restoreFocus = true) {
  if (!isOpen) return;
  isOpen = false;
  const ov = $('#search-overlay');
  ov.classList.remove('is-open');
  clearTimeout(debounceT); clearTimeout(slowT); token++;
  releaseTrap && releaseTrap(); releaseTrap = null;
  setScrollLock(false);
  setTimeout(() => { if (!isOpen) ov.hidden = true; }, reducedMotion() ? 0 : 200);
  if (restoreFocus && opener && document.contains(opener)) opener.focus();
}

function renderSuggestions() {
  const rec = getRecentSearches();
  body.innerHTML = `
    <section class="sugg" aria-labelledby="sg-recent">
      <div class="sugg-head"><h3 id="sg-recent">Recent Searches</h3>${rec.length ? '<button type="button" class="link-btn" data-clear-recents>Clear</button>' : ''}</div>
      ${rec.length ? `<ul class="sugg-list">${rec.map((r) => `<li><button type="button" class="sugg-item" data-recent="${esc(r)}">${esc(r)}</button></li>`).join('')}</ul>`
        : '<p class="muted">No recent searches yet.</p>'}
    </section>
    <section class="sugg" aria-labelledby="sg-pop">
      <div class="sugg-head"><h3 id="sg-pop">Popular Searches</h3></div>
      <p class="muted">Not available in this prototype. Popular searches need a privacy-conscious server-side aggregation service across visitors, and none is connected.</p>
    </section>`;
  status.textContent = '';
}

function onInput(immediate = false) {
  const q = input.value.trim();
  $('[data-search-clear]').hidden = input.value.length === 0;
  clearTimeout(debounceT); clearTimeout(slowT);
  const myToken = ++token; // cancels any in-flight stale search
  if (q.length < MIN_CHARS) { renderSuggestions(); return; }
  slowT = setTimeout(() => {
    if (myToken === token) { body.innerHTML = '<p class="muted center" role="status">Searching…</p>'; }
  }, DEBOUNCE_MS + SLOW_MS);
  debounceT = setTimeout(async () => {
    try {
      await Promise.resolve();
      if (myToken !== token) return;
      const { tokens, results } = runSearch(q);
      if (myToken !== token) return;
      clearTimeout(slowT);
      renderResults(results, tokens);
    } catch (err) {
      if (myToken !== token) return;
      clearTimeout(slowT);
      console.warn('[search]', err);
      body.innerHTML = '<div class="search-error" role="alert"><p>Something went wrong</p><button type="button" class="btn-outline" data-retry>Retry</button></div>';
    }
  }, immediate ? 0 : DEBOUNCE_MS);
}

function renderResults(results, tokens) {
  if (!results.length) {
    body.innerHTML = '<p class="muted center">No results found</p>';
    status.textContent = 'No results found';
    return;
  }
  body.innerHTML = `<ul class="results" aria-label="Search results">${results.map((r) => `
    <li><a class="result" href="${esc(r.href)}">
      <span class="r-top"><span class="r-title">${highlight(r.title, tokens)}</span><span class="r-type">${esc(r.type)}</span></span>
      <span class="r-desc">${highlight(r.desc, tokens)}</span></a></li>`).join('')}</ul>`;
  const msg = `${results.length} result${results.length === 1 ? '' : 's'}`;
  status.textContent = msg;
}
