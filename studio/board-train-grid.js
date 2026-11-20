/* 3.338 — 훈련 격자를 운동장 가운데 기준으로, 운동장 안에 칸이 딱 맞게(사용자 11/20 «훈련 그리드 격자무늬가 운동장을 가운데 중심으로
   안에 작은 사각형이 딱 맞게» · «11인제 맞추고 8인제에 맞춰서 각각» → 문서 저장소 목업 `UI-훈련격자-골대-목업-2026-11-20.html`).
   board.html `buildTrainGrid` 는 늘 11인제 운동장의 왼쪽 위 모서리(L · T)에서 2.1×2.0m 칸을 깔았다 — 11인제 하나는 50×34칸으로 우연히 맞고,
   8인제(65×48m · 가운데로 작아짐)는 양쪽 골라인이 칸 가운데에 걸렸고, 운동장 여럿(셸이 그리는 카드 — 작게 줄어든다)은 카드마다 칸이 엇갈렸다.
   여기서는 운동장(카드)마다 칸 수를 짝수로 맞춰(하프라인 · 센터 점이 격자선 위) 칸 크기 = 길이 ÷ 칸 수로 깐다:
   11인제 50×34 = 2.1×2.0m 그대로 · 8인제 30×24 ≈ 2.17×2.0m · 풋살 20×10 = 2.0×2.0m. «격자 간격»(window.__trainGridM — 'def' 또는 m)도 같은 규칙.
   운동장 하나는 예전처럼 판 밖 여백까지 이어 깐다(같은 위상), 여럿은 카드 안에만. 카드는 window.__psPitchRects(world {x,y,w,h} · dir 'v' 골대 위아래 /
   'h' 골대 좌우 — 없으면 긴 변 = 길이). 격자 자석은 window.__trainGridSpec 하나({x0,y0,sx,sy}) 를 그대로 두고, 여럿이면 cards 를 붙인다 —
   board-training-edit.js 가 놓는 자리마다 `pick` 으로 그 카드의 칸을 고른다. 그리드 판(blank)은 board.html 그대로(판 가로 m 로 1m 칸).
   저장하는 것 없음 · 판 좌표 그대로(선수는 움직이지 않는다). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    root.PSTrainGrid = api;
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { api.install(root); });
    else api.install(root);
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var EXT = 1000, NS = 'http://www.w3.org/2000/svg', INK = '#e6ebf0', LW = 0.6;
  var diag = [];
  function note(e) { try { diag.push(String(e && e.message || e)); if (diag.length > 20) diag.shift(); } catch (_) { diag.length = 0; } }
  /* 길이 m 를 g m 에 가까운 짝수 칸으로 — 칸이 둘보다 적지 않게 */
  function even(m, g) { return Math.max(2, Math.round(m / g / 2) * 2); }
  function gaps(gap) { var n = +gap; return gap === 'def' || !(n > 0) ? [2.1, 2.0] : [n, n]; }
  /* 운동장 한 장의 칸. r = {x,y,w,h,dir} · sp = 규격(len · wid m) */
  function lattice(r, sp, gap) {
    var g = gaps(gap), horiz = r.dir ? r.dir === 'h' : r.w >= r.h, nL = even(sp.len, g[0]), nW = even(sp.wid, g[1]);
    var sL = (horiz ? r.w : r.h) / nL, sW = (horiz ? r.h : r.w) / nW;
    return { x0: r.x, y0: r.y, sx: horiz ? sL : sW, sy: horiz ? sW : sL, nx: horiz ? nL : nW, ny: horiz ? nW : nL,
      mL: sp.len / nL, mW: sp.wid / nW, rect: [r.x, r.y, r.w, r.h] };
  }
  /* 판 위 한 점이 쓸 칸 — 그 점을 품은 카드, 없으면 가장 가까운 카드 */
  function pick(spec, u) {
    if (!spec || !spec.cards || !spec.cards.length || !u) return spec;
    var best = spec.cards[0], bd = Infinity;
    spec.cards.forEach(function (c) {
      var r = c.rect, dx = Math.max(r[0] - u.x, 0, u.x - (r[0] + r[2])), dy = Math.max(r[1] - u.y, 0, u.y - (r[1] + r[3])), d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  }
  /* 격자선 [x1,y1,x2,y2] — ext 면 운동장 밖으로 같은 위상을 이어 간다 */
  function lines(l, ext) {
    var r = l.rect, out = [], e = ext || 0;
    var kx0 = e ? Math.ceil(e / l.sx) : 0, ky0 = e ? Math.ceil(e / l.sy) : 0;
    var ax0 = r[0] - kx0 * l.sx, ay0 = r[1] - ky0 * l.sy, ax1 = r[0] + r[2] + e, ay1 = r[1] + r[3] + e;
    for (var i = 0; ; i++) { var x = r[0] + (i - kx0) * l.sx; if (x > ax1 + 1e-6) break; out.push([x, ay0, x, ay1]); }
    for (var j = 0; ; j++) { var y = r[1] + (j - ky0) * l.sy; if (y > ay1 + 1e-6) break; out.push([ax0, y, ax1, y]); }
    return out;
  }
  /* 지금 판의 운동장들 — 그리지 않을 때는 null */
  function plan(o) {
    if (!o || o.pitch !== 'train' || !o.spec || o.spec.blank) return null;
    var rects = o.multi && o.rects && o.rects.length ? o.rects : null;
    if (rects) return { multi: true, cards: rects.map(function (r) { return lattice(r, o.spec, o.gap); }) };
    var q = o.pr; if (!q || !(q.PW > 0) || !(q.PH > 0)) return null;
    return { multi: false, cards: [lattice({ x: q.L, y: q.T, w: q.PW, h: q.PH, dir: 'h' }, o.spec, o.gap)] };
  }
  function spec(p) {
    if (!p) return null;
    var c = p.cards[0], s = { x0: c.x0, y0: c.y0, sx: c.sx, sy: c.sy };
    if (p.multi) s.cards = p.cards;
    return s;
  }
  function read(win) {
    var w = typeof world !== 'undefined' ? world : null, st = typeof state !== 'undefined' ? state : null, sp = null, pr = null;
    try { sp = win.pitchSpec(); } catch (e) { note(e); }
    try { pr = win.PR(); } catch (e) { note(e); }
    var rects = win.__psPitchRects, multi = !!(st && (st.pitchN || 1) > 1 && w && w.querySelector('#ps-multipitch') && Array.isArray(rects) && rects.length);
    return { world: w, pitch: win.document.documentElement.dataset.pitch, spec: sp, pr: pr, gap: win.__trainGridM || 'def', multi: multi, rects: multi ? rects : null };
  }
  function f(n) { return Math.round(n * 1000) / 1000; }
  /* board.html 이 그린 #trainGrid(있을 때만 — 보일지 말지 · 자리는 본문이 정한다)를 운동장에 맞춘 칸으로 바꾼다 */
  function paint(win) {
    var o = read(win), w = o.world; if (!w) return null;
    var old = w.querySelector(':scope>#trainGrid'); if (!old) return null;
    var p = plan(o); if (!p) return null;
    var sig = JSON.stringify([p.multi, p.cards.map(function (c) { return [f(c.x0), f(c.y0), f(c.sx), f(c.sy), c.rect.map(f)]; })]);
    if (old.__psTg !== sig) {
      var g = win.document.createElementNS(NS, 'g'); g.setAttribute('id', 'trainGrid'); g.setAttribute('data-ps-fit', p.multi ? 'cards' : 'pitch');
      p.cards.forEach(function (c) {
        lines(c, p.multi ? 0 : EXT).forEach(function (a) {
          var l = win.document.createElementNS(NS, 'line');
          l.setAttribute('x1', f(a[0])); l.setAttribute('y1', f(a[1])); l.setAttribute('x2', f(a[2])); l.setAttribute('y2', f(a[3]));
          l.setAttribute('stroke', INK); l.setAttribute('stroke-width', LW); g.appendChild(l);
        });
      });
      g.__psTg = sig; old.parentNode.replaceChild(g, old);
    }
    win.__trainGridSpec = spec(p);
    return p;
  }
  function install(win) {
    if (!win || !win.document || win.__psTrainGrid) return false;
    win.__psTrainGrid = true;
    /* buildTrainGrid · buildLines(규격) · __psWmPlace(셸이 카드를 그린 뒤 부른다) 뒤에 맞춘다 — 본문은 이름으로 부르니 감싼 것을 지난다 */
    ['buildTrainGrid', 'buildLines', '__psWmPlace'].forEach(function (k) {
      var orig = win[k]; if (typeof orig !== 'function' || orig.__psTrainGrid) return;
      var gfn = function () { var r = orig.apply(this, arguments); try { paint(win); } catch (e) { note(e); } return r; };
      gfn.__psTrainGrid = 1; win[k] = gfn;
    });
    try { paint(win); } catch (e) { note(e); }
    return true;
  }
  return { even: even, gaps: gaps, lattice: lattice, pick: pick, lines: lines, plan: plan, spec: spec, paint: paint, install: install, diag: diag };
});
