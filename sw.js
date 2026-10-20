/* PROCESS STUDIO 서비스워커 — HTML 은 캐시 우선, 판(CACHE)이 바뀌어야 사용자가 새 판을 받는다(docs/OPERATIONS.md).
   CACHE 의 판 번호는 studio/app.html 의 window.PS_BUILD 와 같아야 한다(tests/syntax). 판마다 바뀐 점은 studio/release-notes.js 와
   커밋 기록에 적는다 — 3.038 까지 이 파일 머리에 쌓이던 1,600줄의 변경 기록은 걷었다(피드백 TD-7). */
const CACHE = 'process-3.121';   // 3.121 유니폼 꾸미기 «토큰 미리보기» — 판에서 보일 원형 · 유니폼 토큰을 창 안에(board-kit.js)
// 하나라도 빠지면 앱의 기본 실행이 깨질 수 있는 파일.
const CORE = [
  '/studio/app.html', '/studio/board.html', '/studio/board-name-font.js', '/studio/board-settings-skin.js', '/studio/board-token-depth.js', '/studio/board-pitch-photo.js', '/studio/board-broadcast.js', '/studio/board-dock-float.js', '/studio/board-dock-skin.js', '/studio/board-topbar.js', '/studio/board-real-size.js', '/studio/board-kit.js', '/studio/board-create-frame.js', '/studio/board-tweaks.js', '/studio/board-comm-look.js', '/studio/board-dock-film.js', '/studio/board-inspector.js', '/studio/board-actions.js', '/studio/board-vault-lazy.js', '/studio/board-guest.js', '/studio/board-vault-browse.js', '/studio/board-vault-import.js', '/studio/board-quick-export.js', '/studio/board-meet-8.js', '/studio/board-jersey.js', '/studio/board-edit-view.js', '/studio/vault-folder-move.js',
  '/studio/process.html',
  '/studio/review-training.js', '/studio/review-training-schedule.js', '/studio/pdf-export.js', '/studio/schedule-poster.js', '/studio/review-training.css', '/studio/year-plan.js',
  '/studio/first-work.js', '/studio/first-work.css',
  '/studio/daily-effort.js', '/studio/daily-effort.css', '/studio/session-focus.js',
  '/studio/idp-recovery.js', '/studio/idp-recovery.css', '/studio/idp-roster-refresh.js',
  '/studio/idp-evidence.js', '/studio/idp-evidence.css', '/studio/idp-start.css', '/studio/idp-daily.css',
  '/studio/storage-keys.js', '/studio/storage.js', '/studio/team-library.js', '/studio/team-load.js', '/studio/team-photos.js', '/studio/profile-sheet.js', '/studio/player-card.js',
  '/studio/scouting-store.js', '/studio/roster-recovery.js', '/studio/roster-outbox.js','/studio/participation.js', '/studio/match-board-tools.js', '/studio/match-formats.js', '/studio/sync-observability.js', '/studio/idp-pub-wipe.js', '/studio/sync.js',
  '/studio/autosave-status.js', '/studio/update-progress.js', '/studio/autosave-journal.js', '/studio/autosave-merge.js', '/studio/autosave-runtime.js', '/studio/autosave-recovery.js',
  '/studio/shared-view-observation.js',
  '/studio/team-files.js',
  '/studio/support-diagnostics.js', '/studio/support.js', '/studio/support.css', '/studio/release-notes.js', '/studio/install-door.js',
  '/studio/perms.js',
  '/studio/football-language.js',
  '/studio/eval-standard.js',
  '/studio/eval-anchors.js',
  '/studio/archetypes.js',
  '/studio/req-baseline.js',
  '/studio/mobile-polish.css',
  '/studio/premium-ui.css',
  '/studio/design-v2.css',
  '/studio/figma-premium.css',
  '/studio/ui-grammar.css',
  '/studio/team-ui-v375.css'
];

