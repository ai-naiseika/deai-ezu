// 全国の観光鳥瞰図（3D）。47都道府県をつないで俯瞰し、どの向きからでも回して見る。
// 県を押すと、ほかの県が少し灰色に沈み、その県だけが浮いて、断面の地層が見える。
(function () {
  'use strict';
  // 画面の大きさは覚えておく。スマホ（viewport の指定のあるページ）では、window の幅と高さを読むたびにブラウザが組版を確かめ直し、毎コマ数千回読むと、
  // 県を押した時のコマが CPU4倍で 83ms 止まった（パソコンでは出ない。2026-11-07）。変わるのは resize の時だけ
  let VW = window.innerWidth, VH = window.innerHeight;
  const T = window.THREE, J = window.JAPAN;
  const $ = (s) => document.querySelector(s);
  T.ColorManagement.enabled = false;           // 色は刷りの色のまま（三つの値をそのまま画面へ）

  const EX = 10 / 1000;                        // 標高 m → 高さ km。山を10倍に強める（鳥瞰図の流儀。14倍から下げて、空を飛ぶ間の本物に近い高さとの差を縮めた＝本人 2026-10-31）
  const DEPTH = 22;                            // 断面の深さ km
  const LIFT = 34;                             // 浮かせる高さ km（底が海の上に出る）
  const SEA_Y = -0.15;
  const NS = 64;                               // 県ごとの状態を並べる画像の幅（47県＋余り）
  const PH = [0.36, 1.45];                     // 見下ろす角度の幅（約20°〜83°）
  const DR = [140, 9000];                      // カメラの距離の幅 km（入口のスマホの縦長の画面で全国を収めるため 4600→9000）
  const HOME = { th: -0.35, ph: 0.52, D: 3800, x: -130, y: 0, z: 150 };   // 南南東から。距離と位置は開いた時に画面へ合わせる
  // 「全体」で戻る眺め：入口と同じ、北が上・真上に近い俯瞰（本人 2026-10-29「全体を押したときに、初期の俯瞰の位置まで戻らない」。前は斜めの HOME へ戻っていた）
  const OVER = { th: 0, ph: 1.3 };

  // 観光鳥瞰図の色（画風見本 04_鳥瞰図 と同じ）。季節＝春・夏・秋・冬
  const PAL = {
    plain: ['#d9e48a', '#b8d86a', '#e8c95a', '#d8c79a'],
    hill:  ['#a8d07a', '#7cbf63', '#e09a4a', '#c4b190'],
    mount: ['#79b49a', '#4f9a86', '#c46f45', '#b3a99a'],
    high:  ['#8fa9c0', '#6f8fb0', '#9a7f86', '#c4c4cc'],
    bare:  ['#a9a68a', '#a19f7c', '#b4916a', '#b9b1a6'],   // 県の中の、森も田畑も建物も無い山の地（岩・砂礫・草地）
    sea:   ['#86bedd', '#6cb0dc', '#7caccc', '#8eb0c6'],
    shallow: ['#bfe0e6', '#a8dcd8', '#b4d4d8', '#c4d6dc'],
    sky:   ['#bcdcf2', '#a8d4f2', '#cfe0ee', '#d4e2ee'],
    // 田畑（春＝水を張った田・夏＝青田・秋＝黄金・冬＝刈り田）
    rice:  ['#a9d4e0', '#9ad36a', '#f0c84a', '#d8b98a'],
    cab:   ['#cbb48c', '#a6d589', '#b8d28f', '#f2f4f4'],      // 高原キャベツ（春＝土・夏秋＝青い玉・冬＝雪）
    wheat: ['#b5d870', '#f2c040', '#d4b88a', '#c4d696'],
    veg:   ['#c2e07a', '#7ec45c', '#b4cc6a', '#a8bc74'],
  };
  const SNOW = [1650, 99999, 2300, 650];       // 雪の残る高さ（北緯36度で）
  const SNOW_N = [1.3, 0, 1.0, 0.95];          // 北へ1km行くごとに、雪の高さが下がる m
  const SEASON = ['春', '夏', '秋', '冬'];
  const FULL = (n) => n === '北海道' ? n : n === '東京' ? '東京都' : (n === '京都' || n === '大阪') ? n + '府' : n + '県';

  const msg = (t) => { const m = $('#msg'); m.textContent = t; m.style.display = 'block'; $('#wait').style.display = 'none'; };
  if (!T || !J) return msg('地図のデータが読めませんでした。フォルダの中身がそろっているか確かめてください。');
  if (!window.DecompressionStream) return msg('このブラウザでは開けません。Chrome か Edge で開いてください。');

  // ---------------------------------------------------------------- 骨を開く
  async function inflate(b64) {
    const s = atob(b64), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  }
  // 日本.js の網は1つ前との差で届く（日本を作る.py の delta）。型の幅で折り返した差を、その場で足し戻す（頂点は x・y・z ごとに3つおき）
  function undelta(buf) {
    const add = (a, k) => { for (let i = k; i < a.length; i++) a[i] += a[i - k]; };
    for (const p of J.prefs) {
      const I = p.big ? Uint32Array : Uint16Array;
      add(new Int16Array(buf, p.pos[0], p.pos[1]), 3); add(new I(buf, p.idx[0], p.idx[1]), 1); add(new I(buf, p.seg[0], p.seg[1]), 1);
    }
    for (const s of J.small || []) add(new Int16Array(buf, s.g[0], s.g[1]), 1);
  }

  const P = J.prefs;
  let POS;                                     // 天面の頂点（全県つなげた）

  function build(buf) {
    let nv = 0, ni = 0, ns = 0;
    for (const p of P) {
      const I = p.big ? Uint32Array : Uint16Array;
      p.P = new Int16Array(buf, p.pos[0], p.pos[1]);
      p.I = new I(buf, p.idx[0], p.idx[1]);
      p.S = new I(buf, p.seg[0], p.seg[1]);
      nv += p.P.length / 3; ni += p.I.length; ns += p.S.length / 2;
    }
    const pos = POS = new Float32Array(nv * 3), aH = new Float32Array(nv), aId = new Float32Array(nv), idx = new Uint32Array(ni);
    const wPos = new Float32Array(ns * 12), wNor = new Float32Array(ns * 12), wId = new Float32Array(ns * 4), wTop = new Float32Array(ns * 4), wIdx = new Uint32Array(ns * 6);
    const lA = new Float32Array(ns * 12), lB = new Float32Array(ns * 12), lSE = new Float32Array(ns * 8), lId = new Float32Array(ns * 4), lIdx = new Uint32Array(ns * 6);
    let v = 0, i = 0, s = 0;
    P.forEach((p, k) => {
      const n = p.P.length / 3;
      p.k = k; p.v0 = v; p.nv = n; p.s0 = s; p.ns = p.S.length / 2;
      let best = 1e9;
      for (let j = 0; j < n; j++) {
        const x = p.P[j * 3] * J.q, z = p.P[j * 3 + 1] * J.q, y = p.P[j * 3 + 2] * EX;
        pos.set([x, y, z], (v + j) * 3); aH[v + j] = p.P[j * 3 + 2]; aId[v + j] = k;
        const d = (x - p.ax) ** 2 + (z - p.az) ** 2;
        if (d < best) { best = d; p.ay = y; }
      }
      for (let j = 0; j < p.I.length; j++) idx[i + j] = p.I[j] + v;
      // 寄った時に収める範囲：札の点から 380km 以内（東京の島々・沖縄の先島で遠くへ引きすぎない）。
      // 東京は伊豆諸島（八丈島まで約290km）が入ると、選んでも本土に寄らず、「東京の中へ」の吹き出しも離れて出た（本人 2026-11-01）ので本土だけ。
      // 吹き出しの置き場所（screenBox）と、スマホで選んだ時の眺めも同じ範囲で
      // 長崎は本土・五島・壱岐まで（対馬は外す）、鹿児島は本土と種子島・屋久島まで（奄美は外す）。
      // 沖縄は沖縄島・宮古・八重山・尖閣まで（東経129度より東の大東諸島は外す）。沖縄島だけにすると尖閣の印が画面の外に出て、
      // 「沖縄を浮かせた時に尖閣の吹き出しを出す」（本人 2026-10-27）が効かなくなった（2026-11-06）
      const FR = { '東京': 90, '長崎': 120, '鹿児島': 160, '沖縄': { r: 470, lonMax: 129 } }[p.name] || 380;
      const f = [1e9, 1e9, -1e9, -1e9], R = FR.r || FR, xMax = FR.lonMax ? (FR.lonMax - 137.5) * 111.32 * Math.cos(36 * Math.PI / 180) : Infinity;
      p.fr = R;
      p.inFr = (x, z) => (x - p.ax) ** 2 + (z - p.az) ** 2 <= R * R && x <= xMax;
      for (let j = 0; j < n; j++) {
        const x = pos[(v + j) * 3], z = pos[(v + j) * 3 + 2];
        if (!p.inFr(x, z)) continue;
        f[0] = Math.min(f[0], x); f[1] = Math.min(f[1], z); f[2] = Math.max(f[2], x); f[3] = Math.max(f[3], z);
      }
      p.frame = f;
      for (let j = 0; j < p.S.length; j += 2, s++) {
        const a = (p.S[j] + v) * 3, b = (p.S[j + 1] + v) * 3;
        const ax = pos[a], ay = pos[a + 1], az = pos[a + 2], bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
        let nx = bz - az, nz = ax - bx; const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
        // 断面の壁：上の2点（天面の縁）と下の2点（深さ DEPTH）。外向き＝線分の進む向きの左
        wPos.set([ax, ay, az, bx, by, bz, bx, -DEPTH, bz, ax, -DEPTH, az], s * 12);
        for (let q = 0; q < 4; q++) {
          wNor.set([nx, 0, nz], s * 12 + q * 3); wId[s * 4 + q] = k;
          lA.set([ax, ay, az], s * 12 + q * 3); lB.set([bx, by, bz], s * 12 + q * 3); lId[s * 4 + q] = k;
        }
        wTop.set([ay, by, by, ay], s * 4);
        wIdx.set([s * 4, s * 4 + 1, s * 4 + 2, s * 4, s * 4 + 2, s * 4 + 3], s * 6);
        // 墨の線：線分ごとに、画面の上の幅で太らせた四角
        lSE.set([-1, 0, 1, 0, -1, 1, 1, 1], s * 8);
        lIdx.set([s * 4, s * 4 + 2, s * 4 + 1, s * 4 + 1, s * 4 + 2, s * 4 + 3], s * 6);
      }
      v += n; i += p.I.length;
    });
    // 壁の向きを、隣の線分と分け合う頂点で平均する（線分ごとの向きのままだと、2.5kmおきに光が変わって縦の縞が出た）
    const vn = new Float32Array(nv * 2), wv = new Uint32Array(ns * 4);
    s = 0;
    for (const p of P) for (let j = 0; j < p.S.length; j += 2, s++) {
      const a = p.S[j] + p.v0, b = p.S[j + 1] + p.v0, o = s * 12;
      vn[a * 2] += wNor[o]; vn[a * 2 + 1] += wNor[o + 2]; vn[b * 2] += wNor[o]; vn[b * 2 + 1] += wNor[o + 2];
      wv.set([a, b, b, a], s * 4);
    }
    for (let q = 0; q < ns * 4; q++) {
      const a = wv[q], L = Math.hypot(vn[a * 2], vn[a * 2 + 1]);
      if (L < 0.2) continue;                                   // 細い岬の先で向きが打ち消し合う所は、線分の向きのまま
      wNor[q * 3] = vn[a * 2] / L; wNor[q * 3 + 2] = vn[a * 2 + 1] / L;
    }
    for (const s of J.small || []) {
      const p = P.find((p) => p.n === s.pref), f = p.frame;
      if (!p.inFr(s.x, s.z)) continue;   // 寄る範囲の外の小さな島（大東諸島など）で広げない
      f[0] = Math.min(f[0], s.x - 30); f[1] = Math.min(f[1], s.z - 30); f[2] = Math.max(f[2], s.x + 30); f[3] = Math.max(f[3], s.z + 30);
    }
    const top = geo([['position', pos, 3], ['aH', aH, 1], ['aId', aId, 1]], idx);
    top.computeVertexNormals();
    return {
      top,
      wall: geo([['position', wPos, 3], ['normal', wNor, 3], ['aId', wId, 1], ['aTop', wTop, 1]], wIdx),
      line: geo([['position', lA, 3], ['aB', lB, 3], ['aSE', lSE, 2], ['aId', lId, 1]], lIdx),
      lA, lB, lSE, lId, lIdx,
    };
  }

  function geo(attrs, index) {
    const G = new T.BufferGeometry();
    for (const [k, a, n] of attrs) G.setAttribute(k, new T.BufferAttribute(a, n));
    G.setIndex(new T.BufferAttribute(index, 1));
    return G;
  }

  // ---------------------------------------------------------------- 絵の具（シェーダー）
  const U = {
    uState: { value: null }, uLdir: { value: new T.Vector3(0, 1, 0) },
    uFogCol: { value: new T.Color('#f1e6cb') }, uFogNear: { value: 3000 }, uFogFar: { value: 8000 },
    uPlain: { value: new T.Color() }, uHill: { value: new T.Color() }, uMount: { value: new T.Color() }, uHigh: { value: new T.Color() }, uBare: { value: new T.Color() },
    uPlainS: { value: new T.Color(PAL.plain[1]) }, uHillS: { value: new T.Color(PAL.hill[1]) },
    uMountS: { value: new T.Color(PAL.mount[1]) }, uHighS: { value: new T.Color(PAL.high[1]) },
    uSnow: { value: new T.Color('#fbfbf8') }, uDark: { value: new T.Color('#28406a') }, uLight: { value: new T.Color('#fff6c8') },
    uSnowLine: { value: 99999 }, uSnowN: { value: 0 },
    uSea: { value: new T.Color() }, uShallow: { value: new T.Color() }, uFoam: { value: new T.Color('#f7f6ee') },
    uInk: { value: new T.Color('#2a3146') },
    uMask: { value: null }, uBox: { value: new T.Vector4() },
    uRes: { value: new T.Vector2(1, 1) }, uW: { value: 1.8 },
    uExag: { value: EX * 1000 }, uFarm: { value: new T.Vector4() }, uCab: { value: new T.Color() },
    uSeason: { value: 1 }, uRice: { value: new T.Color() }, uWheat: { value: new T.Color() }, uVeg: { value: new T.Color() },
    uTown: { value: null }, uTownBox: { value: new T.Vector4(0, 0, 1, 1) }, uTownK: { value: 1 },
    uPpk: { value: 1 }, uDpr: { value: 1 }, uHideId: { value: -1 }, uPop: { value: 0 }, uNight: { value: 0 }, uDusk: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 1 }, uWind: { value: new T.Vector2(1, 0) }, uLand: { value: null }, uLuOn: { value: 0 }, uNear3D: { value: 0 }, uPatK: { value: 0.01 }, uConOdds: { value: 1 },
    // 県の中の山の強め方の倍率（1＝5倍のまま。空を飛ぶ間は旅.js が高さで決める）・木と家の絵の大きさの倍率・絵の大きさの上限（0＝いつもの上限）
    uInY: { value: 1 }, uPtK: { value: 1 }, uPxMax: { value: 0 }, uNearR: { value: 0 }, uNearK: { value: 0 },
  };
  // 町の濃さ（2.5km の升ごとの町丁目の数。鳥瞰.js）。無い時は町を描かない
  const TOWN = window.CHOKAN && window.CHOKAN.town;
  U.uTown.value = new T.DataTexture(new Uint8Array(1), 1, 1, T.RedFormat, T.UnsignedByteType);
  U.uTown.value.needsUpdate = true;
  U.uLand.value = new T.DataTexture(new Uint8Array(4), 1, 1, T.RGBAFormat, T.UnsignedByteType);
  U.uLand.value.needsUpdate = true;
  U.uCrown = { value: U.uLand.value };                 // 森の樹冠の模様（県の中.js が初めて入る時に焼く）

  const STATE = `
    uniform sampler2D uState;
    vec4 stateOf(float id) { return texture2D(uState, vec2((id + 0.5) / ${NS}.0, 0.5)); }
  `;
  // 仕上げ：選ばれていない県は灰色へ沈め、乗せた県は明るく、遠くは紙の色へ溶かす
  const FINISH = `
    uniform vec3 uFogCol; uniform float uFogNear, uFogFar, uNight, uDusk;
    vec3 finish(vec3 c, vec3 S, float dist) {
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, vec3(lum) * 0.5 + vec3(0.43, 0.42, 0.40), S.x * 0.7);
      c = mix(c, min(c * 1.1 + vec3(0.07, 0.06, 0.02), vec3(1.0)), S.y * 0.9);
      c = mix(c, min(c * 1.12 + vec3(0.14, 0.10, -0.02), vec3(1.0)), S.z * 0.85);
      // 夜：月夜の青みに沈める（町の灯りは、この後に足す）
      c = mix(c, c * vec3(0.27, 0.32, 0.50) + vec3(0.012, 0.017, 0.042), uNight);
      // 朝焼け・夕焼け：太陽が地平線の近くにある間、暖かい色へ寄せる
      c = mix(c, c * vec3(1.06, 0.84, 0.70) + vec3(0.05, 0.02, 0.0), uDusk * 0.55);
      return mix(c, uFogCol, smoothstep(uFogNear, uFogFar, dist));
    }
    float hash2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    // 水彩のむら：地面に付いた座標で（画面に塗ると、カメラが動いた時に汚れたガラス越しに見える）。
    // 大きなにじみ（数km）と小さなむら、色だまり（濃い所がより濃く）
    vec3 wash(vec3 c, vec2 p, float kmpp) {
      float a = vnoise(p / 9.0) * 0.6 + vnoise(p / 3.1 + 7.3) * 0.4;
      float b = vnoise(p / 0.9 + 3.1);
      float fine = 1.0 - smoothstep(0.08, 0.5, kmpp);
      float k = (a - 0.5) * 0.16 + (b - 0.5) * 0.08 * fine;
      c *= 1.0 + k;
      return mix(c, c * vec3(1.04, 1.0, 0.93), smoothstep(0.55, 0.8, a) * 0.6);
    }
  `;

  const VS_SOLID = `${STATE}
    attribute float aId; attribute float aH; attribute float aTop;
    varying vec3 vN; varying vec3 vW; varying float vH; varying float vTop; varying vec3 vS; varying float vDist;
    void main() {
      vec4 s = stateOf(aId);
      vec3 p = position; p.y += s.r;
      vN = normal; vW = position; vH = aH; vTop = aTop; vS = s.gba;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;

  // 天面：標高の帯（平野・里山・山・高い山）×季節の色、平らな低地に田畑の区画、町、雪、3段の陰影。
  // 木と家は地面に塗らず、絵の札として立てる（描き込み.js）
  // 地面の色の決まり（全国の天面と、県の中の細かい地面で同じ物を使う）。FINISH の後に置く
  const GROUND = `
    uniform vec3 uPlain, uHill, uMount, uHigh, uBare, uPlainS, uHillS, uMountS, uHighS, uSnow, uDark, uLight, uLdir, uInk;
    uniform vec3 uRice, uWheat, uVeg;
    uniform sampler2D uTown; uniform vec4 uTownBox; uniform float uTownK;
    uniform float uSnowLine, uSnowN, uExag;
    uniform vec4 uFarm; uniform vec3 uCab;
    uniform float uTime, uCloud; uniform vec2 uWind;
    // 土地利用（県の中だけ・uLuOn＝1）：R 田・G 畑・B 森林・A 建物用地の割合。町の世帯の画像と同じ升（uTownBox）。全国は今の決め方
    uniform sampler2D uLand, uCrown; uniform float uLuOn; uniform float uSeason;
    // 地面の模様（森の冠・田畑の区画・街区）の細かさは、画面ぜんたいで1つ（uPatK＝見ている所の1画素が何 km か。地図の眺めはカメラの近さ、空を飛ぶ間は飛ぶ高さで決める）。
    // 画素ごとの距離で決めると、進むたびに細かさの切り替わる帯が地面の上を流れ、山肌や地面の模様がうねうね動いて見えた（本人 2026-10-30）。
    // 画面で細かくなりすぎた所（遠く）は、模様を平均の色へ薄める（ちらつき止め）。uConOdds＝森の針葉樹の割合の県ごとの倍率（森林.js）
    uniform float uPatK, uConOdds;
    float gRice = 0.6;
    // 森の樹冠（2026-10-30 本人「車窓モードをするなら、近くの物や見える範囲の遠くの景色が、今よりリッチで美しいと感じる鳥瞰図に」）：
    // 県の中の土地利用の森林の所に、季節の色の木の冠を粒で描く（斜面が平らな茶色の面だった）。粒は画面で約10画素で、寄るほど細かい段へ
    vec3 crownCol(float r, float conifer) {
      if (conifer > 0.5) return vec3(0.15, 0.40, 0.29) * (0.85 + 0.3 * r);
      if (uSeason < 0.5) return r > 0.94 ? vec3(0.93, 0.74, 0.80) : mix(vec3(0.58, 0.78, 0.40), vec3(0.44, 0.69, 0.33), r);   // 春：若葉と、ときどき山桜
      if (uSeason < 1.5) return mix(vec3(0.22, 0.52, 0.27), vec3(0.34, 0.62, 0.31), r);
      if (uSeason < 2.5) return r < 0.3 ? vec3(0.80, 0.25, 0.15) : r < 0.58 ? vec3(0.89, 0.50, 0.15) : r < 0.8 ? vec3(0.90, 0.72, 0.22) : vec3(0.36, 0.52, 0.28);
      return mix(vec3(0.47, 0.40, 0.35), vec3(0.56, 0.49, 0.43), r);          // 冬：葉を落とした枝（雪は高い所に後から）
    }
    // 冠の模様は焼いた画像（県の中.js の crownTex：8×8 の冠・r＝くじ・gb＝冠の中の向き・a＝中心からの距離）から拾う。
    // 1画素ずつ計算すると、横浜の上を回すコマが 17ms → 33ms に重くなった
    vec3 forestAt(vec2 p, float S, vec3 under, float conShare) {
      vec4 t = texture2D(uCrown, p / (S * 8.0), -1.0);                   // 縮小のぼかしを弱める（色が混ざって濁った）
      float d = t.a * 1.2; vec2 bc = t.gb * 2.0 - 1.0;
      vec3 n = vec3(bc.x, sqrt(max(0.0, 1.0 - dot(bc, bc))), bc.y);
      vec3 col = crownCol(fract(t.r * 7.13), step(fract(t.r * 3.71), conShare)) * (0.72 + 0.42 * clamp(dot(n, uLdir), 0.0, 1.0));
      col = mix(col, col * 0.6, smoothstep(0.75, 1.0, d));                 // 縁は濃く（冠の重なりの陰）
      return mix(under, col, 1.0 - smoothstep(0.95, 1.05, d));             // 冠のすき間は、下の暗い地面
    }
    // 2段の粒を混ぜて、寄った時の切り替えをなめらかに（k＝その貼り方での1画素の長さ）
    // 地面すれすれ（空を飛ぶ）では、画面の大きさで決めると模様が実物より細かく（田畑の区画が数m）なり無地に見えた。実の大きさより小さくしない
    vec3 crownAvg(float con) {                     // 冠の色の平均（季節ごと。遠くで模様を薄める先）
      vec3 b = uSeason < 0.5 ? vec3(0.51, 0.735, 0.365) : uSeason < 1.5 ? vec3(0.28, 0.57, 0.29) : uSeason < 2.5 ? vec3(0.76, 0.48, 0.19) : vec3(0.515, 0.445, 0.39);
      return mix(b, vec3(0.15, 0.40, 0.29), con);
    }
    vec3 forestLv(vec2 p, float k, vec3 under, float con) {
      float lv = max(log2(uPatK * 14.0), log2(0.007)), l0 = floor(lv);     // 冠は見ている所で約14画素（実の木の間 7m より細かくしない）
      vec3 a = mix(forestAt(p, exp2(l0), under, con), forestAt(p, exp2(l0 + 1.0), under, con), smoothstep(0.8, 1.0, lv - l0));
      return mix(mix(under, crownAvg(con) * 0.82, 0.75), a, smoothstep(2.5, 5.0, exp2(l0) / k));   // 冠が画面で5画素より小さい所は平均の色へ
    }
    // 雲の影（本人 2026-10-29「雲も流れがあっても楽しい」）：地面に落ちる淡い影が、空の雲と同じ風の向き（uWind）へゆっくり流れる。夜は消す（uCloud）。
    // 前は時刻を足していたので、模様は東から西へ流れていた（2026-11-02 に空の雲を足した時に気づいた）
    float cloudShade(vec2 p) {
      vec2 q = p * 0.018 - uWind * (uTime * 0.0126);
      float n = vnoise(q) * 0.65 + vnoise(q * 2.3 + 7.1) * 0.35;
      return smoothstep(0.58, 0.78, n) * 0.16 * uCloud;
    }
    // 区画整理の田畑：少し傾いた長方形。区画の大きさは画面で約11画素（寄ると細かい区画が出る）
    vec3 parcel(vec2 p, float S, float kmpp, out float edge) {
      vec2 sz = vec2(S * 1.25, S * 0.85);
      vec2 q = mat2(0.993, 0.12, -0.12, 0.993) * p / sz;
      vec2 id = floor(q), f = fract(q);
      float r = hash2(id);
      vec3 c = r < gRice ? uRice : r < gRice + (1.0 - gRice) * 0.6 ? uVeg : uWheat;
      // 秋の田は、刈り取りの済んだ所（切り株の土色）と、まだの所（黄金色）がまだらに
      if (r < gRice && uSeason > 1.5 && uSeason < 2.5 && hash2(id + 9.1) < 0.4) c = vec3(0.74, 0.63, 0.44);
      c *= 0.93 + 0.12 * hash2(id + 3.7);
      vec2 d = min(f, 1.0 - f) * sz / kmpp;
      edge = 1.0 - smoothstep(0.25, 1.0, min(d.x, d.y));
      // 畦（あぜ）：地面すれすれでは実の幅 1.2m の草の筋（画面で1画素より細い所では消える）
      vec2 dm = min(f, 1.0 - f) * sz;
      float ridge = (1.0 - smoothstep(0.0012, 0.0012 + kmpp, min(dm.x, dm.y))) * (1.0 - smoothstep(0.0006, 0.0015, kmpp));
      c = mix(c, uSeason > 1.5 && uSeason < 2.5 ? vec3(0.62, 0.62, 0.38) : vec3(0.42, 0.58, 0.30), ridge * 0.85);
      return c;
    }
    vec3 ground(vec3 vW, float h, vec3 n) {
      float sub = smoothstep(640.0, 820.0, vW.z);
      vec3 c = mix(uPlain, uPlainS, sub);
      c = mix(c, mix(uHill, uHillS, sub), clamp((h - 200.0) / 240.0, 0.0, 1.0));
      c = mix(c, mix(uMount, uMountS, sub), clamp((h - 830.0) / 240.0, 0.0, 1.0));
      c = mix(c, mix(uHigh, uHighS, sub), clamp((h - 1630.0) / 240.0, 0.0, 1.0));
      float kmpp = max(length(fwidth(vW.xz)), 1e-4);
      float town = texture2D(uTown, (vW.xz - uTownBox.xy) / uTownBox.zw).r * 255.0 * uTownK;
      float urban = smoothstep(7.0, 28.0, town);
      // 土地利用が建物用地なら、世帯が少なめ（60〜560世帯/升）でも町の地面に。前は地の色のまま残り、空を飛ぶと家の間が一面の黄色い無地に見えた（2026-10-30）
      if (uLuOn > 0.5) urban = max(urban, smoothstep(0.35, 0.7, texture2D(uLand, (vW.xz - uTownBox.xy) / uTownBox.zw).a) * smoothstep(1.0, 3.0, town));
      // 平らか：山を強めた見た目の傾きから、本物の傾きにもどして決める（全国10倍・県の中5倍で同じ決まりになるように）
      float slope = sqrt(max(1.0 - n.y * n.y, 0.0)) / max(n.y, 0.05) / uExag;
      // 田畑は平らな所。盆地は高い所にもある（長野 350m・松本 600m・佐久 700m）ので、高さの上限は 950m あたり（前は 340m で、松本盆地が森になった。2026-10-29）
      float level = (1.0 - smoothstep(0.010, 0.022, slope)) * (1.0 - smoothstep(800.0, 980.0, h));
      vec4 luv = uLuOn > 0.5 ? texture2D(uLand, (vW.xz - uTownBox.xy) / uTownBox.zw) : vec4(0.0);
      if (uLuOn > 0.5) {
        level = smoothstep(0.15, 0.5, luv.r + luv.g) * (1.0 - smoothstep(0.012, 0.05, slope));   // 田畑の区画は、本当に田か畑の所だけ
        gRice = luv.r / (luv.r + luv.g + 0.001);                                                  // 田と畑の色の割合も本物に
      }
      // 森（県の中・土地利用の森林）：2段の粒を混ぜて、寄った時の切り替えをなめらかに。針葉樹の割合は木の絵と同じ決まり（高い所ほど多い）
      // 急な斜面は真上から貼ると冠が縦に伸びて筋になる。真上・東西・南北の3方向から貼り、面の向きで混ぜる
      // （斜面に沿った向きで貼ると、向きが三角形ごとに変わってジグザグの筋になった）
      vec3 tw = pow(abs(n), vec3(4.0)); tw /= tw.x + tw.y + tw.z;
      float kf = max(length(fwidth(vW.xz)), 1e-4), kx = max(length(fwidth(vW.zy)), 1e-4), kz = max(length(fwidth(vW.xy)), 1e-4);
      // 森も田畑も建物も無い山の地（県の中）：岩・砂礫・草地の色に。陰も紺ではなく地の色を暗く（下の陰影）。鳥瞰図の山の青と紺の陰のままだと、
      // 浅間山の砂礫の陰の側や、谷川岳の岩と草の尾根が湖に見えた（本人 2026-11-01「木が無いのは本当に生えていないから？」）。
      // 森の割合が半分ほどの縁の升も地の色に寄せる（0.1〜0.4 で切り替えると、森との境に青緑の縁が残った）
      float bareK = uLuOn > 0.5 ? (1.0 - smoothstep(0.25, 0.75, luv.r + luv.g + luv.b + luv.a)) * smoothstep(700.0, 900.0, h) : 0.0;
      c = mix(c, uBare * (0.92 + 0.12 * vnoise(vW.xz * 4.0)), bareK);
      if (uLuOn > 0.5 && luv.b > 0.03) {
        float c0 = h > 1150.0 ? 0.6 : 0.27, con = uConOdds * c0 / (1.0 - c0 + uConOdds * c0);   // 木の絵と同じく、県ごとの表に合わせた割合
        vec3 under = c * 0.5, fc = vec3(0.0);
        if (tw.y > 0.02) fc += forestLv(vW.xz, kf, under, con) * tw.y;
        if (tw.x > 0.02) fc += forestLv(vW.zy, kx, under, con) * tw.x;
        if (tw.z > 0.02) fc += forestLv(vW.xy, kz, under, con) * tw.z;
        fc /= (tw.y > 0.02 ? tw.y : 0.0) + (tw.x > 0.02 ? tw.x : 0.0) + (tw.z > 0.02 ? tw.z : 0.0);
        c = mix(c, fc, smoothstep(0.08, 0.55, luv.b) * (1.0 - urban));
      }
      // 高原の畑（嬬恋のキャベツなど。県の中だけ uFarm＝中心 x・z と半径 km）：畝の筋の入った区画
      float hi = uFarm.z > 0.0 ? (1.0 - smoothstep(uFarm.z * 0.75, uFarm.z, distance(vW.xz, uFarm.xy))) * smoothstep(820.0, 900.0, h)
        * (1.0 - smoothstep(1450.0, 1550.0, h)) * (1.0 - smoothstep(0.08, 0.14, slope)) : 0.0;
      if (hi > 0.0) {
        float lv = max(log2(uPatK * 11.0), log2(0.032)), S = exp2(floor(lv)), e0;
        vec3 a = parcel(vW.xz, S, kmpp, e0);
        vec2 q = mat2(0.993, 0.12, -0.12, 0.993) * vW.xz / vec2(S * 1.25, S * 0.85);
        float row = smoothstep(0.35, 0.5, abs(fract(q.y * 5.0) - 0.5));
        vec3 fc = uCab * (0.9 + 0.2 * hash2(floor(q) + 1.3)) * mix(1.0, 0.86, row);
        c = mix(c, mix(uCab, mix(fc, uInk, e0 * 0.2), smoothstep(2.0, 5.0, S * 0.85 / kmpp)), hi * 0.92);
      }
      if (level > 0.0) {
        float lv = max(log2(uPatK * 11.0), log2(0.032)), l0 = floor(lv), fr = smoothstep(0.8, 1.0, lv - l0), e0, e1;   // 田畑の区画は 40m×27m より細かくしない
        vec3 a = parcel(vW.xz, exp2(l0), kmpp, e0), b = parcel(vW.xz, exp2(l0 + 1.0), kmpp, e1);
        vec3 rice = uSeason > 1.5 && uSeason < 2.5 ? mix(uRice, vec3(0.74, 0.63, 0.44), 0.4) : uRice;
        vec3 avg = mix(mix(uVeg, uWheat, 0.4), rice, gRice) * 0.99;          // 区画の色の平均（遠くで模様を薄める先）
        vec3 fc = mix(avg, mix(mix(a, b, fr), uInk, mix(e0, e1, fr) * 0.2), smoothstep(2.0, 5.0, exp2(l0) * 0.85 / kmpp));
        c = mix(c, fc, level * (1.0 - urban) * 0.92);
      }
      // 工場と倉庫：建物用地なのに住む人の少ない所（埋め立ての工業地帯など）は、灰色の地面に大きな区画
      float ind = uLuOn > 0.5 ? smoothstep(0.35, 0.7, luv.a) * (1.0 - smoothstep(1.0, 3.0, town)) : 0.0;     // 世帯 20 未満〜60（村の家並みは灰色にしない）
      if (ind > 0.0) {
        float lv = max(log2(uPatK * 4.0), log2(0.06)), S = exp2(floor(lv)) * 1.6;
        vec2 b0 = fract(vW.xz / S);
        float st = mix(0.26, step(0.86, max(b0.x, b0.y)), smoothstep(2.0, 4.0, S / kmpp));
        c = mix(c, mix(vec3(0.80, 0.78, 0.74), vec3(0.62, 0.60, 0.57), st), ind * 0.85);
      }
      // 町：家の建てこんだ所は、明るい土の色に細かい街区
      if (urban > 0.0) {
        float lv = max(log2(uPatK * 6.0), log2(0.06)), S = exp2(floor(lv));   // 街区は 60m より細かくしない
        vec2 b0 = fract(vW.xz / S), b1 = fract(vW.xz / (S * 2.0));
        float st = mix(step(0.84, max(b0.x, b0.y)), step(0.92, max(b1.x, b1.y)), smoothstep(0.8, 1.0, fract(lv)));
        st = mix(0.29, st, smoothstep(2.0, 4.0, S / kmpp));
        c = mix(c, mix(vec3(0.91, 0.86, 0.76), vec3(0.76, 0.70, 0.62), st), urban * 0.85);
      }
      float line = uSnowLine + vW.z * uSnowN;
      float sn = clamp((h - line + 90.0) / 180.0, 0.0, 1.0) * smoothstep(0.3, 0.65, n.y) * (1.0 - sub);
      c = mix(c, uSnow, sn);
      float l = dot(n, uLdir);
      // 陰影：3段の刷りの平らさと、水彩のぼかしの間（段の境をやわらかく）
      float sh = mix(floor((l - 0.72) * 2.2 + 0.5) / 2.2, l - 0.72, 0.45);
      c = sh > 0.0 ? mix(c, uLight, min(0.5, sh * 1.2)) : mix(c, mix(uDark, c * 0.45, bareK * (1.0 - sn)), min(0.5, -sh * 1.1));
      c *= 1.0 - cloudShade(vW.xz);
      return wash(c, vW.xz, kmpp);
    }
    // 夜の町の灯り：町の濃さ（全国＝町丁目の数、県の中＝世帯数を同じ尺度にした物）に比例して、暖かい灯りの粒と、町ぜんたいのぼんやりした明かり。
    // 粒は画面で4〜8画素の升ごとのくじ（升の大きさは2倍ずつの段。寄っても引いても同じ密度に見える。1画素より小さいと、全国の眺めで灯りが見えなかった）。
    // 遠くから見る時は、町ぜんたいのぼんやりした明かりを強める。霞の向こうは薄く
    vec3 lights(vec3 vW, float dist) {
      if (uNight < 0.01) return vec3(0.0);
      float town = texture2D(uTown, (vW.xz - uTownBox.xy) / uTownBox.zw).r * 255.0 * uTownK;
      if (town < 0.5) return vec3(0.0);
      float kmpp = max(length(fwidth(vW.xz)), 1e-4), S = 0.15 * exp2(max(ceil(log2(uPatK * 4.0 / 0.15)), -2.0));
      vec2 q = vW.xz / S, i = floor(q), f = fract(q) - 0.5;
      float on = step(1.0 - clamp(town / 30.0, 0.04, 0.9), hash2(i + 7.1));
      // すぐ近く（1画素が20m より細かい）では粒を消す（家の窓が灯りの代わり）。低く飛ぶと、地面一面が粒だらけになった
      float spot = on * (1.0 - smoothstep(0.1, 0.3, length(f))) * smoothstep(0.004, 0.02, kmpp) * smoothstep(2.0, 4.0, S / kmpp);
      // 町丁目の数は都心に偏る（郊外の住宅地は町丁目が大きい）ので、薄い所にも明かりが届くように平方根で
      float glow = sqrt(smoothstep(0.5, 60.0, town)) * mix(0.18, 0.75, smoothstep(0.3, 3.0, kmpp));
      return vec3(1.0, 0.80, 0.45) * (spot * 0.85 + glow) * uNight * (1.0 - smoothstep(uFogNear, uFogFar, dist));
    }`;
  const FS_TOP = `
    ${FINISH}
    ${GROUND}
    varying vec3 vN; varying vec3 vW; varying float vH; varying vec3 vS; varying float vDist;
    void main() { gl_FragColor = vec4(finish(ground(vW, vH, normalize(vN)), vS, vDist) + lights(vW, vDist) * (1.0 - vS.x * 0.8), 1.0); }`;

  // 断面：本物の地下の地層は全国のデータが無いので、雰囲気のグラデーションで描く（本人 2026-10-27「線を入れないでグラデーションで十分」）。
  // 地表から深さで、草→黒土→赤土→明るい砂の層→粘土→灰色の岩へ、境を線にせずゆっくり混ぜる。深い所だけゆるく波打つ。
  // 色は場所（世界の座標）で決めるので、浮いた県の壁と、隣の県の穴の壁が同じ色でつながる
  const FS_WALL = `
    uniform vec3 uLdir, uHill;
    ${FINISH}
    varying vec3 vN; varying vec3 vW; varying float vTop; varying vec3 vS; varying float vDist;
    void main() {
      vec3 n = normalize(vN);
      float d = vTop - vW.y;
      float wave = 1.6 * sin(vW.x * 0.011 + vW.z * 0.007) + 0.8 * sin(vW.x * 0.029 - vW.z * 0.023 + 1.7);
      float g = d + wave * smoothstep(1.0, 6.0, d);
      vec3 c = uHill;
      c = mix(c, vec3(0.33, 0.26, 0.21), smoothstep(0.1, 0.6, g));
      c = mix(c, vec3(0.62, 0.40, 0.26), smoothstep(1.0, 2.8, g));
      c = mix(c, vec3(0.80, 0.66, 0.45), smoothstep(3.5, 7.5, g));
      c = mix(c, vec3(0.62, 0.56, 0.50), smoothstep(8.5, 13.5, g));
      c = mix(c, vec3(0.47, 0.45, 0.50), smoothstep(14.5, 21.0, g));
      c *= 1.0 + 0.03 * sin(g * 2.2 + wave);
      c = n.y < -0.5 ? vec3(0.40, 0.39, 0.43) : c;
      c *= n.y < -0.5 ? 1.0 : 0.80 + 0.22 * smoothstep(-0.3, 0.5, dot(n, uLdir));   // 断面の陰は段にせず、ゆるやかに（段だと縦の縞になった）
      gl_FragColor = vec4(finish(c, vS, vDist), 1.0);
    }`;

  // 穴の底：浮かせた県の跡。浮いている間だけ出す
  const VS_FLOOR = `${STATE}
    attribute float aId;
    varying vec3 vS; varying float vDist; varying vec3 vW;
    void main() {
      vec4 s = stateOf(aId);
      vS = s.gba; vW = position;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vDist = -mv.z;
      gl_Position = s.r < 0.6 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
    }`;
  const FS_FLOOR = `
    ${FINISH}
    varying vec3 vS; varying float vDist; varying vec3 vW;
    void main() {
      vec3 c = vec3(0.34, 0.29, 0.25) * (0.94 + 0.08 * hash2(floor(vW.xz / 3.0)));
      gl_FragColor = vec4(finish(c, vec3(0.3, 0.0, 0.0), vDist), 1.0);
    }`;

  // 墨の線：県境と海岸。線分を画面の上で一定の太さ（px）に太らせる
  const VS_LINE = `${STATE}
    attribute vec3 aB; attribute vec2 aSE; attribute float aId;
    uniform vec2 uRes; uniform float uW;
    varying vec3 vS; varying float vDist;
    void main() {
      vec4 s = stateOf(aId);
      vec3 A = position, B = aB; A.y += s.r; B.y += s.r;
      vec4 ma = modelViewMatrix * vec4(A, 1.0), mb = modelViewMatrix * vec4(B, 1.0);
      ma.xyz *= 0.9993; mb.xyz *= 0.9993;
      vec4 ca = projectionMatrix * ma, cb = projectionMatrix * mb;
      vec2 dir = cb.xy / cb.w * uRes - ca.xy / ca.w * uRes;
      float L = length(dir);
      dir = L > 0.00001 ? dir / L : vec2(1.0, 0.0);
      vec4 c = aSE.y < 0.5 ? ca : cb;
      c.xy += vec2(-dir.y, dir.x) * aSE.x * uW * (1.0 - s.g * 0.35) / uRes * c.w;
      vS = s.gba; vDist = c.w;
      gl_Position = c;
    }`;
  const FS_LINE = `
    uniform vec3 uInk;
    ${FINISH}
    varying vec3 vS; varying float vDist;
    void main() { gl_FragColor = vec4(finish(uInk, vec3(vS.x, 0.0, 0.0), vDist), 0.92 - vS.x * 0.45); }`;

  // 海：岸に近いほど浅い色、岸には白い波打ちぎわ、沖にまばらな波の印
  const VS_SEA = `
    varying vec3 vW; varying float vDist;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      vec4 mv = viewMatrix * w;
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const FS_SEA = `
    uniform sampler2D uMask; uniform vec4 uBox; uniform vec3 uSea, uShallow, uFoam; uniform float uTime;
    ${FINISH}
    varying vec3 vW; varying float vDist;
    float land(vec2 p) { return texture2D(uMask, vec2((p.x - uBox.x) / uBox.z, 1.0 - (p.y - uBox.y) / uBox.w)).r; }
    void main() {
      vec2 p = vW.xz;
      // 波の印はゆっくり東へ漂い、印ごとに現れては消える（本人 2026-10-29「海は波が立ったり寄せたりするように動きが少しほしい」）
      vec2 q = p / 28.0 + vec2(uTime * 0.006, 0.0), id = floor(q), f = fract(q) - 0.5;
      float px = length(fwidth(q));
      float a = 0.0;
      for (int i = 0; i < 8; i++) {
        float t = float(i) * 0.7854;
        vec2 o = vec2(cos(t), sin(t));
        a += land(p + o * 10.0) + 0.6 * land(p + o * 24.0);
      }
      a /= 12.8;
      // 岸の白波：見る幅を時とともに広げ縮めて、寄せては返す
      float rr = 3.5 + 1.6 * (0.5 + 0.5 * sin(uTime * 0.9 + (p.x + p.y) * 0.05));
      float near = max(max(land(p + vec2(rr, 0.0)), land(p - vec2(rr, 0.0))), max(land(p + vec2(0.0, rr)), land(p - vec2(0.0, rr))));
      vec2 uv = vec2((p.x - uBox.x) / uBox.z, 1.0 - (p.y - uBox.y) / uBox.w);
      float wide = textureLod(uMask, uv, 6.0).r;
      vec3 c = mix(uSea * vec3(0.80, 0.86, 0.92), uSea, smoothstep(0.0, 0.25, wide));
      c = mix(c, uShallow, smoothstep(0.02, 0.45, a));
      vec2 g = f - (vec2(hash2(id), hash2(id + 5.3)) - 0.5) * 0.4;
      float arc = abs(length(g - vec2(0.0, 0.12)) - 0.16);
      float on = (1.0 - smoothstep(0.0, px * 1.2 + 0.01, arc - 0.012)) * step(g.y, 0.08) * step(hash2(id + 2.1), 0.35)
        * (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.7 + hash2(id + 9.7) * 6.283)));
      c = mix(c, uFoam, on * 0.55 * (1.0 - smoothstep(0.1, 0.4, a)) * (1.0 - smoothstep(0.05, 0.11, px)));
      c = mix(c, uFoam, smoothstep(0.25, 0.6, near) * 0.75);
      gl_FragColor = vec4(finish(c, vec3(0.0), vDist), 1.0);
    }`;

  // 押した県を当てる：県の番号を色にして、指の下の1点だけ描く
  const FS_PICK = `
    varying vec3 vS; varying float vId;
    void main() { gl_FragColor = vec4((vId + 1.0) / 255.0, 0.0, 0.0, 1.0); }`;
  const VS_PICK = `${STATE}
    attribute float aId;
    varying vec3 vS; varying float vId;
    void main() {
      vec4 s = stateOf(aId);
      vec3 p = position; p.y += s.r;
      vS = s.gba; vId = aId;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;

  const mat = (vs, fs, o = {}) => new T.ShaderMaterial(Object.assign({ uniforms: U, vertexShader: vs, fragmentShader: fs }, o));

  // ---------------------------------------------------------------- 組み立て
  const cv = $('#gl');
  // 墨の線を引く時は、4サンプルの紙の上でなめらかにするので、画面そのもののなめらかさ（MSAA）は要らない（二重にすると重い）
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: /[?&]ink=0/.test(location.search), alpha: true });
  // 描く道具を失った時（スマホで別のアプリへ移った時など）：three が受けて、戻れば絵は元どおり（触る.py で確かめた）。
  // 画面を見ている間に4秒たっても戻らない時だけ、読み直しを案内する
  let lostT = 0;
  cv.addEventListener('webglcontextlost', () => {
    let n = 0;
    lostT = setInterval(() => {
      if (document.hidden || ++n < 4) return;
      clearInterval(lostT);
      msg('地図を描き直せませんでした。ここを押すと読み直します。');
      $('#msg').onclick = () => location.reload();
    }, 1000);
  });
  cv.addEventListener('webglcontextrestored', () => { clearInterval(lostT); $('#msg').style.display = 'none'; $('#msg').onclick = null; });
  renderer.setClearColor(0x000000, 0);
  renderer.debug.onShaderError = (gl, prog, vs, fs) => {
    console.error(gl.getShaderInfoLog(vs) || '', gl.getShaderInfoLog(fs) || '', gl.getProgramInfoLog(prog) || '');
    msg('地図の絵の具（シェーダー）の用意に失敗しました。別のブラウザ（Chrome・Edge）で開いてください。');
  };
  const scene = new T.Scene(), pickScene = new T.Scene(), maskScene = new T.Scene();
  const nat = new T.Group();                     // 全国の地図（県の中に入る時は、まるごと隠す）
  scene.add(nat);
  const camera = new T.PerspectiveCamera(28, 1, 10, 20000);
  const stData = new Float32Array(NS * 4);
  const stTex = new T.DataTexture(stData, NS, 1, T.RGBAFormat, T.FloatType);
  stTex.magFilter = stTex.minFilter = T.NearestFilter;
  stTex.needsUpdate = true;
  U.uState.value = stTex;

  const M = {};
  let G;
  let free = null;                               // 旅.js が自前でカメラを動かす間の、毎コマの関数（null＝いつもの、見る点のまわりを回る作り）
  const lift = new Float32Array(NS), grey = new Float32Array(NS), glow = new Float32Array(NS);
  const hl = new Float32Array(NS), hlT = new Float32Array(NS);   // 光らせる県（品目の産地など）。hlT＝目標
  let hlOn = false;
  const ON = {};
  // 'ready' は1回きり。後から読まれた部品（とき.js など）が知らせの後に受け口を置いても届くよう、済んだ印を残して後から呼ぶ
  // （2026-11-06：紹介.js が大きくなり、最後の とき.js が読まれる前に地図の準備が終わって、季節と時刻が今に合わなかった）
  const DONE = new Set();
  const emit = (e, a) => { if (e === 'ready' || e === 'shown') DONE.add(e); (ON[e] || []).forEach((f) => f(a)); };
  const liftV = new Float32Array(NS), greyV = new Float32Array(NS);
  // 浮いた県のぷかぷか（本人 2026-11-02「少し上下にぷかぷか」）：せり上がりが済んでから、上下の幅を0からばねで広げる（動き出しは速さ0）。
  // 幅は画面で約 BOB_PX 画素（寄っても引いても同じ見え方）。lift は浮かせる高さ（せり上がりの検査・しきい値）、描く高さは lift＋bobY
  const bobA = new Float32Array(NS), bobAV = new Float32Array(NS), bobY = new Float32Array(NS), BOB_PX = 8, BOB_T = 5.2;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const liftY = (k) => lift[k] + bobY[k];

  function assemble() {
    M.top = mat(VS_SOLID, FS_TOP);
    M.wall = mat(VS_SOLID, FS_WALL);
    M.floor = mat(VS_FLOOR, FS_FLOOR);
    M.line = mat(VS_LINE, FS_LINE, { transparent: true, depthWrite: false, side: T.DoubleSide });
    M.sea = mat(VS_SEA, FS_SEA);
    M.pick = mat(VS_PICK, FS_PICK, { side: T.DoubleSide });
    const add = (sc, g, m, ro = 0) => { const o = new T.Mesh(g, m); o.frustumCulled = false; o.renderOrder = ro; sc.add(o); return o; };
    const sea = add(nat, new T.PlaneGeometry(12000, 12000), M.sea, 0);
    sea.rotation.x = -Math.PI / 2; sea.position.set(-200, SEA_Y, 200);
    add(nat, G.top, M.top, 1);
    add(nat, G.wall, M.wall, 1);
    add(nat, G.line, M.line, 5);
    add(pickScene, G.top, M.pick);
    add(pickScene, G.wall, M.pick);

    // 陸の形を真上から1枚に焼く（海の色の浅い・深い・波打ちぎわに使う）
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of P) { x0 = Math.min(x0, p.bbox[0]); z0 = Math.min(z0, p.bbox[1]); x1 = Math.max(x1, p.bbox[2]); z1 = Math.max(z1, p.bbox[3]); }
    x0 -= 60; z0 -= 60; x1 += 60; z1 += 60;
    const rt = new T.WebGLRenderTarget(2048, 2048, { minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, generateMipmaps: true, depthBuffer: false });
    const oc = new T.OrthographicCamera(-(x1 - x0) / 2, (x1 - x0) / 2, (z1 - z0) / 2, -(z1 - z0) / 2, 1, 1000);
    oc.position.set((x0 + x1) / 2, 500, (z0 + z1) / 2); oc.up.set(0, 0, -1); oc.lookAt((x0 + x1) / 2, 0, (z0 + z1) / 2);
    add(maskScene, G.top, new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide }));
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(maskScene, oc);
    renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0);
    U.uMask.value = rt.texture; U.uBox.value.set(x0, z0, x1 - x0, z1 - z0);
  }

  // 浮かせた県の底・穴の底・底の縁の線。押されるまで作らない
  function extras(p) {
    if (p.ex) return p.ex;
    const n = p.nv, bp = new Float32Array(n * 3), bn = new Float32Array(n * 3), bt = new Float32Array(n), bi = new Float32Array(n), fp = new Float32Array(n * 3);
    for (let j = 0; j < n; j++) {
      const o = (p.v0 + j) * 3;
      bp.set([POS[o], -DEPTH, POS[o + 2]], j * 3); bn[j * 3 + 1] = -1; bt[j] = POS[o + 1]; bi[j] = p.k;
      fp.set([POS[o], 0.4, POS[o + 2]], j * 3);
    }
    const up = Uint32Array.from(p.I), down = new Uint32Array(up.length);
    for (let j = 0; j < up.length; j += 3) { down[j] = up[j]; down[j + 1] = up[j + 2]; down[j + 2] = up[j + 1]; }
    const s0 = p.s0 * 12, s1 = (p.s0 + p.ns) * 12;
    const la = G.lA.slice(s0, s1), lb = G.lB.slice(s0, s1);
    for (let j = 1; j < la.length; j += 3) { la[j] = -DEPTH; lb[j] = -DEPTH; }
    const li = G.lIdx.slice(p.s0 * 6, (p.s0 + p.ns) * 6).map((x) => x - p.s0 * 4);
    const g = new T.Group();
    const add = (geom, m, ro) => { const o = new T.Mesh(geom, m); o.frustumCulled = false; o.renderOrder = ro; g.add(o); };
    add(geo([['position', bp, 3], ['normal', bn, 3], ['aTop', bt, 1], ['aId', bi, 1]], down), M.wall, 1);
    add(geo([['position', fp, 3], ['aId', bi, 1]], up), M.floor, 1);
    add(geo([['position', la, 3], ['aB', lb, 3], ['aSE', G.lSE.slice(p.s0 * 8, (p.s0 + p.ns) * 8), 2],
      ['aId', G.lId.slice(p.s0 * 4, (p.s0 + p.ns) * 4), 1]], li), M.line, 5);
    g.visible = false;
    nat.add(g);
    return (p.ex = g);
  }

  // ---------------------------------------------------------------- 季節
  let season = 1;
  const want = {};
  function setSeason(i, now) {
    if (!(i >= 0 && i <= 3)) return;
    season = i;
    want.uPlain = PAL.plain[i]; want.uHill = PAL.hill[i]; want.uMount = PAL.mount[i]; want.uHigh = PAL.high[i]; want.uBare = PAL.bare[i];
    want.uSea = PAL.sea[i]; want.uShallow = PAL.shallow[i];
    want.uCab = PAL.cab[i]; want.uRice = PAL.rice[i]; want.uWheat = PAL.wheat[i]; want.uVeg = PAL.veg[i];
    for (const k in want) want[k] = new T.Color(want[k]);
    U.uSeason.value = i;
    U.uSnowLine.value = SNOW[i]; U.uSnowN.value = SNOW_N[i];
    if (now) for (const k in want) U[k].value.copy(want[k]);
    document.documentElement.style.setProperty('--sky', PAL.sky[i]);
    // 島の拡大図は、手の空いた時に描き直す（その場で2枚描くと CPU4倍で28ms 止まり、遊覧で季節を変えるたびに引っかかった）。
    // 描き直す前に吹き出しを開いた時は、開く所で描く（placeIsles）
    (window.requestIdleCallback || setTimeout)(() => { for (const I of ISLES) if (I.drawn !== season) { drawIsle(I); I.drawn = season; } });
    $('#season-name').textContent = SEASON[i] + (isNightNow ? 'の夜' : 'の巻');
    document.querySelectorAll('#seasons button').forEach((b) => b.classList.toggle('on', +b.dataset.s === i));
    emit('season', i);                                  // 音楽.js が季節の曲へ替える
  }

  // 夜（本人 2026-10-27「夜は暗い日本列島に街の灯りだけが灯るような仕掛け」）：地図を月夜の青みに沈め、町の濃さに比例した灯りを灯す。
  // 霞も紙の色から夜の紺へ。季節と組み合わせて「冬の夜」なども。暗さは毎コマなめらかに寄せる
  // 時刻（本人 2026-10-29「昼夜だけでなく時間の流れ」「太陽や月あかりの位置も」）：日付と時刻から太陽と月の高さ・方角を計算し、
  // 夜の暗さ・朝夕の暖かい色・光の向き・霞と空の色を決める。太陽は北緯36度での目安の式（赤緯と時角）。月は満ち欠け（約29.53日）から、
  // 太陽より「月齢×24時間」遅れて同じ道を通るとみなす（地図の飾りなので、天文の正確さは求めない）
  let nightT = 0, duskT = 0, tod = 12, todDay = new Date(), isNightNow = false;
  const sun = { e: 1, A: Math.PI }, moon = { e: -1, A: 0, phase: 0 };
  const DAY_FOG = new T.Color('#f1e6cb'), DUSK_FOG = new T.Color('#ecbf98'), NIGHT_FOG = new T.Color('#16223f');
  const RAD = Math.PI / 180, LAT = 36 * RAD, NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  function sunPath(day, h) {
    const n = Math.floor((day - new Date(day.getFullYear(), 0, 0)) / 864e5);
    const dec = 23.44 * RAD * Math.sin(2 * Math.PI * (284 + n) / 365), H = (h - 12) * 15 * RAD;
    const e = Math.asin(Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(H));
    const A = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(dec) * Math.cos(LAT)) + Math.PI;     // 北から時計回り
    return { e, A };
  }
  function setTime(h, day = todDay) {
    tod = ((h % 24) + 24) % 24; todDay = day;
    Object.assign(sun, sunPath(day, tod));
    moon.phase = (((day - NEW_MOON) / 864e5 / 29.530588) % 1 + 1) % 1;
    Object.assign(moon, sunPath(day, tod - moon.phase * 24));
    const e = sun.e / RAD;
    nightT = Math.max(0, Math.min(1, (4 - e) / 12));                 // 太陽が地平線の4°上〜8°下で暗くなる
    duskT = Math.exp(-(((e - 1) / 7) ** 2));
    const n = nightT > 0.5;
    if (n !== isNightNow) {
      isNightNow = n;
      document.body.classList.toggle('night', n);
      $('#night').classList.toggle('on', n);
      $('#season-name').textContent = SEASON[season] + (n ? 'の夜' : 'の巻');
      emit('night', n);
    }
    emit('time', tod);
  }
  function setNight(on) { setTime(on ? 21 : 12); }

  const lsrc = new T.Vector3();
  function fogColor() {
    U.uFogCol.value.lerpColors(DAY_FOG, DUSK_FOG, U.uDusk.value * (1 - U.uNight.value)).lerp(NIGHT_FOG, U.uNight.value);
  }
  // 空：朝夕の色（#sky の上の層）と、太陽と月の丸。見ている向き（cam.th＝北から時計回りの見る方角）の前、左右70°の中だけ出す。
  // 書きかえは0.2秒ごと（毎コマ空の絵を組み直さない）
  let skyAt = 0;
  const sunEl = $('#sun'), moonEl = $('#moon'), rootS = document.documentElement.style;
  function sky(dt) {
    if ((skyAt += dt) < 0.2) return;
    skyAt = 0;
    rootS.setProperty('--dusk', (U.uDusk.value * (1 - U.uNight.value)).toFixed(2));
    for (const [el, b, on] of [[sunEl, sun, !isNightNow], [moonEl, moon, isNightNow && moon.phase > 0.04 && moon.phase < 0.96]]) {
      const rel = Math.atan2(Math.sin(b.A - cam.th), Math.cos(b.A - cam.th)) / RAD, e = b.e / RAD;
      const show = on && !free && !inside && Math.abs(rel) < 70 && e > -3;
      el.style.display = show ? 'block' : 'none';
      if (show) el.style.transform = `translate(${(50 + rel / 70 * 46).toFixed(1)}vw, ${(24 - Math.min(e, 60) / 60 * 20).toFixed(1)}vh)`;
    }
    // 月の満ち欠け：影の丸を横にずらす（新月で重なり、満月で外れる。右から満ちる）
    const k = moon.phase < 0.5 ? 1 - moon.phase * 2 : (moon.phase - 0.5) * 2;
    moonEl.style.setProperty('--ph', ((moon.phase < 0.5 ? -1 : 1) * (1 - k) * 100).toFixed(0) + '%');
  }
  // ---------------------------------------------------------------- カメラ（自前）
  const cam = Object.assign({}, HOME), goal = Object.assign({}, HOME), camV = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // はね返らない（臨界減衰の）ばねで寄せる。動き出しは速さ0から、途中で速く、終わりはふわっと止まる。
  // 途中で行き先が変わっても速さがつながる。1コマの長さによらず同じ動き（式で解いた値）
  function spring(s, v, key, target, w, dt) {
    const e = s[key] - target, v0 = v[key] || 0, a = v0 + w * e, x = Math.exp(-w * dt);
    s[key] = target + (e + a * dt) * x;
    v[key] = (v0 - w * a * dt) * x;
  }
  function keepIn(o) {
    o.ph = clamp(o.ph, PH[0], PH[1]);
    if (inside) { const b = inside.box; o.D = clamp(o.D, inside.D[0], inside.D[1]); o.x = clamp(o.x, b[0], b[2]); o.z = clamp(o.z, b[1], b[3]); clearView(o); return; }
    o.D = clamp(o.D, DR[0], DR[1]);
    o.x = clamp(o.x, -1400, 950); o.z = clamp(o.z, -1200, 1450);
  }
  // 県の中では山を5倍に強めるので、寄ると山の中にカメラが入る。カメラと、見る所までの途中が地面より上になるまで、見下ろす角を上げる
  // t＝見る所からカメラまでの何割の所か。カメラのまわりは 2km、見る所の近くは 0.6km あける
  const SIGHT = [[1, 2], [0.8, 1.5], [0.6, 1.5], [0.45, 1.2], [0.3, 0.8], [0.2, 0.6]];
  function clearView(o, step = 0.02) {
    if (!inside || !inside.heightAt) return o;
    for (let n = 0; n < 60; n++) {
      const cp = Math.cos(o.ph), sp = Math.sin(o.ph);
      let ok = true;
      for (const [t, m] of SIGHT) {
        const x = o.x - Math.sin(o.th) * cp * o.D * t, z = o.z + Math.cos(o.th) * cp * o.D * t, y = o.y + sp * o.D * t;
        if (y < inside.heightAt(x, z) + m) { ok = false; break; }
      }
      if (ok || o.ph >= PH[1]) break;
      o.ph = Math.min(PH[1], o.ph + step);
    }
    return o;
  }
  function place() {
    const cp = Math.cos(cam.ph), sp = Math.sin(cam.ph);
    camera.position.set(cam.x - Math.sin(cam.th) * cp * cam.D, cam.y + sp * cam.D, cam.z + Math.cos(cam.th) * cp * cam.D);
    camera.lookAt(cam.x, cam.y, cam.z);
    // 空を飛ぶ間は、見る点までの距離ではなく、決まった見通しで（低く飛ぶと距離が短く、遠くが切れて霞に沈んだ）
    camera.near = free ? 0.02 : cam.D * 0.05; camera.far = free ? 160 : cam.D * 8;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    // 光はいつも画面の左上の奥から（どちらから見ても、山の起伏が同じように読める）
    const fx = Math.sin(cam.th), fz = -Math.cos(cam.th), rx = Math.cos(cam.th), rz = Math.sin(cam.th);
    U.uLdir.value.set(-rx * 0.62 + fx * 0.38, 0.69, -rz * 0.62 + fz * 0.38).normalize();
    // 太陽（夜は月）の向きへ3割寄せる。地平線より下なら寄せない（どちらから見ても起伏が読める土台は残す）
    const src = sun.e > 0 ? sun : moon.e > 0 ? moon : null;
    if (src) {
      const ce = Math.cos(src.e);
      lsrc.set(Math.sin(src.A) * ce, Math.max(Math.sin(src.e), 0.25), -Math.cos(src.A) * ce).normalize();
      U.uLdir.value.lerp(lsrc, 0.3).normalize();
    }
    // 地面すれすれ（uNearK）では、2km から先を霞ませる（空気の奥行き。1軒ずつの家の輪の外との段差もなじむ）
    U.uFogNear.value = free ? 24 - 22 * U.uNearK.value : cam.D * 0.9; U.uFogFar.value = free ? 75 - 45 * U.uNearK.value : cam.D * 2.2;
    $('#needle').setAttribute('transform', `rotate(${-cam.th * 180 / Math.PI})`);
  }
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function ground(cx, cy, y = 0) {
    ndc.set(cx / VW * 2 - 1, -(cy / VH) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction, t = (y - o.y) / d.y;
    return t > 0 ? new T.Vector3(o.x + d.x * t, y, o.z + d.z * t) : null;
  }
  const near = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));

  // 全体：47都道府県がいまの画面にちょうど収まる距離と位置を探す（会場の画面の大きさは選べないので）。
  // 陸の点で数える（県の外枠の角で数えると、沖縄の枠の隅の海まで入れて引きすぎた）。
  // 東京は小笠原まで入れると南へ1000km引くので、本土から 380km の範囲で数える。1つの県に寄る時（near）は、その県の寄る範囲（p.fr）で
  function landPts(ks, near) {
    const pts = [];
    for (const k of ks) {
      const p = P[k], r = p.name === '東京' ? 380 : Infinity;
      for (let j = 0; j < p.nv; j += 6) {
        const o = (p.v0 + j) * 3, x = POS[o], z = POS[o + 2];
        if (near ? p.inFr(x, z) : (x - p.ax) ** 2 + (z - p.az) ** 2 < r * r) pts.push([x, z]);
      }
    }
    return pts;
  }
  let fitPts = null;
  // スマホの並び（幅700未満）では札の窓・産地の札が画面の下から出る。その時に地図を収める範囲（上の題と検索、下の札を避ける）。
  // 背の低い横向き（高さ520以下）はスマホでも除く：下から出す札と2段の下の並びで地図が 110px ほどしか残らず、札の窓が「〇〇の中へ」にかかった
  // （iPhone SE を横に 667×375・2026-11-07）。index.html の背の低い画面の決まりで、札の窓を右に出す。入口.js・案内.js・県の中.js も PHONE で見る
  const PHONE = () => VW < 700 && !(VH <= 520 && VW > VH);
  const SHEET = () => PHONE() ? [-0.9, 0.9, 0.1, 0.66] : undefined;
  // area＝地図を収める画面の範囲（-1〜1 の [左, 右, 下, 上]）。いつもは上に題と霞、下に季節の札のぶん空ける。入口はボタンの札を避ける
  function fitAll(th, ph, pts, area = [-0.95, 0.95, -0.665, 0.785]) {
    if (!pts) pts = fitPts = fitPts || landPts(P.map((p) => p.k));
    const keep = Object.assign({}, cam), v = new T.Vector3();
    Object.assign(cam, { th, ph, y: 0, x: HOME.x, z: HOME.z, D: HOME.D });
    for (let it = 0; it < 10; it++) {
      place();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [x, z, y] of pts) {
        v.set(x, y || 0, z).project(camera);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      const [ax0, ax1, ay0, ay1] = area;
      const g = ground(((x0 + x1) / 2 - (ax0 + ax1) / 2 + 1) / 2 * VW, (1 - ((y0 + y1) / 2 - (ay0 + ay1) / 2)) / 2 * VH);
      if (g) { cam.x = g.x; cam.z = g.z; }
      cam.D = clamp(cam.D * Math.max((x1 - x0) / (ax1 - ax0), (y1 - y0) / (ay1 - ay0)), DR[0], DR[1]);
    }
    const out = { th, ph, y: 0, x: cam.x, z: cam.z, D: cam.D };
    Object.assign(cam, keep); place();
    return out;
  }

  // ---------------------------------------------------------------- 押す・乗せる・選ぶ
  const pickRT = new T.WebGLRenderTarget(1, 1);
  const px = new Uint8Array(4);
  function pick(x, y) {
    camera.setViewOffset(VW, VH, x, y, 1, 1);
    renderer.setRenderTarget(pickRT); renderer.clear(); renderer.render(pickScene, camera);
    renderer.setRenderTarget(null); camera.clearViewOffset();
    renderer.readRenderTargetPixels(pickRT, 0, 0, 1, 1, px);
    return px[0] - 1;
  }

  let sel = -1, hov = -1, saved = null, tourK = -1;   // tourK＝全国の遊覧で浮かせている県（札の窓は開かない）
  function select(k, how) {
    if (k === sel) return;
    if (sel < 0) saved = Object.assign({}, goal);
    sel = k;
    const p = P[k], f = p.frame;
    extras(p);
    const size = Math.max(f[2] - f[0], f[3] - f[1]);
    if (SHEET()) {
      // スマホ：札の窓は下から出るので、浮かせた県は上の空いた所に収める（縦長の画面では、幅で決めた距離だと県が左右にはみ出した）
      Object.assign(goal, fitAll(goal.th, 0.6, landPts([k], true).map(([x, z]) => [x, z, LIFT]), SHEET()));
    } else {
      // 右に札の窓が開くので、浮かせた県は左の空いた所の真ん中に（見る向きの右へ、注視点を少しずらす）
      const D = clamp(size * 1.9 + 240, 420, 2200);
      Object.assign(goal, { x: (f[0] + f[2]) / 2 + Math.cos(goal.th) * D * 0.1, z: (f[1] + f[3]) / 2 + Math.sin(goal.th) * D * 0.1, y: LIFT * 0.55, D, ph: 0.6 });
    }
    if (how) writeHist({ sel: k }, how);
    $('#c-name').textContent = FULL(p.name);
    emit('select', k);
    $('#card').classList.add('open');
    $('#tip').style.display = 'none';
  }
  function deselect() {
    for (const I of ISLES) I.pinned = false;
    if (sel < 0) return;
    sel = -1;
    if (saved) Object.assign(goal, saved);
    $('#card').classList.remove('open');
    emit('deselect');
  }
  // もどる：すぐ下ろし、履歴も1つ戻す。自分で戻した履歴の知らせは無視する
  // （知らせは遅れて届くので、その間に押した次の県を下ろしてしまわないように）
  let popping = false;
  function back() {
    const st = history.state, g = st && st.layer ? 1 : 0;      // 上に窓の段があれば、それごと戻る
    if (inside) {
      leave();
      if (st && st.inside) { popping = true; layered = false; history.go(-1 - g); }
      return;
    }
    deselect();
    if (st && st.sel != null) { popping = true; layered = false; history.go(-1 - g); }
  }

  // ---------------------------------------------------------------- 端末の「戻る」で窓を閉じる（本人のスマホ 2026-11-09。前は窓が開いたまま県を下ろす・ページを出た）
  // 窓・遊覧・空を飛ぶ・入り直したはじめの画面が開いている間だけ、履歴のいちばん上に「窓の段」を1つ積む。
  // 「戻る」でその段を戻ると、Esc と同じ手順で1つ閉じ（地図は動かさない）、まだ開いていればまた積む。ボタンで閉じ切った時は、積んだ段を自分で戻す
  const WINS = ['body.touring', 'body.flying', 'body.again', '#deai.open', '#deai .pic', '#quiz.open', '#mame-book.open', '#mame-card.open', '#eki-card.open',
    '#credits.open', '#cal.open', '#legend.open', '#natdata.open', '#fuda.open', '#hito.open', '#bar .dock.open', '#en-card.open', '#mame-pic.open', '#sugo.open'];
  const layerSig = () => WINS.filter((q) => document.querySelector(q)).join();
  let layered = false, stuck = '', under = '';
  const where = (o) => (o && o.sel != null ? o.sel : -1) + '|' + (o && o.inside ? o.inside : '');    // 段の中身（浮かせた県・入った県）
  // 履歴に書く。窓の段が上にある時は、その下に書いてから窓の段を積み直す（窓の段は、いつもいちばん上）
  function writeHist(st, how) {
    if (history.state && history.state.layer) { history.replaceState(st, ''); history.pushState(Object.assign({}, st, { layer: 1 }), ''); under = where(st); }
    else if (how === 'push') history.pushState(st, '');
    else history.replaceState(st, '');
  }
  function layerSync() {
    if (popping) return;                                       // 自分で戻した知らせを待つ間は積まない（知らせは遅れて届く）
    const sig = layerSig();
    if (sig !== stuck) stuck = '';
    if (sig && !layered && !stuck) { under = where(history.state); history.pushState(Object.assign({}, history.state, { layer: 1 }), ''); layered = true; }
    else if (!sig && layered) { layered = false; if (history.state && history.state.layer) { popping = true; history.back(); } }
  }
  setInterval(layerSync, 300);
  for (const t of ['click', 'keyup']) addEventListener(t, () => setTimeout(layerSync, 0), true);

  addEventListener('popstate', (e) => {
    if (popping) { popping = false; return; }
    let s = e.state;
    if (layered && !(s && s.layer)) {
      layered = false;
      const sig = layerSig(), k = new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true });
      k.fromBack = true;
      document.body.dispatchEvent(k);
      // 何も閉じなかった時（閉じるのに時間のかかる物も）は、同じ物が開いている間は積み直さない（「戻る」で閉じこめない）
      if (layerSig() === sig) stuck = sig;
      // 2段以上をまとめて戻った時（履歴の一覧から選んだ時）は、窓を閉じた上で、地図も着いた段へ戻す（下へ続ける）
      if (where(s) === under) { layerSync(); return; }
    }
    if (s && s.layer) { s = Object.assign({}, s); delete s.layer; history.replaceState(s, ''); }    // 進むで窓の段へ来た時は、ただの段として
    if (inside && !(s && s.inside)) { leave(() => { if (s && s.sel != null) select(s.sel, null); else deselect(); }); return; }
    if (!inside && s && s.inside && lastWorld) { if (s.sel !== sel) select(s.sel, null); enter(lastWorld, null); return; }
    if (s && s.sel != null) select(s.sel, null); else deselect();
  });

  // ---------------------------------------------------------------- 県の中（細かい鳥瞰図）へ入る・出る
  // 全国の地図を霞（紙の色の幕）で隠し、その間に県の中の地図へ差しかえる。中では県を浮かせない（断面は全国の見せ方）
  let inside = null, lastWorld = null, outView = null, veilT = 0, veilAt = 0;
  // 幕：下ろし切るまで 0.34 秒。下ろし切った後に呼ぶ（もう下りていれば、すぐ）
  function veil(on, then, text) {
    const v = $('#veil');
    if (on && !v.classList.contains('on')) veilAt = performance.now();
    v.classList.toggle('on', on);
    v.textContent = on ? (text || '') : '';
    clearTimeout(veilT);
    if (then) veilT = setTimeout(then, on ? Math.max(0, 360 - (performance.now() - veilAt)) : 0);
  }
  function enter(w, how = 'push') {
    if (inside || sel < 0) return;
    lastWorld = w; outView = Object.assign({}, goal);
    if (how === 'push') writeHist({ sel, inside: w.name }, 'push');
    veil(true, () => {
      inside = w;
      nat.visible = false; w.group.visible = true;
      Object.assign(goal, w.home); keepIn(goal); Object.assign(cam, goal); for (const k in camV) camV[k] = 0;
      lift.fill(0); liftV.fill(0); grey.fill(0); greyV.fill(0);
      for (const I of ISLES) I.pinned = false;
      place(); setHover(-1);
      document.body.classList.add('inside');
      if (w.warpIn) w.warpIn();                        // 寄せた島の点を寄せる（県の中.js。知らせを受けて置き直す側が、寄せた後の位置を使う）
      emit('world', w);
      // 入った後の画面の並び（スマホは札の窓をたたむ）で、県が空いた所に収まる眺めを測り直す
      if (w.fitHome) { w.fitHome(); Object.assign(goal, w.home); keepIn(goal); Object.assign(cam, goal); place(); }
      veil(false);
    });
  }
  function leave(then) {
    if (!inside) { if (then) then(); return; }
    const w = inside;
    if (history.state && history.state.inside) writeHist({ sel }, 'replace');
    veil(true, () => {
      inside = null;
      nat.visible = true; w.group.visible = false;
      if (outView) { Object.assign(goal, outView); Object.assign(cam, outView); for (const k in camV) camV[k] = 0; }
      place();
      document.body.classList.remove('inside');
      if (w.warpOut) w.warpOut();
      emit('world', null);
      if (then) then();
      veil(false);
    });
  }
  if (history.state && (history.state.sel != null || history.state.layer)) history.replaceState(null, '');

  // 地図を押した時、開いている窓（豆知識・駅の案内）があれば、しまうだけにする（本人 2026-10-29「もう一度クリックやタップで、窓をしまった方がいい。いちいち閉じるは大変」）
  const dismissers = [];
  function click(x, y) {
    if (document.body.classList.contains('ui-wait')) return;    // 札や検索をまだ読んでいる間は、県を押しても何も開けない（後から読む.js）
    if (dismissers.map((f) => f()).some(Boolean)) return;
    if (inside) { if (inside.click) inside.click(x, y); return; }
    for (const I of ISLES) I.pinned = false;
    const k = pick(x, y);
    if (k < 0 || k >= P.length) { if (sel >= 0) back(); return; }
    if (k === sel) back();
    else select(k, sel < 0 ? 'push' : 'replace');
  }

  // ---------------------------------------------------------------- 指とマウス
  const ptrs = new Map();
  let drag = null, hoverAt = null;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  // 空を飛ぶ間（free）は、地図を回す・寄せる・押して選ぶ操作を止める（飛ぶ操作は 旅.js が受ける）
  // 地図を押したら、字の選択を消して、選択を始めない（ドラッグで札や題の字が青く反転し、Esc でも消えなかった。2026-10-30）
  const unselect = () => { const s = getSelection && getSelection(); if (s && s.rangeCount) s.removeAllRanges(); };
  addEventListener('keydown', (e) => { if (e.code === 'Escape') unselect(); }, true);
  // 字を選べるのは読む窓と入力だけ（index.html の user-select と同じ並び）。地図の印をトリプルクリックすると、ブラウザが右の札の「群馬県」まで選択を広げた
  const READ = '#card, #tour, #mame-card, #eki-card, #en-card, #quiz, input, textarea';
  const inRead = (t) => { t = t && t.nodeType === 3 ? t.parentElement : t; return !!(t && t.closest && t.closest(READ)); };
  document.addEventListener('selectstart', (e) => { if (!inRead(e.target)) e.preventDefault(); });
  document.addEventListener('mousedown', (e) => { if (e.detail > 1 && !inRead(e.target)) e.preventDefault(); });
  // 指（タッチ）は、地図に重ねた札・印（地名・名物の印・豆知識の豆・島の札）の上から始めても、地図を動かす操作に数える。
  // 前は絵（canvas）の上で始めた指だけを数えたので、札と印の多い県の中では、2本指で広げても寄らなかった（2026-11-08 本人「指でも拡大はできなかった」）。
  // 札を押すだけ（動かさない）なら札の働きのまま。動かした時は、離した後に札へ届くクリックを捨てる
  const LAYERS = '#labels, #pins, #inlabels, #mame, #isles, #ranks';
  let eatAt = -1e9;
  // 指の操作は地図の決まりに合わせる（本人 2026-11-08「近づいて拡大するための移動キーがなかった」）：1本指でなぞる＝動かす、
  // 2本指で広げる・狭める＝寄る・引く、ひねる＝回す、2本指をそろえて上下＝傾ける。マウスは今のまま（左で回す・右か Shift で動かす・ホイールで寄る）
  const down = (e) => {
    unselect();
    if (e.pointerType === 'mouse') { e.preventDefault(); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); }
    if (free) return;
    if (e.target === cv) cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) {
      drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, cv: e.target === cv,
        mode: e.pointerType !== 'mouse' || e.button === 2 || e.button === 1 || e.shiftKey ? 'pan' : 'rot' };
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y), an = Math.atan2(b.y - a.y, b.x - a.x);
      drag = { mode: 'pinch', kind: '', moved: true, d, mx, my, an, pa: { ...a }, pb: { ...b }, d0: d, mx0: mx, my0: my, an0: an, pa0: { ...a }, pb0: { ...b } };
    }
  };
  cv.addEventListener('pointerdown', down);
  addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && e.target !== cv && e.target.closest && e.target.closest(LAYERS)) down(e); }, true);
  const turn = (an) => { let d = an; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  addEventListener('pointermove', (e) => {
    if (free) return;
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag) { if (e.target === cv) hoverAt = { x: e.clientX, y: e.clientY, fresh: true }; return; }
    if (!ptrs.has(e.pointerId)) return;
    if (drag.mode === 'pinch') {
      if (ptrs.size < 2) return;
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, an = Math.atan2(b.y - a.y, b.x - a.x);
      // 2本指の動きは、はじめに少し動いた所で「傾ける」か「寄る・回す・動かす」かを決め、離すまで変えない
      if (!drag.kind) {
        const sx = mx - drag.mx0, sy = my - drag.my0, sr = Math.abs(Math.log(d / drag.d0)), sa = Math.abs(turn(an - drag.an0));
        if (Math.hypot(sx, sy) > 14 || sr > 0.08 || sa > 0.12) {
          drag.kind = Math.abs(sy) > 2 * Math.abs(sx) && sr < 0.08 && sa < 0.12 ? 'tilt' : 'zoom';
          Object.assign(drag, { d: drag.d0, mx: drag.mx0, my: drag.my0, an: drag.an0, pa: drag.pa0, pb: drag.pb0 });     // 決めるまでに動いた分も、まとめて効かせる
        }
      }
      if (drag.kind === 'tilt') goal.ph = clamp(goal.ph + (my - drag.my) * 0.004, PH[0], PH[1]);
      else if (drag.kind === 'zoom') {
        zoomAt(mx, my, drag.d / d);
        // ひねった分だけ回す。回す角は地面の上で測る（斜めに見下ろす眺めでは、画面の上の角と地面の上の角が違い、指から地面が遅れた）。
        // 指の真ん中の下の地面が、指の下に残るように回す
        const g = [ground(drag.pa.x, drag.pa.y, cam.y), ground(drag.pb.x, drag.pb.y, cam.y), ground(a.x, a.y, cam.y), ground(b.x, b.y, cam.y)];
        const da = g.every(Boolean) ? turn(Math.atan2(g[3].z - g[2].z, g[3].x - g[2].x) - Math.atan2(g[1].z - g[0].z, g[1].x - g[0].x)) : turn(an - drag.an);
        const p0 = ground(mx, my, cam.y);
        goal.th = cam.th = cam.th - da; camV.th = 0; place();
        const p1 = p0 && ground(mx, my, cam.y);
        if (p1) { cam.x += p0.x - p1.x; cam.z += p0.z - p1.z; keepIn(cam); goal.x = cam.x; goal.z = cam.z; camV.x = camV.z = 0; place(); }
        panBy(drag.mx, drag.my, mx, my);
      }
      Object.assign(drag, { d, mx, my, an, pa: { ...a }, pb: { ...b } });
      return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) { drag.moved = true; cv.classList.add('drag'); $('#tip').style.display = 'none'; }
    if (drag.moved) {
      if (drag.mode === 'rot') { goal.th -= dx * 0.006; goal.ph = clamp(goal.ph + dy * 0.004, PH[0], PH[1]); }
      else panBy(drag.x, drag.y, e.clientX, e.clientY);
    }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (drag && !drag.moved && ptrs.size === 0 && e.type === 'pointerup' && drag.cv) click(e.clientX, e.clientY);
    if (drag && drag.moved) eatAt = performance.now();
    if (ptrs.size === 0) { drag = null; cv.classList.remove('drag'); }
  };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  addEventListener('click', (e) => { if (performance.now() - eatAt < 400 && e.target.closest && e.target.closest(LAYERS)) { e.stopPropagation(); e.preventDefault(); } }, true);
  cv.addEventListener('pointerleave', () => { if (!drag) { hoverAt = null; setHover(-1); } });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); if (free) return; zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  // 寄る・引くのボタン（指で触る端末だけ出す）：見ている所の真ん中を中心に
  $('#zoom-in').addEventListener('click', () => { if (!free) zoomAt(VW / 2, VH * 0.45, 1 / 1.6); });
  $('#zoom-out').addEventListener('click', () => { if (!free) zoomAt(VW / 2, VH * 0.45, 1.6); });

  function panBy(x0, y0, x1, y1) {
    const a = ground(x0, y0, cam.y), b = ground(x1, y1, cam.y);
    if (!a || !b) return;
    cam.x += a.x - b.x; cam.z += a.z - b.z; keepIn(cam);
    goal.x = cam.x; goal.z = cam.z; camV.x = camV.z = 0;
    place();
  }
  function zoomAt(x, y, f) {
    const lim = inside ? inside.D : DR, D = clamp(goal.D * f, lim[0], lim[1]), r = D / goal.D, p = ground(x, y, goal.y);
    if (p) { goal.x = p.x + (goal.x - p.x) * r; goal.z = p.z + (goal.z - p.z) * r; }
    goal.D = D; keepIn(goal);
  }

  function setHover(k) {
    if (k === hov) return;
    hov = k;
    cv.classList.toggle('on', k >= 0);
    const tip = $('#tip');
    if (k < 0 || k === sel) { tip.style.display = 'none'; return; }
    tip.textContent = FULL(P[k].name);
    tip.style.display = 'block';
  }

  addEventListener('keydown', (e) => {
    if (free || (e.target.closest && e.target.closest('input, textarea'))) return;   // 検索の窓に打っている字で、地図を回さない
    if (e.code === 'Escape') { if (!e.fromBack) { for (const I of ISLES) I.pinned = false; back(); } }
    else if (e.code === 'ArrowLeft') goal.th += 0.26;
    else if (e.code === 'ArrowRight') goal.th -= 0.26;
    else if (e.code === 'ArrowUp') goal.ph = clamp(goal.ph + 0.1, PH[0], PH[1]);
    else if (e.code === 'ArrowDown') goal.ph = clamp(goal.ph - 0.1, PH[0], PH[1]);
    else if (/^Digit[1-4]$/.test(e.code)) setSeason(+e.code.slice(5) - 1);
    else if (e.code === 'KeyN') setNight(!isNightNow);
    else if (PAN[e.code]) { held.set(e.code, [performance.now(), e.repeat ? 450 : 800]); panFast = e.shiftKey; e.preventDefault(); }
  });
  // 普段の地図も W・A・S・D で前後左右へ（本人 2026-10-30「移動キーは実装した？」。矢印は今のまま回す・傾ける）。押している間、見る点を
  // 画面の向きに合わせて動かす（1秒で見ている距離の6割ほど・Shift で速く）。離した知らせ（keyup）は届かないことがあるので、
  // くり返しの keydown が 0.45 秒（くり返しが始まる前は 0.8 秒）途切れたら離したとみなす（港町で「離しても止まらない」が出た）
  const PAN = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] }, held = new Map();
  let panFast = false;
  addEventListener('keyup', (e) => { held.delete(e.code); });
  addEventListener('blur', () => held.clear());
  function pan(dt) {
    if (!held.size) return;
    const now = performance.now();
    let f = 0, r = 0;
    for (const [k, [t0, wait]] of held) { if (now - t0 > wait) { held.delete(k); continue; } f += PAN[k][1]; r += PAN[k][0]; }
    if (!f && !r) return;
    const v = goal.D * 0.6 * (panFast ? 2.5 : 1) * dt, s = Math.sin(goal.th), c = Math.cos(goal.th);
    goal.x += (s * f + c * r) * v; goal.z += (-c * f + s * r) * v;
    keepIn(goal);
  }
  // 季節の札・向きの札（窓の中）。夜と時刻は とき.js（時刻の窓）が受け持つ
  document.querySelectorAll('#seasons button[data-s]').forEach((b) => b.addEventListener('click', () => setSeason(+b.dataset.s)));
  document.querySelectorAll('#views button[data-v]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.v === 'all') { const go = () => { back(); Object.assign(goal, fitAll(near(goal.th, OVER.th), OVER.ph)); saved = null; }; if (inside) leave(go); else go(); return; }
    goal.th = near(goal.th, [0, -Math.PI / 2, Math.PI, Math.PI / 2][+b.dataset.v]);
  }));
  $('#compass').addEventListener('click', () => { goal.th = near(goal.th, 0); });
  $('#c-back').addEventListener('click', back);

  // ---------------------------------------------------------------- 県名の札（重なる札は、小さい県から省く）
  const labels = [];
  let labelsOn = true;
  function makeLabels() {
    const box = $('#labels');
    for (const p of P) {
      const d = document.createElement('div');
      d.textContent = p.name;
      box.appendChild(d);
      labels.push({ p, d, w: p.name.length * 12 + 12 });
    }
    labels.sort((a, b) => b.p.area_km2 - a.p.area_km2);
  }
  const tmp = new T.Vector3();
  // 題・検索・下の札・入口の札の箱。県名の札はここを避ける（関東へ下りると、題「日本」の上に富山・長野の札が乗った）。
  // 箱は0.5秒ごとに、手の空いた時に測る。毎コマの中で測ると、県を押して札の窓が開いたコマと重なった時に組版がまとめて走り、67ms 止まった
  let uiBox = [];
  setInterval(() => (window.requestIdleCallback || setTimeout)(() => {
    uiBox = ['#title', '#search', '#bar', '#card.open', '#o-title', '#o-regions'].map((q) => $(q)).filter((e) => e && e.offsetWidth)
      .map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  }), 500);
  let labelsOff = false;
  function placeLabels() {
    // 県を浮かせている間・県の中では、札の箱ごとしまう（47枚の不透明度を1枚ずつ変えると、県を押したコマのスタイルの計算が CPU4倍で 17ms かかった。2026-11-07）
    const off = inside || sel >= 0 || !labelsOn;
    if (off !== labelsOff) { labelsOff = off; $('#labels').style.display = off ? 'none' : ''; }
    if (off) return;
    const put = uiBox.slice();
    for (const L of labels) {
      const p = L.p;
      tmp.set(p.ax, p.ay + liftY(p.k) + 1.5, p.az).project(camera);
      const x = (tmp.x + 1) / 2 * VW, y = (1 - tmp.y) / 2 * VH;
      // 全国の遊覧中は、浮かせた県の名だけ出す（ほかの県の名が、浮いた県の上に重なった）
      let ok = !inside && sel < 0 && labelsOn && (tourK < 0 || p.k === tourK) && tmp.z < 1 && x > 0 && x < VW && y > 0 && y < VH;
      const r = [x - L.w / 2, y - 9, x + L.w / 2, y + 9];
      if (ok) for (const q of put) if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) { ok = false; break; }
      if (ok) put.push(r);
      L.d.style.opacity = ok ? 1 : 0;
      if (ok) L.d.style.transform = `translate(${(x - L.w / 2).toFixed(1)}px, ${(y - 9).toFixed(1)}px)`;
    }
  }

  // ---------------------------------------------------------------- 小さすぎて地図に出ない島（竹島・尖閣諸島）
  // いつも印と名を出し、乗せた時・押した時・その県を浮かせた時に、吹き出しで拡大図を見せる。印はその県と一緒に浮く
  const ISLES = [];
  function makeIsles(buf) {
    const box = $('#isles'), svg = $('#leaders');
    for (const s of J.small || []) {
      const I = { s, k: P.find((p) => p.n === s.pref).k, g: new Int16Array(buf, s.g[0], s.g[1]), pinned: false, hover: false, drawn: -1 };
      I.mark = document.createElement('div'); I.mark.className = 'isle';
      I.mark.append(document.createElement('i'), document.createElement('span'));
      I.mark.lastChild.textContent = s.name;
      I.bub = document.createElement('div'); I.bub.className = 'bubble';
      const h = document.createElement('h3'), p = document.createElement('p'), sm = document.createElement('small');
      h.textContent = s.name; p.textContent = s.where;
      sm.textContent = '日本全体の地図の細かさでは見えない大きさなので、拡大して描いています（国土地理院 標高タイル）';
      I.cv = document.createElement('canvas'); I.cv.width = s.w * 2; I.cv.height = s.h * 2;
      I.bub.append(h, p, I.cv, sm);
      I.line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      svg.appendChild(I.line); box.append(I.mark, I.bub);
      // 乗せたかは毎コマ、指の位置と印の位置で決める（入った・出たの知らせは、地図を動かした時に届かず、開いたまま残った）
      I.mark.addEventListener('click', () => { I.pinned = !I.pinned; });
      ISLES.push(I);
    }
  }
  // 拡大図：地図と同じ季節の色。陸の高さで色を分け、急な所は岩の色、北西から光を当てて3段の陰、岸は墨の線と白い波。
  // 開いたコマで描くと、そのコマが止まる（CPU4倍で56ms）。開く前（開いた時・季節を変えた時）に描いておく
  function drawIsle(I) {
    const { w, h, wkm } = I.s, g = I.g, m = wkm * 1000 / w;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? -1 : g[y * w + x];
    const C = (c) => { const k = new T.Color(c); return [k.r * 255, k.g * 255, k.b * 255]; };
    const S = I.s.z > 730 ? 1 : season;                    // 南の島（亜熱帯）は季節で色を変えない（地図の天面と同じ決まり）
    const sea = C(PAL.shallow[season]), b0 = C(PAL.plain[S]), b1 = C(PAL.hill[S]), b2 = C(PAL.mount[S]);
    const ink = C('#2a3146'), foam = C('#f7f6ee'), rock = C('#b9a58c'), light = C('#fff6c8'), dark = C('#28406a');
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const ox = off.getContext('2d'), im = ox.createImageData(w, h), D = im.data, c = [0, 0, 0];
    const mix = (q, f) => { c[0] += (q[0] - c[0]) * f; c[1] += (q[1] - c[1]) * f; c[2] += (q[2] - c[2]) * f; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = at(x, y), l = at(x - 1, y), r = at(x + 1, y), u = at(x, y - 1), d = at(x, y + 1);
      if (v < 0) { const s = l >= 0 || r >= 0 || u >= 0 || d >= 0 ? foam : sea; c[0] = s[0]; c[1] = s[1]; c[2] = s[2]; }
      else if (l < 0 || r < 0 || u < 0 || d < 0) { c[0] = ink[0]; c[1] = ink[1]; c[2] = ink[2]; }
      else {
        c[0] = b0[0]; c[1] = b0[1]; c[2] = b0[2];
        mix(b1, clamp((v - 60) / 120, 0, 1)); mix(b2, clamp((v - 220) / 120, 0, 1));
        const gx = (r - l) / (2 * m), gy = (d - u) / (2 * m);
        mix(rock, clamp((Math.hypot(gx, gy) - 0.6) / 0.6, 0, 1) * 0.8);
        const sh = Math.round(((0.6 * gx + 0.5 * gy + 0.62) / Math.hypot(gx, gy, 1) - 0.62) * 2.2) / 2.2;
        if (sh > 0) mix(light, Math.min(0.5, sh * 1.2)); else mix(dark, Math.min(0.5, -sh * 1.1));
      }
      const o = (y * w + x) * 4;
      D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255;
    }
    ox.putImageData(im, 0, 0);
    const ctx = I.cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w * 2, h * 2);
    // 縮尺の物差し
    const pk = w * 2 / wkm, len = [0.1, 0.2, 0.5, 1, 2, 5, 10].filter((k) => k * pk <= w * 0.7).pop(), L = len * pk, x0 = 14, y0 = h * 2 - 14;
    ctx.strokeStyle = '#2a3146'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(x0, y0 - 8); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0); ctx.lineTo(x0 + L, y0 - 8); ctx.stroke();
    ctx.font = '700 22px "Yu Mincho", "YuMincho", serif'; ctx.fillStyle = '#2a3146';
    ctx.fillText(len < 1 ? len * 1000 + 'm' : len + 'km', x0 + L + 8, y0 + 2);
  }
  // 吹き出しの置き場所：印のまわり24か所を試し、陸を隠す割合がいちばん少ない所（海の側・列島の外）へ。
  // 画面の端・札の窓・題・下の札にかかる所は選ばない。動かすたびに跳ねないよう、今の場所はひいきする
  let ptr = null;
  addEventListener('pointermove', (e) => { ptr = { x: e.clientX, y: e.clientY }; }, { passive: true });
  // 画面のどこに陸があるか：陸の頂点を全部（約7.6万）画面へ写し、16pxの升目で数える。浮かせた県は浮いた高さで写し、重み40。
  // 箱の中を何点か調べる作りでは、宮古・八重山のような小さな島が点の間に落ちて、吹き出しが島を隠した（2026-10-27 本人）。
  // 升目は「左上からの合計」の表にして、どの箱でも4回の引き算で中の点の数を出す。カメラが止まっている間は作り直さない
  // 数えるのは1コマ BUDGET ms までに区切り、数コマに分ける（一度に数えると、沖縄を押してせり上がりが終わったコマが CPU4倍で 54ms 止まった）。
  // 数え終わるまでは null を返し、吹き出しはその間出さない
  const CELL = 16, BUDGET = 6;
  let landGrid = null, landKey = '', landJob = null;
  function landOnScreen() {
    const key = [cam.th, cam.ph, cam.D, cam.x, cam.y, cam.z, sel, sel >= 0 ? lift[sel] : 0, VW, VH].map((v) => (+v).toFixed(2)).join();
    if (key === landKey && landGrid) return landGrid;
    // 止まりかけでカメラが少しずつ動く間も、数えかけを捨てない（毎コマ捨てると数え終わらず、コマの時間を食い続けた。CPU4倍で 34ms のコマ。2026-11-07）
    if (!landJob || frames - landJob.at > 2) {
      const GW = Math.ceil(VW / CELL) + 1, GH = Math.ceil(VH / CELL) + 1, W = GW + 1;
      const m = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements;
      const S = (x, y, z) => { const cw = m[3] * x + m[7] * y + m[11] * z + m[15]; return cw <= 0 ? null
        : [((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw + 1) / 2 * VW, (1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw) / 2 * VH]; };
      const tasks = [];
      for (const p of P) {
        // 画面にかからない県は飛ばす（外枠の四隅を、地面と浮いた高さで写して確かめる）。沖縄を見ている時は数県だけを写す
        const b = p.bbox, ly = lift[p.k];
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = false;
        for (const [cx, cz] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) for (const cy of [0, ly + 40]) {
          const q = S(cx, cy, cz); if (!q) { behind = true; continue; }
          x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
        }
        if (!behind && (x1 < 0 || y1 < 0 || x0 > VW || y0 > VH)) continue;
        // 浮いた県は全部の点で（主役は強く避ける）、ほかの県は4つおきに数えて重み4
        tasks.push({ p, ly, step: p.k === sel ? 1 : 4, wt: p.k === sel ? 40 : 4 });
      }
      landJob = { key, GW, GH, W, g: new Float32Array(W * (GH + 1)), m, tasks, ti: 0, j: 0 };
    }
    const J = landJob, { g, W, m } = J, t0 = performance.now();
    J.at = frames;
    while (J.ti < J.tasks.length) {
      const { p, ly, step, wt } = J.tasks[J.ti], end = Math.min(p.nv, J.j + 3000 * step);
      let j = J.j;
      for (; j < end; j += step) {
        const o = (p.v0 + j) * 3, x = POS[o], y = POS[o + 1] + ly, z = POS[o + 2];
        const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
        if (cw <= 0) continue;
        const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw + 1) / 2 * VW;
        const sy = (1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw) / 2 * VH;
        if (sx < 0 || sy < 0 || sx >= VW || sy >= VH) continue;
        g[(Math.floor(sy / CELL) + 1) * W + Math.floor(sx / CELL) + 1] += wt;
      }
      J.j = j;
      if (J.j >= p.nv) { J.ti++; J.j = 0; }
      if (J.ti < J.tasks.length && performance.now() - t0 > BUDGET) return null;
    }
    const { GW, GH } = J;
    for (let r = 1; r <= GH; r++) for (let c = 1; c <= GW; c++) g[r * W + c] += g[(r - 1) * W + c] + g[r * W + c - 1] - g[(r - 1) * W + c - 1];
    landKey = J.key; landJob = null;
    return (landGrid = { g, GW, GH, W });
  }
  function landIn(L, x0, y0, x1, y1) {
    const c0 = clamp(Math.floor(x0 / CELL), 0, L.GW), c1 = clamp(Math.ceil(x1 / CELL), 0, L.GW);
    const r0 = clamp(Math.floor(y0 / CELL), 0, L.GH), r1 = clamp(Math.ceil(y1 / CELL), 0, L.GH);
    return L.g[r1 * L.W + c1] - L.g[r0 * L.W + c1] - L.g[r1 * L.W + c0] + L.g[r0 * L.W + c0];
  }
  // 印から向き a・離れ d の所に箱を置き、画面の中へ押し込む（印が画面の端にある時、外へはみ出す候補しか無くなり、
  // 浮いた県を隠す候補が選ばれた。押し込めば画面の中の空いた所に置ける）
  function placeAt(x, y, a, d, bw, bh) {
    const ang = a * Math.PI / 6;
    return { bx: clamp(x + Math.cos(ang) * (d + bw / 2) - bw / 2, 12, VW - bw - 12),
             by: clamp(y + Math.sin(ang) * (d + bh / 2) - bh / 2, 70, VH - bh - 90) };
  }
  function spot(I, x, y, bw, bh, card) {
    let best = null;
    const L = landOnScreen();
    if (!L) return null;                                    // まだ数えている途中（次のコマで続き）
    for (let a = 0; a < 12; a++) for (const d of [60, 130, 220, 320]) {
      const { bx, by } = placeAt(x, y, a, d, bw, bh);
      let s = d * 0.004;                                                     // 遠くへ飛ぶほど少し減点
      if (x > bx - 8 && x < bx + bw + 8 && y > by - 8 && y < by + bh + 8) s += 30;   // 押し込んだ箱が印そのものを隠す
      if (card && bx + bw > card.left - 8 && by < card.bottom + 8) s += 50;
      if (bx < 300 && by < 260) s += 20;                                     // 題（日本・季節の巻）と霞
      s += Math.min(landIn(L, bx - 10, by - 10, bx + bw + 10, by + bh + 10), 12000) * 0.03;   // 陸の頂点1つ（浮いた県は40＝主役は強く避ける）ごとに減点。まわり10pxも
      // 印から吹き出しへの線が陸を横切る分も、少し減点（線が本州をまたいで太平洋へ飛んだ）
      const ex = clamp(x, bx, bx + bw), ey = clamp(y, by, by + bh);
      for (let t = 0.1; t < 1; t += 0.2) { const lx = x + (ex - x) * t, ly = y + (ey - y) * t; s += landIn(L, lx - 8, ly - 8, lx + 8, ly + 8) * 0.01; }
      if (I.at && I.at.a === a && I.at.d === d) s -= 0.6;
      if (!best || s < best.s) best = { s, a, d, bx, by };
    }
    return best;
  }
  // カメラも、浮かせる動きも止まっているか
  const still = () => !drag && Math.abs(camV.th || 0) < 0.02 && Math.abs(camV.ph || 0) < 0.02 && Math.abs(camV.D || 0) < 5
    && Math.abs(camV.x || 0) < 5 && Math.abs(camV.z || 0) < 5 && Math.abs(camV.y || 0) < 1 && (sel < 0 || Math.abs(liftV[sel]) < 1.5);
  // 印と吹き出しの大きさは中身が変わらないので、初めに1回だけ測って覚える。毎コマ、位置を書いた直後に大きさを読むと、
  // そのたびにブラウザが組版をやり直した（吹き出しを初めて出したコマが100ms止まった）
  const isleBoxes = [];   // 開いている島の吹き出しの箱（県の中.js の「〇〇の中へ」が避ける。沖縄で尖閣の吹き出しの題に重なった 2026-11-07）
  function placeIsles() {
    isleBoxes.length = 0;
    for (const I of ISLES) {
      tmp.set(I.s.x, liftY(I.k) + 0.4, I.s.z).project(camera);
      const x = (tmp.x + 1) / 2 * VW, y = (1 - tmp.y) / 2 * VH;
      const vis = !inside && tmp.z < 1 && x > 0 && x < VW && y > 0 && y < VH;
      I.mark.style.display = vis ? 'flex' : 'none';
      I.mark.style.transform = `translate(${(x - 7).toFixed(1)}px, ${(y - 7).toFixed(1)}px)`;
      I.mark.style.opacity = sel >= 0 && sel !== I.k ? 0.5 : 1;
      if (vis && !I.mw) I.mw = I.mark.offsetWidth;
      I.hover = !!(vis && ptr && !drag && ptr.x >= x - 13 && ptr.x <= x - 1 + (I.mw || 60) && ptr.y >= y - 13 && ptr.y <= y + 13);
      let open = vis && (I.hover || I.pinned || sel === I.k);
      if (!open) I.at = null;
      // 置き場所は、カメラとせり上がりが落ち着いた時だけ決め直す（動いている間に毎回決めると、せり上がりのコマが283ms止まった）。
      // 動いている間は前に決めた向き・距離のまま印についていく。まだ決めていない吹き出し（県を押して開く時）は、落ち着くまで出さない
      if (open && !I.at && !still()) open = false;
      I.bub.classList.toggle('open', open);
      I.line.style.display = open ? '' : 'none';
      if (!open) continue;
      if (I.drawn !== season) { drawIsle(I); I.drawn = season; }
      if (!I.bw) { I.bw = I.bub.offsetWidth; I.bh = I.bub.offsetHeight; }
      const bw = I.bw, bh = I.bh;
      if (!still()) I.dirty = true;
      else if (!I.at || I.dirty) {
        const card = $('#card').classList.contains('open') ? $('#card').getBoundingClientRect() : null;
        const at = spot(I, x, y, bw, bh, card);
        if (at) { I.at = at; I.dirty = false; }
      }
      // 初めて置く吹き出しは、陸を数え終わるまで出さない（前に決めた置き場所がある時は、そのまま印についていく）
      if (!I.at) { I.bub.classList.remove('open'); I.line.style.display = 'none'; continue; }
      const { bx, by } = placeAt(x, y, I.at.a, I.at.d, bw, bh);
      I.bub.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px)`;
      isleBoxes.push([bx, by, bx + bw, by + bh]);
      I.line.setAttribute('x1', x.toFixed(1)); I.line.setAttribute('y1', y.toFixed(1));
      I.line.setAttribute('x2', clamp(x, bx, bx + bw).toFixed(1)); I.line.setAttribute('y2', clamp(y, by, by + bh).toFixed(1));
    }
  }

  // ---------------------------------------------------------------- 墨の線（山の輪郭・尾根）
  // 観光鳥瞰図は、色を塗る前に墨の線を引く。地図を画面と同じ大きさの紙に描き（4サンプルでなめらかに）、
  // その奥行き（1/距離。平らな面では画面の上でまっすぐ変わる）を、まわりの4方向と比べる。
  // まわりより手前に出ている所（山の輪郭・尾根）に線を引き、谷（へこみ）には引かない。遠くは霞に合わせて薄く。
  // 面の向きで引く作り（地面の絵の具の中）では、輪郭の手前の面が見る向きを向いたままで、線がほとんど出なかった
  const INK = !/[?&]ink=0/.test(location.search);
  const PU = {
    tColor: { value: null }, tDepth: { value: null }, uTexel: { value: new T.Vector2() },
    uNear: { value: 1 }, uFar: { value: 10 }, uFogNear: U.uFogNear, uFogFar: U.uFogFar, uInk: U.uInk,
    uR: { value: 1.3 }, uK: { value: 0.012 },
  };
  const FS_INK = `
    uniform sampler2D tColor, tDepth; uniform vec2 uTexel; uniform float uNear, uFar, uFogNear, uFogFar, uR, uK; uniform vec3 uInk;
    varying vec2 vUv;
    float W(vec2 o) {
      float d = texture2D(tDepth, vUv + o * uTexel).r;
      return d >= 0.99999 ? 0.0 : (uFar - d * (uFar - uNear)) / (uNear * uFar);
    }
    // 4方向（横・縦・斜め2つ）の向かい合う2点と比べる。くり返しの中で画像を読むと D3D が警告するので、並べて書く
    float bend(float w0, vec2 o) { return smoothstep(uK, uK * 3.0, (2.0 * w0 - W(o * uR) - W(-o * uR)) / max(w0, 1e-9)); }
    void main() {
      vec4 c = texture2D(tColor, vUv);
      float w0 = W(vec2(0.0));
      float e = max(max(bend(w0, vec2(1.0, 0.0)), bend(w0, vec2(0.0, 1.0))), max(bend(w0, vec2(0.7071, 0.7071)), bend(w0, vec2(0.7071, -0.7071))));
      e *= (1.0 - 0.7 * smoothstep(uFogNear, uFogFar, 1.0 / max(w0, 1e-9))) * step(1e-9, w0);
      gl_FragColor = vec4(mix(c.rgb, uInk * c.a, e * 0.82), c.a);
    }`;
  let inkRT = null;
  const inkScene = new T.Scene(), inkCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  if (INK) {
    const q = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: PU, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FS_INK }));
    q.frustumCulled = false; inkScene.add(q);
  }
  function inkSize(w, h) {
    if (!INK) return;
    if (!inkRT) {
      // 型板（stencil）つき：県の中の川・道・線路を、木の絵より上に描くため（県の中.js の MARK・UNDER）
      const dt = new T.DepthTexture(w, h, T.UnsignedInt248Type);
      dt.format = T.DepthStencilFormat;
      inkRT = new T.WebGLRenderTarget(w, h, { samples: 4, stencilBuffer: true, depthTexture: dt });
      PU.tColor.value = inkRT.texture; PU.tDepth.value = inkRT.depthTexture;
    } else inkRT.setSize(w, h);
    PU.uTexel.value.set(1 / w, 1 / h);
  }
  // ---------------------------------------------------------------- 空の雲（全国の眺め）
  // 本人 2026-11-02「全国の時は、西（南西・北西）から東（北東・南東）へ流れる雲」「今の霞んだ絵図の雲でよい」「のんびり漂う」「地図を覆ってもよい」。
  // 空の帯の雲（index.html の .cloud）と同じ絵を、地図の上空に画面へ向けた板で置き、風の向き（開くたびに東から±25°）へ流す。
  // 墨の線を引いた後に描き、地図より奥の所は地図の奥行き（tDepth）と比べて描かない（地図と同じ段で描くと、山の墨の線が雲に透けた）。
  // 寄って雲が画面の短い辺の3分の1を超える時は薄く消す（県を浮かせた眺めで、1つの雲が画面を覆った）。動きを減らす設定では流さない
  const NC = 14, CL = 3200, CW = 3000, CC = [-260, 160];   // 雲の数・風下へ流れる長さと幅（km）・その真ん中（日本の真ん中あたり）
  const wa = (Math.random() * 2 - 1) * 25 * Math.PI / 180, wd = [Math.cos(wa), -Math.sin(wa)], wp = [-wd[1], wd[0]];
  U.uWind.value.set(wd[0], wd[1]);
  const clouds = Array.from({ length: NC }, (_, i) => ({ s: (i + Math.random() * 0.8) / NC * CL, t: (Math.random() - 0.5) * CW,
    y: 85 + Math.random() * 35, w: 260 + Math.random() * 200, v: 9 + Math.random() * 5, vi: i % 2, a: 0.62 + Math.random() * 0.25 }));
  const cPos = new Float32Array(NC * 4), cInf = new Float32Array(NC * 2);
  const cg = new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1, 1));
  cg.instanceCount = NC;
  cg.setAttribute('aCloud', new T.InstancedBufferAttribute(cPos, 4).setUsage(T.DynamicDrawUsage));
  cg.setAttribute('aInfo', new T.InstancedBufferAttribute(cInf, 2).setUsage(T.DynamicDrawUsage));
  const CU = { tCloud: { value: null }, tDepth: PU.tDepth, uRes: U.uRes, uNight: U.uNight, uDusk: U.uDusk,
    uFogCol: U.uFogCol, uFogNear: U.uFogNear, uFogFar: U.uFogFar };
  const cloudMesh = new T.Mesh(cg, new T.ShaderMaterial({ uniforms: CU, transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: !INK,
    defines: INK ? { DEPTH_TEX: 1 } : {},
    vertexShader: `
      attribute vec4 aCloud; attribute vec2 aInfo;
      varying vec2 vUv; varying float vA, vDist;
      void main() {
        vec4 mv = modelViewMatrix * vec4(aCloud.xyz, 1.0);
        mv.xy += position.xy * vec2(aCloud.w, aCloud.w * 0.2667);
        vDist = -mv.z;
        vA = aInfo.x;
        vUv = vec2(uv.x, uv.y * 0.5 + 0.5 * (1.0 - aInfo.y));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      #ifdef DEPTH_TEX
      uniform sampler2D tDepth;
      #endif
      uniform sampler2D tCloud; uniform vec2 uRes; uniform float uNight, uDusk, uFogNear, uFogFar; uniform vec3 uFogCol;
      varying vec2 vUv; varying float vA, vDist;
      void main() {
        vec4 t = texture2D(tCloud, vUv);
        float a = t.a * vA * (1.0 - 0.72 * uNight);
        #ifdef DEPTH_TEX
        if (gl_FragCoord.z > texture2D(tDepth, gl_FragCoord.xy / uRes).r) a = 0.0;
        #endif
        if (a < 0.004) discard;
        vec3 c = t.rgb / max(t.a, 1e-4);
        c = mix(c, vec3(0.40, 0.45, 0.60), uNight * 0.8);
        c = mix(c, vec3(1.0, 0.84, 0.70), uDusk * (1.0 - uNight) * 0.35);
        c = mix(c, uFogCol, smoothstep(uFogNear, uFogFar, vDist) * 0.85);
        gl_FragColor = vec4(c * a, a);
      }`,
  }));
  cloudMesh.frustumCulled = false; cloudMesh.visible = false;
  const cloudScene = new T.Scene();
  cloudScene.add(cloudMesh);
  let cloudIn = -1;                                   // 絵が届いてから2秒で、ふわっと出す（-1＝まだ絵が無い）
  (async () => {
    try {
      // 絵は空の帯の雲（CSS の背景の絵）をそのまま使う。2種類を上下に並べた1枚の紙に
      const cv = document.createElement('canvas'); cv.width = 600; cv.height = 320;
      const g2 = cv.getContext('2d');
      for (const [i, q] of ['.cloud.c1', '.cloud.c2'].entries()) {
        const m = /^url\("(.*)"\)$/s.exec(getComputedStyle($(q)).backgroundImage.trim());
        if (!m) throw new Error('雲の絵の住所が読めない');
        const img = new Image(); img.src = m[1]; await img.decode();
        g2.drawImage(img, 0, i * 160, 600, 160);
      }
      const tex = new T.CanvasTexture(cv);
      tex.premultiplyAlpha = true;
      CU.tCloud.value = tex; cloudIn = 0;
    } catch (e) { console.warn('空の雲を出せませんでした：' + e.message); }
  })();
  function moveClouds(dt) {
    cloudMesh.visible = cloudIn >= 0 && !inside && !free;
    if (!cloudMesh.visible) return;
    cloudIn = Math.min(1, cloudIn + dt / 2);
    const go = calm.matches ? 0 : dt, sm = (x) => x * x * (3 - 2 * x), cp = camera.position, fit = Math.min(VW, VH);
    for (let i = 0; i < NC; i++) {
      const c = clouds[i];
      c.s += c.v * go;
      if (c.s > CL) { c.s -= CL; c.t = (Math.random() - 0.5) * CW; }
      const u = c.s / CL, o = c.s - CL / 2, x = CC[0] + wd[0] * o + wp[0] * c.t, z = CC[1] + wd[1] * o + wp[1] * c.t;
      const px = c.w * U.uPpk.value / Math.max(1, Math.hypot(x - cp.x, c.y - cp.y, z - cp.z));     // 画面での幅（CSS の画素）
      cPos[i * 4] = x; cPos[i * 4 + 1] = c.y; cPos[i * 4 + 2] = z; cPos[i * 4 + 3] = c.w;
      cInf[i * 2] = c.a * sm(cloudIn) * sm(Math.min(1, u / 0.1, (1 - u) / 0.1)) * (1 - sm(clamp((px / fit - 0.35) / 0.25, 0, 1)));
      cInf[i * 2 + 1] = c.vi;
    }
    cg.attributes.aCloud.needsUpdate = cg.attributes.aInfo.needsUpdate = true;
  }
  function drawClouds() {
    if (!cloudMesh.visible) return;
    const ac = renderer.autoClear;
    renderer.autoClear = false; renderer.render(cloudScene, camera); renderer.autoClear = ac;
  }
  function draw() {
    if (!inkRT) { renderer.render(scene, camera); drawClouds(); return; }
    renderer.setRenderTarget(inkRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
    PU.uNear.value = camera.near; PU.uFar.value = camera.far;
    renderer.render(inkScene, inkCam);
    drawClouds();
  }

  // ---------------------------------------------------------------- 毎コマ
  function resize() {
    VW = window.innerWidth; VH = window.innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(VW, VH, false);
    camera.aspect = VW / VH;
    U.uRes.value.set(VW * dpr, VH * dpr);
    U.uW.value = 1.8 * dpr;
    U.uDpr.value = dpr;
    U.uPpk.value = VH / (2 * Math.tan(camera.fov * Math.PI / 360));   // 1km 先の1kmが何画素か（距離で割って使う）
    inkSize(Math.round(VW * dpr), Math.round(VH * dpr));
    PU.uR.value = 1.3 * dpr;
    if (G) homeFit();
  }
  addEventListener('resize', resize);
  // 「日本全体」の眺め：いつもは南南東から。スマホの縦長の画面では北東を向いて見下ろす（日本の長い向き＝南西から北東を、画面の縦に）。
  // 南南東からのままだと、寄りの上限（9000）でも北海道が右の外へ切れ、日本が小さく横たわった（2026-11-09）。向きを変えたら測り直す
  function homeFit() {
    const port = PHONE() && VH > VW;
    Object.assign(HOME, fitAll(port ? 0.6 : -0.35, port ? 0.6 : 0.52));
  }

  let last = performance.now(), frames = 0;
  let tStop = null;   // 検査用：絵の具の時刻（雲の影・水面）を止める（MAP3D.stopTime）
  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    // 県の中：目標を先に山の上へ出してから、カメラを追わせる。追いかける途中のカメラも、地面にもぐらせない。
    // 目標を出さずにカメラだけ持ち上げると、ばねが目標の角度へ毎コマ引きもどし、持ち上げと引っぱり合って
    // カメラが小刻みに揺れ続け、木や家の絵がちらちら点滅した（本人 2026-10-27）
    // 見る点は、その場の地面の高さに置く（海面の高さのままだと、山の場所では見る点が山の中に埋まり、見る線が通らなかった）
    if (free) free(dt);
    else {
    pan(dt);
    if (inside) { if (inside.heightAt) goal.y = inside.heightAt(goal.x, goal.z); clearView(goal, 0.01); }
    for (const key of ['th', 'ph', 'D', 'x', 'y', 'z']) spring(cam, camV, key, goal[key], 6, dt);
    // 目標の角度からは見通せても、カメラが下りる途中に山があって通れない時は、目標の角度もそこまで上げる（引っぱり合いを止める）
    if (inside) { const ph0 = cam.ph; clearView(cam, 0.01); if (cam.ph > ph0) { camV.ph = Math.max(camV.ph || 0, 0); goal.ph = Math.max(goal.ph, cam.ph); } }
    }
    place();
    if (!free) U.uPatK.value = cam.D / U.uPpk.value;   // 地面の模様の細かさ：見ている所までの近さで、画面ぜんたい1つ（空を飛ぶ間は 旅.js が飛ぶ高さで）
    if (hoverAt && hoverAt.fresh && !drag) { hoverAt.fresh = false; setHover(inside ? -1 : pick(hoverAt.x, hoverAt.y)); }
    const tip = $('#tip');
    if (hoverAt && tip.style.display === 'block') tip.style.transform = `translate(${hoverAt.x + 16}px, ${hoverAt.y - 34}px)`;
    const ts = performance.now() / 1000 * Math.PI * 2 / BOB_T, wave = (Math.sin(ts) + 0.2 * Math.sin(ts * 2.3 + 1.3)) / 1.2, bobK = BOB_PX * cam.D / U.uPpk.value;
    for (const p of P) {
      const i = p.k, up = (i === sel || (sel < 0 && i === tourK)) && !inside;
      spring(lift, liftV, i, up ? LIFT : 0, 4, dt);       // 地層からせり上がる：約1秒で9割、そこからふわっと止まる
      spring(bobA, bobAV, i, up && !calm.matches && lift[i] > LIFT * 0.97 ? bobK : 0, 1.6, dt);
      bobY[i] = bobA[i] * wave;
      spring(grey, greyV, i, inside ? 0 : sel >= 0 ? (i !== sel ? 1 : 0) : tourK >= 0 ? (i !== tourK ? 0.45 : 0) : (hlOn && !hlT[i] ? 0.72 : 0), 5, dt);
      hl[i] += (hlT[i] - hl[i]) * (1 - Math.exp(-dt * 6));
      glow[i] += ((i === hov && i !== sel ? 1 : 0) - glow[i]) * (1 - Math.exp(-dt * 12));
      stData[i * 4] = liftY(i); stData[i * 4 + 1] = grey[i] * (1 - glow[i] * 0.6); stData[i * 4 + 2] = glow[i]; stData[i * 4 + 3] = hl[i];
      if (p.ex) p.ex.visible = lift[i] > 0.05;
    }
    stTex.needsUpdate = true;
    for (const key in want) U[key].value.lerp(want[key], 1 - Math.exp(-dt * 4));
    U.uNight.value += (nightT - U.uNight.value) * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(nightT - U.uNight.value) < 1e-3) U.uNight.value = nightT;
    U.uTime.value = tStop != null ? tStop : (performance.now() / 1000) % 3600;
    U.uCloud.value = 1 - U.uNight.value;
    U.uDusk.value += (duskT - U.uDusk.value) * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(duskT - U.uDusk.value) < 1e-3) U.uDusk.value = duskT;
    fogColor();
    sky(dt);
    moveClouds(dt);
    if (inside && inside.frame) inside.frame(dt);
    draw();
    placeLabels();
    placeIsles();
    emit('frame');
    if (++frames === 3) { window.__shown = true; $('#wait').style.display = 'none'; emit('shown'); }
    requestAnimationFrame(frame);
  }

  // ページに書いた部品（入口・季節と時刻・後から読む）を全部読んでから組み立てる。回線が速いと、途中の部品を読む前に地図が先に出きって、
  // 入口の眺めが一瞬ずれたり、「最初の絵が出た」の知らせを聞き逃して、ずっと「読み込み中」のままになった（http で開いた時だけ。2026-11-07）
  const parsed = new Promise((ok) => (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', ok, { once: true }) : ok()));
  Promise.all([inflate(J.bin), TOWN ? inflate(TOWN.bin) : null, parsed]).then(([buf, town]) => {
    if (J.delta) undelta(buf);
    G = build(buf);
    if (town) {
      const t = new T.DataTexture(new Uint8Array(town), TOWN.w, TOWN.h, T.RedFormat, T.UnsignedByteType);
      t.magFilter = t.minFilter = T.LinearFilter; t.needsUpdate = true;
      U.uTown.value = t; U.uTownBox.value.set(TOWN.x0, TOWN.z0, TOWN.w * TOWN.cell, TOWN.h * TOWN.cell);
    }
    resize();
    Object.assign(cam, HOME); Object.assign(goal, HOME);         // HOME は直前の resize() が画面に合わせて測った（homeFit）
    setSeason(1, true);
    assemble();
    // 浮かせた時に使う絵の具も、最初に用意しておく（初めて押した時に止まらないように）
    const warm = extras(P[9]);
    warm.visible = true; place(); renderer.compile(scene, camera); renderer.compile(pickScene, camera);
    if (INK) renderer.compile(inkScene, inkCam);
    // 用意（compile）だけでは、GPU の側の下ごしらえが「初めて描いた時」まで残る（初めて乗せた時の当て描きが 30〜41ms→7ms）。
    // 開く時に、浮いた県と押した所の当て描きを、見えない小さな紙へ1回ずつ描いておく
    const wrt = new T.WebGLRenderTarget(64, 64);
    stData[P[9].k * 4] = LIFT; stTex.needsUpdate = true;
    renderer.setRenderTarget(wrt); renderer.render(scene, camera); renderer.setRenderTarget(null);
    stData[P[9].k * 4] = 0; stTex.needsUpdate = true; wrt.dispose();
    pick(VW / 2, VH / 2);
    warm.visible = false;
    makeLabels();
    makeIsles(buf);
    emit('ready');
    for (const I of ISLES) { drawIsle(I); I.drawn = season; I.bw = I.bub.offsetWidth; I.bh = I.bub.offsetHeight; }
    requestAnimationFrame(frame);
    // 浮かせた県の底・断面・縁の線を、手の空いた時に1県ずつ作り、見えない1画素の紙へ1回描いて GPU へ送っておく。
    // 押されるまで作らないと、初めて押した県のコマで「形を作る・GPU へ送る・初めて描く」が重なり、CPU4倍で 67〜83ms 止まった（2026-11-06 抜き取りで切り分け）
    const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 10 }), 200));
    const pre = new T.WebGLRenderTarget(1, 1), todo = P.filter((p) => !p.ex);
    const warmOne = (dl) => {
      if (dl.timeRemaining() > 6 && todo.length) {
        const p = todo.shift();
        if (!p.ex) {
          const g = extras(p);
          g.visible = true; renderer.setRenderTarget(pre); renderer.render(g, camera); renderer.setRenderTarget(null); g.visible = false;
        }
      }
      if (todo.length) idle(warmOne); else pre.dispose();
    };
    idle(warmOne);
  }).catch((e) => { console.error(e); msg('地図をひろげる途中で失敗しました：' + e.message); });

  // 外から使う道具（案内.js の検索・カレンダー・紹介と、撮影・検査から使う）
  window.MAP3D = {
    on(e, f) { (ON[e] = ON[e] || []).push(f); if (DONE.has(e)) setTimeout(f, 0); }, FULL,
    off(e, f) { const L = ON[e], i = L ? L.indexOf(f) : -1; if (i >= 0) L.splice(i, 1); },
    forget(w) { if (lastWorld === w) lastWorld = null; },
    labelOf(k) { const L = labels.find((q) => q.p.k === k); return L && L.d; },
    // 描き込み（木・家・川）と県の中の地図が、同じ絵の具の決まりで描くための中身
    inner: { T, U, STATE, FINISH, GROUND, EX, scene, nat, renderer, camera, mat, geo, get POS() { return POS; }, get G() { return G; }, get season() { return season; } },
    project(x, y, z) {
      tmp.set(x, y, z).project(camera);
      return { x: (tmp.x + 1) / 2 * VW, y: (1 - tmp.y) / 2 * VH, ok: tmp.z < 1 };
    },
    groundY(k, x, z) {
      if (inside && inside.heightAt) return inside.heightAt(x, z);
      const p = P[k]; let best = 1e18, y = 0;
      for (let j = 0; j < p.nv; j++) { const o = (p.v0 + j) * 3, d = (POS[o] - x) ** 2 + (POS[o + 2] - z) ** 2; if (d < best) { best = d; y = POS[o + 1]; } }
      return y;
    },
    fly(v) { leave(() => { if (sel >= 0) back(); Object.assign(goal, { y: 0 }, v); keepIn(goal); }); },
    fitPrefs(ks) { leave(() => { if (sel >= 0) back(); Object.assign(goal, fitAll(goal.th, Math.max(goal.ph, 0.75), landPts(ks), SHEET())); }); },
    // 地方へ（入口.js）：いつもの鳥瞰図の向き（南南東から約30°）で、その地方の県が収まる所まで寄る
    // 県の中心から遠く離れた島は除いて収める（関東が伊豆諸島まで収めて、本土が画面の上に寄り、下半分が海になった）。whole＝県ぜんたい（北海道・沖縄）
    fitRegion(ks, whole) {
      const pts = [], med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
      for (const k of ks) {
        const q = landPts([k]);
        if (whole || q.length < 8) { pts.push(...q); continue; }
        const mx = med(q.map((p) => p[0])), mz = med(q.map((p) => p[1])), d = q.map((p) => Math.hypot(p[0] - mx, p[1] - mz)), lim = med(d) * 2.5 + 15;
        q.forEach((p, i) => { if (d[i] <= lim) pts.push(p); });
      }
      leave(() => { if (sel >= 0) back(); Object.assign(goal, fitAll(HOME.th, HOME.ph, pts)); });
    },
    highlight(m) {   // m＝{県の番号(k): 強さ0〜1} か null
      hlT.fill(0); hlOn = !!m;
      if (m) for (const k in m) hlT[k] = m[k];
    },
    get ready() { return !!G; },
    labels(on) { labelsOn = on; },
    get vw() { return VW; }, get vh() { return VH; },
    P, cam, goal, HOME, OVER, LIFT, onDismiss: (f) => dismissers.push(f), sheet: () => !!SHEET(), phone: PHONE,
    view(v, now) { Object.assign(goal, v); keepIn(goal); if (now) { Object.assign(cam, goal); for (const k in camV) camV[k] = 0; place(); } },
    // 自前でカメラを動かす（旅.js の空を飛ぶ）。f＝毎コマ cam を書く関数、null で、いまの眺めからばねで見る点のまわりの作りへ戻る
    free(f) { free = f || null; if (!f) { Object.assign(goal, cam); keepIn(goal); for (const k in camV) camV[k] = 0; } },
    get freeOn() { return !!free; },
    select(k) { leave(() => select(k, sel < 0 ? 'push' : 'replace')); }, back, season: setSeason, pick,
    night(on, now) { setNight(on); if (now) { U.uNight.value = nightT; U.uDusk.value = duskT; fogColor(); } }, get isNight() { return isNightNow; },
    // 時刻（とき.js）：h＝時（小数）、day＝日付（月の満ち欠けと太陽の道）。now で寄せずにすぐ
    time(h, day, now) { setTime(h, day || todDay); if (now) { U.uNight.value = nightT; U.uDusk.value = duskT; fogColor(); } },
    get clock() { return { h: tod, night: nightT, dusk: duskT, sun: { ...sun }, moon: { ...moon } }; },
    enter, leave, veil, clearView, get inside() { return inside; },
    tourLift(k) { tourK = k; if (k >= 0) extras(P[k]); },
    settle() {
      Object.assign(cam, goal); for (const k in camV) camV[k] = 0;
      for (const p of P) { lift[p.k] = p.k === sel ? LIFT : 0; grey[p.k] = sel >= 0 && p.k !== sel ? 1 : 0; liftV[p.k] = greyV[p.k] = 0; }
    },
    lift: (k) => inside ? 0 : lift[k], fit: fitAll,
    liftY: (k) => inside ? 0 : liftY(k),     // 描いている高さ（ぷかぷかを含む）。県の上に置く札・豆・印はこちらで
    get bob() { return { a: Array.from(bobA), y: Array.from(bobY) }; },
    // 検査用：絵の具の時刻を止める・戻す。2枚を撮って比べる時、時刻で流れる雲の影が差に混ざった（2026-11-02 海津の水路）
    stopTime(on) { tStop = on ? U.uTime.value : null; },
    // 検査用：空の雲（出ているか・風の向き・位置と幅・濃さ）
    get clouds() { return { on: cloudMesh.visible, wind: wd.slice(), pos: Array.from(cPos), inf: Array.from(cInf), base: clouds.map((c) => c.a), cam: camera.position.toArray() }; },
    screenOf(k) { const p = P[k]; tmp.set(p.ax, p.ay + liftY(k), p.az).project(camera); return [(tmp.x + 1) / 2 * VW, (1 - tmp.y) / 2 * VH]; },
    // 浮いた県が画面に占める箱 [左, 上, 右, 下]（天面の頂点を間引いて写す。県の横の吹き出しの置き場所に使う）
    screenBox(k) {
      const p = P[k], st = Math.max(1, Math.floor(p.nv / 300));
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let j = 0; j < p.nv; j += st) {
        const o = (p.v0 + j) * 3;
        if (!p.inFr(POS[o], POS[o + 2])) continue;
        tmp.set(POS[o], POS[o + 1] + liftY(k), POS[o + 2]).project(camera);
        const sx = (tmp.x + 1) / 2 * VW, sy = (1 - tmp.y) / 2 * VH;
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
      }
      return [x0, y0, x1, y1];
    },
    normals() {
      const n = G.top.attributes.normal.array; let zero = 0, down = 0;
      for (let i = 0; i < n.length; i += 3) { const L = Math.hypot(n[i], n[i + 1], n[i + 2]); if (L < 0.5) zero++; else if (n[i + 1] <= 0) down++; }
      return { zero, down, all: n.length / 3 };
    },
    hover(k) { hoverAt = null; setHover(k); },
    isleBoxes: () => isleBoxes,
    isles: () => ISLES.map((I) => ({ name: I.s.name, k: I.k, shown: I.mark.style.display !== 'none', open: I.bub.classList.contains('open'), pin: () => { I.pinned = !I.pinned; } })),
    // 検査用：開いている吹き出しの箱の中にある、浮いた県の陸の点の数（0＝隠していない）
    coverSel(i) {
      const I = ISLES[i]; if (sel < 0 || !I.bub.classList.contains('open')) return -1;
      const r = I.bub.getBoundingClientRect(), p = P[sel]; let n = 0;
      for (let j = 0; j < p.nv; j++) {
        const o = (p.v0 + j) * 3; tmp.set(POS[o], POS[o + 1] + liftY(sel), POS[o + 2]).project(camera);
        const sx = (tmp.x + 1) / 2 * VW, sy = (1 - tmp.y) / 2 * VH;
        if (sx > r.left && sx < r.right && sy > r.top && sy < r.bottom) n++;
      }
      return n;
    },
    get sel() { return sel; }, get hov() { return hov; },
    normalsUp() { const n = G.top.attributes.normal.array; let up = 0; for (let i = 1; i < n.length; i += 3) up += n[i] > 0; return up / (n.length / 3); },
  };
})();
