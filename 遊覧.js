// 空から遊覧。2通り：
//   県の中（群馬）…紹介の名所を南から近い順にめぐる。旬のある紹介は、その季節の色で見せる
//   全国…47都道府県を北から南へめぐる。着いた県は地層からせり上がり、ほかの県は少し沈む。短い紹介を読む
// 名所と名所のあいだは上へ弧を描いて飛び、着いたら少し寄って、ゆっくり回りながら一言を読む。
// 地図に触ると止まり、「続きから」でもどる。Esc で遊覧だけを終える
(function () {
  'use strict';
  const M = window.MAP3D, IN = window.INTRO;
  if (!M || !IN) return;
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const toward = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const SEASON = ['春', '夏', '秋', '冬'];
  const seasonOf = (m) => (m >= 3 && m <= 5 ? 0 : m >= 6 && m <= 8 ? 1 : m >= 9 && m <= 11 ? 2 : 3);
  const D_STOP = 24, PH_STOP = 0.5;                // 県の中の名所での近さ（km）と見下ろす角
  // 全国の順路：北から南へ、となりの県へつないで
  const ROUTE = ['北海道', '青森', '秋田', '岩手', '宮城', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川',
    '山梨', '静岡', '長野', '新潟', '富山', '石川', '福井', '岐阜', '愛知', '三重', '滋賀', '京都', '奈良', '和歌山', '大阪', '兵庫',
    '鳥取', '島根', '岡山', '広島', '山口', '香川', '徳島', '高知', '愛媛', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'];
  // 「〇〇から始める」で地方を選んでいたら、この順の中のその地方の先頭の県から始め、沖縄の次は北海道へつないで一巡する
  // （本人 2026-10-27「順番は今のまま、どこから始めるかで、最後沖縄→北海道でつながって一巡できるように」）。選んでいなければ北海道から。
  // 見ている所から始める（本人 2026-10-29「見ている位置で全国遊覧すると、北海道からになってしまう」）：浮かせた県があればその県、
  // 寄って見ている時は画面の真ん中に近い県（選んだ地方の中を見ているなら、その地方の先頭の県）。日本全体の眺めでは前のまま
  function natOrder(baseN) {
    const byN = new Map(M.P.map((p) => [p.name, p])), list = ROUTE.map((nm) => byN.get(nm)).filter(Boolean);
    const r = window.OPENING && OPENING.region;
    const i0 = Math.max(0, baseN ? list.findIndex((p) => p.n === baseN) : r ? list.findIndex((p) => p.n >= r[1] && p.n <= r[2]) : 0);
    return list.slice(i0).concat(list.slice(0, i0));
  }
  const REGION = (n) => (n === 1 ? '北海道' : n <= 7 ? '東北' : n <= 14 ? '関東' : n <= 23 ? '中部' : n <= 30 ? '近畿' : n <= 35 ? '中国' : n <= 39 ? '四国' : '九州・沖縄');

  // 回る順（県の中）：いちばん南（手前）の名所から近い所へ順にたどり、交差する道を2-optでほどく
  function route(items) {
    const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    const left = items.slice().sort((a, b) => b.z - a.z), path = [left.shift()];
    while (left.length) {
      const last = path[path.length - 1];
      left.sort((a, b) => d(last, a) - d(last, b));
      path.push(left.shift());
    }
    for (let better = true; better;) {
      better = false;
      for (let i = 0; i < path.length - 2; i++) for (let j = i + 2; j < path.length - 1; j++) {
        if (d(path[i], path[j]) + d(path[i + 1], path[j + 1]) < d(path[i], path[i + 1]) + d(path[j], path[j + 1]) - 1e-6) {
          path.splice(i + 1, j - i, ...path.slice(i + 1, j + 1).reverse()); better = true;
        }
      }
    }
    return path;
  }

  let T = null;
  const box = $('#tour');
  // 行き先を、上の検索の欄と下の説明の箱にはさまれた空きの真ん中に見せる（本人 2026-11-19「塩硝 遊覧中説明は出ても札が見えない」「井波彫刻も」：
  // 見る点を画面の真ん中に置いていたので、背の低いスマホ（360×640）では札が説明の箱の裏に隠れた）。札は点の上に立つので、その分だけ下げて見る。
  // 箱の高さは着くたびに測る（ふりがなの段・文の長さで変わる）。見る点を、カメラの側へ地面にそって ahead だけずらす（画角 28° の式）。
  // 県の中では地図が見る点の高さをその場の地面に合わせるので、ずらした先の地面と行き先の高さの差も式に入れる（入れないと、山側へずらした時に行き先が箱へ沈んだ）
  // 横向きのスマホは説明の箱が右の列に出るので（本人 2026-11-20「横向きにすると…画面いっぱい解説の画面で肝心の絵図が見えません」）、空きは箱の左。
  // 右の列（右の端に付いた上からの窓）は空きの右の端に、それ以外は上の欄か下の箱・並びとして数える。横は、見る点を見る向きの右へずらすと行き先が左に見える
  const FOV = 28 * Math.PI / 180, LABEL = 18;
  let gap = null;
  function measure() {
    const W = innerWidth, H = innerHeight;
    gap = { top: 0, bottom: H, left: 0, right: W };
    for (const q of ['#search', '#tour', '#card', '#bar']) {
      const e = $(q), c = e && e.offsetWidth ? e.getBoundingClientRect() : null;
      if (!c || !c.height) continue;
      if (c.left > W * 0.35 && c.right > W - 40 && c.top < H * 0.3) gap.right = Math.min(gap.right, c.left);
      else if (q === '#card') continue;
      else if (c.top + c.bottom < H) gap.top = Math.max(gap.top, c.bottom);
      else gap.bottom = Math.min(gap.bottom, c.top);
    }
  }
  addEventListener('resize', () => { gap = null; });
  // 見る点：行き先から、カメラの側へ地面にそって a、見る向きの右へ l だけずらした所
  function aim(s, D, ph, th) {
    if (!gap) measure();
    const H = innerHeight, f = 2 * Math.tan(FOV / 2) / H, c = Math.cos(ph), sn = Math.sin(ph);
    const px = Math.min(H * 0.4, H / 2 - ((gap.top + gap.bottom) / 2 + LABEL)), hx = innerWidth / 2 - (gap.left + gap.right) / 2;
    const side = (a) => hx * f * (D + a * c);
    const at = (a, l) => ({ x: s.x - Math.sin(th) * a + Math.cos(th) * l, z: s.z + Math.cos(th) * a + Math.sin(th) * l });
    const k = px * f, q = sn - k * c;
    if (px <= 0 || q < 0.05) return at(0, side(0));
    const flat = k * D / q;
    if (T.mode !== 'in') return at(flat, side(flat));
    // 県の中は、ずらした先の地面の高さしだいで答えが変わるので、半分ずつ狭めて解く。くり返し代入すると、深い谷（上高地）では
    // ずらすほど山を登って答えが跳ね、札が画面の上へ出た
    const l0 = side(flat);
    const g = (a) => { const p = at(a, l0); return a * q + (s.y - M.groundY(-1, p.x, p.z)) * (c + k * sn) - k * D; };
    let lo = 0, hi = flat * 2;
    if (g(lo) >= 0) return at(0, side(0));
    if (g(hi) <= 0) return at(hi, side(hi));
    for (let n = 0; n < 14; n++) { const m = (lo + hi) / 2; if (g(m) < 0) lo = m; else hi = m; }
    return at((lo + hi) / 2, side((lo + hi) / 2));
  }

  // ---- 立ち寄る所（どちらの遊覧も同じ形）：見る所・近さ・角・題・文・くわしく
  function inStops(w, k) {
    const items = IN.items.filter((it) => it.pref === M.P[k].n);
    return route(items).map((it) => ({
      // 北が上のまま飛ぶ（本人 2026-11-11「地図に寄って行ったときも基本は南を下に。特にスマホ」。前は th: null で、進む向きへ回っていた）
      x: it.x, z: it.z, y: M.groundY(k, it.x, it.z), D: D_STOP, ph: PH_STOP, th: 0, k: -1,
      it, name: it.name, cat: it.cat, text: (it.text && it.text[0]) || '', when: it.when || '', months: it.months || [],
      more: () => { if (M.openItem) M.openItem(it, true); if (!$('#card').offsetWidth) showItem(it); },
    }));
  }
  function startN() {
    if (M.sel >= 0) return M.P[M.sel].n;
    const c = M.cam, r = window.OPENING && OPENING.region;
    if (c.D > M.HOME.D * 0.6) return null;
    let best = null, bd = Infinity;
    for (const p of M.P) { const d = (p.ax - c.x) ** 2 + (p.az - c.z) ** 2; if (d < bd) { bd = d; best = p; } }
    return best && !(r && best.n >= r[1] && best.n <= r[2]) ? best.n : null;
  }
  function natStops(baseN) {
    const byPref = new Map((IN.tour || []).map((t) => [t.pref, t]));
    return natOrder(baseN).map((p) => {
      const t = byPref.get(p.n) || {}, f = p.frame, size = Math.max(f[2] - f[0], f[3] - f[1]);
      return {
        x: (f[0] + f[2]) / 2, z: (f[1] + f[3]) / 2, y: M.LIFT * 0.55, D: clamp(size * 1.55 + 220, 380, 1900), ph: 0.62, th: M.HOME.th, k: p.k,
        name: M.FULL(p.name) + (t.catch ? '　' + t.catch : ''), cat: REGION(p.n), text: (t.text || []).join(''),
        when: t.mark ? `${t.mark} ${M.MARK[t.mark] || ''}${IN.updated ? `（${IN.updated} 時点）` : ''}` : '', months: [],
        more: () => showSources(t, p),
      };
    });
  }
  const link = (title, url) => {
    const a = document.createElement('a'), u = M.safeUrl(url);
    a.textContent = title || url;
    if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  };
  const srcList = (d, sources) => {
    const ol = document.createElement('ol');
    for (const s of sources || []) { const li = document.createElement('li'); li.appendChild(link(s.title, s.url)); ol.appendChild(li); }
    if (ol.childNodes.length) { d.appendChild(document.createTextNode('出どころ')); d.appendChild(ol); }
  };
  // 県の中の「くわしく」：パソコンは札の窓に出す。スマホは遊覧中は札の窓を隠しているので、遊覧の札の中に説明の続きと出どころを
  // （本人 2026-11-11「遊覧中に詳しくを押しても出典へのリンクなどが出ない」＝隠れた札の窓に書いていた）。文は県ごとのファイルで後から届く
  function showItem(it) {
    const fill = () => {
      const d = $('#t-src');
      d.textContent = '';
      for (const t of (it.text || []).slice(1)) { const p = document.createElement('p'); if (window.RUBY) RUBY.text(p, t, it.pref); else p.textContent = t; d.appendChild(p); }
      srcList(d, it.sources);
      box.classList.add('src');
    };
    if (it.text == null && M.loadIntro) M.loadIntro(it.pref).then(fill, fill); else fill();
  }
  // 全国の「くわしく」：出どころと県の公式サイトを、遊覧の札の中に並べる（別のタブは、押した時だけ開く）
  function showSources(t, p) {
    const d = $('#t-src');
    d.textContent = '';
    srcList(d, t.sources);
    if (t.url) d.appendChild(link(`${M.FULL(p.name)}の公式サイト ›`, t.url));
    box.classList.add('src');
  }

  function start() {
    const w = M.inside, k = M.sel;
    if (!w || k < 0 || T) return;
    const stops = inStops(w, k);
    if (!stops.length) return;
    begin({ mode: 'in', w, stops });
  }
  function startNat() {
    if (T || M.inside) return;
    const base = startN();
    if (M.sel >= 0) M.back();
    const stops = natStops(base);
    if (!stops.length) return;
    begin({ mode: 'nat', w: null, stops });
  }
  function begin(o) {
    T = Object.assign(o, { i: -1, paused: false, last: performance.now() });
    document.body.classList.add('touring');
    box.classList.add('open');
    go(0);
  }
  function end(home = true) {
    if (!T) return;
    const t = T;
    T = null;
    document.body.classList.remove('touring');
    box.classList.remove('open', 'src');
    if (M.tourPin) M.tourPin(null);
    if (t.mode === 'nat') { M.tourLift(-1); if (home) M.view(Object.assign({}, M.HOME)); }
    else if (home && M.inside === t.w) M.view(t.w.home);
  }
  // 次の所へ飛び立つ。飛ぶ時間は距離と高さの差で。真ん中で高く上がる
  function go(i) {
    const n = T.stops.length;
    T.i = (i + n) % n;
    const s = T.stops[T.i], g = M.goal, from = { x: g.x, y: g.y, z: g.z, D: g.D, ph: g.ph, th: g.th };
    const dist = Math.hypot(s.x - from.x, s.z - from.z), nat = T.mode === 'nat';
    T.fly = {
      from, t: 0,
      // 飛脚の足（であい帖の道具）：移る時間だけ短く。着いてから読む時間（stay）は変えない
      dur: (nat ? clamp(2.4 + dist / 250 + Math.abs(from.D - s.D) / 1500, 3, 7) : clamp(2.6 + dist / 14 + Math.abs(from.D - s.D) / 50, 3, 8)) * (window.DEAI_TOOL && DEAI_TOOL.hikyaku ? 0.6 : 1),
      lift: nat ? clamp(dist * 0.6, 100, 900) : clamp(dist * 0.9, 14, 90),
      th: s.th != null ? toward(from.th, s.th) : dist > 2 ? toward(from.th, Math.atan2(s.x - from.x, -(s.z - from.z))) : from.th,
    };
    T.stay = null;
    box.classList.remove('src');
    if (nat) M.tourLift(s.k);
    else if (M.tourPin) M.tourPin(s.it);          // 行き先の印の札は、飛び立った時から出しておく（どこへ向かうかが地図で分かる）
    // 月のある紹介は、いちばん多く重なる季節の色で見せる（色は飛んでいる間にゆっくり変わる）。人が選んだ季節ではないので auto で包む
    // （本人 2026-11-19「BGMが曲の途中でどんどん勝手に切り替わります（遊覧中でした）」：名所ごとに季節の曲へ替わっていた）
    T.season = null;
    if (s.months.length) {
      const c = [0, 0, 0, 0];
      for (const m of s.months) c[seasonOf(m)]++;
      T.season = c.indexOf(Math.max(...c));
      if (T.season !== M.inner.season) M.auto(() => M.season(T.season));
    }
    caption(true);
  }
  function caption(flying) {
    const s = T.stops[T.i];
    $('#t-step').textContent = `${T.i + 1} / ${T.stops.length}`;
    const cat = $('#t-cat');
    cat.textContent = s.cat; cat.className = 'cat c-' + s.cat;
    // 名前と文にふりがな（本人 2026-11-19「どれも読めない」：遊覧の箱だけ字をそのまま書いていた）。県で読みの違う名前は、その県の読みで
    const pref = s.it ? s.it.pref : s.k >= 0 ? M.P.find((p) => p.k === s.k).n : null;
    const R = (e, t) => (window.RUBY ? RUBY.text(e, t, pref) : (e.textContent = t));
    R($('#t-name'), flying ? `つぎは ${s.name.split('　')[0]} へ` : s.name);
    R($('#t-text'), flying ? '' : s.text);
    $('#t-when').textContent = flying ? '' : [s.when, T.season != null ? `（${SEASON[T.season]}の色で見せています）` : ''].filter(Boolean).join('　');
    $('#t-pause').textContent = T.paused ? '続きから' : '一時停止';
    box.classList.toggle('flying', flying);
    if (!flying) gap = null;                          // 着いた時の箱で測り直す（飛ぶ間の小さい箱では測らず、前に着いた時の高さのまま行き先へ寄る）
  }
  function arrive() {
    const s = T.stops[T.i];
    // 読む時間は文の長さで。1秒に8字ほど＋地図を眺める間（6〜18秒）。1秒に16字では、読み終わる前に次へ飛んだ
    T.stay = { t: 0, dur: clamp(2.5 + s.text.length / 8, 6, 18) };
    caption(false);
  }
  function pause(on) {
    if (!T) return;
    T.paused = on;
    if (!on) { go(T.i); return; }                 // 触って動かした後の続きは、今いる所に着き直す
    caption(T.stay == null);
  }

  M.on('frame', () => {
    if (!T) return;
    const now = performance.now(), dt = Math.min(0.1, (now - T.last) / 1000);
    T.last = now;
    if (T.mode === 'in' && M.inside !== T.w) { end(false); return; }
    if (T.mode === 'nat' && M.inside) { end(false); return; }
    if (T.paused) return;
    const g = M.goal, s = T.stops[T.i];
    if (!T.stay) {
      const f = T.fly;
      f.t += dt;
      const u = clamp(f.t / f.dur, 0, 1), e = ease(u), arc = Math.sin(Math.PI * e), a = aim(s, s.D, s.ph, f.th);
      g.x = lerp(f.from.x, a.x, e); g.z = lerp(f.from.z, a.z, e); g.y = lerp(f.from.y, s.y, e);
      g.D = lerp(f.from.D, s.D, e) + f.lift * arc;
      g.ph = lerp(f.from.ph, s.ph, e) + 0.12 * arc;
      g.th = lerp(f.from.th, f.th, ease(clamp(u / 0.6, 0, 1)));
      M.clearView(g);
      if (u >= 1) arrive();
    } else {
      T.stay.t += dt;
      g.th += dt * (T.mode === 'nat' ? 0.02 : 0.07);    // 着いた所のまわりを、ゆっくり回る
      if (T.mode === 'in') { g.ph = Math.max(PH_STOP, g.ph - dt * 0.05); M.clearView(g); }
      const a = aim(s, g.D, g.ph, g.th);                // 回っても、行き先は空きの真ん中のまま
      g.x = a.x; g.z = a.z;
      if (T.stay.t >= T.stay.dur) {
        if (T.i === T.stops.length - 1) end(); else go(T.i + 1);
      }
    }
  });

  // 地図に触ったら止める（回す・寄せるのは自分で）
  const gl = $('#gl');
  gl.addEventListener('pointerdown', () => { if (T && !T.paused) pause(true); });
  gl.addEventListener('wheel', () => { if (T && !T.paused) pause(true); }, { passive: true });
  addEventListener('keydown', (e) => {
    if (!T || (e.target.closest && e.target.closest('input, textarea'))) return;
    if (e.code === 'Escape') { end(); e.stopImmediatePropagation(); }
    else if (e.code === 'Space') { pause(!T.paused); e.preventDefault(); }
    else if (e.code === 'ArrowRight' && e.shiftKey) go(T.i + 1);
    else if (/^(Arrow|Key[WASD]$)/.test(e.code) && !T.paused) pause(true);
  }, true);
  $('#t-prev').addEventListener('click', () => { if (T) { T.paused = false; go(T.i - 1); } });
  $('#t-next').addEventListener('click', () => { if (T) { T.paused = false; go(T.i + 1); } });
  $('#t-pause').addEventListener('click', () => pause(!(T && T.paused)));
  $('#t-end').addEventListener('click', () => end());
  // くわしく：止めて、県の中は札の窓に説明と出どころを（着くたびに出すと、組版で CPU4倍 59ms 止まった）、全国は遊覧の札の中に出どころを
  // 飛んでいる途中に押しても、行き先の紹介文を出す（「つぎは〜へ」のまま出どころだけ出て、何の出どころか分からなかった）
  $('#t-more').addEventListener('click', () => { if (!T) return; pause(true); caption(false); T.stops[T.i].more(); });
  $('#tour-open').addEventListener('click', start);
  $('#in-yuran').addEventListener('click', start);     // 県の中の題の下の「空から遊覧する」
  $('#tour-nat').addEventListener('click', startNat);
  M.on('world', (w) => { if (T && (!w || T.mode === 'nat')) end(false); });
  // 全国の遊覧の途中で県を押したら、遊覧を終えて、その県を選んだ状態に
  M.on('select', () => { if (T && T.mode === 'nat') end(false); });

  window.YURAN = {
    start, startNat, end, go: (i) => T && go(i), pause,
    order: (n) => natOrder(n).map((p) => p.n),       // 検査用：基点を決めて順路を作る
    land: () => { if (T && !T.stay && T.fly) T.fly.t = T.fly.dur; },     // 検査用：飛ぶのを済ませて着かせる（全部の行き先を見て回る検査）
    get state() { return T && { mode: T.mode, i: T.i, n: T.stops.length, paused: T.paused, flying: !T.stay, dur: T.fly ? T.fly.dur : null, names: T.stops.map((s) => s.name),
      prefs: T.stops.map((s) => (s.k >= 0 ? M.P.find((p) => p.k === s.k).n : 0)), at: [T.stops[T.i].x, T.stops[T.i].y, T.stops[T.i].z] }; },
  };
})();
