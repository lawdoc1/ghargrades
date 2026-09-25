// projects.js — the launch dataset loader (K-RERA). One reader, used by the
// page, the free lookup, the report and the Decision Agent. Later this reads the DB table
// that the K-RERA crawler fills; the JSON keeps the same shape so nothing else changes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scoreProject, timelineFacts } from './score.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dir, '..', 'data', 'bangalore-projects.json');   // records live in /data

let cache = null;
export function loadDataset() {
  if (!cache) cache = JSON.parse(readFileSync(FILE, 'utf8'));
  return cache;
}
export function listProjects() {
  return loadDataset().projects.map(p => ({ slug: p.slug, name: p.name, rera_no: p.rera_no, locality: p.locality, corridor: p.corridor }));
}
export function getProject(slug) {
  return loadDataset().projects.find(p => p.slug === String(slug || '').toLowerCase()) || null;
}
export function getSources() { return loadDataset().sources; }
export function getCaptured() { return loadDataset().captured; }

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Free lookup: match on name or K-RERA number, loosely. Returns the project or null.
export function findProject(q) {
  const n = norm(q); if (n.length < 3) return null;
  const ps = loadDataset().projects;
  const byRera = ps.find(p => norm(p.rera_no) === n || norm(p.rera_no).endsWith(n.split(' ').pop() || '~'));
  if (byRera && n.includes('rera')) return byRera;
  const exact = ps.find(p => norm(p.name) === n); if (exact) return exact;
  const toks = n.split(' ').filter(w => w.length > 2);
  let best = null, bestHits = 0;
  for (const p of ps) { const hay = norm(p.name + ' ' + p.locality + ' ' + p.rera_no); const hits = toks.filter(w => hay.includes(w)).length; if (hits > bestHits) { best = p; bestHits = hits; } }
  return bestHits >= Math.max(1, Math.ceil(toks.length / 2)) ? best : null;
}

// The three free fields, nothing more (teaser layer per launch doctrine).
export function freeLookup(p, today) {
  const tf = timelineFacts(p, today);
  return { slug: p.slug, name: p.name, rera_no: p.rera_no, locality: p.locality,
    status: p.registration?.status || 'Registered', original_completion: tf.original, extension_count: tf.extension_count };
}

export function scored(p, today) { return { project: p, score: scoreProject(p, today), facts: timelineFacts(p, today) }; }
