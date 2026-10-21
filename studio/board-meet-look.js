/* PROCESS STUDIO — 새 미팅은 평면으로 연다(3.128). 사용자 «미팅만들기 들어가면 평면에 15존에 네이비 피치로».
   · 네이비 · 15존은 판(스냅)의 값이라 board.html 의 기본 9장(meetTplSnap) · 경기 미팅의 바탕 · board-meet-8.js 8인제 9장에서 정한다.
   · 평면 · 3D 는 기기의 보기(ps_board_tilt3d)라 판에 실리지 않는다 — 이 모듈이 새 미팅을 만든 순간(보관함 «미팅 만들기» = __meetSeed,
     경기 «＋ 새 미팅» = __meetingFromMatch) 3D 였으면 평면으로 바꾼다. 기기 설정은 그대로(transient) — 미팅을 나가면 들어오기 전 보기로 돌아간다.
     미팅 안에서 코치가 직접 평면 · 3D 를 고르면 그 선택이 이긴다(나갈 때 되돌리지 않는다).
   · 이미 만든 미팅을 다시 여는 것은 건드리지 않는다. 훈련 편집기의 같은 일은 board-edit-view.js(3.120).
   3.130 — 보기 전용 미팅과 발표 화면(installView):
   · 보관함 «큰 화면으로 보기»(openItem(d,true)) · 남의 미팅 · 경기 준비 안 쇼는 편집 화면을 그대로 쓰는데 저장은 하지 않는다 —
     제목 · 메모를 고칠 수 있었고, 닫으면 말없이 사라졌다. 이제 제목 · 메모 · 맨 위 문구 칸을 잠그고(누르면 안내), 막대 이름을 «미팅 보기»로,
     보관함 미리보기에서 «큰 화면으로 보기»를 눌렀고 그 미리보기에 «편집»이 있었으면 막대에도 «편집»(3.031 이 미팅에서 숨긴 단추)을 세운다 —
     누르면 닫고 그 미리보기의 «편집»을 누른다(보관함 편집과 같은 길).
   · 발표(body.focus-board)에서는 «미팅 수정 · 닫기» 막대를 걷는다(페이지 띠는 board-topbar.js) · «나가기»는 밝은 판에서도 읽히게 ·
     흰 · 훈련 운동장의 발표 메모(#ksOv)는 어두운 글자로. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSMeetLook = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // 새 미팅의 판 모양 — board.html · board-meet-8.js 와 같은 값(시험이 셋을 견준다)
  var LOOK = { pitchTheme: '', pitchCustom: null, pitchImg: null, gridType: 'grid15' };

  function install(win) {
    if (!win || !win.document || win.__psMeetLook) return null;
    win.__psMeetLook = true;
    var doc = win.document, dev = null, busy = false;
    function has(c) { var b = doc.body; return !!b && b.classList.contains(c); }
    function tilt() { return has('bc-tilt3d'); }
    function setTilt(on) {
      var f = win.__setTilt; if (typeof f !== 'function') return;
      busy = true; try { f.call(win, !!on, { transient: true, quiet: true }); } catch (_) {} busy = false;
    }
    // 새 미팅 — 3D 였으면 평면으로(처음 한 번만 들어오기 전 보기를 기억한다)
    function flat() {
      if (!has('meet-mode') || has('comm-viewing')) return;
      if (dev === null) dev = tilt();
      if (tilt()) setTilt(false);
    }
    function restore() {
      if (dev === null) return;
      var d = dev; dev = null;
      if (d && !tilt()) setTilt(true);
    }
    function wrapSeed() {
      var f = win.__meetSeed; if (typeof f !== 'function') return false; if (f.__psMeetLook) return true;
      var g = function () { var r = f.apply(this, arguments); if (r === true) flat(); return r; };
      g.__psMeetLook = 1; win.__meetSeed = g; return true;
    }
    function wrapMatch() {
      var f = win.__meetingFromMatch; if (typeof f !== 'function') return false; if (f.__psMeetLook) return true;
      var g = function () {
        var r = f.apply(this, arguments);
        Promise.resolve(r).then(function (ok) { if (ok) flat(); }, function () {});
        return r;
      };
      g.__psMeetLook = 1; win.__meetingFromMatch = g; return true;
    }
    // 미팅 안에서 코치가 고른 보기는 그대로 둔다
    function wrapTilt() {
      var st = win.__setTilt; if (typeof st !== 'function') return false; if (st.__psMeetLook) return true;
      var g = function (on, opts) { if (!busy && !(opts && opts.transient) && has('meet-mode')) dev = null; return st.apply(this, arguments); };
      g.__psMeetLook = 1; win.__setTilt = g; return true;
    }
    // 미팅을 나가면(meet-mode 가 걷히면) 들어오기 전 보기로 — 클래스는 읽기만 한다(바꾸면 감시가 끝없이 돈다)
    function watch() {
      try {
        if (!doc.body || !win.MutationObserver) return;
        new win.MutationObserver(function () { if (dev !== null && !has('meet-mode')) restore(); })
          .observe(doc.body, { attributes: true, attributeFilter: ['class'] });
      } catch (_) {}
    }
    var tries = 0;
    function hook() {
      var ok = wrapSeed() & wrapMatch() & wrapTilt();
      if (!ok && ++tries < 40) win.setTimeout(hook, 250);
    }
    function start() { watch(); hook(); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
    return { flat: flat, restore: restore, dev: function () { return dev; } };
  }
  // ── 3.130 보기 전용 미팅 · 발표 화면 ──
  // 미팅 칸(board.html 의 #ksEd · #ksHead): 제목 · 메모 · 맨 위 문구 · 제목 띠
  var RO_FIELDS = ['ksTitle', 'ksPoints', 'ksBrand', 'ksHeadIn'];
  var VIEW_CSS = [
    // 발표 중에는 «미팅 수정 · 닫기» 막대를 걷고 그 자리(#boardView 위 56px)를 운동장에 돌려준다 — 나가기는 «나가기» · Esc
    'body.focus-board #vCreateBar{display:none!important}',
    'body.focus-board.vcreating #boardView{padding-top:0!important}',
    // «나가기»: 연분홍 글자 + 반투명 빨강 바탕은 어두운 판 전용이라 흰 판 위에서 거의 안 보였다 — 다른 단추와 같은 판 위에 빨간 글자
    'html body #meetNav button.mn-exit{background:var(--panel,#fff)!important;border-color:rgba(196,43,28,.35)!important;color:#c42b1c!important}',
    'html body.fmdark #meetNav button.mn-exit{color:#ff8a80!important;border-color:rgba(255,138,128,.4)!important}',
    // 흰 · 훈련 운동장의 발표 메모 — 흰 글자 + 그림자는 어두운 판 전용. 발표에서만(편집 화면의 메모 자리는 그대로)
    'html[data-pitch="white"] body.focus-board #ksOv .kt,html[data-pitch="white"] body.focus-board #ksOv li,html[data-pitch="train"] body.focus-board #ksOv .kt,html[data-pitch="train"] body.focus-board #ksOv li{color:#14161A!important;text-shadow:0 1px 6px rgba(255,255,255,.85)!important}',
    '#ksEd input[readonly],#ksEd textarea[readonly]{cursor:default}'
  ].join('');
  var TITLE_EDIT = '미팅 수정', TITLE_VIEW = '미팅 보기';
  var TIP_EDIT = '보기 전용이에요 — 위쪽 «편집»을 누르면 고칠 수 있어요';
  var TIP_VIEW = '보기 전용이에요 — 고치려면 보관함에서 «편집»으로 여세요';

  function installView(win) {
    if (!win || !win.document || win.__psMeetView) return null;
    win.__psMeetView = true;
    var doc = win.document, armed = null, lastTip = 0, barSeen = null, mo = null, wasRo = false;
    function has(c) { var b = doc.body; return !!b && b.classList.contains(c); }
    function byId(id) { return doc.getElementById(id); }
    // 보관함 «큰 화면으로 보기» · 남의 미팅 · 경기 준비 안 쇼 — 모두 openItem(d,true) 의 보기 전용 미팅
    function roMeeting() { return has('meet-mode') && has('vcreating') && !!win.__vaultReadOnly; }
    // 이 미팅을 연 보관함 미리보기에 «편집»이 있었다(canEditItem) — 경기 준비 안 쇼 · 목록 줄 «보기»로 연 것은 모른다
    function editable() { return !!(armed && armed.edit && armed.id && armed.id === win.__vvMeetLib); }
    function css() {
      if (byId('psMeetViewCss')) return;
      var st = doc.createElement('style'); st.id = 'psMeetViewCss'; st.textContent = VIEW_CSS;
      (doc.head || doc.documentElement).appendChild(st);
    }
    // 값이 다를 때만 쓴다 — 막대를 지켜보는 감시가 제 글씨에 다시 불려도 멈춘다.
    // 칸은 이 모듈이 잠근 것만 푼다(__psMeetRo) — 다른 코드가 잠근 칸은 건드리지 않는다
    function sync() {
      var ro = roMeeting();
      // «큰 화면으로 보기»를 누른 기록은 그 누름으로 열린 보기에만 쓴다 — 나중에 다른 길(경기 준비 안 쇼 · 목록 줄 «보기»)로 연 보기에 남지 않게
      if (ro && !wasRo && armed && Date.now() - armed.t > 5000) armed = null;
      if (!ro && wasRo) armed = null;
      wasRo = ro;
      RO_FIELDS.forEach(function (id) {
        var el = byId(id); if (!el) return;
        if (ro && !el.readOnly) { el.readOnly = true; el.__psMeetRo = true; }
        else if (!ro && el.__psMeetRo) { el.readOnly = false; el.__psMeetRo = false; }
      });
      var bar = byId('vCreateBar');
      if (bar && bar !== barSeen && mo) { barSeen = bar; try { mo.observe(bar, { childList: true, subtree: true, characterData: true }); } catch (_) {} }
      if (!ro) return;
      var t = byId('vCreateTitle'); if (t && t.textContent === TITLE_EDIT) t.textContent = TITLE_VIEW;
      var eb = byId('vCreateEdit'), want = editable() ? '' : 'none';
      if (eb && eb.style.display !== want) eb.style.display = want;
    }
    function tip() {
      var now = Date.now(); if (now - lastTip < 2500) return; lastTip = now;
      try { if (typeof win.toast === 'function') win.toast(editable() ? TIP_EDIT : TIP_VIEW); } catch (_) {}
    }
    function locked(t) { return !!(t && t.id && RO_FIELDS.indexOf(t.id) >= 0 && t.__psMeetRo && roMeeting()); }
    // «편집» — 닫고(보기 전용이라 저장할 것이 없다) 보관함 미리보기의 «편집»을 누른다.
    // 닫기는 셸에 goApp('design')을 보내고, 셸은 받으면 setView('session')을 부른다 — 그보다 먼저 편집을 열면 그 호출이 편집을 덮는다.
    // 그래서 보관함 화면(__csView 'session')으로 돌아온 뒤 누른다(작전판의 «편집»은 80ms 를 기다린다).
    function toEdit() {
      if (!editable()) { tip(); return; }
      var id = armed.id, cancel = byId('vCreateCancel');
      if (!cancel) return;
      cancel.click();
      var n = 0;
      function open() {
        var pv = doc.querySelector('#drillFiles .vx-preview'), eb = pv && pv.querySelector('[data-vx-edit]');
        var ready = eb && win.__vaultPreviewId === id && !has('vcreating') && !has('meet-mode');
        // 셸이 보관함 보기로 돌린 뒤 — 셸 없이 연 작전판(답이 오지 않는다)이면 2초 남짓 기다린 뒤 그냥 누른다
        if (ready && (win.__csView === 'session' || n >= 25)) { eb.click(); return; }
        if (++n <= 25) win.setTimeout(open, 80);
      }
      win.setTimeout(open, 150);
    }
    function start() {
      css();
      try { if (win.MutationObserver && doc.body) { mo = new win.MutationObserver(sync); mo.observe(doc.body, { attributes: true, attributeFilter: ['class'] }); } } catch (_) {}
      doc.addEventListener('click', function (e) {
        var t = e.target, v = t && t.closest ? t.closest('[data-vx-view]') : null;
        if (v) { var pv = v.closest('.vx-preview'); armed = { id: win.__vaultPreviewId || null, edit: !!(pv && pv.querySelector('[data-vx-edit]')), t: Date.now() }; }
        var eb = t && t.closest ? t.closest('#vCreateEdit') : null;
        // 미팅의 «편집»은 이 모듈이 맡는다 — board.html 의 처리(__vvItem)는 미팅에서 비어 있어 아무 일도 하지 않는다
        if (eb && roMeeting()) { e.preventDefault(); e.stopImmediatePropagation(); toEdit(); }
      }, true);
      doc.addEventListener('focusin', function (e) { sync(); if (locked(e.target)) tip(); }, true);
      doc.addEventListener('keydown', function (e) { if (locked(e.target)) tip(); }, true);
      sync();
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
    return { sync: sync, roMeeting: roMeeting, editable: editable, armed: function () { return armed; } };
  }

  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) { install(window); window.__psMeetViewApi = installView(window); }
  return { LOOK: LOOK, install: install, installView: installView, RO_FIELDS: RO_FIELDS, VIEW_CSS: VIEW_CSS, TITLE_VIEW: TITLE_VIEW };
});
