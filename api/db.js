// db.js — the one place that talks to Supabase. Configured by two Railway variables:
//   SUPABASE_URL            Project Settings -> API -> Project URL
//   SUPABASE_SERVICE_KEY    Project Settings -> API -> service_role key (server only; never shipped to a browser)
// Without them the app runs on the JSON launch set in /data (projects.js falls back automatically).
import { createClient } from '@supabase/supabase-js';

let client = null;
export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    client = createClient(url, key, { auth: { persistSession: false } });
  } catch (e) {
    if (!warned) { warned = true; console.error('db: Supabase client unavailable, using the JSON launch set:', e.message); }
    return null;
  }
  return client;
}
let warned = false;
export const dbConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
// tests inject a fake client here; production never calls this
export function _setClient(c) { client = c; }
