'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const perms=fs.readFileSync(path.join(__dirname,'../studio/perms.js'),'utf8');
const start=html.indexOf('(function(){',html.indexOf('/* 선수 전용 화면:'));
const end=html.indexOf('</script>',start);
assert.ok(start>0&&end>start,'actual player-only shell IIFE exists');
const shell=html.slice(start,end);
const roleStart=perms.indexOf('(function(){'),roleEnd=perms.indexOf('  function staffEditOpen(',roleStart);
assert.ok(roleStart>=0&&roleEnd>roleStart,'actual permissions role implementation exists');
const roleCode=perms.slice(roleStart,roleEnd)+'\n globalThis.roleUnderTest=myRole;\n})();';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
function harness(initialRole=null){
 const local=new Map(),listeners=new Map(),intervals=new Map(),timeouts=new Map(),nodes=new Map(),clicks=[];let nextTimer=0;
 local.set('ps_sync_session',JSON.stringify({uid:UID,at:'synthetic-access-1',rt:'synthetic-refresh-1'}));
 local.set('ps_active_ws',WID);local.set('ps_ws_list',JSON.stringify([{id:WID,kind:'team',role:'member'}]));
 if(initialRole)local.set('cs_perms_v1',JSON.stringify({defaultRole:'player',members:{[UID]:{role:initialRole}}}));
 function node(tag){return{tag,textContent:'',children:[],attributes:{},classList:{values:new Set(),toggle(k,on){if(on)this.values.add(k);else this.values.delete(k);},contains(k){return this.values.has(k);}},setAttribute(k,v){this.attributes[k]=v;},appendChild(n){this.children.push(n);if(n.id)nodes.set(n.id,n);}};}
 const label=node('span'),team=node('button'),personal=node('button'),today=node('button'),body=node('body');
 team.querySelector=selector=>selector==='span'?label:null;
 personal.click=()=>clicks.push('personal-idp');today.click=()=>clicks.push('today');
 const doc={body,head:node('head'),readyState:'complete',createElement:node,getElementById:id=>nodes.get(id)||null,
  querySelector(selector){if(selector==='#appSeg button[data-team-hub]')return team;if(selector==='#appSeg button[data-app="idp"]')return personal;
   if(selector==='#teamNav button[data-team-key="scouting"].on')return doc.scoutingSelected?node('button'):null;
   if(selector==='#teamNav button[data-team-key="today"]')return today;return null;},
  addEventListener(name,fn){listeners.set(name,[...(listeners.get(name)||[]),fn]);}};
 const win={addEventListener:doc.addEventListener};
 const c=vm.createContext({window:win,document:doc,JSON,Set,Array,String,Object,
  localStorage:{getItem:k=>local.get(k)||null,setItem(){throw Error('navigation may not change stored authority');},removeItem(){throw Error('navigation may not delete stored authority');}},
  setInterval(fn,ms){const id=++nextTimer;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id),
  setTimeout(fn,ms){const id=++nextTimer;timeouts.set(id,{fn,ms});return id;},
  currentTeamKey:'',showApp:app=>clicks.push(app)});
 vm.runInContext(roleCode,c);
 c.PSPerms=win.PSPerms={role:c.roleUnderTest};
 c.PSSync=win.PSSync={activeWsObj:()=>JSON.parse(local.get('ps_ws_list')).find(w=>w.id===local.get('ps_active_ws'))};
 vm.runInContext(shell,c);
 return{c,doc,local,clicks,label,intervals,
  playerOnly:()=>body.classList.contains('ps-player-idp-only'),noScout:()=>body.classList.contains('ps-no-scout'),
  role(role){local.set('cs_perms_v1',JSON.stringify({defaultRole:'player',members:{[UID]:{role}}}));},
  event(name,data={}){for(const fn of listeners.get(name)||[])fn(data);},
  finishInitialPolling(){let rounds=0;while(intervals.size&&rounds<150){for(const {fn} of [...intervals.values()])fn();rounds++;}assert.ok(rounds>120,'run past the finite initial poll window');assert.equal(intervals.size,0);},
  flushTimeouts(){for(const [id,{fn}] of [...timeouts]){timeouts.delete(id);fn();}}};
}

for(const event of ['ps-auth-state','ps-sync-state'])for(const role of ['staff','executive','admin']){
 test(event+' restores late '+role+' team navigation after the initial polling has ended',()=>{
  const h=harness();assert.equal(h.c.roleUnderTest(),'player','missing permissions use actual fail-closed role');
  assert.equal(h.playerOnly(),true);assert.equal(h.label.textContent,'팀 일정');assert.deepEqual(h.clicks,['personal-idp']);
  h.finishInitialPolling();h.role(role);assert.equal(h.c.roleUnderTest(),role);assert.equal(h.playerOnly(),true,'same-window storage write alone emits no storage event');
  h.event(event);assert.equal(h.playerOnly(),false);assert.equal(h.label.textContent,'팀 운영');assert.equal(h.noScout(),role==='staff');
  assert.deepEqual(h.clicks,['personal-idp'],'restoring coach menus does not redirect to a new document');assert.equal(h.intervals.size,0,'event does not restart polling');
 });
}
for(const event of ['ps-auth-state','ps-sync-state']){
 test(event+' cannot force team IDP or coach navigation for an actual player',()=>{
  const h=harness('player');h.finishInitialPolling();const before=[...h.clicks];
  h.event(event,{detail:{role:'admin',authenticated:true,ready:true}});h.event(event);
  assert.equal(h.c.roleUnderTest(),'player');assert.equal(h.playerOnly(),true);assert.equal(h.noScout(),true);assert.equal(h.label.textContent,'팀 일정');
  assert.deepEqual(h.clicks,before,'event payload cannot select team IDP or repeatedly redirect the player');
 });
 for(const role of ['player','staff'])test(event+' with token rotation alone preserves '+role+' navigation',()=>{
  const h=harness(role);h.finishInitialPolling();const before={player:h.playerOnly(),scout:h.noScout(),label:h.label.textContent,clicks:[...h.clicks]};
  h.local.set('ps_sync_session',JSON.stringify({uid:UID,at:'synthetic-access-2',rt:'synthetic-refresh-2'}));h.event(event);
  assert.deepEqual({player:h.playerOnly(),scout:h.noScout(),label:h.label.textContent,clicks:[...h.clicks]},before);
 });
 test(event+' also applies a coach demotion without granting scouting access',()=>{
  const h=harness('executive');h.finishInitialPolling();h.doc.scoutingSelected=true;h.role('player');h.event(event);
  assert.equal(h.playerOnly(),true);assert.equal(h.noScout(),true);assert.equal(h.label.textContent,'팀 일정');assert.deepEqual(h.clicks,['today','personal-idp']);
  h.doc.scoutingSelected=false;h.event(event);assert.deepEqual(h.clicks,['today','personal-idp'],'same role notification does not reroute again');
 });
}
test('existing cross-tab permissions change still restores coach menus after polling ends',()=>{
 const h=harness();h.finishInitialPolling();h.role('staff');h.event('storage',{key:'cs_perms_v1'});h.flushTimeouts();
 assert.equal(h.playerOnly(),false);assert.equal(h.label.textContent,'팀 운영');assert.equal(h.noScout(),true);
});
