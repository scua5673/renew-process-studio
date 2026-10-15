const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.039(3.038 로 준비했다가 #407 이 먼저 3.038 을 써서 판을 올렸다) — 커뮤니티에 작전판을 작전판으로(사용자 «엘미하 페이지 작전판으로 업로드 할 수 있게» · 박수빈 코치 «지금은 '훈련'으로만 업로드가 가능한 것 같아서요!
   작전판을 업로드해도 빈 작전판으로 열리더라구요»).
   · 올리기가 작전판의 pages 를 버려 첫 페이지 판만 올라갔고, 최상위 frames 는 저장할 때 보던 페이지의 장면이라 판과 장면이 다른 페이지였다.
   · 올리기 목록은 작전판도 «기술·개인»(훈련 국면 기본값)으로 적었다.
   · 뷰어 · 담기는 «커뮤니티 훈련» · 한 장짜리로만 다뤘고, 엘미하 칸에서 연 글을 담으면 원본 없는 코치 자료 쪽 객체를 집어 빈 카드를 담았다.
   브라우저 흐름은 tests/browser/community-board.mjs 가 본다. */
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const comm=R('studio/community.html'),board=R('studio/board.html');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>=0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const STRIP=cut(comm,'var __pubNames=[];','function openUpload(){');
const VIEW=cut(comm,'var procCv=null;\n','/* «보관함에 담기» — 레터의 단추와 같은 주소를 셸에 건넨다.');
const KIND=cut(comm,'var FOCUS=[','/* ── 커뮤니티 분류')+cut(comm,'/* 3.039 — 올리기 목록의 종류','function buildUpload(');
function strip(){ const c=vm.createContext({}); vm.runInContext(STRIP+';this.api={stripPages,boardLead,names:function(){return __pubNames;}};',c); return c.api; }

const P=(id,num,name,team)=>({id,team:team||'blue',num:String(num),name:name||'',x:100+id,y:200,...(team==='img'?{src:'data:image/png;base64,AAAA'}:{})});
const snap=players=>({pitchSpec:'fifa',players,customImages:[{src:'data:image/png;base64,BBBB'}],equipment:[],drawings:[]});
const frames=(players,n)=>Array.from({length:n},(_,s)=>({snap:snap(players),hold:.6,dur:1+s,cap:'움직임 '+s,thumb:'<svg><text>김가상</text></svg>'}));
const boardItem=()=>({type:'board',name:'가상 작전판',snap:snap([P(1,7,'김가상')]),frames:frames([P(31,10)],3),
  pages:[{name:'공격',snap:snap([P(1,7,'김가상'),P(2,'','','img')]),thumb:'<svg><text>김가상</text></svg>',vlink:{libId:'V1'},anim:{frames:frames([P(1,7,'김가상')],3),active:1,hold:.8,title:'가상 제목'},grp:'빌드업'},
    {name:'',snap:snap([P(21,9,'이둘째')]),thumb:'',anim:{frames:frames([P(21,9)],1),active:0}},
    null,{name:'옛 모양',snap:snap([P(31,10)]),anim:frames([P(31,10,'박셋째')],2)},{name:'판 없음'}]});

