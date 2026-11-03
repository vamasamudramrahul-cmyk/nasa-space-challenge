// Loads data files and validates the featured selection against the equipment records.

const FILES = {
  equipment: 'data/featured_equipment.json',
  selection: 'data/featured_selection.json',
  categories: 'data/equipment_category_illustrations.json',
  updates: 'data/updates.json',
  faqs: 'data/faqs.json'
};

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

export const store = { records: [], byId: new Map(), featured: [], categoryArt: new Map(), updates: [], faqs: [], issues: [] };

export async function loadData() {
  const [eq, sel, cats, upd, faq] = await Promise.all(Object.values(FILES).map(getJSON));
  const issues = [];

  const records = Array.isArray(eq.records) ? eq.records : [];
  const byId = new Map();
  for (const r of records) {
    if (!r.id || !r.name) { issues.push('Equipment record missing id or name'); continue; }
    if (byId.has(r.id)) { issues.push(`Duplicate equipment id: ${r.id}`); continue; }
    byId.set(r.id, r);
  }

  const seen = new Set();
  const featured = [];
  for (const id of sel.featured_ids || []) {
    if (seen.has(id)) { issues.push(`Featured id listed twice: ${id}`); continue; }
    seen.add(id);
    const rec = byId.get(id);
    if (!rec) { issues.push(`Featured id not found in equipment records: ${id}`); continue; }
    if (!rec.carousel_image || !rec.carousel_image.url) issues.push(`Featured record has no carousel_image.url: ${id}`);
    featured.push(rec);
  }
  const expected = sel.expected_count ?? 6;
  if (featured.length !== expected) issues.push(`Expected ${expected} featured records, found ${featured.length}`);
  issues.forEach((m) => console.warn('[featured data]', m));

  Object.assign(store, {
    records, byId, featured, issues,
    categoryArt: new Map((cats.categories || []).map((c) => [c.name, { src: 'assets/' + c.image, alt: c.alt }])),
    updates: [...(upd.updates || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    faqs: faq.faqs || []
  });
  return store;
}
