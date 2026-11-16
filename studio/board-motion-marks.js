/* PROCESS STUDIO — 움직임 표식(3.302, 사용자 11/16 «잔상을 가늘어지는 꼬리로 · 방향 표식(작은 삼각형) 더하기 — 이거해주고», 시안 `trail-direction-mock.png` 오른쪽).
   ① 잔상: 같은 굵기의 선 둘 → 지나온 쪽으로 갈수록 가늘어지는 꼬리 하나(채운 면 · 흰색, 밝은 피치는 짙은 색 · 투명도 .3).
      잔상을 켜고 끄는 길(단추 · J · 1~5단계 · 모든 장면)과 저장 값(token.trail)은 그대로 — board.html trailTick 이 그릴 때 taper() 만 부른다.
      영상 · GIF 도 같은 판을 찍으므로 그대로 나온다(속성만 쓴다 — CSS 없음).
   ② 방향 표식: 토큰 테두리 바로 밖의 작은 삼각형. 단추를 늘리지 않고 «시야» 단추가 끔 → 방향 표식 → 시야 부채꼴 → 끔 으로 돈다.
      토큰 칸 `dirMark`(true) 하나 — 방향은 원래의 `dir`(회전 손잡이 · ↺↻ 그대로). 시야와 같은 규칙으로 이 장면부터 뒤 장면까지(_animCarryIds),
      그림은 시야 층(#visionLayer — 토큰 아래 · 3D 바닥 · 내보내기 포함)에 `.ps-dirmark`. 시야 · 쉐이퍼가 켜진 선수는 그것이 방향을 보이므로 그리지 않는다.
   board.html 은 trailTick 의 그리기 두 줄과 <script> 한 줄. 시험: tests/board-motion-marks-3302.test.cjs · tests/browser/board-motion-marks-3302.mjs */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root) return;
  root.PSMotionMarks = api;
  if (root.document) root.document.addEventListener('DOMContentLoaded', function () { try { api.install(root); } catch (_) {} });
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', MAX_PTS = 36;
  function fin(p) { return !!p && Number.isFinite(p.x) && Number.isFinite(p.y); }
  function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }

  /* ── ① 가늘어지는 꼬리(순수) ─────────────────────────────────────────────
     points: 지나온 자리(오래된 것 → 지금), head: 지금 자리에서의 반 폭. 폭은 지나온 길이에 비례(0 → head).
     점이 많으면 길이로 고르게 줄여(최대 36) 한 프레임의 그림 값을 묶는다. 길이가 2 단위 미만이면 '' */
  function taper(points, head) {
    var src = (points || []).filter(fin), i, pts = [];
    for (i = 0; i < src.length; i++) if (!pts.length || Math.hypot(src[i].x - pts[pts.length - 1].x, src[i].y - pts[pts.length - 1].y) > 0.05) pts.push({x: src[i].x, y: src[i].y});
    head = +head;
    if (pts.length < 2 || !(head > 0)) return '';
    var acc = [0];
    for (i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    var total = acc[acc.length - 1];
    if (!(total >= 2)) return '';
    if (pts.length > MAX_PTS) {
      var out = [], j = 0;
      for (i = 0; i < MAX_PTS; i++) {
        var want = total * i / (MAX_PTS - 1);
        while (j < pts.length - 2 && acc[j + 1] < want) j++;
        var span = acc[j + 1] - acc[j], t = span > 0 ? Math.max(0, Math.min(1, (want - acc[j]) / span)) : 0;
        out.push({x: pts[j].x + (pts[j + 1].x - pts[j].x) * t, y: pts[j].y + (pts[j + 1].y - pts[j].y) * t, s: want});
      }
      pts = out;
    } else pts.forEach(function (p, k) { p.s = acc[k]; });
    var left = [], right = [], n = pts.length;
    for (i = 0; i < n; i++) {
      var a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, w = head * (pts[i].s / total);
      left.push(f1(pts[i].x - dy / len * w) + ' ' + f1(pts[i].y + dx / len * w));
      right.push(f1(pts[i].x + dy / len * w) + ' ' + f1(pts[i].y - dx / len * w));
    }
    return 'M ' + left.join(' L ') + ' L ' + right.reverse().join(' L ') + ' Z';
  }

  /* 꼬리 머리의 반 폭 — 시안의 비율(기본 크기 토큰 반지름 약 10 단위에서 16): 토큰 반지름의 1.6배, 8~17 단위로 묶는다. 공은 그 0.6배 */
  function head(r, ball) { var h = Math.max(8, Math.min(17, (r > 0 ? r : 21) * 1.6)); return ball ? h * 0.6 : h; }

  /* ── ② 방향 삼각형(순수) ───────────────────────────────────────────────
     토큰 반지름 r 의 테두리에서 조금 떨어진 작은 삼각형(시안의 비율: 크기 6.5~9.5 단위 · 테두리에서 크기 + 6 만큼). 아주 작은 토큰(실제 크기)에서도 보인다. */
  function markGeom(x, y, deg, r) {
    r = r > 0 ? r : 21;
    var s = Math.max(6.5, Math.min(9.5, r * 0.85)), gap = s + 6, a = deg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux, cx = x + ux * (r + gap), cy = y + uy * (r + gap);
    return {s: s, gap: gap, cx: cx, cy: cy, pts: [[cx + ux * s * 1.1, cy + uy * s * 1.1], [cx - ux * s * 0.5 + px * s * 0.62, cy - uy * s * 0.5 + py * s * 0.62], [cx - ux * s * 0.5 - px * s * 0.62, cy - uy * s * 0.5 - py * s * 0.62]]};   // 뾰족한 쪽이 보는 방향(길이 1.6s · 밑변 1.24s — 정삼각형이면 어느 쪽인지 안 읽힌다)
  }
  function markPath(x, y, deg, r) { var g = markGeom(x, y, deg, r); return 'M ' + g.pts.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join(' L ') + ' Z'; }
  function marked(p, shaperAll) { return !!(p && !p.coach && p.dirMark && !p.vis && !p.shaper && !shaperAll); }
  /* «시야» 단추의 다음 걸음 — 끔 → 방향 표식 → 시야 → 끔. 섞여 있으면 앞선 쪽으로 모은다. */
  function step(ps) {
    ps = (ps || []).filter(Boolean);
    if (!ps.length) return '';
    if (ps.every(function (p) { return !!p.vis; })) return 'off';
    if (ps.some(function (p) { return !!p.vis; })) return 'cone';
    return ps.every(function (p) { return !!p.dirMark; }) ? 'cone' : 'mark';
  }
  /* 이 장면(k)부터 뒤로 — 구간은 3.254 _animCarryIds 규칙(carry)에 맡긴다(board-tweaks.js visionCarry 와 같은 모양). 반환 = 바뀐 마지막 장면 번호 */
  function flagCarry(frames, k, toks, on, was, carry) {
    var last = k; if (!Array.isArray(frames) || !frames[k] || typeof carry !== 'function') return last;
    var at = function (f, id) { var a = f && f.snap && f.snap.players; if (!Array.isArray(a)) return -1; for (var i = 0; i < a.length; i++) if (a[i] && a[i].id === id) return i; return -1; };
    (toks || []).forEach(function (p) {
      if (!p || !!was[p.id] === !!on) return;
      var sh = frames.map(function (f, j) { var i = j === k ? -1 : at(f, p.id); return (j === k ? !!was[p.id] : i >= 0 && !!f.snap.players[i].dirMark) ? {v: [p.id]} : {}; });
      var end = carry(sh, k, 'v', p.id, !!on);
      for (var j = k + 1; j <= end; j++) {
        var f = frames[j], i = at(f, p.id); if (i < 0) continue;
        var c = Object.assign({}, f.snap.players[i]);
        if (on) { c.dirMark = true; if (typeof c.dir !== 'number' && typeof p.dir === 'number') c.dir = p.dir; } else delete c.dirMark;
        var sn = Object.assign({}, f.snap); sn.players = f.snap.players.slice(); sn.players[i] = c; f.snap = sn; delete f.thumb;
      }
      if (end > last) last = end;
    });
    return last;
  }

  function install(win) {
    if (!win || win.__psMotionMarks) return false;
    var doc = win.document, body = doc.body;
    if (typeof win.renderVision !== 'function' || typeof win.toggleVision !== 'function') return false;
    win.__psMotionMarks = 1;
    function S() { return typeof state !== 'undefined' ? state : null; }
    function A() { return typeof anim !== 'undefined' ? anim : null; }
    function act() { return typeof animActive !== 'undefined' ? animActive : -1; }
    function playing() { return typeof animPlaying !== 'undefined' && !!animPlaying; }
    function shaperAll() { return typeof tokShape !== 'undefined' && tokShape === 'shaper'; }
    function fieldSel() { try { return (win.selectedPlayers(false) || []).filter(function (p) { return p && !p.coach; }); } catch (_) { return []; } }
    function bound() { try { var a = A(), k = act(); return !!(a && Array.isArray(a.frames) && a.frames.length > 1 && k >= 0 && a.frames[k] && win._animLive && win._animLive() && !playing() && !win.__animExport && (!body.classList.contains('meet-mode') || (win.__meetSceneBound && win.__meetSceneBound()))); } catch (_) { return false; } }
    function carry(ps, on, was) { try { if (!bound() || typeof win._animCarryIds !== 'function') return; var k = act(); if (flagCarry(A().frames, k, ps, on, was, win._animCarryIds) > k) win.renderAnimFrames(); } catch (_) {} }

    // 그리기 — 시야 층에(없으면 만든다). 시야 · 쉐이퍼가 있는 선수는 건너뛴다.
    var draw = win.renderVision;
    win.renderVision = function () {
      var r = draw.apply(this, arguments);
      try {
        var s = S(), world = doc.getElementById('world'), all = shaperAll(); if (!s || !world) return r;
        var list = (s.players || []).filter(function (p) { return marked(p, all); }); if (!list.length) return r;
        var L = world.querySelector('#visionLayer');
        if (!L) { L = doc.createElementNS(NS, 'g'); L.setAttribute('id', 'visionLayer'); var tl = doc.getElementById('tokenLayer'); if (tl && tl.parentNode === world) world.insertBefore(L, tl); else world.appendChild(L); }
        var light = false; try { light = !!win._visIsLight(); } catch (_) {}
        list.forEach(function (p) {
          var n = doc.createElementNS(NS, 'path'), deg = 0, k = 1;
          try { deg = win._dirOf(p); } catch (_) { deg = typeof p.dir === 'number' ? p.dir : 0; }
          try { k = win._tokScaleOf(p) || 1; } catch (_) {}
          n.setAttribute('class', 'ps-dirmark'); n.setAttribute('data-for', String(p.id)); n.setAttribute('d', markPath(p.x, p.y, deg, 21 * k));
          n.setAttribute('fill', light ? '#20242c' : '#ffffff'); n.setAttribute('stroke', light ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.45)'); n.setAttribute('stroke-width', '1'); n.setAttribute('stroke-linejoin', 'round'); n.setAttribute('pointer-events', 'none');
          L.appendChild(n);
        });
      } catch (_) {}
      return r;
    };
    // 토큰을 끄는 동안에도 따라오게(시야 · 쉐이퍼와 같은 길) · 고른 선수의 회전 손잡이
    var live = win._dirLive; if (typeof live === 'function') win._dirLive = function () { if (live.apply(this, arguments)) return true; try { var all = shaperAll(); return (S().players || []).some(function (p) { return marked(p, all); }); } catch (_) { return false; } };
    var target = win._rotHandleTarget; if (typeof target === 'function') win._rotHandleTarget = function () { var t = target.apply(this, arguments); if (t) return t; try { if (typeof sel !== 'undefined' && sel && sel.type === 'player' && marked(sel.ref, shaperAll())) return {p: sel.ref, k: 'dir'}; } catch (_) {} return null; };

    // «시야» 단추: 끔 → 방향 표식 → 시야 → 끔. 부채꼴을 켜고 끄는 일(되돌리기 · 뒤 장면까지 · 알림)은 원래 함수가 한다.
    // 클릭 때의 window.toggleVision 을 부르므로 board-tweaks.js 의 «뒤 장면까지» 감싸개가 앞뒤 어느 쪽에 있어도 지난다.
    var inner = win.toggleVision;
    win.toggleVision = function () {
      var ps = fieldSel(), next = step(ps), was = {};
      ps.forEach(function (p) { was[p.id] = !!p.dirMark; });
      if (next === 'mark') {
        try { win.pushUndo(); } catch (_) {}
        ps.forEach(function (p) { p.dirMark = true; try { win._ensureDir(p); } catch (_) {} });
        carry(ps, true, was);
        try { win.renderTokens(); win.updateDelUI(); } catch (_) {} try { win.positionSelCtl(); } catch (_) {} try { win.boardSaveLive(); } catch (_) {}
        try { win.toast('방향 표식 — 한 번 더 누르면 시야 부채꼴 · 노란 손잡이로 돌려요'); } catch (_) {}
        return;
      }
      var r = inner.apply(this, arguments);
      if (next === 'off' && ps.some(function (p) { return !!p.dirMark; })) {   // 부채꼴을 끄면 표식도 같이 — 다음 누름이 다시 «방향 표식»부터
        ps.forEach(function (p) { delete p.dirMark; });
        carry(ps, false, was);
        try { win.renderTokens(); win.updateDelUI(); } catch (_) {} try { win.boardSaveLive(); } catch (_) {}
      }
      return r;
    };
    try { var vb = doc.getElementById('visBtn'); if (vb) vb.title = '누를 때마다 방향 표식 → 시야 부채꼴 → 끔'; } catch (_) {}
    // 단추의 켜짐 표시 — 방향 표식만 켠 선수도 «켜짐»
    var ui = win.updateDelUI;
    if (typeof ui === 'function') win.updateDelUI = function () {
      var r = ui.apply(this, arguments);
      try { var b = doc.getElementById('visBtn'), ps = fieldSel(); if (b && ps.length && ps.every(function (p) { return !!p.dirMark && !p.vis; })) { if (!b.classList.contains('on')) b.classList.add('on'); } } catch (_) {}
      return r;
    };
    return true;
  }

  return {taper: taper, head: head, markGeom: markGeom, markPath: markPath, marked: marked, step: step, flagCarry: flagCarry, install: install, MAX_PTS: MAX_PTS};
});
