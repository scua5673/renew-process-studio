/* 권한 관리의 표시 필터. 권한 문서나 저장소는 바꾸지 않는다. */
(function(root,factory){
  'use strict';var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSPermissionFilter=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function create(options){
    var doc=options.document,dark=!!options.dark,state=options.state,roles=options.roles;
    var mode=['all','unlinked','players'].indexOf(options.mode)>=0?options.mode:'all';
    var views=[],groups=Object.create(null),buttons=[];
    function node(tag,css){var el=doc.createElement(tag);if(css)el.style.cssText=css;return el;}
    var element=node('div'),summary=node('div','display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:10px 12px;margin-bottom:10px;border-radius:11px;font-size:13px;font-weight:700;');
    var label=node('span','flex:1'),filters=node('div','display:flex;gap:6px;flex-wrap:wrap;width:100%;');summary.appendChild(label);
    [['all','전체'],['unlinked','연결 안 된 팀원'],['players','연결 안 된 선수']].forEach(function(option){
      var button=node('button','height:30px;padding:0 10px;border:1px solid currentColor;border-radius:8px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;');button.type='button';
      button.onclick=function(){mode=option[0];if(options.onMode)options.onMode(mode);update();};
      buttons.push({id:option[0],label:option[1],el:button});filters.appendChild(button);
    });
    summary.appendChild(filters);element.appendChild(summary);
    var list=node('div');element.appendChild(list);
    var status=node('div','font-size:12px;line-height:1.5;margin:8px 2px;color:'+(dark?'#9AA4B3':'#8a8f98'));
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');element.appendChild(status);
    function group(role){
      if(groups[role])return groups[role];
      var wrap=node('div'),head=node('div','display:flex;align-items:center;gap:7px;margin:14px 2px 8px;font-size:11px;font-weight:800;color:'+(dark?'#9AA4B3':'#8a8f98'));
      wrap.setAttribute('data-perms-role',role);
      var title=node('span','color:'+(dark?'#E7EBF1':'#16181c')),count=node('span');
      title.textContent=(roles.filter(function(r){return r[0]===role;})[0]||[null,role])[1];
      head.appendChild(title);head.appendChild(count);head.appendChild(node('span','flex:1;height:1px;background:'+(dark?'#2C3744':'#E3E5E9')));wrap.appendChild(head);
      var body=node('div');wrap.appendChild(body);list.appendChild(wrap);
      return groups[role]={el:wrap,list:body,count:count,visible:0};
    }
    roles.forEach(function(r){group(r[0]);});
    function add(uid,el){var g=group(state[uid].role);el.setAttribute('data-perms-member',uid);g.list.appendChild(el);views.push({uid:uid,el:el,group:g});}
    function update(){
      var visible=0,unlinked=0,players=0;
      Object.keys(groups).forEach(function(role){groups[role].visible=0;});
      views.forEach(function(view){
        var member=state[view.uid],g=group(member.role);
        if(view.group!==g){g.list.appendChild(view.el);view.group=g;}
        if(!member.playerId){unlinked++;if(member.role==='player')players++;}
        var show=mode==='all'||(!member.playerId&&(mode!=='players'||member.role==='player'));
        view.el.hidden=!show;if(show){visible++;g.visible++;}
      });
      Object.keys(groups).forEach(function(role){var g=groups[role];g.el.hidden=!g.visible;g.count.textContent=g.visible+'명';});
      label.textContent='합류 '+views.length+'명 · 선수 연결됨 '+(views.length-unlinked)+' · 연결 안 됨 '+unlinked;
      summary.style.background=unlinked?(dark?'rgba(201,119,43,.16)':'#FDF6E3'):(dark?'#222c39':'#E9EDF5');
      summary.style.color=unlinked?(dark?'#E5B96A':'#8A6A1F'):(dark?'#9fbbff':'#2757d9');
      buttons.forEach(function(button){
        var active=mode===button.id,count=button.id==='all'?views.length:button.id==='players'?players:unlinked;
        button.el.textContent=button.label+' '+count;button.el.setAttribute('aria-pressed',active?'true':'false');
        button.el.style.background=active?(dark?'#9fbbff':'#14213D'):'transparent';button.el.style.color=active?(dark?'#1A212B':'#fff'):'inherit';
      });
      status.hidden=!views.length;status.textContent=visible?'현재 '+visible+'명 표시':mode==='players'?'연결 안 된 선수가 없습니다.':'연결 안 된 팀원이 없습니다.';
    }
    return {element:element,add:add,update:update};
  }
  return {create:create};
});
