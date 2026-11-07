// ひとつ前へ（本人 2026-10-30「一つ前にもどる機能が欲しい。ブラウザだとちょっと挙動が違う」）：
// ブラウザの戻るは「県を浮かせた・県の中へ入った」の段だけを戻すので、寄った所・押して飛んだ先へは戻れない。
// ここでは見ていた眺め（全国か県の中か・浮かせた県・カメラ）を、止まった所ごとに覚え、ボタン（か Backspace）で1つずつ戻る。
// 覚えるのは、カメラが 0.8 秒止まり、前に覚えた所から十分に動いた時だけ。遊覧・空を飛ぶ・幕の間は覚えない
(function () {
  'use strict';
  const M = window.MAP3D;
  if (!M) return;
  const btn = document.querySelector('#back-one');
  const MAX = 40, stack = [];
  let rest = null, key = '', since = 0, restoring = false, pending = null;
  const snap = () => ({ w: M.inside ? M.inside.name : null, sel: M.sel, g: { x: M.goal.x, y: M.goal.y, z: M.goal.z, D: M.goal.D, th: M.goal.th, ph: M.goal.ph } });
  const turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const far = (a, b) => a.w !== b.w || a.sel !== b.sel || Math.hypot(a.g.x - b.g.x, a.g.z - b.g.z) > 0.3 * Math.min(a.g.D, b.g.D)
    || Math.abs(Math.log(a.g.D / b.g.D)) > 0.4 || turn(a.g.th, b.g.th) > 0.6 || Math.abs(a.g.ph - b.g.ph) > 0.35;
  const busy = () => ['touring', 'flying'].some((c) => document.body.classList.contains(c)) || document.querySelector('#veil.on');
  const ui = () => { btn.disabled = !stack.length; };

  M.on('frame', () => {
    const g = M.goal, k = [g.x, g.z, g.D, g.th, g.ph].map((v) => v.toFixed(3)).join(), t = performance.now();
    if (k !== key) { key = k; since = t; return; }
    if (t - since < 800 || busy() || pending) return;
    const s = snap();
    if (rest && !far(rest, s)) return;
    // 戻した先に着いた時は、戻る前の所を覚えない（覚えると、次の「ひとつ前へ」で行ったり来たりした）
    if (rest && !restoring) { stack.push(rest); if (stack.length > MAX) stack.shift(); ui(); }
    restoring = false; rest = s;
  });
  // 県の中へ入り直した後に、覚えていたカメラへ（入ると、まず県の中の入口の眺めに置かれる）
  M.on('world', (w) => { if (pending && w && w.name === pending.w) { M.view(pending.g); pending = null; } });

  function back() {
    const S = stack.pop();
    ui();
    if (!S) return;
    restoring = true;
    const here = M.inside ? M.inside.name : null;
    const onNation = () => {
      if (S.sel !== M.sel) { if (S.sel >= 0) M.select(S.sel); else M.back(); }
      M.view(S.g);
    };
    if (S.w === here) { if (!S.w) onNation(); else M.view(S.g); return; }
    if (!S.w) { M.leave(onNation); return; }
    // 別の県の中か、全国から県の中へ：県を浮かせて「〇〇の中へ」を押す（初めての県は地図を組み立てる）
    pending = S;
    M.leave(() => {
      M.select(S.sel);
      requestAnimationFrame(() => { const b = document.querySelector('#c-enter'); if (b && !b.disabled) b.click(); else pending = null; });
    });
  }
  btn.addEventListener('click', back);
  addEventListener('keydown', (e) => {
    if (e.code !== 'Backspace' || e.target.closest('input, textarea') || busy()) return;
    back(); e.preventDefault();
  });
  ui();
  // 検査用
  window.MODORU = { back, get depth() { return stack.length; }, get rest() { return rest; } };
})();
