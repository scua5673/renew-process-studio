'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const O=require('../studio/shared-view-observation.js');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',S='cccccccc-cccc-4ccc-8ccc-cccccccccccc',W='11111111-1111-4111-8111-111111111111',W2='22222222-2222-4222-8222-222222222222';
const tick=()=>new Promise(r=>setImmediate(r));
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function surface(){
  const handlers={},doc={visibilityState:'visible',addEventListener(n,f){handlers[n]=f;},removeEventListener(n){delete handlers[n];}};
  const w={document:doc,innerWidth:820,innerHeight:1180,getComputedStyle:n=>n.style,addEventListener(n,f){handlers[n]=f;},removeEventListener(n){delete handlers[n];}};w.parent=w;
  function node(top=100,height=300,parentElement=null){const n={isConnected:true,ownerDocument:doc,parentElement,hidden:false,attrs:{},style:{display:'block',visibility:'visible',opacity:'1',overflowX:'visible',overflowY:'visible'},
    rect:{left:0,top,width:700,height,right:700,bottom:top+height},getBoundingClientRect(){return this.rect;},getAttribute(k){return this.attrs[k]||null;},querySelectorAll(){return [];}};return n;}
  doc.documentElement=node(0,1180);const section=node(200,500,doc.documentElement),record=node(250,200,section);section.querySelectorAll=()=>[record];
  return {w,doc,node,section,record,handlers};
}
function fixture(){
  const x=surface(),parent=surface(),frame=parent.node(0,1180,parent.doc.documentElement);x.w.parent=parent.w;x.w.frameElement=frame;
  const context={uid:A,wid:W,subject:S,kind:'player_matches',state:'ready',role:'executive',seal:'generation-1',element:x.section};
  return {...x,parent,frame,context};
}
function client(){
  const h=fixture(),requests=[],local=new Map(),frames=new Map(),hooks={};let at=1800000000000,next=0;
  const storage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)};
  const options={window:h.w,storage,now:()=>at,context:()=>hooks.context?hooks.context():h.context,
    requestAnimationFrame(fn){const id=++next;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},
    send(body,valid){requests.push({body,valid});return hooks.send?hooks.send(body,valid):Promise.resolve(true);}};
  const c=O.createClient(options);
  return {...h,c,requests,local,frames,hooks,options,time(v){at=v;},async paint(){const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f());await tick();}};
}
test('visible ready screen reports only workspace, subject and fixed view kind',async()=>{
  const h=client();assert.equal(O.visible(h.context,h.w),true);assert.equal(await h.c.check(),true);
  assert.deepEqual(h.requests[0].body,{p_workspace_id:W,p_subject_user_id:S,p_view_kind:'player_matches'});
  assert.equal(Object.keys(h.requests[0].body).length,3);
});
for(const state of ['empty','pending','unlinked','ambiguous','invalid','unavailable'])test(state+' never reports',async()=>{
  const h=client();h.context.state=state;assert.equal(await h.c.check(),false);assert.equal(h.requests.length,0);
});
for(const [name,change] of [
  ['own document',h=>h.context.subject=A],['hidden tab',h=>h.doc.visibilityState='hidden'],
  ['hidden parent tab',h=>h.parent.doc.visibilityState='hidden'],['hidden iframe',h=>h.frame.style.display='none'],
  ['iframe opacity zero',h=>h.frame.style.opacity='0'],['hidden iframe ancestor',h=>h.parent.doc.documentElement.style.visibility='hidden'],
  ['hidden record ancestor',h=>h.section.style.display='none'],['disconnected old render',h=>h.section.isConnected=false],
  ['record below viewport',h=>{h.record.rect.top=1400;h.record.rect.bottom=1600;}],
  ['record clipped by scrolling panel',h=>{h.section.style.overflowY='auto';h.section.rect.height=20;h.section.rect.bottom=220;}],
  ['no actual records',h=>h.section.querySelectorAll=()=>[]]
])test(name+' never reports',async()=>{const h=client();change(h);assert.equal(await h.c.check(),false);assert.equal(h.requests.length,0);});
test('cross-origin/unreadable frame visibility fails closed',()=>{
  const h=fixture();Object.defineProperty(h.w,'frameElement',{get(){throw Error('cross origin');}});assert.equal(O.visible(h.context,h.w),false);
});
test('duplicate suppression covers rerenders, reload and slow/failed requests for five minutes',async()=>{
  const h=client(),g=gate();h.hooks.send=()=>g.promise;const first=h.c.check();await tick();
  assert.equal(await h.c.check(),false);assert.equal(h.requests.length,1);g.reject(Error('network'));assert.equal(await first,false);
  delete h.hooks.send;const reloaded=O.createClient(h.options);assert.equal(await reloaded.check(),false);
  h.time(1800000000000+300001);assert.equal(await reloaded.check(),true);assert.equal(h.requests.length,2);
});
test('dedup is separated by actor, workspace and subject',async()=>{
  const h=client();await h.c.check();h.context.uid=B;await h.c.check();h.context.wid=W2;await h.c.check();h.context.subject=A;await h.c.check();assert.equal(h.requests.length,4);
});
for(const change of ['uid','wid','subject','seal','role','element'])test('late render callback cannot report after '+change+' changes',async()=>{
  const h=client();h.c.watch();h.context[change]=change==='uid'?B:change==='wid'?W2:change==='subject'?B:change==='element'?h.node(): 'changed';
  await h.paint();assert.equal(h.requests.length,0);
});
test('delayed authenticated transport callback rechecks hidden frame and ownership',async()=>{
  const h=client(),g=gate();let transmitted=0;
  h.hooks.send=async(body,valid)=>{await g.promise;if(!valid())return false;transmitted++;return true;};
  const run=h.c.check();await tick();h.frame.style.display='none';g.resolve();assert.equal(await run,false);assert.equal(transmitted,0);
});
test('a frame shown after initial hidden render can be observed without changing content',async()=>{
  const h=client();h.frame.style.display='none';h.c.watch();await h.paint();assert.equal(h.requests.length,0);
  h.frame.style.display='block';h.c.watch();await h.paint();assert.equal(h.requests.length,1);
});
test('missing RPC causes no UI error or repeated report after expiry',async()=>{
  const h=client();h.hooks.send=()=>Promise.reject({code:'PGRST202'});assert.equal(await h.c.check(),false);h.time(1800000400000);assert.equal(await h.c.check(),false);assert.equal(h.requests.length,1);
});

