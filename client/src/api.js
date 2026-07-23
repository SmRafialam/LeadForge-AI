import { io } from 'socket.io-client';

export const socket = io('/', { autoConnect: true, transports: ['websocket', 'polling'] });

const j = (r) => r.json();

export const api = {
  listJobs: () => fetch('/api/jobs').then(j),
  getJob: (id) => fetch(`/api/jobs/${id}`).then(j),
  deleteJob: (id) => fetch(`/api/jobs/${id}`, { method: 'DELETE' }).then(j),
  cancelJob: (id) => fetch(`/api/jobs/${id}/cancel`, { method: 'POST' }).then(j),
  scrape: (body) =>
    fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(j),
  exportUrl: (id, kind = 'xlsx') => `/api/jobs/${id}/export.${kind}`,
};
