'use strict';
/* 3.326 — 잔디 무늬(사용자 11/19 «3d로 했을 때 잔디 줄무늬 다양하게 할수 있게 해주고 없게도» → 목업 A안 · 평면 · 3D 같이).
   예전엔 3D 경기장이 «잔디 줄무늬»(__grassM)를 보지 않고 약 4m 띠를 늘 깔았다 — «없음»을 골라도 3D 에 줄이 남았다.
   규칙은 studio/board-mow.js 한 곳: 무늬 번호(grassM) ↔ 무늬 · 무늬 정의(paint) · 평면 색 피치 줄무늬(flat) · 보드 설정 여덟 칸(install).
   3D(board-stadium-ground.js mowPlan) · 평면 실사(board-flat-turf.js)가 같은 paint 를 쓴다. 실제 화면은 tests/browser/board-mow-3326.mjs.
   3.332 — 기대를 일부러 고친 곳: «띠»의 grassM 은 결 간격(m) · 띠는 하프라인 기준 정확한 간격 · «넓은 띠»는 «띠 10m»(칸 일곱).
   결 간격 칸 · 아래 한 줄 · 그리드 판은 tests/board-mow-gap-3332.test.cjs */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../studio/board-mow.js'),G=require('../studio/board-stadium-ground.js'),F=require('../studio/board-flat-turf.js'),Look=require('../studio/board-pitch-look.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const attrs=(xml,tag,id)=>{const m=new RegExp('<'+tag+' id="'+id+'"([^>]*)>').exec(xml);if(!m)return null;const o={};m[1].replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>{o[k]=v;});return o;};

test('저장 — 무늬마다 번호(grassM). 없음 0 · 띠는 간격(m) 그대로(옛 기본 5 · 넓게 10 도 띠), 새 무늬는 5.1~5.5(옛 판 앱은 약 5m 띠로 읽는다)',()=>{
  assert.deepEqual(M.KINDS,['none','band','check','diag','diamond','ring','lane']);
  for(const k of M.KINDS)assert.equal(M.kindOf(M.codeOf(k)),k,k);
  assert.equal(M.kindOf(0),'none');assert.equal(M.kindOf(undefined),'none');assert.equal(M.kindOf(-1),'none');assert.equal(M.kindOf('x'),'none');
  for(const m of [3,4,5,7,8,10,7.5])assert.equal(M.kindOf(m),'band',m+' — 띠');
  for(const k of ['check','diag','diamond','ring','lane'])assert.ok(M.codeOf(k)>5&&M.codeOf(k)<6,k+' 은 옛 판에서 약 5m 띠');
  assert.equal(M.kindNow(null),'band','판이 없으면(노드 시험) 띠');
  assert.equal(M.kindNow({__grassM:5.4}),'ring');assert.equal(M.kindNow({}),'none');
  assert.equal(M.codeOf('???'),4,'모르는 무늬는 띠 4m');
});

test('띠 수 — 골라인→골라인 홀수 개(가운데 띠가 하프라인에 걸친다) · 띠는 3.263 의 약 4m 와 같은 셈',()=>{
  for(const len of [105,65,40,30])assert.equal(M.count('lane',len),G.bands(len),len+'m — 5레인의 옅은 띠');
  for(const [k,len,n] of [['check',105,15],['check',65,9],['lane',105,27]])assert.equal(M.count(k,len),n,k+' '+len);
  for(const k of ['check','lane'])for(const len of [105,65,40])assert.equal(M.count(k,len)%2,1,k+' 홀수');
});

