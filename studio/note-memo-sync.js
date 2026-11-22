/* PROCESS STUDIO — 개인 노트 «메모»를 내 계정에(3.363 · 사용자 11/22 «동기화 먼저 해줘»).
   2.355 부터 메모(cs_notes_memo_v1 · cs_notes_folders_v1)는 적은 기기에만 있었다 — 폰에서 적은 메모가 맥에 안 보이고 저장소가 비워지면 사라졌다.
   길은 학습 기록 · 개인 게임모델과 같은 «개인 문서 통로»(셸 PSSync.memo — 내 개인 공간의 키 cs_notes_memo_sync_v1 하나 · 판본 확인 CAS).
   서버 문서 = {v:1, at, m:[메모], f:[폴더], d:{지운 id: 지운 시각}}.
   ⚠ 키 통째 덮어쓰기가 아니다 — 메모마다 합친다: 같은 id 는 updatedAt 이 더 새 쪽(같으면 이 기기), 지운 기록(d)이 마지막 수정보다 새면 지움.
      그래서 두 기기에서 따로 적어도 어느 쪽 메모도 사라지지 않는다. 올릴 때도 늘 «이 기기 + 마지막으로 본 서버»를 합친 것을 올린다
      (화면에 아직 못 받은 서버 메모를 이 기기의 목록으로 덮지 않게).
   ⚠ 빈 메모(메모 탭을 열면 생기는 «새 메모»)는 올리지 않는다 — 기기마다 하나씩 쌓인다.
   ⚠ 계정이 바뀐 기기: 이 기기의 메모가 처음 맞춰진 계정(cs_notes_memo_owner_v1)과 지금 계정이 다르면 올리지도 받지도 않는다
      (앞 사람의 메모가 뒷사람 계정에 섞이지 않게 — 그 기기에서는 예전처럼 기기에만 남는다).
   화면(note.html)은 window.__memoSync{get,set,idle} 만 내주고, 저장할 때 touched() 를 부른다. 로그인 전 · 셸 밖에서는 아무 일도 하지 않는다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){ root.PSNoteMemoSync=api; api.mount(root); }
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var TOMB_KEY='cs_notes_memo_tomb_v1', OWNER_KEY='cs_notes_memo_owner_v1';
  var MAX=1400000, TOMB_MS=180*86400000;
  var diag=[];
  function note(e){ try{ diag.push(String((e&&(e.psCode||e.message))||e)); if(diag.length>20)diag.shift(); }catch(_){ diag.length=0; } }
  function num(v){ v=+v; return isFinite(v)&&v>0?v:0; }
  function str(v){ return typeof v==='string'?v:''; }
  function okId(v){ return typeof v==='string'&&v.length>0&&v.length<=64; }

  /* 빈 메모 — 글도 꾸민 글도 없는 것 */
  function blank(m){ return !m||(!str(m.text).trim()&&!str(m.html).replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim()); }
  function memo(m){
    if(!m||typeof m!=='object'||!okId(m.id))return null;
    var up=num(m.updatedAt)||num(m.createdAt);
    return {id:m.id,text:str(m.text),html:str(m.html),folder:str(m.folder),pinned:!!m.pinned,createdAt:num(m.createdAt)||up,updatedAt:up};
  }
  function folder(f){
    if(!f||typeof f!=='object'||!okId(f.id))return null;
    var o={id:f.id,name:str(f.name).slice(0,24)}; if(num(f.at))o.at=num(f.at); return o;
  }
  function side(s){
    s=s||{}; var d={}, src=(s.d&&typeof s.d==='object'&&!Array.isArray(s.d))?s.d:{}, k;
    for(k in src){ if(Object.prototype.hasOwnProperty.call(src,k)&&okId(k)&&num(src[k]))d[k]=num(src[k]); }
    return {m:(Array.isArray(s.m)?s.m:[]).map(memo).filter(Boolean),f:(Array.isArray(s.f)?s.f:[]).map(folder).filter(Boolean),d:d};
  }
  /* 두 쪽을 합친다. 차례는 이 기기 것 먼저 · 서버에만 있는 것은 뒤에(화면이 다시 정렬한다). */
  function merge(local,remote,now){
    var L=side(local), R=side(remote), d={}, k, t=num(now)||Date.now();
    [R.d,L.d].forEach(function(x){ for(k in x){ if(x[k]>(d[k]||0))d[k]=x[k]; } });
    for(k in d){ if(t-d[k]>TOMB_MS)delete d[k]; }
    function pick(a,b,stamp){
      var by={}, order=[];
      a.forEach(function(x){ by[x.id]=x; order.push(x.id); });
      b.forEach(function(x){ var y=by[x.id]; if(!y){ by[x.id]=x; order.push(x.id); } else if(stamp(x)>stamp(y))by[x.id]=x; });
      return order.map(function(id){ return by[id]; }).filter(function(x){ return !(d[x.id]&&d[x.id]>=stamp(x)); });
    }
    var f=pick(L.f,R.f,function(x){ return x.at||0; });
    var has={}; f.forEach(function(x){ has[x.id]=1; });
    var m=pick(L.m,R.m,function(x){ return x.updatedAt; }).map(function(x){
      /* 지운 폴더에 있던 메모는 «모든 메모»로(폴더를 지워도 메모는 안 지운다 — 2.355) */
      if(x.folder&&!has[x.folder]&&d[x.folder]){ var c={}; for(var q in x)c[q]=x[q]; c.folder=''; return c; }
      return x;
    });
    return {m:m,f:f,d:d};
  }
  /* 서버에 올릴 모습 — 빈 메모는 빼고 id 차례로(두 기기가 같은 내용이면 같은 글자가 되게) */
  function body(s){
    var S=side(s), d={};
    Object.keys(S.d).sort().forEach(function(k){ d[k]=S.d[k]; });
    function byId(a,b){ return a.id<b.id?-1:(a.id>b.id?1:0); }
    return {m:S.m.filter(function(x){ return !blank(x); }).sort(byId),f:S.f.slice().sort(byId),d:d};
  }
  function same(a,b){ return JSON.stringify(body(a))===JSON.stringify(body(b)); }
  /* 화면에 넣어도 달라질 것이 없는가 — 빈 메모 · 차례는 보지 않는다 */
  function ids(s){ var o={}; side(s).m.forEach(function(x){ o[x.id]=1; }); side(s).f.forEach(function(x){ o[x.id]=1; }); return o; }
  /* 앞서 있던 id 가 사라졌으면 지운 기록을 남긴다 */
  function gone(known,now_,tomb,at){
    var out={}, k, t=num(at)||Date.now(); for(k in (tomb||{}))out[k]=tomb[k];
    for(k in (known||{})){ if(!now_[k]&&!out[k])out[k]=t; }
    return out;
  }
  function raw(s,at){ var b=body(s); return JSON.stringify({v:1,at:num(at)||Date.now(),m:b.m,f:b.f,d:b.d}); }

  function mount(w){
    var doc=w.document; if(!doc)return;
    var S={raw:null,cupd:null,uid:null,wid:null,t:0,rt:0,busy:false,again:false,pulled:false,known:null,tries:0,state:'local'};
    function bridge(){ var b=w.__memoSync; return (b&&typeof b.get==='function'&&typeof b.set==='function')?b:null; }
    function sync(){ try{ var p=(w.parent&&w.parent!==w)?w.parent.PSSync:w.PSSync; return (p&&p.memo&&typeof p.memo.owner==='function'&&p.memo.owner())?p.memo:null; }catch(e){ note(e); return null; } }
    function lsGet(k){ try{ return w.localStorage.getItem(k); }catch(e){ note(e); return null; } }
    /* 지운 기록은 앱의 공용 저장 길(storage.js psSaveShared)로 쓴다 — 올라가기 전에 사라지면 지운 메모가 되살아난다 */
    function tombSet(d){ try{ return typeof w.psSaveShared==='function'&&w.psSaveShared(TOMB_KEY,JSON.stringify(d))!==false; }catch(e){ note(e); return false; } }
    function ownerSet(uid){ try{ w.localStorage.setItem(OWNER_KEY,uid); return w.localStorage.getItem(OWNER_KEY)===uid; }catch(e){ note(e); return false; } }
    function tomb(){ try{ return side({d:JSON.parse(lsGet(TOMB_KEY)||'{}')}).d; }catch(e){ note(e); return {}; } }
    function local(){ var b=bridge(); if(!b)return null; var g=b.get()||{}; return {m:g.memos,f:g.folders,d:tomb()}; }
    function remote(){ try{ return S.raw?JSON.parse(S.raw):null; }catch(e){ note(e); return null; } }
    function mine(uid){ var cur=lsGet(OWNER_KEY); if(!cur)return !!uid&&ownerSet(uid); return cur===uid; }
    function later(fn,ms){ w.clearTimeout(S.rt); S.rt=w.setTimeout(fn,ms); }
    /* 합친 목록을 화면에 — 치는 중이면 미룬다(한글 조합 · 커서) */
    function adopt(M){
      var b=bridge(); if(!b)return false;
      if(typeof b.idle==='function'&&!b.idle()){ later(function(){ pull(); },3000); return false; }
      if(JSON.stringify(M.d)!==JSON.stringify(tomb())&&!tombSet(M.d))return false;
      if(b.set(M.m,M.f)===false)return false;
      S.known=ids(M); return true;
    }
    function pull(then){
      var a=sync(), L=local();
      if(!a||!L){ if(then)then(false); return; }
      a.get().then(function(r){
        if(!mine(r.uid)){ S.pulled=false; S.state='local'; if(then)then(false); return; }
        S.raw=r.raw; S.cupd=r.cupd; S.uid=r.uid; S.wid=r.wid; S.pulled=true;
        var R=remote(), now_=local();
        if(R&&now_){
          var M=merge(now_,R,Date.now());
          /* 화면에 보일 것이 달라질 때만 넣는다 — 같으면 손대지 않는다 */
          if(JSON.stringify(side(M))!==JSON.stringify(side(now_)))adopt(M);
        }
        if(then)then(true); else settle();
      }).catch(function(e){ note(e); if(then)then(false); });
    }
    function target(){ var L=local(); return L?merge(L,remote(),Date.now()):null; }
    function settle(){ var T=target(); if(T&&!same(T,remote()||{}))schedule(400); else S.state='synced'; }
    function schedule(ms){ S.state='pending'; w.clearTimeout(S.t); S.t=w.setTimeout(function(){ push(); },ms==null?2000:ms); }
    function push(retried){
      var a=sync(); if(!a)return;
      if(S.busy){ S.again=true; return; }
      if(!S.pulled){ pull(function(ok){ if(ok)push(retried); }); return; }
      var T=target(); if(!T)return;
      if(same(T,remote()||{})){ S.state='synced'; return; }
      var text=raw(T,Date.now());
      if(text.length>MAX){ S.state='local'; note('memo_too_large'); return; }
      S.busy=true;
      a.save(text,{uid:S.uid,wid:S.wid,expected_raw:S.raw,expected_cupd:S.cupd}).then(function(ack){
        S.raw=ack.raw; S.cupd=ack.cupd; S.state='synced';
      }).catch(function(e){
        note(e);
        /* 다른 기기가 먼저 썼다 → 다시 읽어 합치고 한 번만 더. 그 밖의 실패는 이 기기에 남아 다음 저장 때 다시 간다 */
        if(e&&e.psCode==='sync_conflict'&&!retried){ S.busy=false; pull(function(ok){ if(ok)push(true); }); return 'skip'; }
        if(e&&e.psCode==='sync_workspace_changed'){ S.pulled=false; }
      }).then(function(x){ if(x==='skip')return; S.busy=false; if(S.again){ S.again=false; schedule(400); } });
    }
    /* note.html persist() 가 부른다 — 사라진 id 는 지운 기록으로, 그리고 올릴 차례를 잡는다 */
    function touched(){
      try{
        var L=local(); if(!L)return;
        var now_=ids(L), t=gone(S.known,now_,L.d,Date.now());
        if(JSON.stringify(t)!==JSON.stringify(L.d))tombSet(t);
        S.known=now_;
        if(sync())schedule();
      }catch(e){ note(e); }
    }
    function start(){
      if(!bridge())return;
      if(!S.known){ var L=local(); S.known=L?ids(L):{}; }
      if(sync()){ pull(); return; }
      /* 셸의 로그인 확인이 아직이면 조금 뒤 다시(1.2 · 4 · 10 · 25초) */
      var wait=[2800,6000,15000][S.tries++]; if(wait)w.setTimeout(start,wait);
    }
    api.touched=touched;
    api.state=function(){ return S.state; };
    api.now=function(){ w.clearTimeout(S.t); push(); };
    api.pull=function(){ pull(); };
    doc.addEventListener('visibilitychange',function(){
      if(doc.visibilityState==='visible'){ if(sync())pull(); }
      else if(S.state==='pending'){ w.clearTimeout(S.t); push(); }
    });
    w.addEventListener('pagehide',function(){ if(S.state==='pending'){ w.clearTimeout(S.t); push(); } });
    w.setTimeout(start,1200);
  }

  var api={TOMB_KEY:TOMB_KEY,OWNER_KEY:OWNER_KEY,MAX:MAX,blank:blank,merge:merge,body:body,same:same,gone:gone,raw:raw,ids:ids,diag:diag,mount:mount,touched:function(){},state:function(){ return 'local'; }};
  return api;
});
