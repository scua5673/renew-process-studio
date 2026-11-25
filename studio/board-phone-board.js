/* PROCESS STUDIO — 3.327 폰보드(사용자 11/18 «폰보드 메뉴를 따로 · 폰에서 만들 수 있게 · 무조건 세로 · 간편하게 · 폰에서만 · 보관함에 저장되는데 폰보드용이라고 표시»
   → 문서 저장소 목업 `UI-폰보드-목업-2026-11-18.html` A안 «아래 메뉴에 새 탭»).
   폰 «보드»는 보기 전용(3.230) 그대로 둔다. 셸의 «폰보드» 탭(board-phone-nav.js)이 작전판 틀에 `phoneBoard` 신호를 보내면 이 모듈이 덮개 `#psPhoneBoard` 를 띄운다.
   · 덮개 안의 작은 편집기는 제 SVG 로 그린다(세로 운동장 · 미터 좌표). 큰 편집기 · 판(state)은 건드리지 않는다.
   · «저장»은 보관함의 원래 길(libTurn → libGet → libWrite + libTouch · stampCreator · editedAt=savedAt, 3.291)로 작전판 하나를 담는다.
     항목: type 'board' · tags ['폰보드'] · phone:{v:1,n}(n = 11 · 8 · 5) · 판 하나(세로 · 잔디 · 번호 표시). 보관함 목록의 «폰보드» 칩은 board.html vaultRow 가 d.phone 을 보고 단다.
   · 다시 고치기는 `editable(d)`(폰보드 · 페이지 하나 · 장면 하나 · 폰보드가 아는 것만 든 판)일 때만 — 아이패드 · 컴퓨터에서 글 · 구역 · 장면을 더한 판은 폰에서 보기만.
     고치면 선수 · 공 · 콘 · 화살만 바꾸고 판 설정 · 토큰의 다른 칸(색 · 사진 …)은 그대로 둔다(`applyEdit`).
   · 쓰던 판은 창 메모리에만(새 저장 키 없음) — 다른 탭에 갔다 와도 그대로, 새로고침하면 사라진다.
   · 3.359 — 큰 작전판과 같은 모습(잔디 · 유니폼 칩 · 큰 작전판의 공 · 화살)과 장면(애니메이션): «＋ 장면» · ▶. 저장은 큰 작전판의 장면 모양(item.frames) 그대로라 아이패드 · 컴퓨터에서도 재생된다.
   · 세로 고정: 폰을 눕히면(screen.orientation) «세로로 돌려 주세요»만 보인다. 키보드가 올라와 창이 납작해지는 것과 가르려고 창 크기가 아니라 기기 방향을 본다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSPhoneBoard=api;api.install(root);}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var TAG='폰보드',NAME_LEN=12,TITLE_LEN=40,MAX_PLAYERS=40,MAX_CONES=40,MAX_LINES=40,HIST=40,MAX_SCENES=12,HOLD=0.6;
  /* 규격 — 미터. 세로로 세운 운동장(가로 w · 세로 h). 우리 팀은 아래에서 위로 */
  var SPECS={
    '11':{n:'11',spec:'fifa',w:68,h:105,box:[40.3,16.5],six:[18.3,5.5],r:9.15,goal:7.3,forms:['4-3-3','4-4-2','3-5-2','']},
    '8':{n:'8',spec:'u12',w:48,h:65,box:[26,11],six:[12,4],r:6,goal:5,forms:['3-3-1','2-4-1','']},
    '5':{n:'5',spec:'futsal',w:20,h:40,box:[15,6],six:null,r:3,goal:3,forms:['1-2-1','2-2','']}
  };
  var FORMS={
    '4-3-3':[[50,94],[14,74],[37,79],[63,79],[86,74],[50,62],[30,52],[70,52],[15,32],[50,26],[85,32]],
    '4-4-2':[[50,94],[14,74],[37,79],[63,79],[86,74],[14,54],[38,58],[62,58],[86,54],[38,30],[62,30]],
    '3-5-2':[[50,94],[25,78],[50,81],[75,78],[10,54],[32,60],[50,50],[68,60],[90,54],[38,30],[62,30]],
    '3-3-1':[[50,94],[20,74],[50,78],[80,74],[20,52],[50,56],[80,52],[50,30]],
    '2-4-1':[[50,94],[33,78],[67,78],[12,54],[38,58],[62,58],[88,54],[50,30]],
    '1-2-1':[[50,93],[50,74],[20,52],[80,52],[50,30]],
    '2-2':[[50,93],[28,72],[72,72],[28,38],[72,38]]
  };
  /* 자리마다 등번호(사용자 11/25 «포지션별로 번호 제대로») — FORMS 의 같은 차례. 위로 공격하므로 x 가 큰 쪽이 오른쪽(RB 2 · LB 3 · RCB 4 · LCB 5 …) */
  var NUMS={
    '4-3-3':[1,3,5,4,2,6,10,8,11,9,7],
    '4-4-2':[1,3,5,4,2,11,6,8,7,10,9],
    '3-5-2':[1,6,5,4,3,10,8,7,2,11,9],
    '3-3-1':[1,3,4,2,11,8,7,9],
    '2-4-1':[1,5,4,11,6,8,7,9],
    '1-2-1':[1,4,11,7,9],
    '2-2':[1,3,2,10,9]
  };
  function slotNum(form,i){var a=NUMS[form];return String(a&&a[i]!=null?a[i]:i+1);}
  /* 새로 놓는 선수 — 그 팀이 아직 안 쓴 가장 작은 번호. 1(골키퍼 색)은 그 팀의 첫 선수일 때만 */
  function freeNum(players,team){var used={},any=false;players.forEach(function(q){if(q.team===team){used[String(q.num)]=1;any=true;}});for(var n=any?2:1;n<100;n++)if(!used[String(n)])return String(n);return '';}
  var KINDS=['run','pass','dribble'],TEAM={us:'blue',op:'red'},SIDE={blue:'us',red:'op'};
  /* 토큰 크기 다섯 단계(사용자 «토큰크기 조절할 수 있게») — 문서의 tok(1~5 · 3 이 처음 값), 보관함 항목엔 phone.tok 과 판의 tokenScale 로 */
  var TOKF=[0.72,0.86,1,1.15,1.3],TOK0=3,TOK_BASE=0.8;
  function tokOf(doc){var t=Math.round(+(doc&&doc.tok));return t>=1&&t<=TOKF.length?t:TOK0;}
  function specOf(n){return SPECS[String(n)]||SPECS['11'];}
  function clean(v,len){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,len||NAME_LEN);}
  function cleanNum(v){return String(v==null?'':v).replace(/[^0-9]/g,'').slice(0,3);}
  function bound(v,a,b){return Math.max(a,Math.min(b,v));}
  function r2(v){return Math.round(v*100)/100;}
  function copy(o){return JSON.parse(JSON.stringify(o));}
  /* 편집기 좌표(미터 · 왼쪽 위가 0,0) ↔ 판의 세계 좌표(가로 운동장 · 1m = 10 — board-quick-depth.js world 와 같은 식) */
  function world(n,x,y){var sp=specOf(n);return {x:Math.round(555+(sp.h/2-y)*10),y:Math.round(370+(x-sp.w/2)*10)};}
  function local(n,X,Y){var sp=specOf(n);return {x:r2(sp.w/2+(Y-370)/10),y:r2(sp.h/2-(X-555)/10)};}
  function inside(n,p){var sp=specOf(n);return {x:r2(bound(+p.x||0,0,sp.w)),y:r2(bound(+p.y||0,0,sp.h))};}

  /* 새 판 — 우리 팀만, 또는 상대도(두 팀을 제 진영으로 좁혀 겹치지 않게) */
  /* opp: 상대 포메이션 이름(없으면 우리 팀만) — true 는 우리와 같은 포메이션 */
  function docNew(n,form,opp){
    var sp=specOf(n),slots=FORMS[form]||[],oslots=opp===true?slots:(FORMS[opp]||[]),withOpp=oslots.length>0,d={n:sp.n,players:[],ball:null,cones:[],lines:[]},id=1;
    slots.forEach(function(s,i){
      var t=withOpp?54+(s[1]-26)*(41/68):s[1];
      d.players.push({id:id++,team:'us',num:slotNum(form,i),name:'',x:r2(sp.w*s[0]/100),y:r2(sp.h*t/100)});
    });
    oslots.forEach(function(s,i){
      var t=100-(54+(s[1]-26)*(41/68));
      d.players.push({id:id++,team:'op',num:slotNum(opp===true?form:opp,i),name:'',x:r2(sp.w*(100-s[0])/100),y:r2(sp.h*t/100)});
    });
    if(slots.length||withOpp)d.ball={x:sp.w/2,y:sp.h/2};
    return d;
  }
  function nextId(doc){var m=0;doc.players.forEach(function(p){if(+p.id>m)m=+p.id;});return m+1;}

  /* ── 판(snap) 만들기 ── prev 가 있으면 그 판의 설정 · 토큰의 다른 칸을 그대로 두고 폰보드가 아는 것만 바꾼다 */
  function snapFor(doc,prev){
    var sp=specOf(doc.n),n=sp.n,s=prev?copy(prev):{pitchSpec:sp.spec,orientation:'v',spFlip:false,area:'full',pitchView:'full',pvSide:'own',fieldMode:'standard',pitchN:1,pitchTheme:'grass',
      lines:true,gridType:'off',label:'num',tokenScale:0.8,tokV:2,tokShape:'circle',chip3d:true,namePos:'below',nameSize:'m',nameStyle:'pill'};
    /* 크기를 고친 판만 큰 작전판의 토큰 크기도 같이(처음 값이면 그 판의 값을 그대로 둔다) */
    if(!prev||doc.tokSet)s.tokenScale=r2(TOK_BASE*TOKF[tokOf(doc)-1]);
    var oldP={},oldE=(prev&&prev.equipment)||[],oldD=(prev&&prev.drawings)||[],eid=1000;
    ((prev&&prev.players)||[]).forEach(function(p){if(p&&p.id!=null)oldP[p.id]=p;});
    s.players=doc.players.slice(0,MAX_PLAYERS).map(function(p){
      var w=world(n,p.x,p.y),o=oldP[p.id]?copy(oldP[p.id]):{id:p.id,team:TEAM[p.team]||'blue',pos:'',color:null};
      o.team=TEAM[p.team]||o.team;o.num=cleanNum(p.num);o.name=clean(p.name);o.x=w.x;o.y=w.y;
      return o;
    });
    s.ball=doc.ball?world(n,doc.ball.x,doc.ball.y):null;
    s.equipment=doc.cones.slice(0,MAX_CONES).map(function(c,i){
      var w=world(n,c.x,c.y),o=oldE[i]?copy(oldE[i]):{team:'cone',color:null,src:null};
      o.id=eid+i;o.team='cone';o.x=w.x;o.y=w.y;return o;
    });
    s.drawings=doc.lines.slice(0,MAX_LINES).map(function(l,i){
      var a=world(n,l.x1,l.y1),b=world(n,l.x2,l.y2),o=(oldD[i]&&oldD[i].type===l.kind)?copy(oldD[i]):{color:'#ffffff',lw:1,op:1};
      o.type=l.kind;o.pts=[a,b];return o;
    });
    return s;
  }
  function today(now){var d=new Date(now||Date.now());return (d.getMonth()+1)+'/'+d.getDate();}
  function title(now){return TAG+' '+today(now);}
  /* ── 장면(애니메이션, 3.359) ── 판의 맨 위 칸(players · ball · cones · lines)은 늘 «지금 장면»이다. 장면이 둘 이상이면 doc.scenes 에 장면마다 같은 칸과
     dur(다음 장면까지 움직이는 초)를 두고 doc.at 이 지금 장면. 선수 · 콘 · 공을 놓거나 지우는 것, 번호 · 이름은 모든 장면에, 옮기기와 화살은 그 장면에만. */
  function dist(ax,ay,bx,by){return Math.sqrt((ax-bx)*(ax-bx)+(ay-by)*(ay-by));}
  function durOf(s){var d=+(s&&s.dur);return d>=0.3&&d<=5?d:1;}
  function sceneOf(doc){return {players:copy(doc.players),ball:doc.ball?copy(doc.ball):null,cones:copy(doc.cones),lines:copy(doc.lines)};}
  function sceneCount(doc){return doc&&doc.scenes?doc.scenes.length:1;}
  function sceneAt(doc){return doc&&doc.scenes?bound(Math.round(+doc.at)||0,0,doc.scenes.length-1):0;}
  function stash(doc){if(!doc.scenes)return doc;var i=sceneAt(doc),s=sceneOf(doc);s.dur=durOf(doc.scenes[i]);doc.scenes[i]=s;doc.at=i;return doc;}
  function pull(doc,i){var s=doc.scenes[i];doc.players=copy(s.players);doc.ball=s.ball?copy(s.ball):null;doc.cones=copy(s.cones);doc.lines=copy(s.lines);doc.at=i;return doc;}
  function sceneGo(doc,i){if(!doc.scenes)return doc;stash(doc);return pull(doc,bound(Math.round(+i)||0,0,doc.scenes.length-1));}
  /* 다음 장면의 처음 모습 — 화살대로 움직인 판(이동 · 드리블 = 화살 시작에 선 선수가 끝으로, 드리블은 공도 같이 · 패스 = 공이 끝으로). 화살은 새 장면에 옮기지 않는다 */
  function advance(doc){
    var sp=specOf(doc.n),s=sceneOf(doc),near=sp.w*0.075,done={};
    doc.lines.forEach(function(l){
      if(l.kind==='pass'){if(s.ball&&dist(s.ball.x,s.ball.y,l.x1,l.y1)<near*1.6)s.ball={x:l.x2,y:l.y2};return;}
      var who=null,bd=near;
      s.players.forEach(function(p){if(done[p.id])return;var d=dist(p.x,p.y,l.x1,l.y1);if(d<bd){bd=d;who=p;}});
      if(!who)return;
      var carry=l.kind==='dribble'&&s.ball&&dist(s.ball.x,s.ball.y,who.x,who.y)<near*1.6,ox=carry?s.ball.x-who.x:0,oy=carry?s.ball.y-who.y:0;
      who.x=l.x2;who.y=l.y2;done[who.id]=1;
      if(carry)s.ball=inside(doc.n,{x:l.x2+ox,y:l.y2+oy});
    });
    s.lines=[];return s;
  }
  function sceneAdd(doc){
    if(sceneCount(doc)>=MAX_SCENES)return false;
    if(!doc.scenes){doc.scenes=[null];doc.at=0;}
    stash(doc);var i=sceneAt(doc),nx=advance(doc);nx.dur=1;
    doc.scenes.splice(i+1,0,nx);pull(doc,i+1);return true;
  }
  function sceneDel(doc){
    if(!doc.scenes||doc.scenes.length<2)return false;
    var i=sceneAt(doc);doc.scenes.splice(i,1);pull(doc,Math.min(i,doc.scenes.length-1));
    if(doc.scenes.length<2){delete doc.scenes;delete doc.at;}
    return true;
  }
  /* 지금 장면 말고 다른 장면들에 같은 일을 */
  function others(doc,fn){if(!doc.scenes)return;var at=sceneAt(doc);doc.scenes.forEach(function(s,i){if(i!==at&&s)fn(s);});}
  function ease(t){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  /* 두 장면 사이(u 0~1) — 큰 작전판의 재생과 같은 규칙: 자리는 곧게, 사라질 화살은 앞 절반에 옅어지고 새 화살은 뒤에서 나타난다 */
  function tween(A,B,u){
    u=bound(+u||0,0,1);
    var o={players:[],ball:null,cones:[],lines:[]},bp={},lp=function(a,b){return r2(a+(b-a)*u);};
    B.players.forEach(function(p){bp[p.id]=p;});
    A.players.forEach(function(p){var q=bp[p.id],c=copy(p);if(q){c.x=lp(p.x,q.x);c.y=lp(p.y,q.y);}o.players.push(c);});
    if(A.ball&&B.ball)o.ball={x:lp(A.ball.x,B.ball.x),y:lp(A.ball.y,B.ball.y)};else o.ball=u<0.5?(A.ball?copy(A.ball):null):(B.ball?copy(B.ball):null);
    A.cones.forEach(function(c,i){var q=B.cones[i];o.cones.push(q?{x:lp(c.x,q.x),y:lp(c.y,q.y)}:copy(c));});
    var kb={};B.lines.forEach(function(l){kb[JSON.stringify(l)]=1;});
    var ka={};A.lines.forEach(function(l){var k=JSON.stringify(l),c=copy(l);ka[k]=1;if(!kb[k])c.op=r2(Math.max(0,1-u/0.5));if(!(c.op<=0))o.lines.push(c);});
    B.lines.forEach(function(l){if(ka[JSON.stringify(l)])return;var c=copy(l);c.op=r2(bound((u-0.25)/0.75,0,1));if(c.op>0)o.lines.push(c);});
    return o;
  }
  /* 저장할 장면 목록(장면마다 판 하나) — 장면이 하나면 그 판 하나 */
  function sceneDocs(doc){
    if(!doc.scenes)return [doc];
    var d=copy(doc);stash(d);
    return d.scenes.map(function(s){return {n:doc.n,tok:doc.tok,tokSet:doc.tokSet,players:s.players,ball:s.ball,cones:s.cones,lines:s.lines,dur:durOf(s)};});
  }
  /* 큰 작전판의 장면 모양 그대로(frames[i] = {snap,dur} · 첫 장면에 머무는 시간 __hold) — 아이패드 · 컴퓨터 · 보관함 보기에서 그대로 재생된다 */
  function framesFor(doc,old,base){
    var list=sceneDocs(doc);if(list.length<2)return null;
    return list.map(function(sd,i){
      var f={snap:snapFor(sd,(old&&old[i]&&old[i].snap)||base||null),dur:sd.dur};
      if(!i){var o0=(old&&old[0])||{};f.__t=o0.__t||'';f.__tc=o0.__tc||'#e23b3b';f.__hold=+o0.__hold>0?+o0.__hold:HOLD;}
      return f;
    });
  }
  function itemFor(doc,name,now){
    now=now||Date.now();
    var fr=framesFor(doc,null,null),it={libId:'V'+now.toString(36)+Math.random().toString(36).slice(2,5),type:'board',name:clean(name,TITLE_LEN)||title(now),folder:'',thumb:'',
      snap:fr?copy(fr[0].snap):snapFor(doc,null),tags:[TAG],savedAt:now,editedAt:now,phone:tokOf(doc)===TOK0?{v:1,n:specOf(doc.n).n}:{v:1,n:specOf(doc.n).n,tok:tokOf(doc)}};
    if(fr)it.frames=fr;
    return it;
  }
  function finite(p){return !!p&&isFinite(+p.x)&&isFinite(+p.y);}
  function okSnap(s,spec){
    if(!s||s.pitchSpec!==spec||!Array.isArray(s.players))return false;
    if(!s.players.every(function(p){return finite(p)&&p.id!=null&&!p.coach&&!!SIDE[p.team];}))return false;
    if(!(s.equipment||[]).every(function(e){return finite(e)&&e.team==='cone';}))return false;
    if(s.ball&&!finite(s.ball))return false;
    return (s.drawings||[]).every(function(g){return !!g&&KINDS.indexOf(g.type)>=0&&Array.isArray(g.pts)&&g.pts.length===2&&finite(g.pts[0])&&finite(g.pts[1])&&!g.tk&&!g.lob;});
  }
  function hasKeys(o){if(!o||typeof o!=='object')return false;for(var k in o)if(Object.prototype.hasOwnProperty.call(o,k))return true;return false;}
  /* 폰에서 다시 고칠 수 있는 판 — 폰보드가 아는 것(선수 두 팀 · 공 · 콘 · 곧은 화살 셋 · 장면)만 들었을 때. 장면마다 선수 · 콘 구성이 같아야 한다 */
  function editable(d){
    if(!d||d.type!=='board'||!d.phone||!SPECS[String(d.phone.n)]||d.book||!d.snap)return false;
    if(d.pages&&d.pages.length>1)return false;
    var spec=SPECS[String(d.phone.n)].spec,fr=Array.isArray(d.frames)&&d.frames.length>1?d.frames:null;
    if(!okSnap(d.snap,spec))return false;
    if(!fr)return true;
    if(fr.length>MAX_SCENES)return false;
    var sig=function(s){return s.players.map(function(p){return String(p.id);}).sort().join(',')+'|'+(s.equipment||[]).length;},first='';
    return fr.every(function(f,i){
      if(!f||!okSnap(f.snap,spec)||hasKeys(f.curves)||f.cap||typeof f.sg==='string'||(f.moveSpeed!=null&&+f.moveSpeed!==1))return false;
      if(!i){first=sig(f.snap);return true;}
      return sig(f.snap)===first;
    });
  }
  function sceneFrom(n,s){
    var o={players:[],ball:null,cones:[],lines:[]};
    s.players.forEach(function(p){var q=inside(n,local(n,+p.x,+p.y));o.players.push({id:p.id,team:SIDE[p.team],num:cleanNum(p.num),name:clean(p.name),x:q.x,y:q.y});});
    if(s.ball)o.ball=inside(n,local(n,+s.ball.x,+s.ball.y));
    (s.equipment||[]).forEach(function(e){o.cones.push(inside(n,local(n,+e.x,+e.y)));});
    (s.drawings||[]).forEach(function(g){var a=inside(n,local(n,+g.pts[0].x,+g.pts[0].y)),b=inside(n,local(n,+g.pts[1].x,+g.pts[1].y));o.lines.push({kind:g.type,x1:a.x,y1:a.y,x2:b.x,y2:b.y});});
    return o;
  }
  function docFrom(d){
    var n=String(d.phone.n),fr=Array.isArray(d.frames)&&d.frames.length>1?d.frames:null,s0=sceneFrom(n,fr?fr[0].snap:d.snap),doc={n:n,players:s0.players,ball:s0.ball,cones:s0.cones,lines:s0.lines};
    if(d.phone.tok!=null&&tokOf({tok:d.phone.tok})!==TOK0)doc.tok=tokOf({tok:d.phone.tok});
    if(fr){doc.scenes=fr.map(function(f){var s=sceneFrom(n,f.snap);s.dur=durOf(f);return s;});doc.at=0;}
    return doc;
  }
  function applyEdit(d,doc,name,now){
    now=now||Date.now();
    var fr=framesFor(doc,d.frames,d.snap),snap=fr?copy(fr[0].snap):snapFor(doc,d.snap);
    d.snap=snap;
    if(fr)d.frames=fr;else if(d.frames&&d.frames.length>1)delete d.frames;else if(d.frames&&d.frames[0])d.frames[0].snap=copy(snap);
    if(doc.tokSet||d.phone.tok!=null){if(tokOf(doc)===TOK0)delete d.phone.tok;else d.phone.tok=tokOf(doc);}
    if(clean(name,TITLE_LEN))d.name=clean(name,TITLE_LEN);
    if(d.pages&&d.pages[0])d.pages[0].snap=copy(snap);
    d.editedAt=d.savedAt=now;
    return d;
  }
  /* 보관함에서 폰보드만 — 새것이 위 */
  function mine(lib){return (Array.isArray(lib)?lib:[]).filter(function(d){return !!d&&d.type==='board'&&(!!d.phone||!!d.quick);}).sort(function(a,b){return (+(b.editedAt||b.savedAt)||0)-(+(a.editedAt||a.savedAt)||0);});}

  /* ── 그리기(순수 — 글을 돌려준다) ── */
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  /* 3.333 — 기본 모양은 3D(사용자 11/19 «폰보드 디자인은 기본 디자인을 3d로 · 토큰도»). 문서 좌표(미터)는 그대로 두고 그릴 때만 원근으로 옮긴다:
     먼 골라인이 K3 배로 좁아지고(직선은 직선으로 남는 사영), 누른 자리는 unproj 로 되돌린다 — 저장 좌표 · 보관함 판은 예전과 같다. */
  var K3=1,H3=0.875,TOP3=0.065;   /* K3 1 = 평면(사용자 «평면이 나을 것 같아 토큰만 3d로») — 1 보다 작으면 먼 쪽이 좁아지는 원근 */
  /* 여백 없이(사용자 «최대한 여백없게»): 가로는 운동장 폭에 맞추고 세로는 화면 칸 비율만큼 늘인다 — sp.vh(편집기가 칸 크기로 정한다 · 없으면 실제 길이). 토큰은 폭 기준이라 둥근 그대로. */
  function vh(sp){return sp.vh>0?sp.vh:sp.h;}
  function proj(sp,x,y){
    var t=y/sp.h,s=K3/(1-(1-K3)*t),f=K3<1?(s-K3)/(1-K3):t;
    return {x:r2(sp.w/2+(x-sp.w/2)*s),y:r2(vh(sp)*(TOP3+H3*f)),s:s};
  }
  function unproj(sp,X,Y){
    var f=((Y/vh(sp))-TOP3)/H3,s=bound(K3+(1-K3)*f,K3*0.8,1.2);
    return {x:sp.w/2+(X-sp.w/2)/s,y:K3<1?sp.h*(1-K3/s)/(1-K3):sp.h*f};
  }
  function pts3(sp,list){return list.map(function(q){var p=proj(sp,q[0],q[1]);return p.x+','+p.y;}).join(' ');}
  /* 3.359 — 큰 작전판과 같은 모습(사용자 11/22 «기존 보드와 최대한 비슷하게 · 운동장만 세로일 뿐 완전 같은 느낌 · 공도 똑같이»):
     잔디 색 · 흰 선 · 골대 · 유니폼 칩 · 이름표 · 화살 셋(이동 = 점선 · 패스 = 실선 · 드리블 = 지그재그) · 콘은 board.html 이 그리는 글자 그대로 옮겼다(토큰은 반지름 21 기준 그림을 줄여 놓는다).
     공은 큰 작전판의 ballSVG()(실사 공)를 그대로 받아 쓴다 — opt.ball. 없으면(시험 · 옛 기기) 단순한 공. */
  var SIDE3=0.03,PITCH='#1b8044',CONE_COL='#ff6a00';
  var COL={us:'#1a2f5c',op:'#d12f38',usGk:'#3aa6dc',opGk:'#d4a017'};
  var FONT='Pretendard,-apple-system,\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif';
  var JERSEY='<g class="phb-jersey"><path fill="{D}" d="M-15.8 -.6C-15.25 3.94 -14.89 8.67 -14.91 14.76A21 21 0 0 1 -20.7 3.54L-15.8 -.6ZM15.8 -.6C15.25 3.94 14.89 8.67 14.91 14.76A21 21 0 0 0 20.7 3.54L15.8 -.6Z"/><path d="M-15.8 -.6C-15.28 3.66 -14.93 8.1 -14.91 13.66M15.8 -.6C15.28 3.66 14.93 8.1 14.91 13.66" fill="none" stroke="#fff" stroke-width="0.7" stroke-opacity=".9"/><path d="M-12.2 6Q-10.4 9.6-11.4 13.4M12.2 6Q10.4 9.6 11.4 13.4" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="0.55" stroke-linecap="round"/><path fill="{F}" d="M-9.4 -18.78C-13.4 -15.6 -15.6 -9.6 -15.8 -.6L-20.7 3.54A21 21 0 0 1 -9.4 -18.78ZM9.4 -18.78C13.4 -15.6 15.6 -9.6 15.8 -.6L20.7 3.54A21 21 0 0 0 9.4 -18.78Z"/><path d="M-14.95 -13.65C-16.42 -10.2 -17.23 -5.83 -17.35 -.63M-17.58 -10.03C-18.28 -7.25 -18.67 -4.1 -18.75 -.67M-20.06 -2.71C-20.11 -2.05 -20.13 -1.38 -20.15 -.7M14.95 -13.65C16.42 -10.2 17.23 -5.83 17.35 -.63M17.58 -10.03C18.28 -7.25 18.67 -4.1 18.75 -.67M20.06 -2.71C20.11 -2.05 20.13 -1.38 20.15 -.7" fill="none" stroke="#fff" stroke-width="0.95"/><path d="M-9.4 -18.78C-13.4 -15.6 -15.6 -9.6 -15.8 -.6M-15.8 -.6L-20.03 2.97M9.4 -18.78C13.4 -15.6 15.6 -9.6 15.8 -.6M15.8 -.6L20.03 2.97" fill="none" stroke="rgba(0,0,0,.34)" stroke-width="0.75"/><path fill="#fff" stroke="rgba(0,0,0,.34)" stroke-width=".5" stroke-linejoin="round" d="M-9.6 -18.68Q0 -7.92 9.6 -18.68A21 21 0 0 0 -9.6 -18.68Z"/><path d="M-7.78 -18.67C-2.59 -13.99 2.59 -13.99 7.78 -18.67" fill="none" stroke="rgba(0,0,0,.24)" stroke-width="0.45"/><path fill="{C}" d="M-7.2 -19.73Q0 -14.27 7.2 -19.73A21 21 0 0 0 -7.2 -19.73Z"/><path fill="rgba(255,255,255,.55)" d="M-1.3 -19.6h2.6v1.2h-2.6Z"/><path fill="#000" fill-opacity=".08" d="M0 -21A21 21 0 0 0 0 21A19 21 0 0 1 0 -21ZM0 -21A21 21 0 0 1 0 21A19 21 0 0 0 0 -21Z"/><path fill="#000" fill-opacity=".08" d="M0 -21A21 21 0 0 0 0 21A16.6 21 0 0 1 0 -21ZM0 -21A21 21 0 0 1 0 21A16.6 21 0 0 0 0 -21Z"/><circle r="21" fill="none" stroke="#fff" stroke-width="2.6"/></g>';
  var CONE='<path d="M0 -14 L9 9 L-9 9 Z" fill="currentColor" stroke="rgba(0,0,0,.4)" stroke-width="1.4"/><rect x="-9.5" y="8.5" width="19" height="3.6" rx="1.6" fill="currentColor"/><rect x="-9.5" y="8.5" width="19" height="3.6" rx="1.6" fill="rgba(0,0,0,.22)"/><rect x="-5.6" y="-2.5" width="11.2" height="3.4" rx="1" fill="rgba(255,255,255,.82)"/>';
  var BALL0='<circle r="13" fill="#fff" stroke="#14161A" stroke-width="1.6"/><path d="M0 -5.6L5.3 -1.7 3.3 4.5H-3.3L-5.3 -1.7Z" fill="#14161A"/><path d="M0 -5.6V-13M5.3 -1.7L12.4 -4M3.3 4.5L7.6 10.5M-3.3 4.5L-7.6 10.5M-5.3 -1.7L-12.4 -4" fill="none" stroke="#14161A" stroke-width="1.3"/>';
  function shade(hex,f){var n=parseInt(String(hex).slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(function(v){return ('0'+Math.round(v*f).toString(16)).slice(-2);}).join('');}
  function r4(v){return Math.round(v*10000)/10000;}
  function pitchSVG(sp){
    var w=sp.w,h=sp.h,b=sp.box,s=sp.six,V=vh(sp),m=r2(w*SIDE3),sw=r2(w/212),o='',i,j;
    var st=' fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="'+sw+'" stroke-linejoin="round" stroke-linecap="round"';
    o+='<defs><radialGradient id="phbGloss" cx="38%" cy="30%" r="70%"><stop offset="0%" stop-color="#fff" stop-opacity=".55"/><stop offset="45%" stop-color="#fff" stop-opacity=".08"/><stop offset="100%" stop-color="#000" stop-opacity=".28"/></radialGradient>'+
      '<radialGradient id="phbVig" cx="50%" cy="50%" r="72%"><stop offset="52%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".2"/></radialGradient></defs>';
    o+='<rect x="'+(-m)+'" y="0" width="'+r2(w+m*2)+'" height="'+r2(V)+'" fill="'+PITCH+'"/><rect x="'+(-m)+'" y="0" width="'+r2(w+m*2)+'" height="'+r2(V)+'" fill="url(#phbVig)"/>';
    o+='<polygon points="'+pts3(sp,[[0,0],[w,0],[w,h],[0,h]])+'"'+st+'/>';
    o+='<polyline points="'+pts3(sp,[[0,h/2],[w,h/2]])+'"'+st+'/>';
    var c=[],dot=function(x,y){var p=proj(sp,x,y);return '<ellipse cx="'+p.x+'" cy="'+p.y+'" rx="'+r2(sw*1.25)+'" ry="'+r2(sw*1.25)+'" fill="#fff" fill-opacity=".9"/>';};
    for(i=0;i<48;i++){var an=i/48*Math.PI*2;c.push([w/2+Math.cos(an)*sp.r,h/2+Math.sin(an)*sp.r]);}
    o+='<polygon points="'+pts3(sp,c)+'"'+st+'/>'+dot(w/2,h/2);
    /* 코너 호 */
    [[0,0,1,1],[w,0,-1,1],[0,h,1,-1],[w,h,-1,-1]].forEach(function(q){var a=[];for(j=0;j<=6;j++){var t=Math.PI/2*j/6;a.push([q[0]+q[2]*Math.cos(t),q[1]+q[3]*Math.sin(t)]);}o+='<polyline points="'+pts3(sp,a)+'"'+st+'/>';});
    [0,1].forEach(function(k){
      var Y=function(d){return k?h-d:d;},x0=(w-b[0])/2,x1=(w+b[0])/2,box;
      if(s)box=[[x0,Y(0)],[x0,Y(b[1])],[x1,Y(b[1])],[x1,Y(0)]];
      else{var rx=Math.min(b[1]*0.9,b[0]/2);box=[[x0,Y(0)],[x0,Y(b[1]-rx)]];
        for(j=1;j<=8;j++){var a1=Math.PI-(Math.PI/2)*j/8;box.push([x0+rx+Math.cos(a1)*rx,Y(b[1]-rx+Math.sin(a1)*rx)]);}
        for(j=0;j<=8;j++){var a2=Math.PI/2-(Math.PI/2)*j/8;box.push([x1-rx+Math.cos(a2)*rx,Y(b[1]-rx+Math.sin(a2)*rx)]);}
        box.push([x1,Y(0)]);}
      o+='<polyline points="'+pts3(sp,box)+'"'+st+'/>';
      if(s){
        o+='<polyline points="'+pts3(sp,[[(w-s[0])/2,Y(0)],[(w-s[0])/2,Y(s[1])],[(w+s[0])/2,Y(s[1])],[(w+s[0])/2,Y(0)]])+'"'+st+'/>';
        /* 페널티 점 · 호(상자 밖 부분만) */
        var pen=r2(b[1]*2/3),half=Math.acos(bound((b[1]-pen)/sp.r,-1,1)),arc=[];
        for(j=0;j<=14;j++){var t2=-half+2*half*j/14;arc.push([w/2+Math.sin(t2)*sp.r,Y(pen+Math.cos(t2)*sp.r)]);}
        o+=dot(w/2,Y(pen))+'<polyline points="'+pts3(sp,arc)+'"'+st+'/>';
      }
      /* 골대 — 큰 작전판의 선 골대: 골라인 밖의 둥근 ㄷ 자 + 옅은 바닥 */
      var g0=(w-sp.goal)/2,g1=(w+sp.goal)/2,gd=bound(sp.goal*0.34,1.4,2.5),gr=gd*0.3,YO=function(d){return k?h+d:-d;},gp=[[g0,YO(0)],[g0,YO(gd-gr)]];
      for(j=1;j<=5;j++){var t3=Math.PI/2*j/5;gp.push([g0+gr-Math.cos(t3)*gr,YO(gd-gr+Math.sin(t3)*gr)]);}
      for(j=0;j<=5;j++){var t4=Math.PI/2*j/5;gp.push([g1-gr+Math.sin(t4)*gr,YO(gd-gr+Math.cos(t4)*gr)]);}
      gp.push([g1,YO(0)]);
      o+='<polygon class="phb-goal" points="'+pts3(sp,gp)+'" fill="#fff" fill-opacity=".12"/><polyline points="'+pts3(sp,gp)+'"'+st+'/>';
    });
    return o;
  }
  function lineSVG(l,sp){
    var S=proj(sp,l.x1,l.y1),E=proj(sp,l.x2,l.y2),dx=E.x-S.x,dy=E.y-S.y,len=Math.sqrt(dx*dx+dy*dy)||1,ux=dx/len,uy=dy/len;
    var sw=r2(sp.w/125),hd=sw*3.7,hw=sw*1.55,body=Math.max(0,len-hd*0.8),d='M'+S.x+' '+S.y,i;
    if(l.kind==='dribble'){
      var n=Math.max(2,Math.floor(body/(sw*1.5))),amp=sw*1.15;
      for(i=1;i<n;i++){var t=body*i/n,a=(i%2?1:-1)*amp;d+='L'+r2(S.x+ux*t-uy*a)+' '+r2(S.y+uy*t+ux*a);}
    }
    d+='L'+r2(S.x+ux*body)+' '+r2(S.y+uy*body);
    var cap=l.kind==='run'?' stroke-linecap="butt" stroke-dasharray="'+r2(sw*2)+' '+r2(sw*1.55)+'"':' stroke-linecap="round"';
    var bx=E.x-ux*hd,by=E.y-uy*hd,px=-uy*hw,py=ux*hw,op=l.op!=null&&l.op<1?' opacity="'+r2(Math.max(0,+l.op||0))+'"':'';
    return '<g class="phb-line"'+op+'><path d="'+d+'" fill="none" stroke="#fff" stroke-width="'+sw+'" stroke-linejoin="round"'+cap+'/>'+
      '<polygon points="'+E.x+','+E.y+' '+r2(bx+px)+','+r2(by+py)+' '+r2(bx-px)+','+r2(by-py)+'" fill="#fff"/></g>';
  }
  function at(P,k,more){return ' transform="translate('+P.x+' '+P.y+') scale('+r4(k)+')'+(more||'')+'"';}
  function nameW(s){var w=17.5;for(var i=0;i<s.length;i++)w+=s.charCodeAt(i)>0x2e7f?18:10.4;return r2(w);}
  /* 선수 = 큰 작전판의 유니폼 칩(그림자 · 원 · 유니폼 · 광택 · 번호 · 이름표). 번호 1 은 골키퍼 색(큰 작전판의 규칙) */
  function tokSVG(p,sp,r0){
    var P=proj(sp,p.x,p.y),gk=p.num==='1',F=COL[(p.team==='us'?'us':'op')+(gk?'Gk':'')],num=esc(p.num);
    var o='<g class="phb-tok" data-id="'+esc(p.id)+'"'+at(P,r0*P.s/21)+'><ellipse cx="3" cy="9" rx="23" ry="18" fill="rgba(0,0,0,.5)"/><circle r="21" fill="'+F+'" stroke="#fff" stroke-width="2.6"/>'+
      JERSEY.replace(/\{F\}/g,F).replace(/\{D\}/g,shade(F,0.84)).replace(/\{C\}/g,shade(F,0.62))+'<circle r="21" fill="url(#phbGloss)"/>'+
      '<text x="0" y="1" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="'+(p.num.length>1?18:22)+'" font-weight="800" font-family="'+FONT+'" stroke="rgba(0,0,0,.5)" stroke-width=".8" paint-order="stroke" stroke-linejoin="round">'+num+'</text>';
    if(p.name){var tw=nameW(p.name);
      o+='<rect x="'+r2(-tw/2)+'" y="34.5" width="'+tw+'" height="27" rx="9" fill="rgba(18,22,30,.88)"/>'+
         '<text x="0" y="48.5" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="18" font-weight="700" font-family="'+FONT+'">'+esc(p.name)+'</text>';}
    return o+'</g>';
  }
  function tokR(doc,sp){return sp.w*0.043*TOKF[tokOf(doc)-1];}
  /* 앞 장면에서 온 길 — 옮긴 선수 · 공의 앞 자리(옅은 고리)와 가는 점선 */
  function ghostSVG(prev,doc,sp){
    if(!prev)return '';
    var o='',r0=tokR(doc,sp),sw=r2(sp.w/300),pp={},min=sp.w*0.02;
    function one(a,b,r){if(!a||!b||dist(a.x,a.y,b.x,b.y)<min)return;var A=proj(sp,a.x,a.y),B=proj(sp,b.x,b.y);
      o+='<line x1="'+A.x+'" y1="'+A.y+'" x2="'+B.x+'" y2="'+B.y+'" stroke="#fff" stroke-opacity=".6" stroke-width="'+sw+'" stroke-dasharray="'+r2(sw*3)+' '+r2(sw*2.4)+'"/>'+
         '<circle cx="'+A.x+'" cy="'+A.y+'" r="'+r2(r)+'" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".55" stroke-width="'+sw+'"/>';}
    prev.players.forEach(function(p){pp[p.id]=p;});
    doc.players.forEach(function(p){one(pp[p.id],p,r0*0.62);});
    one(prev.ball,doc.ball,r0*0.4);
    return o?'<g class="phb-ghost">'+o+'</g>':'';
  }
  function docSVG(doc,sp,opt){
    opt=opt||{};
    var o='<g class="phb-lines">',r0=tokR(doc,sp),all=[];
    doc.lines.forEach(function(l){o+=lineSVG(l,sp);});
    o+='</g>'+ghostSVG(opt.ghost,doc,sp);
    doc.players.forEach(function(p){all.push({y:p.y,k:'p',o:p});});
    all.sort(function(a,b){return a.y-b.y;});
    all=doc.cones.map(function(c,i){return {k:'c',o:c,i:i};}).concat(all);
    if(doc.ball)all.push({k:'b',o:doc.ball});
    all.forEach(function(it){
      var P=proj(sp,it.o.x,it.o.y),k=r0*P.s/21;
      if(it.k==='p')o+=tokSVG(it.o,sp,r0);
      else if(it.k==='c')o+='<g class="phb-cone" data-i="'+it.i+'" style="color:'+CONE_COL+'"'+at(P,k*1.05)+'>'+CONE+'</g>';
      else o+='<g class="phb-ball"'+at(P,k*1.2,opt.roll?' rotate('+r2(opt.roll)+')':'')+'>'+(opt.ball||BALL0)+'</g>';
    });
    return o;
  }
  function segDist(p,l){
    var dx=l.x2-l.x1,dy=l.y2-l.y1,t=((p.x-l.x1)*dx+(p.y-l.y1)*dy)/((dx*dx+dy*dy)||1);t=bound(t,0,1);
    var x=l.x1+dx*t,y=l.y1+dy*t;return Math.sqrt((p.x-x)*(p.x-x)+(p.y-y)*(p.y-y));
  }
  /* 누른 자리에서 가장 가까운 것 — 공 · 선수 · 콘 먼저, 없으면(지우기일 때) 화살 */
  function hit(doc,p,withLines){
    var sp=specOf(doc.n),best=null,bd=sp.w*0.075;
    function chk(o,type,i){var d=Math.sqrt((p.x-o.x)*(p.x-o.x)+(p.y-o.y)*(p.y-o.y));if(d<bd){bd=d;best={type:type,i:i,o:o};}}
    if(doc.ball)chk(doc.ball,'ball',0);
    doc.players.forEach(function(o,i){chk(o,'player',i);});
    doc.cones.forEach(function(o,i){chk(o,'cone',i);});
    if(!best&&withLines){var ld=sp.w*0.05;doc.lines.forEach(function(l,i){var d=segDist(p,l);if(d<ld){ld=d;best={type:'line',i:i};}});}
    return best;
  }

  /* ══ 화면 ══ */
  var CSS='#psPhoneBoard{position:fixed;inset:0;z-index:2147482990;display:flex;flex-direction:column;background:var(--phb-bg);color:var(--phb-ink);font:500 14px/1.5 Pretendard,-apple-system,"Apple SD Gothic Neo",sans-serif;-webkit-text-size-adjust:100%;'+
    '--phb-bg:#F4F5F7;--phb-surface:#fff;--phb-fill:#EEF0F4;--phb-ink:#14213D;--phb-dim:#646A73;--phb-line:#E4E7EC;--phb-act:#14213D;--phb-act-ink:#fff;--phb-soft:#E8ECF5;--phb-mark:#0F6B5C;--phb-mark-soft:#E0F3EE;'+
    '--phb-pitch:#1b8044;--phb-us:#1a2f5c;--phb-op:#d12f38;--phb-cone:#ff6a00;--phb-edge:#14161A;--phb-tag:#0E1422}'+
    'body.fmdark #psPhoneBoard{--phb-bg:#12161D;--phb-surface:#181E28;--phb-fill:#232C38;--phb-ink:#E7EBF1;--phb-dim:#9AA3AF;--phb-line:#2A3341;--phb-act:#8FA6DA;--phb-act-ink:#0F1522;--phb-soft:#22304F;--phb-mark:#7FD6C2;--phb-mark-soft:#17362F}'+
    '#psPhoneBoard[hidden],#psPhoneBoard [hidden]{display:none!important}#psPhoneBoard *{box-sizing:border-box}'+
    '#psPhoneBoard button,#psPhoneBoard input{font:inherit;color:inherit}#psPhoneBoard button{cursor:pointer;-webkit-tap-highlight-color:transparent}'+
    '#psPhoneBoard button:focus-visible,#psPhoneBoard input:focus-visible{outline:2px solid var(--phb-act);outline-offset:2px}'+
    '#psPhoneBoard .phb-scr{flex:1;min-height:0;display:flex;flex-direction:column}'+
    '#psPhoneBoard .phb-bar{flex:none;display:flex;align-items:center;gap:6px;min-height:56px;padding:6px 8px;padding-top:max(6px,env(safe-area-inset-top,0px));background:var(--phb-surface);border-bottom:1px solid var(--phb-line)}'+
    '#psPhoneBoard .phb-h{flex:1;min-width:0;margin:0;padding:0 6px;font-size:20px;font-weight:700;line-height:1.3}'+
    '#psPhoneBoard .phb-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px;display:flex;flex-direction:column;gap:14px}'+
    '#psPhoneBoard .phb-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border:1px solid var(--phb-line);border-radius:10px;background:var(--phb-surface);font-size:14px;font-weight:600;white-space:nowrap}'+
    '#psPhoneBoard .phb-btn:disabled{opacity:.5;cursor:default}'+
    '#psPhoneBoard .phb-pri{background:var(--phb-act);border-color:var(--phb-act);color:var(--phb-act-ink)}'+
    '#psPhoneBoard .phb-big{width:100%;min-height:52px;font-size:16px;font-weight:700}'+
    '#psPhoneBoard .phb-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#psPhoneBoard .phb-two .phb-btn{padding:0 8px}'+
    '#psPhoneBoard .phb-txt{border-color:transparent;background:transparent;padding:0 8px}'+
    '#psPhoneBoard .phb-cap{margin:0;font-size:12px;font-weight:600;color:var(--phb-dim)}'+
    '#psPhoneBoard .phb-rows{display:flex;flex-direction:column;background:var(--phb-surface);border:1px solid var(--phb-line);border-radius:10px;overflow:hidden}'+
    '#psPhoneBoard .phb-row{display:grid;grid-template-columns:42px minmax(0,1fr);gap:12px;align-items:center;width:100%;min-height:64px;padding:10px 12px;border:0;border-top:1px solid var(--phb-line);background:transparent;text-align:left}'+
    '#psPhoneBoard .phb-row:first-child{border-top:0}'+
    '#psPhoneBoard .phb-th{display:block;width:42px;height:60px;border-radius:6px;overflow:hidden;background:var(--phb-pitch)}#psPhoneBoard .phb-th svg{display:block;width:100%;height:100%}'+
    '#psPhoneBoard .phb-nm{display:block;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '#psPhoneBoard .phb-mt{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;color:var(--phb-dim)}'+
    '#psPhoneBoard .phb-chip{display:inline-block;padding:0 8px;border-radius:999px;background:var(--phb-mark-soft);color:var(--phb-mark);font-size:12px;font-weight:700;line-height:20px}'+
    '#psPhoneBoard .phb-blank{margin:0;padding:18px 14px;text-align:center;color:var(--phb-dim)}'+
    '#psPhoneBoard .phb-name{flex:1;width:0;min-width:0;height:44px;border:1px solid transparent;border-radius:10px;background:var(--phb-fill);padding:0 12px;font-size:16px;font-weight:600}'+
    '#psPhoneBoard .phb-ico{flex:none;width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent}#psPhoneBoard .phb-ico:disabled{opacity:.3}'+
    '#psPhoneBoard .phb-ico svg,#psPhoneBoard .phb-tool svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'+
    '#psPhoneBoard .phb-pw{flex:1;min-height:0;position:relative;background:var(--phb-pitch)}'+
    '#psPhoneBoard #phbPitch{position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;user-select:none;-webkit-user-select:none}'+
    '#psPhoneBoard .phb-sub{position:absolute;left:8px;right:8px;bottom:calc(100% + 8px);display:flex;align-items:center;gap:6px;padding:6px;border:1px solid var(--phb-line);border-radius:10px;background:var(--phb-surface);box-shadow:0 6px 18px rgba(16,24,40,.2);overflow-x:auto;transition:opacity .12s}'+
    '#psPhoneBoard .phb-sub:empty{display:none}#psPhoneBoard .phb-sub .phb-opt{flex:1 1 0;justify-content:center;padding:0 8px;border-color:transparent;background:transparent}#psPhoneBoard .phb-sub .phb-opt[aria-pressed="true"]{border-color:transparent;background:var(--phb-act);color:var(--phb-act-ink)}'+
    '#psPhoneBoard.phb-touch .phb-sub{opacity:.1;pointer-events:none}'+
    '#psPhoneBoard .phb-subsize{position:absolute;top:6px;right:6px;z-index:2;gap:4px;padding:3px 3px 3px 10px;border:1px solid var(--phb-line);border-radius:999px;background:var(--phb-surface);box-shadow:0 4px 14px rgba(16,24,40,.22);transition:opacity .12s}#psPhoneBoard .phb-subsize>span{font-size:12px;font-weight:600;color:var(--phb-dim)}#psPhoneBoard .phb-subsize b{min-width:14px}#psPhoneBoard .phb-subsize button{width:40px;height:40px;border-radius:999px}'+
    '#psPhoneBoard.phb-touch .phb-subsize{opacity:.1;pointer-events:none}#psPhoneBoard.phb-playing .phb-subsize{display:none}'+
    '#psPhoneBoard .phb-opt{flex:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border:1px solid var(--phb-line);border-radius:10px;background:var(--phb-surface);font-size:14px;font-weight:600;white-space:nowrap}'+
    '#psPhoneBoard .phb-opt[aria-pressed="true"]{border-color:var(--phb-act);background:var(--phb-soft)}'+
    '#psPhoneBoard .phb-opt i{flex:none;display:block;width:14px;height:14px;border-radius:999px}'+
    '#psPhoneBoard .phb-opt i.us{background:var(--phb-us)}#psPhoneBoard .phb-opt i.op{background:var(--phb-op)}#psPhoneBoard .phb-opt i.bl{background:#fff;border:1.5px solid var(--phb-edge)}#psPhoneBoard .phb-opt i.us,#psPhoneBoard .phb-opt i.op{box-shadow:0 0 0 1.5px #fff,0 0 0 2.5px var(--phb-line)}'+
    '#psPhoneBoard .phb-opt i.cn{background:var(--phb-cone);border-radius:0;clip-path:polygon(50% 0,100% 100%,0 100%)}'+
    '#psPhoneBoard .phb-opt svg{width:30px;height:10px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}'+
    '#psPhoneBoard .phb-hint{font-size:12px;color:var(--phb-dim);padding:0 2px}'+
        '#psPhoneBoard .phb-size{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--phb-dim)}#psPhoneBoard .phb-size b{min-width:18px;text-align:center;color:var(--phb-ink);font-size:14px;font-variant-numeric:tabular-nums}'+
    '#psPhoneBoard .phb-size button{width:44px;height:44px;border:1px solid var(--phb-line);border-radius:12px;background:var(--phb-fill);color:var(--phb-ink);font-size:20px;font-weight:600;line-height:1;padding:0}#psPhoneBoard .phb-size button:disabled{opacity:.35}'+
    '#psPhoneBoard .phb-dock{flex:none;position:relative;z-index:1;background:var(--phb-surface);border-top:1px solid var(--phb-line);box-shadow:0 -6px 18px rgba(16,24,40,.12)}'+
    '#psPhoneBoard .phb-film{display:flex;align-items:center;gap:8px;padding:8px 10px 0}'+
    '#psPhoneBoard .phb-play{flex:none;width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:999px;background:var(--phb-act);color:var(--phb-act-ink);padding:0}#psPhoneBoard .phb-play svg{width:18px;height:18px;fill:currentColor}'+
    '#psPhoneBoard .phb-chips{flex:1;min-width:0;display:flex;align-items:center;gap:6px;overflow-x:auto;padding:3px 1px;scrollbar-width:none}#psPhoneBoard .phb-chips::-webkit-scrollbar{display:none}'+
    '#psPhoneBoard .phb-sc{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:44px;height:44px;padding:0 12px;border:1px solid var(--phb-line);border-radius:10px;background:var(--phb-fill);font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}'+
    '#psPhoneBoard .phb-sc small{font-size:12px;font-weight:600;opacity:.8}'+
    '#psPhoneBoard .phb-sc[aria-pressed="true"]{background:var(--phb-act);border-color:var(--phb-act);color:var(--phb-act-ink)}'+
    '#psPhoneBoard .phb-sc.now{box-shadow:0 0 0 2px var(--phb-surface),0 0 0 4px var(--phb-mark)}'+
    '#psPhoneBoard .phb-add{flex:none;height:44px;padding:0 12px;border:1px dashed var(--phb-dim);border-radius:10px;background:transparent;font-size:14px;font-weight:700;white-space:nowrap}#psPhoneBoard .phb-add:disabled{opacity:.35}'+
    '#psPhoneBoard.phb-playing .phb-sub{display:none}#psPhoneBoard.phb-playing .phb-tools,#psPhoneBoard.phb-playing .phb-add{opacity:.45;pointer-events:none}#psPhoneBoard.phb-playing .phb-chips{pointer-events:none}'+
    '#psPhoneBoard .phb-tools{flex:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:8px 10px 10px}'+
    '#psPhoneBoard .phb-tool{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-height:48px;border:0;border-radius:10px;background:transparent;font-size:12px;font-weight:600;color:var(--phb-dim)}'+
    '#psPhoneBoard .phb-tool[aria-pressed="true"]{background:var(--phb-act);color:var(--phb-act-ink)}'+
    '#psPhoneBoard .phb-shade{position:absolute;inset:0;z-index:5;display:flex;align-items:flex-end;background:rgba(10,14,22,.46)}'+
    '#psPhoneBoard .phb-sheet{width:100%;max-height:88%;overflow-y:auto;display:flex;flex-direction:column;gap:14px;padding:16px 14px 18px;border-radius:10px 10px 0 0;background:var(--phb-surface)}'+
    '#psPhoneBoard .phb-sheet h3{margin:0;font-size:16px;font-weight:700}#psPhoneBoard .phb-sheet p{margin:0}'+
    '#psPhoneBoard .phb-opts{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}'+
    '#psPhoneBoard .phb-fld{display:grid;grid-template-columns:56px minmax(0,1fr);gap:10px;align-items:center}'+
    '#psPhoneBoard .phb-fld input{width:100%;min-width:0;height:44px;border:1px solid var(--phb-line);border-radius:10px;background:var(--phb-surface);padding:0 12px;font-size:16px}'+
    '#psPhoneBoard .phb-end{display:flex;justify-content:space-between;gap:8px}'+
    '#psPhoneBoard .phb-sw{display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px;font-weight:600}#psPhoneBoard .phb-sw input{width:20px;height:20px;accent-color:var(--phb-act)}'+
    '#psPhoneBoard .phb-toast{position:absolute;left:14px;right:14px;bottom:16px;z-index:6;padding:12px 14px;border-radius:10px;background:var(--phb-tag);color:#fff;font-size:14px;font-weight:600;text-align:center}'+
    '#psPhoneBoard .phb-rot{position:absolute;inset:0;z-index:9;display:none;place-items:center;padding:20px;background:var(--phb-surface);font-size:16px;font-weight:700;text-align:center}'+
    '#psPhoneBoard.phb-land .phb-rot{display:grid}';
  /* 보관함 목록의 «폰보드» 칩(board.html vaultRow 가 d.phone 을 보고 단다) — 폰 · 아이패드 · 컴퓨터 모두 */
  var CHIP_CSS='.vcard .vc-phone{display:inline-block;margin-left:6px;padding:0 7px;border-radius:999px;background:#E0F3EE;color:#0F6B5C;font-size:11px;font-weight:700;line-height:18px;vertical-align:1px;white-space:nowrap}'+
    'body.fmdark .vcard .vc-phone{background:#17362F;color:#7FD6C2}';
  var ICON={
    back:'<path d="M15 5l-7 7 7 7"/>',
    undo:'<path d="M9 5L4 10l5 5"/><path d="M4 10h10a5 5 0 0 1 0 10h-3"/>',
    move:'<path d="M6 3.5l12.5 8.2-5.6 1.3-2.7 5.6z" fill="currentColor"/>',
    put:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
    line:'<path d="M5 19L18 6M18 6h-6M18 6v6"/>',
    erase:'<path d="M4 15.5l8.5-9.5 6 5.4-6 6.6H8z"/><path d="M9 10l6 5.4M5 20h14"/>'
  };
  function svgIcon(k){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+ICON[k]+'</svg>';}
  var diag=[];
  function note(e){diag.push(String(e&&e.message||e));if(diag.length>20)diag.shift();return null;}

  function isPhoneView(win){try{return !!(win.psPhoneBoardReadOnly&&win.psPhoneBoardReadOnly());}catch(e){return !!note(e);}}
  function landscape(win){
    try{
      var so=win.screen&&win.screen.orientation;
      if(so&&typeof so.type==='string')return /landscape/.test(so.type);
      if(typeof win.orientation==='number')return Math.abs(win.orientation)===90;
    }catch(e){note(e);}
    return false;
  }

  function make(win){
    var doc=win.document,root=null,toastT=null,G=null;
    var M={scr:'home',list:null,listState:'idle',spec:'11',form:'4-3-3',opp:'',doc:null,editing:null,title:'',tool:'move',put:'us',line:'run',hist:[],dirty:false,saving:false,tokId:0,ask:null,play:null};
    function $(id){return doc.getElementById(id);}
    function gfn(name){try{var f=win[name];return typeof f==='function'?f:null;}catch(e){return note(e);}}
    function tell(on){try{if(win.parent&&win.parent!==win)win.parent.postMessage({source:'board',type:'phoneBoard',on:!!on},win.location.origin);}catch(e){note(e);}}
    function toast(msg){var t=$('phbToast');if(!t)return;t.textContent=msg;t.hidden=false;win.clearTimeout(toastT);toastT=win.setTimeout(function(){t.hidden=true;},2600);}
    function build(){
      var st=doc.createElement('style');st.id='psPhoneBoardCss';st.textContent=CSS;doc.head.appendChild(st);
      root=doc.createElement('div');root.id='psPhoneBoard';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label',TAG);
      root.innerHTML=
        '<div class="phb-scr" id="phbHome"><div class="phb-bar"><h2 class="phb-h">폰보드</h2></div>'+
          '<div class="phb-body"><div class="phb-two"><button type="button" class="phb-btn phb-pri phb-big" data-phb="new">＋ 작전판</button>'+
          '<button type="button" class="phb-btn phb-pri phb-big" data-phb="new-depth">＋ 뎁스 차트</button></div>'+
          '<p class="phb-cap" id="phbCount"></p><div id="phbList"></div></div></div>'+
        '<div class="phb-scr" id="phbEdit" hidden><div class="phb-bar">'+
          '<button type="button" class="phb-ico" data-phb="back" aria-label="나가기">'+svgIcon('back')+'</button>'+
          '<input class="phb-name" id="phbName" type="text" maxlength="'+TITLE_LEN+'" autocomplete="off" aria-label="폰보드 이름">'+
          '<button type="button" class="phb-ico" data-phb="undo" aria-label="되돌리기">'+svgIcon('undo')+'</button>'+
          '<button type="button" class="phb-btn phb-pri" data-phb="save">저장</button></div>'+
          '<div class="phb-pw"><svg id="phbPitch" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="세로 운동장"><g id="phbBg"></g><g id="phbFg"></g></svg>'+
          '<span class="phb-size phb-subsize" id="phbSize" role="group" aria-label="토큰 크기 · 모든 선수"><span>크기</span><button type="button" data-phb="tok" data-v="-1" aria-label="토큰 작게">−</button><b data-phb-tokn></b><button type="button" data-phb="tok" data-v="1" aria-label="토큰 크게">＋</button></span></div>'+
          '<div class="phb-dock"><div class="phb-sub" id="phbSub"></div><div class="phb-film" id="phbFilm"></div><div class="phb-tools" id="phbTools"></div></div></div>'+
        '<div class="phb-shade" id="phbNew" hidden><div class="phb-sheet"><h3>새 작전판</h3>'+
          '<div><p class="phb-cap">인원</p><div class="phb-opts" id="phbSpec"></div></div>'+
          '<div><p class="phb-cap">우리 팀 포메이션</p><div class="phb-opts" id="phbForm"></div></div>'+
          '<div><p class="phb-cap">상대 포메이션</p><div class="phb-opts" id="phbOppForm"></div></div>'+
          '<div class="phb-end"><button type="button" class="phb-btn" data-phb="new-cancel">취소</button><button type="button" class="phb-btn phb-pri" data-phb="new-go">만들기</button></div></div></div>'+
        '<div class="phb-shade" id="phbTok" hidden><div class="phb-sheet"><h3>선수</h3>'+
          '<label class="phb-fld"><span>번호</span><input id="phbNum" type="text" inputmode="numeric" maxlength="3" autocomplete="off"></label>'+
          '<label class="phb-fld"><span>이름</span><input id="phbNm" type="text" maxlength="'+NAME_LEN+'" autocomplete="off"></label>'+
          '<div class="phb-fld"><span>크기</span><span class="phb-size" role="group" aria-label="토큰 크기 · 모든 선수"><button type="button" data-phb="tok" data-v="-1" aria-label="토큰 작게">−</button><b id="phbTokN"></b><button type="button" data-phb="tok" data-v="1" aria-label="토큰 크게">＋</button><span>모든 선수</span></span></div>'+
          '<div class="phb-end"><button type="button" class="phb-btn phb-txt" data-phb="tok-del">이 선수 지우기</button><button type="button" class="phb-btn phb-pri" data-phb="tok-ok">확인</button></div></div></div>'+
        '<div class="phb-shade" id="phbScene" hidden><div class="phb-sheet"><h3 id="phbSceneH"></h3>'+
          '<div id="phbDurBox"><p class="phb-cap">앞 장면에서 여기까지</p><div class="phb-opts" id="phbDur"></div></div>'+
          '<div class="phb-end"><button type="button" class="phb-btn phb-txt" data-phb="scene-del">이 장면 지우기</button><button type="button" class="phb-btn phb-pri" data-phb="scene-ok">확인</button></div></div></div>'+
        '<div class="phb-shade" id="phbAsk" hidden><div class="phb-sheet"><h3>저장하지 않은 판이 있습니다</h3><p class="phb-hint" id="phbAskMsg"></p>'+
          '<div class="phb-end"><button type="button" class="phb-btn" data-phb="ask-drop">버리기</button><button type="button" class="phb-btn phb-pri" data-phb="ask-keep">계속 만들기</button></div></div></div>'+
        '<div class="phb-toast" id="phbToast" role="status" hidden></div>'+
        '<div class="phb-rot"><span>폰보드는 세로로만 씁니다. 폰을 세로로 돌려 주세요.</span></div>';
      doc.body.appendChild(root);
      root.addEventListener('click',onClick);
      var pitch=$('phbPitch');
      pitch.addEventListener('pointerdown',down);pitch.addEventListener('pointermove',move);pitch.addEventListener('pointerup',up);
      pitch.addEventListener('pointercancel',function(){root.classList.remove('phb-touch');if(!G)return;G=null;paint();});
      $('phbName').addEventListener('input',function(){M.title=this.value;M.dirty=true;});
      var turn=function(){root.classList.toggle('phb-land',landscape(win));if(M.scr==='edit'&&M.doc&&!G&&!M.play){fit();paint();}};
      win.addEventListener('orientationchange',turn);win.addEventListener('resize',turn);
      try{if(win.screen&&win.screen.orientation&&win.screen.orientation.addEventListener)win.screen.orientation.addEventListener('change',turn);}catch(e){note(e);}
      turn();
    }
    /* ── 목록 ── */
    function thumbHTML(d){
      var s=win.PSSafe&&typeof win.PSSafe.svg==='function'&&d.thumb?win.PSSafe.svg(d.thumb):'';
      return '<span class="phb-th">'+(s||'')+'</span>';
    }
    function when(d){var t=+(d.editedAt||d.savedAt)||0;return t?new Date(t).toLocaleDateString():'';}
    function renderHome(){
      var box=$('phbList'),cnt=$('phbCount');
      if(M.listState==='loading'&&!M.list){cnt.textContent='';box.innerHTML='<p class="phb-blank">불러오는 중…</p>';return;}
      if(M.listState==='fail'){cnt.textContent='';box.innerHTML='<p class="phb-blank">보관함을 읽지 못했습니다. 로그인되어 있는지 확인해 주세요.</p><button type="button" class="phb-btn phb-big" data-phb="reload">다시 불러오기</button>';return;}
      var list=M.list||[];
      cnt.textContent=list.length?('내 폰보드 '+list.length+'개'):'';
      if(!list.length){box.innerHTML='<p class="phb-blank">아직 없습니다.</p>';return;}
      box.innerHTML='<div class="phb-rows">'+list.map(function(d,i){
        return '<button type="button" class="phb-row" data-phb="open" data-i="'+i+'">'+thumbHTML(d)+'<span><span class="phb-nm">'+esc(d.name||TAG)+'</span>'+
          '<span class="phb-mt"><span class="phb-chip">폰보드</span>'+(d.quick?'<span>뎁스 차트</span>':'')+'<span>'+esc(when(d))+'</span></span></span></button>';
      }).join('')+'</div>';
    }
    function loadList(){
      var get=gfn('libGet');
      if(!get){M.listState='fail';renderHome();return Promise.resolve();}
      M.listState='loading';renderHome();
      return Promise.resolve().then(function(){return get();}).then(function(lib){M.list=mine(lib);M.listState='ok';renderHome();},function(e){note(e);M.listState='fail';renderHome();});
    }
    /* ── 화면 바꾸기 ── */
    function show(scr){M.scr=scr;$('phbHome').hidden=scr!=='home';$('phbEdit').hidden=scr!=='edit';}
    function hideSheets(){['phbNew','phbTok','phbScene','phbAsk'].forEach(function(id){$(id).hidden=true;});}
    function quick(){var Q=win.PSQuickDepth;return Q&&typeof Q.open==='function'?Q:null;}
    /* 뎁스 차트(예전 «빠른 보드», board-quick-depth.js) — 폰보드의 한 종류. 그 창을 이 덮개 위에 띄우고, 저장하면 목록으로 돌아온다 */
    function openQuick(d){
      var Q=quick();if(!Q)return false;
      return Q.open(win,{host:true,item:d||null,say:toast,done:function(saved,edited){show('home');toast(edited?'폰보드를 고쳤습니다':'보관함에 저장했습니다 · 폰보드');loadList();}});
    }
    function renderNew(){
      $('phbSpec').innerHTML=[['11','11인제'],['8','8인제'],['5','풋살']].map(function(x){return '<button type="button" class="phb-opt" data-phb="spec" data-v="'+x[0]+'" aria-pressed="'+(x[0]===M.spec)+'">'+x[1]+'</button>';}).join('');
      var f=specOf(M.spec).forms;if(f.indexOf(M.form)<0)M.form=f[0];
      $('phbForm').innerHTML=f.map(function(k){return '<button type="button" class="phb-opt" data-phb="form" data-v="'+k+'" aria-pressed="'+(k===M.form)+'">'+(k||'빈 판')+'</button>';}).join('');
      if(f.indexOf(M.opp)<0)M.opp='';
      $('phbOppForm').innerHTML=[''].concat(f.filter(Boolean)).map(function(k){return '<button type="button" class="phb-opt" data-phb="opp" data-v="'+k+'" aria-pressed="'+(k===M.opp)+'">'+(k||'없음')+'</button>';}).join('');
    }
    function startEditor(d){
      if(d){M.editing=d.libId;M.doc=docFrom(d);M.title=d.name||'';}
      else{M.editing=null;M.doc=docNew(M.spec,M.form,M.opp);M.title=title();}
      stop(true);M.hist=[];M.tool='move';M.dirty=!d;M.saving=false;
      $('phbName').value=M.title;
      var sb=root.querySelector('[data-phb="save"]');sb.disabled=false;sb.textContent='저장';
      hideSheets();show('edit');renderTools();fit();paint();
    }
    /* 운동장이 칸을 꽉 채우게 — 보이는 칸의 비율로 세로를 정한다(칸이 아직 0 이면 실제 비율) */
    function fit(){
      var sp=specOf(M.doc.n),svg=$('phbPitch'),bx=svg.parentNode,cw=bx.clientWidth,ch=bx.clientHeight,m=r2(sp.w*SIDE3),W=sp.w+m*2;
      sp.vh=(cw>40&&ch>40)?r2(bound(W*ch/cw,sp.h*0.7,sp.h*1.7)):0;
      svg.setAttribute('viewBox',(-m)+' 0 '+W+' '+vh(sp));
      $('phbBg').innerHTML=pitchSVG(sp);
    }
    /* ── 편집 ── */
    function renderTools(){
      var t=[['move','옮기기'],['put','놓기'],['line','화살'],['erase','지우기']];
      $('phbTools').innerHTML=t.map(function(x){return '<button type="button" class="phb-tool" data-phb="tool" data-v="'+x[0]+'" aria-pressed="'+(M.tool===x[0])+'">'+svgIcon(x[0])+'<span>'+x[1]+'</span></button>';}).join('');
      var s;
      if(M.tool==='put')s=[['us','우리','us'],['op','상대','op'],['ball','공','bl'],['cone','콘','cn']].map(function(x){return '<button type="button" class="phb-opt" data-phb="put" data-v="'+x[0]+'" aria-pressed="'+(M.put===x[0])+'"><i class="'+x[2]+'"></i><span>'+x[1]+'</span></button>';}).join('');
      else if(M.tool==='line')s=[['run','이동','M1 5H29" stroke-dasharray="4 3'],['pass','패스','M1 5H29'],['dribble','드리블','M1 5L4 2 8 8 12 2 16 8 20 2 24 8 27 5H29']].map(function(x){return '<button type="button" class="phb-opt" data-phb="line" data-v="'+x[0]+'" aria-pressed="'+(M.line===x[0])+'"><svg viewBox="0 0 30 10" aria-hidden="true"><path d="'+x[2]+'"/></svg><span>'+x[1]+'</span></button>';}).join('');
      else s='';
      $('phbSub').innerHTML=s;tokUI();
      root.querySelector('[data-phb="undo"]').disabled=!M.hist.length;
      renderFilm();
    }
    /* ── 장면 줄 ── ▶ · 장면 칩(지금 장면을 다시 누르면 시간 · 지우기) · ＋ 장면 */
    function renderFilm(){
      var D=M.doc;if(!D)return;
      var n=sceneCount(D),at=sceneAt(D),h='',i;
      for(i=0;i<n;i++)h+='<button type="button" class="phb-sc" data-phb="scene" data-i="'+i+'" aria-pressed="'+(i===at)+'" aria-label="장면 '+(i+1)+'">'+(i+1)+(i===at&&n>1?'<small aria-hidden="true">⋯</small>':'')+'</button>';
      $('phbFilm').innerHTML='<button type="button" class="phb-play" data-phb="play" aria-label="'+(M.play?'정지':'재생')+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+(M.play?'<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>':'<path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l11-6.8a1 1 0 0 0 0-1.8l-11-6.8A1 1 0 0 0 8 5.2z"/>')+'</svg></button>'+
        '<div class="phb-chips" id="phbChips">'+h+'</div><button type="button" class="phb-add" data-phb="scene-add"'+(n>=MAX_SCENES?' disabled':'')+'>＋ 장면</button>';
      var cur=$('phbChips').children[at];
      try{if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:'nearest',inline:'nearest'});}catch(e){note(e);}
    }
    function openScene(){
      var at=sceneAt(M.doc),ps=M.doc.scenes&&M.doc.scenes[at-1];
      $('phbSceneH').textContent='장면 '+(at+1);
      $('phbDurBox').hidden=!ps;
      $('phbDur').innerHTML=ps?[[0.6,'빠르게'],[1,'보통'],[1.6,'천천히']].map(function(x){return '<button type="button" class="phb-opt" data-phb="scene-dur" data-v="'+x[0]+'" aria-pressed="'+(durOf(ps)===x[0])+'">'+x[1]+'</button>';}).join(''):'';
      $('phbScene').hidden=false;
    }
    function dropPlayer(id){
      var keep=function(q){return q.id!==id;};
      M.doc.players=M.doc.players.filter(keep);others(M.doc,function(s){s.players=s.players.filter(keep);});
    }
    /* ── 그리기 ── 바탕(운동장)은 칸 크기가 바뀔 때만, 위(선수 · 공 · 콘 · 화살)는 고칠 때마다. 끌기 · 재생은 자리만 옮긴다 */
    function ballArt(){
      if(M.ballArt==null){var f=gfn('ballSVG'),a='';try{a=f?String(f()||''):'';}catch(e){note(e);}M.ballArt=/^<svg[\s>]/.test(a)?a:'';}
      return M.ballArt;
    }
    function paint(preview,scene){
      var sp=specOf(M.doc.n),D=scene?{n:M.doc.n,tok:M.doc.tok,players:scene.players,ball:scene.ball,cones:scene.cones,lines:scene.lines}:M.doc;
      var at=sceneAt(M.doc),prev=(!scene&&M.doc.scenes&&at>0)?M.doc.scenes[at-1]:null;
      $('phbFg').innerHTML=docSVG(D,sp,{ball:ballArt(),ghost:prev})+(preview?lineSVG(preview,sp):'');
    }
    function setAt(el,o,k,more){
      if(!el||!o)return;var sp=specOf(M.doc.n),P=proj(sp,o.x,o.y);
      el.setAttribute('transform','translate('+P.x+' '+P.y+') scale('+(Math.round(k*P.s*10000)/10000)+')'+(more||''));
    }
    function placeOne(h){
      var fg=$('phbFg'),k=tokR(M.doc,specOf(M.doc.n))/21;
      if(h.type==='player'){var els=fg.querySelectorAll('.phb-tok');for(var i=0;i<els.length;i++)if(els[i].getAttribute('data-id')===String(h.o.id)){setAt(els[i],h.o,k);break;}}
      else if(h.type==='cone')setAt(fg.querySelector('.phb-cone[data-i="'+h.i+'"]'),h.o,k*1.05);
      else setAt(fg.querySelector('.phb-ball'),h.o,k*1.2);
    }
    function place(scene,roll){
      var sp=specOf(M.doc.n),fg=$('phbFg'),k=tokR(M.doc,sp)/21,by={},i;
      scene.players.forEach(function(p){by[String(p.id)]=p;});
      var els=fg.querySelectorAll('.phb-tok');for(i=0;i<els.length;i++)setAt(els[i],by[els[i].getAttribute('data-id')],k);
      var cs=fg.querySelectorAll('.phb-cone');for(i=0;i<cs.length;i++)setAt(cs[i],scene.cones[+cs[i].getAttribute('data-i')],k*1.05);
      setAt(fg.querySelector('.phb-ball'),scene.ball,k*1.2,roll?' rotate('+r2(roll)+')':'');
      var lg=fg.querySelector('.phb-lines');if(lg)lg.innerHTML=scene.lines.map(function(l){return lineSVG(l,sp);}).join('');
    }
    /* ── 재생 ── 첫 장면부터: 머묾(HOLD) → 다음 장면까지 dur 초. 끝나면 고치던 장면으로 돌아온다 */
    function stop(quiet){
      if(!M.play)return;
      try{win.cancelAnimationFrame(M.play.raf);}catch(e){note(e);}
      M.play=null;if(root)root.classList.remove('phb-playing');
      if(!quiet&&M.doc){renderFilm();paint();}
    }
    function play(){
      if(M.play){stop();return;}
      if(sceneCount(M.doc)<2){toast('«＋ 장면»으로 장면을 2개 이상 만들면 재생됩니다');return;}
      stash(M.doc);
      var sc=M.doc.scenes,st={raf:0,s:0,phase:'hold',t0:0,roll:0,bx:null};
      M.play=st;root.classList.add('phb-playing');renderFilm();
      var mark=function(){var c=$('phbChips').children;for(var i=0;i<c.length;i++){c[i].setAttribute('aria-pressed',String(i===st.s));if(i===st.s){try{c[i].scrollIntoView({block:'nearest',inline:'nearest'});}catch(e){note(e);}}}};
      paint(null,sc[0]);mark();
      var tick=function(t){
        if(M.play!==st)return;
        if(!st.t0)st.t0=t;
        var el=t-st.t0;
        if(st.phase==='hold'&&el>=HOLD*1000){if(st.s>=sc.length-1){stop();return;}st.phase='move';st.t0=t;el=0;}
        if(st.phase==='move'){
          var u=Math.min(1,el/(durOf(sc[st.s])*1000)),f=tween(sc[st.s],sc[st.s+1],ease(u));
          if(f.ball){if(st.bx)st.roll+=dist(f.ball.x,f.ball.y,st.bx.x,st.bx.y)*42;st.bx=f.ball;}
          place(f,st.roll);
          if(u>=1){st.s++;st.phase='hold';st.t0=t;mark();}
        }
        st.raf=win.requestAnimationFrame(tick);
      };
      st.raf=win.requestAnimationFrame(tick);
    }
    function snapHist(){M.hist.push(JSON.stringify(M.doc));if(M.hist.length>HIST)M.hist.shift();M.dirty=true;root.querySelector('[data-phb="undo"]').disabled=false;}
    function pt(e){
      var svg=$('phbPitch'),p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
      var q=p.matrixTransform(svg.getScreenCTM().inverse());
      return inside(M.doc.n,unproj(specOf(M.doc.n),q.x,q.y));
    }
    function down(e){
      if(M.saving||M.play)return;
      e.preventDefault();var p=pt(e),D=M.doc;
      try{$('phbPitch').setPointerCapture(e.pointerId);}catch(err){note(err);}
      root.classList.add('phb-touch');
      if(M.tool==='move'){var h=hit(D,p,false);if(h)G={mode:'drag',h:h,sx:e.clientX,sy:e.clientY,ox:h.o.x-p.x,oy:h.o.y-p.y,moved:false};}
      else if(M.tool==='put'){
        if(M.put==='ball'){snapHist();D.ball={x:p.x,y:p.y};others(D,function(s){if(!s.ball)s.ball={x:p.x,y:p.y};});}
        else if(M.put==='cone'){if(D.cones.length>=MAX_CONES){toast('콘은 '+MAX_CONES+'개까지 놓을 수 있습니다');return;}snapHist();D.cones.push({x:p.x,y:p.y});others(D,function(s){s.cones.push({x:p.x,y:p.y});});}
        else{
          if(D.players.length>=MAX_PLAYERS){toast('선수는 '+MAX_PLAYERS+'명까지 놓을 수 있습니다');return;}
          snapHist();
          var np={id:nextId(D),team:M.put,num:freeNum(D.players,M.put),name:'',x:p.x,y:p.y};D.players.push(np);others(D,function(s){s.players.push(copy(np));});
        }
        paint();
      }
      else if(M.tool==='line'){if(D.lines.length>=MAX_LINES){toast('화살은 '+MAX_LINES+'개까지 그릴 수 있습니다');return;}G={mode:'line',x1:p.x,y1:p.y,x2:p.x,y2:p.y};}
      else if(M.tool==='erase'){
        var k=hit(D,p,true);if(!k)return;snapHist();
        if(k.type==='ball'){D.ball=null;others(D,function(s){s.ball=null;});}
        else if(k.type==='player'){dropPlayer(k.o.id);}
        else if(k.type==='cone'){D.cones.splice(k.i,1);others(D,function(s){s.cones.splice(k.i,1);});}
        else D.lines.splice(k.i,1);
        paint();
      }
    }
    function move(e){
      if(!G)return;var p=pt(e),sp=specOf(M.doc.n);
      if(G.mode==='drag'){
        if(!G.moved){if(Math.abs(e.clientX-G.sx)+Math.abs(e.clientY-G.sy)<6)return;G.moved=true;snapHist();}
        G.h.o.x=r2(bound(p.x+G.ox,0,sp.w));G.h.o.y=r2(bound(p.y+G.oy,0,sp.h));placeOne(G.h);
      }else{G.x2=p.x;G.y2=p.y;paint({kind:M.line,x1:G.x1,y1:G.y1,x2:G.x2,y2:G.y2});}
    }
    function up(){
      root.classList.remove('phb-touch');
      if(!G)return;var g=G,sp=specOf(M.doc.n);G=null;
      if(g.mode==='drag'){if(!g.moved&&g.h.type==='player')openTok(g.h.o);else if(g.moved)paint();}
      else{var dx=g.x2-g.x1,dy=g.y2-g.y1;if(Math.sqrt(dx*dx+dy*dy)>sp.w*0.06){snapHist();M.doc.lines.push({kind:M.line,x1:g.x1,y1:g.y1,x2:g.x2,y2:g.y2});}paint();}
    }
    function tokUI(){if(!M.doc)return;var tk=tokOf(M.doc);root.querySelectorAll('[data-phb="tok"]').forEach(function(b){b.disabled=(+b.getAttribute('data-v')<0)?tk<=1:tk>=TOKF.length;});$('phbTokN').textContent=tk;root.querySelectorAll('[data-phb-tokn]').forEach(function(n){n.textContent=tk;});}
    function openTok(p){M.tokId=p.id;$('phbNum').value=p.num;$('phbNm').value=p.name;tokUI();$('phbTok').hidden=false;}
    function tokCur(){return M.doc.players.filter(function(p){return p.id===M.tokId;})[0];}
    /* ── 저장 ── */
    function canWrite(){
      try{if(doc.body.classList.contains('ps-viewonly')){toast('보기 권한이라 보관함에 담을 수 없어요');return false;}}catch(e){note(e);}
      var need=gfn('psVaultRequireLogin');
      try{if(need&&!need())return false;}catch(e){note(e);return false;}
      return !!(gfn('libTurn')&&gfn('libGet')&&gfn('libWrite'));
    }
    function thumb(snap){try{var th=win.__snapToThumb;return typeof th==='function'?(th(snap)||''):'';}catch(e){note(e);return '';}}
    function save(){
      if(M.saving)return;
      var D=M.doc;
      if(!D.players.length&&!D.cones.length&&!D.lines.length&&!D.ball){toast('판에 선수나 콘을 하나 이상 놓아 주세요');return;}
      if(!canWrite())return;
      M.saving=true;var btn=root.querySelector('[data-phb="save"]');btn.disabled=true;btn.textContent='저장 중…';
      var editId=M.editing,docNow=copy(D),name=$('phbName').value,turn=gfn('libTurn'),get=gfn('libGet'),write=gfn('libWrite'),can=gfn('canEditItem'),stamp=gfn('stampCreator'),touch=gfn('libTouch');
      turn(function(){return get().then(function(lib){
        if(editId){
          var d=null;for(var i=0;i<lib.length;i++){if(lib[i]&&lib[i].libId===editId){d=lib[i];break;}}
          if(!d||!editable(d))throw Object.assign(Error('gone'),{psPhone:'gone'});
          if(can&&!can(d))throw Object.assign(Error('owner'),{psPhone:'owner'});
          applyEdit(d,docNow,name,0);d.thumb=thumb(d.snap);if(d.pages&&d.pages[0])d.pages[0].thumb=d.thumb;
        }else{
          var it=itemFor(docNow,name,0);it.thumb=thumb(it.snap);
          try{if(stamp)stamp(it);}catch(e){note(e);}
          lib.unshift(it);
        }
        return write(lib).then(function(){if(touch)touch();});
      });}).then(function(){
        M.saving=false;M.doc=null;M.editing=null;M.dirty=false;M.hist=[];
        show('home');toast(editId?'폰보드를 고쳤습니다':'보관함에 저장했습니다 · 폰보드');
        var redraw=gfn('renderDrillFiles');try{if(redraw)redraw();}catch(e){note(e);}
        loadList();
      },function(e){
        note(e);M.saving=false;btn.disabled=false;btn.textContent='저장';
        toast(e&&e.psVaultLocked?'보관함을 쓰려면 먼저 로그인해 주세요':(e&&e.psPhone==='gone'?'이 판을 보관함에서 찾지 못했습니다. 지워졌거나 아이패드 · 컴퓨터에서 바뀌었습니다':(e&&e.psPhone==='owner'?'만든 사람만 고칠 수 있습니다':'저장하지 못했습니다. 판은 그대로 있습니다. 다시 눌러 주세요')));
      });
    }
    /* ── 단추 ── */
    function openItem(d){
      var can=gfn('canEditItem'),Q=quick(),ok=d.quick?!!(Q&&Q.editable(d)):editable(d);
      if(ok&&(!can||can(d))){if(d.quick){if(openQuick(d))return;}else{startEditor(d);return;}}
      /* 폰에서 못 고치는 판(다른 기기에서 더 손봤거나 남이 만든 것)은 보관함 보기로 */
      var view=win.__vaultOpenView;
      if(typeof view!=='function'){toast('이 판은 아이패드 · 컴퓨터에서 열어 주세요');return;}
      close();
      try{view(d);}catch(e){note(e);}
      var say=gfn('toast');if(say)say(ok?'만든 사람만 고칠 수 있습니다. 보기로 열었습니다':'아이패드 · 컴퓨터에서 손본 판이라 폰에서는 보기만 됩니다');
    }
    function leaveEditor(){
      if(M.dirty&&M.doc){$('phbAskMsg').textContent='«버리기»를 누르면 이 판은 사라져요.';M.ask='leave';$('phbAsk').hidden=false;return;}
      M.doc=null;M.editing=null;show('home');
    }
    function onClick(e){
      var b=e.target.closest&&e.target.closest('[data-phb]');
      if(!b){if(e.target.classList&&e.target.classList.contains('phb-shade')&&e.target.id!=='phbAsk')e.target.hidden=true;return;}
      var k=b.getAttribute('data-phb'),v=b.getAttribute('data-v');
      if(k==='new'){renderNew();$('phbNew').hidden=false;}
      else if(k==='new-cancel')$('phbNew').hidden=true;
      else if(k==='spec'){M.spec=v;renderNew();}
      else if(k==='form'){M.form=v;renderNew();}
      else if(k==='opp'){M.opp=v;renderNew();}
      else if(k==='new-depth'){if(!openQuick(null))toast('뎁스 차트를 열지 못했습니다. 잠시 뒤 다시 눌러 주세요');}
      else if(k==='new-go')startEditor(null);
      else if(k==='reload')loadList();
      else if(k==='open'){var d=(M.list||[])[+b.getAttribute('data-i')];if(d)openItem(d);}
      else if(k==='back'){stop();leaveEditor();}
      else if(k==='tok'){var nt=bound(tokOf(M.doc)+(+v||0),1,TOKF.length);if(nt!==tokOf(M.doc)){snapHist();M.doc.tok=nt;M.doc.tokSet=true;tokUI();paint();}}
      else if(k==='undo'){if(M.hist.length){stop(true);M.doc=JSON.parse(M.hist.pop());renderTools();paint();}}
      else if(k==='save'){stop();save();}
      else if(k==='tool'){M.tool=v;renderTools();}
      else if(k==='put'){M.put=v;renderTools();}
      else if(k==='line'){M.line=v;renderTools();}
      else if(k==='tok-ok'){
        var p=tokCur(),n=cleanNum($('phbNum').value),nm=clean($('phbNm').value);
        if(p&&(p.num!==n||p.name!==nm)){snapHist();p.num=n;p.name=nm;others(M.doc,function(s){s.players.forEach(function(q){if(q.id===p.id){q.num=n;q.name=nm;}});});}
        $('phbTok').hidden=true;paint();
      }
      else if(k==='tok-del'){var q=tokCur();if(q){snapHist();dropPlayer(q.id);}$('phbTok').hidden=true;paint();}
      else if(k==='ask-drop'){$('phbAsk').hidden=true;M.doc=null;M.editing=null;M.dirty=false;show('home');}
      else if(k==='ask-keep')$('phbAsk').hidden=true;
      else if(k==='play')play();
      else if(k==='scene'){var si=+b.getAttribute('data-i');if(si===sceneAt(M.doc)){if(sceneCount(M.doc)>1)openScene();}else{sceneGo(M.doc,si);renderFilm();paint();}}
      else if(k==='scene-add'){
        if(sceneCount(M.doc)>=MAX_SCENES){toast('장면은 '+MAX_SCENES+'개까지 만들 수 있습니다');return;}
        snapHist();sceneAdd(M.doc);renderFilm();paint();
      }
      else if(k==='scene-dur'){var ps=M.doc.scenes&&M.doc.scenes[sceneAt(M.doc)-1];if(ps&&durOf(ps)!==+v){snapHist();ps.dur=+v;}openScene();}
      else if(k==='scene-del'){$('phbScene').hidden=true;if(sceneCount(M.doc)>1){snapHist();sceneDel(M.doc);renderFilm();paint();}}
      else if(k==='scene-ok')$('phbScene').hidden=true;
    }
    /* ── 열기 · 닫기 ── 쓰던 판(M.doc)은 닫아도 남는다 */
    function open(){
      if(!isPhoneView(win))return false;
      if(!root)build();
      if(!root.hidden)return true;
      root.hidden=false;doc.body.classList.add('ps-phoneboard-on');root.classList.toggle('phb-land',landscape(win));
      hideSheets();root.querySelector('[data-phb="new-depth"]').hidden=!quick();
      if(M.doc)show('edit');else{show('home');loadList();}
      tell(true);
      return true;
    }
    function close(){
      if(!root||root.hidden)return;
      G=null;stop(true);root.hidden=true;doc.body.classList.remove('ps-phoneboard-on');tell(false);
    }
    return {open:open,close:close,isOpen:function(){return !!root&&!root.hidden;},model:function(){return M;},diag:function(){return diag.slice();}};
  }

  function install(win){
    if(!win||!win.document)return null;
    if(win.__psPhoneBoard)return win.__psPhoneBoard;
    var ui=null;
    function get(){if(!ui)ui=make(win);return ui;}
    var api={open:function(){return get().open();},close:function(){if(ui)ui.close();},isOpen:function(){return !!ui&&ui.isOpen();},ui:function(){return ui;}};
    win.__psPhoneBoard=api;
    /* 셸의 «폰보드» 탭이 보내는 신호 — 같은 출처의 부모 창만 */
    win.addEventListener('message',function(e){
      var d=e.data;
      if(!d||d.source!=='app'||d.type!=='phoneBoard'||e.source!==win.parent||e.origin!==win.location.origin)return;
      if(d.cmd==='open')api.open();else if(d.cmd==='close')api.close();
    });
    /* 틀이 다시 읽힌 뒤에도(폭이 바뀌면 셸이 작전판을 다시 읽는다) 탭이 켜져 있으면 다시 연다 */
    function chipCss(){var d=win.document;if(d.getElementById('psPhoneChipCss')||!d.head)return;var st=d.createElement('style');st.id='psPhoneChipCss';st.textContent=CHIP_CSS;d.head.appendChild(st);}
    function resume(){chipCss();try{if(win.parent&&win.parent!==win&&win.parent.__psPhoneBoardWant)api.open();}catch(e){note(e);}}
    if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',resume);else resume();
    return api;
  }
  function open(win){win=win||(typeof window!=='undefined'?window:null);var q=win&&(win.__psPhoneBoard||install(win));return q?q.open():false;}

  return {TAG:TAG,SPECS:SPECS,FORMS:FORMS,NUMS:NUMS,slotNum:slotNum,freeNum:freeNum,world:world,local:local,docNew:docNew,snapFor:snapFor,itemFor:itemFor,editable:editable,docFrom:docFrom,applyEdit:applyEdit,mine:mine,
    hit:hit,tokOf:tokOf,TOKF:TOKF,proj:proj,unproj:unproj,pitchSVG:pitchSVG,docSVG:docSVG,lineSVG:lineSVG,ghostSVG:ghostSVG,
    MAX_SCENES:MAX_SCENES,sceneCount:sceneCount,sceneAt:sceneAt,sceneGo:sceneGo,sceneAdd:sceneAdd,sceneDel:sceneDel,advance:advance,tween:tween,ease:ease,framesFor:framesFor,landscape:landscape,title:title,install:install,open:open};
});
