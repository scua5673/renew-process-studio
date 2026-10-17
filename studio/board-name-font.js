/* PROCESS STUDIO — 이름표 글꼴(3.086 · 사용자 «이름도 다양하게 쓸수 있게 하고 싶어 — 폰트를»).
   보드 설정 › 이름표 › 글꼴: 기본(Pretendard) · 굵게 · 둥글게 · 손글씨 · 명조. 보드마다 저장된다(겉모습 설정 nameFont — board.html 의 lookKeys 등).
   글꼴 파일은 vendor/name-fonts/<글꼴>/ 의 조각(unicode-range) — 화면에 나온 글자의 조각만 받는다(SIL OFL 1.1).
   내보내기(그림 · GIF · 영상)는 판을 SVG 그림으로 바꿔 그리므로 페이지의 글꼴을 못 쓴다 — 쓰인 글자의 조각을 data: 로 SVG 안에 넣는다(boardImageXML 감싸기).
   작전판(board.html)보다 먼저 읽힌다: 보드를 여는 길(restoreLiveBoard → lookApply)이 window.__nameFont 에 값을 넣는 순간 글꼴 파일을 건다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSNameFont = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var FONTS = {
    base: { label: '기본', family: '' },
    bold: { label: '굵게', family: 'PSN Black Han Sans', dir: 'black-han-sans' },
    round: { label: '둥글게', family: 'PSN Jua', dir: 'jua' },
    hand: { label: '손글씨', family: 'PSN Gaegu', dir: 'gaegu' },
    serif: { label: '명조', family: 'PSN Gowun Batang', dir: 'gowun-batang' }
  };
  var ORDER = ['base', 'bold', 'round', 'hand', 'serif'];
  var FALLBACK = "Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif";
  var BASE_URL = '/vendor/name-fonts/';
  function ok(v) { return typeof v === 'string' && Object.prototype.hasOwnProperty.call(FONTS, v); }
  // 이름 글자의 font-family — «기본»이면 빈 글자(작전판이 원래 값을 쓴다)
  function stack(v) { var f = ok(v) && FONTS[v].family; return f ? "'" + f + "'," + FALLBACK : ''; }
  // font.css → [{file, ur, ranges:[[lo,hi]…]}]
  function parseCss(css) {
    var out = [], re = /src:url\(([^)]+)\)[^;]*;unicode-range:([^}]+)\}/g, m;
    while ((m = re.exec(String(css || '')))) {
      var ur = m[2].trim(), ranges = ur.split(',').map(function (r) {
        var q = r.trim().replace(/^U\+/i, '').split('-'), lo = parseInt(q[0], 16), hi = q[1] ? parseInt(q[1], 16) : lo;
        return [lo, hi];
      }).filter(function (r) { return isFinite(r[0]) && isFinite(r[1]); });
      out.push({ file: m[1], ur: ur, ranges: ranges });
    }
    return out;
  }
  // 글자들이 드는 조각만(같은 조각은 한 번)
  function pick(faces, text) {
    var need = [], seen = {}, s = String(text || '');
    for (var i = 0; i < s.length; i++) {
      var cp = s.codePointAt(i); if (cp > 0xffff) i++;
      for (var j = 0; j < faces.length; j++) {
        var f = faces[j], hit = false;
        for (var k = 0; k < f.ranges.length && !hit; k++) hit = cp >= f.ranges[k][0] && cp <= f.ranges[k][1];
        if (hit) { if (!seen[f.file]) { seen[f.file] = 1; need.push(f); } break; }
      }
    }
    return need;
  }
  // 내보내기 SVG 안에 넣을 @font-face(받아 둔 조각만)
  function faceCss(family, faces, data) {
    return faces.filter(function (f) { return data[f.file]; }).map(function (f) {
      return "@font-face{font-family:'" + family + "';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64," + data[f.file] + ") format('woff2');unicode-range:" + f.ur + '}';
    }).join('');
  }
  function embed(xml, css) {
    if (!css) return xml;
    return String(xml).replace(/^(<svg[^>]*>)/, function (m) { return m + '<style>' + css + '</style>'; });
  }

  function install(win) {
    var doc = win.document; if (!doc || win.__psNameFontOn) return; win.__psNameFontOn = 1;
    var cur = 'base', cache = {};   // cache[dir] = {faces, data:{file:base64}, css:Promise}
    function fontCss(dir) {
      var c = cache[dir] || (cache[dir] = { faces: null, data: {}, wait: {} });
      if (!c.css) c.css = win.fetch(BASE_URL + dir + '/font.css').then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) { c.faces = parseCss(t); return c; }, function () { c.faces = []; return c; });
      return c.css;
    }
    function link(dir) {
      if (doc.getElementById('psNameFont-' + dir)) return;
      var l = doc.createElement('link'); l.rel = 'stylesheet'; l.id = 'psNameFont-' + dir; l.href = BASE_URL + dir + '/font.css';
      (doc.head || doc.documentElement).appendChild(l);
    }
    // 작전판이 lookApply · lookNow 에서 읽고 쓰는 값. 고르면 그 글꼴의 CSS 를 건다(글꼴 조각은 글자가 화면에 나올 때 브라우저가 받는다)
    try {
      Object.defineProperty(win, '__nameFont', { configurable: true, get: function () { return cur; }, set: function (v) {
        v = ok(v) ? v : 'base'; if (v === cur) return; cur = v; if (FONTS[v].dir) { link(FONTS[v].dir); warmSoon(); } sync();
      } });
      Object.defineProperty(win, '__nameFF', { configurable: true, get: function () { return stack(cur); } });
    } catch (_) {}

    // ── 보드 설정 줄: 이름표 모양 바로 아래. 단추 글자는 그 글꼴로(고르기 전에 보이게) ──
    function row() {
      if (doc.getElementById('nameFontSeg')) return;
      var st = doc.getElementById('nameStyleSeg'), after = st && st.closest('.menurow'); if (!after) return;
      var r = doc.createElement('div'); r.className = 'menurow';
      r.innerHTML = '<span class="menulbl">이름표 글꼴</span><div class="seg" id="nameFontSeg" role="group" aria-label="선수 이름표 글꼴">' + ORDER.map(function (k) {
        return '<button type="button" data-nf="' + k + '" aria-pressed="false">' + FONTS[k].label + '</button>';
      }).join('') + '</div>';
      // 단추 글자를 그 글꼴로 — 설정 창의 단추 규칙(!important)을 이기려면 인라인 important
      [].forEach.call(r.querySelectorAll('button[data-nf]'), function (b) { var f = stack(b.getAttribute('data-nf')); if (f) b.style.setProperty('font-family', f, 'important'); });
      after.parentNode.insertBefore(r, after.nextSibling);
      // 단추 미리보기 글꼴은 줄이 처음 보일 때 건다(보드를 열 때마다 받지 않게)
      var seen = false, show = function () { if (seen) return; seen = true; ORDER.forEach(function (k) { if (FONTS[k].dir) link(FONTS[k].dir); }); };
      try { if (win.IntersectionObserver) { var io = new win.IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { show(); io.disconnect(); } }); io.observe(r); } else show(); } catch (_) { show(); }
      sync();
    }
    function sync() {
      var seg = doc.getElementById('nameFontSeg'); if (!seg) return;
      [].forEach.call(seg.querySelectorAll('button[data-nf]'), function (b) { var on = b.getAttribute('data-nf') === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    win.__syncNameFontSeg = sync;
    win.__setNameFont = function (v) {
      if (!ok(v)) return;
      try { if (typeof win._lookFreeze === 'function') win._lookFreeze(); } catch (_) {}
      win.__nameFont = v;
      try { win.renderTokens(); } catch (_) {}
      sync();
      try { win.boardSaveLive(); } catch (_) {}
    };
    doc.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('#nameFontSeg button[data-nf]'); if (!b) return;
      e.stopPropagation(); win.__setNameFont(b.getAttribute('data-nf'));
    }, true);

    // ── 내보내기: 쓰인 이름 글자의 조각을 미리 받아 둔다(내보내기는 SVG 를 바로 그림으로 만든다 — 기다릴 틈이 없다) ──
    function names() {
      var out = '', add = function (sn) { ((sn && sn.players) || []).forEach(function (p) { if (p && p.name) out += p.name; }); };
      // state · anim 은 작전판의 let 전역 — window 속성이 아니라 이름으로 읽는다
      try { add(typeof state !== 'undefined' ? state : null); } catch (_) {}   /* global state */
      try { (typeof anim !== 'undefined' && anim && anim.frames || []).forEach(function (f) { add(f && f.snap); }); } catch (_) {}   /* global anim */
      try { if (win.__psPages && win.__psPages.eachOther) win.__psPages.eachOther(function (snap, frames) { add(snap); (frames || []).forEach(function (f) { add(f && f.snap); }); return 0; }); } catch (_) {}
      return out;
    }
    function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return win.btoa(s); }
    function warm() {
      var f = FONTS[cur]; if (!f.dir) return Promise.resolve();
      var dir = f.dir, text = names();
      return fontCss(dir).then(function (c) {
        return Promise.all(pick(c.faces || [], text).map(function (fc) {
          if (c.data[fc.file]) return null;
          if (!c.wait[fc.file]) c.wait[fc.file] = win.fetch(BASE_URL + dir + '/' + fc.file).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (buf) { if (buf) c.data[fc.file] = b64(buf); delete c.wait[fc.file]; }, function () { delete c.wait[fc.file]; });
          return c.wait[fc.file];
        }));
      });
    }
    var wt = 0;
    function warmSoon() { win.clearTimeout(wt); wt = win.setTimeout(function () { try { warm(); } catch (_) {} }, 400); }
    win.__nameFontWarm = warm;   // 시험 · 내보내기 시트가 기다릴 수 있게
    function exportCss(xml) {
      var f = FONTS[cur]; if (!f.dir) return '';
      var c = cache[f.dir]; if (!c || !c.faces) { warmSoon(); return ''; }
      var text = String(xml).replace(/<[^>]*>/g, ''), need = pick(c.faces, text);
      if (need.some(function (fc) { return !c.data[fc.file]; })) warmSoon();   // 다음 내보내기에는 들어간다
      return faceCss(f.family, need, c.data);
    }
    function wrap() {
      var bix = win.boardImageXML;
      if (typeof bix === 'function' && !bix.__psNameFont) {
        win.boardImageXML = function () {
          var o = bix.apply(this, arguments);
          try { if (o && o.xml && FONTS[cur].dir) o.xml = embed(o.xml, exportCss(o.xml)); } catch (_) {}
          return o;
        };
        win.boardImageXML.__psNameFont = 1;
      }
      var rt = win.renderTokens;   // 이름이 바뀌면(선수 불러오기 · 이름 고치기) 새 글자의 조각도
      if (typeof rt === 'function' && !rt.__psNameFont) {
        win.renderTokens = function () { var r = rt.apply(this, arguments); if (FONTS[cur].dir) warmSoon(); return r; };
        win.renderTokens.__psNameFont = 1;
      }
    }
    row();
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { row(); wrap(); }); else wrap();
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) install(window);
  return { FONTS: FONTS, ORDER: ORDER, ok: ok, stack: stack, parseCss: parseCss, pick: pick, faceCss: faceCss, embed: embed, install: install };
});
