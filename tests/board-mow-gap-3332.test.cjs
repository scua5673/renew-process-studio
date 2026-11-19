'use strict';
/* 3.332 — 잔디결 간격(사용자 11/19 «3d 평면모두 잔디결의 간격을 정하고 싶어 유소년 현장은 인조잔디결이 4m야» →
   목업 processstudio-문서/UI-작전판-잔디결-간격-목업-2026-11-19.html A안 · 하프라인 기준).
   «띠»의 grassM 은 결 간격(m) — 띠는 정확히 그 간격으로 하프라인이 결 경계. 예전(3.263 ~ 3.330)엔 길이를 홀수 줄로 나눈 «약 4m».
   보드 설정 «잔디 무늬»는 일곱 칸 + 띠일 때 간격 여섯 칸(3 · 4 · 5 · 6 · 8 · 10m) + 아래 한 줄. 실제 화면은 tests/browser/board-mow-gap-3332.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../studio/board-mow.js'),G=require('../studio/board-stadium-ground.js'),Look=require('../studio/board-pitch-look.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const attrs=(xml,tag,id)=>{const m=new RegExp('<'+tag+' id="'+id+'"([^>]*)>').exec(xml);if(!m)return null;const o={};m[1].replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>{o[k]=v;});return o;};

test('간격 — grassM 이 띠의 결 간격(m). 옛 기본 5 · 넓게 10 도 그 간격, 무늬 번호(5.1~5.5)는 간격이 아니다',()=>{
  assert.deepEqual(M.GAPS,[3,4,5,6,8,10]);assert.equal(M.GAP0,4,'처음 값은 유소년 인조잔디결 4m');
  for(const w of M.GAPS){assert.equal(M.kindOf(w),'band',w+'m');assert.equal(M.gapOf(w),w);}
  assert.equal(M.gapOf(7.5),7.5,'옛 기기 값도 그 간격');assert.equal(M.gapOf(.5),2,'너무 좁으면 2m');assert.equal(M.gapOf(40),20,'너무 넓으면 20m');
  for(const c of [0,5.1,5.2,5.3,5.4,5.5])assert.equal(M.gapOf(c),4,c+' — 띠가 아니면 처음 값');
  for(const k of M.KINDS)if(k!=='band')assert.ok(!M.GAPS.includes(M.CODE[k]),k+' 번호가 간격 칸과 겹치지 않는다');
  assert.equal(M.gapNow({__grassM:6}),6);assert.equal(M.gapNow({__grassM:5.3}),4);assert.equal(M.gapNow(null),4);
  assert.equal(M.CODE.band,4,'«띠»를 처음 누르면 4m');assert.ok(!M.KINDS.includes('wide'),'«넓은 띠»는 «띠 10m»');
});

test('하프라인 기준 — 결 경계가 하프라인에 있고 간격은 정확히 그 m(규격마다 달라지지 않는다)',()=>{
  for(const [len,L] of [[105,30],[65,230],[40,355]]){
    const pw=len*10,CX=L+pw/2;
    for(const w of M.GAPS){
      const a=attrs(M.paint('p','band',{x:L,y:30,len:pw,wid:pw*.65,lenM:len,gap:w}),'pattern','p');
      assert.equal(+a.x,CX,len+'m '+w+'m — 하프라인');assert.equal(+a.width,2*w*10,'한 쌍 = 2 × 간격');
    }
  }
  /* 4m · 하프라인 기준이면 11인제 페널티 에어리어(16.5m) · 8인제 골 에어리어(4.5) · 페널티 에어리어(12.5)가 결 경계 */
  const onBoundary=(len,d,w)=>{const x=d-len/2;return Math.abs(x/w-Math.round(x/w))<1e-9;};
  assert.ok(onBoundary(105,16.5,4));assert.ok(onBoundary(65,4.5,4));assert.ok(onBoundary(65,12.5,4));assert.ok(onBoundary(40,0,4),'풋살은 골라인에 딱');
  /* 3D 도 같은 자리 · 같은 간격(두 색 줄 포함) */
  const p=G.mowPlan({multi:false,L:230,T:130,m:10,len:65,pw:650,ph:480,kind:'band',gap:6});
  assert.equal(attrs(p.defs,'pattern','psStMow').x,'555');assert.equal(attrs(p.defs,'pattern','psStMow').width,'120');
  assert.equal(p.two,120);assert.equal(attrs(p.grass('#111111','#222222'),'pattern','psStGrass').x,'555');
  assert.ok(Math.abs(p.per-2*650/17)<1e-9,'잔디 사진 칸은 간격과 따로(잎결 크기 그대로)');
});

