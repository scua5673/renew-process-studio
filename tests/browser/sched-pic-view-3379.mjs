import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS} from '../fixtures/team-app.mjs';
// 3.379 — 그림만 있는 일정 줄도 그 그림으로 바로(제보 c1bad13d «이미지만 넣으면 … 클릭하면 바로 이미지로 넘어 가게»).
// 합성 팀(셸 전체)에서: 보관함에 훈련 둘짜리 카드(«워밍업» 장면 셋 · «론도» 그림 한 장)를 두고 → 일정 › 세션 채우기 › «보관함에서 가져오기» →
// A안: «워밍업» · «론도» 줄은 줄 전체가 «보기»(표식은 이름 앞 · 시간 칩은 세션 채우기 창) →
// 누르면 작전판이 그 훈련(둘째)을 보기 전용으로 재생 없이 연다 → «나가기» → 일정. 보관함 원본은 그대로. 실제 서버는 건드리지 않는다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
if(engine==='chromium'){SIZES.ipad.engine='chromium';SIZES.phone.engine='chromium';}
const fx=await startFixture(),browsers={},LIB='Vqa_pic3379',DI=1;
const out={engine,size,passed:false,steps:[]};
try{
  const {page}=await openApp(fx,size,{browsers}),phone=size==='phone',touch=size!=='desktop';
  const hit=l=>touch?l.tap():l.click();
  await page.waitForTimeout(2500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof boardStore==='object'&&typeof window.__snapToThumb==='function'&&window.__boardReady&&window.__boardRestoreDone,null,{timeout:45000});
  await bf.evaluate(async lid=>{
    const s=x=>({players:[{id:1,team:'blue',num:'1',x,y:300},{id:2,team:'red',num:'2',x:x+120,y:380}],equipment:[],drawings:[],ball:{x:555,y:370}});
    const lib=(await boardStore.get('cs_drill_lib_v1'))||[],t=Date.now();
    lib.unshift({libId:lid,type:'train',name:'가상 그림카드',folder:'',snap:s(300),thumb:window.__snapToThumb(s(300)),trainings:[
      {name:'워밍업',minutes:10,snap:s(300),thumb:window.__snapToThumb(s(300)),frames:[{snap:s(300)},{snap:s(400)},{snap:s(500)}]},
      {name:'론도',minutes:15,snap:s(640),thumb:window.__snapToThumb(s(640))}],savedAt:t,editedAt:t});
    await boardStore.set('cs_drill_lib_v1',lib);localStorage.setItem('cs_lib_rev',String(t));},LIB);
  const vaultItem=()=>bf.evaluate(async lid=>{const d=((await boardStore.get('cs_drill_lib_v1'))||[]).find(x=>x&&x.libId===lid);return d?JSON.stringify([d.name,d.savedAt,d.editedAt,d.trainings]):null;},LIB);
  const before=await vaultItem();assert.ok(before,'보관함에 심었다');
  await page.evaluate(ph=>{document.querySelector('#appSeg [data-team-hub]').click();const b=document.querySelector(ph?'#teamBottom [data-tb="training"]':'#teamNav [data-team-key="training"]');if(b)b.click();},phone);
  const pf=await (await page.waitForSelector('#fProcess',{state:'attached'})).contentFrame();
  await pf.waitForFunction(()=>typeof week!=='undefined'&&week&&week.length===7&&typeof wksFill==='function'&&window.PSSchedBoardPlay&&PSSchedBoardPlay.picBtn&&document.querySelectorAll('.wks-day').length===7,null,{timeout:30000});
  await pf.waitForFunction(lid=>{try{if(!window.__sbpAsk&&typeof psLibraryRefresh==='function'){window.__sbpAsk=1;psLibraryRefresh();}}catch(_){}return libDrills().some(d=>d&&d.libId===lid);},LIB,{timeout:30000});
  await pf.evaluate(di=>wksFill(di,week[di].trainings[0].slot),DI);
  const sheet=pf.locator('#sheet');
  await sheet.locator('#wfSec-lib').waitFor();
  await hit(sheet.locator('#wfSec-lib').getByRole('button',{name:'보관함에서 가져오기',exact:true}));
  const pick=sheet.locator('.lp-item',{hasText:'가상 그림카드'});
  await pick.waitFor({timeout:15000});await hit(pick);
  await pf.waitForFunction(di=>(dayBoard(week[di]).trains||[]).indexOf('론도')>=0,DI,{timeout:15000});
  await sheet.locator('#wfSec-lib').waitFor();
  // 세션 채우기 창의 줄에도 같은 버튼
  const inFill=await pf.evaluate(()=>[...document.querySelectorAll('#sheet .wft-nmw')].map(w=>[w.querySelector('.wft-nm').textContent.trim(),!!w.querySelector('.wks-play:not(.wks-pic)'),!!w.querySelector('.wks-pic')]).filter(x=>/^(워밍업|론도)$/.test(x[0])));
  assert.deepEqual(inFill,[['워밍업',true,false],['론도',false,true]],'세션 채우기 줄 '+JSON.stringify(inFill));
  await hit(sheet.getByRole('button',{name:'완료',exact:true}).last());
  await pf.waitForFunction(()=>!document.getElementById('scrim').classList.contains('show'),null,{timeout:10000});
  out.steps.push('imported');
  // 주간 카드: 워밍업 ▶ · 론도 «그림 보기» — 크기 · 보이는 자리 · 그 자리의 맨 위 요소
  if(phone){await pf.evaluate(()=>{const b=document.querySelector('#psPhBar .sg button[data-sv="week"]');if(b)b.click();});await page.waitForTimeout(600);}   // 폰 일정은 월간으로 열린다
  await pf.evaluate(di=>document.querySelectorAll('.wks-day')[di].scrollIntoView({block:'center'}),DI);
  await page.waitForTimeout(400);
  // A안 — 그림 · 애니메이션이 있는 줄은 줄 전체가 «보기», 표식은 이름 앞, 시간 칩은 줄 끝
  const rows=await pf.evaluate(di=>{const d=document.querySelectorAll('.wks-day')[di];
    return [...d.querySelectorAll('.wks-li')].filter(li=>/^(워밍업|론도)$/.test(li.getAttribute('title')||'')).map(li=>{
      const p=li.querySelector('.wks-play'),b=li.querySelector('b'),t=li.querySelector('i'),R=e=>e?e.getBoundingClientRect():null,pr=R(p),br=R(b),tr=R(t),lr=R(li);
      const top=document.elementFromPoint(br.left+Math.min(20,br.width/2),br.top+br.height/2),cs=getComputedStyle(p),ts=t?getComputedStyle(t):null;
      return {n:li.getAttribute('title'),pic:p.classList.contains('wks-pic'),title:p.title,gw:Math.round(pr.width),glyphFirst:pr.right<=br.left+0.5,bare:cs.boxShadow==='none'&&/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor),
        chip:t?t.textContent.trim():'',chipLast:!!(tr&&(tr.left>=br.right-0.5||tr.top>=br.bottom-0.5)&&tr.right<=lr.right+0.5&&lr.right-tr.right<=8),chipRound:ts?parseFloat(ts.borderTopLeftRadius)>=9:false,
        rowW:Math.round(lr.width),rowH:Math.round(lr.height),nameHit:!!(top&&li.contains(top)),vw:innerWidth,over:document.documentElement.scrollWidth-innerWidth};});},DI);
  out.rows=rows;
  assert.deepEqual(rows.map(x=>[x.n,x.pic,x.title.replace(/ · .*/,''),x.chip]),[['워밍업',false,'애니메이션 보기','10분'],['론도',true,'그림 보기','15분']],JSON.stringify(rows));
  for(const x of rows){assert.equal(x.gw,14,x.n+' 표식 14px');assert.ok(x.glyphFirst,x.n+' 표식이 이름 앞');assert.ok(x.bare,x.n+' 표식은 동그라미 없이');assert.ok(x.chipLast&&x.chipRound,x.n+' 시간 칩이 줄 오른쪽 끝(좁은 칸은 이름 아래) '+JSON.stringify(x));
    assert.ok(x.rowH>=28&&x.rowW>=70,x.n+' 누르는 자리 = 줄 '+x.rowW+'×'+x.rowH);assert.ok(x.nameHit,x.n+' 이름 자리가 줄에 닿는다');assert.ok(x.over<=0,'가로 넘침 없음 '+x.over);}
  if(SHOTS)await page.screenshot({path:path.join(SHOTS,'sched-pic-view-week-'+engine+'-'+size+'.png')});
  out.steps.push('buttons');
  // «그림 보기» — 그 훈련(둘째)을 보기 전용으로, 재생 없이. 시간 시트는 뜨지 않는다
  // 시간 칩은 예전처럼 세션 채우기 창(시간) — 보기는 열리지 않는다
  await hit(pf.locator('.wks-day').nth(DI).locator('.wks-li[title="론도"] i'));
  await pf.waitForFunction(()=>document.getElementById('scrim').classList.contains('show')&&!!document.querySelector('#sheet #wfSec-lib'),null,{timeout:10000});
  assert.equal(await page.evaluate(()=>document.body.getAttribute('data-ps-app')),'process','시간 칩은 일정에 머문다');
  await hit(sheet.getByRole('button',{name:'완료',exact:true}).last());
  await pf.waitForFunction(()=>!document.getElementById('scrim').classList.contains('show'),null,{timeout:10000});
  out.steps.push('time-chip');
  // 줄(이름)을 누르면 그림으로
  await hit(pf.locator('.wks-day').nth(DI).locator('.wks-li[title="론도"] b'));
  await bf.waitForFunction(()=>document.body.classList.contains('editing'),null,{timeout:20000});
  await page.waitForTimeout(1500);
  assert.equal(await pf.evaluate(()=>document.getElementById('scrim').classList.contains('show')),false,'시간 시트가 뜨지 않았다');
  const open=await bf.evaluate(()=>({lib:typeof editorLibId!=='undefined'?editorLibId:null,ti:typeof editorTrainIdx!=='undefined'?editorTrainIdx:null,name:(typeof editorDraft!=='undefined'&&editorDraft)?editorDraft.name:'',ro:!!window.__editorReadOnly||document.body.classList.contains('editor-readonly')||window.__editorSchedLink==='view',link:window.__editorSchedLink,playing:typeof animPlaying!=='undefined'?!!animPlaying:null,xs:(captureSnap().players||[]).map(p=>Math.round(p.x))}));
  out.open=open;
  assert.equal(open.lib,LIB);assert.equal(open.name,'론도','둘째 훈련이 열렸다 '+JSON.stringify(open));
  assert.equal(open.link,'view','보기 전용');assert.equal(open.playing,false,'재생하지 않는다');
  assert.deepEqual(open.xs,[640,760],'론도의 그림이 판에 있다');
  assert.equal(await page.evaluate(()=>document.body.getAttribute('data-ps-app')),'design');
  if(SHOTS)await page.screenshot({path:path.join(SHOTS,'sched-pic-view-open-'+engine+'-'+size+'.png')});
  out.steps.push('open');
  await bf.evaluate(()=>document.getElementById('editorCancel').click());
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='process',null,{timeout:15000});
  await page.waitForTimeout(1500);
  assert.equal(await vaultItem(),before,'보관함 원본 그대로');
  out.steps.push('back');
  // 훈련 칩 시트(줄을 누르면 뜨는 창)에도 «그림 보기»
  await pf.evaluate(di=>{const b=dayBoard(week[di]);wkbdTrainTap(di,b.trains.indexOf('론도'));},DI);
  const sb=sheet.getByRole('button',{name:'그림 보기',exact:true});
  await sb.waitFor({timeout:5000});
  assert.equal(await sheet.getByRole('button',{name:/애니메이션 보기/}).count(),0);
  await hit(sb);
  await bf.waitForFunction(()=>document.body.classList.contains('editing')&&editorDraft&&editorDraft.name==='론도',null,{timeout:20000});
  await bf.evaluate(()=>document.getElementById('editorCancel').click());
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='process',null,{timeout:15000});
  assert.equal(await vaultItem(),before,'두 번째도 원본 그대로');
  out.steps.push('sheet');
  out.passed=true;
  console.log(JSON.stringify(out));
}catch(e){
  console.error('[sched-pic-view-3379] failure',JSON.stringify(out));console.error(e);process.exitCode=1;
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
