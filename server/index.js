/**
 * LeadForge-AI server — REST API + Socket.io live streaming, and (in
 * production) serves the built React dashboard.
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server as SocketServer } from 'socket.io';

import { runScrape, cancelJob } from './lib/pipeline.js';
import { listJobs, getJob, saveJob, deleteJob } from './lib/store.js';
import { buildWorkbook, buildCsv } from './lib/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5178;

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: '*' } });

const emit = (event, payload) => io.emit(event, payload);

let idCounter = Date.now();
const newId = () => (idCounter++).toString(36);

// --- REST API -------------------------------------------------------------

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/api/jobs', (_req, res) => res.json(listJobs()));

app.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job);
});

app.delete('/api/jobs/:id', (req, res) => {
  deleteJob(req.params.id);
  res.json({ ok: true });
});

app.post('/api/jobs/:id/cancel', (req, res) => {
  cancelJob(req.params.id);
  res.json({ ok: true });
});

app.post('/api/scrape', (req, res) => {
  const { keyword, location, options } = req.body || {};
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: 'keyword is required' });
  }
  const job = {
    id: newId(),
    keyword: keyword.trim(),
    location: (location || '').trim(),
    options: options || {},
    status: 'queued',
    queries: [],
    leads: [],
    createdAt: new Date().toISOString(),
  };
  saveJob(job);
  // Fire-and-forget; progress streams over Socket.io.
  runScrape(job, emit).catch((e) => console.error('runScrape crashed:', e));
  res.status(202).json({ id: job.id, status: job.status });
});

// --- Exports --------------------------------------------------------------

app.get('/api/jobs/:id/export.xlsx', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  const buf = buildWorkbook(job.leads || []);
  const fname = `leadforge-${job.keyword.replace(/\W+/g, '_')}-${job.id}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

app.get('/api/jobs/:id/export.csv', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  const csv = buildCsv(job.leads || []);
  res.setHeader('Content-Disposition', `attachment; filename="leadforge-${job.id}.csv"`);
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// --- Serve built client in production ------------------------------------

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

io.on('connection', (socket) => {
  socket.emit('hello', { ok: true });
});

server.listen(PORT, () => {
  console.log(`\n  LeadForge-AI server → http://localhost:${PORT}\n`);
});
