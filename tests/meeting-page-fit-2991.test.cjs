'use strict';
/* 2.991 — 미팅 A4 미리보기 fit(): srcdoc 를 갈아 끼우는 사이 resize 가 오면 iframe 문서가 비어 있다(documentElement·body null).
   CI 크로미움에서 «Cannot read properties of null (reading 'clientWidth')» pageerror 로 meeting-upgrade 가 떨어졌다. 다음 프레임에 다시 잰다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const start=source.indexOf('  var fitWait=0;');assert.ok(start>0);
const code=source.slice(start,source.indexOf('  function render(){',start));
function ctx(doc){
  const frames=[];
  const c={Math,frames,anim:{slides:[]},meetingPdfOrientation:()=>'portrait',requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},
    frame:{contentDocument:doc,clientWidth:900,clientHeight:700}};
  vm.createContext(c);vm.runInContext('var frame=this.frame;'+code+';this.fit=fit;',c);return c;
}
test('an empty preview document (srcdoc being replaced) waits a frame instead of throwing',()=>{
  const doc={documentElement:null,body:null};const c=ctx(doc);
  assert.doesNotThrow(()=>c.fit());
  assert.equal(c.frames.length,1,'measures again on the next frame');
  doc.documentElement={clientWidth:900,clientHeight:700};doc.body={style:{}};
  c.frames.shift()();
  assert.ok(doc.body.style.zoom>0&&doc.body.style.zoom<=1,'fitted once the document exists');
  assert.equal(c.frames.length,0);
});
test('waiting is bounded — a document that never fills does not spin forever',()=>{
  const c=ctx({documentElement:null,body:null});c.fit();
  let n=0;while(c.frames.length&&n<50){c.frames.shift()();n++;}
  assert.ok(n<=10,'at most ten frames ('+n+')');
});
