'use strict';
/* 2.988 — 영상 내보내기 «화면: 운동장 전체 | 훈련 구역».
   영상은 운동장 전체를 16:9 로 담아(2.975) 12m 짜리 론도는 토큰이 점이 됐다(트레이닝 레터에 넣을 영상을 뽑다가 드러났다).
   «훈련 구역»은 장면들의 내용 상자를 재서, 그 상자를 가장 알뜰하게 담는 화면비(16:9 · 4:3 · 1:1 · 3:4)로 자른다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};
const plain=v=>JSON.parse(JSON.stringify(v));   /* vm 쪽 값 → 이쪽 값 */
function ctx(){ const c={Object,Math,Infinity,isFinite}; vm.createContext(c);
  vm.runInContext(slice('/* ══ 2.988 · 훈련 구역에 맞춘 화면 — 순수 구간 시작 ══','/* ══ 2.988 · 순수 구간 끝 ══ */'),c); return c; }
const CENTER=[555,370];
const P=(id,x,y,o)=>Object.assign({id,team:'blue',x,y},o||{});

test('the content box covers players, equipment and drawings across every scene — and skips a ball that never left the centre spot',()=>{
  const c=ctx();
  const frames=[
    {snap:{tokenScale:.5,players:[P(1,200,200),P(2,320,300)],equipment:[{id:9,team:'cone',x:180,y:180}],drawings:[{type:'rectline',pts:[{x:190,y:190},{x:330,y:310}]}],ball:{x:555,y:370}}},
    {snap:{tokenScale:.5,players:[P(1,260,200),P(2,320,240)],equipment:[{id:9,team:'cone',x:180,y:180}],drawings:[],ball:{x:555,y:370}}}];
  const b=plain(c._fitContentBox(frames,CENTER));
  assert.ok(b[0]<=160&&b[0]>=150,'left edge = cone minus its radius: '+b[0]);
  assert.ok(b[2]<=350&&b[2]>=330,'right edge stays near the players, far from the centre ball: '+b[2]);
  assert.ok(b[3]<400,'bottom too: '+b[3]);
  /* 공이 한 장면이라도 움직였으면 공의 모든 자리를 센다 */
  frames[1].snap.ball={x:520,y:360};
  const b2=plain(c._fitContentBox(frames,CENTER));
  assert.ok(b2[2]>560,'a ball that moved is content (both its spots): '+b2[2]);
  /* 내용이 없으면 null — 엔진은 운동장 전체로 돌아간다 */
  assert.equal(c._fitContentBox([{snap:{players:[],equipment:[],drawings:[],ball:{x:555,y:370}}}],CENTER),null);
  assert.equal(c._fitContentBox([],CENTER),null);
});

test('token size and curved paths widen the box',()=>{
  const c=ctx();
  const small=plain(c._fitContentBox([{snap:{tokenScale:.3,players:[P(1,400,300)]}}],CENTER));
  const big=plain(c._fitContentBox([{snap:{tokenScale:1,players:[P(1,400,300)]}}],CENTER));
  assert.ok(big[2]-big[0]>small[2]-small[0],'bigger tokens need more room');
  const straight=plain(c._fitContentBox([{snap:{tokenScale:.4,players:[P(1,300,300)]}},{snap:{tokenScale:.4,players:[P(1,500,300)]}}],CENTER));
  const curved=plain(c._fitContentBox([{snap:{tokenScale:.4,players:[P(1,300,300)]},curves:{1:{mx:0,my:-120}}},{snap:{tokenScale:.4,players:[P(1,500,300)]}}],CENTER));
  assert.ok(curved[1]<straight[1]-80,'the bulge of a curved run is inside the picture: '+curved[1]+' vs '+straight[1]);
});

test('the aspect ratio is the one that wastes the least picture',()=>{
  const c=ctx();
  assert.deepEqual(plain(c._fitPickAr([[200,200]])),[1,1],'a square rondo');
  assert.deepEqual(plain(c._fitPickAr([[380,220]])),[16,9],'a wide zone game');
  assert.deepEqual(plain(c._fitPickAr([[620,500]])),[4,3],'a half-pitch game');
  assert.deepEqual(plain(c._fitPickAr([[220,420]])),[3,4],'a tall area (vertical board)');
  /* 여러 페이지 — 화면비 하나를 같이 쓴다 */
  const many=plain(c._fitPickAr([[380,220],[400,230],[200,200]]));
  assert.deepEqual(many,[16,9],'two wide pages outweigh one square page');
});

