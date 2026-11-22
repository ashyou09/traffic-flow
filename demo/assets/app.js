/* METR-LA Forecast Lab: 3D Los Angeles map, theme switcher, section charts, shared helpers (window.App). */
(function () {
'use strict';
const D = window.DATA;
const N = D.ids.length;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; }
const fmtH = h => { const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };

/* ---------- Light / Dark theme toggle ---------- */
const emit = (name, detail) => dispatchEvent(new CustomEvent(name, { detail }));
(function initTheme() {
  const saved = localStorage.getItem('metr_theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const syncBtn = () => { $('#themeBtn').textContent = isDark() ? '☀ Light' : '☾ Dark'; };
  syncBtn();
  $('#themeBtn').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('metr_theme', next);
    syncBtn();
  });
})();

/* ---------- Team role unfold tabs ---------- */
const TEAM = [
  {
    name: '1 · Pankaj Baid',
    role: 'Phase 1 Person A (Data & EDA) → Phase 2 Member 1 (Core PyTorch Pipeline, Trainer & Final Assembly)',
    summary: 'Verified the raw METR-LA file SHA-256, masked 575,302 zero readings (8.1%) as missing outages, locked the 70/10/20 split contract, built the GPU/MPS-resident Phase 2 loader, graph generator, crash-proof epoch checkpointing trainer, leak-free CLI, and executed the final 11.2h Apple M3 training run.',
    stats: ['207 LA sensors × 34,272 steps', '199 MB tensor on MPS/CUDA', 'Parity error: 0.000 MAE', '11.2 h full M3 training'],
    files: 'src/data/{load_data,quality,eda}.py · src/phase2/{data,graph,train,cli,registry}.py · notebooks/phase2_colab_train.ipynb',
  },
  {
    name: '2 · Ashutosh Singh',
    role: 'Phase 1 Person B (32 Features & Split) → Phase 2 Member 2 (Graph Attention Network & Controls)',
    summary: 'Built Phase 1 causal forward-fill imputation, 32 strictly local features per sensor, and 70/10/20 boundary splitting (keeping all 4 horizons inside each split). In Phase 2, implemented pure-PyTorch multi-head masked GAT (factored attention + residual head), identity/shuffled graph controls, attention entropy stats, and 9 unit tests.',
    stats: ['22,788 picked GAT params', '60m MAE: 4.175 (vs 4.364 identity)', 'Onset gain: +2.223 MAE', '90.3% neighbour / 9.7% self attn'],
    files: 'src/data/{features,split,dataset_builder}.py · src/phase2/models/gat.py · scripts/phase2_gat_attention_stats.py · tests/test_phase2_gat.py',
  },
  {
    name: '3 · Narendra Singh',
    role: 'Phase 1 Person C (Baselines & XGBoost) → Phase 2 Member 3 (DCRNN Diffusion RNN & Local Deep Control)',
    summary: 'Built Persistence, Historical Average, and XGBoost + HA 36 (Phase 1 champion: 3.688 MAE at 60m). In Phase 2, built gru_local (no graph control: 4.379 MAE — proving deep learning without the road graph does not beat trees) and DCRNN (K=2 forward/reverse random walks inside DCGRU encoder-decoder).',
    stats: ['Best overall at 5–30 min: 2.305 / 2.799 / 3.220', '60m MAE: 3.734 (+0.650 over identity)', 'Peak 60m best: 5.513', '60m onset recall: 41.0%'],
    files: 'src/models/{baselines,xgboost_model}.py · src/phase2/models/{dcrnn,controls}.py · tests/test_phase2_{dcrnn,controls}.py',
  },
  {
    name: '4 · Shreya Suman',
    role: 'Phase 1 Person D (Random Forest & Ablation) → Phase 2 Member 4 (Evaluation, Bootstrap, H0–H5 & Maps)',
    summary: 'Ran the 16-model RF ablation proving time features give the sharpest accuracy jump (5.38 → 4.90). In Phase 2, built the independent evaluation judge: checked Phase 1 parity (0.0 ΔMAE across 200 rows), computed pooled MAE/RMSE/MAPE, paired 2-day moving-block bootstrap (2,000 resamples), programmatic H0–H5 verdicts, and spatial maps.',
    stats: ['1,245,052 valid 5m test targets', '2-day block bootstrap × 2,000', 'H1, H3, H4 supported; H2/H0 honest', 'Spearman 0.284 degree vs gain'],
    files: 'src/models/random_forest.py · src/phase2/{evaluation,viz}/ · scripts/phase2_eval_all.py · data/metadata/phase2/',
  },
  {
    name: '5 · Ranvendra Pratap Singh',
    role: 'Phase 1 Person E (Eval & Paper) → Phase 2 Member 5 (Signal Simulation, IEEE Paper, Slides & QA Audit)',
    summary: 'Synthesized Phase 1 and posed the Phase 2 "graph gap" hypothesis. Built the single-approach traffic signal queue simulator (80 synthetic runs + 3,780 real-forecast runs across 30 congested LA sensors), automated data-driven IEEE paper and slide builders, rebuilt the honest Sensor 717468 case study, and closed the Claims QA audit.',
    stats: ['3,780 real-forecast signal runs', 'Adaptive vs fixed: ~27 s vs 2,179 s', 'Forecast effect < 0.5 s/veh', '185 automated tests across P1+P2'],
    files: 'src/phase2/signal_sim/ · scripts/phase2_run_signal_sim.py · scripts/build_phase2_{paper,slides}.py · reports/paper_phase2/',
  },
];
function showTeamMember(idx) {
  const m = TEAM[idx];
  document.querySelectorAll('#teamTabs .tg').forEach((b, j) => b.setAttribute('aria-pressed', j === idx));
  $('#teamCard').innerHTML = `<div class="team-card-head"><h4>${m.name}</h4><span class="readout">${m.role}</span></div>`
    + `<p class="cap" style="color:var(--ink)">${m.summary}</p>`
    + `<div class="team-meta">${m.stats.map(s => `<span>${s}</span>`).join('')}</div>`
    + `<div class="readout">Code: <code>${m.files}</code></div>`;
}
document.querySelectorAll('#teamTabs .tg').forEach(b => b.addEventListener('click', () => showTeamMember(+b.dataset.m)));
showTeamMember(0);

