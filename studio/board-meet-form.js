/* PROCESS STUDIO — 새 미팅의 포메이션 고르기(3.122). 사용자 «시작할때 모달이 떠서 우리팀 포메이션, 상대 팀 포메이션 적용해서 페이지 마다 제대로 적용시켜줘».
   새 미팅의 기본 9장(board.html MEET_TPL — 우리 4-3-3 · 상대 4-4-2, 8인제는 board-meet-8.js — 2-3-2 · 3-3-1)을 만들 때 창을 띄워
   우리 팀 · 상대 팀 포메이션을 고르게 하고, 9장 모두에 그 포메이션을 넣는다.
   · 장마다 손으로 놓은 기본 배치(하이블록 · 로우블록 · 빌드업 …)를 버리지 않는다: 기본 포메이션의 자리(FORM 의 u 깊이 · v 너비)와 그 장의 자리로
     «이 장에서 이 팀은 얼마나 높고 넓게 섰나»(u → x, v → y 직선)를 재고, 기본 배치가 그 직선에서 벗어난 만큼(풀백이 올라감 · 공 쪽으로 쏠림)을
     가까운 자리끼리 나눠 준다. 고른 포메이션의 선수는 자기 FORM 자리에 그 직선 + 가까운 자리의 벗어남을 받는다.
   · BEST 11 은 선발 명단이라 직선만(운동장 전체에 고르게). 코너킥 두 장은 정해진 자리(니어 포스트 · 대인 · 역습 대기)를 그대로 두고
     번호 · 포지션만 가까운 역할끼리 짝짓는다. 골키퍼 · 공을 가진 선수는 그 자리 그대로.
   · 기본 포메이션을 고르면 그 팀은 예전 판과 똑같다.
   길은 둘: 보관함 «미팅 만들기»(__meetSeed — 9장을 채운 뒤 창을 띄우고 고르면 9장을 다시 그린다 · 8 대 8 도 여기서 고른다),
   경기 «＋ 새 미팅»(__meetingFromMatch — 만들기 전에 창을 띄우고, 고른 값으로 __meetTplSlides 가 낸 9장을 고친다 · 인원은 경기의 것).
   ⚠ board.html 의 FORM · MPP · CX · CY · anim 은 let/const 라 이름으로 읽는다(CLAUDE.md). 감싸기는 DOMContentLoaded 뒤 — board-meet-8.js 보다 바깥. */
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
  function label(k) { return String(k || '').split('').join('-'); }
  function fmtOf(sn) { return sn && sn.pitchSpec === 'u12' ? '8' : '11'; }
  function kindOf(title) { var t = String(title || ''); return /^BEST/i.test(t) ? 'best' : (/코너/.test(t) ? 'corner' : 'play'); }
  function okKey(forms, fmt, k) { return LIST[fmt].indexOf(String(k)) >= 0 && !!(forms && forms[k]) && forms[k].length === forms[DEF[fmt].us].length; }
  function norm(forms, fmt, c) {
    c = c || {}; var d = DEF[fmt];
    return { us: okKey(forms, fmt, c.us) ? String(c.us) : d.us, op: okKey(forms, fmt, c.op) ? String(c.op) : d.op };
  }
  function isGK(e) { return e && (e[3] === 'GK' || +e[0] < 0.1); }
  function bd(a, b) { var du = (a[0] - b[0]) * 2, dv = a[1] - b[1]; return Math.sqrt(du * du + dv * dv); }

  // 기본 9장의 선수(팀 안 순서) → 기본 FORM 의 몇 번째 자리. 포지션 이름으로 짝짓고, 같은 이름(ST 둘)은 판에서 위쪽부터.
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
  // 기본 9장의 한 장(snap) → 고른 포메이션의 판(새 객체). 바꿀 것이 없으면 null.
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
      np.num = String(e[2]); np.pos = e[3] || ''; np.x = rnd(l + q.x * g.mpp); np.y = rnd(t + q.y * g.mpp);
      delete np.name;   // 기본 9장은 이름이 없다 — 자리가 바뀐 선수에 남은 이름이 따라가지 않게
      return np;
    });
    return sn;
  }

  // 고른 값 기억(이 기기) — {fmt, '11': {us, op}, '8': {us, op}}
  function readMem(ls) { try { var v = JSON.parse(ls.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
  function writeMem(ls, fmt, c) { try { var m = readMem(ls); m.fmt = fmt; m[fmt] = { us: c.us, op: c.op }; ls.setItem(KEY, JSON.stringify(m)); } catch (_) {} }

  // 미리보기 그림(SVG 글) — 흰 운동장 · 팀 색 토큰 · 번호. 값은 숫자와 정해진 글(번호 · 색)만 넣는다
  function hex(c, d) { c = String(c || ''); return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) ? c : d; }
  function light(c) { c = hex(c, '#000000'); if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; var n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.72; }
  function previewSVG(snap, geo, col) {
    var fmt = fmtOf(snap), P = PITCH[fmt], g = geo || { mpp: 10, cx: 555, cy: 370 }, l = g.cx - P.len * g.mpp / 2, t = g.cy - P.wid * g.mpp / 2;
    var pa = fmt === '8' ? [12.5, 24] : [16.5, 40.3], ga = fmt === '8' ? [4.5, 12] : [5.5, 18.3], cc = fmt === '8' ? 7 : 9.15, L = P.len, W = P.wid;
    var ln = 'fill="none" stroke="#c9ced6" stroke-width="0.35"', o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 ' + (L + 6) + ' ' + (W + 6) + '" aria-hidden="true">');
    o.push('<rect x="-3" y="-3" width="' + (L + 6) + '" height="' + (W + 6) + '" rx="2" fill="#fff"/>');
    o.push('<rect x="0" y="0" width="' + L + '" height="' + W + '" ' + ln + '/><line x1="' + L / 2 + '" y1="0" x2="' + L / 2 + '" y2="' + W + '" ' + ln + '/><circle cx="' + L / 2 + '" cy="' + W / 2 + '" r="' + cc + '" ' + ln + '/>');
    [0, 1].forEach(function (s) {
      [pa, ga].forEach(function (a) { o.push('<rect x="' + (s ? L - a[0] : 0) + '" y="' + (W - a[1]) / 2 + '" width="' + a[0] + '" height="' + a[1] + '" ' + ln + '/>'); });
    });
    var r = fmt === '8' ? 1.9 : 2.3;
    (snap.players || []).forEach(function (p) {
      if (!p || p.coach) return; var x = (+p.x - l) / g.mpp, y = (+p.y - t) / g.mpp; if (!isFinite(x) || !isFinite(y)) return;
      var f = p.team === 'red' ? hex(col && col.red, '#d71920') : hex(col && col.blue, '#1e5bc6'), lt = light(f);
      o.push('<circle cx="' + rnd(x) + '" cy="' + rnd(y) + '" r="' + r + '" fill="' + f + '" stroke="' + (lt ? '#5e6675' : '#fff') + '" stroke-width="0.35"/>');
      o.push('<text x="' + rnd(x) + '" y="' + rnd(y + r * 0.42) + '" text-anchor="middle" font-size="' + rnd(r * 1.15) + '" font-weight="800" font-family="Pretendard,-apple-system,sans-serif" fill="' + (lt ? '#14161A' : '#fff') + '">' + String(+p.num || '').slice(0, 2) + '</text>');
    });
    if (snap.ball && isFinite(+snap.ball.x)) { var bx = (+snap.ball.x - l) / g.mpp, by = (+snap.ball.y - t) / g.mpp; o.push('<circle cx="' + rnd(bx) + '" cy="' + rnd(by) + '" r="' + (r * 0.5) + '" fill="#fff" stroke="#14161A" stroke-width="0.35"/>'); }
    o.push('</svg>');
    return o.join('');
  }

  var CSS = [
    '#psMeetForm{position:fixed;inset:0;z-index:10070;display:none;align-items:center;justify-content:center;background:rgba(10,14,24,.42);padding:8px;box-sizing:border-box}',
    '#psMeetForm.on{display:flex}',
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
    '#psMeetForm .mf-h{display:flex;align-items:center;gap:6px;margin:10px 0 6px;font-weight:800;font-size:12.5px}',
    '#psMeetForm .mf-h i{width:12px;height:12px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}',
    '#psMeetForm .mf-chips{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}',
    '#psMeetForm .mf-chips button{height:32px;padding:0 2px;border-radius:9px;border:1px solid rgba(127,127,127,.28);background:transparent;color:inherit;font-family:inherit;font-weight:700;font-size:12.5px;cursor:pointer;font-variant-numeric:tabular-nums;white-space:nowrap;transition:none}',
    '#psMeetForm .mf-chips button.on{background:#14213D;border-color:#14213D;color:#fff}',
    'body.fmdark #psMeetForm .mf-chips button.on{background:#5b8cff;border-color:#5b8cff}',
    '#psMeetForm .mf-chips button.def:after{content:"기본";display:block;font-size:8.5px;font-weight:600;opacity:.6;margin-top:-1px}',
    '#psMeetForm .mf-chips button.def{line-height:1.05}',
    '#psMeetForm .mf-pv{margin-top:12px;border-radius:12px;background:rgba(127,127,127,.08);padding:8px}',
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
    var doc = win.document, cur = null, open = null;
    /* global FORM, MPP, CX, CY, anim, undoStack, redoStack, state */
    function forms() { try { return typeof FORM !== 'undefined' ? FORM : null; } catch (_) { return null; } }
    function geo() { try { return { mpp: MPP, cx: CX, cy: CY }; } catch (_) { return { mpp: 10, cx: 555, cy: 370 }; } }
    function A() { try { return typeof anim !== 'undefined' ? anim : null; } catch (_) { return null; } }
    function kit() { try { var c = (typeof state !== 'undefined' && state && state.teamColors) || {}; return { blue: c.blue, red: c.red }; } catch (_) { return {}; } }
    function toast(m) { try { if (typeof win.toast === 'function') win.toast(m); } catch (_) {} }
    function floor() { try { return Math.min(0.4, win.defaultTokenScale()); } catch (_) { return 0.4; } }
    var ls = (function () { try { return win.localStorage; } catch (_) { return null; } })();
    var tplCache = {};
    // 기본 9장(고치기 전) — 미리보기와 8 대 8 바꾸기에 쓴다. 판을 건드리지 않는 함수만 부른다
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

    var st = doc.createElement('style'); st.id = 'ps-meet-form-css'; st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);

    // ── 창 ──
    function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    function close() { var o = doc.getElementById('psMeetForm'); if (o) o.classList.remove('on'); open = null; doc.removeEventListener('keydown', onKey, true); }
    function onKey(e) {
      if (!open) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      else if (e.key === 'Enter' && !(e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName))) { e.preventDefault(); e.stopPropagation(); finish(true); }   // 단추 위의 Enter 는 그 단추
    }
    function finish(go) {
      var o = open; if (!o) return; close();
      var c = go ? { us: o.us, op: o.op } : null;
      if (c) writeMem(ls, o.fmt, c);
      try { o.done(c, o.fmt); } catch (_) {}
    }
    // o = {path:'vault'|'match', fmt, canFmt, done(choice|null, fmt)}
    function show(o) {
      if (!forms()) { try { o.done(null, o.fmt); } catch (_) {} return false; }
      if (open) finish(false);
      var mem = readMem(ls);
      if (o.canFmt && (mem.fmt === '8' || mem.fmt === '11')) o.fmt = mem.fmt;
      o.fmt = o.fmt === '8' ? '8' : '11';
      function pick(fmt) { var c = norm(forms(), fmt, mem[fmt]); o.us = c.us; o.op = c.op; o.pv = 2; }
      pick(o.fmt); open = o;
      var ov = doc.getElementById('psMeetForm');
      if (!ov) { ov = el('div'); ov.id = 'psMeetForm'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '포메이션 고르기'); doc.body.appendChild(ov); }
      ov.textContent = '';
      var box = el('div', 'mf-box'); ov.appendChild(box);
      var hd = el('div', 'mf-hd'); hd.appendChild(el('b', '', '포메이션 고르기'));
      var x = el('button', 'mf-x', '×'); x.type = 'button'; x.setAttribute('aria-label', o.path === 'match' ? '만들지 않고 닫기' : '기본 그대로 두고 닫기'); hd.appendChild(x); box.appendChild(hd);
      box.appendChild(el('div', 'mf-sub', '우리 팀 · 상대 팀 포메이션으로 9장을 채워요. 장마다(블록 · 빌드업 · 코너킥) 자리를 맞춰 놓아요.'));
      var seg = null;
      if (o.canFmt) {
        seg = el('div', 'mf-fmt');
        [['11', '11 대 11'], ['8', '8 대 8']].forEach(function (f) { var b = el('button', '', f[1]); b.type = 'button'; b.setAttribute('data-fmt', f[0]); seg.appendChild(b); });
        box.appendChild(seg);
      }
      var col = kit(), rows = {};
      [['us', '우리 팀', hex(col.blue, '#1e5bc6')], ['op', '상대 팀', hex(col.red, '#d71920')]].forEach(function (r) {
        var h = el('div', 'mf-h'); var i = el('i'); i.style.background = r[2]; h.appendChild(i); h.appendChild(doc.createTextNode(r[1])); box.appendChild(h);
        var ch = el('div', 'mf-chips'); ch.setAttribute('data-team', r[0]); box.appendChild(ch); rows[r[0]] = ch;
      });
      var pv = el('div', 'mf-pv'), pic = el('div', 'mf-pic'), nav = el('div', 'mf-pvn');
      var prev = el('button', '', '‹'), next = el('button', '', '›'), cap = el('span');
      prev.type = next.type = 'button'; prev.setAttribute('aria-label', '앞 장'); next.setAttribute('aria-label', '다음 장');
      nav.appendChild(prev); nav.appendChild(cap); nav.appendChild(next); pv.appendChild(pic); pv.appendChild(nav); box.appendChild(pv);
      var ft = el('div', 'mf-ft'), skip = el('button', 'mf-skip', '기본 그대로'), go = el('button', 'mf-go', o.path === 'match' ? '이대로 만들기' : '이대로 채우기');
      skip.type = go.type = 'button'; ft.appendChild(skip); ft.appendChild(go); box.appendChild(ft);
      function paint() {
        if (seg) [].forEach.call(seg.children, function (b) { b.classList.toggle('on', b.getAttribute('data-fmt') === o.fmt); });
        ['us', 'op'].forEach(function (tk) {
          var ch = rows[tk], want = o[tk], d = DEF[o.fmt][tk];
          if (ch.getAttribute('data-fmt') !== o.fmt) {
            ch.textContent = ''; ch.setAttribute('data-fmt', o.fmt);
            LIST[o.fmt].forEach(function (k) { var b = el('button', k === d ? 'def' : '', label(k)); b.type = 'button'; b.setAttribute('data-k', k); ch.appendChild(b); });
          }
          [].forEach.call(ch.children, function (b) { var on = b.getAttribute('data-k') === want; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        });
        var list = tpl(o.fmt), n = list.length; if (!n) { pv.hidden = true; return; }
        o.pv = (o.pv + n) % n; var s = list[o.pv], sn = remap(s.snap, s.title, o) || s.snap;
        pic.innerHTML = previewSVG(sn, geo(), col);
        cap.textContent = s.title + '  ' + (o.pv + 1) + ' / ' + n;
      }
      ov.onclick = function (e) {
        var t = e.target, b = t.closest ? t.closest('button') : null;
        if (t === ov) return;   // 바깥 누름은 아무것도 하지 않는다(실수로 닫히지 않게)
        if (!b) return;
        if (b === x || b === skip) { finish(false); return; }
        if (b === go) { finish(true); return; }
        if (b === prev) { o.pv--; paint(); return; }
        if (b === next) { o.pv++; paint(); return; }
        if (b.hasAttribute('data-fmt')) { var f = b.getAttribute('data-fmt'); if (f !== o.fmt) { o.fmt = f; pick(f); paint(); } return; }
        var ch = b.parentNode, tk = ch && ch.getAttribute('data-team');
        if (tk) { o[tk] = b.getAttribute('data-k'); paint(); }
      };
      paint(); ov.classList.add('on');
      // 막 뜬 알림(보관함의 옛 «빈 미팅 노트 — 슬라이드를 추가하세요» 등)은 창을 가리므로 걷는다
      try { var tt = doc.getElementById('cs-ftoast'); if (tt && tt.style.opacity !== '0') { clearTimeout(tt._ft); tt.style.opacity = '0'; tt.style.pointerEvents = 'none'; tt.setAttribute('aria-hidden', 'true'); } } catch (_) {}
      doc.addEventListener('keydown', onKey, true);
      try { go.focus({ preventScroll: true }); } catch (_) {}
      return true;
    }

    // ── 길 1: 보관함 «미팅 만들기» — 기본 9장을 채운 뒤 창. 고르면 9장을 다시 그린다 ──
    function applySeeded(items, base, c, fmt) {
      var a = A(); if (!a || !Array.isArray(a.slides) || !doc.body.classList.contains('meet-mode')) return 0;
      var live = items.filter(function (it) { return a.slides.indexOf(it) >= 0; });
      if (live.length !== items.length) return 0;   // 그새 슬라이드를 고쳤다 — 건드리지 않는다
      var was = fmtOf(items[0] && items[0].snap), src;
      if (fmt !== was) {
        src = tpl(fmt, JSON.parse(JSON.stringify(base || {})), items[0].snap && items[0].snap.orientation);   // 판 방향 = 미팅 방향(그림도 그 방향으로)
        if (src.length !== items.length) return 0;
      } else src = items.map(function (it) { return { title: it.title, snap: it.snap }; });
      var n = 0;
      src.forEach(function (s, i) {
        var sn = remap(s.snap, s.title, c) || (fmt !== was ? s.snap : null); if (!sn) return;
        try { win.loadSnap(sn); } catch (_) { return; }
        var it = items[i], th = ''; try { th = win.boardThumbSVG(); } catch (_) {}
        try { it.snap = win.__meetCap ? win.__meetCap() : sn; } catch (_) { it.snap = sn; }
        it.thumb = th; if (fmt !== was) it.title = s.title; n++;
      });
      var k = -1; try { k = win.__meet.idx(); } catch (_) {}
      try { win.loadSnap(a.slides[k >= 0 ? k : 0].snap); } catch (_) {}
      try { if (typeof undoStack !== 'undefined') undoStack.length = 0; if (typeof redoStack !== 'undefined') redoStack.length = 0; } catch (_) {}
      try { if (win.__ksRender) win.__ksRender(); } catch (_) {}
      return n;
    }
    function said(c, fmt, n) { var d = DEF[fmt]; if (!n) return; toast(n + '장을 채웠어요 — ' + (c.us === d.us && c.op === d.op ? (fmt === '8' ? '8 대 8 기본 포메이션' : '기본 포메이션') : '우리 ' + label(c.us) + ' · 상대 ' + label(c.op))); }
    function wrapSeed() {
      var f = win.__meetSeed; if (typeof f !== 'function') return false; if (f.__psForm) return true;
      var g = function (base) {
        var r = f.apply(this, arguments);
        if (r === true) {
          var a = A(), items = a && Array.isArray(a.slides) ? a.slides.slice() : [];
          if (items.length) win.setTimeout(function () {
            show({ path: 'vault', fmt: fmtOf(items[0].snap), canFmt: !!win.PSMeet8, done: function (c, fmt) {
              if (!c) return;
              var d = DEF[fmt], was = fmtOf(items[0].snap);
              if (fmt === was && c.us === d.us && c.op === d.op) return;
              said(c, fmt, applySeeded(items, base, c, fmt));
            } });
          }, 60);
        }
        return r;
      };
      g.__psForm = 1; win.__meetSeed = g; return true;
    }

    // ── 길 2: 경기 «＋ 새 미팅» — 만들기 전에 창. 고른 값으로 기본 9장을 고친다(인원은 경기의 것) ──
    function wrapTpl() {
      var t = win.__meetTplSlides; if (typeof t !== 'function') return false; if (t.__psForm) return true;
      var g = function () {
        var out = t.apply(this, arguments);
        if (cur && Array.isArray(out)) out.forEach(function (s) { var sn = s && remap(s.snap, s.title, cur); if (sn) s.snap = sn; });
        return out;
      };
      g.__psForm = 1; g.__psFormRaw = t; win.__meetTplSlides = g; return true;
    }
    function wrapMatch() {
      var f = win.__meetingFromMatch; if (typeof f !== 'function') return false; if (f.__psForm) return true;
      var g = function (p) {
        var self = this, args = arguments;
        var unlocked = true; try { if (typeof win.psVaultUnlocked === 'function') unlocked = !!win.psVaultUnlocked(); } catch (_) {}
        if (!p || !p.template || !unlocked || !forms()) return f.apply(self, args);
        var fmt = String(p.fmt || '') === '8' ? '8' : '11';
        return new Promise(function (resolve) {
          show({ path: 'match', fmt: fmt, canFmt: false, done: function (c) {
            if (!c) {   // 만들지 않는다 — 경기 준비 안에서 열었으면 그 자리로
              if (p.inplace) { try { win.parent.postMessage({ source: 'board', type: 'matchEditDone', libId: '', mid: (p.ref && p.ref.mid) || '', fail: true }, '*'); } catch (_) {} }
              resolve(false); return;
            }
            var r; cur = c;
            try { r = f.apply(self, args); } catch (_) { r = false; } finally { cur = null; }
            Promise.resolve(r).then(resolve, function () { resolve(false); });
          } });
          // 경기 준비 안(inplace)은 «미팅 여는 중…» 가림막이 판을 덮고 있다 — 창이 보이게 걷는다
          if (p.inplace) { try { win.parent.postMessage({ source: 'board', type: 'matchEditReady' }, '*'); } catch (_) {} }
        });
      };
      g.__psForm = 1; win.__meetingFromMatch = g; return true;
    }

    var tries = 0;
    function hook() { var ok = wrapSeed() & wrapTpl() & wrapMatch(); if (!ok && ++tries < 40) win.setTimeout(hook, 250); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', hook); else hook();
    win.__psMeetFormOpen = function () { return open ? { path: open.path, fmt: open.fmt, us: open.us, op: open.op } : null; };   // 시험 · 진단용
    return { show: show, close: close, applySeeded: applySeeded, tpl: tpl };
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) install(window);
  return { KEY: KEY, LIST: LIST, DEF: DEF, PITCH: PITCH, label: label, fmtOf: fmtOf, kindOf: kindOf, norm: norm, baseIdx: baseIdx, remapTeam: remapTeam, remapSnap: remapSnap,
    readMem: readMem, writeMem: writeMem, previewSVG: previewSVG, install: install };
});