// 기능별로 늦게 쓰이거나, 실패해도 기본 앱 실행은 가능한 파일.
const OPTIONAL = [
  '/guide/quick.html', '/guide/index.html', '/guide/team.html', '/start/index.html', '/start/how.html', '/start/idp.html',
  '/', '/index.html', '/manifest.json',
  /* 3.076 — 관리자 화면(admin.html · admin-*, 약 0.4MB)은 미리 받지 않는다. 운영자만 쓰고, 열면 그때 받아 이 판 캐시에 담긴다(cacheFirst). */
  '/studio/', '/studio/index.html',
  '/studio/board.html',
  '/studio/gamemodel.html', '/studio/scout.html', '/studio/terms.html', '/studio/idp.html', '/studio/note.html', '/studio/scouting.html', '/studio/community.html', '/studio/analysis.html', '/studio/learning.html', '/studio/playbook.html',
  '/studio/balls.js', '/studio/pitches.js', '/studio/rpt-i18n.js',
  '/studio/vault-examples.js',   /* 3.001 — 빈 보관함 첫 화면의 예시. 없으면 첫 화면은 옛 모양 그대로 */
  '/studio/community-fifa.js', '/studio/community-fifa.css', '/studio/community-tax.js', '/studio/community-tax.css',   /* 3.071 — 커뮤니티 «FIFA» 칸. 없으면 그 칸만 «불러오지 못했어요» */
  /* 3.076 — PPT 모듈(pptxgen 0.46MB)은 미리 받지 않는다. 내보낼 때 받고, 못 받으면 board · gamemodel 이 jsdelivr 로 다시 받는다. */
  /* 2.552 — 통짜 폰트(2,009KB)를 **미리 받지 않는다.** 여기 목록에 있으면 첫 방문에
     화면과 상관없이 2MB 를 끌어온다 — 코치는 운동장에서 셀룰러로 앱을 연다.
     ⚠ Pretendard 는 이제 92 조각 동적 서브셋이라 **화면이 실제로 쓰는 조각만** 내려온다.
        그 조각들은 프리캐시가 아니라 `isVersionedStatic`(.woff2) 의 캐시 우선 규칙이
        받는 즉시 잡는다 — 오프라인은 그대로 되고, 안 쓰는 글자는 안 받는다.
     ⚠ Jost(라틴 26KB)는 남긴다 — 숫자·영문에 늘 쓰여 어차피 첫 화면에서 받는다. */
  '/vendor/fonts.css', '/vendor/tokens.css', '/vendor/Jost-latin.woff2', '/vendor/qrcode.js',
  /* 3.076 — PDF 뷰어(pdfjs 1.4MB)는 미리 받지 않는다. 개인 노트에서 PDF 를 열 때 받고, 못 받으면 note.html 이 cdnjs 로 다시 받는다. */
  '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png', '/favicon.png', '/apple-touch-icon.png',
  '/icon-mac-192.png', '/icon-mac-512.png', '/icon-mac-1024.png'
];
const SHELL = Array.from(new Set(CORE.concat(OPTIONAL)));
const SHELL_PATHS = new Set(SHELL);

async function fetchFresh(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res || !res.ok) throw new Error('precache-failed:' + path);
  return res;
}

/* 3.051 — 바뀐 파일만 받는다(피드백 TD-4 — 판마다 13.6MB 를 전부 다시 받았다. 하루 4~5판이면 셀룰러 코치에게 부담).
   배포의 판 목록(/sw-manifest.json — scripts/package-site.mjs 가 만든다: 주소 → SHA-256)을 받아, 옛 판 캐시에 있는 같은 주소의
   **본문을 직접 해시해** 목록과 같을 때만 그 응답을 새 캐시에 옮겨 담는다. 옛 캐시의 목록을 믿지 않는다 — 옛 install 이 배포와 겹쳐
   목록과 파일이 어긋났을 수 있다. 목록이 없거나 못 받으면(첫 배포 · 로컬 실행) 예전처럼 전부 받는다. 목록에 없는 주소(/ · /studio/ 같은
   경로 이름)도 늘 받는다. 목록은 새 캐시에 함께 둔다(다음 판이 견줄 일은 없지만 진단에 쓴다). */
