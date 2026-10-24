/* 3.154 — existing text controls, foreground text, and size-aware 3D emphasis.
   Editing is a draft until Done; rendering never changes the saved drawing. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', lastTap = null, lastTime = 0, tapTimer = 0;
  function opacity(v) { return v == null || !Number.isFinite(+v) ? 1 : Math.max(0, Math.min(1, +v)); }
  function node(d) {
    var front = document.getElementById('textFrontLayer');
    if (front) for (var g of front.children) if (g.__psD === d) return g;
    return drawLayer.children[state.drawings.indexOf(d)] || null;
  }
  function raise() {
    var front = document.getElementById('textFrontLayer');
    if (front && tokenLayer.parentNode) tokenLayer.parentNode.appendChild(front);
  }
  function arrange() {
    var front = document.getElementById('textFrontLayer');
    if (!front) { front = document.createElementNS(NS, 'g'); front.id = 'textFrontLayer'; }
    front.replaceChildren();
    Array.from(drawLayer.children).forEach(function (g, i) {
      var d = state.drawings[i];
      if (d && d.type === 'text' && d.front) {
        // Keep drawing indices stable for legacy drawing tools.
        drawLayer.replaceChild(document.createElementNS(NS, 'g'), g);
        front.appendChild(g);
      }
    });
    tokenLayer.parentNode.appendChild(front); _rotHandleOnTop();
  }
  function decorate(g, d) {
    g.__psD = d;
    if (d.type !== 'text' || !d.bg) return g;
    var rect = g.querySelector('rect'), b = _textBox(d), p = d.pts[0];
    if (rect) {
      var width = Math.max.apply(null, b.lines.map(function (l) { return _txMeasW(l, b.fs); })) + b.padX * 2;
      var x = d.align === 'left' ? p.x - b.boxW / 2 : d.align === 'right' ? p.x + b.boxW / 2 - width : p.x - width / 2;
      rect.setAttribute('x', x); rect.setAttribute('width', width);
      rect.setAttribute('fill-opacity', opacity(d.bgOp)); rect.classList.add('ps-text-bg');
    }
    return g;
  }
  function fitEditor(ed, d, fs, w, sc, bounds, barHeight) {
    var b = _textBox({text: ed.value, size: fs, w: w}), k = Math.min(1, fs * sc / 16);
    var maxW = Math.max(32, bounds.w - 16), maxH = Math.max(32, bounds.h - barHeight - 34);
    var width = Math.min(maxW, Math.max(b.boxW * sc, b.padX * sc * 2 + fs * sc));
    var wrap = Math.max(fs, (width - b.padX * sc * 2) / sc);
    var lines = _wrapText(ed.value, fs, Math.min(w || Infinity, wrap));
    var height = Math.min(maxH, (lines.length * b.lh + b.padY * 2) * sc);
    ed.rows = Math.max(1, lines.length);
    ed.style.transform = 'translate(-50%,-50%) scale(' + k + ')';
    ['min-width', 'min-height', 'max-height'].forEach(function (p) { ed.style.setProperty(p, p === 'max-height' ? 'none' : '0', 'important'); });
    ed.style.setProperty('font-size', fs * sc / k + 'px', 'important');
    ed.style.setProperty('padding', b.padY * sc / k + 'px ' + b.padX * sc / k + 'px', 'important');
    ed.style.width = (width + 4) / k + 'px'; ed.style.height = (height + 4) / k + 'px';
    return width < b.boxW * sc ? wrap : 0;
  }
  function opacityControl(bar, value, change) {
    var label = document.createElement('label'), input = document.createElement('input'), out = document.createElement('span'), title = document.createElement('span');
    label.className = 'ps-text-color-pick'; label.style.gridColumn = 'span 3';
    title.textContent = '배경 농도'; title.style.whiteSpace = out.style.whiteSpace = 'nowrap'; label.append(title, input, out);
    input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.05';
    input.setAttribute('aria-label', '텍스트 배경 불투명도'); input.style.width = '3em'; input.style.minWidth = '2em'; input.style.flex = '1'; input.style.minHeight = '2.75em';
    function sync(v, bg) { input.value = opacity(v); input.disabled = !bg; out.textContent = Math.round(opacity(v) * 100) + '%'; }
    input.addEventListener('input', function () { change(+input.value); });
    sync(value, true); bar.appendChild(label); return sync;
  }
  function highlight() {
    var depth = document.body.classList.contains('bc-tilt3d') && (!window.__animExport || window.__animExport3d);
    tokenLayer.querySelectorAll('.tok-hl').forEach(function (g) {
      var halo = g.querySelector('.tok-hl-halo'), ring = g.querySelector('.tok-hl-ring');
      if (!halo || !ring) return;
      var k = depth ? Math.max(1, Math.min(3.2, +g.getAttribute('data-depth-chip') || 1)) : 1;
      halo.setAttribute('r', (depth ? 48 : 40) * k);
      halo.setAttribute('fill', depth ? '#ffd24a' : 'url(#psHlGrad)');
      halo.setAttribute('fill-opacity', depth ? '.24' : '1');
      ring.setAttribute('r', (depth ? 31 : 27) * k);
      ring.setAttribute('stroke-width', (depth ? 4 : 2.6) * k);
    });
  }
  window.PSBoardText = {opacity: opacity, node: node, fitEditor: fitEditor, opacityControl: opacityControl,
    exportClone: function (clone) {
      clone.querySelectorAll('[data-text-editing]').forEach(function (g) { g.style.visibility = ''; g.removeAttribute('data-text-editing'); });
    },
    positionHandle: function (ed, hd, v) {
      var r = ed.getBoundingClientRect(), beside = r.right + 48 <= v.x + v.w;
      hd.style.left = Math.max(v.x + 4, Math.min(beside ? r.right + 4 : r.right - 44, v.x + v.w - 48)) + 'px';
      hd.style.top = Math.max(v.y + 4, Math.min(beside ? r.top + r.height / 2 - 22 : r.bottom + 4, v.bottom - 48)) + 'px';
    },
    lockedTap: function (d, e) {
      if (e.button !== 0) return false;
      e.preventDefault();
      var now = Date.now(), yes = lastTap === d && now - lastTime < 360;
      clearTimeout(tapTimer); lastTap = yes ? null : d; lastTime = now;
      if (yes) addText(d.pts[0], d);
      else tapTimer = setTimeout(function () {
        lastTap = null;
        if (state.drawings.includes(d) && state.tool === 'move' && !_bTxtEd) selectItem('drawing', d);
      }, 360);
      return true;
    }
  };
  document.addEventListener('DOMContentLoaded', function () {
    var style=document.createElement('style');style.textContent='body.bc-tilt3d svg#board{overflow:visible!important}';document.head.appendChild(style);
    var textDrag=false,coords=clientToUnit;
    function freeText(x,y){
      if(!document.body.classList.contains('bc-tilt3d')||!(state.tool==='text'||textDrag))return null;
      var p=bcUnproject(x,y);return p&&isFinite(p.x)&&isFinite(p.y)&&Math.abs(p.x)<W*3&&Math.abs(p.y)<H*3?p:null;
    }
    clientToUnit=function(x,y){return freeText(x,y)||coords.apply(this,arguments);};
    document.addEventListener('pointerdown',function(e){var g=e.target;while(g&&!g.__psD)g=g.parentNode;textDrag=!!(g&&g.__psD.type==='text'&&(!multiSel||multiSel.length<2));},true);
    ['pointerup','pointercancel'].forEach(function(t){document.addEventListener(t,function(){textDrag=false;});});
    document.getElementById('boardStage').addEventListener('pointerdown',function(e){
      if((e.target!==this&&e.target!==svg)||state.tool!=='text'||state.boardLocked||e.button!==0)return;
      if(typeof _inkPalm==='function'&&_inkPalm(e))return;
      var p=freeText(e.clientX,e.clientY);if(!p)return;e.preventDefault();e.stopPropagation();addText(p);
    });
    document.addEventListener('pointerdown', function (e) {
      if (!lastTap) return;
      var g = e.target; while (g && !g.__psD) g = g.parentNode;
      if (!g || g.__psD !== lastTap || e.button !== 0) { clearTimeout(tapTimer); lastTap = null; }
    }, true);
    var drawing = drawingEl, render = renderDrawings, onTop = _rotHandleOnTop, hl = _applyHl;
    drawingEl = function (d) { return decorate(drawing.apply(this, arguments), d); };
    renderDrawings = function () { var r = render.apply(this, arguments); arrange(); return r; };
    _rotHandleOnTop = function () { raise(); return onTop.apply(this, arguments); };
    _applyHl = function () { var r = hl.apply(this, arguments); highlight(); return r; };
  });
})();