/* speed colour ramp: jam red -> amber -> free-flow teal */
const RAMP = [[20, [0.80, 0.20, 0.16]], [40, [0.93, 0.55, 0.15]], [55, [0.95, 0.80, 0.30]], [62, [0.55, 0.78, 0.62]], [70, [0.20, 0.62, 0.68]]];
const ERR_RAMP = [[2, [0.20, 0.62, 0.68]], [3.5, [0.55, 0.78, 0.62]], [5, [0.95, 0.80, 0.30]], [7, [0.93, 0.55, 0.15]], [10, [0.80, 0.20, 0.16]]];
const HEAT_RAMP = [[0, [0.30, 0.34, 0.37]], [0.15, [0.20, 0.62, 0.68]], [0.5, [0.95, 0.80, 0.30]], [1, [0.93, 0.45, 0.15]]];
function rampColor(v, ramp = RAMP) {
  if (v <= ramp[0][0]) return ramp[0][1];
  for (let i = 1; i < ramp.length; i++) if (v <= ramp[i][0]) { const [a, ca] = ramp[i - 1], [b, cb] = ramp[i]; const t = (v - a) / (b - a); return ca.map((c, k) => c + (cb[k] - c) * t); }
  return ramp[ramp.length - 1][1];
}
const rgb = c => `rgb(${c.map(x => Math.round(x * 255)).join(',')})`;
function speedAt(i, h) { const a = Math.floor(h) % 24, b = (a + 1) % 24, t = h - Math.floor(h); return D.hs[i][a] * (1 - t) + D.hs[i][b] * t; }
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- graph: dense adjacency with self-loops, as in adj_mx.pkl ---------- */
const A = new Float32Array(N * N);
for (let i = 0; i < N; i++) A[i * N + i] = 1;
D.edges.forEach(([i, j, w]) => { A[i * N + j] = w; });
const dOut = new Float32Array(N), dIn = new Float32Array(N);
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { dOut[i] += A[i * N + j]; dIn[j] += A[i * N + j]; }
const nbrOut = Array.from({ length: N }, () => []), nbrIn = Array.from({ length: N }, () => []);
D.edges.forEach(([i, j, w]) => { nbrOut[i].push([j, w]); nbrIn[j].push([i, w]); });
const neighbours = i => [...new Set(nbrOut[i].map(x => x[0]).concat(nbrIn[i].map(x => x[0])))];
/* row i of sum_{k=1..K} P^k: how much sensor i reads from each sensor (DCRNN supports) */
function diffuseRow(i, K, dir) {
  const acc = new Float32Array(N);
  const run = fwd => {
    let r = new Float32Array(N); r[i] = 1;
    for (let k = 0; k < K; k++) {
      const nx = new Float32Array(N);
      for (let m = 0; m < N; m++) { const rm = r[m]; if (!rm) continue;
        if (fwd) { const inv = rm / dOut[m]; for (let j = 0; j < N; j++) { const a = A[m * N + j]; if (a) nx[j] += a * inv; } }
        else { const inv = rm / dIn[m]; for (let j = 0; j < N; j++) { const a = A[j * N + m]; if (a) nx[j] += a * inv; } } }
      r = nx; for (let j = 0; j < N; j++) acc[j] += r[j];
    }
  };
  if (dir !== 'rev') run(true);
  if (dir !== 'fwd') run(false);
  return acc;
}

/* ---------- shared state + quick focus indices ---------- */
const target = D.ids.indexOf(D.case.sensor);
const idxHub = D.deg.reduce((best, v, i) => v > D.deg[best] ? i : best, 0);
const idxGain = D.mae60.dcrnn.reduce((best, v, i) => (D.mae60.gru_local[i] - v) > (D.mae60.gru_local[best] - D.mae60.dcrnn[best]) ? i : best, 0);
const idxMiss = D.zeroPct.reduce((best, v, i) => v > D.zeroPct[best] ? i : best, 0);
const state = { mode: 'speed', hour: 17, playing: false, selected: target, errModel: 'dcrnn', diffK: 2, diffDir: 'both', diffRow: null };

/* =================== 3D scene =================== */
const canvas = $('#scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
catch (e) { canvas.replaceWith(Object.assign(document.createElement('p'), { className: 'wrap hint', textContent: 'This browser could not start WebGL, so the 3D map is off. Everything below still works.' })); }
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
camera.position.set(0, 40, 50);
let controls = null;
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 15; controls.maxDistance = 120;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.35;
  canvas.addEventListener('pointerdown', () => controls.autoRotate = false);
}
const latMid = (Math.min(...D.lat) + Math.max(...D.lat)) / 2, lonMid = (Math.min(...D.lon) + Math.max(...D.lon)) / 2;
const K3 = 110, cosL = Math.cos(latMid * Math.PI / 180);
const P = D.ids.map((_, i) => new THREE.Vector3((D.lon[i] - lonMid) * cosL * K3, 0, -(D.lat[i] - latMid) * K3));

scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.85));
const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(20, 40, 10); scene.add(sun);
const grid = new THREE.GridHelper(80, 40); scene.add(grid);

const seen = new Set(), und = [];
D.edges.forEach(([i, j, w]) => { const k = i < j ? i + '-' + j : j + '-' + i; if (!seen.has(k)) { seen.add(k); und.push([Math.min(i, j), Math.max(i, j), w]); } });
const linePos = new Float32Array(und.length * 6);
und.forEach(([i, j], n) => { linePos.set([P[i].x, 0.05, P[i].z, P[j].x, 0.05, P[j].z], n * 6); });
const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
const lineMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 });
const lines = new THREE.LineSegments(lineGeo, lineMat); scene.add(lines);

const box = new THREE.BoxGeometry(0.55, 1, 0.55); box.translate(0, 0.5, 0);
const pillars = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), N);
pillars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(pillars);
const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
const curH = new Float32Array(N).fill(0.1);
const curC = Array.from({ length: N }, () => [0.5, 0.5, 0.5]);

const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 32), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.visible = false; scene.add(ring);

/* Elevated 1-hop guide arcs + elevated 3D message-passing pulses */
const MAX_ARCS = 120, ARC_SEG = 10;
const hopGeo = new THREE.BufferGeometry();
const hopPos = new Float32Array(MAX_ARCS * ARC_SEG * 6);
hopGeo.setAttribute('position', new THREE.BufferAttribute(hopPos, 3));
const hopMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.72 });
const hopLines = new THREE.LineSegments(hopGeo, hopMat); hopLines.visible = false; scene.add(hopLines);

const MAXP = 1400;
const pulseGeo = new THREE.BufferGeometry();
const pulsePos = new Float32Array(MAXP * 3);
pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
const pulseMat = new THREE.PointsMaterial({ size: 0.9, transparent: true, opacity: 0.98 });
const pulses = new THREE.Points(pulseGeo, pulseMat); pulses.visible = false; scene.add(pulses);
let pulseList = [];
function buildPulses(src) {
  pulseList = [];
  const oneHop = neighbours(src);
  oneHop.forEach(j => {
    pulseList.push({ a: src, b: j, delay: 0, w: A[src * N + j] || A[j * N + src] });
    neighbours(j).forEach(k => { if (k !== src) pulseList.push({ a: j, b: k, delay: 1, w: A[j * N + k] || A[k * N + j] }); });
  });
  pulseList = pulseList.slice(0, MAXP);
  // Build parabolic guide arcs for 1-hop links above pillar tops
  let v = 0;
  oneHop.slice(0, MAX_ARCS).forEach(j => {
    const a = P[src], b = P[j], apex = 3.2;
    for (let s = 0; s < ARC_SEG; s++) {
      const t0 = s / ARC_SEG, t1 = (s + 1) / ARC_SEG;
      const y0 = 1.6 + Math.sin(t0 * Math.PI) * apex;
      const y1 = 1.6 + Math.sin(t1 * Math.PI) * apex;
      hopPos[v++] = a.x + (b.x - a.x) * t0; hopPos[v++] = y0; hopPos[v++] = a.z + (b.z - a.z) * t0;
      hopPos[v++] = a.x + (b.x - a.x) * t1; hopPos[v++] = y1; hopPos[v++] = a.z + (b.z - a.z) * t1;
    }
  });
  hopGeo.setDrawRange(0, v / 3);
  hopGeo.attributes.position.needsUpdate = true;
}

