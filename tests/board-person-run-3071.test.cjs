'use strict';
/* 3.071 — 사용자 «3d 실제모양 애니메이션 만들면 뛰는 모습» */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const depth=require('../studio/board-token-depth.js');
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
test('no pose is the standing player; the back view stays even when standing still',()=>{
  assert.deepEqual(depth.personPose(null),{view:'front',flip:false,phase:0,amp:0});
  assert.equal(depth.personPose({view:'side',amp:0}).view,'front','a player who stopped faces the camera');
  assert.equal(depth.personPose({view:'side',amp:.8,flip:true}).flip,true);
  assert.equal(depth.personPose({view:'front',amp:5}).amp,1,'amp is capped');
});
test('playback computes each moving player’s motion once per frame, only for 3D «사람»',()=>{
  assert.match(board,/try\{ window\.__psMotion=_personMotion\(a,b,u,curves\); \}catch\(_\)\{ window\.__psMotion=null; \}/);
  assert.match(board,/renderTokens\(\);window\.__psMotion=null;/,'cleared right after the frame so later redraws stand still');
  assert.match(board,/if\(tokShape!=="person"\|\|!document\.body\.classList\.contains\("bc-tilt3d"\)\)return null;/);
  assert.match(board,/var view=\(Math\.abs\(sx\)>=Math\.abs\(sy\)\*0\.7\)\?"side":\(sy<0\?"back":"front"\);/);
  assert.match(board,/nameUnit:nu,pose:_personPose\(p\),/);
});
