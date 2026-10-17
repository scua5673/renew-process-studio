/* PROCESS STUDIO — 보드 설정 창 모양(3.087 · 사용자 «보드설정 레이아웃과 디자인 더 잘 만들어줘»).
   줄마다 [라벨 열 | 조절] 두 칸 격자 — 라벨은 한 열에, 단추 묶음은 오른쪽 끝까지 같은 폭으로. 묶음 제목은 옅은 글자 + 가는 선.
   선택지가 여섯 이상(피치 · 전술 구역 · 운동장 개수)이거나 글자가 긴 묶음(분석 그래픽)은 세 칸씩 두 줄.
   이름표 묶음 안의 줄은 «위치 · 크기 · 모양 · 글꼴»(묶음 제목이 이미 «이름표» — 같은 말을 되풀이하지 않는다).
   모양만 바꾼다 — 줄의 차례 · 핸들러는 board.html 의 PLAN 그대로. 기존 규칙(:is 사슬 · id 넷)을 이기려고 id 다섯. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSSettingsSkin = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var P = 'html body #cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop';
  var V = P + ' #viewMenu';
  // 묶음 제목 «이름표» 아래 줄 이름(데스크톱 창 — 묶음 제목이 있을 때만. 폰의 옛 목록은 제목이 없어 그대로 둔다)
  var NAME_LBL = { namePosSeg: '위치', nameSizeSeg: '크기', nameStyleSeg: '모양', nameFontSeg: '글꼴' };
  function css() {
    return [
      // 머리 · 탭: 탭은 한 판(회색) 위의 흰 칩. 처음 열 때 첫 탭에 굵은 테두리(포커스)가 보이던 것 — 키보드로 옮길 때만
      P + ' .cmd-board-settings-head{padding:14px 14px 8px 18px!important;align-items:center!important}',
      P + ' .cmd-board-settings-title{font-size:15px!important;font-weight:800!important;letter-spacing:-.01em!important;color:var(--ink,#14161A)!important}',
      P + ' .cmd-board-settings-scope{font-size:10.5px!important;font-weight:700!important;padding:3px 8px!important;border-radius:999px!important;background:rgba(58,109,240,.1)!important;color:#2f5bd3!important;border:0!important;box-shadow:none!important}',
      P + ' .cmd-board-settings-tabs{margin:0 14px 4px!important;padding:3px!important;gap:2px!important;border-radius:12px!important;background:var(--fill,#F1F3F6)!important;border:0!important;box-shadow:none!important}',
      P + ' .cmd-board-settings-tabs>button{flex:1 1 0!important;height:32px!important;min-height:32px!important;border-radius:9px!important;font-size:12.5px!important;font-weight:650!important;color:var(--gray,#5E6675)!important;background:transparent!important;border:0!important;box-shadow:none!important;outline:none!important}',
      P + ' .cmd-board-settings-tabs>button.on{background:var(--surface,#fff)!important;color:var(--ink,#14213D)!important;font-weight:750!important;box-shadow:0 1px 2px rgba(16,24,40,.13),0 0 0 1px rgba(16,24,40,.04)!important}',
      P + ' .cmd-board-settings-tabs>button:focus:not(:focus-visible):not(.on){box-shadow:none!important;outline:none!important}',
      P + ' .cmd-board-settings-tabs>button:focus-visible{outline:2px solid #3A6DF0!important;outline-offset:1px!important}',
      P + ' .cmd-board-settings-tabs>button::before,' + P + ' .cmd-board-settings-tabs>button::after{display:none!important}',
      // 목록: 묶음 제목 = 옅은 작은 글자 + 위쪽 가는 선(탭의 첫 묶음은 선 없이)
      V + '{gap:0!important;padding:0 2px!important}',
      V + '>.bs-sec{font-size:11.5px!important;font-weight:750!important;color:#8A93A3!important;letter-spacing:.02em!important;margin:12px 0 2px!important;padding:12px 0 2px!important;border-top:1px solid var(--line,#EEF0F3)!important;background:none!important}',
      V + '>.bs-sec.bs-first{border-top:0!important;margin-top:2px!important;padding-top:4px!important}',
      // 줄: [라벨 64px | 조절]. display 는 건드리지 않는다 — 탭마다 · 조건마다 줄을 숨기는 규칙(display:none)이 그대로 일하게.
      //     조절이 둘이면(운동장 방향 + 90° 회전) 둘째는 글자 폭만큼
      V + '>.menurow{flex-wrap:nowrap!important;gap:10px!important;align-items:center!important;justify-content:flex-start!important;min-height:38px!important;padding:3px 0!important;margin:0!important;border:0!important;background:none!important}',
      V + '>.menurow>.menulbl{flex:0 0 64px!important;width:64px!important;min-width:64px!important;max-width:64px!important;font-size:12.5px!important;font-weight:600!important;color:var(--gray,#4B5563)!important;line-height:1.25!important;white-space:normal!important;word-break:keep-all!important;margin:0!important;padding:0!important}',
      V + '>.menurow>*:not(.menulbl){flex:1 1 0!important;min-width:0!important;margin:0!important}',
      V + '>.menurow>.seg+.seg{flex:0 0 auto!important;width:auto!important}',
      // 단추 묶음: 줄 끝까지, 단추는 같은 폭. 고른 것 = 흰 칩
      V + ' .seg:not([style*="display: none"]):not([style*="display:none"]){display:flex!important}',
      V + ' .seg{flex-wrap:nowrap!important;width:100%!important;box-sizing:border-box!important;gap:2px!important;padding:3px!important;border-radius:10px!important;background:var(--fill,#F1F3F6)!important;border:0!important;box-shadow:none!important}',
      V + ' .seg>button{flex:1 1 0!important;min-width:0!important;width:auto!important;height:30px!important;min-height:30px!important;padding:0 4px!important;font-size:12px!important;font-weight:600!important;color:var(--gray,#4B5563)!important;background:transparent!important;border:0!important;border-radius:8px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;box-shadow:none!important;line-height:30px!important}',
      V + ' .seg>button.on,' + V + ' .seg>button[aria-pressed="true"]{background:var(--surface,#fff)!important;color:var(--ink,#14213D)!important;font-weight:750!important;box-shadow:0 1px 2px rgba(16,24,40,.14),0 0 0 1px rgba(16,24,40,.04)!important}',
      V + ' .seg>button:hover:not(.on):not([aria-pressed="true"]){background:rgba(255,255,255,.6)!important;color:var(--ink,#14213D)!important}',
      // 어두운 화면: 고른 칩이 바탕과 거의 같아 보였다 — 한 단계 밝게
      'html body.fmdark #cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop #viewMenu .seg>button.on,html body.fmdark #cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop #viewMenu .seg>button[aria-pressed="true"],html body.fmdark #cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop .cmd-board-settings-tabs>button.on{background:rgba(255,255,255,.16)!important;color:#fff!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)!important}',
      'html body.fmdark #cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop #viewMenu .seg>button:hover:not(.on):not([aria-pressed="true"]){background:rgba(255,255,255,.07)!important;color:#fff!important}',
      // 선택지가 여섯 이상 · 글자가 긴 묶음 → 세 칸씩
      V + ' .seg:has(>:nth-child(6)):not([style*="display: none"]):not([style*="display:none"]),' + V + ' #analysisSeg{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}',
      V + ' .seg>:not(button){justify-self:center!important;align-self:center!important}',
      V + '>.menurow>.seg+.seg>button{flex:0 0 auto!important;padding:0 10px!important}',
      // 크기(－ ＋ 기본)
      V + ' #sizeGroup{display:flex!important;width:100%!important;gap:2px!important;padding:3px!important;border-radius:10px!important;background:var(--fill,#F1F3F6)!important;box-sizing:border-box!important}',
      V + ' #sizeGroup>*{flex:1 1 0!important;height:30px!important;min-height:30px!important;border:0!important;border-radius:8px!important;background:transparent!important;box-shadow:none!important;font-size:13px!important;font-weight:650!important;color:var(--ink,#14213D)!important;padding:0!important}',
      V + ' #sizeGroup>*:hover{background:var(--surface,#fff)!important}',
      // 실제 크기: 슬라이더 두 줄 — 큰 굵은 글자 대신 다른 줄과 같은 크기
      V + ' .rs-inline{display:flex!important;flex-direction:column!important;gap:4px!important;width:100%!important}',
      V + ' .rs-inline .rs-row{display:grid!important;grid-template-columns:28px minmax(0,1fr) 40px!important;align-items:center!important;gap:8px!important;margin:0!important}',
      V + ' .rs-inline .rs-name{font-size:12px!important;font-weight:650!important;color:var(--ink,#14213D)!important}',
      V + ' .rs-inline .rs-val{font-size:12px!important;font-weight:700!important;color:var(--gray,#4B5563)!important;text-align:right!important;font-variant-numeric:tabular-nums!important}',
      V + ' .rs-inline input[type=range]{width:100%!important;min-width:0!important;accent-color:#14213D!important;height:20px!important;margin:0!important}',
      // 줄 안의 혼자 선 단추(실제 크기로 · 지금 스타일 저장 · 새 보드로 정하기 · 해제)
      V + ' .rs-reset,' + V + ' .bs-presets>button,' + V + '>.menurow>.seg:not([id])>button{height:30px!important;min-height:30px!important;padding:0 12px!important;border-radius:9px!important;font-size:12px!important;font-weight:650!important}',
      V + ' .rs-reset{align-self:flex-start!important;border:1px solid var(--line,#E3E6EA)!important;background:var(--surface,#fff)!important;color:var(--ink,#14213D)!important;box-shadow:none!important}',
      // 글자 칸(광고판)
      V + ' input.ps-tilt-ad{width:100%!important;height:34px!important;border-radius:10px!important;border:1px solid transparent!important;background:var(--fill,#F1F3F6)!important;padding:0 12px!important;font-size:12.5px!important;box-sizing:border-box!important}',
      V + ' input.ps-tilt-ad:focus{border-color:#3A6DF0!important;background:var(--surface,#fff)!important;outline:none!important}',
      // 도움말: 조절 칸 아래에 맞춘다
      V + '>.bs-hint{margin:0 0 6px 74px!important;padding:0!important;font-size:11.5px!important;line-height:1.45!important;color:#8A93A3!important;background:none!important;border:0!important}',
      // 3.087 — 글자 크기 줄(사람 발밑 번호 패)은 «사람» 모양일 때만
      V + '>.menurow.ps-tag-off{display:none!important}'
    ].join('\n');
  }
  // 데스크톱 탭 창에서만 짧은 이름(묶음 제목 «이름표» 아래). 폰의 옛 목록은 묶음 제목이 없어 «크기»만으로는 칩 크기와 헷갈린다 — 원래 이름으로 둔다
  function relabel(doc) {
    var secs = [].slice.call(doc.querySelectorAll('#viewMenu > .bs-sec')); if (!secs.length) return false;
    // 데스크톱: 목록이 탭 창(#cmd-board-settings-pop) 안에 있다. 폰: 창 밖의 옛 목록(묶음 제목 없음)
    var pop = doc.getElementById('cmd-board-settings-pop'), vm = doc.getElementById('viewMenu');
    var short = !!pop && !!vm && pop.contains(vm) && secs.some(function (h) { return (h.textContent || '').trim() === '이름표'; });
    Object.keys(NAME_LBL).forEach(function (id) {
      var e = doc.getElementById(id), r = e && e.closest('.menurow'), l = r && r.querySelector('.menulbl'); if (!l) return;
      if (!l.hasAttribute('data-full')) l.setAttribute('data-full', l.textContent);
      var want = short ? NAME_LBL[id] : l.getAttribute('data-full'); if (l.textContent !== want) l.textContent = want;
    });
    return true;
  }
  function install(win) {
    var doc = win.document; if (!doc || doc.getElementById('ps-settings-skin-css')) return;
    var st = doc.createElement('style'); st.id = 'ps-settings-skin-css'; st.textContent = css();
    (doc.head || doc.documentElement).appendChild(st);
    // 묶음 제목은 작전판이 창을 짤 때(PLAN) 생긴다 — 그 뒤에 이름을 바꾼다
    var n = 0; (function tryIt() { if (relabel(doc) || ++n > 40) return; win.setTimeout(tryIt, 250); })();
    doc.addEventListener('click', function (e) { var t = e.target; if (t && t.closest && t.closest('#bpBoardSettings,#viewBtn,#cmd-board-settings-pop')) win.setTimeout(function () { relabel(doc); }, 60); }, true);
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) install(window);
  return { css: css, relabel: relabel, NAME_LBL: NAME_LBL, install: install };
});
