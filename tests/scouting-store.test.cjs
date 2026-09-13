const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../studio/scouting-store.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const legacy=()=>({v:1,players:[
 {id:'p1',type:'target',dbId:'db1',name:'가상 후보',club:'팀 A',grade:'A',posId:'ST',levels:{technical:4},memo:'첫 관찰',profile:{photo:'data:image/png;base64,fixture',height:'170'}},
 {id:'p2',type:'target',dbId:'db1',name:'가상 후보 다른 표기',club:'팀 B',grade:'B',posId:'LW',levels:{technical:2},memo:'다른 배치 관찰'},
 {id:'p3',type:'target',name:'연결 없는 후보',club:'팀 C',levels:{},memo:'기존 기록'}]});
const st=n=>({at:n,id:'event-'+n});
test('explicit candidate identity preserves multiple placement observations and conflicting values',()=>{
 const d=S.reconcile(null,legacy());assert.equal(Object.keys(d.scoutRegistry.candidates).length,2);
 assert.equal(d.players[0]._scoutRef.id,d.players[1]._scoutRef.id);
 const c=d.scoutRegistry.candidates['db:db1'];assert.equal(c.info.club,'팀 A');assert.ok(c.variants.some(v=>v.field==='club'&&v.value==='팀 B'));
 assert.equal(d.players[0].memo,'첫 관찰');assert.equal(d.players[1].levels.technical,2);assert.equal(d.players[2].memo,'기존 기록');
 assert.equal(d.players[0].profile.photo,undefined);assert.equal(d.players[1].profile.photo,undefined);assert.match(c.info.profile.photo,/fixture/);
 assert.deepEqual(S.reconcile(d,clone(d)),d,'stable reconciliation is idempotent');
});
test('local import is explicit, keeps original info alternatives, points, ratings, and question sets',()=>{
 const d=S.reconcile(null,legacy());const old={players:[{id:'db1',nameKr:'옛 DB 이름',club:'옛 팀',grade:'S',points:{'공격|질문':5},ratings:{전술:4},obs:[{memo:'현장 관찰'}]},{id:'other',nameKr:'선택 안함'}],meta:{pointSets:[{name:'공격',text:'질문'}]}};
 S.importLegacy(d,old,['db1'],true);const c=d.scoutRegistry.candidates['db:db1'];assert.equal(c.info.club,'팀 A');assert.ok(c.variants.some(v=>v.value==='옛 팀'));assert.equal(c.points['공격|질문'],5);assert.equal(c.ratings.전술,4);assert.equal(c.source.obs[0].memo,'현장 관찰');assert.equal(d.scoutRegistry.candidates['db:other'],undefined);assert.deepEqual(old.players[0].grade,'S');
});
test('explicit field selection and clearing retain previous and blank alternatives',()=>{
 const d=S.reconcile(null,legacy());S.edit(d,'db:db1','club','선택한 팀',st(1));assert.ok(d.scoutRegistry.candidates['db:db1'].variants.some(v=>v.field==='club'&&v.value==='팀 A'));
 S.edit(d,'db:db1','club','',st(2));S.edit(d,'db:db1','club','새 팀',st(3));assert.ok(d.scoutRegistry.candidates['db:db1'].variants.some(v=>v.field==='club'&&v.value===''));
 const incoming=clone(d);S.edit(incoming,'db:db1','club','다른 기기 명시 변경',st(4));const merged=S.reconcile(d,incoming);assert.equal(merged.scoutRegistry.candidates['db:db1'].info.club,'다른 기기 명시 변경');assert.ok(merged.scoutRegistry.candidates['db:db1'].variants.some(v=>v.value==='새 팀'));
});
test('archive survives older client players and restore retains original placement IDs and scores',()=>{
 const d=S.reconcile(null,legacy());S.archive(d,'db:db1',100,st(100));const merged=S.reconcile(d,legacy());assert.equal(merged.scoutRegistry.candidates['db:db1'].archivedAt,100);assert.ok(merged.players.filter(p=>p.dbId==='db1').every(p=>p._scoutHidden));
 S.archive(merged,'db:db1',0,st(101));const restored=S.reconcile(d,merged);assert.equal(restored.scoutRegistry.candidates['db:db1'].archivedAt,0);assert.equal(restored.players[0].id,'p1');assert.equal(restored.players[0].levels.technical,4);assert.equal(restored.players[1].memo,'다른 배치 관찰');
});
test('older clients cannot erase registry, historical sources, scores, or removed observations',()=>{
 const d=S.reconcile(null,legacy());const c=d.scoutRegistry.candidates['db:db1'];c.points={'질문':4};c.scoreHistory=[{kind:'points',key:'옛 질문',value:2}];c.sourceHistory=[{bio:'이전 원문'}];d.scoutRegistry.meta={pointSets:[{name:'그룹',text:'질문'}]};d.scoutRegistry.metaHistory=[{pointSets:[{name:'옛 그룹',text:'옛 질문'}]}];
 const old={v:1,players:[clone(legacy().players[0])]};const merged=S.reconcile(d,old);assert.equal(merged.players.length,3);assert.ok(merged.players[1]._scoutHidden);assert.deepEqual(merged.scoutRegistry.meta,d.scoutRegistry.meta);
 const next=clone(d);next.scoutRegistry.candidates['db:db1'].scoreHistory.push({kind:'points',key:'다른 과거',value:3});next.scoutRegistry.candidates['db:db1'].sourceHistory.push({bio:'다른 원문'});next.scoutRegistry.metaHistory.push({pointSets:[{name:'다른 그룹',text:'다른 질문'}]});const m=S.reconcile(d,next);assert.equal(m.scoutRegistry.candidates['db:db1'].sourceHistory.length,2);assert.equal(m.scoutRegistry.candidates['db:db1'].scoreHistory.length,2);assert.equal(m.scoutRegistry.metaHistory.length,2);
});
test('unsupported versions, duplicate identities, mismatched references and unsafe fields fail closed',()=>{
 for(const d of [{v:2,players:[]},{v:1,players:[{id:'p',type:'target'},{id:'p',type:'target'}]},{v:1,players:[{id:'p',dbId:'one',_scoutRef:{id:'db:two'}}]},JSON.parse('{"players":[{"id":"p","profile":{"__proto__":{}}}]}'),{players:[],scoutRegistry:{v:2,candidates:{},meta:{}}}])assert.throws(()=>S.reconcile(null,d));assert.equal({}.polluted,undefined);
});
function clientFixture(){
 const values=new Map([['ps_sync_session',JSON.stringify({uid:'u'})],['ps_active_ws','w'],['ps_cache_owner_v1',JSON.stringify({uid:'u',wid:'w',nonce:'n'})],['ps_ws_list',JSON.stringify([{id:'w',kind:'team',role:'owner'}])],[S.KEY,JSON.stringify(legacy())]]);let durable=values.get(S.KEY),writes=0,fail=false,ready=true,role='executive';
 const win={localStorage:{getItem:k=>values.get(k)??null},PSSync:{dataUnlocked:()=>true,keyReady:()=>ready},PSPerms:{role:()=>role,canEdit:()=>true},PSStorage:{sharedReady:()=>Promise.resolve(),sharedVerified:(k,raw)=>fail||raw!==durable?Promise.reject(new Error('disk')):Promise.resolve()},storage:{get:()=>Promise.resolve(durable?{value:durable}:null)},psSaveShared:(k,raw)=>{writes++;values.set(k,raw);if(!fail)durable=raw;return true;}};win.parent=win;
 return {win,values,client:S.createClient(win),writes:()=>writes,setRole:v=>role=v,setReady:v=>ready=v,setFail:v=>fail=v};
}
test('client requires verified IDB, owner, executive role, and received key before mutation',async()=>{
 const f=clientFixture();assert.throws(()=>f.client.save(legacy()));await f.client.prepare();f.setRole('staff');assert.throws(()=>f.client.save(legacy()));f.setRole('executive');f.setReady(false);assert.throws(()=>f.client.save(legacy()));f.setReady(true);f.values.set('ps_active_ws','other');assert.throws(()=>f.client.save(legacy()));assert.equal(f.writes(),0);
});
test('client detects stale storage and failed durable writes without allowing subsequent writes',async()=>{
 const f=clientFixture();await f.client.prepare();f.values.set(S.KEY,JSON.stringify({v:1,players:[]}));assert.throws(()=>f.client.save(legacy()));assert.equal(f.writes(),0);
 const g=clientFixture();await g.client.prepare();g.setFail(true);await assert.rejects(g.client.save(legacy()));assert.equal(g.client.state.verified,false);assert.throws(()=>g.client.save(legacy()));assert.equal(g.writes(),1);
});

