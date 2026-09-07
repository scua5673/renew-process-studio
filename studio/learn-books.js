/* PROCESS STUDIO — 학습: 역할 교과서를 『게임모델 만드는 법』과 **같은 7단계 고리**로 (2.438)
   ─────────────────────────────────────────────────────────────────────────────
   ⚠⚠ 이 파일은 **본문을 다시 쓰지 않는다.** LR_CUR(90모듈 275절, 45K자)은
      국제표준(UEFA·FA·FIFA·KNVB·KFA·IFAB) 재서술이라 근거가 붙어 있다 — 그걸 버리면
      "국제표준을 우리말로"라는 이 교과서의 존재 이유가 없어진다.
      여기서는 **7단계 고리에 없는 것만 절마다 덧붙인다**(add).

   LR_CUR 이 이미 가진 것 → 고리에 그대로 쓰인다
     body·points → read(읽기)      act{coach,player} → ex(예시)      quiz → mc(가려내기)
   여기서 새로 쓰는 것 (절마다 여섯)
     pre    0단계 먼저 묻기 — 읽기 전에 스스로 답해 보는 질문(틀려도 됨)
     fig    1단계 한 줄로 잡기
     recall 3단계 꺼내기 — 서술형(보지 않고 쓰고 스스로 채점)
     why    4단계 0번에 쓴 내 답과 견주는 질문
     fb     5단계 오개념 교정 — **틀리기 쉬운 지점**을 짚는다(quiz.why 는 짧아서 따로 쓴다)
     cards  6단계 남는 것 — 간격반복 카드(3일·1주·3주)

   ⚠ `add` 에 없는 절은 **책으로 열리지 않는다**(has() 가 false). 억지로 틀만 씌우면
      "이 절의 핵심은?" 같은 빈 질문이 275번 나온다 — 그건 학습이 아니라 껍데기다.
      쓴 만큼만 열고, 나머지는 예전 화면(renderLesson)이 그대로 맡는다. */
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
   ⚠ 근거(src)는 **어느 쪽이든 원본 모듈에서 온다** — 본문을 새로 써도 협회 출처는
      그 절이 무엇을 근거로 하는지 말해야 한다(그게 이 교과서의 존재 이유다). */
function secOf(l,m){
  var A=ADD[l.id]; if(!A)return null;
  return { id:l.id, ko:A.ko||l.ko, src:srcOf(m),
    pre:A.pre, read:A.read||readFrom(l), fig:A.fig, ex:A.ex||exOf(l),
    recall:A.recall, why:A.why, fb:A.fb, cards:A.cards, mc:A.mc||mcOf(l),
    links:m.flow||m.why||"" };
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
