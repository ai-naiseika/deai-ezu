// 縁（えにし。であい帖の段2・ゲームの案.md の「4. 縁」）：道の県をみな「知人」まで知ると結ばれる。結んだ縁は、であい帖の「縁」から全国の地図に出せる：
// その県が収まる眺めへ寄り、金の道が引かれ、旅人（陸）か船（海）が道を進み（巡りは名所が順に光る）、物語の札が開く。
// 中身は 縁の台帳.js（骨/縁を作る.py が 紹介/縁.json から焼く。照合は 骨/縁を確かめる.py）。結んだかと日付は であい帖.js が持つ。ここは描く側だけ。
// 字は全部 textContent で入れる。リンクは https の物だけ
(function () {
  'use strict';
  const M = window.MAP3D, D = window.EN_DATA;
  if (!M || !D) return;
  const el =(tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const safeUrl = (u) => (/^https:\/\//.test(u || '') ? u : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- 地図に重ねる層（道・名所の輪・旅人）
  const layer = svg('svg', { id: 'en-layer', 'aria-hidden': 'true' });
  const halo = svg('path', { class: 'halo' }), road = svg('path', { class: 'road' }), rings = svg('g', {}), names = svg('g', { class: 'names' });
  const ICON = {
    陸: '<path d="M-10-5L0-13 10-5Z" fill="#c9a24a" stroke="#2a3146" stroke-width="1.4"/><path d="M-4-5h8l2 13h-12z" fill="#3c5a8c" stroke="#2a3146" stroke-width="1.2"/><path d="M7-3l3 12" stroke="#6a4a24" stroke-width="1.6"/>',
    海: '<path d="M-12 2h24l-5 7h-14z" fill="#8a5a2c" stroke="#2a3146" stroke-width="1.4"/><path d="M0 2v-15" stroke="#2a3146" stroke-width="1.4"/><rect x="-8" y="-12" width="16" height="11" fill="#fbf6e8" stroke="#2a3146" stroke-width="1.2"/>',
  };
  const mover = svg('g', { class: 'mover' });
  layer.append(halo, road, rings, names, mover);
  document.body.appendChild(layer);

  // ---------------------------------------------------------------- 物語の札
  const card = el('div');
  card.id = 'en-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', '縁の物語');
  document.body.appendChild(card);

  let cur = null;
  function render(e, date) {
    card.textContent = '';
    const x = el('button', 'close', '閉じる'); x.addEventListener('click', close);
    const head = el('div', 'head');
    head.append(el('b', null, '縁'), el('span', 'date', date ? `${date.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1年$2月$3日')}に結んだ縁` : ''));
    const route = e.prefs.map((n) => (M.P.find((p) => p.n === n) || {}).name || '').join(e.kind === '巡り' ? '・' : ' → ');
    card.append(x, head, el('h3', null, e.name), el('p', 'route', route));
    for (const t of e.lines) card.appendChild(el('p', 'text', t));
    const src = el('details', 'src'), sum = el('summary', null, `出どころ（${e.sources.length}）`), ul = el('ul');
    for (const s of e.sources) {
      const li = el('li'), u = safeUrl(s.url);
      if (u) { const a = el('a', null, s.title); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); } else li.textContent = s.title;
      ul.appendChild(li);
    }
    src.append(sum, ul);
    card.appendChild(src);
  }
  function show(id, date) {
    const e = D.find((q) => q.id === id);
    if (!e) return false;
    render(e, date);
    card.classList.add('open');
    // 道の点が、札の窓を除いた空いた所に収まる眺めへ（県の中にいれば出てから・浮かせた県は下ろしてから）。
    // 札はパソコンでは右、スマホでは下。前は県まるごとを画面の真ん中に収め、パソコンで四国遍路の下半分が札の下に隠れた
    // 空いた所は画面の部品を測って決める：上は題と検索の下、右は札（パソコン）か右上の方位と＋－（スマホ）の左、下は札（スマホ）か下の並びの上。
    // 札だけを避けた時は、スマホで東海道・中山道・三大松原の点が＋－や題の下に、パソコンで三名山の点が下の並びの下に入った
    const W = M.vw, H = M.vh, c = card.getBoundingClientRect(), side = c.left > W * 0.4 && c.height < H * 0.9 && c.top < H * 0.3;
    const R = (q) => { const e = document.querySelector(q); return e && e.offsetWidth ? e.getBoundingClientRect() : null; };
    let t = 0, b = side ? H : c.top, r = side ? c.left : W;
    for (const q of ['#title', '#search']) { const k = R(q); if (k) t = Math.max(t, k.bottom); }
    for (const q of ['#compass', '#zoom']) { const k = R(q); if (k && k.left > W * 0.6 && k.top < b) r = Math.min(r, k.left); }
    const bar = R('#bar');
    if (bar) b = Math.min(b, bar.top);
    const area = [-1 + 24 / W, (r - 16) / W * 2 - 1, 1 - (b - 16) / H * 2, 1 - (t + 20) / H * 2];
    // 点の高さは地面の高さで（0 で収めると、立山・白山のような高い山の点が画面の上の外へ出た）
    const kOf = (p) => (p.n ? (M.P.find((q) => q.n === p.n) || {}).k : null);
    const gy = e.pts.map((p) => { const k = kOf(p); return k != null ? M.groundY(k, p.x, p.z) : 0; });
    M.fly(M.fit(M.goal.th, 0.75, e.pts.map((p, i) => [p.x, p.z, gy[i]]), area));
    rings.textContent = ''; names.textContent = '';
    const stops = e.pts.filter((p) => p.n);
    // 名前を出すのは、巡りは全部の名所・陸と海は筋ごとの始まりと終わり（絹の道は2筋。横浜は2筋の終わりで重なるので1つに）
    const ends = new Set();
    e.pts.forEach((p, i) => { if (!p.n) return; const nx = e.pts.slice(i + 1).find((q) => q.n); if (!ends.size || p.b || !nx || nx.b) ends.add(p.name); });
    const label = e.kind === '巡り' ? stops : stops.filter((p, i) => ends.has(p.name) && stops.findIndex((q) => q.name === p.name) === i);
    for (const p of stops) { const r = svg('circle', { r: 6 }); r.dataset.i = e.pts.indexOf(p); rings.appendChild(r); }
    for (const p of label) { const t = svg('text', {}); t.textContent = p.name; t.dataset.i = e.pts.indexOf(p); names.appendChild(t); }
    mover.innerHTML = ICON[e.kind] || '';
    cur = { e, t0: performance.now() + 900, gy, ks: e.pts.map(kOf) };
    layer.classList.add('on');
    return true;
  }
  function close() {
    if (!cur) return false;
    cur = null;
    card.classList.remove('open'); layer.classList.remove('on');
    return true;
  }
  M.onDismiss(close);                              // 地図の空いた所を押すと、しまうだけ（県は選ばない）
  M.on('world', (w) => { if (w) close(); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && cur && !e.target.closest('input, textarea')) { close(); e.stopImmediatePropagation(); } }, true);

  // ---------------------------------------------------------------- 毎コマ：点を画面に写し、なめらかな道に。引き終わったら旅人・船が進む
  // 道は 2.4 秒で引き、旅人は陸 8 秒・海 10 秒で端から端へ（くり返す）。巡りは名所の輪が順に光る
  function smooth(P) {
    if (P.length < 2) return '';
    let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], e = P[Math.min(P.length - 1, i + 2)];
      d += `C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
    }
    return d;
  }
  M.on('frame', () => {
    if (!cur) return;
    const e = cur.e, t = (performance.now() - cur.t0) / 1000, strands = [[]], at = [];
    e.pts.forEach((p, i) => {
      const k = cur.ks[i], s = M.project(p.x, cur.gy[i] + (k != null ? M.liftY(k) : 0), p.z);     // 浮き上がりは毎コマ（下りる途中の県もある）
      at[i] = s.ok ? [s.x, s.y] : null;
      if (p.b && strands[strands.length - 1].length) strands.push([]);      // 別の筋（絹の道の2筋）
      if (s.ok) strands[strands.length - 1].push([s.x, s.y]);
    });
    const d = strands.map(smooth).join('');
    halo.setAttribute('d', d); road.setAttribute('d', d);
    const len = d ? road.getTotalLength() : 0, u = clamp(t / 2.4, 0, 1);
    road.style.strokeDasharray = halo.style.strokeDasharray = `${len} ${len}`;
    road.style.strokeDashoffset = halo.style.strokeDashoffset = String(len * (1 - u));
    for (const r of rings.children) {
      const q = at[+r.dataset.i];
      if (!q) { r.style.display = 'none'; continue; }
      r.style.display = ''; r.setAttribute('cx', q[0].toFixed(1)); r.setAttribute('cy', q[1].toFixed(1));
    }
    for (const n of names.children) {
      const q = at[+n.dataset.i];
      if (!q) { n.style.display = 'none'; continue; }
      n.style.display = ''; n.setAttribute('x', q[0].toFixed(1)); n.setAttribute('y', (q[1] - 12).toFixed(1));
    }
    if (e.kind === '巡り') {
      // 名所の輪が順に光る（1つ 1.6 秒）
      const lit = u < 1 ? -1 : Math.floor((t - 2.4) / 1.6) % rings.children.length;
      [...rings.children].forEach((r, i) => r.classList.toggle('lit', i === lit));
      mover.style.display = 'none';
      return;
    }
    if (u < 1 || !len) { mover.style.display = 'none'; return; }
    const dur = e.kind === '海' ? 10 : 8, s = ((t - 2.4) / dur) % 1, p = road.getPointAtLength(s * len), q = road.getPointAtLength(Math.min(len, s * len + 2));
    mover.style.display = '';
    mover.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${q.x < p.x ? -1 : 1} 1)`);
  });

  window.EN = { show, close, get cur() { return cur && cur.e.id; }, data: D };
})();
