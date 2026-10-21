/* PROCESS STUDIO — 작업 보드 «저장»이 보관함에 담을지 다시 묻는 길(3.137, 오류 제보 0917a39f «저장 누르면 연결된 보관함에 저장이 된다고 했는데
   그런 설정이 없고 보관함에 작성한 보드가 저장이 안 됩니다»).
   «저장»(board.html boardSaveOne, 3.077)은 보드를 저장한 뒤 «저장 정보 확인» 창으로 보관함에 담을지 묻는다. 그런데
   · 창을 한 번 닫으면(«계속 편집» · 바깥 누름) 앱을 다시 열 때까지 다시 묻지 않았다 — 화면 어디에도 그렇게 말하지 않았고, 단추 설명은 여전히 «물어요»였다.
     데스크톱에는 보관함 창으로 가는 다른 길이 없다(«보관함 저장» 단추는 3.077 부터 숨김).
   · 빈 판 판정이 지금 페이지만 봤다 — 여러 페이지 보드의 빈 페이지에서 «저장»하면 다른 페이지에 내용이 있어도 묻지 않았다.
   · 단추 설명 «보관함 자료와 이어져 있으면 그 자료에도 저장해요»가 «연결 설정»이 있는 것처럼 읽혔다 — 이음은 «보드 가져오기»로 가져온 페이지뿐이다.
   이제: 닫은 뒤에도 바뀐 것 없이 «저장»을 한 번 더 누르면 다시 묻는다(편집하고 저장할 때마다 묻지는 않는다 — 3.077 그대로) ·
   닫으면 알림이 그 길을 말한다 · 다른 페이지에 내용이 있으면 빈 판이 아니다 · 단추 설명을 바로잡는다.
   board.html 은 크기 예산이 차서 고치지 않고 감싼다: boardSaveOne · _boardSnapEmpty · boardManualChanged · boardManualStatus 는 function 선언,
   _boardVaultDeclined 는 var(둘 다 window 속성), window.__vaultSave 는 본문이 넣는다. 본문보다 먼저 읽히므로 DOMContentLoaded 에 감싼다
   (board-guest.js 가 본문 안에서 먼저 감싼 저장 함수를 다시 감싼다 — 게스트는 그쪽이 보관함을 묻지 않는다). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSBoardSaveAsk = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var DECLINED = '보드에 저장됨 ✓ · 보관함에 담으려면 «저장»을 한 번 더 누르세요';
  var TIP_OLD = '보관함 자료와 이어져 있으면 그 자료에도 저장해요(아니면 보관함에 담을지 물어요)';
  var TIP_NEW = '«보드 가져오기»로 가져온 페이지면 그 보관함 자료에도 저장해요(아니면 보관함에 담을지 물어요 — 창을 닫았으면 «저장»을 한 번 더)';
  // 페이지에 담을 것이 있는가 — 선수 · 장비 · 그림, 또는 장면 둘 이상(board-import-safe.js hasContent 와 같은 셈)
  function pageHasContent(p) {
    if (!p || typeof p !== 'object') return false;
    var n = function (a) { return Array.isArray(a) ? a.length : 0; }, s = p.snap || {};
    return n(s.players) > 0 || n(s.equipment) > 0 || n(s.drawings) > 0 || (!!p.anim && n(p.anim.frames) > 1);
  }
  // 지금 페이지 말고 다른 페이지에 내용이 있는가
  function otherPagesContent(pages, cur) {
    if (!Array.isArray(pages) || pages.length < 2) return false;
    for (var i = 0; i < pages.length; i++) if (i !== cur && pageHasContent(pages[i])) return true;
    return false;
  }
  function tip(t) { return typeof t === 'string' && t.indexOf(TIP_OLD) >= 0 ? t.replace(TIP_OLD, TIP_NEW) : t; }

  function install(win) {
    if (!win || !win.document || win.__psSaveAsk) return null;
    win.__psSaveAsk = true;
    var doc = win.document;
    function say(m) { try { if (typeof win.toast === 'function') win.toast(m); } catch (_) {} }
    function others() {
      try {
        var P = win.__psPages, pg = P && typeof P.pg === 'function' ? P.pg() : null, cur = 0;
        try { cur = P.pageInfo().idx; } catch (_) {}
        return otherPagesContent(pg, cur);
      } catch (_) { return false; }
    }
    function wrapSave() {
      var f = win.boardSaveOne; if (typeof f !== 'function') return false; if (f.__psAsk) return true;
      var g = function () {
        // 창을 닫은 뒤 — 바뀐 것 없이 또 누르면(보드는 이미 저장됐다) 보관함에 담을지 다시 묻는다
        try { if (win._boardVaultDeclined === true && typeof win.boardManualChanged === 'function' && !win.boardManualChanged()) win._boardVaultDeclined = false; } catch (_) {}
        // 빈 판 판정(본문은 지금 페이지만 본다) — 다른 페이지에 내용이 있으면 그 한 번만 «빈 판 아님»
        var se = win._boardSnapEmpty, patched = false;
        if (typeof se === 'function' && others()) { win._boardSnapEmpty = function () { win._boardSnapEmpty = se; return false; }; patched = true; }
        try { return f.apply(this, arguments); } finally { if (patched && win._boardSnapEmpty !== se) win._boardSnapEmpty = se; }
      };
      g.__psAsk = 1; win.boardSaveOne = g;
      if (typeof win.__boardSaveOne === 'function') win.__boardSaveOne = g;
      return true;
    }
    function wrapVault() {
      var v = win.__vaultSave; if (typeof v !== 'function') return false; if (v.__psAsk) return true;
      var g = function (o) {
        if (o && typeof o.oncancel === 'function') {
          var oc = o.oncancel, n = {};
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) n[k] = o[k];
          n.oncancel = function () { var r = oc.apply(this, arguments); if (win._boardVaultDeclined === true) say(DECLINED); return r; };
          o = n;
        }
        return v.apply(this, [o].concat(Array.prototype.slice.call(arguments, 1)));
      };
      g.__psAsk = 1; win.__vaultSave = g; return true;
    }
    function wrapStatus() {
      var f = win.boardManualStatus; if (typeof f !== 'function') return false; if (f.__psAsk) return true;
      var g = function () {
        var r = f.apply(this, arguments);
        try { var b = doc.getElementById('boardManualSave'); if (b) { var t = tip(b.title); if (t !== b.title) b.title = t; } } catch (_) {}
        return r;
      };
      g.__psAsk = 1; win.boardManualStatus = g; return true;
    }
    var tries = 0;
    function hook() {
      var ok = wrapSave() & wrapVault() & wrapStatus();
      if (!ok && ++tries < 40) win.setTimeout(hook, 250);
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', hook); else hook();
    return { others: others };
  }

  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) window.__psSaveAskApi = install(window);
  return { DECLINED: DECLINED, TIP_OLD: TIP_OLD, TIP_NEW: TIP_NEW, tip: tip, pageHasContent: pageHasContent, otherPagesContent: otherPagesContent, install: install };
});
