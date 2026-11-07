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
  const VIEW = () => M.fit(M.OVER.th, M.OVER.ph, null, M.phone() ? [-0.97, 0.97, -0.12, 0.9] : [-0.95, 0.6, -0.92, 0.88]);
  let open = !/[?&]open=0/.test(location.search), first = true;
  let region = null;                          // 「〇〇から始める」で選んだ地方（遊覧の基点に使う。全体・入口へ戻ると忘れる）
  const tourBtn = $('#tour-nat');
  // ボタンはアイコン（名前は .lab と、乗せた時の説明 data-tip）
  const setRegion = (r) => { region = r; const t = r ? r[0] + 'から遊覧' : '全国を遊覧'; tourBtn.querySelector('.lab').textContent = t; tourBtn.dataset.tip = t + '（見ている所から）'; };

  const list = $('#o-regions .list');
  for (const r of REGIONS) {
    const [name, a, b, whole] = r;
    const bt = document.createElement('button'), tail = document.createElement('span');
    tail.textContent = 'から始める';             // スマホでは名前だけ（見出しが「どこから旅を始めますか」）
    bt.append(name, tail);
    bt.dataset.region = name;
    bt.addEventListener('click', () => go(r));
    list.appendChild(bt);
  }
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
    open = true; setRegion(null);
    document.body.classList.add('opening');
    if (M.sel >= 0) M.back();
    M.view(VIEW());
  }
  function close() { open = false; document.body.classList.remove('opening'); }
  function go(r) {
    close(); setRegion(r);
    M.fitRegion(M.P.filter((p) => p.n >= r[1] && p.n <= r[2]).map((p) => p.k), r[3]);
  }
  function wholeView() { close(); setRegion(null); M.view(Object.assign({}, M.HOME)); }

  // 最初のコマで真上からの眺めに置く（「地図をひろげています」の幕の裏で。全国の鳥瞰図が一瞬見えないように）
  M.on('frame', () => {
    if (!first) return;
    first = false;
    if (open) { document.body.classList.add('opening'); M.view(VIEW(), true); }
  });
  M.on('select', () => { if (open) close(); });                // 地図の県を押したら、入口を閉じてその県へ
  $('#o-all').addEventListener('click', wholeView);
  // 遊覧で旅する：出発の県はくじで（全国から）
  $('#o-tour').addEventListener('click', () => { close(); setRegion(null); if (window.YURAN) YURAN.startNat(); });
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
