/* PROCESS STUDIO — 새 미팅은 평면으로 연다(3.128). 사용자 «미팅만들기 들어가면 평면에 15존에 네이비 피치로».
   · 네이비 · 15존은 판(스냅)의 값이라 board.html 의 기본 9장(meetTplSnap) · 경기 미팅의 바탕 · board-meet-8.js 8인제 9장에서 정한다.
   · 평면 · 3D 는 기기의 보기(ps_board_tilt3d)라 판에 실리지 않는다 — 이 모듈이 새 미팅을 만든 순간(보관함 «미팅 만들기» = __meetSeed,
     경기 «＋ 새 미팅» = __meetingFromMatch) 3D 였으면 평면으로 바꾼다. 기기 설정은 그대로(transient) — 미팅을 나가면 들어오기 전 보기로 돌아간다.
     미팅 안에서 코치가 직접 평면 · 3D 를 고르면 그 선택이 이긴다(나갈 때 되돌리지 않는다).
   · 이미 만든 미팅을 다시 여는 것은 건드리지 않는다. 훈련 편집기의 같은 일은 board-edit-view.js(3.120). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSMeetLook = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // 새 미팅의 판 모양 — board.html · board-meet-8.js 와 같은 값(시험이 셋을 견준다)
  var LOOK = { pitchTheme: '', pitchCustom: null, pitchImg: null, gridType: 'grid15' };

  function install(win) {
    if (!win || !win.document || win.__psMeetLook) return null;
    win.__psMeetLook = true;
    var doc = win.document, dev = null, busy = false;
    function has(c) { var b = doc.body; return !!b && b.classList.contains(c); }
    function tilt() { return has('bc-tilt3d'); }
    function setTilt(on) {
      var f = win.__setTilt; if (typeof f !== 'function') return;
      busy = true; try { f.call(win, !!on, { transient: true, quiet: true }); } catch (_) {} busy = false;
    }
    // 새 미팅 — 3D 였으면 평면으로(처음 한 번만 들어오기 전 보기를 기억한다)
    function flat() {
      if (!has('meet-mode') || has('comm-viewing')) return;
      if (dev === null) dev = tilt();
      if (tilt()) setTilt(false);
    }
    function restore() {
      if (dev === null) return;
      var d = dev; dev = null;
      if (d && !tilt()) setTilt(true);
    }
    function wrapSeed() {
      var f = win.__meetSeed; if (typeof f !== 'function') return false; if (f.__psMeetLook) return true;
      var g = function () { var r = f.apply(this, arguments); if (r === true) flat(); return r; };
      g.__psMeetLook = 1; win.__meetSeed = g; return true;
    }
    function wrapMatch() {
      var f = win.__meetingFromMatch; if (typeof f !== 'function') return false; if (f.__psMeetLook) return true;
      var g = function () {
        var r = f.apply(this, arguments);
        Promise.resolve(r).then(function (ok) { if (ok) flat(); }, function () {});
        return r;
      };
      g.__psMeetLook = 1; win.__meetingFromMatch = g; return true;
    }
    // 미팅 안에서 코치가 고른 보기는 그대로 둔다
    function wrapTilt() {
      var st = win.__setTilt; if (typeof st !== 'function') return false; if (st.__psMeetLook) return true;
      var g = function (on, opts) { if (!busy && !(opts && opts.transient) && has('meet-mode')) dev = null; return st.apply(this, arguments); };
      g.__psMeetLook = 1; win.__setTilt = g; return true;
    }
    // 미팅을 나가면(meet-mode 가 걷히면) 들어오기 전 보기로 — 클래스는 읽기만 한다(바꾸면 감시가 끝없이 돈다)
    function watch() {
      try {
        if (!doc.body || !win.MutationObserver) return;
        new win.MutationObserver(function () { if (dev !== null && !has('meet-mode')) restore(); })
          .observe(doc.body, { attributes: true, attributeFilter: ['class'] });
      } catch (_) {}
    }
    var tries = 0;
    function hook() {
      var ok = wrapSeed() & wrapMatch() & wrapTilt();
      if (!ok && ++tries < 40) win.setTimeout(hook, 250);
    }
    function start() { watch(); hook(); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
    return { flat: flat, restore: restore, dev: function () { return dev; } };
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) install(window);
  return { LOOK: LOOK, install: install };
});
