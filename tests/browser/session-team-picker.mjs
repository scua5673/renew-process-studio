import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),serve=require('../fixtures/session-team-page.cjs')(root),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',r=>{if(new URL(r.request().url()).origin!=='https://session-team.invalid')return r.abort();const data=serve(r.request().url());return r.fulfill(data||{status:404,body:''});});
 const page=await context.newPage();await page.goto('https://session-team.invalid/studio/process.html?mode=week',{waitUntil:'domcontentloaded'});
 const add=page.getByRole('button',{name:'＋ 세션 추가',exact:true});await add.first().waitFor();assert.equal(await page.getByText('조별 훈련 / OFF',{exact:true}).count(),0);
 await add.first().click();const sheet=page.locator('#sheet');await sheet.getByRole('button',{name:'B팀',exact:true}).click();await sheet.getByRole('button',{name:'닫기',exact:true}).click();assert.equal(await page.evaluate(()=>week[0].trainings.length),1);
 await add.first().click();await sheet.getByRole('button',{name:'A팀',exact:true}).click();await sheet.getByRole('button',{name:'B팀',exact:true}).click();await sheet.getByRole('button',{name:'세션 만들기',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>week[0].trainings.map(t=>t.grp)),[['A팀'],['B팀']]);assert.equal(await sheet.locator('#wfSec-grp').getByRole('button',{name:'B팀',exact:true}).getAttribute('class'),'fp on');
 await sheet.getByRole('button',{name:'닫기',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('process_coach_v1')).weeks[0][0].trainings.length===2);
 await page.reload({waitUntil:'domcontentloaded'});await add.first().waitFor();assert.deepEqual(await page.evaluate(()=>week[0].trainings.map(t=>t.grp)),[['A팀'],['B팀']]);
 await page.setViewportSize({width:390,height:844});await add.nth(1).click();await sheet.getByRole('button',{name:'전체 선택',exact:true}).click();assert.equal(await sheet.locator('[aria-pressed="true"]').count(),3);assert.ok(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 console.log(JSON.stringify({engine,passed:true,cases:['no-separate-group-editor','cancel-preserves-data','selected-team-only','reload-preserves-both-sessions','empty-day-add','mobile-multi-team']}));await context.close();
}finally{await browser.close();}
