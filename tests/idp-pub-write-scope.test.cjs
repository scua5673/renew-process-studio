'use strict';
/* 2.912 — 코치 피드백(cs_idp_pub_v1_<uid>)은 IDP 열람 규칙으로 올린다: 선수가 아니면 올린다.
   서버(migrations/20260930_idp_pub_write · 20260930_role_default_player)와 같은 판정이어야 한다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=fs.readFileSync(require.resolve('../studio/sync.js'),'utf8');
const a=S.indexOf('        function canW(k){'),b=S.indexOf('\n        var deniedKeys=',a);
assert.ok(a>0&&b>a,'canW');
const CANW=S.slice(a,b);

function canW(k,role,opt){
  opt=opt||{};
  const c=vm.createContext({role,scopes:opt.scopes||null,localStorage:{getItem:()=>null},permsRaw:()=>JSON.stringify({staffEdit:opt.staffEdit||'view'}),
    isIdpPubKey:x=>x.indexOf('cs_idp_pub_v1_')===0,keyScope:x=>x==='scout_tool_v1'?'team':(x.indexOf('cs_idp_pub_v1_')===0?'team':'board')});
  vm.runInContext(CANW+';this.canW=canW;',c);
  return c.canW(k);
}
const PUB='cs_idp_pub_v1_00000000-0000-4000-8000-000000000005';

test('view-only coaching staff uploads coach feedback but not team data',()=>{
  assert.equal(canW(PUB,'staff'),true);
  assert.equal(canW('scout_tool_v1','staff'),false,'1.634 보기 전용은 그대로');
});
test('scoped staff, executive and admin upload coach feedback',()=>{
  assert.equal(canW(PUB,'staff',{scopes:['board']}),true,'구역과 상관없이');
  assert.equal(canW(PUB,'executive'),true);assert.equal(canW(PUB,'admin'),true);
});
test('players (including role-less members and missing perms doc) never upload coach feedback',()=>{
  assert.equal(canW(PUB,'player'),false);
  assert.equal(canW(PUB,'player',{scopes:['team']}),false,'팀 구역을 받은 선수도 코치 피드백은 못 쓴다(서버 ps_idp_can_view 와 같게)');
});
