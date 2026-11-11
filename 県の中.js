// 県の中：県を押して「○○の中へ」で入る、細かい鳥瞰図（0.4km の地形・木・家・川・湖・鉄道・高速道路・地名）。
// 全国と同じ絵の具（地面の色の決まり・木と家の絵・川の線）で描くので、拡大の前と後で画風がそろう。
// 鳥瞰図には断面が無い：県の外も本物の地形のまま描き、県境から 12km かけて透けて、後ろの空と紙に溶ける
(function () {
  'use strict';
  const M = window.MAP3D;
  if (!M) return;
  // 川の線の幅（km）：集水 a km² から実の水面の幅の見当（2m×√a）。骨/県の中を作る.py の river_w と同じ式。遠くで細すぎる分は、線の絵の具が下限の画素の太さにする
  const riverW = (a) => Math.min(0.4, Math.max(0.006, 0.002 * Math.sqrt(a)));
  const FILES = Object.fromEntries(['群馬', '神奈川', '長野', '宮城', '山形', '岩手', '静岡', '愛知', '岐阜', '三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山', '栃木', '茨城', '東京', '埼玉', '千葉', '新潟', '富山', '石川', '福井', '山梨', '青森', '秋田', '福島', '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄', '北海道']
    .map((n) => [n, n + 'の中.js']));
  // 県ごとの決まり（2026-10-29 神奈川から）：
  //   famous＝遠くから見ても名前を出す山・湖（地図の骨。札.js でしまっても出す）。多いと札だらけに見えるので、県の代表だけ
  //   （本人 2026-10-29「中はマウスを当てなくても各テロップが出っ放し」→ 群馬は9つ出ていた）。一覧の無い県は、県の中の高い山5つ
  //   apple・ume＝りんご・梅の木を立てるあたり [経度, 緯度, 半径 km]、farm＝高原の畑（嬬恋のキャベツ）
  const AREAS = {
    '群馬': { famous: ['赤城山', '榛名山', '妙義山', '浅間山', '谷川岳', '尾瀬ヶ原'],
      apple: [139.05, 36.65, 7], ume: [138.92, 36.43, 6], farm: [138.53, 36.50, 10] },
    '神奈川': { famous: ['蛭ヶ岳', '大山', '神山', '芦ノ湖'], ume: [139.17, 35.30, 3] },
    '長野': { famous: ['槍ヶ岳', '奥穂高岳', '白馬岳', '乗鞍岳', '御嶽山', '駒ヶ岳', '浅間山', '赤岳', '諏訪湖'],
      apple: [138.30, 36.68, 16], farm: [138.57, 35.93, 9] },
    '宮城': { famous: ['栗駒山（須川岳）', '船形山', '蔵王山', '金華山', '泉ヶ岳'] },
    '山形': { famous: ['月山', '鳥海山', '蔵王山', '朝日岳', '飯豊山'] },
    '岩手': { famous: ['岩手山', '早池峰山', '八幡平', '姫神山', '焼石岳'] },
    '静岡': { famous: ['富士山', '天城山', '赤石岳', '聖岳', '愛鷹山'] }, '愛知': { famous: ['猿投山', '本宮山', '茶臼山'] },
    '岐阜': { famous: ['御嶽山', '乗鞍岳', '白山', '伊吹山', '金華山'] }, '三重': { famous: ['御在所岳', '藤原岳', '朝熊山'] },
    '滋賀': { famous: ['伊吹山', '武奈ヶ岳', '比叡山'] }, '京都': { famous: ['比叡山', '愛宕山'] }, '大阪': { famous: ['金剛山', '生駒山'] },
    '兵庫': { famous: ['六甲山', '氷ノ山', '摩耶山'] }, '奈良': { famous: ['八経ヶ岳', '若草山', '生駒山', '金剛山'] }, '和歌山': { famous: ['護摩壇山', '龍神岳'] },
    '栃木': { famous: ['男体山', '白根山', '那須岳', '女峰山', '中禅寺湖'] }, '茨城': { famous: ['筑波山', '加波山', '霞ヶ浦', '北浦'] },
    '埼玉': { famous: ['武甲山', '両神山', '雲取山', '秩父湖'] }, '千葉': { famous: ['鋸山', '清澄山', '愛宕山', '印旛沼'] },
    '新潟': { famous: ['妙高山', '八海山', '弥彦山', '火打山', '奥只見湖'] }, '富山': { famous: ['剱岳', '薬師岳', '黒部湖', '有峰湖'] },
    '石川': { famous: ['白山', '医王山', '宝達山', '河北潟'] }, '福井': { famous: ['荒島岳', '経ヶ岳', '冠山', '三方湖', '九頭竜湖'] },
    '山梨': { famous: ['富士山', '北岳', '駒ヶ岳', '金峰山', '河口湖', '本栖湖'] },
    '青森': { famous: ['岩木山', '八甲田山', '恐山', '白神岳', '小川原湖'] }, '秋田': { famous: ['鳥海山', '駒ヶ岳', '森吉山', '太平山', '田沢湖', '十和田湖'] },
    '福島': { famous: ['磐梯山', '安達太良山', '東吾妻山', '猪苗代湖', '桧原湖'] },
    '鳥取': { famous: ['大山', '氷ノ山（須賀ノ山）', '那岐山', '湖山池', '東郷池'] }, '島根': { famous: ['三瓶山', '恐羅漢山', '大満寺山', '宍道湖', '中海'] },
    '岡山': { famous: ['後山', '蒜山', '那岐山', '児島湖', '湯原湖'] }, '広島': { famous: ['恐羅漢山', '比婆山', '弥山', '芦田湖'] },
    '山口': { famous: ['寂地山', '羅漢山', '西鳳翩山', '菅野湖'] },
    '徳島': { famous: ['剣山', '三嶺', '眉山', '高越山'] }, '香川': { famous: ['飯野山（讃岐富士）', '象頭山', '五剣山（八栗山）', '満濃池'] },
    '愛媛': { famous: ['石鎚山', '瓶ヶ森', '東赤石山', '高縄山', '鹿野川湖'] }, '高知': { famous: ['工石山', '梶ヶ森', '不入山', 'さめうら湖'] },
    '福岡': { famous: ['英彦山', '脊振山', '福智山', '三郡山'] }, '佐賀': { famous: ['天山', '多良岳', '脊振山', '黒髪山'] },
    '長崎': { famous: ['雲仙岳', '多良岳', '八郎岳', '白嶽'] }, '熊本': { famous: ['阿蘇山', '金峰山', '市房山', '国見岳', '江津湖'] },
    '大分': { famous: ['くじゅう連山', '由布岳（豊後富士）', '鶴見岳', '両子山', '祖母山'] }, '宮崎': { famous: ['高千穂峰', '韓国岳', '尾鈴山', '祖母山'] },
    '北海道': { famous: ['旭岳', '羊蹄山', '利尻山', '羅臼岳', '十勝岳', '駒ヶ岳', '洞爺湖', '支笏湖', '摩周湖', '阿寒湖'] },   // 北海道は升 0.8km（ほかの県の4倍の広さ）
    '鹿児島': { famous:['御岳（北岳）', '開聞岳', '韓国岳', '宮之浦岳', '池田湖'] }, '沖縄': { famous: ['与那覇岳', '八重岳', '於茂登岳', '漫湖'] },   // 御岳（北岳）＝桜島
    '東京': { famous: ['高尾山', '大岳山', '三頭山', '奥多摩湖'] },   // 東京の中は本土だけ（伊豆諸島・小笠原は県の中を作る.py の minlat で外した）
  };
  const EXI = 5 / 1000;                  // 県の中の山の強め方（全国は10倍。9倍から下げて、空を飛ぶ間の本物に近い高さとの差を縮めた＝本人 2026-10-31）
  const FADE = 12;                       // 県境から透けきるまで km
  const $ = (s) => document.querySelector(s);
  const worlds = {};
  // 県の中の地図は、覚えておく数を決める（1県で形だけ最大 107MB。捨てないと、6県で 446MB・全国を回るとスマホのタブが落ちる。2026-11-07）。入り直しは幕の裏で作り直す
  const KEEP = M.phone() || (navigator.deviceMemory || 8) <= 4 ? 1 : 3, kept = [];
  const btn = $('#c-enter');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  M.on('world', (w) => {
    $('#title b').textContent = w ? w.name : '日本';
    if (M.sel >= 0) btn.textContent = w ? '空から遊覧する' : M.P[M.sel].name + 'の中へ';
  });
  M.on('select', (k) => {
    const n = M.P[k].name;
    btn.textContent = FILES[n] ? n + 'の中へ' : 'この県の中へ（これから）';
    btn.disabled = !FILES[n];
  });
  btn.addEventListener('click', async () => {
    const k = M.sel;
    if (k >= 0 && M.inside) { if (window.YURAN) YURAN.start(); return; }
    if (k < 0) return;
    const n = M.P[k].name;
    if (!FILES[n]) return;
    // 初めて入る時は地図を組み立てる（CPU が遅い端末で 0.3 秒ほど止まる）。先に幕を下ろし、その裏で組み立てる
    btn.disabled = true;
    try {
      if (!worlds[n]) {
        await new Promise((ok) => M.veil(true, ok, n + 'の地図をひろげています…'));
        while (kept.length >= KEEP) {
          const o = kept.shift();
          M.forget(worlds[o]); worlds[o].dispose(); delete worlds[o]; delete window.KEN_IN[o];
        }
        worlds[n] = await make(n);
      } else kept.splice(kept.indexOf(n), 1);
      kept.push(n);
      M.enter(worlds[n]);
    } catch (e) {
      console.error(e); M.veil(false); btn.textContent = '開けませんでした（' + e.message + '）';
    }
    btn.disabled = false;
  });

  // ---------------------------------------------------------------- 県の横の吹き出し「〇〇の中へ」（本人 2026-10-27「入るボタンが一覧にしかない。マップのすぐ横にも」）
  // 中の地図がある県を浮かせた時だけ出す。置き場所は浮いた県の上→右→左の順に、検索・題・札の窓にかからない所（県そのものは隠さない）。
  // 前の置き場所が使えるうちは変えない（動かすたびに跳ねないように）。画面の部品の位置は、開いた時と画面の大きさが変わった時だけ測る
  const bub = $('#enter-bub');
  let bw = 0, bh = 0, side = '', lim = null, loose = false;
  const measure = () => {
    const top = Math.max(0, ...['#search', '#title', '#deai-open', '#mame-open', '#compass'].map((q) => $(q)).filter((e) => e && e.offsetWidth)
      .map((e) => { const r = e.getBoundingClientRect(); return r.top < innerHeight / 3 ? r.bottom : 0; }));
    const c = $('#card').classList.contains('open') ? $('#card').getBoundingClientRect() : null, sheet = M.phone(), z = $('#zoom');
    // ＋－のボタン（指で触る端末だけ）は、上の段にせず避ける物に入れる（上の段にすると iPhone SE で置き場が狭まり、吹き出しが印にかかった）
    const zr = z && z.offsetWidth ? z.getBoundingClientRect() : null;
    lim = { top: top + 8, left: 6, right: c && !sheet ? c.left - 8 : innerWidth - 6, bottom: c && sheet ? c.top - 8 : innerHeight - 90,
      keep: zr ? [[zr.left - 6, zr.top - 6, zr.right + 6, zr.bottom + 6]] : [] };
  };
  // 測るのは、中の地図がある県だけ・浮き上がりの途中を避けて手の空いた時に（押した直後に測ると、せり上がりのコマが CPU4倍で 50ms 止まった）
  M.on('select', (k) => {
    side = ''; lim = null; bw = 0;
    if (!FILES[M.P[k].name]) return;
    bub.textContent = M.P[k].name + 'の中へ ›';
    setTimeout(() => (window.requestIdleCallback || setTimeout)(() => {
      if (M.sel !== k) return;
      bub.style.visibility = 'hidden'; bub.style.display = 'block';
      measure(); bw = bub.offsetWidth; bh = bub.offsetHeight;
    }), 450);
  });
  addEventListener('resize', () => { lim = null; if (M.sel >= 0) requestAnimationFrame(measure); });
  bub.addEventListener('click', () => btn.click());
  M.on('frame', () => {
    const k = M.sel, cl = document.body.classList;
    const on = k >= 0 && lim && bw && !M.inside && FILES[M.P[k].name] && !btn.disabled && !cl.contains('touring') && !cl.contains('flying') && !cl.contains('opening')
      && M.lift(k) > M.LIFT * 0.6;
    if (!on) { if (bub.style.display !== 'none') bub.style.display = 'none'; side = ''; M.bubRect = null; return; }
    const [x0, y0, x1, y1] = M.screenBox(k), cy = (y0 + y1) / 2, cx = (x0 + x1) / 2;
    // 候補：県の上（重なる時は左右へずらす）→右→左。名物の札（案内.js の印）にも重ねない（スマホで「草津温泉」の札の字を隠した）
    const at = { right: [x1 + 14, cy - bh / 2], left: [x0 - bw - 14, cy - bh / 2] };
    for (const dx of [0, 40, -40, 80, -80, 120, -120]) at['up' + dx] = [cx - bw / 2 + dx, y0 - bh - 14];
    // 県の下も候補に（2026-10-31 山の強め方を下げたら、スマホの群馬で上と左右がどれも名物の札にかかった）
    for (const dx of [0, 40, -40, 80, -80]) at['down' + dx] = [cx - bw / 2 + dx, y1 + 14];
    // 避ける物：印の札の取り置き（名前を隠した印も、名前の場所ごと）と、島の拡大図の吹き出し（尖閣・竹島）。
    // 取り置きで空きが無い時（小さいスマホで札の窓の上が埋まる）は、いま見えている印の部分（案内.js の pinMarks）だけを避ける
    const isl = (M.isleBoxes ? M.isleBoxes() : []).concat(lim.keep), strict = (M.pinRects || []).concat(isl), seen = (M.pinMarks || []).concat(isl);
    const fits = ([x, y]) => x >= lim.left && x + bw <= lim.right && y >= lim.top && y + bh <= lim.bottom;
    const inLim = ([x, y]) => [clamp(x, lim.left, Math.max(lim.left, lim.right - bw)), clamp(y, lim.top, Math.max(lim.top, lim.bottom - bh))];
    const free = (s, L = strict) => { const [x, y] = inLim(at[s]); const [ox, oy] = M.screenOf(k);
      return !L.some((r) => x < r[2] && x + bw > r[0] && y < r[3] && y + bh > r[1]) && !(ox > x && ox < x + bw && oy > y && oy < y + bh); };
    // 選ぶ順：そのまま置けて空いている所 → 画面の中へ押しこめば空いている所（スマホは県の上に題と方位が迫る）→ 見えている印だけを避けて同じ順 → そのまま置ける所 → 県の上
    const order = Object.keys(at).sort((a, b) => (a.startsWith('up') ? 0 : 1) - (b.startsWith('up') ? 0 : 1));
    if (!side || !at[side] || !free(side, loose ? seen : strict)) {
      side = order.find((s) => fits(at[s]) && free(s)) || order.find((s) => free(s)) || '';
      loose = !side;
      if (!side) side = order.find((s) => fits(at[s]) && free(s, seen)) || order.find((s) => free(s, seen)) || order.find((s) => fits(at[s])) || 'up0';
    }
    const [x, y] = inLim(at[side]);
    M.bubRect = [x, y, x + bw, y + bh];
    bub.className = side.startsWith('up') ? 's-up' : side.startsWith('down') ? 's-down' : 's-' + side;
    bub.style.setProperty('--ax', clamp(cx - x, 14, bw - 14).toFixed(1) + 'px');     // 上に置いた時の三角は、県の真ん中の方へ
    bub.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    if (bub.style.display !== 'block' || bub.style.visibility) { bub.style.display = 'block'; bub.style.visibility = ''; }
  });

  function load(src) {
    return new Promise((ok, ng) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => ng(new Error(src + ' が読めません'));
      document.head.appendChild(s);
    });
  }
  async function inflate(b64) {
    const s = atob(b64), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  }

  // ---------------------------------------------------------------- 地面の絵の具（全国の天面と同じ色の決まり＋県の外を溶かす）
  const VS_GROUND = `
    attribute float aH, aF, aS; uniform float uInY;
    varying vec3 vN, vW; varying float vH, vF, vS, vDist;
    void main() {
      vec3 p = vec3(position.x, position.y * uInY, position.z);
      vN = normal; vW = p; vH = aH; vF = aF; vS = aS;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const FS_GROUND = (X) => `
    ${X.FINISH}
    ${X.GROUND}
    uniform vec3 uPaper; uniform float uPop; uniform sampler2D uPal;
    varying vec3 vN, vW; varying float vH, vF, vS, vDist;
    // 人口の表示：1km² あたりの世帯数で、淡い黄 → 山吹 → 橙 → 朱（家の絵と同じ国勢調査の数）
    vec3 popTint(vec3 c) {
      float hh = texture2D(uTown, (vW.xz - uTownBox.xy) / uTownBox.zw).r * 255.0 * 20.0 / 0.16;
      vec3 r = vec3(0.95, 0.91, 0.72);
      r = mix(r, vec3(0.95, 0.85, 0.47), smoothstep(50.0, 500.0, hh));
      r = mix(r, vec3(0.94, 0.66, 0.30), smoothstep(500.0, 1500.0, hh));
      r = mix(r, vec3(0.86, 0.43, 0.20), smoothstep(1500.0, 3000.0, hh));
      r = mix(r, vec3(0.70, 0.18, 0.13), smoothstep(3000.0, 6000.0, hh));
      float lum = dot(c, vec3(0.3, 0.59, 0.11));
      return mix(vec3(lum) * 0.55 + 0.42, r, smoothstep(30.0, 120.0, hh) * 0.85);
    }
    void main() {
      vec3 c = ground(vW, vH, normalize(vN));
      // 海（標高タイルの「データ無し」の升。県の中を作る.py）：湖と同じ水の色にさざ波、岸に墨の線
      if (vS > 0.01) {
        vec3 w = texture2D(uPal, vec2(23.5 / 32.0, (uSeason + 0.5) / 4.0)).rgb;
        w = mix(w, vec3(1.0), 0.12 + 0.05 * sin(vW.x * 7.0 + vW.z * 3.0));
        // 波の印（全国の海と同じ流儀）：小さな弧が漂い、現れては消える。岸の白波は寄せては返す
        vec2 q = vW.xz / 1.2 + vec2(uTime * 0.03, 0.0), id = floor(q), f = fract(q) - 0.5;
        float px = length(fwidth(q));
        vec2 g = f - (vec2(hash2(id), hash2(id + 5.3)) - 0.5) * 0.4;
        float arc = abs(length(g - vec2(0.0, 0.12)) - 0.16);
        float on = (1.0 - smoothstep(0.0, px * 1.2 + 0.01, arc - 0.012)) * step(g.y, 0.08) * step(hash2(id + 2.1), 0.3)
          * (0.5 + 0.5 * sin(uTime * 0.8 + hash2(id + 9.7) * 6.283));
        w = mix(w, vec3(1.0), on * 0.6 * smoothstep(0.75, 1.0, vS) * (1.0 - smoothstep(0.05, 0.11, px)));
        float foam = 1.0 - smoothstep(0.0, 0.07, abs(vS - (0.6 + 0.2 * (0.5 + 0.5 * sin(uTime * 1.1 + vW.x * 0.7 + vW.z * 0.4)))));
        w = mix(w, vec3(1.0), foam * 0.45);
        c = mix(c, w, smoothstep(0.35, 0.65, vS));
        c = mix(c, uInk, (1.0 - smoothstep(0.0, fwidth(vS) * 1.5 + 1e-4, abs(vS - 0.5))) * 0.55);
      }
      if (uPop > 0.5) c = popTint(c);
      c = finish(mix(c, uPaper, (1.0 - vF) * 0.45), vec3(0.0), vDist) + lights(vW, vDist);
      gl_FragColor = vec4(c * vF, vF);
    }`;

  // ---------------------------------------------------------------- 電車
  // 路線（地理院の鉄道の切れ端を、トンネルも含めてつないだ物。県の中を作る.py の join_rails）の上を往復する。トンネルの中と、県の外（紙に溶ける所）では隠す。
  // 高さは、作る時に路線ごとにならした「線路の高さ」（地図の線路の絵も同じ高さ。本人 2026-10-27「山岳地帯で路線図とずれる」）。
  // 駅ごとに短く止まる（本人「駅でいちいち止まりながら。止まる時間は短くていい」）。新幹線は新幹線の駅だけ（国土数値情報の駅）。
  // 新幹線は6両で、先頭と最後尾は長い鼻・速い（本人「新幹線は車両変えよう 速度も早めに」）。JR の在来線は4両（クリームに緑と橙の帯）、
  // 私鉄は2両（白に青の帯）。地図に合わせて大きめ（1両 0.32km）。全部の車両を2回（箱の車両・新幹線の鼻）で描き、毎コマ動かすのは位置だけ
  const CAR = 0.32, CAR_S = 0.36, GAP = 0.03, NOSE = 0.17;
  const SPEC = [{ cars: 2, v: 0.11, a: 0.05 }, { cars: 4, v: 0.16, a: 0.06 }, { cars: 6, v: 0.95, a: 0.22 }];   // 種類（0＝私鉄・1＝JR・2＝新幹線）ごとの両数・速さ（km/秒）・加速
  // 車両の種類（v。県の中を作る.py の VTYPE）：3 路面電車・4 ぶら下がるモノレール・5 またがるモノレール・6 ケーブルカー・7 新交通。
  // 実物の塗装は写さず、種類が分かる記号の色と形で（本人 2026-10-29「シンボル的にわかるように」。権利と、塗装が変わる手間のため）
  // 9 観光の SL（機関車＋旧型客車4両・ゆっくり）
  const VSPEC = { 3: { cars: 1, v: 0.05, a: 0.04 }, 4: { cars: 2, v: 0.10, a: 0.05 }, 5: { cars: 3, v: 0.10, a: 0.05 }, 6: { cars: 1, v: 0.03, a: 0.02 }, 7: { cars: 3, v: 0.09, a: 0.05 }, 9: { cars: 5, v: 0.06, a: 0.02 } };
  const VCOL = { 3: [[0.96, 0.92, 0.80], [0.22, 0.50, 0.36], [0.55, 0.55, 0.52]], 4: [[0.97, 0.97, 0.97], [0.20, 0.45, 0.75], [0.85, 0.85, 0.85]],
    5: [[0.97, 0.97, 0.97], [0.20, 0.45, 0.75], [0.85, 0.85, 0.85]], 6: [[0.90, 0.32, 0.20], [0.96, 0.90, 0.78], [0.60, 0.60, 0.60]], 7: [[0.97, 0.97, 0.97], [0.12, 0.62, 0.62], [0.80, 0.80, 0.80]],
    9: [[0.10, 0.10, 0.11], [0.62, 0.14, 0.10], [0.16, 0.16, 0.17]], 10: [[0.42, 0.24, 0.15], [0.30, 0.17, 0.11], [0.34, 0.34, 0.33]] };   // 9 SL の機関車（黒に赤）・10 客車（ぶどう色）
  const SL_FIRST = 5, SL_REST = 150;                   // SL：入ってから最初に出るまでの秒・端に着いてから次に出るまでの秒（数分に1回）
  const DWELL = 1.6, TURN = 2.6;                        // 駅で止まる秒・終点で折り返すまでの秒
  const VS_TRAIN = `
    attribute vec3 aBody, aBand, aRoof; attribute float aT;
    varying vec3 vBody, vBand, vRoof, vP, vN, vNw; varying float vDist, vT;
    void main() {
      vBody = aBody; vBand = aBand; vRoof = aRoof; vP = position; vN = normal; vNw = mat3(instanceMatrix) * normal; vT = aT;
      vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const FS_TRAIN = (X) => `
    ${X.FINISH}
    uniform vec3 uLdir;
    varying vec3 vBody, vBand, vRoof, vP, vN, vNw; varying float vDist, vT;
    void main() {
      // 箱の中の座標：幅 ±0.0375・高さ 0〜0.06。上を向いた面は屋根の色（新幹線は鼻の上も空色）、側面の下 4割は帯、上の帯に窓（夜は灯る）。
      // vT＝新幹線の鼻の中の位置（0＝胴・1＝鼻先）。鼻の運転台の窓は黒いガラス
      float h = vP.y / 0.06, side = step(0.5, abs(vN.x)) * step(vT, 0.001);
      vec3 c = (vN.y > 0.45 || h > 0.9) ? vRoof : h < 0.4 ? vBand : vBody;
      float win = side * step(0.5, h) * step(h, 0.82) * step(0.35, fract(vP.z / 0.034 + 0.5));
      float cab = step(0.06, vT) * step(vT, 0.34) * step(0.42, h);
      c = mix(c, vec3(0.26, 0.33, 0.42), win);
      c = mix(c, vec3(0.13, 0.17, 0.24), cab);
      c *= 0.8 + 0.25 * max(dot(normalize(vNw), uLdir), 0.0);
      c = finish(c, vec3(0.0), vDist) + vec3(1.0, 0.8, 0.45) * (win + cab * 0.5) * uNight * 0.9;
      gl_FragColor = vec4(c, 1.0);
    }`;
  function makeTrains(list, X, T, U, dAt, fadeOf, onStop, kanko) {
    // 路線は、県の外（紙に溶ける所）を切り落として区間に分ける（県の外を走る電車が6割あまり、描かないのに動かしていた）。
    // 点は [x, z, トンネルの中か, 線路の高さ m]。駅は路線の上の距離で持ち、区間の中の物だけを区間の距離に直す
    const lines = [];
    for (const L of list) {
      const p = L.p, S = L.st.map(([s]) => s / 100);
      let cumAll = 0, prev = null, piece = null;
      const flush = () => {
        if (piece && piece.P.length >= 2) {
          piece.len = piece.cum[piece.cum.length - 1];
          piece.stops = S.map((s) => s - piece.s0).filter((s) => s >= 0 && s <= piece.len);
          const inP = L.st.filter(([s]) => s / 100 - piece.s0 >= 0 && s / 100 - piece.s0 <= piece.len);
          piece.names = inP.map(([, n]) => n);
          piece.ids = inP.map(([, , id]) => id);           // 県の中の駅の番号（県の外の駅は -1）
          lines.push(piece);
        }
        piece = null;
      };
      for (let q = 0; q + 3 < p.length; q += 4) {
        const x = p[q] / 100, z = p[q + 1] / 100;
        if (prev) cumAll += Math.hypot(x - prev[0], z - prev[1]);
        prev = [x, z];
        if (fadeOf(dAt(x, z)) < 0.3) { flush(); continue; }
        if (!piece) piece = { jr: L.k, vt: L.v || 0, sl: L.sl, P: [], cum: [], s0: cumAll };
        piece.P.push([x, z, p[q + 2], p[q + 3]]); piece.cum.push(cumAll - piece.s0);
      }
      flush();
    }
    // 列車：路線 22km ごとに1本。置く所・向き・速さは決まったくじで（開くたびに同じ）。c＝列車の真ん中の、路線の上の距離
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const runs = [];
    for (const l of lines) {
      if (l.sl) continue;                               // 観光列車だけの路線（県の中を作る.py の rail_route）には、普通の電車を走らせない
      const sp = VSPEC[l.vt] || SPEC[l.jr], lc = l.jr === 2 ? CAR_S : l.vt === 3 ? CAR * 0.7 : l.vt === 6 ? CAR * 0.8 : CAR, tl = sp.cars * (lc + GAP);
      if (l.len < tl + 1) continue;
      const n = Math.max(1, Math.round(l.len / 22));
      for (let i = 0; i < n; i++) {
        const vmax = sp.v * (0.85 + rnd() * 0.3);
        runs.push({ l, cars: sp.cars, lc, tl, c: tl / 2 + (l.len - tl) * (i + rnd() * 0.6) / n, dir: rnd() < 0.5 ? 1 : -1, vmax, v: vmax, a: sp.a, wait: 0, flip: false });
      }
    }
    // 観光の SL（本人 2026-10-30「SLも走らせて」）：観光列車.json に運行区間を確かめて入れた線だけ。両端の駅を通る JR の区間を、
    // 途中の駅には止まらずゆっくり走り、端に着くと SL_REST 秒姿を消してから折り返す（毎日・一日中走る列車ではないので）
    for (const k of kanko || []) {
      const l = lines.find((q) => q.sl === k.name) || lines.find((q) => q.jr === 1 && !q.sl && q.names.includes(k.from) && q.names.includes(k.to));
      if (!l) continue;
      // 専用の道筋は from から to へ引いてあるので、両端をそのまま使う（端の駅が止まる駅に数えられないことがあり、位置が NaN になった）
      const a = l.sl ? 0 : l.stops[l.names.indexOf(k.from)], b = l.sl ? l.len : l.stops[l.names.indexOf(k.to)], sp = VSPEC[9], tl = sp.cars * (CAR + GAP);
      if (!(a >= 0 && b >= 0) || Math.abs(a - b) < tl + 1) continue;
      runs.push({ l, cars: sp.cars, lc: CAR, tl, c: Math.min(a, b) + tl / 2, dir: a < b ? 1 : -1, vmax: sp.v, v: 0, a: sp.a, wait: SL_FIRST, flip: false,
        sl: { lo: Math.min(a, b), hi: Math.max(a, b), name: k.name } });
    }
    // 箱の車両（在来線・新幹線の中の車両）と、新幹線の鼻の車両（先頭と最後尾）
    const nNose = runs.filter((r) => r.l.jr === 2).length * 2, nBox = runs.reduce((a, r) => a + r.cars, 0) - nNose;
    const gBox = new T.BoxGeometry(0.075, 0.06, CAR);
    gBox.translate(0, 0.03, 0);
    gBox.setAttribute('aT', new T.BufferAttribute(new Float32Array(gBox.attributes.position.count), 1));
    // 鼻：前の NOSE km を、鼻先へ向かって低く・細く絞る（屋根は前へなだれ、横は丸く）
    const gNose = new T.BoxGeometry(0.075, 0.06, CAR_S, 2, 3, 14);
    gNose.translate(0, 0.03, 0);
    const pa = gNose.attributes.position, tA = new Float32Array(pa.count), z0 = CAR_S / 2 - NOSE;
    for (let i = 0; i < pa.count; i++) {
      const z = pa.getZ(i), t = clamp((z - z0) / NOSE, 0, 1);
      pa.setY(i, pa.getY(i) * (1 - 0.74 * Math.pow(t, 1.4)));
      pa.setX(i, pa.getX(i) * (1 - 0.5 * t * t));
      tA[i] = t;
    }
    gNose.computeVertexNormals();
    gNose.setAttribute('aT', new T.BufferAttribute(tA, 1));
    const colors = (g, n) => ['aBody', 'aBand', 'aRoof'].map((a) => { const b = new Float32Array(n * 3); g.setAttribute(a, new T.InstancedBufferAttribute(b, 3)); return b; });
    const [bBody, bBand, bRoof] = colors(gBox, nBox), [nBody, nBand, nRoof] = colors(gNose, nNose);
    const mat = X.mat(VS_TRAIN, FS_TRAIN(X));
    const box = new T.InstancedMesh(gBox, mat, Math.max(nBox, 1)), nose = new T.InstancedMesh(gNose, mat, Math.max(nNose, 1));
    for (const m of [box, nose]) { m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; }
    let ob = 0, on = 0;
    for (const r of runs) for (let c = 0; c < r.cars; c++) {
      const k = r.l.jr, isN = k === 2 && (c === 0 || c === r.cars - 1);
      r.slot = r.slot || [];
      r.slot.push(isN ? ['n', on] : ['b', ob]);
      const [B0, B1, B2, o] = isN ? [nBody, nBand, nRoof, on++] : [bBody, bBand, bRoof, ob++];
      const vc = r.sl ? VCOL[c === 0 ? 9 : 10] : VCOL[r.l.vt];
      B0.set(vc ? vc[0] : k === 2 ? [0.96, 0.97, 0.98] : k ? [0.93, 0.91, 0.85] : [0.95, 0.95, 0.95], o * 3);
      B1.set(vc ? vc[1] : k === 2 ? [0.69, 0.45, 0.30] : k ? (c % 2 ? [0.88, 0.48, 0.18] : [0.18, 0.55, 0.34]) : [0.23, 0.44, 0.71], o * 3);
      B2.set(vc ? vc[2] : k === 2 ? [0.36, 0.66, 0.88] : [0.62, 0.62, 0.60], o * 3);
    }
    const mesh = new T.Group();
    mesh.add(box, nose);
    // SL の煙：機関車の煙突から後ろへ流れる白い玉（1本に PUFF 個）。夜は暗く
    const slRuns = runs.filter((r) => r.sl), PUFF = 7;
    const puffMat = new T.MeshBasicMaterial({ color: 0xf2efe8, transparent: true, opacity: 0.85, depthWrite: false });
    const puffs = new T.InstancedMesh(new T.SphereGeometry(0.03, 8, 6), puffMat, Math.max(slRuns.length * PUFF, 1));
    puffs.frustumCulled = false; puffs.instanceMatrix.setUsage(T.DynamicDrawUsage); puffs.count = slRuns.length * PUFF;
    mesh.add(puffs);
    // 路線の上の距離 s の点（x, z, トンネルの中か, 線路の高さ m）
    const at = (l, s) => {
      let a = 0, b = l.cum.length - 1;
      s = Math.min(Math.max(s, 0), l.len);
      while (b - a > 1) { const m = (a + b) >> 1; if (l.cum[m] <= s) a = m; else b = m; }
      const t = (s - l.cum[a]) / Math.max(l.cum[b] - l.cum[a], 1e-9), A = l.P[a], B = l.P[b];
      return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] && B[2], A[3] + (B[3] - A[3]) * t];
    };
    // 進む：次に止まる所（進む向きの先の駅か、終点）までの残りで減速し、着いたら少し止まる。終点では向きを変える
    function move(r, dt) {
      const lo = r.sl ? r.sl.lo + r.tl / 2 : r.tl / 2, hi = r.sl ? r.sl.hi - r.tl / 2 : r.l.len - r.tl / 2;
      if (r.wait > 0) {
        r.wait -= dt;
        if (r.wait > 0) return;
        // 折り返しは、止まった時の並びのまま逆向きに走る（並びごと前後を入れ替えると、1両ずつ向きを変えたように見えた。本人 2026-10-30）。
        // SL は端で姿を消している間に向きを戻し、次も機関車が先頭
        if (r.flip) { r.dir = -r.dir; r.flip = false; r.rev = r.sl ? false : !r.rev; }
        r.v = 0;
      }
      // 次の駅：進む向きの先（いま出発した駅は番号で外す。距離の幅で外すと、駅の手前の幅の所で行き先が次の駅へ替わり、どの駅にも止まらなかった）
      let next = r.dir > 0 ? hi : lo, end = true, si = -1;
      if (!r.sl) r.l.stops.forEach((s, i) => { if (i !== r.left && s > lo && s < hi && (s - r.c) * r.dir >= 0 && Math.abs(s - r.c) < Math.abs(next - r.c)) { next = s; end = false; si = i; } });
      const d = Math.abs(next - r.c);
      r.v = Math.min(r.vmax, r.v + r.a * dt, Math.sqrt(2 * r.a * d));
      const m = r.v * dt;
      if (m >= d) {
        r.c = next; r.v = 0; r.wait = end ? (r.sl ? SL_REST : TURN) : DWELL; r.flip = end; r.left = end ? -1 : si;
        // 終点では、端のすぐ手前にある駅（終着駅。列車の長さの半分より端に近いので、途中の駅としては数えない）に着いたことにする
        if (end) si = r.l.stops.findIndex((s) => Math.abs(s - next) <= r.tl / 2 + 0.3);
        if (end) r.nTurn = (r.nTurn || 0) + 1; else r.nStop = (r.nStop || 0) + 1;
        if (si >= 0 && r.l.ids[si] >= 0 && onStop) onStop(r.l.ids[si], r.l.jr);    // 駅の札を光らせる（駅に着いた）
      } else r.c += r.dir * m;
    }
    const m4 = new T.Matrix4(), qt = new T.Quaternion(), eu = new T.Euler(0, 0, 0, 'YXZ'), pos = new T.Vector3(), sc = new T.Vector3();
    const where = [];                                   // 検査用：車両ごとの [x, z, 隠れているか, 種類, 前端の s]
    let last = performance.now(), frozen = false, smokeT = 0;
    function step() {
      // 低く飛ぶ間（uNearK）は、電車を実の大きさの見当（1両 約26m）へ縮め、速さも実際に近く（地図の大きさのままだと、1軒ずつの家の30倍の長さだった）
      const nk = U.uNearK.value, f = 1 - 0.92 * nk;
      const now = performance.now(), dt = (frozen ? 0 : Math.min(0.1, (now - last) / 1000)) * (1 - 0.8 * nk), k = U.uInY.value;
      smokeT += frozen ? 0 : (now - last) / 1000;
      last = now;
      let o = 0;
      for (const r of runs) {
        move(r, dt);
        for (let c = 0; c < r.cars; c++, o++) {
          const k2 = r.rev ? r.cars - 1 - c : c;           // 進む向きの先頭から何両目か（折り返した後は、元の最後尾が先頭）
          const front = r.c + r.dir * (r.tl * f / 2 - k2 * (r.lc + GAP) * f), back = front - r.dir * r.lc * f;
          const A = at(r.l, front), B = at(r.l, back), mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
          const hide = !!(A[2] || B[2]) || fadeOf(dAt(mx, mz)) < 0.3 || (r.sl && r.wait > 0);     // SL は端で休む間は姿を消す
          const [kind, i] = r.slot[c], tail = kind === 'n' && k2 > 0;
          // 向き：前（A）へ。坂では車両も傾ける（線路の高さに沿う）。最後尾の鼻は後ろ向き
          const dx = A[0] - B[0], dz = A[1] - B[1], dy = (A[3] - B[3]) * EXI * k;
          eu.set((tail ? 1 : -1) * Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz) + (tail ? Math.PI : 0), 0);
          qt.setFromEuler(eu);
          pos.set(mx, (A[3] + B[3]) / 2 * EXI * k + (r.l.vt === 4 ? -0.075 : 0.02) * f, mz);     // ぶら下がるモノレールは線路の下に吊るす
          if (hide) sc.setScalar(0); else if (kind === 'n') sc.set(1, 0.92, 1); else if (r.l.jr === 2) sc.set(1, 0.92, CAR_S / CAR); else if (r.lc !== CAR) sc.set(1, 1, r.lc / CAR); else sc.setScalar(1);
          sc.multiplyScalar(f);
          (kind === 'n' ? nose : box).setMatrixAt(i, m4.compose(pos, qt, sc));
          where[o] = [mx, mz, hide, r.l.jr, front, (A[3] + B[3]) / 2];
          if (r.sl && c === 0) { const L = Math.hypot(dx, dz) || 1; r.head = [mx, pos.y, mz, dx / L, dz / L, hide]; }
        }
      }
      box.instanceMatrix.needsUpdate = true; nose.instanceMatrix.needsUpdate = true;
      if (!slRuns.length) return;
      // 煙の時刻も、電車を止める間（freeze）は止める（本物の時刻で流すと、止めた眺めを2回撮る検査に煙が差として混ざった。2026-11-07）
      const t = smokeT;
      puffMat.color.setScalar(1 - 0.65 * U.uNight.value);
      slRuns.forEach((r, j) => {
        const [hx, hy, hz, fx, fz, off] = r.head || [0, 0, 0, 0, 1, true];
        for (let p = 0; p < PUFF; p++) {
          const age = (t * 0.8 + p / PUFF) % 1, s = off ? 0 : (0.6 + 1.8 * age) * Math.min(1, (1 - age) / 0.2);
          pos.set(hx - fx * (0.1 + age * 0.35) * f, hy + (0.09 + age * 0.14) * f, hz - fz * (0.1 + age * 0.35) * f);
          puffs.setMatrixAt(j * PUFF + p, m4.compose(pos, qt.identity(), sc.setScalar(s * f)));
        }
      });
      puffs.instanceMatrix.needsUpdate = true;
    }
    step();
    // freeze：検査の間だけ止める（画面を2回撮って比べる検査に、電車の動きが差として混ざった）
    return { mesh, step, runs, cars0: () => where.map((w) => [w[0], w[1], w[2], w[4], w[3], w[5]]), freeze: (v) => { frozen = !!v; },
      state: () => runs.map((r) => ({ kind: r.l.jr, vt: r.l.vt, sl: r.sl && r.sl.name, c: r.c, v: r.v, wait: r.wait, stops: r.l.stops.slice(), names: r.l.names, ids: r.l.ids, len: r.l.len, tl: r.tl, nStop: r.nStop || 0, nTurn: r.nTurn || 0 })) };
  }

  // 森の樹冠の模様（map3d.js の地面の絵の具が拾う）：8×8 の冠を、端でつながる 256 画素の画像に一度だけ焼く
  function crownTex(T) {
    const N = 256, C = 8, cells = [], data = new Uint8Array(N * N * 4), rnd = (a, b) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) cells.push({ x: (i + 0.5 + (rnd(i, j) - 0.5) * 0.55) / C, y: (j + 0.5 + (rnd(i + 50, j) - 0.5) * 0.55) / C, r: (0.5 + 0.2 * rnd(i, j + 50)) / C, v: rnd(i + 90, j + 90) });
    const wrap = (d) => d - Math.round(d);
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const u = (px + 0.5) / N, v = (py + 0.5) / N, ci = Math.floor(u * C), cj = Math.floor(v * C);
      let best = 9, bx = 0, by = 0, bv = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const c = cells[((cj + dj + C) % C) * C + ((ci + di + C) % C)], dx = wrap(u - c.x) / c.r, dy = wrap(v - c.y) / c.r, d = Math.hypot(dx, dy);
        if (d < best) { best = d; bx = dx; by = dy; bv = c.v; }
      }
      const o = (py * N + px) * 4;
      data[o] = bv * 255; data[o + 1] = (Math.max(-1, Math.min(1, bx)) * 0.5 + 0.5) * 255; data[o + 2] = (Math.max(-1, Math.min(1, by)) * 0.5 + 0.5) * 255; data[o + 3] = Math.min(1, best / 1.2) * 255;
    }
    const t = new T.DataTexture(data, N, N, T.RGBAFormat, T.UnsignedByteType);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
    return t;
  }

  async function make(name) {
    // 名所・山と湖の一言と豆知識の文（県ごとのファイル）も、地図と並べて読む。読めなくても地図は開く（一言の無い札になる）
    const intro = M.loadIntro ? M.loadIntro(M.P.find((p) => p.name === name).n).catch(() => {}) : null;
    if (!(window.KEN_IN && window.KEN_IN[name])) await load(FILES[name]);
    await intro;
    const D = window.KEN_IN[name], X = M.inner, T = X.T, U = X.U, DR = M.draw;
    // 寄せた島（骨/県の中を作る.py の move。本人 2026-11-01「海上の距離の縮尺を縮めて、同じマップ内で見られるように」）：
    // 本当の場所（src）にある点を、寄せた所へ同じだけ動かす。紹介・目印・豆知識の点は全国の位置で持つので、県の中にいる間だけ寄せる
    // （下の warpIn・warpOut。全国の眺めは本当の位置のまま）。at0＝寄せる前の位置（入っている間に組み立てても二重に寄せない）
    const MV = D.move || [], PK = M.P.find((p) => p.name === name);
    const wp = (x, z) => { for (const m of MV) if (x >= m.src[0] && x <= m.src[2] && z >= m.src[1] && z <= m.src[3]) return [x + m.dx, z + m.dz]; return [x, z]; };
    const at0 = (e) => e._mv || [e.x, e.z];
    if (U.uCrown.value === U.uLand.value) U.uCrown.value = crownTex(T);
    const buf = await inflate(D.bin);
    // 川の線と水面は、縮めた2進の中の差の並び（骨/県の中を作る.py の deltas）。初めて入る時に、点の並びの形へ戻す
    if (typeof D.rivers[0] === 'number') {
      const unpack = (o, k) => {
        const A = new Int32Array(buf, o[0], o[1]);
        let i = 0;
        const line = () => {
          const n = A[i++], L = new Array(n * k);
          let x = 0, z = 0;
          for (let p = 0; p < n; p++) {
            x += A[i++]; z += A[i++]; L[p * k] = x; L[p * k + 1] = z;
            for (let e = 2; e < k; e++) L[p * k + e] = A[i++];
          }
          return L;
        };
        const out = new Array(A[i++]);
        for (let j = 0; j < out.length; j++) {
          if (k === 3) { out[j] = line(); continue; }
          const rs = Array.from({ length: A[i++] }, line);
          out[j] = rs.length === 1 ? rs[0] : rs;
        }
        return out;
      };
      D.rivers = unpack(D.rivers, 3); D.lakes = unpack(D.lakes, 2);
    }
    const W = D.w, H = D.h, cell = D.cell;
    const E = new Uint16Array(buf, D.hgt[0], D.hgt[1]), DI = new Int8Array(buf, D.dist[0], D.dist[1]), HH = new Uint16Array(buf, D.hh[0], D.hh[1]);
    const SEA = D.sea ? new Uint8Array(buf, D.sea[0], D.sea[1]) : null;          // 海の升（1）。海の無い県には無い
    const bil = (A, k, x, z) => {
      const fx = clamp((x - D.x0) / cell, 0, W - 1.001), fz = clamp((z - D.z0) / cell, 0, H - 1.001);
      const j = Math.floor(fx), i = Math.floor(fz), u = fx - j, v = fz - i, o = i * W + j;
      return ((A[o] * (1 - u) + A[o + 1] * u) * (1 - v) + (A[o + W] * (1 - u) + A[o + W + 1] * u) * v) * k;
    };
    // 高さは、描いた地面の三角形の上で取る（4点の平均だと、山を9倍に強めた急な尾根で、木や家が地面の下に埋もれた。丹沢 2026-10-30）
    const hAt = (x, z) => {
      const fx = clamp((x - D.x0) / cell, 0, W - 1.001), fz = clamp((z - D.z0) / cell, 0, H - 1.001);
      const j = Math.floor(fx), i = Math.floor(fz), u = fx - j, v = fz - i, o = i * W + j;
      return u + v <= 1 ? E[o] + (E[o + 1] - E[o]) * u + (E[o + W] - E[o]) * v
        : E[o + W + 1] + (E[o + W] - E[o + W + 1]) * (1 - u) + (E[o + 1] - E[o + W + 1]) * (1 - v);
    };
    const dAt = (x, z) => bil(DI, cell, x, z);
    const fadeOf = (d) => smooth(-FADE, -1, d);
    // 地図を捨てる時（dispose）に外せるよう、知らせの受け口はここで覚えておく
    const subs = [], on = (e, f) => { M.on(e, f); subs.push([e, f]); };
    const group = new T.Group();
    group.visible = false;
    X.scene.add(group);
    const add = (o, ro) => { o.frustumCulled = false; o.renderOrder = ro; group.add(o); return o; };

    // ---- 地面
    const pos = new Float32Array(W * H * 3), nor = new Float32Array(W * H * 3), aH = new Float32Array(W * H), aF = new Float32Array(W * H), aS = new Float32Array(W * H);
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
      const o = i * W + j;
      pos[o * 3] = D.x0 + j * cell; pos[o * 3 + 1] = E[o] * EXI; pos[o * 3 + 2] = D.z0 + i * cell;
      aH[o] = E[o]; aF[o] = fadeOf(DI[o] * cell); aS[o] = SEA ? SEA[o] : 0;
    }
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
      const o = i * W + j, l = E[i * W + Math.max(j - 1, 0)], r = E[i * W + Math.min(j + 1, W - 1)];
      const u = E[Math.max(i - 1, 0) * W + j], d = E[Math.min(i + 1, H - 1) * W + j];
      const nx = -(r - l) * EXI / (2 * cell), nz = -(d - u) * EXI / (2 * cell), L = Math.hypot(nx, 1, nz);
      nor[o * 3] = nx / L; nor[o * 3 + 1] = 1 / L; nor[o * 3 + 2] = nz / L;
    }
    const idx = [];
    for (let i = 0; i < H - 1; i++) for (let j = 0; j < W - 1; j++) {
      const o = i * W + j;
      if (Math.max(aF[o], aF[o + 1], aF[o + W], aF[o + W + 1]) <= 0) continue;
      idx.push(o, o + W, o + 1, o + 1, o + W, o + W + 1);
    }
    const gg = X.geo([['position', pos, 3], ['normal', nor, 3], ['aH', aH, 1], ['aF', aF, 1], ['aS', aS, 1]], new Uint32Array(idx));
    // 町の地面（明るい土の色と街区）も、家の絵と同じ世帯の数で決める（全国の決まりの「町丁目の数」に合わせて 20世帯＝1）
    const TN = new Uint8Array(W * H);
    for (let o = 0; o < W * H; o++) TN[o] = Math.min(255, HH[o] / 20);
    const tw = new T.DataTexture(TN, W, H, T.RedFormat, T.UnsignedByteType);
    // 土地利用（県の中を作る.py の lu：田・畑・森林・建物用地の割合 0〜255）を RGBA の画像に
    const LU = D.lu ? D.lu.map((a) => new Uint8Array(buf, a[0], a[1])) : null;
    let LUT = null;
    if (LU) {
      const px = new Uint8Array(W * H * 4);
      for (let o = 0; o < W * H; o++) { px[o * 4] = LU[0][o]; px[o * 4 + 1] = LU[1][o]; px[o * 4 + 2] = LU[2][o]; px[o * 4 + 3] = LU[3][o]; }
      LUT = new T.DataTexture(px, W, H, T.RGBAFormat, T.UnsignedByteType);
      LUT.magFilter = LUT.minFilter = T.LinearFilter; LUT.needsUpdate = true;
    }
    tw.magFilter = tw.minFilter = T.LinearFilter; tw.needsUpdate = true;
    // 産地のあたり（画風見本と同じ所）：沼田のりんご・榛名の梅・嬬恋の高原キャベツ
    const ll = (lon, lat) => [(lon - 137.5) * 111.32 * Math.cos(36 * Math.PI / 180), (36 - lat) * 110.57];
    const AR = AREAS[name] || {}, at = (a) => (a ? ll(a[0], a[1]).concat(a[2]) : null);
    const APPLE = at(AR.apple), UME = at(AR.ume), CABBAGE = at(AR.farm);
    const GU = Object.assign({}, U, {
      uTown: { value: tw }, uTownBox: { value: new T.Vector4(D.x0 - cell / 2, D.z0 - cell / 2, W * cell, H * cell) },
      uTownK: { value: 1 }, uPaper: { value: new T.Color('#f1e6cb') },
      uLand: { value: LUT }, uLuOn: { value: LUT ? 1 : 0 },
      uExag: { value: EXI * 1000 }, uFarm: { value: CABBAGE ? new T.Vector4(CABBAGE[0], CABBAGE[1], CABBAGE[2] + 1, 1) : new T.Vector4() },
      uConOdds: { value: 1 },
    });
    add(new T.Mesh(gg, X.mat(VS_GROUND, FS_GROUND(X), { uniforms: GU, side: T.DoubleSide })), 1);

    // ---- 木と家（0.4km おきの格子。全国と同じ絵、同じ段の出し方）
    const K = DR.K, hash = DR.hash;
    const near = (p, x, z, r) => Math.hypot(p[0] - x, p[1] - z) < r;
    // 家とビルの数は世帯の数に比例（令和2年国勢調査 500mメッシュ）。寄った時、家の絵1つ≒100世帯・ビル1つ≒300世帯。
    // 1マス（0.4km）に3×3の置き場。1つ目はマスの段（遠くからも見える）、2つ目からは寄った時だけ（段4＝0.2km おき）。
    // 小数は乱数で丸めて、合計が世帯の数に合うように。1マスに9つを超える所（ごく一部）は9つで止める
    const PER_HOUSE = 100, PER_BLDG = 300;
    const popCnt = [0, 0, 0, 0, 0];                 // 段ごとの家の絵の数（ビルは家3つぶん）。人口の表示の「今1つが何世帯か」に使う
    // 川・鉄道・高速道路の上には、家も木も立てない（立てると、町の中で線路や川が家の絵に埋もれた）
    const SEG = [], SG = new Map(), SB = 0.5;
    const addSeg = (list, head, stride, rOf) => {
      for (const L of list) for (let q = head; q + stride + 1 < L.length; q += stride) {
        const ax = L[q] / 100, az = L[q + 1] / 100, bx = L[q + stride] / 100, bz = L[q + stride + 1] / 100, r = rOf(L, q), k = SEG.length;
        SEG.push([ax, az, bx, bz, r]);
        for (let cx = Math.floor((Math.min(ax, bx) - r) / SB); cx <= Math.floor((Math.max(ax, bx) + r) / SB); cx++)
          for (let cz = Math.floor((Math.min(az, bz) - r) / SB); cz <= Math.floor((Math.max(az, bz) + r) / SB); cz++) {
            const key = cx * 100000 + cz;
            if (!SG.has(key)) SG.set(key, []);
            SG.get(key).push(k);
          }
      }
    };
    addSeg(D.rivers, 0, 3, (L, q) => riverW(L[q + 2]) / 2 + 0.04);
    addSeg(D.rails.filter((L) => L[0] < 10), 1, 3, () => 0.08);      // 線路の点は [x, z, 線路の高さ m]。トンネル（印 10 以上）の上には木も家も立てる
    addSeg(D.roads.filter((r) => r[0] === 2), 1, 2, () => 0.07);
    const clear = (x, z) => {
      const a = SG.get(Math.floor(x / SB) * 100000 + Math.floor(z / SB));
      if (a) for (const k of a) {
        const [ax, az, bx, bz, r] = SEG[k], vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
        if (Math.hypot(x - ax - t * vx, z - az - t * vz) < r) return false;
      }
      return true;
    };
    // 川・高速道路・線路は、木と家の絵より上に（本人 2026-10-30「細い川が見えなくなっちゃうのは仕方ないよね」）。木の絵は森が遠くから読めるよう
    // 実の木よりずっと大きく（離れると1つ数百m〜数km）描くので、川の手前に立つ木の絵が細い川を覆った。線が地面に隠れずに描けた画素に
    // 型板（stencil）の印を付け、木と家の絵はその画素を塗らない。山の陰の川は地面に隠れて印が付かず、木もそのまま
    const MARK = (m) => Object.assign(m, { stencilWrite: true, stencilRef: 1, stencilFunc: T.AlwaysStencilFunc, stencilZPass: T.ReplaceStencilOp });
    const UNDER = (m) => Object.assign(m, { stencilWrite: true, stencilRef: 1, stencilFunc: T.NotEqualStencilFunc, stencilZPass: T.KeepStencilOp });
    const roundP = (v, r) => Math.floor(v) + (r < v - Math.floor(v) ? 1 : 0);
    // 森の針葉樹の割合（本人 2026-10-30「植生は多分適当だよね。広葉樹と針葉樹の割合をデータをもとに」）：林野庁の県ごとの割合（森林.js）に合わせる。
    // 高い所ほど針葉樹が多い傾き（1150m を境に 27%／62%）は残し、その県の森の升で数えた割合が表と同じになるよう、針葉樹になりやすさ（オッズ）を
    // 県ごとに何倍かする。県の外に見えている升も同じ倍率（隣の県の表は使わない）
    const SH = window.SHINRIN && SHINRIN.prefs[(M.P.find((p) => p.name === name) || {}).n];
    const P_LO = 0.27, P_HI = 0.62, byOdds = (p, m) => m * p / (1 - p + m * p);
    let ODDS = 1, baseShare = null;
    if (SH) {
      let wL = 0, wH = 0;
      for (let i = 1; i < H - 1; i++) for (let j = 1; j < W - 1; j++) {
        const o = i * W + j, h = E[o];
        if (DI[o] < 0 || (SEA && SEA[o]) || HH[o] >= 300 || h > 1750) continue;
        const w = LU ? LU[2][o] / 255 : Math.hypot(E[o + 1] - E[o - 1], E[o + W] - E[o - W]) / (2 * cell * 1000) < 0.025 && h < 900 ? 0 : 1;
        if (h > 1150) wH += w; else wL += w;
      }
      const share = (m) => (wL * byOdds(P_LO, m) + wH * byOdds(P_HI, m)) / Math.max(wL + wH, 1e-9);
      let lo = -6, hi = 6;
      for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (share(Math.exp(mid)) < SH.conifer) lo = mid; else hi = mid; }
      ODDS = Math.exp((lo + hi) / 2);
      baseShare = share(1);                       // 検査用：決め打ち（倍率1）の時の割合
    }
    const conP = (h) => byOdds(h > 1150 ? P_HI : P_LO, ODDS);
    GU.uConOdds.value = ODDS;                       // 地面の森の冠の針葉樹も同じ倍率で
    const forestCnt = [0, 0];                       // 県の中の森の升に立てた木（針葉樹・広葉樹）。表の割合と合うかの検査に使う
    const P = [], I = [], A4 = [], F = [];
    for (let i = 1; i < H - 1; i++) for (let j = 1; j < W - 1; j++) {
      const o = i * W + j, d = DI[o] * cell;
      if (d < -FADE + 0.5 || (SEA && SEA[o])) continue;     // 海には木も家も立てない
      const r = hash(i, j, 11), qx = D.x0 + (j + (hash(i, j, 12) - 0.5) * 0.7) * cell, qz = D.z0 + (i + (hash(i, j, 13) - 0.5) * 0.7) * cell;
      // 本物の傾き（強める前の高さで。畑と森の分け目は、見た目の傾きでなく本物の傾きで決める）
      const h = hAt(qx, qz), slope = Math.hypot(E[o + 1] - E[o - 1], E[o + W] - E[o - W]) / (2 * cell * 1000);
      const hh = HH[o], lvN = i % 8 === 0 && j % 8 === 0 ? 0 : i % 4 === 0 && j % 4 === 0 ? 1 : i % 2 === 0 && j % 2 === 0 ? 2 : 3;
      if (hh > 0) {
        const nb = hh >= 350 ? roundP(hh * 0.6 / PER_BLDG, hash(i, j, 21)) : 0;
        const nh = roundP((hh >= 350 ? hh * 0.4 : hh) / PER_HOUSE, hash(i, j, 22));
        const slots = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort((a, b) => hash(i * 9 + a, j, 23) - hash(i * 9 + b, j, 23));
        let used = 0;
        for (const [kd, n] of [[K.building, nb], [K.house, nh]]) for (let q = 0; q < n && used < 9; q++, used++) {
          const sl = slots[used], px = D.x0 + (j + (sl % 3 - 1) / 3 + (hash(i, j, 40 + used) - 0.5) * 0.12) * cell;
          const pz = D.z0 + (i + (Math.floor(sl / 3) - 1) / 3 + (hash(i, j, 50 + used) - 0.5) * 0.12) * cell, ph = hAt(px, pz);
          if (!clear(px, pz)) continue;
          popCnt[used === 0 ? lvN : 4] += kd === K.building ? 3 : 1;
          P.push(px, ph * EXI, pz); I.push(63); A4.push(kd, used === 0 ? lvN : 4, hash(i, j, 60 + used), ph); F.push(fadeOf(dAt(px, pz)));
        }
      }
      // 土地利用（ある県）：住む人の少ない建物用地に工場・倉庫・タンク。木は森林の割合で、屋敷林と果樹は田畑の所だけ
      const fo = LU ? LU[2][o] / 255 : 0, fa = LU ? (LU[0][o] + LU[1][o]) / 255 : 0;
      if (LU && LU[3][o] > 110 && hh < 30 && clear(qx, qz)) {
        P.push(qx, h * EXI, qz); I.push(63); A4.push(K.factory, lvN, hash(i, j, 14), h); F.push(fadeOf(dAt(qx, qz)));
        continue;
      }
      let kind = -1, forest = false;
      const sp = hash(i, j, 15);
      if (hh >= 300 || (hh >= 100 && r < (hh - 100) / 200)) kind = -1;                                         // 家の建てこんだ所に木は立てない
      else if (LU && h <= 1750) {
        if (CABBAGE && near(CABBAGE, qx, qz, CABBAGE[2]) && fa > 0.3) { if (r < 0.08) kind = K.conifer; }
        else if (APPLE && near(APPLE, qx, qz, APPLE[2]) && fa > 0.25 && r < 0.55) kind = K.apple;
        else if (UME && near(UME, qx, qz, UME[2]) && fa > 0.25 && r < 0.5) kind = K.ume;
        else if (r < fo) { kind = sp < conP(h) ? K.conifer : K.broad; forest = true; }
        else if (fa > 0.3 && r < fo + 0.035) kind = K.broad;
      }
      else if (CABBAGE && near(CABBAGE, qx, qz, CABBAGE[2]) && h > 850 && h < 1500 && slope < 0.12) { if (r < 0.08) kind = K.conifer; }   // 嬬恋の高原の畑
      else if (slope < 0.025 && h < 900) { if (r < 0.035) kind = K.broad; }                                          // 田畑の中の屋敷林（盆地も。地面の田畑と同じ高さまで）
      else if (APPLE && near(APPLE, qx, qz, APPLE[2]) && h < 900 && r < 0.55) kind = K.apple;
      else if (UME && near(UME, qx, qz, UME[2]) && h < 800 && r < 0.5) kind = K.ume;
      else if (h > 2450) kind = -1;
      else if (h > 1750) { if (r < 0.55) kind = K.alpine; }
      else { kind = sp < conP(h) ? K.conifer : K.broad; forest = true; }
      if (kind < 0 || !clear(qx, qz)) continue;
      if (forest && d >= 0) forestCnt[kind === K.conifer ? 0 : 1]++;
      P.push(qx, h * EXI, qz); I.push(63); A4.push(kind, lvN, hash(i, j, 14), h); F.push(fadeOf(dAt(qx, qz)));
    }
    const pg = new T.BufferGeometry();
    for (const [k, a, n] of [['position', P, 3], ['aId', I, 1], ['aD', A4, 4], ['aF', F, 1]]) pg.setAttribute(k, new T.BufferAttribute(new Float32Array(a), n));
    const IN = { S: cell, px: [9, 30], km: 0.55, fade: true };
    add(new T.Points(pg, UNDER(X.mat(DR.VS_PT(X, IN), DR.FS_PT(X, IN), DR.PT_MAT(X)))), 3);
    // ---- 寄った時の細かい段（本人 2026-10-30「寄ると数が変わらないので隙間ができる。寄る距離で1つ当たりの密度のスケールを変え、数を増やして。見えている範囲だけでよい」）：
    // 0.4km の升の点（段0〜4）に、カメラの近くで画面に入る向きだけ、0.1km（段5）・0.05km（段6）おきの木と家の点を足す。出すかは描き込み.js の段の決まり
    // （点の間が画面で6画素ほど以上）で、絵は段が細かいほど小さく。カメラが動いたら、新しく画面に入った升だけを少しずつ（1コマ 3ms まで）作る
    let fineN = () => 0, fineBusy = () => false, fineLag = () => 0, fineBudget = () => 0;
    {
      const CAP = 160000, FP = new Float32Array(CAP * 3), FD = new Float32Array(CAP * 4), FF = new Float32Array(CAP);
      const fg = new T.BufferGeometry(), aP = new T.BufferAttribute(FP, 3), aDd = new T.BufferAttribute(FD, 4), aFf = new T.BufferAttribute(FF, 1);
      for (const a of [aP, aDd, aFf]) a.setUsage(T.DynamicDrawUsage);
      fg.setAttribute('position', aP); fg.setAttribute('aId', new T.BufferAttribute(new Float32Array(CAP).fill(63), 1)); fg.setAttribute('aD', aDd); fg.setAttribute('aF', aFf);
      fg.setDrawRange(0, 0);
      add(new T.Points(fg, UNDER(X.mat(DR.VS_PT(X, IN), DR.FS_PT(X, IN), DR.PT_MAT(X)))), 3);
      // 升（段6は 1km・段5は 2km 四方）ごとに作った点を覚えておき、動いた時は、新しく画面に入った升だけを近い順に作る
      // （本人 2026-10-30「飛行の画面変化に対して、木や家の描く速度がどうしても遅延がある」。前は 2km 進むか 12° 向くたびに見える所を全部作り直し、
      // 1コマ 3ms ずつなので、速く飛ぶと作り終わる前に次の作り直しが始まって、新しく見えた所の木が遅れて出た）。
      // 画面に入るかは升の箱で見る（カメラの視野を、絵の大きさと少し向きを変えても欠けない分＝約15° 広げて）。
      // 地面の向きだけで選ぶと、真上から見下ろした時に画面の外の20km四方まで作って上限に届いた（2026-10-30）
      const LVS = [[6, 0.05, 1, (ppk) => Math.min(ppk / 110, 10)], [5, 0.1, 2, (ppk) => Math.min(ppk / 55, 20)]];
      const cache = new Map(), span = new Map(), fr = new T.Frustum(), mPV = new T.Matrix4(), box = new T.Box3();
      // まだ作っていない升の高さの幅（標高の格子から）。前は決め打ちの高い箱で見て、真上からの眺めで画面の外の升まで選んだ
      const spanOf = (C, ci, cj, key) => {
        let s = span.get(key);
        if (s) return s;
        let lo = Infinity, hi = -Infinity;
        for (let i = Math.floor((cj * C - D.z0) / cell); i <= Math.ceil(((cj + 1) * C - D.z0) / cell); i++) for (let j = Math.floor((ci * C - D.x0) / cell); j <= Math.ceil(((ci + 1) * C - D.x0) / cell); j++) {
          if (i < 0 || j < 0 || i >= H || j >= W) continue;
          const e = E[i * W + j]; if (e < lo) lo = e; if (e > hi) hi = e;
        }
        s = lo > hi ? [0, 0] : [lo * EXI, hi * EXI]; span.set(key, s); return s;
      };
      let job = null, cur = null, last = null, tick = 0, wrote = 0, budget = 3;
      // 1つの升の点（段 lv・点の間 s km・升の幅 C km・升の番号 ci, cj）。カメラによらないので、作った物は覚えて使い回す
      function gen(lv, s, C, ci, cj) {
        const N = Math.round(C / s), P3 = [], D4 = [], F1 = [];
        const put = (x, z, kind, r, h) => {
          if (!clear(x, z)) return;
          P3.push(x, h * EXI, z); D4.push(kind, lv, r, h); F1.push(fadeOf(dAt(x, z)));
        };
        for (let gz = cj * N; gz < (cj + 1) * N; gz++) for (let gx = ci * N; gx < (ci + 1) * N; gx++) {
          const x = (gx + 0.2 + 0.6 * hash(gx, gz, 31 + lv)) * s, z = (gz + 0.2 + 0.6 * hash(gx, gz, 37 + lv)) * s;
          const j = Math.round((x - D.x0) / cell), i = Math.round((z - D.z0) / cell);
          if (i < 0 || j < 0 || i >= H || j >= W) continue;
          const o = i * W + j;
          if (SEA && SEA[o]) continue;
          const r = hash(gx, gz, 41 + lv), hh = HH[o], bl = LU ? LU[3][o] / 255 : 0, fo = LU ? LU[2][o] / 255 : 0;
          // 家は世帯の数にも比例（段5・段6とも、升の世帯25ごとに1つほど。家の建てこんだ所は建物用地の割合で止める）。
          // 人口の表示では足した家を出さない（1つ≒100世帯の数え方のまま。描き込み.js）
          if (hh > 30 && r < Math.min(bl * 1.1, hh / (lv === 5 ? 400 : 1600))) put(x, z, hh >= 2000 && hash(gx, gz, 43) < 0.2 ? K.building : K.house, hash(gx, gz, 47), hAt(x, z));
          else if (r < fo) {
            const h = hAt(x, z), sp = hash(gx, gz, 53);
            if (h > 2450 || (h > 1750 && sp < 0.5)) continue;
            put(x, z, sp < conP(h) ? K.conifer : K.broad, hash(gx, gz, 59), h);
          }
        }
        return { p: new Float32Array(P3), d: new Float32Array(D4), f: new Float32Array(F1), n: F1.length, used: 0 };
      }
      // いま要る升：段ごとの見える距離の中で、広げた視野に箱がかかる物を、近い順に
      function want() {
        const cam = M.inner.camera, ppk = U.uPpk.value, p = cam.position, k = U.uInY.value, out = [];
        cam.updateMatrixWorld(); fr.setFromProjectionMatrix(mPV.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
        for (const [lv, s, C, Rf] of LVS) {
          const R = Rf(ppk);
          for (let ci = Math.floor((p.x - R) / C); ci <= Math.floor((p.x + R) / C); ci++) for (let cj = Math.floor((p.z - R) / C); cj <= Math.floor((p.z + R) / C); cj++) {
            const d = Math.hypot((ci + 0.5) * C - p.x, (cj + 0.5) * C - p.z);
            if (d - C * 0.71 > R) continue;
            // 広げる幅は約5°（選び直しは 3° ごとなので、作る間の向きの変化の分だけで足りる）
            const key = lv * 1e8 + (ci + 5000) * 1e4 + (cj + 5000), y = spanOf(C, ci, cj, key), m = 0.2 + d * 0.09;
            box.min.set(ci * C - m, y[0] * k - m, cj * C - m); box.max.set((ci + 1) * C + m, y[1] * k + m, (cj + 1) * C + m);
            if (fr.intersectsBox(box)) out.push({ key, lv, s, C, ci, cj, d });
          }
        }
        return out.sort((a, b) => a.d - b.d);
      }
      // 作ってある升の点を、近い順に描く配列へ並べる（上限に届いたら、遠い升を落とす）
      function write(list) {
        let n = 0;
        for (const w of list) {
          const c = cache.get(w.key);
          if (!c || n + c.n > CAP) continue;
          FP.set(c.p, n * 3); FD.set(c.d, n * 4); FF.set(c.f, n); c.used = tick; n += c.n;
        }
        for (const [a, k2] of [[aP, 3], [aDd, 4], [aFf, 1]]) { if (a.addUpdateRange) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(n, 1) * k2); } a.needsUpdate = true; }
        fg.setDrawRange(0, n);
        wrote = performance.now();
      }
      function* run(list) {
        for (const w of list) {
          if (cache.has(w.key)) continue;
          cache.set(w.key, gen(w.lv, w.s, w.C, w.ci, w.cj));
          yield;
        }
      }
      on('frame', () => {
        if (!group.visible) { job = null; last = null; return; }
        tick++;
        const p = M.inner.camera.position, c = M.cam, ppk = U.uPpk.value;
        let fx = c.x - p.x, fz = c.z - p.z;
        const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
        // 選び直す目安：0.15km 動く・向きを 3° 変える（選び直しは升の箱を見るだけで軽い。作るのは新しい升だけ）
        if (!last || Math.hypot(p.x - last[0], p.z - last[1], p.y - last[5]) > 0.15 || fx * last[2] + fz * last[3] < 0.9986 || Math.abs(ppk - last[4]) > ppk * 0.1) {
          last = [p.x, p.z, fx, fz, ppk, p.y];
          cur = want(); job = run(cur); write(cur);      // 作ってある升はすぐ並べ直す（画面の外へ出た升は落とす）
        }
        if (!job) return;
        // 1コマに 3ms まで作る。作れた升は 0.08 秒ごとに並べ直して描く（近い升から先に見える）
        const t0 = performance.now();
        let made = false;
        while (performance.now() - t0 < budget) { if (job.next().done) { job = null; break; } made = true; }
        if (made && (!job || performance.now() - wrote > 80)) write(cur);
        else if (!job) write(cur);
        if (!job && cache.size > 1400) {               // 覚えておく升は 1000 まで（長く使っていない物から捨てる）
          const old = [...cache].sort((a, b) => a[1].used - b[1].used);
          for (let q = 0; q < old.length && cache.size > 1000; q++) if (old[q][1].used < tick) cache.delete(old[q][0]);
        }
      });
      fineN = () => fg.drawRange.count; fineBusy = () => !!job;
      fineLag = () => (cur ? cur.reduce((q, w) => q + (cache.has(w.key) ? 0 : 1), 0) : 0);   // 検査用：要るのにまだ作っていない升の数
      fineBudget = (ms) => { if (ms != null) budget = ms; return budget; };
    }
    let nearHouses = () => 0;                    // 1軒ずつの家の数（検査用）
    // ---- 近くの家を立体に（本人 2026-10-30「車窓モードをするなら、近くの物…が、今よりリッチで美しいと感じる鳥瞰図に」）：
    // 空を飛ぶ・車窓の間（uNear3D）だけ、カメラから 2.25km の家とビルを、壁と切妻の屋根の立体に（絵札は描き込み.js が隠す）。
    // 屋根の色は絵札と同じ決め方（くじ r から4色）。家の大きさは山の強め方によらず実の大きさの見当で
    {
      const roofCols = ['#d2482e', '#3a5aa0', '#c46a2a', '#5a6270'].map((h) => new T.Color(h));
      const HP = [], HI = [], HR = [];
      for (let q = 0; q < A4.length / 4; q++) {
        const kd = A4[q * 4];
        if (kd !== K.house && kd !== K.building) continue;
        const r = A4[q * 4 + 2], rc = roofCols[Math.floor(((r * 3) % 1) * 4)];
        HP.push(P[q * 3], P[q * 3 + 1], P[q * 3 + 2]); HI.push(r, kd === K.building ? 1 : 0); HR.push(rc.r, rc.g, rc.b);
      }
      // 1軒の形：壁（箱）と切妻の屋根。aPart＝0 壁・1 屋根。ビルは壁を高くして屋根を平らに（頂点の式で）
      const V = [], N = [], PA = [], box = (x0, x1, y0, y1, z0, z1, part) => {
        const f = (a, b, c, d, n) => { for (const v of [a, b, c, a, c, d]) { V.push(...v); N.push(...n); PA.push(part); } };
        f([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); f([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
        f([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); f([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
      };
      box(-0.5, 0.5, 0, 0.6, -0.4, 0.4, 0);
      const ro = 0.08, eY = 0.58, rY = 1.0, slope = Math.hypot(0.48, rY - eY);
      for (const sz of [1, -1]) {             // 屋根の2面（棟は x の向き）
        const a = [-0.5 - ro, eY, sz * (0.4 + ro)], b = [0.5 + ro, eY, sz * (0.4 + ro)], c = [0.5 + ro, rY, 0], d = [-0.5 - ro, rY, 0];
        const n = [0, 0.48 / slope * 2, sz * (rY - eY) / slope * 2];
        for (const v of sz > 0 ? [a, b, c, a, c, d] : [b, a, d, b, d, c]) { V.push(...v); N.push(...n); PA.push(1); }
      }
      for (const sx of [1, -1]) {             // 妻（三角の壁）
        for (const v of sx > 0 ? [[0.5, 0.6, 0.4], [0.5, 0.6, -0.4], [0.5, rY - 0.02, 0]] : [[-0.5, 0.6, -0.4], [-0.5, 0.6, 0.4], [-0.5, rY - 0.02, 0]]) { V.push(...v); N.push(sx, 0, 0); PA.push(0); }
      }
      const hg = new T.InstancedBufferGeometry();
      hg.setAttribute('position', new T.Float32BufferAttribute(V, 3)); hg.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); hg.setAttribute('aPart', new T.Float32BufferAttribute(PA, 1));
      hg.setAttribute('aPos', new T.InstancedBufferAttribute(new Float32Array(HP), 3)); hg.setAttribute('aInfo', new T.InstancedBufferAttribute(new Float32Array(HI), 2));
      hg.setAttribute('aRoof', new T.InstancedBufferAttribute(new Float32Array(HR), 3));
      hg.instanceCount = HP.length / 3;
      // 墨の輪郭（絵札の家と画風をそろえる）：同じ形を法線の向きに少し太らせ、裏の面だけ墨で塗る
      // small＝1軒ずつの家（下の「低く飛ぶ間」）。aInfo に向きも持つ。どちらも、1軒ずつの家の輪（uNearR）との境で縮めて入れ替える
      const houseVS = (ink, small) => `
        attribute float aPart; attribute vec3 aPos, aRoof; attribute ${small ? 'vec3' : 'vec2'} aInfo;
        uniform float uInY, uNear3D, uNearR, uNearK; uniform vec3 uLdir;
        varying vec3 vC, vWin; varying float vDist;
        void main() {
          float r = aInfo.x, tall = aInfo.y, d = distance(vec3(aPos.x, aPos.y * uInY, aPos.z), cameraPosition);
          vec3 q = position;
          ${small ? `
          float yaw = aInfo.z, s = (tall > 0.5 ? 0.016 : 0.0105) * (0.85 + 0.3 * fract(r * 13.0)) * (1.0 - smoothstep(uNearR - 0.3, uNearR, d));
          if (tall > 0.5) { q.y = aPart > 0.5 ? 1.58 : min(q.y * 2.6, 1.56); q.xz *= 1.4; }` : `
          // 輪の外の家の絵も、低く飛ぶ間は3割の大きさへ（50m の家・100m のビルのままだと、輪の内の1軒ずつの家との段差が目立った）
          float yaw = r * 37.7, s = 0.05 * (0.85 + 0.3 * fract(r * 13.0)) * (uNearR > 0.0 ? smoothstep(uNearR, uNearR + 0.3, d) : 1.0) * (1.0 - 0.7 * uNearK);
          // ビル：壁を高く・屋根を平らに。妻（三角の壁）も壁の高さで止める（伸ばすと、てっぺんに尖塔のような三角が突き出た。本人 2026-10-30「ビルをアップすると変な見た目」）
          if (tall > 0.5) { q.y = aPart > 0.5 ? 2.2 : min(q.y * 3.6, 2.16); q.xz *= 1.3; }`}
          // ビルの壁の窓：壁に沿った長さと高さ（m）。z＝窓を描く壁か
          vWin = vec3((abs(normal.x) > 0.5 ? q.z : q.x) * s * 1000.0, q.y * s * 900.0, ${ink ? '0.0' : 'tall > 0.5 && aPart < 0.5 ? 1.0 : 0.0'});
          vec2 xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * (q.xz * s);
          vec2 nz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * normal.xz;
          vec3 n = normalize(vec3(nz.x, normal.y, nz.y));
          vec3 w = vec3(aPos.x + xz.x, aPos.y * uInY + q.y * s * 0.9, aPos.z + xz.y);
          ${ink ? 'w += n * 0.0012 * distance(w, cameraPosition);' : ''}     // 輪郭は画面でおよそ2画素（距離に比例）
          ${small ? `
          // 1軒ずつの家は輪（uNearR）の中なら 2.25km より先も。墨の輪郭は 1.3km まで（遠い家は数画素で、輪郭の分だけ重い）
          float on = uNear3D * step(1e-6, s)${ink ? ' * step(d, 1.3)' : ''};` : `
          float on = uNear3D * step(d, 2.25) * step(1e-6, s);`}
          vec3 base = aPart > 0.5 ? (tall > 0.5 ? vec3(0.56, 0.59, 0.64) : aRoof) : (tall > 0.5 ? vec3(0.86, 0.83, 0.77) : vec3(1.0, 0.97, 0.92));
          vC = ${ink ? 'vec3(0.165, 0.192, 0.275)' : 'base * (aPart > 0.5 ? 0.78 + 0.3 * max(dot(n, uLdir), 0.0) : 0.86 + 0.18 * max(dot(n, uLdir), 0.0))'};
          vec4 mv = modelViewMatrix * vec4(w, 1.0); vDist = -mv.z;
          gl_Position = on < 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
        }`;
      // ビルの窓は 4m×3.6m の升に1つ。遠くて升が細かすぎる所は描かない（縞のちらつきになる）。夜は半分ほどに灯りがともる
      const houseFS = `
        ${X.FINISH}
        varying vec3 vC, vWin; varying float vDist;
        void main() {
          vec3 c = vC;
          float lit = 0.0;
          if (vWin.z > 0.5) {
            vec2 g = vWin.xy / vec2(4.0, 3.6), f = abs(fract(g) - 0.5), w = fwidth(g);
            float win = (1.0 - smoothstep(0.27 - w.x, 0.27 + w.x, f.x)) * (1.0 - smoothstep(0.2 - w.y, 0.2 + w.y, f.y));
            win *= step(3.0, vWin.y) * (1.0 - smoothstep(0.3, 0.55, max(w.x, w.y)));
            lit = win * step(0.5, fract(sin(dot(floor(g), vec2(12.9898, 78.233))) * 43758.5453));
            c = mix(c, vec3(0.32, 0.38, 0.47), win * 0.8);
          }
          c = finish(c, vec3(0.0), vDist);
          gl_FragColor = vec4(mix(c, vec3(1.0, 0.8, 0.48), lit * uNight * 0.9), 1.0);
        }`;
      add(new T.Mesh(hg, X.mat(houseVS(false, false), houseFS)), 3.1);
      add(new T.Mesh(hg, X.mat(houseVS(true, false), houseFS, { side: T.BackSide })), 3.1);

      // ---- 低く飛ぶ間は、近くの家を1軒ずつに（本人 2026-10-30「地面に近づいたら、少しずつ画質をリッチにしていって」）。
      // 地面の街区（map3d.js の町の地面。62.5m おきの道）ごとに、その升（0.4km）の世帯数と建物用地の割合から軒数を決め、道を避けて 3×3 の区画に並べる。
      // 建物用地の割合だけの街区に家を建て、升の世帯をそこへ集める。1街区に 40 世帯を超える所は中層の集合住宅（120 を超えると 3×3 棟）。
      // 家の絵の置き場のまわりに固めると、街区の大半が空き地に見えた。輪の半径（uNearR）は旅.js が高さで決め、カメラが 250m 動くたびに輪の中の分だけ置き直す
      const CAP = 60000, sP = new Float32Array(CAP * 3), sI = new Float32Array(CAP * 3), sR = new Float32Array(CAP * 3);
      const sg = new T.InstancedBufferGeometry();
      for (const k of ['position', 'normal', 'aPart']) sg.setAttribute(k, hg.attributes[k]);
      const iP = new T.InstancedBufferAttribute(sP, 3), iI = new T.InstancedBufferAttribute(sI, 3), iR = new T.InstancedBufferAttribute(sR, 3);
      for (const a of [iP, iI, iR]) a.setUsage(T.DynamicDrawUsage);
      sg.setAttribute('aPos', iP); sg.setAttribute('aInfo', iI); sg.setAttribute('aRoof', iR);
      sg.instanceCount = 0;
      add(new T.Mesh(sg, X.mat(houseVS(false, true), houseFS)), 3.1);
      add(new T.Mesh(sg, X.mat(houseVS(true, true), houseFS, { side: T.BackSide })), 3.1);
      // ---- 近くの森を1本ずつの木に（家の輪の 55% の内）。森林の割合だけの街区に 4×4 本。針葉樹は円すい・広葉樹は丸い冠、
      // 色は地面の冠と同じ決まり（季節・針葉樹の割合は高さで）。木の絵札は描き込み.js がこの輪の内で隠す
      const treeGeo = (con) => {
        const V = [], N = [], PA = [], tri = (a, b, c, part) => {
          const n = new T.Vector3().crossVectors(new T.Vector3(...b).sub(new T.Vector3(...a)), new T.Vector3(...c).sub(new T.Vector3(...a))).normalize();
          for (const v of [a, b, c]) { V.push(...v); N.push(n.x, n.y, n.z); PA.push(part); }
        };
        const S = 6, ring = (y, r) => [...Array(S)].map((_, k) => [Math.cos(k / S * 6.283) * r, y, Math.sin(k / S * 6.283) * r]);
        const tb = ring(0, 0.035), tt = ring(con ? 0.3 : 0.4, 0.035);
        for (let k = 0; k < S; k++) { const k1 = (k + 1) % S; tri(tb[k], tt[k1], tb[k1], 0); tri(tb[k], tt[k], tt[k1], 0); }
        if (con) {
          const base = ring(0.22, 0.27), top = [0, 1, 0];
          for (let k = 0; k < S; k++) { const k1 = (k + 1) % S; tri(base[k], top, base[k1], 1); tri(base[k], base[k1], [0, 0.22, 0], 1); }
        } else {
          const ico = new T.IcosahedronGeometry(0.3, 0), p = ico.attributes.position;      // 頂点は面ごとに並んでいる（索引なし）
          for (let k = 0; k < p.count; k += 3) tri([p.getX(k), p.getY(k) * 0.9 + 0.6, p.getZ(k)], [p.getX(k + 1), p.getY(k + 1) * 0.9 + 0.6, p.getZ(k + 1)], [p.getX(k + 2), p.getY(k + 2) * 0.9 + 0.6, p.getZ(k + 2)], 1);
        }
        const g = new T.InstancedBufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(V, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('aPart', new T.Float32BufferAttribute(PA, 1));
        return g;
      };
      const treeVS = (ink, con) => `
        attribute float aPart; attribute vec3 aPos; attribute vec2 aInfo;
        uniform float uInY, uNear3D, uNearR, uSeason; uniform vec3 uLdir;
        varying vec3 vC, vWin; varying float vDist;
        vec3 crownCol(float r) {
          ${con ? 'return vec3(0.15, 0.40, 0.29) * (0.85 + 0.3 * r);' : `
          if (uSeason < 0.5) return r > 0.94 ? vec3(0.93, 0.74, 0.80) : mix(vec3(0.58, 0.78, 0.40), vec3(0.44, 0.69, 0.33), r);
          if (uSeason < 1.5) return mix(vec3(0.22, 0.52, 0.27), vec3(0.34, 0.62, 0.31), r);
          if (uSeason < 2.5) return r < 0.3 ? vec3(0.80, 0.25, 0.15) : r < 0.58 ? vec3(0.89, 0.50, 0.15) : r < 0.8 ? vec3(0.90, 0.72, 0.22) : vec3(0.36, 0.52, 0.28);
          return mix(vec3(0.47, 0.40, 0.35), vec3(0.56, 0.49, 0.43), r);`}
        }
        void main() {
          float r = aInfo.x, d = distance(vec3(aPos.x, aPos.y * uInY, aPos.z), cameraPosition), RT = uNearR * 0.55;
          float s = (0.012 + 0.008 * fract(r * 7.3)) * (1.0 - smoothstep(RT - 0.2, RT, d));
          vec3 n = normal, w = vec3(aPos.x, aPos.y * uInY, aPos.z) + position * s;
          ${ink ? 'w += n * 0.0012 * distance(w, cameraPosition);' : ''}
          vWin = vec3(0.0);
          vec3 base = aPart > 0.5 ? crownCol(fract(r * 5.7)) : vec3(0.40, 0.30, 0.22);
          vC = ${ink ? 'vec3(0.165, 0.192, 0.275)' : 'base * (0.72 + 0.4 * max(dot(n, uLdir), 0.0))'};
          vec4 mv = modelViewMatrix * vec4(w, 1.0); vDist = -mv.z;
          gl_Position = uNear3D < 0.5 || s < 1e-6${ink ? ' || d > 0.6' : ''} ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
        }`;
      const TCAP = 40000, trees = [true, false].map((con) => {
        const g = treeGeo(con), P = new Float32Array(TCAP * 3), I = new Float32Array(TCAP * 2), tP2 = new Float32Array(TCAP * 3), tI2 = new Float32Array(TCAP * 2);
        const aP = new T.InstancedBufferAttribute(P, 3), aI = new T.InstancedBufferAttribute(I, 2);
        for (const a of [aP, aI]) a.setUsage(T.DynamicDrawUsage);
        g.setAttribute('aPos', aP); g.setAttribute('aInfo', aI); g.instanceCount = 0;
        add(new T.Mesh(g, X.mat(treeVS(false, con), houseFS)), 3.1);
        add(new T.Mesh(g, X.mat(treeVS(true, con), houseFS, { side: T.BackSide })), 3.1);
        return { g, P, I, tP: tP2, tI: tI2, aP, aI, n: 0 };
      });
      const putTree = (x, z, r, con) => {
        const t = trees[con ? 0 : 1];
        if (t.n >= TCAP || !clear(x, z)) return;
        t.tP[t.n * 3] = x; t.tP[t.n * 3 + 1] = hAt(x, z) * EXI; t.tP[t.n * 3 + 2] = z; t.tI[t.n * 2] = r; t.n++;
      };
      const rnd = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };
      const BK = 0.0625, LOT = [0.0105, 0.0287, 0.047], PER_BK = BK * BK / (cell * cell);
      // 置き直しは裏の配列に少しずつ（1コマ 3ms まで）作り、でき上がったら一度に差しかえる。1度に作ると 10ms あまり止まった（CPU の遅い端末では 4倍）
      const tP = new Float32Array(CAP * 3), tI = new Float32Array(CAP * 3), tR = new Float32Array(CAP * 3);
      let nS = 0, last = null, job = null;
      const put = (x, z, r, tall, yaw, rc) => {
        if (nS >= CAP || !clear(x, z)) return;
        tP[nS * 3] = x; tP[nS * 3 + 1] = hAt(x, z) * EXI; tP[nS * 3 + 2] = z;
        tI[nS * 3] = r; tI[nS * 3 + 1] = tall; tI[nS * 3 + 2] = yaw;
        tR[nS * 3] = rc.r; tR[nS * 3 + 1] = rc.g; tR[nS * 3 + 2] = rc.b; nS++;
      };
      function* rebuild(cx, cz, R, RT) {
        nS = 0; trees[0].n = trees[1].n = 0;
        let done = 0;
        for (let bz = Math.floor((cz - R) / BK); bz <= Math.floor((cz + R) / BK); bz++) for (let bx = Math.floor((cx - R) / BK); bx <= Math.floor((cx + R) / BK); bx++) {
          if (++done % 64 === 0) yield;
          const x0 = bx * BK, z0 = bz * BK, db = Math.hypot(x0 + BK / 2 - cx, z0 + BK / 2 - cz);
          if (db > R) continue;
          const j = Math.round((x0 + BK / 2 - D.x0) / cell), i = Math.round((z0 + BK / 2 - D.z0) / cell);
          if (i < 0 || j < 0 || i >= H || j >= W) continue;
          const o = i * W + j, hh = HH[o];
          if (SEA && SEA[o]) continue;
          const bl = LU ? LU[3][o] / 255 : 0.5;
          const n = hh * PER_BK / Math.max(bl, 0.05);               // この街区の世帯（建物用地の割合だけの街区に建てる）
          if (hh <= 0 || rnd(bx, bz) > bl * 1.15 || n < 0.5) {
            // 家の無い街区：森林の割合だけの街区を森に
            if (db > RT || !LU || rnd(bx + 7.7, bz + 3.3) >= LU[2][o] / 255) continue;
            for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
              const r = rnd(bx * 4 + a + 0.5, bz * 4 + b + 0.5), x = x0 + (a + 0.5 + (r - 0.5) * 0.7) * BK / 4, z = z0 + (b + 0.5 + (rnd(r, b) - 0.5) * 0.7) * BK / 4;
              const h = hAt(x, z);
              if (h > 2450 || (h > 1750 && r < 0.6)) continue;
              putTree(x, z, r, rnd(r, a + 9) < (h > 1150 ? 0.6 : 0.27));
            }
            continue;
          }
          if (n > 40) {
            const k = n > 120 ? 3 : 2, g = k === 3 ? [0.012, 0.0287, 0.0455] : [0.0165, 0.041];
            for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) put(x0 + g[a], z0 + g[b], rnd(bx + a, bz + b), 1, 0, roofCols[3]);
          } else {
            const m = Math.min(9, Math.max(1, Math.round(n / 1.2)));
            // 埋まった街区でも1割あまりは庭・駐車場の空き。向きも少しずつずらす（全部の区画がきっちり埋まると、型で押したように単調だった）
            for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
              const r = rnd(bz * 3 + b, bx * 3 + a);
              if (rnd(bx * 3 + a, bz * 3 + b) * 9 >= m || rnd(r, b + 5) < 0.13) continue;
              put(x0 + LOT[a] + (r - 0.5) * 0.005, z0 + LOT[b] + (rnd(r, a) - 0.5) * 0.005, r, 0, (a % 2) * Math.PI / 2 + (b % 2) * Math.PI + (rnd(a, r) - 0.5) * 0.3, roofCols[Math.floor(rnd(a + bx, b + bz) * 4)]);
            }
          }
        }
        sP.set(tP.subarray(0, nS * 3)); sI.set(tI.subarray(0, nS * 3)); sR.set(tR.subarray(0, nS * 3));
        const upd = (a, k, m) => { if (a.addUpdateRange) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(m, 1) * k); } a.needsUpdate = true; };
        for (const a of [iP, iI, iR]) upd(a, 3, nS);
        sg.instanceCount = nS;
        for (const t of trees) { t.P.set(t.tP.subarray(0, t.n * 3)); t.I.set(t.tI.subarray(0, t.n * 2)); upd(t.aP, 3, t.n); upd(t.aI, 2, t.n); t.g.instanceCount = t.n; }
      }
      let worst = 0;
      on('frame', () => {
        const R = U.uNearR.value;
        if (!group.visible || U.uNear3D.value < 0.5 || R <= 0) {
          if (sg.instanceCount || trees[0].g.instanceCount || trees[1].g.instanceCount) { sg.instanceCount = 0; for (const t of trees) t.g.instanceCount = 0; last = null; }
          job = null; return;
        }
        const p = M.inner.camera.position;
        if (!last || Math.hypot(p.x - last[0], p.z - last[1]) >= 0.25 || Math.abs(R - last[2]) >= 0.15) {
          last = [p.x, p.z, R];
          job = rebuild(p.x, p.z, R + 0.35, R * 0.55 + 0.25);
        }
        if (!job) return;
        const t0 = performance.now();
        while (performance.now() - t0 < 3) if (job.next().done) { job = null; break; }
        worst = Math.max(worst, performance.now() - t0);
      });
      nearHouses = () => sg.instanceCount;
      nearHouses.trees = () => trees[0].g.instanceCount + trees[1].g.instanceCount;
      // 検査用：置き直しを1度に通した時間（ms）と、少しずつ作った1コマのいちばん長い時間
      nearHouses.rebuildMs = () => { const t = performance.now(), p = M.inner.camera.position, R = U.uNearR.value; for (const _ of rebuild(p.x, p.z, R + 0.35, R * 0.55 + 0.25)); return performance.now() - t; };
      nearHouses.worst = () => { const w = worst; worst = 0; return w; };
    }

    // ---- 線（川・鉄道・高速道路）。点は km×100 の整数
    function lines(list, opt) {
      const A = [], B = [], SE = [], IA = [], Wd = [], Fa = [], La = [], IX = [];
      let n = 0;
      for (const L of list) {
        const s0 = opt.head || 0, st = opt.stride || 2;
        let prev = null, run = 0;
        const push = (x, z, y, w) => {
          const cur = { x, y, z, w, f: fadeOf(dAt(x, z)), l: run };
          if (prev) {
            cur.l = run = prev.l + Math.hypot(x - prev.x, z - prev.z);
            for (let e = 0; e < 4; e++) {
              A.push(prev.x, prev.y, prev.z); B.push(cur.x, cur.y, cur.z);
              SE.push(e % 2 ? 1 : -1, e < 2 ? 0 : 1); IA.push(63); Wd.push(prev.w);
              Fa.push(e < 2 ? prev.f : cur.f); La.push(prev.l, cur.l);
            }
            IX.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); n += 4;
          }
          prev = cur;
        };
        // 地面の高さで引く線（川・道）は、間の地面が 3m 以上ずれる所に点を足す。長い区間の帯が地面にもぐり、
        // 空を飛ぶ眺めで川が切れ切れの青い板に見えた（2026-10-30）
        const fill = (x0, z0, h0, x1, z1, h1, w, k) => {
          const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, hm = hAt(mx, mz);
          if (k > 5 || Math.hypot(x1 - x0, z1 - z0) < 0.1 || Math.abs((h0 + h1) / 2 - hm) < 3) return;
          fill(x0, z0, h0, mx, mz, hm, w, k + 1); push(mx, mz, hm * EXI + 0.03, w); fill(mx, mz, hm, x1, z1, h1, w, k + 1);
        };
        let px = null, pz = 0, ph = 0;
        for (let q = s0; q < L.length; q += st) {
          const x = L[q] / 100, z = L[q + 1] / 100, w = opt.w(L, q);
          if (opt.y) { push(x, z, opt.y(L, q) * EXI + 0.03, w); continue; }
          const h = hAt(x, z);
          if (px !== null) fill(px, pz, ph, x, z, h, w, 0);
          push(x, z, h * EXI + 0.03, w);
          px = x; pz = z; ph = h;
        }
      }
      return X.geo([['position', new Float32Array(A), 3], ['aB', new Float32Array(B), 3], ['aSE', new Float32Array(SE), 2], ['aId', new Float32Array(IA), 1],
        ['aIdB', new Float32Array(IA), 1], ['aW', new Float32Array(Wd), 1], ['aF', new Float32Array(Fa), 1], ['aL', new Float32Array(La), 2]], new Uint32Array(IX));
    }
    const KM = { km: true, fade: true }, DASH = { km: true, fade: true, dash: true };
    // 川は、画面で1画素より細い所を太らせずに薄く描く（thin）。岐阜の海津の田の排水路が、最低の太さと墨の縁で描かれ、
    // 平野が川だらけに見えた（本人 2026-10-31「すごく川だらけの場所あるけど、これも正確にやった結果？」）。広い川の岸の線（集水 0）は幅を負にして薄くしない
    const rg = lines(D.rivers, { stride: 3, w: (L, q) => L[q + 2] ? riverW(L[q + 2]) : -riverW(0) });
    const RV = { km: true, fade: true, thin: true };
    add(new T.Mesh(rg, MARK(DR.line(X, RV, 1.5, null, 34, 1))), 1.5);       // 空を飛ぶ間も実の幅のまま（道は寄った眺めの太さの 0.35）
    add(new T.Mesh(rg, MARK(DR.line(X, RV, 0, null, 34, 1))), 1.6);
    const hw = lines(D.roads.filter((r) => r[0] === 2), { head: 1, w: () => 0.11 });
    // 道と鉄道は、寄っても線の太さで止める（km のまま太らせると、寄った時に線路が帯のように太くなった）
    add(new T.Mesh(hw, MARK(DR.line(X, KM, 1.2, null, 5))), 1.7);
    add(new T.Mesh(hw, MARK(DR.line(X, KM, 0, '#f4e3b0', 5))), 1.8);
    // 線路の絵は、作る時にならした線路の高さで（電車と同じ高さ。地面のでこぼこを拾うと、山の中で電車とずれた）
    const rl = lines(D.rails.filter((L) => L[0] < 10), { head: 1, stride: 3, y: (L, q) => L[q + 2], w: (L) => L[0] ? 0.2 : 0.14 });
    add(new T.Mesh(rl, MARK(DR.line(X, DASH, 1.4, null, 5))), 1.9);
    add(new T.Mesh(rl, MARK(DR.line(X, DASH, 0, '#fffaf0', 5))), 2.0);
    // トンネル（高速道路と、地下鉄を除く線路。印 10 以上）は、同じ線をごくごく薄く（本人 2026-11-01「トンネルを抜けている鉄道や道路は、
    // ごくごく薄く透過して描いておく」）。高さは出入口（線の両端）の地面を道のりの割合でまっすぐ結び、山の中に置いて地面ごしに見せる
    // （山の上の地面に沿わせると「トンネルが山の中ではなく表面を通っている」と見えた）。電車はトンネルの中では今まで通り隠す
    const GH = (o) => Object.assign({ ghost: 0.16 }, o);
    const tunY = (head, st) => {
      const memo = new Map();
      return (L, q) => {
        let m = memo.get(L);
        if (!m) {
          const cum = [0];
          for (let i = head + st; i < L.length; i += st) cum.push(cum[cum.length - 1] + Math.hypot(L[i] - L[i - st], L[i + 1] - L[i - st + 1]) / 100);
          m = { cum, h0: hAt(L[head] / 100, L[head + 1] / 100), h1: hAt(L[L.length - st] / 100, L[L.length - st + 1] / 100) };
          memo.set(L, m);
        }
        return m.h0 + (m.h1 - m.h0) * m.cum[(q - head) / st] / (m.cum[m.cum.length - 1] || 1);
      };
    };
    const hwT = lines(D.roads.filter((r) => r[0] === 12), { head: 1, y: tunY(1, 2), w: () => 0.11 });
    add(new T.Mesh(hwT, MARK(DR.line(X, GH(KM), 1.2, null, 5))), 1.7);
    add(new T.Mesh(hwT, MARK(DR.line(X, GH(KM), 0, '#f4e3b0', 5))), 1.8);
    const rlT = lines(D.rails.filter((L) => L[0] >= 10), { head: 1, stride: 3, y: tunY(1, 3), w: (L) => L[0] % 10 ? 0.2 : 0.14 });
    add(new T.Mesh(rlT, MARK(DR.line(X, GH(DASH), 1.4, null, 5))), 1.9);
    add(new T.Mesh(rlT, MARK(DR.line(X, GH(DASH), 0, '#fffaf0', 5))), 2.0);
    // 近くの線路（車窓・空を飛ぶの間だけ・カメラから 3km）：砂利の帯に枕木と2本のレール。幅は電車の絵に合わせる（実物より太い）。
    // 高さは電車と同じ、ならした線路の高さ（rails の点の3つ目）
    {
      // 帯の横幅は、低く飛ぶ間（uNearK）は電車と一緒に縮める（実の大きさの見当で複線 約14m）。枕木の間も同じ割合で
      const TP = [], TO = [], TA = [], TI = [];
      let n0 = 0;
      for (const L of D.rails) {
        if (L[0] >= 10) continue;                        // トンネルの中に砂利と枕木は描かない
        let run = 0;
        for (let q = 4; q + 2 < L.length; q += 3) {
          const ax = L[q - 3] / 100, az = L[q - 2] / 100, ay = L[q - 1], bx = L[q] / 100, bz = L[q + 1] / 100, by = L[q + 2];
          const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1e-6, ox = -dz / len * 0.045, oz = dx / len * 0.045;
          for (const [x, z, y, s, l] of [[ax, az, ay, -1, run], [ax, az, ay, 1, run], [bx, bz, by, -1, run + len], [bx, bz, by, 1, run + len]]) { TP.push(x, y * EXI, z); TO.push(-s * ox, -s * oz); TA.push(s, l); }
          TI.push(n0, n0 + 2, n0 + 1, n0 + 1, n0 + 2, n0 + 3); n0 += 4; run += len;
        }
      }
      const tg = X.geo([['position', new Float32Array(TP), 3], ['aOff', new Float32Array(TO), 2], ['aSL', new Float32Array(TA), 2]], new Uint32Array(TI));
      add(new T.Mesh(tg, X.mat(`
        attribute vec2 aSL, aOff; uniform float uInY, uNear3D, uNearK; varying vec2 vSL; varying float vDist;
        void main() {
          vec3 p = vec3(position.x, position.y * uInY + 0.006 * (1.0 - 0.9 * uNearK), position.z); vSL = aSL;
          p.xz += aOff * (1.0 - 0.85 * uNearK);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); vDist = -mv.z;
          gl_Position = uNear3D < 0.5 || distance(p, cameraPosition) > 3.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
        }`, `
        ${X.FINISH}
        uniform float uNearK;
        varying vec2 vSL; varying float vDist;
        void main() {
          float s = abs(vSL.x), l = vSL.y / (1.0 - 0.85 * uNearK);
          vec3 c = vec3(0.56, 0.53, 0.48) * (0.9 + 0.2 * fract(sin(dot(floor(vec2(vSL.x * 20.0, l * 300.0)), vec2(12.9898, 78.233))) * 43758.5453));
          float sl = step(fract(l / 0.011), 0.42) * step(s, 0.62);                 // 枕木
          c = mix(c, vec3(0.40, 0.31, 0.24), sl);
          float rail = 1.0 - smoothstep(0.03, 0.06, abs(s - 0.34));                // レール2本
          c = mix(c, vec3(0.72, 0.73, 0.76), rail);
          c = mix(c, vec3(0.30, 0.28, 0.26), smoothstep(0.85, 1.0, s));           // 砂利の縁
          gl_FragColor = vec4(finish(c, vec3(0.0), vDist), 1.0);
        }`, { side: T.DoubleSide })), 2.05);
    }
    // ---- 電車（本人 2026-10-27「各県内の路線に新幹線や電車も走らせたい」）
    const busy = new Map();                              // 駅の番号 → 電車が着いた時刻（駅の札を少しの間光らせる）
    const trains = makeTrains(D.trains || [], X, T, U, dAt, fadeOf, (id) => busy.set(id, performance.now()),
      ((window.INTRO && INTRO.kanko) || []).filter((k) => k.pref === M.P[M.sel].n));
    add(trains.mesh, 2.1);
    on('frame', () => { if (group.visible) trains.step(); });

    // ---- 湖（水面は岸の低い方から3割の高さ。墨の縁取り）
    const LP = [], LI = [], LF = [];
    let lv0 = 0;
    // 湖は [x, z, …] か、中に島のある物は [[外の輪], [島の輪], …]（島を水で塗らない。横浜港の埠頭 2026-10-30）
    const lakeRing = (L) => {
      const pts = [];
      for (let q = 0; q + 1 < L.length; q += 2) pts.push(new T.Vector2(L[q] / 100, L[q + 1] / 100));
      if (pts.length > 3 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
      return pts;
    };
    // 川の水面の高さ：まわり 200m のいちばん低い地面（0.4km の格子の地形は細い谷を描けず、岸の頂点は斜面の上に乗る）
    const riverH = (x, z) => { let m = hAt(x, z); for (let i = 0; i < 6; i++) m = Math.min(m, hAt(x + 0.2 * Math.cos(i * 1.047), z + 0.2 * Math.sin(i * 1.047))); return m; };
    for (const L of D.lakes) {
      const rings = Array.isArray(L[0]) ? L.map(lakeRing) : [lakeRing(L)];
      const pts = rings[0], holes = rings.slice(1).filter((h) => h.length >= 3);
      if (pts.length < 3) continue;
      const hs = pts.map((p) => hAt(p.x, p.y)).sort((a, b) => a - b);
      // 岸の高さの差が大きい水面は川（何 km も続く川の水面の形）。1つの高さの平らな面にすると、下流の側で空に浮いた（2026-10-30）ので、地面に沿わせる。
      // 岸の頂点だけで沿わせると、頂点の間の長い三角形が谷をまたいで板のように浮き、斜面を登った（本人の空を飛ぶ眺め 2026-10-30）。
      // 三角形を、その中で低い地面から 4m 以上ずれる間だけ割る（一律に 150m へ割ると、細長い三角形が割れ続けて 18万枚になった）
      const river = hs[hs.length - 1] - hs[0] > 15, y = hs[Math.floor(hs.length * 0.3)] * EXI + 0.05;
      const all = pts.concat(...holes), tri = T.ShapeUtils.triangulateShape(pts, holes);
      if (!river) {
        for (const p of all) { LP.push(p.x, y, p.y); LF.push(fadeOf(dAt(p.x, p.y))); }
        for (const t of tri) LI.push(t[0] + lv0, t[1] + lv0, t[2] + lv0);
        lv0 += all.length;
        continue;
      }
      const vid = new Map(), vh = [];
      const at = (x, z) => {
        const key = Math.round(x * 2000) + ',' + Math.round(z * 2000);
        let i = vid.get(key);
        if (i === undefined) { const h = riverH(x, z); i = lv0++; vid.set(key, i); vh[i] = h; LP.push(x, h * EXI + 0.02, z); LF.push(fadeOf(dAt(x, z))); }
        return i;
      };
      // 割るかは辺ごとに、その辺の両端だけで決める（隣の三角形と同じ答えになり、境に裂け目が出ない）
      // 割らない長い辺のそばは、そこへ寄る細い三角形が際限なく割れ続けたので、深さで止める。
      // 割る目安（6m・150m・深さ6）は三角形の数で決めた：4m・100m・辺の3点・深さ8 では、奈良の水面が 24万枚になり地形より多かった
      const mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
      const split = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]) > 0.15 && Math.abs((vh[at(u[0], u[1])] + vh[at(v[0], v[1])]) / 2 - riverH(...mid(u, v))) > 6;
      const cut = (a, b, c, k) => {
        const s = k < 6 ? [split(a, b), split(b, c), split(c, a)] : [false, false, false], n = s[0] + s[1] + s[2];
        if (!n) { LI.push(at(a[0], a[1]), at(b[0], b[1]), at(c[0], c[1])); return; }
        if (n === 3) { const d = mid(a, b), e = mid(b, c), f = mid(c, a); cut(a, d, f, k + 1); cut(d, b, e, k + 1); cut(f, e, c, k + 1); cut(d, e, f, k + 1); return; }
        // 1辺か2辺：割る辺が先頭に来るように回して
        if (!s[0]) { if (s[1]) { cut(b, c, a, k); return; } cut(c, a, b, k); return; }
        const d = mid(a, b);
        if (n === 1) { cut(a, d, c, k + 1); cut(d, b, c, k + 1); return; }
        if (s[1]) { const e = mid(b, c); cut(d, b, e, k + 1); cut(a, d, e, k + 1); cut(a, e, c, k + 1); return; }
        const f = mid(c, a); cut(a, d, f, k + 1); cut(d, b, c, k + 1); cut(f, d, c, k + 1);
      };
      for (const t of tri) cut([all[t[0]].x, all[t[0]].y], [all[t[1]].x, all[t[1]].y], [all[t[2]].x, all[t[2]].y], 0);
    }
    const lakeG = X.geo([['position', new Float32Array(LP), 3], ['aF', new Float32Array(LF), 1]], new Uint32Array(LI));
    add(new T.Mesh(lakeG, X.mat(`
      attribute float aF; uniform float uInY; varying float vF, vDist; varying vec3 vW;
      void main() { vF = aF; vec3 p = vec3(position.x, position.y * uInY, position.z); vW = p; vec4 mv = modelViewMatrix * vec4(p, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`, `
      uniform sampler2D uPal; uniform float uSeason; uniform vec3 uFoam;
      ${X.FINISH}
      varying float vF, vDist; varying vec3 vW;
      void main() {
        vec3 c = texture2D(uPal, vec2(23.5 / 32.0, (uSeason + 0.5) / 4.0)).rgb;
        c = mix(c, vec3(1.0), 0.18 + 0.06 * sin(vW.x * 9.0 + vW.z * 4.0));
        c = finish(c, vec3(0.0), vDist);
        gl_FragColor = vec4(c * vF, vF);
      }`, { side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })), 1.4);

    // ---- 名だたる塔（本人 2026-11-01「東京に東京タワーとスカイツリーが何もないのはちょっと寂しい」）：目印の絵が tower・skytree の所に塔の立体。
    // 目印の絵札は寄った時だけで、家の絵札に押されて薄くなる。地図の中に立てて遠くから見えるように。大きさは実の2倍（家 50m・ビル 100m の絵より
    // 頭ひとつ抜ける）。山や家は低く飛ぶほど本物の高さに近づけるが、塔は目印なので飛ぶ間も2倍のまま。家の立体と同じく、少し太らせた裏を墨で塗って輪郭に。夜はライトアップの色
    {
      const towerAt = ((window.INTRO && INTRO.spots) || []).filter((s) => s.pref === M.P[M.sel].n && (s.icon === 'tower' || s.icon === 'skytree'));
      const hex = (h) => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, NO = [0, 0, 0];
      const V = [], N = [], C = [], G = [], B = [];
      let base = NO;
      const tri = (a, b, c, col, glow) => {
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1;
        for (const p of [a, b, c]) { V.push(...p); N.push(n[0] / l, n[1] / l, n[2] / l); C.push(...col); G.push(...glow); B.push(...base); }
      };
      // 角の台：sides 角、下の中心 o0・角までの半径 r0・高さ y0 → 上の o1・r1・y1（km）。外から見て反時計回りを表に、上下にふた
      const seg = (sides, r0, y0, r1, y1, col, glow = NO, rot = Math.PI / 4, o0 = [0, 0], o1 = o0) => {
        const at = (o, r, y, k) => { const a = rot - k / sides * Math.PI * 2; return [o[0] + Math.cos(a) * r, y, o[1] + Math.sin(a) * r]; };
        for (let k = 0; k < sides; k++) {
          const a = at(o0, r0, y0, k), b = at(o0, r0, y0, k + 1), c = at(o1, r1, y1, k + 1), d = at(o1, r1, y1, k);
          tri(a, b, c, col, glow); tri(a, c, d, col, glow);
          tri([o1[0], y1, o1[1]], d, c, col, glow); tri([o0[0], y0, o0[1]], b, a, col, glow);
        }
      };
      const SHAPE = {
        // 東京タワー（333m）：角から立ち上がる4本の脚、上へすぼまる赤と白の段、大展望台（150m）と特別展望台（250m）、アンテナ
        tower() {
          const O = hex('#e0532c'), W = hex('#f4efe6'), WIN = hex('#6f9cc8'), L = hex('#ff8a3a'), LW = hex('#ffd890');
          const r = (y) => 0.0055 + 0.05 * Math.pow(1 - Math.min(1, y / 0.25), 2.2);
          for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) seg(4, 0.008, 0, 0.006, 0.06, O, L, Math.PI / 4, [sx * 0.033, sz * 0.033], [sx * 0.0175, sz * 0.0175]);
          const ys = [0.055, 0.085, 0.115, 0.145];
          for (let k = 0; k < ys.length - 1; k++) seg(4, r(ys[k]), ys[k], r(ys[k + 1]), ys[k + 1], k % 2 ? W : O, L);
          seg(4, r(0.145) + 0.006, 0.145, r(0.145) + 0.006, 0.16, W, LW); seg(4, r(0.145) + 0.0066, 0.15, r(0.145) + 0.0066, 0.155, WIN, LW);
          const ys2 = [0.16, 0.19, 0.22, 0.245];
          for (let k = 0; k < ys2.length - 1; k++) seg(4, r(ys2[k]), ys2[k], r(ys2[k + 1]), ys2[k + 1], k % 2 ? O : W, L);
          seg(4, r(0.245) + 0.003, 0.245, r(0.245) + 0.003, 0.252, W, LW);
          seg(4, 0.0025, 0.252, 0.0015, 0.29, O, L); seg(4, 0.0015, 0.29, 0.0004, 0.333, W, L);
        },
        // 東京スカイツリー（634m）：白い八角の塔、天望デッキ（350m）と天望回廊（450m）、上の電波塔
        skytree() {
          const S = hex('#e8edf2'), D = hex('#d4dfea'), WIN = hex('#4f8fca'), L = hex('#8fd8ff'), LW = hex('#d6ecff'), R8 = Math.PI / 8;
          const r = (y) => 0.016 + 0.024 * Math.pow(1 - Math.min(1, y / 0.34), 1.5);
          const ys = [0, 0.06, 0.12, 0.24, 0.34];
          for (let k = 0; k < ys.length - 1; k++) seg(8, r(ys[k]), ys[k], r(ys[k + 1]), ys[k + 1], S, L, R8);
          seg(8, 0.026, 0.34, 0.026, 0.362, D, LW, R8); seg(8, 0.0266, 0.346, 0.0266, 0.355, WIN, LW, R8);
          seg(8, 0.016, 0.362, 0.0135, 0.445, S, L, R8);
          seg(8, 0.0195, 0.445, 0.0195, 0.458, D, LW, R8); seg(8, 0.02, 0.449, 0.02, 0.454, WIN, LW, R8);
          seg(8, 0.0125, 0.458, 0.011, 0.497, S, L, R8);
          seg(8, 0.0065, 0.497, 0.005, 0.62, S, L, R8); seg(4, 0.0015, 0.62, 0.0005, 0.634, S, L);
        },
      };
      for (const s of towerAt) { const [x, z] = wp(...at0(s)); base = [x, hAt(x, z) * EXI, z]; SHAPE[s.icon](); }
      if (V.length) {
        const g = new T.BufferGeometry();
        for (const [k, a] of [['position', V], ['normal', N], ['aCol', C], ['aGlow', G], ['aBase', B]]) g.setAttribute(k, new T.Float32BufferAttribute(a, 3));
        const towerVS = (ink) => `
          attribute vec3 aCol, aGlow, aBase; uniform float uInY; uniform vec3 uLdir;
          varying vec3 vC, vG; varying float vDist;
          void main() {
            // 遠くから見る時は、距離に比べて小さくなりすぎないよう大きくする（家の絵札と同じく、遠くの眺めでも目印として読める大きさに）。
            // 実の3倍・距離×0.45 では、スカイツリー（東京タワーの約2倍）が寄りで画面を突き抜け、遠くで太い柱になった。8倍で止める。
            // 低く飛ぶ間も2倍より小さくしない（実の大きさまで縮めると、遠くで大きかった東京タワーが近づくと家並みに埋もれた。本人 2026-11-01）
            vec3 b = vec3(aBase.x, aBase.y * uInY, aBase.z);
            float s = min(8.0, max(2.0, 0.3 * distance(b, cameraPosition)));
            vec3 w = b + position * s;
            ${ink ? 'w += normal * 0.0012 * distance(w, cameraPosition);' : ''}
            vC = ${ink ? 'vec3(0.165, 0.192, 0.275)' : 'aCol * (0.9 + 0.18 * max(dot(normal, uLdir), 0.0))'};
            vG = ${ink ? 'vec3(0.0)' : 'aGlow'};
            vec4 mv = modelViewMatrix * vec4(w, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv;
          }`;
        const towerFS = `
          ${X.FINISH}
          varying vec3 vC, vG; varying float vDist;
          void main() {
            vec3 c = finish(vC, vec3(0.0), vDist);
            gl_FragColor = vec4(mix(c, vG * (0.75 + 0.25 * vC.r), uNight * 0.65 * step(0.01, vG.r + vG.g + vG.b)), 1.0);
          }`;
        add(new T.Mesh(g, X.mat(towerVS(false), towerFS)), 3.1);
        add(new T.Mesh(g, X.mat(towerVS(true), towerFS, { side: T.BackSide })), 3.1);
      }
    }

    // ---- 寄せた島の点線の枠（海の上。本当の距離ではないことを、地図の上でも見せる。札は moveL）
    if (MV.length) {
      const v = [];
      for (const m of MV) {
        const a = m.box[0] - 1, b = m.box[1] - 1, c = m.box[2] + 1, d = m.box[3] + 1;
        v.push(a, 0.02, b, c, 0.02, b, c, 0.02, b, c, 0.02, d, c, 0.02, d, a, 0.02, d, a, 0.02, d, a, 0.02, b);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
      const ln = new T.LineSegments(g, new T.LineDashedMaterial({ color: 0x3a3f55, dashSize: 0.9, gapSize: 0.6, transparent: true, opacity: 0.75 }));
      ln.computeLineDistances();
      add(ln, 3.3);
    }

    // ---- 地名の札（山＝朱、市＝墨の囲み、町村・峠・湖＝小さく）。重なる札は、大事な物から残す
    // 札の置き場は県ごとに分け、その県の中にいる間だけ出す。全部の県で #inlabels を1つ使い、置き場ごと出し入れしていた時は、
    // 前に入った県の札が最後の位置のまま残った（本人 2026-10-30「宮城を開くと長野の地名が重なって表示されている」）
    const box = $('#inlabels').appendChild(document.createElement('div'));
    // 遠くから見る時は、市と名の知れた山・湖だけ。寄るほど、ほかの山・町村・峠も出す
    // 目印の絵は場所からずらせないので、ずらせる市の札より先に置く
    const PRI = { spot: -1, move: -0.5, city: 0, peak: 1, lake: 2, marsh: 2, town: 3, station: 3.5, pass: 4 };
    // 名の知れた山と湖：設定の一覧。一覧の無い県は、県の中の高い山5つ
    const FAMOUS = new Set((AREAS[name] && AREAS[name].famous) ||
      D.labels.filter((L) => L.in && L.kind === 'peak' && L.m).sort((a, b) => b.m - a.m).slice(0, 5).map((L) => L.name));
    // 同じ名前の山が2つある時（北アルプスの乗鞍岳 3026m と白馬の乗鞍岳 2469m）は、高い方だけを名の知れた山に
    const topOf = new Map();
    // 県の中の札を先に（県外の甲斐駒ヶ岳 2967m が、長野の木曽駒ヶ岳より選ばれていた 2026-10-30）
    const better = (a, b) => a.in !== b.in ? a.in : (a.m || 0) > (b.m || 0);
    for (const L of D.labels) if (FAMOUS.has(L.name) && (!topOf.has(L.name) || better(L, topOf.get(L.name)))) topOf.set(L.name, L);
    const famous = (L) => FAMOUS.has(L.name) && topOf.get(L.name) === L;
    // 名所の建物・乗り物（紹介.js の spots。県庁・観音・遊園地・動物園…）は、寄った時だけ絵と名前を立てる
    const spotL = ((window.INTRO && INTRO.spots) || []).filter((s) => s.pref === M.P[M.sel].n)
      .map((s) => { const [x, z] = wp(...at0(s)); return { kind: 'spot', name: s.name, sub: s.sub, icon: s.icon, x, z, in: true, url: s.url, note: s.note && s, g: s.g }; });
    // 寄せた島の枠の札：「〇〇：本当は南へ約〇km（間の海を縮めています）」。向きは寄せた所から本当の場所へ（x＝東・z＝南）
    const DIR8 = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    const moveL = MV.map((m) => {
      const e = -m.dx, n = m.dz, km = Math.round(Math.hypot(m.dx, m.dz) / 10) * 10;
      const dir = DIR8[((Math.round(Math.atan2(e, n) / (Math.PI / 4)) % 8) + 8) % 8];
      return { kind: 'move', name: `${m.name}：本当は${dir}へ約${km}km（間の海を縮めています）`, x: (m.box[0] + m.box[2]) / 2, z: m.box[1] - 1.2, in: true };
    });
    // 山と湖の観光の一言（紹介.js の yama）：同じ名前の札に付ける。山の点は頂（6km 以内。谷川岳の地理院の注記は頂から 4.7km 離れている）、湖の点は岸の陸（大きな湖の札は真ん中なので 8km 以内）
    const yama = ((window.INTRO && INTRO.yama) || []).filter((y) => y.pref === M.P[M.sel].n).map((y) => { const [wx, wz] = wp(...at0(y)); return Object.assign({}, y, { x: wx, z: wz }); });
    const noteOf = (L) => yama.find((y) => y.name === L.name && (y.kind === '山') === (L.kind === 'peak') && Math.hypot(y.x - L.x, y.z - L.z) < (y.kind === '山' ? 6 : 8));
    // 駅（本人 2026-10-27「駅の情報を作って」）：県の中の駅の札。押すと駅の案内（駅.js）。線が2つ以上の駅と新幹線の駅は少し寄れば、ほかは寄った時に
    const served = new Set((D.trains || []).flatMap((t) => t.st.map((q) => q[2])));     // 地図の電車が止まる駅
    // 駅の豆知識（豆知識.json の eki の欄）がある駅は、札に「？」を付ける（豆を駅に置くと札と重なるので、県の中では札が受け持つ）
    // 同じ名前の駅が2つある所（阪神とJRの尼崎）は、豆知識の場所にいちばん近い方の駅に付ける（もう一方の札に出すと、遠い駅の話になる）
    // 駅の札の見る情報（見る物.js）は「鉄道」と、その駅の豆知識のジャンル（駅の豆知識は、土地の食や歴史の話が多い）
    for (const s of D.stations || []) { s._mame = []; s._g = ['tetsudo']; }
    for (const d of (window.INTRO && INTRO.mame) || []) {
      if (!d.eki || d.pref !== M.P[M.sel].n) continue;
      let best = null, bd = Infinity;
      for (const s of D.stations || []) if (s.n === d.eki) { const q = Math.hypot(s.x / 100 - d.x, s.z / 100 - d.z); if (q < bd) { bd = q; best = s; } }
      if (best) { best._mame.push(d.id); best._g.push(...(d.g || [])); }
    }
    const ekiL = (D.stations || []).map((s, i) => ({ kind: 'station', name: s.n, x: s.x / 100, z: s.z / 100, in: true, st: s, id: i,
      hub: s.l.length >= 2 || s.l.some((l) => l[2] === 2), mame: s._mame.length ? s._mame : undefined, g: s._g }));
    const labs = D.labels.filter((L) => L.in || L.kind === 'peak' || L.kind === 'lake' || L.kind === 'marsh').concat(spotL, ekiL, moveL).map((L) => {
      const d = document.createElement('div');
      d.className = 'tag t-' + L.kind + (L.hub ? ' hub' : '');
      if (L.kind === 'station') {
        d.textContent = L.name;
        d.title = L.name + '駅（押すと駅の案内' + (L.mame ? '・豆知識あり' : '') + '）';
        if (L.mame) { const q = document.createElement('i'); q.textContent = '？'; d.appendChild(q); d.classList.add('qa'); }
        d.addEventListener('click', () => window.EKI && EKI.open(L.st, L.id, d, served.has(L.id)));
      } else if (L.kind === 'spot') {
        const im = document.createElement('img'), sp = document.createElement('span');
        im.src = MEIBUTSU.url(L.icon); im.alt = ''; sp.textContent = L.name + (L.url ? ' ›' : '');
        if (L.icon === 'tower' || L.icon === 'skytree') im.style.display = 'none';     // 塔は地図の中に立体で立てた（上の「名だたる塔」）。絵札を重ねると二重に見えた
        if (L.sub) { const sm = document.createElement('small'); sm.textContent = L.sub; sp.prepend(sm); }
        d.append(im, sp);
        // 工房の案内など、行き先のある目印は押すと別のタブで開く
        if (L.url) { d.classList.add('link'); d.title = '新しいタブで開きます'; d.addEventListener('click', () => window.open(L.url, '_blank', 'noopener')); }
      } else d.textContent = L.name;
      // 観光の一言のある札：小さな赤い点。押すと一言（一言.js）
      const note = L.kind === 'spot' ? L.note : (L.kind === 'peak' || L.kind === 'lake' || L.kind === 'marsh') && noteOf(L);
      if (note && window.HITO) {
        d.classList.add('note'); d.title = '押すと観光の一言';
        d.addEventListener('click', () => HITO.open(note, d, L.kind === 'spot' ? '名所' : L.kind === 'peak' ? '山' : '湖'));
      }
      if (L.m) { const s = document.createElement('small'); s.textContent = ' ' + L.m + 'm'; d.appendChild(s); }
      box.appendChild(d);
      // 工房の案内（行き先のある目印）は、ほかの目印より先に・少し遠くからも出す
      const zoom = L.kind === 'station' ? (L.hub ? 1 : 2) : L.kind === 'city' || L.kind === 'move' || famous(L) ? 0 : L.kind === 'peak' || L.kind === 'lake' || L.url ? 1 : L.kind === 'town' || L.kind === 'spot' ? 2 : 3;
      // 札.js のテーマ：市と名の知れた山・湖は地図の骨としていつも出す（null）。名所の絵もいつも出し、名前だけテーマか灯りで
      const theme = L.kind === 'station' ? '駅' : L.kind === 'spot' ? '名所' : zoom === 0 ? null : '地名';
      return { L, d, zoom, theme, y: hAt(L.x, L.z) * EXI, pri: PRI[L.kind] + (L.in ? 0 : 0.5) - (L.m || 0) / 1e5 - (L.url ? 1 : 0) - (L.hub ? 0.1 : 0) };
    }).sort((a, b) => a.pri - b.pri);
    const mameLabs = window.MAME ? labs.filter((q) => q.L.mame) : [];
    const grid = new Map(), GS = 80, gk = (i, j) => (i + 64) * 8192 + j + 64;
    const gAdd = (r) => { for (let i = Math.floor(r[0] / GS); i <= Math.floor(r[2] / GS); i++) for (let j = Math.floor(r[1] / GS); j <= Math.floor(r[3] / GS); j++) { const k = gk(i, j); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(r); } };
    const gHit = (r) => { for (let i = Math.floor(r[0] / GS); i <= Math.floor(r[2] / GS); i++) for (let j = Math.floor(r[1] / GS); j <= Math.floor(r[3] / GS); j++) { const a = grid.get(gk(i, j)); if (a && a.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) return true; } return false; };
    let measured = false, ui = null;
    const uiRects = () => ['#title', '#search', '#card.open', '#bar', '#note', '#compass', '.kasumi'].flatMap((s) => [...document.querySelectorAll(s)])
      .map((e) => e.getBoundingClientRect()).filter((r) => r.width).map((r) => [r.left, r.top, r.right, r.bottom]);
    const onResize = () => { ui = null; };
    addEventListener('resize', onResize);
    on('select', () => { ui = null; });
    on('world', () => { ui = null; });
    // 印（案内.js）を置いた後に並べる（印の場所を先に知るため、毎コマの知らせで動かす）
    on('frame', () => {
      const on = group.visible;
      box.style.display = on ? '' : 'none';
      if (!on) return;
      if (!measured) { for (const q of labs) { q.w = q.d.offsetWidth; q.h = q.d.offsetHeight; } measured = true; }
      if (!ui) ui = uiRects();
      const z = M.cam.D / home.D, lvl = z > 0.75 ? 0 : z > 0.45 ? 1 : z > 0.25 ? 2 : 3, now = performance.now();
      // 置いた札の箱は、画面を 80 画素の升に分けて覚え、近くの升の箱とだけ比べる（全部と比べると、札を全部出した時に
      // 1コマ 10ms を超え、遊覧の途中でコマが止まった。2026-10-30）
      grid.clear();
      for (const r of ui.concat(M.pinRects || [])) gAdd(r);
      // 駅の豆知識：開いたら「？」を淡く。豆知識帳から探しに来た駅は、遠くからでも、ほかの札より先に置いて光らせる
      const hunt = window.MAME && MAME.huntId();
      let first = null;
      for (const q of mameLabs) {
        const h = q.L.mame.includes(hunt), g = q.L.mame.every((id) => MAME.has(id));
        if (h !== q.hunt) { q.hunt = h; q.d.classList.toggle('hunt', h); }
        if (g !== q.got) { q.got = g; q.d.classList.toggle('got', g); }
        if (h) first = q;
      }
      const shown = new Set(), F = window.FUDA;
      for (const q of first ? [first].concat(labs.filter((o) => o !== first)) : labs) {
        const s = M.project(q.L.x, q.y * U.uInY.value + 0.2, q.L.z);
        // 札.js：濃さ。地図の骨と名所の絵はいつも（寄り具合の決まりのまま）。ほかはテーマを出しているか灯りの中だけで、その時は寄り具合によらず出す。
        // 探しに来た駅・案内を開いている駅はいつも。豆知識のある駅は、豆知識のテーマでも出す
        const base = !q.theme || q.L.kind === 'spot';
        let lit = 1;
        if (!base && !q.hunt && !q.d.classList.contains('on') && F) {
          lit = F.show(q.theme, s.x, s.y);
          if (q.L.mame) lit = Math.max(lit, F.show('豆', s.x, s.y));
        }
        // 置く所：地点の上 → 下 → 右 → 左（上が印や別の札でふさがっていたら、ほかの側へ。前橋・高崎が印に負けて消えた）
        let at = null;
        // 目印の絵は、足もとをその場所に（ずらさない）
        // 目印の絵は、足もとをその場所に。ふさがっていたら、少しだけ左右にずらす（印のすぐそば）
        // 見る情報（見る物.js）で選んでいないジャンルの目印・駅は出さない（探しに来た駅・開いている札は出す）
        const miru = !q.L.g || !window.MIRU || q.hunt || MIRU.any(q.L.g) || q.d.classList.contains('on');
        if (miru && (base ? q.zoom <= lvl : lit > 0.05) && s.ok) for (const [x, y] of q.L.kind === 'spot' ? [[s.x - q.w / 2, s.y - q.h + 3], [s.x + 6, s.y - q.h + 3], [s.x - q.w - 6, s.y - q.h + 3], [s.x + 30, s.y - q.h + 20], [s.x - q.w - 30, s.y - q.h + 20]] : [[s.x - q.w / 2, s.y - q.h - 6], [s.x - q.w / 2, s.y + 6], [s.x + 8, s.y - q.h / 2], [s.x - q.w - 8, s.y - q.h / 2],
          [s.x + 6, s.y + 4], [s.x - q.w - 6, s.y + 4], [s.x - q.w / 2, s.y + 26], [s.x + 22, s.y - q.h / 2], [s.x - q.w - 22, s.y - q.h / 2],
          [s.x - q.w / 2, s.y + 48], [s.x + 44, s.y - q.h / 2], [s.x - q.w - 44, s.y - q.h / 2], [s.x + 30, s.y + 24], [s.x - q.w - 30, s.y + 24]]) {
          if (x < 0 || y < 0 || x + q.w > M.vw || y + q.h > M.vh) continue;
          const r = [x - 3, y - 2, x + q.w + 3, y + q.h + 2];
          if (gHit(r)) continue;
          at = [x, y]; gAdd(r); break;
        }
        const op = at ? (base ? 1 : lit) : 0;
        if (op !== q.op) { q.d.style.opacity = op; q.op = op; }
        const pe = op > 0.5 ? '' : 'none';                      // 隠した札・薄い札（駅・行き先のある目印）は押せない
        if (pe !== q.pe) { q.d.style.pointerEvents = pe; q.pe = pe; }
        if (q.L.kind === 'spot' && at && F) { const t = q.d.lastChild, o = F.show('名所', s.x, s.y - q.h / 2).toFixed(2); if (o !== q.so) { t.style.opacity = o; q.so = o; } }
        if (q.L.mame && op > 0.5) shown.add(q.L.name);
        if (at) q.d.style.transform = `translate(${at[0].toFixed(1)}px, ${at[1].toFixed(1)}px)`;
        if (q.L.kind === 'station') { const bz = now - (busy.get(q.L.id) ?? -1e9) < 2600; if (bz !== q.bz) { q.d.classList.toggle('busy', bz); q.bz = bz; } }
      }
      M.ekiShown = shown;              // 豆知識.js：札が出ている駅には、光の粒を置かない
    });

    // ---- 入った時の眺め：南南東から、県全体が画面の空いた所（上の題・検索と、下の並び・札の窓のあいだ）に収まる距離と位置
    // 県境の点と山の頂を、地面の高さで写して収める（高さを入れないと、北の山が画面の上で切れた）
    const ring = [];
    for (const r of D.border) for (let q = 0; q + 1 < r.length; q += 2) ring.push([r[q] / 100, r[q + 1] / 100, hAt(r[q] / 100, r[q + 1] / 100) * EXI]);
    // 収めるのは本土（全国の眺めで県に寄る範囲 p.fr と同じ。東京は伊豆諸島と寄せた島まで入れると引きすぎた）。動ける箱（box）は島まで
    const homeIn = (x, z) => !(PK && PK.fr < 380) || (x - PK.ax) ** 2 + (z - PK.az) ** 2 <= PK.fr * PK.fr;
    const fitPts = ring.filter(([x, z]) => homeIn(x, z)).concat(D.labels.filter((L) => L.in && L.kind === 'peak' && homeIn(L.x, L.z)).map((L) => [L.x, L.z, hAt(L.x, L.z) * EXI]));
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const [x, z] of ring) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    // 空いた所は画面の部品を測って決める（入った後に map3d.js の enter が呼び直す）。前は右の札の窓のぶん一定の割合で左へ寄せていたので、
    // 札の窓が下に出るスマホの縦長の画面では、県の半分が左の外へ出た（2026-11-08 本人「県の中に入るといきなり中心に絵図がなくずれている（群馬は左にずれていた）」）
    const th = 0, home = {}, DL = [10, 420];     // 北が上（本人 2026-11-11「東西南北を上下左右に合わせて」。前は -0.18＝少し回していた）
    const fitHome = () => {
      const W = M.vw, H = M.vh;
      let t = 0, b = H, r = W;
      for (const q of ['#title', '#search', '#compass', '#card', '#note', '#bar', '#menu-open']) {
        const e = $(q);
        if (!e || !e.offsetWidth || (q === '#card' && !e.classList.contains('open'))) continue;
        const c = e.getBoundingClientRect();
        if (q === '#card' && c.left > W * 0.4 && c.height > H * 0.5) r = Math.min(r, c.left);
        else if (c.top + c.bottom < H) t = Math.max(t, c.bottom);
        else b = Math.min(b, c.top);
      }
      Object.assign(home, M.fit(th, 0.62, fitPts, [-1 + 24 / W, (r - 12) / W * 2 - 1, 1 - (b - 8) / H * 2, 1 - (t + 8) / H * 2]));
      home.D *= 1.08;
      DL[1] = Math.max(420, home.D * 1.6);
    };
    fitHome();
    // 入る時・出る時（map3d.js の enter・leave が「県の中」の知らせの前に呼ぶ）：紹介・目印・山と湖・豆知識の点のうち、寄せた島の本当の場所にある物を寄せる・戻す
    const lists = () => [INTRO.items, INTRO.spots, INTRO.yama, INTRO.mame].filter(Boolean);
    const warpIn = () => {
      if (!MV.length || !window.INTRO) return;
      for (const arr of lists()) for (const e of arr) if (e.pref === PK.n && !e._mv) {
        const [x, z] = wp(e.x, e.z);
        if (x !== e.x || z !== e.z) { e._mv = [e.x, e.z]; e.x = x; e.z = z; }
      }
    };
    const warpOut = () => {
      if (!MV.length || !window.INTRO) return;
      for (const arr of lists()) for (const e of arr) if (e._mv) { [e.x, e.z] = e._mv; delete e._mv; }
    };
    return {
      name, group, home, fitHome, fitPts, warpIn, warpOut, move: MV,
      dispose() {
        for (const [e, f] of subs) M.off(e, f);
        removeEventListener('resize', onResize);
        box.remove();
        X.scene.remove(group);
        group.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          for (const m of [].concat(o.material || [])) m.dispose();
        });
        tw.dispose(); if (LUT) LUT.dispose();
      },
      box: [x0 - 6, z0 - 6, x1 + 6, z1 + 6], D: DL,
      heightAt: (x, z) => hAt(x, z) * EXI * U.uInY.value,           // 空を飛ぶ間は、山の強め方を下げる（旅.js）
      exag: EXI * 1000,
      pop: { cnt: popCnt, S: cell, hh: D.hhIn, people: D.popIn, perHouse: PER_HOUSE },
      // 空を飛ぶ間の「いま〇〇のあたり」：県の中の市と町村の役場の位置（地理院の注記）。境のデータは無いので「あたり」と言う
      places: D.labels.filter((L) => L.in && (L.kind === 'city' || L.kind === 'town')).map((L) => ({ name: L.name, x: L.x, z: L.z })),
      trains: { runs: trains.runs.length, cars: trains.runs.reduce((a, r) => a + r.cars, 0), cars0: () => trains.cars0(), freeze: trains.freeze, state: trains.state,
        arrived: () => [...busy.entries()].map(([id, t]) => [id, Math.round(performance.now() - t)]) },
      stats: { tris: idx.length / 3, trees: P.length / 3, rivers: rg.index.count / 3, rails: rl.index.count / 3, roads: hw.index.count / 3, lakes: LI.length / 3, labels: labs.length,
        forest: { conifer: forestCnt[0], broad: forestCnt[1], target: SH ? SH.conifer : null, base: baseShare, odds: +ODDS.toFixed(3) } },
      fine: () => fineN(), fineBusy: () => fineBusy(), fineLag: () => fineLag(), fineBudget: (ms) => fineBudget(ms), nearHouses: () => nearHouses(), nearTrees: () => (nearHouses.trees ? nearHouses.trees() : 0), nearRebuildMs: () => nearHouses.rebuildMs ? nearHouses.rebuildMs() : 0, nearWorstMs: () => nearHouses.worst ? nearHouses.worst() : 0,
    };
  }

  // ---------------------------------------------------------------- 人口の表示（県の中だけ・入れる／消す）
  // 木を隠して家とビルだけにし、地面を1km² あたりの世帯数で塗る。左の端に、いまの見え方で家の絵1つが何世帯・何人かを出す
  const popBtn = $('#pop-open'), popBox = $('#pop');
  const man = (n) => (n >= 1e4 ? (Math.round(n / 1e3) / 10).toLocaleString() + '万' : Math.round(n).toLocaleString());
  const round2 = (n) => (n < 100 ? Math.max(5, Math.round(n / 5) * 5) : Number(n.toPrecision(2)));
  let lastPer = 0;
  function setPop(on) {
    const w = M.inside;
    if (on && !(w && w.pop)) on = false;
    M.inner.U.uPop.value = on ? 1 : 0;
    popBtn.querySelector('.lab').textContent = popBtn.dataset.tip = on ? '人口の表示を消す' : '人口を表示';
    popBtn.classList.toggle('on', on);
    popBox.classList.toggle('open', on);
    lastPer = 0;
    if (on) $('#pop-total').textContent = `${w.name}県の中：${man(w.pop.hh)}世帯・${man(w.pop.people)}人`;
  }
  // 全国の眺めでは、日本のデータの窓（案内.js の NATDATA）
  popBtn.addEventListener('click', () => (M.inside ? setPop(!M.inner.U.uPop.value) : window.NATDATA && NATDATA.toggle()));
  M.on('world', (w) => { if (!w) setPop(false); });
  M.on('frame', () => {
    const w = M.inside;
    if (!M.inner.U.uPop.value || !w || !w.pop) return;
    // 段ごとの家の絵の数と、画面の真ん中の近さで、いま見えている絵の割合を数える（描き込み.js の段の出し方と同じ式）
    const p = w.pop, ppk = M.inner.U.uPpk.value / Math.max(M.cam.D, 1);
    let all = 0, seen = 0;
    p.cnt.forEach((c, L) => { all += c; seen += c * (L === 0 ? 1 : smooth(5.5, 9, p.S * Math.pow(2, 3 - L) * ppk)); });
    const per = round2(p.perHouse * all / Math.max(seen, 1e-6));
    if (per === lastPer) return;
    lastPer = per;
    const pph = p.people / p.hh;
    $('#pop-house').textContent = `家の絵1つ ≒ ${per.toLocaleString()}世帯（およそ${round2(per * pph).toLocaleString()}人）`;
    $('#pop-bldg').textContent = `ビルの絵1つ ≒ ${(per * 3).toLocaleString()}世帯（およそ${round2(per * 3 * pph).toLocaleString()}人）`;
  });
  window.POPMODE = { set: setPop, get on() { return !!M.inner.U.uPop.value; } };
})();
