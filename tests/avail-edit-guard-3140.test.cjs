// 3.140 — 가용인원 «조회만 가능»이 확인이 끝나도 풀리지 않던 것(사용자 10/19 «가용인원 수정이 안돼»).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const G=require('../studio/avail-edit-guard.js');
const root=path.join(__dirname,'..');

function ls(init){const m=new Map(Object.entries(init||{}));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
function win(o){
  o=o||{};
  const uid='u1',wid='w1';
  const store=ls(Object.assign({ps_sync_session:JSON.stringify({uid}),ps_active_ws:wid,ps_cache_owner_v1:JSON.stringify({uid,wid}),
    ps_ws_list:JSON.stringify([{id:wid,kind:'team',role:'owner'}])},o.ls||{}));
  return Object.assign({localStorage:store,PSPerms:{role:()=>o.role||'executive',canEdit:()=>o.canEdit!==false},
    PSSync:{dataUnlocked:()=>o.unlocked!==false},scoutAutomaticWriteAllowed:()=>o.write!==false,
    scoutBootPending:!!o.boot,scMainMigrationPending:!!o.mig,scPreparing:o.preparing||null},o.extra||{});
}

test('막힌 까닭 — avOwnerContext 와 같은 순서로 하나',()=>{
  assert.equal(G.reason(win()),'other');
  assert.equal(G.reason(win({canEdit:false})),'perm');
  assert.equal(G.reason(win({role:'player'})),'role');
  assert.equal(G.reason(win({write:false})),'viewonly');
  assert.equal(G.reason(win({boot:true,mig:true})),'boot');
  assert.equal(G.reason(win({mig:true})),'migrate');
  assert.equal(G.reason(win({ls:{ps_ws_switch_guard_v1:'{"token":"t"}'}})),'switch');
  assert.equal(G.reason(win({ls:{ps_cache_owner_v1:JSON.stringify({uid:'other',wid:'w1'})}})),'seal');
  assert.equal(G.reason(win({unlocked:false})),'locked');
});

test('문구 — 권한이 없을 때만 «권한», 나머지는 «확인하는 중»',()=>{
  for(const c of ['perm','role','viewonly'])assert.match(G.message(c),/권한/);
  for(const c of ['boot','migrate','switch','session','seal','locked','other']){assert.match(G.message(c),/확인하는 중/);assert.doesNotMatch(G.message(c),/권한/);}
  assert.match(G.message('locked',true),/다시 열어/);
});

test('옛 후보 정리 표시 — 정리할 후보가 없으면 내리고, 있으면 다시 시도(정리 중이면 기다린다)',()=>{
  const clean=JSON.stringify({players:[{id:'a',type:'ours'}]}),legacy=JSON.stringify({players:[{id:'t',type:'target'}]});
  assert.equal(G.mainHasTargets(clean),false);assert.equal(G.mainHasTargets(legacy),true);assert.equal(G.mainHasTargets(null),false);
  assert.equal(G.mainHasTargets('{bad'),true,'읽지 못한 본문은 정리 표시를 내리지 않는다');
  let w=win({mig:true,ls:{scout_tool_v1:clean}});
  assert.equal(G.unstick(w,{}),true);assert.equal(w.scMainMigrationPending,false);
  let calls=0;w=win({mig:true,ls:{scout_tool_v1:legacy},extra:{scPrepare(){calls++;}}});
  const st={};G.unstick(w,st);G.unstick(w,st);
  assert.equal(w.scMainMigrationPending,true);assert.equal(calls,1,'5초에 한 번만 다시 시도');
  w=win({mig:true,preparing:{},ls:{scout_tool_v1:clean}});
  assert.equal(G.unstick(w,{}),false);assert.equal(w.scMainMigrationPending,true,'정리 중에는 건드리지 않는다');
});

test('화면 — 기다리는 까닭이면 풀리는 대로 다시 그리고, 오래 막히면 까닭을 한 번 남긴다',()=>{
  let can=false,shown=false,renders=0,now=1000;const timers=[],events=[];
  const note={textContent:'조회만',attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
  const rootEl={querySelector:()=>(shown?note:null)};   // 막힘 줄은 그린 순간의 답이다
  const doc={hidden:false,getElementById:id=>id==='availRoot'?rootEl:id==='availView'?{classList:{contains:c=>c==='on'}}:null};
  const w=win({unlocked:false,extra:{document:doc,avPickerState:null,
    setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval:id=>{timers[id-1]=null;},
    renderAvail(){renders++;shown=!can;},avCanEdit:()=>can}});
  w.PSSync.event=(name,o)=>events.push([name,o.error_code,o.meta.owner]);
  const realNow=Date.now;Date.now=()=>now;
  try{
    assert.equal(G.mount(w),true);assert.equal(G.mount(w),false,'두 번 감싸지 않는다');
    w.renderAvail();
    assert.equal(renders,1);assert.equal(note.attrs['data-why'],'locked');assert.match(note.textContent,/확인하는 중/);
    assert.equal(timers.filter(Boolean).length,1);
    now+=11000;timers[0]();
    assert.deepEqual(events,[['avail_readonly','locked',true]]);
    now+=1500;timers[0]();assert.equal(events.length,1,'같은 까닭은 한 번만');
    now+=20000;timers[0]();assert.match(note.textContent,/다시 열어/);
    can=true;timers[0]();
    assert.equal(renders,2,'풀리면 다시 그린다(그 그림에는 막힘 줄이 없다)');
    assert.equal(timers.filter(Boolean).length,0,'다시 그린 뒤 보기를 멈춘다');
  }finally{Date.now=realNow;}
});

test('화면 — 권한이 없으면 기다리지 않는다(주인일 때만 고장으로 남긴다)',()=>{
  const note={textContent:'',setAttribute(){}},events=[],timers=[];
  const doc={hidden:false,getElementById:id=>id==='availRoot'?{querySelector:()=>note}:null};
  const w=win({role:'player',extra:{document:doc,setInterval:fn=>{timers.push(fn);return 1;},clearInterval(){},renderAvail(){},avCanEdit:()=>false}});
  w.PSSync.event=(n,o)=>events.push(o.error_code);
  G.mount(w);w.renderAvail();
  assert.match(note.textContent,/권한/);assert.equal(timers.length,0);assert.deepEqual(events,['role']);
  const w2=win({role:'player',ls:{ps_ws_list:JSON.stringify([{id:'w1',kind:'team',role:'member'}])},extra:{document:doc,setInterval:fn=>{timers.push(fn);return 1;},clearInterval(){},renderAvail(){},avCanEdit:()=>false}});
  const ev2=[];w2.PSSync.event=(n,o)=>ev2.push(o.error_code);
  G.mount(w2);w2.renderAvail();assert.deepEqual(ev2,[],'권한이 없는 코치는 기록하지 않는다');
});

test('scout.html 이 본문 뒤에서 읽고 · 서비스워커가 담는다',()=>{
  const html=fs.readFileSync(path.join(root,'studio/scout.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  const tag=html.indexOf('<script src="avail-edit-guard.js"></script>');
  assert.ok(tag>html.indexOf('function renderAvail(')&&tag>html.indexOf('function avOwnerContext('),'renderAvail 을 정의한 뒤에 읽어야 감싼다');
  assert.ok(sw.includes("'/studio/avail-edit-guard.js'"));
});
