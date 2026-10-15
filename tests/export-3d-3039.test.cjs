// 3.039 — 3D 보기에서 만든 MP4 는 화면처럼 기울인 경기장으로(사용자 «3d모드에서 mp4 내보내기 했을 때 3d모드로 · MP4만»).
// board.html 의 «3D 영상» 순수 구간(카메라 · 줄 옮겨 그리기 · 골대 · 분위기)을 잘라 돌리고, 평면 · GIF 는 그대로인지 원문으로 본다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const a=src.indexOf('/* 순수 구간 시작 */'),b=src.indexOf('/* 순수 구간 끝 */');
assert.ok(a>0&&b>a,'3D 영상 순수 구간');
const ctx={Math};vm.createContext(ctx);
vm.runInContext(src.slice(a,b).replace(/^const /gm,'var ')+';this.T={_t3Project,_t3Unrow,_t3RowX,_t3Unx,_t3Camera,_t3Visible,_t3Warp,_t3DrawGoals,_t3Mood,_t3BoardCss,_T3_STAGE};',ctx);
const T=ctx.T;
const PITCH=[40,95,1010,745];   // 105×68 m 판의 운동장 상자(판 좌표)
const cam=(o,Wo=1280,Ho=720,box=PITCH)=>T._t3Camera(Wo,Ho,box,Object.assign({ax:24,sy:1.08,pads:[.15,.11,.05]},o||{}));
const corners=(c,box=PITCH)=>[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]].map(q=>T._t3Project(c,q[0],q[1],0));

test('줄 역변환은 투영을 되돌린다(바닥의 어느 점이든 같은 자리로)',()=>{
  const c=cam();
  for(const [x,y] of [[40,95],[1010,745],[525,420],[200,700],[900,120]]){
    const p=T._t3Project(c,x,y,0), r=T._t3Unrow(c,p[1]);
    assert.ok(r,'바닥이 보이는 줄');
    assert.ok(Math.abs(r.y-y)<1e-6,'y '+r.y+' ≠ '+y);
    assert.ok(Math.abs(r.f-p[2])<1e-9,'같은 원근 배율');
    assert.ok(Math.abs(T._t3Unx(c,r.f,p[0])-x)<1e-6,'x');
    assert.ok(Math.abs(T._t3RowX(c,r.f,x)-p[0])<1e-6,'줄의 가로 자리');
  }
});

test('카메라 맞춤 — 기울인 운동장이 여백 안에 들어오고 가운데 선다',()=>{
  for(const [Wo,Ho] of [[1280,720],[1920,1080]]){
    const c=cam({},Wo,Ho), ps=corners(c), xs=ps.map(p=>p[0]), ys=ps.map(p=>p[1]);
    const padT=Ho*.15, padB=Ho*.11, padX=Wo*.05;
    assert.ok(Math.min(...ys)>=padT-1&&Math.max(...ys)<=Ho-padB+1,'위·아래 여백 '+ys.map(Math.round));
    assert.ok(Math.min(...xs)>=padX-1&&Math.max(...xs)<=Wo-padX+1,'옆 여백 '+xs.map(Math.round));
    assert.ok(Math.abs((Math.min(...xs)+Math.max(...xs))/2-Wo/2)<1,'가로 가운데');
    const fill=Math.max((Math.max(...xs)-Math.min(...xs))/(Wo-2*padX),(Math.max(...ys)-Math.min(...ys))/(Ho-padT-padB));
    assert.ok(fill>.99,'한쪽은 여백까지 꽉 찬다 '+fill);
  }
  // 릴스: 제목 띠 · 자막 띠 사이에 맞춘다
  const r=cam({top:173,bottom:1280-154},720,1280), ys=corners(r).map(p=>p[1]);
  assert.ok(Math.min(...ys)>=173&&Math.max(...ys)<=1280-154,'릴스 띠 안 '+ys.map(Math.round));
});

test('원근 — 먼 쪽(위)이 좁고, 낮은 카메라(36°)일수록 더 좁다 · 높이가 있는 점은 위로 선다',()=>{
  const ratio=c=>{ const p=corners(c); return (p[1][0]-p[0][0])/(p[2][0]-p[3][0]); };
  const mid=ratio(cam()), low=ratio(cam({ax:36,sy:1.3})), high=ratio(cam({ax:12,sy:1}));
  assert.ok(mid<1&&low<mid&&high>mid,'먼 변/가까운 변 '+[low,mid,high].map(v=>v.toFixed(3)));
  const c=cam(), g=T._t3Project(c,1010,420,0), up=T._t3Project(c,1010,420,40);
  assert.ok(up[1]<g[1]-5,'골대 높이만큼 화면 위로');
});

test('그릴 바닥(_t3Visible)은 맞춘 운동장을 다 담는다 — 훈련 구역 확대는 작은 상자만',()=>{
  const c=cam(), v=T._t3Visible(c);
  assert.ok(v[0]<=PITCH[0]&&v[1]<=PITCH[1]&&v[2]>=PITCH[2]&&v[3]>=PITCH[3],'운동장 + 둘레 '+v.map(Math.round));
  const box=[400,300,640,440], z=T._t3Camera(1280,720,box,{ax:24,sy:1.08,pads:[.05,.05,.035]}), vz=T._t3Visible(z);
  assert.ok(vz[2]-vz[0]<(PITCH[2]-PITCH[0])*.6,'확대하면 비치는 바닥이 좁다 '+vz.map(Math.round));
});

