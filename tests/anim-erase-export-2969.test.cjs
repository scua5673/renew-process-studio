'use strict';
/* 2.969 — 오류 제보 bd3caa77 «애니메이션에서 그렸다가 지웠는데 지워지지 않아요» + 사용자 «애니메이션 내보내기를 원하는 폴더에». */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};

test('motion-path handles never catch a press while a drawing tool, the eraser or a stamp is active',()=>{
  const css=slice('  body[data-tool="eraser"] svg.board{cursor:pointer;}','  /* 2.902');
  assert.match(css,/body\[data-tool\]:not\(\[data-tool="move"\]\) #pathLayer :is\(\.mp-handle,\.mp-air\) \*/);
  assert.match(css,/body\.token-stamp #pathLayer :is\(\.mp-handle,\.mp-air\) \*\{pointer-events:none!important;\}/);
});

test('the current scene is committed before switching scenes or adding one',()=>{
  const sel=slice('function selectAnimFrame(i,focus){','function reorderAnimFrame(');
  assert.ok(sel.indexOf('autoSaveAnimFrame()')>0&&sel.indexOf('autoSaveAnimFrame()')<sel.indexOf('stopAnim()'),'commit before stopAnim/loadSnap');
  const add=slice('  $("animAdd").onclick=','  $("animUpdate").onclick');
  assert.ok(add.indexOf('autoSaveAnimFrame()')>0&&add.indexOf('autoSaveAnimFrame()')<add.indexOf('ensureAnimMode(true)'),'commit before ensureAnimMode (only an open bar commits)');
});

function helpers(win){
  const code=slice('function _animExportName(ext){','/* 2.752 —');
  const writes=[],clicks=[];
  const c={window:win,document:{createElement:()=>({click(){clicks.push(this.download);}})},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},setTimeout:()=>0};
  vm.createContext(c);vm.runInContext(code,c);return {c,writes,clicks};
}
test('save target: handle, cancel (false) and unsupported browser (null)',async()=>{
  let seen=null;
  const h={name:'코너킥.gif',createWritable:async()=>({write:async b=>{h.got=b;},close:async()=>{h.closed=true;}})};
  let {c}=helpers({showSaveFilePicker:async o=>{seen=o;return h;}});
  assert.equal(await c._animPickSaveTarget('작전판_애니메이션.gif','gif'),h);
  assert.equal(seen.suggestedName,'작전판_애니메이션.gif');assert.equal(seen.id,'ps-anim-export','the browser remembers the chosen folder');
  assert.deepEqual(Object.keys(seen.types[0].accept),['image/gif']);
  assert.equal(await c._animSaveBlob('B','작전판_애니메이션.gif',h),'코너킥.gif');assert.equal(h.got,'B');assert.ok(h.closed);
  ({c}=helpers({showSaveFilePicker:async()=>{const e=new Error('x');e.name='AbortError';throw e;}}));
  assert.equal(await c._animPickSaveTarget('a.mp4','mp4'),false,'cancel → make nothing');
  ({c}=helpers({showSaveFilePicker:async()=>{throw new Error('SecurityError');}}));
  assert.equal(await c._animPickSaveTarget('a.mp4','mp4'),null,'blocked → download as before');
  ({c}=helpers({}));
  assert.equal(await c._animPickSaveTarget('a.webm','webm'),null,'Safari/Firefox → download');
});
test('no target or a failed write falls back to the old download and removes the empty picked file',async()=>{
  let {c,clicks}=helpers({});
  assert.equal(await c._animSaveBlob('B','작전판_애니메이션.mp4',null),null);assert.deepEqual(clicks,['작전판_애니메이션.mp4']);
  const h={removed:false,createWritable:async()=>{throw new Error('denied');},remove:async()=>{h.removed=true;}};
  ({c,clicks}=helpers({}));
  assert.equal(await c._animSaveBlob('B','작전판_애니메이션.gif',h),null);assert.ok(h.removed);assert.deepEqual(clicks,['작전판_애니메이션.gif']);
});
test('both exports ask for the place first, inside the click',()=>{
  const gif=slice('async function exportGif(){','/* 2.935 — 장면 목록 → GIF 바이트');
  assert.ok(gif.indexOf('_animPickSaveTarget(')<gif.indexOf('_animExportGuard('),'GIF: pick before encoding');
  assert.match(gif,/if\(t===false\)return;/);
  const go=slice('  ov.querySelector("#evGo").onclick=async function(){','\n}');
  assert.ok(go.indexOf('_animPickSaveTarget(')<go.indexOf('close();'),'video: pick before the sheet closes');
  assert.match(go,/target:_t/);
  assert.match(slice('async function _exportVideoRun(opts){','function exportVideoSheet(){'),/_animSaveBlob\(blob,_animExportName\(ext\),opts\.target\|\|null\)/);
  assert.match(slice('async function _exportGifRun(target){','let toastT;'),/_animSaveBlob\(blob,_animExportName\("gif"\),target\|\|null\)/);
});
