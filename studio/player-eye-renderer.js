/* Three.js is loaded locally, only after a user opens the player viewer. */
(function (win) {
  'use strict';
  var M = win.PSPlayerEyeModel;
  function pitchLines(ctx, f, x, y, scale) {
    var l = f.len / 2, w = f.wid / 2, sp = f.spec || {};
    function rect(a,b,c,d){ctx.strokeRect(x(a),y(b),(c-a)*scale,(d-b)*scale);}
    ctx.lineWidth = Math.max(.65, .12 * scale); ctx.strokeStyle = '#e8eee0';
    if (sp.blank) return;
    rect(-l,-w,l,w);ctx.beginPath();ctx.moveTo(x(0),y(-w));ctx.lineTo(x(0),y(w));ctx.stroke();
    ctx.beginPath();ctx.arc(x(0),y(0),(sp.cc||9.15)*scale,0,Math.PI*2);ctx.stroke();
    for(var side of [-1,1]){
      var gx=side*l, sign=-side, goal=sp.goal||7.32;
      if(sp.futsal){
        ctx.beginPath();var radius=sp.paR||6;
        if(side<0){ctx.arc(x(gx),y(-goal/2),radius*scale,-Math.PI/2,0);ctx.lineTo(x(gx+radius),y(goal/2));ctx.arc(x(gx),y(goal/2),radius*scale,0,Math.PI/2);}
        else {ctx.arc(x(gx),y(-goal/2),radius*scale,-Math.PI/2,-Math.PI,true);ctx.lineTo(x(gx-radius),y(goal/2));ctx.arc(x(gx),y(goal/2),radius*scale,Math.PI,Math.PI/2,true);}
        ctx.stroke();
      } else {
        var pa=sp.paD||16.5,pw=goal/2+(sp.paOff||16.5),ga=sp.gaD||5.5,gw=goal/2+(sp.gaOff||5.5);
        rect(Math.min(gx,gx+sign*pa),-pw,Math.max(gx,gx+sign*pa),pw);
        rect(Math.min(gx,gx+sign*ga),-gw,Math.max(gx,gx+sign*ga),gw);
        var pk=gx+sign*(sp.pk||11),r=sp.arc||9.15,ang=Math.acos(Math.min(1,(pa-(sp.pk||11))/r));
        ctx.beginPath();ctx.arc(x(pk),y(0),r*scale,side<0?-ang:Math.PI-ang,side<0?ang:Math.PI+ang);ctx.stroke();
      }
      ctx.fillStyle='#e8eee0';ctx.beginPath();ctx.arc(x(gx+sign*(sp.pk||6)),y(0),Math.max(.8,.14*scale),0,Math.PI*2);ctx.fill();
    }
  }
  function drawMarkings(ctx, frame, x, y, scale) {
    var ids = new Map(frame.players.map(function(p){return [String(p.id),p];}));
    if(frame.ball)ids.set('ball',frame.ball);
    (frame.drawings||[]).forEach(function(d){
      if(!d||!Array.isArray(d.pts)||!d.pts.length)return;
      var points=d.pts.map(function(p,i){var token=d.tk&&ids.get(String(d.tk[i]));return token||M.point(p,frame.field);}).filter(function(p){return Number.isFinite(p.x)&&Number.isFinite(p.z);});
      if(!points.length)return;
      ctx.save();ctx.strokeStyle=/^#[a-f\d]{3,8}$/i.test(d.color||'')?d.color:'#f0cd72';ctx.fillStyle=ctx.strokeStyle;ctx.globalAlpha=.78;
      ctx.lineWidth=Math.max(1,scale*.10*(d.lw||1));if(/dash|run/.test(d.type))ctx.setLineDash([scale*.5,scale*.4]);
      var a=points[0],b=points[1];ctx.beginPath();
      if(/rect/.test(d.type)&&b){ctx.rect(x(Math.min(a.x,b.x)),y(Math.min(a.z,b.z)),Math.abs(a.x-b.x)*scale,Math.abs(a.z-b.z)*scale);}
      else if(d.type==='ellipse'&&b){ctx.ellipse(x((a.x+b.x)/2),y((a.z+b.z)/2),Math.abs(a.x-b.x)*scale/2,Math.abs(a.z-b.z)*scale/2,0,0,Math.PI*2);}
      else if(d.type==='text'){ctx.font=Math.max(11,scale*.8)+'px Pretendard, sans-serif';ctx.fillText(String(d.text||'').slice(0,120),x(a.x),y(a.z));ctx.restore();return;}
      else {points.forEach(function(p,i){if(i)ctx.lineTo(x(p.x),y(p.z));else ctx.moveTo(x(p.x),y(p.z));});if(d.type==='poly')ctx.closePath();}
      ctx.stroke();if(/^(rect|ellipse|poly)$/.test(d.type)){ctx.globalAlpha=.1;ctx.fill();}
      if(/^(pass|run|dribble)$/.test(d.type)&&points.length>1){var end=points[points.length-1],prev=points[points.length-2],ang=Math.atan2(end.z-prev.z,end.x-prev.x),len=Math.max(4,scale*.7);ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(x(end.x)-Math.cos(ang-.45)*len,y(end.z)-Math.sin(ang-.45)*len);ctx.lineTo(x(end.x),y(end.z));ctx.lineTo(x(end.x)-Math.cos(ang+.45)*len,y(end.z)-Math.sin(ang+.45)*len);ctx.stroke();}
      ctx.restore();
    });
  }
  function drawMap(canvas, frame, cam, selected, fov) {
    var w=canvas.clientWidth,h=canvas.clientHeight;if(w<20||h<20)return null;
    var dpr=Math.min(win.devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    var ctx=canvas.getContext('2d'),f=frame.field,pad=w>260?22:13,s=Math.min((w-2*pad)/f.len,(h-2*pad)/f.wid),ox=w/2,oy=h/2;
    var x=function(n){return ox+n*s;},y=function(n){return oy+n*s;};
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#243a31';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#304e3d';ctx.fillRect(x(-f.len/2),y(-f.wid/2),f.len*s,f.wid*s);pitchLines(ctx,f,x,y,s);drawMarkings(ctx,frame,x,y,s);
    if(cam){ctx.save();ctx.beginPath();ctx.rect(x(-f.len/2),y(-f.wid/2),f.len*s,f.wid*s);ctx.clip();
      var spread=fov*Math.PI/360;ctx.beginPath();ctx.moveTo(x(cam.x),y(cam.z));for(var j=0;j<=18;j++){var an=cam.yaw-spread+2*spread*j/18;ctx.lineTo(x(cam.x+Math.cos(an)*28),y(cam.z+Math.sin(an)*28));}ctx.closePath();ctx.fillStyle='#f1ce733d';ctx.fill();ctx.restore();
      ctx.strokeStyle='#f4f5f7';ctx.lineWidth=1.5;ctx.setLineDash([2,2]);ctx.beginPath();ctx.moveTo(x(cam.x),y(cam.z));ctx.lineTo(x(cam.x+Math.cos(cam.body)*9),y(cam.z+Math.sin(cam.body)*9));ctx.stroke();ctx.setLineDash([]);
    }
    frame.equipment.forEach(function(p){ctx.fillStyle=p.color||'#d5a94f';ctx.beginPath();ctx.arc(x(p.x),y(p.z),p.team==='ball'?2:2.5,0,Math.PI*2);ctx.fill();});
    var hits=[];frame.players.forEach(function(p){var px=x(p.x),py=y(p.z),sel=p.key===selected,r=w>260?9:4;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.strokeStyle=sel?'#ffe191':'#e8eee0';ctx.lineWidth=sel?2:1;ctx.stroke();if(sel){ctx.beginPath();ctx.arc(px,py,r+3,0,Math.PI*2);ctx.stroke();}if(w>260){ctx.font='600 10px Pretendard, sans-serif';ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(p.num||'').slice(0,3),px,py);}hits.push({id:p.key,x:px,y:py});});
    if(frame.ball){ctx.beginPath();ctx.arc(x(frame.ball.x),y(frame.ball.z),3,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill();ctx.strokeStyle='#14213d';ctx.lineWidth=1;ctx.stroke();}
    return hits;
  }
  function create(canvas, labels, onLoss) {
    var T=win.THREE,renderer=new T.WebGLRenderer({canvas:canvas,antialias:true,powerPreference:'low-power'}),scene=new T.Scene(),camera=new T.PerspectiveCamera(50,1,.08,240),disposed=false;
    renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    scene.fog=new T.Fog('#dce5e4',70,160);
    scene.add(new T.HemisphereLight(0xe4efff,0x5e7752,1.8));var sun=new T.DirectionalLight(0xfff4df,2);sun.position.set(-30,50,-40);scene.add(sun);
    var fieldGroup=new T.Group(),actors=new Map(),objects=new Map(),signature='',field=null,overlay=null,overlayTexture=null,lastDrawings='';scene.add(fieldGroup);
    var resources=new Set();
    function material(color,extra){var m=new T.MeshStandardMaterial(Object.assign({color:color,roughness:.85},extra||{}));resources.add(m);return m;}
    function mesh(geometry,mat,x,y,z,parent){resources.add(geometry);var p=new T.Mesh(geometry,mat);p.position.set(x||0,y||0,z||0);(parent||scene).add(p);return p;}
    function box(w,h,d,mat,x,y,z,parent){return mesh(new T.BoxGeometry(w,h,d),mat,x,y,z,parent);}
    function texture(c){var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;resources.add(t);return t;}
    // Merge rigid pieces by material; smoother anatomy does not mean one draw call per detail.
    function mergeRigid(group){
      var batches=new Map();group.children.slice().forEach(function(o){if(!o.isMesh)return;var a=batches.get(o.material)||[];a.push(o);batches.set(o.material,a);});
      batches.forEach(function(items,mat){if(items.length<2)return;var parts=[],count=0;
        items.forEach(function(o){o.updateMatrix();var g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);parts.push(g);count+=g.attributes.position.count;});
        var merged=new T.BufferGeometry();['position','normal','uv'].forEach(function(key){var size=key==='uv'?2:3,arr=new Float32Array(count*size),at=0;parts.forEach(function(g){var a=g.getAttribute(key);if(a)arr.set(a.array,at);at+=g.attributes.position.count*size;});merged.setAttribute(key,new T.BufferAttribute(arr,size));});
        items.forEach(function(o){o.geometry.dispose();resources.delete(o.geometry);group.remove(o);});parts.forEach(function(g){g.dispose();});mesh(merged,mat,0,0,0,group);
      });
    }
    var sky=document.createElement('canvas');sky.width=16;sky.height=256;var skyCtx=sky.getContext('2d'),skyFill=skyCtx.createLinearGradient(0,0,0,256);skyFill.addColorStop(0,'#afccd7');skyFill.addColorStop(.55,'#dce5e4');skyFill.addColorStop(1,'#e9ede5');skyCtx.fillStyle=skyFill;skyCtx.fillRect(0,0,16,256);scene.background=texture(sky);
    function drop(group){var geom=new Set(),mats=new Set();group.traverse(function(o){if(o.geometry)geom.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){mats.add(m);});});geom.forEach(function(g){g.dispose();resources.delete(g);});mats.forEach(function(m){if(m.map){m.map.dispose();resources.delete(m.map);}m.dispose();resources.delete(m);});group.removeFromParent();}
    function setupField(f){if(fieldGroup)drop(fieldGroup);fieldGroup=new T.Group();scene.add(fieldGroup);field=f;
      var s=12,pc=document.createElement('canvas');pc.width=Math.round(f.len*s);pc.height=Math.round(f.wid*s);var c=pc.getContext('2d');c.fillStyle='#467647';c.fillRect(0,0,pc.width,pc.height);
      for(var i=0;i<20;i++){c.fillStyle=i%2?'#4a7d4c':'#467647';c.fillRect(i*pc.width/20,0,pc.width/20,pc.height);}
      var grain=c.getImageData(0,0,pc.width,pc.height),seed=17;for(var at=0;at<grain.data.length;at+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;var n=((seed>>>24)/255-.5)*10;grain.data[at]+=n;grain.data[at+1]+=n;grain.data[at+2]+=n*.7;}c.putImageData(grain,0,0);
      pitchLines(c,f,function(x){return (x+f.len/2)*s;},function(z){return (z+f.wid/2)*s;},s);
      var t=texture(pc);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());var turf=mesh(new T.PlaneGeometry(f.len,f.wid),material('#ffffff',{map:t}),0,.005,0,fieldGroup);turf.rotation.x=-Math.PI/2;
      var ground=mesh(new T.PlaneGeometry(320,320),material('#6f8962'),0,-.02,0,fieldGroup);ground.rotation.x=-Math.PI/2;
      overlay=document.createElement('canvas');overlay.width=pc.width;overlay.height=pc.height;overlayTexture=texture(overlay);var lines=mesh(new T.PlaneGeometry(f.len,f.wid),material('#ffffff',{map:overlayTexture,transparent:true,depthWrite:false}),0,.016,0,fieldGroup);lines.rotation.x=-Math.PI/2;lastDrawings='';
      var rail=material('#8b9997');for(var side of [-1,1]){box(f.len+14,.3,.25,rail,0,1,side*(f.wid/2+6),fieldGroup);box(.25,.3,f.wid+12,rail,side*(f.len/2+7),1,0,fieldGroup);}
      if(!f.spec.blank)for(var sign of [-1,1]){var goal=makeGoal(f.spec.goal||7.32,f.spec.futsal?2:f.spec.goal===5.7?2.15:2.44,f.spec.goalD||2);goal.position.x=sign*f.len/2;goal.rotation.y=sign<0?Math.PI/2:-Math.PI/2;fieldGroup.add(goal);}
    }
    function makeGoal(width,height,depth){var group=new T.Group(),white=material('#edf0e9');for(var x of [-width/2,width/2]){box(.07,height,.07,white,x,height/2,0,group);box(.05,height,.05,white,x,height/2,-depth,group);}box(width,.07,.07,white,0,height,0,group);box(width,.05,.05,white,0,height,-depth,group);
      var ps=[];function line(a,b){ps.push(new T.Vector3(a[0],a[1],a[2]),new T.Vector3(b[0],b[1],b[2]));}
      for(var k=-width/2;k<=width/2;k+=.3){line([k,0,-depth],[k,height,-depth]);line([k,height,0],[k,height,-depth]);}for(var y=0;y<=height;y+=.3){line([-width/2,y,-depth],[width/2,y,-depth]);for(var side of [-1,1])line([side*width/2,y,0],[side*width/2,y,-depth]);}
      var geo=new T.BufferGeometry().setFromPoints(ps),ma=new T.LineBasicMaterial({color:'#d9e2d4',transparent:true,opacity:.55});resources.add(geo);resources.add(ma);group.add(new T.LineSegments(geo,ma));return group;}
    function person(p){
      var group=new T.Group(),kit=material(p.color),skin=material('#c1977c'),hair=material('#302d29'),shorts=material('#e8e9df'),boots=material('#26343b'),trim=material('#f2eee3');scene.add(group);
      function oval(rx,ry,rz,mat,x,y,z,parent){var o=mesh(new T.SphereGeometry(1,16,12),mat,x,y,z,parent||group);o.scale.set(rx,ry,rz);return o;}
      function capsule(radius,length,mat,x,y,z,parent){return mesh(new T.CapsuleGeometry(radius,length,4,12),mat,x,y,z,parent||group);}
      function bone(a,b,ra,rb,mat,parent){var va=new T.Vector3().fromArray(a),vb=new T.Vector3().fromArray(b),delta=vb.clone().sub(va),mid=va.add(vb).multiplyScalar(.5);var o=mesh(new T.CylinderGeometry(rb,ra,delta.length(),12),mat,mid.x,mid.y,mid.z,parent||group);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
      // Broad shoulders, tapered waist and a shallow chest rather than a cylindrical torso.
      var profile=[[.18,.86],[.17,.98],[.20,1.16],[.235,1.30],[.235,1.36],[.18,1.40],[.075,1.43]].map(function(v){return new T.Vector2(v[0],v[1]);});
      var shirt=mesh(new T.LatheGeometry(profile,24),kit,0,0,0,group);shirt.scale.z=.62;
      capsule(.065,.07,skin,0,1.46,0);
      oval(.112,.148,.105,skin,0,1.64,.006);
      var cap=mesh(new T.SphereGeometry(.116,16,12,0,Math.PI*2,0,1.52),hair,0,1.65,0,group);cap.scale.set(1,1.28,.96);
      oval(.103,.075,.035,hair,0,1.61,-.08);
      for(var sign of [-1,1]){oval(.018,.031,.018,skin,sign*.111,1.63,0);oval(.008,.006,.006,hair,sign*.039,1.665,.099);}
      oval(.019,.027,.027,skin,0,1.628,.108);
      bone([-.073,1.424,.04],[0,1.35,.142],.009,.009,trim);bone([0,1.35,.142],[.073,1.424,.04],.009,.009,trim);
      var limbs=[];
      for(var sign of [-1,1]){
        var arm=new T.Group();arm.position.set(sign*.225,1.345,0);arm.rotation.z=sign*.075;group.add(arm);
        capsule(.086,.09,kit,sign*.015,-.07,0,arm);
        bone([sign*.02,-.15,0],[sign*.035,-.32,.012],.061,.052,skin,arm);oval(.052,.052,.052,skin,sign*.035,-.32,.012,arm);
        bone([sign*.035,-.32,.012],[sign*.015,-.51,.115],.05,.035,skin,arm);oval(.039,.06,.033,skin,sign*.015,-.54,.13,arm);
        var leg=new T.Group();leg.position.set(sign*.105,.88,0);leg.rotation.z=-sign*.025;group.add(leg);
        capsule(.105,.15,shorts,0,-.075,0,leg);capsule(.079,.14,skin,0,-.25,.01,leg);oval(.066,.072,.065,skin,0,-.37,.017,leg);
        capsule(.056,.27,kit,0,-.56,0,leg);bone([0,-.42,0],[0,-.44,0],.058,.058,trim,leg);
        oval(.073,.052,.146,boots,0,-.817,.052,leg);oval(.074,.012,.147,trim,0,-.858,.052,leg);
        mergeRigid(arm);mergeRigid(leg);limbs.push(leg,arm);
      }
      // Small chest number and a large back number make facing direction readable.
      var nc=document.createElement('canvas');nc.width=128;nc.height=160;var ct=nc.getContext('2d');ct.font='700 104px Pretendard, sans-serif';ct.textAlign='center';ct.lineJoin='round';ct.lineWidth=5;ct.strokeStyle='#23313d';ct.fillStyle='#fffdf4';ct.strokeText(String(p.num||'').slice(0,3),64,124);ct.fillText(String(p.num||'').slice(0,3),64,124);
      var nt=texture(nc),nm=new T.MeshBasicMaterial({map:nt,transparent:true,depthWrite:false});resources.add(nm);
      var back=mesh(new T.PlaneGeometry(.25,.30),nm,0,1.18,-.145,group);back.rotation.y=Math.PI;
      mesh(new T.PlaneGeometry(.075,.09),nm,-.082,1.29,.142,group);
      // A chest crest is deliberately different from the number on the back.
      oval(.026,.035,.005,trim,.083,1.29,.143);
      mergeRigid(group);
      var label=document.createElement('span');label.className='pe-player-label';labels.appendChild(label);
      var sc=document.createElement('canvas');sc.width=sc.height=64;var sx=sc.getContext('2d'),sg=sx.createRadialGradient(32,32,4,32,32,32);sg.addColorStop(0,'rgba(24,40,21,.36)');sg.addColorStop(1,'rgba(24,40,21,0)');sx.fillStyle=sg;sx.fillRect(0,0,64,64);
      var shadowMat=new T.MeshBasicMaterial({map:texture(sc),transparent:true,depthWrite:false});resources.add(shadowMat);var shadow=mesh(new T.PlaneGeometry(.9,1.2),shadowMat,0,.021,0);shadow.rotation.x=-Math.PI/2;
      return {group:group,limbs:limbs,kit:kit,label:label,shadow:shadow,number:String(p.num||''),last:null};
    }
    function object(p){var group=new T.Group(),col=material(p.color||'#dfaa4a');scene.add(group);var kind=p.team;
      if(kind==='ball'){
        var bc=document.createElement('canvas');bc.width=512;bc.height=256;var bx=bc.getContext('2d');bx.fillStyle='#f4f2e8';bx.fillRect(0,0,512,256);bx.fillStyle='#26343c';
        for(var row=0;row<3;row++)for(var column=0;column<6;column++){var cx=column*85+(row%2?42:0),cy=32+row*96;bx.beginPath();for(var k=0;k<5;k++){var ang=k*Math.PI*2/5-Math.PI/2;bx.lineTo(cx+Math.cos(ang)*17,cy+Math.sin(ang)*22);}bx.closePath();bx.fill();}
        mesh(new T.SphereGeometry(.115,24,16),material('#ffffff',{map:texture(bc)}),0,.115,0,group);
      }
      else if(/^mini?goal|^goal/.test(kind)){group.add(makeGoal(/^mini/.test(kind)?2:7.32,/^mini/.test(kind)?1.2:2.44,1));}
      else if(kind==='pole'||kind==='flag'){mesh(new T.CylinderGeometry(.035,.04,1.6,8),col,0,.8,0,group);if(kind==='flag')box(.4,.25,.02,col,.2,1.4,0,group);}
      else if(kind==='dummy'){box(.45,1.45,.12,col,0,.74,0,group);mesh(new T.SphereGeometry(.15,10,8),col,0,1.59,0,group);}
      else if(/hurdle/.test(kind)){box(.8,.06,.04,col,0,.5,0,group);for(var side of [-1,1])box(.04,.5,.04,col,side*.4,.25,0,group);}
      else if(kind==='ladder'){for(var j=0;j<7;j++)box(.6,.025,.04,col,0,.02,j*.4-1.2,group);}
      else {var height=kind==='cone'?.32:.06;mesh(new T.ConeGeometry(.16,height,12),col,0,height/2,0,group);}
      return {group:group,kind:kind};
    }
    function update(frame, cam, opts) {
      if(disposed)return;var f=frame.field,sg=JSON.stringify(f);if(signature!==sg){setupField(f);signature=sg;}
      var drawingSig=JSON.stringify([frame.drawings,frame.drawings.some(function(d){return d.tk;})?[frame.players.map(function(p){return [p.key,p.x,p.z];}),frame.ball]:null]);
      if(drawingSig!==lastDrawings){var c=overlay.getContext('2d'),scale=overlay.width/f.len;c.clearRect(0,0,overlay.width,overlay.height);drawMarkings(c,frame,function(x){return (x+f.len/2)*scale;},function(z){return (z+f.wid/2)*scale;},scale);overlayTexture.needsUpdate=true;lastDrawings=drawingSig;}
      var keep=new Set();frame.players.forEach(function(p){keep.add(p.key);var actor=actors.get(p.key);if(actor&&actor.number!==String(p.num||'')){drop(actor.group);drop(actor.shadow);actor.label.remove();actors.delete(p.key);actor=null;}if(!actor){actor=person(p);actors.set(p.key,actor);}actor.kit.color.set(p.color);actor.group.position.set(p.x,0,p.z);actor.group.rotation.y=Math.PI/2-p.body*Math.PI/180;actor.group.visible=p.key!==opts.selected;actor.shadow.position.set(p.x,.021,p.z);actor.shadow.visible=p.key!==opts.selected;var moved=actor.last&&Math.hypot(p.x-actor.last.x,p.z-actor.last.z)>.002;actor.limbs.forEach(function(l,i){l.rotation.x=frame.moving&&moved?Math.sin(opts.time*7)*.22*(i%2?-1:1)*(i<2?1:-1):0;});actor.last={x:p.x,z:p.z};actor.label.textContent=[p.num,p.name||p.pos].filter(Boolean).join(' · ');actor.label.style.borderColor=p.color;});
      actors.forEach(function(actor,key){if(!keep.has(key)){drop(actor.group);drop(actor.shadow);actor.label.remove();actors.delete(key);}});
      var obs=frame.equipment.slice();if(frame.ball)obs.push(Object.assign({},frame.ball,{team:'ball'}));var keys=new Set();obs.forEach(function(p){keys.add(p.key);var ob=objects.get(p.key);if(ob&&ob.kind!==p.team){drop(ob.group);objects.delete(p.key);ob=null;}if(!ob){ob=object(p);objects.set(p.key,ob);}ob.group.position.set(p.x,p.eyeAir||0,p.z);ob.group.rotation.y=-(p.rot||0)*Math.PI/180;});objects.forEach(function(o,k){if(!keys.has(k)){drop(o.group);objects.delete(k);}});
      var w=canvas.clientWidth,h=canvas.clientHeight;if(w<1||h<1)return;
      if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
      camera.aspect=w/h;camera.fov=opts.fov;camera.position.set(cam.x,cam.y,cam.z);camera.lookAt(cam.x+Math.cos(cam.yaw)*20,cam.y+Math.tan(cam.pitch)*20,cam.z+Math.sin(cam.yaw)*20);camera.updateProjectionMatrix();renderer.render(scene,camera);
      var taken=[],vec=new T.Vector3();frame.players.slice().sort(function(a,b){return Math.hypot(a.x-cam.x,a.z-cam.z)-Math.hypot(b.x-cam.x,b.z-cam.z);}).forEach(function(p){var actor=actors.get(p.key);vec.set(p.x,2.04,p.z).project(camera);var x=(vec.x+1)*w/2,y=(1-vec.y)*h/2,rect={x:x-45,y:y-25,w:90,h:25};var visible=opts.names&&p.key!==opts.selected&&vec.z>0&&vec.z<1&&x>38&&x<w-38&&y>28&&y<h-12&&Math.hypot(p.x-cam.x,p.z-cam.z)<42;if(visible&&taken.some(function(r){return rect.x<r.x+r.w&&rect.x+rect.w>r.x&&rect.y<r.y+r.h&&rect.y+rect.h>r.y;}))visible=false;actor.label.hidden=!visible;if(visible){taken.push(rect);actor.label.style.left=x+'px';actor.label.style.top=y+'px';}});
      return 2*Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect)*180/Math.PI;
    }
    function lost(e){e.preventDefault();if(!disposed)onLoss();}canvas.addEventListener('webglcontextlost',lost);
    return {update:update,dispose:function(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lost);resources.forEach(function(r){r.dispose();});resources.clear();labels.replaceChildren();renderer.dispose();renderer.forceContextLoss();actors.clear();objects.clear();scene.clear();}};
  }
  win.PSPlayerEyeRenderer={create:create,drawMap:drawMap};
})(window);
