/* PROCESS STUDIO 2.747 — 일지에 남긴 방향 근거를 읽는다. 저장·보정·현재 문구로의 이전은 하지 않는다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSIDPEvidence=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function text(v){return typeof v==='string'?v.trim():'';}
  function esc(v){return text(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function has(log){
    if(!object(log))return false;
    return !!((object(log.visionEvidence)&&text(log.visionEvidence.text))||text(log.visionBehaviorId));
  }
  function read(log,vision){
    if(!has(log))return null;
    var v=object(vision)?vision:{},e=log.visionEvidence;
    if(object(e)&&text(e.text)){
      var rev=text(e.revision),version=null;
      if(rev){
        if(text(v.revision)===rev)version=v;
        else if(Array.isArray(v.history)){
          for(var i=v.history.length-1;i>=0;i--){
            var old=v.history[i];if(object(old)&&text(old.revision)===rev){version=old;break;}
          }
        }
      }
      return {id:text(e.id),text:text(e.text),revision:rev,statement:version?text(version.statement):'',legacy:false,missing:false};
    }
    var id=text(log.visionBehaviorId),hit=null;
    if(Array.isArray(v.behaviors))hit=v.behaviors.find(function(b){return object(b)&&text(b.id)===id&&text(b.text);})||null;
    /* id만 남긴 시험판은 당시 문구를 복원할 수 없다. 현재 문구는 참고로만 구분한다. */
    return {id:id,text:hit?text(hit.text):'',revision:'',statement:'',legacy:true,missing:!hit};
  }
  function render(log,vision,options){
    var e=read(log,vision);if(!e)return '';
    var h='<div class="idp-evidence'+(options&&options.compact?' compact':'')+'"><span class="ide-label">'+(e.legacy?'이전 행동 연결 · 현재 문구 참고':'그날 연결한 행동')+'</span>';
    if(e.text)h+='<p class="ide-action">'+esc(e.text)+'</p>';
    if(e.statement)h+='<p class="ide-direction"><span>당시 내 방향</span>'+esc(e.statement)+'</p>';
    if(e.legacy)h+='<small class="ide-note">'+(e.missing?'당시 문구는 저장되지 않았고, 현재 행동에서도 찾을 수 없어요.':'당시 문구는 저장되지 않아 현재 행동 문구를 참고로 보여요.')+'</small>';
    return h+'</div>';
  }
  function dateTime(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    var d=new Date(value+'T00:00:00Z');
    return !isNaN(d)&&d.toISOString().slice(0,10)===value?d.getTime():null;
  }
  function weekHTML(logMap,monday,vision){
    var start=dateTime(monday);if(start===null||new Date(start).getUTCDay()!==1||!object(logMap))return '';
    var rows=[];
    for(var i=0;i<7;i++){
      var date=new Date(start+i*864e5).toISOString().slice(0,10),log=logMap[date];
      if(!object(log))continue;
      var memo=text(log.memo),evidence=render(log,vision,{compact:true});
      if(!memo&&!evidence)continue;
      rows.push('<li><time datetime="'+date+'">'+date.slice(5).replace('-','/')+'</time>'+evidence+(memo?'<p class="ide-memo">'+esc(memo)+'</p>':'')+'</li>');
    }
    if(!rows.length)return '';
    return '<details class="idp-evidence-week"><summary>이 주에 남긴 장면 <span>'+rows.length+'일</span></summary><ol>'+rows.join('')+'</ol></details>';
  }
  return {has:has,read:read,render:render,weekHTML:weekHTML,esc:esc};
});
