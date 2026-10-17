/* PROCESS STUDIO — 실제 비율 크기(3.083 · 사용자 «실제 비율에서 원하는 만큼 키울 수 있게 해줘 공도 사람도»).
   3D · 중계에서 실제 비율(설정 «비율 › 실제 비율» 또는 «사람» 모양)일 때 선수 · 공을 운동장 대비 몇 배로 그릴지 정한다.
   값은 보드마다(«look» 설정 realK = "선수배율|공배율") 저장되고, 작전판의 _realTokS 가 window.__rk(0 선수 · 1 공)로 곱한다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSRealSize = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var MIN = 1, MAX = 6, STEP = 0.25, DEF = '1|1';
  function clamp(v) { v = +v; if (!isFinite(v)) return 1; return Math.max(MIN, Math.min(MAX, Math.round(v / STEP) * STEP)); }
  function parse(s) { var m = /^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/.exec(String(s == null ? '' : s)); return m ? [clamp(m[1]), clamp(m[2])] : [1, 1]; }
  function fmt(k) { return clamp(k[0]) + '|' + clamp(k[1]); }
  function ok(v) { return typeof v === 'string' && /^\d+(?:\.\d+)?\|\d+(?:\.\d+)?$/.test(v); }
  function label(v) { return '×' + (Math.round(v * 100) / 100); }

  /* global state, tokShape, renderTokens, positionSelCtl, boardSaveLive, toast, _lookFreeze, _realTokS */
  function install(win) {
    var doc = win.document;
    if (!doc || win.__psRealSize) return null;
    win.__psRealSize = true;
    var K = [1, 1];
    win.__realK = DEF;
    // 작전판이 곱하는 배율: 3D 실제 비율일 때만 의미가 있다(_realTokS 가 그때만 부른다)
    win.__rk = function (i) { return K[i ? 1 : 0] || 1; };
    function active() { try { return doc.body.classList.contains('bc-tilt3d') && (win.__realScale === true || tokShape === 'person'); } catch (_) { return false; } }
    function set(i, v, quiet) {
      var n = clamp(v); if (n === K[i]) return;
      if (!quiet) { try { _lookFreeze(); } catch (_) {} }
      K[i] = n; win.__realK = fmt(K); sync(); redraw();
    }
    var raf = 0;
    function redraw() {
      if (raf) return;
      raf = (win.requestAnimationFrame || win.setTimeout)(function () { raf = 0; try { renderTokens(); } catch (_) {} try { positionSelCtl(); } catch (_) {} });
    }
    function save() { try { boardSaveLive(); } catch (_) {} }

    // 보드마다 저장: 작전판의 look 설정에 realK 한 칸을 더한다(본문 스크립트가 이 모듈 뒤에 정의하므로 문서를 다 읽은 뒤에)
    function wrapLook() {
      var keys = win.lookKeys, okF = win._lookOk, code = win._lookCode, now = win.lookNow, apply = win.lookApply, scale = win.scaleAll;
      if (typeof keys !== 'function' || keys.__rk) return;
      win.lookKeys = function () { var a = keys(); return a.indexOf('realK') < 0 ? a.concat(['realK']) : a; };
      win.lookKeys.__rk = 1;
      if (typeof okF === 'function') win._lookOk = function (k, v) { return k === 'realK' ? ok(v) : okF(k, v); };
      if (typeof code === 'function') win._lookCode = function (k) { return k === 'realK' ? DEF : code(k); };
      if (typeof now === 'function') win.lookNow = function () { var r = now(); r.realK = fmt(K); return r; };
      if (typeof apply === 'function') win.lookApply = function (o) { var r = apply(o); var n = parse(o && o.realK); if (n[0] !== K[0] || n[1] !== K[1]) { K = n; win.__realK = fmt(K); sync(); } return r; };
      // 보드 설정 «크기 ＋ －» — 실제 비율일 때는 선수 · 공 배율을 한 칸씩 함께 바꾼다(예전에는 «고정돼요» 알림만 떴다)
      if (typeof scale === 'function') win.scaleAll = function (f) {
        if (!active()) return scale(f);
        var up = f > 1, d = up ? STEP * 2 : -STEP * 2, a = clamp(K[0] + d), b = clamp(K[1] + d);
        if (a === K[0] && b === K[1]) { try { toast(up ? '실제 비율 크기가 가장 커요 (' + label(MAX) + ')' : '실제 비율 크기가 가장 작아요 (실제 크기)'); } catch (_) {} return; }
        try { _lookFreeze(); } catch (_) {}
        K = [a, b]; win.__realK = fmt(K); sync(); redraw(); save();
        try { toast('실제 비율 크기 — 선수 ' + label(a) + ' · 공 ' + label(b)); } catch (_) {}
      };
    }

    // 조절 창: 선수 · 공 슬라이더 두 줄(위쪽 바의 «크기» 단추와 보드 설정 «실제 크기» 줄에서 같은 모양으로 쓴다)
    function sliders(host) {
      host.innerHTML = '';
      [['선수', 0], ['공', 1]].forEach(function (r) {
        var row = doc.createElement('div'); row.className = 'rs-row';
        row.innerHTML = '<span class="rs-name">' + r[0] + '</span><input type="range" min="' + MIN + '" max="' + MAX + '" step="' + STEP + '" data-rk="' + r[1] + '" aria-label="' + r[0] + ' 크기"><span class="rs-val" data-rkv="' + r[1] + '"></span>';
        host.appendChild(row);
      });
      var reset = doc.createElement('button'); reset.type = 'button'; reset.className = 'rs-reset'; reset.textContent = '실제 크기로'; reset.setAttribute('data-rk-reset', '1');
      host.appendChild(reset);
      sync();
    }
    function sync() {
      [].forEach.call(doc.querySelectorAll('input[data-rk]'), function (inp) { var v = K[+inp.getAttribute('data-rk')]; if (+inp.value !== v) inp.value = String(v); });
      [].forEach.call(doc.querySelectorAll('[data-rkv]'), function (s) { s.textContent = label(K[+s.getAttribute('data-rkv')]); });
      var b = doc.querySelector('#boardPageStrip .tb-rsize'); if (b) { var big = K[0] !== 1 || K[1] !== 1; b.classList.toggle('on', !!(pop && pop.classList.contains('open'))); b.setAttribute('data-k', big ? label(K[0]) : ''); }
    }
    doc.addEventListener('input', function (e) { var t = e.target; if (t && t.matches && t.matches('input[data-rk]')) set(+t.getAttribute('data-rk'), t.value, t.__rkDrag); if (t) t.__rkDrag = true; }, true);
    doc.addEventListener('change', function (e) { var t = e.target; if (t && t.matches && t.matches('input[data-rk]')) { t.__rkDrag = false; save(); } }, true);
    doc.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('[data-rk-reset]')) { e.stopPropagation(); try { _lookFreeze(); } catch (_) {} K = [1, 1]; win.__realK = DEF; sync(); redraw(); save(); return; }
      var b = t && t.closest && t.closest('#boardPageStrip .tb-rsize');
      if (b) { e.stopPropagation(); toggle(b); return; }
      if (pop && pop.classList.contains('open') && !(t && t.closest && t.closest('#ps-rsize-pop'))) close();
    }, true);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop && pop.classList.contains('open')) close(); });

    var pop = null;
    function toggle(btn) {
      if (pop && pop.classList.contains('open')) { close(); return; }
      if (!pop) { pop = doc.createElement('div'); pop.id = 'ps-rsize-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', '실제 비율 크기'); doc.body.appendChild(pop); }
      pop.innerHTML = '<div class="rs-head">실제 비율 크기<span>운동장 대비 몇 배로 그릴지</span></div><div class="rs-body"></div>';
      sliders(pop.querySelector('.rs-body'));
      var r = btn.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(win.innerWidth - 268, r.left + r.width / 2 - 130)) + 'px';
      pop.style.top = Math.round(r.bottom + 10) + 'px';
      pop.classList.add('open'); sync();
    }
    function close() { if (pop) pop.classList.remove('open'); sync(); }

    // 보드 설정 › 칩 › «비율» 바로 아래 «실제 크기» 줄(설정 정리가 줄을 옮긴 뒤에 붙인다)
    var tries = 0;
    function addRow() {
      var seg = doc.getElementById('realScaleSeg'), row = seg && seg.closest('.menurow');
      if (!row || !row.hasAttribute('data-bs-tab')) { if (++tries < 80) win.setTimeout(addRow, 250); return; }
      if (doc.getElementById('realSizeRow')) return;
      var mine = doc.createElement('div'); mine.className = 'menurow'; mine.id = 'realSizeRow'; mine.setAttribute('data-bs-tab', row.getAttribute('data-bs-tab'));
      mine.innerHTML = '<span class="menulbl">실제 크기</span><div class="rs-inline"></div>';
      row.parentNode.insertBefore(mine, row.nextSibling);
      sliders(mine.querySelector('.rs-inline'));
    }

    var st = doc.createElement('style'); st.id = 'ps-rsize-css';
    st.textContent = [
      // 위쪽 바 «크기» 단추: 3D · 중계에서만
      'html body:not(.bc-tilt3d) #boardPageStrip .tb-rs,html body:not(.bc-tilt3d) #boardPageStrip .tb-rsize{display:none!important}',
      '#boardPageStrip .tb-rsize{position:relative}',
      '#boardPageStrip .tb-rsize[data-k]:not([data-k=""]):after{content:attr(data-k);position:absolute;right:-3px;top:-4px;font:800 9px/1 Pretendard,-apple-system,sans-serif;padding:2px 4px;border-radius:6px;background:#2f6bff;color:#fff}',
      '#ps-rsize-pop{position:fixed;z-index:10050;width:260px;padding:12px 14px 12px;border-radius:14px;background:rgba(255,255,255,.98);color:#1A2233;border:1px solid rgba(20,33,61,.08);box-shadow:0 14px 34px rgba(15,23,42,.22);display:none;font:600 12.5px/1.3 Pretendard,-apple-system,sans-serif}',
      '#ps-rsize-pop.open{display:block}',
      'body.fmdark #ps-rsize-pop,body.ps-skin-glass #ps-rsize-pop{background:rgba(28,32,42,.97);color:#E8ECF4;border-color:rgba(255,255,255,.08)}',
      '#ps-rsize-pop .rs-head{font-weight:800;font-size:13px;margin-bottom:8px}',
      '#ps-rsize-pop .rs-head span{display:block;font-weight:600;font-size:11px;opacity:.6;margin-top:2px}',
      '.rs-row{display:flex;align-items:center;gap:8px;margin:6px 0}',
      '.rs-row .rs-name{flex:none;width:34px;white-space:nowrap;font-weight:700;background:none!important;border:0!important;padding:0!important;box-shadow:none!important}',
      '.rs-row input[type=range]{flex:1 1 auto;min-width:0;accent-color:#2f6bff}',
      '.rs-row .rs-val{flex:none;width:40px;text-align:right;font-variant-numeric:tabular-nums;font-weight:800}',
      '.rs-reset{margin-top:6px;height:28px;padding:0 10px;border-radius:8px;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit;font:700 11.5px/1 Pretendard,-apple-system,sans-serif;cursor:pointer}',
      '#realSizeRow{flex-wrap:wrap}',
      '#realSizeRow .rs-inline{flex:1 1 180px;min-width:0}'
    ].join('\n');
    (doc.head || doc.documentElement).appendChild(st);

    function boot() { wrapLook(); addRow(); sync(); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
    return { set: set, get: function () { return K.slice(); } };
  }
  if (typeof window !== 'undefined' && window.document) install(window);
  return { parse: parse, fmt: fmt, ok: ok, clamp: clamp, MIN: MIN, MAX: MAX, STEP: STEP };
});
