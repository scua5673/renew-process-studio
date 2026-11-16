/* PROCESS STUDIO — 3.300 휴대폰 빠른 보드(사용자 11/15 «모바일에서 빠르게 보드 추가 눌러서 이런식으로 빠르게» → 목업 A안 «자리 눌러 넣기»).
   폰 «보드»는 보기 전용(3.230)이라 큰 편집기를 열지 않는다. 안내 띠(board-phone-view.js)의 «＋ 빠른 보드»가 이름만 넣는 창을 띄우고,
   «저장»이 보관함에 작전판 하나를 새로 담는다(페이지 1 · 장면 없음). 자리마다 선수 토큰 하나 — 자리 표시 pos · 주전 name · 뒤 순번 depth(이름 목록).
   · 뒤 순번은 토큰의 새 칸 depth 하나다. 이 모듈이 makeToken 을 감싸 이름표 밑에 흐린 이름표로 그린다(폰 · 아이패드 · 컴퓨터 · 내보내기 모두 같은 SVG).
   · 보관함 항목의 quick:{v,form} 이 «빠른 보드» 표시 — 폰 보기에서 «이름 고치기»로 이 창을 다시 연다(만든 사람 · 페이지 하나 · 장면 하나일 때만).
     고치면 토큰 이름 · 뒤 순번만 바꾸고 그림 · 장비 · 판 설정 · 같은 포메이션의 토큰 자리는 그대로 둔다.
   · «선수단에서»는 board-scout-import.js 의 read(win,'team') · teamRows 를 읽기만 한다(선수단 순서 = 뎁스 순서, 선수단 자료는 바꾸지 않는다).
   · 쓰는 길은 보관함의 원래 길(libTurn → libGet → libWrite + libTouch · stampCreator · editedAt=savedAt, 3.291).
   board.html 은 <script> 한 줄 + window.__vaultOpenView 한 줄. 순수 함수는 단위 시험이 바로 부른다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){root.PSQuickDepth=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});else api.install(root);}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  /* 자리 코드 → [표시, 이름, 선수단 군] */
  var META={GK:['GK','골키퍼','GK'],LB:['LB','왼쪽 풀백','LB'],RB:['RB','오른쪽 풀백','RB'],LCB:['CB','왼쪽 센터백','CB'],RCB:['CB','오른쪽 센터백','CB'],CB:['CB','센터백','CB'],
    LWB:['LWB','왼쪽 윙백','LB'],RWB:['RWB','오른쪽 윙백','RB'],LDM:['DM','왼쪽 수비형 미드필더','DM'],RDM:['DM','오른쪽 수비형 미드필더','DM'],DM:['DM','수비형 미드필더','DM'],
    LCM:['CM','왼쪽 중앙 미드필더','CM'],RCM:['CM','오른쪽 중앙 미드필더','CM'],CM:['CM','중앙 미드필더','CM'],AM:['AM','공격형 미드필더','AM'],
    LM:['LM','왼쪽 미드필더','LW'],RM:['RM','오른쪽 미드필더','RW'],LW:['LW','왼쪽 윙','LW'],RW:['RW','오른쪽 윙','RW'],
    ST:['ST','스트라이커','ST'],LST:['ST','왼쪽 스트라이커','ST'],RST:['ST','오른쪽 스트라이커','ST'],
    FIX:['FIX','픽소','CB'],LALA:['ALA','왼쪽 아라','LW'],RALA:['ALA','오른쪽 아라','RW'],PIV:['PIV','피보','ST']};
  /* 세로 운동장(위가 공격) — [코드, 왼쪽 %, 위 %]. 차례가 «다음 자리» 차례 */
  var FORMS={
    '4-2-3-1':{n:11,s:[['GK',50,89],['LB',12,62],['LCB',34,70],['RCB',66,70],['RB',88,62],['LDM',35,49],['RDM',65,49],['LW',14,27],['AM',50,30],['RW',86,27],['ST',50,7]]},
    '4-3-3':{n:11,s:[['GK',50,89],['LB',12,62],['LCB',34,70],['RCB',66,70],['RB',88,62],['DM',50,50],['LCM',26,38],['RCM',74,38],['LW',14,12],['ST',50,7],['RW',86,12]]},
    '4-4-2':{n:11,s:[['GK',50,89],['LB',12,62],['LCB',34,70],['RCB',66,70],['RB',88,62],['LM',12,40],['LCM',37,44],['RCM',63,44],['RM',88,40],['LST',34,10],['RST',66,10]]},
    '3-4-3':{n:11,s:[['GK',50,89],['LCB',24,68],['CB',50,64],['RCB',76,68],['LWB',10,42],['LCM',35,46],['RCM',65,46],['RWB',90,42],['LW',15,13],['ST',50,8],['RW',85,13]]},
    '3-5-2':{n:11,s:[['GK',50,89],['LCB',24,69],['CB',50,64],['RCB',76,69],['LWB',10,40],['LCM',30,48],['CM',50,40],['RCM',70,48],['RWB',90,40],['LST',36,10],['RST',64,10]]},
    '3-3-1':{n:8,s:[['GK',50,89],['LCB',22,64],['CB',50,66],['RCB',78,64],['LM',16,36],['CM',50,38],['RM',84,36],['ST',50,9]]},
    '2-3-2':{n:8,s:[['GK',50,89],['LCB',32,66],['RCB',68,66],['LM',13,40],['CM',50,42],['RM',87,40],['LST',32,12],['RST',68,12]]},
    '1-2-1':{n:5,s:[['GK',50,89],['FIX',50,63],['LALA',16,38],['RALA',84,38],['PIV',50,12]]}
  };
  var GROUPS=[['11인제',['4-2-3-1','4-3-3','4-4-2','3-4-3','3-5-2']],['8인제',['3-3-1','2-3-2']],['풋살',['1-2-1']]];
  var SPEC={11:['fifa',105,68],8:['u12',65,48],5:['futsal',40,20]};
  var FALLBACK={GK:[],CB:[],LB:['FB','RB'],RB:['FB','LB'],DM:['CM'],CM:['DM','AM'],AM:['CM'],LW:['W','RW'],RW:['W','LW'],ST:[]};
  var FAM_KO={GK:'골키퍼',LB:'왼쪽 수비',RB:'오른쪽 수비',FB:'풀백',CB:'센터백',DM:'수비형 미드',CM:'중앙 미드',AM:'공격형 미드',LW:'왼쪽 윙',RW:'오른쪽 윙',W:'윙',ST:'공격수'};
  var MAX_NAMES=12,NAME_LEN=20,TOK=0.8,DEPTH_SHOW=4;
  var DEFAULT_FORM='4-2-3-1',TAG='빠른 보드';

  function clean(n){return String(n==null?'':n).replace(/\s+/g,' ').trim().slice(0,NAME_LEN);}
  function slotsOf(form){return (FORMS[form]||FORMS[DEFAULT_FORM]).s;}
  function fam(code){return META[code]?META[code][2]:'';}
  function copy(slots){return slots.map(function(a){return a.slice();});}
  function count(slots){return slots.reduce(function(n,a){return n+a.length;},0);}
  function blank(form){return slotsOf(form).map(function(){return [];});}
  /* 선수단 포지션 코드(board.html posCode) → 군 */
  function famOf(code){
    var c=String(code||'').toUpperCase().replace(/[^A-Z]/g,'');
    if(c==='GK')return 'GK';
    if(/^(L|R)?CB$/.test(c)||c==='SW')return 'CB';
    if(c==='LB'||c==='LWB')return 'LB';
    if(c==='RB'||c==='RWB')return 'RB';
    if(c==='FB'||c==='WB')return 'FB';
    if(/^(L|R)?DM$/.test(c))return 'DM';
    if(/^(L|R)?CM$/.test(c))return 'CM';
    if(c==='AM'||c==='CAM')return 'AM';
    if(c==='LM'||c==='LW')return 'LW';
    if(c==='RM'||c==='RW')return 'RW';
    if(c==='W'||c==='WF')return 'W';
    if(/^(ST|CF|SS|LS|RS|LF|RF|FW)$/.test(c))return 'ST';
    return '';
  }
  /* 선수단 순서(= 포지션별 뎁스) 그대로: ① 군마다 주전 ② 빈 자리는 가까운 군 ③ 남은 선수는 제 군 자리에 번갈아 ④ 그래도 남으면 가까운 군 자리에 */
  function fill(form,roster){
    var sl=slotsOf(form),out=sl.map(function(){return [];}),used={},list=(roster||[]).filter(function(r){return r&&clean(r.name);});
    function free(f){return list.find(function(r){return r.fam===f&&!used[clean(r.name)];});}
    function put(i,r){out[i].push(clean(r.name));used[clean(r.name)]=1;}
    sl.forEach(function(s,i){var r=free(fam(s[0]));if(r)put(i,r);});
    sl.forEach(function(s,i){if(out[i].length)return;(FALLBACK[fam(s[0])]||[]).some(function(f){var r=free(f);if(r){put(i,r);return true;}return false;});});
    function spread(f,idx){if(!idx.length)return;var k=0;list.forEach(function(r){if(r.fam===f&&!used[clean(r.name)]&&out[idx[k%idx.length]].length<MAX_NAMES){put(idx[k%idx.length],r);k++;}});}
    var fams=[];sl.forEach(function(s){if(fams.indexOf(fam(s[0]))<0)fams.push(fam(s[0]));});
    fams.forEach(function(f){spread(f,sl.map(function(s,i){return i;}).filter(function(i){return fam(sl[i][0])===f;}));});
    ['FB','W','CM','DM','AM','RB','LB','RW','LW'].forEach(function(f){
      spread(f,sl.map(function(s,i){return i;}).filter(function(i){return (FALLBACK[fam(sl[i][0])]||[]).indexOf(f)>=0;}));
    });
    return out;
  }
  /* 포메이션을 바꾸면 이름은 같은 자리 → 같은 표시 → 같은 군으로. 자리가 없으면 lost 에 */
  function remap(form,slots,next){
    var old=slotsOf(form),nu=slotsOf(next),out=nu.map(function(){return [];}),taken={},lost=[];
    old.forEach(function(s,i){
      var names=(slots[i]||[]);if(!names.length)return;
      function find(fn){for(var k=0;k<nu.length;k++){if(!taken[k]&&fn(nu[k]))return k;}return -1;}
      var j=find(function(t){return t[0]===s[0];});
      if(j<0)j=find(function(t){return META[t[0]][0]===META[s[0]][0];});
      if(j<0)j=find(function(t){return fam(t[0])===fam(s[0]);});
      if(j<0){var k2=-1;for(var k=0;k<nu.length;k++){if(fam(nu[k][0])===fam(s[0])){k2=k;break;}}
        if(k2>=0){out[k2]=out[k2].concat(names).slice(0,MAX_NAMES);return;}
        lost.push({code:META[s[0]][0],n:names.length});return;}
      taken[j]=1;out[j]=names.slice();
    });
    return {slots:out,lost:lost};
  }
  /* 붙여넣기 — 한 줄에 한 자리: «GK 윤태오, 서지안» · «골키퍼: 윤태오 서지안». 두 자리 표시(CB)는 번갈아 */
  function splitNames(t){
    var names=String(t||'').split(/[,，、·\/]+/).map(clean).filter(Boolean);
    if(names.length===1&&/\s/.test(names[0])&&/[가-힣]/.test(names[0]))names=names[0].split(/\s+/).map(clean).filter(Boolean);
    return names;
  }
  function parse(text,form,slots){
    var sl=slotsOf(form),out=copy(slots||blank(form)),hit=0,miss=[],all=sl.map(function(s,i){return i;});
    String(text||'').split(/\n+/).forEach(function(line){
      line=line.trim();if(!line)return;
      var m=line.match(/^([A-Za-z]{2,4})\s*[:：\-–]?\s*(.+)$/)||line.match(/^([가-힣 ]{2,14}?)\s*[:：\-–]\s*(.+)$/)||line.match(/^([가-힣]{2,10})\s+(.+)$/);
      if(!m){miss.push(line.slice(0,10));return;}
      var key=m[1].trim(),K=key.toUpperCase();
      var idx=all.filter(function(i){return sl[i][0]===K;});
      if(!idx.length)idx=all.filter(function(i){return META[sl[i][0]][0]===K;});
      if(!idx.length)idx=all.filter(function(i){var ko=META[sl[i][0]][1];return ko===key||ko.slice(-key.length)===key;});
      if(!idx.length){miss.push(key);return;}
      var names=splitNames(m[2]);if(!names.length){miss.push(key);return;}
      idx.forEach(function(i){out[i]=[];});
      names.forEach(function(n,k){var i=idx[k%idx.length];if(out[i].length<MAX_NAMES){out[i].push(n);hit++;}});
    });
    return {slots:out,hit:hit,miss:miss};
  }
  /* 세계 좌표 — 11인제 1m = 10 단위, 가운데 (555,370). 작은 규격은 그 안 가운데(board.html PR()). 세로 보기(spFlip 끔)는 x 가 작을수록 아래 */
  function at(form,i){
    var F=FORMS[form]||FORMS[DEFAULT_FORM],s=F.s[i],sp=SPEC[F.n];
    return {x:Math.round(555+((1-s[2]/100)-0.5)*sp[1]*10),y:Math.round(370+(s[1]/100-0.5)*sp[2]*10)};
  }
  function players(form,slots,prev){
    var F=FORMS[form]||FORMS[DEFAULT_FORM],keep=prev&&prev.form===form?prev.players:null;
    return F.s.map(function(s,i){
      var names=(slots[i]||[]).map(clean).filter(Boolean).slice(0,MAX_NAMES),id=i+1,old=null;
      if(keep)for(var k=0;k<keep.length;k++){if(keep[k]&&keep[k].id===id&&!keep[k].coach){old=keep[k];break;}}
      var p=old?JSON.parse(JSON.stringify(old)):{id:id,team:'red',num:String(id),pos:META[s[0]][0],color:null};
      if(!old){var w=at(form,i);p.x=w.x;p.y=w.y;}
      p.name=names[0]||'';
      if(names.length>1)p.depth=names.slice(1);else delete p.depth;
      return p;
    });
  }
  function snapFor(form,slots,prevSnap,prevForm){
    var F=FORMS[form]||FORMS[DEFAULT_FORM];
    if(prevSnap&&prevForm===form){
      var s=JSON.parse(JSON.stringify(prevSnap)),others=(s.players||[]).filter(function(p){return !(p&&p.id>=1&&p.id<=F.s.length);});
      s.players=players(form,slots,{form:form,players:prevSnap.players||[]}).concat(others);
      return s;
    }
    return {pitchSpec:SPEC[F.n][0],orientation:'v',spFlip:false,area:'full',pitchView:'full',pvSide:'own',fieldMode:'standard',pitchN:1,pitchTheme:'grass',
      lines:true,gridType:'off',label:'pos',tokenScale:TOK,tokV:2,tokShape:'circle',namePos:'below',nameSize:'m',nameStyle:'pill',
      players:players(form,slots,null),ball:null,drawings:[],equipment:[]};
  }
  function today(now){var d=new Date(now||Date.now());return (d.getMonth()+1)+'/'+d.getDate();}
  function title(form,now){return form+' 뎁스 · '+today(now);}
  function itemFor(form,slots,name,now){
    now=now||Date.now();
    return {libId:'V'+now.toString(36)+Math.random().toString(36).slice(2,5),type:'board',name:clean(name)?String(name).trim().slice(0,60):title(form,now),folder:'',thumb:'',
      snap:snapFor(form,slots),tags:[TAG],savedAt:now,editedAt:now,quick:{v:1,form:FORMS[form]?form:DEFAULT_FORM}};
  }
  /* 다시 고칠 수 있는 빠른 보드 — 작전판 · 페이지 하나 · 장면 하나 */
  function editable(d){
    return !!(d&&d.type==='board'&&d.quick&&FORMS[d.quick.form]&&d.snap&&Array.isArray(d.snap.players)&&!(d.pages&&d.pages.length>1)&&!(d.frames&&d.frames.length>1)&&!d.book);
  }
  function slotsFrom(d){
    var form=d.quick.form;
    return slotsOf(form).map(function(s,i){
      var p=(d.snap.players||[]).find(function(x){return x&&x.id===i+1&&!x.coach;});
      if(!p)return [];
      return [p.name].concat(Array.isArray(p.depth)?p.depth:[]).map(clean).filter(Boolean).slice(0,MAX_NAMES);
    });
  }
  /* 고친 이름을 같은 항목에 — 판 설정 · 그림 · 장비 · 페이지 하나 · 장면 하나는 그대로 */
  function applyEdit(d,form,slots,name,now){
    now=now||Date.now();
    var snap=snapFor(form,slots,d.snap,d.quick.form);
    if(d.quick.form!==form){var fresh=snapFor(form,slots);['pitchSpec','pitchView','area','fieldMode'].forEach(function(k){snap[k]=fresh[k];});}
    d.snap=snap;d.quick={v:1,form:form};
    if(clean(name))d.name=String(name).trim().slice(0,60);
    if(d.pages&&d.pages[0])d.pages[0].snap=JSON.parse(JSON.stringify(snap));
    if(d.frames&&d.frames[0])d.frames[0].snap=JSON.parse(JSON.stringify(snap));
    d.editedAt=d.savedAt=now;
    return d;
  }

  /* ══ 뒤 순번 그리기 — 이름표 밑에 흐린 이름표(토큰 안쪽 좌표 · 세로 보기에서도 토큰과 함께 바로 선다) ══ */
  var SVGNS='http://www.w3.org/2000/svg';
  function nameK(win){var v=win.__nameSize;return v==='s'?0.8:(v==='l'?1.25:(v==='xl'?1.6:1));}
  function textWidth(t,k){var w=12;for(var ch of t){w+=(ch.charCodeAt(0)>0x2000?15.6:9.6);}return w*k;}
  function decorate(win,g,p){
    if(!g||!p||!Array.isArray(p.depth)||!p.depth.length||!p.name||p.img||p.coach||p.team==='ball')return;
    if(g.querySelector('.ps-depth'))return;
    var doc=g.ownerDocument,k=nameK(win),up=win.__namePos==='above',plain=win.__nameStyle==='text',shaper=false;
    try{shaper=typeof win._shaperOn==='function'&&win._shaperOn(p);}catch(_){}
    var nh=27*k,y=up?30:((shaper?60:48)+(nh-27)/2)+nh/2+4*k,h=22*k,list=p.depth.map(clean).filter(Boolean);
    if(list.length>DEPTH_SHOW)list=list.slice(0,DEPTH_SHOW-1).concat(['+'+(p.depth.length-DEPTH_SHOW+1)+'명']);
    var box=doc.createElementNS(SVGNS,'g');box.setAttribute('class','ps-depth');box.setAttribute('pointer-events','none');
    list.forEach(function(t){
      var w=textWidth(t,k),cy=y+h/2;
      if(!plain){var r=doc.createElementNS(SVGNS,'rect');r.setAttribute('x',String(-w/2));r.setAttribute('y',String(y));r.setAttribute('width',String(w));r.setAttribute('height',String(h));r.setAttribute('rx',String(8*k));r.setAttribute('fill','rgba(18,22,30,.5)');box.appendChild(r);}
      var tx=doc.createElementNS(SVGNS,'text');
      tx.setAttribute('x','0');tx.setAttribute('y',String(cy+0.5*k));tx.setAttribute('text-anchor','middle');tx.setAttribute('dominant-baseline','central');
      tx.setAttribute('fill','rgba(255,255,255,.9)');tx.setAttribute('font-size',String(Math.round(15*k*10)/10));tx.setAttribute('font-weight','600');
      tx.setAttribute('font-family',win.__nameFF||"Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif");
      if(plain){tx.setAttribute('stroke','rgba(10,14,22,.8)');tx.setAttribute('stroke-width',String(Math.round(3.6*k*10)/10));tx.setAttribute('stroke-linejoin','round');tx.setAttribute('paint-order','stroke');}
      tx.textContent=t;box.appendChild(tx);y+=h+3*k;
    });
    g.appendChild(box);
  }
  function wrapTokens(win){
    if(win.__psQuickTokWrap||typeof win.makeToken!=='function')return !!win.__psQuickTokWrap;
    var orig=win.makeToken;
    win.makeToken=function(p){var g=orig.apply(this,arguments);try{decorate(win,g,p);}catch(_){}return g;};
    win.__psQuickTokWrap=true;
    /* 본문이 부팅 중 이미 그린 토큰 — 다시 그리지 않고(편집 seq · 3.120) 그 자리에서 붙인다 */
    try{var st=(typeof state!=='undefined')?state:null;if(st&&st.players)st.players.forEach(function(p){if(!p||!p.depth)return;var g=win.document.querySelector('#tokenLayer [data-id="'+p.id+'"]');if(g)decorate(win,g,p);});}catch(_){}
    return true;
  }

  /* ══ 휴대폰 창 ══ */
  var CSS='#psQuick{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:var(--pq-surface);color:var(--pq-ink);font:500 14px/1.5 Pretendard,-apple-system,"Apple SD Gothic Neo",sans-serif;'+
    '--pq-surface:#fff;--pq-sunken:#EEF0F4;--pq-ink:#14213D;--pq-muted:#646A73;--pq-line:#E4E7EC;--pq-action:#14213D;--pq-action-ink:#fff;--pq-team:#D3262F;-webkit-text-size-adjust:100%}'+
    'body.fmdark #psQuick{--pq-surface:#181E28;--pq-sunken:#232C38;--pq-ink:#E7EBF1;--pq-muted:#9AA3AF;--pq-line:#2A3341;--pq-action:#8FA6DA;--pq-action-ink:#0F1522}'+
    '#psQuick[hidden],#psQuick [hidden]{display:none!important}#psQuick *{box-sizing:border-box}'+
    '#psQuick button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}'+
    '#psQuick button:focus-visible,#psQuick input:focus-visible,#psQuick textarea:focus-visible{outline:2px solid var(--pq-action);outline-offset:2px}'+
    '#psQuick .pq-bar{flex:none;display:flex;align-items:center;gap:8px;min-height:56px;padding:8px 12px;padding-top:max(8px,env(safe-area-inset-top,0px));border-bottom:1px solid var(--pq-line)}'+
    '#psQuick .pq-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--pq-line);background:var(--pq-surface);font-size:14px;font-weight:600;color:var(--pq-action);white-space:nowrap}'+
    '#psQuick .pq-btn:disabled{opacity:.5;cursor:default}'+
    '#psQuick .pq-pri{background:var(--pq-action);border-color:var(--pq-action);color:var(--pq-action-ink)}'+
    '#psQuick .pq-ghost{border-color:transparent;background:transparent}'+
    '#psQuick .pq-icon{width:40px;padding:0;font-size:20px}'+
    '#psQuick .pq-title{flex:1;width:0;min-width:0;height:40px;border:1px solid transparent;border-radius:6px;background:transparent;padding:0 6px;font:700 16px Pretendard,-apple-system,sans-serif;color:var(--pq-ink)}'+
    '#psQuick .pq-title:focus{border-color:var(--pq-line);background:var(--pq-sunken);outline:none}'+
    '#psQuick .pq-tools{flex:none;display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid var(--pq-line);overflow-x:auto;scrollbar-width:none}'+
    '#psQuick .pq-tools .pq-btn{flex:none;min-height:36px;padding:0 11px;border-radius:999px}'+
    '#psQuick .pq-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}'+
    '#psQuick .pq-hint{display:flex;justify-content:flex-end;gap:8px;padding:8px 16px 0;font-size:12px;color:var(--pq-muted)}'+
    '#psQuick .pq-hint b{font-weight:600;font-variant-numeric:tabular-nums}'+
    '#psQuick .pq-wrap{margin:8px 12px 12px;padding:10px 8px 40px;border-radius:10px;background:#2F6629}'+
    '#psQuick .pq-stage{position:relative;width:100%;aspect-ratio:68/105;border-radius:6px;background:repeating-linear-gradient(180deg,#3C7B34 0 7.69%,#35712F 7.69% 15.38%)}'+
    '#psQuick .pq-stage svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}'+
    '#psQuick .pq-stage svg *{fill:none;stroke:rgba(255,255,255,.5);stroke-width:1.3;vector-effect:non-scaling-stroke}'+
    '#psQuick .pq-stage svg .pq-dot{fill:rgba(255,255,255,.5);stroke:none}'+
    '#psQuick .pq-slot{position:absolute;transform:translate(-50%,-15px);display:flex;flex-direction:column;align-items:center;gap:2px;padding:0;border:0;background:none;color:#fff}'+
    '#psQuick .pq-bdg{flex:none;display:inline-block;width:30px;height:30px;border-radius:999px;background:var(--pq-team);color:#fff;font:700 12px/30px Pretendard,-apple-system,sans-serif;letter-spacing:-.03em;text-align:center;box-shadow:0 0 0 2px #fff,0 2px 6px rgba(0,0,0,.35);margin-bottom:3px}'+
    '#psQuick .pq-slot.pq-on .pq-bdg{box-shadow:0 0 0 2px #fff,0 0 0 6px rgba(255,255,255,.55),0 2px 6px rgba(0,0,0,.35)}'+
    '#psQuick .pq-nm{display:block;max-width:100%;padding:0 6px;border-radius:6px;font:700 12px/17px Pretendard,-apple-system,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
    '#psQuick .pq-st{background:#fff;color:#14213D;box-shadow:0 1px 2px rgba(0,0,0,.25)}'+
    '#psQuick .pq-bk{background:rgba(18,22,30,.42);color:rgba(255,255,255,.92);font-weight:600}'+
    '#psQuick .pq-add{background:rgba(255,255,255,.1);border:1px dashed rgba(255,255,255,.7);line-height:15px;color:#fff}'+
    '#psQuick .pq-scrim{position:absolute;inset:0;background:rgba(10,14,22,.45);z-index:20}'+
    '#psQuick .pq-sheet{position:absolute;left:0;right:0;bottom:0;z-index:21;max-height:80%;display:flex;flex-direction:column;background:var(--pq-surface);border-radius:16px 16px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.18);padding-bottom:env(safe-area-inset-bottom,0px)}'+
    '#psQuick .pq-grab{width:36px;height:4px;border-radius:999px;background:var(--pq-line);margin:8px auto 0;flex:none}'+
    '#psQuick .pq-sh-head{flex:none;display:flex;align-items:center;gap:10px;padding:10px 16px 8px}'+
    '#psQuick .pq-sh-head .pq-bdg{margin:0;box-shadow:none}'+
    '#psQuick .pq-sh-t{flex:1;min-width:0}#psQuick .pq-sh-t b{display:block;font-size:16px;font-weight:700}#psQuick .pq-sh-t small{display:block;font-size:12px;color:var(--pq-muted)}'+
    '#psQuick .pq-sh-body{flex:1;min-height:0;overflow-y:auto;padding:0 16px 8px}'+
    '#psQuick .pq-sh-foot{flex:none;display:flex;gap:8px;padding:8px 16px 12px;border-top:1px solid var(--pq-line)}#psQuick .pq-sh-foot .pq-btn{flex:1}'+
    '#psQuick .pq-list{list-style:none;margin:0 0 10px;padding:0;display:flex;flex-direction:column;gap:6px}'+
    '#psQuick .pq-list li{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 4px 0 10px;border:1px solid var(--pq-line);border-radius:10px}'+
    '#psQuick .pq-ord{flex:none;width:44px;font-size:12px;font-weight:700;color:var(--pq-muted)}#psQuick .pq-list li:first-child .pq-ord{color:var(--pq-ink)}'+
    '#psQuick .pq-n{flex:1;min-width:0;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#psQuick .pq-list li+li .pq-n{font-weight:500}'+
    '#psQuick .pq-list .pq-btn{width:40px;min-height:40px;padding:0;border-color:transparent;color:var(--pq-muted);font-size:16px}'+
    '#psQuick .pq-add-row{display:flex;gap:8px;margin-bottom:14px}'+
    '#psQuick .pq-add-row input{flex:1;width:0;min-width:0;height:44px;border:1px solid var(--pq-line);border-radius:10px;background:var(--pq-surface);padding:0 12px;font:600 16px Pretendard,-apple-system,sans-serif;color:var(--pq-ink)}'+
    '#psQuick .pq-add-row input:focus,#psQuick textarea:focus{border-color:var(--pq-action);outline:none}'+
    '#psQuick .pq-cap{margin:4px 0 6px;font-size:12px;font-weight:700;color:var(--pq-muted);letter-spacing:.04em}'+
    '#psQuick .pq-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}'+
    '#psQuick .pq-chip{min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--pq-line);background:var(--pq-surface);font-size:14px;font-weight:600;color:var(--pq-action)}'+
    '#psQuick .pq-chip small{font-size:12px;color:var(--pq-muted);font-weight:500;margin-left:4px}#psQuick .pq-chip.pq-placed{color:var(--pq-muted);border-style:dashed}'+
    '#psQuick .pq-note{padding:4px 0 10px;font-size:14px;color:var(--pq-muted)}'+
    '#psQuick .pq-link{border:0;background:none;padding:8px 0;color:var(--pq-action);font-size:14px;font-weight:600}'+
    '#psQuick .pq-fchips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:14px}'+
    '#psQuick .pq-fchip{min-height:44px;border-radius:10px;border:1px solid var(--pq-line);background:var(--pq-surface);font-size:16px;font-weight:700;color:var(--pq-ink);font-variant-numeric:tabular-nums}'+
    '#psQuick .pq-fchip[aria-pressed="true"]{border:2px solid var(--pq-action);color:var(--pq-action)}'+
    '#psQuick .pq-opt{display:flex;align-items:center;gap:10px;min-height:52px;padding:6px 12px;border:1px solid var(--pq-line);border-radius:10px;margin-bottom:6px}'+
    '#psQuick .pq-opt input{flex:none;width:20px;height:20px;accent-color:var(--pq-action)}'+
    '#psQuick .pq-ot{flex:1;min-width:0;display:flex;flex-direction:column}#psQuick .pq-ot span{font-size:16px;font-weight:600}#psQuick .pq-ot small{font-size:12px;color:var(--pq-muted)}'+
    '#psQuick .pq-draft{width:100%;justify-content:space-between;margin-bottom:12px}'+
    '#psQuick textarea{width:100%;min-height:170px;border:1px solid var(--pq-line);border-radius:10px;background:var(--pq-surface);color:var(--pq-ink);padding:10px 12px;font:500 16px/1.6 Pretendard,-apple-system,sans-serif;resize:vertical}'+
    '#psQuick .pq-small{font-size:12px;color:var(--pq-muted);margin:6px 0 0}'+
    '#psQuick .pq-toast{position:absolute;left:12px;right:12px;bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:40;display:flex;align-items:center;gap:10px;padding:10px 12px 10px 16px;border-radius:10px;background:#14213D;color:#fff;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.3)}'+
    '#psQuick .pq-toast span{flex:1;min-width:0}#psQuick .pq-toast button{flex:none;min-height:36px;border:0;border-radius:6px;padding:0 10px;background:rgba(255,255,255,.14);color:#fff;font-weight:700}'+
    '@media (prefers-reduced-motion:no-preference){#psQuick .pq-sheet{animation:pqUp .18s ease-out}@keyframes pqUp{from{transform:translateY(24px)}to{transform:none}}}';
  var LINES='<svg viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="66" height="103"/><line x1="1" y1="52.5" x2="67" y2="52.5"/><circle cx="34" cy="52.5" r="9.15"/><circle class="pq-dot" cx="34" cy="52.5" r=".6"/>'+
    '<rect x="13.84" y="1" width="40.32" height="16.5"/><rect x="24.84" y="1" width="18.32" height="5.5"/><rect x="13.84" y="87.5" width="40.32" height="16.5"/><rect x="24.84" y="98.5" width="18.32" height="5.5"/></svg>';

  function isPhoneView(win){try{return !!(win.psPhoneBoardReadOnly&&win.psPhoneBoardReadOnly());}catch(_){return false;}}
  function viewing(win){var b=win.document.body;return !!(b&&b.classList.contains('vcreating')&&win.__vaultReadOnly);}
  /* 안내 띠의 단추 — 작업 보드에서는 «＋ 빠른 보드», 보관함에서 연 빠른 보드(내가 만든 것)는 «이름 고치기», 그 밖은 없음 */
  function entry(win){
    var b=win.document.body;
    if(!b||!isPhoneView(win)||!win.__boardReady)return null;
    if(b.classList.contains('comm-viewing')||b.classList.contains('editing')||b.classList.contains('meet-mode')||win.__csView==='session')return null;
    if(viewing(win)){var d=win.__vvItem;try{if(editable(d)&&(typeof canEditItem!=='function'||canEditItem(d)))return {mode:'edit',label:'이름 고치기'};}catch(_){}return null;}
    if(b.classList.contains('vcreating'))return null;
    return {mode:'new',label:'＋ 빠른 보드'};
  }

  function make(win){
    var doc=win.document,M={form:DEFAULT_FORM,slots:blank(DEFAULT_FORM),title:'',active:-1,showAll:false,editing:null,roster:null,rosterState:'idle',undo:null,dirty:false,saving:false};
    var pend={form:DEFAULT_FORM,fill:'roster'},root=null,tmr=null;
    function el(tag,cls,txt){var e=doc.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
    function $(id){return doc.getElementById(id);}
    function boardToast(t){try{if(win.toast)win.toast(t);}catch(_){}}
    function toast(msg,undo){
      var t=root.querySelector('.pq-toast');t.querySelector('span').textContent=msg;t.querySelector('button').hidden=!undo;t.hidden=false;
      win.clearTimeout(tmr);tmr=win.setTimeout(function(){t.hidden=true;},undo?5000:2600);
    }
    function setUndo(){M.undo={form:M.form,slots:copy(M.slots)};}
    function where(name){for(var i=0;i<M.slots.length;i++){if(M.slots[i].indexOf(name)>=0)return i;}return -1;}
    function build(){
      if(!$('psQuickStyle')){var st=el('style');st.id='psQuickStyle';st.textContent=CSS;doc.head.appendChild(st);}
      root=el('div');root.id='psQuick';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','빠른 보드');
      root.innerHTML='<div class="pq-bar"><button type="button" class="pq-btn pq-ghost pq-icon" data-pq="back" aria-label="닫기">‹</button>'+
        '<input class="pq-title" id="pqTitle" aria-label="보드 이름" autocomplete="off" maxlength="60" enterkeyhint="done">'+
        '<button type="button" class="pq-btn pq-pri" data-pq="save">저장</button></div>'+
        '<div class="pq-tools"><button type="button" class="pq-btn" data-pq="form" id="pqFormBtn"></button>'+
        '<button type="button" class="pq-btn" data-pq="fill" aria-label="선수단 순서로 채우기">선수단에서</button>'+
        '<button type="button" class="pq-btn" data-pq="paste">붙여넣기</button><button type="button" class="pq-btn" data-pq="clear">비우기</button></div>'+
        '<div class="pq-body" id="pqBody"><div class="pq-hint"><b id="pqCount"></b></div>'+
        '<div class="pq-wrap"><div class="pq-stage" id="pqStage"></div></div><div id="pqPad"></div></div>'+
        '<div class="pq-scrim" hidden></div>'+
        '<section class="pq-sheet" id="pqForm" hidden aria-labelledby="pqFormT"><div class="pq-grab"></div><div class="pq-sh-head"><div class="pq-sh-t"><b id="pqFormT"></b><small id="pqFormS"></small></div><button type="button" class="pq-btn pq-ghost" data-pq="form-close">닫기</button></div><div class="pq-sh-body" id="pqFormBody"></div><div class="pq-sh-foot"><button type="button" class="pq-btn pq-pri" data-pq="form-go"></button></div></section>'+
        '<section class="pq-sheet" id="pqPos" hidden aria-labelledby="pqPosName"><div class="pq-grab"></div><div class="pq-sh-head"><span class="pq-bdg" id="pqPosBdg"></span><div class="pq-sh-t"><b id="pqPosName"></b><small id="pqPosSub"></small></div><button type="button" class="pq-btn pq-ghost" data-pq="pos-close">닫기</button></div>'+
        '<div class="pq-sh-body"><ol class="pq-list" id="pqList"></ol><div class="pq-add-row"><input id="pqInput" placeholder="이름 쓰고 ↵ · 계속 이어서" enterkeyhint="done" autocomplete="off" aria-label="이름 넣기"><button type="button" class="pq-btn" data-pq="add">넣기</button></div>'+
        '<div class="pq-cap" id="pqChipCap"></div><div class="pq-chips" id="pqChips"></div><button type="button" class="pq-link" data-pq="more" id="pqMore"></button></div>'+
        '<div class="pq-sh-foot"><button type="button" class="pq-btn" data-pq="prev" id="pqPrev">‹ 이전 자리</button><button type="button" class="pq-btn" data-pq="next" id="pqNext"></button></div></section>'+
        '<section class="pq-sheet" id="pqPaste" hidden aria-labelledby="pqPasteT"><div class="pq-grab"></div><div class="pq-sh-head"><div class="pq-sh-t"><b id="pqPasteT">붙여넣기</b><small>한 줄에 한 자리 · 자리 이름 뒤에 이름을 쉼표로</small></div><button type="button" class="pq-btn pq-ghost" data-pq="paste-close">닫기</button></div>'+
        '<div class="pq-sh-body"><textarea id="pqPasteText" aria-label="붙여 넣을 명단" placeholder="GK 윤태오, 서지안&#10;CB 오세찬, 장하율, 임준서&#10;골키퍼 윤태오 서지안"></textarea><p class="pq-small">메모에 적어 둔 명단을 그대로 붙여 넣어도 돼요. CB처럼 두 자리면 번갈아 들어가요. 적지 않은 자리는 그대로 둬요.</p></div>'+
        '<div class="pq-sh-foot"><button type="button" class="pq-btn pq-pri" data-pq="paste-go">넣기</button></div></section>'+
        '<section class="pq-sheet" id="pqAsk" hidden aria-labelledby="pqAskT"><div class="pq-grab"></div><div class="pq-sh-head"><div class="pq-sh-t"><b id="pqAskT">고친 이름을 버리고 닫을까요?</b><small>보관함의 보드는 그대로예요</small></div></div>'+
        '<div class="pq-sh-foot"><button type="button" class="pq-btn" data-pq="ask-stay">계속 고치기</button><button type="button" class="pq-btn pq-pri" data-pq="ask-leave">버리고 닫기</button></div></section>'+
        '<div class="pq-toast" hidden role="status"><span></span><button type="button" data-pq="undo">되돌리기</button></div>';
      doc.body.appendChild(root);
      root.addEventListener('click',onClick);
      /* 작전판 단축키가 입력칸의 글자를 받지 않게 */
      ['keydown','keyup','keypress'].forEach(function(t){root.addEventListener(t,function(e){if(t==='keydown'&&e.key==='Escape'){e.preventDefault();back();}e.stopPropagation();});});
      $('pqStage').addEventListener('click',function(e){var b=e.target.closest('.pq-slot');if(b)openPos(+b.getAttribute('data-i'));});
      var inp=$('pqInput');
      inp.addEventListener('keydown',function(e){if(e.key!=='Enter'||e.isComposing||e.keyCode===229)return;e.preventDefault();submit();});
      $('pqTitle').addEventListener('input',function(){M.title=this.value;M.dirty=true;});
      $('pqTitle').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();this.blur();}});
    }
    function hideSheets(){['pqForm','pqPos','pqPaste','pqAsk'].forEach(function(id){$(id).hidden=true;});root.querySelector('.pq-scrim').hidden=true;M.active=-1;}
    function stageHTML(box){
      box.innerHTML=LINES;
      slotsOf(M.form).forEach(function(s,i){
        var names=M.slots[i]||[],m=Math.min(s[1],100-s[1]),b=el('button','pq-slot'+(M.active===i?' pq-on':''));
        b.type='button';b.setAttribute('data-i',String(i));b.setAttribute('aria-label',META[s[0]][1]+' '+(names.length?names.join(', '):'비어 있음'));
        b.style.left=s[1]+'%';b.style.top=s[2]+'%';b.style.width='min(96px, calc('+(2*m)+'% - 4px))';
        b.appendChild(el('span','pq-bdg',META[s[0]][0]));
        if(!names.length)b.appendChild(el('span','pq-nm pq-add','＋ 이름'));
        else{b.appendChild(el('span','pq-nm pq-st',names[0]));names.slice(1,4).forEach(function(n){b.appendChild(el('span','pq-nm pq-bk',n));});if(names.length>4)b.appendChild(el('span','pq-nm pq-bk','+'+(names.length-4)+'명'));}
        box.appendChild(b);
      });
    }
    function render(){
      $('pqFormBtn').textContent=M.form+' ▾';$('pqTitle').placeholder=title(M.form);
      if(doc.activeElement!==$('pqTitle'))$('pqTitle').value=M.title||'';
      var filled=M.slots.filter(function(a){return a.length;}).length;
      $('pqCount').textContent=filled+'/'+M.slots.length+'자리 · 이름 '+count(M.slots);
      stageHTML($('pqStage'));
      $('pqPad').style.height=M.active>=0?'55vh':'0';
      var fb=root.querySelector('[data-pq="fill"]');fb.hidden=M.rosterState==='none';
    }
    /* ── 선수단(읽기만) ── */
    function loadRoster(){
      if(M.rosterState==='busy'||M.rosterState==='ok')return Promise.resolve(M.roster);
      var S=win.PSBoardScoutImport;
      try{if(!S||!S.teamContext)throw Error();S.teamContext(win);}catch(_){M.rosterState='none';return Promise.resolve(null);}
      M.rosterState='busy';
      return Promise.resolve().then(function(){return S.read(win,'team');}).then(function(src){
        var rows=S.teamRows(src.team,src.tombs,win.posCode||function(v){return v;});
        M.roster=rows.filter(function(r){return clean(r.name);}).map(function(r){return {name:clean(r.name),fam:famOf(r.pos),no:r.no||''};});
        M.rosterState='ok';return M.roster;
      },function(){M.rosterState='fail';return null;});
    }
    /* ── 포메이션 시트 ── */
    function openForm(mode){
      hideSheets();pend.mode=mode;if(mode==='change')pend.form=M.form;
      $('pqFormT').textContent=mode==='change'?'포메이션 바꾸기':'빠른 보드';
      $('pqFormS').textContent=mode==='change'?'넣은 이름은 같은 자리로 따라가요':'포메이션을 고르면 자리가 놓여요';
      root.querySelector('[data-pq="form-go"]').textContent=mode==='change'?'바꾸기':'시작';
      var body=$('pqFormBody');body.textContent='';
      var draft=win.__psQuickDraft;
      if(mode==='new'&&draft&&count(draft.slots)){var d=el('button','pq-btn pq-draft');d.type='button';d.setAttribute('data-pq','draft');d.appendChild(el('span',null,'쓰던 보드 이어서'));d.appendChild(el('small',null,draft.form+' · 이름 '+count(draft.slots)+'개'));body.appendChild(d);}
      GROUPS.forEach(function(g){
        body.appendChild(el('div','pq-cap',g[0]));var grid=el('div','pq-fchips');
        g[1].forEach(function(k){var b=el('button','pq-fchip',k);b.type='button';b.setAttribute('aria-pressed',String(pend.form===k));b.setAttribute('data-form',k);grid.appendChild(b);});
        body.appendChild(grid);
      });
      if(mode==='new'){
        body.appendChild(el('div','pq-cap','처음 채우기'));
        var n=M.rosterState==='ok'&&M.roster?M.roster.length:0,can=M.rosterState!=='none'&&M.rosterState!=='fail';
        if(!can&&pend.fill==='roster')pend.fill='blank';
        [['roster','선수단 순서로 채우기',M.rosterState==='ok'?('선수단 '+n+'명 · 포지션별 순서 그대로'):(M.rosterState==='busy'?'선수단 확인 중…':'팀 운영 › 선수단을 읽을 수 없어요')],['blank','빈 자리로 시작','이름을 직접 넣어요']].forEach(function(o){
          var lab=el('label','pq-opt'),r=el('input');r.type='radio';r.name='pqFill';r.value=o[0];r.id='pqFill-'+o[0];r.checked=pend.fill===o[0];r.disabled=o[0]==='roster'&&!can;
          r.addEventListener('change',function(){pend.fill=o[0];});
          var c=el('div','pq-ot');c.appendChild(el('span',null,o[1]));c.appendChild(el('small',null,o[2]));lab.appendChild(r);lab.appendChild(c);body.appendChild(lab);
        });
      }
      root.querySelector('.pq-scrim').hidden=false;$('pqForm').hidden=false;
    }
    function formGo(){
      if(pend.mode==='change'){changeForm(pend.form);hideSheets();render();return;}
      var go=function(){M.form=pend.form;M.slots=pend.fill==='roster'&&M.roster?fill(M.form,M.roster):blank(M.form);M.title='';M.dirty=true;win.__psQuickDraft=null;hideSheets();render();
        if(pend.fill==='roster'&&!M.roster)toast('선수단을 읽지 못해 빈 자리로 시작했어요');};
      if(pend.fill==='roster'&&M.rosterState==='busy'){root.querySelector('[data-pq="form-go"]').disabled=true;loadRoster().then(function(){root.querySelector('[data-pq="form-go"]').disabled=false;go();});return;}
      go();
    }
    function changeForm(next){
      if(next===M.form)return;
      setUndo();var r=remap(M.form,M.slots,next);M.form=next;M.slots=r.slots;M.dirty=true;
      toast(r.lost.length?(next+'에 없는 자리('+r.lost.map(function(x){return x.code+' '+x.n+'명';}).join(' · ')+')는 뺐어요'):(next+'로 바꿨어요'),true);
    }
    /* ── 자리 시트 ── */
    function openPos(i){
      hideSheets();M.active=i;M.showAll=false;$('pqPos').hidden=false;render();paintPos();
      var b=root.querySelector('.pq-slot[data-i="'+i+'"]'),body=$('pqBody');
      if(b)try{body.scrollTo({top:Math.max(0,b.offsetTop+$('pqStage').offsetTop-40),behavior:'smooth'});}catch(_){body.scrollTop=Math.max(0,b.offsetTop-40);}
    }
    function paintPos(){
      var i=M.active;if(i<0)return;var s=slotsOf(M.form)[i],names=M.slots[i];
      $('pqPosBdg').textContent=META[s[0]][0];$('pqPosName').textContent=META[s[0]][1];
      $('pqPosSub').textContent=names.length?(names.length+'명 · 위가 주전'):'아직 비어 있어요';
      var ol=$('pqList');ol.textContent='';ol.hidden=!names.length;
      names.forEach(function(n,j){
        var li=el('li');li.appendChild(el('span','pq-ord',j===0?'주전':(j+1)+'번째'));li.appendChild(el('span','pq-n',n));
        if(j>0){var up=el('button','pq-btn','↑');up.type='button';up.setAttribute('aria-label',n+' 한 칸 위로');up.setAttribute('data-up',String(j));li.appendChild(up);}
        var rm=el('button','pq-btn','×');rm.type='button';rm.setAttribute('aria-label',n+' 빼기');rm.setAttribute('data-rm',String(j));li.appendChild(rm);
        ol.appendChild(li);
      });
      var f=fam(s[0]),chips=$('pqChips'),more=$('pqMore'),cap=$('pqChipCap');chips.textContent='';
      if(!M.roster){cap.hidden=true;more.hidden=true;if(M.rosterState==='busy')chips.appendChild(el('span','pq-note','선수단 확인 중…'));return;}
      cap.hidden=false;more.hidden=false;
      var near=FALLBACK[f]||[],pool=M.roster.filter(function(r){return names.indexOf(r.name)<0&&(M.showAll||r.fam===f||near.indexOf(r.fam)>=0);});
      if(M.showAll)pool=pool.slice().sort(function(a,b){return (a.fam===f?0:1)-(b.fam===f?0:1);});
      cap.textContent=M.showAll?'선수단 · 전체':('선수단 · '+(FAM_KO[f]||META[s[0]][1]));
      pool.forEach(function(r){
        var w=where(r.name),b=el('button','pq-chip'+(w>=0?' pq-placed':''),r.name);b.type='button';b.setAttribute('data-name',r.name);
        if(w>=0)b.appendChild(el('small',null,META[slotsOf(M.form)[w][0]][0]+'에서 옮기기'));
        else if(M.showAll&&r.fam!==f)b.appendChild(el('small',null,FAM_KO[r.fam]||'포지션 없음'));
        chips.appendChild(b);
      });
      if(!pool.length)chips.appendChild(el('span','pq-note',M.showAll?'선수단을 다 넣었어요':'이 자리 선수단은 다 넣었어요'));
      more.textContent=M.showAll?'이 자리 선수만 보기':'다른 자리 선수도 보기';
      $('pqPrev').disabled=i===0;$('pqNext').textContent=i===M.slots.length-1?'끝':'다음 자리 ›';
    }
    function refreshPos(){M.dirty=true;paintPos();render();}
    function addName(i,n){
      n=clean(n);if(!n||i<0)return;
      if(M.slots[i].indexOf(n)>=0)return;
      if(M.slots[i].length>=MAX_NAMES){toast('한 자리에 '+MAX_NAMES+'명까지 넣을 수 있어요');return;}
      var w=where(n);if(w>=0)M.slots[w].splice(M.slots[w].indexOf(n),1);
      M.slots[i].push(n);refreshPos();
    }
    function submit(){var inp=$('pqInput');String(inp.value).split(/[,，、·\/]+/).forEach(function(n){addName(M.active,n);});inp.value='';try{inp.focus();}catch(_){}}
    function pasteGo(){
      var r=parse($('pqPasteText').value,M.form,M.slots);
      if(!r.hit){toast(r.miss.length?('자리를 못 찾았어요: '+r.miss.slice(0,3).join(', ')):'붙여 넣은 내용이 없어요');return;}
      setUndo();M.slots=r.slots;M.dirty=true;$('pqPasteText').value='';hideSheets();render();
      toast('이름 '+r.hit+'개를 넣었어요'+(r.miss.length?(' · 못 찾은 자리 '+r.miss.slice(0,2).join(', ')):''),true);
    }
    /* ── 저장 ── */
    function canWrite(){
      try{if(doc.body.classList.contains('ps-viewonly')){toast('보기 권한이라 보관함에 담을 수 없어요');return false;}}catch(_){}
      try{if(typeof psVaultRequireLogin==='function'&&!psVaultRequireLogin())return false;}catch(_){return false;}
      return typeof libTurn==='function'&&typeof libGet==='function'&&typeof libWrite==='function';
    }
    function thumb(snap){try{var th=win.__snapToThumb;return typeof th==='function'?(th(snap)||''):'';}catch(_){return '';}}
    function save(){
      if(M.saving)return;
      if(!count(M.slots)){toast('이름을 하나 이상 넣어 주세요');return;}
      if(!canWrite())return;
      M.saving=true;var btn=root.querySelector('[data-pq="save"]');btn.disabled=true;btn.textContent='저장 중…';
      var editId=M.editing,form=M.form,slots=copy(M.slots),name=M.title,saved=null;
      libTurn(function(){return libGet().then(function(lib){
        if(editId){
          var d=null;for(var i=0;i<lib.length;i++){if(lib[i]&&lib[i].libId===editId){d=lib[i];break;}}
          if(!d||!editable(d))throw Object.assign(Error('gone'),{psQuick:'gone'});
          if(typeof canEditItem==='function'&&!canEditItem(d))throw Object.assign(Error('owner'),{psQuick:'owner'});
          applyEdit(d,form,slots,name);d.thumb=thumb(d.snap);if(d.pages&&d.pages[0])d.pages[0].thumb=d.thumb;saved=d;
        }else{
          var it=itemFor(form,slots,name);it.thumb=thumb(it.snap);try{if(typeof stampCreator==='function')stampCreator(it);}catch(_){}
          lib.unshift(it);saved=it;
        }
        return libWrite(lib).then(function(){try{if(typeof libTouch==='function')libTouch();}catch(_){}});
      });}).then(function(){
        M.saving=false;win.__psQuickDraft=null;close();
        boardToast(editId?'빠른 보드를 고쳤어요':'보관함 › 보드에 저장했어요');
        try{if(typeof renderDrillFiles==='function')renderDrillFiles();}catch(_){}
        showSaved(saved,!!editId);
      },function(e){
        M.saving=false;btn.disabled=false;btn.textContent='저장';
        toast(e&&e.psVaultLocked?'보관함을 쓰려면 먼저 로그인해 주세요':(e&&e.psQuick==='gone'?'이 보드를 보관함에서 찾지 못했어요 — 지워졌거나 아직 이 기기에 오지 않았어요':(e&&e.psQuick==='owner'?'만든 사람만 고칠 수 있어요':'저장하지 못했어요 — 이름은 그대로 있어요. 다시 눌러 주세요')));
      });
    }
    /* 저장한 보드를 보관함 보기로 — 보던 빠른 보드는 닫고 새 판으로 다시 연다 */
    function showSaved(d,wasView){
      var open=win.__vaultOpenView;if(typeof open!=='function'||!d)return;
      var go=function(){try{open(d);}catch(_){}};
      if(wasView&&viewing(win)){var c=$('vCreateCancel');if(c){c.click();win.setTimeout(go,120);return;}}
      win.setTimeout(go,0);
    }
    /* ── 열기 · 닫기 ── */
    function open(){
      var e=entry(win);if(!e)return false;
      if(!root)build();root.hidden=false;doc.body.classList.add('ps-quick-on');
      M.active=-1;M.showAll=false;M.undo=null;M.saving=false;M.dirty=false;
      var sb=root.querySelector('[data-pq="save"]');sb.disabled=false;sb.textContent='저장';
      if(M.rosterState!=='ok')M.rosterState='idle';
      var ready=loadRoster().then(function(){if(!root.hidden){if(!$('pqForm').hidden&&pend.mode==='new')openForm('new');if(M.active>=0)paintPos();render();}});
      if(e.mode==='edit'){
        var d=win.__vvItem;M.editing=d.libId;M.form=d.quick.form;M.slots=slotsFrom(d);M.title=d.name||'';hideSheets();render();
      }else{
        M.editing=null;M.form=DEFAULT_FORM;M.slots=blank(M.form);M.title='';pend.form=DEFAULT_FORM;pend.fill='roster';render();openForm('new');
      }
      win.__psQuickReady=ready;
      return true;
    }
    function close(){if(!root)return;hideSheets();root.hidden=true;doc.body.classList.remove('ps-quick-on');try{var q=doc.querySelector('#psPhoneBoardNotice [data-quick]');if(q)q.focus();}catch(_){}}
    function back(){
      if(!$('pqAsk').hidden){hideSheets();return;}
      if(M.editing){if(M.dirty){hideSheets();root.querySelector('.pq-scrim').hidden=false;$('pqAsk').hidden=false;return;}close();return;}
      if(count(M.slots)&&M.dirty){win.__psQuickDraft={form:M.form,slots:copy(M.slots),title:M.title};boardToast('쓰던 빠른 보드는 남겨 뒀어요 — «＋ 빠른 보드»에서 이어서');}
      close();
    }
    function onClick(e){
      var t=e.target,b=t.closest('[data-pq],[data-form],[data-up],[data-rm],[data-name]');if(!b||!root.contains(b))return;
      if(b.hasAttribute('data-form')){pend.form=b.getAttribute('data-form');$('pqFormBody').querySelectorAll('.pq-fchip').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});return;}
      if(b.hasAttribute('data-up')){var j=+b.getAttribute('data-up'),a=M.slots[M.active],n=a[j];a.splice(j,1);a.splice(j-1,0,n);refreshPos();return;}
      if(b.hasAttribute('data-rm')){M.slots[M.active].splice(+b.getAttribute('data-rm'),1);refreshPos();return;}
      if(b.hasAttribute('data-name')){addName(M.active,b.getAttribute('data-name'));return;}
      switch(b.getAttribute('data-pq')){
        case 'back':back();break;
        case 'save':save();break;
        case 'form':openForm('change');break;
        case 'form-close':if(pend.mode==='new'&&!M.dirty&&!M.editing){close();break;}hideSheets();render();break;
        case 'form-go':formGo();break;
        case 'draft':var d=win.__psQuickDraft;if(d){M.form=d.form;M.slots=copy(d.slots);M.title=d.title||'';M.dirty=true;}hideSheets();render();break;
        case 'fill':
          if(M.rosterState==='busy'){toast('선수단 확인 중…');break;}
          loadRoster().then(function(r){if(!r){toast('팀 운영 › 선수단을 읽지 못했어요 — 팀 자료가 준비된 뒤 다시 눌러 주세요');return;}setUndo();M.slots=fill(M.form,r);M.dirty=true;hideSheets();render();toast('선수단 뎁스 순서로 채웠어요',true);});break;
        case 'paste':hideSheets();render();root.querySelector('.pq-scrim').hidden=false;$('pqPaste').hidden=false;win.setTimeout(function(){try{$('pqPasteText').focus();}catch(_){}},60);break;
        case 'paste-close':hideSheets();render();break;
        case 'paste-go':pasteGo();break;
        case 'clear':if(!count(M.slots))break;setUndo();M.slots=blank(M.form);M.dirty=true;hideSheets();render();toast('모든 자리를 비웠어요',true);break;
        case 'undo':if(M.undo){M.form=M.undo.form;M.slots=M.undo.slots;M.undo=null;hideSheets();render();}root.querySelector('.pq-toast').hidden=true;break;
        case 'add':submit();break;
        case 'more':M.showAll=!M.showAll;paintPos();break;
        case 'pos-close':hideSheets();render();break;
        case 'prev':if(M.active>0)openPos(M.active-1);break;
        case 'next':if(M.active<M.slots.length-1)openPos(M.active+1);else{hideSheets();render();}break;
        case 'ask-stay':hideSheets();break;
        case 'ask-leave':close();break;
      }
    }
    return {open:open,close:close,state:function(){return M;},root:function(){return root;}};
  }

  function install(win){
    if(!win||win.__psQuickDepth)return win&&win.__psQuickDepth;
    var ui=null;
    if(!wrapTokens(win))win.document.addEventListener('DOMContentLoaded',function(){wrapTokens(win);});
    win.__psQuickDepth={open:function(){if(!ui)ui=make(win);return ui.open();},ui:function(){return ui;}};
    return win.__psQuickDepth;
  }
  function open(win){win=win||(typeof window!=='undefined'?window:null);var q=win&&(win.__psQuickDepth||install(win));return q?q.open():false;}

  return {META:META,FORMS:FORMS,GROUPS:GROUPS,FALLBACK:FALLBACK,famOf:famOf,fill:fill,remap:remap,parse:parse,splitNames:splitNames,at:at,
    snapFor:snapFor,itemFor:itemFor,editable:editable,slotsFrom:slotsFrom,applyEdit:applyEdit,title:title,decorate:decorate,entry:entry,install:install,open:open,
    MAX_NAMES:MAX_NAMES,TAG:TAG};
});
