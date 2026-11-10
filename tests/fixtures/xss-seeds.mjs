/* 3.272 — 동기화 문서 XSS 탐침의 씨앗(합성 값만). 문서마다 화면이 읽는 글 칸을 모두 POLY 로 채운다.
   연결에 쓰는 id · 날짜는 대부분 그대로 두고(그래야 화면이 그 칸까지 그린다), 따로 «id 까지 나쁜» 항목을 하나씩 더한다. */
import {POLY as T,JSURL as U,NICE,PNG,poison} from './xss-probe.mjs';
import {seoulWeek} from './seoul-week.mjs';

export const B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const KEEP=/^(?:id|pid|uid|posId|playerId|date|at|ts|start|wk|d|n|type|kind|fmt|scoutSt|status|homeAway|fifaMode|v|version|cat|key|evalMode|sourceId|captainId|dbId|createdAt|updatedAt|editedAt|pin|open|h|c|rest|off|slot)$/;
const ymd=d=>d.toISOString().slice(0,10);
export function dates(){
  const seoul=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'T00:00:00Z');
  const dayIndex=(seoul.getUTCDay()+6)%7,monday=new Date(seoul);monday.setUTCDate(monday.getUTCDate()-dayIndex);
  const next=new Date(monday);next.setUTCDate(next.getUTCDate()+7);const prev=new Date(monday);prev.setUTCDate(prev.getUTCDate()-7);
  return {today:ymd(seoul),monday:ymd(monday),nextMonday:ymd(next),prevMonday:ymd(prev),dayIndex};
}

/* 선수 한 명의 글 칸 전부 */
export function playerText(p,extra={}){
  return {...p,name:T,num:T,nameKr:T,nameEn:T,club:T,formerClub:T,grade:T,foot:T,style:T,label:T,memo:T,role:T,detail:T,objective:T,schoolYear:T,statusUntil:T,pos:T,
    memos:[{id:'m1',t:T,text:T,by:T,at:1,date:T,cat:T}],meetings:[{id:'mt1',date:T,t:T,text:T,note:T,by:T,goals:[T],next:T}],
    profile:{photo:T,video:U,video2:U,subs:[T],sub:T,team:T,dob:T,weight:T,height:T,strengths:T,develop:T,awards:[T],univ:T,startYear:T,phone:T,mid:T,high:T,elem:T,email:T,clubs:[T],career:[{y:T,t:T,team:T}],blood:T,agent:T,nat:T,mbti:T,value:T,nameEn:T},
    injury:{part:T,note:T,until:T,since:T},statusNote:T,...extra};
}

export function roster(base){
  const r=JSON.parse(JSON.stringify(base));
  r.attrs=[{id:'fifa_pass',cat:'tech',name:T,q:T,w:T,source:T},{id:T,cat:T,name:T,q:T,w:T}];
  r.positions.forEach((p,i)=>{if(i%3===0)Object.assign(p,{name:T,wantArch:T,role:T,desc:T,req:{fifa_pass:T},ideal:{fifa_pass:T,note:T},targets:{fifa_pass:T}});});
  r.positions.push({id:T,name:T,targets:{},req:{}});
  r.players=r.players.map((p,i)=>{
    if(i===0)return playerText(p);                                   /* vp01 — 글 칸 전부 */
    if(i===1)return {...playerText(p),name:NICE,num:'7',levels:{fifa_pass:T,[T]:T},status:T,grp:T,posId:p.posId};   /* vp02 — 숫자 · 종류 칸 */
    if(i===2)return {...p,name:'가상 선수 3',posId:T,grp:T,type:'ours',status:'injured',statusUntil:T,profile:{photo:PNG}};
    return p;
  });
  r.players.push(playerText({id:T,type:'ours',posId:'pos_CM',grp:'A팀',levels:{},manual:true}));   /* id 까지 나쁜 선수 */
  r.meta=Object.assign(r.meta||{},{grpBase:['A팀','B팀',T],grpLabels:{'A팀':T,[T]:T},teamName:T,form:T,cats:[{id:'tech',name:T},{id:T,name:T}],posAbbr:{pos_GK:T},
    prompts:[{id:'q1',q:T,by:T,at:1,open:1},{id:T,q:T,by:T,at:2,open:1}],customForms:[{id:'cf1',name:T,slots:[]},{id:T,name:T,slots:[]}]});
  r.exLinks={fifa_pass:U,[T]:U};
  return r;
}

