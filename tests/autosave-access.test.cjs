'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/sync.js'),'utf8');
const start=source.indexOf('function autosaveCanRead('),end=source.indexOf('\nfunction ',start+1);
assert.ok(start>=0&&end>start,'extract the actual autosave archive/read capability helper');
const code=source.slice(start,end);
const PRIVATE='cs_idp_v1_',PUBLIC='cs_idp_pub_v1_';
const blind=['scout_tool_v1','cs_squad_v1','cs_meet_sit_v1','cs_match_v1','cs_match_roster_v1'];
const ordinary=['process_coach_v1','cs_team_notice_v1','cs_perms_v1','cs_gamemodel_v1','cs_assign_v1','cs_player_del_v1'];
const personal=['cs_notes_v1','cs_analysis_workspaces_v1'];
function fixture(options={}){
  let uid='owner-a',active='team-a',pwid='personal-a',unlocked=true;
  let workspace={id:active,kind:'team',role:'member'};
  let perms={defaultRole:options.role||'player',members:{}};
  if(options.scopes)perms.members[uid]={scopes:options.scopes};
  if(options.owner)workspace.role='owner';
  const ctx=vm.createContext({
    autosaveContext(wid){wid=String(wid||active);return unlocked&&uid&&(wid===active||wid===pwid)?{uid,wid,seal:'synthetic'}:null;},
    getSess:()=>uid?{uid}:null,personalWid:()=>pwid,activeWs:()=>active,activeWsObj:()=>workspace,
    autosaveKnownKey:k=>blind.includes(k)||ordinary.includes(k)||personal.includes(k)||k==='cs_scout_targets_v1'||k.startsWith('sq:')||k.startsWith(PRIVATE)&&k!==PRIVATE+'local'||k.startsWith(PUBLIC),
    PERSONAL:Object.fromEntries(personal.map(k=>[k,1])),PLAYER_BLIND:blind,
    isIdpPrivateKey:k=>k.startsWith(PRIVATE)&&k!==PRIVATE+'local',isIdpPubKey:k=>k.startsWith(PUBLIC),isItemKey:k=>k.startsWith('sq:'),
    permsRaw:()=>typeof perms==='string'?perms:JSON.stringify(perms)
  });vm.runInContext(code,ctx);
  return {read:(k,wid=active)=>ctx.autosaveCanRead(wid,k),
    role(role){perms={defaultRole:role,members:{}};},perms(value){perms=value;},
    workspace(value){workspace=value;active=value.id;},lock(){unlocked=false;},logout(){uid='';},personal(value){pwid=value;}};
}

