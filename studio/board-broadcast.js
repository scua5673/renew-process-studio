/* PROCESS STUDIO — 3D «사람» 선수의 뛰는 자세와 중계 시점 카메라(3.071 · 3.072).
   작전판(board.html)은 판 상태와 그리기를 맡고, 여기는 계산만 한다 — 시험은 require 로 행동을 본다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSBroadcast = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var D2R = Math.PI / 180;
  // 중계 시점(사용자 «이런 느낌으로» — 관중석 높은 곳의 중계 카메라 사진): 비스듬히(ax) · 사선으로(yaw) · 운동장 폭 widthM m 만 · 원근 persp px.
  // 3.083 — 사용자 «운동장이 최대한 많이 보이게 · 관중석은 거의 안 보여도»: 사선(-16°)을 없애고(중계 메인 카메라처럼 옆에서 곧게) 조금 덜 눕힌다(56° → 46°).
  var TV = { ax: 46, yaw: 0, widthM: 66, persp: 1000, marginM: 22, minK: 0.55 };

  // 장면 a → b 사이 u 에서 움직이는 선수마다 진행 방향(판 좌표의 접선), 지금까지 뛴 거리와 이번 장면의 전체 거리(m).
  // env.curvePt(x0,y0,x1,y1,curve,t) = 판의 곡선 경로, env.mpp = 1m 가 몇 단위. 40cm 안쪽으로 움직이는 선수는 서 있다.
  function motion(a, b, u, curves, env) {
    if (!(u > 0 && u < 1) || a === b || !a || !b) return null;
    var bp = {}, out = {}, m = (env && env.mpp) || 10, N = 16;
    (b.players || []).forEach(function (o) { bp[o.id] = o; });
    (a.players || []).forEach(function (p) {
      var q = bp[p.id]; if (!q) return;
      if (Math.hypot(q.x - p.x, q.y - p.y) < 0.4 * m) return;
      var c = curves && curves[p.id], pt = function (t) { return env.curvePt(p.x, p.y, q.x, q.y, c, t); };
      var tot = 0, run = 0, prev = pt(0);
      for (var i = 1; i <= N; i++) {
        var t = i / N, cur = pt(t), d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
        tot += d; if (t <= u) run += d; else if (t - 1 / N < u) run += d * (u - (t - 1 / N)) * N;
        prev = cur;
      }
      var p0 = pt(Math.max(0, u - 0.02)), p1 = pt(Math.min(1, u + 0.02));
      out[p.id] = { vx: p1.x - p0.x, vy: p1.y - p0.y, run: run / m, total: tot / m, u: u };
    });
    // 3.075 — 코치가 고른 동작(장면 곡선의 acts: 토큰 id → 동작)이 자동 판단보다 먼저다. 'none' 은 자동 동작을 끈다.
    var acts = (curves && curves.acts) || {}, k = kick(a, b, m, curves), A = ballOf(a), B = ballOf(b);
    var foot = function (p) { try { return env && env.foot && env.foot(p) === 'L' ? 'L' : 'R'; } catch (_) { return 'R'; } };
    var byA = {}, byB = {}; (a.players || []).forEach(function (o) { byA[o.id] = o; }); (b.players || []).forEach(function (o) { byB[o.id] = o; });
    function ent(id) { return out[id] || (out[id] = { vx: 0, vy: 0, run: 0, total: 0, u: u }); }
    function act(id) { var v = acts[id]; return typeof v === 'string' ? v : ''; }
    var dxB = A && B ? B.x - A.x : 0, dyB = A && B ? B.y - A.y : 0;
    // 장면 시작: 차기 · 헤딩으로 보내기
    var starter = null;
    Object.keys(acts).forEach(function (id) { if ((acts[id] === 'kick' || acts[id] === 'headout') && byA[id] && !starter) starter = id; });
    if (!starter && k && act(k.kicker) !== 'none') starter = String(k.kicker);
    if (starter != null && A && B && u < KICK.win) {
      var sp = byA[starter] || byA[+starter], e0 = ent(sp ? sp.id : starter);
      if (act(starter) === 'headout') e0.head = u / KICK.win; else e0.kick = u / KICK.win;
      e0.bx = dxB || 1; e0.by = dyB; e0.foot = foot(sp);
    }
    // 장면 끝: 고른 받기 · 골키퍼 동작, 아니면 자동(가까운 받는 사람 · 8m 안의 골키퍼)
    var ENDS = { recv: 1, chest: 1, headin: 1, catch: 1, punch: 1, dive: 1, dive_l: 1, dive_r: 1, dive_hl: 1, dive_hr: 1 };
    var ended = {};
    function endAct(id, type, p) {
      var from = type.indexOf('dive') === 0 ? DIVE.from : KICK.recvFrom; if (u <= from) return; var e = ent(id);
      var t = (u - from) / (1 - from); ended[id] = 1;
      e.bx = A ? A.x - p.x : -dxB; e.by = A ? A.y - p.y : -dyB; e.foot = foot(p);   // 공이 오는 쪽을 본다
      if (type === 'recv') e.recv = t; else if (type === 'headin') e.head = t; else if (type === 'chest') e.chest = t; else if (type === 'catch') e.catch = t; else if (type === 'punch') e.punch = t;
      else { e.dive = t; e.dx = B ? B.x - p.x : 0; e.dy = B ? B.y - p.y : 0; e.reach = Math.max(.5, Math.min(1, Math.hypot(e.dx, e.dy) / (5 * m))); e.high = type === 'dive_hl' || type === 'dive_hr'; e.side = /_(h?)l$/.test(type) ? -1 : /_(h?)r$/.test(type) ? 1 : 0; }
    }
    Object.keys(acts).forEach(function (id) { var t = acts[id], p = byB[id] || byB[+id]; if (ENDS[t] && p && A && B) endAct(p.id, t, p); });
    if (k) {
      if (k.receiver != null && !ended[k.receiver] && !act(k.receiver)) endAct(k.receiver, k.air ? 'headin' : 'recv', k.rp);
      k.gks.forEach(function (g) { if (!ended[g.id] && !act(g.id)) { if (out[g.id]) { delete out[g.id].recv; delete out[g.id].head; } endAct(g.id, 'dive', g); } });
    }
    return out;
  }
  // 3.074 — 차기(사용자 «차는 모습»): 장면 사이에 공이 움직이면, 공이 있던 자리에서 가장 가까운 선수(2.5m 안)가 찬다 —
  // 장면 앞 KICK.win 동안 다리를 뒤로 뺐다가 차고, 발이 닿는 순간(KICK.contact)에 공이 출발한다.
  // 공이 닿는 자리에서 가장 가까운 선수(3m 안)는 받는 사람 — 끝 무렵 공 쪽을 보고 발을 내민다.
  var KICK = { win: 0.2, contact: 0.11, near: 2.5, recvNear: 3, recvFrom: 0.8 };
  // 3.075 — 헤딩: 공중볼(장면 곡선의 높이 air 1~3)이면 받는 선수가 점프해 머리로 받는다.
  //          다이빙: 공이 골키퍼(포지션 GK 또는 1번) 8m 안으로 가면 장면 뒤쪽 절반 동안 공 쪽으로 몸을 날린다.
  var DIVE = { near: 8, from: 0.5 };
  function isGK(p) { return !!p && !p.coach && (p.pos === 'GK' || String(p.num) === '1'); }
  function ballOf(s) {
    if (s && s.ball && isFinite(s.ball.x)) return s.ball;
    var e = s && (s.equipment || []).filter(function (o) { return o && o.team === 'ball'; })[0];
    return e || null;
  }
  function kick(a, b, mpp, curves) {
    var A = ballOf(a), B = ballOf(b), m = mpp || 10;
    if (!A || !B || Math.hypot(B.x - A.x, B.y - A.y) < 1.5 * m) return null;
    function nearest(list, p, max) { var best = null, bd = max * m; (list || []).forEach(function (o) { if (!o || o.coach) return; var d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }); return best; }
    var k = nearest(a.players, A, KICK.near), r = nearest(b.players, B, KICK.recvNear);
    if (!k) return null;
    var key = a.ball && A === a.ball ? 'ball' : A.id, air = curves && curves[key] && +curves[key].air > 0;
    var gks = (b.players || []).filter(function (o) { return isGK(o) && o.id !== k.id && Math.hypot(o.x - B.x, o.y - B.y) < DIVE.near * m; });
    return { kicker: k.id, receiver: r && r.id !== k.id ? r.id : null, dx: B.x - A.x, dy: B.y - A.y, kp: k, rp: r, air: !!air, A: { x: A.x, y: A.y }, B: { x: B.x, y: B.y }, gks: gks, m: m };
  }
  // 공이 움직이는 몫: 찰 사람이 있으면 발이 닿을 때까지 제자리, 그 뒤 끝까지.
  function ballU(a, b, u, mpp, curves) {
    var acts = (curves && curves.acts) || {}, forced = Object.keys(acts).some(function (id) { return acts[id] === 'kick' || acts[id] === 'headout'; }), k = kick(a, b, mpp, curves);
    if (!(u > 0 && u < 1) || !(forced || (k && acts[k.kicker] !== 'none'))) return u;
    return u < KICK.contact ? 0 : (u - KICK.contact) / (1 - KICK.contact);
  }
  // 판 좌표의 벡터 → 화면 방향. 세로 보기는 판(world)이 ±90° 돌아 있고, 중계 시점은 사선으로 돌고 크게 기운다.
  function screenVec(x, y, view) {
    var sx = x, sy = y, v = view || {};
    if (v.orientation === 'v') { if (v.spFlip) { sx = -y; sy = x; } else { sx = y; sy = -x; } }
    if (v.tv) { var a = TV.yaw * D2R, rx = sx * Math.cos(a) - sy * Math.sin(a), ry = sx * Math.sin(a) + sy * Math.cos(a); sx = rx; sy = ry * Math.cos(TV.ax * D2R); }
    return { x: sx, y: sy };
  }
  // 움직임 → 자세: 몸이 바라보는 각도(0 오른쪽 · 90 카메라 쪽 · -90 먼 쪽 · 180 왼쪽), 뛴 걸음(두 발 2.6m), 보폭(멀리 뛸수록 크게).
  // 출발할 때는 카메라 쪽(서 있던 방향)에서 뛰는 방향으로 돌아서고, 도착하면 다시 돌아선다 — 짧은 쪽으로.
  function pose(mv, view, by) {
    if (!mv) return by == null ? null : { yaw: by, phase: 0, amp: 0 };
    if (mv.kick != null || mv.recv != null || mv.head != null || mv.dive != null || mv.chest != null || mv.catch != null || mv.punch != null) {
      var b = screenVec(mv.bx, mv.by, view), face = Math.atan2(b.y, b.x) / D2R, out = { yaw: face, phase: mv.run / 2.6, amp: 0, kick: mv.kick != null ? mv.kick : null, recv: mv.recv != null ? mv.recv : null, foot: mv.foot === 'L' ? 'L' : 'R' };
      if (mv.head != null) out.head = mv.head;
      ['chest', 'catch', 'punch'].forEach(function (n) { if (mv[n] != null) out[n] = mv[n]; });
      if (mv.dive != null) { var d = screenVec(mv.dx, mv.dy, view); out.dive = { t: mv.dive, dir: mv.side ? mv.side : (d.x < 0 ? -1 : 1), reach: Math.max(0.35, mv.reach || 0), high: !!mv.high }; }
      return out;
    }
    var s = screenVec(mv.vx, mv.vy, view), amp = Math.min(1, 0.45 + mv.total / 14), ease = Math.min(1, mv.u * 5, (1 - mv.u) * 5);
    var base = by == null ? 90 : by, dir = Math.atan2(s.y, s.x) / D2R, turn = ((dir - base) % 360 + 540) % 360 - 180;
    return { yaw: base + turn * Math.min(1, ease * 1.6), phase: mv.run / 2.6, amp: Math.max(0, amp * ease) };
  }
  // 중계 시점에서 선수를 화면에 바로 세운다 — 사선 회전을 되돌리고, 기울어 짧아진 만큼 키를 늘린다.
  function stand(tv) { return tv ? { rot: -TV.yaw, sy: 1 / Math.cos(TV.ax * D2R) } : null; }

  // 중계 카메라. 확대는 CSS scale 이 아니라 판 SVG 의 상자 자체를 키워서 한다 — scale 로 키우면 브라우저가 원래 크기로 그린 그림을 늘려 흐려진다(실측).
  // 경기장 그림 · 골대 층은 판 상자를 재서 따라온다(env.resized). 같은 변환 한 줄(--tilt-tf)을 판 · 경기장 · 골대가 함께 쓰므로 body 에 적는다.
  // env: svg() · stage() · layer()(판 좌표 층) · target() · mpp() · playing() · resized(rerender) · goalK(골대 과장 배율 — 중계는 실제 크기)
  function camera(env) {
    var st = { cur: null, k: 1, size: '', goal: null, kf: 1, off: { x: 0, y: 0 }, fitting: false }, PROPS = ['position', 'left', 'top', 'width', 'height', 'max-width', 'max-height'];
    function off() {
      var svg = env.svg(), stage = env.stage();
      if (!st.size || !svg) return false;
      document.body.style.removeProperty('--tilt-tf');
      if (stage) { stage.style.removeProperty('perspective'); stage.style.removeProperty('perspective-origin'); }
      PROPS.forEach(function (k) { svg.style.removeProperty(k); });
      if (st.goal) { var g = env.goalK(); Object.keys(st.goal).forEach(function (k) { g[k] = st.goal[k]; }); st.goal = null; }
      st.cur = null; st.k = 1; st.size = ''; st.kf = 1; st.off = { x: 0, y: 0 }; st.base = 0; st.bkey = ''; env.resized(false);
      return true;
    }
    function update(snap) {
      var svg = env.svg(), stage = env.stage(), layer = env.layer(); if (!svg || !stage || !layer) return;
      var sw = stage.clientWidth, sh = stage.clientHeight, vb = svg.viewBox && svg.viewBox.baseVal; if (!sw || !sh || !vb || !vb.width) return;
      // 3.083 — 기준 배율은 무대 크기마다 한 번만 잰다. 판을 키우면 작전판이 viewBox 를 다시 잡아 기준이 바뀌고, 그게 다시 크기를 바꿔
      //         두 값(1.31 ↔ 1.42)을 끝없이 오갔다(그리기 반복 · 겨냥이 흔들림)
      var bkey = sw + 'x' + sh; if (st.bkey !== bkey || !st.base) { st.base = Math.min(sw / vb.width, sh / vb.height); st.bkey = bkey; }
      var base = st.base, wm = env.spanM ? env.spanM() : TV.widthM;   // 3.083 — 선수가 다 보이게(사용자 «멀리서 잡더라도 전부 보이게»)
      var k = Math.max(0.2, Math.min(8, Math.max(TV.minK, sw / (wm * env.mpp() * base)) * st.kf));   // st.kf — 실제로 재서 맞춘 배율(fit)
      var W = Math.round(sw * k), H = Math.round(sh * k), size = [W, H, sw, sh].join('x');
      // 3.083 — 작전판 applyView 가 판 너비를 지울 때가 있다(창 크기 · 보기 바꿈) — 지워졌으면 같은 크기여도 다시 입힌다
      var stale = svg.style.getPropertyValue('width') !== W + 'px' || svg.style.getPropertyPriority('width') !== 'important' || svg.style.getPropertyValue('height') !== H + 'px';
      if (st.size !== size || stale) {
        st.size = size; st.k = k;
        if (!st.goal) { var g = env.goalK(); st.goal = {}; Object.keys(g).forEach(function (n) { st.goal[n] = g[n]; g[n] = 1; }); }
        var css = { position: 'absolute', left: Math.round((sw - W) / 2) + 'px', top: Math.round((sh - H) / 2) + 'px', width: W + 'px', height: H + 'px', 'max-width': 'none', 'max-height': 'none' };
        Object.keys(css).forEach(function (n) { svg.style.setProperty(n, css[n], 'important'); });   // 3.083 — 3D 의 width:100%!important 규칙이 이 상자를 이겨 판이 커지지 않았고, 겨냥이 어긋났다(선수가 화면 위로 몰림)
        stage.style.setProperty('perspective', TV.persp + 'px'); stage.style.setProperty('perspective-origin', '50% 28%');
        env.resized(!snap);   // 이름표 크기가 배율을 따른다 — 다시 그리면 그 끝에서 다시 불린다
        if (!snap) return;
      }
      var m = layer.getCTM(); if (!m) return;
      var t0 = env.target(), t = { x: t0.x + st.off.x, y: t0.y + st.off.y }, px = { x: m.a * t.x + m.c * t.y + m.e, y: m.b * t.x + m.d * t.y + m.f };
      if (!snap && st.cur && env.playing()) px = { x: st.cur.x + (px.x - st.cur.x) * 0.08, y: st.cur.y + (px.y - st.cur.y) * 0.08 };   // 재생 중: 천천히 따라간다
      st.cur = px;
      document.body.style.setProperty('--tilt-tf', 'translateY(' + Math.round(sh * 0.08) + 'px) rotateX(' + TV.ax + 'deg) rotateZ(' + TV.yaw + 'deg) translate(' + (W * 0.5 - px.x).toFixed(1) + 'px,' + (H * 0.55 - px.y).toFixed(1) + 'px)');
      if (snap && !st.fitting) fit();
    }
    // 3.083 — 원근 · 사선 때문에 계산만으로는 가장자리 선수가 화면 밖으로 나갔다(실측: 왼쪽 골키퍼).
    // 담을 범위의 네 귀를 실제로 그려 재고(env.project), 화면의 빈 자리(env.safe — 위쪽 막대 아래 · 도크 위)에 들어오도록 배율 · 겨냥을 몇 번 고친다.
    function fit() {
      if (!env.project || !env.corners || !env.safe) return;
      var pts = env.corners(), safe = env.safe(); if (!pts || !pts.length || !safe || safe.w < 40 || safe.h < 40) return;
      var k0 = st.k; st.fitting = true;
      function loop(n) {
        for (var i = 0; i < n; i++) {
          var P = env.project(pts); if (!P || !P.length) break;
          var bx = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
          P.forEach(function (q) { bx.l = Math.min(bx.l, q.x); bx.r = Math.max(bx.r, q.x); bx.t = Math.min(bx.t, q.y); bx.b = Math.max(bx.b, q.y); });
          var sc = Math.min(safe.w / Math.max(1, bx.r - bx.l), safe.h / Math.max(1, bx.b - bx.t));
          var ex = (safe.x + safe.w / 2) - (bx.l + bx.r) / 2, ey = (safe.y + safe.h / 2) - (bx.t + bx.b) / 2;
          var scaleOk = sc >= 1 && sc <= 1.08, posOk = Math.abs(ex) < 6 && Math.abs(ey) < 6;
          if (scaleOk && posOk) break;
          if (!scaleOk) st.kf = Math.max(0.15, Math.min(4, st.kf * (sc < 1 ? Math.max(0.5, sc * 0.96) : Math.min(1.5, sc * 0.98))));
          else {
            // 화면에서 ex · ey 만큼 옮기려면 판 좌표로 얼마나 — 겨냥 둘레 두 점으로 잰 기울기(야코비안)로 푼다
            var c = env.target(), o = { x: c.x + st.off.x, y: c.y + st.off.y }, J = env.project([o, { x: o.x + 10, y: o.y }, { x: o.x, y: o.y + 10 }]); if (!J || J.length < 3) break;
            var a = (J[1].x - J[0].x) / 10, b = (J[2].x - J[0].x) / 10, cc = (J[1].y - J[0].y) / 10, d = (J[2].y - J[0].y) / 10, det = a * d - b * cc; if (Math.abs(det) < 1e-6) break;
            st.off.x -= (d * ex - b * ey) / det; st.off.y -= (-cc * ex + a * ey) / det;
          }
          update(true);
        }
      }
      try {
        loop(7);
        // 판을 다시 그리면 작전판이 viewBox 를 조금 다시 잡는다(도크 몫 등) — 다시 그린 뒤 한 번 더 재서 맞춘다
        if (Math.abs(st.k - k0) > 1e-3) { st.fitting = false; try { env.resized(true); } catch (_) {} st.fitting = true; loop(4); }
      } catch (_) {}
      st.fitting = false;
    }
    // 3.078 — 중계 카메라인 채 3D 를 끄면(평면) 키운 판 크기를 바로 돌려놓는다 — 평면에서는 update/off 를 부르는 곳이 없어 판이 확대된 채 남았다
    try {
      if (typeof document !== 'undefined' && document.body && typeof MutationObserver !== 'undefined') new MutationObserver(function () {
        if (st.size && !document.body.classList.contains('bc-tilt3d') && off()) { try { window.dispatchEvent(new Event('resize')); } catch (_) {} }
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) {}
    // 3.086 — 작전판 applyView 는 판 너비 · 높이를 지운다. 재생 중 장면마다 도크 폭이 조금 바뀌면 그 길로 불려(도크 크기 감시)
    //         지운 채 한 프레임이 그려졌다 — 판이 원래 크기로 튀었다가 돌아왔다(사용자 «재생해보니까 화면이 깜빡이는데»).
    //         카메라가 판 크기를 잡고 있는 동안은 그대로 둔다. 무대 크기가 정말 바뀌면 update 가 새 크기를 입힌다.
    function hold(fn) {
      var s = null, keep = null;
      try { var svg = env.svg(); if (st.size && svg) { s = svg.style; keep = PROPS.map(function (k) { return [k, s.getPropertyValue(k), s.getPropertyPriority(k)]; }); } } catch (_) {}
      try { return fn(); } finally {
        if (keep) try { keep.forEach(function (q) { if (q[1] && (s.getPropertyValue(q[0]) !== q[1] || s.getPropertyPriority(q[0]) !== q[2])) s.setProperty(q[0], q[1], q[2]); }); } catch (_) {}
      }
    }
    return { update: update, off: off, hold: hold, zoom: function () { return st.k; } };
  }
  // 동작 고르기(3.075): 장면 시작 · 장면 끝 · 골키퍼. 화면 방향(←·→)은 작전판에 보이는 그대로.
  var ACTS = [
    { group: '기본', items: [['', '자동'], ['none', '동작 없음']] },
    { group: '장면 시작 — 공을 보낸다', items: [['kick', '발로 차기'], ['headout', '헤딩으로 보내기']] },
    { group: '장면 끝 — 공을 받는다', items: [['recv', '발로 받기'], ['chest', '가슴으로 받기'], ['headin', '머리로 받기']] },
    { group: '골키퍼', items: [['dive', '다이빙(공 쪽)'], ['dive_l', '다이빙 ←'], ['dive_r', '다이빙 →'], ['dive_hl', '높게 ←'], ['dive_hr', '높게 →'], ['catch', '캐치'], ['punch', '펀칭']] }
  ];
  // 3.078 — 평면에서는 선수 · 공을 한 칸 크게(사용자 «평면일때는 토큰이 좀 더 크게»). 3D · 중계는 그대로, 장비 · 그림은 그대로.
  var FLAT_K = 1.5;
  function flatK(p, flat, isEquip) { return flat && p && p.team !== 'img' && !(isEquip && isEquip(p.team)) ? FLAT_K : 1; }
  if (typeof window !== 'undefined' && window.document) window.__flatK = function (p) {
    var b = window.document.body; return flatK(p, !!b && !b.classList.contains('bc-tilt3d'), typeof window.equipKey === 'function' ? window.equipKey : null);
  };
  // ── 작전판 연결(3.083 — board.html 크기 예산 때문에 여기로 옮김). 작전판의 전역(state · tokShape · svg · tokenLayer · CX · CY · squad · animPlaying …)은
  //    같은 문서의 다른 스크립트라 부를 때 이름으로 읽는다. board.html 은 같은 이름으로 부른다(window 속성).
  /* global state, tokShape, svg, tokenLayer, CX, CY, squad, animPlaying, mppNow, renderTokens, _curvePt, _lookFreeze, _realScaleOn, positionSelCtl, boardSaveLive, toast */
  // 중계 카메라가 담을 범위: 모든 장면의 선수 · 공(재생 중에도 화면이 흔들리지 않게)
  function playBox() {
    var pts = [];
    function add(sn) { if (!sn) return; (sn.players || []).forEach(function (p) { if (p && isFinite(p.x) && isFinite(p.y)) pts.push(p); }); var b = sn.ball; if (b && isFinite(b.x) && isFinite(b.y)) pts.push(b); }
    try { add(state); } catch (_) {}
    try { if (typeof anim !== 'undefined' && anim && anim.frames) anim.frames.forEach(function (f) { add(f && f.snap); }); } catch (_) {}
    if (!pts.length) return null;
    var b = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
    pts.forEach(function (p) { b.l = Math.min(b.l, +p.x); b.r = Math.max(b.r, +p.x); b.t = Math.min(b.t, +p.y); b.b = Math.max(b.b, +p.y); });
    return b;
  }
  function tv(bridge) {
    var box = playBox;   /* global anim */
    var win = window, cam = camera({
      svg: function () { return svg; }, stage: function () { return document.getElementById('boardStage'); }, layer: function () { return tokenLayer; }, mpp: function () { return mppNow(); },
      goalK: bridge.goalK, playing: function () { return typeof animPlaying !== 'undefined' && !!animPlaying; },
      target: function () { var b = box(); return b ? { x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 } : { x: CX, y: CY }; },
      spanM: function () { var b = box(), m = mppNow() || 10; return b ? Math.max(TV.widthM, (b.r - b.l) / m + TV.marginM, ((b.b - b.t) / m + TV.marginM) * 1.45) : TV.widthM; },
      // 3.083 — 실제로 재서 맞추기(fit): 담을 범위의 네 귀(여유 2m) · 판 좌표 → 화면 · 화면의 빈 자리
      // 3.083 — 사용자 «운동장이 최대한 많이 보이게 · 관중석은 거의 안 보여도»: 담을 범위 = 운동장 전체 + 선수 · 공(판 좌표)
      corners: function () {
        // 운동장 선(PR — 판 좌표 L · R · T · B). __pvBox 는 벤치 쪽 여백까지 들어 있어 관중석이 많이 담겼다
        var out = [], r = null, b = box(), m = 1.5 * (mppNow() || 10); try { r = typeof PR === 'function' ? PR() : null; } catch (_) {}   /* global PR */
        if (r && isFinite(r.L) && r.R > r.L) [[r.L - m, r.T - m], [r.R + m, r.T - m], [r.L - m, r.B + m], [r.R + m, r.B + m]].forEach(function (q) { out.push({ x: q[0], y: q[1] }); });
        if (b) [[b.l, b.t], [b.r, b.t], [b.l, b.b], [b.r, b.b]].forEach(function (q) { out.push({ x: q[0], y: q[1] }); });
        return out.length ? out : null;
      },
      project: function (pts) {
        var L = typeof tokenLayer !== 'undefined' ? tokenLayer : null, R = typeof svg !== 'undefined' ? svg : null; if (!L || !R) return null;
        var ns = 'http://www.w3.org/2000/svg', gl = document.createElementNS(ns, 'g'), gs = document.createElementNS(ns, 'g'), cs = [], out = [];
        [gl, gs].forEach(function (g) { g.setAttribute('pointer-events', 'none'); g.setAttribute('class', 'ps-tv-probe'); });
        pts.forEach(function (p) { var c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', String(p.x)); c.setAttribute('cy', String(p.y)); c.setAttribute('r', '0.5'); c.setAttribute('fill', 'none'); (p.s === 'svg' ? gs : gl).appendChild(c); cs.push(c); });
        L.appendChild(gl); R.appendChild(gs);
        try { cs.forEach(function (c) { var r = c.getBoundingClientRect(); out.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); }); } finally { L.removeChild(gl); R.removeChild(gs); }
        return out;
      },
      safe: function () {
        var stg = document.getElementById('boardStage'); if (!stg) return null; var r = stg.getBoundingClientRect(), top = r.top, bot = r.bottom;
        var tb = document.querySelector('#boardPageStrip.ps-tb>.tb-c'); if (tb) { var q = tb.getBoundingClientRect(); if (q.height) top = Math.max(top, q.bottom); }
        var dk = document.getElementById('ps-command-dock'); if (dk && getComputedStyle(dk).display !== 'none') { var d = dk.getBoundingClientRect(); if (d.height && d.top > top) bot = Math.min(bot, d.top); }
        top += 56; bot -= (win.__namePos === 'above' ? 16 : 36) + (typeof tokShape !== 'undefined' && tokShape === 'person' ? 20 : 0);   // 선 사람의 키 · 이름표 몫(위) · 여유(아래) — 3.086 이름표가 아래면 그 몫, 사람이면 발밑 번호 패 몫도
        return { x: r.left + 24, y: top, w: r.width - 48, h: bot - top };
      },
      resized: function (redraw) { try { var gh = document.getElementById('tiltGoals'); if (gh) { gh.__pre = null; gh.__projectionSignature = null; } bridge.sync(); } catch (_) {} if (redraw) { try { renderTokens(); } catch (_) {} } }
    });
    function on() { try { return document.body.classList.contains('bc-tilt3d') && win.__tilt3d && win.__tilt3d.cam === 'tv'; } catch (_) { return false; } }
    function off() { try { cam.off(); } catch (_) {} }
    win.__tvOn = on; win.__tvZoom = function () { return on() ? cam.zoom() : 1; };
    win.__tvCam = function (snap) { try { if (!on()) { off(); return; } cam.update(snap); } catch (_) {} };
    // 작전판은 applyView 를 이름으로 부른다(같은 문서의 전역 함수) — 감싸면 모든 부름이 여기를 지난다
    var av = win.applyView;
    if (typeof av === 'function' && !av.__tvHold) {
      win.applyView = function () { var self = this, a = arguments; return on() ? cam.hold(function () { return av.apply(self, a); }) : av.apply(self, a); };
      win.applyView.__tvHold = 1;
    }
    return { on: on, off: off };
  }
  function glue(win) {
    win._bcView = function () { return { orientation: state.orientation, spFlip: !!state.spFlip, tv: !!(win.__tvOn && win.__tvOn()) }; };
    win._tokFarKey = function () { try { if (tokShape !== 'person' || !document.body.classList.contains('bc-tilt3d')) return null; var v = win._bcView(); return function (o) { return screenVec(+o.x || 0, +o.y || 0, v).y; }; } catch (_) { return null; } };
    // 3.071 · 3.072 — 3D «사람»: 뛰는 자세 · 중계 시점에 바로 서기. 재생 · GIF · MP4 가 모두 renderInterp 를 지난다
    win._personMotion = function (a, b, u, curves) { if (tokShape !== 'person' || !document.body.classList.contains('bc-tilt3d')) return null; return motion(a, b, u, curves, { curvePt: _curvePt, mpp: mppNow() || 10, foot: win._footOf }); };
    win._footOf = function (p) { try { if (p.foot) return p.foot; var q = p.sqId && (squad.players || []).find(function (x) { return x.id === p.sqId; }); return (q && q.foot) || ''; } catch (_) { return ''; } };   // 3.074 주발
    win._kU = function (a, b, u, c) { try { return (tokShape === 'person' && document.body.classList.contains('bc-tilt3d')) ? ballU(a, b, u, mppNow(), c) : u; } catch (_) { return u; } };   // 3.074 차는 순간 공이 출발
    win._personStand = function () { try { return stand(!!(win.__tvOn && win.__tvOn())); } catch (_) { return null; } };
    // 3.083 — 서 있을 때도 뛸 때도 몸은 공을 본다(쉐이퍼처럼). 공이 몸에 붙어 있으면 방금 보던 쪽 그대로.
    var lastYaw = {};
    function ballYaw(p, view) {
      var b = typeof win._ballFor === 'function' ? win._ballFor(p) : null; if (!b || typeof b.x !== 'number') return null;
      var dx = b.x - p.x, dy = b.y - p.y, m = 1.2 * (mppNow() || 10);
      if (dx * dx + dy * dy < m * m) return lastYaw[p.id] != null ? lastYaw[p.id] : null;
      var s = screenVec(dx, dy, view); return (lastYaw[p.id] = Math.atan2(s.y, s.x) / D2R);
    }
    function personLive() { try { return tokShape === 'person' && document.body.classList.contains('bc-tilt3d'); } catch (_) { return false; } }
    win._personPose = function (p) {
      try {
        var v = win._bcView(), r = pose(win.__psMotion && win.__psMotion[p.id], v, p.coach ? null : ballYaw(p, v)), kit = win.__kitOf ? win.__kitOf(p) : null;
        if (kit) { r = r || {}; r.kit = kit; }   // 3.083 — 하의 · 스타킹(board-kit.js)
        return r;
      } catch (_) { return null; }
    };
    // 공 · 선수를 끄는 동안: 보드는 _dirLive() 일 때만 시선을 다시 그린다 — 그 길에 사람 몸 돌리기를 붙인다
    // (보드 본문 스크립트가 이 모듈 뒤에 그 함수들을 정의하므로 문서를 다 읽은 뒤에 감싼다)
    function wrapLive() {
      var dirLive = win._dirLive, turnAll = win._chipTurnAll;
      if (typeof dirLive !== 'function' || typeof turnAll !== 'function' || turnAll.__person) return;
      win._dirLive = function () { return personLive() || dirLive(); };
      win._chipTurnAll = function () {
        turnAll();
        if (!personLive() || !win.PSBoardDepth || !PSBoardDepth.repose || typeof tokenLayer === 'undefined' || !tokenLayer) return;
        (state.players || []).forEach(function (p) { var g = tokenLayer.querySelector('[data-id="' + p.id + '"][data-depth-chip]'); if (g) PSBoardDepth.repose(g, win._personPose(p)); });
      };
      win._chipTurnAll.__person = 1;
    }
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', wrapLive); else wrapLive();
    // 3.070 보드 설정 › 비율: 보기 좋게 | 실제 비율(보드마다)
    var n = 0; (function tryIt() {
      var sg = document.getElementById('realScaleSeg');
      if (!sg || typeof win._lookFreeze !== 'function' || typeof win._realScaleOn !== 'function') { if (++n < 120) win.setTimeout(tryIt, 250); return; }
      var sync = function () { [].forEach.call(sg.querySelectorAll('button'), function (x) { var o = (x.dataset.rs === '1') === _realScaleOn(); x.classList.toggle('on', o); x.setAttribute('aria-pressed', o ? 'true' : 'false'); }); try { document.body.classList.toggle('ps-real-scale', _realScaleOn()); } catch (_) {} };
      win.__syncRealScaleSeg = sync;
      sg.addEventListener('click', function (e) {
        var bt = e.target.closest('button[data-rs]'); if (!bt) return; var o = bt.dataset.rs === '1'; if (o === _realScaleOn()) return;
        _lookFreeze(); win.__realScale = o; sync(); renderTokens(); try { positionSelCtl(); } catch (_) {} try { boardSaveLive(); } catch (_) {}
        try { toast(o ? '실제 비율 — 선수 몸 폭 0.5m · 공 22cm 로 운동장과 같은 비율이에요' : '보기 좋게 — 토큰을 잘 보이게 키웠어요'); } catch (_) {}
      });
      sync();
    })();
  }
  if (typeof window !== 'undefined' && window.document) glue(window);
  return { tv: tv, FLAT_K: FLAT_K, flatK: flatK, TV: TV, KICK: KICK, DIVE: DIVE, ACTS: ACTS, isGK: isGK, kick: kick, ballU: ballU, motion: motion, screenVec: screenVec, pose: pose, stand: stand, camera: camera };
});
