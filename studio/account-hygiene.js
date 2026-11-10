/* PROCESS STUDIO — 계정이 바뀔 때 남는 사본 치우기(3.272, 보안 점검 «같이 쓰는 기기»)
   다른 계정이 로그인하면 sync.js wipeAccountCache 가 앞 계정의 자료 키(cs_* · scout_* · sq:* …)를 지운다. 그런데 IndexedDB 의 세 묶음은 이름이 달라 남았다:
     · ps_blob:<해시>                              보관함 그림의 받은 사본(서버에 있는 것 — 언제든 다시 받는다)
     · psimg_<id>                                  사진 보관소(선수 사진 · 판 그림). 문서는 `psimg:<키>` 로 가리킨다
     · ps_autosave_journal_v1:<uid>:<팀>:<종류>:…  자동 저장 기준본(base · captured = 서버가 확인한 본문) · 보관본(archive = 서버에 못 올린 원문)
   sweep(current) 는 그 wipe 의 끝에서 불린다(자료 키가 지워진 뒤):
     ① ps_blob:* 는 늘 지운다(사본).
     ② 앞 계정이 «모든 변경을 서버에 확인한 로그아웃»(signOut 의 장벽을 지난 로그아웃 — clean(uid) 표식)을 했을 때만
        그 계정의 base · captured 기준본과, 남은 저장소 어디에도 이름이 없는 psimg_* 를 지운다.
     ③ archive(못 올린 원문)는 **어떤 경우에도 지우지 않는다.** 세션이 만료돼 장벽 없이 나간 계정의 기준본도 그대로 둔다(그 계정이 돌아오면 쓴다).
     ④ 지우기로 한 것이 남아 있으면 실패로 알린다(verifyWorkspacePubCleared 와 같은 태도 — 다음 계정의 자료가 열리기 전에 멈춘다).
   새 저장 키: ps_logout_clean_v1(이 기기만 · uid 와 시각). 시험 tests/account-hygiene-3272. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document)root.PSAccountHygiene=api.create({local:function(){return root.localStorage;},storage:function(){return root.storage;}});
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var MARK='ps_logout_clean_v1',BLOB='ps_blob:',IMG='psimg_',JOURNAL='ps_autosave_journal_v1:',MARK_TTL=180*24*3600*1000;
  function create(env){
    function local(){ try{ return env.local(); }catch(_){ return null; } }
    function store(){ try{ return env.storage(); }catch(_){ return null; } }
    function sessionUid(){ try{ var s=JSON.parse(local().getItem('ps_sync_session')||'null'); return s&&s.uid?String(s.uid):''; }catch(_){ return ''; } }
    function mark(){
      try{ var m=JSON.parse(local().getItem(MARK)||'null'); if(m&&typeof m.uid==='string'&&m.uid&&typeof m.at==='number'&&Date.now()-m.at>=0&&Date.now()-m.at<MARK_TTL)return m; }catch(_){}
      return null;
    }
    function unmark(){ try{ local().removeItem(MARK); }catch(_){} }
    /* signOut 이 «서버 확인» 장벽을 지나 끝났을 때만 부른다 */
    function clean(uid){
      uid=String(uid||''); if(!uid)return false;
      try{ local().setItem(MARK,JSON.stringify({uid:uid,at:Date.now()})); return true; }catch(_){ return false; }
    }
    /* 그 계정이 다시 쓰기 시작했으면 옛 표식은 뜻이 없다(부팅 때 · 세션이 보이면) */
    function boot(){ var m=mark(); if(m&&sessionUid()===m.uid)unmark(); }
    function journalOf(k){
      if(typeof k!=='string'||k.indexOf(JOURNAL)!==0)return null;
      var parts=k.slice(JOURNAL.length).split(':');
      if(parts.length<3)return null;
      var uid=''; try{ uid=decodeURIComponent(parts[0]); }catch(_){ return null; }
      return {uid:uid,kind:parts[2]};
    }
    /* 이 키를 지워도 되는가 — cleanUid: 서버 확인 로그아웃을 한 앞 계정(없으면 '') */
    function removable(k,cleanUid,currentUid){
      if(typeof k!=='string')return false;
      if(k.indexOf(BLOB)===0)return true;
      var j=journalOf(k);
      if(j)return !!cleanUid&&j.uid===cleanUid&&j.uid!==currentUid&&(j.kind==='base'||j.kind==='captured');
      return false;
    }
    function text(v){ if(v==null)return ''; if(typeof v==='string')return v; try{ return JSON.stringify(v)||''; }catch(_){ return ''; } }
    function localKeys(){ var out=[],ls=local(); try{ for(var i=0;i<ls.length;i++){ var k=ls.key(i); if(k!=null)out.push(k); } }catch(_){} return out; }
    function sweep(current){
      current=typeof current==='function'?current:function(){};
      var st=store(),ls=local(),m=mark(),me=sessionUid(),cleanUid=m&&m.uid!==me?m.uid:'';
      var report={blobs:0,journals:0,images:0,keptImages:0,clean:!!cleanUid};
      /* 작은 저장소 쪽(옛 판이 둔 사본) */
      try{ localKeys().forEach(function(k){ if(removable(k,cleanUid,me)){ current(); ls.removeItem(k); if(ls.getItem(k)!=null)throw new Error(k+' local wipe verify failed'); } }); }catch(e){ return Promise.reject(e); }
      if(!st||typeof st.keys!=='function'||typeof st.del!=='function'){ if(cleanUid)unmark(); return Promise.resolve(report); }
      var doomed=[];
      return Promise.resolve(st.keys()).then(function(keys){
        current();
        if(!Array.isArray(keys))throw new Error('IndexedDB 키 목록을 확인할 수 없습니다');
        doomed=keys.filter(function(k){ return removable(k,cleanUid,me); });
        report.blobs=doomed.filter(function(k){return k.indexOf(BLOB)===0;}).length;report.journals=doomed.length-report.blobs;
        var images=cleanUid?keys.filter(function(k){ return typeof k==='string'&&k.indexOf(IMG)===0; }):[];
        if(!images.length)return [];
        /* 남은 저장소(작은 저장소 전부 + IndexedDB 의 그림 · 지울 것 말고 전부)에 이름이 한 번이라도 나오는 사진은 둔다 */
        var hay=[];
        localKeys().forEach(function(k){ try{ hay.push(k+'\n'+text(ls.getItem(k))); }catch(_){} });
        var rest=keys.filter(function(k){ return typeof k==='string'&&k.indexOf(IMG)!==0&&doomed.indexOf(k)<0; });
        return rest.reduce(function(p,k){ return p.then(function(){ current(); return Promise.resolve(st.get(k)).then(function(r){ hay.push(k+'\n'+text(r&&typeof r==='object'&&'value' in r?r.value:r)); }); }); },Promise.resolve()).then(function(){
          var orphan=images.filter(function(k){ return !hay.some(function(h){ return h.indexOf(k)>=0; }); });
          report.images=orphan.length;report.keptImages=images.length-orphan.length;
          return orphan;
        });
      }).then(function(orphan){
        doomed=doomed.concat(orphan);
        return doomed.reduce(function(p,k){ return p.then(function(){ current(); return st.del(k,current); }); },Promise.resolve());
      }).then(function(){
        current();
        return Promise.resolve(st.keys());
      }).then(function(keys){
        current();
        if(!Array.isArray(keys))throw new Error('IndexedDB 키 목록을 확인할 수 없습니다');
        var left=doomed.filter(function(k){ return keys.indexOf(k)>=0; });
        if(left.length)throw new Error('Account cache IndexedDB wipe verification failed');
        if(cleanUid)unmark();
        return report;
      });
    }
    try{ boot(); }catch(_){}
    return {clean:clean,sweep:sweep,removable:removable,mark:mark,boot:boot,MARK:MARK};
  }
  return {create:create,MARK:MARK};
});
