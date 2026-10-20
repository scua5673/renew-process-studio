/* PROCESS STUDIO — 경기 준비 · 상대 분석의 8인제(3.117). 오류 제보 5a574320 «포메이션 설정이 11v11으로만 가능한데 유소년 경기인 8v8으로도».
   - 상대 포메이션 고르개(#mb2FormOp · #obFormOp)를 «11인제» · «8인제» 묶음으로. 8인제는 작전판(board.html FORM)과 같은 넷 —
     2-3-2 · 3-3-1 · 3-2-2 · 2-4-1, 번호는 줄 순서로 1~8. «상대 배치»(mb2FillOp · obFillOp)가 MB2_FORMS · MB2_SLOTS 를 그대로 읽는다.
   - «배치 N/11»의 11 은 선발로 고른 인원(없으면 고른 상대 포메이션의 인원 — 8인제면 8).
   scout.html 은 크기 예산이 거의 차서(tests/code-budget-3043) 여기서 더한다. MB2_FORMS · MB2_SLOTS · mb2Counts · obCounts 는 scout.html 의 전역. */
/* 3.118 — 경기 인원(사용자 «경기 준비하면서 처음에 8v8 인지 11v11 을 설정할 수 있게»). 경기 머리(제목 옆)에 «11 대 11 · 8 대 8».
   값은 경기 문서의 m.fmt('11' · '8'). 정하지 않은 경기는 같은 팀의 바로 앞 경기(날짜)에서 고른 값, 없으면 11 — 8인제 팀은 한 번만 고르면 된다.
   고르면 따라오는 것: 상대 포메이션 고르개는 그 인원의 묶음만(8 → 2-3-2 부터) · «우리 11» → «우리 팀» · «배치 N/8» ·
   «＋ 새 미팅»의 기본 9장은 8인제 운동장에 8명씩(재료에 fmt 를 싣고 board-meet-8.js 가 만든다). 이미 만든 미팅 · 보드는 건드리지 않는다. */
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
  function denom(starters, oppKey, fmt) { var n = +starters || 0; return n > 0 ? n : (fmt === '8' ? 8 : fmt === '11' ? 11 : (is8(oppKey) ? 8 : 11)); }
  function fmtSet(v) { return v === '8' || v === '11'; }
  // 이 경기의 인원 — 정한 값, 없으면 같은 팀에서 날짜가 이 경기보다 늦지 않은 경기 중 가장 늦은 경기에서 정한 값, 그것도 없으면 '11'
  function fmtOf(m, all) {
    if (m && fmtSet(m.fmt)) return m.fmt;
    var d = String(m && m.date || ''), best = null;
    (all || []).forEach(function (x) {
      if (!x || x === m || (m && x.id === m.id) || !fmtSet(x.fmt)) return;
      var xd = String(x.date || ''); if (d && xd > d) return;
      if (!best || xd > String(best.date || '') || (xd === String(best.date || '') && (+x.updatedAt || 0) > (+best.updatedAt || 0))) best = x;
    });
    return best ? best.fmt : '11';
  }
  // 고르개에 그 인원의 묶음만 붙인다(사파리는 option 의 hidden 을 무시한다 — 떼었다 붙인다). 고른 값이 없어지면 묶음의 첫 값으로
  function showGroup(sel, fmt) {
    if (!sel) return false;
    var gs = sel.__psGroups || (sel.__psGroups = Array.prototype.slice.call(sel.querySelectorAll('optgroup')));
    if (gs.length < 2) return false;
    var want = fmt === '8' ? '8인제' : '11인제', keep = sel.value, changed = false;
    gs.forEach(function (g) {
      var on = g.label === want;
      if (on && g.parentNode !== sel) { sel.appendChild(g); changed = true; }
      if (!on && g.parentNode === sel) { sel.removeChild(g); changed = true; }
    });
    var opts = Array.prototype.slice.call(sel.querySelectorAll('option')), has = opts.some(function (o) { return o.value === keep; });
    var first = fmt === '8' ? '232' : '442';
    if (!has) sel.value = opts.some(function (o) { return o.value === first; }) ? first : (opts[0] && opts[0].value) || '';
    else if (changed) sel.value = keep;
    return sel.value !== keep;
  }
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
      var v = tx.nodeValue.replace(/^\/\d+/, '/' + denom(starters(m), sel && sel.value, cur(m)));
      if (v !== tx.nodeValue) tx.nodeValue = v;
    }
    function all() { try { var st = win.matchLoad(); return st && Array.isArray(st.matches) ? st.matches : []; } catch (_) { return []; } }
    function cur(m) { return fmtOf(m, all()); }
    function canEdit() { try { return typeof win.matchCanEdit === 'function' ? !!win.matchCanEdit() : false; } catch (_) { return false; } }
    function style() {
      if (doc.getElementById('ps-match-fmt-css')) return;
      var st = doc.createElement('style'); st.id = 'ps-match-fmt-css';
      st.textContent = '.match-summary .ps-fmt{align-self:center;margin:0 auto 0 18px;flex:0 0 auto}' +
        '.match-summary .ps-fmt button{font-size:12px;padding:7px 12px;font-variant-numeric:tabular-nums}' +
        '.match-summary .ps-fmt button:disabled{cursor:default}' +
        '@media (max-width:640px){.match-summary .ps-fmt{margin:6px auto 0 0}}';
      (doc.head || doc.documentElement).appendChild(st);
    }
    // 경기 머리의 «11 대 11 · 8 대 8»
    function seg(m) {
      var box = doc.querySelector('#matchWorkspace .match-summary'); if (!box || !m) return null;
      var el = doc.getElementById('matchFmtSeg');
      if (!el) {
        style();
        el = doc.createElement('span'); el.id = 'matchFmtSeg'; el.className = 'mb2-seg ps-fmt';
        el.setAttribute('role', 'group'); el.setAttribute('aria-label', '경기 인원'); el.title = '경기 인원 — 상대 포메이션 · 새 미팅이 이 인원으로 만들어져요';
        [['11', '11 대 11'], ['8', '8 대 8']].forEach(function (p) { var b = doc.createElement('button'); b.type = 'button'; b.setAttribute('data-fmt', p[0]); b.textContent = p[1]; el.appendChild(b); });
        var main = box.querySelector('.match-summary-main');
        if (main && main.nextSibling) box.insertBefore(el, main.nextSibling); else box.appendChild(el);
        el.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('button[data-fmt]'); if (!b || b.disabled || !canEdit()) return;
          var m2 = win.matchGet && win.matchGet(); if (!m2) return;
          var v = b.getAttribute('data-fmt'); if (m2.fmt === v) return;
          var was = cur(m2); m2.fmt = v;
          try { win.matchQueueSave(); } catch (_) {}
          try { win.renderMatch(); } catch (_) { apply(m2); }
          if (was !== v) { try { win.toast(v === '8' ? '8 대 8 경기로 정했어요 — 상대 포메이션 · 새 미팅이 8명으로 만들어져요' : '11 대 11 경기로 정했어요'); } catch (_) {} }
        });
      }
      var f = cur(m), ed = canEdit();
      Array.prototype.forEach.call(el.querySelectorAll('button[data-fmt]'), function (b) {
        var on = b.getAttribute('data-fmt') === f;
        if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on)); b.disabled = !ed;
      });
      return el;
    }
    // 고른 인원을 화면에 — 머리 · 상대 포메이션 고르개 · «우리 N» · 배치 분모
    function apply(m) {
      if (!m) return;
      seg(m);
      var f = cur(m);
      [T.prep, T.ob].forEach(function (t) { var sel = doc.getElementById(t[0]); showGroup(sel, f); try { paint(t, m); } catch (_) {} });
      // «우리 11»은 선수단 작전판 카드(11장 고정)를 그대로 놓는다 — 8 대 8 에서 «우리 8»이라 쓰면 11명이 놓일 수 있어 «우리 팀»으로
      ['obFillUs', 'mb2FillUs'].forEach(function (id) { var b = doc.getElementById(id); if (b && /^우리 (\d+|팀)$/.test(b.textContent.trim())) { var tx = f === '8' ? '우리 팀' : '우리 11'; if (b.textContent !== tx) b.textContent = tx; } });
    }
    function wrapRender() {
      var r = win.renderMatch; if (typeof r !== 'function' || r.__psFmt) return;
      var w = function () { var out = r.apply(this, arguments); try { apply(win.matchGet && win.matchGet()); } catch (_) {} return out; };
      w.__psFmt = true; win.renderMatch = w;
    }
    // «＋ 새 미팅» · 미팅 만들기 시트 — 재료에 이 경기의 인원을 싣는다(작전판 board-meet-8.js 가 읽는다)
    function wrapPost() {
      var p = win.mmPost; if (typeof p !== 'function' || p.__psFmt) return;
      var w = function (msg) {
        try {
          if (msg && msg.type === 'meetingFromMatch' && msg.payload && msg.payload.fmt == null) {
            var m = win.matchGet && win.matchGet();
            msg = Object.assign({}, msg, { payload: Object.assign({}, msg.payload, { fmt: cur(m) }) });
          }
        } catch (_) {}
        return p.call(this, msg);
      };
      w.__psFmt = true; win.mmPost = w;
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
      wrapRender(); wrapPost();   // 처음 그림은 다음 renderMatch 에서(부팅 중에 경기 문서를 먼저 읽지 않는다)
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', setup); else setup();
  }
  if (typeof window !== 'undefined' && window.document) install(window);
  return { FORMS8: FORMS8, SLOTS8: SLOTS8, LABELS8: LABELS8, is8: is8, denom: denom, fmtOf: fmtOf, showGroup: showGroup, extend: extend, groupSelect: groupSelect, install: install };
});
