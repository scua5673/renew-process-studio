const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.002 — 커뮤니티 상세: 훈련이 둘 이상인 코치 글도 훈련을 골라 본다.
   읽기 전용 뷰어(작전판)는 커뮤니티에서 훈련 탭 줄을 감춘다(body.comm-viewing #trainingStrip) — 그래서 훈련이 여럿인 글은 첫 훈련만 보였다.
   2.999 가 프로세스 세션에 넣은 «훈련 고르기 줄»(뷰어 머리 아래 · 고를 때마다 그 훈련 하나만 실은 글로 뷰어를 새로 연다)을 코치 글에도 쓴다.
   담기·신고·삭제는 글 번호로 가므로 어느 훈련을 보고 있든 글 전체에 닿는다. */
const comm=fs.readFileSync(path.join(__dirname,'..','studio','community.html'),'utf8');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const VIEW=cut(comm,'var procCv=null;\n','/* «보관함에 담기» — 레터의 단추와 같은 주소를 셸에 건넨다.');

// 뷰어를 여는 자리만 흉내 낸다 — 열린 글과 훈련 칸을 적어 둔다
function harness(){
  const opened=[],box={hidden:true,innerHTML:'',children:[],appendChild(b){this.children.push(b);}};
  const mk=()=>({type:'',attrs:{},innerHTML:'',onclick:null,setAttribute(k,v){this.attrs[k]=v;},scrollIntoView(){}});
  const c=vm.createContext({opened,box,
    $:id=>id==='prCvTabs'?box:null,
    esc:s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
    document:{createElement:mk},
    openCommunityViewer:(post,fallback)=>{opened.push({post:JSON.parse(JSON.stringify(post)),fallback:fallback&&fallback.id});}});
  vm.runInContext(VIEW+';this.api={procViewOpen,procViewPost,state:function(){return procCv;}};',c);
  const tabs=()=>{ box.children=[]; c.api.state()&&vm.runInContext('procViewTabs()',c); return box.children; };
  return {api:c.api,opened,box,tabs,run:code=>vm.runInContext(code,c)};
}
const snap=k=>({players:[{id:1,team:'blue',num:String(k),x:100+k,y:200}],equipment:[],drawings:[]});
const frames=(k,n)=>Array.from({length:n},(_,s)=>({snap:snap(k*10+s),hold:.6,dur:1}));
const coach=over=>Object.assign({id:'C1',owner:'u-coach',owner_name:'가상코치',title:'가상 코치 글',cat:'rondo',age:'U12',summary:'요약',thumb:'<svg></svg>',
  item:{name:'가상 코치 글',type:'train',focus:'bp',rpe:6,sets:2,tags:['가상'],overview:'카드의 글',snap:snap(0),
    trainings:[{name:'코치 훈련 A',minutes:10,method:'A 방법',snap:snap(1)},{name:'코치 훈련 B',method:'B 방법',snap:snap(2),frames:frames(2,3)},{name:'',minutes:'x',snap:snap(3),frames:frames(3,1)}]}},over||{});

test('a coach post with several trainings opens one training at a time, and each keeps its own board, text and scenes',()=>{
  const h=harness(),p=coach();
  h.api.procViewOpen(p,{mine:true});
  assert.equal(h.opened.length,1);
  const first=h.opened[0].post;
  assert.deepEqual([first.id,first.title,first.owner_name,first.cat,first.age,first.summary,first.mine,first.proc,first.procN],['C1','가상 코치 글','가상코치','rondo','U12','요약',true,undefined,undefined],'코치 글의 얼굴은 그대로 — 내 글 표시도');
  assert.deepEqual([first.item.name,first.item.minutes,first.item.trainings.length,first.item.trainings[0].method,'frames' in first.item],['코치 훈련 A',10,1,'A 방법',false]);
  assert.deepEqual([first.item.type,first.item.focus,first.item.rpe,first.item.sets,plain(first.item.tags)],['train','bp',6,2,['가상']]);
  assert.equal('overview' in first.item,false,'카드의 글은 넘기지 않는다 — 글은 훈련의 것');
  assert.deepEqual(first.item.snap,snap(1));
  const second=plain(h.api.procViewPost(1)),third=plain(h.api.procViewPost(2));
  assert.deepEqual([second.item.name,second.item.frames.length,second.item.snap,'minutes' in second.item],['코치 훈련 B',3,snap(2),false],'둘째 훈련의 장면');
  assert.deepEqual([third.item.name,'frames' in third.item],['훈련 3',false],'이름이 비면 «훈련 N» · 장면 하나는 애니메이션이 아니다');
  assert.equal(h.opened[0].fallback,'C1','뷰어가 못 열리면 그 글의 상세로');
});

test('the picker shows every training, and choosing one opens that training in a fresh viewer',()=>{
  const h=harness(),p=coach();
  h.api.procViewOpen(p,{mine:false});
  let tabs=h.tabs();
  assert.equal(h.box.hidden,false);
  assert.deepEqual(tabs.map(b=>[b.attrs['aria-pressed'],b.innerHTML]),[
    ['true','<span class="pr-i">1</span><span class="pr-nm">코치 훈련 A</span><span class="pr-mn">10분</span>'],
    ['false','<span class="pr-i">2</span><span class="pr-nm">코치 훈련 B</span>'],
    ['false','<span class="pr-i">3</span><span class="pr-nm">훈련 3</span>']],'분이 없는 훈련은 분을 적지 않는다');
  tabs[0].onclick();
  assert.equal(h.opened.length,1,'보고 있는 훈련을 다시 눌러도 다시 열지 않는다');
  tabs[1].onclick();
  assert.equal(h.opened.length,2);
  assert.deepEqual([h.opened[1].post.item.name,h.opened[1].post.mine,h.api.state().k],['코치 훈련 B',false,1]);
  assert.deepEqual(h.tabs().map(b=>b.attrs['aria-pressed']),['false','true','false']);
  const evil=coach(); evil.item.trainings[0].name='<img src=x onerror=hit()>';
  h.api.procViewOpen(evil,{});
  assert.equal(h.tabs()[0].innerHTML.includes('<img'),false,'훈련 이름은 글자로만');
});

test('an old card keeps its animation on the first training — the same rule the board uses',()=>{
  const h=harness();
  const old=coach(); old.item.frames=frames(9,4); old.item.trainings.forEach(t=>{ delete t.frames; });
  h.api.procViewOpen(old,{});
  assert.equal(plain(h.api.procViewPost(0)).item.frames.length,4,'애니메이션이 카드에만 있으면 첫 훈련에');
  assert.equal('frames' in plain(h.api.procViewPost(1)).item,false,'다른 훈련에는 얹지 않는다');
  const mixed=coach(); mixed.item.frames=frames(9,4);
  h.api.procViewOpen(mixed,{});
  assert.equal('frames' in plain(h.api.procViewPost(0)).item,false,'훈련 가운데 하나라도 제 장면이 있으면 카드의 것은 쓰지 않는다');
  assert.equal(plain(h.api.procViewPost(1)).item.frames.length,3);
  assert.match(board,/function _trainAdoptCardFrames\(list,frames,at\)\{try\{ if\(!Array\.isArray\(list\)\|\|!list\.length\|\|!Array\.isArray\(frames\)\|\|frames\.length<2\)return; if\(list\.some\(function\(t\)\{return t&&Array\.isArray\(t\.frames\)&&t\.frames\.length>1;\}\)\)return;/,'작전판의 규칙이 바뀌면 여기도 같이');
});

test('a process session still opens the same way, and only posts with two or more trainings get the picker',()=>{
  const h=harness();
  const proc={id:'proc-03',proc:true,title:'가상 세션',owner_name:'프로세스',item:{name:'레터 3호',type:'train',focus:'bpo',trainings:[{name:'연습 1',minutes:15,snap:snap(1),frames:frames(1,3)},{name:'연습 2',minutes:20,snap:snap(2)}]}};
  h.api.procViewOpen(proc);
  const post=h.opened[0].post;
  assert.deepEqual([post.proc,post.procN,post.mine,post.cat,post.item.name,post.item.frames.length],[true,2,false,'','연습 1',3]);
  assert.match(comm,/if\(p\.proc\|\|\(Array\.isArray\(p\.item\.trainings\)&&p\.item\.trainings\.length>1\)\)\{procViewOpen\(p,post\);return;\}\n    if\(boardPagesOf\(p\.item\)\.length>1\)\{boardViewOpen\(p,post\);return;\}[^\n]*\n    openCommunityViewer\(post,p\);/,'훈련이 하나인 글은 전처럼 바로 연다(3.038 — 여러 페이지 작전판만 페이지 고르기 줄로)');
  assert.match(board,/body\.comm-viewing #trainingStrip,/,'뷰어가 훈련 탭 줄을 감추는 동안에는 이 줄이 필요하다');
  assert.match(comm,/\.pr-cvtabs\{display:grid;grid-auto-flow:column;grid-auto-columns:minmax\(96px,1fr\);gap:6px;padding:6px 10px;overflow-x:auto\}/,'폰: 훈련이 많으면 칸 폭을 지키고 옆으로 민다');
});
