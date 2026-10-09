'use strict';
/* 2.976 — 사용자 «페이지에 있는 애니메이션 내보내기 했을 때 한 파일로 전부 내보내기 · 페이지에 있는 애니메이션 한 파일로도 전부 내보내기».
   여러 페이지 작전판의 MP4 내보내기 창에 «범위: 이 페이지 | 여러 페이지» + 페이지 고르기(사용자 «페이지 선택해서 내보내기 할 수 있게»). 고른 페이지(장면 2개 이상)를 페이지 순서대로 한 영상에,
   페이지 사이는 움직여 넘기지 않고 바로 넘기며(다른 보드라서), 화면은 페이지마다 따로 맞춘다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};

function seqCtx(){ const c={Object,String,Math,JSON,window:{},toast(){}}; vm.createContext(c);
  vm.runInContext(slice('function animPagesSequence(on){','async function exportPagesVideo(opts){'),c); return c; }

test('pages join in page order — the first scene of every later page is a cut, captions fall back to the page name',()=>{
  const c=seqCtx();
  const on=[
    {i:0,name:'빌드업',hold:0,title:'1단계',titleColor:'#123456',frames:[{snap:{p:'a1'},cap:''},{snap:{p:'a2'},cap:'  풀백 전진 '},{snap:{p:'a3'}}]},
    {i:2,name:'코너킥',hold:1.4,title:'',titleColor:'',frames:[{snap:{p:'b1'}},{snap:{p:'b2'},hold:.3}]}];
  const s=JSON.parse(JSON.stringify(c.animPagesSequence(on)));   /* vm 쪽 배열 → 이쪽 배열 */
  assert.equal(s.length,5);
  assert.deepEqual(s.map(f=>f.snap.p),['a1','a2','a3','b1','b2'],'page order, scene order');
  assert.deepEqual(s.map(f=>!!f.cut),[false,false,false,true,false],'only the page boundary is cut');
  assert.deepEqual(s.map(f=>f.pg),[0,0,0,1,1]);
  assert.deepEqual(s.map(f=>f.capNo),[0,0,0,1,1],'badge counts pages, not scenes');
  assert.deepEqual(s.map(f=>f.cap),['빌드업','풀백 전진','빌드업','코너킥','코너킥'],'scene caption first, else the page name');
  assert.deepEqual(s.map(f=>f.hold),[.6,.6,1,1.4,1],'page hold · the last scene of a page stays at least 1s');
  assert.equal(s[0].title,'1단계');assert.equal(s[0].titleColor,'#123456');assert.equal(s[3].title,'');
  assert.equal(on[0].frames[1].cap,'  풀백 전진 ','the page list is not written to');
});

