'use strict';
/* 2.913 — 코칭스태프 쓰기 판정이 서버(migrations/20260930_staff_view_only)와 같아야 한다:
   편집 닫힘 = 못 씀 · 편집 열림 = 스카우팅만 빼고 씀 · «스태프도 일정 편집» = 일정은 씀. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=fs.readFileSync(require.resolve('../studio/sync.js'),'utf8');
const a=S.indexOf('        function canW(k){'),b=S.indexOf('\n        var deniedKeys=',a);
assert.ok(a>0&&b>a,'canW');
const CANW=S.slice(a,b);
const SCOPE={scout_tool_v1:'team',cs_scout_targets_v1:'scout',cs_gamemodel_v1:'gamemodel',process_coach_v1:'board'};
function canW(k,role,perms,scopes){
  const raw=JSON.stringify(perms||{});
  const c=vm.createContext({role,scopes:scopes||null,localStorage:{getItem:x=>x==='cs_perms_v1'?raw:null},permsRaw:()=>raw,
    isIdpPubKey:x=>x.indexOf('cs_idp_pub_v1_')===0,keyScope:x=>SCOPE[x]||'board'});
  vm.runInContext(CANW+';this.canW=canW;',c);
  return c.canW(k);
}
test('편집 닫힘 스태프는 팀 자료·스카우팅·일정을 못 쓴다',()=>{
  for(const k of ['scout_tool_v1','cs_scout_targets_v1','cs_gamemodel_v1','process_coach_v1'])assert.equal(canW(k,'staff',{staffEdit:'view'}),false,k);
});
test('편집 열림 스태프는 스카우팅만 빼고 쓴다(서버와 같게)',()=>{
  assert.equal(canW('scout_tool_v1','staff',{staffEdit:'edit'}),true);
  assert.equal(canW('cs_gamemodel_v1','staff',{staffEdit:'edit'}),true);
  assert.equal(canW('cs_scout_targets_v1','staff',{staffEdit:'edit'}),false,'스카우팅은 임원·관리자만');
});
test('«스태프도 일정 편집»이면 편집 닫힘 스태프도 일정은 쓴다',()=>{
  assert.equal(canW('process_coach_v1','staff',{schedEdit:'staff'}),true);
  assert.equal(canW('scout_tool_v1','staff',{schedEdit:'staff'}),false);
});
test('구역을 지정받은 스태프·임원은 그대로',()=>{
  assert.equal(canW('cs_scout_targets_v1','staff',{staffEdit:'edit'},['scout']),true,'개별 지정은 스카우팅도 연다(서버 scl ? sc 와 같게)');
  assert.equal(canW('cs_scout_targets_v1','executive',{}),true);
});
