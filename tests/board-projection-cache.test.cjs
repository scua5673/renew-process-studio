'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
const code=s.slice(s.indexOf('function _bcSolveH('),s.indexOf('function _setPitch('));
function harness(){
 const corners=[[20,30],[1120,80],[960,710],[85,760]],state={corners,missing:false,fail:false};let solves=0;
 const c={W:1100,H:730,world:{querySelector(id){if(state.missing)return null;const i=+id.slice(-1);return {getBoundingClientRect(){if(state.fail)throw Error('synthetic');const p=state.corners[i];return {left:p[0]-2,top:p[1]-2,width:4,height:4};}};}}};
 vm.createContext(c);vm.runInContext(code,c);const orig=c._bcSolveH;c._bcSolveH=(...a)=>{solves++;return orig(...a);};return {c,state,solves:()=>solves};
}
function near(a,b){assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);}
test('an unchanged measured perspective reuses its matrix without changing coordinates',()=>{
 const h=harness();for(let n=0;n<30;n++)h.state.corners.forEach(([x,y],i)=>{const p=h.c.bcUnproject(x,y),dst=[[0,0],[1100,0],[1100,730],[0,730]][i];near(p.x,dst[0]);near(p.y,dst[1]);});assert.equal(h.solves(),1);
});
test('scroll and resized or rotated corners immediately invalidate the projection',()=>{
 const h=harness();h.c.bcUnproject(20,30);
 for(const transform of [([x,y])=>[x+12,y-24],([x,y])=>[x*.8,y*1.2],([x,y])=>[y,-x]]){
  const before=h.solves();h.state.corners=h.state.corners.map(transform);h.state.corners.forEach(([x,y],i)=>{const p=h.c.bcUnproject(x,y),dst=[[0,0],[1100,0],[1100,730],[0,730]][i];near(p.x,dst[0]);near(p.y,dst[1]);});assert.equal(h.solves(),before+1);
 }
});
test('world dimensions are part of the cache identity',()=>{
 const h=harness();h.c.bcUnproject(20,30);h.c.W=900;h.c.H=600;const p=h.c.bcUnproject(...h.state.corners[2]);near(p.x,900);near(p.y,600);assert.equal(h.solves(),2);
});
for(const issue of ['missing','fail','degenerate'])test(issue+' geometry never reuses a previously valid projection',()=>{
 const h=harness();h.c.bcUnproject(20,30);const before=h.state.corners;
 if(issue==='degenerate')h.state.corners=[[0,0],[0,0],[0,0],[0,0]];else h.state[issue]=true;
 assert.equal(h.c.bcUnproject(200,300),null);assert.equal(h.c.bcProjectionCache,null);
 h.state.corners=before;h.state.missing=false;h.state.fail=false;const p=h.c.bcUnproject(...before[2]);near(p.x,1100);near(p.y,730);assert.ok(h.solves()>=2);
});
