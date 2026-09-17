'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/scout.html'),'utf8');
const start=source.indexOf('function setView(v){'),end=source.indexOf('  if(v==="report"){',start);
function fixture(active,canLeave=true){let closes=0;const c=vm.createContext({document:{documentElement:{classList:{remove(){}}}},matchCanLeaveWork:()=>canLeave,$:()=>({classList:{contains:()=>active}}),avClosePicker:()=>closes++,availDay:'2026-09-15',availMode:'totals',availPlayer:'p'});vm.runInContext(source.slice(start,end)+'return v;}',c);return {c,closes:()=>closes};}
test('all former status entry points route to today availability',()=>{const h=fixture(false);assert.equal(h.c.setView('status'),'avail');assert.equal(h.c.availDay,null);assert.equal(h.c.availMode,'days');assert.equal(h.c.availPlayer,null);assert.equal(h.closes(),1);});
test('active availability retains the selected historical day',()=>{const h=fixture(true);assert.equal(h.c.setView('avail'),'avail');assert.equal(h.c.availDay,'2026-09-15');assert.equal(h.closes(),0);});
test('blocked navigation does not reset an unsaved screen',()=>{const h=fixture(false,false);assert.equal(h.c.setView('status'),undefined);assert.equal(h.c.availDay,'2026-09-15');assert.equal(h.closes(),0);});
test('date cards count the same full roster as the daily list, with schedule-only KPIs separate',()=>{
 const a=source.indexOf('      var days=[],sumOk=0,sumRec=0,trainDays=0,offDays=0;'),b=source.indexOf('      var pct=',a);
 const c=vm.createContext({Date,N:1,today:'2026-09-15',ours:[{id:1},{id:2},{id:3}],stAddDays:d=>d,avDayKind:()=> 'match',avScheduled:k=>['train','match'].includes(k),avResolve:p=>({s:p.id===3?'injury':'ok',kind:p.id===2?'off':'match'})});
 vm.runInContext(source.slice(a,b),c);assert.equal(c.days[0].c.ok,2);assert.equal(c.days[0].c.injury,1);assert.equal(c.days[0].c.rec,3);assert.equal(c.sumOk,1);assert.equal(c.sumRec,2);
});
