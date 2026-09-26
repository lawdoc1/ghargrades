// router.js — every route of the service, mounted at / by server.js.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { INDIA, siteConfig, hostOf } from './config.js';
import { bangalorePage, lookupApi, projectsApi } from './page.js';
import { bangaloreReport, scoreApi } from './report.js';
import { indiaAgentApi, agentAllow } from './agent.js';
import { listProjects } from './projects.js';
import { dbConfigured } from './db.js';

const __dir = dirname(fileURLToPath(import.meta.url));

// every async handler is wrapped: a thrown error becomes a 500 for that request, never a process crash
const safe = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function indiaRouter() {
  const r = express.Router();
  // one canonical host: the non-canonical form (www or apex, whichever INDIA_DOMAIN is not) redirects to it
  r.use((req, res, next) => { const h = hostOf(req); if (h === INDIA.alt_host) return res.redirect(301, `https://${INDIA.domain}${req.originalUrl}`); next(); });
  r.use('/assets', express.static(join(__dir, '..', 'frontend', 'assets'), { maxAge: '7d' }));   // Netlify serves these on ghargrades.com; the API serves them too
  r.get('/', safe(bangalorePage));
  r.get('/bangalore', (req, res) => res.redirect(301, '/'));
  r.get('/report/:slug', safe(bangaloreReport));
  r.get('/api/lookup', safe(lookupApi));
  r.get('/api/projects', safe(projectsApi));
  r.get('/api/score/:slug', safe(scoreApi));
  r.post('/api/agent', express.json({ limit: '32kb' }), (req, res) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
    if (!agentAllow(`${ip}:${req.body?.slug || ''}`)) return res.status(429).json({ error: 'rate_limited' });
    return indiaAgentApi(req, res).catch(e => { console.error('agent error:', e && e.message); if (!res.headersSent) res.status(500).json({ error: 'agent_unavailable' }); });
  });
  r.get('/robots.txt', (req, res) => { const c = siteConfig(req); res.type('text/plain').send(c.public ? `User-agent: *\nAllow: /\nDisallow: /report/\nSitemap: ${c.site_url}/sitemap.xml\n` : `User-agent: *\nDisallow: /\n`); });
  r.get('/sitemap.xml', (req, res) => { const c = siteConfig(req); res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${c.site_url}/</loc></url></urlset>\n`); });
  r.get('/healthz', safe(async (req, res) => res.json({ ok: true, brand: INDIA.brand.name, projects: (await listProjects()).length, db: dbConfigured(), public: INDIA.public })));
  r.use((req, res) => res.status(404).type('text/plain').send('Not found'));
  r.use((err, req, res, next) => { console.error('route error:', err && err.message); if (res.headersSent) return next(err); res.status(500).type('text/plain').send('Something went wrong on our side. Try again in a moment.'); });
  return r;
}
