// 豆知識（本人 2026-10-27「豆知識もあちこちにちりばめて、レコードで記録」「まだ知らない豆知識探して、その県に飛べる」）：
// 地図の上に「？」の豆を散らし、押すと豆知識が開いて豆知識帳に記録する。記録はこの端末のブラウザの中だけ（localStorage・どこにも送らない）。
// 豆知識帳の「まだ知らない豆知識へ」で、まだ開いていない豆のある県へ飛び、その豆を光らせる。
// 駅の豆知識（eki の欄）は、県の中の駅の札の「？」から開く（駅.js）。豆は探しに来た時だけ出す。
// 台帳は 紹介/豆知識.json（出どころの本文と場所を照合済み：骨/豆知識を確かめる.py）。字は全部 textContent で入れる
(function () {
  'use strict';
  const M = window.MAP3D, ALL = (window.INTRO && INTRO.mame) || [];
  if (!M || !ALL.length) return;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const KEY = 'zenkoku3d-mame-v1', HINT = 'zenkoku3d-mame-hint';
  const FOODISH = ['食', '農', '山の幸', '海と川'];          // 札の色：食べ物と産物は山吹、ほかは朱（県の紹介の札と同じ流儀）
  const catEl = (c) => el('span', 'cat c-' + (FOODISH.includes(c) ? '食' : c), c);

  // ---------------------------------------------------------------- 記録（開いた豆知識の id の並び。プライベートモードなどで使えない時は、開いている間だけ覚える）
  let canKeep = true;
  const got = new Set();
  try { const s = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(s)) s.forEach((id) => got.add(id)); } catch (e) { canKeep = false; }
  const save = () => { try { if (got.size) localStorage.setItem(KEY, JSON.stringify([...got])); else localStorage.removeItem(KEY); canKeep = true; } catch (e) { canKeep = false; } };
  const count = () => ALL.filter((d) => got.has(d.id)).length;       // 台帳から消えた豆知識の id は数えない

  // ---------------------------------------------------------------- 地図の上の豆
  const box = $('#mame');
  const beans = ALL.map((d, i) => {
    const b = el('button', 'mame' + (got.has(d.id) ? ' got' : ''));
    b.type = 'button'; b.title = '豆知識（押すと開きます）'; b.setAttribute('aria-label', '豆知識');
    b.style.setProperty('--d', ((i * 0.73) % 2.8).toFixed(2) + 's');   // またたきを1つずつずらす（そろうと点滅に見える）
    b.appendChild(el('i', null, '？'));
    box.appendChild(b);
    const B = { d, el: b, k: -1, y: null, sx: -1e4, sy: -1e4, on: false, faint: false };
    b.addEventListener('click', (e) => { e.stopPropagation(); if (cur === B) closeCard(); else open(B); });   // もう一度押すとしまう
    return B;
  });
  // 豆の上でホイールを回しても、地図が寄る・引くように（豆がホイールを受け止めて、地図が動かなかった）
  const gl = $('#gl');
  box.addEventListener('wheel', (e) => {
    e.preventDefault();
    gl.dispatchEvent(new WheelEvent('wheel', { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY, bubbles: true, cancelable: true }));
  }, { passive: false });
  let P = null, hunt = null, cur = null;
  M.on('ready', () => { P = M.P; for (const B of beans) { const p = P.find((q) => q.n === B.d.pref); B.k = p ? p.k : -1; } });
  M.on('world', () => { for (const B of beans) B.y = null; });   // 県の中へ入った・出た：地面の高さを、その地図で取り直す

  // 出す豆：入口では出さない。全国では全部、県を浮かせた時と県の中ではその県の豆だけ、全国の遊覧ではいま浮いている県の豆だけ。
  // 画面の上で重なる豆は、探している豆→まだ知らない豆→開いた豆の順に出し、あとの豆は隠す（寄ると離れて出てくる）
  const GAP = 20;
  M.on('frame', () => {
    const cl = document.body.classList, opening = cl.contains('opening'), touring = cl.contains('touring'), sel = M.sel, inside = M.inside;
    const cand = [];
    for (const B of beans) {
      B.s = null;
      let show = !opening && B.k >= 0;
      if (show) show = inside || sel >= 0 ? B.k === sel : touring ? M.lift(B.k) > M.LIFT * 0.5 : true;
      // 駅の豆知識は、県の中では駅の札の「？」が受け持つ（豆を駅に置くと札と重なる。県の中.js・駅.js）。札が出ていない間だけ、駅に光の粒を置く。
      // 全国と浮かせた県では、豆知識帳から探しに来た時だけ出す（駅の多い県だけ豆が線路ぞいに群がらないように）
      if (show && B.d.eki) show = inside ? !(M.ekiShown && M.ekiShown.has(B.d.eki)) : B === hunt;
      // 見る情報（見る物.js）で選んでいないジャンルの豆は出さない（探しに来た豆は出す）
      if (show && B !== hunt && window.MIRU && !MIRU.any(B.d.g)) show = false;
      if (!show) continue;
      // 県の中は、空を飛ぶ間に山の強め方が変わるので毎コマ取る。全国は1回だけ（県の頂点をなめるので重い）
      if (inside || B.y == null) B.y = M.groundY(B.k, B.d.x, B.d.z);
      const s = M.project(B.d.x, B.y + M.liftY(B.k) + (inside ? 0.25 : 0.4), B.d.z);
      if (s.ok && s.x > -20 && s.x < M.vw + 20 && s.y > -20 && s.y < M.vh + 20) { B.s = s; cand.push(B); }
    }
    const rank = (B) => (B === hunt ? 0 : got.has(B.d.id) ? 2 : 1);
    cand.sort((a, b) => rank(a) - rank(b));
    const put = [];
    for (const B of cand) {
      if (put.some((q) => Math.abs(q.s.x - B.s.x) < GAP && Math.abs(q.s.y - B.s.y) < GAP)) B.s = null;
      else put.push(B);
    }
    // 新しく出す豆は1コマに8つまで。県を押すとその県の豆（沖縄で51）が一斉に出て、初めて出る豆はまたたきの層をここで作るので、
    // CPU4倍で押した直後のコマが 67ms に止まった（2026-11-06 性能の記録で切り分け）。残りは次のコマから出す
    // しまう豆も1コマに24まで（全国の眺めで県を押すと、ほかの県の豆が一斉に消える）。残りは前の場所のまま次のコマへ
    let born = 0, gone = 0;
    for (const B of beans) {
      const s = B.s;
      let show = !!s;
      if (show && !B.on && born++ >= 8) { show = false; B.s = null; }
      if (!show && B.on && gone++ >= 24) continue;
      // 隠すのは display で（visibility で隠すと、隠れた豆のまたたきが毎コマ動き続け、県を押した時のコマが CPU4倍で 67〜83ms に重くなった）
      if (show !== B.on) { B.el.style.display = show ? 'block' : 'none'; B.on = show; }
      // 札.js：豆知識のテーマを出していない間は、小さな光の粒。灯り（マウスの周り）に入ると「？」になって押せる。探している豆はいつも「？」。
      // 駅の豆知識の粒は、県の中では押せない（灯りが近づくと、駅の札の「？」に替わる）
      if (show) {
        const full = B === hunt || (!(inside && B.d.eki) && (!window.FUDA || FUDA.show('豆', s.x, s.y) > 0.4));
        if (full === B.faint) { B.faint = !full; B.el.classList.toggle('faint', !full); }
      }
      if (show && (Math.abs(s.x - B.sx) > 0.3 || Math.abs(s.y - B.sy) > 0.3)) {
        B.sx = s.x; B.sy = s.y; B.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      }
    }
    // はじめての人に一度だけ：豆が見えたら、何の印かを一言（1つ開いたら、もう出さない）
    if (!hintDone && !opening && count() === 0 && beans.some((B) => B.on)) { hintDone = true; hint(); }
  });
  let hintDone = false;
  try { hintDone = !!sessionStorage.getItem(HINT); } catch (e) { /* 出せない時は毎回1度 */ }
  function hint() {
    try { sessionStorage.setItem(HINT, '1'); } catch (e) { /* 同上 */ }
    toast(matchMedia('(pointer: coarse)').matches ? '地図の光の粒は豆知識です。触れると「？」が出て、押すと開いて豆知識帳に記録されます'
      : '地図の光の粒は豆知識です。マウスを近づけると「？」が出て、押すと開いて豆知識帳に記録されます');
  }

  // ---------------------------------------------------------------- 一言の知らせ（上のまん中に数秒）
  const tst = $('#mame-toast');
  let tstT = 0;
  function toast(t) { tst.textContent = t; tst.classList.add('on'); clearTimeout(tstT); tstT = setTimeout(() => tst.classList.remove('on'), 5200); }

  // ---------------------------------------------------------------- 記録する（豆を押した時と、駅の案内で駅の豆知識を見せた時）
  function record(B) {
    const isNew = !got.has(B.d.id);
    got.add(B.d.id); save();
    B.el.classList.add('got');
    if (hunt === B) { B.el.classList.remove('hunt'); hunt = null; }
    badge();
    if (isNew) dispatchEvent(new CustomEvent('deai', { detail: { id: 'mame:' + B.d.id, pref: B.d.pref, mameNew: true } }));     // であい帖へ
    return isNew;
  }

  // ---------------------------------------------------------------- 豆知識の札（下のまん中）
  const card = $('#mame-card');
  function open(B) {
    const isNew = record(B);
    if (window.YURAN && YURAN.state && !YURAN.state.paused) YURAN.pause(true);     // 遊覧中に押したら、読む間は止める
    show(B, isNew);
    // 文と出どころは県ごとのファイル（案内.js の M.loadIntro）。まだ届いていなければ、届いた時に同じ札が開いたままなら描き直す
    if (B.d.text == null && M.loadIntro) M.loadIntro(B.d.pref).then(() => { if (cur === B) show(B, isNew); },
      () => { if (cur === B) card.querySelector('.text').textContent = '文を読めませんでした（通信を確かめてください）'; });
  }
  function show(B, isNew) {
    const d = B.d;
    card.textContent = '';
    const head = el('div', 'head');
    head.append(el('b', null, '豆知識'), catEl(d.cat), el('span', 'pref', P ? M.FULL(P[B.k].name) : ''));
    card.append(head, el('h3', null, d.title), el('p', 'text', d.text == null ? '読み込んでいます…' : d.text), el('p', 'where', d.where ? '場所：' + d.where : ''));
    if (d.sources) {
      const det = el('details', 'src'), ol = el('ol');
      det.appendChild(el('summary', null, `${d.mark} ${M.MARK ? M.MARK[d.mark] || '' : ''}・出どころ（${d.sources.length}）`));
      for (const s of d.sources) {
        const li = el('li'), u = M.safeUrl ? M.safeUrl(s.url) : null;
        if (u) { const a = el('a', null, s.title); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); } else li.textContent = s.title;
        ol.appendChild(li);
      }
      det.appendChild(ol); card.appendChild(det);
    }
    card.appendChild(el('p', 'got', (isNew ? '豆知識帳に記録しました' : '記録ずみの豆知識です') + `（${count()} / ${ALL.length}）`
      + (canKeep ? '' : '　※この画面では記録を残せません（開いている間だけ覚えています）')));
    const row = el('div', 'row');
    const bBook = el('button', null, '豆知識帳'), bNext = el('button', null, 'まだ知らない豆知識へ'), bClose = el('button', null, '閉じる');
    bBook.addEventListener('click', () => { closeCard(); openBook(); });
    bNext.addEventListener('click', nextUnknown);
    bClose.addEventListener('click', closeCard);
    if (d.text != null) { const bPic = el('button', null, '絵にして送る'); bPic.addEventListener('click', () => showPic(B)); row.append(bPic); }
    row.append(bBook, bNext, bClose); card.appendChild(row);
    card.classList.add('open'); cur = B;
  }
  function closeCard() { card.classList.remove('open'); cur = null; }

  // ---------------------------------------------------------------- 絵にして送る（ゲームの案.md「人に言いたくなる：豆知識を1枚の札にして送る」・2026-11-09）：
  // 縦長の1枚（1080×1350）に題・県・本文・場所・出どころ。字は見る人の端末の字で描く。地図の住所は入れない（試しの公開の間）。
  // 先に絵とファイルを作って見せ、「送る」の押した時にそのまま渡す（作るのを待ってから送ると、スマホが押した操作と見なさず送れないことがある）
  const pic = el('div');
  pic.id = 'mame-pic'; pic.setAttribute('role', 'dialog'); pic.setAttribute('aria-label', '豆知識の絵の札');
  document.body.appendChild(pic);
  const FONT = '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", serif';
  // 行で折る（禁則：閉じかっこ・句読点・小さい字は行の頭に置かず前の行に残す・開きかっこは行の終わりに置かず次の行へ）。max 行を超えたら「…」で終える
  const NO_HEAD = '、。，．・：；？！ー－」』）〕］｝〉》】ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々', NO_TAIL = '「『（〔［｛〈《【';
  function wrap(g, text, maxW, max) {
    const lines = [];
    let line = '';
    for (const ch of text) {
      if (line && g.measureText(line + ch).width > maxW && !NO_HEAD.includes(ch)) {
        let carry = '';
        while (line.length > 1 && NO_TAIL.includes(line[line.length - 1])) { carry = line[line.length - 1] + carry; line = line.slice(0, -1); }
        lines.push(line); line = carry + ch;
      } else line += ch;
    }
    if (line) lines.push(line);
    if (lines.length <= max) return lines;
    const out = lines.slice(0, max);
    out[max - 1] = out[max - 1].slice(0, -1) + '…';
    return out;
  }
  function drawCard(B) {
    const d = B.d, W = 1080, H = 1350, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d'), font = (s, w = 700) => { g.font = `${w} ${s}px ${FONT}`; }, X = 100, MW = W - 200;
    g.fillStyle = '#f7f0dc'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#b8922e'; g.lineWidth = 8; g.strokeRect(36, 36, W - 72, H - 72);
    g.strokeStyle = '#c8402c'; g.lineWidth = 2; g.strokeRect(54, 54, W - 108, H - 108);
    font(40); g.fillStyle = '#c8402c'; g.fillText('豆知識', X, 150);
    font(36, 400); g.fillStyle = '#6a6250'; g.fillText(`${d.cat}・${P ? M.FULL(P[B.k].name) : ''}`, X + 150, 150);
    font(72); g.fillStyle = '#2a3146';
    let y = 262;
    for (const l of wrap(g, d.title, MW, 2)) { g.fillText(l, X, y); y += 92; }
    g.strokeStyle = '#c9b88a'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(X, y - 34); g.lineTo(W - X, y - 34); g.stroke(); g.setLineDash([]);
    font(46, 400); y += 44;
    for (const l of wrap(g, d.text || '', MW, 9)) { g.fillText(l, X, y); y += 76; }
    font(32, 400); g.fillStyle = '#6a6250';
    if (d.where) { y += 18; for (const l of wrap(g, '場所：' + d.where, MW, 2)) { g.fillText(l, X, y); y += 46; } }
    font(28, 400);
    let ys = H - 214;
    for (const l of wrap(g, '出どころ：' + (d.sources || []).map((s) => s.title).join('／'), MW, 2)) { g.fillText(l, X, ys); ys += 40; }
    font(34); g.textAlign = 'center'; g.fillText('にっぽん であい絵図（AI内製化工房）', W / 2, H - 94);
    return c;
  }
  function showPic(B) {
    const c = drawCard(B), name = `豆知識_${B.d.title.replace(/[\\/:*?"<>|]/g, '')}.png`;
    let file = null;
    c.toBlob((b) => { file = b && new File([b], name, { type: 'image/png' }); }, 'image/png');
    pic.textContent = '';
    const row = el('div', 'row'), keep = el('button', null, '送る・保存する'), no = el('button', null, 'もどる');
    keep.addEventListener('click', () => {
      if (!file) return;
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).catch(() => {}); return; }
      const a = document.createElement('a'), u = URL.createObjectURL(file);
      a.href = u; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
    });
    no.addEventListener('click', closePic);
    row.append(keep, no);
    pic.append(c, row);
    pic.classList.add('open');
  }
  function closePic() { pic.classList.remove('open'); pic.textContent = ''; }
  M.onDismiss(() => { if (!card.classList.contains('open')) return false; closeCard(); return true; });
  // 札の外のどこを押してもしまう（地図の空いた所は M.onDismiss・押した豆は豆の側でしまう）。画面の向きや大きさが変わった時も（本人 2026-10-30）
  addEventListener('pointerdown', (e) => { if (card.classList.contains('open') && !card.contains(e.target) && !(cur && cur.el.contains(e.target)) && e.target.id !== 'gl') closeCard(); }, true);
  addEventListener('resize', () => { if (card.classList.contains('open')) closeCard(); });

  // ---------------------------------------------------------------- 豆知識帳（見つけた数・地方ごと・県ごと。開いていない豆は「？」と種類だけ）
  const btn = $('#mame-open'), book = $('#mame-book');
  function badge() { btn.textContent = `豆知識帳 ${count()} / ${ALL.length}`; }
  badge();
  btn.addEventListener('click', () => (book.classList.contains('open') ? closeBook() : openBook()));
  function openBook() {
    if (!P) return;
    closeCard(); tst.classList.remove('on');           // 知らせの帯が豆知識帳の上に重なった
    book.textContent = '';
    const n = count(), N = ALL.length;
    const close = el('button', 'close', '閉じる'); close.addEventListener('click', closeBook);
    book.append(close, el('h2', null, '豆知識帳'),
      el('p', 'lead', '地図の上の「？」を押すと、豆知識が開いて、ここに記録されます。まだ知らない豆知識の「？」を押すと、その県へ飛びます。'));
    const prog = el('div', 'prog'), bar = el('i');
    bar.style.width = (N ? n / N * 100 : 0).toFixed(1) + '%';
    prog.append(el('b', null, `見つけた豆知識 ${n} / ${N}`), el('span', 'bar'), (() => { const go = el('button', null, 'まだ知らない豆知識へ'); go.addEventListener('click', nextUnknown); return go; })());
    prog.children[1].appendChild(bar);
    book.appendChild(prog);
    const list = el('div', 'list');
    const REG = (window.OPENING && OPENING.regions) || [['全国', 1, 47]];
    const group = new Map();
    for (const B of beans) {
      const key = B.k + (B.d.eki ? 'e' : 'n');
      if (!group.has(key)) group.set(key, []);
      group.get(key).push(B);
    }
    for (const [name, a, z] of REG) {
      const inR = beans.filter((B) => B.d.pref >= a && B.d.pref <= z);
      if (!inR.length) continue;
      const sec = el('section');
      sec.appendChild(el('h3', null, `${name}（${inR.filter((B) => got.has(B.d.id)).length} / ${inR.length}）`));
      list.appendChild(sec);
      // 県ごとに1行。駅の豆知識は、その県の「駅」の行にまとめる（1行に並べると、駅の多い県の行だけ長くなった）
      for (const p of P.filter((q) => q.n >= a && q.n <= z)) for (const eki of [false, true]) {
        const mine = group.get(p.k + (eki ? 'e' : 'n'));
        if (!mine) continue;
        const row = el('div', 'pref');
        row.appendChild(el('span', 'nm', M.FULL(p.name) + (eki ? 'の駅' : '')));
        // 見つけた豆知識は題を並べ、まだ知らない物は「？ 23」の1つにまとめる（1714個を1つずつ並べると、スマホで開くのに組版だけで1秒以上止まった。2026-11-07）
        const left = [];
        for (const B of mine) {
          if (!got.has(B.d.id)) { left.push(B); continue; }
          const c = el('button', 'chip got', B.d.title);
          c.addEventListener('click', () => goTo(B, true));
          row.appendChild(c);
        }
        if (left.length) {
          const c = el('button', 'chip', '？ あと');
          c.appendChild(el('small', null, String(left.length)));
          c.title = `まだ知らない豆知識（${left.length}）。押すとその県へ飛びます`;
          c.addEventListener('click', () => goTo(left[Math.floor(Math.random() * left.length)], false));
          row.appendChild(c);
        }
        sec.appendChild(row);
      }
    }
    book.appendChild(list);
    const foot = el('div', 'foot');
    foot.appendChild(el('small', null, canKeep
      ? '記録は、この端末のこのブラウザの中だけに残ります（どこにも送りません）。ブラウザのデータを消すと、記録も消えます。'
      : 'この画面では記録を残せません（プライベートモードなど）。開いている間だけ覚えています。'));
    const clr = el('button', 'clear', '記録を消す');
    clr.addEventListener('click', () => {
      if (!clr.dataset.armed) { clr.dataset.armed = '1'; clr.textContent = 'もう一度押すと、記録を全部消します'; return; }
      got.clear(); save(); for (const B of beans) B.el.classList.remove('got'); badge(); openBook();
    });
    foot.appendChild(clr);
    book.appendChild(foot);
    book.classList.add('open');
  }
  function closeBook() { book.classList.remove('open'); }

  // ---------------------------------------------------------------- その豆へ飛ぶ：開いた豆知識なら札を開き、まだ知らない豆知識なら光らせて探してもらう
  // 探す豆へ飛ぶ時は、県を浮かせた後、見る点をその豆へ寄せる（右に札の窓が開く分は、県を浮かせる時と同じにずらす）。
  // 県の眺めは県の枠の真ん中を見るので、東西に広い沖縄では与那国の豆が画面の外に出た（2026-11-01 検査で見つけた）
  let aimAt = null;
  M.on('select', (k) => {
    if (!aimAt || aimAt.k !== k) return;
    const g = M.goal;
    M.view({ x: aimAt.d.x + Math.cos(g.th) * g.D * 0.1, z: aimAt.d.z + Math.sin(g.th) * g.D * 0.1 });
    aimAt = null;
  });
  function goTo(B, reveal) {
    closeBook(); closeCard();
    const here = M.inside && B.k === M.sel;                       // いま中にいる県の豆なら、県の外へ出ない（空を飛んでいても、そのまま探せる）
    if (window.TABI && TABI.state && !here) TABI.end();
    if (window.YURAN && YURAN.state) YURAN.end(false);
    if (window.OPENING && OPENING.open) OPENING.close();
    if (hunt) hunt.el.classList.remove('hunt');
    hunt = reveal ? null : B;
    if (hunt) B.el.classList.add('hunt');
    if (!here && M.sel !== B.k) { aimAt = reveal ? null : B; M.select(B.k); }
    if (reveal) open(B);
    else if (B.d.eki && here) toast(`${B.d.eki}駅に、まだ知らない豆知識があります。光っている駅の札を押してみてください`);
    else toast(`${M.FULL(P[B.k].name)}${B.d.eki ? 'の' + B.d.eki + '駅' : ''}に、まだ知らない豆知識があります。光っている「？」を押してみてください`);
  }
  function nextUnknown() {
    const left = beans.filter((B) => B.k >= 0 && !got.has(B.d.id));
    if (!left.length) { closeCard(); toast(`全部の豆知識（${ALL.length}）を見つけました`); return; }
    // いま見ている県の外から選ぶ（同じ県の別の豆へ飛んでも、飛んだ気がしない）。外に残っていなければ、その県の中から。
    // 先に県を選んでから豆を選ぶ（駅の豆知識の多い県ばかりに飛ばないように）
    const away = left.filter((B) => B.k !== M.sel);
    const pool = away.length ? away : left;
    const ks = [...new Set(pool.map((B) => B.k))], k = ks[Math.floor(Math.random() * ks.length)];
    const inK = pool.filter((B) => B.k === k);
    goTo(inK[Math.floor(Math.random() * inK.length)], false);
  }

  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || e.target.closest('input')) return;
    if (pic.classList.contains('open')) { closePic(); e.stopImmediatePropagation(); }
    else if (book.classList.contains('open')) { closeBook(); e.stopImmediatePropagation(); }
    else if (card.classList.contains('open')) { closeCard(); e.stopImmediatePropagation(); }
  }, true);

  // 検査用
  window.MAME = {
    get state() { return { n: ALL.length, got: count(), hunt: hunt && hunt.d.id, open: cur && cur.d.id, canKeep, shown: beans.filter((B) => B.on).length }; },
    // 位置は並べた時の値（B.s）。書いた位置（sx）は0.3画素まで遅れるので、間隔ちょうど20画素の組を検査が「重なり」と数えた（2026-11-02）
    beans: () => beans.map((B) => ({ id: B.d.id, k: B.k, eki: B.d.eki || null, on: B.on, x: B.s ? B.s.x : B.sx, y: B.s ? B.s.y : B.sy, got: got.has(B.d.id), hunt: B === hunt })),
    open: (id) => { const B = beans.find((q) => q.d.id === id); if (B) open(B); },
    next: nextUnknown, book: openBook,
    // 駅の札と駅の案内（県の中.js・駅.js）が、毎コマでも軽く読めるように
    has: (id) => got.has(id),
    huntId: () => hunt && hunt.d.id,
    record: (id) => { const B = beans.find((q) => q.d.id === id); return B ? record(B) : false; },
    count: () => [count(), ALL.length],
    goTo: (id) => { const B = beans.find((q) => q.d.id === id); if (B) goTo(B, got.has(id)); },
    // 検査用：絵の札の本文と同じ字の大きさ・幅で折った行
    lines: (text) => { const g = document.createElement('canvas').getContext('2d'); g.font = `400 46px ${FONT}`; return wrap(g, text, 880, 99); },
  };
})();
