'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=f=>fs.readFileSync(require('node:path').join(__dirname,'../studio',f),'utf8');
function part(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j);}
const processSource=read('process.html'),storage=read('storage.js'),scout=read('scout.html');
const groupCode=part(storage,'  function groupKind(','  window.PSSchedule=');
function group(){const c=vm.createContext({});vm.runInContext(groupCode,c);return c;}
test('A OFF and B training survive round-trip without changing either saved session',()=>{
 const c=group(),day={off:true,board:{sched:'OFF'},groupKinds:{A:'OFF',B:'훈련'},trainings:[{grp:['A'],title:'A 원본'},{grp:['B'],title:'B 원본'}],match:{opp:'보존'},matchAdd:[{opp:'추가 경기'}]};
 const raw=JSON.stringify(day),saved=JSON.parse(raw),a=c.groupDay(saved,'A'),b=c.groupDay(saved,'B');
 assert.equal(a.off,true);assert.equal(a.trainings.length,0);assert.equal(b.off,false);assert.equal(b.board.sched,'훈련');assert.equal(b.trainings.length,1);assert.equal(b.trainings[0].title,'B 원본');assert.equal(b.match,undefined);assert.equal(b.matchAdd,undefined);assert.equal(JSON.stringify(saved),raw);
});
test('unset and invalid group overrides retain legacy schedules',()=>{
 const c=group(),day={off:true,board:{sched:'OFF'},groupKinds:{A:'invalid'}};
 assert.equal(c.groupKind(day,'A'),'');assert.equal(c.groupDay(day,'A').off,true);assert.equal(c.groupDay(day,'B').board.sched,'OFF');
});
test('group OFF setter never removes another group or its training',()=>{
 const c=vm.createContext({window:{},week:[{trainings:[{grp:['B']}],groupKinds:{B:'훈련'}}],schedEditBlocked:()=>false,save(){},syncViews(){}});
 vm.runInContext(part(processSource,'function wksSetGroupKind(','function wksGroupDays('),c);
 c.wksSetGroupKind(0,'A','OFF');assert.equal(c.week[0].groupKinds.B,'훈련');assert.equal(c.week[0].trainings.length,1);c.wksSetGroupKind(0,'A','');assert.equal(c.week[0].groupKinds.A,undefined);assert.equal(c.week[0].groupKinds.B,'훈련');
});
test('opponent input uses value immediately and contenteditable still uses text',()=>{
 const day={match:{opp:'old'},board:{}};let saves=0;
 const c=vm.createContext({week:[day],schedEditBlocked:()=>false,dayBoard:d=>d.board,save(){saves++},document:{getElementById:()=>null},renderMix(){}});
 vm.runInContext(part(processSource,'function wkbdSave(','window.__drillPickList='),c);
 c.wkbdSave({dataset:{di:'0',f:'opp'},value:'새 상대',innerText:''});assert.equal(day.match.opp,'새 상대');assert.equal(day.board.opp,'새 상대');
 c.wkbdSave({dataset:{di:'0',f:'opp'},innerText:'다른 상대'});assert.equal(day.match.opp,'다른 상대');assert.equal(saves,2);
});
test('opponent save respects edit permission',()=>{
 const day={match:{opp:'keep'}};const c=vm.createContext({week:[day],schedEditBlocked:()=>true,schedBlockNotice(){}});vm.runInContext(part(processSource,'function wkbdSave(','window.__drillPickList='),c);c.wkbdSave({dataset:{di:'0',f:'opp'},value:'deny'});assert.equal(day.match.opp,'keep');
});
function brand(options={}){
 let latest={attrs:[],positions:[],players:[{name:'새 선수'}],meta:{emblem:'new-logo',color:'#123456',headline:'새 문구'}},writes=0;
 const c=vm.createContext({data:{meta:{emblem:'stale-logo',color:'#000000'}},KEY:'main',teamSaveOwner:()=>options.owner||'team-a',scoutAutomaticWriteAllowed:()=>!options.denied,toast(){},teamEmblemApply(){},psTeamMetaPing(){},store:{get:()=>latest,set(k,v){if(options.fail)return false;latest=v;writes++;return true;}}});
 vm.runInContext(part(scout,'function teamBrandSave(','/* ── 1.891'),c);return {c,latest:()=>latest,writes:()=>writes};
}
test('changing team color preserves latest emblem and players, not stale frame metadata',()=>{
 const h=brand();assert.equal(h.c.teamBrandSave('color','#abcdef'),true);assert.equal(h.latest().meta.emblem,'new-logo');assert.equal(h.latest().meta.headline,'새 문구');assert.equal(h.latest().players[0].name,'새 선수');assert.equal(h.latest().meta.color,'#abcdef');
});
test('late emblem upload cannot write to a different team',()=>{const h=brand({owner:'team-b'});assert.equal(h.c.teamBrandSave('emblem','old-upload','team-a'),false);assert.equal(h.writes(),0);});
test('failed or denied branding save cannot report success',()=>{for(const options of [{fail:true},{denied:true}]){const h=brand(options);assert.equal(h.c.teamBrandSave('color','#ffffff'),false);assert.equal(h.latest().meta.color,'#123456');}});
test('explicit emblem reset keeps team color and player data',()=>{const h=brand();assert.equal(h.c.teamBrandSave('emblem',''),true);assert.equal(h.latest().meta.emblem,undefined);assert.equal(h.latest().meta.color,'#123456');assert.equal(h.latest().players.length,1);});
test('late playbook library callback preserves a newly focused input',()=>{
 let active=null,callback,paints=0;const c=vm.createContext({document:{get activeElement(){return active;}},readLib(cb){callback=cb;},render(){paints++},lib:null});
 vm.runInContext(part(read('playbook.html'),'  function refreshPlaybook(){','  window.addEventListener(\'message\''),c);c.refreshPlaybook();active={tagName:'TEXTAREA'};callback([]);assert.equal(paints,0);active=null;c.refreshPlaybook();callback([]);assert.equal(paints,1);
});
test('OFF sessions are excluded from weekly counts, including a selected group',()=>{
 const c=vm.createContext({__schedGrp:''});vm.runInContext(part(processSource,'function daySessionCount(','function weekSummaryCount('),c);
 const day={board:{sched:'훈련'},groupKinds:{A:'OFF',B:'훈련'},trainings:[{grp:['A']},{grp:['B']}]};
 assert.equal(c.daySessionCount(day),1);c.__schedGrp='A';assert.equal(c.daySessionCount(day),0);c.__schedGrp='B';assert.equal(c.daySessionCount(day),1);assert.equal(day.trainings.length,2);
});
test('ordinary roster persistence cannot overwrite newer branding',()=>{
 let stored;const c=vm.createContext({KEY:'main',store:{get:()=>({meta:{color:'#abcdef',headline:'latest'}}),set(k,v){stored=v;return true;}},rosterRemember(){},rosterSaveMirrors:()=>true});
 vm.runInContext(part(scout,'function rosterPersist(','function rosterProject('),c);
 const main={players:[],meta:{emblem:'stale-logo',color:'#000000',headline:'old',formation:'4-4-2'}};
 assert.equal(c.rosterPersist(main,{skipItems:true}),true);assert.equal(stored.meta.emblem,undefined);assert.equal(stored.meta.color,'#abcdef');assert.equal(stored.meta.headline,'latest');assert.equal(stored.meta.formation,'4-4-2');
});
test('adding group training keeps global OFF and assigns the intended group before saving',()=>{
 const day={off:true,board:{sched:'OFF'},trainings:[]};let atSave;
 const c=vm.createContext({window:{},week:[day],schedEditBlocked:()=>false,wksCommonTime:()=> '17:00',sesDefaults:t=>({...t,grp:['A']}),dayBoard:d=>d.board,save(){atSave=JSON.parse(JSON.stringify(day));},syncViews(){}});
 vm.runInContext(part(processSource,'window.wksAddSession=function(','/* 2.483'),c);c.window.wksAddSession(0,['B']);
 assert.equal(atSave.off,true);assert.equal(atSave.board.sched,'OFF');assert.deepEqual(atSave.trainings[0].grp,['B']);
});
