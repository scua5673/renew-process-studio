'use strict';
/* 3.073 — 연간 PDF 두 가지(사용자 «1년간 했던 걸 보는 거랑 계획할 수 있는 거 2가지로») + 시즌 계획(앱에서 입력 · 저장).
   머리 = 팀 이름이 먼저(사용자 «연간 일정 앞에 팀 이름 · 위계를 잘»). 돌아보기는 오늘까지만 센다 · 경기 결과는 경기 문서 점수.
   계획은 시즌 단계 띠 · 칸 밑줄 · 달 목표 · 다가오는 경기. 일정은 읽기만 한다. 날짜에 묶이지 않게 지난해 · 다음해로 시험한다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=fs.readFileSync(require.resolve('../studio/process.html'),'utf8');
const M=fs.readFileSync(require.resolve('../studio/year-plan.js'),'utf8');   /* 3.073 — 연간 PDF · 시즌 계획 모듈 */
const cutOf=src=>(a,b)=>{const i=src.indexOf(a);assert.ok(i>=0,a);const j=b==null?src.length:src.indexOf(b,i+a.length);assert.ok(j>i,b);return src.slice(i,j);};
const part=cutOf(S);
const NOW=new Date().getFullYear();

function ctx(Y,opt){
  opt=opt||{};
  const M0=new Date(Y,0,1); M0.setDate(M0.getDate()-((M0.getDay()+6)%7));
  const off=d=>Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-M0)/86400000);
  const weeksMap={};
  const put=(m,d,day)=>{const n=off(new Date(Y,m,d)),r=Math.floor(n/7),c=((n%7)+7)%7;(weeksMap[r]=weeksMap[r]||[{},{},{},{},{},{},{}])[c]=day;};
  put(0,5,{trainings:[{load:{rpe:2},min:60}]});
  put(0,6,{trainings:[{load:{rpe:8},min:90}]});
  put(0,7,{trainings:[{min:30}]});
  put(2,14,{match:{opp:'광주FC <U15>',time:'15:00',kind:'cup'},matchAdd:[{opp:'수원 U15',time:'10:00',kind:'friendly'}]});
  put(2,22,{off:true,board:{sched:'OFF'}});
  put(5,3,{trainings:[{load:{rpe:5},min:60}],grp:'B'});
  const docs={[Y+'-03-14|광주FC <U15>']:{scoreUs:'2',scoreThem:'1'},[Y+'-03-14|수원 U15']:{scoreUs:'0',scoreThem:'0'}};
  const c=vm.createContext({
    yearAnchor:Y,weeksMap,offsetOfDate:off,WDAYS:['월','화','수','목','금','토','일'],
    schedViewDay:d=>(opt.grp&&d&&d.grp&&d.grp!==opt.grp)?{}:(d||{}),
    wkbdEsc:s=>String(s==null?'':s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
    teamGet:()=>({name:'FC 예시 U15'}),__psImgSrc:x=>x,
    daysTopicCount:days=>({order:['공격'],b:{'공격':days.length?1:0},colOf:{}}),
    yearDaysList:()=>[],pTopicRows:()=>'<div class="pdrow"></div>',
    pGrpTag:()=>opt.grp?' · '+opt.grp+' 일정':'',pFooter:()=>'<footer></footer>',
    trMinutes:tr=>tr.min||0,getLoad:tr=>tr.load||null,loadRpe:L=>L&&L.rpe||0,
    wkbdMatchDoc:(ymd,o)=>docs[ymd+'|'+o]||null,
    seasonPlan:{},document:{getElementById:()=>null},schedEditBlocked:()=>!!opt.blocked,schedBlockNotice:()=>{},saves:0
  });
  c.save=()=>{c.saves++;};
  vm.runInContext([
    part('function mxExtraList(','function mxExtraHtml('),
    part('function yearDayKind(','function yearActivityStats('),
    part('function yearQuickFormatIso(','function yearQuickCellForIso('),
    M   /* 모듈 통째로 — 화면 카드(renderSeasonPlan)는 부르지 않는다 */
  ].join('\n'),c);
  if(opt.plan)vm.runInContext('seasonPlan='+JSON.stringify(opt.plan),c);
  return c;
}
const months=h=>h.split('<div class="pyr-m">').slice(1);

