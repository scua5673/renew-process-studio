/* PROCESS STUDIO — 도형 오른쪽 클릭 메뉴 · «맨 뒤» 단추(3.139, 제보 0a1f6e9d 박수빈 «도형 우클릭 시 굵기 · 투명도 조절 및 맨 뒤 기능»).
   - 선 · 사각형 · 원 · 화살표 · 다각형 같은 그림을 마우스 오른쪽 클릭(맥은 ⌃클릭도)하면 그 자리에 작은 창:
     굵기 · 투명도 슬라이더(그 도형에만 — 새로 그릴 기본값은 안 바꾼다) · 맨 앞 · 맨 뒤 · 삭제 · (도구 막대의 «선 스타일»이 보이면) 더 보기.
     여럿을 골라 둔 채 그중 하나를 누르면 묶음 전체에. 글(텍스트)은 순서 · 삭제만.
   - 선택 패널(.sel-ctl)의 «맨 앞» 옆에 «맨 뒤»(#backSelBtn) — 터치 기기(아이패드)의 길. 보이고 숨는 건 «맨 앞»과 같이(updateDelUI 를 감싼다),
     도크 배치의 «더보기» 규칙도 «맨 앞»과 같은 선택자로 따라간다.
   - 그림 요소 ↔ 자료는 drawingEl 을 감싸 g.__psD 로 잇는다(drawLayer 의 자식 차례에 기대지 않는다).
   - 본문보다 먼저 읽히고 DOMContentLoaded 에 건다. renderTokens 는 부르지 않는다(3.120 함정). board.html 은 <script> 한 줄. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSShapeMenu = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var NAMES = { pass: '패스', run: '달리기', dribble: '드리블', shot: '슛', line: '선', dashline: '점선', free: '자유 선', rect: '사각형', rectline: '사각형', rectdash: '사각형', ellipse: '원', poly: '다각형', link: '연결선', text: '글' };
  var LW = [0.5, 3, 0.1], OP = [0.2, 1, 0.05];
  function round(v, step) { return Math.round(v / step) / Math.round(1 / step); }
  function clamp(v, r, def) { v = +v; if (!isFinite(v)) return def; return round(Math.max(r[0], Math.min(r[1], v)), r[2]); }
  function clampLw(v) { return clamp(v, LW, 1); }
  function clampOp(v) { return clamp(v, OP, 1); }
  function name(d) { if (!d) return '도형'; if (d.grid) return '그리드'; return NAMES[d.type] || '도형'; }
  function isText(d) { return !!d && d.type === 'text'; }
  // 오른쪽 클릭 — 토큰 정보 창(2.975)과 같은 판정: 마우스 오른쪽 단추, 맥은 ⌃+왼쪽
  function isRightClick(e, mac) {
    if (!e || e.pointerType !== 'mouse') return false;
    return e.button === 2 || (e.button === 0 && !!e.ctrlKey && !e.metaKey && !!mac);
  }
  // 눌린 요소에서 그림 자료를 찾는다: drawingEl 이 붙인 __psD 를 위로 올라가며(지금 판에 있는 것만).
  // 표식이 없으면(본문이 부팅 중 그린 것 — 감싸기 전) drawLayer 바로 아래 g 의 차례로(renderDrawings 는 drawings 차례대로 붙인다).
  function findDrawing(target, drawings, layer) {
    var n = target, k = 0, top = null;
    while (n && k++ < 14) {
      if (n.__psD && drawings && drawings.indexOf(n.__psD) >= 0) return n.__psD;
      if (layer && n.parentNode === layer) top = n;
      n = n.parentNode;
    }
    if (top && layer && drawings && layer.children && layer.children.length === drawings.length) {
      var i = Array.prototype.indexOf.call(layer.children, top);
      if (i >= 0 && drawings[i]) return drawings[i];
    }
    return null;
  }
  // 메뉴가 다룰 그림들: 둘 이상 골라 둔 묶음 안의 것을 누르면 묶음의 그림 전부, 아니면 그것 하나
  function targets(d, multiSel, drawings) {
    if (!d) return [];
    if (multiSel && multiSel.length >= 2 && multiSel.indexOf(d) >= 0) {
      var a = multiSel.filter(function (o) { return drawings && drawings.indexOf(o) >= 0; });
      if (a.length) return a;
    }
    return [d];
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // 창 자리: 누른 점 오른쪽 아래, 화면을 벗어나면 안쪽으로
  function place(x, y, w, h, vw, vh) {
    var left = x + 6, top = y + 6;
    if (left + w > vw - 8) left = Math.max(8, x - w - 6);
    if (top + h > vh - 8) top = Math.max(8, vh - h - 8);
    return { left: left, top: top };
  }

  var BACK_ICON = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" fill-opacity=".22"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>';
  var N = ':not(#_):not(#__):not(#___)';
  function css() {
    return [
      // «맨 뒤»는 «맨 앞»(#frontSelBtn)과 같은 자리 규칙(board.html 2.980 · 도크 «더보기»)
      'html.ps-page-board body:not(.ps-dock) .sel-ctl > #backSelBtn' + N + ':not(#____):not(#_____){grid-column:auto!important;padding:0 2px!important;gap:3px!important;min-width:0!important;white-space:nowrap!important}',
      'html body.ps-dock .sel-ctl' + N + ' > #backSelBtn{order:20!important}',
      'html body.ps-dock .sel-ctl' + N + ':not(.sel-more) > #backSelBtn{display:none!important}',
      'html body.ps-dock .sel-ctl' + N + ':not(#____).sel-more > #backSelBtn{flex:1 1 calc(25% - 6px)!important;min-width:calc(25% - 6px)!important;padding:0 6px!important}',
      // 오른쪽 클릭 메뉴 — 뜨는 것들의 공통 카드(board-popups.js --pop-*; 없으면 «선 스타일» 팝오버 값)
      '#psShapeMenu{position:fixed;z-index:430;box-sizing:border-box;width:240px;padding:10px 12px 12px;border-radius:var(--pop-radius,14px);background:var(--pop-bg,var(--panel,#fff));border:1px solid var(--pop-border,var(--line,#E3E6EA));box-shadow:var(--pop-shadow,0 16px 42px rgba(12,20,32,.20));font-family:inherit;color:var(--pop-ink,var(--txt,#14161A));backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);max-height:calc(100dvh - 16px);overflow-y:auto;overscroll-behavior:contain}',
      '#psShapeMenu .sm-head{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;line-height:18px;margin:0 0 8px 2px;padding:0 2px 8px;border-bottom:1px solid var(--pop-line,rgba(20,33,61,.1));letter-spacing:-.01em}',
      '#psShapeMenu .sm-head i{display:inline-block;width:14px;height:14px;border-radius:4px;flex:0 0 14px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}',
      '#psShapeMenu .sm-row{display:grid;grid-template-columns:42px 1fr 34px;align-items:center;gap:8px;margin-bottom:6px}',
      '#psShapeMenu .sm-lb{font-size:12px;font-weight:600;color:var(--pop-dim,#646A73)}',
      '#psShapeMenu input[type=range]{display:block;width:100%;min-width:0;margin:0;accent-color:var(--pop-accent,var(--ps-navy,#14213D))}',
      '#psShapeMenu .sm-val{text-align:right;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '#psShapeMenu .sm-btns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}',
      '#psShapeMenu .sm-btns button{height:34px;border:0;border-radius:10px;background:var(--pop-well,rgba(20,33,61,.06));color:inherit;font-family:inherit;font-size:12.5px;font-weight:700;padding:0 8px;cursor:pointer;white-space:nowrap}',
      '#psShapeMenu .sm-btns button:hover{background:var(--pop-well2,rgba(20,33,61,.12))}',
      '#psShapeMenu .sm-btns button:active,#psShapeMenu .sm-btns button.on{background:var(--pop-accent,var(--ps-navy,#14213D));color:var(--pop-on-ink,#fff)}',
      '#psShapeMenu .sm-btns button.sm-del{color:var(--pop-danger,#d7263d);background:var(--pop-danger-bg,rgba(215,38,61,.08))}',
      '#psShapeMenu .sm-btns button.sm-del:hover{background:var(--pop-danger,#d7263d);color:#fff}',
      '#psShapeMenu .sm-btns button.sm-wide{grid-column:1/-1}'
    ].join('\n');
  }

  function install(win) {
    win = win || (typeof window !== 'undefined' ? window : null);
    if (!win || !win.document || win.__psShapeMenu) return null;
    var doc = win.document;
    var S = function () { return typeof state !== 'undefined' ? state : null; };
    var draws = function () { var s = S(); return (s && s.drawings) || []; };
    var SEL = function () { return typeof sel !== 'undefined' ? sel : null; };
    var MULTI = function () { return typeof multiSel !== 'undefined' ? multiSel : null; };
    var call = function (fn) { var f = win[fn]; if (typeof f !== 'function') return undefined; try { return f.apply(win, [].slice.call(arguments, 1)); } catch (_) { return undefined; } };
    var menu = null, openedAt = 0, undone = false;

    var st = doc.createElement('style'); st.id = 'psShapeMenuCss'; st.textContent = css();
    (doc.head || doc.documentElement).appendChild(st);

    var layer = function () { return doc.getElementById('drawLayer'); };
    function close() {
      if (!menu) return;
      try { menu.remove(); } catch (_) {}
      menu = null; undone = false;
      doc.removeEventListener('pointerdown', outside, true);
      doc.removeEventListener('keydown', onKey, true);
      win.removeEventListener('resize', close);
      win.removeEventListener('blur', close);
      // 메뉴가 닫히면 옆 패널(.sel-ctl.sel-near)이 다시 보인다 — 숨긴 채 잰 자리라 다시 놓는다
      try { if (doc.body.classList.contains('ps-shape-menu-on')) { doc.body.classList.remove('ps-shape-menu-on'); call('positionSelCtl'); } } catch (_) {}
    }
    function press(id) { var b = doc.getElementById(id); if (!b) return false; try { b.click(); } catch (_) { return false; } return true; }
    function outside(e) { if (menu && !menu.contains(e.target)) close(); }
    function onKey(e) { if (e.key === 'Escape' && menu) { e.stopPropagation(); close(); } }   // 첫 Esc 는 메뉴만 닫는다(고른 것은 그대로) — 한 번 더 누르면 본문이 선택을 푼다
    function once() { if (undone) return; undone = true; call('pushUndo'); }
    function repaint(save) {
      call('renderDrawings');
      if (save) { call('autoSaveAnimFrame'); call('boardSaveLive'); }
    }
    function lsVisible() {
      var b = doc.getElementById('lineStyleBtn');
      if (!b || !b.offsetParent) return false;
      try { var r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; } catch (_) { return false; }
    }
    function open(d, x, y) {
      close();
      var ts = targets(d, MULTI(), draws());
      if (!ts.length) return null;
      var m = MULTI(), inMulti = m && m.length >= 2 && m.indexOf(d) >= 0, s = SEL();
      if (!inMulti && !(s && s.ref === d)) call('selectItem', 'drawing', d);
      var shapes = ts.filter(function (o) { return !isText(o); }), base = shapes[0] || ts[0];
      var lw = clampLw(base.lw == null ? 1 : base.lw), op = clampOp(base.op == null ? 1 : base.op);
      var el = doc.createElement('div'); el.id = 'psShapeMenu';
      var color = /^#[0-9a-f]{6}$/i.test(base.color || '') ? base.color : '#3a6df0';
      var locked = ts.every(function (o) { return !!o.locked; }), more = !!(shapes.length && lsVisible());
      el.innerHTML = '<div class="sm-head"><i style="background:' + esc(color) + '"></i><span>' + esc(name(base)) + (ts.length > 1 ? ' ' + ts.length + '개' : '') + '</span></div>'
        + (shapes.length ? '<div class="sm-row"><span class="sm-lb">굵기</span><input type="range" id="psSmW" min="' + LW[0] + '" max="' + LW[1] + '" step="' + LW[2] + '" value="' + lw + '"><span class="sm-val" id="psSmWv">' + lw.toFixed(1) + '</span></div>'
          + '<div class="sm-row"><span class="sm-lb">투명도</span><input type="range" id="psSmO" min="' + OP[0] + '" max="' + OP[1] + '" step="' + OP[2] + '" value="' + op + '"><span class="sm-val" id="psSmOv">' + Math.round(op * 100) + '%</span></div>' : '')
        + '<div class="sm-btns">'
        + (!shapes.length && ts.length === 1 && doc.getElementById('textEditBtn') ? '<button type="button" class="sm-wide" data-act="edit">내용 수정</button>' : '')
        + '<button type="button" data-act="front" title="맨 앞으로 (⌘])">맨 앞</button><button type="button" data-act="back" title="맨 뒤로 (⌘[)">맨 뒤</button>'
        + (doc.getElementById('dupSelBtn') ? '<button type="button" data-act="dup">복제</button>' : '')
        + (doc.getElementById('lockSelBtn') ? '<button type="button" data-act="lock"' + (locked ? ' class="on"' : '') + ' title="위치 고정 — 끌어도 안 움직여요">' + (locked ? '고정 해제' : '고정') + '</button>' : '')
        + (more ? '<button type="button" data-act="more">선 스타일 더 보기…</button>' : '')
        + '<button type="button" class="sm-del' + (more ? '' : ' sm-wide') + '" data-act="del">삭제</button></div>';
      doc.body.appendChild(el);
      try { doc.body.classList.add('ps-shape-menu-on'); } catch (_) {}   // 옆 패널은 숨긴다(board-popups.js)
      var vw = doc.documentElement.clientWidth || win.innerWidth || 1024, vh = doc.documentElement.clientHeight || win.innerHeight || 768;
      var p = place(x, y, el.offsetWidth || 236, el.offsetHeight || 160, vw, vh);
      el.style.left = p.left + 'px'; el.style.top = p.top + 'px';
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); });
      var wR = el.querySelector('#psSmW'), oR = el.querySelector('#psSmO');
      if (wR && oR) {
        var wV = el.querySelector('#psSmWv'), oV = el.querySelector('#psSmOv');
        var apply = function (save) {
          var w = clampLw(wR.value), o = clampOp(oR.value);
          wV.textContent = w.toFixed(1); oV.textContent = Math.round(o * 100) + '%';
          var ch = false;
          shapes.forEach(function (q) { if ((q.lw == null ? 1 : q.lw) !== w || (q.op == null ? 1 : q.op) !== o) ch = true; });
          if (!ch) return;
          once();
          shapes.forEach(function (q) { q.lw = w; q.op = o; });
          repaint(save);
        };
        wR.addEventListener('input', function () { apply(false); });
        oR.addEventListener('input', function () { apply(false); });
        wR.addEventListener('change', function () { apply(true); call('boardSaveLive'); call('autoSaveAnimFrame'); });
        oR.addEventListener('change', function () { apply(true); call('boardSaveLive'); call('autoSaveAnimFrame'); });
        [wR, oR].forEach(function (r) { r.addEventListener('keydown', function (e) { e.stopPropagation(); }); });
      }
      el.querySelectorAll('button[data-act]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var act = b.dataset.act;
          if (act === 'front' || act === 'back') { call('zOrderItems', ts.slice(), act === 'front'); call('updateDelUI'); close(); return; }
          if (act === 'more') { close(); var lb = doc.getElementById('lineStyleBtn'); if (lb) lb.click(); return; }
          if (act === 'dup' || act === 'lock' || act === 'edit') { close(); press(act === 'dup' ? 'dupSelBtn' : act === 'lock' ? 'lockSelBtn' : 'textEditBtn'); return; }   // 선택 패널의 단추를 대신 누른다 — 동작 · 되돌리기는 그대로
          if (act === 'del') {
            close();
            if (ts.length === 1) { call('removeDrawing', ts[0]); return; }
            call('pushUndo');
            var s2 = S(); if (!s2) return;
            s2.drawings = s2.drawings.filter(function (o) { return ts.indexOf(o) < 0; });
            try { if (typeof sel !== 'undefined' && sel && ts.indexOf(sel.ref) >= 0) sel = null; } catch (_) {}
            try { if (typeof multiSel !== 'undefined') multiSel = (multiSel || []).filter(function (o) { return ts.indexOf(o) < 0; }); } catch (_) {}
            repaint(true); call('updateDelUI'); call('toast', '제거됨');
          }
        });
      });
      menu = el; openedAt = Date.now(); undone = false;
      doc.addEventListener('pointerdown', outside, true);
      doc.addEventListener('keydown', onKey, true);
      win.addEventListener('resize', close);
      win.addEventListener('blur', close);
      return el;
    }

    // 마우스 오른쪽 클릭 — 끌기 · 지우개 · 펜으로 넘어가기 전에(토큰 2.975 와 같은 자리)
    doc.addEventListener('pointerdown', function (e) {
      if (menu && menu.contains(e.target)) return;
      if (!isRightClick(e, !!win._PTR_MAC)) return;
      var d = findDrawing(e.target, draws(), layer());
      if (!d) return;
      e.stopPropagation();
      open(d, e.clientX, e.clientY);
    }, true);
    // 터치 기기의 길게 누르기(안드로이드) · 키보드 메뉴 키: 방금 연 것이 아니면 연다. 기본 메뉴는 늘 막는다.
    doc.addEventListener('contextmenu', function (e) {
      var d = findDrawing(e.target, draws(), layer());
      if (!d) return;
      e.preventDefault();
      if (menu && Date.now() - openedAt < 600) return;
      open(d, e.clientX || 0, e.clientY || 0);
    });

    // 선택 패널의 «맨 뒤»
    function mountBack() {
      var fb = doc.getElementById('frontSelBtn');
      if (!fb || doc.getElementById('backSelBtn')) return doc.getElementById('backSelBtn');
      var b = doc.createElement('button'); b.type = 'button'; b.id = 'backSelBtn'; b.className = 'dup-sel';
      b.title = '맨 뒤로 — 겹친 토큰 · 그림 아래로 내려 다른 것이 위에 보이게 (⌘[)';
      b.innerHTML = BACK_ICON + '맨 뒤';
      b.style.display = fb.style.display;
      fb.insertAdjacentElement('afterend', b);
      b.onclick = function (e) { e.stopPropagation(); call('zOrderSel', false); call('updateDelUI'); };
      return b;
    }
    function syncBack() { var fb = doc.getElementById('frontSelBtn'), b = mountBack(); if (fb && b && b.style.display !== fb.style.display) b.style.display = fb.style.display; }
    function go() {
      // 본문 함수는 본문 스크립트가 돈 뒤(DOMContentLoaded)에야 있다 — 그림 요소 ↔ 자료(drawingEl) · «맨 뒤» 보임(updateDelUI)
      var _el = win.drawingEl;
      if (typeof _el === 'function') win.drawingEl = function (d) { var g = _el.apply(this, arguments); try { if (g) g.__psD = d; } catch (_) {} return g; };
      try { var L = layer(), ds = draws(); if (L && L.children && L.children.length === ds.length) Array.prototype.forEach.call(L.children, function (g, i) { g.__psD = ds[i]; }); } catch (_) {}   // 부팅 중 그린 것
      mountBack();
      var _u = win.updateDelUI;
      if (typeof _u === 'function') win.updateDelUI = function () { var r = _u.apply(this, arguments); try { syncBack(); } catch (_) {} return r; };
      syncBack();
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();

    var api = { open: open, close: close, isOpen: function () { return !!menu; }, el: function () { return menu; }, back: mountBack };
    win.__psShapeMenu = api;
    return api;
  }

  var api = { name: name, clampLw: clampLw, clampOp: clampOp, isRightClick: isRightClick, findDrawing: findDrawing, targets: targets, place: place, css: css, install: install };
  if (typeof window !== 'undefined' && window.document) { try { install(window); } catch (_) {} }
  return api;
});
