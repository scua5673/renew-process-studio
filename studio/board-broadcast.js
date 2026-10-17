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
  var TV = { ax: 56, yaw: -16, widthM: 66, persp: 1000 };

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
    var k = kick(a, b, m, curves);
    if (k) {
      var kk = out[k.kicker] || (out[k.kicker] = { vx: 0, vy: 0, run: 0, total: 0, u: u });
      // 주발(env.foot: 선수단의 'L' 왼발 · 'R' 오른발 · 'B' 양발): 왼발잡이는 왼발로 차고 받는다
      var foot = function (p) { try { return env && env.foot && env.foot(p) === 'L' ? 'L' : 'R'; } catch (_) { return 'R'; } };
      if (u < KICK.win) { kk.kick = u / KICK.win; kk.bx = k.dx; kk.by = k.dy; kk.foot = foot(k.kp); }
      if (k.receiver != null && u > KICK.recvFrom) { var rr = out[k.receiver] || (out[k.receiver] = { vx: 0, vy: 0, run: 0, total: 0, u: u }); var rp = (u - KICK.recvFrom) / (1 - KICK.recvFrom); if (k.air) rr.head = rp; else rr.recv = rp; rr.bx = -k.dx; rr.by = -k.dy; rr.foot = foot(k.rp); }
      k.gks.forEach(function (g) {
        if (u <= DIVE.from) return;
        var e = out[g.id] || (out[g.id] = { vx: 0, vy: 0, run: 0, total: 0, u: u });
        delete e.recv; delete e.head;
        e.dive = (u - DIVE.from) / (1 - DIVE.from); e.bx = k.A.x - g.x; e.by = k.A.y - g.y;   // 골키퍼는 차는 쪽을 본다
        e.dx = k.B.x - g.x; e.dy = k.B.y - g.y; e.reach = Math.min(1, Math.hypot(e.dx, e.dy) / (5 * k.m));
      });
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
  function ballU(a, b, u, mpp) {
    if (!(u > 0 && u < 1) || !kick(a, b, mpp)) return u;
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
  function pose(mv, view) {
    if (!mv) return null;
    if (mv.kick != null || mv.recv != null || mv.head != null || mv.dive != null) {
      var b = screenVec(mv.bx, mv.by, view), face = Math.atan2(b.y, b.x) / D2R, out = { yaw: face, phase: mv.run / 2.6, amp: 0, kick: mv.kick != null ? mv.kick : null, recv: mv.recv != null ? mv.recv : null, foot: mv.foot === 'L' ? 'L' : 'R' };
      if (mv.head != null) out.head = mv.head;
      if (mv.dive != null) { var d = screenVec(mv.dx, mv.dy, view); out.dive = { t: mv.dive, dir: d.x < 0 ? -1 : 1, reach: Math.max(0.35, mv.reach || 0) }; }
      return out;
    }
    var s = screenVec(mv.vx, mv.vy, view), amp = Math.min(1, 0.45 + mv.total / 14), ease = Math.min(1, mv.u * 5, (1 - mv.u) * 5);
    var dir = Math.atan2(s.y, s.x) / D2R, turn = ((dir - 90) % 360 + 540) % 360 - 180;
    return { yaw: 90 + turn * Math.min(1, ease * 1.6), phase: mv.run / 2.6, amp: Math.max(0, amp * ease) };
  }
  // 중계 시점에서 선수를 화면에 바로 세운다 — 사선 회전을 되돌리고, 기울어 짧아진 만큼 키를 늘린다.
  function stand(tv) { return tv ? { rot: -TV.yaw, sy: 1 / Math.cos(TV.ax * D2R) } : null; }

  // 중계 카메라. 확대는 CSS scale 이 아니라 판 SVG 의 상자 자체를 키워서 한다 — scale 로 키우면 브라우저가 원래 크기로 그린 그림을 늘려 흐려진다(실측).
  // 경기장 그림 · 골대 층은 판 상자를 재서 따라온다(env.resized). 같은 변환 한 줄(--tilt-tf)을 판 · 경기장 · 골대가 함께 쓰므로 body 에 적는다.
  // env: svg() · stage() · layer()(판 좌표 층) · target() · mpp() · playing() · resized(rerender) · goalK(골대 과장 배율 — 중계는 실제 크기)
  function camera(env) {
    var st = { cur: null, k: 1, size: '', goal: null }, PROPS = ['position', 'left', 'top', 'width', 'height', 'max-width', 'max-height'];
    function off() {
      var svg = env.svg(), stage = env.stage();
      if (!st.size || !svg) return false;
      document.body.style.removeProperty('--tilt-tf');
      if (stage) { stage.style.removeProperty('perspective'); stage.style.removeProperty('perspective-origin'); }
      PROPS.forEach(function (k) { svg.style.removeProperty(k); });
      if (st.goal) { var g = env.goalK(); Object.keys(st.goal).forEach(function (k) { g[k] = st.goal[k]; }); st.goal = null; }
      st.cur = null; st.k = 1; st.size = ''; env.resized(false);
      return true;
    }
    function update(snap) {
      var svg = env.svg(), stage = env.stage(), layer = env.layer(); if (!svg || !stage || !layer) return;
      var sw = stage.clientWidth, sh = stage.clientHeight, vb = svg.viewBox && svg.viewBox.baseVal; if (!sw || !sh || !vb || !vb.width) return;
      var base = Math.min(sw / vb.width, sh / vb.height), k = Math.max(1, Math.min(8, sw / (TV.widthM * env.mpp() * base)));
      var W = Math.round(sw * k), H = Math.round(sh * k), size = [W, H, sw, sh].join('x');
      if (st.size !== size) {
        st.size = size; st.k = k;
        if (!st.goal) { var g = env.goalK(); st.goal = {}; Object.keys(g).forEach(function (n) { st.goal[n] = g[n]; g[n] = 1; }); }
        var css = { position: 'absolute', left: Math.round((sw - W) / 2) + 'px', top: Math.round((sh - H) / 2) + 'px', width: W + 'px', height: H + 'px', 'max-width': 'none', 'max-height': 'none' };
        Object.keys(css).forEach(function (n) { svg.style.setProperty(n, css[n]); });
        stage.style.setProperty('perspective', TV.persp + 'px'); stage.style.setProperty('perspective-origin', '50% 28%');
        env.resized(!snap);   // 이름표 크기가 배율을 따른다 — 다시 그리면 그 끝에서 다시 불린다
        if (!snap) return;
      }
      var m = layer.getCTM(); if (!m) return;
      var t = env.target(), px = { x: m.a * t.x + m.c * t.y + m.e, y: m.b * t.x + m.d * t.y + m.f };
      if (!snap && st.cur && env.playing()) px = { x: st.cur.x + (px.x - st.cur.x) * 0.08, y: st.cur.y + (px.y - st.cur.y) * 0.08 };   // 재생 중: 공을 천천히 따라간다
      st.cur = px;
      document.body.style.setProperty('--tilt-tf', 'translateY(' + Math.round(sh * 0.08) + 'px) rotateX(' + TV.ax + 'deg) rotateZ(' + TV.yaw + 'deg) translate(' + (W * 0.5 - px.x).toFixed(1) + 'px,' + (H * 0.55 - px.y).toFixed(1) + 'px)');
    }
    return { update: update, off: off, zoom: function () { return st.k; } };
  }
  return { TV: TV, KICK: KICK, DIVE: DIVE, isGK: isGK, kick: kick, ballU: ballU, motion: motion, screenVec: screenVec, pose: pose, stand: stand, camera: camera };
});
