/* 저장 팀 불러오기(보관함 › 팀 등록 → 작전판). 자리 맞추기 · 유니폼 · 다른 장면 반영만 — 저장소와 화면은 건드리지 않는다. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSTeamLoad=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
/* 제보 5400cd9e — 예전엔 판에 놓아 둔 토큰을 지우고 늘 4-3-3 으로 새로 놓았다. 이제 판 위 토큰이 곧 자리다(위치·id 그대로, 이름·번호만).
   자리(slot)는 작전판 FORM 과 같은 [nx, ny, 번호, 포지션] — 판 위 토큰이면 _sqTokSlots 가 만든다(포지션 표시, 없으면 위치로 짐작).
   기본 포지션 코드 — 작전판은 자기 posCode · posBase · posGroup(한글 이름까지 읽는다)을 넘긴다. 코드는 같은 값을 낸다. */
var ALIAS={CDM:'DM',CAM:'AM',LCDM:'LDM',RCDM:'RDM'};
function code(v){var k=String(v||'').toUpperCase().replace(/[^A-Z]/g,'');return ALIAS[k]||k;}
function base(v){v=code(v);if(/^(L|R)?CB$/.test(v))return 'CB';if(/^(L|R)?CM$/.test(v))return 'CM';if(/^(L|R)?DM$/.test(v))return 'DM';if(v==='CF')return 'ST';if(v==='LWB')return 'LB';if(v==='RWB')return 'RB';return v;}
function group(v){v=code(v);if(!v)return '';if(v==='GK')return 'GK';if(/CB|LB|RB|WB|FB/.test(v))return 'DF';if(/DM|CM|AM|LM|RM/.test(v))return 'MF';return 'FW';}
/* 정확히 맞는 자리가 없을 때 가까운 자리(기본 코드끼리, 양쪽으로) — 윙어 ↔ 측면 미드, 풀백 ↔ 왼·오른 풀백, 공격형·수비형 ↔ 중앙 */
var NEAR={};[['LW','LM'],['RW','RM'],['W','LW'],['W','RW'],['W','LM'],['W','RM'],['FB','LB'],['FB','RB'],['AM','CM'],['DM','CM'],['AM','ST']].forEach(function(p){NEAR[p[0]+'|'+p[1]]=NEAR[p[1]+'|'+p[0]]=1;});
/* 선수(목록 순서 = 우선순위)를 자리에. 단계마다 모든 선수를 먼저 돌린다: 같은 코드 → 같은 기본(LCB·RCB → CB) → 가까운 자리 → 같은 줄 →
   남은 자리(골키퍼 자리와 필드 자리는 섞지 않고) → 그래도 남으면 아무 자리. 같은 조건이면 왼쪽(ny 작은 쪽)부터. 자리보다 많은 선수는 extra. */
