'use strict';
/* 3.279 — 개인 노트 «그림 넣기»(studio/note-picture.js)의 순수 규칙 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../studio/note-picture.js');
test('fit: 칸 안에 비율을 지켜 가운데로',()=>{
  assert.deepEqual(P.fit({x:100,y:100,w:400,h:400},2),{x:100,y:200,w:400,h:200},'가로로 긴 그림 — 폭에 맞고 세로 가운데');
  assert.deepEqual(P.fit({x:0,y:0,w:400,h:100},1),{x:150,y:0,w:100,h:100},'칸이 더 넓으면 높이에 맞고 가로 가운데');
  assert.deepEqual(P.fit({x:5,y:6,w:0,h:10},2),{x:5,y:6,w:0,h:10},'빈 칸은 그대로');
});
test('clamp: 쪽 밖으로 나가지 않고 너무 작아지지 않는다',()=>{
  assert.deepEqual(P.clamp({x:-50,y:1400,w:200,h:100},1000,1414),{x:0,y:1314,w:200,h:100});
  const r=P.clamp({x:10,y:10,w:2,h:2},1000,1414);assert.ok(r.w>=24&&r.h>=24);
  assert.deepEqual(P.clamp({x:0,y:0,w:5000,h:5000},1000,1414),{x:0,y:0,w:1000,h:1414});
});
test('rectOf · scaleTo',()=>{
  assert.deepEqual(P.rectOf({x:300,y:50},{x:100,y:250}),{x:100,y:50,w:200,h:200});
  assert.deepEqual(P.scaleTo(3200,1600,1600),{w:1600,h:800});assert.deepEqual(P.scaleTo(800,400,1600),{w:800,h:400},'작은 그림은 키우지 않는다');
});
test('okPic: 그림 data URL 과 숫자 칸만 — 다른 기기가 보낸 문서의 이상한 값은 그리지 않는다',()=>{
  const ok={id:'a',src:'data:image/jpeg;base64,AAAA',x:1,y:2,w:3,h:4};
  assert.equal(P.okPic(ok),true);
  for(const bad of [{...ok,src:'https://example.invalid/a.png'},{...ok,src:'javascript:alert(1)'},{...ok,src:'data:image/svg+xml;base64,AAAA'},{...ok,src:'data:text/html;base64,AAAA'},{...ok,w:0},{...ok,x:'1'},{...ok,h:Infinity},null])assert.equal(P.okPic(bad),false,JSON.stringify(bad));
  assert.deepEqual(P.picsOf({pics:[ok,{...ok,w:-1}]}),[ok]);assert.deepEqual(P.picsOf({}),[]);assert.deepEqual(P.picsOf(null),[]);
});
test('실린 곳: 노트가 내보내기 모듈 뒤에 싣고 설치 묶음에 있다 · 새 저장 키 없음',()=>{
  const root=path.join(__dirname,'..'),note=fs.readFileSync(path.join(root,'studio/note.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),src=fs.readFileSync(path.join(root,'studio/note-picture.js'),'utf8');
  assert.ok(note.indexOf('note-export.js')<note.indexOf('note-picture.js'));assert.match(sw,/'\/studio\/note-picture\.js'/);
  assert.doesNotMatch(src,/localStorage|storage\.set\(/,'노트 문서 안에만 적는다');
  assert.match(src,/isEvalSupported:false/,'PDF.js eval 경로는 끈 채(3.105)');
});
