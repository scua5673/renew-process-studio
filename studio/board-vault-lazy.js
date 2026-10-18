/* PROCESS STUDIO — 숨은 작전판은 보관함을 그리지 않는다(3.095).
   사용자 «핸드폰으로 웹앱으로 설치하면 자꾸 안돼». 서버 기록(10/16~18, boot_after_crash 스무 번 남짓)은 모두 아이폰 설치 앱이었고,
   앱을 새로 열 때마다 켜진 지 5초 안에 강제 종료됐다. 폰은 팀운영 › 오늘로 열리고 작전판(board.html)은 숨은 채 같이 부팅하는데,
   숨은 보관함이 로그인 · 동기화 알림마다 다시 그리며 보관함 통째(그 팀은 21MB)를 10초에 24번 읽고 해석했다(크로미움 실측 메모리 0.9GB).
   작전판 틀(셸의 #fBoard)이 숨어 있으면 보관함 그리기 읽기를 미뤄 두고, 틀이 보이는 순간 한 번 그린다.
   데스크톱처럼 작전판이 보이는 부팅 · 셸 밖에서 연 작전판 · 커뮤니티 곁 보드는 그대로다. 보관함 자료에는 손대지 않는다(그리는 때만 늦춘다).
   board.html 은 두 곳에서 window.__psVaultDefer() 를 묻는다: 그리기 읽기(psVaultRenderRead) · 작성자 채우기(maybeBackfillCreators — 미루면 이번에 다시 돈다). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSBoardVaultLazy = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  /* 틀이 화면에 상자를 하나도 갖지 않으면(자신이나 위가 display:none) 숨음. visibility:hidden 은 보이는 것으로 친다(예전처럼 그린다) */
  function frameHidden(fe) {
    try { return !!fe && typeof fe.getClientRects === 'function' && fe.getClientRects().length === 0; } catch (_) { return false; }
  }

  function mount(win) {
    var fe = null, pdoc = null, pwin = null;
    try { fe = win.frameElement; pdoc = fe && fe.ownerDocument; pwin = pdoc && pdoc.defaultView; } catch (_) { fe = null; }
    if (!fe || !pdoc || !pwin) return null;   /* 셸 밖(작전판 단독) — 그대로 */
    if (/[?&]community_view=1/.test(String(win.location && win.location.search || ''))) return null;   /* 커뮤니티 곁 보드 */
    var pending = false, timer = 0, mo = null;
    function stop() {
      if (timer) { win.clearInterval(timer); timer = 0; }
      if (mo) { try { mo.disconnect(); } catch (_) {} mo = null; }
    }
    /* 미룬 그리기를 한 번에 — 보관함이 바뀌었을 때(storage cs_lib_rev)와 같은 묶음 */
    function flush() {
      if (!pending || frameHidden(fe)) return;
      pending = false; stop();
      try { if (typeof win.renderDrillFiles === 'function') win.renderDrillFiles(); } catch (_) {}
      try { if (typeof win.renderLibDock === 'function') win.renderLibDock(); } catch (_) {}
      try { var dl = win.document.getElementById('drillLib'); if (dl && dl.classList.contains('on') && typeof win.renderLib === 'function') win.renderLib(); } catch (_) {}
      try { if (typeof win.renderLibTray === 'function') win.renderLibTray(); } catch (_) {}
    }
    function watch() {
      /* 셸이 틀의 style(display)을 바꾸거나 화면(data-ps-app)을 바꾸면 곧바로, 놓쳐도 0.6초마다 한 번 본다 */
      if (!mo) {
        try {
          mo = new pwin.MutationObserver(function () { win.setTimeout(flush, 0); });
          mo.observe(fe, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
          if (pdoc.body) mo.observe(pdoc.body, { attributes: true, attributeFilter: ['data-ps-app', 'class'] });
        } catch (_) { mo = null; }
      }
      if (!timer) timer = win.setInterval(flush, 600);
    }
    /* board.html 이 그리기 전에 묻는다 — 참이면 이번 그리기는 건너뛰고(읽지 않고) 보일 때 다시 그린다 */
    win.__psVaultDefer = function () {
      if (!frameHidden(fe)) return false;
      pending = true; watch(); return true;
    };
    win.addEventListener('pagehide', stop);
    return { flush: flush, pending: function () { return pending; } };
  }

  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) {
    try { mount(window); } catch (_) {}
  }
  return { frameHidden: frameHidden, mount: mount };
});
