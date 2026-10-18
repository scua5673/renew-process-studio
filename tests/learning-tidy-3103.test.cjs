'use strict';
/* 3.103 — 학습 정리: 첫 화면 주 단추 하나 · 절 id 대신 이름 · 카드 «절 열기»는 그 절을 가진 책으로 · 학습 흐름 기록(ps_events 'learn') */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const learn=fs.readFileSync(path.join(__dirname,'..','studio','learning.html'),'utf8');
const fn=name=>{ const i=learn.indexOf('function '+name+'('); assert.ok(i>=0,name); let d=0,j=learn.indexOf('{',i); for(;j<learn.length;j++){ if(learn[j]==='{')d++; else if(learn[j]==='}'&&--d===0)break; } return learn.slice(i,j+1); };

test('the first screen has one primary button: the coaching-loop button is secondary',()=>{
  assert.match(learn,/<button type="button" class="btn" data-loop="'\+esc\(nx\.a\)\+'">/);
  assert.doesNotMatch(learn,/class="btn pri" data-loop=/);
});

test('section ids stay out of sight: head, top bar, book toc, cards',()=>{
  assert.doesNotMatch(learn,/<span class="id">'\+s\.id\+'<\/span>/,'절 머리');
  assert.match(learn,/\$\('#mtitle'\)\.textContent=page==='book'&&bookState\.view==='sec'\?secKo\(bookState\.sec\):/,'위쪽 막대');
  assert.match(learn,/<i><\/i>'\+\(si\+1\)\+'\. '\+esc\(s\.ko\)/,'책 목차');
  assert.doesNotMatch(learn,/<div class="id">'\+esc\(k\)\+' <span class="tag /,'카드 탭');
  assert.doesNotMatch(learn,/'예시 — '\+\(S\.track==='player'\?'선수 먼저':'코치 먼저'\)/,'예시 머리');
});

test('secKo finds a title in this book, another book, then the textbook; openAny opens the book that has the section',()=>{
  const opened=[];
  const ctx=vm.createContext({window:{},toast:m=>opened.push(['toast',m]),openSec:id=>opened.push(['sec',id,ctx.BOOK.id]),openLesson:(m,l)=>opened.push(['lesson',m,l])});
  ctx.window.LR_CUR={lesson:id=>id==='c1-game-1'?{m:{id:'c1-game'},l:{id:'c1-game-1',ko:'경기는 4국면 + 경합으로 본다'}}:null};
  ctx.LR_CUR=ctx.window.LR_CUR;
  const studio={id:'studio',chapters:[{sections:[{id:'SG1',ko:'게임모델 — 약속의 묶음'}]}]};
  const futsal={id:'futsal',chapters:[{sections:[{id:'FA1',ko:'다섯 명의 경기'}]}]};
  vm.runInContext('var BOOKS={studio:S1,futsal:F1}; var BOOK=BOOKS.studio;'
    +'function secs(){var o=[];BOOK.chapters.forEach(function(c){c.sections.forEach(function(s){o.push(s)})});return o}'
    +'function sec(id){return secs().filter(function(s){return s.id===id})[0]}'
    +fn('secKo')+fn('openAny'),Object.assign(ctx,{S1:studio,F1:futsal}));
  assert.equal(vm.runInContext("secKo('SG1')",ctx),'게임모델 — 약속의 묶음');
  assert.equal(vm.runInContext("secKo('FA1')",ctx),'다섯 명의 경기');
  assert.equal(vm.runInContext("secKo('c1-game-1')",ctx),'경기는 4국면 + 경합으로 본다');
  assert.equal(vm.runInContext("secKo('nope')",ctx),'');
  vm.runInContext("openAny('FA1'); openAny('c1-game-1'); openAny('nope')",ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(opened)),[['sec','FA1','futsal'],['lesson','c1-game','c1-game-1'],['toast','그 절을 찾지 못했어요']]);
  assert.match(learn,/\[data-open\]'\)\.forEach\(function\(b\)\{b\.onclick=function\(\)\{openAny\(b\.dataset\.open\)\}\}\);/,'다시 꺼내기의 «절 열기»');
});

test('learning flow events: only stage names, ids, book, role and numbers go to PSSync.event',()=>{
  const sent=[];
  const ctx=vm.createContext({window:{},BOOK:{id:'studio'},S:{role:'coach'}});
  ctx.window.PSSync={event:(n,o)=>sent.push([n,o])}; ctx.window.parent=ctx.window;
  vm.runInContext(fn('lev')+";lev('step','SG1',{step:2});",ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(sent)),[['learn',{feature:'learning',status:'ok',meta:{stage:'step',name:'SG1',source:'studio',mode:'coach',step:2}}]]);
  assert.match(learn,/function openSec\(id\)\{lev\('open',id\);/);
  assert.match(learn,/function setStep\(k,n\)\{if\(n>bookState\.step\)lev\('step',k,\{step:n\}\);/);
  assert.match(learn,/lev\('recall',k,\{ok:ok,hits:S\.done\[k\]\.hits\}\)/);
  assert.match(learn,/lev\('quiz',k,\{ok:!!ok\}\)/);
  assert.match(learn,/lev\('done',k,\{hits:hits\(k\),closed:isDone\(k\)\}\)/);
  assert.doesNotMatch(fn('lev'),/S\.ask|textarea|\.value/,'적은 답은 보내지 않는다');
});

test('the «clear all» control is a quiet link at the bottom of the cards tab, still behind a confirm',()=>{
  assert.match(learn,/<button type="button" class="lnk-quiet" id="resetAll">학습 기록 지우기…<\/button>/);
  assert.match(learn,/\$\('#resetAll'\)\.onclick=function\(\)\{if\(confirm\(/);
});
