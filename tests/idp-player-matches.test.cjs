'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
const PREFIX='cs_idp_v1_',PERMS='cs_perms_v1',MATCHES='cs_team_matches_v1',DELETED='cs_match_del_v1';
const clone=value=>JSON.parse(JSON.stringify(value));
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function fn(name){
  const start=source.indexOf('  function '+name+'(');
  assert.ok(start>=0,'actual function '+name+' exists');
  const lineEnd=source.indexOf('\n',start);
  if(source.slice(start,lineEnd).trimEnd().endsWith('}'))return source.slice(start,lineEnd);
  const tail=source.slice(start),next=/\n  (?:function|var)\s/.exec(tail);
  assert.ok(next,'actual function '+name+' has a following declaration');
  return tail.slice(0,next.index);
}
const functions=['sess','teamWsObj','onTeam','myTeamRole','isCoach','idpSaveApi','idpSaveOwner',
  'esc','ymd','mtSc5','mtSc5Lb','sqMatchObject','sqMatchContext','sqMatchRows','rSqMatches'];
const scale=source.match(/  var MT_SC5=\[.*?\];/);
assert.ok(scale,'actual legacy-compatible rating labels exist');
const code=scale[0]+'\n'+functions.map(fn).join('\n');

// Production identity, role, data selection, legacy rating, escaping and render
// functions run unchanged. Only authenticated API/storage surfaces are fakes.
// All mutation entry points throw, including writes to either player's document.
function harness(){
  const state={liveUid:'coach',unlocked:true,throwKey:''};
  const p={id:'roster-a',name:'동명이인'},other={id:'roster-b',name:'동명이인'};
  const a={v:1,matchSelf:{'match-a':{good:'A의 기록',score:4,at:100}},log:{private:'보존 A'}};
  const b={v:1,matchSelf:{'match-b':{good:'B의 기록',score:3,at:200}},log:{private:'보존 B'}};
  const local=new Map([
    ['ps_sync_session',JSON.stringify({uid:'coach'})],['ps_active_ws','team-1'],
    ['ps_ws_list',JSON.stringify([{id:'team-1',kind:'team',role:'owner'}])],
    [PERMS,JSON.stringify({v:1,defaultRole:'player',members:{coach:{role:'executive'},'uid-a':{playerId:p.id,role:'player'},'uid-b':{playerId:other.id,role:'player'}}})],
    [PREFIX+'uid-a',JSON.stringify(a)],[PREFIX+'uid-b',JSON.stringify(b)],
    [MATCHES,JSON.stringify({matches:[{id:'match-a',date:'2026-09-12',opponent:'상대 A'},{id:'match-b',date:'2026-09-11',opponent:'상대 B'}]})],
    [DELETED,'[]']
  ]);
  const reads=[],writes=[];
  function refuseWrite(...args){writes.push(args);throw new Error('readonly path attempted a write');}
  const c={PREFIX,_idpRecoveryAuthLocked:false,doc:freeze({v:1,matchSelf:{mine:{good:'코치 개인 문서'}}}),viewing:PREFIX+'coach',
    localStorage:{getItem(key){reads.push(key);if(state.throwKey===key)throw new Error('storage unavailable');return local.has(key)?local.get(key):null;},setItem:refuseWrite,removeItem:refuseWrite,clear:refuseWrite},
    save:refuseWrite,load:refuseWrite,syncMyIdpSoon:refuseWrite,console,Date};
  c.window=c;c.parent={PSSync:{session:()=>state.liveUid?{uid:state.liveUid}:null,dataUnlocked:()=>state.unlocked}};
  vm.createContext(c);vm.runInContext(code,c,{filename:'idp.html actual player-match readers'});
  return {c,p,other,state,local,reads,writes,set:(key,value)=>local.set(key,JSON.stringify(value)),
    get:key=>JSON.parse(local.get(key)),context:()=>c.sqMatchContext(p),html:()=>c.rSqMatches(p)};
}

test('exact roster ID selects one linked account even when player names are identical',()=>{
  const h=harness(),a=h.context();assert.equal(a.state,'ready');assert.equal(a.uid,'uid-a');assert.equal(a.doc.matchSelf['match-a'].good,'A의 기록');
  assert.equal(h.reads.includes(PREFIX+'uid-b'),false);
  const html=h.html();assert.match(html,/A의 기록/);assert.equal(html.includes('B의 기록'),false);
  const b=h.c.sqMatchContext(h.other);assert.equal(b.uid,'uid-b');assert.equal(b.doc.matchSelf['match-b'].good,'B의 기록');
});

test('record ownership comes from the linked document, not team roster or shared match ID',()=>{
  const h=harness();h.set(PREFIX+'uid-b',{v:1,matchSelf:{'match-a':{good:'다른 선수의 같은 경기 기록'}}});
  assert.match(h.html(),/A의 기록/);assert.equal(h.html().includes('다른 선수'),false);
});