test('아래 한 줄 — 하프라인에서 몇 결 · 골라인 앞에 남는 반쪽 결(m)',()=>{
  assert.equal(M.hint(105,4),'결 간격 · 하프라인에서 4m씩 · 한쪽 13결 + 골라인 앞 0.5m');
  assert.equal(M.hint(65,4),'결 간격 · 하프라인에서 4m씩 · 한쪽 8결 + 골라인 앞 0.5m');
  assert.equal(M.hint(40,4),'결 간격 · 하프라인에서 4m씩 · 한쪽 5결 · 골라인에 딱 맞음');
  assert.equal(M.hint(105,10),'결 간격 · 하프라인에서 10m씩 · 한쪽 5결 + 골라인 앞 2.5m');
  assert.equal(M.hint(105,7.5),'결 간격 · 하프라인에서 7.5m씩 · 한쪽 7결 · 골라인에 딱 맞음');
  assert.equal(M.hint(30,4,true),'결 간격 · 판 가운데에서 4m씩','그리드 판');
  assert.deepEqual(M.split(105,3),{n:17,rem:1.5});
});

test('그리드 판 — 결은 판 가로(m)로 센다(예전엔 늘 105m 로 세어 20m 판에 27줄)',()=>{
  const w=sp=>({pitchSpec:()=>sp});
  assert.equal(M.lenNow(w({blank:true,m:30,len:105})),30);assert.equal(M.lenNow(w({blank:true,m:30,len:105}),105),30,'부른 쪽 길이보다 판 가로');
  assert.equal(M.lenNow(w({len:65})),65);assert.equal(M.lenNow(w({len:105}),65),65,'부른 쪽이 아는 규격 길이');
  assert.equal(M.lenNow(null),105);assert.equal(M.lenNow({pitchSpec:()=>{throw new Error('x');}},40),40);
});

