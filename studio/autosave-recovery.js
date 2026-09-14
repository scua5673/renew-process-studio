/* Manually opened, read-only access to exact device-local autosave originals. */
(function(root,factory){var api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAutosaveRecoveryUI=api;})(typeof window!=='undefined'?window:null,function(root){
  'use strict';
  var CSS='.psar{width:min(760px,calc(100vw - 28px));max-height:85dvh;padding:0;border:1px solid var(--line,#ddd);border-radius:16px;background:var(--surface,#fff);color:var(--txt,#16191f);font:14px/1.6 Pretendard,system-ui,sans-serif;box-sizing:border-box}.psar::backdrop{background:#0006}.psar *{box-sizing:border-box}.psar-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:15px;padding:18px 20px;background:var(--surface,#fff);border-bottom:1px solid var(--line,#ddd)}.psar h2{font-size:18px;margin:0}.psar-body{padding:18px 20px}.psar p{margin:0 0 12px;overflow-wrap:anywhere}.psar button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--bar2,#f4f5f7);padding:7px 11px;min-height:40px}.psar button:focus-visible,.psar textarea:focus-visible{outline:2px solid var(--blue,#3a6df0);outline-offset:2px}.psar button:disabled{opacity:.5;cursor:default}.psar-list{display:flex;flex-direction:column;gap:8px}.psar-list button{text-align:left;white-space:normal;overflow-wrap:anywhere}.psar small{display:block;font-size:12px;color:var(--dim,#626976)}.psar-raw{display:block;width:100%;min-height:130px;resize:vertical;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;padding:10px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--bar2,#f4f5f7);color:inherit;white-space:pre;overflow:auto}.psar label{display:block;font-weight:700;margin:16px 0 6px}.psar-actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.psar-detail{margin-top:20px;padding-top:16px;border-top:1px solid var(--line,#ddd)}.psar-status{color:var(--dim,#626976);font-size:12px}@media(max-width:600px){.psar-head,.psar-body{padding:14px}.psar button{min-height:44px}.psar-raw{font-size:16px}}';
  function reason(value){return value==='reviewed-local'||value==='reviewed-server'?'직접 선택하기 전의 원문':value==='conflict'||value==='concurrent-edit'?'동시에 바뀐 내용':'자동으로 합치지 못한 내용';}
  function validRow(row){return !!row&&typeof row.id==='string'&&!!row.id&&typeof row.k==='string'&&!!row.k&&typeof row.at==='number'&&Number.isFinite(row.at)&&row.at>=0;}
  function exact(row,value){var m=value&&value.metadata;return validRow(m)&&['id','k','at','cupd','reason','localHash','remoteHash'].every(function(k){return m[k]===row[k];})&&typeof value.localRaw==='string'&&typeof value.remoteRaw==='string';}
  function artifact(row,value){
    if(!exact(row,value))throw new Error('autosave_original_mismatch');
    var metadata={};['id','k','at','cupd','reason','localHash','remoteHash'].forEach(function(k){if(value.metadata[k]!==undefined)metadata[k]=value.metadata[k];});
    if(typeof row.wid==='string')metadata.wid=row.wid;
    return JSON.stringify({type:'process-studio-autosave-recovery',schema:1,metadata:metadata,localRaw:value.localRaw,remoteRaw:value.remoteRaw},null,2);
  }
  function create(options){
    var o=options||{},w=o.window||root,d=w&&w.document;
    if(!w||!d||typeof o.context!=='function'||typeof o.list!=='function'||typeof o.read!=='function')throw new Error('autosave_recovery_configuration_required');
    var dialog=null,body=null,status=null,detail=null,scope=null,generation=0,readTicket=0,timer=null,closed=true,destroyed=false,selected=null,originals=null,urls=[];
    function context(){try{var c=o.context();return typeof c==='string'&&c?c:null;}catch(_){return null;}}
    function node(tag,text,className){var n=d.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
    function current(gen){if(closed||destroyed||gen!==generation)return false;if(!scope||context()!==scope){close();return false;}return true;}
    function close(){
      if(closed)return;closed=true;generation++;readTicket++;scope=null;selected=null;originals=null;
      if(timer!==null){w.clearInterval(timer);timer=null;}
      events.forEach(function(name){w.removeEventListener(name,check);});
      urls.forEach(function(url){try{w.URL.revokeObjectURL(url);}catch(_){}});urls=[];
      if(dialog){dialog.querySelectorAll('textarea').forEach(function(area){area.value='';});try{if(dialog.open)dialog.close();}catch(_){}dialog.replaceChildren();dialog.remove();}
      dialog=null;body=null;detail=null;status=null;
    }
    function check(e){if(e&&((e.type==='ps-auth-state'&&e.detail&&e.detail.unlocked===false)||e.type==='pagehide')){close();return;}current(generation);}
    var events=['ps-auth-state','ps-sync-state','storage','focus','pageshow','pagehide'];
    function message(text,gen){if(current(gen)&&status)status.textContent=text;}
    function named(row){try{return typeof o.label==='function'?String(o.label(row.k)):row.k;}catch(_){return '보관된 자료';}}
    function selectedCurrent(gen,ticket){return current(gen)&&ticket===readTicket&&!!selected&&!!originals;}
    function download(gen,ticket){
      if(!selectedCurrent(gen,ticket))return;
      try{
        var text=artifact(selected,originals),url=w.URL.createObjectURL(new w.Blob([text],{type:'application/json'}));urls.push(url);
        if(!selectedCurrent(gen,ticket)){w.URL.revokeObjectURL(url);return;}
        var a=node('a');a.href=url;a.download='process-studio-preserved-'+selected.id+'.json';dialog.appendChild(a);a.click();a.remove();
        message('두 원문을 담은 백업 파일을 준비했습니다.',gen);
      }catch(_){message('파일을 준비하지 못했습니다. 원문 복사를 이용해 주세요.',gen);}
    }
    function copy(gen,ticket){
      if(!selectedCurrent(gen,ticket))return;
      var text;try{text=artifact(selected,originals);}catch(_){message('원문을 확인하지 못했습니다. 다시 열어 주세요.',gen);return;}
      function fallback(){if(!selectedCurrent(gen,ticket))return;var old=detail.querySelector('[data-psar-copy]');if(old)old.remove();var area=node('textarea',undefined,'psar-raw');area.readOnly=true;area.setAttribute('data-psar-copy','');area.setAttribute('aria-label','두 원문 백업 복사');area.value=text;detail.appendChild(area);area.focus();area.select();var copied=false;try{if(selectedCurrent(gen,ticket))copied=!!d.execCommand('copy');}catch(_){}message(copied?'두 원문을 복사했습니다.':'아래 백업 내용을 선택해 복사해 주세요.',gen);}
      if(!w.navigator.clipboard||!w.navigator.clipboard.writeText){fallback();return;}
      try{Promise.resolve(w.navigator.clipboard.writeText(text)).then(function(){if(selectedCurrent(gen,ticket))message('두 원문을 복사했습니다.',gen);},fallback);}catch(_){fallback();}
    }
    function read(row,gen){
      if(!current(gen))return Promise.resolve();var ticket=++readTicket;selected=null;originals=null;detail.replaceChildren();message('선택한 원문을 읽는 중…',gen);
      return Promise.resolve().then(function(){if(!current(gen)||ticket!==readTicket)return null;return o.read(row);}).then(function(value){
        if(!current(gen)||ticket!==readTicket)return;
        if(!exact(row,value))throw new Error('autosave_original_mismatch');
        selected=row;originals=value;detail.appendChild(node('h3',named(row)));
        detail.appendChild(node('p','보관 당시의 원문입니다. 지금 사용 중인 자료는 바뀌지 않습니다.','psar-status'));
        [['이 기기의 변경 원문',value.localRaw],['당시 서버 원문',value.remoteRaw]].forEach(function(pair){var label=node('label',pair[0]),area=node('textarea',undefined,'psar-raw');area.readOnly=true;area.setAttribute('aria-label',pair[0]);area.value=pair[1];label.appendChild(area);detail.appendChild(label);});
        var actions=node('div',undefined,'psar-actions'),copyButton=node('button','두 원문 복사'),downloadButton=node('button','백업 파일 저장');copyButton.type=downloadButton.type='button';copyButton.setAttribute('data-psar-action','copy');downloadButton.setAttribute('data-psar-action','download');
        copyButton.addEventListener('click',function(){copy(gen,ticket);});downloadButton.addEventListener('click',function(){download(gen,ticket);});actions.appendChild(copyButton);actions.appendChild(downloadButton);detail.appendChild(actions);message('',gen);
      }).catch(function(){if(current(gen)&&ticket===readTicket){selected=null;originals=null;detail.replaceChildren();message('원문을 읽지 못했습니다. 보관 목록에서 다시 선택해 주세요.',gen);}});
    }
    function open(){
      if(destroyed)return Promise.resolve();close();scope=context();if(!scope)return Promise.resolve();closed=false;var gen=++generation;
      if(!d.getElementById('psAutosaveRecoveryStyle')){var style=node('style',CSS);style.id='psAutosaveRecoveryStyle';(d.head||d.documentElement).appendChild(style);}
      dialog=node('dialog',undefined,'psar');dialog.id='psAutosaveRecoveryDialog';dialog.setAttribute('aria-labelledby','psAutosaveRecoveryTitle');
      var opened=dialog;function closeThis(){if(dialog===opened&&generation===gen)close();}
      var head=node('div',undefined,'psar-head'),title=node('h2','보관된 변경'),closeButton=node('button','닫기');title.id='psAutosaveRecoveryTitle';closeButton.type='button';closeButton.addEventListener('click',closeThis);head.appendChild(title);head.appendChild(closeButton);dialog.appendChild(head);
      body=node('div',undefined,'psar-body');body.appendChild(node('p','자동으로 합치지 못한 내용을 이 기기에 따로 보관했습니다. 원문을 확인하고 파일로 저장할 수 있습니다.'));
      status=node('p','목록을 읽는 중…','psar-status');status.setAttribute('role','status');body.appendChild(status);var list=node('div',undefined,'psar-list');list.setAttribute('aria-label','보관된 변경 목록');body.appendChild(list);detail=node('section',undefined,'psar-detail');body.appendChild(detail);dialog.appendChild(body);d.body.appendChild(dialog);
      dialog.addEventListener('cancel',function(e){e.preventDefault();closeThis();});dialog.addEventListener('close',closeThis);
      try{dialog.showModal();}catch(_){close();return Promise.resolve();}
      events.forEach(function(name){w.addEventListener(name,check);});timer=w.setInterval(check,250);
      return Promise.resolve().then(function(){if(!current(gen))return null;return o.list();}).then(function(rows){
        if(!current(gen))return;if(!Array.isArray(rows)||rows.some(function(row){return !validRow(row);}))throw new Error('autosave_list_invalid');
        message(rows.length?'':'보관된 변경이 없습니다.',gen);
        rows.forEach(function(row){var button=node('button');button.type='button';button.setAttribute('data-psar-id',row.id);button.appendChild(node('strong',named(row)));button.appendChild(node('small',new Date(row.at).toLocaleString('ko-KR')+' · '+reason(row.reason)));button.addEventListener('click',function(){read(row,gen);});list.appendChild(button);});
      }).catch(function(){message('보관 목록을 읽지 못했습니다. 창을 닫고 다시 열어 주세요.',gen);});
    }
    return {open:open,close:close,destroy:function(){close();destroyed=true;}};
  }
  return {create:create,artifact:artifact};
});
