/* PROCESS STUDIO — 유니폼 토큰(3.120). 사용자 «토큰 유니폼도 이렇게»(FmStadio 배지) → «원형과 유니폼 전부» · «유니폼을 완전 디테일하게».
   «원형» · «유니폼» 모양의 선수 토큰 위에 유니폼 앞모습을 얹는다:
   목깃(뒷목 · 목 라벨 · 가는 선) · 래글런 소매선과 소매 줄 셋 · 소맷단(유니폼 모양) · 옆판과 선 · 무늬 사이 가는 선 · 가슴 엠블럼 · 로고 · 밑단 박음질 · 주름 · 가장자리 그늘.
   색은 팀 유니폼 설정 그대로(주색 · 보조색 · 무늬 · 테두리 — GK 는 GK 설정, 토큰 하나만 고른 색이면 그 색).
   모양은 원(r 21) · 셔츠(SHIRT_D) 안에 맞춰 미리 계산한 선이다 — 잘라내기(clip) · 그라디언트가 없어 끌기 중 사파리가 칩마다 다시 그려도 가볍다.
   · makeToken 을 감싸 그린 뒤 얹는다. 3D 칩은 PSBoardDepth.apply 앞에서 얹고, board-token-depth 가 칩 윗면에 같은 무늬(.ps-jersey)를 복사한다.
   · 입체 칩의 광택(_setChip3d 의 .ps-c3 원)은 무늬 위로 옮긴다. 코치 · 사진 · 쉐이퍼 토큰은 그대로.
   · 값은 setAttribute 로만 넣는다(커뮤니티 · 공유 보드의 색 글자가 HTML 이 되지 않게). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSJersey = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var SHIRT_D = 'M -8 -20 C -10.5 -20 -13.8 -19.3 -16.5 -18.2 L -23 -14.3 L -19.3 -4.6 L -14.6 -7.2 L -14.6 16.5 Q -14.6 20.5 -10.6 20.5 L 10.6 20.5 Q 14.6 20.5 14.6 16.5 L 14.6 -7.2 L 19.3 -4.6 L 23 -14.3 L 16.5 -18.2 C 13.8 -19.3 10.5 -20 8 -20 Q 0 -12.6 -8 -20 Z';
  // 좌표: c = 원, s = 셔츠. 왼쪽 · 오른쪽을 한 path 에(노드 수를 줄인다). 만든 방법은 시험 tests/board-jersey-3120 의 설명.
  var GEO = {
    c: { sleeve: 'M-9.4 -18.78C-13.4 -15.6 -15.6 -9.6 -15.8 -.6L-20.7 3.54A21 21 0 0 1 -9.4 -18.78ZM9.4 -18.78C13.4 -15.6 15.6 -9.6 15.8 -.6L20.7 3.54A21 21 0 0 0 9.4 -18.78Z', stripes: 'M-14.95 -13.65C-16.42 -10.2 -17.23 -5.83 -17.35 -.63M-17.58 -10.03C-18.28 -7.25 -18.67 -4.1 -18.75 -.67M-20.06 -2.71C-20.11 -2.05 -20.13 -1.38 -20.15 -.7M14.95 -13.65C16.42 -10.2 17.23 -5.83 17.35 -.63M17.58 -10.03C18.28 -7.25 18.67 -4.1 18.75 -.67M20.06 -2.71C20.11 -2.05 20.13 -1.38 20.15 -.7', seam: 'M-9.4 -18.78C-13.4 -15.6 -15.6 -9.6 -15.8 -.6M-15.8 -.6L-20.03 2.97M9.4 -18.78C13.4 -15.6 15.6 -9.6 15.8 -.6M15.8 -.6L20.03 2.97', panel: 'M-15.8 -.6C-15.25 3.94 -14.89 8.67 -14.91 14.76A21 21 0 0 1 -20.7 3.54L-15.8 -.6ZM15.8 -.6C15.25 3.94 14.89 8.67 14.91 14.76A21 21 0 0 0 20.7 3.54L15.8 -.6Z', piping: 'M-15.8 -.6C-15.28 3.66 -14.93 8.1 -14.91 13.66M15.8 -.6C15.28 3.66 14.93 8.1 14.91 13.66', wrinkle: 'M-12.2 6Q-10.4 9.6-11.4 13.4M12.2 6Q10.4 9.6 11.4 13.4', shade1: 'M0 -21A21 21 0 0 0 0 21A16.6 21 0 0 1 0 -21ZM0 -21A21 21 0 0 1 0 21A16.6 21 0 0 0 0 -21Z', shade2: 'M0 -21A21 21 0 0 0 0 21A19 21 0 0 1 0 -21ZM0 -21A21 21 0 0 1 0 21A19 21 0 0 0 0 -21Z', collar: 'M-9.6 -18.68Q0 -7.92 9.6 -18.68A21 21 0 0 0 -9.6 -18.68Z', neck: 'M-7.2 -19.73Q0 -14.27 7.2 -19.73A21 21 0 0 0 -7.2 -19.73Z', cpipe: 'M-7.78 -18.67C-2.59 -13.99 2.59 -13.99 7.78 -18.67', tag: 'M-1.3 -19.6h2.6v1.2h-2.6Z', crest: 'M6 -11.2H9.2V-9.3Q9.2 -7.6 7.6 -6.8Q6 -7.6 6 -9.3Z', crestIn: 'M7.6 -10.7V-7.5', brand: 'M-9.4 -9Q-8.1 -7.5-6 -10.2' },
    s: { sleeve: 'M-8.9 -19.97C-11.26 -19.83 -14.11 -19.17 -16.5 -18.2L-23 -14.3L-19.3 -4.6L-14.6 -7.2C-13.4 -11.6 -11.4 -16.6 -8.9 -19.97ZM8.9 -19.97C11.26 -19.83 14.11 -19.17 16.5 -18.2L23 -14.3L19.3 -4.6L14.6 -7.2C13.4 -11.6 11.4 -16.6 8.9 -19.97Z', stripes: 'M-11.43 -18.58C-13.33 -15.33 -14.87 -11.29 -15.86 -7.71M-13.06 -18.22C-14.8 -15 -16.2 -11.2 -17.11 -7.88M-14.72 -17.73C-16.26 -14.65 -17.5 -11.21 -18.31 -8.21M11.43 -18.58C13.33 -15.33 14.87 -11.29 15.86 -7.71M13.06 -18.22C14.8 -15 16.2 -11.2 17.11 -7.88M14.72 -17.73C16.26 -14.65 17.5 -11.21 18.31 -8.21', seam: 'M-8.9 -19.97C-11.4 -16.6 -13.4 -11.6 -14.6 -7.2M8.9 -19.97C11.4 -16.6 13.4 -11.6 14.6 -7.2', cuff: 'M-23 -14.3L-21.35 -15.29L-17.62 -5.53L-19.3 -4.6ZM23 -14.3L21.35 -15.29L17.62 -5.53L19.3 -4.6Z', cuffIn: 'M-21.8 -13.96L-18.74 -5.95M21.8 -13.96L18.74 -5.95', sshade: 'M-19.3 -4.6L-14.6 -7.2L-15.7 -10.6L-21.18 -9.6ZM19.3 -4.6L14.6 -7.2L15.7 -10.6L21.18 -9.6Z', panel: 'M-14.6 -7.2C-12.7 -2 -12.1 8 -11.7 20.5L-10.6 20.5Q-14.6 20.5 -14.6 16.5ZM14.6 -7.2C12.7 -2 12.1 8 11.7 20.5L10.6 20.5Q14.6 20.5 14.6 16.5Z', piping: 'M-13.6 -3.48C-12.51 1.93 -12.05 9.9 -11.74 19.38M13.6 -3.48C12.51 1.93 12.05 9.9 11.74 19.38', wrinkle: 'M-10.4 6Q-8.8 9.4-9.8 13M10.4 6Q8.8 9.4 9.8 13', back: 'M-8 -20Q0 -12.6 8 -20Q0 -22.4-8 -20Z', tag: 'M-1.2 -20.6h2.4v1.1h-2.4Z', collar: 'M-8 -20Q0 -12.6 8 -20L9.5 -19.4Q0 -9.4-9.5 -19.4Z', cpipe: 'M-8.75 -19.7Q0 -11 8.75 -19.7', hem: 'M-12.97 18.7L12.97 18.7', crest: 'M4.9 -12H7.9V-10.2Q7.9 -8.6 6.4 -7.9Q4.9 -8.6 4.9 -10.2Z', crestIn: 'M6.4 -11.5V-8.5', brand: 'M-8 -10.5Q-6.8 -9.1-4.8 -11.6' }
  };
  var PINS = {
    c: { v: 'M-12.6 -15.83L-12.6 15.83M-4.2 -19.8L-4.2 19.8M4.2 -19.8L4.2 19.8M12.6 -15.83L12.6 15.83', thinv: 'M-15.96 -12.46L-15.96 12.46M-11.76 -16.46L-11.76 16.46M-2.1 -20.13L-2.1 20.13M2.1 -20.13L2.1 20.13M11.76 -16.46L11.76 16.46M15.96 -12.46L15.96 12.46', h: 'M-15.83 -12.6L15.83 -12.6M-19.8 -4.2L19.8 -4.2M-19.8 4.2L19.8 4.2M-15.83 12.6L15.83 12.6', hoop: 'M-19.36 -5.88L19.36 -5.88M-19.36 5.88L19.36 5.88', band: 'M-5.88 -19.36L-5.88 19.36M5.88 -19.36L5.88 19.36', half: 'M0 -20.24L0 20.24', quarters: 'M0 -20.24L0 20.24M-20.24 0L20.24 0', sash: 'M7.17 -18.93L-18.93 7.17M18.93 -7.17L-7.17 18.93', diag: 'M-5.81 -19.39L-19.39 -5.81M9.46 -17.86L-17.86 9.46M17.86 -9.46L-9.46 17.86M19.39 5.81L5.81 19.39' },
    s: { v: 'M-13.8 -18.06L-13.8 -7.81M-4.6 -16.39L-4.6 19.48M4.6 -16.39L4.6 19.48M13.8 -18.06L13.8 -7.81', thinv: 'M-17.48 -16.43L-17.48 -6.75M-12.88 -18.31L-12.88 18.77M-2.3 -15.54L-2.3 19.48M2.3 -15.54L2.3 19.48M12.88 -18.31L12.88 18.77M17.48 -16.43L17.48 -6.75', h: 'M-21 -11.9L21 -11.9M-13.59 -3.8L13.59 -3.8M-13.59 4.3L13.59 4.3M-13.59 12.4L13.59 12.4', hoop: 'M-13.59 -5.42L13.59 -5.42M-13.59 5.92L13.59 5.92', band: 'M-6.44 -17.46L-6.44 19.48M6.44 -17.46L6.44 19.48', half: 'M0 -15.29L0 19.48', quarters: 'M0 -15.29L0 19.48M-13.59 .25L13.59 .25', sash: 'M8.93 -18.95L-13.58 .87M13.58 -.37L-8.96 19.48', diag: 'M-7.02 -17.87L-19.19 -7.15M12.08 -18.49L-13.58 4.1M13.58 -3.6L-12.3 19.18M13.59 12.58L5.75 19.49' }
  };
  var PATS = ['solid', 'v', 'thinv', 'h', 'half', 'quarters', 'band', 'hoop', 'sash', 'diag'];

  function hex(v) {
    if (typeof v !== 'string') return '';
    var s = v.trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    return /^#[0-9a-f]{6}$/.test(s) ? s : '';
  }
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function lum(h) { h = hex(h); if (!h) return .5; var c = rgb(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function mix(h, to, k) {   // k 만큼 to(0 = 검정 · 255 = 흰색) 쪽으로
    h = hex(h); if (!h) return ''; var c = rgb(h);
    return '#' + c.map(function (v) { var x = Math.round(v + (to - v) * k); return ('0' + Math.max(0, Math.min(255, x)).toString(16)).slice(-2); }).join('');
  }
  function dark(h, k) { return mix(h, 0, k); }
  function light(h, k) { return mix(h, 255, k); }
  // 무늬 · 색 → 그리는 색들. main 은 소매 · 뒷목 · 옆판의 바탕, trim 은 목깃 · 소매 줄 · 소맷단 · 엠블럼.
  function palette(o) {
    o = o || {};
    var main = hex(o.main) || '#3a6df0', acc = hex(o.acc), pat = PATS.indexOf(o.pat) >= 0 ? o.pat : 'solid', L = lum(main);
    var trim = acc && Math.abs(lum(acc) - L) >= .14 ? acc : (L > .55 ? dark(main, .42) : light(main, L < .08 ? .78 : .62));
    var Lt = lum(trim);
    return {
      main: main, trim: trim, pat: pat,
      neck: L < .08 ? light(main, .2) : dark(main, .38),
      panel: L < .1 ? light(main, .1) : dark(main, .16),
      seam: L > .6 ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.34)',
      stitch: L > .6 ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.45)',
      cpipe: Lt > .5 ? 'rgba(0,0,0,.24)' : 'rgba(255,255,255,.38)',
      crestLine: Lt > .5 ? dark(trim, .45) : light(trim, .5),
      pin: (L > .72 && (!acc || lum(acc) > .72)) ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.72)',
      stroke: typeof o.stroke === 'string' && o.stroke ? o.stroke : (L > .62 ? '#2a3140' : '#ffffff')
    };
  }
  function P(d, a) { a.d = d; return ['path', a]; }
  function line(d, color, w, extra) { var a = { d: d, fill: 'none', stroke: color, 'stroke-width': String(w) }; for (var k in extra || {}) a[k] = extra[k]; return ['path', a]; }
  // 모양('circle' | 'shirt') · 색 → 그릴 요소 목록 [태그, 속성]. 순서 = 그리는 순서(아래 → 위).
  function spec(shape, o) {
    var k = palette(o), sh = shape === 'shirt', G = sh ? GEO.s : GEO.c, pins = (sh ? PINS.s : PINS.c)[k.pat] || '', out = [];
    var round = { 'stroke-linecap': 'round' };
    if (sh) { out.push(P(G.back, { fill: k.neck, stroke: k.stroke, 'stroke-width': '1.1', 'stroke-linejoin': 'round' })); out.push(P(G.tag, { fill: 'rgba(255,255,255,.55)' })); }
    if (pins) out.push(line(pins, k.pin, .55));
    out.push(P(G.panel, { fill: k.panel }));
    out.push(line(G.piping, k.trim, .7, { 'stroke-opacity': '.9' }));
    out.push(line(G.wrinkle, 'rgba(0,0,0,.16)', .55, round));
    out.push(P(G.sleeve, { fill: k.main }));
    if (sh) out.push(P(G.sshade, { fill: '#000', 'fill-opacity': '.1' }));
    out.push(line(G.stripes, k.trim, .95));
    if (sh) { out.push(P(G.cuff, { fill: k.trim })); out.push(line(G.cuffIn, k.main, .45)); }
    out.push(line(G.seam, k.seam, .75));
    out.push(P(G.collar, { fill: k.trim, stroke: k.seam, 'stroke-width': '.5', 'stroke-linejoin': 'round' }));
    out.push(line(G.cpipe, k.cpipe, .45));
    if (!sh) { out.push(P(G.neck, { fill: k.neck })); out.push(P(G.tag, { fill: 'rgba(255,255,255,.55)' })); }
    if (sh) out.push(line(G.hem, k.stitch, .5, { 'stroke-dasharray': '1 .8' }));
    else { out.push(P(G.shade2, { fill: '#000', 'fill-opacity': '.08' })); out.push(P(G.shade1, { fill: '#000', 'fill-opacity': '.08' })); }
    out.push(P(G.crest, { fill: k.trim, stroke: k.crestLine, 'stroke-width': '.45', 'stroke-linejoin': 'round' }));
    out.push(line(G.crestIn, k.main, .55));
    if (k.pat !== 'solid') out.push(line(G.brand, lum(k.trim) > .5 ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.6)', 1.4, round));   // 줄무늬 위에서도 보이게
    out.push(line(G.brand, k.trim, .75, round));
    if (sh) out.push(P(SHIRT_D, { fill: 'none', stroke: k.stroke, 'stroke-width': '2.2', 'stroke-linejoin': 'round' }));
    else out.push(['circle', { r: '21', fill: 'none', stroke: k.stroke, 'stroke-width': '2.6' }]);
    return out;
  }
  // 시안 · 시험용 SVG 글(값은 이 모듈이 만든 색 · 좌표뿐)
  function svgText(shape, o) {
    return spec(shape, o).map(function (n) { return '<' + n[0] + Object.keys(n[1]).map(function (a) { return ' ' + a + '="' + String(n[1][a]).replace(/[&<>"]/g, '') + '"'; }).join('') + '/>'; }).join('');
  }

  function isGk(p) { return !!p && !p.coach && (String(p.num) === '1' || p.pos === 'GK'); }
  function call(win, name, arg) { try { var f = win[name]; return typeof f === 'function' ? f(arg) : ''; } catch (_) { return ''; } }
  // 토큰 하나의 유니폼 값(작전판 makeToken 과 같은 규칙)
  function kitFor(win, p, tok) {
    var team = p.team, o = { stroke: tok && tok.getAttribute('stroke') };
    if (hex(p.color)) { o.main = p.color; o.acc = lum(p.color) > .6 ? '#1a1a1a' : '#ffffff'; o.pat = 'solid'; return o; }
    if (isGk(p)) { o.main = call(win, 'gkColFor', team); o.acc = call(win, 'gkAccent', team); o.pat = call(win, 'gkPat', team); }
    else { o.main = call(win, 'teamMain', team); o.acc = call(win, 'teamAccent', team); o.pat = call(win, 'teamPat', team); }
    if (!hex(o.main)) { var f = tok && tok.getAttribute('fill'); if (hex(f)) o.main = f; }
    return o;
  }
  function shaperLook() { try { return typeof tokShape !== 'undefined' && tokShape === 'shaper'; } catch (_) { return false; } }   /* global tokShape */
  // 그려진 토큰(g)에 유니폼을 얹는다. 이미 있으면 그대로.
  function decorate(win, g, p) {
    if (!g || !p || p.coach || p.img || p.shaper || g.querySelector('.ps-jersey')) return false;
    var tok = g.querySelector('.tok-c'); if (!tok) return false;
    var tag = String(tok.tagName).toLowerCase(), shape = tag === 'circle' ? 'circle' : (tag === 'path' ? 'shirt' : '');
    if (!shape || (shape === 'circle' && shaperLook())) return false;
    var doc = g.ownerDocument, grp = doc.createElementNS(NS, 'g');
    grp.setAttribute('class', 'ps-jersey'); grp.setAttribute('pointer-events', 'none');
    spec(shape, kitFor(win, p, tok)).forEach(function (n) {
      var e = doc.createElementNS(NS, n[0]); for (var a in n[1]) e.setAttribute(a, n[1][a]); grp.appendChild(e);
    });
    var next = tok.nextSibling;
    // 유니폼 모양의 옛 목깃 · 소매 선(SHIRT_ACC)은 새 그림이 대신한다
    if (shape === 'shirt' && next && next.nodeType === 1 && String(next.tagName).toLowerCase() === 'path' && !next.getAttribute('class') && next.getAttribute('fill') === 'none') { var old = next; next = next.nextSibling; old.parentNode.removeChild(old); }
    g.insertBefore(grp, next);
    if (shape === 'circle') {   // 번호를 가슴 가운데로 조금 내린다(목깃 자리)
      for (var c = g.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && String(c.tagName).toLowerCase() === 'text') { if (c.getAttribute('y') === '0') c.setAttribute('y', '1'); break; }
    }
    return true;
  }
  // 입체 칩 광택(.ps-c3 원)을 유니폼 위로
  function liftGloss(root) {
    if (!root || !root.querySelectorAll) return;
    var js = root.querySelectorAll('.ps-jersey');
    for (var i = 0; i < js.length; i++) {
      var g = js[i].parentNode, gl = null;
      for (var c = g.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && String(c.tagName).toLowerCase() === 'circle' && /(^|\s)ps-c3(\s|$)/.test(c.getAttribute('class') || '')) { gl = c; break; }
      if (gl && js[i].nextSibling !== gl) g.insertBefore(gl, js[i].nextSibling);
    }
  }

  function install(win) {
    if (!win || win.__psJersey) return false;
    var mk = win.makeToken; if (typeof mk !== 'function') return false;
    win.__psJersey = true;
    win.makeToken = function (p, kind) {
      var g = mk.apply(this, arguments);
      if (kind === 'player') { try { decorate(win, g, p); } catch (_) {} }
      return g;
    };
    var D = win.PSBoardDepth;
    if (D && typeof D.apply === 'function') {
      var ap = D.apply;
      D.apply = function (token, item, kind) { if (kind === 'player') { try { decorate(win, token, item); } catch (_) {} } return ap.apply(this, arguments); };
    }
    var sc = win._setChip3d;
    if (typeof sc === 'function') win._setChip3d = function () { var r = sc.apply(this, arguments); try { liftGloss(typeof tokenLayer !== 'undefined' ? tokenLayer : null); } catch (_) {} return r; };   /* global tokenLayer */
    // 부팅 때 이미 그린 토큰에도 얹는다 — renderTokens 를 부르지 않는다: 끝에서 boardSaveLive 를 불러 «고친 판»이 되고,
    // 저장본을 받아오는 중(restoreLiveBoard 의 GET)이면 그 불러오기가 멈춘다(새로고침 뒤 페이지가 1장으로 — board-look-per-work).
    try {
      var layer = typeof tokenLayer !== 'undefined' ? tokenLayer : null, list = typeof state !== 'undefined' && state && state.players;   /* global state */
      if (layer && Array.isArray(list)) list.forEach(function (p) {
        var g = p && layer.querySelector('[data-id="' + String(p.id).replace(/["\\]/g, '') + '"]');
        if (g && !g.hasAttribute('data-depth-chip')) { try { decorate(win, g, p); } catch (_) {} }
      });
      liftGloss(layer);
    } catch (_) {}
    return true;
  }
  function boot(win) {
    if (!win || !win.document) return;
    var go = function () { try { install(win); } catch (_) {} };
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', go); else go();
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) boot(window);
  return { GEO: GEO, PINS: PINS, SHIRT_D: SHIRT_D, palette: palette, spec: spec, svgText: svgText, decorate: decorate, liftGloss: liftGloss, install: install, kitFor: kitFor, hex: hex, lum: lum };
});
