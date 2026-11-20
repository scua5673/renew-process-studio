const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../studio/board-multipitch.js'),'utf8'),board=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
function E(tag,attrs){return {tag,attrs,children:[],appendChild(n){this.children.push(n);}};}
for(const futsal of [false,true])test('multi-pitch flat goal rectangles and no-goal cards '+futsal,()=>{
 const start=app.indexOf('      function pitch(x0,y0,w,h,goalDepthCap,showGoals){'),end=app.indexOf('      var grp=E(',start);
 const specs=vm.runInNewContext('('+board.match(/const PITCH_SPECS=(\{[\s\S]*?\n\});/)[1]+')');
 const c=vm.createContext({E,_goalNetSeq:0,_lc:'#fff',ST:{stroke:'#fff'},lines:true,spec:specs[futsal?'futsal':'fifa']});vm.runInContext(app.slice(start,end),c);
 const main=c.pitch(10,20,300,500,15),small=c.pitch(400,20,130,240,10,false);
 const goals=main.children.filter(n=>n.attrs.class==='ps-pitch-goal');assert.equal(goals.length,2);assert.equal(small.children.filter(n=>n.attrs.class==='ps-pitch-goal').length,0);assert.ok(small.children.some(n=>n.tag==='rect'));
 /* 3.338 — 선 골대(목업 B안): 둥근 ㄷ 자 한 줄 — 첫 기둥 · 마지막 기둥은 곧고 두 끝이 골라인 위, 망 무늬 없음 · 3D 가 읽는 입구 선은 남는다 */
 for(const g of goals){const frame=g.children.find(n=>n.attrs.class==='ps-pitch-goal-frame');const a=frame.attrs.d.match(/-?\d+(?:\.\d+)?/g).map(Number),L=a.length;assert.equal(a[0],a[2]);assert.equal(a[L-2],a[L-4]);assert.equal(a[1],a[L-1]);assert.match(frame.attrs.d,/Q/);assert.ok(!g.children.some(n=>n.tag==='defs'||n.attrs.class==='ps-pitch-goal-net'));assert.ok(g.children.some(n=>n.attrs.class==='ps-pitch-goal-mouth'));}
});
test('multi-pitch watermark corners follow the layout instead of the hidden single pitch',()=>{
 const c=vm.createContext({el:E,PR:()=>({L:50,R:1050,T:40,B:700}),W:1100,H:740,state:{orientation:'h',pitchN:5},pitchViewKey:()=> 'full',svg:{querySelectorAll:()=>[{getAttribute:()=>'-200,20,600,650'},{getAttribute:()=> '450,20,400,300'}]},document:{documentElement:{dataset:{pitch:'white'}}}});
 vm.runInContext(board.slice(board.indexOf('function appendBoardExportWatermarks('),board.indexOf('function _wmDraw')),c);const root=E('svg',{});root.querySelector=()=>null;c.appendBoardExportWatermarks(root,[-250,0,1200,740]);const marks=root.children[0].children;assert.equal(marks.length,2);assert.equal(marks[0].attrs.x,-200);assert.equal(marks[1].attrs.x,850);assert.equal(marks[0].attrs.fill,'#20242c');
});
