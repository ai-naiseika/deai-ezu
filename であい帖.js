// であい帖（本人 2026-11-07「自分が成長するのが見える」「達成感」「推奨案で作り始めて」。案の全文は ゲームの案.md）：絵図そのものを、自分の日本が育っていく旅の記録にする。
// 段1＝旅人の位・県の4段と朱印・今日の便り・わたしの日本・名誉県民証・旅の手形。
// 知った物は、案内.js（紹介）・一言.js（一言）・豆知識.js（豆知識）・クイズ.js（答えの説明）が 'deai' の知らせで届ける。
// 記録はこの端末の中だけ（localStorage・どこにも送らない）。字は全部 textContent で入れる。手形は外から来る字なので、形と台帳を確かめてから足す
(function () {
  'use strict';
  const M = window.MAP3D, IN = window.INTRO, J = window.JAPAN;
  if (!M || !IN) return;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const KEY = 'zenkoku3d-deai-v1', MAME_KEY = 'zenkoku3d-mame-v1', QUIZ_KEY = 'zenkoku3d-quiz-v1';
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const jpDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${y}年${m}月${d}日`; };
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const itemId = (it) => 'item:' + it.pref + it.name;
  const hasMame = (id) => !!(window.MAME && MAME.has(id));

  // 位：知った数で上がる（最初の位は数分で、頂上は毎日10件で約5か月）
  const RANKS = [[0, '旅立ち', ''], [10, '宿場通', '宿場のうわさ話が、耳に入るようになりました'], [50, '街道通', '街道の旅人に、道を聞かれるようになりました'],
    [150, '国通', 'お国じまんを、3つは語れるようになりました'], [400, '諸国通', '諸国の話で、ひと晩語り明かせるようになりました'],
    [800, '語り部', 'あなたの話を聞きに、人が集まりはじめました'], [1500, '絵図の主', 'この絵図のことなら、あなたに聞けばわかります']];
  const rankOf = (t) => { let r = 0; RANKS.forEach((x, i) => { if (t >= x[0]) r = i; }); return r; };
  // 県の4段の「通」の呼び名（昔の国名など。県の一部の名を県全体に当てると落ち着かない所は県の名のまま）
  const OLD = { 青森: '陸奥', 岩手: '南部', 宮城: '仙台', 秋田: '羽後', 山形: '羽前', 茨城: '常陸', 栃木: '下野', 群馬: '上州', 埼玉: '武州', 千葉: '房総', 東京: '江戸', 神奈川: '相模',
    新潟: '越後', 富山: '越中', 石川: '加賀', 福井: '越前', 山梨: '甲斐', 長野: '信州', 岐阜: '美濃', 静岡: '駿河', 愛知: '尾張', 三重: '伊勢', 滋賀: '近江', 京都: '京', 大阪: '浪速',
    奈良: '大和', 和歌山: '紀州', 鳥取: '因幡', 島根: '出雲', 岡山: '備前', 広島: '安芸', 山口: '長州', 徳島: '阿波', 香川: '讃岐', 愛媛: '伊予', 高知: '土佐', 福岡: '筑前', 佐賀: '肥前',
    熊本: '肥後', 大分: '豊後', 宮崎: '日向', 鹿児島: '薩摩', 沖縄: '琉球' };
  const prefOf = (n) => M.P.find((p) => p.n === n);
  const meiyo = (p) => `名誉${M.FULL(p.name).slice(-1)}民`;      // 名誉県民・名誉都民・名誉道民・名誉府民
  const stageName = (p, s) => [ '', '知人', '常連', (OLD[p.name] || p.name) + '通', meiyo(p)][s];
  const stageLine = (p, s) => ['', `${p.name}と顔見知りになりました`, `${p.name}の人に「また来たの」と言われる頃です`, `${p.name}の人にも話せる話が増えました`, `もう${p.name}の人より詳しいかもしれません`][s];
  // 県の4段：紹介と豆知識だけで数える（どちらも必ず見つけられる。札の一言は寄らないと出ない物があるので、位にだけ数える）
  const stageOf = ([k, D]) => (D && k >= D ? 4 : k >= Math.ceil(D / 2) ? 3 : k >= Math.ceil(D / 4) ? 2 : k >= 3 ? 1 : 0);
  const countOf = (n) => {
    let k = 0, D = 0;
    for (const it of IN.items) if (it.pref === n) { D++; if (known.has(itemId(it))) k++; }
    for (const d of IN.mame || []) if (d.pref === n) { D++; if (hasMame(d.id)) k++; }
    return [k, D];
  };

  // ---------------------------------------------------------------- 記録
  const LEDGER = new Set();
  for (const it of IN.items) LEDGER.add(itemId(it));
  for (const s of IN.spots || []) if (s.mark) LEDGER.add('spot:' + s.name);
  for (const y of IN.yama || []) LEDGER.add('yama:' + y.pref + y.name);
  for (const c of IN.crops || []) LEDGER.add('crop:' + c.name);
  for (const t of IN.tour || []) LEDGER.add('tour:' + t.pref);
  for (let n = 1; n <= 47; n++) LEDGER.add('visit:' + n);
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  // 形を確かめる（手形は外から来る字で、localStorage も壊れることがある）。台帳に無い物・形の違う物は捨てる
  function clean(v) {
    const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {}, stage = {};
    if (o.stage && typeof o.stage === 'object') for (let n = 1; n <= 47; n++) {
      const st = o.stage[n];
      if (!st || typeof st !== 'object') continue;
      for (let s = 1; s <= 4; s++) if (isDate(st[s])) (stage[n] = stage[n] || {})[s] = st[s];
    }
    const num = (x) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
    const L = o.letter;
    const letter = L && isDate(L.d) && typeof L.id === 'string' && LEDGER.has(L.id) && Array.isArray(L.done) ? { d: L.d, id: L.id, done: [!!L.done[0], !!L.done[1], !!L.done[2]], full: !!L.full } : null;
    return { name: typeof o.name === 'string' ? o.name.slice(0, 16) : '', known: Array.isArray(o.known) ? o.known.filter((s) => typeof s === 'string' && LEDGER.has(s)) : [],
      stage, rank: Math.min(num(o.rank), RANKS.length - 1), days: Array.isArray(o.days) ? [...new Set(o.days.filter(isDate))].slice(-3000) : [], letters: num(o.letters), passAt: num(o.passAt), letter };
  }
  let canKeep = true;
  const readJson = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { if (!(e instanceof SyntaxError)) canKeep = false; return null; } };
  const S = clean(readJson(KEY));
  const known = new Set(S.known);
  function save() {
    S.known = [...known];
    try { localStorage.setItem(KEY, JSON.stringify(S)); canKeep = true; } catch (e) { canKeep = false; }
  }
  const total = () => known.size + (window.MAME ? MAME.count()[0] : 0);
  const stageNow = (n) => { const st = S.stage[n]; return st ? Math.max(...Object.keys(st).map(Number)) : 0; };

  // ---------------------------------------------------------------- 県ごとの朱印（朱印の絵.js。骨/朱印を作る.py が作る。自前のファイルなので innerHTML で入れる）。
  // 最初に何かを知った時か、窓を開いた時に読む（読むのは圧縮 150KB。であい帖を使わない人には読ませない）
  let shuin = null, uid = 0;
  function loadShuin() {
    if (!shuin) shuin = new Promise((ok, ng) => {
      const s = document.createElement('script');
      s.src = '朱印の絵.js'; s.onload = ok;
      s.onerror = () => { shuin = null; s.remove(); ng(new Error('朱印の絵が読めません')); };
      document.head.appendChild(s);
    });
    return shuin;
  }
  function artOf(n, s) {
    const e = window.SHUIN && SHUIN[n];
    if (!e) return null;
    uid++;      // 絵の中の id を重ねない（同じ印が朱印帳と知らせに同時に出る。隠れた窓の中の id を指すと、絵が欠ける）
    return e.s[s].replace(/d="@(\d+)"/g, (m, i) => `d="${e.d[+i]}"`).replace(/Z_/g, `z${uid}_`);
  }
  function prefMark(p, s, big) {
    const svg = artOf(p.n, s);
    if (!svg) return seal(p.name, s, p.n);          // 読めない間は丸い印で
    const d = el('span', big ? 'art big' : 'art');
    d.innerHTML = svg;
    return d;
  }
  // ---------------------------------------------------------------- 字の入った丸い印（位・便り。県の絵が読めない時も）。絵は CSS だけ
  function seal(text, s, n) {
    const d = el('span', 'seal s' + s, text);
    d.style.setProperty('--r', ((hash(String(n || text)) % 15) - 7) + 'deg');     // 押した向きを少しずつ変える
    return d;
  }

  // ---------------------------------------------------------------- 上がった時の知らせ（押した朱印）。重なったら順に
  const cheerBox = $('#deai-cheer'), cheers = [];
  let cheering = false;
  function cheer(mark, title, line) { cheers.push([mark, title, line]); if (!cheering) nextCheer(); }
  function nextCheer() {
    const o = cheers.shift();
    if (!o) { cheering = false; return; }
    cheering = true;
    const show = () => {
      cheerBox.textContent = '';
      const t = el('div', 't');
      t.append(el('b', null, o[1]), el('small', null, o[2]));
      cheerBox.append(typeof o[0] === 'function' ? o[0]() : o[0], t);
      cheerBox.classList.add('on');
      setTimeout(() => { cheerBox.classList.remove('on'); setTimeout(nextCheer, 200); }, 3000);
    };
    // 県の絵を待つのは少しだけ（遅い回線で知らせが遅れないように。間に合わなければ丸い印で押す）
    if (typeof o[0] === 'function' && !window.SHUIN) Promise.race([loadShuin().catch(() => {}), new Promise((ok) => setTimeout(ok, 1200))]).then(show);
    else show();
  }

  // ---------------------------------------------------------------- 上がったか
  const paintLabel = (n) => { const p = prefOf(n), d = p && M.labelOf(p.k); if (d) { const s = stageNow(n); if (s) d.dataset.s = s; else delete d.dataset.s; } };
  function settle(n, quiet) {
    const p = prefOf(n);
    if (!p) return;
    const cur = stageNow(n), s = stageOf(countOf(n));
    if (s <= cur) return;
    const st = S.stage[n] = S.stage[n] || {};
    for (let i = cur + 1; i <= s; i++) st[i] = today();
    paintLabel(n);
    if (!quiet) cheer(() => prefMark(p, s, true), `${M.FULL(p.name)}　${stageName(p, s)}`, stageLine(p, s));
  }
  function settleRank(quiet) {
    const r = rankOf(total());
    if (r <= S.rank) return;
    S.rank = r;
    if (!quiet) cheer(seal(RANKS[r][1], 4, r), `位が上がりました　${RANKS[r][1]}`, RANKS[r][2]);
  }
  const openBtn = $('#deai-open');
  function paintBtn() {
    openBtn.textContent = 'であい帖 ';
    openBtn.appendChild(el('b', null, RANKS[S.rank][1]));
    const L = letter();
    openBtn.classList.toggle('dot', !(L.done[0] && L.done[1] && dayDone()));
  }

  // ---------------------------------------------------------------- 今日の便り（1〜3分で終わるお題が3つ。連続日数では責めない）
  const dayDone = () => !!(window.QUIZ && QUIZ.dayDone && QUIZ.dayDone());
  function letter() {
    const d = today();
    if (S.letter && S.letter.d === d) return S.letter;
    const m = new Date().getMonth() + 1, season = IN.items.filter((it) => (it.months || []).includes(m)), pool = season.length ? season : IN.items;
    const left = pool.filter((it) => !known.has(itemId(it))), from = left.length ? left : pool;
    S.letter = { d, id: itemId(from[hash(d) % from.length]), done: [false, false, false], full: false };
    save();
    return S.letter;
  }
  function checkLetter() {
    const L = letter();
    L.done[2] = dayDone();
    if (L.full || !(L.done[0] && L.done[1] && L.done[2])) return;
    L.full = true; S.letters++;
    cheer(seal('便り', 3, 'letter'), '今日の便り、ぜんぶ済みました', `便りを終えた日は、これで ${S.letters}日です`);
  }

  // ---------------------------------------------------------------- 知った物が届く
  addEventListener('deai', (e) => {
    const { id, pref, mameNew, day } = e.detail || {};
    const L = letter();
    loadShuin().catch(() => {});
    let fresh = !!mameNew;
    if (LEDGER.has(id) && !known.has(id)) { known.add(id); fresh = true; }
    const task = (id === L.id && !L.done[0]) || (mameNew && !L.done[1]);
    if (id === L.id) L.done[0] = true;
    if (mameNew) L.done[1] = true;
    if (!fresh && !day && !task) return;
    const d = today();
    if (S.days[S.days.length - 1] !== d) S.days.push(d);
    if (pref) settle(pref);
    settleRank();
    checkLetter();
    save();
    paintBtn();
  });

  // ---------------------------------------------------------------- 行き先へ（県の中からでも。県を浮かせ終わってから紹介を開く）
  const box = $('#deai');
  let pend = null;
  M.on('select', (k) => { if (pend && pend.k === k) { const f = pend.f; pend = null; f(); } });
  function goPref(n, then) {
    close();
    if (window.OPENING && OPENING.open) OPENING.close();
    const p = prefOf(n);
    if (M.sel === p.k) { if (then) then(); return; }     // その県を浮かせている・その県の中にいる時は、そのまま
    pend = then ? { k: p.k, f: then } : null;
    M.select(p.k);
  }
  function goItem(it) { goPref(it.pref, () => M.openItem(it)); }

  // ---------------------------------------------------------------- であい帖の窓
  function close() { box.classList.remove('open'); }
  function open() {
    for (const q of ['#mame-book', '#mame-toast']) { const e = $(q); if (e) e.classList.remove(q === '#mame-book' ? 'open' : 'on'); }     // 知らせの帯が窓の上に重なった
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});     // 消えにくい保存を頼む（断られても動く）
    render();
    box.classList.add('open');
    box.scrollTop = 0;
    if (!window.SHUIN) loadShuin().then(() => { if (box.classList.contains('open')) refreshSeals(); }, () => {});
  }
  // 朱印の絵が届いたら、丸い印を県の印に置きかえる（窓は開いたまま・動かさない）
  function refreshSeals() {
    for (const c of box.querySelectorAll('.cell')) {
      const n = +c.dataset.n, p = prefOf(n);
      c.firstChild.replaceWith(prefMark(p, stageNow(n)));
    }
    const det = box.querySelector('.det');
    if (det) { const n = +det.dataset.n; det.querySelector('.seal, .art').replaceWith(prefMark(prefOf(n), stageNow(n), true)); }
  }
  function render() {
    const L = letter();
    L.done[2] = dayDone();
    box.textContent = '';
    const x = el('button', 'close', '閉じる'); x.addEventListener('click', close);
    box.append(x, el('h2', null, 'であい帖'), el('p', 'lead', '紹介や豆知識を知るほど、位が上がり、県の朱印が変わっていきます。'));
    const cols = el('div', 'cols');
    cols.append(renderMe(), renderLetter(L), renderMine());
    box.append(cols, renderSeals(), renderPass());
  }
  function renderMe() {
    const t = total(), r = S.rank, next = RANKS[r + 1], sec = el('section', 'me');
    const nm = el('input'); nm.type = 'text'; nm.maxLength = 16; nm.value = S.name; nm.placeholder = '旅の人'; nm.setAttribute('aria-label', '旅の名');
    nm.addEventListener('change', () => { S.name = nm.value.trim().slice(0, 16); save(); });
    const who = el('label', 'who', '旅の名 '); who.appendChild(nm);
    const bar = el('span', 'bar'), fill = el('i'), from = RANKS[r][0];
    fill.style.width = (next ? Math.min(100, (t - from) / (next[0] - from) * 100) : 100).toFixed(1) + '%';
    bar.appendChild(fill);
    const stamped = M.P.filter((p) => stageNow(p.n) > 0).length;
    sec.append(who, el('p', 'rank', RANKS[r][1]), bar,
      el('p', 'line', next ? `知った数 ${t}　次の位「${next[1]}」まで あと ${next[0] - t}` : `知った数 ${t}　いちばん上の位です`),
      el('p', 'line', `旅の日数 ${S.days.length}日・便りを終えた日 ${S.letters}日・朱印 ${stamped} / 47`));
    return sec;
  }
  function renderLetter(L) {
    const sec = el('section', 'letter');
    sec.appendChild(el('h3', null, `今日の便り（${jpDate(L.d).replace(/^\d+年/, '')}）`));
    const it = IN.items.find((q) => itemId(q) === L.id), p = it && prefOf(it.pref);
    const m = new Date().getMonth() + 1, inSeason = it && (it.months || []).includes(m);
    const when = !inSeason ? '' : it.cat === '特産' || it.cat === '食' ? '今が旬の' : '今月の';     // 祭りや名所に「旬」は言わない
    const rows = [
      [it ? `${when}「${it.name}」（${p ? M.FULL(p.name) : ''}）を読む` : '紹介を1つ読む', () => it && goItem(it)],
      ['まだ知らない豆知識を1つ開く', () => { close(); if (window.MAME) MAME.next(); }],
      ['今日の一問に答える', () => { close(); if (window.QUIZ) { if (window.OPENING && OPENING.open) OPENING.close(); QUIZ.start('day'); } }],
    ];
    rows.forEach(([text, go], i) => {
      const row = el('div', 'task' + (L.done[i] ? ' done' : ''));
      row.append(el('span', 'check', L.done[i] ? '済' : ''), el('span', 'tx', text));
      if (!L.done[i]) { const b = el('button', null, '行く'); b.addEventListener('click', go); row.appendChild(b); }
      sec.appendChild(row);
    });
    return sec;
  }
  function renderMine() {
    const sec = el('section', 'mine');
    sec.appendChild(el('h3', null, 'わたしの日本'));
    const map = M.miniMap(), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', map.box);
    J.prefs.forEach((jp, i) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'), t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      path.setAttribute('d', map.d[i]);
      path.setAttribute('class', 's' + stageNow(jp.n));
      t.textContent = M.FULL(jp.name); path.appendChild(t);
      path.addEventListener('click', () => { const c = box.querySelector(`[data-n="${jp.n}"]`); if (c) c.click(); });
      svg.appendChild(path);
    });
    const counts = [0, 0, 0, 0, 0];
    for (const p of M.P) counts[stageNow(p.n)]++;
    const pic = el('button', null, '絵にして残す');
    pic.addEventListener('click', () => showPic(drawMine(counts), 'わたしの日本.png'));
    sec.append(svg, el('p', 'line', `知人 ${counts[1]}・常連 ${counts[2]}・通 ${counts[3]}・名誉 ${counts[4]}`), pic);
    return sec;
  }
  function renderSeals() {
    const sec = el('section', 'book');
    sec.appendChild(el('h3', null, '朱印帳'));
    sec.appendChild(el('p', 'lead', '県ごとに違う印があります。紹介と豆知識を知るほど、印が完成していきます（3つで知人・4分の1で常連・半分で通・全部で名誉）。名誉の印には、その県だけの仕上げがあります。押すと、進み具合が開きます。'));
    const REG = (window.OPENING && OPENING.regions) || [['全国', 1, 47]];
    for (const [name, a, z] of REG) {
      sec.appendChild(el('h4', null, name));
      const grid = el('div', 'seals');
      for (const p of M.P.filter((q) => q.n >= a && q.n <= z)) {
        const s = stageNow(p.n), c = el('button', 'cell');
        c.dataset.n = p.n;
        c.setAttribute('aria-label', `${M.FULL(p.name)}（${s ? stageName(p, s) : 'まだ'}）`);
        c.appendChild(prefMark(p, s));
        const last = s && S.stage[p.n][s];
        c.appendChild(el('small', null, last ? last.slice(5).split('-').map(Number).join('/') : ' '));
        c.addEventListener('click', () => detail(p, grid));
        grid.appendChild(c);
      }
      sec.appendChild(grid);
    }
    return sec;
  }
  function detail(p, grid) {
    const old = box.querySelector('.det');
    if (old) { const same = +old.dataset.n === p.n; old.remove(); if (same) return; }
    const [k, D] = countOf(p.n), s = stageNow(p.n), st = S.stage[p.n] || {}, det = el('div', 'det');
    det.dataset.n = p.n;
    const head = el('div', 'dhead'), hd = el('div', 'dtx');
    head.append(prefMark(p, s, true), hd);
    det.appendChild(head);
    hd.appendChild(el('h4', null, `${M.FULL(p.name)}　${s ? stageName(p, s) : 'まだこれから'}`));
    const bar = el('span', 'bar'), fill = el('i');
    fill.style.width = (D ? k / D * 100 : 0).toFixed(1) + '%';
    bar.appendChild(fill);
    const nextAt = [3, Math.ceil(D / 4), Math.ceil(D / 2), D].find((v) => v > k);
    const nextS = s < 4 && nextAt != null ? stageOf([nextAt, D]) : 0;
    hd.append(bar, el('p', 'line', `知った数 ${k} / ${D}` + (nextS ? `　あと ${nextAt - k} で${stageName(p, nextS)}` : '')));
    const dates = [1, 2, 3, 4].filter((i) => st[i]).map((i) => `${stageName(p, i)} ${jpDate(st[i])}`);
    if (dates.length) hd.appendChild(el('p', 'line', dates.join('　')));
    const row = el('div', 'row');
    const go = el('button', null, 'この県へ'); go.addEventListener('click', () => goPref(p.n)); row.appendChild(go);
    const it = IN.items.find((q) => q.pref === p.n && !known.has(itemId(q)));
    if (it) { const b = el('button', null, 'まだ読んでいない紹介へ'); b.addEventListener('click', () => goItem(it)); row.appendChild(b); }
    const mm = (IN.mame || []).find((d) => d.pref === p.n && !hasMame(d.id));
    if (mm && window.MAME) { const b = el('button', null, 'まだ知らない豆知識へ'); b.addEventListener('click', () => { close(); MAME.goTo(mm.id); }); row.appendChild(b); }
    if (s === 4) { const b = el('button', 'cert', `絵図の${meiyo(p)}証`); b.addEventListener('click', () => drawCert(p, D, st[4]).then((c) => showPic(c, `絵図の${meiyo(p)}証_${p.name}.png`))); row.appendChild(b); }
    det.appendChild(row);
    grid.after(det);
    det.scrollIntoView({ block: 'nearest' });
  }

  // ---------------------------------------------------------------- 絵にして残す（わたしの日本・証書）。字は見る人の端末の字で描く
  const FONT = '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", serif';
  const SHU = '#c8402c', GOLD = '#b8922e', INK = '#2a3146', PAPER = '#f7f0dc';
  const FILL = ['#efe7cf', '#f3d9a8', '#e9a860', '#d5683f', '#c8402c'];
  const sheet = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const write = (g, text, x, y, size, color, align) => { g.font = `700 ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align || 'center'; g.fillText(text, x, y); };
  const who = () => S.name || '旅の人';
  function drawMine(counts) {
    const [c, g] = sheet(1200, 1500), map = M.miniMap(), [bx, by, bw, bh] = map.b;
    g.fillStyle = PAPER; g.fillRect(0, 0, 1200, 1500);
    g.strokeStyle = GOLD; g.lineWidth = 6; g.strokeRect(30, 30, 1140, 1440);
    write(g, 'わたしの日本', 600, 130, 78, SHU);
    write(g, `${who()}　位：${RANKS[S.rank][1]}`, 600, 205, 38, INK);
    const s = Math.min(1040 / bw, 950 / bh), ox = 80 + (1040 - bw * s) / 2 - bx * s, oy = 240 + (950 - bh * s) / 2 - by * s;
    g.save(); g.translate(ox, oy); g.scale(s, s);
    J.prefs.forEach((jp, i) => {
      const path = new Path2D(map.d[i]), st = stageNow(jp.n);
      g.fillStyle = FILL[st]; g.fill(path);
      g.strokeStyle = st === 4 ? GOLD : '#8a7a5a'; g.lineWidth = (st === 4 ? 2.4 : 1.2) / s; g.stroke(path);
    });
    g.restore();
    ['知人', '常連', '通', '名誉'].forEach((t, i) => {
      const x = 190 + i * 230;
      g.fillStyle = FILL[i + 1]; g.fillRect(x - 70, 1232, 36, 36);
      g.strokeStyle = '#8a7a5a'; g.lineWidth = 2; g.strokeRect(x - 70, 1232, 36, 36);
      write(g, `${t} ${counts[i + 1]}`, x - 24, 1262, 34, INK, 'left');
    });
    write(g, `知った数 ${total()}　旅の日数 ${S.days.length}日　${jpDate(today())}`, 600, 1340, 34, INK);
    write(g, 'にっぽん であい絵図（AI内製化工房）', 600, 1420, 30, '#6a6250');
    return c;
  }
  async function drawCert(p, D, date) {
    const [c, g] = sheet(1400, 990), full = M.FULL(p.name), title = meiyo(p);
    g.fillStyle = PAPER; g.fillRect(0, 0, 1400, 990);
    g.strokeStyle = GOLD; g.lineWidth = 8; g.strokeRect(36, 36, 1328, 918);
    g.strokeStyle = SHU; g.lineWidth = 2; g.strokeRect(54, 54, 1292, 882);
    write(g, `絵図の${title}証`, 700, 200, 88, SHU);
    write(g, `${who()}　殿`, 700, 320, 56, INK);
    [`あなたは、${full}の紹介と豆知識 ${D}件を`, 'すべて知りました。', `よって、ここに絵図の${title}と認めます。`].forEach((t, i) => write(g, t, 700, 440 + i * 72, 44, INK));
    write(g, jpDate(date), 700, 700, 40, INK);
    // その県の名誉の印を押す。絵が読めない時は、丸い印を描く
    const sx = 1130, sy = 720;
    let stamped = false;
    try {
      await loadShuin();
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(artOf(p.n, 4));
      await img.decode();
      g.save(); g.translate(sx, sy); g.rotate(-0.09); g.drawImage(img, -120, -120, 240, 240); g.restore();
      stamped = true;
    } catch (e) { /* 下の丸い印で */ }
    if (!stamped) {
      g.beginPath(); g.arc(sx, sy, 92, 0, Math.PI * 2); g.fillStyle = SHU; g.fill();
      g.beginPath(); g.arc(sx, sy, 80, 0, Math.PI * 2); g.strokeStyle = '#fff4e2'; g.lineWidth = 3; g.stroke();
      const ch = [...p.name], size = ch.length > 2 ? 44 : 56;
      ch.forEach((t, i) => write(g, t, sx, sy + (i - (ch.length - 1) / 2) * (size + 4) + size * 0.36, size, '#fff4e2'));
    }
    write(g, 'にっぽん であい絵図（AI内製化工房）', 700, 830, 32, '#6a6250');
    write(g, `この絵図の中の遊びの称号です。${full}や市町村とは関係ありません。`, 700, 884, 28, '#6a6250');
    return c;
  }
  function showPic(canvas, file) {
    const old = box.querySelector('.pic'); if (old) old.remove();
    const pic = el('div', 'pic'), row = el('div', 'row');
    const keep = el('button', null, '送る・保存する'), no = el('button', null, 'もどる');
    keep.addEventListener('click', () => canvas.toBlob((blob) => {
      const f = new File([blob], file, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).catch(() => {}); return; }
      const a = document.createElement('a'), u = URL.createObjectURL(blob);
      a.href = u; a.download = file; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
    }, 'image/png'));
    no.addEventListener('click', () => pic.remove());
    row.append(keep, no);
    pic.append(canvas, row);
    box.appendChild(pic);
    box.scrollTop = 0;
  }

  // ---------------------------------------------------------------- 旅の手形（記録を字にして写し、別の端末や後日に戻す。iPhone の Safari は、しばらく開かないと記録を消すことがある）
  function passText() {
    S.passAt = total(); save();
    const body = JSON.stringify({ d: S, m: readJson(MAME_KEY) || [], q: readJson(QUIZ_KEY) || {} });
    const bytes = new TextEncoder().encode(body);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return `DEAI1.${hash(body).toString(36)}.${btoa(bin)}`;
  }
  function readPass(text) {
    const m = /^DEAI1\.([0-9a-z]+)\.([A-Za-z0-9+/=]+)$/.exec(String(text).trim());
    if (!m) return null;
    let body, o;
    try {
      const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      body = new TextDecoder().decode(bytes);
      if (hash(body).toString(36) !== m[1]) return null;
      o = JSON.parse(body);
    } catch (e) { return null; }
    return o && typeof o === 'object' ? o : null;
  }
  // 足すだけ（今の記録は消さない）。県の朱印の日付は早い方を残す
  function mergePass(o) {
    const d = clean(o.d), before = total();
    for (const id of d.known) known.add(id);
    for (const [n, st] of Object.entries(d.stage)) {
      const mine = S.stage[n] = S.stage[n] || {};
      for (const [s, date] of Object.entries(st)) if (!mine[s] || date < mine[s]) mine[s] = date;
    }
    S.days = [...new Set(S.days.concat(d.days))].sort();
    S.letters = Math.max(S.letters, d.letters);
    S.rank = Math.max(S.rank, d.rank);
    if (!S.name) S.name = d.name;
    save();
    const ids = new Set((IN.mame || []).map((q) => q.id));
    const mame = new Set([...(Array.isArray(readJson(MAME_KEY)) ? readJson(MAME_KEY) : []), ...(Array.isArray(o.m) ? o.m : [])].filter((id) => ids.has(id)));
    try { if (mame.size) localStorage.setItem(MAME_KEY, JSON.stringify([...mame])); } catch (e) { canKeep = false; }
    mergeQuiz(o.q);
    return known.size + mame.size - before;
  }
  function mergeQuiz(q) {
    const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    if (!obj(q)) return;
    const a = readJson(QUIZ_KEY), L = obj(a) ? a : {};
    const daily = obj(L.daily) ? L.daily : {};
    if (obj(q.daily)) for (const [k, v] of Object.entries(q.daily)) if (isDate(k) && obj(v) && typeof v.id === 'string' && !daily[k]) daily[k] = { id: v.id, ok: !!v.ok };
    const rounds = (Array.isArray(L.rounds) ? L.rounds.filter(obj) : []);
    if (Array.isArray(q.rounds)) for (const r of q.rounds) if (obj(r) && Number.isFinite(r.t) && !rounds.some((x) => x.t === r.t)) rounds.push({ t: r.t, score: +r.score || 0, ok: +r.ok || 0, n: +r.n || 0, mode: String(r.mode || 'round').slice(0, 8) });
    rounds.sort((x, y) => x.t - y.t);
    const cats = obj(L.cats) ? L.cats : {};
    if (obj(q.cats)) for (const [k, v] of Object.entries(q.cats)) if (k !== '__proto__' && k.length <= 12 && Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && (!cats[k] || cats[k][1] < v[1])) cats[k] = [v[0], v[1]];
    const wrong = [...new Set([...(Array.isArray(L.wrong) ? L.wrong : []), ...(Array.isArray(q.wrong) ? q.wrong : [])].filter((s) => typeof s === 'string' && s.length <= 120))].slice(-100);
    try { localStorage.setItem(QUIZ_KEY, JSON.stringify({ daily, rounds: rounds.slice(-200), wrong, cats })); } catch (e) { canKeep = false; }
  }
  function renderPass() {
    const sec = el('section', 'pass');
    sec.appendChild(el('h3', null, '旅の手形'));
    const grown = total() - S.passAt;
    sec.appendChild(el('p', 'lead', canKeep
      ? '記録は、この端末のこのブラウザの中だけに残ります（どこにも送りません）。iPhone の Safari などでは、しばらく開かないと消えることがあります。ときどき手形を残しておくと、消えた時や別の端末で元に戻せます。'
      : 'この画面では記録を残せません（プライベートモードなど）。開いている間だけ覚えています。'));
    if (grown >= 20) sec.appendChild(el('p', 'nudge', `前の手形から ${grown} 増えました。そろそろ手形を残しておくと安心です。`));
    const row = el('div', 'row'), say = el('p', 'say');
    const copy = el('button', null, '手形を字で写す');
    copy.addEventListener('click', () => {
      const t = passText();
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { say.textContent = '写しました。メモなどに貼って残してください。'; }, () => { area.value = t; area.hidden = false; area.select(); say.textContent = '下の字を全部選んで写してください。'; });
    });
    const file = el('button', null, '手形をファイルで残す');
    file.addEventListener('click', () => {
      const u = URL.createObjectURL(new Blob([passText()], { type: 'text/plain' })), a = document.createElement('a');
      a.href = u; a.download = `であい帖の手形_${today()}.txt`; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
      say.textContent = 'ファイルに残しました。';
    });
    const load = el('button', null, '手形を読み込む'), area = el('textarea'), pick = el('input'), fromFile = el('button', null, '手形のファイルを選ぶ');
    area.hidden = true; area.rows = 3; area.placeholder = 'ここに手形の字を貼って、もう一度「手形を読み込む」を押します'; area.setAttribute('aria-label', '手形の字');
    pick.type = 'file'; pick.accept = '.txt,text/plain'; pick.hidden = true;
    fromFile.hidden = true;
    fromFile.addEventListener('click', () => pick.click());
    const apply = (text) => {
      const o = String(text).length <= 4000000 ? readPass(text) : null;
      if (!o) { say.textContent = 'この字は手形として読めませんでした（一部が欠けていないか確かめてください）。今の記録はそのままです。'; return; }
      const n = mergePass(o);
      say.textContent = `手形を読みました（${Math.max(0, n)} 増えました）。今の記録に足しました。読み直します。`;
      setTimeout(() => location.reload(), 1200);
    };
    load.addEventListener('click', () => { if (area.hidden) { area.value = ''; area.hidden = false; fromFile.hidden = false; area.focus(); } else apply(area.value); });
    pick.addEventListener('change', () => { const f = pick.files[0]; if (f) f.text().then(apply, () => { say.textContent = 'ファイルを読めませんでした。'; }); });
    const clr = el('button', 'clear', '記録を全部消す');
    clr.addEventListener('click', () => {
      if (!clr.dataset.armed) { clr.dataset.armed = '1'; clr.textContent = 'もう一度押すと、位・朱印・豆知識帳・クイズの記録を全部消します'; return; }
      try { for (const k of [KEY, MAME_KEY, QUIZ_KEY]) localStorage.removeItem(k); } catch (e) { /* 消せない画面では何もしない */ }
      location.reload();
    });
    const toBook = el('button', null, '豆知識帳へ');
    toBook.addEventListener('click', () => { close(); if (window.MAME) MAME.book(); });
    row.append(copy, file, load, fromFile, toBook);
    sec.append(row, area, pick, say, clr);
    return sec;
  }

  // ---------------------------------------------------------------- はじめ
  openBtn.addEventListener('click', () => (box.classList.contains('open') ? close() : open()));
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !box.classList.contains('open') || e.target.closest('input, textarea')) return;
    const pic = box.querySelector('.pic');
    if (pic) pic.remove(); else close();
    e.stopImmediatePropagation();
  }, true);
  M.on('world', (w) => {
    if (!w) return;
    const p = M.P.find((q) => q.name === w.name);
    if (p) dispatchEvent(new CustomEvent('deai', { detail: { id: 'visit:' + p.n, pref: p.n } }));
  });
  // 開いた時：前からの記録（豆知識帳）を数え直す。ここでは知らせない
  M.on('ready', () => {
    for (const p of M.P) { settle(p.n, true); paintLabel(p.n); }
    settleRank(true);
    letter();
    save();
    paintBtn();
  });
  // 検査用
  window.DEAI = {
    open, close, pass: passText, read: apply0,
    get state() { return { name: S.name, known: known.size, total: total(), rank: S.rank, rankName: RANKS[S.rank][1], days: S.days.length, letters: S.letters, letter: letter(), stage: S.stage, canKeep }; },
    stageNow, countOf, art: artOf, load: loadShuin,
    pics: { mine: () => drawMine([0, 0, 0, 0, 0]), cert: (n) => drawCert(prefOf(n), countOf(n)[1], today()) },
  };
  function apply0(text) { const o = readPass(text); return o ? mergePass(o) : null; }
})();
