'use strict';
// 3.130 — 보기 전용 미팅(보관함 «큰 화면으로 보기»)과 발표 화면(board-meet-look.js installView · board-topbar.js).
// 예전: 보기 전용 미팅에서 제목 · 메모를 고칠 수 있었고 닫으면 말없이 사라졌다 · 발표에서 위쪽 막대가 슬라이드 제목 · 메모를 덮었다 ·
// «나가기»(연분홍 글자)와 흰 운동장의 메모(흰 글자)가 흰 판 위에서 거의 안 보였다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const L=require('../studio/board-meet-look.js');
const TB=require('../studio/board-topbar.js');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

// 최소한의 가짜 문서 — 칸 · 막대 · 보관함 미리보기 · 클래스 감시 · 캡처 단계 듣개
function fake(){
  const cls=new Set(),els={},on={},timers=[];let obs=null;
  const el=(id,extra)=>{const e=Object.assign({id,readOnly:false,textContent:'',style:{display:''},clicks:0,
    closest(sel){return sel.split(',').some(s=>s.trim()==='#'+id||(e.attr&&s.trim()==='['+e.attr+']'))?e:(e.parent&&e.parent.closest(sel))||null;},
    querySelector(sel){return (e.kids||[]).find(k=>sel==='['+k.attr+']')||null;},
    click(){e.clicks++;if(e.onclick)e.onclick();}},extra||{});if(id)els[id]=e;return e;};
  ['ksTitle','ksPoints','ksBrand','ksHeadIn','vCreateBar','vCreateCancel'].forEach(id=>el(id));
  el('vCreateTitle',{textContent:'미팅 수정'});el('vCreateEdit',{style:{display:'none'}});
  const pv=el('',{attr:'x-preview'}),view=el('',{attr:'data-vx-view',parent:pv}),edit=el('',{attr:'data-vx-edit',parent:pv});
  pv.kids=[view,edit];pv.closest=sel=>sel==='.vx-preview'?pv:null;
  const body={classList:{contains:c=>cls.has(c),add:c=>{cls.add(c);obs&&obs();},remove:c=>{cls.delete(c);obs&&obs();}}};
  const head={kids:[],appendChild(s){head.kids.push(s);}};
  const doc={readyState:'complete',body,head,documentElement:head,
    getElementById:id=>id==='psMeetViewCss'?(head.kids.find(s=>s.id===id)||null):(els[id]||null),
    querySelector:sel=>sel==='#drillFiles .vx-preview'?(doc.__pv||null):null,
    createElement:()=>({id:'',textContent:''}),
    addEventListener(t,f,cap){(on[t]=on[t]||[]).push({f,cap});}};
  doc.__pv=pv;
  const toasts=[];
  const win={document:doc,setTimeout:(f,ms)=>{timers.push(f);return timers.length;},toast:m=>toasts.push(m),
    MutationObserver:function(cb){this.observe=()=>{obs=cb;};}};
  const fire=(t,target)=>{const ev={target,stopped:false,prevented:false,stopImmediatePropagation(){ev.stopped=true;},preventDefault(){ev.prevented=true;}};(on[t]||[]).forEach(h=>h.f(ev));return ev;};
  const flush=(n=60)=>{for(let i=0;i<n&&timers.length;i++)timers.shift()();};
  return {win,doc,els,cls,fire,flush,toasts,pv,view,edit};
}
function openRo(f,{fromPreview=true,editable=true}={}){
  f.win.__vaultPreviewId='M1';
  if(!editable)f.pv.kids=[f.view];
  if(fromPreview)f.fire('click',f.view);
  f.win.__vvMeetLib='M1';f.win.__vaultReadOnly=true;
  f.doc.body.classList.add('meet-mode');f.doc.body.classList.add('vcreating');   // 클래스 감시가 sync 를 부른다
}