/* 코치가 선수에게 보내는 공개 문서(cs_idp_pub_v1_<uid>) — 선수 화면이 그린다 */
export function idpPub(D){
  const react={h:1,t:T,by:T,at:1,hBy:T,hAt:1,tBy:T,tAt:1,c:T,k:T,gap:T,nextAt:T};
  return {v:1,on:true,praise:T,focus:T,nextAction:T,question:T,reviewDate:T,updatedBy:T,updatedAt:1,text:T,arch:T,
    reviews:[{id:'r1',at:D.today,by:T,weeks:T,prevProgress:{0:T},strengths:[T],develop:[T],goals:[{t:T,owner:T,due:T}],nextAt:T,note:T},{id:T,at:T,by:T,strengths:[T],develop:[T],goals:[{t:T,owner:T,due:T}],nextAt:T,note:T}],
    goals:[{id:'g1',t:T,due:T,by:T,at:1},{id:T,t:T,due:T,by:T,at:T}],
    talk:[{id:'t1',t:T,by:T,at:Date.now()-1000,src:T,day:D.today},{id:T,t:T,by:T,at:T}],
    reacts:{['day:'+D.today]:react,['day:'+D.monday]:react,['wk:'+D.monday]:react,['wk:'+D.prevMonday]:react,[T]:react},
    props:{[D.nextMonday]:{a:T,ra:T,b:T,rb:T,by:T,at:1},[D.monday]:{a:T,ra:T,b:T,rb:T,by:T,at:1}},
    mid:{[D.monday]:{c:T,t:T,by:T,at:1},[T]:{c:'keep',t:T,by:T,at:1}},
    qmeet:[{id:'q1',ts:1,at:D.today,by:T,q:T,start:D.monday,focuses:[T],hearts:[T],gaps:[{name:T,s:T,c:T}],mid:T,outside:T,strengths:T,nextArea:T,promise:T,firstFocus:T}],
    learnTasks:[{id:'lt1',kind:'book',ref:T,t:T,title:T,by:T,at:1,due:T,note:T},{id:T,kind:T,ref:T,t:T,by:T,at:T}],
    seen:{[D.today]:T,[T]:T},levels:{fifa_pass:T,[T]:T},coachEval:{levels:{fifa_pass:T},note:T,by:T,at:1}};
}

export function notice(){return {items:[{id:'n1',text:T,by:T,at:Date.now()-1000,pin:1,title:T},{id:T,text:T,by:T,at:T,pin:T}]};}

export function teamAttrs(roster){
  return {attrs:[{id:'fifa_pass',cat:'tech',name:T,q:T,w:T,source:T},{id:T,cat:T,name:T,q:T,w:T,source:T}],
    prompts:[{id:'q1',q:T,at:1,by:T,open:1},{id:T,q:T,at:T,by:T,open:1}],ex:{fifa_pass:U,[T]:U},
    positions:roster.positions.map(p=>({id:p.id,name:T,req:{fifa_pass:T,[T]:T},wantArch:T,ideal:{fifa_pass:T,note:T}})),
    cats:[{id:'tech',name:T},{id:T,name:T}],grpBy:{vp01:T,[T]:T},grpBase:['A팀',T],grpLabels:{'A팀':T,[T]:T},
    roster:[{id:'vp01',num:T,name:T,pos:T,grp:T,posId:T},{id:T,num:T,name:T,pos:T,grp:T}],evalMode:T,setId:T,removedStd:[T]};
}

