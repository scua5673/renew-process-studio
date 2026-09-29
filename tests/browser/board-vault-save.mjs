import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.907 — 오류 제보 «보드 → 보관함 저장»: 작업 보드에서 한 번 «보관함 저장»하면 그 항목이 남아,
// 다음 저장이 확인창 없이 그 항목을 덮어썼다(새 항목은 안 생기고 옛 전술은 사라짐). 이제 작업 보드에서는 매번 확인창,
// 기본은 새 항목, 덮어쓰기는 고를 때만. 보드의 «저장»은 «보드 저장»(작업 보드만 저장한다는 이름). 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(3000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__vaultSave&&document.getElementById('vaultSave'));
  await page.waitForTimeout(1500);
  const lib=()=>f.evaluate(async()=>((await store.get('cs_drill_lib_v1'))||[]).filter(d=>/^가상 전술/.test(d.name||'')).map(d=>({name:d.name,nums:(d.snap.players||[]).map(p=>p.num).join(',')})));
  const put=nums=>f.evaluate(ns=>{state.players=ns.map((n,i)=>({id:'vs'+n,team:'red',num:String(n),x:300+i*40,y:320}));renderTokens();},nums);
  // 폰은 저장 띠의 «보관함», 데스크톱은 원래 버튼 — 둘 다 같은 저장 경로
  const openSheet=async()=>{
    await f.evaluate(sz=>{const b=sz==='phone'&&document.querySelector('#psSaveBar .sb-vault');(b&&getComputedStyle(document.getElementById('psSaveBar')).display!=='none'?b:document.getElementById('vaultSave')).click();},size);
    await f.waitForSelector('#psSaveOv');
    return f.evaluate(()=>({over:(document.getElementById('pssOver')||{}).textContent||null,ok:document.getElementById('pssOk').textContent,text:document.getElementById('psSaveOv').textContent,
      width:Math.round(document.querySelector('#psSaveOv>div').getBoundingClientRect().width),vw:innerWidth}));
  };
  const name=n=>f.evaluate(v=>{document.getElementById('pssName').value=v;},n);
  const waitLib=pred=>f.waitForFunction(async p=>{const a=((await store.get('cs_drill_lib_v1'))||[]).filter(d=>/^가상 전술/.test(d.name||'')).map(d=>({name:d.name,nums:(d.snap.players||[]).map(x=>x.num).join(',')}));return new Function('a','return '+p)(a);},pred,{polling:100,timeout:5000});

  assert.equal(await f.evaluate(()=>document.getElementById('boardManualSave').textContent),'보드 저장','보드의 «저장»은 «보드 저장»');
  // 1) 처음 저장 — 확인창, 덮어쓰기 없음, 보드 문맥 설명
  await put([7]);
  const s1=await openSheet();
  assert.equal(s1.over,null,'처음에는 덮어쓸 항목이 없다');
  assert.equal(s1.ok,'보관함에 저장');
  assert.match(s1.text,/작업 보드는 그대로/,'보드에서 연 확인창은 목록으로 가지 않는다고 말한다');
  assert.doesNotMatch(s1.text,/2 \/ 3/,'보관함 만들기 단계 표시는 보드에서 안 보인다');
  assert.ok(s1.width<=s1.vw-16,'확인창이 화면 안 '+JSON.stringify(s1));
  await name('가상 전술 A');await f.click('#pssOk');
  await waitLib("a.length===1&&a[0].nums==='7'");
  // 2) 보드를 바꿔 다시 — 확인창이 다시 뜨고 기본은 새 항목, A 는 그대로
  await put([9,10]);
  const s2=await openSheet();
  assert.equal(s2.over,'‘가상 전술 A’에 덮어쓰기','전에 저장한 항목을 덮어쓸지 고를 수 있다');
  assert.equal(s2.ok,'새 항목으로 저장','기본은 새 항목');
  await name('가상 전술 B');await f.click('#pssOk');
  await waitLib("a.length===2");
  assert.deepEqual((await lib()).sort((x,y)=>x.name<y.name?-1:1),[{name:'가상 전술 A',nums:'7'},{name:'가상 전술 B',nums:'9,10'}],'A 는 덮이지 않았다');
  // 3) 덮어쓰기는 고를 때만 — 방금 저장한 B 만 바뀐다
  await put([9,10,11]);
  const s3=await openSheet();
  assert.equal(s3.over,'‘가상 전술 B’에 덮어쓰기');
  await f.click('#pssOver');
  await waitLib("a.some(d=>d.name==='가상 전술 B'&&d.nums==='9,10,11')");
  assert.deepEqual((await lib()).sort((x,y)=>x.name<y.name?-1:1),[{name:'가상 전술 A',nums:'7'},{name:'가상 전술 B',nums:'9,10,11'}]);
  // 4) 취소하면 아무것도 바뀌지 않는다
  await put([1]);
  await openSheet();await f.click('#pssCancel');await page.waitForTimeout(400);
  assert.equal(await f.evaluate(()=>!!document.getElementById('psSaveOv')),false);
  assert.deepEqual((await lib()).length,2,'취소는 저장하지 않는다');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,library:await lib()}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