const theme = {};
function readTheme() {
  theme.bg = css('--scene-bg'); theme.ink = css('--ink');
  const b = new THREE.Color(theme.bg); theme.bgRGB = [b.r, b.g, b.b];
  scene.background = b; scene.fog = new THREE.Fog(theme.bg, 72, 155);
  grid.material.color = new THREE.Color(css('--grid')); grid.material.transparent = true; grid.material.opacity = 0.7;
  lineMat.color = new THREE.Color(theme.ink);
  ring.material.color = new THREE.Color(css('--paint'));
  hopMat.color = new THREE.Color(css('--cool'));
  pulseMat.color = new THREE.Color(css('--paint'));
  const ramp = state.mode === 'error' ? ERR_RAMP : state.mode === 'diffuse' ? HEAT_RAMP : RAMP;
  $('#legRamp').style.background = 'linear-gradient(90deg,' + ramp.map(r => rgb(r[1])).join(',') + ')';
}
readTheme();
const onTheme = () => { readTheme(); emit('theme'); };
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme);
new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function updatePillars(dt) {
  const m = state.mode, sel = state.selected;
  const near = new Set(); if (m === 'graph' || m === 'pass') { near.add(sel); neighbours(sel).forEach(j => near.add(j)); }
  let dmax = 1e-9; if (m === 'diffuse' && state.diffRow) for (let i = 0; i < N; i++) if (i !== sel) dmax = Math.max(dmax, state.diffRow[i]);
  const k = Math.min(1, dt * 8);
  for (let i = 0; i < N; i++) {
    let h, c;
    if (m === 'error') { const e = D.mae60[state.errModel][i]; h = 0.3 + e * 1.35; c = rampColor(e, ERR_RAMP); }
    else if (m === 'diffuse') { const v = i === sel ? 1 : (state.diffRow ? state.diffRow[i] / dmax : 0); h = 0.2 + Math.sqrt(v) * 11; c = i === sel ? [0.95, 0.95, 0.95] : rampColor(Math.sqrt(v), HEAT_RAMP); if (v < 1e-4) c = c.map((x, q) => x * 0.25 + theme.bgRGB[q] * 0.75); }
    else { const v = speedAt(i, state.hour); h = 0.25 + Math.max(0, 70 - v) * 0.21; c = rampColor(v); }
    if ((m === 'graph' || m === 'pass') && !near.has(i)) c = c.map((x, q) => x * 0.20 + theme.bgRGB[q] * 0.80);
    curH[i] += (h - curH[i]) * k;
    const cc = curC[i]; for (let q = 0; q < 3; q++) cc[q] += (c[q] - cc[q]) * k;
    dummy.position.copy(P[i]); dummy.scale.set(1, curH[i], 1); dummy.updateMatrix();
    pillars.setMatrixAt(i, dummy.matrix); pillars.setColorAt(i, tmpC.setRGB(cc[0], cc[1], cc[2]));
  }
  pillars.instanceMatrix.needsUpdate = true; pillars.instanceColor.needsUpdate = true;
}
let pulseT = 0;
function updatePulses(dt) {
  if (!pulses.visible) return; pulseT = (pulseT + dt * 0.6) % 2.4;
  let n = 0;
  for (const p of pulseList) {
    const t = pulseT - p.delay; if (t < 0 || t > 1) continue;
    const a = P[p.a], b = P[p.b];
    const ha = Math.max(1.2, curH[p.a]), hb = Math.max(1.2, curH[p.b]);
    const yBase = ha * (1 - t) + hb * t;
    pulsePos[n * 3] = a.x + (b.x - a.x) * t;
    pulsePos[n * 3 + 1] = yBase + Math.sin(t * Math.PI) * (2.6 + 1.4 * p.w);
    pulsePos[n * 3 + 2] = a.z + (b.z - a.z) * t;
    n++;
  }
  pulseGeo.setDrawRange(0, n); pulseGeo.attributes.position.needsUpdate = true;
}
function resize() { if (!renderer) return; const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

let last = performance.now(), visible = true;
if (renderer) new IntersectionObserver(es => visible = es[0].isIntersecting).observe(canvas);
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (visible && renderer) {
    if (state.playing) { state.hour = (state.hour + dt * 1.2) % 24; syncHour(); }
    updatePillars(dt); updatePulses(dt); controls.update();
    const s = 1 + Math.sin(now / 300) * 0.08; ring.scale.set(s, s, s);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function syncHour() { const t = fmtH(state.hour); $('#clk').textContent = t; $('#hourLbl').textContent = t; $('#hour').value = state.hour; if (!$('#card').hidden) fillCard(state.selected); }
$('#hour').addEventListener('input', e => { state.hour = +e.target.value; state.playing = false; $('#play').textContent = '▶'; if (state.mode === 'error' || state.mode === 'diffuse') setMode('speed'); syncHour(); });
$('#play').addEventListener('click', () => { state.playing = !state.playing; $('#play').textContent = state.playing ? '❚❚' : '▶'; if (state.mode === 'error' || state.mode === 'diffuse') setMode('speed'); });

const NOTES = {
  speed: ['Speed by hour', "Each pillar sits at a real Los Angeles County loop detector's GPS location (METR-LA). Height rises as speed drops below 70. Press play to watch 07–09 am and 16–19 pm rush hours.", 'Mean speed (source units, likely mph)', '20', '70', 'Pillar height = drop below 70'],
  graph: ['Road graph', `Lines show the ${D.edges.length.toLocaleString('en')} directed off-diagonal road-distance links of METR-LA (${D.geo.totalDirectedEdges.toLocaleString('en')} total including self-loops). Click any pillar to inspect its neighbours.`, 'Mean speed (source units, likely mph)', '20', '70', 'Lit = selected sensor + neighbours'],
  pass: ['Message passing', 'Glowing arcs show 2-hop neighbour message passing from the selected LA sensor. GAT learns dynamic attention weights across neighbours; DCRNN diffuses forward and reverse walks.', 'Mean speed (source units, likely mph)', '20', '70', 'Arcs & pulses = 2-hop messages'],
  diffuse: ['DCRNN diffusion', 'Pillar height shows how much the selected LA sensor reads from every other sensor after K random-walk hops computed live from adj_mx.pkl. Adjust K and direction in the DCRNN deep dive.', 'Diffusion weight (relative)', 'none', 'most', 'White pillar = selected sensor'],
  error: ['60-min error', "Height and colour show each sensor's real 60-minute test MAE across held-out June 2012 readings. Switch models to see graph models flatten spikes on busy LA corridors.", 'Test MAE at 60 min', '2', '10', 'Taller = worse forecast'],
};
function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.chip[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  $('#errModel').hidden = m !== 'error';
  lines.visible = m === 'graph' || m === 'pass' || m === 'diffuse'; lineMat.opacity = m === 'graph' ? 0.35 : 0.14;
  pulses.visible = m === 'pass'; hopLines.visible = m === 'pass';
  if (m === 'pass') buildPulses(state.selected);
  if (m === 'diffuse') state.diffRow = diffuseRow(state.selected, state.diffK, state.diffDir);
  if (m === 'diffuse' || m === 'error') { state.playing = false; $('#play').textContent = '▶'; }
  ring.visible = m === 'graph' || m === 'pass' || m === 'diffuse' || !$('#card').hidden;
  ring.position.x = P[state.selected].x; ring.position.z = P[state.selected].z;
  const [a, b, c, lo, hi, note] = NOTES[m];
  $('#mnLabel').textContent = a; $('#mnText').textContent = b; $('#legTitle').textContent = c; $('#legLo').textContent = lo; $('#legHi').textContent = hi; $('#legNote').textContent = note;
  $('#clkSub').textContent = m === 'error' ? 'Held-out test period, ' + $('#errModel').selectedOptions[0].text : m === 'diffuse' ? `K = ${state.diffK}, ${state.diffDir === 'both' ? 'forward + reverse' : state.diffDir === 'fwd' ? 'forward' : 'reverse'}` : 'LA hourly average, Mar–Jun 2012';
  if (m === 'diffuse' || m === 'error') $('#clk').textContent = m === 'error' ? 'MAE' : 'K=' + state.diffK; else syncHour();
  readTheme();
  if ((m === 'graph' || m === 'pass' || m === 'diffuse') && $('#card').hidden) selectSensor(state.selected);
}
document.querySelectorAll('.chip[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('#errModel').addEventListener('change', e => { state.errModel = e.target.value; setMode('error'); });

const NAMES = { xgboost_ha: 'XGBoost + HA', gru_local: 'GRU local', gat: 'GAT', dcrnn: 'DCRNN' };
function fillCard(i) {
  $('#cId').textContent = D.ids[i] + (i === target ? ' · Case study' : i === idxHub ? ' · Top hub' : '');
  const rows = [
    ['LA coordinates', `${D.lat[i].toFixed(3)}°N, ${Math.abs(D.lon[i]).toFixed(3)}°W`],
    ['Coord region', D.region[i]],
    ['Speed at ' + fmtH(state.hour), speedAt(i, state.hour).toFixed(1) + ' u'],
    ['Zero-outage rate', `${D.zeroPct[i].toFixed(1)}% (${D.outageRuns[i]} runs)`],
    ['Road links (in+out)', D.deg[i]],
    ['GAT self-attention', Math.round(D.att.mass_self[i] * 100) + '%'],
  ];
  for (const m of ['xgboost_ha', 'gru_local', 'gat', 'dcrnn']) rows.push(['60m MAE · ' + NAMES[m], D.mae60[m][i].toFixed(2)]);
  $('#cKv').innerHTML = rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  const g = D.mae60.gru_local[i] - D.mae60.dcrnn[i];
  $('#cHint').textContent = g > 0 ? `DCRNN beats no-graph GRU by ${g.toFixed(2)} MAE here.` : `Graph does not improve this sensor (${g.toFixed(2)} MAE).`;
}
function selectSensor(i, quiet) {
  state.selected = i; $('#card').hidden = false; fillCard(i);
  ring.visible = true; ring.position.x = P[i].x; ring.position.z = P[i].z;
  if (state.mode === 'pass') buildPulses(i);
  if (state.mode === 'diffuse') { state.diffRow = diffuseRow(i, state.diffK, state.diffDir); }
  if (!quiet) emit('sensor', i);
}
$('#sensorPick').addEventListener('change', e => {
  const map = { case: target, hub: idxHub, gain: idxGain, miss: idxMiss };
  selectSensor(map[e.target.value] ?? target);
});
$('#cardX').addEventListener('click', () => { $('#card').hidden = true; ring.visible = ['graph', 'pass', 'diffuse'].includes(state.mode); });
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let downAt = null;
canvas.addEventListener('pointerdown', e => downAt = [e.clientX, e.clientY]);
canvas.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const r = canvas.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera); const hit = ray.intersectObject(pillars)[0];
  if (hit && hit.instanceId != null) selectSensor(hit.instanceId);
});
const toMap = () => $('#top').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
$('#toPass').addEventListener('click', () => { selectSensor(target); setMode('pass'); toMap(); });

