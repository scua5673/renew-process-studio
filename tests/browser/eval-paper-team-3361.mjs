// 3.361 — 선수 평가서 · 추천서의 팀 쪽(eval-paper-team.js)이 진짜 팀 화면에서 답하는지: 집계(teamEvalStats) · 사본 남기기 · 지우기(teamEvalPaper). 합성 팀 fixture.
import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const size=process.env.PS_SIZE||'desktop',engine=process.env.PS_BROWSER_ENGINE||SIZES[size].engine;
SIZES[size].engine=engine;
const fx=await startFixture(),browsers={};
let step='open';
try{
  const app=await openApp(fx,size,{browsers}),{page}=app,errors=[];
  page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
  await page.locator('#appSeg [data-team-hub]').click();
  await page.locator('#teamNav [data-team-key="players"]').click();
  const frame=await (await page.waitForSelector('#fScout')).contentFrame();
  await frame.waitForFunction(()=>typeof data!=='undefined'&&data.players&&data.players.some(p=>p.type!=='target')&&window.PSEvalPaperTeam);
  const ask=(type,body)=>frame.evaluate(({type,body})=>new Promise((res,rej)=>{const id='t'+Math.random().toString(36).slice(2);
    const on=e=>{const d=e.data||{};if(d.source==='scout'&&d.requestId===id){removeEventListener('message',on);res(d);}};addEventListener('message',on);
    setTimeout(()=>rej(new Error('no reply to '+type)),5000);postMessage(Object.assign({source:'app',type,requestId:id},body),'*');}),{type,body});
  const pid=await frame.evaluate(()=>data.players.filter(p=>p.type!=='target')[0].id);

  step='stats';
  const st=await ask('teamEvalStats',{playerId:pid,from:'2026-01-01',to:'2026-12-31'});
  assert.equal(st.type,'teamEvalStatsAck');assert.equal(st.ok,true,'stats: '+st.err);
  for(const k of ['total','start','res','goals'])assert.equal(typeof st.stats.match[k],'number','match.'+k);
  for(const k of ['done','scheduled','minutes'])assert.equal(typeof st.stats.train[k],'number','train.'+k);
  assert.ok(st.stats.train.done<=st.stats.train.scheduled);
  assert.equal((await ask('teamEvalStats',{playerId:pid,from:'x',to:'y'})).err,'range');
  assert.equal((await ask('teamEvalStats',{playerId:'no-such',from:'2026-01-01',to:'2026-12-31'})).err,'noplayer');

  step='paper';
  const saved=await ask('teamEvalPaper',{playerId:pid,paper:{id:'ep-t1',kind:'eval',at:1,date:'2026-11-22',label:'가상 시즌',by:'가상 코치',opinion:'가상 의견',levels:{ps_t_scan:3,bad:9},html:'<b>x</b>'}});
  assert.equal(saved.ok,true,'paper: '+saved.err);assert.equal(saved.papers.length,1);
  assert.deepEqual(saved.papers[0].levels,{ps_t_scan:3});assert.ok(!('html' in saved.papers[0]));
  assert.equal(await frame.evaluate(id=>player(id).papers.length,pid),1,'the copy sits under the roster player');
  const list=await ask('teamEvalList',{});
  assert.equal(list.players.find(p=>p.id===pid).papers[0].id,'ep-t1','teamEvalList carries the copies');
  const gone=await ask('teamEvalPaper',{playerId:pid,delId:'ep-t1'});
  assert.equal(gone.ok,true);assert.equal(gone.papers.length,0);
  assert.deepEqual(errors.filter(e=>!/ResizeObserver loop/.test(e)),[],'no page errors');
  console.log(JSON.stringify({test:'eval-paper-team-3361',size,engine,passed:true}));
}catch(e){console.log(JSON.stringify({test:'eval-paper-team-3361',size,engine,passed:false,step,error:String(e&&e.stack||e).slice(0,900)}));process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
