/* PROCESS STUDIO — 새 미팅의 포메이션 고르기(3.122). 사용자 «시작할때 모달이 떠서 우리팀 포메이션, 상대 팀 포메이션 적용해서 페이지 마다 제대로 적용시켜줘».
   새 미팅의 기본 10장(board.html MEET_TPL — 우리 4-3-3 · 상대 4-4-2, 8인제는 board-meet-8.js — 2-3-2 · 3-3-1)을 만들 때 창을 띄워
   우리 팀 · 상대 팀 포메이션을 고르게 하고, 10장 모두에 그 포메이션을 넣는다.
   · 장마다 손으로 놓은 기본 배치(하이블록 · 로우블록 · 빌드업 …)를 버리지 않는다: 기본 포메이션의 자리(FORM 의 u 깊이 · v 너비)와 그 장의 자리로
     «이 장에서 이 팀은 얼마나 높고 넓게 섰나»(u → x, v → y 직선)를 재고, 기본 배치가 그 직선에서 벗어난 만큼(풀백이 올라감 · 공 쪽으로 쏠림)을
     가까운 자리끼리 나눠 준다. 고른 포메이션의 선수는 자기 FORM 자리에 그 직선 + 가까운 자리의 벗어남을 받는다.
   · BEST 11 은 선발 명단이라 직선만(운동장 전체에 고르게). 코너킥 두 장은 정해진 자리(니어 포스트 · 대인 · 역습 대기)를 그대로 두고
     번호 · 포지션만 가까운 역할끼리 짝짓는다. 골키퍼 · 공을 가진 선수는 그 자리 그대로.
   · 기본 포메이션을 고르면 그 팀은 예전 판과 똑같다.
   길은 둘: 보관함 «미팅 만들기»(__meetSeed — 10장을 채운 뒤 창을 띄우고 고르면 10장을 다시 그린다 · 8 대 8 도 여기서 고른다),
   경기 «＋ 새 미팅»(__meetingFromMatch — 만들기 전에 창을 띄우고, 고른 값으로 __meetTplSlides 가 낸 10장을 고친다 · 인원은 경기의 것).
   ⚠ board.html 의 FORM · MPP · CX · CY · anim 은 let/const 라 이름으로 읽는다(CLAUDE.md). 감싸기는 DOMContentLoaded 뒤 — board-meet-8.js 보다 바깥.
   3.132 — 사용자 «미팅자료 만들때 처음에 운동장을 고르게 하자 피치와 전술구역 운동장 가로 세로 · 미팅 자료 토큰은 지금보다 1단계 크게».
   · 같은 창 맨 위에 «운동장»(피치 다섯 · 전술 구역 여섯 · 가로/세로). 10장 모두(경기 길은 경기 장면까지 — board.html 바탕이 window.__meetLook 을 받는다)에 넣는다.
     방향은 미팅 방향(가로형 · 세로형 — ps_meet_orient_v2, 2.932)과 같은 값이다. 고른 피치 · 구역은 이 기기에 기억한다(KEY 의 look).
   · 새 미팅의 토큰은 작전판 «＋» 한 번(tokScaleLevels 한 칸) 크게 — 창에서 무엇을 고르든(닫아도). tokV:2 를 붙여 옛 기본 크기로 읽히지 않게(2.977).
   3.133 — 사용자 «보관함에서 미팅 자료 만들기 들어가면 상대분석과 경기준비 페이지를 따로 따로 만들어서 팀운영 경기 페이지에 붙힐수 있게».
   · 자료 종류(KINDS) — «경기 준비»(기본 10장 그대로) · «상대 분석»(OPP_TPL 6장: 상대 BEST + 팀 운영 › 경기 › 상대 분석의 국면 다섯 차례).
     종류는 보관함 태그(«상대 분석» · «경기 준비» — 새 저장 칸 없음, 보관함 «태그»로 바꿀 수 있다). 경기 화면(match-meet-parts.js)이 태그로 01 · 02 칸에 나눠 붙인다.
   · 상대 분석 장은 기본 10장의 같은 상황 판(미드블록 = 상대 공격 시 …)에 고른 포메이션을 넣고, 상대 BEST 는 우리 BEST 를 상대 포메이션으로 바꿔 뒤집는다.
     경기에서 만들면 그 경기 상대 분석의 국면 메모(p.oppNotes)가 그 장의 메모(points)로 들어간다(board.html tpl 장의 points · 자료 tags 를 받는다). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSMeetForm = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var KEY = 'ps_meet_form_v1';
  var LIST = { '11': ['433', '442', '4231', '4312', '4321', '352', '343', '3142', '3412', '3421'], '8': ['232', '331', '322', '241'] };
  var DEF = { '11': { us: '433', op: '442' }, '8': { us: '232', op: '331' } };
  var PITCH = { '11': { len: 105, wid: 68, mx: 2, my: 3 }, '8': { len: 65, wid: 48, mx: 1.5, my: 2.5 } };   // my = 터치라인에서 띄울 거리(m)
  var GAP = { '11': [5, 3.2], '8': [3.8, 2.8] };   // 같은 팀 · 다른 팀 사이 최소 거리(m) — 다른 팀은 토큰이 겹치지 않을 만큼
  var SIG = 0.09;   // 벗어남을 나눠 받는 거리(FORM 자리 — 깊이는 두 배로 센다)
  // 3.132 운동장 — 작전판 보드 설정의 «피치»(pitchSeg) · «전술 구역»(zonePreset)과 같은 값 · 같은 이름
  var PITCHES = [['navy', '네이비'], ['real', '잔디'], ['calm', '딥그린'], ['white', '화이트'], ['train', '훈련']];
  var GRIDS = [['off', '없음'], ['lanes', '채널'], ['grid', '격자'], ['thirds', '1/3'], ['zone20', '존'], ['grid15', '15존']];
  var LOOK_DEF = { pitch: 'navy', grid: 'grid15' };   // 3.128 새 미팅의 기본
  // 3.133 자료 종류 — 보관함 태그 이름과 같다
  var KINDS = [['prep', '경기 준비'], ['opp', '상대 분석']];
  var KIND_TAG = { prep: '경기 준비', opp: '상대 분석' };
  // 상대 분석 6장 — 팀 운영 › 경기 › 상대 분석(MB2_STD_PHASES)의 차례. from = 판을 가져올 기본 장(제목 일부), note = 경기 상대 분석 메모 칸
  var OPP_TPL = [
    { from: 'BEST', best: true, note: 'sum' },
    { t: '상대 공격 시', from: '미드블록', note: 'atk' },   // 상대가 공을 갖고 우리 블록을 연다
    { t: '상대 수비 시', from: '전진', note: 'def' },        // 우리가 상대 블록을 연다
    { t: '상대 수비→공격', from: '침투', note: 'ta' },       // 우리가 높이 올라간 때 공을 잃으면 — 상대 역습
    { t: '상대 공격→수비', from: '로우블록', note: 'td' },   // 우리 박스 앞에서 공을 뺏은 때 — 상대 되찾기
    { t: '상대 세트피스', from: '코너킥 수비', note: 'set' }
  ];
  function findT(list, key) { for (var i = 0; i < list.length; i++) if (String(list[i].title || '').indexOf(key) >= 0) return list[i]; return null; }
  // list = 기본 장 [{title, raw(고치기 전 판), snap(고른 포메이션의 판)}] → 상대 분석 장 [{title, snap, note}]
  function oppSlides(list, c, fmt, geo, forms) {
    var g = geo || { mpp: 10, cx: 555, cy: 370 }, d = DEF[fmt] || DEF['11'], out = [];
    OPP_TPL.forEach(function (e) {
      var s = findT(list, e.from); if (!s) return;
      var sn = s.snap;
      if (e.best) {   // 우리 BEST(우리 팀만)를 상대 포메이션으로 바꿔 운동장 가운데로 뒤집는다 — 상대 골대 오른쪽, 왼쪽으로 공격
        var op = c && c.op ? String(c.op) : d.op, bl = remapSnap(s.raw, s.title, { us: op, op: d.op }, g, forms) || JSON.parse(JSON.stringify(s.raw));
        sn = JSON.parse(JSON.stringify(bl));
        sn.players = (bl.players || []).filter(function (p) { return p && !p.coach && p.team === 'blue'; }).map(function (p) {
          var q = JSON.parse(JSON.stringify(p)); q.team = 'red'; q.x = rnd(2 * g.cx - p.x); q.y = rnd(2 * g.cy - p.y); delete q.name; return q;
        });
        sn.ball = null;
      }
      out.push({ title: e.best ? '상대 ' + s.title : e.t, snap: sn, note: e.note });
    });
    return out;
  }
  function blankSnap(snap) {
    var sn=JSON.parse(JSON.stringify(snap||{}));sn.players=[];sn.equipment=[];sn.drawings=[];sn.ball=null;return sn;
  }
  function startSlides(list,mode,chosen) {
    if(mode==='empty')return list.length?[{title:'',snap:blankSnap(list[0].snap)}]:[];
    return list.filter(function(s,i){return !Array.isArray(chosen)||chosen.indexOf(i)>=0;}).map(function(s){
      return {title:s.title,snap:mode==='categories'?blankSnap(s.snap):s.snap,note:s.note};
    });
  }
  var THEME = {   // 미리보기 색 — board.html :root · html[data-pitch] 의 --pitchbg · --grass-a · --pline · --grid
    navy: ['#15172b', '#20243f', '#eef0f6', '#6f8ff0'], real: ['#1b8044', '#2aa55a', 'rgba(255,255,255,.95)', 'rgba(255,255,255,.92)'],
    calm: ['#173a23', '#1f4d31', 'rgba(230,238,232,.82)', 'rgba(230,238,232,.5)'], white: ['#ffffff', '#edf0f5', '#c9ced6', '#9aa3af'], train: ['#ffffff', '#ffffff', '#8b95a3', '#aeb7c2']
  };
  function has(list, v) { return list.some(function (e) { return e[0] === v; }); }
  function name(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return ''; }
  // 3.132 «직접» — 원하는 색(사용자 «피치 원하는 색상도 선택 가능하게»). 작전판 «직접 색»(applyCustom)과 같은 값: pitchTheme 'custom' + pitchCustom '#rrggbb'
  function hex6(c) { c = String(c || '').trim().toLowerCase(); return /^#[0-9a-f]{6}$/.test(c) ? c : null; }
  function lum(c) { c = hex6(c) || '#000000'; var n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
  function normLook(v, oh) {
    v = v || {}; var cu = hex6(v.custom), p = has(PITCHES, v.pitch) || (v.pitch === 'custom' && cu) ? v.pitch : LOOK_DEF.pitch;
    return { pitch: p, custom: cu, grid: has(GRIDS, v.grid) ? v.grid : LOOK_DEF.grid, oh: v.oh === 'h' || v.oh === 'v' ? v.oh : (oh === 'h' ? 'h' : 'v') };
  }
  // 판(snap)에 적는 값 — 잔디는 작전판 «잔디» 단추처럼 grass 테마 + 실사 타일(@real), 네이비는 빈 테마, 직접은 custom + 색
  function lookSnap(lk) { var p = lk.pitch, cu = p === 'custom' ? hex6(lk.custom) : null; return { pitchTheme: cu ? 'custom' : (p === 'navy' || p === 'custom' ? '' : (p === 'real' ? 'grass' : p)), pitchImg: p === 'real' ? '@real' : null, pitchCustom: cu, gridType: lk.grid }; }
  function sameLook(sn, lk) { var w = lookSnap(lk); return !!sn && (sn.pitchTheme || '') === w.pitchTheme && (sn.pitchImg || null) === w.pitchImg && hex6(sn.pitchCustom) === w.pitchCustom && (sn.gridType || 'off') === w.gridType; }
  // 미리보기 색 — 직접 색은 작전판 applyCustom 처럼 밝기로 선 · 구역선 색을 정한다
  function themeOf(lk) { if (lk.pitch === 'custom' && hex6(lk.custom)) { var c = hex6(lk.custom), b = lum(c) > 0.62; return [c, c, b ? '#39414f' : '#ffffff', b ? '#7b8494' : '#cfe0ff']; } return THEME[lk.pitch] || THEME.navy; }
  // 토큰 한 단계 위 — 작전판 «＋»(scaleAll)와 같은 사다리 · 같은 반올림. 가장 큰 칸이면 그대로
  function bumpTok(levels, v) {
    if (!Array.isArray(levels) || !levels.length) return Math.round((+v || 0.4) * 1.15 * 100) / 100;
    var i = 0, bd = 1e9; levels.forEach(function (x, k) { var d = Math.abs(x - v); if (d < bd) { bd = d; i = k; } });
    return Math.round(levels[Math.min(levels.length - 1, i + 1)] * 100) / 100;
  }
  function label(k) { return String(k || '').split('').join('-'); }
  function fmtOf(sn) { return sn && sn.pitchSpec === 'u12' ? '8' : '11'; }
  function kindOf(title) { var t = String(title || ''); return /^(BEST|RESERVE)/i.test(t) ? 'best' : (/코너/.test(t) ? 'corner' : 'play'); }
  function okKey(forms, fmt, k) { return LIST[fmt].indexOf(String(k)) >= 0 && !!(forms && forms[k]) && forms[k].length === forms[DEF[fmt].us].length; }
  function norm(forms, fmt, c) {
    c = c || {}; var d = DEF[fmt];
    return { us: okKey(forms, fmt, c.us) ? String(c.us) : d.us, op: okKey(forms, fmt, c.op) ? String(c.op) : d.op };
  }
  function isGK(e) { return e && (e[3] === 'GK' || +e[0] < 0.1); }
  function bd(a, b) { var du = (a[0] - b[0]) * 2, dv = a[1] - b[1]; return Math.sqrt(du * du + dv * dv); }

  // 기본 10장의 선수(팀 안 순서) → 기본 FORM 의 몇 번째 자리. 포지션 이름으로 짝짓고, 같은 이름(ST 둘)은 판에서 위쪽부터.
  // 상대는 왼쪽으로 공격해 FORM 너비(v)가 뒤집힌다(mirror).
  function baseIdx(players, form, mirror) {
    var used = {}, byLab = {}, out = [];
    form.forEach(function (e, i) { (byLab[e[3]] = byLab[e[3]] || []).push(i); });
    Object.keys(byLab).forEach(function (k) { byLab[k].sort(function (a, b) { return mirror ? form[b][1] - form[a][1] : form[a][1] - form[b][1]; }); });
    players.forEach(function (p, i) {
      var j = -1, c = byLab[p && p.pos] || [], k;
      for (k = 0; k < c.length; k++) if (!used[c[k]]) { j = c[k]; break; }
      if (j < 0) for (k = 0; k < form.length; k++) if (!used[k] && String(form[k][2]) === String(p && p.num)) { j = k; break; }
      if (j < 0) for (k = 0; k < form.length; k++) if (!used[k]) { j = k; break; }
      used[j] = 1; out[i] = j;
    });
    return out;
  }
  function fit(xs, ys) {   // ys ≈ a + b·xs
    var n = xs.length, mx = 0, my = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n || 1; my /= n || 1;
    for (i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); }
    var b = sxx > 1e-9 ? sxy / sxx : 0; return { a: my - b * mx, b: b };
  }
  // 한 팀: T = 기본 배치(m, 팀 안 순서) · D = 기본 FORM · bi = baseIdx · F = 고른 FORM. 돌려주는 것: F 순서의 [{x, y}]
  function remapTeam(T, D, bi, F, kind) {
    var out = new Array(F.length), gT = -1, gF = -1, To = [], Fo = [], i, j;
    T.forEach(function (p, k) { if (gT < 0 && isGK(D[bi[k]])) gT = k; else To.push(k); });
    F.forEach(function (e, k) { if (gF < 0 && isGK(e)) gF = k; else Fo.push(k); });
    if (gF >= 0) out[gF] = gT >= 0 ? { x: T[gT].x, y: T[gT].y } : { x: T[0].x, y: T[0].y };
    if (kind === 'corner') {   // 정해진 자리는 그대로 — 가까운 역할끼리 하나씩
      var pairs = [], uF = {}, uT = {};
      Fo.forEach(function (fj) { To.forEach(function (ti) { pairs.push([bd(F[fj], D[bi[ti]]), fj, ti]); }); });
      pairs.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; });
      pairs.forEach(function (q) { if (uF[q[1]] || uT[q[2]]) return; uF[q[1]] = uT[q[2]] = 1; out[q[1]] = { x: T[q[2]].x, y: T[q[2]].y }; });
      return out;
    }
    var us = To.map(function (k) { return D[bi[k]][0]; }), vs = To.map(function (k) { return D[bi[k]][1]; });
    var fx = fit(us, To.map(function (k) { return T[k].x; })), fy = fit(vs, To.map(function (k) { return T[k].y; }));
    var res = To.map(function (k, n) { return [T[k].x - (fx.a + fx.b * us[n]), T[k].y - (fy.a + fy.b * vs[n])]; });
    Fo.forEach(function (fj) {
      var e = F[fj], x = fx.a + fx.b * e[0], y = fy.a + fy.b * e[1];
      if (kind !== 'best' && To.length) {
        var sw = 0, rx = 0, ry = 0, best = -1, bdv = 1e9;
        for (i = 0; i < To.length; i++) {
          var d = bd(e, D[bi[To[i]]]), w = Math.exp(-d * d / (2 * SIG * SIG));
          sw += w; rx += w * res[i][0]; ry += w * res[i][1]; if (d < bdv) { bdv = d; best = i; }
        }
        if (sw > 1e-6) { x += rx / sw; y += ry / sw; } else { x += res[best][0]; y += res[best][1]; }
      }
      out[fj] = { x: x, y: y };
    });
    return out;
  }
  // 겹침 풀기 · 운동장 안으로. pts: [{x, y, team, fixed}]
  function spread(pts, P, gap) {
    for (var it = 0; it < 40; it++) {
      var moved = false;
      for (var a = 0; a < pts.length; a++) for (var b = a + 1; b < pts.length; b++) {
        var p = pts[a], q = pts[b]; if (p.fixed && q.fixed) continue;
        var need = p.team === q.team ? gap[0] : gap[1], dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d >= need) continue;
        if (d < 1e-6) { dx = Math.cos(a + b); dy = Math.sin(a + b); d = 1; } else { dx /= d; dy /= d; }
        var over = need - d, sp = p.fixed ? 0 : (q.fixed ? 1 : 0.5), sq = 1 - sp;
        p.x -= dx * over * sp; p.y -= dy * over * sp; q.x += dx * over * sq; q.y += dy * over * sq; moved = true;
      }
      pts.forEach(function (p) { if (p.fixed) return; p.x = Math.max(P.mx, Math.min(P.len - P.mx, p.x)); p.y = Math.max(P.my, Math.min(P.wid - P.my, p.y)); });
      if (!moved) break;
    }
  }
  function rnd(v) { return Math.round(v * 10) / 10; }
  // 기본 10장의 한 장(snap) → 고른 포메이션의 판(새 객체). 바꿀 것이 없으면 null.
  // geo = {mpp, cx, cy} (판 단위) · forms = 작전판 FORM · choice = {us, op}
  function remapSnap(snap, title, choice, geo, forms) {
    if (!snap || !Array.isArray(snap.players) || !forms) return null;
    var fmt = fmtOf(snap), P = PITCH[fmt], c = norm(forms, fmt, choice), d = DEF[fmt], kind = kindOf(title);
    if (c.us === d.us && c.op === d.op) return null;
    var g = geo || { mpp: 10, cx: 555, cy: 370 }, l = g.cx - P.len * g.mpp / 2, t = g.cy - P.wid * g.mpp / 2;
    var toM = function (p) { return { x: (+p.x - l) / g.mpp, y: (+p.y - t) / g.mpp }; };
    var teams = { blue: { want: c.us, def: d.us, mirror: false }, red: { want: c.op, def: d.op, mirror: true } };
    var all = snap.players.filter(function (p) { return p && !p.coach; });
    var ball = snap.ball && isFinite(+snap.ball.x) ? toM(snap.ball) : null, holder = null, hd = 3;
    if (ball) all.forEach(function (p) { var m = toM(p), dd = Math.hypot(m.x - ball.x, m.y - ball.y); if (dd < hd) { hd = dd; holder = p; } });
    var outBy = {}, pts = [], changed = false;
    Object.keys(teams).forEach(function (tk) {
      var tm = teams[tk], list = all.filter(function (p) { return p.team === tk; }), D = forms[tm.def], F = forms[tm.want];
      if (!list.length || tm.want === tm.def || !D || !F || list.length !== D.length || F.length !== D.length) return;
      var T = list.map(toM), bi = baseIdx(list, D, tm.mirror), nw = remapTeam(T, D, bi, F, kind);
      var mine = nw.map(function (q, j) { return { x: q.x, y: q.y, team: tk, fixed: kind === 'corner' || isGK(F[j]), j: j }; });
      if (holder && holder.team === tk && kind !== 'corner') {   // 공을 가진 선수 — 그 자리에 가장 가까운 새 선수가 공을 받는다
        var hm = toM(holder), bj = null, bdd = 1e9;
        mine.forEach(function (q) { var dd = Math.hypot(q.x - hm.x, q.y - hm.y); if (dd < bdd) { bdd = dd; bj = q; } });
        if (bj) { bj.x = hm.x; bj.y = hm.y; bj.fixed = true; }
      }
      outBy[tk] = { list: list, F: F, pts: mine }; changed = true;
      mine.forEach(function (q) { pts.push(q); });
    });
    if (!changed) return null;
    all.forEach(function (p) { if (!outBy[p.team]) { var m = toM(p); pts.push({ x: m.x, y: m.y, team: p.team, fixed: true }); } });
    if (kind !== 'corner') spread(pts, P, GAP[fmt]);
    var sn = JSON.parse(JSON.stringify(snap)), done = {};
    sn.players = snap.players.map(function (p) {
      var o = p && outBy[p.team]; if (!o || p.coach) return JSON.parse(JSON.stringify(p));
      var k = done[p.team] = (done[p.team] || 0), q = o.pts[k], e = o.F[k]; done[p.team]++;
      var np = JSON.parse(JSON.stringify(o.list[k]));
      np.num = String(p.meetingRole==='reserve' ? (fmt==='8'?9:12)+k : e[2]); np.pos = e[3] || ''; np.x = rnd(l + q.x * g.mpp); np.y = rnd(t + q.y * g.mpp);
      delete np.name;   // 기본 10장은 이름이 없다 — 자리가 바뀐 선수에 남은 이름이 따라가지 않게
      return np;
    });
    return sn;
  }

  // 고른 값 기억(이 기기) — {fmt, '11': {us, op}, '8': {us, op}}
  function readMem(ls) { try { var v = JSON.parse(ls.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
  function writeMem(ls, fmt, c) { try { var m = readMem(ls); m.fmt = fmt; if (c.us) m[fmt] = { us: c.us, op: c.op }; if (c.look) m.look = { pitch: c.look.pitch, grid: c.look.grid, custom: hex6(c.look.custom) || (m.look && m.look.custom) || null }; ls.setItem(KEY, JSON.stringify(m)); } catch (_) {} }

  // 미리보기 그림(SVG 글) — 고른 운동장(색 · 전술 구역 · 가로/세로) · 팀 색 토큰 · 번호. 값은 숫자와 정해진 글(번호 · 색)만 넣는다
  function hex(c, d) { c = String(c || ''); return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) ? c : d; }
  function light(c) { c = hex(c, '#000000'); if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; var n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.72; }
  function previewSVG(snap, geo, col, look) {
    var fmt = fmtOf(snap), P = PITCH[fmt], g = geo || { mpp: 10, cx: 555, cy: 370 }, l = g.cx - P.len * g.mpp / 2, t = g.cy - P.wid * g.mpp / 2;
    var pa = fmt === '8' ? [12.5, 24] : [16.5, 40.3], ga = fmt === '8' ? [4.5, 12] : [5.5, 18.3], cc = fmt === '8' ? 7 : 9.15, L = P.len, W = P.wid;
    var lk = normLook(look, look && look.oh), th = themeOf(lk), v = lk.oh === 'v';
    // 세로는 작전판처럼 우리 골대가 아래(왼쪽 → 아래): (x, y) → (y, L − x)
    function X(x, y) { return rnd(v ? y : x); } function Y(x, y) { return rnd(v ? L - x : y); }
    function rect(x, y, w, h, a) { return '<rect x="' + (v ? rnd(y) : rnd(x)) + '" y="' + (v ? rnd(L - x - w) : rnd(y)) + '" width="' + rnd(v ? h : w) + '" height="' + rnd(v ? w : h) + '" ' + a + '/>'; }
    function line(x1, y1, x2, y2, a) { return '<line x1="' + X(x1, y1) + '" y1="' + Y(x1, y1) + '" x2="' + X(x2, y2) + '" y2="' + Y(x2, y2) + '" ' + a + '/>'; }
    var VW = v ? W : L, VH = v ? L : W;
    var ln = 'fill="none" stroke="' + th[2] + '" stroke-width="0.35"', gd = 'stroke="' + th[3] + '" stroke-width="0.3" stroke-dasharray="1.2 1.6" opacity="0.8"', o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 ' + (VW + 6) + ' ' + (VH + 6) + '" aria-hidden="true">');
    o.push('<rect x="-3" y="-3" width="' + (VW + 6) + '" height="' + (VH + 6) + '" rx="2" fill="' + th[0] + '"' + (lum(th[0]) > 0.9 ? ' stroke="#dfe3e8" stroke-width="0.3"' : '') + '/>');
    for (var k = 0; k < 10; k += 2) o.push(rect(L * k / 10, 0, L / 10, W, 'fill="' + th[1] + '"'));   // 잔디 줄무늬(작전판처럼 길이 방향 열 칸)
    // 전술 구역(작전판 buildGrid 와 같은 자리 — 박스 폭 · 골 에어리어 폭 · 박스 앞선 · 3등분)
    var y1 = (W - pa[1]) / 2, y2 = (W - ga[1]) / 2, y3 = W - y2, y4 = W - y1, bl = pa[0], br = L - pa[0];
    if (lk.grid === 'grid15') { o.push(rect(0, y1, L, y2 - y1, 'fill="' + th[3] + '" opacity="0.12"')); o.push(rect(0, y3, L, y4 - y3, 'fill="' + th[3] + '" opacity="0.12"')); }
    if (lk.grid === 'lanes' || lk.grid === 'grid' || lk.grid === 'grid15') [y1, y2, y3, y4].forEach(function (y) { o.push(line(0, y, L, y, gd)); });
    if (lk.grid === 'grid') [bl, (bl + L / 2) / 2, (br + L / 2) / 2, br].forEach(function (x) { o.push(line(x, 0, x, W, gd)); });
    if (lk.grid === 'thirds' || lk.grid === 'grid15') [L / 3, L * 2 / 3].forEach(function (x) { o.push(line(x, 0, x, W, gd)); });
    if (lk.grid === 'zone20') {
      o.push(line(0, y1, L, y1, gd)); o.push(line(0, y4, L, y4, gd)); o.push(line(bl, y2, br, y2, gd)); o.push(line(bl, y3, br, y3, gd));
      [bl, L / 2, br].forEach(function (x) { o.push(line(x, 0, x, W, gd)); });
      [(bl + L / 2) / 2, (L / 2 + br) / 2].forEach(function (x) { o.push(line(x, 0, x, y1, gd)); o.push(line(x, y4, x, W, gd)); });
    }
    o.push(rect(0, 0, L, W, ln)); o.push(line(L / 2, 0, L / 2, W, ln));
    o.push('<circle cx="' + X(L / 2, W / 2) + '" cy="' + Y(L / 2, W / 2) + '" r="' + cc + '" ' + ln + '/>');
    [0, 1].forEach(function (s) {
      [pa, ga].forEach(function (a) { o.push(rect(s ? L - a[0] : 0, (W - a[1]) / 2, a[0], a[1], ln)); });
    });
    var r = fmt === '8' ? 1.9 : 2.3;
    (snap.players || []).forEach(function (p) {
      if (!p || p.coach) return; var x = (+p.x - l) / g.mpp, y = (+p.y - t) / g.mpp; if (!isFinite(x) || !isFinite(y)) return;
      var f = p.team === 'red' ? hex(col && col.red, '#d71920') : hex(col && col.blue, '#1e5bc6'), lt = light(f);
      o.push('<circle cx="' + X(x, y) + '" cy="' + Y(x, y) + '" r="' + r + '" fill="' + f + '" stroke="' + (lt ? '#5e6675' : '#fff') + '" stroke-width="0.35"/>');
      o.push('<text x="' + X(x, y) + '" y="' + rnd(Y(x, y) + r * 0.42) + '" text-anchor="middle" font-size="' + rnd(r * 1.15) + '" font-weight="800" font-family="Pretendard,-apple-system,sans-serif" fill="' + (lt ? '#14161A' : '#fff') + '">' + String(+p.num || '').slice(0, 2) + '</text>');
    });
    if (snap.ball && isFinite(+snap.ball.x)) { var bx = (+snap.ball.x - l) / g.mpp, by = (+snap.ball.y - t) / g.mpp; o.push('<circle cx="' + X(bx, by) + '" cy="' + Y(bx, by) + '" r="' + (r * 0.5) + '" fill="#fff" stroke="#14161A" stroke-width="0.35"/>'); }
    o.push('</svg>');
    return o.join('');
  }

  var CSS = [
    '#psMeetForm{position:fixed;inset:0;z-index:10070;display:none;align-items:center;justify-content:center;background:rgba(10,14,24,.42);padding:8px;box-sizing:border-box}',
    '#psMeetForm.on{display:flex}',
    '#psMeetForm [hidden]{display:none!important}',
    'body.ps-meet-form-open #cs-ftoast{visibility:hidden!important}',
    'body.meeting-page-mode #animBar{display:none!important}',
    '@media(max-width:600px){#ksTop .ksbar .ksimport{display:none!important}}',
    '#psMeetForm .mf-box{width:430px;max-width:100%;max-height:100%;overflow:auto;padding:16px 16px 14px;border-radius:18px;background:#fff;color:#14161A;box-shadow:0 18px 44px rgba(15,23,42,.3);box-sizing:border-box;font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;font-size:12.5px}',
    'body.fmdark #psMeetForm .mf-box,body.ps-skin-glass #psMeetForm .mf-box{background:#1f2430;color:#E8ECF4}',
    '#psMeetForm .mf-hd{display:flex;align-items:center;justify-content:space-between}',
    '#psMeetForm .mf-hd b{font-size:16px;font-weight:800}',
    '#psMeetForm .mf-x{width:30px;height:30px;border:0;border-radius:9px;background:rgba(127,127,127,.12);color:inherit;font-size:18px;line-height:1;cursor:pointer}',
    '#psMeetForm .mf-sub{margin:4px 0 10px;font-size:12px;line-height:1.45;opacity:.68}',
    '#psMeetForm .mf-fmt{display:flex;gap:4px;padding:3px;border-radius:11px;background:rgba(127,127,127,.1);margin-bottom:4px}',
    '#psMeetForm .mf-fmt button{flex:1;height:30px;border:0;border-radius:8px;background:transparent;color:inherit;font-family:inherit;font-weight:700;font-size:12px;cursor:pointer}',
    '#psMeetForm .mf-fmt button.on{background:#fff;color:#14161A;box-shadow:0 1px 3px rgba(0,0,0,.14)}',
    'body.fmdark #psMeetForm .mf-fmt button.on{background:#3a4150;color:#fff}',
    // 3.133 자료 종류 — 11/8 고르개와 같은 모양, 고른 것은 남색(어느 칸에 붙일 자료인지 먼저 보이게)
    '#psMeetForm .mf-kind{display:flex;gap:4px;padding:3px;border-radius:11px;background:rgba(127,127,127,.1);margin-bottom:6px}',
    '#psMeetForm .mf-kind button{flex:1;height:34px;border:0;border-radius:8px;background:transparent;color:inherit;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer}',
    '#psMeetForm .mf-kind button.on{background:#14213D;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18)}',
    'body.fmdark #psMeetForm .mf-kind button.on{background:#5b8cff}',
    '#psMeetForm .mf-start{display:flex;gap:4px;padding:3px;border-radius:11px;background:rgba(127,127,127,.1);margin:8px 0}',
    '#psMeetForm .mf-start button{flex:1;min-height:44px;border:0;border-radius:8px;background:transparent;color:inherit;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}',
    '#psMeetForm .mf-start button.on{background:#14213D;color:#fff}',
    '#psMeetForm .mf-categories{display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;margin:8px 0}',
    '#psMeetForm .mf-categories label{display:flex;align-items:center;gap:6px;min-height:44px;font-size:12px;cursor:pointer}',
    '#psMeetForm .mf-categories input{width:17px;height:17px;accent-color:#3768cd;flex-shrink:0}',
    '#psMeetForm .mf-go:disabled{opacity:.45;cursor:default}',
    '#psMeetImport{position:fixed;inset:0;z-index:10100;background:rgba(10,14,24,.5);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}',
    '#psMeetImport .mi-box{width:480px;max-width:100%;max-height:100%;overflow:auto;box-sizing:border-box;padding:18px;border-radius:16px;background:var(--panel,#fff);color:var(--txt,#14161A);font:13px Pretendard,sans-serif}',
    '#psMeetImport [hidden]{display:none!important}',
    '#psMeetImport button,#psMeetImport input{font:inherit;box-sizing:border-box;border:1px solid var(--line,#dfe3e8);border-radius:9px;padding:10px;background:var(--panel2,#f4f6fa);color:inherit;min-height:44px}',
    '#psMeetImport .mi-head,#psMeetImport .mi-foot{display:flex;gap:8px;align-items:center;justify-content:space-between}',
    '#psMeetImport p{line-height:1.5;opacity:.75}',
    '#psMeetImport .mi-list{display:grid;gap:6px;margin:12px 0;max-height:50vh;overflow:auto}',
    '#psMeetImport .mi-list>button{text-align:left}',
    '#psMeetImport .mi-list label{display:flex;align-items:center;gap:8px;min-height:44px}',
    '#psMeetImport .mi-list input{min-height:18px;width:18px;height:18px;flex-shrink:0}',
    '#psMeetImport .mi-go{background:#14213D;color:white;flex:1}#psMeetImport button:disabled{opacity:.45}',
    '#psMeetForm .mf-h{display:flex;align-items:center;gap:6px;margin:10px 0 6px;font-weight:800;font-size:12.5px}',
    '#psMeetForm .mf-h i{width:12px;height:12px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}',
    '#psMeetForm .mf-chips{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}',
    '#psMeetForm .mf-chips button{height:32px;padding:0 2px;border-radius:9px;border:1px solid rgba(127,127,127,.28);background:transparent;color:inherit;font-family:inherit;font-weight:700;font-size:12.5px;cursor:pointer;font-variant-numeric:tabular-nums;white-space:nowrap;transition:none}',
    '#psMeetForm .mf-chips button.on{background:#14213D;border-color:#14213D;color:#fff}',
    'body.fmdark #psMeetForm .mf-chips button.on{background:#5b8cff;border-color:#5b8cff}',
    '#psMeetForm .mf-chips button.def:after{content:"기본";display:block;font-size:8.5px;font-weight:600;opacity:.6;margin-top:-1px}',
    '#psMeetForm .mf-chips button.def{line-height:1.05}',
    // 3.132 운동장 줄 — 이름 칸 + 고르개. 피치 칩은 색 점을 단다
    '#psMeetForm .mf-look{margin:10px 0 2px;padding:8px 10px;border-radius:12px;background:rgba(127,127,127,.07)}',
    '#psMeetForm .mf-look>b{display:block;font-size:12.5px;font-weight:800;margin-bottom:4px}',
    '#psMeetForm .mf-lr{display:grid;grid-template-columns:40px 1fr;align-items:center;gap:6px;margin:5px 0}',
    '#psMeetForm .mf-lr>span{font-size:11.5px;font-weight:700;opacity:.7}',
    '#psMeetForm .mf-lc{display:grid;gap:4px}',
    '#psMeetForm .mf-lc button,#psMeetForm .mf-lc label{box-sizing:border-box;height:30px;padding:0 2px;border-radius:8px;border:1px solid rgba(127,127,127,.28);background:transparent;color:inherit;font-family:inherit;font-weight:700;font-size:11.5px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:4px;line-height:1.05}',
    '#psMeetForm .mf-lc .on{background:#14213D;border-color:#14213D;color:#fff}',
    'body.fmdark #psMeetForm .mf-lc .on{background:#5b8cff;border-color:#5b8cff}',
    '#psMeetForm .mf-lc>.mf-cust{position:relative;overflow:hidden;height:auto;min-height:30px;align-self:stretch}',   // 폰은 단추가 터치 높이로 커진다 — 같은 줄 높이로
    '#psMeetForm .mf-cust input{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;opacity:0;cursor:pointer}',
    '@media (max-width:440px){#psMeetForm .mf-lc[data-look="pitch"]{grid-template-columns:repeat(3,1fr)!important}}',   // 폰 — 여섯 칩은 두 줄
    '#psMeetForm .mf-lc i{flex:0 0 auto;width:10px;height:10px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(127,127,127,.45)}',
    '#psMeetForm .mf-pv{margin-top:12px;border-radius:12px;background:rgba(127,127,127,.08);padding:8px}',
    '#psMeetForm .mf-pv.v svg{max-height:min(46vh,340px);width:auto;max-width:100%;margin:0 auto}',
    '#psMeetForm .mf-pv svg{display:block;width:100%;height:auto}',
    '#psMeetForm .mf-pvn{display:flex;align-items:center;justify-content:space-between;margin-top:6px;font-weight:700;font-size:12px}',
    '#psMeetForm .mf-pvn button{width:30px;height:26px;border-radius:8px;border:1px solid rgba(127,127,127,.28);background:transparent;color:inherit;font-size:14px;line-height:1;cursor:pointer}',
    '#psMeetForm .mf-pvn span{font-variant-numeric:tabular-nums}',
    '#psMeetForm .mf-ft{display:flex;gap:8px;position:sticky;bottom:-14px;margin:12px -16px -14px;padding:10px 16px 14px;background:inherit;border-top:1px solid rgba(127,127,127,.12)}',   // 폰처럼 낮은 화면에서도 단추는 늘 보이게
    '@media (max-height:760px){#psMeetForm .mf-pv svg{max-height:30vh;width:auto;max-width:100%;margin:0 auto}#psMeetForm .mf-sub{margin-bottom:6px}#psMeetForm .mf-h{margin:8px 0 5px}}',
    '#psMeetForm .mf-ft button{height:40px;border-radius:11px;font-family:inherit;font-weight:800;font-size:13.5px;cursor:pointer}',
    '#psMeetForm .mf-skip{flex:0 0 auto;padding:0 14px;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit}',
    '#psMeetForm .mf-go{flex:1 1 auto;border:0;background:#14213D;color:#fff}',
    'body.fmdark #psMeetForm .mf-go{background:#5b8cff}'
  ].join('\n');

  function install(win) {
    if (!win || !win.document || win.__psMeetForm) return null;
    win.__psMeetForm = true;
    var doc = win.document, cur = null, open = null, importerClose = null;
    // These dialogs own keyboard input, including configured board shortcuts.
    function modalKeys(e){
      if(!open&&!importerClose)return;
      if(e.type==='keydown'){
        if(importerClose&&e.key==='Escape'){e.preventDefault();importerClose();}
        else if(open)onKey(e);
      }
      e.stopImmediatePropagation();
    }
    win.addEventListener('keydown',modalKeys,true);win.addEventListener('keyup',modalKeys,true);
    /* global FORM, MPP, CX, CY, anim, undoStack, redoStack, state */
    function forms() { try { return typeof FORM !== 'undefined' ? FORM : null; } catch (_) { return null; } }
    function geo() { try { return { mpp: MPP, cx: CX, cy: CY }; } catch (_) { return { mpp: 10, cx: 555, cy: 370 }; } }
    function A() { try { return typeof anim !== 'undefined' ? anim : null; } catch (_) { return null; } }
    function kit() { try { var c = (typeof state !== 'undefined' && state && state.teamColors) || {}; return { blue: c.blue, red: c.red }; } catch (_) { return {}; } }
    function toast(m) { try { if (typeof win.toast === 'function') win.toast(m); } catch (_) {} }
    function floor() { try { return Math.min(0.4, win.defaultTokenScale()); } catch (_) { return 0.4; } }
    var ls = (function () { try { return win.localStorage; } catch (_) { return null; } })();
    var tplCache = {};
    // 기본 10장(고치기 전) — 미리보기와 8 대 8 바꾸기에 쓴다. 판을 건드리지 않는 함수만 부른다
    function tpl(fmt, base, oh) {
      if (!base && tplCache[fmt]) return tplCache[fmt];
      var out = []; oh = oh === 'v' ? 'v' : 'h';
      try {
        if (fmt === '8') out = win.PSMeet8 ? win.PSMeet8.slides(base || {}, false, oh, geo(), floor()) : [];
        else out = typeof win.__meetTplSlides === 'function' ? (win.__meetTplSlides.__psFormRaw || win.__meetTplSlides)(base || {}, false, oh) : [];
      } catch (_) { out = []; }
      if (!base) tplCache[fmt] = out;
      return out;
    }
    function remap(sn, title, c) { return remapSnap(sn, title, c, geo(), forms()); }
    // 3.133 — 고른 포메이션 · 자료 종류로 만든 장 [{title, snap, note}] — 미리보기(base 없음)와 보관함 채우기가 같은 길
    function built(fmt, base, oh, c, kind) {
      var list = tpl(fmt, base, oh).map(function (s) { return { title: s.title, raw: s.snap, snap: (c && c.us ? remap(s.snap, s.title, c) : null) || s.snap }; });
      return kind === 'opp' ? oppSlides(list, c, fmt, geo(), forms()) : list;
    }
    // 보관함 새 미팅의 저장 창에 종류 태그를 미리 넣는다(저장 창에서 지우거나 바꿀 수 있다)
    function tagPending(kind) {
      try {
        var pd = win.__vaultPending; if (!pd || (pd.type && pd.type !== 'meeting')) return;
        var t = (Array.isArray(pd.tags) ? pd.tags : []).filter(function (x) { return x !== KIND_TAG.opp && x !== KIND_TAG.prep; });
        t.unshift(KIND_TAG[kind === 'opp' ? 'opp' : 'prep']); pd.tags = t;
        if (kind === 'opp' && !pd.name) pd.name = '상대 분석'; else if (kind !== 'opp' && pd.name === '상대 분석') delete pd.name;
      } catch (_) {}
    }

    function mayImport(){return doc.body.classList.contains('meet-mode')&&!win.__vaultReadOnly&&!doc.body.classList.contains('comm-viewing')&&win.psVaultUnlocked&&win.psVaultUnlocked();}
    function owner(){try{return String(win.psMyUid?win.psMyUid():'')+'|'+ls.getItem('ps_active_ws');}catch(_){return '';}}
    function importLibrary(){
      if(!mayImport()||doc.getElementById('psMeetImport'))return;
      var a=A(),target=a.slides,scope=owner(),curId=win.__curVaultId||'',closed=false;
      var ov=el('div');ov.id='psMeetImport';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','미팅에 보관함 자료 가져오기');
      var box=el('div','mi-box'),hd=el('div','mi-head'),title=el('b','','보관함에서 가져오기'),x=el('button','','닫기');x.type='button';hd.append(title,x);box.appendChild(hd);
      var help=el('p','','선택한 장을 미팅 끝에 복사해 추가합니다. 원본 자료는 그대로 유지돼요.');box.appendChild(help);
      var search=el('input');search.type='search';search.placeholder='자료 이름 검색';search.setAttribute('aria-label','가져올 보관함 자료 검색');search.style.width='100%';box.appendChild(search);
      var list=el('div','mi-list'),status=el('p','','자료를 불러오는 중이에요.');status.setAttribute('role','status');list.appendChild(status);box.appendChild(list);
      var foot=el('div','mi-foot'),back=el('button','','자료 다시 고르기'),go=el('button','mi-go','선택한 장 추가');back.type=go.type='button';foot.append(back,go);foot.hidden=true;box.appendChild(foot);ov.appendChild(box);doc.body.appendChild(ov);
      var source=[],available=[];
      function valid(){return !closed&&mayImport()&&owner()===scope&&A()&&A().slides===target&&(win.__curVaultId||'')===curId;}
      function closeImport(){closed=true;importerClose=null;ov.remove();doc.removeEventListener('keydown',key,true);source=[];available=[];try{[].find.call(doc.querySelectorAll('#ksImportLibrary,#ksBot .kb-more'),function(b){return b.getClientRects().length;})?.focus();}catch(_){}}
      function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeImport();}}
      importerClose=closeImport;doc.addEventListener('keydown',key,true);x.onclick=closeImport;
      function pickItem(item){
        if(!valid()){closeImport();toast('팀이나 미팅이 바뀌어 가져오기를 멈췄어요');return;}
        source=item.type==='meeting'?item.slides:(win.__meetSlidesFromBoard?win.__meetSlidesFromBoard(item):[]);
        source=(Array.isArray(source)?source:[]).filter(function(sl){return sl&&sl.snap&&typeof sl.snap==='object';});
        if(!source.length){toast('가져올 운동장이 있는 장이 없어요');return;}
        list.textContent='';search.hidden=true;foot.hidden=false;title.textContent=item.name||'제목 없는 자료';
        source.forEach(function(sl,i){var lb=el('label'),cb=el('input');cb.type='checkbox';cb.value=i;cb.checked=true;lb.append(cb,doc.createTextNode((i+1)+'. '+(sl.title||'제목 없는 장')));list.appendChild(lb);});
        function selected(){return [].filter.call(list.querySelectorAll('input'),function(c){return c.checked;}).map(function(c){return +c.value;});}
        function count(){var n=selected().length;go.disabled=!n;go.textContent='선택한 '+n+'장 추가';}
        list.onchange=count;count();
        go.onclick=function(){
          if(!valid()){closeImport();toast('팀이나 미팅이 바뀌어 가져오기를 멈췄어요');return;}
          var chosen=selected();if(!chosen.length)return;
          var copies;try{copies=chosen.map(function(i){return JSON.parse(JSON.stringify(source[i]));});}catch(_){toast('자료를 복사하지 못했어요. 다시 골라 주세요');return;}
          try{if(win.__meetSyncCur)win.__meetSyncCur({thumb:true});}catch(_){toast('현재 장을 확인하지 못해 가져오기를 멈췄어요');return;}
          if(!valid())return;
          var at=target.length;copies.forEach(function(sl){target.push(sl);});
          win.__meet.go(at,'first');if(win.__ksRender)win.__ksRender();closeImport();toast(copies.length+'장을 미팅에 복사했어요');
        };
      }
      function render(){
        if(!valid()){closeImport();return;}
        list.textContent='';list.onchange=null;search.hidden=false;foot.hidden=true;title.textContent='보관함에서 가져오기';
        var q=search.value.trim().toLocaleLowerCase(),found=available.filter(function(it){return !q||String(it.name||'').toLocaleLowerCase().indexOf(q)>=0;});
        if(!found.length){list.appendChild(el('p','','가져올 미팅이나 작전판이 없어요.'));return;}
        found.slice(0,100).forEach(function(it){var b=el('button','',(it.name||'제목 없는 자료')+' · '+(it.type==='meeting'?'미팅':'작전판'));b.type='button';b.onclick=function(){pickItem(it);};list.appendChild(b);});
        if(found.length>100)list.appendChild(el('p','','100개를 표시했어요. 이름을 검색해 범위를 좁혀 주세요.'));
      }
      back.onclick=render;search.oninput=render;
      Promise.resolve().then(function(){return win.libGet();}).then(function(items){
        if(!valid()){closeImport();return;}
        available=(items||[]).filter(function(it){return it&&it.libId!==curId&&(it.type==='board'||it.type==='meeting')&&(it.snap||it.pages||it.slides);});render();
      },function(){if(!closed){list.textContent='';list.appendChild(el('p','','보관함 자료를 불러오지 못했어요. 창을 닫고 다시 시도해 주세요.'));}});
      search.focus();
    }
    importLibrary.can=mayImport;win.__meetImportLibrary=importLibrary;
    function wrapToolbar(){
      var render=win.__ksRender;if(typeof render!=='function')return false;if(render.__psImport)return true;
      var wrapped=function(){var r=render.apply(this,arguments);
        doc.querySelectorAll('#ksTop .ksbar').forEach(function(bar,i){
          var b=bar.querySelector('.ksimport');
          if(!b){b=el('button','ksimport','보관함에서 가져오기');b.type='button';b.id=i?'ksImportLibraryMobile':'ksImportLibrary';b.onclick=importLibrary;bar.appendChild(b);}
          if(mayImport())b.style.removeProperty('display');else b.style.setProperty('display','none','important');
        });return r;};wrapped.__psImport=true;win.__ksRender=wrapped;return true;
    }

    var st = doc.createElement('style'); st.id = 'ps-meet-form-css'; st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);

    // ── 창 ──
    function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    function close() { doc.body.classList.remove('ps-meet-form-open');var o = doc.getElementById('psMeetForm'); if (o) o.classList.remove('on'); open = null; doc.removeEventListener('keydown', onKey, true); }
    function onKey(e) {
      if (!open) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      else if (e.key === 'Enter' && !(e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName))) { e.preventDefault(); e.stopPropagation(); finish(true); }   // 단추 위의 Enter 는 그 단추
    }
    // go: true = 고른 대로 · 'def' = 기본 그대로(포메이션 · 운동장 기본, 방향은 지금 미팅 방향 — 기억은 바꾸지 않는다) · false = 닫기
    function finish(go) {
      var o = open; if (!o) return;
      if(go&&o.path==='vault'&&o.start!=='empty'&&Array.isArray(o.chosen)&&!o.chosen.length){toast('카테고리를 하나 이상 골라 주세요');return;}
      close();
      var c = go === 'def' ? { us: o.lookOnly ? undefined : DEF[o.fmt].us, op: o.lookOnly ? undefined : DEF[o.fmt].op, look: normLook({}, o.oh), kind: o.kind }
        : go ? { us: o.us, op: o.op, look: { pitch: o.look.pitch, custom: o.look.custom, grid: o.look.grid, oh: o.look.oh }, kind: o.kind } : null;
      if(o.path==='vault'){if(!c)c={us:DEF[o.fmt].us,op:DEF[o.fmt].op,look:normLook({},o.oh),kind:o.kind};c.start=go?o.start:'categories';c.chosen=go&&o.chosen?o.chosen.slice():null;}
      if (c && go && go !== 'def') writeMem(ls, o.fmt, c);
      try { o.done(c, o.fmt); } catch (_) {}
    }
    // o = {path:'vault'|'match', fmt, canFmt, oh('h'|'v' — 지금 미팅 방향), lookOnly(포메이션 없이 운동장만 — 기본 10장을 넣지 않는 경기 미팅), done(choice|null, fmt)}
    function show(o) {
      if (!forms() && !o.lookOnly) { try { o.done(null, o.fmt); } catch (_) {} return false; }
      if (open) finish(false);
      var mem = readMem(ls);
      if (o.canFmt && (mem.fmt === '8' || mem.fmt === '11')) o.fmt = mem.fmt;
      o.fmt = o.fmt === '8' ? '8' : '11';
      function pick(fmt) { var c = norm(forms(), fmt, mem[fmt]); o.us = c.us; o.op = c.op; o.pv = 2; }
      if (o.lookOnly) { o.us = o.op = undefined; o.pv = 0; } else pick(o.fmt);
      o.look = normLook(mem.look, o.oh); o.look.oh = o.oh === 'h' ? 'h' : 'v'; open = o;
      var cust0 = o.look.custom || hex6(mem.look && mem.look.custom) || (function () { try { return hex6(ls && ls.getItem('cs_pitch_custom')); } catch (_) { return null; } })() || '#1b8044';   // 작전판 «직접 색»의 마지막 색
      var ov = doc.getElementById('psMeetForm');
      if (!ov) { ov = el('div'); ov.id = 'psMeetForm'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); doc.body.appendChild(ov); }
      o.kind = o.kind === 'opp' ? 'opp' : 'prep';
      if(o.path==='vault'){o.start='categories';o.chosen=null;}
      var ttl = o.lookOnly ? '운동장 고르기' : (o.canKind ? '미팅 자료 만들기' : (o.kind === 'opp' ? '상대 분석 자료 만들기' : '운동장 · 포메이션 고르기')); ov.setAttribute('aria-label', ttl);
      ov.textContent = '';
      var box = el('div', 'mf-box'); ov.appendChild(box);
      var hd = el('div', 'mf-hd'); hd.appendChild(el('b', '', ttl));
      var x = el('button', 'mf-x', '×'); x.type = 'button'; x.setAttribute('aria-label', o.path === 'match' ? '만들지 않고 닫기' : '카테고리만 두고 닫기'); hd.appendChild(x); box.appendChild(hd);
      var sub = el('div', 'mf-sub'); box.appendChild(sub);
      function subText() { if(o.path==='vault')return o.start==='categories'?'카테고리 이름과 빈 운동장으로 시작해요. 필요한 장만 고르고, 보관함 자료는 나중에 복사해 더할 수 있어요.':o.start==='empty'?'빈 운동장 한 장에서 시작해요. 제목과 내용을 직접 넣거나 보관함 자료를 더하세요.':(o.kind==='opp'?'상대 분석 6장 — ':'경기 준비 10장 — ')+'기본 배치가 들어 있는 자료에서 필요한 장만 골라 시작해요.'; return o.lookOnly ? '고른 운동장을 모든 장에 넣어요.' : (o.kind === 'opp' ? '상대 분석 6장 — 상대 BEST와 상대 분석의 국면(공격 시 · 수비 시 · 두 전환 · 세트피스) 차례로 채워요. 팀 운영 › 경기 › 상대 분석에 붙여요.' : '운동장과 우리 팀 · 상대 팀 포메이션으로 10장을 채워요. 장마다(블록 · 빌드업 · 코너킥) 자리를 맞춰 놓아요.'); }
      var kseg = null;
      if (o.canKind) {   // 3.133 — 자료 종류(팀 운영 › 경기의 어느 칸에 붙일 자료인가)
        kseg = el('div', 'mf-kind'); kseg.setAttribute('role', 'group'); kseg.setAttribute('aria-label', '자료 종류');
        KINDS.forEach(function (k) { var b = el('button', '', k[1]); b.type = 'button'; b.setAttribute('data-kind', k[0]); kseg.appendChild(b); });
        box.appendChild(kseg);
      }
      var startSeg=null,categories=null;
      if(o.path==='vault'){
        startSeg=el('div','mf-start');startSeg.setAttribute('role','group');startSeg.setAttribute('aria-label','시작 구성');
        [['categories','카테고리만'],['filled','기본 자료 포함'],['empty','빈 한 장']].forEach(function(k){var b=el('button','',k[1]);b.type='button';b.dataset.start=k[0];startSeg.appendChild(b);});
        box.appendChild(startSeg);categories=el('div','mf-categories');categories.setAttribute('role','group');categories.setAttribute('aria-label','시작할 카테고리');box.appendChild(categories);
      }
      var seg = null;
      if (o.canFmt) {
        seg = el('div', 'mf-fmt');
        [['11', '11 대 11'], ['8', '8 대 8']].forEach(function (f) { var b = el('button', '', f[1]); b.type = 'button'; b.setAttribute('data-fmt', f[0]); seg.appendChild(b); });
        box.appendChild(seg);
      }
      // 3.132 운동장 — 피치 · 전술 구역 · 방향
      var lookBox = el('div', 'mf-look'), lrows = {}; lookBox.appendChild(el('b', '', '운동장'));
      [['pitch', '피치', PITCHES], ['grid', '구역', GRIDS], ['oh', '방향', [['h', '가로'], ['v', '세로']]]].forEach(function (r) {
        var row = el('div', 'mf-lr'), lc = el('div', 'mf-lc'); row.appendChild(el('span', '', r[1]));
        lc.setAttribute('data-look', r[0]); lc.setAttribute('role', 'group'); lc.setAttribute('aria-label', r[1]); lc.style.gridTemplateColumns = 'repeat(' + (r[2].length + (r[0] === 'pitch' ? 1 : 0)) + ',1fr)';
        r[2].forEach(function (e) {
          var b = el('button'); b.type = 'button'; b.setAttribute('data-v', e[0]);
          if (r[0] === 'pitch') { var i = el('i'); i.style.background = THEME[e[0]][e[0] === 'white' || e[0] === 'train' ? 0 : 1]; b.appendChild(i); }
          b.appendChild(doc.createTextNode(e[1])); lc.appendChild(b);
        });
        if (r[0] === 'pitch') {   // «직접» — 칩 위에 색 고르개를 깐다(누르면 바로 열린다 — iOS 사파리는 숨긴 input 을 대신 눌러 주면 안 열린다)
          var cb = el('label', 'mf-cust'), sw = el('i'), ci = el('input');
          cb.setAttribute('data-v', 'custom'); cb.title = '원하는 색'; ci.type = 'color'; ci.value = cust0; ci.setAttribute('aria-label', '피치 색 직접 고르기');
          cb.appendChild(sw); cb.appendChild(doc.createTextNode('직접')); cb.appendChild(ci); lc.appendChild(cb);
          var pickC = function () { var c = hex6(ci.value); if (!c) return; o.look.pitch = 'custom'; o.look.custom = c; paint(); };
          ci.addEventListener('input', pickC); ci.addEventListener('change', pickC);
          ci.addEventListener('click', function () { if (o.look.pitch !== 'custom') pickC(); });   // 고르개를 연 것만으로도 «직접»을 고른 것
          o.cust = { sw: sw, ci: ci };
        }
        row.appendChild(lc); lookBox.appendChild(row); lrows[r[0]] = lc;
      });
      box.appendChild(lookBox);
      var col = kit(), rows = {};
      var formParts=[];
      if (!o.lookOnly) [['us', '우리 팀', hex(col.blue, '#1e5bc6')], ['op', '상대 팀', hex(col.red, '#d71920')]].forEach(function (r) {
        var h = el('div', 'mf-h'); var i = el('i'); i.style.background = r[2]; h.appendChild(i); h.appendChild(doc.createTextNode(r[1])); box.appendChild(h);
        var ch = el('div', 'mf-chips'); ch.setAttribute('data-team', r[0]); box.appendChild(ch); rows[r[0]] = ch;formParts.push(h,ch);
      });
      var pv = el('div', 'mf-pv'), pic = el('div', 'mf-pic'), nav = el('div', 'mf-pvn');
      var prev = el('button', '', '‹'), next = el('button', '', '›'), cap = el('span');
      prev.type = next.type = 'button'; prev.setAttribute('aria-label', '앞 장'); next.setAttribute('aria-label', '다음 장');
      nav.appendChild(prev); nav.appendChild(cap); nav.appendChild(next); pv.appendChild(pic); pv.appendChild(nav); if (!o.lookOnly) box.appendChild(pv);
      var ft = el('div', 'mf-ft'), skip = el('button', 'mf-skip', '기본 그대로'), go = el('button', 'mf-go', o.path === 'match' ? '이대로 만들기' : '이대로 채우기');
      if(o.path==='vault')skip.textContent='카테고리만 두기';
      if (o.lookOnly) skip.textContent = '네이비 · 15존 그대로';
      skip.type = go.type = 'button'; ft.appendChild(skip); ft.appendChild(go); box.appendChild(ft);
      function paint() {
        if (seg) [].forEach.call(seg.children, function (b) { b.classList.toggle('on', b.getAttribute('data-fmt') === o.fmt); });
        if (kseg) [].forEach.call(kseg.children, function (b) { var on = b.getAttribute('data-kind') === o.kind; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        sub.textContent = subText();
        Object.keys(lrows).forEach(function (k) { [].forEach.call(lrows[k].children, function (b) { var on = b.getAttribute('data-v') === o.look[k]; b.classList.toggle('on', on); if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); });
        if (o.cust) o.cust.sw.style.background = o.look.custom || o.cust.ci.value;
        if (o.lookOnly) return;
        ['us', 'op'].forEach(function (tk) {
          var ch = rows[tk], want = o[tk], d = DEF[o.fmt][tk];
          if (ch.getAttribute('data-fmt') !== o.fmt) {
            ch.textContent = ''; ch.setAttribute('data-fmt', o.fmt);
            LIST[o.fmt].forEach(function (k) { var b = el('button', k === d ? 'def' : '', label(k)); b.type = 'button'; b.setAttribute('data-k', k); ch.appendChild(b); });
          }
          [].forEach.call(ch.children, function (b) { var on = b.getAttribute('data-k') === want; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        });
        var list = built(o.fmt, null, 'h', o, o.kind);
        if(startSeg){
          [].forEach.call(startSeg.children,function(b){var on=b.dataset.start===o.start;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
          formParts.forEach(function(e){e.hidden=o.start!=='filled';});
          categories.hidden=o.start==='empty';
          var key=o.kind+'|'+o.fmt;
          if(categories.dataset.key!==key){
            categories.textContent='';categories.dataset.key=key;
            list.forEach(function(sl,i){var lb=el('label'),cb=el('input');cb.type='checkbox';cb.value=i;cb.checked=!Array.isArray(o.chosen)||o.chosen.indexOf(i)>=0;lb.append(cb,doc.createTextNode(sl.title));categories.appendChild(lb);});
          }
          list=startSlides(list,o.start,o.chosen);go.disabled=!list.length;go.textContent='선택한 '+list.length+'장으로 만들기';
        }
        var n=list.length;pv.hidden=!n;if(!n)return;
        o.pv = (o.pv + n) % n; var s = list[o.pv], sn = s.snap;
        pv.classList.toggle('v', o.look.oh === 'v'); pic.innerHTML = previewSVG(sn, geo(), col, o.look);
        cap.textContent = s.title + '  ' + (o.pv + 1) + ' / ' + n;
      }
      if(categories)categories.addEventListener('change',function(){o.chosen=[].filter.call(categories.querySelectorAll('input'),function(c){return c.checked;}).map(function(c){return +c.value;});paint();});
      ov.onclick = function (e) {
        var t = e.target, b = t.closest ? t.closest('button') : null;
        if (t === ov) return;   // 바깥 누름은 아무것도 하지 않는다(실수로 닫히지 않게)
        if (!b) return;
        if(b.hasAttribute('data-start')){o.start=b.dataset.start;o.pv=0;paint();return;}
        if (b === x) { finish(false); return; }
        if (b === skip) { finish(open.path === 'match' ? 'def' : false); return; }   // 3.132 — 경기 길의 «기본 그대로»는 기본으로 만든다(예전엔 닫기와 같아 만들지 않았다). 보관함 길은 채운 기본 10장 그대로
        if (b === go) { finish(true); return; }
        if (b === prev) { o.pv--; paint(); return; }
        if (b === next) { o.pv++; paint(); return; }
        if (b.hasAttribute('data-fmt')) { var f = b.getAttribute('data-fmt'); if (f !== o.fmt) { o.fmt = f;o.chosen=null; pick(f); paint(); } return; }
        if (b.hasAttribute('data-kind')) { var kd = b.getAttribute('data-kind'); if (kd !== o.kind) { o.kind = kd;o.chosen=null; o.pv = kd === 'opp' ? 0 : 2; paint(); } return; }
        var ch = b.parentNode, tk = ch && ch.getAttribute('data-team'), lkk = ch && ch.getAttribute('data-look');
        if (lkk) { o.look[lkk] = b.getAttribute('data-v'); paint(); return; }
        if (tk) { o[tk] = b.getAttribute('data-k'); paint(); }
      };
      paint(); ov.classList.add('on');doc.body.classList.add('ps-meet-form-open');
      // 막 뜬 알림(보관함의 옛 «빈 미팅 노트 — 슬라이드를 추가하세요» 등)은 창을 가리므로 걷는다
      try { var tt = doc.getElementById('cs-ftoast'); if (tt && tt.style.opacity !== '0') { clearTimeout(tt._ft); tt.style.opacity = '0'; tt.style.pointerEvents = 'none'; tt.setAttribute('aria-hidden', 'true'); } } catch (_) {}
      doc.addEventListener('keydown', onKey, true);
      try { go.focus({ preventScroll: true }); } catch (_) {}
      return true;
    }

    // ── 길 1: 보관함 «미팅 만들기» — 기본 10장을 채운 뒤 창. 고르면 10장을 다시 그린다 ──
    function ohOf(it) { return it && it.pdfOrientation === 'landscape' ? 'h' : (it && it.pdfOrientation === 'portrait' ? 'v' : (it && it.snap && it.snap.orientation === 'h' ? 'h' : 'v')); }
    function applySeeded(items, base, c, fmt) {
      var a = A(); if (!a || !Array.isArray(a.slides) || !doc.body.classList.contains('meet-mode')) return 0;
      var live = items.filter(function (it) { return a.slides.indexOf(it) >= 0; });
      if (live.length !== items.length) return 0;   // 그새 슬라이드를 고쳤다 — 건드리지 않는다
      var was = fmtOf(items[0] && items[0].snap), d = DEF[fmt], src, lk = normLook(c.look, ohOf(items[0]));
      if(c.start){
        if(a.slides.length!==items.length||items.some(function(it,i){return a.slides[i]!==it;})){toast('미팅 구성이 바뀌어 시작 설정을 적용하지 않았어요');return 0;}
        var chosen=startSlides(built(fmt,JSON.parse(JSON.stringify(base||{})),lk.oh,c,c.kind),c.start,c.chosen);
        if(!chosen.length)return 0;
        var po=lk.oh==='h'?'landscape':'portrait',put=lookSnap(lk);
        var replacements=chosen.map(function(sl){
          var sn=JSON.parse(JSON.stringify(sl.snap));Object.assign(sn,put,{orientation:lk.oh,spFlip:false});
          // Keep the original filled-template load/capture normalization (ball identity, token defaults).
          if(c.start==='filled'){win.loadSnap(sn);sn=win.captureSnap();sn.orientation=lk.oh;sn.spFlip=false;}
          return {pdfOrientation:po,title:sl.title||'',points:[],snap:sn,thumb:(function(){try{return win.__snapToThumb?win.__snapToThumb(sn):'';}catch(_){return '';}})()};
        });
        win.__meetLoad(replacements);win.__meetingPdfOrientation=po;
        if(ls)try{ls.setItem('ps_meet_orient_v2',po);}catch(_){}
        win.loadSnap(replacements[0].snap);win.__meet.go(0,'first');
        try{if(typeof undoStack!=='undefined')undoStack.length=0;if(typeof redoStack!=='undefined')redoStack.length=0;}catch(_){}
        if(win.__ksRender)win.__ksRender();return replacements.length;
      }

      var formOn = !(c.us === d.us && c.op === d.op), lookOn = items.some(function (it) { return !sameLook(it.snap, lk); }), ohOn = ohOf(items[0]) !== lk.oh, kindOn = c.kind === 'opp';
      if (fmt === was && !formOn && !lookOn && !ohOn && !kindOn) return 0;
      if (ohOn) {   // 미팅 방향(가로형 · 세로형) — meetCap 이 첫 장의 방향으로 판을 담는다. 다음 새 미팅도 이 방향(2.932)
        var po = lk.oh === 'h' ? 'landscape' : 'portrait';
        items.forEach(function (it) { it.pdfOrientation = po; });
        try { win.__meetingPdfOrientation = po; } catch (_) {}
        try { if (ls) ls.setItem('ps_meet_orient_v2', po); } catch (_) {}
      }
      var fresh = fmt !== was || kindOn;   // 새 틀(8 대 8 · 상대 분석)은 기본 장을 다시 받아 만든다
      if (fresh) {
        src = built(fmt, JSON.parse(JSON.stringify(base || {})), lk.oh, c, c.kind);   // 판 방향 = 미팅 방향(그림도 그 방향으로)
        if (!src.length || (!kindOn && src.length !== items.length) || src.length > items.length) return 0;
      } else src = items.map(function (it) { return { title: it.title, snap: remap(it.snap, it.title, c) || it.snap }; });
      var n = 0, put = lookSnap(lk);
      src.forEach(function (s, i) {
        var sn = JSON.parse(JSON.stringify(s.snap));
        Object.assign(sn, put); sn.orientation = lk.oh; sn.spFlip = false;
        try { win.loadSnap(sn); } catch (_) { return; }
        var it = items[i], th = ''; try { th = win.boardThumbSVG(); } catch (_) {}
        try { it.snap = win.__meetCap ? win.__meetCap() : sn; } catch (_) { it.snap = sn; }
        it.thumb = th; if (fresh) it.title = s.title; n++;
      });
      if (src.length < items.length) items.slice(src.length).forEach(function (it) { var j = a.slides.indexOf(it); if (j >= 0) a.slides.splice(j, 1); });   // 상대 분석은 6장
      var k = -1; try { k = win.__meet.idx(); } catch (_) {}
      if (k >= a.slides.length) k = 0;
      try { win.loadSnap(a.slides[k >= 0 ? k : 0].snap); } catch (_) {}
      try { if (typeof undoStack !== 'undefined') undoStack.length = 0; if (typeof redoStack !== 'undefined') redoStack.length = 0; } catch (_) {}
      try { if (win.__ksRender) win.__ksRender(); } catch (_) {}
      return n;
    }
    function lookText(lk) { return (lk.pitch === 'custom' ? '직접 색' : name(PITCHES, lk.pitch)) + ' · ' + name(GRIDS, lk.grid) + ' · ' + (lk.oh === 'h' ? '가로' : '세로'); }
    function said(c, fmt, n) {
      var d = DEF[fmt]; if (!n) return;
      if(c.start&&c.start!=='filled'){toast(n+'장으로 시작했어요 — '+(c.start==='categories'?'카테고리와 빈 운동장':c.start==='empty'?'빈 한 장':'기본 자료 포함'));return;}
      toast(n + '장을 채웠어요 — ' + (c.kind === 'opp' ? '상대 분석 · ' : '') + (c.us === d.us && c.op === d.op ? (fmt === '8' ? '8 대 8 기본 포메이션' : '기본 포메이션') : '우리 ' + label(c.us) + ' · 상대 ' + label(c.op)) + ' · ' + lookText(normLook(c.look)));
    }
    // 새 미팅의 토큰 — 지금 판보다 «＋» 한 칸 크게(사용자 «미팅 자료 토큰은 지금보다 1단계 크게»). tokV:2 = 2.977 뒤의 크기(옛 기본으로 줄여 읽지 않는다)
    function curTok() { try { return (typeof state !== 'undefined' && state && +state.tokenScale) || 0; } catch (_) { return 0; } }
    function bigTok(v) { var L = null; try { L = typeof win.tokScaleLevels === 'function' ? win.tokScaleLevels() : null; } catch (_) {} return bumpTok(L, Math.max(+v || 0, floor())); }
    function wrapSeed() {
      var f = win.__meetSeed; if (typeof f !== 'function') return false; if (f.__psForm) return true;
      var g = function (base) {
        if (base && typeof base === 'object') { base.tokenScale = bigTok(base.tokenScale); base.tokV = 2; }   // 10장 모두(8 대 8 로 바꿔도 이 바탕을 쓴다)
        var r = f.apply(this, arguments);
        if (r === true) {
          var a = A(), items = a && Array.isArray(a.slides) ? a.slides.slice() : [];
          tagPending('prep');
          if (items.length) win.setTimeout(function () {
            show({ path: 'vault', fmt: fmtOf(items[0].snap), canFmt: !!win.PSMeet8, canKind: true, kind: 'prep', oh: ohOf(items[0]), done: function (c, fmt) {
              if (!c) return;
              tagPending(c.kind);
              said(c, fmt, applySeeded(items, base, c, fmt));
            } });
          }, 60);
        }
        return r;
      };
      g.__psForm = 1; win.__meetSeed = g; return true;
    }

    // ── 길 2: 경기 «＋ 새 미팅» — 만들기 전에 창. 고른 값으로 기본 10장을 고친다(인원은 경기의 것) ──
    function wrapTpl() {
      var t = win.__meetTplSlides; if (typeof t !== 'function') return false; if (t.__psForm) return true;
      var g = function () {
        var out = t.apply(this, arguments);
        if (!cur || !Array.isArray(out) || !out.length) return out;
        var fmt = fmtOf(out[0] && out[0].snap), list = out.filter(function (s) { return s && s.snap; }).map(function (s) { return { title: s.title, raw: s.snap, snap: (cur.us ? remap(s.snap, s.title, cur) : null) || s.snap }; });
        if (cur.kind === 'opp') list = oppSlides(list, cur, fmt, geo(), forms()).map(function (e) {   // 상대 분석 6장 — 그 경기 상대 분석의 국면 메모를 그 장에
          var nt = cur.notes && cur.notes[e.note];
          return { title: e.title, snap: e.snap, points: (Array.isArray(nt) ? nt : []).map(function (x) { return String(x == null ? '' : x).trim().slice(0, 160); }).filter(Boolean).slice(0, 10) };
        });
        list.forEach(function (s) { if (cur.look) Object.assign(s.snap, lookSnap(cur.look)); });   // 기본 10장은 meetTplSnap 이 네이비 · 15존을 박는다 — 고른 운동장으로
        return list.map(function (s) { return { title: s.title, snap: s.snap, points: s.points || [] }; });
      };
      g.__psForm = 1; g.__psFormRaw = t; win.__meetTplSlides = g; return true;
    }
    function wrapMatch() {
      var f = win.__meetingFromMatch; if (typeof f !== 'function') return false; if (f.__psForm) return true;
      var g = function (p) {
        var self = this, args = arguments;
        var unlocked = true; try { if (typeof win.psVaultUnlocked === 'function') unlocked = !!win.psVaultUnlocked(); } catch (_) {}
        var only = !p || !p.template || !forms();   // 기본 10장 없이(경기 장면만) — 운동장만 고른다
        if (!p || !unlocked || (only && !(Array.isArray(p.slides) && p.slides.length))) return f.apply(self, args);
        var fmt = String(p.fmt || '') === '8' ? '8' : '11', oh = 'v';
        try { oh = typeof win.__meetDefaultOrient === 'function' && win.__meetDefaultOrient() === 'landscape' ? 'h' : 'v'; } catch (_) {}
        return new Promise(function (resolve) {
          var kind = p.part === 'opp' ? 'opp' : 'prep';   // 3.133 — 상대 분석 칸의 «＋ 새 상대 분석»
          show({ path: 'match', fmt: fmt, canFmt: false, oh: oh, lookOnly: only, kind: kind, done: function (c) {
            if (!c) {   // 만들지 않는다 — 경기 준비 안에서 열었으면 그 자리로
              if (p.inplace) { try { win.parent.postMessage({ source: 'board', type: 'matchEditDone', libId: '', mid: (p.ref && p.ref.mid) || '', fail: true }, '*'); } catch (_) {} }
              resolve(false); return;
            }
            var r, lk = normLook(c.look, oh); cur = c; cur.kind = kind;
            cur.notes = p.oppNotes && typeof p.oppNotes === 'object' ? p.oppNotes : null;
            p.tags = [KIND_TAG[kind]];   // 경기 화면이 이 태그로 01 · 02 칸에 붙인다
            // 경기 장면 · 기본 10장의 바탕(board.html meetBaseSnap 뒤 window.__meetLook) — 운동장 · 토큰 한 칸 크게. 방향은 미팅 방향(2.932)이 정한다
            try { if (ls) ls.setItem('ps_meet_orient_v2', lk.oh === 'h' ? 'landscape' : 'portrait'); } catch (_) {}
            win.__meetLook = Object.assign(lookSnap(lk), { tokenScale: bigTok(curTok()), tokV: 2 });
            try { r = f.apply(self, args); } catch (_) { r = false; } finally { cur = null; win.__meetLook = null; }
            Promise.resolve(r).then(resolve, function () { resolve(false); });
          } });
          // 경기 준비 안(inplace)은 «미팅 여는 중…» 가림막이 판을 덮고 있다 — 창이 보이게 걷는다
          if (p.inplace) { try { win.parent.postMessage({ source: 'board', type: 'matchEditReady' }, '*'); } catch (_) {} }
        });
      };
      g.__psForm = 1; win.__meetingFromMatch = g; return true;
    }

    var tries = 0;
    function hook() { var ok = wrapSeed() & wrapTpl() & wrapMatch() & wrapToolbar(); if (!ok && ++tries < 40) win.setTimeout(hook, 250); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', hook); else hook();
    win.__psMeetFormOpen = function () { return open ? { path: open.path, fmt: open.fmt, us: open.us, op: open.op } : null; };   // 시험 · 진단용
    win.__psMeetFormLook = function () { return open && open.look ? { pitch: open.look.pitch, custom: open.look.pitch === 'custom' ? open.look.custom : null, grid: open.look.grid, oh: open.look.oh, lookOnly: !!open.lookOnly } : null; };   // 3.132
    return { show: show, close: close, applySeeded: applySeeded, tpl: tpl };
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) install(window);
  return { KEY: KEY, LIST: LIST, DEF: DEF, PITCH: PITCH, label: label, fmtOf: fmtOf, kindOf: kindOf, norm: norm, baseIdx: baseIdx, remapTeam: remapTeam, remapSnap: remapSnap,
    readMem: readMem, writeMem: writeMem, previewSVG: previewSVG, install: install,
    PITCHES: PITCHES, GRIDS: GRIDS, LOOK_DEF: LOOK_DEF, normLook: normLook, lookSnap: lookSnap, sameLook: sameLook, bumpTok: bumpTok,
    blankSnap:blankSnap,startSlides:startSlides,KINDS: KINDS, KIND_TAG: KIND_TAG, OPP_TPL: OPP_TPL, oppSlides: oppSlides };
});