const MANIFEST = '/sw-manifest.json';
async function readManifest() {
  try {
    const res = await fetch(MANIFEST, { cache: 'no-store' });
    if (!res || !res.ok) return null;
    const j = await res.clone().json();
    if (!j || j.release !== CACHE || !j.files || typeof j.files !== 'object') return null;   /* 다른 판의 목록(배포가 바뀌는 중)이면 쓰지 않는다 */
    return { files: j.files, res };
  } catch (_) { return null; }
}
function hex(buf) { return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join(''); }
async function reusable(path, want, olds) {
  if (!want || !/^[0-9a-f]{64}$/.test(want) || !self.crypto || !crypto.subtle) return null;
  for (const old of olds) {
    try {
      const hit = await old.match(path);
      if (!hit || !hit.ok) continue;
      if (hex(await crypto.subtle.digest('SHA-256', await hit.clone().arrayBuffer())) === want) return hit;
    } catch (_) {}
  }
  return null;
}
async function notifyProgress(done, total) {
  try { for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage({ type: 'ps-sw-progress', release: CACHE, done, total }); } catch (_) {}
}
async function precache(cache, path, files, olds, stats) {
  const old = files ? await reusable(path, files[path], olds) : null;
  if (old) { await cache.put(path, old); stats.reused++; if (stats.tick) stats.tick(); return; }
  await cache.put(path, await fetchFresh(path)); stats.fetched++; if (stats.tick) stats.tick();   /* 3.060 — 진행 알림(받은 뒤에만 센다) */
}
/* 한꺼번에 백 개를 열지 않는다 — 옛 본문을 해시하려고 읽는 메모리(아이패드)를 묶어 둔다 */
async function eachLimit(list, n, fn) {
  let i = 0; const run = async () => { while (i < list.length) { const k = i++; await fn(list[k]); } };
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, run));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const man = await readManifest(), files = man ? man.files : null, stats = { reused: 0, fetched: 0 };
    const olds = files ? await Promise.all((await caches.keys()).filter(k => isReleaseCache(k) && k !== CACHE).reverse().slice(0, 2).map(k => caches.open(k))) : [];

    /* 3.060 — 받는 만큼 열린 화면에 알린다(update-progress.js 의 «새 버전 받는 중 42%»). 판 이름과 개수뿐 — 내용 없음 */
    const prog = { done: 0, total: SHELL.length, at: 0 };
    stats.tick = () => { prog.done++; if (prog.done < prog.total && Date.now() - prog.at < 200) return; prog.at = Date.now(); notifyProgress(prog.done, prog.total); };

    // 필수 파일은 원자적으로 취급한다. 하나라도 실패하면 install이 실패하고 이전 SW가 유지된다.
    await eachLimit(CORE, 6, path => precache(cache, path, files, olds, stats));

    // 선택 파일은 가능한 만큼 준비한다. 누락 파일은 첫 사용 시 네트워크에서 채운다.
    await eachLimit(OPTIONAL.filter(p => !CORE.includes(p)), 6, async (path) => {   /* 두 목록에 다 있는 것(board.html)은 한 번만 */ try { await precache(cache, path, files, olds, stats); } catch (_) { stats.tick(); } });
    delete stats.tick;
    if (man) { try { await cache.put(MANIFEST, man.res); } catch (_) {} }
    /* 진단: 이번 install 이 몇 개를 옮겨 담고 몇 개를 받았나(앱 설정 › 데이터 › «진단 보기»가 읽을 수 있는 자리 — 판 캐시 안) */
    try { await cache.put('/__ps_sw_install__', new Response(JSON.stringify({ at: Date.now(), release: CACHE, manifest: !!files, ...stats }), { headers: { 'Content-Type': 'application/json' } })); } catch (_) {}

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const ready = await Promise.all(CORE.map(path => cache.match(path)));
    if (ready.some(hit => !hit)) {
      // 새 캐시가 불완전하면 이전 캐시를 삭제하거나 기존 클라이언트를 가져오지 않는다.
      throw new Error('core-cache-incomplete');
    }

    // Keep each already-open document on its own release until its safe reload.
    // Persist bindings because a browser may terminate this worker between requests.
    const keys = (await caches.keys()).filter(isReleaseCache);
    const previous = keys.filter(key => key !== CACHE).at(-1);
    const live = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const keep = new Set([CACHE, previous].filter(Boolean));
    for (const client of live) {
      const bound = await clientRelease(client.id);
      const version = htmlRelease(new URL(client.url));
      const release = keys.includes(bound) ? bound : keys.includes(version) ? version : previous || CACHE;
      await bindClient(client.id, release); keep.add(release);
    }
    const meta = await caches.open(CLIENT_CACHE);
    const ids = new Set(live.map(client => client.id));
    for (const request of await meta.keys()) {
      if (!ids.has(new URL(request.url).pathname.split('/').pop())) await meta.delete(request);
    }
    await Promise.all(keys.filter(key => !keep.has(key)).map(key => caches.delete(key)));
    await self.clients.claim();
    // 2.949 — 활성화 순간 이미 숨어 있던 옛 탭의 «숨김 시작»을 적어 둔다(새로 열지는 않는다 — 문서 자신에게 먼저 기회를).
    stuckLast = 0; try { await stuckCheck(); } catch (_) {}
  })());
});

