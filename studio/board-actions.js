/* PROCESS STUDIO — 토큰마다 동작 고르기(3.075). 사용자 «애니메이션 만들 때 선택하게 하면 되지 않을까? 토큰마다 선택해서».
   선수를 하나 고르면 선택 패널(.sel-ctl)에 «동작» 단추가 생긴다 — 지금 장면에서 다음 장면으로 넘어가는 동안 그 선수가 할 동작.
   고른 동작은 그 장면의 곡선 정보에 함께 둔다(anim.frames[i].curves.acts = { 토큰 id: 동작 }) — 곡선처럼 재생 · 영상 · 저장이 그대로 실어 나른다.
   동작의 뜻과 그림은 board-broadcast.js(ACTS · motion) · board-token-depth.js 가 맡는다. 3D «사람» 모양에서 보인다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSActions = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // 장면 i 의 동작 표를 읽고 쓴다(장면 객체를 바꾸지 않고 새 곡선 객체로 — 다른 장면 · 되돌리기와 섞이지 않게)
  function getAct(frame, id) { var a = frame && frame.curves && frame.curves.acts; return a && typeof a[id] === 'string' ? a[id] : ''; }
  function setAct(frame, id, act) {
    if (!frame) return false;
    var c = Object.assign({}, frame.curves || {}), a = Object.assign({}, c.acts || {});
    if (act) a[id] = act; else delete a[id];
    if (Object.keys(a).length) c.acts = a; else delete c.acts;
    frame.curves = Object.keys(c).length ? c : null;
    return true;
  }
  function label(acts, key) { for (var i = 0; i < acts.length; i++) for (var j = 0; j < acts[i].items.length; j++) if (acts[i].items[j][0] === key) return acts[i].items[j][1]; return ''; }

  function install(win) {
    var doc = win.document, ctl = doc.querySelector('.sel-ctl');
    if (!ctl || ctl.__psActs || !win.PSBroadcast) return null;
    ctl.__psActs = true;
    var ACTS = win.PSBroadcast.ACTS;
    var st = doc.createElement('style');
    st.textContent = '#actBtn.on{background:#14213D!important;color:#fff!important}' +
      '#ps-act-pop{position:fixed;z-index:420;display:none;width:300px;padding:12px;border-radius:18px;background:rgba(255,255,255,.96);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);box-shadow:0 14px 34px rgba(8,12,24,.28);border:1px solid rgba(20,22,26,.07);font-family:inherit;color:#14161A}' +
      '#ps-act-pop.on{display:block}#ps-act-pop h4{margin:0 0 2px;font-size:13px;font-weight:800}#ps-act-pop .sub{font-size:11.5px;color:#646A73;margin-bottom:8px}' +
      '#ps-act-pop .grp{font-size:11px;font-weight:700;color:#646A73;margin:10px 0 6px}#ps-act-pop .row{display:flex;flex-wrap:wrap;gap:6px}' +
      '#ps-act-pop button{border:0;border-radius:10px;padding:7px 10px;background:rgba(20,33,61,.06);color:#14161A;font:700 12.5px/1 inherit;cursor:pointer}' +
      '#ps-act-pop button.on{background:#14213D;color:#fff}#ps-act-pop button:hover:not(.on){background:rgba(20,33,61,.12)}' +
      'body.fmdark #ps-act-pop{background:rgba(28,32,42,.96);color:#e8ebf0}body.fmdark #ps-act-pop button{background:rgba(255,255,255,.08);color:#e8ebf0}';
    doc.head.appendChild(st);
    var btn = doc.createElement('button'); btn.type = 'button'; btn.id = 'actBtn'; btn.className = 'gk-btn'; btn.style.setProperty('display', 'none', 'important');
    btn.title = '이 장면 → 다음 장면 동안 이 선수의 동작(3D «사람»에서 보여요)';
    var anchor = doc.getElementById('lookBtn'); if (anchor && anchor.parentNode === ctl) ctl.insertBefore(btn, anchor.nextSibling); else ctl.appendChild(btn);
    var pop = doc.createElement('div'); pop.id = 'ps-act-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', '선수 동작'); doc.body.appendChild(pop);
    // 작전판의 전역(anim · animActive · sel)은 같은 문서의 다른 스크립트라 이름으로 읽는다
    function ctx() {
      try {
        /* global anim, animActive, sel */
        var A = win.eval('typeof anim!=="undefined"?anim:null'), i = win.eval('typeof animActive!=="undefined"?animActive:-1'), s = win.eval('typeof sel!=="undefined"?sel:null');
        if (!A || !s || s.type !== 'player' || !s.ref || !(i >= 0) || i >= A.frames.length - 1) return null;
        return { frame: A.frames[i], idx: i, p: s.ref };
      } catch (_) { return null; }
    }
    function paint() {
      var c = ctx(); if (!c) { btn.style.setProperty('display', 'none', 'important'); hide(); return; }
      var a = getAct(c.frame, c.p.id); btn.style.setProperty('display', 'flex', 'important');   // 선택 패널 CSS 가 모르는 단추를 숨기므로 직접
      btn.textContent = a ? '동작 · ' + label(ACTS, a) : '동작';
      btn.classList.toggle('on', !!a);
      if (pop.classList.contains('on')) fill(c);
    }
    function fill(c) {
      var a = getAct(c.frame, c.p.id), gk = win.PSBroadcast.isGK(c.p);
      var h = '<h4>' + (c.p.name || ('#' + (c.p.num || ''))) + ' — 장면 ' + (c.idx + 1) + ' → ' + (c.idx + 2) + '</h4><div class="sub">고르지 않으면 «자동» — 공 가까운 선수가 차고 받아요</div>';
      var groups = gk ? [ACTS[0], ACTS[3], ACTS[1], ACTS[2]] : ACTS;
      groups.forEach(function (g) { h += '<div class="grp">' + g.group + '</div><div class="row">' + g.items.map(function (it) { return '<button type="button" data-act="' + it[0] + '"' + (it[0] === a ? ' class="on"' : '') + '>' + it[1] + '</button>'; }).join('') + '</div>'; });
      pop.innerHTML = h;
    }
    function place() { var r = btn.getBoundingClientRect(), w = 300, left = Math.max(10, Math.min(win.innerWidth - w - 10, r.left + r.width / 2 - w / 2)); pop.style.left = left + 'px'; var top = r.top - pop.offsetHeight - 10; if (top < 10) top = r.bottom + 10; pop.style.top = top + 'px'; }
    function show() { var c = ctx(); if (!c) return; fill(c); pop.classList.add('on'); place(); }
    function hide() { pop.classList.remove('on'); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); if (pop.classList.contains('on')) hide(); else show(); });
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return; e.stopPropagation();
      var c = ctx(); if (!c) return;
      try { if (typeof win.pushUndo === 'function') win.pushUndo(); } catch (_) {}
      setAct(c.frame, c.p.id, b.getAttribute('data-act'));
      try { if (typeof win.renderMotionPaths === 'function') win.renderMotionPaths(); } catch (_) {}
      try { if (typeof win.boardSaveLive === 'function') win.boardSaveLive(); } catch (_) {}
      try { if (typeof win.toast === 'function') win.toast(b.getAttribute('data-act') ? '동작 «' + b.textContent + '» — 장면 ' + (c.idx + 1) + ' → ' + (c.idx + 2) : '동작 자동'); } catch (_) {}
      paint(); hide();
    });
    doc.addEventListener('pointerdown', function (e) { if (pop.classList.contains('on') && !pop.contains(e.target) && e.target !== btn) hide(); }, true);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    // 선택 패널이 다시 놓일 때마다(선택 · 장면이 바뀔 때) 단추를 맞춘다
    var orig = win.positionSelCtl;
    if (typeof orig === 'function') win.positionSelCtl = function () { var r = orig.apply(this, arguments); try { paint(); } catch (_) {} return r; };
    paint();
    return { paint: paint, show: show, hide: hide };
  }
  if (typeof window !== 'undefined' && window.document) {
    var n = 0; (function tryIt() { var w = window; if (w.document.querySelector('.sel-ctl') && w.PSBroadcast && typeof w.positionSelCtl === 'function') { w.__psActions = install(w); return; } if (++n < 80) w.setTimeout(tryIt, 250); })();
  }
  return { getAct: getAct, setAct: setAct, install: install };
});
