/* PROCESS STUDIO — 이력서·세부평가 PDF 내보내기 다국어 라벨 (한국어/일본어/영어)
   scout.html(팀·스카우트)·idp.html(선수 IDP) 두 곳이 공유. 고정 라벨만 번역하고
   사용자 콘텐츠(이름·메모·팀 속성 어휘·포지션 약칭)는 입력한 그대로 둔다. */
(function(){
  var I18N = {
    ko: {
      resumeTitle:'선수 이력서', profileCap:'Profile', basicInfo:'기본 정보',
      birth:'생년월일', height:'키', weight:'몸무게', foot:'주발',
      footL:'왼발', footR:'오른발', footB:'양발', blood:'혈액형', phone:'연락처', email:'이메일',
      position:'포지션', mainPos:'주 포지션', subPos:'서브 포지션', agent:'에이전트',
      career:'축구 경력', startFb:'축구 시작', elem:'초등', mid:'중등', high:'고등', univ:'대학',
      awards:'주요 성과', comp:'대회', video:'영상', highlight:'하이라이트',
      photo:'사진', createdSuffix:'작성', player:'선수', club:'소속팀', itemsLb:'항목',
      catScores:'영역별 점수', totalAvg:'종합 평균', evalTitle:'세부 평가',
      levelNow:'현재 레벨', target:'목표 레벨'
    },
    ja: {
      resumeTitle:'選手履歴書', profileCap:'Profile', basicInfo:'基本情報',
      birth:'生年月日', height:'身長', weight:'体重', foot:'利き足',
      footL:'左足', footR:'右足', footB:'両足', blood:'血液型', phone:'連絡先', email:'メール',
      position:'ポジション', mainPos:'メインポジション', subPos:'サブポジション', agent:'エージェント',
      career:'サッカー経歴', startFb:'サッカー開始', elem:'小学', mid:'中学', high:'高校', univ:'大学',
      awards:'主な実績', comp:'大会', video:'映像', highlight:'ハイライト',
      photo:'写真', createdSuffix:'作成', player:'選手', club:'所属チーム', itemsLb:'項目',
      catScores:'領域別スコア', totalAvg:'総合平均', evalTitle:'詳細評価',
      levelNow:'現在レベル', target:'目標レベル'
    },
    en: {
      resumeTitle:'Player Profile', profileCap:'Profile', basicInfo:'Basic Info',
      birth:'Date of Birth', height:'Height', weight:'Weight', foot:'Preferred Foot',
      footL:'Left', footR:'Right', footB:'Both', blood:'Blood Type', phone:'Phone', email:'Email',
      position:'Position', mainPos:'Main Position', subPos:'Sub Position', agent:'Agent',
      career:'Football Career', startFb:'Started', elem:'Elementary', mid:'Middle', high:'High', univ:'University',
      awards:'Key Achievements', comp:'Competition', video:'Video', highlight:'Highlight',
      photo:'Photo', createdSuffix:'created', player:'Player', club:'Club', itemsLb:'items',
      catScores:'Scores by Area', totalAvg:'Overall Average', evalTitle:'Detailed Evaluation',
      levelNow:'Current Level', target:'Target Level'
    }
  };
  var LANGS = [['ko','한국어'],['ja','日本語'],['en','English']];
  /* 라벨 묶음 반환 — 없는 언어는 한국어로 폴백 */
  window.rptLabels = function(lang){ return I18N[lang] || I18N.ko; };
  window.rptLangs = LANGS;
  /* 마지막 선택 언어 기억(기기 설정) */
  window.rptLangGet = function(){ try{ return localStorage.getItem('cs_rpt_lang') || 'ko'; }catch(_){ return 'ko'; } };
  window.rptLangSet = function(l){ try{ localStorage.setItem('cs_rpt_lang', l); }catch(_){} };
  /* 언어 선택 오버레이 — cb(lang) 콜백. 취소하면 호출 안 함 */
  window.rptPickLang = function(cb){
    var cur = window.rptLangGet();
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(8,12,18,.5);display:flex;align-items:center;justify-content:center;padding:20px';
    var card = document.createElement('div');
    card.style.cssText = 'width:100%;max-width:320px;background:#fff;border-radius:16px;box-shadow:0 22px 64px rgba(0,0,0,.4);padding:18px;box-sizing:border-box;font-family:inherit';
    card.innerHTML = '<div style="font-size:15px;font-weight:800;color:#16181c;margin-bottom:4px">내보내기 언어</div>'
      + '<div style="font-size:12px;color:#8a9099;margin-bottom:14px">이름·메모 등 입력한 내용은 그대로, 항목 이름만 번역돼요</div>';
    LANGS.forEach(function(L){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = L[1];
      var on = L[0]===cur;
      b.style.cssText = 'display:block;width:100%;text-align:left;border:1.5px solid '+(on?'#3A6DF0':'#E3E5E9')+';border-radius:11px;background:'+(on?'rgba(58,109,240,.08)':'#F1F2F4')+';color:'+(on?'#3A6DF0':'#16181c')+';font-family:inherit;font-size:14px;font-weight:700;padding:12px 14px;margin-bottom:8px;cursor:pointer';
      b.onclick = function(){ window.rptLangSet(L[0]); document.body.removeChild(ov); cb(L[0]); };
      card.appendChild(b);
    });
    var cancel = document.createElement('button');
    cancel.type = 'button'; cancel.textContent = '취소';
    cancel.style.cssText = 'display:block;width:100%;border:0;background:none;color:#8a9099;font-family:inherit;font-size:13px;font-weight:700;padding:8px;margin-top:2px;cursor:pointer';
    cancel.onclick = function(){ document.body.removeChild(ov); };
    card.appendChild(cancel);
    ov.appendChild(card);
    ov.addEventListener('click', function(e){ if(e.target===ov) document.body.removeChild(ov); });
    document.body.appendChild(ov);
  };
})();
