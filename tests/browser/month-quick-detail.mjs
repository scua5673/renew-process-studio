import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
// 2.890 — 월간 팝업에서 바로 훈련 시간대 세션과 경기 상대 팀을 적는다(합성 자료, 외부 요청 차단).
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),serve=require('../fixtures/session-team-page.cjs')(root),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',r=>{if(new URL(r.request().url()).origin!=='https://session-team.invalid')return r.abort();const data=serve(r.request().url());return r.fulfill(data||{status:404,body:''});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://session-team.invalid/studio/process.html?mode=month',{waitUntil:'domcontentloaded'});
 const cellSel='#monthGrid .mcell[data-r="1"][data-col="2"]';await page.locator(cellSel).waitFor();
 const day=()=>page.evaluate(()=>{const d=weeksMap[1][2];return {slots:(d.trainings||[]).map(t=>t.slot+'@'+t.time),sched:dayBoard(d).sched,off:!!d.off,opp:d.match&&d.match.opp,bopp:dayBoard(d).opp};});
 await page.locator(cellSel).click();const pop=page.locator('.mpop');await pop.waitFor();
 assert.ok(await pop.locator('.mp-slots').isVisible(),'empty day shows time slots');assert.equal(await pop.locator('.mp-opp').isVisible(),false);
 await pop.getByRole('button',{name:'오전',exact:true}).click();
 assert.deepEqual(await day(),{slots:['오전@09:00'],sched:'훈련',off:false,opp:undefined,bopp:undefined});
 assert.equal(await page.locator('.mpop .mp-slots button[data-slot="오전"]').getAttribute('aria-pressed'),'true','existing slot shows as on');
 await page.locator('.mpop').getByRole('button',{name:'저녁',exact:true}).click();
 await page.locator('.mpop').getByRole('button',{name:'오전',exact:true}).click();
 assert.deepEqual((await day()).slots,['오전@09:00','저녁@19:30'],'same slot is not created twice');
 assert.match(await page.locator('.mpop .mp-sum').textContent(),/훈련 2회/);
 // OFF 날에서 시간대를 누르면 OFF 가 풀리고 훈련이 된다
 await page.locator('.mpop').getByRole('button',{name:'OFF',exact:true}).click();assert.equal((await day()).off,true);
 await page.locator('.mpop').getByRole('button',{name:'오후',exact:true}).isVisible().then(v=>assert.equal(v,false,'OFF hides slots'));
 await page.locator('.mpop').getByRole('button',{name:'훈련',exact:true}).click();
 await page.locator('.mpop').getByRole('button',{name:'오후',exact:true}).click();
 const afterOff=await day();assert.equal(afterOff.off,false);assert.equal(afterOff.sched,'훈련');assert.deepEqual(afterOff.slots,['오전@09:00','오후@16:00','저녁@19:30'],'sessions stay in time order');
 // 경기: 상대 팀
 await page.locator('.mpop').getByRole('button',{name:'경기',exact:true}).click();
 const opp=page.locator('.mpop .mp-opp');await opp.waitFor();assert.equal(await page.locator('.mpop .mp-slots').isVisible(),false);
 await opp.fill('가상 FC');
 assert.equal((await day()).opp,'가상 FC','saved while typing');assert.equal((await day()).bopp,'가상 FC','weekly board field too');
 assert.match(await page.locator('.mpop .mp-sum').textContent(),/경기 · 가상 FC/);
 await opp.press('Enter');assert.equal(await page.locator('.mpop').count(),0,'Enter closes');
 assert.match(await page.locator(cellSel).textContent(),/가상 FC/,'month cell shows the opponent');
 // 닫기 직전 입력도 잃지 않는다
 await page.locator(cellSel).click();await page.locator('.mpop .mp-opp').waitFor();
 await page.evaluate(()=>{const i=document.querySelector('.mpop .mp-opp');i.value='가상 유나이티드';});
 // 팝업은 다음 틱에 Escape 리스너를 건다(여는 클릭이 곧바로 닫지 않게). 사람 손보다 빠른 입력만 피한다.
 await page.evaluate(()=>new Promise(r=>setTimeout(r,20)));
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.mpop'));assert.equal((await day()).opp,'가상 유나이티드');
 await page.waitForFunction(()=>{const w=JSON.parse(localStorage.getItem('process_coach_v1')||'{}').weeks||{};return JSON.stringify(w).includes('가상 유나이티드');});
 await page.reload({waitUntil:'domcontentloaded'});await page.locator(cellSel).waitFor();
 assert.equal((await day()).opp,'가상 유나이티드','opponent survives reload');
 // 폰 폭: 팝업 안에서 가로로 넘치지 않는다
 await page.setViewportSize({width:375,height:812});await page.locator(cellSel).click();await page.locator('.mpop .mp-opp').waitFor();
 assert.ok(await page.locator('.mpop').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().right<=window.innerWidth));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,passed:true,cases:['slot-from-month','no-duplicate-slot','off-to-training','opponent-while-typing','enter-closes','close-commits','reload','phone-width']}));await context.close();
}finally{await browser.close();}
