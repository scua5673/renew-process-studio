/* 2.617 — 선수 프로필 한 장(A4) — 선수단(scout.html)·스카우팅 후보(scouting.html)가 같은 문서를 쓴다.
   차트·점수 없음. 장점 3 · 보완할 점 2 · 경력 4 · 학교 4 · 영상 링크 2(QR). 비밀번호·보호자 연락처는 어디에도 넣지 않는다.
   쓰는 법: PSProfileSheet.docHTML(model) → HTML 문서 문자열. model 은 아래 norm() 참고. */
(function(){
  "use strict";
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function lines(v,max){
    if(Array.isArray(v))v=v.join("\n");
    var out=String(v||"").split(/\r?\n/).map(function(s){return s.replace(/^\s*\d+[.)]?\s*/,"").trim();}).filter(Boolean);
    return max?out.slice(0,max):out;
  }
  /* "한글 (English)" → {main, sub}. 괄호가 없으면 sub 없음 */
  function split2(s){
    var m=/^(.*?)\s*[(（]([^()（）]{2,})[)）]\s*$/.exec(s);
    return m?{main:m[1].trim()||m[2].trim(),sub:m[1].trim()?m[2].trim():""}:{main:s,sub:""};
  }
  function parseDob(s){
    var m=/(\d{4})(?:\D+(\d{1,2})(?:\D+(\d{1,2}))?)?/.exec(String(s||""));
    if(!m)return null;
    var y=+m[1],mo=m[2]?+m[2]:1,d=m[3]?+m[3]:1;
    if(y<1900||y>2100||mo<1||mo>12||d<1||d>31)return null;
    return {y:y,m:mo,d:d,full:!!m[3]};   /* 연도만 있으면 나이는 올해-출생년 */
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
    DM:"Defensive Midfielder",CM:"Central Midfielder",AM:"Attacking Midfielder",LM:"Left Midfielder",RM:"Right Midfielder",LW:"Left Winger",RW:"Right Winger",FW:"Forward",CF:"Center Forward",ST:"Striker"};
  function posEn(abbr){ var k=String(abbr||"").trim().toUpperCase(); return POS_EN[k]||k; }
  function footEn(v){
    var s=String(v||"").trim(); if(!s)return "";
    if(/^R$|오른|right/i.test(s))return "Right";
    if(/^L$|왼|left/i.test(s))return "Left";
    if(/^B$|양|both/i.test(s))return "Both";
    return s;
  }
  function hostOf(u){ try{return new URL(u).hostname.replace(/^www\./,"")+(new URL(u).pathname.length>1?new URL(u).pathname:"");}catch(_){return String(u||"");} }
  function qrSvg(url){
    try{
      if(typeof qrcode!=="function")return "";
      var q=qrcode(0,"M"); q.addData(String(url)); q.make();
      return q.createSvgTag({cellSize:2,margin:0,scalable:true});
    }catch(_){return "";}
  }
  function ymd(d){ d=d||new Date(); return d.getFullYear()+"."+String(d.getMonth()+1).padStart(2,"0")+"."+String(d.getDate()).padStart(2,"0"); }

  var CSS='*{box-sizing:border-box}@page{size:A4 portrait;margin:0}html,body{margin:0;padding:0;background:#fff}'
  +'body{font-family:Pretendard,"IBM Plex Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1F2D4A;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
  +'.a4{width:210mm;height:297mm;position:relative;overflow:hidden;display:flex;flex-direction:column;background:#fff;page-break-after:always}'
  +'.hd{background:#1F2D4A;color:#fff;padding:9mm 12mm 7mm;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm}'
  +'.hd .l b{display:block;font-weight:700;font-size:15px;letter-spacing:.32em;color:#C9A24A}.hd .l small{display:block;font-weight:500;font-size:10px;letter-spacing:.2em;color:rgba(255,255,255,.7);margin-top:6px}'
  +'.hd .r{text-align:right;min-width:0}.hd .r i{display:block;font-weight:500;font-size:11px;letter-spacing:.28em;color:rgba(255,255,255,.75);font-style:normal}'
  +'.hd .r b{display:block;font-weight:800;font-size:34px;line-height:1.05;letter-spacing:-.01em;margin-top:6px;word-break:keep-all}.hd .r small{display:block;font-weight:600;font-size:13px;color:#C9A24A;margin-top:4px}'
  +'.facts{display:grid;grid-template-columns:34mm 1fr;border-bottom:1px solid #D9DEE7}'
  +'.facts .ph{background:#EEF1F6;display:grid;place-items:center;font-weight:600;font-size:10px;letter-spacing:.14em;color:#8A93A3;border-right:1px solid #D9DEE7;overflow:hidden}'
  +'.facts .ph img{width:100%;height:100%;object-fit:cover;display:block}'
  +'.facts .g{display:grid;grid-template-columns:repeat(3,1fr)}'
  +'.facts .g div{padding:12px 18px 11px;border-right:1px solid #D9DEE7;border-bottom:1px solid #D9DEE7;min-width:0}'
  +'.facts .g div:nth-child(3n){border-right:0}.facts .g div:nth-last-child(-n+3){border-bottom:0}'
  +'.facts .g span{display:block;font-weight:500;font-size:9px;letter-spacing:.16em;color:#8A93A3}'
  +'.facts .g b{display:block;font-weight:700;font-size:16px;color:#1F2D4A;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +'.bd{padding:2mm 12mm 0;flex:1;min-height:0;overflow:hidden}'
  +'h6{margin:14px 0 8px;padding-bottom:7px;border-bottom:1.5px solid #C9A24A;font-weight:800;font-size:12px;letter-spacing:.14em;color:#1F2D4A;display:flex;justify-content:space-between;align-items:baseline}'
  +'h6 span{font-weight:500;font-size:10.5px;letter-spacing:.02em;color:#8A93A3}'
  +'.arr{display:grid;gap:6px;font-weight:500;font-size:13px;color:#2A3650}.arr div{display:flex;gap:8px;align-items:baseline}.arr div::before{content:"→";color:#C9A24A;font-weight:700;flex:0 0 auto}.arr small{color:#6B7482;font-weight:400;font-size:11px;margin-left:6px}'
  +'.str{display:grid;gap:7px}.str>div{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:center;font-weight:500;font-size:13px;color:#2A3650}'
  +'.str>div>i{width:22px;height:22px;border-radius:50%;background:#1F2D4A;color:#fff;display:grid;place-items:center;font-weight:700;font-size:10px;font-style:normal}'
  +'.str.dev>div>i{background:#fff;color:#1F2D4A;box-shadow:inset 0 0 0 1.5px #1F2D4A}'
  +'.str small{display:block;font-weight:400;font-size:11px;color:#6B7482;margin-top:1px}'
  +'.vid{border:1px solid #D9DEE7;border-left:3px solid #C9A24A;background:#F7F8FB;padding:10px 14px;display:grid;grid-template-columns:1fr 52px;gap:10px;align-items:center;margin-bottom:8px}'
  +'.vid b{display:block;font-weight:700;font-size:12.5px;color:#1F2D4A;word-break:break-all}.vid small{display:block;font-weight:500;font-size:10.5px;color:#6B7482;margin-top:3px}'
  +'.vid a{color:#2B55D6;text-decoration:none}.vid .qr{width:52px;height:52px;background:#fff;padding:2px;border:1px solid #D9DEE7}.vid .qr svg{width:100%;height:100%;display:block}'
  +'.ft{margin-top:auto;background:#1F2D4A;color:#fff;padding:6mm 12mm;display:grid;grid-template-columns:1fr auto;gap:20px;align-items:end}'
  +'.ft span{display:block;font-weight:700;font-size:9px;letter-spacing:.16em;color:#C9A24A}.ft b{display:block;font-weight:500;font-size:12px;margin-top:5px}.ft .r{text-align:right}'
  +'@media screen{.a4{margin:0 auto}}';

  /* model: {kind:'squad'|'scout', nameKr, nameEn, dob(문자), nat, height, weight, foot, pos(약어), num, club, team(발행 팀), photo(src), career[], school[], strengths[], develop[], videos[], coach} */
  function norm(m){
    m=m||{};
    return {
      kind:m.kind==="scout"?"scout":"squad",
      nameKr:String(m.nameKr||"").trim(), nameEn:String(m.nameEn||"").trim(),
      dob:String(m.dob||"").trim(), nat:String(m.nat||"").trim()||"Korean",
      height:String(m.height||"").replace(/[^\d.]/g,""), weight:String(m.weight||"").replace(/[^\d.]/g,""),
      foot:footEn(m.foot), pos:String(m.pos||"").trim(), num:String(m.num||"").trim(),
      club:String(m.club||"").trim(), team:String(m.team||"").trim(), photo:String(m.photo||""),
      career:lines(m.career,4), school:lines(m.school,4), strengths:lines(m.strengths,3), develop:lines(m.develop,2),
      videos:lines(m.videos,2).filter(function(u){return /^https?:\/\//i.test(u);}),
      coach:(function(c){c=String(c||"").trim();if(!c||c==="코치")return "";return /코치$/.test(c)?c:c+" 코치";})(m.coach), issued:m.issued||ymd()
    };
  }
  function docHTML(model){
    var m=norm(model);
    var big=m.nameEn||m.nameKr, small=m.nameEn?m.nameKr:"";
    var title=m.kind==="scout"?"SCOUTING REPORT":"PLAYER PROFILE";
    var sub=[m.team||m.club, String(new Date().getFullYear())].filter(Boolean).join(" · ").toUpperCase();
    var age=ageOf(m.dob);
    function cell(k,v){return '<div><span>'+k+'</span><b>'+(v?esc(v):"—")+'</b></div>';}
    var facts=cell("DATE OF BIRTH",fmtDob(m.dob))+cell("AGE",age)+cell("NATIONALITY",m.nat)
      +cell("HEIGHT",m.height?m.height+" cm":"")+cell("WEIGHT",m.weight?m.weight+" kg":"")+cell("FOOT",m.foot)
      +cell("POSITION",posEn(m.pos))+cell("SQUAD NO.",m.num)+cell("CLUB",m.club);
    var ph=m.photo?'<img alt="" src="'+esc(m.photo)+'">':"PHOTO";
    var bd="";
    function arr(list){return '<div class="arr">'+list.map(function(s){var p=split2(s);return '<div><span>'+esc(p.main)+(p.sub?'<small>'+esc(p.sub)+'</small>':"")+'</span></div>';}).join("")+'</div>';}
    function str(list,dev){return '<div class="str'+(dev?" dev":"")+'">'+list.map(function(s,i){var p=split2(s);return '<div><i>'+(i+1)+'</i><div>'+esc(p.main)+(p.sub?'<small>'+esc(p.sub)+'</small>':"")+'</div></div>';}).join("")+'</div>';}
    if(m.career.length)bd+='<h6>CAREER <span>클럽 경력</span></h6>'+arr(m.career);
    if(m.school.length)bd+='<h6>EDUCATION <span>학교</span></h6>'+arr(m.school);
    if(m.strengths.length)bd+='<h6>STRENGTHS <span>장점</span></h6>'+str(m.strengths,false);
    if(m.develop.length)bd+='<h6>AREAS TO DEVELOP <span>보완할 점</span></h6>'+str(m.develop,true);
    if(m.videos.length){
      bd+='<h6>MATCH FOOTAGE <span>경기 영상 · 링크</span></h6>'+m.videos.map(function(u){
        var q=qrSvg(u);
        return '<div class="vid"><div><b><a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(hostOf(u))+'</a></b><small>'+(q?"QR을 찍거나 ":"")+'링크를 누르면 영상이 열립니다</small></div>'+(q?'<div class="qr">'+q+'</div>':'<div></div>')+'</div>';
      }).join("");
    }
    var issued=[m.issued,m.coach,"PROCESS STUDIO"].filter(Boolean).join(" · ");
    var docTitle=(m.nameKr||m.nameEn||"선수")+"_프로필_"+m.issued.replace(/\./g,"-");
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+esc(docTitle)+'</title><style>'+CSS+'</style></head><body>'
      +'<div class="a4">'
      +'<div class="hd"><div class="l"><b>'+title+'</b>'+(sub?'<small>'+esc(sub)+'</small>':"")+'</div><div class="r">'+(m.pos?'<i>'+esc(posEn(m.pos).toUpperCase())+'</i>':"")+'<b>'+esc(big)+'</b>'+(small?'<small>'+esc(small)+'</small>':"")+'</div></div>'
      +'<div class="facts"><div class="ph">'+ph+'</div><div class="g">'+facts+'</div></div>'
      +'<div class="bd">'+bd+'</div>'
      +'<div class="ft"><div><span>'+(m.kind==="scout"?"PREPARED BY":"CLUB")+'</span><b>'+esc(m.team||m.club||"—")+'</b></div><div class="r"><span>ISSUED</span><b>'+esc(issued)+'</b></div></div>'
      +'</div></body></html>';
  }
  /* 인쇄 파이프라인이 없는 화면(scouting.html)용 — 미리보기 겹창 + 인쇄 */
  function preview(html){
    var W=794,H=1123;
    var ov=document.getElementById("psSheetPv");
    if(!ov){
      ov=document.createElement("div"); ov.id="psSheetPv";
      ov.style.cssText="position:fixed;inset:0;z-index:10000;background:rgba(16,24,40,.6);display:flex;flex-direction:column;align-items:center";
      ov.innerHTML='<div style="flex:0 0 auto;width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 18px"><b style="color:#fff;font-size:15px;font-weight:800">프로필 한 장</b><span style="display:flex;gap:8px"><button type="button" data-act="print" style="background:#3A6DF0;color:#fff;border:0;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">인쇄 / PDF 저장</button><button type="button" data-act="close" style="background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">닫기</button></span></div>'
        +'<div data-role="scroll" style="flex:1 1 auto;width:100%;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:0 0 24px"><div data-role="wrap" style="flex:0 0 auto;overflow:hidden;background:#fff;border-radius:4px;box-shadow:0 12px 40px rgba(0,0,0,.45)"><iframe title="프로필 한 장" style="width:'+W+'px;height:'+H+'px;border:0;display:block;background:#fff;transform-origin:top left"></iframe></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener("click",function(e){
        var a=e.target.getAttribute&&e.target.getAttribute("data-act");
        if(a==="close"||e.target===ov||e.target.getAttribute("data-role")==="scroll"){ov.style.display="none";return;}
        if(a==="print"){var f=ov.querySelector("iframe");try{f.contentWindow.focus();f.contentWindow.print();}catch(_){}}
      });
      window.addEventListener("resize",fit);
    }
    function fit(){
      if(ov.style.display==="none")return;
      var sc=Math.min(1,(window.innerWidth-16)/W,(window.innerHeight-72)/H);
      if(window.innerWidth<700)sc=Math.min(1,(window.innerWidth-16)/W);   /* 폰: 폭에 맞추고 위아래 스크롤 */
      var wrap=ov.querySelector('[data-role="wrap"]'),f=ov.querySelector("iframe");
      wrap.style.width=Math.round(W*sc)+"px";wrap.style.height=Math.round(H*sc)+"px";f.style.transform="scale("+sc+")";
    }
    ov.style.display="flex";
    ov.querySelector("iframe").srcdoc=html;
    fit();
  }
  window.PSProfileSheet={docHTML:docHTML,preview:preview,ageOf:ageOf,lines:lines,qrSvg:qrSvg};
})();
