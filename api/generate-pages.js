// generate-pages.js — writes the static pages Netlify serves from /frontend: index.html (the landing),
// robots.txt and sitemap.xml. Run after any change to the landing, the records or the config:
//     node api/generate-pages.js
// Dynamic routes (/report/*, /api/*) stay on Railway and are proxied by frontend/_redirects.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { INDIA } from './config.js';
import { renderLanding } from './page.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'frontend');
const site_url = `https://${INDIA.domain}`;
const cfg = { host: INDIA.domain, site_url, brand: INDIA.brand, routes: INDIA.routes, contact_email: INDIA.contact_email, public: INDIA.public };

writeFileSync(join(OUT, 'index.html'), renderLanding(cfg));
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /report/\nSitemap: ${site_url}/sitemap.xml\n`);
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site_url}/</loc></url></urlset>\n`);
console.log(`wrote frontend/index.html, robots.txt, sitemap.xml for ${site_url}`);
