/**
 * Website enrichment.
 *
 * Given a business website we fetch the homepage (and a likely "contact" page)
 * and mine: emails, Facebook / Instagram / LinkedIn URLs, a WhatsApp number and
 * a best-guess contact person name. Pure HTTP fetch + regex — no browser — so
 * it is fast and runs concurrently with Maps scraping.
 */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const JUNK_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js)$/i;
const CONTACT_PATHS = ['/contact', '/contact-us', '/about', '/about-us'];

function abs(base, href) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

async function fetchText(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const ct = res.headers.get('content-type') || '';
    if (!/text|html|json/i.test(ct)) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

const ROLE_PREFIX = /^(info|contact|hello|sales|admin|support|office|mail|help|team|booking|reservations|enquiries|hi)@/;

// Strip a single stray letter accidentally glued to a role-based local part,
// e.g. "ninfo@x.com" (from concatenated markup) → "info@x.com".
function normalizeEmail(e) {
  if (ROLE_PREFIX.test(e)) return e;
  if (/^[a-z]/.test(e) && ROLE_PREFIX.test(e.slice(1))) return e.slice(1);
  return e;
}

function extractEmails(html) {
  const found = new Set();
  // Direct mailto links first (highest quality — trust the local part as-is).
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    const e = decodeURIComponent(m[1]).toLowerCase();
    if (e.includes('@')) found.add(e);
  }
  const mailtoEmails = new Set(found);
  for (const m of html.matchAll(EMAIL_RE)) {
    let e = m[0].toLowerCase();
    if (JUNK_EMAIL.test(e) || e.startsWith('u002') || e.length >= 60) continue;
    // Only clean emails that didn't come from an authoritative mailto link.
    if (!mailtoEmails.has(e)) e = normalizeEmail(e);
    found.add(e);
  }
  return [...found].filter((e) => !/example\.|sentry|wix|\.png|\.jpg/.test(e));
}

function firstMatch(html, re) {
  const m = html.match(re);
  return m ? m[0] : '';
}

function extractSocials(html, baseUrl) {
  const facebook = firstMatch(
    html,
    /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-/]+/i
  ).replace(/["'\\].*$/, '');
  const instagram = firstMatch(
    html,
    /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/]+/i
  ).replace(/["'\\].*$/, '');
  const linkedin = firstMatch(
    html,
    /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|pub)\/[A-Za-z0-9_.\-/]+/i
  ).replace(/["'\\].*$/, '');

  // WhatsApp: wa.me / api.whatsapp.com links, else a tel-style number.
  let whatsapp = '';
  const wa = html.match(/https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)([0-9]{6,15})/i);
  if (wa) whatsapp = wa[1];

  const clean = (u) => (u && !/facebook\.com\/(sharer|dialog|tr\?)/i.test(u) ? u.replace(/[).,'"]+$/, '') : '');
  return {
    facebook: clean(facebook),
    instagram: clean(instagram),
    linkedin: clean(linkedin),
    whatsapp,
  };
}

function extractContactName(html) {
  // Heuristic: look for schema.org founder/author, or "Owner:"/"Contact:" text.
  const schema = html.match(/"(?:founder|author|name)"\s*:\s*"([A-Z][a-z]+ [A-Z][a-z]+)"/);
  if (schema) return schema[1];
  const labelled = html.match(/(?:Owner|Founder|Contact|Manager|CEO)\s*[:\-]\s*([A-Z][a-z]+ [A-Z][a-z]+)/);
  if (labelled) return labelled[1];
  return '';
}

/**
 * Enrich a single website. Returns:
 * { emails: [], facebook, instagram, linkedin, whatsapp, contactName }
 */
export async function enrichWebsite(website) {
  const empty = { emails: [], facebook: '', instagram: '', linkedin: '', whatsapp: '', contactName: '' };
  if (!website || !/^https?:\/\//i.test(website)) return empty;

  const home = await fetchText(website);
  if (!home) return empty;

  let combined = home;
  // Follow one contact-ish link if present, else try common paths.
  const contactLinks = [...home.matchAll(/href=["']([^"']*contact[^"']*)["']/gi)]
    .map((m) => abs(website, m[1]))
    .filter(Boolean)
    .slice(0, 1);
  const toVisit = contactLinks.length
    ? contactLinks
    : CONTACT_PATHS.map((p) => abs(website, p)).filter(Boolean).slice(0, 1);

  for (const link of toVisit) {
    const extra = await fetchText(link);
    if (extra) combined += '\n' + extra;
  }

  const emails = extractEmails(combined).slice(0, 5);
  const socials = extractSocials(combined, website);
  const contactName = extractContactName(combined);

  return { emails, ...socials, contactName };
}
