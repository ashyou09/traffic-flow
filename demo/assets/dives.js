/* Deep dives: one unfoldable panel per model. Each animation runs only while its panel is open. */
(function () {
'use strict';
const { D, N, css, el, $, rgb, rampColor, mulberry, reduce, state, neighbours, nbrOut, nbrIn, diffuseRow, series, axesY } = window.App;
const fmt = n => Number(n).toLocaleString('en');
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* step lists are a two-column grid: keep each item's text in one cell */
document.querySelectorAll('.steps li').forEach(li => { const s = document.createElement('span'); while (li.firstChild) s.appendChild(li.firstChild); li.appendChild(s); });

/* open/close lifecycle */
function dive(id, hooks) {
  const d = document.getElementById(id); let built = false;
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

/* projection for the 2D mini-maps */
const lonMin = Math.min(...D.lon), lonMax = Math.max(...D.lon), latMin = Math.min(...D.lat), latMax = Math.max(...D.lat);
const cosL = Math.cos((latMin + latMax) / 2 * Math.PI / 180);
const mapW = 560, mapH = 330, pad = 18;
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
  el('text', { x: mapW - 4, y: mapH - 4, 'text-anchor': 'end' }, svg, '10 km ≈ ' + Math.round(10 / 111 * sc) + ' px · north up');
  return svg;
}

/* ================= XGBoost: live boosting on stumps ================= */
(function () {
  const ys = series, n = ys.length, eta = 0.3, MAXT = 80;
  let F, trees, timer = null, last = null;
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
      $('#boostStep').onclick = () => { stop(); addTree(); steps('#boostSteps', 3); draw(); };
      $('#boostReset').onclick = () => { stop(); reset(); steps('#boostSteps', 0); draw(); };
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
    const rows = D.p1.xgb_importance_60[k]; const s = $('#impChart'); s.innerHTML = ''; const L = 170, R = 470, h = 22, mx = Math.max(...rows.map(r => r[1]));
    const ha = new Set(['anomaly_now', 'ha_delta', 'ha_target', 'ha_now']);
    rows.forEach(([f, v], i) => { const y = i * (h + 2) + 4; const col = ha.has(f) ? css('--paint') : f.startsWith('speed_change') ? '#b9cf7a' : f.startsWith('speed_lag') ? '#e9b44c' : f.startsWith('rolling') ? '#7cc3c9' : f.includes('missing') ? '#e5a08f' : '#c9a9d9';
      el('text', { x: L - 8, y: y + 15, 'text-anchor': 'end', class: 'ink' }, s, f);
      const bar = el('rect', { x: L, y, width: 0, height: h - 4, rx: 2, fill: col }, s);
      requestAnimationFrame(() => { bar.style.transition = reduce ? '' : `width .5s ${i * 30}ms cubic-bezier(.2,.8,.2,1)`; bar.setAttribute('width', (R - L) * v / mx); });
      el('text', { x: L + (R - L) * v / mx + 6, y: y + 15 }, s, (v * 100).toFixed(1) + '%'); });
    $('#impCap').textContent = k === 'xgb_ha'
      ? 'Share of total gain, 60-minute model. With HA features, "how far from normal is it right now" (anomaly_now) and "how will normal change by then" (ha_delta) dominate. Amber bars are the HA features.'
      : 'Share of total gain, 60-minute model without HA features. Recent change (trend) and time-of-day flags carry the forecast; nothing tells the model what normal looks like.';
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
      txt += ` · ${fmt(shown)} resamples · 95% interval here <b>[${a.toFixed(3)}, ${z.toFixed(3)}]</b>`; }
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

/* ================= GAT: one attention layer ================= */
(function () {
  let step = 0, timer = null, raf = null, sel = App.target;
  const CX = 210, CY = 168, RAD = 118;
  function layout() {
    const nb = neighbours(sel).slice(0, 14);
    const ang = nb.map(j => Math.atan2(-(D.lat[j] - D.lat[sel]), (D.lon[j] - D.lon[sel]) * Math.cos(D.lat[sel] * Math.PI / 180)));
    const order = nb.map((j, q) => [j, ang[q]]).sort((a, b) => a[1] - b[1]);
    // spread angles so labels do not collide, keeping compass order
    // even spacing keeps labels apart; compass order is kept
    const pts = order.map(([j], q) => { const a = order[0][1] + (q / order.length) * Math.PI * 2; return { j, x: CX + Math.cos(a) * RAD, y: CY + Math.sin(a) * RAD * 0.92 }; });
    return pts;
  }
  function draw(t = 0) {
    const s = $('#gatViz'); s.innerHTML = ''; const pts = layout(); const self = D.att.mass_self[sel]; const each = pts.length ? (1 - self) / pts.length : 0;
    const paint = css('--paint'), cool = css('--cool'), ink = css('--ink'), muted = css('--muted');
    if (step >= 3) { const r = mulberry(sel); for (let q = 0; q < 10; q++) { const a = r() * Math.PI * 2, rr = RAD + 58 + r() * 12; const gx = CX + Math.cos(a) * rr, gy = CY + Math.sin(a) * rr * 0.8;
      if (gy < 8 || gy > 322) continue; el('circle', { cx: gx, cy: gy, r: 4, fill: 'none', stroke: muted, opacity: 0.5 }, s); el('text', { x: gx, y: gy + 3.5, 'text-anchor': 'middle', style: `fill:${css('--hot')};font-size:9px` }, s, '×'); } }
    pts.forEach(p => { const w = step >= 4 ? 1 + 18 * each : 1.2; el('line', { x1: p.x, y1: p.y, x2: CX, y2: CY, stroke: step >= 2 ? cool : muted, 'stroke-width': w, opacity: step >= 2 ? 0.7 : 0.35, 'stroke-dasharray': step === 2 ? '4 4' : '', 'stroke-linecap': 'round' }, s); });
    if (step >= 4) el('circle', { cx: CX, cy: CY - 30, r: 16, fill: 'none', stroke: paint, 'stroke-width': 1 + 18 * self, opacity: 0.8 }, s);
    if (step === 5) pts.forEach((p, q) => { const f = ((t / 1400) + q / pts.length) % 1; el('circle', { cx: p.x + (CX - p.x) * f, cy: p.y + (CY - p.y) * f, r: 2 + 6 * Math.sqrt(each), fill: paint }, s); });
    pts.forEach(p => { el('circle', { cx: p.x, cy: p.y, r: 11, fill: css('--panel'), stroke: cool, 'stroke-width': 1.5 }, s);
      if (step >= 0) for (let b = 0; b < 4; b++) { const v = (Math.sin(p.j * 3.1 + b * 1.7) + 1) / 2; el('rect', { x: p.x - 7 + b * 3.6, y: p.y + 4 - v * 9, width: 2.6, height: v * 9, fill: step >= 1 && b >= 2 ? paint : cool }, s); }
      el('text', { x: p.x, y: p.y + (p.y > CY ? 24 : -16), 'text-anchor': 'middle' }, s, D.ids[p.j]);
      if (step >= 4) el('text', { x: p.x + (p.x > CX ? 16 : -16), y: p.y + 4, 'text-anchor': p.x > CX ? 'start' : 'end', class: 'ink' }, s, (each * 100).toFixed(1) + '%'); });
    const glow = step >= 6 ? 26 + Math.sin(t / 200) * 2 : 20;
    el('circle', { cx: CX, cy: CY, r: glow, fill: step >= 6 ? paint : css('--panel'), stroke: paint, 'stroke-width': 2.5 }, s);
    el('text', { x: CX, y: CY + 4, 'text-anchor': 'middle', style: `fill:${step >= 6 ? '#1b1300' : ink};font-weight:600` }, s, D.ids[sel]);
    if (step >= 4) el('text', { x: CX, y: CY - 52, 'text-anchor': 'middle', class: 'ink' }, s, 'self ' + (self * 100).toFixed(1) + '%');
    // right rail: what the step means
    const RX = 400; const msg = [
      ['encode', 'each sensor: last hour → h (64)'], ['project', 'Wh → 2 heads × 32'], ['score', 'eᵢⱼ for every real link'], ['mask', 'non-links → −∞ (×)'],
      ['softmax', `α sums to 1 · self ${(self * 100).toFixed(0)}%`], ['aggregate', 'Σ α·Whⱼ + residual, LayerNorm'], ['predict', 'Δ speed for +5/+15/+30/+60']][step];
    el('text', { x: RX, y: 30, style: `fill:${paint};font-weight:600;font-size:12px;letter-spacing:.08em` }, s, `STEP ${step + 1} · ${msg[0].toUpperCase()}`);
    el('text', { x: RX, y: 50, class: 'ink' }, s, msg[1]);
    if (step >= 6) ['+5', '+15', '+30', '+60'].forEach((h, q) => { el('rect', { x: RX, y: 80 + q * 30, width: 130, height: 22, rx: 3, fill: 'none', stroke: paint }, s); el('text', { x: RX + 8, y: 95 + q * 30, class: 'ink' }, s, h + ' min forecast'); });
    $('#gatRead').innerHTML = `<b>${pts.length}</b> real neighbours · self-attention <b>${(self * 100).toFixed(1)}%</b> · entropy <b>${D.att.entropy[sel].toFixed(2)}</b>`;
    $('#gatSensor').textContent = D.ids[sel];
    steps('#gatSteps', step);
  }
  function loop(t) { draw(t); if (step === 5 || step === 6) raf = requestAnimationFrame(loop); }
  function go(s2) { step = Math.max(0, Math.min(6, s2)); cancelAnimationFrame(raf); if ((step === 5 || step === 6) && !reduce) raf = requestAnimationFrame(loop); else draw(); }
  async function play() { if (timer) return; timer = true; $('#gatPlay').textContent = 'Playing…'; for (let q = 0; q <= 6 && timer; q++) { go(q); await sleep(reduce ? 0 : 1500); } timer = null; $('#gatPlay').textContent = 'Play layer'; }
  function mass() {
    const s = $('#gatMass'); s.innerHTML = ''; const a = D.att; const rows = [['self', a.mass_self[sel], css('--paint')], ['all neighbours', a.mass_neighbours[sel], css('--cool')], [`downstream (${a.num_downstream[sel]})`, a.mass_downstream[sel], css('--cool')], [`upstream (${a.num_upstream[sel]})`, a.mass_upstream[sel], css('--cool')]];
    rows.forEach(([n, v, c], i) => { const y = i * 30 + 6; el('text', { x: 150, y: y + 14, 'text-anchor': 'end', class: 'ink' }, s, n); el('rect', { x: 160, y, width: 300, height: 18, rx: 2, fill: css('--line') }, s); el('rect', { x: 160, y, width: 300 * v, height: 18, rx: 2, fill: c, opacity: i > 1 ? 0.6 : 1 }, s); el('text', { x: 160 + 300 * v + 6, y: y + 14, class: 'ink' }, s, (v * 100).toFixed(1) + '%'); });
    const h = $('#gatHist'); h.innerHTML = ''; const vals = a.mass_self; const lo = 0, hi = Math.max(...vals) * 1.05, bins = 30, L = 20, R = 500, T = 10, B = 115;
    const cnt = new Array(bins).fill(0); vals.forEach(v => cnt[Math.min(bins - 1, Math.floor((v - lo) / (hi - lo) * bins))]++); const mx = Math.max(...cnt), bw = (R - L) / bins;
    cnt.forEach((k2, i) => k2 && el('rect', { x: L + i * bw + 0.5, y: B - (B - T) * k2 / mx, width: bw - 1, height: (B - T) * k2 / mx, fill: css('--muted'), opacity: 0.5 }, h));
    const xs = L + (R - L) * (vals[sel] - lo) / (hi - lo); el('line', { x1: xs, x2: xs, y1: T - 4, y2: B, stroke: css('--paint'), 'stroke-width': 2 }, h);
    el('line', { x1: L, x2: R, y1: B, y2: B, class: 'ax' }, h); [0, 0.1, 0.2].filter(v => v <= hi).forEach(v => el('text', { x: L + (R - L) * v / hi, y: B + 14, 'text-anchor': 'middle' }, h, (v * 100) + '%'));
    el('text', { x: R, y: B + 30, 'text-anchor': 'end' }, h, 'self-attention, all 207 sensors');
  }
  const p = D.p2;
  dive('dv-gat', {
    build() { draw(); mass(); searchTable('gat'); $('#gatPlay').onclick = play; $('#gatPrev').onclick = () => { timer = null; go(step - 1); }; $('#gatNext').onclick = () => { timer = null; go(step + 1); };
      document.querySelectorAll('#gatSteps li').forEach((li, i) => li.onclick = () => { timer = null; go(i); });
      spec('#gatSpec', [['hidden / heads', '64 / 2 heads of 32'], ['temporal encoder', 'GRU over 12 steps, shared by all sensors'], ['GAT layers', '1, with residual + LayerNorm'], ['dropout', 0.1], ['parameters', fmt(p.params.gat)], ['time per epoch', '≈ ' + p.sec_per_epoch.gat + ' s on M3 (MPS)'], ['epochs run', p.epochs.gat.join(', ') + ' (stopped at the limit)'], ['graph', 'bidirectional road graph + self-links']]); },
    open() { if (!reduce) setTimeout(play, 300); }, close() { timer = null; cancelAnimationFrame(raf); },
    redraw() { draw(); mass(); },
  });
  addEventListener('sensor', e => { sel = e.detail; if (document.getElementById('dv-gat').open) { go(step); mass(); } });
})();

/* ================= DCRNN: diffusion on the real graph + encoder-decoder ================= */
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
    $('#dcRead').innerHTML = `K = <b>${K}</b> · reaches <b>${reached}</b> other sensors · strongest: ` + top.map(i => `<b>${D.ids[i]}</b> ${(row[i] / tot * 100).toFixed(0)}% (${km(sel, i) < 0.05 ? 'same spot, other direction' : km(sel, i).toFixed(1) + ' km'})`).join(', ');
    $('#dcSensor').textContent = D.ids[sel];
  }
  function encdec(t) {
    const s = $('#encdec'); s.innerHTML = ''; const bw = 30, gap = 6, ex = 20, dx = 540, y = 52;
    const phase = reduce ? 23 : Math.floor(t / 160) % 30;
    el('text', { x: ex, y: 20, class: 'ink' }, s, 'ENCODER · reads 12 past steps'); el('text', { x: dx, y: 20, class: 'ink' }, s, 'DECODER · 12 steps ahead');
    for (let q = 0; q < 12; q++) { const on = phase >= q; el('rect', { x: ex + q * (bw + gap), y, width: bw, height: 40, rx: 4, fill: on ? css('--cool') : css('--panel'), stroke: css('--cool'), opacity: on ? 0.9 : 1 }, s); el('text', { x: ex + q * (bw + gap) + bw / 2, y: y + 58, 'text-anchor': 'middle' }, s, q === 11 ? 'now' : '−' + (11 - q) * 5); }
    el('path', { d: `M${ex + 12 * (bw + gap)},${y + 20} L${dx - 8},${y + 20}`, stroke: phase >= 12 ? css('--paint') : css('--line'), 'stroke-width': 3, 'marker-end': '' }, s);
    el('text', { x: (ex + 12 * (bw + gap) + dx) / 2, y: y - 6, 'text-anchor': 'middle' }, s, 'state, 207 × 64');
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
      spec('#dcSpec', [['hidden units', 64], ['diffusion steps K', '2, forward + reverse'], ['layers', 1], ['dropout', 0.1], ['parameters', fmt(p.params.dcrnn)], ['time per epoch', '≈ ' + p.sec_per_epoch.dcrnn + ' s on M3 (MPS)'], ['epochs run', p.epochs.dcrnn.join(', ') + ' (50-minute wall-clock cap)'], ['graph', 'given directed road graph'], ['training', 'lr 0.001, plateau, grad clip 5, batch 32']]); },
    open() { cancelAnimationFrame(raf); raf = requestAnimationFrame(encdec); }, close() { cancelAnimationFrame(raf); }, redraw() { map(); },
  });
  addEventListener('sensor', e => { sel = e.detail; if (document.getElementById('dv-dcrnn').open) map(); });
})();

