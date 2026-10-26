/* PROCESS STUDIO — 역할 교과서 변환기.
   LR_CUR의 본문·예시·문항에 트랙별 ADD의 읽기·회상·해설·카드를 결합한다.
   참고자료는 학습용 재구성의 배경이며, 협회의 공식 교재나 자격 등급과 대응하지 않는다.
   절·카드 ID는 저장된 진도와 연결되므로 유지한다. */
(function(){

/* ── 절마다 덧붙이는 것 ─────────────────────────────────────────────────────
   키는 LR_CUR 의 레슨 id 그대로. 한 모듈이 다 채워져야 그 모듈이 책으로 열린다. */
/* ⚠ 내용은 **트랙별 파일**이 채운다(learn-book-player.js …). 이 파일은 기계만 갖는다 —
   59절, 끝내 275절이 한 파일에 들어가면 글 고치다 기계를 깨뜨린다. */
var ADD=(window.LR_BOOK_ADD=window.LR_BOOK_ADD||{});

/* ── 장 머리 질문 — 이 모듈이 답하는 것들(renderToc·장 화면에서 쓴다) ─────── */
var HEAD=(window.LR_BOOK_HEAD=window.LR_BOOK_HEAD||{});

/* ── LR_CUR 모듈 → 『게임모델 만드는 법』과 같은 모양의 책 ────────────────── */
function srcOf(m){
  var C=window.LR_CUR;
  return (m.src||[]).map(function(k){ var o=C&&C.sources&&C.sources[k]; return o?o.ko:k; }).join(" · ");
}
/* act 는 절반쯤만 코치·선수 둘 다 갖고 있다(113/275). 하나뿐이면 그 하나만 보인다 —
   없는 관점을 지어내지 않는다. */
function exOf(l){
  var a=l.act, out=[];
  if(!a)return out;
  if(typeof a==="string")return [{who:"해보기",t:a}];
  if(a.coach)out.push({who:"코치",t:a.coach});
  if(a.player)out.push({who:"선수",t:a.player});
  Object.keys(a).forEach(function(k){ if(k!=="coach"&&k!=="player")out.push({who:k,t:a[k]}); });
  return out;
}
/* quiz(정답 인덱스) → mc(정답 표시). ⚠ 원본은 275개 중 263개가 2번이라 렌더러가 섞는다 —
   여기서 순서를 건드리면 그 시드 섞기와 두 번 싸운다. 그대로 옮기기만 한다. */
function mcOf(l){
  if(!l.quiz)return null;
  return { q:l.quiz.q,
    o:(l.quiz.o||[]).map(function(t,i){ return {id:"o"+(i+1),t:t,ok:(i===l.quiz.a)}; }),
    why:l.quiz.why||"" };
}
/* 원본 body·points 를 읽기로 옮기는 길 — ADD 에 read 가 없을 때만 쓴다 */
function readFrom(l){
  var read=[l.body||""];
  if(l.points&&l.points.length)read=read.concat(l.points.map(function(p){return "- "+p;}));
  return read.filter(Boolean);
}
/* ⚠ 2.438b — 사용자가 **본문도 새로 쓴다**를 골랐다(선수 트랙부터).
   그래서 ADD 는 어느 칸이든 덮을 수 있다 — read·ex·mc 를 적으면 그것이 이기고,
   안 적으면 LR_CUR 원본에서 옮겨 온다. 한 트랙을 다시 쓰는 동안 나머지 트랙은
   원본 그대로 돌아야 해서, 둘을 한 함수가 같이 감당한다.
   ⚠ 근거(src)는 **어느 쪽이든 원본 모듈에서 온다** — 본문을 새로 써도 관련 참고자료를
      제공하되 개별 예시가 협회의 공식 처방이라는 뜻으로 표시하지 않는다. */
function secOf(l,m){
  var A=ADD[l.id]; if(!A)return null;
  return { id:l.id, ko:A.ko||l.ko, src:A.src||srcOf(m), references:A.references||(m.src||[]).map(function(k){var r=window.LR_CUR.sources[k];return r&&r.url?{label:r.ko,url:r.url}:null;}).filter(Boolean),
    pre:A.pre, read:A.read||readFrom(l), fig:A.fig, ex:A.ex||exOf(l),
    recall:A.recall, why:A.why, fb:A.fb, cards:A.cards, mc:A.mc||mcOf(l),
    links:({player:"IDP › 목표에서 이번에 키울 행동을 정하고 일지에서 돌아보세요.",coach:"팀 운영 › 팀 기준 › 플레이북에서 우리 팀의 원칙과 연결해 보세요.",physical:"팀 운영 › 일정에서 계획과 실제 참여를 함께 확인하세요.",analysis:"팀 운영 › 경기에서 관찰한 장면과 다음 훈련 과제를 연결하세요.",at:"건강·복귀 판단은 담당 의료진과 협의하고 필요한 범위에서만 팀과 공유하세요."})[m.track]||"" };
}
/* 이 모듈의 **모든** 절이 채워졌을 때만 책이 된다 — 반쯤 채운 책은 중간에 벽을 만든다 */
function has(mid){
  var m=modOf(mid); if(!m||!m.lessons||!m.lessons.length)return false;
  return m.lessons.every(function(l){ var A=ADD[l.id]; return !!A&&(!!A.mc||!!l.quiz); });
}
function modOf(mid){
  var C=window.LR_CUR; if(!C)return null;
  if(C.module){ var m=C.module(mid); if(m)return m; }
  return (C.modules||[]).filter(function(x){return x.id===mid;})[0]||null;
}
/* 장 끝 '섞어 묻기' — 절들의 **꺼내기 + 가려내기를 번갈아** 놓는다.
   ⚠ 새 문항을 지어내지 않는다. 교차 인출(interleaving)의 값은 문항이 새로워서가 아니라
      **여러 절이 섞여 나와서** 나온다 — 방금 그 절에서 답한 것을 다른 절들 사이에서 다시 꺼낸다. */
function mixOf(secs){
  var out=[];
  secs.forEach(function(s){
    if(s.recall)out.push({kind:"서술",note:"꺼내기",q:s.recall.q,a:s.recall.a});
    if(s.mc)out.push({kind:"가려내기",q:s.mc.q,o:s.mc.o,why:s.mc.why});
  });
  return out;
}
function of(mid){
  var m=modOf(mid); if(!m||!has(mid))return null;
  var secs=m.lessons.map(function(l){ return secOf(l,m); }).filter(Boolean);
  return { id:"cur:"+m.id, ko:m.ko, tag:"교과서", sub:srcOf(m),
    chapters:[{ id:m.id, ko:m.ko, head:HEAD[m.id]||[], sections:secs, mix:mixOf(secs) }] };
}
/* 지금까지 책으로 열리는 모듈 — 진행률을 정직하게 말하기 위해 */
function ready(){
  var C=window.LR_CUR; if(!C)return [];
  return (C.modules||[]).filter(function(m){ return has(m.id); }).map(function(m){ return m.id; });
}

/* 이 절이 교과서(LR_CUR) 절인가 — 완료를 두 곳에 적을지 판단하는 데 쓴다 */
function isCurSec(lid){ return !!ADD[lid]; }

window.LR_BOOK={ add:ADD, head:HEAD, of:of, has:has, ready:ready, isCurSec:isCurSec };
})();
