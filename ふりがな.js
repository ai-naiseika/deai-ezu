// ふりがな（本人 2026-11-11「すごろくや豆知識、漢字が読めず苦労するので、漢字にフリガナが欲しい」「特に歴史に関わるなじみのない人や地名や建物などの呼び名」）：
// 読みは 読み.js（骨/読み/読みを焼く.py が、裏付けの取れた読みだけを台帳から焼く）。名前ごとに「その名前の中の語の読み」を持つので、
// 同じ字で読みの違う語（上野焼のあがの・上野駅のうえの）を取り違えない。文の中に台帳の名前があれば、その中の語に <ruby> を付ける。
// 読み.js は、すごろく・クイズ・豆知識の札を開いた時に初めて読む（最初の読み込みを重くしない）。届く前に書いた字は、届いたら付け直す。
// 出す・消すは窓の上の「ふりがな」で（端末に覚える。最初は出す）。字は全部 textContent、読みはひらがなだけの物しか使わない
(function () {
  'use strict';
  const KEY = 'zenkoku3d-ruby', HIRA = /^[ぁ-ゖー]+$/;
  let on = true, data = null, keys = [], loading = null;
  try { on = localStorage.getItem(KEY) !== '0'; } catch (e) { /* 覚えられない端末では毎回出す */ }
  const paint = () => document.body.classList.toggle('no-ruby', !on);

  function load() {
    if (data || loading) return loading;
    loading = new Promise((ok) => {
      const s = document.createElement('script');
      s.src = '読み.js?d=' + new Date().toISOString().slice(0, 10); s.async = true;     // 日ごとに読み直す（直した読みが古いまま残らない）
      s.onload = () => {
        data = window.YOMI || {};
        keys = Object.keys(data).filter((k) => k.length >= 2).sort((a, b) => b.length - a.length);     // 長い名前を先に（短い名前が長い名前の一部を取らない）
        for (const e of document.querySelectorAll('[data-ruby]')) if (e.isConnected) fill(e, e.dataset.ruby);
        ok();
      };
      s.onerror = () => { loading = null; ok(); };       // 読めなければ、ふりがな無しのまま（次に開いた時にもう一度）
      document.head.appendChild(s);
    });
    return loading;
  }
  // 文を、ふりがなの付いた並びに分ける：[字, 読み|null]
  function parts(s) {
    if (keys.length !== Object.keys(data).length) keys = Object.keys(data).filter((k) => k.length >= 2).sort((a, b) => b.length - a.length);     // 読みが増えたら並べ直す
    const marks = new Array(s.length).fill(null);
    for (const k of keys) {
      for (let i = s.indexOf(k); i >= 0; i = s.indexOf(k, i + k.length)) {
        if (marks.slice(i, i + k.length).some(Boolean)) continue;
        let at = i;                                    // 語は名前の中の前から順（同じ字が2度出る名前でも、前の語の続きから探す）
        for (const [w, r] of data[k]) {
          const j = s.indexOf(w, at);
          if (j < 0 || j + w.length > i + k.length || !HIRA.test(r) || marks.slice(j, j + w.length).some(Boolean)) continue;
          const m = { start: j, r };
          for (let x = j; x < j + w.length; x++) marks[x] = m;
          at = j + w.length;
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
  function fill(el, s) {
    el.textContent = '';
    if (!data) { el.textContent = s; return; }
    for (const [t, r] of parts(s)) {
      if (!r) { el.append(t); continue; }
      const rb = document.createElement('ruby'), rt = document.createElement('rt');
      rb.append(t); rt.textContent = r; rb.append(rt); el.append(rb);
    }
  }
  // 字を入れる（台帳が届く前は字だけ。届いたら付け直す）
  function text(el, s) {
    s = String(s == null ? '' : s);
    el.dataset.ruby = s;
    fill(el, s);
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
  window.RUBY = { text, button, set, load, parts: (s) => (data ? parts(String(s)) : [[String(s), null]]), get on() { return on; }, get ready() { return !!data; } };
})();
