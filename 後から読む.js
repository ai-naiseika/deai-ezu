// 開いた後に読む（本人了承 2026-11-07：最初の読み込みは圧縮後 800KB まで）：地図の絵に要る物だけを先に読み、検索・札・クイズと紹介のデータは最初の絵が出てから読む。
// 読み終わるまで、県を押す・地方のボタンは効かせない（body.ui-wait と #o-go の inert）。効かない物が効きそうに見えないよう、ボタンは薄くして「読み込み中」と出す。
// 読めなかった時は「もう一度」でページを読み直す（読めた物は手元に残っているので速い）。読む順はこの並びのとおり（async=false）。検査が待つ window.__ready もここで立てる
(function () {
  'use strict';
  const M = window.MAP3D;
  if (!M) return;
  const FILES = ['地名.js', '紹介.js', '名物の絵.js', '案内.js', '一言.js', '県の中.js', '遊覧.js', '旅.js', '輪くぐり.js', '豆知識.js', '音楽.js', '駅.js', '戻る.js', 'クイズ.js', 'すごろくの台帳.js', 'すごろく.js', '縁の台帳.js', 'であい帖.js', '縁.js'];
  const $ = (s) => document.querySelector(s);
  $('#o-retry').addEventListener('click', () => location.reload());
  M.on('shown', () => {
    let left = FILES.length, failed = false;
    const done = () => {          // 読んだ物の「準備ができた」の知らせ（map3d.js の on が setTimeout で渡す）が済んでから開ける
      document.body.classList.remove('ui-wait');
      $('#o-go').inert = false; $('#o-sugo').inert = false; $('#o-yuran').inert = false;
      window.__ready = true;
    };
    for (const f of FILES) {
      const s = document.createElement('script');
      s.src = f; s.async = false;
      s.onload = () => { if (!--left && !failed) setTimeout(done, 0); };
      s.onerror = () => { failed = true; document.body.classList.add('ui-fail'); };
      document.head.appendChild(s);
    }
  });
})();
