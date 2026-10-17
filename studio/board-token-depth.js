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
  // Small SVG meshes: ground coordinates plus real per-vertex height. They are
  // built once per render/rotation; dragging only changes the parent transform.
  var equipmentTypes = ['cone','marker','dome','goal','goalH','goalV','minigoal','minigoalV','dummy','pole','ladder','hurdle','minihurdle','flag','tire'];
  function equipmentMesh(doc, item) {
    var type=item.team, angle=Number(item.rot)||0, vertical=/goalV$/.test(type), pieces=[];
    var mesh=node(doc,'g',{'class':'ps-equipment-mesh','data-equipment':type});
    function vertex(x,y,z){return vertical?[-y,x,z]:[x,y,z];}
    function projected(v){var d=elevation(angle,v[2]);return [v[0]+d.x,v[1]+d.y];}
    function depth(v){var a=angle*Math.PI/180;return v[0]*Math.sin(a)+v[1]*Math.cos(a)+v[2]*.65;}
    function add(points, color, shade, width, opacity){
      var vs=points.map(function(p){return vertex(p[0],p[1],p[2]);});
      pieces.push({vs:vs,color:color||'currentColor',shade:shade||0,width:width||0,opacity:opacity==null?1:opacity,order:vs.reduce(function(n,v){return n+depth(v);},0)/vs.length});
    }
    function box(x,y,z,w,d,h,color){
      var a=[x,y,z],b=[x+w,y,z],c=[x+w,y+d,z],e=[x,y+d,z],A=[x,y,z+h],B=[x+w,y,z+h],C=[x+w,y+d,z+h],E=[x,y+d,z+h];
      add([a,b,B,A],color,-.18);add([b,c,C,B],color,-.32);add([c,e,E,C],color,-.10);add([e,a,A,E],color,.12);add([A,B,C,E],color,.24);
    }
    function ring(outer,inner,z,h,color){
      for(var i=0;i<16;i++){
        var a=i*Math.PI/8,b=(i+1)*Math.PI/8;
        function p(r,t,k){return [r*Math.cos(t),r*Math.sin(t),k];}
        add([p(outer,a,z),p(outer,b,z),p(outer,b,z+h),p(outer,a,z+h)],color,-.2+.12*Math.cos(a));
        add([p(inner,a,z),p(inner,b,z),p(inner,b,z+h),p(inner,a,z+h)],color,-.4);
        add([p(outer,a,z+h),p(outer,b,z+h),p(inner,b,z+h),p(inner,a,z+h)],color,.2);
      }
    }
    function taper(r0,r1,z,h,color){
      for(var i=0;i<12;i++){
        var a=i*Math.PI/6,b=(i+1)*Math.PI/6;
        add([[r0*Math.cos(a),r0*Math.sin(a),z],[r0*Math.cos(b),r0*Math.sin(b),z],[r1*Math.cos(b),r1*Math.sin(b),z+h],[r1*Math.cos(a),r1*Math.sin(a),z+h]],color,Math.cos(a+1)*.24);
      }
    }
    function tube(a,b,w,color,opacity){add([a,b],color,0,w,opacity);}
    if(type==='cone'){
      box(-12,-10,0,24,20,2);taper(10,6,2,12);taper(6,4.7,14,4,'#f6f7fa');taper(4.7,.7,18,12);
    }else if(type==='marker'){
      ring(15,5,0,3);ring(7,5,3,1);
    }else if(type==='dome'){
      taper(14,12,0,5);taper(12,8,5,5);taper(8,.2,10,4);
    }else if(type==='tire'){
      ring(14,7,0,6,item.color||'#30343c');
    }else if(/^goal|^minigoal/.test(type)){
      var mini=/^mini/.test(type),w=mini?14:23,h=mini?17:29,d=mini?12:19;
      // Net spans the rear, roof and both sides; the front remains open.
      for(var x=-w;x<=w+.1;x+=w/5){tube([x,-d,0],[x,-d,h*.75],.65,'currentColor',.45);tube([x,-d,h*.75],[x,0,h],.65,'currentColor',.45);}
      for(var z=0;z<=h*.75+.1;z+=h/5){tube([-w,-d,z],[w,-d,z],.65,'currentColor',.45);tube([-w,-d,z],[-w,0,z/ .75],.65,'currentColor',.4);tube([w,-d,z],[w,0,z/.75],.65,'currentColor',.4);}
      tube([-w,-d,0],[w,-d,0],2);tube([-w,-d,0],[-w,0,0],2);tube([w,-d,0],[w,0,0],2);
      tube([-w,-d,0],[-w,-d,h*.75],2);tube([w,-d,0],[w,-d,h*.75],2);
      tube([-w,-d,h*.75],[-w,0,h],2);tube([w,-d,h*.75],[w,0,h],2);
      tube([-w,0,0],[-w,0,h],3);tube([w,0,0],[w,0,h],3);tube([-w,0,h],[w,0,h],3);
    }else if(type==='ladder'){
      box(-10,-20,0,2,40,2);box(8,-20,0,2,40,2);
      for(var y=-18;y<=18;y+=9)box(-8,y,0,16,2,2.5);
    }else if(type==='hurdle'||type==='minihurdle'){
      var h=type==='hurdle'?28:13;
      box(-15,-8,0,5,17,2,'#363e49');box(10,-8,0,5,17,2,'#363e49');
      tube([-12,0,2],[-12,0,h],3);tube([12,0,2],[12,0,h],3);box(-15,-2,h-2,30,4,4);
    }else if(type==='pole'||type==='flag'){
      taper(6,6,0,2,'#38404b');tube([0,0,2],[0,0,39],3,type==='flag'?'#d8dee7':'currentColor');
      if(type==='flag'){add([[0,0,38],[17,2,33],[0,0,25]],'currentColor',.12);}
      else {tube([0,0,12],[0,0,17],3.2,'#37404c');tube([0,0,26],[0,0,31],3.2,'#37404c');}
    }else if(type==='dummy'){
      box(-11,-6,0,22,12,3,'#343b47');tube([-5,0,3],[-5,0,14],2);tube([5,0,3],[5,0,14],2);
      box(-9,-2,13,18,4,18);box(-4,-2,31,8,4,8);
      for(var x=-6;x<=6;x+=4)tube([x,-2.2,16],[x,-2.2,28],.7,'#303845',.4);
    }
    mesh.appendChild(node(doc,'ellipse',{cx:3,cy:5,rx:/goal/.test(type)?25:16,ry:/goal/.test(type)?16:10,fill:'#000',opacity:'.2','pointer-events':'none'}));
    pieces.sort(function(a,b){return a.order-b.order;}).forEach(function(p){
      var coords=p.vs.map(function(v){return projected(v).join(',');}).join(' ');
      if(p.width){
        mesh.appendChild(node(doc,'polyline',{points:coords,fill:'none',stroke:'#263241','stroke-width':p.width+1,'stroke-opacity':p.opacity*.6,'stroke-linecap':'round'}));
        mesh.appendChild(node(doc,'polyline',{points:coords,fill:'none',stroke:p.color,'stroke-width':p.width,'stroke-opacity':p.opacity,'stroke-linecap':'round'}));
        if(p.width>=2)mesh.appendChild(node(doc,'polyline',{points:coords,fill:'none',stroke:'#fff','stroke-width':p.width*.3,'stroke-opacity':'.4','stroke-linecap':'round'}));
      }else{
        mesh.appendChild(node(doc,'polygon',{points:coords,fill:p.color,stroke:p.color,'stroke-width':'.3','stroke-linejoin':'round'}));
        if(p.shade)mesh.appendChild(node(doc,'polygon',{points:coords,fill:p.shade>0?'#fff':'#000',opacity:Math.abs(p.shade),'pointer-events':'none'}));
      }
    });
    return mesh;
  }
  function applyEquipment(token,item){
    var doc=token.ownerDocument,face=node(doc,'g',{'class':'ps-depth-face'}),original=node(doc,'g',{'class':'ps-depth-original',display:'none'});
    while(token.firstChild)original.appendChild(token.firstChild);
    face.appendChild(original);face.appendChild(equipmentMesh(doc,item));
    // Retain the phone hit target and locked-state badge without changing source nodes.
    original.querySelectorAll('.tok-hit,.tok-lock').forEach(function(n){face.appendChild(n.cloneNode(true));});
    token.appendChild(face);token.setAttribute('data-depth','1');token.setAttribute('data-depth-equipment',item.team);
  }
  // 3.009 — 3D chips (stadium view): the token's own shape — shirt, disc or shaper — extruded with
  // team-colour sides, a glossy top, its number, and the player's name above it. The flat token is
  // kept hidden inside, so flatten() gives pictures, thumbnails and exports the ordinary token back.
  var CHIP_R = 21, CHIP_H = 8, CHIP_SCALE = 1, BEAK = 46, BEAK_W = 34;
  // At the board's default (smallest) size a 3D chip's radius is 1.2% of the pitch length (diameter ≈ 2.5 m on
  // 11-a-side) and its name 1.35%. 3.009 first used 1.7% — «the smallest size is too big» (user); the name keeps its size.
  var CHIP_BASE = .012, NAME_BASE = .0135;
  var SHIRT = 'M -8 -20 C -10.5 -20 -13.8 -19.3 -16.5 -18.2 L -23 -14.3 L -19.3 -4.6 L -14.6 -7.2 L -14.6 16.5 Q -14.6 20.5 -10.6 20.5 L 10.6 20.5 Q 14.6 20.5 14.6 16.5 L 14.6 -7.2 L 19.3 -4.6 L 23 -14.3 L 16.5 -18.2 C 13.8 -19.3 10.5 -20 8 -20 Q 0 -12.6 -8 -20 Z';
  // Shaper body: the disc and its beak as one teardrop, pointing along +x (the board's _shaperGeom, token units).
  var TEAR = (function () {
    var a = BEAK_W * Math.PI / 180, x = Math.round(CHIP_R * Math.cos(a) * 10) / 10, y = Math.round(CHIP_R * Math.sin(a) * 10) / 10;
    return 'M' + x + ' ' + (-y) + 'L' + BEAK + ' 0L' + x + ' ' + y + 'A' + CHIP_R + ' ' + CHIP_R + ' 0 1 1 ' + x + ' ' + (-y) + 'Z';
  })();
  var FONT = "-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',Roboto,sans-serif";
  function gradient(doc, tag, id, attrs, stops) {
    var g = node(doc, tag, Object.assign({ id: id }, attrs));
    stops.forEach(function (s) { g.appendChild(node(doc, 'stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] == null ? '1' : s[2] })); });
    return g;
  }
  // Shared paints live in one zero-size svg of their own: the board svg is rebuilt on every pitch change.
  function chipDefs(doc) {
    if (!doc.body || doc.getElementById('psChipDefs')) return;
    var host = node(doc, 'svg', { id: 'psChipDefs', width: '0', height: '0', 'aria-hidden': 'true', focusable: 'false' });
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    var defs = node(doc, 'defs');
    defs.appendChild(gradient(doc, 'linearGradient', 'psChipGloss', { x1: '0', y1: '0', x2: '.55', y2: '1' },
      [['0', '#fff', '.55'], ['.4', '#fff', '.08'], ['.7', '#000', '0'], ['1', '#000', '.22']]));
    defs.appendChild(gradient(doc, 'linearGradient', 'psChipEdge', { x1: '0', y1: '0', x2: '1', y2: '0' },
      [['0', '#000', '.38'], ['.3', '#fff', '.12'], ['.55', '#fff', '.04'], ['1', '#000', '.42']]));
    host.appendChild(defs); doc.body.appendChild(host);
  }
  // A darker tone of the team colour for the chip's sides; null when the fill is a pattern (striped kits).
  function shade(c, f) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim());
    if (!m) return null;
    var hex = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1], n = parseInt(hex, 16);
    return 'rgb(' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { return Math.round(v * f); }).join(',') + ')';
  }
  function chipTransform(item, k) {
    var r = Number(item.rot) || 0;
    return (r ? 'rotate(' + (-r) + ') ' : '') + 'scale(' + k + ')';
  }
  // opts.unit = the token's own scale on the board, opts.pitch = pitch length in board units,
  // opts.ref = the token scale at the board's default size. The default size is set against the pitch
  // (CHIP_BASE, NAME_BASE) so it reads the same on every screen; the board's size steps and a player's own
  // size scale the chip from there. Never smaller than the flat token (phones already use bigger tokens).
  // 3.016 — the size steps grow the chip by their square root, not one to one («3D 토큰이 너무 커졌다», user): a board
  // enlarged for a small grid — the process sessions sit at 2~3.7× the default — drew discs a fifth of a 12 m square
  // wide. The default size is unchanged and every step still changes the chip (×1.25 step → ×1.12 chip). So the
  // chip's radius is pitch × CHIP_BASE × √(unit / ref), reached through the geometric mean of unit and ref.
  function chipSize(opts) {
    // 3.070 — «실제 비율»: the token is already drawn at its real size (opts.real), so the chip is not enlarged.
    // The name keeps the size it has on an ordinary board (opts.nameUnit = that board's token scale) so it stays readable.
    if (opts && opts.real && +opts.unit > 0) {
      var nu = +opts.nameUnit > 0 ? +opts.nameUnit : +opts.unit, base = chipSize({ unit: nu, ref: opts.ref, pitch: opts.pitch });
      return { k: 1, font: Math.round(base.font * base.k * nu / +opts.unit * 100) / 100 };
    }
    var unit = opts && +opts.unit > 0 ? +opts.unit : 1, pitch = opts && +opts.pitch > 0 ? +opts.pitch : 0;
    var ref = opts && +opts.ref > 0 ? +opts.ref : unit, mid = Math.sqrt(ref * unit);
    var k = Math.min(3.2, Math.max(CHIP_SCALE, pitch * CHIP_BASE / (CHIP_R * mid)));
    return { k: Math.round(k * 1000) / 1000, font: Math.max(15, pitch * NAME_BASE / (mid * k)) };
  }
  function outline(doc, kind, attrs) {
    return kind === 'circle' ? node(doc, 'circle', Object.assign({ r: CHIP_R }, attrs)) : node(doc, 'path', Object.assign({ d: kind === 'shirt' ? SHIRT : TEAR }, attrs));
  }
  // The name sits above the chip — and above a shaper's beak when the beak points up, so it never hides the heading.
  function nameY(kind, h, font, dir) {
    if (kind === 'person') return Math.round((-PERSON_H - 6 - font * .4) * 10) / 10;
    var top = kind === 'shirt' ? 20 : CHIP_R;
    if (kind === 'shaper') top = Math.max(top, -BEAK * Math.sin((+dir || 0) * Math.PI / 180) + 2);
    return Math.round((-h - top - 4 - font * .4) * 10) / 10;
  }
  // The pill behind a name: an estimate of the text width (wide CJK glyphs, narrower Latin capitals) around the text's middle.
  function namePill(str, font, y) {
    var w = font * .9;
    for (var i = 0; i < str.length; i++) w += str.charCodeAt(i) > 0x2000 ? font * 1.02 : font * .7;
    var ph = font * 1.5, r = function (n) { return String(Math.round(n * 10) / 10); };
    return { x: r(-w / 2), y: r(y - font * .36 - ph / 2), width: r(w), height: r(ph) };
  }
  // 3.070 — «사람» (user: «3D 모드로 실제 사람처럼»): a standing player in the team's kit, feet on the token's spot.
  // Drawn upright like the chips' height (screen up), so the tilted board makes it stand on the grass.
  // Token units with 1 m = 84 (the flat disc, 42 wide, is a body 0.5 m wide): 1.8 m tall.
  var PERSON_M = 84, PERSON_H = 151;
  var SKIN = '#c8987a', HAIR = '#2b221d', BOOT = '#15181d', LINE = 'rgba(10,14,22,.55)';
  // 3.072 — «더 리얼하게» (user): a small skeleton in 3D, posed with a running gait and seen from any direction.
  // pose = { yaw (screen degrees the player faces: 0 right, 90 toward the camera, -90 away, 180 left), phase (stride cycles run so far), amp (0 stands … 1 sprints) }.
  // Body frame: f forward, l to the player's left, z up (token units, 84 per metre). A point projects to the board as
  // x = f·F.x + l·L.x, y = −z + depth·DEPTH where depth = f·F.d + l·L.d (toward the camera) — parts nearer the camera are drawn last.
  var DEPTH = .3, D2R = Math.PI / 180;
  function personPose(pose) {
    var p = pose || {}, amp = Math.max(0, Math.min(1, +p.amp || 0)), yaw = Number(p.yaw);
    return { yaw: isFinite(yaw) ? yaw : 90, phase: +p.phase || 0, amp: amp };
  }
  function r1(n) { return Math.round(n * 10) / 10; }
  // One running stride for one leg, from foot strike (0): stance until 0.35, then flight, swing and reach. Degrees.
  var GAIT = {
    hip:  [[0, 22], [.15, 6], [.35, -18], [.5, -6], [.65, 24], [.8, 36], [.9, 30], [1, 22]],
    knee: [[0, 16], [.12, 36], [.35, 20], [.5, 72], [.62, 104], [.76, 80], [.9, 28], [1, 16]],
    foot: [[0, 14], [.15, 0], [.3, -22], [.42, -55], [.56, -34], [.75, -8], [.9, 10], [1, 14]]
  };
  function curve(keys, p) {
    p = p - Math.floor(p);
    for (var i = 1; i < keys.length; i++) if (p <= keys[i][0]) {
      var a = keys[i - 1], b = keys[i], t = (p - a[0]) / (b[0] - a[0]), e = (1 - Math.cos(Math.PI * t)) / 2;
      return a[1] + (b[1] - a[1]) * e;
    }
    return keys[keys.length - 1][1];
  }
  function hull(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [];
    pts.forEach(function (q) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (var k = pts.length - 1; k >= 0; k--) { var q = pts[k]; while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function personFigure(doc, fill, stroke, label, pose) {
    var solid = /^#[0-9a-f]{3,6}$/i.test(String(fill || '').trim()) ? fill : (/^#[0-9a-f]{3,6}$/i.test(String(stroke || '').trim()) ? stroke : '#3a6df0');
    var shorts = shade(solid, .38) || '#1d2128', sock = solid, P = personPose(pose), A = P.amp, TAU = Math.PI * 2;
    var yaw = P.yaw * D2R, F = { x: Math.cos(yaw), d: Math.sin(yaw) }, L = { x: Math.sin(yaw), d: -Math.cos(yaw) };
    var fig = node(doc, 'g', { 'class': 'ps-person', 'data-yaw': String(Math.round(P.yaw)) });
    // Upper body: leans forward with speed; shoulders turn against the hips with the arms.
    var HIP = 82, lean = (2 + A * 13) * D2R, ph = P.phase, swing = Math.cos(TAU * (ph - .8));
    var tauS = A * 13 * D2R * swing, tauP = -A * 6 * D2R * swing;
    function turn(q, t) { return [q[0] * Math.cos(t) - q[1] * Math.sin(t), q[0] * Math.sin(t) + q[1] * Math.cos(t), q[2]]; }
    function upper(q) { var dz = q[2] - HIP; return [q[0] + dz * Math.sin(lean), q[1], HIP + dz * Math.cos(lean)]; }
    function body(q) { return upper(turn(q, tauS)); }
    function pelvis(q) { return turn(q, tauP); }
    var lift = 0;
    function proj(q) { var dep = q[0] * F.d + q[1] * L.d; return { x: q[0] * F.x + q[1] * L.x, y: -(q[2] + lift) + dep * DEPTH, d: dep }; }
    // Legs: hip angle (forward +), knee bend, foot pitch from the gait, scaled from standing to sprinting.
    function leg(side) {
      var p = ph + (side > 0 ? 0 : .5), th = A * curve(GAIT.hip, p) * D2R, kn = (4 + A * (curve(GAIT.knee, p) - 4)) * D2R, ft = A * curve(GAIT.foot, p) * D2R;
      var hip = pelvis([0, side * 8.5, HIP]), sh = th - kn;
      var knee = [hip[0] + 40 * Math.sin(th), hip[1] + side * .6, hip[2] - 40 * Math.cos(th)];
      var ank = [knee[0] + 39 * Math.sin(sh), knee[1] + side * .4, knee[2] - 39 * Math.cos(sh)];
      var toe = [ank[0] + 13 * Math.cos(ft), ank[1], ank[2] - 1.5 + 13 * Math.sin(ft)];
      return { side: side, hip: hip, knee: knee, ank: ank, toe: toe };
    }
    function arm(side) {
      var p = ph + (side > 0 ? 0 : .5), c = Math.cos(TAU * (p - .8)), sa = (-A * 46 * c) * D2R, el = (10 + A * (78 + 14 * c)) * D2R, ab = (1 - A) * 7 * D2R + 4 * D2R;
      var sh = body([0, side * 16, 120]);
      var elb = body([25 * Math.sin(sa), side * (16 + 25 * Math.sin(ab)), 120 - 25 * Math.cos(sa)]);
      var fa = sa + el, wr = body([25 * Math.sin(sa) + 22 * Math.sin(fa), side * (16 + 25 * Math.sin(ab) + 2), 120 - 25 * Math.cos(sa) - 22 * Math.cos(fa)]);
      return { side: side, sh: sh, elb: elb, wr: wr };
    }
    var LL = leg(1), LR = leg(-1), AL = arm(1), AR = arm(-1);
    // The lower foot stands on the grass; in the flight phase both feet leave it.
    var low = Math.min(LL.ank[2], LR.ank[2], LL.toe[2] + 1.5, LR.toe[2] + 1.5), flight = 0;
    [ph, ph + .5].forEach(function (q) { q -= Math.floor(q); if (q > .35 && q < .5) flight = Math.max(flight, Math.sin(Math.PI * (q - .35) / .15)); });
    lift = 6 - low + A * 5 * flight;
    // Drawing helpers: a limb is a tapered capsule through its points; colours by part.
    function capsule(pts, radii) {
      var n = pts.length, left = [], right = [];
      for (var k = 0; k < n; k++) {
        var a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len; left.push([pts[k].x + nx * radii[k], pts[k].y + ny * radii[k]]); right.push([pts[k].x - nx * radii[k], pts[k].y - ny * radii[k]]);
      }
      var d = 'M' + left.map(function (q) { return r1(q[0]) + ' ' + r1(q[1]); }).join('L');
      d += 'A' + r1(radii[n - 1]) + ' ' + r1(radii[n - 1]) + ' 0 0 0 ' + r1(right[n - 1][0]) + ' ' + r1(right[n - 1][1]);
      d += 'L' + right.slice().reverse().map(function (q) { return r1(q[0]) + ' ' + r1(q[1]); }).join('L');
      d += 'A' + r1(radii[0]) + ' ' + r1(radii[0]) + ' 0 0 0 ' + r1(left[0][0]) + ' ' + r1(left[0][1]) + 'Z';
      return d;
    }
    function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function piece(g, d, color, far, edge) {
      g.appendChild(node(doc, 'path', { d: d, fill: color, stroke: LINE, 'stroke-width': '.9', 'stroke-linejoin': 'round' }));
      if (edge) g.appendChild(node(doc, 'path', { d: d, fill: 'url(#psChipEdge)', 'pointer-events': 'none' }));
      if (far) g.appendChild(node(doc, 'path', { d: d, fill: '#000', 'fill-opacity': '.2', 'pointer-events': 'none' }));
    }
    var parts = [];
    function drawLeg(Lg) {
      var hp = proj(Lg.hip), kp = proj(Lg.knee), ap = proj(Lg.ank), tp = proj(Lg.toe), far = (hp.d + kp.d) / 2 < -1;
      var calf = proj(mix(Lg.knee, Lg.ank, .3)), sockTop = proj(mix(Lg.knee, Lg.ank, .16)), thighMid = proj(mix(Lg.hip, Lg.knee, .36));
      parts.push({ d: (hp.d + kp.d + ap.d) / 3, draw: function (g) {
        piece(g, capsule([thighMid, kp], [6.2, 4.9]), SKIN, far);                                   // thigh below the shorts, knee
        piece(g, capsule([sockTop, calf, ap], [4.9, 5.4, 3.1]), sock, far, true);                  // sock over the calf
        piece(g, capsule([ap, tp], [3.6, 3]), BOOT, false);                                         // boot
        piece(g, capsule([hp, proj(mix(Lg.hip, Lg.knee, .4))], [8, 7.2]), shorts, far, true);     // shorts leg
      } });
    }
    function drawArm(Am) {
      var sp = proj(Am.sh), ep = proj(Am.elb), wp = proj(Am.wr), far = ep.d < -1, sl = proj(mix(Am.sh, Am.elb, .4));
      parts.push({ d: ep.d + (far ? -2 : 2), draw: function (g) {
        piece(g, capsule([sl, ep, wp], [4.1, 3.5, 2.7]), SKIN, far);                               // arm and forearm
        g.appendChild(node(doc, 'circle', { cx: r1(wp.x), cy: r1(wp.y), r: 3.2, fill: SKIN, stroke: LINE, 'stroke-width': '.8' }));   // hand
        piece(g, capsule([sp, sl], [4.9, 4.4]), fill, far, true);                                   // sleeve
      } });
    }
    drawLeg(LL); drawLeg(LR); drawArm(AL); drawArm(AR);
    // Torso and hips: the outline of a few points of the chest, waist and hips — wide from the front, deep from the side.
    var tor = [], hips = [];
    [[8, 16.5, 122], [-8, 16.5, 122], [11, 15, 108], [-9.5, 15, 108], [8.5, 13.5, 91], [-8.5, 13.5, 91]].forEach(function (q) {
      var f = q[2] > 100 ? body : function (v) { return upper(pelvis(v)); }; tor.push(proj(f([q[0], q[1], q[2]]))); tor.push(proj(f([q[0], -q[1], q[2]])));
    });
    [[8.5, 14, 92], [-8.5, 14, 92], [8.5, 14, 78], [-9, 14, 78]].forEach(function (q) { hips.push(proj(pelvis([q[0], q[1], q[2]]))); hips.push(proj(pelvis([q[0], -q[1], q[2]]))); });
    function poly(ps) { var h = hull(ps.map(function (q) { return [q.x, q.y]; })); return 'M' + h.map(function (q) { return r1(q[0]) + ' ' + r1(q[1]); }).join('L') + 'Z'; }
    var neckB = proj(body([0, 0, 120])), neckT = proj(body([.5, 0, 131])), head = proj(body([1, 0, 139.5]));
    parts.push({ d: 0, draw: function (g) {
      piece(g, poly(hips), shorts, false, true);
      piece(g, capsule([neckB, neckT], [3.8, 3.6]), SKIN, false);
      piece(g, poly(tor), fill, false, true);
      // Collar: a V at the front, a band at the back.
      var c0 = proj(body([7.5, 5, 122])), c1 = proj(body([8.5, 0, 117])), c2 = proj(body([7.5, -5, 122]));
      if (F.d > -.2) g.appendChild(node(doc, 'path', { d: 'M' + r1(c0.x) + ' ' + r1(c0.y) + 'L' + r1(c1.x) + ' ' + r1(c1.y) + 'L' + r1(c2.x) + ' ' + r1(c2.y), fill: 'none', stroke: stroke || LINE, 'stroke-width': '1.6', 'stroke-linejoin': 'round' }));
      // Number on the chest or, larger, on the back; narrower as the shirt turns away.
      var text = label && label.textContent;
      if (text) {
        var back = F.d < -.15, at = proj(body([(back ? -9.5 : 11) * Math.min(1, Math.abs(F.d) * 1.6), 0, back ? 107 : 105])), len = String(text).length, w = Math.max(.5, Math.abs(F.d));
        var n = label.cloneNode(true); n.setAttribute('x', '0'); n.setAttribute('y', '0'); n.setAttribute('pointer-events', 'none');
        n.setAttribute('font-size', back ? (len >= 3 ? '11' : (len === 2 ? '15' : '17')) : (len >= 3 ? '9' : (len === 2 ? '12' : '14')));
        n.setAttribute('transform', 'translate(' + r1(at.x) + ',' + r1(at.y) + ') scale(' + (Math.round(w * 100) / 100) + ',1)');
        g.appendChild(n);
      }
    } });
    parts.sort(function (a, b) { return a.d - b.d; }).forEach(function (q) { q.draw(fig); });
    // Head last: hair at the back and top, the face toward where the player looks.
    var hb = { x: head.x - F.x * 2.8, y: head.y - 1.2 - F.d * 2.8 * DEPTH * 3 }, facing = F.d > -.25;
    function ell(c, rx, ry, color, extra) { fig.appendChild(node(doc, 'ellipse', Object.assign({ cx: r1(c.x), cy: r1(c.y), rx: rx, ry: ry, fill: color }, extra || {}))); }
    if (facing) { ell(hb, 9, 10.4, HAIR); ell(head, 8.4, 10.2, SKIN, { stroke: LINE, 'stroke-width': '.9' });
      fig.appendChild(node(doc, 'path', { d: 'M' + r1(head.x - 8.6) + ' ' + r1(head.y - 1.5) + 'Q' + r1(head.x - 9) + ' ' + r1(head.y - 12.5) + ' ' + r1(head.x) + ' ' + r1(head.y - 12.6) + 'Q' + r1(head.x + 9) + ' ' + r1(head.y - 12.5) + ' ' + r1(head.x + 8.6) + ' ' + r1(head.y - 1.5) + 'Q' + r1(head.x + 4) + ' ' + r1(head.y - 7) + ' ' + r1(head.x) + ' ' + r1(head.y - 7.4) + 'Q' + r1(head.x - 4) + ' ' + r1(head.y - 7) + ' ' + r1(head.x - 8.6) + ' ' + r1(head.y - 1.5) + 'Z', fill: HAIR, transform: Math.abs(F.x) > .3 ? 'translate(' + r1(-F.x * 2.2) + ',0)' : '' }));
      if (Math.abs(F.x) > .25) ell({ x: head.x + F.x * 8.4, y: head.y + 1 }, 1.5, 1.8, SKIN, { stroke: LINE, 'stroke-width': '.6' });   // nose in profile
    } else { ell(head, 8.6, 10.4, SKIN, { stroke: LINE, 'stroke-width': '.9' }); ell({ x: head.x - F.x * 1.5, y: head.y - 1 }, 8.8, 10.2, HAIR); }
    return fig;
  }
  // opts.shape = 'shirt' | 'circle' | 'shaper' | 'person' (the board's player shape), opts.dir = shaper heading in chip degrees.
  function applyChip(token, item, opts) {
    var doc = token.ownerDocument; chipDefs(doc);
    var size = chipSize(opts), kind = opts && (opts.shape === 'shirt' || opts.shape === 'shaper' || opts.shape === 'person') ? opts.shape : 'circle';
    var face = node(doc, 'g', { 'class': 'ps-depth-face' }), original = node(doc, 'g', { 'class': 'ps-depth-original', display: 'none' });
    while (token.firstChild) original.appendChild(token.firstChild);
    var shape = original.querySelector('.tok-c'), label = original.querySelector('text');
    var fill = (shape && shape.getAttribute('fill')) || '#3a6df0', stroke = (shape && shape.getAttribute('stroke')) || 'rgba(0,0,0,.35)';
    var side = shade(fill, .6) || shade(stroke, .7) || '#2b3039', foot = shade(fill, .42) || '#1d2128';
    var R = CHIP_R, h = CHIP_H, turn = 'rotate(' + (Math.round((+(opts && opts.dir) || 0) * 10) / 10) + ')';
    // Counter-rotated so the shirt and the name stay upright; elevation is then always straight up.
    var body = node(doc, 'g', { 'class': 'ps-chip', 'data-k': String(size.k), 'data-shape': kind, transform: chipTransform(item, size.k) });
    // Floodlights on four corner masts: four faint shadows in an X plus a contact shadow, as on a lit pitch.
    // Flat fills, not gradients: Safari repaints every chip on each drag frame and radial gradients made that slow.
    // 3.029 — the light follows the board's mood (opts.mood): night = the four masts, day = one short shadow under a high sun, dusk = one long shadow.
    if (kind === 'person') {
      var mood = opts && opts.mood;
      // A standing player: a contact shadow at the feet and a cast shadow on the grass that follows the light.
      if (mood === 'day') body.appendChild(node(doc, 'ellipse', { cx: 4, cy: 2, rx: 17, ry: 6.5, fill: '#000', 'fill-opacity': '.26', 'pointer-events': 'none', 'class': 'ps-chip-shadow' }));
      else if (mood === 'dusk') body.appendChild(node(doc, 'path', { d: 'M-8 1L-10 -4L95 -14L100 -6L94 4Z', fill: '#000', 'fill-opacity': '.26', 'pointer-events': 'none', 'class': 'ps-chip-shadow' }));
      else [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (o) {
        body.appendChild(node(doc, 'path', { d: 'M-7 0L7 0L' + (o[0] * 38 + 6) + ' ' + (o[1] * 26) + 'L' + (o[0] * 38 - 6) + ' ' + (o[1] * 26) + 'Z', fill: '#000', 'fill-opacity': '.11', 'pointer-events': 'none', 'class': 'ps-chip-shadow' }));
      });
      body.appendChild(node(doc, 'ellipse', { cx: 0, cy: 0, rx: 15, ry: 5.5, fill: '#000', 'fill-opacity': '.34', 'pointer-events': 'none' }));
      // 3.072 — a low, turned camera (the broadcast view) foreshortens the board: opts.stand = { rot, sy } turns the player
      // back upright on screen and stretches him so he stands at his real height instead of lying on the grass.
      var st = opts && opts.stand, stand = node(doc, 'g', { 'class': 'ps-person-stand' });
      if (st && (st.rot || (st.sy && st.sy !== 1))) stand.setAttribute('transform', 'rotate(' + r1(+st.rot || 0) + ') scale(1,' + (Math.round((+st.sy || 1) * 1000) / 1000) + ')');
      stand.appendChild(personFigure(doc, fill, stroke, label, opts && opts.pose));
      body.appendChild(stand);
    } else {
    var mood = opts && opts.mood;
    if (mood === 'day') body.appendChild(node(doc, 'ellipse', { cx: 3, cy: 3, rx: R + 2, ry: R * .8, fill: '#000', 'fill-opacity': '.22', 'pointer-events': 'none', 'class': 'ps-chip-shadow' }));
    else if (mood === 'dusk') body.appendChild(node(doc, 'ellipse', { cx: R * 1.1, cy: 3, rx: R * 2.1, ry: R * .62, fill: '#000', 'fill-opacity': '.3', 'pointer-events': 'none', 'class': 'ps-chip-shadow', transform: 'rotate(12)' }));
    else [[6, 5], [-6, 5], [6, -3], [-6, -3]].forEach(function (o) {
      body.appendChild(node(doc, 'ellipse', { cx: o[0], cy: o[1], rx: R + 2, ry: R, fill: '#000', 'fill-opacity': '.1', 'pointer-events': 'none', 'class': 'ps-chip-shadow' }));
    });
    body.appendChild(node(doc, 'ellipse', { cx: 1, cy: 1.5, rx: R + 1.5, ry: R + .5, fill: '#000', 'fill-opacity': '.26', 'pointer-events': 'none' }));
    // At height z; a shaper's teardrop turns with its heading (ps-chip-turn), everything else stays upright.
    function at(z, el, turns) {
      var g = node(doc, 'g', { transform: 'translate(0,' + (-z) + ')' });
      if (turns) { var t = node(doc, 'g', { 'class': 'ps-chip-turn', transform: turn }); t.appendChild(el); g.appendChild(t); } else g.appendChild(el);
      return g;
    }
    // Sides: a disc has a straight wall; a shirt or a beak is stacked in thin slices.
    if (kind === 'circle' || kind === 'shaper') {
      if (kind === 'shaper') for (var z = 0; z < h; z += 2) body.appendChild(at(z, outline(doc, 'shaper', { fill: z ? '#a5adb8' : '#7d8590', stroke: z ? '#a5adb8' : '#7d8590', 'stroke-width': '.6' }), true));
      var wall = 'M' + (-R) + ' ' + (-h) + 'V0A' + R + ' ' + R + ' 0 0 0 ' + R + ' 0V' + (-h) + 'Z';
      body.appendChild(node(doc, 'path', { d: wall, fill: side, stroke: foot, 'stroke-width': '.8' }));
      body.appendChild(node(doc, 'path', { d: wall, fill: 'url(#psChipEdge)', 'pointer-events': 'none' }));
    } else {
      for (var y = 0; y < h; y += 2) body.appendChild(at(y, outline(doc, 'shirt', { fill: y ? side : foot, stroke: y ? side : foot, 'stroke-width': '.8', 'stroke-linejoin': 'round' })));
    }
    // Top: the token's own face, then a gloss over it — one group at the chip's height (fewer nodes to paint per frame).
    var lid = node(doc, 'g', { transform: 'translate(0,' + (-h) + ')' });
    if (kind === 'shaper') { var beak = node(doc, 'g', { 'class': 'ps-chip-turn', transform: turn }); beak.appendChild(outline(doc, 'shaper', { fill: '#ffffff', stroke: 'rgba(10,14,22,.5)', 'stroke-width': '1.1', 'stroke-linejoin': 'round' })); lid.appendChild(beak); }
    var top = kind === 'shirt' ? 'shirt' : 'circle';
    lid.appendChild(outline(doc, top, { fill: fill, stroke: stroke, 'stroke-width': kind === 'shirt' ? '2.2' : '2.6', 'stroke-linejoin': 'round', 'class': 'ps-chip-top' }));
    if (kind === 'shirt') { var acc = original.querySelector('path:not(.tok-c)'); if (acc) lid.appendChild(acc.cloneNode(true)); }
    lid.appendChild(outline(doc, top, { fill: 'url(#psChipGloss)', 'pointer-events': 'none' }));
    var text = label && label.textContent;
    if (text) { var n = label.cloneNode(true); n.setAttribute('x', '0'); n.setAttribute('pointer-events', 'none'); lid.appendChild(n); }
    body.appendChild(lid);
    }
    if (item.name) {
      // opts.nameK = the board's name size (0.8 · 1 · 1.25); opts.nameStyle 'pill' puts the name on a dark pill, otherwise an outlined name.
      var font = size.font * (opts && +opts.nameK > 0 ? +opts.nameK : 1), str = String(item.name).toUpperCase(), y0 = nameY(kind, h, font, opts && opts.dir);
      var nameHost = (kind === 'person' && body.querySelector('.ps-person-stand')) || body;
      if (opts && opts.nameStyle === 'pill') nameHost.appendChild(node(doc, 'rect', Object.assign({ 'class': 'ps-chip-namebg', rx: String(Math.round(font * 4.5) / 10), fill: 'rgba(18,22,30,.86)' }, namePill(str, font, y0))));
      var name = node(doc, 'text', { x: 0, y: y0, 'data-font': String(font), 'text-anchor': 'middle', 'font-size': String(Math.round(font * 10) / 10), 'font-weight': '800', 'letter-spacing': '.4',
        fill: '#fff', stroke: 'rgba(6,12,8,.82)', 'stroke-width': String(Math.round(font * 2.4) / 10), 'stroke-linejoin': 'round', 'paint-order': 'stroke',
        'font-family': (label && label.getAttribute('font-family')) || FONT, 'class': 'ps-chip-name' });   // the name is part of the chip: pressing it picks the player
      name.textContent = str;
      nameHost.appendChild(name);
    }
    face.appendChild(original); face.appendChild(body);
    original.querySelectorAll('.tok-hit,.tok-lock').forEach(function (n) { face.appendChild(n.cloneNode(true)); });
    token.appendChild(face); token.setAttribute('data-depth', String(kind === 'person' ? PERSON_H : h)); token.setAttribute('data-depth-chip', String(size.k));
    if (kind === 'person') token.setAttribute('data-depth-person', '1');
  }
  // A shaper turns without a rebuild: its heading follows the ball or the rotate handle.
  function turnChip(token, deg) {
    if (!token) return;
    var t = 'rotate(' + (Math.round((+deg || 0) * 10) / 10) + ')';
    token.querySelectorAll('.ps-chip-turn').forEach(function (g) { if (g.getAttribute('transform') !== t) g.setAttribute('transform', t); });
    var name = token.querySelector('.ps-chip-name');
    if (!name) return;
    var font = +name.getAttribute('data-font') || 15, y = nameY('shaper', CHIP_H, font, deg);
    if (+name.getAttribute('y') === y) return;
    name.setAttribute('y', String(y));
    var bg = token.querySelector('.ps-chip-namebg');
    if (bg) bg.setAttribute('y', namePill(name.textContent || '', font, y).y);
  }
  function flatten(token) {
    var face = token.querySelector('.ps-depth-face');
    if (!face) return;
    var source=face.querySelector('.ps-depth-original')||face;
    while (source.firstChild) token.insertBefore(source.firstChild, face);
    face.remove();
    token.querySelectorAll('.ps-depth-decoration').forEach(function (n) { n.remove(); });
    token.removeAttribute('data-depth');
    token.removeAttribute('data-depth-equipment');
    token.removeAttribute('data-depth-chip');
    token.removeAttribute('data-depth-person');
  }
  function flattenAll(svg) {
    svg.querySelectorAll('.token[data-depth]').forEach(flatten);
  }
  function apply(token, item, kind, opts) {
    if (!token || token.hasAttribute('data-depth')) return;
    if(kind==='equip'&&equipmentTypes.indexOf(item.team)>=0){applyEquipment(token,item);return;}
    var doc = token.ownerDocument, player = kind === 'player', ball = kind === 'ball' || item.team === 'ball';
    if (player && !item.img && token.querySelector('.tok-c')) { applyChip(token, item, opts); return; }
    var height = player ? 13 : ball ? 9 : 7;
    var delta = elevation(item.rot, height), shape = player && token.querySelector('.tok-c');
    var face = node(doc, 'g', { 'class': 'ps-depth-face', transform: 'translate(' + delta.x + ',' + delta.y + ')' });
    while (token.firstChild) face.appendChild(token.firstChild);
    var body = node(doc, 'g', { 'class': 'ps-depth-decoration', 'pointer-events': 'none', 'aria-hidden': 'true' });
    body.appendChild(node(doc, 'ellipse', { cx: 3, cy: 4, rx: player ? 26 : 17, ry: player ? 18 : 11, fill: '#000', opacity: ball ? '.34' : '.24' }));
    // 3.009 — a ball floats over its shadow; photo chips get the same white puck side as the stadium chip.
    for (var z = 0; !ball && z <= height; z += 2) {
      var d = elevation(item.rot, z), side = shape ? shape.cloneNode(false) : node(doc, 'ellipse', { rx: 14, ry: 10 });
      side.removeAttribute('id'); side.removeAttribute('class');
      side.setAttribute('data-depth-level', String(z));
      side.setAttribute('fill', player ? (z < height / 2 ? '#9aa3ae' : '#dfe4ea') : (z < height / 2 ? '#17202d' : '#344254'));
      side.setAttribute('stroke', player ? '#7b8592' : '#16202c'); side.setAttribute('stroke-width', '1');
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
    if(token.hasAttribute('data-depth-equipment')){var old=token.querySelector('.ps-equipment-mesh');old.parentNode.replaceChild(equipmentMesh(token.ownerDocument,item),old);return;}
    if (token.hasAttribute('data-depth-chip')) { var chip = token.querySelector('.ps-chip'); if (chip) chip.setAttribute('transform', chipTransform(item, +chip.getAttribute('data-k') || CHIP_SCALE)); return; }
    var d = elevation(item.rot, Number(token.getAttribute('data-depth')));
    token.querySelector('.ps-depth-face').setAttribute('transform', 'translate(' + d.x + ',' + d.y + ')');
    token.querySelectorAll('[data-depth-level]').forEach(function (side) {
      var offset = elevation(item.rot, Number(side.getAttribute('data-depth-level')));
      side.setAttribute('transform', 'translate(' + offset.x + ',' + offset.y + ')');
    });
  }
  return { equipmentTypes: equipmentTypes.slice(), update: update, apply: apply, flatten: flatten, flattenAll: flattenAll, elevation: elevation, chipSize: chipSize, turnChip: turnChip, PERSON_M: PERSON_M, PERSON_H: PERSON_H, personPose: personPose };
});
