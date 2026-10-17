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
  function pose(mv, view) {
    if (!mv) return null;
    if (mv.kick != null || mv.recv != null || mv.head != null || mv.dive != null || mv.chest != null || mv.catch != null || mv.punch != null) {
      var b = screenVec(mv.bx, mv.by, view), face = Math.atan2(b.y, b.x) / D2R, out = { yaw: face, phase: mv.run / 2.6, amp: 0, kick: mv.kick != null ? mv.kick : null, recv: mv.recv != null ? mv.recv : null, foot: mv.foot === 'L' ? 'L' : 'R' };
      if (mv.head != null) out.head = mv.head;
      ['chest', 'catch', 'punch'].forEach(function (n) { if (mv[n] != null) out[n] = mv[n]; });
      if (mv.dive != null) { var d = screenVec(mv.dx, mv.dy, view); out.dive = { t: mv.dive, dir: mv.side ? mv.side : (d.x < 0 ? -1 : 1), reach: Math.max(0.35, mv.reach || 0), high: !!mv.high }; }
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
    // 3.078 — 중계 카메라인 채 3D 를 끄면(평면) 키운 판 크기를 바로 돌려놓는다 — 평면에서는 update/off 를 부르는 곳이 없어 판이 확대된 채 남았다
    try {
      if (typeof document !== 'undefined' && document.body && typeof MutationObserver !== 'undefined') new MutationObserver(function () {
        if (st.size && !document.body.classList.contains('bc-tilt3d') && off()) { try { window.dispatchEvent(new Event('resize')); } catch (_) {} }
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) {}
    return { update: update, off: off, zoom: function () { return st.k; } };
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
  function tv(bridge) {
    var win = window, cam = camera({
      svg: function () { return svg; }, stage: function () { return document.getElementById('boardStage'); }, layer: function () { return tokenLayer; }, mpp: function () { return mppNow(); },
      goalK: bridge.goalK, playing: function () { return typeof animPlaying !== 'undefined' && !!animPlaying; },
      target: function () {
        var b = state.ball; if (b && isFinite(b.x) && isFinite(b.y)) return { x: +b.x, y: +b.y };
        var ps = (state.players || []).filter(function (p) { return p && isFinite(p.x) && isFinite(p.y); }); if (!ps.length) return { x: CX, y: CY };
        var x = 0, y = 0; ps.forEach(function (p) { x += +p.x; y += +p.y; }); return { x: x / ps.length, y: y / ps.length };
      },
      resized: function (redraw) { try { var gh = document.getElementById('tiltGoals'); if (gh) { gh.__pre = null; gh.__projectionSignature = null; } bridge.sync(); } catch (_) {} if (redraw) { try { renderTokens(); } catch (_) {} } }
    });
    function on() { try { return document.body.classList.contains('bc-tilt3d') && win.__tilt3d && win.__tilt3d.cam === 'tv'; } catch (_) { return false; } }
    function off() { try { cam.off(); } catch (_) {} }
    win.__tvOn = on; win.__tvZoom = function () { return on() ? cam.zoom() : 1; };
    win.__tvCam = function (snap) { try { if (!on()) { off(); return; } cam.update(snap); } catch (_) {} };
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
    win._personPose = function (p) { try { return pose(win.__psMotion && win.__psMotion[p.id], win._bcView()); } catch (_) { return null; } };
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
