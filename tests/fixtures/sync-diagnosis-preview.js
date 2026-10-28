/* Synthetic in-memory records only. Used by the local visual preview and browser regression. */
(function(){
  'use strict';
  var epoch=1,mode=new URLSearchParams(location.search).get('mode'),key='scout_tool_v1';
  if(mode==='dark')document.body.classList.add('fmdark');
  var players=Array.from({length:47},function(_,i){return {id:'p'+i,name:'가상 선수 '+(i+1),memo:'',type:'ours'};});
  var screen=JSON.stringify({players:players,attrs:[],positions:[]});
  players[0].memo='훈련 후 왼발 패스 연결을 다시 확인';var device=JSON.stringify({players:players,attrs:[],positions:[]});
  players[1].name='가상 선수 2 (수정)';var server=JSON.stringify({players:players,attrs:[],positions:[]});
  var queue=Array.from({length:8},function(_,i){return {uid:'synthetic-coach',wid:'synthetic-team',key:['attrs','schedule','folders','sq:1','sq:2','sq:3','sq:4','sq:5'][i],roundError:'sync_storage',roundStage:'roster_copies_differ',roundFails:35000-i,at:Date.now()-259200000};});
  function context(){return {uid:'synthetic-coach',wid:'synthetic-team',epoch:epoch};}
  function current(c){return c.epoch===epoch;}
  var deps={context:context,current:current,mirror:function(){return screen;},stored:function(){return Promise.resolve({value:device});},server:function(){return Promise.resolve([{k:key,v:server,cupd:'synthetic-version'}]);}};
  var syncCalls=0,reviewCalls=0;
  window.PSSync={diag:function(){return PSSyncDiagnosis.collect({context:context,current:current,outbox:function(){return Promise.resolve(queue);},held:function(){return queue.filter(function(_,i){return i!==1&&i!==2;}).map(function(q){return {kind:'conflict',uid:q.uid,wid:q.wid,k:q.key};});},label:function(k){return ({attrs:'평가 항목',schedule:'일정·주간 훈련',folders:'보관함 폴더 정보'})[k]||'선수 한 명';},text:function(){return '이 기기 저장소를 확인해 주세요';},info:function(){return {ws:'가상 테스트 FC',online:true,session:true,lastPull:Date.now()-345600000,localBytes:9437184,largest:[],recent:[]};}});},inspectRosterCopies:function(){return PSSyncDiagnosis.inspect(deps);},syncNow:function(){syncCalls++;}};
  window.PSDataReview={open:function(){reviewCalls++;}};
  PSSyncDiagnosisUI.install(window);
  function waitFor(check){return new Promise(function(resolve,reject){var n=0;function tick(){if(check())return resolve();if(++n>150)return reject(Error('UI timeout'));setTimeout(tick,20);}tick();});}
  function check(ok,label){if(!ok)throw Error(label);return label;}
  async function run(){
    var results=[],originalScreen=screen,originalDevice=device,originalServer=server,originalQueue=JSON.stringify(queue);
    var select=function(s){return document.querySelector(s);},button=document.getElementById('psDiagOpen');
    if(select('#psDiagSheet'))select('#psDiagSheet').psClose();button.focus();button.click();await waitFor(function(){return select('.sd-inspect');});
    results.push(check(select('h2#sd-title').textContent.includes('8건'),'대기 8건 표시'));
    results.push(check(select('.sd-lead').textContent.includes('6건')&&select('.sd-lead').textContent.includes('2건'),'내용 확인 6건·그 밖의 대기 2건 구분'));
    results.push(check(document.querySelectorAll('.sd-cause').length===1,'공통 중단 원인 한 번 표시'));
    results.push(check(Array.from(document.querySelectorAll('.sd-actions button')).every(function(b){return b.getBoundingClientRect().height>=44;}),'주요 단추의 터치 높이 44px 이상'));
    var card=select('.sd-card'),r=card.getBoundingClientRect();results.push(check(r.width<=innerWidth&&r.left>=0&&r.right<=innerWidth+1&&card.scrollWidth<=card.clientWidth+1,'화면 너비 안에 표시'));
    select('.sd-inspect').click();await waitFor(function(){return select('.sd-export');});
    results.push(check(document.querySelectorAll('.sd-sources strong').length===3&&Array.from(document.querySelectorAll('.sd-sources strong')).every(function(e){return e.textContent==='47명';}),'세 사본 47명 비교'));
    card.scrollTop=card.scrollHeight;await new Promise(function(resolve){requestAnimationFrame(resolve);});var closeRect=select('.pd-x').getBoundingClientRect();results.push(check(closeRect.top>=r.top&&closeRect.bottom<=r.bottom,'긴 비교를 스크롤해도 닫기 단추 유지'));card.scrollTop=0;
    var diff=select('.sd-diff');diff.open=true;results.push(check(diff.textContent.includes('훈련 후 왼발'),'같은 인원수의 메모 차이 표시'));
    var blob=null,file='',create=URL.createObjectURL,revoke=URL.revokeObjectURL,click=HTMLAnchorElement.prototype.click;
    try{URL.createObjectURL=function(b){blob=b;return 'blob:synthetic-only';};URL.revokeObjectURL=function(){};HTMLAnchorElement.prototype.click=function(){file=this.download;};select('.sd-export').click();await waitFor(function(){return blob;});var backup=JSON.parse(await blob.text());results.push(check(backup.sources[0].raw===screen&&backup.sources[1].raw===device&&backup.sources[2].raw===server&&file.endsWith('.json'),'내려받기 원문 세 사본 일치'));}
    finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;HTMLAnchorElement.prototype.click=click;}
    results.push(check(screen===originalScreen&&device===originalDevice&&server===originalServer&&JSON.stringify(queue)===originalQueue&&syncCalls===0&&reviewCalls===0,'비교·내려받기 중 원본·대기 목록·전송 변경 없음'));
    epoch++;await waitFor(function(){return select('#sd-title').textContent.includes('자료가 바뀌어');});results.push(check(!select('.sd-diff')&&!select('.sd-export'),'팀·권한 변경 시 자료 화면 즉시 비움'));
    select('.pd-x').click();results.push(check(!select('#psDiagSheet')&&document.activeElement===button,'닫기 후 원래 단추로 초점 복귀'));
    await PSSyncDiagnosisUI.open(window);select('.sd-inspect').click();await waitFor(function(){return select('.sd-export');});device=screen;
    await waitFor(function(){return select('#sd-title').textContent.includes('자료가 바뀌어');});results.push(check(!select('.sd-export'),'기기 보관본 변경 시 이전 원문 내보내기 차단'));device=originalDevice;select('.pd-x').click();
    await PSSyncDiagnosisUI.open(window);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));results.push(check(!select('#psDiagSheet'),'Esc 닫기'));
    var normal=PSSync.diag,resolvers=[];PSSync.diag=function(){return new Promise(function(resolve){resolvers.push(resolve);});};
    var first=PSSyncDiagnosisUI.open(window),second=PSSyncDiagnosisUI.open(window);await Promise.resolve();var info=await normal();resolvers[1](info);await second;resolvers[0](info);await first;PSSync.diag=normal;
    results.push(check(document.querySelectorAll('#psDiagSheet').length===1,'연속 열기의 늦은 응답으로 창 중복 생성 안 됨'));select('.pd-x').click();
    await PSSyncDiagnosisUI.open(window);select('.sd-inspect').click();await waitFor(function(){return select('.sd-export');});
    document.getElementById('fixture-result').textContent='PASS '+results.length+'\n'+results.join('\n');
    parent.postMessage({type:'storage-fixture-results',results:results},location.origin);
  }
  window.addEventListener('message',function(e){if(e.origin===location.origin&&e.data==='run-storage-checks')run().catch(function(err){document.getElementById('fixture-result').textContent='FAIL '+err.message;parent.postMessage({type:'storage-fixture-results',error:err.message},location.origin);});});
  document.getElementById('fixture-run').onclick=function(){run().catch(function(err){document.getElementById('fixture-result').textContent='FAIL '+err.message;});};
  window.addEventListener('error',function(e){document.getElementById('fixture-result').textContent='ERROR '+e.message;});
  PSSyncDiagnosisUI.open(window);
})();
