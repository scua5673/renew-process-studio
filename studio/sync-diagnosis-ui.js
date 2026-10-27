(function(root,factory){
  'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSSyncDiagnosisUI=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var active=new WeakMap();
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function ago(ts){if(!ts)return '기록 없음';var m=Math.max(0,Math.round((Date.now()-ts)/60000));return m<1?'방금':m<60?m+'분 전':m<1440?Math.round(m/60)+'시간 전':Math.round(m/1440)+'일 전';}
  function mb(n){return (Math.max(0,+n||0)/1048576).toFixed(1)+'MB';}
  function summary(d){
    var n=d.pending.length,held=d.reviewCount||0;
    return '<div class="sd-eyebrow">이 기기의 저장 상태</div><h2 id="sd-title">'+(n?'서버 전송 대기 <span>'+n+'건</span>':'전송 대기 목록이 비어 있어요')+'</h2>'
      +'<p class="sd-lead">'+(n?'내용 확인이 필요한 '+held+'건과 그 밖의 대기 '+(n-held)+'건을 구분했어요.':'이 목록만으로 모든 자료의 서버 저장 완료를 판단할 수는 없어요.')+'</p>'
      +'<div class="sd-meta">'+esc(d.ws||'개인 공간')+' · '+(d.online?'온라인':'오프라인')+' · 마지막으로 받음 '+esc(ago(d.lastPull))+'</div>';
  }
  function blockers(d){return (d.blockers||[]).map(function(b){
    var roster=b.stage==='roster_copies_differ',schedule=b.stage==='schedule_copies_differ';
    return '<div class="sd-cause"><span class="sd-badge">기록된 동기화 중단 원인</span><h3>'+(roster?'선수 명단의 기기 사본 확인이 필요해요':schedule?'일정의 기기 사본 확인이 필요해요':esc(b.text||'동기화가 완료되지 않았어요'))+'</h3><p>'
      +(roster||schedule?'기기 사본이 달라 동기화가 중단된 기록이 있어요. 함께 대기하는 자료의 개별 손상 여부를 뜻하지는 않아요.':'아래 항목들의 개별 오류와 구분해 확인해 주세요.')+'</p></div>';
  }).join('');}
  function pending(d){return '<div class="sd-section"><h3>대기 중인 자료</h3><div class="sd-list">'+d.pending.map(function(r){
    return '<div class="sd-row"><div><strong>'+esc(r.label)+'</strong><p>'+esc(r.text)+'</p></div><span class="sd-tag">'+(r.review?'내용 확인':r.kind==='send'?'전송 기록 확인':'전송 대기')+'</span></div>';
  }).join('')+'</div></div>';}
  function technical(d){return '<details class="sd-technical"><summary>저장 공간·상세 진단</summary><p>빠른 저장 공간 '+mb(d.localBytes)+' · '+(d.largest||[]).map(function(r){return esc(r.label)+' '+mb(r.bytes);}).join(' · ')+'</p>'
    +d.pending.map(function(r){return '<div><b>'+esc(r.label)+'</b>'+[r.push&&('이전 전송: '+r.push.code+' / '+r.push.stage+' · '+r.push.count+'회'),r.round&&('동기화 회차: '+r.round.code+' / '+r.round.stage+' · '+r.round.count+'회')].filter(Boolean).map(function(s){return '<p>'+esc(s)+'</p>';}).join('')+'</div>';}).join('')
    +'<p>회차 수는 이 자료의 저장 실패 횟수가 아니에요.</p>'+(d.recent||[]).map(function(r){return '<div>'+esc(new Date(r.at).toLocaleTimeString()+' · '+r.stage+' · '+(r.code||''))+'</div>';}).join('')+'</details>';}
  var labels={name:'이름',grp:'조',memo:'메모',memos:'메모 목록',levels:'평가값',evalSets:'평가 기록',meetings:'면담 기록',attrs:'평가 항목',positions:'포지션',meta:'설정',type:'구분',_del:'삭제 표시',photo:'사진'};
  function value(v){if(!v.present)return '<span class="sd-missing">항목 없음</span>';var s=typeof v.value==='string'?v.value:JSON.stringify(v.value);return esc(s.length>300?s.slice(0,300)+'… (전체 값은 원문 파일에 포함)':s||'(빈 값)');}
  function fieldRows(rows){return rows.map(function(f){return '<div class="sd-field"><h4>'+esc(labels[f.key]||f.key)+'</h4><div class="sd-values">'+f.values.map(function(v,i){return '<div><span>'+['화면용 사본','기기 보관본','팀 서버본'][i]+'</span><pre>'+value(v)+'</pre></div>';}).join('')+'</div></div>';}).join('');}
  function comparison(s){
    var c=s.comparison,status={absent:'저장된 문서 없음',invalid:'문서 형식 확인 필요',error:'읽기 실패'};
    return '<div class="sd-section sd-comparison"><div class="sd-eyebrow">읽기 전용 비교</div><h3>선수 명단의 세 사본</h3><p class="sd-meta">'+esc(new Date(s.capturedAt).toLocaleString())+'에 읽은 원문 · 선수별 개별 문서와 계정 연결은 이 비교에 포함되지 않아요.</p>'
      +'<div class="sd-sources">'+s.sources.map(function(src,i){var p=c.sources[i];return '<div><span>'+esc(src.label)+'</span><strong>'+(p.status==='valid'?p.roster+'명':esc(status[p.status]||'확인 필요'))+'</strong><small>'+(p.status==='valid'?'후보·삭제 표시 포함 '+p.players+'개 기록':'빈 명단으로 처리하지 않아요')+'</small></div>';}).join('')+'</div>'
      +(!c.complete?'<p class="sd-alert">세 사본을 모두 정상 문서로 확인하지 못해 차이 비교를 중단했어요. 확인한 원문은 파일로 보관할 수 있어요.</p>':c.contentEqual?'<p class="sd-alert">'+(c.rawEqual?'세 사본의 원문이 같아요. 다른 대기 항목의 저장 완료를 뜻하지는 않아요.':'선수·설정 값은 같고 원문의 표현 형식이 달라요. 자동으로 덮어쓰지 않았어요.')+'</p>':'<p class="sd-alert">선수 기록 '+c.players.length+'개 · 문서 설정 '+c.document.length+'개 항목이 달라요. 같은 인원수여도 내용은 다를 수 있어요.</p>')
      +c.players.map(function(p){return '<details class="sd-diff"><summary>'+esc(p.name)+' <span>'+p.fields.length+'개 항목 차이</span></summary>'+fieldRows(p.fields)+'</details>';}).join('')
      +(c.document.length?'<details class="sd-diff"><summary>명단 순서·공통 설정 <span>'+c.document.length+'개 항목 차이</span></summary>'+fieldRows(c.document)+'</details>':'')
      +'<p class="sd-meta">원문 파일에는 선수 이름과 메모가 포함돼요. 내려받은 파일은 안전한 곳에 보관해 주세요.</p><button type="button" class="ps-btn-secondary sd-export">세 사본 원문 내려받기</button></div>';
  }
  function open(win){
    var doc=win.document,previous=doc.activeElement,sync=win.PSSync,closed=false,invalidated=false,host,report=null,timer,checking=false;
    if(active.has(doc))active.get(doc)();active.set(doc,close);
    var old=doc.getElementById('psDiagSheet');if(old&&old.psClose)old.psClose();
    function live(d){try{return !closed&&!invalidated&&(!d||d.current());}catch(_){return false;}}
    function close(){if(closed)return;closed=true;clearInterval(timer);win.removeEventListener('ps-auth-state',auth);doc.removeEventListener('keydown',key);report=null;if(host)host.remove();if(previous&&previous.isConnected&&previous.getClientRects().length)previous.focus();else if(doc.getElementById('gearBtn'))doc.getElementById('gearBtn').focus();}
    function invalidate(){invalidated=true;report=null;if(!host||closed)return;host.querySelector('.sd-content').innerHTML='<h2 id="sd-title">자료가 바뀌어 비교를 닫았어요</h2><p>계정·팀·권한 또는 기기 사본이 바뀌었어요. 창을 닫고 다시 확인해 주세요.</p>';clearInterval(timer);host.querySelector('.pd-x').focus();}
    function auth(e){if(e.detail&&e.detail.unlocked===false)invalidate();}
    function key(e){if(!host||closed)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){var all=Array.from(host.querySelectorAll('button:not(:disabled),summary,a[href]')).filter(function(el){return el.getClientRects().length;});if(!all.length)return;var first=all[0],last=all[all.length-1];if(!host.contains(doc.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus();return;}if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus();}}}
    return Promise.resolve().then(function(){return sync.diag();}).then(function(d){
      if(!live(d))return;
      host=doc.createElement('div');host.id='psDiagSheet';host.psClose=close;
      host.innerHTML='<div class="pd-scrim"></div><div id="psDiagCard" class="pd-card sd-card" role="dialog" aria-modal="true" aria-labelledby="sd-title"><div class="sd-closebar"><button type="button" class="pd-x" aria-label="닫기">×</button></div><div class="sd-content">'+summary(d)+blockers(d)+
        '<div class="sd-actions">'+(d.canInspect===false?'':'<button type="button" class="ps-btn-primary sd-inspect">선수 명단 사본 비교</button>')+'<button type="button" class="ps-btn-secondary sd-review">보관된 변경 확인</button></div><p class="sd-help">사본 비교는 자료를 읽기만 해요. 원본 선택과 복구는 확인 후 진행해요.</p><div class="sd-result" aria-live="polite"></div>'+pending(d)+technical(d)+
        '<div class="sd-footer"><button type="button" class="ps-btn-text sd-refresh">상태 다시 확인</button><button type="button" class="ps-btn-text sd-sync">지금 주고받기</button></div></div></div>';
      doc.body.appendChild(host);doc.addEventListener('keydown',key);win.addEventListener('ps-auth-state',auth);
      host.querySelector('.pd-x').onclick=close;host.querySelector('.pd-scrim').onclick=close;host.querySelector('.pd-x').focus();
      host.querySelector('.sd-refresh').onclick=function(){close();open(win);};
      host.querySelector('.sd-sync').onclick=function(){close();sync.syncNow('diag');};
      host.querySelector('.sd-review').onclick=function(){close();if(win.PSDataReview)win.PSDataReview.open();};
      var inspectButton=host.querySelector('.sd-inspect');if(inspectButton)inspectButton.onclick=function(){
        var button=this,result=host.querySelector('.sd-result');button.disabled=true;result.textContent='세 사본의 원문을 읽고 있어요…';
        Promise.resolve().then(function(){if(!live(d))throw Error();return sync.inspectRosterCopies();}).then(function(r){
          if(!live(d)||!live(r))return;report=r;result.innerHTML=comparison(r.snapshot);
          result.querySelector('.sd-export').onclick=function(){var b=this;b.disabled=true;
            r.check().then(function(){if(!live(d)||!live(r))throw Error();var blob=new win.Blob([JSON.stringify(r.snapshot,null,2)],{type:'application/json'}),url=win.URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download='process-studio-roster-copies-'+new Date(r.snapshot.capturedAt).toISOString().slice(0,10)+'.json';a.click();win.setTimeout(function(){win.URL.revokeObjectURL(url);},1000);b.disabled=false;}).catch(invalidate);
          };
        }).catch(function(){if(!live(d))return;result.textContent='사본을 확인하지 못했어요. 온라인 상태와 팀 자료 접근 권한을 확인한 뒤 다시 눌러 주세요. 자료가 바뀌는 중일 때도 비교를 중단해요.';}).finally(function(){if(live(d))button.disabled=false;});
      };
      var tick=0;timer=win.setInterval(function(){
        if(!live(d)||(report&&!live(report))){invalidate();return;}
        if(report&&!checking&&++tick%8===0){checking=true;var r=report;r.check().catch(function(){if(report===r)invalidate();}).finally(function(){checking=false;});}
      },250);
    }).catch(function(){if(!closed)win.alert('진단을 읽지 못했어요. 로그인과 팀 선택을 확인한 뒤 다시 열어 주세요.');});
  }
  function install(win){
    var doc=win.document,b=doc.getElementById('psDiagOpen');if(!b)return;
    function line(){if(!win.PSSync)return;win.PSSync.diag().then(function(d){var el=doc.getElementById('psDiagLine');if(!el||!d.current())return;el.textContent=(d.online?'':'오프라인 · ')+'마지막 받음 '+ago(d.lastPull)+' · '+(d.pending.length?'전송 대기 '+d.pending.length+'건':'전송 대기 목록 없음');}).catch(function(){});}
    b.addEventListener('click',function(){open(win);});line();win.setInterval(line,60000);
    doc.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#gearWrap'))win.setTimeout(line,150);});
  }
  return {install:install,open:open,summary:summary,comparison:comparison};
});
