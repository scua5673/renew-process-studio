const test=require('node:test');
const assert=require('node:assert/strict');
const Q=require('../studio/player-eye-quality.js');
const frames=(q,n,work=35,interval=65)=>{let changes=0;for(let i=0;i<n;i++)if(q.observe(work,interval))changes++;return changes;};
test('sustained slow playback steps down without oscillating or exceeding the lower bound',()=>{
 const q=Q.create();assert.equal(q.profile().name,'선명');assert.equal(frames(q,29),1);assert.equal(q.profile().name,'균형');
 frames(q,200,5,34);assert.equal(q.profile().name,'균형');assert.equal(frames(q,29),1);assert.equal(q.profile().fps,24);
 assert.equal(frames(q,100),0);assert.equal(q.profile().name,'경량');
});
test('isolated hitches, idle gaps and a resumed playback do not trigger a downgrade',()=>{
 const q=Q.create();frames(q,4);for(let i=0;i<100;i++){q.observe(70,80);frames(q,5,5,34);}assert.equal(q.profile().name,'선명');
 frames(q,18);q.observe(0,2000);frames(q,10);assert.equal(q.profile().name,'선명');q.reset();frames(q,20);assert.equal(q.profile().name,'선명');
});
test('device hints choose a conservative starting point while unavailable hints remain neutral',()=>{
 assert.equal(Q.create({memory:4}).profile().name,'균형');assert.equal(Q.create({cores:4}).profile().name,'균형');
 assert.equal(Q.create({memory:0,cores:0}).profile().name,'선명');
});
test('manual choices are stable and returning to auto starts fresh measurement',()=>{
 const q=Q.create();q.setMode('full');frames(q,100);assert.equal(q.profile().name,'선명');q.setMode('light');frames(q,100,2,34);assert.equal(q.profile().name,'경량');
 q.setMode('auto');assert.equal(q.profile().name,'선명');assert.equal(q.mode(),'auto');assert.equal(frames(q,4),0);
});
test('drawing resolution respects pixel budgets and never enlarges a low-DPI screen',()=>{
 for(const p of Q.profiles)for(const [w,h,dpr] of [[1280,720,1],[3840,2160,3],[820,1100,2]]){
  const ratio=Q.pixelRatio(p,w,h,dpr);assert.ok(ratio<=dpr&&ratio<=p.dpr);assert.ok(w*h*ratio*ratio<=p.pixels+1);
 }
});
