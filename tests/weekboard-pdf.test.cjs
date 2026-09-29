'use strict';
/* 2.910 — 주간 보드 PDF = 분량 블록(사용자 목업 A안). 요일 칸 안에 세션을 시각 순으로 쌓고, 훈련 하나 = 블록 하나,
   블록 높이 = 시간(분×세트), 색 = 세션 RPE 세 칸. 경기는 빨간 블록, OFF 는 빗금, 머리에 다음 경기 줄은 없다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=fs.readFileSync(require.resolve('../studio/process.html'),'utf8');
const part=(a,b)=>{const i=S.indexOf(a);assert.ok(i>=0,a);const j=S.indexOf(b,i+a.length);assert.ok(j>i,b);return S.slice(i,j);};

function build(opt){
  opt=opt||{};
  const ses=(slot,time,topic,rpe,extra)=>Object.assign({slot,time,topics:['t:'+topic],load:{rpe}},extra||{});
  const W=[
    {d:'월',md:'MD-5',trainings:[ses('S1','17:00','회복',3,{grp:'A팀',place:'보조구장 A'}),ses('S9','18:00','숨김',5,{grp:'B팀'})],
      board:{trains:['Activation','Rondo 4v2','B팀 훈련'],trainSlot:['S1','S1','S9'],trainData:[{minutes:10},{minutes:12,sets:2},{minutes:30}]}},
    {d:'화',md:'MD-4',trainings:[ses('S3','17:00','공-수 전환',7,{note:'잃은 뒤 5초'}),ses('S2','09:30','피지컬',4,{place:'실내 체육관'})],
      board:{trains:['근력 순환','5v5 전환 게임','SSG'],trainSlot:['S2','S3','S3'],trainData:[{minutes:40},{minutes:8,sets:3,fromLib:'L1'},{minutes:20}],
        meets:['Team Talk'],meetSlot:['S3'],meetsData:[{minutes:10}]}},
    {d:'수',md:'MD-3',trainings:[{slot:'S4',time:'17:00',aims:'수비 조직',load:{rpe:6},blocks:[{theme:'패스',dur:20,phase:'메인훈련'}]}],board:{}},
    {d:'목',md:'MD-2',trainings:[],board:{trains:['자체 청백전'],trainSlot:[''],trainData:[{minutes:30}]}},
    {d:'금',md:'MD-1',trainings:[],board:{sched:'훈련'}},
    {d:'토',md:'MD',match:{opp:'광주FC U15',time:'15:00',kind:'cup'},trainings:[],board:{sched:'경기'}},
    {d:'일',md:'MD+1',off:true,trainings:[],board:{sched:'OFF'}},
  ];
  const c=vm.createContext({
    week:W,wk:0,__pBlank:false,__schedGrp:opt.grp||'',LEGACY_LOAD:{},recomputeMD:()=>{},schedViewDay:d=>d,
    teamGet:()=>({name:'FC 예시 U15'}),__psImgSrc:x=>x,
    wkbdEsc:s=>String(s==null?'':s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
    dayBoard:d=>d.board||{},dateOf:n=>new Date(2026,8,28+n),
    schedGrpShow:tr=>tr.grp!=='B팀',
    pdfCoachOf:(ref,name)=>ref==='L1'?'잃은 뒤 5초, 가장 가까운 두 명이 조인다.':'',
    wksTopicName:v=>String(v).slice(2),
    daysTopicCount:()=>({order:['회복','수비 조직'],b:{'회복':1,'수비 조직':1},colOf:{'회복':'#2E9D6A','수비 조직':'#3A6DF0'}}),
    weekDateLabel:()=>'9월 28일 – 10월 4일',pGrpTag:()=>opt.grp?' · '+opt.grp+' 일정':'',pFooter:()=>'<footer></footer>',
    pNextMatch:()=>{throw new Error('주간 보드는 다음 경기를 묻지 않는다');}
  });
  vm.runInContext([
    part('function psMin(','\n'),part('function psSesMin(','function trOwnerDay('),part('function trMinutes(','function endTime('),
    part('function sessionLoadMin(','// 부하 = 세션 단위'),part('function getLoad(','function loadShort('),part('function loadRpe(','function rpeBand('),
    part('function dayIsMatch(','function mdMatchOffsets('),part('function mMatchKind(','function yearLoadRpe('),
    part('function mxExtraList(','function mxExtraHtml('),part('function wksTopicsOf(','/* 2.385'),
    part('/* ══ 2.910 · 주간 보드 PDF','function dayDocHTML(){')
  ].join('\n'),c);
  return c.weekBoardDocHTML();
}
const cols=h=>h.split('<div class="pwb-col">').slice(1);

test('one block per drill, height follows minutes×sets, colour follows session RPE',()=>{
  const mon=cols(build())[0];
  assert.match(mon,/min-height:max\(18px,calc\(var\(--pm\) \* 24\)\);background:#E4F3EB;border-left-color:#2E9D6A[^"]*"><b>Rondo 4v2<\/b><i>12′×2<\/i>/);
  assert.ok(mon.includes('<b>17:00</b><em>회복</em>'),'세션 머리 = 시각 + 주제');
  assert.ok(mon.includes('RPE 3'));assert.ok(mon.includes('A팀 · 보조구장 A · 34분'),'누구 · 어디 · 몇 분');
  assert.equal(mon.includes('B팀 훈련'),false,'지금 보기에서 빠지는 세션(조 OFF)은 종이에도 없다');
});

test('sessions stack by time with coaching and memo; meeting is a neutral block',()=>{
  const tue=cols(build())[1];
  assert.ok(tue.indexOf('09:30')<tue.indexOf('17:00'),'시각 순');
  assert.match(tue,/background:#FBEBDA;border-left-color:#D9822B[^"]*"><b>5v5 전환 게임<\/b><i>8′×3<\/i>/);
  assert.ok(tue.includes('☞ 잃은 뒤 5초, 가장 가까운 두 명이 조인다.'));assert.ok(tue.includes('메모 · 잃은 뒤 5초'));
  assert.match(tue,/class="pwb-b meet"[^>]*><b>Team Talk<\/b><i>10′<\/i>/);
  assert.ok(tue.includes('<span class="mn">94′</span>'),'요일 머리 = 그 날 총 분');
});

test('old saved blocks, orphan chips and undecided days still print',()=>{
  const c=cols(build());
  assert.ok(c[2].includes('<b>패스</b><i>20′</i>'),'옛 블록 저장본');assert.ok(c[2].includes('<em>수비 조직</em>'));
  assert.ok(c[3].includes('<em>훈련</em>')&&c[3].includes('<b>자체 청백전</b><i>30′</i>'),'세션에 안 붙은 칩');
  assert.ok(c[4].includes('훈련 · 세부 미정'));
  for(const i of [0,1,2,3,4])assert.ok(c[i].includes('pwb-fill'),'남는 높이 = 펜 줄');
});

test('match is a red block with opponent, time and kind; OFF is hatched; no red Sunday',()=>{
  const c=cols(build());
  assert.ok(c[5].includes('pwb-match grow')&&c[5].includes('경기 · 컵')&&c[5].includes('vs 광주FC U15')&&c[5].includes('<span>15:00</span>'));
  assert.ok(c[5].includes('<span class="pwb-md m">MD</span>'));assert.equal(c[5].includes('pwb-fill'),false);
  assert.ok(c[6].includes('<div class="pwb-off"><b>OFF</b>'));assert.equal(c[6].includes('pwb-h m'),false);
});

test('header carries week totals and team, never the next match; block scale is bounded',()=>{
  const h=build();
  assert.ok(h.includes('세션 5 · 178분 · 평균 RPE 5 · 경기 1'),h.match(/class="pwb-tot">[^<]*/)?.[0]);
  assert.ok(h.includes('FC 예시 U15'));assert.equal(h.includes('다음 경기'),false);
  const pm=+h.match(/data-pm="([\d.]+)"/)[1];assert.ok(pm>=0.6&&pm<=3,pm);
  assert.ok(h.includes('요일별 부하 · 분 × RPE')&&h.includes('이번 주 주제 배분'));
});

