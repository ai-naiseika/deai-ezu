// 案内：検索（地名・名物・品目）／品目の主な産地を光らせる／旬のカレンダー／県の紹介（カードの一覧と、浮いた県の上の印）。
// 地図そのものは map3d.js。ここは window.MAP3D の道具だけを使う。字は全部 textContent で入れる（データの字を HTML として読まない）
(function () {
  'use strict';
  const M = window.MAP3D, J = window.JAPAN, PL = window.PLACES || { rows: [], prefs: {} };
  const IN = window.INTRO || { items: [], crops: [] };
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const MARK = { '●': '公式・一次の資料で確認', '○': '掲載を確認（更新日の記載なし・二次の資料）', '▲': '念のため確認（資料で食い違い・年が古い）' };
  const safeUrl = (u) => /^https?:\/\//.test(u || '') ? u : null;
  const seasonOf = (m) => [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][m - 1];
  let P, byN;

  // 紹介の文と出どころは県ごとのファイル（紹介_県ごと/<県>.js。紹介を作る.py が分ける）。県を選んだ・県の中へ入った・札を開いた時に読み、
  // 台帳の同じ点（IN.items・spots・yama・mame）へ欄を足す。住所に台帳の版（?v=）を付け、古い県のファイルが残っていても混ざらないように
  const parts = new Map(), got = new Set();
  IN.got = (n, ver, d) => {
    if (ver !== IN.ver) return;
    got.add(n);
    for (const kind of Object.keys(d)) {
      const mine = (IN[kind] || []).filter((x) => x.pref === n);
      d[kind].forEach((h, i) => {
        const x = mine[i];
        if (!h || !x) return;
        if ((x.id || x.name) !== h.k) { console.warn('紹介の並びがずれています', kind, h.k); return; }
        delete h.k; Object.assign(x, h);
      });
    }
  };
  M.loadIntro = (n) => {
    if (!IN.ver) return Promise.resolve();
    if (!parts.has(n)) {
      const p = M.P.find((q) => q.n === n);
      parts.set(n, new Promise((ok, ng) => {
        const s = document.createElement('script');
        const fail = () => { parts.delete(n); s.remove(); ng(new Error(p.name + 'の紹介が読めません')); };
        s.src = `紹介_県ごと/${p.name}.js?v=${IN.ver}`; s.onerror = fail;
        s.onload = () => (got.has(n) ? ok() : fail());       // 読めても版が違えば（台帳と県のファイルの作り直しがずれた）使わない
        document.head.appendChild(s);
      }));
    }
    return parts.get(n);
  };

  M.on('ready', () => {
    P = M.P; byN = new Map(P.map((p) => [p.n, p]));
    buildIndex(); initSearch(); initCalendar();
    warmCard();
  });
  // スマホ：下の札の高さ（折り返して段の数が変わる）を CSS の --bar-h へ。札の窓などは、そのすぐ上から出す。
  // 測るのは大きさが変わった時だけ（ResizeObserver。毎コマ測ると組版をやり直す）
  if (window.ResizeObserver) new ResizeObserver(([e]) => {
    if (e.contentRect.height) document.documentElement.style.setProperty('--bar-h', Math.ceil(e.target.offsetHeight + 6) + 'px');
  }).observe($('#bar'));
  // 出典とご利用にあたって（中身は 公開の調べ.md の「そのまま使える出典の文」）：左下の一行のボタンで開く。
  // 閉じる・Esc・窓の外のどこを押しても閉じる（地図の空いた所は M.onDismiss が受けて、県は浮いたまま）
  const cred = $('#credits');
  const credOff = () => { if (!cred.classList.contains('open')) return false; cred.classList.remove('open'); return true; };
  $('#credits-open').addEventListener('click', (e) => { e.stopPropagation(); cred.classList.add('open'); });
  // スマホ：注は1行にたたんだまま、どこを押しても出典の窓を開く。注を広げる作りだと、広げた2行のまん中にボタンが来て、
  // たたもうと押した指で窓が開いた（2026-11-02 検査で）
  $('#note').addEventListener('click', () => cred.classList.add('open'));
  $('#credits-close').addEventListener('click', credOff);
  M.onDismiss(credOff);
  addEventListener('pointerdown', (e) => { if (cred.classList.contains('open') && !cred.contains(e.target) && !e.target.closest('#note') && e.target.id !== 'gl') credOff(); }, true);
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && credOff()) e.stopImmediatePropagation(); }, true);
  // スマホ：県の中にいる間は、県の札の窓を題とボタンだけにたたむ（窓が画面の下半分を覆い、真ん中に寄せた駅の札が窓の下に隠れた）。
  // 題を押すと開く・たたむ。大きさが変わったことを、札を並べる側（県の中.js の地名・吹き出し）に resize で知らせる
  const cardEl = $('#card');
  const mini = (on) => { if (cardEl.classList.contains('mini') !== on) { cardEl.classList.toggle('mini', on); dispatchEvent(new Event('resize')); } };
  M.on('world', (w) => mini(!!w && (M.phone() || document.body.classList.contains('wide'))));
  M.on('deselect', () => mini(false));
  $('#c-name').addEventListener('click', () => { if (M.phone()) mini(!cardEl.classList.contains('mini')); });
  // スマホ：下の並びの「たたむ」で、メニューをしまって地図を広く触れるように。右下の「メニュー」で戻す（しまう物は index.html の body.wide）。
  // 県の中では札の窓もたたんでしまい、印を押した時に開く。部品の場所が変わったことを、札・吹き出しを並べる側に resize で知らせる
  const wide = (on) => {
    document.body.classList.toggle('wide', on);
    if (on && M.inside) mini(true);
    dispatchEvent(new Event('resize'));
  };
  $('#wide-open').addEventListener('click', () => wide(true));
  $('#menu-open').addEventListener('click', () => wide(false));

  // ================================================================ 表記ゆれ（Skill search-yure の4段）
  function norm(s) {
    if (!s) return '';
    let r = String(s);
    r = r.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    r = r.replace(/　/g, ' ');
    r = r.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
    r = r.toLowerCase();
    return r.replace(/\s+/g, ' ').trim();
  }
  const R3 = { kya: 'キャ', kyu: 'キュ', kyo: 'キョ', sha: 'シャ', shu: 'シュ', sho: 'ショ', shi: 'シ', chi: 'チ', cha: 'チャ', chu: 'チュ', cho: 'チョ',
    tsu: 'ツ', nya: 'ニャ', nyu: 'ニュ', nyo: 'ニョ', hya: 'ヒャ', hyu: 'ヒュ', hyo: 'ヒョ', mya: 'ミャ', myu: 'ミュ', myo: 'ミョ', rya: 'リャ', ryu: 'リュ',
    ryo: 'リョ', gya: 'ギャ', gyu: 'ギュ', gyo: 'ギョ', jya: 'ジャ', jyu: 'ジュ', jyo: 'ジョ', bya: 'ビャ', byu: 'ビュ', byo: 'ビョ', pya: 'ピャ', pyu: 'ピュ', pyo: 'ピョ' };
  const R2 = { ka: 'カ', ki: 'キ', ku: 'ク', ke: 'ケ', ko: 'コ', sa: 'サ', si: 'シ', su: 'ス', se: 'セ', so: 'ソ', ta: 'タ', ti: 'チ', tu: 'ツ', te: 'テ', to: 'ト',
    na: 'ナ', ni: 'ニ', nu: 'ヌ', ne: 'ネ', no: 'ノ', ha: 'ハ', hi: 'ヒ', hu: 'フ', fu: 'フ', he: 'ヘ', ho: 'ホ', ma: 'マ', mi: 'ミ', mu: 'ム', me: 'メ', mo: 'モ',
    ya: 'ヤ', yu: 'ユ', yo: 'ヨ', ra: 'ラ', ri: 'リ', ru: 'ル', re: 'レ', ro: 'ロ', wa: 'ワ', wo: 'ヲ', ga: 'ガ', gi: 'ギ', gu: 'グ', ge: 'ゲ', go: 'ゴ',
    za: 'ザ', zi: 'ジ', ji: 'ジ', zu: 'ズ', ze: 'ゼ', zo: 'ゾ', da: 'ダ', di: 'ヂ', du: 'ヅ', de: 'デ', do: 'ド', ba: 'バ', bi: 'ビ', bu: 'ブ', be: 'ベ', bo: 'ボ',
    pa: 'パ', pi: 'ピ', pu: 'プ', pe: 'ペ', po: 'ポ', ja: 'ジャ', ju: 'ジュ', jo: 'ジョ', nn: 'ン' };
  const R1 = { a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ', n: 'ン', '-': 'ー' };
  function kana(s) {
    let out = '', i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === s[i + 1] && /[bcdfghjkmpqrstvwxyz]/.test(c)) { out += 'ッ'; i++; continue; }
      const t3 = R3[s.substr(i, 3)], t2 = R2[s.substr(i, 2)];
      if (t3) { out += t3; i += 3; } else if (t2) { out += t2; i += 2; } else { out += R1[c] || (c === ' ' ? '' : c); i++; }
    }
    return out;
  }
  const expand = (q) => /^[a-z\s-]+$/.test(q) ? [q, kana(q)] : [q];

  // ================================================================ 検索の札（起動時に1回だけ作る）
  const IDX = [];
  const TYPE = { crop: '品目の主な産地', pref: '都道府県', item: '名物・名所', spot: '目印', yama: '山と湖', city: '市区町村', mame: '豆知識' };
  function buildIndex() {
    for (const c of IN.crops) IDX.push({ type: 'crop', label: c.name, sub: '主な産地を光らせる', keys: [c.name, c.kana, ...(c.aliases || [])], c });
    for (const p of P) {
      const r = PL.prefs[p.n] || [M.FULL(p.name), '', ''];
      IDX.push({ type: 'pref', label: r[0], sub: '', keys: [r[0], p.name, r[1], r[2]], p });
    }
    for (const it of IN.items) {
      const p = byN.get(it.pref);
      IDX.push({ type: 'item', label: it.name, sub: (it.cat || '') + '・' + M.FULL(p.name), keys: [it.name, it.kana || '', ...(it.keys || [])], it, p });
    }
    // 目印・山と湖・豆知識も探せるように（本人 2026-10-31「黒部ダムって調べても出てこない」。前は品目・県・紹介・市区町村だけを拾っていた）
    for (const s of IN.spots || []) {
      const p = byN.get(s.pref);
      if (p) IDX.push({ type: 'spot', label: s.name, sub: M.FULL(p.name), keys: [s.name], s, p });
    }
    for (const y of IN.yama || []) {
      const p = byN.get(y.pref);
      if (p) IDX.push({ type: 'yama', label: y.name, sub: y.kind + '・' + M.FULL(p.name), keys: [y.name], s: y, p });
    }
    for (const m of IN.mame || []) {
      const p = byN.get(m.pref);
      if (p) IDX.push({ type: 'mame', label: m.title, sub: M.FULL(p.name), keys: [m.title], m, p });
    }
    for (const r of PL.rows) {
      const p = byN.get(r[4]);
      if (!p) continue;
      IDX.push({ type: 'city', label: r[0], sub: M.FULL(p.name) + (r[1] ? ' ' + r[1] : ''), keys: [r[0], r[1] + r[0], r[2], r[3]], r, p });
    }
    for (const e of IDX) e.k = e.keys.map(norm);
  }
  function search(q) {
    const qs = expand(norm(q)).filter(Boolean);
    if (!qs.length) return [];
    const hits = [];
    for (const e of IDX) {
      let best = 9;
      for (const s of qs) e.k.forEach((k, i) => {
        if (!k) return;
        const at = k.indexOf(s);
        if (at < 0) return;
        best = Math.min(best, (at === 0 ? 0 : 2) + (i === 0 ? 0 : 1));   // 名前の頭で当たるのを先に
      });
      if (best < 9) hits.push([best, e]);
    }
    // 種類ごとにまとめて出す。種類の並びは、その種類でいちばんよく当たった物の順（頭で当たる・短い名前ほど先）。
    // 「つまごい」で、紹介の「嬬恋高原キャベツ」より、地名の「嬬恋村」が先になる
    const cap = { crop: 3, pref: 5, item: 6, spot: 5, yama: 4, city: 8, mame: 4 }, tie = { crop: 0, pref: 1, item: 2, spot: 3, yama: 4, city: 5, mame: 6 }, best = {};
    const rank = ([s, e]) => s * 100 + e.label.length;
    for (const h of hits) best[h[1].type] = Math.min(best[h[1].type] ?? 1e9, rank(h));
    hits.sort((a, b) => best[a[1].type] - best[b[1].type] || tie[a[1].type] - tie[b[1].type] || rank(a) - rank(b));
    const n = {};
    return hits.filter(([, e]) => (n[e.type] = (n[e.type] || 0) + 1) <= cap[e.type]).map(([, e]) => e);
  }

  // ================================================================ 検索の窓
  let shown = [], cur = -1;
  function initSearch() {
    const q = $('#q'), box = $('#results');
    q.addEventListener('input', () => render(search(q.value)));
    q.addEventListener('focus', () => { if (q.value) render(search(q.value)); });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); move(e.key === 'ArrowDown' ? 1 : -1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown.length) choose(shown[Math.max(cur, 0)]); }
      else if (e.key === 'Escape') { close(); q.blur(); }
    });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#search')) box.classList.remove('open'); });
    function render(list) {
      shown = list; cur = list.length ? 0 : -1;
      box.textContent = '';
      if (!q.value.trim()) { box.classList.remove('open'); return; }
      box.classList.add('open');
      if (!list.length) { box.appendChild(el('div', 'none', '見つかりませんでした。ひらがな・ローマ字でも探せます')); return; }
      let last = '';
      list.forEach((e, i) => {
        if (e.type !== last) { box.appendChild(el('h4', null, TYPE[e.type])); last = e.type; }
        const d = el('div', 'r' + (i === cur ? ' on' : ''), e.label);
        if (e.sub) d.appendChild(el('small', null, e.sub));
        d.addEventListener('pointerdown', (ev) => { ev.preventDefault(); choose(e); });
        e.node = d; box.appendChild(d);
      });
    }
    function move(d) {
      if (!shown.length) return;
      shown[cur] && shown[cur].node.classList.remove('on');
      cur = (cur + d + shown.length) % shown.length;
      shown[cur].node.classList.add('on'); shown[cur].node.scrollIntoView({ block: 'nearest' });
    }
    function close() { box.classList.remove('open'); }
    function choose(e) {
      close(); q.blur(); clearAll();
      if (e.type === 'pref') M.select(e.p.k);
      else if (e.type === 'item') { M.select(e.p.k); openItem(e.it); }
      else if (e.type === 'city') showPlace(e);
      else if (e.type === 'spot' || e.type === 'yama') showAt(e.s.name, e.p, e.s.x, e.s.z, '');
      else if (e.type === 'mame') MAME.goTo(e.m.id);
      else if (e.type === 'crop') showCrop(e.c);
    }
  }

  // ================================================================ 地名：そこへ飛んで、印を立て、その県を光らせる
  let place = null;
  function showPlace(e) {
    const [name, gun, , , , x, z] = e.r;
    showAt(name, e.p, x, z, gun);
  }
  function showAt(name, p, x, z, gun) {
    place = { x, z, k: p.k, y: M.groundY(p.k, x, z) };
    $('#place span').textContent = `${name}（${M.FULL(p.name)}${gun ? ' ' + gun : ''}）`;
    M.highlight({ [p.k]: 0.6 });
    M.fly({ x, z, D: 700, ph: 0.8 });
  }

  // ================================================================ 品目：主な産地の上位5県を光らせ、順位の札と出典を出す
  let crop = null;
  function showCrop(c) {
    dispatchEvent(new CustomEvent('deai', { detail: { id: 'crop:' + c.name } }));     // であい帖へ
    crop = c;
    const top = c.top.map((t) => ({ ...t, p: byN.get(t.pref) })).filter((t) => t.p);
    const m = {}; top.forEach((t, i) => { m[t.p.k] = 1 - i * 0.12; });
    M.highlight(m); M.labels(false); M.fitPrefs(top.map((t) => t.p.k));
    const L = $('#legend'); L.textContent = '';
    L.appendChild(el('h3', null, c.name + 'の主な産地'));
    const ol = el('ol');
    for (const t of top) {
      const li = el('li', null, M.FULL(t.p.name));
      li.appendChild(el('span', null, (t.share != null ? Number(t.share).toFixed(1) + '%' : '') + (t.value != null ? `（${Number(t.value).toLocaleString()}${t.unit || ''}）` : '')));
      ol.appendChild(li);
    }
    L.appendChild(ol);
    const s = el('small', null, `${c.measure || ''}・${c.year}　出典：${c.survey} ${c.mark || ''}`);
    const u = safeUrl(c.url);
    if (u) { s.appendChild(document.createTextNode(' ')); const a = el('a', null, '表'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; s.appendChild(a); }
    L.appendChild(s);
    if (c.note) L.appendChild(el('small', null, '注：' + c.note));
    const b = el('button', null, '閉じる'); b.addEventListener('click', () => { clearAll(); backToCal(); }); L.appendChild(b);
    L.classList.add('open');
    const R = $('#ranks'); R.textContent = '';
    top.forEach((t, i) => { const d = el('div', null, `${i + 1}　${t.p.name}`); d.dataset.k = t.p.k; R.appendChild(d); });
  }
  function clearAll() {
    crop = null; place = null;
    M.highlight(null); M.labels(true);
    $('#legend').classList.remove('open'); $('#ranks').textContent = ''; $('#place').style.display = 'none';
  }
  M.on('select', () => { if (crop || place) clearAll(); });
  document.querySelector('#views [data-v="all"]').addEventListener('click', clearAll);
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || e.target.closest('input')) return;
    if ($('#cal').classList.contains('open')) { closeCal(); e.stopImmediatePropagation(); }
    else if (crop || place) { clearAll(); backToCal(); e.stopImmediatePropagation(); }
  }, true);

  // ================================================================ 県の紹介：カードの一覧・くわしく、浮いた県の上の印
  let pins = [], cardK = -1;
  // 紹介の一覧と印は、せり上がりが落ち着いてから作る（毎コマの 'frame' で見る）。押した瞬間に作ると、一覧の字の組版と札の大きさを測る組版で、
  // 初めて押した県のせり上がりのコマが止まった（2026-11-06 沖縄に紹介が入り、CPU4倍で 143ms と 150ms）。選び直し・下ろしで、前の県の物は作らない
  // 一覧は、せり上がりの4割で先頭4件・6割で8件・75%で全部・85%で下の欄（県のデータと印の説明）、と4回に分けて足す（初めて描く字の下ごしらえが1コマに集まらないように）。印は9割5分から
  // 印も1コマに4つずつ（札の字の幅の計算と組版が1コマに集まると、沖縄を押して 0.7 秒後のコマが CPU4倍で 69ms 止まった。2026-11-07）
  const PIN_STEP = 4;
  let pinsFor = -1, listStep = 0, pinTodo = [];
  M.on('select', (k) => {
    cardK = k; makePins(-1); pinsFor = k; listStep = 0;
    // スマホの札の窓は高さを決めてあるので（index.html の height: 42vh）、後から並べても吹き出しにかぶらない
    // （押した時に全部並べていた頃は、初めて押した県のコマが CPU4倍で 107〜128ms 止まった。2026-11-07）
    const box = $('#c-intro'); box.textContent = ''; box.appendChild(el('p', 'lead', '紹介を並べています…'));
    M.loadIntro(P[k].n).catch(() => {});   // 札を押す前に文を読んでおく
  });
  M.on('deselect', () => { cardK = -1; pinsFor = -1; makePins(-1); });
  // 札の窓の字の下ごしらえ：初めて押した県のコマだけ、字の組版が 2〜3倍重い（書体の準備。2県目からは CPU4倍で 61→38ms）。
  // 開いた後、手の空いた時に、隠れたままの札の窓と印で1回だけ同じ字の組み方を通しておく。誰かが県を押したら、そこでやめる
  function warmCard() {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200)), box = $('#c-intro'), name = $('#c-name');
    const steps = [
      () => { name.textContent = M.FULL(P[0].name); renderList(0, 4); },
      () => renderList(0, 999, true),
      () => listFoot(0),
      () => { pinCtx.font = pinM.font; for (const it of itemsOf(0)) { const d = el('div', 'pin'); d.append(el('b', null, it.name)); box.appendChild(d); pinCtx.measureText(it.name); } },
    ];
    const next = () => idle(() => {
      if (cardK >= 0 || M.sel >= 0) return;
      if (!steps.length) { box.textContent = ''; name.textContent = ''; return; }
      steps.shift()();
      void box.offsetHeight;
      next();
    });
    next();
  }
  // 県の中へ入った・出た：印の高さを、その地図の地面に合わせ直す
  M.on('world', (w) => {
    if (pinTodo.length) addPins(cardK, pinTodo.length);          // 並べ終わる前に入った時は、残りを先に
    for (const q of pins) {
      const im = q.el.querySelector('img[data-icon]');
      if (w && im && !im.src) im.src = MEIBUTSU.url(im.dataset.icon);
      q.y = M.groundY(cardK, q.it.x, q.it.z); q.h = q.el.offsetHeight; q.wFull = q.el.offsetWidth;   // 絵が入ると幅も変わる（測り直さないと印が11画素ずれた）
    }
  });
  // 見る情報（見る物.js）で絞った紹介だけ。絞りを変えたら、開いている県の一覧と印を作り直す
  const seen = (it) => !window.MIRU || MIRU.any(it.g);
  const itemsOf = (k) => IN.items.filter((it) => it.pref === P[k].n && seen(it));
  addEventListener('miru', () => { if (cardK >= 0) { renderList(cardK); makePins(cardK); } });
  // lim：先頭の何件だけ並べるか（せり上がりの間に分けて並べる時。県のデータと使い方の欄は、全部を並べる時だけ）
  // more：前に並べた一覧の続きだけを足す（毎回作り直すと同じ字の組版をくり返し、CPU4倍でせり上がりのコマが 55ms 止まった。2026-11-07）
  function renderList(k, lim, more) {
    const box = $('#c-intro'), ul0 = more && box.querySelector(':scope > ul');
    if (!ul0) box.textContent = '';
    const all_ = itemsOf(k), its = lim ? all_.slice(0, lim) : all_, all = IN.items.filter((it) => it.pref === P[k].n).length, cut = all > all_.length;
    const ken = M.FULL(M.P[k].name).slice(-1);     // 都・道・府・県（「この県の紹介」が北海道・東京でも県のままだった）
    if (!its.length) {
      box.textContent = '';
      box.appendChild(el('p', 'lead', cut ? `選んだ見る情報（${MIRU.label()}）に当たる紹介は、この${ken}にはありません。左上の「札」の窓で変えられます。` : `この${ken}の紹介は、これから載せます。`));
      if (!window.MIRU || MIRU.any(['kihon'])) { const s = spec(k); if (s) box.appendChild(s); }
      return;
    }
    if (!ul0) box.appendChild(el('p', 'lead', `この${ken}の紹介（${all_.length}件${cut ? '・見る情報：' + MIRU.label() : ''}）。押すと、くわしく読めます。地図の上の印も押せます。`));
    const ul = ul0 || el('ul');
    for (const it of its.slice(ul.children.length)) {
      const li = el('li');
      li.append(el('span', 'cat c-' + it.cat, it.cat), el('span', null, it.name), el('span', 'mark', it.mark || ''));
      li.addEventListener('click', () => openItem(it));
      ul.appendChild(li);
    }
    if (!ul0) box.appendChild(ul);
    if (!lim) listFoot(k);
  }
  function listFoot(k) {
    const box = $('#c-intro'), s = !window.MIRU || MIRU.any(['kihon']) ? spec(k) : null;
    if (s) box.appendChild(s);
    box.appendChild(how());
    const ask = el('p', 'ask book-only', '足跡のひとことや、この土地で載せてほしい話は、'), to = $('#ask-link').cloneNode(true);
    to.removeAttribute('id');
    ask.append(to, 'へどうぞ（工房主の気分次第ですが、できるだけお応えします）。');
    box.appendChild(ask);
  }
  // 県のデータ（本人 2026-10-27「広げないで見たい人だけ見る」）：たたんだ欄に、県庁所在地・人口・面積・人口密度・市町村の数と全国の順位、出典
  // 中身は開いた時に作る：県を押した時に作ると、数の書式（toLocaleString は呼ぶたびに書式を作る）で、
  // せり上がりのコマが CPU4倍で 67〜83ms 止まった（2026-10-27。開く人だけが見る欄なので、開くまで作らない）
  function spec(k) {
    const S = IN.spec, n = M.P[k].n, d = S && S.prefs.find((q) => q.pref === n);
    if (!d) return null;
    const det = el('details', 'spec'), ken = M.FULL(M.P[k].name).slice(-1);     // 都・道・府・県
    det.appendChild(el('summary', null, ken + 'のデータ'));
    det.addEventListener('toggle', () => { if (det.open && !det.querySelector('dl')) fillSpec(det, d, S, ken); });
    return det;
  }
  function fillSpec(det, d, S, ken) {
    const rank = (key) => 1 + S.prefs.filter((q) => q[key] > d[key]).length;
    const sen = S.sources.population.unit === '千人', people = sen ? d.population * 1000 : d.population;
    const man = (v) => (v >= 1e4 ? Math.floor(v / 1e4).toLocaleString() + '万' + (v % 1e4 >= 1000 ? Math.floor(v % 1e4 / 1000) + '千' : '') : v.toLocaleString());
    const dl = el('dl');
    const row = (t, v) => dl.append(el('dt', null, t), el('dd', null, v));
    row(ken + '庁所在地', d.capital);
    row('人口', `${sen ? '約' + man(people) : people.toLocaleString()}人（全国${rank('population')}位）`);
    row('面積', `${d.area.toLocaleString(undefined, { maximumFractionDigits: 2 })} km²（全国${rank('area')}位）`);
    row('人口密度', `${d.density.toLocaleString(undefined, { maximumFractionDigits: 1 })} 人/km²（全国${rank('density')}位）`);
    row('市町村', `${d.cities}市・${d.towns}町・${d.villages}村`);
    det.appendChild(dl);
    if (d.note) det.appendChild(el('p', 'note', d.note));
    const src = el('p', 'src');
    src.appendChild(document.createTextNode('出典：'));
    [['人口', S.sources.population], ['面積', S.sources.area], ['市町村', S.sources.municipalities]].forEach(([t, s], i) => {
      const u = safeUrl(s.url), a = el(u ? 'a' : 'span', null, `${s.title}（${s.date}）`);
      if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      if (i) src.appendChild(document.createTextNode('／'));
      src.appendChild(a);
    });
    det.appendChild(src);
  }
  // 日本のデータ（本人 2026-11-01「人口や面積などの国のデータは全国は全国で出てもいい」）：全国の眺めで人口のボタンを押すと開く。
  // 県のデータと同じ台帳（県のデータ.json の全国の値と47都道府県）。中身は初めて開いた時に作る
  const natBox = el('div');
  natBox.id = 'natdata'; natBox.setAttribute('role', 'dialog'); natBox.setAttribute('aria-label', '日本のデータ');
  document.body.appendChild(natBox);
  function fillNat() {
    const S = IN.spec, N = S && S.nation;
    if (!N) { natBox.appendChild(el('p', null, '日本のデータを読めませんでした。')); return; }
    const oku = (v) => (v >= 1e8 ? Math.floor(v / 1e8) + '億' : '') + (Math.floor(v % 1e8 / 1e4) ? Math.floor(v % 1e8 / 1e4) + '万' : '') + (v % 1e4 ? v % 1e4 : '');
    const dl = el('dl'), row = (t, v) => dl.append(el('dt', null, t), el('dd', null, v));
    const top = (key) => S.prefs.slice().sort((a, b) => b[key] - a[key]).slice(0, 3).map((q) => M.FULL(P.find((p) => p.n === q.pref).name)).join('・');
    row('人口', oku(N.population) + '人');
    row('面積', `${N.area.toLocaleString(undefined, { maximumFractionDigits: 2 })} km²`);
    row('人口密度', `${N.density.toLocaleString(undefined, { maximumFractionDigits: 1 })} 人/km²`);
    row('都道府県', '47');
    row('市町村', `${(N.cities + N.towns + N.villages).toLocaleString()}（${N.cities}市・${N.towns}町・${N.villages}村）`);
    row('人口の多い順', top('population'));
    row('人口密度の高い順', top('density'));
    row('面積の広い順', top('area'));
    natBox.append(el('h3', null, '日本のデータ'), dl, el('small', null, '人口密度は、北方地域と竹島を除いた面積で割っています。都道府県を押すと、その県のデータも見られます。'));
    const src = el('small');
    src.appendChild(document.createTextNode('出典：'));
    [S.sources.population, S.sources.area, S.sources.municipalities].forEach((s, i) => {
      const u = safeUrl(s.url), a = el(u ? 'a' : 'span', null, `${s.title}（${s.date}）`);
      if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      if (i) src.appendChild(document.createTextNode('／'));
      src.appendChild(a);
    });
    const b = el('button', null, '閉じる');
    b.addEventListener('click', () => setNat(false));
    natBox.append(src, b);
  }
  function setNat(on) {
    if (on && !natBox.childNodes.length) fillNat();
    natBox.classList.toggle('open', on);
    const btn = $('#pop-open');
    if (btn && (!on || !M.inside)) btn.classList.toggle('on', on);
  }
  // ボタンの名前は、全国の眺めでは「日本のデータ」（県の中では 県の中.js が「人口を表示」にする。その後に書くので一拍おく）
  const natLabel = () => {
    const b = $('#pop-open');
    if (b) b.querySelector('.lab').textContent = b.dataset.tip = !M.inside ? '日本のデータ' : window.POPMODE && POPMODE.on ? '人口の表示を消す' : '人口を表示';
  };
  natLabel();
  M.on('select', () => setNat(false));
  M.on('world', () => { setNat(false); setTimeout(natLabel, 0); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && natBox.classList.contains('open')) { setNat(false); e.stopImmediatePropagation(); } }, true);
  window.NATDATA = { toggle: () => setNat(!natBox.classList.contains('open')), get open() { return natBox.classList.contains('open'); } };
  function how() {
    const d = el('div', 'how');
    d.textContent = Object.entries(MARK).map(([k, v]) => `${k} ${v}`).join('　') + (IN.updated ? `　（${IN.updated} 時点）` : '');
    return d;
  }
  M.openItem = (it, show) => { if (cardK >= 0) openItem(it, show); };       // 遊覧から、着いた名所のくわしい説明を札の窓に出す（show＝遊覧中でも窓を開く）
  // 遊覧の行き先の印は、灯りの外でも名前の札を出す（本人 2026-10-30「マウスを重ねなくてもその場所のカード表示していい。観光してるのだし」）
  M.tourPin = (it) => { for (const q of pins) { q.tour = q.it === it; q.el.classList.toggle('tour', q.tour); } };
  M.MARK = MARK; M.safeUrl = safeUrl;                            // 全国の遊覧の札も、同じ印と同じ確かめ方で
  function openItem(it, show) {
    dispatchEvent(new CustomEvent('deai', { detail: { id: 'item:' + it.pref + it.name, pref: it.pref } }));     // であい帖へ
    // スマホの県の中では札の窓をたたんでいるので、開いて説明を見せる（たたんだままだと、印を押しても何も出なかった）。
    // 遊覧中も「くわしく」から来た時は開く（本人 2026-11-11「遊覧中に詳しくを押しても出典へのリンクなどが出ない」＝たたんだ窓に書いていた）
    if (show || !document.body.classList.contains('touring')) mini(false);
    const box = $('#c-intro'); box.textContent = '';
    const back = el('button', null, '‹ 一覧へ'); back.addEventListener('click', () => renderList(cardK)); box.appendChild(back);
    const d = el('div', 'detail');
    const h = el('h3'); h.append(el('span', 'cat c-' + it.cat, it.cat), document.createTextNode(' ' + it.name)); d.appendChild(h);
    for (const t of it.text || []) d.appendChild(el('p', null, t));
    if (!it.text) {                                              // 文がまだ届いていない（県ごとのファイル）。届いたら、同じ札が開いたままなら描き直す
      const w = el('p', 'when', '説明を読み込んでいます…'); d.appendChild(w);
      M.loadIntro(it.pref).then(() => { if (d.isConnected) openItem(it); }, () => { w.textContent = '説明を読めませんでした（通信を確かめてください）'; });
    }
    if (it.when) d.appendChild(el('p', 'when', it.when));
    // 旬の札（であい帖）：旬の月がある紹介に、いつ読むと札になるか・もう手に入れたか（読んだ知らせは上で先に届いている）
    const sh = window.DEAI && DEAI.shunHint ? DEAI.shunHint(it) : '';
    if (sh) d.appendChild(el('p', 'when shun-hint', sh));
    if (it.mark) d.appendChild(el('p', 'when', `${it.mark} ${MARK[it.mark] || ''}`));
    const ol = el('ol');
    for (const s of it.sources || []) {
      const li = el('li'), u = safeUrl(s.url);
      if (u) { const a = el('a', null, s.title || u); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); }
      else li.textContent = s.title || '';
      ol.appendChild(li);
    }
    if (ol.childNodes.length) { d.appendChild(el('p', 'when', '出どころ')); d.appendChild(ol); }
    box.appendChild(d);
    pins.forEach((q) => q.el.classList.toggle('on', q.it === it));
  }
  // 印の札の大きさ：開いた時に見本の札を1回だけ測り、名前の幅は字の幅の計算（measureText）で出す。県を押してから
  // offsetWidth で測ると、直前に並べた一覧ごとページの組版がその場で走り、初めて押した県のコマが CPU4倍で 117ms 止まった（2026-11-06 沖縄）
  const pinCtx = document.createElement('canvas').getContext('2d');
  let pinM = null;
  function measurePin() {
    const d = el('div', 'pin'), b = el('b', null, 'あ');
    // 測るのは body の直下で（#pins は入口の間 display: none。開いた後に読むようになって、ここで測ると高さと幅が 0 になり、印が札の分だけずれた。2026-11-07）
    d.append(b, el('i'), el('u')); d.style.visibility = 'hidden'; document.body.appendChild(d);
    pinCtx.font = getComputedStyle(b).font;
    pinM = { h: d.offsetHeight, pad: b.offsetWidth - pinCtx.measureText('あ').width, font: pinCtx.font };
    d.remove();
  }
  measurePin();
  if (document.fonts) document.fonts.ready.then(measurePin);
  function makePins(k) {
    $('#pins').textContent = ''; pins = []; pinTodo = k < 0 ? [] : itemsOf(k);
    addPins(k, pinTodo.length);
  }
  function addPins(k, n) {
    const box = $('#pins'), made = pins.length;
    for (const it of pinTodo.splice(0, n)) {
      // 印の札は名前だけ。色で作物（山吹）か名所（朱）かが分かる（画風見本の鳥瞰図と同じ流儀）
      const d = el('div', 'pin' + (it.cat === '特産' || it.cat === '食' ? ' crop' : '')), lab = el('b', null, it.name);
      // 県の中では、札と点のあいだに名物の絵（名物の絵.js）。絵は県の中へ入った時に入れる
      // （県を押した時に10枚を描いて画像にすると、せり上がりのコマが67ms止まった）
      if (it.icon && window.MEIBUTSU) { const im = el('img'); im.alt = ''; im.dataset.icon = it.icon; d.append(lab, im, el('i'), el('u')); }
      else d.append(lab, el('i'), el('u'));
      // もう一度押すと、くわしい説明から一覧に戻る
      d.addEventListener('click', () => { if (d.classList.contains('on')) { pins.forEach((q) => q.el.classList.remove('on')); renderList(cardK); } else openItem(it); });
      box.appendChild(d);
      pins.push({ it, el: d, y: M.groundY(k, it.x, it.z), theme: it.cat === '特産' || it.cat === '食' ? '食' : '名所' });
    }
    // 大きさ（名前あり・種類の札だけ・高さ）は、全部並べた後に1回で測って覚える。毎コマ位置を書いた直後に読むと、
    // そのたびに組版をやり直した（群馬を押した時、1コマが50msに）
    pinCtx.font = pinM.font;
    for (const q of pins.slice(made)) {
      q.wFull = Math.ceil(pinCtx.measureText(q.it.name).width + pinM.pad); q.h = pinM.h;
      q.wTag = 12;
      q.named = true;
    }
    unread();
  }
  // 遠めがね（であい帖の道具）：まだ読んでいない紹介の印を金色に。読んだ時（'deai' の知らせ）と、道具を出し入れした時に塗り直す
  function unread() {
    const on = !!(window.DEAI_TOOL && DEAI_TOOL.megane && window.DEAI);
    for (const q of pins) q.el.classList.toggle('unread', on && !DEAI.knows('item:' + q.it.pref + q.it.name));
  }
  addEventListener('deai-tool', unread);
  addEventListener('deai', () => setTimeout(unread, 0));

  // ================================================================ 毎コマ：印・順位の札・地名の印を、地図に合わせて動かす
  M.on('frame', () => {
    // 落ち着く前に並べ終える（落ち着いた時だと、尖閣・竹島の吹き出しを初めて描いて置くコマと重なり、CPU4倍で 117ms になった）
    if (pinsFor >= 0 && pinsFor === cardK) {
      // 一覧の全部と地図の印は別のコマで（同じコマで作ると、CPU4倍で押して 0.64 秒後のコマが 50ms 止まった。2026-11-06）
      const f = M.inside ? 1 : M.lift(cardK) / M.LIFT;
      const want = f >= 0.95 ? 5 : f >= 0.85 ? 4 : f >= 0.75 ? 3 : f >= 0.6 ? 2 : f >= 0.4 ? 1 : 0;
      if (listStep === 5) {
        addPins(cardK, PIN_STEP);
        if (!pinTodo.length) pinsFor = -1;
      } else if (want > listStep) {
        const step = listStep + 1, reading = $('#c-intro .detail');          // 並べている途中に紹介を押して、くわしい説明を読んでいる時は、一覧に戻さない
        if (step === 5) pinTodo = itemsOf(cardK);
        else if (!reading) {
          if (step === 4) { if ($('#c-intro > ul')) listFoot(cardK); }
          else renderList(cardK, step === 3 ? 999 : step * 4, true);
        }
        listStep = step;
      }
    }
    // 開いている物を先に置き、札どうしが重なったら、あとの印は種類の札だけにする
    const top = (q) => q.tour || q.el.classList.contains('on');
    // marks＝いま見えている部分（名前を隠した印は、種類の札と軸と点だけ）。「〇〇の中へ」の吹き出しは、取り置き（whole）に空きが無い時だけこちらを避ける。
    // 吹き出し（M.bubRect）の下の印は名前を出さない（iPhone SE の 375×667 で、札の窓の上の空きが取り置きで埋まり、吹き出しが札にかかった 2026-11-07）
    const put = [], whole = [], marks = [], bubR = M.bubRect, order = pins.slice().sort((a, b) => top(b) - top(a));
    for (const q of order) {
      const s = M.project(q.it.x, q.y + M.liftY(cardK) + 0.4, q.it.z), h = q.h;
      q.el.style.display = s.ok ? 'flex' : 'none';
      const box = (w) => [s.x - w / 2, s.y - h, s.x + w / 2, s.y - h + 18];
      let w = q.wFull, r = box(w);
      // 札.js：名前の札は、そのテーマを出している時か、灯り（マウスの周り）の中だけ。開いている物はいつも
      const lit = top(q) || !window.FUDA ? 1 : FUDA.show(q.theme, s.x, s.y - h + 9);
      const named = lit > 0.05 && !put.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])
        && !(bubR && !top(q) && r[0] < bubR[2] && r[2] > bubR[0] && r[1] < bubR[3] && r[3] > bubR[1]);
      if (!named) { w = q.wTag; r = box(w); }
      // 重なった札は隠して、軸と地点の点だけ残す（隠しても高さは変えない＝点の位置がずれない）
      if (named !== q.named) { q.el.firstChild.style.visibility = named ? '' : 'hidden'; q.named = named; }
      if (named) { const o = lit.toFixed(2); if (o !== q.op) { q.el.firstChild.style.opacity = o; q.op = o; } }
      put.push(r);
      if (s.ok) whole.push([s.x - Math.max(q.wFull, 60) / 2, s.y - h, s.x + Math.max(q.wFull, 60) / 2, s.y + 4]);   // 札を隠した印も、札の場所は空けておく
      if (s.ok) marks.push(named ? r : [s.x - 8, s.y - h, s.x + 8, s.y + 4]);
      q.el.style.transform = `translate(${(s.x - q.wFull / 2).toFixed(1)}px, ${(s.y - h + 4).toFixed(1)}px)`;
    }
    M.pinRects = whole;               // 県の中の地名の札が、印（札・絵・点のまるごと）を避けるため
    M.pinMarks = marks;
    for (const d of $('#ranks').children) {
      const p = P[+d.dataset.k], s = M.project(p.ax, p.ay + 2, p.az);
      d.style.display = s.ok ? '' : 'none';
      d.style.transform = `translate(${(s.x - d.offsetWidth / 2).toFixed(1)}px, ${(s.y - 30).toFixed(1)}px)`;
    }
    if (place) {
      const s = M.project(place.x, place.y + M.liftY(place.k) + 0.3, place.z), pl = $('#place');
      pl.style.display = s.ok ? 'block' : 'none';
      pl.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    }
  });

  // ================================================================ 旬のカレンダー（主役）＋小さな日本地図（押すと3Dのその県へ）
  let month = new Date().getMonth() + 1, rows = [], hot = null;
  // カレンダーから地図へ出た時の、月・行の並びの位置・押した行。もどった時（県を下ろす・産地の札を閉じる）に、元のカレンダーへ
  let fromCal = null;
  function leaveCal(r) {
    const list = document.querySelector('#cal .rows');
    fromCal = { month, scroll: list ? list.scrollTop : 0, row: r ? r.name : null };
    closeCal();
  }
  function backToCal() {
    if (!fromCal) return false;
    const s = fromCal; fromCal = null; month = s.month;
    openCal(s);
    return true;
  }
  M.on('deselect', () => { if (!M.inside) backToCal(); });
  // 「全体」で下ろした時は、カレンダーへもどさない（先に覚えを消す）
  document.querySelector('#views [data-v="all"]').addEventListener('click', () => { fromCal = null; }, true);
  function initCalendar() {
    $('#cal-open').addEventListener('click', openCal);
    // 行：品目は旬の区分ごと（キャベツの春・夏秋・冬など）、紹介は月のある物
    for (const c of IN.crops) for (const s of c.season || []) {
      if (s.months.length >= 12) continue;                         // 通年の物はカレンダーに並べない（検索では出る）
      const ks = (s.prefs && s.prefs.length ? s.prefs : c.top.map((t) => t.pref)).map((n) => byN.get(n)).filter(Boolean).map((p) => p.k);
      rows.push({ name: c.name + (s.label ? '（' + s.label + '）' : ''), sub: '', months: s.months, ks, crop: c });
    }
    for (const it of IN.items) if (it.months && it.months.length) {
      const p = byN.get(it.pref);
      rows.push({ name: it.name, sub: p.name, months: it.months, ks: [p.k], it });
    }
  }
  // 小さな日本地図の道の字（カレンダーとであい帖で使う。1回だけ作る）
  let miniMapData = null;
  M.miniMap = () => {
    if (!miniMapData) {
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const p of J.prefs) for (const r of p.ring) for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); }
      const b = [x0 - 20, z0 - 20, x1 - x0 + 40, z1 - z0 + 40];
      miniMapData = { b, box: b.join(' '), d: J.prefs.map((jp) => jp.ring.map((r) => 'M' + r.join(' ').replace(/(\S+ \S+) /g, '$1L') + 'Z').join('')) };
    }
    return miniMapData;
  };
  // 月の12升は、1本の帯に色を塗る（行ごとに12個の部品を置くと、191行で組版だけでスマホが 0.5 秒止まった。2026-11-07）。列は上の「〇月」のボタンの升目とそろえる（升の間 2px）。
  // 緑＝旬・オレンジ＝選んだ月が旬。選んだ月の列は淡い背景だけ（空の枠を引くと「何か入る欄」に読まれた。本人「空欄のオレンジ枠はどんな意味？」2026-10-27）
  const barCache = new Map();
  function monthBar(r) {
    const key = r.months.join() + '/' + month;
    if (barCache.has(key)) return barCache.get(key);
    const at = (n, gaps) => `calc((100% - 22px) / 12 * ${n} + ${gaps * 2}px)`, s = [];
    for (let m = 1; m <= 12; m++) {
      const on = r.months.includes(m), now = m === month;
      s.push(`${on && now ? '#e0952a' : on ? '#9ac35a' : now ? '#f8ecd0' : 'transparent'} ${at(m - 1, m - 1)} ${at(m, m - 1)}`, `transparent ${at(m, m - 1)} ${at(m, m)}`);
    }
    const v = `linear-gradient(90deg,${s.join(',')})`;
    barCache.set(key, v);
    return v;
  }
  function openCal(restore) {
    if (restore instanceof Event) restore = null;
    const C = $('#cal'); C.textContent = '';
    const main = el('div', 'main'), side = el('div', 'side');
    main.appendChild(el('h2', null, '旬のカレンダー'));
    main.appendChild(el('p', 'lead', '緑は、旬や主な出回りの月（収穫・出荷の月、市場によく出回る月）。オレンジは、選んだ月が旬のもの。行を押すと、その産地が地図で光ります。'));
    const head = el('div', 'months'); head.appendChild(el('span', null, ''));
    const mb = [];
    for (let m = 1; m <= 12; m++) {
      const b = el('button', m === month ? 'on' : '', m + '月');
      b.addEventListener('click', () => { month = m; mb.forEach((x, i) => x.classList.toggle('on', i + 1 === m)); fill(); });
      mb.push(b); head.appendChild(b);
    }
    main.appendChild(head);
    const list = el('div', 'rows'); main.appendChild(list);
    // 小さな日本地図：県の輪を SVG の道に（北が上）
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const paths = new Map(), calMap = M.miniMap();
    svg.setAttribute('viewBox', calMap.box);
    J.prefs.forEach((jp, idx) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', calMap.d[idx]);
      const k = P.find((p) => p.n === jp.n).k;
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'title'); t.textContent = M.FULL(jp.name); path.appendChild(t);
      path.addEventListener('click', () => { leaveCal(null); M.season(seasonOf(month)); M.select(k); });
      svg.appendChild(path); paths.set(k, path);
    });
    side.appendChild(svg);
    const note = el('p'); side.appendChild(note);
    // 白い県を「名産の無い県」と読まれないように（本人「白い県は、いずれの作物も5位以内に入っていないという意味？」2026-10-27）
    side.appendChild(el('small', null, '緑は、選んだ月が旬の品目の主な産地（ふつうは上位5県）。白い県は、いま載せている品目の主な産地に入っていないだけで、名産が無いわけではありません。県を押すと、3Dの地図でその県へ。旬の月と産地の出どころは、品目ごとに検索の札に出します。'));
    const x = el('button', 'close', '閉じる（Esc）'); x.addEventListener('click', closeCal);
    C.append(main, side, x);
    C.classList.add('open');
    function fill() {
      list.textContent = '';
      const inNow = (r) => r.months.includes(month);
      const sorted = rows.slice().sort((a, b) => inNow(b) - inNow(a));
      const frag = document.createDocumentFragment();
      for (const r of sorted) {
        const row = el('div', 'row');
        const nm = el('span', 'nm', r.name); if (r.sub) nm.appendChild(el('small', null, r.sub)); row.appendChild(nm);
        const bar = el('i'); bar.style.background = monthBar(r); row.appendChild(bar);
        row.addEventListener('pointerenter', () => { hot = r; paint(); });
        row.addEventListener('pointerleave', () => { hot = null; paint(); });
        row.addEventListener('click', () => { if (r.it) { leaveCal(r); M.select(r.ks[0]); openItem(r.it); } else if (r.crop) { leaveCal(r); clearAll(); showCrop(r.crop); } });
        if (restore && restore.row === r.name) { row.classList.add('on'); hot = r; }
        frag.appendChild(row);
      }
      list.appendChild(frag);
      paint();
      const names = [...new Set(rows.filter(inNow).map((r) => r.crop ? r.crop.name : r.name))];
      note.textContent = names.length ? `${month}月の旬：${names.join('、')}` : `${month}月の旬は、まだ載せていません`;
    }
    function paint() {
      const on = new Set(rows.filter((r) => r.months.includes(month)).flatMap((r) => r.ks));
      for (const [k, path] of paths) {
        path.classList.toggle('in', on.has(k));
        path.classList.toggle('hot', !!hot && hot.ks.includes(k));
      }
    }
    fill();
    if (restore) list.scrollTop = restore.scroll;
  }
  function closeCal() { $('#cal').classList.remove('open'); hot = null; }
})();
