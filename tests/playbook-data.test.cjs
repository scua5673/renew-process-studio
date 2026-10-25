const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../studio/playbook-data.js');
const model=()=>({identity:'팀',custom:{deep:1},open:{a:true},moments:[{key:'a',name:'공격',meta:9,phases:[{id:'p1',name:'전개',principles:['문자 원칙',{text:'객체 원칙',why:'관찰',how:'추가 설명',id:'principle-id',extra:3}],snap:{frames:[{tokens:[1]}]},custom:[4]},{id:'p2',name:'전진',principles:[]}]},{key:'b',name:'수비',phases:[]}]});
test('principle edits preserve every unrelated field, legacy key, scene and ID without mutating source',()=>{
 const original=model(),before=structuredClone(original),p=original.moments[0].phases[0];
 const next=P.apply(original,{type:'principle.edit',phase:'p1',index:1,before:p.principles[1],title:'새 원칙',detail:'새 관찰'});
 assert.deepEqual(original,before);const expected=structuredClone(original);expected.moments[0].phases[0].principles[1].text='새 원칙';expected.moments[0].phases[0].principles[1].why='새 관찰';assert.deepEqual(next,expected);
 const str=P.apply(original,{type:'principle.edit',phase:'p1',index:0,before:'문자 원칙',title:'고친 문자',detail:''});assert.equal(str.moments[0].phases[0].principles[0],'고친 문자');
});
test('rename/reorder/add keep stable phase keys, hidden media and foreign metadata',()=>{
 let next=P.apply(model(),{type:'phase.rename',phase:'p1',before:'전개',name:'후방 전개'});
 next=P.apply(next,{type:'phase.move',phase:'p1',dir:1});assert.deepEqual(next.moments[0].phases.map(p=>p.id),['p2','p1']);assert.deepEqual(next.moments[0].phases[1].snap,model().moments[0].phases[0].snap);
 next=P.apply(next,{type:'phase.add',moment:'b',id:'new-phase',name:'압박'});assert.equal(next.moments[1].phases[0].id,'new-phase');assert.deepEqual(next.custom,{deep:1});
 assert.throws(()=>P.apply(next,{type:'phase.add',moment:'b',id:'p1',name:'중복'}),/다른 곳/);
});
test('concurrent field edits and malformed documents cannot silently overwrite data',()=>{
 const m=model(),old=structuredClone(m.moments[0].phases[0].principles[1]);m.moments[0].phases[0].principles[1].text='새로운 문장';
 assert.throws(()=>P.apply(m,{type:'principle.edit',phase:'p1',index:1,before:old,title:'옛 초안'}),/다른 곳/);
 assert.throws(()=>P.apply(m,{type:'phase.rename',phase:'gone',name:'새 이름'}),/찾을 수/);
 assert.throws(()=>P.apply({unexpected:[1]},{type:'moment.add',id:'x',name:'공격'}),/형식/);
 assert.throws(()=>P.term({unexpected:1},{type:'add',id:'t',word:'새 용어'}),/형식/);
});
test('term edits retain all layers, unrelated links and metadata; unlink never deletes a term',()=>{
 const doc={v:9,custom:'keep',items:[{id:'t',l:'concept',g:'수비',en:'Press',ko:'압박',d:'설명',ph:['p1','other'],unknown:9}]};
 const linked=P.term(doc,{type:'link',id:'t',phase:'p2'}),unlinked=P.term(linked,{type:'unlink',id:'t',phase:'p1'});assert.deepEqual(unlinked.items[0].ph,['other','p2']);assert.equal(unlinked.items[0].l,'concept');assert.equal(unlinked.items.length,1);assert.equal(unlinked.custom,'keep');assert.equal(doc.items[0].ph.length,2);
 const edited=P.term(unlinked,{type:'edit',id:'t',before:{en:'Press',ko:'압박',d:'설명'},word:'Go',meaning:'가자',detail:'새 설명'});assert.deepEqual(edited.items[0].ph,['other','p2']);assert.equal(edited.items[0].unknown,9);
});
test('library linking keeps whole latest items and aligns cached names on unlink',()=>{
 const list=[{libId:'a',createdBy:'owner',latest:42,drill:{gmPhases:['old'],gmPhaseNames:['옛 국면'],frames:[1]}},{libId:'b',foreign:1}];const other=structuredClone(list[1]);
 P.linkDrill(list,{libId:'a',phase:'new',name:'새 국면'});assert.deepEqual(list[0].drill.gmPhases,['old','new']);assert.deepEqual(list[0].drill.frames,[1]);assert.deepEqual(list[1],other);assert.equal(list[0].latest,42);
 P.linkDrill(list,{libId:'a',phase:'old',remove:true});assert.deepEqual(list[0].drill.gmPhaseNames,['새 국면']);assert.deepEqual(list[0].drill.gmPhases,['new']);assert.throws(()=>P.linkDrill(list,{libId:'gone',phase:'p'}),/찾을 수/);
});
test('legacy wrapped library links keep their original field location and never resurrect a detached fallback',()=>{
 const root={libId:'root',gmPhases:['old'],gmPhaseNames:['예전'],drill:{frames:[1]}};
 P.linkDrill([root],{libId:'root',phase:'next',name:'다음'});assert.deepEqual(root.gmPhases,['old','next']);assert.equal(root.drill.gmPhases,undefined);
 const both={libId:'both',gmPhases:['stale'],drill:{gmPhases:['real'],gmPhaseNames:['현재']}};
 P.linkDrill([both],{libId:'both',phase:'real',remove:true});assert.deepEqual(both.drill.gmPhases,[]);assert.deepEqual(both.gmPhases,['stale']);
});
const vm=require('node:vm'),fs=require('node:fs');
function shell(){
 const ls=new Map([['ps_active_ws','a'],['ps_cache_owner_v1','seal']]),acks=[],writes=[];let callback,allowed=true,itemAllowed=true;
 const list=[{libId:'d',value:9}],board={libTurn:fn=>Promise.resolve().then(fn),libGet:async()=>list,canEditItem:()=>itemAllowed,libWrite:async v=>writes.push(structuredClone(v)),libTouch(){}};
 ls.set('cs_gamemodel_v1',JSON.stringify(model()));
 const ctx={window:null,localStorage:{getItem:k=>ls.get(k)||null},PSSync:{session:()=>({uid:'u'}),dataUnlocked:()=>true},PSPerms:{canEdit:()=>allowed},PSPlaybookData:P,location:{origin:'https://fixture.invalid'},document:{getElementById:()=>({contentWindow:board})}};ctx.window=ctx;vm.runInNewContext(fs.readFileSync(require.resolve('../studio/playbook-shell.js'),'utf8'),ctx);
 return {ls,acks,writes,list,deny:()=>allowed=false,denyItem:()=>itemAllowed=false,start:()=>ctx.PSPlaybookLink({libId:'d',phase:'p1',requestId:'r'}, {postMessage:m=>acks.push(m)},cb=>callback=cb),run:async()=>{callback();await new Promise(r=>setImmediate(r));}};
}
test('queued library mutation rejects team changes and item permissions without writing',async()=>{
 const switched=shell();switched.start();switched.ls.set('ps_ws_switch_epoch_v1','changed');await switched.run();assert.equal(switched.writes.length,0);assert.equal(switched.acks[0].ok,false);
 const denied=shell();denied.denyItem();denied.start();await denied.run();assert.equal(denied.writes.length,0);assert.equal(denied.acks[0].ok,false);
});
test('queued library mutation reads the newest item and acknowledges only after storage resolves',async()=>{
 const s=shell();s.start();s.list[0].value=42;await s.run();assert.equal(s.writes[0][0].value,42);assert.deepEqual(s.writes[0][0].gmPhases,['p1']);assert.equal(s.acks[0].ok,true);
});
