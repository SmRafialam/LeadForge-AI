/**
 * Keyword expansion for niche-based lead scraping.
 *
 * Given a seed keyword (e.g. "dentist") we build a set of related search
 * queries so that a single search pulls in every close variant. Expansion is
 * done two ways and merged:
 *   1. A curated niche map (fast, offline, high precision for common niches).
 *   2. Google Maps autocomplete suggestions (live, catches long-tail terms).
 *
 * The result is intentionally de-duplicated and capped so a search stays fast.
 */

// Curated related-term map for common lead-gen niches. Keys are matched by
// substring against the seed keyword (case-insensitive).
const NICHE_MAP = {
  dentist: ['dentist', 'dental clinic', 'orthodontist', 'dental care', 'cosmetic dentist', 'pediatric dentist'],
  doctor: ['doctor', 'clinic', 'medical center', 'physician', 'family doctor', 'health clinic'],
  restaurant: ['restaurant', 'cafe', 'diner', 'bistro', 'eatery', 'food court'],
  gym: ['gym', 'fitness center', 'fitness studio', 'crossfit box', 'personal trainer', 'yoga studio'],
  salon: ['salon', 'hair salon', 'beauty salon', 'barber shop', 'nail salon', 'spa'],
  lawyer: ['lawyer', 'law firm', 'attorney', 'legal services', 'solicitor'],
  plumber: ['plumber', 'plumbing service', 'plumbing contractor', 'emergency plumber'],
  electrician: ['electrician', 'electrical contractor', 'electrical services'],
  realestate: ['real estate agency', 'realtor', 'property dealer', 'real estate agent', 'property management'],
  'real estate': ['real estate agency', 'realtor', 'property dealer', 'real estate agent', 'property management'],
  hotel: ['hotel', 'motel', 'guest house', 'resort', 'inn', 'lodge'],
  cafe: ['cafe', 'coffee shop', 'coffee house', 'espresso bar'],
  contractor: ['contractor', 'general contractor', 'construction company', 'builder', 'remodeling'],
  photographer: ['photographer', 'photography studio', 'wedding photographer', 'portrait studio'],
  accountant: ['accountant', 'accounting firm', 'bookkeeping service', 'tax consultant', 'cpa'],
  marketing: ['marketing agency', 'digital marketing agency', 'advertising agency', 'seo agency', 'social media agency'],
  agency: ['agency', 'digital agency', 'creative agency', 'marketing agency'],
  clinic: ['clinic', 'medical clinic', 'health clinic', 'polyclinic'],
  pharmacy: ['pharmacy', 'drugstore', 'chemist', 'medical store'],
  mechanic: ['mechanic', 'auto repair', 'car service', 'garage', 'auto workshop'],
  spa: ['spa', 'day spa', 'massage center', 'wellness center', 'beauty spa'],
  bakery: ['bakery', 'pastry shop', 'cake shop', 'confectionery'],
  boutique: ['boutique', 'clothing store', 'fashion boutique', 'apparel store'],
  school: ['school', 'academy', 'coaching center', 'tutoring center', 'training institute'],
  it: ['it company', 'software company', 'web development company', 'it services', 'software agency'],
  software: ['software company', 'software development company', 'it company', 'saas company'],
};

// Light suffix variations applied to any seed when we don't have a niche match.
const GENERIC_VARIANTS = ['', ' company', ' service', ' services', ' near me', ' agency'];

function normalize(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const k = normalize(raw).toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(normalize(raw));
  }
  return out;
}

/**
 * Build the offline related-keyword set from the curated niche map.
 */
export function expandKeywordOffline(seed) {
  const s = normalize(seed).toLowerCase();
  const buckets = [];
  for (const key of Object.keys(NICHE_MAP)) {
    if (s.includes(key)) buckets.push(...NICHE_MAP[key]);
  }
  if (buckets.length === 0) {
    // No known niche — fall back to generic variants of the seed.
    for (const v of GENERIC_VARIANTS) buckets.push(`${normalize(seed)}${v}`);
  } else {
    // Always keep the original seed too.
    buckets.unshift(normalize(seed));
  }
  return dedupe(buckets);
}

/**
 * Query Google Maps autocomplete for live suggestions. Best-effort; returns []
 * on any failure so scraping is never blocked by suggestion lookups.
 */
export async function fetchAutocomplete(seed) {
  try {
    const url =
      'https://www.google.com/complete/search?client=gws-wiz-local&hl=en&q=' +
      encodeURIComponent(normalize(seed));
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    const text = await res.text();
    // Response is JSONP-ish; pull quoted suggestion strings heuristically.
    const matches = [...text.matchAll(/"((?:[^"\\]|\\.){2,60})"/g)]
      .map((m) => m[1])
      .filter((t) => /^[a-z0-9 &'-]+$/i.test(t) && t.split(' ').length <= 5);
    return dedupe(matches).slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * Full expansion: curated niche terms + (optionally) live autocomplete,
 * capped to `max` queries to keep the scrape fast.
 */
export async function expandKeywords(seed, { useAutocomplete = true, max = 8 } = {}) {
  const offline = expandKeywordOffline(seed);
  let live = [];
  if (useAutocomplete) {
    live = await fetchAutocomplete(seed);
  }
  return dedupe([...offline, ...live]).slice(0, Math.max(1, max));
}