test('legacy numeric roster IDs compare exactly without matching a substring or name',()=>{
  const h=harness();h.p.id=17;const pm=h.get(PERMS);pm.members['uid-a'].playerId='17';pm.members['uid-b'].playerId='117';h.set(PERMS,pm);
  assert.equal(h.context().uid,'uid-a');
});

test('unlinked roster never falls back to a same-name account or the viewed document',()=>{
  const h=harness();h.p.id='not-linked';assert.equal(h.context().state,'unlinked');
  assert.equal(h.reads.some(key=>key.startsWith(PREFIX)),false);assert.equal(h.html().includes('A의 기록'),false);
});

test('duplicate account links are ambiguous and no candidate private document is read',()=>{
  const h=harness(),pm=h.get(PERMS);pm.members['uid-b'].playerId=h.p.id;h.set(PERMS,pm);
  assert.equal(h.context().state,'ambiguous');assert.equal(h.reads.some(key=>key.startsWith(PREFIX)),false);
  assert.equal(h.html().includes('A의 기록'),false);assert.equal(h.html().includes('B의 기록'),false);
});

for(const [name,change] of [
  ['permissions have not arrived',h=>h.local.delete(PERMS)],
  ['the exact linked document has not arrived',h=>h.local.delete(PREFIX+'uid-a')]
])test(name+' remains pending rather than looking empty or unlinked',()=>{
  const h=harness();change(h);assert.equal(h.context().state,'pending');assert.match(h.html(),/data-sqm-state="pending"/);
  assert.equal(h.reads.includes(PREFIX+'uid-b'),false);
});

for(const [name,key,value,raw] of [
  ['malformed permissions JSON',PERMS,'{bad',true],['null permissions',PERMS,null],
  ['array members',PERMS,{members:[]}],['missing members',PERMS,{v:1}],
  ['malformed player JSON',PREFIX+'uid-a','{bad',true],['array player document',PREFIX+'uid-a',[]],
  ['unknown player document version',PREFIX+'uid-a',{v:2,matchSelf:{}}],
  ['array match collection',PREFIX+'uid-a',{v:1,matchSelf:[]}],
  ['string match collection',PREFIX+'uid-a',{v:1,matchSelf:'damaged'}]
])test(name+' is invalid instead of an empty history',()=>{
  const h=harness();if(raw)h.local.set(key,value);else h.set(key,value);
  assert.equal(h.context().state,'invalid');assert.match(h.html(),/data-sqm-state="invalid"/);assert.deepEqual(h.writes,[]);
});

test('a storage read error reports invalid without writing a replacement document',()=>{
  const h=harness();h.state.throwKey=PREFIX+'uid-a';assert.equal(h.context().state,'invalid');assert.deepEqual(h.writes,[]);
});

for(const d of [{v:1},{v:1,matchSelf:null},{v:1,matchSelf:{}}])test('a valid empty document remains distinct from pending '+JSON.stringify(d),()=>{
  const h=harness();h.set(PREFIX+'uid-a',d);assert.equal(h.context().state,'ready');assert.match(h.html(),/data-sqm-state="empty"/);
});

for(const [name,change] of [
  ['missing local session',h=>{h.local.delete('ps_sync_session');h.state.liveUid='';}],
  ['missing authenticated session',h=>{h.state.liveUid='';}],
  ['authenticated owner differs from local session',h=>{h.state.liveUid='other-coach';}],
  ['data locked in sync API',h=>{h.state.unlocked=false;}],
  ['recovery authentication locked',h=>{h.c._idpRecoveryAuthLocked=true;}],
  ['missing workspace',h=>h.local.delete('ps_active_ws')],
  ['personal workspace',h=>h.set('ps_ws_list',[{id:'team-1',kind:'personal',role:'owner'}])],
  ['player role',h=>{h.set('ps_ws_list',[{id:'team-1',kind:'team',role:'member'}]);const pm=h.get(PERMS);pm.members.coach.role='player';h.set(PERMS,pm);}]
])test(name+' cannot read another player history',()=>{
  const h=harness();change(h);assert.equal(h.context().state,'unavailable');assert.match(h.html(),/data-sqm-state="unavailable"/);
  assert.equal(h.reads.some(key=>key.startsWith(PREFIX)),false);assert.deepEqual(h.writes,[]);
});

test('orphan and deleted matches retain player records and IDs without resurrecting schedule metadata',()=>{
  const h=harness();h.set(DELETED,['match-a']);h.set(PREFIX+'uid-a',{v:1,matchSelf:{'match-a':{good:'삭제 후에도 남긴 기록',at:200},orphan:{better:'일정 없는 경기의 기록',at:100}}});
  const rows=h.c.sqMatchRows(h.context().doc);assert.deepEqual(Array.from(rows,r=>r.id),['match-a','orphan']);
  assert.equal(rows[0].removed,true);assert.equal(rows[0].match,null);assert.equal(rows[1].removed,false);assert.equal(rows[1].match,null);
  const html=h.html();assert.match(html,/data-sqm-id="match-a"/);assert.match(html,/data-sqm-id="orphan"/);assert.match(html,/삭제 후에도 남긴 기록/);assert.match(html,/일정 없는 경기의 기록/);assert.equal(html.includes('상대 A'),false);
});

