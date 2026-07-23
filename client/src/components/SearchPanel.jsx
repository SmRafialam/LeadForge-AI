import React, { useState } from 'react';

const DEFAULTS = {
  maxKeywords: 8,
  maxPerQuery: 60,
  concurrency: 4,
  autocomplete: true,
  headless: true,
};

export default function SearchPanel({ onStart, running }) {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState(DEFAULTS);

  const set = (k, v) => setOpts((o) => ({ ...o, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!keyword.trim() || running) return;
    onStart({ keyword: keyword.trim(), location: location.trim(), options: opts });
  };

  return (
    <form onSubmit={submit} className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-xl bg-brand-500/15 grid place-items-center text-brand-400 text-lg">⚡</div>
        <div>
          <h2 className="font-bold text-white leading-tight">New Lead Search</h2>
          <p className="text-xs text-white/40">Keyword → related niches → Maps → enriched leads</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-white/50 mb-1 block">Niche / Keyword</label>
          <input
            className="input"
            placeholder="e.g. dentist, marketing agency, gym"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/50 mb-1 block">Location (optional)</label>
          <input
            className="input"
            placeholder="e.g. New York, Dhaka, London"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-xs font-semibold text-brand-400 hover:text-brand-300"
      >
        {open ? '▾ Hide advanced' : '▸ Advanced options'}
      </button>

      {open && (
        <div className="mt-3 p-3 rounded-xl bg-black/20 border border-white/5 space-y-3">
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Keywords" hint="max queries">
              <input
                type="number"
                min="1"
                max="15"
                className="input !px-2.5 text-center"
                value={opts.maxKeywords}
                onChange={(e) => set('maxKeywords', +e.target.value)}
              />
            </Field>
            <Field label="Per query" hint="result cap">
              <input
                type="number"
                min="5"
                max="300"
                className="input !px-2.5 text-center"
                value={opts.maxPerQuery}
                onChange={(e) => set('maxPerQuery', +e.target.value)}
              />
            </Field>
            <Field label="Workers" hint="parallel">
              <input
                type="number"
                min="1"
                max="10"
                className="input !px-2.5 text-center"
                value={opts.concurrency}
                onChange={(e) => set('concurrency', +e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Toggle label="Live autocomplete" value={opts.autocomplete} onChange={(v) => set('autocomplete', v)} />
            <Toggle label="Headless browser" value={opts.headless} onChange={(v) => set('headless', v)} />
          </div>
        </div>
      )}

      <button type="submit" disabled={running || !keyword.trim()} className="btn-primary mt-4 w-full justify-center">
        {running ? 'Scraping…' : 'Start Scraping'}
      </button>
    </form>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs font-semibold text-white/60 leading-tight truncate">{label}</span>
      <span className="block text-[10px] text-white/30 leading-tight mb-1.5 truncate">{hint}</span>
      {children}
    </label>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-ink-900/60 border border-white/10 cursor-pointer">
      <span className="text-xs font-semibold text-white/60">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition ${value ? 'bg-brand-500' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${value ? 'left-4' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
}
