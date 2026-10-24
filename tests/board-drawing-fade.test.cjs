const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('studio/board.html','utf8'),start=html.indexOf('function _drawKey(d){'),end=html.indexOf('function renderInterp(',start);
assert.ok(start>=0&&end>start);
const ctx={dc:x=>JSON.parse(JSON.stringify(x))};vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
const shape=(id,extra={})=>Object.assign({type:'line',pts:[{x:100,y:200},{x:300,y:400}],color:'#fff'},id?{_sceneId:id}:{},extra);
const visibility=d=>d._fade??1;
test('old and newly identified copies of the same drawing stay visible through a transition',()=>{
 for(const id of [undefined,'other-scene-id'])for(const u of [.1,.5,1]){const out=ctx._interpDrawings([shape('current-scene-id')],[shape(id)],u);assert.equal(out.length,1);assert.equal(visibility(out[0]),1);}
});
test('real content edits still crossfade even when scene identity is unchanged',()=>{
 const out=ctx._interpDrawings([shape('same')],[shape('same',{color:'#f00'})],.5);
 assert.equal(out.length,2);assert.equal(visibility(out[0]),0);assert.ok(visibility(out[1])>0&&visibility(out[1])<1);
});
test('identical drawing multiplicity is preserved while only the extra copy fades',()=>{
 const out=ctx._interpDrawings([shape('a'),shape('b')],[shape('c')],.5);
 assert.equal(out.length,2);assert.deepEqual(Array.from(out,visibility),[1,0]);
});
test('comparison keeps saved source identifiers and excludes transient opacity from serialization',()=>{
 const a=[shape('saved-a')],b=[shape('saved-b')],before=JSON.stringify([a,b]);
 const out=ctx._interpDrawings(a,b,.5);assert.equal(JSON.stringify([a,b]),before);assert.equal(out[0]._sceneId,'saved-a');assert.ok(!JSON.stringify(out).includes('_fade'));
});
test('token attachment still follows the same token while free endpoint changes still fade',()=>{
 const a=shape('a',{tk:[7,null]}),b=shape('b',{tk:[7,null],pts:[{x:120,y:220},{x:300,y:400}]});
 assert.equal(ctx._interpDrawings([a],[b],.5).length,1);
 b.pts[1].x=350;assert.equal(ctx._interpDrawings([a],[b],.5).length,2);
});
