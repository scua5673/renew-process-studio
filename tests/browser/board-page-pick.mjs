import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.091 — 사용자 «페이지를 다중 선택하고 보드설정에서 바꾸면 바뀌게».
// 페이지 세 장 · ⌘ 누른 채 3쪽 탭 → 보드 설정 › 운동장에서 피치 «화이트» → 1쪽(지금) · 3쪽은 화이트, 고르지 않은 2쪽은 그대로.
// 보드 설정의 «함께 바꿀 페이지» 칩으로도 고른다(«모두» → 규격 8인제가 세 장 모두). 그냥 탭을 누르면 고르기가 풀린다.
// 합성 팀 fixture 에서만 돈다. 데스크톱 폭.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof window.__psToggleBoardSettings==='function'&&window.__psPages&&window.PSPagePick&&!!document.getElementById('bpNewBoard'),null,{timeout:30000});
  await page.waitForTimeout(900);
  const tabs=()=>f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab').length);
  const addPage=async()=>{await f.click('#boardPageStrip .bp-add:not(#bpImportBoard):not(#bpNewBoard)');await page.waitForTimeout(500);};
  const pageVals=k=>f.evaluate(k=>{const v=window.__psPages.liveVal();return v.pages.map(p=>p.snap[k]==null?'':p.snap[k]);},k);
  const vis=sel=>f.evaluate(sel=>{const e=document.querySelector(sel);if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none';},sel);
  await f.evaluate(()=>window.__applyPitch('',null));
  await addPage();await addPage();
  assert.equal(await tabs(),3,'페이지 세 장');
  // 1쪽으로 가서, ⌘ 누른 채 3쪽 탭
  await f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab')[0].click());await page.waitForTimeout(500);
  const mod=process.platform==='darwin'?'Meta':'Control';
  await f.locator('#boardPageStrip .bp-tab').nth(2).click({modifiers:[mod]});
  await page.waitForTimeout(300);
  assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#boardPageStrip .bp-tab')].map(t=>t.classList.contains('bp-pick'))),[false,false,true],'3쪽이 골라졌다');
  assert.equal(await f.evaluate(()=>window.__psPages.book.idx()),0,'⌘ 누르기는 페이지를 옮기지 않는다');
  await page.screenshot({path:path.join(SHOTS,'board-page-pick-strip-'+engine+'.png'),clip:{x:90,y:0,width:700,height:60}});
  // 보드 설정 › 운동장 — «함께 바꿀 페이지» 줄
  await f.evaluate(()=>window.__psToggleBoardSettings('open'));await page.waitForTimeout(300);
  await f.evaluate(()=>document.getElementById('cmd-board-settings-pop').__psSelectTab('pitch'));await page.waitForTimeout(300);
  assert.equal(await vis('#bsPagePickRow'),true,'페이지가 여럿이면 줄이 보인다');
  assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#bsPagePickRow .pp-chip[data-i]')].map(b=>b.classList.contains('on'))),[true,false,true],'칩: 지금 + 고른 페이지');
  await page.screenshot({path:path.join(SHOTS,'board-page-pick-'+engine+'.png')});
  await f.click('#cmd-board-settings-pop #pitchSeg button[data-p="white"]');await page.waitForTimeout(700);
  assert.deepEqual(await pageVals('pitchTheme'),['white','','white'],'고른 페이지만 화이트');
  // 칩 «모두» → 규격 8인제가 세 장 모두
  await f.click('#bsPagePickRow .pp-chip[data-all]');await page.waitForTimeout(200);
  assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#bsPagePickRow .pp-chip[data-i]')].map(b=>b.classList.contains('on'))),[true,true,true],'모두');
  await f.evaluate(()=>window.__setPitchSpec('u12'));await page.waitForTimeout(700);
  assert.deepEqual(await pageVals('pitchSpec'),['u12','u12','u12'],'세 장 모두 8인제');
  // 그냥 탭을 누르면(페이지 전환) 고르기가 풀리고, 이제 바꾸면 그 페이지만
  await f.evaluate(()=>window.__psToggleBoardSettings('close'));await page.waitForTimeout(300);
  await f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab')[1].click());await page.waitForTimeout(500);
  assert.equal(await f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab.bp-pick').length),0,'풀렸다');
  await f.evaluate(()=>window.__setPitchSpec('fifa'));await page.waitForTimeout(700);
  assert.deepEqual(await pageVals('pitchSpec'),['u12','fifa','u12'],'고른 것이 없으면 지금 페이지만');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,passed:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
