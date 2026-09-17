'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
const part=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+a.length));
function fixture(){
 const c=vm.createContext({Intl,encodeURIComponent,Array,JSON,Math,window:{__meet:{idx:()=>0}},anim:{slides:[{snap:{id:'saved'},title:'제목',points:['메모']}]},
  dc:v=>JSON.parse(JSON.stringify(v)),captureSnap:()=>({id:'live'}),boardThumbSVG:()=>'<svg/>',
  document:{createElement:()=>({getContext:()=>({font:'24px',measureText(t){return {width:Array.from(t).length*parseInt(this.font.replace('bold ',''))*0.9};}})})},
  esc:s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),inkifySVG:s=>s.replace('navy','white')});
 vm.runInContext(part('function meetingPdfOrientation(slides){','function vaultPrintSpec('),c);return c;
}
test('export snapshots include unsaved current scene and never overwrite slide history',()=>{
 const c=fixture(),before=JSON.stringify(c.anim);const out=c.meetingPdfSlides();assert.equal(out[0].snap.id,'live');assert.equal(JSON.stringify(c.anim),before);out[0].points.push('new');assert.equal(c.anim.slides[0].points.length,1);
});
test('empty meeting exports the current board',()=>{const c=fixture();c.anim.slides=[];assert.equal(c.meetingPdfSlides()[0].snap.id,'live');});
test('portrait and landscape produce distinct A4 layout with every slide in order',()=>{
 const c=fixture(),slides=[{title:'전개',points:['측면']},{title:'수비',points:['압박']}];
 for(const orientation of ['portrait','landscape']){const html=c.buildMeetingPrintDoc(slides,'미팅',{orientation});assert.ok(html.includes('size:A4 '+orientation));assert.equal((html.match(/class="page mp-page"/g)||[]).length,2);assert.ok(html.indexOf('전개')<html.indexOf('수비'));assert.ok(html.includes('gap:'+(orientation==='portrait'?'8px;flex-direction:column':'16px;flex-direction:row')));assert.ok(html.includes('.mp-notes{width:'+(orientation==='portrait'?'100%':'320px')));assert.ok(html.includes('margin:6mm'));for(const page of html.split('class="page mp-page"').slice(1))assert.ok((page.match(/class="mp-line /g)||[]).length<=4);}
});
test('long notes paginate without losing Korean, long words, emoji, or the final point',()=>{
 const c=fixture(),message='가나다ABC👨‍👩‍👧‍👦'.repeat(110),slides=[{title:'긴 제목'.repeat(25),points:[message,'마지막 확인']}],before=JSON.stringify(slides);
 for(const orientation of ['portrait','landscape']){const html=c.buildMeetingPrintDoc(slides,'미팅',{orientation});assert.ok((html.match(/class="page mp-page"/g)||[]).length>2);const text=Array.from(html.matchAll(/class="mp-line point"[^>]*>(.*?)<\/div>/g),m=>m[1]).join('');assert.equal(text,'• '+message+'• 마지막 확인');assert.ok(html.includes('계속'));}
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
test('saved page orientation survives serialization and does not inherit a different meeting',()=>{
 const c=fixture();c.window.__meetingPdfOrientation='landscape';
 const saved=JSON.parse(JSON.stringify([{pdfOrientation:'portrait',snap:{orientation:'h'}}]));
 assert.equal(c.meetingPdfOrientation(saved),'portrait');assert.equal(c.meetingPdfOrientation([{snap:{orientation:'v'}}]),'portrait');assert.equal(c.meetingPdfOrientation([{snap:{orientation:'h'}}]),'landscape');
});
test('editor export opens with the selected page orientation and the same shared document',()=>{
 const c=fixture();c.anim.slides[0].pdfOrientation='landscape';let args;c.printStandaloneB=(...a)=>args=a;c.exportMeetingPDF();
 assert.equal(args[4].initialOrientation,'landscape');assert.ok(args[0].includes('size:A4 landscape'));assert.equal(args[0],args[1]({orientation:'landscape'}));
});

test('landscape uses the full notes column while portrait retains four lines',()=>{
 const c=fixture(),slides=[{title:'제목',pageBrand:'우리팀',points:Array.from({length:12},(_,i)=>'메모 '+i)}];
 const land=c.buildMeetingPrintDoc(slides,'미팅',{orientation:'landscape'}),port=c.buildMeetingPrintDoc(slides,'미팅',{orientation:'portrait'});
 assert.equal((land.match(/class="page mp-page"/g)||[]).length,1);assert.equal((port.match(/class="page mp-page"/g)||[]).length,4);assert.match(land,/class="mp-brand"[^>]*>우리팀<\/b>/);
});

test('custom type styles persist in PDF and large text paginates by height',()=>{const c=fixture(),slide={title:'제목',points:Array(35).fill('메모'),textStyles:{title:{size:32,weight:800,color:'#ff0000'},point:{size:48,weight:400,color:'#008800'},brand:{size:18,weight:500,color:'#0000ff'}}};const html=c.buildMeetingPrintDoc([JSON.parse(JSON.stringify(slide))],'미팅',{orientation:'landscape'});assert.ok(html.includes('font-size:32px;font-weight:800;color:#ff0000'));assert.ok(html.includes('font-size:18px;font-weight:500;color:#0000ff'));for(const page of html.split('class="page mp-page"').slice(1))assert.ok((page.match(/class="mp-line /g)||[]).length<=10);assert.ok((html.match(/class="page mp-page"/g)||[]).length>=4);});
