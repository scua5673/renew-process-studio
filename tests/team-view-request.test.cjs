'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const start=html.indexOf('function sendTeamView(fr,b){'),end=html.indexOf('function activeWorkspace()',start);
assert.ok(start>=0&&end>start);
function harness(){
 const timers=[],loads=[],views=[],clicks=[];let shown='home';
 const frame={__psReady:false,contentDocument:{readyState:'loading',querySelector(selector){if(selector==='.view.on')return shown?{id:shown+'View'}:null;return {classList:{contains:()=>false},click(){clicks.push(selector);}};}},
  contentWindow:{location:{href:'https://fixture.test/studio/scout.html'},postMessage(message){views.push(message.view);}},addEventListener(type,callback){assert.equal(type,'load');loads.push(callback);}};
 const c=vm.createContext({currentTeamKey:'today',fScout:frame,document:{body:{dataset:{psApp:'scout'}}},showApp(){},psSchedPhone:()=>false,psSchedOpenMode:mode=>mode,setTimeout(callback,delay){timers.push({callback,delay});}});
 vm.runInContext(html.slice(start,end),c);
 const followStart=html.indexOf("} else if(d.source==='scout' && d.type==='teamViewNow'){")+"} else if(d.source==='scout' && d.type==='teamViewNow'){".length,followEnd=html.indexOf("} else if(d.source==='scout' && d.type==='openGameModel')",followStart);
 assert.ok(followEnd>followStart);vm.runInContext('function followTeamView(d){'+html.slice(followStart,followEnd)+'}',c);
 return {frame,views,clicks,
  notify(view,current=view){shown=current;c.followTeamView({view});return c.currentTeamKey;},
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
test('frame intent is available before its data initialization completes',()=>{
 const h=harness();h.select('today','home');h.select('players','team');assert.equal(h.frame.__psTeamViewTarget,'team');
 h.ready();h.load();h.flush();assert.deepEqual(h.views,['team']);
});
test('the initial child view cannot cancel a pending selection; later child navigation still follows',()=>{
 const h=harness();h.select('players','team');assert.equal(h.notify('home'),'players');h.ready();h.load();h.flush();
 assert.deepEqual(h.views,['team']);assert.equal(h.notify('team'),'players');assert.equal(h.notify('avail'),'avail');
});
test('queued old child notifications cannot replace the current scouting selection',()=>{
 const h=harness();h.ready();h.select('scouting','players');h.flush();
 assert.equal(h.notify('home','players'),'scouting');
 assert.equal(h.notify('team','players'),'scouting');
 assert.equal(h.notify('players'),'scouting');
 assert.equal(h.notify('avail'),'avail','current child navigation still follows');
});
test('a child notification without a current visible view does not change selection',()=>{
 const h=harness();h.ready();h.select('scouting','players');h.flush();
 assert.equal(h.notify('home',null),'scouting');
});
test('scout initialization preserves the frame intent, standalone default and attrs deep link',()=>{
 const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
 const start=scout.indexOf('  var _vh=/^#view=(attrs)$/'),end=scout.indexOf('\n}',start);assert.ok(start>=0&&end>start);
 for(const [target,hash,want] of [['team','','team'],['players','','players'],['match','','match'],['','','home'],['team','#view=attrs','attrs']]){
  const views=[],c=vm.createContext({window:{frameElement:target?{__psTeamViewTarget:target}:null},location:{hash},setView:v=>views.push(v)});
  vm.runInContext(scout.slice(start,end),c);assert.deepEqual(views,[want]);
 }
});
