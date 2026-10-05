'use strict';
/* 2.942 — 가용인원: 코치만 등록 · 오늘만(휴식·불참)은 다음 날 정상 · 기간(부상·재활)은 복귀 예상일에 «복귀 / 연장».
   사용자 «가용인원을 어떻게 체크하는 방법이 가장 이상적일까?» → 목업 ①② → «일단 코치만 등록할 수 있게». */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const idp=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
function block(from,to){const a=scout.indexOf(from),b=scout.indexOf(to,a);assert.ok(a>=0&&b>a,from);return scout.slice(a,b);}
const addDays=(d,n)=>{const v=new Date(d+'T00:00:00Z');v.setUTCDate(v.getUTCDate()+n);return v.toISOString().slice(0,10);};
const PL_STATUS=[{k:'ok'},{k:'injury'},{k:'rehab'},{k:'out'},{k:'rest'}];

function ctx(players,opt={}){
  let today=opt.today||'2026-10-05',saves=0;const toasts=[],picks=[];
  const c=vm.createContext({PL_STATUS,JSON,Date,String,Object,
    data:{players,meta:{statusRuns:opt.runs||{}}},
    stYmd:()=>today,stAddDays:addDays,tmOurs:()=>players.filter(p=>p.type!=='target'),
    esc:s=>String(s),TM_ST_LB:{ok:'정상',rehab:'재활',injury:'부상',out:'불참',rest:'휴식'},
    tmRole:()=>opt.role||'admin',tmProposalOf:()=>null,
    window:{PSPerms:{role:()=>opt.role||'admin',canEdit:()=>opt.canEdit!==false}},
    scoutAutomaticWriteAllowed:()=>opt.canEdit!==false,
    save:()=>{saves++;},renderTeam(){},renderTeamHome(){},toast:t=>toasts.push(t),avUpdateTodayRecord(){},
    setTimeout:fn=>fn()});
  vm.runInContext(block('function stRuns(){','function stStampToday(')+'\n'+block('var ST_DAILY=','/* 복귀 예상 고르개')+'\n'+block('function tmCanApprove(','function tmProposalOf(')+'\n'+block('function tmCanEditStatus(','function posPickOpen('),c);
  c.stReturnPick=(anchor,pl)=>picks.push(pl.id);
  return {c,toasts,picks,get saves(){return saves;},day:d=>{today=d;}};
}

