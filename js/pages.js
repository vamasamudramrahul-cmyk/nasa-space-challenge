// Routes outside the Home Screen scope. Everything here is clearly labelled as a placeholder
// except Updates and Sources & Evidence, which render real/mock data from the data files.
import { CATEGORIES, PLACEHOLDER_ROUTES } from './content.js';
import { store } from './data.js';
import { esc, $, $$, reveal } from './util.js';
import { mediaHTML, creditHTML } from './media.js';
import { getReadUpdates, markUpdateRead, recordView } from './storage.js';

const badge = (t) => `<p class="badge-ph">${esc(t)}</p>`;
const shell = (inner) => `<div class="page"><div class="page-wrap">${inner}</div></div>`;

export function placeholderPage(path) {
  const title = PLACEHOLDER_ROUTES[path] || 'Page';
  return { title, html: shell(`${badge('Placeholder route')}<h1 class="page-h1" tabindex="-1">${esc(title)}</h1>
    <p>This page is outside the scope of the Home Screen prototype. This route exists so navigation can be tested.</p>
    <p><a class="btn-outline" href="#/">Back to Home</a></p>`) };
}

export function notFoundPage() {
  return { title: 'Page not found', html: shell(`<h1 class="page-h1" tabindex="-1">Page not found</h1><p>This address does not match any page.</p><p><a class="btn-outline" href="#/">Back to Home</a></p>`) };
}

// ---- Equipment directory (placeholder with working category preselection) ----
export function directoryPage(query) {
  const initial = CATEGORIES.includes(query.category) ? query.category : '';
  const html = shell(`${badge('Placeholder directory: lists only the six prototype records')}
    <h1 class="page-h1" tabindex="-1">Equipment Library</h1>
    <div class="filters" role="group" aria-label="Filter by category">
      <button type="button" class="chip" data-cat="" aria-pressed="${!initial}">All</button>
      ${CATEGORIES.map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === initial}">${esc(c)}</button>`).join('')}
      <button type="button" class="link-btn" data-reset ${initial ? '' : 'hidden'}>Reset filter</button>
    </div>
    <p class="sr-only" role="status" aria-live="polite" data-count></p>
    <ul class="dir-list" data-list></ul>`);
  return { title: 'Equipment Library', html, mount(root) {
    let cat = initial;
    const list = $('[data-list]', root), count = $('[data-count]', root);
    const render = () => {
      $$('.chip', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
      $('[data-reset]', root).hidden = !cat;
      const recs = store.records.filter((r) => !cat || r.category === cat);
      list.innerHTML = recs.length ? recs.map((r) => `<li><a class="dir-item" href="#/equipment/${esc(r.id)}"><strong>${esc(r.name)}</strong><span>${esc(r.category)} · ${esc(r.destination)}</span></a></li>`).join('')
        : `<li class="state-msg">No equipment records for “${esc(cat)}” in this prototype.</li>`;
      count.textContent = `${recs.length} record${recs.length === 1 ? '' : 's'}${cat ? ' in ' + cat : ''}`;
    };
    root.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cat]'); const r = e.target.closest('[data-reset]');
      if (!c && !r) return;
      cat = r ? '' : c.dataset.cat;
      history.replaceState(null, '', cat ? `#/equipment?category=${encodeURIComponent(cat)}` : '#/equipment');
      render();
    });
    render();
  } };
}

// ---- Equipment detail (route placeholder; records the view) ----
export function detailPage(id) {
  const r = store.byId.get(id);
  if (!r) return { title: 'Equipment not found', html: shell(`<h1 class="page-h1" tabindex="-1">Equipment not found</h1><p>No record matches “${esc(id)}”.</p><p><a class="btn-outline" href="#/equipment">Browse equipment</a></p>`) };
  recordView(r.id);
  return { title: r.name, html: shell(`${badge('Placeholder route: the full equipment details page is not part of this prototype')}
    <h1 class="page-h1" tabindex="-1">${esc(r.name)}</h1>
    <div class="detail-media">${mediaHTML(r)}${creditHTML(r, { link: true })}</div>
    <p>${esc(r.short_description)}</p>
    <h2 class="h3">NASA sources</h2>
    <ul class="src-list">${r.primary_sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}<span class="sr-only"> (opens in a new tab)</span></a></li>`).join('')}</ul>
    <p><a class="btn-outline" href="#/">Back to Home</a> <a class="btn-outline" href="#/equipment">Browse equipment</a></p>`) };
}

// ---- Updates (mock data, clearly labelled) ----
export function updatesPage() {
  const read = new Set(getReadUpdates());
  const html = shell(`<h1 class="page-h1" tabindex="-1">Updates</h1>
    ${badge('Mock updates for prototype testing: not real site news')}
    <ol class="upd-list">${store.updates.map((u) => `
      <li class="upd" data-uid="${esc(u.id)}">
        <div class="upd-meta"><time datetime="${esc(u.date)}">${esc(u.date)}</time>
          ${read.has(u.id) ? '' : '<span class="tag tag-new">NEW</span>'}
          ${u.important ? '<span class="tag tag-ann">ANNOUNCEMENT</span>' : ''}</div>
        <h2 class="h3">${esc(u.title)}</h2><p>${esc(u.body)}</p></li>`).join('')}</ol>`);
  return { title: 'Updates', html, mount(root) {
    // Mark read only after the item has been scrolled into view and actually viewed (≥60% visible for 1 s).
    const timers = new Map();
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const id = e.target.dataset.uid;
      if (e.isIntersecting) {
        if (timers.has(id)) return;
        timers.set(id, setTimeout(() => {
          markUpdateRead(id);
          $('.tag-new', e.target)?.remove();
          io.unobserve(e.target);
        }, 1000));
      } else if (timers.has(id)) { clearTimeout(timers.get(id)); timers.delete(id); }
    }), { threshold: 0.6 });
    $$('.upd', root).forEach((el) => { if (!read.has(el.dataset.uid)) io.observe(el); });
    return () => { io.disconnect(); timers.forEach(clearTimeout); };
  } };
}

// ---- Sources & Evidence (real provenance from the supplied JSON) ----
export function sourcesPage() {
  return { title: 'Sources & Evidence', html: shell(`<h1 class="page-h1" tabindex="-1">Sources &amp; Evidence</h1>
    ${badge('Prototype view: lists sources for the six supplied records only')}
    <p>Each record below lists the NASA pages its description is based on. Statuses and figures should be rechecked against the live NASA pages before content freeze.</p>
    ${store.records.map((r) => `<section class="src-block"><h2 class="h3">${esc(r.name)}</h2>
      <ul class="src-list">${r.primary_sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}<span class="sr-only"> (opens in a new tab)</span></a></li>`).join('')}</ul>
      <p class="credit">Image page: <a href="${esc(r.image_source_page)}" target="_blank" rel="noopener noreferrer">${esc(r.image_source_page)}</a> · Credit: ${esc(r.image_credit)}</p></section>`).join('')}`) };
}
