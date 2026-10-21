/* PROCESS STUDIO — 작전판에서 뜨는 것들을 한 결로(3.141, 사용자 «디자인들 특히 신경써줘 · 보드만들면서 뜨는 것들 전부 잘 정리해줘»).
   - 공통 토큰 --pop-*: 밝은 카드(선수 속성 패널 3.080 과 같은 재질 · 반지름 14 · 그림자 하나) — 다크 모드(body.fmdark) · 글래스 도크에서는 짙은 카드.
   - 선택 옆 패널(.sel-ctl.sel-near — 그림 · 글 · 묶음, 컴퓨터 · 아이패드): 검정 작은 카드(1.846, 124px · 26px 단추 · «맨 뒤»가 혼자 줄바꿈)를
     밝은 카드 224px 로(2.608 «얇고 길게»의 124px 1열은 «맨 뒤»가 생기며 줄이 하나 더 늘었다 — 가로로 조금 넓히고 세로를 줄인다) — 머리글, 6칸 격자(복제 · 맨 앞 · 맨 뒤 한 줄 · 좌우 · 상하 한 줄 · 삭제 전폭 · 묶음의 토글은 한 줄 셋). 선수 패널(.ps-insp-on)은 그대로.
   - 도형 오른쪽 클릭 메뉴(board-shape-menu.js)가 열린 동안 옆 패널은 숨긴다 — 한 도형에 창이 둘 뜨지 않게(body.ps-shape-menu-on).
   - 알림(#cs-ftoast)은 도구 옵션 띠(#ps-df-opts) · 선수 · 장비 트레이(#ps-df-tray)를 가리지 않게 그 위로 올린다(띠가 열리고 닫힐 때도).
   - 메뉴(«보드 ▾» #ps-tb-menu · 장면 칩 .anim-frame-menu · 선 스타일 #lsPop)도 같은 반지름 · 글자 · 그림자.
   본문보다 먼저 읽힌다 — toast 는 DOMContentLoaded 에 감싼다. renderTokens 는 부르지 않는다(3.120). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSPopups = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var GAP = 12;   // 띠 위 알림 틈
  // 알림의 bottom(px): 보이는 띠들의 맨 위보다 GAP 위. 띠가 없으면 null(원래 자리).
  function toastBottom(vh, tops) {
    if (!tops || !tops.length) return null;
    return Math.round(vh - Math.min.apply(null, tops) + GAP);
  }
  var N6 = ':not(#_):not(#__):not(#___):not(#____):not(#_____):not(#______)';
  var N = 'html.ps-page-board body:not(.ps-dock):not(.ps-insp-on) .sel-ctl.sel-ctl.sel-near' + N6;
  function css() {
    var font = 'Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    return [
      // ── 토큰
      'html.ps-page-board body{--pop-bg:linear-gradient(180deg,rgba(255,255,255,.985),rgba(244,246,250,.97));--pop-solid:#fff;--pop-border:rgba(20,22,26,.08);--pop-shadow:inset 0 1px 0 #fff,0 14px 34px rgba(15,23,42,.22),0 2px 6px rgba(15,23,42,.08);--pop-ink:#1A2233;--pop-dim:#5E6675;--pop-line:rgba(20,33,61,.1);--pop-well:rgba(20,33,61,.06);--pop-well2:rgba(20,33,61,.12);--pop-accent:#14213D;--pop-on-ink:#fff;--pop-danger:#d7263d;--pop-danger-bg:rgba(215,38,61,.08);--pop-radius:14px}',
      'html.ps-page-board body.fmdark,html.ps-page-board body.ps-dock-float.ps-skin-glass{--pop-bg:linear-gradient(180deg,rgba(46,54,74,.94),rgba(22,26,38,.96) 55%,rgba(14,17,26,.97));--pop-solid:#1d2230;--pop-border:rgba(255,255,255,.09);--pop-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 18px 40px rgba(0,0,0,.5);--pop-ink:#E8ECF4;--pop-dim:rgba(232,236,244,.62);--pop-line:rgba(255,255,255,.1);--pop-well:rgba(255,255,255,.08);--pop-well2:rgba(255,255,255,.14);--pop-accent:#E8ECF4;--pop-on-ink:#14213D;--pop-danger:#ff6b7a;--pop-danger-bg:rgba(255,107,122,.12)}',
      // ── 선택 옆 패널(그림 · 글 · 묶음) — 밝은 카드
      N + '{width:224px!important;max-width:224px!important;min-width:0!important;padding:10px 12px 12px!important;border-radius:var(--pop-radius)!important;gap:6px!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;background:var(--pop-bg)!important;border:1px solid var(--pop-border)!important;border-radius:var(--pop-radius)!important;box-shadow:var(--pop-shadow)!important;color:var(--pop-ink)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important;font-family:' + font + '!important}',
      N + '::before{grid-column:1/-1!important;padding:0 2px 8px!important;margin:0 0 2px!important;border-bottom:1px solid var(--pop-line)!important;color:var(--pop-ink)!important;font-size:13px!important;font-weight:800!important;line-height:18px!important;letter-spacing:-.01em!important}',
      N + '>*{grid-column:1/-1!important}',
      N + '>.numbox,' + N + '>.namebox,' + N + '>.sizebox,' + N + '>#colorCtl,' + N + '>.gk-btn,' + N + '>.coach-btn,' + N + '>.dup-sel,' + N + '>.del-sel,' + N + '>.text-edit-btn,' + N + '>.text-color-field{height:34px!important;min-height:34px!important;border-radius:10px!important;background:var(--pop-well)!important;border:0!important;box-shadow:none!important;color:var(--pop-ink)!important;font-size:12.5px!important;font-weight:700!important;letter-spacing:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
      N + '>button:hover,' + N + '>.dup-sel:hover{background:var(--pop-well2)!important}',
      N + '>button.on,' + N + '>button.active,' + N + '>.gk-btn.on{background:var(--pop-accent)!important;color:var(--pop-on-ink)!important}',
      N + '>.numbox,' + N + '>.namebox{box-shadow:inset 0 1px 2px rgba(0,0,0,.1)!important}',
      N + '>.numbox input,' + N + '>.namebox input{color:var(--pop-ink)!important;background:transparent!important}',
      N + '>.numbox .numhash{color:var(--pop-dim)!important}',
      N + '>.sizebox button{background:var(--pop-solid)!important;color:var(--pop-ink)!important;box-shadow:0 1px 2px rgba(0,0,0,.12)!important;width:28px!important;height:28px!important;border-radius:8px!important;border:0!important}',
      N + '>.sizebox button:hover{background:var(--pop-solid)!important;opacity:.85}',
      N + '>.sizebox .szlbl,' + N + '>.sizebox .text-size-value,' + N + '>.text-color-field{color:var(--pop-dim)!important;font-size:12px!important;font-weight:700!important}',
      N + '>.text-color-field{justify-content:space-between!important;padding:0 10px!important}',
      N + '>#delSelBtn{color:var(--pop-danger)!important;background:var(--pop-danger-bg)!important}',
      N + '>#delSelBtn:hover{background:var(--pop-danger)!important;color:#fff!important}',
      N + '>#dupSelBtn,' + N + '>#frontSelBtn,' + N + '>#backSelBtn{grid-column:span 2!important;padding:0 4px!important;gap:4px!important;white-space:nowrap!important}',
      N + '>#mirHBtn,' + N + '>#mirVBtn{grid-column:span 3!important}',
      N + '[data-kind="multi"]>#numCtl{grid-column:span 2!important}',
      N + '[data-kind="multi"]>#nameCtl{grid-column:span 4!important}',
      N + '[data-kind="multi"]>:is(#ringCtl,#coachBtn,#labelVisBtn,#photoBtn,#photoDelBtn,#visBtn,#visBlindBtn,#trailBtn,#lookBtn,#shaperBtn,#ballLookBtn,#lockSelBtn,#gkBtn){grid-column:span 2!important;padding:0 4px!important}',
      // 도형 오른쪽 클릭 메뉴가 열린 동안은 옆 패널을 숨긴다(한 도형에 창 둘)
      'html.ps-page-board body.ps-shape-menu-on .sel-ctl.sel-ctl.sel-near' + N6 + '{display:none!important}',
      // ── 메뉴들 — 같은 카드
      '.anim-frame-menu{min-width:150px!important;padding:6px!important;border-radius:var(--pop-radius)!important;background:var(--pop-solid)!important;border:1px solid var(--pop-border)!important;box-shadow:var(--pop-shadow)!important;color:var(--pop-ink)!important}',
      '.anim-frame-menu button{height:36px!important;padding:0 12px!important;border-radius:9px!important;font-size:13px!important;font-weight:700!important}',
      '.anim-frame-menu button.af-move{color:var(--pop-ink)!important}',
      '.anim-frame-menu button.af-move:hover{background:var(--pop-well)!important;color:var(--pop-ink)!important}',
      '.anim-frame-menu button:disabled{opacity:.4}',
      '.anim-frame-menu button.af-danger{color:var(--pop-danger)!important;margin-top:4px!important;border-top:1px solid var(--pop-line)!important;border-radius:0 0 9px 9px!important}',
      '.anim-frame-menu button.af-danger:hover{background:var(--pop-danger-bg)!important}',
      '#ps-tb-menu{background:var(--pop-solid)!important;border:1px solid var(--pop-border)!important;box-shadow:var(--pop-shadow)!important;color:var(--pop-ink)!important;padding:6px!important}',
      '#ps-tb-menu>button{font-size:13px!important;font-weight:700!important;height:36px!important}',
      '#ps-tb-menu>button:hover{background:var(--pop-well)!important}',
      '#lsPop{background:var(--pop-bg)!important;border:1px solid var(--pop-border)!important;box-shadow:var(--pop-shadow)!important;color:var(--pop-ink)!important;border-radius:var(--pop-radius)!important}',
      '#lsPop::after{background:var(--pop-solid)!important;border-color:var(--pop-border)!important}',
      '#lsPop .ls-head{color:var(--pop-ink)!important;font-size:13px!important;font-weight:800!important}',
      '#lsPop .ls-lb{color:var(--pop-dim)!important;font-weight:600!important;font-size:12px!important}',
      '#lsPop .ls-val{color:var(--pop-ink)!important;font-size:12px!important}',
      '#lsPop .ls-seg button,#lsPop .ls-apply{background:var(--pop-well)!important;border:0!important;color:var(--pop-ink)!important;border-radius:8px!important;font-weight:700!important}',
      '#lsPop .ls-seg button.on{background:var(--pop-accent)!important;color:var(--pop-on-ink)!important}',
      '#lsPop .ls-apply{height:34px!important;border-radius:10px!important}',
      '#lsPop .ls-apply:active{background:var(--pop-accent)!important;color:var(--pop-on-ink)!important}',
      '#lsPop input#lsZoneName{border:0!important;background:var(--pop-well)!important;color:var(--pop-ink)!important;border-radius:8px!important}'
    ].join('\n');
  }

  function install(win) {
    win = win || (typeof window !== 'undefined' ? window : null);
    if (!win || !win.document || win.__psPopups) return null;
    var doc = win.document;
    var st = doc.createElement('style'); st.id = 'psPopupsCss'; st.textContent = css();
    (doc.head || doc.documentElement).appendChild(st);

    // 알림을 띠 위로
    function strips() { return ['ps-df-opts', 'ps-df-tray'].map(function (id) { return doc.getElementById(id); }).filter(Boolean); }
    function watch() {
      strips().forEach(function (e) {
        if (e.__psPopObs) return; e.__psPopObs = true;
        try { new win.MutationObserver(function () { raise(); }).observe(e, { attributes: true, attributeFilter: ['class', 'style'] }); } catch (_) {}
      });
    }
    function raise() {
      var t = doc.getElementById('cs-ftoast'); if (!t) return null;
      watch();
      var tops = [];
      strips().forEach(function (e) {
        var cs = win.getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return;
        var r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) tops.push(r.top);
      });
      var b = toastBottom(win.innerHeight || doc.documentElement.clientHeight, tops);
      if (b == null) {
        if (t.__psRaised) { t.style.setProperty('bottom', t.__psBottom0 || '84px'); t.__psRaised = false; }
        return null;
      }
      if (!t.__psRaised) t.__psBottom0 = t.style.bottom || '84px';
      t.style.setProperty('bottom', b + 'px', 'important'); t.__psRaised = true;
      return b;
    }
    function go() {
      var _t = win.toast;
      if (typeof _t === 'function') win.toast = function () { var r = _t.apply(this, arguments); try { raise(); } catch (_) {} return r; };
      try { watch(); } catch (_) {}
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
    var api = { raise: raise };
    win.__psPopups = api;
    return api;
  }

  var api = { toastBottom: toastBottom, css: css, install: install, GAP: GAP };
  if (typeof window !== 'undefined' && window.document) { try { install(window); } catch (_) {} }
  return api;
});
