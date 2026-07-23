import React, { useMemo, useState } from 'react';
import { api } from '../api';

const COLUMNS = [
  { key: 'name', label: 'Name', w: 'min-w-[180px]' },
  { key: 'contactName', label: 'Contact', w: 'min-w-[120px]' },
  { key: 'phone', label: 'Phone', w: 'min-w-[130px]' },
  { key: 'phoneIntl', label: 'Phone (Intl)', w: 'min-w-[130px]' },
  { key: 'whatsapp', label: 'WhatsApp', w: 'min-w-[110px]' },
  { key: 'email', label: 'Email', w: 'min-w-[200px]' },
  { key: 'website', label: 'Website', w: 'min-w-[160px]' },
  { key: 'facebook', label: 'Facebook', w: 'min-w-[110px]' },
  { key: 'instagram', label: 'Instagram', w: 'min-w-[110px]' },
  { key: 'linkedin', label: 'LinkedIn', w: 'min-w-[110px]' },
  { key: 'rating', label: 'Rating', w: 'min-w-[70px]' },
  { key: 'reviews', label: 'Reviews', w: 'min-w-[80px]' },
  { key: 'address', label: 'Address', w: 'min-w-[240px]' },
  { key: 'sourceQuery', label: 'Source Query', w: 'min-w-[160px]' },
  { key: 'scrapedDate', label: 'Scraped', w: 'min-w-[110px]' },
];

const LINK_ICON = { facebook: 'FB', instagram: 'IG', linkedin: 'IN' };

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
    <div className="card flex flex-col min-h-0 flex-1">
      {/* Toolbar */}
      <div className="p-3 border-b border-white/5 flex flex-wrap items-center gap-2">
        <input
          className="input !py-2 max-w-[260px]"
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
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-ink-850">
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white/40 border-b border-white/10">
                  #
                </th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-white/40 border-b border-white/10 whitespace-nowrap ${c.w}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr key={l.id} className="hover:bg-white/[0.03] border-b border-white/5">
                  <td className="px-3 py-2 text-white/30 text-xs">{i + 1}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={`px-3 py-2 align-top ${c.w}`}>
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

  if (col === 'name') return <span className="font-semibold text-white">{v || '—'}</span>;

  if (col === 'whatsapp' && v)
    return (
      <a href={v} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
        Chat
      </a>
    );

  if (col === 'email' && v)
    return (
      <a href={`mailto:${v}`} className="text-violet-300 hover:underline break-all" title={(lead.emails || []).join(', ')}>
        {v}
        {lead.emails?.length > 1 && <span className="text-white/30"> +{lead.emails.length - 1}</span>}
      </a>
    );

  if (col === 'website' && v)
    return (
      <a href={v} target="_blank" rel="noreferrer" className="text-amber-300 hover:underline break-all">
        {v.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 28)}
      </a>
    );

  if (['facebook', 'instagram', 'linkedin'].includes(col))
    return v ? (
      <a
        href={v}
        target="_blank"
        rel="noreferrer"
        className="chip !text-pink-300 hover:!text-pink-200 !bg-pink-500/10 !border-pink-500/20"
      >
        {LINK_ICON[col]}
      </a>
    ) : (
      <span className="text-white/20">—</span>
    );

  if (col === 'rating' && v)
    return (
      <span className="text-amber-300 font-semibold">
        ★ {v}
      </span>
    );

  if (col === 'address') return <span className="text-white/60 text-xs">{v || '—'}</span>;
  if (col === 'sourceQuery') return <span className="chip">{v}</span>;

  return <span className="text-white/70">{v || <span className="text-white/20">—</span>}</span>;
}
