(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PSAdminData=api;})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function current(check){if(check&&!check())throw Error('administrator view changed');}
  async function rpcRows(request,name,args,order,check){
    // These functions return one JSON array value, rather than a SQL row set.
    // PostgREST range/order parameters cannot paginate inside that scalar.
    if(name==='ps_admin_people'||name==='ps_admin_content_owners'){
      current(check);var value=await request('rpc/'+name,{method:'POST',body:JSON.stringify(args||{})});
      current(check);if(!Array.isArray(value))throw Error('invalid '+name+' response');return value;
    }
    var rows=[],offset=0,seen=new Set();
    for(;;){
      current(check);
      var batch=await request('rpc/'+name+'?order='+encodeURIComponent(order)+'&limit=500&offset='+offset,{method:'POST',body:JSON.stringify(args||{})});
      current(check);if(!Array.isArray(batch))throw Error('invalid '+name+' response');
      if(!batch.length)return rows;
      for(var row of batch){var key=JSON.stringify(row);if(seen.has(key))throw Error(name+' pagination did not advance');seen.add(key);rows.push(row);}
      if(rows.length>20000)throw Error(name+' 조회 상한 초과 · 기간이나 범위를 줄여 주세요');
      offset+=batch.length;
    }
  }
  async function events(request,days,limit,check){
    var now=Date.now(),since=new Date(now-days*86400000).toISOString(),until=new Date(now).toISOString(),rows=[],cursor=null;
    for(;;){
      current(check);
      var q='ps_events?select=id,event_name,feature,device,app_version,created_at,user_id,status'
        +'&created_at=gte.'+encodeURIComponent(since)+'&created_at=lte.'+encodeURIComponent(until)
        +'&order=created_at.desc,id.desc&limit='+Math.min(500,limit+1-rows.length);
      if(cursor)q+='&or='+encodeURIComponent('(created_at.lt.'+cursor.created_at+',and(created_at.eq.'+cursor.created_at+',id.lt.'+cursor.id+'))');
      var batch=await request(q);current(check);
      if(!Array.isArray(batch))throw Error('invalid event response');
      if(!batch.length)return {rows:rows,capped:false,since:since,until:until,checkedAt:new Date().toISOString()};
      var last=batch[batch.length-1];
      if(!/^\d+$/.test(String(last.id))||!Number.isFinite(Date.parse(last.created_at)))throw Error('invalid event cursor');
      if(cursor&&(last.created_at>cursor.created_at||last.created_at===cursor.created_at&&Number(last.id)>=Number(cursor.id)))throw Error('event cursor did not advance');
      rows=rows.concat(batch);if(rows.length>limit)return {rows:rows.slice(0,limit),capped:true,since:since,until:until,checkedAt:new Date().toISOString()};cursor=last;
    }
  }
  function latest(row){return Math.max(0,Date.parse(row.last_activity)||0,Date.parse(row.last_kv)||0,Date.parse(row.last_lib)||0);}
  function sortWorkspaces(rows){return rows.slice().sort(function(a,b){return latest(b)-latest(a)||String(a.id).localeCompare(String(b.id));});}
  function workspaces(activity,library,people){
    var counts=new Map(),owners=new Map();
    if(Array.isArray(library))library.forEach(function(l){if(!l.deleted_at)counts.set(l.workspace_id,(counts.get(l.workspace_id)||0)+1);});
    (people||[]).forEach(function(p){(p.teams||[]).forEach(function(t){if(t.owner===true)owners.set(t.workspace_id,p);});});
    return sortWorkspaces(activity).map(function(w){var p=owners.get(w.id)||{};return Object.assign({},w,{last_activity:latest(w)?new Date(latest(w)).toISOString():null,
      created_at:w.created_at||null,lib_count:Array.isArray(library)?counts.get(w.id)||0:null,
      owner_id:p.user_id||w.owner_id||'',owner_email:p.email||w.owner_email||'',owner_name:p.member_name||p.account_name||w.owner_name||''});});
  }
  function summary(state){
    var w=state.workspaces&&state.workspaces.ok?state.workspaces.rows:null,u=state.users&&state.users.ok?state.users.rows:null,l=state.library&&state.library.ok?state.library.rows:null;
    return {accounts:u?u.length:null,spaces:w?w.length:null,teams:w?w.filter(function(r){return r.kind==='team';}).length:null,content:l?l.filter(function(r){return !r.deleted_at;}).length:null};
  }
  function unknown(value){return value==null?'확인 못 함':String(value);}
  function feature(key){
    var exact={cs_team_attrs_v1:'팀 평가 설정',scout_tool_v1:'팀 선수 정보',process_coach_v1:'팀 일정',cs_private_board_v1:'개인 작전판',cs_board_live_v1:'작업 중인 작전판',cs_team_matches_v1:'팀 경기',cs_learn_sync_v1:'학습 기록',cs_analysis_team_library_v1:'팀 경기 분석',cs_gamemodel_personal_v1:'개인 게임모델'};
    return exact[key]||(/^sq:/.test(key)?'선수별 명단 정보':/^cs_idp_v1_/.test(key)?'선수 IDP':key);
  }
  return {rpcRows:rpcRows,events:events,workspaces:workspaces,sortWorkspaces:sortWorkspaces,summary:summary,unknown:unknown,feature:feature};
});
