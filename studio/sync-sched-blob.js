/* 3.315 — 일정 문서의 그림(thumb · 작전판 SVG)은 기기 사본에서도 참조(thumbRef)만 둔다.
   실측(2026-11-17 풋볼A 주인 맥): 서버 일정 문서는 287K자(그림은 ps_blob 참조 62개)인데 기기 거울은 그림을 되돌린 8MB 라
   작은 저장소(10MB)가 11/9 부터 가득 차 선수단 거울(100KB)을 못 썼다(«선수단이 지워졌어»). 안전 정리는 이 그림을 못 뺀다.
   sync.js 는 크기 예산이 없어 여기에 둔다(sync.js 는 작은 연결만):
   · inline(raw)   — 기기 사본이 아직 그림을 품은 옛 모양인가(512자 넘는 "thumb")
   · diet(raw,strip,cacheSet) — 그 사본의 그림을 떼어(strip = sync.js schedStrip, SHA-256 참조) 이 기기 캐시(ps_blob:<h>)에 두고 {from,v}.
     같은 원문은 한 번만 계산한다(회차마다 8MB 를 다시 떼지 않는다). 회차는 편집도 서버 변경도 없을 때 v 를 기기 사본으로 쓴다(판본 그대로).
   · ensure(at,row,io) — 올리는 일정 행의 참조 가운데 이 기기 캐시에 있는 그림(화면이 새로 담은 것)을 서버 ps_blob 에 올린다.
     io = sync.js 의 refs(schedRefs) · get(blobCacheGet) · ensure(blobEnsure). 서버가 못 받으면(ps_blob 없음 · 403, blobOff) 행은 참조 그대로 보내고
     다음 올리기 때 다시 시도한다(«안다»로 적지 않는다) — 그림을 행에 되넣으면 캐시의 서버 그림까지 들어가 2.622 이전의 큰 문서가 된다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSSchedBlob=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var INLINE=/"thumb":\s*"(?:[^"\\]|\\.){512,}"/;
  var last=null;      /* {from,v|null} — 마지막으로 뗀 원문 */
  var known={};       /* wid → {h:1} 서버에 있다고 확인한 그림 */
  var diag={last:null,n:0};   /* 캐시 쓰기 실패 — 그림은 다음 회차 · 다음 올리기에 다시 */
  function note(e){ diag.last=e; diag.n++; return null; }
  function inline(raw){ return typeof raw==='string'&&raw.length>=512&&INLINE.test(raw); }
  function diet(raw,strip,cacheSet){
    if(!inline(raw))return Promise.resolve(null);
    if(last&&last.from===raw)return Promise.resolve(last.v?last:null);
    return Promise.resolve().then(function(){ return strip(raw); }).then(function(res){
      if(!res||typeof res.v!=='string'||res.v===raw||!res.blobs||!res.blobs.length){ last={from:raw,v:null}; return null; }
      return Promise.all(res.blobs.map(function(b){ return Promise.resolve().then(function(){ return cacheSet(b.h,b.v); }).catch(note); })).then(function(){
        last={from:raw,v:res.v}; return last;
      });
    }).catch(function(){ return null; });
  }
  function ensure(at,row,io){
    var wid=row&&row.workspace_id,raw=row&&row.v;
    if(!wid||typeof raw!=='string'||!io)return Promise.resolve(true);
    var k=known[wid]||(known[wid]={}),refs=[],blobs=[];
    try{ refs=io.refs(raw).filter(function(h){ return !k[h]; }); }catch(_){ refs=[]; }
    if(!refs.length)return Promise.resolve(true);
    /* 캐시에 없는 참조는 서버에서 온 것(올릴 그림이 없다) — 화면의 캐시 쓰기가 늦을 수 있어 «안다»로 적지 않는다 */
    return Promise.all(refs.map(function(h){ return Promise.resolve().then(function(){ return io.get(h); }).then(function(v){ if(typeof v==='string'&&v)blobs.push({h:h,v:v}); },function(){}); })).then(function(){
      if(!blobs.length)return true;
      return Promise.resolve().then(function(){ return io.ensure(at,wid,blobs); }).then(function(ok){
        if(ok)blobs.forEach(function(b){ k[b.h]=1; });
        return !!ok;
      });
    });
  }
  function reset(){ last=null; known={}; diag.last=null; diag.n=0; }
  return {inline:inline,diet:diet,ensure:ensure,reset:reset,diag:diag};
});
