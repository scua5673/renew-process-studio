import assert from 'node:assert/strict';
import {startFixture,openApp,WT,A} from '../fixtures/team-app.mjs';
/* 3.271 — 팀원이 동기화로 보낸 문서가 다른 팀원의 화면에서 실행되지 않는다(합성 팀 · 합성 계정만).
   선수 B 가 제 IDP 문서(cs_idp_v1_<B>)와 일정 문서(process_coach_v1)에 마크업 · 속성 끊기 · 처리기 끊기 값을 넣어 서버에 둔다.
   코치 A 가 팀 IDP(선수 목록 · 그 선수의 화면)와 일정(주간 · 일간 · 인쇄 문서 · 채우기 시트)을 연다:
     · 어떤 창에서도 스크립트가 돌지 않는다(top.__xss 없음 · 알림창 없음)
     · 끼어든 요소 · on* 속성이 없다
     · 보통 값(사진 data URL · «FC <서울> & '친구'» · 따옴표 든 조 이름)은 그대로 보이고 눌린다
   단위 시험은 tests/xss-synced-docs-3271.test.cjs. */
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const HIT='top.__xss=(top.__xss||0)+1';
const TAG='<img src=x class=xss-probe onerror="'+HIT+'">',ATTR='x" class="xss-probe" onerror="'+HIT+'" x="',JSQ="');"+HIT+";//",NICE="FC <서울> & '친구'";
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const seoul=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'T00:00:00Z');
const ymd=d=>d.toISOString().slice(0,10),today=ymd(seoul),dayIndex=(seoul.getUTCDay()+6)%7;
const monday=new Date(seoul);monday.setUTCDate(monday.getUTCDate()-dayIndex);

