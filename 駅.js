// 駅の案内（本人 2026-10-27「駅の情報を作って」「駅にまつわる色々な情報も、観光や農産品も含めて広げていきたい」）：
// 県の中の駅の札（県の中.js）を押すと、乗り入れる線と会社・所在地と、駅から近い見どころを出す。
// 駅の名前と線は国土数値情報の鉄道データ、所在地は国土地理院の逆ジオコーダ（作る時に引いた物）。
// 見どころは、確かめ済みの台帳にある物（県の紹介・目印・豆知識）だけを、駅からの直線の距離で並べる（新しい事実は書かない）。字は全部 textContent
// 駅の豆知識（豆知識.json の eki の欄・2026-10-28 本人「駅ごとの豆知識を足して」）は、案内のいちばん上に出し、出した時に豆知識帳へ記録する
(function () {
  'use strict';
  const M = window.MAP3D, IN = window.INTRO || {};
  if (!M) return;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const card = $('#eki-card');
  const OP = { '東日本旅客鉄道': 'JR東日本', '東海旅客鉄道': 'JR東海', '西日本旅客鉄道': 'JR西日本', '北海道旅客鉄道': 'JR北海道', '四国旅客鉄道': 'JR四国', '九州旅客鉄道': 'JR九州' };
  const KIND = ['私鉄・第三セクターの電車', 'JR の在来線', '新幹線'];
  const DIR = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  const NEAR = 15;                                      // 近くの見どころ：駅から何 km まで
  let cur = null;

  // 駅から近い見どころ：地図の座標は km（x＝東・z＝南）。方角は8つ
  function nearby(sx, sz, self) {
    const pref = M.P[M.sel] && M.P[M.sel].n, out = [];
    const got = new Set(window.MAME ? MAME.beans().filter((b) => b.got).map((b) => b.id) : []);
    for (const it of IN.items || []) if (it.pref === pref) out.push({ tag: it.cat, name: it.name, x: it.x, z: it.z, go: () => { close(); M.view({ x: it.x, z: it.z, D: 22 }); if (M.openItem) M.openItem(it); } });
    for (const s of IN.spots || []) if (s.pref === pref) out.push({ tag: '名所', name: s.name, x: s.x, z: s.z, go: () => { close(); M.view({ x: s.x, z: s.z, D: 14 }); } });
    for (const d of IN.mame || []) if (d.pref === pref && d.eki !== self) {
      const has = got.has(d.id);
      out.push({ tag: '豆知識', name: has ? d.title : d.eki ? `？（${d.eki}駅の豆知識）` : '？（まだ開いていない豆知識）', x: d.x, z: d.z, go: () => { close(); M.view({ x: d.x, z: d.z, D: 18 }); if (window.MAME) MAME.open(d.id); } });
    }
    for (const o of out) {
      o.km = Math.hypot(o.x - sx, o.z - sz);
      o.dir = DIR[((Math.round(Math.atan2(o.x - sx, -(o.z - sz)) / (Math.PI / 4)) % 8) + 8) % 8];
    }
    return out.filter((o) => o.km <= NEAR).sort((a, b) => a.km - b.km).slice(0, 6);
  }

  function open(st, id, label, served) {
    if (cur && cur.id === id) { close(); return; }        // 同じ駅の札をもう一度押すとしまう
    close();
    cur = { st, id, label };
    if (label) label.classList.add('on');
    if (window.YURAN && YURAN.state && !YURAN.state.paused) YURAN.pause(true);
    const sx = st.x / 100, sz = st.z / 100;
    card.textContent = '';
    const head = el('div', 'head');
    head.append(el('b', null, '駅'), el('span', 'pref', [M.FULL(M.P[M.sel].name), st.m, st.t].filter(Boolean).join(' ')));
    card.append(head, el('h3', null, st.n + '駅'));
    // この駅の豆知識（札の「？」）：開いた時点で豆知識帳に記録する。出どころは豆知識の札で
    for (const d of (IN.mame || []).filter((q) => (st._mame || []).includes(q.id))) {        // その札に付けた豆知識だけ（同じ名前の別の駅の分は出さない）
      const isNew = window.MAME ? MAME.record(d.id) : false, box = el('div', 'eki-mame');
      const top = el('div', 'top');
      top.append(el('b', null, 'この駅の豆知識'), el('span', 'cat c-' + (['食', '農', '山の幸', '海と川'].includes(d.cat) ? '食' : d.cat), d.cat));
      box.append(top, el('h4', null, d.title), el('p', null, d.text));
      const foot = el('div', 'foot'), more = el('button', null, '出どころ・豆知識帳 ›');
      more.addEventListener('click', () => { close(); if (window.MAME) MAME.open(d.id); });
      const [n, N] = window.MAME ? MAME.count() : [0, 0];
      foot.append(el('small', null, `${d.mark} ${(M.MARK && M.MARK[d.mark]) || ''}・${isNew ? '豆知識帳に記録しました' : '記録ずみ'}（${n} / ${N}）`), more);
      box.appendChild(foot);
      card.appendChild(box);
    }
    // 乗り入れる線：会社ごとにまとめる（新幹線・在来線の順）
    const byOp = new Map();
    for (const [line, op, kind] of st.l.slice().sort((a, b) => b[2] - a[2])) {
      const k = op + '|' + (kind === 2 ? 2 : 1);
      if (!byOp.has(k)) byOp.set(k, { op, kind, lines: [] });
      byOp.get(k).lines.push(line);
    }
    const ul = el('ul', 'lines');
    for (const g of byOp.values()) {
      const li = el('li');
      li.append(el('span', 'cat c-' + (g.kind === 2 ? '鉄道' : '食'), g.kind === 2 ? '新幹線' : '線'), document.createTextNode(' ' + g.lines.join('・')),
        el('small', null, '（' + (OP[g.op] ? g.op + '・' + OP[g.op] : g.op) + '）'));
      ul.appendChild(li);
    }
    card.appendChild(ul);
    const kinds = [...new Set(st.l.map((l) => l[2]))].sort((a, b) => b - a).map((k) => KIND[k]);
    card.appendChild(el('p', 'kinds', '止まる列車：' + kinds.join('・') + (served ? '（地図の電車も、ここで少し止まります）' : '')));
    const nb = nearby(sx, sz, st.n);
    card.appendChild(el('h4', null, '駅から近い見どころ（地図に載せている物・直線のきょり）'));
    if (nb.length) {
      const list = el('ul', 'near');
      for (const o of nb) {
        const li = el('li'), b = el('button', null, o.name);
        b.addEventListener('click', o.go);
        li.append(el('span', 'cat c-' + (o.tag === '豆知識' || o.tag === '名所' ? '鉄道' : o.tag), o.tag), b,
          el('small', null, o.km < 0.95 ? `すぐそば（${Math.round(o.km * 1000 / 50) * 50}m）` : `${o.dir} ${o.km.toFixed(1)}km`));
        list.appendChild(li);
      }
      card.appendChild(list);
    } else card.appendChild(el('p', 'none', `駅から ${NEAR}km の中には、まだ載せていません。これから足していきます。`));
    card.appendChild(el('p', 'src', '駅と線：国土数値情報 鉄道データ（国土交通省）／所在地：国土地理院'));
    const row = el('div', 'row'), bClose = el('button', null, '閉じる');
    bClose.addEventListener('click', close);
    row.appendChild(bClose); card.appendChild(row);
    card.classList.add('open');
  }
  function close() {
    if (cur && cur.label) cur.label.classList.remove('on');
    cur = null; card.classList.remove('open');
  }
  M.on('world', close);
  M.onDismiss(() => { if (!cur) return false; close(); return true; });
  M.on('deselect', close);
  // 案内の外のどこを押してもしまう（地図の空いた所は M.onDismiss）。画面の向きや大きさが変わった時も（本人 2026-10-30）
  addEventListener('pointerdown', (e) => { if (cur && !card.contains(e.target) && !(cur.label && cur.label.contains(e.target)) && e.target.id !== 'gl') close(); }, true);
  addEventListener('resize', () => { if (cur) close(); });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && card.classList.contains('open') && !e.target.closest('input')) { close(); e.stopImmediatePropagation(); }
  }, true);

  // 検査用
  window.EKI = { open, close, get state() { return cur && { name: cur.st.n, id: cur.id, text: card.innerText }; } };
})();
