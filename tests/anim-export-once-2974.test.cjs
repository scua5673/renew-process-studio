'use strict';
/* 2.974 — 사용자 «작전판 애니메이션 MP4 내보내기에서 맥에서 저장 창이 두 번»: 저장 창은 한 번에 하나 · 거절·취소는 만들지 않는다 · 쓰기 실패는 말없이 내려받지 않는다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};
const code=slice('var _animPicking=false;','/* 2.752 — 내보내기 동안 __animExport');
function ctx(picker){
  const log={pick:0,anchor:0,retry:[],removed:0,busy:false};
  const c={window:{showSaveFilePicker:picker?async o=>{log.pick++;return picker(o);}:undefined,__animExport:0},
    PEP:{busy:()=>log.busy,retry:(b,n)=>log.retry.push(n),offer(){}},navigator:{maxTouchPoints:0,userAgent:'Mac Chrome'},
    document:{createElement:()=>({click(){log.anchor++;}})},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},setTimeout:()=>0,String,Promise};
  vm.createContext(c);vm.runInContext(code+';var _animAskSaveIOS=function(){return false;};',c);return {c,log};
}
const err=(name,message)=>Object.assign(new Error(message||name),{name});

test('only one save window at a time: a second request while the first is open is ignored (not turned into a download)',async()=>{
  let release;const {c,log}=ctx(()=>new Promise(r=>{release=()=>r({name:'a.mp4'});}));
  const first=c._animPickSaveTarget('a.mp4','mp4');
  assert.equal(await c._animPickSaveTarget('a.mp4','mp4'),false,'second request while open');
  release();assert.deepEqual(await first,{name:'a.mp4'});assert.equal(log.pick,1);
  const third=c._animPickSaveTarget('b.mp4','mp4');release();assert.deepEqual(await third,{name:'a.mp4'},'opens again once the first is closed');assert.equal(log.pick,2);
});
test('cancel and Chrome «already active» mean «do not make»; a missing API or other errors fall back to downloading like before',async()=>{
  assert.equal(await ctx(()=>{throw err('AbortError');}).c._animPickSaveTarget('a','mp4'),false);
  assert.equal(await ctx(()=>{throw err('NotAllowedError','File picker already active.');}).c._animPickSaveTarget('a','mp4'),false);
  assert.equal(await ctx(()=>{throw err('SecurityError','Cross origin sub frames aren\'t allowed to show a file picker.');}).c._animPickSaveTarget('a','mp4'),null);
  assert.equal(await ctx(null).c._animPickSaveTarget('a','mp4'),null);
});
test('no save window while a video is still being made',async()=>{
  const h=ctx(()=>({name:'x'}));h.log.busy=true;assert.equal(await h.c._animPickSaveTarget('a','mp4'),false);
  const k=ctx(()=>({name:'x'}));k.c.window.__animExport=1;assert.equal(await k.c._animPickSaveTarget('a','mp4'),false);
  assert.equal(h.log.pick+k.log.pick,0);
});
test('a write that fails asks with «내려받기» instead of silently downloading (which opened a second save window)',async()=>{
  const {c,log}=ctx(null);
  const target={name:'a.mp4',createWritable:async()=>{throw err('NotAllowedError');},remove:async()=>{log.removed++;}};
  assert.equal(await c._animSaveBlob({type:'video/mp4'},'a.mp4',target),'offer');
  assert.deepEqual(log.retry,['a.mp4']);assert.equal(log.anchor,0,'no automatic download');assert.equal(log.removed,1,'the empty file is cleaned up');
  const ok={name:'b.mp4',createWritable:async()=>({write:async()=>{},close:async()=>{}})};
  assert.equal(await c._animSaveBlob({},'b.mp4',ok),'b.mp4');
  assert.equal(await c._animSaveBlob({},'c.mp4',null),null);assert.equal(log.anchor,1,'no target (Safari) still downloads as before');
});
test('«영상 만들기» locks on the first press and unlocks only on cancel; video and GIF refuse a second run',()=>{
  const go=slice('  ov.querySelector("#evGo").onclick=async function(){','close(); setTimeout(');
  assert.match(go,/if\(_go\.__busy\)return; _go\.__busy=1; _go\.disabled=true;/);
  assert.match(go,/if\(_t===false\)\{ _go\.__busy=0; _go\.disabled=false;/);
  assert.match(slice('async function exportVideo(opts){','try{ PEP.open('),/if\(window\.__animExport\|\|PEP\.busy\(\)\)\{/);
  assert.match(slice('async function exportGif(){','var t=await _animPickSaveTarget'),/if\(_animExportBusy\(\)\)\{/);
  assert.match(slice('var PEP=(function(){','window.__psExpProg=PEP;'),/retry:function\(blob,name\)\{[^]*?\["내려받기",function\(\)\{ dl\(blob,name\);/);
});
