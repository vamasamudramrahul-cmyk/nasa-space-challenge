import { NAV, BRAND } from './content.js';
import { $, $$, ICONS, esc, trapFocus, setScrollLock } from './util.js';
import { store } from './data.js';
import { getReadUpdates } from './storage.js';

let openSearch = () => {};
export const bindSearchOpener = (fn) => { openSearch = fn; };

const header = () => document.getElementById('site-header');

export function hasUnread() {
  const read = new Set(getReadUpdates());
  // Minor corrections / internal changes never trigger the dot.
  return store.updates.some((u) => !u.minor && !read.has(u.id));
}

export function refreshBell() {
  const unread = hasUnread();
  $$('[data-bell-dot]').forEach((d) => { d.hidden = !unread; });
  $$('[data-bell]').forEach((b) => {
    b.setAttribute('aria-label', unread ? 'Updates, new updates available' : 'Updates');
  });
}

function desktopItem(item, i) {
  if (!item.children) return `<li><a class="nav-link" href="${item.href}" data-nav>${esc(item.label)}</a></li>`;
  return `<li class="dd">
    <button class="nav-link dd-btn" type="button" aria-expanded="false" aria-controls="dd-${i}">${esc(item.label)}<span class="chev">${ICONS.chevron}</span></button>
    <ul class="dd-menu" id="dd-${i}" hidden>${item.children.map((c) => `<li><a href="${c.href}" data-nav>${esc(c.label)}</a></li>`).join('')}</ul></li>`;
}

function drawerItem(item, i) {
  if (!item.children) return `<li><a class="drawer-link" href="${item.href}" data-nav>${esc(item.label)}</a></li>`;
  return `<li>
    <button class="drawer-link drawer-acc" type="button" aria-expanded="false" aria-controls="dacc-${i}">${esc(item.label)}<span class="chev">${ICONS.chevron}</span></button>
    <ul class="drawer-sub" id="dacc-${i}" hidden>${item.children.map((c) => `<li><a class="drawer-link sub" href="${c.href}" data-nav>${esc(c.label)}</a></li>`).join('')}</ul></li>`;
}

export function renderHeader() {
  const h = header();
  h.innerHTML = `<div class="hdr-inner">
    <a class="brand" href="#/">${esc(BRAND)}</a>
    <nav class="nav-desktop" aria-label="Main"><ul>${NAV.map(desktopItem).join('')}</ul></nav>
    <div class="hdr-actions">
      <button class="icon-btn search-btn" type="button" data-open-search aria-haspopup="dialog" aria-label="Search">${ICONS.search}<span class="search-label">Search</span></button>
      <a class="icon-btn bell" href="#/updates" data-bell aria-label="Updates">${ICONS.bell}<span class="dot" data-bell-dot hidden></span></a>
      <button class="icon-btn burger" type="button" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">${ICONS.menu}</button>
    </div></div>`;

  document.getElementById('drawer-root').innerHTML = `
    <div class="drawer" id="drawer" hidden>
      <div class="drawer-backdrop" data-drawer-close></div>
      <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="drawer-head"><span class="drawer-title">Menu</span>
          <button class="icon-btn" type="button" data-drawer-close aria-label="Close menu">${ICONS.close}</button></div>
        <nav aria-label="Mobile"><ul class="drawer-list">
          ${NAV.map(drawerItem).join('')}
          <li><button class="drawer-link" type="button" data-open-search aria-haspopup="dialog">Search</button></li>
          <li><a class="drawer-link" href="#/updates" data-bell data-nav>Notifications<span class="dot inline" data-bell-dot hidden></span></a></li>
        </ul></nav>
      </div></div>`;

  wireDropdowns();
  wireDrawer();
  wireScroll();
  h.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-search]')) openSearch(e.target.closest('[data-open-search]'));
  });
  document.getElementById('drawer').addEventListener('click', (e) => {
    const s = e.target.closest('[data-open-search]');
    if (s) { closeDrawer(false); openSearch(document.getElementById('burger')); }
  });
  window.addEventListener('abnf:readstate', refreshBell);
  refreshBell();
}

