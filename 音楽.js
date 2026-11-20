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
  let on = false, season = 1, night = false, cur = null, el = null, row = [], fades = [], saved = 0, primed = null;
  const OVER = B.settings.overlap ?? 4;          // 曲の終わりの消えぎわ（bgm_prep が終わりをこの秒数で消す）。並びの次の曲はここから重ねる
  // 鳴らし始め・鳴らし直しは短く大きくする（本人 2026-11-18「最初音楽が鳴りづらいね しばらくしてから鳴るようだ」：
  // 曲が届いてから 1.2 秒かけて大きくしていたので、押してから聞こえるまで2秒ほどかかった）。1.2 秒は曲から曲へ重ねる時だけ
  const FADE_IN = 0.3;

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
  // 曲の終わりで次へ。並びに今の曲が無い（地図がひとりでに季節・夜・地方を変えた後）は、その時の決まりの曲へ
  function next(a) {
    if (a !== el || !on) return;
    const i = row.indexOf(cur);
    if (i >= 0 && row.length < 2) return;
    start(i < 0 ? choose(row) : row[(i + 1) % row.length]);
  }
  function save() {
    if (cur && el) keep.set({ no: cur.no, t: el.currentTime, on });
  }
  function fade(a, to, done, dur = FADE) {
    fades = fades.filter((f) => f.a !== a);
    fades.push({ a, from: a.volume, to, t: 0, done, dur });
  }
  // 入口にいる間に、最初に鳴らすはずの曲の頭（曲の目次）だけ読んでおく（押してから届くのを待つ時間を減らす）。
  // 曲ぜんぶは読まない（音楽を聞かない人の通信を増やさない）。季節・時刻が変わって曲が変われば読み直す
  function prime() {
    if (on || el || !songs.size || userOff.get()) return;
    const l = pick();
    if (!l.length || (primed && l.includes(primed.s))) return;
    const a = new Audio(); a.preload = 'metadata'; a.s = choose(l); a.src = a.s.file;
    primed = a;
  }
  // 曲を替える：新しい曲を小さく始めて大きく、前の曲は小さくして止める。同じ曲の続きなら、覚えた位置から
  function start(s) {
    const old = el;
    const ready = primed && primed.s === s ? primed : null;
    primed = null;
    cur = s; el = ready || new Audio(s.file); el.loop = row.length < 2; el.preload = 'auto'; el.volume = 0;
    const k = keep.get();
    const a = el;
    if (k && k.no === s.no && k.t > 0) {
      const seek = () => { if (a === el && isFinite(a.duration)) a.currentTime = k.t % a.duration; };
      if (a.readyState >= 1) seek(); else a.addEventListener('loadedmetadata', seek, { once: true });
    }
    a.addEventListener('timeupdate', () => { if (isFinite(a.duration) && a.currentTime > a.duration - OVER) next(a); });
    a.addEventListener('ended', () => next(a));
    a.play().then(() => { if (a === el) fade(a, VOL, null, old ? FADE : FADE_IN); }).catch(() => { if (a === el) { on = false; ui(); } });
    if (old) fade(old, 0, () => old.pause());
    cap.textContent = '♪ ' + s.title; cap.classList.add('on');
    clearTimeout(cap.t); cap.t = setTimeout(() => cap.classList.remove('on'), 4500);
  }
  function play() {
    const l = pick();
    if (!l.length) { ui(); return; }
    const s = primed && l.includes(primed.s) ? primed.s : choose(l);
    row = l; on = true; userOff.set(false);
    if (cur === s && el) { const a = el; a.loop = row.length < 2; a.play().then(() => fade(a, VOL, null, FADE_IN)).catch(() => { on = false; ui(); }); }
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
  // 季節・夜・地方が変わったら、鳴っている時だけ曲を替える（鳴っていない時は、次に鳴らす時に選ぶ）。
  // 地図がひとりでに変えた時（M.isAuto：遊覧の名所ごとの季節の色・季節めぐり・時計・クイズの答えの県）は曲の途中で替えず、今の曲の終わりで次の決まりの曲へ
  // （本人 2026-11-19「BGMが曲の途中でどんどん勝手に切り替わります（遊覧中でした）」）。人が季節の札・夜・県を選んだ時は、その場で替える
  const repick = () => {
    if (!on) return;
    const l = pick();
    if (!l.length) return;
    row = l;
    if (l.includes(cur)) { if (el) el.loop = l.length < 2; return; }
    if (M.isAuto) { if (el) el.loop = false; return; }
    save(); start(choose(l));
  };
  M.on('season', (i) => { season = i; repick(); prime(); });
  M.on('night', (v) => { night = v; repick(); prime(); });
  M.on('select', repick);
  M.on('deselect', repick);
  const all = $('#views [data-v="all"]');
  if (all) all.addEventListener('click', () => setTimeout(repick, 0));     // 「全体」で地方を忘れた後に（入口.js が先に忘れる）
  // 入口で何かを選んだ時（押した続きなので鳴らせる）。前に自分で止めていたら鳴らさない。
  // 地方を選んだ時だけにしていた間は、遊覧・すごろく・クイズ・宝さがしから入ると鳴らず、スマホではたたんだメニューの中の「音楽」を探すまで鳴らなかった（2026-11-18）
  const entry = $('#o-regions');
  if (entry) entry.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.matches('.o-back, .chips button, #o-retry')) return;
    if (!on && !userOff.get() && songs.size) play();
  });
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
      for (const f of fades) { f.t = Math.min(1, f.t + dt / f.dur); f.a.volume = Math.max(0, Math.min(1, f.from + (f.to - f.from) * f.t)); }
      for (const f of fades.filter((g) => g.t >= 1)) if (f.done) f.done();
      fades = fades.filter((f) => f.t < 1);
    }
    if (on && now - saved > 3000) { saved = now; save(); }
  });
  M.on('ready', () => { season = M.inner.season; night = M.isNight; ui(); setTimeout(prime, 1500); });
  ui();

  // 検査用
  window.BGM = {
    get state() { return { have: songs.size, on, song: cur && cur.no, list: row.map((s) => s.no), t: el ? el.currentTime : 0, paused: el ? el.paused : true, vol: el ? el.volume : 0, off: userOff.get(), primed: primed && primed.s.no }; },
    play, stop: () => stop(true),
    toEnd() { if (el && isFinite(el.duration)) el.currentTime = Math.max(0, el.duration - OVER - 1); },     // 曲の終わりの手前へ（曲の終わりで次の決まりへ移るかの検査）
    // 別のブラウザへ出る前に、その場で止める（LINE の中のページは開きなおした後も裏で生きていて、移った先から止められない。
    // 少しずつ下げる止め方は、裏に回ると毎コマが来ずに途中の音量で鳴り続ける）。本人が止めた扱いにはしない
    hush() { on = false; if (el) el.pause(); ui(); },
  };
})();
