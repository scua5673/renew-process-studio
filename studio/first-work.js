/* Optional first-work guidance. Routes through existing menu controls only; no document writes. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PSFirstWork=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var COPY={
    ko:{title:'첫 작업 하나 완료하기',intro:'지금 필요한 작업을 골라 끝까지 해보세요.',context:'현재 공간',guest:'로그인 전',locked:'계정 자료 확인 필요',personal:'내 작업',playerLabel:'선수',coachLabel:'일정 편집 가능',observerLabel:'일정 읽기 전용',changed:'계정·팀·권한이 바뀌었습니다. 현재 안내에서 다시 선택해 주세요.',missing:'메뉴를 준비하지 못했습니다. 잠시 후 다시 눌러 주세요.',
      board:['전술 한 장 만들기','보드 열기',['보드 설정에서 포메이션을 고릅니다.','선수 한 명을 옮기고 움직임 화살표를 그립니다.','이미지로 내보낸 뒤 파일을 열어 배치와 화살표를 확인합니다.']],
      setup:['팀 일정 시작하기','계정·팀 선택',['계정 메뉴에서 로그인하고 작업할 팀을 선택합니다. 없으면 팀을 만들거나 초대 코드로 합류합니다.','팀 운영 → 일정에서 날짜를 골라 세션 하나의 시간·목표를 적습니다.','저장 상태를 확인한 뒤 같은 날짜를 다시 열어 내용이 남았는지 확인합니다.']],
      coach:['훈련 일정 하나 남기기','팀 일정 열기',['일정에서 훈련할 날짜를 고릅니다.','세션 하나에 시간과 훈련 목표 한 줄을 적습니다.','저장 상태를 확인하고 같은 날짜를 다시 열어봅니다.']],
      observer:['팀 일정 확인하기','팀 일정 열기',['선택한 팀이 맞는지 계정 메뉴에서 확인합니다.','일정에서 날짜를 골라 시간·장소·훈련 내용을 읽습니다.','변경할 내용은 편집 권한이 있는 팀 운영진에게 전달합니다.']],
      player:['내 행동과 오늘 기록 남기기','내 IDP 열기',['계정 메뉴에서 소속 팀이 맞는지 확인합니다. 혼자 기록할 때는 내 작업을 사용해도 됩니다.','어떤 선수가 되고 싶은지 한 문장과 해볼 행동 하나를 적습니다.','오늘 그 행동을 해봤는지와 장면 한 줄을 남기고, 날짜를 다시 열어 확인합니다.']],
      login:['내 IDP 시작하기','로그인·계정 열기',['계정 메뉴에서 로그인합니다. 팀에 합류하기 전에도 내 IDP를 쓸 수 있습니다.','어떤 선수가 되고 싶은지 한 문장과 해볼 행동 하나를 적습니다.','오늘 해본 장면 한 줄을 남기고 같은 날짜를 다시 열어봅니다.']],
      lockedCard:['계정 자료 먼저 확인하기','계정 열기',['계정 메뉴에서 로그인 상태와 선택한 팀을 확인합니다.','자료 불러오기가 끝난 뒤 사용법을 다시 엽니다.','현재 권한에 맞는 첫 작업을 선택합니다.']]},
    en:{title:'Finish one first task',intro:'Choose what you need now and follow it through.',context:'Current space',guest:'Before sign-in',locked:'Account data needs checking',personal:'My work',playerLabel:'Player',coachLabel:'Schedule editing available',observerLabel:'Schedule is read-only',changed:'Your account, team or permissions changed. Choose again from the current guide.',missing:'The menu is not ready. Please try again shortly.',
      board:['Make one tactics board','Open board',['Choose a formation in board settings.','Move one player and draw a movement arrow.','Export an image, then open the file to check the formation and arrow.']],
      setup:['Start a team schedule','Choose account / team',['Sign in through the account menu and select your team. Create one or join with an invite code if needed.','In Team → Schedule, choose a date and enter a time and goal for one session.','Check the save status, then reopen that date to confirm your work remains.']],
      coach:['Save one training session','Open team schedule',['Choose a training date in Schedule.','Enter a time and one training goal for a session.','Check the save status, then reopen the same date.']],
      observer:['Check the team schedule','Open team schedule',['Check that the correct team is selected in the account menu.','Choose a date and read the time, venue and training plan.','Tell a team manager with editing permission about any changes needed.']],
      player:['Record your action and today’s note','Open my IDP',['Check your team in the account menu. You can also use My work to record on your own.','Write one sentence about the player you want to become and one action to try.','Record whether you tried it and one moment from today, then reopen that date.']],
      login:['Start my IDP','Open sign-in / account',['Sign in through the account menu. You can use your IDP before joining a team.','Write one sentence about the player you want to become and one action to try.','Record one moment from today, then reopen the same date.']],
      lockedCard:['Check account data first','Open account',['Check your sign-in status and selected team in the account menu.','Reopen this guide after your data finishes loading.','Choose a first task available with your current permissions.']]},
    ja:{title:'最初の作業を一つ終える',intro:'今必要な作業を選んで、最後まで試しましょう。',context:'現在のスペース',guest:'ログイン前',locked:'アカウントのデータ確認が必要',personal:'自分の作業',playerLabel:'選手',coachLabel:'日程を編集可能',observerLabel:'日程は閲覧のみ',changed:'アカウント・チーム・権限が変わりました。現在の案内から選び直してください。',missing:'メニューの準備ができていません。少し待って再度お試しください。',
      board:['戦術ボードを一枚作る','ボードを開く',['ボード設定でフォーメーションを選びます。','選手を一人動かし、動きの矢印を描きます。','画像を書き出し、ファイルを開いて配置と矢印を確認します。']],
      setup:['チームの日程を始める','アカウント・チームを選択',['アカウントメニューからログインし、チームを選びます。必要なら作成するか招待コードで参加します。','チーム → 日程で日付を選び、一つのセッションに時間と目標を書きます。','保存状態を確認し、同じ日付を開き直して内容を確かめます。']],
      coach:['練習セッションを一つ残す','チーム日程を開く',['日程で練習する日を選びます。','一つのセッションに時間と練習目標を一行書きます。','保存状態を確認し、同じ日付を開き直します。']],
      observer:['チーム日程を確認する','チーム日程を開く',['アカウントメニューで選択中のチームを確認します。','日付を選び、時間・場所・練習内容を読みます。','変更が必要な点は編集権限のある運営者に伝えます。']],
      player:['自分の行動と今日の記録を残す','自分のIDPを開く',['アカウントメニューで所属チームを確認します。一人で記録する場合は自分の作業でも使えます。','なりたい選手像を一文と、試す行動を一つ書きます。','今日試したかどうかと一場面を記録し、その日付を開き直します。']],
      login:['自分のIDPを始める','ログイン・アカウントを開く',['アカウントメニューからログインします。チーム参加前でもIDPを使えます。','なりたい選手像を一文と、試す行動を一つ書きます。','今日の一場面を記録し、同じ日付を開き直します。']],
      lockedCard:['先にアカウントのデータを確認','アカウントを開く',['アカウントメニューでログイン状態とチームを確認します。','データの読み込み後、この案内を開き直します。','現在の権限で使える最初の作業を選びます。']]},
    zh:{title:'完成第一项任务',intro:'选择现在需要的任务，并完整试一次。',context:'当前空间',guest:'尚未登录',locked:'需要确认账户资料',personal:'我的工作',playerLabel:'球员',coachLabel:'可编辑日程',observerLabel:'日程只读',changed:'账户、球队或权限已更改。请根据当前指南重新选择。',missing:'菜单尚未就绪，请稍后重试。',
      board:['制作一张战术板','打开战术板',['在战术板设置中选择阵型。','移动一名球员并画出移动箭头。','导出图片，再打开文件检查阵型和箭头。']],
      setup:['开始球队日程','选择账户或球队',['通过账户菜单登录并选择球队。需要时可创建球队或使用邀请码加入。','在球队 → 日程中选择日期，为一节训练填写时间和目标。','确认保存状态，再打开同一日期检查内容是否保留。']],
      coach:['保存一节训练','打开球队日程',['在日程中选择训练日期。','为一节训练填写时间和一句训练目标。','确认保存状态，再打开同一日期。']],
      observer:['查看球队日程','打开球队日程',['在账户菜单中确认所选球队。','选择日期，查看时间、地点和训练内容。','如需修改，请告知有编辑权限的球队管理人员。']],
      player:['记录行动和今天的场景','打开我的IDP',['在账户菜单中确认所属球队。独自记录时也可使用“我的工作”。','写一句想成为怎样的球员，以及一个准备尝试的行动。','记录今天是否尝试及一个场景，再打开该日期查看。']],
      login:['开始我的IDP','打开登录或账户',['通过账户菜单登录。加入球队之前也可以使用IDP。','写一句想成为怎样的球员，以及一个准备尝试的行动。','记录今天的一个场景，再打开同一日期。']],
      lockedCard:['先确认账户资料','打开账户',['在账户菜单中确认登录状态和所选球队。','资料加载完成后重新打开指南。','选择当前权限允许的第一项任务。']]},
    es:{title:'Completa una primera tarea',intro:'Elige lo que necesitas ahora y hazlo de principio a fin.',context:'Espacio actual',guest:'Sin iniciar sesión',locked:'Hay que comprobar los datos',personal:'Mi trabajo',playerLabel:'Jugador',coachLabel:'Puedes editar el calendario',observerLabel:'Calendario de solo lectura',changed:'Tu cuenta, equipo o permisos han cambiado. Elige de nuevo en la guía actual.',missing:'El menú aún no está listo. Inténtalo de nuevo en un momento.',
      board:['Crea una pizarra táctica','Abrir pizarra',['Elige una formación en los ajustes de la pizarra.','Mueve a un jugador y dibuja una flecha de movimiento.','Exporta una imagen y abre el archivo para comprobar la formación y la flecha.']],
      setup:['Empieza el calendario del equipo','Elegir cuenta / equipo',['Inicia sesión en el menú de cuenta y selecciona tu equipo. Si hace falta, crea uno o únete con un código.','En Equipo → Calendario, elige una fecha y escribe la hora y el objetivo de una sesión.','Comprueba el estado de guardado y abre de nuevo esa fecha para verificar el contenido.']],
      coach:['Guarda una sesión de entrenamiento','Abrir calendario del equipo',['Elige una fecha de entrenamiento en el calendario.','Escribe la hora y un objetivo de entrenamiento para una sesión.','Comprueba el estado de guardado y vuelve a abrir la misma fecha.']],
      observer:['Consulta el calendario del equipo','Abrir calendario del equipo',['Comprueba el equipo seleccionado en el menú de cuenta.','Elige una fecha y lee la hora, el lugar y el plan de entrenamiento.','Comunica los cambios necesarios a un responsable con permiso de edición.']],
      player:['Anota tu acción y un momento de hoy','Abrir mi IDP',['Comprueba tu equipo en el menú de cuenta. También puedes registrar por tu cuenta en Mi trabajo.','Escribe una frase sobre el jugador que quieres ser y una acción que probar.','Anota si la probaste y un momento de hoy; después vuelve a abrir esa fecha.']],
      login:['Empezar mi IDP','Abrir sesión / cuenta',['Inicia sesión en el menú de cuenta. Puedes usar tu IDP antes de unirte a un equipo.','Escribe una frase sobre el jugador que quieres ser y una acción que probar.','Anota un momento de hoy y vuelve a abrir la misma fecha.']],
      lockedCard:['Comprueba primero los datos de la cuenta','Abrir cuenta',['Comprueba tu sesión y el equipo seleccionado en el menú de cuenta.','Vuelve a abrir esta guía cuando terminen de cargar los datos.','Elige una primera tarea disponible con tus permisos actuales.']]},
    pt:{title:'Conclua uma primeira tarefa',intro:'Escolha o que precisa agora e faça até o fim.',context:'Espaço atual',guest:'Antes de entrar',locked:'É preciso verificar os dados',personal:'Meu trabalho',playerLabel:'Jogador',coachLabel:'Pode editar a agenda',observerLabel:'Agenda somente para leitura',changed:'Sua conta, equipe ou permissões mudaram. Escolha novamente no guia atual.',missing:'O menu ainda não está pronto. Tente novamente em instantes.',
      board:['Crie uma prancheta tática','Abrir prancheta',['Escolha uma formação nas configurações da prancheta.','Mova um jogador e desenhe uma seta de movimento.','Exporte uma imagem e abra o arquivo para conferir a formação e a seta.']],
      setup:['Comece a agenda da equipe','Escolher conta / equipe',['Entre pelo menu da conta e selecione sua equipe. Se precisar, crie uma ou entre com um código de convite.','Em Equipe → Agenda, escolha uma data e preencha o horário e o objetivo de uma sessão.','Confira o estado de salvamento e abra a mesma data para verificar o conteúdo.']],
      coach:['Salve uma sessão de treino','Abrir agenda da equipe',['Escolha uma data de treino na agenda.','Preencha o horário e um objetivo de treino para uma sessão.','Confira o estado de salvamento e abra novamente a mesma data.']],
      observer:['Confira a agenda da equipe','Abrir agenda da equipe',['Confira a equipe selecionada no menu da conta.','Escolha uma data e leia o horário, o local e o plano de treino.','Informe as mudanças necessárias a um responsável com permissão para editar.']],
      player:['Registre sua ação e um momento de hoje','Abrir meu IDP',['Confira sua equipe no menu da conta. Também pode registrar por conta própria em Meu trabalho.','Escreva uma frase sobre o jogador que quer ser e uma ação para tentar.','Registre se tentou e um momento de hoje; depois abra novamente a data.']],
      login:['Começar meu IDP','Abrir entrada / conta',['Entre pelo menu da conta. Pode usar seu IDP antes de participar de uma equipe.','Escreva uma frase sobre o jogador que quer ser e uma ação para tentar.','Registre um momento de hoje e abra novamente a mesma data.']],
      lockedCard:['Confira primeiro os dados da conta','Abrir conta',['Confira seu acesso e a equipe selecionada no menu da conta.','Abra novamente este guia depois que os dados terminarem de carregar.','Escolha uma primeira tarefa disponível com suas permissões atuais.']]}
  };
  var ROUTES={board:'#appSeg button[data-app="board"]:not([data-train])',idp:'#appSeg button[data-app="idp"]',schedule:'#teamNav button[data-team-key="training"]',account:'#psAcctWrap .acct-btn'};
  function context(win){
    var s=null,w=null,ready=false,role='',edit=false,active='';
    try{
      var api=win.PSSync;s=api&&api.session&&api.session();
      if(!s||!s.uid)return {kind:'guest',uid:'',wid:'',role:'',edit:false};
      w=api.activeWsObj&&api.activeWsObj();active=api.activeWs&&api.activeWs();
      ready=api.dataUnlocked&&api.dataUnlocked()===true;
      if(!w||!w.id||['personal','team'].indexOf(w.kind)<0||(active&&String(active)!==String(w.id)))ready=false;
      if(ready&&w.kind==='team'){
        role=win.PSPerms&&win.PSPerms.role&&win.PSPerms.role()||'';
        edit=!!(win.PSPerms&&win.PSPerms.canEdit&&win.PSPerms.canEdit('schedule')===true);
      }
    }catch(_){ready=false;}
    var kind=!ready?'locked':w.kind!=='team'?'personal':role==='player'?'player':edit?'coach':'observer';
    return {kind:kind,uid:String(s&&s.uid||''),wid:String(w&&w.id||''),role:role,edit:edit};
  }
  function plan(c){
    if(c.kind==='locked')return [{id:'lockedCard',route:'account'}];
    if(c.kind==='player')return [{id:'player',route:'idp'},{id:'observer',route:'schedule'}];
    if(c.kind==='coach')return [{id:'coach',route:'schedule'},{id:'board',route:'board'},{id:'player',route:'idp'}];
    if(c.kind==='observer')return [{id:'observer',route:'schedule'},{id:'board',route:'board'},{id:'player',route:'idp'}];
    return [{id:'board',route:'board'},{id:'setup',route:'account'},{id:c.kind==='guest'?'login':'player',route:c.kind==='guest'?'account':'idp'}];
  }
  function signature(c){return [c.kind,c.uid,c.wid,c.role,c.edit].join('|');}
  function mount(win,host,close){
    var doc=win.document,lang='ko',last=null;
    function node(tag,className,text){var el=doc.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el;}
    function render(nextLang,notice){
      lang=COPY[nextLang]?nextLang:'en';var t=COPY[lang],c=context(win);last=c;
      while(host.firstChild)host.removeChild(host.firstChild);
      host.className='ps-first-work';host.setAttribute('lang',lang);host.setAttribute('aria-label',t.title);
      var header=node('div','ps-fw-head');header.appendChild(node('h2','',t.title));header.appendChild(node('p','',t.intro));host.appendChild(header);
      host.appendChild(node('p','ps-fw-context',t.context+' · '+(t[c.kind+'Label']||t[c.kind])));
      var cards=node('div','ps-fw-cards');
      plan(c).forEach(function(task,index){
        var text=t[task.id],card=node('article','ps-fw-card'+(index===0?' ps-fw-primary':''));
        card.appendChild(node('h3','',text[0]));var list=node('ol');
        text[2].forEach(function(step){list.appendChild(node('li','',step));});card.appendChild(list);
        var button=node('button','ps-fw-go',text[1]);button.type='button';button.dataset.firstWork=task.id;button.dataset.firstRoute=task.route;
        card.appendChild(button);cards.appendChild(card);
      });host.appendChild(cards);
      var message=node('p','ps-fw-message',notice||'');message.setAttribute('role','status');message.setAttribute('aria-live','polite');host.appendChild(message);
    }
    host.addEventListener('click',function(e){
      var button=e.target.closest&&e.target.closest('button[data-first-work]');if(!button||!host.contains(button))return;
      e.preventDefault();e.stopPropagation();
      var c=context(win),t=COPY[lang];
      if(!last||signature(c)!==signature(last)){render(lang,t.changed);return;}
      var task=plan(c).filter(function(x){return x.id===button.dataset.firstWork&&x.route===button.dataset.firstRoute;})[0];
      if(!task){render(lang,t.changed);return;}
      var target=doc.querySelector(ROUTES[task.route]);
      if(!target||target.disabled){host.querySelector('.ps-fw-message').textContent=t.missing;return;}
      close();target.click();
    });
    return {render:render};
  }
  return {context:context,plan:plan,signature:signature,mount:mount,copy:COPY,routes:ROUTES};
});
