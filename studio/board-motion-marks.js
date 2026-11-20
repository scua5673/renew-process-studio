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
  if (root.document) root.document.addEventListener('DOMContentLoaded', function () { try { api.install(root); } catch (_) {} try { api.installTab(root); } catch (e) { root.console && root.console.warn('motion tab', e); } });
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', MAX_PTS = 36;
  function fin(p) { return !!p && Number.isFinite(p.x) && Number.isFinite(p.y); }
  function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }

  /* ── ① 가늘어지는 꼬리(순수) ─────────────────────────────────────────────
     points: 지나온 자리(오래된 것 → 지금), head: 지금 자리에서의 반 폭. 폭은 지나온 길이에 비례(0 → head).
     점이 많으면 길이로 고르게 줄여(최대 36) 한 프레임의 그림 값을 묶는다. 길이가 0.5 단위 미만이면 '' */
  function taper(points, head) {
    var src = (points || []).filter(fin), i, pts = [];
    for (i = 0; i < src.length; i++) if (!pts.length || Math.hypot(src[i].x - pts[pts.length - 1].x, src[i].y - pts[pts.length - 1].y) > 0.05) pts.push({x: src[i].x, y: src[i].y});
    head = +head;
    if (pts.length < 2 || !(head > 0)) return '';
    var acc = [0];
    for (i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    var total = acc[acc.length - 1];
    if (!(total >= 0.5)) return '';   // 지나온 점은 1.5 단위마다 찍힌다 — 둘째 점이 생기면 바로 꼬리(예전 2 단위 기준은 1.5~2 사이의 몇 프레임을 비웠다)
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
        try { win.toast('방향 표식 — 한 번 더 누르면 시야 부채꼴 · 노란 손잡이로 돌립니다'); } catch (_) {}
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

  /* ── ③ 보드 설정 › «움직임» 탭(3.347, 사용자 11/21 FmStadio 1.8 영상 «잔상 · 시선을 보드 설정에서 쉽게» → 목업 B안) ─────────────
     묶음(공 · 판 위의 팀)마다 잔상 길이(끔 · 1~5)와 시선(끔 · 공 보기)을 한 번에 적는다. 값은 지금처럼 토큰에(trail · lookAt · dirMark) —
     보드 설정은 여러 토큰에 같은 값을 적는 손잡이일 뿐이라 새 저장 칸이 없고 옛 보드 · 내보내기 · 미팅이 그대로 돈다.
     «공 보기»는 방향 표식(작은 삼각형)으로 보인다 — 부채꼴(vis)은 켜지 않는다. 토큰 하나만 다르게는 원래의 «잔상» · «시선» 단추. */
  function fieldOf(st, has) {
    var out = [], by = {}, ps = (st && st.players) || [];
    if (st && st.ball) out.push({key: 'ball', toks: [st.ball]});
    ps.forEach(function (p) {
      if (!p || p.coach || typeof p.team !== 'string' || (has && !has(p.team))) return;
      if (!by[p.team]) { by[p.team] = {key: p.team, toks: []}; out.push(by[p.team]); }
      by[p.team].toks.push(p);
    });
    return out;
  }
  // 묶음의 지금 값 — 다 같으면 그 값, 섞였으면 -1 / 'mix'
  function trailOf(toks) { var v = null; for (var i = 0; i < (toks || []).length; i++) { var n = +(toks[i].trail || 0); n = n > 0 ? Math.min(5, Math.round(n)) : 0; if (v === null) v = n; else if (v !== n) return -1; } return v === null ? 0 : v; }
  function lookOf(toks) { var on = 0, off = 0; (toks || []).forEach(function (p) { if (p.lookAt === 'ball') on++; else if (!p.lookAt) off++; else { on++; off++; } }); return on && off ? 'mix' : on ? 'ball' : 'off'; }
  function setTrail(toks, n) { n = Math.max(0, Math.min(5, Math.round(+n || 0))); var ch = []; (toks || []).forEach(function (p) { if (+(p.trail || 0) === n) return; if (n) p.trail = n; else delete p.trail; ch.push(p); }); return ch; }
  // 공 보기: lookAt 'ball' + 방향 표식. 끄면 이 길로 켠 표식도 같이 걷는다(부채꼴 vis 는 손대지 않는다)
  function setLook(toks, on) {
    var ch = [];
    (toks || []).forEach(function (p) {
      if (on) { if (p.lookAt === 'ball' && (p.dirMark || p.vis)) return; p.lookAt = 'ball'; if (!p.vis) p.dirMark = true; }
      else { if (!p.lookAt) return; delete p.lookAt; delete p.dirMark; if (!p.dirFix) p.dirBall = 1; }
      ch.push(p);
    });
    return ch;
  }

  function installTab(win) {
    if (!win || win.__psMotionTab) return false;
    var doc = win.document, tries = 0, tab = null, sig = '';
    win.__psMotionTab = 1;
    function S() { return typeof state !== 'undefined' ? state : null; }
    function groups() { var T = win.PSTeams; return fieldOf(S(), T && T.has).map(function (g) { g.label = g.key === 'ball' ? '공' : ((T && T.name(g.key)) || g.key); return g; }); }
    function panel() { return doc.getElementById('cmd-board-settings-pop'); }
    function shown() { var p = panel(); return !!p && p.getAttribute('data-bs-tab') === 'motion'; }
    function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; e.setAttribute('data-bs-tab', 'motion'); return e; }
    function seg(kind, key, label, items) {
      var row = el('div', 'menurow ps-mt-row'), l = doc.createElement('span'), s = doc.createElement('div');
      l.className = 'menulbl'; l.textContent = label; s.className = 'seg ' + (kind === 'trail' ? 'ps-mt-six' : 'ps-mt-two'); s.setAttribute('role', 'group');
      s.setAttribute('aria-label', label + (kind === 'trail' ? ' 잔상' : ' 시선')); s.setAttribute('data-mt', kind); s.setAttribute('data-mt-key', key);
      items.forEach(function (it) { var b = doc.createElement('button'); b.type = 'button'; b.setAttribute('data-v', it[0]); b.textContent = it[1]; b.setAttribute('aria-pressed', 'false'); s.appendChild(b); });
      row.appendChild(l); row.appendChild(s); return row;
    }
    function build(gs) {
      var menu = doc.getElementById('viewMenu'); if (!menu) return;
      [].slice.call(menu.querySelectorAll(':scope > [data-bs-tab="motion"]')).forEach(function (n) { n.remove(); });
      var f = doc.createDocumentFragment(), teams = gs.filter(function (g) { return g.key !== 'ball'; }), h;
      if (!gs.length) f.appendChild(el('div', 'bs-hint ps-mt-empty', '선수나 공을 놓으면 여기서 잔상 · 시선을 켤 수 있어요'));
      else {
        h = el('div', 'bs-sec bs-first', '잔상 · 지난 장면 수'); h.setAttribute('role', 'heading'); h.setAttribute('aria-level', '3'); f.appendChild(h);
        gs.forEach(function (g) { f.appendChild(seg('trail', g.key, g.label, [['0', '끔'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']])); });
        if (teams.length) {
          h = el('div', 'bs-sec', '시선'); h.setAttribute('role', 'heading'); h.setAttribute('aria-level', '3'); f.appendChild(h);
          teams.forEach(function (g) { f.appendChild(seg('look', g.key, g.label, [['off', '끔'], ['ball', '공 보기']])); });
        }
        f.appendChild(el('div', 'bs-hint', '토큰 하나만 다르게는 «잔상» «시선» 단추'));
      }
      menu.appendChild(f);
    }
    function sync() {
      if (!shown()) return;
      var gs = groups(), now = gs.map(function (g) { return g.key; }).join('|') || '-';
      if (now !== sig) { build(gs); sig = now; }
      gs.forEach(function (g) {
        [['trail', String(trailOf(g.toks))], ['look', lookOf(g.toks)]].forEach(function (kv) {
          var s = doc.querySelector('#viewMenu .seg[data-mt="' + kv[0] + '"][data-mt-key="' + g.key + '"]'); if (!s) return;
          [].forEach.call(s.children, function (b) { var on = b.getAttribute('data-v') === kv[1]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        });
      });
    }
    function call(name) { var f = win[name]; return typeof f === 'function' ? f.apply(win, [].slice.call(arguments, 1)) : undefined; }
    function say(t) { call('toast', t); }
    function click(e) {
      var b = e.target.closest && e.target.closest('#viewMenu .seg[data-mt] > button'); if (!b) return;
      e.stopPropagation();
      var s = b.parentNode, kind = s.getAttribute('data-mt'), key = s.getAttribute('data-mt-key'), v = b.getAttribute('data-v');
      var g = groups().filter(function (x) { return x.key === key; })[0]; if (!g) { sig = ''; sync(); return; }
      var same = kind === 'trail' ? String(trailOf(g.toks)) === v : lookOf(g.toks) === v; if (same) return;
      call('pushUndo');
      var ch, n;
      if (kind === 'trail') { n = +v; ch = setTrail(g.toks, n); call('_tokPropAll', ch, ['trail']); say(n ? '잔상 ' + n + '단계 · ' + g.label : '잔상 끔 · ' + g.label); }
      else { ch = setLook(g.toks, v === 'ball'); if (v === 'ball') ch.forEach(function (p) { call('_ensureDir', p); }); call('_tokPropAll', ch, ['lookAt', 'dirMark', 'dirBall']); say(v === 'ball' ? '공 보기 · ' + g.label + ' · 공이 움직여도 따라 봐요' : '시선 끔 · ' + g.label); }
      call('renderTokens'); call('updateDelUI'); call('boardSaveLive');
      sync();
    }
    function pick() {
      var p = panel(); if (!p || typeof p.__psSelectTab !== 'function') return;
      p.__psSelectTab('look');   // 창의 칸 배치(보이는 칸 · 자리 잡기)는 본문에 맡기고 표식만 바꾼다
      p.setAttribute('data-bs-tab', 'motion');
      var chip = p.querySelector('.cmd-board-settings-scope'); if (chip) { chip.textContent = '바로 적용'; chip.title = '누르면 이 보드의 토큰에 바로 들어가요'; }
      mark(); sync();
    }
    function mark() {
      var p = panel(); if (!p || !tab) return; var on = p.getAttribute('data-bs-tab') === 'motion';
      tab.classList.toggle('on', on); tab.setAttribute('aria-selected', on ? 'true' : 'false'); tab.tabIndex = on ? 0 : -1;
      if (on) [].forEach.call(p.querySelectorAll('.cmd-board-settings-tabs > button'), function (b) { if (b !== tab) { b.classList.remove('on'); b.setAttribute('aria-selected', 'false'); b.tabIndex = -1; } });
    }
    function mount() {
      var p = panel(), tabs = p && p.querySelector('.cmd-board-settings-tabs'), menu = doc.getElementById('viewMenu');
      if (!p || !tabs || !menu || typeof p.__psSelectTab !== 'function') { if (++tries < 80) win.setTimeout(mount, 250); return; }
      if (doc.getElementById('cmd-board-settings-motion-tab')) return;
      tab = doc.createElement('button'); tab.type = 'button'; tab.id = 'cmd-board-settings-motion-tab'; tab.textContent = '움직임'; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', 'false'); tab.tabIndex = -1;
      tab.title = '재생할 때의 잔상 · 시선을 묶음마다 한 번에';
      tabs.insertBefore(tab, tabs.querySelector('.bs-tab-me'));
      tab.addEventListener('click', pick);
      doc.addEventListener('click', click, true);
      new win.MutationObserver(function () { mark(); sync(); }).observe(p, {attributes: true, attributeFilter: ['data-bs-tab', 'class', 'aria-hidden']});
      var ui = win.updateDelUI; if (typeof ui === 'function') win.updateDelUI = function () { var r = ui.apply(this, arguments); if (shown()) { try { sync(); } catch (e) { win.console && win.console.warn('motion tab', e); } } return r; };
      var P = 'html body #cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop', st = doc.createElement('style'); st.id = 'ps-motion-tab-css';
      st.textContent = [
        P + ':not([data-bs-tab="motion"]) #viewMenu > [data-bs-tab="motion"]{display:none!important}',
        P + ' .cmd-board-settings-tabs>button{flex:1 1 auto!important;white-space:nowrap!important;padding:0 6px!important;letter-spacing:-.02em!important}',   // 탭 다섯 — «선수 표시»가 두 줄로 꺾이지 않게 폭을 글자만큼
        P + ' .seg.ps-mt-six{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important}',
        P + ' .seg.ps-mt-two{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}',
        P + ' .seg.ps-mt-six>button,' + P + ' .seg.ps-mt-two>button{min-width:0!important;min-height:36px!important;padding:0 2px!important;font-variant-numeric:tabular-nums}'
      ].join('\n');
      doc.head.appendChild(st);
    }
    mount();
    return true;
  }

  return {taper: taper, head: head, markGeom: markGeom, markPath: markPath, marked: marked, step: step, flagCarry: flagCarry, install: install, MAX_PTS: MAX_PTS,
    fieldOf: fieldOf, trailOf: trailOf, lookOf: lookOf, setTrail: setTrail, setLook: setLook, installTab: installTab};
});
