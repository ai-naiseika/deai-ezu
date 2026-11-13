// 全国宝さがし（本人 2026-11-12 の構想「テーマごとに宝が何個もあり、謎めいたヒントや地図を手がかりに探す。宝はレアな収集物。テーマを揃えると称号、
// 全部見つけたら石碑に刻まれて殿堂入り」・2026-11-13「始めていい。石碑は皆が見られる石碑」）。設計＝宝さがし_設計案.md
// 手がかりは3段（謎かけ → 地図の切れ端 → 方角と距離）。「この宝をさがす」で選んだ宝の場所に寄ると地面が光り、押すと掘り出す。
// 記録はこの端末に残す。みんなの石碑に参加した時だけ、見つけた宝（端末の番号と宝の番号だけ）を受け口へ送る
(function () {
  'use strict';
  const M = window.MAP3D;
  if (!M) return;
  const $ = (s) => document.querySelector(s);
  const KEY = 'zenkoku3d-takara-v1';
  let THEMES = [];                            // テーマの並びは台帳の順（宝.js を読んだ時に決める）
  const TITLE = { '食': '食の宝の主', '歴史': '歴史の宝の主', '山': '山の宝の主', '偉人': '偉人の宝の主', '酪農': '酪農の宝の主', '日本の宝': '日本の宝の主' };
  const API = (() => {
    const t = /[?&]sugoapi=([^&]+)/.exec(location.search), u = t ? decodeURIComponent(t[1]) : '';
    return /^http:\/\/127\.0\.0\.1:\d+$/.test(u) ? u : 'https://deai-banzuke.ai-naiseika.workers.dev';
  })();
  const rid = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  function load() {
    const o = { found: {}, hint: {}, hunt: null, device: rid(), join: false, synced: {}, name: '' };
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === 'object') {
        for (const k of ['found', 'hint', 'synced']) if (s[k] && typeof s[k] === 'object') o[k] = s[k];
        if (typeof s.hunt === 'string') o.hunt = s.hunt;
        if (/^[0-9a-f]{32}$/.test(s.device || '')) o.device = s.device;
        o.join = s.join === true;
        if (typeof s.name === 'string') o.name = s.name.slice(0, 10);
      }
    } catch (e) { /* 読めない時は始め直す */ }
    return o;
  }
  const L = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) { /* 残せない端末では、この開き方の間だけ */ } };
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };

  // 台帳（宝.js）は、宝さがしを開いた時に初めて読む（最初の読み込みを重くしない）
  let D = null, loading = null;
  function data() {
    if (D) return Promise.resolve(D);
    if (!loading) loading = new Promise((ok, ng) => {
      const s = document.createElement('script');
      s.src = '宝.js'; s.onload = () => { D = window.TAKARA_DATA; THEMES = [...new Set(D.items.map((t) => t.theme))]; ok(D); }; s.onerror = () => { loading = null; ng(new Error('load')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  const byId = (id) => D && D.items.find((t) => t.id === id);
  const pOf = (t) => M.P.find((p) => p.n === t.pref);
  const prefName = (t) => { const p = pOf(t); return p ? p.name : ''; };

  // ---------------------------------------------------------------- 窓
  const box = el('div'); box.id = 'takara'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '全国宝さがし');
  document.body.appendChild(box);
  function head(title, back) {
    box.textContent = '';
    const h = el('div', 'head');
    if (back) { const b = el('button', 'back', '‹ もどる'); b.type = 'button'; b.addEventListener('click', back); h.appendChild(b); }
    h.append(el('b', null, title));
    const x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', '閉じる'); x.addEventListener('click', close); h.appendChild(x);
    box.appendChild(h);
  }
  const got = (th) => D.items.filter((t) => t.theme === th && L.found[t.id]).length;
  const all = (th) => D.items.filter((t) => t.theme === th).length;
  function open(view) {
    box.classList.add('open');
    head('全国宝さがし');
    box.appendChild(el('p', 'note', '宝の地図帳を開いています…'));
    data().then(() => (view || themes)()).catch(() => { head('全国宝さがし'); box.appendChild(el('p', 'note', '宝の地図帳を読み込めませんでした。電波を確かめて、もう一度開いてください。')); });
  }
  function close() { box.classList.remove('open'); }
  function themes() {
    head('全国宝さがし');
    box.appendChild(el('p', 'note', 'テーマを選んで、謎かけを手がかりに宝の場所を探します。場所に寄ると地面が光ります。'));
    for (const th of THEMES) {
      const b = el('button', 'big', `${th}の宝　${got(th)} / ${all(th)}`);
      if (got(th) === all(th)) b.appendChild(el('small', null, `　称号「${TITLE[th]}」`));
      b.type = 'button'; b.addEventListener('click', () => themeView(th)); box.appendChild(b);
    }
    stoneBox();
    box.appendChild(el('p', 'note small', '見つけた宝はこの端末に残ります（消すと見えなくなります）。みんなの石碑に参加した時だけ、端末の番号と見つけた宝の番号を受け口に送ります。'));
  }
  function themeView(th) {
    head(`${th}の宝　${got(th)} / ${all(th)}`, themes);
    for (const t of D.items.filter((x) => x.theme === th)) {
      const card = el('div', 'tk' + (L.found[t.id] ? ' got' : '') + (L.hunt === t.id ? ' hunt' : ''));
      if (L.found[t.id]) {
        card.append(el('b', null, `✦ ${t.name}`), el('span', 'pref', `（${prefName(t)}）`));
        const more = el('button', 'small', '見る'); more.type = 'button'; more.addEventListener('click', () => found(t)); card.appendChild(more);
      } else {
        card.appendChild(el('p', 'riddle', t.riddle));
        const lv = L.hint[t.id] || 1;
        if (lv >= 2) card.appendChild(piece(t));
        if (lv >= 3) card.appendChild(el('p', 'dir', dirText(t)));
        const row = el('div', 'row');
        const go = el('button', 'small', L.hunt === t.id ? 'さがしている宝' : 'この宝をさがす'); go.type = 'button';
        go.addEventListener('click', () => { L.hunt = t.id; save(); close(); chip(); });
        row.appendChild(go);
        if (lv < 3) {
          const h = el('button', 'small sub', lv === 1 ? '地図の切れ端を見る' : '方角と距離を見る'); h.type = 'button';
          h.addEventListener('click', () => { L.hint[t.id] = lv + 1; save(); themeView(th); });
          row.appendChild(h);
        }
        card.appendChild(row);
      }
      box.appendChild(card);
    }
  }
  // 2段目：宝のまわりの岸と県境だけを描いた地図の切れ端（名前は描かない）。場所に × 印
  function piece(t) {
    const R = 70, NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `${t.x - R} ${t.z - R} ${R * 2} ${R * 2}`); svg.setAttribute('class', 'piece'); svg.setAttribute('aria-label', '地図の切れ端');
    for (const p of (window.JAPAN && JAPAN.prefs) || []) for (const g of p.ring) {
      let near = false, d = '';
      for (let i = 0; i < g.length; i += 2) { if (Math.abs(g[i] - t.x) < R * 1.4 && Math.abs(g[i + 1] - t.z) < R * 1.4) near = true; d += (i ? 'L' : 'M') + g[i].toFixed(1) + ' ' + g[i + 1].toFixed(1); }
      if (!near) continue;
      const path = document.createElementNS(NS, 'path'); path.setAttribute('d', d + 'Z'); svg.appendChild(path);
    }
    const m = document.createElementNS(NS, 'text'); m.setAttribute('x', t.x); m.setAttribute('y', t.z); m.setAttribute('class', 'mark'); m.textContent = '×';
    svg.appendChild(m);
    return svg;
  }
  // 3段目：県のまん中からの方角と距離（地図の座標は 1＝1km・z は南が大きい）
  function dirText(t) {
    const p = pOf(t); if (!p) return '';
    const dx = t.x - p.ax, dn = p.az - t.z, km = Math.round(Math.hypot(dx, dn) / 5) * 5;
    const DIRS = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    const a = (Math.atan2(dx, dn) * 180 / Math.PI + 360 + 22.5) % 360;
    return km < 5 ? `${p.name}のまん中のあたり` : `${p.name}のまん中から${DIRS[Math.floor(a / 45)]}へ約${km}km`;
  }
  function found(t) {
    head(`✦ ${t.name}`, () => themeView(t.theme));
    box.append(el('p', 'pref', `${t.theme}の宝・${prefName(t)}`), el('p', 'text', t.text));
    if (t.src.length) {
      const s = el('p', 'src', '出どころ：');
      t.src.forEach((x, i) => { const a = el('a', null, x.title); a.href = x.url; a.target = '_blank'; a.rel = 'noopener'; if (i) s.append('・'); s.appendChild(a); });
      box.appendChild(s);
    }
  }

  // ---------------------------------------------------------------- さがす：選んだ宝の場所に寄ると、地面が光る
  const spot = el('button', null); spot.id = 'takara-spot'; spot.type = 'button'; spot.setAttribute('aria-label', '宝を掘り出す');
  const tip = el('button', null); tip.id = 'takara-chip'; tip.type = 'button';
  document.body.append(spot, tip);
  tip.addEventListener('click', () => open(() => { const t = byId(L.hunt); t ? themeView(t.theme) : themes(); }));
  function chip() {
    const t = byId(L.hunt);
    tip.textContent = t ? `宝さがし中：${t.riddle}` : '';
    tip.classList.toggle('on', !!t);
  }
  let shown = false;
  M.on('frame', () => {
    const t = D && L.hunt && !L.found[L.hunt] ? byId(L.hunt) : null;
    let on = false;
    // 光るのは、寄って（距離 700 まで）見ている所から宝まで、地図の上で寄り方に応じた数十km 以内の時だけ
    // （画面の真ん中からの近さで決めると、引いた眺めで100km 離れた別の宝の場所でも光った）
    const c = M.cam;
    if (t && !M.inside && !document.body.classList.contains('opening') && c.D < 700 && Math.hypot(t.x - c.x, t.z - c.z) < Math.max(20, c.D * 0.08)) {
      const p = pOf(t), s = M.project(t.x, (p && p.ay) || 0, t.z);
      if (s.ok) {
        on = true;
        spot.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      }
    }
    if (on !== shown) { shown = on; spot.classList.toggle('on', on); }
  });
  spot.addEventListener('click', () => {
    const t = byId(L.hunt);
    if (!t || L.found[t.id]) return;
    L.found[t.id] = Date.now(); L.hunt = null; save(); chip();
    spot.classList.add('dig'); setTimeout(() => spot.classList.remove('dig'), 900);
    const done = got(t.theme) === all(t.theme);
    toast(done ? `宝を見つけた！「${t.name}」—— ${t.theme}の宝を全部そろえて、称号「${TITLE[t.theme]}」` : `宝を見つけた！「${t.name}」`);
    open(() => found(t));
    sync();
  });
  function toast(s) {
    const e = $('#mame-toast'); if (!e) return;
    e.textContent = s; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 6000);
  }

  // ---------------------------------------------------------------- みんなの石碑（受け口）
  async function call(path, body) {
    try {
      const r = await fetch(API + path, body ? { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' } } : {});
      const j = await r.json();
      return j && typeof j === 'object' ? j : { err: 'server' };
    } catch (e) { return { err: 'net' }; }
  }
  let syncing = false;
  async function sync() {
    if (!L.join || syncing) return;
    syncing = true;
    for (const id of Object.keys(L.found)) {
      if (L.synced[id]) continue;
      const r = await call('/dig', { device: L.device, id });
      if (r.err) break;                         // 1日の上限・受け口の準備中・電波：次に開いた時にまた送る
      L.synced[id] = 1; save();
    }
    syncing = false;
  }
  function stoneBox() {
    const all36 = D.items.every((t) => L.found[t.id]);
    const sec = el('div', 'stone');
    sec.appendChild(el('b', null, 'みんなの石碑'));
    if (!L.join) {
      sec.appendChild(el('p', 'note', '全部の宝を見つけた人の名前が、みんなの石碑に刻まれます。参加すると、見つけた宝（端末の番号と宝の番号だけ）を受け口に記録します。1日に記録できる宝は20までです。'));
      const j = el('button', 'small', 'みんなの石碑に参加する'); j.type = 'button';
      j.addEventListener('click', () => { L.join = true; save(); sync(); themes(); });
      sec.appendChild(j);
    } else if (all36) {
      const inp = el('input'); inp.maxLength = 10; inp.placeholder = '石碑に刻む名前（10字まで）'; inp.value = L.name;
      const b = el('button', 'small', '石碑に名前を刻む'); b.type = 'button';
      const msg = el('p', 'note');
      b.addEventListener('click', async () => {
        L.name = inp.value.trim(); save(); await sync();
        const r = await call('/stone', { device: L.device, name: L.name });
        msg.textContent = r.err === 'notyet' ? `受け口の記録はまだ ${r.got} / ${r.all} です（1日20まで送ります。明日また押してください）` : r.err ? '石碑の受け口は準備中か、つながりませんでした。' : '石碑に刻みました。';
        if (!r.err) stoneList(sec);
      });
      sec.append(inp, b, msg);
    } else sec.appendChild(el('p', 'note', `参加しています。全部の宝（${D.items.length}）を見つけると、名前を刻めます。`));
    const v = el('button', 'small sub', '石碑を見る'); v.type = 'button'; v.addEventListener('click', () => stoneList(sec));
    sec.appendChild(v);
    box.appendChild(sec);
  }
  async function stoneList(sec) {
    const r = await call('/stones?d=' + L.device, null);
    const ol = el('ol', 'stones');
    if (r.err || !Array.isArray(r.stones)) ol.appendChild(el('li', null, '石碑の受け口は準備中です。'));
    else if (!r.stones.length) ol.appendChild(el('li', null, 'まだ誰の名前も刻まれていません。'));
    else for (const s of r.stones) { const d = new Date(s.t); ol.appendChild(el('li', s.me ? 'me' : null, `${s.name}（${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}）`)); }
    const old = sec.querySelector('ol.stones'); if (old) old.remove();
    sec.appendChild(ol);
  }

  // ---------------------------------------------------------------- 入口
  const go = $('#o-takara');
  if (go) go.addEventListener('click', () => { if (window.OPENING) OPENING.close(); M.view(Object.assign({}, M.HOME)); open(); });
  const ico = $('#takara-open');
  if (ico) ico.addEventListener('click', () => (box.classList.contains('open') ? close() : open()));
  if (L.hunt) data().then(chip).catch(() => {});
  if (L.join) setTimeout(sync, 4000);
  window.TAKARA = { open, close, get state() { return { found: Object.keys(L.found), hunt: L.hunt, join: L.join }; }, items: () => D && D.items, dir: (id) => dirText(byId(id)) };
})();
