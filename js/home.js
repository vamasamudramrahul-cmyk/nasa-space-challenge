import { HERO, EXPLORE_HEADING, DESTINATIONS, BROWSE_HEADING, BROWSE_SECTION_LABEL, CATEGORIES,
  FEATURED_HEADING, RECENT_HEADING, FAQ_HEADING, CLOSING } from './content.js';
import { store } from './data.js';
import { esc, ICONS, reveal, reducedMotion } from './util.js';
import { carouselHTML, initCarousel } from './carousel.js';
import { mediaHTML, creditHTML } from './media.js';
import { getRecentViews } from './storage.js';

// AI-generated conceptual category artwork (not NASA photographs, not evidence). Never used in the Featured carousel.
function catArt(name) {
  const a = store.categoryArt.get(name);
  if (!a) return `<div class="cat-img cat-missing" role="img" aria-label="Illustration for ${esc(name)} not available"></div>`;
  return `<div class="cat-img"><img src="${esc(a.src)}" alt="${esc(a.alt)}" width="720" height="560" loading="lazy" decoding="async"></div>`;
}

function faqHTML() {
  return store.faqs.map((f) => `
    <div class="faq-item"><h3 class="faq-q">${esc(f.q)}</h3><div class="faq-a">
      ${f.a.map((b) => b.p ? `<p>${esc(b.p)}</p>` : `<ul>${b.ul.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`).join('')}
    </div></div>`).join('');
}

export function recentHTML() {
  const recs = getRecentViews().map((id) => store.byId.get(id)).filter(Boolean);
  if (!recs.length) return ''; // hidden when empty
  return `<section class="section recent" id="recently-viewed" aria-labelledby="rv-h">
    <div class="wrap"><h2 id="rv-h" class="h2 reveal">${esc(RECENT_HEADING)}</h2>
      <ul class="rv-grid">${recs.map((r, i) => `
        <li class="reveal" style="--i:${i % 4}"><a class="rv-card" href="#/equipment/${esc(r.id)}">
          ${mediaHTML(r)}
          <div class="rv-body"><h3 class="rv-name">${esc(r.name)}</h3><p class="rv-desc">${esc(r.short_description)}</p>${creditHTML(r)}</div>
        </a></li>`).join('')}</ul></div></section>`;
}

export function homeView() {
  const html = `
  <div class="home">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-bg" aria-hidden="true">
        <!-- Supplied animated-universe file, unchanged, isolated in its own document so its full-viewport CSS/JS cannot affect this page. -->
        <iframe src="assets/universe/animated-universe.html" title="Animated deep-space background (decorative)" tabindex="-1" loading="eager"></iframe>
      </div>
      <div class="hero-content wrap">
        <h1 id="hero-title" class="hero-title">${esc(HERO.title)}</h1>
        <p class="hero-sub">${esc(HERO.subtitle)}</p>
        <p class="hero-desc">${esc(HERO.description)}</p>
        <h2 class="hero-h2" id="explore-h">${esc(EXPLORE_HEADING)}</h2>
      </div>
    </section>

    <section class="explore" aria-labelledby="explore-h">
      <div class="wrap">
        <ul class="explore-grid">${DESTINATIONS.map((d, i) => `
          <li class="reveal" style="--i:${i}"><a class="explore-card" href="${d.href}">
            <span class="ec-text"><span class="ec-title">${esc(d.title)}</span><span class="ec-desc">${esc(d.text)}</span></span>
            <span class="ec-go" aria-hidden="true">${ICONS.arrowRight}</span>
            <span class="sr-only">${esc(d.label)}</span>
          </a></li>`).join('')}</ul>
      </div>
    </section>

    <section class="section browse" aria-label="${esc(BROWSE_SECTION_LABEL)}">
      <div class="wrap">
        <h2 class="h2 reveal">${esc(BROWSE_HEADING)}</h2>
        <ul class="cat-grid">${CATEGORIES.map((c, i) => `
          <li class="reveal" style="--i:${i % 3}"><a class="cat-card" href="#/equipment?category=${encodeURIComponent(c)}">
            ${catArt(c)}
            <span class="cat-name">${esc(c)}</span></a></li>`).join('')}</ul>
      </div>
    </section>

    <section class="section featured" id="featured" aria-labelledby="feat-h">
      <div class="wrap">
        <h2 id="feat-h" class="h2 reveal">${esc(FEATURED_HEADING)}</h2>
        ${store.featured.length ? carouselHTML(store.featured)
          : '<p class="state-msg" role="alert">Featured equipment could not be loaded. Check data/featured_selection.json.</p>'}
      </div>
    </section>

    ${recentHTML()}

    <section class="section faqs" aria-labelledby="faq-h">
      <div class="faq-wrap"><h2 id="faq-h" class="h2 reveal">${esc(FAQ_HEADING)}</h2>${faqHTML()}</div>
    </section>

    <section class="closing-sec" aria-label="Closing message"><p class="closing reveal">${esc(CLOSING)}</p></section>
  </div>`;

  return {
    title: HERO.title,
    html,
    mount(root) {
      // Reduced motion: the supplied snippet's CSS already stops its CSS animations, but its canvas loop keeps
      // running. Without editing the supplied file, stop that loop from the parent after the first frame.
      const frame = root.querySelector('.hero-bg iframe');
      if (frame && reducedMotion()) {
        const freeze = () => { try { frame.contentWindow.requestAnimationFrame = () => 0; } catch (e) { console.warn('[hero] could not freeze canvas', e); } };
        frame.addEventListener('load', freeze, { once: true });
      }
      const stopReveal = reveal(root);
      const cf = root.querySelector('[data-cf]');
      const stopCf = cf ? initCarousel(cf, store.featured) : () => {};
      return () => { stopReveal(); stopCf(); };
    }
  };
}
