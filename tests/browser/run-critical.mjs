import path from 'node:path';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const suites={
  // Keep the same coverage while exposing selection UI failures in a short job.
  selection:['fold-board-tools','phone-board-readonly','board-player-panel-drag','board-color-palette','board-selection-menu','board-page-clipboard',
  /* 3.264 — board2 웹킷이 느린 실행기에서 20분 한도에 두 번 닿았다(staging 15.7분 → 같은 시험이 고르게 30% 느려 19.5분). 긴 넷(선수 시선 · 보관함 둘러보기 · 패턴북 · 미드필드 교본, 웹킷 합 4~5분)을
     3분짜리 selection 으로 옮겨 board2 를 15분 안쪽에 둔다 — 새 board2 시험은 먼저 이 묶음들의 웹킷 실측 합을 본다. */
    'board-player-eye','vault-browse','patternbook','textbook-midfield'],
  /* 2.991 — board 가 25개로 늘어 WebKit 잡이 14~15분 걸렸고, release-gate 를 12분만 기다리는 Netlify 게시(scripts/verify-release.mjs)가
     staging 마다 멈췄다. 같은 테스트를 시간(WebKit 실측)으로 둘에 나눠 CI 가 나란히 돌린다 — board: 판·보관함 / board2: 애니메이션·내보내기·미팅·패턴북 등. */
  board:['gamemodel-sync','board-depth','board-palette-colors','vault-board-isolation','vault-board-draft','board-fmstadio','board-fmstadio2','board-jersey','board-edit-view','board-kit-preview','board-kit-more','board-savebar','board-vault-save','vault-folder-delete','vault-folder-visibility','team-library-load','gamemodel-vault-import','board-new-board','board-settings-strip','board-look-per-work','board-3d-default','board-3d-look','board-stadium-ground','board-3d-marquee','board-3d-ipad-safe','board-editor-flat','board-settings-hierarchy','board-full-name','team-load-position','team-photo-crop','shape-menu-3141','board-popups-3141'],
  board2:['board-pitch-all-pages','player-eye-renderer','meeting-work-pages','meeting-formation','meeting-new-look','meeting-view-3130','meeting-pitch-pick','board-quick-export','board-pdf-save-3204','board-import-safe-3123','board-vault-pages-3137','team-load-all-scenes','page-switch-play','anim-erase-export','anim-export-once','meeting-names-video','meeting-upgrade','gamemodel-anim','gamemodel-attach-pages','board-feedback-2975','anim-all-pages','anim-photo-pages','anim-photo-missing','anim-export-fit','anim-orient','shaper-ball','phone-page-strip','vault-phone-view-3134','rondo-grid','board-pitch-photo','board-shortcuts-3143','board-text-polish','board-reports-3254','board-grass-mow-3255'],
  identity:['session-team-picker','month-quick-detail','admin-content-play','admin-user-made','admin-safety','board-boot','cache-wait','admin-errors','service-worker-update','update-notice','account-team-switch','workspace-held-review-3146','workspace-guard-storage','workspace-late-save','workspace-board-draft','mobile-oauth-recovery','schedule-phone','phone-app-more','board-settings-manual','year-weekdays'],
  storage:['storage-conditional','items-stale-round-block','storage-optimize-coalesce','svg-guard','storage-safety','personal-docs-sync','library-insert-ack','library-read-revision','team-library','private-board-isolation','board-guest-save','roster-main-save','scout-unread-roster','roster-storage-failure-3144','autosave-journal-recovery','letter-pack','vault-file-import','community-process','letter-social','community-quality','community-elmiha','community-board','community-view-look','community-library','community-detail','community-cards','vault-examples','warm-tabs','thumb-diet','phone-boot-vault','vault-open-memory','match-wait-schedule-quota','match-mirror-quota-recovery','process-save-quota','sync-stall-report','crash-breadcrumb'],
  idp:['match-board-tools','match-formats-8','match-fmt-3118','match-ob-tray','match-board-vault','match-meet-parts','match-lock-3137','match-large-schedule','match-board-show','availability','idp-recovery','idp-story-dedup','support','support-image','squad-phone','player-workspace','player-bulk-depth','squad-depth-drag','scouting-integration','review-training','idp-coach-goals','team-heads','learn-gm-loop','idp-update-reload','idp-pub-wipe','idp-cache-source'],
  /* 3.012 — 보드 끌기 성능은 WebKit 에서 혼자 149~223초(테스트 하나 240초 한도)였다. 느린 러너 하나가 board 잡 전체와 배포(release-gate)를 막지 않게
     자기 묶음으로 떼고, 이 테스트만 한도를 360초로 둔다(PER_TEST_MS) — 묶음이 혼자라 잡은 7분 안쪽, Netlify 의 12분 대기 안이다. */
  boardperf:['board-view-toolbar-move','board-portrait-goal-3145','board-drag-performance','board-pencil'],   /* 3.025 — 펜슬 그리기(손바닥 · 중간 점 · 프레임당 한 번 · 3D 투영 · 호버) */
  /* 3.012 — CI 밖에 있던 브라우저 시험 22개(저장·복구·로그인·안내·IDP·선수단·훈련). CI 에 없어서 넷이 조용히 낡아 있었다(dock-white 는 2.614 CSS 사본과
     비교하는 일회용 점검이라 넣지 않는다). Chromium 실측 합 7분 남짓이라 둘로 나눠 다른 묶음과 나란히 돈다 — entry: 진입·계정·안내 / records: 기록·저장·선수단·훈련.
     first-work 는 guidance.mjs 를 import 만 하는 옛 이름이라 넣지 않는다(같은 시험이 두 번 돈다). */
  entry:['admin-logout-handoff','admin-operations','admin-support','autosave-status','root-child-save-state','guidance','ipad-team-navigation','mobile-oauth','oauth-same-document','quiet-entry','phone-start','install-door','board-cold-restore','vault-hidden-previews','permissions-filter','csp-report-only'],   /* 3.085 install-door — 홈 화면 설치 문 · 한 번 뜨는 안내 */
  records:['team-criteria','idp-player-matches','idp-start','idp-weekly-growth','match-lineup','personal-large-upload','roster-history-review','roster-projection','roster-recovery','save-status-layout','storage-commit','team-position-delete','training-context','training-dock-layout','coach-idp-entry','invite-link-export','board-reports-3155','board-rotation-fade','board-feedback-3163','board-page-history','squad-cards','schedule-group-visibility']
};
suites.identity.push('update-delivery','update-client-lifecycle','one-window-3275');   /* 3.275 한 기기 한 창 */
suites.records.push('multipitch-rotation','board-settings-pitches');
suites.board.push('board-scout-import','board-roster-import');
suites.idp.push('squad-group-change');
suites.records.push('training-toolbar-layout');
suites.board2.push('board-training-edit','meeting-cover','meeting-reserve','meeting-reserve-edit');
suites.board2.push('meeting-slide-transition');   /* 3.256 — 미팅 슬라이드 넘김: 같은 팀 · 번호만 잇기 · 넘기는 중 저장 막기 */
suites.board.push('board-flat-turf-3263');   /* 3.263 — 평면 잔디: 잎결 · 실사 잔디 줄 약 4m · 가로 · 세로 · 운동장 카드마다(board2 웹킷은 20분 한도에 닿아 board 로) */
suites.selection.push('board-vision-carry-3271','board-position-direct-3271');   /* 3.271 — 시야 · 시선은 이 페이지에만 + 이 장면부터 뒤로(756c0a48) · 오른쪽 클릭 창의 포지션(0033117a) */
suites.board.push('board-page-undo-3271');   /* 3.271 — 페이지 추가 · 복제 · 삭제 되돌리기(1bc9b7d4) — board2 웹킷은 20분 한도에 닿아 board 로 */
suites.entry.push('sync-diagnosis','team-mobile','mobile-navigation');
suites.entry.push('admin-metrics');
suites.entry.push('player-bulk-touch','phone-consistency');
suites.entry.push('schedule-fab-phone-3273');   /* 3.273 — 폰 일정의 떠 있는 «＋ 오늘에 추가»: 폭 112 · 글자 양옆 여백(3.218 의 min-width:44px 에 눌렸다) */
suites.entry.push('note-export');   /* 3.265 — 개인 노트 «내보내기»(PDF로 저장 · 인쇄 · 이미지 저장) */
suites.entry.push('i18n-english-shell');   /* 영어 모드 셸: 한글이 남지 않음 · 한국어로 되돌리기 · 한국어 사용자는 영어 사전을 받지 않음 · «학습» 없는 다섯 칸 */
/* 3.272 — storage 묶음이 두 엔진 모두 20분 한도에 닿았다(PR #800 — 시험 합 16.4분 + 준비). 긴 셋(roster-outbox-full · xss-synced-docs · xss-synced-docs-team, 약 4.7분)은
   3~5분에 끝나는 boardperf 묶음에서 돈다 */
