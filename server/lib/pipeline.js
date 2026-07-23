/**
 * Orchestrates a full scrape job:
 *   expand keywords → scrape each query's feed → visit places (pool) →
 *   enrich websites (pool) → dedupe → stream leads live over Socket.io.
 */

import { MapsScraper, mapPool } from './mapsScraper.js';
import { enrichWebsite } from './enrich.js';
import { expandKeywords } from './keywords.js';
import { saveJob, getJob } from './store.js';

const activeJobs = new Map(); // id -> { cancelled: bool }

export function cancelJob(id) {
  const s = activeJobs.get(id);
  if (s) s.cancelled = true;
}

function dedupeKey(lead) {
  if (lead.phoneIntl) return 'p:' + lead.phoneIntl.replace(/\D/g, '');
  if (lead.website) return 'w:' + lead.website.replace(/\/+$/, '').toLowerCase();
  return 'n:' + (lead.name + '|' + lead.address).toLowerCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toWhatsApp(phoneIntl, fromSite) {
  if (fromSite) return `https://wa.me/${fromSite}`;
  if (phoneIntl && phoneIntl.startsWith('+')) return `https://wa.me/${phoneIntl.replace(/\D/g, '')}`;
  return '';
}

/**
 * Run the job. `emit(event, payload)` streams progress to the client.
 * Mutates + persists the job as it goes; returns the finished job.
 */
export async function runScrape(job, emit) {
  const state = { cancelled: false };
  activeJobs.set(job.id, state);

  const log = (msg) => {
    emit('job:log', { id: job.id, msg, ts: Date.now() });
  };

  const scraper = new MapsScraper({
    headless: job.options?.headless !== false,
    concurrency: job.options?.concurrency || 4,
    log,
  });

  const seen = new Set();
  job.status = 'running';
  job.leads = job.leads || [];
  for (const l of job.leads) seen.add(dedupeKey(l));

  try {
    log(`Expanding keyword "${job.keyword}"…`);
    const queries = await expandKeywords(job.keyword, {
      useAutocomplete: job.options?.autocomplete !== false,
      max: job.options?.maxKeywords || 8,
    });
    // Append location to each query when provided.
    const loc = (job.location || '').trim();
    job.queries = queries.map((q) => (loc ? `${q} in ${loc}` : q));
    saveJob(job);
    emit('job:meta', { id: job.id, queries: job.queries });
    log(`Searching ${job.queries.length} related queries: ${queries.join(', ')}`);

    await scraper.launch();

    let queryIndex = 0;
    for (const query of job.queries) {
      if (state.cancelled) break;
      queryIndex++;
      log(`(${queryIndex}/${job.queries.length}) Scraping feed: "${query}"`);
      emit('job:progress', { id: job.id, phase: 'feed', query, queryIndex, totalQueries: job.queries.length });

      let stubs = [];
      try {
        stubs = await scraper.searchFeed(query, { maxResults: job.options?.maxPerQuery || 120 });
      } catch (e) {
        log(`Feed error for "${query}": ${e.message}`);
        continue;
      }
      log(`Found ${stubs.length} places for "${query}". Fetching details…`);

      // Visit place pages (concurrent) → detail fields.
      let done = 0;
      const details = await mapPool(stubs, scraper.concurrency, async (stub) => {
        if (state.cancelled) return null;
        const detail = await scraper.scrapePlace(stub.placeUrl);
        done++;
        if (done % 5 === 0 || done === stubs.length) {
          emit('job:progress', {
            id: job.id,
            phase: 'places',
            query,
            done,
            total: stubs.length,
            queryIndex,
            totalQueries: job.queries.length,
          });
        }
        return { stub, detail };
      });

      // Merge stub + detail, enrich websites (concurrent), build leads.
      const merged = details.filter(Boolean).map(({ stub, detail }) => {
        const d = detail || {};
        return {
          name: d.name || stub.name,
          phoneIntl: d.phoneIntl || '',
          website: d.website || '',
          address: d.address || stub.address,
          category: d.category || stub.category,
          rating: d.rating || stub.rating,
          reviews: d.reviews || stub.reviews,
        };
      });

      let enrichDone = 0;
      const enriched = await mapPool(merged, Math.max(2, scraper.concurrency), async (m) => {
        if (state.cancelled) return m;
        const info = m.website ? await enrichWebsite(m.website) : null;
        enrichDone++;
        if (enrichDone % 5 === 0 || enrichDone === merged.length) {
          emit('job:progress', {
            id: job.id,
            phase: 'enrich',
            query,
            done: enrichDone,
            total: merged.length,
            queryIndex,
            totalQueries: job.queries.length,
          });
        }
        return { ...m, info };
      });

      for (const item of enriched) {
        if (state.cancelled) break;
        const info = item.info || {};
        const emails = info.emails || [];
        const lead = {
          id: `${job.id}-${job.leads.length + 1}`,
          name: item.name || '',
          contactName: info.contactName || '',
          phone: item.phoneIntl || '',
          phoneIntl: item.phoneIntl || '',
          whatsapp: toWhatsApp(item.phoneIntl, info.whatsapp),
          email: emails[0] || '',
          emails,
          website: item.website || '',
          facebook: info.facebook || '',
          instagram: info.instagram || '',
          linkedin: info.linkedin || '',
          rating: item.rating || '',
          reviews: item.reviews || '',
          address: item.address || '',
          category: item.category || '',
          sourceQuery: query,
          scrapedDate: today(),
        };

        const key = dedupeKey(lead);
        if (seen.has(key) || !lead.name) continue;
        seen.add(key);
        job.leads.push(lead);
        emit('job:lead', { id: job.id, lead });
      }

      saveJob(job);
    }

    job.status = state.cancelled ? 'cancelled' : 'done';
    job.finishedAt = new Date().toISOString();
    log(`Done. ${job.leads.length} unique leads collected.`);
  } catch (err) {
    job.status = 'error';
    job.error = err.message;
    log(`Job failed: ${err.message}`);
  } finally {
    await scraper.close();
    activeJobs.delete(job.id);
    saveJob(job);
    emit('job:done', { id: job.id, status: job.status, count: job.leads.length });
  }

  return getJob(job.id);
}