test('profile deletion token survives JSON transport and repeated old-client reconciliation',()=>{
 const previous=S.reconcile(null,legacy()), next=clone(previous);S.edit(next,'db:db1','profile.photo',undefined,st(9));
 const transported=clone(next), merged=S.reconcile(previous,transported);assert.equal(merged.scoutRegistry.candidates['db:db1'].info.profile.photo,undefined);
 assert.ok(merged.scoutRegistry.candidates['db:db1'].variants.some(v=>v.field==='profile.photo'&&/fixture/.test(v.value)));
 let current=merged;for(let i=0;i<8;i++)current=S.reconcile(current,transported);assert.deepEqual(current,merged);
 current=S.reconcile(current,legacy());assert.equal(current.scoutRegistry.candidates['db:db1'].info.profile.photo,undefined);
});
test('explicit source edits win while legacy source alternatives stay in history',()=>{
 const previous=S.reconcile(null,legacy());S.importLegacy(previous,{players:[{id:'db1',oneliner:'old',contacts:[{name:'one'}]}]},['db1'],false);
 const next=clone(previous);next.scoutRegistry.candidates['db:db1'].source={oneliner:'new',contacts:[]};next.scoutRegistry.candidates['db:db1'].sourceEdit=st(10);
 const merged=S.reconcile(previous,next),c=merged.scoutRegistry.candidates['db:db1'];assert.equal(c.source.oneliner,'new');assert.equal(c.source.contacts.length,0);assert.equal(c.sourceHistory[0].oneliner,'old');
 assert.deepEqual(S.reconcile(merged,next),merged);S.importLegacy(merged,{players:[{id:'db1',oneliner:'legacy'}]},['db1'],false);assert.equal(merged.scoutRegistry.candidates['db:db1'].source.oneliner,'new');assert.ok(merged.scoutRegistry.candidates['db:db1'].sourceHistory.some(s=>s.oneliner==='legacy'));
});
test('same placement legacy observations survive migration and explicit unplacement survives replay',()=>{
 const previous=legacy(),next=S.reconcile(null,legacy());previous.players[0].name='main에만 남은 이름';next.players[0].memo='new memo';next.players[0].levels.technical=1;next.players[0].posId='';next.players[0]._scoutMove=st(20);
 const merged=S.reconcile(previous,next);assert.ok(merged.scoutRegistry.candidates['db:db1'].variants.some(v=>v.value==='main에만 남은 이름'));assert.equal(merged.players[0].memo,'new memo');assert.equal(merged.players[0].posId,'');assert.ok(merged.scoutRegistry.placementHistory.p1.some(h=>h.memo==='첫 관찰'&&h.levels.technical===4));
 const replay=S.reconcile(merged,previous);assert.equal(replay.players[0].posId,'');assert.ok(replay.scoutRegistry.placementHistory.p1.some(h=>h.memo==='new memo'&&h.levels.technical===1));
 assert.deepEqual(S.reconcile(replay,previous),replay);
});

