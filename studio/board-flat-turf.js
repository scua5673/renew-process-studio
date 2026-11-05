/* PROCESS STUDIO — 평면 잔디(3.263): 잎결 · 실사 잔디 줄.
   ① 잎결 — 사용자 «평면에서도 잔디결 아주 희미하게»(2026-11-05). 3.255 가 3D 경기장에 깐 잎결(PSStadiumGround.grainTile — 고정 시드 · 이음새 없음)을
      평면 «잔디» 피치(html[data-pitch=grass] · 사진 없음 — 실사 잔디를 못 그리는 기기)에 옅게(0.45). 8m 칸, 운동장 여럿이면 카드의 깎는 방향(90°).
      자리: #world 바로 밑 id 없는 rect — 3D 화면(bc-tilt3d) · 3D 영상(_t3BoardCss) · 운동장 사진(ps-custompitch)이 바탕을 숨기는 규칙에 같이 숨는다.
      줄무늬(.grass-stripes) 위 · 비네트 · 라인 아래. 타일은 128(3D 는 256) — 판 SVG 를 그리는 내보내기 · 썸네일마다 실린다.
   ② 실사 잔디 사진 — 사용자 «4m 간격으로» · «가로일 때 세로일 때 다 신경써서». 보드의 «잔디»(@real, #ps-pitchtile · #psRealGrass)는 사진 한 장을
      10m 칸으로 깔았고 세로 판에선 무늬를 90° 더 돌렸다(world 가 이미 돈다 — 사진의 옅은 띠가 터치라인과 나란했다). 이제 칸 = 깎은 줄 한 쌍,
      돌리기는 가로 · 세로가 아니라 운동장 하나(0°) · 여럿(90° — 카드 골대가 위 · 아래 = 세계 y)으로.
      사진 자체의 띠는 아주 옅다(밝기 차 2.6/255) — 평면에서 «줄»처럼 보이던 것은 10m 사진이 되풀이되는 바둑판이었다.
   ③ 깎은 줄 — 3D 의 psStMow · 카드 띠(3.255)를 평면에 더 옅게(어두운 띠 .035 · 밝은 띠 .03, 3D 는 .07 · .06). 띠는 PSStadiumGround.bands
      (골라인→골라인 홀수 개 ≈ 4m — 가운데 띠가 하프라인에 걸치고 두 골라인이 띠 경계), 여러 운동장은 카드마다 제 골라인에서(3D 카드 띠와 같은 둘레).
   저장본에 쓰는 것 없음. board.html 은 <script> 한 줄 — buildPitch · redrawGrass · renderPitchImg · __setPitchN · __psWmPlace(셸이 카드를 그린 뒤 부른다)를 감싼다. */
