# GharGrades

Property intelligence on the RERA record: free project lookup, paid report with a published score, Decision Agent.

## Layout
    server.js        entry point (Railway runs `npm start`)
    api/             config.js, db.js, score.js, projects.js, agent.js, page.js, report.js, router.js, generate-pages.js, seed.js, sql/schema.sql
    data/            bangalore-projects.json (the records; every fact carries a source id and capture date)
    frontend/        the static site Netlify publishes: index.html (generated), robots.txt, sitemap.xml, assets/, _redirects

## Run locally
    npm install
    npm run dev          # http://localhost:4100 (the API also serves the landing directly)
    npm run generate     # regenerates frontend/index.html, robots.txt, sitemap.xml after any landing/record/config change; commit them

## Database (Supabase)
1. Supabase -> SQL Editor -> run `api/sql/schema.sql` (creates `projects` and `lookups`, RLS on, no public access).
2. Railway variables: `SUPABASE_URL` (Project Settings -> API -> Project URL) and `SUPABASE_SERVICE_KEY` (service_role key, server only).
3. Nothing to run: on boot the app seeds the launch set from /data when the table is empty (`npm run seed` exists for manual loads).
4. `/healthz` shows `"db": true` and the project count from the table. Without the two variables the app reads /data instead.

## Infrastructure
- GitHub: this repo, branch `main` = production.
- Railway: deploy from this repo (`npm start`), custom domain `api.ghargrades.com`.
  Variables: ANTHROPIC_API_KEY (agent model layer), SUPABASE_URL, SUPABASE_SERVICE_KEY, PORT=3000. Optional: INDIA_BRAND, INDIA_CONTACT_EMAIL, INDIA_WHATSAPP, AGENT_MODEL, INDIA_PUBLIC.
- Netlify: deploy from this repo, build command empty, publish directory `frontend` (set in the Netlify UI). Netlify serves the static
  landing and /assets; `frontend/_redirects` proxies /api/*, /report/* and /healthz to Railway. Custom domain `ghargrades.com` (+ www).
- DNS at the registrar: `ghargrades.com` and `www` -> Netlify (records Netlify shows), `api` CNAME -> Railway target.

## Routes
    GET  /                 landing (free lookup + story)
    GET  /report/:slug     Property Intelligence Report (sample watermark until the paid gate ships)
    GET  /api/lookup?q=    free lookup: status, original completion date, extension count
    GET  /api/projects     launch set
    GET  /api/score/:slug  score JSON with its working
    POST /api/agent        Decision Agent {slug, question, history}
    GET  /assets/*  /robots.txt  /sitemap.xml  /healthz

## Single sources of truth
- `api/config.js`   brand, domain, price, city, portal, routes, contact
- `api/score.js`    weights, bands, formula version, the formula
- `data/bangalore-projects.json`  the records

## Not yet built
K-RERA crawler (portal blocks automated reads; launch set via public mirrors), live complaints-tab check,
plot/site mode, payment gate (UPI/Razorpay), WhatsApp delivery, terms / privacy / corrections pages.
