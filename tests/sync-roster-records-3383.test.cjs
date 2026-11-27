'use strict';
/* 3.383 — 선수단 문서의 기록 칸(부상 기록 · 상태 기간 · 그날 기록)을 «선수 입력 보류» 중에도 팀에 올린다(sync-roster-records.js).
   사용자 11/27 «풋볼A 다른 코치가 부상리포트 만들고 있는데 팀운영에 적용이 안되는데» — 보류가 있는 스태프 기기의 선수단 문서가 통째로 안 올라갔다.
   브라우저 시험 staff-records-held-3383 이 실제 회차로 돈다. 여기는 합치는 규칙과 sync.js 배선. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../studio/sync-roster-records.js');
const sync=fs.readFileSync(path.join(__dirname,'..','studio','sync.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','studio','app.html'),'utf8');
const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
const noHolds={getItem:()=>null};
const ASK={state:()=>({kind:'ask',reason:'items_stale_review'})},WAIT={state:()=>({kind:'wait',reason:'items_stale_review'})};
const holdsOf=list=>({getItem:k=>k==='ps_hold_list_v1'?JSON.stringify(list):null});
const docOf=(meta,players=[{id:'p1',name:'선수 1',status:'ok'},{id:'p2',name:'선수 2',status:'ok'}],extra={})=>JSON.stringify({attrs:[{id:'a1'}],positions:[{id:'pos_CB',name:'CB'}],players,meta,_items:{build:'x'},...extra});
const row=(v,cupd=100)=>({k:'scout_tool_v1',v,cupd});

test('부상 기록 · 그날 기록: 합집합 · at 이 큰 쪽 · 같으면 서버 · 보류된 선수는 기기 값을 싣지 않는다',()=>{
  const s={p1:{'2026-11-20':{at:5,part:'무릎'}},p2:{'2026-11-21':{at:9,part:'발목'}}};
  const l={p1:{'2026-11-20':{at:7,part:'햄스트링'},'2026-11-26':{at:8,part:'발'}},p2:{'2026-11-21':{at:9,part:'허리'}},p3:{'2026-11-27':{at:1,part:'어깨'}}};
  const out=R.cells(s,l,pid=>pid==='p3');
  assert.equal(out.p1['2026-11-20'].part,'햄스트링','at 이 큰 기기 값');
  assert.equal(out.p1['2026-11-26'].part,'발','서버에 없는 칸은 더한다');
  assert.equal(out.p2['2026-11-21'].part,'발목','at 이 같으면 서버');
  assert.equal(out.p3,undefined,'보류된 선수의 기기 값은 싣지 않는다');
  assert.equal(R.cells(s,{p1:{'2026-11-20':{at:1,part:'옛 값'}}},()=>false),s,'더할 게 없으면 서버 것 그대로(같은 객체)');
  assert.deepEqual(R.cells(undefined,{p1:{d:{at:1}}},()=>false),{p1:{d:{at:1}}},'서버에 칸이 없으면 기기 것');
  assert.equal(R.cells(undefined,{},()=>false),undefined,'둘 다 비면 칸을 만들지 않는다');
  const pd=R.cells({'2026-11-27':{p5:{s:'out',at:3}}},{'2026-11-27':{p3:{s:'injury',at:4},p1:{s:'out',at:2}}},(d,pid)=>pid==='p1');
  assert.deepEqual(Object.keys(pd['2026-11-27']).sort(),['p3','p5'],'그날 기록은 선수 단위로 합치고 보류된 선수(p1)는 뺀다');
  const evil=JSON.parse('{"__proto__":{"x":{"at":99}},"p1":{"d":{"at":1}}}');
  const safe=R.cells({},evil,()=>false);assert.equal(Object.getPrototypeOf(safe),Object.prototype);assert.equal(safe.x,undefined);
});

test('상태 기간: 서버 기간은 그대로 · 서버 마지막 날 뒤의 기기 기간만 잇는다 · 서버에 없는 선수는 기기 것',()=>{
  const s={p1:[{s:'ok',from:'2026-11-01',to:'2026-11-20'}],p2:[{s:'injury',from:'2026-11-10',to:'2026-11-27'}]};
  const l={p1:[{s:'ok',from:'2026-11-01',to:'2026-11-18'},{s:'injury',from:'2026-11-19',to:'2026-11-27'}],
           p2:[{s:'ok',from:'2026-11-10',to:'2026-11-27'}],
           p3:[{s:'rehab',from:'2026-11-26',to:'2026-11-27'},{bad:1}]};
  const out=R.runs(s,l,()=>false);
  assert.deepEqual(out.p1,[{s:'ok',from:'2026-11-01',to:'2026-11-20'},{s:'injury',from:'2026-11-21',to:'2026-11-27'}],'겹친 날은 서버 · 그 뒤는 기기(첫날을 서버 다음 날로)');
  assert.deepEqual(out.p2,s.p2,'서버가 이미 오늘까지 적었으면 그대로');
  assert.deepEqual(out.p3,[{s:'rehab',from:'2026-11-26',to:'2026-11-27'}],'서버에 없는 선수는 기기 기간(모양이 맞는 것만)');
  const joined=R.runs({p1:[{s:'injury',from:'2026-11-20',to:'2026-11-22'}]},{p1:[{s:'injury',from:'2026-11-20',to:'2026-11-27'}]},()=>false);
  assert.deepEqual(joined.p1,[{s:'injury',from:'2026-11-20',to:'2026-11-27'}],'같은 상태가 이어지면 한 기간으로');
  assert.equal(R.runs(s,{p1:l.p1},pid=>pid==='p1'),s,'보류된 선수의 기기 기간은 싣지 않는다');
});

test('plan: 기기에만 있는 기록은 서버 문서 위에 얹어 올리고 선수 줄 · 다른 칸은 서버 것 그대로',()=>{
  const server=docOf({teamName:'프로세스FC',injuryInfo:{p2:{'2026-11-20':{at:1,part:'발목'}}}},[{id:'p1',name:'선수 1',status:'ok'},{id:'p2',name:'선수 2',status:'injury'}]);
  const local=docOf({teamName:'프로세스FC',injuryInfo:{p1:{'2026-11-27':{at:9,part:'무릎',n:'STAFF'}}},statusRuns:{p1:[{s:'injury',from:'2026-11-27',to:'2026-11-27'}]}},[{id:'p1',name:'선수 1',status:'injury',memo:'기기'},{id:'p2',name:'선수 2',status:'ok'}],{_items:{build:'other'}});
  const m={h:{},c:{}},out=R.plan('scout_tool_v1',local,row(server,100),m,555,[],ASK,noHolds);
  const P=JSON.parse(out.p),L=JSON.parse(out.l);
  assert.equal(P.meta.injuryInfo.p1['2026-11-27'].n,'STAFF');assert.equal(P.meta.injuryInfo.p2['2026-11-20'].part,'발목');
  assert.deepEqual(P.players,JSON.parse(server).players,'올리는 문서의 선수 줄은 서버 것');
  assert.deepEqual(P._items,{build:'x'},'올리는 문서의 _items 는 서버 것');
  assert.deepEqual(P.meta.statusRuns.p1,[{s:'injury',from:'2026-11-27',to:'2026-11-27'}]);
  assert.equal(L.meta.injuryInfo.p2['2026-11-20'].part,'발목','기기 사본엔 서버 기록이 합쳐진다');
  assert.deepEqual(L.players,JSON.parse(local).players,'기기 사본의 선수 줄은 그대로');
  assert.equal(out.keep,false,'선수 줄 · _items 차이는 «다른 칸이 다름»이 아니다');
  assert.deepEqual(m.rr.scout_tool_v1.c,555,'올린 회차 판본');assert.equal(typeof m.rr.scout_tool_v1.f,'string');
  assert.equal(R.want('scout_tool_v1',m,out.l,{cupd:555},ASK,noHolds),false,'올린 그대로면 다음 회차에 원문을 다시 받지 않는다');
  assert.equal(R.want('scout_tool_v1',m,out.l,{cupd:556},ASK,noHolds),true,'서버 판이 바뀌면 받는다');
  assert.equal(R.want('scout_tool_v1',m,local,{cupd:555},ASK,noHolds),true,'기기 기록이 바뀌면 받는다');
  assert.equal(R.want('scout_tool_v1',{},local,{cupd:1},ASK,noHolds),true,'처음엔 받는다');
});

test('plan: 기록 칸 밖이 서버와 다르면 keep · 보류된 선수의 기기 기록은 기기에만 · 문서 보류가 있으면 손대지 않는다',()=>{
  const server=docOf({teamName:'프로세스FC',level:'mid',participationDays:{'2026-11-27':{p2:{s:'out',at:3,n:'OWNER'}}}});
  const local=docOf({teamName:'프로세스FC',participationDays:{'2026-11-27':{p1:{s:'injury',at:5}}},injuryInfo:{p1:{'2026-11-27':{at:5,part:'무릎'}},p2:{'2026-11-26':{at:4,part:'발'}}}});
  const m={},out=R.plan('scout_tool_v1',local,row(server,200),m,900,['scout_tool_v1','sq:p1'],ASK,noHolds);
  const P=JSON.parse(out.p),L=JSON.parse(out.l);
  assert.equal(out.keep,true,'학교급(level)이 다르다');
  assert.equal(P.meta.level,'mid','서버의 다른 칸 그대로');assert.equal(L.meta.level,undefined,'기기의 다른 칸 그대로');
  assert.equal(P.meta.injuryInfo.p1,undefined,'보류된 선수(p1)의 기기 부상 기록은 올리지 않는다');
  assert.equal(P.meta.injuryInfo.p2['2026-11-26'].part,'발','다른 선수 기록은 올린다');
  assert.equal(P.meta.participationDays['2026-11-27'].p1,undefined);assert.equal(P.meta.participationDays['2026-11-27'].p2.n,'OWNER');
  assert.equal(L.meta.injuryInfo.p1['2026-11-27'].part,'무릎','보류된 선수의 기기 기록은 기기에 그대로');
  assert.equal(L.meta.participationDays['2026-11-27'].p1.s,'injury');assert.equal(L.meta.participationDays['2026-11-27'].p2.n,'OWNER');
  assert.equal(R.want('scout_tool_v1',m,out.l,{cupd:900},ASK,noHolds),false,'보류된 선수 기록이 남아도 되풀이해 받지 않는다');
  assert.equal(R.plan('scout_tool_v1',local,row(server),{},1,[],ASK,holdsOf([{kind:'conflict',k:'scout_tool_v1'}])),null,'문서 전체 보류(자료 확인 대기)가 있으면 손대지 않는다');
  assert.equal(R.want('scout_tool_v1',{},local,{cupd:1},ASK,holdsOf([{k:'scout_tool_v1'}])),false);
});

test('plan: 같으면 null(판본만 적는다) · 다른 키 · 깨진 원문 · 원문 없는 메타 행은 null',()=>{
  const d=docOf({injuryInfo:{p1:{d:{at:1}}}}),m={};
  assert.equal(R.plan('scout_tool_v1',d,row(d,7),m,8,[],ASK,noHolds),null);
  assert.deepEqual(m.rr.scout_tool_v1.c,7,'올리지 않았으면 본 서버 판본');
  assert.equal(R.want('scout_tool_v1',m,d,{cupd:7},ASK,noHolds),false);
  assert.equal(R.plan('cs_squad_v1',d,row(d),{},1,[],ASK,noHolds),null);
  assert.equal(R.plan('scout_tool_v1','{oops',row(d),{},1,[],ASK,noHolds),null);
  assert.equal(R.plan('scout_tool_v1',d,{k:'scout_tool_v1',cupd:1},{},1,[],ASK,noHolds),null);
  assert.equal(R.plan('scout_tool_v1',null,row(d),{},1,[],ASK,noHolds),null);
  assert.ok(R.diag.length>=1,'깨진 원문은 진단에 남는다(빈 catch 없음)');
});

test('보류 모듈이 «확인 대기»일 때만 돈다 — 보류 기록을 읽기 전(wait) · 모듈 없음 · 던짐이면 손대지 않는다',()=>{
  const server=docOf({}),local=docOf({injuryInfo:{p1:{'2026-11-27':{at:9,part:'무릎'}}}});
  assert.ok(R.plan('scout_tool_v1',local,row(server),{},1,[],ASK,noHolds));
  assert.equal(R.plan('scout_tool_v1',local,row(server),{},1,[],WAIT,noHolds),null,'아직 읽기 전(wait)');
  assert.equal(R.plan('scout_tool_v1',local,row(server),{},1,[],null,noHolds),null,'모듈 없음');
  assert.equal(R.plan('scout_tool_v1',local,row(server),{},1,[],{state(){throw Error('x');}},noHolds),null,'던지면 닫힌다');
  assert.equal(R.want('scout_tool_v1',{},local,{cupd:1},WAIT,noHolds),false);
  assert.equal(R.known({state:()=>({kind:'ok'})}),false);
});

test('sync.js 배선: 보류 갈래 · 받기 판정 · keep 판본 · 셸 · 서비스워커',()=>{
  assert.match(sync,/if\(k==='scout_tool_v1'&&itemsStaleAPI\(\)\.fenced\(k\)\)\{if\(typeof PSRosterRecords!=='undefined'&&PSRosterRecords\.want\(k,m0,idbVals\[k\],r0,itemsStaleAPI\(\)\)\)needV\.push\(k\);return;\}/);
  assert.ok(sync.includes("if(itemsStaleAPI().hold(k,heldKeys)){var rr=typeof PSRosterRecords!=='undefined'&&PSRosterRecords.plan(k,idbVals[k],srv[k],m,now,heldKeys,itemsStaleAPI());"));
  assert.ok(sync.includes('if(rr.l)roundKvWrite(k,rr.l,writes,idbVals[k]);'),'기기 사본 쓰기는 회차 CAS 길로');
  assert.ok(sync.includes("if(queuePush(k,rr.p,srv[k].v,idbVals[k],srv[k].cupd)&&rr.keep){m.c[k]=c0;m.h[k]=h0;pushRows[pushRows.length-1]._rk=1;}"),'keep 이면 마지막으로 맞춘 판을 그대로');
  assert.ok(sync.includes('if(!sent._rk)m.c[sent.k]=sent.cupd;'),'확인 응답도 keep 행은 판본을 당기지 않는다');
  assert.ok(app.indexOf('<script src="sync-roster-records.js"></script>')>0&&app.indexOf('<script src="sync-roster-records.js"></script>')<app.indexOf('<script src="sync.js'),'셸이 sync.js 앞에서 싣는다');
  assert.ok(sw.includes("'/studio/sync-roster-records.js'"),'서비스워커 CORE');
});
