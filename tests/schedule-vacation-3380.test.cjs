'use strict';
/* 3.380 — 일정 종류 «휴가»(제보 9f762d66 · 목업 A안). 저장은 OFF + 표식(day.vac · day.vacGrp) — 쉬는 날을 읽는 다른 화면 · 옛 판 앱은 그대로 OFF 로 읽는다.
   studio/schedule-vacation.js(`PSVac`) + process.html 의 짧은 호출(크기 예산) + sw.js. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const V=require('../studio/schedule-vacation.js');
const root=path.join(__dirname,'..');
const S=fs.readFileSync(path.join(root,'studio/process.html'),'utf8');
const SW=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const off=x=>Object.assign({off:true,board:{sched:'OFF'}},x||{});

test('하루 전체 — OFF 이면서 표식이 있을 때만 휴가',()=>{
  assert.equal(V.is(off({vac:true}),''),true);
  assert.equal(V.is(off(),''),false,'그냥 OFF');
  assert.equal(V.is({vac:true,board:{sched:'훈련'}},''),false,'OFF 가 아닌 날의 표식은 뜻이 없다');
  assert.equal(V.is({vac:true,board:{sched:'OFF'}},''),true,'board.sched 만 OFF 인 옛 모양');
  assert.equal(V.is(null,''),false);
});
test('조별 — 그 조가 OFF 이고 표식이 있으면 그 조만 휴가 · 조 지정이 없으면 하루 전체를 따른다',()=>{
  const d={groupKinds:{A:'OFF',B:'OFF',C:'훈련'},vacGrp:{A:1},board:{sched:'훈련'}};
  assert.equal(V.is(d,'A'),true);assert.equal(V.is(d,'B'),false);assert.equal(V.is(d,'C'),false);
  assert.equal(V.g(d,'A'),'휴가');assert.equal(V.g(d,'B'),'OFF');
  assert.equal(V.is(off({vac:true}),'A'),true,'조 지정 없는 날 — 하루 전체 휴가');
  assert.equal(V.is(off({vac:true,groupKinds:{A:'훈련'}}),'A'),false,'그 조는 훈련으로 정했다');
  assert.equal(V.is({groupKinds:{A:'OFF'},vacGrp:{A:1}},''),true,'전체 보기 — 쉬는 조가 모두 휴가');
  assert.equal(V.is(d,''),false,'쉬는 조 가운데 OFF 가 섞여 있으면 OFF');
  assert.equal(V.is({groupKinds:{'__proto__':'OFF'}},'__proto__'),false);
});
test('채우기 창의 지금 종류 · 요약 글',()=>{
  assert.deepEqual(V.K.map(k=>k[0]),['훈련','OFF','휴가']);
  assert.equal(V.u(off({vac:true}),[],'OFF'),'휴가');assert.equal(V.u(off(),[],'OFF'),'OFF');
  assert.equal(V.u(off({vac:true}),[],'훈련'),'훈련','OFF 가 아닌 값은 그대로');
  const d={groupKinds:{A:'OFF',B:'OFF'},vacGrp:{A:1}};
  assert.equal(V.u(d,['A'],'OFF'),'휴가');assert.equal(V.u(d,['A','B'],'OFF'),'OFF','고른 조가 모두 휴가여야 켜진다');
  assert.equal(V.s({off:3,vac:2}),'휴가 2');assert.equal(V.s({off:3}),'');assert.equal(V.s({vac:0}),'');assert.equal(V.s(null),'');
});
test('표식 달기 · 떼기 · 저장 전 걷기(OFF 가 아닌 날 · 조의 표식)',()=>{
  const d=off();V.setWhole(d,true);assert.equal(d.vac,true);V.setWhole(d,false);assert.equal('vac' in d,false);
  const g={groupKinds:{A:'OFF'}};V.setGrp(g,'A',true);V.setGrp(g,'__proto__',true);
  assert.deepEqual(Object.keys(g.vacGrp).sort(),['A','__proto__']);assert.equal(({}).polluted,undefined);
  V.setGrp(g,'A',false);V.setGrp(g,'__proto__',false);assert.equal('vacGrp' in g,false);
  const days=[off({vac:true}),{vac:true,board:{sched:'훈련'}},{groupKinds:{A:'OFF',B:'훈련'},vacGrp:{A:1,B:1}},{vacGrp:{A:1}},{vacGrp:'x'},null,off({vac:'yes'})];
  assert.equal(V.tidy(days),5);
  assert.equal(days[0].vac,true);assert.equal('vac' in days[1],false);assert.deepEqual(days[2].vacGrp,{A:1});
  assert.equal('vacGrp' in days[3],false);assert.equal('vacGrp' in days[4],false);assert.equal('vac' in days[6],false,'참이 아닌 값은 표식이 아니다');
  assert.equal(V.tidyAll({'0':[off({vac:true})],'1':[{vac:true}]}),1);
});
test('고르는 길 — «휴가»는 OFF 로 넘기고 그 안의 setSched · wksSetGroupKind 가 표식을 단다 · 다른 종류는 뗀다',()=>{
  const day=off({vac:true}),gday={groupKinds:{}},saved=[];
  const w={document:{head:null,getElementById:()=>null},save(){saved.push(JSON.stringify([day.vac,gday.vacGrp]));}};
  global.weeksMap={0:[day]};global.week=[gday];
  w.setSched=(r,c,val)=>{day.board.sched=val;day.off=val==='OFF';w.save();};
  w.wksSetGroupKind=(di,g,kind)=>{if(kind)gday.groupKinds[g]=kind;else delete gday.groupKinds[g];w.save();};
  w.wksFillKind=kind=>{w.calls=(w.calls||[]).concat(kind);if(w.grp)w.wksSetGroupKind(0,w.grp,kind);else w.setSched(0,0,kind);};
  try{
    assert.equal(V.mount(w),true);assert.equal(V.mount(w),false,'한 번만');
    global.__fillDi=0;global.week=[day];
    w.wksFillKind('OFF');assert.equal('vac' in day,false,'쉬는 날에서 OFF — 표식만 뗀다');assert.equal(w.calls,undefined,'본문 길(조별 OFF)을 타지 않는다');
    w.wksFillKind('휴가');assert.equal(day.vac,true,'쉬는 날에서 휴가 — 표식만 단다');assert.equal(w.calls,undefined);
    w.schedEditBlocked=()=>true;w.wksFillKind('OFF');assert.equal(day.vac,true,'편집이 잠겨 있으면 그대로');delete w.schedEditBlocked;
    day.off=false;day.board.sched='';delete day.vac;global.week=[gday];
    w.wksFillKind('OFF');assert.equal('vac' in day,false,'OFF 를 고르면 휴가 표식을 뗀다');
    w.wksFillKind('휴가');assert.deepEqual(w.calls,['OFF','OFF'],'본문에는 OFF 로');assert.equal(day.vac,true);assert.equal(day.off,true);
    assert.equal(saved[saved.length-1],'[true,null]','표식이 저장 전에 달린다');
    w.wksFillKind('훈련');assert.equal('vac' in day,false);
    w.grp='A';w.wksFillKind('휴가');assert.deepEqual(gday.vacGrp,{A:1});assert.equal(gday.groupKinds.A,'OFF');
    w.wksFillKind('OFF');assert.equal('vacGrp' in gday,false);
    day.vac=true;day.off=false;day.board.sched='훈련';w.save();assert.equal('vac' in day,false,'저장 때마다 남은 표식을 걷는다');
  }finally{delete global.weeksMap;delete global.week;delete global.__fillDi;}
});
test('배선 — process.html 의 짧은 호출 · 서비스워커 · 크기 예산 · 스타일에 !important 없음',()=>{
  assert.match(S,/<script src="schedule-board-play\.js"><\/script><script src="schedule-vacation\.js"><\/script>/);
  for(const k of ['PSVac.K.forEach(','_cur=PSVac.u(day,fillGroups,_cur);',"' is-off'+PSVac.c(day)","'+PSVac.n(day)+' ▾</button>","' · '+PSVac.g(day,g)+'</div>'",'o.vac=(o.vac|0)+PSVac.v(day);','isOff?PSVac.n(day):info.txt',"' off'+PSVac.c(day)",'<b class="mkind k-off">${txt}</b>'])assert.ok(S.includes(k),k);
  assert.equal(S.split("sub:PSVac.s(c), k:'of'").length-1,2,'주간 · 월간/연간 요약 둘 다');
  assert.ok(SW.includes("'/studio/schedule-vacation.js'"));
  assert.ok(Buffer.byteLength(S)<=820*1024,'process.html '+Buffer.byteLength(S));
  assert.doesNotMatch(V.CSS,/!important/);
});