test('exportPagesVideo hands a copied scene list to the same video engine — anim.frames is never swapped',()=>{
  const ex=slice('async function exportPagesVideo(opts){','window.__exportPagesVideo=exportPagesVideo;');
  assert.match(ex,/exportVideo\(Object\.assign\(\{\},opts,\{frames:seq,pageMode:true,pageN:on\.length,fileBase:/);
  assert.match(ex,/on=on\.filter\(function\(p\)\{ return !!want\[p\.i\]; \}\)/,'only the picked pages, page order kept');
  assert.doesNotMatch(ex,/anim\.frames\s*=/,'the current page keeps its scenes (a save during export cannot mix pages in)');
  const f=slice('function animPagesForExport(){','function _animPagesBase(names){');
  assert.match(f,/p\.frames\.length>1/,'pages with one scene (a still board) are skipped');

});

test('the engine reads opts.frames, cuts between pages, frames each page on its own and loads its board first',()=>{
  const run=slice('async function _exportVideoRun(opts){','/* ===== 영상 내보내기 옵션 시트');
  assert.match(run,/const FR=opts\.frames\|\|anim\.frames;/);
  assert.doesNotMatch(run,/anim\.frames(\[|\.length|\)| of)/,'every scene read goes through FR');
  assert.doesNotMatch(run,/of anim\.frames|anim\.frames\[/);
  assert.match(run,/if\(!\(nf&&nf\.cut\)\)\{/,'no in-between motion across a page boundary');
  assert.match(run,/planHold\(s\+1, _holdOf\(s\+1\)\)/,'the next page still holds its first scene');
  assert.match(run,/const ld=!!\(opts\.pageMode&&\(i===0\|\|f\.cut\)\);/);
  assert.match(run,/if\(ld2\)\{ try\{loadSnap\(f\.snap\);\}catch\(_\)\{\} \}/,'pitch · spec · kit of that page before drawing');
  assert.match(run,/boardImageXML\(plan\[k\]\.vb\|\|uvb\)/,'per-page view box');
  assert.match(run,/_segVB\[g\]\.v169=_export169\(/,'16:9 frame measured while that page is on the board');
  assert.match(run,/sg\.reel=_toAr\(sg\.raw\)/,'reels too');
  assert.match(run,/NB=opts\.capN\|\|opts\.pageN\|\|N/);
  assert.match(run,/_unit=opts\.capN\?"슬라이드 ":\(opts\.pageN\?"페이지 ":"장면 "\)/);
  assert.match(run,/titleBar\(meta\)/,'reel title per page');
});

test('the video sheet offers «이 페이지 | 여러 페이지» with a page picker only on a multi-page board with animation elsewhere, and remembers it',()=>{
  const sh=slice('function exportVideoSheet(mode){','/* 2.970 — 미팅 슬라이드 → 영상.');
  assert.match(sh,/var showScope=!meeting&&allN>0&&!\(allN===1&&curOK\);/);
  assert.match(sh,/else if\(!curOK&&!allN\)\{/,'a page without scenes can still export the other pages');
  assert.match(sh,/seg\("범위",\[\["이 페이지",0\],\["여러 페이지",1\]\],"scope"\)/);
  assert.match(sh,/cb\.disabled=!ok;/,'a page with one scene cannot be picked');
  assert.match(sh,/nm\.textContent=p\.name;/);
  assert.match(sh,/ps_anim_export_scope_v1/);
  assert.match(sh,/if\(!b\|\|b\.disabled\)return;/,'«이 페이지» is disabled when this page has one scene');
  assert.doesNotMatch(slice('  function buildPicker(){','  function paintScope(){'),/innerHTML/,'page names are user text — textContent, never innerHTML');
  const go=slice('  ov.querySelector("#evGo").onclick=async function(){','\n}');
  assert.ok(go.indexOf('_animPickSaveTarget(')<go.indexOf('close();'),'pick before the sheet closes');
  assert.match(go,/else if\(_all\)exportPagesVideo\(\{height:opt\.height,fps:opt\.fps,reel:!!opt\.reel,target:_t,fileBase:_base,pick:_sel\.map\(function\(p\)\{return p\.i;\}\)\}\)/);
  assert.match(go,/if\(_all&&!_sel\.length\)\{/,'nothing picked → nothing made');
});

test('page module: an export list with copies (no thumbnails), and nothing is captured into a page while exporting',()=>{
  const pm=slice('  function capture(strict){','  function ensure(){');
  assert.match(pm,/if\(window\.__animExport\)return;/);
  const el=slice('    exportList:function(){','    /* 2.975 — 내보내기 파일 이름용');
  assert.match(el,/capture\(\);/,'the current page is taken first');
  assert.match(el,/_clone\(a\.frames\)/);assert.match(el,/delete f\.thumb/);
  assert.match(el,/\|\|\("페이지 "\+\(i\+1\)\)/,'an unnamed page is «페이지 n»');
});

test('file name: the board name and the picked pages',()=>{
  const code=slice('function _animExportName(ext,base){','/* ══ 2.972 · 내보내기 진행 카드');
  const c={window:{__psPages:{curName:()=>'코너킥',linkAll:()=>[]}},document:{body:{classList:{contains:()=>false}},getElementById:()=>null}};
  vm.createContext(c);vm.runInContext(code+';this._b=_animDefaultBase;this._p=function(){return _animDefaultBase(true);};'+slice('function _animPagesBase(names){','\nfunction animPagesSequence(')+';this._pb=_animPagesBase;',c);
  assert.equal(c._b(),'작전판 - 코너킥');assert.equal(c._p(),'작전판');
  assert.equal(c._pb(),'작전판 - 모든 페이지','every animated page picked');
  assert.equal(c._pb(['빌드업','코너킥']),'작전판 - 빌드업·코너킥','some pages → their names');
  assert.equal(c._pb(['a/b']),'작전판 - a_b','file-safe');
  assert.equal(c._pb(Array(9).fill('아주 긴 페이지 이름')),'작전판 - 페이지 9개','too long → a count');
});

test('exportPagesVideo makes only the picked pages, in page order',async()=>{
  const calls=[],toasts=[];
  const c={Object,String,Math,JSON,Array,window:{},toast:m=>toasts.push(m),
    exportVideo:o=>{calls.push(o);return 'made';},_animDefaultBase:()=>'작전판',
    animPagesForExport:()=>({all:[],off:0,on:[
      {i:0,name:'빌드업',hold:.6,frames:[{snap:1},{snap:2}]},{i:1,name:'압박',hold:.6,frames:[{snap:3},{snap:4}]},{i:3,name:'코너킥',hold:.6,frames:[{snap:5},{snap:6}]}]})};
  vm.createContext(c);
  vm.runInContext(slice('function _animPagesBase(names){','window.__exportPagesVideo=exportPagesVideo;'),c);
  assert.equal(await c.exportPagesVideo({pick:[3,0],height:720}),'made');
  const o=JSON.parse(JSON.stringify(calls[0]));
  assert.deepEqual(o.frames.map(f=>f.snap),[1,2,5,6],'빌드업 then 코너킥 — page order, not pick order');
  assert.equal(o.pageN,2);assert.equal(o.fileBase,'작전판 - 빌드업·코너킥');assert.equal(o.height,720);
  assert.deepEqual(o.frames.map(f=>f.cut),[false,false,true,false]);
  await c.exportPagesVideo({});
  assert.equal(JSON.parse(JSON.stringify(calls[1])).fileBase,'작전판 - 모든 페이지','no pick → every animated page');
  assert.equal(calls[1].frames.length,6);
  await c.exportPagesVideo({pick:[]});
  assert.equal(calls.length,2,'nothing picked → nothing made');assert.deepEqual(toasts,['내보낼 페이지를 골라 주세요']);
});
