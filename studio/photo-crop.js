/* PROCESS STUDIO — 사진 영역 편집(3.125, 오류 제보 70307dd9).
   사용자(코치) «팀 등록에서 선수를 추가하면서 사진을 삽입할 때, 보드에서 토큰을 클릭해 선수 사진을 삽입할 때처럼 사진 영역(확대, 좌우, 위아래)을 편집할 수 있어야».
   작전판 토큰 사진 창(board.html openTokenPhotoCrop)과 같은 손놀림 — 사진을 끌어 자리를 맞추고, 확대 · 좌우 · 위아래 막대로 다듬는다.
   결과는 정사각 사진 한 장(기본 192px JPEG, 빈 곳은 흰색 — team-photos.js square 와 같은 모양). 취소하면 null.
   팀 등록(analysis.html)은 PSTeamPhotos.pick 으로 부른다. 작전판의 토큰 창은 그대로(배경색 고르기 · 투명 둘레가 있어 다르다). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSPhotoCrop = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var ZMAX = 4;
  function clamp(v) { v = +v; return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5; }
  function zoomOf(z) { z = +z; return isFinite(z) ? Math.max(1, Math.min(ZMAX, z)) : 1; }
  // 잘라 낼 정사각 영역 — 확대 1 이면 짧은 변 전체. fx · fy(0~1)는 남는 폭 안의 자리(0.5 = 가운데)
  function rect(w, h, zoom, fx, fy) {
    var base = Math.min(w, h), size = base / zoomOf(zoom);
    return { size: size, x: (w - size) * clamp(fx), y: (h - size) * clamp(fy) };
  }
  // 미리보기를 dx · dy(화면 px) 만큼 끌었을 때의 새 자리 — 사진이 손가락을 따라온다
  function dragTo(start, dx, dy, w, h, zoom, viewPx) {
    var r = rect(w, h, zoom, start.fx, start.fy), k = r.size / Math.max(1, viewPx);
    return {
      fx: w - r.size > 0 ? clamp(start.fx - dx * k / (w - r.size)) : 0.5,
      fy: h - r.size > 0 ? clamp(start.fy - dy * k / (h - r.size)) : 0.5
    };
  }
  function load(src, doc) {
    return new Promise(function (res, rej) {
      var img = new (doc.defaultView || window).Image();
      img.onload = function () { if ((img.naturalWidth || img.width) && (img.naturalHeight || img.height)) res(img); else rej(Error('empty')); };
      img.onerror = function () { rej(Error('decode')); };
      img.src = src;
    });
  }
  function css(doc) {
    if (doc.getElementById('psCropCss')) return;
    var st = doc.createElement('style'); st.id = 'psCropCss';
    st.textContent = '#psCropDlg{border:1px solid var(--c-line,#E3E6EA);border-radius:var(--r-card,12px);padding:var(--sp-5,20px);width:320px;max-width:calc(100vw - 32px);box-shadow:var(--sh-2);box-sizing:border-box;color:var(--c-ink,#14161A);background:var(--c-panel,#fff)}'
      + '#psCropDlg::backdrop{background:rgba(16,24,40,.45)}'
      + '#psCropDlg h2{font-size:var(--t-6,16px);margin:0 0 4px;text-align:center;overflow-wrap:anywhere}'
      + '#psCropDlg p{font-size:var(--t-3,12px);margin:0 0 12px;text-align:center;color:var(--c-ink-2,#5E6675)}'
      + '#psCropDlg canvas{display:block;width:220px;height:220px;max-width:100%;margin:0 auto 12px;border-radius:50%;touch-action:none;cursor:grab;background:#fff;box-shadow:0 0 0 1px var(--c-line,#E3E6EA)}'
      + '#psCropDlg canvas:active{cursor:grabbing}'
      + '#psCropDlg label{display:grid;grid-template-columns:52px 1fr;align-items:center;gap:8px;font-size:var(--t-3,12px);margin:6px 0}'
      + '#psCropDlg input[type=range]{width:100%}'
      + '#psCropDlg .actions{display:flex;gap:8px;justify-content:center;margin-top:16px}';
    (doc.head || doc.documentElement).appendChild(st);
  }
  /* opts: {src(그림 주소), doc, title, size(192), type('image/jpeg'), quality(.82)} → Promise<data URL | null(취소)> */
  function open(opts) {
    opts = opts || {};
    var doc = opts.doc || document, SIZE = +opts.size || 192, VIEW = 220;
    return load(opts.src, doc).then(function (img) {
      return new Promise(function (resolve) {
        css(doc);
        var old = doc.getElementById('psCropDlg'); if (old) old.remove();
        var dlg = doc.createElement('dialog'); dlg.id = 'psCropDlg'; dlg.setAttribute('aria-labelledby', 'psCropTitle');
        dlg.innerHTML = '<h2 id="psCropTitle"></h2><p>사진을 끌어서 자리를 맞추고 확대하세요.</p>'
          + '<canvas width="' + VIEW * 2 + '" height="' + VIEW * 2 + '" aria-label="사진 미리보기 — 끌어서 자리 맞추기"></canvas>'
          + '<label>확대<input type="range" min="1" max="' + ZMAX + '" step="0.05" value="1" data-k="zoom" aria-label="확대"></label>'
          + '<label>좌우<input type="range" min="0" max="100" step="1" value="50" data-k="fx" aria-label="좌우 자리"></label>'
          + '<label>위아래<input type="range" min="0" max="100" step="1" value="50" data-k="fy" aria-label="위아래 자리"></label>'
          + '<div class="actions"><button type="button" data-cancel>취소</button><button type="button" class="primary" data-ok>적용</button></div>';
        dlg.querySelector('h2').textContent = opts.title || '사진 영역 편집';
        var cv = dlg.querySelector('canvas'), g = cv.getContext('2d'), inp = {};
        [].forEach.call(dlg.querySelectorAll('input[type=range]'), function (el) { inp[el.getAttribute('data-k')] = el; });
        var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, st = { zoom: 1, fx: 0.5, fy: 0.5 }, drag = null, done = false;
        function paint(c, n) { var r = rect(W, H, st.zoom, st.fx, st.fy); c.fillStyle = '#fff'; c.fillRect(0, 0, n, n); c.drawImage(img, r.x, r.y, r.size, r.size, 0, 0, n, n); }
        function draw() { paint(g, cv.width); inp.zoom.value = st.zoom; inp.fx.value = Math.round(st.fx * 100); inp.fy.value = Math.round(st.fy * 100); }
        inp.zoom.oninput = function () { st.zoom = zoomOf(inp.zoom.value); draw(); };
        inp.fx.oninput = function () { st.fx = clamp(inp.fx.value / 100); draw(); };
        inp.fy.oninput = function () { st.fy = clamp(inp.fy.value / 100); draw(); };
        cv.onpointerdown = function (e) { drag = { x: e.clientX, y: e.clientY, fx: st.fx, fy: st.fy }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} };
        cv.onpointermove = function (e) { if (!drag) return; var p = dragTo(drag, e.clientX - drag.x, e.clientY - drag.y, W, H, st.zoom, cv.getBoundingClientRect().width || VIEW); st.fx = p.fx; st.fy = p.fy; draw(); };
        cv.onpointerup = cv.onpointercancel = function () { drag = null; };
        cv.onwheel = function (e) { e.preventDefault(); st.zoom = zoomOf(st.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); draw(); };
        function finish(v) {
          if (done) return; done = true;
          try { if (dlg.close && dlg.open) dlg.close(); } catch (_) {}
          dlg.remove(); resolve(v);
        }
        dlg.querySelector('[data-cancel]').onclick = function () { finish(null); };
        dlg.addEventListener('cancel', function (e) { e.preventDefault(); finish(null); });   // Esc
        dlg.querySelector('[data-ok]').onclick = function () {
          try { var out = doc.createElement('canvas'); out.width = out.height = SIZE; paint(out.getContext('2d'), SIZE); finish(out.toDataURL(opts.type || 'image/jpeg', opts.quality || 0.82)); }
          catch (_) { finish(null); }
        };
        doc.body.appendChild(dlg);
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
        draw();
        try { inp.zoom.focus(); } catch (_) {}
      });
    });
  }
  return { rect: rect, dragTo: dragTo, clamp: clamp, open: open };
});