test('3.039 every page of a board goes up, each cleaned like a training (names, photos, pictures, my vault link)',()=>{
  const g=strip(),out=plain(g.stripPages(boardItem())),json=JSON.stringify(out);
  for(const bad of ['김가상','이둘째','박셋째','data:image','AAAA','BBBB','vlink'])assert.equal(json.includes(bad),false,'올라가는 페이지에 «'+bad+'» 가 없다');
  assert.deepEqual(out.map(p=>p.name),['공격','','옛 모양'],'판이 없는 페이지 · 빈 칸은 버린다');
  assert.deepEqual(out.map(p=>p.thumb),['','',''],'페이지 그림은 비운다(뷰어가 판에서 다시 그린다 · 용량)');
  assert.deepEqual([out[0].grp,out[0].anim.active,out[0].anim.hold,out[0].anim.title,out[0].anim.frames.length],['빌드업',1,.8,'가상 제목',3],'페이지 · 애니메이션의 다른 칸은 그대로');
  assert.deepEqual(out[0].anim.frames.map(f=>[f.dur,f.cap,f.thumb]),[[1,'움직임 0',''],[2,'움직임 1',''],[3,'움직임 2','']]);
  assert.deepEqual(out[0].snap.players.map(p=>[p.team,p.num,p.name,'src' in p]),[['blue','7','',false],['blue','','',false]],'번호는 남고 이름 · 사진만 빠진다');
  assert.equal('anim' in out[1],false,'장면 하나는 애니메이션이 아니다');
  assert.deepEqual(Object.keys(out[2].anim),['frames'],'옛 모양(장면 배열)은 {frames} 로');
  assert.deepEqual(plain(g.names()).sort(),['김가상','박셋째','이둘째'].sort(),'지운 이름은 카드 그림에서도 지운다(stripThumbNames)');
});

test('3.039 only boards carry pages — trainings and empty pages give nothing',()=>{
  const g=strip();
  assert.equal(g.stripPages({type:'train',pages:[{snap:snap([])}]}),null);
  assert.equal(g.stripPages({type:'board'}),null);
  assert.equal(g.stripPages({type:'board',pages:[]}),null);
  assert.equal(g.stripPages({type:'board',pages:[null,{name:'판 없음'}]}),null);
  assert.equal(g.stripPages(null),null);
});

test('3.039 the post leads with page 1 — its board and its scenes (not the page that was open when saved)',()=>{
  const g=strip(),it=boardItem();it.pages=g.stripPages(it);g.boardLead(it);
  assert.deepEqual([it.snap.players.map(p=>p.num).join(','),it.frames.length,it.frames[0].snap.players[0].num],['7,',3,'7'],'예전에는 판은 페이지 1 · 장면은 다른 페이지(10번)였다');
  const one={type:'board',snap:snap([]),frames:frames([P(1,7)],2),pages:[{name:'',snap:snap([P(1,9)])}]};
  g.boardLead(one);
  assert.deepEqual([one.snap.players[0].num,'frames' in one],['9',false],'첫 페이지에 장면이 없으면 대표 장면도 없다');
  const train={type:'train',snap:snap([P(1,8)]),frames:frames([P(1,8)],2)};
  assert.deepEqual(plain(g.boardLead(train)),plain({type:'train',snap:snap([P(1,8)]),frames:frames([P(1,8)],2)}),'페이지가 없으면 그대로');
});

test('3.039 the upload, the edit sync and the copy all keep pages',()=>{
  assert.match(comm,/var COPY_FIELDS=\[[^\]]*'warmFor',\n  'pages','book','slides'\];/,'담기는 페이지 · 패턴북 표식까지(3.042 — 미팅 자료의 슬라이드도)');
  const up=cut(comm,"$('upGo').onclick=function(){",'var payload=JSON.stringify(body);');
  assert.match(up,/var _frUp=stripFrames\(item\.frames\); if\(_frUp\)item\.frames=_frUp; else delete item\.frames;\n      var _pgUp=stripPages\(sel\); if\(_pgUp\)\{item\.pages=_pgUp;boardLead\(item\);\} else delete item\.pages;/,'COPY_FIELDS 가 실은 날 페이지는 정리한 것으로 바꾼다');
  assert.match(comm,/var _pgU=stripPages\(src\); if\(_pgU\)\{item\.pages=_pgU;boardLead\(item\);\} else delete item\.pages;   \/\* 3\.039 \*\/\n(?:[^\n]*\n)?    var patch=\{item:item\};/,'뷰어의 글 고치기도 같은 정리');
  assert.match(comm,/\(item\.pages\?'페이지나 장면 수를':(?:item\.slides\?'슬라이드나 장면 수를':)?'장면 수를'\)\+' 줄여보세요'/,'용량을 넘으면 작전판은 페이지 · 장면을 줄이라고 말한다(3.041 — 한도 5MB · 크기를 적는다)');
});

