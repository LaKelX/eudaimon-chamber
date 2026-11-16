// The Chamber · engine. Trains a Market Mind for many simulated years, exports its brain,
// then sits the exam: the chamber-trained brain and a newborn brain face the same unseen world.
const path = require("path");
const M = require(path.join(__dirname, "..", "engine", "market.js"));
const DAYS = 252;

// The brain: what the Mind learned, minus anything tied to one particular world's clock.
function exportBrain(st) {
  const m = st.mind;
  return {
    b: Array.from(m.b), Lg: Array.from(m.Lg), tab: Array.from(m.tab),
    arch: m.arch.map(A => ({ c: A.c.slice(), L: Array.from(A.L), visits: A.visits })),
    zs: m.zs ? m.zs.slice() : null,
  };
}
function implant(st, brain) {
  const m = st.mind;
  m.b.set(brain.b); m.Lg.set(brain.Lg); m.tab.set(brain.tab);
  m.arch = brain.arch.map((A, k) => ({ id: k + 1, c: A.c.slice(), L: Float64Array.from(A.L), n: 0, visits: A.visits, born: 0,
    truth: new Float64Array(M.REGIMES.length), name: null, desc: null }));
  m.zs = brain.zs ? brain.zs.slice() : null; m.cur = -1;
}
// yearly averages so a 100-year run stays small on disk
function yearly(st, from, years) {
  const out = [];
  for (let y = 0; y < years; y++) {
    let s = 0, n = 0, h = 0, hn = 0;
    for (let d = from + y * DAYS; d < from + (y + 1) * DAYS && d < st.hist.length; d++) {
      const p = st.hist[d]; if (p.skill != null) { s += p.skill; n++; } if (p.hit != null) { h += p.hit; hn++; }
    }
    const last = st.hist[Math.min(st.hist.length - 1, from + (y + 1) * DAYS - 1)];
    out.push({ y: y + 1, skill: n ? +(s / n).toFixed(4) : null, hit: hn ? +(h / hn).toFixed(4) : null, arch: last.nArch,
      w: last.w.map(v => +v.toFixed(4)) });
  }
  return out;
}
function train({ seed, years, loop, shadow, eta }, brain) {
  const days = years * DAYS, t0 = process.hrtime.bigint();
  const st = M.makeMarket({ seed, days, loop, shadow, eta });
  if (brain) implant(st, brain);
  for (let i = 0; i < days; i++) st.step();
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  return { st, wallMs, curve: yearly(st, 0, years), brain: exportBrain(st), purity: +st.purity().toFixed(4) };
}
// the exam: a world neither Mind has seen
function exam(brain, { seed, years, loop, shadow, eta }) {
  const days = years * DAYS, run = withBrain => {
    const st = M.makeMarket({ seed, days, loop, shadow, eta });
    if (withBrain) implant(st, brain);
    for (let i = 0; i < days; i++) st.step();
    return yearly(st, 0, years);
  };
  return { trained: run(true), newborn: run(false) };
}
const mean = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
module.exports = { train, exam, exportBrain, implant, mean, THEORIES: M.THEORIES, REGIMES: M.REGIMES, DAYS };
