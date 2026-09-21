/* Saved roster library: preserve other teams, verify durable writes, reject stale owners. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSTeamLibrary=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
var KEY='cs_analysis_team_library_v1';
function parse(raw){if(raw==null)return [];var a=JSON.parse(raw);if(!Array.isArray(a)||a.some(function(t){return !t||typeof t!=='object'||typeof t.id!=='string'||!t.id||(t.players!=null&&!Array.isArray(t.players));}))throw Error('저장 명단 형식을 확인할 수 없습니다.');return a;}
function owner(w){try{var s=JSON.parse(w.localStorage.getItem('ps_sync_session')||'null'),uid=s&&s.uid||'',wid=w.localStorage.getItem('ps_active_ws')||'',seal=w.localStorage.getItem('ps_cache_owner_v1')||'',o=JSON.parse(seal||'null'),g=JSON.parse(w.localStorage.getItem('ps_ws_switch_guard_v1')||'null');if(g&&g.token&&Date.now()-(+g.at||0)<=90000)return null;if((uid||wid||seal)&&(!uid||!wid||!o||o.uid!==uid||o.wid!==wid))return null;var sync=w.parent&&w.parent.PSSync;if(sync&&sync.dataUnlocked&&sync.dataUnlocked()!==true)return null;return JSON.stringify([uid,wid,seal,w.localStorage.getItem('ps_ws_switch_epoch_v1')||'']);}catch(_){return null;}}
function create(w){
 var pending=null;
 function guard(seal){if(seal===null||owner(w)!==seal)throw Error('계정 또는 팀이 바뀌었습니다. 입력을 보관한 뒤 다시 열어 주세요.');}
 async function read(seal){
  guard(seal);if(w.PSStorage&&w.PSStorage.sharedReady)await w.PSStorage.sharedReady(KEY);guard(seal);
  var raw=w.localStorage.getItem(KEY);if(raw!==null)return parse(raw);
  if(!w.storage||!w.storage.get)throw Error('저장소를 열지 못했습니다.');
  var r=await w.storage.get(KEY);guard(seal);
  // Another tab/sync may have filled the mirror during the durable read.
  raw=w.localStorage.getItem(KEY);if(raw!==null)return parse(raw);
  raw=r&&r.value!=null?r.value:null;var a=parse(raw);
  if(raw!==null){w.localStorage.setItem(KEY,raw);if(w.localStorage.getItem(KEY)!==raw)throw Error('명단을 불러오지 못했습니다.');}
  return a;
 }
 async function save(team,base,seal){
  var candidate=JSON.parse(JSON.stringify(team));parse(JSON.stringify([candidate]));
  async function commit(){
   guard(seal);var a=await read(seal);guard(seal);var current=a.find(function(t){return t.id===candidate.id;}),currentRaw=JSON.stringify(current||null);
   var retry=pending&&pending.seal===seal&&pending.id===candidate.id&&currentRaw===pending.team;
   if(currentRaw!==base&&!retry)throw Error('다른 화면에서 이 팀이 변경됐습니다. 입력을 보관한 뒤 팀을 다시 선택해 주세요.');
   var i=a.findIndex(function(t){return t.id===candidate.id;});if(i<0)a.unshift(candidate);else a[i]=candidate;
   var raw=JSON.stringify(a);guard(seal);
   if(!w.psSaveSharedAsync||!w.PSStorage||!w.PSStorage.sharedVerified)throw Error('저장 확인 기능을 준비하지 못했습니다.');
   pending={seal:seal,id:candidate.id,team:JSON.stringify(candidate)};
   await w.psSaveSharedAsync(KEY,raw);guard(seal);await w.PSStorage.sharedVerified(KEY,raw);guard(seal);
   if(w.localStorage.getItem(KEY)!==raw)throw Error('저장 중 명단이 변경됐습니다. 입력 내용은 유지됩니다.');
   pending=null;return candidate;
  }
  if(w.navigator&&w.navigator.locks&&w.navigator.locks.request)return w.navigator.locks.request('ps-team-library-write-v1',commit);
  return commit();
 }
 return {read:read,save:save,owner:function(){return owner(w);}};
}
return {key:KEY,parse:parse,create:create};
});
