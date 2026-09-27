import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
// 2.890 — 관리자 › 콘텐츠의 애니메이션 재생. 실제 admin-content(.js/.css)와 admin.html 의 snapPreview 를 합성 자료로 돌린다.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const admin=fs.readFileSync(path.join(root,'admin.html'),'utf8');
function section(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return src.slice(i,j);}
const snapPreview=section(admin,'function snapPreview(snap){','function contentPreview(');
const base='https://admin-content-play.invalid';
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/studio/admin-content.css">
<style>:root{--bg:#0f141b;--panel:#171d26;--panel2:#1d2530;--line:#2a3340;--line2:#334052;--txt:#e7ebf1;--dim:#9aa4b2;--dim2:#7b8594;--blue2:#6aa7ff;--red:#e5484d;--amber:#f5a524}body{background:var(--bg);color:var(--txt);margin:0}</style>
<div id="host"></div><script src="/studio/admin-content-data.js"></script><script src="/studio/admin-content.js"></script>
<script>${snapPreview}
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const snap=x=>({players:[{id:'p1',x,y:200,team:'red',num:'7'},{id:'p2',x:700,y:400,team:'blue',num:'4'}],ball:{x,y:220}});
const item={name:'가상 전환 패턴',description:'합성 애니메이션',anim:{frames:[{snap:snap(150),dur:.4},{snap:snap(500),dur:.4},{snap:snap(900)}]}};
window.ctl=PSAdminContent.create({window,host:document.getElementById('host'),controls:{},model:PSAdminContentData,context:()=>({uid:'u',epoch:1,ready:true}),
  owner:()=>({label:'가상 작성자',name:'가상 작성자',email:'',search:''}),workspace:()=>({name:'가상 팀'}),typeName:()=>'훈련',date:v=>v||'',snapPreview,
  rpc:()=>Promise.resolve({workspace_id:A,lib_id:'anim',item})});
ctl.update([{workspace_id:A,lib_id:'anim',name:'가상 전환 패턴',type:'train',made_at:'2026-09-27T10:00:00Z'}],true);
</script>`;
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1100,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base)return r.abort();if(u.pathname==='/')return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
   const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return r.fulfill({status:404,body:''});return r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.css')?'text/css':'text/javascript'});});
 await page.goto(base+'/');await page.evaluate(()=>ctl.open('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','anim'));
 const play=page.locator('[data-ac-action="play"]');await play.waitFor();assert.match(await play.textContent(),/애니메이션 재생 · 3장면/);
 const img=page.locator('.ac-figure img'),before=await img.getAttribute('src');
 await play.click();assert.equal(await page.locator('[data-ac-action="play"]').textContent(),'■ 정지');
 const seen=new Set();const t0=Date.now();
 while(Date.now()-t0<2600){const s=await page.locator('.ac-figure img').getAttribute('src').catch(()=>null);if(s)seen.add(s);if(await page.locator('[data-ac-action="play"]').textContent().catch(()=>'')!=='■ 정지')break;await page.waitForTimeout(60);}
 assert.ok(seen.size>=5,'the scene moves through interpolated positions ('+seen.size+' distinct images)');
 await page.waitForFunction(()=>/애니메이션 재생/.test(document.querySelector('[data-ac-action="play"]').textContent),null,{timeout:5000});
 assert.equal(await page.locator('.ac-figure img').getAttribute('src'),before,'after playback the selected page is shown again');
 // 재생 중 정지
 await page.locator('[data-ac-action="play"]').click();await page.waitForTimeout(300);await page.locator('[data-ac-action="play"]').click();
 assert.match(await page.locator('[data-ac-action="play"]').textContent(),/애니메이션 재생/);
 // 재생 중 다른 페이지로 가도 멈춘다
 await page.locator('[data-ac-action="play"]').click();await page.waitForTimeout(200);await page.locator('[data-ac-action="page-next"]').click();
 const s1=await page.locator('.ac-figure img').getAttribute('src');await page.waitForTimeout(400);assert.equal(await page.locator('.ac-figure img').getAttribute('src'),s1,'navigation stops playback');
 await page.screenshot({path:path.join(process.env.PS_TEST_OUTPUT||path.join(root,'test-results/admin-content-play'),'admin-content-play.png')}).catch(()=>{});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,passed:true,distinctImages:seen.size,cases:['play-button','interpolated-motion','ends-on-selected-page','stop','navigation-stops']}));await context.close();
}finally{await browser.close();}
