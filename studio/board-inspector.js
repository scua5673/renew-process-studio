/* PROCESS STUDIO — 오른쪽 선수 속성 패널(3.080, 레이아웃 3단계). 목업 «선수 고르면 속성 패널» → 사용자 «네».
   떠 있는 하단 도크(body.ps-dock-float)에서 선수 한 명을 고르면, 보드의 선택 패널(.sel-ctl)을 오른쪽 위에 붙은 카드로 보인다.
   - 패널 안의 원래 입력 · 단추(번호 · 이름 · 포지션 · 색 · 동작 · 크기 · 숨김 · 복제 · 삭제 …)를 그대로 쓴다 — 옮기지 않고 CSS 로 자리만(order).
   - 더하는 것: 머리(번호 구슬 · 이름 · 포지션/번호/주발 · ✕), 묶음 제목, «주발»(자동 = 선수단 · 오른발 · 왼발 → p.foot, 3.074 차기/받기가 읽는다).
   - 여는 법은 그대로(2.975 피드백: 마우스는 오른쪽 클릭 · 터치는 길게 누르기). ✕ 는 패널을 닫는다.
   - 무대 아래 여백 계산(psSelBarLayout)이 이 패널을 아래 띠로 세지 않게 한다 — 판이 작아지지 않게. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSInspector = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var FEET = [['', '자동'], ['R', '오른발'], ['L', '왼발']];
  function footLabel(v) { return v === 'L' ? '왼발' : v === 'R' ? '오른발' : ''; }
  // 머리 부제: 포지션 · #번호 · 주발
  function subLine(p, rosterFoot) {
    if (!p) return '';
    var f = footLabel(p.foot || rosterFoot || '');
    return [p.pos || '', p.num != null && p.num !== '' ? '#' + p.num : '', f].filter(Boolean).join(' · ');
  }
  // 주발 고르기: '' 이면 지운다(선수단 값으로 돌아간다)
  function setFoot(p, v) { if (!p) return false; if (v === 'L' || v === 'R') p.foot = v; else delete p.foot; return true; }

  var N = []; for (var i = 0; i < 16; i++) N.push(':not(#in' + i + ')');
  var C = 'html.ps-page-board body.ps-dock-float.ps-insp-on .sel-ctl:not(.ps-selection-menu)' + N.join('') + ':not([style*="display: none"]):not([style*="display:none"])';
  var SECTIONS = [['name', '이름 · 번호', 1], ['pos', '포지션', 4], ['color', '색', 6], ['act', '다음 장면 동작', 8], ['foot', '주발', 10], ['tools', '도구', 12]];
  function css() {
    var font = 'Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    var out = [
      C + '{position:fixed!important;right:14px!important;top:var(--ps-insp-top,76px)!important;bottom:auto!important;width:288px!important;min-width:0!important;max-width:calc(100vw - 28px)!important;max-height:var(--ps-insp-drag-height,min(62vh,calc(100vh - var(--dock-h,72px) - var(--ps-insp-top,76px) - 36px)))!important;height:auto!important;overflow-y:auto!important;overflow-x:hidden!important;display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:center!important;align-content:flex-start!important;justify-content:flex-start!important;gap:6px!important;padding:14px!important;margin:0!important;border-radius:20px!important;z-index:250!important;transform:none!important;scrollbar-width:thin;font-family:' + font + '!important;color:var(--in-ink)!important;background:var(--in-bg)!important;border:1px solid var(--in-border)!important;box-shadow:var(--in-shadow)!important;-webkit-backdrop-filter:blur(20px) saturate(1.5)!important;backdrop-filter:blur(20px) saturate(1.5)!important}',
      // 3.083 — 넓은 데스크톱(마우스)은 62% 상한 없이 도크 위까지(아이패드는 62% 그대로 — 색 고르기 창 자리)
      '@media (min-width:1200px) and (pointer:fine){' + C + '{max-height:var(--ps-insp-drag-height,calc(100vh - var(--dock-h,72px) - var(--ps-insp-top,76px) - 36px))!important}}',
      C + '::before,' + C + '::after{display:none!important}',
      C + '>*{order:13!important;flex:0 0 auto!important;margin:0!important}',
      // 머리
      C + '>.ps-in-hd,' + C + '>.ps-in-h,' + C + '>.ps-in-foot{height:auto!important;min-height:0!important;max-height:none!important;line-height:1.2!important}',
      C + '>.ps-in-hd{order:0!important;flex:1 1 100%!important;display:flex!important;align-items:center!important;gap:12px!important;padding:0 0 12px!important;margin-bottom:2px!important;border-bottom:1px solid var(--in-line)!important}',
      C + ' .ps-in-ball{width:46px;height:46px;flex:0 0 46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:900 17px/1 ' + font + ';color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45);box-shadow:inset 0 -5px 8px rgba(0,0,0,.35),inset 0 4px 6px rgba(255,255,255,.35),0 5px 10px rgba(0,0,0,.3)}',
      C + ' .ps-in-nm{font:800 16px/1.2 ' + font + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      C + ' .ps-in-sub{font:600 12px/1.3 ' + font + ';color:var(--in-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      C + ' .ps-in-x{margin-left:auto;width:30px;height:30px;flex:0 0 30px;border:0;border-radius:9px;background:transparent;color:var(--in-dim);font:700 16px/1 ' + font + ';cursor:pointer}',
      C + ' .ps-in-x:hover{background:var(--in-well);color:var(--in-ink)}',
      // 묶음 제목
      C + '>.ps-in-h{flex:1 1 100%!important;display:block!important;font:800 11px/1 ' + font + '!important;letter-spacing:.02em;color:var(--in-dim)!important;margin:8px 0 1px!important}',
      // 이름 · 번호
      C + '>#nameCtl{order:2!important;flex:1 1 0!important;min-width:0!important}',
      C + '>#numCtl{order:3!important;flex:0 0 86px!important}',
      C + ' #nameCtl,' + C + ' #numCtl{display:flex!important;align-items:center!important;height:38px!important;border-radius:10px!important;background:var(--in-well)!important;border:0!important;box-shadow:inset 0 1px 2px rgba(0,0,0,.12)!important;padding:0 10px!important;width:auto!important;max-width:none!important}',
      C + ' #nameInput,' + C + ' #numInput{width:100%!important;min-width:0!important;height:100%!important;border:0!important;background:transparent!important;color:var(--in-ink)!important;font:700 14px/1 ' + font + '!important;padding:0!important;outline:0!important;box-shadow:none!important}',
      C + ' #numCtl .numhash{color:var(--in-dim)!important;margin-right:4px!important}',
      // 포지션
      C + '>#posCtl{order:5!important;flex:1 1 100%!important;height:38px!important;border-radius:10px!important;background:var(--in-well)!important;border:0!important;padding:0 6px!important;display:flex!important;align-items:center!important;width:auto!important;max-width:none!important}',
      C + ' #posSel{width:100%!important;height:100%!important;border:0!important;background:transparent!important;color:var(--in-ink)!important;font:700 14px/1 ' + font + '!important}',
      // 색: 펼친 그대로
      C + '>#colorCtl{order:7!important;flex:1 1 100%!important;display:block!important;background:transparent!important;border:0!important;padding:0!important;height:auto!important;width:auto!important;max-width:none!important}',
      C + ' #colorTrig{height:38px!important;width:100%!important;border-radius:10px!important;background:var(--in-well)!important;color:var(--in-ink)!important;border:0!important;justify-content:flex-start!important;padding:0 10px!important;gap:8px!important;font:700 13px/1 ' + font + '!important}',
      C + ' #colorCtl.open #colorPop{display:flex!important;position:static!important;flex-wrap:wrap!important;gap:8px!important;background:transparent!important;box-shadow:none!important;border:0!important;padding:8px 0 2px!important;inset:auto!important;transform:none!important;width:auto!important;max-width:none!important;opacity:1!important;visibility:visible!important}',
      C + ' #colorPop .cdot{width:26px!important;height:26px!important;border-radius:50%!important;box-shadow:inset 0 2px 3px rgba(255,255,255,.4),inset 0 -3px 4px rgba(0,0,0,.3),0 2px 5px rgba(0,0,0,.3)!important}',
      C + ' #colorPop button:not(.cdot){color:var(--in-ink)!important;background:var(--in-well)!important;border:0!important;box-shadow:none!important;opacity:1!important}',
      C + ' .szlbl{color:var(--in-dim)!important;opacity:1!important}',
      // 다음 장면 동작(누르면 board-actions.js 고르기 창)
      C + '>#actBtn{order:9!important;flex:1 1 100%!important;height:38px!important;border-radius:10px!important;justify-content:flex-start!important;padding:0 12px!important;font:700 13px/1 ' + font + '!important;background:var(--in-well)!important;color:var(--in-ink)!important;border:0!important}',
      C + '>#actBtn.on{background:var(--in-accent)!important;color:var(--in-on-ink)!important}',
      // 주발
      C + '>.ps-in-foot{order:11!important;flex:1 1 100%!important;display:flex!important;gap:2px!important;padding:3px!important;border-radius:12px!important;background:var(--in-well)!important;box-shadow:inset 0 1px 3px rgba(0,0,0,.14)!important}',
      C + ' .ps-in-foot button{flex:1 1 0;height:32px;border:0;border-radius:9px;background:transparent;color:var(--in-dim);font:700 12.5px/1 ' + font + ';cursor:pointer}',
      C + ' .ps-in-foot button.on{background:var(--in-tab);color:var(--in-ink);box-shadow:0 1px 3px rgba(0,0,0,.18)}',
      // 도구: 알약 단추
      C + '>button,' + C + '>.sizebox:not(#posCtl):not(#colorCtl){height:34px!important;min-height:34px!important;border-radius:10px!important;font:700 12px/1 ' + font + '!important;background:var(--in-well)!important;color:var(--in-ink)!important;border:0!important;box-shadow:none!important;padding:0 10px!important;display:inline-flex;align-items:center!important;gap:5px!important;width:auto!important;max-width:none!important}',
      C + '>button svg{width:15px!important;height:15px!important}',
      C + '>.sizebox:not(#posCtl):not(#colorCtl) button{background:transparent!important;border:0!important;color:var(--in-ink)!important;height:30px!important;min-width:26px!important}',
      C + '>#delSelBtn{color:#e5484d!important}',
      // 3.085 — «이 토큰만 리셋»은 «다음 장면» 묶음에 넓게(제보 «토큰을 우클릭 했을 때 리셋 버튼이 있으면» — 도구 사이에 묻혀 못 찾았다)
      C + '>#tokAnimResetBtn{order:9!important;flex:1 1 100%!important;height:38px!important;min-height:38px!important;justify-content:flex-start!important;padding:0 12px!important;font:700 13px/1 ' + font + '!important}',
      // 판 색
      'html body.ps-dock-float{--in-bg:linear-gradient(180deg,rgba(255,255,255,.98),rgba(244,246,250,.96));--in-border:rgba(20,22,26,.07);--in-shadow:inset 0 1px 0 #fff,0 14px 34px rgba(15,23,42,.24);--in-ink:#1A2233;--in-dim:#5E6675;--in-line:rgba(20,33,61,.1);--in-well:rgba(20,33,61,.06);--in-tab:#fff;--in-accent:#14213D;--in-on-ink:#fff}',
      'html body.ps-dock-float.ps-skin-glass,html body.ps-dock-float.fmdark{--in-bg:linear-gradient(180deg,rgba(46,54,74,.9),rgba(20,24,36,.93) 55%,rgba(12,15,24,.95));--in-border:rgba(255,255,255,.08);--in-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 18px 40px rgba(0,0,0,.5);--in-ink:#E8ECF4;--in-dim:rgba(232,236,244,.6);--in-line:rgba(255,255,255,.1);--in-well:rgba(255,255,255,.08);--in-tab:rgba(255,255,255,.16);--in-accent:#3E6BFF;--in-on-ink:#fff}',
      'html body.ps-dock-float.ps-skin-bevel.fmdark{--in-bg:linear-gradient(180deg,#3A414E,#2A303B 55%,#20252E)}'
    ];
    return out.join('\n');
  }

  function install(win) {
    var doc = win.document, body = doc.body;
    var ctl = doc.querySelector('.sel-ctl');
    if (!body || !ctl || ctl.__psInsp) return null;
    ctl.__psInsp = true;
    var st = doc.createElement('style'); st.id = 'ps-inspector-css'; st.textContent = css(); doc.head.appendChild(st);
    /* global sel, multiSel, squad, selPanelOpen */
    function g(name) {   // 작전판의 let/const 전역은 같은 문서의 다른 스크립트에서 이름으로 읽힌다(eval 없이 — CSP)
      try { switch (name) {
        case 'sel': return typeof sel !== 'undefined' ? sel : null;
        case 'multiSel': return typeof multiSel !== 'undefined' ? multiSel : null;
        case 'squad': return typeof squad !== 'undefined' ? squad : null;
        case 'selPanelOpen': return typeof selPanelOpen !== 'undefined' ? selPanelOpen : null;
      } } catch (_) {} return null;
    }
    function selPlayer() { var s = g('sel'), m = g('multiSel'); return s && s.type === 'player' && s.ref && !(m && m.length) ? s.ref : null; }
    function shown() { return ctl.style.display !== 'none' && win.getComputedStyle(ctl).display !== 'none'; }
    function active() { return body.classList.contains('ps-dock-float') && !!selPlayer() && shown(); }
    // 더하는 칸들(머리 · 제목 · 주발) — 떠 있는 도크 밖에서는 CSS 가 숨긴다(.ps-insp-on 없이는 display:none)
    var hd = doc.createElement('div'); hd.className = 'ps-in-hd';
    hd.innerHTML = '<span class="ps-in-ball"></span><span style="min-width:0;flex:1 1 auto"><div class="ps-in-nm"></div><div class="ps-in-sub"></div></span><button type="button" class="ps-in-x" title="패널 닫기 (선수를 오른쪽 클릭하면 다시 열려요)" aria-label="패널 닫기">✕</button>';
    var heads = {}; SECTIONS.forEach(function (s) { var h = doc.createElement('div'); h.className = 'ps-in-h'; h.setAttribute('data-sec', s[0]); h.textContent = s[1]; h.style.setProperty('order', String(s[2]), 'important'); heads[s[0]] = h; });
    var foot = doc.createElement('div'); foot.className = 'ps-in-foot'; foot.setAttribute('role', 'group'); foot.setAttribute('aria-label', '주발');
    foot.innerHTML = FEET.map(function (f) { return '<button type="button" data-foot="' + f[0] + '">' + f[1] + '</button>'; }).join('');
    var extra = [hd].concat(SECTIONS.map(function (s) { return heads[s[0]]; }), [foot]);
    var hide = doc.createElement('style'); hide.textContent = '.sel-ctl>.ps-in-hd,.sel-ctl>.ps-in-h,.sel-ctl>.ps-in-foot{display:none}'; doc.head.appendChild(hide);
    extra.forEach(function (e) { ctl.appendChild(e); });
    function rosterFoot(p) { try { var sq = g('squad'), q = p.sqId && sq && (sq.players || []).find(function (x) { return x.id === p.sqId; }); return (q && q.foot) || ''; } catch (_) { return ''; } }
    function chipColor(p) {
      try { var t = doc.querySelector('#tokenLayer [data-id="' + p.id + '"] .tok-c'); var f = t && t.getAttribute('fill'); if (f && f !== 'transparent' && f !== 'none') return f; } catch (_) {}
      try { if (typeof win.teamChipBG === 'function') return win.teamChipBG(p.team); } catch (_) {}
      return '#1b2f6b';
    }
    function paint() {
      if (win.__psSelectionMenu) { win.__psSelectionMenu.sync(); return; }
      var on = active(); if (body.classList.contains('ps-insp-on') !== on) body.classList.toggle('ps-insp-on', on);
      if (!on) { heads.act.style.removeProperty('display'); if (ctl.__inPlaced) { ctl.__inPlaced = false; ['left', 'right', 'top', 'bottom'].forEach(function (k) { if (ctl.style.getPropertyPriority(k) === 'important') ctl.style.removeProperty(k); }); } return; }
      place();
      var p = selPlayer(), rf = rosterFoot(p);
      var ball = hd.querySelector('.ps-in-ball'); ball.textContent = p.num != null ? String(p.num) : ''; ball.style.background = 'radial-gradient(circle at 35% 30%,rgba(255,255,255,.28),rgba(255,255,255,0) 55%),' + chipColor(p);
      hd.querySelector('.ps-in-nm').textContent = p.name || ('#' + (p.num != null ? p.num : '') + ' 선수');
      hd.querySelector('.ps-in-sub').textContent = subLine(p, rf);
      foot.querySelectorAll('button').forEach(function (b) { var v = b.getAttribute('data-foot'), o = v === (p.foot || ''); b.classList.toggle('on', o); b.setAttribute('aria-pressed', o ? 'true' : 'false'); if (!v) b.textContent = rf ? '자동 · ' + footLabel(rf) : '자동'; });
      // 다음 장면이 없으면 «동작» 묶음 제목도 숨긴다
      var ab = doc.getElementById('actBtn'); heads.act.style.setProperty('display', ab && win.getComputedStyle(ab).display !== 'none' ? 'block' : 'none', 'important');
    }
    // 고정 위치가 화면이 아니라 변형된 조상 기준일 수 있다 — 실제 자리를 재서 오른쪽 위(위쪽 막대 아래)에 맞춘다
    var placing = false, selfStyle = null, rafP = 0;
    function soon() { if (rafP) return; rafP = win.requestAnimationFrame(function () { rafP = 0; try { paint(); } catch (_) {} }); }
    function place() {
      if (win.__psSelectionMenu) { win.__psSelectionMenu.place(); return; }
      if (placing || !body.classList.contains('ps-insp-on')) return; placing = true;
      try {
        var r = ctl.getBoundingClientRect(), tb = doc.querySelector('#boardPageStrip.ps-tb>.tb-r'), top = 76;
        if (tb) { var tr = tb.getBoundingClientRect(); if (tr.height) top = Math.round(tr.bottom + 12); }
        // 보드는 토큰 옆 패널 자리를 인라인 !important 로 찍는다 — 같은 방식으로 덮어쓴다(이미 맞으면 쓰지 않는다)
        var cs = win.getComputedStyle(ctl), L0 = parseFloat(cs.left) || 0;
        var moved = win.__psPlayerPanelDrag && win.__psPlayerPanelDrag.position(ctl);
        var sx = moved ? moved.scaleX || 1 : 1;
        var sy = moved ? moved.scaleY || 1 : 1;
        var dx = ((moved ? moved.left : win.innerWidth - 14 - r.width) - r.left) / sx;
        if (moved) top = (parseFloat(cs.top) || 0) + (moved.top - r.top) / sy;
        if (Math.abs(dx) > 1.5 || ctl.style.getPropertyPriority('left') !== 'important') { ctl.style.setProperty('left', Math.round(L0 + dx) + 'px', 'important'); ctl.style.setProperty('right', 'auto', 'important'); }
        // 3.083 — 높이는 CSS 변수로(위쪽 막대 아래 — 보관함 편집에서는 편집 막대만큼 내려간다). 인라인 top 은 2.607 감시자가 바로 지워서
        //         둘이 끝없이 주고받았다(보관함 편집에서 패널이 막대를 덮고 페이지가 쉬지 않았다)
        var de = doc.documentElement; if (de.style.getPropertyValue('--ps-insp-top') !== top + 'px') de.style.setProperty('--ps-insp-top', top + 'px');
        if (ctl.style.top) ctl.style.removeProperty('top');
        ctl.__inPlaced = true; selfStyle = ctl.getAttribute('style');
      } catch (_) {}
      placing = false;
    }
    win.addEventListener('resize', function () { win.setTimeout(place, 50); });
    var userClosed = false, opening = false;
    hd.querySelector('.ps-in-x').addEventListener('click', function (e) { e.stopPropagation(); userClosed = true; try { win.__selPanelOpen(false); } catch (_) {} ctl.style.display = 'none'; win.setTimeout(paint, 0); });
    foot.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-foot]'); if (!b) return; e.stopPropagation();
      var p = selPlayer(); if (!p) return;
      try { if (typeof win.pushUndo === 'function') win.pushUndo(); } catch (_) {}
      setFoot(p, b.getAttribute('data-foot'));
      try { if (typeof win.boardSaveLive === 'function') win.boardSaveLive(); } catch (_) {}
      try { if (typeof win.toast === 'function') win.toast('주발 — ' + (footLabel(p.foot) || '자동(선수단)')); } catch (_) {}
      paint();
    });
    // 선수를 고르면 바로 연다(떠 있는 도크에서만). 오른쪽 클릭으로 열면 «닫음»을 잊는다
    // 2.975 사용자 피드백: 마우스로는 왼쪽 클릭 = 고르기만, 오른쪽 클릭 = 정보 창. 그대로 둔다(패널 자리만 오른쪽)
    function autoOpen() {}
    var orig = win.positionSelCtl;
    if (typeof orig === 'function') win.positionSelCtl = function () { var r = orig.apply(this, arguments); try { autoOpen(); paint(); } catch (_) {} return r; };
    // 무대 아래 여백: 오른쪽 패널은 아래 띠가 아니다
    var lay = win.psSelBarLayout;
    if (typeof lay === 'function') win.psSelBarLayout = function () {
      var add = active() && !ctl.classList.contains('sel-near'); if (add) ctl.classList.add('sel-near');
      try { return lay.apply(this, arguments); } finally { if (add) ctl.classList.remove('sel-near'); }
    };
    // 패널 모양이 바뀌면 다음 그림 때 한 번 — 내가 쓴 스타일 변화는 무시(서로 부르며 멈추지 않게)
    try { new win.MutationObserver(function (recs) { if (recs.every(function (r) { return r.attributeName === 'style' && ctl.getAttribute('style') === selfStyle; })) return; soon(); }).observe(ctl, { attributes: true, attributeFilter: ['style', 'data-kind', 'class'] }); } catch (_) {}
    try { new win.MutationObserver(function () { soon(); }).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}
    // 이름 · 번호를 고치면 머리도 따라간다
    ['nameInput', 'numInput', 'posSel'].forEach(function (id) { var e = doc.getElementById(id); if (e) { e.addEventListener('input', function () { win.setTimeout(paint, 0); }); e.addEventListener('change', function () { win.setTimeout(paint, 0); }); } });
    paint();
    return { paint: paint, active: active };
  }
  if (typeof window !== 'undefined' && window.document) {
    var n = 0; (function tryIt() { var w = window; if (w.document.querySelector('.sel-ctl') && typeof w.positionSelCtl === 'function' && typeof w.__selPanelOpen === 'function') { w.__psInspector = install(w); return; } if (++n < 80) w.setTimeout(tryIt, 250); })();
  }
  return { FEET: FEET, footLabel: footLabel, subLine: subLine, setFoot: setFoot, css: css, install: install };
});
