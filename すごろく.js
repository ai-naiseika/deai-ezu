// すごろく10回チャレンジ（本人 2026-11-10 の設計。前の「日本一周すごろく」は、さいころで進むだけで選ぶことが無かったので置きかえた）：
// ルーレットで重ならない10の都道府県を選び、県ごとに3〜4択の問い。正解すると同じ県の次の問いへ（1県3問まで・やさしい→ふつう→むずかしい）。
// 点は1問10点・むずかしい問いは＋10・ときどき出るボーナス問題は2倍。1問目に正解した県を、解いた順に県庁どうしの直線（大円）で結び、
// 50kmごとに1点（1問目を外した県で線が切れる）。合計で称号。問いは確かめ済みの台帳（紹介・豆知識・駅の豆知識・目印・山と湖・品目・
// 県のデータ・縁）から作る。番付の名前は端末に覚える（みんなの番付は、点数を受け取る場所ができてから）。字は全部 textContent
(function () {
  'use strict';
  const M = window.MAP3D, IN = window.INTRO, D = window.SUGO_DATA;
  if (!M || !IN || !D) return;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); return e; };
  const KEY = 'zenkoku3d-sugo-v1', ROUNDS = 10, CHAIN = 3, KM_PT = 50, BONUS = 2;
  const LV = { easy: 'やさしい', mid: 'ふつう', hard: 'むずかしい' };
  const TITLES = [[600, '絵図の主'], [500, '日本の達人'], [400, '物知り名人'], [300, '日本通'], [200, '諸国めぐり'], [100, '見習い旅人'], [0, '旅のはじまり']];
  const titleOf = (s) => TITLES.find(([v]) => s >= v)[1];
  const prefOf = (n) => M.P.find((p) => p.n === n);
  const FULL = (n) => M.FULL(prefOf(n).name);
  const REG = [[1, 7], [8, 14], [15, 23], [24, 30], [31, 35], [36, 39], [40, 47]];
  const regOf = (n) => REG.findIndex(([a, b]) => n >= a && n <= b);
  const fmt = (v) => Number(v).toLocaleString();
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const one = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------------------------------------------------------------- 問いを作る
  // まちがいの選択肢は、ほかの県の同じ種類から。答えの県の物と取り違えない物だけを使う：名前が答えの県の台帳に無い・紹介の言葉（keys）と
  // 答えの県が上位に入る品目の名前が重ならない・県の名前を含まない（含むと答えが分かる）・答えの県の境から25km以上離れている（県境の山や湖）
  const PN = M.P.map((p) => p.name);
  const hasPref = (s) => PN.some((nm) => s.includes(nm));
  let TOK = null;
  function tok() {
    if (TOK) return TOK;
    TOK = new Map(M.P.map((p) => [p.n, { names: new Set(), keys: new Set() }]));
    const add = (n, s) => { const t = TOK.get(n); if (t && s && s.length >= 2) t.names.add(s); };
    for (const it of IN.items) { add(it.pref, it.name); const t = TOK.get(it.pref); if (t) for (const k of it.keys || []) t.keys.add(k); }
    for (const s of IN.spots || []) add(s.pref, s.name);
    for (const y of IN.yama || []) add(y.pref, y.name);
    for (const d of IN.mame || []) if (d.eki) add(d.pref, d.eki);
    for (const c of (IN.spec && IN.spec.prefs) || []) add(c.pref, (c.capital || '').replace(/[市区]$/, ''));
    for (const c of IN.crops || []) for (const t of c.top) { const T = TOK.get(t.pref); if (T) for (const k of [c.name, ...(c.aliases || [])]) T.keys.add(k); }
    return TOK;
  }
  // 県の輪郭は荒い（広島で28点）。頂点だけでなく辺までの距離で測る（3点おきの頂点で測った時、県境から5kmの寂地山を通した）
  function nearBorder(n, x, z, km) {
    const jp = ((window.JAPAN && JAPAN.prefs) || []).find((p) => p.n === n);
    if (!jp) return false;
    for (const r of jp.ring) {
      for (let i = 0; i < r.length; i += 2) {
        const ax = r[i], az = r[i + 1], bx = r[(i + 2) % r.length], bz = r[(i + 3) % r.length], dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        if (Math.hypot(ax + dx * t - x, az + dz * t - z) < km) return true;
      }
    }
    return false;
  }
  // まちがいを3つ（2つは同じ地方から。似た物の方が考えがいがある）。紹介の言葉が重なる物どうしは並べない（マンゴーが2つ並んだ）
  function wrongs(pool, n, key, skip) {
    const seen = new Set(skip), words = new Set(), out = [];
    const near = shuffle(pool.filter((x) => regOf(x.pref) === regOf(n))), far = shuffle(pool.filter((x) => regOf(x.pref) !== regOf(n)));
    for (const x of [...near.slice(0, 2), ...far, ...near.slice(2)]) {
      const v = key(x);
      if (!v || seen.has(v) || (x.keys || []).some((k) => words.has(k))) continue;
      seen.add(v); out.push(x);
      for (const k of x.keys || []) words.add(k);
      if (out.length >= 3) break;
    }
    return out;
  }
  function four(right, ws, order) {
    const o = [right, ...ws];
    if (order) o.sort(order); else shuffle(o);
    return { opts: o, ans: o.indexOf(right) };
  }
  const T_ = (t) => ({ t });

  const capOf = (n) => ((IN.spec && IN.spec.prefs) || []).find((x) => x.pref === n);
  const office = (n) => ({ 都: '都庁', 道: '道庁', 府: '府庁' })[FULL(n).slice(-1)] || '県庁';
  function qCapital(n) {
    const c = capOf(n);
    if (!c || !c.capital) return [];
    const w = wrongs(IN.spec.prefs.filter((x) => x.pref !== n && /市$/.test(x.capital || '')), n, (x) => x.capital, [c.capital]);     // 東京の「新宿区」は、ほかの県の問いに出すと浮く
    if (w.length < 3) return [];
    const ken = (IN.spots || []).find((s) => s.pref === n && s.icon === 'kencho');
    return [Object.assign({ id: 'cap:' + n, lid: ken ? 'spot:' + ken.name : null, lv: 'easy', kind: office(n) + 'の所在地', text: `${FULL(n)}の${office(n)}所在地は？`,
      more: () => `${office(n)}所在地は${c.capital}。` + (ken && ken.note ? ken.note : '') }, four(T_(c.capital), w.map((x) => T_(x.capital))))];
  }
  const CATQ = { 特産: '特産', 食: '名物の食べ物', 名所: '名所', 歴史: 'ゆかりの歴史', 祭り: 'お祭り' };
  function qItems(n) {
    const mine = tok().get(n), out = [];
    for (const cat of Object.keys(CATQ)) {
      const pool = IN.items.filter((it) => it.cat === cat && it.pref !== n && !hasPref(it.name) && !mine.names.has(it.name)
        && !(it.keys || []).some((k) => mine.keys.has(k)) && !nearBorder(n, it.x, it.z, 25));
      for (const it of IN.items.filter((x) => x.pref === n && x.cat === cat && !hasPref(x.name))) {
        const w = wrongs(pool, n, (x) => x.name, [it.name]);
        if (w.length < 3) continue;
        out.push(Object.assign({ id: 'item:' + n + it.name, lid: 'item:' + n + it.name, lv: 'mid', kind: CATQ[cat], text: `${FULL(n)}の${CATQ[cat]}はどれ？`,
          more: () => (it.text ? it.text.slice(0, 2).join('') : '') }, four(T_(it.name), w.map((x) => T_(x.name)))));
      }
    }
    return out;
  }
  function qMonths(n) {
    const out = [];
    for (const it of IN.items.filter((x) => x.pref === n && x.cat === '祭り' && (x.months || []).length === 1 && !x.name.includes('月'))) {
      const m = it.months[0], far = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((k) => Math.min(Math.abs(k - m), 12 - Math.abs(k - m)) >= 2));
      out.push(Object.assign({ id: 'month:' + n + it.name, lid: 'item:' + n + it.name, lv: 'mid', kind: 'お祭りの月', text: `${FULL(n)}の「${it.name}」が行われるのは何月？`,
        more: () => [it.when, it.text && it.text[0]].filter(Boolean).join('　') }, four({ t: m + '月', m }, far.slice(0, 3).map((k) => ({ t: k + '月', m: k })), (a, b) => a.m - b.m)));
    }
    return out;
  }
  function qYama(n) {
    const cnt = new Map();
    for (const y of IN.yama || []) cnt.set(y.name, (cnt.get(y.name) || 0) + 1);
    const mine = tok().get(n), out = [];
    for (const kind of ['山', '湖']) {
      const pool = (IN.yama || []).filter((y) => y.kind === kind && y.pref !== n && cnt.get(y.name) === 1 && !mine.names.has(y.name) && !hasPref(y.name) && !nearBorder(n, y.x, y.z, 25));
      for (const y of (IN.yama || []).filter((x) => x.pref === n && x.kind === kind && cnt.get(x.name) === 1 && !hasPref(x.name))) {
        const w = wrongs(pool, n, (x) => x.name, [y.name]);
        if (w.length < 3) continue;
        out.push(Object.assign({ id: 'yama:' + n + y.name, lid: 'yama:' + n + y.name, lv: 'mid', kind, text: `${FULL(n)}にある${kind}は？`, more: () => y.note || '' },
          four(T_(y.name), w.map((x) => T_(x.name)))));
      }
    }
    return out;
  }
  function qSpots(n) {
    const mine = tok().get(n), out = [];
    const ok = (s) => s.mark && s.icon !== 'kencho' && !hasPref(s.name);
    const pool = (IN.spots || []).filter((s) => ok(s) && s.pref !== n && !mine.names.has(s.name) && !nearBorder(n, s.x, s.z, 25));
    for (const s of (IN.spots || []).filter((x) => x.pref === n && ok(x))) {
      const same = pool.filter((x) => x.icon === s.icon);
      let w = wrongs(same, n, (x) => x.name, [s.name]);
      if (w.length < 3) w = wrongs(pool, n, (x) => x.name, [s.name]);
      if (w.length < 3) continue;
      out.push(Object.assign({ id: 'spot:' + n + s.name, lid: 'spot:' + s.name, lv: 'mid', kind: '名所', text: `${FULL(n)}にあるのはどれ？`, more: () => s.note || '' },
        four(T_(s.name), w.map((x) => T_(x.name)))));
    }
    return out;
  }
  function qEn(n) {
    const E = (window.EN_DATA || []).filter((e) => !hasPref(e.name)), out = [];
    const others = E.filter((e) => !e.prefs.includes(n));
    for (const e of E.filter((x) => x.prefs.includes(n))) {
      const w = shuffle(others.slice()).slice(0, 3);
      if (w.length < 3) continue;
      out.push(Object.assign({ id: 'en:' + n + e.id, lv: 'mid', kind: '縁', text: `${FULL(n)}が入っている「縁」（昔の道や、日本三大〇〇など）はどれ？`,
        more: () => `${e.name}：${e.teaser}。${(e.lines || [])[0] || ''}` }, four(T_(e.name), w.map((x) => T_(x.name)))));
    }
    return out;
  }
  function qCrops(n) {
    const C = IN.crops || [], out = [];
    const notIn = C.filter((c) => !c.top.some((t) => t.pref === n));
    for (const c of C) {
      const r = c.top.findIndex((t) => t.pref === n);
      if (r < 0 || notIn.length < 3) continue;
      const w = shuffle(notIn.slice()).slice(0, 3), top = r === 0;
      out.push(Object.assign({ id: 'crop:' + n + c.name, lid: 'crop:' + c.name, lv: top ? 'hard' : 'mid', kind: '産地',
        text: top ? `${FULL(n)}が全国1位の品目は？` : `${FULL(n)}が全国${c.top.length}位までに入っている品目は？`,
        more: () => `${c.name}（${c.measure}・${c.year}）：` + c.top.map((t, i) => `${i + 1}位 ${FULL(t.pref)} ${fmt(t.value)}${t.unit}`).join('　') + `。出どころ：${c.survey}` },
      four(T_(c.name), w.map((x) => T_(x.name)))));
    }
    return out;
  }
  // 数の問い：ほかの県の値から、答えと（互いにも）はっきり離れた物を3つ。小さい順に並べる
  function qNums(n) {
    const S = (IN.spec && IN.spec.prefs) || [], me = S.find((x) => x.pref === n);
    if (!me) return [];
    const src = Object.values(IN.spec.sources || {}).map((s) => s && s.title).filter(Boolean).join('・');
    const all = () => `人口 ${fmt(me.population)}人・面積 ${fmt(me.area)}km²・市 ${me.cities}・町 ${me.towns}・村 ${me.villages}。` + (me.note ? me.note + '。' : '') + (src ? `出どころ：${src}` : '');
    const pop = (v) => (v >= 1e6 ? `約${fmt(Math.round(v / 1e5) * 10)}万人` : `約${Math.round(v / 1e4)}万人`);
    const area = (v) => `約${fmt(Math.round(v / 100) * 100)}km²`;
    const out = [];
    const make = (key, label, apart, text, kind) => {
      const v = me[key];
      if (typeof v !== 'number') return;
      const far = (a, b) => apart(a, b);
      const ws = [];
      for (const x of shuffle(S.filter((q) => q.pref !== n && typeof q[key] === 'number'))) {
        if (!far(x[key], v) || ws.some((y) => !far(y[key], x[key])) || label(x[key]) === label(v)) continue;
        ws.push(x);
        if (ws.length >= 3) break;
      }
      if (ws.length < 3) return;
      out.push(Object.assign({ id: kind + ':' + n, lv: 'hard', kind, text, more: all },
        four({ t: label(v), v }, ws.map((x) => ({ t: label(x[key]), v: x[key] })), (a, b) => a.v - b.v)));
    };
    const ratio = (r) => (a, b) => Math.max(a, b) / Math.min(a, b) >= r;
    make('population', pop, ratio(1.3), `${FULL(n)}の人口にいちばん近いのは？`, '人口');
    make('area', area, ratio(1.3), `${FULL(n)}の面積にいちばん近いのは？`, '面積');
    make('cities', (v) => `${v}市`, (a, b) => Math.abs(a - b) >= 3, `${FULL(n)}にある市の数は？`, '市の数');
    return out;
  }
  // 豆知識：まちがいは、ほかの県の豆知識のうち、その県の名前（紹介・目印・山と湖・駅・県庁所在地）を題に含む物だけ（よその話だと決まる）
  let ANCH = null;
  function qMame(n) {
    const T = tok(), mine = T.get(n), out = [];
    if (!ANCH) {
      ANCH = new Set();
      for (const d of IN.mame) { const t = T.get(d.pref); if (!d.eki && t) for (const s of t.names) if (d.title.includes(s)) { ANCH.add(d.id); break; } }
    }
    const touches = (title) => { for (const s of mine.names) if (title.includes(s)) return true; return false; };
    const pool = IN.mame.filter((d) => ANCH.has(d.id) && d.pref !== n && !hasPref(d.title) && !touches(d.title));
    for (const d of IN.mame.filter((x) => !x.eki && x.pref === n && !hasPref(x.title))) {
      const same = pool.filter((x) => x.cat === d.cat);
      let w = wrongs(same, n, (x) => x.title, [d.title]);
      if (w.length < 3) w = wrongs(pool, n, (x) => x.title, [d.title]);
      if (w.length < 3) continue;
      out.push(Object.assign({ id: 'mame:' + d.id, lid: 'mame:' + d.id, mame: d.id, lv: 'hard', kind: '豆知識', text: `${FULL(n)}の豆知識はどれ？`, more: () => d.text || '' },
        four(T_(d.title), w.map((x) => T_(x.title)))));
    }
    return out;
  }
  function qEki(n) {
    const mine = IN.mame.filter((d) => d.eki && d.pref === n), names = [...new Set(mine.map((d) => d.eki))], out = [];
    for (const d of mine) {
      if (d.title.includes(d.eki)) continue;
      const others = shuffle(names.filter((s) => s !== d.eki && !d.title.includes(s))).slice(0, 3);
      if (others.length < 3) continue;
      out.push(Object.assign({ id: 'eki:' + d.id, lid: 'mame:' + d.id, mame: d.id, lv: 'hard', kind: '駅の豆知識', text: `駅の豆知識「${d.title}」。この話の駅は？`, more: () => d.text || '' },
        four(T_(d.eki + '駅'), others.map((s) => T_(s + '駅')))));
    }
    return out;
  }
  // 県の形の問いは入れない（問いの県が地図の上に浮いていて、答えが見えた）
  const bank = (n) => [qCapital, qItems, qMonths, qYama, qSpots, qEn, qCrops, qNums, qMame, qEki].flatMap((f) => f(n));

  // ---------------------------------------------------------------- 記録（端末の中だけ）
  // 番付の名前：のせない人は「名無しさん」と4けたの番号（端末に覚える）。名前は1〜10字・制御文字なし・リンクや連絡先に見える物は不可
  const BAD = [[0, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x202a, 0x202e], [0x2066, 0x2069], [0xfeff, 0xfeff]];     // 制御文字・幅0・向きを変える字
  function nameErr(raw) {
    const s = String(raw || '').trim();
    if (!s) return '名前を入れてください。';
    if ([...s].length > 10) return '10字までにしてください。';
    if ([...s].some((ch) => { const c = ch.codePointAt(0); return BAD.some(([a, b]) => c >= a && c <= b); })) return '使えない文字が入っています。';
    if (/https?:|www\.|@|\.(com|jp|net)/i.test(s) || /\d{6,}/.test(s.replace(/[\s-]/g, ''))) return 'リンクや連絡先に見える名前は使えません。';
    if (/^名無しさん/.test(s)) return '「名無しさん」は、名前をのせない人の呼び名です。';
    return '';
  }
  // 端末の番号：番付の受け口が「同じ人の点」をまとめ、番付で自分の段に印を付けるためのくじ（人を表す物ではない）
  const rid = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  function load() {
    const o = { prof: null, best: [] };
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === 'object') {
        if (s.prof && /^\d{4}$/.test(s.prof.anon || '')) o.prof = { anon: s.prof.anon, name: typeof s.prof.name === 'string' && !nameErr(s.prof.name) ? s.prof.name.trim() : null,
          device: /^[0-9a-f]{32}$/.test(s.prof.device || '') ? s.prof.device : rid() };
        if (Array.isArray(s.best)) o.best = s.best.filter((r) => r && Number.isFinite(r.score) && Number.isFinite(r.t) && typeof r.name === 'string' && typeof r.title === 'string').slice(0, 10);
      }
    } catch (e) { /* 読めない時は始め直す */ }
    return o;
  }
  const L = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(L)); return true; } catch (e) { return false; } }
  const shown = () => (L.prof && L.prof.name) || `名無しさん${L.prof ? L.prof.anon : ''}`;

  // ---------------------------------------------------------------- みんなの番付の受け口（番付/受け口.js を Cloudflare に置いた住所）
  // 住所が空の間は練習だけ（この端末の記録）。検査だけは ?sugoapi= で手元の受け口（127.0.0.1）に向けられる
  const API_URL = 'https://deai-banzuke.ai-naiseika.workers.dev';
  const API = (() => {
    const t = /[?&]sugoapi=([^&]+)/.exec(location.search), u = t ? decodeURIComponent(t[1]) : '';
    return /^http:\/\/127\.0\.0\.1:\d+$/.test(u) ? u : API_URL;
  })();
  // 字だけで送る（Content-Type が text/plain なら、ブラウザは前もっての問い合わせ〔preflight〕をしない）
  async function call(path, body) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 12000);
    try {
      const r = await fetch(API + path, body ? { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' }, signal: ac.signal } : { signal: ac.signal });
      const j = await r.json();
      return j && typeof j === 'object' ? j : { err: 'server' };
    } catch (e) { return { err: 'net' }; } finally { clearTimeout(t); }
  }
  const ERR = {
    limit: (r) => `今日の番付への挑戦は${r.limit || 5}回までです。練習なら何度でも遊べます。`,
    old: () => '番付の問いを新しくしているところです。少しあとで開き直してください。練習なら今すぐ遊べます。',
    name: () => 'その名前は番付にのせられません。名前を変えてください。',
    ng: () => 'その名前は番付にのせられません。名前を変えてください。',
    game: () => 'この回の記録が受け口で見つかりませんでした。はじめからどうぞ。',
    net: () => '番付の受け口につながりませんでした。電波を確かめて、もう一度どうぞ。',
  };
  const errText = (r) => (ERR[r.err] || (() => '番付の受け口で問題が起きました。もう一度どうぞ。'))(r);
  function errView(r, retry) {
    head(false);
    box.appendChild(el('p', 'q', errText(r)));
    if (retry && !['limit', 'old', 'name', 'ng', 'game'].includes(r.err)) { const b = el('button', 'big', 'もう一度'); b.addEventListener('click', retry); box.appendChild(b); }
    if (r.err === 'name' || r.err === 'ng') { const b = el('button', 'big', '名前を変える'); b.addEventListener('click', nameView); box.appendChild(b); }
    const p = el('button', 'big sub', '練習する（番付にはのりません）');
    p.addEventListener('click', () => begin(false));
    box.appendChild(p);
  }

  // ---------------------------------------------------------------- 画面
  const box = el('div');
  box.id = 'sugo'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'すごろく10回チャレンジ');
  document.body.appendChild(box);
  // 下の並びの「すごろく」（2026-11-11）：遊んでいる途中に押しても閉じない（番付の挑戦は始めた時に1日5回のうち1回と数える）
  const ico = document.getElementById('sugo-open');
  if (ico) ico.addEventListener('click', () => { if (!box.classList.contains('open')) open(); else if (!G || G.over) stop(); });
  let G = null;    // { route: [{ n, ok }], round, pref, step, B, used, kinds, kc, q, next, done, bonus, bonusLeft, know, okN, qn, km, spinning, over }

  function head(stat) {
    box.textContent = '';
    const h = el('div', 'head'), x = el('button', 'x', '×');
    x.setAttribute('aria-label', 'やめる'); x.addEventListener('click', () => stop());
    h.append(el('b', null, 'すごろく10回チャレンジ！'), x);
    box.appendChild(h);
    if (stat && G) {
      const st = el('div', 'stat');
      st.append(el('span', null, `${Math.min(G.round + 1, ROUNDS)} / ${ROUNDS}県目`), el('span', null, `知識 ${G.know}点`), el('span', null, `旅 ${fmt(Math.round(G.km))}km`));
      box.appendChild(st);
    }
  }
  function open() {
    if (window.QUIZ) QUIZ.stop();
    stop(true);
    box.classList.add('open');
    if (ico) ico.classList.add('on');
    if (L.prof) menu(); else nameView();
  }
  function menu() {
    head(false);
    const lead = el('div', 'lead');
    for (const t of ['ルーレットで選ばれた10の都道府県を旅します。', '県ごとに3〜4択の問い。正解すると、同じ県でつづけて次の問い（3問まで）。1問10点・むずかしい問いは＋10点・ボーナス問題は2倍。',
      '1問目に正解した県を、県庁どうしの直線で結んだ「旅の距離」も、50kmごとに1点。1問目をまちがえると、そこで線が切れます。']) lead.appendChild(el('p', null, t));
    const nm = el('div', 'namerow'), ch = el('button', 'small', '変える');
    ch.addEventListener('click', nameView);
    nm.append(el('span', null, '番付の名前：'), el('b', null, shown()), ch);
    box.append(lead, nm);
    if (API) {
      const go = el('button', 'big', '番付に挑戦する（1日5回まで）'), pr = el('button', 'big sub', '練習する（番付にはのりません）');
      go.addEventListener('click', () => begin(true)); pr.addEventListener('click', () => begin(false));
      box.append(go, pr);
    } else {
      const go = el('button', 'big', 'はじめる');
      go.addEventListener('click', () => begin(false));
      box.append(go);
    }
    const rk = el('button', 'big sub', '番付を見る');
    rk.addEventListener('click', rankView);
    box.append(rk);
  }
  function nameView() {
    if (!L.prof) { L.prof = { anon: String(1 + Math.floor(Math.random() * 9999)).padStart(4, '0'), name: null, device: rid() }; save(); }
    head(false);
    const inp = el('input');
    inp.type = 'text'; inp.maxLength = 20; inp.value = L.prof.name || ''; inp.placeholder = '例：まつぼっくり'; inp.setAttribute('aria-label', '番付の名前'); inp.autocomplete = 'off';
    const msg = el('p', 'err'), yes = el('button', 'big', 'この名前でのせる'), no = el('button', 'big sub', `名前をのせない（名無しさん${L.prof.anon}）`);
    yes.addEventListener('click', () => { const e = nameErr(inp.value); if (e) { msg.textContent = e; return; } L.prof.name = inp.value.trim(); save(); menu(); });
    no.addEventListener('click', () => { L.prof.name = null; save(); menu(); });
    box.append(el('p', 'q', '番付に名前をのせますか？'),
      el('p', 'lead', `のせない時は「名無しさん${L.prof.anon}」として並びます。本名・学校名・SNSのIDは入れないでください（10字まで）。`),
      inp, msg, yes, no, el('p', 'note', API ? 'みんなの番付には、名前・点・称号・日付がのり、誰でも見られます。' : 'みんなの番付は準備中です。いまは、この端末の中にだけ残ります。'));
  }
  // 番付：みんなの番付（上位10人・押すと100位まで。自分の段に印）と、この端末の記録
  function rankView() {
    head(false);
    box.append(el('p', 'q', '番付'), el('b', 'sec', 'みんなの番付'));
    const all = el('div', 'board');
    box.appendChild(all);
    if (!API) all.appendChild(el('p', 'note', '準備中です。点数を受け取る場所ができたら、ここに上位の人が並びます。'));
    else {
      all.appendChild(el('p', 'note', '読み込んでいます…'));
      const me = G;
      call('/board?d=' + (L.prof ? L.prof.device : ''), null).then((r) => {
        if (G !== me || !all.isConnected) return;
        all.textContent = '';
        if (r.err) { all.appendChild(el('p', 'note', errText(r))); return; }
        all.appendChild(el('p', 'note', r.me ? `あなたは ${r.players}人中 ${r.me.rank}位（ベスト ${r.me.score}点）` : `${r.players}人がのっています。番付に挑戦すると、あなたの位置が出ます。`));
        const ol = el('ol', 'best top');
        r.top.forEach((x, i) => {
          const li = el('li', x.me ? 'me' : (i >= 10 ? 'more' : ''));
          if (x.me && i >= 10) li.classList.add('more');
          const d = new Date(x.t);
          li.append(el('b', null, `${x.score}点`), el('span', null, ` ${x.title}・${x.name}・${d.getMonth() + 1}/${d.getDate()}`));
          if (x.me) li.appendChild(el('span', 'tagme', ' あなた'));
          ol.appendChild(li);
        });
        all.appendChild(ol);
        if (r.top.length > 10) {
          const mo = el('button', 'small', `${r.top.length}位まで見る`);
          mo.addEventListener('click', () => { ol.classList.add('open'); mo.remove(); });
          all.appendChild(mo);
        }
      });
    }
    box.appendChild(el('b', 'sec', 'あなたの記録（この端末）'));
    if (!L.best.length) box.appendChild(el('p', 'note', 'まだありません。'));
    else {
      const ol = el('ol', 'best');
      for (const r of L.best) {
        const d = new Date(r.t), li = el('li');
        li.append(el('b', null, `${r.score}点`), el('span', null, ` ${r.title}・${r.name}・${d.getMonth() + 1}/${d.getDate()}`));
        ol.appendChild(li);
      }
      box.appendChild(ol);
    }
    const back = el('button', 'big sub', '‹ もどる');
    back.addEventListener('click', menu);
    box.appendChild(back);
  }

  // ---------------------------------------------------------------- 遊ぶ
  // remote＝番付に挑戦（県・問い・採点は受け口が決める）。練習はこの端末の中だけで決める
  function begin(remote) {
    const go = async () => {
      if (M.sel >= 0) M.back();
      G = { route: [], round: 0, pref: 0, step: 0, used: new Set(), kc: {}, know: 0, okN: 0, qn: 0, km: 0, bonusLeft: BONUS, remote: !!(remote && API) };
      if (G.remote) {
        const me = G;
        head(false);
        box.appendChild(el('p', 'note', '番付の受け口につないでいます…'));
        const r = await call('/start', { device: L.prof.device, name: L.prof.name, anon: L.prof.anon, ver: IN.ver });
        if (G !== me) return;
        if (r.err) { G = null; errView(r, () => begin(true)); return; }
        G.game = r.game;
      }
      layer.classList.add('on');
      spinView(false);
    };
    if (M.inside) M.leave(go); else go();
  }
  function spinView(auto) {
    head(true);
    const wheel = el('div', 'wheel', '？'), btn = el('button', 'big go', 'ルーレットをまわす');
    btn.addEventListener('click', () => spin(wheel, btn));
    box.append(el('p', 'q', G.round ? `${G.round + 1}県目へ` : 'どこへ旅するかは、ルーレットしだい'), wheel, btn);
    routeList();
    if (auto) spin(wheel, btn);
  }
  function spin(wheel, btn) {
    if (!G || G.spinning) return;
    G.spinning = true; btn.disabled = true;
    const left = M.P.map((p) => p.n).filter((n) => !G.route.some((r) => r.n === n)), me = G;
    // 番付の挑戦では、止まる県を受け口が決める（回っている間に聞く）。練習はここでくじを引く
    let got = G.remote ? null : { pref: one(left) };
    if (G.remote) call('/spin', { game: G.game }).then((r) => { got = r; });
    else M.loadIntro(got.pref).catch(() => {});        // 答えの後に出す説明（県ごとのファイル）を、回っている間に読んでおく
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = performance.now(), T = calm ? 0 : 1500;
    const tick = () => {
      if (G !== me) return;
      const t = performance.now() - t0;
      if (t >= T && got) {
        if (got.err) { G.spinning = false; errView(got, () => spinView(true)); return; }
        const n = got.pref;
        if (G.remote) { G.rq = got; M.loadIntro(n).catch(() => {}); }
        wheel.textContent = FULL(n); wheel.classList.add('hit');
        setTimeout(() => { if (G === me) arrive(n); }, calm ? 150 : 600);
        return;
      }
      wheel.textContent = FULL(one(left));
      setTimeout(tick, 50 + 260 * Math.min(1, t / Math.max(T, 1)) ** 2);
    };
    tick();
  }
  function arrive(n) {
    G.spinning = false; G.pref = n; G.step = 0; G.B = bank(n); G.kinds = new Set(); G.next = null;
    ask();
  }
  // 受け口が選んだ問いを、この県の問いから名前で探す（まちがいの選択肢はくじなので、見つからない回は作り直す）
  function byId(id) {
    for (let k = 0; k < 4; k++) {
      const q = G.B.find((x) => x.id === id);
      if (q) return q;
      G.B = bank(G.pref);
    }
    return null;
  }
  // 段ごとの難しさ（1問目はやさしい・ふつう、2問目はふつう、3問目はむずかしい）。無ければ近い段から。
  // 種類は、この10県でまだ少ない物から（同じ種類の問いが続かないように）
  const WANT = [['easy', 'mid'], ['mid'], ['hard']], ALT = [['hard'], ['hard', 'easy'], ['mid', 'easy']];
  function pickQ(step) {
    const fresh = G.B.filter((q) => !G.used.has(q.id));
    for (const lvs of [WANT[step], ALT[step]]) {
      let c = fresh.filter((q) => lvs.includes(q.lv) && !G.kinds.has(q.kind));
      if (!c.length) c = fresh.filter((q) => lvs.includes(q.lv));
      if (!c.length) continue;
      const kinds = [...new Set(c.map((q) => q.kind))], low = Math.min(...kinds.map((k) => G.kc[k] || 0));
      const k = one(kinds.filter((x) => (G.kc[x] || 0) === low));
      return one(c.filter((q) => q.kind === k));
    }
    return null;
  }
  function ask() {
    let q;
    if (G.remote) {
      q = byId(G.rq.q);
      if (!q) { errView({ err: 'old' }); return; }
      G.bonus = !!G.rq.bonus;
    } else {
      q = G.next || pickQ(G.step);
      if (q) { G.bonus = G.bonusLeft > 0 && Math.random() < 0.18; if (G.bonus) G.bonusLeft--; }
    }
    G.next = null;
    if (!q) { endPref(); return; }
    G.used.add(q.id); G.kinds.add(q.kind); G.kc[q.kind] = (G.kc[q.kind] || 0) + 1;
    G.q = q; G.done = false;
    head(true);
    const tag = el('div', 'tag');
    tag.append(el('b', 'pref', FULL(G.pref)), el('span', 'lv ' + q.lv, LV[q.lv]), el('span', 'kind', q.kind));
    if (G.step) tag.appendChild(el('span', 'chain', `つづけて${G.step + 1}問目`));
    box.appendChild(tag);
    if (G.bonus) box.appendChild(el('p', 'bonus', 'ボーナス問題！ 正解で点が2倍'));
    box.appendChild(el('p', 'q', q.text));
    const g = el('div', 'ch');
    q.opts.forEach((o, i) => {
      const b = el('button', null, o.t);
      b.dataset.i = i;
      b.addEventListener('click', () => answer(i));
      g.appendChild(b);
    });
    box.appendChild(g);
    routeList();
    box.scrollTop = 0;
    visit(G.pref);
  }
  // 答える：練習はこの端末で採点、番付の挑戦は選んだ答えの字を受け口へ送り、採点と次の問いを受け取る
  function answer(i) {
    if (!G || G.done || !G.q) return;
    G.done = true;
    const q = G.q;
    for (const b of box.querySelectorAll('.ch button')) b.disabled = true;
    if (!G.remote) {
      const ok = i === q.ans, pts = ok ? (10 + (q.lv === 'hard' ? 10 : 0)) * (G.bonus ? 2 : 1) : 0;
      G.know += pts;
      if (G.step === 0) { G.route.push({ n: G.pref, ok }); G.km = routeKm(); }
      settle(i, ok, pts, q.ans, ok && G.step < CHAIN - 1 ? pickQ(G.step + 1) : null);
      return;
    }
    const me = G, sent = { game: G.game, q: q.id, a: q.opts[i].t };
    const send = () => {
      const old = box.querySelector('.res.wait');
      if (old) old.remove();
      call('/answer', sent).then((r) => {
        if (G !== me) return;
        if (r.err) {
          if (r.err !== 'net' && r.err !== 'server') { errView(r); return; }
          const w = el('div', 'res wait'), b = el('button', 'big', 'もう一度送る');
          b.addEventListener('click', send);
          w.append(el('p', 'note', errText(r)), b);
          box.appendChild(w);
          return;
        }
        G.know = r.know; G.km = r.km;
        if (G.step === 0) G.route.push({ n: G.pref, ok: r.ok });
        const ri = q.opts.findIndex((o) => o.t === r.right);
        let nq = null;
        if (r.next) { G.rq = r.next; nq = byId(r.next.q); if (!nq) { errView({ err: 'old' }); return; } }
        settle(i, r.ok, r.pts, ri >= 0 ? ri : q.ans, nq);
      });
    };
    send();
  }
  function settle(i, ok, pts, ri, next) {
    const q = G.q;
    G.qn++;
    if (ok) G.okN++;
    for (const b of box.querySelectorAll('.ch button')) {
      const k = +b.dataset.i;
      b.classList.toggle('good', k === ri); b.classList.toggle('bad', k === i && !ok);
    }
    const st = box.querySelector('.stat');
    if (st) { st.children[1].textContent = `知識 ${G.know}点`; st.children[2].textContent = `旅 ${fmt(Math.round(G.km))}km`; }
    const res = el('div', 'res ' + (ok ? 'ok' : 'ng')), right = q.opts[ri];
    res.appendChild(el('b', null, ok ? `正解！ +${pts}点` + (q.lv === 'hard' ? '（むずかしい問いの＋10点つき）' : '') : `ざんねん。正解は「${right.t}」`));
    const more = el('p', 'more', q.more() || '説明を読み込んでいます…');
    if (!q.more()) M.loadIntro(G.pref).then(() => { more.textContent = q.more() || ''; }, () => { more.textContent = '説明を読めませんでした（通信を確かめてください）'; });
    res.appendChild(more);
    if (G.step === 0 && !ok) res.appendChild(el('p', 'cut', '1問目をまちがえたので、旅の線はこの県で切れます。'));
    if (q.mame && window.MAME) MAME.record(q.mame);
    if (q.lid) dispatchEvent(new CustomEvent('deai', { detail: { id: q.lid, pref: G.pref } }));     // であい帖へ（答えの説明を読むので、知った物に数える）
    G.next = next;
    const nx = el('button', 'big next', G.next ? `つづけて${prefOf(G.pref).name}の問い（${LV[G.next.lv]}）›` : G.round + 1 >= ROUNDS ? '結果を見る ›' : 'ルーレットをまわす ›');
    nx.addEventListener('click', () => { if (G.next) { G.step++; ask(); } else endPref(); });
    res.appendChild(nx);
    box.appendChild(res);
    routeList();
    visit(G.pref);
    res.scrollIntoView({ block: 'nearest' });
  }
  function endPref() {
    G.round++; G.step = 0; G.next = null;
    if (G.round >= ROUNDS) finish(); else spinView(true);
  }
  // 旅の距離：1問目に正解した県が続く所だけ、県庁どうしの大円の距離を足す（外した県で線が切れる）
  function hav(a, b) {
    const r = Math.PI / 180, h = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  function routeKm() {
    let km = 0;
    for (let i = 1; i < G.route.length; i++) {
      const a = G.route[i - 1], b = G.route[i];
      if (a.ok && b.ok) km += hav(D.kencho[a.n], D.kencho[b.n]);
    }
    return km;
  }
  function routeList() {
    const old = box.querySelector('.route');
    if (old) old.remove();
    if (!G || !G.route.length) return;
    const p = el('p', 'route');
    p.appendChild(el('span', null, '旅：'));
    G.route.forEach((r, i) => {
      if (i) p.appendChild(el('span', 'sep', G.route[i - 1].ok && r.ok ? ' ─ ' : ' ／ '));
      p.appendChild(el('span', r.ok ? 'ok' : 'ng', prefOf(r.n).name));
    });
    box.appendChild(p);
  }
  function finish() {
    if (G.remote && !G.fin) {
      const me = G;
      head(false);
      box.appendChild(el('p', 'note', '番付に記録しています…'));
      const send = () => call('/finish', { game: G.game }).then((r) => {
        if (G !== me) return;
        if (r.err) { errView(r, send); return; }
        G.fin = r; finish();
      });
      send();
      return;
    }
    const f = G.fin, dist = f ? f.dist : Math.floor(G.km / KM_PT), total = f ? f.score : G.know + dist, title = f ? f.title : titleOf(total);
    const rec = { score: total, know: G.know, km: f ? f.km : Math.round(G.km), ok: G.okN, n: G.qn, title, name: shown(), t: Date.now() };
    L.best.push(rec);
    L.best.sort((a, b) => b.score - a.score || a.t - b.t);
    L.best = L.best.slice(0, 10);
    const kept = save(), rank = L.best.indexOf(rec);
    G.over = true; G.pref = 0;
    head(false);
    const ul = el('ul', 'sum');
    ul.append(el('li', null, `知識：${G.know}点（${G.qn}問のうち${G.okN}問正解）`), el('li', null, `旅の距離：${fmt(rec.km)}km → ${dist}点（50kmごとに1点）`));
    box.append(el('p', 'big', `${total}点`), el('p', 'title', `称号：${title}`), ul);
    routeList();
    if (f) box.appendChild(el('p', 'note', f.better ? `みんなの番付に記録しました：${f.players}人中 ${f.rank}位（名前：${rec.name}）`
      : `みんなの番付のあなたのベストは ${f.best}点（${f.players}人中 ${f.rank}位）。今回はベストを超えませんでした。`));
    else if (rank >= 0) box.appendChild(el('p', 'note', `あなたの記録の${rank + 1}位に入りました（練習は、みんなの番付にはのりません）`));
    const row = el('div', 'row'), again = el('button', 'big', 'もう一度'), rk = el('button', 'big sub', '番付を見る'), was = G.remote;
    again.addEventListener('click', () => begin(was)); rk.addEventListener('click', rankView);
    row.append(again, rk);
    box.append(row, el('p', 'note', !kept ? 'この画面では記録を残せません（プライベートモードなど）' : f ? 'この端末にも記録を残します。' : API ? '記録はこの端末の中だけに残します。' : '記録はこの端末の中だけに残します（みんなの番付は準備中）'));
    M.tourLift(-1);
    M.view(Object.assign({}, M.HOME));
  }
  function stop(quiet) {
    if (G) { M.tourLift(-1); if (!quiet) M.view(Object.assign({}, M.HOME)); }
    G = null;
    layer.classList.remove('on');
    box.classList.remove('open');
    if (ico) ico.classList.remove('on');
  }

  // ---------------------------------------------------------------- 県へ寄る：浮かせた県が、札を除いた空いた所に収まる眺めへ（スマホは札が下・パソコンは左）
  function visit(n) {
    const p = prefOf(n), f = p.frame, W = M.vw, H = M.vh, c = box.getBoundingClientRect(), Lf = M.LIFT;
    const pts = [[f[0], f[1], Lf], [f[2], f[1], Lf], [f[0], f[3], Lf], [f[2], f[3], Lf]];
    const side = c.width > 0 && c.right < W * 0.5;
    const area = side ? [(c.right + 16) / W * 2 - 1, 0.92, -0.75, 0.72] : [-0.9, 0.9, c.width > 0 ? 1 - (c.top - 16) / H * 2 : -0.6, 0.72];
    M.tourLift(p.k);
    M.view(M.fit(M.HOME.th, 0.62, pts, area));
  }

  // ---------------------------------------------------------------- 地図に重ねる旅の線（1問目に正解した県の県庁を結ぶ）とこま
  const layer = svg('svg', { id: 'sugo-line', 'aria-hidden': 'true' });
  const halo = svg('path', { class: 'halo' }), road = svg('path', { class: 'road' }), dots = svg('g'), koma = svg('g', { class: 'koma' });
  koma.innerHTML = '<path d="M0 0C-6-8-9-13-9-18a9 9 0 0 1 18 0c0 5-3 10-9 18z" fill="#c8402c" stroke="#fffaf0" stroke-width="2"/><circle cy="-18" r="3.4" fill="#fffaf0"/>';
  layer.append(halo, road, dots, koma);
  // 地図の札と下の並びより下に（上に重ねると、線が県名の札やボタンの字を横切った）
  const under = document.getElementById('labels');
  if (under) under.before(layer); else document.body.appendChild(layer);
  const CAP = new Map((IN.spots || []).filter((s) => s.icon === 'kencho').map((s) => [s.pref, s]));
  const GY = new Map();
  function capPt(n) {
    const s = CAP.get(n), p = prefOf(n);
    if (!s || !p) return null;
    if (!GY.has(n)) GY.set(n, M.groundY(p.k, s.x, s.z));
    return M.project(s.x, GY.get(n) + M.liftY(p.k), s.z);
  }
  M.on('frame', () => {
    if (!G || M.inside) return;
    const strands = [[]], marks = [];
    for (const r of G.route) {
      const s = capPt(r.n), on = s && s.ok;
      if (!r.ok) { if (strands[strands.length - 1].length) strands.push([]); }
      else if (on) strands[strands.length - 1].push(s);
      marks.push(on ? [s.x, s.y, r.ok] : null);
    }
    const d = strands.filter((a) => a.length > 1).map((a) => 'M' + a.map((s) => s.x.toFixed(1) + ' ' + s.y.toFixed(1)).join('L')).join('');
    halo.setAttribute('d', d); road.setAttribute('d', d);
    while (dots.children.length < marks.length) dots.appendChild(svg('circle', { r: 5 }));
    [...dots.children].forEach((c, i) => {
      const m = marks[i];
      if (!m) { c.style.display = 'none'; return; }
      c.style.display = ''; c.setAttribute('cx', m[0].toFixed(1)); c.setAttribute('cy', m[1].toFixed(1)); c.setAttribute('class', m[2] ? 'ok' : 'ng');
    });
    const s = G.pref ? capPt(G.pref) : null;
    if (s && s.ok) { koma.style.display = ''; koma.setAttribute('transform', `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`); } else koma.style.display = 'none';
  });
  M.on('world', (w) => { if (w && G) stop(true); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && box.classList.contains('open') && !e.target.closest('input')) { stop(); e.stopImmediatePropagation(); } }, true);

  // 検査用：問いの台帳（県ごと）・遊びの状態
  window.SUGO = { open, stop, bank, titleOf, nameErr, answer, get playing() { return !!(G && !G.over); },get prof() { return L.prof && Object.assign({ shown: shown() }, L.prof); }, get best() { return L.best; },
    get state() { return G && { round: G.round, pref: G.pref, step: G.step, know: G.know, km: G.km, route: G.route.map((r) => Object.assign({}, r)), q: G.q && { id: G.q.id, lv: G.q.lv, kind: G.q.kind, ans: G.q.ans, n: G.q.opts.length }, done: G.done, next: !!G.next, over: !!G.over, spinning: !!G.spinning, remote: !!G.remote, fin: G.fin || null }; }, get api() { return API; } };
})();