test('group view drops the group label from each session and tags the header',()=>{
  const h=build({grp:'A팀'});assert.ok(h.includes('9월 28일 – 10월 4일 · A팀 일정'));assert.ok(cols(h)[0].includes('보조구장 A · 34분'));assert.equal(cols(h)[0].includes('A팀 · 보조구장'),false);
});

test('print document refits the block scale before the zoom safety net',()=>{
  const src=part('function __buildPrintDoc(','/* ---------- 출력 미리보기 모달');
  assert.ok(src.includes("const fitJs=(cls==='weekboard'&&!blank)"));
  assert.ok(src.indexOf("'<script>'+fitJs")<src.indexOf("'<script>'+zoomJs"),'블록 배율 맞춤이 zoom 보다 먼저');
});

test('list-view weekly PDF and the blank weekly form use the same block layout',()=>{
  const src=part('function __buildPrintDoc(','/* ---------- 출력 미리보기 모달');
  assert.ok(src.includes("else { html=weekBoardDocHTML(); fname='process_주간'; cls='weekboard'; }"));
  assert.equal(S.includes('function scheduleDocHTML('),false,'옛 목록형 주간 PDF 는 없다');
});

test('blank weekly form: seven ruled columns, no data read, no MD recompute',()=>{
  const c=vm.createContext({__pBlank:true,pFooter:()=>'<footer></footer>',
    recomputeMD:()=>{throw new Error('빈 양식은 상태를 건드리지 않는다');},get week(){throw new Error('빈 양식은 일정을 읽지 않는다');}});
  vm.runInContext(part('function weekBoardBlankHTML(','/* ══ 2.910 · 주간 보드 PDF')+part('function weekBoardDocHTML(){','\n  try{recomputeMD();}catch(_){}')+'}',c);
  const h=c.weekBoardDocHTML();
  assert.equal((h.match(/class="pwb-col"/g)||[]).length,7);assert.equal((h.match(/class="pwb-fill"/g)||[]).length,7);
  for(const w of ['월','화','수','목','금','토','일'])assert.ok(h.includes('<b>'+w+'</b>'));
  assert.ok(h.includes('____월 ____주'));assert.equal(h.includes('pwb-b'),false);assert.equal(h.includes('다음 경기'),false);
});
