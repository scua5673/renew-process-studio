const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.985 — 패턴북: 보관함에서 시퀀스별로 애니메이션을 만든다.
   패턴북 = 여러 페이지 작전판(type:"board") + book:1. 페이지 = 시퀀스, 단계 = 장면에 붙는 이름표(frame.sg · frame.sgn).
   장면 배열을 다시 짜지 않는다 — 이 칸을 모르는 옛 판은 여러 페이지 작전판으로 열고 한 애니메이션으로 그대로 재생한다. */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const c=vm.createContext({Object,Array,JSON,Number,Math,String});
vm.runInContext(cut('/* ══ 2.985 · 패턴북 순수 함수 ══','/* ══ 2.985 · 패턴북 순수 함수 끝 ══ */')
  +';this.api={BK_GROUPS,bkText,bkStagesOf,bkStageIndex,bkStageAt,bkStageSplit,bkStageMerge,bkStageRename,bkStageNote,bkFrameRemoved,bkFrameCopy,bkSeqName,bkCounts,bkCaption,bkStageShown,bkCapFrames,bkSeqsFromBoard};',c);
const B=c.api;
const snap=x=>({players:[{id:1,team:'blue',num:8,x,y:300}],equipment:[],drawings:[],ball:null});
const fr=(x,o)=>Object.assign({snap:snap(x),dur:1},o||{});
const stages=frames=>plain(B.bkStagesOf(frames)).map(s=>[s.name,s.from,s.to]);

test('a stage is a label on the scene where it starts — the first scene always starts one',()=>{
  assert.deepEqual(stages([]),[]);
  assert.deepEqual(stages([fr(1)]),[['단계 1',0,0]]);
  assert.deepEqual(stages([fr(1),fr(2),fr(3)]),[['단계 1',0,2]],'an undivided sequence is one stage');
  const f=[fr(1,{sg:'빌드업'}),fr(2),fr(3,{sg:'전진',sgn:'8번이 받는 순간 풀백이 출발'}),fr(4),fr(5,{sg:''})];
  assert.deepEqual(stages(f),[['빌드업',0,1],['전진',2,3],['단계 3',4,4]],'an empty label still starts a stage and is numbered');
  assert.equal(B.bkStagesOf(f)[1].note,'8번이 받는 순간 풀백이 출발');
  assert.deepEqual(plain(B.bkStageIndex(f).of),[0,0,1,1,2]);
  assert.equal(B.bkStageAt(f,3),1); assert.equal(B.bkStageAt([],0),-1);
});

test('split · merge · rename · note change labels only — the scene array keeps its length and order',()=>{
  const f=[fr(1),fr(2),fr(3),fr(4)],xs=()=>f.map(q=>q.snap.players[0].x);
  assert.equal(B.bkStageSplit(f,0,'x'),false,'the first scene already starts a stage');
  assert.equal(B.bkStageSplit(f,2,'  전진   라인  '),true);
  assert.equal(f[2].sg,'전진 라인','whitespace is collapsed');
  assert.equal(B.bkStageSplit(f,2,'또'),false,'a scene that already starts a stage cannot be split again');
  assert.equal(B.bkStageSplit(f,9,'x'),false);
  assert.deepEqual(stages(f),[['단계 1',0,1],['전진 라인',2,3]]);
  assert.equal(B.bkStageRename(f,0,'빌드업'),true); assert.equal(f[0].sg,'빌드업');
  assert.equal(B.bkStageNote(f,1,'풀백이 출발'),true); assert.equal(f[2].sgn,'풀백이 출발');
  assert.equal(B.bkStageNote(f,1,'   '),true); assert.equal('sgn' in f[2],false,'an empty note removes the field');
  assert.equal(B.bkStageMerge(f,0),false,'there is nothing in front of the first stage');
  assert.equal(B.bkStageMerge(f,1),true);
  assert.deepEqual(stages(f),[['빌드업',0,3]]); assert.equal('sg' in f[2],false);
  assert.deepEqual(xs(),[1,2,3,4]); assert.equal(f.length,4);
  /* 이름 없는 한 단계에 핵심 한 줄만 적어도 저장된다(이름표 칸이 생긴다) */
  const g=[fr(1),fr(2)]; B.bkStageNote(g,0,'첫 패스는 앞으로'); assert.equal(g[0].sg,''); assert.equal(g[0].sgn,'첫 패스는 앞으로');
  assert.equal(B.bkStageRename(g,5,'x'),false);
});