/* 경기 문서(cs_team_matches_v1) */
export function matches(D,ids){
  const phase={us:[{id:ids[0],x:T,y:T,label:T,num:T}],opp:[{id:'o1',x:1,y:1,label:T,num:T,name:T}],note:T,memo:T};
  const base={competition:T,opponent:T,time:T,venue:T,homeAway:T,formation:T,captainId:ids[0],squadIds:ids.slice(0,14),startingIds:ids.slice(0,11),
    attack:T,defense:T,attackTransition:T,defenseTransition:T,setPlay:T,briefing:T,prepPublished:true,fifaMode:'simple',
    fifaPlans:[{id:'fp1',group:T,phase:T,label:T,objective:T,detail:T,principles:[T],review:T,reviewStatus:T,note:T},{id:T,group:T,phase:T,objective:T,detail:T}],
    kind:'official',scoreUs:T,scoreThem:T,pkUs:T,pkThem:T,resultSummary:T,execution:T,reviewGood:T,reviewImprove:T,trainingAction:T,idpAction:T,reviewPublished:true,
    boardLinks:[{id:'bl1',libId:T,name:T,title:T,thumb:T,kind:T,part:T},{id:T,libId:T,name:T}],emblem:T,color:T,name:T,title:T,headline:T,grp:[T],fmt:'11',
    oppStrengths:T,oppWeaknesses:T,oppConclusion:T,oppAttack:T,oppDefense:T,oppAttackTransition:T,oppDefenseTransition:T,oppSetPlay:T,oppKeyPlayers:[{num:T,name:T,pos:T,note:T}],
    oppPB:{form:T,list:[['atk',T]],cur:'atk',boards:{atk:phase},notes:{atk:T}},phaseBoards:{list:[['atk',T],[T,T]],cur:'atk',boards:{atk:phase}},
    phaseReview:{atk:{score:T,note:T,good:T,improve:T},[T]:{score:T,note:T}},planReview:{fp1:{status:T,note:T}},
    goals:[{id:'g1',side:'us',t:T,min:T,scorer:ids[0],assist:ids[1],half:T,how:T,note:T,phase:T,type:T},{id:T,side:T,t:T,min:T,scorer:T,assist:T,half:T,how:T,note:T}],
    periods:[{id:'p1',label:T,min:T,lineup:{},note:T}],periodPreset:T,lineup:{[ids[0]]:{pos:T,min:T,role:T,in:T,out:T}},roster:[{id:ids[0],num:T,name:T,pos:T}],
    boardPlayerRolesV1:{[ids[0]]:{atk:T,def:T}},boardKitsV1:{us:{c:T,pat:T},opp:{c:T}},squad:[{id:ids[0],name:T,num:T,pos:T}],principles:[T],items:[T],today:T,
    createdAt:1,updatedAt:1};
  return {version:1,matches:[
    {...base,id:'xm1',date:D.today,opponent:T},
    {...base,id:'xm2',date:D.monday,opponent:NICE,scoreUs:'2',scoreThem:'1',execution:7,time:'15:00'},
    {...base,id:T,date:T,sourceId:T,captainId:T,squadIds:[T],startingIds:[T],kind:T,fmt:T,fifaMode:T,execution:{x:T}}]};
}

export function gamemodel(){
  const phase={id:'ph1',name:T,principles:[T,{t:T,text:T,sub:[T],trig:T}],triggers:[T],note:T,keys:[T],roles:{CM:T,[T]:T},drills:[{id:'d1',libId:T,name:T,title:T,thumb:T}]};
  return {identity:T,style:T,idOpen:true,open:{ao:1},coach:T,team:T,season:T,vision:T,slogan:T,
    moments:[{key:'ao',name:T,tag:T,main:T,sub:T,phases:[phase,{...phase,id:T}]},{key:'do',name:T,tag:T,main:T,phases:[{...phase,id:'ph2'}]},{key:T,name:T,tag:T,main:T,phases:[{...phase,id:'ph3'}]}],
    cards:[{id:'c1',t:T,title:T,text:T,cat:T}],learn:{[T]:T},evals:{[T]:{s:T,n:T}},review:{note:T,at:T},ctx:{age:T,level:T,fmt:T},_at:1};
}
export function terms(){return {v:1,terms:[{id:'tm1',ko:T,en:T,def:T,cat:T,ex:T,note:T},{id:T,ko:T,en:T,def:T,cat:T}],cats:[{id:'c1',ko:T,name:T},{id:T,ko:T,name:T}],custom:{[T]:{ko:T,en:T,def:T}},items:[{id:'i1',term:T,name:T,desc:T,cat:T}]};}

