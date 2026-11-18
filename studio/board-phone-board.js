/* PROCESS STUDIO — 3.322 폰보드(사용자 11/18 «폰보드 메뉴를 따로 · 폰에서 만들 수 있게 · 무조건 세로 · 간편하게 · 폰에서만 · 보관함에 저장되는데 폰보드용이라고 표시»
   → 문서 저장소 목업 `UI-폰보드-목업-2026-11-18.html` A안 «아래 메뉴에 새 탭»).
   폰 «보드»는 보기 전용(3.230) 그대로 둔다. 셸의 «폰보드» 탭(board-phone-nav.js)이 작전판 틀에 `phoneBoard` 신호를 보내면 이 모듈이 덮개 `#psPhoneBoard` 를 띄운다.
   · 덮개 안의 작은 편집기는 제 SVG 로 그린다(세로 운동장 · 미터 좌표). 큰 편집기 · 판(state)은 건드리지 않는다.
   · «저장»은 보관함의 원래 길(libTurn → libGet → libWrite + libTouch · stampCreator · editedAt=savedAt, 3.291)로 작전판 하나를 담는다.
     항목: type 'board' · tags ['폰보드'] · phone:{v:1,n}(n = 11 · 8 · 5) · 판 하나(세로 · 잔디 · 번호 표시). 보관함 목록의 «폰보드» 칩은 board.html vaultRow 가 d.phone 을 보고 단다.
   · 다시 고치기는 `editable(d)`(폰보드 · 페이지 하나 · 장면 하나 · 폰보드가 아는 것만 든 판)일 때만 — 아이패드 · 컴퓨터에서 글 · 구역 · 장면을 더한 판은 폰에서 보기만.
     고치면 선수 · 공 · 콘 · 화살만 바꾸고 판 설정 · 토큰의 다른 칸(색 · 사진 …)은 그대로 둔다(`applyEdit`).
   · 쓰던 판은 창 메모리에만(새 저장 키 없음) — 다른 탭에 갔다 와도 그대로, 새로고침하면 사라진다.
   · 세로 고정: 폰을 눕히면(screen.orientation) «세로로 돌려 주세요»만 보인다. 키보드가 올라와 창이 납작해지는 것과 가르려고 창 크기가 아니라 기기 방향을 본다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSPhoneBoard=api;api.install(root);}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var TAG='폰보드',NAME_LEN=12,TITLE_LEN=40,MAX_PLAYERS=40,MAX_CONES=40,MAX_LINES=40,HIST=40;
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
  var KINDS=['run','pass','dribble'],TEAM={us:'blue',op:'red'},SIDE={blue:'us',red:'op'};
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
      d.players.push({id:id++,team:'us',num:String(i+1),name:'',x:r2(sp.w*s[0]/100),y:r2(sp.h*t/100)});
    });
    oslots.forEach(function(s,i){
      var t=100-(54+(s[1]-26)*(41/68));
      d.players.push({id:id++,team:'op',num:String(i+1),name:'',x:r2(sp.w*(100-s[0])/100),y:r2(sp.h*t/100)});
    });
    if(slots.length||withOpp)d.ball={x:sp.w/2,y:sp.h/2};
    return d;
  }
  function nextId(doc){var m=0;doc.players.forEach(function(p){if(+p.id>m)m=+p.id;});return m+1;}

  /* ── 판(snap) 만들기 ── prev 가 있으면 그 판의 설정 · 토큰의 다른 칸을 그대로 두고 폰보드가 아는 것만 바꾼다 */
  function snapFor(doc,prev){
    var sp=specOf(doc.n),n=sp.n,s=prev?copy(prev):{pitchSpec:sp.spec,orientation:'v',spFlip:false,area:'full',pitchView:'full',pvSide:'own',fieldMode:'standard',pitchN:1,pitchTheme:'grass',
      lines:true,gridType:'off',label:'num',tokenScale:0.8,tokV:2,tokShape:'circle',namePos:'below',nameSize:'m',nameStyle:'pill'};
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
  function itemFor(doc,name,now){
    now=now||Date.now();
    return {libId:'V'+now.toString(36)+Math.random().toString(36).slice(2,5),type:'board',name:clean(name,TITLE_LEN)||title(now),folder:'',thumb:'',
      snap:snapFor(doc,null),tags:[TAG],savedAt:now,editedAt:now,phone:{v:1,n:specOf(doc.n).n}};
  }
  function finite(p){return !!p&&isFinite(+p.x)&&isFinite(+p.y);}
  /* 폰에서 다시 고칠 수 있는 판 — 폰보드가 아는 것(선수 두 팀 · 공 · 콘 · 곧은 화살 셋)만 들었을 때 */
  function editable(d){
    if(!d||d.type!=='board'||!d.phone||!SPECS[String(d.phone.n)]||d.book||!d.snap)return false;
    if((d.pages&&d.pages.length>1)||(d.frames&&d.frames.length>1))return false;
    var s=d.snap;
    if(s.pitchSpec!==SPECS[String(d.phone.n)].spec||!Array.isArray(s.players))return false;
    if(!s.players.every(function(p){return finite(p)&&p.id!=null&&!p.coach&&!!SIDE[p.team];}))return false;
    if(!(s.equipment||[]).every(function(e){return finite(e)&&e.team==='cone';}))return false;
    if(s.ball&&!finite(s.ball))return false;
    return (s.drawings||[]).every(function(g){return !!g&&KINDS.indexOf(g.type)>=0&&Array.isArray(g.pts)&&g.pts.length===2&&finite(g.pts[0])&&finite(g.pts[1])&&!g.tk&&!g.lob;});
  }
  function docFrom(d){
    var n=String(d.phone.n),s=d.snap,doc={n:n,players:[],ball:null,cones:[],lines:[]};
    s.players.forEach(function(p){var q=inside(n,local(n,+p.x,+p.y));doc.players.push({id:p.id,team:SIDE[p.team],num:cleanNum(p.num),name:clean(p.name),x:q.x,y:q.y});});
    if(s.ball)doc.ball=inside(n,local(n,+s.ball.x,+s.ball.y));
    (s.equipment||[]).forEach(function(e){doc.cones.push(inside(n,local(n,+e.x,+e.y)));});
    (s.drawings||[]).forEach(function(g){var a=inside(n,local(n,+g.pts[0].x,+g.pts[0].y)),b=inside(n,local(n,+g.pts[1].x,+g.pts[1].y));doc.lines.push({kind:g.type,x1:a.x,y1:a.y,x2:b.x,y2:b.y});});
    return doc;
  }
  function applyEdit(d,doc,name,now){
    now=now||Date.now();
    var snap=snapFor(doc,d.snap);
    d.snap=snap;
    if(clean(name,TITLE_LEN))d.name=clean(name,TITLE_LEN);
    if(d.pages&&d.pages[0])d.pages[0].snap=copy(snap);
    if(d.frames&&d.frames[0])d.frames[0].snap=copy(snap);
    d.editedAt=d.savedAt=now;
    return d;
  }
  /* 보관함에서 폰보드만 — 새것이 위 */
  function mine(lib){return (Array.isArray(lib)?lib:[]).filter(function(d){return !!d&&d.type==='board'&&(!!d.phone||!!d.quick);}).sort(function(a,b){return (+(b.editedAt||b.savedAt)||0)-(+(a.editedAt||a.savedAt)||0);});}

  /* ── 그리기(순수 — 글을 돌려준다) ── */
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function pitchSVG(sp){
    var w=sp.w,h=sp.h,b=sp.box,s=sp.six,sw=r2(w/170),o='<defs><clipPath id="phbClip"><rect x="0" y="0" width="'+w+'" height="'+h+'"/></clipPath></defs>';
    var st=' fill="none" stroke="var(--phb-pline)" stroke-width="'+sw+'" stroke-opacity=".9"';
    o+='<rect x="0" y="0" width="'+w+'" height="'+h+'" fill="var(--phb-pitch)"/><rect x="0" y="0" width="'+w+'" height="'+h+'"'+st+'/>';
    o+='<line x1="0" y1="'+h/2+'" x2="'+w+'" y2="'+h/2+'"'+st+'/><circle cx="'+w/2+'" cy="'+h/2+'" r="'+sp.r+'"'+st+'/>';
    var rx=s?0:r2(b[1]*0.9);
    [0,1].forEach(function(k){
      var y=k?h-b[1]:0;
      o+='<rect x="'+r2((w-b[0])/2)+'" y="'+r2(k?y:y-rx)+'" width="'+b[0]+'" height="'+r2(b[1]+rx)+'" rx="'+rx+'"'+st+' clip-path="url(#phbClip)"/>';
      if(s)o+='<rect x="'+r2((w-s[0])/2)+'" y="'+(k?h-s[1]:0)+'" width="'+s[0]+'" height="'+s[1]+'"'+st+'/>';
      o+='<line x1="'+r2((w-sp.goal)/2)+'" y1="'+(k?h:0)+'" x2="'+r2((w+sp.goal)/2)+'" y2="'+(k?h:0)+'" stroke="var(--phb-pline)" stroke-width="'+r2(sw*3.2)+'"/>';
    });
    return o;
  }
  function lineSVG(l,sp){
    var dx=l.x2-l.x1,dy=l.y2-l.y1,len=Math.sqrt(dx*dx+dy*dy)||1,ux=dx/len,uy=dy/len,hd=sp.w*0.035,sw=r2(sp.w/110);
    var ex=l.x2-ux*hd*0.9,ey=l.y2-uy*hd*0.9,d;
    if(l.kind==='dribble'){
      var n=Math.max(6,Math.round(len/(sp.w*0.012))),amp=sp.w*0.012,wl=sp.w*0.05,body=Math.max(0,len-hd*1.6);d='M'+r2(l.x1)+' '+r2(l.y1);
      for(var i=1;i<=n;i++){var t=body*i/n,a=Math.sin(t/wl*Math.PI*2)*amp*(i===n?0:1);d+='L'+r2(l.x1+ux*t-uy*a)+' '+r2(l.y1+uy*t+ux*a);}
      d+='L'+r2(ex)+' '+r2(ey);
    }else d='M'+r2(l.x1)+' '+r2(l.y1)+'L'+r2(ex)+' '+r2(ey);
    var dash=l.kind==='pass'?' stroke-dasharray="'+r2(sw*3)+' '+r2(sw*2.6)+'"':'';
    var px=-uy*hd*0.5,py=ux*hd*0.5,bx=l.x2-ux*hd,by=l.y2-uy*hd;
    return '<path d="'+d+'" fill="none" stroke="var(--phb-draw)" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round"'+dash+'/>'+
      '<polygon points="'+r2(l.x2)+','+r2(l.y2)+' '+r2(bx+px)+','+r2(by+py)+' '+r2(bx-px)+','+r2(by-py)+'" fill="var(--phb-draw)"/>';
  }
  function docSVG(doc,sp){
    var o='',r=sp.w*0.043;
    doc.lines.forEach(function(l){o+=lineSVG(l,sp);});
    doc.cones.forEach(function(c){var k=r*0.75;o+='<polygon points="'+r2(c.x)+','+r2(c.y-k)+' '+r2(c.x+k)+','+r2(c.y+k)+' '+r2(c.x-k)+','+r2(c.y+k)+'" fill="var(--phb-cone)" stroke="var(--phb-edge)" stroke-width="'+r2(r*0.08)+'"/>';});
    doc.players.forEach(function(p){
      var gk=p.num==='1',fill=gk?'var(--phb-gk)':(p.team==='us'?'var(--phb-us)':'var(--phb-op)'),ink=gk?'var(--phb-edge)':'#fff';
      o+='<circle cx="'+r2(p.x)+'" cy="'+r2(p.y)+'" r="'+r2(r)+'" fill="'+fill+'" stroke="'+(gk?(p.team==='us'?'var(--phb-us)':'var(--phb-op)'):'#fff')+'" stroke-width="'+r2(r*(gk?0.22:0.12))+'"/>';
      o+='<text x="'+r2(p.x)+'" y="'+r2(p.y+r*0.36)+'" text-anchor="middle" font-size="'+r2(r*1.05)+'" font-weight="700" fill="'+ink+'">'+esc(p.num)+'</text>';
      if(p.name){var tw=Math.max(r*2.2,p.name.length*r*0.95+r*0.9),th=r*1.15,ty=p.y+r*1.25;
        o+='<rect x="'+r2(p.x-tw/2)+'" y="'+r2(ty)+'" width="'+r2(tw)+'" height="'+r2(th)+'" rx="'+r2(th/2)+'" fill="var(--phb-tag)" fill-opacity=".82"/>'+
           '<text x="'+r2(p.x)+'" y="'+r2(ty+th*0.74)+'" text-anchor="middle" font-size="'+r2(r*0.82)+'" font-weight="600" fill="#fff">'+esc(p.name)+'</text>';}
    });
    if(doc.ball)o+='<circle cx="'+r2(doc.ball.x)+'" cy="'+r2(doc.ball.y)+'" r="'+r2(r*0.55)+'" fill="#fff" stroke="var(--phb-edge)" stroke-width="'+r2(r*0.14)+'"/>';
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
    '--phb-pitch:#2E7A4E;--phb-pitch2:#2A7148;--phb-pline:#F3F7F4;--phb-us:#1F3F9A;--phb-op:#C24A46;--phb-gk:#E3B23C;--phb-cone:#F08A24;--phb-draw:#fff;--phb-edge:#14161A;--phb-tag:#0E1422}'+
    'body.fmdark #psPhoneBoard{--phb-bg:#12161D;--phb-surface:#181E28;--phb-fill:#232C38;--phb-ink:#E7EBF1;--phb-dim:#9AA3AF;--phb-line:#2A3341;--phb-act:#8FA6DA;--phb-act-ink:#0F1522;--phb-soft:#22304F;--phb-mark:#7FD6C2;--phb-mark-soft:#17362F;--phb-pitch:#235F3D;--phb-pitch2:#1F5637}'+
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
    '#psPhoneBoard .phb-pw{flex:1;min-height:0;position:relative;background:var(--phb-pitch2)}'+
    '#psPhoneBoard #phbPitch{position:absolute;left:6px;top:6px;width:calc(100% - 12px);height:calc(100% - 12px);display:block;touch-action:none;user-select:none;-webkit-user-select:none}'+
    '#psPhoneBoard .phb-sub{flex:none;display:flex;align-items:center;gap:8px;min-height:52px;padding:8px 10px 0;background:var(--phb-surface);overflow-x:auto}'+
    '#psPhoneBoard .phb-opt{flex:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border:1px solid var(--phb-line);border-radius:10px;background:var(--phb-surface);font-size:14px;font-weight:600;white-space:nowrap}'+
    '#psPhoneBoard .phb-opt[aria-pressed="true"]{border-color:var(--phb-act);background:var(--phb-soft)}'+
    '#psPhoneBoard .phb-opt i{flex:none;display:block;width:14px;height:14px;border-radius:999px}'+
    '#psPhoneBoard .phb-opt i.us{background:var(--phb-us)}#psPhoneBoard .phb-opt i.op{background:var(--phb-op)}#psPhoneBoard .phb-opt i.bl{background:#fff;border:1.5px solid var(--phb-edge)}'+
    '#psPhoneBoard .phb-opt i.cn{background:var(--phb-cone);border-radius:0;clip-path:polygon(50% 0,100% 100%,0 100%)}'+
    '#psPhoneBoard .phb-opt svg{width:30px;height:10px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}'+
    '#psPhoneBoard .phb-hint{font-size:12px;color:var(--phb-dim);padding:0 2px}'+
    '#psPhoneBoard .phb-tools{flex:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:8px 10px 10px;background:var(--phb-surface)}'+
    '#psPhoneBoard .phb-tool{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:56px;border:0;border-radius:10px;background:transparent;font-size:12px;font-weight:600;color:var(--phb-dim)}'+
    '#psPhoneBoard .phb-tool[aria-pressed="true"]{background:var(--phb-soft);color:var(--phb-ink)}'+
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
    move:'<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    put:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
    line:'<path d="M5 19L18 6M18 6h-6M18 6v6"/>',
    erase:'<path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12"/>'
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
    var M={scr:'home',list:null,listState:'idle',spec:'11',form:'4-3-3',opp:'',doc:null,editing:null,title:'',tool:'move',put:'us',line:'run',hist:[],dirty:false,saving:false,tokId:0,ask:null};
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
          '<div class="phb-pw"><svg id="phbPitch" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="세로 운동장"></svg></div>'+
          '<div class="phb-sub" id="phbSub"></div><div class="phb-tools" id="phbTools"></div></div>'+
        '<div class="phb-shade" id="phbNew" hidden><div class="phb-sheet"><h3>새 작전판</h3>'+
          '<div><p class="phb-cap">인원</p><div class="phb-opts" id="phbSpec"></div></div>'+
          '<div><p class="phb-cap">우리 팀 포메이션</p><div class="phb-opts" id="phbForm"></div></div>'+
          '<div><p class="phb-cap">상대 포메이션</p><div class="phb-opts" id="phbOppForm"></div></div>'+
          '<div class="phb-end"><button type="button" class="phb-btn" data-phb="new-cancel">취소</button><button type="button" class="phb-btn phb-pri" data-phb="new-go">만들기</button></div></div></div>'+
        '<div class="phb-shade" id="phbTok" hidden><div class="phb-sheet"><h3>선수</h3>'+
          '<label class="phb-fld"><span>번호</span><input id="phbNum" type="text" inputmode="numeric" maxlength="3" autocomplete="off"></label>'+
          '<label class="phb-fld"><span>이름</span><input id="phbNm" type="text" maxlength="'+NAME_LEN+'" autocomplete="off"></label>'+
          '<div class="phb-end"><button type="button" class="phb-btn phb-txt" data-phb="tok-del">이 선수 지우기</button><button type="button" class="phb-btn phb-pri" data-phb="tok-ok">확인</button></div></div></div>'+
        '<div class="phb-shade" id="phbAsk" hidden><div class="phb-sheet"><h3>저장하지 않은 판이 있어요</h3><p class="phb-hint" id="phbAskMsg"></p>'+
          '<div class="phb-end"><button type="button" class="phb-btn" data-phb="ask-drop">버리기</button><button type="button" class="phb-btn phb-pri" data-phb="ask-keep">계속 만들기</button></div></div></div>'+
        '<div class="phb-toast" id="phbToast" role="status" hidden></div>'+
        '<div class="phb-rot"><span>폰보드는 세로로만 써요. 폰을 세로로 돌려 주세요.</span></div>';
      doc.body.appendChild(root);
      root.addEventListener('click',onClick);
      var pitch=$('phbPitch');
      pitch.addEventListener('pointerdown',down);pitch.addEventListener('pointermove',move);pitch.addEventListener('pointerup',up);
      pitch.addEventListener('pointercancel',function(){G=null;paint();});
      $('phbName').addEventListener('input',function(){M.title=this.value;M.dirty=true;});
      var turn=function(){root.classList.toggle('phb-land',landscape(win));};
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
      if(M.listState==='fail'){cnt.textContent='';box.innerHTML='<p class="phb-blank">보관함을 읽지 못했어요. 로그인되어 있는지 확인해 주세요.</p><button type="button" class="phb-btn phb-big" data-phb="reload">다시 불러오기</button>';return;}
      var list=M.list||[];
      cnt.textContent=list.length?('내 폰보드 '+list.length+'개'):'';
      if(!list.length){box.innerHTML='<p class="phb-blank">아직 없어요. 위에서 작전판이나 뎁스 차트를 골라 첫 판을 만들어 보세요.</p>';return;}
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
    function hideSheets(){['phbNew','phbTok','phbAsk'].forEach(function(id){$(id).hidden=true;});}
    function quick(){var Q=win.PSQuickDepth;return Q&&typeof Q.open==='function'?Q:null;}
    /* 뎁스 차트(예전 «빠른 보드», board-quick-depth.js) — 폰보드의 한 종류. 그 창을 이 덮개 위에 띄우고, 저장하면 목록으로 돌아온다 */
    function openQuick(d){
      var Q=quick();if(!Q)return false;
      return Q.open(win,{host:true,item:d||null,say:toast,done:function(saved,edited){show('home');toast(edited?'폰보드를 고쳤어요':'보관함에 저장했어요 · 폰보드');loadList();}});
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
      M.hist=[];M.tool='move';M.dirty=!d;M.saving=false;
      var sp=specOf(M.doc.n),m=sp.w*0.06;
      $('phbPitch').setAttribute('viewBox',(-m)+' '+(-m)+' '+(sp.w+m*2)+' '+(sp.h+m*2));
      $('phbName').value=M.title;
      var sb=root.querySelector('[data-phb="save"]');sb.disabled=false;sb.textContent='저장';
      hideSheets();show('edit');renderTools();paint();
    }
    /* ── 편집 ── */
    function renderTools(){
      var t=[['move','옮기기'],['put','놓기'],['line','화살'],['erase','지우기']];
      $('phbTools').innerHTML=t.map(function(x){return '<button type="button" class="phb-tool" data-phb="tool" data-v="'+x[0]+'" aria-pressed="'+(M.tool===x[0])+'">'+svgIcon(x[0])+'<span>'+x[1]+'</span></button>';}).join('');
      var s;
      if(M.tool==='put')s=[['us','우리','us'],['op','상대','op'],['ball','공','bl'],['cone','콘','cn']].map(function(x){return '<button type="button" class="phb-opt" data-phb="put" data-v="'+x[0]+'" aria-pressed="'+(M.put===x[0])+'"><i class="'+x[2]+'"></i><span>'+x[1]+'</span></button>';}).join('');
      else if(M.tool==='line')s=[['run','이동','M1 5H29'],['pass','패스','M1 5H29" stroke-dasharray="4 4'],['dribble','드리블','M1 5q3.5-7 7 0t7 0 7 0 7 0']].map(function(x){return '<button type="button" class="phb-opt" data-phb="line" data-v="'+x[0]+'" aria-pressed="'+(M.line===x[0])+'"><svg viewBox="0 0 30 10" aria-hidden="true"><path d="'+x[2]+'"/></svg><span>'+x[1]+'</span></button>';}).join('');
      else if(M.tool==='move')s='<span class="phb-hint">끌어서 옮기고, 선수를 한 번 누르면 번호 · 이름을 고쳐요.</span>';
      else s='<span class="phb-hint">지울 것을 눌러요. 잘못 지웠으면 위의 되돌리기.</span>';
      $('phbSub').innerHTML=s;
      root.querySelector('[data-phb="undo"]').disabled=!M.hist.length;
    }
    function paint(preview){var sp=specOf(M.doc.n);$('phbPitch').innerHTML=pitchSVG(sp)+docSVG(M.doc,sp)+(preview?lineSVG(preview,sp):'');}
    function snapHist(){M.hist.push(JSON.stringify(M.doc));if(M.hist.length>HIST)M.hist.shift();M.dirty=true;root.querySelector('[data-phb="undo"]').disabled=false;}
    function pt(e){
      var svg=$('phbPitch'),p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
      var q=p.matrixTransform(svg.getScreenCTM().inverse());
      return inside(M.doc.n,q);
    }
    function down(e){
      if(M.saving)return;
      e.preventDefault();var p=pt(e),D=M.doc;
      try{$('phbPitch').setPointerCapture(e.pointerId);}catch(err){note(err);}
      if(M.tool==='move'){var h=hit(D,p,false);if(h)G={mode:'drag',h:h,sx:e.clientX,sy:e.clientY,ox:h.o.x-p.x,oy:h.o.y-p.y,moved:false};}
      else if(M.tool==='put'){
        if(M.put==='ball'){snapHist();D.ball={x:p.x,y:p.y};}
        else if(M.put==='cone'){if(D.cones.length>=MAX_CONES){toast('콘은 '+MAX_CONES+'개까지 놓을 수 있어요');return;}snapHist();D.cones.push({x:p.x,y:p.y});}
        else{
          if(D.players.length>=MAX_PLAYERS){toast('선수는 '+MAX_PLAYERS+'명까지 놓을 수 있어요');return;}
          snapHist();var n=D.players.filter(function(q){return q.team===M.put;}).length+1;
          D.players.push({id:nextId(D),team:M.put,num:String(n),name:'',x:p.x,y:p.y});
        }
        paint();
      }
      else if(M.tool==='line'){if(D.lines.length>=MAX_LINES){toast('화살은 '+MAX_LINES+'개까지 그릴 수 있어요');return;}G={mode:'line',x1:p.x,y1:p.y,x2:p.x,y2:p.y};}
      else if(M.tool==='erase'){
        var k=hit(D,p,true);if(!k)return;snapHist();
        if(k.type==='ball')D.ball=null;else if(k.type==='player')D.players.splice(k.i,1);else if(k.type==='cone')D.cones.splice(k.i,1);else D.lines.splice(k.i,1);
        paint();
      }
    }
    function move(e){
      if(!G)return;var p=pt(e),sp=specOf(M.doc.n);
      if(G.mode==='drag'){
        if(!G.moved){if(Math.abs(e.clientX-G.sx)+Math.abs(e.clientY-G.sy)<6)return;G.moved=true;snapHist();}
        G.h.o.x=r2(bound(p.x+G.ox,0,sp.w));G.h.o.y=r2(bound(p.y+G.oy,0,sp.h));paint();
      }else{G.x2=p.x;G.y2=p.y;paint({kind:M.line,x1:G.x1,y1:G.y1,x2:G.x2,y2:G.y2});}
    }
    function up(){
      if(!G)return;var g=G,sp=specOf(M.doc.n);G=null;
      if(g.mode==='drag'){if(!g.moved&&g.h.type==='player')openTok(g.h.o);}
      else{var dx=g.x2-g.x1,dy=g.y2-g.y1;if(Math.sqrt(dx*dx+dy*dy)>sp.w*0.06){snapHist();M.doc.lines.push({kind:M.line,x1:g.x1,y1:g.y1,x2:g.x2,y2:g.y2});}paint();}
    }
    function openTok(p){M.tokId=p.id;$('phbNum').value=p.num;$('phbNm').value=p.name;$('phbTok').hidden=false;}
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
        show('home');toast(editId?'폰보드를 고쳤어요':'보관함에 저장했어요 · 폰보드');
        var redraw=gfn('renderDrillFiles');try{if(redraw)redraw();}catch(e){note(e);}
        loadList();
      },function(e){
        note(e);M.saving=false;btn.disabled=false;btn.textContent='저장';
        toast(e&&e.psVaultLocked?'보관함을 쓰려면 먼저 로그인해 주세요':(e&&e.psPhone==='gone'?'이 판을 보관함에서 찾지 못했어요. 지워졌거나 아이패드 · 컴퓨터에서 바뀌었어요':(e&&e.psPhone==='owner'?'만든 사람만 고칠 수 있어요':'저장하지 못했어요. 판은 그대로 있어요. 다시 눌러 주세요')));
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
      var say=gfn('toast');if(say)say(ok?'만든 사람만 고칠 수 있어요. 보기로 열었어요':'아이패드 · 컴퓨터에서 손본 판이라 폰에서는 보기만 돼요');
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
      else if(k==='new-depth'){if(!openQuick(null))toast('뎁스 차트를 열지 못했어요. 잠시 뒤 다시 눌러 주세요');}
      else if(k==='new-go')startEditor(null);
      else if(k==='reload')loadList();
      else if(k==='open'){var d=(M.list||[])[+b.getAttribute('data-i')];if(d)openItem(d);}
      else if(k==='back')leaveEditor();
      else if(k==='undo'){if(M.hist.length){M.doc=JSON.parse(M.hist.pop());renderTools();paint();}}
      else if(k==='save')save();
      else if(k==='tool'){M.tool=v;renderTools();}
      else if(k==='put'){M.put=v;renderTools();}
      else if(k==='line'){M.line=v;renderTools();}
      else if(k==='tok-ok'){
        var p=tokCur(),n=cleanNum($('phbNum').value),nm=clean($('phbNm').value);
        if(p&&(p.num!==n||p.name!==nm)){snapHist();p.num=n;p.name=nm;}
        $('phbTok').hidden=true;paint();
      }
      else if(k==='tok-del'){var q=tokCur();if(q){snapHist();M.doc.players.splice(M.doc.players.indexOf(q),1);}$('phbTok').hidden=true;paint();}
      else if(k==='ask-drop'){$('phbAsk').hidden=true;M.doc=null;M.editing=null;M.dirty=false;show('home');}
      else if(k==='ask-keep')$('phbAsk').hidden=true;
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
      G=null;root.hidden=true;doc.body.classList.remove('ps-phoneboard-on');tell(false);
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

  return {TAG:TAG,SPECS:SPECS,FORMS:FORMS,world:world,local:local,docNew:docNew,snapFor:snapFor,itemFor:itemFor,editable:editable,docFrom:docFrom,applyEdit:applyEdit,mine:mine,
    hit:hit,pitchSVG:pitchSVG,docSVG:docSVG,landscape:landscape,title:title,install:install,open:open};
});
