/* PROCESS STUDIO — 작전판 보관함 읽기 줄이기(3.090).
   아이폰 «문제가 반복적으로 발생»(2026-10-18 03:23 KST 운영자 아이폰 · 서버 기록 boot_after_crash loadw0.lbok — 팀 보관함 149개 36MB):
   앱을 켜고 5초 안에 강제 종료가 되풀이됐다. 같은 크기의 가상 보관함으로 재현하면(폰 화면 · Chromium) 숨은 작전판이 켜진 뒤 18초 동안
   보관함 전체를 26번 읽어(한 번에 IndexedDB 문자열 ~70MB + JSON.parse) 렌더러 메모리가 1.6GB 까지 올랐다. 까닭은 셋이다.
   ① psVaultAuthChanged 한 번이 renderDrillFiles · renderLibDock(그 안에서 renderDrillFiles 를 또) 으로 보관함을 세 번 읽는데,
      셸은 부팅 중에 같은 «로그인 상태»를 여러 번 보낸다(iframe 이 뜰 때마다 · 자료 확인 때마다) — 상태가 그대로여도 매번 다시 읽었다.
   ② 동시에 들어온 그리기 읽기(psVaultReadForRender)가 저마다 보관함 전체를 읽었다.
   ③ 폰 첫 화면은 팀운영(작전판 iframe 은 display:none)인데, 보이지 않는 작전판이 보관함을 그리고 썸네일까지 다시 써 넣었다(전체 읽기 + 쓰기 + 확인 읽기).
   그래서 작전판의 함수 선언(window 속성)을 감싼다(board-tweaks.js 와 같은 방식 — eval 없이). 작전판 본 스크립트가 init() 바로 앞에서
   PSVaultReads.install(window) 를 부른다 — 부팅 중 첫 그리기(init → renderLibDock)부터 감싼 것을 타게(DOMContentLoaded 는 늦다 — 그 전에 그린다):
   ① 계정 · 팀이 그대로면 «로그인 상태» 알림에 다시 그리지 않는다. 잠기면(psVaultShowLock) 잊어서 풀릴 때 다시 그린다.
      보관함 내용이 바뀐 것은 cs_lib_rev(storage) · 쓰기 뒤 render* 가 따로 그린다 — 이 문은 그대로다.
   ② 같이 들어온 그리기 읽기는 한 번만 읽어 나눠 준다 — 그 사이 새 차례(libTurn · 쓰기)가 없고 계정 · 팀 · 보관함 판(cs_lib_rev)이 같을 때만.
      그린 목록은 읽기 전용이다(고쳐 쓰는 곳은 libFix 로 자기 차례에 새로 읽는다 — 2.991). 끝난 읽기는 나눠 주지 않는다.
   ③ 작전판 iframe 이 숨어 있으면(셸이 준 style display:none) 보관함을 그리지 않고 미뤄 둔다. 셸이 보이게 하는 순간(style 바뀜) 한 번 그린다.
      지켜볼 수 없으면(frameElement · MutationObserver 없음) 예전대로 바로 그린다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSVaultReads = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  // ② 진행 중인 읽기 하나를 나눠 준다. key = 계정|팀|보관함 판, tail = 읽기를 연 뒤의 차례 꼬리(그 뒤 새 차례가 생기면 달라진다)
  function createShare() {
    var cur = null;
    return function read(key, tailNow, start) {
      if (cur && cur.key === key && cur.tail === tailNow()) return cur.p;
      var p = start(), me = { key: key, tail: tailNow(), p: p };
      cur = me;
      var done = function () { if (cur === me) cur = null; };
      p.then(done, done);
      return p;
    };
  }

  // ① 마지막으로 그린 계정 · 팀
  function createGate() {
    var last = null;
    return {
      fresh: function (sig) { if (sig === last) return false; last = sig; return true; },
      reset: function () { last = null; }
    };
  }

  // ③ 셸이 iframe 에 준 display:none 만 본다(다른 까닭으로 가려진 것은 «보인다» — 예전대로 그린다)
  function frameHidden(win) {
    try { var fe = win.frameElement; return !!(fe && fe.style && fe.style.display === 'none'); } catch (_) { return false; }
  }
  function createLater(win, flush) {
    var obs = null, pending = false;
    function watch() {
      if (obs) return true;
      try {
        var fe = win.frameElement, MO = win.MutationObserver;
        if (!fe || typeof MO !== 'function') return false;
        obs = new MO(function () {
          if (frameHidden(win)) return;
          try { obs.disconnect(); } catch (_) {}
          obs = null;
          if (!pending) return;
          pending = false;
          flush();
        });
        obs.observe(fe, { attributes: true, attributeFilter: ['style'] });
        return true;
      } catch (_) { obs = null; return false; }
    }
    return {
      // 숨어 있고 지켜볼 수 있으면 미루고 true
      defer: function () { if (!frameHidden(win) || !watch()) return false; pending = true; return true; },
      pending: function () { return pending; }
    };
  }

  function call(win, name) { try { if (typeof win[name] === 'function') return win[name](); } catch (_) {} }
  function uidWid(win) {
    var u = '', w = '';
    try { u = String(win.psMyUid() || ''); } catch (_) {}
    try { w = String((win.psActiveWs() || {}).id || ''); } catch (_) {}
    return u + '|' + w;
  }

  function install(win) {
    if (!win || win.__psVaultReads) return false;
    var need = ['psVaultReadForRender', 'psVaultAuthChanged', 'psVaultShowLock', 'psVaultRenderReady', 'psVaultUnlocked'];
    for (var i = 0; i < need.length; i++) if (typeof win[need[i]] !== 'function') return false;
    win.__psVaultReads = true;
    var doc = win.document;

    // ② 그리기 읽기 나눠 쓰기
    var share = createShare(), origRead = win.psVaultReadForRender;
    win.psVaultReadForRender = function () {
      if (!('_libTurnTail' in win)) return origRead.apply(this, arguments);   // 차례 꼬리를 못 보면 나눠 주지 않는다(쓰기 뒤의 옛 목록을 줄 수 있다)
      var rev = '';
      try { rev = win.localStorage.getItem('cs_lib_rev') || ''; } catch (_) {}
      var self = this, args = arguments;
      return share(uidWid(win) + '|' + rev, function () { return win._libTurnTail; }, function () { return origRead.apply(self, args); });
    };

    // ③ 숨은 작전판은 미뤘다가 보일 때 한 번
    var later = createLater(win, function () {
      call(win, 'renderDrillFiles');
      call(win, 'renderLibDock');
      try { var dl = doc.getElementById('drillLib'); if (dl && dl.classList.contains('on')) call(win, 'renderLib'); } catch (_) {}
      call(win, 'updateLibSelBar');   // 선택 모드면 담은 판(renderLibTray)도
    });
    var origReady = win.psVaultRenderReady;
    win.psVaultRenderReady = function () {
      if (later.defer()) return false;
      return origReady.apply(this, arguments);
    };

    // ① 같은 계정 · 팀이면 다시 그리지 않는다
    var gate = createGate(), origShow = win.psVaultShowLock, origAuth = win.psVaultAuthChanged;
    win.psVaultShowLock = function () { gate.reset(); return origShow.apply(this, arguments); };
    var auth = function () {
      var open = false;
      try { open = !!win.psVaultUnlocked(); } catch (_) {}
      if (!open) { gate.reset(); return origAuth.apply(this, arguments); }
      if (gate.fresh(uidWid(win))) return origAuth.apply(this, arguments);
      try { if (typeof win.vaultBoardCheckOwner === 'function') win.vaultBoardCheckOwner(); } catch (_) {}
      try { if (typeof win.psVaultHideLock === 'function') win.psVaultHideLock(); } catch (_) {}
    };
    win.psVaultAuthChanged = auth;
    // 작전판이 함수 그대로 건 귀(pageshow · focus)도 감싼 것으로 바꾼다. 이름으로 부르는 곳(셸 메시지 · storage)은 위 대입으로 바뀐다.
    // 뒤로 가기 캐시에서 돌아온 페이지(pageshow persisted)는 그동안 storage 알림을 못 받았으니 다시 그린다.
    var onShow = function (e) { if (e && e.persisted) gate.reset(); return auth.apply(this, arguments); };
    try {
      win.removeEventListener('pageshow', origAuth); win.addEventListener('pageshow', onShow);
      win.removeEventListener('focus', origAuth); win.addEventListener('focus', auth);
      if (doc && doc.readyState === 'loading') { doc.removeEventListener('DOMContentLoaded', origAuth); doc.addEventListener('DOMContentLoaded', auth); }
    } catch (_) {}
    return true;
  }

  return { createShare: createShare, createGate: createGate, createLater: createLater, frameHidden: frameHidden, install: install };
});
