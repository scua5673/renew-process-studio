import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startFixture,openApp,SIZES,SHOTS,WT,A} from '../fixtures/team-app.mjs';
const require=createRequire(import.meta.url),S=require('../../studio/scouting-store.js');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const size of Object.values(SIZES))size.engine=engine;
const main=fx.db.get(WT+'|scout_tool_v1'),seed=JSON.parse(main.v);
seed.players[2].status='rehab';seed.players[3].status='injury';seed.meta.grpLabels={'A팀':'1군','B팀':'육성반'};
for(const p of seed.players)fx.db.get(WT+'|sq:'+p.id).v=JSON.stringify(p);main.v=JSON.stringify(seed);
const scout=S.reconcile(null,{v:1,players:[{id:'cp1',name:'가상 후보 GK',posId:'pos_GK'},{id:'cp2',name:'가상 후보 CF',posId:'pos_CF'}]});
fx.db.set(WT+'|cs_scout_targets_v1',{workspace_id:WT,k:'cs_scout_targets_v1',v:JSON.stringify(scout),cupd:1000,updated_by:A});
try{
 const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,dark:engine==='webkit'});
 await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
 const f=await(await page.waitForSelector('#fBoard')).contentFrame();
 await f.waitForFunction(()=>window.PSBoardScoutImport&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner));
 await f.waitForFunction(()=>{try{PSBoardScoutImport.teamContext(window);return true;}catch(_){return false;}});
 const source=await f.evaluate(()=>[localStorage.getItem('scout_tool_v1'),localStorage.getItem('cs_scout_targets_v1')]);
 async function boardOpen(){await f.evaluate(()=>{window.__psToggleBoardSettings('open');document.getElementById('cmd-board-settings-pop').__psSelectTab('layout');});await f.locator('#loadTeamRosterBtn').click();await f.locator('#boardScoutDialog[open]').waitFor();}
 await boardOpen();assert.equal(await f.locator('.bsi-candidate').count(),18);
 await f.getByRole('combobox',{name:'조',exact:true}).selectOption('A팀');assert.equal(await f.locator('.bsi-candidate').count(),9);
 await f.getByRole('button',{name:'전체 해제',exact:true}).click();await f.getByRole('button',{name:'표시된 선수 선택',exact:true}).click();
 await f.getByRole('searchbox',{name:'선수 검색'}).fill('가상 선수 1');assert.ok(await f.locator('.bsi-candidate').count()>0);await f.getByRole('searchbox',{name:'선수 검색'}).fill('');
 await page.screenshot({path:path.join(SHOTS,'board-squad-import-'+engine+'.png')});
 const before=await f.evaluate(()=>JSON.stringify(state.players));await f.getByRole('button',{name:'9명 불러오기',exact:true}).click();await f.locator('#boardScoutDialog').waitFor({state:'detached'});
 assert.equal(await f.evaluate(()=>state.players.filter(p=>p.team==='blue'&&p.name).length),9);await f.evaluate(()=>undoLast());assert.equal(await f.evaluate(()=>JSON.stringify(state.players)),before);
 // The training editor uses exactly the same chooser and existing roster count/save path.
 await page.evaluate(()=>document.querySelector('#appSeg [data-app=design]').click());
 await f.locator('#dfNew').waitFor({state:'visible'});await f.locator('#dfNew').click();
 await f.locator('#vCreateChooser .vcc-item').filter({hasText:'훈련 설계'}).click();await f.locator('body.editing #editorModal.on').waitFor();
 const entry=await f.locator('#trainingRosterImport').evaluate(el=>[...el.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height,y:r.y};}));assert.ok(entry.every(b=>b.w>=100&&b.h>=44)&&Math.abs(entry[0].y-entry[1].y)<1,'two training import buttons fit on one row');
 await f.locator('#trainingTeamRosterBtn').click();await f.locator('#boardScoutDialog[open]').waitFor();
 await f.getByRole('button',{name:'18명 불러오기',exact:true}).click();await f.locator('#boardScoutDialog').waitFor({state:'detached'});
 assert.deepEqual(await f.evaluate(()=>[session.pGk,session.pField,session.pRehab,session.pOut]),['2','14','1','1']);
 assert.equal(await f.evaluate(()=>state.players.filter(p=>p.team==='blue'&&p.name).length),18);
 await page.screenshot({path:path.join(SHOTS,'training-roster-import-'+engine+'.png')});
 await f.locator('#trainingScoutRosterBtn').click();await f.locator('#boardScoutDialog[open]').waitFor();
 const stable=await f.evaluate(()=>JSON.stringify({players:state.players,counts:syncEpRosterUI({})}));await f.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await f.evaluate(()=>JSON.stringify({players:state.players,counts:syncEpRosterUI({})})),stable);
 await f.locator('#trainingScoutRosterBtn').click();await f.locator('#boardScoutDialog[open]').waitFor();await f.getByRole('combobox',{name:'배치할 팀',exact:true}).selectOption('red');await f.getByRole('button',{name:'2명 불러오기',exact:true}).click();await f.locator('#boardScoutDialog').waitFor({state:'detached'});
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
 await f.locator('#trainingTeamRosterBtn').click();await f.locator('#boardScoutDialog[open]').waitFor();await f.evaluate(()=>{editorReadOnly=true;});await f.locator('#boardScoutDialog').waitFor({state:'detached'});
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);console.log('board-roster-import ok',engine);
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
