/* PROCESS STUDIO — 현재 앱의 변경 안내. 업데이트 다운로드·새로고침·사용자 자료와 독립적이다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSReleaseNotes=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var STORAGE_KEY='ps_release_notes_hidden_v1',WEEK_MS=7*24*60*60*1000;
  var DEFAULT_ENTRIES=[{
    id:'2026-09-15-private-working-board',date:'2026-09-15',title:'작업 중인 보드를 개인 공간으로 분리했습니다',
    changes:[
      '작업 중인 보드는 내 계정에 저장되며, 다른 코치의 보드는 자동으로 열리지 않습니다.',
      '같은 계정은 팀을 바꿔도 내 보드를 이어서 사용합니다.',
      '보관함에 저장한 자료는 기존 공유 설정을 유지합니다.'
    ]
  },{
    id:'2026-09-15-roster-server-confirmation',date:'2026-09-15',title:'선수 삭제와 저장 확인을 보강했습니다',
    changes:[
      '선수단에서 삭제한 기록을 보존하는 처리를 보강했습니다.',
      '선수 변경은 서버에 저장된 내용까지 확인한 뒤 저장 완료로 표시합니다.',
      '삭제 확인 중 계정·팀이나 선수 정보가 달라지면 이전 요청을 적용하지 않습니다.'
    ]
  },{
    id:'2026-09-15-roster-save-coordination',date:'2026-09-15',title:'선수단 저장 안정성을 높였습니다',
    changes:[
      '선수별 저장은 실제로 수정한 선수만 반영하도록 정리했습니다.',
      '저장 대기 중인 선수 변경은 이 기기에 보관하고, 다시 열었을 때 이어서 저장합니다.',
      '계정·팀 전환 중 늦게 도착한 명단이 현재 편집을 덮지 않도록 보강했습니다.'
    ]
  },{
    id:'2026-09-15-help-web-pages',date:'2026-09-15',title:'사용법을 웹페이지로 모았습니다',
    changes:[
      '앱 설정의 사용법 탭에서 앱·팀 운영·IDP·설치 안내와 전체 설명서를 찾습니다.',
      '모든 안내는 새 웹페이지로 열립니다. 앱 사용법은 기존 6개 언어를 지원합니다.'
    ]
  },{
    id:'2026-09-15-compact-participation',date:'2026-09-15',title:'선수별 누적을 한 줄 목록으로',
    changes:[
      '선수 이름·번호·포지션과 누적 일수를 한 줄로 정리해 더 많은 선수를 한눈에 봅니다.',
      '휴대폰에서도 운동·쉼·부상·재활·미기록을 나란히 확인하고, 이름을 누르면 상세 기록이 열립니다.'
    ]
  },{
    id:'2026-09-15-participation-history',date:'2026-09-15',title:'날짜별 참여 기록과 선수별 누적 현황',
    changes:[
      '참여 화면에서 날짜를 누르면 그날 선수 명단과 기록을 확인하고 수정할 수 있습니다.',
      '선수별로 운동한 날과 쉰 날, 부상·재활 일수를 한눈에 확인합니다.',
      '오늘 부상으로 바꾼 상태는 복귀 전까지 주말을 포함해 누적하며, 지난 날짜의 정정은 그날에만 반영합니다.'
    ]
  },{
    id:'2026-09-15-automatic-save',date:'2026-09-15',title:'자동 저장과 기기 간 자료 맞추기 개선',
    changes:[
      '저장 중·저장됨 상태를 화면에서 간단히 확인합니다.',
      '서로 다른 항목의 수정은 자동으로 합치며, 겹친 원문은 이 기기에 별도 보관합니다.',
      '보관한 원문은 앱 설정 → 데이터 → 고급 → 최근 변경 복구에서 확인하고 내려받을 수 있습니다.'
    ]
  },{
    id:'2026-09-15-admin-support',date:'2026-09-15',title:'오류 제보와 관리자 답변 연결',
    changes:[
      '앱에서 보낸 오류 제보가 관리자 접수함에 연결됩니다.',
      '운영자가 남긴 답변을 오류 제보의 내 제보와 답변에서 확인할 수 있습니다.'
    ]
  },{
    id:'2026-09-15-save-review-support',date:'2026-09-15',title:'저장 안내와 문의 기능 개선',
    changes:[
      '저장할 내용 선택 화면을 간결하게 정리했습니다. 복구와 점검은 앱 설정에서 열 수 있습니다.',
      '앱에서 오류나 불편한 점을 문의하고 답변을 확인할 수 있습니다.',
      '문의에 필요한 오류 기록을 복사할 수 있습니다.'
    ]
  }];
  function text(value){return typeof value==='string'?value:'';}
  function entries(value){
    return (Array.isArray(value)?value:[]).filter(function(x){return x&&typeof x==='object'&&text(x.id)&&text(x.title);}).map(function(x){
      return {id:text(x.id),date:text(x.date),title:text(x.title),changes:(Array.isArray(x.changes)?x.changes:[]).filter(function(s){return typeof s==='string'&&!!s;})};
    });
  }
  /* 전체 표시 내용을 그대로 비교한다. 해시 충돌이나 버전 번호 재사용으로 새 안내가 숨겨지지 않는다. */
  function revision(value){return 'release-notes-v1:'+JSON.stringify(entries(value));}
  function validTime(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0;}
  function makeHidden(input){
    input=input||{};
    if(!validTime(input.now)||!entries(input.entries).length)return null;
    return {revision:revision(input.entries),from:input.now,until:input.now+WEEK_MS};
  }
  function shouldShow(input){
    input=input||{};
    if(!entries(input.entries).length)return false;
    var h=input.hidden,now=input.now;
    if(!h||typeof h!=='object'||h.revision!==revision(input.entries)||!validTime(now)||
       !validTime(h.from)||!validTime(h.until)||h.until-h.from!==WEEK_MS)return true;
    /* 시계가 뒤로 이동했거나 저장 값이 미래를 가리키면 안내를 영구적으로 숨기지 않는다. */
    return now<h.from||now>=h.until;
  }
  function readHidden(win){
    try{var raw=win.localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):null;}catch(_){return null;}
  }
  var CSS=[
    '.ps-release-notes{flex:0 0 auto;min-width:0;background:var(--bar,#fff);color:var(--txt,#14161a);border-bottom:1px solid var(--line,#e3e6ea);font:inherit}',
    'body.fmdark .ps-release-notes{--bar:#1b1e23;--bar2:#23272d;--line:#2e333a;--txt:#f2f3f5;--dim:#a9afb8;--blue:#6f94f5}',
    '.ps-release-notes[hidden],.ps-release-notes [hidden]{display:none!important}',
    '.ps-release-notes *{box-sizing:border-box}',
    '.ps-release-notes .psrn-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px 16px;padding:9px 16px}',
    '.ps-release-notes .psrn-summary{flex:1 1 250px;min-width:0}',
    '.ps-release-notes .psrn-heading{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;font-size:12px;line-height:1.45}',
    '.ps-release-notes .psrn-label{color:var(--blue,#3a6df0);font-weight:800}',
    '.ps-release-notes .psrn-meta{color:var(--dim,#646a73);font-size:11px}',
    '.ps-release-notes .psrn-title{margin-top:2px;font-size:12px;line-height:1.45;overflow-wrap:anywhere}',
    '.ps-release-notes .psrn-actions{display:flex;align-items:center;flex-wrap:wrap;gap:6px}',
    '.ps-release-notes button{appearance:none;min-height:32px;padding:5px 9px;border:1px solid var(--line,#e3e6ea);border-radius:7px;background:transparent;color:inherit;font:inherit;font-size:12px;font-weight:600;line-height:1.4;cursor:pointer}',
    '.ps-release-notes button:hover{background:var(--bar2,#f1f2f4)}',
    '.ps-release-notes button:focus-visible{outline:2px solid var(--blue,#3a6df0);outline-offset:2px}',
    '.ps-release-notes .psrn-details{padding:0 16px 12px;max-height:220px;max-height:min(32dvh,220px);overflow:auto;overscroll-behavior:contain}',
    '.ps-release-notes .psrn-entry{padding-top:10px;border-top:1px solid var(--line,#e3e6ea)}',
    '.ps-release-notes .psrn-entry+.psrn-entry{margin-top:10px}',
    '.ps-release-notes h3{margin:0;font-size:12px;font-weight:800;line-height:1.5;overflow-wrap:anywhere}',
    '.ps-release-notes ul{margin:6px 0 0;padding-left:18px;font-size:12px;line-height:1.65}',
    '.ps-release-notes li{overflow-wrap:anywhere}',
    '.ps-release-notes .psrn-notice{margin:0;padding:0 16px 10px;font-size:12px;line-height:1.5;color:var(--dim,#646a73)}',
    '@media(max-width:480px){.ps-release-notes .psrn-row{padding:8px 12px;gap:7px}.ps-release-notes .psrn-summary{flex-basis:100%}.ps-release-notes .psrn-details{padding:0 12px 10px}.ps-release-notes .psrn-notice{padding:0 12px 9px}}'
  ].join('\n');
  function mount(options){
    options=options||{};
    var win=options.window||(typeof window!=='undefined'?window:null),host=options.host;
    if(!win||!win.document||!host)return null;
    if(host.__psReleaseNotes&&host.__psReleaseNotes.destroy)host.__psReleaseNotes.destroy();
    var doc=win.document,current=entries(options.entries===undefined?DEFAULT_ENTRIES:options.entries),timer=null,disposed=false,expanded=false;
    var now=typeof options.now==='function'?options.now:function(){return Date.now();};
    if(!doc.getElementById('psReleaseNotesStyle')){
      var style=doc.createElement('style');style.id='psReleaseNotesStyle';style.textContent=CSS;(doc.head||doc.documentElement).appendChild(style);
    }
    host.classList.add('ps-release-notes');host.setAttribute('role','region');host.setAttribute('aria-label','최근 업데이트');
    function el(tag,cls,label){var node=doc.createElement(tag);if(cls)node.className=cls;if(label!==undefined)node.textContent=label;return node;}
    var row=el('div','psrn-row'),summary=el('div','psrn-summary'),heading=el('div','psrn-heading');
    var label=el('span','psrn-label','최근 업데이트'),meta=el('span','psrn-meta'),title=el('div','psrn-title');
    heading.appendChild(label);heading.appendChild(meta);summary.appendChild(heading);summary.appendChild(title);row.appendChild(summary);
    var actions=el('div','psrn-actions'),toggle=el('button','','내용 보기'),hide=el('button','','일주일간 안 보기');
    toggle.type=hide.type='button';toggle.setAttribute('aria-expanded','false');
    actions.appendChild(toggle);actions.appendChild(hide);row.appendChild(actions);
    var detail=el('div','psrn-details'),notice=el('p','psrn-notice');detail.hidden=true;notice.hidden=true;notice.setAttribute('role','status');
    if(host.id){detail.id=host.id+'Details';toggle.setAttribute('aria-controls',detail.id);}
    host.replaceChildren(row,detail,notice);
    function clearTimer(){if(timer!==null){win.clearTimeout(timer);timer=null;}}
    function render(){
      title.textContent=current.length?current[0].title:'';
      meta.textContent=[win.PS_BUILD?'v'+String(win.PS_BUILD):'',current.length?current[0].date:''].filter(Boolean).join(' · ');
      detail.replaceChildren();
      current.forEach(function(entry){
        var article=el('section','psrn-entry'),name=el('h3','',entry.title),date=el('div','psrn-meta',entry.date),list=el('ul');
        article.appendChild(name);article.appendChild(date);
        entry.changes.forEach(function(change){list.appendChild(el('li','',change));});
        article.appendChild(list);detail.appendChild(article);
      });
    }
    function refresh(nextEntries){
      if(disposed)return;
      if(Array.isArray(nextEntries)){current=entries(nextEntries);render();}
      clearTimer();
      var at=now(),hidden=readHidden(win),visible=shouldShow({entries:current,hidden:hidden,now:at});
      host.hidden=!visible;
      if(!visible&&current.length&&hidden&&hidden.until>at){
        timer=win.setTimeout(function(){timer=null;refresh();},Math.min(hidden.until-at,2147483647));
      }
    }
    function showDetails(){expanded=!expanded;detail.hidden=!expanded;toggle.textContent=expanded?'내용 접기':'내용 보기';toggle.setAttribute('aria-expanded',String(expanded));}
    function hideWeek(){
      var value=makeHidden({entries:current,now:now()}),stored=false;
      if(value)try{
        var raw=JSON.stringify(value);win.localStorage.setItem(STORAGE_KEY,raw);
        stored=win.localStorage.getItem(STORAGE_KEY)===raw;
      }catch(_){}
      if(!stored){notice.textContent='설정을 저장하지 못했어요. 잠시 후 다시 눌러 주세요.';notice.hidden=false;host.hidden=false;return;}
      notice.textContent='';notice.hidden=true;refresh();
    }
    function onStorage(event){if(!event||event.key===null||event.key===STORAGE_KEY)refresh();}
    function onVisible(){if(!doc.hidden)refresh();}
    toggle.addEventListener('click',showDetails);hide.addEventListener('click',hideWeek);
    win.addEventListener('storage',onStorage);win.addEventListener('focus',onVisible);doc.addEventListener('visibilitychange',onVisible);
    var controller={refresh:refresh,destroy:function(){
      if(disposed)return;disposed=true;clearTimer();
      toggle.removeEventListener('click',showDetails);hide.removeEventListener('click',hideWeek);
      win.removeEventListener('storage',onStorage);win.removeEventListener('focus',onVisible);doc.removeEventListener('visibilitychange',onVisible);
      host.replaceChildren();host.hidden=true;if(host.__psReleaseNotes===controller)delete host.__psReleaseNotes;
    }};
    host.__psReleaseNotes=controller;render();refresh();return controller;
  }
  return {STORAGE_KEY:STORAGE_KEY,WEEK_MS:WEEK_MS,entries:function(){return entries(DEFAULT_ENTRIES);},revision:revision,makeHidden:makeHidden,shouldShow:shouldShow,mount:mount};
});
