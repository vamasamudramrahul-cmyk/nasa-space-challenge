import { esc } from './util.js';
import { store } from './data.js';

// Featured photographs come straight from each record's `carousel_image` (direct NASA/JPL URL + credit + source page + note).
// Nothing is substituted: if a photo cannot load, a neutral placeholder is shown and the failure is recorded.
export const imageOf = (rec) => (rec && rec.carousel_image && rec.carousel_image.url ? rec.carousel_image : null);
// Two Mars rover records are engineering-testbed photographs. Detected from the supplied image_note, never assumed.
export const isTestbed = (rec) => /testbed|engineering test/i.test((imageOf(rec) || {}).image_note || '');
export const TESTBED_LABEL = 'Engineering testbed photograph, not taken on Mars';

export function placeholderHTML(rec) {
  return `<div class="media-ph" role="img" aria-label="Placeholder: NASA photograph of ${esc(rec.name)} could not be loaded">
    <span class="media-ph-title">NASA photograph unavailable</span>
    <span class="media-ph-note">The image could not be loaded</span></div>`;
}

export function mediaHTML(rec, { eager = false } = {}) {
  const img = imageOf(rec);
  if (!img) return `<figure class="media">${placeholderHTML(rec)}</figure>`;
  const alt = img.alt || `NASA photograph of ${rec.name}`;
  return `<figure class="media is-loading"><img src="${esc(img.url)}" alt="${esc(alt)}" ${eager ? '' : 'loading="lazy" '}decoding="async" referrerpolicy="no-referrer" data-media-img data-rec="${esc(rec.id)}"></figure>`;
}

/** Credit line. Source link only where it is not nested inside another link. */
export function creditHTML(rec, { link = false } = {}) {
  const img = imageOf(rec);
  const credit = (img && img.credit) || rec.image_credit || 'NASA';
  const page = (img && img.source_page) || rec.image_source_page;
  const src = link && page
    ? ` · <a href="${esc(page)}" target="_blank" rel="noopener noreferrer">Image source<span class="sr-only"> (opens NASA page in a new tab)</span></a>`
    : '';
  const tb = isTestbed(rec) ? `<span class="testbed">${esc(TESTBED_LABEL)}</span>` : '';
  return `<p class="credit">Image: ${esc(credit)}${src}${tb}</p>`;
}

/** If a photo fails to load, swap in the placeholder and report it. Never substitute other imagery. */
export function watchImageErrors() {
  document.addEventListener('load', (e) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.hasAttribute('data-media-img')) t.parentElement.classList.remove('is-loading');
  }, true);
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLImageElement) || !t.hasAttribute('data-media-img')) return;
    const rec = store.byId.get(t.dataset.rec);
    console.warn('[image] failed to load, showing placeholder:', t.src);
    window.__imageIssues = (window.__imageIssues || []).concat(t.src);
    if (rec) { t.parentElement.classList.remove('is-loading'); t.parentElement.innerHTML = placeholderHTML(rec); }
  }, true);
}
