import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'phone':'desktop');
const owner='33a9d4e2-1868-40f4-8f82-3ebb4ecf011e';
const thumb='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#1e8c4c"/></svg>';
const sample=[['Cmvrx0ojpstsx','26.10.25.(일) 첼시 0:2 토트넘 | PL'],['Cmvquqwqvag2b','26.10.26.(월) 바르셀로나 1:2 레알 마드리드 | 라리가'],['Cmvjm1wl966iv','26.10.21.(수) PSG 4:2 바르셀로나 | 챔스'],['Cmvat5mje0gnu','26.10.14.(수) ATM 0:3 맨유 | 챔스'],['Cmvat3c6ssazc','26.10.12.(월) 리버풀 0:3 맨시티 | PL']].map(([id,title])=>({id,title,owner,owner_name:'엘미하',thumb,summary:'',cat:'',created_at:'2026-10-20T00:00:00Z'}));
let rows=process.env.PS_YOUTUBE_PREVIEW_POSTS?JSON.parse(fs.readFileSync(process.env.PS_YOUTUBE_PREVIEW_POSTS,'utf8')):sample;
const fx=await startFixture(),browsers={};
try{
  const {page,context,logs}=await openApp(fx,size,{browsers,dark:process.env.PS_DARK==='1'});
  page.setDefaultTimeout(20000);context.setDefaultTimeout(20000);
  let mode='ok',posted=null;const requested=[],mutations=[];
  await context.route('https://i.ytimg.com/**',r=>{
    const u=new URL(r.request().url());requested.push(u.pathname);
    if(mode==='failed'||(mode==='low'&&u.pathname.endsWith('maxresdefault.jpg')))return r.fulfill({status:404,body:''});
    const dir=process.env.PS_YOUTUBE_PREVIEW_POSTS&&path.dirname(process.env.PS_YOUTUBE_PREVIEW_POSTS),file=dir&&path.join(dir,u.pathname.split('/')[2]+'.jpg');
    return file&&fs.existsSync(file)?r.fulfill({contentType:'image/jpeg',body:fs.readFileSync(file)}):r.fulfill({contentType:'image/svg+xml',body:thumb});
  });
  await context.route('https://www.youtube.com/watch**',r=>r.fulfill({contentType:'text/html',body:'<h1>Mock YouTube destination</h1>'}));
  const cors={'access-control-allow-origin':'*'};
  await context.route('**/rest/v1/ps_handles**',r=>r.fulfill({contentType:'application/json',headers:cors,body:'[{"handle":"엘미하"}]'}));
  await context.route('**/rest/v1/ps_community**',r=>{
    const req=r.request(),u=new URL(req.url());
    if(req.method()==='POST'){posted=JSON.parse(req.postData());mutations.push(posted);rows=[{...posted,youtubeUrl:posted.item.youtubeUrl,created_at:'2026-10-30T00:00:00Z'},...rows];return r.fulfill({status:201,headers:cors,body:''});}
    if(req.method()!=='GET')return r.fallback();
    const data=u.searchParams.get('select')==='item'?[{item:{type:'train',name:'가상 자료',snap:{players:[]}}}]:u.searchParams.get('owner')==='eq.'+owner?rows:[];
    return r.fulfill({contentType:'application/json',headers:cors,body:JSON.stringify(data)});
  });
  await page.evaluate(()=>window.__psShowApp('community'));
  let c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#prTabElm');
  await c.evaluate(()=>{sessionStorage.removeItem('ps_comm_elmiha_v1');location.reload();});
  c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.click('#prTabElm');
  await c.waitForFunction(()=>document.querySelectorAll('.el-video-link').length===5);
  const originalViewport=page.viewportSize();
  for(const width of [320,390,767,1100]){
    await page.setViewportSize({width,height:844});
    await c.evaluate(()=>window.scrollTo(0,0));
    const layout=await c.evaluate(()=>{const card=document.querySelector('#grid .card'),th=card.querySelector('.th').getBoundingClientRect(),cue=card.querySelector('.open-cue').getBoundingClientRect(),link=card.querySelector('.el-video-link').getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth,ratio:th.width/th.height,cue:{left:cue.left,right:cue.right,top:cue.top,height:cue.height},link:{left:link.left,right:link.right,top:link.top,height:link.height},tabs:[...document.querySelectorAll('#prSeg button')].map(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&b.scrollWidth<=b.clientWidth+1;})};});
    assert.equal(layout.width,layout.scroll,'video cards fit after resizing');assert.ok(layout.tabs.every(Boolean),'all five sources fit');
    assert.ok(Math.abs(layout.ratio-16/9)<.02,'video artwork remains 16:9');
    assert.ok(layout.cue.height>=44&&layout.link.height>=44&&layout.cue.right<=layout.link.left&&Math.abs(layout.cue.top-layout.link.top)<1,'native and video actions are adjacent touch targets');
    if(width===390||width===1100)await page.screenshot({path:path.join(SHOTS,`explore-${engine}-${width}-${process.env.PS_DARK==='1'?'dark':'light'}.png`)});
  }
  await page.setViewportSize(originalViewport);
  const images=c.locator('#grid .el-video-art img');
  for(let i=0;i<5;i++){await images.nth(i).scrollIntoViewIfNeeded();await c.waitForFunction(i=>{const n=document.querySelectorAll('#grid .el-video-art img')[i];return n&&n.complete&&n.naturalWidth>120;},i);}
  const check=await c.evaluate(()=>({links:[...document.querySelectorAll('.el-video-link')].map(a=>[a.href,a.target,a.rel,a.getBoundingClientRect().height]),width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.equal(check.width,check.scroll);
  assert.equal(new Set(check.links.map(a=>a[0])).size,5);
  for(const a of check.links){assert.equal(a[1],'_blank');assert.equal(a[2],'noopener noreferrer');assert.ok(a[3]>=44);}
  await c.locator('#grid .card').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(SHOTS,`youtube-${engine}-${size}.png`)});
  console.log('cards and images verified');
  const [popup]=await Promise.all([context.waitForEvent('page'),c.locator('.el-video-link').first().click()]);
  await popup.waitForLoadState('domcontentloaded');assert.equal(popup.url(),check.links[0][0]);await popup.close();
  assert.equal(await c.locator('#cvMask').evaluate(n=>n.classList.contains('on')),false,'source link does not also open the board');
  assert.equal(mutations.length,0);
  // A missing high resolution image falls back once; total failure restores the existing board artwork.
  console.log('source link verified');
  mode='low';rows[0]={...rows[0],youtubeUrl:'https://youtu.be/Fallback001'};
  await c.evaluate(()=>{sessionStorage.removeItem('ps_comm_elmiha_v1');location.reload();});c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#grid .card');
  await c.locator('#grid .card').first().scrollIntoViewIfNeeded();
  await c.waitForFunction(()=>document.querySelector('#grid .th img')?.src.endsWith('hqdefault.jpg'));
  console.log('low resolution fallback verified');
  mode='failed';rows[0]={...rows[0],youtubeUrl:'https://youtu.be/Failed00001'};
  await c.evaluate(()=>{sessionStorage.removeItem('ps_comm_elmiha_v1');location.reload();});c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#grid .card');
  await c.waitForFunction(()=>document.querySelector('#grid .th img')?.src.startsWith('data:image/svg+xml'));
  assert.equal(await c.locator('.el-video-link').count(),5);
  console.log('board fallback verified');
  mode='ok';
  // Upload as the synthetic Elmiha account. Every write is intercepted above.
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  const item={libId:'youtube-fixture',type:'train',name:'가상 영상 연결',focus:'tech',minutes:10,thumb,snap:{players:[],equipment:[],drawings:[],ball:{x:500,y:300},pitchSpec:'fifa'}};
  await bf.evaluate(async item=>{stampCreator(item);await libWrite([item]);},item);
  await c.evaluate(owner=>{const original=parent.PSSync.session.bind(parent.PSSync);parent.PSSync.session=()=>({...original(),uid:owner});},owner);
  await c.click('#prTabCoach');await c.click('#prTabElm');
  await c.evaluate(()=>window.postMessage({type:'openUpload',libId:'youtube-fixture'},location.origin));
  await c.waitForSelector('#upYoutube');console.log('upload opened');
  await c.fill('#upYoutube','https://evil.test/watch?v=c5qzlz7t8hI');await c.click('#upGo');
  assert.equal(mutations.length,0);assert.equal(await c.locator('#upYoutube').getAttribute('aria-invalid'),'true');
  await c.fill('#upYoutube','https://youtu.be/c5qzlz7t8hI?si=tracking');
  await page.screenshot({path:path.join(SHOTS,`youtube-upload-${engine}-${size}.png`)});
  await c.click('#upGo');console.log('upload submitted');await c.waitForFunction(()=>!document.getElementById('mask').classList.contains('on'));
  assert.equal(posted.item.youtubeUrl,'https://www.youtube.com/watch?v=c5qzlz7t8hI');
  assert.equal(posted.thumb,thumb);assert.deepEqual(posted.item.snap.players,[]);
  await c.waitForFunction(()=>document.querySelectorAll('.el-video-link').length===6);
  // Source metadata survives fetching a fresh list, independently of the full animation JSON.
  await c.evaluate(()=>{sessionStorage.removeItem('ps_comm_elmiha_v1');location.reload();});
  c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForFunction(()=>document.querySelectorAll('.el-video-link').length===6);
  assert.equal(await c.locator('.el-video-link').first().getAttribute('href'),'https://www.youtube.com/watch?v=c5qzlz7t8hI');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
  console.log(JSON.stringify({engine,size,passed:true,cards:5,sourceLinks:true,fallback:true,upload:true,reload:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
