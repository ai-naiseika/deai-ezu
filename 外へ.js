// 出典など外のページへ（本人 2026-11-18「出典を見に各サイトへ飛んだあと、戻ろうとすると必ず2次元コードが読み取れないエラーで戻れなくなる」）：
// 指で触る端末（スマホ・タブレット）は、外のページを同じタブで開く。新しいタブで開くと、QR の読み取りアプリや SNS の中のブラウザでは
// 外のページが別のアプリ（いつものブラウザ）に開き、そこで「戻る」を押すと元のアプリ（読み取りの画面）へ戻って、地図へ帰れなかった。
// 同じタブなら、どの開き方でも「戻る」で地図へ帰る。Chrome は地図を凍らせて取っておくので、出た時の画面のまま戻る（戻るのキャッシュ。
// 2026-11-18 本物の Chrome で、スマホとパソコンの大きさ・音楽あり／なしの4通りとも確かめた）。パソコンは今までどおり新しいタブ。
// 取っておかれずに読み直しになった時（アプリの中のブラウザなど）は、出る前に覚えた県・県の中・豆知識の札へ、入口を出さずに戻す
(function () {
  'use strict';
  const M = window.MAP3D;
  if (!M) return;
  const KEY = 'zenkoku3d-out', FRESH = 30 * 60 * 1000;
  const touch = matchMedia('(pointer: coarse)');
  const note = () => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), sel: M.sel, inside: !!M.inside, mame: (window.MAME && MAME.state.open) || null })); } catch (e) { /* 覚えられない時は、戻った時に入口から */ }
  };
  const outward = (href) => { try { const u = new URL(href, location.href); return /^https?:$/.test(u.protocol) && u.origin !== location.origin ? u.href : null; } catch (e) { return null; } };
  function open(href) {
    const u = outward(href);
    if (!u) return;
    if (!touch.matches) { window.open(u, '_blank', 'noopener'); return; }
    note(); location.assign(u);
  }
  // 新しいタブで開く作りのリンク（各ファイルの target="_blank"）を、指の端末では同じタブに。押した続きの既定の動き（移る）はそのまま使う
  document.addEventListener('click', (e) => {
    if (!touch.matches || e.button) return;
    const a = e.target.closest && e.target.closest('a[href][target="_blank"]');
    if (!a || a.hasAttribute('download') || !outward(a.href)) return;
    a.removeAttribute('target');
    note();
  }, true);
  window.OUTLINK = { open };

  // 読み直しで戻った時だけ（リンク・ブックマークから開いた時は入口から）
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  let s = null;
  try { s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { /* 同上 */ }
  addEventListener('pageshow', (e) => { if (e.persisted) try { sessionStorage.removeItem(KEY); } catch (er) { /* 同上 */ } });
  if (!nav || nav.type !== 'back_forward' || !s || Date.now() - s.t > FRESH) return;
  try { sessionStorage.removeItem(KEY); } catch (e) { /* 同上 */ }
  const ready = (f) => (window.__ready ? f() : setTimeout(() => ready(f), 150));
  ready(() => {
    if (window.OPENING && OPENING.open) OPENING.close();
    if (!(s.sel >= 0 && M.P[s.sel])) return;
    const card = () => { if (s.mame && window.MAME) MAME.goTo(s.mame); };
    M.select(s.sel);
    if (!s.inside) { setTimeout(card, 700); return; }
    setTimeout(() => {
      const b = document.querySelector('#c-enter'), t0 = performance.now();
      if (b && !b.disabled) b.click();
      const wait = () => (M.inside ? setTimeout(card, 500) : performance.now() - t0 < 20000 ? setTimeout(wait, 200) : null);
      wait();
    }, 700);
  });
})();