test('3.039 the upload list says what each item is — a board is not «기술·개인»',()=>{
  const c=vm.createContext({});vm.runInContext(KIND+';this.api={upKindOf,upKindName,upMetaOf};',c);const k=c.api;
  const rows=[{type:'board',pages:[{},{},{}]},{type:'board',book:1,pages:[{},{}]},{type:'board',frames:[{},{},{}]},{type:'board'},{type:'train',focus:'tech',minutes:15},{type:'setpiece',focus:'set',minutes:10},{focus:'warm'}];
  assert.deepEqual(rows.map(d=>[k.upKindOf(d),k.upKindName(d),k.upMetaOf(d)]),[
    ['board','작전판','페이지 3'],['board','패턴북','시퀀스 2'],['board','작전판','장면 3'],['board','작전판',''],
    ['train','훈련',"기술·개인 · 15'"],['train','세트피스',"10'"],['train','훈련','웜업']]);
  const sheet=cut(comm,'function buildUpload(me,handle,flowEpoch){',"$('upCancel').onclick");
  assert.match(sheet,/var kind=\(elmUp&&nBoard\)\?'board':'all';/,'엘미하 칸에서 열면 작전판부터');
  assert.match(sheet,/if\(_pre0&&kind!=='all'&&!lib\.some\(function\(d\)\{return d\.libId===_pre0&&upKindOf\(d\)===kind;\}\)\)kind='all';/,'고른 채 들어온 항목은 가리지 않는다');
  assert.match(sheet,/\(\(nKinds>1\)\?'<div class="agechips up-kind" id="upKind" role="group" aria-label="자료 종류"><\/div>':''\)/,'종류가 둘 이상 있을 때만 고르는 줄');
  assert.match(sheet,/\[\['all','전체 '\+lib\.length\],\['board','작전판 '\+nBoard\],\['train','훈련 '\+nTrain\],\['meeting','미팅 '\+nMeet\]\]/);
  assert.match(sheet,/<span>올릴 자료<\/span>/);
  assert.match(sheet,/내 보관함에서 작전판이나 훈련을 골라 모든 코치에게 공유합니다/);
});

test('3.039 a preselected item survives opening the sheet (vault «커뮤니티에 올리기» · after «새로 만들기»)',()=>{
  /* 새 흐름이 앞 흐름을 닫으며 __upPreselect 를 지워, 보관함에서 고른 항목이 고르지 않은 채 열렸다 */
  assert.match(comm,/var pre=window\.__upPreselect\|\|null;\n  var flowEpoch=communityLibraryBeginFlow\(\);\n  window\.__upPreselect=pre;/);
  assert.match(cut(comm,'function communityLibraryCloseFlow(){','function communityLibraryBeginFlow(){'),/window\.__upPreselect=null;/,'닫을 때는 그대로 지운다(다음에 손으로 연 올리기에 남지 않게)');
});

test('3.039 copying from the viewer uses the post object that holds the original',()=>{
  const fn=cut(comm,'window.__commAction=function(act,id,extra){',"if(act==='update'){");
  assert.match(fn,/else if\(!p\.item\)\{ var pe=elmFind\(id\); if\(pe&&pe\.item\)p=pe; \}/,'엘미하 칸에서 연 글 — 원본은 엘미하 목록의 객체에');
  assert.match(comm,/if\(act==='copy'\)\{ if\(p\.item\)copyToLib\(p,null\); else copyPreviewPost\(p,null\); \}/,'원본이 없으면 받아서 담는다(빈 카드를 담지 않는다)');
  const cp=cut(comm,'function copyPreviewPost(p,btn){','/* ── 상세 ── */');
  assert.match(cp,/if\(btn\)\{btn\.disabled=true;btn\.textContent='내용 확인 중…';\}/,'단추 없이 불러도 된다');
  assert.doesNotMatch(cp.replace(/if\(btn\)\{[^}]*\}/g,'').replace(/if\(btn\)btn\.\w+=[^;]*;/g,''),/btn\.(disabled|textContent)/,'btn 은 늘 확인하고 쓴다');
});