const src=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
const start=src.indexOf('  function sqSharedViewContext('),end=src.indexOf('\n  function sqSharedViewObserve(',start);assert.ok(start>0&&end>start);
function actual(){
  const h=fixture(),players=[{id:'roster-a'}],nodes={subject:S,hasRecord:true};let role='executive',state='ready',unlocked=true,apiAvailable=true,owner={uid:A,wid:W};
  const local=new Map([['ps_cache_owner_v1',JSON.stringify({uid:A,wid:W,nonce:'one'})]]);
  const el={dataset:{sqmSubject:S},querySelector:()=>nodes.hasRecord?{}:null};
  const c=vm.createContext({squadView:true,sqPanel:'matches',sqEvalState:'ok',_idpRecoveryAuthLocked:false,sqEvalSel:'roster-a',
    idpSaveOwner:()=>owner,idpSaveApi:()=>apiAvailable?{reportSharedView(){},dataUnlocked:()=>unlocked}:null,myTeamRole:()=>role,onTeam:()=>true,
    sqEvalPlayers:()=>players,sqMatchContext:()=>({state,uid:nodes.subject}),wrap:{querySelector:()=>el},localStorage:{getItem:k=>local.get(k)||null}});
  vm.runInContext(src.slice(start,end),c);
  return {c,el,local,nodes,context:()=>c.sqSharedViewContext(),role(r){role=r;},state(s){state=s;},locked(){unlocked=false;},noApi(){apiAvailable=false;},owner(o){owner=o;}};
}
test('actual IDP hook requires successful roster load and DOM subject matches current linked document',()=>{
  const h=actual();assert.equal(h.context().subject,S);h.c.sqEvalState='loading';assert.equal(h.context(),null);h.c.sqEvalState='ok';
  h.nodes.subject=B;assert.equal(h.context(),null);h.nodes.subject=S;h.el.dataset.sqmSubject=B;assert.equal(h.context(),null);
});
test('actual IDP hook rejects empty/stale/own/unauthorized and owner-generation mismatches',()=>{
  const changes=[h=>h.nodes.hasRecord=false,h=>h.state('pending'),h=>h.nodes.subject=A,h=>h.role('player'),h=>h.role('unknown'),h=>h.locked(),h=>h.noApi(),h=>h.c.squadView=false,h=>h.c.sqPanel='story',h=>h.c._idpRecoveryAuthLocked=true,h=>h.local.set('ps_cache_owner_v1',JSON.stringify({uid:B,wid:W}))];
  changes.forEach(change=>{const h=actual();change(h);assert.equal(h.context(),null);});
});
