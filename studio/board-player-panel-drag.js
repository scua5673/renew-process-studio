/* Player inspector: move its existing header without moving board data. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSPlayerPanelDrag = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var GAP = 8;
  function viewport(win) {
    var v = win.visualViewport;
    return { left: v ? v.offsetLeft : 0, top: v ? v.offsetTop : 0,
      width: v ? v.width : win.innerWidth, height: v ? v.height : win.innerHeight };
  }
  function clamp(p, r, v) {
    var l = v.left + GAP, t = v.top + GAP;
    return { left: Math.max(l, Math.min(p.left, v.left + v.width - r.width - GAP)),
      top: Math.max(t, Math.min(p.top, v.top + v.height - r.height - GAP)) };
  }
  function interactive(target, hd) {
    var el = target && target.closest && target.closest('button,input,select,textarea,a,[contenteditable="true"]');
    return !!(el && hd.contains(el));
  }
  function scale(el, r, cs, axis) {
    var size = parseFloat(cs[axis]);
    if (cs.boxSizing !== 'border-box') {
      (axis === 'height' ? ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'] : ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']).forEach(function (k) { size += parseFloat(cs[k]) || 0; });
    }
    return size > 0 ? r[axis] / size || 1 : 1;
  }
  function install(win) {
    if (win.__psPlayerPanelDrag) return win.__psPlayerPanelDrag;
    var doc = win.document, ctl = doc.querySelector('.sel-ctl'), hd = ctl && ctl.querySelector('.ps-in-hd');
    if (!hd || !win.__psInspector) return null;
    var point = null, capHeight = 0, gesture = null, raf = 0;
    var st = doc.createElement('style'); st.id = 'ps-player-panel-drag-css';
    st.textContent = '.ps-insp-on .ps-in-hd{touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}' +
      '.ps-insp-on .ps-in-hd.ps-panel-dragging{cursor:grabbing}' +
      '.ps-insp-on .ps-in-hd:focus-visible{outline:2px solid var(--in-accent,var(--c-act));outline-offset:3px;border-radius:var(--r-1)}' +
      '.ps-insp-on .ps-in-hd button{touch-action:manipulation;cursor:pointer}';
    doc.head.appendChild(st);
    hd.tabIndex = 0; hd.setAttribute('role', 'group');
    hd.setAttribute('aria-label', '선수 정보창 이동');
    hd.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight Home');
    hd.title = '끌어서 이동 · 방향키로 이동 · Home으로 원래 위치';
    function active() { return win.__psInspector.active() && doc.body.classList.contains('ps-insp-on'); }
    // Keep the original card height while moving it down. Its contents retain
    // their own scrolling; a smaller visual viewport can still shorten it.
    function height() {
      if (!point) return;
      var r = ctl.getBoundingClientRect(), h = Math.max(1, Math.min(capHeight, viewport(win).height - 2 * GAP)) / scale(ctl, r, win.getComputedStyle(ctl), 'height');
      var value = Math.round(h * 100) / 100 + 'px';
      if (ctl.style.getPropertyValue('--ps-insp-drag-height') !== value) ctl.style.setProperty('--ps-insp-drag-height', value);
    }
    function refresh() {
      if (!active()) { finish(); return; }
      height(); win.__psInspector.paint();
    }
    function soon() {
      if (raf || !point) return;
      raf = win.requestAnimationFrame(function () { raf = 0; refresh(); });
    }
    function position(el) {
      if (el !== ctl || !point) return null;
      point = clamp(point, ctl.getBoundingClientRect(), viewport(win));
      var r = ctl.getBoundingClientRect(), cs = win.getComputedStyle(ctl);
      return { left: point.left, top: point.top, scaleX: scale(ctl, r, cs, 'width'), scaleY: scale(ctl, r, cs, 'height') };
    }
    function remember() {
      if (point) return;
      var r = ctl.getBoundingClientRect();
      capHeight = r.height; point = { left: r.left, top: r.top };
    }
    function reset() {
      point = null; capHeight = 0; ctl.style.removeProperty('--ps-insp-drag-height');
      if (active()) win.__psInspector.paint();
    }
    function finish() {
      var old = gesture; gesture = null; hd.classList.remove('ps-panel-dragging');
      if (old) { try { if (hd.hasPointerCapture(old.id)) hd.releasePointerCapture(old.id); } catch (_) {} }
    }
    hd.addEventListener('pointerdown', function (e) {
      if (!active() || gesture || e.isPrimary === false || e.button !== 0 || interactive(e.target, hd)) return;
      var r = ctl.getBoundingClientRect();
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top,
        before: point && { left: point.left, top: point.top }, moved: false };
      e.preventDefault(); e.stopPropagation();
      try { hd.focus({ preventScroll: true }); hd.setPointerCapture(e.pointerId); } catch (_) {}
    });
    win.addEventListener('pointermove', function (e) {
      if (!gesture || gesture.id !== e.pointerId) return;
      if (!active()) { finish(); return; }
      var dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
      if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
      remember(); gesture.moved = true; hd.classList.add('ps-panel-dragging');
      point = { left: gesture.left + dx, top: gesture.top + dy };
      e.preventDefault(); e.stopPropagation(); soon();
    }, { capture: true, passive: false });
    function end(e) {
      if (!gesture || gesture.id !== e.pointerId) return;
      var moved = gesture.moved; finish();
      if (moved) { e.preventDefault(); e.stopPropagation(); refresh(); }
    }
    win.addEventListener('pointerup', end, true);
    win.addEventListener('pointercancel', end, true);
    hd.addEventListener('lostpointercapture', function (e) { if (gesture && gesture.id === e.pointerId) finish(); });
    win.addEventListener('blur', finish);
    hd.addEventListener('click', function (e) { if (!interactive(e.target, hd)) e.stopPropagation(); });
    hd.addEventListener('keydown', function (e) {
      if (e.target !== hd || !active() || e.ctrlKey || e.metaKey || e.altKey) return;
      var dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }, d = dirs[e.key];
      if (e.key === 'Escape' && gesture) {
        var before = gesture.before; finish(); point = before;
        if (!point) reset(); else refresh();
      } else if (e.key === 'Home') { finish(); reset(); }
      else if (d) { finish(); remember(); var n = e.shiftKey ? 32 : 8; point.left += d[0] * n; point.top += d[1] * n; refresh(); }
      else return;
      e.preventDefault(); e.stopPropagation();
    });
    win.addEventListener('resize', soon);
    if (win.visualViewport) { win.visualViewport.addEventListener('resize', soon); win.visualViewport.addEventListener('scroll', soon); }
    try { new win.ResizeObserver(soon).observe(ctl); } catch (_) {}
    try { new win.MutationObserver(function () { if (!active()) finish(); else soon(); }).observe(doc.body, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}
    var api = { position: position };
    win.__psPlayerPanelDrag = api;
    return api;
  }
  if (typeof window !== 'undefined' && window.document) {
    var n = 0; (function boot() { if (install(window)) return; if (++n < 80) window.setTimeout(boot, 250); })();
  }
  return { viewport: viewport, clamp: clamp, install: install };
});