/* 뷰어 — 3.002 의 훈련 고르기 줄을 흉내 내는 harness 와 같은 모양 */
function harness(){
  const opened=[],box={hidden:true,innerHTML:'',children:[],attrs:{},setAttribute(k,v){this.attrs[k]=v;},appendChild(b){this.children.push(b);}};
  const mk=()=>({attrs:{},innerHTML:'',onclick:null,setAttribute(k,v){this.attrs[k]=v;},scrollIntoView(){}});
  const c=vm.createContext({opened,box,$:id=>id==='prCvTabs'?box:null,
    esc:s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
    document:{createElement:mk},openCommunityViewer:(post,fallback)=>{opened.push({post:plain(post),fallback:fallback&&fallback.id});}});
  vm.runInContext(VIEW+';this.api={boardViewOpen,procViewPost,boardPagesOf,state:function(){return procCv;}};',c);
  const tabs=()=>{ box.children=[]; vm.runInContext('procViewTabs()',c); return box.children; };
  return {api:c.api,opened,box,tabs};
}
const post=over=>Object.assign({id:'Cb1',owner:'u-elm',owner_name:'엘미하',title:'가상 전술노트',cat:'attack',age:'성인',summary:'',thumb:'<svg/>',
  item:{type:'board',name:'가상 전술노트',overview:'가상 설명',tags:['가상'],snap:snap([P(1,7)]),frames:frames([P(1,7)],3),
    pages:[{name:'공격 형태',snap:snap([P(1,7)]),anim:{frames:frames([P(1,7)],3)}},{name:'',snap:snap([P(2,9)])},{name:'수비 블록',snap:snap([P(3,10)]),anim:frames([P(3,10)],2)}]}},over||{});

test('3.039 a board with several pages opens one page at a time — that page’s board and scenes, the post’s description',()=>{
  const h=harness(),p=post();
  h.api.boardViewOpen(p,{mine:true});
  assert.equal(h.opened.length,1);
  const first=h.opened[0].post;
  assert.deepEqual([first.id,first.title,first.owner_name,first.mine,first.pageN,first.thumb],['Cb1','가상 전술노트','엘미하',true,3,'<svg/>']);
  assert.deepEqual([first.item.type,first.item.name,first.item.overview,first.item.frames.length,first.item.snap.players[0].num],['board','공격 형태','가상 설명',3,'7']);
  const second=plain(h.api.procViewPost(1)),third=plain(h.api.procViewPost(2));
  assert.deepEqual([second.item.name,'frames' in second.item,second.item.snap.players[0].num,second.thumb],['페이지 2',false,'9',''],'이름이 비면 «페이지 N» · 장면이 없으면 판 하나');
  assert.deepEqual([third.item.name,third.item.frames.length,third.item.snap.players[0].num],['수비 블록',2,'10'],'옛 모양(장면 배열)도');
  assert.equal(h.opened[0].fallback,'Cb1');
});

