/* PROCESS STUDIO — 잔디 무늬(깎은 줄) 한 규칙 · 평면과 3D 가 같이 쓴다(3.326).
   사용자 2026-11-19 «3d로 했을 때 잔디 줄무늬 다양하게 할수 있게 해주고 없게도» → 목업(processstudio-문서/UI-작전판-3D-잔디무늬-목업-2026-11-19.html)
   A안 · 평면 · 3D 같이. 예전엔 3D 경기장이 «잔디 줄무늬»(__grassM)를 보지 않고 약 4m 띠를 늘 깔아 «없음»을 골라도 줄이 남았다.
   ① 저장: 보드 값은 그대로 grassM(숫자) 하나 — 무늬마다 번호(CODE). 없음 0 · 띠 5 · 넓은 띠 10 은 옛 값 그대로 읽히고,
      새 무늬(5.1~5.5)는 옛 판 앱에서 열면 약 5m 띠로 보인다(룩 키 · 페이지 복사 · 내 스타일 · 되돌리기가 손대지 않고 따라온다).
   ② 그림: paint(id, kind, g) — <pattern>(또는 원은 반복 radialGradient) 한 개를 글자로. 3D(board-stadium-ground.js mowPlan) ·
      평면 색 피치(.grass-stripes) · 평면 실사 잔디(board-flat-turf.js)가 모두 이것을 쓴다. 띠 수는 골라인→골라인 홀수 — 가운데 띠가 하프라인에 걸친다.
   ③ 화면: 보드 설정 › 운동장 › 바탕의 #grassSeg 를 여덟 칸(작은 그림 + 글자)으로 바꾼다 — 누르면 예전 길(__setGrassM(data-g)) 그대로.
      3D 를 켜 둔 채 바꾸면 경기장 그림을 다시 그린다(redrawGrass 를 감싼다 — 서명은 board-pitch-look.js 가 무늬까지 본다). */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){root.PSBoardMow=api;try{api.install(root);}catch(e){api.err=String(e&&e.message||e);}}})(typeof window!=='undefined'?window:null,function(){
'use strict';
var KINDS=['none','band','wide','check','diag','diamond','ring','lane'];
var CODE={none:0,band:5,wide:10,check:5.1,diag:5.2,diamond:5.3,ring:5.4,lane:5.5};
var LABEL={none:'없음',band:'띠',wide:'넓은 띠',check:'바둑판',diag:'사선',diamond:'다이아',ring:'원',lane:'5레인'};
var TIP={none:'줄 없이 한 색',band:'골라인과 나란한 띠(약 4m)',wide:'굵은 띠(약 9.5m)',check:'띠 위로 한 번 더 가로질러 깎은 칸',diag:'비스듬한 띠',diamond:'사선을 엇갈려 깎은 마름모',ring:'센터 서클에서 퍼지는 동심원',lane:'터치라인과 나란한 다섯 길(측면 · 하프스페이스 · 중앙)'};
/* 5레인 — 68m 폭에서 측면 13.84 · 하프스페이스 11 · 중앙 18.32(골 에어리어 폭) — 전술 구역 «채널»과 같은 경계. 다른 규격은 같은 비율 */
var LANES=[13.84,11,18.32,11,13.84];
function kindOf(m){ m=+m; if(!(m>0))return 'none';
  for(var i=0;i<KINDS.length;i++){var c=CODE[KINDS[i]];if(c>0&&Math.abs(c-m)<1e-6)return KINDS[i];}
  return m>=7.5?'wide':'band'; }   /* 옛 기기 기본값(cs_grass_m)의 다른 숫자 — 넓은 쪽 · 기본 쪽으로 */
function codeOf(k){ return Object.prototype.hasOwnProperty.call(CODE,k)?CODE[k]:CODE.band; }
/* 지금 보드의 무늬. 판이 없으면(노드 시험) 예전 그대로 «띠» */
function kindNow(win){ if(!win)return 'band'; try{ return kindOf(win.__grassM); }catch(_){ return 'none'; } }
function two(k){ return k==='band'||k==='wide'; }   /* 두 색 띠(3D 의 psStGrass · 평면 줄무늬)를 쓰는 무늬 */
function odd(n){ n=Math.max(3,Math.round(n)); return n%2?n:n+1; }
/* 골라인→골라인 띠 수 — 띠는 board-stadium-ground.js bands(약 4m)와 같은 셈 */
function count(k,lenM){ lenM=+lenM>0?+lenM:105; return odd(lenM/(k==='wide'?9.5:k==='check'?7:4)); }
function r1(n){ return Math.round(n*10)/10; }
function op(a){ return String(+(+a).toFixed(4)).replace(/^0\./,'.'); }
function hex(c){ var h=String(c||'').trim().replace('#',''); if(h.length===3)h=h.replace(/./g,function(x){return x+x;}); return /^[0-9a-f]{6}$/i.test(h)?h:''; }
function mix(a,b,t){ var x=hex(a),y=hex(b); if(!x||!y)return a; var o='#';
  for(var i=0;i<6;i+=2){var v=Math.round(parseInt(x.slice(i,i+2),16)*(1-t)+parseInt(y.slice(i,i+2),16)*t);o+=(v<16?'0':'')+v.toString(16);} return o; }
/* g = {x,y: 운동장 모서리(골라인 × 터치라인) · len, wid: 판 단위 길이 · 폭 · lenM: 규격 길이(m) · rot: 0 | 90(여러 운동장 카드 — 골대가 위 · 아래, x · y 는 카드 왼쪽 위)
        dk · lt: [색, 불투명] 어두운 · 밝은 띠 · x2: 바둑판 · 다이아의 한 겹 세기(두 겹이 겹치면 네 톤) · cx · cy: 원의 가운데(없으면 운동장 가운데) · f: 반올림}
   → 무늬 정의 글자(없음이면 빈 무늬 — 이름을 쓰는 곳은 그대로 둔다). 띠 · 넓은 띠는 3.255 · 3.263 의 psStMow 와 같은 글자 */
function paint(id,k,g){
  g=g||{}; var f=g.f||r1,x=+g.x||0,y=+g.y||0,len=+g.len||1050,wid=+g.wid||len*68/105,lenM=+g.lenM>0?+g.lenM:105,m=len/lenM,rot=g.rot===90?90:0;
  var dk=g.dk||['#000',.07],lt=g.lt||['#fff',.06],x2=g.x2==null?.62:+g.x2;
  var R=function(a,b,w,h,c,s){ var o=c[1]*(s==null?1:s); if(!(o>0))return '';
    return '<rect'+(a?' x="'+f(a)+'"':'')+(b?' y="'+f(b)+'"':'')+' width="'+f(w)+'" height="'+f(h)+'" fill="'+c[0]+'" fill-opacity="'+op(o)+'"/>'; };
  var P=function(px,py,w,h,body,deg,cx,cy){ return '<pattern id="'+id+'" patternUnits="userSpaceOnUse" x="'+f(px)+'" y="'+f(py)+'" width="'+f(w)+'" height="'+f(h)+'"'
    +(deg?' patternTransform="rotate('+deg+' '+f(cx)+' '+f(cy)+')"':'')+'>'+body+'</pattern>'; };
  /* 카드(rot 90): 무늬 좌표 x(길이)가 세계 y 로, y(폭)가 세계 -x 로 — 그래서 원점은 카드 오른쪽 위 */
  var ox=rot?x+wid:x,cx=g.cx!=null?+g.cx:x+(rot?wid:len)/2,cy=g.cy!=null?+g.cy:y+(rot?len:wid)/2;
  if(k==='band'||k==='wide'){ var n=count(k,lenM),b=len/n,per=2*b;
    return rot?P(x,y,per,per,R(0,0,per,b,dk)+R(0,b,per,b,lt)):P(x,y,per,per,R(0,0,b,per,dk)+R(b,0,b,per,lt)); }
  if(k==='check'){ var bx=len/count('check',lenM),by=wid/odd(wid/m/7.5);
    return P(ox,y,2*bx,2*by,R(0,0,bx,2*by,dk,x2)+R(bx,0,bx,2*by,lt,x2)+R(0,0,2*bx,by,dk,x2)+R(0,by,2*bx,by,lt,x2),rot,ox,y); }
  if(k==='diamond'){ var s=7*m;
    return P(cx,cy,2*s,2*s,R(0,0,s,2*s,dk,x2)+R(s,0,s,2*s,lt,x2)+R(0,0,2*s,s,dk,x2)+R(0,s,2*s,s,lt,x2),45,cx,cy); }
  if(k==='diag'){ var d=6*m; return P(cx,cy,2*d,2*d,R(0,0,d,2*d,dk)+R(d,0,d,2*d,lt),45+rot,cx,cy); }
  if(k==='ring'){ var w=4.6*m,st=function(o,c){return '<stop offset="'+o+'" stop-color="'+c[0]+'" stop-opacity="'+op(c[1])+'"/>';};
    return '<radialGradient id="'+id+'" gradientUnits="userSpaceOnUse" cx="'+f(cx)+'" cy="'+f(cy)+'" r="'+f(2*w)+'" spreadMethod="repeat">'+st(0,lt)+st('.5',lt)+st('.5',dk)+st(1,dk)+'</radialGradient>'; }
  if(k==='lane'){ var lb=len/count('lane',lenM),tot=LANES.reduce(function(a,v){return a+v;},0),yy=0,body=R(0,0,lb,wid,dk,.28)+R(lb,0,lb,wid,lt,.28);
    LANES.forEach(function(v,i){ var h=wid*v/tot; body+=R(0,yy,2*lb,h,i%2?dk:lt); yy+=h; });
    return P(ox,y,2*lb,wid,body,rot,ox,y); }
  return '<pattern id="'+id+'" patternUnits="userSpaceOnUse" width="1" height="1"/>';
}
/* ── 평면 색 피치의 .grass-stripes(예전 board.html 세 곳의 같은 줄무늬 고리를 한 곳으로) ──
   바탕 ga 한 장 + 무늬(어두운 쪽 gb). 두 색 무늬는 gb 를 그대로, 바둑판 · 다이아는 반씩 겹쳐 네 톤. 운동장 여럿이면 예전처럼 열 수만큼 잘게(판 전체 한 장) */
var NS='http://www.w3.org/2000/svg';
function flat(win,SX){
  var d=win&&win.document,k=kindNow(win); if(!d||k==='none')return null;
  SX=+SX||1600;
  var css=function(n,v){ try{ return (win.getCss&&win.getCss(n))||v; }catch(_){ return v; } };
  var ga=css('--grass-a','#239150'),gb=css('--grass-b','#1b8044');
  var pr=null,sp=null,n=1,Wd=1110,Hd=740;
  try{ pr=win.PR(); }catch(_){ pr=null; } try{ sp=win.pitchSpec(); }catch(_){ sp=null; } try{ n=+win.__getPitchN()||1; }catch(_){ n=1; }
  try{ if(typeof W==='number')Wd=W; if(typeof H==='number')Hd=H; }catch(_){ Wd=1110; Hd=740; }
  if(!pr)pr={L:30,T:30,PW:1050,PH:680,CX:555,CY:370};
  var cols=n>1?Math.min(n,3):1;
  var p=paint('psGrassP',k,{x:pr.L,y:pr.T,len:pr.PW/cols,wid:pr.PH/cols,lenM:(sp&&sp.len)||105,cx:pr.CX,cy:pr.CY,dk:[gb,1],lt:[ga,0],x2:.5});
  var g=d.createElementNS(NS,'g'); g.setAttribute('clip-path','url(#pitchClip)'); g.setAttribute('class','grass-stripes'); g.setAttribute('data-mow',k);
  var box='x="'+(-SX)+'" y="'+(-SX)+'" width="'+(Wd+2*SX)+'" height="'+(Hd+2*SX)+'"';
  g.innerHTML='<defs>'+p+'</defs><rect '+box+' fill="'+ga+'"/><rect '+box+' fill="url(#psGrassP)"/>';
  return g;
}
/* 보드 설정의 여덟 칸 — 작은 그림(22×14) */
function glyph(k){ var o='<svg viewBox="0 0 22 14" width="22" height="14" aria-hidden="true"><rect width="22" height="14" rx="2.5" fill="#3b4566"/>',i,j,W2='<rect fill="#fff" fill-opacity=".38" ';
  if(k==='band')for(i=0;i<22;i+=4)o+=W2+'x="'+i+'" width="2" height="14"/>';
  else if(k==='wide')o+=W2+'width="5.5" height="14"/>'+W2+'x="11" width="5.5" height="14"/>';
  else if(k==='check')for(i=0;i<4;i++)for(j=0;j<3;j++){if((i+j)%2===0)o+=W2+'x="'+(i*5.5)+'" y="'+(j*4.67).toFixed(2)+'" width="5.5" height="4.67"/>';}
  else if(k==='diag')for(i=-14;i<22;i+=5)o+='<path d="M'+i+' 14L'+(i+14)+' 0" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>';
  else if(k==='diamond')for(i=-14;i<22;i+=6)o+='<path d="M'+i+' 14L'+(i+14)+' 0M'+i+' 0L'+(i+14)+' 14" stroke="#fff" stroke-opacity=".32" stroke-width="1.6"/>';
  else if(k==='ring')for(i=2;i<14;i+=3)o+='<circle cx="11" cy="7" r="'+i+'" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1.4"/>';
  else if(k==='lane')o+=W2+'width="22" height="3"/>'+W2+'y="5" width="22" height="4"/>'+W2+'y="11" width="22" height="3"/>';
  return o+'</svg>'; }
/* 보드 설정 창 스킨(board-settings-skin.js)은 id 여섯으로 «여섯 칸 이상 = 세 칸씩»을 박는다 — 여덟로 이긴다 */
var SS='#grassSeg'.repeat(8)+'.ps-mow-seg';
var CSS=SS+'{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:2px!important;height:auto!important}'
  +SS+'>button{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;height:auto!important;min-height:44px!important;min-width:0!important;padding:6px 2px!important;white-space:nowrap;line-height:1.1!important}'
  +SS+'>button svg{display:block;flex:0 0 auto;border-radius:3px}'
  +SS+'>button span{font-size:12px;overflow:hidden;text-overflow:ellipsis;max-width:100%}';
function install(win){
  var d=win.document; if(!d||win.__psBoardMow)return false;
  var seg=d.getElementById('grassSeg');
  if(seg){ seg.classList.add('ps-mow-seg'); seg.setAttribute('aria-label','잔디 무늬');
    seg.innerHTML=KINDS.map(function(k){ return '<button type="button" data-g="'+CODE[k]+'" data-mow="'+k+'" title="'+TIP[k]+'" aria-label="잔디 무늬 '+LABEL[k]+'">'+glyph(k)+'<span>'+LABEL[k]+'</span></button>'; }).join('');
    var lb=seg.parentNode&&seg.parentNode.querySelector('.menulbl'); if(lb&&/줄무늬/.test(lb.textContent))lb.textContent='잔디 무늬';
    if(!d.getElementById('ps-mow-css')){ var s=d.createElement('style'); s.id='ps-mow-css'; s.textContent=CSS; (d.head||d.documentElement).appendChild(s); } }
  win.__psBoardMow=true;
  /* 무늬를 바꾸면(버튼 · 단축키 · 보드 열기 · 되돌리기 — 모두 redrawGrass 를 지난다) 3D 를 켜 둔 화면의 경기장도 다시.
     tiltGoalsSync 는 열쇠(pre · signature — board.html 이 __grassM 을 넣었다)가 같으면 그리지 않는다 */
  var wrap=function(){ var orig=win.redrawGrass; if(typeof orig!=='function'||orig.__psMow)return false;
    var gfn=function(){ var r=orig.apply(this,arguments); try{ if(d.body&&d.body.classList.contains('bc-tilt3d')){ if(typeof win.tiltGoalsSync==='function')win.tiltGoalsSync(); else if(win.__tiltStands)win.__tiltStands(); } }catch(e){ gfn.err=String(e&&e.message||e); } return r; };
    gfn.__psMow=1; win.redrawGrass=gfn; return true; };
  if(!wrap()&&d.readyState==='loading')d.addEventListener('DOMContentLoaded',wrap);
  return true;
}
return {KINDS:KINDS,CODE:CODE,LABEL:LABEL,TIP:TIP,LANES:LANES,kindOf:kindOf,codeOf:codeOf,kindNow:kindNow,two:two,count:count,mix:mix,paint:paint,flat:flat,glyph:glyph,install:install};
});
