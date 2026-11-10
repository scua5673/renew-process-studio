/* Page names/order share the board's chronological undo stack. No page bodies are cloned.
   3.271 — 페이지 추가 · 복제 · 삭제도 같은 기록에(제보 1bc9b7d4). board.html 의 add · dup · del 은 묶음을 바꾼 뒤 clearHistory(1) 을 부른다 —
   mount 가 __clearBoardHistory 를 감싸, 마지막으로 본 묶음(last)과 견줘 «한 장이 늘었거나 줄었을 때»만 기록을 비우는 대신 한 줄을 적는다(structure).
   그 밖(미팅 세트 · 새 문서 · 보관함 · 패턴북 …)은 예전처럼 비운다. 지운 페이지는 그 객체를 기록(_pp)이 들고 있다가 제자리에 다시 끼운다. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSBoardPageHistory=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';var bound=null;
 function create(api,env){
  var ids=new WeakMap(),seq=0,single='',wasSingle=false,last=null;
  function next(){return 'page-'+(++seq);}
  function state(){var s=api.get(),p=s.pages;if(!p){single=single||next();wasSingle=true;return {pages:null,idx:0,keys:[single]};}
   if(wasSingle&&p[0]&&!ids.has(p[0]))ids.set(p[0],single);wasSingle=false;
   return {pages:p,idx:s.idx,keys:p.map(function(page){if(!ids.has(page))ids.set(page,next());return ids.get(page);})};}
  function bind(keys){var s=api.get();if(!Array.isArray(keys))return;if(!s.pages){single=keys[0]||next();wasSingle=true;return;}s.pages.forEach(function(p,i){if(keys[i])ids.set(p,keys[i]);});wasSingle=false;}
  function sync(){var s=state();last={keys:s.keys.slice(),idx:s.idx,pages:s.pages?s.pages.slice():null};return s;}
  function names(pages){return pages.map(function(p){return typeof p.name==='string'?p.name:null;});}
  function mark(e){if(env.safe()){var s=sync();e._ph={scope:env.scope(),page:s.keys[s.idx]};}return e;}
  function metadata(){var s=state();if(!s.pages)return null;return mark({_pm:{order:s.keys.slice(),names:names(s.pages)}});}
  // 한 장이 늘거나(추가 · 복제 — 새 장이 지금 페이지) 줄었을 때만 적는다. 적는 것 = 바꾸기 전 묶음(order · names) · 그때 보던 페이지(cur) · 지운 페이지 객체(_pp).
  function structure(){var b=last,s=state();if(!env.safe()||!b||!s.pages)return false;
   var added=s.keys.filter(function(k){return b.keys.indexOf(k)<0;}),gone=b.keys.filter(function(k){return s.keys.indexOf(k)<0;}),held={},byKey={};
   var same=function(x,y){return x.length===y.length&&x.every(function(k,i){return k===y[i];});};
   if(added.length===1&&!gone.length){if(s.keys[s.idx]!==added[0]||!same(s.keys.filter(function(k){return k!==added[0];}),b.keys))return false;}
   else if(gone.length===1&&!added.length){var at=b.keys.indexOf(gone[0]);if(!b.pages||!b.pages[at]||!same(b.keys.filter(function(k){return k!==gone[0];}),s.keys))return false;held[gone[0]]=b.pages[at];}
   else return false;
   s.keys.forEach(function(k,i){byKey[k]=s.pages[i];});
   var e={_ph:{scope:env.scope(),page:s.keys[s.idx]},_pm:{order:b.keys.slice(),names:names(b.keys.map(function(k){return byKey[k]||held[k];})),cur:b.keys[b.idx]||b.keys[0]},_pp:held};
   var stacks=api.stacks();stacks[0].push(e);trim(stacks[0]);stacks[1].length=0;if(env.touch)env.touch();sync();return true;}
  // 되돌릴 때 반대쪽 기록: 지금 묶음 · 지금 보는 페이지 · 이번에 빠질 페이지 객체
  function reverse(e){var s=state(),held={};if(!s.pages)return null;s.keys.forEach(function(k,i){if(e._pm.order.indexOf(k)<0)held[k]=s.pages[i];});
   return {_ph:{scope:env.scope(),page:e._pm.cur},_pm:{order:s.keys.slice(),names:names(s.pages),cur:s.keys[s.idx]},_pp:held};}
  function trim(a){if(a.length>50)a.shift();}
  function record(){if(!env.safe())return false;var e=metadata();if(!e)return false;var stacks=api.stacks();stacks[0].push(e);trim(stacks[0]);stacks[1].length=0;if(env.touch)env.touch();return true;}
  function apply(e){var s=state(),m=e._pm,held=e._pp||{};if(!s.pages||(!m.cur&&s.keys.length!==m.order.length)||m.names.length!==m.order.length)return false;
   var seen={},order=[];for(var i=0;i<m.order.length;i++){var k=m.order[i],at=s.keys.indexOf(k),page=at>=0?s.pages[at]:(m.cur?held[k]:null);if(!page||typeof page!=='object'||seen[k])return false;seen[k]=true;order.push(page);}
   var idx=m.order.indexOf(m.cur||e._ph.page),here=m.order.indexOf(s.keys[s.idx]),now=s.keys.indexOf(m.cur);if(idx<0||(m.cur&&now<0&&here<0))return false;
   // 빠질 페이지를 보고 있으면 먼저 돌아갈 페이지로 옮긴다(go 가 지금 판을 그 페이지 객체에 담는다 — 다시 실행 때 그대로 돌아온다)
   if(m.cur&&now>=0&&now!==s.idx)api.go(now);
   order.forEach(function(p,i){ids.set(p,m.order[i]);if(m.names[i]===null)delete p.name;else p.name=m.names[i];});
   if(m.cur&&now<0){api.set(order,here);api.go(idx);}else api.set(order,idx);return true;}
  function step(redo,legacy){var stacks=api.stacks(),from=stacks[redo?1:0],to=stacks[redo?0:1],e=from[from.length-1];if(!e||!e._ph)return legacy();
   if(!env.safe()||e._ph.scope!==env.scope())return false;var s=state(),at=s.keys.indexOf(e._ph.page);if(at<0)return false;
   if(at!==s.idx)api.go(at);
   if(!e._pm)return legacy();var opposite=e._pm.cur?reverse(e):metadata();if(!opposite||!apply(e))return false;from.pop();to.push(opposite);trim(to);sync();if(env.toast)env.toast(redo?'다시 실행 ↪':'되돌렸습니다 ↩');return true;}
  return {tag:mark,record:record,step:step,safe:env.safe,keys:function(){return state().keys.slice();},bind:function(keys){bind(keys);sync();},sync:sync,structure:structure,keep:function(){sync();return env.safe();}};
 }
 function mount(win,api){if(win.__psPageHistory)return win.__psPageHistory;
  var body=win.document.body,editor=null;
  // Activating a short tab moves its controls under the second click. That
  // click belongs to the tab double-click, not delete/duplicate/rename controls.
  body.addEventListener('click',function(e){if(e.detail>1&&e.target.closest&&e.target.closest('#boardPageStrip .bpx')){e.preventDefault();e.stopPropagation();}},true);
  function scope(){var uid='',wid='';try{var S=win.parent.PSSync,s=S&&S.session();uid=String(s&&s.uid||'');wid=String(S&&S.activeWs()||'');}catch(_){}return uid+'|'+(win.__vaultEdit?wid+'|vault:'+String(win.__curVaultId||''): 'live');}
  function safe(){var c=body.classList;return (win.__csView||'board')==='board'&&!api.get().lent&&!win.__vaultReadOnly&&!win.__vaultBook&&!win.__animExport&&!c.contains('editing')&&!c.contains('meet-mode')&&!c.contains('ps-capturing')&&!c.contains('comm-viewing');}
  var controller=create(api,{safe:safe,scope:scope,toast:function(m){if(win.toast)win.toast(m);},touch:function(){try{_boardUserTouched=true;}catch(_){}}});bound=controller;win.__psPageHistory=controller;
  // 3.271 — 묶음을 바꾼 뒤의 «기록 비우기»: 추가 · 복제 · 삭제(k===1)이고 안전한 한 장 차이면 비우지 않고 적는다. 그 밖엔 예전처럼 비우고 지금 묶음을 기억한다.
  var clear=win.__clearBoardHistory;win.__clearBoardHistory=function(k){if(k===1&&controller.structure())return;var result=typeof clear==='function'?clear.apply(this,arguments):undefined;controller.sync();return result;};
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
 return {create:create,mount:mount,tag:function(e){return bound?bound.tag(e):e;},record:function(){return !!(bound&&bound.record());},keep:function(){return !!(bound&&bound.keep());}};
});