test('보기 전용 미팅 — 칸을 잠그고 «미팅 보기» · 미리보기에 «편집»이 있었으면 막대에도 «편집»',()=>{
  const f=fake();L.installView(f.win);openRo(f);
  ['ksTitle','ksPoints','ksBrand','ksHeadIn'].forEach(id=>assert.equal(f.els[id].readOnly,true,id+' 잠금'));
  assert.equal(f.els.vCreateTitle.textContent,'미팅 보기');
  assert.equal(f.els.vCreateEdit.style.display,'','«편집» 보임');
  // 잠긴 칸을 누르면 안내 — 2.5초에 한 번
  f.fire('focusin',f.els.ksTitle);f.fire('keydown',f.els.ksTitle);
  assert.deepEqual(f.toasts,['보기 전용이에요 — 위쪽 «편집»을 누르면 고칠 수 있어요']);
});

test('«편집» — 닫고, 보관함 화면으로 돌아온 뒤 그 미리보기의 «편집»을 누른다(board.html 의 처리는 건너뛴다)',()=>{
  const f=fake();L.installView(f.win);openRo(f);
  f.els.vCreateCancel.onclick=()=>{f.win.__vaultReadOnly=false;f.doc.body.classList.remove('vcreating');f.doc.body.classList.remove('meet-mode');};
  const ev=f.fire('click',f.els.vCreateEdit);
  assert.equal(ev.stopped,true,'원래 처리(__vvItem — 미팅에서는 비어 있다)는 돌지 않는다');
  assert.equal(f.els.vCreateCancel.clicks,1,'닫기');
  f.flush(5);assert.equal(f.edit.clicks,0,'셸이 보관함 보기(session)로 돌리기 전에는 누르지 않는다 — 그 setView 가 편집을 덮는다');
  f.win.__csView='session';f.flush();
  assert.equal(f.edit.clicks,1,'미리보기의 «편집»(openItemEdit) 한 번');
  ['ksTitle','ksPoints','ksBrand','ksHeadIn'].forEach(id=>assert.equal(f.els[id].readOnly,false,id+' 풀림'));
});

test('어디서 열었는지 모르면(경기 준비 안 쇼 · 목록 줄 «보기») «편집»을 세우지 않고 길만 알려 준다',()=>{
  let f=fake();L.installView(f.win);openRo(f,{fromPreview:false});
  assert.equal(f.els.vCreateEdit.style.display,'none');
  assert.equal(f.els.ksPoints.readOnly,true,'그래도 잠근다');
  f.fire('focusin',f.els.ksPoints);
  assert.deepEqual(f.toasts,['보기 전용이에요 — 고치려면 보관함에서 «편집»으로 여세요']);
  f.fire('click',f.els.vCreateEdit);assert.equal(f.els.vCreateCancel.clicks,0,'닫지 않는다');
  // 남의 미팅(미리보기에 «편집» 없음)
  f=fake();L.installView(f.win);openRo(f,{editable:false});
  assert.equal(f.els.vCreateEdit.style.display,'none');
});

test('누른 기록은 그 누름으로 연 보기에만 — 5초 지난 기록 · 닫은 뒤의 기록은 쓰지 않는다',()=>{
  const f=fake();L.installView(f.win);
  f.win.__vaultPreviewId='M1';f.fire('click',f.view);
  const real=Date.now;Date.now=()=>real()+6000;   // 미리보기에서 누른 지 6초 뒤에 다른 길로 같은 미팅을 보기 전용으로 열었다
  try{ openRo(f,{fromPreview:false}); }finally{ Date.now=real; }
  assert.equal(f.els.vCreateEdit.style.display,'none');
  assert.equal(L.installView(f.win),null,'두 번 깔지 않는다');
  const g=fake();L.installView(g.win);openRo(g);
  assert.equal(g.els.vCreateEdit.style.display,'');
  g.win.__vaultReadOnly=false;g.doc.body.classList.remove('vcreating');g.doc.body.classList.remove('meet-mode');
  openRo(g,{fromPreview:false});   // 닫고 다시(누르지 않고) 연 보기
  assert.equal(g.els.vCreateEdit.style.display,'none','닫으면 기록을 버린다');
});

