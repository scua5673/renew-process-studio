const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const P=require('../studio/board-pitch-photo.js');
const source=fs.readFileSync(require.resolve('../studio/board-pitch-photo.js'),'utf8');
const pr={L:30,T:30,PW:1050,PH:680};
function api(get){const w={storage:{get,set(){throw Error('export must not write photos');}}};
  const c={window:w,module:{exports:{}},setTimeout:()=>1};vm.runInNewContext(source,c);return {p:c.module.exports,w};}

test('photo video keeps the image scale and fills 16:9 inside the image, rather than adding pitch margins',()=>{
  for(const [w,h] of [[1600,900],[1600,1200],[900,1600]]){
    const s={pitchImg:P.refOf('synthetic '+w+'x'+h,w,h),orientation:'h'};
    const box=P.videoBox(s,pr,30,1110,740,16/9),image=P.place(P.frame(pr,30),w,h);
    assert.ok(Math.abs(box[2]/box[3]-16/9)<1e-9,'output aspect ratio');
    assert.ok(box[0]>=image[0]-.001&&box[1]>=image[1]-.001&&box[0]+box[2]<=image[0]+image[2]+.001&&box[1]+box[3]<=image[1]+image[3]+.001,'every output corner stays inside the actual image');
    assert.ok(Math.abs(box[0]+box[2]/2-555)<=.01&&Math.abs(box[1]+box[3]/2-370)<=.01,'authored centre retained at the rendered image precision');
  }
  const four=P.videoBox({pitchImg:P.refOf('four',1600,1200)},pr,30,1110,740,16/9);
  assert.deepEqual(four,[0,57.8125,1110,624.375],'4:3 uses a centred crop without changing coordinates or stretching the image');
});

test('photo framing follows vertical and flipped world coordinates and leaves normal/3D framing alone',()=>{
  const ref=P.refOf('wide',1600,900);
  for(const flip of [false,true]){
    const s={pitchImg:ref,orientation:'v',spFlip:flip},before=JSON.stringify(s);
    const box=P.videoBox(s,pr,30,1110,740,16/9);
    assert.ok(Math.abs(box[0]+box[2]/2-370)<.001&&Math.abs(box[1]+box[3]/2-555)<.001);
    assert.ok(Math.abs(box[2]-740)<.001&&Math.abs(box[3]-416.25)<.001);
    assert.equal(JSON.stringify(s),before,'export does not modify authored settings');
  }
  assert.equal(P.videoBox({pitchImg:'@real'},pr,30,1110,740),null);
  assert.equal(P.videoBox({pitchImg:null},pr,30,1110,740),null);
  const {p,w}=api(async()=>({value:''}));w.__animExport3d=1;
  assert.equal(p.videoBox({pitchImg:ref},pr,30,1110,740),null,'3D intentionally keeps its stadium');
  assert.ok(P.videoBox({pitchImg:P.refOf('legacy')},pr,30,1110,740),'older refs without dimensions still use their rendered frame');
});

test('export readiness waits for the real read, shares in-flight reads and redraws only after the image is available',async()=>{
  const url='data:image/png;base64,synthetic',ref=P.refOf(url,1600,900);let release,reads=0,redraws=0;
  const gate=new Promise(r=>release=r),{p}=api(()=>{reads++;return gate;});
  const a=p.ready(ref,()=>{assert.equal(p.href(ref),url);redraws++;}),b=p.ready(ref,()=>redraws++);
  await Promise.resolve();assert.equal(reads,1);assert.equal(redraws,0,'an IDB request being queued is not readiness');
  release({value:url});await Promise.all([a,b]);assert.equal(redraws,2);assert.equal(p.href(ref),url);
  await p.ready(ref);assert.equal(reads,1,'warm image does not read again');
});

test('a missing or failed photo aborts readiness, can recover, and never writes replacement data',async()=>{
  const url='data:image/png;base64,synthetic',ref=P.refOf(url,1600,900);let result=null,reads=0,redraws=0;
  const {p}=api(async()=>{reads++;if(result instanceof Error)throw result;return {value:result};});
  await p.ready('@real',()=>redraws++);assert.equal(reads,0);
  await assert.rejects(p.ready(ref,()=>redraws++),e=>e.psUserMessage===p.T.miss);
  result=new Error('temporary IDB failure');
  // A separate image tests the transient-read message, rather than a cached missing result.
  const other=p.refOf('other',1600,900);
  await assert.rejects(p.ready(other),e=>e.psUserMessage===p.T.exportRead);
  result=url;await p.ready(ref,()=>redraws++);assert.equal(redraws,1);assert.equal(p.href(ref),url);
});

test('an export can revisit an image after the 24-image cache evicts it',async()=>{
  const urls=Array.from({length:25},(_,i)=>'data:image/png;base64,synthetic'+i),refs=urls.map(u=>P.refOf(u,1600,900));
  const values=new Map(refs.map((r,i)=>[P.PREFIX+P.idOf(r),urls[i]]));let reads=0;
  const {p}=api(async key=>{reads++;return {value:values.get(key)};});
  for(const ref of refs)await p.ready(ref);
  assert.equal(reads,25);await p.ready(refs[0]);assert.equal(reads,26,'eviction triggers a real awaited reload');assert.equal(p.href(refs[0]),urls[0]);
});
