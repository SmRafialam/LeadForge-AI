/**
 * Electron main process for the LeadForge-AI desktop app.
 *
 * Starts the Express + Socket.io server in-process on a free port, then opens
 * a native window pointing at it. The whole app (UI + scraper) runs locally —
 * no cloud, no install steps for the end user beyond launching the .exe.
 */

import { app, BrowserWindow, shell, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer } from '../server/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Single-instance lock so double-launching just focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let serverPort = null;

async function ensureServer() {
  if (serverPort) return serverPort;
  // Persist scraped data in a writable per-user folder so the app works even
  // when installed to a read-only location (e.g. Program Files).
  process.env.LEADFORGE_DATA_DIR = path.join(app.getPath('userData'), 'data');
  const { port } = await startServer(0); // 0 → OS picks a free port
  serverPort = port;
  return port;
}

async function createWindow() {
  let port;
  try {
    port = await ensureServer();
  } catch (err) {
    dialog.showErrorBox('LeadForge-AI', `Failed to start the local engine:\n\n${err.message}`);
    app.quit();
    return;
  }

  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#0a0f14',
    title: 'LeadForge-AI',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Open external links (websites, socials, mailto, WhatsApp) in the user's
  // real default browser instead of inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(`http://localhost:${port}`);
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
