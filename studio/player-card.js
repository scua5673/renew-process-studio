/* 3.093 — 한 장 선수 카드(A4 세로) — 프로필 요점 + 평가 요약을 한 장에. 점수는 막대 + 숫자(사용자 «한 장 선수 카드» · «막대 + 숫자»).
   프로필 한 장(profile-sheet.js) · 일정 PDF 와 같은 담백한 결: 흰 바탕 · 검은 글자 · 가는 선.
   쓰는 법: PSPlayerCard.docHTML(model) → HTML 문서 문자열. model 은 아래 norm() 참고. scout.html 의 playerCardModel(id) 가 만든다. */
(function(root){
  "use strict";
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function lines(v,max){
    if(Array.isArray(v))v=v.join("\n");
    var out=String(v||"").split(/\r?\n/).map(function(s){return s.replace(/^\s*\d+[.)]?\s*/,"").trim();}).filter(Boolean);
    return max?out.slice(0,max):out;
  }
  function parseDob(s){
    var m=/(\d{4})(?:\D+(\d{1,2})(?:\D+(\d{1,2}))?)?/.exec(String(s||""));
    if(!m)return null;
    var y=+m[1],mo=m[2]?+m[2]:1,d=m[3]?+m[3]:1;
    if(y<1900||y>2100||mo<1||mo>12||d<1||d>31)return null;
    return {y:y,m:mo,d:d,full:!!m[3]};
  }
  function ageOf(dob,now){
    var p=parseDob(dob); if(!p)return "";
    now=now||new Date();
    var a=now.getFullYear()-p.y;
    if(p.full){ if(now.getMonth()+1<p.m||(now.getMonth()+1===p.m&&now.getDate()<p.d))a--; }
    return a>=0&&a<100?String(a):"";
  }
  function fmtDob(dob){
    var p=parseDob(dob); if(!p)return String(dob||"").trim();
    return p.full?(p.y+"."+String(p.m).padStart(2,"0")+"."+String(p.d).padStart(2,"0")):String(p.y);
  }
  var POS_EN={GK:"Goalkeeper",CB:"Center Back",LCB:"Center Back",RCB:"Center Back",LB:"Left Back",RB:"Right Back",FB:"Full Back",WB:"Wing Back",LWB:"Left Wing Back",RWB:"Right Wing Back",
    DM:"Defensive Midfielder",CM:"Central Midfielder",AM:"Attacking Midfielder",LM:"Left Midfielder",RM:"Right Midfielder",LW:"Left Winger",RW:"Right Winger",SS:"Second Striker",FW:"Forward",CF:"Center Forward",ST:"Striker"};
  function posEn(abbr){ var k=String(abbr||"").trim().toUpperCase(); return POS_EN[k]||(/^[LR]/.test(k)&&POS_EN[k.slice(1)])||k; }   /* LCM · RDM … → 가운데 이름 */
  function footKo(v){
    var s=String(v||"").trim(); if(!s)return "";
    if(/^R$|오른|right/i.test(s))return "오른발";
    if(/^L$|왼|left/i.test(s))return "왼발";
    if(/^B$|양|both/i.test(s))return "양발";
    return s;
  }
  function ymd(d){ d=d||new Date(); return d.getFullYear()+"."+String(d.getMonth()+1).padStart(2,"0")+"."+String(d.getDate()).padStart(2,"0"); }
  function num1(x){ return (Math.round(x*10)/10).toFixed(1); }
  function clamp5(v){ v=+v||0; return v<0?0:(v>5?5:v); }

  var CSS='*{box-sizing:border-box}@page{size:A4 portrait;margin:0}html,body{margin:0;padding:0;background:#fff}'
  +'body{font-family:Pretendard,"IBM Plex Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#111418;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
  +'.a4{width:210mm;height:297mm;position:relative;overflow:hidden;display:flex;flex-direction:column;background:#fff;page-break-after:always}'
  +'.hd{margin:0 10mm;padding:10mm 0 5mm;border-bottom:2px solid #111418;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm}'
  +'.hd .l b{display:block;font-weight:700;font-size:11px;letter-spacing:.24em;color:#6B7280}.hd .l small{display:block;font-weight:500;font-size:10px;letter-spacing:.14em;color:#9CA3AF;margin-top:6px}'
  +'.hd .r{text-align:right;min-width:0}.hd .r i{display:block;font-weight:600;font-size:11px;letter-spacing:.2em;color:#6B7280;font-style:normal}'
  +'.hd .r b{display:block;font-weight:800;font-size:34px;line-height:1.05;letter-spacing:-.02em;margin-top:6px;word-break:keep-all}.hd .r small{display:block;font-weight:600;font-size:13px;color:#6B7280;margin-top:4px}'
  +'.top{margin:0 10mm;display:grid;grid-template-columns:27mm 1fr;gap:5mm;padding:4mm 0;border-bottom:1px solid #E5E7EB}'
  +'.ph{height:34mm;background:#F3F4F6;display:grid;place-items:center;font-weight:600;font-size:10px;letter-spacing:.14em;color:#9CA3AF;overflow:hidden}'
  +'.ph img{width:100%;height:100%;object-fit:cover;display:block}'
  +'.g{display:grid;grid-template-columns:repeat(3,1fr);align-content:center}'
  +'.g div{padding:10px 8px 9px 0;border-bottom:1px solid #E5E7EB;min-width:0}.g div:nth-last-child(-n+3){border-bottom:0}'
  +'.g span{display:block;font-weight:600;font-size:9px;letter-spacing:.14em;color:#9CA3AF}'
  +'.g b{display:block;font-weight:700;font-size:15px;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +'.bd{margin:0 10mm;flex:1;min-height:0;display:flex;flex-direction:column;flex-wrap:wrap;align-content:flex-start;justify-content:space-between;overflow:hidden}.bd>*{width:100%}'
  +'h6{flex:0 0 auto;margin:15px 0 10px;padding-bottom:6px;border-bottom:1px solid #111418;font-weight:800;font-size:12px;letter-spacing:.14em;display:flex;justify-content:space-between;align-items:baseline}'
  +'h6 span{font-weight:500;font-size:11px;letter-spacing:.02em;color:#9CA3AF}'
  +'.sum{flex:1 1 auto;display:grid;grid-template-columns:40mm 1fr;gap:8mm;align-items:stretch}.ov{align-self:center}'
  +'.ov span{display:block;font-weight:600;font-size:9px;letter-spacing:.18em;color:#9CA3AF}'
  +'.ov b{display:block;font-weight:800;font-size:60px;line-height:1;letter-spacing:-.04em;margin-top:6px;font-variant-numeric:tabular-nums}'
  +'.ov b i{font-style:normal;font-weight:600;font-size:16px;letter-spacing:0;color:#9CA3AF;margin-left:6px}'
  +'.ov small{display:block;font-weight:500;font-size:11px;color:#6B7280;margin-top:8px}'
  +'.bars{display:flex;flex-direction:column;justify-content:space-evenly;gap:9px}'
  +'.br{display:grid;grid-template-columns:31mm 1fr 11mm;align-items:center;gap:12px}'
  +'.br span{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.br span small{font-weight:500;font-size:11px;color:#6B7280;margin-left:5px}'
  +'.tr{height:7px;background:#EEF0F3;border-radius:4px;overflow:hidden}.tr i{display:block;height:100%;background:#111418;border-radius:4px}'
  +'.br b{text-align:right;font-weight:800;font-size:15px;font-variant-numeric:tabular-nums}'
  +'.na b{color:#B0B5BC!important}'
  +'.det{flex:2 1 auto;display:grid;grid-template-columns:repeat(3,1fr);column-gap:7mm;row-gap:12px;align-content:stretch}.blk{display:grid;grid-template-columns:100%}'
  +'.blk h5{margin:0 0 3px;padding-bottom:4px;border-bottom:1px solid #E5E7EB;font-weight:800;font-size:11px;display:flex;justify-content:space-between;align-items:baseline;gap:6px}'
  +'.blk h5 em{font-style:normal;font-weight:800;font-variant-numeric:tabular-nums}.blk h5 small{font-weight:500;font-size:10px;color:#9CA3AF;margin-right:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}'
  +'.it{display:grid;grid-template-columns:1fr 12mm 12px;align-items:center;gap:6px;min-height:19px;font-weight:500;font-size:10.5px;color:#374151}'
  +'.it span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.it .tr{height:4px;border-radius:2px}.it .tr i{border-radius:2px}'
  +'.it b{text-align:right;font-weight:700;color:#111418;font-variant-numeric:tabular-nums}'
  +'.two{display:grid;grid-template-columns:1fr 1fr;column-gap:8mm}'
  +'.str{display:grid;gap:8px}.str>div{display:grid;grid-template-columns:20px 1fr auto;gap:10px;align-items:center;font-weight:500;font-size:13px}'
  +'.str>div>i{width:20px;height:20px;border-radius:50%;background:#111418;color:#fff;display:grid;place-items:center;font-weight:700;font-size:10px;font-style:normal}'
  +'.str.dev>div>i{background:#fff;color:#111418;box-shadow:inset 0 0 0 1.5px #111418}'
  +'.str>div>b{font-weight:700;font-size:12px;color:#6B7280;font-variant-numeric:tabular-nums}'
  +'.str .no{grid-template-columns:1fr;color:#9CA3AF;font-size:12px}'
  +'.note{flex:6 1 30mm;display:flex;flex-direction:column}.note .ln{flex:1 1 auto;min-height:0;background:repeating-linear-gradient(to bottom,transparent 0,transparent 27px,#E5E7EB 27px,#E5E7EB 28px)}'
  +'.ft{margin:0 10mm;padding:4mm 0 8mm;border-top:1px solid #E5E7EB;display:grid;grid-template-columns:1fr auto;gap:20px;align-items:end}'
  +'.ft span{display:block;font-weight:600;font-size:9px;letter-spacing:.16em;color:#9CA3AF}.ft b{display:block;font-weight:600;font-size:12px;margin-top:4px}.ft .r{text-align:right}'
  +'@media screen{.a4{margin:0 auto}}';

  /* model: {team, nameKr, nameEn, pos(약어), subs[약어], num, foot, dob, height, weight, photo(src),
     areas:[{name, sub?, pos?(포지션 문항이면 true — 종합 점수엔 안 넣는다), items:[{name, v(0~5, 0=안 매김)}]}],
     strengths(글 · 줄마다), develop(글), coach, issued} */
  function norm(m){
    m=m||{};
    var areas=(Array.isArray(m.areas)?m.areas:[]).map(function(a){
      var items=(Array.isArray(a&&a.items)?a.items:[]).map(function(it){return {name:String((it&&it.name)||"").trim(),v:clamp5(it&&it.v)};}).filter(function(it){return it.name;});
      var r=items.filter(function(it){return it.v>0;});
      return {name:String((a&&a.name)||"").trim(),sub:String((a&&a.sub)||"").trim(),pos:!!(a&&a.pos),items:items,n:r.length,
        avg:r.length?r.reduce(function(s,it){return s+it.v;},0)/r.length:0};
    }).filter(function(a){return a.name&&a.items.length;});
    return {
      team:String(m.team||"").trim(), nameKr:String(m.nameKr||"").trim(), nameEn:String(m.nameEn||"").trim(),
      pos:String(m.pos||"").trim(), subs:lines(m.subs).slice(0,3), num:String(m.num==null?"":m.num).trim(), foot:footKo(m.foot),
      dob:String(m.dob||"").trim(), height:String(m.height||"").replace(/[^\d.]/g,""), weight:String(m.weight||"").replace(/[^\d.]/g,""),
      photo:String(m.photo||""), areas:areas, strengths:lines(m.strengths,3), develop:lines(m.develop,2),
      coach:(function(c){c=String(c||"").trim();if(!c||c==="코치")return "";return /코치$/.test(c)?c:c+" 코치";})(m.coach), issued:m.issued||ymd()
    };
  }
  /* 종합 = 영역(전술·기술 …) 평균의 평균 — 세부평가 시트(scout.html esPageHTML)와 같은 셈. 포지션 문항은 따로 */
  function overall(areas){
    var w=areas.filter(function(a){return !a.pos&&a.n;});
    var done=0,all=0; areas.forEach(function(a){ if(a.pos)return; all+=a.items.length; done+=a.n; });
    return {v:w.length?w.reduce(function(s,a){return s+a.avg;},0)/w.length:0,done:done,all:all};
  }
  function track(v){ return '<span class="tr"><i style="width:'+(clamp5(v)*20).toFixed(1)+'%"></i></span>'; }
  /* 강점 · 보완 — 프로필에 적은 글이 먼저. 없으면 평가 점수에서(높은 3 · 낮은 2) */
  function picks(m){
    var all=[]; m.areas.forEach(function(a){ a.items.forEach(function(it){ if(it.v>0)all.push(it); }); });
    var hi=all.slice().sort(function(x,y){return y.v-x.v;}).filter(function(it){return it.v>=4;}).slice(0,3);
    var lo=all.slice().sort(function(x,y){return x.v-y.v;}).filter(function(it){return it.v<=3&&hi.indexOf(it)<0;}).slice(0,2);
    return {
      s:m.strengths.length?m.strengths.map(function(t){return {name:t};}):hi, sAuto:!m.strengths.length&&hi.length>0,
      d:m.develop.length?m.develop.map(function(t){return {name:t};}):lo, dAuto:!m.develop.length&&lo.length>0
    };
  }
  function docHTML(model){
    var m=norm(model);
    var big=m.nameEn||m.nameKr||"선수", small=[m.nameEn?m.nameKr:"",m.num?"No. "+m.num:""].filter(Boolean).join(" · ");
    var sub=[m.team,String(new Date().getFullYear())].filter(Boolean).join(" · ").toUpperCase();
    function cell(k,v){return '<div><span>'+k+'</span><b>'+(v?esc(v):"—")+'</b></div>';}
    var posTxt=m.pos?(m.pos.toUpperCase()+(m.subs.length?" · "+m.subs.join(" "):"")):"";
    var facts=cell("DATE OF BIRTH",fmtDob(m.dob))+cell("AGE",ageOf(m.dob))+cell("FOOT",m.foot)
      +cell("HEIGHT",m.height?m.height+" cm":"")+cell("WEIGHT",m.weight?m.weight+" kg":"")+cell("POSITION",posTxt);
    var ph=m.photo?'<img alt="" src="'+esc(m.photo)+'">':"PHOTO";
    var ov=overall(m.areas);
    var bd="";
    if(m.areas.length){
      bd+='<h6>EVALUATION <span>평가 · 5점 만점</span></h6>'
        +'<div class="sum" style="max-height:'+(m.areas.length*44)+'px"><div class="ov"><span>OVERALL</span><b>'+(ov.done?num1(ov.v):"—")+'<i>/ 5</i></b>'
        +'<small>'+(ov.done?'평가한 항목 '+ov.done+' / '+ov.all:'아직 평가 전')+'</small></div>'
        +'<div class="bars">'+m.areas.map(function(a){
          return '<div class="br'+(a.n?"":" na")+'"><span>'+esc(a.name)+(a.sub?'<small>'+esc(a.sub)+'</small>':"")+'</span>'+track(a.avg)+'<b>'+(a.n?num1(a.avg):"—")+'</b></div>';
        }).join("")+'</div></div>';
      var dmax=0; for(var r=0;r<m.areas.length;r+=3){ dmax+=26+30*Math.max.apply(null,m.areas.slice(r,r+3).map(function(a){return a.items.length;}))+(r?12:0); }
      bd+='<h6>DETAIL <span>세부 항목</span></h6><div class="det" style="max-height:'+dmax+'px">'+m.areas.map(function(a,k){
        var n=Math.max.apply(null,m.areas.slice(k-k%3,k-k%3+3).map(function(x){return x.items.length;}));   /* 한 줄(3칸)의 행 높이를 맞춘다 */
        return '<div class="blk" style="grid-template-rows:auto repeat('+n+',1fr)"><h5>'+esc(a.name)+(a.sub?'<small>'+esc(a.sub)+'</small>':'<small></small>')+'<em'+(a.n?"":' style="color:#B0B5BC"')+'>'+(a.n?num1(a.avg):"—")+'</em></h5>'
          +a.items.map(function(it){ return '<div class="it'+(it.v?"":" na")+'"><span>'+esc(it.name)+'</span>'+track(it.v)+'<b>'+(it.v||"—")+'</b></div>'; }).join("")+'</div>';
      }).join("")+'</div>';
    }
    var p=picks(m);
    function list(arr,dev){
      if(!arr.length)return '<div class="str'+(dev?" dev":"")+'"><div class="no">—</div></div>';
      return '<div class="str'+(dev?" dev":"")+'">'+arr.map(function(it,i){return '<div><i>'+(i+1)+'</i><div>'+esc(it.name)+'</div>'+(it.v?'<b>'+it.v+'</b>':"<b></b>")+'</div>';}).join("")+'</div>';
    }
    bd+='<div class="two"><div><h6>STRENGTHS <span>'+(p.sAuto?"강점 · 높은 점수":"강점")+'</span></h6>'+list(p.s,false)+'</div>'
      +'<div><h6>TO DEVELOP <span>'+(p.dAuto?"보완 · 낮은 점수":"보완할 점")+'</span></h6>'+list(p.d,true)+'</div></div>';
    bd+='<div class="note"><h6>NOTES <span>코치 메모</span></h6><div class="ln"></div></div>';
    var issued=[m.issued,m.coach,"PROCESS STUDIO"].filter(Boolean).join(" · ");
    var docTitle=(m.nameKr||m.nameEn||"선수")+"_선수카드_"+m.issued.replace(/\./g,"-");
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+esc(docTitle)+'</title><style>'+CSS+'</style></head><body>'
      +'<div class="a4">'
      +'<div class="hd"><div class="l"><b>PLAYER CARD</b>'+(sub?'<small>'+esc(sub)+'</small>':"")+'</div><div class="r">'+(m.pos?'<i>'+esc(posEn(m.pos).toUpperCase())+'</i>':"")+'<b>'+esc(big)+'</b>'+(small?'<small>'+esc(small)+'</small>':"")+'</div></div>'
      +'<div class="top"><div class="ph">'+ph+'</div><div class="g">'+facts+'</div></div>'
      +'<div class="bd">'+bd+'</div>'
      +'<div class="ft"><div><span>CLUB</span><b>'+esc(m.team||"—")+'</b></div><div class="r"><span>ISSUED</span><b>'+esc(issued)+'</b></div></div>'
      +'</div></body></html>';
  }
  /* 3.093 — 개인 PDF(이력서 + 세부평가, scout.html printPlayerReport)가 장을 꽉 채우는 CSS(사용자 «여백이 최소화 되게»). 문서 CSS 라 .html 이 아니라 여기 둔다 */
  var REPORT_CSS='.pg-resume{height:296.5mm;padding:12mm 12mm 9mm;display:flex;flex-direction:column;overflow:hidden}'+'.pg-resume>.rz{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}'+'.rz-name{font-size:52px}.rz-dob{font-size:15px}.rz-photo{width:150px;height:188px}.rz-sp b{font-size:19px}.rz-sp span{font-size:11px}.rz-specs{gap:16px 40px;padding-top:20px}'+'.rz-sec{font-size:12px;margin-top:24px}.rz-prow{padding:13px 0;font-size:15px}.rz-pk{font-size:14px}.rz-contact{font-size:13px}'+'.pg-resume .rz-pgrid{flex:1 1 auto;display:flex;flex-direction:column;max-height:calc(var(--n,1)*62px)}.pg-resume .rz-pgrid>.rz-prow{flex:1 1 auto}'+'.rz-pgrid:has(>:nth-child(2)){--n:2}.rz-pgrid:has(>:nth-child(3)){--n:3}.rz-pgrid:has(>:nth-child(4)){--n:4}.rz-pgrid:has(>:nth-child(5)){--n:5}.rz-pgrid:has(>:nth-child(6)){--n:6}.rz-pgrid:has(>:nth-child(7)){--n:7}'+'.rz-two{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}'+'.rz-prow:has(.rz-no){gap:12px}.rz-no{flex:0 0 20px;height:20px;border-radius:50%;background:#14161A;color:#fff;font-style:normal;font-weight:800;font-size:10px;line-height:20px;text-align:center}'+'.rz-no.o{background:#fff;color:#14161A;box-shadow:inset 0 0 0 1.5px #14161A}.rz-no.c{background:none;color:#8A9099;font-size:12px}'+'.rz-rfoot{margin-top:auto}'+'.pg-eval{height:209.5mm;padding:9mm 10mm 7mm;display:flex;flex-direction:column;overflow:hidden;break-after:auto}'+'.es-wrap{flex:1 1 auto;min-height:0;align-items:stretch}'+'.es-side{flex:0 0 220px;display:flex;flex-direction:column}.es-pitch{flex:1 1 auto;min-height:0}'+'.es-main{gap:12px}.es-card{display:grid;grid-template-columns:100%;align-content:stretch;padding:12px 16px}'+'.es-ct{font-size:16px;margin-bottom:4px}.es-row{font-size:12px;padding:0}.es-row .es-bar{flex-basis:84px;height:5px}'+'.es-n{font-size:12px;flex-basis:18px}.es-crow{font-size:12px;padding:5px 0}.es-ft{margin-top:10px}';
  var api={docHTML:docHTML,reportCSS:REPORT_CSS,overall:function(areas){return overall(norm({areas:areas}).areas);}};
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.PSPlayerCard=api;
})(typeof window!=="undefined"?window:null);