function match(slots,players,fn){
 fn=fn||{};var C=fn.code||code,B=fn.base||base,G=fn.group||group;
 function info(pos){var c=C(pos)||'';return {c:c,b:c&&(B(c)||''),g:c&&(G(c)||'')};}
 var S=slots.map(function(s){return info(s&&s[3]);}),P=players.map(function(p){return info(p&&p.pos);});
 var order=slots.map(function(_,i){return i;}).sort(function(a,b){return ((+slots[a][1]||0)-(+slots[b][1]||0))||((+slots[a][0]||0)-(+slots[b][0]||0))||(a-b);});
 var pick=slots.map(function(){return -1;}),used=players.map(function(){return false;});
 function pass(ok){P.forEach(function(p,j){if(used[j])return;for(var k=0;k<order.length;k++){var i=order[k];if(pick[i]<0&&ok(S[i],p)){pick[i]=j;used[j]=true;return;}}});}
 pass(function(s,p){return !!p.c&&s.c===p.c;});
 pass(function(s,p){return !!p.b&&s.b===p.b;});
 pass(function(s,p){return !!p.b&&!!NEAR[p.b+'|'+s.b];});
 pass(function(s,p){return !!p.g&&s.g===p.g;});
 pass(function(s,p){return (s.g==='GK')===(p.g==='GK');});
 pass(function(){return true;});
 return {pick:pick,extra:used.reduce(function(a,u,j){if(!u)a.push(j);return a;},[])};
}
/* 대기 줄(운동장 아래, 오른쪽부터 16명마다 한 줄 위) — 2.903 과 같은 자리 */
function bench(k){return [0.955-(k%16)*0.058,0.965-Math.floor(k/16)*0.05];}
/* keep: 판 위 토큰이 자리 — 새로 놓는 건 대기 줄뿐. 아니면 포메이션 자리에 새로 놓는다(빈 자리는 비워 둔다). x·y 는 우리 진영 기준 정규 좌표 */
function plan(slots,players,opts){
 opts=opts||{};var m=match(slots,players,opts),add=[];
 if(!opts.keep)slots.forEach(function(s,i){if(m.pick[i]>=0)add.push({p:players[m.pick[i]],x:s[0],y:s[1]});});
 m.extra.forEach(function(j,k){var b=bench(k);add.push({p:players[j],x:b[0],y:b[1],bench:true});});
 return {pick:m.pick,add:add,bench:m.extra.length};
}
/* 판 위 토큰에 저장 선수를 입힌다 — 위치·id·크기는 그대로. 포지션 표시는 토큰 것이 자리라 비어 있을 때만 채운다. 선수가 없으면 이름만 비운다.
   img: 이 기기의 선수 사진(data URL, PSTeamPhotos). 토큰에 코치가 직접 올린 사진이 있으면 그대로 두고, 팀 불러오기가 넣은 사진(imgTeam 지문이 맞는 것)만 바꾸거나 뺀다 */
