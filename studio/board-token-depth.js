/* View-only token volume. Coordinates, document data and gesture targets stay unchanged. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSBoardDepth = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var sequence = 0;
  function node(doc, tag, attrs) {
    var n = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function elevation(rotation, height) {
    var a = (Number(rotation) || 0) * Math.PI / 180;
    return { x: -Math.sin(a) * height, y: -Math.cos(a) * height };
  }
  function flatten(token) {
    var face = token.querySelector('.ps-depth-face');
    if (!face) return;
    while (face.firstChild) token.insertBefore(face.firstChild, face);
    face.remove();
    token.querySelectorAll('.ps-depth-decoration').forEach(function (n) { n.remove(); });
    token.removeAttribute('data-depth');
  }
  function flattenAll(svg) {
    svg.querySelectorAll('.token[data-depth]').forEach(flatten);
  }
  function apply(token, item, kind) {
    if (!token || token.hasAttribute('data-depth')) return;
    var doc = token.ownerDocument, player = kind === 'player', ball = kind === 'ball' || item.team === 'ball';
    var height = player ? 13 : ball ? 9 : 7;
    var delta = elevation(item.rot, height), shape = player && token.querySelector('.tok-c');
    var face = node(doc, 'g', { 'class': 'ps-depth-face', transform: 'translate(' + delta.x + ',' + delta.y + ')' });
    while (token.firstChild) face.appendChild(token.firstChild);
    var body = node(doc, 'g', { 'class': 'ps-depth-decoration', 'pointer-events': 'none', 'aria-hidden': 'true' });
    body.appendChild(node(doc, 'ellipse', { cx: 3, cy: 4, rx: player ? 26 : 17, ry: player ? 18 : 11, fill: '#000', opacity: '.24' }));
    for (var z = 0; z <= height; z += 2) {
      var d = elevation(item.rot, z), side = shape ? shape.cloneNode(false) : node(doc, 'ellipse', { rx: ball ? 13 : 14, ry: ball ? 13 : 10 });
      side.removeAttribute('id'); side.removeAttribute('class');
      side.setAttribute('data-depth-level', String(z));
      side.setAttribute('fill', z < height / 2 ? '#17202d' : '#344254');
      side.setAttribute('stroke', '#16202c'); side.setAttribute('stroke-width', '1');
      side.setAttribute('transform', 'translate(' + d.x + ',' + d.y + ')');
      body.appendChild(side);
    }
    token.appendChild(body); token.appendChild(face);
    if (shape) {
      var id = 'psDepthLight' + (++sequence), defs = node(doc, 'defs', { 'class': 'ps-depth-decoration' });
      var gradient = node(doc, 'linearGradient', { id: id, x1: '0', y1: '0', x2: '1', y2: '1' });
      [['0', '#fff', '.48'], ['.45', '#fff', '.03'], ['1', '#000', '.25']].forEach(function (s) {
        gradient.appendChild(node(doc, 'stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] }));
      });
      defs.appendChild(gradient); face.insertBefore(defs, face.firstChild);
      var sheen = shape.cloneNode(false); sheen.removeAttribute('id');
      sheen.setAttribute('class', 'ps-depth-decoration'); sheen.setAttribute('fill', 'url(#' + id + ')');
      sheen.setAttribute('stroke', 'none'); sheen.setAttribute('pointer-events', 'none');
      // Keep the photo and label readable; light follows the underlying token body.
      face.insertBefore(sheen, shape.nextSibling);
    }
    token.setAttribute('data-depth', String(height));
  }
  function update(token, item) {
    if (!token || !token.hasAttribute('data-depth')) return;
    var d = elevation(item.rot, Number(token.getAttribute('data-depth')));
    token.querySelector('.ps-depth-face').setAttribute('transform', 'translate(' + d.x + ',' + d.y + ')');
    token.querySelectorAll('[data-depth-level]').forEach(function (side) {
      var offset = elevation(item.rot, Number(side.getAttribute('data-depth-level')));
      side.setAttribute('transform', 'translate(' + offset.x + ',' + offset.y + ')');
    });
  }
  return { update: update, apply: apply, flatten: flatten, flattenAll: flattenAll, elevation: elevation };
});