/* =================== 2D charts =================== */
function axesY(svg, x0, x1, y, ticks, fmt = v => v) { ticks.forEach(t => { const yy = y(t); el('line', { x1: x0, x2: x1, y1: yy, y2: yy, class: 'ax', 'stroke-dasharray': '2 4' }, svg); el('text', { x: x0 - 8, y: yy + 4, 'text-anchor': 'end' }, svg, fmt(t)); }); }

function drawHourChart() {
  const s = $('#hourChart'); s.innerHTML = ''; const L = 40, R = 548, T = 10, B = 172;
  const x = h => L + (R - L) * h / 23, y = v => B - (B - T) * (v - 45) / 20;
  axesY(s, L, R, y, [45, 50, 55, 60, 65]);
  [[7, 10, 'AM peak'], [16, 19, 'PM peak']].forEach(([a, b, t]) => { el('rect', { x: x(a), y: T, width: x(b) - x(a), height: B - T, fill: css('--paint'), opacity: 0.12 }, s); el('text', { x: (x(a) + x(b)) / 2, y: T + 12, 'text-anchor': 'middle' }, s, t); });
  const pts = D.hourly.map((v, h) => [x(h), y(v)]);
  el('path', { d: 'M' + pts.map(p => p.join(',')).join('L') + `L${R},${B}L${L},${B}Z`, fill: css('--cool'), opacity: 0.12 }, s);
  el('path', { d: 'M' + pts.map(p => p.join(',')).join('L'), fill: 'none', stroke: css('--cool'), 'stroke-width': 2.2 }, s);
  [0, 6, 12, 18, 23].forEach(h => el('text', { x: x(h), y: B + 18, 'text-anchor': 'middle' }, s, String(h).padStart(2, '0') + ':00'));
  el('circle', { cx: x(17), cy: y(D.hourly[17]), r: 4, fill: css('--hot') }, s);
  el('text', { x: x(17) + 8, y: y(D.hourly[17]) + 4, class: 'ink' }, s, '49.9 at 17:00');
}