function seed(fx){
  const put=(k,v)=>fx.db.set(WT+'|'+k,{workspace_id:WT,k,v:JSON.stringify(v),cupd:2000,updated_by:B});
  /* 선수 B: 제 문서를 제 손으로 쓴다 */
  put('cs_idp_v1_'+B,{v:1,profile:{name:'가상 선수 B',photo:ATTR,video:'javascript:'+HIT,pos:'CM',school:TAG,startYear:TAG,awards:[TAG]},
    selfEval:{setId:ATTR,setSnapshot:null,levels:{fifa_pass:TAG,[ATTR]:3},strengths:TAG,improve:TAG,seasonGoal:TAG},trainings:[{id:'t1',title:TAG,days:['월','화','수','목','금','토','일'],time:TAG,items:[TAG]}],done:{},
    log:{[today]:{t:'team '+ATTR,w:TAG,rpe:TAG,body:TAG,sleepq:TAG,try:TAG,memo:TAG,next:TAG,solo:true},[ymd(monday)]:{t:'match',w:61.5,rpe:6,memo:'가상 기록'}},
    growth:{[ymd(monday)]:{h:TAG,w:TAG,at:1}},imgNotes:[],
    rtDay:{0:[{t:TAG,s:TAG}],[dayIndex]:[{t:TAG,s:TAG}]},rtAt:TAG,qgoal:{start:ymd(monday),theme:TAG,goals:[{id:ATTR,t:TAG,sc:{[ymd(monday)]:TAG}}],at:1},
    matchSelf:{[ATTR]:{good:TAG,better:TAG,tried:TAG,pos:TAG,roleAtk:TAG,roleDef:TAG,apps:TAG,score:TAG,mins:TAG,at:1}},
    vision:{text:TAG,why:TAG,behaviors:[{id:ATTR,text:TAG}],rev:TAG,at:1},focus:{wk:ymd(monday),text:TAG,from:TAG},arch:{key:ATTR},strengths:[{t:TAG,at:1}],weak:[{t:TAG,at:1}],noticeSeen:TAG});
  /* 선수 C: 보통 문서 — 사진이 그대로 보여야 한다 */
  put('cs_idp_v1_'+C,{v:1,profile:{name:'가상 선수 C',photo:PNG,video:'youtu.be/fixture',pos:'CF'},selfEval:{levels:{}},trainings:[],done:{},log:{[today]:{t:'team',w:60,rpe:5}},growth:{[ymd(monday)]:{h:170,w:60,at:1}}});
  const perms=JSON.parse(fx.db.get(WT+'|cs_perms_v1').v);perms.members[B]={role:'player',playerId:'vp01'};perms.members[C]={role:'player',playerId:'vp02'};put('cs_perms_v1',perms);
  /* 일정 문서: 오늘은 나쁜 값, 다음 날은 특수문자가 든 보통 값 */
  const row=fx.db.get(WT+'|process_coach_v1'),doc=JSON.parse(row.v),week=doc.weeks[0],bad=week[dayIndex],niceIndex=(dayIndex+1)%7,nice=week[niceIndex];
  Object.assign(bad,{rest:false,off:false,md:TAG,meeting:TAG,aims:TAG,match:{time:TAG,opp:TAG,logo:ATTR,kind:TAG,place:TAG,grp:[TAG],mid:ATTR,score:TAG},
    matchAdd:[{time:TAG,opp:TAG,kind:TAG,grp:TAG,place:TAG,mid:ATTR}],
    trainings:[{slot:'S-xss',_open:true,time:TAG,players:TAG,aims:TAG,note:TAG,place:TAG,grp:[JSQ],topics:[TAG],load:{rpe:TAG,rec:false},schoolYears:[TAG],blocks:[{phase:TAG,theme:TAG,fmt:TAG,dur:TAG,desc:TAG,exp:TAG,of:TAG,libId:ATTR}]},
      {slot:TAG,time:'09:00',players:ATTR,aims:ATTR,note:ATTR,grp:TAG,blocks:[{phase:ATTR,theme:ATTR,fmt:ATTR,dur:ATTR,desc:ATTR}]}],
    board:{sched:TAG,theme:TAG,load:TAG,meet:'',warm:'',meets:[TAG],meetsData:[{minutes:TAG}],meetSlot:[''],warms:[TAG],warmsData:[{minutes:TAG}],warmSlot:[''],trains:[TAG],trainData:[{minutes:TAG}],trainSlot:['S-xss'],trainThemes:[TAG],libs:[TAG],libData:[{minutes:TAG,name:TAG}],libSlot:['S-xss'],gmMoment:ATTR,opp:TAG,time:TAG}});
  Object.assign(nice,{rest:false,off:false,match:{time:'15:00',opp:NICE,logo:PNG},
    trainings:[{slot:'S-nice',_open:true,time:'10:30',players:18,aims:'빌드업',note:NICE,blocks:[{phase:'warm',theme:'Rondo',fmt:'4v2',dur:15,desc:NICE}]}],
    board:{sched:'경기',theme:'',opp:NICE,time:'15:00'}});
  doc.editedBy=TAG;row.v=JSON.stringify(doc);row.cupd=2000;row.updated_by=B;
  const roster=fx.db.get(WT+'|scout_tool_v1'),r=JSON.parse(roster.v);r.meta.grpBase=['A팀','B팀',"O'Neil 조"];roster.v=JSON.stringify(r);
  return {niceIndex};
}
async function probe(page,label){
  const found=[];
  for(const f of page.frames()){
    /* ① 끼어든 요소(.xss-probe · img[src=x] · javascript: 링크) ② 우리 값이 만든 속성(onerror · onmouseover · src · href)
       ③ 앱의 처리기(onclick …) 안에 우리 값이 글자로 들어간 곳은 앱 함수를 빈 함수로 바꿔 실제로 돌려 본다 — 따옴표가 끊겼으면 top.__xss 가 오른다 */
    const hits=await f.evaluate(()=>{
      const any=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>'':any,apply:()=>any,construct:()=>any});
      const box=new Proxy({},{has:()=>true,get:(t,k)=>k===Symbol.unscopables?undefined:(k==='top'?window.top:any)});
      const out=[],own=/^on(click|blur|keydown|change|input|focus|pointerdown)$/;
      for(const e of document.querySelectorAll('*')){
        let bad=e.matches('.xss-probe,img[src="x"],a[href^="javascript:" i]');
        for(const a of e.attributes){
          if(!/__xss/.test(a.value))continue;
          if(own.test(a.name)){try{new Function('box','with(box){'+a.value+'\n}').call(any,box);}catch(_){bad=true;}}
          else if(/^(on|href$|src$)/i.test(a.name))bad=true;
        }
        if(bad)out.push((e.parentElement?'<'+e.parentElement.tagName.toLowerCase()+' class="'+e.parentElement.className+'"> ':'')+e.outerHTML.slice(0,200));
      }
      return out;}).catch(()=>[]);
    for(const h of hits)found.push(f.url().replace(/^.*\/studio\//,'')+' '+h);
  }
  assert.deepEqual(found,[],label+': injected element or handler');
  assert.equal(await page.evaluate(()=>window.__xss||0),0,label+': injected script ran');
}
const fx=await startFixture(),browsers={},{niceIndex}=seed(fx);
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers});
  await page.waitForTimeout(1500);

  step('idp-today');
  await page.evaluate(()=>document.querySelector('#appSeg button[data-scope="global"][data-app="idp"]').click());
  const idp=await (await page.waitForSelector('#fIdp')).contentFrame();
  await idp.waitForFunction(keys=>keys.every(k=>!!localStorage.getItem(k)),['cs_idp_v1_'+B,'cs_idp_v1_'+C],{timeout:30000});
  await idp.waitForFunction(()=>!!document.querySelector('[data-sqd-doc]'),null,{timeout:30000});
  await page.waitForTimeout(800);await probe(page,'coach today');
  const click=async(sel,wait=500)=>{const hit=await idp.evaluate(sel=>{const b=[...document.querySelectorAll(sel)].find(b=>b.offsetParent);if(!b)return false;b.click();return true;},sel);if(hit)await page.waitForTimeout(wait);return hit;};
  await click('[data-sqw="1"]');await probe(page,'coach this week');
  await click('[data-wg-player="vp01"]');await probe(page,'weekly growth card of the hostile player');

  step('idp-squad-list');
  assert.ok(await click('.sq-scope [data-sqe-mode="story"]',900),'선수 목록');
  const seen={};
  for(const [pid,who] of [['vp01','hostile'],['vp02','normal']]){
    assert.ok(await click('[data-sqe-p="'+pid+'"]',900),'player '+pid);
    const modes=await idp.evaluate(()=>[...document.querySelectorAll('.sqe-modes [data-sqe-mode]')].map(b=>b.dataset.sqeMode));
    for(const m of modes){await click('.sqe-modes [data-sqe-mode="'+m+'"]',600);await probe(page,who+' player · '+m);
      if(m==='story')seen[who]=await idp.evaluate(()=>[...document.querySelectorAll('.sqb-ava img')].map(i=>i.getAttribute('src').slice(0,22)));}
  }
  assert.deepEqual(seen.normal,['data:image/png;base64,'],'a normal player photo is still drawn');
  assert.deepEqual(seen.hostile,[],'the hostile photo value produces no image element');

  step('idp-player-app');
  /* 그 선수의 화면을 그대로 연다 — 프로필 · 달력(일 · 주 · 월 · 년) · 차트 · 리포트가 선수 문서의 숫자 · 종류 · 주소를 그린다 */
  const layersOf={};
  for(const [uid,who] of [[B,'hostile'],[C,'normal']]){
    assert.ok(await click('.sq-scope [data-sqe-mode="today"]',900),'오늘');
    assert.ok(await click('[data-sqd-doc="cs_idp_v1_'+uid+'"]',1200),'open the '+who+' player document');
    await probe(page,who+' player app');
    const layers=layersOf[who]=await idp.evaluate(()=>[...document.querySelectorAll('#layers [data-l]')].filter(b=>b.offsetParent).map(b=>b.dataset.l));
    assert.ok(layers.includes('cal')&&layers.includes('profile'),'player app layers: '+layers);
    for(const l of layers){
      await click('#layers [data-l="'+l+'"]',600);await probe(page,who+' layer '+l);
      if(l==='cal')for(const v of ['year','month','week','day','qa']){await click('button[data-v="'+v+'"]',500);await probe(page,who+' calendar '+v);}
    }
    if(who==='normal'){
      await click('#layers [data-l="profile"]',700);
      const pf=await idp.evaluate(()=>({img:[...document.querySelectorAll('.pfs-ava img,.pf-ava img')].map(i=>i.getAttribute('src').slice(0,22)),link:[...document.querySelectorAll('a[href*="youtu.be"]')].map(a=>a.getAttribute('href'))}));
      assert.ok(pf.img.includes('data:image/png;base64,'),'profile photo: '+JSON.stringify(pf));
      assert.ok(pf.link.includes('https://youtu.be/fixture'),'a video address typed without https still opens: '+JSON.stringify(pf));
    }
    await idp.evaluate(()=>{const b=document.querySelector('[data-sq-back],#sqBack,.sq-back');if(b)b.click();});
    await page.evaluate(()=>document.querySelector('#fIdp').contentWindow.postMessage({type:'openSquad'},location.origin));await page.waitForTimeout(900);
  }
  assert.equal(await idp.evaluate(k=>JSON.parse(localStorage.getItem(k)).profile.video,'cs_idp_v1_'+B),'javascript:'+HIT,'the cached document is not rewritten — only what is drawn changes');

  step('schedule');
  const training='#teamNav [data-team-key="training"]:visible';
  if(!await page.locator(training).first().isVisible())await page.locator('#appSeg [data-team-hub]:visible').first().click();
  await page.locator(training).first().click();
  const sch=await (await page.waitForSelector('#fProcess')).contentFrame();
  await sch.waitForFunction(()=>typeof weeksMap==='object'&&PSSchedule.raw()!=null&&/xss-probe/.test(PSSchedule.raw()),null,{timeout:30000});
  if(!await sch.locator('#weekView').isVisible())await sch.locator('#vtoggle [data-v="week"]:visible').first().click();
  await sch.locator('#weekView').waitFor({state:'visible'});
  await page.waitForTimeout(800);await probe(page,'weekly schedule');
  const weekText=await sch.locator('#weekView').innerText();
  assert.ok(weekText.includes(NICE),'an opponent with special characters reads as typed in the week: '+weekText.slice(0,400));
  assert.ok(weekText.includes('<img src=x'),'the hostile value is shown as text, not dropped');

  step('schedule-renders');
  /* 같은 문서를 그리는 다른 그림들 — 줄 보기 · 일간 · 인쇄 문서 */
  const renders=await sch.evaluate(({bad,nice})=>{const out={};
    try{renderWeek();out.rows=document.getElementById('rows')?document.getElementById('rows').innerText:'';}catch(e){out.rowsErr=String(e);}
    try{dayIdx=bad;renderDay();out.day=document.getElementById('dayView').innerText;dayIdx=nice;renderDay();out.dayNice=document.getElementById('dayView').innerText;}catch(e){out.dayErr=String(e);}
    try{const host=document.createElement('div');host.id='xssPrint';host.innerHTML=week.map(d=>pDayBody(d,false)).join('');document.body.appendChild(host);out.print=host.innerText;}catch(e){out.printErr=String(e);}
    return out;},{bad:dayIndex,nice:niceIndex});
  await page.waitForTimeout(600);await probe(page,'rows · day · print');
  assert.equal(renders.rowsErr||renders.dayErr||renders.printErr||'','','each schedule drawing still works: '+JSON.stringify(renders).slice(0,300));
  assert.ok(renders.dayNice.includes(NICE),'day view shows the name as typed: '+renders.dayNice.slice(0,200));
  assert.ok(renders.print.includes(NICE)&&renders.print.includes('15:00'),'print body shows the name and time as typed');
  assert.ok(renders.day.includes('<img src=x'),'day view shows the hostile value as text');

  step('schedule-views-and-sheets');
  /* 일정의 다른 보기와, 그 날의 값을 다시 그리는 시트들을 차례로 연다(값은 고치지 않는다) */
  for(const v of ['year','month','day','week']){
    await sch.evaluate(v=>{const b=document.querySelector('#vtoggle [data-v="'+v+'"]');if(b)b.click();},v);
    await page.waitForTimeout(700);await probe(page,'schedule view '+v);
  }
  const opened=[];
  for(const call of ['openDayHub(wk,DI)','openMatch(DI)','openSession(DI,0)','openSession(DI,1)',"wksFill(DI,'S-xss')","wksPickSes(DI,'S-xss','topic')","wksTopicSheet(DI,'S-xss')","wkbdPick(DI,'sched')","wkbdPick(DI,'theme')","wkbdPick(DI,'train',0)","sesGrp(DI,'S-xss')",'boardTeamSetup()','openMonthPop(wk,DI,document.body)',"__buildPrintDoc('week')","__buildPrintDoc('day')","__buildPrintDoc('month')"]){
    const r=await sch.evaluate(({call,di})=>{try{const out=(0,eval)(call.replace(/DI/g,String(di)));
      if(typeof out==='string'&&/^__buildPrintDoc/.test(call)){const fr=document.createElement('iframe');fr.className='xss-print-frame';fr.srcdoc=out;document.body.appendChild(fr);}
      return 'ok';}catch(e){return String(e&&e.message||e).slice(0,80);}},{call,di:dayIndex});
    opened.push(call+' → '+r);
    await page.waitForTimeout(450);await probe(page,'schedule '+call);
    await sch.evaluate(()=>{try{closeSheet();}catch(_){}try{document.querySelectorAll('.xss-print-frame').forEach(f=>f.remove());}catch(_){}});
  }
  assert.ok(opened.filter(x=>/ → ok$/.test(x)).length>=10,'most sheets opened: '+opened.join(' | '));

  step('fill-sheet-handlers');
  /* 채우기 시트의 조 단추: 이름이 onclick="wksFillGrp('…')" 따옴표 안에 들어간다 — 따옴표 든 이름도 그대로 넘어가야 한다 */
  const fill=await sch.evaluate(({bad,JSQ})=>{const got=[],orig=window.wksFillGrp;window.wksFillGrp=g=>{got.push(g);};
    const host=document.createElement('div');host.innerHTML=["O'Neil 조",JSQ,'A팀'].map(g=>'<button class="xss-fill" onclick="wksFillGrp(\''+_fillEsc(g)+'\')">'+wkbdEsc(g)+'</button>').join('')
      +(typeof schedLegacyTeamButtons==='function'?'':'');
    document.body.appendChild(host);[...host.querySelectorAll('button')].forEach(b=>b.click());window.wksFillGrp=orig;host.remove();return got;},{bad:dayIndex,JSQ});
  assert.deepEqual(fill,["O'Neil 조",JSQ,'A팀'],'a quoted name reaches the handler as the same text');
  await probe(page,'fill sheet');

  const dialogs=logs.filter(l=>l.type==='dialog');assert.deepEqual(dialogs,[],'no dialog');
  const pe=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(pe,[],JSON.stringify(pe.slice(0,3)));
  console.log(JSON.stringify({engine,test:'xss-synced-docs',ok:true,idpLayers:layersOf,sheets:opened}));
}catch(e){console.error('[xss-synced-docs] step='+cur);throw e;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