test('무늬 정의 — 띠는 하프라인에서 결 간격(3.332), 없음은 빈 무늬(이름을 쓰는 곳은 그대로), 나머지는 제 모양',()=>{
  const g={x:30,y:30,len:1050,wid:680,lenM:105};
  assert.equal(M.paint('psStMow','band',g),'<pattern id="psStMow" patternUnits="userSpaceOnUse" x="555" y="30" width="80" height="80"><rect width="40" height="80" fill="#000" fill-opacity=".07"/><rect x="40" width="40" height="80" fill="#fff" fill-opacity=".06"/></pattern>');
  assert.equal(M.paint('psStMow','none',g),'<pattern id="psStMow" patternUnits="userSpaceOnUse" width="1" height="1"/>');
  assert.equal(attrs(M.paint('p','band',Object.assign({gap:10},g)),'pattern','p').width,'200','띠 10m(예전 «넓은 띠») 한 쌍 = 2 × 100');
  const ck=M.paint('p','check',g);assert.equal((ck.match(/<rect /g)||[]).length,4,'바둑판 — 두 번 깎은 네 겹');assert.ok(!/patternTransform/.test(ck));
  assert.match(M.paint('p','diag',g),/patternTransform="rotate\(45 555 370\)"/,'사선은 운동장 가운데에서 45°');
  assert.match(M.paint('p','diamond',g),/patternTransform="rotate\(45 555 370\)"/);assert.equal((M.paint('p','diamond',g).match(/<rect /g)||[]).length,4);
  const ring=M.paint('p','ring',g);assert.match(ring,/^<radialGradient id="p" gradientUnits="userSpaceOnUse" cx="555" cy="370" r="92" spreadMethod="repeat">/,'원은 센터에서 되풀이되는 고리(4.6m)');
  const lane=M.paint('p','lane',g),ys=[...lane.matchAll(/<rect(?: y="([\d.]+)")? width="([\d.]+)" height="([\d.]+)"/g)].filter(m=>+m[3]<679);   /* 옅은 x 띠(높이 = 폭 전체)는 빼고 */
  assert.equal(ys.length,5,'다섯 길');assert.ok(Math.abs(ys.reduce((a,m)=>a+ +m[3],0)-680)<.6,'길의 폭을 더하면 운동장 폭');
  assert.ok(Math.abs(+ys[0][3]-138.4)<.1&&Math.abs(+ys[2][3]-183.2)<.1,'측면 13.84m · 중앙 18.32m(채널 경계)');
  assert.equal(attrs(lane,'pattern','p').height,'680','타일 높이 = 운동장 폭(터치라인 밖은 측면 길이 이어진다)');
  /* 카드(rot 90 — 골대가 위 · 아래): 띠는 y 띠(카드 가운데 = 하프라인에서), 다른 무늬는 카드 오른쪽 위를 축으로 90° */
  const c={x:0,y:0,len:450,wid:300,lenM:105,rot:90};
  const cb=attrs(M.paint('c','band',c),'pattern','c');assert.equal(+cb.x,0);assert.equal(+cb.y,225);assert.ok(!cb.patternTransform);
  assert.equal(attrs(M.paint('c','check',c),'pattern','c').patternTransform,'rotate(90 300 0)');
  assert.match(M.paint('c','ring',c),/cx="150" cy="225"/,'원은 카드 가운데');
  for(const k of M.KINDS)assert.doesNotMatch(M.paint('x',k,g),/NaN|undefined/,k);
});

test('3D — mowPlan 은 보드 무늬를 따른다: 없음이면 덧칠 없음 · 두 색 줄은 띠만 · 카드도 같은 무늬',()=>{
  const one=k=>G.mowPlan({multi:false,L:30,T:30,m:10,len:105,pw:1050,ph:680,kind:k});
  assert.equal(one('band').defs,G.mowPlan({multi:false,L:30,T:30,m:10,len:105,pw:1050}).defs,'무늬를 안 주면(노드) 예전 띠');
  assert.equal(attrs(one('none').defs,'pattern','psStMow').width,'1','없음 — 빈 무늬');
  for(const k of M.KINDS){const p=one(k);assert.ok(Math.abs(p.per-2*1050/27)<1e-9,k+' — 잔디 사진 칸은 그대로 4m 한 쌍');
    const gr=p.grass('#111111','#222222');assert.equal(gr.includes('#222222'),k==='band',k+' 두 색 줄');assert.match(gr,/^<pattern id="psStGrass"/);}
  assert.equal(one('band').two,80,'띠의 두 색 줄 = 4m 한 쌍');assert.equal(G.mowPlan({multi:false,L:30,T:30,m:10,len:105,pw:1050,ph:680,kind:'band',gap:10}).two,200,'10m');
  assert.equal(attrs(one('band').grass('#111111','#222222'),'pattern','psStGrass').x,'555','두 색 줄도 하프라인에서');
  assert.match(one('ring').defs,/<radialGradient id="psStMow"/);
  assert.match(one('check').defs,/fill-opacity="\.062"/,'두 색 줄이 없는 무늬는 덧칠이 조금 짙다(.1 × .62)');
  const cards=[[0,0,300,450],[320,0,150,220]],many=k=>G.mowPlan({multi:true,cards,len:105,L:0,T:0,m:4,kind:k});
  assert.equal(many('none').cards,'','없음 — 카드 띠 없음');
  assert.equal((many('check').cards.match(/class="ps-mow-card"/g)||[]).length,2);assert.equal(attrs(many('check').defs,'pattern','psStMowC0').patternTransform,'rotate(90 300 0)');
  assert.equal(many('band').defs,G.mowPlan({multi:true,cards,len:105,L:0,T:0,m:4}).defs,'무늬를 안 주면(노드) 띠 4m');
});

