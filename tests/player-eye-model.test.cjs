const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../studio/player-eye-model.js');
const field={cx:555,cy:370,units:10,len:105,wid:68};
const a={players:[{id:6,num:6,team:'blue',x:455,y:370,dir:170},{id:'9',num:9,team:'red',x:755,y:470}],equipment:[],ball:{x:465,y:370}};
const b={players:[{id:6,num:6,team:'blue',x:555,y:470,dir:-170}],equipment:[],ball:{x:755,y:470}};
const source=()=>structuredClone({snap:a,frames:[{snap:a,dur:2,moveSpeed:2,curves:{6:{mx:20,my:-10},ball:{mx:0,my:30,air:2}}},{snap:b}],active:0,hold:.6,inAnimation:true,field,colors:{blue:'#123456',red:'#ff0000'}});
test('world coordinates use metres independent of board display rotation',()=>{
 for(const orientation of ['h','v']){const src=source();src.snap={...a,orientation};const s=M.session(src),v=M.project(M.sample(s,0,false),s);assert.equal(v.players[0].x,-10);assert.equal(v.players[0].z,0);assert.equal(v.players[1].body,180);}
 assert.deepEqual(M.point({x:565,y:390},{...field,units:20}),{x:.5,z:1});
});
test('playback retains holds, speed, curved paths and shortest angle direction',()=>{
 const s=M.session(source());assert.deepEqual(s.plan.starts,[0,1.6]);assert.equal(s.plan.total,2.2);
 const v=M.sample(s,1.1,false);assert.equal(v.moving,true);assert.equal(v.snap.players[0].x,525);assert.equal(v.snap.players[0].y,410);assert.equal(v.snap.players[0].dir,180);assert.equal(v.snap.ball.eyeAir,2);
 assert.equal(M.sample(s,2.2,false).snap.players.length,1);
});
test('reading, seeking and camera movement do not modify original board or scenes',()=>{
 const src=source(),before=JSON.stringify(src),s=M.session(src);
 for(const t of [0,.8,1.4,2.2,.3]){const v=M.project(M.sample(s,t,false),s);M.camera(v.players[0],90,-8,1.65,v.ball,true);}
 assert.equal(JSON.stringify(src),before);s.frames[0].snap.players[0].x=9;assert.equal(src.snap.players[0].x,455);
});
test('current draft remains current until a deliberate scene playback or selection',()=>{
 const src=source();src.inAnimation=false;src.snap={...a,players:[{...a.players[0],x:400}]};const s=M.session(src);
 assert.equal(s.currentOnly,true);assert.equal(M.sample(s,0,true).snap.players[0].x,400);assert.equal(M.sample(s,0,false).snap.players[0].x,455);
});
test('a single saved scene is distinct from the current draft and legacy zero speed uses normal speed',()=>{
 const src=source();src.frames=[{snap:b}];src.inAnimation=false;const s=M.session(src);
 assert.equal(M.sample(s,0,true).snap.players[0].x,455);assert.equal(M.sample(s,0,false).snap.players[0].x,555);
 assert.equal(M.timeline([{dur:0,moveSpeed:0},{snap:b}],0).total,2.2);
});
test('body direction and camera head offset are independent; ball tracking is explicit',()=>{
 const p={x:0,z:0,body:0},ball={x:0,z:10};assert.equal(M.camera(p,30,0,1.5,ball,false).head,30);
 assert.equal(M.camera(p,0,0,1.5,ball,true).head,90);assert.equal(p.body,0);
 assert.equal(M.camera(p,-90,0,1.5,{x:0,z:0},true).head,-90);
 assert.ok(M.camera(p,0,0,1.5,ball,true).pitch<0,'ground ball tracking looks down');
 assert.ok(M.camera(p,0,0,1.5,{...ball,eyeAir:3},true).pitch>0,'airborne ball tracking looks up');
});
test('missing players, invalid coordinates and coaches cannot become a POV',()=>{
 const src=source();src.snap.players=[{id:'bad',x:null,y:3},{id:'coach',x:20,y:10,coach:true}];src.inAnimation=false;
 const s=M.session(src);assert.deepEqual(M.project(M.sample(s,0,true),s).players,[]);
 assert.equal(M.camera(null,0,0,1.65,null,false),null);
});
test('ball interpolation accepts the board kick timing without modifying the frames',()=>{
 const out=M.interpolate(a,b,.5,{ball:{mx:0,my:0}},()=>0);assert.equal(out.ball.x,a.ball.x);
 const s=source().snap;delete s.ball;s.equipment=[{id:1,team:'ball',x:500,y:370},{id:2,team:'ball',x:900,y:370}];assert.equal(M.nearestBall(s,s.players[0]).id,1);
});
test('user-specified team and goalkeeper colours are retained in projection',()=>{
 const src=source();src.snap={...a,teamColors:{blue:'#abcdef'},gkColors:{blue:'#fedcba'},players:[...a.players,{id:1,num:1,team:'blue',x:50,y:370}]};
 const s=M.session(src),v=M.project(M.sample(s,0,false),s);assert.equal(v.players[0].color,'#abcdef');assert.equal(v.players[2].color,'#fedcba');
});