/* 팀이 고쳐 쓰는 일정 재료(조 · 테마 · 틀) */
export function teamBits(){
  return {
    cs_team_v1:{name:T,logo:T,teams:[T,'A팀'],grps:[T],coach:T,season:T,age:T,labels:{[T]:T}},
    /* 일정 사전(주제 · 일정 · 훈련 · 웜업 · 미팅 고르개) — [이름, 색, 표식] 배열 */
    cs_themes_v1:[[T,T],['가상 주제',T],['전술','#2E7D63']],
    cs_psched_v1:[[T,T,T],['가상 일정',T,1]],cs_ptrain_v1:[[T,T,T],['가상 훈련',T,1]],cs_pwarm_v1:[[T,T,T],['가상 웜업',T]],cs_pmeet_v1:[[T,T,T],['가상 미팅',T]],
    cs_assign_v1:{items:[{id:'a1',t:T,text:T,who:T,pid:'vp01',due:T,by:T,done:false},{id:T,t:T,pid:T}],[T]:T},
    cs_idp_daily_v1:{days:{},att:{},note:T,[T]:{[T]:T}},
    cs_squad_v1:{name:T,form:T,slots:[{id:'s1',pid:'vp01',label:T,pos:T}],groups:[{id:'g1',name:T,ids:['vp01',T]}],[T]:T}
  };
}

/* 팀원 목록(ps_members_of_v2) — 이름 · 이메일은 저마다 제 것을 적는다 */
export function members(A){
  return [{user_id:A,name:'가상 코치',email:'a@example.invalid',role:'owner'},{user_id:B,name:T,email:T,role:'member'},{user_id:C,name:NICE,email:'c@example.invalid',role:'member'},{user_id:T,name:T,email:T,role:T}];
}

/* 일정 문서의 오늘 하루를 나쁜 값으로(3.271 탐침과 같은 칸 + 선수 화면이 읽는 칸) */
export function scheduleDay(doc,di){
  const week=doc.weeks[0],day=week[di];
  Object.assign(day,{rest:false,off:false,md:T,meeting:T,aims:T,match:{time:T,opp:T,logo:T,kind:T,place:T,grp:[T],mid:T,score:T},
    trainings:[{slot:'S-xss',_open:true,time:T,players:T,aims:T,note:T,place:T,grp:['A팀',T],topics:[T],load:{rpe:T,rec:false},schoolYears:[T],blocks:[{phase:T,theme:T,fmt:T,dur:T,desc:T,exp:T,of:T,libId:T}]}],
    board:{sched:T,theme:T,load:T,meets:[T],meetsData:[{minutes:T}],meetSlot:[''],warms:[T],warmsData:[{minutes:T}],warmSlot:[''],trains:[T],trainData:[{minutes:T}],trainSlot:['S-xss'],trainThemes:[T],libs:[T],libData:[{minutes:T,name:T}],libSlot:['S-xss'],gmMoment:T,opp:T,time:T}});
  doc.editedBy=T;doc.grpWeeks={'A팀':{0:JSON.parse(JSON.stringify(week))},[T]:{0:JSON.parse(JSON.stringify(week))}};
  doc.templates=[{id:'tp1',name:T,n:T,week:JSON.parse(JSON.stringify(week))},{id:T,name:T}];
  return doc;
}
export {poison,KEEP,seoulWeek};
