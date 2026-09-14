'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function fn(n){const a=source.indexOf('function '+n+'('),b=source.indexOf('\nfunction ',a+1);assert.ok(a>=0&&b>a,n);return source.slice(a,b);}
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const clone=x=>JSON.parse(JSON.stringify(x));
function all(n){return [n,...n.children.flatMap(all)];}
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.value='';this.classList={contains:()=>false};this.attributes={};this._text='';this._html='';}
 appendChild(n){n.parent=this;this.children.push(n);return n;}
 addEventListener(){}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
 get isConnected(){return this.tagName==='body'||!!this.parent?.isConnected;}
 get textContent(){return this._text;}
 set textContent(v){this._text=v;this.children.forEach(x=>x.parent=null);this.children=[];}
 get innerHTML(){return this._html;}
 set innerHTML(v){this._html=v;this.children=[];for(const m of v.matchAll(/<(input|textarea|button|div)\b[^>]*\bid="([^"]+)"/g)){const e=new Element(m[1]);e.id=m[2];this.appendChild(e);}}
 querySelector(q){return all(this).find(n=>q[0]==='#'?n.id===q.slice(1):n.tagName===q)||null;}
 querySelectorAll(q){return all(this).filter(n=>q.split(',').includes(n.tagName));}
}
function harness(){
 let uid='A',wid='team-A',epoch='one',unlocked=true,perms={v:3,defaultRole:'player',staffEdit:'view',custom:{keep:1},members:{removed:{role:'player',playerId:'p'},other:{role:'staff',unknown:9}}};
 const seal=new Map([['owner','seal-A']]),body=new Element('body'),hooks={},effects=[],intervals=new Map(),timeouts=[],listeners={};let timerId=0;
 const rows=[{id:'team-A',name:'A team',kind:'team',role:'owner'},{id:'personal-A',kind:'personal',role:'owner'}];
 const c={Promise,JSON,Object,Array,Date,Error,String,Math,setInterval:f=>{intervals.set(++timerId,f);return timerId;},clearInterval:i=>intervals.delete(i),setTimeout:f=>{timeouts.push(f);return 1;},clearTimeout(){},
  signOutEpoch:0,OWNERKEY:'owner',getSess:()=>({uid,at:'token-'+uid}),activeWs:()=>wid,workspaceSwitchEpochRaw:()=>epoch,workspaceSwitchGuardRaw:()=>'',dataUnlocked:()=>unlocked,
  activeWsObj:()=>rows.find(r=>r.id===wid),wsList:()=>rows,setWsList:r=>effects.push(['list',clone(r)]),localStorage:{getItem:k=>seal.get(k)??null},dataLockError:()=>Object.assign(new Error('stale'),{psDataLocked:true}),
  document:{body,createElement:t=>new Element(t),getElementById:id=>all(body).find(n=>n.id===id)||null},esc:String,navigator:{share:o=>effects.push(['share',o])},
  addEventListener:(e,f)=>(listeners[e]??=[]).push(f),removeEventListener:(e,f)=>listeners[e]=(listeners[e]||[]).filter(x=>x!==f),
  getDisplayName:()=> 'A display name',setDisplayName:v=>effects.push(['name',v,uid]),createTeam:async v=>effects.push(['create',v,uid]),joinTeam:async v=>effects.push(['join',v,uid]),
  renameWorkspace:async(w,v)=>{effects.push(['rename',w,v,uid]);return v;},toast(){},
  forceSync:()=>hooks.pre?hooks.pre():Promise.resolve(),withTimeout:p=>p,leaveTeam:async w=>{effects.push(['leave',w,uid]);if(hooks.leave)return hooks.leave();},switchWorkspace:(w)=>effects.push(['switch',w,uid]),
  createRoleInvite:()=>hooks.invite?hooks.invite():Promise.resolve('CODE-A'),regenRoleInvite:async()=>{effects.push(['regen']);return 'NEW-CODE';},inviteMessage:(w,code)=>w+' '+code,psCopy:s=>{effects.push(['copy',s]);return true;},psCopied(){},
  BASE:'https://synthetic.invalid',hj:at=>({Authorization:at}),fetch:()=>hooks.audit?hooks.audit():Promise.resolve({ok:true,json:async()=>[]}),keyLabel:String,
  membersOf:()=>hooks.members?hooks.members():Promise.resolve([{user_id:'A',role:'owner',name:'Owner'},{user_id:'removed',role:'member',name:'Removed'}]),
  PSPerms:{get:()=>clone(perms),set:v=>{perms=clone(v);effects.push(['perms',clone(v)]);},ROLES:[{id:'player',label:'Player'},{id:'staff',label:'Staff'}]},
  askConfirm:()=>hooks.confirm?hooks.confirm():Promise.resolve(true),removeMember:async(w,u)=>{effects.push(['remove',w,u,uid]);if(hooks.remove)return hooks.remove();},syncNow:r=>effects.push(['sync',r]),setStatus(){},renderUI(){},chip(){},syncDiagnostic(){}};
 c.window=c;vm.createContext(c);vm.runInContext(['rpcContext','rpcCurrent','accountActionCurrent','accountActionWatch','psModal','uiRenameWs','uiSetName','uiCreateTeam','uiJoin','uiAudit','uiInvite','showInvite','uiMembers','uiLeave'].map(fn).join('\n'),c);
 return {c,body,hooks,effects,rows,intervals,get:()=>clone(perms),external:p=>perms=clone(p),find:id=>c.document.getElementById(id),button:label=>all(body).find(n=>n.tagName==='button'&&n.textContent===label),
  change(mode){if(mode==='account')uid='B';else if(mode==='team')wid='team-B';else if(mode==='epoch')epoch='two';else if(mode==='seal')seal.set('owner','new');else if(mode==='locked')unlocked=false;else if(mode==='role')rows[0].role='member';},
  check(){[...intervals.values()].forEach(f=>f());},timers(){timeouts.splice(0).forEach(f=>f());},event(e){(listeners[e]||[]).slice().forEach(f=>f({type:e}));},
  ok(value){const inp=c.document.getElementById('psWsIn');if(inp)inp.value=value||'';c.document.getElementById('psWsOk').onclick();}};
}
for(const action of ['uiCreateTeam','uiJoin','uiSetName','uiRenameWs','uiLeave'])test(action+' ignores an already-open confirmation after an account switch',async()=>{
 const h=harness();h.c[action]({id:'team-A',name:'A team'});const ok=h.find('psWsOk'),input=h.find('psWsIn');if(input)input.value='old intent';h.change('account');ok.onclick();await tick();assert.deepEqual(h.effects,[]);assert.equal(h.find('psWsModal'),null);
});
test('normal create/join/name/rename dialogs still apply the entered value',async()=>{
 for(const action of ['uiCreateTeam','uiJoin','uiSetName','uiRenameWs']){const h=harness();h.c[action]({id:'team-A',name:'A team'});h.ok('new name');if(action==='uiJoin')h.ok('A1B2C3D4');await tick();assert.ok(h.effects.some(x=>x[0]===({uiCreateTeam:'create',uiJoin:'join',uiSetName:'name',uiRenameWs:'rename'})[action]),action);}
});
for(const change of ['account','team','epoch','seal','locked'])test('open account modal clears its input and contents after '+change,()=>{
 const h=harness();h.c.uiSetName();const ov=h.find('psWsModal'),input=h.find('psWsIn');input.value='private A name';h.change(change);h.event('ps-auth-state');assert.equal(ov.isConnected,false);assert.equal(ov.textContent,'');assert.equal(input.value,'');assert.equal(h.intervals.size,0);
});
test('leave confirmation rechecks ownership after the preleave save and after the response',async()=>{
 for(const stage of ['pre','leave']){const h=harness(),g=deferred();h.hooks[stage]=()=>g.promise;h.c.uiLeave({id:'team-A',name:'A team'});h.ok();await tick();h.change('account');g.resolve();await tick();assert.equal(h.effects.some(x=>x[0]==='list'||x[0]==='switch'),false);assert.equal(h.effects.filter(x=>x[0]==='leave').length,stage==='pre'?0:1);}
});
test('same-owner leave refreshes membership and switches to the personal workspace',async()=>{
 const h=harness();h.c.uiLeave({id:'team-A',name:'A team'});h.ok();await tick();assert.deepEqual(h.effects.map(x=>x[0]),['leave','list','switch']);assert.equal(h.effects.at(-1)[1],'personal-A');
});
test('a stale audit response does not render old account activity',async()=>{
 const h=harness(),g=deferred();h.hooks.audit=()=>g.promise;h.c.uiAudit({id:'team-A'});h.change('account');g.resolve({ok:true,json:async()=>[{at:'2026-09-14',user_id:'A',k:'old-team-key',action:'update'}]});await tick();assert.equal(h.find('psWsModal'),null);
});
test('same-owner audit response remains visible',async()=>{
 const h=harness();h.c.uiAudit({id:'team-A'});await tick();assert.ok(h.find('psWsModal'));assert.ok(all(h.body).some(n=>n.innerHTML.includes('아직 기록이 없어요')));
});
test('a stale invite response never displays the old code',async()=>{
 const h=harness(),g=deferred();h.hooks.invite=()=>g.promise;h.c.uiInvite('team-A');h.change('account');g.resolve('SECRET-A');await tick();assert.equal(h.find('psWsModal'),null);
});
test('old invite copy/share/regenerate handlers cannot act after a team switch',()=>{
 const h=harness();h.c.showInvite('team-A','CODE-A','player');h.timers();const copy=h.find('psInvCode'),share=h.find('psInvShare'),regen=h.find('psInvRegen');h.change('team');copy.onclick();share.onclick();regen.onclick();assert.deepEqual(h.effects,[]);h.check();assert.equal(h.find('psWsModal'),null);
});
test('same-owner invite code copy remains available',()=>{
 const h=harness();h.c.showInvite('team-A','CODE-A','player');h.timers();h.find('psInvCode').onclick();assert.deepEqual(h.effects,[['copy','CODE-A']]);
});
test('late member list does not render after switching accounts',async()=>{
 const h=harness(),g=deferred();h.hooks.members=()=>g.promise;h.c.uiMembers({id:'team-A',name:'A'});h.change('account');g.resolve([{user_id:'A',name:'Private A',role:'owner'}]);await tick();assert.equal(h.find('psMemOv'),null);
});
for(const stage of ['confirm','remove'])test('member removal '+stage+' resumption cannot edit a later account permissions document',async()=>{
 const h=harness(),g=deferred();h.hooks[stage]=()=>g.promise;h.c.uiMembers({id:'team-A',name:'A'});await tick();h.button('내보내기').onclick();await tick();h.change('account');const b={members:{removed:{role:'admin'},B:{role:'staff'}},marker:'B-only'};h.external(b);g.resolve(true);await tick();assert.deepEqual(h.get(),b);assert.equal(h.effects.some(x=>x[0]==='perms'||x[0]==='sync'),false);assert.equal(h.effects.filter(x=>x[0]==='remove').length,stage==='confirm'?0:1);h.check();assert.equal(h.find('psMemOv'),null);
});
test('member removal preserves current unrelated permission edits and settings',async()=>{
 const h=harness(),g=deferred();h.hooks.remove=()=>g.promise;h.c.uiMembers({id:'team-A',name:'A'});await tick();h.button('내보내기').onclick();await tick();const latest=h.get();latest.members.other={role:'executive',scopes:['future'],unknown:42};latest.members.newer={role:'staff'};latest.custom={keep:2,newValue:'preserved'};h.external(latest);g.resolve(true);await tick();delete latest.members.removed;assert.deepEqual(h.get(),latest);assert.equal(h.effects.filter(x=>x[0]==='perms').length,1);assert.equal(h.effects.filter(x=>x[0]==='sync').length,1);
});
test('lost owner permission cancels an already-open member removal confirmation',async()=>{
 const h=harness(),g=deferred();h.hooks.confirm=()=>g.promise;h.c.uiMembers({id:'team-A',name:'A'});await tick();h.button('내보내기').onclick();h.change('role');g.resolve(true);await tick();assert.deepEqual(h.effects,[]);
});
test('lost owner permission closes audit/invite views and blocks rename confirmation',async()=>{
 for(const action of ['uiAudit','uiInvite','uiRenameWs']){const h=harness();h.c[action](action==='uiInvite'?'team-A':{id:'team-A',name:'A'});await tick();const ok=h.find('psWsOk');h.change('role');if(action==='uiRenameWs')ok.onclick();h.event('ps-sync-state');assert.equal(h.find('psWsModal'),null);assert.deepEqual(h.effects,[]);}
});
test('unscoped general modal remains usable without an account context',()=>{
 const h=harness();h.change('locked');let called=0;h.c.psModal({title:'General notice',onOk(){called++;}});h.ok();assert.equal(called,1);assert.equal(h.intervals.size,0);
});
