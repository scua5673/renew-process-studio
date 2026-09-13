/* PROCESS STUDIO — 저장소 어댑터
   왜: 모든 데이터가 localStorage에 있었고, iOS Safari는 오리진당 약 5MB가 한계다.
       초과하면 setItem이 throw하는데 호출부가 전부 빈 catch로 삼켜서 "저장됨" 토스트만 뜨고 조용히 사라졌다.

   하는 일 세 가지:
   1) window.storage — IndexedDB 키-값 어댑터. board.html의 store가 이미 window.storage를 먼저 보므로
      끼우기만 하면 작전판 스냅샷·애니메이션·보관함이 IDB(수백MB)로 옮겨간다.
      기존 localStorage 값은 처음 읽을 때 IDB로 지연 마이그레이션한다(안 그러면 기존 데이터가 안 보인다).
   2) navigator.storage.persist() 요청 — iOS가 저장소를 임의로 비우지 않게.
   3) localStorage.setItem 용량 초과를 감지해 화면에 경고. 더는 조용히 잃지 않는다. */
(function(){
  "use strict";
  var DB='ps-store', STORE='kv', VER=1, dbp=null;

  /* HTML 문자열을 DOM에 넣어야 하는 기존 화면의 단일 이스케이프 규칙.
     새 코드는 textContent를 우선하고, 템플릿 문자열이 필요한 곳만 이 함수를 쓴다. */
  window.PSSafe=window.PSSafe||{};
  window.PSSafe.html=function(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  };

  /* 콘텐츠·사용자 식별값은 남기지 않고 실패 단계와 브라우저 오류 코드만 기록한다. */
  function diagnostic(stage,error){
    var info={stage:String(stage||'storage').slice(0,48)};
    if(error){
      info.name=String(error.name||'Error').slice(0,48);
      info.code=String(error.code||'').slice(0,48);
    }
    try{ console.warn('[PSStorage]',info); }catch(_){}
    try{ window.dispatchEvent(new CustomEvent('ps-storage-diagnostic',{detail:info})); }catch(_){}
  }
  window.PSStorageDiagnostic=diagnostic;

  /* 동기화되지 않는 기기 전용 키 — IDB로 옮긴 뒤 localStorage 사본을 지워 용량을 되찾는다.
     (sync.js의 KEYS/LIBKEY는 여기 없다 — 그건 2단계에서 다룬다) */
  var DEVICE_LOCAL={'cs_drill_lib_v1':1,'cs_board_live_v1':1,'cs_snap_board_v1':1,'cs_snap_match_v2':1};
  /* 1.658 — 일정 3-way 병합의 기준본은 일정 원문 전체와 거의 같은 크기다.
     예전에는 워크스페이스마다 localStorage에 한 벌씩 더 두어 iPad의 약 5MB 한도를
     일정 원문+기준본 두 벌만으로도 채웠다. 기준본은 화면이 직접 읽는 문서가 아니므로
     IDB로 옮기되, 되읽어 같은 문자열임을 확인한 뒤에만 작은 저장소 사본을 지운다. */
  var AUX_IDB_PREFIX='ps_sync_base_';
  function isAuxIDBKey(k){ return !!k&&String(k).indexOf(AUX_IDB_PREFIX)===0; }
  /* 1.535 — "저장 공간이 가득 찼어요"만으로는 손쓸 수가 없다. 무엇이 자리를 차지하는지
     이름으로 알려주고, 무엇을 줄이면 되는지까지 말한다. (sync.js keyLabel 과 같은 어휘) */
  var SPACE_LABEL={
    'scout_tool_v1':['선수단·스카우트','선수 사진이 대부분입니다 — 선수 프로필에서 사진을 지우면 크게 줄어요'],
    'cs_coach_img_v1':['지도자 이미지노트','오래된 장면 스케치를 지우면 줄어요'],
    'cs_drill_lib_v1':['보관함','오래된 자료를 지우거나 내보낸 뒤 지우세요'],
    'cs_board_live_v1':['작업 중인 작전판','새 페이지로 정리하면 줄어요'],
    'cs_pitch_img':['운동장 배경 사진','설정에서 배경 사진을 지우면 바로 줄어요'],
    'cs_notes_v1':['노트','오래된 노트를 정리하세요'],
    'cs_note_papers_v1':['노트 용지',''],
    'cs_team_matches_v1':['경기 준비·리뷰',''],
    'process_coach_v1':['일정·주간 훈련',''],
    'cs_squad_v1':['선수단',''],
    'training_sessions_v1':['훈련 세션',''],
    'cs_analysis_workspaces_v1':['매치데스크','오래된 경기 분석을 정리하세요'],
    'cs_gamemodel_v1':['게임모델',''],'cs_team_attrs_v1':['평가 항목',''],'cs_perms_v1':['권한','']
  };
  function spaceLabel(k){
    if(!k)return ['기타',''];
    if(k.indexOf('cs_idp_pub_v1_')===0)return ['코치 피드백',''];
    if(k.indexOf('cs_idp_v1_')===0)return ['IDP','이미지노트 사진이 큽니다'];
    if(k.indexOf('ps_sync_base_')===0)return ['일정 동기화 기준본','안전 저장소 확인 뒤 자동으로 정리됩니다'];
    if(k.indexOf('ps_sync_conflict_')===0)return ['동기화 충돌 사본','안전하게 지워도 되는 임시 사본입니다'];
    return SPACE_LABEL[k]||[k,''];
  }
  /* 비동기 본 저장 전에 잠깐 쓰는 복구 사본. 이 키의 실패는 본 저장 실패가 아니므로
     기존 사본을 비우고 한 번 재시도하되, 그래도 안 되면 빨간 데이터 유실 경고를 띄우지 않는다. */
  var AUX_RECOVERY={'cs_vault_edit_recovery_v1':1,'cs_board_recovery_v1':1};

  function hasIDB(){ try{ return typeof indexedDB!=='undefined' && indexedDB; }catch(_){ return false; } }
  function open(){
    if(dbp) return dbp;
    dbp=new Promise(function(res,rej){
      var r=indexedDB.open(DB,VER);
      r.onupgradeneeded=function(){ try{ r.result.createObjectStore(STORE); }catch(_){} };
      r.onsuccess=function(){ res(r.result); };
      r.onerror=function(){ rej(r.error); };
      r.onblocked=function(){ rej(new Error('idb blocked')); };
    });
    return dbp;
  }
  function tx(mode,fn){
    return open().then(function(db){
      return new Promise(function(res,rej){
        var t=db.transaction(STORE,mode), s=t.objectStore(STORE), req=fn(s);
        t.oncomplete=function(){ res(req?req.result:undefined); };
        t.onerror=function(){ rej(t.error); };
        t.onabort=function(){ rej(t.error); };
      });
    });
  }
  function idbGet(k){ return tx('readonly',function(s){ return s.get(k); }); }
  function idbSet(k,v){
    return tx('readwrite',function(s){ s.put(v,k); return null; }).then(function(){
      /* transaction complete만으로 성공 처리하지 않는다. 실제 값을 다시 읽어
         Safari의 중단·스토리지 제거 상황에서도 "저장됨" 오판을 막는다. */
      return idbGet(k).then(function(saved){
        if(saved===v)return true;
        /* 2.631 — 한 번 더 읽는다(150ms 뒤). 같은 키를 두 창(작전판·셸)이 겹쳐 쓰면 첫 읽기가 다른 쪽 값을 볼 수 있다 — 실측 24h sync_storage 8건 전부 모바일.
           두 번째도 다르면 그때 실패. 실제 Safari 저장소 제거·용량 초과는 두 번 다 다르게 나온다. */
        return new Promise(function(res){ setTimeout(res,150); }).then(function(){ return idbGet(k); }).then(function(again){
          if(again===v)return true;
          var e=new Error('storage verification failed');
          e.name='StorageVerificationError';
          throw e;
        });
      });
    }).catch(function(error){
      diagnostic('idb-set:'+k,error);
      if(isQuotaErr(error))warnFull(k);
      throw error;
    });
  }
  function idbDel(k){ return tx('readwrite',function(s){ s.delete(k); return null; }); }
  /* sync 회차의 팀/계정이 IDB write 도중 바뀐 경우에만 쓰는 exact 정리.
     get→del을 두 transaction으로 나누면 그 사이 새 팀 저장까지 지울 수 있으므로,
     같은 readwrite transaction 안에서 방금 쓴 원문과 정확히 같을 때만 지운다. */
  function idbDelIfValue(k,expected){
    return open().then(function(db){return new Promise(function(res,rej){
      var removed=false,t=db.transaction(STORE,'readwrite'),s=t.objectStore(STORE),r=s.get(k);
      r.onsuccess=function(){if(r.result===expected){s.delete(k);removed=true;}};
      t.oncomplete=function(){res(removed);};t.onerror=function(){rej(t.error);};t.onabort=function(){rej(t.error);};
    });});
  }
  /* 늦게 끝난 이전 워크스페이스 쓰기를 되돌릴 때 쓰는 exact 교체.
     get→put을 나누면 그 사이 새 팀 값까지 덮을 수 있으므로 한 transaction에서
     아직 expected가 그대로일 때만 replacement로 바꾼다. */
  function idbReplaceIfValue(k,expected,replacement){
    return open().then(function(db){return new Promise(function(res,rej){
      var changed=false,t=db.transaction(STORE,'readwrite'),s=t.objectStore(STORE),r=s.get(k);
      r.onsuccess=function(){
        /* IDB get은 없는 키를 undefined로 돌리지만 동기화 계층은 부재를 null로
           정규화한다. null expected도 한 transaction 안에서 "아직 없음"과
           비교할 수 있어야 새 행 pull과 선수 항목 CAS가 원자적으로 동작한다. */
        var same=r.result===expected||(expected===null&&(r.result===undefined||r.result===null));
        if(!same)return;
        if(replacement===undefined||replacement===null)s.delete(k);else s.put(replacement,k);
        changed=true;
      };
      t.oncomplete=function(){res(changed);};t.onerror=function(){rej(t.error);};t.onabort=function(){rej(t.error);};
    });});
  }
  function idbKeys(prefix){
    prefix=String(prefix||'');
    return tx('readonly',function(s){ return s.getAllKeys(); }).then(function(keys){
      return (keys||[]).map(String).filter(function(k){return !prefix||k.indexOf(prefix)===0;});
    });
  }

  /* ── 용량 초과 경고 ── */
  var warned=false;
  function warnFull(key){
    if(warned) return; warned=true;
    try{ console.warn('[PSStorage] 저장소 용량 초과:',key); }catch(_){}
    /* 배너를 먼저 띄운다. 이벤트가 앞서면 PSSaveState가 "배너 없음"으로 보고
       같은 말을 하는 알림을 하나 더 띄운다. */
    try{ banner(); }catch(_){}
    try{ window.dispatchEvent(new CustomEvent('ps-storage-full',{detail:{key:key}})); }catch(_){}
  }
  function mb(n){ return (Math.max(0,+n||0)/1048576).toFixed(n>=10485760?0:1)+'MB'; }
  /* 용량이 찼을 때 사용자가 그 자리에서 할 수 있는 일을 준다.
     예전 배너는 "정리해 주세요"라고만 하고 정리할 방법은 설정 안에 숨어 있었다.
     '지금 정리'는 IndexedDB에 같은 내용이 저장됐다고 다시 읽어 확인한 중복 사본만 지운다 —
     기록 자체는 절대 지우지 않는다. */
  function banner(){
    if(!document.body||document.getElementById('psStorageFull')) return;
    var b=document.createElement('div'); b.id='psStorageFull';
    b.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;max-width:min(560px,92vw);'
      +'background:#D6453D;color:#fff;font:700 13px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;'
      +'padding:11px 14px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35);display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
    var msg=document.createElement('span'); msg.style.cssText='flex:1 1 240px';
    msg.innerHTML='⚠ 저장 공간이 가득 찼어요 — <b>방금 변경이 저장되지 않았습니다.</b><br>'
      +'아래 <b>지금 정리</b>로 중복 사본을 비운 뒤 다시 저장해 보세요.';
    b.appendChild(msg);
    /* 1.535 — 무엇이 자리를 차지하는지 이름으로 보여준다(크기만 알면 손쓸 수가 없다) */
    try{
      var top=(window.PSStorage&&PSStorage.largestLocal)?PSStorage.largestLocal(3):[];
      if(top&&top.length){
        var det=document.createElement('div');
        det.style.cssText='flex:1 1 100%;margin-top:2px;padding-top:8px;border-top:1px solid rgba(255,255,255,.28);font-weight:600;line-height:1.65;';
        det.innerHTML='<div style="font-weight:800;margin-bottom:3px">지금 자리를 많이 쓰는 것</div>'
          +top.map(function(r){ var L=spaceLabel(r.key);
            return '<div>· <b>'+L[0]+'</b> '+mb(r.bytes)+(L[1]?(' <span style="opacity:.85">— '+L[1]+'</span>'):'')+'</div>';
          }).join('');
        b.appendChild(det);
      }
    }catch(_){}

    var btnCss='flex:0 0 auto;border:0;background:rgba(255,255,255,.2);color:#fff;'
      +'font:inherit;padding:6px 10px;border-radius:8px;cursor:pointer';
    function mk(label,primary){
      var el=document.createElement('button'); el.type='button'; el.textContent=label;
      el.style.cssText=btnCss+(primary?';background:#fff;color:#B52F29':'');
      return el;
    }
    var tidy=mk('지금 정리',true);
    tidy.onclick=function(){
      if(!window.PSStorage||!PSStorage.optimize){ msg.innerHTML='⚠ 이 기기에서는 자동 정리를 쓸 수 없어요. <b>백업</b>부터 해 주세요.'; return; }
      tidy.disabled=true; tidy.textContent='정리 중…';
      PSStorage.optimize().then(function(r){
        var _th=(r.thumbSaved>0)?(' · 썸네일 <b>'+r.thumbSlimmed+'장</b>에서 잔디 사진 <b>'+mb(r.thumbSaved)+'</b> 걷어냄'):'';
        if(r.freed>0||r.thumbSaved>0){
          msg.innerHTML='✅ <b>'+mb(Math.max(r.freed,0)+Math.max(r.thumbSaved||0,0))+'</b>를 비웠습니다'
            +(r.imgMoved?(' (사진 <b>'+r.imgMoved+'장</b>을 큰 저장소로 옮김)'):'')+_th
            +'. 방금 하던 편집을 다시 저장해 보세요.';
          b.style.background='#2E7D5B';
        }else{
          /* 1.535 — 이름과 '무엇을 줄이면 되는지'까지 말한다 */
          var L0=(r.largest&&r.largest[0])?spaceLabel(r.largest[0].key):null;
          msg.innerHTML='비울 수 있는 중복 사본이 없었습니다. <b>기록은 그대로 보존했습니다.</b><br>'
            +(L0?('가장 큰 것은 <b>'+L0[0]+'</b> '+mb(r.largest[0].bytes)+'입니다'+(L0[1]?(' — '+L0[1]):'')+'.')
                :'백업한 뒤 보관함에서 오래된 항목을 정리해 주세요.');
        }
        try{ if(window.parent&&window.parent.__psUpdateStorageUsage)window.parent.__psUpdateStorageUsage(); }catch(_){}
      }).catch(function(){
        msg.innerHTML='정리를 마치지 못했습니다. <b>데이터는 삭제하지 않았습니다.</b> 백업을 권합니다.';
      }).then(function(){ tidy.disabled=false; tidy.textContent='다시 정리'; });
    };

    var bk=mk('백업');
    bk.onclick=function(){
      try{
        var d=(window.parent&&window.parent.document&&window.parent.document.getElementById('bkDown'))||document.getElementById('bkDown');
        if(d){d.click();return;}
      }catch(_){}
      msg.innerHTML='백업 버튼을 찾지 못했습니다. 설정 화면에서 백업해 주세요.';
    };

    var x=mk('닫기');
    x.onclick=function(){ try{b.remove();}catch(_){} warned=false; };

    b.appendChild(tidy); b.appendChild(bk); b.appendChild(x);
    document.body.appendChild(b);
    /* 2.463 — 가득 찬 순간이 정리가 가장 필요한 순간인데, '지금 정리' 버튼을 아는
       사용자만 눌렀다. 같은 안전 정리를 자동으로 한 번 돌리고, 결과는 버튼이 말하던
       그 자리에서 말한다(정리 중… → 몇 MB를 비웠습니다). */
    try{ setTimeout(function(){ if(b.isConnected&&!tidy.disabled)tidy.click(); },400); }catch(_){}
  }
  /* 저장이 다시 성공하면 경고 잠금을 푼다. 안 그러면 이후에 또 가득 차도 배너가 뜨지 않는다. */
  try{ window.addEventListener('ps-storage-recovered',function(){ warned=false; }); }catch(_){}
  function isQuotaErr(e){
    if(!e) return false;
    return e.name==='QuotaExceededError' || e.name==='NS_ERROR_DOM_QUOTA_REACHED' || e.code===22 || e.code===1014;
  }
  /* localStorage.setItem을 감싼다 — 기존 빈 catch가 삼키더라도 경고는 이미 발화된 뒤다.
     (perms.js의 읽기전용 게이트가 이 위를 다시 감싸도 문제없다) */
  try{
    var _si=localStorage.setItem.bind(localStorage);
    localStorage.setItem=function(k,v){
      try{ return _si(k,v); }
      catch(e){
        if(isQuotaErr(e)&&AUX_RECOVERY[k]){
          try{localStorage.removeItem(k);return _si(k,v);}
          catch(auxErr){try{console.warn('[PSStorage] 보조 복구 사본 생략:',k);}catch(_){}return;}
        }
        if(isQuotaErr(e)) warnFull(k); throw e;
      }
    };
  }catch(_){}

  /* ── 영구 저장 요청 ── */
  function requestPersist(){
    try{
      if(!navigator.storage||!navigator.storage.persist) return Promise.resolve(false);
      return navigator.storage.persisted().then(function(p){ return p?true:navigator.storage.persist(); });
    }catch(_){ return Promise.resolve(false); }
  }
  requestPersist();
  /* Safari는 사용자 제스처가 있어야 승인하는 경우가 많다 → 첫 상호작용에서 한 번 더 */
  try{
    var once=function(){ window.removeEventListener('pointerdown',once,true); requestPersist(); };
    window.addEventListener('pointerdown',once,true);
  }catch(_){}

  if(!hasIDB()) return;   /* IDB 없으면 window.storage 미정의 → 기존 localStorage 경로 그대로 */

  /* ── 업그레이드 마이그레이션 (지연만으로는 부족하다) ──
     앱이 IDB에 빈 값([])을 먼저 쓰면, 이후 어댑터는 "값이 있다"고 보고 localStorage로 폴백하지 않는다
     → 기존 보관함이 통째로 사라진 것처럼 보인다. 그래서 첫 로드에 선제적으로 옮긴다.
     빈 값([]·{})은 실데이터로 치지 않아 덮어쓸 수 있게 한다. */
  var MIGRATE=['cs_drill_lib_v1','cs_board_live_v1','cs_snap_board_v1','cs_snap_match_v2'];
  function emptyish(s){ return s==null||s===''||s==='[]'||s==='{}'||s==='null'; }
  function localKeys(prefix){
    var out=[];try{for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);if(k&&(!prefix||String(k).indexOf(prefix)===0))out.push(String(k));
    }}catch(_){}
    return out;
  }
  function migrateAuxKey(k){
    var lv=null;try{lv=localStorage.getItem(k);}catch(_){}
    if(lv==null)return Promise.resolve(null);
    return idbGet(k).then(function(iv){
      if(iv===lv){try{localStorage.removeItem(k);}catch(_){}return true;}
      /* IDB가 비어 있을 때만 구버전의 localStorage 기준본을 정본으로 받아들인다.
         양쪽이 다르면 구버전 탭과 새 탭이 동시에 쓴 것일 수 있으므로 하나를 덮지 않는다. */
      if(!emptyish(iv)){
        var conflict=new Error('auxiliary storage versions differ');conflict.name='StorageConflictError';
        diagnostic('aux-migration-conflict:'+k,conflict);return false;
      }
      return idbSet(k,lv).then(function(){return idbGet(k);}).then(function(saved){
        if(saved!==lv)throw new Error('auxiliary storage verification failed');
        try{localStorage.removeItem(k);}catch(_){}
        return true;
      });
    }).catch(function(error){diagnostic('aux-migration:'+k,error);return false;});
  }
  var fixedMigrated=Promise.all(MIGRATE.map(function(k){
    var lv=null; try{ lv=localStorage.getItem(k); }catch(_){}
    if(emptyish(lv)) return null;
    return idbGet(k).then(function(cur){
      if(!emptyish(cur)) return null;                 /* IDB에 이미 실데이터 → 그대로 둔다 */
      return idbSet(k,lv).then(function(){
        /* IDB 저장이 확인된 뒤에만 사본 제거 — 이게 5MB 캡을 실제로 되찾는 지점.
           (구버전으로 되돌리면 IDB를 못 읽으므로, 되돌릴 땐 백업 파일로 복원해야 한다) */
        try{ localStorage.removeItem(k); }catch(_){}
      });
    }).catch(function(error){ diagnostic('migration:'+k,error); return null; });
  })).catch(function(error){ diagnostic('migration:all',error); });
  var migrated=fixedMigrated.then(function(){
    return Promise.all(localKeys(AUX_IDB_PREFIX).map(migrateAuxKey));
  }).catch(function(error){ diagnostic('aux-migration:all',error); });
  migrated.then(function(){setTimeout(function(){
    try{if(window.parent&&window.parent.__psUpdateStorageUsage)window.parent.__psUpdateStorageUsage();}catch(_){}
  },0);});

  /* ── window.storage: board.html의 store가 기대하는 계약 ──
     get(k) → {value:string} | null      set(k, string) → Promise */
  /* 모든 접근은 마이그레이션이 끝난 뒤에 — 앱이 먼저 빈 값을 쓰는 경쟁 조건을 없앤다 */
  /* ══ 2.519 · 썸네일 다이어트 — 이미 쌓인 그림에서 잔디 사진을 걷어낸다 ═══════════
     실측(사용자 제보 "일정·주간 훈련 4.1MB"): 작전판 썸네일 한 장 164KB 중 **129KB 가 실사 잔디
     텍스처**(pattern#psRealGrass 안의 avif data URI)였다. 일정은 훈련 칩마다 그림을 통째로
     복사해 담으므로 그 사진이 칩 수만큼 늘어난다. 2.519 부터 새 썸네일에는 안 박히고(board.html),
     여기서는 **이미 저장된 것**을 정리한다.
     ⚠ 지우는 것은 잔디 무늬뿐이다 — 선수·선·글씨·배치(snap)는 손대지 않는다.
       패턴을 지우고 그 참조를 단색 잔디(#1e8c4c)로 바꾼다. 그림은 그대로 그려진다. */
  var THUMB_KEYS=['process_coach_v1','cs_drill_lib_v1','cs_board_live_v1','training_sessions_v1','cs_notes_v1'];
  function slimSVG(str){
    if(typeof str!=='string'||str.length<2000||str.indexOf('psRealGrass')<0)return str;
    var ids=[];
    var out=str.replace(/<pattern\b[^>]*\bid="(psRealGrass[^"]*)"[\s\S]*?<\/pattern>/g,function(m,id){ ids.push(id); return ''; });
    if(!ids.length)return str;
    ids.forEach(function(id){ out=out.split('url(#'+id+')').join('#1e8c4c'); });
    return out;
  }
  function slimDeep(v,stat){
    if(typeof v==='string'){ var n=slimSVG(v); if(n!==v){ stat.n++; stat.saved+=(v.length-n.length); } return n; }
    if(Array.isArray(v)){ for(var i=0;i<v.length;i++)v[i]=slimDeep(v[i],stat); return v; }
    if(v&&typeof v==='object'){ for(var k in v){ if(Object.prototype.hasOwnProperty.call(v,k))v[k]=slimDeep(v[k],stat); } return v; }
    return v;
  }
  /* 한 키를 읽어(작은 저장소 우선, 없으면 IDB) 다이어트하고 있던 자리에 돌려놓는다 */
  function slimKey(k,stat){
    var lv=null; try{ lv=localStorage.getItem(k); }catch(_){}
    var work=function(txt,put){
      if(!txt||txt.indexOf('psRealGrass')<0)return Promise.resolve();
      var obj; try{ obj=JSON.parse(txt); }catch(_){ return Promise.resolve(); }
      var st={n:0,saved:0}; obj=slimDeep(obj,st);
      if(!st.n)return Promise.resolve();
      var out; try{ out=JSON.stringify(obj); }catch(_){ return Promise.resolve(); }
      if(out.length>=txt.length)return Promise.resolve();
      stat.n+=st.n; stat.saved+=(txt.length-out.length);
      return put(out);
    };
    if(lv!=null) return work(lv,function(out){ try{ localStorage.setItem(k,out); }catch(_){} return Promise.resolve(); });
    return idbGet(k).then(function(iv){
      if(typeof iv==='string')return work(iv,function(out){ return idbSet(k,out); });
      /* 보관함(cs_drill_lib_v1)은 문자열이 아니라 **객체 그대로** IndexedDB 에 앉는다.
         여기를 건너뛰면 원본 썸네일이 뚱뚱한 채 남고, 그걸 일정에 넣는 순간 다시 4MB 로 불어난다.
         (2.519 첫 판에서 실제로 이 구멍이 있었다 — 일정만 줄이고 원본은 그대로였다.) */
      if(!iv||typeof iv!=='object')return;
      var before=0,after=0; try{ before=JSON.stringify(iv).length; }catch(_){ return; }
      var st={n:0,saved:0}; var slim=slimDeep(iv,st);
      if(!st.n)return;
      try{ after=JSON.stringify(slim).length; }catch(_){ return; }
      if(after>=before)return;
      stat.n+=st.n; stat.saved+=(before-after);
      return idbSet(k,slim);
    }).catch(function(){});
  }
  function slimThumbs(){
    var stat={n:0,saved:0};
    return Promise.all(THUMB_KEYS.map(function(k){ return slimKey(k,stat).catch(function(){}); }))
      .then(function(){ return stat; });
  }
  function afterMigrate(fn){ return migrated.then(fn,fn); }

  window.storage={
    get:function(k){
      return afterMigrate(function(){
        return idbGet(k).then(function(v){
          if(v!==undefined&&v!==null) return {value:v};
          /* 그래도 없으면 남은 localStorage 값을 끌어온다(마이그레이션 목록 밖의 키 대비) */
          var lv=null; try{ lv=localStorage.getItem(k); }catch(_){}
          if(lv==null) return null;
          return idbSet(k,lv).then(function(){
            if(DEVICE_LOCAL[k]){ try{ localStorage.removeItem(k); }catch(_){} }
            return {value:lv};
          }).catch(function(){ return {value:lv}; });
        });
      });
    },
    set:function(k,v){ return afterMigrate(function(){ return idbSet(k,v); }); },
    del:function(k){ return afterMigrate(function(){ return idbDel(k); }); },
    delIfValue:function(k,v){ return afterMigrate(function(){ return idbDelIfValue(k,v); }); },
    replaceIfValue:function(k,expected,replacement){ return afterMigrate(function(){ return idbReplaceIfValue(k,expected,replacement); }); },
    keys:function(prefix){ return afterMigrate(function(){ return idbKeys(prefix); }); }
  };

  /* 1.618 — 한 자료를 두 저장소에 같이 쓴다.
     sync.js 의 IDBK 목록에 든 키(일정·경기·권한·선수단·후보…)는 **동기화가 IndexedDB 를 읽어
     올린다.** 그런데 그 화면들의 저장 코드는 localStorage 에만 쓰고 있었다.
     storage.get 이 "IDB 가 비면 localStorage 값을 끌어와 심는" 폴백을 갖고 있어서 처음 한 번은
     맞아 떨어졌고, 그 뒤로는 IDB 에 그때의 사본이 굳어 화면을 아무리 고쳐도 팀에는 옛 자료만
     올라갔다(1.589 이후 일정·경기·권한, 선수단은 그 전부터).
     화면 쪽 저장은 동기(sync)라 여기서도 localStorage 를 먼저 쓰고 IDB 는 뒤따르게 둔다 —
     성공 여부는 localStorage 기준으로 돌려준다(기존 호출부의 판단 기준을 바꾸지 않는다). */
  /* 1.642 — 공유 문서는 키별로 IndexedDB 쓰기를 직렬화한다.
     localStorage 거울은 동기로 바뀌지만 IDB 정본은 느리게 따라간다. 이 사이에
     동기화가 예전 IDB를 읽어 거울을 다시 덮는 경쟁이 있었다. 키별 큐와
     sharedReady() 장벽을 남겨 동기화가 아직 저장 중인 판본을 읽지 않게 한다. */
  var sharedWrites={},sharedLatest={};
  function sharedSet(k,raw){
    /* 검증 읽기 직전에 같은 키의 더 새 쓰기가 들어오면 Safari는 앞 쓰기를
       StorageVerificationError로 끝낼 수 있다. 최신 거울 원문을 남겨 두면
       전환 장벽이 그 한 번의 경합 때문에 영구히 막히지 않고 다시 확인할 수 있다. */
    sharedLatest[k]=raw;
    var prev=sharedWrites[k]||Promise.resolve();
    var next=prev.catch(function(){}).then(function(){ return window.storage.set(k,raw); }).then(function(ok){
      /* 2.744 — 권한 어댑터의 false도 완료된 저장이 아니다. */
      if(ok===false)throw new Error('shared storage write rejected');
      return true;
    });
    sharedWrites[k]=next;
    next.then(function(){
      if(sharedWrites[k]===next){
        delete sharedWrites[k];
        if(sharedLatest[k]===raw)delete sharedLatest[k];
      }
    },function(){ /* 실패한 최신 쓰기는 sharedReady가 같은 원문으로 재검증한다. */ });
    return next;
  }
  function sharedWaitLatest(k){
    var p=sharedWrites[k];
    if(!p)return Promise.resolve(true);
    return Promise.resolve(p).catch(function(error){
      /* 기다리는 동안 더 새 쓰기가 이어졌다면 그 꼬리를 기다린다. */
      if(sharedWrites[k]!==p)return sharedWaitLatest(k);
      if(!Object.prototype.hasOwnProperty.call(sharedLatest,k))throw error;
      /* 앞 쓰기의 검증 실패가 큐에 영구히 남아 모든 워크스페이스 전환을
         막지 않게 한다. 최신 localStorage 거울을 IDB에 한 번 더 쓰고 다시 읽어
         확인하며, 재시도도 실패하면 그대로 reject하여 전환은 안전하게 중단한다. */
      return sharedSet(k,sharedLatest[k]);
    });
  }
  function sharedReady(k){
    var keys=k?[k]:Object.keys(sharedWrites);
    return Promise.all(keys.map(sharedWaitLatest)).then(function(){
      /* 첫 목록을 기다리는 사이 다른 키가 추가됐을 수 있다. 전환·동기화가
         반쯤 저장된 판본을 읽지 않도록 큐가 실제로 빌 때까지 한 번 더 본다. */
      var more=k?(sharedWrites[k]?[k]:[]):Object.keys(sharedWrites);
      /* 2.744 — 두 번째 대기 중에도 새 꼬리가 생긴다. 큐가 빌 때까지 확인한다. */
      return more.length?sharedReady(k):true;
    });
  }
  /* 2.744 — 과거 실패를 회복할 때 빈 큐만으로 성공을 추정하지 않는다.
     storage.get의 localStorage fallback 없이 IDB의 실제 원문을 확인한다. */
  function sharedVerified(k,raw){
    return sharedReady(k).then(function(){return afterMigrate(function(){return idbGet(k);});}).then(function(saved){
      if(saved!==raw)throw new Error('shared storage verification failed');
      return true;
    });
  }
  /* 큰 보조 사본 전용 API. 화면 본문과 달리 localStorage 거울을 새로 만들지 않는다.
     legacy 사본이 있으면 IDB와 같은지 확인해 제거하고, 서로 다르면 어느 쪽도 덮지 않는다. */
  function auxGet(k){
    if(!isAuxIDBKey(k))return Promise.reject(new Error('unsupported auxiliary key'));
    return sharedReady(k).then(function(){
      var lv=null;try{lv=localStorage.getItem(k);}catch(_){}
      /* window.storage.get의 localStorage 폴백을 쓰면 IDB 쓰기 실패 뒤에도
         legacy 값이 IDB에 있는 것으로 오판할 수 있다. 검증은 raw IDB에서만 한다. */
      return afterMigrate(function(){return idbGet(k);}).then(function(value){
        var iv=value!=null?String(value):null;
        if(lv==null)return emptyish(iv)?null:iv;
        if(iv===lv){try{localStorage.removeItem(k);}catch(_){}return emptyish(iv)?null:iv;}
        if(emptyish(iv)){
          return sharedSet(k,lv).then(function(){return idbGet(k);}).then(function(check){
            if(check!==lv)throw new Error('auxiliary storage verification failed');
            try{localStorage.removeItem(k);}catch(_){}
            return lv;
          });
        }
        var e=new Error('legacy and IndexedDB values differ');e.name='StorageConflictError';
        diagnostic('aux-read-conflict:'+k,e);throw e;
      });
    });
  }
  function auxSet(k,v){
    if(!isAuxIDBKey(k))return Promise.reject(new Error('unsupported auxiliary key'));
    var raw=v==null?'':String(v);
    return sharedSet(k,raw).then(function(){return idbGet(k);}).then(function(check){
      if(check!==raw)throw new Error('auxiliary storage verification failed');
      /* 새 기준본이 IDB에 정확히 착지한 뒤에야 구버전 사본을 없앤다. */
      try{localStorage.removeItem(k);}catch(_){}
      return true;
    });
  }
  window.psSaveShared=function(k,raw){
    var ok=false;
    try{ localStorage.setItem(k,raw); ok=true; }catch(e){ ok=false; }
    try{
      if(window.storage&&window.storage.set){
        var p=sharedSet(k,raw);
        /* 반드시 .catch 를 달아야 한다. IndexedDB 쓰기는 비동기라 try/catch 로는 안 잡히고,
           빠르게 두 번 저장하면 뒤 저장이 앞 저장의 확인 읽기를 앞질러 '검증 실패'가 난다
           (원래 있던 현상 — 작전판 cs_board_live_v1 에서 계속 나고 있었다).
           값 자체는 나중 저장이 남으므로 잃는 것은 없다. 경고는 storage.js 가 이미 남긴다. */
        if(p&&p.catch) p.catch(function(){});
      }
    }catch(_){}
    return ok;
  };
  /* 새 저장 경로는 검증이 끝난 때를 정확히 알 수 있다. 기존 호출부는
     동기 boolean 계약을 유지하고, 일정처럼 경쟁을 막아야 하는 화면만 이 Promise를 쓴다. */
  window.psSaveSharedAsync=function(k,raw){
    try{ localStorage.setItem(k,raw); }
    catch(e){ return Promise.reject(e); }
    return sharedSet(k,raw);
  };
  /* storage 이벤트 미러는 iframe이 이미 쓴 localStorage를 다시 쓰지 않는다.
     다시 쓰면 오래된 이벤트가 새 워크스페이스의 거울까지 되돌릴 수 있다. */
  window.psMirrorSharedAsync=function(k,raw){ return sharedSet(k,raw); };

  /* v369 — 팀 전환 전체 백업은 localStorage의 작은 한도를 가장 빨리 소진한다.
     기존 백업을 IDB로 옮겨 다시 읽어 확인한 뒤에만 로컬 사본을 제거한다. */
  afterMigrate(function(){
    var legacy=[];
    try{for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);if(k&&k.indexOf('ps_ws_stash_')===0)legacy.push(k);
    }}catch(_){}
    return Promise.all(legacy.map(function(k){
      var v=null;try{v=localStorage.getItem(k);}catch(_){}
      if(v==null)return null;
      function stamp(raw){
        try{var o=JSON.parse(raw);return o&&o.data&&isFinite(+o.at)?+o.at:null;}catch(_){return null;}
      }
      function dropLegacy(){
        /* 다른 탭이 그 사이 값을 바꿨다면 새 값을 지우지 않는다. */
        var now=null;try{now=localStorage.getItem(k);}catch(_){return false;}
        if(now!==v)return false;
        localStorage.removeItem(k);
        if(localStorage.getItem(k)!=null)throw new Error('legacy stash removal verification failed');
        return true;
      }
      return idbGet(k).then(function(iv){
        if(iv==null){
          return idbSet(k,v).then(function(){return idbGet(k);}).then(function(saved){
            if(saved!==v)throw new Error('stash migration verification failed');
            dropLegacy();
          });
        }
        if(iv===v){
          return idbGet(k).then(function(saved){if(saved===v)dropLegacy();});
        }
        var la=stamp(v),ia=stamp(iv);
        /* 형식이 확인된 최신 legacy만 IDB를 교체한다. 확인할 수 없는 충돌은
           어느 쪽도 지우지 않아 사용자가 원문을 잃지 않게 한다. */
        if(la!=null&&ia!=null&&la>ia){
          return idbSet(k,v).then(function(){return idbGet(k);}).then(function(saved){
            if(saved!==v)throw new Error('stash migration verification failed');
            dropLegacy();
          });
        }
        if(ia!=null&&la!=null&&ia>=la){
          /* 동률은 이미 큰 저장소에 있는 판을 유지한다. 재확인 중 더 오래된 값으로
             바뀌었다면 legacy를 남기고 다음 부팅에 다시 판단한다. */
          return idbGet(k).then(function(saved){var sa=stamp(saved);if(sa!=null&&sa>=la)dropLegacy();});
        }
        var conflict=new Error('legacy and IndexedDB stash versions differ');conflict.name='StorageConflictError';
        diagnostic('stash-migration-conflict:'+k,conflict);
        return false;
      }).catch(function(e){diagnostic('stash-migration',e);});
    }));
  }).catch(function(e){diagnostic('stash-migration-all',e);});

  window.PSStorage={
    estimate:function(){ try{ return navigator.storage.estimate(); }catch(_){ return Promise.resolve(null); } },
    sharedReady:sharedReady,
    sharedVerified:sharedVerified,
    auxGet:auxGet,
    auxSet:auxSet,
    auxReady:sharedReady,
    localBytes:function(){
      var n=0;try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i),v=localStorage.getItem(k)||'';n+=(String(k).length+v.length)*2;}}catch(_){}
      return n;
    },
    largestLocal:function(limit){
      var rows=[];limit=Math.max(1,+limit||3);
      try{
        for(var i=0;i<localStorage.length;i++){
          var k=localStorage.key(i),v=localStorage.getItem(k)||'';
          rows.push({key:k,bytes:(String(k).length+v.length)*2});
        }
      }catch(_){}
      return rows.sort(function(a,b){return b.bytes-a.bytes;}).slice(0,limit);
    },
    /* 실제 콘텐츠는 삭제하지 않는다. IndexedDB에 동일한 문자열이 저장됐다고
       다시 읽어 확인한 기기 전용 중복 사본만 localStorage에서 제거한다. */
    optimize:function(){
      var self=this,before=self.localBytes(),moved=[],kept=[],imgMoved=0;
      /* 1.535 — 정리 버튼이 **사진 이전까지** 수행한다.
         부팅 때도 migrate()가 돌지만, 그때 실패했거나(용량·IDB 지연) 그 뒤에 새 사진이
         본문에 박힌 경우 사용자는 손쓸 방법이 없었다. 가장 필요한 순간에 다시 시도한다. */
      var thumbStat={n:0,saved:0};
      return (function(){
        try{ return window.PSImg&&PSImg.migrate?PSImg.migrate().then(function(r){ imgMoved=(r&&r.moved)||0; }).catch(function(){}):Promise.resolve(); }
        catch(_){ return Promise.resolve(); }
      })().then(function(){
        /* 2.519 — 사진 이전 다음에 썸네일 다이어트. 실패해도 원본은 그대로 둔다 */
        return slimThumbs().then(function(t){ thumbStat=t||thumbStat; }).catch(function(){});
      }).then(function(){
      return afterMigrate(function(){
        var cleanupKeys=Object.keys(DEVICE_LOCAL);
        localKeys(AUX_IDB_PREFIX).forEach(function(k){if(cleanupKeys.indexOf(k)<0)cleanupKeys.push(k);});
        return Promise.all(cleanupKeys.map(function(k){
          var lv=null;try{lv=localStorage.getItem(k);}catch(_){}
          if(lv==null)return null;
          if(isAuxIDBKey(k)){
            return auxGet(k).then(function(){
              try{if(localStorage.getItem(k)==null)moved.push(k);else kept.push(k);}catch(_){kept.push(k);}
            }).catch(function(){kept.push(k);});
          }
          return idbGet(k).then(function(iv){
            if(iv===lv){
              try{localStorage.removeItem(k);moved.push(k);}catch(_){}
              return null;
            }
            if(emptyish(iv)&&!emptyish(lv)){
              return idbSet(k,lv).then(function(){return idbGet(k);}).then(function(check){
                if(check===lv){try{localStorage.removeItem(k);moved.push(k);}catch(_){}}
                else kept.push(k);
              });
            }
            kept.push(k); /* 양쪽 내용이 다르면 최신 판단을 하지 않고 둘 다 보존 */
            return null;
          }).catch(function(){kept.push(k);});
        }));
      }).then(function(){
        return requestPersist().catch(function(){return false;});
      }).then(function(){
        var after=self.localBytes();
        try{window.dispatchEvent(new CustomEvent('ps-storage-optimized',{detail:{before:before,after:after,freed:Math.max(0,before-after),moved:moved,kept:kept,imgMoved:imgMoved}}));}catch(_){}
        return {before:before,after:after,freed:Math.max(0,before-after),moved:moved,kept:kept,imgMoved:imgMoved,
                thumbSlimmed:thumbStat.n,thumbSaved:thumbStat.saved,largest:self.largestLocal(3)};
      });
      });
    },
    /* ── 저장 위험 안내 (IDP·노트·팀 이미지노트 공용) ────────────────────────────
       비로그인 + 미설치면 브라우저가 저장소를 비울 수 있다(iOS 사파리: 홈 화면 미추가 시 7일 미사용).
       persist() 는 위에서 이미 요청하지만 '설치 안 된 사이트'엔 브라우저가 거부하므로 코드로는 못 막는다.
       살 길은 ① 홈 화면에 추가 ② 로그인 뿐 → 위험할 때 그 두 길을 알려주는 게 최선.
       iOS 는 beforeinstallprompt 가 없어 헤더 '설치' 버튼이 영영 안 뜬다 → 수동 안내가 필수. */
    isInstalled:function(){ try{ return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true; }catch(_){ return false; } },
    isIOS:function(){ try{ return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.userAgent)); }catch(_){ return false; } },
    loggedIn:function(){ try{ var s=JSON.parse(localStorage.getItem('ps_sync_session')||'null'); return !!(s&&s.uid); }catch(_){ return false; } },
    /* hasStuff: 잃을 게 있을 때만 띄운다 — 빈 화면에 겁줄 이유가 없다 */
    atRisk:function(hasStuff){ return !!hasStuff && !this.loggedIn() && !this.isInstalled(); },
    /* 배너 한 줄 — 파일마다 컨테이너가 달라서 조각만 준다. mount() 가 버튼까지 연결한다.
       스타일·모달은 아래 _css()/showGuide() 가 스스로 만든다: 세 파일에 같은 CSS 를 복사하면
       나중에 반드시 어긋난다(오늘 팀 헤더가 그랬다). 색은 var() 폴백 사슬로 각 파일 변수를 탄다 —
       idp 는 --surface/--text/--accent, 노트·팀은 --bar/--txt/--blue. 다크모드는 그 변수들이 이미 갈리므로 따라온다. */
    riskHTML:function(){
      return '<div class="ps-rkb"><span class="ps-rkt"><b>현재 기기에 저장 중</b><span class="ps-rkdesc"> · 설치 또는 로그인하면 다른 기기에서도 안전하게 이어집니다.</span></span>'
        +'<button class="btn" data-rkfix type="button">저장 설정</button></div>';
    },
    /* 배너를 그려 넣고 버튼까지 연결 — 호출부는 이 한 줄이면 된다 */
    mountRisk:function(el,hasStuff){
      if(!el)return false;
      if(!this.atRisk(hasStuff)){ el.innerHTML=''; return false; }
      this._css();   /* 배너도 스타일이 필요하다 — 모달에서만 부르면 띠가 통째로 무너진다 */
      el.innerHTML=this.riskHTML();
      var self=this, b=el.querySelector('[data-rkfix]');
      if(b)b.onclick=function(){ self.showGuide(); };
      return true;
    },
    showGuide:function(){
      this._css();
      var m=document.getElementById('psRkMask');
      if(!m){ m=document.createElement('div'); m.id='psRkMask'; document.body.appendChild(m);
        m.addEventListener('click',function(e){ if(e.target===m)m.classList.remove('on'); }); }
      var steps=this.isIOS()
        ? '<div class="ps-rks"><b>1</b><span>화면 아래 <b>공유 버튼</b> <span style="font-size:15px">&#x2934;</span> 를 누르세요</span></div>'
          +'<div class="ps-rks"><b>2</b><span><b>"홈 화면에 추가"</b>를 고르세요</span></div>'
          +'<div class="ps-rks"><b>3</b><span>오른쪽 위 <b>추가</b></span></div>'
        : '<div class="ps-rks"><b>1</b><span>주소창의 <b>설치</b> 아이콘을 누르세요</span></div>'
          +'<div class="ps-rks"><b>2</b><span>없으면 브라우저 메뉴 → <b>앱 설치</b></span></div>';
      m.innerHTML='<div id="psRkBox"><h2>저장을 안전하게</h2>'
        +'<div class="ps-rkp" style="margin-bottom:12px">지금은 이 기기의 브라우저에만 저장돼요. 한동안 안 열면 브라우저가 지울 수 있어요.</div>'
        +'<div class="ps-rkh">홈 화면에 추가하면 안 사라져요</div>'+steps
        +'<div class="ps-rkh" style="margin-top:14px">또는 로그인</div>'
        +'<div class="ps-rkp">클라우드에 저장돼서 기기를 바꿔도 그대로 남아요. <b>지금까지 쓴 내용은 로그인해도 그대로 넘어갑니다.</b></div>'
        +'<div class="ps-rke"><button type="button" id="psRkOk">알겠어요</button></div></div>';
      m.classList.add('on');
      m.querySelector('#psRkOk').onclick=function(){ m.classList.remove('on'); };
    },
    _css:function(){
      if(document.getElementById('psRkCss'))return;
      var S=document.createElement('style'); S.id='psRkCss';
      var TX='var(--text,var(--txt,#16181C))', DIM='var(--text-3,var(--dim,#5C6068))',
          LN='var(--line,#E3E5E9)', SF='var(--surface,var(--bar,#fff))',
          SF2='var(--surface-2,var(--bar2,#F1F2F4))',
          AC='var(--accent,var(--blue,#3a6df0))', ACS='var(--accent-soft,var(--blue-soft,#edf2fe))';
      S.textContent=
        '.ps-rkb{display:flex;align-items:center;gap:10px;background:'+SF2+';border:1px solid '+LN+';'
        +'border-radius:10px;padding:8px 10px;margin-bottom:11px}'
        +'.ps-rkt{font-size:12px;font-weight:600;color:'+DIM+';line-height:1.5;min-width:0}'
        +'.ps-rkt b{color:'+TX+'}'
        /* 각 파일의 .btn 을 그대로 쓰면 안 된다: 팀·노트의 .btn 바탕(--bar2)이 배너 바탕(--surface-2)과 같은 색이라
           버튼이 통째로 사라져 그냥 글씨로 보인다 → 여기서 직접 칠한다(.ps-rkb .btn 이 .btn 보다 우선) */
        +'.ps-rkb .btn{margin-left:auto;flex:0 0 auto;white-space:nowrap;background:'+SF+';'
        +'border:1px solid '+LN+';color:'+TX+';border-radius:9px;padding:7px 12px;height:auto;'
        +'font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}'
        +'.ps-rkb .btn:hover{border-color:'+AC+';color:'+AC+'}'
        +'@media (max-width:520px){.ps-rkb{gap:7px;padding:7px 9px}.ps-rkdesc{display:none}.ps-rkb .btn{margin-left:auto;width:auto;padding:6px 9px}}'
        +'.ps-rkp{font-size:12px;font-weight:600;color:'+DIM+';line-height:1.6}'
        +'.ps-rkp b{color:'+TX+'}'
        +'.ps-rkh{font-size:11px;font-weight:800;letter-spacing:.03em;color:'+DIM+';margin-bottom:7px}'
        +'.ps-rks{display:flex;align-items:flex-start;gap:9px;margin-bottom:7px;font-size:13px;font-weight:600;color:'+TX+';line-height:1.5}'
        +'.ps-rks>b{flex:0 0 auto;width:19px;height:19px;border-radius:50%;background:'+ACS+';color:'+AC+';'
        +'font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px}'
        +'#psRkMask{position:fixed;inset:0;background:rgba(16,18,22,.42);z-index:9000;display:none;'
        +'align-items:center;justify-content:center;padding:18px}'
        +'#psRkMask.on{display:flex}'
        +'#psRkBox{background:'+SF+';border:1px solid '+LN+';border-radius:14px;padding:18px;'
        +'width:100%;max-width:360px;box-shadow:0 12px 40px rgba(16,24,40,.18);max-height:86vh;overflow:auto}'
        +'#psRkBox h2{margin:0 0 3px;font-size:16px;font-weight:800;color:'+TX+'}'
        +'.ps-rke{display:flex;justify-content:flex-end;margin-top:16px}'
        +'.ps-rke>button{border:0;border-radius:9px;background:'+AC+';color:#fff;font-family:inherit;'
        +'font-size:13px;font-weight:800;padding:9px 15px;cursor:pointer}';
      document.head.appendChild(S);
    }
  };
})();

