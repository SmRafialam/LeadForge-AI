import React, { useMemo, useState } from 'react';
import { api } from '../api';

// On-screen columns are grouped for a compact, no-horizontal-scroll view.
// (The Excel/CSV export still writes all 16 individual columns.)
const COLUMNS = [
  { key: 'name', label: 'Name', w: 'w-[15%] min-w-[140px]' },
  { key: 'phone', label: 'Phone', w: 'w-[11%] min-w-[120px]' },
  { key: 'email', label: 'Email', w: 'w-[14%] min-w-[150px]' },
  { key: 'website', label: 'Website', w: 'w-[11%] min-w-[120px]' },
  { key: 'socials', label: 'Socials', w: 'w-[8%] min-w-[92px]' },
  { key: 'contactName', label: 'Contact', w: 'w-[9%] min-w-[90px]' },
  { key: 'rating', label: 'Rating', w: 'w-[6%] min-w-[64px]' },
  { key: 'reviews', label: 'Reviews', w: 'w-[6%] min-w-[64px]' },
  { key: 'address', label: 'Address', w: 'w-[16%] min-w-[170px]' },
  { key: 'sourceQuery', label: 'Query', w: 'w-[10%] min-w-[120px]' },
  { key: 'scrapedDate', label: 'Scraped', w: 'w-[8%] min-w-[92px]' },
];

const SOCIALS = [
  ['facebook', 'FB', 'text-sky-300 bg-sky-500/10 border-sky-500/20'],
  ['instagram', 'IG', 'text-pink-300 bg-pink-500/10 border-pink-500/20'],
  ['linkedin', 'IN', 'text-blue-300 bg-blue-500/10 border-blue-500/20'],
];

export default function LeadTable({ job, leads }) {
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState('__all');

  const sheets = useMemo(() => {
    const map = new Map();
    for (const l of leads) map.set(l.sourceQuery, (map.get(l.sourceQuery) || 0) + 1);
    return [...map.entries()];
  }, [leads]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (sheet !== '__all' && l.sourceQuery !== sheet) return false;
      if (!needle) return true;
      return [l.name, l.email, l.phone, l.address, l.website, l.category, l.contactName]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [leads, q, sheet]);

  return (
    <div className="card flex flex-col min-h-0 flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="p-3 border-b border-white/5 flex flex-wrap items-center gap-2">
        <input
          className="input !py-2 max-w-[220px]"
          placeholder="Filter leads…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-xs text-white/40">
          {filtered.length} of {leads.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={job ? api.exportUrl(job.id, 'csv') : '#'}
            className={`btn-ghost !py-2 ${!job || !leads.length ? 'pointer-events-none opacity-40' : ''}`}
          >
            ⬇ CSV
          </a>
          <a
            href={job ? api.exportUrl(job.id, 'xlsx') : '#'}
            className={`btn-primary !py-2 ${!job || !leads.length ? 'pointer-events-none opacity-40' : ''}`}
          >
            ⬇ Excel (sheet-wise)
          </a>
        </div>
      </div>

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="px-3 pt-2 flex items-center gap-1.5 overflow-x-auto border-b border-white/5 pb-2">
          <Tab active={sheet === '__all'} onClick={() => setSheet('__all')} label="All" count={leads.length} />
          {sheets.map(([name, count]) => (
            <Tab key={name} active={sheet === name} onClick={() => setSheet(name)} label={name} count={count} />
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="h-full grid place-items-center text-white/30 text-sm py-16">
            No leads to show yet.
          </div>
        ) : (
          <table className="w-full table-fixed text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-ink-850">
              <tr>
                <th className="px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-white/40 border-b border-white/10 w-[34px]">
                  #
                </th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={`px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-white/40 border-b border-white/10 ${c.w}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr key={l.id} className="hover:bg-white/[0.03] border-b border-white/5 align-top">
                  <td className="px-2 py-2 text-white/25">{i + 1}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={`px-2.5 py-2 ${c.w}`}>
                      <Cell col={c.key} lead={l} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Tab({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
        active ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30' : 'text-white/50 hover:bg-white/5'
      }`}
    >
      {label} <span className="opacity-50">{count}</span>
    </button>
  );
}

function Cell({ col, lead }) {
  const v = lead[col];

  if (col === 'name')
    return <span className="font-semibold text-white block leading-snug">{v || '—'}</span>;

  // Combined phone: number + intl subtext + WhatsApp link.
  if (col === 'phone') {
    if (!lead.phone && !lead.whatsapp) return <span className="text-white/20">—</span>;
    const showIntl = lead.phoneIntl && lead.phoneIntl !== lead.phone;
    return (
      <div className="leading-tight">
        <span className="text-white/80 whitespace-nowrap">{lead.phone || lead.phoneIntl || '—'}</span>
        {showIntl && <span className="block text-[10px] text-white/35 whitespace-nowrap">{lead.phoneIntl}</span>}
        {lead.whatsapp && (
          <a
            href={lead.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="block text-[10px] text-emerald-400 hover:underline whitespace-nowrap"
          >
            WhatsApp ↗
          </a>
        )}
      </div>
    );
  }

  if (col === 'email') {
    if (!v) return <span className="text-white/20">—</span>;
    return (
      <a
        href={`mailto:${v}`}
        className="text-violet-300 hover:underline break-all leading-tight block"
        title={(lead.emails || []).join(', ')}
      >
        {v}
        {lead.emails?.length > 1 && <span className="text-white/30"> +{lead.emails.length - 1}</span>}
      </a>
    );
  }

  if (col === 'website') {
    if (!v) return <span className="text-white/20">—</span>;
    const short = v.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    return (
      <a
        href={v}
        target="_blank"
        rel="noreferrer"
        className="text-amber-300 hover:underline truncate block"
        title={v}
      >
        {short}
      </a>
    );
  }

  // Combined socials: FB / IG / IN chips in one cell.
  if (col === 'socials') {
    const links = SOCIALS.filter(([k]) => lead[k]);
    if (!links.length) return <span className="text-white/20">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {links.map(([k, lbl, cls]) => (
          <a
            key={k}
            href={lead[k]}
            target="_blank"
            rel="noreferrer"
            title={lead[k]}
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${cls} hover:opacity-80`}
          >
            {lbl}
          </a>
        ))}
      </div>
    );
  }

  if (col === 'contactName')
    return v ? <span className="text-white/70">{v}</span> : <span className="text-white/20">—</span>;

  if (col === 'rating')
    return v ? <span className="text-amber-300 font-semibold whitespace-nowrap">★ {v}</span> : <span className="text-white/20">—</span>;

  if (col === 'reviews')
    return v ? <span className="text-white/60">{v}</span> : <span className="text-white/20">—</span>;

  if (col === 'address')
    return v ? <span className="text-white/60 leading-tight block">{v}</span> : <span className="text-white/20">—</span>;

  if (col === 'sourceQuery')
    return <span className="chip !text-[10px] whitespace-normal leading-tight">{v}</span>;

  if (col === 'scrapedDate')
    return <span className="text-white/50 whitespace-nowrap">{v}</span>;

  return <span className="text-white/70">{v || <span className="text-white/20">—</span>}</span>;
}
