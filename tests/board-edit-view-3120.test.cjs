'use strict';
/* 3.120 — 훈련 편집기의 평면 · 3D 를 훈련마다(studio/board-edit-view.js).
   사용자 «훈련 편집 들어가면 기본은 평면보드로 나오게» · «보드설정에서 수정을 하면 각각 저장이 되게».
   3.035 의 «편집기는 평면»이 openEditor 에만 있어 보관함 훈련(openLibDrawEditor)은 3D 로 열렸고, 편집기 안에서 고른 3D 는
   기기 설정(ps_board_tilt3d)이라 모든 훈련 · 작전판이 같이 바뀌었다. 실제 판은 tests/browser/board-edit-view.mjs · board-editor-flat.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const EV=require('../studio/board-edit-view.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

function cls(){const s=new Set();return {add:c=>s.add(c),remove:c=>s.delete(c),contains:c=>s.has(c),toggle:(c,on)=>{if(on===undefined)on=!s.has(c);on?s.add(c):s.delete(c);return on;}};}
// 작은 작전판: __setTilt · openEditor(3.035 평면 처리 포함) · openLibDrawEditor(비동기) · closeEditor
function board({device='desktop',tilt=false}={}){
  const ls=new Map([['ps_board_tilt3d',tilt?'1':'0']]),calls=[],toasts=[];let drafts=0;
  const body={classList:cls()};if(tilt)body.classList.add('bc-tilt3d');
  const win={document:{readyState:'complete',body,addEventListener(){}},localStorage:{getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>ls.set(k,String(v))},
    top:{document:{documentElement:{getAttribute:()=>device}}},navigator:{maxTouchPoints:device==='desktop'?0:5},setTimeout:fn=>fn(),toast:m=>toasts.push(m),
    saveEditorDraft:()=>{drafts++;}};
  win.top.document.documentElement.getAttribute=()=>device;
  win.__setTilt=function(on,opts){opts=opts||{};calls.push([!!on,!!opts.transient]);body.classList.toggle('bc-tilt3d',!!on);if(!opts.transient)ls.set('ps_board_tilt3d',on?'1':'0');};
  win.openEditor=function(snap){if(!body.classList.contains('editing')&&body.classList.contains('bc-tilt3d'))win.__setTilt(false,{transient:true,quiet:true});win.__edTilt=(snap||{}).edTilt;body.classList.add('editing');};
  win.openLibDrawEditor=async function(snap){await null;win.__edTilt=(snap||{}).edTilt;body.classList.add('editing');};   // 스냅을 싣는 동안은 아직 편집기 밖
  win.closeEditor=function(){body.classList.remove('editing');win.__edTilt=undefined;};   // 라이브 보드로 돌아간다(edTilt 없음)
  win.switchTo=snap=>{win.__edTilt=(snap||{}).edTilt;};   // _activateTraining → loadSnap → lookApply
  const api=EV.install(win);
  return {win,api,body,ls,calls,toasts,drafts:()=>drafts,tilt:()=>body.classList.contains('bc-tilt3d')};
}

test('saved 3D opens as 3D only on desktop; everything else opens flat',()=>{
  assert.equal(EV.target(true,true),true);
  assert.equal(EV.target(true,false),false,'폰 · 아이패드는 평면(3.069)');
  assert.equal(EV.target(false,true),false);assert.equal(EV.target(undefined,true),false,'예전 훈련(값 없음) = 평면');
  assert.equal(EV.target('true',true),false);
});

test('edTilt rides the board-settings path: look extension (boolean, default flat) + accessor',()=>{
  const b=board();
  assert.deepEqual([b.win.__psLookExt.edTilt.def,b.win.__psLookExt.edTilt.ok(true),b.win.__psLookExt.edTilt.ok('1')],[false,true,false]);
  b.win.__edTilt=true;assert.equal(b.win.__edTilt,true);assert.equal(b.tilt(),false,'편집기 밖에서는 보기를 바꾸지 않는다');
});

test('vault training on a 3D device opens flat; leaving returns to 3D',async()=>{
  const b=board({tilt:true});
  await b.win.openLibDrawEditor({players:[]});await null;await null;
  assert.equal(b.tilt(),false,'보관함 훈련도 평면');assert.equal(b.ls.get('ps_board_tilt3d'),'1','기기 설정 값은 그대로');
  assert.equal(b.toasts.length,1,'처음 한 번 알린다');
  b.win.closeEditor();assert.equal(b.tilt(),true,'나가면 3D');
});

test('3D picked inside the editor belongs to that training: device setting untouched, draft saved, other training flat',()=>{
  const b=board({tilt:false});
  b.win.openEditor({});
  b.win.__setTilt(true);
  assert.deepEqual(b.calls.at(-1),[true,true],'기기 설정을 쓰지 않는다(transient)');
  assert.equal(b.ls.get('ps_board_tilt3d'),'0');assert.equal(b.win.__edTilt,true,'이 훈련의 값');
  assert.equal(b.drafts(),1,'임시본에 바로(기다리지 않고)');assert.match(b.toasts.at(-1),/이 훈련에 저장돼요/);
  b.win.switchTo({edTilt:false});assert.equal(b.tilt(),false,'다른 훈련은 평면');
  b.win.switchTo({edTilt:true});assert.equal(b.tilt(),true,'돌아오면 3D');
  b.win.closeEditor();assert.equal(b.tilt(),false,'나가면 들어오기 전 보기(평면)');assert.equal(b.ls.get('ps_board_tilt3d'),'0');
});

test('a training saved in 3D opens in 3D on desktop even when the device is flat',()=>{
  const b=board({tilt:false});
  b.win.openEditor({edTilt:true});assert.equal(b.tilt(),true);
  b.win.closeEditor();assert.equal(b.tilt(),false);
});

test('phone / iPad: a 3D training opens flat but keeps its 3D value (saving does not erase it)',()=>{
  const b=board({device:'ipad',tilt:false});
  b.win.openEditor({edTilt:true});
  assert.equal(b.tilt(),false,'저절로 3D 를 켜지 않는다');assert.equal(b.win.__edTilt,true,'값은 그대로 — 저장해도 지워지지 않는다');
  b.win.__setTilt(true);assert.equal(b.tilt(),true,'직접 켜면 켠다');
  b.win.closeEditor();assert.equal(b.tilt(),false);
});

test('community viewer and transient calls pass straight through',()=>{
  const b=board({tilt:false});
  b.win.openEditor({});b.body.classList.add('comm-viewing');
  b.win.__setTilt(true);assert.equal(b.win.__edTilt,false,'커뮤니티 «보기»는 글의 값을 바꾸지 않는다');
  b.body.classList.remove('comm-viewing');
  b.win.__setTilt(false,{transient:true});assert.deepEqual(b.calls.at(-1),[false,true]);
});

test('wired into the board: loaded before the board script (boot restore reads the look keys), service worker core, budget',()=>{
  const b=read('studio/board.html'),sw=read('sw.js');
  const tag=b.indexOf('<script src="board-edit-view.js"></script>'),body=b.indexOf('function lookKeys(');
  assert.ok(tag>0&&tag<body,'본문 스크립트보다 먼저');
  assert.ok(sw.includes("'/studio/board-edit-view.js'"));
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
  assert.match(b,/function openLibDrawEditor\(/);assert.match(b,/function closeEditor\(/);assert.match(b,/window\.__setTilt=function\(on,opts\)/);
});
