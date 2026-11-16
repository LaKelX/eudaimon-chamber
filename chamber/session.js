#!/usr/bin/env node
// Runs one Chamber session. Parameters come from a workflow_dispatch (env) or an approved
// booking issue (read from the event JSON here, never interpolated into the shell).
// Writes runs/<id>/session.json + brain files, updates runs/index.json, writes comment.md.
const fs = require("fs"), path = require("path");
const E = require("./engine.js");
const ROOT = path.join(__dirname, ".."), RUNS = path.join(ROOT, "runs");
const clamp = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) && String(v).trim() !== "" ? Math.min(hi, Math.max(lo, x)) : d; };
const pick = (v, allowed, d) => { const x = Number(v); return allowed.includes(x) ? x : d; };

function fromIssue(ev) {
  const body = (ev.issue && ev.issue.body) || "", f = {};
  // issue forms render as "### Label\n\nvalue"
  body.split(/^###\s+/m).slice(1).forEach(block => { const [h, ...rest] = block.split("\n"); f[h.trim().toLowerCase()] = rest.join("\n").trim(); });
  const g = k => { const key = Object.keys(f).find(x => x.startsWith(k)); return key ? f[key].replace(/^_No response_$/, "") : ""; };
  return { name: g("session name"), years: parseInt(g("years"), 10), worlds: parseInt(g("worlds"), 10), replicates: parseInt(g("brains"), 10),
    loop: g("feedback loop"), shadow: g("shadow"), eta: g("learning"), renter: ev.issue.user && ev.issue.user.login, issue: ev.issue.number };
}
function params() {
  let raw = { name: process.env.IN_NAME, years: process.env.IN_YEARS, worlds: process.env.IN_WORLDS, replicates: process.env.IN_REPLICATES,
    loop: process.env.IN_LOOP, shadow: process.env.IN_SHADOW, eta: process.env.IN_ETA, renter: process.env.GITHUB_ACTOR, issue: null };
  if (process.env.GITHUB_EVENT_NAME === "issues") raw = fromIssue(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")));
  const worlds = pick(raw.worlds, [1, 2, 4, 8, 16], 1);
  let years = pick(raw.years, [12, 25, 50, 100, 250, 500], 100);
  const yearsEach = Math.max(3, Math.round(years / worlds)); years = yearsEach * worlds;
  return {
    name: String(raw.name || "Untitled session").replace(/[^\w .,'&()+:-]/g, "").slice(0, 60) || "Untitled session",
    renter: String(raw.renter || "unknown").replace(/[^\w-]/g, "").slice(0, 39), issue: raw.issue,
    years, worlds, yearsEach, replicates: pick(raw.replicates, [1, 4, 8], 4),
    loop: clamp(raw.loop, 0, 1, 0.6), shadow: clamp(raw.shadow, 0, 2, 1), eta: clamp(raw.eta, 0.1, 3, 0.9), examYears: 12,
  };
}

function run(P) {
  const reps = [];
  for (let r = 0; r < P.replicates; r++) {
    const base = 1 + r + Math.floor(Math.random() * 1e6) * 10;
    let brain = null, curve = [], wall = 0;
    const purity = [];
    for (let w = 0; w < P.worlds; w++) { // a curriculum of worlds; the brain carries over between them
      const T = E.train({ seed: base * 100 + w, years: P.yearsEach, loop: P.loop, shadow: P.shadow, eta: P.eta }, brain);
      curve = curve.concat(T.curve.map(c => ({ ...c, y: curve.length + c.y, world: w + 1 })));
      wall += T.wallMs; brain = T.brain; purity.push(T.purity);
    }
    const X = E.exam(brain, { seed: base * 100 + 99, years: P.examYears, loop: P.loop, shadow: P.shadow, eta: P.eta });
    const e3 = a => E.mean(a.slice(0, 3).map(x => x.skill)), all = a => E.mean(a.map(x => x.skill));
    reps.push({ seedBase: base, wallMs: Math.round(wall), curve, exam: X, brain,
      earlyEdge: e3(X.trained) - e3(X.newborn), fullEdge: all(X.trained) - all(X.newborn), purity: E.mean(purity) });
  }
  return { reps, simYears: P.years * P.replicates, trainWall: reps.reduce((s, r) => s + r.wallMs, 0) };
}

function main() {
  const P = params(), R = run(P);
  const id = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13) + "-" + Math.random().toString(36).slice(2, 6);
  const dir = path.join(RUNS, id); fs.mkdirSync(dir, { recursive: true });
  const m = E.mean, msPerYear = R.trainWall / R.simYears;
  const r4 = x => x == null ? null : +x.toFixed(4);
  const summary = {
    id, name: P.name, renter: P.renter, issue: P.issue, at: new Date().toISOString(),
    params: { years: P.years, worlds: P.worlds, yearsEach: P.yearsEach, replicates: P.replicates, loop: P.loop, shadow: P.shadow, eta: P.eta, examYears: P.examYears },
    simYears: R.simYears, trainWallMs: R.trainWall, msPerYear: +msPerYear.toFixed(3),
    dilation: Math.round((365.25 * 86400 * 1000) / msPerYear),
    finalSkill: r4(m(R.reps.map(r => m(r.curve.slice(-5).map(x => x.skill))))),
    earlyEdge: r4(m(R.reps.map(r => r.earlyEdge))), fullEdge: r4(m(R.reps.map(r => r.fullEdge))),
    earlyWins: R.reps.filter(r => r.earlyEdge > 0).length, fullWins: R.reps.filter(r => r.fullEdge > 0).length,
    purity: r4(m(R.reps.map(r => r.purity))),
  };
  const session = { ...summary, theories: E.THEORIES.map(t => t.name),
    reps: R.reps.map((r, i) => ({ i, seedBase: r.seedBase, wallMs: r.wallMs, earlyEdge: r4(r.earlyEdge), fullEdge: r4(r.fullEdge), purity: r4(r.purity),
      curve: r.curve.map(c => ({ y: c.y, s: c.skill, h: c.hit, a: c.arch, w: c.world })),
      finalW: r.curve[r.curve.length - 1].w,
      exam: { trained: r.exam.trained.map(x => x.skill), newborn: r.exam.newborn.map(x => x.skill) } })) };
  fs.writeFileSync(path.join(dir, "session.json"), JSON.stringify(session));
  R.reps.forEach((r, i) => fs.writeFileSync(path.join(dir, `brain-${i + 1}.json`),
    JSON.stringify({ chamber: "eudaimon", session: id, replicate: i + 1, params: summary.params, brain: r.brain })));
  const idxPath = path.join(RUNS, "index.json");
  const idx = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, "utf8")) : { sessions: [] };
  idx.sessions.unshift(summary); idx.updated = summary.at;
  fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
  const pct = x => (x == null ? "—" : (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + " pts");
  const site = process.env.SITE_URL || "";
  fs.writeFileSync(path.join(ROOT, "comment.md"), [
    `## The Chamber · session complete: **${P.name}**`, ``,
    `| | |`, `|---|---|`,
    `| Simulated inside | **${R.simYears.toLocaleString("en-US")} years** (${P.replicates} brain${P.replicates > 1 ? "s" : ""} × ${P.years} yrs across ${P.worlds} world${P.worlds > 1 ? "s" : ""}) |`,
    `| Time outside | **${(R.trainWall / 1000).toFixed(1)} s** of training |`,
    `| Time dilation | 1 year inside = **${msPerYear.toFixed(1)} ms** outside (×${summary.dilation.toExponential(2)}) |`,
    `| Final skill vs. random walk | ${pct(summary.finalSkill)} |`,
    `| Exam, years 1–3: edge over a newborn | ${pct(summary.earlyEdge)} (${summary.earlyWins}/${P.replicates} brains ahead) |`,
    `| Exam, all 12 years: edge over a newborn | ${pct(summary.fullEdge)} (${summary.fullWins}/${P.replicates} ahead) |`, ``,
    site ? `Dashboard: ${site}#${id}` : ``, `Brains: \`runs/${id}/brain-*.json\``,
  ].join("\n"));
  console.log(JSON.stringify(summary, null, 1));
}
main();
