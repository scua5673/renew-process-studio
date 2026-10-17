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
  function readOpen(ls) { var o = null; try { o = JSON.parse((ls || localStorage).getItem(STORE) || 'null'); } catch (_) { o = null; } o = o && typeof o === 'object' ? o : {}; return { panel: o.panel === 'team' || o.panel === 'equip' ? o.panel : '', anim: o.anim === true || o.anim === false ? o.anim : null, last: o.last && typeof o.last === 'object' ? o.last : {} }; }
  function writeOpen(st, ls) { try { (ls || localStorage).setItem(STORE, JSON.stringify(st)); } catch (_) {} }

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
      'body.ps-dock-float:not(.ps-df-team):not(.ps-df-equip) ' + P.replace('html.ps-page-board body.ps-dock-float ', '') + ' #drawPanel{display:none!important}',
      'body.ps-dock-float.ps-df-team ' + P.replace('html.ps-page-board body.ps-dock-float ', '') + ' #cmd-equipment-group{display:none!important}',
      'body.ps-dock-float.ps-df-equip ' + P.replace('html.ps-page-board body.ps-dock-float ', '') + ' :is(#cmd-team-group,#cmd-stamp-group){display:none!important}',
      P + ' #toolSeg>.ps-df-div{flex:0 0 1px;width:1px;height:26px;margin:0 6px;background:rgba(20,22,26,.09)}',
      P + ' #cmd-tool-row #toolSeg>button.ps-df-panel[aria-pressed="true"],' + P + ' #cmd-tool-row #ps-df-toggles>button.btn[aria-pressed="true"]{background:rgba(20,33,61,.13)!important;color:#14213D!important;box-shadow:inset 0 0 0 1.5px rgba(20,33,61,.35)!important}',
      // ③ 도구 옵션 띠
      '#ps-df-opts{position:fixed;z-index:400;display:none;align-items:center;gap:6px;padding:8px;border-radius:18px;' + glass.replace(/!important/g, '') + 'font-family:inherit}',
      '#ps-df-opts.on{display:flex}',
      '#ps-df-opts:after{content:"";position:absolute;bottom:-7px;left:var(--ax,50%);width:13px;height:13px;transform:translateX(-50%) rotate(45deg);background:rgba(255,255,255,.95);border-right:1px solid rgba(20,22,26,.07);border-bottom:1px solid rgba(20,22,26,.07)}',
      '#ps-df-opts .df-l{font-size:11px;font-weight:700;color:#646A73;margin:0 2px 0 4px;white-space:nowrap}',
      '#ps-df-opts .df-k{flex:0 0 auto;min-height:38px;max-height:38px;height:38px;min-width:44px;padding:0 9px;border-radius:12px;display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:#14161A;font:700 12px/1 inherit;cursor:pointer}',
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
    function sync() { body.classList.toggle('ps-dock-float', wide()); }
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
    function paint() {
      var a = animOpen();
      body.classList.toggle('ps-df-team', st.panel === 'team'); body.classList.toggle('ps-df-equip', st.panel === 'equip'); body.classList.toggle('ps-df-anim-off', !a);
      tTeam.setAttribute('aria-pressed', st.panel === 'team' ? 'true' : 'false'); tEquip.setAttribute('aria-pressed', st.panel === 'equip' ? 'true' : 'false'); tAnim.setAttribute('aria-pressed', a ? 'true' : 'false');
    }
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
