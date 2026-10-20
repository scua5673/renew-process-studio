/* PROCESS STUDIO — 훈련 편집기의 평면 · 3D 를 훈련마다(3.120).
   사용자 «훈련 편집 들어가면 기본은 평면보드로 나오게» · «보드설정에서 수정을 하면 각각 저장이 되게».
   · 기본은 평면: 일정 · 세션에서 열 때(openEditor — 3.035)뿐 아니라 보관함에서 훈련을 열 때(openLibDrawEditor)도 평면.
     예전엔 3.035 의 평면 처리가 openEditor 에만 있어, 3D 로 쓰는 기기에서 보관함 훈련은 3D 로 열렸다.
   · 편집기 안에서 평면 · 3D 를 바꾸면(보드 설정 · 위쪽 막대) 그 훈련에만 저장된다. 기기 설정(ps_board_tilt3d)은 그대로라
     다른 훈련 · 작전판은 바뀌지 않는다. 값은 다른 보드 설정과 같은 길 — look 확장 edTilt(장면 스냅에 실려 임시본 · 보관함 저장에 같이 간다).
     선수 모양 · 칩 글자 · 입체 칩 같은 다른 보드 설정은 2.929 부터 훈련마다 저장된다.
   · 3D 로 저장한 훈련도 폰 · 아이패드에서는 평면으로 연다(3.069 — 아이폰이 3D 로 열다 꺼졌다). 그 훈련의 값은 지우지 않는다.
   · 나가면 들어오기 전 보기로 돌아간다.
   ⚠ look 확장은 본문 스크립트(부팅 복원)보다 먼저 있어야 한다 — 이 파일은 본문 앞에서 읽힌다. 감싸기는 DOMContentLoaded 뒤. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSEditView = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var TOLD = 'ps_editor_flat_told';
  // 훈련을 열 때 보일 보기: 저장한 3D 는 3D 를 저절로 켜도 되는 기기(데스크톱)에서만
  function target(want, desk) { return want === true && !!desk; }
  function isDesk(win) {
    try { var d = win.top.document.documentElement.getAttribute('data-ps-device'); if (d) return d === 'desktop'; } catch (_) {}
    try { return !((win.navigator && win.navigator.maxTouchPoints) > 0); } catch (_) { return true; }
  }

  function install(win) {
    if (!win || !win.document || win.__psEditView) return null;
    win.__psEditView = true;
    var doc = win.document, want = false, dev = null, busy = false;
    var ext = win.__psLookExt || (win.__psLookExt = {});
    ext.edTilt = { def: false, ok: function (v) { return typeof v === 'boolean'; } };
    function has(c) { var b = doc.body; return !!b && b.classList.contains(c); }
    function editing() { return has('editing'); }
    function tilt() { return has('bc-tilt3d'); }
    function setTilt(on) {
      var f = win.__setTilt; if (typeof f !== 'function') return false;
      busy = true; try { f.call(win, !!on, { transient: true, quiet: true }); } catch (_) {} busy = false; return true;
    }
    // 이 훈련의 보기를 판에. 처음 바꾸기 전에 들어오기 전 보기를 기억한다(나갈 때 돌린다)
    function show() {
      if (!editing() || has('comm-viewing')) return;
      var on = target(want, isDesk(win));
      if (on === tilt() || typeof win.__setTilt !== 'function') return;
      if (dev === null) dev = tilt();
      setTilt(on);
    }
    // 작전판이 lookNow · lookApply 에서 읽고 쓰는 값(훈련 · 장면 스냅의 edTilt)
    try {
      Object.defineProperty(win, '__edTilt', { configurable: true,
        get: function () { return want; },
        set: function (v) { want = v === true; show(); } });
    } catch (_) {}

    function toldOnce() {
      try { if (win.localStorage.getItem(TOLD) === '1') return; win.localStorage.setItem(TOLD, '1'); } catch (_) { return; }
      win.setTimeout(function () { try { win.toast('훈련 편집기는 평면으로 열려요 — 나가면 3D 로 돌아갑니다'); } catch (_) {} }, 600);
    }
    function wrapOpen(name) {
      var f = win[name]; if (typeof f !== 'function' || f.__psEditView) return !!(f && f.__psEditView);
      var g = function () {
        var was = editing(); if (!was) dev = tilt();   // 들어오기 전 보기(3.035 가 평면으로 바꾸기 전)
        var r = f.apply(this, arguments);
        var after = function () {
          if (!editing()) { if (!was) dev = null; return; }
          show(); if (!was && dev && !tilt()) toldOnce();
        };
        if (r && typeof r.then === 'function') r.then(after, after); else after();
        return r;
      };
      g.__psEditView = 1; win[name] = g; return true;
    }
    function wrapClose() {
      var c = win.closeEditor; if (typeof c !== 'function' || c.__psEditView) return !!(c && c.__psEditView);
      var g = function () {
        var r = c.apply(this, arguments);
        try { if (!editing() && dev !== null) { var d = dev; dev = null; if (tilt() !== d) setTilt(d); } } catch (_) {}
        return r;
      };
      g.__psEditView = 1; win.closeEditor = g; return true;
    }
    // 편집기 안에서 고른 평면 · 3D = 이 훈련의 값. 기기 설정은 쓰지 않는다(transient)
    function wrapTilt() {
      var st = win.__setTilt; if (typeof st !== 'function' || st.__psEditView) return !!(st && st.__psEditView);
      var g = function (on, opts) {
        opts = opts || {};
        if (busy || opts.transient || !editing() || has('comm-viewing')) return st.apply(this, arguments);
        if (dev === null) dev = tilt();
        want = !!on;
        var r = st.call(this, !!on, { transient: true, quiet: true });
        if (!opts.quiet) { try { win.toast(on ? '3D 보기 — 이 훈련에 저장돼요' : '평면 보기 — 이 훈련에 저장돼요'); } catch (_) {} }
        // 임시본에도 바로 — 기다렸다 쓰면(0.6초) 고르고 곧 닫을 때 빠진다
        try { if (typeof win.saveEditorDraft === 'function') win.saveEditorDraft(); else if (typeof win._schedEditorDraft === 'function') win._schedEditorDraft(); } catch (_) {}
        return r;
      };
      g.__psEditView = 1; win.__setTilt = g; return true;
    }
    // 감싸기는 본문 스크립트가 함수를 만든 뒤(DOMContentLoaded). 값(접근자)은 지금 — 부팅 복원(lookApply)이 이미 쓴다
    var tries = 0;
    function hook() {
      var ok = wrapTilt() & wrapOpen('openEditor') & wrapOpen('openLibDrawEditor') & wrapClose();
      if (editing()) show();   // 부팅 때 이미 열린 편집기(임시본 복구)
      if (!ok && ++tries < 40) win.setTimeout(hook, 250);
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', hook); else hook();
    return { show: show, want: function () { return want; }, dev: function () { return dev; } };
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) install(window);
  return { target: target, isDesk: isDesk, install: install };
});
