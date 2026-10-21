/* PROCESS STUDIO — 경기 화면이 잠겼을 때 말하고, 서버 확인 대기면 바로 다시 맞춘다(3.137, 오류 제보 0ce6d0cc «경기준비 글씨 넣는 상자에 글씨가 안 넣어집니다»).
   · 경기 화면(.match-shell.readonly)은 서버 확인 전(matchDocPending) · 선수 계정 · 팀 편집 권한 없음 · 다른 코치 담당 경기일 때 잠긴다.
     잠긴 칸은 pointer-events:none 이라 눌러도 아무 말이 없었다 — 그런데 칸을 감싼 <label>을 누르면 커서가 들어가 글이 써졌고,
     입력 처리기가 matchCanEdit() 로 버려 저장되지 않은 채 다시 그릴 때 사라졌다. 사용자에게는 «글씨가 안 넣어진다»였다.
   · 이제 잠긴 칸(과 그 label)을 누르거나 Tab 으로 들어가면 커서를 빼고 까닭을 알린다. 서버 확인 대기면 곧바로 다시 맞추기(PSSync.syncNow)를 부르고,
     까닭 한 줄(ps_events match_locked — 경기 준비표 · 거울 유무만, 내용 없음)을 남긴다. 잠금이 이미 풀렸는데 화면만 남은 것이면 다시 그린다.
   · 더 흔한 길(CI WebKit 에서 재현): 동기화 회차가 경기 문서를 만지는 동안(`matchDocPending` 참)은 화면이 잠기지 않은 채로도 본문 입력 처리기가
     글을 버리고(`matchCanEdit` 거짓), 회차가 끝나면 `syncMatchFromCloud` 가 `matchState=null; renderMatch()` 로 저장 전 글과 칸의 글을 함께 지웠다
     (focus 를 보지 않는다). 이제 친 글을 적어 두었다가(`typed`) 회차가 끝나면 모델에 다시 넣고 저장을 건다. `renderMatch` 를 감싸 쓰는 중인 칸은 지우지 않는다.
   scout.html 은 크기 예산이 거의 차서(tests/code-budget-3043) 여기 둔다. matchDocPending · matchRole · matchCanEdit · matchCanEditOne · __matchRefresh 는
   scout.html 의 function 선언(window 속성) — 이름으로 부른다. matchCurrent 는 let 전역이라 typeof 로 읽는다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSMatchLock = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var MATCH_KEY = 'cs_team_matches_v1';
  var TXT = {
    pending: '팀 경기 자료를 서버와 맞추는 중이에요 — 끝나면 바로 쓸 수 있어요',
    player: '선수 계정은 경기 준비를 볼 수만 있어요',
    perm: '팀 자료를 고칠 권한이 없어요',
    owner: '이 경기는 담당 코치만 고칠 수 있어요'
  };
  // 잠긴 칸 — scout.html 의 «.match-shell.readonly [data-match-field],.match-shell.readonly #matchPrivateNote{pointer-events:none}» 과 같은 칸
  var FIELD = '[data-match-field],#matchPrivateNote';

  // 왜 잠겼나 — '' 이면 지금은 고칠 수 있다(화면만 옛 상태)
  function reason(win) {
    var f = function (n) { return typeof win[n] === 'function' ? win[n] : null; };
    try { if (f('matchDocPending') && win.matchDocPending()) return 'pending'; } catch (_) { return 'pending'; }
    try { if (f('matchRole') && win.matchRole() === 'player') return 'player'; } catch (_) {}
    try { if (f('matchCanEdit') && !win.matchCanEdit()) return 'perm'; } catch (_) {}
    try {
      var cur = typeof matchCurrent !== 'undefined' ? matchCurrent : '';   // eslint-disable-line no-undef
      if (f('matchCanEditOne') && !win.matchCanEditOne(cur)) return 'owner';
    } catch (_) {}
    return '';
  }
  // 서버 확인 대기의 모양(내용 없음) — 준비표가 있나 · 이 팀 것인가 · 서버에 행이 있다고 했나 · 화면 사본(거울)이 있나
  function readyInfo(win) {
    var o = {};
    try {
      var ls = win.localStorage, wid = ls.getItem('ps_active_ws') || '';
      var m = JSON.parse(ls.getItem('ps_sync_meta') || 'null'), r = m && m.r && m.r[MATCH_KEY];
      o.r = r ? 1 : 0;
      if (r) { o.w = String(r.w || '') === String(wid) ? 1 : 0; o.present = r.present === true ? 1 : (r.present === false ? 0 : -1); }
      o.mirror = ls.getItem(MATCH_KEY) != null ? 1 : 0;
      var S = sync(win);
      if (S && typeof S.keyReady === 'function') o.kr = S.keyReady(MATCH_KEY, wid) ? 1 : 0;
    } catch (_) { o.err = 1; }
    try { var st = win.scoutStore; if (st && typeof st.hasFailed === 'function') o.failed = st.hasFailed(MATCH_KEY) ? 1 : 0; } catch (_) {}
    return o;
  }
  function sync(win) {
    try { if (win.parent && win.parent !== win && win.parent.PSSync) return win.parent.PSSync; } catch (_) {}
    return win.PSSync || null;
  }
  // 이 누름이 잠긴 칸을 고치려는 것인가 — 칸 자체 · 칸을 감싼 label(누르면 칸으로 들어간다)
  function lockedField(t) {
    if (!t || !t.closest) return null;
    var shell = t.closest('.match-shell');
    if (!shell || !shell.classList.contains('readonly')) return null;
    if (t.matches && t.matches(FIELD)) return t;
    var lb = t.closest('label');
    return lb && shell.contains(lb) ? lb.querySelector(FIELD) : null;
  }

  function install(win) {
    if (!win || !win.document || win.__psMatchLock) return null;
    win.__psMatchLock = true;
    var doc = win.document, lastTip = 0, lastKick = 0;
    function say(m) { try { if (typeof win.toast === 'function') win.toast(m); } catch (_) {} }
    function kick() {
      var now = Date.now(); if (now - lastKick < 15000) return; lastKick = now;
      var S = sync(win);
      try { if (S && typeof S.syncNow === 'function') S.syncNow('match-locked'); } catch (_) {}
    }
    function track(why) {
      var S = sync(win);
      try { if (S && typeof S.event === 'function') S.event('match_locked', { status: 'error', feature: 'scout', error_code: why, meta: readyInfo(win) }); } catch (_) {}
    }
    // 잠금이 풀렸는데 화면만 잠긴 채 남았다(입력 중이라 다시 그리기를 미뤘다) — 지금 다시 그린다
    function refresh(field) {
      try { if (typeof win.__matchRefresh === 'function') win.__matchRefresh(); } catch (_) {}
      win.setTimeout(function () {
        var shell = doc.querySelector('.match-shell');
        if (shell && !shell.classList.contains('readonly') && field && field.isConnected) { try { field.focus(); } catch (_) {} }
      }, 120);
    }
    function blocked(field, e) {
      var why = reason(win);
      if (e && e.cancelable) e.preventDefault();
      try { if (doc.activeElement === field) field.blur(); } catch (_) {}
      if (!why) { refresh(field); return; }
      var now = Date.now();
      if (now - lastTip > 1500) { lastTip = now; say(TXT[why]); track(why); }
      if (why === 'pending') kick();
    }
    // label 을 누르면 칸으로 들어가므로 click 에서 먼저 막는다(체크박스는 click 이 값을 바꾼다)
    doc.addEventListener('click', function (e) { var fld = lockedField(e.target); if (fld) blocked(fld, e); }, true);
    // Tab · 스크립트 focus — 들어간 뒤 바로 뺀다
    doc.addEventListener('focusin', function (e) { var t = e.target; if (t && t.matches && t.matches(FIELD) && lockedField(t)) blocked(t, null); }, true);

    // ── 회차가 도는 중에 친 글을 잃지 않는다 ──
    // 글 칸(input · textarea — 체크박스 · 날짜 · 고르개는 본문이 change 로 다룬다)에 친 값을 경기별로 적어 둔다(typed[key] = {v, t, mid}).
    // 300ms 마다: 회차가 끝났고 고칠 수 있으면 모델이 그 값이 아닐 때 넣고 저장을 건다(모델이 이미 같으면 지운다 — 보통은 첫 번에 지워진다).
    // 다시 그리기가 칸을 비웠으면(쓰는 중이 아닐 때) 칸도 돌려놓는다. 60초가 지나도 못 넣은 값은 버린다(그 사이 다른 기기가 바꾼 것을 영영 덮지 않게).
    var typed = {}, tickT = 0, focusMid = '';
    function cur() { try { return typeof matchCurrent !== 'undefined' ? String(matchCurrent || '') : ''; } catch (_) { return ''; } }   // eslint-disable-line no-undef
    function fieldOf(t) { return t && t.matches && t.matches('[data-match-field]') && t.tagName !== 'SELECT' && !/^(checkbox|radio|date|time)$/.test(String(t.type || '')) ? t : null; }
    function editable(shell) { return !!shell && !shell.classList.contains('readonly'); }
    function pending() { try { return typeof win.matchDocPending === 'function' ? !!win.matchDocPending() : false; } catch (_) { return true; } }
    function note(el, v) { typed[el.getAttribute('data-match-field')] = { v: v, t: Date.now(), mid: cur() }; if (!tickT) tickT = win.setTimeout(tick, 300); }
    function tick() {
      tickT = 0;
      var keys = Object.keys(typed); if (!keys.length) return;
      var pend = pending(), m = null, can = false, now = Date.now(), mid = cur(), again = false;
      try { m = typeof win.matchGet === 'function' ? win.matchGet() : null; } catch (_) { m = null; }
      try { can = typeof win.matchCanEdit === 'function' ? !!win.matchCanEdit() : false; } catch (_) { can = false; }
      keys.forEach(function (k) {
        var e = typed[k];
        if (!e || e.mid !== mid || now - e.t > 60000) { delete typed[k]; return; }
        var el = doc.querySelector('.match-shell [data-match-field="' + k + '"]');
        if (el && el.isConnected && el.value !== e.v && doc.activeElement !== el) el.value = e.v;   // 다시 그리기가 칸을 지웠다
        if (pend || !m || !can) { again = true; return; }
        if (String(m[k] == null ? '' : m[k]) === e.v) { delete typed[k]; return; }
        m[k] = e.v; try { if (typeof win.matchQueueSave === 'function') win.matchQueueSave(); } catch (_) {}
        delete typed[k];
      });
      if (again || Object.keys(typed).length) tickT = win.setTimeout(tick, 300);
    }
    doc.addEventListener('input', function (e) { var t = fieldOf(e.target); if (t && editable(t.closest('.match-shell'))) note(t, t.value); }, true);
    doc.addEventListener('focusin', function (e) { if (fieldOf(e.target)) focusMid = cur(); }, true);
    // renderMatch 는 모든 칸에 모델 값을 다시 적는다 — 쓰는 중인 칸은 친 글을 돌려놓고(모델은 tick 이 맞춘다), 다른 경기로 바뀐 뒤면 그대로 둔다
    function wrapRender() {
      var f = win.renderMatch; if (typeof f !== 'function') return false; if (f.__psLock) return true;
      var g = function () {
        var a = doc.activeElement, keep = null;
        if (fieldOf(a) && editable(a.closest('.match-shell')) && focusMid === cur()) { keep = { el: a, v: a.value, s: a.selectionStart, e: a.selectionEnd }; }
        var r = f.apply(this, arguments);
        if (keep && keep.el.isConnected && cur() === focusMid) {
          if (keep.el.value !== keep.v) { keep.el.value = keep.v; note(keep.el, keep.v); }
          // 다시 그리기가 커서를 떨어뜨렸으면(아무도 안 가져갔을 때만) 쓰던 자리로 — 판이 잠깐 숨었다 다시 보이는 때는 그 뒤(setTimeout 0)에
          var back = function () { var a2 = doc.activeElement; if (a2 === keep.el || (a2 && a2 !== doc.body) || !keep.el.isConnected || cur() !== focusMid) return; try { keep.el.focus({ preventScroll: true }); keep.el.setSelectionRange(keep.s, keep.e); } catch (_) {} };
          back(); if (doc.activeElement !== keep.el) win.setTimeout(back, 0);
        }
        return r;
      };
      g.__psLock = 1; win.renderMatch = g; return true;
    }
    var tries = 0;
    (function hook() { if (!wrapRender() && ++tries < 40) win.setTimeout(hook, 250); })();
    return { reason: function () { return reason(win); }, readyInfo: function () { return readyInfo(win); }, typed: function () { return Object.keys(typed); } };
  }

  if (typeof window !== 'undefined' && window.document && /\/studio\/scout\.html/.test(String(window.location && window.location.pathname))) window.__psMatchLockApi = install(window);
  return { TXT: TXT, FIELD: FIELD, reason: reason, readyInfo: readyInfo, lockedField: lockedField, install: install };
});
