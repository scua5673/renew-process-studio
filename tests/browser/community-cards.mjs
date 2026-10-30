import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startFixture,openApp,root} from '../fixtures/team-app.mjs';

// Real rendering and destinations; only the account and community posts are synthetic.
const require=createRequire(import.meta.url),T=require('../../studio/community-training.js');
const out=process.env.PS_COMMUNITY_OUTPUT||path.join(root,'test-results/community-cards');fs.mkdirSync(out,{recursive:true});
const thumb=fs.readFileSync(path.join(root,'studio/packs/thumbs/03-1.svg'),'utf8');
const item=JSON.parse(fs.readFileSync(path.join(root,'studio/packs/03.json'),'utf8')).drills[0];
const fifaIndex=JSON.parse(fs.readFileSync(path.join(root,'studio/fifa-packs/index.json'),'utf8'));
const coach={id:'card-fixture-coach',owner:'22222222-2222-4222-8222-222222222222',owner_name:'테스트 코치',title:'후방 빌드업의 패스 선택',summary:'상대 압박에 따라 달라지는 지원 위치와 전진 패스의 방향을 살펴봅니다.',cat:'bp',age:'U15',players:'8',thumb,views:12,copies:3,likes:2,created_at:'2026-10-30T00:00:00Z'};
const training=T.catalog.posts.slice(0,3).map((m,i)=>({...coach,id:m.id,owner:T.catalog.owner,owner_name:'프로세스',title:['압박을 벗어나는 지원 각도','패스 후 움직임과 공간 만들기','공을 잃은 순간, 압박으로 전환'][i]}));
const fx=await startFixture(),browsers={},report=[];
try{
  for(const mode of [{size:'desktop',width:1280,dark:false},{size:'ipad',width:1100,dark:true},{size:'phone',width:320,dark:false},{size:'phone',width:393,dark:true}]){
    const {page,context,logs}=await openApp(fx,mode.size,{browsers,dark:mode.dark});
    await page.setViewportSize({width:mode.width,height:900});
    const writes=[];
    // The current 193 entries all have packs. Keep three in this fixture to also
    // exercise the existing external-link fallback without changing the catalog.
    await context.route('**/studio/fifa-packs/index.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({...fifaIndex,sessions:fifaIndex.sessions.slice(0,3)})}));
    await context.route('**/rest/v1/ps_community**',r=>{
      const req=r.request(),u=new URL(req.url());
      if(req.method()!=='GET'){writes.push(req.method());return r.fulfill({status:204});}
      const data=u.searchParams.get('select')==='item'?[{item}]:u.searchParams.get('owner')==='eq.'+T.catalog.owner?training:[coach];
      return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
    });
    await context.route('https://www.fifatrainingcentre.com/**',r=>r.fulfill({contentType:'text/html',body:'<p>Test source destination</p>'}));
    await page.evaluate(()=>window.__psShowApp('community'));
    const c=await(await page.waitForSelector('#fComm')).contentFrame();
    await c.waitForSelector('.pl-row');
    const shot=async name=>{await c.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,`${mode.width}-${mode.dark?'dark':'light'}-${name}.png`)});};
    const cardShot=async(selector,name)=>{await c.locator(selector).first().evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,`${mode.width}-${mode.dark?'dark':'light'}-${name}-card.png`)});};
    const fit=async selector=>{
      const geometry=await c.locator(selector).first().evaluate(e=>{
        const box=e.getBoundingClientRect(),title=e.querySelector('.tt,.fi-tt,strong'),s=title&&getComputedStyle(title);
        return {width:innerWidth,scroll:document.documentElement.scrollWidth,left:box.left,right:box.right,height:box.height,titleSize:s?.fontSize,titleClamp:s?.webkitLineClamp};
      });
      assert.equal(geometry.width,geometry.scroll,'document fits: '+selector);
      assert.ok(geometry.left>=0&&geometry.right<=geometry.width+1,'card fits: '+selector);
      assert.equal(geometry.titleSize,'20px','title hierarchy: '+selector);
      assert.ok(!geometry.titleClamp||geometry.titleClamp==='none','titles remain fully visible: '+selector);
      return geometry;
    };
    const letter=await fit('.pl-row');await shot('letters');
    await c.locator('#prTabCoach').click();await c.waitForSelector('.cc-coach');
    const coachCard=await fit('.cc-coach');
    const cue=c.locator('.cc-coach .open-cue').first();
    assert.ok((await cue.boundingBox()).height>=44,'coach action is tappable');
    assert.equal(await c.locator('.cc-coach .foot .who').textContent(),'@테스트 코치');
    await shot('coach');await cardShot('.cc-coach','coach');await cue.click();await c.waitForSelector('#cvMask.on');
    await c.locator('#cvClose').click();await c.waitForFunction(()=>!document.getElementById('cvMask').classList.contains('on'));
    await c.locator('#prTabTraining').click();await c.waitForSelector('.pt-purpose');
    await c.locator('.pt-purpose').first().click();await c.waitForSelector('.pt-training');
    const drill=await fit('.pt-training');
    assert.ok((await c.locator('.pt-training-foot').first().textContent()).includes(T.catalog.posts[0].min+'–'+T.catalog.posts[0].max+'명')||T.catalog.posts[0].min===T.catalog.posts[0].max,'real catalog player range');
    await shot('training');await cardShot('.pt-training','training');await c.locator('.pt-training').first().click();await c.waitForSelector('#cvMask.on');
    await c.locator('#cvClose').click();await c.waitForFunction(()=>!document.getElementById('cvMask').classList.contains('on'));
    await c.locator('#prTabFifa').click();await c.waitForSelector('.fi-anim .fi-play');
    const fifa=await fit('.fi-anim');await shot('fifa-play');await cardShot('.fi-anim','fifa-play');
    const play=c.locator('.fi-anim .fi-play').first(),source=c.locator('.fi-anim .fi-go').first();
    assert.ok((await play.boundingBox()).height>=44&&(await source.boundingBox()).height>=44,'FIFA actions are tappable');
    await play.click();await c.waitForSelector('#cvMask.on');await c.locator('#cvClose').click();
    await c.waitForFunction(()=>!document.getElementById('cvMask').classList.contains('on'));
    const [sourcePopup]=await Promise.all([context.waitForEvent('page'),source.click()]);await sourcePopup.waitForLoadState('domcontentloaded');
    assert.equal(sourcePopup.url(),await source.getAttribute('href'));await sourcePopup.close();
    assert.equal(await c.locator('#cvMask.on').count(),0,'FIFA original does not also open the native viewer');
    const external=c.locator('.fi-card:not(.fi-anim)').first();await external.scrollIntoViewIfNeeded();
    const link=await fit('.fi-card:not(.fi-anim)');
    assert.equal(await external.locator('.fi-src').textContent(),'외부 자료');
    assert.equal(await external.locator('.fi-play').count(),0,'external-only cards cannot promise native playback');
    assert.ok(link.height<fifa.height,'external cards stay compact beside diagrams');
    await page.screenshot({path:path.join(out,`${mode.width}-${mode.dark?'dark':'light'}-fifa-link.png`)});
    await cardShot('.fi-card:not(.fi-anim)','fifa-link');
    const [popup]=await Promise.all([context.waitForEvent('page'),external.click()]);await popup.waitForLoadState('domcontentloaded');assert.equal(popup.url(),await external.getAttribute('href'));await popup.close();
    assert.deepEqual(writes,[],'browsing these cards does not publish community writes');
    assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
    report.push({...mode,letter,coach:coachCard,drill,fifa,link});console.log('verified',mode.width,mode.dark?'dark':'light');await context.close();
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,modes:report.map(r=>r.width)}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
