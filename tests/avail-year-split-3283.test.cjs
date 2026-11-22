'use strict';
/* 3.283 — 가용인원 조별 보기 안에서 «학년 나누기»(사용자 «조별에서 학년별로 나눌 수 있게») · 선수 추가 시트 · 선수 편집 창의 조 · 학년.
   roster-audience.js 의 순수 함수는 vm 으로 돌리고, scout.html · idp.html 은 배선(호출 자리)만 글자로 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const SRC=fs.readFileSync(path.join(root,'studio/roster-audience.js'),'utf8');
const SC=fs.readFileSync(path.join(root,'studio/scout.html'),'utf8');
const IDP=fs.readFileSync(path.join(root,'studio/idp.html'),'utf8');
const J=x=>JSON.parse(JSON.stringify(x));   /* vm 영역의 배열은 deepStrictEqual 이 원형 차이로 떨어진다 */

function ctx(over){
  const state={availView:'grp',availDay:'2026-11-11',resolved:{},phone:false,stored:{}};
  const c=vm.createContext(Object.assign({
    console,
    PSTeamAudience:require(path.join(root,'studio/team-audience.js')),
    localStorage:{getItem:k=>Object.prototype.hasOwnProperty.call(state.stored,k)?state.stored[k]:null,setItem:(k,v)=>{state.stored[k]=String(v);}},
    data:{meta:{grpBase:['A팀','B팀'],grpLabels:{'A팀':'1군'}},players:[]},
    stYmd:()=>'2026-11-11',
    avResolve:(p)=>({s:state.resolved[p.id]||''}),
    tmPhoneRows:()=>state.phone,
    get availView(){return state.availView;},
    get availDay(){return state.availDay;}
  },over||{}));
  vm.runInContext(SRC,c);
  c.state=state;c.avYearSplit=true;
  return c;
}
const P=(id,y,grp)=>({id,schoolYear:y,grp:grp||'A팀',name:id});

test('학년 차례 — 조별 보기에서 켜졌을 때만, 학년을 적은 선수가 있는 조만 3 · 2 · 1 · 신입생 · 미지정 차례로(3.364 높은 학년 먼저)',()=>{
  const c=ctx();const list=[P('a','3'),P('b',''),P('c','1'),P('d','2'),P('e','1'),P('f','0')];
  assert.deepEqual(J(c.avYearOrder(list).map(p=>p.id)),['a','d','c','e','f','b'],'높은 학년 먼저 · 신입생 · 미지정, 학년 안에서는 원래 차례 그대로');
  assert.equal(c.avYearOrder([P('x',''),P('y','')]).map(p=>p.id).join(),'x,y','학년이 하나도 없는 조는 손대지 않는다');
  c.state.availView='pos';assert.equal(c.avYearOrder(list),list,'포지션별 보기는 그대로');
  c.state.availView='grp';c.avYearSplit=false;assert.equal(c.avYearOrder(list),list,'꺼져 있으면 그대로');
  assert.equal(c.avYearKey({schoolYear:'7'}),'','3.359 — 0~6 만 학년(초등 6학년까지)');assert.equal(c.avYearKey({grade:'1'}),'','평가 등급은 학년이 아니다');
});

test('학년 줄 — 그 학년의 첫 선수 앞에 한 번 · 날짜별은 «가능 n / m명»(데스크톱 = 참여 기록, 폰 = 쉼이 아닌 선수) · 누적 표는 «m명»',()=>{
  const c=ctx();const g={players:[P('a1','1'),P('a2','1'),P('b1','2'),P('n1','')]};
  c.state.resolved={a1:'ok',a2:'injury',b1:'',n1:'ok'};
  assert.equal(c.avYearLead(g,g.players[0]),'<div class="av-ysub">1학년 <span class="n">가능 1 / 2명</span></div>');
  assert.equal(c.avYearLead(g,g.players[1]),'','같은 학년의 둘째 선수 앞에는 없다');
  assert.equal(c.avYearLead(g,g.players[2]),'<div class="av-ysub">2학년 <span class="n">가능 0 / 1명</span></div>','미기록은 데스크톱 조 머리와 같이 «가능»에 안 센다');
  assert.equal(c.avYearLead(g,g.players[3]),'<div class="av-ysub">학년 미지정 <span class="n">가능 1 / 1명</span></div>');
  const phone=ctx();phone.state.phone=true;phone.state.resolved={a1:'ok',a2:'injury',b1:'',n1:'ok'};const g2={players:g.players.map(p=>Object.assign({},p))};
  assert.equal(phone.avYearLead(g2,g2.players[2]),'<div class="av-ysub">2학년 <span class="n">가능 1 / 1명</span></div>','폰 «운동» 덩어리는 미기록을 운동으로 센다(2.939)');
  const t={players:g.players.map(p=>Object.assign({},p))};
  assert.equal(c.avYearLead(t,t.players[0],9),'<tr class="av-table-year"><th colspan="9" scope="rowgroup">1학년 <span class="n">2명</span></th></tr>');
  assert.equal(c.avYearLead({players:[P('x',''),P('y','')]},P('x','')),'','학년이 없는 조는 줄이 없다');
  c.avYearSplit=false;assert.equal(c.avYearLead({players:[P('z','1')]},P('z','1')),'','꺼져 있으면 없다');
});

