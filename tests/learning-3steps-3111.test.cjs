'use strict';
/* 3.111 — 학습 2판: 한 절 = 세 단(읽기 · 확인 · 해보기) · 확인 문제를 맞히면 완료 · 『스튜디오로 배우는 코칭』 그림 17절(learn-fig.js) */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=f=>fs.readFileSync(path.join(__dirname,'..','studio',f),'utf8');
const learn=R('learning.html');
const fn=name=>{ const i=learn.indexOf('function '+name+'('); assert.ok(i>=0,name); let d=0,j=learn.indexOf('{',i); for(;j<learn.length;j++){ if(learn[j]==='{')d++; else if(learn[j]==='}'&&--d===0)break; } return learn.slice(i,j+1); };

test('a section is three steps — read · check · try — and the old writing steps fold into «더 생각해 보기»',()=>{
  const r=fn('renderSec');
  assert.match(r,/stageHtml\(1,'읽기 · 약 '\+readMin\(s\)\+'분'/);
  assert.match(r,/stageHtml\(2,'확인 — 한 문제'/);
  assert.match(r,/stageHtml\(3,'해보기'/);
  assert.doesNotMatch(r,/'먼저 묻기','읽기','예시','꺼내기','왜','피드백','다시'/,'일곱 단 막대는 없다');
  assert.match(r,/<details class="more"/);
  for(const id of ['pre','recall','why'])assert.ok(r.includes('<textarea id="'+id+'"'),'적어 둔 답 칸 '+id+' 은 그대로');
  assert.match(r,/s\.pic&&window\.LR_FIG\)\?LR_FIG\.html\(s\.pic\)/,'그림은 learn-fig.js 가 그린다');
  assert.match(learn,/<script src="learn-fig\.js\?v=3\.111"><\/script>/);
  assert.doesNotMatch(learn,/function setStep\(|data-grade=|id="finish"|id="again"/,'옛 단 넘기기 · 스스로 채점 · 마치기 단추는 걷었다');
});

function ctxWith(){
  const ctx=vm.createContext({S:{done:{},cards:{},mc:{},ask:{},cur:{done:{}}},DAY:86400000,GAP:[3,7,21],events:[],
    now:()=>1e12,lev:(...a)=>ctx.events.push(a),mirrorCurDone:()=>{}});
  vm.runInContext('function isDone(id){return !!(S.done[id]&&S.done[id].hits>=3)}'+fn('secCards')+fn('secDone'),ctx);
  return ctx;
}
test('a right answer closes the section where the old rule looks (hits 3), starts its cards in 3 days, and logs once',()=>{
  const ctx=ctxWith();
  ctx.sec={id:'SG4',cards:[{id:'st:a',ko:'가'},{id:'st:b',ko:'나'}]};
  vm.runInContext('secDone(sec); secDone(sec);',ctx);
  assert.equal(ctx.S.done.SG4.hits,3,'서재 진행률 · 계정 합치기(mergeLearn) · IDP 가 읽는 자리');
  assert.deepEqual(Object.keys(ctx.S.cards),['st:a','st:b']);
  assert.equal(ctx.S.cards['st:a'].due-1e12,3*86400000);
  assert.equal(ctx.events.filter(e=>e[0]==='done').length,1,'두 번 맞혀도 «마침»은 한 번');
  ctx.S.done.X={hits:5,at:1}; ctx.sec2={id:'X',cards:[]}; vm.runInContext('secDone(sec2)',ctx);
  assert.equal(ctx.S.done.X.hits,5,'예전에 더 많이 맞힌 기록은 줄이지 않는다');
});
test('a wrong answer does not close the section and asks again tomorrow; a later right answer keeps that card',()=>{
  const ctx=ctxWith();
  ctx.sec={id:'SG1',cards:[{id:'st:c',ko:'다'}]};
  vm.runInContext('secCards(sec,1)',ctx);
  assert.equal(ctx.S.done.SG1,undefined);
  assert.equal(ctx.S.cards['st:c'].due-1e12,86400000);
  vm.runInContext('secDone(sec)',ctx);
  assert.equal(ctx.S.cards['st:c'].due-1e12,86400000,'이미 있는 카드는 덮지 않는다');
  const b=fn('bindSec');
  assert.match(b,/if\(ok\)secDone\(s\); else secCards\(s,1\);/);
  assert.match(b,/S\.ask\[k\+':try'\]=\(\+\(S\.ask\[k\+':try'\]\|\|0\)\)\+1; delete S\.mc\[k\];/,'«다시 풀기»는 보기를 다시 섞는다');
});

test('explanations keep their bold text instead of showing «<b>» tags',()=>{
  const ctx=vm.createContext({});
  vm.runInContext("function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}"+fn('escB'),ctx);
  assert.equal(vm.runInContext("escB('신호는 <b>장면</b>이다 <img src=x>')",ctx),'신호는 <b>장면</b>이다 &lt;img src=x&gt;');
});

test('every section of the studio book has a figure, and every figure draws',()=>{
  const win={}; const c=vm.createContext({window:win}); c.window.window=win;
  vm.runInContext(R('learn-studio.js'),c); vm.runInContext(R('learn-fig.js'),c);
  const secs=win.LR_STUDIO.chapters.flatMap(ch=>ch.sections);
  assert.equal(secs.length,17);
  for(const s of secs){
    assert.ok(s.pic,s.id+' 그림');
    const h=win.LR_FIG.html(s.pic);
    assert.ok(h.length>100,s.id+' 그림이 그려진다');
    assert.doesNotMatch(h,/undefined|NaN/,s.id+' 빈 값 없음');
  }
  const pitches=secs.filter(s=>[].concat(s.pic).some(p=>p.t==='pitch')).map(s=>s.id);
  assert.deepEqual(JSON.parse(JSON.stringify(pitches)),['SG1','SG4','ST2','ST4'],'운동장 장면 — 본문 예시 그대로');
});

test('the figure module is light, self-contained and escapes text',()=>{
  const src=R('learn-fig.js');
  assert.ok(Buffer.byteLength(src)<16000,'작전판(2.5MB)을 싣지 않고 가볍게');
  assert.doesNotMatch(src,/fetch\(|XMLHttpRequest|localStorage/);
  const win={}; const c=vm.createContext({window:win}); vm.runInContext(src,c);
  const h=win.LR_FIG.html({t:'steps',items:['<b>x</b>']});
  assert.ok(h.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.equal(win.LR_FIG.html(null),'');
  assert.equal(win.LR_FIG.html({t:'nope'}),'');
});
