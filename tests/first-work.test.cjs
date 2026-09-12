'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const first=require('../studio/first-work.js');
function fixture({session={uid:'user-a'},workspace={id:'team-a',kind:'team'},active,ready=true,role='staff',edit=false}={}){
  return {PSSync:{session:()=>session,activeWsObj:()=>workspace,activeWs:()=>active===undefined?workspace?.id:active,dataUnlocked:()=>ready},PSPerms:{role:()=>role,canEdit:section=>section==='schedule'&&edit}};
}
for(const item of [
  ['guest false-admin',{session:null,role:'admin',edit:true},'guest'],
  ['unlocked personal false-admin',{workspace:{id:'own-a',kind:'personal'},role:'admin',edit:true},'personal'],
  ['team owner',{role:'executive',edit:true},'coach'],
  ['staff default read-only',{},'observer'],
  ['staff explicit schedule grant',{edit:true},'coach'],
  ['staff other area only',{edit:false},'observer'],
  ['player',{role:'player'},'player'],
  ['player with unusual explicit grant',{role:'player',edit:true},'player'],
  ['signed-in data not ready',{ready:false,edit:true},'locked'],
  ['workspace missing',{workspace:null},'locked'],
  ['unknown workspace kind',{workspace:{id:'team-a',kind:'unknown'},edit:true},'locked'],
  ['workspace switching',{active:'team-b',edit:true},'locked']
])test(item[0],()=>assert.equal(first.context(fixture(item[1])).kind,item[2]));
test('missing or throwing auth API fails closed',()=>{
  assert.equal(first.context({}).kind,'guest');
  assert.equal(first.context({PSSync:{session(){throw Error('not ready');}}}).kind,'locked');
});
test('guest and personal tasks lead team setup to account, never a team editing route',()=>{
  for(const kind of ['guest','personal']){
    const plan=first.plan({kind});
    assert.equal(plan.find(t=>t.id==='setup').route,'account');
    assert.equal(plan.some(t=>t.route==='schedule'),false);
  }
});
test('player first task is personal IDP, not squad IDP or self evaluation',()=>{
  assert.deepEqual(first.plan({kind:'player'})[0],{id:'player',route:'idp'});
  assert.equal(first.routes.idp,'#appSeg button[data-app="idp"]');
});
test('read-only staff are directed to reading, never to session creation instructions',()=>{
  assert.deepEqual(first.plan({kind:'observer'})[0],{id:'observer',route:'schedule'});
  assert.equal(first.plan({kind:'observer'}).some(t=>t.id==='coach'),false);
});
test('account, team, readiness, role or permission changes invalidate a displayed plan',()=>{
  const baseline=first.context(fixture({edit:true}));
  for(const options of [{session:{uid:'user-b'},edit:true},{workspace:{id:'team-b',kind:'team'},edit:true},{ready:false,edit:true},{role:'executive',edit:true},{edit:false}]){
    assert.notEqual(first.signature(first.context(fixture(options))),first.signature(baseline));
  }
});
test('every language has complete three-step cards and status/error copy',()=>{
  assert.deepEqual(Object.keys(first.copy).sort(),['en','es','ja','ko','pt','zh']);
  const keys=Object.keys(first.copy.ko).sort();
  for(const [lang,copy] of Object.entries(first.copy)){
    assert.deepEqual(Object.keys(copy).sort(),keys,lang);
    for(const value of Object.values(copy))if(Array.isArray(value)){
      assert.equal(value.length,3);assert.equal(value[2].length,3);
      assert.ok([value[0],value[1],...value[2]].every(s=>typeof s==='string'&&s.trim()));
    }else assert.ok(typeof value==='string'&&value.trim());
  }
});
test('role context labels stay separate from card titles and steps in every language',()=>{
  for(const copy of Object.values(first.copy))for(const role of ['player','coach','observer']){
    assert.equal(typeof copy[role+'Label'],'string');
    assert.ok(copy[role+'Label'].length<60);
    assert.ok(Array.isArray(copy[role]),'task instructions have their own field');
  }
});
