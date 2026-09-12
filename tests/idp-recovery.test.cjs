'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../studio/idp-recovery.js');
const clone=v=>JSON.parse(JSON.stringify(v));
const doc=(extra={})=>({v:1,...extra});
function frozen(v){if(v&&typeof v==='object'){Object.values(v).forEach(frozen);Object.freeze(v);}return v;}
function storage(seed={}){
  const values=new Map(Object.entries(seed)),writes=[];
  return {values,writes,getItem:k=>values.has(k)?values.get(k):null,setItem(k,v){writes.push(['set',k]);values.set(k,String(v));},removeItem(k){writes.push(['remove',k]);values.delete(k);}};
}
function harness({local,session,owner}={}){
  const state={uid:'athlete-a',wid:'team-a',key:'cs_idp_v1_athlete-a',...(owner||{})};
  const ls=local||storage(),ss=session||storage();
  const c=R.create({window:{localStorage:ls,sessionStorage:ss},owner:()=>state.allowed===false?null:state,blank:()=>doc(),applied(){},resume(){}});
  return {c,state,ls,ss};
}
test('ordinary edits become disjoint field patches and leave source objects unchanged',()=>{
  const base=frozen(doc({log:{'2026-09-12':{memo:'before',rpe:4}},profile:{name:'Lee'}}));
  const draft=frozen(doc({log:{'2026-09-12':{memo:'mine',rpe:4}},profile:{name:'Lee'}}));
  const ops=R.diff(base,draft);assert.equal(ops.length,1);assert.deepEqual(ops[0].path,['log','2026-09-12','memo']);
  const latest=frozen(doc({log:{'2026-09-12':{memo:'before',rpe:8}},profile:{name:'New name'}}));
  const result=R.resolve(ops,latest,{0:'mine'});
  assert.equal(result.log['2026-09-12'].memo,'mine');assert.equal(result.log['2026-09-12'].rpe,8);assert.equal(result.profile.name,'New name');
  assert.equal(base.log['2026-09-12'].memo,'before');
});
test('same-field changes require a choice and preserve either exact value',()=>{
  const ops=R.diff(doc({profile:{name:'before'}}),doc({profile:{name:'mine'}}));
  const latest=doc({profile:{name:'remote'}});
  assert.equal(R.plan(ops,latest)[0].status,'conflict');assert.throws(()=>R.resolve(ops,latest,{}));
  assert.equal(R.resolve(ops,latest,{0:'latest'}).profile.name,'remote');assert.equal(R.resolve(ops,latest,{0:'mine'}).profile.name,'mine');
});
test('identical already-saved values are idempotent',()=>{
  const a=doc({log:{day:{memo:'a'}}}),b=doc({log:{day:{memo:'b'}}}),ops=R.diff(a,b);
  assert.equal(R.plan(ops,b)[0].status,'applied');assert.deepEqual(R.resolve(ops,b,{}),b);
});
test('deletion differs from an explicit null or empty string',()=>{
  const a=doc({profile:{name:'a',role:'defender'}}),b=doc({profile:{role:'defender'}}),ops=R.diff(a,b);
  assert.deepEqual(ops[0].after,{has:false});
  assert.ok(!Object.hasOwn(R.resolve(ops,a,{0:'mine'}).profile,'name'));
  for(const value of [null,''])assert.equal(R.plan(ops,doc({profile:{name:value,role:'defender'}}))[0].status,'conflict');
});
test('arrays and vision revisions are atomic and never index-merged',()=>{
  const a=doc({profile:{roles:['A','B']},vision:{statement:'a',revision:'old',behaviors:[{id:'a',text:'one'}]}});
  const b=clone(a);b.profile.roles=['B'];b.vision.statement='mine';
  const ops=R.diff(a,b);assert.deepEqual(ops.map(x=>x.path),[['profile','roles'],['vision']]);
  const latest=clone(a);latest.profile.roles=['C','A','B'];latest.vision.revision='remote';
  assert.ok(R.plan(ops,latest).every(x=>x.status==='conflict'));
  const result=R.resolve(ops,latest,{0:'latest',1:'latest'});assert.deepEqual(result,latest);
});
test('changed or deleted parent containers cannot silently be classified safe',()=>{
  const a=doc({profile:{}}),b=doc({profile:{name:'mine'}}),ops=R.diff(a,b);
  for(const latest of [doc({profile:'remote'}),doc({profile:[]}),doc(),doc({profile:null})]){
    assert.ok(R.plan(ops,latest).every(x=>!['safe','applied'].includes(x.status)));
    assert.throws(()=>R.resolve(ops,latest,{}));
  }
});
test('malformed documents, unsupported versions and prototype paths fail closed',()=>{
  for(const bad of [null,[],{},doc({v:2})]){assert.throws(()=>R.diff(bad,doc()));assert.throws(()=>R.plan([],bad));}
  for(const path of [['__proto__','polluted'],['profile','constructor'],['v'],[]])assert.throws(()=>R.resolve([{path,before:{has:false},after:{has:true,value:'bad'}}],doc(),{0:'mine'}));
  assert.equal({}.polluted,undefined);
});
test('display labels keep internal identifiers and image data out of comparisons',()=>{
  assert.match(R.label(['log','2026-09-12','memo']),/2026.09.12.*한 줄 기록/);
  assert.equal(R.display({has:false}),'내용 없음');assert.equal(R.display({has:true,value:'data:image/png;base64,private'}),'사진·이미지 자료');
  const shown=R.display({has:true,value:{statement:'My action',revision:'private-revision',history:[{statement:'old'}]}});
  assert.match(shown,/My action/);assert.doesNotMatch(shown,/private-revision|old/);
});
test('draft capture writes only a local recovery key and survives same-tab reload',()=>{
  const h=harness(),base=doc({profile:{name:'a'}}),draft=doc({profile:{name:'mine'}});
  h.ls.values.set(h.state.key,JSON.stringify(base));assert.equal(h.c.capture(base,draft,'normal'),true);
  assert.ok(h.c.key().startsWith(R.prefix));assert.equal(h.ls.getItem(h.state.key),JSON.stringify(base));
  assert.ok(h.ls.writes.every(x=>x[1].startsWith(R.prefix)));
  const reload=harness({local:h.ls,session:h.ss});reload.c.refresh();assert.deepEqual(reload.c.record().pending.ops,h.c.record().pending.ops);
});
test('different tabs and different owners do not share pending drafts',()=>{
  const h=harness(),a=doc({profile:{name:'a'}}),b=doc({profile:{name:'mine'}});h.c.capture(a,b);
  const key=h.c.key(),otherTab=harness({local:h.ls});otherTab.c.refresh();assert.notEqual(otherTab.c.key(),key);assert.equal(otherTab.c.record(),null);
  h.state.uid='athlete-b';h.state.key='cs_idp_v1_athlete-b';h.c.refresh();assert.equal(h.c.record(),null);assert.ok(h.ls.getItem(key));
  h.state.uid='athlete-a';h.state.key='cs_idp_v1_athlete-a';h.state.wid='team-b';h.c.refresh();assert.equal(h.c.record(),null);
});
test('locked owner never writes and hides earlier pending content',()=>{
  const h=harness(),a=doc({profile:{name:'a'}}),b=doc({profile:{name:'mine'}});h.c.capture(a,b);const count=h.ls.writes.length;
  h.state.allowed=false;h.c.refresh();assert.equal(h.c.record(),null);assert.equal(h.c.capture(a,b),false);assert.equal(h.ls.writes.length,count);
});
test('successful ordinary save clears only the exactly applied pending draft',()=>{
  const h=harness(),a=doc({profile:{name:'a'}}),b=doc({profile:{name:'mine'}});h.c.capture(a,b);const key=h.c.key();
  h.ls.values.set(h.state.key,JSON.stringify(a));h.c.saved();assert.ok(h.c.record().pending);
  h.ls.values.set(h.state.key,JSON.stringify(b));h.c.saved();assert.equal(h.c.record(),null);assert.equal(h.ls.getItem(key),null);
});
test('reverting an unsaved edit clears the stale pending change',()=>{
  const h=harness(),a=doc({profile:{name:'a'}}),b=doc({profile:{name:'mine'}});h.c.capture(a,b);h.c.capture(a,a);
  assert.ok(!h.c.record()||!h.c.record().pending);
});
test('write failures preserve in-memory draft and never overwrite the IDP',()=>{
  const h=harness(),a=doc({profile:{name:'a'}}),b=doc({profile:{name:'mine'}});h.ls.values.set(h.state.key,JSON.stringify(a));
  h.ls.setItem=()=>{throw Error('quota');};assert.equal(h.c.capture(a,b),false);assert.ok(h.c.record().pending);assert.equal(h.ls.getItem(h.state.key),JSON.stringify(a));
});
test('corrupt or externally changed recovery records are not silently replaced',()=>{
  const h=harness(),a=doc({profile:{name:'a'}}),b=doc({profile:{name:'mine'}});h.c.capture(a,b);const key=h.c.key();
  h.ls.values.set(key,'CORRUPTED');assert.equal(h.c.capture(a,doc({profile:{name:'new'}})),false);assert.equal(h.ls.getItem(key),'CORRUPTED');
});
test('last recovery renders the retained latest parent when its structure changed',()=>{
  const ls=storage(),ss=storage(),owner={uid:'athlete-a',wid:'team-a',key:'cs_idp_v1_athlete-a'};
  ss.setItem('ps_idp_recovery_tab_v1','tab-fixture');
  const ops=R.diff(doc({profile:{}}),doc({profile:{name:'MY DRAFT'}}));
  ls.setItem(R.prefix+'athlete-a:team-a:tab-fixture',JSON.stringify({v:1,...owner,resolved:{ops,previous:[{path:['profile'],value:{has:true,value:'LATEST PARENT VALUE'}}]}}));
  const host={innerHTML:'',hidden:false,querySelector:()=>null,querySelectorAll:()=>[]};
  const recovery=R.create({window:{localStorage:ls,sessionStorage:ss,document:{getElementById:()=>host}},owner:()=>owner,blank:()=>doc(),applied(){},resume(){}});
  recovery.refresh();assert.equal(host.hidden,false);assert.match(host.innerHTML,/LATEST PARENT VALUE/);assert.match(host.innerHTML,/MY DRAFT/);
  assert.equal(ls.getItem(owner.key),null,'reading recovery history never writes the IDP');
});