/* Section 02 sliding window (fixed label overlap) + interactive feature group explainer */
const cs = D.case; const series = cs.y5min;
const tLbl = i => { const [h, m] = cs.t[i].split(':').map(Number); const mm = h * 60 + m + 5; return String(Math.floor(mm / 60) % 24).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0'); };
$('#winPos').max = series.length - 13;
function drawWindow() {
  const k = +$('#winPos').value; const s = $('#winChart'); s.innerHTML = '';
  const L = 34, R = 552, T = 20, B = 146, n = series.length;
  const x = i => L + (R - L) * i / (n - 1), y = v => B - (B - T) * v / 70;
  axesY(s, L, R, y, [0, 35, 70]);
  el('rect', { x: x(k - 11), y: T, width: x(k) - x(k - 11), height: B - T, fill: css('--paint'), opacity: 0.18 }, s);
  el('rect', { x: x(k), y: T, width: x(k + 12) - x(k), height: B - T, fill: 'none', stroke: css('--paint'), 'stroke-dasharray': '4 3' }, s);
  el('path', { d: 'M' + series.map((v, i) => x(i) + ',' + y(v)).join('L'), fill: 'none', stroke: css('--ink'), 'stroke-width': 1.6 }, s);
  [0, 24, 48, 72, 96].forEach(i => i < n && el('text', { x: x(i), y: B + 18, 'text-anchor': 'middle' }, s, tLbl(i)));
  // Place labels safely on either side of the cursor x(k) above the bands so they can never collide
  const curX = x(k);
  el('text', { x: Math.max(L + 84, curX - 6), y: T - 6, 'text-anchor': 'end', class: 'ink' }, s, '◀ INPUT (1h)');
  el('text', { x: Math.min(R - 64, curX + 6), y: T - 6, 'text-anchor': 'start', style: `fill:${css('--paint-ink')}` }, s, 'TARGETS ▶');
  el('line', { x1: curX, x2: curX, y1: T - 4, y2: B, stroke: css('--paint'), 'stroke-width': 1.5 }, s);

  $('#winTime').textContent = 'now = ' + tLbl(k);
  const win = series.slice(k - 11, k + 1), tg = [1, 3, 6, 12].map(d => series[k + d]);
  $('#strip').innerHTML = win.map((v, i) => `<div class="cell" style="background:${rgb(rampColor(v))}">${v.toFixed(0)}<small>${i === 11 ? 'now' : '−' + (11 - i) * 5}</small></div>`).join('') + '<div></div>' + tg.map((v, i) => `<div class="cell tgt">${v.toFixed(0)}<small>+${[5, 15, 30, 60][i]}</small></div>`).join('');
  const mean = a => a.reduce((p, c) => p + c, 0) / a.length;
  const now = win[11]; const hh = +tLbl(k).slice(0, 2);
  const F = [
    ['Lags (12)', `now ${now.toFixed(1)}, −5 ${win[10].toFixed(1)}, −10 ${win[9].toFixed(1)} …`],
    ['Rolling mean', `15m ${mean(win.slice(-3)).toFixed(1)} · 30m ${mean(win.slice(-6)).toFixed(1)} · 60m ${mean(win).toFixed(1)}`],
    ['Rolling min / max 30m', `${Math.min(...win.slice(-6)).toFixed(1)} / ${Math.max(...win.slice(-6)).toFixed(1)}`],
    ['Trend', `5m ${(now - win[10]).toFixed(1)} · 15m ${(now - win[8]).toFixed(1)} · 30m ${(now - win[5]).toFixed(1)}`],
    ['Time', `hour ${hh} · Monday · PM rush ${hh >= 16 && hh < 19 ? 'yes' : 'no'}`],
    ['Missing', 'now: no · last hour: 0'],
  ];
  $('#feats').innerHTML = F.map(([a, b]) => `<div class="feat"><div class="label">${a}</div><div class="v">${b}</div></div>`).join('');
  emit('window', k);
}
$('#winPos').addEventListener('input', drawWindow);

const FEAT_INFO = {
  lags: { title: 'Lags (12 columns)', cols: 'speed_lag_0 … speed_lag_11', why: 'Exact speed at now (t) back to 55 minutes ago (t-11). Same 12-step window becomes the raw sequence fed into GRU, GAT, and DCRNN.' },
  rolling: { title: 'Rolling Statistics (8 columns)', cols: 'rolling_mean_{15,30,60}min · rolling_std_{15,30,60}min (ddof=0) · rolling_min/max_30min', why: 'Smooths noisy 5-min fluctuations and measures recent volatility over the past 15, 30, and 60 minutes.' },
  trend: { title: 'Trend (3 columns)', cols: 'speed_change_5min · speed_change_15min · speed_change_30min', why: 'speed(t) − speed(t-k): tells tree models whether a jam is actively forming (negative) or recovering (positive).' },
  time: { title: 'Circular Calendar & Peak (7 columns)', cols: 'hour_sin, hour_cos, dow_sin, dow_cos, is_weekend, is_morning_peak, is_evening_peak', why: 'Puts hours and weekdays on a unit circle so 23:55 sits right next to 00:05. Biggest Phase 1 ablation jump (5.38 → 4.90).' },
  miss: { title: 'Missingness Indicators (2 columns)', cols: 'speed_missing_flag, missing_count_60min', why: 'Built from raw zero mask before forward-fill so models know when speed lags are frozen during an outage.' },
};
let openFeat = null;
document.querySelectorAll('#groupBar .gb-btn').forEach(btn => btn.addEventListener('click', () => {
  const grp = btn.dataset.grp;
  openFeat = openFeat === grp ? null : grp;
  document.querySelectorAll('#groupBar .gb-btn').forEach(b => b.setAttribute('aria-expanded', b.dataset.grp === openFeat));
  const box = $('#featDetail');
  if (!openFeat) { box.hidden = true; return; }
  const info = FEAT_INFO[openFeat];
  box.hidden = false;
  box.innerHTML = `<div class="label">${info.title}</div><div><code>${info.cols}</code></div><div class="cap">${info.why}</div>`;
}));

/* Phase 1 horizon chart (wider right margin so labels never clip) */
const HZ = [5, 15, 30, 60];
const P1 = [
  ['Persistence', [2.814, 3.499, 4.206, 5.380], '#9aa3a8', 'Persistence'],
  ['Historical avg', [4.188, 4.188, 4.188, 4.189], '#c9a9d9', 'Hist. avg'],
  ['Random Forest 32', [2.452, 3.167, 3.871, 4.854], '#7cc3c9', 'RF 32'],
  ['XGBoost 32', [2.362, 2.970, 3.564, 4.393], '#e5a08f', 'XGB 32'],
  ['XGBoost + HA 36', [2.312, 2.844, 3.275, 3.688], 'paint', 'XGB + HA'],
];
const p1on = P1.map(() => true);
function lineChart(svg, sets, on, yMin, yMax, ticks) {
  svg.innerHTML = ''; const L = 40, R = 420, T = 10, B = 248;
  const x = i => L + (R - L) * i / 3, y = v => B - (B - T) * (v - yMin) / (yMax - yMin);
  axesY(svg, L, R, y, ticks, v => v.toFixed(1));
  HZ.forEach((h, i) => el('text', { x: x(i), y: B + 18, 'text-anchor': 'middle' }, svg, '+' + h + ' min'));
  const labels = [];
  sets.forEach(([name, v, c, shortName], si) => { if (!on[si]) return; const col = c === 'paint' ? css('--paint') : c; const w = c === 'paint' ? 3.2 : 2;
    const path = el('path', { d: 'M' + v.map((m, i) => x(i) + ',' + y(m)).join('L'), fill: 'none', stroke: col, 'stroke-width': w }, svg);
    if (!reduce) { const len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len; path.getBoundingClientRect(); path.style.transition = 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)'; path.style.strokeDashoffset = 0; }
    v.forEach((m, i) => el('circle', { cx: x(i), cy: y(m), r: c === 'paint' ? 4 : 3, fill: col }, svg));
    labels.push([y(v[3]), shortName || name, v[3]]); });
  labels.sort((a, b) => a[0] - b[0]); for (let i = 1; i < labels.length; i++) if (labels[i][0] - labels[i - 1][0] < 15) labels[i][0] = labels[i - 1][0] + 15;
  labels.forEach(([yy, name, v]) => el('text', { x: R + 10, y: yy + 4, class: 'ink' }, svg, v.toFixed(2) + ' ' + name));
}
function toggles(host, sets, on, redraw) {
  host.innerHTML = ''; sets.forEach(([name, , c], i) => { const b = document.createElement('button'); b.className = 'tg'; b.setAttribute('aria-pressed', on[i]); b.innerHTML = `<i style="background:${c === 'paint' ? css('--paint') : c}"></i>${name}`; b.onclick = () => { on[i] = !on[i]; b.setAttribute('aria-pressed', on[i]); redraw(); }; host.appendChild(b); });
}
const drawP1 = () => lineChart($('#p1Chart'), P1, p1on, 2, 5.6, [2, 3, 4, 5]);

/* Section 04 interactive corridor illustration (A-E clickable + Play/Step + honest speed units) */
let roadT = 0.1, roadPlaying = !reduce, roadSel = 2; // 2 = C
function drawRoad() {
  const s = $('#road'); s.innerHTML = ''; const xs = [70, 175, 280, 385, 490], names = 'ABCDE';
  el('rect', { x: 10, y: 62, width: 540, height: 40, rx: 4, fill: css('--line') }, s);
  el('line', { x1: 14, x2: 546, y1: 82, y2: 82, stroke: css('--paint'), 'stroke-dasharray': '14 12', 'stroke-width': 2 }, s);
  el('text', { x: 14, y: 54 }, s, 'LA freeway traffic →');
  el('text', { x: 546, y: 124, 'text-anchor': 'end' }, s, '← jam grows upstream');
  const front = 560 - (roadT % 1) * 620;
  el('rect', { x: Math.max(10, front), y: 62, width: Math.max(0, 550 - Math.max(10, front)), height: 40, fill: css('--hot'), opacity: 0.28 }, s);
  const spd = xs.map(x => (x > front ? 15 : 65));
  if (roadSel < 4) {
    el('path', { d: `M${xs[roadSel]},40 Q${(xs[roadSel] + xs[roadSel + 1]) / 2},14 ${xs[roadSel + 1]},40`, fill: 'none', stroke: css('--cool'), 'stroke-width': 1.8, 'stroke-dasharray': '3 3' }, s);
    el('text', { x: (xs[roadSel] + xs[roadSel + 1]) / 2, y: 12, 'text-anchor': 'middle', style: 'fill:' + css('--cool') }, s, 'message');
  }
  xs.forEach((x, i) => {
    const g = el('g', { style: 'cursor:pointer' }, s);
    el('circle', { cx: x, cy: 82, r: i === roadSel ? 14 : 10, fill: rgb(rampColor(spd[i])), stroke: i === roadSel ? css('--ink') : 'none', 'stroke-width': 2.5 }, g);
    el('text', { x, y: 86, 'text-anchor': 'middle', style: 'fill:#11181c;font-weight:600' }, g, names[i]);
    el('text', { x, y: 150, 'text-anchor': 'middle', class: i === roadSel ? 'ink' : '' }, g, spd[i] + ' u');
    g.addEventListener('click', () => { roadSel = i; drawRoad(); });
  });
  const sSlow = spd[roadSel] < 40, nSlow = (roadSel < 4 && spd[roadSel + 1] < 40) || (roadSel > 0 && spd[roadSel - 1] < 40);
  const nm = names[roadSel];
  $('#roadFocus').innerHTML = `Inspecting sensor <b>${nm}</b> (click any sensor A–E)`;
  $('#vLocal').textContent = sSlow ? `Sensor ${nm}: jam already hit` : `Sensor ${nm}: stays fast (blind ahead)`;
  $('#vLocal').style.color = sSlow ? css('--hot') : css('--ink');
  $('#vGraph').textContent = sSlow ? `Sensor ${nm}: jam arrived (pre-warned)` : nSlow ? `Sensor ${nm}: neighbour slowing — warning!` : `Sensor ${nm}: corridor clear`;
  $('#vGraph').style.color = nSlow ? css('--cool') : css('--ink');
}
$('#roadPlay').addEventListener('click', () => { roadPlaying = !roadPlaying; $('#roadPlay').textContent = roadPlaying ? 'Pause' : 'Play'; });
$('#roadStep').addEventListener('click', () => { roadPlaying = false; $('#roadPlay').textContent = 'Play'; roadT += 0.08; drawRoad(); });
let roadVisible = false; new IntersectionObserver(es => roadVisible = es[0].isIntersecting).observe($('#road'));
let lastR = performance.now();
(function roadLoop(now) { if (roadVisible && roadPlaying && !reduce) { roadT += (now - lastR) / 9000; drawRoad(); } lastR = now; requestAnimationFrame(roadLoop); })(performance.now());

/* Section 05 ablation + bootstrap CI + table */
const ABL = [
  ['GRU local · no graph', 4.379, 'ctl'], ['GAT · identity graph', 4.364, 'ctl'], ['GAT · shuffled graph', 4.324, 'ctl'], ['GAT · real LA road graph', 4.175, 'gat'],
  ['DCRNN · identity graph', 4.385, 'ctl'], ['DCRNN · real LA road graph', 3.734, 'dcrnn'], ['XGBoost + HA (Phase 1)', 3.688, 'p1'],
];
function drawAbl() {
  const s = $('#ablChart'); s.innerHTML = ''; const L = 180, R = 520, lo = 3.4, hi = 4.5, rowH = 38;
  const x = v => L + (R - L) * (v - lo) / (hi - lo);
  [3.5, 4.0, 4.5].forEach(t => { el('line', { x1: x(t), x2: x(t), y1: 0, y2: ABL.length * rowH, class: 'ax', 'stroke-dasharray': '2 4' }, s); el('text', { x: x(t), y: ABL.length * rowH + 16, 'text-anchor': 'middle' }, s, t.toFixed(1)); });
  ABL.forEach(([n, v, k], i) => { const y = i * rowH + 8; const col = k === 'ctl' ? css('--muted') : k === 'p1' ? css('--line') : k === 'gat' ? css('--cool') : css('--paint');
    el('text', { x: L - 10, y: y + 15, 'text-anchor': 'end', class: k === 'ctl' ? '' : 'ink' }, s, n);
    el('rect', { x: L, y, width: x(v) - L, height: 22, rx: 2, fill: col, opacity: k === 'ctl' ? 0.45 : 1 }, s);
    el('text', { x: x(v) + 6, y: y + 15, class: 'ink' }, s, v.toFixed(3)); });
  el('text', { x: L, y: ABL.length * rowH + 34 }, s, 'axis starts at 3.4 · lower MAE is better');
}
const CI = [
  ['GAT vs GAT identity', 0.189, 0.154, 0.221], ['GAT shuffled vs identity', 0.040, 0.026, 0.054], ['GAT vs GAT shuffled', 0.149, 0.124, 0.174],
  ['DCRNN vs DCRNN identity', 0.650, 0.507, 0.785], ['GAT vs GRU local', 0.205, 0.168, 0.238], ['DCRNN vs XGBoost + HA', -0.046, -0.100, 0.004], ['GAT vs XGBoost + HA', -0.487, -0.580, -0.388],
];
function drawCI() {
  const lo = -0.65, hi = 0.85, W = 168; const x = v => W * (v - lo) / (hi - lo);
  const zeroPct = (x(0) / W * 100).toFixed(1);
  $('#ciList').innerHTML = CI.map(([n, m, a, b]) => { const col = a > 0 ? css('--cool') : b < 0 ? css('--hot') : css('--muted');
    return `<div class="ci-row" title="95% CI: [${a.toFixed(3)}, ${b.toFixed(3)}]"><span>${n} <span class="mono" style="color:${col}">${m > 0 ? '+' : ''}${m.toFixed(3)}</span> <span class="mono" style="color:var(--muted);font-size:.73rem">[${a.toFixed(2)}, ${b.toFixed(2)}]</span></span><svg viewBox="0 0 ${W} 16" style="width:${W}px"><line x1="${x(0)}" x2="${x(0)}" y1="0" y2="16" stroke="${css('--muted')}" stroke-width="1"/><line x1="${x(a)}" x2="${x(b)}" y1="8" y2="8" stroke="${col}" stroke-width="3"/><circle cx="${x(m)}" cy="8" r="3.5" fill="${col}"/></svg></div>`; }).join('')
    + `<div class="ci-axis"><span>Right of 0 = 1st model lowers MAE</span><div style="display:flex;justify-content:space-between;position:relative"><span>−0.6</span><span style="position:absolute;left:${zeroPct}%;transform:translateX(-50%)">0</span><span>+0.8</span></div></div>`;
}
const FULL = [
  ['Persistence (P1)', [2.814, 3.499, 4.206, 5.380]], ['XGBoost 32 (P1)', [2.362, 2.970, 3.564, 4.393]], ['XGBoost + HA 36 (P1)', [2.312, 2.844, 3.275, 3.688]],
  ['GRU local (no graph)', [2.369, 2.975, 3.560, 4.379]], ['GAT identity', [2.367, 2.971, 3.554, 4.364]], ['GAT shuffled', [2.365, 2.963, 3.536, 4.324]],
  ['DCRNN identity', [2.375, 2.977, 3.564, 4.385]], ['GAT (real road graph)', [2.331, 2.905, 3.443, 4.175]], ['DCRNN (real road graph)', [2.305, 2.799, 3.220, 3.734]],
];
(function () { const best = [0, 1, 2, 3].map(c => Math.min(...FULL.map(r => r[1][c])));
  $('#fullTable').innerHTML = '<tr><th>Model</th><th>+5 min</th><th>+15 min</th><th>+30 min</th><th>+60 min</th></tr>' + FULL.map(([n, v]) => `<tr><td>${n}</td>${v.map((m, c) => `<td class="${m === best[c] ? 'best' : ''}">${m.toFixed(3)}</td>`).join('')}</tr>`).join(''); })();

/* Section 06 case study with clickable story moments & pinned crosshair */
const CS = [['Persistence', 'persistence', '#9aa3a8', false], ['Random Forest', 'random_forest_32', '#7cc3c9', false], ['XGBoost + HA', 'xgboost_ha', '#e5a08f', true], ['GRU local', 'gru_local', '#c9a9d9', false], ['GAT', 'gat', 'cool', true], ['DCRNN', 'dcrnn', 'paint', true]];
const csCol = c => c === 'paint' ? css('--paint') : c === 'cool' ? css('--cool') : c;
const CASE_NOTES = {
  24: 'Early recovery: speed jumps from 8.9 to 48.2. Persistence/GAT stay near 10, while DCRNN already rises toward 29.1.',
  48: 'Surprise re-jam: traffic collapses from 64 to 10.2 within 60 min — every model missed this sudden evening breakdown.',
  66: 'Full clearing: traffic rebounds to 66.4. Persistence stays stuck at 15.2, while XGBoost + HA, GAT, and DCRNN all track recovery (~65).',
};
let csH = '60min', pinnedIdx = null;
const CL = 34, CR = 550, CT = 10, CB = 240;
function showCaseAt(i, act, n, x) {
  const off = csH === '60min' ? 12 : 3;
  const mm = 14 * 60 + (i + off) * 5;
  const t = String(Math.floor(mm / 60)).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
  $('#caseRead').innerHTML = `<b>${t}</b> (target) · actual <b>${act[i].toFixed(1)}</b> · ` + CS.filter(r => r[3]).map(([nm, key]) => `${nm} <b>${cs[key + '_' + csH][i].toFixed(1)}</b>`).join(' · ');
  $('#caseNote').textContent = CASE_NOTES[i] || 'Click any timestamp on the chart to lock or unlock the crosshair.';
  const cur = $('#caseCur');
  if (cur) { cur.setAttribute('x1', x(i + off)); cur.setAttribute('x2', x(i + off)); cur.setAttribute('opacity', 1); }
}
function drawCase() {
  const s = $('#caseChart'); s.innerHTML = ''; const n = cs.t.length, off = csH === '60min' ? 12 : 3;
  const x = i => CL + (CR - CL) * i / (n - 1 + 12), y = v => CB - (CB - CT) * v / 72;
  axesY(s, CL, CR, y, [0, 20, 40, 60]);
  for (let i = 0; i <= n + 12; i += 24) { const mm = 14 * 60 + i * 5; el('text', { x: x(i), y: CB + 18, 'text-anchor': 'middle' }, s, String(Math.floor(mm / 60)).padStart(2, '0') + ':00'); }
  const act = cs['y' + csH];
  el('path', { d: 'M' + act.map((v, i) => x(i + off) + ',' + y(v)).join('L'), fill: 'none', stroke: css('--ink'), 'stroke-width': 3, opacity: 0.35 }, s);
  CS.forEach(([, key, c, on]) => { if (!on) return; const v = cs[key + '_' + csH];
    el('path', { d: 'M' + v.map((p, i) => x(i + off) + ',' + y(p)).join('L'), fill: 'none', stroke: csCol(c), 'stroke-width': 1.8 }, s); });
  el('text', { x: CR, y: CT + 4, 'text-anchor': 'end', class: 'ink' }, s, 'grey = actual speed (LA sensor 717468)');
  el('line', { id: 'caseCur', x1: 0, x2: 0, y1: CT, y2: CB, stroke: css('--paint'), 'stroke-dasharray': '3 3', 'stroke-width': 1.5, opacity: 0 }, s);
  if (pinnedIdx != null) showCaseAt(pinnedIdx, act, n, x);
  const hit = el('rect', { x: CL, y: CT, width: CR - CL, height: CB - CT, fill: 'transparent', style: 'cursor:crosshair' }, s);
  const idxFromEv = e => {
    const r = s.getBoundingClientRect(); const vx = (e.clientX - r.left) / r.width * 560;
    return Math.max(0, Math.min(n - 1, Math.round((vx - CL) / (CR - CL) * (n - 1 + 12)) - off));
  };
  hit.addEventListener('pointermove', e => showCaseAt(idxFromEv(e), act, n, x));
  hit.addEventListener('click', e => {
    const idx = idxFromEv(e);
    pinnedIdx = pinnedIdx === idx ? null : idx;
    document.querySelectorAll('#caseMoments .tg').forEach(b => b.setAttribute('aria-pressed', +b.dataset.idx === pinnedIdx));
    if (pinnedIdx != null) showCaseAt(pinnedIdx, act, n, x);
    else { $('#caseCur').setAttribute('opacity', 0); $('#caseRead').textContent = 'Hover or click the curve — or pick a moment above — to compare exact forecasts.'; $('#caseNote').textContent = ''; }
  });
  hit.addEventListener('pointerleave', () => {
    if (pinnedIdx != null) showCaseAt(pinnedIdx, act, n, x);
    else $('#caseCur').setAttribute('opacity', 0);
  });
}
function csToggles() { const host = $('#csToggles'); host.innerHTML = ''; CS.forEach(r => { const b = document.createElement('button'); b.className = 'tg'; b.setAttribute('aria-pressed', r[3]); b.innerHTML = `<i style="background:${csCol(r[2])}"></i>${r[0]}`; b.onclick = () => { r[3] = !r[3]; b.setAttribute('aria-pressed', r[3]); drawCase(); }; host.appendChild(b); }); }
document.querySelectorAll('#hzToggles .tg').forEach(b => b.addEventListener('click', () => { csH = b.dataset.h; document.querySelectorAll('#hzToggles .tg').forEach(o => o.setAttribute('aria-pressed', o === b)); drawCase(); }));
document.querySelectorAll('#caseMoments .tg').forEach(b => b.addEventListener('click', () => {
  const idx = +b.dataset.idx;
  pinnedIdx = pinnedIdx === idx ? null : idx;
  document.querySelectorAll('#caseMoments .tg').forEach(o => o.setAttribute('aria-pressed', +o.dataset.idx === pinnedIdx));
  drawCase();
  if (pinnedIdx == null) { $('#caseRead').textContent = 'Hover or click the curve — or pick a moment above — to compare exact forecasts.'; $('#caseNote').textContent = ''; }
}));

/* Section 07 signal sim summary */
function drawSim() {
  const a = $('#simBig'); a.innerHTML = ''; const L = 130, R = 500; const x = v => L + (R - L) * v / 2179.23;
  [['Fixed timing', 2179.23, css('--hot'), '72.8% cycles spill back'], ['Adaptive (any)', 26.68, css('--cool'), '0% spillback']].forEach(([n, v, c, note], i) => { const y = 10 + i * 50; const inside = x(v) + 8 > R;
    el('text', { x: L - 10, y: y + 16, 'text-anchor': 'end', class: 'ink' }, a, n);
    el('rect', { x: L, y, width: Math.max(3, x(v) - L), height: 24, rx: 2, fill: c }, a);
    el('text', { x: inside ? R - 8 : x(v) + 8, y: y + 16, 'text-anchor': inside ? 'end' : 'start', style: 'fill:' + (inside ? '#fff' : css('--ink')) }, a, v.toFixed(0) + ' s · ' + note); });
  const z = $('#simZoom'); z.innerHTML = ''; const rows = [['Perfect oracle (ref)', 26.28], ['DCRNN forecast', 26.67], ['XGBoost + HA forecast', 26.68], ['GAT forecast', 26.88], ['GRU local forecast', 27.00], ['Reactive (no forecast)', 27.35]];
  const zl = 26, zh = 27.5, ZL = 186, ZR = 500; const zx = v => ZL + (ZR - ZL) * (v - zl) / (zh - zl);
  [26, 26.5, 27, 27.5].forEach(t => { el('line', { x1: zx(t), x2: zx(t), y1: 0, y2: rows.length * 30, class: 'ax', 'stroke-dasharray': '2 4' }, z); el('text', { x: zx(t), y: rows.length * 30 + 16, 'text-anchor': 'middle' }, z, t.toFixed(1)); });
  rows.forEach(([n, v], i) => { const y = i * 30 + 4; const col = n.startsWith('Perfect') ? css('--muted') : n.startsWith('DCRNN') ? css('--paint') : n.startsWith('GAT') ? css('--cool') : css('--line');
    el('text', { x: ZL - 10, y: y + 14, 'text-anchor': 'end', class: 'ink' }, z, n);
    el('rect', { x: ZL, y, width: zx(v) - ZL, height: 18, rx: 2, fill: col }, z);
    el('text', { x: zx(v) + 6, y: y + 14, class: 'ink' }, z, v.toFixed(2) + ' s'); });
}

function redrawCharts() { drawHourChart(); drawWindow(); toggles($('#p1toggles'), P1, p1on, drawP1); drawP1(); drawRoad(); drawAbl(); drawCI(); csToggles(); drawCase(); drawSim(); }
addEventListener('theme', redrawCharts);

/* section rail with hover tips + keyboard nav */
const stopNames = ['3D LA Map', '01 Data', '02 Features', '03 Phase 1', '04 Why Graphs', '05 Graph Models', '06 Case Study', '07 Signal Sim', '08 Limits & Q&A'];
const stops = ['top', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map(id => document.getElementById(id));
const rail = $('#rail'); stops.forEach((s, i) => { const a = document.createElement('a'); a.href = '#' + s.id; a.setAttribute('aria-label', stopNames[i]); a.setAttribute('data-tip', stopNames[i]); rail.appendChild(a); });
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const i = stops.indexOf(e.target); rail.querySelectorAll('a').forEach((a, j) => a.classList.toggle('on', j === i)); } }), { rootMargin: '-45% 0px -45% 0px' });
stops.forEach(s => io.observe(s));
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,select,textarea')) return;
  const nextKeys = ['ArrowRight', 'PageDown'], prevKeys = ['ArrowLeft', 'PageUp']; if (![...nextKeys, ...prevKeys].includes(e.key)) return;
  e.preventDefault(); const y = scrollY + 80; let i = stops.findIndex(s => s.offsetTop > y); if (i < 0) i = stops.length;
  const cur = i - 1; const to = nextKeys.includes(e.key) ? Math.min(stops.length - 1, cur + 1) : Math.max(0, cur - 1);
  stops[to].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
});

window.App = { D, N, A, css, el, $, rgb, rampColor, mulberry, reduce, state, neighbours, nbrOut, nbrIn, diffuseRow, series, tLbl, axesY,
  selectSensor, setMode, toMap, target,
  setDiffusion(K, dir) { state.diffK = K; state.diffDir = dir; if (state.mode === 'diffuse') setMode('diffuse'); } };

redrawCharts();
setMode('speed'); syncHour();
})();
