const test=require('node:test'),assert=require('node:assert/strict');
const {positionTexts}=require('../studio/board-shape-menu.js'),{blankSnap,startSlides}=require('../studio/board-meet-form.js');
const text=(id,word,x,extra={})=>({type:'text',_sceneId:id,text:word,pts:[{x,y:90}],color:'#fff',...extra});
test('text position applies before and after the selected scene without copying words, styles or unrelated content',()=>{
 const now=text('same','후반',420),before=text('same','전반',100,{color:'#123456',size:27,locked:true}),later=text('same','다른 메모',600,{bg:'#000',rot:45});
 const frames=[{snap:{drawings:[before],players:[{id:8,x:90}]},caption:'keep',thumb:'old'},{snap:{drawings:[now]}},{snap:{drawings:[later]}}],original=JSON.stringify(frames),r=positionTexts(frames,1,[now]);
 assert.equal(r.changed,2);assert.equal(JSON.stringify(frames),original);assert.equal(r.frames[1],frames[1]);
 for(const i of [0,2]){assert.equal(r.frames[i].snap.drawings[0].pts[0].x,420);assert.equal(r.frames[i].thumb,undefined);const d={...r.frames[i].snap.drawings[0],pts:frames[i].snap.drawings[0].pts};assert.deepEqual(d,frames[i].snap.drawings[0]);}
 assert.equal(r.frames[0].caption,'keep');assert.deepEqual(r.frames[0].snap.players,[{id:8,x:90}]);
});
test('missing text stays deleted; a unique legacy label matches while ambiguous labels and shapes stay unchanged',()=>{
 const now=text('new','표제',400),one=text('legacy','표제',700),a=text('a','표제',100),b=text('b','표제',200),shape={type:'rect',pts:[{x:10,y:20}]};
 const fs=[{snap:{drawings:[now]}},{snap:{drawings:[shape]}},{snap:{drawings:[one,shape]}},{snap:{drawings:[a,b]}}],r=positionTexts(fs,0,[now]);
 assert.equal(r.changed,1);assert.equal(r.skipped,1);assert.equal(r.frames[1],fs[1]);assert.equal(r.frames[3],fs[3]);assert.equal(r.frames[2].snap.drawings[0]._sceneId,'legacy');assert.equal(r.frames[2].snap.drawings[0].pts[0].x,400);assert.equal(r.frames[2].snap.drawings[1],shape);
});
test('unchanged or malformed text produces no scene writes',()=>{
 const d=text('a','제목',40),fs=[{snap:{drawings:[d]}},{snap:{drawings:[d]}}],r=positionTexts(fs,0,[d,text('b','bad',NaN)]);assert.equal(r.changed,0);assert.equal(r.frames[1],fs[1]);
});
test('meeting categories retain only chosen titles and empty the pitch without changing the source',()=>{
 const sn={players:[{id:1}],equipment:[{id:2}],ball:{x:2,y:3},drawings:[{type:'text'}],pitchSpec:'u12',tokenScale:.5},list=[{title:'BEST 8',snap:sn},{title:'빌드업',snap:sn},{title:'세트피스',snap:sn}],before=JSON.stringify(list),out=startSlides(list,'categories',[0,2]);
 assert.deepEqual(out.map(x=>x.title),['BEST 8','세트피스']);for(const s of out){assert.deepEqual(s.snap.players,[]);assert.deepEqual(s.snap.equipment,[]);assert.deepEqual(s.snap.drawings,[]);assert.equal(s.snap.ball,null);assert.equal(s.snap.pitchSpec,'u12');assert.equal(s.snap.tokenScale,.5);}assert.equal(JSON.stringify(list),before);out[0].snap.pitchSpec='fifa';assert.equal(sn.pitchSpec,'u12');
 assert.deepEqual(startSlides(list,'categories',[]),[]);
});
test('empty meeting creates one unnamed empty pitch; filled mode retains the requested template content',()=>{
 const list=[{title:'하이블록',snap:{players:[{id:1}],drawings:[],ball:{x:8,y:9}}},{title:'로우블록',snap:{players:[{id:2}]}}];
 const empty=startSlides(list,'empty',[]);assert.equal(empty.length,1);assert.equal(empty[0].title,'');assert.deepEqual(empty[0].snap.players,[]);assert.equal(empty[0].snap.ball,null);
 assert.equal(startSlides(list,'filled',[1])[0].snap.players[0].id,2);assert.deepEqual(blankSnap(null),{players:[],equipment:[],drawings:[],ball:null});
});
