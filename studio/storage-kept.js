/* PROCESS STUDIO — 작업 보드 «보관 사본» 정리(PSStorageKept). 저장 계층 정리 · docs/STORAGE-GATE.md «보관 사본».
   작업 보드의 초안 · 머리 레코드가 갈리거나 충돌하면 board-draft.js 가 진 쪽 원문을 글자 그대로 보관 자리에 옮겨 둔다:
     ps_private_board_draft_v1:<uid>:kept:<token>               keepHead                 머리 충돌 때의 내 레코드(IndexedDB 먼저 · 실패하면 localStorage)
     ps_private_board_draft_v1:<uid>:kept:source-<token>        archiveHeads             갈린 두 머리(거울 · IndexedDB) — IndexedDB 만
     ps_private_board_draft_v1:<uid>:kept:unsaved-<at>-<rand>   recover · localRecovery  충돌한 초안(IndexedDB 먼저 · 수명 주기엔 localStorage)
     ps_private_board_draft_v1:<uid>:kept:unsaved-split-<지문>  settle(3.302)            갈린 두 초안 — IndexedDB 만
   되읽는 화면은 없다(백업 파일에만 실린다 — app.html backupKeyAllowed). 예전엔 아무도 지우지 않아 11/18 storage_usage 에서 작은 저장소 2위
   (7기기 · 평균 2.5MB · 최대 5.7MB — 큰 기기 넷은 작은 저장소의 거의 전부가 이것). 같은 자리의 IndexedDB 값이 다르면 optimize 가 옮기지 못해 영영 남았다.
   규칙(순수 셈은 plan · 저장소 I/O 는 run 이 받은 io — storage.js keptPrune 가 준다):
     ① 작은 저장소의 사본은 IndexedDB 로 옮겨 되읽어 확인한 뒤에만 지운다 — 같은 자리에 다른 값이 있으면 <키>:ls-<지문> 자리.
     ② 주인(uid · wid)마다 최신 KEEP 개만 남기고, DAYS 일 지난 것은 지운다. GRACE(한 시간) 안의 것은 쓰는 중일 수 있어 개수로 지우지 않는다.
        시각은 레코드의 at(초안) · seq(머리) — 없으면 키의 토큰(base36 · 10진) — 그것도 없으면 가장 오래된 것으로 두고 개수 규칙만 받는다.
     ③ 지금 보드와 같은 지문(:unsaved 초안 · 머리 레코드와 같은 글이거나 같은 원문)은 지우지 않는다.
     ④ 지우기 전 ps_events storage_kept_pruned 한 줄 — 키 표 이름(stage) · 개수 · KB 뿐(내용 · 계정 · 키 이름 없음).
   언제: storage.js optimize(하루 한 번 안전 정리 · 가득 찬 뒤 자동 정리 · 앱 설정의 «정리») — 맨 위 창 · 로그인한 계정의 키만.
   보드 쪽 쓰기(CAS → 되읽기)와의 경합: 쓰는 쪽은 자리가 비면 null 에서 다시 쓰므로 지워져도 다음 시도에 다시 보관된다(그 한 번은 «저장되지 않았습니다»). GRACE 가 그 틈을 좁힌다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSStorageKept=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var PREFIX='ps_private_board_draft_v1:',KEPT=':kept:',DAY=86400000;
  var TABLE_ROW='ps_private_board_draft_v1:*:kept:';   /* 키 표(storage-keys.js)의 줄 — 보고 이름(storage.js fullName)은 아래 STAGE */
  var STAGE='ps_private_board_draft_v1:kept';
  var DEFAULTS={days:14,keep:8,grace:3600000};
  /* board-draft.js settle 의 지문과 같은 셈(djb2 + 길이) — 같은 글은 같은 자리 */
  function mark(raw){var h=5381,i=0;raw=String(raw);for(;i<raw.length;i++)h=((h<<5)+h+raw.charCodeAt(i))|0;return (h>>>0).toString(36)+'-'+raw.length.toString(36);}
  /* 레코드 — 초안 {v:1,uid,wid,raw,at} · 머리 {v:1,uid,wid,raw,…,seq}. 아니면 null(글자 그대로 둔 «모르는 원문») */
  function record(v){
    if(typeof v!=='string'||v.charCodeAt(0)!==123)return null;
    var r=null;
    try{r=JSON.parse(v);}catch(e){return null;}
    if(!r||r.v!==1||typeof r.raw!=='string')return null;
    return {at:+r.at||+r.seq||0,wid:typeof r.wid==='string'?r.wid:'',raw:r.raw};
  }
  function sane(t,now){return t>1.3e12&&t<now+DAY?t:0;}
  /* 보관 시각 — 레코드의 at · seq, 없으면 키의 토큰. 모르면 0 */
  function timeOf(key,rec,now){
    now=now||Date.now();
    if(rec&&rec.at)return sane(rec.at,now);
    key=String(key||'');var i=key.indexOf(KEPT);if(i<0)return 0;
    var tail=key.slice(i+KEPT.length),m;
    if((m=/^unsaved-(\d{12,})-/.exec(tail)))return sane(+m[1],now);
    if(/^unsaved-split-/.test(tail))return 0;
    if((m=/^(?:source-)?([0-9a-z]{7,10})-[0-9a-z]+-\d+/.exec(tail)))return sane(parseInt(m[1],36),now);
    return 0;
  }
  function bytes(k,v){return (String(k).length+String(v).length)*2;}
  function kb(n){return Math.round(n/1024);}
  /* 순수 셈. entries = [{store:'ls'|'idb', key, value}] · opts = {now, days, keep, grace, protect:{values:[], raws:[]}}
     → {drop, keep, move(남길 작은 저장소 사본 — IndexedDB 로 옮긴다), dup(IndexedDB 에 같은 글이 있는 작은 저장소 사본 — 그냥 지운다)} */
  function plan(entries,opts){
    var o=opts||{},now=o.now||Date.now(),days=o.days>0?o.days:DEFAULTS.days,keep=o.keep>=0?o.keep:DEFAULTS.keep,grace=o.grace>=0?o.grace:DEFAULTS.grace;
    var protect=o.protect||{},values=protect.values||[],raws=protect.raws||[];
    var idbAt={};(entries||[]).forEach(function(e){if(e&&e.store==='idb'&&typeof e.value==='string')idbAt[e.key]=e.value;});
    var rows=[],dup=[];
    (entries||[]).forEach(function(e){
      if(!e||typeof e.value!=='string')return;
      if(e.store==='ls'&&idbAt[e.key]===e.value){dup.push({store:'ls',key:e.key,value:e.value,bytes:bytes(e.key,e.value)});return;}
      var rec=record(e.value);
      rows.push({store:e.store,key:e.key,value:e.value,t:timeOf(e.key,rec,now),owner:(rec&&rec.wid)||'',bytes:bytes(e.key,e.value),
        protect:values.indexOf(e.value)>=0||!!(rec&&raws.indexOf(rec.raw)>=0),drop:false});
    });
    var byOwner={};
    rows.forEach(function(r){(byOwner[r.owner]=byOwner[r.owner]||[]).push(r);});
    Object.keys(byOwner).forEach(function(w){
      byOwner[w].sort(function(a,b){return b.t-a.t||(a.key<b.key?-1:a.key>b.key?1:0);}).forEach(function(r,i){
        if(r.protect)return;
        var age=r.t?now-r.t:-1;
        if(r.t&&age>days*DAY)r.drop=true;
        else if(i>=keep&&(!r.t||age>grace))r.drop=true;
      });
    });
    var drop=rows.filter(function(r){return r.drop;}),left=rows.filter(function(r){return !r.drop;});
    return {drop:drop,keep:left,move:left.filter(function(r){return r.store==='ls';}),dup:dup};
  }
  /* io: {uid, current(), localKeys(prefix), localGet(k), localRemove(k), idbKeys(prefix), idbGet(k), idbReplaceIfValue(k,expected,value), idbDelIfValue(k,value), event(meta)}
     모든 지우기는 «읽었던 그 값일 때만»(CAS) — 그 사이 보드가 바꿔 쓴 것은 건드리지 않는다. current() 가 던지면(계정 · 공간 바뀜) 거기서 멈춘다.
     차례: 지금 보드 읽기 → 두 저장소의 보관 키 읽기 → 셈 → 기록(ps_events) → 지우기 → 작은 저장소 사본 옮기기. 결과 {stat, event, dropped, moved} */
  function run(io,opts){
    var o=opts||{},uid=String(io&&io.uid||'');
    if(!uid)return Promise.resolve(null);
    var base=PREFIX+encodeURIComponent(uid),prefix=base+KEPT,now=o.now||Date.now();
    function current(){if(io.current)io.current();}
    function lget(k){var v=null;try{v=io.localGet(k);}catch(e){return null;}return typeof v==='string'?v:null;}
    function iget(k){return Promise.resolve().then(function(){return io.idbGet(k);}).then(function(v){return typeof v==='string'?v:null;});}
    var protect={values:[],raws:[]},entries=[];
    function note(v){if(v===null||v===undefined)return;protect.values.push(v);var r=record(v);if(r)protect.raws.push(r.raw);}
    /* IndexedDB 자리 slot 에 value 를 두고(비어 있을 때만 · CAS) 되읽어 확인 — 그 뒤에만 작은 저장소 사본을 지운다 */
    function settle(slot,value){
      return iget(slot).then(function(have){
        current();
        if(have===value)return true;
        if(have!==null)return false;
        return Promise.resolve().then(function(){return io.idbReplaceIfValue(slot,null,value);}).then(function(ok){
          if(!ok)return false;
          return iget(slot).then(function(back){return back===value;});
        });
      });
    }
    function moveOne(r){
      return settle(r.key,r.value).then(function(ok){return ok||settle(r.key+':ls-'+mark(r.value),r.value);}).then(function(ok){
        current();
        if(!ok||lget(r.key)!==r.value)return false;
        try{io.localRemove(r.key);}catch(e){return false;}
        return lget(r.key)===null;
      });
    }
    return Promise.resolve().then(function(){
      current();
      [base,base+':unsaved'].forEach(function(k){note(lget(k));});
      return Promise.all([iget(base),iget(base+':unsaved')]);
    }).then(function(vs){
      vs.forEach(note);current();
      return Promise.resolve().then(function(){return io.idbKeys(prefix);});
    }).then(function(ikeys){
      ikeys=(ikeys||[]).map(String).filter(function(k){return k.indexOf(prefix)===0;});
      return ikeys.reduce(function(q,k){return q.then(function(){return iget(k).then(function(v){if(v!==null)entries.push({store:'idb',key:k,value:v});});});},Promise.resolve());
    }).then(function(){
      current();
      var lkeys=[];try{lkeys=io.localKeys(prefix)||[];}catch(e){lkeys=[];}
      lkeys.map(String).filter(function(k){return k.indexOf(prefix)===0;}).forEach(function(k){var v=lget(k);if(v!==null)entries.push({store:'ls',key:k,value:v});});
      var p=plan(entries,{now:now,days:o.days,keep:o.keep,grace:o.grace,protect:protect});
      function sum(list){return list.reduce(function(a,r){return a+r.bytes;},0);}
      var freed=p.move.concat(p.dup);
      var meta={stage:STAGE,n:p.drop.length,kb:kb(sum(p.drop)),ls:p.drop.filter(function(r){return r.store==='ls';}).length,idb:p.drop.filter(function(r){return r.store==='idb';}).length,
        mv:freed.length,mvKb:kb(sum(freed)),left:p.keep.length,leftKb:kb(sum(p.keep))};
      var result={stat:meta,event:false,dropped:[],moved:[]};
      if(meta.n||meta.mv){try{if(io.event)io.event(meta);result.event=true;}catch(e){result.event=false;}}
      return p.drop.reduce(function(q,r){return q.then(function(){
        current();
        if(r.store==='ls'){
          if(lget(r.key)!==r.value)return null;
          try{io.localRemove(r.key);}catch(e){return null;}
          if(lget(r.key)===null)result.dropped.push(r.key);
          return null;
        }
        return Promise.resolve().then(function(){return io.idbDelIfValue(r.key,r.value);}).then(function(ok){if(ok)result.dropped.push(r.key);});
      });},Promise.resolve()).then(function(){
        return freed.reduce(function(q,r){return q.then(function(){current();return moveOne(r).then(function(ok){if(ok)result.moved.push(r.key);});});},Promise.resolve());
      }).then(function(){return result;});
    });
  }
  return {PREFIX:PREFIX,KEPT:KEPT,TABLE_ROW:TABLE_ROW,STAGE:STAGE,DEFAULTS:DEFAULTS,mark:mark,record:record,timeOf:timeOf,plan:plan,run:run};
});
