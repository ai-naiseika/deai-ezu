// 空の輪くぐり（本人 2026-10-30 の遊びの4つ目「空のリング飛行」・2026-11-09）：空を飛ぶ間に「輪くぐり」を押すと、その県の名所の上に金の輪が6つ、
// いまの所から近い順に並ぶ。順にくぐると時間が出て、県ごとの自己ベストがこの端末に残る（どこにも送らない）。
// 輪の高さは、飛び立った時の高さ（地面から本物で 0.7km。旅.js の TAKEOFF）。くぐった判定は広め（スマホのスティックで狙えるように）。
// 「次の輪へ向く」で、その方へ向き直る（旅.js の TABI.aim）
(function () {
  'use strict';
  const M = window.MAP3D, IN = window.INTRO, TABI = window.TABI;
  if (!M || !IN || !TABI) return;
  const T = M.inner.T, $ = (s) => document.querySelector(s);
  const KEY = 'zenkoku3d-ring-v1', N = 6, AGL = 0.7, R = 0.55, GAP = 3;     // 輪の数・地面からの高さ（本物 km）・輪の半径（km）・輪どうしの間（km）
  const geo = new T.TorusGeometry(R, R * 0.09, 8, 40);
  const matNext = new T.MeshBasicMaterial({ color: 0xf2c230 }), matLater = new T.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.35, depthWrite: false });
  const best = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } };

  // ---- 画面：空を飛ぶの札に「輪くぐり」のボタンと、輪の行
  const btn = document.createElement('button');
  btn.id = 'f-ring'; btn.type = 'button'; btn.textContent = '輪くぐり';
  $('#fly .head').insertBefore(btn, $('#f-end'));
  const hud = document.createElement('p');
  hud.id = 'f-ring-hud';
  $('#fly').insertBefore(hud, $('#f-keys'));

  let C = null, msgT = 0;
  function say(text, ms) { clearTimeout(msgT); hud.textContent = text; if (ms) msgT = setTimeout(() => { if (!C) hud.textContent = ''; }, ms); }
  function start() {
    const s = TABI.state, w = M.inside, k = M.sel;
    if (!s || !w || k < 0) return;
    stop();
    const pref = M.P[k].n, pts = IN.items.filter((it) => it.pref === pref).concat((IN.spots || []).filter((p) => p.pref === pref && p.x != null));
    // いまの所から近い順に、間を GAP km 以上あけて6つ
    const left = pts.slice(), route = [];
    let at = { x: s.x, z: s.z };
    while (route.length < N && left.length) {
      left.sort((a, b) => ((a.x - at.x) ** 2 + (a.z - at.z) ** 2) - ((b.x - at.x) ** 2 + (b.z - at.z) ** 2));
      const i = left.findIndex((p) => route.every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= GAP) && Math.hypot(p.x - s.x, p.z - s.z) >= GAP);
      if (i < 0) break;
      const p = left.splice(i, 1)[0];
      route.push({ x: p.x, z: p.z, name: p.name, yaw: Math.atan2(p.x - at.x, -(p.z - at.z)) });
      at = p;
    }
    if (route.length < 3) { say('この県では、輪を並べる名所が足りません', 4000); return; }
    for (const r of route) {
      r.mesh = new T.Mesh(geo, matLater);
      r.mesh.rotation.y = -r.yaw;                  // 輪の向き：前の輪から来る向きに正面を向ける
      w.group.add(r.mesh);
    }
    C = { w, pref, rings: route, i: 0, t0: performance.now() };
    paint();
  }
  function paint() { C.rings.forEach((r, j) => { r.mesh.visible = j >= C.i; r.mesh.material = j === C.i ? matNext : matLater; }); }
  function stop() {
    if (!C) return;
    for (const r of C.rings) C.w.group.remove(r.mesh);
    C = null; hud.textContent = '';
  }
  function finish() {
    const sec = (performance.now() - C.t0) / 1000, b = best(), name = M.FULL(M.P.find((p) => p.n === C.pref).name), was = b[C.pref];
    if (!was || sec < was) { b[C.pref] = Math.round(sec * 10) / 10; try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) { /* 覚えられない画面では何もしない */ } }
    stop();
    say(`${name}の${N}つの輪をくぐりました　${sec.toFixed(1)}秒` + (!was ? '（はじめての記録）' : sec < was ? `（自己ベスト！前は${was}秒）` : `（自己ベストは${was}秒）`), 9000);
  }
  // 次の輪の方角を、いま向いている向きから見て言う
  function side(yaw, to) {
    const d = Math.atan2(Math.sin(to - yaw), Math.cos(to - yaw)) * 180 / Math.PI;
    return Math.abs(d) < 25 ? '前' : Math.abs(d) > 150 ? 'うしろ' : d > 0 ? '右' : '左';
  }
  M.on('frame', () => {
    if (!C) return;
    const s = TABI.state;
    if (!s || M.inside !== C.w) { stop(); return; }
    for (const r of C.rings) r.mesh.position.set(r.x, C.w.heightAt(r.x, r.z) + AGL * s.ex, r.z);
    const r = C.rings[C.i], dh = Math.hypot(s.x - r.x, s.z - r.z), dy = s.y - r.mesh.position.y;
    if (dh < R * 1.3 && Math.abs(dy) < Math.max(R * 1.6, 0.35 * s.ex)) {
      C.i++;
      if (C.i >= C.rings.length) { finish(); return; }
      paint();
    }
    const n = C.rings[C.i], to = Math.atan2(n.x - s.x, -(n.z - s.z)), d = Math.hypot(n.x - s.x, n.z - s.z), t = (performance.now() - C.t0) / 1000;
    const up = (n.mesh.position.y - s.y) / s.ex, ud = up > 0.25 ? '・もう少し上' : up < -0.25 ? '・もう少し下' : '';
    if (!hud.firstChild || hud.firstChild.nodeType !== 1) { hud.textContent = ''; const b = document.createElement('button'); b.id = 'f-ring-aim'; hud.append(b); }
    hud.firstChild.textContent = `輪 ${C.i + 1} / ${C.rings.length}　${t.toFixed(1)}秒　次の輪：${side(s.yaw, to)}へ ${d < 1 ? Math.round(d * 10) * 100 + 'm' : d.toFixed(1) + 'km'}${ud}　›`;
  });
  hud.addEventListener('click', (e) => { if (C && e.target.closest('#f-ring-aim')) { const s = TABI.state, n = C.rings[C.i]; if (s) TABI.aim(Math.atan2(n.x - s.x, -(n.z - s.z))); } });
  btn.addEventListener('click', () => (C ? stop() : start()));
  M.on('world', () => stop());

  // 検査用
  window.RING = { start, stop, get state() { return C && { i: C.i, n: C.rings.length, pref: C.pref, rings: C.rings.map((r) => ({ x: r.x, z: r.z, y: r.mesh.position.y, name: r.name })) }; }, best };
})();