test('줄 옮겨 그리기 — 줄 하나에 drawImage 한 번, 원본 범위 안, 목적지는 1px 정수 줄',()=>{
  const c=cam(), box=[-100,-60,1250,970], RW=2500, RH=1940, calls=[];
  T._t3Warp({drawImage:(...a)=>calls.push(a)},c,{},box,RW,RH);
  assert.ok(calls.length>600&&calls.length<=720,'줄 수 '+calls.length);
  let lastY=-1;
  for(const [,sx,sy,sw,sh,dx,dy,dw,dh] of calls){
    assert.equal(sx,0); assert.equal(sw,RW); assert.equal(dh,1); assert.ok(Number.isInteger(dy)&&dy>lastY); lastY=dy;
    assert.ok(sy>=0&&sy+sh<=RH+1e-9&&sh>0,'원본 줄 '+sy+'+'+sh); assert.ok(dw>0);
  }
  // 위 줄일수록 좁다(원근)
  assert.ok(calls[0][7]<calls[calls.length-1][7],'먼 줄이 좁다');
});

test('골대 · 깃발 · 분위기 그리기는 캔버스 호출만(예외 없이)',()=>{
  const log=[]; const fake=new Proxy({},{get:(t,k)=>{ if(k in t)return t[k]; return (...a)=>{ log.push(k); return {addColorStop(){}}; }; },set:(t,k,v)=>{ t[k]=v; return true; }});
  const c=cam();
  T._t3DrawGoals(fake,c,{goals:[{a:[1010,385],b:[1010,455],n:[1,0],h:40,d:30}],flags:[{c:[40,95],sx:1,h:20,fw:8,fh:6}]},2.8);
  assert.ok(log.filter(k=>k==='stroke').length>=6,'그물 · 기둥 · 깃발 선');
  for(const m of ['night','day','dusk'])T._t3Mood(fake,1280,720,m);
  assert.ok(log.includes('createRadialGradient')&&log.includes('createLinearGradient'));
  assert.deepEqual(Object.keys(T._T3_STAGE).sort().join(),'day,dusk,night');
});

test('판 그림 규칙 — 경기장 그림이 있으면 판 잔디를 숨기고, 평면 골대는 늘 숨긴다(서 있는 골대를 그린다)',()=>{
  const on=T._t3BoardCss(true,false), off=T._t3BoardCss(false,false), light=T._t3BoardCss(true,true);
  assert.match(on,/#world>rect:not\(\[id\]\),\.grass-stripes,#ps-pitchtile,#ps-pitchimg,\.pitch-goal,\.ps-pitch-goal\{visibility:hidden\}/);
  assert.doesNotMatch(off,/grass-stripes/); assert.match(off,/\.pitch-goal,\.ps-pitch-goal\{visibility:hidden\}/);
  assert.doesNotMatch(on,/rgba\(255,255,255,\.92\)/); assert.match(light,/#lineLayer \[stroke\]/);
});

test('원문 — 3D 보기의 MP4 만 3D 로, 평면 · GIF 는 그대로',()=>{
  const ev=src.slice(src.indexOf('async function exportVideo(opts)'),src.indexOf('/* ══ 2.975 · 영상은 16:9'));
  assert.match(ev,/const _3d=_t3On\(\);/); assert.match(ev,/window\.__animExport3d=_3d\?1:0;/); assert.match(ev,/finally\{ window\.__animExport3d=0;/);
  const gifAt=src.indexOf('async function exportGif'); assert.ok(gifAt>0);
  const gif=src.slice(gifAt,src.indexOf('\n}\n',gifAt)); assert.doesNotMatch(gif,/__animExport3d|_t3/,'GIF 는 평면 그대로');
  const run=src.slice(src.indexOf('async function _exportVideoRun(opts)'),src.indexOf('function exportVideoSheet(mode)'));
  assert.match(run,/function produce\(k\)\{ if\(_t3x\)return _t3Produce\(k\);/); assert.match(run,/if\(_t3x\)\{ _t3Paint\(img,meta\); return; \}/);
  assert.match(run,/const _t3x=window\.__animExport3d\?/);
  const xml=src.slice(src.indexOf('function _boardImageXMLRaw(vbFix)'),src.indexOf('function appendBoardExportWatermarks'));
  assert.match(xml,/if\(window\.PSBoardDepth&&!t3x\)PSBoardDepth\.flattenAll\(clone\);/,'평면 내보내기는 칩을 그대로 펴서');
  assert.match(xml,/if\(!t3st\)\{ const bg=el\("rect"/,'평면은 잔디 바탕 그대로');
  assert.match(src,/bc-tilt3d"\)&&\(!window\.__animExport\|\|window\.__animExport3d\)&&window\.PSBoardDepth\)PSBoardDepth\.apply/,'3D 영상에만 3D 칩');
  assert.match(src,/function _t3On\(\)\{ try\{ return document\.body\.classList\.contains\('bc-tilt3d'\)&&!!window\.PSBoardDepth;/);
  // 화면 맞춤과 같은 여백 · 같은 카메라 표
  assert.match(src,/var t3=window\.__tilt3d\|\|\{\},deco=tiltDecoNow\(\),pads=tiltPadsNow\(\);/);
  assert.match(src,/window\.__tiltCamNow=function\(\)\{ var t3=window\.__tilt3d\|\|\{\},c=TILT_CAM\[t3\.cam\]\|\|TILT_CAM\.mid;/);
  assert.match(src,/host\.__psVb=\[bx0,by0,bx1-bx0,by1-by0\];/);
});