/* 가짜 DOM — install 이 쓴 innerHTML 을 단추로 읽어 syncUI 가 쓰는 만큼만 */
function fakeSeg(){
  const mk=a=>({a:Object.assign({},a),cls:new Set(),getAttribute(k){return k in this.a?this.a[k]:null;},setAttribute(k,v){this.a[k]=String(v);},
    classList:{_:null,contains(c){return this._.cls.has(c);},toggle(c,on){if(on)this._.cls.add(c);else this._.cls.delete(c);},add(c){this._.cls.add(c);}},textContent:''});
  const el=a=>{const e=mk(a);e.classList._=e;return e;};
  const seg=el({});seg.btns=[];seg.hint=el({});
  Object.defineProperty(seg,'innerHTML',{set(v){this._html=v;this.btns=[...v.matchAll(/<button ([^>]*)>/g)].map(m=>{const o={};m[1].replace(/([\w-]+)="([^"]*)"/g,(_,k,x)=>{o[k]=x;});return el(o);});},get(){return this._html;}});
  seg.querySelector=s=>s==='.ps-mow-hint'?seg.hint:(s==='button[data-mow="band"]'?seg.btns.find(b=>b.a['data-mow']==='band'):null);
  seg.querySelectorAll=s=>seg.btns.filter(b=>s==='button[data-mow]'?'data-mow' in b.a:'data-gap' in b.a);
  seg.parentNode={querySelector:()=>null};
  return seg;
}
test('보드 설정 — 띠일 때만 간격 칸(.seg · 여섯) + 한 줄, 켜짐 · «띠» 칸의 값은 지금 간격(아니면 마지막 간격)',()=>{
  const seg=fakeSeg(),styles=[];let spec={len:105};
  const doc={readyState:'complete',getElementById:id=>id==='grassSeg'?seg:(id==='ps-mow-css'?(styles[0]||null):null),createElement:()=>{const s={};styles.push(s);return s;},createElementNS:()=>({setAttribute(){},innerHTML:''}),head:{appendChild(){}},body:{classList:{contains:()=>false}}};
  const win={document:doc,__grassM:0,pitchSpec:()=>spec};
  assert.equal(M.install(win),true);assert.equal(M.uiErr,undefined,'설치 때 동기화가 던지지 않는다');
  assert.match(seg.innerHTML,/<div class="ps-mow-gap"><div class="seg ps-mow-gs" role="group" aria-label="결 간격">/,'간격 칸은 .seg(스킨의 칸 모양) · 무늬 칸 묶음 안');
  assert.equal(seg.querySelectorAll('button[data-gap]').length,6);
  const css=styles[0].textContent,SS='#grassSeg'.repeat(8)+'.ps-mow-seg';
  assert.ok(css.includes(SS+'>.ps-mow-gap{display:none;grid-column:1/-1'),'띠가 아니면 숨김 · 한 줄 전체');
  assert.ok(css.includes(SS+'[data-mow="band"]>.ps-mow-gap{display:block}'));
  assert.ok(css.includes('grid-template-columns:repeat(6,minmax(0,1fr))'),'여섯 칸 한 줄(스킨의 «여섯 이상 = 세 칸씩»을 이긴다)');
  assert.ok(css.includes(SS+' .ps-mow-gs>button{height:auto!important;min-height:44px!important'),'손가락 칸 44px');
  const on=()=>seg.btns.filter(b=>b.cls.has('on')).map(b=>b.a['data-gap']?b.a['data-gap']+'m':b.a['data-mow']);
  const band=()=>seg.btns.find(b=>b.a['data-mow']==='band').a['data-g'];
  assert.equal(seg.a['data-mow'],'none');assert.deepEqual(on(),['none']);assert.equal(band(),'4','없음에서 «띠»를 누르면 4m');
  win.__grassM=6;M.syncUI(win);
  assert.equal(seg.a['data-mow'],'band');assert.deepEqual(on(),['band','6m']);assert.equal(band(),'6','다시 눌러도 간격 그대로(board.html __syncStageUI 의 data-g === __grassM)');
  assert.equal(seg.hint.textContent,'결 간격 · 하프라인에서 6m씩 · 한쪽 8결 + 골라인 앞 4.5m');
  win.__grassM=5.1;M.syncUI(win);assert.deepEqual(on(),['check']);assert.equal(band(),'6','바둑판에 갔다 «띠»로 돌아오면 마지막 간격');
  win.__grassM=7.5;M.syncUI(win);assert.deepEqual(on(),['band'],'칸에 없는 옛 간격 — 띠만 켜짐');assert.match(seg.hint.textContent,/7\.5m씩/);
  win.__grassM=4;spec={blank:true,m:20,len:105};M.syncUI(win);assert.equal(seg.hint.textContent,'결 간격 · 판 가운데에서 4m씩','그리드 판');
  spec={len:65};M.syncUI(win);assert.equal(seg.hint.textContent,'결 간격 · 하프라인에서 4m씩 · 한쪽 8결 + 골라인 앞 0.5m','규격을 바꾸면 한 줄도');
  /* 평면 줄무늬를 그릴 때마다(buildPitch · redrawGrass) 칸도 맞춘다 */
  win.__grassM=10;M.flat(Object.assign(win,{PR:()=>({L:230,T:130,PW:650,PH:480,CX:555,CY:370}),__getPitchN:()=>1,getCss:()=>''}),1600);assert.deepEqual(on(),['band','10m']);
});

test('규격을 바꾸면 한 줄을 다시 — __syncPitchSpecUI 를 감싼다 · redrawGrass 도',()=>{
  const seg=fakeSeg();let n=0,r=0;
  const win={document:{readyState:'complete',getElementById:id=>id==='grassSeg'?seg:null,createElement:()=>({}),head:{appendChild(){}},body:{classList:{contains:()=>false}}},
    __grassM:4,pitchSpec:()=>({len:40}),__syncPitchSpecUI:()=>{n++;},redrawGrass:()=>{r++;}};
  M.install(win);win.__grassM=8;win.__syncPitchSpecUI();assert.equal(n,1);assert.equal(seg.hint.textContent,'결 간격 · 하프라인에서 8m씩 · 한쪽 2결 + 골라인 앞 4m');
  win.__grassM=5;win.redrawGrass();assert.equal(r,1);assert.match(seg.hint.textContent,/5m씩 · 한쪽 4결 · 골라인에 딱 맞음/);
  assert.equal(win.__syncPitchSpecUI.__psMow,1);assert.equal(win.redrawGrass.__psMow,1);
});

test('3D 다시 그리기 — 띠는 간격까지 pk 서명에(간격만 바꿔도 다시), 다른 무늬는 간격을 안 본다',()=>{
  const MD={ga:'#2c6a2a',gb:'#367a33'},env=(m,g)=>({key:'navy',css:k=>({'--grass-a':'#20243f','--grass-b':'#15172b'})[k]||'',mow:m,gap:g});
  const a=Look.pitchLook(MD,'',env('band',4)),b=Look.pitchLook(MD,'',env('band',6));
  assert.notEqual(a.sig,b.sig);assert.match(a.sig,/\|band:4$/);assert.equal(b.gap,'6');
  assert.equal(Look.pitchLook(MD,'',env('ring',4)).sig,Look.pitchLook(MD,'',env('ring',6)).sig);assert.match(Look.pitchLook(MD,'',env('ring',6)).sig,/\|ring$/);
  assert.equal(Look.pitchLook(MD,'',{key:'navy'}).sig.split('|').length,4,'무늬를 모르면(노드) 예전 서명 그대로');
});

test('평면 실사 · 배선 · 영어 — 간격이 다시 그리기 열쇠에 · 판 번호 · 업데이트 소식',()=>{
  const ft=read('studio/board-flat-turf.js');
  assert.match(ft,/var gap=Mw&&Mw\.gapOf\?Mw\.gapOf\(o\.grassM\):4,key=JSON\.stringify\(\[k,gap,o\.lenM,/,'간격 · 길이가 바뀌면 다시');
  assert.match(ft,/lenM:\(sp&&sp\.blank&&\+sp\.m>0\)\?\+sp\.m:/,'그리드 판은 판 가로');
  const sg=read('studio/board-stadium-ground.js');assert.match(sg,/gap=o\.gap>0\?\+o\.gap:\(Mw\?Mw\.gapNow\(W\):4\),lenM=\(Mw&&Mw\.lenNow\)\?Mw\.lenNow\(W,o\.len\):o\.len/);
  assert.match(read('sw.js'),/const CACHE = 'process-3\.\d{3}';/);
  assert.match(read('studio/release-notes.js'),/id:'2026-11-19-v3-332-grass-gap'/);
  /* 영어 — 사전 규칙이 실제 문장 전체에 맞는다 */
  const w={};vm.runInNewContext(read('studio/i18n/en-board.js'),{window:w});
  const en=s=>{for(const [re,to] of w.PS_I18N_RULES_EXTRA){const m=re.exec(s);if(m)return s.replace(re,to.en);}return (w.PS_I18N_EXTRA[s]||{}).en;};
  assert.equal(en(M.hint(105,4)),'Stripe width · every 4 m from the halfway line · 13 stripes each half + 0.5 m before the goal line');
  assert.equal(en(M.hint(40,4)),'Stripe width · every 4 m from the halfway line · 5 stripes each half · ends on the goal line');
  assert.equal(en(M.hint(20,4,true)),'Stripe width · every 4 m from the centre');
  assert.equal(en('6m 간격'),'6 m apart');assert.equal(en('결 간격'),'Stripe width');assert.equal(en(M.TIP.band),'Stripes parallel to the goal line · set the width below');
});
