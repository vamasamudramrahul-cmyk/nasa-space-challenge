import { loadData, store } from './data.js';
import { renderHeader, setHeaderMode, bindSearchOpener, closeDrawer, refreshBell } from './header.js';
import { initSearch, open as openSearch, close as closeSearch } from './search.js';
import { homeView } from './home.js';
import { placeholderPage, notFoundPage, directoryPage, detailPage, updatesPage, sourcesPage } from './pages.js';
import { FOOTER_COLUMNS, FOOTER_DESCRIPTION, FINAL_NAME_PLACEHOLDER, PLACEHOLDER_ROUTES } from './content.js';
import { watchImageErrors } from './media.js';
import { $, esc, ICONS, announce, reducedMotion } from './util.js';

const app = () => document.getElementById('app');

// ---------- Footer ----------
function renderFooter() {
  const f = document.getElementById('site-footer');
  f.innerHTML = `<div class="foot-wrap">
    <div class="foot-grid">
      <div class="foot-col foot-id"><h2 class="foot-h">${esc(FINAL_NAME_PLACEHOLDER)}</h2>
        <p class="foot-p">${esc(FOOTER_DESCRIPTION)}</p><p class="foot-p">NASA Space Apps Challenge 2026</p></div>
      ${FOOTER_COLUMNS.map((c) => `<nav class="foot-col" aria-label="${esc(c.heading)}"><h2 class="foot-h">${esc(c.heading)}</h2>
        <ul>${c.links.map((l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`).join('')}</ul></nav>`).join('')}
    </div>
    <div class="foot-bottom"><p class="copy">© 2026 ${esc(FINAL_NAME_PLACEHOLDER)}</p>
      <button type="button" class="to-top" id="to-top" aria-label="Back to top" hidden>${ICONS.arrowUp}</button></div></div>`;
  const btn = $('#to-top');
  const sync = () => { btn.hidden = window.scrollY < 300; };
  window.addEventListener('scroll', sync, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    $('#main').focus({ preventScroll: true });
  });
  sync();
}

// ---------- Router (hash based: works on any static host and supports Back/Forward) ----------
let cleanup = null, first = true;
function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path: (path || '/').replace(/\/+$/, '') || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

function resolve({ path, query }) {
  if (path === '/') return { view: homeView(), home: true };
  if (path === '/equipment') return { view: directoryPage(query) };
  let m;
  if ((m = path.match(/^\/equipment\/([^/]+)$/))) return { view: detailPage(decodeURIComponent(m[1])) };
  if (path === '/updates') return { view: updatesPage() };
  if (path === '/about/sources') return { view: sourcesPage() };
  if (PLACEHOLDER_ROUTES[path]) return { view: placeholderPage(path) };
  return { view: notFoundPage() };
}

function render() {
  const route = parse();
  cleanup && cleanup(); cleanup = null;
  closeSearch(false); closeDrawer(false);
  const { view, home } = resolve(route);
  const el = app();
  el.innerHTML = view.html;
  document.title = home ? 'Abandoned but Not Forgotten' : `${view.title} · Abandoned but Not Forgotten`;
  setHeaderMode(!!home, route.path);
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.getElementById('site-header').classList.remove('is-hidden');
  if (view.mount) cleanup = view.mount(el) || null;
  if (!first) {
    announce(`${view.title} page`);
    (el.querySelector('h1') || $('#main'))?.focus({ preventScroll: true });
  }
  first = false;
  refreshBell();
}

function showFatal(err) {
  console.error(err);
  app().innerHTML = `<div class="page"><div class="page-wrap"><h1 class="page-h1">Something went wrong</h1>
    <p>The site data could not be loaded (${esc(err.message || err)}). If you opened index.html directly from disk, serve the folder over HTTP instead (see README.md).</p>
    <button type="button" class="btn-primary" id="retry-load">Retry</button></div></div>`;
  $('#retry-load').addEventListener('click', () => location.reload());
}

async function boot() {
  watchImageErrors();
  $('[data-skip]')?.addEventListener('click', (e) => { e.preventDefault(); $('#main').focus(); });
  app().innerHTML = '<p class="state-msg" role="status">Loading…</p>';
  try {
    await loadData();
  } catch (err) { renderHeader(); renderFooter(); showFatal(err); return; }
  renderHeader();
  initSearch();
  bindSearchOpener((from) => openSearch(from));
  renderFooter();
  window.addEventListener('hashchange', render);
  render();
  window.__abnfReady = true;
  if (store.issues.length) console.warn('Data issues:', store.issues);
}
boot();
