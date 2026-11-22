'use strict';
/* 3.308 — 가용인원 › 날짜별 명단을 표로(avail-table.js). 사용자 11/17 노션 표 «이런식으로 보이게» → 목업 B안(조마다 묶음 · 학년 묶음 줄 ·
   번호 · 조 · 이름 · 포지션 · 상태 · 부상 · 메모) + «이름 앞에 A팀 B팀 눌러서 선택»(조 칩 → grpPickOpen).
   모듈을 vm 으로 돌리고 scout.html · sw.js 는 배선(호출 자리)만 글자로 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const AT=fs.readFileSync(path.join(root,'studio/avail-table.js'),'utf8');
const RA=fs.readFileSync(path.join(root,'studio/roster-audience.js'),'utf8');
const SC=fs.readFileSync(path.join(root,'studio/scout.html'),'utf8');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY='2026-11-17';
function ctx(){
  const st={phone:false,view:'grp',resolved:{},note:{},editable:true,episodes:{},picked:[],saved:0,rendered:0,toasts:[]};
  const players=[
    {id:'p1',name:'가상 강민',num:'1',grp:'A팀',posId:'gk',schoolYear:'1'},
    {id:'p2',name:'가상 <부상>',num:'2',grp:'A팀',posId:'cm',schoolYear:'1'},
    {id:'p5',name:'가상 신규',num:'5',grp:'A팀',posId:'cm',schoolYear:'2'},
    {id:'p3',name:'가상 재활',num:'3',grp:'B팀',posId:'cm',schoolYear:'2'},
    {id:'p4',name:'가상 정상',num:'',grp:'B팀',posId:'cm'}
  ];
  const c=vm.createContext({
    console,
    data:{meta:{grpBase:['A팀','B팀']},players:players,positions:[{id:'gk',name:'GK'},{id:'cm',name:'CM'}]},
    esc,
    plGrpOf:p=>String(p.grp||'').trim(),
    tmAudienceEditable:()=>st.editable,
    avPosition:p=>p.posId==='gk'?'GK':'CM',
    avIsGk:p=>p.posId==='gk',
    avProfileLink:p=>'<button class="av-player-link" data-av-player-edit="'+p.id+'">'+esc(p.name)+'</button>',
    avEditButton:(p,day,r)=>'<button class="av-chip '+(r.s||'')+'" data-av-st="'+p.id+'">'+(r.s||'가능')+'</button>',
    avFieldGk:(n,gk)=>'<span class="fgk">필드 <b>'+(n-gk)+'</b> · GK <b>'+gk+'</b></span>',
    avResolve:(p)=>({s:st.resolved[p.id]||'',kind:'train',note:st.note[p.id]||''}),
    avScheduled:k=>k==='train'||k==='match',
    tmPhoneRows:()=>st.phone,
    stEpisodes:p=>st.episodes[p.id]||[],
    stInjLabel:e=>e.part||'부위 미정',
    stDayDiff:(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5),
    stYmd:()=>DAY,
    get availView(){return st.view;},
    get availDay(){return DAY;},
    grpPickOpen:(btn,cur,on)=>{st.picked.push(String(cur||''));st.onPick=on;},
    save:()=>{st.saved++;},renderAvail:()=>{st.rendered++;},renderPlayers:()=>{},renderTeam:()=>{},toast:m=>{st.toasts.push(m);},avClosePicker:()=>{},
    localStorage:{getItem:()=>null,setItem:()=>{}},
    PSTeamAudience:require(path.join(root,'studio/team-audience.js'))
  });
  vm.runInContext(RA,c);c.avYearSplit=true;   /* avYearLead · avYearTag · avYearOrder · tmGrpLabel(=키) — document 가 없어 CSS 는 안 붙는다 */
  c.tmAudienceEditable=()=>st.editable;   /* roster-audience 의 것(document.body 를 본다)을 다시 덮는다 */
  /* 조별 묶음 — scout.html avGroups 와 같은 차례: 쉼이 아닌 선수 먼저, 그 뒤 학년 차례(avYearOrder) */
  c.avGroups=function(ours){const by={};ours.forEach(p=>{(by[p.grp]||(by[p.grp]=[])).push(p);});
    return Object.keys(by).map(g=>({name:g,players:c.avYearOrder(by[g].slice().sort((a,b)=>{const r=id=>st.resolved[id]&&st.resolved[id]!=='ok'?1:0;return r(a.id)-r(b.id);}))}));};
  vm.runInContext(AT,c);
  c.st=st;return c;
}
const J=x=>JSON.parse(JSON.stringify(x));

