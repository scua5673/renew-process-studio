/* Phone phase navigation projects the existing, permission-checked playbook list. */
(function(){
  'use strict';
  var list=document.getElementById('list');
  if(!list||!document.documentElement.classList.contains('ps-page-playbook'))return;
  var label=document.createElement('label'),select=document.createElement('select');
  label.className='tm-phase-picker';label.appendChild(document.createTextNode('국면 선택'));
  select.setAttribute('aria-label','플레이북 국면');label.appendChild(select);list.before(label);
  function paint(){
    var buttons=Array.from(list.querySelectorAll('button[data-ph]'));
    label.hidden=!buttons.length;list.classList.toggle('tm-has-picker',!!buttons.length);
    select.replaceChildren();
    list.querySelectorAll('.mo').forEach(function(section){
      var group=document.createElement('optgroup');group.label=section.querySelector('.mo-h').textContent;
      section.querySelectorAll('button[data-ph]').forEach(function(b){
        var option=document.createElement('option');option.value=b.dataset.ph;
        option.textContent=b.querySelector('.t').firstChild.textContent;
        option.selected=b.getAttribute('aria-pressed')==='true';group.appendChild(option);
      });
      if(group.children.length)select.appendChild(group);
    });
  }
  select.addEventListener('change',function(){
    var b=Array.from(list.querySelectorAll('button[data-ph]')).find(function(b){return b.dataset.ph===select.value;});
    if(b)b.click();
  });
  new MutationObserver(paint).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed']});
  paint();
})();
