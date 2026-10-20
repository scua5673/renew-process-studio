/* PROCESS STUDIO — 팀 유니폼 꾸미기(3.083).
   사용자 «유니폼도 상의 하의 스타킹까지» · «유니폼 설정을 더 쉽게 찾고 눌러서 만들 수 있게».
   · 찾기: 하단 도크 «선수» 칸 팀 칩의 ✎ · 그 칸 머리의 «유니폼 꾸미기» · 위쪽 «보드 ▾» 메뉴 «팀 유니폼» · 오른쪽 선수 패널 «팀 유니폼 바꾸기»,
     예전 문(팀 칩 한 번 더 누르기)도 이 창을 연다.
   · 만들기: 큰 유니폼 그림에서 상의 · 하의 · 스타킹 · 번호를 눌러 고르고, 색 견본을 누른다. 상의는 무늬, 빠른 조합은 한 번에.
   값: 상의 · 무늬 · 번호는 예전 그대로(teamColors · teamColor2 · teamPattern · teamTxtC · teamStrokeC · gk*),
       하의 · 스타킹은 state.teamKit = { 팀: {shorts, socks}, 'gk:팀': {…} } — 보드마다, 모든 장면에 같이(KIT_KEYS).
   3.121 — «토큰 미리보기»(사용자 «토큰 유니폼 설정할 때 미리보기 가능하게»): 판에서 보일 원형 · 유니폼 토큰(board-jersey.js 그림)을 창 안에 — 바꿀 때마다 다시 그린다.
   3D «사람» 선수가 window.__kitOf(p) 로 하의 · 스타킹을 칠한다. 비우면 자동(하의 = 상의를 어둡게 · 스타킹 = 상의). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSKit = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var PARTS = ['shorts', 'socks'];
  var TEAMS = [['blue', '팀 1'], ['red', '팀 2'], ['yellow', '팀 3'], ['green', '팀 4']];
  var TEAM_DEF = { blue: '#1a2f5c', red: '#d12f38', yellow: '#eeff00', green: '#34a56f' };
  var SWATCH = [['#d71920', '빨강'], ['#8b0d1f', '와인'], ['#f26b1d', '주황'], ['#ffd400', '노랑'], ['#1f8f4e', '초록'], ['#0b5d3b', '진초록'], ['#6cc4ee', '하늘'], ['#1e5bc6', '파랑'],
    ['#14213d', '네이비'], ['#6a2c91', '보라'], ['#e85a9b', '분홍'], ['#ffffff', '흰색'], ['#c9ced6', '회색'], ['#1a1a1a', '검정'], ['#c8a24a', '금색'], ['#7a4a2a', '갈색']];
  var PATS = [['solid', '단색'], ['v', '세로 줄무늬'], ['thinv', '가는 세로 줄무늬'], ['h', '가로 줄무늬'], ['half', '반반'], ['quarters', '쿼터'], ['band', '세로 띠'], ['hoop', '가로 띠'], ['sash', '사선 띠'], ['diag', '사선 줄무늬']];
  // 빠른 조합: [상의, 보조색, 무늬, 하의, 스타킹, 이름]
  var COMBOS = [
    ['#d71920', '#ffffff', 'solid', '#ffffff', '#d71920', '빨강 · 흰 · 빨강'],
    ['#ffffff', '#1a1a1a', 'solid', '#1a1a1a', '#ffffff', '흰 · 검정 · 흰'],
    ['#1e5bc6', '#ffffff', 'solid', '#ffffff', '#1e5bc6', '파랑 · 흰 · 파랑'],
    ['#ffd400', '#1e5bc6', 'solid', '#1e5bc6', '#ffd400', '노랑 · 파랑 · 노랑'],
    ['#6cc4ee', '#ffffff', 'solid', '#14213d', '#6cc4ee', '하늘 · 네이비 · 하늘'],
    ['#1a1a1a', '#1a1a1a', 'solid', '#1a1a1a', '#1a1a1a', '올 검정'],
    ['#c8102e', '#1a1a1a', 'v', '#1a1a1a', '#1a1a1a', '빨강·검정 줄무늬'],
    ['#0b3a8c', '#a50044', 'v', '#0b3a8c', '#0b3a8c', '파랑·자주 줄무늬'],
    ['#1f8f4e', '#ffffff', 'hoop', '#ffffff', '#1f8f4e', '초록·흰 가로 띠'],
    ['#f26b1d', '#1a1a1a', 'solid', '#1a1a1a', '#f26b1d', '주황 · 검정 · 주황']
  ];
  var LABEL = { shirt: '상의', shorts: '하의', socks: '스타킹', num: '번호' };
  var PREV = [['circle', '원형'], ['shirt', '유니폼']];

  function hex(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : ''; }
  function isGk(p) { return !!p && !p.coach && (String(p.num) === '1' || p.pos === 'GK'); }
  function keyOf(team, gk) { return (gk ? 'gk:' : '') + team; }
  function kitOf(kits, p) {
    if (!kits || !p || !p.team || p.coach) return null;
    var k = kits[keyOf(p.team, isGk(p))]; if (!k) return null;
    var out = {}, any = false;
    PARTS.forEach(function (n) { var h = hex(k[n]); if (h) { out[n] = h; any = true; } });
    return any ? out : null;
  }
  function shade(h, k) { h = hex(h); if (!h) return ''; var n = parseInt(h.slice(1), 16); function c(v) { return ('0' + Math.round(v * k).toString(16)).slice(-2); } return '#' + c(n >> 16 & 255) + c(n >> 8 & 255) + c(n & 255); }
  // 자동 색(board-token-depth 의 personFigure 와 같은 규칙)
  function auto(part, shirt) { return part === 'shorts' ? (shade(shirt, .38) || '#1d2128') : (hex(shirt) || '#3a6df0'); }
  function ink(h) { h = hex(h); if (!h) return '#fff'; var n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255 > .6 ? '#111111' : '#ffffff'; }
  function cssBG(m, a, p) {   // 작전판 kitCSSBG 와 같은 기하(모듈 시험용 · 작전판이 없을 때)
    if (p === 'v') return 'linear-gradient(90deg,' + m + ' 0 20%,' + a + ' 20% 40%,' + m + ' 40% 60%,' + a + ' 60% 80%,' + m + ' 80%)';
    if (p === 'thinv') return 'linear-gradient(90deg,' + m + ' 0 12%,' + a + ' 12% 22%,' + m + ' 22% 45%,' + a + ' 45% 55%,' + m + ' 55% 78%,' + a + ' 78% 88%,' + m + ' 88%)';
    if (p === 'h') return 'linear-gradient(180deg,' + m + ' 0 20%,' + a + ' 20% 40%,' + m + ' 40% 60%,' + a + ' 60% 80%,' + m + ' 80%)';
    if (p === 'half') return 'linear-gradient(90deg,' + m + ' 0 50%,' + a + ' 50%)';
    if (p === 'quarters') return 'conic-gradient(' + a + ' 0 25%,' + m + ' 25% 50%,' + a + ' 50% 75%,' + m + ' 75%)';
    if (p === 'band') return 'linear-gradient(90deg,' + m + ' 0 36%,' + a + ' 36% 64%,' + m + ' 64%)';
    if (p === 'hoop') return 'linear-gradient(180deg,' + m + ' 0 36%,' + a + ' 36% 64%,' + m + ' 64%)';
    if (p === 'sash') return 'linear-gradient(135deg,' + m + ' 0 36%,' + a + ' 36% 64%,' + m + ' 64%)';
    if (p === 'diag') return 'linear-gradient(135deg,' + m + ' 0 20%,' + a + ' 20% 40%,' + m + ' 40% 60%,' + a + ' 60% 80%,' + m + ' 80%)';
    return m;
  }
  function kitHTML(cls) {   // 상의 · 하의 · 스타킹 그림(CSS 모양 — 무늬는 배경 그대로)
    return '<span class="' + cls + '"><span class="kf-p kf-shirt" data-part="shirt"><i class="kf-fill"></i><b class="kf-num">10</b></span>' +
      '<span class="kf-p kf-shorts" data-part="shorts"><i class="kf-fill"></i></span>' +
      '<span class="kf-p kf-socks" data-part="socks"><i class="kf-fill kf-l"></i><i class="kf-fill kf-r"></i></span></span>';
  }

  /* global state, renderTokens, pushUndo, boardSaveLive, tokenLayer */
  function install(win) {
    var doc = win.document;
    if (!doc || win.__psKit) return null;
    win.__psKit = true;
    win.__kitOf = function (p) { try { return kitOf(state.teamKit, p); } catch (_) { return null; } };
    var ed = { team: 'blue', gk: false, part: 'shirt', sub: 'main', anchor: null };
    var box = null, armed = false;

    function S() { try { var f = ed.gk ? win.__getGkStyle : win.__getTeamStyle; return f ? f(ed.team) : null; } catch (_) { return null; } }
    function style() { var s = S() || {}; return { main: hex(s.main) || TEAM_DEF[ed.team] || '#1a2f5c', accent: hex(s.accent) || '#ffffff', pat: s.pat || 'solid', txt: hex(s.txt) || '', stroke: hex(s.stroke) || '' }; }
    function bg(m, a, p) { try { return typeof win.kitCSSBG === 'function' ? win.kitCSSBG(m, a, p) : cssBG(m, a, p); } catch (_) { return cssBG(m, a, p); } }
    function kitEntry(create) {
      try { if (!state.teamKit || typeof state.teamKit !== 'object') { if (!create) return null; state.teamKit = {}; } } catch (_) { return null; }
      var k = keyOf(ed.team, ed.gk); if (!state.teamKit[k]) { if (!create) return null; state.teamKit[k] = {}; } return state.teamKit[k];
    }
    function partColor(part) {
      var s = style(), e = kitEntry(false) || {};
      if (part === 'shirt') return ed.sub === 'accent' ? s.accent : s.main;
      if (part === 'num') return ed.sub === 'stroke' ? (s.stroke || '') : (s.txt || '');
      return hex(e[part]) || '';
    }
    function undoOnce() { if (armed) return; armed = true; try { pushUndo(); } catch (_) {} win.setTimeout(function () { armed = false; }, 900); }
    function call(name, a, b) { try { var f = win[(ed.gk ? '__setGk' : '__setTeam') + name]; if (typeof f === 'function') f(a, b); } catch (_) {} }
    function setKit(part, v) { var e = kitEntry(true); if (!e) return; if (v) e[part] = hex(v); else delete e[part]; if (!e.shorts && !e.socks) { try { delete state.teamKit[keyOf(ed.team, ed.gk)]; } catch (_) {} } try { renderTokens(); } catch (_) {} }
    // 고른 칸에 색 하나(빈 값 = 자동)
    function apply(v) {
      undoOnce();
      var p = ed.part;
      if (p === 'shirt') call(ed.sub === 'accent' ? 'Accent' : 'Main', ed.team, v || (ed.sub === 'accent' ? '#ffffff' : TEAM_DEF[ed.team]));
      else if (p === 'num') call(ed.sub === 'stroke' ? 'Stroke' : 'Txt', ed.team, v || 'auto');
      else setKit(p, v);
      after();
    }
    function after() { repaintChips(); paint(); save(); }
    var saveT = 0;
    function save() { win.clearTimeout(saveT); saveT = win.setTimeout(function () { try { boardSaveLive(); } catch (_) {} }, 400); }
    function combo(c) {
      undoOnce();
      call('Main', ed.team, c[0]); call('Accent', ed.team, c[1]); call('Pat', ed.team, c[2]);
      var e = kitEntry(true); if (e) { e.shorts = c[3]; e.socks = c[4]; }
      try { renderTokens(); } catch (_) {}
      after();
    }
    function reset() {
      undoOnce();
      call('Main', ed.team, ed.gk ? '' : TEAM_DEF[ed.team]); call('Accent', ed.team, '#ffffff'); call('Pat', ed.team, 'solid'); call('Stroke', ed.team, 'auto'); call('Txt', ed.team, 'auto');
      if (ed.gk) { try { if (state.gkColors) delete state.gkColors[ed.team]; } catch (_) {} }
      try { if (state.teamKit) delete state.teamKit[keyOf(ed.team, ed.gk)]; } catch (_) {}
      try { renderTokens(); } catch (_) {}
      after();
    }
    // 팀 칩(하단 도크 · 예전 벤치)도 같은 옷으로
    function repaintChips() {
      [].forEach.call(doc.querySelectorAll('#benchCat .tpill[data-cat]'), function (b) {
        var c = b.getAttribute('data-cat'); try { var m = win.teamMain(c), g = win.teamChipBG(c); b.style.background = g; b.style.color = ink(m); b.style.setProperty('--df-kit', g); b.style.setProperty('--df-kit-ink', ink(m)); } catch (_) {}
      });
    }

    // ── 창 ──
    function build() {
      if (box) return box;
      box = doc.createElement('div'); box.id = 'psKitEd'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '팀 유니폼');
      box.innerHTML = '<div class="ke-hd"><b>팀 유니폼</b><button type="button" class="ke-x" aria-label="닫기">×</button></div>' +
        '<div class="ke-teams" role="tablist">' + TEAMS.map(function (t) { return '<button type="button" data-team="' + t[0] + '" role="tab"><i></i>' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div class="ke-who" role="tablist"><button type="button" data-gk="0">필드 선수</button><button type="button" data-gk="1">골키퍼</button></div>' +
        '<div class="ke-main">' + kitHTML('ke-fig') +
        '<div class="ke-side"><div class="ke-parts">' + ['shirt', 'shorts', 'socks', 'num'].map(function (p) { return '<button type="button" data-part="' + p + '">' + LABEL[p] + '</button>'; }).join('') + '</div>' +
        '<div class="ke-sub"></div>' +
        '<div class="ke-sw">' + SWATCH.map(function (s) { return '<button type="button" data-c="' + s[0] + '" title="' + s[1] + '" aria-label="' + s[1] + '" style="background:' + s[0] + '"></button>'; }).join('') +
        '<label class="ke-custom" title="다른 색"><input type="color" aria-label="다른 색"><span>＋</span></label></div>' +
        '<button type="button" class="ke-auto">자동</button>' +
        '<div class="ke-pats">' + PATS.map(function (p) { return '<button type="button" data-pat="' + p[0] + '" title="' + p[1] + '" aria-label="' + p[1] + '"><i></i></button>'; }).join('') + '</div>' +
        '</div></div>' +
        // 3.121 — 토큰 미리보기(사용자 «토큰 유니폼 설정할 때 미리보기 가능하게»): 판에서 보일 원형 · 유니폼 토큰을 그대로(board-jersey.js)
        '<div class="ke-h">토큰 미리보기 <small>판에서 이렇게 보여요</small></div><div class="ke-prev">' + PREV.map(function (p) {
          return '<div class="ke-tok" data-shape="' + p[0] + '"><svg viewBox="-27 -27 54 54" aria-hidden="true" focusable="false"></svg><span>' + p[1] + '</span></div>';
        }).join('') + '</div>' +
        '<div class="ke-h">빠른 조합</div><div class="ke-combos">' + COMBOS.map(function (c, i) { return '<button type="button" data-combo="' + i + '" title="' + c[5] + '" aria-label="' + c[5] + '">' + kitHTML('ke-mini') + '</button>'; }).join('') + '</div>' +
        '<div class="ke-ft"><span class="ke-hint">그림을 눌러 고르고, 색을 눌러 입혀요 · 하의 · 스타킹은 3D «사람»에 보여요</span><button type="button" class="ke-reset">기본으로</button></div>';
      doc.body.appendChild(box);
      // 빠른 조합 그림은 한 번만 칠한다
      [].forEach.call(box.querySelectorAll('[data-combo]'), function (b) { var c = COMBOS[+b.getAttribute('data-combo')]; paintFig(b.querySelector('.ke-mini'), c[0], c[1], c[2], c[3], c[4], '', true); });
      box.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      box.addEventListener('click', function (e) {
        var t = e.target, b;
        e.stopPropagation();
        if (t.closest('.ke-x')) { close(); return; }
        if ((b = t.closest('[data-team]'))) { ed.team = b.getAttribute('data-team'); paint(); return; }
        if ((b = t.closest('[data-gk]'))) { ed.gk = b.getAttribute('data-gk') === '1'; paint(); return; }
        if ((b = t.closest('[data-combo]'))) { combo(COMBOS[+b.getAttribute('data-combo')]); return; }
        if ((b = t.closest('[data-part]'))) { ed.part = b.getAttribute('data-part'); ed.sub = ed.part === 'num' ? 'txt' : 'main'; paint(); return; }
        if ((b = t.closest('[data-sub]'))) { ed.sub = b.getAttribute('data-sub'); paint(); return; }
        if ((b = t.closest('[data-c]'))) { apply(b.getAttribute('data-c')); return; }
        if ((b = t.closest('[data-pat]'))) { undoOnce(); call('Pat', ed.team, b.getAttribute('data-pat')); after(); return; }
        if (t.closest('.ke-auto')) { apply(''); return; }
        if (t.closest('.ke-reset')) { reset(); return; }
      });
      var custom = box.querySelector('.ke-custom input');
      custom.addEventListener('input', function () { apply(custom.value); });
      doc.addEventListener('pointerdown', function (e) { if (box.classList.contains('on') && !box.contains(e.target) && !(e.target.closest && e.target.closest('[data-ps-kit-open],.ps-kit-pen'))) close(); });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('on')) close(); });
      win.addEventListener('resize', function () { if (box.classList.contains('on')) place(); });
      return box;
    }
    // 판의 토큰과 같은 그림: 바탕(원 · 셔츠, 무늬는 작전판 kitSVGDef) + 유니폼(PSJersey) + 번호. 값은 style() 이 고른 #rrggbb 뿐 — setAttribute 로만 넣는다
    function paintPrev(s) {
      var shape = '';
      try { shape = typeof tokShape !== 'undefined' ? tokShape : ''; } catch (_) {}   /* global tokShape */
      [].forEach.call(box.querySelectorAll('.ke-tok'), function (t) {
        var sh = t.getAttribute('data-shape'), svg = t.querySelector('svg');
        t.classList.toggle('on', sh === (shape === 'person' ? 'shirt' : shape));
        try { drawToken(svg, sh, s, ed.gk ? '1' : '10'); } catch (_) {}
      });
    }
    function drawToken(svg, shape, s, num) {
      if (!svg) return;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var NS = 'http://www.w3.org/2000/svg', J = win.PSJersey, main = s.main, sh = shape === 'shirt';
      function mk(tag, a) { var e = doc.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; }
      var stroke = s.stroke || (J && J.lum(main) > .62 ? '#2a3140' : '#ffffff'), fill = main;
      if (s.pat !== 'solid' && typeof win.kitSVGDef === 'function') {
        try { var id = 'kePv-' + shape, d = win.kitSVGDef(id, main, s.accent, s.pat); if (d) { var defs = mk('defs', {}); defs.appendChild(d); fill = 'url(#' + id + ')'; } } catch (_) {}
      }
      mk('ellipse', { cx: '1.5', cy: sh ? '22' : '20', rx: sh ? '17' : '19', ry: '4.5', fill: 'rgba(0,0,0,.28)' });   // 바닥 그림자(판의 drop-shadow 대신)
      if (sh) mk('path', { d: (J && J.SHIRT_D) || '', fill: fill, stroke: stroke, 'stroke-width': '2.2', 'stroke-linejoin': 'round' });
      else mk('circle', { r: '21', fill: fill, stroke: stroke, 'stroke-width': '2.6' });
      if (J) J.spec(shape, { main: main, acc: s.accent, pat: s.pat, stroke: stroke }).forEach(function (n) { mk(n[0], n[1]); });
      var txt = s.txt || ink(main), two = String(num).length >= 2;
      var t = mk('text', { x: '0', y: sh ? '2.5' : '1', 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: txt, 'font-size': sh ? (two ? '16' : '19') : (two ? '18' : '22'),
        'font-weight': '800', 'font-family': "Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif",
        stroke: (J && J.lum(txt) > .5) ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.6)', 'stroke-width': '.8', 'paint-order': 'stroke', 'stroke-linejoin': 'round' });
      t.textContent = num;
    }
    function paintFig(fig, main, accent, pat, shorts, socks, num, mini) {
      if (!fig) return;
      var sh = fig.querySelector('.kf-shirt .kf-fill'); if (sh) sh.style.background = bg(main, accent, pat);
      var so = fig.querySelector('.kf-shorts .kf-fill'); if (so) so.style.background = shorts;
      [].forEach.call(fig.querySelectorAll('.kf-socks .kf-fill'), function (x) { x.style.background = socks; });
      var n = fig.querySelector('.kf-num'); if (n) { if (mini) n.textContent = ''; else { n.style.color = num.txt; n.style.setProperty('-webkit-text-stroke', '1.4px ' + num.stroke); } }
    }
    function paint() {
      if (!box) return;
      var s = style(), e = kitEntry(false) || {}, shorts = hex(e.shorts) || auto('shorts', s.main), socks = hex(e.socks) || auto('socks', s.main);
      paintFig(box.querySelector('.ke-fig'), s.main, s.accent, s.pat, shorts, socks, { txt: s.txt || ink(s.main), stroke: s.stroke || 'rgba(0,0,0,.25)' });
      [].forEach.call(box.querySelectorAll('.ke-teams [data-team]'), function (b) { var t = b.getAttribute('data-team'), on = t === ed.team; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); try { b.querySelector('i').style.background = win.teamChipBG ? win.teamChipBG(t) : TEAM_DEF[t]; } catch (_) {} });
      [].forEach.call(box.querySelectorAll('.ke-who [data-gk]'), function (b) { var on = (b.getAttribute('data-gk') === '1') === ed.gk; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      [].forEach.call(box.querySelectorAll('[data-part]'), function (b) { b.classList.toggle('on', b.getAttribute('data-part') === ed.part); });
      var fig = box.querySelector('.ke-fig'); fig.setAttribute('data-sel', ed.part);
      var sub = box.querySelector('.ke-sub');
      sub.innerHTML = ed.part === 'shirt' ? '<button type="button" data-sub="main">주색</button><button type="button" data-sub="accent">보조색' + (s.pat === 'solid' ? ' <small>무늬에</small>' : '') + '</button>'
        : ed.part === 'num' ? '<button type="button" data-sub="txt">글자</button><button type="button" data-sub="stroke">테두리</button>' : '';
      [].forEach.call(sub.querySelectorAll('[data-sub]'), function (b) { b.classList.toggle('on', b.getAttribute('data-sub') === ed.sub); });
      var cur = partColor(ed.part);
      [].forEach.call(box.querySelectorAll('.ke-sw [data-c]'), function (b) { b.classList.toggle('on', b.getAttribute('data-c') === cur); });
      var inp = box.querySelector('.ke-custom input'), shown = cur || (ed.part === 'shorts' ? shorts : ed.part === 'socks' ? socks : ed.part === 'num' ? hex(s.txt) || ink(s.main) : s.main);
      if (hex(shown) && inp.value !== hex(shown)) inp.value = hex(shown);
      var au = box.querySelector('.ke-auto'), autoable = ed.part !== 'shirt' || ed.sub === 'accent';
      au.style.display = autoable ? '' : 'none'; au.classList.toggle('on', autoable && !cur);
      au.textContent = ed.part === 'shirt' ? '없음(흰색)' : '자동';
      paintPrev(s);
      var pats = box.querySelector('.ke-pats'); pats.style.display = ed.part === 'shirt' ? '' : 'none';
      [].forEach.call(pats.querySelectorAll('[data-pat]'), function (b) { var p = b.getAttribute('data-pat'); b.classList.toggle('on', p === s.pat); b.querySelector('i').style.background = bg(s.main, s.accent === s.main ? '#ffffff' : s.accent, p); });
    }
    function place() {
      var w = box.offsetWidth || 400, h = box.offsetHeight || 520, vw = win.innerWidth, vh = win.innerHeight, r = ed.anchor && ed.anchor.getBoundingClientRect ? ed.anchor.getBoundingClientRect() : null;
      // 위쪽 막대(보관함 편집에서는 편집 막대 아래로 내려가 있다)를 가리지 않게 그 아래부터
      var left, top, minTop = 8, tb = doc.querySelector('#boardPageStrip.ps-tb>.tb-c'); if (tb) { var q = tb.getBoundingClientRect(); if (q.height) minTop = Math.round(q.bottom + 10); }
      if (r && r.width) { left = r.left + r.width / 2 - w / 2; top = r.top - h - 10; if (top < minTop) top = r.bottom + 10; if (top + h > vh - 8) top = Math.max(minTop, (vh - h) / 2); }
      else { left = (vw - w) / 2; top = minTop; }
      if (top + h > vh - 8) top = Math.max(8, vh - h - 8);
      box.style.left = Math.round(Math.max(8, Math.min(vw - w - 8, left))) + 'px'; box.style.top = Math.round(Math.max(8, Math.min(vh - h - 8, top))) + 'px';
    }
    function open(o) {
      o = o || {}; build();
      if (o.team && TEAM_DEF[o.team]) ed.team = o.team; else { try { var c = win.__getBenchCat2 && win.__getBenchCat2(); if (TEAM_DEF[c]) ed.team = c; } catch (_) {} }
      ed.gk = !!o.gk; ed.part = o.part || 'shirt'; ed.sub = ed.part === 'num' ? 'txt' : 'main'; ed.anchor = o.anchor || null;
      paint(); box.classList.add('on'); place();
      try { var m = doc.getElementById('ps-tb-menu'); if (m) m.classList.remove('on'); } catch (_) {}
    }
    function close() { if (box) box.classList.remove('on'); }
    win.__psKitOpen = open;

    // ── 찾는 곳 ──
    // 1) 하단 도크 «선수» 칸: 팀 칩마다 ✎, 칸 머리에 «유니폼 꾸미기»
    function decorateTray() {
      var tray = doc.getElementById('ps-df-tray'); if (!tray) return false;
      var hd = tray.querySelector('.df-pane[data-pane="team"] .df-h');
      if (hd && !hd.querySelector('.ps-kit-hd')) {
        hd.textContent = '팀 — 고르고 운동장을 누르면 한 명씩';
        var b = doc.createElement('button'); b.type = 'button'; b.className = 'ps-kit-hd'; b.setAttribute('data-ps-kit-open', '1'); b.textContent = '유니폼 꾸미기'; hd.appendChild(b);
      }
      [].forEach.call(doc.querySelectorAll('#benchCat .tpill[data-cat]'), function (p) {
        if (p.querySelector('.ps-kit-pen')) return;
        var s = doc.createElement('span'); s.className = 'ps-kit-pen'; s.setAttribute('role', 'button'); s.setAttribute('tabindex', '0'); s.setAttribute('aria-label', '이 팀 유니폼 꾸미기'); s.title = '유니폼 꾸미기'; s.textContent = '✎'; p.appendChild(s);
      });
      return true;
    }
    // 2) 오른쪽 선수 패널: «팀 유니폼 바꾸기»
    function decorateInspector() {
      var ctl = doc.querySelector('.sel-ctl'); if (!ctl || ctl.querySelector('.ps-kit-insp')) return !!ctl;
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'ps-kit-insp'; b.setAttribute('data-ps-kit-open', 'sel'); b.innerHTML = '<span class="ps-kit-insp-i"></span>팀 유니폼 바꾸기<span class="ps-kit-insp-ar">›</span>';
      ctl.appendChild(b); return true;
    }
    function selPlayer() { try { /* global sel */ return typeof sel !== 'undefined' && sel && sel.type === 'player' ? sel.ref : null; } catch (_) { return null; } }
    doc.addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.closest) return;
      var pen = t.closest('.ps-kit-pen');
      if (pen) { e.stopPropagation(); e.preventDefault(); var c = pen.parentNode.getAttribute('data-cat'); open({ team: c, anchor: pen.parentNode }); return; }
      var o = t.closest('[data-ps-kit-open]'); if (!o) return;
      e.stopPropagation(); e.preventDefault();
      var how = o.getAttribute('data-ps-kit-open');
      if (how === 'sel') { var p = selPlayer(); open({ team: p && p.team, gk: isGk(p), anchor: o }); }
      else open({ anchor: how === 'menu' ? null : o });
    }, true);
    doc.addEventListener('keydown', function (e) { var t = e.target; if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('ps-kit-pen')) { e.preventDefault(); t.click(); } }, true);
    // 3) 예전 문(팀 칩 한 번 더 누르기)이 연 창은 이 창으로 바꿔 연다
    function redirectOld() {
      var old = doc.getElementById('teamStylePop'); if (!old || old.__psKit) return !!old; old.__psKit = 1;
      try {
        new win.MutationObserver(function () {
          if (!old.classList.contains('on')) return;
          old.classList.remove('on');
          var gk = !!doc.querySelector('#teamStyleSeg button.on[data-ts="gk"]'), c = null; try { c = win.__getBenchCat2 && win.__getBenchCat2(); } catch (_) {}
          open({ team: c, gk: gk, anchor: doc.querySelector('#benchCat .tpill.on') });
        }).observe(old, { attributes: true, attributeFilter: ['class'] });
      } catch (_) {}
      return true;
    }

    var st = doc.createElement('style'); st.id = 'ps-kit-css';
    var F = 'font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;';
    st.textContent = [
      '#psKitEd{position:fixed;z-index:10060;width:404px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;padding:14px 16px 12px;border-radius:18px;background:#fff;color:#14161A;border:1px solid rgba(20,33,61,.08);box-shadow:0 18px 44px rgba(15,23,42,.26);display:none;' + F + 'font-size:12.5px;box-sizing:border-box}',
      '#psKitEd.on{display:block}',
      'body.fmdark #psKitEd,body.ps-skin-glass #psKitEd{background:#1f2430;color:#E8ECF4;border-color:rgba(255,255,255,.08)}',
      '#psKitEd button{' + F + 'cursor:pointer;color:inherit}',
      '#psKitEd .ke-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}',
      '#psKitEd .ke-hd b{font-size:15px;font-weight:800}',
      '#psKitEd .ke-x{width:30px;height:30px;border:0;border-radius:9px;background:rgba(127,127,127,.12);font-size:18px;line-height:1}',
      '#psKitEd .ke-teams,#psKitEd .ke-who,#psKitEd .ke-sub,#psKitEd .ke-parts{display:flex;gap:4px;padding:3px;border-radius:11px;background:rgba(127,127,127,.1)}',
      '#psKitEd .ke-teams button,#psKitEd .ke-who button,#psKitEd .ke-sub button,#psKitEd .ke-parts button{flex:1;height:30px;border:0;border-radius:8px;background:transparent;font-weight:700;font-size:12px;display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}',
      '#psKitEd .ke-teams button.on,#psKitEd .ke-who button.on,#psKitEd .ke-sub button.on,#psKitEd .ke-parts button.on{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.14);color:#14161A}',
      'body.fmdark #psKitEd .on:is(.ke-teams button,.ke-who button,.ke-sub button,.ke-parts button){background:#3a4150;color:#fff}',
      '#psKitEd .ke-teams i{width:14px;height:14px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}',
      '#psKitEd .ke-who{margin-top:6px}',
      '#psKitEd .ke-sub small{font-size:10px;opacity:.6;font-weight:600}',
      '#psKitEd .ke-sub:empty{display:none}',
      '#psKitEd .ke-main{display:flex;gap:14px;margin-top:12px;align-items:flex-start}',
      '#psKitEd .ke-side{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:8px}',
      // 유니폼 그림: 모양은 clip-path, 고른 칸은 바깥 빛(부모 filter 가 모양을 따라간다)
      '.ke-fig,.ke-mini{position:relative;display:block;flex:none}',
      '.ke-fig{width:124px;height:196px;margin-top:2px}',
      '.ke-mini{width:30px;height:48px;margin:auto}',
      '.ke-fig .kf-p,.ke-mini .kf-p{position:absolute;display:block}',
      '.ke-fig .kf-p{cursor:pointer}',
      '.kf-fill{position:absolute;inset:0;display:block}',
      '.kf-shirt{left:0;top:0;width:100%;height:49%}',
      '.kf-shirt .kf-fill{clip-path:polygon(32% 0,40% 6%,60% 6%,68% 0,100% 20%,90% 44%,79% 38%,79% 100%,21% 100%,21% 38%,10% 44%,0 20%)}',
      '.kf-num{position:absolute;left:0;right:0;top:32%;text-align:center;font:900 30px/1 Pretendard,-apple-system,sans-serif;paint-order:stroke;pointer-events:none}',
      '.kf-shorts{left:19%;top:48%;width:62%;height:21%}',
      '.kf-shorts .kf-fill{clip-path:polygon(2% 0,98% 0,100% 100%,56% 100%,50% 62%,44% 100%,0 100%)}',
      '.kf-socks{left:24%;top:71%;width:52%;height:29%}',
      '.kf-socks .kf-l,.kf-socks .kf-r{inset:auto;top:0;height:88%;width:32%;border-radius:2px 2px 0 0}',
      '.kf-socks .kf-l{left:4%}.kf-socks .kf-r{right:4%}',
      '.kf-socks:after{content:"";position:absolute;left:0;right:0;bottom:0;height:12%;background:linear-gradient(90deg,#15181d 0 40%,transparent 40% 60%,#15181d 60%)}',
      '.ke-fig .kf-p{filter:drop-shadow(0 1px 0 rgba(0,0,0,.18)) drop-shadow(0 0 1px rgba(0,0,0,.35))}',
      '.ke-fig .kf-p:hover{filter:drop-shadow(0 0 2px rgba(47,107,255,.6)) drop-shadow(0 0 2px rgba(47,107,255,.6))}',
      '.ke-fig[data-sel="shirt"] .kf-shirt,.ke-fig[data-sel="num"] .kf-shirt,.ke-fig[data-sel="shorts"] .kf-shorts,.ke-fig[data-sel="socks"] .kf-socks{filter:drop-shadow(0 0 0 #2f6bff) drop-shadow(0 0 2.5px #2f6bff) drop-shadow(0 0 2.5px #2f6bff)}',
      '.ke-fig[data-sel="num"] .kf-num{outline:2px dashed #2f6bff;outline-offset:3px;border-radius:4px;left:28%;right:28%}',
      '#psKitEd .ke-sw{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}',
      '#psKitEd .ke-sw button,#psKitEd .ke-custom{width:100%;aspect-ratio:1;border-radius:50%;border:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18);padding:0;position:relative;box-sizing:border-box}',
      '#psKitEd .ke-sw button.on{box-shadow:0 0 0 2px #fff,0 0 0 4px #2f6bff}',
      'body.fmdark #psKitEd .ke-sw button.on{box-shadow:0 0 0 2px #1f2430,0 0 0 4px #5b8cff}',
      '#psKitEd .ke-custom{display:grid;place-items:center;background:conic-gradient(#e23b3b,#ffd400,#34a56f,#2f6df0,#8e2a55,#e23b3b);cursor:pointer;overflow:hidden}',
      '#psKitEd .ke-custom span{width:62%;height:62%;border-radius:50%;background:#fff;color:#14161A;display:grid;place-items:center;font-weight:900;font-size:13px}',
      '#psKitEd .ke-custom input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}',
      '#psKitEd .ke-auto{align-self:flex-start;height:28px;padding:0 12px;border-radius:8px;border:1px solid rgba(127,127,127,.3);background:transparent;font-weight:700;font-size:11.5px}',
      '#psKitEd .ke-auto.on{background:rgba(47,107,255,.12);border-color:rgba(47,107,255,.55);color:#2f6bff}',
      '#psKitEd .ke-pats{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}',
      '#psKitEd .ke-pats button{height:30px;border-radius:8px;border:1px solid rgba(127,127,127,.25);background:transparent;padding:4px}',
      '#psKitEd .ke-pats button i{display:block;width:100%;height:100%;border-radius:5px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}',
      '#psKitEd .ke-pats button.on{border-color:#2f6bff;box-shadow:0 0 0 1px #2f6bff}',
      '#psKitEd .ke-h{margin:12px 0 6px;font-weight:800;font-size:12px;opacity:.75}',
      '#psKitEd .ke-h small{margin-left:4px;font-weight:600;font-size:11px;opacity:.75}',
      '#psKitEd .ke-prev{display:flex;gap:8px}',
      '#psKitEd .ke-tok{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px 7px;border-radius:12px;background:#262c3b;color:#E8ECF4;font-size:11.5px;font-weight:700}',
      '#psKitEd .ke-tok svg{width:80px;height:80px;display:block;overflow:visible}',
      '#psKitEd .ke-tok.on{box-shadow:0 0 0 2px #2f6bff}',
      '#psKitEd .ke-tok.on span:after{content:" · 지금 판";font-weight:600;opacity:.7}',
      '#psKitEd .ke-combos{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}',
      '#psKitEd .ke-combos button{height:58px;border-radius:9px;border:1px solid rgba(127,127,127,.22);background:rgba(127,127,127,.05);padding:4px 0}',
      '#psKitEd .ke-combos button:hover{border-color:#2f6bff}',
      '#psKitEd .ke-ft{display:flex;align-items:center;gap:10px;margin-top:12px}',
      '#psKitEd .ke-hint{flex:1 1 auto;font-size:10.5px;line-height:1.35;opacity:.6}',
      '#psKitEd .ke-reset{flex:none;height:30px;padding:0 12px;border-radius:9px;border:1px solid rgba(127,127,127,.3);background:transparent;font-weight:700;font-size:12px}',
      // 찾는 곳
      '#benchCat .tpill[data-cat]{position:relative}',
      '.ps-kit-pen{position:absolute;right:-2px;top:-3px;width:20px;height:20px;border-radius:50%;background:#fff;color:#14213D;font:700 11px/20px Pretendard,-apple-system,sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer;z-index:2}',
      'body:not(.ps-dock-float) .ps-kit-pen{display:none}',
      'body.ps-dock-float #ps-df-tray .ps-kit-pen{right:calc(50% - 24px);top:6px}',
      '.ps-kit-hd{float:right;margin-top:-3px;height:24px;padding:0 10px;border-radius:999px;border:0;background:#14213D;color:#fff;font:700 11px/24px Pretendard,-apple-system,sans-serif;cursor:pointer}',
      '.ps-kit-insp{display:none}',
      'html.ps-page-board body.ps-dock-float.ps-insp-on .sel-ctl .ps-kit-insp{display:flex!important;order:7!important;align-items:center;gap:8px;width:100%;height:38px;margin:4px 0 2px;padding:0 12px;border-radius:11px;border:1px solid rgba(127,127,127,.22);background:rgba(127,127,127,.06);font:700 12.5px/1 Pretendard,-apple-system,sans-serif;color:inherit;cursor:pointer;box-sizing:border-box}',
      '.ps-kit-insp-i{width:16px;height:16px;border-radius:4px;background:conic-gradient(#d71920 0 33%,#fff 0 66%,#1e5bc6 0);box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}',
      '.ps-kit-insp-ar{margin-left:auto;opacity:.5;font-size:16px}'
    ].join('\n');
    (doc.head || doc.documentElement).appendChild(st);

    var n = 0;
    function boot() {
      var a = redirectOld(), b = decorateInspector(); decorateTray();
      if ((!a || !b) && ++n < 80) win.setTimeout(boot, 250);
    }
    // 도크의 «선수» 칸은 열 때 만들어진다 — 칸이 생기거나 다시 채워지면 ✎ 를 단다
    try { new win.MutationObserver(function () { decorateTray(); }).observe(doc.body, { childList: true }); } catch (_) {}
    doc.addEventListener('click', function () { win.setTimeout(decorateTray, 0); });
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    return { open: open, close: close };
  }
  if (typeof window !== 'undefined' && window.document) install(window);
  return { kitOf: kitOf, keyOf: keyOf, isGk: isGk, auto: auto, hex: hex, cssBG: cssBG, COMBOS: COMBOS, SWATCH: SWATCH };
});
