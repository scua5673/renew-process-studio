const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
function section(a,b){const start=source.indexOf(a);assert.ok(start>=0,a);const end=source.indexOf(b,start);assert.ok(end>start,b);return source.slice(start,end);}
const dc=x=>JSON.parse(JSON.stringify(x));
test('reset at scene 3 preserves earlier scenes and notes while deep-copying tokens to scenes 4–10',()=>{
 const c=vm.createContext({dc});vm.runInContext(section('function applyTokensToLaterFrames(','function resetLaterAnimTokens'),c);
 const frames=Array.from({length:10},(_,i)=>({snap:{players:[{id:1,x:i,name:'Old'}],drawings:[{text:'note '+i}]},cap:'caption '+i,dur:i+1,curves:{1:{mx:5}},thumb:'old'}));const before=dc(frames.slice(0,2));
 const snap={players:[{id:1,x:700,y:400,name:'New',num:'10',pos:'AM',img:'photo'}],equipment:[{id:2,x:22}],ball:{x:1,y:2}};
 c.applyTokensToLaterFrames(frames,2,snap);assert.deepEqual(frames.slice(0,2),before);
 for(let i=3;i<10;i++){assert.deepEqual(frames[i].snap.players,snap.players);assert.deepEqual(frames[i].snap.ball,snap.ball);assert.equal(frames[i].cap,'caption '+i);assert.equal(frames[i].snap.drawings[0].text,'note '+i);assert.equal(frames[i].dur,i+1);assert.equal(frames[i].curves,undefined);}
 frames[3].snap.players[0].x=99;assert.equal(frames[4].snap.players[0].x,700);assert.equal(snap.players[0].x,700);
});
test('ordinary name edit touches only the current scene',()=>{
 const c=vm.createContext({anim:{frames:[{snap:{players:[{id:1,name:'Before'}]}},{snap:{players:[{id:1,name:'Before'}]}}]},animActive:1,_nmKey:p=>p.id,_nmApplySnap:(s,by)=>s.players.forEach(p=>{if(by[p.id])p.name=by[p.id].name})});vm.runInContext(section('function syncNameToScenes(','function applyNamesAllScenes'),c);c.syncNameToScenes({id:1,name:'After'});assert.equal(c.anim.frames[0].snap.players[0].name,'Before');assert.equal(c.anim.frames[1].snap.players[0].name,'After');
});
test('page duplication includes full independent animation and captures pending edits',()=>{
 let captures=0,loaded;const original={snap:{players:[]},name:'Original',anim:{frames:[{snap:{players:[{id:1,x:22}]},curves:{1:{mx:7}},moveSpeed:4}],active:0,hold:2,title:'Demo',titleColor:'#123456'}};
 const c=vm.createContext({pages:[original],idx:0,MAXP:99,_clone:dc,ensure(){},capture(){captures++;},loadIdx:i=>loaded=i,clearHistory(){},render(){},persist(){},_toast(){}});vm.runInContext(section('  function dup(i){ ensure();','  function switchTo(i)'),c);c.dup(0);assert.equal(captures,1);assert.equal(loaded,1);assert.deepEqual(c.pages[1].anim,original.anim);c.pages[1].anim.frames[0].snap.players[0].x=77;assert.equal(original.anim.frames[0].snap.players[0].x,22);
});
test('4x timing matches playback and both export paths',()=>{assert.match(source,/<option value="4">4×<\/option>/);assert.equal(source.includes('Math.max(.3,(anim.frames[s].dur||1)/animMoveSpeed(anim.frames[s]))'),false);});
test('watermarks have identical live and export SVG path and opposite corner anchors',()=>{
 function el(tag,attrs){return {tag,attrs,children:[],appendChild(x){this.children.push(x);}};}const c=vm.createContext({el,PR:()=>({L:50,R:1050,T:40,B:700}),W:1100,H:740,state:{orientation:'h'},pitchViewKey:()=> 'full',document:{documentElement:{dataset:{pitch:'navy'}}}});vm.runInContext(section('function appendBoardExportWatermarks(','function _wmDraw'),c);
 const root=el('svg',{});root.querySelector=()=>null;c.appendBoardExportWatermarks(root,[0,0,1100,740]);const texts=root.children[0].children;assert.equal(texts.length,2);assert.equal(texts[0].attrs.x,50);assert.equal(texts[1].attrs.x,1050);assert.equal(texts[0].attrs['text-anchor'],'start');assert.equal(texts[1].attrs['text-anchor'],'end');assert.equal(texts[0].children.map(t=>t.textContent).join(''),'PROCESS STUDIO');
 c.state.orientation='v';const v=el('svg',{});v.querySelector=()=>null;c.appendBoardExportWatermarks(v,[0,0,740,1100]);assert.equal(v.children[0].children[0].attrs.x,40);assert.equal(v.children[0].children[1].attrs.x,700);
});
test('photo-only label policy and crop editor are wired to actual image loading',()=>{assert.match(source,/const lab=\(p.hideLabel\|\|p.img\)/);assert.match(source,/if\(p.name&&!p.img\)/);assert.match(source,/img.onload=function\(\)\{openTokenPhotoCrop\(img,ps\);\}/);assert.match(source,/aria-label="사진 확대"/);assert.match(source,/aria-label="사진 좌우 위치"/);});
test('airborne levels 1, 2, 3 increase lift, ground and endpoints stay grounded',()=>{
 const c=vm.createContext({state:{},dc,lerp:(a,b,u)=>a+(b-a)*u,_curvePt:(x,y,xx,yy,c,u)=>({x:x+(xx-x)*u,y:y+(yy-y)*u}),ballRollTrack(){},_interpDrawings:()=>[],normPitchView:x=>x,applyView(){},renderTokens(){},renderDrawings(){},window:{}});vm.runInContext(section('function renderInterp(','function _mpPair'),c);const snap={players:[],equipment:[{id:7,team:'ball',x:100,y:100}],ball:{x:200,y:200}};
 const lifts=[];for(let level=1;level<=3;level++){c.renderInterp(snap,snap,.5,{ball:{air:level},7:{air:level}});lifts.push(c.__ballAirS.ball);assert.equal(c.__ballAirS[7],c.__ballAirS.ball);}assert.ok(lifts[0]<lifts[1]&&lifts[1]<lifts[2]);c.renderInterp(snap,snap,1,{ball:{air:3}});assert.equal(c.__ballAirS.ball,undefined);c.renderInterp(snap,snap,.5,{ball:{air:0}});assert.equal(c.__ballAirS.ball,undefined);
});
test('upright goal posts use the pitch meet scale in horizontal and vertical views',()=>{
 const elements={};function node(){return {style:{},children:[],setAttribute(){},appendChild(x){this.children.push(x);if(x.id)elements[x.id]=x;},insertBefore(x){this.appendChild(x);},replaceChildren(){this.children=[];},set innerHTML(x){this.firstElementChild=node();},getBoundingClientRect(){return {left:0,top:0,width:1000,height:600};}};}
 const stage=node();Object.assign(stage,{scrollLeft:0,scrollTop:0,clientLeft:0,clientTop:0});elements.boardStage=stage;
 const svg=node();svg.querySelector=()=>null;svg.viewBox={baseVal:{x:0,y:0,width:1200,height:800}};
 const c=vm.createContext({window:{},document:{body:{classList:{contains:()=>true}},documentElement:{dataset:{pitch:'navy'}},getElementById:id=>elements[id],createElement:node},svg,state:{orientation:'h'},getCss:()=> '#123456',PR:()=>({L:100,R:1100}),pitchSpec:()=>({goal:73.2,goalD:20}),M2U:x=>x,W:1200,H:800,CY:400,pitchViewKey:()=> 'full'});
 vm.runInContext(section('  window.tiltGoalsSync=function(){','  window.__syncStageUI='),c);c.window.tiltGoalsSync();
 const matrix=n=>n.style.transform.slice(9,-1).split(',').map(Number);
 let fronts=elements.tiltGoals.children.filter(n=>n.className==='goal-plane goal-front');assert.equal(fronts.length,2);
 let m=matrix(fronts[0]);assert.equal(m[12],125);assert.ok(Math.abs(m[13]-272.55)<.001);assert.equal(m[6],-1);assert.equal(m[14],1.83);assert.equal(parseFloat(fronts[0].style.height),1.83);
 c.state.orientation='v';svg.viewBox.baseVal={x:0,y:0,width:800,height:1200};c.window.tiltGoalsSync();fronts=elements.tiltGoals.children.filter(n=>n.className==='goal-plane goal-front');assert.equal(fronts.length,2);m=matrix(fronts[0]);assert.ok(Math.abs(m[12]-481.7)<.001);assert.equal(m[13],550);assert.equal(m[0],1);assert.equal(m[1],0);assert.equal(m[6],-1);
});
test('perspective fitting coalesces layout changes and stays idle without a resize',()=>{
 let on=true,fits=0,observer,queue=[];
 const c=vm.createContext({document:{body:{classList:{contains:()=>on}},getElementById:()=>({})},svg:{},requestAnimationFrame:f=>queue.push(f),window:{__tiltFit:()=>fits++,addEventListener(){},ResizeObserver:true},ResizeObserver:class{constructor(cb){observer=cb;}observe(){}}});
 vm.runInContext(section('  var tiltFitPending=false;','  window.__setTilt='),c);
 observer();observer();observer();assert.equal(queue.length,1);queue.shift()();assert.equal(fits,1);assert.equal(queue.length,0);
 on=false;observer();assert.equal(queue.length,0);
 on=true;observer();queue.shift()();assert.equal(fits,2);
 assert.doesNotMatch(section('  window.__setTilt=','  window.tiltGoalsSync='),/setInterval/);
});
test('arrival frame preserves its exact photos, identity and removed tokens during playback and export',()=>{
 const c=vm.createContext({state:{},dc,lerp:(a,b,u)=>a+(b-a)*u,_curvePt:(x,y,xx,yy,c,u)=>({x:x+(xx-x)*u,y:y+(yy-y)*u}),ballRollTrack(){},_interpDrawings:()=>[],normPitchView:x=>x,applyView(){},renderTokens(){},renderDrawings(){},window:{}});
 vm.runInContext(section('function renderInterp(','function _mpPair'),c);
 const a={players:[{id:1,name:'Old',num:'8',pos:'CM',img:'old-photo',x:0,y:0},{id:2,x:0,y:0}],equipment:[{id:3,x:0,y:0}],ball:{x:0,y:0}};
 const b={players:[{id:1,name:'New',num:'10',pos:'AM',img:'cropped-photo',x:100,y:100}],equipment:[],ball:null};
 c.renderInterp(a,b,.5);assert.equal(c.state.players[0].img,'old-photo');assert.equal(c.state.players[0].x,50);
 c.renderInterp(a,b,1);assert.deepEqual(dc(c.state.players),b.players);assert.deepEqual(dc(c.state.equipment),[]);assert.equal(c.state.ball,null);
 delete b.players[0].img;c.renderInterp(a,b,1);assert.equal(c.state.players[0].img,undefined);
});
