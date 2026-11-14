/* 3.278 — 작업 보드 «구조 사본»(제보 0976735a «만들던 애니메이션이 새로고침에 사라짐» · 사용자 11/11 «다시는 반복되지 않게»).
   운영 기록: 그 기기는 옛 판 창과 새 판 창이 함께 열려 있었고, 작업 보드의 기기 초안(board-draft.js)이 11분 동안 14번,
   답한 뒤에도 4번 더 `board_draft_storage` 로 실패했다. 초안 쓰기는 일부러 깐깐하다(주인 · 세대 · 편집 번호 · 두 저장소 대조가
   하나라도 어긋나면 적지 않는다 — 남의 것을 덮지 않으려고). 그 깐깐함은 그대로 두고, **실패해도 남는 사본**을 따로 둔다.
   · 무엇을: 사람이 손댄 작업 보드 화면(boardLiveCapture 가 담는 것 — 판 · 장면 · 페이지 · 미팅 슬라이드).
   · 언제: 손댄 뒤 1.2초 · 탭 숨김/닫기. 초안이 성공했든 실패했든 적는다. 주인이 아직 확인되지 않은 창(불러오는 중 · 옛 창과 겹침)에서도.
   · 어디에: 이 기기의 자리 넷(…:rescue:<wid>:0~3). 문서를 연 번(load)마다 제 자리 하나 — 다른 창 · 앞선 새로고침의 사본을 덮지 않는다
     (자리가 다 차면 저장본보다 낡은 것 → 가장 오래된 것 차례로 쓴다). 조건 없이 쓴다(대조 없음) — 그래서 실패할 길이 «저장소가 없음»뿐이다.
   · 되살리기: 보드를 다시 열었을 때 저장본보다 새롭고 지금 화면과 다른 사본이 있으면 기존 띠 «저장하지 않은 작업이 있어요 — 되살리기 / 버리기»로 묻는다
     (초안 띠가 같은 것을 이미 묻고 있으면 끼어들지 않는다). 되살리는 길은 원래 길(__boardDraftRestore) 그대로 — 개인 보드 기록 · 서버는 건드리지 않는다.
   · 지우기: «저장»이 끝나 저장본이 더 새로워지면 낡은 사본으로 보고 다음에 열 때 걷는다 · «버리기» · 14일.
   키: ps_private_board_draft_v1:<uid>:rescue:<wid>:<자리>(기기 전용 — storage-keys.js 의 같은 머리, 계정 정리가 같이 지운다). */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSBoardRescue=api;root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var PREFIX='ps_private_board_draft_v1:',TAIL=':rescue:',SLOTS=4,WAIT=1200,KEEP_MS=14*86400000,LS_MAX=1500000;
  function key(o,slot){return PREFIX+encodeURIComponent(o.uid)+TAIL+encodeURIComponent(o.wid)+':'+slot;}
  function make(o,raw,load,at){return JSON.stringify({v:1,uid:o.uid,wid:o.wid,at:at,load:load,raw:raw});}
  /* 다른 계정 · 다른 팀 · 깨진 글은 사본이 아니다 */
  function parse(text,o){
    if(typeof text!=='string'||!o)return null;
    try{
      var r=JSON.parse(text);if(!r||r.v!==1||r.uid!==o.uid||r.wid!==o.wid||typeof r.raw!=='string'||!(r.at>0)||typeof r.load!=='string')return null;
      var d=JSON.parse(r.raw);if(!d||typeof d!=='object'||Array.isArray(d))return null;
      r.text=text;return r;
    }catch(_){return null;}
  }
  /* 담은 시각(_savedAt)만 다른 두 본문은 같은 작업이다. 3.288 — 페이지 장면 썸네일(lib-diet.js 가 저장에서 뗀다)만 다른 것도:
     옛 판이 남긴 무거운 사본을 새 판의 가벼운 화면과 견줄 때 «다른 작업»으로 보고 띠를 띄우지 않게 */
  function body(raw){try{var d=JSON.parse(raw);delete d._savedAt;try{if(d.boardPages&&typeof PSLibDiet!=='undefined')PSLibDiet.pagesStrip(d.boardPages.pages);}catch(_){}return JSON.stringify(d);}catch(_){return String(raw);}}
  function newer(a,b){return a&&b?(b.at>a.at?b:a):(a||b);}
  /* 쓸 자리: 이번에 연 문서의 자리 → 빈 자리 → 저장본보다 낡은 자리 → 가장 오래된 자리. recs[i] = 그 자리의 사본 또는 null */
  function pickSlot(recs,load,savedAt,now){
    var i,old=-1;
    for(i=0;i<recs.length;i++)if(recs[i]&&recs[i].load===load)return i;
    for(i=0;i<recs.length;i++)if(!recs[i])return i;
    for(i=0;i<recs.length;i++)if(stale(recs[i],savedAt,now))return i;
    for(i=0;i<recs.length;i++)if(old<0||recs[i].at<recs[old].at)old=i;
    return old;
  }
  function stale(rec,savedAt,now){return !rec||(savedAt>0&&rec.at<=savedAt)||(now-rec.at>KEEP_MS);}
  /* 되살리기를 권할 사본: 다른 번(load)에 적힌 것 중 저장본보다 새롭고 지금 화면과 다른 가장 새 것 */
  function candidate(recs,load,savedAt,now,currentRaw){
    var best=null,cur=currentRaw==null?null:body(currentRaw);
    recs.forEach(function(r){
      if(!r||r.load===load||stale(r,savedAt,now))return;
      if(cur!==null&&body(r.raw)===cur)return;
      if(!best||r.at>best.at)best=r;
    });
    return best;
  }

  function install(w){
    if(w.__psBoardRescue||typeof w.boardSaveLive!=='function'||typeof w.boardLiveCapture!=='function'||typeof w.boardPrivateOwner!=='function')return null;
    try{if(new w.URLSearchParams(w.location.search).get('community_view')==='1')return null;}catch(_){}
    var doc=w.document,load=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),timer=null,slot=-1,slotOwner='',last=null,offeredAt=0,wrote=0,failed=0;
    /* 작업 보드의 주인 = 개인 보드 기록의 주인(계정 + 개인 공간). 아직 확인되지 않은 창(불러오는 중 · 다른 창과 겹침)은 계정만 알고 자리 이름을 '-' 로 쓴다 */
    function owner(){
      try{var o=w.boardPrivateOwner();if(o&&o.uid&&o.wid)return {uid:o.uid,wid:o.wid};}catch(_){}
      try{var v=typeof w.vaultBoardOwner==='function'?w.vaultBoardOwner():null;if(v&&v.uid)return {uid:v.uid,wid:'-'};}catch(_){}
      return null;
    }
    function sameOwner(a){var b=owner();return !!a&&!!b&&a.uid===b.uid&&a.wid===b.wid;}
    function cls(n){try{return doc.body.classList.contains(n);}catch(_){return false;}}
    function playing(){try{return typeof animPlaying!=='undefined'&&!!animPlaying;}catch(_){return false;}}
    /* 지금 화면이 «내 작업 보드»인가 — 보관함 편집 · 훈련 편집기 · 커뮤니티 뷰어 · 내보내기/썸네일 중간 판은 남의 자료를 빌린 화면 */
    function mine(){
      var v=w.__csView||'board';
      return !w._vaultBoardContext&&!w._vaultBoardRestoring&&!w.__vaultEdit&&!w.__vaultViewMode&&!w.__animExport&&!w.__capLock&&!w.__psThumbCapturing&&!w.__psPreviewRefreshing
        &&!w._bliveApplying&&!cls('editing')&&!cls('vcreating')&&!cls('comm-viewing')&&(v==='board'||v==='match');
    }
    /* 사람이 손댔고 아직 저장하지 않았다(불러오기 전 창은 «고친 판»으로 세지 않으니 손댐만 본다) */
    function unsaved(){return !!w._boardUserTouched&&(!!w._boardManualDirty||!w._boardPrivateLoaded);}
    function savedAt(){try{var r=w._boardPrivateRecord;return r&&typeof r.raw==='string'?(+JSON.parse(r.raw)._savedAt||0):0;}catch(_){return 0;}}
    function lsGet(k){try{return w.localStorage.getItem(k);}catch(_){return null;}}
    function lsDrop(k,text){try{if(w.localStorage.getItem(k)===text)w.localStorage.removeItem(k);}catch(_){}}
    function idbGet(k){try{if(w.storage&&w.storage.get)return Promise.resolve(w.storage.get(k)).then(function(v){return v&&typeof v.value==='string'?v.value:null;}).catch(function(){return null;});}catch(_){}return Promise.resolve(null);}
    function readAll(o){
      var jobs=[];for(var i=0;i<SLOTS;i++)(function(i){var k=key(o,i);jobs.push(idbGet(k).then(function(t){return newer(parse(lsGet(k),o),parse(t,o));}));})(i);
      return Promise.all(jobs);
    }
    function event(code,meta){var S=null;try{S=w.PSSync||(w.parent&&w.parent.PSSync);}catch(_){}
      try{if(S&&typeof S.event==='function')S.event('board_rescue',{status:code==='write_failed'?'error':'ok',feature:'board',error_code:code,meta:meta||{}});}catch(_){}}
    function persist(o,k,text){
      function current(){if(!sameOwner(o)){var e=new Error('board rescue owner changed');e.name='StorageOwnerChangedError';throw e;}return true;}
      if(!w.storage||!w.storage.set||!w.storage.get)return Promise.resolve(false);
      return Promise.resolve().then(function(){current();return w.storage.set(k,text,current);}).then(function(){return w.storage.get(k);}).then(function(v){
        if(!v||v.value!==text)return false;
        if(last&&last.key===k&&last.text===text)last.idb=true;
        lsDrop(k,text);if(!wrote++)event('written',{kb:Math.round(text.length/1024)});return true;
      }).catch(function(){if(!failed++)event('write_failed',{kb:Math.round(text.length/1024)});return false;});
    }
    /* now: 탭이 닫히는 길 — IndexedDB 가 끝나기 전에 꺼질 수 있어 localStorage 에도 바로 적는다(너무 크거나 가득 차면 IndexedDB 만) */
    function write(now){
      if(!mine()||playing()||!unsaved())return false;
      var o=owner();if(!o)return false;
      var c=null;try{c=w.boardLiveCapture(w.__csView||'board');}catch(_){}
      if(!c||typeof c.raw!=='string')return false;                 /* 담지 못하면 앞 사본을 그대로 둔다 */
      var sig=body(c.raw),ot=o.uid+'|'+o.wid;
      if(slotOwner!==ot){slot=-1;slotOwner=ot;last=null;}
      if(last&&last.sig===sig){if(now&&!last.idb&&last.text.length<=LS_MAX)try{w.localStorage.setItem(last.key,last.text);}catch(_){}return true;}
      var at=Date.now();
      function put(){
        var k=key(o,slot),text=make(o,c.raw,load,at);last={key:k,sig:sig,text:text,idb:false};
        if(now&&text.length<=LS_MAX)try{w.localStorage.setItem(k,text);}catch(_){}
        persist(o,k,text);
      }
      if(slot>=0){put();return true;}
      if(now){   /* 자리를 고를 틈이 없다 — localStorage 만 보고 고른다 */
        var recs=[];for(var i=0;i<SLOTS;i++)recs.push(parse(lsGet(key(o,i)),o));
        slot=pickSlot(recs,load,savedAt(),at);put();return true;
      }
      readAll(o).then(function(recs){if(slot<0&&sameOwner(o))slot=pickSlot(recs,load,savedAt(),Date.now());if(slot>=0&&sameOwner(o))put();});
      return true;
    }
    function schedule(){
      try{w.clearTimeout(timer);}catch(_){}
      timer=w.setTimeout(function(){timer=null;if(playing()){schedule();return;}try{write(false);}catch(_){}},WAIT);   /* 재생 중 판은 보간값 — 멈춘 뒤에 담는다 */
    }
    function flush(){try{w.clearTimeout(timer);}catch(_){}timer=null;try{return write(true);}catch(_){return false;}}
    function drop(o,rec,i){
      var k=key(o,i);try{lsDrop(k,rec.text);}catch(_){}
      try{if(w.storage&&w.storage.delIfValue)return Promise.resolve(w.storage.delIfValue(k,rec.text,function(){return true;})).catch(function(){return false;});}catch(_){}
      return Promise.resolve(false);
    }
    /* 보드를 다 불러온 뒤: 낡은 사본을 걷고, 저장본보다 새 사본이 있으면 띠로 묻는다 */
    function offer(){
      var o=owner();if(!o||!w._boardPrivateLoaded||!mine()||cls('meet-mode')||playing())return Promise.resolve(false);
      if(typeof w.boardPrivateCurrent==='function'&&!w.boardPrivateCurrent(w._boardPrivateOwner))return Promise.resolve(false);
      var loose={uid:o.uid,wid:'-'};
      return Promise.all([readAll(o),o.wid==='-'?Promise.resolve([]):readAll(loose)]).then(function(two){
        if(!sameOwner(o))return false;
        var recs=two[0].concat(two[1]),now=Date.now(),sv=savedAt();
        function where(i){return i<SLOTS?[o,i]:[loose,i-SLOTS];}
        function dropAt(r,i){var p=where(i);return drop(p[0],r,p[1]);}
        recs.forEach(function(r,i){if(r&&r.load!==load&&stale(r,sv,now))dropAt(r,i);});
        if(unsaved())return false;                                  /* 이미 손대는 중 — 끼어들지 않는다(사본은 남는다) */
        var cur=null;try{cur=w.boardLiveCapture(w.__csView||'board');}catch(_){}
        var best=candidate(recs,load,sv,now,cur&&cur.raw);if(!best||best.at===offeredAt)return false;
        var pend=w.__boardDraftPending;
        if(pend&&(pend.at>=best.at||body(pend.raw)===body(best.raw))){   /* 초안 띠가 같은(또는 더 새) 것을 이미 묻고 있다 — «버리기»는 이 사본도 같이 버린다 */
          if(body(pend.raw)===body(best.raw))try{var bi=recs.indexOf(best);doc.getElementById('boardDraftBar').querySelector('.bd-drop').addEventListener('click',function(){dropAt(best,bi);});}catch(_){}
          return false;
        }
        if(typeof w.boardDraftBarShow!=='function')return false;
        offeredAt=best.at;
        var po=w._boardPrivateOwner||o;
        w.boardDraftBarShow(po,{v:1,uid:po.uid,wid:po.wid,at:best.at,raw:best.raw,rescue:1});
        var bar=doc.getElementById('boardDraftBar'),i=recs.indexOf(best);
        if(bar){
          var gone=function(){dropAt(best,i);};
          try{bar.querySelector('.bd-drop').addEventListener('click',gone);}catch(_){}
          try{bar.querySelector('.bd-keep').addEventListener('click',function(){w.setTimeout(function(){if(!w.__boardDraftPending&&w._boardManualDirty){gone();event('restored',{age:Math.round((Date.now()-best.at)/60000)});}},0);});}catch(_){}
        }
        event('offered',{age:Math.round((now-best.at)/60000),kb:Math.round(best.text.length/1024)});
        return true;
      }).catch(function(){return false;});
    }
    var saveLive=w.boardSaveLive;
    w.boardSaveLive=function(){var r=saveLive.apply(this,arguments);try{if(w._boardUserTouched&&mine())schedule();}catch(_){}return r;};
    /* 되살린 화면도 아직 저장 전이다 — 바로 이번 문서의 사본으로 다시 적는다(되살리기는 boardSaveLive 를 지나지 않는다) */
    var restoreDraft=w.__boardDraftRestore;
    if(typeof restoreDraft==='function')w.__boardDraftRestore=function(){var r=restoreDraft.apply(this,arguments);try{if(r)schedule();}catch(_){}return r;};
    try{w.addEventListener('pagehide',flush);w.addEventListener('beforeunload',flush);}catch(_){}
    try{doc.addEventListener('visibilitychange',function(){if(doc.visibilityState==='hidden')flush();});}catch(_){}
    /* 불러오기가 끝나고 초안 띠가 먼저 판단할 틈(1.5초)을 준 뒤 묻는다 */
    var tries=0;(function wait(){
      if(w.__boardRestoreDone&&w._boardPrivateLoaded){w.setTimeout(function(){offer();},1500);return;}
      if(++tries<240)w.setTimeout(wait,500);
    })();
    var api={flush:flush,offer:offer,load:load,slot:function(){return slot;},state:function(){return last?{key:last.key,idb:last.idb}:null;}};
    w.__psBoardRescue=api;return api;
  }
  return {install:install,key:key,make:make,parse:parse,body:body,pickSlot:pickSlot,stale:stale,candidate:candidate,SLOTS:SLOTS,KEEP_MS:KEEP_MS};
});
