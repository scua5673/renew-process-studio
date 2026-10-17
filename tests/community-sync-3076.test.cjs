const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.076 — 훈련 만들기 ↔ 커뮤니티를 한 표로(사용자 «훈련만들기와 잘 연동이 되어야 해 · 둘이 잘 맞추고 싶어»).
   작전판의 훈련 성격 10가지 → 커뮤니티 주제 8개 → 올린 글의 cat → 보관함에 다시 담은 훈련의 성격이 같은 주제로 돌아온다. */
const root=path.join(__dirname,'..');
const T=require(path.join(root,'studio','community-tax.js'));
const comm=fs.readFileSync(path.join(root,'studio','community.html'),'utf8');
const board=fs.readFileSync(path.join(root,'studio','board.html'),'utf8');
const keysOf=v=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean);

/* 올리기 창을 그릴 만큼의 작은 문서 */
function fakeDoc(){
  const mk=tag=>{ const n={tag,children:[],dataset:{},attrs:{},textContent:'',className:'',
    classList:{s:new Set(),toggle(c,on){ on?this.s.add(c):this.s.delete(c); },contains(c){ return this.s.has(c); }},
    setAttribute(k,v){ this.attrs[k]=v; },appendChild(c){ this.children.push(c); return c; },click(){ this.onclick&&this.onclick(); }}; return n; };
  return {createElement:mk,mk};
}

test('every board training focus has one community topic, and the board and the module know the same ten keys',()=>{
  const m=board.match(/const FOCUS=\[([\s\S]*?)\n\];/); assert.ok(m,'board.html FOCUS');
  const bk=[...m[1].matchAll(/k:"(\w+)"/g)].map(x=>x[1]);
  assert.deepEqual(bk.slice().sort(),Object.keys(T.FOCUS).sort(),'작전판 성격 10가지 = 분류표');
  for(const k of bk)assert.ok(T.TOPICS.some(t=>t[0]===T.FOCUS[k]),k+' → 주제');
});

test('round trip: board focus → topic → posted cat → coach filter → saved focus lands on the same topic',()=>{
  for(const k of Object.keys(T.FOCUS)){
    const t=T.FOCUS[k],cat=T.TO_CAT[t];
    assert.deepEqual(T.fromCoach({cat},keysOf).topics,[t],k+': 커뮤니티 고르개에서 같은 주제');
    const f=T.focusOfPost({cat}); assert.ok(T.FOCUS[f],k+': 보관함에는 작전판이 아는 키'); assert.equal(T.FOCUS[f],t,k+': 담아도 같은 주제');
  }
  assert.equal(T.focusOfPost({cat:'gk'}),'tech','골키퍼만 고른 글은 기술 훈련으로');
  assert.equal(T.focusOfPost({cat:'gk,tr_def'}),'tr_def','골키퍼 + 다른 주제면 다른 주제');
  assert.equal(T.focusOfPost({cat:'rondo,match'}),'bp','예전 코치 분류도 주제를 거쳐');
  assert.equal(T.focusOfPost({cat:'nope'}),'tech','모르면 예전 기본값');
  assert.equal(T.focusOfPost({cat:'bpo',item:{focus:'poss'}}),'poss','글 속 훈련의 성격이 먼저');
});

test('the upload form uses the same topics and ages, prefilled from the chosen training (topic · ages · head count)',()=>{
  const doc=fakeDoc(),topics=doc.mk('div'),ages=doc.mk('div'),pl={value:''};
  const up=T.upForm(doc,{topics,ages,pl});
  assert.deepEqual(topics.children.map(b=>b.textContent),T.TOPICS.map(t=>t[1]),'고르개와 같은 순서 · 이름');
  assert.deepEqual(ages.children.map(b=>b.textContent),T.AGES);
  const P=n=>({players:Array.from({length:n},(_,i)=>({id:i}))});
  up.fill({focus:'tr_def',ages:['U12','X'],snap:P(4),trainings:[{snap:P(6)},{frames:[{snap:P(10)}]}]});
  assert.deepEqual(up.get(),{topics:['trd'],cat:'tr_def',ages:['U12'],age:'U12',players:'10'},'가장 많은 훈련의 인원');
  assert.ok(topics.children[1].classList.contains('on'));
  topics.children[6].click(); assert.equal(up.get().cat,'tr_def,gk','골키퍼를 더 고를 수 있다');
  up.fill({focus:'bp',snap:P(3)}); assert.deepEqual([up.get().cat,up.get().players],['tr_def,gk','10'],'코치가 고친 것은 덮지 않는다');
});

test('community.html uses the shared table for upload and for saving to the vault',()=>{
  assert.match(comm,/TX\.upForm\(document,\{topics:\$\('upCats'\),ages:\$\('upAges'\),pl:\$\('upPlayers'\)\}\)/);
  assert.match(comm,/if\(up\)up\.fill\(d\);/,'고른 훈련에서 미리 채움');
  assert.match(comm,/cat:uf\.cat,age:uf\.age,players:uf\.players,/);
  assert.match(comm,/d\.focus=d\.focus\|\|\(TX\?TX\.focusOfPost\(p\):'tech'\);if\(!d\.ages&&p\.age\)d\.ages=catKeys\(p\.age\);/,'담을 때는 거꾸로 · 연령도 함께');
  assert.match(comm,/'slides','ages'\];/,'연령이 보관함 ↔ 글 사이를 오간다');
  assert.doesNotMatch(comm,/CATGUESS|selCats/,'옛 21종 칩은 올리기에서 빠진다');
});
