'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
const part=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+a.length));
function fixture(){
 const c=vm.createContext({Intl,encodeURIComponent,Array,JSON,Math,window:{__meet:{idx:()=>0}},anim:{slides:[{snap:{id:'saved'},title:'제목',points:['메모']}]},
  dc:v=>JSON.parse(JSON.stringify(v)),captureSnap:()=>({id:'live'}),boardThumbSVG:()=>'<svg/>',
  document:{createElement:()=>({getContext:()=>({font:'24px',measureText(t){return {width:Array.from(t).length*parseInt(this.font.replace('bold ',''))*0.9};}})})},
  esc:s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),inkifySVG:s=>s.replace('navy','white')});
 vm.runInContext(part('function meetingPdfSlides(){','function vaultPrintSpec('),c);return c;
}
test('export snapshots include unsaved current scene and never overwrite slide history',()=>{
 const c=fixture(),before=JSON.stringify(c.anim);const out=c.meetingPdfSlides();assert.equal(out[0].snap.id,'live');assert.equal(JSON.stringify(c.anim),before);out[0].points.push('new');assert.equal(c.anim.slides[0].points.length,1);
});
test('empty meeting exports the current board',()=>{const c=fixture();c.anim.slides=[];assert.equal(c.meetingPdfSlides()[0].snap.id,'live');});
test('portrait and landscape produce distinct A4 layout with every slide in order',()=>{
 const c=fixture(),slides=[{title:'전개',points:['측면']},{title:'수비',points:['압박']}];
 for(const orientation of ['portrait','landscape']){const html=c.buildMeetingPrintDoc(slides,'미팅',{orientation});assert.ok(html.includes('size:A4 '+orientation));assert.equal((html.match(/class="page mp-page"/g)||[]).length,2);assert.ok(html.indexOf('전개')<html.indexOf('수비'));assert.ok(html.includes('flex-direction:column'));assert.ok(html.includes('margin:6mm'));for(const page of html.split('class="page mp-page"').slice(1))assert.ok((page.match(/class="mp-line /g)||[]).length<=4);}
});
test('long notes paginate without losing Korean, long words, emoji, or the final point',()=>{
 const c=fixture(),message='가나다ABC👨‍👩‍👧‍👦'.repeat(110),slides=[{title:'긴 제목'.repeat(25),points:[message,'마지막 확인']}],before=JSON.stringify(slides);
 for(const orientation of ['portrait','landscape']){const html=c.buildMeetingPrintDoc(slides,'미팅',{orientation});assert.ok((html.match(/class="page mp-page"/g)||[]).length>2);const text=Array.from(html.matchAll(/class="mp-line point">(.*?)<\/div>/g),m=>m[1]).join('');assert.equal(text,'• '+message+'• 마지막 확인');assert.ok(html.includes('계속'));}
 assert.equal(JSON.stringify(slides),before);
});
test('titles and notes are escaped and legacy SVG stays inside inert image data',()=>{
 const c=fixture(),html=c.buildMeetingPrintDoc([{title:'<script>x</script>',points:['<img onerror="x">'],thumb:'<svg><script>bad()</script></svg>'}],'미팅',{});
 assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img onerror'),false);assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('data:image/svg+xml'));
});
test('full-board picture restores board and selections even when renderer fails',()=>{
 const c=fixture(),loaded=[];c.sel={id:'p'};c.multiSel=['a'];c.loadSnap=s=>loaded.push(s.id);c.renderTokens=()=>{};c.renderDrawings=()=>{};c.boardImageXML=()=>{throw Error('render fail');};
 assert.throws(()=>c.meetingPdfPicture({snap:{id:'other'}}));assert.deepEqual(loaded,['other','live']);assert.equal(c.sel.id,'p');assert.equal(c.multiSel[0],'a');
});
test('saved meeting dispatch exports its slides with orientation selector, not a drill',()=>{
 const c=fixture();vm.runInContext(part('function vaultPrintSpec(','async function vaultPdfPayload('),c);let shown;c.printStandaloneB=(...args)=>shown=args;
 c.printDrill({type:'meeting',name:'저장 미팅',slides:[{title:'첫 장면'},{title:'둘째 장면'}]});assert.ok(shown[0].includes('둘째 장면'));assert.equal(shown[4].orientation,true);assert.ok(shown[1]({orientation:'landscape'}).includes('size:A4 landscape'));
});
test('orientation rebuild updates PDF page geometry as well as preview document',()=>{
 const states=[],frame={classList:{toggle:(...x)=>states.push(x)},srcdoc:''};const c=vm.createContext({$:()=>frame,_ppbOpts:{orientation:'landscape'},_ppbRebuild:o=>'@page{size:A4 '+o.orientation+';}'});vm.runInContext(part('function _ppbRefresh(){','function _ppbFitMeeting(){'),c);c._ppbRefresh();assert.deepEqual(states,[['land',true]]);c._ppbOpts.orientation='portrait';c._ppbRefresh();assert.deepEqual(states[1],['land',false]);
});

test('landscape PDF renders horizontal pitch without changing the saved or active board',()=>{
 const c=fixture(),loaded=[];c.sel={id:'p'};c.multiSel=['p'];c.captureSnap=()=>({id:'active',orientation:'v',spFlip:true});c.loadSnap=s=>loaded.push({...s});c.renderTokens=()=>{};c.renderDrawings=()=>{};c.boardImageXML=()=>({xml:'<svg/>'});
 const slide={snap:{id:'saved',orientation:'v',spFlip:true,players:[{x:10,y:20}]}};const before=JSON.stringify(slide);
 assert.equal(c.meetingPdfPicture(slide,true),'<svg/>');assert.equal(loaded[0].orientation,'h');assert.equal(loaded[0].spFlip,false);assert.equal(loaded[0].players[0].x,10);assert.equal(loaded[1].orientation,'v');assert.equal(loaded[1].spFlip,true);assert.equal(JSON.stringify(slide),before);
 loaded.length=0;c.meetingPdfPicture(slide,false);assert.equal(loaded[0].orientation,'v');
});

test('PDF pitch fills its entire box even when the board aspect ratio differs',()=>{
 const c=fixture();
 for(const orientation of ['portrait','landscape']){
  const html=c.buildMeetingPrintDoc([{title:'확대',thumb:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet"><rect width="1000" height="600"/></svg>'}],'미팅',{orientation});
  const image=decodeURIComponent(html.match(/src="data:image\/svg\+xml;charset=utf-8,([^"]+)/)[1]);
  assert.ok(image.includes('preserveAspectRatio="none"'));assert.equal(image.includes('xMidYMid meet'),false);assert.ok(html.includes('object-fit:fill'));
 }
});
