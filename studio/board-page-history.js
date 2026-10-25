/* Page names/order share the board's chronological undo stack. No page bodies are cloned. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSBoardPageHistory=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';var bound=null;
 function create(api,env){
  var ids=new WeakMap(),seq=0,single='',wasSingle=false;
  function next(){return 'page-'+(++seq);}
  function state(){var s=api.get(),p=s.pages;if(!p){single=single||next();wasSingle=true;return {pages:null,idx:0,keys:[single]};}
   if(wasSingle&&p[0]&&!ids.has(p[0]))ids.set(p[0],single);wasSingle=false;
   return {pages:p,idx:s.idx,keys:p.map(function(page){if(!ids.has(page))ids.set(page,next());return ids.get(page);})};}
  function bind(keys){var s=api.get();if(!Array.isArray(keys))return;if(!s.pages){single=keys[0]||next();wasSingle=true;return;}s.pages.forEach(function(p,i){if(keys[i])ids.set(p,keys[i]);});wasSingle=false;}
  function mark(e){if(env.safe()){var s=state();e._ph={scope:env.scope(),page:s.keys[s.idx]};}return e;}
  function metadata(){var s=state();if(!s.pages)return null;return mark({_pm:{order:s.keys.slice(),names:s.pages.map(function(p){return typeof p.name==='string'?p.name:null;})}});}
  function trim(a){if(a.length>50)a.shift();}
  function record(){if(!env.safe())return false;var e=metadata();if(!e)return false;var stacks=api.stacks();stacks[0].push(e);trim(stacks[0]);stacks[1].length=0;if(env.touch)env.touch();return true;}
  function apply(e){var s=state(),m=e._pm;if(!s.pages||s.keys.length!==m.order.length||m.names.length!==m.order.length)return false;
   var seen={},order=[];for(var i=0;i<m.order.length;i++){var k=m.order[i],at=s.keys.indexOf(k);if(at<0||seen[k])return false;seen[k]=true;order.push(s.pages[at]);}
   var idx=m.order.indexOf(e._ph.page);if(idx<0)return false;
   order.forEach(function(p,i){if(m.names[i]===null)delete p.name;else p.name=m.names[i];});api.set(order,idx);return true;}
  function step(redo,legacy){var stacks=api.stacks(),from=stacks[redo?1:0],to=stacks[redo?0:1],e=from[from.length-1];if(!e||!e._ph)return legacy();
   if(!env.safe()||e._ph.scope!==env.scope())return false;var s=state(),at=s.keys.indexOf(e._ph.page);if(at<0)return false;
   if(at!==s.idx)api.go(at);
   if(!e._pm)return legacy();var opposite=metadata();if(!opposite||!apply(e))return false;from.pop();to.push(opposite);trim(to);if(env.toast)env.toast(redo?'다시 실행 ↪':'되돌렸습니다 ↩');return true;}
  return {tag:mark,record:record,step:step,safe:env.safe,keys:function(){return state().keys.slice();},bind:bind};
 }
 function mount(win,api){if(win.__psPageHistory)return win.__psPageHistory;
  var body=win.document.body,editor=null;
  // Activating a short tab moves its controls under the second click. That
  // click belongs to the tab double-click, not delete/duplicate/rename controls.
  body.addEventListener('click',function(e){if(e.detail>1&&e.target.closest&&e.target.closest('#boardPageStrip .bpx')){e.preventDefault();e.stopPropagation();}},true);
  function scope(){var uid='',wid='';try{var S=win.parent.PSSync,s=S&&S.session();uid=String(s&&s.uid||'');wid=String(S&&S.activeWs()||'');}catch(_){}return uid+'|'+(win.__vaultEdit?wid+'|vault:'+String(win.__curVaultId||''): 'live');}
  function safe(){var c=body.classList;return (win.__csView||'board')==='board'&&!api.get().lent&&!win.__vaultReadOnly&&!win.__vaultBook&&!win.__animExport&&!c.contains('editing')&&!c.contains('meet-mode')&&!c.contains('ps-capturing')&&!c.contains('comm-viewing');}
  var controller=create(api,{safe:safe,scope:scope,toast:function(m){if(win.toast)win.toast(m);},touch:function(){try{_boardUserTouched=true;}catch(_){}}});bound=controller;win.__psPageHistory=controller;
  ['undoLast','redoLast'].forEach(function(name,i){var previous=win[name];win[name]=function(){var self=this,args=arguments;return controller.step(!!i,function(){return previous.apply(self,args);});};});
  // This private context is used only when a vault borrows the work canvas. It
  // crosses JSON cloning, so carry tiny IDs with it rather than serializing IDs into pages.
  var pages=win.__psPages,capture=pages.captureContext,restore=pages.restoreContext;
  pages.captureContext=function(){var result=capture.apply(this,arguments);result._pageHistoryIds=controller.keys();return result;};
  pages.restoreContext=function(c){var result=restore.apply(this,arguments);if(c)controller.bind(c._pageHistoryIds);return result;};
  function put(saved){var stacks=api.stacks();stacks[0].length=0;stacks[1].length=0;if(saved&&saved.scope===scope()){Array.prototype.push.apply(stacks[0],saved.undo);Array.prototype.push.apply(stacks[1],saved.redo);}}
  ['openEditor','openLibDrawEditor'].forEach(function(name){var previous=win[name];if(typeof previous!=='function')return;win[name]=function(){var saved=null;if(!body.classList.contains('editing')&&!editor){var stacks=api.stacks();saved={scope:scope(),undo:stacks[0].slice(),redo:stacks[1].slice()};editor=saved;}
    function entered(){if(saved&&saved===editor){if(saved.scope!==scope()){editor=null;return;}if(body.classList.contains('editing'))put(null);else{put(saved);editor=null;}}}
    var result;try{result=previous.apply(this,arguments);}catch(e){if(saved===editor){put(saved);editor=null;}throw e;}if(result&&typeof result.then==='function')return result.then(function(v){entered();return v;},function(e){entered();throw e;});entered();return result;};});
  var close=win.closeEditor;win.closeEditor=function(){var result=close.apply(this,arguments);if(editor&&!body.classList.contains('editing')){put(editor);editor=null;}return result;};
  return controller;
 }
 return {create:create,mount:mount,tag:function(e){return bound?bound.tag(e):e;},record:function(){return !!(bound&&bound.record());},keep:function(){return !!(bound&&bound.safe());}};
});
