'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8'),html=read('learning.html');
function fn(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);let depth=0,i=html.indexOf('{',start);for(;i<html.length;i++){if(html[i]==='{')depth++;else if(html[i]==='}'&&!--depth)break;}return html.slice(start,i+1);}
function context(){
 const c=vm.createContext({});c.window=c;
 for(const f of ['learn-curriculum.js','learn-curriculum-pro.js','learn-books.js',...['player','coach','physical','analysis','at'].map(t=>'learn-book-'+t+'.js'),'learn-studio.js','learn-futsal.js','learn-fig.js'])vm.runInContext(read(f),c);
 const books=c.LR_CUR.modules.map(m=>c.LR_BOOK.of(m.id)).concat(c.LR_STUDIO,c.LR_FUTSAL);
 Object.assign(c,{books,BOOKS:Object.fromEntries(books.map(b=>[b.id,b])),BOOK:c.LR_STUDIO,ROLES:[],_roleBook:{},GAP:[3,7,21],DAY:86400000,clock:1e12,now:()=>c.clock,save:()=>{c.saved++;},saved:0,toast:()=>{},lev:()=>{},render:()=>{},ensureRoleBook:()=>{},scrollTo:()=>{},page:'book',bookState:{}});
 c.$=()=>null;c.$$=()=>[];
 for(const name of ['esc','escB','chLabel','secs','sec','secKo','chapOf','isDone','hits','dueCards','fmtDays','sectionAnywhere','sectionContext','readMin','hash','shuffled','tryHtml','stageHtml','renderSec','mirrorCurDone','secCards','secDone','bindSec','renderDue','bindDue','renderMix','bindMix','goNextSec','roleMods','sectionKnown','openReadingBook'])vm.runInContext(fn(name),c);
 return c;
}
const c=context(),rows=c.books.flatMap(b=>b.chapters.flatMap(ch=>ch.sections.map(s=>({b,ch,s}))));
function fresh(){c.S={track:'coach',role:'coach',ask:{},done:{},mc:{},cards:{},mix:{},cur:{done:{},quiz:{}},now:null};c.bookState={};c.clock=1e12;c.saved=0;}
function hookSec(s){
 const inputs=Object.fromEntries(['pre','recall','why'].map(id=>['#'+id,{value:''}])),retry={},answer={},next={};
 const opts=s.mc.o.map(o=>({dataset:{opt:o.id}}));
 c.$=q=>inputs[q]||(q==='#retryQ'?retry:q==='#showAns'?answer:q==='#nextSec'?next:null);
 c.$$=q=>q==='#p-book [data-opt]'?opts:[];c.bindSec(s);return {inputs,retry,answer,next,opts};
}
test('the live curriculum has 304 unique lessons, 96 chapters and 571 chapter questions',()=>{
 assert.equal(rows.length,304);assert.equal(new Set(rows.map(r=>r.s.id)).size,304);
 assert.equal(c.books.flatMap(b=>b.chapters).length,96);assert.equal(c.books.flatMap(b=>b.chapters.flatMap(ch=>ch.mix)).length,571);
 const cards=rows.flatMap(r=>r.s.cards.map(x=>x.id));assert.equal(new Set(cards).size,cards.length,'cards have unambiguous source lessons');
});
for(const {b,ch,s}of rows)test('lesson '+s.id+': every answer, draft, completion, source review and review schedule',()=>{
 fresh();c.BOOK=b;c.bookState={view:'sec',sec:s.id};
 for(const field of ['ko','pre','fig','why','fb'])assert.ok(typeof s[field]==='string'&&s[field].trim(),field);
 assert.ok(s.read.length&&s.read.every(t=>typeof t==='string'&&t.trim()));assert.ok(s.ex.length&&s.ex.every(e=>e.who&&e.t));assert.ok(s.recall.q&&s.recall.a);assert.ok(s.cards.length);assert.ok(s.references.length);assert.ok(s.references.every(r=>r.label&&/^https:\/\//.test(r.url)));
 if(s.try){assert.ok(['gamemodel','myidp','players','idp','schedule','create','match'].includes(s.try.to));assert.equal(s.try.steps.length,3);}
 assert.equal(s.mc.o.filter(o=>o.ok).length,1);assert.equal(new Set(s.mc.o.map(o=>o.id)).size,s.mc.o.length);assert.equal(new Set(s.mc.o.map(o=>o.t)).size,s.mc.o.length);assert.ok(s.mc.why);
 let view=c.renderSec(s);assert.ok(view.includes(c.esc(s.ko)));assert.doesNotMatch(view,/undefined|NaN/);assert.equal(view.includes('data-st="3"'),!!s.try);
 for(const o of s.mc.o){
  fresh();c.BOOK=b;c.bookState={view:'sec',sec:s.id};const h=hookSec(s);h.opts.find(x=>x.dataset.opt===o.id).onclick();
  assert.equal(c.isDone(s.id),o.ok,'only correct option completes');assert.equal(c.S.mc[s.id],o.id);
  for(const card of s.cards){assert.equal(c.S.cards[card.id].from,s.id);assert.equal(c.S.cards[card.id].due-c.clock,(o.ok?3:1)*c.DAY);}
  view=c.renderSec(s);assert.ok(view.includes(o.ok?'맞았어요.':'정답은 '));assert.ok(view.includes('id="retryQ"'),'any answered lesson can be retried');
  h.retry.onclick();assert.equal(c.S.mc[s.id],undefined);assert.equal(c.isDone(s.id),o.ok,'retry does not remove completed progress');
 }
 fresh();c.BOOK=b;c.bookState={view:'sec',sec:s.id};const h=hookSec(s);
 for(const [key,input]of Object.entries(h.inputs)){input.value='검증 답안 '+s.id+' '+key;input.oninput();}
 h.answer.onclick();c.S=JSON.parse(JSON.stringify(c.S));view=c.renderSec(s);for(const input of Object.values(h.inputs))assert.ok(view.includes(input.value),'written answers survive reveal and serialization');
 h.opts.find(x=>x.dataset.opt===s.mc.o.find(o=>o.ok).id).onclick();
 const L=c.LR_CUR.lesson(s.id);if(L)assert.ok(c.S.cur.done[s.id],'shelf mirrors completion');
 // Review resolves the source even after an unrelated book is selected.
 c.BOOK=c.LR_FUTSAL;c.clock+=3*c.DAY;const card=s.cards[0];c.S.cards=Object.fromEntries([[card.id,c.S.cards[card.id]]]);c.bookState.dueShown=false;
 view=c.renderDue();assert.ok(view.includes(c.esc(s.recall.q)));assert.doesNotMatch(view,/<h2>[^<]*—[^<]*<\/h2>/,'answer card text is not the review heading');assert.ok(!view.includes('class="ans"'));
 const input={value:'복습 '+s.id},show={},right={dataset:{dgrade:'1'}},wrong={dataset:{dgrade:'0'}};
 c.$=q=>q==='#dueAns'?input:q==='#dueShow'?show:null;c.$$=q=>q.includes('data-dgrade')?[right,wrong]:[];c.bindDue();input.oninput();show.onclick();view=c.renderDue();assert.ok(view.includes(input.value));assert.ok(view.includes(c.esc(s.recall.a)));
 wrong.onclick();assert.equal(c.S.cards[card.id].stage,0);assert.equal(c.S.cards[card.id].due,c.clock+c.DAY);
 for(const [stage,gap]of [[1,7],[2,21],[3,21]]){c.clock=c.S.cards[card.id].due;right.onclick();assert.equal(c.S.cards[card.id].stage,stage);assert.equal(c.S.cards[card.id].due,c.clock+gap*c.DAY);}
 assert.equal(c.dueCards().length,0,'mastered cards leave the due queue');
 c.secCards(s,1);assert.equal(c.S.cards[card.id].stage,0,'a later wrong answer reopens practice');assert.equal(c.S.cards[card.id].due,c.clock+c.DAY);
});
for(const b of c.books)for(const ch of b.chapters)test('chapter '+ch.id+': every mixed question has a usable answer and advances with saved results',()=>{
 fresh();c.BOOK=b;c.bookState={mixCh:ch.id,mixI:0};c.S.mix[ch.id]=[];
 for(let i=0;i<ch.mix.length;i++){
  const item=ch.mix[i];c.bookState.mixI=i;c.bookState.mixShown=false;c.bookState.mixPick=null;
  const v=c.renderMix(ch.id);assert.ok(v.includes(c.esc(item.q)));assert.doesNotMatch(v,/undefined|NaN/);
  const input={value:'장 복습 '+ch.id+' '+i},show={},next={},grade={dataset:{mgrade:'1'}};
  const opts=(item.o||[]).map(o=>({dataset:{mopt:o.id,ok:o.ok?'1':'0'}}));
  c.$=q=>q==='#mixAns'?input:q==='#mixShow'?show:q==='#mixNext'?next:null;
  c.$$=q=>q.includes('data-mopt')?opts:q.includes('data-mgrade')?[grade]:[];c.bindMix();
  if(item.kind==='가려내기'){assert.equal(item.o.filter(o=>o.ok).length,1);opts.find(o=>o.dataset.ok==='1').onclick();assert.equal(c.S.mix[ch.id][i],1);next.onclick();}
  else{assert.ok(item.a);input.oninput();show.onclick();assert.ok(c.renderMix(ch.id).includes(c.esc(item.a)));assert.ok(c.renderMix(ch.id).includes(input.value));grade.onclick();}
  assert.equal(c.bookState.mixI,i+1);assert.equal(c.bookState.mixShown,false);
 }
 assert.equal(c.S.mix[ch.id].length,ch.mix.length);assert.ok(c.renderMix(ch.id).includes('이번 결과는 저장됐어요'));
});
test('next lesson traverses all live lessons without switching to a different role or looping',()=>{
 for(const {b,s}of rows){fresh();c.BOOK=b;let target=null;c.openSec=id=>{target=id;};c.openLesson=(mid,id)=>{target=id;};c.go=p=>{target='page:'+p;};c.goNextSec(s);
  const L=c.LR_CUR.lesson(s.id),ordered=L?rows.filter(r=>c.LR_CUR.lesson(r.s.id)?.m.track===L.m.track).map(r=>r.s.id):b.chapters.flatMap(ch=>ch.sections.map(x=>x.id));
  assert.equal(target,ordered[ordered.indexOf(s.id)+1]||'page:book',s.id);
 }
});
test('reading-book navigation restores the saved lesson and does not lose its draft',()=>{
 fresh();let opened=null;c.S.now='a3-see-2';c.S.ask['a3-see-2:recall']='내 답';c.openAny=id=>{opened=id;};c.openReadingBook();assert.equal(opened,'a3-see-2');assert.equal(c.S.ask['a3-see-2:recall'],'내 답');
});
