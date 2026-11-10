'use strict';
/* 3.271 — 제보 1bc9b7d4 «페이지도 되돌리기 기능»: «페이지를 삭제하거나 추가하거나 제목을 바꾸거나 했을 때, 되돌리기».
   이름 · 순서는 3.175 부터 되돌려졌다(아래 첫 시험이 지금 코드에서 그대로 확인). 추가 · 복제 · 삭제는 그때마다 기록을 비웠다(clearHistory) —
   그래서 이름을 바꾸고 페이지를 더하면 이름 되돌리기까지 사라졌다. 이제 같은 50개 기록에 «페이지 묶음이 이랬다»를 적는다.
   지운 페이지는 그 객체 그대로 기록이 들고 있다가(사본 없음) 제자리에 다시 끼운다. 식별자는 WeakMap · 기록에만(저장본에 없음).
   실제 판은 tests/browser/board-page-undo-3271.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const history=require('../studio/board-page-history.js'),source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
function cut(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
// board.html 의 페이지 묶음을 흉내 낸다: 판(canvas)은 지금 페이지의 사본, capture 가 페이지 객체에 담는다(같은 객체를 고친다).
function harness(names=['A','B','C']){
 let pages=names.map((n,i)=>({name:n,snap:{players:[{id:n,x:10*(i+1)}]},anim:{frames:[{snap:{k:n+'1'}},{snap:{k:n+'2'}}]}})),idx=0,canvas=clone(pages[0].snap),safe=true,scope='owner|live';const undo=[],redo=[];
 const capture=()=>{if(pages&&pages[idx])pages[idx].snap=clone(canvas);};
 const api={get:()=>({pages,idx}),set:(p,i)=>{pages=p;idx=i;},go:i=>{if(!pages||i===idx||!pages[i])return;capture();idx=i;canvas=clone(pages[i].snap);controller.keep();},stacks:()=>[undo,redo]},controller=history.create(api,{safe:()=>safe,scope:()=>scope});
 const clear=k=>{if(k===1&&controller.structure())return;undo.length=0;redo.length=0;controller.sync();};
 const c={psPhoneBoardReadOnly:()=>false,undoStack:undo,redoStack:redo,window:{},PSBoardPageHistory:{tag:e=>controller.tag(e)},captureSnap:()=>clone(canvas),_animSnapForUndo:()=>({frames:[],active:-1}),_undoEntry:e=>{canvas=clone(e.board||e);},toast(){}};c.window.PSBoardPageHistory=c.PSBoardPageHistory;vm.createContext(c);vm.runInContext(cut('function _boardHistoryEntry(){','try{document.addEventListener("input"')+cut('function undoLast(){','try{window.__clearBoardHistory='),c);
 const rawUndo=c.undoLast,rawRedo=c.redoLast;
 controller.sync();
 return {controller,undo,redo,get pages(){return pages;},get idx(){return idx;},get canvas(){return canvas;},names:()=>pages.map(p=>p.name),
  undoLast:()=>controller.step(false,()=>rawUndo()),redoLast:()=>controller.step(true,()=>rawRedo()),
  edit(x){c.pushUndo();canvas.players[0].x=x;},go:i=>api.go(i),rename(n){controller.record();pages[idx].name=n;},
  // board.html add() · dup(i) · del(i) 의 차례 그대로: capture → splice → idx → 판 올리기 → clearHistory(1)
  add(){if(!pages){pages=[{name:'',snap:clone(canvas)}];idx=0;}capture();pages.splice(idx+1,0,{name:'',snap:{players:[]},thumb:''});idx++;canvas=clone(pages[idx].snap);clear(1);},
  dup(i){capture();const cp=clone(pages[i]);cp.name+=' 복사';pages.splice(i+1,0,cp);idx=i+1;canvas=clone(pages[idx].snap);clear(1);},
  del(i){capture();pages.splice(i,1);if(idx>i)idx--;else if(idx===i)idx=Math.max(0,i-1);canvas=clone(pages[idx].snap);clear(1);},
  meetingSet(){capture();pages.splice(idx+1,0,{name:'M1',snap:{players:[]}},{name:'M2',snap:{players:[]}});idx++;canvas=clone(pages[idx].snap);clear();},
  single(){pages=null;idx=0;canvas={players:[{id:'S',x:1}]};clear();},clear,setSafe(v){safe=v;},setScope(v){scope=v;},
  replace(p,i){pages=p;idx=i;canvas=clone(p[i].snap);},draw(o){canvas=o;}};
}

test('지금 코드에서도 이름 되돌리기는 된다(3.175) — 추가 뒤에도 남는다',()=>{const h=harness();h.rename('Alpha');h.undoLast();assert.deepEqual(h.names(),['A','B','C']);h.redoLast();assert.deepEqual(h.names(),['Alpha','B','C']);
 assert.equal(typeof h.controller.structure,'function','추가 · 삭제 기록');
 h.add();assert.equal(h.undo.length,2,'페이지를 더해도 앞의 이름 기록이 남는다');h.undoLast();assert.deepEqual(h.names(),['Alpha','B','C']);h.undoLast();assert.deepEqual(h.names(),['A','B','C']);});

test('페이지 추가 → 되돌리면 그 페이지가 빠지고 있던 페이지로, 다시 실행하면 같은 자리에 그 페이지',()=>{const h=harness();h.edit(15);h.go(1);h.add();
 assert.deepEqual(h.names(),['A','B','','C']);assert.equal(h.idx,2);assert.equal(h.undo.length,2,'추가는 기록을 비우지 않는다');assert.equal(h.redo.length,0);
 const added=h.pages[2];h.draw({players:[{id:'N',x:77}]});   // 새 페이지에 그린 것(기록 밖 — 예: 가져오기)도 페이지와 함께 돌아온다
 assert.equal(h.undoLast(),true);assert.deepEqual(h.names(),['A','B','C']);assert.equal(h.idx,1,'더하기 전에 보던 페이지');assert.equal(h.canvas.players[0].id,'B');assert.equal(h.redo.length,1);
 assert.equal(h.redoLast(),true);assert.deepEqual(h.names(),['A','B','','C']);assert.equal(h.idx,2);assert.equal(h.pages[2],added,'같은 페이지 객체(사본 아님)');assert.deepEqual(h.canvas,{players:[{id:'N',x:77}]});
 h.undoLast();h.undoLast();assert.equal(h.idx,0,'그 앞의 토큰 편집은 제 페이지에서');assert.equal(h.canvas.players[0].x,10);assert.deepEqual(h.names(),['A','B','C']);
 h.redoLast();h.redoLast();assert.equal(h.pages[2],added);assert.equal(h.pages[0].snap.players[0].x,15);});

test('지금 보던 페이지 삭제 → 되돌리면 장면 · 그림까지 제자리에, 다시 실행하면 다시 지운다',()=>{const h=harness();h.go(1);h.draw({players:[{id:'B',x:55}],drawings:[{type:'line'}],pitchImg:'@photo:abc'});const body=h.pages[1],frames=clone(body.anim);
 h.del(1);assert.deepEqual(h.names(),['A','C']);assert.equal(h.idx,0);assert.equal(h.undo.length,1);
 assert.equal(h.undoLast(),true);assert.deepEqual(h.names(),['A','B','C']);assert.equal(h.idx,1,'지운 페이지가 제자리에서 다시 보인다');assert.equal(h.pages[1],body,'지운 페이지 객체 그대로');
 assert.deepEqual(h.canvas,{players:[{id:'B',x:55}],drawings:[{type:'line'}],pitchImg:'@photo:abc'},'지우기 직전의 판(그림 · 운동장 사진)');assert.deepEqual(h.pages[1].anim,frames,'장면');
 assert.equal(h.redoLast(),true);assert.deepEqual(h.names(),['A','C']);assert.equal(h.idx,0);assert.equal(h.canvas.players[0].id,'A');
 assert.equal(h.undoLast(),true);assert.equal(h.pages[1],body);assert.equal(h.idx,1);assert.deepEqual(Object.keys(body).sort(),['anim','name','snap'],'저장본에 식별자를 넣지 않는다');});

test('다른 페이지 삭제 · 맨 앞 · 맨 뒤 — 보던 페이지는 그대로, 순서도 그대로',()=>{let h=harness();h.go(2);h.edit(99);h.del(0);assert.deepEqual(h.names(),['B','C']);assert.equal(h.idx,1);assert.equal(h.undo.length,2);
 h.undoLast();assert.deepEqual(h.names(),['A','B','C']);assert.equal(h.idx,2);assert.equal(h.canvas.players[0].x,99,'보던 페이지 판은 건드리지 않는다');
 h.redoLast();assert.deepEqual(h.names(),['B','C']);assert.equal(h.idx,1);assert.equal(h.canvas.players[0].x,99);h.undoLast();h.undoLast();assert.equal(h.canvas.players[0].x,30);
 h=harness();h.go(2);h.del(2);assert.equal(h.idx,1);h.undoLast();assert.deepEqual(h.names(),['A','B','C']);assert.equal(h.idx,2);assert.equal(h.canvas.players[0].id,'C');
 h=harness();h.del(0);assert.equal(h.idx,0);assert.equal(h.canvas.players[0].id,'B');h.undoLast();assert.deepEqual(h.names(),['A','B','C']);assert.equal(h.idx,0);assert.equal(h.canvas.players[0].id,'A');});

test('복제 · 한 페이지 보드의 첫 추가 · 이름 · 순서와 섞인 차례',()=>{let h=harness();h.go(2);h.dup(0);assert.deepEqual(h.names(),['A','A 복사','B','C']);assert.equal(h.idx,1);
 h.undoLast();assert.deepEqual(h.names(),['A','B','C']);assert.equal(h.idx,2,'복제 전에 보던 페이지');h.redoLast();assert.deepEqual(h.names(),['A','A 복사','B','C']);assert.equal(h.idx,1);
 h=harness();h.single();h.edit(5);h.add();assert.equal(h.pages.length,2);assert.equal(h.undo.length,2);h.undoLast();assert.equal(h.pages.length,1);assert.equal(h.idx,0);assert.equal(h.canvas.players[0].x,5);
 h.undoLast();assert.equal(h.canvas.players[0].x,1,'한 페이지였던 때의 편집도 제 페이지로');h.redoLast();h.redoLast();assert.equal(h.pages.length,2);assert.equal(h.idx,1);
 h=harness();h.rename('Alpha');h.add();h.rename('New');h.del(0);assert.deepEqual(h.names(),['New','B','C']);
 h.undoLast();assert.deepEqual(h.names(),['Alpha','New','B','C']);h.undoLast();assert.deepEqual(h.names(),['Alpha','','B','C']);h.undoLast();assert.deepEqual(h.names(),['Alpha','B','C']);h.undoLast();assert.deepEqual(h.names(),['A','B','C']);
 for(let i=0;i<4;i++)h.redoLast();assert.deepEqual(h.names(),['New','B','C']);assert.equal(h.idx,0);});

test('경계는 그대로 — 미팅 세트 · 새 문서 · 빌린 화면 · 다른 계정은 비우거나 손대지 않는다',()=>{let h=harness();h.edit(15);h.meetingSet();assert.equal(h.undo.length,0,'여러 장을 한 번에 더하는 길은 예전 경계');
 h=harness();h.edit(15);h.setSafe(false);h.add();assert.equal(h.undo.length,0,'패턴북 · 미팅 · 훈련 편집 · 첨부(safe 아님)에선 예전처럼 비운다');
 h=harness();h.add();h.setSafe(false);const before=clone(h.pages);assert.equal(h.undoLast(),false);assert.deepEqual(h.pages,before);h.setSafe(true);h.setScope('other');assert.equal(h.undoLast(),false);assert.deepEqual(h.pages,before);h.setScope('owner|live');assert.equal(h.undoLast(),true);assert.equal(h.pages.length,3);
 // 모듈이 모르는 사이 묶음이 통째로 바뀌었으면(새 문서) 추측하지 않고 비운다
 h=harness();h.edit(15);h.replace([{name:'X',snap:{players:[{id:'X',x:1}]}},{name:'Y',snap:{players:[{id:'Y',x:2}]}}],0);h.add();assert.equal(h.undo.length,0);h.add();assert.equal(h.undo.length,1,'그다음부터는 다시 기록');
 h=harness();h.del(1);h.clear();assert.equal(h.undo.length,0);assert.equal(h.undoLast(),undefined,'기록을 비우면 지운 페이지도 놓는다');assert.deepEqual(h.names(),['A','C']);});

test('JSON 으로 건너가는 임시 문맥(보관함을 열었다 돌아옴) 뒤에도 지운 페이지를 되살린다 · 50개 한도',()=>{const h=harness();h.go(1);h.del(1);const keys=h.controller.keys(),saved=clone(h.undo),pages=clone(h.pages);
 h.undo.length=0;h.replace(pages,0);h.controller.bind(keys);Array.prototype.push.apply(h.undo,saved);
 assert.equal(h.undoLast(),true);assert.deepEqual(h.names(),['A','B','C']);assert.equal(h.idx,1);assert.equal(h.canvas.players[0].id,'B');assert.deepEqual(Object.keys(h.pages[1]).sort(),['anim','name','snap']);
 const g=harness();for(let i=0;i<60;i++)g.add();assert.equal(g.undo.length,50);assert.equal(g.pages.length,63);for(let i=0;i<60;i++)g.undoLast();assert.equal(g.pages.length,13,'50번까지');});

test('작전판에 물려 있다 — 추가 · 복제 · 삭제만 표식(1)을 넘기고 나머지 경계는 그대로',()=>{
 const flag=/clearHistory\(1\)/,plain=/clearHistory\(\)/;
 for(const [a,b] of [['  function add(){','  function dup(i){'],['  function dup(i){','  function switchTo(i){'],['  function del(i){','  function rename(i){']]){assert.match(cut(a,b),flag,a);assert.doesNotMatch(cut(a,b),plain,a);}
 assert.equal((source.match(/clearHistory\(1\)/g)||[]).length,3);
 for(const [a,b] of [['  function addMeetingSet(){','  /* ---- 라이브 저장'],['  function newBoard(){','  function newBoardUndo(){'],['    restoreContext:function(c){','    /* 저장용:'],['    restore:function(arr,','    /* 보관함 열람을'],['    duplicateByName:function(','    meetingSet:function'],['    exitToLive:function(){','\n']]){assert.match(cut(a,b),plain,a);assert.doesNotMatch(cut(a,b),flag,a);}
 assert.match(source,/function clearHistory\(k\)\{try\{window\.__clearBoardHistory&&window\.__clearBoardHistory\(k\);\}catch\(_\)\{\}\}/);
 assert.match(cut('  function del(i){','  function rename(i){'),/var go=function\(\)\{ restoreAnimBeforeCapture\(\);capture\(\); pages\.splice\(i,1\);/,'지우기 전에 지금 판을 담는다(재생 중이면 원래 장면으로) — 되살릴 내용');
 const js=fs.readFileSync(path.join(__dirname,'../studio/board-page-history.js'),'utf8');
 assert.match(js,/win\.__clearBoardHistory=function\(k\)/,'비우기를 감싼다');assert.doesNotMatch(js,/JSON\.(parse|stringify)/,'페이지 본문을 복사하지 않는다');
 assert.ok(Buffer.byteLength(source)<=2560000,'board.html budget '+Buffer.byteLength(source));
});

test('브라우저 시험이 CI 묶음에 있다',()=>{assert.ok(fs.readFileSync(path.join(__dirname,'browser/run-critical.mjs'),'utf8').includes("'board-page-undo-3271'"));assert.ok(fs.existsSync(path.join(__dirname,'browser/board-page-undo-3271.mjs')));});
