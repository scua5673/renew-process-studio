'use strict';
/* 3.024 — «새 기능» 안내는 열 판마다 한 번(사용자 «새 기능 추가 이야기는 10개에 한 번씩 하자»).
   판 번호 끝이 0 인 판(3.020 · 3.030 …)이 안내 판이고, 그 안내는 바로 앞 안내 판 뒤의 판들을 모아 한 번에 보여 준다. 그 사이 판은 조용하다.
   앱 설정 위 «새 기능»(app.html news) · 폰 더보기 줄 · 선수 전용 폰 띠(release-notes.js mount) 모두 같은 묶음(announced)을 쓴다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const notes=require('../studio/release-notes.js');
const A=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const SW=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
const E=(v,id,date)=>({id:id||v,date:date||'2026-10-14',title:'v'+v+' · '+(id||v),changes:['내용']});

test('versionNo: 제목 머리의 판 번호 — 큰 판 × 1000 + 작은 판, 없으면 NaN',()=>{
  assert.equal(notes.versionNo(E('3.019')),3019);
  assert.equal(notes.versionNo(E('2.999')),2999);
  assert.equal(notes.versionNo(E('3.020')),3020);
  assert.ok(Number.isNaN(notes.versionNo({title:'저장 안내 개선'})));
  assert.ok(Number.isNaN(notes.versionNo(null)));
  assert.equal(notes.ANNOUNCE_EVERY,10);assert.equal(notes.ANNOUNCE_FROM,3020,'3.019 까지는 판마다 알렸다 — 3.020 부터 센다');
});

test('announced: 가장 최근 안내 판(끝이 0)과 그 앞 아홉 판만, 최신이 앞 — 앞 안내 판 · 그 뒤 조용한 판 · 판 번호 없는 옛 항목은 뺀다',()=>{
  const list=[E('3.024'),E('3.023'),E('3.011','x11','2026-10-13'),E('3.020'),E('3.016'),E('3.019'),E('3.010'),E('3.009'),{id:'old',date:'2026-09-15',title:'저장 안내 개선',changes:['옛 안내']}];
  assert.deepEqual(notes.announced(list).map(e=>e.title),['v3.020 · 3.020','v3.019 · 3.019','v3.016 · 3.016','v3.011 · x11'],'3.021~3.024 는 다음 안내(3.030)까지 기다린다 · 3.010 은 앞 묶음');
  assert.deepEqual(notes.announced([E('3.019'),E('3.010'),E('3.001')]),[],'3.020 전에는 안내 판이 없다 — 3.010 을 지금 와서 띄우지 않는다');
  assert.deepEqual(notes.announced([E('3.025'),E('3.030'),E('3.020'),E('3.029')]).map(e=>e.title),['v3.030 · 3.030','v3.029 · 3.029','v3.025 · 3.025'],'안내 판이 둘이면 최근 것의 묶음');
  assert.deepEqual(notes.announced([E('2.995'),E('3.000'),E('2.991'),E('2.990')]),[],'3.000 은 3.020 전이라 세지 않는다');
  assert.deepEqual(notes.announced([]),[]);assert.deepEqual(notes.announced('x'),[]);
  const now=notes.announced();
  if(now.length){const a=notes.versionNo(now[0]);assert.ok(a>=3020&&a%10===0,'실제 목록: 맨 앞은 안내 판');assert.ok(now.every(e=>{const n=notes.versionNo(e);return n>a-10&&n<=a;}));}
  assert.ok(notes.entries().some(e=>/^v3\.024 · «새 기능» 안내는 열 판마다 한 번/.test(e.title)),'3.024 안내 — 다음 안내 판에 함께 나간다');
});

// 선수 전용 폰의 «최근 업데이트» 띠 — 최소 fixture 로 실제 mount 를 돌린다(release-notes.test.cjs 와 같은 꼴)
function harness(list){
  const stored=new Map();let at=Date.UTC(2026,9,14);
  class Events{constructor(){this.events=new Map();}addEventListener(t,h){if(!this.events.has(t))this.events.set(t,new Set());this.events.get(t).add(h);}removeEventListener(t,h){this.events.get(t)?.delete(h);}dispatch(t,e={}){for(const h of this.events.get(t)||[])h(e);}}
  class Element extends Events{constructor(tag){super();this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.hidden=false;this.id='';this.className='';this._text='';this.classList={add:n=>{this.className=[this.className,n].filter(Boolean).join(' ');}};}
    appendChild(c){this.children.push(c);return c;}replaceChildren(...c){this.children=c;this._text='';}set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
    setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}click(){this.dispatch('click');}}
  const win=new Events(),doc=new Events(),host=new Element('div');host.id='psReleaseNotes';
  doc.head=new Element('head');doc.body=new Element('body');doc.body.appendChild(host);doc.hidden=false;doc.createElement=t=>new Element(t);
  const find=(r,p)=>{if(p(r))return r;for(const c of r.children){const x=find(c,p);if(x)return x;}return null;};
  doc.getElementById=id=>find(doc.head,n=>n.id===id)||find(doc.body,n=>n.id===id);
  Object.assign(win,{document:doc,PS_BUILD:'3.024',localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)},setTimeout:()=>1,clearTimeout(){}});
  const controller=notes.mount({window:win,host,entries:list,now:()=>at});
  return {host,controller,hide:()=>find(host,n=>n.tagName==='BUTTON'&&n.textContent==='일주일간 안 보기').click()};
}

test('선수 전용 폰 띠: 안내 판 묶음만 보이고, 그 사이 판이 더해져도 숨긴 채로 조용하다 — 다음 안내 판에 다시 보인다',()=>{
  const h=harness([E('3.021'),E('3.020'),E('3.019')]);
  assert.equal(h.host.hidden,false);assert.match(h.host.textContent,/v3\.020 · 3\.020/);assert.match(h.host.textContent,/v3\.019/);assert.doesNotMatch(h.host.textContent,/v3\.021/,'조용한 판은 띠에도 없다');
  h.hide();assert.equal(h.host.hidden,true);
  h.controller.refresh([E('3.023'),E('3.022'),E('3.021'),E('3.020'),E('3.019')]);
  assert.equal(h.host.hidden,true,'3.022 · 3.023 이 더해져도 묶음(3.011~3.020)은 그대로 — 숨긴 것이 풀리지 않는다');
  h.controller.refresh([E('3.030'),E('3.023'),E('3.022'),E('3.021'),E('3.020'),E('3.019')]);
  assert.equal(h.host.hidden,false,'안내 판 3.030 — 새 묶음이라 다시 보인다');
  assert.match(h.host.textContent,/v3\.030/);assert.match(h.host.textContent,/v3\.021/);assert.doesNotMatch(h.host.textContent,/v3\.020 · 3\.020/,'3.020 은 앞 묶음');
  const none=harness([E('3.019'),E('3.010')]);assert.equal(none.host.hidden,true,'안내 판이 아직 없으면 띠도 없다');
});

test('앱 설정 위 «새 기능»: 묶음을 안내 판 날짜로 7일 · 제목 «v3.011 ~ v3.020» · 폰 줄은 «새 기능 · v3.011 ~ v3.020 · n가지»',()=>{
  const body=A.slice(A.indexOf('(function(){\n  var SEEN='),A.indexOf('window.__psUpdSurface='));
  assert.match(body,/function bundle\(\)\{try\{return window\.PSReleaseNotes&&PSReleaseNotes\.announced\?PSReleaseNotes\.announced\(\):\[\];\}catch\(_\)\{return \[\];\}\}/);
  assert.match(body,/function news\(\)\{[^\n]*\n\s*var b=bundle\(\),t=dayOf\(b\[0\]\);return \(b\.length&&t>=from&&t<=to\)\?b:\[\];\}/,'안내 판(묶음 맨 앞) 날짜로 7일 · 셋으로 자르지 않는다');
  assert.doesNotMatch(body,/\.slice\(0,3\)/);
  assert.match(body,/T\.textContent='새 기능';V\.textContent=rangeOf\(n\);/);
  assert.match(body,/N\.textContent='열 판마다 한 번 모아서 알려 드려요\. 이 표시는 7일 뒤 저절로 사라져요\.';/);
  assert.match(body,/b\.title=md==='ready'\?'새 판이 준비됐어요':'최근 열 판에서 바뀐 것';/);
  assert.match(body,/tx\.innerHTML='<b>새 기능<\/b> · '\+esc\(n\.length>1\?rangeOf\(n\)\+' · '\+n\.length\+'가지':titleOf\(first\)\);/);
  assert.match(body,/if\(md==='ready'\)\{var e=st\.next&&st\.next\.entry;T\.textContent='새 판이 준비됐어요';/,'«업데이트»(새 판 준비됨)는 그대로');
});

test('판 3.024 이상 — app.html · sw.js 가 같은 판(뒤 PR 이 판을 올려도 깨지지 않게 3.024 이상 · 같음만 본다)',()=>{
  const build=(A.match(/window\.PS_BUILD='(3\.\d{3})'/)||[])[1],cache=(SW.match(/^const CACHE = 'process-(3\.\d{3})';/m)||[])[1];
  assert.ok(build&&cache,'build '+build+' · cache '+cache);assert.equal(cache,build,'sw.js CACHE = app.html PS_BUILD');
  assert.ok(+build.slice(2)>=24,'3.024 부터 — '+build);assert.doesNotMatch(A,/\?v=3\.019\b/);
});