// This namespace contains only release names, never user data or credentials.
const CLIENT_CACHE = 'process-client-releases-v1';
function isReleaseCache(name) { return /^process-\d+\.\d+(?:\.\d+)?$/.test(name); }
function clientKey(id) { return new URL('/__ps_client_release__/' + encodeURIComponent(id), self.location.origin).href; }
async function clientRelease(id) {
  if (!id) return null;
  const hit = await (await caches.open(CLIENT_CACHE)).match(clientKey(id));
  return hit ? hit.text() : null;
}
async function bindClient(id, release) {
  if (id) await (await caches.open(CLIENT_CACHE)).put(clientKey(id), new Response(release));
}
/* 2.949 — 오래 숨은 옛 판 앱 탭은 서비스워커가 새로 연다(10/1 보류 → 10/6 사용자 «순서대로 해줘»).
   옛 문서는 자기 안전 새로고침(2.388)에 기대는데, 그 옛 코드의 버그(2.941 이전: 선택 상자 포커스·다른 출처 iframe 등)로
   하루 넘게 옛 판에 갇힌 컴퓨터가 있었고(2.875·2.885·2.913), 10/5~10/6 에는 옛 판 부팅이 가용인원 기록을 지웠다(2.948).
   새 서비스워커 코드는 옛 문서에도 돈다 — 그래서 옛 판 기기는 여기서만 고칠 수 있다.
   셋 다일 때만 새로 연다: ① 이 판보다 앞선 앱 셸 문서(바인딩된 release ≠ CACHE, /studio/app.html)
   ② 맨 위 창·포커스 없음 ③ 10분 넘게 «숨김»으로만 관찰됨(관찰 사이가 25분을 넘으면 그 사이를 모르므로 다시 잰다).
   ⚠ 보이는 탭은 절대 건드리지 않는다 — 쓰는 중일 수 있다. 그건 문서 자신의 안전 새로고침 몫이다.
   숨은 지 10분이면 화면의 지연 저장(최대 수 초)은 오래전에 끝났고, 새로 열 때 pagehide 저장도 돈다.
   관찰은 그 탭의 요청(동기화·보고 — 다른 출처 요청도 fetch 이벤트는 온다)이 서비스워커를 깨울 때 한다.
   끄려면 STUCK_RELOAD_ON=false 로 배포(서비스워커는 30분·탭을 볼 때마다 새 판을 확인한다). */
