// seed.js — loads /data/bangalore-projects.json into the Supabase `projects` table (upsert by slug).
// Run once after creating the tables (sql in README):   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node api/seed.js
import { db } from './db.js';
import { loadDataset, toRow } from './projects.js';

const c = db();
if (!c) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY first.'); process.exit(1); }
const ds = loadDataset();
const rows = ds.projects.map(p => toRow(p, ds.sources, ds.captured));
const { error } = await c.from('projects').upsert(rows, { onConflict: 'slug' });
if (error) { console.error('seed failed:', error.message); process.exit(1); }
const { count } = await c.from('projects').select('slug', { count: 'exact', head: true });
console.log(`seeded ${rows.length} project(s); table now holds ${count}`);
