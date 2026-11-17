import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startFixture,openApp,SIZES,SHOTS,WT,A} from '../fixtures/team-app.mjs';
const require=createRequire(import.meta.url),S=require('../../studio/scouting-store.js');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const size of Object.values(SIZES))size.engine=engine;
// The browser context runs in Asia/Seoul (fixture) — build the day strings in that zone, not the runner's.
const seoul=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const today=seoul(Date.now()),tomorrow=seoul(Date.now()+864e5),later=seoul(Date.now()+5*864e5);
const main=fx.db.get(WT+'|scout_tool_v1'),seed=JSON.parse(main.v);
seed.players[2].status='rehab';seed.players[3].status='injury';seed.meta.grpLabels={'A팀':'1군','B팀':'육성반'};
seed.players.forEach((p,i)=>{p.schoolYear=i<6?1:i<12?2:3;});
// Tomorrow: 가상 선수 5 is marked absent with a note, 가상 선수 6 has an injury run covering tomorrow (available today).
seed.meta.participationDays={[tomorrow]:{vp05:{s:'out',kind:'train',at:1700000000000,n:'개인 사정'}}};
seed.meta.statusRuns={vp06:[{s:'injury',from:today,to:later}]};
for(const p of seed.players)fx.db.get(WT+'|sq:'+p.id).v=JSON.stringify(p);main.v=JSON.stringify(seed);
const scout=S.reconcile(null,{v:1,players:[{id:'cp1',name:'가상 후보 GK',posId:'pos_GK'},{id:'cp2',name:'가상 후보 CF',posId:'pos_CF'}]});
fx.db.set(WT+'|cs_scout_targets_v1',{workspace_id:WT,k:'cs_scout_targets_v1',v:JSON.stringify(scout),cupd:1000,updated_by:A});
try{
 const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,dark:engine==='webkit'});
 await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
 const f=await(await page.waitForSelector('#fBoard')).contentFrame();
 await f.waitForFunction(()=>window.PSBoardScoutImport&&window.PSParticipation&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner));
 await f.waitForFunction(()=>{try{PSBoardScoutImport.teamContext(window);return true;}catch(_){return false;}});
 const source=await f.evaluate(()=>[localStorage.getItem('scout_tool_v1'),localStorage.getItem('cs_scout_targets_v1')]);
 const dlg=()=>f.locator('#boardScoutDialog');
 const chip=(group,name)=>f.locator('#boardScoutDialog [aria-label="'+group+'"]').getByRole('button',{name,exact:true});
 const pressed=group=>f.locator('#boardScoutDialog [aria-label="'+group+'"] [aria-pressed="true"]').allTextContents();
 const countText=()=>f.locator('#boardScoutDialog [data-count]').textContent();
 const names=()=>f.locator('.bsi-candidate').count();
 async function boardOpen(){await f.evaluate(()=>{window.__psToggleBoardSettings('open');document.getElementById('cmd-board-settings-pop').__psSelectTab('layout');});await f.locator('#loadTeamRosterBtn').click();await f.locator('#boardScoutDialog[open]').waitFor();}
 // ① Board settings › 명단 불러오기 › 선수단: one window, conditions as chips; the availability rule unchecks injured and rehab players.
 await boardOpen();assert.equal(await names(),18);
 assert.match(await countText(),/^16명 선택 \/ 전체 18명 · 조건 밖 2명은 체크 해제됨$/);
 assert.deepEqual(await f.locator('#boardScoutDialog [aria-label="출처"] button').allTextContents(),['선수단','스카우팅','둘 다']);
 assert.deepEqual(await f.locator('#boardScoutDialog [aria-label="조"] button').allTextContents(),['전체','1군','육성반']);
 assert.deepEqual(await f.locator('#boardScoutDialog [aria-label="포지션 · 학년"] button').allTextContents(),['모든 포지션','GK','필드','1학년','2학년','3학년']);
 assert.equal(await f.locator('#boardScoutDialog .bsi-candidate.off').count(),2);
 assert.match(await f.locator('#boardScoutDialog .bsi-candidate',{hasText:'가상 선수 3'}).first().locator('.bsi-st').textContent(),/재활/);
 assert.ok(await f.evaluate(()=>Array.from(document.querySelectorAll('#boardScoutDialog .bsi-cond:not([hidden]) .bsi-chip')).every(b=>b.getBoundingClientRect().height>=40)),'chips keep tablet touch targets');
 await chip('출처','둘 다').click();assert.equal(await names(),20);assert.equal(await f.locator('#boardScoutDialog [data-cond="stage"]').isVisible(),true);
 await chip('출처','선수단').click();assert.equal(await f.locator('#boardScoutDialog [data-cond="stage"]').isVisible(),false);
 await chip('조','1군').click();assert.equal(await names(),9);assert.match(await countText(),/^8명 선택 \/ 전체 9명 · 조건 밖 1명은 체크 해제됨$/);
 await chip('포지션 · 학년','1학년').click();assert.equal(await names(),3);await chip('포지션 · 학년','1학년').click();assert.equal(await names(),9);
 await chip('포지션 · 학년','GK').click();assert.equal(await names(),1);await chip('포지션 · 학년','모든 포지션').click();assert.equal(await names(),9);
 await chip('상태','전부').click();assert.match(await countText(),/^9명 선택 \/ 전체 9명$/);assert.equal(await f.locator('#boardScoutDialog .bsi-candidate.off').count(),0);
 // A single check is an exception to the rule and survives searching; Enter in the search never imports.
 await f.locator('#boardScoutDialog .bsi-candidate',{hasText:'가상 선수 1'}).first().locator('input').uncheck();assert.match(await countText(),/^8명 선택/);
 await f.getByRole('searchbox',{name:'명단 검색'}).fill('가상 선수 1');assert.ok(await names()>0);await f.getByRole('searchbox',{name:'명단 검색'}).press('Enter');assert.equal(await f.locator('#boardScoutDialog[open]').count(),1,'search Enter never imports the selection');
 await f.getByRole('searchbox',{name:'명단 검색'}).fill('');assert.match(await countText(),/^8명 선택/);
 await f.getByRole('button',{name:'모두',exact:true}).click();assert.match(await countText(),/^9명 선택/);
 await page.screenshot({path:path.join(SHOTS,'board-squad-import-'+engine+'.png')});
 const before=await f.evaluate(()=>JSON.stringify(state.players));await f.getByRole('button',{name:'9명 불러오기',exact:true}).click();await dlg().waitFor({state:'detached'});
 assert.equal(await f.evaluate(()=>state.players.filter(p=>p.team==='blue'&&p.name).length),9);await f.evaluate(()=>undoLast());assert.equal(await f.evaluate(()=>JSON.stringify(state.players)),before);
 assert.deepEqual(await f.evaluate(()=>JSON.parse(localStorage.getItem('ps_roster_pick_v1'))),{src:'team',grp:'A팀',avail:'all',pos:'',years:[]},'the chosen conditions are remembered on the device');
 await boardOpen();assert.deepEqual([await pressed('조'),await pressed('상태')],[['1군'],['전부']],'the window reopens with the remembered conditions');
 await f.getByRole('button',{name:'취소',exact:true}).click();await dlg().waitFor({state:'detached'});
 // ② Training editor: the roster card has one «불러오기» row — quick chips put the group on Team 1 with the remembered status rule, «고르기…» opens the same window.
 await page.evaluate(()=>document.querySelector('#appSeg [data-app=design]').click());
 await f.locator('#dfNew').waitFor({state:'visible'});await f.locator('#dfNew').click();
 await f.locator('#vCreateChooser .vcc-item').filter({hasText:'훈련 설계'}).click();await f.locator('body.editing #editorModal.on').waitFor();
 await f.evaluate(()=>{localStorage.setItem('ps_roster_pick_v1','{"avail":"ok"}');});
 await f.waitForFunction(()=>document.querySelector('#epSquadRow .ep-sq-pick'));
 assert.deepEqual(await f.locator('#epSquadRow .ep-sq-btn').allTextContents(),['전체','1군','육성반','C팀','스카우팅','고르기…']);
 assert.equal(await f.locator('#epSquadRow .ep-sq-lb').textContent(),'불러오기');assert.equal(await f.locator('#trainingRosterImport').count(),0,'the second row is gone');
 assert.equal(await f.locator('#epSquadRow .ep-sq-btn',{hasText:'C팀'}).isDisabled(),true);
 assert.ok(await f.evaluate(()=>{const b=document.getElementById('epSquadRow');return b.scrollWidth<=b.clientWidth+1&&[...b.querySelectorAll('.ep-sq-btn')].every(x=>x.getBoundingClientRect().height>=26);}),'chips fit the card');
 await f.locator('#epSquadRow .ep-sq-btn',{hasText:'전체'}).click();
 await f.waitForFunction(()=>state.players.filter(p=>p.team==='blue'&&p.name).length===16);
 assert.deepEqual(await f.evaluate(()=>[session.pGk,session.pField,session.pRehab,session.pOut]),['2','14','1','1'],'quick chip: available players on the board, rehab/injured counted as excluded');
 await page.screenshot({path:path.join(SHOTS,'training-roster-import-'+engine+'.png')});
 // The status follows the training day: tomorrow 가상 선수 5 is absent (record) and 가상 선수 6 injured (run) — both unchecked, with their words.
 await f.evaluate(d=>{session.date=d;},tomorrow);
 await f.locator('#epSquadRow .ep-sq-pick').click();await f.locator('#boardScoutDialog[open]').waitFor();
 assert.match(await f.locator('#boardScoutDialog .bsi-sub').textContent(),/월 \d+일 훈련 · 상태는 그날 가용인원 기준$/);
 assert.match(await countText(),/^14명 선택 \/ 전체 18명 · 조건 밖 4명은 체크 해제됨$/);
 const five=f.locator('#boardScoutDialog .bsi-candidate',{hasText:'가상 선수 5'}).first();assert.match(await five.locator('.bsi-stage').textContent(),/불참.*개인 사정/);assert.equal(await five.locator('input').isChecked(),false);
 assert.match(await f.locator('#boardScoutDialog .bsi-candidate',{hasText:'가상 선수 6'}).first().locator('.bsi-st').textContent(),/부상/);
 await chip('상태','전부').click();assert.match(await countText(),/^18명 선택 \/ 전체 18명$/);
 await f.getByRole('button',{name:'18명 불러오기',exact:true}).click();await dlg().waitFor({state:'detached'});
 assert.deepEqual(await f.evaluate(()=>[session.pGk,session.pField,session.pRehab,session.pOut]),['2','12','1','3'],"the day's states count: rehab 1 · injured/absent 3");
 assert.equal(await f.evaluate(()=>state.players.filter(p=>p.team==='blue'&&p.name).length),18);
 await f.evaluate(d=>{session.date=d;},today);
 // Cancel changes nothing; scouting candidates go to Team 2 through the same window.
 await f.locator('#epSquadRow .ep-sq-pick').click();await f.locator('#boardScoutDialog[open]').waitFor();
 const stable=await f.evaluate(()=>JSON.stringify({players:state.players,counts:syncEpRosterUI({})}));await f.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await f.evaluate(()=>JSON.stringify({players:state.players,counts:syncEpRosterUI({})})),stable);
 await f.locator('#epSquadRow .ep-sq-pick').click();await f.locator('#boardScoutDialog[open]').waitFor();await chip('출처','스카우팅').click();assert.equal(await names(),2);
 assert.equal(await f.locator('#boardScoutDialog [data-cond="avail"]').isVisible(),false);assert.equal(await f.locator('#boardScoutDialog [data-cond="grp"]').isVisible(),false);
 await f.getByRole('combobox',{name:'배치할 팀',exact:true}).selectOption('red');await f.getByRole('button',{name:'2명 불러오기',exact:true}).click();await dlg().waitFor({state:'detached'});
 assert.deepEqual(await f.evaluate(()=>[session.pGk,session.pField,session.pRehab,session.pOut]),['1','1','0','0']);
 assert.equal(await f.evaluate(()=>state.players.filter(p=>p.team==='red'&&p.name?.startsWith('가상 후보')).length),2);
 assert.equal(await f.evaluate(()=>state.players.filter(p=>p.team==='blue'&&p.name).length),18);
 // Save the training through its normal editor save, then reopen the stored card.
 await f.locator('#epNameTop').fill('명단 불러오기 검증');
 await f.locator('#editorDone').click();await f.waitForFunction(()=>!document.body.classList.contains('editing'));
 await f.waitForFunction(async()=>{const l=await libGet();return l.some(d=>d.name==='명단 불러오기 검증');});
 const saved=await f.evaluate(async()=>{const d=(await libGet()).find(d=>d.name==='명단 불러오기 검증');return {id:d.libId,roster:d.roster};});
 assert.deepEqual(saved.roster,{gk:1,field:1,rehab:0,out:0});
 await f.evaluate(id=>openLibDrawEditor(id,false),saved.id);await f.locator('body.editing #editorModal.on').waitFor();
 assert.equal(await f.evaluate(()=>state.players.filter(p=>p.name?.startsWith('가상 후보')).length),2,'imported candidates survive training save/reopen');
 assert.deepEqual(await f.evaluate(()=>[localStorage.getItem('scout_tool_v1'),localStorage.getItem('cs_scout_targets_v1')]),source,'both source rosters stay unchanged');
 // Read-only closes the window and disables the quick chips.
 await f.waitForFunction(()=>document.querySelector('#epSquadRow .ep-sq-pick'));
 await f.locator('#epSquadRow .ep-sq-pick').click();await f.locator('#boardScoutDialog[open]').waitFor();await f.evaluate(()=>{editorReadOnly=true;});await dlg().waitFor({state:'detached'});
 await f.waitForFunction(()=>[...document.querySelectorAll('#epSquadRow .ep-sq-btn')].every(b=>b.disabled));
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);console.log('board-roster-import ok',engine);
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
