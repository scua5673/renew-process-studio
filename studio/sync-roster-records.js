/* 3.383 — 선수단 문서(scout_tool_v1)의 기록 칸을 «선수 입력 보류» 중에도 팀에 올린다
   (사용자 11/27 «풋볼A 다른 코치가 부상리포트 만들고 있는데 팀운영에 적용이 안되는데»).
   기록 칸 = meta.injuryInfo[선수][부상 첫날](부위 · 쪽 · 언제 · 메모) · meta.statusRuns[선수](상태 기간) · meta.participationDays[날][선수](그날 기록).
   ⓐ 운영 기록: 스태프 기기에 «선수 입력 보류»(sync-items-stale · 3.217)가 하나라도 있으면 그 기기의 선수단 문서는 통째로 안 올라간다
      (`fenced` — 보류된 선수의 기기 값이 실린 문서라서). 상태는 선수 줄(sq:)로 따로 올라가 «부상»은 보이는데, 부위 · 메모 · 기간은 그 기기에만 남았다
      (풋볼A 서버의 부상 기록은 11/16 이 마지막 · 45일 동안 스태프 저장 35번이 기록 칸을 한 번도 못 바꿈).
   ⓑ 보류 중에는 **서버 문서 위에 이 기기의 기록 칸만 얹어** 올린다(`p`) — 선수 줄 · 다른 칸은 서버 것 그대로, 보류된 선수의 기록은 싣지 않는다.
      기기 사본에는 서버의 기록 칸만 합쳐 넣는다(`l`) — 선수 줄 · 다른 칸 · 보류된 선수의 기록은 기기 것 그대로.
   ⓒ 합치는 규칙: 기록 칸은 앱에 지우는 길이 없다(2.948 · 서버 가드 20261006) → 합집합. 같은 자리에 둘 다 있으면 `at` 이 큰 쪽(같으면 서버).
      상태 기간은 시각이 없다 — 서버 기간을 그대로 두고, 서버의 마지막 날 뒤의 기기 기간만 잇는다(서버에 없는 선수는 기기 것 통째로).
   ⓓ 기록 칸 밖의 칸(평가표 · 포지션 · 시즌 …)이 서버와 다르면(`keep`) 올린 뒤에도 «마지막으로 맞춘 서버 판»을 앞으로 당기지 않는다 —
      당기면 보류가 풀린 뒤 기기 문서 통째 올리기가 그 사이 다른 기기가 고친 칸을 덮는다. 그대로 두면 예전처럼 «자료 확인»으로 간다.
   ⓔ 문서 전체 보류(ps_hold_list_v1 의 같은 키 — 충돌 · 급감 확인 대기)가 있으면 손대지 않는다(올리기 성공이 그 보류를 지운다).
   ⓕ 서버 원문은 «기기 기록이 바뀌었거나 서버 판이 바뀐» 회차에만 받는다(`want` — 보류가 며칠 가도 회차마다 받지 않게). 지문은 sync meta 의 `rr`.
   순수 셈 — 저장 · 전송은 sync.js 가 한다(KEYS 회차의 보류 갈래). DOM 없이 node 시험에서 돈다. */
