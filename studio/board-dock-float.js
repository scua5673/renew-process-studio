/* PROCESS STUDIO — 하단 도크 1단계(3.073): 떠 있는 도구 한 줄 + 도구를 고르면 그 도구의 옵션만.
   사용자 «하단도크 … 요즘 앱들처럼 멋지게»(목업 ① · ③). 컴퓨터 · 아이패드의 명령 도크(#ps-command-dock)에만 입힌다 — 폰 도크는 그대로.
   ⚠ 버튼은 복제하지 않는다: 원래 버튼(#toolSeg 의 도구들 · #swatches · #lineStyleBtn)을 그대로 누르게 해 기존 동작 · 단축키 · 저장이 그대로다.
   ① 도구 줄만 떠 있는 둥근 한 줄로 남기고, 장면 줄 · 선수·장비 줄은 그 위에 따로 떠서 한 줄의 버튼으로 열고 닫는다(2·3단계에서 칸 디자인을 바꾼다).
   ③ 화살표(런 · 패스 · 드리블) · 선(직선 · 점선 · 연결선 · 다각형) · 도형(구역 · 사각형 · 원 · 점선 사각형)을 한 칸씩으로 묶고,
      누르면 그 위에 종류 · 색 · 굵기가 뜬다. 한 칸은 마지막에 고른 종류의 그림을 보여 준다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSDockFloat = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var GROUPS = [
    { key: 'arrow', label: '화살표', tools: ['pass', 'run', 'dribble'] },
    { key: 'line', label: '선', tools: ['line', 'dashline', 'link', 'poly'] },
    { key: 'shape', label: '도형', tools: ['rect', 'rectline', 'ellipse', 'rectdash'] }
  ];
  var KIND = { pass: '패스', run: '런', dribble: '드리블', line: '직선', dashline: '점선', link: '연결선', poly: '다각형', rect: '구역', rectline: '사각형', ellipse: '원', rectdash: '점선 사각형' };
  var STORE = 'ps_dock_float_v1';
  function groupOf(tool) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].tools.indexOf(tool) >= 0) return GROUPS[i]; return null; }
  // 보이는 상태: 장면 줄 · 선수·장비 줄을 열었는지(기기에 남는다). 장면이 있으면 장면 줄은 저절로 열린다.
  function readOpen(ls) { var o = null; try { o = JSON.parse((ls || localStorage).getItem(STORE) || 'null'); } catch (_) { o = null; } o = o && typeof o === 'object' ? o : {}; return { panel: o.panel === 'team' || o.panel === 'equip' ? o.panel : '', tab: o.tab === 'form' ? 'form' : 'team', anim: o.anim === true || o.anim === false ? o.anim : null, last: o.last && typeof o.last === 'object' ? o.last : {} }; }
  function writeOpen(st, ls) { try { (ls || localStorage).setItem(STORE, JSON.stringify(st)); } catch (_) {} }

  // ══ 3.076 · 2단계 «선수» 칸(목업 ②): 선수 · 장비 · 포메이션 탭. 원래 팀 칩 · 연속 배치 토큰 · 장비 칩을 칸 안으로 옮겨(복제 안 함)
  //    카드처럼 다시 꾸민다 — 끌어서 놓기 · 연속 배치 · 내 장비 올리기가 그대로 된다. 포메이션은 작전판의 FORM 으로 미리보기 카드를 그린다.
  var T = 'html body.ps-dock-float #ps-df-tray:not(#dfa):not(#dfb):not(#dfc):not(#dfd):not(#dfe):not(#dff):not(#dfg):not(#dfh):not(#dfi):not(#dfj)', TEAMS = { blue: '팀 1', red: '팀 2', yellow: '팀 3', green: '팀 4' };
  var TRAY_CSS = [
    T + '{position:fixed;z-index:395;display:none;width:min(460px,calc(100vw - 24px));padding:14px;border-radius:22px;background:rgba(255,255,255,.95);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:0 18px 40px rgba(8,12,24,.3);border:1px solid rgba(20,22,26,.07);font-family:inherit;color:#14161A;max-height:60vh;overflow:auto}',
    T + '.on{display:block}',
    T + ' .df-tabs{display:flex;gap:4px;background:rgba(20,33,61,.06);padding:4px;border-radius:12px;margin-bottom:12px}',
    T + ' .df-tabs button{flex:1;border:0;background:transparent;font:700 13px/1 Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;padding:9px 0;border-radius:9px;color:#646A73;cursor:pointer}',
    T + ' .df-tabs button.on{background:#fff;color:#14161A;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
    T + ' .df-pane{display:none}' + T + ' .df-pane.on{display:block}',
    T + ' .df-h{font-size:11.5px;font-weight:700;color:#646A73;margin:10px 2px 7px}' + T + ' .df-h:first-child{margin-top:0}',
    T + ' .df-hint{font-size:12px;color:#646A73;font-weight:600;margin-top:12px}',
    // 팀 카드(원래 #benchCat 의 팀 알약)
    T + ' #benchCat{display:grid!important;grid-template-columns:repeat(4,1fr);gap:8px;width:auto!important;height:auto!important;background:transparent!important;padding:0!important;margin:0!important}',
    T + ' #benchCat>:not(.tpill){display:none!important}',
    T + ' #benchCat .tpill{opacity:1!important;width:auto!important;height:auto!important;min-height:0!important;flex-direction:column!important;display:flex!important;align-items:center!important;gap:6px!important;padding:10px 4px 8px!important;border-radius:14px!important;border:0!important;background:rgba(20,33,61,.045)!important;box-shadow:none!important;font-size:0!important;color:transparent!important;position:relative!important}',
    T + ' #benchCat .tpill::before{content:attr(data-df-n);width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--df-kit,#1a2f5c);color:var(--df-kit-ink,#fff);font:800 14px/34px Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;text-align:center;box-shadow:0 2px 5px rgba(0,0,0,.2)}',
    T + ' #benchCat .tpill::after{content:attr(data-df-label);font:700 12px/1 Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:#646A73}',
    T + ' #benchCat .tpill.on{background:rgba(20,33,61,.1)!important;box-shadow:inset 0 0 0 2px #14213D!important}' + T + ' #benchCat .tpill.on::after{color:#14161A}',
    // 역할 · 연속 배치 토큰(원래 #cmd-stamp-group)
    T + ' #cmd-stamp-group{display:flex!important;flex-wrap:wrap;gap:8px!important;height:auto!important;background:transparent!important;padding:0!important}',
    T + ' #cmd-stamp-group .cmd-stamp-token{white-space:nowrap!important;opacity:1!important;width:auto!important;min-width:64px!important;height:40px!important;padding:0 10px!important;border-radius:12px!important;font:800 13px/1 Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important}',
    T + ' #cmd-stamp-group .cmd-stamp-token::after{content:attr(data-df-label);font-weight:700;font-size:11.5px;opacity:.85}',
    // 장비 카드(원래 #cmd-equipment-group)
    T + ' #cmd-equipment-group{display:block!important;height:auto!important;background:transparent!important;padding:0!important}',
    T + ' #railEquip{display:grid!important;grid-template-columns:repeat(4,1fr);gap:8px!important;width:auto!important;height:auto!important;background:transparent!important;padding:0!important}',
    T + ' #railEquip .chip{width:auto!important;height:auto!important;min-height:64px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;border-radius:14px!important;background:rgba(20,33,61,.045)!important;padding:8px 4px!important;border:0!important}',
    T + ' #railEquip .chip svg,' + T + ' #railEquip .chip img{width:28px!important;height:28px!important}',
    T + ' #railEquip .chip::after{content:attr(title);font:700 11px/1.15 Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:#646A73;text-align:center;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
    T + ' #railEquip .chip.chip-upload::after{content:"내 장비"}',
    T + ' #cmd-equip-color{margin-top:10px!important;width:auto!important;height:34px!important;padding:0 12px!important;border-radius:10px!important}',
    // 한 번에 놓기
    T + ' .df-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;font-size:13px;font-weight:700}',
    T + ' .df-step{display:flex;align-items:center;gap:10px}' + T + ' .df-step button{width:32px;height:32px;border-radius:10px;border:0;background:rgba(20,33,61,.07);font:700 18px/1 Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;cursor:pointer}',
    T + ' .df-cta{border:0;background:#14213D;color:#fff;border-radius:12px;padding:10px 16px;font:700 13px/1 Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;cursor:pointer}',
    // 포메이션
    T + ' .df-seg{display:flex;gap:6px;margin-bottom:10px}' + T + ' .df-seg button{border:0;border-radius:10px;padding:7px 12px;background:rgba(20,33,61,.06);font:700 12.5px/1 Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;cursor:pointer}' + T + ' .df-seg button.on{background:#14213D;color:#fff}',
    T + ' .df-forms{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}',
    T + ' .df-form{border:0;padding:6px 4px 7px;border-radius:12px;background:rgba(20,33,61,.045);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;font:800 12px/1 Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:#14161A}',
    T + ' .df-form:hover{background:rgba(20,33,61,.1)}' + T + ' .df-form svg{width:100%;height:auto;border-radius:7px}',
    'body.fmdark #ps-df-tray{background:rgba(28,32,42,.95);color:#e8ebf0}'
  ].join('\n');
  var FORM_GROUPS = [['11인제', ['442', '433', '4231', '4312', '4321', '352', '343', '3142', '3412', '3421']], ['8인제', ['232', '331', '322', '241']], ['풋살', ['f121', 'f22', 'f31']]];
  var P = 'html.ps-page-board body.ps-dock-float #ps-command-dock' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n) { return ':not(#df' + n + ')'; }).join('');
  function css() {
    var glass = 'background:rgba(255,255,255,.9)!important;-webkit-backdrop-filter:blur(18px) saturate(1.4)!important;backdrop-filter:blur(18px) saturate(1.4)!important;border:1px solid rgba(20,22,26,.07)!important;border-radius:20px!important;box-shadow:0 10px 28px rgba(8,12,24,.22),0 1px 0 rgba(255,255,255,.7) inset!important;';
    return [
      P + '{left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:max-content!important;max-width:calc(100vw - 24px)!important;height:auto!important;min-height:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:8px!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;bottom:calc(14px + env(safe-area-inset-bottom))!important;grid-template-rows:none!important}',
      P + '>#floatBar{display:flex!important;flex-direction:column!important;align-items:center!important;gap:8px!important;height:auto!important;width:auto!important;background:transparent!important;padding:0!important}',
      P + '>#animBar,' + P + ' #drawPanel,' + P + ' #cmd-tool-row{' + glass + 'height:auto!important;min-height:0!important;width:auto!important;max-width:calc(100vw - 24px)!important;padding:6px 10px!important;overflow-x:auto!important;overflow-y:visible!important}',
      P + ' #drawPanel{padding:4px 10px!important}',
      P + ' #railL2{position:static!important;width:auto!important;height:auto!important}',
      P + ' #cmd-tool-row{display:flex!important;align-items:center!important;gap:4px!important;padding:6px 8px!important;border-radius:22px!important;overflow:visible!important;height:56px!important;min-height:56px!important}',
      P + ' #cmd-tool-row>*{flex:0 0 auto!important}',
      P + ' #cmd-tools{order:1!important}' + P + ' #cmd-style{order:2!important}' + P + ' #cmd-history{order:3!important}' + P + ' #ps-df-toggles{order:4!important}' + P + ' #cmd-tool-end{order:5!important}',
      P + ' #cmd-tool-row .cmd-cluster{height:auto!important;min-height:0!important;gap:2px!important;padding:0!important;background:transparent!important;box-shadow:none!important}',
      P + ' #cmd-tool-row .cmd-cluster+.cmd-cluster,' + P + ' #ps-df-toggles{margin-left:6px!important;padding-left:8px!important;border-left:1px solid rgba(20,22,26,.09)!important;border-radius:0!important}',
      P + ' #cmd-tools{margin-left:0!important;padding-left:0!important;border-left:0!important}' + P + ' #cmd-tool-end{margin-left:6px!important;padding-left:8px!important;border-left:1px solid rgba(20,22,26,.09)!important}' + P + ' #cmd-tool-end,' + P + ' #cmd-tool-end .menuwrap{width:auto!important;max-width:none!important;flex:0 0 auto!important}',
      P + ' #cmd-tools,' + P + ' #toolSeg{border:0!important;box-shadow:none!important}' + P + ' #toolSeg::before,' + P + ' #cmd-tools::before{display:none!important}',
      P + ' #toolSeg{display:flex!important;gap:2px!important;height:auto!important;padding:0!important;background:transparent!important}',
      P + ' #toolSeg>button,' + P + ' #cmd-tool-row .cmd-cluster>button.btn,' + P + ' #ps-df-toggles>button{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;flex:0 0 42px!important;padding:0!important;border-radius:13px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;background:transparent!important;border:0!important;color:#14161A!important;box-shadow:none!important;position:relative!important}',
      P + ' #toolSeg>button:hover,' + P + ' #cmd-tool-row .cmd-cluster>button.btn:hover,' + P + ' #ps-df-toggles>button:hover{background:rgba(20,33,61,.07)!important}',
      P + ' #toolSeg>button.on,' + P + ' #toolSeg>button[aria-pressed="true"]{background:#14213D!important;color:#fff!important;box-shadow:0 4px 10px rgba(20,33,61,.35)!important}',
      P + ' #ps-df-toggles>button[aria-pressed="true"]{background:rgba(20,33,61,.1)!important;color:#14213D!important}',
      P + ' #toolSeg>button svg,' + P + ' #cmd-tool-row .cmd-cluster>button.btn svg,' + P + ' #ps-df-toggles>button svg{width:21px!important;height:21px!important;max-width:24px!important;max-height:21px!important;flex:0 0 auto!important}',
      P + ' #toolSeg>button.ps-df-group svg{width:24px!important;max-width:26px!important}',
      P + ' #toolSeg>button.ps-df-group::after{content:"";position:absolute;right:6px;bottom:6px;border:3.5px solid transparent;border-right-color:currentColor;border-bottom-color:currentColor;opacity:.5}',
      GROUPS.map(function (g) { return g.tools.map(function (t) { return P + ' #toolSeg>button[data-tool="' + t + '"]'; }).join(','); }).join(',') + '{display:none!important}',
      P + ' #colorWrap{width:42px!important;height:42px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}',
      P + ' #colorBtn{width:26px!important;height:26px!important;border-radius:50%!important;box-shadow:0 0 0 2px #fff,0 0 0 3.5px rgba(20,22,26,.18)!important}',
      P + ' #cmd-dock-fold{display:none!important}',
      P + ' #cmd-tool-row>.cmd-separator{display:none!important}',
      'body.ps-dock-float.ps-df-anim-off ' + P.replace('html.ps-page-board body.ps-dock-float ', '') + '>#animBar{display:none!important}',
      P + ' #drawPanel{display:none!important}',   // 3.076 — 선수 · 장비 줄은 «선수» 칸(#ps-df-tray) 안으로 옮겨 카드로 보인다
      TRAY_CSS,
      P + ' #toolSeg>.ps-df-div{flex:0 0 1px;width:1px;height:26px;margin:0 6px;background:rgba(20,22,26,.09)}',
      P + ' #cmd-tool-row #toolSeg>button.ps-df-panel[aria-pressed="true"],' + P + ' #cmd-tool-row #ps-df-toggles>button.btn[aria-pressed="true"]{background:rgba(20,33,61,.13)!important;color:#14213D!important;box-shadow:inset 0 0 0 1.5px rgba(20,33,61,.35)!important}',
      // ③ 도구 옵션 띠
      '#ps-df-opts{position:fixed;z-index:400;display:none;align-items:center;gap:6px;padding:8px;border-radius:18px;' + glass.replace(/!important/g, '') + 'font-family:inherit}',
      '#ps-df-opts.on{display:flex}',
      '#ps-df-opts:after{content:"";position:absolute;bottom:-7px;left:var(--ax,50%);width:13px;height:13px;transform:translateX(-50%) rotate(45deg);background:rgba(255,255,255,.95);border-right:1px solid rgba(20,22,26,.07);border-bottom:1px solid rgba(20,22,26,.07)}',
      '#ps-df-opts .df-l{font-size:11px;font-weight:700;color:#646A73;margin:0 2px 0 4px;white-space:nowrap}',
      '#ps-df-opts .df-k{flex:0 0 auto;min-height:38px;max-height:38px;height:38px;min-width:44px;padding:0 9px;border-radius:12px;display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:#14161A;font:700 12px/1 Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;cursor:pointer}',
      '#ps-df-opts .df-k:hover{background:rgba(20,33,61,.07)}',
      '#ps-df-opts .df-k.on{background:#14213D;color:#fff}',
      '#ps-df-opts .df-k svg{width:26px;height:16px}',
      '#ps-df-opts .df-sep{width:1px;height:26px;background:rgba(20,22,26,.1);margin:0 2px}',
      '#ps-df-opts .df-sw{flex:0 0 26px;min-width:26px;max-width:26px;min-height:26px;max-height:26px;width:26px;height:26px;border-radius:50%;border:0;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.14)}',
      '#ps-df-opts .df-sw.on{box-shadow:0 0 0 2px #fff,0 0 0 4px #14213D}',
      'body.fmdark #ps-df-opts{background:rgba(28,32,42,.92);color:#e8ebf0}body.fmdark #ps-df-opts .df-k{color:#e8ebf0}body.fmdark #ps-df-opts:after{background:rgba(28,32,42,.95)}'
    ].join('\n');
  }

  var ICON = {
    equip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l6 15H6z"/><path d="M8.3 12.8h7.4"/><path d="M4 18.5h16"/></svg>',
    team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.3"/><path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2"/><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.6c1.9.6 3.2 2.3 3.5 4.9"/></svg>',
    anim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M8 5v14M16 5v14M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5"/></svg>'
  };

  function install(doc, env) {
    env = env || {};
    var body = doc.body, dock = doc.getElementById('ps-command-dock'), seg = doc.getElementById('toolSeg'), row = doc.getElementById('cmd-tool-row');
    if (!dock || !seg || !row || dock.__psDockFloat) return null;
    dock.__psDockFloat = true;
    var st = readOpen(env.storage), win = doc.defaultView;
    var style = doc.createElement('style'); style.id = 'ps-dock-float-css'; style.textContent = css(); doc.head.appendChild(style);
    function wide() { try { return win.matchMedia('(min-width:768px)').matches && body.classList.contains('rail-full'); } catch (_) { return false; } }
    function sync() { var on = wide(); if (body.classList.contains('ps-dock-float') !== on) body.classList.toggle('ps-dock-float', on); if (!on && typeof giveBackLater === 'function') giveBackLater(); }
    var giveBackLater = null;
    sync(); try { win.addEventListener('resize', sync); new win.MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}

    // ① 목업처럼: 선택 → 선수 · 장비 → 그리기 도구 → 색 → 되돌리기 → 애니메이션(장면 줄) → 보드 설정.
    //   «선수» · «장비»는 누르면 그 줄(원래 선수 · 장비 줄)이 도크 위에 뜨고, 다시 누르면 닫힌다(둘 중 하나만).
    //   장면 줄은 장면이 있으면 열려 있고(애니메이션을 만드는 중), 필름 버튼으로 여닫는다.
    function scenes() { try { return env.sceneCount ? env.sceneCount() : doc.querySelectorAll('#animFrames .anim-frame').length; } catch (_) { return 0; } }
    function mk(id, icon, title, cls) { var b = doc.createElement('button'); b.type = 'button'; b.className = cls; b.id = id; b.title = title; b.setAttribute('aria-label', title); b.innerHTML = ICON[icon]; return b; }
    var tTeam = mk('ps-df-team', 'team', '선수 놓기 — 팀 · 골키퍼 · 코치', 'ps-df-panel'), tEquip = mk('ps-df-equip', 'equip', '장비 놓기 — 콘 · 골대 · 공 …', 'ps-df-panel');
    [tTeam, tEquip].forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); var k = b.id === 'ps-df-team' ? 'team' : 'equip'; st.panel = st.panel === k ? '' : k; writeOpen(st, env.storage); paint(); }); });
    var moveBtn = seg.querySelector('button[data-tool="move"]'), div1 = doc.createElement('span'), div2 = doc.createElement('span'); div1.className = div2.className = 'ps-df-div';
    var after = moveBtn ? moveBtn.nextSibling : seg.firstChild;
    [div1, tTeam, tEquip, div2].forEach(function (n) { seg.insertBefore(n, after); });
    var tg = doc.createElement('div'); tg.className = 'cmd-cluster'; tg.id = 'ps-df-toggles';
    var tAnim = mk('ps-df-anim', 'anim', '애니메이션 — 장면 줄 열기/닫기', 'btn'); tg.appendChild(tAnim); row.appendChild(tg);
    tAnim.addEventListener('click', function () { st.anim = !animOpen(); writeOpen(st, env.storage); paint(); });
    function animOpen() { return st.anim === null ? scenes() > 0 : st.anim; }
    // «선수» 칸
    var tray = doc.createElement('div'); tray.id = 'ps-df-tray'; tray.setAttribute('role', 'dialog'); tray.setAttribute('aria-label', '선수 · 장비 · 포메이션');
    tray.innerHTML = '<div class="df-tabs" role="tablist"><button type="button" data-tab="team">선수</button><button type="button" data-tab="equip">장비</button><button type="button" data-tab="form">포메이션</button></div>' +
      '<div class="df-pane" data-pane="team"><div class="df-h">팀 — 고르고 운동장을 누르면 한 명씩 (길게 누르면 유니폼 설정)</div><div class="df-slot-team"></div><div class="df-h">역할 · 연속 배치 — 끌어서 놓아도 돼요</div><div class="df-slot-stamp"></div>' +
      '<div class="df-row"><span>한 번에 놓기</span><div class="df-step"><button type="button" data-step="-1" aria-label="한 명 적게">−</button><b class="df-n">11</b>명<button type="button" data-step="1" aria-label="한 명 많이">＋</button></div><button type="button" class="df-cta" data-place="1">운동장에 놓기</button></div></div>' +
      '<div class="df-pane" data-pane="equip"><div class="df-h">장비 — 누르고 운동장을 누르거나, 끌어서 놓아요</div><div class="df-slot-equip"></div></div>' +
      '<div class="df-pane" data-pane="form"><div class="df-seg"><button type="button" data-fteam="blue" class="on">우리 팀</button><button type="button" data-fteam="red">상대 팀</button></div><div class="df-slot-form"></div><div class="df-hint">고르면 그 팀 선수를 포메이션 자리에 다시 놓아요</div></div>';
    body.appendChild(tray);
    var homes = {};   // 옮긴 원래 노드의 집(떠 있는 도크가 꺼지면 되돌린다)
    function adopt(id, slot) { var n = doc.getElementById(id); if (!n) return; if (!homes[id]) homes[id] = { parent: n.parentNode, next: n.nextSibling }; var s = tray.querySelector(slot); if (n.parentNode !== s) s.appendChild(n); }
    function giveBack() { Object.keys(homes).forEach(function (id) { var n = doc.getElementById(id), h = homes[id]; if (n && h.parent && n.parentNode !== h.parent) h.parent.insertBefore(n, h.next && h.next.parentNode === h.parent ? h.next : null); }); }
    function labelChips() {
      doc.querySelectorAll('#benchCat .tpill').forEach(function (b) {
        var c = b.getAttribute('data-cat'); b.setAttribute('data-df-label', TEAMS[c] || ''); b.setAttribute('data-df-n', (TEAMS[c] || '').replace('팀 ', ''));
        // 토큰과 같은 유니폼(주색 · 보조색 · 무늬) — 작전판의 teamChipBG · teamMain
        try { var bgf = win.eval('typeof teamChipBG==="function"?teamChipBG:null'), mf = win.eval('typeof teamMain==="function"?teamMain:null');
          if (bgf) b.style.setProperty('--df-kit', bgf(c)); var col = mf ? String(mf(c)) : ''; var m = /^#?([0-9a-f]{6})$/i.exec(col);
          if (m) { var n = parseInt(m[1], 16); b.style.setProperty('--df-kit-ink', (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255 > .6 ? '#111' : '#fff'); } } catch (_) {}
      });
      var L = { 'cmd-role-gk': '골키퍼', 'cmd-role-c': '코치', 'cmd-role-n': '중립', 'cmd-role-t': '타깃', 'cmd-role-s': '서버', 'cmd-player-stamp': '번 선수' };
      Object.keys(L).forEach(function (id) { var b = doc.getElementById(id); if (b) b.setAttribute('data-df-label', L[id]); });
    }
    function forms() {
      var F = null; try { F = win.eval('typeof FORM!=="undefined"?FORM:null'); } catch (_) {} if (!F) return '';
      var h = '';
      FORM_GROUPS.forEach(function (g) {
        var keys = g[1].filter(function (k) { return F[k]; }); if (!keys.length) return;
        h += '<div class="df-h">' + g[0] + '</div><div class="df-forms">' + keys.map(function (k) {
          var dots = F[k].map(function (c) { return '<circle cx="' + (6 + c[0] * 108) + '" cy="' + (4 + c[1] * 64) + '" r="3.6" fill="' + (c[3] === 'GK' ? '#f2c230' : '#fff') + '"/>'; }).join('');
          var name = k.replace(/^f/, '').split('').join('-');
          return '<button type="button" class="df-form" data-form="' + k + '"><svg viewBox="0 0 120 72"><rect width="120" height="72" fill="#2f6e3a"/><path d="M60 0v72M2 2h116v68H2z" stroke="rgba(255,255,255,.35)" fill="none"/>' + dots + '</svg>' + name + '</button>';
        }).join('') + '</div>';
      });
      return h;
    }
    var formTeam = 'blue', count = 11;
    function tab(name) {
      tray.querySelectorAll('.df-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === name); });
      tray.querySelectorAll('.df-pane').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-pane') === name); });
      if (name === 'form') { var sl = tray.querySelector('.df-slot-form'); if (!sl.firstChild) sl.innerHTML = forms(); }
    }
    function openTray() {
      adopt('benchCat', '.df-slot-team'); adopt('cmd-stamp-group', '.df-slot-stamp'); adopt('cmd-equipment-group', '.df-slot-equip'); labelChips();
      tab(st.panel === 'equip' ? 'equip' : (st.tab === 'form' ? 'form' : 'team'));
      tray.classList.add('on');
      var b = (st.panel === 'equip' ? tEquip : tTeam).getBoundingClientRect(), w = tray.offsetWidth, left = Math.max(12, Math.min(win.innerWidth - w - 12, b.left + b.width / 2 - w / 2));
      tray.style.left = left + 'px'; tray.style.top = Math.max(12, dock.getBoundingClientRect().top - tray.offsetHeight - 12) + 'px';
    }
    tray.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tab]'); if (t) { var n = t.getAttribute('data-tab'); st.tab = n; if (n === 'equip') st.panel = 'equip'; else if (st.panel === 'equip') st.panel = 'team'; writeOpen(st, env.storage); paint(); tab(n); return; }
      var s = e.target.closest('[data-step]'); if (s) { count = Math.max(1, Math.min(11, count + +s.getAttribute('data-step'))); tray.querySelector('.df-n').textContent = count; return; }
      if (e.target.closest('[data-place]')) { var on = doc.querySelector('#benchCat .tpill.on'), team = on ? on.getAttribute('data-cat') : 'blue'; try { win.eval('addPlayers')(team, count); } catch (_) {} return; }
      var ft = e.target.closest('[data-fteam]'); if (ft) { formTeam = ft.getAttribute('data-fteam'); tray.querySelectorAll('[data-fteam]').forEach(function (b) { b.classList.toggle('on', b === ft); }); return; }
      var f = e.target.closest('[data-form]'); if (f) { try { win.eval('applyFormationTo')(formTeam, f.getAttribute('data-form')); if (typeof win.toast === 'function') win.toast((formTeam === 'blue' ? '우리 팀' : '상대 팀') + ' ' + f.textContent + ' 로 놓았어요'); } catch (_) {} return; }
    });
    // 운동장을 누르거나(놓기 · 고르기는 그대로 된다) 칸에서 무언가를 끌어 밖으로 나가면 칸을 닫는다 — 운동장을 가리지 않게
    function closeTray() { if (!st.panel) return; st.panel = ''; writeOpen(st, env.storage); paint(); }
    doc.addEventListener('pointerdown', function (e) { if (!st.panel || !tray.classList.contains('on')) return; if (tray.contains(e.target) || (e.target.closest && e.target.closest('#ps-df-team,#ps-df-equip'))) return; closeTray(); }, true);
    // 칸에서 끌어 놓는 것(역할 · 연속 배치 토큰 · 장비)을 누르면 칸이 바로 비켜 준다 — 운동장에 놓는 동안 가리지 않게.
    //   눌린 원래 단추가 끌기를 이어 가도록 자리(레이아웃)는 남기고 보이지 않게만 했다가, 손을 떼면 닫는다. 팀 카드는 칸을 그대로 둔다.
    function stepAside() {
      st.panel = ''; writeOpen(st, env.storage); body.classList.remove('ps-df-team', 'ps-df-equip'); tTeam.setAttribute('aria-pressed', 'false'); tEquip.setAttribute('aria-pressed', 'false');
      tray.style.visibility = 'hidden'; tray.style.pointerEvents = 'none';
      var done = function () { win.removeEventListener('pointerup', done, true); win.removeEventListener('pointercancel', done, true); win.setTimeout(function () { tray.classList.remove('on'); tray.style.visibility = ''; tray.style.pointerEvents = ''; }, 0); };
      win.addEventListener('pointerup', done, true); win.addEventListener('pointercancel', done, true); win.setTimeout(done, 15000);
    }
    tray.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('#cmd-stamp-group .cmd-stamp-token,#railEquip .chip:not(.chip-upload)')) stepAside(); }, true);
    function paint() {
      var a = animOpen();
      body.classList.toggle('ps-df-team', st.panel === 'team'); body.classList.toggle('ps-df-equip', st.panel === 'equip'); body.classList.toggle('ps-df-anim-off', !a);
      if (st.panel && body.classList.contains('ps-dock-float')) openTray(); else { tray.classList.remove('on'); if (!body.classList.contains('ps-dock-float')) giveBack(); }
      tTeam.setAttribute('aria-pressed', st.panel === 'team' ? 'true' : 'false'); tEquip.setAttribute('aria-pressed', st.panel === 'equip' ? 'true' : 'false'); tAnim.setAttribute('aria-pressed', a ? 'true' : 'false');
    }
    giveBackLater = function () { tray.classList.remove('on'); giveBack(); };
    paint();
    var lastScenes = scenes();
    try { var fr = doc.getElementById('animFrames'); if (fr) new win.MutationObserver(function () { var n = scenes(); if (n > 0 && lastScenes === 0 && st.anim === false) st.anim = null; lastScenes = n; paint(); }).observe(fr, { childList: true }); } catch (_) {}
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.panel) { st.panel = ''; writeOpen(st, env.storage); paint(); } });

    // ③ 묶은 도구 한 칸
    var opts = doc.createElement('div'); opts.id = 'ps-df-opts'; opts.setAttribute('role', 'toolbar'); body.appendChild(opts);
    var gbtn = {};
    function member(t) { return seg.querySelector('button[data-tool="' + t + '"]'); }
    function active() { var b = seg.querySelector('button.on[data-tool]'); return b ? b.getAttribute('data-tool') : ''; }
    GROUPS.forEach(function (g) {
      var first = member(g.tools[0]); if (!first) return;
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'ps-df-group'; b.setAttribute('data-df-group', g.key); b.title = g.label; b.setAttribute('aria-label', g.label);
      b.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault();
        var cur = active();
        if (g.tools.indexOf(cur) < 0) { var t = st.last[g.key] && member(st.last[g.key]) ? st.last[g.key] : g.tools[0]; member(t).click(); showOpts(g); }
        else if (opts.classList.contains('on') && opts.getAttribute('data-g') === g.key) hideOpts(); else showOpts(g);
      });
      seg.insertBefore(b, first); gbtn[g.key] = b;
    });
    function paintGroups() {
      var cur = active(), g0 = groupOf(cur);
      if (g0) { st.last[g0.key] = cur; writeOpen(st, env.storage); }
      GROUPS.forEach(function (g) {
        var b = gbtn[g.key]; if (!b) return;
        var t = g.tools.indexOf(cur) >= 0 ? cur : (st.last[g.key] && member(st.last[g.key]) ? st.last[g.key] : g.tools[0]), m = member(t), svg = m && m.querySelector('svg');
        if (svg && b.__t !== t) { b.innerHTML = svg.outerHTML; b.__t = t; }
        var on = g.tools.indexOf(cur) >= 0; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.title = g.label + ' — ' + (KIND[t] || '');
      });
      if (opts.classList.contains('on')) { var g = GROUPS.filter(function (x) { return x.key === opts.getAttribute('data-g'); })[0]; if (!g || g.tools.indexOf(cur) < 0) hideOpts(); else fillOpts(g); }
    }
    function swatches() { return Array.prototype.slice.call(doc.querySelectorAll('#swatches .swatch[data-c]')).slice(0, 6); }
    function fillOpts(g) {
      var cur = active(), h = '<span class="df-l">종류</span>';
      g.tools.forEach(function (t) { var m = member(t); if (!m) return; var svg = m.querySelector('svg'); h += '<button type="button" class="df-k' + (t === cur ? ' on' : '') + '" data-df-tool="' + t + '" title="' + (m.title || KIND[t]) + '">' + (svg ? svg.outerHTML : '') + '<span>' + KIND[t] + '</span></button>'; });
      var sw = swatches();
      if (sw.length) {
        h += '<span class="df-sep"></span><span class="df-l">색</span>';
        sw.forEach(function (s, i) { var c = s.getAttribute('data-c'); h += '<button type="button" class="df-sw' + (s.classList.contains('on') ? ' on' : '') + '" data-df-sw="' + i + '" style="background:' + c + '" title="' + c + '"></button>'; });
      }
      if (doc.getElementById('lineStyleBtn')) h += '<span class="df-sep"></span><button type="button" class="df-k" data-df-line="1" title="선 굵기 · 투명도">굵기</button>';
      opts.innerHTML = h;
    }
    function place(g) {
      var b = gbtn[g.key]; if (!b) return; var r = b.getBoundingClientRect(), w = opts.offsetWidth, vw = win.innerWidth;
      var left = Math.max(10, Math.min(vw - w - 10, r.left + r.width / 2 - w / 2));
      var top = Math.min(r.top, dock.getBoundingClientRect().top);   // 도크(열린 줄 포함) 위에 — 선수·장비 줄을 가리지 않게
      opts.style.left = left + 'px'; opts.style.top = (top - opts.offsetHeight - 12) + 'px'; opts.style.setProperty('--ax', (r.left + r.width / 2 - left) + 'px');
    }
    function showOpts(g) { fillOpts(g); opts.setAttribute('data-g', g.key); opts.classList.add('on'); place(g); }
    function hideOpts() { opts.classList.remove('on'); opts.removeAttribute('data-g'); }
    opts.addEventListener('click', function (e) {
      var k = e.target.closest('[data-df-tool]'), s = e.target.closest('[data-df-sw]'), l = e.target.closest('[data-df-line]');
      if (k) { var m = member(k.getAttribute('data-df-tool')); if (m) m.click(); }
      else if (s) { var sw = swatches()[+s.getAttribute('data-df-sw')]; if (sw) sw.click(); var g = GROUPS.filter(function (x) { return x.key === opts.getAttribute('data-g'); })[0]; if (g) fillOpts(g); }
      else if (l) { hideOpts(); var lb = doc.getElementById('lineStyleBtn'); if (lb) lb.click(); }
    });
    // 운동장에 그리기 시작하거나 다른 곳을 누르면 닫힌다
    doc.addEventListener('pointerdown', function (e) { if (!opts.classList.contains('on')) return; if (opts.contains(e.target) || (e.target.closest && e.target.closest('.ps-df-group'))) return; hideOpts(); }, true);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideOpts(); });
    try { new win.MutationObserver(paintGroups).observe(seg, { subtree: true, attributes: true, attributeFilter: ['class'] }); } catch (_) {}
    paintGroups();
    return { paint: paint, paintGroups: paintGroups, show: function (k) { var g = GROUPS.filter(function (x) { return x.key === k; })[0]; if (g) showOpts(g); }, hide: hideOpts };
  }
  // 작전판이 명령 도크를 다 세운 뒤에 입힌다(도크는 부팅 중에 원래 버튼들을 옮겨 만든다)
  function auto(win) {
    var n = 0; (function tryIt() { var d = win.document; if (d.getElementById('cmd-tool-row') && d.getElementById('toolSeg') && d.body.classList.contains('command-dock-v5')) { win.__psDockFloat = install(d, {}); return; } if (++n < 60) win.setTimeout(tryIt, 250); })();
  }
  if (typeof window !== 'undefined' && window.document && !window.__psDockFloatNoAuto) {
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', function () { auto(window); }); else auto(window);
  }
  return { GROUPS: GROUPS, groupOf: groupOf, readOpen: readOpen, install: install, STORE: STORE };
});
