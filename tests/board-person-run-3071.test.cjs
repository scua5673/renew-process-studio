'use strict';
/* 3.071 — 사용자 «3d 실제모양 애니메이션 만들면 뛰는 모습» */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const depth=require('../studio/board-token-depth.js');
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
test('3.072 — no pose is a player standing toward the camera; the pose carries the facing angle',()=>{
  assert.deepEqual(depth.personPose(null),{yaw:90,phase:0,amp:0});
  assert.equal(depth.personPose({yaw:-90,amp:.8}).yaw,-90,'running away shows the back');
  assert.equal(depth.personPose({yaw:0,amp:5}).amp,1,'amp is capped');
});
test('playback computes each moving player’s motion once per frame, only for 3D «사람»',()=>{
  assert.match(board,/try\{ window\.__psMotion=_personMotion\(a,b,u,curves\); \}catch\(_\)\{ window\.__psMotion=null; \}/);
  assert.match(board,/renderTokens\(\);window\.__psMotion=null;/,'cleared right after the frame so later redraws stand still');
  assert.match(board,/if\(tokShape!=="person"\|\|!document\.body\.classList\.contains\("bc-tilt3d"\)\)return null;/);
  assert.match(board,/return \{yaw:yaw,phase:mv\.run\/2\.6,amp:Math\.max\(0,amp\*ease\)\}; \}/);
  assert.match(board,/nameUnit:nu,pose:_personPose\(p\),/);
});