test('3.039 the page picker sits where the training picker does, and says pages',()=>{
  const h=harness();
  h.api.boardViewOpen(post(),{});
  const tabs=h.tabs();
  assert.deepEqual([h.box.hidden,h.box.attrs['aria-label']],[false,'이 작전판의 페이지']);
  assert.deepEqual(tabs.map(b=>[b.attrs['aria-pressed'],b.innerHTML]),[
    ['true','<span class="pr-i">1</span><span class="pr-nm">공격 형태</span><span class="pr-mn">장면 3</span>'],
    ['false','<span class="pr-i">2</span><span class="pr-nm">페이지 2</span>'],
    ['false','<span class="pr-i">3</span><span class="pr-nm">수비 블록</span><span class="pr-mn">장면 2</span>']]);
  tabs[2].onclick();
  assert.deepEqual([h.opened.length,h.opened[1].post.item.name,h.api.state().k],[2,'수비 블록',2],'고르면 그 페이지로 뷰어를 새로 연다');
  const book=harness(),bp=post();bp.item.book=1;
  book.api.boardViewOpen(bp,{});
  assert.deepEqual([book.tabs()[1].innerHTML,book.opened[0].post.item.book],['<span class="pr-i">2</span><span class="pr-nm">시퀀스 2</span>',1],'패턴북은 시퀀스');
  assert.deepEqual(plain(h.api.boardPagesOf({type:'train',pages:[{snap:{}}]})),[],'훈련 글은 페이지 줄이 없다');
  assert.match(comm,/if\(boardPagesOf\(p\.item\)\.length>1\|\|\(p\.item\.type==='meeting'&&boardPagesOf\(p\.item\)\.length\)\)\{boardViewOpen\(p,post\);return;\}/,'한 페이지 작전판은 전처럼 바로 연다(3.042 — 미팅 자료만 한 장이어도 이 길)');
  assert.match(comm,/if\(boardPagesOf\(d\)\.some\(function\(pg\)\{ return hasBoardData\(pg\.snap\)\|\|/,'첫 페이지가 비어도 다른 페이지에 그림이 있으면 연다');
});

test('3.039 the read-only viewer calls a board a board',()=>{
  const v=cut(board,'window.__commView=function(post, editMode){','window.__commPrepView=function(){');
  assert.match(v,/var _commBoard=\(d\.type==="board"\);\n    \$\("modalTitle"\)\.textContent=editMode\?"커뮤니티 글 편집":\(_commBoard\?\("커뮤니티 "\+\(d\.kindLabel\|\|"작전판"\)\):"커뮤니티 훈련"\);/,'3.042 — 미팅 자료는 «커뮤니티 미팅 자료»');
  assert.match(v,/'<b>'\+\(_commBoard\?\('커뮤니티 '\+\(d\.kindLabel\|\|'작전판'\)\):'커뮤니티 훈련'\)\+'<\/b> — '\+who\+'님이 공유했어요'\+\(\(_commBoard&&post\.pageN>1\)\?\(' · '\+\(d\.unit\|\|\(d\.book\?'시퀀스 ':'페이지 '\)\)\+post\.pageN\+\(d\.kindLabel\?'장':'개'\)\):''\)\+' · 보기 전용'/);
  assert.match(v,/if\(_commBoard&&lt==="훈련 방법"\)lt="설명";/,'작전판의 설명이 «훈련 방법» 칸에 실린다 — 이름은 «설명»');
  assert.match(v,/if\(_commBoard\)\{ try\{ var _nm=document\.getElementById\("epRoNoMemo"\); if\(_nm\)_nm\.textContent="작성된 설명이 없습니다\.";/);
});

test('3.039 release note and cache',()=>{
  const notes=require('../studio/release-notes.js');
  const e=notes.entries().find(x=>x.id==='2026-10-15-v3-039-community-board-upload');assert.ok(e,'3.039 안내');
  assert.match(e.title,/v3\.039/);
  assert.match(e.changes.join(' '),/작전판/);
  const cache=(R('sw.js').match(/^const CACHE = 'process-(3\.\d{3})';/m)||[])[1],build=(R('studio/app.html').match(/window\.PS_BUILD='(3\.\d{3})'/)||[])[1];
  assert.equal(cache,build,'sw.js CACHE = app.html PS_BUILD');
  assert.ok(Number(build)>=3.039,'3.039 이 판을 올렸다 — 뒤 판도 지나간다');
  assert.match(R('tests/browser/run-critical.mjs'),/'community-elmiha','community-board'/,'브라우저 시험이 CI 묶음에 있다');
});