for(const role of ['admin','executive','staff','player'])test(`${role}: ordinary shared documents and public IDP remain readable`,()=>{
  const f=fixture({role});for(const k of ordinary.concat([PUBLIC+'owner-a',PUBLIC+'another-player']))assert.equal(f.read(k),true,k);
});
for(const role of ['admin','executive','staff'])test(`${role}: normal roster and player private IDP reads match current team permissions`,()=>{
  const f=fixture({role});for(const k of blind.concat(['sq:player-1',PRIVATE+'owner-a',PRIVATE+'another-player']))assert.equal(f.read(k),true,k);
});
test('team owner retains the normal executive read capability without an explicit member role',()=>{
  const f=fixture({owner:true});for(const k of ordinary.concat(blind,['sq:p',PRIVATE+'other','cs_scout_targets_v1']))assert.equal(f.read(k),true,k);
});
test('only executives may read scouting targets; staffEdit and arbitrary scopes cannot grant this read',()=>{
  for(const role of ['admin','executive'])assert.equal(fixture({role}).read('cs_scout_targets_v1'),true);
  for(const role of ['staff','player']){
    const f=fixture({role,scopes:['scout','team','board']});assert.equal(f.read('cs_scout_targets_v1'),false);
    f.perms({defaultRole:role,staffEdit:'edit',members:{}});assert.equal(f.read('cs_scout_targets_v1'),false);
  }
});
test('ordinary players cannot read blind keys or foreign private IDP, but can read their own IDP',()=>{
  const f=fixture();for(const k of blind.concat(['sq:p',PRIVATE+'other']))assert.equal(f.read(k),false,k);
  assert.equal(f.read(PRIVATE+'owner-a'),true);
});
test('team write scope grants player roster reads, never foreign IDP or scouting targets',()=>{
  const f=fixture({scopes:['team']});
  for(const k of blind.filter(k=>k!=='cs_meet_sit_v1').concat(['sq:p']))assert.equal(f.read(k),true,k);
  for(const k of ['cs_meet_sit_v1',PRIVATE+'other','cs_scout_targets_v1'])assert.equal(f.read(k),false,k);
});
test('board write scope grants only the blind meeting document, not team roster data',()=>{
  const f=fixture({scopes:['board']});assert.equal(f.read('cs_meet_sit_v1'),true);
  for(const k of blind.filter(k=>k!=='cs_meet_sit_v1').concat(['sq:p',PRIVATE+'other']))assert.equal(f.read(k),false,k);
});
test('an explicit member role overrides a permissive default role',()=>{
  const f=fixture();f.perms({defaultRole:'admin',members:{'owner-a':{role:'player',scopes:[]}}});
  for(const k of blind.concat(['sq:p',PRIVATE+'other','cs_scout_targets_v1']))assert.equal(f.read(k),false,k);
});
test('missing, malformed, and unknown permission roles never grant restricted access',()=>{
  const f=fixture();for(const value of [null,'{',{},{defaultRole:'invented-admin'},{defaultRole:'player',members:{'owner-a':{scopes:'team'}}}]){
    f.perms(value);for(const k of blind.concat(['sq:p',PRIVATE+'other','cs_scout_targets_v1']))assert.equal(f.read(k),false,k);
  }
});
test('demotion immediately closes historical originals even when account and active team stay the same',()=>{
  const f=fixture({role:'admin'}),archivedKeys=[...blind,'sq:p',PRIVATE+'other','cs_scout_targets_v1'];
  assert.ok(archivedKeys.every(k=>f.read(k)));f.role('player');assert.ok(archivedKeys.every(k=>!f.read(k)));
  assert.equal(f.read(PRIVATE+'owner-a'),true);assert.equal(f.read('cs_team_notice_v1'),true);
});
test('personal records route exclusively to the signed-in owner personal workspace',()=>{
  const f=fixture({role:'admin'});for(const k of personal){assert.equal(f.read(k,'team-a'),false);assert.equal(f.read(k,'personal-a'),true);assert.equal(f.read(k,'personal-other'),false);}
});
test('the personal workspace never grants access to another player private/public IDP',()=>{
  const f=fixture({role:'admin'});for(const prefix of [PRIVATE,PUBLIC]){assert.equal(f.read(prefix+'owner-a','personal-a'),true);assert.equal(f.read(prefix+'other','personal-a'),false);}
  f.workspace({id:'personal-a',kind:'personal',role:'owner'});
  for(const prefix of [PRIVATE,PUBLIC])assert.equal(f.read(prefix+'other'),false);
  assert.equal(f.read('scout_tool_v1'),true);
});
test('old teams, unknown keys, guest IDP, logout and cache locks fail closed',()=>{
  const f=fixture({owner:true});for(const k of [...ordinary,'sq:p',PRIVATE+'owner-a'])assert.equal(f.read(k,'team-old'),false);
  for(const k of ['ps_sync_session','ps_autosave_journal_v1:secret',PRIVATE+'local'])assert.equal(f.read(k),false);
  f.lock();assert.equal(f.read('cs_team_notice_v1'),false);
  const g=fixture({owner:true});g.logout();assert.equal(g.read('cs_team_notice_v1'),false);
});
