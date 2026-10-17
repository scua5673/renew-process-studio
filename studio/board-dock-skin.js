/* PROCESS STUDIO — 하단 도크 스타일(3.077). 사용자 «더 고급지게 · 3d 느낌으로» → «둘다 적용하고 고를 수 있게 · 다크모드도».
   보드 설정 › 보기 › «도크»: 자동 · 글래스 · 베벨 · 기본.
   - 글래스: 짙은 연유리 판 + 위 하이라이트 + 깊은 그림자, 고른 도구는 파란 광택 단추가 살짝 솟는다.
   - 베벨: 볼록한 흰 판 + 남색 광택 단추. 다크 모드(body.fmdark)에서는 흑연색 베벨로 바뀐다.
   - 자동: 밝은 화면은 베벨, 다크 모드는 글래스. 기본: 3.076 그대로(다크 모드에서는 광택 없는 짙은 판).
   떠 있는 도크(board-dock-float.js, body.ps-dock-float)에만 입힌다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSDockSkin = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var STORE = 'ps_dock_skin_v1', SKINS = ['auto', 'glass', 'bevel', 'flat'];
  var LABEL = { auto: '자동', glass: '글래스', bevel: '베벨', flat: '기본' };
  var TITLE = { auto: '밝은 화면은 베벨, 다크 모드는 글래스', glass: '짙은 연유리 — 3D 경기장과 잘 어울려요', bevel: '볼록한 판 — 다크 모드에서는 흑연색', flat: '예전 납작한 도크' };
  function readSkin(ls) { var v = ''; try { v = (ls || localStorage).getItem(STORE) || ''; } catch (_) {} return SKINS.indexOf(v) >= 0 ? v : 'auto'; }
  function writeSkin(v, ls) { try { (ls || localStorage).setItem(STORE, v); } catch (_) {} }
  // 실제로 입힐 모양: 자동은 화면 밝기를 따른다
  function resolve(pref, dark) { return pref === 'auto' ? (dark ? 'glass' : 'bevel') : (SKINS.indexOf(pref) >= 0 ? pref : 'bevel'); }

  // 세 가지 판: 글래스(어두운 유리) · 베벨(밝은) · 베벨 다크(흑연)
  var PAL = {
    glass: {
      dark: true, ink: '#E8ECF4', dim: 'rgba(232,236,244,.62)', line: 'rgba(255,255,255,.1)', tip: '#151a28',
      glass: 'background:linear-gradient(180deg,rgba(46,54,74,.86) 0%,rgba(20,24,36,.9) 55%,rgba(12,15,24,.94) 100%)!important;border:1px solid rgba(255,255,255,.08)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(0,0,0,.5),0 2px 4px rgba(0,0,0,.35),0 18px 40px rgba(0,0,0,.5),0 40px 80px -20px rgba(0,0,0,.45)!important;-webkit-backdrop-filter:blur(22px) saturate(1.6)!important;backdrop-filter:blur(22px) saturate(1.6)!important;',
      on: 'background:linear-gradient(180deg,#3E6BFF 0%,#2448D8 55%,#1B37B0 100%)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.45),inset 0 -2px 0 rgba(0,0,0,.25),0 6px 14px rgba(36,72,216,.55),0 0 0 1px rgba(120,150,255,.35)!important;',
      onSvg: '#fff', ring: '#5B82FF', ringGlow: 'rgba(60,100,255,.35)', hover: 'rgba(255,255,255,.08)',
      panelOn: 'background:rgba(110,140,255,.18)!important;color:#AFC2FF!important;box-shadow:inset 0 1px 2px rgba(0,0,0,.5),inset 0 0 0 1px rgba(120,150,255,.35)!important;',
      chip: 'background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.05))!important;border-color:rgba(255,255,255,.1)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 1px 3px rgba(0,0,0,.4)!important;',
      card: 'background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 2px 6px rgba(0,0,0,.35)!important;border:1px solid rgba(255,255,255,.05)!important;',
      well: 'background:rgba(0,0,0,.35)!important;box-shadow:inset 0 1px 3px rgba(0,0,0,.5)!important;',
      tabOn: 'background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.08))!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 2px 6px rgba(0,0,0,.4)!important;',
      soft: 'rgba(255,255,255,.08)'
    },
    bevel: {
      dark: false, ink: '#1A2233', dim: '#5E6675', line: 'rgba(20,33,61,.1)', tip: '#ECEFF5',
      glass: 'background:linear-gradient(180deg,rgba(255,255,255,.98) 0%,rgba(244,246,250,.95) 60%,rgba(232,236,243,.95) 100%)!important;border:1px solid rgba(255,255,255,.9)!important;box-shadow:inset 0 1px 0 #fff,inset 0 -2px 0 rgba(20,33,61,.06),0 1px 2px rgba(15,23,42,.12),0 14px 30px rgba(15,23,42,.18),0 34px 70px -24px rgba(15,23,42,.35)!important;-webkit-backdrop-filter:blur(18px) saturate(1.4)!important;backdrop-filter:blur(18px) saturate(1.4)!important;',
      on: 'background:linear-gradient(180deg,#2A3D6E 0%,#14213D 60%,#0D1630 100%)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 0 rgba(0,0,0,.3),0 6px 12px rgba(20,33,61,.45)!important;',
      onSvg: '#fff', ring: '#14213D', ringGlow: 'rgba(20,33,61,.25)', hover: 'rgba(20,33,61,.06)',
      panelOn: 'background:rgba(20,33,61,.1)!important;color:#14213D!important;box-shadow:inset 0 1px 2px rgba(0,0,0,.12),inset 0 0 0 1px rgba(20,33,61,.18)!important;',
      chip: 'background:linear-gradient(180deg,#fff,#EEF1F6)!important;border-color:rgba(20,33,61,.08)!important;box-shadow:inset 0 1px 0 #fff,0 1px 3px rgba(0,0,0,.12)!important;',
      card: 'background:linear-gradient(180deg,#fff,#EEF1F6)!important;box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(15,23,42,.1),0 4px 10px rgba(15,23,42,.08)!important;border:1px solid rgba(15,23,42,.06)!important;',
      well: 'background:rgba(20,33,61,.07)!important;box-shadow:inset 0 1px 3px rgba(0,0,0,.12)!important;',
      tabOn: 'background:linear-gradient(180deg,#fff,#F3F5F9)!important;color:#14161A!important;box-shadow:inset 0 1px 0 #fff,0 2px 6px rgba(15,23,42,.15)!important;',
      soft: 'rgba(20,33,61,.06)'
    },
    bevelDark: {
      dark: true, ink: '#E6E9EF', dim: 'rgba(230,233,239,.6)', line: 'rgba(255,255,255,.09)', tip: '#1E232D',
      glass: 'background:linear-gradient(180deg,#3A414E 0%,#2A303B 55%,#20252E 100%)!important;border:1px solid rgba(255,255,255,.06)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -2px 0 rgba(0,0,0,.35),0 1px 2px rgba(0,0,0,.4),0 14px 30px rgba(0,0,0,.45),0 34px 70px -24px rgba(0,0,0,.6)!important;-webkit-backdrop-filter:blur(18px)!important;backdrop-filter:blur(18px)!important;',
      on: 'background:linear-gradient(180deg,#FFFFFF 0%,#E4E8EF 60%,#CDD3DD 100%)!important;color:#14161A!important;box-shadow:inset 0 1px 0 #fff,inset 0 -2px 0 rgba(0,0,0,.15),0 6px 14px rgba(0,0,0,.5)!important;',
      onSvg: '#14161A', ring: '#E6E9EF', ringGlow: 'rgba(0,0,0,.45)', hover: 'rgba(255,255,255,.07)',
      panelOn: 'background:rgba(0,0,0,.28)!important;color:#fff!important;box-shadow:inset 0 2px 3px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.1)!important;',
      chip: 'background:linear-gradient(180deg,#454C5A,#353B47)!important;border-color:rgba(255,255,255,.07)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 1px 3px rgba(0,0,0,.45)!important;',
      card: 'background:linear-gradient(180deg,#414856,#323843)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 2px 6px rgba(0,0,0,.4)!important;border:1px solid rgba(255,255,255,.05)!important;',
      well: 'background:rgba(0,0,0,.3)!important;box-shadow:inset 0 1px 3px rgba(0,0,0,.45)!important;',
      tabOn: 'background:linear-gradient(180deg,#4C5462,#3A404C)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 2px 6px rgba(0,0,0,.45)!important;',
      soft: 'rgba(255,255,255,.08)'
    },
    // 기본(납작) 도크의 다크 모드 — 광택 없이 짙은 판만
    flatDark: {
      dark: true, ink: '#E6E9EF', dim: 'rgba(230,233,239,.6)', line: 'rgba(255,255,255,.09)', tip: '#1C202A',
      glass: 'background:rgba(28,32,42,.95)!important;border:1px solid rgba(255,255,255,.07)!important;box-shadow:0 10px 28px rgba(0,0,0,.45)!important;',
      on: 'background:#E6E9EF!important;color:#14161A!important;box-shadow:none!important;',
      onSvg: '#14161A', ring: '#E6E9EF', ringGlow: 'rgba(0,0,0,.4)', hover: 'rgba(255,255,255,.07)',
      panelOn: 'background:rgba(255,255,255,.12)!important;color:#fff!important;box-shadow:none!important;',
      chip: 'background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.08)!important;box-shadow:none!important;',
      card: 'background:rgba(255,255,255,.06)!important;box-shadow:none!important;border:1px solid rgba(255,255,255,.06)!important;',
      well: 'background:rgba(0,0,0,.3)!important;box-shadow:none!important;',
      tabOn: 'background:rgba(255,255,255,.14)!important;color:#fff!important;box-shadow:none!important;',
      soft: 'rgba(255,255,255,.08)', flat: true
    }
  };
  var N = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(function (i) { return ':not(#lx' + i + ')'; }).join('');
  var BASE = { glass: '.ps-skin-glass', bevel: '.ps-skin-bevel:not(.fmdark)', bevelDark: '.ps-skin-bevel.fmdark', flatDark: '.ps-skin-flat.fmdark' };

  function skinCSS(key) {
    var p = PAL[key], B = 'html.ps-page-board body.ps-dock-float' + BASE[key];
    var D = B + ' #ps-command-dock' + N, T = B + ' #ps-df-tray' + N, O = B + ' #ps-df-opts' + N;
    var lift = p.flat ? '' : 'transform:translateY(-1px)!important;';
    return [
      D + ' #cmd-tool-row,' + D + '>#animBar{' + p.glass + '}',
      T + ',' + O + '{' + p.glass + 'color:' + p.ink + '!important}',
      O + ':after{background:' + p.tip + '!important;border-color:transparent!important}',
      // 도구 단추: 평소 투명, 올리면 살짝 뜨고, 고르면 광택 단추
      D + ' #toolSeg>button,' + D + ' #cmd-tool-row .cmd-cluster>button.btn,' + D + ' #ps-df-toggles>button,' + D + ' #cmd-tool-end button{color:' + p.ink + '!important;background:transparent!important;transition:transform .15s,box-shadow .15s,background .15s!important}',
      D + ' #toolSeg>button svg,' + D + ' #cmd-tool-row .cmd-cluster>button.btn svg,' + D + ' #cmd-tool-end button svg{color:inherit!important}',
      D + ' #toolSeg>button:hover,' + D + ' #cmd-tool-row .cmd-cluster>button.btn:hover,' + D + ' #cmd-tool-end button:hover{background:' + p.hover + '!important;' + lift + '}',
      D + ' #toolSeg>button:active,' + D + ' #cmd-tool-row .cmd-cluster>button.btn:active{transform:translateY(1px)!important}',
      D + ' #toolSeg>button.on,' + D + ' #toolSeg>button[aria-pressed="true"]:not(.ps-df-panel){' + p.on + lift + '}',
      D + ' #toolSeg>button.on svg{color:' + p.onSvg + '!important;stroke:' + p.onSvg + '!important}',
      D + ' #cmd-tool-row #toolSeg>button.ps-df-panel[aria-pressed="true"],' + D + ' #cmd-tool-row #ps-df-toggles>button.btn[aria-pressed="true"]{' + p.panelOn + '}',
      D + ' #cmd-tool-row .cmd-cluster+.cmd-cluster,' + D + ' #ps-df-toggles,' + D + ' #toolSeg>.ps-df-div,' + D + ' #cmd-tool-end{border-color:' + p.line + '!important}',
      D + ' #toolSeg>.ps-df-div{background:' + p.line + '!important}',
      p.flat ? '' : D + ' #colorBtn{box-shadow:inset 0 2px 3px rgba(255,255,255,.35),inset 0 -3px 4px rgba(0,0,0,.35),0 0 0 2px ' + (p.dark ? 'rgba(255,255,255,.85)' : '#fff') + ',0 3px 8px rgba(0,0,0,.35)!important}',
      // 장면 줄
      D + '>#animBar,' + D + '>#animBar *{color:' + p.ink + '}',
      D + '>#animBar .btn,' + D + '>#animBar button,' + D + '>#animBar select,' + D + '>#animBar .anim-frame{' + p.chip + 'color:' + p.ink + '!important}',
      D + '>#animBar .btn.on,' + D + '>#animBar .anim-frame.on{' + p.on + '}',
      D + '>#animBar .btn.on svg{color:' + p.onSvg + '!important;stroke:' + p.onSvg + '!important}',
      D + '>#animBar .anim-frame.on *{color:' + p.onSvg + '!important}',
      // «선수» 칸
      T + ' .df-tabs{' + p.well + '}',
      T + ' .df-tabs button{color:' + p.dim + '!important}',
      T + ' .df-tabs button.on{' + p.tabOn + '}',
      T + ' .df-h,' + T + ' .df-hint{color:' + p.dim + '!important}',
      T + ' #benchCat .tpill,' + T + ' #railEquip .chip,' + T + ' .df-form{' + p.card + 'color:' + p.ink + '!important}',
      T + ' #benchCat .tpill::after,' + T + ' #railEquip .chip::after{color:' + p.dim + '!important}',
      T + ' #benchCat .tpill.on{box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 0 0 2px ' + p.ring + ',0 6px 16px ' + p.ringGlow + '!important}',
      T + ' #benchCat .tpill.on::after{color:' + p.ink + '!important}',
      // 유니폼 구슬: 광택 + 아래 그림자
      p.flat ? '' : T + ' #benchCat .tpill::before{width:38px!important;height:38px!important;line-height:38px!important;box-shadow:inset 0 -5px 8px rgba(0,0,0,.35),inset 0 4px 6px rgba(255,255,255,.35),0 5px 10px rgba(0,0,0,.35)!important;text-shadow:0 1px 2px rgba(0,0,0,.4)}',
      p.flat ? '' : T + ' #cmd-stamp-group .cmd-stamp-token{box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -2px 0 rgba(0,0,0,.25),0 4px 10px rgba(0,0,0,' + (p.dark ? '.4' : '.18') + ')!important}',
      T + ' .df-row{background:transparent!important;border-color:' + p.line + '!important}',
      T + ' .df-row,' + T + ' .df-row *:not(.df-cta){color:' + p.ink + '!important}',
      T + ' .df-step button{' + p.chip + 'color:' + p.ink + '!important}',
      T + ' .df-cta{' + p.on + '}',
      T + ' .df-seg button{background:' + p.soft + '!important;color:' + p.ink + '!important}',
      T + ' .df-seg button.on{' + p.on + '}',
      // 화살표 · 선 · 도형 옵션줄
      O + ' .df-k{color:' + p.ink + '!important}', O + ' .df-k.on{' + p.on + '}', O + ' .df-l{color:' + p.dim + '!important}',
      p.flat ? '' : O + ' .df-sw{box-shadow:inset 0 2px 3px rgba(255,255,255,.4),inset 0 -3px 4px rgba(0,0,0,.3),0 2px 5px rgba(0,0,0,.3)!important}'
    ].join('\n');
  }
  function css() {
    return skinCSS('glass') + '\n' + skinCSS('bevel') + '\n' + skinCSS('bevelDark') + '\n' + skinCSS('flatDark') + '\n' +
      // 설정 줄은 떠 있는 도크일 때만
      'html body:not(.ps-dock-float) #dockSkinRow#dockSkinRow#dockSkinRow,html body:not(.ps-dock-float) #dockSkinSec#dockSkinSec#dockSkinSec{display:none!important}';
  }

  function install(win, env) {
    env = env || {};
    var doc = win.document, body = doc.body;
    if (!body || body.__psDockSkin) return null;
    body.__psDockSkin = true;
    var st = doc.createElement('style'); st.id = 'ps-dock-skin-css'; st.textContent = css(); doc.head.appendChild(st);
    var pref = readSkin(env.storage);
    function dark() { return body.classList.contains('fmdark'); }
    function apply() {
      var s = resolve(pref, dark());
      ['glass', 'bevel', 'flat'].forEach(function (k) { var on = s === k; if (body.classList.contains('ps-skin-' + k) !== on) body.classList.toggle('ps-skin-' + k, on); });
      if (seg) seg.querySelectorAll('button[data-skin]').forEach(function (b) { var on = b.getAttribute('data-skin') === pref; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    // 보드 설정 › 보기 탭에 «도크» 줄
    var seg = null;
    function addRow() {
      var menu = doc.getElementById('viewMenu'); if (!menu || doc.getElementById('dockSkinRow')) return !!menu;
      var h = doc.createElement('div'); h.id = 'dockSkinSec'; h.className = 'bs-sec'; h.setAttribute('data-bs-tab', 'view'); h.setAttribute('role', 'heading'); h.setAttribute('aria-level', '3'); h.textContent = '도크';
      var row = doc.createElement('div'); row.id = 'dockSkinRow'; row.className = 'menurow'; row.setAttribute('data-bs-tab', 'view');
      row.innerHTML = '<span class="menulbl">스타일</span><div class="seg" id="dockSkinSeg" role="group" aria-label="하단 도크 스타일">' +
        SKINS.map(function (k) { return '<button type="button" data-skin="' + k + '" aria-pressed="false" title="' + TITLE[k] + '">' + LABEL[k] + '</button>'; }).join('') + '</div>';
      var before = menu.querySelector(':scope > .bs-sec-newboard');
      menu.insertBefore(h, before); menu.insertBefore(row, before);
      seg = row.querySelector('#dockSkinSeg');
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-skin]'); if (!b) return; e.stopPropagation();
        pref = b.getAttribute('data-skin'); writeSkin(pref, env.storage); apply();
        try { if (typeof win.toast === 'function') win.toast('도크 스타일 — ' + LABEL[pref] + (pref === 'auto' ? ' (' + LABEL[resolve(pref, dark())] + ')' : '')); } catch (_) {}
      });
      return true;
    }
    var n = 0; (function tryRow() { if (addRow()) { apply(); return; } if (++n < 80) win.setTimeout(tryRow, 250); })();
    // 다크 모드를 켜고 끌 때 «자동»이 따라간다
    try { new win.MutationObserver(function () { apply(); }).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}
    apply();
    return { set: function (v) { if (SKINS.indexOf(v) >= 0) { pref = v; writeSkin(v, env.storage); apply(); } }, get: function () { return pref; }, apply: apply };
  }
  if (typeof window !== 'undefined' && window.document) {
    var go = function () { window.__psDockSkin = install(window, {}); };
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', go); else go();
  }
  return { STORE: STORE, SKINS: SKINS, readSkin: readSkin, resolve: resolve, css: css, skinCSS: skinCSS, install: install };
});
