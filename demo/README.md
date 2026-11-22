# METR-LA Forecast Lab (interactive demo)

> **Live site:** [https://traffic-flow-two.vercel.app/](https://traffic-flow-two.vercel.app/)

A static website that walks through the whole project: a 3D Los Angeles County map (`34.04°N–34.22°N, 118.54°W–118.18°W`) of the 207 METR-LA sensors with explicit geographic provenance badges, light/dark theme toggle, team role cards, missing-data distribution & time-split visualizers, clickable feature-group inspector, Phase 1 models, graph models (with interactive GAT jam re-weighting & elevated 3D message-passing arcs), pre-registered hypotheses (`H0–H5`) + 60-min onset recall, case-study story moments, rush-hour signal simulation, and a viva Q&A cheat sheet. Every deep dive opens cleanly on click so nothing clutters the initial view.

No build step and no framework. It is plain HTML, CSS and JavaScript, plus three.js from a CDN.

```
demo/
  index.html        the page
  assets/style.css  design tokens, layout, light + dark theme
  assets/app.js     3D map, section charts, shared helpers
  assets/dives.js   model deep dives (XGBoost, RF, bootstrap, GRU, GAT, DCRNN, controls, signal)
  assets/data.js    generated: every number the page shows
  build_demo.py     regenerates assets/data.js from the repository
  vercel.json       static hosting config
```

## Run locally

```bash
cd demo && python -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` directly from disk also works.

## Deploy

**Vercel (dashboard).** Import the GitHub repo, set **Root Directory** to `demo`, set Framework Preset to **Other**, and leave the build command empty. Every push to `main` redeploys.

**Vercel (CLI).** `npx vercel deploy demo --prod`

**Netlify.** Drag the `demo` folder onto app.netlify.com/drop, or set the base directory to `demo` with no build command.

**GitHub Pages.** Settings → Pages → deploy from `main`, folder `/ (root)`. The demo is then served at `https://<user>.github.io/<repo>/demo/`.

## Update the numbers

```bash
python demo/build_demo.py
```

This reads `data/raw/` (sensor locations, `adj_mx.pkl` through the project's restricted loader), `data/metadata/` (hourly means, per-sensor metrics, attention statistics, case study, per-day errors, bootstrap results, Phase 1 results) and `configs/phase2/final/`, then writes `assets/data.js`.

The headline tables in sections 03, 05 and 07 are typed into `index.html` and `assets/app.js` from the README results tables. Update them there if the results change.

## What is real and what is an illustration

Panels tagged **real** draw project data: sensor positions, road links, per-sensor hourly speeds and errors, GAT attention statistics, the DCRNN diffusion (computed in the browser from `adj_mx.pkl`), XGBoost feature importance, the Random Forest ablation, hyperparameter searches, the 717468 forecasts, and the block bootstrap (rerun in the browser on the real per-day errors).

Panels tagged **toy** or **illustration** show a mechanism, not a result: the boosting and bagging animations (fitted live on one day's curve), the untrained 8-unit GRU cell, the jam-wave road, and the signal animation.

## Presenting

Use ← → or PgUp/PgDn to jump between sections. Click a pillar on the 3D map to select a sensor; the GAT, DCRNN and controls deep dives follow that selection.
