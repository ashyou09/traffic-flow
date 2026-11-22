/* METR-LA Forecast Lab: 3D map, section charts, shared helpers (window.App). Data: window.DATA from data.js */
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

/* ---------- shared state + events ---------- */
const target = D.ids.indexOf(D.case.sensor);
const state = { mode: 'speed', hour: 17, playing: false, selected: target, errModel: 'dcrnn', diffK: 2, diffDir: 'both', diffRow: null };
const emit = (name, detail) => dispatchEvent(new CustomEvent(name, { detail }));

/* =================== 3D scene =================== */
const canvas = $('#scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
catch (e) { canvas.replaceWith(Object.assign(document.createElement('p'), { className: 'wrap hint', textContent: 'This browser could not start WebGL, so the 3D map is off. Everything below still works.' })); }
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
camera.position.set(0, 42, 52);
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

const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false; scene.add(ring);

const MAXP = 1400;
const pulseGeo = new THREE.BufferGeometry();
const pulsePos = new Float32Array(MAXP * 3);
pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
const pulseMat = new THREE.PointsMaterial({ size: 0.5, transparent: true, opacity: 0.95 });
const pulses = new THREE.Points(pulseGeo, pulseMat); pulses.visible = false; scene.add(pulses);
let pulseList = [];
function buildPulses(src) {
  pulseList = [];
  neighbours(src).forEach(j => { pulseList.push({ a: src, b: j, delay: 0, w: A[src * N + j] || A[j * N + src] });
    neighbours(j).forEach(k => { if (k !== src) pulseList.push({ a: j, b: k, delay: 1, w: A[j * N + k] || A[k * N + j] }); }); });
  pulseList = pulseList.slice(0, MAXP);
}

const theme = {};
function readTheme() {
  theme.bg = css('--scene-bg'); theme.ink = css('--ink');
  const b = new THREE.Color(theme.bg); theme.bgRGB = [b.r, b.g, b.b];
  scene.background = b; scene.fog = new THREE.Fog(theme.bg, 70, 150);
  grid.material.color = new THREE.Color(css('--grid')); grid.material.transparent = true; grid.material.opacity = 0.7;
  lineMat.color = new THREE.Color(theme.ink); ring.material.color = new THREE.Color(css('--paint')); pulseMat.color = new THREE.Color(css('--paint'));
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
    if (m === 'error') { const e = D.mae60[state.errModel][i]; h = 0.3 + e * 1.4; c = rampColor(e, ERR_RAMP); }
    else if (m === 'diffuse') { const v = i === sel ? 1 : (state.diffRow ? state.diffRow[i] / dmax : 0); h = 0.2 + Math.sqrt(v) * 12; c = i === sel ? [0.95, 0.95, 0.95] : rampColor(Math.sqrt(v), HEAT_RAMP); if (v < 1e-4) c = c.map((x, q) => x * 0.25 + theme.bgRGB[q] * 0.75); }
    else { const v = speedAt(i, state.hour); h = 0.25 + Math.max(0, 70 - v) * 0.22; c = rampColor(v); }
    if ((m === 'graph' || m === 'pass') && !near.has(i)) c = c.map((x, q) => x * 0.22 + theme.bgRGB[q] * 0.78);
    curH[i] += (h - curH[i]) * k;
    const cc = curC[i]; for (let q = 0; q < 3; q++) cc[q] += (c[q] - cc[q]) * k;
    dummy.position.copy(P[i]); dummy.scale.set(1, curH[i], 1); dummy.updateMatrix();
    pillars.setMatrixAt(i, dummy.matrix); pillars.setColorAt(i, tmpC.setRGB(cc[0], cc[1], cc[2]));
  }
  pillars.instanceMatrix.needsUpdate = true; pillars.instanceColor.needsUpdate = true;
}
let pulseT = 0;
function updatePulses(dt) {
  if (!pulses.visible) return; pulseT = (pulseT + dt * 0.55) % 2.6;
  let n = 0;
  for (const p of pulseList) {
    const t = pulseT - p.delay; if (t < 0 || t > 1) continue;
    const a = P[p.a], b = P[p.b];
    pulsePos[n * 3] = a.x + (b.x - a.x) * t; pulsePos[n * 3 + 1] = 0.4 + Math.sin(t * Math.PI) * 1.2 * p.w; pulsePos[n * 3 + 2] = a.z + (b.z - a.z) * t; n++;
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
  speed: ['Speed by hour', "Each pillar is one sensor at its real location. Colour and height come from that sensor's average speed at this hour across all 17 weeks. Press play and watch the 7–9 am and 4–7 pm rush hours eat into the network.", 'Mean speed (source units, likely mph)', '20', '70', 'Pillar height = drop below 70'],
  graph: ['Road graph', `The lines are the ${D.edges.length.toLocaleString('en')} directed road-distance links of the DCRNN adjacency (plus ${D.selfLoops} self-links), drawn as ${und.length.toLocaleString('en')} lines. The selected sensor and its direct neighbours stay lit. Click any pillar to see who it is connected to.`, 'Mean speed (source units, likely mph)', '20', '70', 'Lit = selected sensor + neighbours'],
  pass: ['Message passing', 'One round of a graph layer: each sensor sends its state to its neighbours, then the neighbours pass it on. Two hops out from the selected sensor are shown. GAT weighs each message with learned attention, and DCRNN diffuses it along the links.', 'Mean speed (source units, likely mph)', '20', '70', 'Pulses = messages along road links'],
  diffuse: ['DCRNN diffusion', 'Height shows how much the selected sensor reads from every other sensor after K random-walk hops, forward and reverse, computed live from the real adjacency matrix. This is what a DCRNN graph convolution mixes. Click another pillar, or change K in the DCRNN deep dive.', 'Diffusion weight (relative)', 'none', 'most', 'White pillar = selected sensor'],
  error: ['60-min error', "Height and colour show each sensor's mean absolute error 60 minutes ahead, over the full test period. Switch models: the graph models flatten the worst spikes, but junction-heavy central sensors stay hard.", 'Test MAE at 60 min', '2', '10', 'Taller = worse forecast'],
};
function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.chip[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  $('#errModel').hidden = m !== 'error';
  lines.visible = m === 'graph' || m === 'pass' || m === 'diffuse'; lineMat.opacity = m === 'graph' ? 0.35 : 0.14;
  pulses.visible = m === 'pass'; if (m === 'pass') buildPulses(state.selected);
  if (m === 'diffuse') state.diffRow = diffuseRow(state.selected, state.diffK, state.diffDir);
  if (m === 'diffuse' || m === 'error') { state.playing = false; $('#play').textContent = '▶'; }
  ring.visible = m === 'graph' || m === 'pass' || m === 'diffuse' || !$('#card').hidden;
  ring.position.x = P[state.selected].x; ring.position.z = P[state.selected].z;
  const [a, b, c, lo, hi, note] = NOTES[m];
  $('#mnLabel').textContent = a; $('#mnText').textContent = b; $('#legTitle').textContent = c; $('#legLo').textContent = lo; $('#legHi').textContent = hi; $('#legNote').textContent = note;
  $('#clkSub').textContent = m === 'error' ? 'Whole test period, ' + $('#errModel').selectedOptions[0].text : m === 'diffuse' ? `K = ${state.diffK}, ${state.diffDir === 'both' ? 'forward + reverse' : state.diffDir === 'fwd' ? 'forward' : 'reverse'}` : 'Average speed at this hour, Mar–Jun 2012';
  if (m === 'diffuse' || m === 'error') $('#clk').textContent = m === 'error' ? 'MAE' : 'K=' + state.diffK; else syncHour();
  readTheme();
  if ((m === 'graph' || m === 'pass' || m === 'diffuse') && $('#card').hidden) selectSensor(state.selected);
}
document.querySelectorAll('.chip[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('#errModel').addEventListener('change', e => { state.errModel = e.target.value; setMode('error'); });

const NAMES = { xgboost_ha: 'XGBoost + HA', gru_local: 'GRU local', gat: 'GAT', dcrnn: 'DCRNN' };
function fillCard(i) {
  $('#cId').textContent = D.ids[i] + (i === target ? ' · case study' : '');
  const rows = [['Speed at ' + fmtH(state.hour), speedAt(i, state.hour).toFixed(1)], ['Road links (in + out)', D.deg[i]], ['GAT attention to itself', Math.round(D.att.mass_self[i] * 100) + '%']];
  for (const m of ['xgboost_ha', 'gru_local', 'gat', 'dcrnn']) rows.push(['MAE 60 min · ' + NAMES[m], D.mae60[m][i].toFixed(2)]);
  $('#cKv').innerHTML = rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  const g = D.mae60.gru_local[i] - D.mae60.dcrnn[i];
  $('#cHint').textContent = g > 0 ? `DCRNN beats the no-graph GRU here by ${g.toFixed(2)}.` : `The graph does not help this sensor (${g.toFixed(2)}).`;
}
function selectSensor(i, quiet) {
  state.selected = i; $('#card').hidden = false; fillCard(i);
  ring.visible = true; ring.position.x = P[i].x; ring.position.z = P[i].z;
  if (state.mode === 'pass') buildPulses(i);
  if (state.mode === 'diffuse') { state.diffRow = diffuseRow(i, state.diffK, state.diffDir); }
  if (!quiet) emit('sensor', i);
}
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

/* sliding window: series[k] = speed at origin k + 5 min */
const cs = D.case; const series = cs.y5min;
const tLbl = i => { const [h, m] = cs.t[i].split(':').map(Number); const mm = h * 60 + m + 5; return String(Math.floor(mm / 60) % 24).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0'); };
$('#winPos').max = series.length - 13;
function drawWindow() {
  const k = +$('#winPos').value; const s = $('#winChart'); s.innerHTML = '';
  const L = 34, R = 552, T = 8, B = 140, n = series.length;
  const x = i => L + (R - L) * i / (n - 1), y = v => B - (B - T) * v / 70;
  axesY(s, L, R, y, [0, 35, 70]);
  el('rect', { x: x(k - 11), y: T, width: x(k) - x(k - 11), height: B - T, fill: css('--paint'), opacity: 0.18 }, s);
  el('rect', { x: x(k), y: T, width: x(k + 12) - x(k), height: B - T, fill: 'none', stroke: css('--paint'), 'stroke-dasharray': '4 3' }, s);
  el('path', { d: 'M' + series.map((v, i) => x(i) + ',' + y(v)).join('L'), fill: 'none', stroke: css('--ink'), 'stroke-width': 1.6 }, s);
  [0, 24, 48, 72, 96].forEach(i => i < n && el('text', { x: x(i), y: B + 18, 'text-anchor': 'middle' }, s, tLbl(i)));
  el('text', { x: (x(k - 11) + x(k)) / 2, y: T + 14, 'text-anchor': 'middle', class: 'ink' }, s, 'input: last hour');
  el('text', { x: (x(k) + x(k + 12)) / 2, y: T + 14, 'text-anchor': 'middle' }, s, 'targets');
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

/* Phase 1 horizon chart */
const HZ = [5, 15, 30, 60];
const P1 = [
  ['Persistence', [2.814, 3.499, 4.206, 5.380], '#9aa3a8'],
  ['Historical avg', [4.188, 4.188, 4.188, 4.189], '#c9a9d9'],
  ['Random Forest 32', [2.452, 3.167, 3.871, 4.854], '#7cc3c9'],
  ['XGBoost 32', [2.362, 2.970, 3.564, 4.393], '#e5a08f'],
  ['XGBoost + HA 36', [2.312, 2.844, 3.275, 3.688], 'paint'],
];
const p1on = P1.map(() => true);
function lineChart(svg, sets, on, yMin, yMax, ticks) {
  svg.innerHTML = ''; const L = 40, R = 470, T = 10, B = 248;
  const x = i => L + (R - L) * i / 3, y = v => B - (B - T) * (v - yMin) / (yMax - yMin);
  axesY(svg, L, R, y, ticks, v => v.toFixed(1));
  HZ.forEach((h, i) => el('text', { x: x(i), y: B + 18, 'text-anchor': 'middle' }, svg, '+' + h + ' min'));
  const labels = [];
  sets.forEach(([name, v, c], si) => { if (!on[si]) return; const col = c === 'paint' ? css('--paint') : c; const w = c === 'paint' ? 3.2 : 2;
    const path = el('path', { d: 'M' + v.map((m, i) => x(i) + ',' + y(m)).join('L'), fill: 'none', stroke: col, 'stroke-width': w }, svg);
    if (!reduce) { const len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len; path.getBoundingClientRect(); path.style.transition = 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)'; path.style.strokeDashoffset = 0; }
    v.forEach((m, i) => el('circle', { cx: x(i), cy: y(m), r: c === 'paint' ? 4 : 3, fill: col }, svg));
    labels.push([y(v[3]), name, v[3]]); });
  labels.sort((a, b) => a[0] - b[0]); for (let i = 1; i < labels.length; i++) if (labels[i][0] - labels[i - 1][0] < 14) labels[i][0] = labels[i - 1][0] + 14;
  labels.forEach(([yy, name, v]) => el('text', { x: R + 10, y: yy + 4, class: 'ink' }, svg, v.toFixed(2) + ' ' + (name.includes('HA 36') ? 'XGB+HA' : name.split(' ')[0])));
}
function toggles(host, sets, on, redraw) {
  host.innerHTML = ''; sets.forEach(([name, , c], i) => { const b = document.createElement('button'); b.className = 'tg'; b.setAttribute('aria-pressed', on[i]); b.innerHTML = `<i style="background:${c === 'paint' ? css('--paint') : c}"></i>${name}`; b.onclick = () => { on[i] = !on[i]; b.setAttribute('aria-pressed', on[i]); redraw(); }; host.appendChild(b); });
}
const drawP1 = () => lineChart($('#p1Chart'), P1, p1on, 2, 5.6, [2, 3, 4, 5]);

/* road illustration */
let roadT = 0.1;
function drawRoad() {
  const s = $('#road'); s.innerHTML = ''; const xs = [70, 175, 280, 385, 490], names = 'ABCDE';
  el('rect', { x: 10, y: 62, width: 540, height: 40, rx: 4, fill: css('--line') }, s);
  el('line', { x1: 14, x2: 546, y1: 82, y2: 82, stroke: css('--paint'), 'stroke-dasharray': '14 12', 'stroke-width': 2 }, s);
  el('text', { x: 14, y: 54 }, s, 'traffic →');
  el('text', { x: 546, y: 124, 'text-anchor': 'end' }, s, '← jam grows upstream');
  const front = 560 - (roadT % 1) * 620;
  el('rect', { x: Math.max(10, front), y: 62, width: Math.max(0, 550 - Math.max(10, front)), height: 40, fill: css('--hot'), opacity: 0.28 }, s);
  const spd = xs.map(x => (x > front ? 15 : 65));
  el('path', { d: `M${xs[2]},40 Q${(xs[2] + xs[3]) / 2},14 ${xs[3]},40`, fill: 'none', stroke: css('--cool'), 'stroke-width': 1.6, 'stroke-dasharray': '3 3' }, s);
  el('text', { x: (xs[2] + xs[3]) / 2, y: 12, 'text-anchor': 'middle', style: 'fill:' + css('--cool') }, s, 'message');
  xs.forEach((x, i) => { el('circle', { cx: x, cy: 82, r: i === 2 ? 13 : 10, fill: rgb(rampColor(spd[i])), stroke: i === 2 ? css('--ink') : 'none', 'stroke-width': 2 }, s); el('text', { x, y: 86, 'text-anchor': 'middle', style: 'fill:#11181c;font-weight:600' }, s, names[i]); el('text', { x, y: 150, 'text-anchor': 'middle' }, s, spd[i] + ' mph'); });
  const cSlow = spd[2] < 40, dSlow = spd[3] < 40;
  $('#vLocal').textContent = cSlow ? 'Jam is here, too late' : 'Stays fast';
  $('#vLocal').style.color = cSlow ? css('--hot') : css('--ink');
  $('#vGraph').textContent = cSlow ? 'Jam is here, as warned' : dSlow ? 'Slowdown coming' : 'Stays fast';
  $('#vGraph').style.color = dSlow ? css('--cool') : css('--ink');
}
let roadVisible = false; new IntersectionObserver(es => roadVisible = es[0].isIntersecting).observe($('#road'));
let lastR = performance.now();
(function roadLoop(now) { if (roadVisible && !reduce) { roadT += (now - lastR) / 9000; drawRoad(); } lastR = now; requestAnimationFrame(roadLoop); })(performance.now());

/* ablation */
const ABL = [
  ['GRU local · no graph', 4.379, 'ctl'], ['GAT · identity graph', 4.364, 'ctl'], ['GAT · shuffled graph', 4.324, 'ctl'], ['GAT · real road graph', 4.175, 'gat'],
  ['DCRNN · identity graph', 4.385, 'ctl'], ['DCRNN · real road graph', 3.734, 'dcrnn'], ['XGBoost + HA (Phase 1)', 3.688, 'p1'],
];
function drawAbl() {
  const s = $('#ablChart'); s.innerHTML = ''; const L = 172, R = 520, lo = 3.4, hi = 4.5, rowH = 38;
  const x = v => L + (R - L) * (v - lo) / (hi - lo);
  [3.5, 4.0, 4.5].forEach(t => { el('line', { x1: x(t), x2: x(t), y1: 0, y2: ABL.length * rowH, class: 'ax', 'stroke-dasharray': '2 4' }, s); el('text', { x: x(t), y: ABL.length * rowH + 16, 'text-anchor': 'middle' }, s, t.toFixed(1)); });
  ABL.forEach(([n, v, k], i) => { const y = i * rowH + 8; const col = k === 'ctl' ? css('--muted') : k === 'p1' ? css('--line') : k === 'gat' ? css('--cool') : css('--paint');
    el('text', { x: L - 10, y: y + 15, 'text-anchor': 'end', class: k === 'ctl' ? '' : 'ink' }, s, n);
    el('rect', { x: L, y, width: x(v) - L, height: 22, rx: 2, fill: col, opacity: k === 'ctl' ? 0.45 : 1 }, s);
    el('text', { x: x(v) + 6, y: y + 15, class: 'ink' }, s, v.toFixed(3)); });
  el('text', { x: L, y: ABL.length * rowH + 34 }, s, 'axis starts at 3.4 · lower is better');
}
const CI = [
  ['GAT vs GAT identity', 0.189, 0.154, 0.221], ['GAT shuffled vs GAT identity', 0.040, 0.026, 0.054], ['GAT vs GAT shuffled', 0.149, 0.124, 0.174],
  ['DCRNN vs DCRNN identity', 0.650, 0.507, 0.785], ['GAT vs GRU local', 0.205, 0.168, 0.238], ['DCRNN vs XGBoost + HA', -0.046, -0.100, 0.004], ['GAT vs XGBoost + HA', -0.487, -0.580, -0.388],
];
function drawCI() {
  const lo = -0.65, hi = 0.85, W = 150; const x = v => W * (v - lo) / (hi - lo);
  $('#ciList').innerHTML = CI.map(([n, m, a, b]) => { const col = a > 0 ? css('--cool') : b < 0 ? css('--hot') : css('--muted');
    return `<div class="ci-row"><span>${n} <span class="mono" style="color:${col}">${m > 0 ? '+' : ''}${m.toFixed(3)}</span></span><svg viewBox="0 0 ${W} 16" style="width:${W}px"><line x1="${x(0)}" x2="${x(0)}" y1="0" y2="16" stroke="${css('--muted')}" stroke-width="1"/><line x1="${x(a)}" x2="${x(b)}" y1="8" y2="8" stroke="${col}" stroke-width="3"/><circle cx="${x(m)}" cy="8" r="3.5" fill="${col}"/></svg></div>`; }).join('') +
    `<div class="hint">Right of the line = the first model has lower error. An interval crossing the line means no detectable difference.</div>`;
}
const FULL = [
  ['Persistence (P1)', [2.814, 3.499, 4.206, 5.380]], ['XGBoost 32 (P1)', [2.362, 2.970, 3.564, 4.393]], ['XGBoost + HA 36 (P1)', [2.312, 2.844, 3.275, 3.688]],
  ['GRU local (no graph)', [2.369, 2.975, 3.560, 4.379]], ['GAT identity', [2.367, 2.971, 3.554, 4.364]], ['GAT shuffled', [2.365, 2.963, 3.536, 4.324]],
  ['DCRNN identity', [2.375, 2.977, 3.564, 4.385]], ['GAT', [2.331, 2.905, 3.443, 4.175]], ['DCRNN', [2.305, 2.799, 3.220, 3.734]],
];
(function () { const best = [0, 1, 2, 3].map(c => Math.min(...FULL.map(r => r[1][c])));
  $('#fullTable').innerHTML = '<tr><th>Model</th><th>+5 min</th><th>+15 min</th><th>+30 min</th><th>+60 min</th></tr>' + FULL.map(([n, v]) => `<tr><td>${n}</td>${v.map((m, c) => `<td class="${m === best[c] ? 'best' : ''}">${m.toFixed(3)}</td>`).join('')}</tr>`).join(''); })();

/* case study */
const CS = [['Persistence', 'persistence', '#9aa3a8', false], ['Random Forest', 'random_forest_32', '#7cc3c9', false], ['XGBoost + HA', 'xgboost_ha', '#e5a08f', true], ['GRU local', 'gru_local', '#c9a9d9', false], ['GAT', 'gat', 'cool', true], ['DCRNN', 'dcrnn', 'paint', true]];
const csCol = c => c === 'paint' ? css('--paint') : c === 'cool' ? css('--cool') : c;
let csH = '60min';
const CL = 34, CR = 550, CT = 10, CB = 240;
function drawCase() {
  const s = $('#caseChart'); s.innerHTML = ''; const n = cs.t.length, off = csH === '60min' ? 12 : 3;
  const x = i => CL + (CR - CL) * i / (n - 1 + 12), y = v => CB - (CB - CT) * v / 72;
  axesY(s, CL, CR, y, [0, 20, 40, 60]);
  for (let i = 0; i <= n + 12; i += 24) { const mm = 14 * 60 + i * 5; el('text', { x: x(i), y: CB + 18, 'text-anchor': 'middle' }, s, String(Math.floor(mm / 60)).padStart(2, '0') + ':00'); }
  const act = cs['y' + csH];
  el('path', { d: 'M' + act.map((v, i) => x(i + off) + ',' + y(v)).join('L'), fill: 'none', stroke: css('--ink'), 'stroke-width': 3, opacity: 0.35 }, s);
  CS.forEach(([, key, c, on]) => { if (!on) return; const v = cs[key + '_' + csH];
    el('path', { d: 'M' + v.map((p, i) => x(i + off) + ',' + y(p)).join('L'), fill: 'none', stroke: csCol(c), 'stroke-width': 1.8 }, s); });
  el('text', { x: CR, y: CT + 4, 'text-anchor': 'end', class: 'ink' }, s, 'grey = actual speed');
  const cur = el('line', { x1: 0, x2: 0, y1: CT, y2: CB, stroke: css('--muted'), 'stroke-dasharray': '2 3', opacity: 0 }, s);
  const hit = el('rect', { x: CL, y: CT, width: CR - CL, height: CB - CT, fill: 'transparent' }, s);
  hit.addEventListener('pointermove', e => {
    const r = s.getBoundingClientRect(); const vx = (e.clientX - r.left) / r.width * 560;
    const i = Math.round((vx - CL) / (CR - CL) * (n - 1 + 12)) - off; if (i < 0 || i >= n) return;
    cur.setAttribute('x1', x(i + off)); cur.setAttribute('x2', x(i + off)); cur.setAttribute('opacity', 1);
    const mm = 14 * 60 + (i + off) * 5; const t = String(Math.floor(mm / 60)).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
    $('#caseRead').innerHTML = `<b>${t}</b> · actual <b>${act[i].toFixed(1)}</b> · ` + CS.filter(r => r[3]).map(([nm, key]) => `${nm} ${cs[key + '_' + csH][i].toFixed(1)}`).join(' · ');
  });
  hit.addEventListener('pointerleave', () => cur.setAttribute('opacity', 0));
}
function csToggles() { const host = $('#csToggles'); host.innerHTML = ''; CS.forEach(r => { const b = document.createElement('button'); b.className = 'tg'; b.setAttribute('aria-pressed', r[3]); b.innerHTML = `<i style="background:${csCol(r[2])}"></i>${r[0]}`; b.onclick = () => { r[3] = !r[3]; b.setAttribute('aria-pressed', r[3]); drawCase(); }; host.appendChild(b); }); }
document.querySelectorAll('#hzToggles .tg').forEach(b => b.addEventListener('click', () => { csH = b.dataset.h; document.querySelectorAll('#hzToggles .tg').forEach(o => o.setAttribute('aria-pressed', o === b)); drawCase(); }));

/* signal sim summary */
function drawSim() {
  const a = $('#simBig'); a.innerHTML = ''; const L = 130, R = 500; const x = v => L + (R - L) * v / 2179.23;
  [['Fixed timing', 2179.23, css('--hot'), '72.8% of cycles spill back'], ['Adaptive (any)', 26.68, css('--cool'), '0% spillback']].forEach(([n, v, c, note], i) => { const y = 10 + i * 50; const inside = x(v) + 8 > R;
    el('text', { x: L - 10, y: y + 16, 'text-anchor': 'end', class: 'ink' }, a, n);
    el('rect', { x: L, y, width: Math.max(3, x(v) - L), height: 24, rx: 2, fill: c }, a);
    el('text', { x: inside ? R - 8 : x(v) + 8, y: y + 16, 'text-anchor': inside ? 'end' : 'start', style: 'fill:' + (inside ? '#fff' : css('--ink')) }, a, v.toFixed(0) + ' s · ' + note); });
  const z = $('#simZoom'); z.innerHTML = ''; const rows = [['Perfect forecast (reference)', 26.28], ['DCRNN forecast', 26.67], ['XGBoost + HA forecast', 26.68], ['GAT forecast', 26.88], ['GRU local forecast', 27.00], ['Reactive, no forecast', 27.35]];
  const zl = 26, zh = 27.5, ZL = 200, ZR = 500; const zx = v => ZL + (ZR - ZL) * (v - zl) / (zh - zl);
  [26, 26.5, 27, 27.5].forEach(t => { el('line', { x1: zx(t), x2: zx(t), y1: 0, y2: rows.length * 30, class: 'ax', 'stroke-dasharray': '2 4' }, z); el('text', { x: zx(t), y: rows.length * 30 + 16, 'text-anchor': 'middle' }, z, t.toFixed(1)); });
  rows.forEach(([n, v], i) => { const y = i * 30 + 4; const col = n.startsWith('Perfect') ? css('--muted') : n.startsWith('DCRNN') ? css('--paint') : n.startsWith('GAT') ? css('--cool') : css('--line');
    el('text', { x: ZL - 10, y: y + 14, 'text-anchor': 'end', class: 'ink' }, z, n);
    el('rect', { x: ZL, y, width: zx(v) - ZL, height: 18, rx: 2, fill: col }, z);
    el('text', { x: zx(v) + 6, y: y + 14, class: 'ink' }, z, v.toFixed(2)); });
}

function redrawCharts() { drawHourChart(); drawWindow(); toggles($('#p1toggles'), P1, p1on, drawP1); drawP1(); drawRoad(); drawAbl(); drawCI(); csToggles(); drawCase(); drawSim(); }
addEventListener('theme', redrawCharts);

/* section rail + presenter keys */
const stops = ['top', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map(id => document.getElementById(id));
const rail = $('#rail'); stops.forEach((s, i) => { const a = document.createElement('a'); a.href = '#' + s.id; a.setAttribute('aria-label', i ? 'Section ' + i : 'Map'); rail.appendChild(a); });
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