test('desktop: one table — group rows with the field/GK split, year rows, rest rows tinted in place, 7 columns',()=>{
  const c=ctx();c.st.resolved={p1:'ok',p2:'injury',p5:'ok',p3:'rehab',p4:'ok'};c.st.note.p2='치료';
  const out=c.avTableBody(c.data.players,DAY);
  assert.deepEqual(J(out.total),{ok:3,rest:2,scheduled:5});assert.deepEqual(J(out.rc),{gk:1,field:2,rehab:1,out:1});
  const h=out.html;
  assert.ok(h.startsWith('<div class="av-day-wrap"><table class="av-day-table"><thead>'));
  assert.deepEqual([...h.matchAll(/<th class="c-([a-z]+)">([^<]+)<\/th>/g)].map(m=>m[2]),['번호','조','이름','포지션','상태','부상','메모']);
  const rows=[...h.matchAll(/<tr class="([^"]+)"[^>]*>(?:<th colspan="7" scope="rowgroup">([^<]*)|<td class="c-no"><span class="no">([^<]*))/g)].map(m=>m[1]+(m[2]!==undefined?':'+m[2].trim():':#'+m[3]));
  assert.deepEqual(rows,['av-grp-row:A팀','av-ysub:2학년','av-pl:#5','av-ysub:1학년','av-pl:#1','av-pl rest:#2','av-grp-row:B팀','av-ysub:2학년','av-pl rest:#3','av-ysub:학년 미지정','av-pl:#–'],'조 줄 → 학년 줄 → 가능 → 쉼(옅은 줄) 차례, 쉼이 제 학년 아래');
  assert.ok(h.includes('A팀 <span class="n">가능 2 / 3명</span><span class="fgk">필드 <b>1</b> · GK <b>1</b></span>'),'조 머리 = 참여 기록 · 필드/GK(2.956)');
  assert.ok(h.includes('1학년 <span class="n">가능 1 / 2명</span>')&&h.includes('2학년 <span class="n">가능 0 / 1명</span>'),'학년 줄은 «가능 n / m명»(3.283 과 같은 셈)');
  assert.ok(h.includes('<td class="c-grp"><button type="button" class="av-grp-chip" data-av-grp="p1" aria-label="가상 강민 조 고르기 — 지금 A팀">A팀<span aria-hidden="true"> ⌄</span></button></td><td class="c-nm"><button class="av-player-link" data-av-player-edit="p1">'),'이름 앞 조 칩 → 이름(프로필 링크)');
  assert.ok(/<td class="c-pos"><button type="button" class="av-pos av-pos-chip gk" data-av-pos="p1"[^>]*>GK<span aria-hidden="true"> ⌄<\/span><\/button><\/td>/.test(h),'GK 는 포지션 강조 · 3.363 편집 권한이 있으면 포지션 칩(단추)');
  assert.ok(h.includes('<td class="c-memo"><span class="av-player-note">치료</span></td>'),'메모 = 그날 사유');
  assert.ok(h.includes('data-av-player-edit="p2">가상 &lt;부상&gt;</button>')&&!h.includes('<부상>'),'이름은 esc');
  assert.equal((h.match(/data-av-st="/g)||[]).length,5,'상태 칩은 선수마다 하나(한 번만 그린다)');
});

test('injury cell: only on an injury/rehab day, the episode covering that day — part (or «부위 미정») + days',()=>{
  const c=ctx();c.st.episodes={p2:[{from:'2026-11-13',to:DAY,open:true,part:'발목'}],p3:[{from:'2026-11-01',to:'2026-11-10',open:false},{from:'2026-11-16',to:DAY,open:true}]};
  const p=id=>c.data.players.find(x=>x.id===id);
  assert.equal(c.avInjCell(p('p2'),DAY,{s:'injury'}),'<span class="av-inj">발목<small>5일째</small></span>');
  assert.equal(c.avInjCell(p('p3'),DAY,{s:'rehab'}),'<span class="av-inj nopart">부위 미정<small>2일째</small></span>','부위를 안 적었으면 «부위 미정»');
  assert.equal(c.avInjCell(p('p3'),'2026-11-05',{s:'injury'}),'<span class="av-inj nopart">부위 미정<small>5일째</small></span>','지난 날은 그 날에 걸친 기록 · 그 날까지의 일수');
  assert.equal(c.avInjCell(p('p2'),'2026-11-12',{s:'injury'}),'','그 날에 걸친 기록이 없으면 빈 칸');
  assert.equal(c.avInjCell(p('p2'),DAY,{s:'ok'}),'','가능 · 휴식 · 불참인 날은 비운다');
});

test('phone (≤600): three columns, a table per group inside «운동» and «참여 못 함» (2.939 kept), year tags only in the rest box',()=>{
  const c=ctx();c.st.phone=true;c.st.resolved={p1:'ok',p2:'injury',p5:'ok',p3:'rehab',p4:'ok'};
  const h=c.avTableBody(c.data.players,DAY).html;
  assert.ok(h.startsWith('<div class="av-split-ok"><div class="av-sec-h">운동 <span class="n">3명</span></div>'));
  assert.ok(h.includes('<div class="av-restbox av-split-rest"><div class="rh">참여 못 함 <span class="n">2명</span></div>'));
  assert.equal((h.match(/<table class="av-day-table phone">/g)||[]).length,4,'운동 A · B + 참여 못 함 A · B');
  assert.deepEqual([...h.matchAll(/<th class="c-([a-z]+)">([^<]+)<\/th>/g)].map(m=>m[2]),['이름','상태','부상 · 메모','이름','상태','부상 · 메모'],'머리줄은 운동 표에만');
  assert.ok(/<td class="c-nm"><button class="av-player-link" data-av-player-edit="p1">가상 강민<\/button><small class="av-yr">1학년<\/small><button type="button" class="av-grp-chip" data-av-grp="p1"[^>]*>A팀<span aria-hidden="true"> ⌄<\/span><\/button><small class="sub">1 · <button type="button" class="av-pos av-pos-chip gk" data-av-pos="p1"[^>]*>GK<span aria-hidden="true"> ⌄<\/span><\/button><\/small><\/td>/.test(h),'이름(학년 꼬리표는 CSS 가 숨긴다) 옆 조 칩 · 아래 번호 · 포지션');
  const ok=h.slice(0,h.indexOf('av-split-rest')),rest=h.slice(h.indexOf('av-split-rest'));
  assert.equal((ok.match(/class="av-ysub"/g)||[]).length,3,'운동 쪽 학년 줄 셋(1 · 2 · 미지정)');assert.equal((rest.match(/class="av-ysub"/g)||[]).length,0);
  assert.deepEqual([...rest.matchAll(/data-av-player-edit="(p\d)">[^<]*<\/button><small class="av-yr">(\d학년)/g)].map(m=>m[1]+':'+m[2]),['p2:1학년','p3:2학년'],'참여 못 함 쪽만 자리 옆 학년');
});

test('group chip: a button only for editors; picking writes p.grp through save() and redraws; same value is a no-op',()=>{
  const c=ctx();const p1=c.data.players[0];
  c.avGrpPick({dataset:{avGrp:'p1'}});assert.deepEqual(c.st.picked,['A팀']);
  c.st.onPick('A팀');assert.equal(c.st.saved,0,'같은 조는 안 쓴다');
  c.st.onPick('B팀');assert.equal(p1.grp,'B팀');assert.equal(c.st.saved,1);assert.equal(c.st.rendered,1);assert.match(c.st.toasts.pop(),/가상 강민 → B팀/);
  c.avGrpPick({dataset:{avGrp:'p1'}});c.st.onPick('');assert.ok(!('grp' in p1),'«없음»은 칸을 지운다');assert.equal(c.st.saved,2);
  /* 동기화가 명단을 바꿔 끼운 뒤(옛 선수 객체) — 쓰지 않고 다시 그린다 */
  c.avGrpPick({dataset:{avGrp:'p2'}});const p2=c.data.players[1];c.data.players=c.data.players.map(x=>Object.assign({},x));c.st.onPick('B팀');
  assert.equal(p2.grp,'A팀');assert.equal(c.st.saved,2);assert.equal(c.st.rendered,3);
  c.st.editable=false;c.st.picked=[];c.avGrpPick({dataset:{avGrp:'p1'}});assert.deepEqual(c.st.picked,[],'권한 없으면 고르개를 안 연다');assert.match(c.st.toasts.pop(),/권한/);
  assert.equal(c.avGrpChip(c.data.players[2]),'<span class="av-grp-chip ro">A팀</span>','권한 없으면 글자만');
});

test('roster-audience avYearLead: daily table mode keeps the «가능 n / m명» text on a tr.av-ysub row',()=>{
  const c=ctx();c.st.resolved={p1:'ok',p2:'injury'};
  const g={name:'A팀',players:c.data.players.slice(0,2)};
  assert.equal(c.avYearLead(g,g.players[0],7,true),'<tr class="av-ysub"><th colspan="7" scope="rowgroup">1학년 <span class="n">가능 1 / 2명</span></th></tr>');
  assert.equal(c.avYearLead(g,g.players[1],7,true),'','같은 학년 둘째 선수 앞엔 없다');
  const g2={name:'A팀',players:c.data.players.slice(0,2)};
  assert.equal(c.avYearLead(g2,g2.players[0],9),'<tr class="av-table-year"><th colspan="9" scope="rowgroup">1학년 <span class="n">2명</span></th></tr>','누적 표는 예전 그대로');
});

test('wiring: scout.html body → avTableBody, script after roster-audience.js, sw CORE, release note, build pins',()=>{
  const a=SC.indexOf('function renderAvailDaily('),daily=SC.slice(a,SC.indexOf('\nfunction ',a+10));
  assert.ok(daily.includes('var built=avTableBody(ours,day),body=built.html;total=built.total;rc=built.rc;'));
  assert.ok(!daily.includes('av-restbox')&&!daily.includes('<div class="av-pl">'),'옛 카드 · 조 끝 쉼 상자는 본문에서 걷었다');
  assert.ok(SC.includes('<script src="roster-audience.js"></script><script src="avail-table.js"></script>'),'avYearLead 를 쓰므로 roster-audience.js 뒤');
  assert.ok(/'\/studio\/roster-audience\.js', '\/studio\/avail-table\.js'/.test(fs.readFileSync(path.join(root,'sw.js'),'utf8')));
  assert.ok(AT.includes("tr.av-pl{display:table-row;grid-template-columns:none"),'옛 .av-pl grid 규칙을 tr 에서 걷는다');
  const notes=require('../studio/release-notes.js'),e=notes.entries().find(x=>x.id==='2026-11-17-v3-308-avail-table');assert.ok(e);assert.match(e.title,/v3\.308/);assert.equal(e.changes.length,3);
  const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([0-9.]+)'/)[1];assert.ok(Number(build)>=3.308);
  assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),new RegExp("const CACHE = 'process-"+build.replace(/\./g,'\\.')+"';"));
});
