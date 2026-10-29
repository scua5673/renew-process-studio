'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const cover=require('../studio/board-meet-cover.js'),names=require('../studio/board-export-name.js');
const source=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
test('cover exports preserve both aspect ratios and expand the pitch without stretching or cropping',()=>{
  const vb=[20,40,800,1200],before=vb.slice();
  for(const format of ['landscape','portrait']){
    const c=cover.create(format),l=cover.layout(c),frame=cover.videoFrame([{cover:c}],720,vb);
    assert.ok(Math.abs(l.w/l.h-(format==='portrait'?9/16:16/9))<1e-12);
    assert.deepEqual([frame.width,frame.height],format==='portrait'?[720,1280]:[1280,720]);
    assert.ok(Math.abs(frame.vb[2]/frame.vb[3]-frame.width/frame.height)<1e-12);
    assert.ok(frame.vb[0]<=vb[0]&&frame.vb[1]<=vb[1]&&frame.vb[2]>=vb[2]&&frame.vb[3]>=vb[3]);
    assert.equal(frame.vb[0]+frame.vb[2]/2,vb[0]+vb[2]/2);assert.equal(frame.vb[1]+frame.vb[3]/2,vb[1]+vb[3]/2);
  }
  assert.deepEqual(vb,before);assert.equal(cover.videoFrame([{snap:{}}],720,vb),null,'meetings without covers retain the previous export layout');
});
test('export date uses the local calendar including year and month boundaries',()=>{
  for(const [d,expected] of [[new Date(2026,9,29,0,1),'261029'],[new Date(2027,0,1,0,0),'270101'],[new Date(2028,1,29,23,59),'280229']]){
    assert.equal(names.stamp(d),expected);assert.equal(names.name('중앙고 미팅','mp4',d),expected+'_중앙고 미팅.mp4');
    assert.equal(names.name(expected+'_중앙고 미팅','pdf',d),expected+'_중앙고 미팅.pdf');
  }
  assert.equal(names.name('A/B:<C>','PNG',new Date(2026,9,29)),'261029_A_B__C_.png');
});
test('cover normalization bounds saved input and escapes active markup in SVG and PDF',()=>{
  const raw={v:1,format:'other',background:'url(https://bad.invalid)',blocks:[{text:'<script>alert(1)</script> & "가"',x:Infinity,y:-30,width:Infinity,size:1e9,weight:900,color:'red" onload="x',align:'malicious'}]};
  const original=JSON.stringify(raw),c=cover.normalize(raw),s=cover.svg(raw);
  assert.equal(JSON.stringify(raw),original);assert.equal(c.background,'#14213d');assert.equal(c.blocks[0].size,180);assert.equal(c.blocks[0].y,0);
  assert.doesNotMatch(s,/<script|onload=|url\(/);assert.match(s,/&lt;/);assert.ok(c.blocks[0].width<=100-c.blocks[0].x);
  assert.match(cover.printPage({cover:c},2),/data-slide-index="2"/);assert.doesNotMatch(cover.printPage({cover:c},2),/<script/);
});
test('free text layout preserves newlines and canvas uses the same line positions as SVG',()=>{
  const c=cover.create('landscape',new Date(2026,9,29));c.blocks=[{text:'첫 번째\n두 번째',x:20,y:30,width:60,size:40,weight:700,color:'#abcdef',align:'center'}];
  const l=cover.layout(c),drawn=[],ctx={save(){},restore(){},fillRect(){},translate(){},scale(){},beginPath(){},rect(){},clip(){},fillText(...a){drawn.push(a);}};
  cover.paint(ctx,1920,1080,c);assert.deepEqual(drawn.map(x=>x[0]),['첫 번째','두 번째']);assert.equal(drawn[0][1],500);assert.ok(Math.abs(drawn[1][2]-drawn[0][2]-50)<1e-8);
  assert.match(cover.svg(c),/text-anchor="middle"/);assert.equal(l.blocks[0].lines.length,2);
});
test('cover cuts into the video but the following slide still plays its internal animation; recording never changes slides',async()=>{
  const start=source.indexOf('async function exportMeetingVideo(opts){'),end=source.indexOf('function animPagesForExport()',start),code=source.slice(start,end);
  const snap={players:[],drawings:[],ball:null},slides=[{snap,cover:cover.create('landscape'),title:'표지'},{snap,title:'공격',frames:[{snap:{...snap,step:1},dur:1},{snap:{...snap,step:2},dur:2}]}],before=JSON.stringify(slides),old=[{snap:{old:true}}];
  let exported;
  const c={anim:{slides,frames:old},animActive:0,animHold:.6,window:{},toast(){},renderAnimFrames(){},renderOnion(){},updateMotionPaths(){},exportVideo:async opts=>{exported={opts,seq:JSON.parse(JSON.stringify(c.anim.frames))};}};
  vm.createContext(c);vm.runInContext(code,c);await c.exportMeetingVideo({hold:2});
  assert.equal(exported.seq[0].cover.v,1);assert.equal(exported.seq[0].cut,true);assert.equal(exported.seq[1].cut,true);assert.equal(exported.seq[2].cut,false,'only the first frame after a cover cuts');
  assert.equal(exported.opts.capN,2);assert.equal(c.anim.frames,old);assert.equal(c.window.__meetVideoBusy,0);assert.equal(JSON.stringify(slides),before);
  c.exportVideo=async()=>{throw Error('encoder failed');};await assert.rejects(c.exportMeetingVideo({hold:2}),/encoder failed/);assert.equal(c.anim.frames,old);assert.equal(c.window.__meetVideoBusy,0);assert.equal(JSON.stringify(slides),before);
});
