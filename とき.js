// 季節と時刻（本人 2026-10-29「季節と時間はリアルタイムに合わせて進む感じで」「季節は自動でメドレー」「昼夜だけでなく時間の流れ」）：
// 既定は「今に合わせる」（月で季節・時計で時刻を、1分ごとに）。手で季節や時刻を選ぶとそれを優先し、「今に合わせる」で戻る。
// 「季節めぐり」は40秒ごとに次の季節へ、「時間を流す」は1日を4分で回す。季節めぐりは、遊覧・空を飛ぶ間は待つ（季節の描き直しが重い）。
// 下の並び（アイコン）の説明の札（data-tip）と、押すと上に開く窓（季節と時刻・向き）もここで。?open=0 か ?toki=0 で開くと今に合わせない（検査用）
(function () {
  'use strict';
  const M = window.MAP3D;
  if (!M) return;
  const $ = (s) => document.querySelector(s);
  const SEASONS = ['春', '夏', '秋', '冬'];
  const FIXED = /[?&](open|toki)=0/.test(location.search);
  const mode = { season: FIXED ? 'manual' : 'now', time: FIXED ? 'manual' : 'now' };     // season: now・manual・meguri ／ time: now・manual・flow
  let self = 0, season = 1, hour = 12, meguriAt = 0, flowAt = 0, ready = false;
  const seasonOf = (d) => { const m = d.getMonth() + 1; return m >= 3 && m <= 5 ? 0 : m <= 8 && m >= 6 ? 1 : m >= 9 && m <= 11 ? 2 : 3; };
  const busy = () => document.body.classList.contains('touring') || document.body.classList.contains('flying');

  // 自分で変えた時だけ self を上げる。ほかから変わった（季節の札・N のキー・検査）ら、手で選んだとみなす。
  // 地図の準備の中の「夏を入れる」は数えない（準備が終わる前に届き、開いた時から手で選んだ扱いになっていた）
  function setSeason(i, now) { self++; try { M.season(i, now); } finally { self--; } }
  function setHour(h, now) { self++; try { M.time(h, new Date(), now); } finally { self--; } }
  M.on('season', (i) => { season = i; if (ready && !self && mode.season !== 'manual') { mode.season = 'manual'; } ui(); });
  M.on('time', (h) => { hour = h; if (ready && !self && mode.time !== 'manual') { mode.time = 'manual'; } ui(); });

  function follow(now) {
    const d = new Date();
    if (mode.season === 'now' && season !== seasonOf(d)) setSeason(seasonOf(d), now);
    if (mode.time === 'now') setHour(d.getHours() + d.getMinutes() / 60, now);
  }
  M.on('ready', () => { ready = true; season = M.inner.season; follow(true); ui(); });
  setInterval(() => follow(false), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) follow(false); });
  // 季節めぐり・時間を流す：毎コマの知らせで進める（隠れている間は止まる）
  let last = performance.now();
  M.on('frame', () => {
    const t = performance.now(), dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    if (mode.time === 'flow' && (flowAt += dt) >= 0.2) { setHour(hour + flowAt * 0.1); flowAt = 0; }        // 1秒に6分＝1日を4分
    if (mode.season === 'meguri' && !busy() && (meguriAt += dt) >= 40) { meguriAt = 0; setSeason((season + 1) % 4); }
  });

  // ---------------------------------------------------------------- 季節と時刻の窓
  const open = $('#toki-open'), range = $('#toki-range'), hText = $('#toki-h'), state = $('#toki-state');
  const hhmm = (h) => { const m = Math.round(h * 60) % 1440; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  range.addEventListener('input', () => { mode.time = 'manual'; setHour(+range.value, true); ui(); });
  document.querySelectorAll('#toki-quick button[data-h]').forEach((b) => b.addEventListener('click', () => { mode.time = 'manual'; setHour(+b.dataset.h); ui(); }));
  $('#toki-now').addEventListener('click', () => { mode.season = 'now'; mode.time = 'now'; follow(false); ui(); });
  $('#toki-meguri').addEventListener('click', () => { mode.season = mode.season === 'meguri' ? 'manual' : 'meguri'; meguriAt = 0; ui(); });
  $('#toki-flow').addEventListener('click', () => { mode.time = mode.time === 'flow' ? 'manual' : 'flow'; ui(); });
  // 窓の字が変わるのは「季節・時刻・決め方」が変わった時だけ（時間を流す間は 0.2 秒ごと）
  function ui() {
    const night = M.isNight;
    const how = mode.season === 'meguri' ? '季節めぐり中' : mode.time === 'flow' ? '時間を流しています' : mode.season === 'now' && mode.time === 'now' ? '今に合わせています' : '選んだ季節と時刻です';
    open.dataset.tip = `季節と時刻：${SEASONS[season]}・${hhmm(hour)}（${how}）`;
    open.querySelector('.lab').textContent = `${SEASONS[season]}・${night ? '夜' : hhmm(hour)}`;
    hText.textContent = hhmm(hour);
    if (document.activeElement !== range) range.value = hour.toFixed(2);
    for (const b of document.querySelectorAll('#toki-quick button')) {
      const d = Math.abs(((+b.dataset.h - hour + 36) % 24) - 12);
      b.classList.toggle('on', d > 12 - 1.5);
    }
    $('#toki-now').classList.toggle('on', mode.season === 'now' && mode.time === 'now');
    $('#toki-meguri').classList.toggle('on', mode.season === 'meguri');
    $('#toki-flow').classList.toggle('on', mode.time === 'flow');
    state.textContent = how + (mode.season === 'meguri' ? '（40秒ごとに次の季節へ）' : '') + (mode.time === 'flow' ? '（1日を4分で）' : '');
    glyph(night);
  }
  // アイコン：季節の絵（春＝花・夏＝日・秋＝葉・冬＝雪）。夜は右上に月
  const G = {
    0: '<circle cx="12" cy="12" r="2.2" class="f"/><path d="M12 9.8c-1.6-2.6-1-5 0-5.8 1 .8 1.6 3.2 0 5.8ZM14.1 11.3c2.6-1.5 5-.9 5.7.1-.8 1-3.2 1.6-5.7-.1ZM13.3 13.8c1.4 2.7.6 5-.4 5.6-.9-.9-1.3-3.3.4-5.6ZM10.7 13.8c-1.7 2.3-1.3 4.7-.4 5.6 1-.6 1.8-2.9.4-5.6ZM9.9 11.3c-2.5 1.7-4.9 1.1-5.7.1.7-1 3.1-1.6 5.7-.1Z"/>',
    1: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
    2: '<path d="M12 21v-6M12 15 6 18l1.5-3.5L4 13l3.6-1.2L5.4 8l3.9 1.4L10 5l2 3 2-3 .7 4.4L18.6 8l-2.2 3.8L20 13l-3.5 1.5L18 18Z"/>',
    3: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
  };
  let lastGlyph = '';
  function glyph(night) {
    const key = season + (night ? 'n' : '');
    if (key === lastGlyph) return;
    lastGlyph = key;
    open.querySelector('.glyph').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + G[season] +
      (night ? '<path class="f" d="M20.5 2.8a3.2 3.2 0 1 0 1.8 5.6 3.6 3.6 0 0 1-1.8-5.6Z"/>' : '') + '</svg>';
  }

  // ---------------------------------------------------------------- 押すと上に開く窓（季節と時刻・向き）
  const docks = [...document.querySelectorAll('#bar .dock')];
  function shut(except) {
    for (const d of docks) if (d !== except && d.classList.contains('open')) { d.classList.remove('open'); d.querySelector('.ico').setAttribute('aria-expanded', 'false'); }
  }
  for (const d of docks) {
    const b = d.querySelector('.ico');
    b.addEventListener('click', () => { const on = !d.classList.contains('open'); shut(d); d.classList.toggle('open', on); b.setAttribute('aria-expanded', String(on)); tip(null); });
  }
  document.querySelectorAll('#muki-pop button').forEach((b) => b.addEventListener('click', () => shut()));
  addEventListener('pointerdown', (e) => { if (!e.target.closest('#bar .dock')) shut(); });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && docks.some((d) => d.classList.contains('open')) && !e.target.closest('input[type=text], input:not([type])')) { shut(); e.stopImmediatePropagation(); }
  }, true);

  // ---------------------------------------------------------------- 説明の札：マウスを乗せた時（スマホはアイコンの下に名前）
  const tipEl = $('#dock-tip'), hover = matchMedia('(hover: hover)');
  function tip(el) {
    if (!el || !hover.matches || el.closest('.dock.open')) { tipEl.classList.remove('on'); return; }
    tipEl.textContent = el.dataset.tip;
    tipEl.classList.add('on');
    const r = el.getBoundingClientRect(), w = tipEl.offsetWidth;
    tipEl.style.transform = `translate(${Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2)).toFixed(0)}px, ${(r.top - 30).toFixed(0)}px)`;
  }
  for (const el of document.querySelectorAll('#bar [data-tip]')) {
    el.addEventListener('pointerenter', () => tip(el));
    el.addEventListener('pointerleave', () => tip(null));
    el.addEventListener('focus', () => tip(el));
    el.addEventListener('blur', () => tip(null));
  }

  ui();
  // mode＝今に合わせているか（season・time）。season・hour は今の季節の番号と時刻（前は mode と同じ名前の欄で、決まりが季節の番号に上書きされていた）
  window.TOKI = { get state() { return { ...mode, mode: { ...mode }, season, hour, night: M.isNight }; }, follow };
})();
