import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
// 3.006 — 일정 › 년간: 달 카드마다 맨 위에 요일 줄(사용자 «월마다 요일써줘 맨위에»). 합성 자료, 외부 요청 차단.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),serve=require('../fixtures/session-team-page.cjs')(root),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
const WD=['월','화','수','목','금','토','일'],out=[];
try{
 for(const [name,w,h] of engine==='webkit'?[['phone',375,812],['phone393',393,852],['ipad',768,1024]]:[['desktop',1280,800]]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:w,height:h},hasTouch:w<1000,isMobile:w<500});
  await context.route('**/*',r=>{if(new URL(r.request().url()).origin!=='https://session-team.invalid')return r.abort();const data=serve(r.request().url());return r.fulfill(data||{status:404,body:''});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://session-team.invalid/studio/process.html?mode=year',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#yearGrid .ycard .ycal i[data-iso]');
  const s=await page.evaluate(()=>{const box=e=>{const b=e.getBoundingClientRect();return {l:Math.round(b.left),t:Math.round(b.top),r:Math.round(b.right),b:Math.round(b.bottom),w:Math.round(b.width)};};
   return {vw:innerWidth,docW:document.documentElement.scrollWidth,year:+document.getElementById('yearLabel').textContent.replace(/\D/g,''),
    cards:[...document.querySelectorAll('#yearGrid .ycard')].map(c=>{const wd=[...c.querySelectorAll('.ycal i.wd')],days=[...c.querySelectorAll('.ycal i[data-iso]')],cs=wd[0]?getComputedStyle(wd[0]):{};
      return {m:+c.dataset.ym,text:wd.map(x=>x.textContent),rows:new Set(wd.map(x=>box(x).t)).size,first:c.querySelector('.ycal').firstElementChild.className,fits:wd.every(x=>x.scrollWidth<=x.clientWidth+1),
        font:[cs.fontSize,cs.fontWeight,cs.fontStyle],bg:cs.backgroundColor,wd:wd.map(box),day1:days[0]?{iso:days[0].dataset.iso,...box(days[0])}:null,card:box(c)};})};});
  assert.equal(s.cards.length,12);
  assert.equal(s.docW,s.vw,name+': 가로로 넘치지 않는다');
  for(const c of s.cards){
   assert.deepEqual(c.text,WD,name+' '+(c.m+1)+'월: 요일 일곱');
   assert.deepEqual([c.rows,c.first,c.fits],[1,'wd',true],name+' '+(c.m+1)+'월: 맨 위 한 줄 · 글자가 칸 안에');
   assert.deepEqual(c.font,['12px','500','normal'],name+': 글자 12 · 굵기 500');
   assert.ok(/rgba\(0, 0, 0, 0\)|transparent/.test(c.bg),'요일 칸에는 날짜 칸의 바탕이 없다');
   assert.ok(c.wd.every(b=>b.l>=c.card.l&&b.r<=c.card.r),'카드 안');
   // 그 달 1일이 제 요일 아래에 놓인다
   const col=(new Date(s.year,c.m,1).getDay()+6)%7;
   assert.ok(Math.abs(c.day1.l-c.wd[col].l)<=1&&c.wd[col].b<=c.day1.t,name+' '+(c.m+1)+'월 1일('+c.day1.iso+')은 «'+WD[col]+'» 아래 '+JSON.stringify([c.day1,c.wd[col]]));
  }
  // 요일 줄을 누르면 카드처럼 그 달의 월간으로 간다(날짜 칸의 빠른 추가는 열리지 않는다)
  await page.locator('#yearGrid .ycard[data-ym="2"] .ycal i.wd').nth(3).click();
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('monthViewWrap')).display!=='none');
  assert.match(await page.locator('#monthRangeLabel').textContent(),new RegExp(s.year+'년 3월'));
  assert.deepEqual(errors,[],name+': 페이지 오류 없음');
  out.push({name,vw:s.vw,cell:s.cards[0].wd[0].w});
  await context.close();
 }
 console.log(JSON.stringify({engine,passed:true,sizes:out}));
}finally{await browser.close();}
