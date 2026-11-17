// LINE の中のブラウザで開いた時（本人 2026-11-17「LINE だとデータが送れないから、クロームで開きなおす全画面表示が欲しい」）：
// LINE の中では、絵を送る・保存する・画面いっぱいに広げる、ができない。開いた時に一度だけ、画面いっぱいの案内で「いつものブラウザで開きなおす」を出す。
// 住所に openExternalBrowser=1 を付けて開くと、LINE はいつものブラウザ（Chrome・Safari）で開く（BAR・カードと同じ作り）。
// 記録（豆知識帳・であい帖）はブラウザごとなので、開きなおした先へは引き継がれない。そのことも書く
(function () {
  'use strict';
  const inLine = /\sLine\//i.test(navigator.userAgent);
  const out = (more) => { const u = new URL(location.href); for (const k in more || {}) u.searchParams.set(k, more[k]); u.searchParams.set('openExternalBrowser', '1'); return u.href; };
  // 開きなおした後は、住所の印を消す（そのまま送られると、受け取った人も LINE の外へ飛ばされる）
  if (/[?&]openExternalBrowser=1/.test(location.search)) {
    try { const u = new URL(location.href); u.searchParams.delete('openExternalBrowser'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) { /* 別の枠の中 */ }
  }
  // 外へ出る押しの前に音を止める（LINE のページは裏で生きていて、移った先から止められない）
  const hush = () => { if (window.BGM && BGM.hush) BGM.hush(); };
  window.LINEAPP = { inLine, out, hush };
  if (!inLine) return;
  const KEY = 'zenkoku3d-line-note';
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) { /* 覚えられない時は毎回出す */ }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const box = el('div'), card = el('div', 'box');
  box.id = 'line-note'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'いつものブラウザで開きなおす');
  const go = el('a', 'go', 'いつものブラウザで開きなおす'), stay = el('button', null, 'このまま LINE で見る');
  go.href = out();
  go.addEventListener('click', hush);
  stay.type = 'button';
  stay.addEventListener('click', () => { box.classList.remove('open'); try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* 同上 */ } });
  card.append(el('h2', null, 'LINE の中で開いています'),
    el('p', null, 'LINE の中では、豆知識の絵を送る・保存する、画面いっぱいに広げる、ができません。Chrome や Safari で開きなおすと、全部使えます。'),
    go, stay,
    el('small', null, '※LINE の中で集めた豆知識帳・であい帖の記録は、開きなおした先には引き継がれません。'));
  box.appendChild(card);
  document.body.appendChild(box);
  box.classList.add('open');
})();
