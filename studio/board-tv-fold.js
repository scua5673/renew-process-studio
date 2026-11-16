/* PROCESS STUDIO — 전체화면에서 «접기 / 펴기»(3.304).
   사용자 «전체 화면 누르면 아예 안 보이게끔 접고 펴고 할 수 있게»(TV 에 연결해 운동장만 보여 줄 때).
   보관함 작전판의 «전체화면»(body.vault-full)에는 닫기 묶음(#vvBar — 이름 · 편집 · 닫기), 페이지 넘김(#vvPg), 만들기 · 편집 중이면 도크가 남는다.
   - 닫기 묶음에 «접기»(#vvFold)를 하나 둔다. 누르면 body.ps-tv-fold — 닫기 묶음 · 페이지 넘김 · 도크(접힌 알약 포함)를 모두 걷고
     무대 아래의 도크 자리를 걷는다(운동장이 화면을 다 쓴다). 셸에도 알려(tvFold) 맨 아래 저장 상태 줄을 걷는다.
   - 다시 펴는 길: 아래 가운데의 작은 손잡이(#psTvFold — 흐리게, 늘 보인다: 손가락 기기엔 hover 가 없다) · Esc.
   - 전체화면 안에서는 도크의 «도구 접기»(#ps-df-fold)도 같은 «모두 접기»다(접힌 알약 «도구 펼치기»가 남지 않게).
   - 전체화면에 들어갈 때는 늘 펴진 채로, 나가면 접힘을 푼다. 저장하는 것 없음 · board.html 은 <script> 한 줄.
   enterVaultFull / exitVaultFull 은 본문의 안쪽 함수라 감싸지 못한다 — body class 를 지켜본다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSTvFold = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var N = ''; for (var i = 0; i < 20; i++) N += ':not(#tf' + i + ')';   // 도크 규칙(id 를 여럿 붙인 display!important)을 이긴다
  var F = 'html.ps-page-board body.vault-full.ps-tv-fold';
  function css() {
    return [
      F + ' #vvBar,' + F + ' #vvPg{display:none!important}',
      F + ' #ps-command-dock' + N + ',' + F + ' #ps-dock' + N + ',' + F + ' #ps-df-opts' + N + ',' + F + ' #ps-df-tray' + N + ',' + F + ' #psVvPlay' + N + '{display:none!important}',
      // 접기 단추(닫기 묶음 안 — 묶음의 .vv-btn 모양 그대로)
      '#vvBar #vvFold{gap:5px}#vvBar #vvFold svg{width:14px;height:14px;flex:none}',
      // 펴기 손잡이 — 작고 흐리게, 늘 보인다
      '#psTvFold{position:fixed;left:50%;bottom:max(8px,env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:330;display:none;align-items:center;justify-content:center;width:64px;height:22px;padding:0;border:0;border-radius:999px;background:rgba(10,14,22,.34);color:#fff;opacity:.5;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:opacity .2s,background .2s}',
      '#psTvFold svg{width:16px;height:16px;pointer-events:none}',
      '#psTvFold::before{content:"";position:absolute;inset:-14px -18px}',   // 누르는 자리는 넉넉히(보이는 크기는 작게)
      '#psTvFold:hover,#psTvFold:focus-visible{opacity:1;background:rgba(10,14,22,.62);outline:none}',
      'body.vault-full.ps-tv-fold #psTvFold{display:flex}',
      '@keyframes psTvFoldIn{0%{opacity:1;background:rgba(10,14,22,.7)}70%{opacity:1;background:rgba(10,14,22,.7)}100%{opacity:.5;background:rgba(10,14,22,.34)}}',
      'body.vault-full.ps-tv-fold #psTvFold.fresh{animation:psTvFoldIn 1.8s ease-out 1}'
    ].join('\n');
  }
  var UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  var DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var T_FOLD = '접기', T_FOLD_TIP = '도구 · 단추를 모두 접어 운동장만 보이게 — 다시 펴기: 아래 가운데 손잡이 · Esc', T_OPEN = '펴기';

  function install(win) {
    var doc = win.document, body = doc.body;
    if (!body || body.__psTvFold) return null;
    body.__psTvFold = true;
    var st = doc.createElement('style'); st.id = 'ps-tv-fold-css'; st.textContent = css(); doc.head.appendChild(st);
    function full() { return body.classList.contains('vault-full'); }
    function folded() { return body.classList.contains('ps-tv-fold'); }
    function tell(on) { try { if (win.parent && win.parent !== win) win.parent.postMessage({ source: 'board', type: 'tvFold', on: !!on }, '*'); } catch (_) {} }
    function refit() {
      var f = function () { try { if (typeof win.fitBoardAspect === 'function') win.fitBoardAspect(); } catch (_) {} };
      f(); win.setTimeout(f, 80); win.setTimeout(f, 300);
    }
    /* 무대 아래 여백 — 만들기 · 편집 중 전체화면에만 도크 자리가 있다(본문 enterVaultFull 이 인라인 !important 로 적는다).
       접히면 «도크 없음»의 값(GAP)으로, 펴면 본문과 같은 셈(도크 높이 + 14)으로 적는다. GAP 은 본문의 무대 여백 감시자(2.607 fix —
       «도크가 먹는 만큼 + 12»)와 같은 수다: 0 을 적으면 그 감시자가 12 로 되돌려 서로 다시 쓴다(처음엔 0 으로 적고 psSelBarLayout 까지 감쌌다가 걷었다). */
    var GAP = 12, padded = false;
    function pad(on) {
      var stg = doc.getElementById('boardStage'); if (!stg) return;
      if (on) { if (!body.classList.contains('vcreating')) return; stg.style.setProperty('padding-bottom', GAP + 'px', 'important'); padded = true; return; }
      if (!padded) return; padded = false;
      if (full() && body.classList.contains('vcreating')) {
        var dk = doc.getElementById('ps-command-dock') || doc.getElementById('ps-dock'), h = dk ? dk.getBoundingClientRect().height : 0;
        if (h) { stg.style.setProperty('padding-bottom', (Math.round(h) + 14) + 'px', 'important'); return; }
      }
      stg.style.removeProperty('padding-bottom');
    }
    var handle = null;
    function ensureHandle() {
      if (handle) return handle;
      handle = doc.createElement('button'); handle.type = 'button'; handle.id = 'psTvFold'; handle.innerHTML = UP;
      handle.title = T_OPEN; handle.setAttribute('aria-label', T_OPEN);
      handle.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); set(false); });
      body.appendChild(handle);
      return handle;
    }
    function ensureButton() {
      var bar = doc.getElementById('vvBar'); if (!bar || doc.getElementById('vvFold')) return;
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'vv-btn'; b.id = 'vvFold';
      b.innerHTML = DOWN + '<span>' + T_FOLD + '</span>'; b.title = T_FOLD_TIP; b.setAttribute('aria-label', T_FOLD);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); set(true); });
      var first = doc.getElementById('vvEdit') || doc.getElementById('vvClose');
      if (first && first.parentNode === bar) bar.insertBefore(b, first); else bar.appendChild(b);
    }
    function set(on) {
      on = !!on && full();
      if (on === folded()) return on;
      if (on) { var h = ensureHandle(); h.classList.remove('fresh'); void h.offsetWidth; h.classList.add('fresh'); }
      body.classList.toggle('ps-tv-fold', on);
      pad(on); tell(on); refit();
      if (!on) { try { var b = doc.getElementById('vvFold'); if (b && full()) b.focus({ preventScroll: true }); } catch (_) {} }
      return on;
    }
    // 전체화면 들고 남: 들어오면 단추를 붙이고(늘 펴진 채), 나가면 접힘을 푼다
    var wasFull = full();
    function sync() {
      var now = full();
      if (now) ensureButton();
      if (now === wasFull) return; wasFull = now;
      if (!now && folded()) { body.classList.remove('ps-tv-fold'); pad(false); tell(false); refit(); }
    }
    try { new win.MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}
    sync();
    // 전체화면 안의 «도구 접기»는 «모두 접기»
    doc.addEventListener('click', function (e) {
      if (!full() || folded()) return;
      var t = e.target && e.target.closest ? e.target.closest('#ps-df-fold') : null; if (!t) return;
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      set(true);
    }, true);
    // 접힌 동안 Esc 는 «펴기»(전체화면의 Esc = 닫기보다 먼저)
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !folded()) return;
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      set(false);
    }, true);
    return { set: set, folded: folded };
  }
  if (typeof window !== 'undefined' && window.document) {
    var go = function () { window.__psTvFold = install(window); };
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', go); else go();
  }
  return { css: css, install: install };
});
