// 鳥瞰図の描き込み：木と家（絵の札を地面に立てる）・川。拡大前も拡大後も、同じ流儀の絵が見える。
//
// 木と家：全国を 1.5km おきの格子に並べた点（陸だけ・約11万）。遠くから見る時は粗い段（12km おき）だけ、
//   寄ると細かい段（6・3・1.5km）が順に出る。絵は1枚の画像に描き、色は季節と種類で画面の側で塗る
//   （R＝葉むら・G＝幹や枝・B＝墨の輪郭・残り＝雪・実・花・壁）。種類は標高・傾き・町の濃さで決める
// 川：標高から求めた流れ（鳥瞰.js）。墨の縁取りの上に、季節の水の色
(function () {
  'use strict';
  const M = window.MAP3D, C = window.CHOKAN;
  if (!M || !C) return;
  M.on('ready', () => { try { build(); } catch (e) { console.error(e); } });

  const S = 1.5;                                   // いちばん細かい段の間隔 km
  const K = { broad: 0, conifer: 1, alpine: 2, sub: 3, house: 4, apple: 5, ume: 6, building: 7, factory: 8 };
  const hash = (a, b, c = 0) => {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // ---------------------------------------------------------------- 季節の色（行＝春夏秋冬、列＝下の番号）
  // 画風見本 04_鳥瞰図 と同じ色
  const PAL = [
    /* 0 広葉樹A */ ['#9ccf6a', '#3f9a52', '#4e8a52', '#4f7f56'],
    /* 1 広葉樹B */ ['#86c45e', '#4ea65a', '#5a9458', '#5b8a5c'],
    /* 2 針葉樹 */  ['#2f7a5a', '#226e50', '#2c6e52', '#3a7062'],
    /* 3 高山 */    ['#8fbf86', '#6fae6a', '#d07a40', '#fbfbf8'],
    /* 4 桜 */      '#f6b6c6',
    /* 5〜9 紅葉 */ '#e0472c', '#f08a2a', '#f0be34', '#d23a2a', '#ec9a30',
    /* 10 幹 */     '#6a4a30',
    /* 11 南の島 */ ['#4fae62', '#3f9e58', '#4aa25c', '#4f9a60'],
    /* 12 りんご */ ['#fbe2ea', '#66ae52', '#66aa50', '#c7ae90'],
    /* 13 梅 */     ['#f9c4d4', '#7ec064', '#a8b65a', '#c4ab90'],
    /* 14 実 */     '#e0302a',
    /* 15 花 */     '#ffffff',
    /* 16 雪 */     '#fbfbf8',
    /* 17 壁 */     '#fff8ea',
    /* 18〜21 屋根 */ '#d2482e', '#3a5aa0', '#c46a2a', '#5a6270',
    /* 22 墨 */     '#2a3146',
    /* 23 川 */     ['#3d8fd6', '#2f86d4', '#3d88cc', '#78a8cc'],
    /* 24 ビルの横の壁 */ '#cfc6b4',
    /* 25 ビルの屋上 */   ['#8f97a3', '#8f97a3', '#8f97a3', '#f4f6f7'],
  ];
  function palTex(T) {
    const d = new Uint8Array(32 * 4 * 4);
    PAL.forEach((v, i) => {
      for (let s = 0; s < 4; s++) {
        const c = new T.Color(Array.isArray(v) ? v[s] : v), o = (s * 32 + i) * 4;
        d[o] = c.r * 255; d[o + 1] = c.g * 255; d[o + 2] = c.b * 255; d[o + 3] = 255;
      }
    });
    const t = new T.DataTexture(d, 32, 4, T.RGBAFormat, T.UnsignedByteType);
    t.magFilter = t.minFilter = T.NearestFilter; t.needsUpdate = true;
    return t;
  }

  // ---------------------------------------------------------------- 絵（画風見本の形を、1枚の画像に）
  // 1マス 128画素の 8×8。足もと＝マスの下の真ん中。形の単位は 64（2倍に描く）
  function blob(cx, cy, rx, ry, n, wob, seed, pointTop = 0) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i / n * Math.PI * 2;
      const w = 1 + wob * (Math.sin(a * 3 + seed * 1.7) * 0.6 + Math.sin(a * 5 + seed * 3.1) * 0.4);
      const top = pointTop * Math.max(0, -Math.sin(a)) ** 6;
      pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w - top * ry]);
    }
    return pts;
  }
  const SH = {
    broad(s, seed) {
      const h = 9 * s, r = 4.6 * s;
      return { trunk: [[-0.7 * s, 0], [-0.5 * s, -h * 0.55], [0.5 * s, -h * 0.55], [0.7 * s, 0]], crown: blob(0, -h * 0.62, r, r * 0.92, 18, 0.12, seed, 0.35) };
    },
    conifer(s, seed) {
      const h = 12 * s, w = 3.8 * s, pts = [[0, -h]];
      for (let k = 1; k <= 4; k++) {
        const y = -h + h * 0.86 * k / 4, ww = w * (0.35 + 0.65 * k / 4) * (0.9 + 0.2 * Math.sin(seed * 7 + k));
        pts.push([ww, y], [ww * 0.55, y - h * 0.05]);
      }
      const L = pts.slice(1).map(([x, y]) => [-x * (0.92 + 0.1 * Math.sin(seed)), y]).reverse();
      return { trunk: [[-0.6 * s, 0], [-0.6 * s, -h * 0.16], [0.6 * s, -h * 0.16], [0.6 * s, 0]],
        crown: [...pts, [0, -h * 0.16], ...L].map(([x, y], i) => i === 0 ? [x, y] : [x, Math.min(y, -h * 0.14)]) };
    },
    alpine(s, seed) { return { crown: blob(0, -1.6 * s, 3.4 * s, 1.8 * s, 14, 0.18, seed) }; },
    apple(s, seed) {
      const h = 7 * s;
      return { trunk: [[-0.7 * s, 0], [-0.5 * s, -h * 0.5], [0.5 * s, -h * 0.5], [0.7 * s, 0]], crown: blob(0, -h * 0.66, 3.8 * s, 3.3 * s, 16, 0.08, seed),
        dots: Array.from({ length: 6 }, (_, i) => [Math.cos(i * 2.3 + seed) * 2.3 * s, -h * 0.66 + Math.sin(i * 1.7 + seed) * 2 * s]) };
    },
    ume(s, seed) {
      const h = 6 * s;
      return { trunk: [[-0.6 * s, 0], [-0.3 * s, -h * 0.55], [0.3 * s, -h * 0.55], [0.6 * s, 0]], crown: blob(0, -h * 0.68, 4.2 * s, 2.6 * s, 16, 0.2, seed),
        dots: Array.from({ length: 8 }, (_, i) => [Math.cos(i * 1.9 + seed) * 3.2 * s, -h * 0.68 + Math.sin(i * 2.7 + seed) * 1.8 * s]) };
    },
    house(s, seed) {
      const w = (4 + 2 * ((seed * 7) % 1)) * s, h = 2.6 * s, rh = 2.4 * s, d = 1.6 * s;
      return { wall: [[-w / 2, 0], [-w / 2, -h], [w / 2, -h], [w / 2, 0]],
        roof: [[-w / 2 - 0.5 * s, -h], [-w / 2 + d, -h - rh], [w / 2 - d, -h - rh], [w / 2 + 0.5 * s, -h]] };
    },
  };
  const CELLS = 8, PX = 128;
  function atlas(T) {
    const cv = document.createElement('canvas'); cv.width = cv.height = CELLS * PX;
    const x = cv.getContext('2d');
    const R = 'rgb(255,0,0)', G = 'rgb(0,255,0)', B = 'rgb(0,0,255)', W = 'rgb(0,0,0)';
    const poly = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); };
    const fill = (pts, c) => { poly(pts); x.fillStyle = c; x.fill(); };
    const ink = (pts, w = 1.5) => { poly(pts); x.strokeStyle = B; x.lineWidth = w; x.lineJoin = 'round'; x.stroke(); };
    const line = (pts, c, w) => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.strokeStyle = c; x.lineWidth = w; x.lineCap = 'round'; x.stroke(); };
    const cell = (k, f) => { x.save(); x.setTransform(2, 0, 0, 2, (k % CELLS) * PX + PX / 2, Math.floor(k / CELLS) * PX + PX - 4); f(); x.restore(); };
    const tree = (sh, dots) => {
      if (sh.trunk) fill(sh.trunk, G);
      fill(sh.crown, R); ink(sh.crown);
      if (dots) for (const [a, b] of sh.dots) { x.beginPath(); x.arc(a, b, 1.5, 0, 7); x.fillStyle = W; x.fill(); }
    };
    const s = 4.9;
    for (let v = 0; v < 3; v++) cell(v, () => tree(SH.broad(s * (0.95 + v * 0.04), 1.3 + v * 2.1)));
    // 針葉樹：雪は上を向いた縁にだけ（雪の色で塗ってから、下へずらした形で葉の色を戻す）。雪の無い季節は縁も葉の色
    for (let v = 0; v < 3; v++) cell(3 + v, () => {
      const sh = SH.conifer(s * (0.92 + v * 0.05), 0.7 + v * 1.9);
      fill(sh.trunk, G);
      x.save(); poly(sh.crown); x.clip();
      fill(sh.crown, W); x.translate(0, 3.2); fill(sh.crown, R); x.restore();
      ink(sh.crown);
    });
    cell(6, () => tree(SH.alpine(s * 1.1, 2.2)));
    cell(7, () => tree(SH.apple(s * 1.05, 1.1), true));
    cell(8, () => tree(SH.ume(s * 1.05, 0.4), true));
    // 冬の落葉樹：葉を落として枝だけ。雪は枝先に
    for (let v = 0; v < 2; v++) cell(9 + v, () => {
      const h = 9 * s * (0.95 + v * 0.08);
      line([[0, 0], [0, -h * 0.62]], G, 2.6);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.38 + (hash(v, k) - 0.5) * 0.3, y0 = -h * (0.3 + 0.1 * k), L = h * (0.3 + 0.14 * hash(v, k + 9));
        const tip = [Math.cos(a) * L, y0 + Math.sin(a) * L];
        line([[0, y0], tip], G, 1.6);
        x.beginPath(); x.arc(tip[0], tip[1] - 0.4, 1.4, 0, 7); x.fillStyle = W; x.fill();
      }
    });
    for (let v = 0; v < 4; v++) cell(11 + v, () => {
      const sh = SH.house(s * 1.75, 0.13 + v * 0.31);
      fill(sh.wall, W); ink(sh.wall, 1.3); fill(sh.roof, R); ink(sh.roof, 1.3);
    });
    cell(15, () => tree(SH.broad(s * 1.0, 4.4)));
    // ビル（街中の建てこんだ所）：正面の壁（白）・横の壁（灰）・屋上、窓は墨の点。中層・高層・横長の集合住宅
    for (const [v, w, h] of [[0, 16, 28], [1, 13, 46], [2, 30, 20]]) cell(16 + v, () => {
      const d = 7, rise = 4, x0 = -(w + d) / 2;
      const front = [[x0, 0], [x0, -h], [x0 + w, -h], [x0 + w, 0]];
      const side = [[x0 + w, 0], [x0 + w, -h], [x0 + w + d, -h - rise], [x0 + w + d, -rise]];
      const roof = [[x0, -h], [x0 + d, -h - rise], [x0 + w + d, -h - rise], [x0 + w, -h]];
      fill(front, W); ink(front, 1.3); fill(side, G); ink(side, 1.3); fill(roof, R); ink(roof, 1.3);
      x.fillStyle = B;
      for (let yy = -h + 4; yy < -3; yy += 5.5) for (let xx = x0 + 2.5; xx < x0 + w - 2; xx += 4.2) x.fillRect(xx, yy, 2.2, 2.6);
    });
    // 工場と倉庫（県の中の、住む人の少ない建物用地。2026-10-30 本人「川崎の臨海部が畑に見える」）：のこぎり屋根の工場・横長の倉庫・丸いタンク
    cell(19, () => {
      const w = 30, h = 12, d = 7, rise = 4, x0 = -(w + d) / 2;
      const chim = [[x0 + w - 6, -h - rise], [x0 + w - 6, -h - 26], [x0 + w - 3, -h - 26], [x0 + w - 3, -h - rise]];
      fill(chim, G); ink(chim, 1.2);
      const front = [[x0, 0], [x0, -h], [x0 + w, -h], [x0 + w, 0]];
      const side = [[x0 + w, 0], [x0 + w, -h], [x0 + w + d, -h - rise], [x0 + w + d, -rise]];
      fill(front, W); ink(front, 1.3); fill(side, G); ink(side, 1.3);
      for (let k = 0; k < 5; k++) {
        const t0 = [[x0 + k * 6, -h], [x0 + k * 6 + d * 0.6, -h - rise - 3], [x0 + k * 6 + d * 0.6, -h - rise + 1], [x0 + k * 6 + 6, -h]];
        fill(t0, R); ink(t0, 1.1);
      }
    });
    cell(20, () => {
      const w = 32, h = 10, d = 8, rise = 4, x0 = -(w + d) / 2;
      const front = [[x0, 0], [x0, -h], [x0 + w, -h], [x0 + w, 0]];
      const side = [[x0 + w, 0], [x0 + w, -h], [x0 + w + d, -h - rise], [x0 + w + d, -rise]];
      const roof = [[x0, -h], [x0 + d, -h - rise], [x0 + w + d, -h - rise], [x0 + w, -h]];
      fill(front, W); ink(front, 1.3); fill(side, G); ink(side, 1.3); fill(roof, R); ink(roof, 1.3);
      for (let k = 0; k < 3; k++) { const dr = [[x0 + 3 + k * 10, 0], [x0 + 3 + k * 10, -6.5], [x0 + 9 + k * 10, -6.5], [x0 + 9 + k * 10, 0]]; fill(dr, G); ink(dr, 1); }
    });
    cell(21, () => {
      for (const [cx, r, hg] of [[-10, 9, 13], [9, 7, 10]]) {
        const body = [[cx - r, 0], [cx - r, -hg], [cx + r, -hg], [cx + r, 0]];
        fill(body, W); ink(body, 1.2);
        x.beginPath(); x.ellipse(cx, 0, r, r * 0.35, 0, 0, Math.PI); x.fillStyle = W; x.fill(); x.strokeStyle = B; x.lineWidth = 1.2; x.stroke();
        x.beginPath(); x.ellipse(cx, -hg, r, r * 0.35, 0, 0, Math.PI * 2); x.fillStyle = R; x.fill(); x.stroke();
      }
    });
    const t = new T.CanvasTexture(cv);
    t.premultiplyAlpha = true;                     // 縁の半透明な所で、色の割合がくずれないように（小さく縮めた段でも）
    t.anisotropy = 4;
    return t;
  }

  // ---------------------------------------------------------------- 絵の具
  // o＝{ S: いちばん細かい段の間隔 km, px: [最小, 最大] の画素, km: 木の高さ km（寄った時の大きさ）, fade: 県の外を紙へ溶かすか }
  // 全国＝S 1.5km、県の中＝S 0.4km。県の中は、県境から離れるほど透けて、後ろの空と紙が見える
  const VS_PT = (X, o) => `${X.STATE}
    uniform sampler2D uPal; uniform float uSeason, uPpk, uDpr, uHideId, uSnowLine, uSnowN, uPop, uInY, uPtK, uPxMax, uNear3D, uNearR; uniform vec2 uRes;
    attribute float aId; attribute vec4 aD;
    varying vec3 vS, vA, vB, vC; varying float vDist, vCell;
    ${o.fade ? 'attribute float aF; varying float vF;' : ''}
    vec3 pal(float i) { return texture2D(uPal, vec2((i + 0.5) / 32.0, (uSeason + 0.5) / 4.0)).rgb; }
    void main() {
      vec4 s = stateOf(aId);
      float kind = aD.x, lv = aD.y, r = aD.z, h = aD.w;
      vec3 p = position; p.y = p.y * uInY + s.r;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float dist = max(-mv.z, 0.05), ppk = uPpk / dist;
      float vis = lv < 0.5 ? 1.0 : smoothstep(5.5, 9.0, ${o.S.toFixed(3)} * exp2(3.0 - lv) * ppk);
      float snowy = step(uSnowLine + position.z * uSnowN, h + 120.0);
      float v3 = floor(fract(r * 13.0) * 3.0), size = 1.0;
      vec3 A, B = pal(10.0), C;
      if (kind < 0.5) {                                  // 広葉樹：秋は紅葉（7割）、冬は葉を落とす（同じ7割）、春の低い所に桜
        bool dec = r < 0.7;
        if (uSeason > 2.5 && dec) { vCell = 9.0 + step(0.35, r); A = B; C = snowy > 0.5 ? pal(16.0) : B; }
        else {
          vCell = v3;
          A = (uSeason > 1.5 && uSeason < 2.5 && dec) ? pal(5.0 + floor(fract(r * 7.0) * 5.0))
            : (uSeason < 0.5 && r < 0.08 && h < 900.0) ? pal(4.0) : (fract(r * 5.0) < 0.5 ? pal(0.0) : pal(1.0));
          C = A;
        }
        size = 0.95;
      } else if (kind < 1.5) { vCell = 3.0 + v3; A = pal(2.0); C = (uSeason > 2.5 && snowy > 0.5) ? pal(16.0) : A; }
      else if (kind < 2.5) { vCell = 6.0; A = pal(3.0); C = A; size = 0.6; }
      else if (kind < 3.5) { vCell = 15.0; A = pal(11.0); C = A; }
      else if (kind < 4.5) { vCell = 11.0 + v3 + step(0.85, r); A = pal(18.0 + floor(fract(r * 3.0) * 4.0)); B = A; C = pal(17.0); size = 0.9; }
      else if (kind < 5.5) { vCell = 7.0; A = pal(12.0); C = uSeason > 1.5 && uSeason < 2.5 ? pal(14.0) : A; size = 0.85; }
      else if (kind < 6.5) { vCell = 8.0; A = pal(13.0); C = uSeason < 0.5 ? pal(15.0) : A; size = 0.85; }
      else if (kind < 7.5) { vCell = 16.0 + v3; A = pal(25.0); B = pal(24.0); C = pal(17.0); size = 1.25; }
      else { vCell = 19.0 + v3; A = pal(25.0); B = pal(24.0); C = pal(17.0); size = 1.2; }
      if (lv > 4.5) size *= exp2((4.0 - lv) * 0.5);      // 寄った時の細かい段（県の中.js）は、段が細かいほど絵を小さく（1つが表す本数・世帯が少ない）
      vA = A; vB = B; vC = C; vS = s.gba; vDist = dist;
      ${o.fade ? 'vF = aF;' : ''}
      float px = clamp(ppk * ${o.km.toFixed(3)} * uPtK, ${o.px[0].toFixed(1)}, max(${o.px[1].toFixed(1)}, uPxMax)) * size * (0.86 + 0.28 * fract(r * 31.0)) * mix(0.35, 1.0, vis) * uDpr;
      // 奥行きは、絵の背の高さの1.5倍ぶん手前へ（見る向きは変わらない）。足もとの奥行きのままだと、山を強めた急な斜面では斜面の上側の地面が
      // 絵より手前になり、カメラを向いた斜面の木がまるごと隠れた（丹沢 2026-10-30）。崖のような斜面では、背丈とほぼ同じだけ地面が手前に来る
      vec4 c = projectionMatrix * vec4(mv.xyz * (1.0 - clamp(1.5 * px / (uDpr * uPpk), 0.0005, 0.3)), 1.0);
      c.y += px * 0.47 / uRes.y * 2.0 * c.w;            // 足もとを地面に
      gl_PointSize = px;
      bool popHide = uPop > 0.5 && ((!(kind > 3.5 && kind < 4.5) && (kind < 6.5 || kind > 7.5)) || lv > 4.5);   // 人口の表示：家とビルだけ（寄った時に足す細かい段の家は、1つ≒100世帯の数え方から外れるので出さない）
      // 空を飛ぶ・車窓の間（uNear3D）、カメラから 2.25km の家とビルは、県の中.js の立体の家に差し替える
      popHide = popHide || (uNear3D > 0.5 && ((kind > 3.5 && kind < 4.5) || (kind > 6.5 && kind < 7.5)) && distance(vec3(position.x, p.y, position.z), cameraPosition) < 2.25);
      // 低く飛ぶ間、森の木の絵札は、県の中.js の1本ずつの木の輪（家の輪の 55%）の内で隠す
      popHide = popHide || (uNearR > 0.0 && kind < 1.5 && distance(vec3(position.x, p.y, position.z), cameraPosition) < uNearR * 0.55 - 0.1);
      gl_Position = (vis < 0.02 || popHide || abs(aId - uHideId) < 0.5${o.fade ? ' || aF < 0.02' : ''}) ? vec4(2.0, 2.0, 2.0, 1.0) : c;
    }`;
  const FS_PT = (X, o) => `
    uniform sampler2D uAtlas; uniform vec3 uInk;
    ${X.FINISH}
    varying vec3 vS, vA, vB, vC; varying float vDist, vCell;
    ${o.fade ? 'varying float vF;' : ''}
    void main() {
      vec2 q = gl_PointCoord;
      // 拾う位置を、マスの縁から縮めた画像の1目ぶん内側へ。遠くの小さな絵は縮めた画像から拾い、隣のマスの端（上の木の根元・墨の線）が
      // にじんで、家の屋根の少し上に黒い点や線が出た（本人 2026-10-27）
      vec2 mg = min(fwidth(q) * 1.5, vec2(0.25));
      q = clamp(q, mg, 1.0 - mg);
      // 絵の番号は、いちばん近い整数に丸めてから使う。受け渡しの途中で 16.0 が 15.9999999 になると、切り捨てで1つ前の行（絵の外）を取り、
      // カメラが1cm 動くたびにビル（16番）や木（0番）・梅（8番）がまるごと出たり消えたりした（本人「拡大するとまだちらつく」2026-10-27）
      float cell = floor(vCell + 0.5);
      float col = mod(cell, ${CELLS}.0), row = floor(cell / ${CELLS}.0);
      vec4 t = texture2D(uAtlas, vec2((col + q.x) / ${CELLS}.0, 1.0 - (row + q.y) / ${CELLS}.0));
      float k = clamp((t.a - 0.42) / max(fwidth(t.a), 0.001) + 0.5, 0.0, 1.0);
      if (k <= 0.0) discard;
      float w = max(t.a - t.r - t.g - t.b, 0.0);
      vec3 c = finish((t.r * vA + t.g * vB + t.b * uInk + w * vC) / t.a, vS, vDist);
      // 夜：家は壁の中に小さな窓の灯りが点々と（遠くで絵が小さい時は、家ぜんたいをごく淡く）、ビルは窓（墨で描いた所）が光る。木は暗いまま。
      // 壁ぜんたいを光らせると、家が白く浮いて雪のように見えた
      if (uNight > 0.01) {
        float house = step(10.5, cell) * step(cell, 14.5), bldg = step(15.5, cell) * step(cell, 21.5);
        // 窓は壁の中の小さな四角（9×9 の升の中の4割ほど、その半分が点く）。見えるのは、空を飛んで家に近づいた時（絵が40画素より大きい）だけ。
        // 大きな升で4割を光らせると、壁が白と紺の市松模様になった
        vec2 g = q * 9.0, gf = fract(g);
        float win = step(0.5, hash2(floor(g) + cell * 3.1)) * step(0.3, gf.x) * step(gf.x, 0.7) * step(0.3, gf.y) * step(gf.y, 0.72);
        float near = smoothstep(0.03, 0.015, fwidth(q).x);
        float lit = house * w * mix(0.22, win * 0.95, near) + bldg * (t.b * 0.9 + w * 0.08), fog = 1.0 - smoothstep(uFogNear, uFogFar, vDist);
        c += vec3(1.0, 0.78, 0.42) * lit / t.a * uNight * fog;
        // 遠くでは家とビルを灯りの点に（形は見えないので、絵ぜんたいを灯りの色に）、木は半ば透かして地面の灯りを見せる。
        // そのままだと、都市は家の絵に、全国の眺めは木の絵に覆われて、灯りが見えなかった（郊外の方が明るく見えた）
        // 絵ぜんたいを灯りの点にするのは、絵が小さい時（十数画素まで）だけ。寄った眺めで家ぜんたいが灯りの色になると「ベージュの家」に見えた
        float small = smoothstep(0.055, 0.085, fwidth(q).x);
        c = mix(c, vec3(1.0, 0.80, 0.48), (house + bldg) * mix(0.18, 0.6, small) * (1.0 - near) * uNight * fog);
        k *= 1.0 - (1.0 - house - bldg) * (1.0 - near) * 0.85 * uNight;
      }
      ${o.fade ? 'gl_FragColor = vec4(c * vF * k, vF * k);' : 'gl_FragColor = vec4(c * k, k);'}
    }`;
  // 絵の縁は1画素の幅で、下の地面へなじませる（色は掛け合わせ済みの重ね塗り）。0/1 の切り抜きだけだと、寄る・回るたびに
  // 縁の画素が出たり消えたりして、木や家がちらちら点滅した（本人 2026-10-27。画面のギザギザ消しは切り抜きの縁に効かない）。
  // 透明の扱い（transparent）にはしない＝描く順は今のまま
  const PT_MAT = (X) => ({ blending: X.T.CustomBlending, blendSrc: X.T.OneFactor, blendDst: X.T.OneMinusSrcAlphaFactor });

  // 川・鉄道・道路：線分ごとの四角を、画面の上の太さで太らせる。端を半分の幅だけ延ばして、曲がり角のすき間を埋める。
  // o＝{ km: 太さを km で持つか（県の中。寄ると太る）, fade, dash: 鉄道の白黒の破線, thin: 1画素より細い所は太らせずに薄く（県の中の川） }
  // thin で 0.3 画素ぶんより細い所は描かない（本人 2026-10-31「細ければある程度近づかないと見えない感じでいい」）。
  // かすかな線を描くと、型板の印で木の絵が細く抜けて、森に傷のような線が出る
  // thin の線は、幅が負なら広い川の岸の線（薄くしない。岸を薄くすると、遠くで広い川ほど見えなくなる）
  const VS_RV = (X, o) => `${X.STATE}
    uniform sampler2D uPal; uniform float uSeason, uPpk, uDpr, uHideId, uOut, uMaxW, uFly, uInY, uNear3D, uThin; uniform vec2 uRes; uniform vec3 uCol;
    attribute vec3 aB; attribute vec2 aSE; attribute float aId, aIdB, aW;
    varying vec3 vS, vC; varying float vDist;
    ${o.fade ? 'attribute float aF; varying float vF;' : ''}
    ${o.dash ? 'attribute vec2 aL; varying float vL;' : ''}
    ${o.thin ? 'varying float vT;' : ''}
    void main() {
      vec4 sa = stateOf(aId), sb = stateOf(aIdB);
      vec3 A = position, B = aB; A.y = A.y * uInY + sa.r; B.y = B.y * uInY + sb.r;
      vec4 ma = modelViewMatrix * vec4(A, 1.0), mb = modelViewMatrix * vec4(B, 1.0);
      ma.xyz *= 0.999; mb.xyz *= 0.999;
      vec4 ca = projectionMatrix * ma, cb = projectionMatrix * mb;
      vec2 d = cb.xy / cb.w * uRes - ca.xy / ca.w * uRes;
      float L = length(d); d = L > 1e-5 ? d / L : vec2(1.0, 0.0);
      float ppk = uPpk / max(-(aSE.y < 0.5 ? ma.z : mb.z), 0.05), aw = abs(aW);
      ${o.km ? 'float w = (clamp(aw * ppk, 1.1, uMaxW) + uOut) * uDpr;' : 'float w = (aw * clamp(pow(ppk / 0.6, 0.55), 1.0, 2.8) + uOut) * uDpr;'}
      ${o.thin ? 'vT = aW < 0.0 || uNear3D > 0.5 || uThin < 0.5 ? 1.0 : clamp(aw * ppk / 1.1, 0.0, 1.0);' : ''}
      vec4 c = aSE.y < 0.5 ? ca : cb;
      c.xy += (vec2(-d.y, d.x) * aSE.x + d * (aSE.y < 0.5 ? -1.0 : 1.0)) * w / uRes * c.w;
      ${o.km ? `
      // 空を飛ぶ間（uNear3D）は、地面に寝かせた帯で描く。画面の上で太らせる帯は、低く飛ぶと立ち上がり、川が宙に浮いた青い板に見えた（2026-10-30）。
      // 太さは実の大きさの見当（川は線の幅そのまま 6〜400m・道 40m・線路 20m。近くの線路は県の中.js の砂利と枕木の帯）。墨の縁（uOut）だけは画面の画素で足す
      if (uNear3D > 0.5) {
        vec2 g = B.xz - A.xz; float gl = length(g); g = gl > 1e-6 ? g / gl : vec2(1.0, 0.0);
        float hw = 0.5 * (${o.dash ? '0.02' : 'clamp(aw * uFly, 0.006, 0.4)'} + uOut / ppk);
        vec3 P = (aSE.y < 0.5 ? A : B) + vec3(-g.y, 0.0, g.x) * aSE.x * hw + vec3(g.x, 0.0, g.y) * (aSE.y < 0.5 ? -1.0 : 1.0) * hw;
        vec4 mw = modelViewMatrix * vec4(P, 1.0); mw.xyz *= 0.999;
        c = projectionMatrix * mw;
      }` : ''}
      vS = aSE.y < 0.5 ? sa.gba : sb.gba; vDist = c.w;
      vC = uOut > 0.0 ? vec3(0.165, 0.192, 0.275) : uCol.r >= 0.0 ? uCol : texture2D(uPal, vec2(23.5 / 32.0, (uSeason + 0.5) / 4.0)).rgb;
      ${o.fade ? 'vF = aF;' : ''}
      ${o.dash ? 'vL = aSE.y < 0.5 ? aL.x : aL.y;' : ''}
      bool hide = abs(sa.r - sb.r) > 0.5 || abs(aId - uHideId) < 0.5 || abs(aIdB - uHideId) < 0.5${o.fade ? ' || aF < 0.02' : ''};
      gl_Position = hide ? vec4(2.0, 2.0, 2.0, 1.0) : c;
    }`;
  const FS_RV = (X, o) => `
    ${X.FINISH}
    uniform float uOut;
    varying vec3 vS, vC; varying float vDist;
    ${o.fade ? 'varying float vF;' : ''}
    ${o.dash ? 'varying float vL;' : ''}
    ${o.thin ? 'varying float vT;' : ''}
    void main() {
      ${o.dash ? 'if (uOut <= 0.0 && fract(vL / 0.9) < 0.5) discard;' : ''}
      vec3 c = finish(vC, vS, vDist);
      ${o.ghost ? `float a = ${o.ghost.toFixed(3)}${o.fade ? ' * vF' : ''}; gl_FragColor = vec4(c * a, a);`
        : o.thin ? `float a = vT${o.fade ? ' * vF' : ''}; if (a < 0.3) discard; gl_FragColor = vec4(c * a, a);` : o.fade ? 'gl_FragColor = vec4(c * vF, vF);' : 'gl_FragColor = vec4(c, 1.0);'}
    }`;

  // ---------------------------------------------------------------- 地面の高さ（三角を 8km の升に分けて探す）
  function locator(X) {
    const idx = X.G.top.index.array, pos = X.POS, aH = X.G.top.attributes.aH.array, aId = X.G.top.attributes.aId.array;
    const B = 8, x0 = -1700, z0 = -1500, NW = 400, NH = 420;
    const head = new Int32Array(NW * NH).fill(-1), next = new Int32Array(idx.length / 3);
    for (let t = 0; t < idx.length / 3; t++) {
      const a = idx[t * 3] * 3;
      const c = Math.floor((pos[a] - x0) / B), r = Math.floor((pos[a + 2] - z0) / B);
      if (c < 0 || r < 0 || c >= NW || r >= NH) continue;
      next[t] = head[r * NW + c]; head[r * NW + c] = t;
    }
    return (x, z) => {
      const c0 = Math.floor((x - x0) / B), r0 = Math.floor((z - z0) / B);
      for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (c < 0 || r < 0 || c >= NW || r >= NH) continue;
        for (let t = head[r * NW + c]; t >= 0; t = next[t]) {
          const a = idx[t * 3], b = idx[t * 3 + 1], d = idx[t * 3 + 2];
          const ax = pos[a * 3], az = pos[a * 3 + 2], bx = pos[b * 3], bz = pos[b * 3 + 2], cx = pos[d * 3], cz = pos[d * 3 + 2];
          const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
          if (!det) continue;
          const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det, w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          return { y: w0 * pos[a * 3 + 1] + w1 * pos[b * 3 + 1] + w2 * pos[d * 3 + 1], h: w0 * aH[a] + w1 * aH[b] + w2 * aH[d], k: aId[a] };
        }
      }
      return null;
    };
  }

  // ---------------------------------------------------------------- 木と家の点
  function points(X) {
    const T = X.T, idx = X.G.top.index.array, pos = X.POS, aH = X.G.top.attributes.aH.array, aId = X.G.top.attributes.aId.array;
    const tw = X.U.uTown.value.image, tb = X.U.uTownBox.value;
    const townAt = (x, z) => {
      const c = Math.floor((x - tb.x) / tb.z * tw.width), r = Math.floor((z - tb.y) / tb.w * tw.height);
      return c < 0 || r < 0 || c >= tw.width || r >= tw.height ? 0 : tw.data[r * tw.width + c];
    };
    const GX = -1700, GZ = -1500, NI = Math.ceil(2800 / S), NJ = Math.ceil(3100 / S);
    const seen = new Uint8Array(NI * NJ);
    const P = [], I = [], D = [];
    const FO = [];                     // 森の点：[D の中の位置, 県, 高い所か, くじ, 南北] あとで県ごとの針葉樹の割合に合わせて決める
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], d = idx[t + 2];
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2], bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
      const cx = pos[d * 3], cy = pos[d * 3 + 1], cz = pos[d * 3 + 2];
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-9) continue;
      // 傾き：描いている形（山を強めた高さ）の面の向き
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const up = Math.abs(ny) / Math.hypot(nx, ny, nz);
      const i0 = Math.ceil((Math.min(ax, bx, cx) - GX) / S), i1 = Math.floor((Math.max(ax, bx, cx) - GX) / S);
      const j0 = Math.ceil((Math.min(az, bz, cz) - GZ) / S), j1 = Math.floor((Math.max(az, bz, cz) - GZ) / S);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = GX + i * S, pz = GZ + j * S;
        const w0 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / det, w1 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / det;
        if (w0 < -1e-7 || w1 < -1e-7 || 1 - w0 - w1 < -1e-7) continue;
        const key = j * NI + i;
        if (seen[key]) continue;
        seen[key] = 1;
        const r = hash(i, j), qx = px + (hash(i, j, 1) - 0.5) * S * 0.7, qz = pz + (hash(i, j, 2) - 0.5) * S * 0.7;
        const v0 = ((bz - cz) * (qx - cx) + (cx - bx) * (qz - cz)) / det, v1 = ((cz - az) * (qx - cx) + (ax - cx) * (qz - cz)) / det, v2 = 1 - v0 - v1;
        const h = v0 * aH[a] + v1 * aH[b] + v2 * aH[d];
        const town = townAt(qx, qz);
        let kind = -1;
        if (town >= 26 || (town >= 8 && r < (town - 8) / 18)) kind = K.house;
        else if (up > 0.985 && h < 200) { if (r < 0.04) kind = K.broad; }        // 田畑の中は、ぽつりぽつり（屋敷林）
        else if (h > 2600) kind = -1;                                            // 岩の頂
        else if (h > 1900) { if (r < 0.5) kind = K.alpine; }
        else { kind = K.broad; FO.push(D.length, aId[a], h > 1300 ? 1 : 0, r, qz); }
        if (kind === K.broad && qz > 700) kind = K.sub;                          // 奄美・沖縄：冬も葉を落とさない
        if (kind < 0) continue;
        const lv = i % 8 === 0 && j % 8 === 0 ? 0 : i % 4 === 0 && j % 4 === 0 ? 1 : i % 2 === 0 && j % 2 === 0 ? 2 : 3;
        P.push(qx, v0 * ay + v1 * by + v2 * cy, qz); I.push(aId[a]); D.push(kind, lv, hash(i, j, 3), h);
      }
    }
    // 森の針葉樹の割合（本人 2026-10-30「広葉樹と針葉樹の割合をデータをもとに」）：林野庁の県ごとの割合（森林.js）に合わせる。
    // 高い所ほど針葉樹が多い傾き（1300m を境に 28%／65%）は残し、県ごとに針葉樹になりやすさ（オッズ）を何倍かして、その県の森の点の割合を表に合わせる
    const byOdds = (q, m) => m * q / (1 - q + m * q), BASE = [0.28, 0.65], cnt = new Map(), mk = new Map();
    for (let f = 0; f < FO.length; f += 5) { const k = FO[f + 1], c = cnt.get(k) || [0, 0]; c[FO[f + 2]]++; cnt.set(k, c); }
    for (const [k, c] of cnt) {
      const pr = M.P.find((q) => q.k === k), sh = window.SHINRIN && pr && SHINRIN.prefs[pr.n];
      if (!sh) { mk.set(k, 1); continue; }
      let lo = -6, hi = 6;
      for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2, m = Math.exp(mid); if ((c[0] * byOdds(BASE[0], m) + c[1] * byOdds(BASE[1], m)) / (c[0] + c[1]) < sh.conifer) lo = mid; else hi = mid; }
      mk.set(k, Math.exp((lo + hi) / 2));
    }
    const real = new Map();
    for (let f = 0; f < FO.length; f += 5) {
      const conifer = FO[f + 3] < byOdds(BASE[FO[f + 2]], mk.get(FO[f + 1]));
      D[FO[f]] = conifer ? K.conifer : FO[f + 4] > 700 ? K.sub : K.broad;
      const c = real.get(FO[f + 1]) || [0, 0]; c[0] += conifer ? 1 : 0; c[1]++; real.set(FO[f + 1], c);
    }
    // 検査用：県ごとの［針葉樹の点, 森の点, 表の割合, 倍率1（決め打ち）の時の割合］
    M.forestNat = [...real].map(([k, c]) => { const pr = M.P.find((q) => q.k === k), n0 = cnt.get(k);
      return { name: pr && pr.name, conifer: c[0], n: c[1], target: pr && window.SHINRIN && SHINRIN.prefs[pr.n] ? SHINRIN.prefs[pr.n].conifer : null,
        base: (n0[0] * BASE[0] + n0[1] * BASE[1]) / (n0[0] + n0[1]) }; });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
    g.setAttribute('aId', new T.BufferAttribute(new Float32Array(I), 1));
    g.setAttribute('aD', new T.BufferAttribute(new Float32Array(D), 4));
    return g;
  }

  // ---------------------------------------------------------------- 川の線
  function rivers(X, at) {
    const T = X.T, A = [], B = [], SE = [], IA = [], IB = [], W = [], IX = [];
    let n = 0;
    for (const L of C.rivers) {
      let prev = null;
      for (let q = 0; q < L.length; q += 3) {
        const x = L[q] / 10, z = L[q + 1] / 10, acc = L[q + 2];
        const g = at(x, z);
        const cur = { x, z, acc, y: g ? g.y : 0, k: g ? g.k : prev ? prev.k : 0 };
        if (prev) {
          const w = 0.45 + 0.4 * Math.log2(Math.max(prev.acc, 250) / 250);
          for (let e = 0; e < 4; e++) {
            A.push(prev.x, prev.y, prev.z); B.push(cur.x, cur.y, cur.z);
            SE.push(e % 2 ? 1 : -1, e < 2 ? 0 : 1); IA.push(prev.k); IB.push(cur.k); W.push(w);
          }
          IX.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); n += 4;
        }
        prev = cur;
      }
    }
    return X.geo([['position', new Float32Array(A), 3], ['aB', new Float32Array(B), 3], ['aSE', new Float32Array(SE), 2],
      ['aId', new Float32Array(IA), 1], ['aIdB', new Float32Array(IB), 1], ['aW', new Float32Array(W), 1]], new Uint32Array(IX));
  }

  // 線の材質（col＝色。省くと季節の水の色、out＝墨の縁取りの太さ、maxW＝寄った時の太さの上限 px、fly＝空を飛ぶ間の帯の幅の、線の幅に対する割合）
  // thin の線は、薄くした所が下の地面に透けるよう、重ねて塗る（PT_MAT と同じ、色に濃さを掛けた形）。ghost＝その濃さで全体を薄く（トンネルの線）
  function line(X, o, out, col, maxW = 34, fly = 0.35) {
    const U = Object.assign({}, X.U, { uOut: { value: out }, uCol: { value: new X.T.Color() }, uMaxW: { value: maxW }, uFly: { value: fly }, uThin: { value: 1 } });
    if (col == null) U.uCol.value.setRGB(-1, -1, -1); else U.uCol.value.set(col);
    return X.mat(VS_RV(X, o), FS_RV(X, o), Object.assign({ depthWrite: false, side: X.T.DoubleSide, uniforms: U }, o.thin || o.ghost ? PT_MAT(X) : {}, o.ghost ? { depthTest: false } : {}));   // ghost は山の中の線を地面ごしに
  }

  function build() {
    const X = M.inner, T = X.T, U = X.U, t0 = performance.now();
    U.uPal = { value: palTex(T) };
    U.uAtlas = { value: atlas(T) };
    const at = locator(X);
    const pg = points(X);
    const add = (o, ro) => { o.frustumCulled = false; o.renderOrder = ro; X.nat.add(o); return o; };
    const NAT = { S: S, px: [8, 46], km: 2.0 };
    add(new T.Points(pg, X.mat(VS_PT(X, NAT), FS_PT(X, NAT), PT_MAT(X))), 2);
    // 川は同じ形を2回：墨の縁取り（太い）→ 水の色。uOut だけ材質ごとに別の値
    const rg = rivers(X, at);
    add(new T.Mesh(rg, line(X, {}, 1.6)), 1.5);
    add(new T.Mesh(rg, line(X, {}, 0)), 1.6);
    X.renderer.compile(X.scene, X.camera);
    M.chokan = { points: pg.attributes.position.count, rivers: C.rivers.length, ms: Math.round(performance.now() - t0), at };
    // 県の中の地図が、同じ絵と同じ絵の具で描けるように
    M.draw = { VS_PT, FS_PT, PT_MAT, line, K, hash };
  }
})();
