const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.042 — 엘미하 칸에는 만든 것을 전부(사용자 «엘미하의 페이지는 훈련 주제 분류 필요없고 엘미하가 원하는거 올릴수 있게» · «만든거 원하는거 전부 올릴수 있게»).
   · 엘미하 칸은 훈련 주제 · 콘텐츠 유형 · 연령 · 인원으로 거르지도, 고르개를 보이지도 않는다.
   · 엘미하 칸의 올리기는 제목만 — 보관함의 분석 영상 말고 전부(훈련 · 세트피스 · 작전판 · 패턴북 · 미팅 자료 · 경기 분석).
   · 미팅 자료는 슬라이드 전부가 올라가고(stripSlides), 뷰어에서 슬라이드를 골라 본다(boardPagesOf · boardUnit).
   브라우저 흐름은 tests/browser/community-elmiha.mjs 가 본다. */
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const comm=R('studio/community.html'),board=R('studio/board.html');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>=0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const STRIP=cut(comm,'var __pubNames=[];','function openUpload(){');
const VIEW=cut(comm,'var procCv=null;\n','/* «보관함에 담기» — 레터의 단추와 같은 주소를 셸에 건넨다.');

const P=(id,num,name)=>({id,team:'blue',num:String(num),name:name||'',x:100+id,y:200});
const snap=players=>({pitchSpec:'fifa',players,customImages:[{src:'data:image/png;base64,BBBB'}],equipment:[],drawings:[]});
const frames=(players,n)=>Array.from({length:n},(_,s)=>({snap:snap(players),hold:.6,dur:1+s,thumb:'<svg><text>김가상</text></svg>'}));
const meeting=()=>({type:'meeting',name:'가상 미팅',snap:snap([P(1,7,'김가상')]),
  slides:[{title:'빌드업 원칙',points:['넓게 선다',' ','3인 연계'],snap:snap([P(1,7,'김가상')]),thumb:'<svg><text>김가상</text></svg>',frames:frames([P(1,7,'김가상')],3)},
    {title:'',points:[],snap:snap([P(2,9,'이둘째')]),frames:frames([P(2,9)],1)},
    {title:'판 없음'},null]});

test('3.042 a meeting goes up with every slide, each cleaned like a board page',()=>{
  const c=vm.createContext({}); vm.runInContext(STRIP+';this.api={stripSlides};',c);
  const out=plain(c.api.stripSlides(meeting())),json=JSON.stringify(out);
  for(const bad of ['김가상','이둘째','data:image','BBBB'])assert.equal(json.includes(bad),false,'올라가는 슬라이드에 «'+bad+'» 가 없다');
  assert.deepEqual(out.map(s=>s.title),['빌드업 원칙',''],'판이 없는 슬라이드 · 빈 칸은 버린다');
  assert.deepEqual(out.map(s=>s.thumb),['',''],'슬라이드 그림은 비운다');
  assert.deepEqual([out[0].frames.length,'frames' in out[1]],[3,false],'장면 하나는 애니메이션이 아니다');
  assert.deepEqual(out[0].points,['넓게 선다',' ','3인 연계'],'요점은 글이라 그대로');
  assert.equal(c.api.stripSlides({type:'board',slides:meeting().slides}),null,'미팅 자료만');
  assert.equal(c.api.stripSlides({type:'meeting',slides:[]}),null);
});

