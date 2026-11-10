/* PROCESS STUDIO — 숨은 작전판은 보관함을 그리지 않는다(3.095).
   사용자 «핸드폰으로 웹앱으로 설치하면 자꾸 안돼». 서버 기록(10/16~18, boot_after_crash 스무 번 남짓)은 모두 아이폰 설치 앱이었고,
   앱을 새로 열 때마다 켜진 지 5초 안에 강제 종료됐다. 폰은 팀운영 › 오늘로 열리고 작전판(board.html)은 숨은 채 같이 부팅하는데,
   숨은 보관함이 로그인 · 동기화 알림마다 다시 그리며 보관함 통째(그 팀은 21MB)를 10초에 24번 읽고 해석했다(크로미움 실측 메모리 0.9GB).
   작전판 틀(셸의 #fBoard)이 숨어 있으면 보관함 그리기 읽기를 미뤄 두고, 보관함 목록이 보이는 순간 한 번 그린다(3.146).
   셸 밖에서 연 작전판 · 커뮤니티 곁 보드는 그대로다. 보관함 자료에는 손대지 않는다(그리는 때만 늦춘다).
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

  /* 3.146 — 보드가 보여도 보관함 화면은 닫혀 있을 수 있다. 폰 부팅 중에는
     셸이 팀운영으로 바꾸기 전 짧게 보드가 보인다. 실제 목록을 열기 전에는 읽지 않는다. */
  function vaultHidden(win) {
    try {
      var doc = win.document, session = doc.getElementById('sessionView'), lib = doc.getElementById('drillLib');
      return !!session && frameHidden(session) && !(lib && lib.classList.contains('on'));
    } catch (_) { return false; }
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
      if (!pending || frameHidden(fe) || vaultHidden(win)) return;
      pending = false; stop();
      try { if (typeof win.renderDrillFiles === 'function') win.renderDrillFiles(); } catch (_) {}
      try { if (typeof win.renderLibDock === 'function') win.renderLibDock(); } catch (_) {}
      try { var dl = win.document.getElementById('drillLib'); if (dl && dl.classList.contains('on') && typeof win.renderLib === 'function') win.renderLib(); } catch (_) {}
      try { if (typeof win.renderLibTray === 'function') win.renderLibTray(); } catch (_) {}
      try { if (typeof win.maybeBackfillCreators === 'function') win.maybeBackfillCreators(); } catch (_) {}
    }
    function watch() {
      /* 셸이 틀의 style(display)을 바꾸거나 화면(data-ps-app)을 바꾸면 곧바로, 놓쳐도 0.6초마다 한 번 본다 */
      if (!mo) {
        try {
          mo = new pwin.MutationObserver(function () { win.setTimeout(flush, 0); });
          mo.observe(fe, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
          if (pdoc.body) mo.observe(pdoc.body, { attributes: true, attributeFilter: ['data-ps-app', 'class'] });
          if (win.document.documentElement) mo.observe(win.document.documentElement, { attributes: true, attributeFilter: ['data-csview'] });
          ['sessionView', 'drillLib'].forEach(function (id) {
            var el = win.document.getElementById(id);
            if (el) mo.observe(el, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
          });
        } catch (_) { mo = null; }
      }
      if (!timer) timer = win.setInterval(flush, 600);
    }
    /* board.html 이 그리기 전에 묻는다 — 참이면 이번 그리기는 건너뛰고(읽지 않고) 보일 때 다시 그린다 */
    win.__psVaultDefer = function () {
      if (!frameHidden(fe) && !vaultHidden(win)) return false;
      pending = true; watch(); return true;
    };
    win.addEventListener('pagehide', stop);
    return { flush: flush, pending: function () { return pending; } };
  }

  /* 읽는 중인 목록 같이 쓰기(제보 de2e508c 조사). psVaultRenderRead 는 «아직 시작 전»인 읽기만 같이 썼다 — 큰 보관함은 읽기 하나가 0.3초쯤 걸려,
     보관함을 열면 setView 그리기(0.03초)가 읽는 중에 이 파일의 flush(0.08초)가 또 읽기를 줄 세웠고, 저장 뒤 다시 그리기도 둘이었다. 읽기 하나가 렌더러 메모리를
     100~140MB 잠깐 올린다(합성 82개 20MB · 크로미움 /proc RSS). 이제 «읽는 중»인 읽기도 같이 쓴다(같은 Promise) — 그 사이 아무것도 안 바뀌었을 때만:
     이 판의 보관함 차례(_libTurnTail)가 그대로 · 이 판이 쓰지 않음(libWrite) · 바뀜 신호(cs_lib_rev — 이 판의 libSet · 동기화 libSave · 일정 · 플레이북이 찍는다)가 그대로 ·
     계정 · 팀 · 잠금이 그대로 · 로그인 알림(psVaultAuthChanged — 주인이 바뀌었을 수 있다, 3.176 시험이 그 읽기를 따로 센다)이 오지 않음.
     읽기가 끝나면 잊는다 — 끝난 목록은 같이 쓰지 않는다(다음 그리기는 예전처럼 새로 읽는다: 숨은 사이 끝난 읽기를 버리는 3.146 규칙 그대로).
     숨은 판(__psVaultDefer)은 원래 길 그대로(읽지 않는다). 쓰는 길은 건드리지 않는다. */
  function share(win) {
    var orig = win && win.psVaultRenderRead, write = win && win.libWrite, auth = win && win.psVaultAuthChanged;
    if (typeof orig !== 'function' || orig.__psShare) return null;
    var last = null, gen = 0, stats = { reads: 0, shared: 0 };
    function rev() { try { return win.localStorage.getItem('cs_lib_rev'); } catch (_) { return null; } }
    function own() {
      try { return String(win.psMyUid()) + '|' + String((win.psActiveWs() || {}).id) + '|' + (win.psVaultUnlocked() === true ? 1 : 0); } catch (_) { return null; }
    }
    if (typeof write === 'function') win.libWrite = function () { gen++; last = null; return write.apply(this, arguments); };
    if (typeof auth === 'function') win.psVaultAuthChanged = function () { gen++; last = null; return auth.apply(this, arguments); };
    var wrapped = function () {
      if (typeof win.__psVaultDefer === 'function' && win.__psVaultDefer()) { last = null; return orig.apply(this, arguments); }
      var r = rev(), o = own();
      if (last && o !== null && last.own === o && last.gen === gen && last.tail === win._libTurnTail && last.rev === r) { stats.shared++; return last.p; }
      var p = orig.apply(this, arguments), e = { p: p, own: o, gen: gen, tail: win._libTurnTail, rev: r };
      last = o === null ? null : e; stats.reads++;
      function done() { if (last === e) last = null; }
      Promise.resolve(p).then(done, done);
      return p;
    };
    wrapped.__psShare = 1; win.psVaultRenderRead = wrapped;
    return { stats: stats, drop: function () { last = null; } };
  }

  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) {
    try { mount(window); } catch (_) {}
    /* 이 파일은 작전판 본문보다 먼저 읽힌다 — psVaultRenderRead 가 생긴 뒤(문서가 다 읽힌 뒤)에 감싼다 */
    try { window.addEventListener('DOMContentLoaded', function () { try { window.__psVaultShare = share(window); } catch (_) {} }); } catch (_) {}
  }
  return { frameHidden: frameHidden, vaultHidden: vaultHidden, mount: mount, share: share };
});
