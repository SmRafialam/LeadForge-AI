/**
 * Auto-commit watcher.
 *
 * Watches the project (excluding node_modules / data / dist) and, whenever
 * files change, debounces for a few seconds then commits + pushes to origin.
 *
 *   node scripts/autocommit.mjs            # commit + push on change
 *   node scripts/autocommit.mjs --no-push  # commit only
 *
 * Uses only Node's built-ins so there are no extra dependencies.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUSH = !process.argv.includes('--no-push');
const DEBOUNCE_MS = 4000;
const IGNORE = /(^|[\\/])(node_modules|\.git|dist|build|data)([\\/]|$)/;

let timer = null;

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function commit() {
  try {
    const changed = sh('git status --porcelain');
    if (!changed) return;
    const files = changed.split('\n').length;
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    sh('git add -A');
    sh(`git commit -q -m "chore: auto-commit ${stamp} (${files} file${files > 1 ? 's' : ''})"`);
    console.log(`✓ committed ${files} file(s) @ ${stamp}`);
    if (PUSH) {
      sh('git push -q origin HEAD');
      console.log('  ↑ pushed to origin');
    }
  } catch (e) {
    console.error('autocommit error:', e.message.split('\n')[0]);
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(commit, DEBOUNCE_MS);
}

console.log(`\n⏱  LeadForge auto-commit watching… (push: ${PUSH ? 'on' : 'off'})\n`);

fs.watch(ROOT, { recursive: true }, (_event, filename) => {
  if (!filename || IGNORE.test(filename)) return;
  schedule();
});

// Also do an initial commit of anything currently pending.
commit();
