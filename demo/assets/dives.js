/* Deep dives: click-to-unfold interactive panels across all sections. Animations run only while open. */
(function () {
'use strict';
const { D, N, css, el, $, rgb, rampColor, mulberry, reduce, state, neighbours, diffuseRow, series, axesY } = window.App;
const fmt = n => Number(n).toLocaleString('en');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Unconditionally wrap all child nodes of every .steps li into one grid column cell (.step-txt) */
document.querySelectorAll('.steps li').forEach(li => {
  if (li.querySelector(':scope > .step-txt')) return;
  const wrap = document.createElement('div');
  wrap.className = 'step-txt';
  while (li.firstChild) wrap.appendChild(li.firstChild);
  li.appendChild(wrap);
});

/* open/close lifecycle */
function dive(id, hooks) {
  const d = document.getElementById(id); if (!d) return null;
  let built = false;
  d.addEventListener('toggle', () => {
    if (d.open) { if (!built) { hooks.build && hooks.build(); built = true; } hooks.open && hooks.open(); }
    else hooks.close && hooks.close();
  });
  addEventListener('theme', () => { if (built && hooks.redraw) hooks.redraw(); });
  return d;
}
function spec(host, rows) { $(host).innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join(''); }
function steps(host, i) { document.querySelectorAll(host + ' li').forEach((li, j) => li.classList.toggle('on', j === i)); }
function searchTable(name) {
  const rows = D.p2.search[name]; const best = Math.min(...rows.map(r => r.val_mae));
  const keys = Object.keys(rows[0].params);
  $('#srch-' + name).innerHTML = `<tr><th>#</th>${keys.map(k => `<th>${k.replace('temporal_encoder', 'encoder')}</th>`).join('')}<th>val MAE</th><th>epochs</th><th>stop</th><th>params</th></tr>` +
    rows.map(r => `<tr class="${r.val_mae === best ? 'picked' : ''}"><td>${r.candidate}${r.val_mae === best ? ' ✓' : ''}</td>${keys.map(k => `<td>${r.params[k]}</td>`).join('')}<td class="${r.val_mae === best ? 'best' : ''}">${r.val_mae.toFixed(3)}</td><td>${r.epochs}</td><td>${r.stop.replace('_', ' ')}</td><td>${fmt(r.n_params)}</td></tr>`).join('');
}

/* 2D map projection + explicit Los Angeles County provenance badge */
const lonMin = Math.min(...D.lon), lonMax = Math.max(...D.lon), latMin = Math.min(...D.lat), latMax = Math.max(...D.lat);
const cosL = Math.cos((latMin + latMax) / 2 * Math.PI / 180);
const mapW = 560, mapH = 330, pad = 22;
const sx = (lonMax - lonMin) * cosL, sy = latMax - latMin, sc = Math.min((mapW - 2 * pad) / sx, (mapH - 2 * pad) / sy);
const ox = (mapW - sx * sc) / 2, oy = (mapH - sy * sc) / 2;
const MX = i => ox + (D.lon[i] - lonMin) * cosL * sc, MY = i => mapH - oy - (D.lat[i] - latMin) * sc;
function km(i, j) { const R = 6371, dLat = (D.lat[j] - D.lat[i]) * Math.PI / 180, dLon = (D.lon[j] - D.lon[i]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(D.lat[i] * Math.PI / 180) * Math.cos(D.lat[j] * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); }
const und = []; { const s = new Set(); D.edges.forEach(([i, j]) => { const k = Math.min(i, j) + '-' + Math.max(i, j); if (!s.has(k)) { s.add(k); und.push([i, j]); } }); }
function baseMap(svg, faint = 0.18) {
  svg.innerHTML = '';
  const g = el('g', { opacity: faint }, svg);
  und.forEach(([i, j]) => el('line', { x1: MX(i), y1: MY(i), x2: MX(j), y2: MY(j), stroke: css('--muted'), 'stroke-width': 0.7 }, g));
  // Geographic provenance header & scale bar so viewer always knows this is Los Angeles County METR-LA
  el('text', { x: 8, y: 14, class: 'ink', style: 'font-size:10px;font-weight:600;letter-spacing:.06em' }, svg, 'LOS ANGELES COUNTY · METR-LA (207 sensors)');
  el('text', { x: 8, y: 26, style: 'font-size:9.5px' }, svg, `${D.geo.latMin}°N–${D.geo.latMax}°N, ${Math.abs(D.geo.lonMax)}°W–${Math.abs(D.geo.lonMin)}°W`);
  el('text', { x: mapW - 8, y: 14, 'text-anchor': 'end', class: 'ink', style: 'font-size:10px;font-weight:600' }, svg, 'N ↑');
  const px10 = Math.round(10 / 111 * sc);
  el('line', { x1: mapW - 8 - px10, x2: mapW - 8, y1: mapH - 12, y2: mapH - 12, stroke: css('--muted'), 'stroke-width': 2 }, svg);
  el('text', { x: mapW - 8, y: mapH - 18, 'text-anchor': 'end', style: 'font-size:9.5px' }, svg, '10 km scale');
  return svg;
}

/* ================= Section 01: 8.1% Zero Dropouts Dive ================= */
(function () {
  function drawZeros() {
    const s = $('#zeroHist'); s.innerHTML = '';
    const vals = D.zeroPct, L = 40, R = 536, T = 14, B = 166, bins = 21;
    const cnt = new Array(bins).fill(0);
    vals.forEach(v => cnt[Math.min(bins - 1, Math.floor(v))]++);
    const mx = Math.max(...cnt), bw = (R - L) / bins;
    axesY(s, L, R, y => B - (B - T) * y / mx, [0, Math.round(mx / 2), mx]);
    cnt.forEach((k, i) => {
      if (!k) return;
      const h = (B - T) * k / mx;
      el('rect', { x: L + i * bw + 1, y: B - h, width: Math.max(2, bw - 2), height: h, rx: 1.5, fill: i >= 12 ? css('--hot') : css('--cool'), opacity: 0.85 }, s);
    });
    const x8 = L + (8.1 / bins) * (R - L);
    el('line', { x1: x8, x2: x8, y1: T, y2: B, stroke: css('--paint'), 'stroke-width': 2, 'stroke-dasharray': '4 3' }, s);
    el('text', { x: x8 + 6, y: T + 10, class: 'ink' }, s, 'network mean 8.1%');
    el('line', { x1: L, x2: R, y1: B, y2: B, class: 'ax' }, s);
    [0, 5, 10, 15, 20].forEach(v => el('text', { x: L + (v / bins) * (R - L), y: B + 16, 'text-anchor': 'middle' }, s, v + '%'));
    el('text', { x: R, y: B + 30, 'text-anchor': 'end' }, s, '% of exact-zero readings per LA sensor');
    const mxIdx = vals.reduce((b, v, i) => v > vals[b] ? i : b, 0);
    $('#zeroCap').innerHTML = `207 sensors ranked by zero rate: most lose 6%–10% of readings; worst sensor <b>${D.ids[mxIdx]}</b> loses <b>${vals[mxIdx]}%</b> (max continuous outage: ${D.maxZeroRun[mxIdx]} steps).`;
  }
  dive('dv-outages', { build: drawZeros, redraw: drawZeros });
})();

/* ================= Section 02: 70/10/20 Split Timeline ================= */
(function () {
  function drawSplit() {
    const s = $('#splitViz'); s.innerHTML = '';
    const L = 16, R = 624, W = R - L, Y = 40, H = 40;
    // Schematic non-overlapping widths so Val (10%) and 12-step cuts are cleanly legible with exact counts below
    const segs = [
      ['Train · 70%', 0.50, css('--cool'), '23,967 origins', '1 Mar – 23 May'],
      ['Guard', 0.04, css('--hot'), '12-step cut', ''],
      ['Val · 10%', 0.18, css('--paint'), '3,416 origins', '23 May – 4 Jun'],
      ['Guard', 0.04, css('--hot'), '12-step cut', ''],
      ['Test · 20%', 0.24, '#7cc3c9', '6,844 origins', '4 Jun – 27 Jun'],
    ];
    let cur = L;
    segs.forEach(([name, frac, col, line1, line2]) => {
      const w = W * frac;
      const isGuard = name === 'Guard';
      el('rect', { x: cur + 1, y: Y, width: Math.max(8, w - 3), height: H, rx: 3, fill: col, opacity: isGuard ? 0.92 : 0.85 }, s);
      const cx = cur + w / 2;
      if (!isGuard) {
        el('text', { x: cx, y: Y + 24, 'text-anchor': 'middle', style: 'fill:#11181c;font-weight:700;font-size:12px' }, s, name);
        el('text', { x: cx, y: Y + H + 18, 'text-anchor': 'middle', class: 'ink', style: 'font-size:10.5px;font-weight:600' }, s, line1);
        el('text', { x: cx, y: Y + H + 33, 'text-anchor': 'middle', style: 'font-size:10px' }, s, line2);
      } else {
        el('line', { x1: cx, x2: cx, y1: Y - 14, y2: Y, stroke: css('--hot'), 'stroke-width': 1.5 }, s);
        el('text', { x: cx, y: Y - 18, 'text-anchor': 'middle', style: `fill:${css('--hot')};font-size:10px;font-weight:600` }, s, line1);
      }
      cur += w;
    });
    el('text', { x: R, y: 14, 'text-anchor': 'end', style: 'font-size:9.5px' }, s, 'schematic bar widths · exact origin counts');
  }
  dive('dv-split', { build: drawSplit, redraw: drawSplit });
})();

/* ================= XGBoost: live boosting on stumps ================= */
(function () {
  const ys = series, n = ys.length, eta = 0.3, MAXT = 80;
  let F, trees, timer = null, last = null;
  const STEP_TXT = [
    'Step 1: Initialize every timestamp to the mean speed (~28.8 on this afternoon slice).',
    'Step 2: Red bars show current errors (residuals = actual − prediction).',
    'Step 3: Search every time cutpoint to fit one shallow decision stump directly to those errors.',
    'Step 4: Add a shrunken 0.3× step from the new stump (shown in the cyan correction strip below).',
    'Step 5: Stop automatically when validation error stops dropping (early stopping).',
  ];
  const reset = () => { const m = ys.reduce((a, b) => a + b, 0) / n; F = new Array(n).fill(m); trees = 0; last = null; };
  function addTree() {
    const r = ys.map((y, i) => y - F[i]); const pre = [0]; r.forEach(v => pre.push(pre[pre.length - 1] + v));
    let best = null;
    for (let s = 2; s < n - 1; s++) { const l = pre[s] / s, rr = (pre[n] - pre[s]) / (n - s); const gain = s * l * l + (n - s) * rr * rr; if (!best || gain > best.g) best = { g: gain, s, l, r: rr }; }
    last = best; for (let i = 0; i < n; i++) F[i] += eta * (i < best.s ? best.l : best.r); trees++;
  }
  const mae = () => ys.reduce((a, y, i) => a + Math.abs(y - F[i]), 0) / n;
  function draw() {
    const s = $('#boostChart'); s.innerHTML = ''; const L = 34, R = 552, T = 8, B = 196;
    const x = i => L + (R - L) * i / (n - 1), y = v => B - (B - T) * v / 72;
    axesY(s, L, R, y, [0, 30, 60]);
    for (let i = 0; i < n; i++) el('line', { x1: x(i), x2: x(i), y1: y(ys[i]), y2: y(F[i]), stroke: css('--hot'), opacity: 0.35 }, s);
    el('path', { d: 'M' + ys.map((v, i) => x(i) + ',' + y(v)).join('L'), fill: 'none', stroke: css('--ink'), 'stroke-width': 2.6, opacity: 0.3 }, s);
    el('path', { d: 'M' + F.map((v, i) => x(i) + ',' + y(v)).join('L'), fill: 'none', stroke: css('--paint'), 'stroke-width': 2.4 }, s);
    el('text', { x: R, y: T + 6, 'text-anchor': 'end', class: 'ink' }, s, 'grey = actual · amber = model · red = residual');
    const zT = 222, zB = 290, z0 = (zT + zB) / 2; el('line', { x1: L, x2: R, y1: z0, y2: z0, class: 'ax' }, s);
    el('text', { x: L - 8, y: z0 + 4, 'text-anchor': 'end' }, s, '0');
    el('text', { x: L, y: zT - 6 }, s, last ? `tree ${trees}: split at ${App.tLbl(last.s)}, left ${(eta * last.l).toFixed(1)}, right ${(eta * last.r).toFixed(1)}` : 'newest tree correction');
    if (last) { const sc = (zB - zT) / 2 / 12; const yl = z0 - Math.max(-12, Math.min(12, eta * last.l)) * sc, yr = z0 - Math.max(-12, Math.min(12, eta * last.r)) * sc;
      el('path', { d: `M${L},${yl}L${x(last.s)},${yl}L${x(last.s)},${yr}L${R},${yr}`, fill: 'none', stroke: css('--cool'), 'stroke-width': 2.2 }, s); }
    $('#boostRead').innerHTML = `trees <b>${trees}</b> · MAE on this curve <b>${mae().toFixed(2)}</b>`;
  }
  async function play() {
    if (timer) { stop(); return; } $('#boostPlay').textContent = 'Pause'; timer = true;
    while (timer && trees < MAXT) { steps('#boostSteps', 1); await sleep(reduce ? 0 : 90); steps('#boostSteps', 2); addTree(); await sleep(reduce ? 0 : 90); steps('#boostSteps', 3); draw(); await sleep(reduce ? 0 : 160); }
    if (trees >= MAXT) steps('#boostSteps', 4); stop();
  }
  function stop() { timer = null; $('#boostPlay').textContent = trees >= MAXT ? 'Done' : 'Play'; }
  const xp = D.p1.xgb_params;
  dive('dv-xgb', {
    build() {
      reset(); draw(); steps('#boostSteps', 0);
      $('#boostPlay').onclick = play;
      $('#boostStep').onclick = () => { stop(); addTree(); steps('#boostSteps', 3); draw(); $('#boostStepInfo').textContent = STEP_TXT[3]; };
      $('#boostReset').onclick = () => { stop(); reset(); steps('#boostSteps', 0); draw(); $('#boostStepInfo').textContent = STEP_TXT[0]; };
      document.querySelectorAll('#boostSteps li').forEach((li, i) => li.onclick = () => {
        steps('#boostSteps', i);
        $('#boostStepInfo').textContent = STEP_TXT[i];
        if (i === 0) { stop(); reset(); draw(); }
        else if (i >= 2 && trees === 0) { addTree(); draw(); }
      });
      spec('#xgbSpec', [['objective', xp.objective], ['tree method', xp.tree_method], ['max depth', xp.max_depth], ['learning rate η', xp.eta], ['min child weight', xp.min_child_weight], ['row / column sample', xp.subsample + ' / ' + xp.colsample_bytree], ['training rows', fmt(D.p1.xgb_train_samples)], ['models', '1 per horizon × 2 feature sets']]);
      $('#iterTable').innerHTML = '<tr><th>Horizon</th><th>XGBoost 32</th><th>XGBoost + HA</th></tr>' + Object.entries(D.p1.xgb_best_iter).map(([h, [a, b]]) => `<tr><td>+${h.replace('min', ' min')}</td><td>${fmt(a)}</td><td>${fmt(b)}</td></tr>`).join('');
      document.querySelectorAll('#impToggles .tg').forEach(b => b.onclick = () => { document.querySelectorAll('#impToggles .tg').forEach(o => o.setAttribute('aria-pressed', o === b)); imp(b.dataset.k); });
      imp('xgb_ha');
    },
    open() { if (!reduce && trees === 0) setTimeout(play, 300); },
    close: stop,
    redraw() { draw(); imp(document.querySelector('#impToggles [aria-pressed="true"]').dataset.k); },
  });
  function imp(k) {
    const rows = D.p1.xgb_importance_60[k]; const s = $('#impChart'); s.innerHTML = ''; const L = 175, R = 470, h = 22, mx = Math.max(...rows.map(r => r[1]));
    const ha = new Set(['anomaly_now', 'ha_delta', 'ha_target', 'ha_now']);
    rows.forEach(([f, v], i) => {
      const y = i * (h + 2) + 4;
      // Fixed: HA features are exclusively bright amber (--paint); speed lags use sky blue (#5da3c9) so colors never collide
      const col = ha.has(f) ? css('--paint') : f.startsWith('speed_change') ? '#b9cf7a' : f.startsWith('speed_lag') ? '#5da3c9' : f.startsWith('rolling') ? '#7cc3c9' : f.includes('missing') ? '#e5a08f' : '#c9a9d9';
      el('text', { x: L - 8, y: y + 15, 'text-anchor': 'end', class: ha.has(f) ? 'ink' : '', style: ha.has(f) ? `fill:${css('--paint-ink')};font-weight:600` : '' }, s, (ha.has(f) ? '★ ' : '') + f);
      const bar = el('rect', { x: L, y, width: 0, height: h - 4, rx: 2, fill: col }, s);
      requestAnimationFrame(() => { bar.style.transition = reduce ? '' : `width .5s ${i * 30}ms cubic-bezier(.2,.8,.2,1)`; bar.setAttribute('width', (R - L) * v / mx); });
      el('text', { x: L + (R - L) * v / mx + 6, y: y + 15 }, s, (v * 100).toFixed(1) + '%');
    });
    $('#impCap').textContent = k === 'xgb_ha'
      ? 'Share of total gain at +60 min. Only the 4 Historical-Average features (★ amber) are coloured amber — anomaly_now and ha_delta dominate over blue lag features.'
      : 'Share of total gain at +60 min without HA features: blue speed lags, green trend slopes, and purple time flags carry the forecast.';
  }
})();

/* ================= Random Forest: live bagging ================= */
(function () {
  const ys = series, n = ys.length; let rng = mulberry(11), trees = [], timer = null;
  function buildTree(idx, depth) {
    const vals = idx.map(i => ys[i]); const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (depth === 0 || idx.length < 6) return { leaf: mean };
    const sorted = [...idx].sort((a, b) => a - b); let best = null;
    for (let s = 3; s < sorted.length - 2; s++) { if (sorted[s] === sorted[s - 1]) continue;
      const l = sorted.slice(0, s), r = sorted.slice(s); const ml = l.reduce((a, i) => a + ys[i], 0) / l.length, mr = r.reduce((a, i) => a + ys[i], 0) / r.length;
      const sse = l.reduce((a, i) => a + (ys[i] - ml) ** 2, 0) + r.reduce((a, i) => a + (ys[i] - mr) ** 2, 0);
      if (!best || sse < best.sse) best = { sse, t: (sorted[s - 1] + sorted[s]) / 2, l, r }; }
    if (!best) return { leaf: mean };
    return { t: best.t, L: buildTree(best.l, depth - 1), R: buildTree(best.r, depth - 1) };
  }
  const pred = (t, x) => t.leaf != null ? t.leaf : pred(x < t.t ? t.L : t.R, x);
  const grow = () => { const idx = Array.from({ length: n }, () => Math.floor(rng() * n)); const t = buildTree(idx, 3); trees.push(ys.map((_, i) => pred(t, i))); };
  const avg = () => ys.map((_, i) => trees.reduce((a, t) => a + t[i], 0) / trees.length);
  const mae = p => ys.reduce((a, y, i) => a + Math.abs(y - p[i]), 0) / n;
  function draw() {
    const s = $('#forestChart'); s.innerHTML = ''; const L = 34, R = 552, T = 8, B = 250;
    const x = i => L + (R - L) * i / (n - 1), y = v => B - (B - T) * v / 72;
    axesY(s, L, R, y, [0, 30, 60]);
    el('path', { d: 'M' + ys.map((v, i) => x(i) + ',' + y(v)).join('L'), fill: 'none', stroke: css('--ink'), 'stroke-width': 2.6, opacity: 0.3 }, s);
    trees.forEach((t, k) => el('path', { d: 'M' + t.map((v, i) => x(i) + ',' + y(v)).join('L'), fill: 'none', stroke: css('--cool'), 'stroke-width': 1.1, opacity: k === trees.length - 1 ? 0.9 : 0.28 }, s));
    if (trees.length) { const a = avg(); el('path', { d: 'M' + a.map((v, i) => x(i) + ',' + y(v)).join('L'), fill: 'none', stroke: css('--paint'), 'stroke-width': 2.8 }, s);
      const single = trees.reduce((acc, t) => acc + mae(t), 0) / trees.length;
      $('#forestRead').innerHTML = `trees <b>${trees.length}</b> · one tree MAE <b>${single.toFixed(2)}</b> · forest MAE <b>${mae(a).toFixed(2)}</b>`; }
    else $('#forestRead').textContent = 'no trees yet';
    el('text', { x: R, y: T + 6, 'text-anchor': 'end', class: 'ink' }, s, 'thin teal = single trees · amber = average');
  }
  async function play() { if (timer) return; timer = true; $('#forestPlay').textContent = 'Growing…';
    while (timer && trees.length < 20) { grow(); draw(); await sleep(reduce ? 0 : 280); } timer = null; $('#forestPlay').textContent = 'Grow forest'; }
  const rp = D.p1.rf_params;
  function ablation() {
    const s = $('#ablRF'); s.innerHTML = ''; const L = 40, R = 330, T = 10, B = 190, lo = 2.2, hi = 5.6;
    const x = i => L + (R - L) * i / 3, y = v => B - (B - T) * (v - lo) / (hi - lo);
    axesY(s, L, R, y, [3, 4, 5], v => v.toFixed(1)); ['+5', '+15', '+30', '+60'].forEach((h, i) => el('text', { x: x(i), y: B + 16, 'text-anchor': 'middle' }, s, h + ' min'));
    const lab = { A: 'A lags 12', B: 'B +time 19', C: 'C +rolling 27', D: 'D all 32' }, col = { A: '#9aa3a8', B: '#c9a9d9', C: '#7cc3c9', D: css('--paint') };
    const ends = [];
    Object.entries(D.p1.rf_ablation).forEach(([k, v]) => { el('path', { d: 'M' + v.map((m, i) => x(i) + ',' + y(m)).join('L'), fill: 'none', stroke: col[k], 'stroke-width': k === 'D' ? 2.6 : 1.8 }, s); v.forEach((m, i) => el('circle', { cx: x(i), cy: y(m), r: 2.5, fill: col[k] }, s)); ends.push([y(v[3]), lab[k] + ' · ' + v[3].toFixed(2)]); });
    ends.sort((a, b) => a[0] - b[0]); for (let i = 1; i < ends.length; i++) if (ends[i][0] - ends[i - 1][0] < 13) ends[i][0] = ends[i - 1][0] + 13;
    ends.forEach(([yy, t]) => el('text', { x: R + 8, y: yy + 4, class: 'ink' }, s, t));
  }
  dive('dv-rf', {
    build() { draw(); ablation(); $('#forestPlay').onclick = play; $('#forestReset').onclick = () => { timer = null; rng = mulberry(Math.floor(Math.random() * 1e6)); trees = []; draw(); play(); };
      spec('#rfSpec', [['trees', rp.n_estimators], ['max depth', rp.max_depth], ['rows per tree', (rp.max_samples * 100) + '% bootstrap sample'], ['features', '32 (same as XGBoost 32)'], ['random state', rp.random_state], ['models', '1 per horizon']]); },
    open() { if (!trees.length && !reduce) setTimeout(play, 300); },
    close() { timer = null; },
    redraw() { draw(); ablation(); },
  });
})();

/* ================= Block bootstrap on real per-day errors ================= */
(function () {
  const dd = D.daily, nd = dd.days.length;
  const PAIRS = [['persistence', 'xgboost_ha', 'XGB + HA vs Persistence'], ['xgboost_32', 'xgboost_ha', 'XGB + HA vs XGB 32'], ['random_forest_32', 'xgboost_32', 'XGB 32 vs Random Forest']];
  let pair = 0, draws = [], shown = 0, raf = null;
  $('#bootDays').innerHTML = dd.days.map(d => `<div class="day" title="${d}">${d.slice(8)}</div>`).join('');
  const tiles = () => [...document.querySelectorAll('#bootDays .day')];
  function stat(idx, base, cand) { let num = 0, den = 0; idx.forEach(d => { num += dd[base].abs[d] - dd[cand].abs[d]; den += dd[base].n[d]; }); return num / den; }
  function sample(rng) { const idx = []; for (let b = 0; b < Math.ceil(nd / 2); b++) { const s = Math.floor(rng() * nd); idx.push(s, (s + 1) % nd); } return idx.slice(0, nd); }
  function hist() {
    const s = $('#bootHist'); s.innerHTML = ''; const [b, c] = PAIRS[pair]; const obs = stat([...Array(nd).keys()], b, c);
    const all = draws.length ? draws : [obs]; const lo0 = Math.min(0, ...all), hi0 = Math.max(...all); const span = hi0 - lo0 || 1; const lo = lo0 - span * 0.08, hi = hi0 + span * 0.08;
    const L = 20, R = 540, T = 10, B = 150, bins = 44; const x = v => L + (R - L) * (v - lo) / (hi - lo);
    const cnt = new Array(bins).fill(0); draws.slice(0, shown).forEach(v => cnt[Math.min(bins - 1, Math.floor((v - lo) / (hi - lo) * bins))]++);
    const mx = Math.max(1, ...cnt); const bw = (R - L) / bins;
    cnt.forEach((k, i) => k && el('rect', { x: L + i * bw + 0.5, y: B - (B - T) * k / mx, width: bw - 1, height: (B - T) * k / mx, fill: css('--cool'), opacity: 0.8 }, s));
    el('line', { x1: L, x2: R, y1: B, y2: B, class: 'ax' }, s);
    el('line', { x1: x(0), x2: x(0), y1: T, y2: B + 4, stroke: css('--hot'), 'stroke-width': 1.5 }, s); el('text', { x: x(0), y: B + 16, 'text-anchor': 'middle', style: 'fill:' + css('--hot') }, s, '0 = no difference');
    el('line', { x1: x(obs), x2: x(obs), y1: T, y2: B, stroke: css('--paint'), 'stroke-width': 2 }, s); el('text', { x: x(obs), y: T + 2, 'text-anchor': obs > (lo + hi) / 2 ? 'end' : 'start', dx: obs > (lo + hi) / 2 ? -4 : 4, class: 'ink' }, s, 'observed ' + obs.toFixed(3));
    const off = dd.official.find(o => o[0] === b && o[1] === c);
    let txt = `observed MAE gap <b>${obs.toFixed(3)}</b>`;
    if (shown >= 40) { const so = draws.slice(0, shown).sort((p, q) => p - q); const q = f => so[Math.min(so.length - 1, Math.floor(f * so.length))]; const a = q(0.025), z = q(0.975);
      el('rect', { x: x(a), y: B + 22, width: x(z) - x(a), height: 6, rx: 3, fill: css('--paint') }, s); el('text', { x: x(a), y: B + 40 }, s, a.toFixed(3)); el('text', { x: x(z), y: B + 40, 'text-anchor': 'end' }, s, z.toFixed(3));
      txt += ` · ${fmt(shown)} resamples · 95% CI here <b>[${a.toFixed(3)}, ${z.toFixed(3)}]</b>`; }
    if (off) txt += ` · official <b>[${off[3].toFixed(3)}, ${off[4].toFixed(3)}]</b>`;
    $('#bootRead').innerHTML = txt;
  }
  async function run() {
    cancelAnimationFrame(raf); const rng = mulberry(42 + pair); const [b, c] = PAIRS[pair]; const idxs = Array.from({ length: 2000 }, () => sample(rng));
    draws = idxs.map(ix => stat(ix, b, c)); shown = 0; $('#bootRun').disabled = true;
    const T = tiles();
    for (let k = 0; k < (reduce ? 0 : 10); k++) { const cnt = new Array(nd).fill(0); idxs[k].forEach(d => cnt[d]++); steps('#bootSteps', 1);
      T.forEach((t, d) => { t.style.background = cnt[d] ? `color-mix(in srgb, ${css('--paint')} ${cnt[d] * 40}%, ${css('--panel')})` : ''; t.textContent = cnt[d] > 1 ? '×' + cnt[d] : dd.days[d].slice(8); });
      await sleep(220); steps('#bootSteps', 2); shown = k + 1; hist(); await sleep(140); }
    steps('#bootSteps', 3);
    const stepFn = () => { shown = Math.min(2000, shown + 40); hist(); if (shown < 2000) raf = requestAnimationFrame(stepFn); else { steps('#bootSteps', 4); $('#bootRun').disabled = false; T.forEach((t, d) => { t.style.background = ''; t.textContent = dd.days[d].slice(8); }); } };
    if (reduce) { shown = 2000; hist(); steps('#bootSteps', 4); $('#bootRun').disabled = false; } else stepFn();
  }
  function pairs() { $('#bootPairs').innerHTML = PAIRS.map((p, i) => `<button class="tg solo" data-i="${i}" aria-pressed="${i === pair}">${p[2]}</button>`).join('');
    document.querySelectorAll('#bootPairs .tg').forEach(b => b.onclick = () => { pair = +b.dataset.i; pairs(); draws = []; shown = 0; hist(); run(); }); }
  dive('dv-boot', { build() { pairs(); hist(); steps('#bootSteps', 0); $('#bootRun').onclick = run; }, open() { if (!draws.length) setTimeout(run, 300); }, close() { cancelAnimationFrame(raf); $('#bootRun').disabled = false; }, redraw: hist });
})();

/* ================= Section 05: Hypotheses (H0-H5) & Congestion Onset Recall ================= */
(function () {
  const LABELS = {
    dcrnn: 'DCRNN (graph)', xgboost_ha: 'XGBoost + HA (P1)', gat: 'GAT (graph)', gat_shuffled: 'GAT shuffled',
    dcrnn_identity: 'DCRNN identity', gat_identity: 'GAT identity', gru_local: 'GRU local',
    random_forest_32: 'Random Forest 32', xgboost_32: 'XGBoost 32', persistence: 'Persistence'
  };
  function buildHyp() {
    const s = $('#onsetChart'); s.innerHTML = ''; const rows = D.onset60;
    const L = 148, R = 505, rowH = 25; const x = v => L + (R - L) * v / 45;
    [0, 10, 20, 30, 40].forEach(t => { el('line', { x1: x(t), x2: x(t), y1: 0, y2: rows.length * rowH, class: 'ax', 'stroke-dasharray': '2 4' }, s); el('text', { x: x(t), y: rows.length * rowH + 16, 'text-anchor': 'middle' }, s, t + '%'); });
    rows.forEach(([m, rec], i) => {
      const y = i * rowH + 4;
      const col = m === 'dcrnn' ? css('--paint') : m === 'gat' ? css('--cool') : m === 'xgboost_ha' ? '#e5a08f' : css('--muted');
      const isMain = m === 'dcrnn' || m === 'gat' || m === 'xgboost_ha';
      el('text', { x: L - 8, y: y + 13, 'text-anchor': 'end', class: isMain ? 'ink' : '' }, s, LABELS[m] || m);
      el('rect', { x: L, y, width: Math.max(2, x(rec) - L), height: 16, rx: 2, fill: col, opacity: isMain ? 1 : 0.55 }, s);
      el('text', { x: x(rec) + 6, y: y + 13, class: 'ink' }, s, rec.toFixed(1) + '%');
    });
    const host = $('#hypList');
    host.innerHTML = D.hypotheses.map((h, idx) => {
      const badge = h.verdict.replace('_', ' ');
      const rowsHtml = h.rows.map(r => {
        const val = r.diff != null ? `Δ = ${r.diff > 0 ? '+' : ''}${r.diff.toFixed(3)} [${r.lo.toFixed(3)}, ${r.hi.toFixed(3)}]` : r.note;
        return `<div><b>${r.horizon}</b> · <code>${r.comparison}</code>: ${val}</div>`;
      }).join('');
      return `<details class="hyp-item" ${idx === 1 ? 'open' : ''}>
        <summary><div class="hyp-item-left"><span class="hyp-id">${h.id}</span><span>${h.statement}</span></div><span class="pill ${h.verdict}">${badge}</span></summary>
        <div class="hyp-body">${rowsHtml}</div>
      </details>`;
    }).join('');
  }
  dive('dv-hyp', { build: buildHyp, redraw: buildHyp });
})();

/* ================= GRU local: unrolled cell ================= */
(function () {
  const H = 8, IN = 2; const rng = mulberry(7); const W = () => Array.from({ length: H }, () => Array.from({ length: IN }, () => (rng() * 2 - 1) * 1.2));
  const U = () => Array.from({ length: H }, () => Array.from({ length: H }, () => (rng() * 2 - 1) * 0.6));
  const Wz = W(), Wr = W(), Wn = W(), Uz = U(), Ur = U(), Un = U(); const bz = new Array(H).fill(0.2);
  const sig = v => 1 / (1 + Math.exp(-v)); const mv = (M, v) => M.map(r => r.reduce((a, w, j) => a + w * v[j], 0));
  let k = 34, upto = 12, timer = null;
  function run() {
    const win = series.slice(k - 11, k + 1); const hh = +App.tLbl(k).slice(0, 2);
    let h = new Array(H).fill(0); const out = [];
    win.forEach((v, t) => { const x = [(v - 58.584) / 12.823, Math.sin(2 * Math.PI * (hh - (11 - t) / 12) / 24)];
      const z = mv(Wz, x).map((a, i) => sig(a + mv(Uz, h)[i] + bz[i])); const r = mv(Wr, x).map((a, i) => sig(a + mv(Ur, h)[i]));
      const uh = mv(Un, h); const nn = mv(Wn, x).map((a, i) => Math.tanh(a + r[i] * uh[i])); h = h.map((p, i) => (1 - z[i]) * nn[i] + z[i] * p);
      out.push({ v, z: z.reduce((a, b) => a + b, 0) / H, r: r.reduce((a, b) => a + b, 0) / H, h: [...h] }); });
    return out;
  }
  function draw() {
    const s = $('#gruViz'); s.innerHTML = ''; const seq = run(); const L = 72, cw = (552 - L) / 12;
    const pos = v => `color-mix(in srgb, ${css('--paint')} ${Math.round(Math.abs(v) * 100)}%, ${css('--panel')})`, neg = v => `color-mix(in srgb, ${css('--cool')} ${Math.round(Math.abs(v) * 100)}%, ${css('--panel')})`;
    [['input', 22], ['update z', 66], ['reset r', 96], ['memory h', 170]].forEach(([t, y]) => el('text', { x: 0, y }, s, t));
    seq.forEach((st, t) => { const x = L + t * cw; const on = t < upto;
      const g = el('g', { opacity: on ? 1 : 0.18 }, s); if (on && !reduce) { g.style.transition = 'opacity .25s'; }
      el('rect', { x: x + 2, y: 6, width: cw - 4, height: 26, rx: 2, fill: rgb(rampColor(st.v)) }, g);
      el('text', { x: x + cw / 2, y: 23, 'text-anchor': 'middle', style: 'fill:#11181c;font-weight:600' }, g, st.v.toFixed(0));
      el('rect', { x: x + 6, y: 52, width: cw - 12, height: 18, rx: 2, fill: css('--line') }, g); el('rect', { x: x + 6, y: 52, width: (cw - 12) * st.z, height: 18, rx: 2, fill: css('--muted') }, g);
      el('rect', { x: x + 6, y: 82, width: cw - 12, height: 18, rx: 2, fill: css('--line') }, g); el('rect', { x: x + 6, y: 82, width: (cw - 12) * st.r, height: 18, rx: 2, fill: css('--muted') }, g);
      st.h.forEach((v, i) => el('rect', { x: x + 4, y: 116 + i * 14, width: cw - 8, height: 12, rx: 2, fill: v >= 0 ? pos(v) : neg(v), stroke: css('--line'), 'stroke-width': 0.5 }, g));
      if (t < 11) el('path', { d: `M${x + cw - 3},${170}l6,0`, stroke: css('--muted'), 'stroke-width': 1.2, opacity: on ? 1 : 0.2 }, s);
      el('text', { x: x + cw / 2, y: 248, 'text-anchor': 'middle' }, s, t === 11 ? 'now' : '−' + (11 - t) * 5);
    });
    if (upto > 0 && upto <= 12) { const x = L + (upto - 1) * cw; el('rect', { x: x + 1, y: 2, width: cw - 2, height: 234, rx: 3, fill: 'none', stroke: css('--paint'), 'stroke-width': 1.5 }, s); }
    const o = k + 1; const cs = D.case;
    if (upto >= 12) { el('text', { x: 0, y: 272, style: `fill:${css('--paint')};font-weight:600` }, s, `TRAINED GRU LOCAL · REAL FORECAST MADE AT ${App.tLbl(k)}`);
      el('text', { x: 0, y: 292, class: 'ink' }, s, `+15 min: ${cs.gru_local_15min[o].toFixed(1)} (actual ${cs.y15min[o].toFixed(1)})   ·   +60 min: ${cs.gru_local_60min[o].toFixed(1)} (actual ${cs.y60min[o].toFixed(1)})`); }
    $('#gruRead').innerHTML = `window ending <b>${App.tLbl(k)}</b> · step <b>${Math.min(upto, 12)}</b> / 12`;
  }
  async function play() { if (timer) return; timer = true; upto = 0; draw();
    for (upto = 1; upto <= 12 && timer; upto++) { for (let st = 0; st < 4 && timer; st++) { steps('#gruSteps', st); await sleep(reduce ? 0 : 70); } draw(); }
    upto = 12; steps('#gruSteps', 4); draw(); timer = null; }
  addEventListener('window', e => { k = e.detail; if (document.getElementById('dv-gru').open && !timer) draw(); });
  const p = D.p2;
  dive('dv-gru', {
    build() { k = +$('#winPos').value; draw(); $('#gruPlay').onclick = play; searchTable('gru_local');
      spec('#gruSpec', [['hidden units', 64], ['layers', 1], ['dropout', 0], ['parameters', fmt(p.params.gru_local)], ['batch / lr', '64 / 0.001, plateau scheduler'], ['time per epoch', '≈ ' + p.sec_per_epoch.gru_local + ' s on M3 (MPS)'], ['epochs run', p.epochs.gru_local.join(', ') + ' (seeds 42/43/44)'], ['graph', 'none: each sensor alone, weights shared']]); },
    open() { if (!reduce) setTimeout(play, 300); }, close() { timer = null; }, redraw: draw,
  });
})();

/* ================= GAT: clean 620x340 layout, no ring label overlaps + interactive jam simulation ================= */
(function () {
  let step = 4, timer = null, raf = null, sel = App.target, jamNode = null;
  const CX = 186, CY = 172, RAD = 100, RX = 368;
  function layout() {
    const nb = neighbours(sel).slice(0, 12);
    const ang = nb.map(j => Math.atan2(-(D.lat[j] - D.lat[sel]), (D.lon[j] - D.lon[sel]) * Math.cos(D.lat[sel] * Math.PI / 180)));
    const order = nb.map((j, q) => [j, ang[q]]).sort((a, b) => a[1] - b[1]);
    return order.map(([j], q) => {
      const a = -Math.PI / 2 + (q / order.length) * Math.PI * 2;
      return { j, a, x: CX + Math.cos(a) * RAD, y: CY + Math.sin(a) * RAD * 0.94 };
    });
  }
  function draw(t = 0) {
    const s = $('#gatViz'); s.innerHTML = ''; const pts = layout();
    const realSelf = D.att.mass_self[sel];
    const self = jamNode != null ? Math.max(0.05, realSelf * 0.7) : realSelf;
    const rem = 1 - self;
    const weights = pts.map(p => {
      if (jamNode == null) return pts.length ? rem / pts.length : 0;
      const boost = p.j === jamNode ? 3.5 : 1.0;
      const sumW = pts.reduce((acc, q) => acc + (q.j === jamNode ? 3.5 : 1.0), 0);
      return rem * (boost / sumW);
    });
    const paint = css('--paint'), cool = css('--cool'), hot = css('--hot'), ink = css('--ink'), muted = css('--muted');
    $('#gatModeTag').hidden = jamNode == null;
    $('#gatResetJam').hidden = jamNode == null;

    // Provenance caption inside GAT diagram
    el('text', { x: 8, y: 14, style: 'font-size:9.5px' }, s, `LA METR-LA subgraph · sensor ${D.ids[sel]}`);

    if (step >= 3) {
      const r = mulberry(sel);
      for (let q = 0; q < 9; q++) {
        const a = r() * Math.PI * 2, rr = RAD + 42 + r() * 8;
        const gx = CX + Math.cos(a) * rr, gy = CY + Math.sin(a) * rr * 0.86;
        if (gx < 10 || gx > RX - 14 || gy < 24 || gy > 322) continue;
        el('circle', { cx: gx, cy: gy, r: 4, fill: 'none', stroke: muted, opacity: 0.45 }, s);
        el('text', { x: gx, y: gy + 3.5, 'text-anchor': 'middle', style: `fill:${hot};font-size:9px` }, s, '×');
      }
    }

    pts.forEach((p, idx) => {
      const wNorm = weights[idx];
      const isJam = p.j === jamNode;
      const lw = step >= 4 ? (isJam ? 4.2 : 1 + 14 * wNorm) : 1.2;
      el('line', {
        x1: p.x, y1: p.y, x2: CX, y2: CY,
        stroke: isJam ? hot : (step >= 2 ? cool : muted),
        'stroke-width': lw,
        opacity: step >= 2 ? (isJam ? 0.95 : 0.65) : 0.32,
        'stroke-dasharray': step === 2 ? '4 4' : '',
        'stroke-linecap': 'round'
      }, s);
      if (step >= 4 && isJam) {
        const mx = (p.x + CX) / 2, my = (p.y + CY) / 2;
        el('rect', { x: mx - 20, y: my - 9, width: 40, height: 17, rx: 3, fill: hot }, s);
        el('text', { x: mx, y: my + 3, 'text-anchor': 'middle', style: 'fill:#fff;font-weight:700;font-size:10px' }, s, (wNorm * 100).toFixed(0) + '%');
      }
    });

    if (step >= 4) el('circle', { cx: CX, cy: CY - 34, r: 14, fill: 'none', stroke: paint, 'stroke-width': 1 + 14 * self, opacity: 0.8 }, s);
    if (step === 5) pts.forEach((p, q) => {
      const f = ((t / 1400) + q / pts.length) % 1;
      el('circle', { cx: p.x + (CX - p.x) * f, cy: p.y + (CY - p.y) * f, r: 2.2 + 5 * Math.sqrt(weights[q]), fill: p.j === jamNode ? hot : paint }, s);
    });

    pts.forEach((p, idx) => {
      const isJam = p.j === jamNode;
      const g = el('g', { style: 'cursor:pointer' }, s);
      el('circle', { cx: p.x, cy: p.y, r: 10.5, fill: isJam ? hot : css('--panel'), stroke: isJam ? hot : cool, 'stroke-width': 1.6 }, g);
      if (step >= 0 && !isJam) for (let b = 0; b < 4; b++) {
        const v = (Math.sin(p.j * 3.1 + b * 1.7) + 1) / 2;
        el('rect', { x: p.x - 6.5 + b * 3.4, y: p.y + 4 - v * 8, width: 2.4, height: v * 8, fill: step >= 1 && b >= 2 ? paint : cool }, g);
      }
      // Radially outward ID placement with quadrant-aware anchor -> zero overlap across 12 neighbours!
      const lx = CX + Math.cos(p.a) * (RAD + 22), ly = CY + Math.sin(p.a) * (RAD * 0.94 + 20) + 4;
      const anc = Math.abs(Math.cos(p.a)) < 0.25 ? 'middle' : Math.cos(p.a) > 0 ? 'start' : 'end';
      el('text', { x: lx, y: ly, 'text-anchor': anc, class: isJam ? 'ink' : '', style: isJam ? `fill:${hot};font-weight:700` : 'font-size:10px' }, g, D.ids[p.j]);
      g.addEventListener('click', () => { jamNode = (jamNode === p.j) ? null : p.j; if (step < 4) step = 4; draw(); });
    });

    const glow = step >= 6 ? 25 + Math.sin(t / 200) * 1.8 : 20;
    el('circle', { cx: CX, cy: CY, r: glow, fill: step >= 6 ? paint : css('--panel'), stroke: paint, 'stroke-width': 2.5 }, s);
    el('text', { x: CX, y: CY + 4, 'text-anchor': 'middle', style: `fill:${step >= 6 ? '#1b1300' : ink};font-weight:600` }, s, D.ids[sel]);
    if (step >= 4) el('text', { x: CX, y: CY - 53, 'text-anchor': 'middle', class: 'ink', style: 'font-size:10px' }, s, `self ${(self * 100).toFixed(1)}%`);

    // Right rail cleanly bounded inside x = 368..612 (two short lines, never clips)
    const msg = [
      ['ENCODE', 'Shared GRU encodes 12', 'steps → h [B, 207, 64]'],
      ['PROJECT', 'Linear Wh split across', '2 heads × 32 dims each'],
      ['SCORE', 'Factored edge scores', 'eᵢⱼ on real LA links'],
      ['MASK', 'Non-edges set to -1e9', '→ strictly 0 after softmax'],
      ['SOFTMAX', `Row sums = 1.0 · self ${(self * 100).toFixed(1)}%`, pts.length ? `mean edge ${(rem / pts.length * 100).toFixed(1)}% (real)` : 'no neighbours'],
      ['AGGREGATE', 'Weighted neighbour mix', '+ residual + LayerNorm'],
      ['PREDICT', 'MLP outputs Δ speed for', '+5 / +15 / +30 / +60 min'],
    ][step];
    el('line', { x1: RX - 14, x2: RX - 14, y1: 16, y2: 320, stroke: css('--line'), 'stroke-dasharray': '2 4' }, s);
    el('text', { x: RX, y: 34, style: `fill:${paint};font-weight:700;font-size:12px;letter-spacing:.08em` }, s, `STEP ${step + 1} · ${msg[0]}`);
    el('text', { x: RX, y: 54, class: 'ink' }, s, msg[1]);
    el('text', { x: RX, y: 70, class: 'ink' }, s, msg[2]);
    if (step >= 6) ['+5 min', '+15 min', '+30 min', '+60 min'].forEach((h, q) => {
      el('rect', { x: RX, y: 98 + q * 32, width: 148, height: 24, rx: 3, fill: 'none', stroke: paint }, s);
      el('text', { x: RX + 10, y: 114 + q * 32, class: 'ink' }, s, `${h} forecast`);
    });
    else if (jamNode != null) {
      el('text', { x: RX, y: 102, style: `fill:${hot};font-weight:600` }, s, `Simulated jam @ ${D.ids[jamNode]}`);
      el('text', { x: RX, y: 118 }, s, 'Watch softmax re-weight');
      el('text', { x: RX, y: 134 }, s, 'toward the slow link.');
    }

    $('#gatRead').innerHTML = `<b>${pts.length}</b> links shown (${D.deg[sel]} total) · self <b>${(self * 100).toFixed(1)}%</b> · entropy <b>${D.att.entropy[sel].toFixed(2)}</b>`;
    $('#gatSensor').textContent = D.ids[sel];
    steps('#gatSteps', step);
  }
  function loop(t) { draw(t); if (step === 5 || step === 6) raf = requestAnimationFrame(loop); }
  function go(s2) { step = Math.max(0, Math.min(6, s2)); cancelAnimationFrame(raf); if ((step === 5 || step === 6) && !reduce) raf = requestAnimationFrame(loop); else draw(); }
  async function play() { if (timer) return; timer = true; $('#gatPlay').textContent = 'Playing…'; for (let q = 0; q <= 6 && timer; q++) { go(q); await sleep(reduce ? 0 : 1400); } timer = null; $('#gatPlay').textContent = 'Play layer'; }
  function mass() {
    const s = $('#gatMass'); s.innerHTML = ''; const a = D.att;
    const rows = [['self', a.mass_self[sel], css('--paint')], ['all neighbours', a.mass_neighbours[sel], css('--cool')], [`downstream (${a.num_downstream[sel]})`, a.mass_downstream[sel], css('--cool')], [`upstream (${a.num_upstream[sel]})`, a.mass_upstream[sel], css('--cool')]];
    rows.forEach(([n, v, c], i) => { const y = i * 30 + 6; el('text', { x: 150, y: y + 14, 'text-anchor': 'end', class: 'ink' }, s, n); el('rect', { x: 160, y, width: 300, height: 18, rx: 2, fill: css('--line') }, s); el('rect', { x: 160, y, width: 300 * Math.min(1, v), height: 18, rx: 2, fill: c, opacity: i > 1 ? 0.6 : 1 }, s); el('text', { x: 160 + 300 * Math.min(1, v) + 6, y: y + 14, class: 'ink' }, s, (v * 100).toFixed(1) + '%'); });
    const h = $('#gatHist'); h.innerHTML = ''; const vals = a.mass_self;
    // Cap x-axis tightly at max(vals) ~ 35% so bars fill the width cleanly
    const hi = Math.max(0.25, Math.ceil(Math.max(...vals) * 20) / 20), lo = 0, bins = 24, L = 24, R = 500, T = 18, B = 116;
    const cnt = new Array(bins).fill(0); vals.forEach(v => cnt[Math.min(bins - 1, Math.floor((v - lo) / (hi - lo) * bins))]++);
    const mx = Math.max(...cnt), bw = (R - L) / bins;
    cnt.forEach((k2, i) => k2 && el('rect', { x: L + i * bw + 0.5, y: B - (B - T) * k2 / mx, width: bw - 1, height: (B - T) * k2 / mx, fill: css('--muted'), opacity: 0.55 }, h));
    const xs = L + (R - L) * (vals[sel] - lo) / (hi - lo);
    el('line', { x1: xs, x2: xs, y1: T - 4, y2: B, stroke: css('--paint'), 'stroke-width': 2.2 }, h);
    el('text', { x: Math.min(R - 10, xs + 6), y: T + 6, class: 'ink' }, h, `${D.ids[sel]}: ${(vals[sel] * 100).toFixed(1)}% (mean 9.7%)`);
    el('line', { x1: L, x2: R, y1: B, y2: B, class: 'ax' }, h);
    [0, 0.1, 0.2, 0.3].filter(v => v <= hi + 0.01).forEach(v => el('text', { x: L + (R - L) * v / hi, y: B + 14, 'text-anchor': 'middle' }, h, Math.round(v * 100) + '%'));
    el('text', { x: R, y: B + 30, 'text-anchor': 'end' }, h, 'self-attention weight across all 207 LA sensors');
  }
  const p = D.p2;
  dive('dv-gat', {
    build() { draw(); mass(); searchTable('gat'); $('#gatPlay').onclick = play;
      $('#gatPrev').onclick = () => { timer = null; go(step - 1); };
      $('#gatNext').onclick = () => { timer = null; go(step + 1); };
      $('#gatResetJam').onclick = () => { jamNode = null; draw(); };
      document.querySelectorAll('#gatSteps li').forEach((li, i) => li.onclick = () => { timer = null; go(i); });
      spec('#gatSpec', [['hidden / heads', '64 / 2 heads of 32'], ['temporal encoder', 'GRU over 12 steps, shared across 207 sensors'], ['GAT layers', '1, with residual + LayerNorm'], ['dropout', 0.1], ['parameters', fmt(p.params.gat)], ['time per epoch', '≈ ' + p.sec_per_epoch.gat + ' s on M3 (MPS)'], ['epochs run', p.epochs.gat.join(', ') + ' (hit 60-epoch cap)'], ['graph', 'bidirectional METR-LA road graph + self-links']]); },
    open() { if (!reduce) setTimeout(play, 300); }, close() { timer = null; cancelAnimationFrame(raf); },
    redraw() { draw(); mass(); },
  });
  addEventListener('sensor', e => { sel = e.detail; jamNode = null; if (document.getElementById('dv-gat').open) { go(step); mass(); } });
})();

/* ================= DCRNN: diffusion on the real LA graph + encoder-decoder ================= */
(function () {
  let sel = App.target, K = 2, dir = 'both', raf = null;
  function map() {
    const s = baseMap($('#dcMap')); const row = diffuseRow(sel, K, dir); let mx = 1e-9; row.forEach((v, i) => { if (i !== sel) mx = Math.max(mx, v); });
    let reached = 0; const order = [...Array(N).keys()].sort((a, b) => row[a] - row[b]);
    order.forEach(i => { const v = i === sel ? 1 : row[i] / mx; if (i !== sel && row[i] > 1e-6) reached++;
      const c = v > 1e-4 ? rgb(rampColor(Math.sqrt(v), [[0, [0.3, 0.34, 0.37]], [0.15, [0.2, 0.62, 0.68]], [0.5, [0.95, 0.8, 0.3]], [1, [0.93, 0.45, 0.15]]])) : css('--line');
      const dot = el('circle', { cx: MX(i), cy: MY(i), r: i === sel ? 7 : 2.2 + Math.sqrt(v) * 7, fill: i === sel ? css('--ink') : c, opacity: v > 1e-4 || i === sel ? 1 : 0.6 }, s);
      if (!reduce && v > 1e-4 && i !== sel) { dot.style.transformOrigin = `${MX(i)}px ${MY(i)}px`; dot.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 300 + Math.min(600, km(sel, i) * 40), easing: 'cubic-bezier(.2,.8,.2,1)' }); } });
    el('circle', { cx: MX(sel), cy: MY(sel), r: 11, fill: 'none', stroke: css('--paint'), 'stroke-width': 2 }, s);
    const tot = row.reduce((a, v, i) => a + (i === sel ? 0 : v), 0); const top = [...Array(N).keys()].filter(i => i !== sel).sort((a, b) => row[b] - row[a]).slice(0, 3);
    $('#dcRead').innerHTML = `K = <b>${K}</b> · reaches <b>${reached}</b> LA sensors · strongest: ` + top.map(i => `<b>${D.ids[i]}</b> ${(row[i] / tot * 100).toFixed(0)}% (${km(sel, i) < 0.05 ? 'same spot, opp. dir' : km(sel, i).toFixed(1) + ' km'})`).join(', ');
    $('#dcSensor').textContent = `${D.ids[sel]} (${D.region[sel]})`;
  }
  function encdec(t) {
    const s = $('#encdec'); s.innerHTML = ''; const bw = 30, gap = 6, ex = 20, dx = 540, y = 52;
    const phase = reduce ? 23 : Math.floor(t / 160) % 30;
    el('text', { x: ex, y: 20, class: 'ink' }, s, 'ENCODER · reads 12 past steps'); el('text', { x: dx, y: 20, class: 'ink' }, s, 'DECODER · 12 steps ahead');
    for (let q = 0; q < 12; q++) { const on = phase >= q; el('rect', { x: ex + q * (bw + gap), y, width: bw, height: 40, rx: 4, fill: on ? css('--cool') : css('--panel'), stroke: css('--cool'), opacity: on ? 0.9 : 1 }, s); el('text', { x: ex + q * (bw + gap) + bw / 2, y: y + 58, 'text-anchor': 'middle' }, s, q === 11 ? 'now' : '−' + (11 - q) * 5); }
    el('path', { d: `M${ex + 12 * (bw + gap)},${y + 20} L${dx - 8},${y + 20}`, stroke: phase >= 12 ? css('--paint') : css('--line'), 'stroke-width': 3 }, s);
    el('text', { x: (ex + 12 * (bw + gap) + dx) / 2, y: y - 6, 'text-anchor': 'middle' }, s, 'state [B, 207, 64]');
    const outs = { 0: '+5', 2: '+15', 5: '+30', 11: '+60' };
    for (let q = 0; q < 12; q++) { const on = phase >= 12 + q; const x = dx + q * (bw + gap); const isOut = q in outs;
      el('rect', { x, y, width: bw, height: 40, rx: 4, fill: on ? (isOut ? css('--paint') : css('--muted')) : css('--panel'), stroke: isOut ? css('--paint') : css('--muted'), opacity: on && !isOut ? 0.5 : 1 }, s);
      if (isOut) { el('line', { x1: x + bw / 2, x2: x + bw / 2, y1: y + 40, y2: y + 64, stroke: css('--paint'), opacity: on ? 1 : 0.3 }, s); el('text', { x: x + bw / 2, y: y + 80, 'text-anchor': 'middle', class: on ? 'ink' : '' }, s, outs[q] + ' min'); } }
    if (!reduce) raf = requestAnimationFrame(encdec);
  }
  const p = D.p2;
  dive('dv-dcrnn', {
    build() { map(); searchTable('dcrnn');
      document.querySelectorAll('#dv-dcrnn .tg[data-k]').forEach(b => b.onclick = () => { K = +b.dataset.k; document.querySelectorAll('#dv-dcrnn .tg[data-k]').forEach(o => o.setAttribute('aria-pressed', o === b)); map(); App.setDiffusion(K, dir); });
      $('#dcDir').onchange = e => { dir = e.target.value; map(); App.setDiffusion(K, dir); };
      $('#dcTo3d').onclick = () => { App.setDiffusion(K, dir); App.selectSensor(sel, true); App.setMode('diffuse'); App.toMap(); };
      spec('#dcSpec', [['hidden units', 64], ['diffusion steps K', '2, forward + reverse'], ['layers', 1], ['dropout', 0.1], ['parameters', fmt(p.params.dcrnn)], ['time per epoch', '≈ ' + p.sec_per_epoch.dcrnn + ' s on M3 (MPS)'], ['epochs run', p.epochs.dcrnn.join(', ') + ' (50-min cap)'], ['graph', 'given directed METR-LA road graph'], ['training', 'lr 0.001, plateau, grad clip 5, batch 32']]); },
    open() { cancelAnimationFrame(raf); raf = requestAnimationFrame(encdec); }, close() { cancelAnimationFrame(raf); }, redraw() { map(); },
  });
  addEventListener('sensor', e => { sel = e.detail; if (document.getElementById('dv-dcrnn').open) map(); });
})();

/* ================= Controls: real vs identity vs shuffled ================= */
(function () {
  let sel = App.target, g = 'real';
  const rng = mulberry(2024); const perm = [...Array(N).keys()];
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng() * i); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const inv = new Array(N); perm.forEach((p, i) => inv[p] = i);
  const links = i => g === 'identity' ? [] : g === 'real' ? neighbours(i) : neighbours(perm[i]).map(m => inv[m]);
  const TXT = {
    real: ['Real Los Angeles road graph', 'Each sensor links strictly to its real road-distance neighbours in adj_mx.pkl.', 'GAT 4.175 · DCRNN 3.734'],
    identity: ['Identity (self-loops only)', 'Zero cross-sensor links. Exact same model parameters, but every sensor predicts alone — proving how much the road graph adds.', 'GAT 4.364 · DCRNN 4.385'],
    shuffled: ['Shuffled (wrong LA links)', 'Node IDs are scrambled by a fixed derangement: every sensor keeps its exact degree count, but listens across random LA highways.', 'GAT 4.324 (+0.040 over identity; real graph still beats it by +0.149)'],
  };
  function draw() {
    const s = baseMap($('#ctlMap'), 0.12); const L = links(sel);
    N && D.ids.forEach((_, i) => el('circle', { cx: MX(i), cy: MY(i), r: 1.8, fill: css('--muted'), opacity: 0.5 }, s));
    L.forEach((j, q) => { const ln = el('line', { x1: MX(sel), y1: MY(sel), x2: MX(j), y2: MY(j), stroke: g === 'real' ? css('--cool') : css('--hot'), 'stroke-width': 1.8, 'stroke-linecap': 'round' }, s);
      if (!reduce) { const len = Math.hypot(MX(j) - MX(sel), MY(j) - MY(sel)); ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len; ln.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 450, delay: q * 25, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)' }); }
      el('circle', { cx: MX(j), cy: MY(j), r: 3.5, fill: g === 'real' ? css('--cool') : css('--hot') }, s); });
    el('circle', { cx: MX(sel), cy: MY(sel), r: 6, fill: css('--paint') }, s);
    if (g === 'identity') el('circle', { cx: MX(sel), cy: MY(sel), r: 11, fill: 'none', stroke: css('--paint'), 'stroke-width': 2 }, s);
    const d = L.length ? L.reduce((a, j) => a + km(sel, j), 0) / L.length : 0;
    const [t, body, res] = TXT[g];
    $('#ctlText').innerHTML = `<h4>${t}</h4><p>${body}</p><p class="readout">LA Sensor <b>${D.ids[sel]}</b> (${D.region[sel]}) · <b>${L.length}</b> links${L.length ? ` · mean distance <b>${d.toFixed(1)} km</b>` : ''}</p><p class="readout">60-min test MAE: <b>${res}</b></p>`;
    $('#ctlSensor').textContent = D.ids[sel];
  }
  dive('dv-ctl', { build() { draw(); document.querySelectorAll('#ctlToggles .tg').forEach(b => b.onclick = () => { g = b.dataset.g; document.querySelectorAll('#ctlToggles .tg').forEach(o => o.setAttribute('aria-pressed', o === b)); draw(); }); }, redraw: draw });
  addEventListener('sensor', e => { sel = e.detail; if (document.getElementById('dv-ctl').open) draw(); });
})();