test('header leads with the team name, then the document name; period and totals are a smaller second line',()=>{
  const h=ctx(NOW-1).yearDocHTML('review');
  assert.match(h,/<div class="pyr-h1"><b>FC 예시 U15<\/b><span>\d{4} 연간 돌아보기<\/span><\/div><div class="pyr-h2">\d{4}\.1\.1 – 12\.31<\/div>/);
  assert.ok(M.includes("#printDoc.pl-year .pyr-h1{display:flex;align-items:baseline;gap:10px;font-size:var(--t-7,20px)"),'① 20');
  assert.ok(M.includes("#printDoc.pl-year .pyr-mh b{flex:0 0 auto;font-size:var(--t-5,14px);font-weight:800")&&M.includes("#printDoc.pl-year .pyr-side h4{font-size:var(--t-5,14px);font-weight:800"),'③ 달 이름 = 오른쪽 제목');
  assert.match(ctx(NOW+1).yearDocHTML('plan'),/<b>FC 예시 U15<\/b><span>\d{4} 연간 계획<\/span>/);
});

test('review: past year counts sessions, minutes, RPE, intensity and results from match documents',()=>{
  const h=ctx(NOW-1).yearDocHTML('review'),m=months(h);
  assert.equal(m.length,12);
  assert.ok(m[0].includes('<i class="tl">5</i>')&&m[0].includes('<i class="th">6</i>')&&m[0].includes('<i class="tu">7</i>'));
  assert.ok(m[2].includes('<i class="g">14</i>')&&m[2].includes('경기 2'),'추가 경기도 센다');
  assert.ok(h.includes('<b>4<small>회</small></b><span>훈련 세션</span>'));
  assert.ok(h.includes('<b>4<small>시간</small></b><span>훈련 시간</span>'),'240분');
  assert.ok(h.includes('<b>5</b><span>평균 RPE</span>'),'(2+8+5)/3');
  assert.ok(h.includes('<b>1<small>승</small> 1<small>무</small> 0<small>패</small></b>')&&h.includes('득 2 · 실 1 · 결과 적은 경기 2/2'));
  assert.ok(h.includes('<span>광주FC &lt;U15&gt;</span><em>2 : 1 <u class="r-w">승</u></em>'));
  assert.ok(h.includes('<span>수원 U15</span><em>0 : 0 <u class="r-d">무</u></em>'));
  assert.ok(h.includes('class="pfill pyr-pen"'),'손글씨 칸');
  assert.equal(h.includes(' dim'),false,'지난해는 흐린 날이 없다');
});

test('review of a future year counts nothing and greys every day',()=>{
  const h=ctx(NOW+1).yearDocHTML('review');
  assert.ok(h.includes('아직 지난 날이 없어요'));
  assert.ok(h.includes('<b>0<small>회</small></b><span>훈련 세션</span>'));
  assert.ok(h.includes('<i class="tl dim">5</i>'));assert.ok(h.includes('지난 경기가 없어요'));
});

test('plan: phase band, phase underline and month chips, goals or pen line, upcoming matches with D-n',()=>{
  const Y=NOW+1;
  const h=ctx(Y,{plan:{[Y]:{phases:[{name:'전반기',start:Y+'-03-01',end:Y+'-07-15',color:'#2E9D6A'},{name:'',start:Y+'-01-05',end:Y+'-02-28',color:'#evil'}],goals:{3:'빌드업 <첫 패스>',4:'  '}}}}).yearDocHTML('plan');
  assert.ok(h.includes('<b>전반기</b></i>')&&h.includes('class="pyr-band"'));
  assert.ok(h.includes('<i class="g" style="box-shadow:inset 0 -2px 0 #2E9D6A">14</i>'),'3/14 = 전반기 밑줄');
  const m=months(h);
  assert.ok(m[2].includes('<span class="pyr-phn"><i style="background:#2E9D6A"></i>전반기</span>'));
  assert.ok(m[0].includes('<b>단계</b>')===false&&m[0].includes('>단계</span>'),'이름 없는 단계 = «단계», 엉뚱한 색은 팔레트로');
  assert.ok(m[2].includes('<div class="pyr-goal"><b>목표</b>빌드업 &lt;첫 패스&gt;</div>'));
  assert.ok(m[3].includes('<div class="pyr-goal pen"><b>목표</b></div>'),'빈 목표 = 펜 줄');
  assert.match(h,/3\.14 [월화수목금토일]<\/b><span>광주FC &lt;U15&gt;<\/span><em>15:00 · 컵 · D-\d+<\/em>/);
  assert.ok(h.includes('<b>2<small>경기</small></b><span>남은 경기</span>'));
  assert.ok(h.indexOf('1.5 – 2.28')<h.indexOf('3.1 – 7.15'),'단계는 날짜 순');
});

