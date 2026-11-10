/* 데스크톱 탭 종료 기록(제보 de2e508c — 맥 크롬 설치 앱이 «앗, 이런! 오류 코드: 5»로 거듭 꺼졌는데 서버에 boot_after_crash 가 한 줄도 없었다).
   app.html 의 3.034 표식(ps_boot_alive_v1)은 폰 · 아이패드만 돈다(`if(dev==='desktop')return`) — 데스크톱은 이 모듈이 맡는다. 맨 위 창 · data-ps-device=desktop 에서만.
   ① 표식: 탭마다 localStorage `ps_crash_crumb_v1:<탭>` 한 줄(300자 안팎 — 시각 · 단계 · 화면 · 마지막 누른 단추 이름 · 힙 MB · 보관함 수/KB, 내용 없음).
      30초마다 · 누른 직후(1초에 한 번) 고쳐 쓴다. 정상으로 떠나면(pagehide · 스스로 새로고침 __psBootMarkDone · freeze) 지운다.
   ② 살아 있음: 탭이 Web Lock `ps-crash-alive:<탭>` 을 쥔다. 렌더러가 죽으면 잠금이 풀리고 표식만 남는다 — 다음 부팅(같은 탭 · 새 창 모두)이
      잠금 없는 표식을 «죽은 탭»으로 읽어 ps_events boot_after_crash 한 줄(가장 최근 것 하나)을 보내고 표식을 지운다. 탭 버림(document.wasDiscarded)은 죽음이 아니다.
      잠금이 없는 브라우저 · 가득 찬 작은 저장소는 sessionStorage(같은 탭을 다시 열 때만).
   ③ meta 는 sync.js safeEventMeta 가 받는 12칸: 숫자 age · min · heap · peak · lim · n · kb · maxKb, 문자열은 stage · reason · msg · mode 만.
   ⚠ 표식 · age 만으로 메모리 종료 · 강제 닫기 · 전원 꺼짐을 가를 수 없다(CLAUDE.md «폰 강제 종료 · 메모리»). performance.memory 는 크로미움만, 값은 굵게 묶이고 늦게 바뀐다.
   판정 · 꾸리기는 순수 함수(pick · meta · codeOf · scan)로 나눠 시험이 그대로 부른다. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSCrashCrumb=api;
  try{if(root&&root.top===root&&root.document&&(root.document.documentElement.getAttribute('data-ps-device')||'desktop')==='desktop')api.mount(root);}catch(_){}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var KEY='ps_crash_crumb_v1',PRE='ps_crash_crumb_v1:',LOCK='ps-crash-alive:',LIB='cs_drill_lib_v1',BEAT=30000,WRITE_GAP=1000,KEEP_MS=7*86400000,HIDE_MS=600000,ACTS=6;
  function num(v){v=+v;return Number.isFinite(v)?v:0;}
  function word(v,n){return String(v==null?'':v).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,n||16);}
  function dot(v,n){return String(v==null?'':v).replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,n||22);}   /* 틀.단추 */
  function mb(v){return Math.round(num(v)/1048576);}
  /* 누른 것의 이름 — id · 정해 둔 data 속성 값 · 첫 class 만(글자 · 값 · 주소는 읽지 않는다). 긴 숫자(자료 id 꼬리)는 N 으로 */
  var DATA=['data-app','data-tb','data-tb-app','data-tool','data-act','data-mode','data-view','data-tab'];
  function codeOf(el){
    try{
      var b=el&&el.closest?el.closest('button,a,[role="button"],summary,label,select,input,[onclick],[data-act],[data-app]'):null;if(!b)b=el;if(!b||!b.getAttribute)return '';
      var c=b.id||'';
      if(!c)for(var i=0;i<DATA.length&&!c;i++){var v=b.getAttribute(DATA[i]);if(v)c=DATA[i].slice(5)+'-'+v;}
      if(!c){var names=b.getAttributeNames?b.getAttributeNames():[];for(var j=0;j<names.length&&!c;j++)if(/^data-[a-z-]+$/.test(names[j]))c=names[j].slice(5);}
      if(!c)c=String(b.getAttribute('class')||'').trim().split(/\s+/)[0]||String(b.tagName||'').toLowerCase();
      return word(String(c).replace(/\d{4,}/g,'N'),18);
    }catch(_){return '';}
  }
  /* 보관함 원문(목록 한 덩어리 JSON 글)에서 자료 수 · 가장 큰 자료를 어림한다 — 해석하지 않고 "libId": 자리만 센다(새 글 · 객체를 만들지 않는다) */
  function scan(raw){
    var out={n:-1,kb:-1,maxKb:-1};if(typeof raw!=='string')return out;
    var n=0,max=0,at=raw.indexOf('"libId":'),prev=-1;
    while(at>=0){n++;if(prev>=0&&at-prev>max)max=at-prev;prev=at;at=raw.indexOf('"libId":',at+8);}
    if(prev>=0&&raw.length-prev>max)max=raw.length-prev;
    out.n=n;out.kb=Math.round(raw.length/1024);out.maxKb=Math.round(max/1024);return out;
  }
  function parse(raw){try{var m=JSON.parse(raw);return m&&typeof m==='object'&&num(m.t)>0?m:null;}catch(_){return null;}}
  /* 죽은 표식 고르기: entries=[{id,m}], held=쥐고 있는 잠금 이름들(null=잠금을 못 읽음 → 판정하지 않는다), skip=버려진 탭 · 내 탭 */
  function pick(entries,held,now,skip){
    var dead=[],stale=[],live={};(held||[]).forEach(function(n){live[n]=1;});skip=skip||{};
    (entries||[]).forEach(function(e){
      if(!e||!e.id||skip[e.id])return;
      if(!e.m||now-num(e.m.t)>KEEP_MS){stale.push(e.id);return;}
      if(!held)return;
      if(!live[LOCK+e.id])dead.push(e);
    });
    dead.sort(function(a,b){return num(b.m.t)-num(a.m.t);});
    return {dead:dead,stale:stale,report:dead[0]||null};
  }
  function meta(m,now,count){
    m=m||{};var acts=Array.isArray(m.a)?m.a:[],t=num(m.t);
    var stage=word(m.s,12)||'none';if(num(m.w)>=0&&m.w!=null)stage+='w'+(num(m.w)|0);if(num(m.x))stage+='t'+(num(m.x)|0);
    stage+=(m.l?'':'.early')+(m.hid?'.hid':'')+(num(count)>1?'.x'+Math.min(99,num(count)|0):'');
    return {age:Math.max(0,Math.round((num(now)-t)/1000)),min:Math.round(Math.max(0,t-num(m.b))/6000)/10,
      stage:stage.slice(0,80),reason:String(m.v||'').replace(/[^a-zA-Z0-9 :._+-]/g,'').slice(0,80),
      msg:acts.slice(-ACTS).map(function(a){return dot(a&&a[0],22)+'~'+Math.max(0,Math.round((t-num(a&&a[1]))/1000));}).join(',').slice(0,120),
      mode:String(m.d||'').replace(/[^a-zA-Z0-9 @.x-]/g,'').slice(0,80),
      heap:num(m.h),peak:num(m.p),lim:num(m.q),n:m.n==null?-1:num(m.n),kb:m.k==null?-1:num(m.k),maxKb:m.g==null?-1:num(m.g)};
  }
  var api={KEY:KEY,LOCK:LOCK,BEAT:BEAT,codeOf:codeOf,scan:scan,parse:parse,pick:pick,meta:meta,state:function(){return null;},flush:function(){},check:function(){return Promise.resolve(null);}};

  api.mount=function(win){
    if(!win||win.__psCrashCrumbMounted)return;win.__psCrashCrumbMounted=true;
    var doc=win.document,nav=win.navigator||{},LS=null,SS=null;
    try{LS=win.localStorage;}catch(_){} try{SS=win.sessionStorage;}catch(_){}
    var id=word(Date.now().toString(36)+Math.random().toString(36).slice(2,8),16),mine=PRE+id,bootAt=Date.now();
    var st={t:bootAt,b:bootAt,l:0,s:'shell',w:null,x:0,hid:0,v:'',a:[],h:0,p:0,q:0,n:null,k:null,g:null,d:''};
    var armed=false,release=null,lastWrite=0,trail=0,beat=0,inSession=false,hooked=typeof WeakSet==='function'?new WeakSet():null,RANK={shell:0,board:1,boardload:2,sync:3,load:4};
    /* 앞 문서(같은 탭)의 탭 id — 버려진 탭(wasDiscarded)을 죽음으로 세지 않으려고 */
    var prevTab='';try{prevTab=word(SS&&SS.getItem(PRE+'tab'),16);if(SS)SS.setItem(PRE+'tab',id);}catch(_){}

    function env(){
      var dm='browser';try{['fullscreen','standalone','minimal-ui'].some(function(k){if(win.matchMedia('(display-mode: '+k+')').matches){dm=k;return true;}return false;});}catch(_){}
      var ua=String(nav.userAgent||''),os=/Mac OS X/.test(ua)?'mac':/Windows/.test(ua)?'win':/CrOS/.test(ua)?'cros':/Linux/.test(ua)?'linux':'other';
      var br=/Edg\/(\d+)/.exec(ua)?'ed'+RegExp.$1:/Chrome\/(\d+)/.exec(ua)?'cr'+RegExp.$1:/Firefox\/(\d+)/.exec(ua)?'ff'+RegExp.$1:/Version\/(\d+).*Safari/.exec(ua)?'sf'+RegExp.$1:'x';
      var sc=win.screen||{};
      return dm+' '+(num(sc.width)|0)+'x'+(num(sc.height)|0)+'@'+(Math.round(num(win.devicePixelRatio)*10)/10)+' c'+(nav.hardwareConcurrency|0)+' m'+num(nav.deviceMemory)+' '+os+' '+br;
    }
    /* 지금 화면: 셸의 앱 · 팀 화면 · 보이는 틀 · 열린 틀 수 · 작전판 상태(3D · 영상/GIF 내보내기 · 미팅 · 자료 편집 · 썸네일) · 페이지/장면 수 */
    function view(){
      var out=[];
      try{
        var b=doc.body;out.push(word(b&&b.getAttribute('data-ps-app'),10)||'none');
        if(b&&b.classList.contains('ps-team-open')){var sec='';try{sec=word(win.__psTeamSection&&win.__psTeamSection(),10);}catch(_){}out.push('team'+(sec?':'+sec:''));}
        var fr=doc.getElementsByTagName('iframe'),open=0,seen='';
        for(var i=0;i<fr.length;i++){var f=fr[i],src=f.getAttribute('src')||'';if(!src||/^about:/.test(src))continue;open++;
          if(!seen&&f.offsetWidth>0&&win.getComputedStyle(f).visibility!=='hidden')seen=word(f.id,10);}
        if(seen)out.push('f:'+seen);out.push('fr'+open);
        var bw=null;try{var fb=doc.getElementById('fBoard');bw=fb&&fb.contentWindow;var bb=bw&&bw.document&&bw.document.body;
          if(bb){[['bc-tilt3d','3d'],['meet-mode','meet'],['editing','edit'],['vcreating','vcreate'],['ps-capturing','cap'],['comm-viewing','comm'],['ps-board-dirty','dirty']].forEach(function(p){if(bb.classList.contains(p[0]))out.push(p[1]);});
            if(bw.__animExport)out.push('exp');if(bw.__psThumbCapturing)out.push('thumb');
            var pg=bw.__psPages&&bw.__psPages.pg&&bw.__psPages.pg();if(Array.isArray(pg)){var sc=0;pg.forEach(function(p){sc+=(p&&p.anim&&Array.isArray(p.anim.frames)?p.anim.frames.length:0);});out.push('pg'+pg.length+'s'+sc);}}
        }catch(_){}
      }catch(_){}
      return out.join(' ').slice(0,80);
    }
    function sample(){
      try{var pm=win.performance&&win.performance.memory;if(pm){st.h=mb(pm.usedJSHeapSize);st.q=mb(pm.jsHeapSizeLimit);if(st.h>st.p)st.p=st.h;}}catch(_){}
      st.v=view();if(!st.d)st.d=env();
    }
    function write(){
      if(!armed)return;lastWrite=st.t=Date.now();var raw;try{raw=JSON.stringify(st);}catch(_){return;}
      try{LS.setItem(mine,raw);if(inSession){inSession=false;try{SS.removeItem(KEY);}catch(_){}}return;}catch(_){}
      try{SS.setItem(KEY,raw);inSession=true;}catch(_){}   /* 작은 저장소가 가득 — 같은 탭을 다시 열 때만 읽힌다 */
    }
    function soon(){
      if(!armed)return;var gap=Date.now()-lastWrite;
      if(gap>=WRITE_GAP){win.clearTimeout(trail);trail=0;sample();write();}
      else if(!trail)trail=win.setTimeout(function(){trail=0;sample();write();},WRITE_GAP-gap);
    }
    function act(code){code=dot(code,22);if(!code)return;st.a.push([code,Date.now()]);if(st.a.length>ACTS)st.a.splice(0,st.a.length-ACTS);soon();}
    function clear(){try{LS.removeItem(mine);}catch(_){} if(inSession){try{SS.removeItem(KEY);}catch(_){}inSession=false;}}
    function disarm(){armed=false;win.clearInterval(beat);beat=0;win.clearTimeout(trail);trail=0;clear();if(release){try{release();}catch(_){}release=null;}}
    function arm(){
      if(armed)return;armed=true;
      var go=function(){if(!armed)return;sample();write();win.clearInterval(beat);beat=win.setInterval(function(){frames();sample();write();},BEAT);};
      var L=nav.locks;
      if(L&&typeof L.request==='function'){
        /* 잠금을 쥔 뒤에만 표식을 쓴다 — 다른 창의 부팅이 «잠금 없는 표식»으로 잘못 읽지 않게 */
        try{L.request(LOCK+id,function(){if(!armed)return undefined;go();return new Promise(function(res){release=res;});}).catch(function(){});}catch(_){go();}
      }else go();
    }
    /* 틀마다: 누른 것(capture · passive) · 단축키 · 보관함 원문 크기(이미 읽은 글의 길이만 — 읽기를 더하지 않는다) */
    function hook(w,tag){
      try{
        var d=w.document;if(!d)return;
        if(!(hooked&&hooked.has(d))){if(hooked)hooked.add(d);
          d.addEventListener('click',function(e){var c=codeOf(e.target);if(c)act(tag+c);},{capture:true,passive:true});
          d.addEventListener('keydown',function(e){if((e.metaKey||e.ctrlKey)&&e.key&&/^[a-zA-Z]$/.test(e.key))act(tag+'key-'+e.key.toLowerCase()+(e.shiftKey?'S':''));},{capture:true,passive:true});}
        var S=w.storage;   /* storage.js 가 늦게 읽히는 틀은 다음 훑기(틀 load · 10 · 30 · 60초 · 30초 박동)에서 감싼다 */
        if(S&&typeof S.get==='function'&&!S.__psCrumb){S.__psCrumb=1;var get=S.get,set=S.set;
          S.get=function(k){var p=get.apply(this,arguments);if(k===LIB){try{p.then(function(r){vault(r&&r.value);},function(){});}catch(_){}}return p;};
          if(typeof set==='function')S.set=function(k,v){if(k===LIB)vault(v);return set.apply(this,arguments);};}
      }catch(_){}
    }
    var vaultLen=-1;
    function vault(raw){try{if(typeof raw!=='string'||raw.length===vaultLen)return;vaultLen=raw.length;var s=scan(raw);st.n=s.n;st.k=s.kb;st.g=s.maxKb;soon();}catch(_){}}
    function frames(){hook(win,'');try{var fr=doc.getElementsByTagName('iframe');for(var i=0;i<fr.length;i++){var w=null;try{w=fr[i].contentWindow;if(!w||!w.document||w.location.href==='about:blank')continue;}catch(_){continue;}hook(w,(word(fr[i].id,6).replace(/^f/,'').toLowerCase()||'fr')+'.');}}catch(_){}}

    /* 셸 · 동기화가 이미 부르는 발자국(app.html 3.036 · 3.070 — 폰에서만 정의됐다)을 데스크톱에서도 받는다 */
    if(typeof win.__psBootStage!=='function')win.__psBootStage=function(code){code=word(code,12);if(!code)return;
      if(/^w\d+$/.test(code))st.w=+code.slice(1)||0;else if(/^t\d+$/.test(code))st.x=Math.max(st.x,+code.slice(1)||0);else if(RANK[code]==null||RANK[code]>=(RANK[st.s]||0))st.s=code;soon();};
    if(typeof win.__psBootCrumb!=='function')win.__psBootCrumb=function(c){act('c-'+word(c,12));};
    if(typeof win.__psBootMarkDone!=='function')win.__psBootMarkDone=function(){disarm();win.setTimeout(function(){if(!armed&&!gone)arm();},4000);};   /* 스스로 하는 새로고침 직전. 취소되면 다시 지킨다 */
    var gone=false;
    win.addEventListener('pagehide',function(){gone=true;disarm();});
    win.addEventListener('pageshow',function(e){if(e&&e.persisted){gone=false;arm();}});
    try{doc.addEventListener('freeze',function(){disarm();});doc.addEventListener('resume',function(){if(!gone)arm();});}catch(_){}
    /* 숨은 탭은 10분까지만 지킨다 — 잠금을 쥔 탭은 크롬이 얼리거나 버리지 않으므로(메모리 절약) 오래 숨으면 표식 · 잠금을 내려놓고, 다시 보이면 쥔다 */
    var hideT=0;
    doc.addEventListener('visibilitychange',function(){st.hid=doc.hidden?1:0;win.clearTimeout(hideT);hideT=0;
      if(doc.hidden){soon();hideT=win.setTimeout(function(){if(doc.hidden)disarm();},HIDE_MS);}else if(!gone){if(armed)soon();else arm();}});
    doc.addEventListener('load',function(e){var t=e&&e.target;if(t&&t.tagName==='IFRAME')win.setTimeout(frames,0);},true);
    win.addEventListener('load',function(){st.l=1;try{win.__psBootStage('load');}catch(_){}frames();[10,30,60].forEach(function(sec){win.setTimeout(function(){st.x=Math.max(st.x,sec);frames();soon();},sec*1000);});});
    st.hid=doc.hidden?1:0;

    /* 앞에서 죽은 탭 찾기 → 한 줄 보내기 */
    function entries(){var out=[];try{for(var i=0;i<LS.length;i++){var k=LS.key(i);if(k&&k.indexOf(PRE)===0&&k!==mine)out.push({id:k.slice(PRE.length),m:parse(LS.getItem(k))});}}catch(_){}return out;}
    function send(m,count){
      var tries=0;(function go(){try{var S=win.PSSync;
        if(S&&typeof S.event==='function'&&S.session&&S.session()){var mt=meta(m,bootAt,count);
          S.event('boot_after_crash',{status:'error',feature:'app',error_code:'D:'+(word(String(m.v||'').split(' ')[0],12)||'none'),always:true,meta:mt});api.last=mt;return;}}catch(_){return;}
        if(++tries<120)win.setTimeout(go,500);})();
    }
    function check(){
      var skip={};skip[id]=1;var discarded=false;try{discarded=doc.wasDiscarded===true;}catch(_){}
      var own=null;try{own=parse(SS&&SS.getItem(KEY));if(SS)SS.removeItem(KEY);}catch(_){}   /* 가득 찬 저장소의 같은 탭 표식 */
      if(discarded){if(prevTab){skip[prevTab]=1;try{LS.removeItem(PRE+prevTab);}catch(_){}}own=null;}
      var L=nav.locks,can=L&&typeof L.query==='function'&&typeof L.request==='function';
      function names(){return L.query().then(function(r){return (r&&r.held||[]).map(function(x){return String(x&&x.name||'');});},function(){return null;});}
      /* 함께 열린 창들(브라우저가 통째로 죽었다 다시 연 창 여럿)이 같은 표식을 두 번 보내지 않게 한 줄로 선다 */
      var q=can?new Promise(function(res){try{L.request('ps-crash-check',function(){return names().then(function(h){return settle(h);});}).then(res,function(){res(null);});}catch(_){res(settle(null));}}):Promise.resolve().then(function(){return settle(null);});
      return q;
      function settle(held){
        var list=entries(),r=pick(list,held,bootAt,skip);
        /* 잠금을 못 읽는 브라우저: 같은 탭이 남긴 표식(앞 문서는 이미 없다)만 믿는다 */
        if(!held&&prevTab)list.forEach(function(e){if(e.id===prevTab&&e.m&&r.stale.indexOf(e.id)<0){r.dead.push(e);}});
        if(own)r.dead.push({id:'',m:own});
        r.dead.sort(function(a,b){return num(b.m.t)-num(a.m.t);});
        r.stale.concat(r.dead.map(function(e){return e.id;})).forEach(function(k){if(k){try{LS.removeItem(PRE+k);}catch(_){}}});
        if(r.dead.length)send(r.dead[0].m,r.dead.length);
        return {dead:r.dead.length,stale:r.stale.length};
      }
    }
    api.state=function(){sample();return JSON.parse(JSON.stringify(st));};api.flush=function(){sample();write();};api.id=id;
    api.checked=check();api.check=check;
    arm();frames();
  };
  return api;
});
