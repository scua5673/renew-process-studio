'use strict';
// 2.893 — 서버 확인 대기(읽기 전용) 중에도 일정에서 사라진 경기의 빈 껍데기는 지워 1644 가드 교착을 푼다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function extract(name){
  const i=src.indexOf('\nfunction '+name+'(');assert.ok(i>=0,name);
  let d=0,k=src.indexOf('{',i),q=null,esc=false;
  for(;k<src.length;k++){const c=src[k];
    if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q=null;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}
    if(c==='/'&&src[k+1]==='*'){k=src.indexOf('*/',k+2)+1;continue;}
    if(c==='/'&&src[k+1]==='/'){k=src.indexOf('\n',k);continue;}
    if(c==='{')d++;else if(c==='}'){d--;if(d===0)break;}}
  return src.slice(i+1,k+1);
}
const names=['matchLoad','matchPruneDeadShells','matchDropStaleAuto','matchHasContent','matchPhaseReviewHas','matchPhaseReviewRowHas','scheduleText','scheduleMatchSlots','scheduleHasMatch','scheduleOpponent','scheduleMatchTime','scheduleMid','scheduleSlotSourceId','scheduleSlotAltSourceId'];
const code=names.map(extract).join('\n');
const shell=(sid,extra={})=>({id:'mt-'+sid,competition:'팀 일정',opponent:'상대 미정',date:'2026-10-03',time:'',formation:'4-1-2-3',prepPublished:false,fifaMode:'simple',kind:'official',execution:0,reviewPublished:false,createdAt:1,updatedAt:1,sourceId:sid,...extra});
function harness({pending,matches,weeks}){
  const docs={process_coach_v1:weeks===undefined?{anchorMonday:'2026-09-28',weeks:{0:[{d:'월'},{d:'화'},{d:'수'},{d:'목'},{d:'금'},{d:'토',mid:'mDEAD',off:true,board:{sched:'OFF'}},{d:'일',mid:'mLIVE',match:{opp:'가상 FC'},board:{sched:'경기'}}]}}:weeks,
    cs_team_matches_v1:{version:1,matches}};
  const sets=[];
  const c=vm.createContext({MATCH_KEY:'cs_team_matches_v1',matchState:null,matchCurrent:'',
    store:{get:k=>JSON.parse(JSON.stringify(docs[k]??null)),set:(k,v)=>{sets.push(k);docs[k]=JSON.parse(JSON.stringify(v));return true;}},
    matchDocPending:()=>pending,matchMergeSchedule:()=>{throw new Error('merge must not run while pending');},
    PSSchedule:{newId:()=>{throw new Error('no new ids while pending');}}});
  vm.runInContext(code,c);
  return {c,docs,sets};
}

test('pending: a blank shell whose schedule day is no longer a match is removed and saved',()=>{
  const h=harness({pending:true,matches:[shell('sched:mDEAD'),shell('sched:mLIVE',{opponent:'가상 FC',date:'2026-10-04'})]});
  const o=h.c.matchLoad();
  assert.deepEqual(o.matches.map(m=>m.sourceId),['sched:mLIVE']);
  assert.deepEqual(h.sets,['cs_team_matches_v1']);
  assert.deepEqual(h.docs.cs_team_matches_v1.matches.map(m=>m.sourceId),['sched:mLIVE']);
});

test('pending: rows with content, an opponent, or no schedule link are never removed',()=>{
  const rows=[shell('sched:mDEAD',{reviewGood:'가상 리뷰'}),shell('sched:mGONE',{opponent:'가상 원정'}),shell('',{id:'manual'}),shell('schedx:mDEAD2',{scoreUs:'2'})];
  const h=harness({pending:true,matches:rows});
  assert.equal(h.c.matchLoad().matches.length,4);
  assert.deepEqual(h.sets,[],'nothing to write');
});

test('pending with no schedule weeks or no match cells: nothing is touched',()=>{
  for(const weeks of [null,{anchorMonday:'2026-09-28',weeks:{0:[{d:'월',mid:'mX',off:true}]}}]){
    const h=harness({pending:true,matches:[shell('sched:mDEAD')],weeks});
    assert.equal(h.c.matchLoad().matches.length,1);assert.deepEqual(h.sets,[]);
  }
});

test('pending with an empty device document creates nothing',()=>{
  const h=harness({pending:true,matches:[]});
  assert.equal(h.c.matchLoad().matches.length,0);assert.deepEqual(h.sets,[]);
});
