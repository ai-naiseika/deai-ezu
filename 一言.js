// 観光の一言（本人 2026-10-30「遊園地などの各施設や湖や山の情報なども、豆知識ほどではないですが、観光情報として随時足していく」）：
// 県の中の札（目印の施設・山・湖）に一言があれば、押すと札のそばに小さな窓を出す。もう一度押す・地図の空いた所を押す・Esc でしまう。
// 一言は 紹介.js の spots（note）と yama（<県>_山と湖.json）。出どころの照合は 紹介を確かめる.py。字は全部 textContent
(function () {
  'use strict';
  const M = window.MAP3D;
  if (!M) return;
  const box = document.createElement('div');
  box.id = 'hito'; box.setAttribute('role', 'dialog');
  document.body.appendChild(box);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let cur = null;

  function open(n, tag, kind) {
    if (cur && cur.n === n) { close(); return; }
    close();
    cur = { n, tag };
    tag.classList.add('on');
    dispatchEvent(new CustomEvent('deai', { detail: { id: n.kind ? 'yama:' + n.pref + n.name : 'spot:' + n.name, pref: n.pref } }));     // であい帖へ
    if (window.YURAN && YURAN.state && !YURAN.state.paused) YURAN.pause(true);   // 遊覧で回る間に開くと、次のコマでしまわれた
    box.textContent = '';
    const head = el('div', 'head');
    head.append(el('span', 'cat c-' + (kind === '名所' ? '鉄道' : '食'), kind), el('b', null, n.name));
    box.append(head, el('p', null, n.note));
    const foot = el('div', 'foot');
    foot.appendChild(el('small', null, `${n.mark} ${(M.MARK && M.MARK[n.mark]) || ''}`));
    for (const s of n.sources) {
      const u = M.safeUrl ? M.safeUrl(s.url) : null;
      if (!u) continue;
      const a = el('a', null, s.title + ' ›');
      a.href = u; a.target = '_blank'; a.rel = 'noopener';
      foot.appendChild(a);
    }
    box.appendChild(foot);
    box.classList.add('open');
    // 札の上か下の空いた方へ（画面の外へ出さない）
    const r = tag.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const y = r.top - h - 10 > 8 ? r.top - h - 10 : Math.min(innerHeight - h - 8, r.bottom + 10);
    box.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  }
  function close() {
    if (cur) cur.tag.classList.remove('on');
    cur = null; box.classList.remove('open');
  }
  M.on('world', close);
  M.on('deselect', close);
  M.onDismiss(() => { if (!cur) return false; close(); return true; });
  // 地図を動かすと札が動くので、窓はしまう（札の動きに付いていく窓は、文が読みにくい）
  // 空を飛ぶ・遊覧の間（free）は見る点の行き先（goal）が動かないので、いまの眺め（cam）で見る
  let last = '';
  M.on('frame', () => {
    if (!cur) return;
    const g = M.freeOn ? M.cam : M.goal, k = [g.x, g.z, g.D, g.th, g.ph].map((v) => v.toFixed(2)).join();
    if (last && k !== last) close();
    last = cur ? k : '';
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && cur && !e.target.closest('input')) { close(); e.stopImmediatePropagation(); }
  }, true);
  // 窓の外のどこを押してもしまう（地図の空いた所は M.onDismiss が受けて、県は浮いたまま）。画面の向きや大きさが変わった時も
  // （本人 2026-10-30「２回目枠外を押したときも勝手に閉じる」「出したまま画面の向きを変えると延々と残ってしまう」）
  addEventListener('pointerdown', (e) => { if (cur && !box.contains(e.target) && !cur.tag.contains(e.target) && e.target.id !== 'gl') close(); }, true);
  addEventListener('resize', () => { if (cur) close(); });
  window.HITO = { open, close, get state() { return cur && { name: cur.n.name, text: box.innerText }; } };
})();
