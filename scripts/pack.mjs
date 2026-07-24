/**
 * Package LeadForge-AI into a runnable Windows app folder.
 *
 * Uses @electron/packager (no code-signing tooling, so it works on Windows
 * without admin / Developer Mode), then strips the root dev-only node_modules
 * and any local scrape data from the output so the bundle stays lean.
 *
 *   npm run pack        →  release/LeadForge-AI-win32-x64/LeadForge-AI.exe
 */

import packager from '@electron/packager';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
// Output outside OneDrive by default is recommended (OneDrive sync locks files
// mid-build). Override with LEADFORGE_OUT; falls back to ./release.
const OUT_DIR = process.env.LEADFORGE_OUT || path.join(ROOT, 'release');

const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const mb = (p) => {
  let total = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) walk(fp);
      else total += fs.statSync(fp).size;
    }
  };
  walk(p);
  return (total / 1024 / 1024).toFixed(0);
};

async function main() {
  console.log('▸ Packaging LeadForge-AI (win32/x64)…');
  const [appPath] = await packager({
    dir: ROOT,
    name: 'LeadForge-AI',
    platform: 'win32',
    arch: 'x64',
    out: path.join(ROOT, 'release'),
    overwrite: true,
    prune: false, // keep server/node_modules intact; we clean root below
    ignore: [
      /^[\\/]?release([\\/]|$)/,
      /^[\\/]?client[\\/](?!dist)/, // keep only the built client
      /^[\\/]?data([\\/]|$)/,
      /^[\\/]?scripts([\\/]|$)/,
      /^[\\/]?\.git([\\/]|$)/,
      /\.map$/,
    ],
  });

  // The root node_modules holds only dev tooling (electron, electron-builder,
  // typescript…) — the runtime deps live in server/node_modules. Drop it.
  const appDir = path.join(appPath, 'resources', 'app');
  rm(path.join(appDir, 'node_modules'));
  rm(path.join(appDir, 'data')); // ship without any local scrape history

  console.log(`✓ Done → ${appPath}`);
  console.log(`  Bundle size: ${mb(appPath)} MB`);
  console.log('  Run: LeadForge-AI.exe  (needs Google Chrome installed)');
}

main().catch((e) => {
  console.error('Packaging failed:', e);
  process.exit(1);
});
