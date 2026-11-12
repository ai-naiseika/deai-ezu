// クイズ（本人 2026-10-30「1日1問に加えて、遊びたい人は『クイズモード』で次々問題を出して楽しめる。10問1クールで点数」「そのログも取って楽しめるように」）：
// 問題は確かめ済みの台帳（紹介.js の品目・全国遊覧・紹介・豆知識・目印・山と湖）から作る。全国では答えは4択か、地図の県を押す。
// 県の中では、その県のことを4択で問う（すごろくの問いの作り方。本人 2026-11-11「全国を見ているときは全国から、県内を見ているときは県内の情報から」）。
// どちらも、まだ知らない物（豆知識帳・であい帖に無い物）から出し、豆知識を多めに混ぜる。答えると説明を出し、合っていても違っていても
// 豆知識なら豆知識帳、ほかはであい帖に入る。記録（今日の一問・1クールの点数・まちがえた問題・ジャンル別）は端末の中だけ。字は全部 textContent
(function () {
  'use strict';
  const M = window.MAP3D, IN = window.INTRO;
  if (!M || !IN) return;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const R = (e, s) => (window.RUBY ? RUBY.text(e, s) : ((e.textContent = s), e));     // ふりがな（ふりがな.js。無い時は字だけ）
  const KEY = 'zenkoku3d-quiz-v1', ROUND = 10, LIMIT = 15;    // 1クールの問題数・速さの点を数える秒
  const box = $('#quiz'), open = $('#quiz-open');
  const name = (no) => { const p = M.P.find((q) => q.n === no); return p ? M.FULL(p.name) : '?'; };
  const kOf = (no) => M.P.findIndex((q) => q.n === no);
  // 地方（まちがえる候補を、近くの県から選ぶため）
  const REG = [[1, 7], [8, 14], [15, 23], [24, 30], [31, 35], [36, 39], [40, 47]];
  const regOf = (no) => REG.findIndex(([a, b]) => no >= a && no <= b);

  // ---------------------------------------------------------------- 問題を作る
  const fmt = (v) => Number(v).toLocaleString();
  function pool() {
    const out = [], add = (q) => { if (!q.text.includes(M.P[kOf(q.ans)] && M.P[kOf(q.ans)].name)) out.push(q); };   // 問いの文に答えの県名が入る物は出さない
    for (const c of IN.crops || []) {
      if (!c.top || c.top.length < 4) continue;
      const t = c.top;
      add({ id: 'crop:' + c.name, cat: '産地', ans: t[0].pref, near: t.slice(1, 4).map((x) => x.pref),
        text: `「${c.name}」の${c.measure}がいちばん多い都道府県は？（${c.year}）`,
        more: () => t.slice(0, 3).map((x, i) => `${i + 1}位 ${name(x.pref)} ${fmt(x.value)}${x.unit}（全国の${x.share}%）`).join('　') + `。出どころ：${c.survey}` });
    }
    for (const t of IN.tour || []) add({ id: 'tour:' + t.pref, cat: '旅', ans: t.pref, text: `「${t.catch}」—— どこの都道府県？`, more: () => t.text.join(' ') });
    for (const it of IN.items || []) add({ id: 'item:' + it.pref + it.name, cat: it.cat, ans: it.pref, text: `${it.cat}「${it.name}」で知られるのは？`, more: () => it.text && it.text[0] });
    for (const d of IN.mame || []) add({ id: 'mame:' + d.id, cat: '豆知識', ans: d.pref, mame: d.id,
      text: d.eki ? `「${d.eki}駅」の豆知識「${d.title}」。この駅があるのは？` : `豆知識「${d.title}」はどこの話？`, more: () => d.text });
    for (const s of IN.spots || []) if (s.mark) add({ id: 'spot:' + s.name, cat: '名所', ans: s.pref, text: `「${s.name}」があるのは？`, more: () => s.note });   // 印は一言のある名所にだけ付く
    for (const y of IN.yama || []) add({ id: 'yama:' + y.pref + y.name, cat: y.kind, ans: y.pref, text: `${y.kind}「${y.name}」があるのは？`, more: () => y.note });
    return out;
  }
  let POOL = null;
  const all = () => POOL || (POOL = pool());
  // まだ知らない物から出す（本人 2026-11-11「クイズはできるだけ知らないところから出題されて、間違ってもあってても詳細を見ればそのまま豆知識ゲット」）：
  // 豆知識は豆知識帳、ほかはであい帖の「知った物」で見る。どれも知っていれば、知っている物から
  const knownQ = (q) => (q.mame ? !!(window.MAME && MAME.has(q.mame)) : !!(window.DEAI && DEAI.knows(q.lid || q.id)));
  const pickUnknown = (c, r) => { const u = c.filter((q) => !knownQ(q)), from = u.length ? u : c; return from[Math.floor(r() * from.length)]; };
  // 県の中では、その県のことを問う（本人「全国を見ているときは全国から、県内を見ているときは県内の情報から」）。
  // 問いは、すごろくの確かめ済みの作り方（まちがいの選択肢はよその県の同じ種類から・答えの県の物と取り違えない）を使う
  const prefNow = () => (M.inside && window.SUGO && M.P.find((p) => p.name === M.inside.name)) || null;
  function prefList(n, r) {
    const byKind = new Map();
    for (const q of SUGO.bank(n)) { if (!byKind.has(q.kind)) byKind.set(q.kind, []); byKind.get(q.kind).push(q); }
    const kinds = [...byKind.keys()].sort(() => r() - 0.5), used = new Set(), out = [];
    for (let i = 0; out.length < ROUND && i < 300; i++) {
      const k = i % 3 === 0 && byKind.has('豆知識') ? '豆知識' : kinds[i % kinds.length];     // 豆知識は多めに（3問に1問）
      const c = byKind.get(k).filter((q) => !used.has(q.lid || q.id));
      if (!c.length) continue;
      const q = pickUnknown(c, r);
      used.add(q.lid || q.id);
      out.push(Object.assign({}, q, { cat: q.kind, pref: n }));
    }
    return out;
  }
  const unknownMame = (n) => (IN.mame || []).filter((d) => (n == null || d.pref === n) && !(window.MAME && MAME.has(d.id))).length;
  // かたち当て（ゲームの案.md の「空から見て県を当てる」の軽い形・2026-11-09）：県の形だけを見せて4択。形は全国の形のデータ（JAPAN.prefs の輪）から、
  // いちばん大きな塊と、その近くの島だけを描く（東京の小笠原・沖縄の先島のような遠い島まで入れると、形が点のように小さくなる）
  const tourOf = (no) => (IN.tour || []).find((t) => t.pref === no);
  const shapeQ = (no) => ({ id: 'shape:' + no, cat: 'かたち', ans: no, shape: no, text: 'この形の都道府県は？', more: () => { const t = tourOf(no); return t ? t.catch : ''; } });
  function shapeEl(no) {
    const jp = ((window.JAPAN && JAPAN.prefs) || []).find((p) => p.n === no);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'shape'); svg.setAttribute('aria-label', '都道府県の形');
    if (!jp) return svg;
    const rings = jp.ring.map((r) => {
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, a = 0;
      for (let i = 0; i < r.length; i += 2) {
        x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]);
        const j = (i + 2) % r.length; a += r[i] * r[j + 1] - r[j] * r[i + 1];
      }
      return { r, b: [x0, z0, x1, z1], a: Math.abs(a) / 2 };
    });
    const big = rings.reduce((m, q) => (q.a > m.a ? q : m)), s = Math.max(big.b[2] - big.b[0], big.b[3] - big.b[1]);
    const cx = (big.b[0] + big.b[2]) / 2, cz = (big.b[1] + big.b[3]) / 2;
    const keep = rings.filter((q) => Math.hypot((q.b[0] + q.b[2]) / 2 - cx, (q.b[1] + q.b[3]) / 2 - cz) < s * 0.9);
    const b = keep.reduce((m, q) => [Math.min(m[0], q.b[0]), Math.min(m[1], q.b[1]), Math.max(m[2], q.b[2]), Math.max(m[3], q.b[3])], [1e9, 1e9, -1e9, -1e9]);
    const pad = Math.max(b[2] - b[0], b[3] - b[1]) * 0.06;
    svg.setAttribute('viewBox', [b[0] - pad, b[1] - pad, b[2] - b[0] + pad * 2, b[3] - b[1] + pad * 2].map((v) => v.toFixed(1)).join(' '));
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', keep.map((q) => 'M' + q.r.join(' ').replace(/(\S+ \S+) /g, '$1L') + 'Z').join(''));
    svg.appendChild(path);
    return svg;
  }
  // くじ：日付から決まる（今日の一問は、誰が開いても同じ日は同じ問題）
  const rng = (seed) => () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function choices(q, r) {
    const set = new Set([q.ans]);
    for (const n of q.near || []) if (set.size < 4) set.add(n);
    const same = M.P.map((p) => p.n).filter((n) => regOf(n) === regOf(q.ans) && !set.has(n));
    while (set.size < 4 && same.length) set.add(same.splice(Math.floor(r() * same.length), 1)[0]);
    const any = M.P.map((p) => p.n).filter((n) => !set.has(n));
    while (set.size < 4) set.add(any.splice(Math.floor(r() * any.length), 1)[0]);
    return [...set].sort(() => r() - 0.5);
  }

  // ---------------------------------------------------------------- 記録（端末の中だけ）
  // 形の違う記録（古い版・壊れた値）は捨てて始め直す。読んだまま使うと、開くたびに rounds.push などで止まる
  function load() {
    const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (obj(s) && (s.daily === undefined || obj(s.daily)) && (s.cats === undefined || obj(s.cats) && Object.values(s.cats).every((c) => Array.isArray(c) && c.length === 2))
        && (s.rounds === undefined || Array.isArray(s.rounds) && s.rounds.every(obj)) && (s.wrong === undefined || Array.isArray(s.wrong))) return s;
    } catch (e) { /* 読めない時も始め直す */ }
    return {};
  }
  function save(L) { try { localStorage.setItem(KEY, JSON.stringify(L)); return true; } catch (e) { return false; } }
  const L = Object.assign({ daily: {}, rounds: [], wrong: [], cats: {} }, load());
  function note(q, ok) {
    const c = L.cats[q.cat] || (L.cats[q.cat] = [0, 0]);
    c[0] += ok ? 1 : 0; c[1]++;
    L.wrong = L.wrong.filter((id) => id !== q.id);
    if (!ok) L.wrong.push(q.id);
    if (L.wrong.length > 100) L.wrong.shift();
  }
  function streak() {
    let n = 0;
    for (let d = new Date(); ; d.setDate(d.getDate() - 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!L.daily[k]) { if (n === 0 && k === today()) continue; break; }
      n++;
    }
    return n;
  }
  const titleOf = (s) => s >= 140 ? '達人' : s >= 120 ? '名人' : s >= 90 ? '通' : s >= 50 ? '旅人' : '旅の入口';

  // ---------------------------------------------------------------- 遊び方の状態
  let S = null;     // { mode: 'day'|'round'|'wrong', list, i, score, ok, q, ch, t0, done }
  function startRound(mode) {
    const r = rng((Date.now() & 0xffffff) ^ 0x5bd1e995);
    let list;
    if (mode === 'pref') {
      const p = prefNow();
      if (!p) { startRound('round'); return; }
      list = prefList(p.n, r);
      if (!list.length) return;
      S = { mode, list, i: 0, score: 0, ok: 0, r, pref: p.n };
      box.classList.add('open'); open.classList.add('on');
      ask();
      return;
    }
    if (M.inside) { M.leave(() => startRound(mode)); return; }
    const P = all();
    if (mode === 'day') {
      const day = today(), seed = [...day].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
      list = [P[Math.floor(rng(seed)() * P.length)]];
    } else if (mode === 'wrong') {
      list = L.wrong.map((id) => P.find((q) => q.id === id)).filter(Boolean).slice(-ROUND).sort(() => r() - 0.5);
    } else if (mode === 'shape') {
      list = M.P.map((p) => p.n).sort(() => r() - 0.5).slice(0, ROUND).map(shapeQ);
    } else {
      // ジャンルを混ぜる：豆知識・産地・紹介・豆知識・名所と山湖・旅から順に（豆知識は多めに）。どれも、まだ知らない物を先に
      const groups = [['豆知識'], ['産地'], ['特産', '食', '歴史', '名所', '祭り'], ['豆知識'], ['名所', '山', '湖'], ['旅']];
      const used = new Set();
      list = [];
      for (let i = 0; list.length < ROUND && i < 60; i++) {
        const g = groups[i % groups.length], c = P.filter((q) => g.includes(q.cat) && !used.has(q.id));
        if (!c.length) continue;
        const q = pickUnknown(c, r); used.add(q.id); list.push(q);
      }
    }
    if (!list.length) return;
    S = { mode, list, i: 0, score: 0, ok: 0, r };
    box.classList.add('open'); open.classList.add('on');
    ask();
  }
  function ask() {
    const q = S.list[S.i];
    S.q = q; S.ch = q.opts ? q.opts.map((o, i) => i) : choices(q, S.r); S.t0 = performance.now(); S.done = false;
    box.textContent = '';
    const head = el('div', 'head');
    head.append(el('b', null, S.mode === 'day' ? `今日の一問（${today().slice(5).replace('-', '月')}日）` : S.mode === 'wrong' ? 'まちがえた問題' : S.mode === 'shape' ? 'かたち当て'
      : S.mode === 'pref' ? `${name(S.pref)}のクイズ` : '全国のクイズ'),
      el('span', 'n', S.mode === 'day' ? '' : `${S.i + 1} / ${S.list.length}　${S.score}点`));
    const x = el('button', 'x', '×'); x.title = 'やめる'; x.addEventListener('click', stop);
    head.append(...(window.RUBY ? [RUBY.button()] : []), x);
    const bar = el('div', 'time'), fill = el('i');
    bar.append(fill);
    box.append(head, el('span', 'cat', q.cat), R(el('p', 'q'), q.text), bar);
    if (q.shape) box.append(shapeEl(q.shape));
    M.loadIntro(q.opts ? q.pref : q.ans).catch(() => {});      // 答えの後に出す説明（県ごとのファイル）を、考えている間に読んでおく
    const g = el('div', 'ch');
    for (const no of S.ch) { const b = R(el('button'), q.opts ? q.opts[no].t : name(no)); b.dataset.no = no; b.addEventListener('click', () => answer(no)); g.append(b); }
    box.append(g);
    if (!q.opts) box.append(el('small', 'hint', '地図の都道府県を押しても答えられます'));
    requestAnimationFrame(() => { fill.style.transitionDuration = LIMIT + 's'; fill.style.width = '0%'; });
  }
  function answer(no) {
    if (!S || S.done) return;
    S.done = true;
    const q = S.q, ok = no === q.ans, sec = (performance.now() - S.t0) / 1000;
    const pts = ok ? 10 + Math.max(0, Math.ceil((LIMIT - sec) / 3)) : 0;
    S.score += pts; S.ok += ok ? 1 : 0;
    note(q, ok);
    if (S.mode === 'day') L.daily[today()] = { id: q.id, ok };
    for (const b of box.querySelectorAll('.ch button')) {
      const n = +b.dataset.no;
      b.disabled = true;
      b.classList.toggle('good', n === q.ans); b.classList.toggle('bad', n === no && !ok);
    }
    box.querySelector('.time').remove();
    const hint = box.querySelector('.hint');
    if (hint) hint.remove();
    const pref = q.opts ? q.pref : q.ans;
    const res = el('div', 'res ' + (ok ? 'ok' : 'ng'));
    const more = el('p', null, q.more() || '説明を読み込んでいます…'), src = el('details', 'src');
    // 説明と出どころ（県の中の問い）。文と出どころは県ごとのファイルで後から届く
    const fill = () => {
      if (q.more()) more.textContent = q.more();
      src.textContent = '';
      const list = (q.src ? q.src() : []).filter((s) => s && s.title);
      src.hidden = !list.length;
      if (!list.length) return;
      const ol = el('ol');
      for (const s of list) {
        const li = el('li'), u = M.safeUrl ? M.safeUrl(s.url) : null;
        if (u) { const a = el('a', null, s.title); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a); } else li.textContent = s.title;
        ol.append(li);
      }
      src.append(el('summary', null, `もっと知りたい方へ：出どころ（${list.length}件）`), ol);
    };
    fill();
    M.loadIntro(pref).then(() => { if (res.isConnected) fill(); }, () => { if (!q.more()) more.textContent = '説明を読めませんでした（通信を確かめてください）'; });
    res.append(R(el('b'), ok ? `正解！ +${pts}点` : `ざんねん。正解は ${q.opts ? `「${q.opts[q.ans].t}」` : name(q.ans)}`), more, src);
    // 合っていても違っていても、説明を読むので知った物に数える：豆知識は豆知識帳へ（入ったことを知らせる）、ほかはであい帖へ
    if (q.mame && window.MAME) {
      const isNew = MAME.record(q.mame), [got, tot] = MAME.count();
      res.append(el('p', 'got', (isNew ? '豆知識帳に入りました' : '記録ずみの豆知識です') + `（${got} / ${tot}）`));
    }
    dispatchEvent(new CustomEvent('deai', { detail: { id: q.lid || q.id, pref, day: S.mode === 'day' } }));
    const nx = el('button', 'next', S.mode === 'day' || S.i + 1 >= S.list.length ? '結果へ' : '次の問題へ ›');
    nx.addEventListener('click', () => { S.i++; if (S.mode !== 'day' && S.i < S.list.length) ask(); else finish(); });
    res.append(nx);
    box.append(res);
    save(L);
    // 答えの県を浮かせて見せる（全国の問いだけ。地図を押して答えた時の「選ぶ」と区別するため、答えた後に）
    const k = q.opts ? -1 : kOf(q.ans);
    if (k >= 0) { S.selfSelect = true; M.select(k); S.selfSelect = false; }
    paintDot();
  }
  function finish() {
    if (S.mode !== 'day') L.rounds.push(Object.assign({ t: Date.now(), score: S.score, ok: S.ok, n: S.list.length, mode: S.mode }, S.pref ? { pref: S.pref } : {}));
    if (L.rounds.length > 200) L.rounds.shift();
    const kept = save(L);
    box.textContent = '';
    const head = el('div', 'head');
    const x = el('button', 'x', '×'); x.addEventListener('click', stop);
    head.append(el('b', null, S.mode === 'shape' ? 'かたち当ての結果' : '結果'), x);
    box.append(head);
    if (S.mode === 'day') box.append(el('p', 'big', S.ok ? '今日の一問、正解！' : '今日の一問は、また明日。'), el('p', null, `今日の一問の連続：${streak()}日`));
    else box.append(el('p', 'big', `${S.score}点（${S.ok} / ${S.list.length}問）`), el('p', 'title', `称号：${titleOf(S.score)}`));
    const row = el('div', 'row');
    const again = el('button', null, 'もう1クール'); again.addEventListener('click', () => startRound(S && (S.mode === 'shape' || S.mode === 'pref') ? S.mode : 'round'));
    const share = el('button', null, '結果を写す');
    share.addEventListener('click', () => {
      const t = S && S.mode === 'day' ? `全国3D鳥瞰図 今日の一問 ${S.ok ? '正解' : '不正解'}（連続${streak()}日）`
        : `全国3D鳥瞰図${S && S.mode === 'shape' ? 'かたち当て' : S && S.mode === 'pref' ? name(S.pref) + 'のクイズ' : 'クイズ'} ${S.score}点（${S.ok}/${S.list.length}）${titleOf(S.score)}`;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { share.textContent = '写しました'; }, () => { share.textContent = t; });
    });
    row.append(again, share);
    box.append(row, logView(kept));
  }
  // 記録：自己ベスト・回数・平均・今日の一問の連続・ジャンル別の正答率・まちがえた問題
  function logView(kept) {
    const d = el('details', 'log'), s = el('summary', null, '記録を見る');
    d.append(s);
    const R = L.rounds.filter((x) => x.mode === 'round');
    const best = R.reduce((m, x) => Math.max(m, x.score), 0), avg = R.length ? Math.round(R.reduce((a, x) => a + x.score, 0) / R.length) : 0;
    d.append(el('p', null, `クイズ ${R.length}回・自己ベスト ${best}点・平均 ${avg}点・今日の一問の連続 ${streak()}日`));
    const SH = L.rounds.filter((x) => x.mode === 'shape');
    if (SH.length) d.append(el('p', null, `かたち当て ${SH.length}回・自己ベスト ${SH.reduce((m, x) => Math.max(m, x.score), 0)}点`));
    const PR = L.rounds.filter((x) => x.mode === 'pref');
    if (PR.length) d.append(el('p', null, `県のクイズ ${PR.length}回・自己ベスト ${PR.reduce((m, x) => Math.max(m, x.score), 0)}点`));
    const ul = el('ul');
    for (const [c, [o, n]] of Object.entries(L.cats).sort((a, b) => b[1][1] - a[1][1])) ul.append(el('li', null, `${c}：${o} / ${n}（${Math.round(100 * o / n)}%）`));
    d.append(ul);
    const recent = el('ol', 'recent');
    for (const x of R.slice(-5).reverse()) { const t = new Date(x.t); recent.append(el('li', null, `${t.getMonth() + 1}/${t.getDate()} ${x.score}点（${x.ok}/${x.n}）`)); }
    if (R.length) d.append(el('small', null, '最近の5回'), recent);
    if (L.wrong.length) { const w = el('button', null, `まちがえた問題に再挑戦（${Math.min(L.wrong.length, ROUND)}問）`); w.addEventListener('click', () => startRound('wrong')); d.append(w); }
    d.append(el('small', 'keep', kept ? '記録はこの端末の中だけに残します（どこにも送りません）' : 'この画面では記録を残せません（プライベートモードなど）'));
    return d;
  }
  function menu() {
    box.textContent = '';
    const head = el('div', 'head'), x = el('button', 'x', '×');
    x.addEventListener('click', stop);
    head.append(el('b', null, 'クイズ'), x);
    const day = L.daily[today()];
    const b1 = el('button', 'big', day ? `今日の一問：${day.ok ? '正解ずみ' : '答えずみ'}（また明日）` : '今日の一問に答える');
    b1.disabled = !!day; b1.addEventListener('click', () => startRound('day'));
    // 県の中ではその県のクイズを先頭に、全国では全国のクイズを（本人 2026-11-11「全国を見ているときは全国から、県内を見ているときは県内の情報から」）
    const p = prefNow(), btns = [];
    if (p) {
      const bp = el('button', 'big', `${name(p.n)}のクイズに挑戦（${ROUND}問）`);
      bp.addEventListener('click', () => startRound('pref'));
      btns.push(bp);
    }
    const b2 = el('button', 'big' + (p ? ' sub' : ''), `全国のクイズに挑戦（${ROUND}問）` + (p ? '・県の外へ' : ''));
    b2.addEventListener('click', () => startRound('round'));
    const b3 = el('button', 'big sub', `かたちで当てる（${ROUND}問）`);
    b3.addEventListener('click', () => startRound('shape'));
    const b4 = el('button', 'big sub', 'すごろく10回チャレンジ！');
    b4.addEventListener('click', () => { if (window.SUGO) SUGO.open(); });
    const un = unknownMame(p ? p.n : null), lead = p
      ? `${name(p.n)}のことを4つから選びます。まだ知らない物から出します（${name(p.n)}のまだ知らない豆知識 ${un}件）。`
      : `答えは4つから選ぶか、地図の都道府県を押します。まだ知らない物から出します（まだ知らない豆知識 ${un}件）。`;
    box.append(head, el('p', null, lead + '合っていても違っていても、答えの説明を読めば豆知識帳とであい帖に入ります。速く答えるほど点が増えます。'),
      ...btns, b1, b2, b3, b4, logView(save(L)));
    box.classList.add('open'); open.classList.add('on');
  }
  function stop() { S = null; box.classList.remove('open'); open.classList.remove('on'); }
  // 地図の県を押して答える（答えの県を浮かせる時の「選ぶ」は数えない）
  M.on('select', (k) => { if (S && !S.done && !S.selfSelect && S.q && !S.q.opts && M.P[k]) answer(M.P[k].n); });
  // すごろくの窓と同じ所に開くので、すごろくは閉じてから。遊んでいる途中は開かない（閉じると番付の挑戦が1回むだになる）
  open.addEventListener('click', () => {
    if (box.classList.contains('open')) { stop(); return; }
    if (window.SUGO) { if (SUGO.playing) return; SUGO.stop(true); }
    menu();
  });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && box.classList.contains('open') && !e.target.closest('input')) { stop(); e.stopImmediatePropagation(); } }, true);
  // 今日の一問がまだなら、アイコンに小さな点
  const paintDot = () => open.classList.toggle('dot', !L.daily[today()]);
  paintDot();
  window.QUIZ = { dayDone: () => !!L.daily[today()], get pool() { return all(); }, start: startRound, menu, stop, answer, shape: shapeEl, get state() { return S && { mode: S.mode, i: S.i, n: S.list.length, score: S.score, ok: S.ok, q: S.q && S.q.id, ans: S.q && S.q.ans, ch: S.ch, done: S.done,
    pref: S.pref || null, opts: !!(S.q && S.q.opts), mame: S.q && S.q.mame || null, known: S.list.map(knownQ), list: S.list.map((q) => ({ id: q.id, lid: q.lid || null, mame: q.mame || null, pref: q.opts ? q.pref : q.ans, opts: !!q.opts })) }; }, get log() { return L; } };
})();