(function(root,factory){
  var G=(root&&root.PSStadiumGround)||(typeof require==='function'?require('./board-stadium-ground.js'):null);
  var api=factory(G);if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){root.PSFlatTurf=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});else api.install(root);}
})(typeof window!=='undefined'?window:null,function(G){
'use strict';
var NS='http://www.w3.org/2000/svg',PAT='psFlatGrain',OP=0.45,TILE=128;
var f=function(v){return Math.round(v*100)/100;};
/* ── ① 잎결 ── */
function want(o){return !!o&&o.pitch==='grass'&&!o.img;}
/* o = {L,T,mpp(1m), n(운동장 수)} — 칸은 운동장 수와 상관없이 8m(열 수로 줄이면 결이 뭉개져 얼룩만 남았다) */
function plan(o){var n=Math.max(1,+o.n||1);return {x:f(+o.L||0),y:f(+o.T||0),size:f(8*(+o.mpp||10)),rot:n>1?90:0,op:OP};}
/* ── ② 실사 잔디 줄 ──
   o = {L,T,PW(운동장 길이 — 판 단위), len(규격 m), cards:[[x,y,w,h]…](운동장 여럿일 때)}
   → {base:{x,y,size,rot}, cards:[{x,y,size,box}]} — size = 밝은 띠 + 어두운 띠. 운동장 하나는 돌리지 않는다(world 가 가로 · 세로를 돌린다) */
function turfPlan(o){
  var cs=(o.cards&&o.cards.length)?G.cardBands(o.cards,o.len):[];
  if(!cs.length){var band=(+o.PW||1050)/G.bands(o.len);return {base:{x:f(+o.L||0),y:f(+o.T||0),size:f(2*band),rot:0},cards:[]};}
  var c0=cs[0];
  return {base:{x:f(c0.r[0]),y:f(c0.r[1]),size:f(2*c0.band),rot:90},
    cards:cs.map(function(c){return {x:f(c.r[0]),y:f(c.r[1]),size:f(2*c.band),box:c.box.map(f)};})};
}
function read(win){
  var d=win.document,st=null,n=1;
  try{st=(typeof state!=='undefined')?state:null;}catch(_){}
  try{n=win.__getPitchN?(+win.__getPitchN()||1):((st&&st.pitchN)||1);}catch(_){}
  /* board.html 의 const · 함수(window 속성이 아닌 것도 있다) — 이름으로 읽는다 */
  var L0=30,T0=30,M0=10,pr=null,sp=null;
  try{if(typeof L==='number')L0=L;if(typeof T==='number')T0=T;if(typeof MPP==='number')M0=MPP;}catch(_){}
  try{pr=win.PR?win.PR():null;}catch(_){}
  try{sp=win.pitchSpec?win.pitchSpec():null;}catch(_){}
  var cards=[];
  if(n>1){try{cards=[].map.call(d.querySelectorAll('#board #ps-multipitch [data-pitch-rect]'),function(g){return g.getAttribute('data-pitch-rect').split(',').map(Number);});}catch(_){}}
  return {pitch:(d.documentElement.dataset&&d.documentElement.dataset.pitch)||'',img:(st&&st.pitchImg)||'',n:n,L:L0,T:T0,mpp:M0,grassM:+win.__grassM||0,
    pr:pr||{L:L0,T:T0,PW:105*M0},len:(sp&&sp.len)||105,cards:cards};
}
function tile(win){try{return win.PSStadiumGround?(win.PSStadiumGround.grainTile(TILE)||''):'';}catch(_){return '';}}
function mk(d,tag,a){var e=d.createElementNS(NS,tag);for(var k in a)e.setAttribute(k,a[k]);return e;}
function setAll(e,a){for(var k in a){if(a[k]==null)e.removeAttribute(k);else if(e.getAttribute(k)!==String(a[k]))e.setAttribute(k,a[k]);}}
function grainSync(win,o){
  var d=win.document,world=d.getElementById('world');if(!world)return null;
  var rect=world.querySelector(':scope>rect.ps-flat-grain'),defs=world.querySelector(':scope>defs.ps-flat-grain');
  var src=want(o)?tile(win):'';
  if(!src){if(rect)rect.remove();if(defs)defs.remove();return null;}
  var base=null;for(var c=world.firstElementChild;c;c=c.nextElementSibling){if(c.tagName==='rect'&&!c.id&&!c.classList.contains('ps-flat-grain')){base=c;break;}}
  if(!base)return null;
  var p=plan(o);
  if(!defs){defs=mk(d,'defs',{'class':'ps-flat-grain'});var pt=mk(d,'pattern',{id:PAT,patternUnits:'userSpaceOnUse'});pt.appendChild(mk(d,'image',{preserveAspectRatio:'none'}));defs.appendChild(pt);}
  var pat=defs.firstElementChild,im=pat.firstElementChild;
  setAll(pat,{x:p.x,y:p.y,width:p.size,height:p.size,patternTransform:p.rot?'rotate('+p.rot+')':null});
  setAll(im,{width:p.size,height:p.size,href:src});
  if(!rect)rect=mk(d,'rect',{'class':'ps-flat-grain',fill:'url(#'+PAT+')','pointer-events':'none'});
  setAll(rect,{x:base.getAttribute('x'),y:base.getAttribute('y'),width:base.getAttribute('width'),height:base.getAttribute('height'),opacity:p.op});
  /* 줄무늬가 있으면 그 바로 위, 없으면 바탕 바로 위 — 비네트 · 실사 타일(renderPitchImg 가 비네트 앞에 넣는다) · 라인은 그 위 */
  var stripes=world.querySelector(':scope>.grass-stripes'),after=stripes||base;
  if(defs.parentNode!==world||defs.previousElementSibling!==after)world.insertBefore(defs,after.nextSibling);
  if(rect.parentNode!==world||rect.previousElementSibling!==defs)world.insertBefore(rect,defs.nextSibling);
  return {rect:rect,pattern:pat,plan:p};
}
/* 실사 잔디 사진 — 칸(밝은 띠 + 어두운 띠)을 깎은 줄과 같게, 운동장 여럿이면 90°. 사진 자체의 띠는 아주 옅다(밝기 차 2.6/255) — 줄은 ③ 이 만든다 */
function turfSync(win,o){
  var d=win.document,tg=d.getElementById('ps-pitchtile');if(!tg)return null;
  var pat=tg.querySelector('pattern#psRealGrass'),im=pat&&pat.querySelector('image');if(!pat||!im)return null;
  var b=turfPlan({L:o.pr.L,T:o.pr.T,PW:o.pr.PW,len:o.len,cards:o.n>1?o.cards:[]}).base;
  setAll(pat,{x:b.x,y:b.y,width:b.size,height:b.size,patternTransform:b.rot?'rotate(90 '+b.x+' '+b.y+')':null});
  setAll(im,{x:0,y:0,width:b.size,height:b.size});
  return b;
}
/* ③ 깎은 줄 — 3D 의 psStMow · 카드 띠(3.255)를 평면에 더 옅게. 잔디 피치(실사 잔디 포함, 운동장 사진 제외).
   자리: #world 바로 밑 id 없는 rect(3D · 3D 영상 · 운동장 사진이 숨긴다) — 비네트 바로 위, 구역 · 라인 아래 */
var DK=0.035,LT=0.03;
/* 실사 잔디가 아닌 잔디에서 «잔디 줄무늬»(5 · 10m)를 직접 켰으면 그 줄을 쓴다 — 두 겹이 되지 않게 */
function wantMow(o){return !!o&&o.pitch==='grass'&&(o.img==='@real'||(!o.img&&!(o.grassM>0)));}
function mowSync(win,o){
  var d=win.document,world=d.getElementById('world');if(!world)return null;
  var old=world.querySelectorAll(':scope>.ps-flat-mow');
  if(!wantMow(o)){[].forEach.call(old,function(e){e.remove();});return null;}
  var base=null;for(var c=world.firstElementChild;c;c=c.nextElementSibling){if(c.tagName==='rect'&&!c.id&&!c.classList.contains('ps-flat-grain')&&!c.classList.contains('ps-flat-mow')){base=c;break;}}
  if(!base)return null;
  var p=turfPlan({L:o.pr.L,T:o.pr.T,PW:o.pr.PW,len:o.len,cards:o.n>1?o.cards:[]});
  var key=JSON.stringify([p.base,p.cards,base.getAttribute('x'),base.getAttribute('width')]);
  var defs=world.querySelector(':scope>defs.ps-flat-mow');
  if(!defs||defs.getAttribute('data-k')!==key){
    [].forEach.call(old,function(e){e.remove();});
    defs=mk(d,'defs',{'class':'ps-flat-mow','data-k':key});
    var band=function(id,x,y,size,rot){var b=size/2,pt=mk(d,'pattern',{id:id,patternUnits:'userSpaceOnUse',x:x,y:y,width:size,height:size});
      if(rot)pt.setAttribute('patternTransform','rotate(90 '+x+' '+y+')');
      pt.appendChild(mk(d,'rect',{width:f(b),height:size,fill:'#000','fill-opacity':DK}));pt.appendChild(mk(d,'rect',{x:f(b),width:f(b),height:size,fill:'#fff','fill-opacity':LT}));
      defs.appendChild(pt);};
    var rects=[];
    if(!p.cards.length){band('psFlatMow',p.base.x,p.base.y,p.base.size,0);
      rects.push(mk(d,'rect',{'class':'ps-flat-mow',x:base.getAttribute('x'),y:base.getAttribute('y'),width:base.getAttribute('width'),height:base.getAttribute('height'),fill:'url(#psFlatMow)','pointer-events':'none'}));}
    else p.cards.forEach(function(c,i){band('psFlatMowC'+i,c.x,c.y,c.size,90);
      rects.push(mk(d,'rect',{'class':'ps-flat-mow',x:c.box[0],y:c.box[1],width:c.box[2],height:c.box[3],fill:'url(#psFlatMowC'+i+')','pointer-events':'none'}));});
    old=[defs].concat(rects);
  }else old=[].slice.call(old);
  /* 비네트 바로 위(없으면 구역 · 라인 앞) — renderPitchImg 는 사진을 비네트 앞에, redrawGrass 는 줄무늬 · 비네트를 구역 앞에 다시 넣는다 */
  var vig=null;[].some.call(world.children,function(e){if(e.tagName==='rect'&&/grassVig/.test(e.getAttribute('fill')||'')){vig=e;return true;}return false;});
  var anchor=world.querySelector(':scope>#trainGrid')||world.querySelector(':scope>#gridLayer')||world.querySelector(':scope>#lineLayer');
  var prev=vig,ok=true;old.forEach(function(e){if(e.parentNode!==world||(prev&&e.previousElementSibling!==prev))ok=false;prev=e;});
  if(!ok){old.forEach(function(e){if(e.parentNode)e.parentNode.removeChild(e);});
    anchor=vig?vig.nextSibling:anchor;old.forEach(function(e){world.insertBefore(e,anchor||null);});}
  return {plan:p,nodes:old.length};
}
/* 판에 맞춘다 — 그릴 때 · 지울 때 · 자리만 바뀔 때 모두 여기. 판을 그리기 전이면 아무것도 안 한다 */
function sync(win){
  var d=win&&win.document;if(!d||!d.getElementById('world'))return null;
  var o=read(win);
  return {grain:grainSync(win,o),turf:turfSync(win,o),mow:mowSync(win,o)};
}
function install(win){
  if(!win||!win.document||win.__psFlatTurf)return false;
  win.__psFlatTurf=true;
  ['buildPitch','redrawGrass','renderPitchImg','__setPitchN','__psWmPlace'].forEach(function(k){
    var orig=win[k];if(typeof orig!=='function'||orig.__psFlatTurf)return;
    var g=function(){var r=orig.apply(this,arguments);try{sync(win);}catch(_){}return r;};
    g.__psFlatTurf=1;win[k]=g;
  });
  try{sync(win);}catch(_){}
  return true;
}
return {want:want,wantMow:wantMow,plan:plan,turfPlan:turfPlan,sync:sync,install:install,OP:OP,TILE:TILE,DK:DK,LT:LT};
});
