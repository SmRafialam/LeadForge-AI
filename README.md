# LeadForge-AI ⚡

Keyword-driven **Google Maps lead scraper** with automatic keyword expansion,
website enrichment (emails, socials, WhatsApp), a live dashboard, and
**sheet-wise Excel export**.

Type one niche keyword → LeadForge expands it into related search queries →
scrapes every matching business on Google Maps → enriches each with contact
data → streams results into a fast, filterable table you can export.

![stack](https://img.shields.io/badge/stack-Node%20%2B%20React%20%2B%20Playwright-16b478)

---

## ✨ Features

- **Keyword expansion** — one seed keyword fans out into related niches (curated
  map + live Google autocomplete) so you never miss a variant.
- **Rich lead fields** per business:
  `name, contact name, phone, phone (intl), whatsapp, email, all emails,
  website, facebook, instagram, linkedin, rating, reviews, address,
  source query, scraped date`.
- **Website enrichment** — visits each business site + contact page to pull
  emails, social profiles and WhatsApp numbers.
- **Fast by design** — uses your installed Chrome, blocks images/fonts/media,
  runs a concurrent worker pool, smart-stops feed scrolling, and de-dupes.
- **Live dashboard** — results stream in over WebSocket with progress + logs.
- **Sheet-wise export** — `.xlsx` with one sheet per source query plus an
  "All Leads" master sheet, and one-click `.csv`.
- **Search history** — every run is saved and reloadable.

## 🧱 Architecture

```
client/   React + Vite + Tailwind dashboard
server/   Express + Socket.io API
  lib/keywords.js     keyword expansion (niche map + autocomplete)
  lib/mapsScraper.js  Playwright Google Maps scraper (feed + detail panel)
  lib/enrich.js       website → emails / socials / whatsapp / contact name
  lib/pipeline.js     orchestration + live streaming + dedupe
  lib/export.js       xlsx / csv builders
  lib/store.js        JSON persistence for jobs + leads
data/     saved jobs (git-ignored)
```

## 🚀 Getting started

```bash
# 1. Install everything (root installs server + client)
npm install

# 2. (once) install a browser for Playwright if you don't have Chrome
npm --prefix server run install-browser

# 3a. Dev mode (Vite + API with hot reload)
npm run dev
#   client → http://localhost:5173   api → http://localhost:5178

# 3b. Or production (build client, serve everything from the API)
npm run serve
#   app → http://localhost:5178
```

Then open the dashboard, enter a keyword like `dentist` and a location like
`New York`, and hit **Start Scraping**.

## ⚙️ Options (Advanced)

| Option              | Meaning                                   | Default |
| ------------------- | ----------------------------------------- | ------- |
| Related keywords    | max expanded queries per search           | 8       |
| Results / keyword   | cap of businesses scraped per query       | 60      |
| Concurrency         | parallel browser/enrichment workers       | 4       |
| Live autocomplete   | pull extra keywords from Google           | on      |
| Headless browser    | run Chrome invisibly                      | on      |

## ⚠️ Notes

- Scrapes **public business listings** for lead generation. Use responsibly and
  within Google's Terms of Service and applicable data-protection laws.
- Google occasionally changes Maps' markup; the scraper favours stable
  `data-item-id` attributes but selectors may need occasional updates.

---

Built with ❤️ — LeadForge-AI.
