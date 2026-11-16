// ふりがな（本人 2026-11-11「すごろくや豆知識、漢字が読めず苦労するので、漢字にフリガナが欲しい」「特に歴史に関わるなじみのない人や地名や建物などの呼び名」）：
// 読みは 読み.js（骨/読み/読みを焼く.py が、裏付けの取れた読みだけを台帳から焼く）。名前ごとに「その名前の中の語の読み」を持つので、
// 同じ字で読みの違う語（上野焼のあがの・上野駅のうえの）を取り違えない。文の中に台帳の名前があれば、その中の語に <ruby> を付ける。
// 読み.js は、すごろく・クイズ・豆知識の札を開いた時に初めて読む（最初の読み込みを重くしない）。届く前に書いた字は、届いたら付け直す。
// 出す・消すは窓の上の「ふりがな」で（端末に覚える。最初は出す）。字は全部 textContent、読みはひらがなだけの物しか使わない
(function () {
  'use strict';
  const KEY = 'zenkoku3d-ruby', HIRA = /^[ぁ-ゖー]+$/;
  let on = true, data = null, loading = null;
  // 読みの鍵は "名前|県の番号,…"（大山|14＝おおやま・大山|31＝だいせん・富士山|19,22＝ふじさん）。
  // 字が名前そのもの（選択肢・題）なら、その名前の読み（県で読みの割れる名前は、その県の読みだけ）。
  // 文の中（問い・説明・本文）では、その文の県の名前だけを、言葉の切れ目で当てる。県の分からない文には付けない。
  // 前は名前だけで引き、千葉の山「富山（とみさん）」の読みが「富山県」の問いに、神奈川の「大山（おおやま）」の読みが鳥取の大山に付いていた（2026-11-17）
  const KJ = /[一-龥々〆ヶ]/, SUF = '県府都道市町村区郡湾港駅線川湖沼池岳峠岬島城寺宮社藩沖麓産焼祭';
  let made = -1, byName = {}, byPref = {}, keyMemo = {};
  try { on = localStorage.getItem(KEY) !== '0'; } catch (e) { /* 覚えられない端末では毎回出す */ }
  const paint = () => document.body.classList.toggle('no-ruby', !on);

  function load() {
    if (data || loading) return loading;
    loading = new Promise((ok) => {
      const s = document.createElement('script');
      s.src = '読み.js?d=' + new Date().toISOString().slice(0, 10); s.async = true;     // 日ごとに読み直す（直した読みが古いまま残らない）
      s.onload = () => {
        data = window.YOMI || {};
        for (const e of document.querySelectorAll('[data-ruby]')) if (e.isConnected) fill(e, e.dataset.ruby, e.dataset.rubyPref);
        ok();
      };
      s.onerror = () => { loading = null; ok(); };       // 読めなければ、ふりがな無しのまま（次に開いた時にもう一度）
      document.head.appendChild(s);
    });
    return loading;
  }
  function index() {
    const n = Object.keys(data).length;
    if (n === made) return;                            // 読みが増えたら分け直す
    made = n; byName = {}; byPref = {}; keyMemo = {};
    for (const k of Object.keys(data)) {
      const i = k.indexOf('|'), name = i < 0 ? k : k.slice(0, i), ps = i < 0 ? [] : k.slice(i + 1).split(',');
      (byName[name] = byName[name] || []).push({ ps, rows: data[k] });
      for (const p of ps) (byPref[p] = byPref[p] || {})[name] = data[k];
    }
  }
  function keysFor(p) {                               // その県の名前を長い順に（短い名前が長い名前の一部を取らない）
    if (!keyMemo[p]) keyMemo[p] = Object.keys(byPref[p] || {}).filter((k) => k.length >= 2).sort((a, b) => b.length - a.length);
    return keyMemo[p];
  }
  // 文を、ふりがなの付いた並びに分ける：[字, 読み|null]
  function parts(s, pref) {
    index();
    const p = pref == null ? '' : String(pref), marks = new Array(s.length).fill(null);
    const put = (i, k, rows) => {
      let at = i;                                      // 語は名前の中の前から順（同じ字が2度出る名前でも、前の語の続きから探す）
      for (const [w, r] of rows) {
        const j = s.indexOf(w, at);
        if (j < 0 || j + w.length > i + k.length || !HIRA.test(r) || marks.slice(j, j + w.length).some(Boolean)) continue;
        const m = { start: j, r };
        for (let x = j; x < j + w.length; x++) marks[x] = m;
        at = j + w.length;
      }
    };
    const v = byName[s];
    if (v) {                                           // 名前そのもの
      const hit = v.length === 1 ? v[0] : v.find((x) => x.ps.includes(p));
      if (hit) put(0, s, hit.rows);
    } else {
      const own = byPref[p] || {};
      for (const k of keysFor(p)) {
        for (let i = s.indexOf(k); i >= 0; i = s.indexOf(k, i + k.length)) {
          const j = i + k.length;
          if (marks.slice(i, j).some(Boolean)) continue;
          if ((i > 0 && KJ.test(s[i - 1])) || (j < s.length && KJ.test(s[j]) && !SUF.includes(s[j]))) continue;     // 言葉の切れ目でない（「高山植物」・「大津市」の「津市」）
          put(i, k, own[k]);
        }
      }
    }
    const out = [];
    for (let i = 0; i < s.length;) {
      const m = marks[i];
      if (m && m.start === i) { let j = i; while (j < s.length && marks[j] === m) j++; out.push([s.slice(i, j), m.r]); i = j; continue; }
      let j = i;
      while (j < s.length && !(marks[j] && marks[j].start === j)) j++;
      out.push([s.slice(i, j), null]); i = j;
    }
    return out;
  }
  function fill(el, s, pref) {
    el.textContent = '';
    if (!data) { el.textContent = s; return; }
    for (const [t, r] of parts(s, pref)) {
      if (!r) { el.append(t); continue; }
      const rb = document.createElement('ruby'), rt = document.createElement('rt');
      rb.append(t); rt.textContent = r; rb.append(rt); el.append(rb);
    }
  }
  // 字を入れる（台帳が届く前は字だけ。届いたら付け直す）。pref＝その文がどの県の話か（県で読みの違う名前に使う。分からなければ省く）
  function text(el, s, pref) {
    s = String(s == null ? '' : s);
    el.dataset.ruby = s;
    if (pref == null) delete el.dataset.rubyPref; else el.dataset.rubyPref = String(pref);
    fill(el, s, pref);
    if (!data) load();
    return el;
  }
  // 窓の上の切りかえ
  function button() {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ruby-tg';
    const sync = () => { b.textContent = on ? 'ふりがな：あり' : 'ふりがな：なし'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    b.addEventListener('click', () => { set(!on); });
    sync();
    document.addEventListener('ruby-change', sync);
    return b;
  }
  function set(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* 覚えられなくても、今は切りかえる */ }
    paint();
    document.dispatchEvent(new Event('ruby-change'));
  }
  paint();
  window.RUBY = { text, button, set, load, parts: (s, pref) => (data ? parts(String(s), pref) : [[String(s), null]]), get on() { return on; }, get ready() { return !!data; } };
})();