for(const raw of ['{bad','null','[]','{"matches":"broken"}'])test('unreadable team fixture preserves player history '+raw,()=>{
  const h=harness();h.local.set(MATCHES,raw);const rows=h.c.sqMatchRows(h.context().doc);assert.equal(rows.length,1);assert.equal(rows[0].id,'match-a');assert.equal(rows[0].match,null);assert.match(h.html(),/A의 기록/);
});

test('empty or damaged rows are ignored while zero minutes is a real record',()=>{
  const h=harness(),d=freeze({v:1,matchSelf:{empty:{},timestampOnly:{at:100},blank:{good:'  ',mins:' '},array:[],scalar:'bad',nil:null,zero:{mins:0},role:{roleDef:'커버'},rating:{score:7}}});
  assert.deepEqual(Array.from(h.c.sqMatchRows(d),r=>r.id).sort(),['rating','role','zero']);
  h.set(PREFIX+'uid-a',d);assert.match(h.html(),/>0분<\/p>/);
});

test('nonparticipation is shown without inventing played minutes',()=>{
  const h=harness();h.set(PREFIX+'uid-a',{v:1,matchSelf:{unused:{apps:'none',mins:0}}});
  const html=h.html();assert.match(html,/>미출전<\/p>/);assert.equal(html.includes('0분'),false);
});

test('legacy ratings use the existing five-step reader without rewriting original scores',()=>{
  const h=harness();h.set(PREFIX+'uid-a',{v:1,matchSelf:{legacy:{score:7},legacyTop:{score:10},modern:{score:3}}});
  const before=h.local.get(PREFIX+'uid-a'),html=h.html();assert.match(html,/자기 평점 · 좋았음/);assert.match(html,/자기 평점 · 아주 좋았음/);assert.match(html,/자기 평점 · 보통/);
  assert.equal(h.local.get(PREFIX+'uid-a'),before);assert.deepEqual(h.writes,[]);
});

test('rows use match dates first and valid record timestamps as an orphan fallback',()=>{
  const h=harness(),at=Date.parse('2026-09-13T12:00:00Z');
  const d={v:1,matchSelf:{'match-a':{good:'일정 날짜',at:at+864e5},newOrphan:{good:'최근 기록',at},invalidAt:{good:'시간 없음',at:'bad'},noAt:{good:'시간 없음'}}};
  const rows=h.c.sqMatchRows(d);assert.equal(rows[0].id,'newOrphan');assert.equal(rows[1].id,'match-a');assert.equal(rows[1].date,'2026-09-12');
  assert.equal(rows.find(r=>r.id==='invalidAt').at,0);assert.equal(rows.find(r=>r.id==='noAt').at,0);
});

test('all player text, schedule text, legacy appearance text and record IDs are HTML escaped',()=>{
  const h=harness(),id='" onmouseover="alert(1)',payload='<img src=x onerror="alert(1)"> & \'quoted\'';
  h.set(PREFIX+'uid-a',{v:1,matchSelf:{[id]:{good:payload,better:payload,tried:payload,pos:payload,roleAtk:payload,roleDef:payload,apps:payload,mins:payload}}});
  h.set(MATCHES,{matches:[{id,date:'2026-09-12',opponent:'<svg onload="alert(2)">'}]});
  const html=h.html();assert.equal(/<(?:img|svg|script)\b/i.test(html),false);assert.match(html,/data-sqm-id="&quot; onmouseover=&quot;alert\(1\)"/);
  assert.match(html,/&lt;svg/);assert.match(html,/&lt;img/);assert.match(html,/&amp;/);assert.match(html,/&#39;quoted&#39;/);
  assert.equal(/<(?:input|textarea|select|button)\b/i.test(html),false);assert.deepEqual(h.writes,[]);
});

test('rendering and sorting preserve frozen records, every stored source, and the current private view',()=>{
  const h=harness(),d=freeze(h.get(PREFIX+'uid-a')),before=JSON.stringify([...h.local]),current=h.c.doc,view=h.c.viewing;
  const rows=h.c.sqMatchRows(d);assert.equal(rows[0].record,d.matchSelf['match-a']);h.html();h.html();h.c.rSqMatches(h.other);
  assert.equal(JSON.stringify([...h.local]),before);assert.equal(h.c.doc,current);assert.equal(h.c.viewing,view);assert.deepEqual(h.writes,[]);
});
