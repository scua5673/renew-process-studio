/* 0976735a — 보관함에서 만들던 작전판(«＋ 만들기 › 작전판 · 패턴북», 보관함 작전판 «편집»)의 기기 초안.
   제보: «만들던게 오류가 떠서 새로고침했는데 사라져버렸음 — 작전판 만들던 애니메이션이 다 사라져버렸음».
   보관함 작전판은 «저장하기»를 눌러야만 남는다(board.html «보드는 명시적 저장만 허용한다» · _vaultEmergencySnapshot 도 작전판은 뺀다).
   작업 보드의 기기 초안(board-draft.js · …:unsaved)은 이 화면에선 막혀 있어(blocked:vault-edit) 아무것도 적지 않았다 —
   새로고침 · 탭 닫힘 · «나가기» 한 번에 장면이 전부 사라졌다(재현: tests/browser/vault-board-draft).
   · 쓰기: 손댄 뒤 0.8초 · 탭 숨김/닫기 · 편집기를 떠나기 직전. IndexedDB 가 정본이고, 닫히는 순간엔 localStorage 에 한 벌 더(확인되면 지운다).
     보관함 · 서버 · 작업 보드 초안은 건드리지 않는다. 연 그대로(손대지 않음)면 적지 않는다.
   · 읽기: 보드가 열리면 같은 계정 · 같은 팀의 초안만 띠로 묻는다 «보관함에서 만들던 작전판이 있어요 — 되살리기 / 버리기».
     보관함 자료가 초안보다 나중에 저장됐으면(저장하고 나간 것) 낡은 초안으로 보고 지운다.
   · 되살리기: 늘 «새 작전판 만들기»로 연다 — 보관함의 원래 자료를 덮지 않는다(저장은 사람이 «저장하기»로).
   키: ps_private_board_draft_v1:<uid>:vault-unsaved:<wid>(기기 전용 · 표 storage-keys.js 의 같은 머리). */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSVaultDraft=api;root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var PREFIX='ps_private_board_draft_v1:',TAIL=':vault-unsaved:',WAIT=800;
  function key(o){return PREFIX+encodeURIComponent(o.uid)+TAIL+encodeURIComponent(o.wid);}
  function make(o,doc,meta,at){
    meta=meta||{};
    return JSON.stringify({v:1,uid:o.uid,wid:o.wid,at:at,libId:meta.libId||null,name:String(meta.name||'').slice(0,120),folder:String(meta.folder||''),tags:Array.isArray(meta.tags)?meta.tags.slice(0,20):[],book:meta.book?1:0,raw:JSON.stringify(doc)});
  }
  /* 다른 계정 · 다른 팀 · 깨진 글은 초안이 아니다 */
  function parse(raw,o){
    if(typeof raw!=='string'||!o)return null;
    try{
      var r=JSON.parse(raw);if(!r||r.v!==1||r.uid!==o.uid||r.wid!==o.wid||typeof r.raw!=='string'||!(r.at>0))return null;
      var d=JSON.parse(r.raw);if(!d||typeof d!=='object'||Array.isArray(d)||!d.snap||typeof d.snap!=='object')return null;
      r.doc=d;r.text=raw;return r;
    }catch(_){return null;}
  }
  /* 두 저장소 중 더 새 것 */
  function pick(local,idb,o){var a=parse(local,o),b=parse(idb,o);return a&&b?(b.at>a.at?b:a):(a||b);}
  /* 보관함 자료가 초안 뒤에 저장됐으면 낡은 초안 */
  function stale(rec,item){return !!(rec&&rec.libId&&item&&+item.savedAt>=rec.at);}
  function scenes(doc){
    var n=0;try{if(Array.isArray(doc.pages)&&doc.pages.length)doc.pages.forEach(function(p){var f=p&&p.anim&&p.anim.frames;n+=Array.isArray(f)?f.length:0;});else n=Array.isArray(doc.frames)?doc.frames.length:0;}catch(_){}
    return n;
  }
  function ago(at,now){var m=Math.max(0,Math.round((now-at)/60000));return m<1?'방금':(m<60?(m+'분 전'):(m<1440?(Math.round(m/60)+'시간 전'):(Math.round(m/1440)+'일 전')));}

  function install(w){
    if(w.__psVaultDraft||typeof w.vaultBoardBegin!=='function'||typeof w.vaultBoardRestore!=='function')return null;
    try{if(new w.URLSearchParams(w.location.search).get('community_view')==='1')return null;}catch(_){}   /* 커뮤니티 뷰어는 남의 글을 보는 판 — 초안을 묻지 않는다 */
    var doc=w.document,sess=null,timer=null,last=null,bar=null,offered=null,refreshT=null,refreshSeq=0;
    function owner(){try{var o=w.vaultBoardOwner();return o&&o.uid&&o.wid?o:null;}catch(_){return null;}}
    function sameOwner(a){var b=owner();return !!a&&!!b&&a.uid===b.uid&&a.wid===b.wid&&a.seal===b.seal;}
    function cls(n){try{return doc.body.classList.contains(n);}catch(_){return false;}}
    function playing(){try{return typeof animPlaying!=='undefined'&&!!animPlaying;}catch(_){return false;}}
    /* 지금 판이 «보관함에서 고치는 작전판»인가 — 보기 전용 · 불러오는 중 · 미팅 · 훈련 편집기 · 내보내기 중간 판은 담지 않는다 */
    function editing(){
      var c=w._vaultBoardContext;
      return !!(sess&&c&&c===sess.ctx&&w.__vaultEdit&&!w.__vaultReadOnly&&!w.__vaultHydrating&&!w.__vaultStarting&&!w._vaultBoardRestoring
        &&(w.__csView||'board')==='board'&&cls('vcreating')&&!cls('meet-mode')&&!cls('editing')&&!cls('comm-viewing')
        &&!w.__animExport&&!w.__capLock&&!w.__psThumbCapturing&&sameOwner(c.owner)&&(w.__vaultPending||w.__curVaultId));
    }
    function sig(){try{return typeof w.__vaultEditSig==='function'?String(w.__vaultEditSig()||''):'';}catch(_){return '';}}
    /* «저장하기»(vaultSaveCurrent)가 담는 것과 같은 것: 판 · 장면 · 페이지 */
    function capture(){
      var snap=w.captureSnap(),frames=w.__animFrames?w.__animFrames(true):null,pages=w.__psPages&&w.__psPages.forSave?w.__psPages.forSave():null;
      if(pages&&pages.length&&pages[0]&&pages[0].snap)snap=pages[0].snap;
      return {snap:snap,frames:frames||null,pages:pages||null};
    }
    function meta(){
      var p=w.__vaultPending||{},name=p.name||'';
      if(!name&&w.__curVaultId)try{name=String(doc.getElementById('vCreateTitle').textContent||'').trim();}catch(_){}
      return {libId:w.__curVaultId||null,name:name,folder:p.folder||'',tags:p.tags||[],book:!!w.__vaultBook};
    }
    function lsGet(k){try{return w.localStorage.getItem(k);}catch(_){return null;}}
    function lsDrop(k,text){try{if(w.localStorage.getItem(k)===text)w.localStorage.removeItem(k);}catch(_){}}
    /* IndexedDB 에 적고 그대로 읽히면 닫힐 때 남긴 localStorage 한 벌을 걷는다. 계정이 바뀌었으면 적지 않는다 */
    function persist(o,k,text){
      function current(){if(!sameOwner(o)){var e=new Error('vault draft owner changed');e.name='StorageOwnerChangedError';throw e;}return true;}
      if(!w.storage||!w.storage.set||!w.storage.get)return Promise.resolve(false);
      return Promise.resolve().then(function(){current();return w.storage.set(k,text,current);}).then(function(){return w.storage.get(k);}).then(function(v){
        if(!v||v.value!==text)return false;
        if(last&&last.key===k&&last.text===text)last.idb=true;
        lsDrop(k,text);return true;
      }).catch(function(){return false;});
    }
    /* now: 탭이 닫히는 길 — IndexedDB 가 끝나기 전에 꺼질 수 있어 localStorage 에도 바로 적는다(가득 차면 IndexedDB 만) */
    function write(now){
      if(!editing()||playing())return false;
      var c=sess.ctx,o=c.owner,s=sig();
      if(sess.base===undefined){sess.base=s;return false;}          /* 연 그대로의 모습 — 이것과 다를 때만 초안 */
      /* 보관함 자료 «편집»은 편집기 자신의 «변경 있음»(나갈 때 묻는 그 표시)을 따른다 — 저장한 직후의 판을 초안으로 다시 적지 않는다 */
      if((!w.__vaultPending&&w.__curVaultId)?!w.__vaultManualDirty:s===sess.base)return false;
      var m=meta(),k=key(o),text;
      if(last&&last.key===k&&last.sig===s&&last.libId===m.libId)text=last.text;
      else{
        try{text=make(o,capture(),m,Date.now());}catch(_){return false;}   /* 담지 못하면 앞 초안을 그대로 둔다 */
        last={key:k,sig:s,libId:m.libId,text:text,idb:false};
      }
      if(now&&!last.idb)try{w.localStorage.setItem(k,text);}catch(_){}
      if(!last.idb)persist(o,k,text);
      return true;
    }
    function schedule(){
      if(!sess)return;
      try{w.clearTimeout(timer);}catch(_){}
      timer=w.setTimeout(function(){timer=null;if(playing()){schedule();return;}try{write(false);}catch(_){}},WAIT);   /* 재생 중 판은 보간값 — 멈춘 뒤에 담는다 */
    }
    function flush(){try{w.clearTimeout(timer);}catch(_){}timer=null;try{return write(true);}catch(_){return false;}}
    function drop(o,rec){
      var k=key(o);if(last&&last.key===k)last=null;
      try{if(rec&&rec.text)lsDrop(k,rec.text);else w.localStorage.removeItem(k);}catch(_){}
      try{if(w.storage&&w.storage.delIfValue&&rec&&rec.text)return Promise.resolve(w.storage.delIfValue(k,rec.text,function(){return true;})).catch(function(){return false;});
        if(w.storage&&w.storage.del)return Promise.resolve(w.storage.del(k)).catch(function(){return false;});}catch(_){}
      return Promise.resolve(false);
    }
    async function read(o){
      var k=key(o),local=lsGet(k),idb=null;
      try{if(w.storage&&w.storage.get){var v=await w.storage.get(k);idb=v&&typeof v.value==='string'?v.value:null;}}catch(_){}
      return pick(local,idb,o);
    }
    function barHide(){try{if(bar&&bar.parentNode)bar.parentNode.removeChild(bar);}catch(_){}bar=null;offered=null;w.__vaultDraftPending=null;}
    function css(){
      if(doc.getElementById('psVaultDraftBarStyle'))return;
      var st=doc.createElement('style');st.id='psVaultDraftBarStyle';
      st.textContent='#psVaultDraftBar{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:160;display:flex;align-items:center;gap:8px;max-width:min(92vw,600px);padding:8px 8px 8px 14px;border-radius:14px;background:rgba(18,22,30,.94);color:#fff;font-family:inherit;font-size:13px;font-weight:600;line-height:1.3;box-shadow:0 8px 22px rgba(0,0,0,.35);border:1px solid rgba(255,210,74,.55)}'
        +'#psVaultDraftBar .vd-tx{flex:1 1 auto;min-width:0}#psVaultDraftBar button{flex:0 0 auto;min-height:38px;padding:0 12px;border:0;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;background:rgba(255,255,255,.12);color:#fff}'
        +'#psVaultDraftBar button.vd-keep{background:#ffd24a;color:#14213D}#psVaultDraftBar button:focus-visible{outline:2px solid #9AA8C4;outline-offset:2px}'
        +'body:has(#boardDraftBar) #psVaultDraftBar{top:calc(128px + env(safe-area-inset-top,0px))}'
        +'body.editing #psVaultDraftBar,body.meet-mode #psVaultDraftBar,body.vcreating #psVaultDraftBar,body.vault-full #psVaultDraftBar,body.comm-viewing #psVaultDraftBar,body.focus-board #psVaultDraftBar{display:none!important}';
      doc.head.appendChild(st);
    }
    function barShow(o,rec){
      barHide();offered={owner:o,rec:rec};w.__vaultDraftPending=rec;
      try{
        css();
        var el=doc.createElement('div'),n=scenes(rec.doc);el.id='psVaultDraftBar';el.setAttribute('role','status');
        el.innerHTML='<span class="vd-tx"></span><button type="button" class="vd-keep">되살리기</button><button type="button" class="vd-drop">버리기</button>';
        el.querySelector('.vd-tx').textContent='보관함에서 만들던 '+(rec.book?'패턴북':'작전판')+'이 있어요'+(n>1?' · 장면 '+n+'개':'')+' · '+ago(rec.at,Date.now());
        el.querySelector('.vd-keep').onclick=function(){restore();};
        el.querySelector('.vd-drop').onclick=function(){var x=offered;barHide();if(x)drop(x.owner,x.rec);try{w.toast('만들던 작전판 초안을 버렸어요');}catch(_){}};
        doc.body.appendChild(el);bar=el;
      }catch(_){}
    }
    /* 초안이 있으면 띠로 묻는다. 편집기 안(지금 쓰는 중)에서는 묻지 않는다 */
    function refresh(){
      var seq=++refreshSeq,o=owner();
      if(!o||sess||w._vaultBoardContext){if(!o||!offered||!sameOwner(offered.owner))barHide();return Promise.resolve(false);}
      try{if(typeof w.psVaultUnlocked==='function'&&!w.psVaultUnlocked())return Promise.resolve(false);}catch(_){}
      return read(o).then(async function(rec){
        if(seq!==refreshSeq||!sameOwner(o)||sess||w._vaultBoardContext)return false;
        if(!rec){barHide();return false;}
        if(rec.libId){
          var item=null;try{var lib=await w.libGet();item=(lib||[]).filter(function(x){return x&&x.libId===rec.libId;})[0]||null;}catch(_){return false;}   /* 보관함을 못 읽으면 판단하지 않는다(초안은 남는다) */
          if(seq!==refreshSeq||!sameOwner(o)||sess||w._vaultBoardContext)return false;
          if(stale(rec,item)){barHide();await drop(o,rec);return false;}
        }
        if(offered&&offered.rec.text===rec.text&&bar)return true;
        barShow(o,rec);return true;
      }).catch(function(){return false;});
    }
    function later(ms){try{w.clearTimeout(refreshT);}catch(_){}refreshT=w.setTimeout(function(){refreshT=null;refresh();},ms);}
    function busy(){
      return !!(w._vaultBoardContext||w._vaultBoardRestoring||w.__vaultEdit||w.__animExport||w.__capLock||w.__psThumbCapturing||playing()||cls('editing')||cls('meet-mode')||cls('comm-viewing')||cls('vcreating'));
    }
    /* 새 작전판 만들기로 열고 초안을 올린다 — 보관함의 원래 자료는 그대로다 */
    function restore(){
      var x=offered;if(!x||!sameOwner(x.owner))return false;
      if(busy()||typeof w.__vaultNewBoard!=='function'){try{w.toast('열려 있는 편집을 닫은 뒤 «되살리기»를 눌러 주세요');}catch(_){}return false;}
      var rec=x.rec,d=rec.doc;
      try{w.__vaultNewBoard('board',rec.book?{book:true}:undefined);}catch(_){}
      if(!w._vaultBoardContext||!w.__vaultPending||!w.__vaultEdit){try{w.toast('지금은 되살릴 수 없어요 — 초안은 그대로 있어요');}catch(_){}return false;}
      var ctx=w._vaultBoardContext;
      w.__vaultHydrating=true;
      try{
        try{if(w.__animReset)w.__animReset();}catch(_){}
        w.loadSnap(d.snap||{});w.renderTokens();w.renderDrawings();w.updateDelUI();
        if(w.__psPages&&Array.isArray(d.pages)&&(d.pages.length>1||(rec.book&&d.pages.length===1)))w.__psPages.restore(d.pages,true,0);
        else if(Array.isArray(d.frames)&&d.frames.length>1&&w.__animLoad)w.__animLoad(d.frames);
        var p=w.__vaultPending;
        p.name=rec.name?(rec.libId?rec.name+' (되살림)':rec.name):p.name;if(rec.folder)p.folder=rec.folder;if(rec.tags&&rec.tags.length)p.tags=rec.tags;
      }catch(_){}
      barHide();
      /* 되살린 판은 «아직 저장 안 한 것»이다 — 연 모습과 견주지 않고 곧바로 초안으로 다시 적는다 */
      w.setTimeout(function(){if(w._vaultBoardContext!==ctx)return;w.__vaultHydrating=false;if(sess&&sess.ctx===ctx){sess.base=null;schedule();}},450);
      try{w.toast('만들던 작전판을 되살렸어요 · «저장하기»를 누르면 보관함에 담겨요');}catch(_){}
      return true;
    }
    /* ── 편집기 드나듦 ── */
    var begin=w.vaultBoardBegin,end=w.vaultBoardRestore,leave=w.__vaultBoardLeave,undo=w.pushUndo;
    w.vaultBoardBegin=function(){
      var g=begin.apply(this,arguments);
      try{
        if(g!==null&&w._vaultBoardContext){
          barHide();sess={ctx:w._vaultBoardContext,base:undefined};last=null;
          var mine=sess;w.setTimeout(function(){if(sess===mine)try{write(false);}catch(_){}},650);   /* 불러오기(420ms)가 끝난 뒤의 모습을 기준으로 */
        }
      }catch(_){}
      return g;
    };
    /* 떠나기 직전 — 판이 아직 편집기 것일 때만 한 번 더 담는다(«나가기»는 판을 먼저 갈아 끼우므로 그때는 앞 초안이 남는다) */
    if(typeof leave==='function')w.__vaultBoardLeave=function(){try{flush();}catch(_){}return leave.apply(this,arguments);};
    w.vaultBoardRestore=function(){
      var had=sess,c=w._vaultBoardContext;
      try{
        if(had&&c&&c===had.ctx){
          flush();
          /* 이 편집에서 보관함 자료가 생겼으면(«저장하기») 초안에 그 자료를 적어 둔다 — 띠를 띄울지 말지는 보관함의 저장 시각이 정한다 */
          var id=w.__curVaultId||null,o=c.owner,k=key(o);
          if(id&&sameOwner(o)&&last&&last.key===k&&last.libId!==id){
            var r=parse(last.text,o);
            if(r){var text=make(o,r.doc,{libId:id,name:r.name,folder:r.folder,tags:r.tags,book:r.book},r.at),was=last.text;
              last={key:k,sig:last.sig,libId:id,text:text,idb:false};
              try{if(w.localStorage.getItem(k)===was)w.localStorage.setItem(k,text);}catch(_){}
              persist(o,k,text);}
          }
        }
      }catch(_){}
      var out=end.apply(this,arguments);
      try{if(!w._vaultBoardContext){sess=null;try{w.clearTimeout(timer);}catch(_){}timer=null;later(500);}}catch(_){}
      return out;
    };
    if(typeof undo==='function')w.pushUndo=function(){var out=undo.apply(this,arguments);if(sess)schedule();return out;};
    ['pointerup','keyup','change'].forEach(function(t){doc.addEventListener(t,function(){if(sess)schedule();},true);});
    /* «변경 사항을 버리고 나갈까요?»에 답해 나간 것은 사람이 버린 것이다 — 보기/편집 띠의 «나가기»만(새로 만들기의 «나가기»는 묻지 않으므로 초안을 남긴다) */
    doc.addEventListener('click',function(e){
      try{
        var t=e.target&&e.target.closest?e.target.closest('#vCreateCancel'):null;if(!t||!sess)return;
        if(w.__vaultViewMode&&w.__vaultManualDirty){var mine=sess,c=mine.ctx;
          var iv=w.setInterval(function(){
            if(sess===mine&&w._vaultBoardContext===c){if(!doc.querySelector('[data-ps-ok="1"]'))w.clearInterval(iv);return;}   /* 묻는 창을 닫고 계속 고친다 */
            w.clearInterval(iv);
            if(sameOwner(c.owner)){refreshSeq++;barHide();drop(c.owner,null);}   /* 버리고 나갔다 — 초안도 버린다 */
          },120);
          w.setTimeout(function(){w.clearInterval(iv);},600000);
        }else flush();
      }catch(_){}
    },true);
    try{w.addEventListener('pagehide',flush);}catch(_){}
    try{doc.addEventListener('visibilitychange',function(){if(doc.visibilityState==='hidden')flush();});}catch(_){}
    try{w.addEventListener('ps-auth-state',function(){later(600);});}catch(_){}
    /* 부팅: 내 작업판을 다 불러온 뒤 한 번(주인을 모르면 조금 뒤 다시) */
    var tries=0;(function boot(){
      if(w.__boardRestoreDone&&owner()){refresh();return;}
      if(++tries<120)w.setTimeout(boot,500);
    })();
    var api={refresh:refresh,flush:flush,restore:restore,state:function(){return {session:!!sess,base:sess?sess.base:undefined,last:last?{libId:last.libId,idb:last.idb}:null,offered:!!offered};}};
    w.__psVaultDraft=api;return api;
  }
  return {key:key,make:make,parse:parse,pick:pick,stale:stale,scenes:scenes,ago:ago,install:install};
});
