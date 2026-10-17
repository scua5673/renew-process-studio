/* PROCESS STUDIO — 장면 줄 + 도구 = 한 덩어리(3.079, 레이아웃 2단계). 사용자 목업 «장면 줄 + 도구 = 한 덩어리» → «2단계 만들어서 보여줘».
   떠 있는 하단 도크(body.ps-dock-float)에서 도크(#ps-command-dock) 자체를 카드 하나로 만들고,
   위는 필름 줄(#animBar) — ▶ 재생 · 장면 썸네일(번호 · 시간) · ＋ · 장면 편집 · 속도 · 내보내기, 아래는 도구 줄(#cmd-tool-row).
   - 노드는 옮기지 않는다: #animBar 는 #ps-command-dock 의 바로 아래 자식 그대로(숨김 · 스킨 · 무대 여백 규칙이 그 자리를 본다).
     차례는 묶음(.cmd-cluster)의 CSS order 로만 바꾼다.
   - 장면 칩(.anim-frame)의 썸네일 칸(.aft)은 보드가 이미 채운다(__afWindow) — 숨겨 두던 것을 보이게 하고,
     장면마다 확대가 다르지 않게 전체 운동장 viewBox(data-psvb)로 맞춘다. #animFrames 에는 칩 말고 아무것도 넣지 않는다(순서 · 끌기가 자식 번호를 쓴다).
   - 시간 표시는 칩 안의 작은 글자(.df-dur): 머무는 시간(animHold) + 다음 장면까지 이동(1 ÷ 속도). 마지막 장면은 머무는 시간만. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSDockFilm = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // 장면 i 의 재생 시간(초) — 보드 playAnim 과 같은 셈: 머묾 max(.2, hold) + (마지막이 아니면) 이동 max(.3, dur||1) / 속도
  function sceneSecs(frames, i, hold, speedOf) {
    if (!frames || !frames[i]) return 0;
    var f = frames[i], s = Math.max(0.2, +hold || 0.6);
    if (i < frames.length - 1) { var sp = speedOf ? +speedOf(f) : (+f.moveSpeed > 0 ? +f.moveSpeed : 1); s += Math.max(0.3, +f.dur || 1) / (sp > 0 ? sp : 1); }
    return Math.round(s * 10) / 10;
  }
  function fmtSecs(s) { return (Math.round(s * 10) / 10).toFixed(1) + '초'; }

  var N = []; for (var i = 0; i < 16; i++) N.push(':not(#fm' + i + ')');
  var NN = N.join('');
  var F = 'html.ps-page-board body.ps-dock-float #ps-command-dock' + NN;                 // 도크(카드)
  var A = 'html.ps-page-board body.ps-dock-float:not(.ps-df-anim-off) #ps-command-dock' + NN + '>#animBar';   // 필름 줄(보일 때만)
  function css() {
    var white = 'background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(246,247,250,.94))!important;border:1px solid rgba(20,22,26,.07)!important;box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 12px 30px rgba(8,12,24,.22)!important;-webkit-backdrop-filter:blur(18px) saturate(1.4)!important;backdrop-filter:blur(18px) saturate(1.4)!important;';
    return [
      // 카드: 도크가 판 하나 — 줄 둘은 투명, 사이 가는 선
      F + '{gap:0!important;padding:0!important;align-items:stretch!important;border-radius:24px!important;overflow:visible!important}',
      // 스킨이 없을 때(또는 «기본» 밝은 화면): 흰 판
      'html.ps-page-board body.ps-dock-float:not(.ps-skin-glass):not(.ps-skin-bevel):not(.fmdark) #ps-command-dock' + NN + '{' + white + '}',
      F + '>#animBar,' + F + ' #cmd-tool-row{background:transparent!important;border:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;max-width:none!important}',
      F + '>#floatBar{min-height:0!important;height:auto!important;align-items:stretch!important}',
      F + ' #cmd-tool-row{justify-content:center!important;border-radius:0 0 24px 24px!important;max-height:none!important}',
      // 색: 스킨마다 강조색 · 선
      'html.ps-page-board body.ps-dock-float #ps-command-dock{--df-accent:#14213D;--df-line:rgba(20,33,61,.1);--df-ink:#1A2233;--df-dim:#5E6675;--df-well:rgba(20,33,61,.06);--df-on-ink:#fff}',
      'html.ps-page-board body.ps-dock-float.ps-skin-glass #ps-command-dock,html.ps-page-board body.ps-dock-float.fmdark #ps-command-dock{--df-accent:#5B82FF;--df-line:rgba(255,255,255,.1);--df-ink:#E8ECF4;--df-dim:rgba(232,236,244,.6);--df-well:rgba(255,255,255,.08)}',
      'html.ps-page-board body.ps-dock-float.ps-skin-bevel.fmdark #ps-command-dock,html.ps-page-board body.ps-dock-float.ps-skin-flat.fmdark #ps-command-dock{--df-accent:#E6E9EF;--df-on-ink:#14161A}',
      // 필름 줄
      A + '{display:flex!important;flex-direction:row!important;align-items:center!important;gap:8px!important;height:auto!important;min-height:0!important;max-height:none!important;padding:8px 12px 8px 10px!important;width:auto!important;overflow:visible!important;contain:inline-size;border-bottom:1px solid var(--df-line)!important;border-radius:24px 24px 0 0!important;column-gap:8px!important}',
      A + '>.cmd-cluster{height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;background:transparent!important;box-shadow:none!important;border:0!important;display:flex!important;align-items:center!important;gap:4px!important;flex:0 0 auto!important;width:auto!important;max-width:none!important}',
      A + '>#cmd-scene-transport{order:0!important}' + A + '>#cmd-scene-strip{order:1!important;flex:1 1 auto!important;min-width:120px!important;overflow:hidden!important}' + A + '>#cmd-scene-edit{order:2!important}' + A + '>#cmd-scene-time{order:3!important}' + A + '>#cmd-scene-export{order:4!important}',
      A + '>#cmd-scene-time,' + A + '>#cmd-scene-export{padding-left:8px!important;border-left:1px solid var(--df-line)!important;border-radius:0!important}',
      A + ' #cmd-scene-meta{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;padding:0!important;margin:-1px!important}',
      // ▶ 큰 둥근 단추
      A + ' #animPlay{width:44px!important;min-width:44px!important;max-width:44px!important;height:44px!important;min-height:44px!important;max-height:44px!important;flex:0 0 44px!important;border-radius:50%!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:0!important}',
      A + ' #animPlay{background:linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,0) 55%,rgba(0,0,0,.14)),var(--df-accent)!important;color:var(--df-on-ink)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -2px 0 rgba(0,0,0,.2),0 6px 14px rgba(0,0,0,.28)!important}',
      A + ' #animPlay:hover{transform:translateY(-1px)!important}',
      A + ' #animPlay svg{color:var(--df-on-ink)!important;fill:var(--df-on-ink)!important;stroke:none!important}',
      A + ' #animPlay svg{width:20px!important;height:20px!important;max-width:20px!important;max-height:20px!important}',
      // 장면 썸네일
      A + ' #animFrames{display:flex!important;align-items:center!important;gap:8px!important;flex:1 1 auto!important;min-width:0!important;max-width:none!important;width:auto!important;height:56px!important;min-height:56px!important;max-height:56px!important;padding:5px 4px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important;background:transparent!important;box-shadow:none!important;border:0!important}',
      A + ' #animFrames::-webkit-scrollbar{display:none}',
      A + ' #animFrames>.anim-frame{position:relative!important;flex:0 0 78px!important;width:78px!important;min-width:78px!important;max-width:78px!important;height:46px!important;min-height:46px!important;max-height:46px!important;padding:0!important;border:0!important;border-radius:10px!important;overflow:hidden!important;background:#2f6e3a!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 2px 6px rgba(0,0,0,.28)!important;display:block!important;cursor:pointer!important;transition:transform .15s,box-shadow .15s!important}',
      A + ' #animFrames>.anim-frame:hover{transform:translateY(-1px)!important}',
      A + ' #animFrames>.anim-frame.on{box-shadow:0 0 0 2.5px var(--df-accent),0 4px 12px rgba(0,0,0,.35)!important}',
      A + ' #animFrames>.anim-frame.sel:not(.on){box-shadow:0 0 0 2px var(--df-accent),0 0 0 4px rgba(255,255,255,.5)!important}',
      A + ' #animFrames>.anim-frame.dragging{opacity:.45!important}',
      A + ' #animFrames>.anim-frame.drop{box-shadow:0 0 0 2.5px dashed var(--df-accent)!important;outline:2px dashed var(--df-accent)!important;outline-offset:2px!important}',
      A + ' #animFrames>.anim-frame .aft{display:block!important;position:absolute!important;inset:0!important;left:0!important;top:0!important;width:100%!important;height:100%!important;border-radius:0!important;background:#2f6e3a!important;overflow:hidden!important;pointer-events:none!important}',
      A + ' #animFrames>.anim-frame .aft>svg{display:block!important;width:100%!important;height:100%!important}',
      A + ' #animFrames>.anim-frame .afi{position:absolute!important;left:5px!important;top:4px!important;right:auto!important;width:auto!important;min-width:0!important;height:auto!important;padding:1px 6px!important;border-radius:6px!important;background:rgba(0,0,0,.55)!important;color:#fff!important;font:900 10.5px/14px Pretendard,-apple-system,sans-serif!important;z-index:2!important;pointer-events:none!important;transform:none!important}',
      A + ' #animFrames>.anim-frame .df-dur{position:absolute!important;right:5px!important;bottom:3px!important;z-index:2!important;font:800 10px/1 Pretendard,-apple-system,sans-serif!important;color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.85)!important;pointer-events:none!important}',
      A + ' #animFrames>.anim-frame .afm{display:none!important}',
      A + ' #animFrames>.anim-frame.on .afm,' + A + ' #animFrames>.anim-frame.on .afm *{color:#fff!important}' + A + ' #animFrames>.anim-frame.on .afm{display:inline-flex!important;position:absolute!important;right:3px!important;top:3px!important;left:auto!important;width:22px!important;min-width:22px!important;height:18px!important;min-height:18px!important;max-height:18px!important;padding:0!important;align-items:center!important;justify-content:center!important;border:0!important;border-radius:6px!important;background:rgba(0,0,0,.55)!important;color:#fff!important;font:900 12px/1 Pretendard,-apple-system,sans-serif!important;z-index:3!important}',
      A + ' #animFrames>.anim-frame .afc{z-index:2!important}',
      A + ' #animFrames>.anim-frame.sg-start{margin-left:12px!important}',
      A + ' #animFrames:empty::before{content:"1"!important;display:flex!important;align-items:flex-start!important;justify-content:flex-start!important;flex:0 0 78px!important;width:78px!important;height:46px!important;padding:4px 6px!important;box-sizing:border-box!important;border-radius:10px!important;background:#2f6e3a!important;color:#fff!important;font:900 10.5px/14px Pretendard,-apple-system,sans-serif!important;box-shadow:0 0 0 2.5px var(--df-accent)!important}',
      A + ' #animFrames:empty::after{display:block!important;align-self:center!important;color:var(--df-dim)!important;font:700 12px/1.3 Pretendard,-apple-system,sans-serif!important;margin-left:10px!important;white-space:nowrap!important}',
      // ＋ 다음 장면: 점선 칸
      A + ' #animAdd{width:46px!important;min-width:46px!important;max-width:46px!important;height:46px!important;min-height:46px!important;max-height:46px!important;flex:0 0 46px!important;border-radius:10px!important;background:transparent!important;border:1.5px dashed var(--df-line)!important;box-shadow:none!important;color:var(--df-dim)!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;margin-right:4px!important}',
      A + ' #animAdd:hover{border-color:var(--df-accent)!important;color:var(--df-ink)!important;background:var(--df-well)!important}',
      A + ' #animAdd svg{width:20px!important;height:20px!important}',
      A + ' #cmd-scene-edit>button:not(#animAdd),' + A + ' #animLoopBtn,' + A + ' #cmd-export-btn{width:34px!important;min-width:34px!important;max-width:34px!important;height:34px!important;min-height:34px!important;max-height:34px!important;flex:0 0 34px!important;padding:0!important;border-radius:10px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}',
      A + ' #cmd-scene-time select{height:32px!important;min-height:32px!important;max-height:32px!important;border-radius:10px!important;padding:0 8px!important;font:800 12px/1 Pretendard,-apple-system,sans-serif!important;width:auto!important;min-width:52px!important}',
      // 알림(#cs-ftoast)이 카드 위에 겹치지 않게
      'html body.ps-dock-float #cs-ftoast{bottom:calc(var(--dock-h,72px) + 32px)!important}'
    ].join('\n');
  }

  function install(win) {
    var doc = win.document, body = doc.body;
    if (!body || body.__psDockFilm) return null;
    body.__psDockFilm = true;
    var st = doc.createElement('style'); st.id = 'ps-dock-film-css'; st.textContent = css(); doc.head.appendChild(st);
    function on() { return body.classList.contains('ps-dock-float'); }
    function g(name) { try { return win.eval('typeof ' + name + '!=="undefined"?' + name + ':null'); } catch (_) { return null; } }
    // 칩마다: 시간 글자 · 썸네일을 전체 운동장으로
    function decorate() {
      var box = doc.getElementById('animFrames'); if (!box) return;
      var A0 = g('anim'), frames = A0 && A0.frames, hold = g('animHold'), sp = typeof win.animMoveSpeed === 'function' ? win.animMoveSpeed : null;
      var chips = box.children;
      for (var i = 0; i < chips.length; i++) {
        var c = chips[i]; if (!c.classList || !c.classList.contains('anim-frame')) continue;
        if (frames && frames[i]) {
          var t = fmtSecs(sceneSecs(frames, i, hold, sp)), d = c.querySelector('.df-dur');
          if (!d) { d = doc.createElement('span'); d.className = 'df-dur'; d.setAttribute('aria-hidden', 'true'); c.appendChild(d); }
          if (d.textContent !== t) d.textContent = t;
          c.title = '장면 ' + (i + 1) + ' · ' + t;
        }
        var sv = c.querySelector('.aft>svg'); if (sv && on()) {
          var vb = sv.getAttribute('data-psvb'); if (vb && sv.getAttribute('viewBox') !== vb) sv.setAttribute('viewBox', vb);
          if (sv.getAttribute('preserveAspectRatio') !== 'xMidYMid slice') sv.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        }
      }
    }
    var busy = false, queued = false;
    function later() { if (queued) return; queued = true; win.requestAnimationFrame(function () { queued = false; if (busy) return; busy = true; try { decorate(); } catch (_) {} busy = false; }); }
    function watch() {
      var box = doc.getElementById('animFrames'); if (!box || box.__psFilm) return !!box;
      box.__psFilm = true;
      try { new win.MutationObserver(function () { if (!busy) later(); }).observe(box, { childList: true, subtree: true }); } catch (_) {}
      ['animSpeedSel', 'animHoldSel'].forEach(function (id) { var s = doc.getElementById(id); if (s) s.addEventListener('change', function () { win.setTimeout(later, 0); }); });
      later();
      return true;
    }
    var n = 0; (function tryIt() { if (watch()) return; if (++n < 80) win.setTimeout(tryIt, 250); })();
    return { decorate: decorate };
  }
  if (typeof window !== 'undefined' && window.document) {
    var go = function () { window.__psDockFilm = install(window); };
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', go); else go();
  }
  return { sceneSecs: sceneSecs, fmtSecs: fmtSecs, css: css, install: install };
});