test('deleting the scene that starts a stage hands the label to the next scene; copies carry none',()=>{
  const f=[fr(1,{sg:'빌드업'}),fr(2),fr(3,{sg:'전진',sgn:'메모'}),fr(4),fr(5,{sg:'마무리'})];
  assert.equal(B.bkFrameRemoved(f[2],f[3]),true); assert.equal(f[3].sg,'전진'); assert.equal(f[3].sgn,'메모');
  assert.equal(B.bkFrameRemoved(f[3],f[4]),false,'the next scene already starts another stage — that stage stays');
  assert.equal(f[4].sg,'마무리');
  assert.equal(B.bkFrameRemoved(f[1],f[2]),false,'a scene in the middle of a stage has no label to hand over');
  assert.equal(B.bkFrameRemoved(f[4],undefined),false);
  const copy=B.bkFrameCopy(plain(f[2])); assert.equal('sg' in copy,false); assert.equal('sgn' in copy,false); assert.equal(copy.snap.players[0].x,3);
  assert.equal(f[2].sg,'전진','the original keeps its label');
});

test('counts and captions say sequence · stage — caption, and skip what is empty',()=>{
  const pages=[{name:'빌드업 A',snap:snap(1),anim:{frames:[fr(1,{sg:'빌드업'}),fr(2),fr(3,{sg:'전진',cap:'라인 사이의 8번에게'}),fr(4)]}},{name:'',snap:snap(9)},{name:'코너킥',snap:snap(5),anim:{frames:[fr(5),fr(6),fr(7)]}}];
  assert.deepEqual(plain(B.bkCounts(pages)),{seq:3,stage:4,scene:8},'a page without scenes counts as one stage, one scene');
  assert.deepEqual(plain(B.bkCounts(null)),{seq:0,stage:0,scene:0});
  assert.equal(B.bkSeqName(pages[1],1),'시퀀스 2'); assert.equal(B.bkSeqName(pages[0],0),'빌드업 A');
  assert.equal(B.bkCaption('빌드업 A','전진','라인 사이로'),'빌드업 A · 전진 — 라인 사이로');
  assert.equal(B.bkCaption('','전진','라인 사이로'),'전진 — 라인 사이로');
  assert.equal(B.bkCaption('빌드업 A','',''),'빌드업 A'); assert.equal(B.bkCaption('','','자막만'),'자막만'); assert.equal(B.bkCaption('','',''),'');
  const caps=plain(B.bkCapFrames(pages[0].anim.frames,'빌드업 A')).map(f=>f.cap);
  assert.deepEqual(caps,['빌드업 A · 빌드업','빌드업 A · 빌드업','빌드업 A · 전진 — 라인 사이의 8번에게','빌드업 A · 전진']);
  assert.equal(pages[0].anim.frames[0].cap,undefined,'the export copy leaves the scenes untouched');
  assert.equal(pages[0].anim.frames[2].cap,'라인 사이의 8번에게');
  /* 안 나눈 시퀀스에 «단계 1»을 장면마다 띄우지 않는다 */
  assert.deepEqual(plain(B.bkCapFrames(pages[2].anim.frames,'코너킥')).map(f=>f.cap),['코너킥','코너킥','코너킥']);
  assert.equal(B.bkStageShown(B.bkStageIndex(pages[2].anim.frames)),false);
  assert.equal(B.bkStageShown(B.bkStageIndex([fr(1,{sg:'준비'}),fr(2)])),true,'one named stage is worth saying');
});

