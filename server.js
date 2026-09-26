// server.js — GharGrades entry point (Railway runs `npm start`). Routes live in api/router.js, records in data/, static assets in frontend/.
import express from 'express';
import { indiaRouter } from './api/router.js';
import { INDIA } from './api/config.js';
import { ensureSeeded } from './api/projects.js';

process.on('unhandledRejection', e => console.error('unhandled rejection:', e && e.message));
process.on('uncaughtException', e => console.error('uncaught exception:', e && e.message));

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'strict-origin-when-cross-origin'); next(); });
app.use(indiaRouter());

const PORT = process.env.PORT || 4100;
app.listen(PORT, async () => {
  console.log(`${INDIA.brand.name} on :${PORT} (domain: ${INDIA.domain || 'none yet'}, public: ${INDIA.public})`);
  try { console.log('records:', JSON.stringify(await ensureSeeded())); } catch (e) { console.log('records: seed check failed', e.message); }
});
