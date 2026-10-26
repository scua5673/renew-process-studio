/* PROCESS STUDIO — 보관함에서 연 작전판 · 패턴북: 둘러보기만 하고 나가면 «버리고 나갈까요?»를 묻지 않는다(3.113).
   처음 고침은 3.001(840dfa9 — 합쳐지지 못한 가지). 그때는 board.html 안에 넣었지만 지금은 크기 예산이 꽉 차 이 모듈로 옮겼다.
   예전: 열기만 하고 페이지 · 시퀀스를 옮기거나(페이지 띠 · 기둥 · 국면 지도), 장면을 고르거나, 재생만 해도 누르기(pointerup)마다
         «변경 사항 있음»이 켜져, 아무것도 안 고치고 «나가기»를 누르면 «저장하지 않은 변경 사항을 버리고 나갈까요?»가 떴다.
   이제: 항목이 다 열린 뒤(__vaultHydrating 이 풀릴 때) 항목 전체의 지문을 뜬다 — 그것이 «저장된 모습»(__vaultSavedSig).
         누르기마다 · 나가기 직전에 지금 지문과 견주어, 다를 때만 «변경 사항 있음»이다(2.975 «저장» 뒤 지문과 같은 길).
   ⚠ 안전이 먼저다 — 지문이 틀리면(고쳤는데 같다고 하면) 코치가 고친 것을 잃는다. 그래서:
     · 지문은 저장이 쓰는 것 전부를 본다: 판(captureSnap — 보드 설정 · 운동장 · 선수 · 장비 · 그림 · 공) · 장면마다 썸네일을 뺀 모든 칸
       (자막 · 시간 · 속도 · 곡선 · 강조 · 단계 이름표 …) · 장면 제목 · 유지 시간 · 다른 페이지 모두(이름 · 국면 칸 · 판 · 장면, 썸네일 · 연결 빼고).
       지금 장면 자리에는 판이 선다(아직 장면에 안 담겼다). 어느 페이지 · 장면을 보고 있는지는 고친 것이 아니다.
     · 지문을 새로 삼는 때는 셋뿐 — 다 열린 뒤 · «저장» 뒤(2.975 그대로) · 페이지/장면 옮기기 바로 앞에서 견주어 같았을 때 옮긴 뒤 모습.
       옮기기 바로 앞에서 한 번 더 견주므로, 옮기기 전에 고친 것은 옮긴 뒤에도 «변경 있음»이다.
     · 나가기(«나가기» · 전체보기 «닫기» · «‹ 경기 준비로») · 창 닫기 직전에도 견준다 — 누르기 사이에 고친 것도 놓치지 않는다.
     · 지문을 못 뜨면(오류) · 열리는 동안 사람이 손댔으면 · 지문이 없으면 예전 그대로(누르기마다 «변경 있음»).
     · 재생 · 내보내기 · 썸네일 뜨기로 판이 잠깐 다른 모습일 때는 견주지 않는다(끝나면 판이 제자리로 돌아오고, 나가기 직전에 견준다).
   board.html 은 고치지 않는다: function 선언(restoreAnimBeforeCapture · selectAnimFrame)과 window 의 __vaultAutoSaveSchedule ·
   __vaultEditSig 를 감싼다. 페이지 옮기기(switchTo)는 페이지 띠 안의 닫힌 함수라, 그 첫 줄의 restoreAnimBeforeCapture 에서 «옮기기 전»을 재고
   같은 차례(같은 태스크) 안의 다음 boardSaveLive(persist) 에서 «옮긴 뒤»를 본다. 페이지 묶음 · 차례가 그대로이고 지금 페이지만 바뀌었을 때만 옮기기로 친다.
   이 모듈은 본문 스크립트보다 먼저 읽힌다 — __vaultHydrating 을 접근자로 받아 열기가 끝나는 순간을 안다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSVaultBrowse = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // 빈 칸(null · 빈 객체 · 빈 배열)은 없는 것과 같다 — 동선을 그리면 생기는 curves:{} · 강조를 다 풀면 지워지는 hl
  function blank(v) {
    if (v === undefined || v === null) return true;
    if (Array.isArray(v)) return !v.length;
    return typeof v === 'object' && !Object.keys(v).length;
  }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  /* 판 하나 — 보드 설정(겉모습 · look)을 뺀 모든 칸(이름 차례대로). 사람 · 장비 · 그림은 loadSnap 이 없는 목록을 빈 목록으로 읽는 그대로.
     겉모습은 한 작업물에 하나다(3.017) — 장면 · 페이지를 옮기거나 저장할 때 지금 설정을 모든 판에 다시 적으므로, 지금 판(captureSnap)에서 한 번만 본다 */
  function snapSig(s, look) {
    s = s || {};
    var o = { players: s.players || [], equipment: s.equipment || [], drawings: s.drawings || [], ball: s.ball === undefined ? null : s.ball };
    Object.keys(s).sort().forEach(function (k) {
      if (has(o, k) || has(look, k) || blank(s[k])) return;
      o[k] = s[k];
    });
    return o;
  }
  // 장면 하나 — 썸네일을 뺀 모든 칸(이름 차례대로) + 판. live: 지금 장면이면 판(아직 장면에 안 담겼다)
  function frameSig(f, live, look) {
    if (!f || typeof f !== 'object') return 'null';
    var o = {};
    Object.keys(f).sort().forEach(function (k) {
      if (k === 'thumb' || k === 'snap') return;
      if (blank(f[k])) return;
      o[k] = f[k];
    });
    o.snap = live || snapSig(f.snap, look);
    return JSON.stringify(o);
  }
  // 다른 페이지 — 통째로(썸네일 · 보드 연결 빼고). 판 · 장면의 보드 설정(겉모습)은 뺀다: 페이지를 옮기거나 저장할 때
  // 지금 설정을 모든 페이지에 다시 적는다(_lookStampPages) — 설정은 지금 판(captureSnap)이 말한다. 지금 페이지의 판 · 장면은 살아 있는 판이 말한다.
  function pageSig(p, cur, look) {
    if (!p || typeof p !== 'object') return 'null';
    return JSON.stringify(p, function (k, v) {
      if (k === 'thumb') return undefined;
      if (this === p && (k === 'vlink' || (cur && (k === 'snap' || k === 'anim')))) return undefined;
      if (k === 'snap' && look && v && typeof v === 'object' && !Array.isArray(v)) {
        var o = {};
        Object.keys(v).forEach(function (x) { if (!Object.prototype.hasOwnProperty.call(look, x)) o[x] = v[x]; });
        return o;
      }
      if (blank(v) && !Array.isArray(this)) return undefined;
      return v;
    });
  }
  /* 항목 전체의 지문. e = {snap(captureSnap), frames(anim.frames), active, hold, title, titleColor, pages, idx, look(__lookNow), bk(__bkSig)} */
  function itemSig(e) {
    var cs = e.snap || {}, look = e.look || null, lk = {};
    // 겉모습은 지금 판에서(look 을 모르면 판 전체가 아래 board 에 들어간다)
    if (look) Object.keys(cs).sort().forEach(function (k) { if (has(look, k)) lk[k] = cs[k]; });
    var board = snapSig(cs, look);
    var fs = Array.isArray(e.frames) ? e.frames : [];
    var act = (e.active >= 0 && e.active < fs.length) ? e.active : -1;
    var fr = fs.map(function (f, i) { return frameSig(f, i === act ? board : null, look); }).join('|');
    var pg = '';
    if (Array.isArray(e.pages)) pg = e.pages.map(function (p, i) { return pageSig(p, i === e.idx, look); }).join('|') + '@' + e.idx + '/' + e.pages.length;
    return JSON.stringify(lk) + '#' + fr + (act < 0 ? '#' + JSON.stringify(board) : '') +
      '#' + JSON.stringify([e.hold, e.title || '', e.titleColor || '']) + '#' + (e.bk || '') + '#' + pg;
  }
  /* 페이지 옮기기로 칠 수 있나 — 같은 페이지 묶음 · 같은 차례(같은 페이지 객체가 같은 자리) · 같은 항목이고 지금 페이지만 바뀌었다.
     지우기 · 더하기 · 순서 바꾸기 · 다른 항목 열기는 여기서 걸러져 «변경 있음»을 그대로 묻는다. */
  function isSwitch(pre, now) {
    if (!pre || !now || !now.pages || now.pages !== pre.ref || now.vid !== pre.vid || now.idx === pre.idx) return false;
    if (now.pages.length !== pre.order.length) return false;
    for (var i = 0; i < pre.order.length; i++) if (now.pages[i] !== pre.order[i]) return false;
    return true;
  }

  function mount(W) {
    if (!W || W.__psVaultBrowse) return null;
    var doc = W.document;
    var hyd = W.__vaultHydrating, touched = false, browsing = 0, pre = null, hooked = false;

    function pagesNow() {
      var P = W.__psPages, pages = null, idx = 0;
      try { pages = P && P.pg ? P.pg() : null; } catch (_) { pages = null; }
      try { idx = P && P.book && P.book.idx ? P.book.idx() : 0; } catch (_) { idx = 0; }
      return { pages: Array.isArray(pages) ? pages : null, idx: idx, vid: W.__curVaultId };
    }
    // 본문의 let/const 전역(anim · animActive · animHold · animPlaying)은 window 속성이 아니다 — 이름으로 읽는다
    function env() {
      var a = null, act = -1, hold = null, look = null, bk = '';
      try { a = anim; } catch (_) { a = null; }   // eslint-disable-line no-undef
      try { act = animActive; } catch (_) { act = -1; }   // eslint-disable-line no-undef
      try { hold = animHold; } catch (_) { hold = null; }   // eslint-disable-line no-undef
      try { look = W.__lookNow ? W.__lookNow() : null; } catch (_) { look = null; }
      try { bk = W.__bkSig ? String(W.__bkSig()) : ''; } catch (_) { bk = ''; }
      var P = pagesNow();
      return { snap: W.captureSnap(), frames: a && Array.isArray(a.frames) ? a.frames : [], active: act, hold: hold,
        title: (a && a.title) || '', titleColor: (a && a.titleColor) || '', pages: P.pages, idx: P.idx, look: look, bk: bk };
    }
    function sigNow() { try { return itemSig(env()); } catch (_) { return null; } }
    function playing() { try { return !!animPlaying; } catch (_) { return false; } }   // eslint-disable-line no-undef
    function busy() { return playing() || !!W.__animExport || !!W.__psThumbCapturing; }
    // curType()==="board" 와 같은 뜻 + 보관함에서 고쳐 쓰는 중 · 다 열렸다
    function watched() {
      var v = W.__csView || 'board';
      return v !== 'match' && v !== 'meeting' && !!W.__vaultEdit && !W.__vaultReadOnly && !!W.__curVaultId && !W.__vaultPending && !hyd;
    }
    // 새 길이 움직이는 때 — 지문이 있고 아직 «변경 있음»이 아니다. 그 밖은 예전 그대로
    function active() { return watched() && !!W.__vaultSavedSig && !W.__vaultManualDirty; }
    function clean() { var s = sigNow(); return !!s && s === W.__vaultSavedSig; }

    // ── 다 열린 모습이 «저장된 지문» ──
    function baseline() {
      if (!watched() || touched || W.__vaultManualDirty || busy()) return;
      W.__vaultSavedSig = sigNow() || null;
    }
    try {
      Object.defineProperty(W, '__vaultHydrating', { configurable: true, enumerable: true,
        get: function () { return hyd; },
        set: function (v) {
          var was = !!hyd; hyd = v;
          if (v && !was) { touched = false; W.__vaultSavedSig = null; }   // 새 항목 — 앞 항목의 지문은 버린다
          else if (!v && was) { try { baseline(); } catch (_) {} }
        } });
    } catch (_) {}
    // 열리는 동안(420ms) 사람이 손댔으면 그 모습을 «저장된 지문»으로 삼지 않는다 — 예전처럼 묻는다
    ['pointerdown', 'keydown', 'input', 'change', 'drop', 'paste'].forEach(function (t) {
      try { doc.addEventListener(t, function () { if (hyd) touched = true; }, true); } catch (_) {}
    });

    // ── 나가기 직전에 견준다 ──
    function exitCheck() {
      try {
        if (!active()) return;
        if (playing()) { try { W.restoreAnimBeforeCapture(); } catch (_) {} }   // 재생 중이면 재생 전 판으로 돌린 뒤(나가기도 그렇게 한다)
        if (!busy() && clean()) return;
        W.__vaultSavedSig = null; W.__vaultManualDirty = true;
      } catch (_) { try { W.__vaultManualDirty = true; } catch (__) {} }
    }
    try {
      W.addEventListener('click', function (e) {
        var t = e && e.target;
        if (t && t.closest && t.closest('#vCreateCancel,#vvClose,#vCreateBackMatch')) exitCheck();
      }, true);
      W.addEventListener('beforeunload', exitCheck, true);
    } catch (_) {}

    // ── 둘러보기(장면 고르기) — 앞에서 견주어 같았으면 옮긴 뒤 모습이 새 지문, 달랐으면 «변경 있음» ──
    function browse(fn) {
      if (browsing || pre || !active() || busy()) return fn();
      var was = clean();
      browsing++;
      try { return fn(); }
      finally {
        browsing--;
        try {
          if (was && active()) W.__vaultSavedSig = sigNow() || null;
          else if (!was) W.__vaultAutoSaveSchedule();
        } catch (_) {}
      }
    }
    // ── 페이지 옮기기 — switchTo 의 restoreAnimBeforeCapture 가 «옮기기 전», 같은 태스크의 persist 가 «옮긴 뒤» ──
    function notePre() {
      if (!active()) { pre = null; return; }
      var P = pagesNow();
      if (!P.pages) { pre = null; return; }
      var mine = { ref: P.pages, order: P.pages.slice(), idx: P.idx, vid: P.vid, clean: clean() };
      pre = mine;
      try { Promise.resolve().then(function () { if (pre === mine) pre = null; }); } catch (_) { pre = null; }
    }
    function afterSwitch() {
      if (!pre || !pre.clean || !isSwitch(pre, pagesNow())) return false;
      W.__vaultSavedSig = sigNow() || null;
      return true;
    }

    function hook() {
      if (hooked) return true;
      var sch = W.__vaultAutoSaveSchedule, rab = W.restoreAnimBeforeCapture, saf = W.selectAnimFrame;
      if (typeof sch !== 'function' || typeof rab !== 'function' || typeof saf !== 'function' || typeof W.captureSnap !== 'function' || typeof W.__vaultEditSig !== 'function') return false;
      hooked = true;
      W.__vaultEditSig = sigNow;   // «저장» 뒤 지문(2.975 doViewSaveOnly)도 같은 항목 전체 지문으로
      W.__vaultAutoSaveSchedule = function () {
        try {
          if (active()) {
            if (browsing) return;            // 장면을 옮기는 중 — 끝나면 browse 가 따진다
            if (afterSwitch()) return;       // 깨끗한 채 페이지를 옮겼다
            if (busy()) return;              // 판이 잠깐 다른 모습(재생 · 내보내기 · 썸네일)
          }
        } catch (_) {}
        return sch.apply(this, arguments);
      };
      W.restoreAnimBeforeCapture = function () {
        var r = rab.apply(this, arguments);
        try { notePre(); } catch (_) { pre = null; }
        return r;
      };
      W.selectAnimFrame = function () {
        var self = this, args = arguments;
        return browse(function () { return saf.apply(self, args); });
      };
      return true;
    }
    var tries = 0;
    function boot() { if (!hook() && ++tries < 80) W.setTimeout(boot, 250); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();

    var api = { sig: sigNow, browse: browse, baseline: baseline, exitCheck: exitCheck,
      state: function () { return { hooked: hooked, baseline: !!W.__vaultSavedSig, touched: touched, pre: !!pre, watched: watched() }; } };
    W.__psVaultBrowse = api;
    return api;
  }

  /* ── 3.134 폰으로 보는 보관함 작전판(보기 전용) ──
     사용자 피드백 «폰에서 작전판 보기 — 운동장이 가로로 작게 나와 번호가 안 보임». 보관함 «보기» · «전체화면»은 저장된 방향(대개 가로)
     그대로라 세로 화면의 1/3 만 쓰고, 선수는 지름 8~10px · 번호 5px 이었다. 장면이 있어도 폰에는 재생 단추가 없었고(장면 줄은 폰에서 숨는다),
     막대(이름 · 편집 · 전체화면 · 닫기)가 두 줄로 접혀 페이지 띠를 덮었다.
     커뮤니티 뷰어(3.065 · 3.066 · 3.067)와 같은 규칙으로 «보기만» 바꾼다 — 저장본 · 작업 보드는 그대로:
     · 폰 폭(≤600)의 보기 전용 작전판은 세로로 그린다: loadSnap · renderInterp 에 넘기는 판의 얕은 사본만 orientation 'v'(판 좌표는 그대로,
       그리는 방향만). 폰을 가로로 돌리면 원래 방향으로 되돌린다.
     · 선수는 커뮤니티 뷰어와 같은 배율(COMM_PHONE_TOK 1.6, commViewTok — 그리는 배율만, tokenScale 은 그대로).
     · 장면이 둘 이상이면 판 왼쪽 위 «▶ 재생»(본문 playAnim — 장면 줄의 재생 단추와 같은 길, 패턴북은 띠에 제 단추가 있어 뺀다) ·
       막대는 한 줄(이름은 줄임표 — 두 줄로 접혀 페이지 띠를 덮었다). */
  var PHONE_W = 600;
  var PHONE_CSS = [
    'body.ps-vv-phone #vCreateBar{flex-wrap:nowrap!important}',
    'body.ps-vv-phone #vCreateBar #vCreateTitle{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    'body.ps-vv-phone #vCreateBar .vcb-sp,body.ps-vv-phone #vCreateBar #vCreateFlow{display:none!important}',
    'body.ps-vv-phone #vCreateBar .btn{flex:none}',
    // 판 영역(#boardStage) 왼쪽 위 — 아래쪽은 장면 자막(#animCapBar, 아래 56px · 폭 86%)이 쓰고, 전체화면은 오른쪽 위에 이름 · 닫기가 있다
    '#psVvPlay{position:absolute;left:10px;top:10px;z-index:60;display:none;align-items:center;gap:7px;height:44px;padding:0 18px;border-radius:999px;' +
      'border:1px solid var(--line,#E3E6EA);background:var(--panel,#fff);color:var(--txt,#14161A);font:800 15px/1 Pretendard,-apple-system,"Apple SD Gothic Neo",sans-serif;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer;-webkit-tap-highlight-color:transparent;font-variant-numeric:tabular-nums}',
    'body.ps-vv-phone.ps-vv-anim #psVvPlay{display:inline-flex}',
    '#psVvPlay svg{width:14px;height:14px;flex:none}'
  ].join('');
  var PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>';
  var PAUSE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  // 보기 전용 작전판 · 패턴북(보관함 «보기» · «큰 화면으로 보기» · «전체화면»)을 폰 폭으로 보는 중 — 미팅 · 커뮤니티 · 훈련 편집기는 따로
  function phoneViewOn(W) {
    var b = W.document && W.document.body; if (!b) return false; var c = b.classList;
    return c.contains('vcreating') && !!W.__vaultViewMode && !!W.__vaultReadOnly && !c.contains('meet-mode') &&
      !c.contains('comm-viewing') && !c.contains('editing') && (W.innerWidth || 0) <= PHONE_W;
  }
  // 세로로 그릴 판 — 이미 세로(세트피스 · 세로 판)는 그대로. 얕은 사본이라 저장본 · 장면 목록은 안 바뀐다
  function upright(s) {
    if (!s || typeof s !== 'object' || s.orientation === 'v') return s;
    var o = {}; Object.keys(s).forEach(function (k) { o[k] = s[k]; });
    o.orientation = 'v'; o.spFlip = false; return o;
  }
  function mountPhone(W) {
    if (!W || !W.document || W.__psVaultPhone) return null;
    W.__psVaultPhone = true;
    var doc = W.document, orig = null, btn = null, hooked = false, mo = null, seenPlay = null, seenStrip = null;
    function st() { try { return state; } catch (_) { return null; } }   // eslint-disable-line no-undef
    function frameCount() { try { return anim && anim.frames ? anim.frames.length : 0; } catch (_) { return 0; } }   // eslint-disable-line no-undef
    function isPlaying() { try { return !!animPlaying; } catch (_) { return false; } }   // eslint-disable-line no-undef
    function redraw() { try { W.applyView(); W.renderTokens(); W.renderDrawings(); } catch (_) {} }
    // 클래스는 다를 때만 바꾼다 — body 클래스 감시가 제 변경에 다시 불려도 멈춘다(CLAUDE.md 함정)
    function cls(name, on) { var c = doc.body.classList; if (c.contains(name) !== !!on) c.toggle(name, !!on); }
    function label() {
      if (!btn) return; var p = isPlaying(), want = (p ? PAUSE_SVG + '멈춤' : PLAY_SVG + '재생 · 장면 ' + frameCount());
      if (btn.__psL !== want) { btn.__psL = want; btn.innerHTML = want; btn.setAttribute('aria-label', p ? '애니메이션 멈춤' : '애니메이션 재생'); }
    }
    function sync() {
      if (!doc.body) return;
      var on = phoneViewOn(W);
      // 패턴북은 페이지 띠에 자기 «▶ 재생»이 있다 — 세로로 세우기만 하고 단추는 두 벌 두지 않는다
      cls('ps-vv-phone', on); cls('ps-vv-anim', on && !W.__vaultBook && frameCount() >= 2);
      if (!doc.body.classList.contains('vcreating')) orig = null;
      var pb = doc.getElementById('animPlay'), fs = doc.getElementById('animFrames');
      if (mo && pb && pb !== seenPlay) { seenPlay = pb; try { mo.observe(pb, { attributes: true, attributeFilter: ['aria-pressed'] }); } catch (_) {} }
      if (mo && fs && fs !== seenStrip) { seenStrip = fs; try { mo.observe(fs, { childList: true }); } catch (_) {} }
      label();
    }
    // 폰을 돌리면: 세로 화면이면 세로로, 가로 화면이면 연 때의 방향으로
    function reorient() {
      var s = st(); if (!s || doc.getElementById('psEyeDialog') || !doc.body.classList.contains('vcreating') || !W.__vaultViewMode || !W.__vaultReadOnly) return;
      if (phoneViewOn(W)) { if (s.orientation !== 'v') { orig = { o: s.orientation || 'h', f: !!s.spFlip }; s.orientation = 'v'; s.spFlip = false; redraw(); } }
      else if (orig && s.orientation === 'v') { s.orientation = orig.o; s.spFlip = orig.f; orig = null; redraw(); }
      sync();
    }
    function hook() {
      if (hooked) return true;
      var ls = W.loadSnap, ri = W.renderInterp, cv = W.commViewTok;
      if (typeof ls !== 'function' || typeof ri !== 'function' || typeof cv !== 'function') return false;
      W.loadSnap = function (s, o) {
        if (phoneViewOn(W)) { var u = upright(s); if (u !== s) orig = { o: (s && s.orientation) || 'h', f: !!(s && s.spFlip) }; s = u; }
        return ls.call(this, s, o);
      };
      W.renderInterp = function (a, b, u, c) { if (phoneViewOn(W)) { a = upright(a); b = upright(b); } return ri.call(this, a, b, u, c); };
      // 0 = 뷰어 아님(편집기 축소 규칙으로) · 커뮤니티 뷰어는 그 값 그대로
      W.commViewTok = function () { var r = cv.apply(this, arguments); if (r) return r; return (phoneViewOn(W) && !W.__psThumbNoEd) ? (+W.COMM_PHONE_TOK || 1.6) : r; };
      hooked = true; return true;
    }
    function start() {
      var css = doc.createElement('style'); css.id = 'psVaultPhoneCss'; css.textContent = PHONE_CSS; (doc.head || doc.documentElement).appendChild(css);
      btn = doc.createElement('button'); btn.type = 'button'; btn.id = 'psVvPlay';
      btn.addEventListener('click', function (e) { e.stopPropagation(); try { if (typeof W.playAnim === 'function') W.playAnim(); } catch (_) {} W.setTimeout(sync, 0); });
      (doc.getElementById('boardStage') || doc.body).appendChild(btn);
      try { if (W.MutationObserver) { mo = new W.MutationObserver(sync); mo.observe(doc.body, { attributes: true, attributeFilter: ['class'] }); } } catch (_) {}
      var t = 0; W.addEventListener('resize', function () { W.clearTimeout(t); t = W.setTimeout(reorient, 180); });
      var n = 0; (function tryHook() { if (!hook() && ++n < 80) W.setTimeout(tryHook, 250); })();
      sync();
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
    return { sync: sync, reorient: reorient, on: function () { return phoneViewOn(W); }, hooked: function () { return hooked; } };
  }

  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) {
    try { mount(window); } catch (_) {}
    try { window.__psVaultPhoneApi = mountPhone(window); } catch (_) {}
  }
  return { itemSig: itemSig, frameSig: frameSig, pageSig: pageSig, snapSig: snapSig, isSwitch: isSwitch, mount: mount,
    mountPhone: mountPhone, phoneViewOn: phoneViewOn, upright: upright, PHONE_CSS: PHONE_CSS };
});
