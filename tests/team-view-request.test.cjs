'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const start=html.indexOf('function sendTeamView(fr,b){'),end=html.indexOf('function activeWorkspace()',start);
assert.ok(start>=0&&end>start);
function harness(){
 const timers=[],loads=[],views=[],clicks=[];
 const frame={__psReady:false,contentDocument:{readyState:'loading',querySelector(selector){return {classList:{contains:()=>false},click(){clicks.push(selector);}};}},
  contentWindow:{location:{href:'https://fixture.test/studio/scout.html'},postMessage(message){views.push(message.view);}},addEventListener(type,callback){assert.equal(type,'load');loads.push(callback);}};
 const c=vm.createContext({currentTeamKey:'today',psSchedPhone:()=>false,psSchedOpenMode:mode=>mode,setTimeout(callback,delay){timers.push({callback,delay});}});
 vm.runInContext(html.slice(start,end),c);
 return {frame,views,clicks,
  select(key,view,mode){c.currentTeamKey=key;c.sendTeamView(frame,{dataset:{teamView:view,processMode:mode}});},
  leave(){c.currentTeamKey='';},
  ready(){frame.__psReady=true;frame.contentDocument.readyState='complete';},
  load(){for(const callback of loads.splice(0))callback();},
  flush(){for(const {callback} of timers.splice(0).sort((a,b)=>a.delay-b.delay))callback();}};
}
test('a delayed home request cannot overwrite the newer ready-frame roster request',()=>{
 const h=harness();h.select('today','home');h.ready();h.select('players','team');h.load();h.flush();
 assert.deepEqual(h.views,['team']);
});
test('multiple requests before frame load apply only the last selection',()=>{
 const h=harness();h.select('today','home');h.select('players','team');h.select('match','match');h.ready();h.load();h.flush();
 assert.deepEqual(h.views,['match']);
});
test('leaving team navigation cancels its pending view',()=>{
 const h=harness();h.select('players','team');h.leave();h.ready();h.load();h.flush();assert.deepEqual(h.views,[]);
});
test('returning to the same tab does not revive its older request',()=>{
 const h=harness();h.select('today','home');h.ready();h.select('players','team');h.select('today','home');h.load();h.flush();
 assert.deepEqual(h.views,['home']);
});
test('schedule modes also discard stale requests and apply the current mode',()=>{
 const h=harness();h.select('training',null,'week');h.ready();h.select('review',null,'review');h.load();h.flush();
 assert.deepEqual(h.clicks,['#topNav [data-go="review"]']);
});
test('an uncontested initial view still waits for the real document',()=>{
 const h=harness();h.select('today','home');h.flush();assert.deepEqual(h.views,[]);
 h.ready();h.load();h.flush();assert.deepEqual(h.views,['home']);
});