test('학년 꼬리표 · 토글 단추 — 조별 보기에서만',()=>{
  const c=ctx();
  assert.equal(c.avYearTag(P('a','2')),'<small class="av-yr">2학년</small>');assert.equal(c.avYearTag(P('b','')),'');
  assert.match(c.avYearToggleHTML(),/^<button type="button" class="av-ysplit" data-av-ysplit aria-pressed="true">학년 나누기<\/button>$/);
  c.avYearSplit=false;assert.match(c.avYearToggleHTML(),/aria-pressed="false"/);assert.equal(c.avYearTag(P('a','2')),'');
  c.state.availView='name';assert.equal(c.avYearToggleHTML(),'','이름순 · 포지션별에는 단추가 없다');
  c.state.availView='grp';c.avYearToggle();assert.equal(c.avYearSplit,true);assert.equal(c.state.stored.cs_av_year_v1,'1','이 기기에만 기억');
  c.avYearToggle();assert.equal(c.state.stored.cs_av_year_v1,'0');
});

test('선수 추가 시트의 조 · 학년 칸과 값 넣기 — 조 이름은 표시 이름, 저장은 키',()=>{
  const c=ctx();const f=c.tmAudienceFields();
  assert.deepEqual(J(f.map(x=>[x.key,x.type])),[['grp','select'],['schoolYear','seg']]);
  assert.deepEqual(J(f[0].options.map(o=>[o.value,o.label])),[['','없음'],['A팀','1군'],['B팀','B팀']],'grpLabels 로 바꾼 이름이 보이고 값은 키');
  assert.deepEqual(J(f[1].options.map(o=>o.value)),['','0','1','2','3'],'3.354 — 신입생(0)이 미지정 다음');
  const p=c.tmAudienceApply({id:'n'},{grp:'B팀',schoolYear:'2'});assert.equal(p.grp,'B팀');assert.equal(p.schoolYear,'2');
  const q=c.tmAudienceApply({id:'m'},{grp:'',schoolYear:'7'});assert.equal('grp' in q,false);assert.equal('schoolYear' in q,false,'빈 조 · 0~6 아닌 학년은 적지 않는다');
});

test('배선 — 가용인원 두 화면 · 선수 추가 시트 · 선수 편집 창 · IDP 신상',()=>{
  const fn=name=>{const a=SC.indexOf('function '+name+'(');const b=SC.indexOf('\nfunction ',a+10);assert.ok(a>=0,name);return SC.slice(a,b);};
  assert.ok(fn('avGrouping').includes("+'</span>'+avYearToggleHTML();"),'묶기 단추 옆 토글');
  assert.ok(fn('avGroups').includes('players:avYearOrder(rows[g].slice().sort('),'조 안 차례');
  const daily=fn('renderAvailDaily'),AT=fs.readFileSync(path.join(root,'studio/avail-table.js'),'utf8');   /* 3.308 — 몸통은 표 모듈 */
  assert.ok(daily.includes('var built=avTableBody(ours,day)'),'날짜별 몸통은 avail-table.js');
  assert.ok(AT.includes('avYearLead(group,p,cols,true)+row'),'날짜별 학년 줄(표 · «가능 n / m명»)');assert.ok(AT.includes('name=avProfileLink(p)+avYearTag(p)'),'학년 꼬리표');
  assert.ok(fn('renderAvailPlayers').includes('h+=avYearLead(group,p,cols);'),'누적 표 학년 줄');
  assert.ok(SC.includes('options:posOpts,value:""}].concat(tmAudienceFields()),'),'선수 추가 시트 칸');
  assert.ok(SC.includes('data.players.push(tmAudienceApply({id:uid("pl"),name:v.name,'),'선수 추가 시트 값');
  assert.ok(fn('openPlayer').includes('tmAudienceEditChips(pl);'),'선수 편집 창 칩');
  assert.ok(IDP.includes("['학년',/^[0-6]$/.test(String(p.schoolYear||''))?PSTeamAudience.yearLabel(p.schoolYear):'']"),'IDP 신상의 학년은 schoolYear');
  assert.ok(!IDP.includes("['학년',p.grade]"),'평가 등급을 학년으로 보이지 않는다');
});
