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
  // 旅の道具（段2。本人 2026-11-09「どんどん進めて」）：位が上がると手に入り、地図で本当に効く。窓の「旅の道具」で、しまう・使うを選べる。
  // 効かせる側は window.DEAI_TOOL を毎コマ読む（札.js の灯り・であい帖の羅針盤・案内.js の紹介の印・遊覧.js・旅.js）
  const TOOLS = [
    ['chochin', 1, '提灯', '灯り（マウスの周り・スマホは触れた所）が広くなり、札と豆知識の「？」が見つけやすくなります。'],
    ['rashin', 2, '羅針盤', '方位に金の針が出て、いちばん近い「まだ知らない豆知識」の方を指します（県を浮かせている時と県の中では、その県の中で）。'],
    ['megane', 3, '遠めがね', '県を浮かせた時と県の中で、まだ読んでいない紹介の印が金色に光ります。'],
    ['hikyaku', 4, '飛脚の足', '遊覧で次の所へ移る速さと、空を飛ぶ速さが上がります（説明を読む時間は変わりません）。'],
  ];
  const TOOL_ICON = {
    chochin: '<svg viewBox="0 0 40 40"><rect x="15" y="4" width="10" height="4" rx="1" fill="#2a3146"/><ellipse cx="20" cy="20" rx="11" ry="12" fill="#c8402c"/><path d="M10 16h20M9.5 20h21M10 24h20" stroke="#8e2a1c" stroke-width="1.2"/><ellipse cx="20" cy="20" rx="5" ry="9" fill="#f6c25a" opacity=".55"/><rect x="15" y="32" width="10" height="4" rx="1" fill="#2a3146"/></svg>',
    rashin: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#fbf6e8" stroke="#2a3146" stroke-width="2"/><circle cx="20" cy="20" r="12" fill="none" stroke="#b8922e" stroke-width="1"/><path d="M20 6l3 14h-6z" fill="#d9a520" stroke="#2a3146" stroke-width="1"/><path d="M20 34l3-14h-6z" fill="#fbf6e8" stroke="#2a3146" stroke-width="1"/></svg>',
    megane: '<svg viewBox="0 0 40 40"><g transform="rotate(-32 20 20)" stroke="#2a3146" stroke-width="1.3"><rect x="2" y="17.5" width="8" height="5" fill="#b8922e"/><rect x="10" y="16" width="10" height="8" fill="#8a5a2c"/><rect x="20" y="14" width="15" height="12" fill="#6e4424"/><rect x="31" y="13.5" width="3" height="13" fill="#d9a520"/><ellipse cx="35.5" cy="20" rx="1.6" ry="5.6" fill="#bfe3f0"/></g></svg>',
    hikyaku: '<svg viewBox="0 0 40 40"><g fill="#d9b46a" stroke="#6a4a24" stroke-width="1.3"><rect x="5" y="6" width="13" height="30" rx="6"/><rect x="22" y="3" width="13" height="30" rx="6"/></g><path d="M7 24h9M7 28h9M7 32h9M24 21h9M24 25h9M24 29h9" stroke="#a07a3c" stroke-width="1"/><path d="M11.5 9L7 20M11.5 9L16 20M28.5 6L24 17M28.5 6L33 17" stroke="#c8402c" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
  };
  // 縁（段2）：道の県をみな知人まで知ると結ばれる。中身は 縁の台帳.js（この前に読む）、地図に描くのは 縁.js（この後に読む）
  const ENS = window.EN_DATA || [], EN_IDS = new Set(ENS.map((e) => e.id));
  // 縁の絵：2つの土地（地図のピン）を赤い糸で結び、まん中に金の結び目。前の「赤と金の輪が2つ重なる」はカード会社の印に似ていて、
  // 端を丸い輪にすると自転車・眼鏡に見えた
  const EN_ICON = '<svg viewBox="0 0 40 40"><path d="M7 28C12 15 17 32 20 22S28 12 33 22" fill="none" stroke="#c8402c" stroke-width="2.6" stroke-linecap="round"/><path d="M20 22l-4-4.5 4 1.5 4-1.5z" fill="#d9a520" stroke="#8e2a1c" stroke-width="1"/><circle cx="20" cy="22" r="2.6" fill="#d9a520" stroke="#8e2a1c" stroke-width="1"/><path d="M7 28C4 24 2.5 22 2.5 20a4.5 4.5 0 0 1 9 0c0 2-1.5 4-4.5 8z" fill="#2a3146"/><circle cx="7" cy="20" r="1.7" fill="#fbf6e8"/><path d="M33 22C30 18 28.5 16 28.5 14a4.5 4.5 0 0 1 9 0c0 2-1.5 4-4.5 8z" fill="#2a3146"/><circle cx="33" cy="14" r="1.7" fill="#fbf6e8"/></svg>';
  // 旬の札（段3の一部・ゲームの案.md「旬の札は、本当にその季節にしか手に入らない」・2026-11-09）：旬の月がある紹介を、その月に読むと1枚。
  // 逃しても責めない（来年の同じ月にまた取れる）。品目ごとの絵はまだ無いので、札の絵は種類ごとの印
  const SHUN = IN.items.filter((it) => (it.months || []).length), SHUN_BY = new Map(SHUN.map((it) => [itemId(it), it]));
  const SHUN_ICON = {
    祭り: '<svg viewBox="0 0 40 40"><path d="M8 13v13c0 2.5 5.4 4.5 12 4.5s12-2 12-4.5V13" fill="#c8402c" stroke="#2a3146" stroke-width="1.4"/><ellipse cx="20" cy="13" rx="12" ry="4.5" fill="#f3e6c8" stroke="#2a3146" stroke-width="1.4"/><path d="M11 21c3 1.4 15 1.4 18 0M11 25.5c3 1.4 15 1.4 18 0" stroke="#e8b828" stroke-width="1.3" fill="none"/><path d="M26 2l-5 9M33 4l-7 7" stroke="#6a4a24" stroke-width="2.2" stroke-linecap="round"/></svg>',
    // 特産は牛肉・カニ・野菜・果物とさまざまなので、中身を描かない名産の木箱（果物の籠＝松阪牛が果物に見えた・風呂敷包み＝結び目が耳で熊の顔に見えた）
    特産: '<svg viewBox="0 0 40 40"><rect x="6" y="16" width="28" height="18" fill="#d9b46a" stroke="#6a4a24" stroke-width="1.4"/><rect x="5" y="12" width="30" height="6" fill="#e6c88a" stroke="#6a4a24" stroke-width="1.4"/><rect x="17.5" y="12" width="5" height="22" fill="#fbf6e8" stroke="#6a4a24" stroke-width="1"/><path d="M20 12c-3-5-9-5-8-1.5 1 2 5 1.5 8 1.5zM20 12c3-5 9-5 8-1.5-1 2-5 1.5-8 1.5z" fill="#c8402c" stroke="#8e2a1c" stroke-width="1"/></svg>',
    名所: '<svg viewBox="0 0 40 40"><circle cx="29" cy="11" r="5" fill="#e8b828"/><path d="M3 33l12-19 7 10 4-5 11 14z" fill="#6a9a4a" stroke="#2a3146" stroke-width="1.4" stroke-linejoin="round"/><path d="M15 14l-3.5 5.5 3.5-1.5 3 2z" fill="#fbf6e8"/></svg>',
    食: '<svg viewBox="0 0 40 40"><path d="M10 17c2-4 6-6 10-6s8 2 10 6" fill="#fbf6e8" stroke="#2a3146" stroke-width="1.2"/><path d="M6 19h28c0 8-6 13-14 13S6 27 6 19z" fill="#c8402c" stroke="#2a3146" stroke-width="1.4"/><path d="M14 32h12v3H14z" fill="#8e2a1c"/><path d="M22 4l12 13M18 5l13 13" stroke="#6a4a24" stroke-width="1.8" stroke-linecap="round"/></svg>',
    歴史: '<svg viewBox="0 0 40 40"><rect x="9" y="8" width="22" height="24" fill="#f3e6c8" stroke="#2a3146" stroke-width="1.4"/><rect x="6" y="5" width="28" height="4" rx="2" fill="#8a5a2c" stroke="#2a3146" stroke-width="1.2"/><rect x="6" y="31" width="28" height="4" rx="2" fill="#8a5a2c" stroke="#2a3146" stroke-width="1.2"/><path d="M14 14h12M14 19h12M14 24h8" stroke="#6a6250" stroke-width="1.4"/></svg>',
  };
  // 旬の月の書き方：続いた月はまとめる（12月から1月もつなぐ）。6・7・8 → 6〜8月、12・1・2 → 12〜2月
  function monthsText(ms) {
    const s = new Set(ms), nx = (m) => (m % 12) + 1, pv = (m) => ((m + 10) % 12) + 1;
    if (s.size >= 12) return '一年じゅう';
    return [...s].filter((m) => !s.has(pv(m))).sort((a, b) => a - b)
      .map((a) => { let b = a; while (s.has(nx(b))) b = nx(b); return a === b ? `${a}月` : `${a}〜${b}月`; }).join('・');
  }
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
      stage, rank: Math.min(num(o.rank), RANKS.length - 1), days: Array.isArray(o.days) ? [...new Set(o.days.filter(isDate))].slice(-3000) : [], letters: num(o.letters), passAt: num(o.passAt), letter,
      off: Array.isArray(o.off) ? o.off.filter((k) => TOOLS.some((t) => t[0] === k)) : [], en: cleanEn(o.en), shun: cleanShun(o.shun) };
  }
  function cleanShun(v) {
    const sh = {};
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const id of SHUN_BY.keys()) if (isDate(v[id])) sh[id] = v[id];
    return sh;
  }
  function cleanEn(v) {
    const en = {};
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const id of EN_IDS) if (isDate(v[id])) en[id] = v[id];
    return en;
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
  const T = window.DEAI_TOOL = {};
  function paintTools() {
    for (const [k, r] of TOOLS) {
      T[k] = S.rank >= r && !S.off.includes(k);
      document.body.classList.toggle('tool-' + k, T[k]);
    }
    dispatchEvent(new Event('deai-tool'));
  }

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
    const was = S.rank;
    S.rank = r;
    paintTools();
    if (quiet) return;
    cheer(seal(RANKS[r][1], 4, r), `位が上がりました　${RANKS[r][1]}`, RANKS[r][2]);
    for (const [k, at, name, what] of TOOLS) if (at > was && at <= r) cheer(() => toolIcon(k), `旅の道具を手に入れました　${name}`, what);
  }
  function toolIcon(k) { const d = el('span', 'tool-ic'); d.innerHTML = TOOL_ICON[k]; return d; }
  // 縁の道の形（小さな地図・絵にして残す1枚に重ねる）。筋の始まり（b）で線を切る
  const enD = (e) => e.pts.map((p, i) => (i === 0 || p.b ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.z.toFixed(1)).join('');
  function enIcon(dim) { const d = el('span', 'tool-ic' + (dim ? ' dim' : '')); d.innerHTML = EN_ICON; return d; }
  // 縁：道の県がみな知人（段1）以上になったら結ぶ。知らせの後、であい帖の「縁」から地図に出せる
  function settleEn(quiet) {
    for (const e of ENS) {
      if (S.en[e.id] || !e.prefs.every((n) => stageNow(n) >= 1)) continue;
      S.en[e.id] = today();
      if (!quiet) cheer(() => enIcon(), `縁が結ばれました　${e.name}`, `${e.teaser}。であい帖の「縁」から、地図に道を出せます`);
    }
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
    // 旬の札：旬の月に読んだら1枚（前に読んだ紹介でも、旬の月に読み直せば取れる）
    const sh = SHUN_BY.get(id), shunNew = !!(sh && !S.shun[id] && sh.months.includes(new Date().getMonth() + 1));
    if (shunNew) S.shun[id] = today();
    if (!fresh && !day && !task && !shunNew) return;
    const d = today();
    if (S.days[S.days.length - 1] !== d) S.days.push(d);
    if (pref) settle(pref);
    settleEn();
    settleRank();
    // 旬の札の知らせは、県の朱印・縁・位の後に（知人になる節目の知らせを先に）
    if (shunNew) cheer(() => shunCard(sh), `旬の札を手に入れました　${sh.name}`, `${M.FULL(prefOf(sh.pref).name)}・旬は${monthsText(sh.months)}`);
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
    // 目次：段が増えて、スマホでは窓が縦にとても長くなった（2026-11-09）。押すとその段へ
    const toc = el('nav', 'toc'), smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    toc.setAttribute('aria-label', 'であい帖の目次');
    for (const [t, q] of [['位と便り', '.cols'], ['旅の道具', '.tools'], ['縁', '.en'], ['旬の札', '.shunsec'], ['朱印帳', '.book'], ['旅の手形', '.pass']]) {
      const b = el('button', null, t);
      b.addEventListener('click', () => { const s = box.querySelector(q); if (s) s.scrollIntoView({ block: 'start', behavior: smooth }); });
      toc.appendChild(b);
    }
    box.appendChild(toc);
    const cols = el('div', 'cols');
    cols.append(renderMe(), renderLetter(L), renderMine());
    box.append(cols, renderTools(), renderEn(), renderShun(), renderSeals(), renderPass());
  }
  function shunCard(it) {
    const c = el('div', 'shun'), ic = el('span', 'tool-ic');
    ic.innerHTML = SHUN_ICON[it.cat] || SHUN_ICON.特産;
    c.append(ic, el('b', null, it.name), el('small', null, `${prefOf(it.pref).name}・${monthsText(it.months)}`));
    return c;
  }
  function renderShun() {
    const sec = el('section', 'shunsec'), m = new Date().getMonth() + 1;
    const now = SHUN.filter((it) => it.months.includes(m)), left = now.filter((it) => !S.shun[itemId(it)]), got = SHUN.filter((it) => S.shun[itemId(it)]);
    sec.appendChild(el('h3', null, '旬の札'));
    sec.appendChild(el('p', 'lead', `旬のある紹介を、その月に読むと札が手に入ります。手に入れそびれても、来年の同じ月にまた取れます（${m}月 ${now.length - left.length} / ${now.length}・集めた札 ${got.length} / ${SHUN.length}）。`));
    if (left.length) {
      sec.appendChild(el('h4', null, `${m}月に取れる札（押すと、その紹介へ）`));
      const chips = el('div', 'chips');
      left.forEach((it, i) => {
        const b = el('button', null, `${it.name}（${prefOf(it.pref).name}）`);
        b.addEventListener('click', () => goItem(it));
        if (i >= 12) b.hidden = true;
        chips.appendChild(b);
      });
      if (left.length > 12) {
        const more = el('button', 'more', `ほかに ${left.length - 12} 枚`);
        more.addEventListener('click', () => { for (const b of chips.children) b.hidden = false; more.remove(); });
        chips.appendChild(more);
      }
      sec.appendChild(chips);
    }
    if (got.length) {
      sec.appendChild(el('h4', null, '集めた札'));
      const grid = el('div', 'shuns');
      for (const it of got.sort((a, b) => S.shun[itemId(b)].localeCompare(S.shun[itemId(a)]))) grid.appendChild(shunCard(it));
      sec.appendChild(grid);
    }
    return sec;
  }
  function renderEn() {
    const sec = el('section', 'en');
    if (!ENS.length) return sec;
    sec.appendChild(el('h3', null, '縁'));
    sec.appendChild(el('p', 'lead', `道の県をみな「知人」まで知ると、その県どうしを結ぶ本物の歴史の道が、地図に現れます（${Object.keys(S.en).length} / ${ENS.length}）。`));
    const grid = el('div', 'tgrid');
    for (const e of ENS) {
      const date = S.en[e.id], row = el('div', 'tool' + (date ? '' : ' locked')), tx = el('div', 'ttx');
      row.dataset.en = e.id;
      const k = e.prefs.filter((n) => stageNow(n) >= 1).length;
      const route = e.prefs.map((n) => (stageNow(n) >= 1 ? prefOf(n).name : '？')).join(e.kind === '巡り' ? '・' : ' → ');
      tx.append(el('b', null, date ? e.name : '？？の道'), el('small', null, e.teaser), el('small', 'route', date ? route : `${route}（${k} / ${e.prefs.length}）`));
      row.append(enIcon(!date), tx);
      if (date && window.EN) {
        const b = el('button', null, '地図で見る');
        b.addEventListener('click', () => { close(); window.EN.show(e.id, date); });
        row.appendChild(b);
      }
      grid.appendChild(row);
    }
    sec.appendChild(grid);
    return sec;
  }
  function renderTools() {
    const sec = el('section', 'tools');
    sec.appendChild(el('h3', null, '旅の道具'));
    sec.appendChild(el('p', 'lead', '位が上がると、地図で本当に効く道具が手に入ります。使わない道具は、しまっておけます。'));
    const grid = el('div', 'tgrid');
    for (const [k, at, name, what] of TOOLS) {
      const own = S.rank >= at, row = el('div', 'tool' + (own ? '' : ' locked'));
      row.dataset.k = k;
      const tx = el('div', 'ttx');
      tx.append(el('b', null, own ? name : '？？？'), el('small', null, own ? what : `位「${RANKS[at][1]}」で手に入ります`));
      row.append(toolIcon(k), tx);
      if (own) {
        const b = el('button', null, T[k] ? 'しまう' : '使う');
        b.setAttribute('aria-pressed', String(!!T[k]));
        b.addEventListener('click', () => {
          S.off = T[k] ? S.off.concat(k) : S.off.filter((x) => x !== k);
          save(); paintTools();
          b.textContent = T[k] ? 'しまう' : '使う'; b.setAttribute('aria-pressed', String(!!T[k]));
        });
        row.appendChild(b);
      }
      grid.appendChild(row);
    }
    sec.appendChild(grid);
    return sec;
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
    // 結んだ縁の道を金の線で重ねる（縁の点は小さな地図と同じ km の座標）
    const lit = ENS.filter((e) => S.en[e.id]);
    for (const e of lit) { const r = document.createElementNS('http://www.w3.org/2000/svg', 'path'); r.setAttribute('d', enD(e)); r.setAttribute('class', 'en'); svg.appendChild(r); }
    const counts = [0, 0, 0, 0, 0];
    for (const p of M.P) counts[stageNow(p.n)]++;
    const pic = el('button', null, '絵にして残す');
    pic.addEventListener('click', () => showPic(drawMine(counts), 'わたしの日本.png'));
    sec.append(svg, el('p', 'line', `知人 ${counts[1]}・常連 ${counts[2]}・通 ${counts[3]}・名誉 ${counts[4]}` + (lit.length ? `・縁 ${lit.length}本` : '')), pic);
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
    g.strokeStyle = '#d9a520'; g.lineWidth = 4 / s; g.lineJoin = g.lineCap = 'round';
    for (const e of ENS) if (S.en[e.id]) g.stroke(new Path2D(enD(e)));
    g.restore();
    ['知人', '常連', '通', '名誉'].forEach((t, i) => {
      const x = 190 + i * 230;
      g.fillStyle = FILL[i + 1]; g.fillRect(x - 70, 1232, 36, 36);
      g.strokeStyle = '#8a7a5a'; g.lineWidth = 2; g.strokeRect(x - 70, 1232, 36, 36);
      write(g, `${t} ${counts[i + 1]}`, x - 24, 1262, 34, INK, 'left');
    });
    const nEn = ENS.filter((e) => S.en[e.id]).length;
    write(g, `知った数 ${total()}　${nEn ? `縁 ${nEn}本　` : ''}旅の日数 ${S.days.length}日　${jpDate(today())}`, 600, 1340, 34, INK);
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
    for (const [id, date] of Object.entries(d.en)) if (!S.en[id] || date < S.en[id]) S.en[id] = date;
    for (const [id, date] of Object.entries(d.shun)) if (!S.shun[id] || date < S.shun[id]) S.shun[id] = date;
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
    settleEn(true);
    settleRank(true);
    letter();
    save();
    paintBtn();
    paintTools();
  });

  // ---------------------------------------------------------------- 羅針盤（旅の道具）：方位に金の針。いちばん近い「まだ知らない豆知識」の方を指す。
  // 向きは方角（見る向き th と同じ決まり：北が 0・東が +）で、方位の赤い針と同じく画面の上が見ている向き
  const SVGNS = 'http://www.w3.org/2000/svg', compassSvg = document.querySelector('#compass svg');
  const rashin = compassSvg && document.createElementNS(SVGNS, 'g');
  if (rashin) {
    rashin.id = 'rashin'; rashin.style.display = 'none';
    rashin.innerHTML = '<path d="M0-41 L4.5-7 L0-3 L-4.5-7Z" fill="#e8b828" stroke="#2a3146" stroke-width="1.2"/><circle cy="-40" r="3.4" fill="#ffd95a" stroke="#2a3146" stroke-width="1"/>';
    compassSvg.appendChild(rashin);
  }
  let aim = null, aimAt = 0;
  M.on('frame', () => {
    if (!rashin) return;
    const cl = document.body.classList;
    if (!T.rashin || cl.contains('opening') || cl.contains('flying')) { if (aim) { rashin.style.display = 'none'; aim = null; } return; }
    const c = M.cam, now = performance.now();
    if (now - aimAt > 250) {               // 探すのは1秒に4回（豆は 1700 余り）
      aimAt = now;
      const k = M.sel, p = k >= 0 ? M.P[k] : null, inside = !!M.inside;
      let bd = Infinity;
      aim = null;
      for (const d of IN.mame || []) {
        if ((d.eki && !inside) || (p && d.pref !== p.n) || hasMame(d.id)) continue;
        const dd = (d.x - c.x) ** 2 + (d.z - c.z) ** 2;
        if (dd < bd) { bd = dd; aim = d; }
      }
      rashin.style.display = aim ? '' : 'none';
    }
    if (aim) rashin.setAttribute('transform', `rotate(${((Math.atan2(aim.x - c.x, -(aim.z - c.z)) - c.th) * 180 / Math.PI).toFixed(1)})`);
  });
  // 検査用
  window.DEAI = {
    open, close, pass: passText, read: apply0, knows: (id) => known.has(id), get aim() { return aim && aim.id; }, monthsText, get busy() { return cheering || cheers.length > 0; },
    shunHint(it) {
      const id = itemId(it), sh = SHUN_BY.get(id), d = sh && S.shun[id];
      if (!sh) return '';
      return d ? `旬の札：手に入れました（${jpDate(d).replace(/^\d+年/, '')}）` : `旬の札：${monthsText(sh.months)}に読むと手に入ります`;
    },
    get state() { return { name: S.name, known: known.size, total: total(), rank: S.rank, rankName: RANKS[S.rank][1], days: S.days.length, letters: S.letters, letter: letter(), stage: S.stage, canKeep, tools: { ...T }, off: S.off, en: { ...S.en }, shun: { ...S.shun } }; },
    stageNow, countOf, art: artOf, load: loadShuin,
    pics: { mine: () => drawMine([0, 0, 0, 0, 0]), cert: (n) => drawCert(prefOf(n), countOf(n)[1], today()) },
  };
  function apply0(text) { const o = readPass(text); return o ? mergePass(o) : null; }
})();
