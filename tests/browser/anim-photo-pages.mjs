import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startFixture,openApp,build,root,pw} from '../fixtures/team-app.mjs';

// b62c01fe: synthetic pictures only; real exportPagesVideo, encoder, saved Blob and video decoder.
// CI defaults exercise both proven causes: a 4:3 photo and a 500ms real local-read delay.
// Overrides retain separate natural-latency and internal-padding controls. Encoders are never replaced.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const output=process.env.PS_TEST_OUTPUT||'/tmp/ps3178-evidence/anim-photo-pages';
const delayMs=Number(process.env.PS_PHOTO_DELAY_MS??500),fps=15,height=360;
const photoAspect=process.env.PS_PHOTO_ASPECT||'4:3';
const internalPadding=Number(process.env.PS_PHOTO_INTERNAL_PADDING??0);
const missing=process.env.PS_PHOTO_MISSING==='1';
const forceRecorder=process.env.PS_PHOTO_FORCE_RECORDER==='1';
const forceUnsupported=process.env.PS_PHOTO_FORCE_UNSUPPORTED==='1';
assert.ok(['16:9','4:3'].includes(photoAspect));
assert.ok(Number.isFinite(delayMs)&&delayMs>=0&&Number.isFinite(internalPadding)&&internalPadding>=0&&internalPadding<.2);
fs.mkdirSync(output,{recursive:true});
const fx=await startFixture(),browsers={};
const result={test:missing?'anim-photo-missing':'anim-photo-pages',report:'b62c01fe-565c-42f2-9b41-10249ea53b9f',engine,size,build,delayMs,photoAspect,internalPadding,missing,forceRecorder,forceUnsupported,fps,height,externalConnections:'blocked by team-app fixture',privateAttachmentUsed:false,sourceHashes:Object.fromEntries(['studio/board.html','studio/board-pitch-photo.js','studio/board-tweaks.js'].map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')])),passed:false,stages:[]};
let page,bf,logs=[];
const stage=s=>{result.stages.push({stage:s,at:new Date().toISOString()});fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify(result,null,2)+'\n');console.log('anim-photo-pages '+s);};
const authoredFrame=({thumb,...frame})=>frame;
const authoredSource=x=>({...x,frames:x.frames.map(authoredFrame),pages:x.pages.map(({thumb,anim,...p})=>({...p,anim:anim?{...anim,frames:anim.frames.map(authoredFrame)}:anim}))});
const compareSources=()=>{
  result.rawSourcePreserved=JSON.stringify(result.after)===JSON.stringify(result.before);
  result.sourcePreserved=JSON.stringify(authoredSource(result.after))===JSON.stringify(authoredSource(result.before));
  result.derivedPreviewChanges=result.before.frames.flatMap((f,i)=>f.thumb===result.after.frames[i]?.thumb?[]:[`frames[${i}].thumb`]);
  result.derivedPreviewChanges.push(...result.before.pages.flatMap((p,i)=>p.thumb===result.after.pages[i]?.thumb?[]:[`pages[${i}].thumb`]));
};
const readState=()=>bf.evaluate(()=>({list:window.__psPages.exportList(),pages:JSON.parse(JSON.stringify(window.__psPages.pg())),current:captureSnap(),frames:JSON.parse(JSON.stringify(anim.frames)),active:animActive,page:window.__psPages.pageInfo()}));
const runtimeSnapshot=()=>bf.evaluate(()=>{const e=window.__photoExport;return {vendor:navigator.vendor,platform:navigator.platform,capabilities:e?.capabilities,activeCapabilities:{mediaRecorder:typeof MediaRecorder,videoEncoder:typeof VideoEncoder,videoFrame:typeof VideoFrame},capabilityProbe:e?.capabilityProbe,codecConfig:e?.codecConfig,pick:e?.pick,write:e?.write,remove:e?.remove,anchor:e?.anchor,requested:e?.requested,blob:e?.blob?{size:e.blob.size,type:e.blob.type}:null,reads:e?.reads||[],toasts:e?.toasts||[],recorderStates:(e?.recorders||[]).map(r=>({state:r.state,mimeType:r.mimeType})),xml:e?.xml||[],raster:e?.raster||[],guard:{animExport:window.__animExport,animExport3d:window.__animExport3d,fit:window.__psExportFit,picking:typeof _animPicking==='undefined'?null:_animPicking,busy:typeof PEP==='undefined'?null:PEP.busy()},progress:document.getElementById('psExpProg')?.className||null};});
// The identical saved bytes and pixel probes are used by the native and isolated cross decoder.
async function decodeVideoPixels({base64,indexes,fps,colors,type}){
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),v=document.createElement('video'),url=URL.createObjectURL(new Blob([bytes],{type}));
  const rgb=h=>h.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)),palettes=colors.map(p=>p.map(rgb));
  const wait=name=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('video '+name+' timeout')),10000);v.addEventListener(name,()=>{clearTimeout(timer);resolve();},{once:true});v.addEventListener('error',()=>{clearTimeout(timer);reject(Error('video decode '+v.error?.code));},{once:true});});
  try{
    v.muted=true;v.preload='auto';v.src=url;await wait('loadeddata');
    const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d'),samples=[];
    for(const frame of indexes){const time=(frame+.35)/fps;if(Math.abs(v.currentTime-time)>.001){const done=wait('seeked');v.currentTime=time;await done;}ctx.drawImage(v,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height).data;
      const at=(x,y)=>{const i=(Math.floor(y*c.height)*c.width+Math.floor(x*c.width))*4;return Array.from(d.slice(i,i+4));};
      const edge=[[.01,.05],[.25,.015],[.99,.05],[.01,.3],[.99,.3],[.01,.5],[.99,.5],[.01,.7],[.99,.7],[.01,.84],[.25,.84],[.99,.84]].map(p=>at(...p));
      const match=(v,p)=>p.some(a=>a.every((n,k)=>Math.abs(n-v[k])<=35));
      const grid=[];for(const y of [.02,.12,.3,.5,.7,.84])for(const x of [.01,.15,.35,.5,.65,.85,.99])grid.push(at(x,y));
      samples.push({frame,time,decoded:true,width:c.width,height:c.height,edge,edgeCounts:palettes.map(p=>edge.filter(v=>match(v,p)).length),edgeColorCounts:palettes.map(p=>p.map(a=>edge.filter(v=>match(v,[a])).length)),gridCounts:palettes.map(p=>grid.filter(v=>match(v,p)).length),gridSize:grid.length});
    }
    return {ok:true,width:c.width,height:c.height,duration:v.duration,samples};
  }catch(error){return {ok:false,error:String(error),errorCode:v.error?.code??null,width:v.videoWidth,height:v.videoHeight,duration:v.duration};}
  finally{v.removeAttribute('src');v.load();URL.revokeObjectURL(url);}
}
try{
  ({page,logs}=await openApp(fx,size,{browsers}));
  if(size==='desktop')await page.setViewportSize({width:2560,height:1402});
  stage('app-ready');
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  bf=await(await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.PSPitchPhoto&&window.__psPages&&typeof window.__exportPagesVideo==='function');
  await bf.evaluate(()=>document.getElementById('dfNew').click());
  await bf.waitForSelector('.vcc-item');
  await bf.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/작전판/.test(b.textContent)).click());
  await bf.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultPending);
  result.seed=await bf.evaluate(async({photoAspect,internalPadding,missing})=>{
    const clone=x=>JSON.parse(JSON.stringify(x));
    const specs=[
      {name:'SYNTHETIC A',colors:['#df22ce','#14dce0'],padding:0},
      {name:'SYNTHETIC B',colors:['#f29515','#6424dc'],padding:0},
      // Internal 7% padding is part of this synthetic image, not exporter padding.
      {name:'SYNTHETIC C',colors:['#e43137','#2363df','#40e020'],padding:internalPadding}
    ];
    const data=[];
    for(const spec of specs){
      const c=document.createElement('canvas');c.width=photoAspect==='4:3'?960:1280;c.height=720;const ctx=c.getContext('2d'),p=spec.padding;
      ctx.fillStyle=spec.colors[2]||spec.colors[0];ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle=spec.colors[0];ctx.fillRect(c.width*p,c.height*p,c.width*(.5-p),c.height*(1-2*p));
      ctx.fillStyle=spec.colors[1];ctx.fillRect(c.width*.5,c.height*p,c.width*(.5-p),c.height*(1-2*p));
      const url=c.toDataURL('image/png'),ref=PSPitchPhoto.refOf(url,c.width,c.height),key=PSPitchPhoto.PREFIX+PSPitchPhoto.idOf(ref);
      const absent=missing&&data.length===0;
      if(!absent)await storage.set(key,url);
      const saved=await storage.get(key);
      if(absent?saved?.value!==undefined&&saved?.value!==null:saved?.value!==url)throw Error('real local picture presence/absence not verified');
      data.push({...spec,ref,key,urlBytes:url.length,width:c.width,height:c.height,absentVerified:absent});
    }
    const base=captureSnap();base.orientation='h';base.spFlip=false;base.pitchView='full';base.pitchN=1;base.drawings=[];base.equipment=[];
    const pages=data.map((photo,i)=>{
      const snap=clone(base);snap.pitchImg=photo.ref;snap.players=[{id:901+i,team:'blue',num:String(7+i),x:350+i*75,y:300}];
      const end=clone(snap);end.players[0].x+=110;
      return {name:photo.name,snap,thumb:'',anim:{frames:[{snap:clone(snap),dur:.3,hold:.2},{snap:end,dur:.3,hold:.2}],active:0,hold:.2,title:'',titleColor:''}};
    });
    // Opening the last page warms only C; A/B start with genuine IDB-backed cold module caches.
    window.__psPages.restore(pages,true,2);
    window.__photoTestSpecs=data;
    return {photos:data,pages:pages.map(p=>({name:p.name,photo:p.snap.pitchImg,players:p.anim.frames.map(f=>f.snap.players)})),currentIndex:2};
  },{photoAspect,internalPadding,missing});
  await bf.waitForFunction(()=>document.querySelector('#ps-pitchimg')?.getAttribute('href')?.startsWith('data:image/'));
  await bf.evaluate(()=>{autoSaveAnimFrame();});
  result.before=await readState();
  assert.equal(result.before.list.length,3);
  for(let i=0;i<3;i++){
    assert.equal(result.before.list[i].frames.length,2);
    assert.ok(result.before.list[i].frames.every(f=>f.snap.pitchImg===result.seed.photos[i].ref),'authored photo refs retained');
    assert.deepEqual(result.before.list[i].frames.map(f=>f.snap.players),result.seed.pages[i].players,'authored player positions retained before export');
  }
  stage('three-local-photo-pages-ready');
  await bf.evaluate(async({delayMs,fps,height,missing,forceRecorder,forceUnsupported})=>{
    const e=window.__photoExport={pick:0,write:0,remove:0,anchor:0,blob:null,xml:[],raster:[],reads:[],recorders:[],toasts:[],delayMs,fps,height,startedAt:performance.now(),last:null,canvas:null};
    const specs=window.__photoTestSpecs;
    const originalGet=storage.get;
    storage.get=function(key){
      if(!String(key).startsWith(PSPitchPhoto.PREFIX))return originalGet.apply(this,arguments);
      const item={key,started:performance.now()-e.startedAt};e.reads.push(item);
      const self=this,args=arguments;
      return (delayMs?new Promise(r=>setTimeout(r,delayMs)):Promise.resolve()).then(()=>originalGet.apply(self,args)).then(v=>{item.finished=performance.now()-e.startedAt;item.found=typeof v?.value==='string';item.matchesStoredContentAddress=item.found&&PSPitchPhoto.hash(v.value)===String(key).slice(PSPitchPhoto.PREFIX.length);return v;},err=>{item.error=String(err);throw err;});
    };
    const rgb=h=>h.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16));
    const palettes=specs.map(s=>s.colors.map(rgb));
    e.sample=function(canvas,meta){
      const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,d=ctx.getImageData(0,0,w,h).data;
      const at=(x,y)=>{const i=(Math.min(h-1,Math.floor(y*h))*w+Math.min(w-1,Math.floor(x*w)))*4;return Array.from(d.slice(i,i+4));};
      const match=(v,palette)=>palette.some(c=>c.every((n,k)=>Math.abs(n-v[k])<=35));
      // Avoid the authored two-color seam at x=.5; codec chroma blends are not missing photos.
      const edgePoints=[[.01,.05],[.25,.015],[.99,.05],[.01,.3],[.99,.3],[.01,.5],[.99,.5],[.01,.7],[.99,.7],[.01,.84],[.25,.84],[.99,.84]];
      const edge=edgePoints.map(p=>at(...p));
      const counts=palettes.map(p=>edge.filter(v=>match(v,p)).length);
      const grid=[];for(const y of [.02,.12,.3,.5,.7,.84])for(const x of [.01,.15,.35,.5,.65,.85,.99])grid.push(at(x,y));
      return {...meta,width:w,height:h,edge,edgeCounts:counts,edgeColorCounts:palettes.map(p=>p.map(c=>edge.filter(v=>match(v,[c])).length)),gridCounts:palettes.map(p=>grid.filter(v=>match(v,p)).length),gridSize:grid.length};
    };
    window.showSaveFilePicker=async options=>{e.pick++;e.name=options.suggestedName;return {name:options.suggestedName,remove:async()=>{e.remove++;},createWritable:async()=>({write:async blob=>{e.write++;e.blob=blob;},close:async()=>{}})};};
    const toast=window.toast;window.toast=function(message){e.toasts.push(String(message));return toast.apply(this,arguments);};
    if(typeof MediaRecorder==='function'){const ActualRecorder=MediaRecorder;window.MediaRecorder=class extends ActualRecorder{constructor(){super(...arguments);e.recorders.push(this);}};}
    const pickConfig=window._wcPickConfig;window._wcPickConfig=async function(){const config=await pickConfig.apply(this,arguments);e.codecConfig=config?{...config}:null;return config;};
    const saveBlob=window._animSaveBlob;window._animSaveBlob=function(blob){e.blob=blob;return saveBlob.apply(this,arguments);};
    const capture=HTMLCanvasElement.prototype.captureStream;
    HTMLCanvasElement.prototype.captureStream=function(){if(window.__animExport){e.captureAt=performance.now()-e.startedAt;e.captureInitial=e.sample(this,{at:e.captureAt});}return capture.apply(this,arguments);};
    const click=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){if(this.download){e.anchor++;e.downloadName=this.download;return;}return click.apply(this,arguments);};
    const original=window.boardImageXML;
    window.boardImageXML=function(vb){
      const o=original.apply(this,arguments);
      if(window.__animExport&&Array.isArray(vb)){
        const image=/<image\b[^>]*\bid="ps-pitchimg"[^>]*>/.exec(o.xml)?.[0]||'';
        const attr=k=>new RegExp('(?:^|\\s)'+k+'="([^"]*)"').exec(image)?.[1]??null;
        const ref=state.pitchImg,photo=specs.findIndex(s=>s.ref===ref);
        e.last={frame:e.xml.length,photo,ref,vb:o.vb,photoPresent:!!image,photoRect:image?['x','y','width','height'].map(k=>Number(attr(k))):null,at:performance.now()-e.startedAt};
        e.xml.push(e.last);
      }
      return o;
    };
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(source){
      const out=draw.apply(this,arguments),c=this.canvas;
      if(window.__animExport&&c.width===Math.round(height*16/9/2)*2&&c.height===height&&source instanceof HTMLImageElement&&source.src.startsWith('data:image/svg+xml')&&e.last){
        e.canvas=c;e.raster.push(e.sample(c,e.last));
        const n=e.raster.length,prior=e.raster[n-2];
        if(!prior||prior.photo!==e.last.photo)e['paintPage'+e.last.photo]=c.toDataURL('image/png');
      }
      return out;
    };
    e.capabilities={mediaRecorder:typeof MediaRecorder,videoEncoder:typeof VideoEncoder,videoFrame:typeof VideoFrame,vendor:navigator.vendor,platform:navigator.platform};
    if(forceRecorder){window.VideoEncoder=undefined;e.forcedRecorder=typeof VideoEncoder==='undefined';}
    if(forceUnsupported){window.VideoEncoder=undefined;window.MediaRecorder=undefined;}
    e.capabilityProbe={mediaRecorder:typeof MediaRecorder,videoEncoder:typeof VideoEncoder,videoFrame:typeof VideoFrame,vendor:navigator.vendor,platform:navigator.platform,codecConfig:await window._wcPickConfig(Math.round(height*16/9/2)*2,height,fps,5000000)};
  },{delayMs,fps,height,missing,forceRecorder,forceUnsupported});
  await bf.evaluate(()=>{document.getElementById('cmd-export-btn')?.click();document.getElementById('animExport').click();});
  await bf.waitForSelector('#evSheet #evGo');
  await bf.evaluate(()=>{
    const pick=t=>[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent===t).click();
    pick('여러 페이지');pick('720p');pick('15fps');
    // Keep the actual public export API, reducing only the explicit output resolution for pixel diagnostics.
    const go=document.getElementById('evGo'),old=go.onclick;
    window.__photoPublicExport=window.exportPagesVideo;
    window.exportPagesVideo=function(options){window.__photoExport.requested=true;return window.__photoPublicExport({...options,height:360});};
    window.__photoGoWasHandler=typeof old==='function';
  });
  stage('real-export-start');
  await bf.locator('#evSheet #evGo').click();
  await bf.waitForFunction(()=>{const e=window.__photoExport;return (e.blob&&document.getElementById('psExpProg')?.className==='done')||(e.requested&&e.remove>0&&!window.__animExport&&!PEP.busy());},null,{timeout:missing?30000:120000});
  result.runtime=await runtimeSnapshot();
  const unsupported=result.runtime.capabilityProbe.mediaRecorder==='undefined'&&result.runtime.capabilityProbe.codecConfig===null;
  if(unsupported){
    result.mode='unsupported-native-video/frame-probe';
    result.validationMode='unsupported-native-video';
    assert.ok(result.runtime.toasts.includes('이 브라우저는 영상 저장을 지원하지 않아요'),'native unsupported-video message');
    assert.equal(result.runtime.write,0);assert.equal(result.runtime.anchor,0);assert.equal(result.runtime.blob,null);assert.ok(result.runtime.remove>0);
    assert.ok(!Object.values(result.runtime.guard).some(Boolean),'unsupported export releases all guards');
    result.afterUnsupported=await readState();result.after=result.afterUnsupported;compareSources();assert.equal(result.sourcePreserved,true,'unsupported video leaves all authored source unchanged');
    result.frameProbe=await bf.evaluate(async({missing,height})=>{
      const e=window.__photoExport,out={mode:missing?'native-production-photo-ready-missing':'native-production-photo-frames',encodedVideo:false,frames:[],redo:0,started:performance.now()-e.startedAt};
      const savedFrames=window.__psPages.exportList();
      if(missing){
        const ref=window.__photoTestSpecs[0].ref;
        try{await _animExportGuard(async()=>{await PSPitchPhoto.ready(ref,()=>{out.redo++;renderPitchImg();});});out.rejected=false;}
        catch(error){out.rejected=true;out.error=String(error);out.userMessage=error.psUserMessage;}
      }else{
        await _animExportGuard(async()=>{
          for(const page of savedFrames)for(let i=0;i<page.frames.length;i++){
            loadSnap(page.frames[i].snap);
            await PSPitchPhoto.ready(state.pitchImg,()=>{out.redo++;renderPitchImg();});
            const readyAt=performance.now()-e.startedAt,raw=boardImageXML(),view=_export169(raw.vb),o=boardImageXML(view),meta={...e.last,page:page.i,scene:i,readyAt};
            const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('native photo SVG decode'));image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(o.xml);});if(image.decode)await image.decode();
            const c=document.createElement('canvas');c.width=Math.round(height*16/9/2)*2;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle=o.gb;ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);
            out.frames.push(e.sample(c,meta));
            if(i===0)out['page'+page.i]=c.toDataURL('image/png');
          }
        });
      }
      out.finished=performance.now()-e.startedAt;out.reads=e.reads;return out;
    },{missing,height});
    for(let i=0;i<3;i++){const key='page'+i,url=result.frameProbe[key];if(url){fs.writeFileSync(path.join(output,`native-frame-probe-page-${i+1}.png`),Buffer.from(url.split(',')[1],'base64'));delete result.frameProbe[key];}}
    result.after=await readState();compareSources();result.runtimeAfterFrameProbe=await runtimeSnapshot();
    assert.equal(result.sourcePreserved,true,'native frame probe preserves every authored page/frame/snapshot');assert.ok(!Object.values(result.runtimeAfterFrameProbe.guard).some(Boolean));
    if(missing){
      assert.equal(result.frameProbe.rejected,true,'actual product ready rejects absent picture');assert.equal(result.frameProbe.redo,0,'missing picture never rerenders');assert.match(result.frameProbe.userMessage,/사진/);
      assert.ok(result.frameProbe.reads.some(r=>r.key===result.seed.photos[0].key&&r.found===false&&Number.isFinite(r.finished)),'real missing IDB read completes');
      result.missingReadyProbe=result.frameProbe;delete result.frameProbe;
    }else{
      assert.equal(result.frameProbe.frames.length,6,'three pages and two actual authored scenes each');assert.equal(result.frameProbe.redo,6);
      for(const frame of result.frameProbe.frames){
        assert.equal(frame.photo,frame.page);assert.equal(frame.photoPresent,true);assert.equal(frame.edgeCounts[frame.page],frame.edge.length,'all native SVG/canvas photo edges');
        const [x,y,w,h]=frame.photoRect,[vx,vy,vw,vh]=frame.vb;assert.ok(x<=vx+.5&&y<=vy+.5&&x+w>=vx+vw-.5&&y+h>=vy+vh-.5,'product photo view is full-bleed');
        const reads=result.frameProbe.reads.filter(r=>r.key===result.seed.photos[frame.page].key);if(frame.page<2)assert.ok(reads.some(r=>r.matchesStoredContentAddress&&r.finished<=frame.readyAt),'actual IDB payload ready before native SVG capture');
      }
    }
    result.errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(result.errors,[]);
    result.passed=true;stage('unsupported-native-video-verified-with-native-frame-probe');
  }else if(missing){
    result.mode='native-video/missing-photo-rejected';
    result.validationMode='missing-photo';
    result.export=await bf.evaluate(()=>{const e=window.__photoExport;return {pick:e.pick,write:e.write,remove:e.remove,anchor:e.anchor,blob:e.blob?{size:e.blob.size,type:e.blob.type}:null,reads:e.reads,toasts:e.toasts,recorderStates:e.recorders.map(r=>r.state),capabilities:e.capabilities,guard:{animExport:window.__animExport,animExport3d:window.__animExport3d,fit:window.__psExportFit,picking:_animPicking,busy:PEP.busy()}};});
    result.after=await readState();
    compareSources();result.errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
    await page.screenshot({path:path.join(output,'missing-photo-stopped.png')});
    assert.equal(result.seed.photos[0].absentVerified,true,'valid photo ref has no real IDB item');
    assert.ok(result.export.reads.some(r=>r.key===result.seed.photos[0].key&&r.found===false),'real missing IDB read observed');
    assert.equal(result.export.pick,1);assert.equal(result.export.write,0,'no bad or partial encoded video written');assert.equal(result.export.blob,null);assert.equal(result.export.anchor,0);assert.ok(result.export.remove>0,'unused target removed');
    assert.ok(result.export.recorderStates.every(s=>s==='inactive'),'every actual recorder stopped');
    if(result.export.capabilities.mediaRecorder==='function')assert.ok(result.export.recorderStates.length>0,'real recorder failure path exercised');
    assert.ok(result.export.toasts.some(t=>/사진/.test(t)&&/넣은 기기|읽지 못|내보내/.test(t)),'clear photo-specific user message');
    assert.ok(!Object.values(result.export.guard).some(Boolean),'export guards all released');assert.equal(result.sourcePreserved,true,'missing photo leaves every authored page/frame/snapshot untouched');assert.deepEqual(result.errors,[]);
    result.passed=true;stage('missing-photo-stopped-without-file');
  }else{
  result.mode='native-video';
  result.validationMode='encoded-video';
  assert.ok(result.runtime.blob&&result.runtime.progress==='done','capable environment must produce a completed actual video');
  stage('real-blob-saved');
  result.export=await bf.evaluate(async()=>{
    const e=window.__photoExport,b64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(e.blob);});
    return {pick:e.pick,write:e.write,anchor:e.anchor,name:e.name,downloadName:e.downloadName,size:e.blob.size,type:e.blob.type,capabilities:e.capabilities,codecConfig:e.codecConfig,forcedRecorder:e.forcedRecorder,recorderStates:e.recorders.map(r=>({state:r.state,mimeType:r.mimeType})),captureAt:e.captureAt,captureInitial:e.captureInitial,reads:e.reads,xml:e.xml,raster:e.raster,base64:b64,paintPages:[0,1,2].map(i=>e['paintPage'+i]||null)};
  });
  const ext=result.export.type.includes('mp4')?'mp4':'webm';
  result.export.encoderPath=result.export.recorderStates.length?'mediarecorder':result.export.codecConfig?'webcodecs':'unknown';
  const encodedBase64=result.export.base64,encodedBytes=Buffer.from(encodedBase64,'base64');
  fs.writeFileSync(path.join(output,'actual-export.'+ext),encodedBytes);result.export.sha256=createHash('sha256').update(encodedBytes).digest('hex');delete result.export.base64;
  result.export.paintPages.forEach((url,i)=>{if(url)fs.writeFileSync(path.join(output,`canvas-page-${i+1}.png`),Buffer.from(url.split(',')[1],'base64'));});delete result.export.paintPages;
  result.after=await readState();
  const perPage=p=>p.frames.reduce((n,f,i)=>n+Math.max(1,Math.round((i===p.frames.length-1?Math.max(1,f.hold||p.hold||.6):(f.hold||p.hold||.6))*fps))+(i<p.frames.length-1?Math.max(2,Math.round(Math.max(.3,f.dur||1)/(f.moveSpeed>0?f.moveSpeed:1)*fps))+1:0),0);
  const counts=result.before.list.map(perPage),total=counts.reduce((a,b)=>a+b,0);
  result.expected={counts,total};
  const indexes=new Set([0,total-1]);let boundary=0;
  for(const count of counts){indexes.add(boundary);indexes.add(boundary+1);indexes.add(boundary+Math.floor(count/2));indexes.add(boundary+count-2);indexes.add(boundary+count-1);boundary+=count;}
  const decodeInput={base64:encodedBase64,indexes:[...indexes].sort((a,b)=>a-b),fps,colors:result.seed.photos.map(p=>p.colors),type:result.export.type};
  result.decode=await bf.evaluate(decodeVideoPixels,decodeInput);
  if(engine==='webkit'&&!result.decode.ok&&result.decode.errorCode===4){
    const browser=browsers.chromium||(browsers.chromium=await pw.chromium.launch({headless:true,executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}));
    const context=await browser.newContext({serviceWorkers:'block'});
    try{
      await context.route('**/*',route=>route.abort('blockedbyclient'));await context.routeWebSocket('**/*',socket=>socket.close());const isolated=await context.newPage();
      result.crossDecode={decoder:'chromium',reason:'WebKit native MEDIA_ERR_SRC_NOT_SUPPORTED (4)',sameSavedFileSha256:result.export.sha256,decode:await isolated.evaluate(decodeVideoPixels,decodeInput)};
    }finally{await context.close();}
  }
  const verifiedDecode=result.crossDecode?.decode||result.decode;
  result.durationComparison={expected:total/fps,observed:verifiedDecode.duration,delta:verifiedDecode.duration-total/fps};
  result.readsAtEnd=await bf.evaluate(()=>window.__photoExport.reads);
  result.errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  // A frame's regenerated thumbnail is derived; compare every authored field and every full snapshot.
  compareSources();
  const violations=[];
  const expectedPhoto=i=>{let n=0;for(let p=0;p<counts.length;p++){n+=counts[p];if(i<n)return p;}return -1;};
  for(const frame of result.export.xml){const p=expectedPhoto(frame.frame);if(frame.photo!==p||!frame.photoPresent)violations.push({kind:'svg-photo-missing-or-wrong',frame:frame.frame,expected:p,...frame});
    if(frame.photoRect){const [x,y,w,h]=frame.photoRect,[vx,vy,vw,vh]=frame.vb;if(x>vx+.5||y>vy+.5||x+w<vx+vw-.5||y+h<vy+vh-.5)violations.push({kind:'svg-photo-does-not-fill-export',frame:frame.frame,photo:frame.photo,photoRect:frame.photoRect,vb:frame.vb});}}
  for(const frame of result.export.raster){const p=expectedPhoto(frame.frame);if(frame.edgeCounts[p]!==frame.edge.length)violations.push({kind:'recording-canvas-edge-not-photo',frame:frame.frame,photo:p,edgeCounts:frame.edgeCounts,edge:frame.edge});
    if(internalPadding>0&&p===2&&frame.edgeColorCounts[2][2]<10)violations.push({kind:'authored-padding-cropped-in-canvas',frame:frame.frame,colors:frame.edgeColorCounts[2]});}
  if(verifiedDecode.ok)for(const frame of verifiedDecode.samples){const p=expectedPhoto(frame.frame);if(frame.edgeCounts[p]!==frame.edge.length)violations.push({kind:'saved-blob-edge-not-photo',frame:frame.frame,photo:p,edgeCounts:frame.edgeCounts,edge:frame.edge});
    if(internalPadding>0&&p===2&&frame.edgeColorCounts[2][2]<10)violations.push({kind:'authored-padding-cropped-in-saved-blob',frame:frame.frame,colors:frame.edgeColorCounts[2]});}
  result.violations=violations;
  stage('observations-collected');
  fs.writeFileSync(path.join(output,'observations.json'),JSON.stringify(result,null,2)+'\n');
  await page.screenshot({path:path.join(output,'after-export.png')});
  assert.equal(result.export.write+result.export.anchor,1,'one actual encoded video save or download');assert.ok(result.export.size>2000,'actual video is nonempty');
  if(forceRecorder){assert.equal(result.export.forcedRecorder,true);assert.ok(result.export.recorderStates.length>0,'actual MediaRecorder used');assert.equal(result.export.codecConfig,null,'WebCodecs disabled for explicit fallback probe');}
  assert.equal(result.export.xml.length,total,'no extra page-transition frames');assert.equal(result.export.raster.length,total,'each actual recording canvas paint observed');
  assert.equal(result.sourcePreserved,true,'all pages, frames, current board and selection restored exactly');
  assert.deepEqual(result.errors,[],'no uncaught browser error');
  assert.equal(verifiedDecode.ok,true,'actual saved Blob decodes');assert.deepEqual([verifiedDecode.width,verifiedDecode.height],[640,360]);
  assert.equal(violations.length,0,'all real SVG/canvas/saved-video pages must stay full-bleed with no default pitch gaps: '+JSON.stringify(violations.slice(0,3)));
  result.passed=true;stage('passed');
  }
}catch(error){
  result.error={message:String(error),stack:error.stack};
  if(bf)try{result.failureRuntime=await runtimeSnapshot();}catch(snapshotError){result.failureRuntimeError=String(snapshotError);}
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  throw error;
}finally{
  fs.writeFileSync(path.join(output,'final.json'),JSON.stringify(result,null,2)+'\n');
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
