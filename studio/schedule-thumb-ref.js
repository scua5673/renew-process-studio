/* 3.315 — 일정 문서의 훈련 그림(thumb · 작전판 SVG)은 기기 사본(localStorage 거울 · IndexedDB · 기준본)에 싣지 않는다.
   실측(2026-11-17 풋볼A 주인 맥): 서버 일정 문서는 287K자(그림은 ps_blob 참조 thumbRef 62개)인데 기기 거울은 그림을 되돌린 8MB 라
   작은 저장소(10MB)가 11/9 부터 가득 차 선수단 거울(100KB)을 못 써 «선수단이 지워졌어»로 보였다. 안전 정리는 이 그림을 못 뺀다(2.622 는 전송 경계에서만 뗐다).
   이 모듈(process.html 끝에서 읽힌다):
   · 저장 — saveNow 의 replacer(`__schedRep`): 512자(JSON 조각 기준, sync.js BLOB_MIN) 넘는 thumb 는 `"thumb":"","thumbRef":"<해시>"` 로.
     서버에서 온 그림은 그 참조를 그대로(해시를 다시 만들지 않는다 — 만들면 모든 기기가 그림을 다시 받는다). 이 기기에서 새로 담은 그림은
     sync.js blobHash 의 폴백(djb 24자 — SHA-256 은 비동기라 저장 순간엔 못 쓴다)으로 참조를 만들고 그림은 IndexedDB `ps_blob:<해시>` 에 둔다.
     올릴 때는 sync.js 가 그 참조의 그림을 서버 ps_blob 에 올린다(sync-sched-blob.js ensure).
   · 읽기 — loadState 뒤(`__schedAfterLoad`): 참조만 든 칸을 이 창 메모리 → IndexedDB 캐시 → 서버(PSSync.blob.fetch) 차례로 채워 다시 그린다.
     메모리 안의 문서는 그림을 품는다 — 그리는 코드(PSSafe.svg(d.thumb))는 그대로. 옛 거울(그림을 품은 사본)을 읽으면 그 그림의 SHA-256 참조를
     미리 붙여(PSSync.blob.hash) 다음 저장이 서버와 같은 해시로 떼게 한다.
   · schedThumbDiet 는 참조가 있는 그림은 줄이지 않는다(캐시 · 서버 그림과 같아야 참조를 다시 쓸 수 있다).
   되돌리기(doUndo) 기록은 뗀 모양이라 되살린 뒤 같은 채우기를 한 번 더 한다. 그림 캐시(window.storage)가 없는 기기는 예전처럼 품고 간다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){root.PSSchedThumbRef=api;api.mount(root);}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var MIN=512,REF=/^[0-9a-f]{16,64}$/,PREFIX='ps_blob:',DEPTH=14,SHORT=86;   /* SHORT: 86자 미만은 이스케이프해도 512 에 못 미친다(\uXXXX 6배) */
  var diag={last:null,n:0};   /* 캐시 · 채우기 실패 — 화면은 그림 없이, 다음 읽기에 다시 */
  function note(e){ diag.last=e; diag.n++; return null; }
  function seg(s){ return JSON.stringify(s).slice(1,-1); }
  function unseg(x){ try{ var v=JSON.parse('"'+x+'"'); return typeof v==='string'?v:null; }catch(_){ return null; } }
  function hex8(n){ return ('00000000'+(n>>>0).toString(16)).slice(-8); }
  /* sync.js blobHash 의 폴백과 같은 식 */
  function hashSync(s){ var h1=5381,h2=52711,i=s.length; while(i){ var c=s.charCodeAt(--i); h1=(h1*33)^c; h2=(h2*33)^c; } return hex8(h1)+hex8(h2)+hex8(s.length); }
  function validRef(h){ return typeof h==='string'&&REF.test(h); }
  function walk(x,fn,depth){
    if(!x||typeof x!=='object'||depth>DEPTH)return;
    if(Array.isArray(x)){ for(var i=0;i<x.length;i++)walk(x[i],fn,depth+1); return; }
    if(typeof x.thumb==='string'||typeof x.thumbRef==='string')fn(x);
    for(var k in x){ if(Object.prototype.hasOwnProperty.call(x,k)&&x[k]&&typeof x[k]==='object')walk(x[k],fn,depth+1); }
  }
  /* create({storage, sync}) — 한 창의 상태(그림 조각 · 칸↔그림 묶음). storage = window.storage(IDB), sync = PSSync(부모 창) */
  function create(opt){
    opt=opt||{};
    var segs={},bound=(typeof WeakMap==='function')?new WeakMap():{get:function(){},set:function(){}};
    function storage(){ try{ return typeof opt.storage==='function'?opt.storage():opt.storage; }catch(_){ return null; } }
    function sync(){ try{ return typeof opt.sync==='function'?opt.sync():opt.sync; }catch(_){ return null; } }
    function remember(h,s){ if(validRef(h)&&typeof s==='string'&&s&&segs[h]==null)segs[h]=s; }
    function cachePut(h,s){ var st=storage(); if(!st||!st.set)return; try{ var p=st.set(PREFIX+h,s); if(p&&p.catch)p.catch(note); }catch(e){ note(e); } }
    function cacheGet(h){
      var st=storage(); if(!st||!st.get)return Promise.resolve(null);
      try{ return Promise.resolve(st.get(PREFIX+h)).then(function(r){ return r&&typeof r.value==='string'?r.value:null; },function(){ return null; }); }
      catch(_){ return Promise.resolve(null); }
    }
    /* JSON.stringify replacer — '_open' 은 예전처럼 거르고, 긴 thumb 는 참조로(메모리 객체는 그대로 두고 사본을 돌려준다) */
    function replacer(k,v){
      if(k==='_open')return undefined;
      if(!v||typeof v!=='object'||Array.isArray(v)||typeof v.thumb!=='string'||v.thumb.length<SHORT)return v;
      var s=seg(v.thumb); if(s.length<MIN)return v;
      var st=storage(); if(!st||!st.set)return v;
      var ref=validRef(v.thumbRef)?v.thumbRef:'',was=bound.get(v);
      if(!ref||(was!==undefined&&was!==v.thumb)){ ref=hashSync(s); v.thumbRef=ref; if(segs[ref]==null){ segs[ref]=s; cachePut(ref,s); } }
      else if(segs[ref]==null)segs[ref]=s;
      bound.set(v,v.thumb);
      var c={},key;
      for(key in v){ if(!Object.prototype.hasOwnProperty.call(v,key)||key==='thumbRef')continue; if(key==='thumb'){ c.thumb=''; c.thumbRef=ref; } else c[key]=v[key]; }
      return c;
    }
    /* roots: 문서 객체들 — 참조만 든 칸을 채운다. 메모리에 있는 조각은 바로(돌려주는 수), 나머지는 비동기로 채운 뒤 done(수) */
    function hydrate(roots,done){
      var queue={},legacy=[],n=0;
      (roots||[]).forEach(function(r){ walk(r,function(o){
        var ref=validRef(o.thumbRef)?o.thumbRef:'';
        if(ref){
          if(o.thumb)return;
          if(segs[ref]!=null){ var t=unseg(segs[ref]); if(t!=null){ o.thumb=t; bound.set(o,t); n++; return; } }
          (queue[ref]=queue[ref]||[]).push(o);
        }
        else if(typeof o.thumb==='string'&&o.thumb.length>=SHORT&&seg(o.thumb).length>=MIN)legacy.push(o);
      },0); });
      var hs=Object.keys(queue);
      if(!hs.length&&!legacy.length)return Promise.resolve(n);
      return Promise.all(hs.map(function(h){ return cacheGet(h).then(function(v){ if(v!=null)remember(h,v); }); })).then(function(){
        var miss=hs.filter(function(h){ return segs[h]==null; }),api=sync();
        if(!miss.length||!api||!api.blob||!api.blob.fetch)return;
        return Promise.resolve().then(function(){ return api.blob.fetch(miss); }).then(function(map){ Object.keys(map||{}).forEach(function(h){ remember(h,map[h]); }); },function(){});
      }).then(function(){
        var api=sync(); if(!legacy.length||!api||!api.blob||!api.blob.hash)return;
        return Promise.all(legacy.map(function(o){
          var t=o.thumb,s=seg(t);
          return Promise.resolve().then(function(){ return api.blob.hash(s); }).then(function(h){
            if(!validRef(h)||o.thumb!==t||validRef(o.thumbRef))return;
            o.thumbRef=h; bound.set(o,t); remember(h,s);
            return cacheGet(h).then(function(v){ if(v==null)cachePut(h,s); });
          },function(){});
        }));
      }).then(function(){
        var m=0;
        hs.forEach(function(h){ if(segs[h]==null)return; var t=unseg(segs[h]); if(t==null)return; queue[h].forEach(function(o){ if(!o.thumb){ o.thumb=t; bound.set(o,t); m++; } }); });
        if(m&&typeof done==='function')done(m);
        return n+m;
      });
    }
    return {replacer:replacer,hydrate:hydrate,remember:remember,has:function(h){ return segs[h]!=null; }};
  }
  function mount(W){
    if(!W||W.__psSchedThumbRef)return null;
    var inst=create({
      storage:function(){ return W.storage; },
      sync:function(){ var p=null; try{ p=(W.parent&&W.parent!==W)?W.parent.PSSync:null; }catch(_){ p=null; } return p||W.PSSync||null; }
    });
    W.__psSchedThumbRef=inst;
    W.__schedRep=inst.replacer;
    var tries=0;
    function render(){
      try{
        if(typeof W.__schedEditorActive==='function'&&W.__schedEditorActive()){ if(tries++<120)W.setTimeout(render,500); return; }
        tries=0;
        if(typeof W.syncViews==='function')W.syncViews(false);
      }catch(e){ note(e); }
    }
    function roots(){
      var r=[];
      try{ if(typeof weeksMap!=='undefined'&&weeksMap)r.push(weeksMap); }catch(e){ note(e); }
      try{ if(typeof myTemplates!=='undefined'&&myTemplates)r.push(myTemplates); }catch(e){ note(e); }
      return r;
    }
    W.__schedAfterLoad=function(){
      try{ var p=inst.hydrate(roots(),render); if(p&&p.catch)p.catch(note); }catch(e){ note(e); }
    };
    W.__schedAfterLoad();
    return inst;
  }
  return {create:create,mount:mount,seg:seg,unseg:unseg,hashSync:hashSync,walk:walk,MIN:MIN,diag:diag};
});
