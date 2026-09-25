/* interactions: nav scroll state, headline split, scroll reveals, counters */

/* ----- nav scroll state ----- */
addEventListener('scroll', () => { const nav = document.querySelector('.nav'); if (nav) nav.classList.toggle('scrolled', scrollY > 8); }, { passive: true });

/* ----- headline word-split animation ----- */
document.querySelectorAll('.hero h1, .page-hero h1').forEach(h => {
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const s = document.createElement('span');
          s.className = 'w'; s.textContent = part;
          frag.appendChild(s);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(h);
  h.classList.add('split-words');
  h.querySelectorAll('.w').forEach((w, i) => w.style.setProperty('--i', i));
});

/* ----- auto scroll-reveals with stagger ----- */
const AUTO = '.card, .mstep, .price-card, .stat, .faq details, .weights, .firewall, .trust-banner, .credit-note, .section-head, .rs-section, .demo-wrap';
document.querySelectorAll(AUTO).forEach(el => el.classList.add('reveal'));
const groups = ['.grid-3', '.grid-2', '.price-grid', '.meth-steps', '.stats-grid'];
groups.forEach(sel => document.querySelectorAll(sel).forEach(g =>
  [...g.children].forEach((c, i) => c.style.setProperty('--d', (i * .09) + 's'))
));
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.01, rootMargin: '0px 0px -60px' });
document.querySelectorAll('.reveal').forEach(el => {
  // elements taller than the viewport can never satisfy a % threshold — show immediately
  if (el.offsetHeight > window.innerHeight * 0.8) { el.classList.add('in'); return; }
  io.observe(el);
});

/* ----- animated counters ----- */
function animateCount(el) {
  const target = parseFloat(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  const dur = 1800, t0 = performance.now();
  function tick(t) {
    const p = Math.min((t - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(target * eased).toLocaleString() + (p === 1 ? suffix : '');
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
const cio = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
}), { threshold: .4 });
document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

/* ----- methodology weight bars ----- */
const wio = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) {
    e.target.querySelectorAll('.bar i').forEach(b => b.style.width = b.dataset.w);
    wio.unobserve(e.target);
  }
}), { threshold: .3 });
document.querySelectorAll('.weights').forEach(el => wio.observe(el));

