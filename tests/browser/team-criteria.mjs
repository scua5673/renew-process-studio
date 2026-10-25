import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,WT,A,OUT,SHOTS} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
const gm={identity:'볼을 소유하고, 함께 전진한다.',custom:{keep:1},moments:[{key:'ao',name:'공격',tag:'IN POSSESSION',main:'',custom:'moment',phases:[{id:'build',name:'후방 빌드업',principles:[{t:'상대의 첫 압박선을 넘어 전진한다',why:'상대가 중앙을 닫으면 바깥 선수를 먼저 찾는다.',extra:{retain:true}},'공을 받기 전, 다음 패스 길을 확인한다'],snap:{thumb:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#15364b"/></svg>',snap:{players:[{id:'tok1'}]},frames:[{snap:{players:[{id:'tok1',x:12}]}}]},extra:'phase'},{id:'progress',name:'중원 전진',principles:['전진할 수 있으면 전진한다'],snap:null}]},{key:'do',name:'수비',phases:[{id:'press',name:'전방 압박',principles:['안쪽을 닫고 바깥으로 유도한다']}]}]};
const terms={v:7,custom:'terms',items:[{id:'t1',l:'signal',g:'공격',en:'Turn',ko:'돌아서 전진',d:'등 뒤에 공간이 있을 때 사용한다.',ph:['build'],custom:4},{id:'t2',l:'concept',g:'공격',ko:'지원 거리',en:'Support',d:'패스를 받을 수 있는 거리를 만든다.',ph:[],custom:9}]};
function seed(k,v){fx.db.set(WT+'|'+k,{workspace_id:WT,k,v:JSON.stringify(v),cupd:1000,updated_by:A});}
seed('cs_gamemodel_v1',gm);seed('cs_terms_v1',terms);
const drills=[{libId:'drill1',createdBy:A,kind:'drill',name:'첫 압박선 넘기 · 4 대 2',minutes:12,gmPhases:['build'],gmPhaseNames:['공격 › 후방 빌드업'],custom:'keep',snap:{players:[]}},{libId:'drill2',createdBy:A,kind:'drill',name:'3인 패스와 전진',minutes:15,custom:'other',snap:{players:[]}}];
seed('cs_drill_lib_v1',drills);for(const item of drills)fx.lib.set(WT+'|'+item.libId,{workspace_id:WT,lib_id:item.libId,owner_id:A,item,updated_at:new Date().toISOString(),deleted_at:null});
const roster=JSON.parse(fx.db.get(WT+'|scout_tool_v1').v);roster.players[0].levels={tac_scan:72};seed('scout_tool_v1',roster);seed('sq:'+roster.players[0].id,roster.players[0]);
const frame=async(page,id)=>(await page.waitForSelector(id,{state:'attached'})).contentFrame();
const getDoc=(page,key)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const save=async pb=>{await pb.locator('#pbEditSave').click();await pb.waitForFunction(()=>!document.getElementById('pbEdit').open);};
const shots=[];
try{
 const {page,logs}=await openApp(fx,size,{browsers});page.setDefaultTimeout(15000);
 await page.locator('#appSeg [data-team-hub]').click();
 await page.locator('#teamNav [data-team-key="playbook"]').click();
 const pb=await frame(page,'#fPlaybook');await pb.locator('[data-pedit="0"]').waitFor();
 assert.equal(await page.locator('#teamNav [data-team-key="playbook"]').innerText(),'팀 기준');
 assert.deepEqual(await page.locator('#teamSub button:visible').allTextContents(),['플레이북','선수 기준']);
 assert.ok(await pb.locator('[data-lib="drill1"]').isVisible());
 for(const width of [1280,1100,375]){await page.setViewportSize({width,height:980});if(width===375)await pb.locator('[data-ph="build"]').click();await page.waitForTimeout(200);assert.equal(await pb.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'playbook no horizontal overflow '+width);const out=path.join(SHOTS,'criteria-playbook-'+engine+'-'+width+'.png');await page.screenshot({path:out,fullPage:true});shots.push(out);}
 await page.setViewportSize({width:1280,height:1000});
 await pb.locator('[data-pedit="0"]').click();await pb.locator('[name="title"]').fill('첫 압박선을 넘고 전진 패스를 찾는다');
 // An unrelated concurrent edit must survive the open dialog.
 await page.evaluate(()=>{const k='cs_gamemodel_v1',d=JSON.parse(localStorage.getItem(k));d.moments[1].extra='newer';localStorage.setItem(k,JSON.stringify(d));});
 await save(pb);let doc=await getDoc(page,'cs_gamemodel_v1');assert.equal(doc.moments[0].phases[0].principles[0].t,'첫 압박선을 넘고 전진 패스를 찾는다');assert.equal(doc.moments[1].extra,'newer');assert.deepEqual(doc.moments[0].phases[0].snap,gm.moments[0].phases[0].snap);assert.equal(doc.moments[0].phases[0].principles[0].extra.retain,true);
 // Same-field conflict keeps the draft and does not write over the newer value.
 await pb.locator('[data-pedit="0"]').click();await pb.locator('[name="title"]').fill('수정 중 초안');await page.evaluate(()=>{const k='cs_gamemodel_v1',d=JSON.parse(localStorage.getItem(k));d.moments[0].phases[0].principles[0].t='다른 코치의 새 원칙';localStorage.setItem(k,JSON.stringify(d));});await pb.locator('#pbEditSave').click();await pb.waitForFunction(()=>document.getElementById('pbEditError').textContent.includes('다른 곳'));assert.equal(await pb.locator('[name="title"]').inputValue(),'수정 중 초안');await pb.locator('#pbEditCancel').click();
 // A rejected durable write may not fall back to a success or lose the form.
 await pb.locator('[data-pedit="0"]').click();await pb.locator('[name="title"]').fill('저장 실패 초안');await pb.evaluate(()=>{window.realSave=psSaveSharedAsync;window.psSaveSharedAsync=()=>Promise.reject(new Error('시험 저장 거절'));});await pb.locator('#pbEditSave').click();await pb.waitForFunction(()=>document.getElementById('pbEditError').textContent.includes('시험 저장 거절'));assert.equal(await pb.locator('[name="title"]').inputValue(),'저장 실패 초안');await pb.evaluate(()=>window.psSaveSharedAsync=window.realSave);await pb.locator('#pbEditCancel').click();
 // A failed write after the local mirror changed retries the same add without duplication.
 const countBefore=await pb.evaluate(()=>JSON.parse(localStorage.getItem('cs_gamemodel_v1')).moments[0].phases[0].principles.length);
 await pb.locator('[data-padd]').click();await pb.locator('[name="title"]').fill('실패 후 다시 저장할 원칙');
 await pb.evaluate(()=>{window.realSave=psSaveSharedAsync;window.psSaveSharedAsync=(k,raw)=>{localStorage.setItem(k,raw);return Promise.reject(new Error('시험 IDB 거절'));};});
 await pb.locator('#pbEditSave').click();await pb.waitForFunction(()=>document.getElementById('pbEditError').textContent.includes('다시 저장'));
 assert.equal(await pb.locator('[name="title"]').isDisabled(),true);await pb.evaluate(()=>window.psSaveSharedAsync=window.realSave);await save(pb);
 assert.equal(await pb.evaluate(()=>JSON.parse(localStorage.getItem('cs_gamemodel_v1')).moments[0].phases[0].principles.length),countBefore+1);
 // Legacy routes open the relevant tools within the workbench.
 await page.evaluate(()=>document.querySelector('#teamSub [data-team-key="settings"]').click());await pb.waitForFunction(()=>document.getElementById('pbStructure').open);
 await pb.locator('[data-prename="build"]').click();await pb.locator('[name="name"]').fill('후방 전개');await save(pb);doc=await getDoc(page,'cs_gamemodel_v1');assert.equal(doc.moments[0].phases[0].id,'build');assert.equal(doc.moments[0].phases[0].name,'후방 전개');
 assert.deepEqual((await getDoc(page,'cs_terms_v1')).items[0].ph,['build']);
 await pb.locator('#pbStructure>summary').click();
 await pb.locator('[data-tpick]').click();await pb.locator('[data-tlink="t2"]').click();await pb.waitForFunction(()=>JSON.parse(localStorage.getItem('cs_terms_v1')).items[1].ph.includes('build'));
 await pb.locator('.tc-term').filter({hasText:'Support'}).locator('summary').click();await pb.locator('[data-tdel="t2"]').click();await pb.waitForFunction(()=>JSON.parse(localStorage.getItem('cs_terms_v1')).items[1].ph.length===0);assert.equal((await getDoc(page,'cs_terms_v1')).items.length,2);
 await page.evaluate(()=>document.querySelector('#teamSub [data-team-key="terms"]').click());await pb.locator('#pbTerms').waitFor();assert.match(await pb.locator('#pbTermsList').innerText(),/Support/);await pb.locator('[data-terms-close]').click();
 // Serialized board linking must retain non-target drills and latest fields.
 await pb.locator('[data-lpick]').click();await pb.locator('[data-llink="drill2"]').click();await pb.locator('[data-lib="drill2"]').waitFor({timeout:25000});
 const board=await frame(page,'#fBoard');let library=await board.evaluate(()=>libGet());assert.deepEqual(library.find(d=>d.libId==='drill2').gmPhases,['build']);assert.equal(library.find(d=>d.libId==='drill1').custom,'keep');
 await pb.locator('[data-ldel="drill2"]').click();await pb.locator('[data-lib="drill2"]').waitFor({state:'detached'});library=await board.evaluate(()=>libGet());assert.equal(library.find(d=>d.libId==='drill2').custom,'other');assert.equal(library.find(d=>d.libId==='drill2').gmPhases,undefined);
 console.log('workbench persistence passed');
 // A role change removes editing, but leaves all data readable.
 await pb.evaluate(()=>{window.realPerm=PSPerms.canEdit;PSPerms.canEdit=()=>false;dispatchEvent(new StorageEvent('storage',{key:'cs_perms_v1'}));});await pb.evaluate(()=>dispatchEvent(new MessageEvent('message',{origin:location.origin,source:parent,data:{type:'refresh'}})));await pb.waitForFunction(()=>!document.querySelector('[data-pedit]'));assert.equal(await pb.locator('[data-tnew]').count(),0);await pb.evaluate(()=>PSPerms.canEdit=window.realPerm);
 await page.locator('#teamSub [data-team-key="attrs"]').click();const scout=await frame(page,'#fScout');await scout.locator('.tc-criteria-head h2').waitFor();assert.equal(await scout.locator('.tc-criteria-head h2').innerText(),'선수 기준');
 assert.equal(await scout.locator('.attr-pos').getAttribute('open'),null);assert.equal(await scout.locator('#attrEditor .attr-cat:not(.attr-pos)').count(),1);
 for(const width of [1280,375]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);assert.equal(await scout.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'criteria no horizontal overflow '+width);const out=path.join(SHOTS,'criteria-players-'+engine+'-'+width+'.png');await page.screenshot({path:out,fullPage:true});shots.push(out);}
 await page.setViewportSize({width:1280,height:1000});const before=await scout.evaluate(()=>JSON.parse(JSON.stringify({attrs:data.attrs,players:data.players,positions:data.positions})));
 await scout.locator('#attrEditBtn').click();await scout.locator('.attr-cat-head').first().click();await scout.locator('.ed-attr-q').first().fill('공을 받기 전에 다음 선택을 확인하나요?');await scout.locator('.ed-attr-w').first().fill('공을 받기 전 어깨 너머를 두 번 확인한다.');await scout.locator('#attrEditBtn').click();
 await scout.evaluate(()=>scoutStore.ready(true));
 const durable=await scout.evaluate(async()=>JSON.parse((await storage.get('scout_tool_v1')).value));assert.equal(durable.attrs[0].w,'공을 받기 전 어깨 너머를 두 번 확인한다.');
 const after=await scout.evaluate(()=>JSON.parse(JSON.stringify({attrs:data.attrs,players:data.players,positions:data.positions})));assert.deepEqual(after.attrs.map(a=>a.id),before.attrs.map(a=>a.id));assert.deepEqual(after.players,before.players);assert.deepEqual(after.positions,before.positions);assert.equal(after.attrs[0].w,'공을 받기 전 어깨 너머를 두 번 확인한다.');
 assert.match(await scout.locator('#attrEditor').innerText(),/공을 받기 전 어깨 너머/);
 console.log('criteria persistence passed');
 if(engine==='webkit')for(const dark of [false,true]){
  const mobile=await openApp(fx,'phone',{browsers,dark});const mp=mobile.page;await mp.locator('#appSeg [data-team-hub]').click();await mp.locator('#teamBottom [data-tb="more"]').click();await mp.locator('#teamMoreSheet [data-tb="playbook"]').click();
  const mf=await frame(mp,'#fPlaybook');await mf.locator('[data-ph="build"]').click();await mf.locator('[data-pedit="0"]').waitFor();
  assert.equal(await mf.evaluate(()=>innerWidth),375);assert.equal(await mf.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const shot=path.join(SHOTS,'criteria-phone-'+(dark?'dark':'light')+'.png');await mp.screenshot({path:shot});shots.push(shot);
  await mp.locator('#teamSub [data-team-key="attrs"]').click();const sf=await frame(mp,'#fScout');await sf.locator('.tc-criteria-head').waitFor();assert.equal(await sf.evaluate(()=>innerWidth),375);assert.equal(await sf.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const shot2=path.join(SHOTS,'criteria-phone-players-'+(dark?'dark':'light')+'.png');await mp.screenshot({path:shot2});shots.push(shot2);
  assert.deepEqual(mobile.logs.filter(x=>x.type==='pageerror'&&!/ResizeObserver loop/.test(x.text)),[]);await mobile.context.close();
 }
 const errors=logs.filter(x=>x.type==='pageerror'&&!/ResizeObserver loop/.test(x.text));assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(OUT,'team-criteria.json'),JSON.stringify({passed:true,engine,shots,checks:['navigation','responsive','metadata preservation','concurrent edits','conflict','rejected save','legacy routes','terms','library links','permissions','criteria scores']},null,2));console.log(JSON.stringify({passed:true,engine,shots}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
