'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const evidence = require('../studio/idp-evidence.js');
const source = fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
const vision = {statement:'현재 방향',revision:'v2',behaviors:[{id:'b1',text:'현재 행동'}],history:[{statement:'그때 방향',revision:'v1',behaviors:[{id:'b1',text:'당시 행동'}]}]};
const log = {memo:'실제로 보인 장면',visionEvidence:{id:'b1',text:'저장한 행동 문장',revision:'v1'}};
function freeze(value) { if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; }
const clone=value=>JSON.parse(JSON.stringify(value));

test('saved evidence is authoritative even when current behavior has the same ID and new text',()=>{
  const got=evidence.read(log,vision);assert.equal(got.text,'저장한 행동 문장');assert.equal(got.statement,'그때 방향');assert.equal(got.revision,'v1');assert.equal(got.legacy,false);
});

test('current direction is shown only when its revision exactly matches saved evidence',()=>{
  const got=evidence.read({...log,visionEvidence:{...log.visionEvidence,revision:'v2'}},vision);assert.equal(got.statement,'현재 방향');assert.equal(got.text,'저장한 행동 문장');
});

for(const [name,v,revision] of [['no current direction',null,'v1'],['history expired',vision,'unknown'],['no revision',vision,''],['similar revision',vision,'v10']]) {
  test(`saved text survives ${name} without attributing the current direction`,()=>{
    const saved={...log,visionEvidence:{...log.visionEvidence,revision}},got=evidence.read(saved,v),html=evidence.render(saved,v);
    assert.equal(got.text,'저장한 행동 문장');assert.equal(got.statement,'');assert.match(html,/저장한 행동 문장/);assert.equal(html.includes('당시 내 방향'),false);
  });
}

test('saved snapshot takes priority when legacy ID is also present',()=>{
  const got=evidence.read({...log,visionBehaviorId:'other'},vision);assert.equal(got.id,'b1');assert.equal(got.legacy,false);
});

test('legacy ID-only evidence clearly labels current wording as reference',()=>{
  const lg={visionBehaviorId:'b1'},got=evidence.read(lg,vision),html=evidence.render(lg,vision);
  assert.equal(got.text,'현재 행동');assert.equal(got.statement,'');assert.equal(got.revision,'');assert.equal(got.legacy,true);assert.match(html,/현재 문구 참고/);assert.match(html,/당시 문구는 저장되지 않아/);
});

test('missing legacy ID is retained as a recorded connection without inventing a historical text',()=>{
  const lg={visionBehaviorId:'deleted'},got=evidence.read(lg,vision);assert.equal(evidence.has(lg),true);assert.equal(got.text,'');assert.equal(got.missing,true);assert.match(evidence.render(lg,vision),/찾을 수 없어요/);
});

for(const bad of [null,[],{}, {visionEvidence:[]},{visionEvidence:{text:42}},{visionEvidence:{text:'  '}},{visionBehaviorId:42}]) {
  test(`invalid evidence produces no record: ${JSON.stringify(bad)}`,()=>{
    assert.equal(evidence.has(bad),false);assert.equal(evidence.read(bad,vision),null);assert.equal(evidence.render(bad,vision),'');
  });
}

test('all renderers escape action, direction, memo, quotes, and markup',()=>{
  const x={memo:'<script>alert("memo")</script>',visionEvidence:{id:'" onclick="bad',text:'<img src=x onerror="bad"> & \'quoted\'',revision:'r'}};
  const v={revision:'r',statement:'<svg onload="bad">'};
  const html=evidence.render(x,v)+evidence.weekHTML({'2026-09-07':x},'2026-09-07',v);
  assert.equal(/<(?:script|img|svg)\b/.test(html),false);assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);assert.match(html,/&lt;svg/);assert.match(html,/&#39;quoted&#39;/);assert.match(html,/&amp;/);
});

test('week evidence lists only the exact seven days, in date order, including memo-only and evidence-only days',()=>{
  const logs={'2026-09-06':{memo:'outside-before'},'2026-09-07':log,'2026-09-09':{memo:'memo-only'},'2026-09-13':{visionEvidence:log.visionEvidence},'2026-09-14':{memo:'outside-after'}};
  const html=evidence.weekHTML(logs,'2026-09-07',vision);
  assert.match(html,/3일/);assert.match(html,/memo-only/);assert.equal(html.includes('outside-'),false);
  assert.ok(html.indexOf('2026-09-07')<html.indexOf('2026-09-09'));assert.ok(html.indexOf('2026-09-09')<html.indexOf('2026-09-13'));
  assert.match(html,/^<details class="idp-evidence-week">/);assert.equal(html.includes('<details open'),false);
});

for(const monday of ['2026-02-30','not-a-date','2026-09-08'])test('invalid week rejected: '+monday,()=>assert.equal(evidence.weekHTML({'2026-09-07':log},monday,vision),''));

test('empty week produces no empty card',()=>assert.equal(evidence.weekHTML({},'2026-09-07',vision),''));

