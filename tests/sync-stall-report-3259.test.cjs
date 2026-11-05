'use strict';
/* 3.259 — 막힌 기기 미리 알아채기(studio/sync-stall-report.js). 올라갈 팀 변경이 있는데 몇 시간째 회차가 하나도 안 끝나면
   ps_events sync_stalled 한 줄 — 내용 없이 숫자 · 단계 이름만. 같은 기기에서 6시간에 한 번, 저장소가 가득 차도 그 창에서는 한 번. */
const test=require('node:test'),assert=require('node:assert/strict');
const Stall=require('../studio/sync-stall-report.js');
const H=3600000,NOW=Date.UTC(2026,10,4,12,0,0);
const base=over=>({now:NOW,bootAt:NOW-10*60000,signedIn:true,unlocked:true,online:true,visible:true,pending:{count:4,oldest:NOW-5*24*H},lastPull:0,sentAt:0,...over});

test('a device with old pending changes and no finished round is stalled',()=>{
  assert.deepEqual(Stall.assess(base()),{stalled:true,why:'stalled'});
  assert.equal(Stall.assess(base({lastPull:NOW-3*H})).stalled,true,'last finished round 3h ago');
});

test('ordinary states are not reported',()=>{
  const why=o=>Stall.assess(base(o)).why;
  assert.equal(why({signedIn:false}),'locked');
  assert.equal(why({unlocked:false}),'locked');
  assert.equal(why({online:false}),'offline');
  assert.equal(why({visible:false}),'hidden');
  assert.equal(why({bootAt:NOW-60000}),'boot','the first rounds after opening get 5 minutes');
  assert.equal(why({pending:{count:0,oldest:0}}),'empty');
  assert.equal(why({pending:{count:2,oldest:NOW-30*60000}}),'fresh','changes made half an hour ago are not stuck yet');
  assert.equal(why({lastPull:NOW-20*60000}),'recent','a round finished 20 minutes ago');
  assert.equal(why({sentAt:NOW-5*H}),'sent','once every 6 hours');
  assert.equal(why({sentAt:NOW-7*H}),'stalled');
  assert.equal(why({bootAt:NOW-1000,graceMs:0}),'stalled','tests can shorten the grace');
});

test('meta carries only numbers and step names that the event filter keeps',()=>{
  const diag=[{stage:'autosave',code:'',at:NOW-9e5},{stage:'items-write',code:'sync_local_changed',at:NOW-6e5},{stage:'scout-local-split',code:'',at:NOW-1e5}];
  const m=Stall.meta(base({lastPull:NOW-3*H,diag,state:{kind:'bad',reason:'sync_storage',text:'못 올렸어요 · 김민재'},localBytes:4.9*1048576,
    locks:{held:1,pending:2},quota:{useMb:59,quotaMb:10299},standalone:true}));
  assert.deepEqual(m,{n:4,oh:120,ph:3,ls:5018,stage:'scout-local-split',msg:'autosave,items-write:sync_local_changed,scout-local-split',reason:'sync_storage',sa:true,lh:1,lq:2,useMb:59,quotaMb:10299});
  assert.ok(Object.keys(m).length<=12,'safeEventMeta keeps the first 12 keys');
  for(const [k,v] of Object.entries(m))if(typeof v==='string')assert.ok(['stage','msg','reason'].includes(k),k+' is a string key the filter keeps');
  assert.ok(!JSON.stringify(m).includes('김민재'),'no user text from the status line');
  assert.equal(Stall.meta(base()).ph,-1,'never finished a round');
  assert.equal(Stall.meta(base({diag:Array.from({length:20},(_,i)=>({stage:'very-long-stage-name-'+i,code:'some_long_code_value_'+i}))})).msg.length<=120,true);
});

function fakeWindow({full=false,pending={count:3,oldest:Date.now()-4*H},lastPull=Date.now()-4*H}={}){
  const ls=new Map(),events=[];
  if(lastPull)ls.set('ps_last_pull_at',String(lastPull));
  const win={__psSyncStallGraceMs:0,navigator:{onLine:true,locks:{query:async()=>({held:[{name:'process-studio-sync-w1'},{name:'other'}],pending:[{name:'process-studio-sync-w1'}]})},storage:{estimate:async()=>({usage:5*1048576,quota:100*1048576})}},
    document:{visibilityState:'visible',addEventListener(){}},setInterval(){},setTimeout(){},matchMedia:()=>({matches:false}),
    localStorage:{getItem:k=>ls.has(k)?ls.get(k):null,setItem(k,v){if(full)throw Object.assign(Error('full'),{name:'QuotaExceededError'});ls.set(k,String(v));}},
    PSStorage:{localBytes:()=>2048*1024},
    PSSync:{session:()=>({uid:'u'}),dataUnlocked:()=>true,pending:()=>pending,state:()=>({kind:'bad',reason:'sync_storage'}),diagLog:()=>[{stage:'items-write',code:'sync_local_changed'}],event:(name,o)=>events.push({name,...o})}};
  win.top=win;return {win,ls,events};
}
function fresh(){delete require.cache[require.resolve('../studio/sync-stall-report.js')];return require('../studio/sync-stall-report.js');}

test('mounted: one event, then quiet for 6 hours (stored on the device)',async()=>{
  const S=fresh(),{win,ls,events}=fakeWindow();S.mount(win);
  const r=await S.check();
  assert.equal(r.stalled,true);assert.equal(events.length,1);
  assert.equal(events[0].name,'sync_stalled');assert.equal(events[0].status,'error');assert.equal(events[0].feature,'sync');assert.equal(events[0].error_code,'sync_storage');
  assert.equal(events[0].meta.n,3);assert.equal(events[0].meta.lh,1,'only the app sync lock is counted');assert.equal(events[0].meta.lq,1);
  assert.equal(events[0].meta.ls,2048);assert.equal(events[0].meta.useMb,5);assert.equal(events[0].meta.quotaMb,100);
  assert.ok(+ls.get(S.KEY)>0,'remembered on the device');
  assert.equal((await S.check()).why,'sent');assert.equal(events.length,1);
});

test('mounted on a full device: still one event per window',async()=>{
  const S=fresh(),{win,events}=fakeWindow({full:true});S.mount(win);
  await S.check();await S.check();
  assert.equal(events.length,1,'memory keeps it to one when the device cannot store the time');
});

test('mounted: nothing pending or a recent round sends nothing',async()=>{
  let S=fresh(),w=fakeWindow({pending:{count:0,oldest:0}});S.mount(w.win);
  assert.equal((await S.check()).why,'empty');assert.equal(w.events.length,0);
  S=fresh();w=fakeWindow({lastPull:Date.now()-60000});S.mount(w.win);
  assert.equal((await S.check()).why,'recent');assert.equal(w.events.length,0);
});
