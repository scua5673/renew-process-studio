const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {goalTransform}=require('../studio/board-practice.js');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../studio/textbook/packs/ch10.json')));
function transform(){ return goalTransform; }
function point(t,x,y){
 const tr=/translate\(([-\d.e]+),([-\d.e]+)\)/.exec(t),sc=/scale\(([-\d.e]+),([-\d.e]+)\)/.exec(t),ro=/rotate\(([-\d.e]+)\)/.exec(t);
 x*=+sc[1];y*=+sc[2];const a=(ro?+ro[1]:0)*Math.PI/180;
 return [+tr[1]+x*Math.cos(a)-y*Math.sin(a),+tr[2]+x*Math.sin(a)+y*Math.cos(a)];
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<.001,`${a} != ${b}`);
test('both goal mouths sit on the line, with nets outside, in viewing, editing and vertical views',()=>{
 for(const [i,d] of pack.drills.entries())for(const frames of [d.frames,...Object.values(d.variants)])for(const f of frames){
  const sn=f.snap,box=sn.drawings[0].pts,grid=[30,40,70][i];
  for(const g of sn.equipment){
   const mini=g.team==='minigoalV',depth=mini?8:13,span=mini?26:44;
   for(const edit of [false,true])for(const orient of ['h','v']){
    const t=transform(sn,edit,orient)(g),mouth=point(t,-depth,0),back=point(t,depth,0),post1=point(t,-depth,-span/2),post2=point(t,-depth,span/2);
    near(mouth[0],g.x);near(mouth[1],g.y);
    near(Math.hypot(post2[0]-post1[0],post2[1]-post1[1]),(mini?2:7.32)*1050/grid);
    near(Math.hypot(back[0]-mouth[0],back[1]-mouth[1]),(mini?1:2)*1050/grid);
    if(g.rot===180){near(g.x,box[0].x);assert.ok(back[0]<box[0].x);}
    else{near(g.x,box[1].x);assert.ok(back[0]>box[1].x);}
   }
  }
 }
});
test('shots and the finishing ball arrive inside the goal mouth',()=>{
 for(const d of pack.drills)for(const frames of [d.frames,...Object.values(d.variants)])for(const f of frames){
  for(const shot of f.snap.drawings.filter(d=>d.type==='shot')){
   const target=shot.pts.at(-1),goal=f.snap.equipment.find(g=>Math.abs(g.x-target.x)<.02&&Math.abs(g.y-target.y)<g.mouthWidth/2);
   assert.ok(goal,`shot target ${JSON.stringify(target)} must be between posts`);
  }
 }
 const last=pack.drills[2].frames.at(-1).snap,goal=last.equipment[1];
 near(last.ball.x,goal.x);assert.ok(Math.abs(last.ball.y-goal.y)+42*1.18*last.tokenScale*last.ball.scale/2<goal.mouthWidth/2,'the whole display ball fits between the posts');
 assert.ok(last.ball.scale<.5,'the display ball is smaller than a player');
});
