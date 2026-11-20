/* 시즌별 선수단(사용자 11/21 «3학년들 졸업으로 체크해서 남기게» → «시즌별로 선수구성» → 목업 C안).
   졸업은 지우기가 아니라 선수에게 붙는 표시 하나: p.grad={season:'2026',at:ms}. 선수 객체 · 선수별 행(sq:<id>) · 삭제 기록은 그대로다 —
   명단에서 옮기거나 지우면 동기화가 살아 있는 행을 되살리거나(삭제 기록 없이) 영영 지운 선수가 된다(삭제 기록과 함께).
   시즌은 같은 선수단 문서의 meta.season={cur:'2027',past:[{id:'2026',at,rows:[{id,name,num,pos,grp,year,grad}]}]} — 새 저장 키 없음.
   지난 시즌 줄은 그날의 이름 · 번호 · 포지션 · 조 · 학년만(평가는 선수 객체에 한 벌). 이 파일은 셈만 한다 — 저장은 부른 쪽의 원래 길(save). */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PSRosterSeason=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var PAST_MAX=8,FUTURE_MAX=6,YEARS=['1','2','3'];
  function isGrad(p){return !!(p&&p.grad&&typeof p.grad==='object');}
  function ours(p){return !!p&&p.type!=='target';}
  function active(list){return (list||[]).filter(function(p){return ours(p)&&!isGrad(p);});}
  function grads(list){return (list||[]).filter(function(p){return ours(p)&&isGrad(p);});}
  function okSeason(v){return /^\d{4}$/.test(String(v||''));}
  /* 시즌을 한 번도 넘기지 않은 팀: 1~6월이면 지난해가 «지금 시즌»(새 시즌을 아직 시작하지 않았다), 7월부터는 그해 */
  function current(meta,now){var s=meta&&meta.season;if(s&&okSeason(s.cur))return String(s.cur);var d=new Date(now==null?Date.now():now);return String(d.getMonth()<6?d.getFullYear()-1:d.getFullYear());}
  function next(cur){return String(+cur+1);}
  function yearOf(p){var y=String(p&&p.schoolYear==null?'':p.schoolYear);return YEARS.indexOf(y)>=0?y:'';}
  function past(meta){var s=meta&&meta.season;return s&&Array.isArray(s.past)?s.past.filter(function(x){return x&&okSeason(x.id)&&Array.isArray(x.rows);}):[];}
  /* 미리 만든 시즌(사용자 11/21 «2028, 2029, 2030 미리 만들어 놓을 수 있게») — meta.season.future=['2028',…], 지금 시즌보다 뒤인 해만 · 오름차순 */
  function future(meta,now){var s=meta&&meta.season,cur=+current(meta,now),seen={};return (s&&Array.isArray(s.future)?s.future:[]).map(String).filter(function(id){if(!okSeason(id)||+id<=cur||seen[id])return false;seen[id]=1;return true;}).sort();}
  function seasonBase(meta,now){var s=meta&&meta.season,o={};if(s&&typeof s==='object')Object.keys(s).forEach(function(k){o[k]=s[k];});o.cur=current(meta,now);o.past=past(meta);return o;}
  /* 가장 먼 시즌의 다음 해를 하나 만든다 — 만든 시즌 id, 못 만들면 '' */
  function addFuture(doc,now){if(!doc)return '';doc.meta=doc.meta||{};var list=future(doc.meta,now),cur=current(doc.meta,now);if(list.length>=FUTURE_MAX)return '';
    var id=String(+(list.length?list[list.length-1]:cur)+1),o=seasonBase(doc.meta,now);o.future=list.concat([id]);doc.meta.season=o;return id;}
  function removeFuture(doc,id,now){if(!doc||!doc.meta)return false;var list=future(doc.meta,now),at=list.indexOf(String(id));if(at<0)return false;var o=seasonBase(doc.meta,now);list.splice(at,1);o.future=list;doc.meta.season=o;return true;}
  /* 예상 명단 — 미리 만든 시즌에 지금 선수가 몇 학년인지(저장하지 않는 셈). 3학년을 넘으면 그 전에 졸업, 학년 없음은 그대로 */
  function project(players,meta,id,now){var k=+id-+current(meta,now),rows=[],gone=0;if(!(k>0))return {rows:rows,gone:0,ahead:0};
    active(players).filter(function(p){return p.manual===true||String(p.name||'').trim();}).forEach(function(p){var y=yearOf(p);if(y&&+y+k>3){gone++;return;}rows.push({p:p,from:y,year:y?String(+y+k):''});});
    return {rows:rows,gone:gone,ahead:k};}
  function pastOf(meta,id){return past(meta).filter(function(x){return String(x.id)===String(id);})[0]||null;}
  function leanRow(p,posOf,gradNow){var r={id:String(p.id),name:String(p.name||'').trim().slice(0,40),num:String(p.num==null?'':p.num).slice(0,4),pos:String(posOf?posOf(p)||'':'').slice(0,8),grp:String(p.grp||'').trim().slice(0,40),year:yearOf(p)};if(gradNow)r.grad=1;return r;}
  /* 넘기기 계획. opts.keep = 그대로 둘 선수 id 들(유급 · 전학), opts.years = {'3':false} 처럼 끈 학년은 통째로 그대로 */
  function plan(players,meta,opts){
    opts=opts||{};var keep={},on=opts.years||{},cur=current(meta,opts.now),list=active(players).filter(function(p){return p.manual===true||String(p.name||'').trim();});
    (opts.keep||[]).forEach(function(id){keep[String(id)]=1;});
    var out={cur:cur,next:next(cur),total:list.length,grad:[],up:[],stay:[],by:{'3':[],'2':[],'1':[],'':[]}};
    list.forEach(function(p){var y=yearOf(p),id=String(p.id);out.by[y].push(p);
      if(!y||on[y]===false||keep[id]){out.stay.push(id);return;}
      if(y==='3')out.grad.push(id);else out.up.push({id:id,from:y,to:String(+y+1)});});
    out.after=out.total-out.grad.length;return out;
  }
  function byId(players){var m={};(players||[]).forEach(function(p){if(p)m[String(p.id)]=p;});return m;}
  /* 넘긴다 — 선수 객체와 meta 를 그 자리에서 고치고, 되돌릴 값을 돌려준다. 못 넘기면 null(아무것도 안 고침) */
  function apply(doc,pl,opts){
    opts=opts||{};if(!doc||!Array.isArray(doc.players)||!pl||!okSeason(pl.cur)||!okSeason(pl.next))return null;
    var now=opts.now==null?Date.now():opts.now,m=byId(doc.players),gradSet={},ok=true;
    pl.grad.forEach(function(id){var p=m[id];if(!p||!ours(p)||isGrad(p))ok=false;gradSet[id]=1;});
    pl.up.forEach(function(u){var p=m[u.id];if(!p||!ours(p)||isGrad(p)||yearOf(p)!==u.from)ok=false;});
    if(!ok)return null;
    doc.meta=doc.meta||{};
    var before=doc.meta.season===undefined?undefined:JSON.parse(JSON.stringify(doc.meta.season)),undo={season:before,had:doc.meta.season!==undefined,grad:pl.grad.slice(),up:pl.up.map(function(u){return {id:u.id,from:u.from,to:u.to};}),cur:pl.cur,next:pl.next};
    var rows=active(doc.players).filter(function(p){return p.manual===true||String(p.name||'').trim();}).map(function(p){return leanRow(p,opts.posOf,gradSet[String(p.id)]);});
    var olds=past(doc.meta).filter(function(x){return String(x.id)!==pl.cur;});olds.push({id:pl.cur,at:now,rows:rows});
    var ns=seasonBase(doc.meta,now);ns.cur=pl.next;ns.past=olds.slice(-PAST_MAX);if(Array.isArray(ns.future))ns.future=ns.future.map(String).filter(function(id){return okSeason(id)&&+id>+pl.next;});doc.meta.season=ns;
    pl.grad.forEach(function(id){m[id].grad={season:pl.cur,at:now};});
    pl.up.forEach(function(u){m[u.id].schoolYear=u.to;});
    return undo;
  }
  /* 되돌린다 — 넘긴 뒤 그 선수의 그 값이 그대로일 때만 그 선수를 돌린다(그 사이 사람이 고친 값은 둔다). 돌린 수 */
  function revert(doc,undo){
    if(!doc||!Array.isArray(doc.players)||!undo)return 0;var m=byId(doc.players),n=0;
    undo.grad.forEach(function(id){var p=m[id];if(p&&isGrad(p)&&String(p.grad.season)===undo.cur){delete p.grad;n++;}});
    undo.up.forEach(function(u){var p=m[u.id];if(p&&yearOf(p)===u.to){p.schoolYear=u.from;n++;}});
    doc.meta=doc.meta||{};
    if(doc.meta.season&&String(doc.meta.season.cur)===undo.next){if(undo.had)doc.meta.season=undo.season;else delete doc.meta.season;}
    return n;
  }
  /* 손으로 졸업 표시(시즌 중 한 명이 떠날 때) · 현재 명단으로 되돌리기 — 고친 선수 id 들 */
  function graduate(doc,ids,opts){opts=opts||{};var m=byId(doc&&doc.players),cur=current(doc&&doc.meta,opts.now),now=opts.now==null?Date.now():opts.now,done=[];
    (ids||[]).forEach(function(id){var p=m[String(id)];if(p&&ours(p)&&!isGrad(p)){p.grad={season:cur,at:now};done.push(String(id));}});return done;}
  function restore(doc,ids){var m=byId(doc&&doc.players),done=[];(ids||[]).forEach(function(id){var p=m[String(id)];if(p&&ours(p)&&isGrad(p)){delete p.grad;done.push(String(id));}});return done;}
  /* 시즌 고르개: 지금 시즌 · 지난 시즌들(새것 먼저) · 졸업생 전체 */
  function scopes(players,meta,now){var cur=current(meta,now),g=grads(players).length,list=[];
    past(meta).forEach(function(x){list.push({id:'past:'+x.id,season:String(x.id),label:x.id+' 시즌',n:x.rows.length,past:true});});
    list.push({id:'cur',season:cur,label:cur+' 시즌',n:active(players).filter(function(p){return p.manual===true||String(p.name||'').trim();}).length,now:true});
    future(meta,now).forEach(function(id){list.push({id:'future:'+id,season:id,label:id+' 시즌',n:project(players,meta,id,now).rows.length,future:true});});
    if(g)list.push({id:'grad',season:'',label:'졸업생 전체',n:g});return list;}
  return {isGrad:isGrad,active:active,grads:grads,current:current,next:next,yearOf:yearOf,past:past,pastOf:pastOf,future:future,addFuture:addFuture,removeFuture:removeFuture,project:project,FUTURE_MAX:FUTURE_MAX,leanRow:leanRow,plan:plan,apply:apply,revert:revert,graduate:graduate,restore:restore,scopes:scopes,PAST_MAX:PAST_MAX};
});
