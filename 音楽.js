// 音楽（本人 2026-10-27「BGMはまだかな」「季節で変わるのもいい」「各県の音楽はその地にちなんだ曲」）：夜の日本・地方（県を押した時・
// 「〇〇から始める」の後）・季節の札で曲を替える。曲は工房のオリジナル曲（BGM&V Studio の Suno）。地方の曲は郷土の楽器と民謡の雰囲気を借りた新しい旋律。
// 台帳は 音楽/曲.json（紹介を作る.py が、ファイルのある曲だけを INTRO.bgm に入れる）。曲がまだ無い間は、ボタンを「準備中」にして何もしない。
// ブラウザは開いた瞬間に音を鳴らせないので、鳴らすのは押した時から。入口で地方を押した時は、前に自分で止めていなければ鳴らし始める（本人の構想）。
// 曲は audio 要素で鳴らし、Web Audio に通さない（スマホの音割れ・音飛び：成果物の基本 3. 音）。替える時は前の曲を1.2秒で小さくして重ねる
// （iPhone は音量を変えられないので、そこは切りかえだけ）。止めた曲と位置はタブの中（sessionStorage）に覚えて続きから。見えない間は止める。
// 1つの決まりに曲を並べてよい（本人 2026-11-01「季節2曲ずつ・夜も季節ごとに」）。並びの時は1曲ずつ終わりまで流し、終わりの消えぎわで次へ重ねる
(function () {
  'use strict';
  const M = window.MAP3D, B = (window.INTRO && INTRO.bgm) || { settings: {}, rules: [], songs: [] };
  if (!M) return;
  const $ = (s) => document.querySelector(s);
  const KEY = 'zenkoku3d-bgm', OFF = 'zenkoku3d-bgm-off', FADE = 1.2;
  const btn = $('#bgm'), cap = $('#bgm-cap');
  const songs = new Map(B.songs.map((s) => [s.no, s]));
  const VOL = B.settings.volume ?? 0.6;
  const keep = {
    get() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 覚えられない時は頭から */ } },
  };
  const userOff = {
    get() { try { return localStorage.getItem(OFF) === '1'; } catch (e) { return false; } },
    set(v) { try { if (v) localStorage.setItem(OFF, '1'); else localStorage.removeItem(OFF); } catch (e) { /* 同上 */ } },
  };
  let on = false, season = 1, night = false, cur = null, el = null, row = [], fades = [], saved = 0;
  const OVER = B.settings.overlap ?? 4;          // 曲の終わりの消えぎわ（bgm_prep が終わりをこの秒数で消す）。並びの次の曲はここから重ねる

  // いまの地方：県を押している時はその県の地方、入口で「〇〇から始める」を押した後はその地方（全国の眺めでは無し）
  function region() {
    const R = (window.OPENING && OPENING.regions) || [];
    if (M.sel >= 0) { const n = M.P[M.sel].n, r = R.find(([, a, b]) => n >= a && n <= b); return r ? r[0] : null; }
    return window.OPENING && OPENING.region ? OPENING.region[0] : null;
  }
  function pick() {
    const reg = region();
    for (const r of B.rules) {
      if (r.night != null && r.night !== night) continue;
      if (r.season != null && r.season !== season) continue;
      if (r.region != null && r.region !== reg) continue;
      const l = [].concat(r.song).filter((n) => songs.has(n)).map((n) => songs.get(n));
      if (l.length) return l;
    }
    return [];
  }
  // 並びのどれから流すか：鳴っている曲・止めた曲が並びにあればそれ（続きから）。無ければくじ（開くたびに同じ曲から始まらないように）
  function choose(l) {
    const k = keep.get();
    return l.find((s) => s === cur) || l.find((s) => k && s.no === k.no) || l[Math.floor(Math.random() * l.length)];
  }
  function next(a) {
    if (a !== el || !on || row.length < 2) return;
    const i = row.indexOf(cur);
    start(row[(i + 1) % row.length]);
  }
  function save() {
    if (cur && el) keep.set({ no: cur.no, t: el.currentTime, on });
  }
  function fade(a, to, done) {
    fades = fades.filter((f) => f.a !== a);
    fades.push({ a, from: a.volume, to, t: 0, done });
  }
  // 曲を替える：新しい曲を小さく始めて大きく、前の曲は小さくして止める。同じ曲の続きなら、覚えた位置から
  function start(s) {
    const old = el;
    cur = s; el = new Audio(s.file); el.loop = row.length < 2; el.preload = 'auto'; el.volume = 0;
    const k = keep.get();
    if (k && k.no === s.no && k.t > 0) el.addEventListener('loadedmetadata', () => { if (el && isFinite(el.duration)) el.currentTime = k.t % el.duration; }, { once: true });
    const a = el;
    a.addEventListener('timeupdate', () => { if (isFinite(a.duration) && a.currentTime > a.duration - OVER) next(a); });
    a.addEventListener('ended', () => next(a));
    a.play().then(() => { if (a === el) fade(a, VOL); }).catch(() => { if (a === el) { on = false; ui(); } });
    if (old) fade(old, 0, () => old.pause());
    cap.textContent = '♪ ' + s.title; cap.classList.add('on');
    clearTimeout(cap.t); cap.t = setTimeout(() => cap.classList.remove('on'), 4500);
  }
  function play() {
    const l = pick();
    if (!l.length) { ui(); return; }
    const s = choose(l);
    row = l; on = true; userOff.set(false);
    if (cur === s && el) { const a = el; a.loop = row.length < 2; a.play().then(() => fade(a, VOL)).catch(() => { on = false; ui(); }); }
    else start(s);
    ui();
  }
  function stop(byUser) {
    if (byUser) userOff.set(true);
    on = false; save();
    if (el) { const a = el; fade(a, 0, () => a.pause()); }
    ui();
  }
  function ui() {
    const lab = btn.querySelector('.lab');
    if (!songs.size) { lab.textContent = '音楽（準備中）'; btn.disabled = true; btn.dataset.tip = '音楽（準備中）：曲はこれから入ります（工房のオリジナル曲）'; return; }
    btn.disabled = false; lab.textContent = btn.dataset.tip = on ? '音楽を止める' : '音楽';
    btn.classList.toggle('on', on);
  }
  btn.addEventListener('click', () => (on ? stop(true) : play()));
  // 季節・夜・地方が変わったら、鳴っている時だけ曲を替える（鳴っていない時は、次に鳴らす時に選ぶ）
  const repick = () => {
    if (!on) return;
    const l = pick();
    if (!l.length) return;
    row = l;
    if (!l.includes(cur)) { save(); start(choose(l)); } else if (el) el.loop = l.length < 2;
  };
  M.on('season', (i) => { season = i; repick(); });
  M.on('night', (v) => { night = v; repick(); });
  M.on('select', repick);
  M.on('deselect', repick);
  const all = $('#views [data-v="all"]');
  if (all) all.addEventListener('click', () => setTimeout(repick, 0));     // 「全体」で地方を忘れた後に（入口.js が先に忘れる）
  // 入口で地方・全体・遊覧を押した時（押した続きなので鳴らせる）。前に自分で止めていたら鳴らさない
  for (const q of ['#o-regions .list', '#o-all', '#o-tour']) {
    const e = $(q);
    if (e) e.addEventListener('click', () => { if (!on && !userOff.get() && songs.size) play(); });
  }
  // 見えない間は止め、戻ったら続きから（鳴らしていた時だけ）
  let wasOn = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { wasOn = on; if (on) { save(); el && el.pause(); } }
    else if (wasOn && el) el.play().catch(() => { on = false; ui(); });
  });
  addEventListener('pagehide', save);
  // 音量を寄せる・数秒ごとに位置を覚える（毎コマの知らせに相乗り。鳴らしていない時は何もしない）
  let last = performance.now();
  M.on('frame', () => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (fades.length) {
      for (const f of fades) { f.t = Math.min(1, f.t + dt / FADE); f.a.volume = Math.max(0, Math.min(1, f.from + (f.to - f.from) * f.t)); }
      for (const f of fades.filter((g) => g.t >= 1)) if (f.done) f.done();
      fades = fades.filter((f) => f.t < 1);
    }
    if (on && now - saved > 3000) { saved = now; save(); }
  });
  M.on('ready', () => { season = M.inner.season; night = M.isNight; ui(); });
  ui();

  // 検査用
  window.BGM = {
    get state() { return { have: songs.size, on, song: cur && cur.no, list: row.map((s) => s.no), t: el ? el.currentTime : 0, paused: el ? el.paused : true, vol: el ? el.volume : 0, off: userOff.get() }; },
    play, stop: () => stop(true),
  };
})();
