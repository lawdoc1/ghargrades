// projects.js — the record reader. Reads the `projects` table when Supabase is configured (db.js),
// otherwise the JSON launch set in /data. Same record shape either way, so page, report and agent
// never know which one they are on. Rows: slug, rera_no, name, locality, corridor, record (jsonb), sources (jsonb), captured.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scoreProject, timelineFacts } from './score.js';
import { db } from './db.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dir, '..', 'data', 'bangalore-projects.json');   // records live in /data
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* ---------- JSON launch set (fallback) ---------- */
let cache = null;
export function loadDataset() { if (!cache) cache = JSON.parse(readFileSync(FILE, 'utf8')); return cache; }

/* ---------- row <-> record ---------- */
const fromRow = r => r ? ({ ...r.record, slug: r.slug, _sources: r.sources || {}, _captured: r.captured || null }) : null;
export const toRow = (p, sources, captured) => ({ slug: p.slug, rera_no: p.rera_no, name: p.name, state: 'Karnataka', district: p.district || null, locality: p.locality || null, corridor: p.corridor || null, type: p.type || null, record: p, sources: sources || {}, captured: captured || null, updated_at: new Date().toISOString() });

/* ---------- readers (async; DB first, JSON fallback) ---------- */
export async function listProjects() {
  const c = db();
  if (c) { const { data, error } = await c.from('projects').select('slug,name,rera_no,locality,corridor').order('name').limit(1000); if (!error && data) return data; }
  return loadDataset().projects.map(p => ({ slug: p.slug, name: p.name, rera_no: p.rera_no, locality: p.locality, corridor: p.corridor }));
}
export async function getProject(slug) {
  const s = String(slug || '').toLowerCase(); const c = db();
  if (c) { const { data, error } = await c.from('projects').select('*').eq('slug', s).maybeSingle(); if (!error) return fromRow(data); }
  return loadDataset().projects.find(p => p.slug === s) || null;
}
export async function getSources(p) { return p && p._sources && Object.keys(p._sources).length ? p._sources : loadDataset().sources; }
export async function getCaptured(p) { return (p && p._captured) || loadDataset().captured; }

// Free lookup: name or K-RERA number, loosely. Returns the project or null.
export async function findProject(q) {
  const n = norm(q); if (n.length < 3) return null;
  const toks = n.split(' ').filter(w => w.length > 2);
  const rank = ps => { let best = null, bestHits = 0; for (const p of ps) { const hay = norm(p.name + ' ' + (p.locality || '') + ' ' + p.rera_no); const hits = toks.filter(w => hay.includes(w)).length; if (hits > bestHits) { best = p; bestHits = hits; } } return bestHits >= Math.max(1, Math.ceil(toks.length / 2)) ? best : null; };
  const c = db();
  if (c) {
    const raw = String(q || '').trim().slice(0, 120);
    const exact = await c.from('projects').select('*').or(`rera_no.ilike.${raw},name.ilike.${raw}`).limit(1);
    if (!exact.error && exact.data?.length) return fromRow(exact.data[0]);
    const ors = toks.map(t => `name.ilike.%${t}%`).concat(toks.map(t => `rera_no.ilike.%${t}%`)).join(',');
    const { data, error } = await c.from('projects').select('*').or(ors || `name.ilike.%${raw}%`).limit(25);
    if (!error && data?.length) { const best = rank(data.map(fromRow)); if (best) return best; }
    return null;
  }
  const ps = loadDataset().projects;
  const byRera = ps.find(p => norm(p.rera_no) === n); if (byRera) return byRera;
  const exact = ps.find(p => norm(p.name) === n); if (exact) return exact;
  return rank(ps);
}

// Self-seeding: on boot, if the table is empty, load the launch set from /data. Idempotent (upsert by slug).
export async function ensureSeeded() {
  const c = db(); if (!c) return { skipped: 'no database configured' };
  const { count, error } = await c.from('projects').select('slug', { count: 'exact', head: true });
  if (error) return { error: error.message };
  if (count > 0) return { seeded: 0, rows: count };
  const ds = loadDataset(); const rows = ds.projects.map(p => toRow(p, ds.sources, ds.captured));
  const up = await c.from('projects').upsert(rows, { onConflict: 'slug' });
  return up.error ? { error: up.error.message } : { seeded: rows.length, rows: rows.length };
}

// demand signal: every free lookup is logged (query + match), never the phone or the person
export async function logLookup(query, matchedSlug, ipHash) {
  const c = db(); if (!c) return;
  try { await c.from('lookups').insert({ query: String(query || '').slice(0, 200), matched_slug: matchedSlug || null, ip_hash: ipHash || null }); } catch { /* best effort */ }
}

// The three free fields, nothing more (teaser layer per launch doctrine).
export function freeLookup(p, today) {
  const tf = timelineFacts(p, today);
  return { slug: p.slug, name: p.name, rera_no: p.rera_no, locality: p.locality,
    status: p.registration?.status || 'Registered', original_completion: tf.original, extension_count: tf.extension_count };
}
export function scored(p, today) { return { project: p, score: scoreProject(p, today), facts: timelineFacts(p, today) }; }
