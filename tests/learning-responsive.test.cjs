'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../studio/app.html'),'utf8');
const start=html.indexOf('function syncDeskScale(){'),end=html.indexOf("  sw.addEventListener('click'",start);
function frame(id){return {id,tagName:'IFRAME',style:{}};}
test('learning keeps readable native width in narrow desktop windows while the board retains its layout',()=>{
 const learning=frame('fLearning'),board=frame('fBoard'),frames={clientWidth:375,clientHeight:700,children:[learning,board]};
 const c=vm.createContext({_fr:frames,saved:'desktop',devNow:()=>({phone:false,pad:false}),document:{body:{classList:{contains:()=>false}}}});
 vm.runInContext(html.slice(start,end),c);c.syncDeskScale();
 assert.equal(learning.style.width,undefined);assert.equal(learning.style.transform,undefined);
 assert.equal(board.style.width,'768px');assert.equal(board.style.transform,'scale('+375/768+')');
 // A previously scaled learning frame must be reset, including its inflated height.
 Object.assign(learning.style,board.style);c.syncDeskScale();
 for(const prop of ['width','height','transform','transformOrigin'])assert.equal(learning.style[prop],'');
 frames.clientWidth=1100;c.syncDeskScale();assert.equal(board.style.width,'');assert.equal(board.style.transform,'');
 c.devNow=()=>({phone:true,pad:false});frames.clientWidth=375;c.syncDeskScale();assert.equal(board.style.width,'');
});
