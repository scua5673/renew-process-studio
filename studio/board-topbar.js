/* PROCESS STUDIO — 위쪽 막대 정리(3.078, 레이아웃 1단계). 사용자 «레이아웃도 잘 설계하고 싶어» → 목업 «네 1단계부터».
   떠 있는 하단 도크(body.ps-dock-float)일 때 페이지 띠(#boardPageStrip)를 경기장 위에 뜬 세 덩어리로 바꾼다.
   - 왼쪽: «보드 ▾»(미팅 세트 · 보드 가져오기 · 새 보드를 이 메뉴로) + 페이지 탭 + ＋
   - 가운데: 보기 전환 — 평면 · 3D
   - 오른쪽: 보관함 연결 · 보드 저장 · 보드 설정(아이콘) · 보관함 저장
   띠는 그릴 때마다 비우고 새로 채우므로(board.html render) 다 그린 뒤 원래 단추를 그대로 옮겨 담는다 — 누르는 동작 · 권한은 단추에 붙은 그대로다.
   경기장은 위 흰 띠 없이 화면 끝까지 채운다. 모양은 도크 스타일(board-dock-skin.js: 글래스 · 베벨 · 기본, 다크 모드)을 따른다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSTopBar = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // 띠의 단추를 어느 덩어리로 보낼지 — 첫 «＋ 페이지»만 탭 옆, 나머지 .bp-add 는 «보드 ▾» 메뉴
  function sortStrip(children) {
    var out = { head: null, tabs: [], add: null, menu: [], right: [], other: [] }, firstAdd = true;
    children.forEach(function (n) {
      var c = n.classList || { contains: function () { return false; } };
      if (c.contains('bp-head')) out.head = n;
      else if (c.contains('bp-tab')) out.tabs.push(n);
      else if (c.contains('bp-add')) { if (firstAdd && /^＋/.test(n.textContent || '')) { out.add = n; firstAdd = false; } else out.menu.push(n); }
      else if (n.id === 'bpLinkChip' || n.id === 'boardManualSave' || n.id === 'bpBoardSettings' || n.id === 'vaultSave') out.right.push(n);
      else out.other.push(n);
    });
    var R = ['bpLinkChip', 'boardManualSave', 'bpBoardSettings', 'vaultSave'];
    out.right.sort(function (a, b) { return R.indexOf(a.id) - R.indexOf(b.id); });
    return out;
  }
  // 보이는 선수 모양: «사람»은 3D 에서만, 평면에서는 유니폼(3.079)
  function shapeShown(shape, tilt) { return shape === 'person' && !tilt ? 'shirt' : (shape || 'circle'); }
  // 지금 보기: 평면 · 3D (3.096 — 중계는 뺐다. 옛 tv 값도 3D)
  function viewOf(tilt) { return !tilt ? 'flat' : '3d'; }

  // 세로 평면의 위쪽 골대가 보기 버튼에 가리지 않도록 실제 높이를 예약한다.
  // SVG 크기는 그대로 두고 applyView가 이 몫을 위쪽 잔디 여백으로 바꾼다.
  function topInset(svg, orientation) {
    if (!svg || orientation !== 'v') return 0;
    var doc = svg.ownerDocument, body = doc.body, win = doc.defaultView;
    if (!body.classList.contains('ps-dock-float') || body.classList.contains('bc-tilt3d') || body.classList.contains('editing')) return 0;
    var stage = svg.parentElement, strip = doc.getElementById('boardPageStrip');
    if (!stage || !strip || !strip.classList.contains('ps-tb')) return 0;
    var r = stage.getBoundingClientRect(), cs = win.getComputedStyle(stage);
    var top = r.top + (parseFloat(cs.paddingTop) || 0), bottom = top;
    var controls = Array.prototype.slice.call(strip.querySelectorAll(':scope>.tb-g'));
    var door = doc.getElementById('ehDoor'); if (door) controls.push(door);
    controls.forEach(function (g) {
      var b = g.getBoundingClientRect();
      if (b.width && b.height && b.right > r.left && b.left < r.right) bottom = Math.max(bottom, b.bottom + 8);
    });
    return Math.max(0, Math.ceil(bottom - top));
  }

  var N = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return ':not(#tb' + i + ')'; }).join('');
  var S = 'html.ps-page-board body.ps-dock-float #boardPageStrip.ps-tb' + N;
  function css() {
    var Bk = function (k) { return 'html.ps-page-board body.ps-dock-float' + k + ' #boardPageStrip.ps-tb' + N; };
    var glass = 'background:linear-gradient(180deg,rgba(46,54,74,.86),rgba(20,24,36,.9) 55%,rgba(12,15,24,.94))!important;border:1px solid rgba(255,255,255,.08)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.3),0 6px 16px rgba(0,0,0,.35)!important;color:#E8ECF4!important;';
    var bevel = 'background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(244,246,250,.95) 60%,rgba(232,236,243,.95))!important;border:1px solid rgba(255,255,255,.9)!important;box-shadow:inset 0 1px 0 #fff,inset 0 -2px 0 rgba(20,33,61,.06),0 1px 2px rgba(15,23,42,.10),0 4px 12px rgba(15,23,42,.12)!important;color:#1A2233!important;';
    var bevelD = 'background:linear-gradient(180deg,#3A414E,#2A303B 55%,#20252E)!important;border:1px solid rgba(255,255,255,.06)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -2px 0 rgba(0,0,0,.35),0 6px 16px rgba(0,0,0,.35)!important;color:#E6E9EF!important;';
    var flat = 'background:rgba(255,255,255,.96)!important;border:1px solid rgba(20,22,26,.07)!important;box-shadow:0 3px 12px rgba(8,12,24,.14)!important;color:#14161A!important;';
    var flatD = 'background:rgba(28,32,42,.95)!important;border:1px solid rgba(255,255,255,.07)!important;box-shadow:0 6px 18px rgba(0,0,0,.38)!important;color:#E6E9EF!important;';
    var onB = 'background:linear-gradient(180deg,#2A3D6E,#14213D 60%,#0D1630)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 0 rgba(0,0,0,.3),0 2px 5px rgba(20,33,61,.3)!important;';
    var onG = 'background:linear-gradient(180deg,#3E6BFF,#2448D8 55%,#1B37B0)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.25),0 2px 6px rgba(36,72,216,.4)!important;';
    var onW = 'background:linear-gradient(180deg,#fff,#E4E8EF 60%,#CDD3DD)!important;color:#14161A!important;box-shadow:inset 0 1px 0 #fff,0 4px 10px rgba(0,0,0,.45)!important;';
    var tabOnL = 'background:linear-gradient(180deg,#fff,#F1F3F7)!important;color:#14161A!important;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(15,23,42,.1),0 2px 4px rgba(15,23,42,.08)!important;';
    var tabOnD = 'background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.08))!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 2px 6px rgba(0,0,0,.4)!important;';
    // [덩어리 판, 고른 탭, 주 단추, 흐린 글자, 오목한 홈]
    var themes = [
      ['.ps-skin-glass', glass, tabOnD, onG, 'rgba(232,236,244,.6)', 'rgba(0,0,0,.35)'],
      ['.ps-skin-bevel:not(.fmdark)', bevel, tabOnL, onB, '#5E6675', 'rgba(20,33,61,.07)'],
      ['.ps-skin-bevel.fmdark', bevelD, tabOnD, onW, 'rgba(230,233,239,.6)', 'rgba(0,0,0,.3)'],
      ['.ps-skin-flat:not(.fmdark)', flat, tabOnL, onB, '#646A73', 'rgba(20,33,61,.06)'],
      ['.ps-skin-flat.fmdark', flatD, tabOnD, onW, 'rgba(230,233,239,.6)', 'rgba(0,0,0,.3)']
    ];
    // 3.083 — 사용자 «클로드처럼 작게»(B안): 덩어리 높이 50 → 36, 단추 · 글자 · 그림자를 줄였다
    var out = [
      // 띠 자체는 투명한 겹(경기장 위) — 덩어리만 누를 수 있다
      'html.ps-page-board body.ps-dock-float #boardStage' + N + '{}',
      S + '{display:flex!important;position:absolute!important;left:0!important;right:0!important;top:0!important;z-index:60!important;height:auto!important;padding:8px 10px!important;gap:8px!important;background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important;pointer-events:none!important;justify-content:space-between!important;align-items:flex-start!important}',
      // 3.083 — 보관함에서 연 편집(위에 고정된 #vCreateBar 56px)에서는 그 아래로 · 빈 보드의 «포메이션으로 시작» 문은 막대 아래로
      'html.ps-page-board body.ps-dock-float.vcreating #boardPageStrip.ps-tb' + N + '{top:56px!important}',
      'html.ps-page-board body.ps-dock-float #ehDoor{top:58px!important}',
      S + '>.tb-g{pointer-events:auto;display:flex;align-items:center;gap:2px;height:36px;padding:0 4px;border-radius:12px;-webkit-backdrop-filter:blur(20px) saturate(1.5);backdrop-filter:blur(20px) saturate(1.5);flex:0 1 auto;min-width:0;font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}',
      S + '>.tb-l{overflow:hidden}',
      // 3.083 — 가운데 덩어리(보기 · 모양)는 화면 가운데에(왼쪽 덩어리가 넓어도) — 양옆과 겹치지 않을 때만(tb-mid, JS 가 잰다)
      S + '.tb-mid>.tb-c{position:absolute;left:50%;top:8px;transform:translateX(-50%)}',
      S + '>.bp-head{display:none!important}',
      // 3.079 — 패턴북(book-mode)은 왼쪽 기둥이 시퀀스 목록이라 띠를 접는다(board.html 의 접기 규칙과 같은 조건) — 막대가 그 규칙을 덮지 않게
      'html.ps-page-board body.book-mode:not(.focus-board):not(.vault-full):not(.ps-phone-work):not(.ps-dock) #boardPageStrip.ps-tb' + N + N + '{display:none!important}',
      // 3.130 — 미팅 발표(슬라이드쇼, body.focus-board)에서는 띠를 걷는다: 가운데 «평면 · 3D»가 슬라이드 제목 띠(#ksHead)를,
      // 왼쪽 «보드 ▾»가 메모 첫 줄(#ksOv)을 덮었다. 발표에서 띠의 단추(페이지 · 보기 · 내보내기)는 쓰지 않는다 — 나가면 그대로.
      'html.ps-page-board body.focus-board #boardPageStrip' + N + N + '{display:none!important}',
      S + ' .tb-tabs{display:flex;align-items:center;gap:2px;min-width:0;overflow-x:auto;scrollbar-width:none}',
      S + ' .tb-tabs::-webkit-scrollbar{display:none}',
      S + ' .tb-sep{width:1px;height:16px;margin:0 3px;flex:none}',
      // «보드 ▾»
      S + ' .tb-brand{display:flex;align-items:center;gap:6px;height:28px;padding:0 6px 0 3px;border:0;border-radius:9px;background:transparent;color:inherit;font:800 12.5px/1 Pretendard,-apple-system,sans-serif;cursor:pointer;flex:none}',
      S + ' .tb-logo{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font:900 9px/1 Pretendard,-apple-system,sans-serif;letter-spacing:-.04em}',
      S + ' .tb-brand svg{opacity:.6}',
      // 페이지 탭
      S + ' .bp-tab{height:26px!important;padding:0 8px!important;border-radius:7px!important;border:0!important;background:transparent!important;font:700 12px/1 Pretendard,-apple-system,sans-serif!important;display:inline-flex!important;align-items:center!important;gap:4px!important;white-space:nowrap!important;flex:none!important}',
      S + ' .bp-tab .bpx{opacity:.55;display:inline-flex;align-items:center}',
      S + ' .bp-tab:not(.on) .bpx{display:none!important}',
      S + ' .tb-add{width:26px!important;min-width:26px!important;height:26px!important;padding:0!important;border:0!important;border-radius:7px!important;background:transparent!important;font:700 0/0 a!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:none!important;cursor:pointer}',
      S + ' .tb-add:before{content:"＋";font:800 14px/1 Pretendard,-apple-system,sans-serif}',
      // 보기 전환
      S + ' .tb-seg{display:flex;gap:1px;padding:2px;border-radius:9px}',
      S + ' .tb-rs button{padding:0 7px!important;display:inline-flex;align-items:center;justify-content:center}',
      S + ' .tb-shape button{padding:0 7px!important;display:inline-flex;align-items:center;justify-content:center}',
      S + ' .tb-seg button{height:26px;padding:0 10px;border:0;border-radius:7px;background:transparent;font:700 11.5px/1 Pretendard,-apple-system,sans-serif;cursor:pointer}',
      // 오른쪽
      S + '>.tb-r>*{flex:none}',
      S + '>.tb-r button:not(#vaultSave){height:28px!important;min-height:0!important;border-radius:8px!important;font:700 12px/1 Pretendard,-apple-system,sans-serif!important;border:0!important;align-items:center!important;gap:5px!important;padding:0 10px!important;white-space:nowrap!important;vertical-align:middle!important}',   // display 은 두지 않는다 — 첨부 · 편집 · 미팅 모드의 숨김 규칙이 이기게
      S + ' #bpBoardSettings{width:28px!important;padding:0!important;justify-content:center!important}',
      S + ' #bpBoardSettings>span{display:none!important}',
      S + ' #bpBoardSettings svg{width:16px!important;height:16px!important}',
      S + ' #bpLinkChip{height:26px!important}',
      S + ' #vaultSave{position:static!important;right:auto!important;bottom:auto!important;top:auto!important;left:auto!important;transform:none!important;margin:0 0 0 2px!important}',
      // 선수 모양: «사람»은 3D 에서만(평면은 유니폼으로 그린다)
      'html body:not(.bc-tilt3d) #boardPageStrip .tb-shape button[data-shape="person"],html body:not(.bc-tilt3d) #shapeSeg button[data-s="person"]{display:none!important}',
      // 메뉴
      '#ps-tb-menu{position:fixed;z-index:430;display:none;min-width:200px;padding:6px;border-radius:14px;background:rgba(255,255,255,.98);box-shadow:0 14px 34px rgba(8,12,24,.28);border:1px solid rgba(20,22,26,.07);font-family:Pretendard,-apple-system,sans-serif;color:#14161A}',
      '#ps-tb-menu.on{display:block}',
      '#ps-tb-menu>button{display:flex!important;width:100%!important;align-items:center;height:38px!important;padding:0 12px!important;border:0!important;border-radius:9px!important;background:transparent!important;color:inherit!important;font:700 13px/1 Pretendard,-apple-system,sans-serif!important;text-align:left;cursor:pointer;box-shadow:none!important}',
      '#ps-tb-menu>button:hover{background:rgba(20,33,61,.07)!important}',
      'body.fmdark #ps-tb-menu,body.ps-skin-glass #ps-tb-menu{background:rgba(28,32,42,.97);color:#E8ECF4;border-color:rgba(255,255,255,.08)}',
      'body.fmdark #ps-tb-menu>button:hover,body.ps-skin-glass #ps-tb-menu>button:hover{background:rgba(255,255,255,.08)!important}'
    ];
    themes.forEach(function (t) {
      var X = Bk(t[0]), dark = /fmdark|glass/.test(t[0]) && !/:not\(\.fmdark\)/.test(t[0]);
      var ink = dark ? '#E8ECF4' : '#1A2233';
      out.push(
        X + '>.tb-g{' + t[1] + '}',
        X + ' .bp-tab,' + X + ' .tb-add,' + X + ' .tb-seg button,' + X + '>.tb-r button:not(#vaultSave):not(#boardManualSave){color:' + t[4] + '!important;background:transparent!important;box-shadow:none!important}',
        X + ' .bp-tab.on,' + X + ' .tb-seg button.on{' + t[2] + '}',
        X + ' .bp-tab:hover:not(.on),' + X + ' .tb-add:hover,' + X + ' .tb-seg button:hover:not(.on),' + X + '>.tb-r button:not(#vaultSave):not(#boardManualSave):hover{color:' + ink + '!important;background:' + (dark ? 'rgba(255,255,255,.08)' : 'rgba(20,33,61,.06)') + '!important}',
        X + ' #bpBoardSettings{color:' + ink + '!important}',
        X + ' #bpBoardSettings[aria-expanded="true"]{background:' + t[5] + '!important}',
        // 3.115 — «내보내기»는 글자까지 진하게(사용자 «잘 보이게»). 위 흐린 단추 규칙(:not(#…) 둘)을 이기려고 id 를 하나 더
        X + '>.tb-r button#tbExport:not(#vaultSave):not(#boardManualSave){color:' + ink + '!important}',
        X + '>.tb-r button#tbExport:not(#vaultSave):not(#boardManualSave):hover,' + X + '>.tb-r button#tbExport:not(#vaultSave):not(#boardManualSave)[aria-expanded="true"]{background:' + t[5] + '!important}',
        X + ' #vaultSave,' + X + ' #boardManualSave{' + t[3] + '}',   // 3.083 — 저장 단추는 «저장» 하나(staging 3.077) — 주 단추로
        X + ' .tb-logo{' + t[3] + '}',
        X + ' .tb-seg{background:' + t[5] + ';box-shadow:inset 0 1px 3px rgba(0,0,0,' + (dark ? '.45' : '.12') + ')}',
        X + ' .tb-sep{background:' + (dark ? 'rgba(255,255,255,.12)' : 'rgba(20,33,61,.12)') + '}',
        X + ' .tb-brand{color:' + ink + '}'
      );
    });
    return out.join('\n');
  }

  function install(win) {
    var doc = win.document, body = doc.body;
    if (!body || body.__psTopBar) return null;
    body.__psTopBar = true;
    var st = doc.createElement('style'); st.id = 'ps-topbar-css'; st.textContent = css(); doc.head.appendChild(st);
    var menu = doc.createElement('div'); menu.id = 'ps-tb-menu'; menu.setAttribute('role', 'menu'); doc.body.appendChild(menu);
    var lastCam = 'mid', obs = null, busy = false, saved = null, lastInset = -1;
    function refit() {
      var svg = doc.getElementById('board');
      if (!svg || typeof win.__getBoardOrient !== 'function') return;
      var inset = topInset(svg, win.__getBoardOrient());
      if (inset === lastInset) return;
      lastInset = inset;
      if (typeof win.applyView === 'function') win.applyView();
    }
    function on() { return body.classList.contains('ps-dock-float'); }
    function strip() { return doc.getElementById('boardPageStrip'); }
    function curView() { var t = body.classList.contains('bc-tilt3d'), c = ''; try { c = (win.__tilt3d && win.__tilt3d.cam) || ''; } catch (_) {} if (c) lastCam = c; return viewOf(t); }
    function clickSeg(sel) { var b = doc.querySelector(sel); if (b) b.click(); return !!b; }
    function setView(v) {
      var tilt = body.classList.contains('bc-tilt3d');
      if (v === 'flat') { if (tilt) clickSeg('#tiltSeg button[data-t="0"]'); }
      else {
        if (!tilt) clickSeg('#tiltSeg button[data-t="1"]');
        win.setTimeout(function () { clickSeg('#tiltCamSeg button[data-cam="' + lastCam + '"]'); paintView(); }, tilt ? 0 : 60);
      }
      win.setTimeout(paintView, 120);
    }
    function curShape() { var t = ''; try { t = typeof tokShape !== 'undefined' ? tokShape : ''; } catch (_) {}   /* global tokShape */ return shapeShown(t, body.classList.contains('bc-tilt3d')); }
    function paintView() {
      var s = strip(), v = curView(), sh = curShape(); if (!s) return;
      s.querySelectorAll('.tb-seg button').forEach(function (b) { var k = b.getAttribute('data-v'), o = k ? k === v : b.getAttribute('data-shape') === sh; b.classList.toggle('on', o); b.setAttribute('aria-pressed', o ? 'true' : 'false'); });
      // 보드 설정의 «선수 모양»도 평면에서는 «사람» 보드를 유니폼으로 보이게
      try { var seg = doc.getElementById('shapeSeg'); if (seg && !body.classList.contains('bc-tilt3d')) seg.querySelectorAll('button[data-s]').forEach(function (b) { if (b.getAttribute('data-s') === 'shirt' && sh === 'shirt') b.classList.add('on'); }); } catch (_) {}
      refit();
    }
    function mk(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    function build() {
      var s = strip(); if (!s || busy) return;
      if (!on()) { unbuild(); return; }
      if (s.querySelector(':scope>.tb-g')) { adoptStrays(s); paintView(); return; }   // 이미 정리됨 — 늦게 들어온 단추만 제자리로
      var kids = Array.prototype.slice.call(s.children); if (!kids.length) return;
      busy = true;
      try {
        var g = sortStrip(kids); saved = g;
        var L = mk('div', 'tb-g tb-l'), C = mk('div', 'tb-g tb-c'), R = mk('div', 'tb-g tb-r');
        var title = g.head ? (g.head.querySelector('.bp-t') || {}).textContent || '보드' : '보드';
        var brand = mk('button', 'tb-brand', '<span class="tb-logo">PS</span><span>' + title + '</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>');
        brand.type = 'button'; brand.id = 'tbBrand'; brand.title = '보드 메뉴 — 미팅 세트 · 보드 가져오기 · 새 보드'; brand.setAttribute('aria-haspopup', 'menu');
        L.appendChild(brand);
        var tabs = mk('div', 'tb-tabs');
        if (g.tabs.length) { L.appendChild(mk('span', 'tb-sep')); g.tabs.forEach(function (t) { tabs.appendChild(t); }); L.appendChild(tabs); }
        if (g.add) { g.add.classList.add('tb-add'); g.add.setAttribute('aria-label', g.add.title || '페이지 추가'); L.appendChild(g.add); }
        // 메뉴에 들어갈 단추는 메뉴 창으로(누르면 메뉴를 닫고 원래 동작)
        menu.innerHTML = ''; g.menu.forEach(function (b) { menu.appendChild(b); });
        // 3.083 — «팀 유니폼»(board-kit.js 가 연다 — 사용자 «유니폼 설정을 더 쉽게 찾고»)
        var kit = doc.createElement('button'); kit.type = 'button'; kit.className = 'tb-kit'; kit.setAttribute('data-ps-kit-open', 'menu'); kit.setAttribute('role', 'menuitem'); kit.textContent = '팀 유니폼'; menu.appendChild(kit);
        brand.style.display = '';
        g.other.forEach(function (n) { L.appendChild(n); });
        C.innerHTML = '<div class="tb-seg" role="group" aria-label="보기"><button type="button" data-v="flat" title="평면 작전판">평면</button><button type="button" data-v="3d" title="3D 경기장">3D</button></div><span class="tb-sep"></span><div class="tb-seg tb-shape" role="group" aria-label="선수 모양"><button type="button" data-shape="shirt" title="선수 모양 — 유니폼" aria-label="유니폼"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 3l-5 3 2 5 2-1v11h10V10l2 1 2-5-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/></svg></button><button type="button" data-shape="circle" title="선수 모양 — 원형" aria-label="원형"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg></button><button type="button" data-shape="person" title="선수 모양 — 사람(3D · 중계에서 서 있는 선수)" aria-label="사람"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="4.5" r="2.6"/><path d="M8.5 8.5h7l1 7h-2l-.6 7h-3.8l-.6-7h-2z"/></svg></button></div><div class="tb-seg tb-rs"><button type="button" class="tb-rsize" title="실제 비율 크기 — 선수 · 공을 몇 배로" aria-label="실제 비율 크기"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20L20 4M14 4h6v6M10 20H4v-6"/></svg></button></div>';
        if (win.PSPlayerEye) C.querySelector('.tb-seg').appendChild(win.PSPlayerEye.button());
        g.right.forEach(function (n) { R.appendChild(n); });
        exportBtn(R);
        s.appendChild(L); s.appendChild(C); s.appendChild(R);
        s.classList.add('ps-tb');
        paintView(); win.setTimeout(clearSelCtl, 0); win.setTimeout(function () { try { center(); } catch (_) {} }, 0);
      } finally { busy = false; }
    }
    // 떠 있는 도크가 꺼지면(좁은 창) 띠를 원래 차례로 되돌린다
    function unbuild() {
      var s = strip(); if (!s) return;
      s.classList.remove('ps-tb'); menu.classList.remove('on');
      if (!saved || !s.querySelector(':scope>.tb-g')) return;
      busy = true;
      try {
        var g = saved, order = [].concat(g.head ? [g.head] : [], g.tabs, g.add ? [g.add] : [], g.menu, g.other, g.right);
        if (g.add) g.add.classList.remove('tb-add');
        Array.prototype.slice.call(s.querySelectorAll(':scope>.tb-g')).forEach(function (x) { x.remove(); });
        order.forEach(function (n) { s.appendChild(n); });
      } finally { busy = false; saved = null; }
    }
    // 띠를 다 그린 뒤 따로 끼워 넣는 단추(보드 저장 · 보관함 저장 등)도 덩어리 안으로
    function adoptStrays(s) {
      var strays = Array.prototype.slice.call(s.children).filter(function (n) { return !n.classList.contains('tb-g') && !n.classList.contains('bp-head'); });
      if (!strays.length) return;
      busy = true;
      try {
        var g = sortStrip(strays), L = s.querySelector(':scope>.tb-l'), R = s.querySelector(':scope>.tb-r'), tabs = L && L.querySelector('.tb-tabs');
        if (tabs) g.tabs.forEach(function (t) { tabs.appendChild(t); });
        if (g.add && L) { g.add.classList.add('tb-add'); L.appendChild(g.add); }
        g.menu.forEach(function (b) { menu.appendChild(b); });
        g.other.forEach(function (n) { if (L) L.appendChild(n); });
        if (R) { g.right.forEach(function (n) { R.appendChild(n); }); var R0 = ['bpLinkChip', 'tbExport', 'boardManualSave', 'bpBoardSettings', 'vaultSave']; Array.prototype.slice.call(R.children).sort(function (a, b) { return R0.indexOf(a.id) - R0.indexOf(b.id); }).forEach(function (n) { R.appendChild(n); }); }
        if (saved) { saved.tabs = saved.tabs.concat(g.tabs); saved.menu = saved.menu.concat(g.menu); saved.other = saved.other.concat(g.other); saved.right = saved.right.concat(g.right); if (g.add) saved.add = g.add; }
      } finally { busy = false; }
    }
    // 3.115 — «내보내기»(PNG · PDF, board-quick-export.js) — 보관함 연결 다음, «저장» 앞(오류 제보 0077af18 «화면 캡쳐했을때 걸리적»)
    function exportBtn(R) {
      var q = win.PSQuickExport, b = q && q.button ? q.button(doc) : null; if (!b) return;
      var lk = R.querySelector(':scope>#bpLinkChip'); R.insertBefore(b, lk ? lk.nextSibling : R.firstChild);
    }
    function placeMenu() { var b = doc.getElementById('tbBrand'); if (!b) return; var r = b.getBoundingClientRect(); menu.style.left = Math.max(8, r.left) + 'px'; menu.style.top = (r.bottom + 10) + 'px'; }
    doc.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('#tbBrand'); if (b) { e.stopPropagation(); if (!menu.children.length) return; menu.classList.toggle('on'); placeMenu(); return; }
      var v = e.target.closest && e.target.closest('#boardPageStrip .tb-seg button[data-v]'); if (v) { e.stopPropagation(); setView(v.getAttribute('data-v')); return; }
      var sb = e.target.closest && e.target.closest('#boardPageStrip .tb-shape button[data-shape]'); if (sb) { e.stopPropagation(); var o = doc.querySelector('#shapeSeg button[data-s="' + sb.getAttribute('data-shape') + '"]'); if (o) o.click(); win.setTimeout(paintView, 30); return; }
      if (menu.classList.contains('on') && !menu.contains(e.target)) menu.classList.remove('on');
    }, true);
    menu.addEventListener('click', function () { win.setTimeout(function () { menu.classList.remove('on'); }, 0); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') menu.classList.remove('on'); });
    function watch() {
      var s = strip(); if (!s || s.__psTbObs) return !!s;
      s.__psTbObs = true;
      try { obs = new win.MutationObserver(function () { if (!busy) build(); }); obs.observe(s, { childList: true }); } catch (_) {}
      return true;
    }
    // 띠가 다시 그려질 때 · 떠 있는 도크가 켜지고 꺼질 때 · 3D/카메라가 바뀔 때
    try { new win.MutationObserver(function () { var s = strip(); if (s && on() !== s.classList.contains('ps-tb')) { var was = s.classList.contains('ps-tb'); if (on()) build(); else unbuild(); if (s.classList.contains('ps-tb') !== was) win.setTimeout(function () { try { win.dispatchEvent(new win.Event('resize')); } catch (_) {} }, 0); }   /* 3.083 — 바뀐 때만 · 다음 차례에(커뮤니티 보기에서 세우지 못하면 resize → 도크 mount → class 가 끝없이 돌았다) */ paintView(); try { clearSelCtl(); } catch (_) {} }).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}
    win.addEventListener('resize', function () { win.setTimeout(clearSelCtl, 50); win.setTimeout(center, 60); });
    // 가운데 맞추기: 정말 가운데에 두어도 왼쪽 · 오른쪽 덩어리와 10px 이상 떨어질 때만
    function center() {
      var s = strip(); if (!s || !s.classList.contains('ps-tb')) return;
      var L = s.querySelector(':scope>.tb-l'), C = s.querySelector(':scope>.tb-c'), R = s.querySelector(':scope>.tb-r'); if (!L || !C) return;
      if (ro) [L, C, R, doc.getElementById('ehDoor')].forEach(function (g) { if (g && !g.__tbRO) { g.__tbRO = 1; ro.observe(g); } });   // 탭이나 빈 보드의 시작 단추가 바뀌어도 다시 잰다
      var sr = s.getBoundingClientRect(); if (!sr.width) return;
      var lr = L.getBoundingClientRect().left - sr.left + Math.max(L.offsetWidth, L.scrollWidth), rl = R ? R.getBoundingClientRect().left - sr.left : sr.width, cw = C.offsetWidth, mid = sr.width / 2;
      var ok = mid - cw / 2 >= lr + 10 && mid + cw / 2 <= rl - 10;
      if (s.classList.contains('tb-mid') !== ok) s.classList.toggle('tb-mid', ok);
      refit();
    }
    win.__psTopBarCenter = center;
    var ro = null; try { if (win.ResizeObserver) ro = new win.ResizeObserver(function () { center(); }); } catch (_) {}
    // 선택 패널(.sel-ctl)이 위쪽 막대와 겹치면 막대 아래로 내린다 — 예전에는 띠 아래 무대 안이라 겹칠 일이 없었다
    function clearSelCtl() {
      var s = strip(), c = doc.querySelector('.sel-ctl'); if (!c) return;
      if (c.__psTbM) { c.style.removeProperty('margin-top'); c.__psTbM = false; }
      if (!on() || !s || c.offsetParent === null) return;
      var cr = c.getBoundingClientRect(), bottom = 0;
      s.querySelectorAll(':scope>.tb-g').forEach(function (g) { var r = g.getBoundingClientRect(); if (r.width && r.left < cr.right && r.right > cr.left) bottom = Math.max(bottom, r.bottom); });
      if (bottom && cr.top < bottom + 8) { c.style.setProperty('margin-top', Math.ceil(bottom + 8 - cr.top) + 'px', 'important'); c.__psTbM = true; }
    }
    function wrapShapeSync() { var f = win.__syncShapeSeg; if (typeof f !== 'function' || f.__psTb) return; var w = function () { var r = f.apply(this, arguments); try { paintView(); } catch (_) {} return r; }; w.__psTb = true; win.__syncShapeSeg = w; }
    function wrapSel() { try { wrapShapeSync(); } catch (_) {}
      var orig = win.positionSelCtl; if (typeof orig !== 'function' || orig.__psTb) return typeof orig === 'function';
      var w = function () { var r = orig.apply(this, arguments); try { clearSelCtl(); } catch (_) {} return r; }; w.__psTb = true; win.positionSelCtl = w; return true;
    }
    var n = 0; (function tryIt() { var ok = watch(); wrapSel(); if (ok) { build(); if (!wrapSel()) win.setTimeout(wrapSel, 1500); return; } if (++n < 80) win.setTimeout(tryIt, 250); })();
    return { build: build, unbuild: unbuild, setView: setView, view: curView };
  }
  if (typeof window !== 'undefined' && window.document) {
    var go = function () { window.__psTopBar = install(window); };
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', go); else go();
  }
  return { sortStrip: sortStrip, viewOf: viewOf, shapeShown: shapeShown, topInset: topInset, css: css, install: install };
});
