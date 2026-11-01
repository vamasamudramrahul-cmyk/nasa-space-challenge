import { esc } from './util.js';
import { store } from './data.js';

const isShown = (img) => !!(img && img.src && img.verified === true);

export function placeholderHTML(rec) {
  return `<div class="media-ph" role="img" aria-label="Placeholder: NASA photograph of ${esc(rec.name)} not yet supplied">
    <span class="media-ph-title">NASA photograph pending</span>
    <span class="media-ph-note">Placeholder: no verified image URL supplied</span></div>`;
}

export function mediaHTML(rec) {
  const img = store.images[rec.id];
  if (!isShown(img)) return `<figure class="media">${placeholderHTML(rec)}</figure>`;
  const alt = img.alt || `Photograph of ${rec.name}`;
  return `<figure class="media"><img src="${esc(img.src)}" alt="${esc(alt)}" loading="lazy" decoding="async" data-media-img data-rec="${esc(rec.id)}"></figure>`;
}

/** Credit line. Source link only where it is not nested inside another link. */
export function creditHTML(rec, { link = false } = {}) {
  const img = store.images[rec.id];
  const credit = (img && img.credit) || rec.image_credit || 'NASA';
  const pending = isShown(img) ? '' : ' (photo pending)';
  const src = link && rec.image_source_page
    ? ` · <a href="${esc(rec.image_source_page)}" target="_blank" rel="noopener noreferrer">Image source<span class="sr-only"> (opens NASA page in a new tab)</span></a>`
    : '';
  return `<p class="credit">Image: ${esc(credit)}${pending}${src}</p>`;
}

/** If a verified image fails to load, swap in the placeholder and report it. Never substitute other imagery. */
export function watchImageErrors() {
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLImageElement) || !t.hasAttribute('data-media-img')) return;
    const rec = store.byId.get(t.dataset.rec);
    console.warn('[image] failed to load, showing placeholder:', t.src);
    window.__imageIssues = (window.__imageIssues || []).concat(t.src);
    if (rec) t.parentElement.innerHTML = placeholderHTML(rec);
  }, true);
}