/* ── 초경량 에러 리포터 — 외부 SDK 없음(오프라인 PWA 원칙) ──
   런타임 에러·미처리 rejection을 로컬 링버퍼(최근 30개)에 쌓고,
   온라인 + Supabase 설정이 있으면 ps_err 테이블로 배치 전송(테이블 없으면 조용히 무시).
   개인정보는 보내지 않는다 — 메시지·파일명·줄번호·페이지명·UA뿐. */
(function(){
  var KEY='cs_errlog_v1', MAX=30, flushing=false;
  function cfg(){
    try{ if(window.PS_SYNC&&window.PS_SYNC.url&&window.PS_SYNC.anonKey) return window.PS_SYNC; }catch(_){}
    try{ var p=window.parent; if(p&&p!==window&&p.PS_SYNC&&p.PS_SYNC.url&&p.PS_SYNC.anonKey) return p.PS_SYNC; }catch(_){}
    try{ var o=JSON.parse(localStorage.getItem('ps_sync_cfg')||'null'); if(o&&o.url&&o.anonKey) return o; }catch(_){}
    return null;
  }
  function log(kind,msg,src,line){
    try{
      msg=String(msg||'').slice(0,300);
      if(!msg||msg==='Script error.')return;              /* 크로스오리진 무정보 에러 제외 */
      var arr=[]; try{ arr=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(_){}
      var last=arr[arr.length-1];
      if(last&&last.m===msg&&Date.now()-last.t<5000)return; /* 같은 에러 연타 묶기 */
      arr.push({t:Date.now(),k:kind,m:msg,s:String(src||'').split('/').pop().slice(0,60),l:+line||0,
                p:location.pathname.split('/').pop()||'/'});
      if(arr.length>MAX)arr=arr.slice(-MAX);
      localStorage.setItem(KEY,JSON.stringify(arr));
      setTimeout(flush,1500);
    }catch(_){}
  }
  function flush(){
    if(flushing)return;
    var c=cfg(); if(!c||!navigator.onLine)return;
    var arr=[]; try{ arr=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(_){}
    if(!arr.length)return;
    flushing=true;
    fetch(String(c.url).replace(/\/+$/,'')+'/rest/v1/ps_err',{method:'POST',
      headers:{'Content-Type':'application/json',apikey:c.anonKey,Authorization:'Bearer '+c.anonKey,Prefer:'return=minimal'},
      body:JSON.stringify(arr.map(function(e){return {t:new Date(e.t).toISOString(),kind:e.k,msg:e.m,src:e.s,line:e.l,page:e.p,ua:String(navigator.userAgent||'').slice(0,120)};}))
    }).then(function(r){ if(r.ok){ try{localStorage.setItem(KEY,'[]');}catch(_){} } })
      .catch(function(error){
        /* 2.745 — diagnostic은 저장소 IIFE 안에 있다. 공개 API로 보고하고,
           진단 자체가 실패해도 전송 중 표시를 풀어 다음 재시도를 막지 않는다. */
        try{ if(typeof window.PSStorageDiagnostic==='function')window.PSStorageDiagnostic('event-flush',error); }catch(_){}
      }).then(function(){ flushing=false; });
  }
  window.addEventListener('error',function(e){ if(e&&e.message)log('err',e.message,e.filename,e.lineno); });
  window.addEventListener('unhandledrejection',function(e){ var r=e&&e.reason; log('rej',(r&&(r.message||r))||'rejection','',0); });
  setTimeout(flush,4000);
})();

/* PROCESS STUDIO — 사진 보관소(PSImg)
   왜: 선수 사진은 scout_tool_v1 에, 경기 로고는 process_coach_v1 에 base64 로 들어갔다.
       localStorage 는 iOS 에서 오리진당 약 5MB 라 선수 30명이면 한계에 닿고,
       동기화도 키 하나가 150만 자를 넘으면 통째로 건너뛴다(그 기기에만 남는다).
   그래서 사진은 IndexedDB 에 따로 두고 본문에는 `psimg:<id>` 참조만 남긴다.

   옮길 때는 반드시 **다시 읽어 확인한 뒤에만** 원본을 지운다.
   중간에 실패하면 원본이 그대로 남는다 — 사진을 잃지 않는 것이 우선이다. */
(function(){
  "use strict";
  var PRE='psimg_', REF='psimg:', mem={}, loaded=null;
  function isRef(v){ return typeof v==='string' && v.indexOf(REF)===0; }
  function isData(v){ return typeof v==='string' && v.indexOf('data:image')===0; }
  function newId(){ return PRE+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

  /* 화면은 동기적으로 src 를 넣는다 — 미리 메모리에 올려 둔다. */
  function ready(){
    if(loaded) return loaded;
    loaded=(function(){
      try{
        return window.storage.keys(PRE).then(function(keys){
          return Promise.all((keys||[]).map(function(k){
            return window.storage.get(k).then(function(r){ if(r) mem[k]=r.value; }).catch(function(){});
          }));
        }).catch(function(){});
      }catch(_){ return Promise.resolve(); }
    })();
    return loaded;
  }
  function src(v){
    if(!v) return '';
    if(isRef(v)) return mem[v.slice(REF.length)]||'';
    return v;                       /* 아직 안 옮긴 원본 data URL 도 그대로 보여준다 */
  }
  function put(dataUrl){
    if(!isData(dataUrl)) return Promise.resolve(dataUrl);
    var id=newId();
    return window.storage.set(id,dataUrl)
      .then(function(){ return window.storage.get(id); })
      .then(function(r){
        if(!r||r.value!==dataUrl) throw new Error('image verify failed');
        mem[id]=dataUrl; return REF+id;
      });
  }
  function verify(v,expected){
    if(!isRef(v)||!window.storage||typeof expected!=='string')return Promise.resolve(false);
    return window.storage.get(v.slice(REF.length)).then(function(r){return !!r&&r.value===expected;});
  }
  function del(v){
    if(!isRef(v)) return Promise.resolve();
    var id=v.slice(REF.length); delete mem[id];
    try{ return window.storage.del(id); }catch(_){ return Promise.resolve(); }
  }

  /* 이미 저장된 사진을 옮긴다. 경로를 정확히 짚는다 — 통째로 훑으면
     이미 IDB 에 있는 작전판 스냅샷까지 건드린다. */
  function readJSON(k){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(_){ return null; } }
  function writeJSON(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(_){ return false; } }

  /* 2.463 — 남의 IDP 문서 속 프로필 사진을 큰 저장소로 옮긴다.
     코치 기기에는 팀원 전원의 IDP 문서가 내려와 앉는데, 문서마다 사진(60~100KB)이
     본문에 박혀 있어 선수 20명이면 그것만으로 작은 저장소(≈5MB)의 절반 가까이 찬다.
     남의 문서는 pull 전용이라(3426 '내 것만 push') 여기서 참조로 바꿔도 서버·다른
     기기에는 아무 영향이 없고, 표시 경로는 이미 PSImg.src() 로 참조를 해석한다.
     내 문서(cs_idp_v1_<내uid>·_local)는 절대 건드리지 않는다 — push 원문이라 참조로
     바꾸면 다른 기기에서 사진이 사라진다. 로그인 정보가 없으면 누가 '남'인지 확정할
     수 없으므로 아무것도 하지 않는다. */
  function isForeignIdpKey(k){
    if(!k||k.indexOf('cs_idp_v1_')!==0) return false;
    if(k==='cs_idp_v1_local') return false;
    var uid=''; try{ var ss=JSON.parse(localStorage.getItem('ps_sync_session')||'null'); uid=(ss&&ss.uid)||''; }catch(_){}
    return !!uid && k!=='cs_idp_v1_'+uid;
  }
  function stripIdp(k){
    if(!isForeignIdpKey(k)) return Promise.resolve(false);
    var before=null,uid='',wid='',seal='';
    try{
      before=localStorage.getItem(k);uid=String((JSON.parse(localStorage.getItem('ps_sync_session')||'null')||{}).uid||'');
      wid=String(localStorage.getItem('ps_active_ws')||'');seal=String(localStorage.getItem('ps_cache_owner_v1')||'');
      var owner=JSON.parse(seal||'null');if(!owner||owner.uid!==uid||owner.wid!==wid)return Promise.resolve(false);
    }catch(_){return Promise.resolve(false);}
    var doc=null;try{doc=JSON.parse(before);}catch(_){return Promise.resolve(false);}
    if(!doc||doc.v!==1||typeof doc!=='object'||Array.isArray(doc))return Promise.resolve(false);
    var pf=doc.profile;if(!pf||!isData(pf.photo))return Promise.resolve(false);
    function current(){
      try{return isForeignIdpKey(k)&&uid===String((JSON.parse(localStorage.getItem('ps_sync_session')||'null')||{}).uid||'')&&
        wid===String(localStorage.getItem('ps_active_ws')||'')&&seal===String(localStorage.getItem('ps_cache_owner_v1')||'')&&
        localStorage.getItem(k)===before;}catch(_){return false;}
    }
    return put(pf.photo).then(function(ref){
      // A photograph can stay equal while the diary, account or team changes.
      // Only the exact document and owner that started migration may be replaced.
      if(!current())return false;
      pf.photo=ref;return writeJSON(k,doc);
    }).catch(function(){ return false; });
  }

  function migrate(){
    return ready().then(function(){
      var jobs=[];
      var sc=readJSON('scout_tool_v1');
      if(sc&&Array.isArray(sc.players)){
        sc.players.forEach(function(pl){
          var pf=pl&&pl.profile;
          if(pf&&isData(pf.photo)) jobs.push({o:pf,k:'photo',v:pf.photo,root:'scout_tool_v1',data:sc});
        });
      }
      var pc=readJSON('process_coach_v1');
      if(pc&&pc.weeks&&typeof pc.weeks==='object'){
        Object.keys(pc.weeks).forEach(function(wk){
          var arr=pc.weeks[wk]; if(!Array.isArray(arr)) return;
          arr.forEach(function(day){
            if(day&&day.match&&isData(day.match.logo))
              jobs.push({o:day.match,k:'logo',v:day.match.logo,root:'process_coach_v1',data:pc});
          });
        });
      }
      var tm=readJSON('cs_team_v1');
      if(tm&&isData(tm.logo)) jobs.push({o:tm,k:'logo',v:tm.logo,root:'cs_team_v1',data:tm});
      /* 2.463 — 이미 쌓여 있는 남의 IDP 문서 사진(위 stripIdp 참조). 재읽기 검증이 있는
         stripIdp 를 키마다 직렬로 돌린다 — jobs 파이프라인의 '읽고 한참 뒤 통째로 다시
         쓰기'는 그 사이 풀이 덮은 판을 되돌릴 수 있어 여기엔 쓰지 않는다. */
      var idpKeys=[];
      try{ for(var ii=0;ii<localStorage.length;ii++){ var ik=localStorage.key(ii); if(isForeignIdpKey(ik))idpKeys.push(ik); } }catch(_){}
      var idpMoved=0;
      var idpChain=idpKeys.reduce(function(ch,k2){
        return ch.then(function(){ return stripIdp(k2).then(function(ok){ if(ok)idpMoved++; }); });
      }, Promise.resolve());
      if(!jobs.length) return idpChain.then(function(){ return {moved:idpMoved,failed:0}; });

      var moved=0, failed=0, roots={};
      return jobs.reduce(function(chain,j){
        return chain.then(function(){
          return put(j.v).then(function(ref){
            j.o[j.k]=ref; moved++; roots[j.root]=j.data;   /* 확인된 뒤에만 참조로 바꾼다 */
          }).catch(function(){ failed++; });
        });
      }, Promise.resolve()).then(function(){
        Object.keys(roots).forEach(function(k){
          if(!writeJSON(k,roots[k])) failed++;
        });
        return idpChain.then(function(){ moved+=idpMoved;
          try{ if(moved) window.dispatchEvent(new CustomEvent('ps-img-migrated',{detail:{moved:moved,failed:failed}})); }catch(_){}
          return {moved:moved,failed:failed};
        });
      });
    });
  }

  window.PSImg={ ready:ready, src:src, put:put, verify:verify, del:del, migrate:migrate, isRef:isRef, isData:isData, stripIdp:stripIdp };
  /* 화면이 사진을 그리기 전에 메모리에 올려 둔다. 이전은 조용히 넘어간다(실패해도 원본이 남아 있다). */
  try{ ready().then(function(){ return migrate(); }).catch(function(){}); }catch(_){}
})();

/* 2.463 — 안전 정리 자동화. optimize()는 IndexedDB에 같은 내용이 저장됐음을 다시 읽어
   확인한 중복 사본만 지운다(1.535) — 언제 돌아도 기록을 잃지 않는다. 그런데 설정의
   버튼을 눌러야만 돌았고, 일정 동기화 기준본(ps_sync_base_* — 일정 원문만 한 크기)과
   보관함·라이브 보드 사본(DEVICE_LOCAL)이 localStorage에 눌러앉아 "공간이 자꾸 차는"
   첫 원인이 됐다. 하루 한 번, 부팅이 가라앉은 뒤 조용히 돌린다 — 여유만 남긴다. */
(function(){
  var K='ps_opt_auto_at', DAY=86400000;
  function due(){ var t=0; try{ t=+localStorage.getItem(K)||0; }catch(_){ } return Date.now()-t>DAY; }
  try{
    if(!due())return;
    setTimeout(function(){
      if(!due())return; /* 다른 화면(iframe)이 그 사이 먼저 돌았으면 그만둔다 */
      try{ localStorage.setItem(K,String(Date.now())); }catch(_){}
      try{ window.PSStorage.optimize().catch(function(){}); }catch(_){}
    },12000);
  }catch(_){}
})();

/* PROCESS STUDIO — 저장 상태(PSSaveState)
   왜: 저장이 실패해도 화면은 "방금 자동 저장됨"이라고 말했다. 코치는 저장된 줄 알고
       앱을 닫았고, 그 편집은 사라졌다. 조용히 잃는 것보다 나쁜 건 잃은 줄 모르는 것이다.

   저장 중 / 저장됨 / 저장 안 됨 세 상태를 한 곳에서 정의한다. 화면마다 다른 문구를 쓰면
   같은 상황이 다르게 읽히므로, 문구도 여기서만 정한다.
   실패는 다음 저장이 성공할 때까지 남는다 — 스스로 사라지면 못 보고 지나친다. */
(function(){
  "use strict";
  var LABEL={saving:'저장 중…',saved:'저장됨',failed:'⚠ 저장 안 됨',idle:''};
  var state={},bound=[];

  function set(scope,next,error){
    scope=String(scope||'app');
    state[scope]=next;
    /* 저장이 한 번 성공했다면 저장소는 다시 쓸 수 있다는 뜻이다.
       용량 초과로 잠갔던 표시를 함께 풀지 않으면 경고가 영영 남는다. */
    if(next==='saved'&&state.storage==='failed'){
      state.storage='saved';
      var b=document.getElementById('psStorageFull');
      if(b)try{ b.remove(); }catch(_){}
      try{ window.dispatchEvent(new CustomEvent('ps-storage-recovered')); }catch(_){}
    }
    paint();
    try{ window.dispatchEvent(new CustomEvent('ps-save-state',{detail:{scope:scope,state:next,error:error||null}})); }catch(_){}
    if(next==='failed'){
      try{ window.PSStorageDiagnostic('save-failed:'+scope,error); }catch(_){}
      pill(true);
    }else if(next==='saved'&&!anyFailed()){
      pill(false);
    }
    return next!=='failed';
  }
  function anyFailed(){ return Object.keys(state).some(function(k){ return state[k]==='failed'; }); }

  function paint(){
    bound.forEach(function(b){
      if(!b.el||!b.el.isConnected){ b.el=null; return; }
      var s=state[b.scope]||'idle';
      b.el.textContent=(s==='idle'&&b.idle)?b.idle:LABEL[s];
      b.el.style.color=s==='failed'?'#C24A46':'';
      b.el.style.fontWeight=s==='failed'?'700':'';
    });
    bound=bound.filter(function(b){ return b.el; });
  }

  /* 자체 저장 표시가 없는 화면을 위한 안전망.
     용량 초과 배너가 이미 떠 있으면 같은 말을 두 번 하지 않는다. */
  function pill(show){
    if(!document.body) return;
    var el=document.getElementById('psSaveFailed');
    if(!show){ if(el)try{el.remove();}catch(_){} return; }
    if(document.getElementById('psStorageFull')) return;
    if(el) return;
    el=document.createElement('div'); el.id='psSaveFailed';
    el.style.cssText='position:fixed;left:16px;bottom:16px;z-index:99998;max-width:min(340px,88vw);'
      +'background:#C24A46;color:#fff;font:700 12px/1.45 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;'
      +'padding:10px 12px;border-radius:11px;box-shadow:0 8px 24px rgba(0,0,0,.28);display:flex;align-items:center;gap:9px;';
    var t=document.createElement('span'); t.style.cssText='flex:1';
    t.innerHTML='⚠ <b>저장되지 않았습니다.</b><br>앱을 닫으면 방금 편집이 사라집니다.';
    var x=document.createElement('button'); x.type='button'; x.textContent='닫기';
    x.style.cssText='flex:0 0 auto;border:0;background:rgba(255,255,255,.22);color:#fff;font:inherit;padding:5px 9px;border-radius:7px;cursor:pointer';
    x.onclick=function(){ try{el.remove();}catch(_){} };
    el.appendChild(t); el.appendChild(x); document.body.appendChild(el);
  }

  window.PSSaveState={
    LABEL:LABEL,
    begin:function(scope){ return set(scope,'saving'); },
    ok:function(scope){ return set(scope,'saved'); },
    fail:function(scope,error){ return set(scope,'failed',error); },
    /* 저장 결과 불리언을 그대로 넘기면 상태가 정해진다. 호출부가 짧아진다. */
    done:function(scope,okFlag,error){ return okFlag?this.ok(scope):this.fail(scope,error); },
    get:function(scope){ return state[String(scope||'app')]||'idle'; },
    text:function(scope){ return LABEL[this.get(scope)]; },
    failed:anyFailed,
    /* 화면이 이미 가진 라벨을 이 상태에 묶는다. idle일 때 보여줄 기본 문구를 함께 준다. */
    bind:function(el,scope,idleText){
      if(!el) return;
      bound.push({el:el,scope:String(scope||'app'),idle:idleText||''});
      paint();
    },
    /* 2.744 — 동기 쓰기 접수와 비동기 저장 완료를 구분한다. 실패는 같은 키의
       새 쓰기가 검증될 때만 풀고, 늦게 끝난 다른 팀/이전 쓰기는 표시를 바꾸지 않는다. */
    createTracker:function(scope,ownerOf){
      var owner=null,entries=Object.create(null);
      function current(){
        var next=String(ownerOf?ownerOf():'');
        if(next!==owner){owner=next;entries=Object.create(null);set(scope,'idle');}
        return owner;
      }
      function paintTracked(){
        current();
        var rows=Object.keys(entries).map(function(k){return entries[k];});
        var bad=rows.filter(function(r){return r.error;})[0];
        set(scope,bad?'failed':(rows.some(function(r){return r.pending;})?'saving':(rows.length?'saved':'idle')),bad&&bad.error);
      }
      function track(key,work,retry){
        current(); key=String(key);
        var old=entries[key],row={owner:owner,pending:true,error:old&&old.error||null,promise:null,retry:retry};
        entries[key]=row;
        row.promise=Promise.resolve(work).then(function(ok){
          if(ok===false)throw new Error('storage write rejected');
          row.pending=false;row.error=null;
          if(current()===row.owner&&entries[key]===row)paintTracked();
          return true;
        }).catch(function(error){
          row.pending=false;row.error=error||new Error('storage write failed');
          if(current()===row.owner&&entries[key]===row)paintTracked();
          throw row.error;
        });
        /* 자동 저장 호출자는 Promise를 기다리지 않아도 실패를 잃지 않는다. */
        row.promise.catch(function(){});
        paintTracked();
        return row.promise;
      }
      function ready(retryFailed){
        var expected=current(),snapshot=Object.create(null),keys=Object.keys(entries);
        /* 전환/명시적 저장은 같은 원문을 한 번 재검증할 수 있다. 다른 키 성공으로
           해제하지 않고, 호출자가 소유자·거울 원문까지 확인한 경우에만 회복한다. */
        if(retryFailed)keys.forEach(function(k){
          var row=entries[k];
          if(row.error&&!row.pending&&row.retry){
            var work;try{work=row.retry();}catch(error){work=Promise.reject(error);}
            track(k,work,row.retry);
          }
        });
        keys.forEach(function(k){snapshot[k]=entries[k];});
        return Promise.all(keys.map(function(k){
          var row=snapshot[k];
          return row.promise.catch(function(error){
            if(current()!==expected)throw new Error('storage owner changed');
            if(entries[k]===row)throw error; /* 이미 대체된 쓰기의 실패는 최신 꼬리가 결정한다. */
          });
        })).then(function(){
          if(current()!==expected)throw new Error('storage owner changed');
          if(Object.keys(entries).some(function(k){return snapshot[k]!==entries[k]||entries[k].pending;}))return ready();
          return true;
        });
      }
      return {track:track,ready:ready,owner:current,
        hasFailed:function(key){current();return !!(entries[key]&&entries[key].error);},
        hasPending:function(){current();return Object.keys(entries).some(function(k){return entries[k].pending||entries[k].error;});}};
    }
  };

  /* 용량 초과는 곧 저장 실패다. 어느 경로로 났든 같은 상태로 모은다. */
  window.addEventListener('ps-storage-full',function(e){
    set('storage','failed',(e&&e.detail)||null);
  });
})();

/* PROCESS STUDIO — 일정 기준선(PSSchedule)
   왜: process_coach_v1의 weeks 키는 "오늘의 월요일" 기준 상대 인덱스(0=이번 주)인데,
       그 기준 월요일을 어디에도 저장하지 않았다. 그래서 월요일이 한 번 지날 때마다
       저장된 일정 전체가 조용히 한 주씩 뒤로 밀렸다. 8월 5일 경기가 다음 주에는
       8월 12일 경기로 보이는 식이다. 날짜가 흔들리면 그 위에 얹은 경기 준비·리뷰도
       같이 흔들리므로, 이 파일이 앱에서 가장 먼저 실행되는 위치에서 기준선을 고정한다.

   하는 일:
   1) anchorMonday(주차 인덱스가 기준 삼는 월요일)를 함께 저장한다.
   2) 앱을 열 때 지난 주 수만큼 키를 되돌려 내용이 실제 달력 주에 머물게 한다.
   3) 경기 칸마다 안정적인 mid를 부여해, 경기 준비·리뷰가 주차 인덱스가 아니라
      경기 자체를 참조하게 한다(cs_team_matches_v1의 sourceId).

   기존 데이터는 지우지 않는다. 이미 지나간 밀림은 되돌릴 수 없으므로,
   기준선이 없던 사용자는 지금의 월요일을 기준으로 채택하고 이후 밀림만 막는다. */
(function(){
  "use strict";
  var SCHED_KEY='process_coach_v1', MATCH_KEY='cs_team_matches_v1', WEEK_MS=604800000;
  function note(stage,error){ try{ window.PSStorageDiagnostic(stage,error); }catch(_){} }
  function readJSON(k){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(_){ return null; } }
  function writeJSON(k,v){
    try{
      var raw=JSON.stringify(v,function(kk,vv){ return kk==='_open'?undefined:vv; });
      /* 1.642 — 일정 기준선 정렬은 거울만 바꾸면 안 된다. process_coach_v1은
         동기화가 IDB를 읽으므로, 예전 anchor의 IDB가 다음 회차에 다시 내려와
         주차를 앞뒤로 밀었다. 두 저장소를 같은 raw로 갱신한다. */
      if(window.psSaveShared) return !!window.psSaveShared(k,raw);
      localStorage.setItem(k,raw); return true;
    }catch(e){ note('schedule-save',e); return false; }
  }

  function mondayOf(input){
    var d=input?new Date(input):new Date();
    if(isNaN(d)) d=new Date();
    d.setHours(0,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7));
    return d;
  }
  function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function parseYmd(s){
    var m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s||'').trim()); if(!m) return null;
    var d=new Date(+m[1],+m[2]-1,+m[3]); d.setHours(0,0,0,0);
    return isNaN(d)?null:d;
  }
  /* 일정 화면은 day.match로, 주간 보드는 day.board.sched로 경기를 표시한다. 둘 다 경기다. */
  function hasMatch(day){
    var b=day&&day.board||{};
    return !!(day&&(day.match||b.sched==='경기'||b.type==='경기'||b.kind==='match'));
  }
  var seq=0;
  function newId(){ seq++; return 'm'+Date.now().toString(36)+seq.toString(36)+Math.random().toString(36).slice(2,7); }

  /* 저장된 주차 인덱스가 기준 삼는 월요일. 기록이 없으면 이번 주 월요일. */
  function anchor(){
    var data=readJSON(SCHED_KEY);
    return parseYmd(data&&data.anchorMonday)||mondayOf();
  }
  function cellOf(date,base){
    var a=new Date(base||anchor()), d=date instanceof Date?new Date(date):parseYmd(date);
    if(!d) return null;
    a.setHours(0,0,0,0); d.setHours(0,0,0,0);
    var days=Math.round((d-a)/86400000);
    return {wk:Math.floor(days/7), di:((days%7)+7)%7};
  }

  /* 경기가 있는 칸에 안정 ID를 채운다. 경기가 사라진 칸의 ID는 지우지 않는다 —
     같은 날짜에 경기를 다시 넣었을 때 준비·리뷰가 다시 붙는 편이 안전하다. */
  function stampIds(weeks){
    var changed=false;
    if(!weeks||typeof weeks!=='object') return false;
    Object.keys(weeks).forEach(function(k){
      var arr=weeks[k]; if(!Array.isArray(arr)) return;
      arr.forEach(function(day){
        if(day&&hasMatch(day)&&!day.mid){ day.mid=newId(); changed=true; }
      });
    });
    return changed;
  }
  function sourceId(mid){ return mid?('sched:'+mid):''; }

  /* 오늘 이미 기준선을 맞췄으면 더 볼 것이 없다. 일정과 무관한 화면(작전판·노트 등)에서도
     storage.js는 실행되는데, 경기 사진이 들어간 일정은 수 MB까지 커질 수 있어
     매번 통째로 파싱·직렬화하면 그만큼 첫 화면이 늦어진다. 문자열 검사로 먼저 걸러낸다. */
  function alreadyAligned(){
    var raw=null,mraw=null;
    try{ raw=localStorage.getItem(SCHED_KEY); mraw=localStorage.getItem(MATCH_KEY); }catch(_){ return false; }
    if(!raw||raw.indexOf('"anchorMonday":"'+ymd(mondayOf())+'"')<0) return false;
    /* 1.642의 판본 번호가 없거나 팀 문서에 기기 전용 보기 커서가 남아 있으면
       한 번 정규화한다. 이 단계가 끝나야 구버전의 전량 저장을 서버에서 식별할 수 있다. */
    if(!/"scheduleRev":\s*\d+/.test(raw)||/"(?:wk|dayIdx)":/.test(raw)) return false;
    /* 기준선이 맞더라도, 클라우드 동기화나 워크스페이스 전환으로 예전 형식의 경기 기록이
       뒤늦게 들어올 수 있다. 그럴 땐 건너뛰지 않는다. */
    return !(mraw&&mraw.indexOf('"sourceId":"schedule:')>=0);
  }

  function normalize(){
    if(alreadyAligned()) return null;
    var data=readJSON(SCHED_KEY);
    if(!data||typeof data!=='object') return null;
    if(!data.weeks||typeof data.weeks!=='object') data.weeks={};
    var changed=false;
    var loadedRev=parseInt(data.scheduleRev,10);
    if(!Number.isFinite(loadedRev)||loadedRev<0||data.scheduleRev!==loadedRev){data.scheduleRev=Math.max(0,Number.isFinite(loadedRev)?loadedRev:0);changed=true;}

    /* 1) 아직 키를 옮기기 전에 ID를 부여하고 "예전 sourceId → mid" 대응표를 만든다.
          순서를 뒤집으면 예전 기록과의 연결이 끊어진다. */
    if(stampIds(data.weeks)) changed=true;
    var legacy={};
    Object.keys(data.weeks).forEach(function(k){
      var arr=data.weeks[k]; if(!Array.isArray(arr)) return;
      arr.forEach(function(day,di){
        if(day&&hasMatch(day)&&day.mid) legacy['schedule:'+k+':'+di]=day.mid;
      });
    });

    /* 2) 경기 준비·리뷰를 주차 인덱스가 아니라 경기 ID에 붙인다.
          대응되지 않는 예전 기록은 손대지 않는다(지우면 준비·리뷰가 통째로 사라진다). */
    var mstate=readJSON(MATCH_KEY);
    if(mstate&&Array.isArray(mstate.matches)){
      var mchanged=false;
      mstate.matches.forEach(function(m){
        if(!m||typeof m!=='object'||!m.sourceId) return;
        var mid=legacy[m.sourceId];
        if(mid){ m.sourceId=sourceId(mid); mchanged=true; }
      });
      if(mchanged) writeJSON(MATCH_KEY,mstate);
    }

    /* 3) 기준선이 옮겨간 만큼 주차 키를 되돌린다. 순수한 평행 이동이라 키가 겹치지 않는다. */
    var now=mondayOf(), had=parseYmd(data.anchorMonday);
    if(had){
      var delta=Math.round((now-had)/WEEK_MS);
      if(delta){
        var moved={};
        Object.keys(data.weeks).forEach(function(k){
          var n=parseInt(k,10);
          if(isNaN(n)) moved[k]=data.weeks[k];
          else moved[String(n-delta)]=data.weeks[k];
        });
        data.weeks=moved;
        /* 주가 바뀌었으면 지난주 화면이 아니라 이번 주를 열어준다. */
        data.wk=0; data.dayIdx=(new Date().getDay()+6)%7;
        changed=true;
      }
    }
    if(data.anchorMonday!==ymd(now)){ data.anchorMonday=ymd(now); changed=true; }
    if(Object.prototype.hasOwnProperty.call(data,'wk')){ delete data.wk; changed=true; }
    if(Object.prototype.hasOwnProperty.call(data,'dayIdx')){ delete data.dayIdx; changed=true; }
    if(changed){
      /* scheduleRev는 서버 커밋 번호다. 자동 정렬은 로컬 변경으로만 남기고,
         sync가 확인한 서버 rev의 정확히 +1로 올린다. */
      data.scheduleRev=Math.max(0,parseInt(data.scheduleRev,10)||0);
      writeJSON(SCHED_KEY,data);
    }
    return data;
  }

  window.PSSchedule={
    /* 2.475 — 죽은 export 정리(전수조사: 외부 사용은 anchor·hasMatch·mondayOf·newId·stampIds·cellOf·read·readFor 뿐).
       ymd·parseYmd·sourceId·normalize 본체는 내부 호출로 산다 — export 표면만 걷음 */
    mondayOf:mondayOf,
    hasMatch:hasMatch, newId:newId, stampIds:stampIds,
    anchor:anchor, cellOf:cellOf,
    read:function(){ return readJSON(SCHED_KEY); },
    /* 2.215 — 조별 일정: grpWeeks[조] 가 있으면 그것을 weeks 로 돌려준다(없으면 전체). 원본은 건드리지 않는다 */
    readFor:function(grp){ var d=readJSON(SCHED_KEY); if(!d||!grp||!d.grpWeeks||!d.grpWeeks[grp])return d; var o={}; for(var k in d)o[k]=d[k]; o.weeks=d.grpWeeks[grp]; o.grpScope=grp; return o; },
  };

  /* 페이지의 인라인 코드가 일정을 읽기 전에 기준선을 맞춘다. */
  try{ normalize(); }catch(e){ note('schedule-normalize',e); }
})();