test('3.042 a meeting post opens slide by slide, with the slide points as its text',()=>{
  const opened=[],box={hidden:true,innerHTML:'',children:[],appendChild(b){this.children.push(b);}};
  const mk=()=>({attrs:{},innerHTML:'',setAttribute(k,v){this.attrs[k]=v;},scrollIntoView(){}});
  const c=vm.createContext({$:id=>id==='prCvTabs'?box:null,document:{createElement:mk},
    esc:s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>'&#'+ch.charCodeAt(0)+';'),
    openCommunityViewer:post=>opened.push(plain(post))});
  vm.runInContext(VIEW+';this.api={boardViewOpen,boardViewPost,boardPagesOf,boardUnit};',c);
  const p={id:'M1',title:'가상 미팅 글',owner_name:'엘미하',item:meeting()};
  assert.equal(c.api.boardPagesOf(p.item).length,2);
  assert.equal(c.api.boardUnit(p.item),'슬라이드 ');
  c.api.boardViewOpen(p,{mine:true});
  const first=opened[0];
  assert.deepEqual([first.item.type,first.item.kindLabel,first.item.unit,first.item.name,first.item.overview,first.item.frames.length,first.pageN,first.mine],
    ['board','미팅 자료','슬라이드 ','빌드업 원칙','넓게 선다\n3인 연계',3,2,true]);
  const second=plain(c.api.boardViewPost(1));
  assert.deepEqual([second.item.name,'frames' in second.item,'overview' in second.item],['슬라이드 2',false,false],'이름이 비면 «슬라이드 N»');
  assert.deepEqual(box.children.map(b=>b.innerHTML.includes('빌드업 원칙')),[true,false]);
  assert.match(comm,/\(p\.item\.type==='meeting'&&boardPagesOf\(p\.item\)\.length\)\)\{boardViewOpen\(p,post\);return;\}/,'슬라이드가 한 장인 미팅 자료도 슬라이드 줄로');
  assert.match(board,/"커뮤니티 "\+\(d\.kindLabel\|\|"작전판"\)/,'뷰어 제목이 «커뮤니티 미팅 자료»');
});

test('3.042 the elmiha tab neither filters nor shows the topic, type, age or players pickers',()=>{
  assert.match(comm,/if\(!elmTab\)\{   \/\* 3\.042/,'엘미하 칸 목록은 고르개로 거르지 않는다');
  assert.match(comm,/<div class="nav-sec pr-cat-sec">/);
  assert.match(comm,/html body\.pr-elm \.comm-nav \.pr-cat-sec:not\(#_\):not\(#__\),html body\.pr-elm \.comm-nav \.nav-sec:has\(#typeNav\):not\(#_\):not\(#__\)(,html body\.pr-fifa [^,{]+)*\{display:none!important\}/);   // 3.071 — 같은 규칙에 FIFA 칸 줄이 붙는다
  assert.match(comm,/html body\.pr-elm #commFiltSheet \.ps-fsheet-sec:has\(#cfsType\)[^{]*#commFiltSheet \.ps-fsheet-sec:has\(#cfsSel\):not\(#_\):not\(#__\)\{display:none!important\}/,'폰 «필터» 시트도 탐색만');
  assert.match(comm,/if\(!elm&&age&&age\.value\)n\+\+; if\(!elm&&pl&&pl\.value\)n\+\+;/,'필터 단추 숫자도 엘미하 칸에서는 탐색만');
  assert.match(comm,/body\.pr-elm \.comm-list \.filters #ageSel:not\(#_\):not\(#__\),[^{]*#plSel[^{]*#cfTypeSel:not\(#_\):not\(#__\)\{display:none!important\}/);
});

test('3.042 the elmiha upload takes anything but analysis video, with only a title',()=>{
  assert.match(comm,/return elmUp\?\(t!=='analysis'\):\(t==='train'\|\|t==='setpiece'\|\|t==='board'\);/,'코치 자료 올리기는 전처럼 훈련 · 세트피스 · 작전판');
  assert.match(comm,/\+\(elmUp\?'':'<div class="fld"><label>분류 \(여러 개 선택 가능\)<\/label>/,'엘미하는 분류 칸이 없다');
  assert.match(comm,/\+\(elmUp\?'':'<div class="fld"><label>연령대 \(여러 개 선택 가능\)<\/label>/,'엘미하는 연령 칸이 없다');
  assert.match(comm,/if\(!elmUp&&!selCats\.length\)\{toast\('분류를 하나 이상 골라주세요'\);return;\}/);
  assert.match(comm,/if\(item\.type==='match'\)item\.type='board';/,'경기 분석은 작전판으로 올라간다');
});
