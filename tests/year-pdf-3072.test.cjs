'use strict';
/* 3.072 — 연간 PDF(A4 가로 한 장). 12개월 달력 칸 색 = 경기 · 훈련 강도(≤3 저 · ≤6 중 · 7+ 고 · 미입력) · 휴식,
   오른쪽 = 화면 «올해 요약»과 같은 숫자 · 월별 훈련일 · 주제 배분 · 경기 목록(추가 경기 포함). 일정은 읽기만 한다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=fs.readFileSync(require.resolve('../studio/process.html'),'utf8');
const part=(a,b)=>{const i=S.indexOf(a);assert.ok(i>=0,a);const j=S.indexOf(b,i+a.length);assert.ok(j>i,b);return S.slice(i,j);};

function build(opt){
  opt=opt||{};
  const M0=new Date(2025,11,29);   /* 2026-01-01 이 든 주의 월요일 */
  const off=d=>Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-M0)/86400000);
  const weeksMap={};
  const put=(m,d,day)=>{const n=off(new Date(2026,m,d)),r=Math.floor(n/7),c=((n%7)+7)%7;(weeksMap[r]=weeksMap[r]||[{},{},{},{},{},{},{}])[c]=day;};
  put(0,5,{trainings:[{load:{rpe:2}}]});                                  /* 1월 저 */
  put(0,6,{trainings:[{load:{rpe:8}}]});                                  /* 1월 고 */
  put(0,7,{trainings:[{}]});                                              /* 1월 미입력 */
  put(2,14,{match:{opp:'광주FC <U15>',time:'15:00',kind:'cup'},matchAdd:[{opp:'수원 U15',time:'10:00',kind:'friendly'}]});
  put(2,21,{match:{opp:'',kind:'friendly'}});
  put(2,22,{off:true,board:{sched:'OFF'}});
  put(5,3,{trainings:[{load:{rpe:5}}],grp:'B'});
  const c=vm.createContext({
    yearAnchor:2026,weeksMap,offsetOfDate:off,WDAYS:['월','화','수','목','금','토','일'],
    schedViewDay:d=>(opt.grp&&d&&d.grp&&d.grp!==opt.grp)?{}:(d||{}),
    wkbdEsc:s=>String(s==null?'':s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
    teamGet:()=>({name:'FC 예시 U15'}),__psImgSrc:x=>x,
    daysTopicCount:days=>({order:['공격'],b:{'공격':days.length?1:0},colOf:{}}),
    yearDaysList:()=>[],pTopicRows:()=>'<div class="pdrow"></div>',
    pGrpTag:()=>opt.grp?' · '+opt.grp+' 일정':'',pFooter:()=>'<footer></footer>'
  });
  vm.runInContext([
    part('function mxExtraList(','function mxExtraHtml('),
    part('function yearDayKind(','function yearActivityStats('),
    part('/* ══ 3.072 · 연간 PDF','function reviewDocHTML(){')
  ].join('\n'),c);
  return c.yearDocHTML();
}
const months=h=>h.split('<div class="pyr-m">').slice(1);

test('twelve month calendars, Monday first, day colour = match · intensity · rest',()=>{
  const h=build(),m=months(h);
  assert.equal(m.length,12);
  assert.ok(m[0].includes('<b>1월</b>')&&m[0].includes('훈련 3'));
  assert.equal((m[0].match(/<i class="e"><\/i>/g)||[]).length,3,'2026-01-01 은 목요일 — 앞 빈칸 셋');
  assert.ok(m[0].includes('<i class="tl">5</i>')&&m[0].includes('<i class="th">6</i>')&&m[0].includes('<i class="tu">7</i>'));
  assert.ok(m[2].includes('<i class="g">14</i>')&&m[2].includes('<i class="o">22</i>'));
  assert.ok(m[2].includes('경기 3'),'추가 경기도 그 달 경기 수에 든다');
  assert.ok(m[5].includes('<i class="tm">3</i>'));
  assert.ok(m[0].includes('주제 · 공격'));
});

test('side panel: year totals match the screen summary, match list includes extra matches and escapes names',()=>{
  const h=build();
  assert.ok(h.includes('<b>4<small>일</small></b><span>훈련일</span>'));
  assert.ok(h.includes('저 1')&&h.includes('중 1')&&h.includes('고 1')&&h.includes('미입력 1'));
  assert.ok(h.includes('<b>1<small>회</small></b><span>정식경기</span>'),'컵은 정식');
  assert.ok(h.includes('<b>1<small>회</small></b><span>친선경기</span>'));
  assert.ok(h.includes('3.14 토</b><span>광주FC &lt;U15&gt;</span><em>15:00 · 컵</em>'));
  assert.ok(h.includes('<span>수원 U15</span><em>10:00 · 친선</em>'));
  assert.ok(h.includes('<span>상대 미정</span>'));
  assert.ok(h.includes('훈련 4일 · 휴식 1일 · 경기 3')&&h.includes('FC 예시 U15'));
  assert.equal(h.includes('다음 경기'),false);
});

test('group view follows the visible group and tags the header',()=>{
  const h=build({grp:'A'});
  assert.ok(h.includes('2026년 · A 일정'));
  assert.equal(months(h)[5].includes('<i class="tm">3</i>'),false,'다른 조 훈련은 빠진다');
});

test('year is wired into the print builder, has no blank form, and has a button on the year screen',()=>{
  const src=part('function __buildPrintDoc(','/* ---------- 출력 미리보기 모달');
  assert.ok(src.includes("else if(kind==='year'){ html=yearDocHTML(); fname='process_연간'; }"));
  assert.ok(src.includes("kind==='weekboard'||kind==='year') blank=false"));
  const y=part('<div id="yearViewWrap"','</section>');
  assert.ok(y.includes("exportPDF('year')")&&y.includes('연간 PDF'));
  assert.ok(S.includes('#printDoc.pl-year .ponepage{height:186mm}'),'A4 가로 한 장');
});
