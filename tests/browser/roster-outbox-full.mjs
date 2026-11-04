// 3.253 — 제보 e6fc5d26 의 기기 그대로: 작은 저장소가 예전 판의 «올라갈 차례인 선수 변경» 묶음으로 가득 찬 채 앱을 연다.
// 실제 앱 · 합성 팀 · 합성 서버만 쓴다. 정리(prune)가 자리를 만들면 선수 추가가 저장되고, 밀려 있던 선수들도 서버에 올라가며 묶음이 비워져야 한다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,ready,SIZES,WT,A} from '../fixtures/team-app.mjs';

const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||'/tmp/ps-roster-outbox-full-browser';
fs.mkdirSync(out,{recursive:true});SIZES.desktop={...SIZES.desktop,engine};
const fx=await startFixture(),browsers={};let app;
const PFX='ps_roster_pending_v1:'+encodeURIComponent(A)+':'+encodeURIComponent(WT)+':';
try{
  app=await openApp(fx,'desktop',{browsers,init:{fn:({PFX,uid,wid})=>{
    /* 한 번만(맨 위 창): 예전 판이 저장할 때마다 같은 선수들을 다시 쓴 묶음 — 6명을 한 명씩 더하고 그때마다 8번 저장, 서버 확인은 한 번도 없음 */
    if(window.top===window&&!localStorage.getItem('fixture_bloat_seeded')){
      const pend={},dedupe=rows=>{const s=new Set(),o=[];for(const r of rows){const j=JSON.stringify(r);if(!s.has(j)){s.add(j);o.push(JSON.parse(j));}}return o;};
      const roster=[];let seq=0;
      for(let k=1;k<=6;k++){
        roster.push({id:'bloat'+k,name:'밀린 선수 '+k,num:String(70+k),type:'ours',posId:'',levels:{},memo:'합성 메모 '.repeat(60),manual:true});
        for(let r=0;r<8;r++){
          seq++;const t='legacy-'+String(seq).padStart(6,'0');
          const rows=roster.map((x,i)=>({id:x.id,base:null,player:x,deleted:false,token:t+':'+i,history:pend[x.id]?dedupe(pend[x.id].history.concat([pend[x.id].player])):[]}));
          rows.forEach(r=>{pend[r.id]={player:r.player,history:r.history};});
          localStorage.setItem(PFX+'b:'+t,JSON.stringify({v:1,kind:'batch',uid,wid,token:t,seq,rows}));
        }
      }
      localStorage.setItem('fixture_bloat_seeded','1');
      let n=0,o=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i),v=localStorage.getItem(k).length;n+=k.length+v;if(k.startsWith(PFX))o+=k.length+v;}
      localStorage.setItem('fixture_outbox_seed',String(o));n+=('fixture_outbox_seed'+o).length;
      localStorage.setItem('fixture_ls_cap',String(n+4096));
    }
    /* 모든 창: 작은 저장소 한도(넘으면 QuotaExceededError) — 실제 기기처럼 가득 찬 상태 */
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
      const cap=Number(localStorage.getItem('fixture_ls_cap')||Infinity);
      if(this===localStorage&&Number.isFinite(cap)){
        let n=0;for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key!==k)n+=key.length+localStorage.getItem(key).length;}
        if(n+String(k).length+String(v).length>cap){const top=window.top;top.fixtureQuota=(top.fixtureQuota||0)+1;throw new DOMException('fixture full localStorage','QuotaExceededError');}
      }
      return set.call(this,k,v);
    };
  },arg:{PFX,uid:A,wid:WT}}});
  const {page}=app;await ready(page);
  async function openPlayers(){
    await page.locator('#appSeg [data-team-hub]').click();await page.locator('#teamNav [data-team-key="players"]').click();
    const frame=await (await page.locator('#fScout').elementHandle()).contentFrame();
    try{await frame.waitForFunction(()=>typeof data!=='undefined'&&!scoutBootPending&&scoutDataLoaded&&data.players.some(p=>p.name==='가상 선수 1'),null,{timeout:45000});}
    catch(e){const why=await frame.evaluate(()=>({boot:typeof scoutBootPending!=='undefined'?scoutBootPending:'?',loaded:typeof scoutDataLoaded!=='undefined'?scoutDataLoaded:'?',names:typeof data!=='undefined'?data.players.map(p=>p.name):null,quota:window.top.fixtureQuota||0,rescue:(()=>{try{return rosterOutbox().hasRescue();}catch(x){return 'err:'+x.message;}})(),prepared:(()=>{try{return rosterOutbox().prepared();}catch(x){return 'err:'+x.message;}})(),failure:(()=>{try{const f=rosterOutbox().failure();return f&&f.message;}catch(x){return 'err:'+x.message;}})()})).catch(x=>({evalError:String(x)}));
      fs.writeFileSync(path.join(out,engine+'-open-failure.json'),JSON.stringify({why,logs:app.logs.slice(-40)},null,2));throw e;}
    return frame;
  }
  const frame=await openPlayers();
  const outboxBytes=()=>page.evaluate(PFX=>{let n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(PFX))n+=k.length+localStorage.getItem(k).length;}return n;},PFX);
  const before={bytes:Number(await page.evaluate(()=>localStorage.getItem('fixture_outbox_seed'))),atOpen:await outboxBytes(),names:await frame.evaluate(()=>data.players.map(p=>p.name))};
  assert.ok(before.bytes>40000,'the seeded legacy outbox is large '+before.bytes);
  assert.ok(before.names.includes('밀린 선수 6'),'the pending players are on the device roster');
  /* the coach adds one more player on the full device */
  await frame.locator('#tmAdd').click();await frame.locator('[data-k="name"]').fill('합성 새 선수');await frame.locator('[data-k="num"]').fill('99');await frame.locator('[data-act="ok"]').click();
  await frame.waitForFunction(()=>data.players.some(p=>p.name==='합성 새 선수'));
  const want=['밀린 선수 1','밀린 선수 2','밀린 선수 3','밀린 선수 4','밀린 선수 5','밀린 선수 6','합성 새 선수'];
  const onServer=()=>[...fx.db.values()].filter(r=>r.workspace_id===WT&&r.k.startsWith('sq:')).map(r=>JSON.parse(r.v).name);
  const deadline=Date.now()+60000;let done=false,last=null;
  while(Date.now()<deadline){
    await page.evaluate(()=>PSSync.syncNow('fixture-roster-outbox-full')).catch(()=>{});
    last={server:onServer(),pending:await frame.evaluate(()=>{try{return rosterPendingRows();}catch(e){return 'error:'+e.message;}}),bytes:await outboxBytes()};
    if(want.every(n=>last.server.includes(n))&&last.pending===false){done=true;break;}
    await page.waitForTimeout(1500);
  }
  const after={...last,quota:await page.evaluate(()=>window.fixtureQuota||0)};
  fs.writeFileSync(path.join(out,engine+'-results.json'),JSON.stringify({engine,before,after,logs:app.logs},null,2));
  await page.screenshot({path:path.join(out,engine+'-after.png')});
  assert.ok(done,'every pending player and the new one reach the server and the outbox empties '+JSON.stringify(after));
  assert.ok(after.bytes<before.bytes/4,'the outbox space is reclaimed '+before.bytes+' → '+after.bytes);
  assert.deepEqual(app.logs.filter(x=>x.type==='pageerror'),[],'no runtime error');
  console.log(JSON.stringify({engine,beforeBytes:before.bytes,afterBytes:after.bytes,server:after.server.length,quotaHits:after.quota}));
}finally{
  if(app)await app.context.close();for(const browser of Object.values(browsers))await browser.close();await fx.close();
}
