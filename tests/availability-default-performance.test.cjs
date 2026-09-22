'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../studio/participation.js'),source=fs.readFileSync(require.resolve('../studio/scout.html'),'utf8');
function part(a,b){return source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));}
test('unchecked scheduled days count as participation without writing observations or counting OFF as training',()=>{
 const meta={};const before=JSON.stringify(meta);
 const t=P.totals(meta,'p','2026-09-01','2026-09-04',d=>d==='2026-09-02'?'off':d==='2026-09-03'?'match':'train','ok','2026-09-04',true);
 assert.equal(t.training,2);assert.equal(t.match,1);assert.equal(t.unknown,0);assert.equal(t.recorded,0);assert.equal(JSON.stringify(meta),before);
 assert.equal(P.resolve(meta,'p','2026-09-05','train','ok','2026-09-04',true).source,'none');
});
test('today edit persists through unopened days and reload until explicitly changed',()=>{
 const c=vm.createContext({stAddDays:(d,n)=>{let v=new Date(d+'T00:00:00Z');v.setUTCDate(v.getUTCDate()+n);return v.toISOString().slice(0,10);}});
 vm.runInContext(part('function avCurrentStatus(','async function stSetAt('),c);
 let meta=P.record({},'p','2026-09-02','injury','train',1,'2026-09-02','발목');c.avCurrentStatus(meta,'p','injury','2026-09-02','발목');
 meta=JSON.parse(JSON.stringify(meta));
 for(const day of ['2026-09-03','2026-09-06','2026-09-08'])assert.equal(P.resolve(meta,'p',day,'train','injury','2026-09-08',true).s,'injury');
 c.avCurrentStatus(meta,'p','ok','2026-09-09','복귀');
 assert.equal(P.resolve(meta,'p','2026-09-08','train','ok','2026-09-12',true).s,'injury');
 assert.equal(P.resolve(meta,'p','2026-09-10','train','ok','2026-09-12',true).s,'ok');
 assert.equal(P.resolve(meta,'p','2026-09-01','train','ok','2026-09-12',true).s,'ok');
});
test('invalid explicit records remain unknown even with default participation',()=>{
 assert.equal(P.resolve({participationDays:{'2026-09-01':{p:{s:'bad'}}}},'p','2026-09-01','train','ok','2026-09-02',true).source,'none');
});
test('90 days × 40 players read each group schedule only once per render, with fresh reads afterward',()=>{
 let reads=0,anchors=0,kind='훈련';const c=vm.createContext({Map,window:{PSSchedule:{read(){},readFor(){reads++;return {weeks:{0:[{board:{sched:kind}}]}};},anchor:()=>{anchors++;return '2026-08-31';},cellOf:(_date,base)=>{if(!base)anchors++;return {wk:0,di:0};},hasMatch:()=>false}}});
 vm.runInContext(part('var avRenderCache=null;','/* ══ 2.538'),c);
 c.avRenderCache={schedules:new Map()};
 for(let d=0;d<90;d++)for(let p=0;p<40;p++)assert.equal(c.avDayKind(new Date('2026-09-01'),p%2?'A':'B'),'train');
 assert.equal(reads,2);assert.equal(anchors,1);
 c.avRenderCache=null;kind='OFF';assert.equal(c.avDayKind(new Date('2026-09-01'),'A'),'off');assert.equal(reads,3);
 c.avRenderCache={schedules:new Map()};assert.equal(c.avDayKind(new Date('2026-09-01'),'A'),'off');assert.equal(reads,4);
 assert.match(source,/finally\{avRenderCache=null;\}/);
});
