/* Serialize phase links with the board library's existing writer and owner fence. */
window.PSPlaybookLink=function(req,requester,prepare){
          var owner=localStorage.getItem('ps_active_ws')||'',uid=(PSSync.session()||{}).uid,seal=localStorage.getItem('ps_cache_owner_v1'),epoch=localStorage.getItem('ps_ws_switch_epoch_v1');
          var ack=function(ok,message){try{requester.postMessage({source:'app',type:'playbookLinkResult',requestId:req.requestId,ok:ok,message:message||''},location.origin);}catch(_){}};
          var guard=function(){if(seal!==localStorage.getItem('ps_cache_owner_v1')||epoch!==localStorage.getItem('ps_ws_switch_epoch_v1')||owner!==(localStorage.getItem('ps_active_ws')||'')||uid!==(PSSync.session()||{}).uid||!PSSync.dataUnlocked()||!window.PSPerms||!PSPerms.canEdit('board'))throw new Error('팀 또는 편집 권한이 바뀌었습니다.');};
          try{guard();prepare(function(){
            var w=document.getElementById('fBoard').contentWindow;
            if(!w||typeof w.libTurn!=='function'){ack(false,'보관함을 준비하지 못했습니다. 다시 시도해 주세요.');return;}
            w.libTurn(async function(){guard();var list=await w.libGet();guard();
              var item=list.find(function(x){return (x.libId||x.id)===req.libId;});
              if(!item||typeof w.canEditItem!=='function'||!w.canEditItem(item))throw new Error('이 훈련을 수정할 권한이 없습니다.');
              var gm=JSON.parse(localStorage.getItem('cs_gamemodel_v1')||'null'),hit=PSPlaybookData.phase(gm||{},req.phase);
              PSPlaybookData.linkDrill(list,{libId:req.libId,phase:req.phase,name:(hit.m.name||hit.m.key)+' › '+hit.p.name,remove:!!req.remove});
              guard();await w.libWrite(list);guard();w.libTouch();
            }).then(function(){ack(true);},function(err){ack(false,err.message||'연결을 저장하지 못했습니다.');});
          });}catch(err){ack(false,err.message);}
};
window.PSPlaybookPanel=function(frame,panel,active){
  function send(){if(active())frame.contentWindow.postMessage({source:'app',type:'playbookPanel',panel:panel},location.origin);}
  if(frame.contentDocument&&frame.contentDocument.getElementById('pbStructure'))send();
  else frame.addEventListener('load',send,{once:true});
};

window.PSPlaybookTermTools=function(frame,ready){
  window.__termsFrom='playbook';
  ready(frame,function(){frame.contentWindow.postMessage({source:'app',type:'termsBackLabel',label:'플레이북'},location.origin);},100);
};
