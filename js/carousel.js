// Three-card 3D coverflow. Records come from data (featured_selection.json + featured_equipment.json).
import { esc, ICONS, $, $$, announce, reducedMotion } from './util.js';
import { mediaHTML, creditHTML } from './media.js';

export const AUTOPLAY_MS = 6000;
export const TRANSITION_MS = 700;
const SWIPE_PX = 40;

export function carouselHTML(records) {
  const n = records.length;
  return `<div class="cf" data-cf role="region" aria-roledescription="carousel" aria-label="Featured equipment">
    <div class="cf-stage" data-stage>
      ${records.map((r, i) => `
        <article class="cf-card" data-i="${i}" data-id="${esc(r.id)}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}: ${esc(r.name)}">
          ${mediaHTML(r, { eager: true })}
          <div class="cf-body">
            <h3 class="cf-name">${esc(r.name)}</h3>
            <p class="cf-desc">${esc(r.short_description)}</p>
            <button type="button" class="btn-primary" data-details="${esc(r.id)}"><span>View Full Details</span><span class="spinner" aria-hidden="true"></span></button>
            ${creditHTML(r, { link: true })}
          </div>
        </article>`).join('')}
    </div>
    <div class="cf-dots" role="group" aria-label="Choose slide">
      ${records.map((r, i) => `<button type="button" class="cf-dot" data-dot="${i}" aria-label="Go to slide ${i + 1}: ${esc(r.name)}"></button>`).join('')}
    </div>
    <div class="cf-controls">
      <button type="button" class="pill" data-prev>${ICONS.arrowLeft}<span>Previous</span></button>
      <button type="button" class="pill" data-toggle aria-label="Pause autoplay"><span data-toggle-icon>${ICONS.pause}</span><span data-toggle-text>Pause</span></button>
      <button type="button" class="pill" data-next><span>Next</span>${ICONS.arrowRightSm}</button>
    </div>
    <p class="sr-only" data-live aria-live="off"></p>
  </div>`;
}

export function initCarousel(root, records) {
  const n = records.length;
  if (!n) return () => {};
  const cards = $$('.cf-card', root), dots = $$('.cf-dot', root);
  const live = $('[data-live]', root), toggle = $('[data-toggle]', root);
  let idx = 0, paused = false, visible = false, timer = null;

  const offset = (i) => { let d = (i - idx) % n; if (d > n / 2) d -= n; if (d < -n / 2) d += n; return d; };

  function layout() {
    cards.forEach((c, i) => {
      const d = offset(i);
      const pos = d === 0 ? '0' : d === -1 ? '-1' : d === 1 ? '1' : d < 0 ? 'hidden-l' : 'hidden-r';
      c.dataset.pos = pos;
      const active = d === 0;
      c.setAttribute('aria-hidden', String(!active));
      $$('a,button', c).forEach((el) => { el.tabIndex = active ? 0 : -1; });
    });
    dots.forEach((d, i) => { d.setAttribute('aria-current', String(i === idx)); d.classList.toggle('is-active', i === idx); });
  }

  function go(to, { user = false } = {}) {
    idx = ((to % n) + n) % n;
    layout();
    if (user || paused) { live.textContent = `Slide ${idx + 1} of ${n}: ${records[idx].name}`; }
    schedule();
  }

  function clear() { clearTimeout(timer); timer = null; }
  function schedule() {            // fresh full interval every time
    clear();
    if (paused || !visible || document.hidden || n < 2) return;
    timer = setTimeout(() => go(idx + 1), AUTOPLAY_MS);
  }

  function setPaused(p) {
    paused = p;
    toggle.setAttribute('aria-label', p ? 'Play autoplay' : 'Pause autoplay');
    toggle.dataset.state = p ? 'paused' : 'playing';
    $('[data-toggle-icon]', root).innerHTML = p ? ICONS.play : ICONS.pause;
    $('[data-toggle-text]', root).textContent = p ? 'Play' : 'Pause';
    live.setAttribute('aria-live', p ? 'polite' : 'off'); // do not chatter during autoplay
    schedule();                    // pause: clears; play: fresh 6 s from the current position
  }

  root.addEventListener('click', (e) => {
    if (swiped) { swiped = false; return; }
    if (e.target.closest('[data-prev]')) return go(idx - 1, { user: true });
    if (e.target.closest('[data-next]')) return go(idx + 1, { user: true });
    if (e.target.closest('[data-toggle]')) return setPaused(!paused);
    const dot = e.target.closest('[data-dot]');
    if (dot) return go(Number(dot.dataset.dot), { user: true });
    const det = e.target.closest('[data-details]');
    if (det) return openDetails(det);
    const card = e.target.closest('.cf-card');
    if (card && card.dataset.pos !== '0' && !e.target.closest('a')) go(Number(card.dataset.i), { user: true });
  });

  // Details navigation: block repeat clicks while navigation is underway.
  let navigating = false;
  function openDetails(btn) {
    if (navigating) return;
    navigating = true;
    btn.classList.add('is-loading'); btn.setAttribute('aria-disabled', 'true');
    const reset = () => { navigating = false; btn.classList.remove('is-loading'); btn.removeAttribute('aria-disabled'); window.removeEventListener('hashchange', reset); };
    window.addEventListener('hashchange', reset);
    setTimeout(reset, 4000); // safety net
    location.hash = '#/equipment/' + btn.dataset.details;
  }

  // Touch / pen swipe
  let sx = null, sy = null, swiped = false;
  const stage = $('[data-stage]', root);
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; sx = e.clientX; sy = e.clientY; });
  stage.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = sy = null;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) { swiped = true; setTimeout(() => { swiped = false; }, 350); go(dx < 0 ? idx + 1 : idx - 1, { user: true }); }
  });
  stage.addEventListener('pointercancel', () => { sx = sy = null; });

  // Autoplay only while the carousel is visible; no pause on hover.
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; schedule(); }, { threshold: 0.35 });
  io.observe(root);
  const onVis = () => schedule();
  document.addEventListener('visibilitychange', onVis);

  layout();
  root.dataset.ready = 'true';
  return () => { clear(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
}
