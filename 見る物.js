// 見る情報（ジャンル）で地図を絞る（本人 2026-10-31「情報のジャンルを複数選択することで何を見るか絞れるように」「ユーザーの好きなものだけ映すマップ」）。
// 紹介・目印・豆知識・駅の札は、欄 g（骨/紹介を作る.py が台帳から機械で決める）と選んだジャンルが1つでも重なれば出す。地名・山・湖・県名は地図の骨なのでいつも出す。
// 「全部」から1つ押すと、その1つだけに絞る（よくある絞り込みの動き）。そこから押すと足す・外す。最後の1つを外すと「全部」に戻る。
// 選んだ物はこの端末に覚える（localStorage）。最初の画面（入口.js）と「札」の窓の両方から選べる
(function () {
  'use strict';
  const KEY = 'zenkoku3d-miru-v1';
  const GENRES = [['kihon', '基本データ'], ['tetsudo', '鉄道'], ['nou', '農畜産'], ['gyo', '魚介'], ['shoku', '食べ物'], ['kanko', '観光'], ['rekishi', '歴史・文化'], ['shizen', '自然・生きもの']];
  const ALL = GENRES.map(([k]) => k);
  const on = new Set(ALL);
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(s) && s.some((g) => ALL.includes(g))) { on.clear(); s.forEach((g) => ALL.includes(g) && on.add(g)); }
  } catch (e) { /* 覚えられない時は毎回「全部」 */ }
  const all = () => on.size === ALL.length;
  const save = () => { try { if (all()) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify([...on])); } catch (e) { /* 同上 */ } };
  const any = (g) => all() || !g || !g.length || g.some((x) => on.has(x));
  const boxes = [];

  function press(k) {
    if (k === 'all') { ALL.forEach((g) => on.add(g)); }
    else if (all()) { on.clear(); on.add(k); }
    else if (on.has(k)) { on.delete(k); if (!on.size) ALL.forEach((g) => on.add(g)); }
    else { on.add(k); if (all()) { /* そろったら「全部」と同じ */ } }
    save(); sync();
    dispatchEvent(new Event('miru'));
  }
  function sync() {
    for (const box of boxes) for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.g === 'all' ? all() : !all() && on.has(b.dataset.g)));
  }
  // 選ぶ札を box の中に並べる（最初の画面・札の窓）
  function chipsInto(box) {
    for (const [k, name] of [['all', '全部']].concat(GENRES)) {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.g = k; b.textContent = name;
      b.addEventListener('click', () => press(k));
      box.appendChild(b);
    }
    boxes.push(box); sync();
  }
  const label = () => (all() ? '全部' : GENRES.filter(([k]) => on.has(k)).map(([, n]) => n).join('・'));

  for (const q of ['#o-miru', '#fuda .chips.miru']) { const box = document.querySelector(q); if (box) chipsInto(box); }

  window.MIRU = {
    GENRES, any, chipsInto, label,
    has: (g) => on.has(g),
    get all() { return all(); },
    get state() { return all() ? ['all'] : [...on]; },
    set: (list) => { on.clear(); (list && list.length ? list : ALL).forEach((g) => ALL.includes(g) && on.add(g)); if (!on.size) ALL.forEach((g) => on.add(g)); save(); sync(); dispatchEvent(new Event('miru')); },
  };
})();
