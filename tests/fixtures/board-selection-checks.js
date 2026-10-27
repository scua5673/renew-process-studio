/* Synthetic fixture only. Each operation uses the real selection controls. */
(function(){
 const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(m||JSON.stringify([a,b]));},ok=(v,m)=>{if(!v)throw Error(m);},frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 async function run(){const rows=[];async function check(name,fn){try{await fn();rows.push({name,pass:true});}catch(e){rows.push({name,pass:false,error:e.message});}}
 const ctl=()=>document.querySelector('.sel-ctl'),open=()=>{__selPanelOpen(true);updateDelUI();positionSelCtl();},click=s=>document.querySelector(s).click();
 await check('메뉴 준비',()=>ok(window.__psSelectionMenu&&ctl().classList.contains('ps-selection-menu'),'메뉴 없음'));
 PSBoardEditChecks.seed();multiSel=[...state.players,state.equipment[0]];sel=null;open();await frame();
 await check('혼합 4개 · 중복 메뉴 없음',()=>{eq(document.querySelector('.ps-in-nm').textContent,'4개 선택');eq(document.querySelector('.ps-sm-scope').textContent,'선수 3명만');eq(getComputedStyle(document.getElementById('alignBar')).display,'none');});
 await check('우클릭으로 그룹 유지',()=>{const g=tokenLayer.querySelector('[data-id="8101"]'),r=g.getBoundingClientRect();g.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));eq(multiSel.length,4);});
 await check('조끼는 선수만 · 되돌리기',()=>{const before=JSON.stringify(state.equipment),colors=state.players.map(p=>p.bib||'');click('.ps-sm-swatches [data-bib="#38bdf8"]');ok(state.players.every(p=>p.bib==='#38bdf8'),'조끼 적용');eq(JSON.stringify(state.equipment),before);undoLast();eq(state.players.map(p=>p.bib||''),colors);});
 multiSel=[...state.players,state.equipment[0]];sel=null;open();
 await check('정렬과 잠금 보존 · 되돌리기',()=>{const p=state.players[2];p.locked=true;const before=state.players.map(p=>[p.x,p.y]);click('.ps-sm-align-grid [data-align="minX"]');eq(state.players[0].x,state.equipment[0].x);eq([p.x,p.y],before[2]);undoLast();eq(state.players.map(p=>[p.x,p.y]),before);delete state.players[2].locked;});
 multiSel=[...state.players,state.equipment[0]];sel=null;open();
 await check('Esc는 메뉴만 닫기',()=>{const before=JSON.stringify(captureSnap());document.querySelector('.ps-sm-swatches button').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));eq(multiSel.length,4);eq(getComputedStyle(ctl()).display,'none');eq(JSON.stringify(captureSnap()),before,'메뉴 닫기는 자료를 바꾸지 않음');});
 selectItem('player',state.players[0]);open();await frame();
 await check('원래 이름·번호 입력 연결',()=>{const name=document.getElementById('nameInput'),num=document.getElementById('numInput');name.value='메뉴 검증 선수';name.dispatchEvent(new Event('input',{bubbles:true}));name.dispatchEvent(new Event('blur'));num.value='10';num.dispatchEvent(new Event('input',{bubbles:true}));num.dispatchEvent(new Event('blur'));eq(state.players[0].name,'메뉴 검증 선수');eq(String(state.players[0].num),'10');});
 await check('접힌 추가 설정과 주발',()=>{const more=document.querySelector('.ps-sm-more');eq(more.open,false);more.open=true;click('.ps-in-foot [data-foot="L"]');eq(state.players[0].foot,'L');for(const id of ['photoBtn','visBtn','lookBtn','colorCtl','posCtl','frontSelBtn','backSelBtn','shaperBtn','ballLookBtn'])ok(more.contains(document.getElementById(id)),id+' 접근 누락');});
 await check('읽기 전용 메뉴 수정 차단',()=>{const before=JSON.stringify(captureSnap());window.__vaultReadOnly=true;updateDelUI();eq(getComputedStyle(ctl()).display,'none');click('.ps-sm-swatches [data-bib="#f472b6"]');eq(JSON.stringify(captureSnap()),before);window.__vaultReadOnly=false;updateDelUI();});
 document.querySelector('.ps-sm-more').open=false;await frame();
 await check('메뉴와 닫기·삭제가 화면 안',()=>{const r=ctl().getBoundingClientRect();ok(r.width>200&&r.left>=-1&&r.right<=innerWidth+1,'가로 범위');ok(r.top>=-1&&r.bottom<=innerHeight+1,'세로 범위');if(ctl().classList.contains('ps-sm-mobile')){const token=tokenLayer.querySelector('[data-id="8101"]').getBoundingClientRect();ok(token.bottom<r.top,'선택 선수가 시트 위에 보여야 함');}for(const q of ['.ps-in-x','#delSelBtn']){const b=document.querySelector(q).getBoundingClientRect();ok(b.top>=r.top&&b.bottom<=r.bottom+1,q+' 잘림');}});
 await check('저장본에 편집 반영',()=>{const s=JSON.parse(JSON.stringify(captureSnap()));eq(s.players[0].name,'메뉴 검증 선수');eq(String(s.players[0].num),'10');eq(s.players[0].foot,'L');loadSnap(s);eq(state.players[0].name,s.players[0].name);});
 return rows;
 }
 window.PSSelectionChecks={run};
})();
