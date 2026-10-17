'use strict';
/* 3.071 — 사용자 «3d 실제모양 애니메이션 만들면 뛰는 모습» · 3.072 «더 리얼하게» · «중계 시점» */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const depth=require('../studio/board-token-depth.js');
const bc=require('../studio/board-broadcast.js');
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const line=(x0,y0,x1,y1,c,t)=>({x:x0+(x1-x0)*t,y:y0+(y1-y0)*t});

test('3.072 — no pose is a player standing toward the camera; the pose carries the facing angle',()=>{
  assert.deepEqual(depth.personPose(null),{yaw:90,phase:0,amp:0,kick:null,recv:null,foot:'R'});
  assert.equal(depth.personPose({yaw:-90,amp:.8}).yaw,-90,'running away shows the back');
  assert.equal(depth.personPose({yaw:0,amp:5}).amp,1,'amp is capped');
});
test('motion: distance run so far and the whole run, in metres; players moving under 40 cm stand',()=>{
  const a={players:[{id:1,x:0,y:0},{id:2,x:100,y:100}]},b={players:[{id:1,x:200,y:0},{id:2,x:102,y:100}]};
  const m=bc.motion(a,b,.5,null,{curvePt:line,mpp:10});
  assert.ok(Math.abs(m[1].total-20)<1e-6,'20 m');assert.ok(Math.abs(m[1].run-10)<1e-6,'half way');assert.ok(m[1].vx>0&&m[1].vy===0);
  assert.equal(m[2],undefined,'20 cm is standing');
  assert.equal(bc.motion(a,b,0,null,{curvePt:line,mpp:10}),null,'nothing between scenes');assert.equal(bc.motion(a,b,1,null,{curvePt:line,mpp:10}),null);
});
test('pose: faces the run (right, toward the camera, away) mid-run and turns back to the camera at the ends',()=>{
  const mv=(vx,vy,u)=>({vx,vy,run:5,total:20,u});
  assert.equal(Math.round(bc.pose(mv(1,0,.5),{}).yaw),0,'running right');
  assert.equal(Math.round(bc.pose(mv(0,1,.5),{}).yaw),90,'running down the screen = toward the camera');
  assert.equal(Math.round(bc.pose(mv(0,-1,.5),{}).yaw),-90,'running up = the back');
  assert.equal(Math.round(bc.pose(mv(1,0,.02),{}).yaw*10)/10>0,true,'starting: still turning from the camera');
  assert.equal(bc.pose(mv(1,0,.5),{}).phase,5/2.6,'one stride cycle per 2.6 m');
  assert.equal(bc.pose(mv(1,0,1),{}).amp,0,'stops at the end');
  // vertical board: the world is turned 90°, so a run along +x is up or down the screen
  assert.equal(Math.round(bc.pose(mv(1,0,.5),{orientation:'v',spFlip:true}).yaw),90);
});
test('broadcast view: players stand upright on the tilted, turned pitch',()=>{
  assert.equal(bc.stand(false),null);
  const s=bc.stand(true);assert.equal(s.rot,-bc.TV.yaw);assert.ok(Math.abs(s.sy-1/Math.cos(bc.TV.ax*Math.PI/180))<1e-9);
  assert.ok(bc.TV.ax>45&&bc.TV.ax<65,'oblique like a stand camera');assert.ok(bc.TV.widthM>40&&bc.TV.widthM<90,'about half the pitch across');
});
test('board wiring: motion once per frame, cleared after; 3D «사람» only; camera button',()=>{
  assert.match(board,/try\{ window\.__psMotion=_personMotion\(a,b,u,curves\); \}catch\(_\)\{ window\.__psMotion=null; \}/);
  assert.match(board,/renderTokens\(\);window\.__psMotion=null;/,'cleared right after the frame so later redraws stand still');
  assert.match(board,/function _personMotion\(a,b,u,curves\)\{ if\(tokShape!=="person"\|\|!document\.body\.classList\.contains\("bc-tilt3d"\)/);
  assert.match(board,/nameUnit:nu,pose:_personPose\(p\),stand:_personStand\(\),zoom:/);
  assert.match(board,/<button type="button" data-cam="tv"[^>]*>중계<\/button>/);
  assert.match(board,/<script src="board-broadcast\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),/'\/studio\/board-broadcast\.js'/,'cached for offline');
});

test('3.074 kick: the player nearest the ball kicks, the ball leaves on contact, the nearest player at the end receives — with his own foot',()=>{
  const a={players:[{id:1,x:100,y:100,sqId:'s1'},{id:2,x:400,y:100}],ball:{x:110,y:100}},b={players:[{id:1,x:100,y:100,sqId:'s1'},{id:2,x:400,y:100}],ball:{x:395,y:100}};
  const k=bc.kick(a,b,10);assert.equal(k.kicker,1);assert.equal(k.receiver,2);
  assert.equal(bc.ballU(a,b,bc.KICK.contact*.9,10),0,'the ball waits for the foot');assert.ok(bc.ballU(a,b,.5,10)>0&&bc.ballU(a,b,.5,10)<.5);assert.equal(bc.ballU(a,b,1,10),1);
  const far={players:[{id:1,x:300,y:300}],ball:{x:110,y:100}};assert.equal(bc.kick(far,b,10),null,'nobody near the ball — it just moves');assert.equal(bc.ballU(far,b,.05,10),.05);
  const env={curvePt:line,mpp:10,foot:p=>p.sqId==='s1'?'L':''};
  const m=bc.motion(a,b,.1,null,env),pk=bc.pose(m[1],{});assert.ok(pk.kick>0&&pk.kick<1);assert.equal(pk.foot,'L','left-footed from the roster');assert.equal(Math.round(pk.yaw),0,'faces the pass');
  const r=bc.pose(bc.motion(a,b,.95,null,env)[2],{});assert.ok(r.recv>0);assert.equal(r.foot,'R');assert.equal(Math.round(Math.abs(r.yaw)),180,'faces the ball coming in');
});