test('an existing board comes in as sequences — a deep copy, the source is left as it was',()=>{
  const board={libId:'B1',type:'board',name:'기존 작전판',snap:snap(100),frames:[fr(100),fr(400)],
    pages:[{name:'빌드업 B',grp:'공격 조직',snap:snap(100),thumb:'<svg a/>',anim:{frames:[fr(100),fr(400)],active:1,hold:.8,title:'',titleColor:''}},{name:'',snap:snap(700),thumb:''},null,{name:'판 없음'}]};
  const before=JSON.stringify(board),seqs=plain(B.bkSeqsFromBoard(board));
  assert.deepEqual(seqs.map(q=>q.name),['빌드업 B','기존 작전판 2'],'a nameless page takes the board name and its number');
  assert.equal(seqs[0].grp,'공격 조직'); assert.equal(seqs[0].anim.frames.length,2); assert.equal(seqs[1].anim,null,'a page without scenes brings no animation');
  seqs[0].anim.frames[0].snap.players[0].x=-1; seqs[0].snap.players[0].x=-1;
  assert.equal(JSON.stringify(board),before,'the source board is untouched');
  /* 한 페이지짜리(옛 모양: snap + frames) */
  const one=plain(B.bkSeqsFromBoard({name:'압박 유도',snap:snap(5),frames:[Object.assign(fr(5),{__hold:1.2,__t:'제목',__tc:'#123456'}),fr(6)]}));
  assert.equal(one.length,1); assert.equal(one[0].name,'압박 유도'); assert.deepEqual([one[0].anim.frames.length,one[0].anim.hold,one[0].anim.title,one[0].anim.titleColor],[2,1.2,'제목','#123456']);
  /* 작업 보드(이름 없음) — 이름은 비워 둔다: 화면이 «시퀀스 n»으로 부르고 코치가 이름을 붙인다 */
  assert.equal(plain(B.bkSeqsFromBoard({name:'',snap:snap(1)}))[0].name,'');
  assert.deepEqual(plain(B.bkSeqsFromBoard({})),[]); assert.deepEqual(plain(B.bkSeqsFromBoard(null)),[]);
});

test('wiring — a pattern book is stored as a multi-page board, and the board itself is the editor',()=>{
  /* 저장 모양: type 은 board, 표식 하나만 더한다 */
  assert.match(src,/if\(pend\.book\)item\.book=1;/);
  assert.match(src,/newBoardItem\("board",\{book:true\}\)/,'the create card opens the board, not a new editor');
  assert.match(src,/window\.__vaultBook=!!\(ty==='board'&&d\.book\);/,'opening sets the mode from the stored mark');
  assert.match(src,/function itemKind\(d\)/);
  /* 구간 재생·자막·복제/삭제 규칙이 장면 엔진에 걸려 있다 */
  assert.match(src,/function playAnimRange\(from,to\)/);
  assert.match(src,/if\(s>=_animLastIdx\(\)\)/,'playback stops at the end of the range');
  assert.match(src,/if\(idx!=null&&window\.__bkCapLive\)txt=window\.__bkCapLive\(txt,idx\);/);
  assert.ok(src.split('bkFrameRemoved(').length-1>=3,'both delete paths hand the label over');
  assert.ok(src.split('bkFrameCopy').length-1>=3,'duplicate and paste drop the label');
  /* 장면 줄에는 칸만 — 단계 시작은 클래스로 표시한다(칸 번호를 쓰는 곳이 여럿이다) */
  assert.match(src,/\(\(i>0&&typeof f\.sg==="string"\)\?" sg-start":""\)/);
  /* 글자만 고쳐도 «변경 있음» — 편집 지문에 패턴북 칸이 들어간다 */
  assert.match(src,/window\.__bkSig\?\("#"\+window\.__bkSig\(\)\):""/);
  /* 작업 보드는 읽기만 한다 */
  assert.match(src,/window\.__vaultLiveBoardDoc=function\(\)/);
  /* 나가면 표식이 내려간다 */
  const restore=cut('function vaultBoardRestore(){','function ');
  assert.match(restore,/window\.__vaultBook=false;/);
});

test('the rail speaks the 2.979 grammar — sizes 12·14·16, weights 500·600·700, radii 6·10·999',()=>{
  const css=cut('<style id="ps-2985-book">','</style>');
  const vals=(re)=>[...new Set([...css.matchAll(re)].map(m=>m[1]))].sort();
  assert.deepEqual(vals(/font-size:(\d+(?:\.\d+)?)px/g).filter(v=>!['12','14','16'].includes(v)),[]);
  assert.deepEqual(vals(/font-weight:(\d+)/g).filter(v=>!['500','600','700'].includes(v)),[]);
  assert.deepEqual(vals(/border-radius:(\d+)px/g).filter(v=>!['6','10','999'].includes(v)),[]);
  /* 무대는 margin 으로 비킨다(padding 은 도크 규칙이 쥐고 있다) · 폰에는 기둥이 없다 */
  assert.match(css,/#boardStage\{margin-left:260px!important\}/);
  assert.match(css,/@media \(max-width:767\.98px\)\{#bkRail\{display:none!important\}\}/);
  assert.match(css,/body\.ps-phone-work #bkRail/);
});
