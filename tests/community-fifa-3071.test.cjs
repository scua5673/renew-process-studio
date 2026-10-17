const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.071 — 커뮤니티 «FIFA» 칸(사용자 «fifatrainingcentre.com 에 있는 훈련들 커뮤니티 안에 넣어줘»).
   FIFA 훈련센터의 훈련 세션을 링크 카드로 모은다 — 설명 · 그림 · 영상은 옮기지 않고, 카드를 누르면 FIFA 사이트가 새 탭에서 열린다.
   목록 · 카드는 studio/community-fifa.js 모듈이라 require 로 행동을 본다. 화면 연결은 community.html 에서 몇 줄만 본다. */
const root=path.join(__dirname,'..');
const F=require(path.join(root,'studio','community-fifa.js'));
const comm=fs.readFileSync(path.join(root,'studio','community.html'),'utf8');

/* 아주 작은 DOM — render · aside · chips 가 쓰는 것만 */
function fakeDoc(){
  const doc={};
  const mk=tag=>{ const n={tagName:tag.toUpperCase(),ownerDocument:doc,children:[],attrs:{},className:'',_text:'',
    appendChild(c){ this.children.push(c); return c; },
    setAttribute(k,v){ this.attrs[k]=String(v); }, getAttribute(k){ return this.attrs[k]; },
    set textContent(v){ this._text=String(v); this.children=[]; }, get textContent(){ return this._text+this.children.map(c=>c.textContent).join(''); } };
    return n; };
  doc.createElement=mk; doc.createTextNode=t=>({textContent:String(t)});
  return {doc,el:mk('div')};
}
const all=(n,pred,out=[])=>{ (n.children||[]).forEach(c=>{ if(pred(c))out.push(c); all(c,pred,out); }); return out; };

test('every row becomes one card that links only to the FIFA Training Centre practice pages',()=>{
  const l=F.list();
  assert.equal(l.length,F.ROWS.length,'버린 줄이 없다');
  assert.ok(l.length>=150,'엘리트 · 유소년 · 풋살');
  const seen=new Set();
  for(const e of l){
    assert.ok(e.url.startsWith('https://www.fifatrainingcentre.com/en/practice/'),e.url);
    assert.match(e.url,/\.php$/);
    assert.ok(!seen.has(e.url),'같은 주소 두 번: '+e.url); seen.add(e.url);
    assert.ok(e.ko&&/[가-힣]/.test(e.ko),'우리말 제목: '+e.url);
    assert.ok(F.GROUPS.some(g=>g[0]===e.g));
  }
  for(const sec of ['엘리트','유소년','풋살'])assert.ok(l.some(e=>e.sec===sec),sec);
});

test('an address is built only from a plain path — no other site, no climbing out, no script',()=>{
  assert.equal(F.url('grassroots/4-to-8/shooting.php'),F.BASE+'grassroots/4-to-8/shooting.php');
  for(const bad of ['https://evil.example/x.php','//evil.example/x.php','javascript:alert(1)','../x.php','a/../../x.php','x.html','','/abs.php',null,7,'a b.php'])
    assert.equal(F.url(bad),'',String(bad));
  const got=F.read([['att','x.php','하나','One',''],['att','x.php','둘','Two',''],['nope','y.php','셋','',''],['att','https://evil.example/z.php','넷','',''],['att','z.php','','',''],null,'row']);
  assert.deepEqual(got.map(e=>e.ko),['하나'],'같은 주소 · 모르는 주제 · 다른 사이트 · 빈 제목 · 이상한 줄은 버린다');
  assert.deepEqual(F.read(null),[]);
});

