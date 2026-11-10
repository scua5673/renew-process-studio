/* PROCESS STUDIO — 작전판으로 돌아오기는 편집이 아니다(3.274)
   다른 앱(보관함 · 팀 운영 …)에 갔다 작전판으로 돌아오면 boardShowDefault 가 판을 다시 그리고(setView → renderTokens · renderDrawings),
   그 그리기 끝의 boardSaveLive 가 «고친 판»으로 세어 _boardPrivateEditSeq · _boardManualDirty 가 올랐다 — 아무것도 안 고쳤는데
   새로고침 · 닫기에 «사이트에서 나가시겠습니까?»가 뜨고 저장 상태가 «변경 있음»이 됐다(직접 써 보기에서 찾음 — 폰 보기 전용 판도).
   3.190 이 저장본 페이지의 지연 적용(_consumePending)에 한 것과 같은 방법: 그 동기 구간만 __capLock 을 세웠다 돌려놓는다.
   실제 입력 · 소유자 · seq · CAS 장벽은 그대로다(잠금은 이 호출 안에서만, 원래 값으로 되돌린다). */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSBoardShowQuiet = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  function wrap(win) {
    var orig = win.boardShowDefault;
    if (typeof orig !== 'function' || orig.__psQuiet) return false;
    var quiet = function () {
      var lock = win.__capLock; win.__capLock = 1;
      try { return orig.apply(this, arguments); } finally { win.__capLock = lock; }
    };
    quiet.__psQuiet = 1; win.boardShowDefault = quiet; return true;
  }
  function install(win) {
    var doc = win.document;
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { wrap(win); });
    else wrap(win);
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) install(window);
  return { wrap: wrap, install: install };
});