test('오늘만(휴식·불참)은 적은 날만 — 다음 날 읽으면 정상, 기간은 날짜가 지나도 그대로',()=>{
  const ps=[{id:'a',status:'out',statusUntil:'2026-10-05'},{id:'b',status:'rest',statusUntil:'2026-10-04'},{id:'c',status:'injury',statusUntil:'2026-10-01'},{id:'d',status:'out'}];
  const {c}=ctx(ps);
  assert.equal(c.plStatusOf(ps[0]),'out','오늘 적은 불참');
  assert.equal(c.plStatusOf(ps[1]),'ok','어제 적은 휴식은 오늘 정상');
  assert.equal(c.plStatusOf(ps[2]),'injury','부상은 복귀 예정일이 지나도 코치가 확인할 때까지 부상');
  assert.equal(c.plStatusOf(ps[3]),'out','복귀 예상이 없는 옛 기록은 예전처럼 유지(배포만으로 상태를 바꾸지 않는다)');
});
test('상태를 바꿀 때 복귀 예상 규칙',()=>{
  const {c}=ctx([]);const p={};
  p.status='out';c.stApplyUntil(p,'ok','out');assert.equal(p.statusUntil,'2026-10-05','오늘만 = 오늘');
  p.status='injury';c.stApplyUntil(p,'out','injury');assert.equal(p.statusUntil,undefined,'오늘만 → 기간: 모름에서 시작');
  c.stApplyUntil(p,'injury','injury','2026-10-12');assert.equal(p.statusUntil,'2026-10-12');
  p.status='rehab';c.stApplyUntil(p,'injury','rehab');assert.equal(p.statusUntil,'2026-10-12','부상 → 재활은 예상일 유지');
  c.stApplyUntil(p,'rehab','rehab','');assert.equal(p.statusUntil,undefined,'모름');
  p.status='ok';p.statusUntil='2026-10-20';c.stApplyUntil(p,'rehab','ok');assert.equal(p.statusUntil,undefined,'정상은 예상일 없음');
});
test('오늘만이 지나면 기록은 그 날까지 · 다음 날부터 정상(빈 날을 쉼으로 메우지 않는다)',()=>{
  const ps=[{id:'a',status:'out',statusUntil:'2026-10-02'}];
  const t=ctx(ps,{runs:{a:[{s:'ok',from:'2026-09-01',to:'2026-10-01'},{s:'out',from:'2026-10-02',to:'2026-10-02'}]}});
  assert.equal(t.c.stExpireDaily(ps),1);
  assert.equal(ps[0].status,'ok');assert.equal(ps[0].statusUntil,undefined);
  const runs=t.c.data.meta.statusRuns.a;
  assert.deepEqual(runs.map(r=>[r.s,r.from,r.to]),[['ok','2026-09-01','2026-10-01'],['out','2026-10-02','2026-10-02'],['ok','2026-10-03','2026-10-05']]);
  assert.equal(t.c.stExpireDaily(ps),0,'두 번 해도 같다');
});
test('옛 판 기기가 이미 늘려 둔 오늘만 기록은 그 날로 자른다',()=>{
  const ps=[{id:'a',status:'rest',statusUntil:'2026-10-02'}];
  const t=ctx(ps,{runs:{a:[{s:'rest',from:'2026-10-02',to:'2026-10-04'}]}});
  t.c.stExpireDaily(ps);
  assert.deepEqual(t.c.data.meta.statusRuns.a.map(r=>[r.s,r.from,r.to]),[['rest','2026-10-02','2026-10-02'],['ok','2026-10-03','2026-10-05']]);
});
test('권한 없는 기기는 지난 오늘만을 저장하지 않는다(보이는 값은 이미 정상)',()=>{
  const ps=[{id:'a',status:'out',statusUntil:'2026-10-01'}];
  const t=ctx(ps,{canEdit:false,role:'player'});
  assert.equal(t.c.stExpireDailySave(),false);assert.equal(t.saves,0);assert.equal(ps[0].status,'out');assert.equal(t.c.plStatusOf(ps[0]),'ok');
});
test('복귀 예정일이 된(지난) 부상·재활만 «복귀 확인»에',()=>{
  const ps=[{id:'a',name:'박준서',status:'rehab',statusUntil:'2026-10-05'},{id:'b',name:'김민수',status:'injury',statusUntil:'2026-10-12'},{id:'c',name:'최',status:'injury',statusUntil:'2026-10-01'},{id:'d',name:'모름',status:'injury'},{id:'t',type:'target',status:'injury',statusUntil:'2026-10-01'}];
  const {c}=ctx(ps);
  assert.deepEqual(c.stReturnDue().map(p=>p.id),['a','c']);
  const h=c.stReturnDueHTML();
  assert.match(h,/복귀 예정일이 된 선수 2/);assert.match(h,/오늘 복귀 예정/);assert.match(h,/10\/1 복귀 예정이었어요/);
  assert.match(h,/data-st-ret="ok" data-pid="a"/);assert.match(h,/data-st-ret="more" data-pid="c"/);
  const ro=ctx(ps,{canEdit:false,role:'player'});assert.doesNotMatch(ro.c.stReturnDueHTML(),/data-st-ret/,'권한 없으면 버튼 없이 사실만');
});
test('코치만 등록 — 팀 편집 권한이 있는 스태프는 바로 적용, 제안을 만들지 않는다',()=>{
  const ps=[{id:'a',name:'정우진',status:'ok'}];
  const t=ctx(ps,{role:'staff'});
  t.c.tmStatusApply(ps[0],'out');
  assert.equal(ps[0].status,'out');assert.equal(ps[0].statusUntil,'2026-10-05');assert.equal(t.c.data.statusProposals.length,0);
  assert.match(t.toasts.pop(),/불참 · 오늘만/);
  const p=ctx([{id:'b',status:'ok'}],{role:'player',canEdit:false});
  p.c.tmStatusApply(p.c.data.players[0],'injury');
  assert.equal(p.c.data.players[0].status,'ok','선수는 못 바꾼다');assert.match(p.toasts.pop(),/코치가 바꿔요/);
});
test('부상·재활을 고르면 복귀 예상을 바로 묻고, 같은 상태를 다시 고르면 예상만 고친다',()=>{
  const ps=[{id:'a',status:'ok'}],t=ctx(ps),anchor={getBoundingClientRect:()=>({left:0,top:0,width:10,height:10,bottom:10})};
  t.c.tmStatusApply(ps[0],'injury',anchor);
  assert.equal(ps[0].status,'injury');assert.deepEqual(t.picks,['a']);
  t.c.tmStatusApply(ps[0],'injury',anchor);
  assert.deepEqual(t.picks,['a','a']);assert.equal(t.saves,1,'같은 상태는 다시 저장하지 않는다');
  t.c.tmStatusApply(ps[0],'rehab',anchor);assert.deepEqual(t.picks,['a','a'],'부상 → 재활은 예상일을 그대로 쓰고 다시 묻지 않는다');
});
test('가용인원 기록 창·사유 창·명단 칩·콕핏이 같은 규칙을 쓴다',()=>{
  assert.match(scout,/\["admin","executive","staff"\]\.indexOf\(role\)<0/);
  assert.match(scout,/await stSetAt\(pid,selected,day,ctx,note\.value,\(isToday&&ST_SPAN\[selected\]\)\?retSel:undefined\)/);
  assert.match(scout,/await stSetAt\(pid,plStatusOf\(pl\),ctx\.day,ctx,v,retB\?retSel:undefined\)/);
  assert.match(scout,/if\(day===today\)\{var _pv=plStatusOf\(p\);p\.status=st;stApplyUntil\(p,_pv,st,until\);/);
  assert.match(scout,/전체 보기 →<\/button><\/div><div class="bd">'\+stReturnDueHTML\(\)/);
  assert.match(scout,/stPickOpen\(injury,cur\?cur\.to:plStatusOf\(pl\),function\(to\)\{ tmStatusApply\(pl,to,injury\); \}\);/);
  assert.match(scout,/var LB=\{ok:"정상",injury:"부상",rehab:"재활",rest:"휴식",out:"불참"\}/);
});
test('IDP 선수단 오늘 표에서 누를 수 없던 «출석» 칸을 걷었다',()=>{
  assert.doesNotMatch(idp,/\(can\?'<th>출석<\/th>':''\)/);
  assert.doesNotMatch(idp,/class="phys-state sqg-phys/);
});