test('topic and search narrow the list; search reads the Korean title, the English title and the coach',()=>{
  const l=F.list(),def=l.filter(e=>F.match(e,'def',''));
  assert.ok(def.length>0&&def.every(e=>e.g==='def'));
  assert.equal(l.filter(e=>F.match(e,'all','')).length,l.length);
  assert.ok(l.some(e=>F.match(e,'all','카운터프레스')),'우리말');
  assert.ok(l.some(e=>F.match(e,'all','COUNTER-PRESS')),'영어 — 대소문자 상관없이');
  assert.ok(l.some(e=>F.match(e,'all','dittmer')),'지도자');
  assert.equal(l.filter(e=>F.match(e,'gk','풋살 아님 xyz')).length,0);
  const c=F.counts(); assert.equal(Object.values(c).reduce((a,b)=>a+b,0),l.length);
});

test('render draws the hero and one new-tab link card per training, with text only (no HTML from the table)',()=>{
  const {el}=fakeDoc(),count={textContent:''};
  const n=F.render(el,{group:'u8',q:'',count});
  const cards=all(el,x=>x.className==='fi-card');
  assert.equal(n,F.counts().u8); assert.equal(cards.length,n); assert.equal(count.textContent,'훈련 '+n+'개');
  for(const a of cards){ assert.equal(a.target,'_blank'); assert.equal(a.rel,'noopener noreferrer'); assert.ok(a.href.startsWith(F.BASE)); }
  assert.equal(all(el,x=>x.className==='fi-hero').length,1,'머리 띠 하나');
  assert.ok(!/innerHTML/.test(fs.readFileSync(path.join(root,'studio','community-fifa.js'),'utf8')),'글은 textContent 로만');
  F.render(el,{group:'nope',q:''}); assert.equal(all(el,x=>x.className==='fi-card').length,F.list().length,'모르는 주제는 전체');
  F.render(el,{group:'all',q:'zzzz-없는-말'}); assert.equal(all(el,x=>x.className==='fi-card').length,0);
  assert.ok(all(el,x=>x.className==='empty').length===1,'0개면 안내');
});

test('chips show «전체» plus every topic that has trainings, and picking one calls back with its key',()=>{
  const {el}=fakeDoc(); let picked='';
  F.chips(el,'def',k=>{ picked=k; });
  const chips=el.children; assert.equal(chips.length,1+Object.keys(F.counts()).length);
  const on=chips.filter(b=>b.attrs['aria-pressed']==='true'); assert.equal(on.length,1); assert.match(on[0].textContent,/^수비/);
  chips[0].onclick(); assert.equal(picked,'all');
});

test('the community page wires a fourth «FIFA» tab that reads the module and never calls the server',()=>{
  assert.match(comm,/<script src="community-fifa\.js"><\/script>/);
  assert.match(comm,/<button type="button" id="prTabFifa" data-pr-tab="fifa" aria-pressed="false">FIFA<span id="prFifaN"><\/span><\/button><\/div>/);
  assert.match(comm,/<link rel="stylesheet" href="community-fifa\.css">/);
  assert.match(comm,/if\(tabF==='fifa'\)\{fifaRender\(\);return;\}/,'render');
  assert.match(comm,/if\(tabF==='fifa'\)\{fifaChips\(\);return;\}/,'주제 칩');
  assert.match(comm,/document\.body\.classList\.toggle\('pr-proc',t==='proc'\|\|t==='fifa'\);/,'고르개 · 올리기를 치우는 것은 프로세스 칸의 규칙');
  assert.match(comm,/html body\.pr-fifa \.comm-nav \.nav-sec:has\(#typeNav\),html body\.pr-fifa \.comm-nav \.nav-sec:has\(\[data-sort-nav\]\)\{display:none!important\}/);
  const fn=comm.slice(comm.indexOf('function fifaRender(){'),comm.indexOf('function fifaChips(){'));
  assert.ok(fn.length>0&&!/fetch\(/.test(fn),'서버를 부르지 않는다');
  assert.match(comm,/if\(!b\)\{if\(tabF==='coach'\)grid\.innerHTML=/,'코치 자료를 못 받아도 FIFA 칸을 덮지 않는다');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.match(sw,/'\/studio\/community-fifa\.js', '\/studio\/community-fifa\.css'/,'오프라인에서도');
});
