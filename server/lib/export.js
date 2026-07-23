/**
 * Export leads to an .xlsx workbook — "sheet wise": one sheet per source query
 * plus an "All Leads" master sheet. Columns match the dashboard exactly.
 */

import xlsx from 'xlsx';

export const COLUMNS = [
  ['name', 'Name'],
  ['contactName', 'Contact Name'],
  ['phone', 'Phone'],
  ['phoneIntl', 'Phone (Intl)'],
  ['whatsapp', 'WhatsApp'],
  ['email', 'Email'],
  ['emails', 'All Emails'],
  ['website', 'Website'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['linkedin', 'LinkedIn'],
  ['rating', 'Rating'],
  ['reviews', 'Reviews'],
  ['address', 'Address'],
  ['sourceQuery', 'Source Query'],
  ['scrapedDate', 'Scraped Date'],
];

function toRow(lead) {
  const row = {};
  for (const [key, label] of COLUMNS) {
    let val = lead[key];
    if (Array.isArray(val)) val = val.join(', ');
    row[label] = val ?? '';
  }
  return row;
}

function sheetFromLeads(leads) {
  const ws = xlsx.utils.json_to_sheet(leads.map(toRow), {
    header: COLUMNS.map(([, label]) => label),
  });
  ws['!cols'] = COLUMNS.map(([key]) => ({
    wch: key === 'address' || key === 'website' ? 34 : key === 'emails' ? 30 : 18,
  }));
  return ws;
}

// Excel sheet names: max 31 chars, no : \ / ? * [ ]
function safeSheetName(name, used) {
  let base = String(name || 'Query').replace(/[:\\/?*[\]]/g, ' ').slice(0, 28).trim() || 'Query';
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${base} ${n++}`.slice(0, 31);
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Build an xlsx Buffer with per-query sheets + an "All Leads" sheet. */
export function buildWorkbook(leads) {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, sheetFromLeads(leads), 'All Leads');

  const byQuery = new Map();
  for (const lead of leads) {
    const key = lead.sourceQuery || 'Other';
    if (!byQuery.has(key)) byQuery.set(key, []);
    byQuery.get(key).push(lead);
  }

  const used = new Set(['all leads']);
  for (const [query, group] of byQuery) {
    xlsx.utils.book_append_sheet(wb, sheetFromLeads(group), safeSheetName(query, used));
  }

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/** CSV export of the master list. */
export function buildCsv(leads) {
  const ws = sheetFromLeads(leads);
  return xlsx.utils.sheet_to_csv(ws);
}
