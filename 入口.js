// 入口（本人 2026-10-27）：開くと、日本列島を北が上・真上に近い所から見る一般的な俯瞰で見せ、題と「〇〇から始める」を出す。
// 地方を押すと、その地方へ回りながら下りていき、鳥瞰図の眺め（南南東から約30°）で寄る。「日本全体をながめる」は全国の鳥瞰図へ。
// 入口の間は検索と下の札をしまう。左上の題を押すと、いつでも入口へ戻る。?open=0 で入口を出さずに開く（検査用）
(function () {
  'use strict';
  const M = window.MAP3D;
  if (!M) return;
  const $ = (s) => document.querySelector(s);
  // 地方（県の番号は北から 1〜47）。沖縄は九州から離れていて、一緒に収めると遠くなりすぎるので分ける
  // 4つ目＝県ぜんたいを収める（北海道は北方領土まで、沖縄は宮古・八重山まで。ほかの地方は遠く離れた島を除いて寄る）
  const REGIONS = [['北海道', 1, 1, true], ['東北', 2, 7], ['関東', 8, 14], ['中部', 15, 23], ['近畿', 24, 30], ['中国', 31, 35], ['四国', 36, 39], ['九州', 40, 46], ['沖縄', 47, 47, true]];
  // 北が上、真上に近い所から全47県。パソコンは右のボタンの札を、スマホは下のボタンの札を避けて収める
  // スマホの下の端は、入口の欄の上の端を測って決める（欄の背は画面の大きさで変わる。2026-11-12 入口を5つの選択肢にして欄が高くなり、決め打ちでは九州・沖縄を隠した）
  const lowY = () => { const r = $('#o-regions').getBoundingClientRect(); return r.height ? Math.min(0.3, 1 - 2 * (r.top - 22) / innerHeight) : -0.12; };
  const VIEW = () => M.fit(M.OVER.th, M.OVER.ph, null, M.phone() ? [-0.97, 0.97, lowY(), 0.9] : [-0.95, 0.6, -0.92, 0.88]);
  let open = !/[?&]open=0/.test(location.search), first = true;
  let region = null;                          // 「〇〇から始める」で選んだ地方（遊覧の基点に使う。全体・入口へ戻ると忘れる）
  const tourBtn = $('#tour-nat');
  // ボタンはアイコン（名前は .lab と、乗せた時の説明 data-tip）
  const setRegion = (r) => { region = r; const t = r ? r[0] + 'から遊覧' : '全国を遊覧'; tourBtn.querySelector('.lab').textContent = t; tourBtn.dataset.tip = t + '（見ている所から）'; };

  const list = $('#o-regions .list');
  REGIONS.forEach((r, i) => {
    const name = r[0];
    const bt = document.createElement('button'), c = document.createElement('span'), tail = document.createElement('span');
    tail.textContent = 'から始める'; tail.className = 'tail';     // 雲には名前だけ（見出しが「どこから旅を始めますか」）。読み上げには残す
    c.className = 'c'; c.append(name, tail); bt.append(c);
    bt.className = 'o-cloud' + (i % 2 ? ' flip' : ''); bt.type = 'button';
    bt.dataset.region = name;
    bt.addEventListener('click', () => go(r));
    list.appendChild(bt);
  });
  // 季節と時刻（本人 2026-10-31「季節や時間もリアルなのか、好みのものを最初に選べるように」）：
  // とき.js の窓のボタンをそのまま押す（作りを二重に持たない）。押した状態は とき.js の今の決まりから映す
  const tokiBtns = [...document.querySelectorAll('#o-toki button, #o-hour button')];
  for (const b of tokiBtns) b.addEventListener('click', () => {
    if (b.dataset.now) $('#toki-now').click();
    else if (b.dataset.s) document.querySelector(`#seasons button[data-s="${b.dataset.s}"]`).click();
    else document.querySelector(`#toki-quick button[data-h="${b.dataset.h}"]`).click();
    tokiSync();
  });
  function tokiSync() {
    const st = window.TOKI && TOKI.state;
    if (!st) return;
    const now = st.mode.season === 'now' && st.mode.time === 'now';
    for (const b of tokiBtns) {
      const v = b.dataset.now ? now : b.dataset.s ? st.mode.season !== 'now' && +b.dataset.s === st.season : st.mode.time !== 'now' && Math.abs(+b.dataset.h - st.hour) < 0.01;
      b.setAttribute('aria-pressed', String(v));
    }
  }
  M.on('season', tokiSync); M.on('time', tokiSync); M.on('ready', () => setTimeout(tokiSync, 0));

  function show() {
    if (M.inside || (window.TABI && TABI.state)) return;     // 県の中・空を飛ぶ間は、まず出てから
    if (window.YURAN && YURAN.state) YURAN.end(false);
    open = true; setRegion(null); panel.dataset.stage = 'start'; panel.classList.remove('paper'); come();
    document.body.classList.add('opening', 'again');           // again＝開いた後に戻ってきた入口（端末の「戻る」で閉じる。最初の入口は閉じこめない）
    if (M.sel >= 0) M.back();
    M.view(VIEW());
  }
  // 入口から地図へ入る時、スマホはメニューをたたんでおく（本人 2026-11-12「今あるようなその他のメニューは、メニューとして隠しておく。
  // 画面が見えないのはもったいない。特にスマホでは」）。右下の「メニュー」で開く。たたむのは最初の1回だけ（開いた人の選びを覆さない）
  let fold = open && !/[?&]fold=0/.test(location.search);     // ?fold=0＝たたまない（検査用。下の並びを使う検査が多いので）
  function close() {
    ghost('dive');
    open = false; document.body.classList.remove('opening', 'again');
    if (fold && M.phone()) { fold = false; document.body.classList.add('wide'); dispatchEvent(new Event('resize')); }
  }
  function go(r) {
    close(); setRegion(r);
    M.fitRegion(M.P.filter((p) => p.n >= r[1] && p.n <= r[2]).map((p) => p.k), r[3]);
  }
  function wholeView() { close(); setRegion(null); M.view(Object.assign({}, M.HOME)); }

  // 最初のコマで真上からの眺めに置く（「地図をひろげています」の幕の裏で。全国の鳥瞰図が一瞬見えないように）
  M.on('frame', () => {
    if (!first) return;
    first = false;
    if (open) { document.body.classList.add('opening'); M.view(VIEW(), true); come(1.5); }
  });
  M.on('select', () => { if (open) close(); });                // 地図の県を押したら、入口を閉じてその県へ
  $('#o-all').addEventListener('click', wholeView);
  // 遊覧で旅する：出発の県はくじで（全国から）
  const tourNat = () => { close(); setRegion(null); if (window.YURAN) YURAN.startNat(); };
  $('#o-tour').addEventListener('click', tourNat);
  // 入口の段（本人 2026-11-12「大きくロゴでオープニング。次に選択肢：自分で選んで歩く→エリア／まずは遊覧→全国・指定県／すごろく／
  // 正統派クイズ→全国版・指定県版（かたち当ても）／全国宝さがし」）。「自分で選んで歩く」は今の欄（地方・季節と時刻・日本全体）
  const panel = $('#o-regions');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  // 去る雲：今見えている雲を写して欄の外（body）に置き、gone＝風下へ流して消す／dive＝手前へふくらませて消す（白い霞を添える）。欄は閉じても写しは残る
  function ghost(cls) {
    if (calm.matches || !open) return;
    const out = [];
    for (const b of panel.querySelectorAll('.o-cloud')) {
      const r = b.getBoundingClientRect();
      if (!r.width) continue;
      const g = b.cloneNode(true);
      g.removeAttribute('id'); g.inert = true; g.classList.add('o-ghost');
      Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      document.body.append(g); out.push(g);
    }
    if (cls === 'dive') { const m = document.createElement('div'); m.id = 'o-mist'; document.body.append(m); setTimeout(() => m.remove(), 1200); }
    requestAnimationFrame(() => requestAnimationFrame(() => { for (const g of out) g.classList.add(cls); }));
    setTimeout(() => { for (const g of out) g.remove(); }, 1000);
  }
  // 来る雲：欄の雲を風上から流しこむ（delay＝最初だけ、題字が消えるのを待つ）
  function come(delay) {
    if (calm.matches) return;
    panel.style.setProperty('--cd', (delay || 0) + 's');
    panel.classList.remove('come'); void panel.offsetWidth; panel.classList.add('come');
  }
  const stage = (s, kept) => {
    if (!kept) ghost('gone');
    panel.dataset.stage = s; panel.scrollTop = 0; panel.classList.toggle('paper', s === 'walk');
    come();
  };
  $('#o-walk-go').addEventListener('click', () => stage('walk'));
  for (const b of document.querySelectorAll('#o-regions .o-back')) b.addEventListener('click', () => stage('start'));
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function sub(title, opts) {
    ghost('gone');
    const box = $('#o-sub'), back = mk('button', 'o-back', '‹ 入口へ');
    box.textContent = ''; box.className = 'stage';
    back.type = 'button'; back.addEventListener('click', () => stage('start'));
    box.append(back, mk('p', null, title));
    opts.forEach(([label, fn], i) => { const b = mk('button', 'big o-cloud' + (i % 2 ? ' flip' : '')); b.append(mk('span', 'c', label)); b.type = 'button'; b.addEventListener('click', fn); box.append(b); });
    stage('sub', true);
  }
  // 県を選ぶ：地方ごとに47都道府県
  function pickPref(title, fn) {
    sub(title, []);
    panel.classList.add('paper');
    const box = $('#o-sub');
    for (const [name, a, b] of REGIONS) {
      const g = mk('div', 'prefs');
      for (const p of M.P.filter((q) => q.n >= a && q.n <= b)) { const bt = mk('button', null, p.name); bt.type = 'button'; bt.addEventListener('click', () => fn(p.n)); g.append(bt); }
      box.append(mk('p', 'reg', name), g);
    }
  }
  // 選んだ県の中へ入ってから始める（遊覧・県のクイズは県の中でしか動かない）
  let afterIn = null;
  function intoPref(n, then) {
    close(); setRegion(null);
    const p = M.P.find((q) => q.n === n);
    afterIn = { name: p.name, then };
    M.select(p.k);
    setTimeout(() => { const e = $('#c-enter'); if (e) e.click(); }, 600);
  }
  M.on('world', (w) => { if (w && afterIn && w.name === afterIn.name) { const f = afterIn.then; afterIn = null; setTimeout(f, 900); } });
  // 全国の遊覧は出発の地方を選ぶ（本人 2026-11-13「全国遊覧の場合は、開始位置をどこからにするかを選ぶように」）。
  // 選んだ地方の先頭の県から回り、沖縄の次は北海道へつないで一巡する（遊覧.js の natOrder）。9つの雲は3列に
  function pickStart() {
    sub('どこから出発しますか', REGIONS.map((r) => [r[0] + 'から', () => { close(); setRegion(r); if (window.YURAN) YURAN.startNat(); }]));
    $('#o-sub').classList.add('grid3');
  }
  $('#o-yuran').addEventListener('click', () => sub('まずは遊覧する', [
    ['全国を遊覧する', pickStart],
    ['県を選んで遊覧する', () => pickPref('どの県を遊覧しますか', (n) => intoPref(n, () => window.YURAN && YURAN.start()))],
  ]));
  $('#o-quiz').addEventListener('click', () => sub('正統派クイズに挑戦', [
    ['全国版（10問）', () => { wholeView(); if (window.QUIZ) QUIZ.start('round'); }],
    ['県を選んで（10問）', () => pickPref('どの県のクイズにしますか', (n) => intoPref(n, () => window.QUIZ && QUIZ.start('pref')))],
    ['かたち当て（10問）', () => { wholeView(); if (window.QUIZ) QUIZ.start('shape'); }],
  ]));
  // すごろく（本人 2026-11-11「スマホで見ても双六の入り口がわからない」）：クイズの窓の奥だけでなく、最初の画面からも入れる
  $('#o-sugo').addEventListener('click', () => { wholeView(); if (window.SUGO) SUGO.open(); });
  // 「全体」は入口へ（本人 2026-10-29「全体の俯瞰にもどった時に、初期のエリア選択ができない」）：真上の俯瞰と「どこから旅を始めますか」。
  // 県の中にいる時は、全国へ出てから（出る前に開くと、県の中の眺めの上に入口が重なる）
  let pending = false;
  document.querySelector('#views [data-v="all"]').addEventListener('click', () => { setRegion(null); if (M.inside) pending = true; else show(); });
  M.on('world', (w) => { if (!w && pending) { pending = false; show(); } });
  $('#title').title = 'はじめの画面へ';
  $('#title').addEventListener('click', show);
  addEventListener('keydown', (e) => { if (open && e.code === 'Escape' && !document.body.classList.contains('ui-wait')) { wholeView(); e.stopImmediatePropagation(); } }, true);

  // 絵図帳（訪れた人が足跡を残す宿帳。本人 2026-11-07）：宿帳は入口に置く。住所は出典の窓の #ask-link の1か所だけ。
  // フォームの住所が入るまでは、絵図帳の字を全部しまう（押しても開かない物を出さない）
  const book = $('#ask-link');
  document.body.classList.toggle('no-book', !/^https:/.test(book.getAttribute('href')));
  const toBook = book.cloneNode(true);
  toBook.removeAttribute('id'); toBook.className = 'o-book book-only'; toBook.textContent = '絵図帳に足跡を残す ›';
  $('#o-regions').appendChild(toBook);

  window.OPENING = { show, close, go: (name) => { const r = REGIONS.find((x) => x[0] === name); if (r) go(r); }, get open() { return open; }, get region() { return region; },
    regions: REGIONS };                       // 豆知識帳の地方の分け方も同じ
})();