test('다른 코드가 잠근 칸은 풀지 않는다 · 셸 없이 연 작전판에서도 «편집»은 결국 연다',()=>{
  const f=fake();L.installView(f.win);
  f.els.ksBrand.readOnly=true;   // 다른 코드가 먼저 잠갔다
  openRo(f);
  f.win.__vaultReadOnly=false;f.doc.body.classList.remove('vcreating');f.doc.body.classList.remove('meet-mode');
  assert.equal(f.els.ksTitle.readOnly,false,'이 모듈이 잠근 칸은 푼다');
  assert.equal(f.els.ksBrand.readOnly,true,'남이 잠근 칸은 그대로');
  const g=fake();L.installView(g.win);openRo(g);
  g.els.vCreateCancel.onclick=()=>{g.win.__vaultReadOnly=false;g.win.__csView='board';g.doc.body.classList.remove('vcreating');g.doc.body.classList.remove('meet-mode');};
  g.fire('click',g.els.vCreateEdit);g.flush();
  assert.equal(g.edit.clicks,1,'셸의 답(session)이 오지 않아도 2초 남짓 뒤에 연다');
});

test('편집 중 미팅 · 작업 보드는 건드리지 않는다 — 막대 이름(경기 준비 안의 미팅 이름)도 그대로',()=>{
  const f=fake();L.installView(f.win);
  f.win.__vaultReadOnly=false;f.doc.body.classList.add('meet-mode');f.doc.body.classList.add('vcreating');
  ['ksTitle','ksPoints','ksBrand','ksHeadIn'].forEach(id=>assert.equal(f.els[id].readOnly,false));
  assert.equal(f.els.vCreateTitle.textContent,'미팅 수정');
  const g=fake();L.installView(g.win);g.els.vCreateTitle.textContent='3라운드 미팅';openRo(g);
  assert.equal(g.els.vCreateTitle.textContent,'3라운드 미팅','«미팅 수정»일 때만 «미팅 보기»로');
});

test('발표 화면 — 위쪽 막대 두 줄을 걷고 «나가기» · 흰 운동장 메모를 읽히게',()=>{
  const c=L.VIEW_CSS;
  assert.match(c,/body\.focus-board #vCreateBar\{display:none!important\}/);
  assert.match(c,/body\.focus-board\.vcreating #boardView\{padding-top:0!important\}/,'막대 자리(56px)를 운동장에');
  assert.match(c,/html body #meetNav button\.mn-exit\{background:var\(--panel,#fff\)!important;[^}]*color:#c42b1c!important\}/,'흰 판 위 빨간 글자');
  assert.match(c,/body\.fmdark #meetNav button\.mn-exit\{color:#ff8a80!important/);
  assert.match(c,/html\[data-pitch="white"\] body\.focus-board #ksOv li/,'흰 운동장 · 발표에서만 어두운 메모');
  assert.match(c,/html\[data-pitch="train"\] body\.focus-board #ksOv li/);
  // board.html 의 옛 «나가기» 규칙(#id .class)을 이긴다 — #meetNav button.mn-exit 앞에 html body
  assert.ok(read('studio/board.html').includes('#meetNav .mn-exit{width:auto;padding:0 16px;background:rgba(255,90,80,.16)!important;'),'옛 규칙은 그대로(이 모듈이 덮는다)');
  const t=TB.css();
  assert.ok(t.includes('html.ps-page-board body.focus-board #boardPageStrip'+[0,1,2,3,4,5,6,7,8,9].map(i=>':not(#tb'+i+')').join('').repeat(2)+'{display:none!important}'),
    '페이지 띠 — 띠 규칙(id 11개)보다 센 선택자');
});

test('board.html 은 그대로 — 이 모듈은 이미 읽힌다 · 크기 예산',()=>{
  const b=read('studio/board.html');
  assert.ok(b.includes('<script src="board-meet-look.js"></script>'));
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
  const r=read('studio/release-notes.js');
  assert.match(r,/v3\.130 · 미팅 «큰 화면으로 보기»/);
});
