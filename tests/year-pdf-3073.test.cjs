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
  put(0,5,{trainings:[{load:{rpe:2},min:60}],board:{theme:'',trains:['론도 4v2','SSG'],trainData:[{minutes:12,sets:2},{minutes:20}]}});
  put(0,6,{trainings:[{load:{rpe:8},min:90}],board:{theme:'',trains:['론도 4v2'],trainData:[{minutes:10}]}});
  put(0,7,{trainings:[{min:30}]});
  put(2,14,{match:{opp:'광주FC <U15>',time:'15:00',kind:'cup'},matchAdd:[{opp:'수원 U15',time:'10:00',kind:'friendly'}]});
  put(2,22,{off:true,board:{sched:'OFF'}});
  put(5,3,{trainings:[{load:{rpe:5},min:60}],grp:'B'});
  const docs={[Y+'-03-14|광주FC <U15>']:{squad:{start:['p1'],res:['p2']},scoreUs:'2',scoreThem:'1',homeAway:'away',competition:'주말리그',execution:4,reviewGood:'측면 2:1',reviewImprove:'전환 첫 3초'},[Y+'-03-14|수원 U15']:{scoreUs:'0',scoreThem:'0'}};
  const c=vm.createContext({
    yearAnchor:Y,weeksMap,offsetOfDate:off,WDAYS:['월','화','수','목','금','토','일'],
    schedViewDay:d=>(opt.grp&&d&&d.grp&&d.grp!==opt.grp)?{}:(d||{}),
    wkbdEsc:s=>String(s==null?'':s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
    teamGet:()=>({name:'FC 예시 U15'}),__psImgSrc:x=>x,
    daysTopicCount:days=>({order:['공격'],b:{'공격':days.length?1:0},colOf:{}}),
    yearDaysList:()=>[],pTopicRows:()=>'<div class="pdrow"></div>',
    pGrpTag:()=>opt.grp?' · '+opt.grp+' 일정':'',pFooter:()=>'<footer></footer>',
    trMinutes:tr=>tr.min||0,dayBoard:d=>d.board||{trains:[]},getLoad:tr=>tr.load||null,loadRpe:L=>L&&L.rpe||0,
    wkbdMatchDoc:(ymd,o)=>docs[ymd+'|'+o]||null,
    seasonPlan:{},document:{getElementById:()=>null},schedEditBlocked:()=>!!opt.blocked,schedBlockNotice:()=>{},saves:0
  });
  c.save=()=>{c.saves++;};
  if(opt.roster){ const LS={scout_tool_v1:JSON.stringify(opt.roster)}; c.localStorage={getItem:k=>LS[k]||null}; c.window=c;
    vm.runInContext(fs.readFileSync(require.resolve('../studio/participation.js'),'utf8'),c); }
  c.PSTeamAudience=require('../studio/team-audience.js');vm.runInContext(fs.readFileSync(require.resolve('../studio/schedule-audience.js'),'utf8'),c);
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

test('header leads with the team name, then the document name, then the period; no duplicate totals',()=>{
  const h=ctx(NOW-1).yearDocHTML('review');
  assert.match(h,/<div class="pyr-h1"><b>FC 예시 U15<\/b><span>\d{4} 연간 돌아보기<\/span><\/div><div class="pyr-h2">\d{4}\.1\.1 – 12\.31<\/div><\/div><\/div>/);
  assert.ok(M.includes("#printDoc.pl-year .pyr-h1{display:flex;align-items:baseline;gap:10px;font-size:var(--t-7,20px)"),'① 20');
  assert.ok(M.includes("#printDoc.pl-year .pyr-mh b{flex:0 0 auto;font-size:var(--t-5,14px);font-weight:800")&&M.includes("#printDoc.pl-year .pyr-side h4{font-size:var(--t-5,14px);font-weight:800"),'③ 달 이름 = 오른쪽 제목');
  assert.match(ctx(NOW+1).yearDocHTML('plan'),/<b>FC 예시 U15<\/b><span>\d{4} 연간 계획<\/span>/);
});

test('calendar has three day colours only: training, match, rest',()=>{
  const h=ctx(NOW-1).yearDocHTML('review'),m=months(h);
  assert.equal(m.length,12);
  assert.ok(m[0].includes('<i class="t">5</i>')&&m[0].includes('<i class="t">6</i>')&&m[0].includes('<i class="t">7</i>'),'강도와 상관없이 훈련 한 색');
  assert.ok(m[2].includes('<i class="g">14</i>')&&m[2].includes('<i class="o">22</i>'));
  assert.equal(/class="t[lmhu]/.test(h),false);
  assert.ok(h.includes('<span><i class="t"></i>훈련</span><span><i class="g"></i>경기</span><span><i class="o"></i>휴식</span>'));
});

test('review: big numbers, monthly hours, top topics, recent results from match documents, note lines',()=>{
  const h=ctx(NOW-1).yearDocHTML('review'),m=months(h);
  assert.ok(m[2].includes('경기 2'),'추가 경기도 센다');
  assert.ok(h.includes('<div><b>4</b><span>훈련</span></div><div><b>4</b><span>시간</span></div><div><b>1승 1무 0패</b><span>전적</span></div>'));
  assert.ok(h.includes('<span>광주FC &lt;U15&gt;</span><em>2:1 <u class="r-w">승</u></em>'));
  assert.ok(h.includes('<span>수원 U15</span><em>0:0 <u class="r-d">무</u></em>'));
  assert.ok(h.includes('<h4>월별 훈련 시간</h4>')&&h.includes('<h4>많이 한 주제</h4>')&&h.includes('class="pfill pyr-pen"'));
  assert.equal(h.includes(' dim'),false,'지난해는 흐린 날이 없다');
});

test('review of a future year counts nothing and greys every day',()=>{
  const h=ctx(NOW+1).yearDocHTML('review');
  assert.ok(h.includes('아직 지난 날이 없어요'));
  assert.ok(h.includes('<div><b>0</b><span>훈련</span></div>'));
  assert.ok(h.includes('<i class="t dim">5</i>'));assert.ok(h.includes('지난 경기가 없어요'));
});

test('plan: phase band, month phase chip, goal or pen line, upcoming matches with D-n',()=>{
  const Y=NOW+1;
  const h=ctx(Y,{plan:{[Y]:{phases:[{name:'전반기',start:Y+'-03-01',end:Y+'-07-15',color:'#2E9D6A'},{name:'',start:Y+'-01-05',end:Y+'-02-28',color:'#evil'}],goals:{3:'빌드업 <첫 패스>',4:'  '}}}}).yearDocHTML('plan');
  assert.ok(h.includes('<b>전반기</b></i>')&&h.includes('class="pyr-band"'));
  const m=months(h);
  assert.ok(m[2].includes('<span class="pyr-phn"><i style="background:#2E9D6A"></i>전반기</span>'));
  assert.ok(m[0].includes('<i style="background:#2E9D6A"></i>단계</span>'),'이름 없는 단계 = «단계», 엉뚱한 색은 팔레트로');
  assert.ok(m[2].includes('<div class="pyr-goal">빌드업 &lt;첫 패스&gt;</div>'));
  assert.ok(m[3].includes('<div class="pyr-goal pen"></div>'),'빈 목표 = 펜 줄');
  assert.match(h,/<b>3\.14 [월화수목금토일]<\/b><span>광주FC &lt;U15&gt;<\/span><em>D-\d+<\/em>/);
  assert.ok(h.includes('<b>2</b><span>남은 경기</span>'));
  assert.ok(h.indexOf('1.5 – 2.28')<h.indexOf('3.1 – 7.15'),'단계는 날짜 순');
});

test('plan without phases tells where to add them',()=>{
  const h=ctx(NOW+1).yearDocHTML('plan');
  assert.ok(h.includes('시즌 계획»에서 넣어요'));assert.ok(h.includes('아직 없어요'));
});

test('group view follows the visible group',()=>{
  const h=ctx(NOW-1,{grp:'A'}).yearDocHTML('review');
  assert.ok(h.includes('1.1 – 12.31 · A 일정'));assert.equal(months(h)[5].includes('<i class="t">3</i>'),false);
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
  assert.ok(y.includes('id="spCard"'));
  assert.ok(M.includes("st.id='ps-year-plan-css'"),'인쇄 문서가 모으는 <style> 로 붙는다');
  assert.ok(S.includes('<script src="year-plan.js"></script>'));
});

const pages=h=>h.split('<div class="ponepage').slice(1);

test('review is several pages: overview, month by month, training, match record, notes — numbered',()=>{
  const h=ctx(NOW-1).yearDocHTML('review'),P=pages(h);
  assert.equal(P.length,5);
  ['달마다 돌아보기','훈련 내용','경기 기록','돌아보기 노트'].forEach((t,i)=>assert.ok(P[i+1].includes('<div class="pyr-h1"><b>'+t+'</b>'),t));
  assert.ok(P[1].includes('<div class="pyr-h0">FC 예시 U15 · '+(NOW-1)+' 연간 돌아보기</div>'),'작은 맥락 줄 + 큰 장 이름');
  P.forEach((p,i)=>assert.ok(p.includes('<span class="pyr-pg">'+(i+1)+' / 5</span>')));
  assert.equal(h.includes('@@PG@@'),false);
});

test('month table: sessions, hours, RPE, intensity split, rest, matches, record, goals and a total row; weekly load chart',()=>{
  const P=pages(ctx(NOW-1,{plan:{[NOW-1]:{phases:[],goals:{3:'전환 3초'}}}}).yearDocHTML('review'));
  const t=P[1];
  assert.equal((t.match(/<tr[^>]*><th>\d+월<\/th>/g)||[]).length,12,'지난해는 열두 달');
  assert.match(t,/<th>1월<\/th><td>3<\/td><td>3<\/td><td>3<\/td><td>5<\/td>/,'세션 · 훈련일 · 시간 · 평균 RPE');
  assert.ok(t.includes('1·0·1 <small>(1)</small>'),'저 · 중 · 고 (미입력)');
  assert.match(t,/<th>3월<\/th>.*?<td>2<\/td><td>1승 1무 0패<\/td><td>2–1<\/td>/);
  assert.ok(t.includes('<td class="txt goal">전환 3초</td>'));
  assert.ok(t.includes('<tfoot><tr><th>합계</th><td>4</td>'));
  assert.ok(t.includes('class="pyr-wk"')&&t.includes('주별 부하 흐름'));
});

test('training page: topic by month table and most used drills with counts and minutes',()=>{
  const t=pages(ctx(NOW-1).yearDocHTML('review'))[2];
  assert.ok(t.includes('pyr-heat'));
  assert.ok(t.includes('<li><b>론도 4v2</b><span>2회 · 34분</span>'),'12′×2 + 10′');
  assert.ok(t.indexOf('론도 4v2')<t.indexOf('<b>SSG</b>'),'많이 쓴 순');
});

test('match record: summary by kind and home/away, then one row per match with review notes; empty result is a pen line',()=>{
  const t=pages(ctx(NOW-1).yearDocHTML('review'))[3];
  assert.ok(t.includes('<b>1승 1무 0패</b><span>전체 2경기</span>'));
  assert.ok(t.includes('<p><u>컵</u>1경기 · 1승 0무 0패 · 2–1</p>')&&t.includes('<p><u>원정</u>1경기 · 1승 0무 0패</p>'));
  assert.ok(t.includes('<b>4 / 5</b><span>평균 실행도 · 1경기</span>'));
  assert.ok(t.includes('<b>광주FC &lt;U15&gt;</b><small>컵 · 주말리그 · 원정</small>'));
  assert.ok(t.includes('<b>2:1</b> <u class="r-w">승</u>')&&t.includes('<td>4<small>/5</small></td>'));
  assert.ok(t.includes('<u class="g">잘된 점</u>측면 2:1')&&t.includes('<u class="b">바꿀 점</u>전환 첫 3초'));
  assert.ok(t.includes('<span class="pen-l"></span>'),'리뷰 없는 경기는 펜 줄');
});

test('match record splits into pages of 7 then 10 rows',()=>{
  const c=ctx(NOW-1);
  vm.runInContext(`(function(){ for(let w=0;w<20;w++){ const d=new Date(${NOW-1},3,4+w*7); const n=offsetOfDate(d),r=Math.floor(n/7),col=((n%7)+7)%7; (weeksMap[r]=weeksMap[r]||[{},{},{},{},{},{},{}])[col]={match:{opp:'팀'+w}}; } })()`,c);
  const P=pages(c.yearDocHTML('review')).filter(p=>p.includes('<b>경기 기록</b>'));
  assert.equal(P.length,3,'22경기 = 7 + 10 + 5');
  assert.ok(P[1].includes('계속 · 8–17 / 22')&&P[2].includes('계속 · 18–22 / 22'));
  assert.equal((P[0].match(/<tr><th>\d+\.\d+ /g)||[]).length,7);assert.equal((P[1].match(/<tr><th>\d+\.\d+ /g)||[]).length,10);
});

test('review of a year with no past days stays one page',()=>{ assert.equal(pages(ctx(NOW+1).yearDocHTML('review')).length,1); });

test('plan is two pages: clean overview and a monthly planning sheet with pen lines and checkboxes',()=>{
  const Y=NOW+1, P=pages(ctx(Y,{plan:{[Y]:{phases:[{name:'전반기',start:Y+'-03-01',end:Y+'-07-15',color:'#2E9D6A'}],goals:{3:'빌드업'}}}}).yearDocHTML('plan'));
  assert.equal(P.length,2);
  const t=P[1];
  assert.ok(t.includes('<b>월별 계획표</b>'));
  assert.equal((t.match(/<tr[^>]*><th>\d+월/g)||[]).length,12);
  assert.ok(t.includes('<th>3월<small><span><i style="background:#2E9D6A"></i>전반기</span></small></th><td class="txt goal"><b>빌드업</b></td><td class="txt mt"><b>2경기</b><small>14일 광주FC &lt;U15&gt; · 14일 수원 U15</small></td>'));
  assert.ok(t.includes('<td class="txt goal"><span class="pen-l"></span></td>'),'빈 목표 = 펜 줄');
  assert.equal((t.match(/<td class="chk"><i><\/i><\/td>/g)||[]).length,12);
});

test('yearly print documents get per-page margins and skip the one-page zoom',()=>{
  const src=part('function __buildPrintDoc(','/* ---------- 출력 미리보기 모달');
  assert.ok(src.includes("padding:'+(cls==='year'?'0':(land?'10mm':'12mm'))"));
  assert.ok(src.includes("(cls==='year'?'':'<script>'+zoomJs+'<\\/script>')"));
  assert.ok(M.includes('#printDoc.pl-year .ponepage{height:209.5mm;padding:10mm 0;box-sizing:border-box;break-after:page}'));
});

test('player pages: attendance, absence, injury days, starts and reserves per player; injury record with part and days',()=>{
  const Y=NOW-1;
  const roster={players:[{id:'p2',name:'이둘',num:'9'},{id:'p1',name:'김하나',num:'7'},{id:'t1',name:'관찰',type:'target'}],
    meta:{statusRuns:{p2:[{s:'injury',from:Y+'-01-05',to:Y+'-01-07'}]},injuryInfo:{p2:{[Y+'-01-05']:{part:'발목',side:'오른쪽',when:'훈련'}}},
      participationDays:{[Y+'-01-06']:{p1:{s:'out',kind:'train',at:1}}}}};
  const P=pages(ctx(Y,{roster}).yearDocHTML('review'));
  const pt=P.find(p=>p.includes('<b>선수별 출석 · 출전</b>')), inj=P.find(p=>p.includes('<b>부상 · 결석</b>'));
  assert.ok(pt&&inj,'두 장이 생긴다');
  assert.ok(P.indexOf(pt)<P.indexOf(inj)&&P.indexOf(inj)<P.length-1,'노트 앞');
  assert.ok(pt.indexOf('김하나')<pt.indexOf('이둘'),'번호 순');assert.equal(pt.includes('관찰'),false,'관찰 대상은 빠진다');
  assert.ok(pt.includes('<b>80%</b></td><td>3</td><td>1</td><td>1</td><td><span class="z">·</span></td><td><span class="z">·</span></td><td>1</td><td><span class="z">·</span></td><td>1<small>/1</small></td>'),'김하나: 결석 1 · 선발 1');
  assert.ok(pt.includes('<b>40%</b></td><td>1</td><td>1</td><td><span class="z">·</span></td><td>3</td>'),'이둘: 부상 3일');
  assert.ok(pt.includes('명단 적은 경기 1/2'));
  assert.ok(inj.includes('<b>1<small>건</small></b><span>부상</span>')&&inj.includes('<b>3<small>일</small></b><span>부상 · 회복으로 빠진 일정</span>'));
  assert.match(inj,/<th class="txt">이둘 <small>9<\/small><\/th><td>1\.5 – 1\.7<\/td><td>3일<\/td><td class="txt">발목 · 오른쪽<\/td><td class="txt">훈련<\/td>/);
  assert.ok(inj.includes('<th class="txt">팀 출석률</th>'));
});

test('no roster or no participation module: no player pages',()=>{
  assert.equal(pages(ctx(NOW-1).yearDocHTML('review')).some(p=>p.includes('선수별 출석')),false);
  assert.ok(S.includes('<script src="participation.js?v=2.901"></script>'),'일정 화면이 출석 셈을 싣는다');
});
