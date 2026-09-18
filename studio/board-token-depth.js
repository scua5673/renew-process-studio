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
  function flatten(token) {
    var face = token.querySelector('.ps-depth-face');
    if (!face) return;
    var source=face.querySelector('.ps-depth-original')||face;
    while (source.firstChild) token.insertBefore(source.firstChild, face);
    face.remove();
    token.querySelectorAll('.ps-depth-decoration').forEach(function (n) { n.remove(); });
    token.removeAttribute('data-depth');
    token.removeAttribute('data-depth-equipment');
  }
  function flattenAll(svg) {
    svg.querySelectorAll('.token[data-depth]').forEach(flatten);
  }
  function apply(token, item, kind) {
    if (!token || token.hasAttribute('data-depth')) return;
    if(kind==='equip'&&equipmentTypes.indexOf(item.team)>=0){applyEquipment(token,item);return;}
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
    if(token.hasAttribute('data-depth-equipment')){var old=token.querySelector('.ps-equipment-mesh');old.parentNode.replaceChild(equipmentMesh(token.ownerDocument,item),old);return;}
    var d = elevation(item.rot, Number(token.getAttribute('data-depth')));
    token.querySelector('.ps-depth-face').setAttribute('transform', 'translate(' + d.x + ',' + d.y + ')');
    token.querySelectorAll('[data-depth-level]').forEach(function (side) {
      var offset = elevation(item.rot, Number(side.getAttribute('data-depth-level')));
      side.setAttribute('transform', 'translate(' + offset.x + ',' + offset.y + ')');
    });
  }
  return { equipmentTypes: equipmentTypes.slice(), update: update, apply: apply, flatten: flatten, flattenAll: flattenAll, elevation: elevation };
});
