/* PROCESS STUDIO — 작전판 빠른 내보내기(3.115). 오류 제보 0077af18 «화면 캡쳐했을때 걸리적 거려요» — 화면을 캡처하면
   위쪽 막대(평면 · 3D · 선수 모양)가 판 가운데에 찍혔다. 사용자 «PDF 내보내기 알려주자 잘 보이게» · «png나 PDF로 빠르게 내보내기 할 수 있게».
   - 위쪽 막대 오른쪽 «내보내기» → PNG 이미지(예전 exportPNG 그대로) · PDF 문서(A4 한 장: 보드 · 페이지 이름 + 판 그림)
   - 장면 막대 «내보내기 ▾»(GIF · MP4 · PNG)에도 PDF
   그림은 판 SVG(boardImageXML)로 그리므로 떠 있는 단추 · 도구 막대 · 선택 표시는 들어가지 않는다.
   단추는 board-topbar.js 가 오른쪽 덩어리에 넣는다(button()). PDF 조립 · 저장 창은 board.html 의 것(_jpegPagesToPdf · _ppbPickSaveTarget)을 쓴다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSQuickExport = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // A4 를 CSS px(96dpi)로. 판이 가로로 길면 가로 종이 — 세로 운동장이면 세로 종이
  var A4 = [1123, 794], MARGIN = 36, TITLE_H = 30, FS = 15, SC = 2;
  var FONT = "700 " + FS + "px 'Pretendard Variable',Pretendard,-apple-system,sans-serif";

  // 제목(있으면)과 판 그림을 한 덩어리로 종이 가운데에. 그림은 비율 그대로 여백 안에 꽉
  function layout(w, h, hasTitle) {
    w = +w || 1; h = +h || 1;
    var land = w >= h, W = land ? A4[0] : A4[1], H = land ? A4[1] : A4[0], th = hasTitle ? TITLE_H : 0;
    var bw = W - 2 * MARGIN, bh = H - 2 * MARGIN - th, k = Math.min(bw / w, bh / h), dw = w * k, dh = h * k;
    var x = MARGIN + (bw - dw) / 2, top = MARGIN + (bh - dh) / 2;
    return { land: land, W: W, H: H, x: x, y: top + th, dw: dw, dh: dh, tx: x, ty: top + FS + 2 };
  }
  // 파일 이름(«작전판 - 페이지»)을 종이 제목으로
  function titleOf(base) { return String(base || '').replace(/ - /g, ' · ').trim(); }

  var ITEMS = [
    { k: 'png', badge: 'PNG', label: 'PNG 이미지', hint: '지금 보이는 판 그대로' },
    { k: 'pdf', badge: 'PDF', label: 'PDF 문서', hint: 'A4 한 장 · 인쇄 · 공유' }
  ];
  var ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></svg>';

  function css() {
    return [
      'html #boardPageStrip>.tb-r>#tbExport{display:inline-flex!important;align-items:center!important;gap:5px!important}',
      '#tbExport svg{width:15px!important;height:15px!important;flex:none}',
      '#ps-tb-export{position:fixed;z-index:430;display:none;min-width:232px;padding:6px;border-radius:14px;background:rgba(255,255,255,.98);box-shadow:0 14px 34px rgba(8,12,24,.28);border:1px solid rgba(20,22,26,.07);font-family:Pretendard,-apple-system,sans-serif;color:#14161A}',
      '#ps-tb-export.on{display:block}',
      '#ps-tb-export>button{display:flex!important;width:100%!important;align-items:center;gap:10px;height:46px!important;padding:0 10px!important;border:0!important;border-radius:9px!important;background:transparent!important;color:inherit!important;text-align:left;cursor:pointer;box-shadow:none!important;font-family:inherit!important}',
      '#ps-tb-export>button:hover,#ps-tb-export>button:focus-visible{background:rgba(20,33,61,.07)!important;outline:none}',
      '#ps-tb-export .qx-b{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:22px;padding:0 5px;border:1px solid rgba(20,33,61,.18);border-radius:5px;font:800 10px/1 Pretendard,-apple-system,sans-serif;letter-spacing:.04em;flex:none}',
      '#ps-tb-export .qx-t{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '#ps-tb-export .qx-l{font:700 13px/1.1 Pretendard,-apple-system,sans-serif}',
      '#ps-tb-export .qx-h{font:500 11px/1.1 Pretendard,-apple-system,sans-serif;opacity:.62}',
      'body.fmdark #ps-tb-export,body.ps-skin-glass #ps-tb-export{background:rgba(28,32,42,.97);color:#E8ECF4;border-color:rgba(255,255,255,.08)}',
      'body.fmdark #ps-tb-export .qx-b,body.ps-skin-glass #ps-tb-export .qx-b{border-color:rgba(255,255,255,.22)}',
      'body.fmdark #ps-tb-export>button:hover,body.ps-skin-glass #ps-tb-export>button:hover{background:rgba(255,255,255,.08)!important}'
    ].join('\n');
  }

  function install(win) {
    var doc = win.document;
    if (!doc || !doc.body || win.__psQuickExport) return win.__psQuickExport || null;
    var st = doc.createElement('style'); st.id = 'ps-quick-export-css'; st.textContent = css(); doc.head.appendChild(st);
    var menu = doc.createElement('div'); menu.id = 'ps-tb-export'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', '내보내기');
    menu.innerHTML = ITEMS.map(function (it) {
      return '<button type="button" role="menuitem" data-qx="' + it.k + '"><span class="qx-b" aria-hidden="true">' + it.badge + '</span><span class="qx-t"><span class="qx-l">' + it.label + '</span><span class="qx-h">' + it.hint + '</span></span></button>';
    }).join('');
    doc.body.appendChild(menu);
    var busy = false;

    function toast(m) { try { if (typeof win.toast === 'function') win.toast(m); } catch (_) {} }
    function unlocked() {
      var ok = true; try { if (typeof win.psVaultUnlocked === 'function') ok = !!win.psVaultUnlocked(); } catch (_) {}
      if (!ok) toast('로그인하면 PNG · PDF 로 내보낼 수 있어요');
      return ok;
    }
    function base() { try { if (typeof win._animDefaultBase === 'function') return win._animDefaultBase(); } catch (_) {} return '작전판'; }
    function safe(s) { try { if (typeof win._pdfSafeName === 'function') return win._pdfSafeName(s); } catch (_) {} return String(s || '작전판').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || '작전판'; }
    function loadImg(src) { return new Promise(function (ok, no) { var im = new win.Image(); im.onload = function () { ok(im); }; im.onerror = function () { no(new Error('image')); }; im.src = src; }); }
    function jpeg(c) {
      return new Promise(function (ok, no) {
        var done = function (u8) { ok(u8); };
        if (c.toBlob) c.toBlob(function (b) { if (!b) { no(new Error('jpeg')); return; } b.arrayBuffer().then(function (ab) { done(new Uint8Array(ab)); }, no); }, 'image/jpeg', 0.92);
        else { var s = win.atob(c.toDataURL('image/jpeg', 0.92).split(',')[1]), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); done(u); }
      });
    }
    function clip(ctx, t, max) {
      if (ctx.measureText(t).width <= max) return t;
      while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
      return t + '…';
    }
    // PDF 한 장 — 판 그림(boardImageXML)을 A4 종이에. 저장 창은 누른 그 순간에 먼저 연다(만든 뒤엔 브라우저가 막는다)
    async function pdf() {
      if (busy || !unlocked()) return;
      var name = base(), fname = safe(name) + '.pdf', target = null;
      if (typeof win._ppbPickSaveTarget === 'function') target = await win._ppbPickSaveTarget(fname);
      if (target === false) return;   // 저장 창에서 취소
      busy = true;
      try {
        try { if (typeof win.deselect === 'function') win.deselect(); } catch (_) {}
        var o = win.boardImageXML(), t = titleOf(name), L = layout(o.w, o.h, !!t);
        var img = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(o.xml));
        try { if (doc.fonts && doc.fonts.load) await doc.fonts.load(FONT, t); } catch (_) {}
        var c = doc.createElement('canvas'); c.width = L.W * SC; c.height = L.H * SC;
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.scale(SC, SC);
        if (t) { ctx.font = FONT; ctx.fillStyle = '#14161A'; ctx.textBaseline = 'alphabetic'; ctx.fillText(clip(ctx, t, L.dw), L.tx, L.ty); }
        ctx.fillStyle = o.gb || '#1d8a47'; ctx.fillRect(L.x, L.y, L.dw, L.dh); ctx.drawImage(img, L.x, L.y, L.dw, L.dh);
        var bytes = await jpeg(c), pw = c.width, ph = c.height; c.width = 0; c.height = 0;   // 캔버스 뒷판은 바로 놓는다(2.559)
        var blob = win._jpegPagesToPdf([{ data: bytes, w: pw, h: ph }], L.land);
        if (target) { var w = await target.createWritable(); await w.write(blob); await w.close(); toast('PDF 저장됨 ✓ — ' + (target.name || fname)); return; }
        var a = doc.createElement('a'); a.href = win.URL.createObjectURL(blob); a.download = fname; doc.body.appendChild(a); a.click(); a.remove();
        win.setTimeout(function () { try { win.URL.revokeObjectURL(a.href); } catch (_) {} }, 5000);
        toast('PDF 저장됨 ✓ — ' + fname);
      } catch (e) {
        try { win.console.warn('[quick-export pdf]', e); } catch (_) {}
        toast('PDF 를 만들지 못했어요 — 다시 눌러 주세요');
      } finally { busy = false; }
    }
    function png() { if (!unlocked()) return; try { win.exportPNG(); } catch (e) { toast('이미지를 만들지 못했어요 — 다시 눌러 주세요'); } }
    function run(k) { if (k === 'pdf') return pdf(); return png(); }

    // 위쪽 막대의 단추(board-topbar.js 가 덩어리를 세울 때마다 새로 받는다)
    function button(d) {
      d = d || doc;
      var b = d.createElement('button'); b.type = 'button'; b.id = 'tbExport'; b.className = 'tb-export';
      b.title = '내보내기 — PNG 이미지 · PDF 문서(판만 깔끔하게)'; b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'ps-tb-export');
      b.innerHTML = ICON + '<span>내보내기</span>';
      return b;
    }
    function close() { if (!menu.classList.contains('on')) return; menu.classList.remove('on'); var b = doc.getElementById('tbExport'); if (b) b.setAttribute('aria-expanded', 'false'); }
    function open(b) {
      menu.classList.add('on'); b.setAttribute('aria-expanded', 'true');
      var r = b.getBoundingClientRect(), vw = win.innerWidth || doc.documentElement.clientWidth || 0;
      menu.style.top = Math.round(r.bottom + 10) + 'px';
      menu.style.left = Math.round(Math.max(8, Math.min(r.right - menu.offsetWidth, vw - menu.offsetWidth - 8))) + 'px';
    }
    // 장면 막대 «내보내기 ▾»(board.html buildSceneGroups)에 PDF 줄 — PNG 아래
    function dockItem() {
      var pop = doc.getElementById('cmd-export-pop'); if (!pop || doc.getElementById('pdfBtn')) return;
      var b = doc.createElement('button'); b.type = 'button'; b.id = 'pdfBtn'; b.className = 'btn ghost anim-ico export-format-btn cmd-export-item';
      b.title = 'PDF 문서 내보내기 — A4 한 장'; b.setAttribute('aria-label', 'PDF 문서 내보내기'); b.setAttribute('role', 'menuitem');
      b.innerHTML = '<span class="export-format-icon" aria-hidden="true">PDF</span><span class="cmd-export-item-label">PDF 문서</span>';
      var png0 = doc.getElementById('pngBtn');
      if (png0 && png0.parentNode === pop) pop.insertBefore(b, png0.nextSibling); else pop.appendChild(b);
    }
    doc.addEventListener('click', function (e) {
      var t = e.target, c = t && t.closest ? t : null; if (!c) return;
      if (c.closest('#cmd-export-btn')) { dockItem(); return; }
      var d = c.closest('#pdfBtn');
      if (d) { e.stopPropagation(); var eb = doc.getElementById('cmd-export-btn'), pop = doc.getElementById('cmd-export-pop'); if (eb && pop && pop.classList.contains('on')) eb.click(); pdf(); return; }
      var b = c.closest('#tbExport');
      if (b) { e.stopPropagation(); if (menu.classList.contains('on')) close(); else open(b); return; }
      var it = c.closest('#ps-tb-export [data-qx]');
      if (it) { e.stopPropagation(); close(); run(it.getAttribute('data-qx')); return; }
      if (!menu.contains(t)) close();
    }, true);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    win.addEventListener('resize', close);
    var api = { button: button, png: png, pdf: pdf, close: close, menu: menu };
    win.__psQuickExport = api;
    return api;
  }
  var mod = { layout: layout, titleOf: titleOf, ITEMS: ITEMS, css: css, install: install,
    button: function (d) { var w = typeof window !== 'undefined' ? window : null; var a = w && (w.__psQuickExport || install(w)); return a ? a.button(d) : null; } };
  if (typeof window !== 'undefined' && window.document) {
    var go = function () { install(window); };
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', go); else go();
  }
  return mod;
});