test('평면 — 색 피치 줄무늬(.grass-stripes)는 바탕 ga 한 장 + 무늬(어두운 쪽 gb) · 없음이면 그리지 않는다 · 운동장 여럿은 열 수만큼 잘게',()=>{
  const made=[];
  const doc={createElementNS:(ns,tag)=>{const e={tag,ns,a:{},setAttribute(k,v){this.a[k]=String(v);},innerHTML:''};made.push(e);return e;}};
  const win=(m,n)=>({document:doc,__grassM:m,getCss:k=>({'--grass-a':'#20243f','--grass-b':'#15172b'})[k],PR:()=>({L:30,T:30,PW:1050,PH:680,CX:555,CY:370}),pitchSpec:()=>({len:105}),__getPitchN:()=>n||1});
  assert.equal(M.flat(win(0),1600),null,'없음');
  const g=M.flat(win(4),1600);assert.equal(g.a['class'],'grass-stripes');assert.equal(g.a['clip-path'],'url(#pitchClip)');assert.equal(g.a['data-mow'],'band');
  assert.match(g.innerHTML,/^<defs><pattern id="psGrassP"[^>]*x="555"[^>]*width="80"/,'하프라인에서 4m 한 쌍');
  assert.match(M.flat(win(5),1600).innerHTML,/^<defs><pattern id="psGrassP"[^>]*width="100"/,'옛 기본 5 → 5m(3.326 전 평면과 같은 폭)');assert.match(g.innerHTML,/fill="#15172b" fill-opacity="1"/,'어두운 띠는 gb 그대로(예전 두 색 줄과 같은 색)');
  assert.match(g.innerHTML,/<rect x="-1600" y="-1600" width="4310" height="3940" fill="#20243f"\/><rect x="-1600" y="-1600" width="4310" height="3940" fill="url\(#psGrassP\)"\/>$/);
  assert.match(M.flat(win(5.1),1600).innerHTML,/fill="#15172b" fill-opacity="\.5"/,'바둑판은 반씩 겹쳐 네 톤');
  assert.match(M.flat(win(4,3),1600).innerHTML,/width="26\.7"/,'운동장 셋 — 열 수만큼 잘게(예전 _pcols)');
});

test('평면 실사 잔디 — 무늬가 사진 위에(없음이면 사진 그대로), 사진 없는 잔디는 .grass-stripes 가 맡는다',()=>{
  assert.equal(F.kindOf({grassM:5.2}),'diag');assert.equal(F.kindOf({}),'none');
  assert.equal(F.wantMow({pitch:'grass',img:'@real',grassM:5.3}),true);assert.equal(F.wantMow({pitch:'grass',img:'@real',grassM:0}),false);
  assert.equal(F.wantMow({pitch:'grass',img:'',grassM:5.3}),false,'두 겹이 되지 않게');
  const src=read('studio/board-flat-turf.js');
  assert.match(src,/var s1=k==='band'\?1:1\.4,g0=\{dk:\['#000',DK\*s1\],lt:\['#fff',LT\*s1\],x2:\.62,gap:gap,f:f\};/);
  /* 3.340 — 일부러 고친 기대: 가로 카드(운동장 여럿 새 배치 · 긴 변이 가로)는 돌리지 않는다, 세로 카드는 예전처럼 90° */
  assert.match(src,/html\+=paint\('psFlatMowC'\+i,\{x:c\.r\[0\],y:c\.r\[1\],len:c\.hz\?c\.r\[2\]:c\.r\[3\],wid:c\.hz\?c\.r\[3\]:c\.r\[2\],lenM:o\.len,rot:c\.hz\?0:90\}\);/,'카드는 제 골라인에서(세로 카드 90°)');
});

