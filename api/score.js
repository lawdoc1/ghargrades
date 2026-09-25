// score.js — the Property Score for K-RERA records.
// ONE published formula. The record is the record; the score is an opinion computed
// from it by this file and nothing else. Every point carries a basis line so the
// report can show its working. Change a weight = edit here once.
//
// Dimensions (max points):
//   timeline   30  original completion vs today, extensions, cumulative slip
//   delivery   25  occupancy / completion certificate on record
//   progress   15  progress filings: freshness + certified percent vs time elapsed
//   complaints 15  complaint orders located (portal tab verification lifts the ceiling)
//   promoter   15  the promoter group's other registrations on the record
// Total 100. Higher = stronger record. Bands below.

export const SCORE_VERSION = '2026.09-a';
export const WEIGHTS = { timeline: 30, delivery: 25, progress: 15, complaints: 15, promoter: 15 };
export const BANDS = [
  { min: 80, grade: 'A', verdict: 'Good record', color: '#1E8E5A' },
  { min: 65, grade: 'B', verdict: 'Sound record', color: '#2F7DD1' },
  { min: 50, grade: 'C', verdict: 'Watch', color: '#C9A227' },
  { min: 35, grade: 'D', verdict: 'Investigate', color: '#D97B29' },
  { min: 0,  grade: 'E', verdict: 'Serious concerns on record', color: '#C0392B' },
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const d = s => (s ? new Date(s + (s.length === 10 ? 'T00:00:00Z' : '')) : null);
export const monthsBetween = (a, b) => { const A = d(a), B = d(b); if (!A || !B) return null; return Math.round(((B - A) / 86400000) / 30.4375); };
export function bandFor(total) { return BANDS.find(b => total >= b.min) || BANDS[BANDS.length - 1]; }

/* ---------- timeline (30) ---------- */
function scoreTimeline(rec, today) {
  const t = rec.timeline || {}; const oc = rec.delivery?.oc || {};
  const ext = t.extensions || []; const basis = [];
  const ocIssued = oc.status === 'full' || oc.status === 'partial';
  // Case 1: OC on record. Slip is measured to the OC date.
  if (ocIssued && oc.date) {
    let pts = 30;
    if (!t.original_completion) { basis.push(`Occupancy certificate dated ${oc.date} on record; original validity end not shown, OC pre-dates the only extension on record.`); return { pts: 28, basis }; }
    const slip = monthsBetween(t.original_completion, oc.date);
    if (slip <= 0) { basis.push(`OC issued on or before the original completion date (${t.original_completion}).`); return { pts: 30, basis }; }
    const constructionExt = ext.filter(e => !/administrative/i.test(e.status || ''));
    pts -= constructionExt.length * 4; basis.push(`${constructionExt.length} construction extension(s) on record (minus 4 each).`);
    pts -= Math.min(10, Math.ceil(slip / 3)); basis.push(`OC issued ${slip} month(s) after the original completion date (minus 1 per 3 months, cap 10).`);
    return { pts: clamp(pts, 12, 30), basis };
  }
  // Case 2: no OC. Slip runs to today.
  if (!t.original_completion) { basis.push('Original completion date not shown in the reviewed record.'); return { pts: 10, basis }; }
  let pts = 30;
  const past = monthsBetween(t.original_completion, today);
  if (past > 0) { const pen = Math.min(15, past); pts -= pen; basis.push(`${past} month(s) past the original completion date (${t.original_completion}) with no OC on record (minus 1 per month, cap 15).`); }
  else basis.push(`Original completion date ${t.original_completion} is ${Math.abs(past)} month(s) away; no slip yet.`);
  pts -= ext.length * 5; if (ext.length) basis.push(`${ext.length} extension(s) on record (minus 5 each).`);
  const pending = ext.filter(e => /pending/i.test(e.status || '')).length;
  if (pending) { pts -= 2 * pending; basis.push(`${pending} extension application(s) not shown as approved (minus 2 each).`); }
  const elapsedExt = ext.filter(e => e.to && d(e.to) < d(today) && !/administrative/i.test(e.status || '')).length;
  if (elapsedExt) { pts -= 3 * elapsedExt; basis.push(`${elapsedExt} extension deadline(s) already elapsed without OC (minus 3 each).`); }
  return { pts: clamp(pts, 0, 30), basis };
}

/* ---------- delivery (25) ---------- */
function scoreDelivery(rec) {
  const oc = rec.delivery?.oc || {}; const pct = rec.progress?.latest_filing?.architect_pct; const basis = [];
  if (oc.status === 'full') { basis.push(`Full occupancy certificate dated ${oc.date}${oc.issuer ? ' (' + oc.issuer + ')' : ''} covering ${oc.scope || 'the registered scope'}.`); return { pts: 25, basis }; }
  if (oc.status === 'partial') { let pts = 19; basis.push(`Partial occupancy certificate dated ${oc.date}${oc.issuer ? ' (' + oc.issuer + ')' : ''}; partial certificates carry stated conditions.`); if (oc.deviations_noted) { pts -= 2; basis.push('The certificate records deviations regularized against the sanctioned plan (minus 2).'); } return { pts, basis }; }
  let pts = 1;
  if (typeof pct === 'number') { pts = pct >= 95 ? 11 : pct >= 90 ? 10 : pct >= 75 ? 7 : pct >= 50 ? 4 : 2; basis.push(`No OC on record; latest certified completion ${pct} percent (${pts} of 25).`); }
  else basis.push('No OC on record and no certified completion percent in the reviewed filings.');
  return { pts, basis };
}

/* ---------- progress (15) ---------- */
function scoreProgress(rec, today) {
  const f = rec.progress?.latest_filing; const oc = rec.delivery?.oc || {}; const basis = [];
  if (oc.status === 'full') { basis.push('Construction certified complete; progress dimension satisfied by the OC.'); return { pts: 15, basis }; }
  if (!f) { basis.push('No progress filing in the reviewed record.'); return { pts: 2, basis }; }
  let pts = 0;
  const age = f.filed ? monthsBetween(f.filed, today) : null;
  if (age !== null && age <= 3) { pts += 5; basis.push(`Latest filing (${f.period}) is ${age} month(s) old: within the quarterly cadence (5).`); }
  else if (age !== null && age <= 6) { pts += 3; basis.push(`Latest filing (${f.period}) is ${age} month(s) old: one quarter stale (3).`); }
  else { basis.push(`Latest filing is ${age === null ? 'undated' : age + ' month(s) old'}: quarterly cadence not met (0).`); }
  if (typeof f.architect_pct === 'number') {
    const reg = rec.registration?.date, orig = rec.timeline?.original_completion;
    if (reg && orig) {
      const planned = Math.max(1, monthsBetween(reg, orig)); const elapsed = Math.max(0, monthsBetween(reg, f.filed || today));
      const expected = clamp(elapsed / planned, 0, 1) * 100; const ratio = f.architect_pct / Math.max(1, expected);
      const p = ratio >= 1 ? 10 : ratio >= 0.9 ? 8 : ratio >= 0.75 ? 6 : ratio >= 0.5 ? 3 : 1;
      pts += p; basis.push(`Certified ${f.architect_pct} percent complete against ${Math.round(expected)} percent expected by the original schedule at the filing date (${p} of 10).`);
    } else { const p = f.architect_pct >= 95 ? 10 : f.architect_pct >= 75 ? 7 : 4; pts += p; basis.push(`Certified ${f.architect_pct} percent complete (${p} of 10; schedule not computable from the record).`); }
  }
  return { pts: clamp(pts, 0, 15), basis };
}

/* ---------- complaints (15) ---------- */
function scoreComplaints(rec) {
  const c = rec.complaints || {}; const basis = []; const n = Number(c.located || 0);
  let pts = n === 0 ? 13 : n === 1 ? 10 : n <= 5 ? 6 : 2;
  basis.push(n === 0 ? 'No complaint orders naming the project were located in the public orders and indexes searched.' : `${n} complaint order(s) naming the project located.`);
  if (!c.verified_on_portal) { pts = Math.min(pts, 12); basis.push('Portal complaints tab not verified live in this run: ceiling held at 12 of 15 until it is.'); }
  else if (n === 0) { pts = 15; basis.push('Portal complaints tab verified live: no complaints (15).'); }
  return { pts, basis };
}

/* ---------- promoter (15) ---------- */
function scorePromoter(rec, today) {
  const pr = rec.promoter_record || {}; const others = (pr.other_projects || []).filter(o => o.rera_no); const basis = [];
  let pts = 10; basis.push('Baseline 10 for a registered promoter with no adverse order located.');
  if (!others.length) { basis.push('No other registrations of the promoter reviewed in this run (baseline held).'); return { pts, basis }; }
  for (const o of others) {
    const ext = (o.extensions || []).length; const ocOk = /full|issued|granted/i.test(String(o.oc || ''));
    if (ocOk && ext === 0) { pts += 3; basis.push(`${o.name}: delivered with OC and no extension (plus 3).`); }
    else if (ocOk) { pts += 1; basis.push(`${o.name}: OC on record after ${ext} extension(s) (plus 1).`); }
    else if (ext) { const elapsed = (o.extensions || []).some(e => e.to && d(e.to) < d(today)); pts -= elapsed ? 3 : 2; basis.push(`${o.name}: ${ext} extension(s) on record, OC not established${elapsed ? ', extension deadline elapsed' : ''} (minus ${elapsed ? 3 : 2}).`); }
    else { basis.push(`${o.name}: registered, no extension or OC in the reviewed record (0).`); }
  }
  return { pts: clamp(pts, 0, 15), basis };
}

/* ---------- the composite ---------- */
export function scoreProject(rec, today = new Date().toISOString().slice(0, 10)) {
  const dims = [
    { key: 'timeline', label: 'Completion timeline', max: WEIGHTS.timeline, ...scoreTimeline(rec, today) },
    { key: 'delivery', label: 'Delivery certificates', max: WEIGHTS.delivery, ...scoreDelivery(rec) },
    { key: 'progress', label: 'Progress filings', max: WEIGHTS.progress, ...scoreProgress(rec, today) },
    { key: 'complaints', label: 'Complaint orders', max: WEIGHTS.complaints, ...scoreComplaints(rec) },
    { key: 'promoter', label: 'Promoter record', max: WEIGHTS.promoter, ...scorePromoter(rec, today) },
  ];
  const total = dims.reduce((s, x) => s + x.pts, 0);
  const band = bandFor(total);
  return { total, grade: band.grade, verdict: band.verdict, color: band.color, dims, version: SCORE_VERSION, as_of: today };
}

/* ---------- derived record facts used by the report and the free lookup ---------- */
export function timelineFacts(rec, today = new Date().toISOString().slice(0, 10)) {
  const t = rec.timeline || {}; const ext = t.extensions || []; const oc = rec.delivery?.oc || {};
  const endpoint = (oc.status === 'full' || oc.status === 'partial') && oc.date ? oc.date : today;
  const slip = t.original_completion ? Math.max(0, monthsBetween(t.original_completion, endpoint)) : null;
  const requested = ext.reduce((s, e) => s + (e.months || 0), 0);
  return {
    original: t.original_completion || null,
    current: t.current_completion || null,
    current_basis: t.current_completion_basis || null,
    extension_count: ext.length,
    months_requested: requested,
    slip_months: slip,
    slip_endpoint: endpoint === today ? 'today' : `OC ${oc.date}`,
    oc_status: oc.status || 'none',
  };
}