const STUCK_RELOAD_ON = true;
const STUCK_HIDDEN_MS = 10 * 60 * 1000;
const STUCK_GAP_MS = 25 * 60 * 1000;
const STUCK_CHECK_MS = 60 * 1000;
const STUCK_PATHS = new Set(['/studio/app.html']);
let stuckLast = 0;
function hiddenKey(id) { return new URL('/__ps_client_hidden__/' + encodeURIComponent(id), self.location.origin).href; }
const FORCED_KEY = new URL('/__ps_sw_forced__', self.location.origin).href;
async function stuckCheck(now = Date.now()) {
  if (!STUCK_RELOAD_ON || now - stuckLast < STUCK_CHECK_MS) return 0;
  stuckLast = now;
  const meta = await caches.open(CLIENT_CACHE);
  const list = await self.clients.matchAll({ type: 'window' });
  let moved = 0;
  for (const client of list) {
    try {
      if (client.frameType && client.frameType !== 'top-level') continue;
      const url = new URL(client.url);
      if (url.origin !== self.location.origin || !STUCK_PATHS.has(url.pathname)) continue;
      const key = hiddenKey(client.id);
      const release = await clientRelease(client.id);
      if (!release || release === CACHE || client.visibilityState !== 'hidden' || client.focused) { await meta.delete(key); continue; }
      const hit = await meta.match(key);
      let st = null; try { st = hit ? JSON.parse(await hit.text()) : null; } catch (_) { st = null; }
      if (!st || !(st.seen > 0) || now - st.seen > STUCK_GAP_MS || now < st.since) st = { since: now, seen: now };
      else st.seen = now;
      const due = now - st.since >= STUCK_HIDDEN_MS && !(st.tried && now - st.tried < STUCK_GAP_MS);
      if (due) st.tried = now;
      await meta.put(key, new Response(JSON.stringify(st)));
      if (!due || typeof client.navigate !== 'function') continue;
      await meta.put(FORCED_KEY, new Response(JSON.stringify({ at: now, from: release, to: CACHE, mins: Math.round((now - st.since) / 60000) })));
      await client.navigate(client.url);
      moved++;
    } catch (_) {}
  }
  return moved;
}
function htmlRelease(url) {
  const v = url.searchParams.get('v');
  return /\.html$/.test(url.pathname) && v && /^\d+\.\d+(?:\.\d+)?$/.test(v) ? 'process-' + v : null;
}
async function requestRelease(event) {
  const request = event.request, url = new URL(request.url);
  const topNavigation = request.mode === 'navigate' && request.destination === 'document';
  let release = topNavigation ? CACHE : await clientRelease(event.clientId);
  // A newly opened iframe has no clientId yet. Its shell already supplies PS_BUILD.
  if (!release && request.mode === 'navigate') release = htmlRelease(url);
  if (!release) release = CACHE;
  if (event.resultingClientId) await bindClient(event.resultingClientId, release);
  return release;
}
async function cacheFirst(request, release = CACHE) {
  const cache = await caches.open(release);
  const url = new URL(request.url);
  let hit = await cache.match(request, { ignoreSearch: false });
  if (!hit && url.origin === self.location.origin && SHELL_PATHS.has(url.pathname)) {
    hit = await cache.match(url.pathname);
  }
  if (hit) return hit;
  // Old optional files may never have downloaded. Do not inject current code
  // into an old document; its existing safe-reload flow can finish the update.
  if (release !== CACHE && (request.mode === 'navigate' || /\.(?:html|js)$/i.test(url.pathname))) {   // 2.897 — css 는 막지 않는다: 409 글자를 받으면 옛 화면이 디자인 없이 떴다(작전판 내보내기 메뉴 펼침)
    return new Response('새 버전이 준비되었습니다. 작업을 저장한 뒤 앱을 다시 열어 주세요.', { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const res = await fetch(request);
  if (res && res.ok) {
    try { await cache.put(request, res.clone()); } catch (_) {}
  }
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      try { await cache.put(request, res.clone()); } catch (_) {}
    }
    return res;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

function isVersionedStatic(url) {
  return SHELL_PATHS.has(url.pathname)
    || url.pathname.startsWith('/vendor/')
    || /\.(?:css|js|woff2?|png|jpe?g|webp|svg|ico)(?:$|\?)/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  // 2.949 — 옛 판 탭 관찰은 모든 요청(다른 출처·POST 포함)에서 1분에 한 번. 응답에는 손대지 않는다.
  if (STUCK_RELOAD_ON) { try { event.waitUntil(stuckCheck().catch(() => 0)); } catch (_) {} }
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = request.mode === 'navigate' || /\.html$/i.test(url.pathname);
  if (isHTML || isVersionedStatic(url)) {
    // 실행 화면과 버전 정적 파일은 서버 왕복 없이 즉시 연다.
    event.respondWith((async () => {
      try {
        return await cacheFirst(request, await requestRelease(event));
      } catch (error) {
        if (request.mode === 'navigate') {
          const cache = await caches.open(await requestRelease(event));
          const shell = await cache.match('/studio/app.html');
          if (shell) return shell;
        }
        throw error;
      }
    })());
    return;
  }

  // 같은 출처의 비정적 GET만 네트워크 우선. Supabase 등 외부 API 요청은 가로채지 않는다.
  event.respondWith(networkFirst(request));
});