/* ================= Controls: real vs identity vs shuffled ================= */
(function () {
  let sel = App.target, g = 'real';
  const rng = mulberry(2024); const perm = [...Array(N).keys()];
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng() * i); [perm[i], perm[j]] = [perm[j], perm[i]]; } // Sattolo: a single cycle, so no fixed points
  const inv = new Array(N); perm.forEach((p, i) => inv[p] = i);
  const links = i => g === 'identity' ? [] : g === 'real' ? neighbours(i) : neighbours(perm[i]).map(m => inv[m]);
  const TXT = {
    real: ['Real road graph', 'Each sensor links to the sensors it is actually connected to by road. This is the graph both models were built for.', 'GAT 4.175 · DCRNN 3.734'],
    identity: ['Identity', 'Only the self-link is kept. The model is unchanged, but no information can travel between sensors. If this did as well as the real graph, the graph would not matter.', 'GAT 4.364 · DCRNN 4.385'],
    shuffled: ['Shuffled', 'Sensors are relabelled by a derangement: every sensor keeps the same number of links, but they point to the wrong places, often across the city. This tests whether any extra connections help, or only the true roads.', 'GAT 4.324 (DCRNN shuffled was not trained)'],
  };
  function draw() {
    const s = baseMap($('#ctlMap'), 0.12); const L = links(sel);
    N && D.ids.forEach((_, i) => el('circle', { cx: MX(i), cy: MY(i), r: 1.8, fill: css('--muted'), opacity: 0.5 }, s));
    L.forEach((j, q) => { const ln = el('line', { x1: MX(sel), y1: MY(sel), x2: MX(j), y2: MY(j), stroke: g === 'real' ? css('--cool') : css('--hot'), 'stroke-width': 1.8, 'stroke-linecap': 'round' }, s);
      if (!reduce) { const len = Math.hypot(MX(j) - MX(sel), MY(j) - MY(sel)); ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len; ln.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 450, delay: q * 25, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)' }); }
      el('circle', { cx: MX(j), cy: MY(j), r: 3.5, fill: g === 'real' ? css('--cool') : css('--hot') }, s); });
    el('circle', { cx: MX(sel), cy: MY(sel), r: 6, fill: css('--paint') }, s);
    if (g === 'identity') el('circle', { cx: MX(sel), cy: MY(sel) - 12, r: 8, fill: 'none', stroke: css('--paint'), 'stroke-width': 2 }, s);
    const d = L.length ? L.reduce((a, j) => a + km(sel, j), 0) / L.length : 0;
    const [t, body, res] = TXT[g];
    $('#ctlText').innerHTML = `<h4>${t}</h4><p>${body}</p><p class="readout">Sensor <b>${D.ids[sel]}</b> · <b>${L.length}</b> links${L.length ? ` · mean straight-line length <b>${d.toFixed(1)} km</b>` : ''}</p><p class="readout">60-min test MAE: <b>${res}</b></p>`;
    $('#ctlSensor').textContent = D.ids[sel];
  }
  dive('dv-ctl', { build() { draw(); document.querySelectorAll('#ctlToggles .tg').forEach(b => b.onclick = () => { g = b.dataset.g; document.querySelectorAll('#ctlToggles .tg').forEach(o => o.setAttribute('aria-pressed', o === b)); draw(); }); }, redraw: draw });
  addEventListener('sensor', e => { sel = e.detail; if (document.getElementById('dv-ctl').open) draw(); });
})();

