(function(root,factory){
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PSRosterRecovery=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var PREFIX='ps_roster_keep_v2:',DAY=86400000,own=Function.call.bind(Object.prototype.hasOwnProperty);
  function object(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
  function copy(x){return JSON.parse(JSON.stringify(x));}
  function id(x){return x&&typeof x.id==='string'&&x.id.trim()?x.id:'';}
  function named(x){return !!(object(x)&&id(x)&&String(x.name||'').trim());}
  function ours(x){return named(x)&&x.type!=='target'&&!x._del;}
  function scope(c){if(!c||!c.uid||!c.wid)throw new Error('명단의 계정과 팀을 확인할 수 없습니다.');return {uid:String(c.uid),wid:String(c.wid)};}
  function key(c){var s=scope(c);return PREFIX+encodeURIComponent(s.uid)+':'+encodeURIComponent(s.wid);}
  function archive(raw,c){
    var s=scope(c);if(raw==null)return {v:2,uid:s.uid,wid:s.wid,entries:{}};
    var d=typeof raw==='string'?JSON.parse(raw):copy(raw);
    if(!object(d)||d.v!==2||d.uid!==s.uid||d.wid!==s.wid||!object(d.entries))throw new Error('이 보관 자료의 팀을 확인할 수 없습니다.');
    Object.keys(d.entries).forEach(function(k){var e=d.entries[k];if(!object(e)||!ours(e.p)||id(e.p)!==k||!Number.isFinite(e.at)||e.at<=0)throw new Error('명단 보관 자료를 읽을 수 없습니다. 원본은 그대로 남아 있습니다.');});
    if(d.pendingRestore){var p=d.pendingRestore;if(!object(p)||!Array.isArray(p.ids)||!p.ids.length||new Set(p.ids).size!==p.ids.length||p.ids.some(function(k){return typeof k!=='string'||!own(d.entries,k);})||!Number.isFinite(p.at)||p.at<=0)throw new Error('복구 진행 기록을 확인할 수 없습니다. 보관 원본은 그대로 남아 있습니다.');}
    return d;
  }
  function main(raw){
    var d=typeof raw==='string'?JSON.parse(raw):copy(raw);
    if(!object(d)||!Array.isArray(d.players)||!Array.isArray(d.attrs)||!Array.isArray(d.positions))throw new Error('현재 명단을 확인할 수 없습니다.');
    var seen=new Set();d.players.forEach(function(p){if(!object(p)||!id(p)||seen.has(id(p)))throw new Error('현재 명단의 선수 식별 정보를 확인해야 합니다.');seen.add(id(p));});
    return d;
  }
  function tombs(raw){
    var d=raw==null?{}:(typeof raw==='string'?JSON.parse(raw):copy(raw));
    if(!object(d))throw new Error('선수 삭제 기록을 확인할 수 없습니다.');
    Object.keys(d).forEach(function(k){if(!Number.isFinite(d[k])||d[k]<=0)throw new Error('선수 삭제 기록을 확인할 수 없습니다.');});return d;
  }
  function capture(raw,doc,c,now){
    var d=archive(raw,c),m=main(doc);now=now||Date.now();var seen=new Set();
    m.players.forEach(function(p){if(!ours(p))return;seen.add(p.id);var e=d.entries[p.id];
      if(own(d.entries,p.id)&&e&&JSON.stringify(e.p)===JSON.stringify(p)&&now-e.at<DAY)return;
      Object.defineProperty(d.entries,p.id,{value:{at:now,p:copy(p)},enumerable:true,writable:true,configurable:true});});
    var pending=new Set(d.pendingRestore?d.pendingRestore.ids:[]);
    Object.keys(d.entries).forEach(function(k){if(!seen.has(k)&&!pending.has(k)&&now-d.entries[k].at>30*DAY)delete d.entries[k];});return d;
  }
  function rows(raw,doc,deleted,itemRows,c,now){
    var d=archive(raw,c),m=main(doc),ts=tombs(deleted),present=new Set(m.players.map(id)),items={},pending=new Set(d.pendingRestore?d.pendingRestore.ids:[]);now=now||Date.now();
    if(!Array.isArray(itemRows))throw new Error('선수별 저장 자료를 확인할 수 없습니다.');
    itemRows.forEach(function(row){if(!row||!row.id||!object(row.p)||own(items,row.id))throw new Error('선수별 저장 자료를 확인할 수 없습니다.');Object.defineProperty(items,row.id,{value:row.p,enumerable:true});});
    return Object.keys(d.entries).filter(function(k){return !present.has(k)&&(pending.has(k)||now-d.entries[k].at<=30*DAY);}).map(function(k){
      var e=d.entries[k],item=own(items,k)?items[k]:null,status=own(ts,k)||item&&item._del?'deleted':item?'current-item':'missing';
      return {id:k,p:copy(e.p),at:e.at,status:status};
    }).sort(function(a,b){return b.at-a.at||a.id.localeCompare(b.id);});
  }
  function plan(raw,doc,deleted,itemRows,c,ids,now){
    if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw new Error('복구할 선수를 선택해 주세요.');
    var available=rows(raw,doc,deleted,itemRows,c,now),selected=ids.map(function(k){var row=available.find(function(x){return x.id===k;});
      if(!row||row.status!=='missing')throw new Error('명단이나 삭제 기록이 바뀌었습니다. 목록을 다시 확인해 주세요.');return row;});
    var result=main(doc);selected.forEach(function(row){result.players.push(copy(row.p));});return {doc:result,players:selected.map(function(x){return copy(x.p);})};
  }
  function canonical(v){if(Array.isArray(v))return v.map(canonical);if(!object(v))return v;var out={};Object.keys(v).sort().forEach(function(k){Object.defineProperty(out,k,{value:canonical(v[k]),enumerable:true});});return out;}
  function assertAligned(doc,deleted,itemRows){
    var m=main(doc),ts=tombs(deleted),by=new Map(m.players.filter(ours).map(function(p){return [p.id,p];}));
    function fail(){throw new Error('선수별 명단과 현재 명단을 아직 맞추지 못했어요. 동기화 상태를 확인한 뒤 다시 시도해 주세요.');}
    if(!Array.isArray(itemRows))fail();
    by.forEach(function(p,k){if(own(ts,k))fail();});
    itemRows.forEach(function(r){if(!r||!object(r.p))fail();if(r.p._del){if(by.has(r.id))fail();return;}
      if(!by.has(r.id)||JSON.stringify(canonical(by.get(r.id)))!==JSON.stringify(canonical(r.p)))fail();});
    return true;
  }
  function sameSnapshot(a,b){return !!(a&&b&&a.owner===b.owner&&a.raw===b.raw&&a.deleted===b.deleted&&a.itemsRaw===b.itemsRaw&&a.keep===b.keep);}
  return {prefix:PREFIX,key:key,archive:archive,main:main,tombs:tombs,capture:capture,rows:rows,plan:plan,assertAligned:assertAligned,sameSnapshot:sameSnapshot};
});
