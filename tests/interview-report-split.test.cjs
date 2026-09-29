'use strict';
/* 2.909 — 면담 자료를 코치용 / 선수·학부모용 두 종이로 가른다.
   선수·학부모용 종이는 선수가 이미 볼 수 있는 것만 담고, 코치 평가 점수·요구·미달은 읽지도 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=fs.readFileSync(require.resolve('../studio/idp.html'),'utf8');
const part=(a,b)=>{const i=S.indexOf(a);assert.ok(i>=0,a);const j=S.indexOf(b,i+a.length);assert.ok(j>i,b);return S.slice(i,j);};

function ctx(over){
  const c=vm.createContext(Object.assign({
    esc:s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
    PREFIX:'cs_idp_v1_',SQ_SL5:['','아직','훈련에서','경기에서','압박에서도','내 무기'],SQP_FOOT:{R:'오른발',L:'왼발',B:'양발'},
    rpDate:()=>'2026.10.20',
    ymd:d=>{const m=d.getMonth()+1,x=d.getDate();return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(x<10?'0':'')+x;},
    addDays:(d,n)=>{const e=new Date(d);e.setDate(e.getDate()+n);return e;},
    mondayOf:()=>new Date(2026,9,19),
    selfProfileOfPlayer:()=>({height:'162'}),sqpAgeOf:()=>14,teamWsObj:()=>({name:'FC 예시 U15'}),
    sqEvalArchOf:()=>'b2b',PS_ARCH:{get:()=>({name:'박스 투 박스'})},sqEvalPosName:()=>'CM',
    sqThreads:()=>({linked:true,uid:'u1',wk:7,q:{start:'2026-09-07'},doc:{weapon:{picks:[{t:'왼발 전환 패스'}]}},
      list:[{g:{t:'공 받기 전 어깨 너머 두 번 보기',sc:{'2026-09-07':2,'2026-10-19':3}}},{g:{t:'경기당 전진 패스 5회',owner:'both',sc:{}}}]}),
    rvList:()=>[{at:'2026-10-14',by:'이슬기',strengths:['좁은 공간에서 몸을 열고 받는다'],develop:['받기 전 확인'],note:'경기에서도 해 보자'}],
    sqRadarRows:()=>[{lb:'전술',n:5,coach:4.8,nC:5,self:3,nS:5,req:4.6,nR:5},{lb:'기술',n:5,coach:4.9,nC:5,self:null,nS:0,req:4,nR:5}],
    sqMeetList:()=>[{at:'2026-09-15',agreement:'스캔 두 번을 전반 15분 동안',coachFeedback:'코치만 보는 메모',nextPlan:'10/20'}]
  },over||{}));
  vm.runInContext(part('  var RPP_WK=','  function sqRepPrintPlayer('),c);
  return c;
}
const P={id:'p1',name:'김민준',num:8,foot:'R',profile:{},levels:{a:5,b:5}};

test('player/parent paper carries what the player can already see',()=>{
  const h=ctx().sqRepPlayerHTML(P);
  for(const t of ['선수 · 학부모용','김민준','CM · 8번','14세','162 cm · 오른발','박스 투 박스','좁은 공간에서 몸을 열고 받는다','왼발 전환 패스',
    '공 받기 전 어깨 너머 두 번 보기','코치와 함께','이번 주 내가 매긴 단계 — <em>경기에서</em>','9/7 ~ 11/29 · 7주째','경기에서도 해 보자',
    '스캔 두 번을 전반 15분 동안','오늘 함께 정한 것','다음 확인 ____월 ____일','이 종이에는 코치 평가 점수가 들어가지 않습니다'])
    assert.ok(h.includes(t),t);
  assert.equal((h.match(/<i class="(now)?( fut)?"/g)||[]).length,24,'목표 둘 × 12주 칸');
});

test('coach scores, requirements, shortfalls and coach-only meeting notes never reach the paper',()=>{
  const h=ctx().sqRepPlayerHTML(P);
  assert.ok(h.includes('width:60%'),'셀프 3 → 60%');
  assert.equal(h.includes('width:96%'),false,'코치 4.8 → 96% 가 찍히면 안 된다');
  assert.equal(h.includes('width:98%'),false);
  for(const t of ['미달','요구','충족','코치만 보는 메모','PLAYER REPORT','레이더'])assert.equal(h.includes(t),false,t);
  assert.equal(/sqRepData|p\.levels|sqEvalReqEff|sqEvalFit/.test(part('  function sqRepPlayerHTML(','  function sqRepPrintPlayer(')),false,'코치 점수 원천을 읽지 않는다');
});

test('unlinked player paper says what is missing instead of guessing',()=>{
  const h=ctx({sqThreads:()=>({linked:false,list:[]}),rvList:()=>{throw new Error('should not read');},sqRadarRows:()=>[{lb:'전술',n:5,coach:5,self:null}],sqMeetList:()=>[]}).sqRepPlayerHTML(P);
  assert.ok(h.includes('계정 연결 전이에요'));assert.ok(h.includes('아직 성장 리뷰 전이에요'));assert.ok(h.includes('아직 전한 말이 없어요'));
  assert.equal(h.includes('width:100%'),false);
});

test('screen offers both papers and the coach paper is labelled',()=>{
  const r=part('  function rSqReport(p){','    h+=\'<div class="sqrep-body">\';');
  assert.ok(r.includes('data-sqrep-print>코치용 PDF'));assert.ok(r.includes('data-sqrep-print-pl>선수·학부모용 PDF'));
  assert.ok(part('  function sqRepPrint(p){','  function sqRepDoPrint(').includes('코치용 · 선수에게 건네지 않음'));
  assert.ok(S.includes("wrap.querySelector('[data-sqrep-print-pl]')"));assert.ok(S.includes('sqRepPrintPlayer(p)'));
});
