// 선수단 «명단» — 조 안 차례는 학년(높은 학년 먼저 · 미지정 끝) → 가나다. 학년이 섞인 조에만 학년 머리 줄(tr.pw-grouphead.pw-yearhead).
// 사용자 11/25 «학년별로 가나다 순으로 보이게». PS_SIZE=desktop|ipad|phone
import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const size=process.env.PS_SIZE||'desktop',engine=process.env.PS_BROWSER_ENGINE||SIZES[size].engine;
SIZES[size].engine=engine;
const phone=size==='phone',fx=await startFixture(),browsers={};
let step='open',frame=null;
try{
  const app=await openApp(fx,size,{browsers}),{page}=app,errors=[];
  page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
  await page.locator('#appSeg [data-team-hub]').click();
  await page.locator(phone?'#teamBottom [data-tb="players"]':'#teamNav [data-team-key="players"]').click();
  frame=await (await page.waitForSelector('#fScout')).contentFrame();
  await frame.locator('#pwTeam [data-pw-view="list"]').waitFor();
  await frame.getByRole('button',{name:'명단',exact:true}).click();
  await frame.locator('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').first().waitFor();
  await page.waitForTimeout(900);   /* scout.html 의 늦은 다시 그리기(400ms)가 지난 뒤 */
  const lines=()=>frame.evaluate(()=>[...document.querySelectorAll('#pwTeam .pw-table tbody tr')].map(r=>r.classList.contains('pw-yearhead')?'Y:'+r.innerText.replace(/\s+/g,' ').trim():r.classList.contains('pw-grouphead')?'G:'+r.innerText.replace(/\s+/g,' ').trim():'P:'+((r.querySelector('[data-pw-open]')||{}).dataset||{}).pwOpen));
  const want=()=>frame.evaluate(()=>{const yk=p=>/^[0-6]$/.test(String(p.schoolYear||''))?String(p.schoolYear):'',rank=y=>['6','5','4','3','2','1','0',''].indexOf(y),m={};
    tmOurs().forEach(p=>{const g=(p.grp||'').trim();(m[g]=m[g]||[]).push(p);});
    Object.keys(m).forEach(g=>{m[g]=m[g].slice().sort((a,b)=>rank(yk(a))-rank(yk(b))||String(a.name||'이름 없음').localeCompare(String(b.name||'이름 없음'),'ko')).map(p=>String(p.id));});return m;});
  const groupsOf=L=>{const out=[];let cur=null;L.forEach(x=>{if(x[0]==='G'){cur={head:x.slice(2),ids:[],years:[]};out.push(cur);}else if(x[0]==='Y')cur.years.push(x.slice(2));else cur.ids.push(x.slice(2));});return out;};

  // ① 학년을 안 적은 팀 — 조 안은 가나다, 학년 머리 줄 없음
  step='name-only';
  let L=await lines(),W=await want(),G=groupsOf(L);
  assert.equal(L.filter(x=>x[0]==='Y').length,0,'학년 머리 줄 없음');
  assert.deepEqual(G.map(g=>g.ids).sort(),Object.values(W).sort(),'조 안 가나다 '+JSON.stringify(L));

  // ② 한 조에 학년을 섞어 적으면 — 3 · 2 · 1 · 미지정 차례, 학년마다 머리 줄 · 그 안은 가나다
  step='years';
  const n=await frame.evaluate(()=>{const g=(tmOurs()[0].grp||'').trim(),L=tmOurs().filter(p=>(p.grp||'').trim()===g);['1','3','2','3','1'].forEach((y,i)=>{if(L[i])L[i].schoolYear=y;});renderTeam();return L.length;});
  assert.ok(n>=4,'한 조에 선수 넷 이상 '+n);
  await page.waitForTimeout(600);
  L=await lines();W=await want();G=groupsOf(L);
  assert.deepEqual(G.map(g=>g.ids).sort(),Object.values(W).sort(),'학년 → 가나다 '+JSON.stringify(L));
  const mixed=G.find(g=>g.years.length);
  assert.ok(mixed,'학년 머리 줄이 생김 '+JSON.stringify(L));
  const ys=mixed.years.map(t=>t.replace(/\s*\d+명$/,''));
  assert.deepEqual(ys,ys.slice().sort((a,b)=>['3학년','2학년','1학년','신입생','학년 미지정'].indexOf(a)-['3학년','2학년','1학년','신입생','학년 미지정'].indexOf(b)),'높은 학년 먼저 '+JSON.stringify(ys));
  assert.equal(mixed.years.reduce((s,t)=>s+(+(/(\d+)명$/.exec(t)||[])[1]||0),0),mixed.ids.length,'학년 머리 인원의 합 = 조 인원');
  assert.equal(await frame.locator('#pwTeam .pw-table tbody tr:not(.pw-grouphead)').count(),(await frame.evaluate(()=>tmOurs().length)),'선수 줄 수 그대로');

  // ④ 가용인원 조별 + 학년 나누기 — 학년 안에서 가능 → 재활 → 부상 → 불참 → 휴식, 같은 상태는 이름순(자리 차례 없음)
  step='avail-order';
  const av=await frame.evaluate(()=>{const day=stYmd(),g0=(tmOurs()[0].grp||'').trim(),L=tmOurs().filter(p=>(p.grp||'').trim()===g0);
    if(L[1]){L[1].status='injury';}if(L[3]){L[3].status='rehab';}
    const v0=availView,y0=avYearSplit;availView='grp';avYearSplit=true;
    const RK={rehab:1,injury:2,out:3,rest:4},yk=p=>/^[0-6]$/.test(String(p.schoolYear||''))?String(p.schoolYear):'',yr=y=>['6','5','4','3','2','1','0',''].indexOf(y);
    const got=avGroups(tmOurs(),day).map(g=>g.players.map(p=>String(p.id)));
    const exp=avGroups(tmOurs(),day).map(g=>g.players.slice().sort((a,b)=>(g.players.some(yk)?yr(yk(a))-yr(yk(b)):0)||((RK[avResolve(a,day).s]||0)-(RK[avResolve(b,day).s]||0))||String(a.name||'').localeCompare(String(b.name||''),'ko')).map(p=>String(p.id)));
    const st=avGroups(tmOurs(),day)[0].players.map(p=>yk(p)+':'+(avResolve(p,day).s||'')+':'+(p.posId||''));
    availView=v0;avYearSplit=y0;return {got,exp,st};});
  assert.deepEqual(av.got,av.exp,'학년 → 상태 → 이름 '+JSON.stringify(av.st));

  // ③ 넘침 0
  step='measure';
  const m=await frame.evaluate(()=>{const h=document.querySelector('#pwTeam tr.pw-yearhead th').getBoundingClientRect();return {vw:innerWidth,over:document.documentElement.scrollWidth-innerWidth,headR:Math.round(h.right),headH:Math.round(h.height)};});
  console.error('[measure] year-sort',size,JSON.stringify(m));
  assert.ok(m.over<=1,'넘침 '+m.over);assert.ok(m.headR<=m.vw+1&&m.headH>0,'학년 머리 줄이 화면 안 '+JSON.stringify(m));
  assert.deepEqual(errors.filter(e=>!/ResizeObserver loop/.test(e)),[]);
  console.log(JSON.stringify({passed:true,size,engine}));
}catch(e){console.error('[roster-year-sort] failed at '+step);console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
