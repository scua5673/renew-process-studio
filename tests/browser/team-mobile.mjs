// Real shell + synthetic team; no external requests or production data.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,measure,SIZES,A,WT,OUT,SHOTS} from '../fixtures/team-app.mjs';
import {depthCandidates} from '../fixtures/player-depth.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
SIZES.phone.engine=engine;
SIZES.phone.ctx={...SIZES.phone.ctx,viewport:{width:390,height:844},deviceScaleFactor:1};
const fx=await startFixture(),browsers={},results=[];
const put=(k,v)=>fx.db.set(WT+'|'+k,{workspace_id:WT,k,v:JSON.stringify(v),cupd:1000,updated_by:A});
const gm={identity:'함께 보고, 함께 전진한다.',moments:[{key:'ao',name:'공격',phases:[{id:'build',name:'후방 빌드업',principles:['공을 받기 전에 다음 선택을 확인한다.']},{id:'advance',name:'중원 전진',principles:['전진할 수 있으면 전진한다.']}]},{key:'do',name:'수비',phases:[{id:'press',name:'전방 압박',principles:['안쪽을 닫고 바깥으로 유도한다.']}]}]};
put('cs_scout_targets_v1',depthCandidates());put('cs_gamemodel_v1',gm);
async function tapSize(loc,label){const b=await loc.boundingBox();assert.ok(b&&b.width>=43.5&&b.height>=43.5,label+' '+JSON.stringify(b));}
try{
 const {page,logs}=await openApp(fx,'phone',{browsers,phoneStart:true,dark:engine==='webkit'});
 async function go(key){
  if(key==='avail'){await go('players');await page.locator('#teamSub [data-team-key="avail"]').click();}
  else if(['playbook','attrs'].includes(key)){await page.locator('#teamBottom [data-tb="more"]').click();await page.locator('#teamMoreSheet [data-tb="'+key+'"]').click();}
  else await page.locator('#teamBottom [data-tb="'+key+'"]').click();
  await page.waitForTimeout(400);
 }
 async function frame(id){return (await page.locator(id).elementHandle()).contentFrame();}
 async function snap(key,width){
  const m=await measure(page,{phone:true});
  for(const f of m.frames){assert.ok(f.docOverflow.sw<=f.docOverflow.cw+1,key+' frame overflow '+JSON.stringify(f.docOverflow));}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),key+' shell overflow');
  results.push({key,width,...m});await page.screenshot({path:path.join(SHOTS,key+'-'+width+'.png')});
 }
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});
  for(const key of ['today','match','training','players','avail','idp','scouting','playbook','attrs']){
   await go(key);
   if(key==='players'){
    const f=await frame('#fScout');await f.locator('#pwTeam .pw-depth-pitch').waitFor();
    await tapSize(f.locator('#pwTeam [data-pw-action="tools"]'),'edit tools');
    const pitch=await f.locator('#pwTeam .pw-depth-pitch').boundingBox();assert.ok(pitch.y<680,'phone first pitch reachable without a full screen of tools '+pitch.y);
    await f.locator('#pwTeam [data-pw-action=filters]').click();
    await tapSize(f.locator('#pwTeam .pw-filter-fields>select').first(),'position filter');
    const filters=await f.locator('#pwTeam .pw-filter-fields>select').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));assert.ok(filters.every(w=>w>=94),'filters can show their labels');
    await f.locator('#pwTeam [data-pw-action=filters]').click();
   }
   if(key==='idp')await tapSize((await frame('#fIdp')).getByRole('combobox',{name:'성장 카드를 볼 선수'}),'IDP player picker');
   if(key==='playbook'){
    const f=await frame('#fPlaybook');await f.getByRole('combobox',{name:'플레이북 국면'}).waitFor();
    await tapSize(f.getByRole('combobox',{name:'플레이북 국면'}),'phase picker');
    assert.equal(await f.locator('#detail h2').isVisible(),true,'selected phase is visible on entry');
    await f.getByRole('combobox',{name:'플레이북 국면'}).selectOption('press');
    assert.equal(await f.locator('#detail h2').innerText(),'전방 압박');
    assert.equal(await f.getByRole('combobox',{name:'플레이북 국면'}).isVisible(),true,'picker remains reachable after changing phase');
    assert.deepEqual(JSON.parse(fx.db.get(WT+'|cs_gamemodel_v1').v),gm,'phase browsing never edits model');
   }
   await snap(key,width);
  }
  await go('more');await tapSize(page.locator('#teamMoreSheet [data-tb="close"]'),'more close');await snap('more',width);await page.locator('#teamMoreSheet [data-tb="close"]').click();
 }
 // Open/cancel editing surfaces from compact controls; navigation must preserve the roster.
 await page.setViewportSize({width:390,height:844});await go('players');const scout=await frame('#fScout');
 const roster=await scout.evaluate(()=>JSON.stringify(data.players));
 await scout.locator('#pwTeam [data-pw-action="tools"]').click();
 assert.equal(await scout.locator('#pwTeam [data-pw-action="tools"]').getAttribute('aria-expanded'),'true');
 await scout.locator('#pwTeam [data-pw-action="bulk"]').click();await scout.locator('.pw-bulk-overlay').waitFor();
 assert.ok((await scout.locator('.pw-bulk-row input[data-f=name]').first().boundingBox()).width>200,'name field remains readable');
 await tapSize(scout.locator('.pw-bulk-row button').first(),'remove row');
 await tapSize(scout.locator('.pw-bulk-row select').first(),'bulk position picker');
 const cancel=await scout.locator('.pw-bulk-foot [data-cancel]').boundingBox();assert.ok(cancel.y+cancel.height<750,'bulk actions remain on screen');
 await snap('players-bulk',390);
 await scout.locator('.pw-bulk-overlay [data-cancel]').click();
 assert.equal(await scout.evaluate(()=>JSON.stringify(data.players)),roster,'cancelled bulk add leaves players unchanged');
 await scout.locator('#pwTeam [data-pw-action="tools"]').click();await scout.getByRole('button',{name:'명단',exact:true}).click();
 await scout.getByRole('searchbox',{name:'선수 검색'}).fill('가상 선수 18');assert.equal(await scout.locator('#pwTeam tbody tr').count(),1);
 await tapSize(scout.locator('.pw-select-hit'),'compare checkbox label');
 await scout.locator('.pw-select-hit').click();assert.equal(await scout.getByRole('checkbox').isChecked(),true,'full label toggles comparison');
 await snap('players-search',390);await scout.getByRole('searchbox',{name:'선수 검색'}).fill('');
 await scout.getByRole('button',{name:'포지션',exact:true}).click();
 await go('match');await scout.locator('#matchView .mr-hit').last().click();await scout.locator('#matchWorkspace').waitFor();await snap('match-detail',390);
 await go('playbook');const pb=await frame('#fPlaybook');await pb.locator('[data-pedit="0"]').click();await pb.locator('#pbEdit[open]').waitFor();
 await tapSize(pb.locator('#pbEditSave'),'phase save');await snap('playbook-edit',390);await pb.locator('#pbEditCancel').click();
 // A separate desktop/tablet context avoids the shell's phone device classification.
 const wide=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
 await wide.page.locator('#appSeg [data-team-hub]').click();
 await wide.page.locator('#teamNav [data-team-key="playbook"]').click();
 const widePb=await (await wide.page.locator('#fPlaybook').elementHandle()).contentFrame();
 await widePb.locator('[data-ph="build"]').waitFor();
 assert.equal(await widePb.getByRole('combobox',{name:'플레이북 국면'}).isVisible(),false);
 await widePb.locator('[data-ph="build"]').click();assert.equal(await widePb.locator('#detail h2').innerText(),'후방 빌드업');
 assert.deepEqual(wide.logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 await wide.context.close();
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 fs.writeFileSync(path.join(OUT,'audit.json'),JSON.stringify({passed:true,engine,results,logs},null,2));
 console.log(JSON.stringify({passed:true,engine,views:results.length,widths:[360,390,430],tabletDesktop:true}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
