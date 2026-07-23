import React from 'react';

const statusColor = {
  running: 'text-amber-400',
  queued: 'text-white/40',
  done: 'text-brand-400',
  error: 'text-red-400',
  cancelled: 'text-white/40',
};

export default function Sidebar({ jobs, activeId, onSelect, onDelete }) {
  return (
    <aside className="card p-4 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-white text-sm">History</h3>
        <span className="chip">{jobs.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
        {jobs.length === 0 && <p className="text-xs text-white/30 py-6 text-center">No searches yet.</p>}
        {jobs.map((jb) => (
          <button
            key={jb.id}
            onClick={() => onSelect(jb.id)}
            className={`group w-full text-left p-3 rounded-xl border transition ${
              activeId === jb.id
                ? 'bg-brand-500/10 border-brand-500/40'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-white truncate">{jb.keyword}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(jb.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 text-xs px-1"
                title="Delete"
              >
                ✕
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-white/40 truncate">{jb.location || 'Any location'}</span>
              <span className={`text-[11px] font-semibold ${statusColor[jb.status] || 'text-white/40'}`}>
                {jb.count} · {jb.status}
              </span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
