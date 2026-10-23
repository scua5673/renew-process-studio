import path from 'node:path';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const suites={
  /* 2.991 — board 가 25개로 늘어 WebKit 잡이 14~15분 걸렸고, release-gate 를 12분만 기다리는 Netlify 게시(scripts/verify-release.mjs)가
     staging 마다 멈췄다. 같은 테스트를 시간(WebKit 실측)으로 둘에 나눠 CI 가 나란히 돌린다 — board: 판·보관함 / board2: 애니메이션·내보내기·미팅·패턴북 등. */
  board:['gamemodel-sync','board-depth','board-color-palette','vault-board-isolation','board-fmstadio','board-fmstadio2','board-jersey','board-edit-view','board-kit-preview','board-kit-more','board-savebar','board-vault-save','vault-folder-delete','vault-folder-visibility','team-library-load','gamemodel-vault-import','board-new-board','board-settings-strip','board-look-per-work','board-3d-default','board-3d-look','board-3d-marquee','board-3d-ipad-safe','board-editor-flat','board-settings-hierarchy','board-full-name','team-load-position','team-photo-crop','shape-menu-3141','board-popups-3141'],
  board2:['board-pitch-all-pages','meeting-work-pages','meeting-formation','meeting-new-look','meeting-view-3130','meeting-pitch-pick','board-quick-export','board-import-safe-3123','board-vault-pages-3137','team-load-all-scenes','page-switch-play','vault-browse','anim-erase-export','anim-export-once','meeting-names-video','meeting-upgrade','gamemodel-anim','gamemodel-attach-pages','board-feedback-2975','anim-all-pages','anim-export-fit','anim-orient','patternbook','shaper-ball','phone-page-strip','vault-phone-view-3134','rondo-grid','board-pitch-photo','board-shortcuts-3143'],
  identity:['session-team-picker','month-quick-detail','admin-content-play','admin-user-made','admin-safety','board-boot','cache-wait','admin-errors','service-worker-update','update-notice','account-team-switch','workspace-held-review-3146','mobile-oauth-recovery','schedule-phone','phone-app-more','board-settings-manual','year-weekdays'],
  storage:['svg-guard','storage-safety','personal-docs-sync','library-insert-ack','team-library','private-board-isolation','board-guest-save','roster-main-save','scout-unread-roster','roster-storage-failure-3144','autosave-journal-recovery','letter-pack','vault-file-import','community-process','community-elmiha','community-board','community-view-look','vault-examples','warm-tabs','thumb-diet','phone-boot-vault','match-wait-schedule-quota'],
  idp:['match-board-tools','match-formats-8','match-fmt-3118','match-ob-tray','match-board-vault','match-meet-parts','match-lock-3137','match-board-show','availability','idp-recovery','idp-story-dedup','support','squad-phone','scouting-integration','review-training','idp-coach-goals','team-heads','learn-gm-loop','idp-update-reload','idp-pub-wipe'],
  /* 3.012 — 보드 끌기 성능은 WebKit 에서 혼자 149~223초(테스트 하나 240초 한도)였다. 느린 러너 하나가 board 잡 전체와 배포(release-gate)를 막지 않게
     자기 묶음으로 떼고, 이 테스트만 한도를 360초로 둔다(PER_TEST_MS) — 묶음이 혼자라 잡은 7분 안쪽, Netlify 의 12분 대기 안이다. */
  boardperf:['board-portrait-goal-3145','board-drag-performance','board-pencil'],   /* 3.025 — 펜슬 그리기(손바닥 · 중간 점 · 프레임당 한 번 · 3D 투영 · 호버) */
  /* 3.012 — CI 밖에 있던 브라우저 시험 22개(저장·복구·로그인·안내·IDP·선수단·훈련). CI 에 없어서 넷이 조용히 낡아 있었다(dock-white 는 2.614 CSS 사본과
     비교하는 일회용 점검이라 넣지 않는다). Chromium 실측 합 7분 남짓이라 둘로 나눠 다른 묶음과 나란히 돈다 — entry: 진입·계정·안내 / records: 기록·저장·선수단·훈련.
     first-work 는 guidance.mjs 를 import 만 하는 옛 이름이라 넣지 않는다(같은 시험이 두 번 돈다). */
  entry:['admin-logout-handoff','admin-operations','admin-support','autosave-status','guidance','ipad-team-navigation','mobile-oauth','oauth-same-document','quiet-entry','phone-start','install-door','csp-report-only'],   /* 3.085 install-door — 홈 화면 설치 문 · 한 번 뜨는 안내 */
  records:['idp-player-matches','idp-start','match-lineup','personal-large-upload','roster-history-review','roster-projection','roster-recovery','save-status-layout','storage-commit','team-position-delete','training-context','training-dock-layout','coach-idp-entry','invite-link-export','squad-cards']
};
const PER_TEST_MS={'board-drag-performance':360000};   /* 3.012 — 한 테스트 한도(기본 240초)의 예외. 위 boardperf 참고 */
/* 3.012 — 엔진과 상관없이 Chromium 을 직접 띄우는 시험(PS_BROWSER_ENGINE 을 읽지 않는다). WebKit 잡에서는 Chrome 경로가 없어 바로 죽거나
   Chromium 을 한 번 더 돌릴 뿐이라, WebKit 잡에서는 건너뛰고 그렇다고 적는다 — Chromium 잡이 그대로 지킨다. */
const CHROMIUM_ONLY=new Set(['autosave-status','guidance','quiet-entry','training-context']);
const group=process.env.PS_TEST_GROUP||'all',engines=(process.env.PS_BROWSER_ENGINE||'chromium,webkit').split(',');
if(group!=='all'&&!suites[group])throw Error('Unknown browser test group: '+group);
const tests=group==='all'?Object.values(suites).flat():suites[group],results=[];
for(const engine of engines){
  if(!['chromium','webkit'].includes(engine))throw Error('Unknown browser engine: '+engine);
  for(const test of tests){
    if(engine!=='chromium'&&CHROMIUM_ONLY.has(test)){console.log(JSON.stringify({engine,test,skipped:'chromium-only'}));continue;}
    const output=path.join(root,'test-results',engine,test);fs.mkdirSync(output,{recursive:true});
    const env={...process.env,PS_BROWSER_ENGINE:engine,PS_TEST_OUTPUT:output};
    if(engine==='chromium'&&!env.PS_CHROME_PATH)env.PS_CHROME_PATH=pw.chromium.executablePath();
    const started=Date.now();
    const run=spawnSync(process.execPath,[path.join(root,'tests/browser',test+'.mjs')],{cwd:root,env,encoding:'utf8',timeout:PER_TEST_MS[test]||240000,maxBuffer:8*1024*1024});
    fs.writeFileSync(path.join(output,'runner.log'),(run.stdout||'')+(run.stderr||'')+(run.error?'\n'+run.error.stack:''));
    const result={engine,test,passed:run.status===0&&!run.error,durationMs:Date.now()-started};results.push(result);
    console.log(JSON.stringify(result));if(!result.passed)console.error((run.stderr||run.stdout||String(run.error)).slice(-3500));
  }
}
fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
fs.writeFileSync(path.join(root,'test-results',`critical-${group}-${engines.join('-')}.json`),JSON.stringify(results,null,2));
if(results.some(r=>!r.passed))process.exitCode=1;