suites.storage.push('community-youtube');
suites.storage.push('roster-pending-quota');
suites.boardperf.push('roster-outbox-full');   /* 3.253 — 선수 변경 묶음으로 가득 찬 작은 저장소에서 부팅 · 저장(제보 e6fc5d26) */
suites.boardperf.push('xss-synced-docs');   /* 3.271 — 팀원이 동기화로 보낸 IDP · 일정 문서가 코치 화면에서 실행되지 않는다(끼워 넣은 값 탐침) */
suites.identity.push('sched-fill-team');   /* «일정 ＋» 시트의 «팀 공통»이 «훈련»을 누르면 A팀이 되던 것 — 팀 공통 · 한 팀 · 여러 팀 */
suites.records.push('sched-day-kind');   /* 한 팀을 OFF 로 돌린 날은 일정 칸 · 요약 · 팀 «오늘» · 주간 PDF 가 모두 OFF(PSSchedule.dayKind) */
suites.records.push('sched-memo-autosave');   /* 세션 시트 «메모» · «장소»: 치는 동안 저장 + psFlushPending · pagehide · visibilitychange(한글 조합 · 새로고침 · 끊긴 동안) */
suites.identity.push('sched-safe-actions');   /* 세션 × 되돌리기 알림 · × 44px · 칸 밖으로 안 잘림 / «지난주 복사»가 잡힌 경기를 안 덮음 / «안 올라간 변경» 줄이 판을 안 밂 */
suites.entry.push('phone-drill-blank');   /* 폰 보기 전용: 장면이 있는 가로 작전판이 빈 화면(숨은 장면 줄 몫으로 판 높이 0) — 보관함 보기 · 전체화면 · 팀 오늘의 훈련 보기, 360 · 390 · 430 */
suites.boardperf.push('xss-synced-docs-team');   /* 3.272 — 명단 · 경기 · 게임모델 · 일정 사전 · 공지 · 팀원 이름 · 코치→선수 문서(코치로 한 번 · 선수로 한 번, 크로미움 약 160초) */
suites.boardperf.push('board-return-clean-3274');   /* 3.274 — 다른 앱에 갔다 작전판으로 돌아오기는 편집이 아니다 */
suites.boardperf.push('depth-panel-reorder-3273');   /* 3.273 — «선택한 포지션» 목록에서 끌어 순서 · 이름을 누르면 프로필 바로 */
suites.entry.push('oauth-callback-gate');   /* 3.272 — 남이 만든 #access_token 링크로는 로그인되지 않는다 · 단추로 시작한 로그인 · 초대 링크 · 다른 창 콜백 · 관리자 화면은 그대로 */
suites.entry.push('logout-direct-pages');   /* 3.272 — 로그아웃한 기기에서 팀 화면을 주소로 바로 열어도 자료를 그리지 않는다(data-lock-guard.js) */
const PER_TEST_MS={'board-drag-performance':360000};   /* 3.012 — 한 테스트 한도(기본 240초)의 예외. 위 boardperf 참고 */
/* 3.012 — 엔진과 상관없이 Chromium 을 직접 띄우는 시험(PS_BROWSER_ENGINE 을 읽지 않는다). WebKit 잡에서는 Chrome 경로가 없어 바로 죽거나
   Chromium 을 한 번 더 돌릴 뿐이라, WebKit 잡에서는 건너뛰고 그렇다고 적는다 — Chromium 잡이 그대로 지킨다. */
// community-library exercises desktop Chromium and phone/tablet WebKit in one run.
const CHROMIUM_ONLY=new Set(['player-eye-renderer','guidance','quiet-entry','training-context','community-library','community-detail','community-cards']);
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
