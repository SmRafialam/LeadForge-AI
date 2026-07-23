/**
 * Google Maps scraper built on Playwright.
 *
 * Strategy (optimised for speed + reliability):
 *   1. Launch ONE browser (prefers the user's installed Chrome via channel).
 *   2. Block images/media/fonts/stylesheets so pages load in a fraction of the
 *      time — we only need the DOM text, never the pixels.
 *   3. For each query, open the Maps search feed and scroll until the result
 *      list stops growing, collecting every place link + card basics.
 *   4. Visit each place page concurrently (worker pool) and read the DETAIL
 *      panel, whose `data-item-id` attributes are stable across Google's
 *      frequent class-name churn (phone / website / address live there).
 */

import { chromium } from 'playwright';

const BLOCKED_TYPES = new Set(['image', 'media', 'font']);

export class MapsScraper {
  constructor({ headless = true, concurrency = 4, log = () => {} } = {}) {
    this.headless = headless;
    this.concurrency = Math.max(1, concurrency);
    this.log = log;
    this.browser = null;
    this.context = null;
  }

  async launch() {
    if (this.browser) return;
    const launchOpts = {
      headless: this.headless,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    };
    // Prefer the user's installed Chrome ("shuru koro amar chrome e"); fall
    // back to Playwright's bundled Chromium if Chrome isn't present.
    try {
      this.browser = await chromium.launch({ ...launchOpts, channel: 'chrome' });
      this.log('Launched Google Chrome');
    } catch {
      this.browser = await chromium.launch(launchOpts);
      this.log('Chrome not found — using bundled Chromium');
    }

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    });

    // Block heavy resources to keep scraping fast.
    await this.context.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (BLOCKED_TYPES.has(type)) return route.abort();
      const url = route.request().url();
      if (/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|mp4)(\?|$)/i.test(url)) return route.abort();
      return route.continue();
    });
  }

  async close() {
    try {
      await this.context?.close();
    } catch {}
    try {
      await this.browser?.close();
    } catch {}
    this.browser = null;
    this.context = null;
  }

  async newPage() {
    const page = await this.context.newPage();
    page.setDefaultTimeout(30000);
    return page;
  }

  /** Dismiss Google's cookie/consent interstitial if it appears. */
  async dismissConsent(page) {
    if (!/consent\.google|\/sorry\//i.test(page.url())) return;
    const buttons = [
      'button:has-text("Accept all")',
      'button:has-text("Reject all")',
      'button[aria-label="Accept all"]',
      'form[action*="consent"] button',
    ];
    for (const sel of buttons) {
      const el = page.locator(sel).first();
      if (await el.count().catch(() => 0)) {
        await el.click().catch(() => {});
        await page.waitForTimeout(800);
        break;
      }
    }
  }

  /**
   * Search a single query and return raw place stubs collected from the feed.
   * Each stub: { name, placeUrl, rating, reviews, category, address }
   */
  async searchFeed(query, { maxResults = 120 } = {}) {
    const page = await this.newPage();
    try {
      const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await this.dismissConsent(page);

      // Two possible outcomes: a results feed, or a single place page.
      const feed = page.locator('div[role="feed"]');
      const singlePlace = page.locator('h1.DUwDvf');
      await Promise.race([
        feed.first().waitFor({ timeout: 15000 }).catch(() => {}),
        singlePlace.first().waitFor({ timeout: 15000 }).catch(() => {}),
      ]);

      if ((await feed.count().catch(() => 0)) === 0) {
        // Single-result redirect: the current URL is the place itself.
        return [{ name: '', placeUrl: page.url(), rating: '', reviews: '', category: '', address: '' }];
      }

      // Scroll the feed until it stops growing or we hit the cap.
      let lastCount = 0;
      let stableRounds = 0;
      for (let i = 0; i < 60; i++) {
        const stubs = await this._extractFeed(page);
        if (stubs.length >= maxResults) break;
        if (stubs.length === lastCount) {
          stableRounds++;
          // "You've reached the end of the list." → stop.
          const ended = await page
            .locator('span:has-text("reached the end")')
            .count()
            .catch(() => 0);
          if (ended || stableRounds >= 3) break;
        } else {
          stableRounds = 0;
        }
        lastCount = stubs.length;
        await page.evaluate(() => {
          const f = document.querySelector('div[role="feed"]');
          if (f) f.scrollTo(0, f.scrollHeight);
        });
        await page.waitForTimeout(1100);
      }

      const stubs = await this._extractFeed(page);
      return stubs.slice(0, maxResults);
    } finally {
      await page.close().catch(() => {});
    }
  }

  /** Pull place stubs out of the current feed DOM. */
  async _extractFeed(page) {
    return page.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const cards = Array.from(document.querySelectorAll('div[role="feed"] > div')).filter((d) =>
        d.querySelector('a.hfpxzc')
      );
      const out = [];
      for (const card of cards) {
        const link = card.querySelector('a.hfpxzc');
        if (!link) continue;
        const placeUrl = link.href;
        const name = clean(link.getAttribute('aria-label'));
        const ratingEl = card.querySelector('span.MW4etd');
        const reviewsEl = card.querySelector('span.UY7F9');
        const rating = clean(ratingEl?.textContent);
        const reviews = clean(reviewsEl?.textContent).replace(/[()]/g, '');
        // Category + address live in the small info rows.
        const infoRows = Array.from(card.querySelectorAll('.W4Efsd')).map((e) => clean(e.textContent));
        let category = '';
        let address = '';
        if (infoRows.length) {
          const parts = infoRows.join(' · ').split('·').map((p) => clean(p)).filter(Boolean);
          category = parts[0] || '';
          address = parts.find((p) => /\d/.test(p) && p !== category) || '';
        }
        out.push({ name, placeUrl, rating, reviews, category, address });
      }
      return out;
    });
  }

  /**
   * Open a place page and read authoritative detail fields from the panel.
   * Returns { name, phoneIntl, website, address, category, rating, reviews }
   */
  async scrapePlace(placeUrl) {
    const page = await this.newPage();
    try {
      await page.goto(placeUrl, { waitUntil: 'domcontentloaded' });
      await this.dismissConsent(page);
      await page.locator('h1.DUwDvf').first().waitFor({ timeout: 15000 }).catch(() => {});

      return await page.evaluate(() => {
        const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const q = (sel) => document.querySelector(sel);

        const name = clean(q('h1.DUwDvf')?.textContent);

        // Phone: the data-item-id encodes the number, e.g. phone:tel:+12025550143
        let phoneIntl = '';
        const phoneBtn = q('button[data-item-id^="phone:tel:"]');
        if (phoneBtn) {
          phoneIntl = clean(phoneBtn.getAttribute('data-item-id').replace('phone:tel:', ''));
        }

        // Website: the authority link.
        let website = '';
        const siteLink = q('a[data-item-id="authority"]');
        if (siteLink) website = siteLink.href;

        // Address.
        let address = '';
        const addrBtn = q('button[data-item-id="address"]');
        if (addrBtn) {
          address = clean(addrBtn.getAttribute('aria-label') || addrBtn.textContent).replace(/^Address:\s*/i, '');
        }

        // Category.
        let category = '';
        const catBtn = q('button[jsaction*="category"]');
        if (catBtn) category = clean(catBtn.textContent);

        // Rating + reviews.
        let rating = '';
        let reviews = '';
        const rnice = q('div.F7nice');
        if (rnice) {
          const m = clean(rnice.textContent).match(/([\d.]+)\s*\(?([\d,]+)?/);
          if (m) {
            rating = m[1] || '';
            reviews = (m[2] || '').replace(/,/g, '');
          }
        }

        return { name, phoneIntl, website, address, category, rating, reviews };
      });
    } catch {
      return null;
    } finally {
      await page.close().catch(() => {});
    }
  }
}

/** Run `fn` over `items` with a bounded worker pool, preserving order. */
export async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) break;
      try {
        results[i] = await fn(items[i], i);
      } catch {
        results[i] = null;
      }
    }
  });
  await Promise.all(workers);
  return results;
}
