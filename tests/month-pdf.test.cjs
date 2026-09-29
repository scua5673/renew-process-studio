'use strict';
/* 2.909 — 월간 PDF: 하루 세션을 전부(넷 넘으면 셋 + «외 n»), 머리는 다음 경기 대신 이 달 합계. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=fs.readFileSync(require.resolve('../studio/process.html'),'utf8');
const part=(a,b)=>{const i=S.indexOf(a);assert.ok(i>=0,a);const j=S.indexOf(b,i+a.length);assert.ok(j>i,b);return S.slice(i,j);};

function build(blank){
  const start=new Date(2026,7,31), days=[];for(let i=0;i<35;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(d);}
  const W={};for(let r=0;r<5;r++)W[r]=Array.from({length:7},()=>({trainings:[],board:{}}));
  const S1=(time,topic,r,m,place)=>({time,topics:['t:'+topic],load:{rpe:r},m,place});
  W[0][1].trainings=[S1('09:30','개인 기술',4,45,'실내 체육관'),S1('17:00','전환 공격',7,90,'보조구장 A')];
  W[0][2].trainings=['A','B','C','D','E'].map((x,i)=>S1('1'+i+':00','주제'+x,5,30));
  W[0][5]={match:{opp:'광주FC U15',time:'15:00',kind:'cup'},board:{sched:'경기'},trainings:[]};
  W[0][6]={off:true,board:{sched:'OFF'},trainings:[]};
  W[1][0].trainings=[S1('17:00','수비 조직',6,80)];
  const c=vm.createContext({
    __pBlank:!!blank,weeksMap:W,monthAnchor:{m:8},monthGridDays:()=>days,
    offsetOfDate:d=>days.findIndex(x=>x.getTime()===d.getTime()),blankWeek:()=>[],recomputeMD:()=>{},schedViewDay:d=>d,
    dayIsMatch:d=>!!(d&&d.match),dayBoard:d=>(d&&d.board)||{},getLoad:t=>t.load||null,loadRpe:L=>+L.rpe||0,trMinutes:t=>t.m||0,
    wksTopicsOf:t=>t.topics||[],wksTopicName:v=>String(v).slice(2),mxExtraList:()=>[],mxExtraLabel:()=>({}),
    M_KIND_LB:{official:'리그',cup:'컵',friendly:'친선'},mMatchKind:d=>d.match.kind,WDAYS:['월','화','수','목','금','토','일'],
    pdfEsc:s=>String(s==null?'':s).replace(/[<>&]/g,x=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[x])),pGrpTag:()=>'',monthLabel:()=>'2026년 9월',
    pFooter:()=>'<footer></footer>',pNextMatch:()=>{throw new Error('월간은 다음 경기를 묻지 않는다');}
  });
  vm.runInContext(part('function pHeader(','function pNextMatch(')+part('function monthDocHTML(){','function reviewDocHTML(){'),c);
  return c.monthDocHTML();
}

test('every session of the day is printed, two lines each, with its RPE band',()=>{
  const h=build();
  for(const t of ['09:30 개인 기술','실내 체육관 · 45′ · RPE 4','17:00 전환 공격','보조구장 A · 90′ · RPE 7','border-left:3px solid #D9822B','border-left:3px solid #2E9D6A'])assert.ok(h.includes(t),t);
});

test('more than four sessions: three shown then «외 n», one line each',()=>{
  const h=build();
  for(const t of ['10:00 주제A','11:00 주제B','12:00 주제C','외 2'])assert.ok(h.includes(t),t);
  assert.equal(h.includes('13:00 주제D'),false);assert.equal(h.includes('30′ · RPE 5'),false,'셋 이상은 한 줄');
});

test('match shows opponent, time and kind; OFF says rest',()=>{
  const h=build();assert.ok(h.includes('경기 vs 광주FC U15'));assert.ok(h.includes('15:00 · 컵'));assert.ok(h.includes('>휴식<'));
});

test('header carries month totals and no next-match line',()=>{
  const h=build();
  assert.ok(h.includes('훈련 8회 · 365분 · 평균 RPE 5.3 · 경기 1'),h.match(/class="ptot">[^<]*/)?.[0]);
  assert.equal(h.includes('다음 경기'),false);
});

test('blank month form keeps the grid and asks nothing about the next match',()=>{
  const h=build(true);assert.equal(h.includes('상대 _______'),false);assert.equal(h.includes('주제A'),false);assert.ok(h.includes('월간 일정'));
});