function mark(s){s=String(s||'');for(var h=0,i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return s.length+':'+(h>>>0).toString(36);}
function dress(t,p,img){if(!t)return t;if(p){t.name=String(p.name||'').trim()||null;if(p.no!=null&&String(p.no)!=='')t.num=p.no;if(!t.pos&&p.pos)t.pos=p.pos;}else t.name=null;
 if(!t.img||t.imgTeam===mark(t.img)){if(p&&img){t.img=img;t.imgTeam=mark(img);}else{delete t.img;delete t.imgTeam;}}
 return t;}
/* 저장 팀 유니폼을 고른 쪽(side)에만 — 색은 #rrggbb, 무늬는 작전판 목록(pats)에 있는 것만 */
var KIT_MAP={main:'teamColors',accent:'teamColor2',stroke:'teamStrokeC',text:'teamTxtC',gkMain:'gkColors',gkAccent:'gkColor2',gkStroke:'gkStrokeC',gkText:'gkTxtC'};
function kit(state,k,side,pats){
 if(!state||!k||typeof k!=='object')return state;
 Object.keys(KIT_MAP).forEach(function(key){if(/^#[0-9a-f]{6}$/i.test(k[key]||'')){var f=KIT_MAP[key];state[f]=state[f]||{};state[f][side]=k[key];}});
 [['pattern','teamPattern'],['gkPattern','gkPattern']].forEach(function(p){if((pats||[]).indexOf(k[p[0]])>=0){state[p[1]]=state[p[1]]||{};state[p[1]][side]=k[p[0]];}});
 return state;
}
/* 지금 페이지의 다른 장면에도 — 같은 토큰(id)은 이름·번호·포지션·사진을 같이(사진은 작전판처럼 장면마다 같다), 이번에 새로 놓은 토큰은 없는 장면에 넣는다(없으면 재생 때 나타났다 사라진다).
   장면 묶음(snap)은 새 객체로 바꾼다 — 되돌리기 사본이 옛 객체를 쥐고 있다. 바꾼 장면 수를 돌려준다 */
function frames(list,active,toks,fresh){
 var by={},n=0;(toks||[]).forEach(function(t){if(t)by[t.id]=t;});
 (list||[]).forEach(function(f,k){if(!f||!f.snap||k===active)return;
  var arr=(f.snap.players||[]).map(function(q){var t=q&&by[q.id];if(!t)return q;var c=Object.assign({},q,{name:t.name==null?null:t.name,num:t.num,pos:t.pos||''});
   if(t.img){c.img=t.img;if(t.imgTeam)c.imgTeam=t.imgTeam;else delete c.imgTeam;}else if(q.img&&q.imgTeam===mark(q.img)){delete c.img;delete c.imgTeam;}return c;});
  (fresh||[]).forEach(function(t){if(!arr.some(function(q){return q&&q.id===t.id;}))arr.push(JSON.parse(JSON.stringify(t)));});
  f.snap=Object.assign({},f.snap,{players:arr});delete f.thumb;n++;});
 return n;
}
/* 3.135 — 저장 팀은 판 전체(오류 제보 738f37d1 «팀 불러오기를 모든 장면에»). frames 는 같은 id 만 찾아, 포메이션을 다시 놓은 장면(새 id)엔 이름이 안 들어갔고
   다른 페이지 · 미팅의 다른 슬라이드는 건드리지 않았다. 같은 선수 찾기(who): 입힌 토큰(src = [{t, team, key: 불러오기 전 번호}])과
   같은 id → 아니면 같은 팀 + 불러오기 전 번호(작업 보드 2.975 _nmApplySnap 과 같은 규칙). 미팅 슬라이드는 번호 먼저(2.970 — 경기에서 가져온 장은 id 가 겹친다).
   두 토큰이 같이 쓰던 번호 · 코치 · 이번에 새로 놓은 토큰(skip — 새 번호가 옛 번호와 부딪친다)은 번호로 찾지 않는다 */
function who(src,skip){var id={},key={},dup={},no={};(skip||[]).forEach(function(i){no[i]=1;});
 (src||[]).forEach(function(s){if(!s||!s.t)return;id[s.t.id]=s.t;if(no[s.t.id])return;var k=s.key==null?'':String(s.key).trim();if(!k)return;k=s.team+'|'+k;if(key[k])dup[k]=1;else key[k]=s.t;});
 Object.keys(dup).forEach(function(k){delete key[k];});
 return function(q,numFirst){if(!q||q.coach||no[q.id])return null;var n=q.num==null?'':String(q.num).trim(),byK=n?(key[q.team+'|'+n]||null):null,byI=id[q.id]||null;
  if(byI&&byI.team!==q.team)byI=null;return numFirst?(n?byK:byI):(byI||byK);};}
function same(a,b){return (a==null?'':String(a))===(b==null?'':String(b));}
/* 한 장면(snap)에 입힌다 — 그 장면의 자리 · 크기 · 포지션 표시는 그대로(비었을 때만 채움), 이름 · 번호와 팀 사진은 따라간다(코치가 올린 사진은 둔다 — dress 와 같다).
   바뀐 토큰만 새 객체 · 새 배열(옛 배열은 되돌리기가 쥔다). 바뀐 것이 없으면 null */
function wear(sn,find,numFirst){
 if(!sn||!Array.isArray(sn.players)||typeof find!=='function')return null;var ch=0;
 var arr=sn.players.map(function(q){var t=find(q,numFirst);if(!t||t===q)return q;
  var c=Object.assign({},q);c.name=t.name==null?null:t.name;if(t.num!=null&&String(t.num)!=='')c.num=t.num;if(!c.pos&&t.pos)c.pos=t.pos;
  if(!q.img||q.imgTeam===mark(q.img)){if(t.img&&t.imgTeam){c.img=t.img;c.imgTeam=t.imgTeam;}else{delete c.img;delete c.imgTeam;}}
  if(same(c.name,q.name)&&same(c.num,q.num)&&same(c.pos,q.pos)&&c.img===q.img&&c.imgTeam===q.imgTeam)return q;
  ch++;return c;});
 return ch?{players:arr,was:sn.players}:null;
}
return {code:code,base:base,group:group,match:match,bench:bench,plan:plan,dress:dress,mark:mark,kit:kit,frames:frames,who:who,wear:wear};
});
