/* 3.203 — 선수단 · 스카우팅 «여러 명 한 번에 추가»(사용자 «한번에 많이 추가 · 한 행에 한 명씩 포지션과 조 정해서»).
   한 줄에 한 명: 이름 칸 · 포지션 고르개 · 조 고르개(선수단) 또는 출신 팀 · 등급(스카우팅) · 등번호. 엑셀 · 메모에서 복사한 명단을 이름 칸에
   붙여 넣으면 줄이 채워진다(parsePaste). 저장은 기존 길 그대로 — 선수단은 data.players 에 push 뒤 save() · renderTeam(),
   스카우팅은 PSScoutStore.importLegacy 로 등록부에 넣고 scMakePlacement 로 배치. 새 조는 2.249 «＋ 조»와 같은 모양(uid('grp') · grpBase · grpLabels). */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSPlayerBulk=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var MAX=60;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function norm(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function key(s){return norm(s).toLocaleLowerCase();}
  /* 붙여 넣은 글 → 줄마다 {name,pos,grp,num}. 탭 · 쉼표 · 세미콜론 · 두 칸 넘는 띄움이 있으면 그것만 칸 경계(칸 안의 한 칸 띄움은 이름 · 조의 일부).
     한 칸 띄움뿐이면 낱말 차례로: 아는 것(포지션 코드 · 1~3자리 수 · 지금 팀의 조 이름)이 나오기 전까지가 이름, 그 뒤 모르는 낱말은 조(선수단) · 출신 팀(스카우팅).
     열 머리(«이름 포지션 …»)는 건너뛴다. */
  function parsePaste(text,ctx){
    ctx=ctx||{};var codes=(ctx.posCodes||[]).map(function(c){return String(c).toUpperCase();}),labels={},rows=[];
    Object.keys(ctx.groups||{}).forEach(function(k){labels[key(ctx.groups[k])]=norm(ctx.groups[k]);});
    function kind(tok,row){if(!row.num&&/^#?\d{1,3}$/.test(tok))return 'num';if(!row.pos&&codes.indexOf(tok.toUpperCase())>=0)return 'pos';if(labels[key(tok)]!==undefined)return 'grp';return '';}
    String(text||'').split(/\r?\n/).forEach(function(line){
      line=line.replace(/\u00a0/g,' ');var cut=/[\t;,]|\s{2,}/.test(line),cells=cut?line.split(/[\t;,]|\s{2,}/).map(norm).filter(Boolean):norm(line).split(' ').filter(Boolean);
      if(!cells.length)return;
      if(/^(이름|name|선수|후보)$/i.test(cells[0]))return;
      var row={name:'',pos:'',grp:'',num:''},rest=[],known='',nameParts=[],started=cut;
      if(cut){row.name=cells.shift();}
      cells.forEach(function(c){var k=kind(c,row);
        if(!started){if(!k){nameParts.push(c);return;}started=true;}
        if(k==='num')row.num=c.replace(/^#/,'');else if(k==='pos')row.pos=c.toUpperCase();else if(k==='grp')known=known||labels[key(c)];else rest.push(c);});
      if(!cut)row.name=nameParts.join(' ');
      row.grp=known||rest.join(' ');
      if(row.name)rows.push(row);
    });
    return rows.slice(0,MAX);
  }
  /* 줄 묶음을 실제 추가 계획으로. ctx.existing: [{name,num}] · ctx.groups: {key:label} · ctx.positions: [{id,abbr,name}].
     같은 이름 + 같은 등번호(둘 다 비었으면 같은 이름)가 이미 있으면 건너뛴다. 없는 조 이름은 newGroups 로 모은다(저장 때 한 번만 만든다). */
  function plan(rows,ctx){
    ctx=ctx||{};var existing=(ctx.existing||[]).map(function(p){return key(p.name)+'|'+norm(p.num);}),seen={},groups=ctx.groups||{},labels={},add=[],skipped=[],newGroups=[];
    Object.keys(groups).forEach(function(k){labels[key(groups[k])]=k;});
    (rows||[]).forEach(function(r){
      var name=norm(r.name);if(!name)return;
      var num=norm(r.num).replace(/^#/,''),sig=key(name)+'|'+num;
      if(existing.indexOf(sig)>=0||seen[sig]){skipped.push({name:name,num:num,why:'이미 있음'});return;}
      seen[sig]=1;
      var grpKey='',grpLabel=norm(r.grpLabel||r.grp);
      if(r.grpKey&&groups[r.grpKey]!==undefined)grpKey=r.grpKey;
      else if(grpLabel){grpKey=labels[key(grpLabel)]||'';if(!grpKey){var made=newGroups.filter(function(g){return key(g.label)===key(grpLabel);})[0];if(!made){made={key:'__new'+newGroups.length,label:grpLabel};newGroups.push(made);}grpKey=made.key;}}
      var posId='';
      if(r.posId)posId=r.posId;
      else if(r.pos){var ab=String(r.pos).toUpperCase(),hit=(ctx.positions||[]).filter(function(p){return String(p.abbr||'').toUpperCase()===ab||String(p.name||'').toUpperCase()===ab;})[0];posId=hit?hit.id:'';}
      add.push({name:name,num:num,posId:posId,grpKey:grpKey,club:norm(r.club),grade:norm(r.grade)});
    });
    return {add:add,skipped:skipped,newGroups:newGroups};
  }
  function mount(win){
    var doc=win.document;if(!doc)return;
    function g(name){return typeof win[name]==='function'?win[name]:null;}
    /* scout.html 의 data · scoutStore · TKEY 는 const/let 전역이라 window 속성이 아니다 — 같은 페이지의 스크립트라 이름으로 읽는다(CLAUDE.md 작전판 규칙과 같음). */
    function source(){return typeof data!=='undefined'&&data?data:{players:[],positions:[],meta:{}};}
    function store(){return typeof scoutStore!=='undefined'?scoutStore:win.scoutStore;}
    function mkId(prefix){return typeof uid==='function'?uid(prefix):prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
    function grpLabel(k){return typeof tmGrpLabel==='function'?(tmGrpLabel(k)||k):k;}
    function tkey(){return typeof TKEY!=='undefined'?TKEY:'cs_scout_targets_v1';}
    function positions(){return (source().positions||[]).map(function(p){var ab=g('posAbbr')?win.posAbbr(p.name):p.name;return {id:p.id,abbr:ab||p.name,name:p.name};});}
    function groupMap(){var m={},keys=[];try{keys=win.PSTeamAudience.keys(source());}catch(_){keys=[];}keys.forEach(function(k){m[k]=grpLabel(k);});return m;}
    function toast(msg){try{win.toast(msg);}catch(_){}}
    function canEdit(kind){
      if(kind==='team'){if(g('teEditable')&&!win.teEditable()){toast('운영진만 선수를 추가할 수 있어요');return false;}return true;}
      try{win.scStore().check();return true;}catch(e){try{win.scWarn(e);}catch(_){toast('후보 자료를 아직 쓸 수 없어요');}return false;}
    }
    var dialog=null,rows=[],pendingGroups=[],kindNow='team';
    function blank(){return {name:'',posId:'',grpKey:'',num:'',club:'',grade:''};}
    function groupOptions(cur){var m=groupMap(),opts=[['','미배정']];Object.keys(m).forEach(function(k){opts.push([k,m[k]]);});pendingGroups.forEach(function(p){opts.push([p.key,p.label]);});
      return opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===cur?' selected':'')+'>'+esc(o[1])+(o[0].indexOf('__new')===0?' · 새 조':'')+'</option>';}).join('');}
    function posOptions(cur){return [['','미정']].concat(positions().map(function(p){return [p.id,p.abbr===p.name?p.name:p.abbr+' · '+p.name];})).map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===cur?' selected':'')+'>'+esc(o[1])+'</option>';}).join('');}
    function gradeOptions(cur){return [['','등급 미정']].concat((win.SB_GRADES||['A','B','C','D']).map(function(x){return [x,x];})).map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===cur?' selected':'')+'>'+esc(o[1])+'</option>';}).join('');}
    function rowHTML(r,i,kind){
      return '<div class="pw-bulk-row" data-row="'+i+'"><span class="pw-bulk-n">'+(i+1)+'</span>'
        +'<input data-f="name" value="'+esc(r.name)+'" placeholder="이름" maxlength="20" autocomplete="off" aria-label="'+(i+1)+'번째 이름">'
        +'<select data-f="posId" aria-label="'+(i+1)+'번째 포지션">'+posOptions(r.posId)+'</select>'
        +(kind==='team'?'<select data-f="grpKey" aria-label="'+(i+1)+'번째 조">'+groupOptions(r.grpKey)+'</select>'
          :'<input data-f="club" value="'+esc(r.club)+'" placeholder="출신 팀" maxlength="30" autocomplete="off" aria-label="'+(i+1)+'번째 출신 팀"><select data-f="grade" aria-label="'+(i+1)+'번째 등급">'+gradeOptions(r.grade)+'</select>')
        +'<input data-f="num" value="'+esc(r.num)+'" placeholder="번호" inputmode="numeric" maxlength="3" autocomplete="off" aria-label="'+(i+1)+'번째 등번호">'
        +'<button type="button" data-del="'+i+'" aria-label="'+(i+1)+'번째 줄 지우기">×</button></div>';
    }
    function ctxFor(kind){
      var ps=source().players||[];
      return {existing:ps.filter(function(p){return kind==='team'?p.type!=='target':p.type==='target';}).map(function(p){return {name:p.name||'',num:p.num||''};}),groups:groupMap(),positions:positions(),posCodes:positions().map(function(p){return p.abbr;}).concat(['GK','CB','LB','RB','DM','CM','AM','LW','RW','CF','ST','LM','RM','FW'])};
    }
    function summary(kind){
      var p=plan(rows.map(function(r){return Object.assign({},r,{grpKey:r.grpKey.indexOf('__new')===0?'':r.grpKey,grpLabel:r.grpKey.indexOf('__new')===0?(pendingGroups.filter(function(x){return x.key===r.grpKey;})[0]||{}).label:''});}),ctxFor(kind));
      var parts=[];
      if(kind==='team'){var by={},gm=groupMap();p.add.forEach(function(a){var lb=a.grpKey?(gm[a.grpKey]||(p.newGroups.filter(function(x){return x.key===a.grpKey;})[0]||{}).label||a.grpKey):'미배정';by[lb]=(by[lb]||0)+1;});Object.keys(by).forEach(function(lb){parts.push(lb+' '+by[lb]);});}
      return {plan:p,text:'<b>'+p.add.length+'명 추가</b>'+(parts.length?' · '+parts.join(' · '):'')+(p.newGroups.length?' · <i class="pw-bulk-new">새 조 '+p.newGroups.length+'</i>':'')+(p.skipped.length?' · <span class="pw-muted">'+p.skipped.length+'명 건너뜀(이미 있음)</span>':'')};
    }
    function paint(){
      var kind=kindNow,body=dialog.querySelector('.pw-bulk-rows');
      body.innerHTML=rows.map(function(r,i){return rowHTML(r,i,kind);}).join('');
      dialog.querySelector('.pw-bulk-sum').innerHTML=summary(kind).text;
      dialog.querySelector('[data-ok]').textContent=summary(kind).plan.add.length+'명 추가';
    }
    function refreshSum(){var sm=summary(kindNow);dialog.querySelector('.pw-bulk-sum').innerHTML=sm.text;dialog.querySelector('[data-ok]').textContent=sm.plan.add.length+'명 추가';}
    function read(){
      Array.prototype.forEach.call(dialog.querySelectorAll('.pw-bulk-row'),function(el){var i=+el.dataset.row,r=rows[i];if(!r)return;Array.prototype.forEach.call(el.querySelectorAll('[data-f]'),function(f){r[f.dataset.f]=f.value;});});
    }
    function ensureTail(){var last=rows[rows.length-1];if(!last||norm(last.name))rows.push(blank());}
    function open(kind){
      if(!canEdit(kind))return;
      kindNow=kind;rows=[blank(),blank(),blank()];pendingGroups=[];
      if(dialog)dialog.remove();
      dialog=doc.createElement('div');dialog.className='pw-bulk-overlay';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','pwBulkTitle');
      dialog.innerHTML='<div class="pw-bulk-card'+(doc.body.classList.contains('fmdark')?' is-dark':'')+'"><div class="pw-bulk-title" id="pwBulkTitle">'+(kind==='team'?'선수':'후보')+' 여러 명 한 번에 추가</div>'
        +'<div class="pw-bulk-sub">한 줄에 한 명. '+(kind==='team'?'포지션과 조는 고르고, 등번호는':'포지션 · 등급은 고르고, 출신 팀 · 등번호는')+' 비워도 됩니다. 엑셀 · 메모에서 복사한 명단(이름 포지션 '+(kind==='team'?'조':'출신 팀')+' 등번호)을 이름 칸에 붙여 넣으면 줄이 채워져요.</div>'
        +'<div class="pw-bulk-head"><span></span><span>이름</span><span>포지션</span>'+(kind==='team'?'<span>조</span>':'<span>출신 팀</span><span>등급</span>')+'<span>등번호</span><span></span></div>'
        +'<div class="pw-bulk-rows"></div>'
        +'<div class="pw-bulk-tools"><button type="button" class="pw-bulk-add" data-act="row">＋ 줄 추가</button>'+(kind==='team'?'<button type="button" class="pw-bulk-add" data-act="group">＋ 새 조 만들기</button>':'')+'<span class="pw-bulk-sum" aria-live="polite"></span></div>'
        +'<div class="pw-bulk-foot"><button type="button" data-cancel>취소</button><button type="button" data-ok class="is-primary">추가</button></div></div>';
      dialog.classList.toggle('pw-bulk-scout',kind==='scout');
      doc.body.appendChild(dialog);
      paint();
      /* 이름을 치는 중엔 줄을 다시 그리지 않는다(한글 조합이 끊긴다) — 마지막 줄이 차면 빈 줄 하나만 뒤에 붙인다. */
      dialog.addEventListener('input',function(e){if(e.target.dataset.f===undefined)return;read();var n=rows.length;ensureTail();if(rows.length>n)dialog.querySelector('.pw-bulk-rows').insertAdjacentHTML('beforeend',rowHTML(rows[rows.length-1],rows.length-1,kind));refreshSum();});
      dialog.addEventListener('change',function(e){if(e.target.dataset.f===undefined)return;read();refreshSum();});
      dialog.addEventListener('paste',function(e){
        var t=e.target;if(!t||t.dataset.f!=='name')return;
        var text=(e.clipboardData||win.clipboardData).getData('text')||'';if(!/[\n\t,;]/.test(text)&&!/ {2,}/.test(text))return;
        e.preventDefault();read();
        var at=+t.closest('.pw-bulk-row').dataset.row,parsed=parsePaste(text,ctxFor(kind)),gm=groupMap(),labels={};Object.keys(gm).forEach(function(k){labels[key(gm[k])]=k;});
        var fill=parsed.map(function(p){var r=blank();r.name=p.name;r.num=p.num;var pos=positions().filter(function(x){return String(x.abbr).toUpperCase()===p.pos;})[0];r.posId=pos?pos.id:'';
          if(kind==='team'&&p.grp){var k=labels[key(p.grp)];if(!k){var made=pendingGroups.filter(function(x){return key(x.label)===key(p.grp);})[0];if(!made){made={key:'__new'+pendingGroups.length,label:p.grp};pendingGroups.push(made);}k=made.key;}r.grpKey=k;}
          if(kind==='scout')r.club=p.grp;return r;});
        var before=rows.slice(0,at),after=rows.slice(at+1).filter(function(r){return norm(r.name);});
        rows=before.concat(fill,after);ensureTail();paint();
        var next=dialog.querySelector('.pw-bulk-row[data-row="'+(at+fill.length)+'"] [data-f="name"]');if(next)next.focus();
      });
      dialog.addEventListener('click',function(e){
        var b=e.target.closest('button');if(!b)return;
        if(b.dataset.cancel!==undefined||e.target===dialog){close();return;}
        if(b.dataset.del!==undefined){read();rows.splice(+b.dataset.del,1);if(!rows.length)rows.push(blank());paint();return;}
        if(b.dataset.act==='row'){read();rows.push(blank());paint();var inp=dialog.querySelectorAll('.pw-bulk-row [data-f="name"]');if(inp.length)inp[inp.length-1].focus();return;}
        if(b.dataset.act==='group'){read();askGroup();return;}
        if(b.dataset.ok!==undefined){read();commit();}
      });
      dialog.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();close();}});
      var first=dialog.querySelector('[data-f="name"]');if(first)first.focus();
    }
    function askGroup(){
      var v=win.prompt('새 조 이름 (예: D팀 / 3군 / 6학년)','');if(v==null)return;v=norm(v);if(!v){toast('조 이름이 비었어요');return;}if(v.length>40){toast('조 이름은 40자 이내로 적어 주세요.');return;}
      var gm=groupMap(),hit=Object.keys(gm).filter(function(k){return key(gm[k])===key(v);})[0]||(pendingGroups.filter(function(x){return key(x.label)===key(v);})[0]||{}).key;
      if(!hit){hit='__new'+pendingGroups.length;pendingGroups.push({key:hit,label:v});}
      rows.forEach(function(r){if(!r.grpKey)r.grpKey=hit;});paint();
    }
    function close(){if(dialog){dialog.remove();dialog=null;}}
    function commit(){
      var kind=kindNow,p=summary(kind).plan;
      if(!p.add.length){toast('추가할 이름이 없어요');return;}
      if(!canEdit(kind))return;
      try{if(kind==='team')commitTeam(p);else commitScout(p);}catch(e){try{win.scWarn(e);}catch(_){toast(e&&e.message||'저장하지 못했어요');}}
    }
    function commitTeam(p){
      var d=source();d.meta=d.meta||{};
      var made={};
      if(p.newGroups.length){var cur=g('tmGrpBase')?win.tmGrpBase():(d.meta.grpBase||[]);d.meta.grpLabels=Object.assign({},d.meta.grpLabels||{});
        p.newGroups.forEach(function(ng){var k=mkId('grp');made[ng.key]=k;cur=cur.concat([k]);d.meta.grpLabels[k]=ng.label;});d.meta.grpBase=cur;}
      p.add.forEach(function(a){var grp=made[a.grpKey]||(a.grpKey.indexOf('__new')===0?'':a.grpKey);d.players.push({id:mkId('pl'),name:a.name,num:a.num,foot:'',type:'ours',posId:a.posId||'',grp:grp||'',levels:{},memo:'',manual:true});});
      var ok=win.save();close();try{win.renderTeam();}catch(_){}try{if(g('renderScoutBoard'))win.renderScoutBoard();}catch(_){}
      toast(ok===false?(typeof TM_ADD_FAIL!=='undefined'?TM_ADD_FAIL:'저장하지 못했어요'):p.add.length+'명 추가됨'+(p.newGroups.length?' · 새 조 '+p.newGroups.map(function(x){return x.label;}).join(', '):''));
    }
    function commitScout(p){
      var cli=win.scStore(),copyDoc=win.PSScoutStore.copy(cli.state.doc),ids=[],legacy=[],owner=cli.state.owner,posById={};
      positions().forEach(function(x){posById[x.id]=x.abbr;});
      p.add.forEach(function(a){var pid=mkId('candidate');ids.push(pid);legacy.push({id:pid,nameKr:a.name,num:a.num,club:a.club,grade:a.grade,pos:a.posId&&posById[a.posId]?[posById[a.posId]]:[]});});
      win.PSScoutStore.importLegacy(copyDoc,{players:legacy},ids,false);
      if(!store().set(tkey(),copyDoc)){toast('후보를 저장하지 못했어요');return;}
      close();
      Promise.resolve(store().ready()).then(function(){
        cli.check();if(cli.state.owner!==owner)throw new Error('팀이 바뀌었습니다. 등록한 후보를 확인해 주세요.');
        var placed=0;p.add.forEach(function(a,i){if(!a.posId)return;try{var t=win.scMakePlacement('db:'+ids[i],a.posId);source().players.push(t);placed++;}catch(_){}});
        if(placed)win.save();
        try{win.renderScoutCands();}catch(_){}try{win.renderScoutBoard();}catch(_){}
        toast(p.add.length+'명 등록됨'+(placed?' · '+placed+'명 배치':''));
      }).catch(function(e){try{win.scWarn(e);}catch(_){toast(e&&e.message||'후보를 저장하지 못했어요');}try{win.renderScoutCands();}catch(_){}});
    }
    win.PSPlayerBulk.open=open;
  }
  return {MAX:MAX,parsePaste:parsePaste,plan:plan,mount:mount};
});
if(typeof window!=='undefined'&&window.PSPlayerBulk)window.PSPlayerBulk.mount(window);
