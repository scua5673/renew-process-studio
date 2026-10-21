/* PROCESS STUDIO — 경기 화면의 글 칸은 «팀 자료 확인 중»에도 받아 둔다(3.135 제보 0ce6d0cc «경기준비 글씨 넣는 상자에 글씨가 안넣어집니다»).
   경기 문서는 동기화가 서버 원문을 확인하기 전(matchDocPending — 회차가 보관함 편집에 밀려 끝나지 못하면 몇 분씩)에는 보기 전용이다:
   그 사이 글 칸에 쓴 글은 저장되지 않고(matchCanEdit 거짓 → 입력 처리가 그냥 끝난다) 다음 그리기(renderMatch) 때 사라졌다.
   그리고 나면 칸이 잠겨(.match-shell.readonly · disabled) 눌러지지도 않았다 — 상태 줄의 «팀 자료 확인 중 · 잠시만요»는 글 칸과 멀어 못 봤다.
   · 막힌 까닭이 «확인 중»뿐이면(역할 · 담당은 괜찮다) 글 칸(textarea · 글 input)은 열어 두고, 쓴 글은 경기마다 받아 둔다(hold).
     matchSetFields 가 다시 그려도 받아 둔 글을 칸에 돌려놓는다. 상태 줄은 «팀 자료 확인 중 · 입력한 글은 확인되면 저장돼요».
   · 확인이 끝나(matchCanEdit) 1.2초 안에 받아 둔 글을 그 경기 문서에 넣고 저장한다(matchQueueSave) — 서버 확인본 위에 코치가 방금 쓴 글이 올라간다.
   · 체크 · 고르개 · 날짜 · 점수 칸은 그대로(확인 뒤에). 선수 역할 · 남의 담당 경기는 예전처럼 잠긴다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSMatchEditHold = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var TEXT = /^(text|search|url|tel|email)$/;
  var MSG_HOLD = '팀 자료 확인 중 · 입력한 글은 확인되면 저장돼요', MSG_DONE = '팀 자료 확인이 끝나 입력한 글을 저장했어요';
  var CSS = '.match-shell.readonly.ps-hold [data-match-field]{pointer-events:auto!important}';
  // 받아 둘 칸: 글 칸만(textarea · 글 input). 날짜는 일정이 정한다
  function fieldOk(el) {
    if (!el || !el.getAttribute || !el.hasAttribute('data-match-field')) return false;
    if (el.getAttribute('data-match-field') === 'date') return false;
    return el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT.test(String(el.type || 'text').toLowerCase()));
  }
  // 받아 둔 글을 문서에 넣는다 — 넣은 칸 수
  function applyHold(m, h) { var n = 0; if (!m || !h) return 0; Object.keys(h).forEach(function (k) { m[k] = h[k]; n++; }); return n; }

  function install(win) {
    if (!win || !win.document || win.__psMatchHold) return null;
    var doc = win.document, hold = {}, poll = 0;
    function g(n) { var f = win[n]; return typeof f === 'function' ? f : null; }
    function call(n) { var f = g(n); try { return f ? f.apply(null, Array.prototype.slice.call(arguments, 1)) : undefined; } catch (_) { return undefined; } }
    function curId() { var m = call('matchGet'); return (m && m.id) || ''; }
    // 역할 · 담당으로는 고칠 수 있는가(막힌 까닭이 «팀 자료 확인 중»뿐인가)
    function roleOk() {
      try {
        if (win.PSPerms && typeof win.PSPerms.canEdit === 'function' && !win.PSPerms.canEdit('team')) return false;
        if (call('matchRole') === 'player') return false;
        if (g('matchIsExec') && !call('matchIsExec')) { var o = call('matchOwner', curId()); if (o && o !== call('myUid')) return false; }
        return true;
      } catch (_) { return false; }
    }
    function holdOn() { return !!call('matchDocPending') && roleOk(); }
    function say(t) { call('matchSayState', t, false); }
    function paint(on) { var s = doc.querySelector('.match-shell'); if (s && s.classList.contains('ps-hold') !== on) s.classList.toggle('ps-hold', on); }
    function css() { if (doc.getElementById('psMatchHoldCss')) return; var st = doc.createElement('style'); st.id = 'psMatchHoldCss'; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st); }
    // matchSetFields 뒤 — 확인 중이면 글 칸을 열고 받아 둔 글을 돌려놓는다
    function after(m, readonly) {
      var on = !!readonly && holdOn(); paint(on); if (!on) return;
      var h = (m && hold[m.id]) || {};
      Array.prototype.forEach.call(doc.querySelectorAll('[data-match-field]'), function (el) {
        if (!fieldOk(el)) return; el.disabled = false;
        var k = el.getAttribute('data-match-field'); if (h[k] != null && el.value !== h[k]) el.value = h[k];
      });
      if (Object.keys(h).length) say(MSG_HOLD);
    }
    function wrap() {
      var f = g('matchSetFields'); if (!f) return false; if (f.__psHold) return true;
      var w = function (m, readonly) { var r = f.apply(this, arguments); try { after(m, readonly); } catch (_) {} return r; };
      w.__psHold = 1; win.matchSetFields = w; return true;
    }
    function onInput(e) {
      var el = e.target; if (!fieldOk(el)) return;
      if (call('matchCanEdit')) return;   // 보통 때 — 경기 화면이 제 손으로 저장한다
      if (!holdOn()) return;
      var id = curId(); if (!id) return;
      (hold[id] = hold[id] || {})[el.getAttribute('data-match-field')] = el.value;
      say(MSG_HOLD);
      if (!poll) poll = win.setInterval(flush, 1200);
    }
    // 확인이 끝났으면 받아 둔 글을 그 경기에 넣고 저장한다(지금 연 경기 것만 — 다른 경기 것은 그 경기를 열 때)
    function flush() {
      if (!Object.keys(hold).length) { if (poll) win.clearInterval(poll); poll = 0; return 0; }
      if (!call('matchCanEdit')) return 0;
      var m = call('matchGet'); if (!m || !hold[m.id]) return 0;
      var h = hold[m.id]; delete hold[m.id];
      var n = applyHold(m, h);
      call('matchQueueSave');
      try { if (g('renderMatch')) call('renderMatch'); else win.matchSetFields(m, false); } catch (_) {}   // 틀(readonly)도 지금 상태로 다시

      try { if (typeof win.toast === 'function') win.toast(MSG_DONE); } catch (_) {}
      if (!Object.keys(hold).length) { if (poll) win.clearInterval(poll); poll = 0; }
      return n;
    }
    var tries = 0;
    (function boot() { css(); if (!wrap() && ++tries < 40) win.setTimeout(boot, 250); })();
    doc.addEventListener('input', onInput);
    var api = { hold: hold, flush: flush, holdOn: holdOn, roleOk: roleOk };
    win.__psMatchHold = api; return api;
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/scout\.html/.test(String(window.location && window.location.pathname))) {
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', function () { install(window); }); else install(window);
  }
  return { install: install, fieldOk: fieldOk, applyHold: applyHold, MSG_HOLD: MSG_HOLD, MSG_DONE: MSG_DONE, CSS: CSS };
});
