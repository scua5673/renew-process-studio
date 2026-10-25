/* Library originals and recovery. No reads or writes run merely by loading this file. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSLibraryRecovery=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 var TOP={thumb:1,_teamSharePending:1,_teamSharedAt:1,_teamSource:1,_teamOwner:1};
 function privateCopy(item){var out=JSON.parse(JSON.stringify(item));Object.keys(TOP).forEach(function(k){delete out[k];});return out;}
 // Hash only media values, without cloning or concatenating large picture strings.
 // Items without media keep their existing fingerprint and need no migration upload.
 function mediaHash(item){var h=2166136261,n=0,seen=[];
  function add(s){for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}h^=255;h=Math.imul(h,16777619);}
  function walk(v,path,key){if(typeof v==='string'){if(/^(?:data:(?:image|video)\/|psblob:)/i.test(v)||/^(photo|image|video|logo|avatar|dataurl|thumbRef|emblemRef)$/i.test(key)){n++;add(path);add(v);}return;}
   if(!v||typeof v!=='object'||seen.indexOf(v)>=0)return;seen.push(v);Object.keys(v).forEach(function(k){if(v===item&&TOP[k])return;walk(v[k],path+'/'+k,k);});seen.pop();}
  walk(item,'','');return n?':'+(h>>>0).toString(36):'';
 }
 function archiveRows(rpc,wid,rows,current){return rows.reduce(function(p,row){return p.then(function(){current();return rpc('ps_library_archive_conflict_v1',{p_wid:wid,p_lib_id:row.lib_id,p_snapshot:row},current).then(function(result){current();if(!result||result.preserved!==true||!result.id)throw new Error('보관함의 충돌 원문을 확인하지 못해 기기 사본을 유지했어요');});});},Promise.resolve());}
 function client(options){
  function context(){var s=options.session(),wid=String(options.workspace()||'');if(!s||!s.uid||!wid||!options.unlocked())throw new Error('로그인한 보관함에서 복구를 열어 주세요');return {uid:String(s.uid),wid:wid,owner:options.capture?options.capture():null};}
  function request(name,args,c){function check(){if(options.current)options.current(c.owner);var now=context();if(now.uid!==c.uid||now.wid!==c.wid)throw new Error('복구 중 계정이나 작업 공간이 바뀌었어요');}return options.rpc(name,args,check).then(function(result){check();return result;});}
  return {
   list:function(){return Promise.resolve().then(function(){var c=context();return request('ps_library_history_list_v1',{p_wid:c.wid,p_limit:30},c);});},
   get:function(id){return Promise.resolve().then(function(){var c=context();return request('ps_library_history_get_v1',{p_wid:c.wid,p_id:id},c).then(function(rows){return rows&&rows[0]||null;});});},
   restore:function(id,requestId){return Promise.resolve().then(function(){var c=context();return request('ps_library_restore_copy_v1',{p_wid:c.wid,p_id:id,p_request_id:requestId},c).then(function(result){if(!result||!result.restored||!result.lib_id)throw new Error('복구 저장을 확인하지 못했어요');if(options.sync)options.sync('library-recovery');return result;});});}
  };
 }
 function mount(win){
  var doc=win.document,frame=doc.getElementById('fBoard');if(!frame||frame.__psLibraryRecovery)return;frame.__psLibraryRecovery=true;
  function service(){var S=win.PSSync;return S&&S.libraryRecovery;}
  var observer=null;function install(){try{var d=frame.contentDocument,head=d&&d.querySelector('#sessionView .df-head');if(!head){if(d&&d.documentElement&&!observer){observer=new win.MutationObserver(install);observer.observe(d.documentElement,{childList:true,subtree:true});}return;}if(observer){observer.disconnect();observer=null;}if(d.getElementById('psLibraryRecoveryOpen'))return;var b=d.createElement('button');b.id='psLibraryRecoveryOpen';b.type='button';b.className='btn';b.textContent='복구';b.title='내 보관함 기록 · 새 자료로 복구';b.onclick=function(){open(b);};head.appendChild(b);}catch(_){} }
  function open(returnFocus){
   if(doc.getElementById('psLibraryRecoveryDialog'))return;
   var api=service();if(!api)return;
   var overlay=doc.createElement('div');overlay.id='psLibraryRecoveryDialog';overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#0006;display:grid;place-items:center;padding:16px';
   var panel=doc.createElement('section');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','psLibraryRecoveryTitle');panel.style.cssText='width:min(560px,100%);max-height:80dvh;overflow:auto;background:var(--bar,#14161A);color:var(--txt,#fff);border:1px solid var(--line,#444);border-radius:12px;padding:20px;box-sizing:border-box';
   var title=doc.createElement('h2');title.id='psLibraryRecoveryTitle';title.textContent='내 보관함 복구';panel.appendChild(title);
   var help=doc.createElement('p');help.textContent='내가 만든 자료의 이전 내용과 동시 편집 사본입니다. 복구하면 원래 자료를 유지하고 새 비공개 자료를 만듭니다.';panel.appendChild(help);
   var status=doc.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.appendChild(status);
   var list=doc.createElement('div');panel.appendChild(list);
   var close=doc.createElement('button');close.type='button';close.className='btn';close.textContent='닫기';panel.appendChild(close);
   var blocked=[],openUid='',openWid='';try{var ss=win.PSSync.session();openUid=String(ss&&ss.uid||'');openWid=String(win.PSSync.activeWs()||'');}catch(_){}
   function current(){try{return overlay.isConnected&&win.PSSync.dataUnlocked()&&String((win.PSSync.session()||{}).uid||'')===openUid&&String(win.PSSync.activeWs()||'')===openWid;}catch(_){return false;}}
   function dismiss(){doc.removeEventListener('keydown',keys,true);win.removeEventListener('ps-sync-state',changed);blocked.forEach(function(x){x.el.inert=x.inert;});overlay.remove();try{if(returnFocus&&returnFocus.isConnected)returnFocus.focus();}catch(_){} }
   function changed(){if(!current())dismiss();}
   function keys(e){if(e.key==='Escape'){e.preventDefault();dismiss();return;}if(e.key!=='Tab')return;var items=Array.from(panel.querySelectorAll('button:not(:disabled)'));if(!items.length)return;var first=items[0],last=items[items.length-1];if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus();}}
   close.onclick=dismiss;overlay.addEventListener('click',function(e){if(e.target===overlay)dismiss();});
   Array.from(doc.body.children).forEach(function(el){blocked.push({el:el,inert:!!el.inert});el.inert=true;});overlay.appendChild(panel);doc.body.appendChild(overlay);doc.addEventListener('keydown',keys,true);win.addEventListener('ps-sync-state',changed);close.focus();status.textContent='기록을 확인하는 중…';
   api.list().then(function(rows){if(!current())return;status.textContent=rows.length?'복구할 기록을 골라 주세요.':'아직 복구 기록이 없습니다. 이 기능이 설치된 뒤 바뀐 자료부터 기록됩니다.';
    rows.forEach(function(row){var line=doc.createElement('div');line.style.cssText='border-top:1px solid var(--line,#ddd);padding:12px 0';var name=doc.createElement('b');name.textContent=row.name||'자료';line.appendChild(name);var info=doc.createElement('p');info.textContent=new Date(row.created_at).toLocaleString()+' · '+(row.kind==='conflict'?'동시 편집 사본':row.kind==='delete'?'삭제 전 내용':'이전 내용');line.appendChild(info);
     var b=doc.createElement('button');b.type='button';b.className='btn';b.textContent='새 자료로 복구';var requestId=null;
     b.onclick=function(){if(!current())return;requestId=requestId||win.crypto.randomUUID();b.disabled=true;status.textContent='원문과 사진을 확인해 새 자료로 복구하는 중…';api.restore(row.id,requestId).then(function(){if(!current())return;status.textContent='새 비공개 자료로 복구했어요. 보관함에서 ‘복구’가 붙은 자료를 확인하세요.';b.textContent='복구됨';},function(e){if(!current())return;b.disabled=false;status.textContent='복구하지 못했어요. 원본은 유지됩니다. '+'계정과 팀, 인터넷 연결을 확인하고 다시 시도해 주세요.';});};line.appendChild(b);list.appendChild(line);});
   },function(e){if(current())status.textContent='기록을 열지 못했어요. '+'계정과 팀, 인터넷 연결을 확인하고 다시 시도해 주세요.';});
  }
  frame.addEventListener('load',function(){if(observer){observer.disconnect();observer=null;}install();});install();
 }
 if(typeof window!=='undefined'&&window.document){if(window.document.readyState==='loading')window.document.addEventListener('DOMContentLoaded',function(){mount(window);});else mount(window);}
 return {privateCopy:privateCopy,mediaHash:mediaHash,archiveRows:archiveRows,client:client,mount:mount};
});