test('3D 다시 그리기 — 무늬가 pk 서명에 든다(__sig 모양은 그대로)',()=>{
  const MD={ga:'#2c6a2a',gb:'#367a33'},env=m=>({key:'navy',css:k=>({'--grass-a':'#20243f','--grass-b':'#15172b'})[k]||'',mow:m});
  const a=Look.pitchLook(MD,'',env('band')),b=Look.pitchLook(MD,'',env('ring'));
  assert.notEqual(a.sig,b.sig);assert.equal(b.mow,'ring');assert.match(b.sig,/\|ring$/);
  assert.equal(Look.pitchLook(MD,'',{key:'navy'}).sig.split('|').length,4,'무늬를 모르면(노드) 예전 서명 그대로');
});

test('보드 설정 — «잔디 줄무늬» 세 칸을 «잔디 무늬» 일곱 칸 + 결 간격 여섯 칸으로(누르면 예전 길 __setGrassM(data-g))',()=>{
  const lbl={textContent:'잔디 줄무늬'},seg={innerHTML:'',cls:new Set(),attr:{},classList:{add(c){seg.cls.add(c);}},setAttribute(k,v){seg.attr[k]=v;},parentNode:{querySelector:s=>s==='.menulbl'?lbl:null}};
  const styles=[],doc={readyState:'complete',getElementById:id=>id==='grassSeg'?seg:(id==='ps-mow-css'?(styles.length?styles[0]:null):null),createElement:()=>{const s={};styles.push(s);return s;},head:{appendChild(){}},body:{classList:{contains:()=>false}}};
  const win={document:doc};
  assert.equal(M.install(win),true);assert.equal(M.install(win),false,'한 번만');
  const codes=[...seg.innerHTML.matchAll(/data-g="([\d.]+)"/g)].map(m=>+m[1]);
  assert.deepEqual(codes,M.KINDS.map(k=>M.CODE[k]).concat(M.GAPS),'무늬 일곱 + 간격 여섯');
  assert.ok(seg.cls.has('ps-mow-seg'));assert.equal(lbl.textContent,'잔디 무늬');assert.equal(seg.attr['aria-label'],'잔디 무늬');
  assert.equal((seg.innerHTML.match(/<svg /g)||[]).length,7,'무늬 칸마다 작은 그림');
  assert.match(styles[0].textContent,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,'네 칸 두 줄');
  /* 3D 를 켠 채 무늬를 바꾸면 경기장도 — redrawGrass 를 감싼다 */
  let stands=0,drawn=0;const w2={document:{readyState:'complete',getElementById:()=>null,body:{classList:{contains:c=>c==='bc-tilt3d'}}},redrawGrass:()=>{drawn++;},__tiltStands:()=>{stands++;}};
  M.install(w2);w2.redrawGrass();assert.deepEqual([drawn,stands],[1,1]);
});

test('배선 — board.html 은 모듈을 경기장 앞에 싣고, 평면 줄무늬 세 곳은 모듈 한 줄 · sw CORE · 영어',()=>{
  const b=read('studio/board.html');
  assert.ok(b.includes('<script src="board-mow.js"></script><script src="board-stadium-ground.js"></script>'));
  assert.equal((b.match(/PSBoardMow\.flat\(window,/g)||[]).length,3,'buildPitch · __rescaleGrass · redrawGrass');
  assert.doesNotMatch(b,/_gm\*MPP/,'옛 줄무늬 고리는 남지 않는다');
  assert.ok(read('sw.js').includes("'/studio/board-mow.js'"),'sw CORE');
  const en=read('studio/i18n/en-board.js');for(const k of ['잔디 무늬','넓은 띠','바둑판','5레인','잔디 무늬 {}'])assert.ok(en.includes('"'+k+'":'),k);
});
