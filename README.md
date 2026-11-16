# The Chamber

**An AI training chamber you can rent on GitHub.** A century inside, a second outside.

The Chamber trains an AI, the Eudaimon Market Mind, for simulated decades of markets in seconds of real time: about **13 ms of wall-clock time per simulated year**, roughly two billion times faster than real time. Then it sits an exam. The chamber-trained brain and a newborn brain are dropped into the same unseen market, and we measure which one reads it better.

**Dashboard:** https://lakelx.github.io/eudaimon-chamber/

## Rent a session

1. **Book.** Open a [booking issue](https://github.com/LaKelX/eudaimon-chamber/issues/new?template=book-a-session.yml): years in the chamber, number of worlds (a curriculum of different markets), number of brains.
2. **Approval.** The keeper adds the `approved` label. Only maintainers can label, so the chamber never runs without a yes.
3. **Training.** A GitHub Actions runner trains each brain and saves it.
4. **Exam and results.** Results are posted to your issue, the brains are saved as JSON in `runs/<session>/`, and the session appears on the dashboard.

Founding beta: sessions are free and approved by hand.

## Build your own chamber

Click **Use this template**, enable GitHub Pages (main branch, root) and Actions, and create the labels `session` and `approved`. Your chamber runs on your own Actions minutes.

## What's inside

| Path | What it is |
|---|---|
| `engine/market.js`, `engine/core.js` | The Market Mind: 200 evolving traders with habits and shadow habits; a Mind that weighs 8 theories by market archetype; the evolutionary economy underneath |
| `chamber/engine.js` | `train()`, `exam()`, `exportBrain()`, `implant()` |
| `chamber/session.js` | Runs one session from workflow inputs or an approved booking issue |
| `.github/workflows/chamber.yml` | The chamber door: runs on `approved` label or manual dispatch |
| `runs/` | Every session: `session.json` plus one `brain-N.json` per trained brain |
| `index.html` | The public dashboard |

Run locally: `IN_YEARS=100 IN_WORLDS=4 IN_REPLICATES=4 node chamber/session.js`

## Findings so far (founding sessions, Nov 16, 2026)

- Learning is real and then plateaus: about +35% skill vs. a random walk within roughly two decades inside.
- The edge transfers to unseen worlds but is small: about +0.4 to +2.6 points.
- Variety beats duration: a 16-world curriculum gave the most consistent 12-year exam wins (7 of 8 brains).

## Honest limits

A stylized simulation for research and education. It is not a trading system, not trained on real market data, not investment advice, and not sentient. Security: booking text is parsed in Node from the event payload and never reaches a shell; all numeric inputs are clamped.

Eudaimon Capitol · part of [the Eudaimon model](https://lakelx.github.io/eudaimon-model/)