/* ================= Signal: fixed vs adaptive (illustration) ================= */
(function () {
  const cv = $('#sigCanvas'); let ctx, raf = null, running = true, sim;
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
  function size() { const r = cv.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function draw() {
    const w = cv.clientWidth, h = cv.clientHeight; ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = css('--panel'); ctx.fillRect(0, 0, w, h);
    const font = css('--f-mono') || 'monospace'; const stop = w - 90;
    [[sim.A, 'Fixed timing', 30], [sim.B, 'Adaptive + forecast', 125]].forEach(([L, name, y]) => {
      ctx.fillStyle = css('--line'); ctx.fillRect(0, y, w, 44);
      ctx.strokeStyle = css('--paint'); ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.moveTo(0, y + 22); ctx.lineTo(stop, y + 22); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = css('--ink'); ctx.fillRect(stop, y, 3, 44);
      const n = L.q.length; for (let i = 0; i < Math.min(n, 60); i++) { const x = stop - 14 - i * 11; if (x < 0) break; ctx.fillStyle = n > 25 ? css('--hot') : css('--cool'); ctx.fillRect(x, y + 14, 9, 16); }
      ctx.beginPath(); ctx.arc(stop + 30, y + 22, 11, 0, Math.PI * 2); ctx.fillStyle = L.isGreen ? '#3fb67a' : css('--hot'); ctx.fill();
      ctx.fillStyle = css('--ink'); ctx.font = `600 12px ${font}`; ctx.fillText(name.toUpperCase(), 6, y - 8);
      ctx.fillStyle = css('--muted'); ctx.font = `12px ${font}`;
      const md = L.served ? L.delay / L.served : 0; const gtxt = `green ${Math.round(L.green)}/${CYCLE}s`;
      ctx.fillText(`queue ${n} · mean wait ${md.toFixed(0)} s · ${gtxt}`, Math.max(6, w - 330), y - 8);
    });
    const tt = Math.min(sim.t, DAY) / DAY; ctx.fillStyle = css('--muted'); ctx.font = `11px ${font}`; ctx.fillText('arrival rate over the run', 6, h - 26);
    ctx.strokeStyle = css('--muted'); ctx.beginPath(); for (let x = 0; x <= w - 12; x += 4) { const t = x / (w - 12) * DAY; const yy = h - 6 - rate(t) * 40; x ? ctx.lineTo(6 + x, yy) : ctx.moveTo(6, yy); } ctx.stroke();
    ctx.fillStyle = css('--paint'); ctx.fillRect(6 + tt * (w - 12) - 1, h - 22, 3, 18);
    const a = sim.A.served ? sim.A.delay / sim.A.served : 0, b = sim.B.served ? sim.B.delay / sim.B.served : 0;
    $('#sigRead').innerHTML = `mean wait so far · fixed <b>${a.toFixed(0)} s</b> · adaptive <b>${b.toFixed(0)} s</b>`;
  }
  let lastT = 0;
  function loop(now) { const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; if (running) for (let q = 0; q < 6; q++) stepSim(dt * 2); draw(); raf = requestAnimationFrame(loop); }
  dive('dv-sig', {
    build() { fresh(); $('#sigPlay').onclick = () => { running = !running; $('#sigPlay').textContent = running ? 'Pause' : 'Play'; }; $('#sigReset').onclick = () => fresh(); addEventListener('resize', () => { if (document.getElementById('dv-sig').open) size(); }); },
    open() { size(); running = !reduce; $('#sigPlay').textContent = running ? 'Pause' : 'Play'; lastT = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); },
    close() { cancelAnimationFrame(raf); },
  });
})();
})();
