// config.js — THE single source of truth for the India property intelligence service.
// Everything changeable lives here: brand, price, city, portal, routes, contact. Set on Railway:
//   INDIA_BRAND="GharGrades"         the name on every page (defaults to GharGrades)
//   INDIA_DOMAIN=ghargrades.com      canonical host (defaults to ghargrades.com; www redirects to it)
//   INDIA_PUBLIC=1                   allow search indexing (off by default so test URLs stay out of Google)
//   INDIA_CONTACT_EMAIL, INDIA_WHATSAPP, ANTHROPIC_API_KEY, AGENT_MODEL   optional
// Repo layout mirrors the standard: server.js at the root, modules in /api, records in /data, static assets in /frontend.

const DOMAIN = String(process.env.INDIA_DOMAIN || 'ghargrades.com').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
const titleCase = s => s.replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const NAME = (process.env.INDIA_BRAND || 'GharGrades').trim();

export const INDIA = {
  city: 'Bengaluru',
  city_alt: 'Bangalore',
  state: 'Karnataka',
  authority: 'K-RERA',
  authority_long: 'Karnataka Real Estate Regulatory Authority',
  portal_url: 'https://rera.karnataka.gov.in',
  report_price_inr: 200,
  currency_symbol: '\u20B9',
  layers: ['Property Intelligence', 'Decision Agent', 'Buyers Network'],
  routes: { page: '/', report: '/report', api: '/api' },
  free_lookup_fields: ['status', 'original_completion', 'extension_count'],
  domain: DOMAIN,
  public: process.env.INDIA_PUBLIC === '1' || !!DOMAIN,
  whatsapp_number: process.env.INDIA_WHATSAPP || '',
  contact_email: (process.env.INDIA_CONTACT_EMAIL || (DOMAIN ? `hello@${DOMAIN}` : 'hello@example.com')).trim(),
  brand: { name: NAME, short: NAME.length <= 20 ? NAME : 'Bengaluru', score_name: /property/i.test(NAME) ? `${NAME} Score` : `${NAME} Property Score`, copyright: NAME },
  tagline: 'The records are public. The intelligence isn\u2019t.',
  h1: 'Every project has a record. Check before you book.',
};

export const RUPEE = n => `${INDIA.currency_symbol}${Number(n).toLocaleString('en-IN')}`;
export const hostOf = req => String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().split(':')[0].toLowerCase();
// per-request view: canonical origin is the attached domain, else whatever host served the request
export function siteConfig(req) {
  const host = hostOf(req);
  const site_url = DOMAIN ? `https://${DOMAIN}` : (host ? `${(req.headers['x-forwarded-proto'] || 'https').toString().split(',')[0]}://${host}` : '');
  return { host, site_url, brand: INDIA.brand, routes: INDIA.routes, contact_email: INDIA.contact_email, public: INDIA.public };
}
