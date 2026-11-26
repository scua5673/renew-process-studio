'use strict';
/* 3.381 — 보관함 훈련 파일 PDF «넣을 훈련» 고르기(사용자 «원하는 페이지만 골라서 인쇄» · 목업 UI-보관함-훈련-골라인쇄 A안).
   ① vaultPrintSpec 은 opts.pick 의 훈련만 현장 시트에 넘기고, 번호(nums)는 파일 순서 그대로 · 고를 목록(pick)은 이름 · 분(분×세트)
   ② buildFieldSheetDoc 은 nums 로 번호를 찍고, 빈 칸은 번호 없이 · 머리글 분 · 개수는 고른 것만
   ③ 칩 줄 — 누르면 끄고 켬, 마지막 하나는 남음, «모두»는 전부, 열 때마다 전부 켜진 채 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
const part=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);};
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const TR=[['웜업 론도',12,1],['패스 앤 무브',15,1],['3v2 전환',6,3],['포지션 게임',20,1],['SSG',24,1],['쿨다운',8,1]].map(([name,minutes,sets])=>({name,minutes,sets,focus:'att',snap:{},thumb:'<svg/>'}));

function specCtx(){
  const seen=[];const c=vm.createContext({Math,Array,String,JSON,esc,seen,
    buildFieldSheetDoc:(sess,opts)=>{seen.push({sess,opts});return '@page{size:A4 landscape;}FS';},
    buildDrillPage:()=>'ONE',printDocHTML:(t,o,b)=>b,DRILL_PDF_CSS:'',meetingPdfOrientation:()=>'portrait',buildMeetingPrintDoc:()=>'MEET'});
  vm.runInContext(part('function vaultPrintSpec(','async function vaultPdfPayload('),c);return c;
}
function sheetCtx(){
  const c=vm.createContext({Math,Array,String,JSON,esc,session:{drills:[]},
    focusOf:()=>({c:'#123456',label:'공격'}),inkifySVG:s=>s,printThumb:()=>'<svg/>',drillScenesAll:d=>[d],fsxHeadcount:()=>'',fsxRoster:()=>'',
    BLANK_PITCH:'<svg/>',_legacyMethodText:()=>'',printDocHTML:(t,o,b)=>b,FIELD_SHEET_CSS:'',drillTotalMin:d=>(+d.minutes||0)*((+d.sets>0?+d.sets:1))});
  vm.runInContext(part('function buildFieldSheetDoc(','function printFieldSheet('),c);return c;
}
const nos=html=>Array.from(html.matchAll(/class="fsx-no">([^<]*)</g),m=>m[1]);

test('① 전부(고르기 없음) — 6개 그대로 · 번호 표 없음 · 고를 목록은 이름과 분×세트',()=>{
  const c=specCtx(),spec=c.vaultPrintSpec({name:'화요일',trainings:TR},'화요일',{});
  assert.equal(c.seen[0].sess.drills.length,6);assert.equal(c.seen[0].sess.nums,null);assert.equal(spec.land,true);
  assert.deepEqual(JSON.parse(JSON.stringify(spec.pick)),[{name:'웜업 론도',min:12},{name:'패스 앤 무브',min:15},{name:'3v2 전환',min:18},{name:'포지션 게임',min:20},{name:'SSG',min:24},{name:'쿨다운',min:8}]);
});
test('① 고른 훈련만 · 번호는 파일 순서 그대로 · 순서는 파일 순서',()=>{
  const c=specCtx();c.vaultPrintSpec({name:'화요일',trainings:TR},'화요일',{pick:[4,1]});
  const s=c.seen[0].sess;assert.deepEqual(Array.from(s.drills,d=>d.name),['패스 앤 무브','SSG']);assert.deepEqual(Array.from(s.nums),[2,5]);
});
test('① 하나만 남아도 현장 시트(가로) 그대로 · 빈 · 잘못된 고르기는 전부',()=>{
  const c=specCtx();const one=c.vaultPrintSpec({trainings:TR},'f',{pick:[2]});assert.equal(one.land,true);assert.equal(c.seen[0].sess.drills.length,1);assert.deepEqual(Array.from(c.seen[0].sess.nums),[3]);
  c.vaultPrintSpec({trainings:TR},'f',{pick:[]});assert.equal(c.seen[1].sess.drills.length,6);assert.equal(c.seen[1].sess.nums,null);
  c.vaultPrintSpec({trainings:TR},'f',{pick:[9,-1,'x']});assert.equal(c.seen[2].sess.drills.length,6);
});
test('① 훈련 하나 · 미팅 파일은 고를 목록 없음',()=>{
  const c=specCtx();assert.equal(c.vaultPrintSpec({trainings:[TR[0]]},'f',{}).pick,undefined);
  assert.equal(c.vaultPrintSpec({type:'meeting',slides:[{title:'a'}]},'f',{}).pick,undefined);
});
test('① printDrill 이 고를 목록을 창에 넘기고, 다시 그릴 때 opts.pick 을 쓴다',()=>{
  const c=specCtx();let args;c.printStandaloneB=(...a)=>args=a;c.printDrill({name:'화요일',trainings:TR});
  assert.equal(args[4].pick.length,6);assert.equal(args[4].perPage,true);
  args[1]({pick:[0,5]});assert.deepEqual(Array.from(c.seen.at(-1).sess.nums),[1,6]);
  c.printDrill({name:'한 개',trainings:[TR[0]]});assert.equal(args[4].pick,null);
});
test('② 현장 시트 — 번호는 nums, 빈 칸은 번호 없이, 머리글 분 · 개수는 고른 것만',()=>{
  const c=sheetCtx();
  const h4=c.buildFieldSheetDoc({title:'화요일',drills:[TR[1],TR[4]],nums:[2,5]},{});
  assert.deepEqual(nos(h4),['2','5','','']);assert.match(h4,/<b>39분<\/b> · 2개/);assert.doesNotMatch(h4,/>훈련 3</);
  const h2=c.buildFieldSheetDoc({title:'화요일',drills:[TR[2]],nums:[3]},{perPage:2});assert.deepEqual(nos(h2),['3','']);
  const all=c.buildFieldSheetDoc({title:'화요일',drills:TR.slice(0,5)},{});assert.deepEqual(nos(all),['1','2','3','4','5','6','7','8'],'고르기 없으면 예전처럼 통번호(빈 칸 포함)');
});
test('③ 칩 줄(board-print-pick.js) — 끄고 켜기 · 마지막 하나 · 모두 · 이름 글자 막기',()=>{
  const P=require('../studio/board-print-pick.js');
  const list=[{name:'가',min:10},{name:'<b>나</b>',min:20},{name:'다',min:5}],opts={pick:null};
  let h=P.html(list,opts);assert.equal((h.match(/ppb-chip on/g)||[]).length,3);assert.match(h,/3\/3 · 35분/);assert.doesNotMatch(h,/data-pall/);
  assert.match(h,/&lt;b&gt;나&lt;\/b&gt;/);assert.doesNotMatch(h,/<b>나<\/b>/,'이름은 글자로');
  const chip=i=>({closest:q=>q==='[data-pi]'?{getAttribute:()=>String(i)}:null}),all={closest:q=>q==='[data-pall]'?{}:null};
  assert.equal(P.tap(list,opts,chip(1)),true);assert.deepEqual(opts.pick,[0,2]);h=P.html(list,opts);assert.match(h,/2\/3 · 15분/);assert.match(h,/data-pall/);
  P.tap(list,opts,chip(0));assert.deepEqual(opts.pick,[2]);
  assert.equal(P.tap(list,opts,chip(2)),false,'마지막 하나는 남는다');assert.deepEqual(opts.pick,[2]);assert.match(P.html(list,opts),/aria-disabled="true"/);
  P.tap(list,opts,chip(0));assert.deepEqual(opts.pick,[0,2],'다시 켜면 파일 순서로');
  assert.equal(P.tap(list,opts,all),true);assert.equal(opts.pick,null);assert.equal(P.tap(list,opts,all),false,'이미 전부');
  P.tap(list,opts,chip(0));P.tap(list,opts,chip(1));P.tap(list,opts,chip(1));assert.equal(opts.pick.length,2);P.tap(list,opts,chip(0));assert.equal(opts.pick,null,'다 켜지면 null(전부)');
  assert.equal(P.html([list[0]],opts),'','하나뿐이면 줄 없음');assert.equal(P.html(null,opts),'');
  const box={hidden:false,innerHTML:'x'};P.paint(box,null,opts);assert.equal(box.hidden,true);assert.equal(box.innerHTML,'');P.paint(box,list,opts);assert.equal(box.hidden,false);
});
test('③ board.html 배선 — 열 때마다 전부 켜진 채 · 닫으면 목록 비움 · 모듈 싣기 · sw 미리 받기',()=>{
  const open=part('function printStandaloneB(','function buildSessionPrintDoc(');
  assert.match(open,/_ppbOpts\.pick=null;_ppbPickList=\(settings&&Array\.isArray\(settings\.pick\)&&settings\.pick\.length>1\)\?settings\.pick:null;if\(window\.PSPrintPick\)PSPrintPick\.paint\(\$\("ppbPick"\),_ppbPickList,_ppbOpts\);/);
  assert.match(open,/<div class="ppb-pick" id="ppbPick" role="group" aria-label="넣을 훈련" hidden><\/div>/);
  assert.match(open,/PSPrintPick\.mount\(\$\("ppbPick"\),function\(\)\{return \{list:_ppbPickList,opts:_ppbOpts,refresh:_ppbRefresh\};\}\);/);
  assert.match(part('function closePrintPrevB(){','\n'),/_ppbPickList=null;/);
  assert.match(source,/<script src="board-print-pick\.js"><\/script>/);
  assert.match(fs.readFileSync(require.resolve('../sw.js'),'utf8'),/'\/studio\/board-print-pick\.js'/);
});
