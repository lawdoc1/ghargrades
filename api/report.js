// report.js — the Property Intelligence Report for one K-RERA registered project.
// Rendered from the record (/data/bangalore-projects.json) + the published score formula (score.js).
// Comparables are the same record shape scored by the same formula. The Decision Agent widget calls POST /api/agent.
//
// GET /report/:slug      -> the report (noindex; demo watermark until the paid gate ships)
// GET /api/score/:slug   -> the score JSON with its working

import { INDIA, siteConfig } from './config.js';
import { agentContext, asksFor, fmtDate, fmtMonth } from './agent.js';
import { WEIGHTS, BANDS, SCORE_VERSION } from './score.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = iso => fmtDate(iso, 'Not shown');
const mon = fmtMonth;
const srcLabel = (ids, sources) => (ids || ['S1']).map(id => sources[id] ? `${id}` : id).join(', ');

/* ---------- pieces ---------- */
function meter(score) {
  return `<div class="meter" role="img" aria-label="Score ${score.total} of 100, band ${score.grade}">` + [...BANDS].reverse().map(b =>
    `<div class="seg ${b.grade === score.grade ? 'on' : ''}" style="${b.grade === score.grade ? `background:${b.color};color:#fff;border-color:${b.color}` : ''}">${b.grade}</div>`).join('') + `</div>`;
}
function dimBars(score) {
  return score.dims.map(d => `<div class="dim"><div class="dim-h"><span>${esc(d.label)}</span><b>${d.pts} <small>/ ${d.max}</small></b></div><div class="bar"><i style="width:${Math.round(100 * d.pts / d.max)}%"></i></div><ul class="basis">${d.basis.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>`).join('');
}
function dateLine(p, f, asOf) {
  const reg = p.registration?.date, orig = f.original, ext = (p.timeline?.extensions || []), oc = p.delivery?.oc || {};
  if (!reg || !orig) return '';
  const pts = [{ t: reg, l: 'Registered', k: 'solid', up: true }, { t: orig, l: 'Declared completion', k: 'solid', up: true }];
  ext.forEach((e, i) => pts.push({ t: e.to, l: (/pending/i.test(e.status) ? 'Extension applied' : 'Extension granted'), k: 'hollow', up: i % 2 === 0 }));
  if (oc.date) pts.push({ t: oc.date, l: (oc.status === 'full' ? 'Occupancy certificate' : 'Partial OC'), k: 'ok', up: false });
  else pts.push({ t: asOf, l: 'Today', k: 'mari', up: false });
  const ts = pts.map(x => new Date(x.t + 'T00:00:00Z').getTime()); const lo = Math.min(...ts), hi = Math.max(...ts); const span = Math.max(1, hi - lo);
  const fillEnd = oc.date ? (new Date(oc.date + 'T00:00:00Z').getTime() - lo) / span : (new Date(asOf + 'T00:00:00Z').getTime() - lo) / span;
  const legend = pts.map(x => `<li><i class="${x.k}"></i>${esc(x.l)} <span>${esc(mon(x.t))}</span></li>`).join('');
  // lanes: labels closer than 22 percent of the span on the same side would overlap, so each point takes the first free lane
  const lanes = { up: -99, dn: -99, up2: -99, dn2: -99 }; const order = ['up', 'dn', 'up2', 'dn2'];
  const marks = pts.map((x, i) => ({ x, left: 100 * (ts[i] - lo) / span })).sort((a, b) => a.left - b.left).map(m => {
    const pref = m.x.up ? ['up', 'up2', 'dn', 'dn2'] : ['dn', 'dn2', 'up', 'up2'];
    const lane = pref.find(l => m.left - lanes[l] > 22) || order.find(l => m.left - lanes[l] > 22) || 'up';
    lanes[lane] = m.left; const edge = m.left < 10 ? ' first' : m.left > 90 ? ' last' : '';
    return `<div class="dl-pt ${m.x.k}" style="left:${m.left.toFixed(1)}%"></div><div class="dl-lbl ${lane}${edge}" style="left:${m.left.toFixed(1)}%"><b>${esc(m.x.l)}</b>${esc(mon(m.x.t))}</div>`;
  }).join('');
  return `<div class="dl"><div class="dl-track"><div class="dl-fill" style="width:${(100 * fillEnd).toFixed(1)}%"></div>${marks}</div><ul class="dl-legend">${legend}</ul></div>`;
}
function kv(rows) { return `<table class="kv">${rows.filter(r => r[1] !== null && r[1] !== undefined && r[1] !== '').map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('')}</table>`; }

/* ---------- the page ---------- */
export async function bangaloreReport(req, res) {
  const cfg = siteConfig(req); const B = cfg.brand, R = cfg.routes;
  const ctx = await agentContext(req.params.slug, undefined, B);
  if (!ctx) return res.status(404).type('text/plain').send('Report not found in the launch set.');
  const { subject: { project: p, score: s, facts: f }, comps, sources, captured, asOf } = ctx;
  const demo = true; // until the paid gate ships every render is the sample
  const rid = ('BLR-' + p.rera_no.split('/').pop() + '-' + asOf.replace(/-/g, '')).toUpperCase();
  const dateStr = new Date(asOf + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const r = p.registration || {}, lf = p.progress?.latest_filing, oc = p.delivery?.oc || {}, c = p.complaints || {}, pr = p.promoter_record || {};
  const glance = [
    ['Timeline', f.original ? (f.oc_status === 'none' ? `${f.slip_months} mo past original date` : `${f.slip_months} mo to certificate`) : 'Original date not shown', f.oc_status === 'none' && f.slip_months > 0 ? 'warn' : 'ok'],
    ['Extensions', `${f.extension_count} on record`, f.extension_count ? 'warn' : 'ok'],
    ['Certificate', oc.status === 'full' ? 'Full OC on record' : oc.status === 'partial' ? 'Partial OC on record' : 'No OC on record', oc.status === 'full' ? 'ok' : oc.status === 'partial' ? 'mid' : 'bad'],
    ['Complaints', c.located ? `${c.located} order(s) located` : 'None located', c.located ? 'warn' : 'ok'],
    ['Promoter', (pr.other_projects || []).some(o => (o.extensions || []).length) ? 'Extension elsewhere' : 'No adverse line found', (pr.other_projects || []).some(o => (o.extensions || []).length) ? 'warn' : 'ok'],
  ];
  const compRows = [ctx.subject, ...comps];
  const chips = ['When was possession promised?', 'What does the extension say?', 'Is there an occupancy certificate?', 'Why this score?', 'How do the comparables differ?', 'What should I ask the promoter?'];

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Property Intelligence Report: ${esc(p.name)}, ${esc(p.locality)} | ${esc(B.name)}</title>
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet"><style>
:root{--k:#14213D;--k2:#0B1226;--mari:#E9A825;--mari2:#9B6A05;--mari-soft:#FBF1D6;--ink:#1C2333;--mut:#5B6478;--line:#E3E6EE;--bg:#F1F2F6;--paper:#F8F6F0;--ok:#1E8E5A;--mid:#2F7DD1;--warn:#C9A227;--bad:#C0392B}
*{box-sizing:border-box}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);margin:0;background:var(--bg);line-height:1.6;font-size:15px;-webkit-font-smoothing:antialiased}
h1,h2,h3,.logo,.pname,.big{font-family:'Sora','Inter',sans-serif}
.t,.rid,.lbl,.src{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace}
.wrap{max-width:900px;margin:0 auto;background:#fff;box-shadow:0 2px 24px rgba(11,18,38,.08)}
.mast{background:linear-gradient(135deg,#0B1226 0%,#1B2A4E 100%);color:#fff;padding:26px 40px 24px;position:relative;overflow:hidden}
.mast::after{content:"";position:absolute;right:-60px;top:-60px;width:260px;height:260px;border-radius:50%;border:26px solid rgba(233,168,37,.12)}
.mast>*{position:relative}
.brand{display:flex;justify-content:space-between;align-items:baseline;gap:20px}
.logo{font-size:1.3rem;font-weight:800}.logo span{color:var(--mari)}
.rid{font-size:.74rem;color:#9AA3BD;text-align:right;line-height:1.5}
.mast h1{margin:18px 0 4px;font-size:.84rem;font-weight:700;color:#C9D0E4;letter-spacing:3px;text-transform:uppercase}
.pname{font-size:1.75rem;font-weight:800;line-height:1.2;letter-spacing:-.01em}
.rera{font-family:'IBM Plex Mono',monospace;font-size:.78rem;color:var(--mari);margin-top:6px;letter-spacing:.04em}
.prep{color:#9AA3BD;font-size:.85rem;margin-top:8px}
.demo{display:inline-block;margin-top:10px;font-family:'IBM Plex Mono',monospace;font-size:.6rem;letter-spacing:.16em;color:var(--k2);background:var(--mari);border-radius:4px;padding:3px 8px}
.body{padding:30px 40px 44px}
/* score */
.scorecard{border:1px solid var(--line);border-radius:16px;padding:26px 28px;margin:0 0 22px;background:linear-gradient(180deg,#FCFCFE,#F6F7FB)}
.scorecard .t{font-size:.7rem;letter-spacing:2.5px;color:var(--mari2);text-transform:uppercase}
.scorehead{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center;margin:12px 0 14px}
.big{font-size:4.2rem;font-weight:800;line-height:.9;letter-spacing:-.04em;color:${s.color}}
.big small{font-size:1.1rem;font-weight:600;color:var(--mut);letter-spacing:0;margin-left:6px}
.verdict{font-family:'Sora',sans-serif;font-size:1.35rem;font-weight:700;color:${s.color};line-height:1.2}
.meter{display:flex;gap:5px;margin-top:10px}
.seg{width:34px;height:34px;border-radius:8px;background:#E7EAF2;color:#8A93AB;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:.95rem;border:1px solid transparent}
.cov{color:var(--mut);font-size:.86rem}
.dims{display:grid;grid-template-columns:1fr 1fr;gap:14px 26px;margin-top:18px}
@media(max-width:640px){.dims{grid-template-columns:1fr}}
.dim-h{display:flex;justify-content:space-between;font-size:.9rem;font-weight:600;color:var(--k)}
.dim-h b{font-family:'IBM Plex Mono',monospace;font-weight:500}.dim-h small{color:var(--mut)}
.bar{height:8px;border-radius:4px;background:#E7EAF2;margin:6px 0 8px;overflow:hidden}
.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--k),#3A4E86);border-radius:4px}
.basis{margin:0;padding-left:16px;font-size:.8rem;color:var(--mut)}
.basis li{margin:2px 0}
.howto{font-size:.88rem;color:var(--mut);background:var(--paper);border-radius:10px;padding:12px 16px;margin:0 0 26px}
/* glance */
.glance{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:0 0 26px}
.gtile{border:1px solid var(--line);border-radius:12px;padding:12px 10px;text-align:center;background:#fff}
.gtile .g{width:30px;height:30px;border-radius:50%;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 7px;font-size:.9rem}
.gtile .n{font-size:.76rem;font-weight:700;color:var(--k)}
.gtile .s{font-size:.7rem;color:var(--mut);margin-top:2px;line-height:1.3}
/* sections */
.sec{border:1px solid var(--line);border-radius:14px;margin:0 0 20px;overflow:hidden;page-break-inside:avoid}
.sec .head{display:flex;align-items:center;gap:12px;padding:13px 18px;background:var(--paper);border-bottom:1px solid var(--line)}
.sec .ic{width:30px;height:30px;border-radius:8px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex:0 0 30px;background:var(--k)}
.sec h2{margin:0;font-size:.99rem;font-weight:700;color:var(--k)}
.sec .inner{padding:16px 18px}
.finding{background:#FCFCFE;border-left:4px solid var(--mari);padding:10px 14px;margin:0 0 12px;font-size:.93rem}
table{width:100%;border-collapse:collapse;font-size:.84rem;margin:6px 0 2px}
th{background:var(--k);color:#fff;text-align:left;padding:8px 10px;font-weight:600}
td{border:1px solid var(--line);padding:8px 10px;vertical-align:top}
tr:nth-child(even) td{background:#F8F9FC}
table.kv th{width:34%;background:var(--paper);color:var(--k);border:1px solid var(--line);font-weight:600}
.notes{color:var(--mut);font-size:.84rem;margin:10px 0 0}
.src{font-size:.62rem;letter-spacing:.12em;color:var(--mut);margin-top:10px;text-transform:uppercase}
/* date line */
.dl{margin:26px 6px 8px}
.dl-track{position:relative;height:6px;background:#E7EAF2;border-radius:3px;margin:92px 10px 86px}
.dl-fill{position:absolute;left:0;top:0;bottom:0;background:var(--mari);border-radius:3px}
.dl-pt{position:absolute;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid var(--k)}
.dl-pt.mari{border-color:var(--mari);background:var(--mari)}.dl-pt.hollow{border-color:var(--mari);border-style:dashed}.dl-pt.ok{border-color:var(--ok);background:var(--ok)}
.dl-lbl{position:absolute;transform:translateX(-50%);text-align:center;font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.06em;color:var(--mut);white-space:nowrap}
.dl-lbl b{display:block;color:var(--k);font-size:.74rem;letter-spacing:0;margin-bottom:2px;font-family:'Inter',sans-serif}
.dl-lbl.up{bottom:20px}.dl-lbl.dn{top:20px}.dl-lbl.up2{bottom:56px}.dl-lbl.dn2{top:56px}
.dl-lbl.first{transform:none;text-align:left}.dl-lbl.last{transform:translateX(-100%);text-align:right}
.dl-legend{display:none;list-style:none;padding:0;margin:0 0 8px}
.dl-legend li{display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--k);padding:4px 0;font-weight:600}
.dl-legend li span{color:var(--mut);font-family:'IBM Plex Mono',monospace;font-size:.68rem;font-weight:400}
.dl-legend i{width:10px;height:10px;border-radius:50%;border:2px solid var(--k);background:#fff;flex:none}
.dl-legend i.mari{border-color:var(--mari);background:var(--mari)}.dl-legend i.hollow{border-color:var(--mari);border-style:dashed}.dl-legend i.ok{border-color:var(--ok);background:var(--ok)}
@media(max-width:640px){.dl-lbl{display:none}.dl-track{margin:14px 6px 18px}.dl-legend{display:block}}
.sum3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:8px 0 14px}
.sum3 div{border-top:2px solid var(--k);padding-top:8px}
.sum3 .v{font-family:'Sora',sans-serif;font-size:1.5rem;font-weight:800;color:var(--k);letter-spacing:-.02em;line-height:1}
.sum3 .l{font-family:'IBM Plex Mono',monospace;font-size:.58rem;letter-spacing:.12em;color:var(--mut);text-transform:uppercase;margin-top:6px}
/* comparables */
.comp{border:2px solid var(--mari);border-radius:14px;margin:0 0 20px;overflow:hidden;page-break-inside:avoid}
.comp .head{display:flex;align-items:center;gap:12px;padding:14px 18px;background:linear-gradient(135deg,#FDF8EA,#FBF1D6);border-bottom:1px solid #EADFB8}
.comp .ic{width:30px;height:30px;border-radius:8px;background:var(--mari);color:var(--k2);display:flex;align-items:center;justify-content:center;font-weight:800}
.comp h2{margin:0;font-size:1.01rem;font-weight:700;color:#6D5200}
.comp .inner{padding:16px 18px}
.cgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:10px 0 14px}
@media(max-width:700px){.cgrid{grid-template-columns:1fr}}
.ccard{border:1px solid var(--line);border-radius:12px;padding:14px 14px 12px;background:#fff}
.ccard.subject{border-color:var(--k);box-shadow:4px 4px 0 var(--mari-soft)}
.ccard .cn{font-weight:700;color:var(--k);font-size:.95rem;line-height:1.3}
.ccard .cl{font-size:.74rem;color:var(--mut);margin-top:2px}
.ccard .cs{font-family:'Sora',sans-serif;font-size:2rem;font-weight:800;letter-spacing:-.03em;line-height:1;margin-top:10px}
.ccard .cv{font-size:.8rem;font-weight:700;margin-top:2px}
.ccard .cr{font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:var(--mut);margin-top:8px;letter-spacing:.04em;overflow-wrap:anywhere}
/* asks */
.adv{background:#FDFAF2;border-left:4px solid var(--mari);border-radius:0 10px 10px 0;padding:12px 16px;margin:0 0 12px;font-size:.93rem}
.limits{background:#EEF1F6;border-radius:12px;padding:16px 18px;font-size:.88rem;margin-top:26px}
.sources{font-size:.82rem;color:var(--mut);margin-top:14px}
.sources li{margin:4px 0}
/* agent */
.agent-wrap{border:2px solid var(--k);border-radius:14px;padding:16px 18px;margin:0 0 20px;background:#fff}
.agent-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.agent-head h3{margin:0;font-size:1rem;color:var(--k)}
.agent-cat{font-family:'IBM Plex Mono',monospace;font-size:.6rem;letter-spacing:.1em;background:var(--mari-soft);color:var(--mari2);border-radius:99px;padding:3px 10px}
.agent-sub{font-family:'IBM Plex Mono',monospace;font-size:.62rem;letter-spacing:.1em;color:var(--mut);margin:6px 0 10px}
.agent-log{display:flex;flex-direction:column;gap:8px;max-height:380px;overflow-y:auto;margin:4px 0 10px}
.bub{max-width:88%;padding:10px 13px;border-radius:12px;font-size:.9rem;line-height:1.55;white-space:pre-wrap}
.bub.me{align-self:flex-end;background:var(--k);color:#fff;border-bottom-right-radius:4px}
.bub.ai{align-self:flex-start;background:var(--paper);color:var(--ink);border-bottom-left-radius:4px}
.bub.err{align-self:flex-start;background:#FDECEC;color:#8A1F1F}
.bub.wait{align-self:flex-start;color:var(--mut);font-family:'IBM Plex Mono',monospace;font-size:.72rem;letter-spacing:.1em}
.agent-chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}
.agent-chip{border:1px solid var(--line);background:#fff;border-radius:99px;padding:7px 12px;font-size:.8rem;color:var(--mut);cursor:pointer;font-family:inherit}
.agent-chip:hover{border-color:var(--mari);color:var(--k)}
.agent-bar{display:flex;gap:8px}
.agent-bar input{flex:1;border:1px solid var(--line);border-radius:10px;padding:11px 13px;font-size:.92rem;font-family:inherit}
.agent-bar button{border:none;border-radius:10px;background:var(--k);color:#fff;font-weight:700;padding:0 18px;cursor:pointer;font-size:.9rem;font-family:inherit}
.agent-bar button:disabled{opacity:.5;cursor:default}
.agent-note{font-size:.72rem;color:var(--mut);margin:8px 0 0}
.foot{background:var(--k2);color:#9AA3BD;font-size:.8rem;padding:18px 40px;line-height:1.6}
.foot b{color:#fff}
@media(max-width:640px){.body{padding:20px 16px 30px}.mast{padding:20px 16px}.glance{grid-template-columns:repeat(2,1fr)}.pname{font-size:1.3rem}.scorehead{grid-template-columns:1fr}.big{font-size:3.2rem}}
@media print{body{background:#fff}.wrap{box-shadow:none}.sec,.comp{page-break-inside:avoid}.agent-wrap{display:none!important}}
</style></head><body><div class="wrap">

<div class="mast"><div class="brand"><div class="logo">${esc(B.name)}</div><div class="rid">Report ${esc(rid)}<br>${esc(dateStr)}</div></div>
<h1>Property Intelligence Report</h1><div class="pname">${esc(p.name)}</div>
<div class="rera">${esc(p.rera_no)} &middot; ${esc(p.locality)}, ${esc(p.corridor)}</div>
<div class="prep">Prepared for the buyer &middot; Private report, never published &middot; K-RERA record captured ${esc(captured)}</div>
${demo ? `<span class="demo">SAMPLE REPORT &middot; LAUNCH SET &middot; VERIFY LIVE ON THE PORTAL</span>` : ''}</div>

<div class="body">

<div class="scorecard"><div class="t">${esc(B.score_name)} &middot; formula ${esc(SCORE_VERSION)} &middot; as of ${esc(asOf)}</div>
<div class="scorehead"><div class="big">${s.total}<small>/ 100</small></div><div><div class="verdict">Band ${esc(s.grade)}: ${esc(s.verdict)}</div>${meter(s)}<div class="cov" style="margin-top:8px">Higher is stronger. Bands: ${BANDS.map(b => `${b.grade} ${b.verdict}`).join(' &middot; ')}.</div></div></div>
<div class="dims">${dimBars(s)}</div></div>

<div class="glance">${glance.map(([n, t, k]) => `<div class="gtile"><div class="g" style="background:var(--${k === 'ok' ? 'ok' : k === 'mid' ? 'mid' : k === 'warn' ? 'warn' : 'bad'})">${k === 'ok' ? '\u2713' : k === 'mid' ? '\u2713' : '!'}</div><div class="n">${esc(n)}</div><div class="s">${esc(t)}</div></div>`).join('')}</div>

<div class="howto"><strong>How to read this report.</strong> Every line below is a field on the K-RERA record as captured on ${esc(captured)}, with its source code in small type (S1 to S7, listed at the end). The score is our opinion computed from those lines by one published formula, with every point shown above. Where the record is silent the report says so; silence is not a clean bill. Verify the live entry at ${esc(INDIA.portal_url)} before you book.</div>

<!-- 1. completion timeline -->
<div class="sec"><div class="head"><div class="ic">\u23F1</div><h2>Completion timeline: the date on the certificate, and every date since</h2></div><div class="inner">
<div class="finding"><strong>Finding:</strong> ${f.original ? `The registration declared completion by ${esc(fmt(f.original))}.` : 'The original completion date is not shown in the record captured.'} ${f.extension_count ? `${f.extension_count} extension${f.extension_count > 1 ? 's' : ''} on record, ${f.months_requested || 0} month${f.months_requested === 1 ? '' : 's'} requested in total; current date on file ${esc(fmt(f.current))} (${esc(f.current_basis || '')}).` : 'No extension on record.'} ${f.oc_status === 'none' ? `No occupancy certificate on record; ${f.slip_months ?? '?'} month(s) past the original date as of ${esc(fmt(asOf))}.` : `Occupancy certificate ${esc(oc.status)} on record dated ${esc(fmt(oc.date))}${f.slip_months !== null ? `, ${f.slip_months} month(s) after the original date` : ''}.`}</div>
${dateLine(p, f, asOf)}
<div class="sum3"><div><div class="v">${f.extension_count}</div><div class="l">Extensions on record</div></div><div><div class="v">${f.months_requested || 0}</div><div class="l">Months requested</div></div><div><div class="v">${f.slip_months ?? '\u2014'}</div><div class="l">${f.oc_status === 'none' ? 'Months past original date, no OC' : 'Months from original date to OC'}</div></div></div>
${(p.timeline?.extensions || []).length ? `<table><tr><th>Extension</th><th>Runs to</th><th>Months</th><th>Status on record</th><th>Note</th></tr>${p.timeline.extensions.map((e, i) => `<tr><td>${i + 1}. ${e.applied ? 'Applied ' + esc(fmt(e.applied)) : e.granted ? 'Granted ' + esc(fmt(e.granted)) : 'On record'}</td><td>${esc(fmt(e.to))}</td><td>${e.months ?? '\u2014'}</td><td>${esc(e.status)}</td><td>${esc(e.note || e.reason || '')}</td></tr>`).join('')}</table>` : ''}
${p.timeline?.original_completion_note ? `<p class="notes">${esc(p.timeline.original_completion_note)}</p>` : ''}
<p class="src">Source ${esc(srcLabel(p.timeline?.src, sources))} &middot; captured ${esc(captured)}</p></div></div>

<!-- 2. registration record -->
<div class="sec"><div class="head"><div class="ic">\u2691</div><h2>Registration record</h2></div><div class="inner">
${kv([
  ['Registration number', esc(p.rera_no)], ['Registered on', esc(fmt(r.date))], ['Status on record', esc(r.status)],
  ['Promoter named on the certificate', esc(r.promoter)], ['Marketed as', esc(r.marketed_as)], ['Promoter address on file', r.promoter_address ? esc(r.promoter_address) : null],
  ['Project type', esc(p.type)], ['Registered area', r.area_acres ? esc(r.area_acres + ' acres') : r.area_sqm ? esc(r.area_sqm.toLocaleString('en-IN') + ' sq m') : null],
  ['Units registered', r.units ? esc(String(r.units)) : null], ['Unit mix on file', r.unit_mix ? esc(r.unit_mix) : null], ['Structure', r.structure ? esc(r.structure) : null],
  ['Declared project cost', r.declared_cost_cr ? esc('\u20B9' + r.declared_cost_cr + ' crore') + (r.cost_split ? ' (' + esc(Object.entries(r.cost_split).map(([k, v]) => k.replace('_cr', '') + ' \u20B9' + v + ' crore').join(', ')) + ')' : '') : null],
  ['Designated escrow bank', r.escrow_bank ? esc(r.escrow_bank) : 'Not shown in the record captured'],
  ['Approvals listed on file', (r.approvals_on_file || []).length ? esc(r.approvals_on_file.join('; ')) : 'Not itemised in the record captured'],
  ['Documents on file', r.documents_on_file ? esc(String(r.documents_on_file)) : null], ['Price band', esc(p.price_band)],
])}
<p class="src">Source ${esc(srcLabel(r.src, sources))} &middot; captured ${esc(captured)}</p></div></div>

<!-- 3. progress filings -->
<div class="sec"><div class="head"><div class="ic">\u2699</div><h2>Progress filings</h2></div><div class="inner">
${lf ? `<div class="finding"><strong>Finding:</strong> Latest filing on record: ${esc(lf.period)}, filed ${esc(fmt(lf.filed))}${lf.site_inspection ? `, site inspection ${esc(fmt(lf.site_inspection))}` : ''}, certifying <strong>${esc(String(lf.architect_pct))} percent</strong> completion.${typeof lf.sold_booked === 'number' ? ` Units sold or booked: ${lf.sold_booked}; available: ${lf.available}.` : ''}</div><p class="notes">${esc(lf.note || '')} Quarterly filings are the promoter's own certificates; the report scores their freshness and the certified percentage against the original schedule, not their accuracy.</p>` : '<div class="finding"><strong>Finding:</strong> No progress filing in the record captured.</div>'}
<p class="src">Source ${esc(srcLabel(lf?.src, sources))} &middot; captured ${esc(captured)}</p></div></div>

<!-- 4. certificates -->
<div class="sec"><div class="head"><div class="ic">\u25A3</div><h2>Occupancy and completion certificates</h2></div><div class="inner">
<div class="finding"><strong>Finding:</strong> ${oc.status === 'none' ? 'No occupancy certificate or completion certificate identified in the record captured.' : `${oc.status === 'full' ? 'Full' : 'Partial'} occupancy certificate dated ${esc(fmt(oc.date))}${oc.issuer ? ', issued by ' + esc(oc.issuer) : ''}, covering ${esc(oc.scope || 'the registered scope')}.`}</div>
${oc.note ? `<p class="notes">${esc(oc.note)}</p>` : ''}
<p class="src">Source ${esc(srcLabel(oc.src, sources))} &middot; captured ${esc(captured)}</p></div></div>

<!-- 5. complaints -->
<div class="sec"><div class="head"><div class="ic">\u2696</div><h2>Complaint orders</h2></div><div class="inner">
<div class="finding"><strong>Finding:</strong> ${c.located ? `${c.located} complaint order(s) naming this project located.` : 'No complaint orders naming this project were located in the public orders and indexes searched.'}</div>
<p class="notes">${esc(c.note || '')}${c.verified_on_portal ? '' : ' The score holds this dimension at a ceiling until the portal tab is verified live.'}</p>
<p class="src">Source ${esc(srcLabel(c.src, sources))} &middot; captured ${esc(captured)}</p></div></div>

<!-- 6. promoter record -->
<div class="sec"><div class="head"><div class="ic">\u2302</div><h2>Promoter record: the group&#39;s other registrations</h2></div><div class="inner">
<div class="finding"><strong>Finding:</strong> ${esc(pr.note || 'No other registrations reviewed in this run.')}</div>
${(pr.other_projects || []).length ? `<table><tr><th>Project</th><th>Registration</th><th>Original completion</th><th>Extensions</th><th>Certificate</th></tr>${pr.other_projects.map(o => `<tr><td><strong>${esc(o.name)}</strong><br><span style="color:var(--mut);font-size:.8rem">${esc(o.locality || '')}${o.promoter_entity ? ' &middot; ' + esc(o.promoter_entity) : ''}</span></td><td style="font-family:'IBM Plex Mono',monospace;font-size:.72rem">${o.rera_no ? esc(o.rera_no) : '<span style="color:var(--mut)">' + esc(o.note || 'not reviewed') + '</span>'}</td><td>${o.original_completion ? esc(fmt(o.original_completion)) : '\u2014'}</td><td>${(o.extensions || []).length ? o.extensions.map(e => `${e.granted ? 'Granted ' + esc(fmt(e.granted)) + ' to ' : 'To '}${esc(fmt(e.to))} (${esc(e.status)})`).join('<br>') : (o.rera_no ? 'None on record' : '\u2014')}</td><td>${o.oc ? esc(o.oc) : '\u2014'}</td></tr>`).join('')}</table>` : ''}
<p class="src">Source ${esc(srcLabel(pr.src, sources))} &middot; captured ${esc(captured)}</p></div></div>

<!-- 7. comparables -->
<div class="comp"><div class="head"><div class="ic">\u2261</div><h2>Two comparables in the same corridor, scored by the same formula</h2></div><div class="inner">
<div class="finding" style="border-left-color:var(--mari)"><strong>How to read this:</strong> three K-RERA records read side by side, each scored by formula ${esc(SCORE_VERSION)} from its own filings. This is a comparison of records, not a recommendation; budget, location, configuration and your own checks decide what suits you.</div>
<div class="cgrid">${compRows.map((x, i) => `<div class="ccard ${i === 0 ? 'subject' : ''}"><div class="cn">${esc(x.project.name)}${i === 0 ? ' <span style="font-family:\'IBM Plex Mono\',monospace;font-size:.58rem;color:var(--mari2);letter-spacing:.12em"> THIS REPORT</span>' : ''}</div><div class="cl">${esc(x.project.locality)}</div><div class="cs" style="color:${x.score.color}">${x.score.total}</div><div class="cv" style="color:${x.score.color}">Band ${esc(x.score.grade)}: ${esc(x.score.verdict)}</div><div class="cr">${esc(x.project.rera_no).replace(/\//g, '/&#8203;')}</div></div>`).join('')}</div>
<table><tr><th>Record line</th>${compRows.map(x => `<th>${esc(x.project.name)}</th>`).join('')}</tr>
<tr><td>Score / band</td>${compRows.map(x => `<td><strong>${x.score.total}</strong> / ${esc(x.score.grade)}</td>`).join('')}</tr>
<tr><td>Registered</td>${compRows.map(x => `<td>${esc(fmt(x.project.registration?.date))}</td>`).join('')}</tr>
<tr><td>Original completion</td>${compRows.map(x => `<td>${x.facts.original ? esc(fmt(x.facts.original)) : '<span style="color:var(--mut)">Not shown in the record; OC pre-dates the only extension</span>'}</td>`).join('')}</tr>
<tr><td>Extensions on record</td>${compRows.map(x => `<td>${x.facts.extension_count}${x.facts.months_requested ? ' (' + x.facts.months_requested + ' mo)' : ''}${(x.project.timeline?.extensions || []).some(e => /administrative/i.test(e.status)) ? '<br><span style="color:var(--mut);font-size:.76rem">administrative, post OC</span>' : ''}</td>`).join('')}</tr>
<tr><td>Months past original date</td>${compRows.map(x => `<td>${x.facts.slip_months ?? '\u2014'}${x.facts.slip_months !== null ? (x.facts.oc_status === 'none' ? ' (to today, no OC)' : ' (to OC)') : ''}</td>`).join('')}</tr>
<tr><td>Occupancy certificate</td>${compRows.map(x => `<td>${x.facts.oc_status === 'none' ? 'None on record' : esc(x.facts.oc_status) + ', ' + esc(fmt(x.project.delivery.oc.date))}</td>`).join('')}</tr>
<tr><td>Latest filing</td>${compRows.map(x => { const l = x.project.progress?.latest_filing; return `<td>${l ? esc(l.period) + ', ' + esc(String(l.architect_pct)) + '%' + (typeof l.sold_booked === 'number' ? ', ' + l.sold_booked + ' booked' : '') : '\u2014'}</td>`; }).join('')}</tr>
<tr><td>Complaint orders located</td>${compRows.map(x => `<td>${x.project.complaints?.located || 0}${x.project.complaints?.verified_on_portal ? '' : ' (portal tab not verified live)'}</td>`).join('')}</tr>
<tr><td>Promoter named</td>${compRows.map(x => `<td>${esc(x.project.registration?.promoter)}</td>`).join('')}</tr>
<tr><td>Price band (indicative)</td>${compRows.map(x => `<td>${esc(x.project.price_band)}</td>`).join('')}</tr>
</table>
<p class="src">Source S1 to S5 for each project &middot; captured ${esc(captured)} &middot; same formula, same date</p></div></div>

<!-- 8. asks -->
<div class="sec"><div class="head"><div class="ic" style="background:var(--mari);color:var(--k2)">\u2192</div><h2>Before you book: the documents each finding tells you to ask for</h2></div><div class="inner">
${asksFor(p, f).map(([t, x], i) => `<div class="adv"><strong>${i + 1}. ${esc(t)}.</strong> ${esc(x)}</div>`).join('')}
</div></div>

<!-- 9. decision agent -->
<div class="agent-wrap" id="agentWrap">
  <div class="agent-head"><h3>Decision Agent</h3><span class="agent-cat">${esc(p.name.toUpperCase())}</span></div>
  <p class="agent-sub">ANSWERS FROM THIS PROJECT&#39;S K-RERA RECORD ONLY &middot; SOURCE AND CAPTURE DATE ON EVERY ANSWER &middot; NOT LEGAL ADVICE</p>
  <div class="agent-log" id="agentLog"></div>
  <div class="agent-chips">${chips.map(q => `<button type="button" class="agent-chip">${esc(q)}</button>`).join('')}</div>
  <div class="agent-bar"><input id="agentInput" type="text" maxlength="1500" placeholder="Ask about the timeline, the certificate, the complaints, the comparables, or what to ask the promoter"><button id="agentSend" type="button">Ask</button></div>
  <p class="agent-note">The Agent reads this report&#39;s compiled record. It compares records and never recommends. It will tell you when something is not on the record.</p>
</div>

<div class="limits"><strong>Honest limits of this report.</strong> The K-RERA portal does not allow automated reads, so this launch set was captured through a public mirror of the filing on ${esc(captured)} and cross checked against the portal's certificate format; the live entry can move (a new quarterly filing, an extension decision, a certificate, an order) at any time. The complaints tab was not read live in this run. Progress percentages are the promoter's own certificates. Occupancy certificates are quoted as recorded, with their scope and conditions; title, khata, encumbrance and layout approval sit outside the K-RERA record and are not checked here. The score is an opinion computed from the record by a published formula and is not itself a record.
<ul class="sources">${Object.entries(sources).map(([id, sx]) => `<li><strong>${esc(id)}</strong> ${esc(sx.label)} &middot; captured ${esc(sx.captured)}${sx.note ? ' &middot; ' + esc(sx.note) : ''}</li>`).join('')}</ul>
<p style="margin:10px 0 0"><a href="${esc(INDIA.portal_url)}" rel="noopener" style="color:var(--k);font-weight:600">Open the live K-RERA portal</a> and search the registration number above.</p></div>

</div>
<div class="foot"><b>${esc(B.name)}</b> &middot; Property Intelligence before the booking &middot; Compiled from the public K-RERA record under the published ${esc(B.score_name)} formula (${esc(SCORE_VERSION)}). No promoter was contacted; none can pay to change a line. This report and its score are private to the buyer and are never published. Questions: ${esc(cfg.contact_email)}.</div>
</div>
<script>
(function(){
  var API = ${JSON.stringify(R.api)}, SLUG = ${JSON.stringify(p.slug)};
  var log = document.getElementById('agentLog'), input = document.getElementById('agentInput'), btn = document.getElementById('agentSend'), wrap = document.getElementById('agentWrap');
  var history = [];
  function bubble(cls, text){ var d = document.createElement('div'); d.className = 'bub ' + cls; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  bubble('ai', 'Ask me anything about ' + ${JSON.stringify(p.name)} + ' that the K-RERA record can answer: possession, extensions, certificates, complaints, the promoter, the comparables, or why the score is what it is. Every answer names its source and capture date.');
  async function ask(q){
    q = (q || input.value).trim(); if (!q) return;
    input.value = ''; btn.disabled = true; bubble('me', q);
    var t = bubble('wait', 'READING THE RECORD...');
    try {
      var r = await fetch(API + '/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: SLUG, question: q, history: history.slice(-8) }) });
      var j = await r.json(); t.remove();
      if (r.ok && j.reply) { bubble('ai', j.reply); history.push({ role: 'user', content: q }, { role: 'assistant', content: j.reply }); }
      else if (r.status === 429) bubble('err', 'The Agent is rate limited for this report right now. Give it a few minutes.');
      else bubble('err', 'The Agent hit a snag. Try that again.');
    } catch(e){ t.remove(); bubble('err', 'The Agent hit a snag. Try that again.'); }
    btn.disabled = false; input.focus();
  }
  btn.addEventListener('click', function(){ ask(); });
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); ask(); } });
  wrap.querySelectorAll('.agent-chip').forEach(function(c){ c.addEventListener('click', function(){ ask(c.textContent); }); });
})();
</script>
</body></html>`;
  res.set('Cache-Control', 'no-store');
  res.send(html);
}

/* ---------- score JSON ---------- */
export async function scoreApi(req, res) {
  const ctx = await agentContext(req.params.slug);
  if (!ctx) return res.status(404).json({ error: 'not_found' });
  const pick = x => ({ slug: x.project.slug, name: x.project.name, rera_no: x.project.rera_no, score: x.score, facts: x.facts });
  res.json({ captured: ctx.captured, weights: WEIGHTS, bands: BANDS, subject: pick(ctx.subject), comparables: ctx.comps.map(pick) });
}
