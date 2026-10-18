/* PROCESS STUDIO — PDF 내보내기 창(3.091 · 사용자 «일정 연간 월간 주간 PDF — PDF 내보내기 디자인»).
   일정의 PDF(연간 · 월간 · 주간 · 일간 · 부하 리포트)도 작전판 · 훈련 PDF 와 같은 창으로 연다:
   위 띠(제목 · 개인 노트로 · PDF 내려받기 · 인쇄 · 닫기) + 가운데 종이 한 장 미리보기.
   «PDF 내려받기»는 미리보기 종이를 그림(JPEG)으로 찍어 PDF 파일을 바로 만든다 — 인쇄 창을 거치지 않아 폰 · 아이패드에서도 된다.
   종이 그림은 SVG(foreignObject)로 찍으므로 페이지 글꼴을 못 본다 — 쓰인 글자가 든 Pretendard 조각만 data: 로 넣는다
   (작전판 board-name-font.js 의 이름표 글꼴과 같은 방법). 같은 곳의 그림(로고 등)도 data: 로 바꿔 넣는다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSPdfExport = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var A4 = { land: [1123, 794], port: [794, 1123] };   // 96dpi 의 A4(px)
  var SC = 2;                                            // 종이 그림 배율(글자가 또렷하게 · 1123×794 → 2246×1588)
  var MAX_PAGES = 12;
  var FONT_CSS = '/vendor/fonts.css';

  function safeName(s) { return String(s || '문서').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || '문서'; }

  // fonts.css → [{family, weight, file, ur, ranges:[[lo,hi]…]}] — local() 은 건너뛰고 url() 만
  function parseFaces(css) {
    var out = [], re = /@font-face\s*\{([^}]*)\}/g, m;
    while ((m = re.exec(String(css || '')))) {
      var b = m[1], fam = /font-family:\s*['"]?([^;'"]+)['"]?\s*;/.exec(b), url = /url\(([^)]+\.woff2)\)/.exec(b), ur = /unicode-range:\s*([^;]+);?/.exec(b), wt = /font-weight:\s*([^;]+);/.exec(b);
      if (!fam || !url) continue;
      var u = ur ? ur[1].trim() : 'U+0-10FFFF', ranges = u.split(',').map(function (r) {
        var q = r.trim().replace(/^U\+/i, '').split('-'), lo = parseInt(q[0], 16), hi = q[1] ? parseInt(q[1], 16) : lo;
        return [lo, hi];
      }).filter(function (r) { return isFinite(r[0]) && isFinite(r[1]); });
      out.push({ family: fam[1].trim(), weight: wt ? wt[1].trim() : '400', file: url[1].replace(/['"]/g, ''), ur: u, ranges: ranges });
    }
    return out;
  }
  // 글자들이 드는 조각(같은 파일은 한 번 · 이름이 둘인 같은 조각 — 'Pretendard' · 'Pretendard Variable' — 은 둘 다 돌려준다)
  function pick(faces, text) {
    var files = {}, s = String(text || ''), out = [];
    for (var i = 0; i < s.length; i++) {
      var cp = s.codePointAt(i); if (cp > 0xffff) i++;
      for (var j = 0; j < faces.length; j++) {
        var f = faces[j], hit = false;
        for (var k = 0; k < f.ranges.length && !hit; k++) hit = cp >= f.ranges[k][0] && cp <= f.ranges[k][1];
        if (hit) { files[f.file] = 1; break; }
      }
    }
    faces.forEach(function (f) { if (files[f.file]) out.push(f); });
    return out;
  }
  function faceCss(faces, data) {
    return faces.filter(function (f) { return data[f.file]; }).map(function (f) {
      return "@font-face{font-family:'" + f.family + "';font-style:normal;font-weight:" + f.weight + ';src:url(data:font/woff2;base64,' + data[f.file] + ") format('woff2');unicode-range:" + f.ur + '}';
    }).join('\n');
  }

  // JPEG 쪽들 → PDF(한 쪽 = 그림 한 장, A4). 작전판 board.html 의 _jpegPagesToPdf 와 같은 짜임.
  function jpegPagesToPdf(imgs, land) {
    var wPt = land ? 841.89 : 595.28, hPt = land ? 595.28 : 841.89;
    var enc = function (s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
    var parts = [], offs = [], pos = 0;
    var push = function (u) { parts.push(u); pos += u.length; };
    var addStr = function (num, body) { offs[num] = pos; push(enc(num + ' 0 obj\n' + body + '\nendobj\n')); };
    var addStream = function (num, head, bin) { offs[num] = pos; push(enc(num + ' 0 obj\n' + head)); push(bin); push(enc('\nendstream\nendobj\n')); };
    push(enc('%PDF-1.4\n'));
    var N = imgs.length, kids = [];
    for (var i = 0; i < N; i++) kids.push((3 + i * 3) + ' 0 R');
    addStr(1, '<< /Type /Catalog /Pages 2 0 R >>');
    addStr(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + N + ' >>');
    imgs.forEach(function (im, i) {
      var pn = 3 + i * 3, cn = 4 + i * 3, xn = 5 + i * 3;
      addStr(pn, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + wPt + ' ' + hPt + '] /Resources << /XObject << /Im' + i + ' ' + xn + ' 0 R >> >> /Contents ' + cn + ' 0 R >>');
      var cs = 'q ' + wPt + ' 0 0 ' + hPt + ' 0 0 cm /Im' + i + ' Do Q';
      addStr(cn, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
      addStream(xn, '<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.data.length + ' >>\nstream\n', im.data);
    });
    var xref = pos, total = 3 + N * 3;
    var x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var n = 1; n < total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
    x += 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    push(enc(x));
    var len = 0; parts.forEach(function (p) { len += p.length; });
    var out = new Uint8Array(len), o = 0; parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return typeof Blob === 'function' ? new Blob([out], { type: 'application/pdf' }) : out;
  }

  function install(win) {
    var doc = win.document;
    if (!doc || win.__psPdfExportOn) return null;
    win.__psPdfExportOn = 1;
    var ov = null, cfg = null, fontData = {}, facesP = null;

    function b64(buf) { var u = new Uint8Array(buf), s = '', CH = 0x8000; for (var i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH)); return win.btoa(s); }
    function faces() {
      if (!facesP) facesP = win.fetch(FONT_CSS).then(function (r) { return r.ok ? r.text() : ''; }).then(parseFaces, function () { return []; });
      return facesP;
    }
    // 이 글자들에 필요한 글꼴 조각을 받아 @font-face(data:) 글로
    function fontCssFor(text) {
      return faces().then(function (all) {
        var need = pick(all, text), files = {};
        need.forEach(function (f) { files[f.file] = 1; });
        return Promise.all(Object.keys(files).map(function (file) {
          if (fontData[file]) return null;
          return win.fetch(file).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (buf) { if (buf) fontData[file] = b64(buf); }, function () {});
        })).then(function () { return faceCss(need, fontData); });
      });
    }
    // 같은 곳의 그림을 data: 로(SVG 그림 안에서는 바깥 주소를 못 읽는다). 못 바꾸면 그대로 둔다.
    function inlineImages(root) {
      var imgs = [].slice.call(root.querySelectorAll('img[src]')).filter(function (im) { return !/^data:/i.test(im.getAttribute('src') || ''); });
      return Promise.all(imgs.map(function (im) {
        return win.fetch(im.getAttribute('src')).then(function (r) { return r.ok ? r.blob() : null; }).then(function (bl) {
          if (!bl) return;
          return new Promise(function (res) { var fr = new win.FileReader(); fr.onload = function () { im.setAttribute('src', String(fr.result)); res(); }; fr.onerror = function () { res(); }; fr.readAsDataURL(bl); });
        }, function () {});
      }));
    }
    // 미리보기 종이(iframe 의 문서)를 A4 쪽들로 찍는다 — 불러올 때 맞춘 높이 · 배율(인라인 style)까지 그대로
    function rasterize(fdoc, land) {
      var size = land ? A4.land : A4.port, W = size[0], H = size[1];
      var body = fdoc.body; if (!body) return Promise.reject(new Error('preview not ready'));
      var styleText = ''; [].forEach.call(fdoc.querySelectorAll('style'), function (s) { styleText += s.textContent + '\n'; });
      var full = Math.max(H, fdoc.documentElement.scrollHeight || 0, body.scrollHeight || 0);
      // 여러 장 문서(연간 PDF 의 .ponepage 마다 한 쪽)는 장의 실제 위치 · 높이대로 자른다 — H 로만 자르면 장마다 몇 px 씩 밀린다
      var rects = [], els = fdoc.querySelectorAll('#printDoc .ponepage'), sy = (fdoc.defaultView && fdoc.defaultView.scrollY) || 0;
      if (els.length > 1) [].forEach.call(els, function (el) { var r = el.getBoundingClientRect(); if (r.height > 40) rects.push([r.top + sy, r.height]); });
      rects = rects.slice(0, MAX_PAGES);
      if (rects.length) full = Math.max(full, rects[rects.length - 1][0] + rects[rects.length - 1][1]);
      var pages = rects.length || Math.max(1, Math.min(MAX_PAGES, Math.ceil((full - 4) / H)));
      var tmp = doc.implementation.createHTMLDocument('');
      var holder = tmp.createElement('div'); holder.innerHTML = body.innerHTML;
      [].forEach.call(holder.querySelectorAll('script'), function (s) { s.remove(); });
      return Promise.all([fontCssFor(body.textContent || ''), inlineImages(holder)]).then(function (r) {
        var fcss = r[0] || '';
        tmp.body.innerHTML = '<style>' + fcss + '\n' + styleText + '</style>' + holder.innerHTML;
        if (body.className) tmp.body.className = body.className;
        var FH = rects.length ? Math.ceil(full) : H * pages;
        tmp.body.setAttribute('style', (body.getAttribute('style') || '') + ';margin:0;width:' + W + 'px;min-height:' + FH + 'px;box-sizing:border-box;background:#fff;overflow:hidden');
        var ser = new win.XMLSerializer().serializeToString(tmp.body);
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + FH + '"><foreignObject width="100%" height="100%">' + ser + '</foreignObject></svg>';
        return new Promise(function (res, rej) {
          var img = new win.Image();
          img.onload = function () {
            var go = function () {
              try {
                var out = [];
                for (var p = 0; p < pages; p++) {
                  var c = doc.createElement('canvas'); c.width = W * SC; c.height = H * SC;
                  var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
                  if (rects.length) { var k = SC * H / rects[p][1]; ctx.drawImage(img, 0, -rects[p][0] * k, W * k, FH * k); }   // 장 하나를 종이 한 쪽에(높이 차이는 0.5% 안팎)
                  else ctx.drawImage(img, 0, -p * H * SC, W * SC, FH * SC);
                  var du = c.toDataURL('image/jpeg', 0.92), cw = c.width, ch = c.height;
                  c.width = 0; c.height = 0;   // 캔버스 뒷판을 바로 놓는다(아이패드 메모리 — 작전판 2.559 와 같은 이유)
                  var bin = win.atob(du.split(',')[1]); du = null;
                  var u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
                  out.push({ data: u, w: cw, h: ch });
                }
                res(out);
              } catch (e) { rej(e); }
            };
            // 사파리는 SVG 그림 안의 글꼴을 onload 뒤에 늦게 입힌다 — 한 숨 쉬고 그린다
            var d = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
            d.then(function () { win.setTimeout(go, 60); });
          };
          img.onerror = function () { rej(new Error('raster fail')); };
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        });
      });
    }
    function frameDoc() { var f = ov && ov.querySelector('iframe'); return f && f.contentDocument; }
    function toast(m) {
      try { if (typeof win.toast === 'function') { win.toast(m); return; } } catch (_) {}
      var t = doc.getElementById('psPdfToast');
      if (!t) { t = doc.createElement('div'); t.id = 'psPdfToast'; doc.body.appendChild(t); }
      t.textContent = m; t.classList.add('on'); win.clearTimeout(t.__t); t.__t = win.setTimeout(function () { t.classList.remove('on'); }, 2600);
    }
    function busy(btn, on, txt) { if (!btn) return; btn.disabled = !!on; if (txt) btn.textContent = txt; }
    function blobOf() {
      var fd = frameDoc(); if (!fd || !fd.body) return Promise.reject(new Error('preview not ready'));
      return rasterize(fd, !!cfg.land).then(function (imgs) { return jpegPagesToPdf(imgs, !!cfg.land); });
    }
    // «다른 이름으로 저장» 창(크롬 · 엣지 데스크톱) — 누른 그 순간에만 열리니 PDF 를 만들기 전에 연다
    function pickTarget(name) {
      if (typeof win.showSaveFilePicker !== 'function') return Promise.resolve(null);
      return win.showSaveFilePicker({ suggestedName: name, types: [{ description: 'PDF 문서', accept: { 'application/pdf': ['.pdf'] } }] })
        .then(function (h) { return h; }, function (e) { return (e && e.name === 'AbortError') ? false : null; });
    }
    function save(btn) {
      var name = safeName(cfg.fname || cfg.title) + '.pdf';
      return pickTarget(name).then(function (target) {
        if (target === false) return;   // 취소
        busy(btn, true, '만드는 중…');
        return blobOf().then(function (blob) {
          if (target) return target.createWritable().then(function (w) { return w.write(blob).then(function () { return w.close(); }); }).then(function () { toast('PDF 저장됨 ✓ — ' + (target.name || name)); });
          var a = doc.createElement('a'); a.href = win.URL.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click(); a.remove();
          win.setTimeout(function () { try { win.URL.revokeObjectURL(a.href); } catch (_) {} }, 8000);
          toast('PDF 저장됨 ✓ — ' + name);
        });
      }).catch(function () {
        toast("이 브라우저에선 바로 저장이 안 돼요 — [인쇄]에서 'PDF로 저장'을 사용하세요");
      }).then(function () { busy(btn, false, 'PDF 내려받기'); });
    }
    function toNote(btn) {
      busy(btn, true, '노트 만드는 중…');
      return blobOf().then(function (blob) { return blob.arrayBuffer(); }).then(function (buffer) {
        var name = safeName(cfg.fname || cfg.title);
        win.parent.postMessage({ source: cfg.source || 'process', type: 'notePdfReady', requestId: 'px' + Date.now().toString(36), name: name, buffer: buffer, meta: { kind: cfg.noteKind || 'schedule-pdf', sourceName: name } }, win.location.origin && win.location.origin !== 'null' ? win.location.origin : '*', [buffer]);
        toast('개인 노트로 보내는 중…');
      }).catch(function () { toast('개인 노트용 PDF를 만들지 못했어요'); }).then(function () { busy(btn, false, '개인 노트로'); });
    }
    function print() { var f = ov && ov.querySelector('iframe'); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) { toast('브라우저의 인쇄 기능을 사용해 주세요'); } }
    function close() { if (!ov) return; ov.classList.remove('on'); var f = ov.querySelector('iframe'); if (f) f.removeAttribute('srcdoc'); doc.documentElement.classList.remove('ps-pdfx-open'); }
    // 종이 한 장을 화면에 맞춘다(줄이기만 — 폰은 폭에 맞추고 위아래로 넘겨 본다)
    function fit() {
      if (!ov || !ov.classList.contains('on')) return;
      var size = cfg.land ? A4.land : A4.port, W = size[0], H = size[1];
      var bd = ov.querySelector('.px-body'), avW = Math.max(120, bd.clientWidth - 28), avH = Math.max(120, bd.clientHeight - 28);
      var phone = win.innerWidth < 600, s = phone ? avW / W : Math.min(avW / W, avH / H, 1);
      var sz = ov.querySelector('.px-sizer'), f = ov.querySelector('iframe');
      sz.style.width = Math.round(W * s) + 'px'; sz.style.height = Math.round(H * s) + 'px';
      f.style.width = W + 'px'; f.style.height = H + 'px'; f.style.transform = 'scale(' + s + ')';
    }
    function build() {
      var st = doc.createElement('style'); st.id = 'ps-pdfx-css';
      st.textContent = [
        '#psPdfX{position:fixed;inset:0;z-index:100000;display:none;flex-direction:column;background:rgba(10,12,18,.8);font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}',
        '#psPdfX.on{display:flex}',
        '#psPdfX .px-bar{flex:0 0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 14px;padding-top:max(9px,env(safe-area-inset-top));background:var(--c-surface,#fff);border-bottom:1px solid var(--c-line,#E3E6EA);color:var(--c-ink,#14161A)}',
        '#psPdfX .px-t{font-size:14px;font-weight:700;letter-spacing:-.01em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '#psPdfX .px-sp{flex:1 1 auto}',
        '#psPdfX .px-opts{display:inline-flex;align-items:center;gap:12px;flex-wrap:wrap}',
        '#psPdfX .px-opt{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600}',
        '#psPdfX .px-ol{color:var(--c-muted,#646A73)}',
        '#psPdfX .px-seg{display:inline-flex;background:var(--c-surface-2,#F1F3F5);border:1px solid var(--c-line,#E3E6EA);border-radius:10px;padding:2px;gap:2px}',
        '#psPdfX .px-seg button{border:0;background:transparent;color:var(--c-muted,#646A73);font:inherit;font-size:12px;font-weight:600;padding:5px 11px;border-radius:7px;cursor:pointer}',
        '#psPdfX .px-seg button.on{background:var(--c-surface,#fff);color:var(--c-ink,#14161A);box-shadow:0 1px 2px rgba(16,24,40,.08)}',
        '#psPdfX .px-btn{height:34px;padding:0 14px;border-radius:var(--r-control,10px);border:1px solid var(--c-line,#E3E6EA);background:var(--c-surface,#fff);color:var(--c-ink,#14161A);font-weight:600;font-size:13px;line-height:1;font-family:inherit;cursor:pointer;white-space:nowrap}',
        '#psPdfX .px-btn:hover{background:var(--c-surface-2,#F1F3F5)}',
        '#psPdfX .px-btn.primary{background:var(--c-act,#14213D);border-color:var(--c-act,#14213D);color:#fff}',
        '#psPdfX .px-btn.primary:hover{filter:brightness(1.12)}',
        '#psPdfX .px-btn:disabled{opacity:.6;cursor:default}',
        '#psPdfX .px-body{flex:1 1 auto;min-height:0;overflow:auto;padding:14px;display:flex;align-items:flex-start;justify-content:center;-webkit-overflow-scrolling:touch}',
        '#psPdfX .px-sizer{flex:0 0 auto;position:relative;overflow:hidden;border-radius:8px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.4)}',
        '#psPdfX iframe{position:absolute;left:0;top:0;display:block;border:0;background:#fff;transform-origin:0 0}',
        'body.fmdark #psPdfX .px-btn.primary{background:#E8ECF4;border-color:#E8ECF4;color:#14161A}',
        '@media (max-width:600px){#psPdfX .px-bar{gap:6px;padding:8px 10px}#psPdfX .px-t{flex:1 0 100%}#psPdfX .px-opts{flex:1 0 100%}#psPdfX .px-sp{display:none}#psPdfX .px-btn{flex:1 1 0;padding:0 8px}}',
        'html.ps-pdfx-open,html.ps-pdfx-open body{overflow:hidden}',
        '#psPdfToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100001;background:#14161A;color:#fff;padding:10px 16px;border-radius:10px;font:600 13px/1.3 Pretendard,-apple-system,sans-serif;opacity:0;pointer-events:none;transition:opacity .2s}',
        '#psPdfToast.on{opacity:1}'
      ].join('\n');
      (doc.head || doc.documentElement).appendChild(st);
      ov = doc.createElement('div'); ov.id = 'psPdfX'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      ov.innerHTML = '<div class="px-bar"><b class="px-t"></b><span class="px-opts"></span><span class="px-sp"></span>'
        + '<button type="button" class="px-btn" data-px="note">개인 노트로</button>'
        + '<button type="button" class="px-btn primary" data-px="save">PDF 내려받기</button>'
        + '<button type="button" class="px-btn" data-px="print">인쇄</button>'
        + '<button type="button" class="px-btn" data-px="close">닫기</button></div>'
        + '<div class="px-body"><div class="px-sizer"><iframe title="PDF 미리보기"></iframe></div></div>';
      doc.body.appendChild(ov);
      ov.addEventListener('click', function (e) {
        var o = e.target && e.target.closest && e.target.closest('[data-pxo]');
        if (o) { var key = o.getAttribute('data-pxo'), val = o.getAttribute('data-v'); if (cfg.values[key] !== val) { cfg.values[key] = val; opts(); rebuild(key, val); } return; }
        var b = e.target && e.target.closest && e.target.closest('[data-px]'); if (!b || b.disabled) return;
        var k = b.getAttribute('data-px');
        if (k === 'close') close(); else if (k === 'print') print(); else if (k === 'save') save(b); else if (k === 'note') toNote(b);
      });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('on')) close(); });
      win.addEventListener('resize', fit);
      ov.querySelector('iframe').addEventListener('load', fit);
    }
    // 띠의 고르개(예: 일정 «디자인 — 포스터 · 잉크 절약»). 고르면 cfg.rebuild(값들) 로 종이를 다시 만든다
    function opts() {
      var host = ov.querySelector('.px-opts'), list = cfg.options || [];
      host.innerHTML = list.map(function (o) {
        return '<span class="px-opt"><span class="px-ol">' + o.label + '</span><span class="px-seg" role="group" aria-label="' + o.label + '">'
          + o.choices.map(function (c) { var on = cfg.values[o.key] === c[0]; return '<button type="button" data-pxo="' + o.key + '" data-v="' + c[0] + '" aria-pressed="' + on + '" class="' + (on ? 'on' : '') + '">' + c[1] + '</button>'; }).join('')
          + '</span></span>';
      }).join('');
    }
    function rebuild(key, val) {
      try { if (typeof cfg.onOption === 'function') cfg.onOption(key, val, cfg.values); } catch (_) {}
      if (typeof cfg.rebuild !== 'function') return;
      var html = ''; try { html = cfg.rebuild(cfg.values); } catch (_) { return; }
      if (html) { cfg.html = html; ov.querySelector('iframe').srcdoc = html; }
    }
    // cfg: {title, html, fname, land, source, noteKind, options:[{key,label,choices:[[값,이름]…]}], values:{key:값}, rebuild(values)→html, onOption(key,val,values)}
    function open(c) {
      cfg = c || {}; cfg.values = cfg.values || {};
      if (!ov) build();
      ov.querySelector('.px-t').textContent = cfg.title || 'PDF';
      opts();
      var inApp = false; try { inApp = win.parent && win.parent !== win; } catch (_) {}
      ov.querySelector('[data-px="note"]').style.display = (inApp && cfg.note !== false) ? '' : 'none';
      var f = ov.querySelector('iframe'); f.srcdoc = cfg.html || '';
      ov.classList.add('on'); doc.documentElement.classList.add('ps-pdfx-open'); fit();
    }
    return { open: open, close: close, blob: blobOf, rasterize: rasterize };
  }
  var api = { A4: A4, safeName: safeName, parseFaces: parseFaces, pick: pick, faceCss: faceCss, jpegPagesToPdf: jpegPagesToPdf, install: install };
  if (typeof window !== 'undefined' && window.document) {
    var inst = install(window);
    if (inst) { api.open = inst.open; api.close = inst.close; api.blob = inst.blob; }
  }
  return api;
});
