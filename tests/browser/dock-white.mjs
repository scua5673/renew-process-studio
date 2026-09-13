import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const require=createRequire(import.meta.url);
const playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/dock-white',engine);
fs.mkdirSync(out,{recursive:true});
// The isolated page compares the previous CSS with the applied CSS on identical DOM/state.
// Pinning the baseline lets the test remain useful after the release commit.
const previous=execFileSync('git',['show',`${process.env.PS_DOCK_BASE_REF||'1843014'}:studio/board.html`],{cwd:root,encoding:'utf8',maxBuffer:5e6});
const previousStyles=Object.fromEntries(['ps-2614-dock','ps-2288-col'].map(id=>[id,previous.match(new RegExp(`<style id="${id}">([\\s\\S]*?)<\\/style>`))[1]]));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
const results=[];
const wait=page=>page.waitForTimeout(250);
try{
 browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
 for(const spec of [{name:'desktop',width:1280,height:900},{name:'tablet-touch',width:1024,height:768,touch:true},{name:'phone',width:393,height:852,touch:true,mobile:true}]){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:!!spec.touch,isMobile:!!spec.mobile,...(spec.touch?{userAgent:spec.mobile?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1':'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}:{}),deviceScaleFactor:1,serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push({message:e.message,stack:e.stack}));
  await page.goto(base+'/studio/app.html',{waitUntil:'domcontentloaded'});
  const frame=await page.locator('#fBoard').elementHandle().then(e=>e.contentFrame());
  await frame.waitForSelector(spec.mobile?'#boardStage':'#ps-command-dock',{state:'attached'});
  await page.waitForTimeout(6500);await page.mouse.move(0,0);
  await frame.evaluate(()=>{window.__dockAppliedStyles=Object.fromEntries(['ps-2614-dock','ps-2288-col'].map(id=>[id,document.getElementById(id).textContent]));});
  const apply=async on=>{await frame.evaluate(({on,old})=>{for(const[id,css]of Object.entries(on?window.__dockAppliedStyles:old))document.getElementById(id).textContent=css;window.dispatchEvent(new Event('resize'));},{on,old:previousStyles});await wait(page);await page.mouse.move(0,0);};
  const inspect=()=>frame.evaluate(()=>{
   const geom=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
   const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
   return {body:document.body.className,viewport:{width:innerWidth,height:innerHeight},board:geom(document.getElementById('boardStage')),rows:['ps-command-dock','ps-dock','animBar','drawPanel','cmd-tool-row'].map(id=>{const e=document.getElementById(id);return{id,...(e?geom(e):{missing:true})};}),controls:[...document.querySelectorAll('#ps-command-dock button,#ps-command-dock select,#ps-command-dock #railEquip .chip,#ps-dock button')].filter(visible).map(e=>{const s=getComputedStyle(e);return{id:e.id,tool:e.dataset.tool||'',cat:e.dataset.cat||'',label:e.getAttribute('aria-label')||e.title||e.textContent.trim(),tag:e.tagName,...geom(e),paint:[s.color,s.backgroundColor,s.borderRadius,s.fontSize],aria:e.getAttribute('aria-pressed')};}),colors:[...document.querySelectorAll('#ps-command-dock .catpill.tpill,#ps-command-dock .cmd-stamp-token,#ps-command-dock #railEquip .chip.equip,#colorBtn,#colorBtn .cpen,.cmd-equip-color-swatch')].filter(visible).map(e=>({id:e.id,cat:e.dataset.cat||'',color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor,pen:e.style.getPropertyValue('--penc'),svg:[...e.querySelectorAll('svg [fill]')].map(n=>n.getAttribute('fill'))}))};
  });
  const identity=s=>s.controls.map(c=>[c.id,c.tool,c.cat,c.tag]);
  const checkGeometry=current=>{
   assert.equal(current.controls.length,55,'55 controls remain visible');
   const dock=current.rows.find(r=>r.id==='ps-command-dock');assert.equal(dock.h,108,'dock stays 108px');
   for(const id of ['animBar','drawPanel','cmd-tool-row'])assert.equal(current.rows.find(r=>r.id===id).h,36,`${id} stays 36px`);
   for(const c of current.controls){assert.ok(c.x>=dock.x-1&&c.x+c.w<=dock.x+dock.w+1&&c.y>=dock.y-2&&c.y+c.h<=dock.y+dock.h+1,`inside dock: ${c.label}`);assert.ok(c.x>=-1&&c.x+c.w<=current.viewport.width+1,`inside viewport: ${c.label}`);}
   for(let i=0;i<current.controls.length;i++)for(let j=i+1;j<current.controls.length;j++){const a=current.controls[i],b=current.controls[j],ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);assert.ok(ox<.5||oy<.5,`no overlap: ${a.label}/${b.label}`);}
   for(const id of ['viewBtn','cmd-export-btn']){const c=current.controls.find(c=>c.id===id);assert.equal(c.w,30,id+' icon width');assert.equal(c.h,30,id+' height');assert.ok(c.label.trim(),id+' accessible name');}
  };
  const widths=spec.touch?[spec.width]:[1280,1024,1440];
  for(const width of widths){
   await page.setViewportSize({width,height:spec.height});await wait(page);
   await apply(false);const baseline=await inspect();await apply(true);const current=await inspect();
   assert.deepEqual(identity(current),identity(baseline),'control identity/order retained');
   assert.deepEqual(current.colors,baseline.colors,'functional colors unchanged');
   assert.deepEqual(current.board,baseline.board,'board area unchanged');
   if(spec.touch){assert.deepEqual(current.rows,baseline.rows,'touch geometry unchanged');assert.deepEqual(current.controls,baseline.controls,'touch controls unchanged');
    if(spec.mobile){assert.match(current.body,/\bps-phone-work\b/);assert.equal(await frame.evaluate(()=>{const e=document.getElementById('ps-dock');return !e||getComputedStyle(e).display==='none';}),true,'existing phone viewing mode retained');}
   }
   else {
    checkGeometry(current);
    assert.equal(await frame.locator('#ps-command-dock').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)','white panel applied');
    assert.equal(await frame.locator('#cmd-tools').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','ghost groups applied');
    assert.deepEqual(await frame.locator('#viewBtn>span,#cmd-export-btn>span').evaluateAll(es=>es.map(e=>getComputedStyle(e).display)),['none','none','none'],'only static captions hidden');
    const icons=await frame.locator('#toolSeg>button svg').evaluateAll(es=>es.map(e=>({tool:e.parentElement.dataset.tool,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,style:e.getAttribute('style'),transform:getComputedStyle(e).transform,maxHeight:getComputedStyle(e).maxHeight})));assert.ok(icons.every(e=>Math.abs(e.width-17)<.1&&Math.abs(e.height-17)<.1),'uniform 17px tool icon boxes '+JSON.stringify(icons));
   }
   results.push({name:spec.name,width,baseline,current});
   await page.screenshot({path:path.join(out,`${spec.name}-${width}.png`),animations:'disabled'});
   if(!spec.touch)await frame.locator('#ps-command-dock').screenshot({path:path.join(out,`dock-${width}.png`),animations:'disabled'});
   console.log(JSON.stringify({engine,spec:spec.name,width,controls:current.controls.length,pass:true}));
  }
  if(!spec.touch){
   await page.setViewportSize({width:1280,height:900});await wait(page);
   // Actual controls, no replacements or synthetic click handlers.
   const tool=frame.locator('#toolSeg [data-tool="pass"]');await tool.click();assert.equal(await tool.getAttribute('aria-pressed'),'true');
   await page.keyboard.press('Tab');await tool.focus();await wait(page);
   assert.equal(await frame.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid','keyboard focus visible');
   const hoverTool=frame.locator('#toolSeg [data-tool="line"]');await hoverTool.hover();await wait(page);
   assert.notEqual(await hoverTool.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','hover visible');
   await page.mouse.down();await wait(page);assert.notEqual(await hoverTool.evaluate(e=>getComputedStyle(e).transform),'none','press feedback visible');await page.mouse.up();await wait(page);
   const equip=frame.locator('#railEquip .chip.equip').first();await equip.click();assert.match(await equip.getAttribute('class'),/\bstampon\b/,'equipment selected');
   await frame.locator('#cmd-role-gk').click();assert.equal(await frame.locator('#cmd-role-gk').getAttribute('aria-pressed'),'true');assert.doesNotMatch(await equip.getAttribute('class'),/\bstampon\b/,'role cancels equipment');
   await tool.click();assert.equal(await frame.locator('#cmd-role-gk').getAttribute('aria-pressed'),'false','drawing cancels token stamp');
   await frame.locator('#cmd-export-btn').click();assert.equal(await frame.locator('#cmd-export-btn').getAttribute('aria-expanded'),'true');assert.equal(await frame.locator('#cmd-export-pop button:visible').count(),3,'all export options available');await page.keyboard.press('Escape');
   await frame.locator('#viewBtn').click();assert.equal(await frame.locator('#viewBtn').getAttribute('aria-expanded'),'true');assert.ok(await frame.locator('#cmd-board-settings-pop').isVisible());await frame.locator('#cmd-board-settings-close').click();
   await frame.locator('#cmd-dock-fold').click();assert.ok((await frame.locator('#ps-command-dock').boundingBox()).height<40);await frame.locator('#cmd-dock-handle .open').click();checkGeometry(await inspect());
   // Compare dark mode against the previous palette, then confirm the same geometry and labels.
   await frame.evaluate(()=>document.body.classList.add('fmdark'));await apply(false);const oldDark=await inspect();await apply(true);const dark=await inspect();assert.deepEqual(dark.colors,oldDark.colors,'dark functional colors retained');checkGeometry(dark);
   assert.equal(await frame.locator('#ps-command-dock').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(24, 28, 36, 0.9)','dark panel remains dark');
   await page.screenshot({path:path.join(out,'dark-1280.png'),animations:'disabled'});
   // A disabled action cannot look pressed or acquire motion on hover.
   await frame.locator('#animUpdate').evaluate(e=>e.disabled=true);await frame.locator('#animUpdate').hover();assert.equal(await frame.locator('#animUpdate').evaluate(e=>getComputedStyle(e).transform),'none');assert.equal(await frame.locator('#animUpdate').evaluate(e=>getComputedStyle(e).opacity),'0.4');
   await page.mouse.move(0,0);await frame.locator('#animPlay').evaluate(e=>e.disabled=true);const primaryBg=await frame.locator('#animPlay').evaluate(e=>getComputedStyle(e).backgroundColor);await frame.locator('#animPlay').hover();await wait(page);assert.equal(await frame.locator('#animPlay').evaluate(e=>getComputedStyle(e).backgroundColor),primaryBg,'disabled primary retains readable background');
   results.push({name:'interaction-and-dark',passed:['tool','keyboard-focus','hover','pressed','equipment-stamp','role-stamp','export-menu','board-settings','fold-reopen','dark','disabled'],dark});
  }
  results.push({name:spec.name+'-runtime',errors});
  assert.deepEqual(errors.filter(e=>e.stack.includes('/studio/board.html')),[],'no board runtime errors');await context.close();
 }
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({engine,method:'Same isolated DOM and state: previous 1843014 CSS versus applied CSS. External network blocked; no accounts or real data.',results},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
