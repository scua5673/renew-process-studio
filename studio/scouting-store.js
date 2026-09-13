/* Candidate identity and board placements share one executive-only document.
   Pure reconciliation is also used by sync when an older client saves players only. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PSScoutStore=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var KEY='cs_scout_targets_v1', MAXLEN=1500000, BASIC=['name','num','foot','club','grade'];
  var own=function(o,k){return Object.prototype.hasOwnProperty.call(o||{},k);};
  var obj=function(x){return !!x&&typeof x==='object'&&!Array.isArray(x);};
  var copy=function(x){return x==null?x:JSON.parse(JSON.stringify(x));};
  var same=function(a,b){return JSON.stringify(a)===JSON.stringify(b);};
  function safe(k){return typeof k==='string'&&k.length>0&&k!=='__proto__'&&k!=='constructor'&&k!=='prototype';}
  function valid(d){
    if(!obj(d)||(d.v!=null&&d.v!==1)||!Array.isArray(d.players))return false;
    var seen=new Set();
    if(!d.players.every(function(p){
      if(!obj(p)||!safe(p.id)||seen.has(p.id)||p.type&&p.type!=='target'||p.dbId!=null&&p.dbId!==''&&!safe(p.dbId))return false;seen.add(p.id);
      if(p.profile&&(!obj(p.profile)||!Object.keys(p.profile).every(safe)))return false;
      return !p._scoutRef||(obj(p._scoutRef)&&safe(p._scoutRef.id)&&(!p.dbId||p._scoutRef.id==='db:'+p.dbId));
    }))return false;
    if(!own(d,'scoutRegistry'))return true;
    var r=d.scoutRegistry;
    return obj(r)&&r.v===1&&obj(r.candidates)&&obj(r.meta)&&(!r.meta.pointSets||Array.isArray(r.meta.pointSets))&&Object.keys(r.candidates).every(function(k){
      var c=r.candidates[k];return safe(k)&&obj(c)&&c.id===k&&obj(c.info)&&(!c.info.profile||(obj(c.info.profile)&&Object.keys(c.info.profile).every(safe)))&&(!c.variants||Array.isArray(c.variants))&&(!c.edits||obj(c.edits))&&(!c.points||obj(c.points))&&(!c.ratings||obj(c.ratings));
    });
  }
  function idOf(p){return p&&p._scoutRef&&p._scoutRef.id||(p&&p.dbId?'db:'+p.dbId:'target:'+(p&&p.id||''));}
  function infoOf(p){var v={};BASIC.forEach(function(k){v[k]=p[k]==null?'':copy(p[k]);});v.profile=copy(p.profile||{});return v;}
  function variants(c,field,value,source){
    if(value===undefined||same(value,get(c.info,field)))return;
    c.variants=c.variants||[];
    if(!c.variants.some(function(x){return x.field===field&&same(x.value,value);}))c.variants.push({field:field,value:copy(value),source:source||'이전 기록'});
  }
  function get(o,path){return path.split('.').reduce(function(a,k){return a==null?undefined:a[k];},o);}
  function put(o,path,value){var ks=path.split('.');if(!ks.every(safe))throw new Error('지원하지 않는 후보 항목입니다.');var last=ks.pop(),v=o;ks.forEach(function(k){if(!obj(v[k]))v[k]={};v=v[k];});v[last]=copy(value);}
  function fields(info){var f=BASIC.slice();Object.keys(info&&info.profile||{}).filter(safe).forEach(function(k){f.push('profile.'+k);});return f;}
  function union(a,b){var out=copy(a||[]);(b||[]).forEach(function(x){if(!out.some(function(v){return same(v,x);}))out.push(copy(x));});return out;}
  function stampCmp(a,b){return (+a.at||0)-(+b.at||0)||String(a.id||'').localeCompare(String(b.id||''));}
  function mergeCandidate(a,b){
    if(!a)return copy(b);if(!b)return copy(a);
    var c=copy(a);c.info=c.info||{};c.edits=c.edits||{};
    if(c.scoreHistory||b.scoreHistory)c.scoreHistory=union(c.scoreHistory,b.scoreHistory);if(c.sourceHistory||b.sourceHistory)c.sourceHistory=union(c.sourceHistory,b.sourceHistory);
    (b.variants||[]).forEach(function(x){variants(c,x.field,x.value,x.source);});
    Array.from(new Set(fields(b.info||{}).concat(Object.keys(b.edits||{}).filter(function(f){var a=f.split('.');return a.length===2&&a[0]==='profile'&&safe(a[1]);})))).forEach(function(f){
      var x=get(b.info,f),old=get(c.info,f),be=b.edits&&b.edits[f],ae=c.edits[f];
      if(be&&(!ae||stampCmp(be,ae)>0)){put(c.info,f,x);variants(c,f,old,'이전 원본');c.edits[f]=copy(be);}
      else if((old==null||old==='')&&!ae){put(c.info,f,x);}
      else if(!same(old,x))variants(c,f,x,'다른 기기의 기록');
    });
    ['points','ratings'].forEach(function(k){
      c[k]=c[k]||{};Object.keys(b[k]||{}).filter(safe).forEach(function(f){
        var sk=k+'.'+f,be=b.edits&&b.edits[sk],ae=c.edits[sk];
        if(!own(c[k],f)||(be&&(!ae||stampCmp(be,ae)>0))){
          if(own(c[k],f)&&!same(c[k][f],b[k][f])){c.scoreHistory=c.scoreHistory||[];if(!c.scoreHistory.some(function(h){return h.kind===k&&h.key===f&&same(h.value,c[k][f]);}))c.scoreHistory.push({kind:k,key:f,value:c[k][f]});}
          c[k][f]=copy(b[k][f]);if(be)c.edits[sk]=copy(be);
        }else if(!same(c[k][f],b[k][f])){c.scoreHistory=c.scoreHistory||[];if(!c.scoreHistory.some(function(h){return h.kind===k&&h.key===f&&same(h.value,b[k][f]);}))c.scoreHistory.push({kind:k,key:f,value:copy(b[k][f])});}
      });
    });
    if(b.sourceEdit&&(!c.sourceEdit||stampCmp(b.sourceEdit,c.sourceEdit)>0)){if(c.source&&!same(c.source,b.source))c.sourceHistory=union(c.sourceHistory,[c.source]);c.source=copy(b.source);c.sourceEdit=copy(b.sourceEdit);}
    else if(b.source&&!c.source)c.source=copy(b.source);
    else if(b.source&&c.source&&!same(b.source,c.source))c.sourceHistory=union(c.sourceHistory,[b.source]);
    if(b.archiveEdit&&(!c.archiveEdit||stampCmp(b.archiveEdit,c.archiveEdit)>0)){c.archiveEdit=copy(b.archiveEdit);c.archivedAt=b.archivedAt||0;}
    return c;
  }
  function reconcile(previous,incoming){
    if(!valid(incoming))throw new Error('후보 자료 형식을 확인할 수 없습니다.');
    if(previous!=null&&!valid(previous))throw new Error('기존 후보 자료 형식을 확인할 수 없습니다.');
    var d=copy(incoming),pr=previous&&previous.scoutRegistry,ir=d.scoutRegistry;
    var reg={v:1,candidates:{},meta:copy(pr&&pr.meta||ir&&ir.meta||{}),metaHistory:union(pr&&pr.metaHistory,ir&&ir.metaHistory),placementHistory:{}};
    Object.keys(pr&&pr.placementHistory||{}).filter(safe).forEach(function(id){reg.placementHistory[id]=copy(pr.placementHistory[id]);});
    Object.keys(ir&&ir.placementHistory||{}).filter(safe).forEach(function(id){reg.placementHistory[id]=union(reg.placementHistory[id],ir.placementHistory[id]);});
    Object.keys(pr&&pr.candidates||{}).forEach(function(id){reg.candidates[id]=copy(pr.candidates[id]);});
    Object.keys(ir&&ir.candidates||{}).forEach(function(id){reg.candidates[id]=mergeCandidate(reg.candidates[id],ir.candidates[id]);});
    if(ir&&ir.meta){
      var pe=pr&&pr.metaEdit,ie=ir.metaEdit;
      if(!pr||(ie&&(!pe||stampCmp(ie,pe)>0))){
        if(pr&&!same(pr.meta,ir.meta)){if(!reg.metaHistory.some(function(x){return same(x,pr.meta);}))reg.metaHistory.push(copy(pr.meta));}
        reg.meta=copy(ir.meta);reg.metaEdit=copy(ie);
      }else{reg.metaEdit=copy(pe);if(!same(pr.meta,ir.meta)&&!reg.metaHistory.some(function(x){return same(x,ir.meta);}))reg.metaHistory.push(copy(ir.meta));}
    }else if(pr){reg.metaEdit=copy(pr.metaEdit);}
    /* Registry clients express removal with explicit hidden/archive stamps, never
       by omitting an ID they may not have received. Only a players-only legacy
       winner uses omission as a deletion; preserve that record as hidden. */
    var incomingIds=new Set();d.players.forEach(function(p){incomingIds.add(p.id);});
    (previous&&previous.players||[]).forEach(function(p){if(!incomingIds.has(p.id)){var q=copy(p);if(!ir)q._scoutHidden=true;d.players.push(q);}});
    d.players.forEach(function(p){
      var prior=(previous&&previous.players||[]).find(function(q){return q.id===p.id;});
      function observation(q){var x={};Object.keys(q).filter(function(k){return BASIC.indexOf(k)<0&&['id','type','profile','_scoutRef'].indexOf(k)<0;}).sort().forEach(function(k){x[k]=copy(q[k]);});return x;}
      if(prior){
        var before=observation(prior),after=observation(p);
        if(!same(before,after)){reg.placementHistory[p.id]=reg.placementHistory[p.id]||[];if(!reg.placementHistory[p.id].some(function(x){return same(x,before);}))reg.placementHistory[p.id].push(before);}
        if((prior._scoutHidden||prior._scoutMove)&&(!p._scoutMove||(prior._scoutMove&&stampCmp(prior._scoutMove,p._scoutMove)>0))){
          ['posId','posName','sbSeat','_scoutHidden','_scoutMove'].forEach(function(k){if(own(prior,k))p[k]=copy(prior[k]);else delete p[k];});
          if(!same(before,after)&&!reg.placementHistory[p.id].some(function(x){return same(x,after);}))reg.placementHistory[p.id].push(after);
          var applied=observation(p);if(!same(before,after)&&!reg.placementHistory[p.id].some(function(x){return same(x,applied);}))reg.placementHistory[p.id].push(applied);
        }
      }
      var id=idOf(p),c=reg.candidates[id];
      if(!c){c={id:id,info:infoOf(p),points:{},ratings:{},variants:[],edits:{}};reg.candidates[id]=c;}
      else fields(infoOf(p)).forEach(function(f){var val=get(infoOf(p),f);if(!same(val,get(c.info,f)))variants(c,f,val,'다른 배치의 기록');});
      if(prior&&idOf(prior)===id)fields(infoOf(prior)).forEach(function(f){var val=get(infoOf(prior),f);if(!same(val,get(c.info,f)))variants(c,f,val,'이전 배치의 기본정보');});
      p.type='target';p._scoutRef={id:id,base:{}};
      BASIC.forEach(function(k){p[k]=copy(c.info[k]||'');p._scoutRef.base[k]=copy(p[k]);});
      p.profile=copy(c.info.profile||{});
      /* Photos live once in the private candidate registry. Old clients keep the
         text compatibility mirror; current clients resolve the photo by ID. */
      if(own(p.profile,'photo')){delete p.profile.photo;p._scoutRef.profilePhoto=true;}
      if(c.archivedAt)p._scoutHidden=true;
    });
    d.scoutRegistry=reg;return copy(d);
  }
  function edit(d,id,field,value,stamp){var c=d.scoutRegistry.candidates[id];if(!c)throw new Error('후보를 찾을 수 없습니다.');if(same(get(c.info,field),value))return;var before=get(c.info,field);put(c.info,field,value);variants(c,field,before,'수정 전');c.edits=c.edits||{};c.edits[field]=copy(stamp);}
  function score(d,id,key,value,stamp){var c=d.scoutRegistry.candidates[id];if(!c)throw new Error('후보를 찾을 수 없습니다.');if(!safe(key)||!Number.isInteger(value)||value<0||value>5)throw new Error('점수 형식을 확인해 주세요.');c.points=c.points||{};if(own(c.points,key)&&c.points[key]!==value){c.scoreHistory=c.scoreHistory||[];var prior={kind:'points',key:key,value:c.points[key]};if(!c.scoreHistory.some(function(x){return same(x,prior);}))c.scoreHistory.push(prior);}c.points[key]=value;c.edits=c.edits||{};c.edits['points.'+key]=copy(stamp);}
  function archive(d,id,at,stamp){var c=d.scoutRegistry.candidates[id];if(!c)throw new Error('후보를 찾을 수 없습니다.');c.archivedAt=at;c.archiveEdit=copy(stamp);d.players.forEach(function(p){if(idOf(p)===id){p._scoutHidden=!!at;p._scoutMove=copy(stamp);}});}
  function importLegacy(d,legacy,ids,includeMeta){
    if(!obj(legacy)||!Array.isArray(legacy.players))throw new Error('이 기기의 후보 자료를 읽을 수 없습니다.');
    var reg=d.scoutRegistry;
    legacy.players.filter(function(p){return ids.indexOf(p.id)>=0;}).forEach(function(p){
      var id='db:'+p.id,info={name:p.nameKr||p.nameEn||'',num:p.num||'',foot:p.foot||'',club:p.club||p.formerClub||'',grade:p.grade||'',profile:{}};
      ['nameEn','nat','height','weight','photo'].forEach(function(k){if(p[k])info.profile[k]=copy(p[k]);});
      if(p.year)info.profile.dob=String(p.year);if(p.bio)info.profile.career=p.bio;
      var c={id:id,info:info,points:copy(p.points||{}),ratings:copy(p.ratings||{}),source:copy(p),variants:[],edits:{}};
      reg.candidates[id]=mergeCandidate(reg.candidates[id],c);
    });
    if(includeMeta){
      var source=copy(legacy.meta||{});reg.metaHistory=reg.metaHistory||[];
      if(!reg.metaHistory.some(function(x){return same(x,source);}))reg.metaHistory.push(source);
      reg.meta.pointSets=reg.meta.pointSets||[];
      (source.pointSets||[]).forEach(function(set){if(!reg.meta.pointSets.some(function(x){return same(x,set);}))reg.meta.pointSets.push(copy(set));});
    }
    return d;
  }
  function project(d,p,onEdit){
    var id=idOf(p),current=function(){return (typeof d==='function'?d():d).scoutRegistry.candidates[id];};if(!current())return p;
    BASIC.forEach(function(k){Object.defineProperty(p,k,{configurable:true,enumerable:true,get:function(){return current().info[k]||'';},set:function(v){onEdit(id,k,v);}});});
    var pf=new Proxy({},{get:function(o,k){return (current().info.profile||{})[k];},ownKeys:function(){return Object.keys(current().info.profile||{});},getOwnPropertyDescriptor:function(){return {enumerable:true,configurable:true};},set:function(o,k,v){onEdit(id,'profile.'+k,v);return true;},deleteProperty:function(o,k){onEdit(id,'profile.'+k,undefined);return true;}});
    Object.defineProperty(p,'profile',{configurable:true,enumerable:true,get:function(){return pf;},set:function(v){Object.keys(v||{}).forEach(function(k){onEdit(id,'profile.'+k,v[k]);});}});
    return p;
  }
  function parsePoints(text){var sections=[],cur={name:'',qs:[]};String(text||'').split(/\r?\n/).forEach(function(s){s=s.trim();if(!s)return;if(s.indexOf('##')===0){if(cur.qs.length)sections.push(cur);cur={name:s.replace(/^#+\s*/,''),qs:[]};}else cur.qs.push(s.replace(/^[-*·]\s*/,''));});if(cur.qs.length)sections.push(cur);return sections;}
  function context(win,requireReady){
    var ls=win.localStorage,s=JSON.parse(ls.getItem('ps_sync_session')||'null'),wid=ls.getItem('ps_active_ws'),seal=ls.getItem('ps_cache_owner_v1'),owner=JSON.parse(seal||'null');
    var ws=JSON.parse(ls.getItem('ps_ws_list')||'[]').find(function(w){return w.id===wid;});
    var sync=win.PSSync;try{var host=win;for(var i=0;i<4&&!sync;i++){if(host.parent===host)break;host=host.parent;sync=host.PSSync;}}catch(_){}
    var perms=win.PSPerms,role=perms&&perms.role&&perms.role();
    if(!s||!s.uid||!wid||!owner||owner.uid!==s.uid||owner.wid!==wid||!ws||ws.kind!=='team'||
      !sync||!sync.dataUnlocked||!sync.dataUnlocked()||!sync.keyReady||(requireReady!==false&&!sync.keyReady(KEY,wid))||
      !perms||!perms.canEdit||!perms.canEdit('scout')||(role!=='executive'&&role!=='admin'))throw new Error('팀의 후보 자료와 권한을 확인 중입니다.');
    return JSON.stringify([wid,s.uid,seal]);
  }
  function createClient(win){
    var state={doc:null,raw:undefined,owner:null,verified:false,pending:null},counter=0;
    function stamp(){return {at:Date.now(),id:Math.random().toString(36).slice(2)+'-'+(++counter)};}
    function read(){
      var owner=context(win),raw=win.localStorage.getItem(KEY);
      if(state.owner!==owner||state.raw!==raw||!state.doc){
        state.owner=owner;state.raw=raw;state.doc=reconcile(null,raw==null?{v:1,players:[]}:JSON.parse(raw));state.verified=false;
      }
      return state.doc;
    }
    function prepare(){
      read();var owner=state.owner,raw=state.raw;
      if(!win.PSStorage||!win.PSStorage.sharedReady||!win.PSStorage.sharedVerified)return Promise.reject(new Error('기기 저장소를 확인할 수 없습니다.'));
      return win.PSStorage.sharedReady(KEY).then(function(){
        if(raw!=null)return win.PSStorage.sharedVerified(KEY,raw);
        return win.storage.get(KEY).then(function(v){if(v&&v.value)throw new Error('후보 저장소가 서로 다릅니다.');});
      }).then(function(){if(context(win)!==owner||win.localStorage.getItem(KEY)!==raw)throw new Error('후보 자료가 바뀌었습니다. 다시 열어 주세요.');state.verified=true;return state.doc;});
    }
    function check(){if(!state.doc||!state.verified||context(win)!==state.owner||win.localStorage.getItem(KEY)!==state.raw)throw new Error('후보 자료가 갱신되었습니다. 다시 열어 주세요.');}
    function save(doc){
      check();var next=reconcile(state.doc,doc),raw=JSON.stringify(next),owner=state.owner;
      if(raw.length>MAXLEN){state.doc=reconcile(null,state.raw==null?{v:1,players:[]}:JSON.parse(state.raw));throw new Error('후보 자료가 저장 한도를 넘었습니다. 방금 추가한 사진이나 가져올 자료를 줄여 다시 시도해 주세요. 기존 저장은 그대로 있습니다.');}
      if(!win.psSaveShared||!win.psSaveShared(KEY,raw))throw new Error('후보 자료를 저장하지 못했습니다.');
      state.doc=next;state.raw=raw;
      var p=win.PSStorage.sharedReady(KEY).then(function(){
        /* Sync may temporarily close keyReady after this write was accepted.
           Completion verifies the admitted owner's current exact draft, while
           check() still requires keyReady before every subsequent mutation. */
        if(context(win,false)!==owner)throw new Error('팀이 바뀌어 저장 확인을 중단했습니다.');
        var expected=state.raw;if(win.localStorage.getItem(KEY)!==expected)throw new Error('후보 저장 확인 중 자료가 바뀌었습니다.');
        return win.PSStorage.sharedVerified(KEY,expected).then(function(){
          if(context(win,false)!==owner||win.localStorage.getItem(KEY)!==expected)throw new Error('후보 저장 확인 중 팀이나 자료가 바뀌었습니다.');
        });
      });state.pending=p;p.catch(function(){if(state.owner===owner&&state.pending===p)state.verified=false;});return p;
    }
    function retry(){var owner=state.owner,raw=state.raw;if(context(win,false)!==owner||win.localStorage.getItem(KEY)!==raw)return Promise.reject(new Error('후보 자료가 바뀌어 이전 저장을 다시 쓰지 않습니다.'));return win.PSStorage.sharedVerified(KEY,raw).then(function(){if(context(win,false)!==owner||win.localStorage.getItem(KEY)!==raw)throw new Error('후보 저장 확인 중 팀이나 자료가 바뀌었습니다.');state.verified=true;return true;});}
    return {read:read,prepare:prepare,check:check,save:save,retry:retry,stamp:stamp,state:state};
  }
  return {KEY:KEY,MAXLEN:MAXLEN,BASIC:BASIC,valid:valid,idOf:idOf,copy:copy,reconcile:reconcile,edit:edit,score:score,archive:archive,importLegacy:importLegacy,project:project,parsePoints:parsePoints,context:context,createClient:createClient};
});
