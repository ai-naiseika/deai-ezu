// 札（テロップ）の出し方（本人 2026-10-29「情報を増やすと名前札や？だらけで見た目が良くない。表示の ON/OFF、既定は OFF、
// 探し物の時はテーマ別か全部 ON、それ以外はマウスを当てた周りだけ」）：
// いつもは地図の絵と最低限の地名（県名・市・名山）だけ。ほかの札は、灯り（マウスの周り。スマホは触れた所）の中だけ浮かぶ。
// 「札」の窓でテーマを選ぶと、そのテーマの札を地図じゅうに出す。選んだテーマはこの端末に覚える（localStorage）。
// 札を出す側（案内.js・県の中.js・豆知識.js）は、毎コマ FUDA.show(テーマ, 画面の x, y) で濃さ（0〜1）を聞く
(function () {
  'use strict';
  const M = window.MAP3D;
  if (!M) return;
  const $ = (s) => document.querySelector(s);
  const KEY = 'zenkoku3d-fuda-v1';
  const THEMES = [['地名', '地名'], ['名所', '名所と歴史'], ['食', '食と産物'], ['駅', '駅'], ['豆', '豆知識']];
  const on = new Set();
  try { const s = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(s)) s.forEach((t) => THEMES.some(([k]) => k === t) && on.add(t)); } catch (e) { /* 覚えられない時は毎回なし */ }
  const save = () => { try { if (on.size) localStorage.setItem(KEY, JSON.stringify([...on])); else localStorage.removeItem(KEY); } catch (e) { /* 同上 */ } };

  // ---------------------------------------------------------------- 灯り：マウスの周り（スマホは最後に触れた所）。地図の上にいる時だけ
  const lamp = { x: 0, y: 0, on: false };
  const coarse = matchMedia('(pointer: coarse)');      // 毎回作ると、札の数×毎コマで重かった（2026-10-30）
  const R = () => (coarse.matches ? 130 : 170) * (window.DEAI_TOOL && DEAI_TOOL.chochin ? 1.45 : 1);     // 提灯（であい帖の道具）で広く。光の輪は index.html の body.tool-chochin
  const glow = $('#lamp');
  const MAPS = '#gl, #pins, #inlabels, #mame, #ranks';
  function put(e, v) {
    lamp.x = e.clientX; lamp.y = e.clientY; lamp.on = v;
    glow.style.transform = `translate(${lamp.x}px, ${lamp.y}px)`;
    glow.classList.toggle('on', v);
  }
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') { if (e.buttons) put(e, true); return; }   // 指は押している間だけ動かす（離した後は、その場に残す）
    put(e, !!(e.target.closest && e.target.closest(MAPS)));
  }, { passive: true });
  addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest(MAPS)) put(e, true); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { lamp.on = false; glow.classList.remove('on'); });
  // 濃さ：灯りの真ん中から 65% までは 1、外へ向かって 0 へ
  function near(x, y) {
    if (!lamp.on) return 0;
    const r = R(), d = Math.hypot(x - lamp.x, y - lamp.y);
    return d >= r ? 0 : Math.min(1, (r - d) / (r * 0.35));
  }
  const show = (t, x, y) => (on.has(t) ? 1 : near(x, y));

  // ---------------------------------------------------------------- 「札」の窓
  const btn = $('#fuda-open'), panel = $('#fuda');
  const chips = $('#fuda-chips');
  for (const [k, name] of THEMES) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.t = k; b.textContent = name;
    b.addEventListener('click', () => { if (on.has(k)) on.delete(k); else on.add(k); changed(); });
    chips.appendChild(b);
  }
  const bAll = document.createElement('button'); bAll.type = 'button'; bAll.className = 'all';
  bAll.addEventListener('click', () => { all(on.size < THEMES.length); });
  chips.appendChild(bAll);
  function label() {
    // 見る情報（見る物.js）を絞っている時は、ボタンの頭に出す（絞ったまま忘れて「印が出ない」と迷わないように）
    const miru = window.MIRU && !MIRU.all ? '見る：' + MIRU.label() + '／' : '';
    btn.textContent = miru + '札：' + (!on.size ? '灯りだけ' : on.size === THEMES.length ? '全部' : THEMES.filter(([k]) => on.has(k)).map(([, n]) => n).join('・'));
    for (const b of chips.querySelectorAll('button[data-t]')) b.setAttribute('aria-pressed', on.has(b.dataset.t));
    bAll.textContent = on.size === THEMES.length ? '全部しまう' : '全部出す';
  }
  function changed() { save(); label(); }
  function all(v) { on.clear(); if (v) THEMES.forEach(([k]) => on.add(k)); changed(); }
  btn.addEventListener('click', () => panel.classList.toggle('open'));
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && panel.classList.contains('open') && !e.target.closest('input')) { panel.classList.remove('open'); e.stopImmediatePropagation(); }
  }, true);
  addEventListener('pointerdown', (e) => { if (panel.classList.contains('open') && !e.target.closest('#fuda, #fuda-open')) panel.classList.remove('open'); });
  label();
  addEventListener('miru', label);
  addEventListener('load', label);

  window.FUDA = {
    THEMES, show, near, lamp,
    has: (t) => on.has(t),
    set: (t, v) => { if (v) on.add(t); else on.delete(t); changed(); },
    all,
    get state() { return { on: [...on], lamp: { ...lamp } }; },
  };
})();
