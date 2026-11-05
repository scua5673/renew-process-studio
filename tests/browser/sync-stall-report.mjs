// 3.259 — 막힌 기기 미리 알아채기: 실제 앱(합성 팀 · 합성 서버)에서 «올라갈 변경이 5일째 남고 회차가 5일째 안 끝난 기기»를 만들면
// ps_events sync_stalled 한 줄이 서버에 닿는다 — 숫자 · 단계 이름만, 같은 창에서 다시 부르면 보내지 않는다. 멀쩡한 기기는 보내지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,ready} from '../fixtures/team-app.mjs';

const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||'/tmp/ps-sync-stall-browser';
fs.mkdirSync(out,{recursive:true});
const fx=await startFixture(),browsers={};let app;
const stalled=()=>fx.calls.flatMap(c=>c.p==='/rest/v1/ps_events'&&Array.isArray(c.body)?c.body:[]).filter(r=>r.event_name==='sync_stalled');
try{
  app=await openApp(fx,'desktop',{browsers,init:{fn:()=>{window.__psSyncStallGraceMs=0;},arg:null}});
  const {page}=app;await ready(page);
  assert.equal(await page.evaluate(()=>typeof PSSyncStall),'object','the shell loads the module');
  /* 멀쩡한 기기: 대기 없음 → 보내지 않는다 */
  const healthy=await page.evaluate(()=>PSSyncStall.check());
  assert.notEqual(healthy&&healthy.stalled,true,'a healthy device is quiet '+JSON.stringify(healthy));
  /* 막힌 기기: 올라갈 변경 4건이 5일째 · 마지막으로 끝난 회차도 5일 전 */
  const r=await page.evaluate(()=>{const t=Date.now();PSSync.pending=()=>({count:4,oldest:t-5*864e5});localStorage.setItem('ps_last_pull_at',String(t-5*864e5));return PSSyncStall.check();});
  assert.equal(r&&r.stalled,true,'the stuck device is reported '+JSON.stringify(r));
  for(let i=0;i<80&&!stalled().length;i++)await page.waitForTimeout(250);
  const rows=stalled();
  fs.writeFileSync(path.join(out,engine+'-results.json'),JSON.stringify({engine,check:r,rows},null,2));
  assert.equal(rows.length,1,'one row reaches the server');
  const ev=rows[0];
  assert.deepEqual([ev.status,ev.feature],['error','sync']);
  assert.match(String(ev.app_version),/^3\.\d{3}$/);
  assert.equal(ev.meta.n,4);
  assert.ok(ev.meta.oh>=119&&ev.meta.oh<=121,'oldest pending ~5 days '+ev.meta.oh);
  assert.ok(ev.meta.ph>=119&&ev.meta.ph<=121,'last finished round ~5 days '+ev.meta.ph);
  assert.equal(typeof ev.meta.ls,'number');assert.equal(typeof ev.meta.sa,'boolean');
  if(engine==='chromium'){assert.equal(typeof ev.meta.lh,'number');assert.equal(typeof ev.meta.lq,'number');}
  for(const [k,v] of Object.entries(ev.meta))assert.ok(typeof v!=='string'||['stage','msg','reason'].includes(k),'only step names as text: '+k);
  assert.ok(Object.keys(ev.meta).length<=12);
  /* 같은 창에서 다시 불러도(6시간 안) 보내지 않는다 */
  assert.equal((await page.evaluate(()=>PSSyncStall.check())).why,'sent');
  await page.waitForTimeout(1500);
  assert.equal(stalled().length,1,'no second row');
  assert.deepEqual(app.logs.filter(x=>x.type==='pageerror'),[],'no runtime error');
  console.log(JSON.stringify({engine,passed:true,meta:ev.meta,error_code:ev.error_code}));
}finally{
  if(app)await app.context.close();for(const browser of Object.values(browsers))await browser.close();await fx.close();
}
