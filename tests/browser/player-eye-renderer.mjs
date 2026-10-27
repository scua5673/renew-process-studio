import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {pw,SHOTS,OUT} from '../fixtures/team-app.mjs';

// Synthetic 22-player scene. These are rendering budgets, not device FPS claims.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const browser=await pw.chromium.launch({headless:true,executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath(),args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1200,height:720},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>body{margin:0}canvas{display:block;width:1200px;height:720px}.pe-player-label{display:none}</style><canvas></canvas><div id="labels"></div>');
  for(const file of ['vendor/three/three.min.js','studio/player-eye-model.js','studio/player-eye-quality.js','studio/player-eye-renderer.js'])await page.addScriptTag({path:path.join(root,file)});
  await page.evaluate(()=>{
    const Native=THREE.WebGLRenderer;THREE.WebGLRenderer=function(...args){window.qaGpu=new Native(...args);return qaGpu;};
    window.qaView=PSPlayerEyeRenderer.create(document.querySelector('canvas'),document.querySelector('#labels'),()=>{throw Error('context lost');});
    window.qaFrame={field:{len:105,wid:68,spec:{goal:7.32}},drawings:[],equipment:[],ball:null,moving:false,players:[{key:'self',x:0,z:0,body:0,num:6,color:'#25568b'},{key:'front',x:4,z:-1.1,body:180,num:9,color:'#bc6458'},{key:'back',x:4,z:1.1,body:0,num:8,color:'#25568b'}]};
    for(let i=3;i<22;i++)qaFrame.players.push({key:'p'+i,x:7+Math.floor(i/5)*4,z:(i%5-2)*3,body:i%2?0:180,num:i,color:i%2?'#25568b':'#bc6458'});
    window.qaCam=PSPlayerEyeModel.camera(qaFrame.players[0],0,-5,1.65,null,false);
    window.qaOpts={selected:'self',time:0,names:false,fov:50,quality:PSPlayerEyeQuality.profiles[0],stadium:true};
    window.qaStats=()=>({memory:{...qaGpu.info.memory},render:{...qaGpu.info.render},width:qaGpu.domElement.width,height:qaGpu.domElement.height});
    qaView.update(qaFrame,qaCam,qaOpts);
  });
  await page.screenshot({path:path.join(SHOTS,'player-eye-stadium-full.png')});
  const stats=await page.evaluate(()=>{
    const full=qaStats();qaView.update(qaFrame,qaCam,{...qaOpts,stadium:false});const noStadium=qaStats();
    qaOpts.quality=PSPlayerEyeQuality.profiles[2];qaView.update(qaFrame,qaCam,qaOpts);const light=qaStats();
    for(let i=0;i<10;i++){qaView.update(qaFrame,qaCam,{...qaOpts,quality:PSPlayerEyeQuality.profiles[0]});qaView.update(qaFrame,qaCam,qaOpts);}
    const cycled=qaStats();
    // Rebuild light vertex colors when a team color or number changes.
    qaFrame.players[1].color='#2f7040';qaFrame.players[1].num=10;qaView.update(qaFrame,qaCam,qaOpts);const changed=qaStats();
    return {full,noStadium,light,cycled,changed};
  });
  await page.screenshot({path:path.join(SHOTS,'player-eye-stadium-light.png')});
  stats.lifecycle=await page.evaluate(()=>{
    qaFrame.players=[qaFrame.players[0]];qaView.update(qaFrame,qaCam,qaOpts);const removed=qaStats();
    // Rebuild the stadium for a different pitch without accumulating textures.
    qaFrame.field.len=40;qaFrame.field.wid=20;qaView.update(qaFrame,qaCam,qaOpts);const smaller=qaStats();
    qaView.dispose();return {removed,smaller,disposed:{...qaGpu.info.memory}};
  });
  fs.writeFileSync(path.join(OUT,'player-eye-renderer-budget.json'),JSON.stringify({stats,errors,environment:'Chromium / SwiftShader. Actual iPad performance is unmeasured.'},null,2));
  assert.deepEqual(errors,[]);
  assert.ok(stats.full.render.calls-stats.noStadium.render.calls<=8,'stadium uses at most eight draw calls');
  assert.ok(stats.full.render.calls>stats.noStadium.render.calls,'stadium visibility changes the rendered scene');
  assert.ok(stats.light.render.calls<stats.full.render.calls*.5,'light characters halve draw calls');
  assert.ok(stats.light.render.triangles<stats.full.render.triangles*.4,'light characters cut geometry');
  assert.ok(stats.full.width*stats.full.height<=1800000);
  assert.ok(stats.light.width*stats.light.height<=600000);
  assert.deepEqual(stats.cycled.memory,stats.light.memory,'switching quality does not accumulate GPU allocations');
  assert.deepEqual(stats.changed.memory,stats.light.memory,'changing a light player replaces resources');
  assert.ok(stats.lifecycle.removed.memory.geometries<stats.light.memory.geometries);
  assert.equal(stats.lifecycle.smaller.memory.textures,stats.lifecycle.removed.memory.textures);
  assert.equal(stats.lifecycle.disposed.textures,0);
  assert.ok(stats.lifecycle.disposed.geometries<=1,'only Three internal background geometry may remain');
  console.log('player-eye-renderer ok',JSON.stringify(stats));
}finally{await browser.close();}
