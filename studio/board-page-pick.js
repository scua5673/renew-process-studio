/* PROCESS STUDIO — 페이지 여러 개 골라 운동장 설정 함께 바꾸기(3.091 · 사용자 «페이지를 다중 선택하고 보드설정에서 바꾸면 바뀌게»).
   운동장 설정(피치 색 · 규격 · 범위 · 확대 쪽 · 운동장 개수)은 페이지마다 저장된다(칩 · 이름표 · 잔디 밝기 같은 겉모습은 3.017 부터 작업물에 한 벌).
   그래서 한 페이지에서 바꾸면 그 페이지(와 그 장면)만 바뀌었다. 이제 함께 바꿀 페이지를 고른다:
   - 페이지 띠: ⌘(Ctrl) · Shift 를 누른 채 탭을 누르면 고르기/풀기. 그냥 누르면(페이지 전환) 고르기가 풀린다.
   - 보드 설정 › 운동장 맨 위 «함께 바꿀 페이지» 줄: 페이지 칩을 눌러 고르기(손가락으로도) · «모두».
   바꾸는 길은 작전판이 이미 «이 애니메이션의 모든 장면»에 맞추던 곳(_viewScenesMatch(kind)) 하나다 — 그 뒤에 고른 페이지(와 그 장면)에도
   같은 값(captureSnap 에서 읽은 _VIEW_KEYS[kind])을 적는다. 페이지는 __psPages.eachOther 로 고친다(썸네일 · 저장도 그쪽이 맡는다).
   운동장 방향(가로 · 세로)은 좌표를 돌려야 해서 넣지 않는다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSPagePick = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  /* 스냅 하나에 지금 값(cur)의 keys 를 적는다. same(sn,cur,k) 가 모두 참이면 그대로(false) */
  function stamp(sn, cur, keys, same) {
    if (!sn || typeof sn !== 'object' || !cur || !keys || !keys.length) return false;
    if (keys.every(function (k) { return same ? same(sn, cur, k) : sn[k] === cur[k]; })) return false;
    keys.forEach(function (k) { if (cur[k] === undefined) delete sn[k]; else sn[k] = cur[k] && typeof cur[k] === 'object' ? JSON.parse(JSON.stringify(cur[k])) : cur[k]; });
    return true;
  }
  /* 페이지 한 장(스냅 + 장면들)에 적고 바뀐 수를 돌려준다. 바뀐 장면은 썸네일을 지운다 */
  function stampPage(snap, frames, cur, keys, same) {
    var c = stamp(snap, cur, keys, same) ? 1 : 0;
    (frames || []).forEach(function (f) { if (f && f.snap && stamp(f.snap, cur, keys, same)) { c++; delete f.thumb; } });
    return c;
  }
  /* 고른 페이지 목록 — 지금 페이지는 늘 들어 있으니 따로 두지 않는다. 개수 · 지금 페이지가 바뀌면 비운다 */
  function picker() {
    var sel = {}, sig = '';
    return {
      has: function (i) { return !!sel[i]; },
      list: function () { return Object.keys(sel).map(Number).sort(function (a, b) { return a - b; }); },
      size: function () { return Object.keys(sel).length; },
      toggle: function (i, cur) { if (i === cur) return false; if (sel[i]) delete sel[i]; else sel[i] = 1; return true; },
      all: function (n, cur) { var on = this.size() < n - 1; sel = {}; if (on) for (var i = 0; i < n; i++) if (i !== cur) sel[i] = 1; return on; },
      clear: function () { var had = this.size() > 0; sel = {}; return had; },
      /* 페이지 띠가 다시 그려질 때: 개수 · 지금 페이지가 그대로면 고른 것을 둔다 */
      sync: function (n, cur) { var s = n + '|' + cur; if (s !== sig) { var had = sig !== ''; sig = s; if (had) sel = {}; } Object.keys(sel).forEach(function (k) { if (+k >= n || +k === cur) delete sel[k]; }); }
    };
  }

  /* global captureSnap, toast, _VIEW_KEYS, _viewVal, animPlaying */
  function install(win) {
    var doc = win.document;
    if (!doc || win.__psPagePick) return null;
    win.__psPagePick = true;
    var P = picker();
    function pages() { return win.__psPages && win.__psPages.book ? win.__psPages : null; }
    function count() { var p = pages(); try { return p ? p.book.count() : 1; } catch (_) { return 1; } }
    function cur() { var p = pages(); try { return p ? p.book.idx() : 0; } catch (_) { return 0; } }
    function strip() { return doc.getElementById('boardPageStrip'); }
    function tabs() { var s = strip(); return s ? [].slice.call(s.querySelectorAll('.bp-tab')) : []; }
    function usable() { return count() > 1 && !win.__vaultBook && !win.__vaultReadOnly; }

    /* 운동장 설정을 바꾼 뒤 — 고른 페이지에도 */
    function spread(kind) {
      if (!P.size() || !usable()) return 0;
      try { if (typeof animPlaying !== 'undefined' && animPlaying) return 0; } catch (_) {}
      var keys = null, now = null, same = null;
      try { keys = _VIEW_KEYS[kind]; } catch (_) {}
      if (!keys) return 0;
      try { now = captureSnap(); } catch (_) { return 0; }
      try { if (typeof _viewVal === 'function') same = function (sn, c, k) { return _viewVal(sn, k) === _viewVal(c, k); }; } catch (_) {}
      var hit = {};
      var n = pages().eachOther(function (snap, frames, i) { if (!P.has(i)) return 0; var c = stampPage(snap, frames, now, keys, same); if (c) hit[i] = 1; return c; }) || 0;
      var np = Object.keys(hit).length;
      if (n) setTimeout(paint, 30);
      if (np) { try { toast('고른 페이지 ' + (np + 1) + '개에 함께 바꿨어요'); } catch (_) {} }
      return n;
    }
    function wrap() {
      var orig = win._viewScenesMatch;
      if (typeof orig !== 'function' || orig.__psPick) return;
      var w = function (kind) { var r = orig.apply(this, arguments); try { spread(kind); } catch (_) {} return r; };
      w.__psPick = true; win._viewScenesMatch = w;
    }

    /* 페이지 띠 — ⌘ · Ctrl · Shift + 누르기 = 고르기, 그냥 누르기 = 풀기(그다음 원래대로 전환).
       window 캡처에 작전판보다 먼저 단다 — 작전판의 window 캡처가 Ctrl 누르기를 문서까지 내려보내지 않는다 */
    win.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('#boardPageStrip .bp-tab');
      if (!t || (e.target.closest && e.target.closest('.bpx'))) return;
      var i = tabs().indexOf(t); if (i < 0) return;
      if ((e.metaKey || e.ctrlKey || e.shiftKey) && usable()) {
        e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        P.sync(count(), cur()); if (P.toggle(i, cur())) paint();
        return;
      }
      if (P.clear()) paint();
    }, true);

    var NN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { return ':not(#pp' + i + ')'; }).join('');
    var CSS = [
      /* 위 띠(board-topbar.js)의 탭 규칙이 id 열한 개 + !important 라 열세 개로 이긴다 */
      'html body #boardPageStrip' + NN + ' .bp-tab.bp-pick{box-shadow:inset 0 0 0 2px var(--blue,#2f6fed)!important}',
      'html body #boardPageStrip' + NN + ' .bp-tab.on.bp-picking{box-shadow:inset 0 0 0 2px var(--blue,#2f6fed),0 0 0 2px var(--blue,#2f6fed)!important}',
      '#bsPagePickRow .pp-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 auto;min-width:0}',
      '#bsPagePickRow .pp-chip{min-width:32px;height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:inherit;font:inherit;font-variant-numeric:tabular-nums;cursor:pointer;max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#bsPagePickRow .pp-chip.on{background:var(--blue);border-color:var(--blue);color:#fff}',
      '#bsPagePickRow .pp-chip.cur{cursor:default;opacity:.85}',
      '#bsPagePickHint{font-size:11px;line-height:1.5;opacity:.7;padding:0 2px 6px}'
    ].join('');
    function ensureCss() { if (doc.getElementById('ps-page-pick-css')) return; var s = doc.createElement('style'); s.id = 'ps-page-pick-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s); }

    function names() { return tabs().map(function (b, i) { var s = b.querySelector('span'); return ((s && s.textContent) || String(i + 1)).trim(); }); }
    var row = null, hint = null, head = null;
    function hide(el, off) { if (!el) return; if (off) el.style.setProperty('display', 'none', 'important'); else el.style.removeProperty('display'); }
    function ensureRow() {
      var vm = doc.getElementById('viewMenu'); if (!vm) return null;
      if (row && vm.contains(row)) return row;
      var first = vm.querySelector(':scope > .bs-sec[data-bs-tab="pitch"]'); if (!first) return null;
      head = doc.createElement('div'); head.className = 'bs-sec'; head.id = 'bsPagePickSec'; head.setAttribute('data-bs-tab', 'pitch'); head.setAttribute('role', 'heading'); head.setAttribute('aria-level', '3'); head.textContent = '함께 바꿀 페이지';
      row = doc.createElement('div'); row.className = 'menurow'; row.id = 'bsPagePickRow'; row.setAttribute('data-bs-tab', 'pitch');
      var l = doc.createElement('span'); l.className = 'menulbl'; l.textContent = '페이지'; row.appendChild(l);
      var box = doc.createElement('div'); box.className = 'pp-chips'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', '함께 바꿀 페이지'); row.appendChild(box);
      hint = doc.createElement('div'); hint.className = 'bs-hint'; hint.id = 'bsPagePickHint'; hint.setAttribute('data-bs-tab', 'pitch');
      hint.textContent = '고른 페이지는 피치 색 · 규격 · 범위 · 운동장 개수가 함께 바뀌어요 · 페이지 탭을 ⌘ · Shift 누른 채 눌러도 골라져요';
      box.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.pp-chip'); if (!b) return; e.stopPropagation();
        if (b.dataset.all) P.all(count(), cur()); else P.toggle(+b.dataset.i, cur());
        paint();
      });
      first.before(head, row, hint);
      return row;
    }
    function paintRow() {
      if (!ensureRow()) return;
      var off = !usable(); hide(head, off); hide(row, off); hide(hint, off);
      if (off) return;
      var box = row.querySelector('.pp-chips'), nm = names(), c = cur(), n = count(), h = '';
      for (var i = 0; i < n; i++) {
        var on = i === c || P.has(i), t = nm[i] || String(i + 1);
        h += '<button type="button" class="pp-chip' + (on ? ' on' : '') + (i === c ? ' cur' : '') + '" data-i="' + i + '" aria-pressed="' + on + '" title="' + esc(t) + (i === c ? ' · 지금 페이지(늘 함께)' : '') + '">' + esc(short(t, i)) + '</button>';
      }
      h += '<button type="button" class="pp-chip" data-all="1" aria-pressed="' + (P.size() === n - 1) + '">' + (P.size() === n - 1 ? '풀기' : '모두') + '</button>';
      box.innerHTML = h;
    }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
    function short(t, i) { return /^(페이지|시퀀스) \d+$/.test(t) ? String(i + 1) : t; }
    var painting = false;
    function paint() {
      if (painting) return; painting = true;
      try {
        P.sync(count(), cur());
        var c = cur(), any = P.size() > 0;
        tabs().forEach(function (b, i) {
          var want = P.has(i); if (b.classList.contains('bp-pick') !== want) b.classList.toggle('bp-pick', want);
          var w2 = any && i === c; if (b.classList.contains('bp-picking') !== w2) b.classList.toggle('bp-picking', w2);
        });
        paintRow();
      } catch (_) {}
      painting = false;
    }

    function boot() {
      ensureCss(); wrap();
      /* 페이지 띠 · 보드 설정 창은 나중에 생긴다 — 생기면 띠를 지켜보고 줄을 단다 */
      var watched = null;
      function watch() {
        var s = strip();
        if (s && s !== watched && win.MutationObserver) { watched = s; new win.MutationObserver(function () { if (!painting) paint(); }).observe(s, { childList: true, subtree: true }); paint(); }
        if (doc.querySelector('#viewMenu > .bs-sec[data-bs-tab="pitch"]') && !(row && doc.contains(row))) paint();
      }
      if (win.MutationObserver) new win.MutationObserver(watch).observe(doc.body, { childList: true });
      watch(); paint();
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    var api = { picker: P, spread: spread, paint: paint }; win.__psPagePickApi = api; return api;
  }

  return { stamp: stamp, stampPage: stampPage, picker: picker, install: install };
});
if (typeof window !== 'undefined' && window.document) { try { window.PSPagePick.install(window); } catch (_) {} }
