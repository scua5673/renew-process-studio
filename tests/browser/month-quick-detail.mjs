import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
// 2.890 — 월간 팝업에서 바로 훈련 시간대 세션과 경기 상대 팀을 적는다(합성 자료, 외부 요청 차단).
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),serve=require('../fixtures/session-team-page.cjs')(root),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',r=>{if(new URL(r.request().url()).origin!=='https://session-team.invalid')return r.abort();const data=serve(r.request().url());return r.fulfill(data||{status:404,body:''});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://session-team.invalid/studio/process.html?mode=month',{waitUntil:'domcontentloaded'});
 // 날짜와 무관하게: 오늘이 든 주(r=0)는 이번 달 달력에 늘 그려진다. C1=오늘 요일, C2=3일 뒤 요일.
 const C1=(new Date().getDay()+6)%7,C2=(C1+3)%7;
 const cellSel='#monthGrid .mcell[data-r="0"][data-col="'+C1+'"]';await page.locator(cellSel).waitFor();
 // 쓸 두 칸을 빈 날로 시작한다(가짜 자료가 이번 주에 세션을 둘 수 있다)
 await page.evaluate(([a,b])=>{for(const c of [a,b]){const d=weeksMap[0][c];d.trainings=[];delete d.match;d.off=false;const bd=dayBoard(d);bd.sched='';delete bd.opp;bd.trains=[];}save();renderMonth();},[C1,C2]);
 const day=()=>page.evaluate(C1=>{const d=weeksMap[0][C1];return {slots:(d.trainings||[]).map(t=>t.slot+'@'+t.time),sched:dayBoard(d).sched,off:!!d.off,opp:d.match&&d.match.opp,bopp:dayBoard(d).opp};},C1);
 await page.locator(cellSel).click();const pop=page.locator('.mpop');await pop.waitFor();
 assert.ok(await pop.locator('.mp-slots').isVisible(),'empty day shows time slots');assert.equal(await pop.locator('.mp-opp').isVisible(),false);
 await pop.getByRole('button',{name:'오전',exact:true}).click();
 assert.deepEqual(await day(),{slots:['오전@09:00'],sched:'훈련',off:false,opp:undefined,bopp:undefined});
 assert.equal(await page.locator('.mpop .mp-slots button[data-slot="오전"]').getAttribute('aria-pressed'),'true','existing slot shows as on');
 await page.locator('.mpop').getByRole('button',{name:'저녁',exact:true}).click();
 // 2.899 — 켜진 시간대를 다시 누르면 빈 세션은 꺼진다(사용자 제보 «한번 선택하면 취소가 안 됩니다»)
 await page.locator('.mpop').getByRole('button',{name:'오전',exact:true}).click();
 assert.deepEqual((await day()).slots,['저녁@19:30'],'tapping an on slot removes the empty session');
 assert.equal(await page.locator('.mpop .mp-slots button[data-slot="오전"]').getAttribute('aria-pressed'),'false','removed slot shows as off');
 await page.locator('.mpop').getByRole('button',{name:'오전',exact:true}).click();
 assert.deepEqual([...(await day()).slots].sort(),['오전@09:00','저녁@19:30'],'same slot is created once again, never twice');
 // 내용을 적은 세션은 월간에서 지우지 않는다
 await page.evaluate(C1=>{const t=weeksMap[0][C1].trainings.find(x=>x.slot==='저녁');t.aims='가상 목표';save();},C1);
 await page.locator('.mpop').getByRole('button',{name:'저녁',exact:true}).click();
 assert.deepEqual([...(await day()).slots].sort(),['오전@09:00','저녁@19:30'],'a session with content is kept');
 await page.evaluate(C1=>{const t=weeksMap[0][C1].trainings.find(x=>x.slot==='저녁');t.aims='';save();},C1);
 await page.evaluate(C1=>{const d=weeksMap[0][C1];d.trainings.sort((a,b)=>a.time<b.time?-1:1);save();},C1);
 assert.match(await page.locator('.mpop .mp-sum').textContent(),/훈련 2회/);
 // 2.892 — 조 선택: 기본 A, B 를 고르면 같은 시간대라도 B 세션이 따로, 여러 조 동시, 전부 끄면 A 로 돌아간다
 const grps=()=>page.evaluate(C1=>(weeksMap[0][C1].trainings||[]).map(t=>t.slot+':'+(t.grp||[]).join('+')),C1);
 assert.deepEqual(await grps(),['오전:A팀','저녁:A팀'],'without choosing, sessions go to group A');
 const chip=g=>page.locator('.mpop .mp-grps button[data-grp="'+g+'"]');
 assert.equal(await chip('A팀').getAttribute('aria-pressed'),'true','A is selected by default');
 await chip('A팀').click();assert.equal(await chip('A팀').getAttribute('aria-pressed'),'true','clearing every group falls back to A');
 await chip('B팀').click();await chip('A팀').click();
 assert.equal(await page.locator('.mpop .mp-slots button[data-slot="오전"]').getAttribute('aria-pressed'),'false','B has no morning session yet');
 await page.locator('.mpop').getByRole('button',{name:'오전',exact:true}).click();
 assert.deepEqual(await grps(),['오전:A팀','오전:B팀','저녁:A팀'],'B morning is its own session');
 assert.equal(await chip('B팀').getAttribute('aria-pressed'),'true','reopened popup keeps the chosen group');
 await chip('A팀').click();await page.locator('.mpop').getByRole('button',{name:'새벽',exact:true}).click();
 assert.ok((await grps()).includes('새벽:A팀+B팀'),'several groups share one session');
 await page.evaluate(C1=>{const d=weeksMap[0][C1];d.trainings=d.trainings.filter(t=>t.slot==='오전'&&(t.grp||[]).join()==='A팀'||t.slot==='저녁');save();renderMonth();},C1);
 await page.keyboard.press('Escape');await page.locator(cellSel).click();await page.locator('.mpop').waitFor();
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
 // 2.891 — board.sched='경기'만 있는 날(day.match 없음)도 월간 칸은 주간처럼 경기로 그린다
 await page.evaluate(C2=>{const d=weeksMap[0][C2];delete d.match;const b=dayBoard(d);b.sched='경기';b.opp='가상 보드 상대';d.off=false;renderMonth();},C2);
 const boardOnly=page.locator('#monthGrid .mcell[data-r="0"][data-col="'+C2+'"]');
 assert.ok(await boardOnly.evaluate(el=>el.classList.contains('m')),'board-only match cell is a match cell');
 assert.match(await boardOnly.textContent(),/가상 보드 상대/,'board-only match shows the opponent');
 // 폰 폭: 팝업 안에서 가로로 넘치지 않는다
 await page.setViewportSize({width:375,height:812});await page.locator(cellSel).click();await page.locator('.mpop .mp-opp').waitFor();
 assert.ok(await page.locator('.mpop').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().right<=window.innerWidth));
 // 월간 팝업의 주간 이동은 편집 시트를 열지 않고 선택한 주를 보여 주며, 폰 주간 좌우 이동도 계속 동작한다
 await page.locator('.mpop .mp-week').click();
 await page.waitForFunction(([w,di])=>document.querySelector('#weekView')?.style.display==='block'&&wk===w&&dayIdx===di&&curSession==null,[0,C1]);
 assert.equal(await page.locator('#vtoggle div[data-v="week"]').evaluate(el=>el.classList.contains('on')),true,'month week button selects weekly view');
 await page.locator('#psPhBar .nv[data-d="1"]').click();
 await page.waitForFunction(()=>wk===1);
 await page.locator('#psPhBar .nv[data-d="-1"]').click();
 await page.waitForFunction(()=>wk===0);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,passed:true,cases:['slot-from-month','slot-toggle-off','content-kept','no-duplicate-slot','off-to-training','opponent-while-typing','enter-closes','close-commits','reload','phone-width','month-to-week','phone-week-nav']}));await context.close();
}finally{await browser.close();}