/* ================= Signal: fixed vs adaptive with Speed 1x/3x + Jump to Rush Hour ================= */
(function () {
  const cv = $('#sigCanvas'); let ctx, raf = null, running = true, speedMul = 1, sim;
  const DAY = 900, CYCLE = 60, SAT = 0.5;
  const rate = t => 0.12 + 0.24 * Math.max(0, Math.sin(Math.PI * ((t % DAY) / DAY) * 2 - 0.6)) ** 2;
  function fresh() {
    const r = mulberry(5); const arr = []; let t = 0; while (t < DAY) { t += -Math.log(1 - r()) / 0.5; if (r() < rate(t) / 0.5) arr.push(t); }
    const mk = adaptive => ({ adaptive, q: [], served: 0, delay: 0, green: 30, cycleStart: 0, cap: 0 });
    sim = { t: 0, arr, ai: 0, A: mk(false), B: mk(true) };
  }
  function stepSim(dt) {
    const S = sim; S.t += dt; while (S.ai < S.arr.length && S.arr[S.ai] <= S.t) { S.A.q.push(S.arr[S.ai]); S.B.q.push(S.arr[S.ai]); S.ai++; }
    [S.A, S.B].forEach(L => {
      if (S.t - L.cycleStart >= CYCLE) { L.cycleStart += CYCLE;
        if (L.adaptive) { const forecast = rate(S.t + 30) * CYCLE * 0.5; L.green = Math.max(15, Math.min(48, (L.q.length + forecast) / SAT)); } }
      const isGreen = S.t - L.cycleStart < L.green;
      if (isGreen && L.q.length) { L.cap += SAT * dt; while (L.cap >= 1 && L.q.length) { L.cap -= 1; const a = L.q.shift(); L.delay += S.t - a; L.served++; } } else if (!isGreen) L.cap = 0;
      L.isGreen = isGreen; });
    if (S.t >= DAY + 120) fresh();
  }
  function jumpToRush() {
    fresh();
    for (let s = 0; s < 360; s++) stepSim(0.8);
  }
  function size() { const r = cv.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function draw() {
    const w = cv.clientWidth, h = cv.clientHeight; ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = css('--panel'); ctx.fillRect(0, 0, w, h);
    const font = css('--f-mono') || 'monospace'; const stop = w - 90;
    [[sim.A, 'Fixed timing (50% green)', 30], [sim.B, 'Adaptive + forecast', 120]].forEach(([L, name, y]) => {
      ctx.fillStyle = css('--line'); ctx.fillRect(0, y, w, 44);
      ctx.strokeStyle = css('--paint'); ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.moveTo(0, y + 22); ctx.lineTo(stop, y + 22); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = css('--ink'); ctx.fillRect(stop, y, 3, 44);
      const n = L.q.length; for (let i = 0; i < Math.min(n, 60); i++) { const x = stop - 14 - i * 11; if (x < 0) break; ctx.fillStyle = n > 20 ? css('--hot') : css('--cool'); ctx.fillRect(x, y + 14, 9, 16); }
      ctx.beginPath(); ctx.arc(stop + 30, y + 22, 11, 0, Math.PI * 2); ctx.fillStyle = L.isGreen ? '#3fb67a' : css('--hot'); ctx.fill();
      ctx.fillStyle = css('--ink'); ctx.font = `600 12px ${font}`; ctx.fillText(name.toUpperCase(), 6, y - 8);
      ctx.fillStyle = css('--muted'); ctx.font = `12px ${font}`;
      const md = L.served ? L.delay / L.served : 0; const gtxt = `green ${Math.round(L.green)}/${CYCLE}s`;
      ctx.fillText(`queue ${n} · mean wait ${md.toFixed(0)} s · ${gtxt}`, Math.max(6, w - 340), y - 8);
    });
    const tt = Math.min(sim.t, DAY) / DAY;
    ctx.fillStyle = css('--muted'); ctx.font = `11px ${font}`; ctx.fillText('simulated LA rush-hour arrival wave', 6, h - 34);
    ctx.strokeStyle = css('--cool'); ctx.lineWidth = 1.6; ctx.beginPath();
    for (let x = 0; x <= w - 12; x += 4) { const t = x / (w - 12) * DAY; const yy = h - 6 - rate(t) * 65; x ? ctx.lineTo(6 + x, yy) : ctx.moveTo(6, yy); }
    ctx.stroke();
    ctx.fillStyle = css('--paint'); ctx.fillRect(6 + tt * (w - 12) - 1, h - 28, 3, 22);
    const a = sim.A.served ? sim.A.delay / sim.A.served : 0, b = sim.B.served ? sim.B.delay / sim.B.served : 0;
    $('#sigRead').innerHTML = `mean wait so far · fixed <b>${a.toFixed(0)} s</b> · adaptive <b>${b.toFixed(0)} s</b>`;
  }
  let lastT = 0;
  function loop(now) { const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; if (running) for (let q = 0; q < 6 * speedMul; q++) stepSim(dt * 2); draw(); raf = requestAnimationFrame(loop); }
  dive('dv-sig', {
    build() {
      fresh();
      $('#sigPlay').onclick = () => { running = !running; $('#sigPlay').textContent = running ? 'Pause' : 'Play'; };
      $('#sigSpeed').onclick = () => { speedMul = speedMul === 1 ? 3 : 1; $('#sigSpeed').textContent = `Speed: ${speedMul}×`; };
      $('#sigRush').onclick = () => { jumpToRush(); draw(); };
      $('#sigReset').onclick = () => { fresh(); draw(); };
      addEventListener('resize', () => { if (document.getElementById('dv-sig').open) size(); });
    },
    open() { size(); running = !reduce; $('#sigPlay').textContent = running ? 'Pause' : 'Play'; lastT = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); },
    close() { cancelAnimationFrame(raf); },
  });
})();
})();
