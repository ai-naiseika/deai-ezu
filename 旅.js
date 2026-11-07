// 旅できる県の中（第1段）：県の中の空を、鳥のように自由に飛ぶ。
// 飛ぶ間は山の強め方を高さで決める（高い所は3倍・地面に近いほど本物の高さへ）。地面にもぐらず、県の外（紙）へは出ない。
// パソコン：W・A・S・D（矢印）で進む・曲がる、E と Q で上がる・下がる、Shift で速く、ドラッグで見回す、ホイールで高さ。
// スマホ：左下のスティックで進む・曲がる、右の「上へ」「下へ」、なぞって見回す。Esc か「降りる」で、いまの眺めのまま地図へ戻る
(function () {
  'use strict';
  const M = window.MAP3D, IN = window.INTRO;
  if (!M) return;
  const U = M.inner.U, $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // 飛ぶ間の山の強め方：地面から（本物の高さで）1.5km より上は3倍、100m まで下りると1倍（本物）、間はなめらかに。
  // 9倍の山は低く飛ぶとほぼ垂直の壁になり、3倍でも地面すれすれでは山が高すぎた（本人 2026-10-30「縮尺を少しずつリアルに」）
  const EX_HI = 3, H_REAL = 0.1, H_HI = 1.5;
  const exAt = (hR) => Math.pow(EX_HI, clamp(Math.log(Math.max(hR, 1e-3) / H_REAL) / Math.log(H_HI / H_REAL), 0, 1));
  // 地面から最低 500m（本物の高さ）・いちばん高く 40km（描いた高さ）。80m まで下りられた時は、映像の荒さが目立ち、先も見えなかった
  // （本人 2026-10-30「すれすれまで飛ぶと映像の荒さが目立って良くない。もう少し高い位置より下には下がれないように」）。500m が鳥瞰図らしく読める高さ
  const MIN_R = 0.5, MAX_Y = 40;
  let minR = MIN_R;                  // 検査用：車窓のための低い所の作り（1軒ずつの家など）を確かめる時だけ下げる
  const TAKEOFF = 0.7;               // 飛び立って降りてくる高さ（本物の高さ km）
  const PITCH = [-0.35, 1.35];       // 見下ろす角（少し見上げる〜ほぼ真下）
  let F = null;                      // 飛んでいる間の状態
  let guard = true;                  // 検査用：false で地面の持ち上げを外す（判定者が、もぐったのを見つけられるかを確かめる）
  let relief = 1, reliefT = 1, lastT = performance.now();
  const box = $('#fly'), coarse = matchMedia('(pointer: coarse)').matches;

  // 山の強め方を目標へなめらかに。木と家の絵も同じ倍率で縮め、近くの絵は大きく描けるように（上限 30→140 画素）
  // 飛んでいる間は、カメラの高さも地面と一緒に縮める（地面との間を保つ）
  function updRelief(dt) {
    if (relief === reliefT) return;
    const r0 = relief;
    relief = Math.abs(reliefT - relief) < 1e-3 ? reliefT : relief + (reliefT - relief) * (1 - Math.exp(-dt * 2.5));
    U.uInY.value = relief; U.uPtK.value = relief;
    U.uPxMax.value = relief < 0.999 ? 30 + (1 - relief) * 165 : 0;      // 近くの絵の大きさの上限 30→140 画素
    // 降りた後も、地図のカメラ（見る点と見下ろす高さ）を山と同じ割合で伸ばす。カメラの高さを据え置くと、9倍に戻った山の下に入り、
    // 山にもぐらない仕組みが真上からの見下ろしまで角を上げた（巡航で赤城山のそばまで進んでから降りた時 2026-10-30）
    const f = relief / r0;
    if (F) F.y *= f;
    else for (const c of [M.cam, M.goal]) { const h = c.D * Math.sin(c.ph) * f, hd = c.D * Math.cos(c.ph); c.y *= f; c.D = Math.hypot(h, hd); c.ph = Math.atan2(h, hd); }
  }

  // ---- キー：押した場所（e.code）で受ける（日本語入力がオンでも動く）。離した知らせが届かない時もあるので、
  // くり返しの知らせが途切れたら離したとみなす（最後に押したキーだけ。前に押したキーはくり返さないので、離した知らせを信じる）
  const keys = new Map();
  let lastKey = null;
  const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'ShiftLeft', 'ShiftRight'];
  const down = (...c) => c.some((k) => keys.has(k));
  addEventListener('keydown', (e) => {
    if (!F || (e.target.closest && e.target.closest('input, textarea'))) return;
    if (e.code === 'Escape') { end(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (/^Digit[1-4]$/.test(e.code)) { M.season(+e.code.slice(5) - 1); e.stopImmediatePropagation(); return; }
    if (e.code === 'Space') { if (!e.repeat) F.cruise = !F.cruise; e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (!KEYS.includes(e.code)) return;
    keys.set(e.code, { t: performance.now(), rep: e.repeat }); lastKey = e.code;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  addEventListener('keyup', (e) => { keys.delete(e.code); }, true);
  addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => keys.clear());

  // ---- 見回す（ドラッグ）とホイール（高さ）
  const gl = $('#gl');
  let look = null;
  gl.addEventListener('pointerdown', (e) => {
    if (!F) return;
    gl.setPointerCapture(e.pointerId);
    look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  gl.addEventListener('pointermove', (e) => {
    if (!F || !look || e.pointerId !== look.id) return;
    // 動ける視点なので、見回す向き（右へなぞると右を向く）
    F.yaw += (e.clientX - look.x) * 0.0045;
    F.pitch = clamp(F.pitch + (e.clientY - look.y) * 0.0035, PITCH[0], PITCH[1]);
    look.x = e.clientX; look.y = e.clientY;
  });
  const lookEnd = (e) => { if (look && e.pointerId === look.id) look = null; };
  gl.addEventListener('pointerup', lookEnd); gl.addEventListener('pointercancel', lookEnd);
  gl.addEventListener('wheel', (e) => {
    if (!F || F.intro || F.outro) return;
    F.vy -= agl() * e.deltaY * 0.004;
    F.wheel = 0.6;
  }, { passive: true });

  // ---- スマホ：左下のスティック・右の上へ／下へ
  const pad = $('#fly-pad'), knob = pad.querySelector('i'), stick = { x: 0, y: 0, id: null };
  pad.addEventListener('pointerdown', (e) => { stick.id = e.pointerId; pad.setPointerCapture(e.pointerId); moveStick(e); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
  const stickEnd = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', stickEnd); pad.addEventListener('pointercancel', stickEnd);
  function moveStick(e) {
    const r = pad.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R;
    const L = Math.hypot(dx, dy);
    if (L > 1) { dx /= L; dy /= L; }
    stick.x = dx; stick.y = dy;
    knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
  }
  const ud = { up: false, dn: false };
  for (const [id, k] of [['#fly-up', 'up'], ['#fly-dn', 'dn']]) {
    const b = $(id);
    b.addEventListener('pointerdown', (e) => { ud[k] = true; b.setPointerCapture(e.pointerId); e.preventDefault(); });
    for (const t of ['pointerup', 'pointercancel']) b.addEventListener(t, () => { ud[k] = false; });
  }

  function agl() { return F ? F.y - F.w.heightAt(F.x, F.z) : 0; }
  const kY = () => F.w.exag * relief;                            // 本物の高さ 1km が、いま描いた高さで何 km か
  // 前へ押した時の速さ（km/秒）。高いほど速く、地面に近いほど遅い（100m で時速およそ500km、巡航はその4割）
  const speedAt = (hR) => clamp(0.03 + hR * 1.35, 0.03, 6);
  const CRUISE = 0.4;                                           // 何も押さない時の巡航（前へ押した時の4割）

  function start() {
    const w = M.inside;
    if (!w || F) return;
    if (window.YURAN && YURAN.state) YURAN.end(false);
    const c = M.cam, cp = Math.cos(c.ph), sp = Math.sin(c.ph);
    const from = { x: c.x - Math.sin(c.th) * cp * c.D, y: c.y + sp * c.D, z: c.z + Math.cos(c.th) * cp * c.D, pitch: c.ph };
    // 飛び立つ：いま見ている所の 6km 手前、地面から 700m（本物の高さ）へ、2秒あまりで降りてくる。向きはそのまま、少し見下ろす
    // 降りてくる先は前へ巡航の速さで進み、カメラはそれを追って、止まらずにそのまま巡航へ移る
    // （前は降りてきて止まり、本人に「飛ぶというより着陸する感じ」と言われた。2026-10-30）
    const to = { x: clamp(c.x - Math.sin(c.th) * 6, w.box[0], w.box[2]), z: clamp(c.z + Math.cos(c.th) * 6, w.box[1], w.box[3]), aglR: TAKEOFF, pitch: 0.3 };
    F = { w, x: from.x, y: Math.min(from.y, MAX_Y * 4), z: from.z, yaw: c.th, pitch: c.ph, vx: 0, vy: 0, vz: 0, aim: null, near: null, tick: 0,
      cruise: true, intro: { t: 0, to } };
    reliefT = exAt(TAKEOFF) / w.exag;
    keys.clear();
    document.body.classList.add('flying');
    U.uNear3D.value = 1;                                // 近くの家を立体に（県の中.js・描き込み.js）
    $('#f-keys').textContent = coarse ? 'ひとりでに前へ進みます。左下のスティック：上で進む・下で止まる・左右で曲がる　右の「上へ」「下へ」　画面をなぞって見回す'
      : 'ひとりでに前へ進みます　W・↑ 速く　S・↓ 止まる（押し続けると後ろへ）　スペース 止まる／進む　A・D・←→ 曲がる　E 上がる　Q 下がる　Shift もっと速く　ドラッグで見回す　ホイールで高さ';
    status();
    M.free(step);
  }
  // 降りる：いまの所から、地図のいつもの眺め（見下ろす角 0.85・見る点は前方の地面）へ 1.3秒で上がってから、地図へ渡す。
  // 低い所の眺めのまま渡すと、山の強め方が9倍へ戻る間に、地図のカメラ（まわりの地面から 2km あける決まり）が山を避けて真上まで角を上げた
  // （2026-10-30。本物の高さに近い所から降りた時）。行き先は県の中の強め方（5倍）に戻った後の大きさで決め、毎コマいまの強め方に縮めて置く
  function end() {
    if (!F || F.outro) return;
    const w = F.w, b = w.box, k = U.uInY.value, fx = Math.sin(F.yaw), fz = -Math.cos(F.yaw), PHF = 0.85;
    const g9 = (x, z) => w.heightAt(x, z) / k;
    let Df = clamp((F.y - w.heightAt(F.x, F.z)) / k / Math.sin(PHF), 10, 80), Q1 = null, P1 = null;
    for (let n = 0; n < 8; n++) {
      const hd = Df * Math.cos(PHF), qx = clamp(F.x + fx * hd, b[0], b[2]), qz = clamp(F.z + fz * hd, b[1], b[3]);
      Q1 = [qx, g9(qx, qz), qz]; P1 = [qx - fx * hd, Q1[1] + Df * Math.sin(PHF), qz - fz * hd];
      // 地図のカメラの決まり（map3d.js の SIGHT）より 2割ゆとりを持って。ぎりぎりだと、渡した瞬間に角が 0.15 跳ねた
      const ok = [[1, 2], [0.8, 1.5], [0.6, 1.5], [0.45, 1.2], [0.3, 0.8], [0.2, 0.6]]
        .every(([t, m]) => Q1[1] + (P1[1] - Q1[1]) * t >= g9(Q1[0] + (P1[0] - Q1[0]) * t, Q1[2] + (P1[2] - Q1[2]) * t) + m * 1.2);
      if (ok) break;
      Df *= 1.3;
    }
    F.outro = { t: 0, P0: [F.x, F.y / k, F.z], Q0: [M.cam.x, M.cam.y / k, M.cam.z], P1, Q1 };
    reliefT = 1; keys.clear(); look = null;
  }
  function outro(dt) {
    const O = F.outro, k = U.uInY.value;
    O.t += dt;
    const s = clamp(O.t / 1.3, 0, 1), e = s * s * (3 - 2 * s), L = (i, A, B) => A[i] + (B[i] - A[i]) * e;
    const P = [L(0, O.P0, O.P1), L(1, O.P0, O.P1) * k, L(2, O.P0, O.P1)], Q = [L(0, O.Q0, O.Q1), L(1, O.Q0, O.Q1) * k, L(2, O.Q0, O.Q1)];
    const dx = P[0] - Q[0], dz = P[2] - Q[2], hd = Math.max(Math.hypot(dx, dz), 1e-4);
    Object.assign(M.cam, { x: Q[0], y: Q[1], z: Q[2], D: Math.hypot(hd, P[1] - Q[1]), th: Math.atan2(-dx, dz), ph: Math.atan2(P[1] - Q[1], hd) });
    if (s >= 1) finish();
  }
  // 地図へ渡す（降りた後・県の外へ出た時）
  function finish() {
    if (!F) return;
    F = null; look = null; keys.clear(); reliefT = 1;
    document.body.classList.remove('flying');
    U.uNear3D.value = 0; U.uNearR.value = 0; U.uNearK.value = 0;
    M.free(null);
  }

  // ---- 毎コマ（free の間は map3d の代わりにカメラを置く）
  function step(dt) {
    lastT = performance.now();
    updRelief(dt);
    // 低い所の作り（県の中.js の1軒ずつの家・1本ずつの木・実の大きさの電車・霞）：カメラが地面から（本物で）100m より低いと全部、450m より高いと無し。
    // 空を飛ぶの下限（500m）では働かない。全国がそろった後の車窓モードで使う（本人 2026-10-30「車窓からの眺めは全国そろってから」）
    const cp0 = M.inner.camera.position, tN = clamp(((cp0.y - F.w.heightAt(cp0.x, cp0.z)) / kY() - 0.1) / 0.35, 0, 1);
    U.uNearK.value = 1 - tN * tN * (3 - 2 * tN);        // 0＝地図の大きさ・1＝実の大きさの見当（電車・線路の帯も縮める）
    U.uNearR.value = (coarse ? 1.0 : 2.2) * U.uNearK.value;
    U.uPtK.value = relief * (1 - 0.7 * U.uNearK.value);  // 木と家の絵札も同じ割合で（木 60m → 20m ほど）
    // 地面の模様の細かさ（map3d の uPatK）：飛ぶ高さ（上がる・下がる時に決めた物）の5倍先の1画素の大きさで、画面ぜんたい1つ
    // （3倍では、画面の中ほどの田畑の区画まで細かすぎて平らな色に溶けた）
    U.uPatK.value = (F.patH != null ? F.patH : TAKEOFF) * kY() * 5 / U.uPpk.value;
    if (F.outro) { outro(dt); return; }
    const w = F.w, b = w.box;
    if (F.intro) {
      const I = F.intro, a = 1 - Math.exp(-dt * 2.2), fx = Math.sin(F.yaw), fz = -Math.cos(F.yaw);
      I.t += dt;
      const v = CRUISE * speedAt(I.to.aglR) * clamp(I.t / 1.2, 0, 1);
      I.to.x = clamp(I.to.x + fx * v * dt, b[0], b[2]); I.to.z = clamp(I.to.z + fz * v * dt, b[1], b[3]);
      const ty = w.heightAt(I.to.x, I.to.z) + I.to.aglR * kY();
      F.x += (I.to.x - F.x) * a; F.z += (I.to.z - F.z) * a; F.y += (ty - F.y) * a;
      F.pitch += (I.to.pitch - F.pitch) * a;
      if (I.t > 4 || (I.t > 1.2 && Math.hypot(I.to.x - F.x, I.to.z - F.z) < v / 2.2 * 1.5 + 0.05 && Math.abs(ty - F.y) < 0.07 * kY())) {
        F.intro = null; F.vx = fx * v; F.vz = fz * v;
      }
    } else {
      // 押しっぱなしの知らせが途切れたら、離したとみなす
      const k = lastKey && keys.get(lastKey);
      // くり返しが始まるまでの待ちは、Windows の設定で最長1秒。それより長く待つ
      if (k && performance.now() - k.t > (k.rep ? 450 : 1100)) { keys.delete(lastKey); lastKey = null; }
      // 何も押さなければ巡航（前へ CRUISE）。前へ押すと巡航に戻り、後ろへ押すと巡航をやめる（止まる。押し続けると後ろへ）
      const kf = clamp((down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0) - stick.y, -1, 1);
      if (kf > 0.3) F.cruise = true; else if (kf < -0.3) F.cruise = false;
      const fwd = F.cruise ? Math.max(kf, CRUISE) : kf;
      const turn = clamp((down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0) + stick.x, -1, 1);
      const rise = (down('KeyE', 'PageUp') || ud.up ? 1 : 0) - (down('KeyQ', 'PageDown') || ud.dn ? 1 : 0);
      const h = agl(), hR = h / kY(), fast = down('ShiftLeft', 'ShiftRight') ? 3 : 1;
      // 山の強め方と地面の模様の細かさは、自分で上がる・下がる間だけ高さに合わせる。足もとの起伏で毎コマ変えると、
      // 水平に飛ぶだけで山が伸び縮みし、山肌の模様もうねうね動いて見えた（本人 2026-10-30「飛行する時にやはり模様がうねって動きます」）
      if (rise || F.wheel > 0 || F.patH == null) { reliefT = exAt(hR) / w.exag; F.patH = hR; }
      const sp = speedAt(hR) * fast;
      // 名所を押した時は、そちらへ向き直る（自分で曲がったら、やめる）
      if (turn) F.aim = null;
      if (F.aim != null) {
        const d = Math.atan2(Math.sin(F.aim - F.yaw), Math.cos(F.aim - F.yaw));
        F.yaw += d * (1 - Math.exp(-dt * 3));
        if (Math.abs(d) < 0.01) F.aim = null;
      }
      F.yaw += turn * 1.1 * dt;
      const fx = Math.sin(F.yaw), fz = -Math.cos(F.yaw), a = 1 - Math.exp(-dt * 3);
      F.vx += (fx * fwd * sp - F.vx) * a; F.vz += (fz * fwd * sp - F.vz) * a;
      F.vy += (rise * Math.max(hR, 0.06) * 0.8 * kY() - F.vy) * a;
      // 上がる・下がる間は、見下ろす角を高さに合わせる（低いほど顔を上げる）。17°のまま地面すれすれまで下りると、
      // 目の前の田畑だけが映り、家も木も空も見えなかった。ドラッグで変えた角は、次に上下するまで保つ
      if (rise || F.wheel > 0) F.pitch += (clamp(0.04 + hR * 0.39, 0.04, 0.6) - F.pitch) * (1 - Math.exp(-dt * 2));
      F.wheel = Math.max(0, (F.wheel || 0) - dt);
      F.x = clamp(F.x + F.vx * dt, b[0], b[2]); F.z = clamp(F.z + F.vz * dt, b[1], b[3]); F.y += F.vy * dt;
      // 地面にもぐらない：足もとと、少し先（速さ0.8秒ぶん）の地面より上へ、なめらかに持ち上げる。足もとより下へは決して行かない
      const ahead = Math.hypot(F.vx, F.vz) * 0.8 + 0.3;
      const g0 = w.heightAt(F.x, F.z), g1 = w.heightAt(clamp(F.x + fx * ahead, b[0], b[2]), clamp(F.z + fz * ahead, b[1], b[3]));
      const gMin = Math.max(g0, g1) + minR * kY();
      if (guard && F.y < gMin) { F.y += (gMin - F.y) * (1 - Math.exp(-dt * 8)); if (F.vy < 0) F.vy = 0; }
      F.y = Math.min(guard ? Math.max(F.y, g0 + 0.02) : F.y, MAX_Y);
    }
    // カメラ：見る点＝位置から前へ D。D は高さに合わせる（地名の札の出し方が高さに合う）
    const D = clamp(agl() / kY() * 7.5, 3, 80), cp = Math.cos(F.pitch), sn = Math.sin(F.pitch);
    Object.assign(M.cam, { x: F.x + Math.sin(F.yaw) * cp * D, y: F.y - sn * D, z: F.z - Math.cos(F.yaw) * cp * D, D, th: F.yaw, ph: F.pitch });
    if ((F.tick += dt) > 0.4) { F.tick = 0; status(); }
  }

  // ---- いま〇〇のあたり・近くの名所（押すと、そちらへ向き直る）
  function status() {
    if (!F) return;
    const w = F.w, d2 = (p) => (p.x - F.x) ** 2 + (p.z - F.z) ** 2;
    let at = null;
    for (const p of w.places || []) if (!at || d2(p) < d2(at)) at = p;
    $('#f-where').textContent = at && d2(at) < 15 * 15 ? `いま：${at.name}のあたり` : '';
    const k = M.sel, pref = k >= 0 ? M.P[k].n : -1;
    const spots = (IN ? IN.items.filter((it) => it.pref === pref).concat((IN.spots || []).filter((s) => s.pref === pref)) : []);
    let near = null;
    for (const s of spots) if (!near || d2(s) < d2(near)) near = s;
    const nb = $('#f-near');
    if (near && d2(near) < 8 * 8) {
      const dist = Math.sqrt(d2(near));
      if (F.near !== near) { F.near = near; nb.textContent = ''; const bt = document.createElement('button'); bt.id = 'f-aim'; nb.append('近くに：', bt); }
      $('#f-aim').textContent = `${near.name}（${dist < 1 ? Math.round(dist * 10) * 100 + 'm' : dist.toFixed(1) + 'km'}）›`;
    } else if (F.near) { F.near = null; nb.textContent = ''; }
  }
  $('#f-near').addEventListener('click', (e) => {
    if (!F || !F.near || !e.target.closest('#f-aim')) return;
    F.aim = Math.atan2(F.near.x - F.x, -(F.near.z - F.z));
  });

  // 降りた後も、山の強め方を県の中の倍率（5倍）へ戻し続ける
  M.on('frame', () => {
    const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000);
    if (!F) { lastT = now; updRelief(dt); }
  });
  // 県の中から出たら（全体・ブラウザの戻る）、飛ぶのをやめ、山の強め方もすぐ戻す
  M.on('world', (w) => {
    if (w) return;
    finish();
    relief = reliefT = 1; U.uInY.value = 1; U.uPtK.value = 1; U.uPxMax.value = 0;
  });
  $('#fly-open').addEventListener('click', start);
  $('#f-end').addEventListener('click', end);

  window.TABI = {
    start, end,
    // 検査用：キーを押したことにする（離すのは自分で）
    press(code, on) { if (on) { keys.set(code, { t: performance.now() + 1e9, rep: true }); lastKey = null; } else keys.delete(code); },
    aim(yaw) { if (F) F.aim = yaw; },
    // 検査用：その場所の地面から hR km（本物の高さ）に止まって置く
    place(x, z, hR, yaw, pitch) {
      if (!F) return;
      relief = reliefT = exAt(hR) / F.w.exag;
      U.uInY.value = relief; U.uPtK.value = relief; U.uPxMax.value = 30 + (1 - relief) * 165;
      Object.assign(F, { x, z, y: F.w.heightAt(x, z) + hR * kY(), yaw, pitch, vx: 0, vy: 0, vz: 0, cruise: false, intro: null, aim: null });
    },
    set guard(v) { guard = v; },
    set floor(km) { minR = km == null ? MIN_R : km; },
    get state() { return F && { x: F.x, y: F.y, z: F.z, yaw: F.yaw, pitch: F.pitch, agl: agl(), aglR: agl() / kY(), ex: kY(), intro: !!F.intro, cruise: F.cruise, speed: Math.hypot(F.vx, F.vz), relief, ground: F.w.heightAt(F.x, F.z) }; },
    get relief() { return relief; },
  };
})();