// ---------- Desktop dropdowns ----------
function wireDropdowns() {
  const dds = $$('.dd', header());
  const close = (dd, focusBtn = false) => {
    const b = $('.dd-btn', dd), m = $('.dd-menu', dd);
    b.setAttribute('aria-expanded', 'false'); m.hidden = true; dd.classList.remove('is-open');
    if (focusBtn) b.focus();
  };
  const open = (dd) => {
    dds.forEach((o) => o !== dd && close(o));
    const b = $('.dd-btn', dd), m = $('.dd-menu', dd);
    b.setAttribute('aria-expanded', 'true'); m.hidden = false; dd.classList.add('is-open');
  };
  dds.forEach((dd) => {
    const b = $('.dd-btn', dd);
    let timer, byHover = false;
    // A mouse click on a menu that hover has just opened must keep it open (not toggle it shut).
    // Keyboard activation (click with detail 0) and touch always toggle.
    b.addEventListener('click', (e) => {
      if (byHover && e.detail > 0) { byHover = false; return; }
      byHover = false;
      dd.classList.contains('is-open') ? close(dd) : open(dd);
    });
    dd.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { clearTimeout(timer); if (!dd.classList.contains('is-open')) byHover = true; open(dd); } });
    dd.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { byHover = false; timer = setTimeout(() => close(dd), 160); } });
    dd.addEventListener('focusout', (e) => { if (!dd.contains(e.relatedTarget)) close(dd); });
    dd.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dd.classList.contains('is-open')) { e.stopPropagation(); close(dd, true); }
      if (e.key === 'ArrowDown' && document.activeElement === b) { e.preventDefault(); open(dd); $('.dd-menu a', dd)?.focus(); }
    });
    $$('.dd-menu a', dd).forEach((a) => a.addEventListener('click', () => close(dd)));
  });
  document.addEventListener('pointerdown', (e) => { dds.forEach((dd) => { if (!dd.contains(e.target)) close(dd); }); });
}

// ---------- Mobile drawer ----------
let releaseTrap = null, drawerOpener = null;
export function closeDrawer(restoreFocus = true) {
  const d = document.getElementById('drawer');
  if (!d || d.hidden) return;
  d.classList.remove('is-open');
  setTimeout(() => { d.hidden = true; }, 260);
  $('#burger').setAttribute('aria-expanded', 'false');
  setScrollLock(false);
  releaseTrap && releaseTrap(); releaseTrap = null;
  if (restoreFocus) (drawerOpener || $('#burger')).focus();
}
function openDrawer() {
  const d = document.getElementById('drawer');
  drawerOpener = document.activeElement;
  d.hidden = false;
  requestAnimationFrame(() => d.classList.add('is-open'));
  $('#burger').setAttribute('aria-expanded', 'true');
  setScrollLock(true);
  releaseTrap = trapFocus($('.drawer-panel', d), () => closeDrawer());
  setTimeout(() => $('[data-drawer-close].icon-btn', d)?.focus(), 30);
}
function wireDrawer() {
  $('#burger').addEventListener('click', openDrawer);
  const d = document.getElementById('drawer');
  d.addEventListener('click', (e) => {
    if (e.target.closest('[data-drawer-close]')) { closeDrawer(); return; }
    const acc = e.target.closest('.drawer-acc');
    if (acc) {
      const open = acc.getAttribute('aria-expanded') === 'true';
      acc.setAttribute('aria-expanded', String(!open));
      $('#' + acc.getAttribute('aria-controls'), d).hidden = open;
      acc.classList.toggle('is-open', !open);
      return;
    }
    if (e.target.closest('a[data-nav]')) closeDrawer(false); // close after navigation
  });
  // If the viewport grows to desktop while open, close it.
  matchMedia('(min-width: 1080px)').addEventListener('change', (m) => { if (m.matches) closeDrawer(false); });
}

// ---------- Scroll behaviour: transparent at top, solid when scrolled, hide down / show up ----------
function wireScroll() {
  const h = header();
  let lastY = window.scrollY, ticking = false;
  const update = () => {
    ticking = false;
    const y = Math.max(0, window.scrollY);
    h.classList.toggle('is-top', y < 8);
    const busy = h.contains(document.activeElement) && document.activeElement !== document.body
      || $('.dd.is-open', h) || document.documentElement.classList.contains('no-scroll');
    if (y > lastY + 4 && y > h.offsetHeight && !busy) h.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 8) h.classList.remove('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  h.addEventListener('focusin', () => h.classList.remove('is-hidden'));
  update();
}

export function setHeaderMode(isHome, path) {
  const h = header();
  h.dataset.hero = String(isHome);
  h.classList.remove('is-hidden');
  $$('[data-nav],.brand', h).forEach((a) => {
    const href = (a.getAttribute('href') || '').replace(/^#/, '');
    if (href && href === path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
