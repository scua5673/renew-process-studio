/* PROCESS STUDIO — 경기 준비 · 상대 분석의 8인제(3.117). 오류 제보 5a574320 «포메이션 설정이 11v11으로만 가능한데 유소년 경기인 8v8으로도».
   - 상대 포메이션 고르개(#mb2FormOp · #obFormOp)를 «11인제» · «8인제» 묶음으로. 8인제는 작전판(board.html FORM)과 같은 넷 —
     2-3-2 · 3-3-1 · 3-2-2 · 2-4-1, 번호는 줄 순서로 1~8. «상대 배치»(mb2FillOp · obFillOp)가 MB2_FORMS · MB2_SLOTS 를 그대로 읽는다.
   - «배치 N/11»의 11 은 선발로 고른 인원(없으면 고른 상대 포메이션의 인원 — 8인제면 8).
   scout.html 은 크기 예산이 거의 차서(tests/code-budget-3043) 여기서 더한다. MB2_FORMS · MB2_SLOTS · mb2Counts · obCounts 는 scout.html 의 전역. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSMatchFormats = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // 좌표는 MB2_FORMS 와 같은 틀: x = 우리 골문(6) → 앞(64), y 작은 쪽 = 오른쪽(R). 작전판 FORM(x 0.045~0.45, y 작은 쪽 = 왼쪽)을 옮겼다
  var FORMS8 = {
    '232': [[6, 50], [22, 65], [22, 35], [44, 82], [41, 50], [44, 18], [63, 62], [63, 38]],
    '331': [[6, 50], [22, 75], [21, 50], [22, 25], [44, 78], [41, 50], [44, 22], [64, 50]],
    '322': [[6, 50], [22, 75], [21, 50], [22, 25], [42, 62], [42, 38], [63, 65], [63, 35]],
    '241': [[6, 50], [22, 65], [22, 35], [44, 86], [41, 60], [41, 40], [44, 14], [64, 50]]
  };
  var SLOTS8 = {
    '232': [['GK', 1], ['CB', 2], ['CB', 3], ['LM', 4], ['CM', 5], ['RM', 6], ['ST', 7], ['ST', 8]],
    '331': [['GK', 1], ['CB', 2], ['CB', 3], ['CB', 4], ['LM', 5], ['CM', 6], ['RM', 7], ['ST', 8]],
    '322': [['GK', 1], ['CB', 2], ['CB', 3], ['CB', 4], ['LCM', 5], ['RCM', 6], ['ST', 7], ['ST', 8]],
    '241': [['GK', 1], ['CB', 2], ['CB', 3], ['LM', 4], ['LCM', 5], ['RCM', 6], ['RM', 7], ['ST', 8]]
  };
  var LABELS8 = [['232', '2-3-2'], ['331', '3-3-1'], ['322', '3-2-2'], ['241', '2-4-1']];

  function is8(key) { return Object.prototype.hasOwnProperty.call(FORMS8, String(key || '')); }
  // «배치 N/◻»의 ◻ — 선발로 고른 인원이 있으면 그 수, 없으면 고른 상대 포메이션의 인원
  function denom(starters, oppKey) { var n = +starters || 0; return n > 0 ? n : (is8(oppKey) ? 8 : 11); }
  // 표에 8인제를 더한다(이미 있는 키는 건드리지 않는다)
  function extend(forms, slots) {
    if (!forms || !slots) return false;
    Object.keys(FORMS8).forEach(function (k) {
      if (!forms[k]) forms[k] = FORMS8[k].map(function (a) { return a.slice(); });
      if (!slots[k]) slots[k] = SLOTS8[k].map(function (a) { return a.slice(); });
    });
    return true;
  }
  // 고르개: 지금 있는 option 들을 «11인제»로 묶고 «8인제» 묶음을 더한다(고른 값 · id 그대로)
  function groupSelect(doc, sel) {
    if (!sel || sel.querySelector('optgroup')) return false;
    var keep = sel.value;   // option 을 옮기는 동안 고른 값이 바뀐다(옮긴 뒤 되돌린다)
    var g11 = doc.createElement('optgroup'); g11.label = '11인제';
    Array.prototype.slice.call(sel.children).forEach(function (o) { if (o.tagName === 'OPTION') g11.appendChild(o); });
    var g8 = doc.createElement('optgroup'); g8.label = '8인제';
    LABELS8.forEach(function (p) { var o = doc.createElement('option'); o.value = p[0]; o.textContent = p[1]; g8.appendChild(o); });
    sel.appendChild(g11); sel.appendChild(g8);
    if (keep) sel.value = keep;
    return true;
  }

  function install(win) {
    var doc = win.document;
    if (!doc || win.__psMatchFormats) return;
    win.__psMatchFormats = true;
    var T = { prep: ['mb2FormOp', 'mb2CntUs', 'mb2FillOp', 'mb2Counts'], ob: ['obFormOp', 'obCntUs', 'obFillOp', 'obCounts'] };
    function starters(m) {
      try { if (typeof win.matchLineupStarters === 'function') return win.matchLineupStarters(m).length; } catch (_) {}
      return m && m.squad && Array.isArray(m.squad.start) ? m.squad.start.length : 0;
    }
    // «/11 · 상대 » 글자(#…CntUs 바로 뒤 글자 칸)의 숫자만 바꾼다
    function paint(t, m) {
      var b = doc.getElementById(t[1]), tx = b && b.nextSibling, sel = doc.getElementById(t[0]);
      if (!tx || tx.nodeType !== 3 || !/^\/\d+/.test(tx.nodeValue)) return;
      var v = tx.nodeValue.replace(/^\/\d+/, '/' + denom(starters(m), sel && sel.value));
      if (v !== tx.nodeValue) tx.nodeValue = v;
    }
    function wrap(t) {
      var f = win[t[3]]; if (typeof f !== 'function' || f.__psFmt) return;
      var w = function (m) { var r = f.apply(this, arguments); try { paint(t, m); } catch (_) {} return r; };
      w.__psFmt = true; win[t[3]] = w;
    }
    function setup() {
      extend(win.MB2_FORMS, win.MB2_SLOTS);
      [T.prep, T.ob].forEach(function (t) {
        var sel = doc.getElementById(t[0]); groupSelect(doc, sel); wrap(t);
        var fill = doc.getElementById(t[2]); if (fill) fill.title = '선택한 포메이션으로 상대 토큰 배치 — 11인제 1~11 · 8인제 1~8';
        if (sel && !sel.__psFmt) {
          sel.__psFmt = true;
          sel.addEventListener('change', function () { try { var m = typeof win.matchGet === 'function' ? win.matchGet() : null; if (m) paint(t, m); } catch (_) {} });
        }
      });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', setup); else setup();
  }
  if (typeof window !== 'undefined' && window.document) install(window);
  return { FORMS8: FORMS8, SLOTS8: SLOTS8, LABELS8: LABELS8, is8: is8, denom: denom, extend: extend, groupSelect: groupSelect, install: install };
});
