'use strict';
/* 2.965 — 경기 준비의 «경기 보드»: 보드를 따로 두지 않고 보관함 자료(미팅 슬라이드·작전판 페이지)를 그 자리에서 띄운다.
   옛 «경기 준비 보드»(phaseBoards)는 지우지 않고 접는다. 명단(선발·리저브)은 그대로. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function fnAt(src,start){ const i=src.indexOf(start);assert.ok(i>=0,start);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(i,j+1); }
const J=x=>JSON.parse(JSON.stringify(x));

function scoutCtx(){
  const ctx=vm.createContext({JSON,Math,Date});
  vm.runInContext([fnAt(scout,'function mmLinkable(d)'),fnAt(scout,'function mmKindWord(d)'),fnAt(scout,'function mmSlidesOf(d)'),fnAt(scout,'function mmBoardHas(b)'),fnAt(scout,'function mmOldCount(m)')].join('\n')
    +';this.slides=mmSlidesOf;this.old=mmOldCount;this.kind=mmKindWord;this.ok=mmLinkable;',ctx);
  return ctx;
}

test('자료 → 장: 미팅은 슬라이드(제목·글·장면 수), 작전판은 페이지, 한 장짜리는 그 그림 하나',()=>{
  const c=scoutCtx();
  const m=c.slides({type:'meeting',name:'미팅',thumb:'<svg id="c"/>',slides:[{thumb:'',title:' 빌드업 ',points:['  짧게 ','',null,'전진']},{thumb:'<svg id="b"/>',title:'',points:[],frames:[{},{},{}]}]});
  assert.deepEqual(J(m),[{thumb:'<svg id="c"/>',title:'빌드업',points:['짧게','전진'],scenes:0},{thumb:'<svg id="b"/>',title:'',points:[],scenes:3}],'첫 장 그림이 비면 카드 그림');
  assert.deepEqual(J(c.slides({type:'meeting',name:'옛 미팅',thumb:'<svg/>'})),[{thumb:'<svg/>',title:'옛 미팅',points:[],scenes:0}],'슬라이드 없는 옛 미팅');
  assert.deepEqual(J(c.slides({type:'meeting',name:'빈'})),[],'그림도 슬라이드도 없으면 없음');
  const b=c.slides({type:'board',thumb:'<svg id="t"/>',pages:[{name:'공격',thumb:'<svg id="p"/>',anim:{frames:[{},{}]}},{name:'수비'}]});
  assert.deepEqual(J(b.map(x=>[x.title,x.thumb,x.scenes])),[['공격','<svg id="p"/>',2],['수비','',0]]);
  assert.deepEqual(J(c.slides({type:'board',thumb:'<svg/>',frames:[{},{}]})),[{thumb:'<svg/>',title:'',points:[],scenes:2}],'한 페이지 작전판');
  assert.equal(c.kind({type:'board'}),'작전판');assert.equal(c.kind({type:'meeting'}),'미팅');
  assert.equal(c.ok({type:'train'}),false,'훈련은 경기 보드 자료가 아니다');assert.equal(c.ok({type:'board',deletedAt:1}),false);
});

test('옛 경기 준비 보드 — 그린 페이지만 센다(빈 기본 페이지는 «그린 것»이 아니다)',()=>{
  const c=scoutCtx();
  assert.equal(c.old({phaseBoards:{list:[['a','공격'],['b','수비'],['c','세트']],boards:{a:{us:[{x:1}],opp:[]},b:{us:[],opp:[],drawings:[]},c:{drawings:[{type:'arrow'}]}}}}),2);
  assert.equal(c.old({phaseBoards:{list:[['a','공격']],boards:{}}}),0);assert.equal(c.old({}),0);assert.equal(c.old(null),0);
});

test('경기 준비 화면 — 운동장·국면 탭·도구줄은 접고(펼치기 전까지) 명단 칸만, 카드 이름은 «경기 보드»',()=>{
  assert.match(scout,/#mb2Card:not\(\.mb2-old-open\):not\(#_\):not\(#__\) \.mb2-phead,\s*html\.ps-page-scout #mb2Card:not\(\.mb2-old-open\):not\(#_\):not\(#__\) \.mb2-bar,\s*html\.ps-page-scout #mb2Card:not\(\.mb2-old-open\):not\(#_\):not\(#__\) #mb2Pitch\{display:none!important\}/);
  assert.match(scout,/#mb2Card:not\(\.mb2-old-open\):not\(#_\):not\(#__\)\{grid-template-areas:"tray squad"!important/,'남은 두 칸(우리 팀 · 선발/리저브)만 격자');
  assert.ok(!/#mb2SquadTray[^{]*\{display:none/.test(scout.slice(scout.indexOf('<style id="ps-2965-board">'))),'명단은 접지 않는다');
  assert.match(scout,/<b>경기 보드<\/b><small>보관함의 미팅·작전판을 여기서 바로 봐요/);
  const fn=fnAt(scout,'function mmOldApply(m)');assert.match(fn,/classList\.toggle\("mb2-old-open",!!\(m&&mmOldOpen\[m\.id\]\)\)/);
  assert.match(fnAt(scout,'function matchRenderMeetings(m)'),/mmOldApply\(m\);\s*if\(!m\|\|matchRole\(\)==="player"\)/,'선수 화면에서도 같은 접기');
});

test('넘기기는 그 장만 바꾼다 — 카드 전체를 다시 그리지 않는다',()=>{
  const step=fnAt(scout,'function mmStep(card,dlt)');assert.doesNotMatch(step,/mmPaint|innerHTML/);
  const show=fnAt(scout,'function mmViewShow(card)');
  assert.match(show,/host\.__k!==key/,'같은 장이면 그림을 다시 넣지 않는다');assert.match(show,/mmSvgFit\(host,s\.thumb,true\)/,'큰 칸은 그리던 판 그대로');
  assert.doesNotMatch(show,/scrollIntoView/,'아래 줄은 그 줄만 옆으로 — 페이지를 끌어당기지 않는다');
});

test('보관함 썸네일은 원래 판 viewBox 를 남긴다(data-psvb) — 작은 칸은 내용에 맞춤, 큰 칸은 판 그대로',()=>{
  assert.match(board,/c\.setAttribute\("data-psfit","1"\);c\.setAttribute\("data-psvb",_ovb\);/);
  const ctx=vm.createContext({});
  vm.runInContext(fnAt(scout,'function mmSvgFit(host,thumb,full)')+';this.fit=mmSvgFit;',ctx);
  const attrs={viewBox:'100 50 400 200','data-psvb':'0 0 1110 740'},sv={getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>{attrs[k]=v;},removeAttribute:k=>{delete attrs[k];}};
  const host={set innerHTML(v){this._h=v;},querySelector:()=>sv};
  assert.equal(ctx.fit(host,'<svg/>',true),1110/740);assert.equal(attrs.viewBox,'0 0 1110 740');assert.equal(attrs.preserveAspectRatio,'xMidYMid meet');
  attrs.viewBox='100 50 400 200';assert.equal(ctx.fit(host,'<svg/>',false),2,'작은 칸은 그대로');
});

test('경기에서 «＋ 새 미팅» — «기본 9장»을 붙이고, 선발 11 을 가져오면 BEST 11 은 뺀다',()=>{
  const seg=board.slice(board.indexOf('var MEET_TPL_US='),board.indexOf('function meetTplPt(m)'));
  const ctx=vm.createContext({JSON,Math,window:{}});
  vm.runInContext('var L=30,T=30,MPP=10;'+seg+fnAt(board,'function meetTplPt(m)')+fnAt(board,'function meetTplSnap(base,tp)')
    +board.slice(board.indexOf('window.__meetTplSlides=function'),board.indexOf('return out; };',board.indexOf('window.__meetTplSlides=function'))+'return out; };'.length)+';this.t=window.__meetTplSlides;',ctx);
  const all=ctx.t({teamColors:{blue:'#123456'}},false),skip=ctx.t({},true);
  assert.equal(all.length,9);assert.equal(skip.length,8);assert.equal(all[0].title,'BEST 11');assert.equal(skip[0].title,'하이블록');
  assert.ok(all.every(s=>s.snap.orientation==='h'&&s.snap.pitchTheme==='white'&&s.snap.players.length>=11),'미팅과 같은 판(흰 운동장·가로)');
  assert.equal(all[0].snap.teamColors.blue,'#123456','겉모습(팀 색)은 바탕에서');
  const fm=fnAt(board,'window.__meetingFromMatch=function(p)');
  assert.match(fm,/if\(!src\.length&&!p\.template\)/,'경기 자료가 없어도 기본 9장만으로 만든다');
  assert.match(fm,/window\.__meetTplSlides\(base,!!p\.skipBest\)/);
  assert.match(fm,/window\.__vaultFromMatch=\{libId:item\.libId,ref:ref,/,'만든 뒤 «‹ 경기 준비로»(2.966 — 경기 준비 안 편집 표식이 같이 붙는다)');
  const cs=fnAt(scout,'function mmCreateSheet(m,opts)');
  assert.match(cs,/template:tplOn\(\),skipBest:xiOn\(\)/);assert.match(cs,/count\(\)\{ return picked\(\)\.length\+\(tplOn\(\)\?\(xiOn\(\)\?8:9\):0\); \}/,'버튼의 장 수가 실제로 만들 장 수');
});

test('보관함 → «‹ 경기 준비로»: 경기에서 연(만든) 그 자료일 때만, 닫으면 잊는다',()=>{
  assert.match(board,/<button class="btn ghost" id="vCreateBackMatch" type="button" style="display:none">‹ 경기 준비로<\/button>/);
  const sync=fnAt(board,'function syncBackMatch()');assert.match(sync,/fm\.libId===cur/);
  assert.match(board,/function hideCreateBar\(\)\{ window\.__vaultManualDirty=false;try\{window\.__vaultEdit=false;window\.__vaultReadOnly=false;window\.__vaultFromMatch=null;\}/);
  assert.match(fnAt(board,'window.__vaultOpenMeeting=function(libId,opts)'),/window\.__vaultFromMatch=\{libId:d\.libId,ref:d\.matchRef\|\|null,/);
  assert.match(fnAt(board,'window.__vaultOpenMeeting=function(libId,opts)'),/_show=!!\(opts\.show&&\(d\.type\|\|""\)==="meeting"\)/,'슬라이드쇼는 미팅만');
});

test('방금 가져오거나 만든 자료를 띄운다 — 옛 목록으로 먼저 그려도 고른 것을 잃지 않는다',()=>{
  const p=fnAt(scout,'function mmPaint(card,m,lib)');
  assert.ok(p.indexOf('vs.want')<p.indexOf('if(!list.some(function(x){return x.libId===vs.lib;}))'),'바라던 것을 먼저 본다');
  assert.match(scout,/\(mmVS\[m\.id\]\|\|\(mmVS\[m\.id\]=\{lib:"",i:0\}\)\)\.want=String\(d\.libId\);/);
  assert.match(fnAt(scout,'function mmCreateSheet(m,opts)'),/\.wantAfter=Date\.now\(\)-3000;/);
});
