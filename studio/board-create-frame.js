/* PROCESS STUDIO — 만들기 화면 한 틀(3.084). 사용자 «보관함에서 훈련만들기는 어떻게 하는게 좋을까?» · «이것들 전부 같은 결로 만들고 싶어».
   보관함 «무엇을 만들까요?»의 종류(훈련 설계 · 작전판 · 패턴북 · 세트피스 · 미팅 자료)를 같은 틀로 맞춘다 — 1단계는 머리줄 + 훈련 만들기.
   - 머리줄(같은 모양): 종류 표시(색 · 글자) · 이름 · 저장 상태 … 나가기 · 저장. 보관함 만들기 띠(#vCreateBar)와 훈련 편집기 머리(#editorModal .modal-head) 둘 다.
   - 훈련 · 세트피스 편집기(body.editing, 넓은 화면): 운동장이 머리줄 아래를 가득 채우고, 훈련 탭은 작전판의 페이지 탭처럼 위 왼쪽에 떠 있는 덩어리,
     오른쪽 입력은 떠 있는 카드(선수 속성 패널과 같은 모양) — 머리줄의 패널 단추로 접으면 운동장이 넓어진다. 하단 도크는 운동장 가운데.
   노드는 옮기지 않는다(보드가 다시 그리는 자리 그대로) — 모양과 차례(CSS order)만 바꾼다. 폰(좁은 화면)은 그대로 둔다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSCreateFrame = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // 종류 — 보관함 «무엇을 만들까요?»의 표시와 같은 글자 · 색
  var KINDS = {
    train: { ic: '훈', color: '#1a8f66', name: '훈련' },
    setpiece: { ic: 'SP', color: '#44a6a6', name: '세트피스' },
    board: { ic: '판', color: '#3a6df0', name: '작전판' },
    book: { ic: '북', color: '#7a5af8', name: '패턴북' },
    meeting: { ic: 'M', color: '#d59c35', name: '미팅' }
  };
  // 머리줄 제목 글에서 종류를 읽는다(제목은 보드가 정한다: «훈련 세션 만들기» · «세트피스 만들기» · «작전판 만들기» · «패턴북 수정» · «미팅 만들기» …)
  function kindOf(title) {
    var t = String(title || '');
    if (/세트피스/.test(t)) return 'setpiece';
    if (/패턴북/.test(t)) return 'book';
    if (/미팅/.test(t)) return 'meeting';
    if (/훈련|드릴/.test(t)) return 'train';
    return 'board';
  }
  var PANEL_W = 340, GAP = 12;

  var N = []; for (var i = 0; i < 20; i++) N.push(':not(#cf' + i + ')');
  var NN = N.join('');
  var E = 'html.ps-page-board body.editing' + NN;            // 훈련 · 세트피스 편집기
  var M = E + ' #editorModal';
  var WIDE = '@media (min-width:1000px)';
  function css() {
    var card = 'background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,249,251,.97))!important;border:1px solid rgba(20,22,26,.07)!important;box-shadow:0 1px 0 #fff inset,0 2px 6px rgba(15,23,42,.06),0 14px 34px rgba(15,23,42,.14)!important;';
    var cardD = 'background:linear-gradient(180deg,#323845,#262B35)!important;border:1px solid rgba(255,255,255,.07)!important;box-shadow:0 14px 34px rgba(0,0,0,.45)!important;color:#E6E9EF!important;';
    var pill = 'background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(244,246,250,.95) 60%,rgba(232,236,243,.95))!important;border:1px solid rgba(20,22,26,.06)!important;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(15,23,42,.10),0 4px 12px rgba(15,23,42,.12)!important;';
    var H = ['#vCreateBar' + NN, M + ' .modal-head'];
    var h = function (s) { return H.map(function (x) { return x + s; }).join(','); };
    var head = [
      // ── 머리줄(두 곳 같은 모양 · 폰은 그대로: 폰 한 줄 규칙이 따로 있다) ──
      h('') + '{min-height:56px!important;height:56px!important;box-sizing:border-box!important;padding:0 12px 0 14px!important;gap:8px!important;align-items:center!important;background:var(--panel,#fff)!important;border-bottom:1px solid rgba(20,22,26,.08)!important;box-shadow:none!important;flex-wrap:nowrap!important;font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif!important}',
      h(' .cf-badge') + '{flex:none;width:26px;height:26px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font:900 11px/1 Pretendard,-apple-system,sans-serif;letter-spacing:-.04em;background:var(--cf-k,#3a6df0);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 1px 3px rgba(15,23,42,.18)}',
      '#vCreateBar' + NN + ' #vCreateTitle,' + M + ' #modalTitle{font:800 14px/1.2 Pretendard,-apple-system,sans-serif!important;color:var(--txt,#14161A)!important;white-space:nowrap!important;flex:none!important}',
      '#vCreateBar' + NN + ' .vcb-sub{font-size:12px!important;color:var(--txt-dim,#8A9099)!important}',
      // 단계 안내(1 만들기 › 2 이름·폴더 › 3 저장)는 걷는다 — 저장 단추 하나가 같은 흐름을 연다
      '#vCreateBar' + NN + ' .vcb-flow,' + M + ' #editorFlow{display:none!important}',
      // 이름 — 문서 제목처럼(테두리 없이, 올리면 옅은 바탕)
      M + ' #epNameTop{field-sizing:content;height:32px!important;min-width:140px!important;max-width:300px!important;padding:0 10px!important;border:1px solid transparent!important;border-radius:9px!important;background:transparent!important;font:700 14px/1 Pretendard,-apple-system,sans-serif!important;color:var(--txt,#14161A)!important;box-shadow:none!important}',
      M + ' #epNameTop:hover{background:rgba(20,33,61,.05)!important}',
      M + ' #epNameTop:focus{background:var(--panel,#fff)!important;border-color:rgba(58,109,240,.55)!important;box-shadow:0 0 0 3px rgba(58,109,240,.15)!important;outline:0!important}',
      M + ' #editorSaveState,' + '#vCreateBar' + NN + ' #vCreateSub{font-size:11.5px!important;color:var(--txt-dim,#8A9099)!important}',
      M + ' .modal-head>.sep{flex:1 1 auto!important;min-width:8px!important}',
      // 단추 — 같은 높이 · 둥글기
      h(' .btn') + '{height:34px!important;min-height:34px!important;padding:0 14px!important;border-radius:10px!important;font:700 13px/1 Pretendard,-apple-system,sans-serif!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;box-shadow:none!important;white-space:nowrap!important}',
      // 보드가 숨겨 둔 단추(style display:none)는 그대로 숨김
      h(' .btn[style*="display:none"]') + ',' + h(' .btn[style*="display: none"]') + '{display:none!important}',
      h(' .btn svg') + '{flex:none!important;width:16px!important;height:16px!important;margin:0!important}',
      h(' .btn.ghost') + '{background:rgba(20,33,61,.06)!important;border:1px solid transparent!important;color:var(--txt,#14161A)!important}',
      h(' .btn.ghost:hover') + '{background:rgba(20,33,61,.1)!important}',
      h(' .btn.primary') + '{background:linear-gradient(180deg,#2A3D6E,#14213D 60%,#0D1630)!important;border:1px solid #14213D!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 2px 6px rgba(20,33,61,.3)!important}',
      M + ' .tw-rtop{height:28px!important;padding:0 10px!important;border-radius:999px!important;background:rgba(26,143,102,.1)!important;color:#137352!important;font:700 12px/28px Pretendard,-apple-system,sans-serif!important;border:0!important}',
      // 패널 접기 단추(훈련 편집기 머리줄)
      // 어두운 화면
      'html.ps-page-board body.fmdark #vCreateBar' + NN + ',html.ps-page-board body.fmdark.editing' + NN + ' #editorModal .modal-head{background:#1E222B!important;border-bottom-color:rgba(255,255,255,.07)!important}',
      'html.ps-page-board body.fmdark.editing' + NN + ' #editorModal .modal-head .btn.ghost,html.ps-page-board body.fmdark #vCreateBar' + NN + ' .btn.ghost{background:rgba(255,255,255,.08)!important;color:#E6E9EF!important}'
    ];
    return [
      // 폰(좁은 화면)에는 새 표시 · 단추를 두지 않는다
      '.cf-badge,.cf-panel-btn{display:none}',
      '@media (min-width:760px){' + head.join('') + '}',
      // ── 훈련 · 세트피스 편집기: 운동장 가득 + 떠 있는 탭 · 카드(넓은 화면) ──
      WIDE + '{' + [
        M + ' .cf-panel-btn{display:inline-flex!important;width:34px!important;padding:0!important}' + M + ' .cf-panel-btn[aria-pressed="false"]{color:var(--txt-dim,#8A9099)!important}',
        M + ' #modalStage{position:relative!important;background:var(--cf-stage,#F4F5F7)!important;padding:0!important;gap:0!important}',
        M + ' #editorBoardWrap{position:relative!important;flex:1 1 auto!important;min-width:0!important;margin:0 ' + (PANEL_W + GAP * 2) + 'px 0 0!important;padding:0!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important}',
        E + '.cf-panel-off #editorModal #editorBoardWrap{margin-right:0!important}',
        // 훈련 탭 = 작전판 페이지 탭 덩어리
        M + ' #trainingStrip{position:absolute!important;top:8px!important;left:12px!important;z-index:62!important;display:flex!important;align-items:center!important;gap:2px!important;height:36px!important;box-sizing:border-box!important;padding:0 4px!important;margin:0!important;border-radius:12px!important;max-width:calc(100% - 24px)!important;overflow-x:auto!important;scrollbar-width:none;' + pill + 'font-family:Pretendard,-apple-system,sans-serif!important}',
        M + ' #trainingStrip::-webkit-scrollbar{display:none}',
        M + ' #trainingStrip .tr-tab{height:28px!important;padding:0 6px 0 10px!important;border-radius:8px!important;border:0!important;background:transparent!important;color:#5E6675!important;font:700 12.5px/1 Pretendard,-apple-system,sans-serif!important;display:inline-flex!important;align-items:center!important;gap:3px!important;white-space:nowrap!important;box-shadow:none!important;flex:none!important}',
        M + ' #trainingStrip .tr-tab:hover{background:rgba(20,33,61,.06)!important;color:#14161A!important}',
        M + ' #trainingStrip .tr-tab.on{background:linear-gradient(180deg,#fff,#F1F3F7)!important;color:#14161A!important;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(15,23,42,.12),0 2px 5px rgba(15,23,42,.08)!important}',
        M + ' #trainingStrip .tr-tab .trdup{width:20px!important;height:20px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:6px!important;opacity:.5;margin:0!important;padding:0!important;background:transparent!important}',
        M + ' #trainingStrip .tr-tab .trdup:hover{opacity:1;background:rgba(20,33,61,.08)!important}',
        M + ' #trainingStrip .tr-tab .trdup svg{width:13px!important;height:13px!important}',
        M + ' #trainingStrip .tr-tab:not(.on) .trdup{display:none!important}',
        M + ' #trainingStrip .tr-add{height:28px!important;padding:0 10px!important;border-radius:8px!important;border:0!important;background:transparent!important;color:#14213D!important;font:700 12.5px/1 Pretendard,-apple-system,sans-serif!important;display:inline-flex!important;align-items:center!important;gap:5px!important;white-space:nowrap!important;box-shadow:none!important;flex:none!important}',
        M + ' #trainingStrip .tr-add:hover{background:rgba(20,33,61,.07)!important}',
        M + ' #trainingStrip .tr-add.tr-lib{margin-left:4px!important;padding-left:12px!important;border-left:1px solid rgba(20,22,26,.1)!important;border-radius:0 8px 8px 0!important;color:#5E6675!important}',
        M + ' #trainingStrip .tr-add.tr-lib svg{width:14px!important;height:14px!important}',
        // 오른쪽 입력 = 떠 있는 카드
        M + ' #editorPanel{position:absolute!important;top:6px!important;right:' + GAP + 'px!important;bottom:' + GAP + 'px!important;width:' + PANEL_W + 'px!important;max-width:' + PANEL_W + 'px!important;min-width:0!important;height:auto!important;box-sizing:border-box!important;z-index:61!important;display:flex!important;flex-direction:column!important;gap:0!important;padding:6px 14px 14px!important;border-radius:18px!important;overflow-y:auto!important;overscroll-behavior:contain;' + card + '}',
        E + '.cf-panel-off #editorModal #editorPanel{display:none!important}',
        // 차례: 이 훈련(이름 · 분 × 세트) → 인원 → 바탕 → 국면 → 세트피스 → 강도 → 항목
        M + ' #editorPanel>.ep-row{order:20;margin:0!important;padding:12px 0!important;border-bottom:1px solid rgba(20,22,26,.07)!important;border-top:0!important;background:transparent!important}',
        M + ' #editorPanel>.ep-row[class="ep-row"]:not([id]){order:1;padding:10px 0 6px!important;border-bottom:0!important}',
        M + ' #editorPanel>.ep-training-meta{order:2;padding:0 0 12px!important}',
        M + ' #editorPanel>.ep-roster-card{order:3;border:1px solid rgba(20,22,26,.08)!important;border-radius:12px!important;margin:12px 0 0!important;padding:0!important;background:rgba(20,33,61,.025)!important}',
        M + ' #editorPanel>#spTools{order:4;margin:12px 0 0!important}',
        M + ' #editorPanel>#epSurface{order:5}',
        M + ' #editorPanel>#epPhases{order:6}',
        M + ' #editorPanel>#epSetPiece{order:7}',
        M + ' #editorPanel>#epRpeRow{order:8}',
        M + ' #editorPanel>#epFields{order:9;padding-top:4px!important}',
        M + ' #editorPanel>#epAddField{order:10;margin-top:10px!important;align-self:stretch!important;justify-content:center!important;height:36px!important;border-radius:10px!important;border:1px dashed rgba(20,22,26,.18)!important;background:transparent!important}',
        // 이 훈련 이름은 카드 제목처럼
        M + ' #editorPanel>.ep-row[class="ep-row"]:not([id]) input{font:800 17px/1.2 Pretendard,-apple-system,sans-serif!important;height:38px!important;padding:0 8px!important;margin-left:-8px!important;border:1px solid transparent!important;border-radius:9px!important;background:transparent!important;box-shadow:none!important;width:calc(100% + 8px)!important}',
        M + ' #editorPanel>.ep-row[class="ep-row"]:not([id]) input:hover{background:rgba(20,33,61,.05)!important}',
        M + ' #editorPanel>.ep-row[class="ep-row"]:not([id]) input:focus{background:#fff!important;border-color:rgba(58,109,240,.55)!important;box-shadow:0 0 0 3px rgba(58,109,240,.15)!important;outline:0!important}',
        // 하단 도크 · 칸은 운동장(패널 왼쪽) 가운데
        E + ' #ps-command-dock' + NN + '{left:calc((100vw - ' + (PANEL_W + GAP * 2) + 'px) / 2)!important;max-width:calc(100vw - ' + (PANEL_W + GAP * 4) + 'px)!important}',
        E + '.cf-panel-off #ps-command-dock' + NN + ',' + E + '.cf-dock-full #ps-command-dock' + NN + '{left:50%!important;max-width:calc(100vw - 24px)!important}',
        // 운동장 칸이 도크보다 좁으면(1024 아이패드 등) 도크는 화면 가운데, 오른쪽 카드는 도크 위에서 끝난다
        E + '.cf-dock-full:not(.cf-panel-off) #editorModal #editorPanel{bottom:calc(var(--cf-dock-h,58px) + 26px)!important}',
        // 어두운 화면
        'html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #editorPanel{' + cardD + '}',
        'html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #trainingStrip{background:linear-gradient(180deg,#3A414E,#2A303B 55%,#20252E)!important;border-color:rgba(255,255,255,.06)!important}',
        'html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #trainingStrip .tr-tab,html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #trainingStrip .tr-add{color:rgba(230,233,239,.72)!important}',
        'html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #trainingStrip .tr-tab:hover,html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #trainingStrip .tr-add:hover{background:rgba(255,255,255,.08)!important;color:#fff!important}',
        'html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #trainingStrip .tr-tab.on{background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.08))!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 2px 6px rgba(0,0,0,.4)!important}',
        'html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #trainingStrip .tr-add.tr-lib{border-left-color:rgba(255,255,255,.1)!important}',
        'html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #epNameTop,html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #editorPanel>.ep-row[class="ep-row"]:not([id]) input{color:#E6E9EF!important}',
        'html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #epNameTop:focus,html.ps-page-board body.fmdark.editing' + NN + ' #editorModal #editorPanel>.ep-row[class="ep-row"]:not([id]) input:focus{background:rgba(255,255,255,.06)!important}'
      ].join('') + '}'
    ].join('\n');
  }

  function mount(win) {
    var doc = win.document, body = doc.body;
    if (!body || doc.getElementById('ps-create-frame-css')) return;
    var st = doc.createElement('style'); st.id = 'ps-create-frame-css'; st.textContent = css(); doc.head.appendChild(st);
    function badge(head, title) {
      if (!head || !title) return;
      var k = KINDS[kindOf(title.textContent)] || KINDS.board;
      var b = head.querySelector('.cf-badge');
      if (!b) { b = doc.createElement('span'); b.className = 'cf-badge'; b.setAttribute('aria-hidden', 'true'); head.insertBefore(b, title); }
      if (b.textContent !== k.ic) b.textContent = k.ic;
      b.style.setProperty('--cf-k', k.color);
    }
    function nudge() { win.setTimeout(function () { try { win.dispatchEvent(new win.Event('resize')); } catch (_) {} }, 0); }
    // 카드 바깥(패널 뒤) 바탕 = 운동장 무대 바탕(테마 · 다크 모드마다 다르다) — 이음매 없이
    function stageTone() {
      if (!body.classList.contains('editing')) return;
      var bs = doc.getElementById('boardStage'), ms = doc.getElementById('modalStage'); if (!bs || !ms) return;
      var c = win.getComputedStyle(bs).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && ms.style.getPropertyValue('--cf-stage') !== c) ms.style.setProperty('--cf-stage', c);
    }
    // 도크가 운동장 칸(패널 왼쪽)에 다 들어가는지 — 안 들어가면 cf-dock-full(화면 가운데 · 카드는 도크 위까지)
    function dockFit() {
      // 없는 class 를 remove 해도 속성 바뀜으로 잡혀(MutationObserver) 끝없이 돈다 — 있을 때만 걷는다
      if (!body.classList.contains('editing')) { if (body.classList.contains('cf-dock-full')) body.classList.remove('cf-dock-full'); return; }
      var dock = doc.getElementById('ps-command-dock'), row = doc.getElementById('cmd-tool-row'); if (!dock || !row) return;
      var need = Math.max(row.scrollWidth, dock.scrollWidth) + 4, room = win.innerWidth - (PANEL_W + GAP * 4);
      var full = win.innerWidth >= 1000 && need > room;
      if (body.classList.contains('cf-dock-full') !== full) body.classList.toggle('cf-dock-full', full);
      var h = Math.round(dock.getBoundingClientRect().height) || 58, ms = doc.getElementById('modalStage');
      if (ms && ms.style.getPropertyValue('--cf-dock-h') !== h + 'px') ms.style.setProperty('--cf-dock-h', h + 'px');
    }
    win.addEventListener('resize', function () { win.setTimeout(function () { stageTone(); dockFit(); }, 0); });
    // 훈련 편집기 머리줄의 «패널» 단추(넓은 화면) — 오른쪽 카드를 접고 펴서 운동장을 넓힌다
    function panelBtn(head) {
      if (!head || head.querySelector('.cf-panel-btn')) return;
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'btn ghost cf-panel-btn'; b.title = '오른쪽 입력 카드 접기 · 펴기'; b.setAttribute('aria-label', '입력 카드 접기 · 펴기');
      b.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/></svg>';
      var sync = function () { b.setAttribute('aria-pressed', body.classList.contains('cf-panel-off') ? 'false' : 'true'); };
      b.addEventListener('click', function (e) { e.stopPropagation(); body.classList.toggle('cf-panel-off'); sync(); nudge(); });
      var pdf = doc.getElementById('editorPdf'); head.insertBefore(b, pdf || head.querySelector('#editorCancel'));
      sync();
    }
    function paint() {
      var eh = doc.querySelector('#editorModal .modal-head'); if (eh) { badge(eh, doc.getElementById('modalTitle')); panelBtn(eh); }
      var vb = doc.getElementById('vCreateBar'); if (vb) badge(vb, doc.getElementById('vCreateTitle'));
    }
    paint();
    var was = body.classList.contains('editing');
    try {
      new win.MutationObserver(function () {
        var now = body.classList.contains('editing');
        if (now !== was) { was = now; if (!now && body.classList.contains('cf-panel-off')) body.classList.remove('cf-panel-off'); paint(); nudge(); }
        stageTone(); dockFit();
      }).observe(body, { attributes: true, attributeFilter: ['class'] });
      // 제목 글이 바뀌면(종류 · 수정/만들기) 표시를 다시. 보드 전체를 지켜보지 않는다(재생 중 매 장면 바뀌는 노드가 많다) — 제목 두 개만.
      //   보관함 만들기 띠는 처음 만들기를 누를 때 body 바로 아래에 생긴다 → body 의 바로 아래 자식만 본다
      var seen = [];
      var watchTitle = function (el) { if (!el || seen.indexOf(el) >= 0) return; seen.push(el); new win.MutationObserver(paint).observe(el, { childList: true, characterData: true, subtree: true }); };
      watchTitle(doc.getElementById('modalTitle'));
      watchTitle(doc.getElementById('vCreateTitle'));
      new win.MutationObserver(function () { var t = doc.getElementById('vCreateTitle'); if (t && seen.indexOf(t) < 0) { watchTitle(t); paint(); } }).observe(body, { childList: true });
    } catch (_) {}
  }

  function boot(win) {
    if (!win || !win.document) return;
    var go = function () { try { mount(win); } catch (_) {} };
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', go); else go();
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) boot(window);
  return { KINDS: KINDS, kindOf: kindOf, css: css, mount: mount, PANEL_W: PANEL_W };
});
