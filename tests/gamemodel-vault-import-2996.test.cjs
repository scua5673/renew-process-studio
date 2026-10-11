const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// 2.996 — 오류 제보 fdc1f3d5: 보관함(개인) 게임모델을 팀 운영 게임모델로 가져온다.
const html=fs.readFileSync(require.resolve('../studio/gamemodel.html'),'utf8');
function api(){
  const start=html.indexOf('var GM_TEAM_ONLY='),end=html.indexOf('/* gmVaultMerge 끝 */',start);
  assert.ok(start>0&&end>start,'merge block present');
  const c=vm.createContext({});vm.runInContext(html.slice(start,end)+';this.gmHasContent=gmHasContent;this.gmVaultMerge=gmVaultMerge;',c);
  return c;
}
const plain=v=>JSON.parse(JSON.stringify(v));

test('vault content replaces the team model but team evaluations and review stay',()=>{
  const {gmVaultMerge}=api();
  const team={identity:'옛 팀',moments:[{key:'old',name:'옛 국면',phases:[]}],evals:[{at:'2026-09-01',s:{a:3}}],review:{at:'2026-09-10'},open:{old:true},style:'press'};
  const vault={identity:'점유로 이긴다',moments:[{key:'ao',name:'공격 조직',phases:[{id:'p1',name:'빌드업',principles:['넓게']}]},{key:'do',name:'수비 조직',phases:[]}],canvas:{play:'공을 갖고 이긴다'},ctx:{club:'U15'},style:'possession',evals:[{at:'x'}]};
  const out=plain(gmVaultMerge(team,vault));
  assert.equal(out.identity,'점유로 이긴다');
  assert.deepEqual(out.moments.map(m=>m.key),['ao','do']);
  assert.equal(out.style,'possession');
  assert.deepEqual(out.canvas,{play:'공을 갖고 이긴다'});
  assert.deepEqual(out.evals,[{at:'2026-09-01',s:{a:3}}],'팀 평가 기록은 그대로');
  assert.deepEqual(out.review,{at:'2026-09-10'});
  assert.deepEqual(out.open,{ao:true,do:true},'가져온 국면은 펼친 채로');
});

test('team without evaluations does not inherit the personal ones and nothing is shared by reference',()=>{
  const {gmVaultMerge}=api();
  const vault={identity:'',moments:[{key:'ao',phases:[{id:'p',principles:['a']}]}],evals:[{at:'mine'}],review:{at:'mine'}};
  const out=gmVaultMerge({moments:[]},vault);
  assert.equal(out.evals,undefined);assert.equal(out.review,undefined);
  out.moments[0].phases[0].principles.push('b');
  assert.deepEqual(vault.moments[0].phases[0].principles,['a'],'보관함 원본은 바뀌지 않는다');
});

test('only a vault model with moments or an identity counts as content',()=>{
  const {gmHasContent}=api();
  assert.equal(gmHasContent(null),false);
  assert.equal(gmHasContent({moments:[]}),false);
  assert.equal(gmHasContent({moments:[],identity:'  '}),false);
  assert.equal(gmHasContent({identity:'x'}),false,'국면 배열이 없으면 잘못된 판');
  assert.equal(gmHasContent({moments:[],identity:'우리 팀'}),true);
  assert.equal(gmHasContent({moments:[{key:'ao'}]}),true);
});

test('the import door is team-only, asks first, and is hidden for view-only members',()=>{
  const block=html.slice(html.indexOf('function gmImportVault('),html.indexOf('render();\n  renderStylePicker();\n})();'));
  assert.match(block,/if\(GM_PERSONAL\|\|!gsCanEdit\(\)\)return;/);
  assert.match(block,/psConfirm\(msg,/);
  assert.match(block,/if\(!GM_PERSONAL&&gsCanEdit\(\)\)\{/);
  assert.match(html,/PSPerms\.gate\('gamemodel',\{hide:'[^']*#btnGmFromVault'/);
  assert.match(block,/cs_gamemodel_personal_v1|gmReadVault\(\)/);
  assert.match(html,/function gmReadVault\(\)\{\s*var raw=null; try\{ raw=localStorage\.getItem\('cs_gamemodel_personal_v1'\)/);
});
