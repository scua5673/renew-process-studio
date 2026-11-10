// 3.273 — 직접 써 보다 찾음(self-use-crawl · 선수 · 폰 · 영어): 업데이트 안내 띠(release-notes.js mount)의 틀 글 —
// 영역 이름 · 닫기 단추의 aria-label, «내용 보기 · 내용 접기 · 일주일간 안 보기» — 이 영어 사전에 없어 영어 화면에서도 한국어로 읽혔다.
// 판 소개 글(판마다 바뀌는 내용)은 아직 한국어지만, 띠의 틀은 셸 사전(en-shell.js)이 옮긴다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const notes=fs.readFileSync(path.join(root,'studio/release-notes.js'),'utf8');
const CHROME=['최근 업데이트','업데이트 안내 닫기','내용 보기','내용 접기','일주일간 안 보기','설정을 저장하지 못했어요. 잠시 후 다시 눌러 주세요.'];

function dictionary(){
  const win={};
  for(const f of ['en-common.js','en-shell.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'studio/i18n',f),'utf8'),{window:win});
  return win.PS_I18N_EXTRA;
}

test('업데이트 안내 띠의 틀 글은 release-notes.js 에 그대로 있다(사전의 원문과 어긋나지 않게)',()=>{
  const mount=notes.slice(notes.indexOf("host.classList.add('ps-release-notes')"));
  for(const k of CHROME)assert.ok(mount.includes("'"+k+"'"),'띠의 글 «'+k+'»');
});

test('영어 셸 사전이 띠의 틀 글을 옮긴다',()=>{
  const D=dictionary();
  for(const k of CHROME){
    assert.ok(D[k]&&typeof D[k].en==='string'&&D[k].en.trim(),'영어 사전에 «'+k+'»');
    assert.doesNotMatch(D[k].en,/[ㄱ-ㆎ가-힣]/,'«'+k+'»의 영어에 한글이 없다');
  }
});