test('the view is centred on the box, keeps the ratio exactly and never zooms past 20×15m',()=>{
  const c=ctx();
  const v=plain(c._fitExpand([100,100,220,220],1,12,200,150));
  assert.deepEqual(v,[60,60,200,200],'tiny content is held at the minimum size');
  const w=plain(c._fitExpand([100,100,480,320],16/9,20,200,150));
  assert.ok(Math.abs(w[2]/w[3]-16/9)<1e-9);
  assert.ok(Math.abs((w[0]+w[2]/2)-290)<1e-9&&Math.abs((w[1]+w[3]/2)-210)<1e-9,'centre kept');
  assert.ok(w[2]>=380+40-1e-9&&w[3]>=220+40-1e-9,'the whole box plus padding fits');
  const raw=plain(c._fitExpand([100,100,480,320],0,20,200,150));
  assert.deepEqual(raw,[80,80,420,260],'ratio 0 = padded box only (reels expand it to 9:16 themselves)');
  assert.equal(c._fitPad([0,0,120,120]),12);assert.equal(c._fitPad([0,0,600,400]),30);
});

test('video sizes are even numbers (H.264) for every ratio',()=>{
  const c=ctx();
  assert.deepEqual(plain(c._fitCanvas([16,9],720)),[1280,720]);
  assert.deepEqual(plain(c._fitCanvas([4,3],1080)),[1440,1080]);
  assert.deepEqual(plain(c._fitCanvas([1,1],720)),[720,720]);
  assert.deepEqual(plain(c._fitCanvas([3,4],720)),[540,720]);
  for(const ar of [[16,9],[4,3],[1,1],[3,4]])for(const h of [719,720,1080]){ const s=plain(c._fitCanvas(ar,h)); assert.equal(s[0]%2,0);assert.equal(s[1]%2,0); }
});

test('the engine frames on the training area only when asked, and falls back to the whole pitch',()=>{
  const run=slice('async function _exportVideoRun(opts){','/* ===== 영상 내보내기 옵션 시트');
  assert.match(run,/if\(opts\.fit&&!opts\.capN\)\{ _fit=_exportFitPlan\(FR,!!opts\.pageMode\);/,'meeting videos (capN) keep their own framing');
  assert.match(run,/if\(_fit\)\{ uvb=_fit\.vb\.slice\(\); const cs=_fitCanvas\(_fit\.ar,opts\.height\); canvas\.width=cs\[0\]; canvas\.height=cs\[1\]; \}/);
  assert.match(run,/else \{ uvb=_export169\(uvb\);/,'no plan (empty board) → the 16:9 pitch view as before');
  assert.match(run,/_segVB\[g\]\.v169=_fit\.seg\[g\]\.vb\.slice\(\)/,'every page gets its own area');
  assert.match(run,/if\(_fit\)uvb=_fit\.raw\.slice\(\);[^\n]*\n\s*if\(uvb\)\{ uvb=_toAr\(uvb\); \}/,'reels centre the area too');
  const guard=slice('async function _animExportGuard(run){','async function exportVideo(opts){');
  assert.match(guard,/finally\{ window\.__animExport=0; try\{trailReset\(\);\}catch\(_\)\{\} window\.__psExportFit=0;/,'the watermark flag never outlives an export');
  const plan=slice('function _exportFitPlan(FR,pageMode){','window.__exportFitPlan=_exportFitPlan;');
  assert.match(plan,/if\(!b\)return null;/,'a page with nothing on it cancels the fit');
  assert.match(plan,/_fitRootBox\(b,fr\[0\]&&fr\[0\]\.snap\)/,'vertical boards are mapped like the pitch box');
});

test('the watermark shrinks with a tight picture and is untouched otherwise',()=>{
  const wm=slice('function appendBoardExportWatermarks(clone,vb){','clone.appendChild(group);');
  assert.match(wm,/const wk=\(typeof window!=="undefined"&&window\.__psExportFit\)\?Math\.min\(1,vb\[2\]\/1316\):1;/);
  assert.match(wm,/const fs=9\*wk,gap=5\*wk,/);
  assert.match(wm,/'letter-spacing':wk===1\?'\.36':/,'whole-pitch exports keep the exact old attributes');
});

test('the sheet offers the choice, remembers it on this device and hands it to both exports',()=>{
  const sheet=slice('function exportVideoSheet(mode){','async function exportMeetingVideo(opts){');
  assert.match(sheet,/\(meeting\?'':seg\("화면",\[\["운동장 전체",0\],\["훈련 구역",1\]\],"fit"\)\)/,'not for meeting slides');
  assert.match(sheet,/opt\.fit=localStorage\.getItem\("ps_anim_export_fit_v1"\)==="1"\?1:0;/);
  assert.match(sheet,/localStorage\.setItem\("ps_anim_export_fit_v1",opt\.fit\?"1":"0"\)/);
  assert.match(sheet,/exportPagesVideo\(\{height:opt\.height,fps:opt\.fps,reel:!!opt\.reel,fit:!!opt\.fit,/);
  assert.match(sheet,/exportVideo\(Object\.assign\(\{height:opt\.height,fps:opt\.fps,reel:!!opt\.reel,fit:!!opt\.fit,/);
  assert.match(sheet,/_sk==="scope"\|\|_sk==="fit"\|\|_sk==="reel"/,'the description follows the choice');
});
