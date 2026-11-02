import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startFixture,openApp,SHOTS,WT,A} from '../fixtures/team-app.mjs';
const require=createRequire(import.meta.url),S=require('../../studio/scouting-store.js');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
const names=['김민준','이도윤','박서준','최지호','정하준','강유찬','조시우','윤서진','장도현','임지훈','한준우','오승현','서태윤'];
const POS=['GK','CB','CB','LB','RB','DM','CM','AM','LW','RW','CF','CF','CM'];
const candidates=names.map((name,i)=>({id:'candidate-'+i,dbId:'registry-'+i,name,num:String(i+1),club:'프로세스FC',posId:'pos_'+POS[i],scoutSt:i%3===0?'go':i%3===1?'done':'rep',memo:'후보 개인 메모'}));
candidates.push({...candidates[0],id:'duplicate',posId:'pos_CM'});
candidates.push({id:'hidden',name:'숨긴 후보',_scoutHidden:true},{id:'deleted',name:'삭제 후보'});
const scout=S.reconcile(null,{v:1,players:candidates});
scout.scoutRegistry.candidates['db:loose']={id:'db:loose',info:{name:'미배치 후보',num:'99',club:'프로세스FC'},source:{pos:[]}};
const put=(k,v)=>fx.db.set(WT+'|'+k,{workspace_id:WT,k,v:JSON.stringify(v),cupd:1000,updated_by:A});
put('cs_scout_targets_v1',scout);put('cs_player_del_v1',{deleted:100});
try{
 const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,dark:engine==='webkit'});
 await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
 const f=await (await page.waitForSelector('#fBoard')).contentFrame();
 await f.waitForFunction(()=>window.PSBoardScoutImport&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner));
 await f.waitForFunction(()=>{try{PSScoutStore.context(window);return true;}catch(_){return false;}});
 const source=await f.evaluate(()=>[localStorage.getItem('cs_scout_targets_v1'),localStorage.getItem('scout_tool_v1'),localStorage.getItem('cs_player_del_v1')]);
 async function open(){
  await f.evaluate(()=>{window.__psToggleBoardSettings('open');document.getElementById('cmd-board-settings-pop').__psSelectTab('layout');});
  await f.getByRole('button',{name:'스카우팅 명단 불러오기',exact:true}).click();
  await f.waitForSelector('#boardScoutDialog[open]');
 }
 await open();assert.equal(await f.locator('.bsi-candidate').count(),14,'deduplicated and deletion-filtered roster including unplaced candidates');
 assert.ok(await f.evaluate(()=>Array.from(document.querySelectorAll('#boardScoutDialog select')).every(s=>s.getBoundingClientRect().height>=44)),'filters retain tablet touch targets in both engines');
 assert.match(await f.locator('#boardScoutDialog [data-count]').textContent(),/14명 선택/);
 await f.getByRole('searchbox',{name:'후보 검색'}).fill('김민준');assert.equal(await f.locator('.bsi-candidate').count(),1);
 await f.getByRole('searchbox',{name:'후보 검색'}).press('Enter');assert.equal(await f.locator('#boardScoutDialog[open]').count(),1,'search Enter never imports the selection');
 await f.getByRole('searchbox',{name:'후보 검색'}).fill('');
 await f.getByRole('combobox',{name:'영입 단계',exact:true}).selectOption('go');assert.equal(await f.locator('.bsi-candidate').count(),5);
 await f.getByRole('button',{name:'전체 해제',exact:true}).click();assert.equal(await f.locator('#boardScoutDialog [data-load]').isDisabled(),true);await f.getByRole('button',{name:'표시된 후보 선택',exact:true}).click();
 assert.match(await f.locator('#boardScoutDialog [data-count]').textContent(),/5명 선택/);
 await f.getByRole('combobox',{name:'영입 단계',exact:true}).selectOption('');
 await f.getByRole('button',{name:'표시된 후보 선택',exact:true}).click();
 await page.screenshot({path:path.join(SHOTS,'scout-import-'+engine+'.png')});
 // Cancel is read-only for both board and scouting source.
 const untouched=await f.evaluate(()=>JSON.stringify(state.players));await f.getByRole('button',{name:'취소',exact:true}).click();
 assert.equal(await f.evaluate(()=>JSON.stringify(state.players)),untouched);
 // A hand-positioned board keeps IDs, geometry and the opposite team. 14 candidates exceed 11 slots.
 const before=await f.evaluate(()=>{
  state.players=FORM['433'].map((s,i)=>{const p=n2u(s[0],s[1]);return {id:uid++,team:'blue',num:i+1,name:'기존 '+i,pos:s[3],x:p.x+3,y:p.y};});
  state.players.push({id:uid++,team:'red',num:7,name:'상대 선수',x:900,y:300});renderTokens();
  anim.frames=[{snap:captureSnap()},{snap:captureSnap()}];animActive=0;return JSON.stringify(state.players);
 });
 await open();await f.getByRole('button',{name:'14명 불러오기',exact:true}).click();
 assert.equal(await f.evaluate(()=>document.querySelector('#boardScoutDialog [data-error]')?.textContent||''),'');await f.waitForSelector('#boardScoutDialog',{state:'detached'});
 const after=await f.evaluate(()=>JSON.parse(JSON.stringify(state.players))),original=JSON.parse(before);
 for(const p of original){const q=after.find(q=>q.id===p.id);assert.equal(q.x,p.x);assert.equal(q.y,p.y);if(p.team==='red')assert.deepEqual(q,p);}
 assert.equal(after.filter(p=>p.team==='blue').length,14);assert.equal(new Set(after.filter(p=>p.team==='blue').map(p=>p.name)).size,14);
 assert.ok(after.every(p=>!('memo' in p)&&!('club' in p)&&!('_scoutRef' in p)));
 assert.equal(await f.evaluate(()=>anim.frames[1].snap.players.filter(p=>p.team==='blue').length),14,'other animation scene receives the same roster');
 await page.screenshot({path:path.join(SHOTS,'scout-import-result-'+engine+'.png')});
 await f.evaluate(()=>undoLast());assert.equal(await f.evaluate(()=>JSON.stringify(state.players)),before,'single undo restores original lineup');
 await f.evaluate(()=>redoLast());assert.equal(await f.evaluate(()=>state.players.filter(p=>p.team==='blue').length),14);
 // A blank team 2 gets the selected formation; team 1 remains unchanged.
 const blue=await f.evaluate(()=>{state.players=state.players.filter(p=>p.team==='blue');document.getElementById('formAway').value='442';renderTokens();return JSON.stringify(state.players);});
 await open();await f.getByRole('combobox',{name:'배치할 팀',exact:true}).selectOption('red');await f.getByRole('button',{name:'14명 불러오기',exact:true}).click();
 await f.waitForSelector('#boardScoutDialog',{state:'detached'});
 assert.equal(await f.evaluate(()=>JSON.stringify(state.players.filter(p=>p.team==='blue'))),blue);
 assert.equal(await f.evaluate(()=>state.players.filter(p=>p.team==='red').length),14);
 assert.deepEqual(await f.evaluate(()=>[localStorage.getItem('cs_scout_targets_v1'),localStorage.getItem('scout_tool_v1'),localStorage.getItem('cs_player_del_v1')]),source,'original scouting and team data are never written');
 // Board save remains explicit and persists the imported names in the normal account-owned record.
    const save = await f.evaluate(async () => {
      const trace=[];
      const status=()=>({loaded:_boardPrivateLoaded,current:boardPrivateCurrent(_boardPrivateOwner),saving:!!_boardManualSaving,vault:!!_vaultBoardContext,vaultEdit:!!window.__vaultEdit,thumb:!!window.__psThumbCapturing,capLock:!!window.__capLock,applying:_bliveApplying,playing:animPlaying,exporting:!!window.__animExport,view:window.__csView,pending:!!(_boardPrivateRecord&&_boardPrivateRecord.pending),base:!!(_boardPrivateRecord&&_boardPrivateRecord.base),flight:!!_boardPrivateFlight,
        generation:_boardPrivateGeneration,editSeq:_boardPrivateEditSeq,recordToken:_boardPrivateRecord&&_boardPrivateRecord.token,durableToken:_boardPrivateDurableToken,
        knownLSLength:typeof _boardPrivateHead==='string'?_boardPrivateHead.length:null,knownIDBLength:typeof _boardPrivateIdbHead==='string'?_boardPrivateIdbHead.length:null,
        persistence:window.__psBoardPrivatePersistence&&((p)=>({generation:p.generation,seq:p.seq,token:p.token,pending:p.pending,failed:p.failed}))(window.__psBoardPrivatePersistence)});
      const before=status(),persist=boardPrivatePersist,send=boardPrivateSend;
      const failure=e=>{let snapshot;try{snapshot=status();}catch(diagnostic){snapshot={diagnosticError:diagnostic.message};}return {stack:e.stack,status:snapshot};};
      boardPrivatePersist=function(){return persist.apply(this,arguments).catch(e=>{trace.push(['persist',e.message,failure(e)]);throw e;});};
      boardPrivateSend=function(){return send.apply(this,arguments).catch(e=>{trace.push(['send',e.message,failure(e)]);throw e;});};
      try {const ok=await __boardSaveExplicit();return {ok,before,after:status(),trace};}
      finally {boardPrivatePersist=persist;boardPrivateSend=send;}
    });
    assert.equal(save.ok,true,JSON.stringify({engine,...save}));

 const saved=await f.evaluate(async()=>{const r=await boardPrivateRead(boardPrivateOwner());return JSON.stringify(r);});
 assert.match(saved,/미배치 후보/);assert.match(saved,/김민준/);
 // Owner and permissions are rechecked after opening; loss of authority removes the roster immediately.
 await open();await f.evaluate(()=>{window.__testCanEdit=PSPerms.canEdit;PSPerms.canEdit=()=>false;});await f.waitForSelector('#boardScoutDialog',{state:'detached'});
 await f.waitForFunction(()=>getComputedStyle(document.getElementById('loadScoutRosterBtn')).display==='none');
 await f.evaluate(()=>{PSPerms.canEdit=window.__testCanEdit;});
 await open();const stable=await f.evaluate(()=>JSON.stringify(state.players));
 await f.evaluate(()=>{localStorage.setItem('cs_player_del_v1','{"deleted":101}');document.querySelector('#boardScoutDialog form').requestSubmit();});
 assert.equal(await f.evaluate(()=>JSON.stringify(state.players)),stable,'source update before submit blocks import');
 await f.waitForSelector('#boardScoutDialog',{state:'detached'});
 await f.evaluate(()=>{window.__vaultReadOnly=true;});
 await f.evaluate(()=>document.getElementById('loadScoutRosterBtn').click());assert.equal(await f.locator('#boardScoutDialog').count(),0);
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 console.log('board-scout-import ok',engine);
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
