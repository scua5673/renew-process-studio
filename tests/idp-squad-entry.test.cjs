'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`actual IDP ${a}`);return source.slice(i,j);}
const code=section('  function teamData(){','  /* ══ 2.417')+
  section('  function renderViewer(){',"  document.getElementById('viewerSel')")+
  section('  function sqEvalLoad(force){','  /* 2.074')+
  section("  window.addEventListener('message',function(e){ var d=e.data||{};",'  function dayChips(){');
const own='cs_idp_v1_synthetic-coach',other='cs_idp_v1_synthetic-player';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function classes(){const values=new Set();return {add:x=>values.add(x),remove:x=>values.delete(x),contains:x=>values.has(x),toggle(x,on){if(on)values.add(x);else values.delete(x);}};}

// Run the shipped routing, selector and team-loading functions. Only DOM, local
// cache and the asynchronous shell relay are synthetic; no account/network access.
function harness(options={}){
  const viewer={classList:classes()},selector={},acks=[],renders=[],requests=[],adoptions=[];
  const cache=new Map(Object.entries(options.cache||{}).map(([k,v])=>[k,JSON.stringify(v)]));
  const state={coach:options.coach!==false,adopt:true,keys:options.keys||[own]};
  let listener;
  const c={PREFIX:'cs_idp_v1_',personalOnly:true,squadView:false,viewing:own,curL:'home',sqOthers:0,
    sqEvalState:'idle',sqEvalData:null,sqEvalSel:'',sqEvalErr:'',
    document:{getElementById:id=>id==='viewer'?viewer:selector,body:{classList:classes()},documentElement:{removeAttribute(){}}},
    localStorage:{getItem:k=>cache.get(k)||null},myKey:()=>own,idpKeys:()=>state.keys,isCoach:()=>state.coach,
    adoptViewing(key){adoptions.push(key);if(!state.adopt)return false;c.viewing=key;return true;},
    esc:String,load:()=>({profile:{name:'Synthetic Player'}}),
    teSend(type){return new Promise(resolve=>requests.push({type,resolve}));},
    addEventListener(type,fn){assert.equal(type,'message');listener=fn;},
  };
  c.window=c;
  c.render=()=>{c.renderViewer();if(c.squadView&&c.sqEvalState==='idle')c.sqEvalLoad();renders.push({squad:c.squadView,state:c.sqEvalState});};
  vm.createContext(c);vm.runInContext(code,c,{filename:'idp.html actual team entry'});
  return {c,state,viewer,selector,acks,renders,requests,adoptions,
    send(type,fields={}){listener({data:{type,...fields},source:{postMessage:message=>acks.push(message)}});},
  };
}

for(const [label,cache]of [
  ['no local team document',{}],
  ['players exist without evaluation attributes',{scout_tool_v1:{players:[{id:'p1',name:'Synthetic Player'}],attrs:[]}}],
  ['public attributes mirror has no roster',{cs_team_attrs_v1:{attrs:[{id:'speed'}]}}],
])test(`explicit team IDP keeps its loading route with ${label}`,()=>{
  const h=harness({cache});h.send('openSquad');
  assert.equal(h.c.squadView,true);assert.equal(h.c.personalOnly,false);
  assert.equal(h.c.sqEvalState,'loading');assert.equal(h.requests.length,1);assert.equal(h.requests[0].type,'teamEvalList');
  assert.equal(h.viewer.classList.contains('on'),false);assert.ok(h.renders.every(r=>r.squad));
  assert.equal(h.acks[0].type,'squadAck');
});

test('late authoritative roster opens in the selected team route even while local cache remains empty',async()=>{
  const h=harness();h.send('openSquad');h.requests[0].resolve({ok:true,players:[{id:'p1',name:'Synthetic Player'}],editable:true});await settle();
  assert.equal(h.c.squadView,true);assert.equal(h.c.sqEvalState,'ok');assert.equal(h.c.sqEvalSel,'p1');assert.equal(h.c.sqEvalPlayers().length,1);
  assert.ok(h.renders.every(r=>r.squad));
});

test('a confirmed empty roster remains a team empty state',async()=>{
  const h=harness();h.send('openSquad');h.requests[0].resolve({ok:true,players:[],editable:true});await settle();
  assert.equal(h.c.squadView,true);assert.equal(h.c.sqEvalState,'ok');assert.equal(h.c.sqEvalSel,'');assert.equal(h.c.sqEvalPlayers().length,0);
});

test('team relay timeout and explicit retry do not redirect into personal IDP',async()=>{
  const h=harness();h.send('openSquad');h.requests[0].resolve({ok:false,err:'timeout'});await settle();
  assert.equal(h.c.squadView,true);assert.equal(h.c.sqEvalState,'err');assert.equal(h.c.sqEvalErr,'timeout');
  h.c.sqEvalLoad(true);assert.equal(h.requests.length,2);assert.equal(h.c.sqEvalState,'loading');
  h.requests[1].resolve({ok:true,players:[]});await settle();assert.equal(h.c.squadView,true);assert.equal(h.c.sqEvalState,'ok');
});

test('shell retries acknowledge the existing team route without reloading or adopting again',()=>{
  const h=harness();h.send('openSquad');const n=h.renders.length;h.send('openSquad');
  assert.equal(h.requests.length,1);assert.equal(h.adoptions.length,1);assert.equal(h.renders.length,n);assert.equal(h.acks.length,2);
});

test('opening personal IDP while a team response is pending remains personal after that response',async()=>{
  const h=harness();h.send('openSquad');h.send('openPersonal',{layer:'cal',requestId:'synthetic'});
  assert.equal(h.c.squadView,false);assert.equal(h.c.personalOnly,true);assert.equal(h.c.viewing,own);
  h.requests[0].resolve({ok:true,players:[]});await settle();
  assert.equal(h.c.squadView,false);assert.equal(h.c.personalOnly,true);assert.equal(h.c.curL,'cal');assert.equal(h.acks[1].type,'idpPersonalAck');
});

test('player role cannot enter the coach team route',()=>{
  const h=harness({coach:false});h.send('openSquad');
  assert.equal(h.c.personalOnly,true);assert.equal(h.c.squadView,false);assert.equal(h.requests.length,0);assert.equal(h.acks.length,0);assert.equal(h.adoptions.length,0);
});

test('a pending personal-document adoption rejection still blocks team entry',()=>{
  const h=harness();h.state.adopt=false;h.send('openSquad');
  assert.equal(h.c.personalOnly,true);assert.equal(h.c.squadView,false);assert.equal(h.requests.length,0);assert.equal(h.acks.length,0);
});

test('legacy individual viewing fallback still adopts own IDP when no team data remains',()=>{
  const h=harness();h.c.personalOnly=false;h.c.squadView=false;h.c.viewing=other;h.c.renderViewer();
  assert.equal(h.c.viewing,own);assert.equal(h.c.squadView,false);assert.equal(h.adoptions.length,1);assert.equal(h.requests.length,0);
});

test('personal-only mode takes precedence even if squadView was previously true',()=>{
  const h=harness();h.c.squadView=true;h.c.viewing=other;h.c.renderViewer();
  assert.equal(h.c.squadView,false);assert.equal(h.c.viewing,own);assert.equal(h.viewer.classList.contains('on'),false);
});
