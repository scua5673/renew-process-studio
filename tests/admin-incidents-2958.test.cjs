'use strict';
/* 2.958 — 데이터 사고 기록장(관리자 백엔드 탭). 유료 전환 문턱 «8주 연속 사고 0건»을 세는 판.
   서버는 «마지막 사고 뒤 며칠»·기록장·자동 감지 후보·가드 거부를 주고, 화면은 그것을 그리고 기록만 보낸다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../admin.html'),'utf8');
function section(a,b){const i=html.indexOf(a);assert.ok(i>=0,'missing '+a);const j=html.indexOf(b,i);assert.ok(j>i,'missing '+b);return html.slice(i,j);}
const code=section('var INC_KIND=','/* ===== 2.630 · 백엔드 건강 ===== */');

function harness(rpcImpl){
  const listeners={};
  function el(){return {innerHTML:'',querySelectorAll:()=>[]};}
  const nodes={incBody:el()};
  const calls=[];
  /* 폼은 실제 DOM 이 없으니 이름 → 값 상자로 흉내 낸다(화면 코드는 elements.namedItem 만 쓴다) */
  const fields={kind:{value:'loss'},ws:{value:''},title:{value:'',focus(){}},detail:{value:''}};
  const form={elements:{namedItem:n=>fields[n]},dataset:{},set onsubmit(f){listeners.submit=f;}};
  const c=vm.createContext({Math,String,Array,Object,Promise,Date,JSON,
    $:id=>id==='incAdd'?form:nodes[id],
    esc:s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
    toast:m=>calls.push(['toast',m]),confirm:()=>true,
    WS:[{id:'w1',name:'프로세스FC',kind:'team'},{id:'w2',name:'내 공간',kind:'personal'}],
    adminPersonName:uid=>'코치 '+String(uid).slice(0,4),
    rpc:(name,body)=>{calls.push([name,body]);return rpcImpl(name,body);}});
  vm.runInContext(code,c);
  return {c,nodes,form,fields,listeners,calls};
}
const SAMPLE={at:'2026-10-07T13:00:00Z',days:56,scan_days:14,last_loss_at:'2026-10-06T15:07:00Z',since_days:1,goal_days:56,
  log:[{id:7,at:'2026-10-06T15:07:00Z',kind:'restore',title:'<b>15팀</b> 복구',detail:'SQL',ws:null}],
  drops:[{history_id:42,at:'2026-10-05T13:10:00Z',by:'abcd1234-0000',k:'scout_tool_v1',ws:'프로세스FC',workspace_id:'w1',dropped:['records 7→0','days 5→0']}],
  guards:{record:2,permission:5,build:9},
  denied:[{cat:'permission',k:'cs_perms_v1',reason:'권한은 운영진만',at:'2026-10-05T12:00:00Z',ws:'프로세스FC'}]};

test('counter shows days since the last loss against the 56-day goal, and escapes titles',async()=>{
  const h=harness(()=>Promise.resolve(JSON.parse(JSON.stringify(SAMPLE))));
  h.c.loadIncidents();await new Promise(r=>setImmediate(r));
  const out=h.nodes.incBody.innerHTML;
  assert.match(out,/>1<span[^>]*> 일 \/ 56일/);
  assert.match(out,/유료 전환 문턱까지 55일/);
  assert.match(out,/&lt;b&gt;15팀&lt;\/b&gt; 복구/,'titles are escaped');
  assert.doesNotMatch(out,/<b>15팀<\/b>/);
  assert.match(out,/records 7→0 · days 5→0/);
  assert.match(out,/코치 abcd/,'writer is named through the admin name label');
  assert.match(out,/선수단 기록 칸 <b>2<\/b>/);
  assert.match(out,/옛 앱 판 <b>9<\/b>/);
  assert.match(out,/<option value="w1">프로세스FC<\/option>/);
  assert.doesNotMatch(out,/내 공간/,'personal spaces are not offered as teams');
  assert.equal(h.calls[0][0],'ps_admin_incidents');
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][1])),{p_days:56});
});

test('passing the goal is called out, and an empty ledger says so',async()=>{
  let h=harness(()=>Promise.resolve({...SAMPLE,since_days:60}));
  h.c.loadIncidents();await new Promise(r=>setImmediate(r));
  assert.match(h.nodes.incBody.innerHTML,/문턱 통과/);
  h=harness(()=>Promise.resolve({...SAMPLE,since_days:null,last_loss_at:null,log:[]}));
  h.c.loadIncidents();await new Promise(r=>setImmediate(r));
  assert.match(h.nodes.incBody.innerHTML,/기록된 사고가 없어요/);
});

test('a missing server function shows the install line instead of an error',async()=>{
  const h=harness(()=>Promise.reject(new Error('rpc ps_admin_incidents 404 PGRST202')));
  h.c.loadIncidents();await new Promise(r=>setImmediate(r));
  assert.match(h.nodes.incBody.innerHTML,/20261007_incident_ledger\.sql/);
});

test('submitting the form records the incident with team and trimmed text',async()=>{
  const h=harness(name=>Promise.resolve(name==='ps_admin_incidents'?JSON.parse(JSON.stringify(SAMPLE)):12));
  h.c.loadIncidents();await new Promise(r=>setImmediate(r));
  Object.assign(h.fields,{});h.fields.kind.value='loss';h.fields.ws.value='w1';h.fields.title.value='  경기 점수 12개 지워짐 ';h.fields.detail.value='   ';
  h.listeners.submit({preventDefault(){}});
  const add=h.calls.find(x=>x[0]==='ps_admin_incident_add');
  assert.deepEqual(JSON.parse(JSON.stringify(add[1])),{p_kind:'loss',p_title:'경기 점수 12개 지워짐',p_detail:null,p_workspace:'w1',p_at:null});
});

test('an empty title is not sent',async()=>{
  const h=harness(()=>Promise.resolve(JSON.parse(JSON.stringify(SAMPLE))));
  h.c.loadIncidents();await new Promise(r=>setImmediate(r));
  h.fields.title.value='   ';
  h.listeners.submit({preventDefault(){}});
  assert.equal(h.calls.some(x=>x[0]==='ps_admin_incident_add'),false);
  assert.ok(h.calls.some(x=>x[0]==='toast'));
});