test('formatter never mutates or backfills frozen records, vision history, or log map',()=>{
  const lg=freeze(clone(log)),v=freeze(clone(vision)),map=freeze({'2026-09-07':lg}),before=JSON.stringify({lg,v,map});
  evidence.has(lg);evidence.read(lg,v);evidence.render(lg,v);evidence.weekHTML(map,'2026-09-07',v);assert.equal(JSON.stringify({lg,v,map}),before);
});

test('UMD browser build works without CommonJS, DOM, storage, or writes',()=>{
  const c=vm.createContext({});c.window=c;vm.runInContext(fs.readFileSync(path.join(__dirname,'../studio/idp-evidence.js'),'utf8'),c);
  assert.equal(c.PSIDPEvidence.read(log,vision).statement,'그때 방향');
});

function fn(name) {
  const start=source.indexOf('  function '+name+'('),end=source.indexOf('\n  }',start)+4;assert.ok(start>=0&&end>start,name);return source.slice(start,end);
}
const appCode=['rCal','rWeekWrapCard','rWeeklyCard'].map(fn).join('\n');
class FixedDate extends Date { constructor(...args){super(...(args.length?args:['2026-09-12T12:00:00']));} static now(){return new Date('2026-09-12T12:00:00').getTime();} }
function appHarness() {
  const dates={
    ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');},
    addDays(d,n){const out=new Date(d);out.setDate(out.getDate()+n);return out;},
    mondayOf(d){const out=new Date(d);out.setDate(out.getDate()-((out.getDay()+6)%7));out.setHours(0,0,0,0);return out;},
    dayIdx(d){return (d.getDay()+6)%7;},sameDay(a,b){return a.toDateString()===b.toDateString();}
  };
  const doc={vision:clone(vision),log:{'2026-09-09':clone(log)},weekly:{},trainings:[]};
  let writes=0;
  const c=vm.createContext({console,Date:FixedDate,doc,PSIDPEvidence:evidence,calView:'week',calAnchor:new Date('2026-09-09T00:00:00'),DAYS:['월','화','수','목','금','토','일'],...dates,
    esc:evidence.esc,viewing:'my-idp',streak(){return 0;},plannedOn(){return [];},coachStatus(){return '';},viewedUid(){return 'me';},
    rReactMark(){return '';},teamLineOf(){return {txt:'훈련'};},doneExtras(){return [];},bodyTrendCard(){return '';},growthCards(){return '';},
    DT_LB:{},PHYS_LB:{},ic(){return '';},focusOf(){return null;},propsAll(){return {};},ro(){return false;},
    dlog(d){return doc.log[dates.ymd(d)]||null;},dayAtt(){return '';},rDayAttend(){return {strip:'',body:''};},rDayHours(){return '';},rNotice(){return '';},rReact(){return '';},
    TD_BODY:[],TD_SLEEP:[],save(){writes++;}
  });c.window=c;vm.runInContext(appCode,c);return {c,doc,writes:()=>writes};
}

test('actual weekly calendar marks an evidence-only day recorded and displays its saved evidence',()=>{
  const h=appHarness();delete h.doc.log['2026-09-09'].memo;const before=JSON.stringify(h.doc),html=h.c.rCal();
  const wed=html.slice(html.indexOf('data-wkgo="2026-09-09"'),html.indexOf('data-wkgo="2026-09-10"'));
  assert.match(wed,/wk-done/);assert.equal(wed.includes('기록하기'),false);assert.match(wed,/저장한 행동 문장/);assert.match(wed,/그때 방향/);assert.equal(JSON.stringify(h.doc),before);assert.equal(h.writes(),0);
});

test('actual past daily calendar displays evidence even after current vision is removed',()=>{
  const h=appHarness();h.c.calView='day';delete h.doc.vision;const before=JSON.stringify(h.doc),html=h.c.rCal();
  assert.match(html,/저장한 행동 문장/);assert.equal(html.includes('당시 내 방향'),false);assert.equal((html.match(/class="idp-evidence"/g)||[]).length,1);assert.equal(JSON.stringify(h.doc),before);assert.equal(h.writes(),0);
});

test('actual current week wrap renders a collapsed seven-day scene list without new inputs or writes',()=>{
  const h=appHarness(),before=JSON.stringify(h.doc),html=h.c.rWeekWrapCard({wk:'2026-09-07',next:'2026-09-14',late:false});
  assert.match(html,/idp-evidence-week/);assert.match(html,/실제로 보인 장면/);assert.match(html,/저장한 행동 문장/);assert.equal((html.match(/id="olGood"/g)||[]).length,1);assert.equal(JSON.stringify(h.doc),before);assert.equal(h.writes(),0);
});

for(const folded of [false,true])test('actual weekly reflection keeps scene list visible while reflection editor '+(folded?'is folded':'is open'),()=>{
  const h=appHarness();if(folded)h.doc.weekly['2026-09-07']={good:'회고',better:''};const before=JSON.stringify(h.doc),html=h.c.rWeeklyCard();
  assert.match(html,/idp-evidence-week/);assert.match(html,/실제로 보인 장면/);assert.equal(html.includes('id="wrGood"'),!folded);assert.equal(JSON.stringify(h.doc),before);assert.equal(h.writes(),0);
});
