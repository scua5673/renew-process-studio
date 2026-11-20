const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../studio/board-multipitch.js'),'utf8'),board=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
function E(tag,attrs){return {tag,attrs,children:[],appendChild(n){this.children.push(n);}};}
for(const futsal of [false,true])test('multi-pitch flat goal rectangles and no-goal cards '+futsal,()=>{
 const start=app.indexOf('      function pitch(x0,y0,w,h,goalDepthCap,showGoals,pdir){'),end=app.indexOf('      var grp=E(',start);
 const specs=vm.runInNewContext('('+board.match(/const PITCH_SPECS=(\{[\s\S]*?\n\});/)[1]+')');
 const c=vm.createContext({E,_goalNetSeq:0,_lc:'#fff',ST:{stroke:'#fff'},lines:true,spec:specs[futsal?'futsal':'fifa']});vm.runInContext(app.slice(start,end),c);
 const main=c.pitch(10,20,300,500,15),small=c.pitch(400,20,130,240,10,false);
 const goals=main.children.filter(n=>n.attrs.class==='ps-pitch-goal');assert.equal(goals.length,2);assert.equal(small.children.filter(n=>n.attrs.class==='ps-pitch-goal').length,0);assert.ok(small.children.some(n=>n.tag==='rect'));
 /* 3.338 — 선 골대(목업 B안): 둥근 ㄷ 자 한 줄 — 첫 기둥 · 마지막 기둥은 곧고 두 끝이 골라인 위, 망 무늬 없음 · 3D 가 읽는 입구 선은 남는다 */
 for(const g of goals){const frame=g.children.find(n=>n.attrs.class==='ps-pitch-goal-frame');const a=frame.attrs.d.match(/-?\d+(?:\.\d+)?/g).map(Number),L=a.length;assert.equal(a[0],a[2]);assert.equal(a[L-2],a[L-4]);assert.equal(a[1],a[L-1]);assert.match(frame.attrs.d,/Q/);assert.ok(!g.children.some(n=>n.tag==='defs'||n.attrs.class==='ps-pitch-goal-net'));assert.ok(g.children.some(n=>n.attrs.class==='ps-pitch-goal-mouth'));}
 /* 3.340 — 가로 카드(운동장 여럿 새 배치): 선은 돌린 안쪽 g 에, 골대는 world 좌표로 바깥 g 에 — 입구 선은 세로(3D 가 data-side left/right 로 바깥을 안다) */
 const hz=c.pitch(10,20,500,300,15,undefined,'h');
 assert.equal(hz.attrs['data-pitch-rect'],'10,20,500,300');assert.equal(hz.attrs['data-pitch-dir'],'h');assert.equal(main.attrs['data-pitch-dir'],'v');
 const body=hz.children.find(n=>n.attrs.class==='ps-pitch-body');assert.equal(body.attrs.transform,'matrix(0 -1 1 0 10 320)');assert.ok(body.children.some(n=>n.tag==='rect'&&n.attrs.width===300&&n.attrs.height===500),'안쪽은 세로 카드 좌표(폭 300 · 길이 500)');
 const hg=hz.children.filter(n=>n.attrs.class==='ps-pitch-goal');assert.deepEqual(hg.map(g=>g.attrs['data-side']),['left','right']);
 hg.forEach((g,i)=>{const m=g.children.find(n=>n.attrs.class==='ps-pitch-goal-mouth').attrs;assert.equal(m.x1,m.x2);assert.equal(m.x1,i?510:10);assert.ok(Math.abs((m.y1+m.y2)/2-170)<1e-9,'입구 가운데 = 카드 가운데 y');});
});
test('multi-pitch watermark corners follow the layout instead of the hidden single pitch',()=>{
 const c=vm.createContext({el:E,PR:()=>({L:50,R:1050,T:40,B:700}),W:1100,H:740,state:{orientation:'h',pitchN:5},pitchViewKey:()=> 'full',svg:{querySelectorAll:()=>[{getAttribute:()=>'-200,20,600,650'},{getAttribute:()=> '450,20,400,300'}]},document:{documentElement:{dataset:{pitch:'white'}}}});
 vm.runInContext(board.slice(board.indexOf('function appendBoardExportWatermarks('),board.indexOf('function _wmDraw')),c);const root=E('svg',{});root.querySelector=()=>null;c.appendBoardExportWatermarks(root,[-250,0,1200,740]);const marks=root.children[0].children;assert.equal(marks.length,2);assert.equal(marks[0].attrs.x,-200);assert.equal(marks[1].attrs.x,850);assert.equal(marks[0].attrs.fill,'#20242c');
});
