'use strict';
/* 3.127 — 해외 구단 같은 유니폼(사용자 «해외리그 팀 유니폼 더 잘» → 시안 → «브랜드로고는 다 빼주고 미리보기부터» · «팀엠블럼도 빼줘»).
   studio/board-jersey.js: 소매 색 · 테두리 색 · 목깃(둥근 목 · V넥 · 카라) · 무늬 넷, 가슴의 브랜드 같은 표시 · 팀 엠블럼 없음.
   studio/board-kit.js: 꾸미기 창의 «소매» · «테두리» · 목깃 · 무늬 넷 · 빠른 조합 20(이름은 색으로만). 실제 판은 tests/browser/board-kit-more.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const J=require('../studio/board-jersey.js'),K=require('../studio/board-kit.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const has=(list,d)=>list.some(n=>n[1].d===d),fillOf=(list,d)=>(list.find(n=>n[1].d===d)||[0,{}])[1].fill,strokeOf=(list,d)=>(list.find(n=>n[1].d===d)||[0,{}])[1].stroke;

test('no brand-like chest mark and no team crest on any token: every shape · pattern · collar',()=>{
  for(const sh of ['circle','shirt'])for(const pat of J.PATS)for(const collar of J.COLLARS){
    const l=J.spec(sh,{main:'#d71920',acc:'#ffffff',pat,collar,sleeve:'#ffffff'}),G=J.GEO[sh==='shirt'?'s':'c'];
    for(const k of ['brand','crest','crestIn'])assert.equal(has(l,G[k]),false,sh+' '+pat+' '+collar+' '+k);
  }
  assert.doesNotMatch(J.svgText('circle',{main:'#1e5bc6'}),/M-9\.4 -9Q/);
});

test('sleeve colour: own fill; the round token drops its narrow sleeve stripes, the shirt keeps them in a colour that shows',()=>{
  const c=J.spec('circle',{main:'#d71920',acc:'#ffffff',sleeve:'#ffffff',trim:'#ffffff'}),s=J.spec('shirt',{main:'#d71920',acc:'#ffffff',sleeve:'#ffffff',trim:'#ffffff'});
  assert.equal(fillOf(c,J.GEO.c.sleeve),'#ffffff');assert.equal(fillOf(s,J.GEO.s.sleeve),'#ffffff');
  assert.equal(has(c,J.GEO.c.stripes),false,'원형: 소매 줄 없음');
  assert.equal(strokeOf(s,J.GEO.s.stripes),'#d71920','셔츠: 소매와 테두리가 같은 흰색이면 소매 줄은 몸통 색');
  assert.equal(strokeOf(s,J.GEO.s.cuffIn),'#ffffff');
  // 소매를 고르지 않으면 예전 그대로(소매 = 몸통 · 줄 = 테두리)
  const o=J.spec('circle',{main:'#d71920',acc:'#ffffff'});
  assert.equal(fillOf(o,J.GEO.c.sleeve),'#d71920');assert.equal(strokeOf(o,J.GEO.c.stripes),'#ffffff');
});

test('a light sleeve darkens only the automatic white rim; a rim the coach picked stays',()=>{
  const rim=l=>l[l.length-1][1].stroke;
  assert.equal(rim(J.spec('circle',{main:'#d71920',sleeve:'#ffffff',stroke:'#ffffff'})),'#2a3140');
  assert.equal(rim(J.spec('shirt',{main:'#d71920',sleeve:'#ffffff',stroke:'#ffffff'})),'#2a3140');
  assert.equal(rim(J.spec('circle',{main:'#d71920',sleeve:'#ffffff',stroke:'#ffffff',autoStroke:false})),'#ffffff','사람이 고른 테두리');
  assert.equal(rim(J.spec('circle',{main:'#d71920',sleeve:'#14213d',stroke:'#ffffff'})),'#ffffff','어두운 소매는 그대로');
  assert.equal(rim(J.spec('circle',{main:'#d71920',stroke:'#ffffff'})),'#ffffff','소매를 고르지 않으면 그대로');
});

test('trim colour: collar · stripes · cuffs use the chosen trim (falls back to the old rule when it disappears into the body)',()=>{
  const l=J.spec('shirt',{main:'#0b3a8c',acc:'#a50044',pat:'v',trim:'#f5c400'}),G=J.GEO.s;
  for(const d of [G.collar,G.cuff])assert.equal(fillOf(l,d),'#f5c400');
  assert.equal(strokeOf(l,G.stripes),'#f5c400');assert.equal(strokeOf(l,G.piping),'#f5c400');
  assert.equal(J.palette({main:'#0b3a8c',acc:'#a50044',trim:'#0b3a8d'}).trim,J.palette({main:'#0b3a8c',acc:'#a50044'}).trim,'몸통과 거의 같은 테두리 → 예전 규칙(보조색 · 자동)');
  assert.equal(J.palette({main:'#1e5bc6',acc:'#ffffff'}).trim,'#ffffff','고르지 않으면 예전 그대로(보조색)');
});

test('collars: V-neck and polo (flaps · placket · two buttons) on both shapes; crew is the old drawing',()=>{
  for(const sh of ['circle','shirt']){const k=sh==='shirt'?'s':'c',G=J.GEO[k];
    const crew=J.spec(sh,{main:'#ffffff',trim:'#14213d'}),v=J.spec(sh,{main:'#ffffff',trim:'#14213d',collar:'v'}),p=J.spec(sh,{main:'#ffffff',trim:'#14213d',collar:'polo'});
    assert.ok(has(crew,G.collar));assert.equal(fillOf(v,J.COLLAR.v[k].collar),'#14213d');assert.ok(!has(v,G.collar));
    assert.equal(fillOf(p,J.COLLAR.polo[k].flaps),'#14213d');assert.ok(has(p,J.COLLAR.polo[k].placket));
    assert.equal(p.filter(n=>n[0]==='circle'&&n[1].r==='.62').length,2,'단추 둘');
    assert.deepEqual(J.spec(sh,{main:'#ffffff',trim:'#14213d',collar:'bogus'}),crew,'모르는 값 = 둥근 목');
    assert.ok(v.length<=22&&p.length<=24,'요소 수 '+v.length+'/'+p.length);
  }
});

test('kit editor: extras are validated, combos carry them, names are colours only',()=>{
  const kits={blue:{shorts:'#ffffff',sleeve:'#FFFFFF',trim:'red',collar:'polo'},'gk:blue':{collar:'v'},red:{collar:'<b>'}};
  assert.deepEqual(K.extrasOf(kits,{team:'blue',num:'9'}),{sleeve:'#ffffff',collar:'polo'},'색은 #rrggbb 만');
  assert.deepEqual(K.extrasOf(kits,{team:'blue',num:'1'}),{collar:'v'},'골키퍼는 골키퍼 칸');
  assert.equal(K.extrasOf(kits,{team:'red',num:'9'}),null);assert.equal(K.extrasOf(kits,{team:'blue',coach:true}),null);
  assert.equal(K.COMBOS.length,20);
  for(const c of K.COMBOS){
    assert.ok(K.PATS.some(p=>p[0]===c[2]),c[5]);assert.match(c[5],/^[가-힣·\sV]+$/,'이름은 색 · 무늬 말로만 '+c[5]);
    const x=c[6]||{};for(const k of Object.keys(x))assert.ok(k==='collar'?['v','polo'].includes(x[k]):/^#[0-9a-f]{6}$/.test(x[k]),c[5]+' '+k);
  }
  assert.deepEqual(K.NEW_PATS,['check','chest','fade','chev']);assert.deepEqual(K.COLLARS.map(c=>c[1]),['둥근 목','V넥','카라']);
});

test('new patterns: the board SVG and the chip CSS draw the same thing',()=>{
  assert.equal(K.newBG('#111111','#ffffff','chest'),'linear-gradient(180deg,#111111 0 30%,#ffffff 30% 45%,#111111 45%)');
  assert.match(K.newBG('#d71920','#ffffff','check'),/repeating-conic-gradient\(#ffffff 0 25%,#d71920 0 50%\) 0 0\/40% 40%/,'5 × 5 칸(40% = 두 칸)');
  assert.equal(K.cssBG('#1','#2','fade'),K.newBG('#1','#2','fade'),'모듈 대체 CSS 도 같은 것');
  assert.equal(K.newBG('#1','#2','solid'),'');
  const src=read('studio/board-kit.js');
  assert.match(src,/R\(b, 0, \.3, 1, \.15\)/,'가슴 띠 30~45%');assert.match(src,/for \(var i = 0; i < 5; i\+\+\) for \(var j = 0; j < 5; j\+\+\) if \(\(i \+ j\) % 2\)/,'체크 5 × 5');
  assert.match(src,/L\.push\(p\)/,'작전판 KIT_PATS 에 더한다(teamPat 이 받아들인다)');assert.match(src,/win\.kitSVGDef = gd/);assert.match(src,/win\.kitCSSBG = gc/);
  const b=read('studio/board.html');
  assert.match(b,/var KIT_PATS=\["solid","v","thinv","h","half","quarters","band","hoop","sash","diag"\];/,'var — window 속성이라 모듈이 더할 수 있다');
  assert.match(b,/function teamPat\(t\)\{var p=\(state&&state\.teamPattern&&state\.teamPattern\[t\]\)\|\|"solid";return KIT_PATS\.indexOf\(p\)>=0\?p:"solid";\}/);
  assert.match(b,/^function kitSVGDef\(id,m,a,pat\)\{/m);assert.match(b,/^function kitCSSBG\(m,a,p\)\{/m);
  assert.ok(Buffer.byteLength(b)<=2560000);
});

test('values reach the drawing only through setAttribute · fixed geometry, and the 3.127 version is out',()=>{
  const k=read('studio/board-kit.js'),j=read('studio/board-jersey.js');
  assert.doesNotMatch(k.slice(k.indexOf('function newDef'),k.indexOf('function kitHTML')),/innerHTML/);
  assert.match(j,/o\.sleeve = x\.sleeve; o\.trim = x\.trim; o\.collar = x\.collar;/);assert.match(j,/win\.__kitMore/);
  const v=+(read('sw.js').match(/const CACHE = 'process-3\.(\d{3})'/)||[])[1];assert.ok(v>=127);
  assert.match(read('studio/release-notes.js'),/v3\.127 · /);
});