(function(root,factory){var api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSRosterRecords=api;})(typeof window!=='undefined'?window:null,function(root){
  'use strict';
  var KEY='scout_tool_v1',FIELDS=['injuryInfo','statusRuns','participationDays'],HOLDS='ps_hold_list_v1',BAD=['__proto__','constructor','prototype'];
  var own=Function.call.bind(Object.prototype.hasOwnProperty),diag=[];
  function note(e){diag.push(String((e&&e.message)||e));if(diag.length>20)diag.shift();}
  function obj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
  function okKey(k){return typeof k==='string'&&k.length>0&&k.length<=256&&BAD.indexOf(k)<0;}
  function keys(o){return obj(o)?Object.keys(o).filter(okKey):[];}
  function canon(v){
    if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
    if(obj(v))return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canon(v[k]);}).join(',')+'}';
    return v===undefined?'null':JSON.stringify(v);
  }
  function fp(s){var h=5381;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)+'.'+s.length;}
  function at(x){return obj(x)&&typeof x.at==='number'&&isFinite(x.at)?x.at:0;}
  function copy(o){var out={};keys(o).forEach(function(k){out[k]=o[k];});return out;}
  function isDay(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);}
  function nextDay(d){var t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+1);return t.toISOString().slice(0,10);}
  function run(r){return obj(r)&&typeof r.s==='string'&&isDay(r.from)&&isDay(r.to)&&r.from<=r.to;}
  /* 두 단 지도(injuryInfo: 선수 → 첫날 · participationDays: 날 → 선수). skip(바깥 키, 안쪽 키) 가 참이면 기기 값을 쓰지 않는다 */
  function cells(s0,l,skip){
    if(!obj(l))return s0;var s=obj(s0)?s0:{},out=copy(s),changed=false;
    keys(l).forEach(function(a){
      var la=l[a];if(!obj(la))return;
      var sa=obj(out[a])?out[a]:null,m=null;
      keys(la).forEach(function(b){
        var lv=la[b];if(!obj(lv)||skip(a,b))return;
        if(!sa||!own(sa,b)||at(lv)>at(sa[b])){if(!m)m=sa?copy(sa):{};m[b]=lv;}
      });
      if(m){out[a]=m;changed=true;}
    });
    return changed?out:s0;
  }
  /* 상태 기간: 서버 것을 그대로 두고 서버의 마지막 날 뒤의 기기 기간만 잇는다 */
  function runs(s0,l,skip){
    if(!obj(l))return s0;var s=obj(s0)?s0:{},out=copy(s),changed=false;
    keys(l).forEach(function(pid){
      var la=l[pid];if(!Array.isArray(la)||skip(pid))return;
      var sa=Array.isArray(out[pid])?out[pid]:null,good=la.filter(run);
      if(!sa||!sa.length){if(good.length){out[pid]=good;changed=true;}return;}
      var last=sa[sa.length-1];if(!run(last))return;
      var end=last.to,arr=null;
      good.forEach(function(r){
        if(r.to<=end)return;
        var add=copy(r);if(add.from<=end)add.from=nextDay(end);
        if(!arr)arr=sa.slice();
        var p=arr[arr.length-1];
        if(run(p)&&p.s===add.s&&String(p.n||'')===String(add.n||'')&&nextDay(p.to)===add.from){var q=copy(p);q.to=add.to;arr[arr.length-1]=q;}
        else arr.push(add);
        end=add.to;
      });
      if(arr){out[pid]=arr;changed=true;}
    });
    return changed?out:s0;
  }
  function heldIds(list){var o={};(Array.isArray(list)?list:[]).forEach(function(k){if(typeof k==='string'&&k.indexOf('sq:')===0)o[k.slice(3)]=1;});return o;}
  /* 보류된 선수는 기기 값을 그대로 둔다(기기 사본 쪽) */
  function keepHeld(f,merged,l,held){
    if(!obj(l))return merged;var out=copy(merged||{});
    if(f==='participationDays'){keys(l).forEach(function(d){var la=l[d];if(!obj(la))return;var m=null;keys(la).forEach(function(pid){if(held[pid]){if(!m)m=copy(obj(out[d])?out[d]:{});m[pid]=la[pid];}});if(m)out[d]=m;});}
    else keys(l).forEach(function(pid){if(held[pid])out[pid]=l[pid];});
    return out;
  }
  function recs(meta){var o={};FIELDS.forEach(function(f){if(obj(meta)&&meta[f]!==undefined)o[f]=meta[f];});return o;}
  function rest(doc){var d=copy(doc);delete d.players;delete d._items;if(obj(d.meta)){var m=copy(d.meta);FIELDS.forEach(function(f){delete m[f];});d.meta=m;}return canon(d);}
  function docHeld(k,storage){
    try{var s=storage||(root&&root.localStorage);if(!s)return false;var L=JSON.parse(s.getItem(HOLDS)||'[]');return Array.isArray(L)&&L.some(function(x){return x&&x.k===k;});}
    catch(e){note(e);return true;}
  }
  function parse(raw){try{var d=JSON.parse(raw);return obj(d)&&(d.meta===undefined||obj(d.meta))?d:null;}catch(e){note(e);return null;}}
  /* plan(k, 기기 원문, 서버 행, sync meta, 이 회차 판본, 보류 키 목록) → null | {p: 올릴 원문, l: 기기에 쓸 원문, keep}
     sync meta 의 rr[k] 에 «기기 기록 지문 · 본 서버 판»을 적는다(want 가 다음 회차에 본다) */
  function plan(k,loc,row,m,now,heldKeys,storage){
    if(k!==KEY||typeof loc!=='string'||!row||typeof row.v!=='string'||!obj(m))return null;
    if(docHeld(k,storage))return null;
    var L=parse(loc),S=parse(row.v);if(!L||!S)return null;
    var held=heldIds(heldKeys),lm=L.meta||{},sm=S.meta||{},mp={},ml={},pDiff=false,lDiff=false;
    FIELDS.forEach(function(f){
      if(lm[f]===undefined&&sm[f]===undefined)return;
      var v=f==='statusRuns'?runs(sm[f],lm[f],function(pid){return !!held[pid];})
        :cells(sm[f],lm[f],f==='participationDays'?function(d,pid){return !!held[pid];}:function(pid){return !!held[pid];});
      if(v===undefined)return;
      mp[f]=v;ml[f]=keepHeld(f,v,lm[f],held);
      if(canon(v)!==canon(sm[f]))pDiff=true;
      if(canon(ml[f])!==canon(lm[f]))lDiff=true;
    });
    var out={keep:false},restL=rest(L),restS=rest(S);
    if(pDiff){var P=JSON.parse(row.v),pm=obj(P.meta)?P.meta:(P.meta={});Object.keys(mp).forEach(function(f){pm[f]=mp[f];});out.p=JSON.stringify(P);out.keep=restL!==restS;}
    if(lDiff){var D=JSON.parse(loc),dm=obj(D.meta)?D.meta:(D.meta={});Object.keys(ml).forEach(function(f){dm[f]=ml[f];});out.l=JSON.stringify(D);}
    if(!obj(m.rr))m.rr={};
    m.rr[k]={f:fp(canon(lDiff?ml:recs(lm))),c:pDiff?now:row.cupd};
    return out.p||out.l?out:null;
  }
  /* want(k, sync meta, 기기 원문, 서버 메타 행) — 보류 중 이 회차에 서버 원문을 받아야 하나 */
  function want(k,m0,loc,r0,storage){
    if(k!==KEY||typeof loc!=='string'||docHeld(k,storage))return false;
    var rr=obj(m0)&&obj(m0.rr)?m0.rr[k]:null;
    if(!obj(rr)||!r0||r0.cupd!==rr.c)return true;
    var L=parse(loc);if(!L)return false;
    return fp(canon(recs(L.meta||{})))!==rr.f;
  }
  return {KEY:KEY,FIELDS:FIELDS,plan:plan,want:want,cells:cells,runs:runs,rest:rest,canon:canon,diag:diag};
});
