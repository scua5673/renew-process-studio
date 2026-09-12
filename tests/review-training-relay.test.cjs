'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../studio/app.html'),'utf8');
const start=source.indexOf('    function reviewTrainingOwner(d){'),end=source.indexOf('      /* 보관함 공통 셸 전환',start);
assert.ok(start>0&&end>start);
const code=source.slice(start,end)+'\n});';
function fixture(){
  const listeners=[],messages=[],timers=[],navigation=[];
  let uid='coach',wid='team',unlocked=true;
  const frame=name=>({contentDocument:{readyState:'complete'},contentWindow:{postMessage:(data,origin)=>messages.push({name,data,origin})}});
  const c={location:{origin:'https://fixture.invalid'},localStorage:{getItem:()=>wid},fScout:frame('scout'),fProcess:frame('process'),
    PSSync:{session:()=>({uid}),dataUnlocked:()=>unlocked},setTimeout:fn=>timers.push(fn),
    teamKeyBtn:key=>({key}),openTeamButton:button=>navigation.push(button.key),showApp:name=>navigation.push(name),
    addEventListener:(type,fn)=>listeners.push(fn),toast:()=>{}};
  c.window=c;vm.runInNewContext(code,c,{filename:'actual app training relay'});
  return {c,messages,timers,navigation,
    send(data={},extra={}){listeners[0]({origin:c.location.origin,source:c.fScout.contentWindow,data:{source:'scout',type:'reviewTrainingOpen',uid:'coach',wid:'team',matchId:'match-1',requestId:'request-1',...data},...extra});},
    change(value){if(value.uid!==undefined)uid=value.uid;if(value.wid!==undefined)wid=value.wid;if(value.unlocked!==undefined)unlocked=value.unlocked;}};
}
test('actual shell routes a trusted open to the schedule with its identifiers intact',()=>{
  const h=fixture();h.send();assert.deepEqual(h.navigation,['training']);assert.equal(h.messages.length,1);
  assert.equal(h.messages[0].name,'process');assert.equal(h.messages[0].data.matchId,'match-1');
  assert.equal(h.messages[0].data.source,'app');assert.equal(h.messages[0].origin,'https://fixture.invalid');
});
for(const [name,data,extra] of [
  ['foreign origin',{}, {origin:'https://foreign.invalid'}],['other window',{}, {source:{}}],
  ['claimed wrong source',{source:'process'},{}],['old account',{uid:'former'},{}],['old team',{wid:'former'},{}],
])test(`training relay rejects ${name}`,()=>{
  const h=fixture();h.send(data,extra);assert.deepEqual(h.navigation,[]);assert.deepEqual(h.messages,[]);
});
test('loading the schedule waits for its actual frame, and a changed owner cancels delayed delivery',()=>{
  const h=fixture();h.c.fProcess.contentDocument.readyState='loading';h.send();assert.equal(h.messages.length,0);assert.equal(h.timers.length,1);
  h.change({uid:'another'});h.c.fProcess.contentDocument.readyState='complete';h.timers.shift()();assert.equal(h.messages.length,0);
});
test('a prepared frame receives its request once after loading',()=>{
  const h=fixture();h.c.fProcess.contentDocument.readyState='loading';h.send();h.c.fProcess.contentDocument.readyState='complete';h.timers.shift()();
  assert.equal(h.messages.length,1);assert.equal(h.messages[0].data.requestId,'request-1');assert.equal(h.timers.length,0);
});
test('saved events refresh the match frame without navigating away from training',()=>{
  const h=fixture();h.send({source:'process',type:'reviewTrainingSaved',taskId:'task-1'},{source:h.c.fProcess.contentWindow});
  assert.deepEqual(h.navigation,[]);assert.equal(h.messages[0].name,'scout');assert.equal(h.messages[0].data.taskId,'task-1');
});
test('only the actual schedule frame can route back to a match',()=>{
  const h=fixture();h.send({source:'process',type:'reviewTrainingBack'});assert.equal(h.messages.length,0);
  h.send({source:'process',type:'reviewTrainingBack'},{source:h.c.fProcess.contentWindow});assert.deepEqual(h.navigation,['match']);assert.equal(h.messages[0].name,'scout');
});
test('locked account data never routes a training operation',()=>{
  const h=fixture();h.change({unlocked:false});h.send();assert.deepEqual(h.messages,[]);assert.deepEqual(h.navigation,[]);
});
