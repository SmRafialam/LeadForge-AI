/**
 * Tiny JSON-file persistence for jobs + leads. No native deps, no DB server —
 * plenty for lead volumes in the thousands and trivial to back up / inspect.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In the desktop build the Electron main process points this at a writable
// per-user folder (app.getPath('userData')); otherwise fall back to ./data.
const DATA_DIR = process.env.LEADFORGE_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(JOBS_FILE)) fs.writeFileSync(JOBS_FILE, '[]');
}

function readJobs() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeJobs(jobs) {
  ensure();
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

export function listJobs() {
  // Return metadata only (no heavy leads array) for the sidebar.
  return readJobs()
    .map(({ leads, ...meta }) => ({ ...meta, count: leads?.length || 0 }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getJob(id) {
  return readJobs().find((j) => j.id === id) || null;
}

export function saveJob(job) {
  const jobs = readJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) jobs[idx] = job;
  else jobs.push(job);
  writeJobs(jobs);
  return job;
}

export function deleteJob(id) {
  writeJobs(readJobs().filter((j) => j.id !== id));
}
