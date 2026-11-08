// 日本一周すごろく（本人 2026-10-30 の遊びの6つ目・2026-11-09「すごろくも進めてください」）：家族で囲んで遊ぶ。1〜4人、こまは赤・青・黄・緑。
// みんな北海道から出発し、全国の遊覧と同じ順（遊覧.js の YURAN.order）に進んで、沖縄に着いたらゴール。着いた県は浮き上がり、その県の豆知識が1つ開く
// （豆知識帳に記録される）。着いた県に今月のお祭り（紹介の「祭り」で旬の月が今月）があれば、もう1回ふれる。記録は残さない（その場の遊び）。
// 入口はクイズの窓。字は全部 textContent
(function () {
  'use strict';
  const M = window.MAP3D, IN = window.INTRO;
  if (!M || !IN || !window.YURAN) return;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const KOMA = [['あか', '#c8402c'], ['あお', '#2f6db0'], ['きいろ', '#e0a810'], ['みどり', '#3f8a4a']];

  const box = el('div');
  box.id = 'sugo'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '日本一周すごろく');
  document.body.appendChild(box);
  const komaBox = el('div');
  komaBox.id = 'sugo-koma'; komaBox.setAttribute('aria-hidden', 'true');
  document.body.appendChild(komaBox);

  let G = null;     // { order: [県の番号], players: [{ name, color, pos, done }], turn, rolling, place, el: [こまの要素] }
  const prefOf = (n) => M.P.find((p) => p.n === n);

  // ---- さいころの目（点の並び）
  const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
  function dieSvg(n) {
    return '<svg viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="16" fill="#fffdf5" stroke="#2a3146" stroke-width="5"/>'
      + PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${n === 1 ? 13 : 9}" fill="${n === 1 ? '#c8402c' : '#2a3146'}"/>`).join('') + '</svg>';
  }

  // ---- はじめ：人数を選ぶ
  function open() {
    if (window.QUIZ) QUIZ.stop();
    stop(true);
    box.textContent = '';
    const head = el('div', 'head'), x = el('button', 'x', '×');
    x.setAttribute('aria-label', 'やめる'); x.addEventListener('click', () => stop());
    head.append(el('b', null, '日本一周すごろく'), x);
    box.append(head, el('p', 'lead', 'みんな北海道から出発して、沖縄をめざします。止まった県の豆知識が1つ開きます。お祭りの月の県に止まったら、もう1回ふれます。'));
    const row = el('div', 'row');
    for (let n = 1; n <= 4; n++) { const b = el('button', 'big', `${n}人で`); b.addEventListener('click', () => begin(n)); row.appendChild(b); }
    box.append(el('p', 'q', '何人で遊びますか？'), row);
    box.classList.add('open');
  }
  function begin(n) {
    const go = () => {
      if (M.sel >= 0) M.back();
      G = { order: YURAN.order(1), players: KOMA.slice(0, n).map(([name, color]) => ({ name, color, pos: 0, done: 0 })), turn: 0, rolling: false, rank: 0 };
      komaBox.textContent = '';
      G.el = G.players.map((p) => { const d = el('i'); d.style.background = p.color; komaBox.appendChild(d); return d; });
      komaBox.classList.add('on');
      turnView('');
      visit(G.order[0]);
    };
    if (M.inside) M.leave(go); else go();
  }

  // ---- 県へ寄る：浮かせた県が、すごろくの札を除いた空いた所に収まる眺めへ（スマホは札が下・パソコンは左。
  // 全国の遊覧と同じ真ん中の眺めにすると、スマホでこまと県が下の札に隠れた）
  function visit(n) {
    const p = prefOf(n), f = p.frame, W = M.vw, H = M.vh, c = box.getBoundingClientRect(), L = M.LIFT;
    const pts = [[f[0], f[1], L], [f[2], f[1], L], [f[0], f[3], L], [f[2], f[3], L]];
    const side = c.width > 0 && c.right < W * 0.5;
    const area = side ? [(c.right + 16) / W * 2 - 1, 0.92, -0.75, 0.72] : [-0.9, 0.9, c.width > 0 ? 1 - (c.top - 16) / H * 2 : -0.6, 0.72];
    M.tourLift(p.k);
    M.view(M.fit(M.HOME.th, 0.62, pts, area));
  }

  // ---- 番の画面：こまの並び・さいころ・止まった県の豆知識
  function turnView(news, mame) {
    box.textContent = '';
    const head = el('div', 'head'), x = el('button', 'x', '×');
    x.setAttribute('aria-label', 'やめる'); x.addEventListener('click', () => stop());
    head.append(el('b', null, '日本一周すごろく'), x);
    box.appendChild(head);
    // 押す物（さいころとボタン）をいつも上に。下に置くと、豆知識の文が長い時にスマホで札の外へはみ出して押せなかった
    const left = G.players.filter((p) => !p.done);
    if (!left.length) {
      const again = el('button', 'big', 'もう一度遊ぶ'); again.addEventListener('click', open);
      box.append(el('p', 'q', 'みんな沖縄に着きました。おつかれさまでした！'), again);
    } else {
      const cur = G.players[G.turn], die = el('div', 'die'), act = el('div', 'act');
      die.innerHTML = dieSvg(G.last || 1);
      const roll = el('button', 'big roll', `${cur.name}の番　さいころをふる`);
      roll.style.borderColor = cur.color;
      roll.addEventListener('click', () => doRoll(die, roll));
      act.append(die, roll);
      box.appendChild(act);
    }
    if (news) box.appendChild(el('p', 'news', news));
    if (mame) {
      const m = el('div', 'sg-mame');     // 「mame」は地図の豆の名前（豆の位置と大きさがかかって見えなくなった）
      m.append(el('b', null, mame.title), el('p', null, mame.text || '読み込んでいます…'));
      box.appendChild(m);
    }
    const list = el('ol', 'who');
    G.players.forEach((p, i) => {
      const li = el('li', i === G.turn && !p.done ? 'now' : '');
      const dot = el('i'); dot.style.background = p.color;
      li.append(dot, el('b', null, p.name), el('span', null, p.done ? `${p.done}着（沖縄）` : `${prefOf(G.order[p.pos]).name}（${p.pos + 1}/47）`));
      list.appendChild(li);
    });
    box.appendChild(list);
  }
  function doRoll(die, btn) {
    if (!G || G.rolling) return;
    G.rolling = true; btn.disabled = true;
    const r = 1 + Math.floor(Math.random() * 6), t0 = performance.now(), calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const spin = () => {
      if (!G) return;
      if (!calm && performance.now() - t0 < 700) { die.innerHTML = dieSvg(1 + Math.floor(Math.random() * 6)); setTimeout(spin, 80); return; }
      die.innerHTML = dieSvg(r); G.last = r;
      setTimeout(() => move(r), calm ? 200 : 400);
    };
    spin();
  }
  function move(r) {
    if (!G) return;
    const p = G.players[G.turn], goal = G.order.length - 1;
    p.pos = Math.min(goal, p.pos + r);
    const n = G.order[p.pos], pref = prefOf(n);
    let news = `${p.name}は ${r} すすんで、${M.FULL(pref.name)}へ。`, again = false;
    if (p.pos === goal) { p.done = ++G.rank; news += `ゴール！ ${p.done}着です。`; }
    else {
      const m = new Date().getMonth() + 1, fes = IN.items.find((it) => it.pref === n && it.cat === '祭り' && (it.months || []).includes(m));
      if (fes) { again = true; news += `今月は「${fes.name}」の季節。お祭りに出会ったので、もう1回ふれます！`; }
    }
    // 止まった県の豆知識（まだ知らない物を先に）。文は県ごとのファイルから
    const pool = (IN.mame || []).filter((d) => d.pref === n && !d.eki), fresh = pool.filter((d) => !(window.MAME && MAME.has(d.id)));
    const d = (fresh.length ? fresh : pool)[Math.floor(Math.random() * Math.max(1, (fresh.length ? fresh : pool).length))];
    if (!again || p.done) nextTurn();
    G.rolling = false;
    turnView(news, d);
    visit(n);                          // 札を並べた後に（札の大きさを測って、空いた所に収める）
    if (d && window.MAME) {
      MAME.record(d.id);
      if (d.text == null && M.loadIntro) M.loadIntro(n).then(() => { const t = box.querySelector('.sg-mame p'); if (t && G) t.textContent = d.text || ''; }, () => {});
    }
  }
  function nextTurn() {
    const n = G.players.length;
    for (let i = 1; i <= n; i++) { const j = (G.turn + i) % n; if (!G.players[j].done) { G.turn = j; return; } }
  }
  function stop(quiet) {
    if (G) { M.tourLift(-1); if (!quiet) M.view(Object.assign({}, M.HOME)); }
    G = null;
    komaBox.classList.remove('on'); komaBox.textContent = '';
    box.classList.remove('open');
  }

  // ---- 毎コマ：こまを県の上に置く（同じ県のこまは横にずらす）
  M.on('frame', () => {
    if (!G || M.inside) return;
    const seen = new Map();
    G.players.forEach((p, i) => {
      const pr = prefOf(G.order[p.pos]), s = M.project(pr.ax, M.liftY(pr.k) + 1, pr.az), j = seen.get(pr.n) || 0;
      seen.set(pr.n, j + 1);
      const e = G.el[i];
      if (!s.ok) { e.style.display = 'none'; return; }
      e.style.display = '';
      e.style.transform = `translate(${(s.x + j * 16 - 8).toFixed(1)}px, ${(s.y - 30).toFixed(1)}px)`;
    });
  });
  M.on('world', (w) => { if (w && G) stop(true); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && box.classList.contains('open') && !e.target.closest('input')) { stop(); e.stopImmediatePropagation(); } }, true);

  // 検査用
  window.SUGO = { open, stop, get state() { return G && { turn: G.turn, players: G.players.map((p) => ({ name: p.name, pos: p.pos, done: p.done, pref: G.order[p.pos] })), rolling: G.rolling }; } };
})();
