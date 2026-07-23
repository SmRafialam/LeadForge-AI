import React, { useEffect, useRef } from 'react';

const phaseLabel = {
  feed: 'Reading map results',
  places: 'Fetching business details',
  enrich: 'Enriching websites',
};

export default function ProgressPanel({ progress, logs, running, onCancel }) {
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  if (!running && logs.length === 0) return null;

  const pct =
    progress?.total > 0 ? Math.round((progress.done / progress.total) * 100) : running ? null : 100;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {running && <span className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-pulse" />}
          <span className="text-sm font-semibold text-white">
            {running ? phaseLabel[progress?.phase] || 'Working…' : 'Finished'}
          </span>
          {progress?.query && <span className="chip max-w-[240px] truncate">{progress.query}</span>}
        </div>
        {running && (
          <button onClick={onCancel} className="btn-ghost !py-1 !px-3 text-xs">
            Stop
          </button>
        )}
      </div>

      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full bg-brand-500 transition-all duration-300 ${pct === null ? 'animate-pulse w-1/3' : ''}`}
          style={pct === null ? {} : { width: `${pct}%` }}
        />
      </div>
      {progress?.totalQueries > 0 && (
        <p className="text-[11px] text-white/40 mt-1.5">
          Query {progress.queryIndex}/{progress.totalQueries}
          {progress.total ? ` · ${progress.done}/${progress.total} items` : ''}
        </p>
      )}

      <div
        ref={logRef}
        className="mt-3 h-24 overflow-y-auto rounded-lg bg-black/30 border border-white/5 p-2 font-mono text-[11px] leading-relaxed text-white/50 space-y-0.5"
      >
        {logs.map((l, i) => (
          <div key={i}>
            <span className="text-white/25">›</span> {l}
          </div>
        ))}
      </div>
    </div>
  );
}