test('registry omission unions independent new candidates and placements without hiding them',()=>{
 const base=S.reconcile(null,legacy());const l=clone(base),r=clone(base);
 l.players.push({id:'local-new',type:'target',name:'local new',posId:'LW',memo:'local observation'});
 r.players.push({id:'remote-new',type:'target',name:'remote new',posId:'RW',memo:'remote observation'});
 const local=S.reconcile(base,l),remote=S.reconcile(base,r),merged=S.reconcile(remote,local);
 assert.ok(merged.players.filter(p=>p.id.endsWith('-new')).every(p=>!p._scoutHidden));assert.equal(merged.players.find(p=>p.id==='remote-new').memo,'remote observation');
 assert.deepEqual(S.reconcile(merged,clone(merged)),merged);
 const hidden=clone(remote);S.archive(hidden,'target:remote-new',100,st(100));const archived=S.reconcile(hidden,local);assert.equal(archived.players.find(p=>p.id==='remote-new')._scoutHidden,true);assert.equal(archived.scoutRegistry.candidates['target:remote-new'].archivedAt,100);
 const legacyIncoming={v:1,players:clone(legacy().players)};assert.equal(S.reconcile(remote,legacyIncoming).players.find(p=>p.id==='remote-new')._scoutHidden,true,'players-only legacy omission is preserved as hidden');
});

test('client accepts the exact length limit and rejects over-limit data before storage changes',async()=>{
 async function sized(n){const f=clientFixture();await f.client.prepare();const d=clone(f.client.state.doc);d.scoutRegistry.candidates['db:db1'].source={padding:''};const length=JSON.stringify(S.reconcile(f.client.state.doc,d)).length;d.scoutRegistry.candidates['db:db1'].source.padding='x'.repeat(n-length);assert.equal(JSON.stringify(S.reconcile(f.client.state.doc,d)).length,n);return {f,d};}
 const at=await sized(S.MAXLEN);await at.f.client.save(at.d);assert.equal(at.f.values.get(S.KEY).length,S.MAXLEN);assert.equal(at.f.writes(),1);
 const over=await sized(S.MAXLEN+1),before=clone(over.f.client.state.doc),raw=over.f.values.get(S.KEY);assert.throws(()=>over.f.client.save(over.d),/저장 한도/);assert.equal(over.f.writes(),0);assert.equal(over.f.values.get(S.KEY),raw);assert.deepEqual(over.f.client.state.doc,before);assert.equal(over.f.client.state.verified,true);
 // The board edits its live projected profile before calling save. Rejection
 // must not leave that unaccepted photo in canonical variants on a later edit.
 const live=clientFixture();await live.client.prepare();const accepted=clone(live.client.state.doc);S.edit(live.client.state.doc,'db:db1','profile.photo','data:'+('x'.repeat(S.MAXLEN)),st(600));assert.throws(()=>live.client.save(live.client.state.doc),/저장 한도/);assert.deepEqual(live.client.state.doc,accepted);S.edit(live.client.state.doc,'db:db1','club','small edit after rejection',st(601));await live.client.save(live.client.state.doc);assert.equal(live.writes(),1);
});
