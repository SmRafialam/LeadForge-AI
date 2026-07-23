import React, { useEffect, useRef, useState } from 'react';
import { api, socket } from './api';
import SearchPanel from './components/SearchPanel.jsx';
import Sidebar from './components/Sidebar.jsx';
import StatCards from './components/StatCards.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';
import LeadTable from './components/LeadTable.jsx';

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [leads, setLeads] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [logs, setLogs] = useState([]);
  const activeIdRef = useRef(null);

  const refreshJobs = () => api.listJobs().then(setJobs).catch(() => {});

  useEffect(() => {
    refreshJobs();
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Socket wiring — only react to events for the currently open job.
  useEffect(() => {
    const onLead = ({ id, lead }) => {
      if (id !== activeIdRef.current) return;
      setLeads((prev) => [...prev, lead]);
    };
    const onLog = ({ id, msg }) => {
      if (id !== activeIdRef.current) return;
      setLogs((prev) => [...prev.slice(-200), msg]);
    };
    const onProgress = (p) => {
      if (p.id !== activeIdRef.current) return;
      setProgress(p);
    };
    const onMeta = ({ id, queries }) => {
      if (id !== activeIdRef.current) return;
      setActiveJob((j) => (j ? { ...j, queries } : j));
    };
    const onDone = ({ id, status }) => {
      refreshJobs();
      if (id !== activeIdRef.current) return;
      setRunning(false);
      setProgress(null);
      setActiveJob((j) => (j ? { ...j, status } : j));
    };

    socket.on('job:lead', onLead);
    socket.on('job:log', onLog);
    socket.on('job:progress', onProgress);
    socket.on('job:meta', onMeta);
    socket.on('job:done', onDone);
    return () => {
      socket.off('job:lead', onLead);
      socket.off('job:log', onLog);
      socket.off('job:progress', onProgress);
      socket.off('job:meta', onMeta);
      socket.off('job:done', onDone);
    };
  }, []);

  const startScrape = async (body) => {
    setLeads([]);
    setLogs([]);
    setProgress(null);
    setRunning(true);
    try {
      const { id } = await api.scrape(body);
      setActiveId(id);
      setActiveJob({ id, keyword: body.keyword, location: body.location, status: 'running', queries: [] });
      refreshJobs();
    } catch {
      setRunning(false);
    }
  };

  const selectJob = async (id) => {
    setActiveId(id);
    setLogs([]);
    setProgress(null);
    const job = await api.getJob(id);
    setActiveJob(job);
    setLeads(job.leads || []);
    setRunning(job.status === 'running' || job.status === 'queued');
  };

  const deleteJob = async (id) => {
    await api.deleteJob(id);
    if (id === activeId) {
      setActiveId(null);
      setActiveJob(null);
      setLeads([]);
    }
    refreshJobs();
  };

  const cancel = () => activeId && api.cancelJob(activeId);

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <header className="px-5 py-3 flex items-center gap-3 border-b border-white/5 bg-ink-900/60 backdrop-blur">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center text-ink-900 font-black text-lg">
          L
        </div>
        <div>
          <h1 className="font-extrabold text-white leading-none tracking-tight">
            LeadForge<span className="text-brand-400">-AI</span>
          </h1>
          <p className="text-[11px] text-white/40">Keyword-driven Google Maps lead scraper</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeJob?.queries?.length > 0 && (
            <span className="chip hidden md:inline-flex">{activeJob.queries.length} related queries</span>
          )}
          <span className="chip">{leads.length} leads</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 p-4">
        {/* Left column */}
        <div className="flex flex-col gap-4 min-h-0">
          <SearchPanel onStart={startScrape} running={running} />
          <Sidebar jobs={jobs} activeId={activeId} onSelect={selectJob} onDelete={deleteJob} />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 min-h-0 min-w-0">
          <StatCards leads={leads} />
          <ProgressPanel progress={progress} logs={logs} running={running} onCancel={cancel} />
          {activeJob || leads.length ? (
            <LeadTable job={activeJob} leads={leads} />
          ) : (
            <div className="card flex-1 grid place-items-center text-center p-10">
              <div>
                <div className="text-5xl mb-3">🧲</div>
                <h3 className="font-bold text-white text-lg">Start your first lead search</h3>
                <p className="text-white/40 text-sm mt-1 max-w-sm">
                  Enter a niche keyword (and optional location). LeadForge expands it into related
                  queries, scrapes Google Maps, and enriches each business with emails & socials.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