test('plan without phases tells where to add them',()=>{
  const h=ctx(NOW+1).yearDocHTML('plan');
  assert.ok(h.includes('시즌 계획»에서 넣으면'));assert.ok(h.includes('아직 없어요'));
});

test('group view follows the visible group',()=>{
  const h=ctx(NOW-1,{grp:'A'}).yearDocHTML('review');
  assert.ok(h.includes('1.1 – 12.31 · A 일정'));assert.equal(months(h)[5].includes('<i class="tm">3</i>'),false);
});

test('season plan writes go through save(), are cleaned, and are blocked without edit rights',()=>{
  const Y=NOW+1, c=ctx(Y);
  assert.equal(c.spWrite(Y,cur=>{cur.phases.push({name:'x'.repeat(40),start:Y+'-05-10',end:Y+'-05-01',color:'#3A6DF0'});cur.goals[2]='a';}),true);
  assert.equal(c.saves,1);
  const p=c.spYear(Y).phases[0];assert.equal(p.name.length,20);assert.equal(p.start,Y+'-05-01');assert.equal(p.end,Y+'-05-10');
  c.spWrite(Y,cur=>{cur.phases=[];cur.goals={};});
  assert.equal(vm.runInContext('Object.keys(seasonPlan).length',c),0,'빈 해는 문서에서 빠진다');
  const b=ctx(Y,{blocked:true});assert.equal(b.spWrite(Y,cur=>{cur.goals[1]='x';}),false);assert.equal(b.saves,0);
});

test('season plan rides the schedule document: saved, loaded, declared before boot',()=>{
  assert.ok(part('function saveNow(','function loadState(').includes(' seasonPlan:seasonPlan,'));
  assert.ok(part('function loadState(','/* ---------- navigation').includes("seasonPlan=(data.seasonPlan&&typeof data.seasonPlan==='object'&&!Array.isArray(data.seasonPlan))?data.seasonPlan:{};"));
  assert.ok(S.indexOf('var seasonPlan={};')<S.indexOf('\nloadState();'),'부팅 loadState 보다 먼저 선언(var)');
  assert.equal(/let seasonPlan|var seasonPlan/.test(M),false,'선언은 process.html 한 곳');
});

test('two buttons on the year screen; both kinds wired into the print builder without blank forms',()=>{
  const src=part('function __buildPrintDoc(','/* ---------- 출력 미리보기 모달');
  assert.ok(src.includes("else if(kind==='yearReview'){ html=yearDocHTML('review'); fname='process_연간_돌아보기'; cls='year'; }"));
  assert.ok(src.includes("else if(kind==='yearPlan'){ html=yearDocHTML('plan'); fname='process_연간_계획'; cls='year'; }"));
  assert.ok(src.includes("kind==='yearReview'||kind==='yearPlan') blank=false"));
  const y=part('<div id="yearViewWrap"','</section>');
  assert.ok(y.includes("exportPDF('yearReview')")&&y.includes('돌아보기 PDF')&&y.includes("exportPDF('yearPlan')")&&y.includes('계획 PDF'));
  assert.ok(y.includes('id="spCard"'));assert.ok(M.includes('#printDoc.pl-year .ponepage{height:186mm}'));
  assert.ok(M.includes("st.id='ps-year-plan-css'"),'인쇄 문서가 모으는 <style> 로 붙는다');
  assert.ok(S.includes('<script src="year-plan.js"></script>'));
});
