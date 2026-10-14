/* 애니띵 모닝 — 아침 5분, 1년이면 달라진다.
   과정: 좋은 문장(사람을 움직이는 말) · 우리말(잘 안 쓰지만 아름다운 낱말) · 인문학(개념·문장·오늘의 질문) · 일본어 · 영어(생활 회화, 1주 1장면).
   주간 리듬(기본): 월~금 배우는 날(과정마다 새 항목) · 토 실전의 날(이번 주 것을 실제로 써 보기) · 일 돌아보는 날(복습과 한 주 정리).
   하루 분량 '가볍게'(과정마다 하루 1개)면 1년, '보통'은 6개월, '많이'는 4개월에 완주한다.
   오래 가게 돕는 장치: 7일에 하루 쉼표(연속 유지), 바쁜 날 1분 루틴, 다시 온 날 복습 줄이기, 이정표 축하, 1년 기록.
   기록은 모두 이 기기의 localStorage 한 곳(KEY)에만 둔다. 서버는 없다. */
(() => {
  'use strict';

  const KEY = 'anything-morning.v1';
  const DAY_START_HOUR = 4;                              // 새벽 4시 전까지는 전날 루틴으로 친다
  const INTERVALS = [1, 2, 4, 7, 15, 30, 60, 120, 240];  // 상자 번호별 다음 복습까지의 날짜 — 익힌 뒤에도 몇 달 뒤 다시 본다
  const MASTERED_BOX = 4;                                // 15일 간격까지 기억하면 '익힘'
  const FULL_RECALL_BOX = 2;                             // 회화 표현은 이 상자부터 빈칸 없이 통째로 말한다
  const MAX_REVIEW = 8;                                  // 과정마다 하루 복습 상한
  const REVIEW_DAY_MAX = 15;                             // 돌아보는 날 복습 상한
  const COMEBACK_MAX = 5;                                // 사흘 넘게 쉬다 돌아온 날은 복습을 적게
  const REST_EVERY = 7;                                  // 7일에 하루는 빠져도 연속이 이어진다
  const UNITS_PER_STAGE = 13;
  const STAGE_NAMES = ['첫걸음', '일상', '여행과 관계', '내 이야기'];
  const LOAD_NAMES = ['가볍게', '보통', '많이'];
  const LOAD_SPAN = ['1년', '6개월', '4개월'];
  const ANCHORS = ['아침 커피를 내린 뒤', '출근길 지하철에서', '아침밥을 먹고 나서', '점심을 먹고 나서', '잠들기 전 이불 속에서'];
  const MILESTONES = {
    3: '사흘을 해냈어요. 시작이 반이에요.',
    7: '일주일! 습관의 첫 고리가 걸렸어요.',
    14: '2주째예요. 몸이 먼저 아침 루틴을 기억하기 시작해요.',
    21: '3주! 이제 안 하면 허전한 날이 올 거예요.',
    30: '한 달을 채웠어요. 처음 배운 것들이 오래 가는 기억으로 넘어가는 중이에요.',
    50: '50일! 꾸준함이 실력이 되고 있어요.',
    75: '75일. 처음 배운 것을 다시 보면 달라진 게 느껴질 거예요.',
    100: '100일! 하루 5분이 모여 큰 걸음이 됐어요.',
    150: '150일. 지금처럼만 가면 돼요.',
    200: '200일. 이 루틴이 생활의 일부가 됐어요.',
    250: '250일! 처음보다 말이 훨씬 풍성해졌을 거예요.',
    300: '300일. 결승선이 보여요.',
    365: '365일, 1년을 완주했어요! 스스로에게 크게 박수를 쳐 주세요.'
  };
  const DAY_LABEL = { learn: '배우는 날', practice: '실전의 날', review: '돌아보는 날', quick: '1분 루틴' };
  const WHO = { coach: '선수', work: '동료·팀원', parent: '아이', teacher: '학생', friend: '친구·연인', self: '나 자신' };
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const STATUS_LABEL = { new: '처음', learning: '학습 중', mastered: '익힘' };
  const LANG_NAME = { ko: '한국어', ja: '일본어', en: '영어' };
  const HOLE = '<span class="hole" aria-hidden="true"></span>';

  const COURSES = [
    { id: 'sentence', name: '좋은 문장', glyph: '“', kind: 'sentence', lang: 'ko-KR', desc: '사람을 움직이는 말', unitWord: '문장', data: window.AM_DATA },
    { id: 'uri', name: '우리말', glyph: '가', kind: 'word', lang: 'ko-KR', desc: '잘 안 쓰지만 아름다운 낱말', unitWord: '낱말', data: window.AM_URI },
    { id: 'hum', name: '인문학', glyph: '人', kind: 'idea', lang: 'ko-KR', desc: '생각의 뿌리를 찾는 개념과 문장', unitWord: '개념', data: window.AM_HUM },
    { id: 'ja', name: '일본어', glyph: 'あ', kind: 'phrase', lang: 'ja-JP', desc: '1주 1장면 생활 회화', unitWord: '표현', data: window.AM_JA },
    { id: 'en', name: '영어', glyph: 'A', kind: 'phrase', lang: 'en-US', desc: '1주 1장면 생활 회화', unitWord: '표현', data: window.AM_EN }
  ].filter(co => co.data && Array.isArray(co.data.cards) && co.data.cards.length);
  const courseById = Object.fromEntries(COURSES.map(co => [co.id, co]));
  const QUICK = { id: 'quick', name: '1분 루틴', glyph: '1', kind: 'quick', lang: 'ko-KR', unitWord: '' };
  const builtin = new Map();
  const orderInGroup = {};
  COURSES.forEach(co => {
    co.groups = co.data.categories || co.data.units || [];
    co.groupById = Object.fromEntries(co.groups.map(g => [g.id, g]));
    const seen = {};
    co.data.cards.forEach(c => {
      c.course = co.id; c.g = c.cat || c.unit;
      seen[c.g] = seen[c.g] || 0; orderInGroup[c.id] = seen[c.g]++;
      builtin.set(c.id, c);
    });
  });
  const CONTEXTS = courseById.sentence ? courseById.sentence.data.contexts || [] : [];
  const canSpeak = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  const inFrame = window.top !== window.self;
  const hostTheme = document.documentElement.getAttribute('data-theme');

  /* ---------- 작은 도구 ---------- */
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => { const d = new Date(); d.setHours(d.getHours() - DAY_START_HOUR); return ymd(d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const shortDate = s => { const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
  const monthLabel = s => { const d = parse(s); return `${d.getFullYear()}년 ${d.getMonth() + 1}월`; };
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const hasBatchim = w => { const code = String(w).trim().slice(-1).charCodeAt(0); return code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0; };
  const josa = (w, withB, withoutB) => w + (hasBatchim(w) ? withB : withoutB);

  const ICONS = {
    sunrise: '<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 6v3M5.2 10.2 7 11.5M18.8 10.2 17 11.5"/>',
    book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19v3H7.5"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    speaker: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    slow: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    star: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chat: '<path d="M4 5h16v10H9l-5 4z"/>',
    bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
    chev: '<path d="m9 6 6 6-6 6"/>'
  };
  const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

  /* ---------- 저장 ---------- */
  function fresh() {
    return {
      v: 3,
      settings: { courses: COURSES.map(co => co.id), contexts: [], load: 1, rhythm: 'week', anchor: '', start: '', time: '07:00', theme: 'system', pron: true, onboarded: false },
      progress: {},   // 카드 id → { box, due, seen, last, reps, lapses }
      days: {},       // 'YYYY-MM-DD' → { done: true, c: { 과정 id 또는 'quick': true } }
      plans: {},      // 과정 id → 오늘의 루틴(날짜가 바뀌면 새로 만든다)
      quick: null,    // 오늘의 1분 루틴
      intents: [],    // 실천 약속 { id, date, cardId, who, when, result: null|'used'|'notyet', note }
      rewrites: [],   // 내가 쓴 문장 { id, date, cardId, course, text, kind? }
      custom: [],     // 사용자가 추가한 문장(좋은 문장 과정의 카드 모양, custom: true)
      favs: {}, notes: {},
      dlg: {},        // 장면 id → { n: 완주 횟수, last: 날짜 }
      kana: {},       // 글자 퀴즈 최고 점수 { hira, kata }
      mile: {}        // 이정표(공부한 날 수) → 처음 넘은 날
    };
  }
  function migrate(s) {
    const f = fresh();
    if (!s || typeof s !== 'object') return f;
    const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const arr = v => (Array.isArray(v) ? v : []);
    const settings = { ...f.settings, ...obj(s.settings) };
    if (!Array.isArray(settings.contexts)) settings.contexts = [];
    // 1판은 과정이 하나였다: 하루 새 문장 수 → 하루 분량, 하나뿐이던 루틴 → 좋은 문장 루틴
    if (s.settings && s.settings.load == null && s.settings.newPerDay != null) settings.load = s.settings.newPerDay;
    delete settings.newPerDay;
    settings.load = [1, 2, 3].includes(+settings.load) ? +settings.load : 1;
    settings.rhythm = settings.rhythm === 'daily' ? 'daily' : 'week';
    settings.anchor = typeof settings.anchor === 'string' ? settings.anchor.slice(0, 40) : '';
    settings.courses = arr(settings.courses).filter(id => courseById[id]);
    if (!settings.courses.length) settings.courses = COURSES.map(co => co.id);
    const days = obj(s.days);
    if (!settings.start && settings.onboarded) settings.start = Object.keys(days).filter(d => days[d] && days[d].done).sort()[0] || '';
    const plans = obj(s.plans);
    if (s.plan && typeof s.plan === 'object' && !plans.sentence) plans.sentence = { ...s.plan, course: 'sentence' };
    Object.keys(plans).forEach(k => { const p = plans[k]; if (!courseById[k] || !p || !Array.isArray(p.review) || !Array.isArray(p.fresh)) delete plans[k]; });
    const custom = arr(s.custom).filter(c => c && c.id && c.text).map(c => ({ ...c, course: 'sentence', g: c.cat }));
    const quick = s.quick && typeof s.quick === 'object' && Array.isArray(s.quick.steps) ? s.quick : null;
    return {
      ...f, settings, plans, custom, days, quick,
      progress: obj(s.progress), favs: obj(s.favs), notes: obj(s.notes), dlg: obj(s.dlg), kana: obj(s.kana), mile: obj(s.mile),
      intents: arr(s.intents), rewrites: arr(s.rewrites)
    };
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { /* 저장소를 못 쓰면 새로 시작 */ }
    return fresh();
  }
  let storageWarned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {
      if (!storageWarned) { storageWarned = true; toast('이 기기에 기록을 저장하지 못했어요. 개인 정보 보호 모드라면 꺼 주세요.'); }
    }
  }

  let S = load();
  const ui = {
    view: 'today', libCourse: '', libSub: 'items', libFilter: 'all', libCtx: '', q: '', wordsMode: 'learned', notesMode: 'year', kanaSet: 'hira', openUnits: {},
    session: null, practice: null, revealed: false, reads: 0, checkNote: false, who: '', pick: null, stepKey: '',
    dlgLine: 0, dlgRevealed: false, dlgSwap: false, scrollEnd: false,
    sheet: null, sheetId: null, sheetKey: '', confirm: null, pendingImport: null, quiz: null, onb: 0
  };

  /* ---------- 카드와 진도 ---------- */
  const cardById = id => builtin.get(id) || S.custom.find(c => c.id === id) || null;
  const courseOf = c => courseById[c.course] || courseById.sentence;
  const activeCourses = () => COURSES.filter(co => S.settings.courses.includes(co.id));
  const groupName = c => { const co = courseOf(c), g = co && co.groupById[c.g]; return g ? g.name : '내 문장'; };
  const cardsOf = co => (co.id === 'sentence' ? co.data.cards.concat(S.custom) : co.data.cards);
  const status = id => { const p = S.progress[id]; return !p ? 'new' : p.box >= MASTERED_BOX ? 'mastered' : 'learning'; };
  const nextBox = (p, g) => (g === 'again' ? 0 : g === 'hard' ? p.box : Math.min(p.box + 1, INTERVALS.length - 1));
  const newCount = () => S.settings.load;
  const langAttr = co => (co.lang === 'ja-JP' ? ' lang="ja"' : co.lang === 'en-US' ? ' lang="en"' : '');
  const langName = co => LANG_NAME[co.lang.slice(0, 2)];
  const badge = co => `<span class="badge"${langAttr(co)} aria-hidden="true">${esc(co.glyph)}</span>`;
  const isDone = d => !!(S.days[d] && S.days[d].done);
  const learnedIn = co => co.data.cards.filter(c => S.progress[c.id]).length;

  function learn(id) {
    const t = today();
    if (!S.progress[id]) S.progress[id] = { box: 0, due: addDays(t, INTERVALS[0]), seen: t, last: t, reps: 0, lapses: 0 };
  }
  function gradeCard(id, g) {
    const t = today();
    const p = S.progress[id] || { box: 0, seen: t, reps: 0, lapses: 0 };
    p.box = nextBox(p, g);
    p.due = addDays(t, INTERVALS[p.box]);
    p.last = t;
    p.reps = (p.reps || 0) + 1;
    if (g === 'again') p.lapses = (p.lapses || 0) + 1;
    S.progress[id] = p;
  }

  /* 공부한 날 기록: 빠진 날이 공부한 두 날 사이에 끼어 있고 지난 쉼표에서 7일이 지났으면 '쉼표'로 쳐서 연속을 잇는다.
     어제를 빠졌어도 오늘 하면 이어지도록, 오늘 바로 앞의 빈 날은 쉼표 후보로 둔다. */
  function history() {
    const t = today();
    const doneDays = Object.keys(S.days).filter(isDone).sort();
    const start = [S.settings.start, doneDays[0], t].filter(Boolean).sort()[0];
    const rests = new Set();
    let lastRest = null, run = 0, best = 0;
    for (let d = start, guard = 0; d <= t && guard < 4000; d = addDays(d, 1), guard++) {
      if (isDone(d)) { run++; best = Math.max(best, run); continue; }
      if (d === t) continue;
      const next = addDays(d, 1);
      if (isDone(addDays(d, -1)) && (isDone(next) || next === t) && (!lastRest || daysBetween(lastRest, d) >= REST_EVERY)) { rests.add(d); lastRest = d; continue; }
      run = 0;
    }
    const lastDone = doneDays.filter(d => d < t).pop() || null;
    return { start, rests, current: run, best, total: doneDays.length, lastDone, gap: lastDone ? daysBetween(lastDone, t) : 0 };
  }
  function dayType(t) {
    if (S.settings.rhythm === 'daily') return 'learn';
    const w = parse(t).getDay();
    return w === 6 ? 'practice' : w === 0 ? 'review' : 'learn';
  }
  // 아직 하나도 배우지 않은 과정은 주말이라도 배우는 날로 시작한다
  const dayTypeFor = (co, t) => { const ty = dayType(t); return ty !== 'learn' && !learnedIn(co) ? 'learn' : ty; };

  const dueIds = (cid, t) => Object.keys(S.progress)
    .filter(id => { const c = cardById(id); return c && c.course === cid && S.progress[id].due <= t; })
    .sort((a, b) => S.progress[a].due.localeCompare(S.progress[b].due) || S.progress[a].box - S.progress[b].box);
  const weekItems = (cid, t) => Object.keys(S.progress)
    .filter(id => { const c = cardById(id), p = S.progress[id], n = p.seen ? daysBetween(p.seen, t) : -1; return c && c.course === cid && n >= 0 && n <= 6; })
    .sort((a, b) => S.progress[a].seen.localeCompare(S.progress[b].seen));
  const recentLearned = (cid, n) => Object.keys(S.progress)
    .filter(id => { const c = cardById(id); return c && c.course === cid; })
    .sort((a, b) => S.progress[b].seen.localeCompare(S.progress[a].seen)).slice(0, n).reverse();

  /* 새 항목 고르기: 회화는 장면 순서대로, 나머지는 분류를 번갈아(문장은 고른 대상에 맞는 것 먼저) */
  function pickNew(co, n, exclude) {
    const cards = co.data.cards.filter(c => !S.progress[c.id] && !exclude.includes(c.id));
    if (co.kind === 'phrase') return cards.slice(0, n).map(c => c.id);
    const prefs = co.kind === 'sentence' ? S.settings.contexts : [];
    const order = co.groups.map(g => g.id);
    return cards
      .map(c => ({ c, miss: prefs.length && !(c.ctx || []).some(x => prefs.includes(x)) ? 1 : 0 }))
      .sort((a, b) => a.miss - b.miss || orderInGroup[a.c.id] - orderInGroup[b.c.id] || order.indexOf(a.c.g) - order.indexOf(b.c.g))
      .slice(0, n)
      .map(x => x.c.id);
  }
  const unitCards = (co, u) => co.data.cards.filter(c => c.g === u.id);
  const completeUnits = (co, extra) => co.groups.filter(u => (u.dialogue || []).length && unitCards(co, u).every(c => S.progress[c.id] || (extra || []).includes(c.id)));
  const currentUnit = co => co.groups.find(u => unitCards(co, u).some(c => !S.progress[c.id])) || null;
  const byLastPractice = (a, b) => ((S.dlg[a.id] || {}).last || '').localeCompare((S.dlg[b.id] || {}).last || '');
  /* 배우는 날의 대화: 오늘로 표현을 다 배우게 되는 장면, 없으면 3일 넘게 쉰 장면 하나 */
  function dialoguesFor(co, freshIds) {
    if (co.kind !== 'phrase') return [];
    const complete = completeUnits(co, freshIds);
    const newly = complete.filter(u => !S.dlg[u.id]).map(u => u.id);
    if (newly.length) return newly.slice(0, 2);
    const t = today();
    const stale = complete.filter(u => daysBetween(S.dlg[u.id].last, t) >= 3).sort(byLastPractice);
    return stale.length ? [stale[0].id] : [];
  }
  /* 실전의 날의 대화: 이번 주에 배운 장면, 없으면 가장 오래 쉰 장면 */
  function practiceDialogues(co, t) {
    if (co.kind !== 'phrase') return [];
    const complete = completeUnits(co);
    const touched = complete.filter(u => unitCards(co, u).some(c => S.progress[c.id] && daysBetween(S.progress[c.id].seen, t) <= 6));
    if (touched.length) return touched.slice(-2).map(u => u.id);
    const rest = complete.filter(u => !S.dlg[u.id] || daysBetween(S.dlg[u.id].last, t) >= 3).sort(byLastPractice);
    return rest.length ? [rest[0].id] : [];
  }
  function pendingIntent(t) {
    return S.intents
      .filter(i => !i.result && i.date < t && daysBetween(i.date, t) <= 3)
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }
  function plan(cid) {
    const t = today();
    const cur = S.plans[cid];
    if (cur && cur.date === t) return cur;
    const co = courseById[cid];
    const type = dayTypeFor(co, t);
    const back = history().gap >= 3;
    const due = dueIds(cid, t).slice(0, back ? COMEBACK_MAX : type === 'review' ? REVIEW_DAY_MAX : MAX_REVIEW);
    let freshIds = [], dialogues = [], extra = [];
    if (type === 'learn') { freshIds = pickNew(co, newCount(), []); dialogues = dialoguesFor(co, freshIds); }
    else if (type === 'practice') dialogues = practiceDialogues(co, t);
    else if (due.length < 5) extra = weekItems(cid, t).filter(id => !due.includes(id)).slice(-(5 - due.length));
    const pending = co.kind === 'sentence' ? pendingIntent(t) : null;
    S.plans[cid] = { date: t, course: cid, type, back, review: due, extra, fresh: freshIds, dialogues, check: pending ? pending.id : null, pick: null, steps: null, pos: 0, done: false };
    save();
    return S.plans[cid];
  }
  function refreshFresh() {
    Object.values(S.plans).forEach(p => {
      if (p.date !== today() || p.steps || p.type !== 'learn') return;
      const co = courseById[p.course];
      p.fresh = pickNew(co, newCount(), []);
      p.dialogues = dialoguesFor(co, p.fresh);
    });
  }
  function buildSteps(p) {
    const co = courseById[p.course], kind = co.kind;
    const steps = [];
    if (p.check) steps.push({ t: 'check', id: p.check });
    p.review.forEach(id => steps.push({ t: 'review', id }));
    (p.extra || []).forEach(id => steps.push({ t: 'review', id, again: true, week: true }));
    p.fresh.forEach(id => steps.push({ t: 'learn', id }));
    const weekOr = n => { const w = weekItems(co.id, p.date); return (w.length ? w : recentLearned(co.id, n)).slice(-7); };
    if (p.type === 'learn') {
      if (kind === 'sentence') {
        if (p.fresh[0]) steps.push({ t: 'rewrite', id: p.fresh[0] });
        if (p.fresh[0] || p.review[0]) steps.push({ t: 'intent', id: p.fresh[0] || p.review[0] });
      } else if (kind === 'word') {
        if (p.fresh[0]) steps.push({ t: 'compose', id: p.fresh[0] });
      } else if (kind === 'idea') {
        if (p.fresh[0]) steps.push({ t: 'ask', id: p.fresh[0] });
      } else (p.dialogues || []).forEach(u => steps.push({ t: 'dialogue', unit: u }));
    } else if (p.type === 'practice') {
      if (kind === 'sentence') { const ids = weekOr(5); if (ids.length) steps.push({ t: 'weekpick', ids }, { t: 'intent', id: '@pick' }); }
      else if (kind === 'word') { const ids = weekOr(5); if (ids.length) steps.push({ t: 'weekwrite', id: ids[0], ids }); }
      else if (kind === 'idea') { const ids = weekOr(5); if (ids.length) steps.push({ t: 'weekthink', id: ids[0], ids }); }
      else if ((p.dialogues || []).length) p.dialogues.forEach(u => steps.push({ t: 'dialogue', unit: u }));
      else { const ids = weekOr(5); if (ids.length) steps.push({ t: 'shadow', ids }); }
    }
    steps.push({ t: 'done' });
    return steps;
  }
  function stepValid(s, p) {
    if (s.t === 'done') return true;
    if (s.t === 'dialogue') return !!(courseById[p.course] && courseById[p.course].groupById[s.unit]);
    if (s.t === 'check') { const it = S.intents.find(i => i.id === s.id); return !!(it && !it.result && cardById(it.cardId)) || ui.checkNote; }
    if (s.ids) return s.ids.some(id => cardById(id));
    if (s.id === '@pick') return !!(p.pick && cardById(p.pick));
    if (!cardById(s.id)) return false;
    const pr = S.progress[s.id];
    if (s.t === 'learn') return !pr;                                          // 다른 곳(1분 루틴, 학습에 추가)에서 이미 배웠으면 건너뛴다
    if (s.t === 'review' && !s.again) return !(pr && pr.last === p.date && pr.seen !== p.date); // 오늘 이미 복습했으면 건너뛴다
    return true;
  }
  /* 1분 루틴: 과정을 섞어 복습 3개(없으면 새 항목 1개)만 해도 오늘의 기록이 이어진다 */
  function quickPlan() {
    const t = today();
    if (S.quick && S.quick.date === t) return S.quick;
    const ids = [];
    activeCourses().forEach(co => dueIds(co.id, t).filter(id => !(S.progress[id].last === t)).slice(0, 2).forEach(id => ids.push(id)));
    let steps = shuffle(ids).slice(0, 3).map(id => ({ t: 'review', id }));
    if (!steps.length) {
      const co = activeCourses().find(x => pickNew(x, 1, []).length);
      if (co) steps = [{ t: 'learn', id: pickNew(co, 1, [])[0] }];
    }
    steps.push({ t: 'done' });
    S.quick = { date: t, course: 'quick', type: 'quick', review: [], fresh: [], steps, pos: 0, done: false };
    save();
    return S.quick;
  }
  const sessionPlan = () => (ui.session === 'quick' ? quickPlan() : ui.session ? plan(ui.session) : null);
  const curStep = () => { const p = sessionPlan(); return p && p.steps ? p.steps[p.pos] : null; };
  const resolveId = (s, p) => (s && s.id === '@pick' ? p.pick : s && s.id);
  const defaultWho = () => WHO[S.settings.contexts[0]] || '';
  function resetStepUi() {
    ui.revealed = false; ui.reads = 0; ui.checkNote = false; ui.who = defaultWho(); ui.pick = null;
    ui.dlgLine = 0; ui.dlgRevealed = false; ui.dlgSwap = false;
  }
  const intentLabel = it => [it.who && `${it.who}에게`, it.when].filter(Boolean).join(' · ');
  const STEP_MIN = { check: 0.5, review: 0.4, learn: 1.2, rewrite: 1.5, compose: 1.5, ask: 1.5, weekwrite: 2, weekthink: 2, intent: 0.5, weekpick: 0.5, dialogue: 1.5, shadow: 1.5 };
  function remainingSteps(p) {
    const steps = p.steps || buildSteps(p);
    return steps.slice(p.steps ? p.pos : 0).filter(s => s.t !== 'done' && stepValid(s, p));
  }
  const minutes = steps => Math.max(1, Math.round(steps.reduce((a, s) => a + (STEP_MIN[s.t] || 0.5), 0)));
  function stepSummary(co, steps) {
    const n = t => steps.filter(s => s.t === t).length;
    const parts = [];
    if (n('check')) parts.push('어제 약속 확인');
    const rv = steps.filter(s => s.t === 'review' && !s.week).length, wk = steps.filter(s => s.week).length;
    if (rv) parts.push(`복습 ${rv}`);
    if (wk) parts.push(`이번 주 다시 보기 ${wk}`);
    if (n('learn')) parts.push(`새 ${co.unitWord} ${n('learn')}`);
    if (n('rewrite')) parts.push('바꿔 쓰기');
    if (n('weekpick')) parts.push('이번 주 문장 고르기');
    if (n('intent')) parts.push('실천 약속');
    if (n('compose')) parts.push('내 문장 만들기');
    if (n('weekwrite')) parts.push('주간 글쓰기');
    if (n('ask')) parts.push('오늘의 질문');
    if (n('weekthink')) parts.push('주간 사색');
    steps.filter(s => s.t === 'dialogue').forEach(s => parts.push(`대화 연습 ‘${co.groupById[s.unit].name}’`));
    if (n('shadow')) parts.push('이번 주 표현 따라 말하기');
    return parts;
  }

  /* ---------- 표시 ---------- */
  function marked(text, blank, mode, reveal) {
    text = text || '';
    const b = blank && text.includes(blank) ? blank : '';
    if (!b) {
      if (mode !== 'blank') return esc(text);
      const first = text.split(/\s+/)[0] || '';
      const len = Math.min(12, Math.max(4, [...text].length - [...first].length));
      return `${esc(first)} <span class="blank" style="--len:${len}" role="img" aria-label="빈칸"></span>`;
    }
    const i = text.indexOf(b);
    const pre = esc(text.slice(0, i)), post = esc(text.slice(i + b.length));
    if (mode === 'blank') return `${pre}<span class="blank" style="--len:${Math.max(2, [...b].length * (/^[\x00-\x7f]+$/.test(b) ? 0.55 : 1))}" role="img" aria-label="빈칸"></span>${post}`;
    return `${pre}<mark${reveal ? ' class="reveal"' : ''}>${esc(b)}</mark>${post}`;
  }
  const readingLine = c => (c.r && c.r !== c.t ? `<p class="reading" lang="ja">${esc(c.r)}</p>` : '');  // 가나만으로 된 표현은 읽기가 같아 생략
  const pronLine = c => (S.settings.pron && c.pron ? `<p class="pron">${esc(c.pron)}</p>` : '');
  const maskTerm = (text, term) => (term ? String(text).split(term).join('○○') : text);
  function cardBlock(c, wordLabel, withAsk) {
    const co = courseOf(c);
    if (co.kind === 'idea') {
      return `<div class="word-hero"><p class="term-big idea">${esc(c.term)}</p>${c.orig ? `<span class="pill">${esc(c.orig)}</span>` : ''}</div>
        <figure class="idea-line"><blockquote class="quote">${marked(c.line, c.blank, 'mark')}</blockquote>${c.who ? `<figcaption>${c.quote ? '— ' : '생각의 출처 · '}${esc(c.who)}</figcaption>` : ''}</figure>
        <div class="why"><span class="label">무슨 뜻일까</span><p>${esc(c.meaning)}</p></div>
        <div class="word"><span class="label">이렇게 써요</span><p>${esc(c.use)}</p></div>
        ${withAsk ? `<div class="ask"><span class="label">생각해 볼 질문</span><p>${esc(c.ask)}</p></div>` : ''}`;
    }
    if (co.kind === 'word') {
      return `<div class="word-hero"><p class="term-big">${esc(c.term)}</p><span class="pill">${esc(c.pos)}</span></div>
        <p class="meaning">${esc(c.meaning)}</p>
        <div class="better"><span class="label">이렇게 써요</span><blockquote class="quote small-q">${marked(c.example, c.blank, 'mark')}</blockquote></div>
        <div class="why"><span class="label">말맛</span><p>${esc(c.note)}</p></div>
        ${c.instead ? `<p class="hint">평소에 ‘${esc(c.instead)}’ 정도로 말하던 것을 이 한 낱말로.</p>` : ''}`;
    }
    if (co.kind === 'phrase') {
      return `<div><span class="label">뜻</span><p class="ko-mean">${esc(c.ko)}</p></div>
        <div class="better"><span class="label">${langName(co)}</span><p class="tl"${langAttr(co)}>${marked(c.t, c.blank, 'mark')}</p>${readingLine(c)}${pronLine(c)}</div>
        <div class="why"><span class="label">알아 두기</span><p>${esc(c.note)}</p></div>`;
    }
    return `${c.situation ? `<p class="situation">${esc(c.situation)}</p>` : ''}
      ${c.avoid ? `<div class="avoid"><span class="label">이렇게 말하는 대신</span><p>${esc(c.avoid)}</p></div>` : ''}
      <div class="better"><span class="label">${c.avoid ? '이렇게 말해 보세요' : '좋은 문장'}</span><blockquote class="quote">${marked(c.text, c.blank, 'mark')}</blockquote></div>
      ${c.why ? `<div class="why"><span class="label">${c.custom ? '메모' : '왜 마음이 움직일까'}</span><p>${esc(c.why)}</p></div>` : ''}
      ${c.word && c.word.term ? `<div class="word"><span class="label">${wordLabel}</span><p class="term">${esc(c.word.term)}</p><p>${esc(c.word.meaning)}</p>${c.word.example ? `<p class="ex">${esc(c.word.example)}</p>` : ''}</div>` : ''}`;
  }
  function itemPreview(c) {
    const co = courseOf(c);
    if (co.kind === 'word') return `<p class="term-mid">${esc(c.term)}</p><p class="muted">${esc(c.meaning)}</p>`;
    if (co.kind === 'idea') return `<p class="term-mid">${esc(c.term)}</p><p class="muted">${esc(c.line)}</p>`;
    if (co.kind === 'phrase') return `<p class="tl"${langAttr(co)}>${esc(c.t)}</p><p class="muted">${esc(c.ko)}</p>`;
    return `<blockquote class="quote">${marked(c.text, c.blank, 'mark')}</blockquote>`;
  }
  const itemText = c => { const k = courseOf(c).kind; return k === 'word' || k === 'idea' ? c.term : k === 'phrase' ? c.t : c.text; };
  const itemSub = c => { const k = courseOf(c).kind; return k === 'word' ? c.meaning : k === 'idea' ? c.line : k === 'phrase' ? c.ko : c.situation; };
  function speakCard(c, rate) {
    const co = courseOf(c);
    speak(co.kind === 'word' ? `${c.term}. ${c.example}` : co.kind === 'idea' ? `${c.term}. ${c.line}` : itemText(c), co.lang, rate);
  }
  function copyCard(c) {
    const co = courseOf(c);
    const text = co.kind === 'word' ? `${c.term}: ${c.meaning}\n예) ${c.example}` : co.kind === 'idea' ? `${c.term}\n“${c.line}”${c.who ? ` — ${c.who}` : ''}` : co.kind === 'phrase' ? [c.t, c.r, c.ko].filter(Boolean).join('\n') : `“${c.text}”`;
    copyText(text);
  }
  const speakBtn = c => (canSpeak ? `<button class="btn" data-act="speak" data-id="${esc(c.id)}">${icon('speaker')}듣기</button>` : '');
  const slowBtn = c => (canSpeak && courseOf(c).kind === 'phrase' ? `<button class="btn" data-act="speak-slow" data-id="${esc(c.id)}">${icon('slow')}천천히</button>` : '');
  const copyBtn = (c, label) => `<button class="btn" data-act="copy" data-id="${esc(c.id)}">${icon('copy')}${label || '복사'}</button>`;
  const head = (sub, title) => `<header class="top"><div><p class="date">${sub}</p><h1 class="greet">${title}</h1></div><button class="icon-btn" data-act="settings" aria-label="설정">${icon('sliders')}</button></header>`;
  const empty = (msg, extra) => `<div class="empty"><p>${msg}</p>${extra || ''}</div>`;
  const readCounter = label => `<button class="btn" data-act="read">${label} <span class="reads" aria-label="${ui.reads}번">${[0, 1, 2].map(i => `<i class="${i < ui.reads ? 'on' : ''}"></i>`).join('')}</span></button>`;
  function finishText(co) {
    const total = co.data.cards.length, left = total - learnedIn(co);
    if (left <= 0) return '모두 배웠어요. 이제 복습으로 오래 남겨요.';
    const perWeek = (S.settings.rhythm === 'daily' ? 7 : 5) * S.settings.load;
    return `이 속도면 ${monthLabel(addDays(today(), Math.ceil(left / perWeek * 7)))}에 완주해요.`;
  }
  const stageOf = (co, u) => Math.min(STAGE_NAMES.length - 1, Math.floor(co.groups.indexOf(u) / UNITS_PER_STAGE));

  /* ---------- 화면: 오늘 ---------- */
  function greeting(now) {
    const h = now.getHours();
    return h < 5 ? '고요한 새벽이에요' : h < 11 ? '좋은 아침이에요' : h < 17 ? '좋은 오후예요' : '좋은 저녁이에요';
  }
  function weekStrip(withCount, h) {
    h = h || history();
    const t = today(), days = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(t, -i), done = isDone(d), rest = !done && h.rests.has(d);
      days.push(`<li class="day${done ? ' done' : ''}${rest ? ' rest' : ''}${i === 0 ? ' now' : ''}"><span class="wd">${WEEKDAYS[parse(d).getDay()]}</span><span class="dot"${rest ? ' title="쉼표 · 연속 유지"' : ''}>${done ? icon('check') : rest ? '<b aria-hidden="true">,</b>' : ''}</span></li>`);
    }
    return `<section class="week" aria-label="최근 7일 기록"><ol>${days.join('')}</ol>${withCount ? `<p class="streak"><strong>${h.current}</strong>일 연속</p>` : ''}</section>`;
  }
  function courseProgress(co) {
    if (co.kind === 'phrase') {
      const done = co.groups.filter(u => S.dlg[u.id]).length, u = currentUnit(co);
      const st = u ? ` · ${stageOf(co, u) + 1}단계 ${STAGE_NAMES[stageOf(co, u)]}` : '';
      return { label: `장면 ${done} / ${co.groups.length} 완주${st}`, pct: done / Math.max(1, co.groups.length) };
    }
    const n = learnedIn(co), total = co.data.cards.length;
    return { label: `${co.unitWord} ${n} / ${total}`, pct: n / total };
  }
  function routineTitle(co, p, steps) {
    const first = cardById(p.fresh.find(id => !S.progress[id]) || p.fresh[0]);
    const dl = steps.find(s => s.t === 'dialogue');
    if (p.type === 'practice') {
      if (co.kind === 'sentence') return '실전의 날 · 이번 주 문장 하나를 실제로';
      if (co.kind === 'word') return '실전의 날 · 이번 주 낱말로 짧은 글';
      if (co.kind === 'idea') return '실전의 날 · 이번 주 질문으로 사색';
      return dl ? `실전의 날 · ‘${esc(co.groupById[dl.unit].name)}’ 대화` : '실전의 날 · 이번 주 표현 따라 말하기';
    }
    if (p.type === 'review') return '돌아보는 날 · 한 주 복습과 정리';
    if (co.kind === 'phrase') return first ? `‘${esc(groupName(first))}’ 장면` : dl ? '대화로 다시 말해 보는 날' : '오늘은 복습하는 날이에요';
    if (!first) return '오늘은 복습하는 날이에요';
    return co.kind === 'word' ? `오늘은 ‘${esc(groupName(first))}’의 낱말` : co.kind === 'idea' ? `오늘은 ‘${esc(groupName(first))}’의 개념` : `오늘은 ‘${esc(groupName(first))}’ 문장을 배워요`;
  }
  function routineCard(co) {
    const p = plan(co.id);
    const prog = courseProgress(co);
    const steps = remainingSteps(p);
    const top = `<div class="deck-head">${badge(co)}<div><p class="deck-name">${esc(co.name)}</p><p class="deck-sub">${esc(prog.label)}</p></div>${p.done ? '<span class="pill used">오늘 완료</span>' : `<span class="pill">약 ${minutes(steps)}분</span>`}</div>
      <div class="course-prog" aria-hidden="true"><span style="width:${Math.round(prog.pct * 100)}%"></span></div>`;
    if (p.done) {
      const id = p.fresh[p.fresh.length - 1] || p.review[0];
      const c = id && cardById(id);
      const it = co.kind === 'sentence' && S.intents.find(i => i.date === p.date);
      return `<article class="deck routine">${top}
        ${c ? `<div class="preview">${itemPreview(c)}</div>` : ''}
        ${it ? `<p class="intent-line">오늘의 약속 · ${esc(intentLabel(it))}</p>` : ''}
        <div class="row">${c ? `<button class="btn" data-act="open" data-id="${esc(c.id)}">자세히</button>${speakBtn(c)}` : ''}<button class="link" data-act="more" data-id="${co.id}">하나 더 배우기</button></div>
      </article>`;
    }
    const parts = stepSummary(co, steps);
    if (!parts.length) {
      return `<article class="deck routine">${top}<p class="muted">오늘은 복습할 것도, 새로 배울 것도 없어요.</p><div class="row"><button class="btn" data-act="start" data-id="${co.id}">오늘 기록 남기기</button><button class="link" data-act="more" data-id="${co.id}">하나 더 배우기</button></div></article>`;
    }
    const started = p.steps && p.pos > 0;
    return `<article class="deck routine">${top}
      <h2 class="deck-title">${routineTitle(co, p, steps)}</h2>
      <p class="todo-line">${parts.map(esc).join(' · ')}</p>
      <button class="btn ${started ? '' : 'primary '}wide" data-act="start" data-id="${co.id}">${started ? `이어서 하기 · ${p.pos} / ${p.steps.length - 1}` : '시작하기'}</button>
    </article>`;
  }
  function viewToday() {
    const now = new Date(), t = today();
    const act = activeCourses();
    const h = history();
    const type = dayType(t);
    const ids = Object.keys(S.progress).filter(id => cardById(id));
    const mastered = ids.filter(id => S.progress[id].box >= MASTERED_BOX).length;
    const talks = Object.values(S.dlg).reduce((a, d) => a + (d.n || 0), 0);
    const sentenceOn = act.some(co => co.id === 'sentence');
    const back = h.gap >= 3 && !isDone(t)
      ? `<div class="banner"><b>다시 오신 걸 환영해요.</b> ${h.gap}일 쉬었어요. 오늘은 복습을 조금만 준비했어요. 밀린 것은 며칠에 나눠서 천천히 보여 드릴게요.</div>` : '';
    const yesterdayRest = !isDone(t) && h.rests.has(addDays(t, -1));
    return `${head(`${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`, greeting(now))}
      <p class="day-line"><span class="day-chip ${type}">${DAY_LABEL[type]}</span>${S.settings.anchor ? `<span>${esc(S.settings.anchor)}, 5분</span>` : ''}</p>
      ${back}
      ${weekStrip(true, h)}
      ${yesterdayRest && !back ? '<p class="hint rest-note">어제는 쉼표로 남겨 뒀어요. 오늘 하면 연속이 그대로 이어져요.</p>' : ''}
      <section class="routines" aria-label="오늘의 루틴">${act.map(routineCard).join('')}</section>
      ${!isDone(t) ? `<button class="quick" data-act="quick">${icon('bolt')}<span><b>바쁜 날이라면 1분만</b><small>복습 3개만 해도 오늘의 기록이 이어져요</small></span>${icon('chev')}</button>` : ''}
      <p class="stats"><span>공부한 날<b>${h.total}</b></span><span>익힌 것<b>${mastered}</b></span>${act.some(co => co.kind === 'phrase') ? `<span>대화 연습<b>${talks}</b>번</span>` : ''}</p>
      ${sentenceOn ? `<section><h2 class="sec-title">지금 필요한 말 찾기</h2><div class="chips">${courseById.sentence.groups.map(g => `<button class="chip" data-act="find" data-id="${g.id}">${esc(g.name)}</button>`).join('')}</div></section>` : ''}`;
  }

  /* ---------- 화면: 모음 ---------- */
  const libCourse = () => courseById[ui.libCourse] || activeCourses()[0] || COURSES[0];
  function libItems(co) {
    const q = ui.q.trim().toLowerCase();
    return cardsOf(co).filter(c => {
      if (ui.libFilter === 'fav') { if (!S.favs[c.id]) return false; }
      else if (ui.libFilter === 'mine') { if (!c.custom) return false; }
      else if (ui.libFilter !== 'all' && c.g !== ui.libFilter) return false;
      if (ui.libCtx && co.kind === 'sentence' && !(c.ctx || []).includes(ui.libCtx)) return false;
      if (!q) return true;
      const fields = co.kind === 'word' ? [c.term, c.meaning, c.example, c.note, c.instead] : co.kind === 'idea' ? [c.term, c.orig, c.who, c.line, c.meaning, c.use, c.ask] : [c.text, c.situation, c.avoid, c.why, c.word && c.word.term, c.word && c.word.meaning];
      return fields.concat(groupName(c)).some(v => v && v.toLowerCase().includes(q));
    });
  }
  function itemRow(c) {
    const co = courseOf(c), st = status(c.id), fav = !!S.favs[c.id];
    return `<li><button class="item" data-act="open" data-id="${esc(c.id)}">
        <span class="item-meta"><span>${esc(groupName(c))}</span><span class="pill ${st}">${STATUS_LABEL[st]}</span>${c.custom ? '<span class="pill mine">내 문장</span>' : ''}</span>
        <span class="item-text${co.kind === 'word' || co.kind === 'idea' ? ' term-row' : ''}"${langAttr(co)}>${esc(itemText(c))}</span>
        ${itemSub(c) ? `<span class="item-sit">${esc(itemSub(c))}</span>` : ''}
      </button><button class="star${fav ? ' on' : ''}" data-act="fav" data-id="${esc(c.id)}" aria-pressed="${fav}" aria-label="즐겨찾기">${icon('star')}</button></li>`;
  }
  function libList() {
    const co = libCourse();
    const items = libItems(co);
    if (!items.length) {
      if (ui.libFilter === 'mine') return empty('아직 직접 추가한 문장이 없어요. 책, 경기, 대화에서 만난 좋은 문장을 모아 보세요.', '<button class="btn primary" data-act="add">내 문장 추가</button>');
      if (ui.libFilter === 'fav') return empty('즐겨찾기한 것이 없어요. 옆의 별을 눌러 자주 볼 것을 모아 두세요.');
      return empty('찾는 것이 없어요. 다른 말로 찾아보거나 분류를 바꿔 보세요.');
    }
    return `<p class="count">${items.length}개</p><ul class="list">${items.map(itemRow).join('')}</ul>`;
  }
  function filterChips(co) {
    const filters = [['all', '전체'], ['fav', '즐겨찾기']].concat(co.id === 'sentence' ? [['mine', '내 문장']] : []).concat(co.groups.map(g => [g.id, g.name]));
    return `<div class="chips scroll">${filters.map(([id, name]) => `<button class="chip" data-act="lib-filter" data-id="${id}" aria-pressed="${ui.libFilter === id}">${esc(name)}</button>`).join('')}</div>`;
  }
  function libSentence(co) {
    const sub = `<div class="seg" role="group" aria-label="보기"><button data-act="lib-sub" data-id="items" aria-pressed="${ui.libSub !== 'words'}">문장</button><button data-act="lib-sub" data-id="words" aria-pressed="${ui.libSub === 'words'}">문장 속 단어</button></div>`;
    if (ui.libSub === 'words') {
      const all = cardsOf(co).filter(c => c.word && c.word.term);
      const learned = all.filter(c => S.progress[c.id]);
      const list = ui.wordsMode === 'all' ? all : learned;
      return `${sub}
        <div class="seg" role="group" aria-label="단어 보기"><button data-act="words-mode" data-id="learned" aria-pressed="${ui.wordsMode === 'learned'}">배운 단어 ${learned.length}</button><button data-act="words-mode" data-id="all" aria-pressed="${ui.wordsMode === 'all'}">전체 ${all.length}</button></div>
        ${list.length
          ? `<ul class="words">${list.map(c => `<li><button class="word-item" data-act="open" data-id="${esc(c.id)}"><span class="term"><mark>${esc(c.word.term)}</mark></span><span class="meaning">${esc(c.word.meaning)}</span><span class="ex">${esc(c.word.example)}</span></button></li>`).join('')}</ul>`
          : empty('아직 배운 단어가 없어요. 루틴을 마치면 문장 속 좋은 단어가 여기에 쌓여요.', '<button class="btn" data-act="words-mode" data-id="all">전체 단어 미리 보기</button>')}`;
    }
    return `${sub}
      <div class="lib-tools">
        <label class="search">${icon('search')}<input id="lib-q" type="search" placeholder="상황이나 단어로 찾기 (예: 긴장, 실수)" value="${esc(ui.q)}" aria-label="찾기"></label>
        <select id="lib-ctx" aria-label="대상">${[['', '대상 전체']].concat(CONTEXTS.map(x => [x.id, x.name])).map(([v, n]) => `<option value="${v}"${ui.libCtx === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <button class="btn" data-act="add">${icon('plus')}내 문장</button>
      </div>
      ${filterChips(co)}
      <div id="lib-list" class="sheet-body">${libList()}</div>`;
  }
  function libWords(co) {
    const ph = co.kind === 'idea' ? '개념이나 사람으로 찾기 (예: 중용, 소크라테스)' : '낱말이나 뜻으로 찾기 (예: 물결, 조금씩)';
    return `<label class="search">${icon('search')}<input id="lib-q" type="search" placeholder="${ph}" value="${esc(ui.q)}" aria-label="찾기"></label>
      ${filterChips(co)}
      <div id="lib-list" class="sheet-body">${libList()}</div>`;
  }
  function libPhrases(co) {
    const sub = co.id === 'ja' && window.AM_KANA
      ? `<div class="seg" role="group" aria-label="보기"><button data-act="lib-sub" data-id="items" aria-pressed="${ui.libSub !== 'kana'}">회화</button><button data-act="lib-sub" data-id="kana" aria-pressed="${ui.libSub === 'kana'}">글자 (히라가나·가타카나)</button></div>`
      : '';
    if (ui.libSub === 'kana' && sub) return sub + kanaView();
    const cur = currentUnit(co);
    let html = '', stage = -1;
    co.groups.forEach((u, i) => {
      const st = stageOf(co, u);
      if (st !== stage) {
        if (stage >= 0) html += '</ol></section>';
        stage = st;
        const units = co.groups.slice(st * UNITS_PER_STAGE, (st + 1) * UNITS_PER_STAGE);
        const done = units.filter(x => S.dlg[x.id]).length;
        html += `<section class="stage"><h2 class="stage-name"><span>${st + 1}단계 · ${STAGE_NAMES[st]}</span><small>${st * UNITS_PER_STAGE + 1}~${st * UNITS_PER_STAGE + units.length}주 · 완주 ${done}/${units.length}</small></h2><ol class="units">`;
      }
      const cards = unitCards(co, u);
      const n = cards.filter(c => S.progress[c.id]).length;
      const open = n === cards.length && (u.dialogue || []).length;
      const d = S.dlg[u.id];
      const expanded = ui.openUnits[u.id] != null ? ui.openUnits[u.id] : (cur && u.id === cur.id);
      html += `<li class="unit${expanded ? ' open' : ''}${cur && u.id === cur.id ? ' current' : ''}">
        <button class="unit-head" data-act="unit-toggle" data-id="${esc(u.id)}" aria-expanded="${!!expanded}"><span class="unit-no${d ? ' done' : ''}">${d ? icon('check') : i + 1}</span><span class="unit-title"><b>${esc(u.name)}</b><small>${esc(u.desc)}</small></span><span class="unit-prog">${n}/${cards.length}</span>${icon('chev')}</button>
        ${expanded ? `<ul class="list">${cards.map(itemRow).join('')}</ul>
        <div class="row">${open
          ? `<button class="btn${d ? '' : ' primary'}" data-act="practice" data-id="${esc(u.id)}">${icon('chat')}대화 연습${d ? ` · ${d.n}번 완주` : ''}</button>`
          : `<button class="btn" disabled>${icon('chat')}대화 연습</button><span class="hint">표현 ${cards.length}개를 다 배우면 열려요</span>`}</div>` : ''}
      </li>`;
    });
    if (stage >= 0) html += '</ol></section>';
    return `${sub}<p class="hint">한 주에 한 장면. 표현 다섯 개를 배우고, 토요일 실전의 날에 그 장면의 대화를 직접 말해 봐요. ${esc(finishText(co))}</p>${html}`;
  }
  function kanaView() {
    const K = window.AM_KANA;
    const idx = ui.kanaSet === 'kata' ? 1 : 0;
    const name = idx ? '가타카나' : '히라가나';
    const grid = rows => `<div class="kana-grid">${rows.map(r => r.map(cell => (cell
      ? `<button class="kana" data-act="say-kana" data-id="${cell[idx]}"><span lang="ja">${cell[idx]}</span><small>${cell[2]}</small></button>`
      : '<span class="kana empty" aria-hidden="true"></span>')).join('')).join('')}</div>`;
    const best = S.kana[ui.kanaSet];
    return `<div class="seg" role="group" aria-label="글자"><button data-act="kana-set" data-id="hira" aria-pressed="${!idx}">히라가나</button><button data-act="kana-set" data-id="kata" aria-pressed="${!!idx}">가타카나</button></div>
      <p class="hint">${idx ? '가타카나는 커피(コーヒー) 같은 외래어에 써요.' : '히라가나는 일본어의 기본 글자예요.'} 글자를 누르면 소리가 나요.</p>
      <button class="btn primary wide" data-act="quiz">${name} 퀴즈 10문제${best != null ? ` · 최고 ${best}점` : ''}</button>
      <section><h2 class="sec-title">기본 글자</h2>${grid(K.basic)}</section>
      <section><h2 class="sec-title">탁음 · 반탁음</h2>${grid(K.voiced)}</section>`;
  }
  function viewLibrary() {
    const co = libCourse();
    const title = co.kind === 'sentence' ? '문장 모음' : co.kind === 'word' ? '우리말 모음' : co.kind === 'idea' ? '인문학 모음' : `${co.name} 표현`;
    const courseChips = `<div class="course-tabs" style="--n:${COURSES.length}" role="group" aria-label="과정">${COURSES.map(x => `<button class="course-tab" data-act="lib-course" data-id="${x.id}" aria-pressed="${x.id === co.id}">${badge(x)}<span>${esc(x.name)}</span></button>`).join('')}</div>`;
    const body = co.kind === 'sentence' ? libSentence(co) : co.kind === 'word' || co.kind === 'idea' ? libWords(co) : libPhrases(co);
    return `${head(esc(co.desc), title)}${courseChips}${body}`;
  }

  /* ---------- 화면: 기록 ---------- */
  function intentPill(i) {
    if (i.result === 'used') return '<span class="pill used">써봤어요</span>';
    if (i.result === 'notyet') return '<span class="pill">아직</span>';
    if (i.date === today()) return '<span class="pill today">오늘의 약속</span>';
    return '<span class="pill">확인 안 함</span>';
  }
  function yearCalendar(h) {
    const t = today(), end = addDays(h.start, 364), s0 = parse(h.start);
    const months = [];
    for (let i = 0; i < 12; i++) {
      const y = new Date(s0.getFullYear(), s0.getMonth() + i, 1).getFullYear(), mo = new Date(s0.getFullYear(), s0.getMonth() + i, 1).getMonth();
      const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
      const cells = [];
      let n = 0;
      for (let k = 0; k < first; k++) cells.push('<i class="mc pad"></i>');
      for (let d = 1; d <= days; d++) {
        const s = ymd(new Date(y, mo, d));
        const cls = s < h.start || s > end ? 'out' : isDone(s) ? 'done' : h.rests.has(s) ? 'rest' : s === t ? 'now' : s > t ? 'future' : 'miss';
        if (cls === 'done') n++;
        cells.push(`<i class="mc ${cls}"></i>`);
      }
      months.push(`<div class="month" role="img" aria-label="${y}년 ${mo + 1}월, 공부한 날 ${n}일"><p class="mname">${i === 0 || mo === 0 ? `<small>${y}</small>` : ''}${mo + 1}월</p><div class="mgrid">${cells.join('')}</div></div>`);
    }
    return `<div class="year-cal">${months.join('')}</div>
      <p class="legend"><span><i class="mc done"></i>공부한 날</span><span><i class="mc rest"></i>쉼표(연속 유지)</span><span><i class="mc miss"></i>빠진 날</span></p>`;
  }
  function roadmap(co) {
    const prog = courseProgress(co);
    if (co.kind !== 'phrase') {
      return `<div class="road-course">${badge(co)}<div><p class="deck-name">${esc(co.name)} <span class="muted">${esc(prog.label)}</span></p><div class="course-prog"><span style="width:${Math.round(prog.pct * 100)}%"></span></div><p class="hint">${esc(finishText(co))}</p></div></div>`;
    }
    const cur = currentUnit(co);
    const rows = STAGE_NAMES.map((name, si) => {
      const units = co.groups.slice(si * UNITS_PER_STAGE, (si + 1) * UNITS_PER_STAGE);
      if (!units.length) return '';
      return `<div class="road-row"><span class="road-name">${si + 1}단계 · ${name}</span><div class="road-cells">${units.map(u => {
        const learned = unitCards(co, u).every(c => S.progress[c.id]);
        const cls = S.dlg[u.id] ? 'done' : learned ? 'half' : cur && u.id === cur.id ? 'now' : '';
        return `<i class="rc ${cls}" title="${esc(u.name)}"></i>`;
      }).join('')}</div></div>`;
    }).join('');
    return `<div class="road-course">${badge(co)}<div><p class="deck-name">${esc(co.name)} <span class="muted">${esc(prog.label)}</span></p>${rows}<p class="hint">${cur ? `이번 장면 · ‘${esc(cur.name)}’. ` : ''}${esc(finishText(co))}</p></div></div>`;
  }
  function viewYear() {
    const h = history(), t = today();
    const dayN = Math.min(365, daysBetween(h.start, t) + 1);
    const marks = Object.keys(MILESTONES).map(Number);
    const next = marks.find(m => m > h.total);
    return `<div class="year-stats">
        <p><b>${h.total}</b><span>공부한 날</span></p>
        <p><b>${h.current}</b><span>지금 연속</span></p>
        <p><b>${h.best}</b><span>최장 연속</span></p>
        <p><b>${dayN}</b><span>1년 중 며칠째</span></p>
      </div>
      <p class="hint">${shortDate(h.start)}에 시작했어요. ${S.settings.rhythm === 'week' ? '월~금은 배우고, 토요일은 실전, 일요일은 돌아보는 리듬이에요.' : '매일 새로 배우는 리듬이에요.'} 7일에 하루는 쉬어도 연속이 이어져요.</p>
      ${yearCalendar(h)}
      <section class="group"><h3>이정표</h3><div class="miles">${marks.map(m => `<span class="mile${h.total >= m ? ' got' : ''}"${S.mile[m] ? ` title="${shortDate(S.mile[m])}"` : ''}>${m}일</span>`).join('')}</div>${next ? `<p class="hint">다음 이정표 ${next}일까지 ${next - h.total}일 남았어요.</p>` : '<p class="hint">1년의 이정표를 모두 넘었어요.</p>'}</section>
      <section class="group"><h3>과정별 1년 지도</h3>${activeCourses().map(roadmap).join('')}</section>`;
  }
  function viewNotes() {
    const rw = S.rewrites.slice().reverse(), its = S.intents.slice().reverse();
    let body;
    if (ui.notesMode === 'year') body = viewYear();
    else if (ui.notesMode === 'rewrites') {
      body = rw.length
        ? `<ul class="notes">${rw.map(r => {
          const c = cardById(r.cardId), co = c ? courseOf(c) : courseById[r.course || 'sentence'];
          return `<li><button class="note" data-act="open" data-id="${esc(r.cardId)}"><span class="note-date">${co ? `${esc(co.name)} · ` : ''}${r.kind === 'week' ? (co && co.kind === 'idea' ? '주간 사색 · ' : '주간 글쓰기 · ') : ''}${shortDate(r.date)}</span><span class="note-text">${esc(r.text)}</span>${c && r.kind !== 'week' ? `<span class="note-src">${co.kind === 'word' ? '낱말' : co.kind === 'idea' ? '개념' : '원문'} · ${esc(itemText(c))}</span>` : ''}</button></li>`;
        }).join('')}</ul>`
        : empty('아직 직접 쓴 문장이 없어요. 루틴의 ‘내 말로 바꾸기’, ‘내 문장 만들기’, 토요일 ‘주간 글쓰기’에서 쓴 글이 여기에 모여요.');
    } else {
      body = its.length
        ? `<ul class="notes">${its.map(i => { const c = cardById(i.cardId); return `<li><button class="note" data-act="open" data-id="${esc(i.cardId)}"><span class="note-date">${shortDate(i.date)}${intentLabel(i) ? ` · ${esc(intentLabel(i))}` : ''}</span>${c ? `<span class="note-text">${esc(c.text)}</span>` : ''}${i.note ? `<span class="note-src">${esc(i.note)}</span>` : ''}${intentPill(i)}</button></li>`; }).join('')}</ul>`
        : empty('아직 실천 기록이 없어요. 좋은 문장 루틴 끝에 오늘 누구에게 쓸지 정하면 여기에 남아요.');
    }
    return `${head('하루하루 쌓인', '기록')}
      <div class="seg" role="group" aria-label="보기"><button data-act="notes-mode" data-id="year" aria-pressed="${ui.notesMode === 'year'}">1년</button><button data-act="notes-mode" data-id="rewrites" aria-pressed="${ui.notesMode === 'rewrites'}">내가 쓴 글 ${rw.length}</button><button data-act="notes-mode" data-id="intents" aria-pressed="${ui.notesMode === 'intents'}">실천 ${its.length}</button></div>
      ${body}`;
  }

  /* ---------- 루틴 단계 ---------- */
  function checkStep(s) {
    const it = S.intents.find(i => i.id === s.id);
    const c = cardById(it.cardId);
    const title = daysBetween(it.date, today()) === 1 ? '어제의 약속' : '지난 약속';
    if (ui.checkNote) {
      return [`<p class="eyebrow">${title}</p><h2 class="step-title">잘했어요. 상대의 반응은 어땠나요?</h2><blockquote class="quote small">${esc(c.text)}</blockquote><label class="label" for="check-note">한 줄 기록 (선택)</label><textarea id="check-note" placeholder="예) 처음엔 말이 없더니, 훈련 끝나고 먼저 와서 고맙다고 했다."></textarea>`,
        '<button class="btn primary wide" data-act="check-save">다음</button>'];
    }
    return [`<p class="eyebrow">${title}</p><h2 class="step-title">${it.who ? `${esc(it.who)}에게 ` : ''}이 말을 써 보기로 했어요. 써 봤나요?</h2>${it.when ? `<p class="situation">${esc(it.when)}</p>` : ''}<blockquote class="quote">${marked(c.text, c.blank, 'mark')}</blockquote><p class="hint">실제로 입 밖에 낸 문장이 가장 오래 남아요.</p>`,
      '<div class="duo"><button class="btn" data-act="check" data-id="notyet">아직이요</button><button class="btn primary" data-act="check" data-id="used">써 봤어요</button></div>'];
  }
  function reviewStep(s, c, p) {
    const co = courseOf(c);
    const total = p.steps.filter(x => x.t === 'review').length;
    const idx = p.steps.slice(0, p.pos + 1).filter(x => x.t === 'review').length;
    const eyebrow = `<p class="eyebrow">${s.week ? '이번 주 다시 보기' : '복습'} ${idx} / ${total} · ${esc(groupName(c))}</p>`;
    let body;
    if (co.kind === 'word') {
      body = `${eyebrow}<p class="meaning big">${esc(c.meaning)}</p>
        <div class="better"><span class="label">이 뜻의 우리말은?</span><blockquote class="quote">${marked(c.example, c.blank, ui.revealed ? 'mark' : 'blank', ui.revealed)}</blockquote></div>
        ${ui.revealed ? `<div class="word-hero"><p class="term-big">${esc(c.term)}</p><span class="pill">${esc(c.pos)}</span></div><p class="hint">${esc(c.note)}</p>` : '<p class="hint">뜻과 문장을 보고, 빈칸의 낱말을 소리 내어 떠올려 본 뒤 확인하세요.</p>'}`;
    } else if (co.kind === 'idea') {
      body = `${eyebrow}<p class="meaning big">${esc(ui.revealed ? c.meaning : maskTerm(c.meaning, c.term))}</p>
        <div class="better"><span class="label">이 개념의 문장</span><blockquote class="quote">${marked(c.line, c.blank, ui.revealed ? 'mark' : 'blank', ui.revealed)}</blockquote></div>
        ${ui.revealed ? `<div class="word-hero"><p class="term-big idea">${esc(c.term)}</p>${c.orig ? `<span class="pill">${esc(c.orig)}</span>` : ''}</div>${c.who ? `<p class="hint">${esc(c.who)}</p>` : ''}` : '<p class="hint">풀이를 읽고 어떤 개념인지, 빈칸에 들어갈 말은 무엇인지 소리 내어 떠올려 본 뒤 확인하세요.</p>'}`;
    } else if (co.kind === 'phrase') {
      const pr = S.progress[c.id] || { box: 0 };
      const full = pr.box >= FULL_RECALL_BOX;
      const la = langAttr(co), ln = langName(co);
      body = `${eyebrow}<p class="ko-mean big">${esc(c.ko)}</p>
        ${ui.revealed
          ? `<div class="better"><span class="label">${ln}</span><p class="tl"${la}>${marked(c.t, c.blank, 'mark', true)}</p>${readingLine(c)}${pronLine(c)}</div><p class="hint">${esc(c.note)}</p>`
          : full
            ? `<p class="hint">이 말을 ${josa(ln, '으로', '로')} 소리 내어 통째로 말해 본 뒤 확인하세요.</p>`
            : `<div class="better"><span class="label">${ln}</span><p class="tl"${la}>${marked(c.t, c.blank, 'blank')}</p></div><p class="hint">빈칸을 채워 문장 전체를 소리 내어 말해 본 뒤 확인하세요.</p>`}`;
    } else {
      body = `${eyebrow}
        <p class="situation">${esc(c.situation || '언제 쓰려고 모아 둔 문장인지 떠올려 보세요.')}</p>
        ${c.avoid ? `<div class="avoid"><span class="label">이렇게 말하는 대신</span><p>${esc(c.avoid)}</p></div>` : ''}
        <div class="better"><span class="label">이렇게 말해 보세요</span><blockquote class="quote">${marked(c.text, c.blank, ui.revealed ? 'mark' : 'blank', ui.revealed)}</blockquote></div>
        ${ui.revealed
          ? (c.word && c.word.term ? `<p class="hint">핵심 단어 · <b>${esc(c.word.term)}</b> — ${esc(c.word.meaning)}</p>` : '')
          : '<p class="hint">빈칸에 들어갈 말을 먼저 소리 내어 말해 본 뒤 확인하세요.</p>'}`;
    }
    if (!ui.revealed) return [body, '<button class="btn primary wide" data-act="reveal">정답 확인</button>'];
    const listen = co.kind === 'phrase' && canSpeak ? `<div class="row">${speakBtn(c)}${slowBtn(c)}</div>` : '';
    if (s.again) return [body + listen, '<button class="btn primary wide" data-act="next">다음</button>'];
    const pr = S.progress[c.id] || { box: 0 };
    const when = g => { const n = INTERVALS[nextBox(pr, g)]; return n === 1 ? '내일' : n >= 30 ? `${Math.round(n / 30)}달 뒤` : `${n}일 뒤`; };
    return [body + listen, `<div class="grades" role="group" aria-label="얼마나 기억났나요?">
        <button class="grade again" data-act="grade" data-id="again">다시<small>오늘 한 번 더</small></button>
        <button class="grade" data-act="grade" data-id="hard">헷갈림<small>${when('hard')}</small></button>
        <button class="grade good" data-act="grade" data-id="good">기억남<small>${when('good')}</small></button>
      </div>`];
  }
  function learnStep(c, p) {
    const co = courseOf(c);
    const learns = p.steps.filter(x => x.t === 'learn');
    const idx = p.steps.slice(0, p.pos + 1).filter(x => x.t === 'learn').length;
    const count = learns.length > 1 ? ` ${idx}/${learns.length}` : '';
    if (co.kind === 'phrase') {
      const u = co.groupById[c.g], cards = u ? unitCards(co, u) : [];
      const k = cards.indexOf(c) + 1;
      return [`<p class="eyebrow">새 표현${count} · ${esc(groupName(c))}${k ? ` ${k}/${cards.length}` : ''}</p>${cardBlock(c)}
        <div class="row">${speakBtn(c)}${slowBtn(c)}${readCounter('따라 말하기')}</div>
        <p class="hint">${ui.reads >= 3 ? '세 번 따라 말했어요. 귀로 듣고 입으로 말한 표현이 대화에서 먼저 나와요.' : '듣기를 누르고, 들은 그대로 세 번 따라 말해 보세요.'}</p>`,
        '<button class="btn primary wide" data-act="learned">다음</button>'];
    }
    if (co.kind === 'idea') {
      return [`<p class="eyebrow">오늘의 인문학${count} · ${esc(groupName(c))}</p>${cardBlock(c)}
        <div class="row">${readCounter('소리 내어 읽기')}${speakBtn(c)}</div>
        <p class="hint">${ui.reads >= 3 ? '세 번 읽었어요. 다음은 이 개념을 내 삶에 비춰 보는 질문이에요.' : '핵심 문장을 소리 내어 세 번 읽어 보세요.'}</p>`,
        '<button class="btn primary wide" data-act="learned">다음</button>'];
    }
    if (co.kind === 'word') {
      return [`<p class="eyebrow">오늘의 낱말${count} · ${esc(groupName(c))}</p>${cardBlock(c)}
        <div class="row">${readCounter('소리 내어 읽기')}${speakBtn(c)}</div>
        <p class="hint">${ui.reads >= 3 ? '세 번 읽었어요. 입에 익은 낱말이 글에서도 자연스럽게 나와요.' : '낱말과 예문을 소리 내어 세 번 읽어 보세요.'}</p>`,
        '<button class="btn primary wide" data-act="learned">다음</button>'];
    }
    return [`<p class="eyebrow">오늘의 문장 · ${esc(groupName(c))}</p>${cardBlock(c, '오늘의 단어')}
      <div class="row">${readCounter('소리 내어 읽기')}${speakBtn(c)}</div>
      <p class="hint">${ui.reads >= 3 ? '세 번 읽었어요. 입으로 말한 문장이 눈으로만 본 문장보다 오래 남아요.' : '실제로 그 사람 앞에서 말하듯, 천천히 세 번 읽어 보세요.'}</p>`,
      '<button class="btn primary wide" data-act="learned">다음</button>'];
  }
  const writeActions = '<div class="duo"><button class="btn" data-act="next">건너뛰기</button><button class="btn primary" data-act="rewrite-save">저장하고 다음</button></div>';
  function rewriteStep(c) {
    const who = defaultWho();
    return [`<p class="eyebrow">내 말로 바꾸기</p><h2 class="step-title">${who && who !== '나 자신' ? `내 ${esc(who)}에게` : '내가 실제로 말할 사람에게'} 맞게 바꿔 써 보세요.</h2><blockquote class="quote small">${esc(c.text)}</blockquote><label class="label" for="rewrite">내 문장</label><textarea id="rewrite" placeholder="이름, 상황, 내 말투를 넣어 보세요."></textarea><p class="hint">내 상황으로 다시 만든 문장은 그대로 외운 문장보다 훨씬 쉽게 떠올라요.</p>`, writeActions];
  }
  function composeStep(c) {
    return [`<p class="eyebrow">내 문장 만들기</p><h2 class="step-title">‘${esc(c.term)}’${hasBatchim(c.term) ? '을' : '를'} 넣어 내 문장을 하나 만들어 보세요.</h2><p class="meaning">${esc(c.meaning)}</p><label class="label" for="rewrite">내 문장</label><textarea id="rewrite" placeholder="예) ${esc(c.example)}"></textarea><p class="hint">오늘 본 것, 내 사람, 내 하루를 넣어 보세요. 직접 써 본 낱말이 가장 오래 남아요.</p>`, writeActions];
  }
  function askStep(c) {
    return [`<p class="eyebrow">오늘의 질문 · ${esc(c.term)}</p><h2 class="step-title">${esc(c.ask)}</h2><blockquote class="quote small">${esc(c.line)}</blockquote><label class="label" for="rewrite">내 생각</label><textarea id="rewrite" placeholder="정답은 없어요. 떠오르는 대로 두세 줄 적어 보세요."></textarea><p class="hint">개념을 내 삶에 비춰 본 생각이 가장 오래 남아요.</p>`, writeActions];
  }
  function weekthinkStep(s) {
    const cards = s.ids.map(cardById).filter(Boolean);
    return [`<p class="eyebrow">실전의 날 · 주간 사색</p><h2 class="step-title">이번 주 질문 가운데 하나를 골라 조금 길게 생각을 적어 보세요.</h2>
      <ul class="ask-list">${cards.map(c => `<li><b>${esc(c.term)}</b><span>${esc(c.ask)}</span></li>`).join('')}</ul>
      <label class="label" for="rewrite">내 사색</label><textarea id="rewrite" placeholder="고른 질문을 첫 줄에 적고, 요즘 내 삶과 이어서 생각해 보세요."></textarea>
      <p class="hint">한 주의 개념을 이어서 생각하면, 따로 외운 지식이 내 관점이 돼요.</p>`, writeActions];
  }
  function weekwriteStep(s) {
    const cards = s.ids.map(cardById).filter(Boolean);
    return [`<p class="eyebrow">실전의 날 · 주간 글쓰기</p><h2 class="step-title">이번 주 낱말을 두 개 이상 넣어 짧은 글을 써 보세요.</h2>
      <ul class="word-chips">${cards.map(c => `<li><b>${esc(c.term)}</b><small>${esc(c.meaning)}</small></li>`).join('')}</ul>
      <label class="label" for="rewrite">내 글</label><textarea id="rewrite" placeholder="오늘 아침 풍경, 어제 있었던 일, 고마운 사람 이야기, 무엇이든 좋아요."></textarea>
      <p class="hint">한 주 동안 배운 낱말을 내 글에 엮으면, 따로 외울 때보다 훨씬 오래 내 말로 남아요.</p>`, writeActions];
  }
  function weekpickStep(s) {
    const cards = s.ids.map(cardById).filter(Boolean);
    const sel = ui.pick || (cards[0] && cards[0].id);
    return [`<p class="eyebrow">실전의 날</p><h2 class="step-title">이번 주 배운 문장 중 하나를 골라, 오늘 실제로 써 봐요.</h2>
      <div class="pick-list" role="radiogroup" aria-label="이번 주 문장">${cards.map(c => `<button class="pick" role="radio" data-act="pick" data-id="${esc(c.id)}" aria-checked="${c.id === sel}" aria-pressed="${c.id === sel}"><span class="pick-body"><b class="pick-text">${esc(c.text)}</b><small>${esc(c.situation)}</small></span><span class="tick">${icon('check')}</span></button>`).join('')}</div>`,
      '<div class="duo"><button class="btn" data-act="next">오늘은 건너뛰기</button><button class="btn primary" data-act="pick-go">이 문장으로</button></div>'];
  }
  function shadowStep(s, co) {
    const cards = s.ids.map(cardById).filter(Boolean);
    return [`<p class="eyebrow">실전의 날 · 따라 말하기</p><h2 class="step-title">이번 주 표현을 듣고 그대로 따라 말해 보세요.</h2>
      <ul class="shadow-list">${cards.map(c => `<li><div><p class="tl"${langAttr(co)}>${esc(c.t)}</p>${pronLine(c)}<p class="ko">${esc(c.ko)}</p></div>${canSpeak ? `<button class="say" data-act="speak" data-id="${esc(c.id)}" aria-label="듣기">${icon('speaker')}</button>` : ''}</li>`).join('')}</ul>
      <div class="row">${canSpeak ? `<button class="btn" data-act="speak-all">${icon('speaker')}모두 이어 듣기</button>` : ''}${readCounter('전부 따라 말하기')}</div>
      <p class="hint">장면을 다 배우면 다음 실전의 날에 그 장면의 대화를 직접 말해 봐요.</p>`,
      '<button class="btn primary wide" data-act="next">다음</button>'];
  }
  function intentStep(c) {
    return [`<p class="eyebrow">오늘의 실천</p><h2 class="step-title">오늘 누구에게 이 말을 써 볼까요?</h2><blockquote class="quote small">${esc(c.text)}</blockquote>
      <div class="chips" role="group" aria-label="대상">${CONTEXTS.map(x => WHO[x.id]).filter(Boolean).map(w => `<button class="chip" data-act="who" data-id="${esc(w)}" aria-pressed="${ui.who === w}">${esc(w)}</button>`).join('')}</div>
      <label class="label" for="intent-when">언제, 어디서? (선택)</label><input id="intent-when" type="text" placeholder="예) 저녁 훈련 끝나고 민준이에게">
      <p class="form-error" id="intent-err" hidden></p>
      <p class="hint">언제, 누구에게 쓸지 정해 두면 실제로 쓸 가능성이 높아져요. 내일 아침에 어땠는지 물어볼게요.</p>`,
      '<div class="duo"><button class="btn" data-act="next">오늘은 건너뛰기</button><button class="btn primary" data-act="intent-save">약속하기</button></div>'];
  }
  function dialogueView(co, u) {
    const me = ui.dlgSwap ? 'A' : 'B';
    const lines = u.dialogue || [];
    const at = Math.min(ui.dlgLine, lines.length - 1);
    const myTurn = lines[at].who === me && !ui.dlgRevealed;
    const last = at >= lines.length - 1 && !myTurn;
    const la = langAttr(co), ln = langName(co);
    const bubble = (l, i) => {
      const mine = l.who === me;
      if (i === at && myTurn) return `<li class="bubble me ask"><span class="who">나</span><p class="ko-mean">${esc(l.ko)}</p><p class="hint">${josa(ln, '으로', '로')} 소리 내어 말해 보세요.</p></li>`;
      return `<li class="bubble ${mine ? 'me' : 'them'}"><span class="who">${mine ? '나' : '상대'}</span>
        <p class="tl"${la}>${esc(l.t)}</p>${readingLine(l)}${pronLine(l)}<p class="ko">${esc(l.ko)}</p>
        ${canSpeak ? `<button class="say" data-act="say-line" data-id="${esc(co.id)}|${esc(u.id)}|${i}" aria-label="이 줄 듣기">${icon('speaker')}</button>` : ''}</li>`;
    };
    const body = `<p class="eyebrow">대화 연습 · ${esc(u.name)}</p>
      <h2 class="step-title">${ui.dlgSwap ? '역할을 바꿨어요. 이번엔 상대 쪽 말을 해 보세요.' : '배운 표현으로 실제 대화를 해 봐요.'}</h2>
      <p class="hint">상대의 말은 듣고, 내 차례에는 한국어 뜻을 보고 ${josa(ln, '으로', '로')} 먼저 말해 본 뒤 확인하세요.</p>
      <ol class="chat">${lines.slice(0, at + 1).map(bubble).join('')}</ol>`;
    const actions = myTurn
      ? '<button class="btn primary wide" data-act="dlg-reveal">말해 봤어요 · 확인</button>'
      : !last
        ? '<button class="btn primary wide" data-act="dlg-next">다음 줄</button>'
        : '<div class="duo"><button class="btn" data-act="dlg-swap">역할 바꿔 한 번 더</button><button class="btn primary" data-act="dlg-done">대화 완료</button></div>';
    return [body, actions];
  }
  function nextUp(co) {
    if (co.kind === 'phrase') { const u = currentUnit(co); return u ? `‘${u.name}’ 장면` : ''; }
    const names = [...new Set(pickNew(co, 5 * S.settings.load, []).map(id => groupName(cardById(id))))];
    return names.slice(0, 4).map(n => `‘${n}’`).join(', ');
  }
  function weekRecap(co, p) {
    const ids = weekItems(co.id, p.date);
    const talks = co.kind === 'phrase' ? co.groups.filter(u => S.dlg[u.id] && daysBetween(S.dlg[u.id].last, p.date) <= 6).length : 0;
    const nx = nextUp(co);
    return `<section class="recap"><h3>이번 주 ${esc(co.name)}</h3>
      <p>새로 배운 ${esc(co.unitWord)} <b>${ids.length}</b>개${co.kind === 'phrase' ? ` · 대화 연습 <b>${talks}</b>장면` : ''}</p>
      ${ids.length ? `<ul>${ids.slice(-5).map(id => `<li${langAttr(co)}>${esc(itemText(cardById(id)))}</li>`).join('')}</ul>` : ''}
      <p class="hint">${nx ? `다음 주에 배울 것 · ${esc(nx)}` : '이 과정을 모두 배웠어요. 복습으로 오래 남겨요.'}</p></section>`;
  }
  function milestoneBlock(p) {
    if (!p.mile || !MILESTONES[p.mile]) return '';
    return `<div class="milestone"><p class="ms-num"><b>${p.mile}</b>일</p><p>${esc(MILESTONES[p.mile])}</p></div>`;
  }
  function doneStep(p) {
    const h = history();
    if (p.course === 'quick') {
      return [`<div class="done-wrap"><p class="eyebrow">1분 루틴 완료 ${icon('check')}</p><p class="big-streak"><strong>${h.current}</strong>일 연속</p>${weekStrip(false, h)}${milestoneBlock(p)}<p class="hint">바쁜 날에도 이어 갔어요. 여유가 생기면 과정별 루틴도 이어서 해 보세요.</p></div>`,
        '<button class="btn primary wide" data-act="close-session">홈으로</button>'];
    }
    const co = courseById[p.course];
    const id = p.fresh[p.fresh.length - 1] || p.review[0];
    const c = id && cardById(id);
    const next = activeCourses().find(x => x.id !== co.id && !plan(x.id).done);
    const it = co.kind === 'sentence' && S.intents.find(i => i.date === p.date);
    let note;
    if (p.type === 'review') note = '한 주를 잘 마무리했어요. 내일부터 새 한 주가 시작돼요.';
    else if (co.kind === 'sentence') note = it ? `오늘의 약속 · ${esc(intentLabel(it))}. 내일 아침에 어땠는지 물어볼게요.` : '내일 아침, 오늘 배운 문장이 빈칸이 되어 돌아와요.';
    else if (co.kind === 'word') note = p.type === 'practice' ? '이번 주 낱말이 내 글 속에 들어왔어요.' : '내일 아침, 오늘 배운 낱말이 빈칸이 되어 돌아와요.';
    else if (co.kind === 'idea') note = p.type === 'practice' ? '이번 주 개념이 내 생각 속으로 들어왔어요.' : '내일 아침, 오늘의 개념이 빈칸이 되어 돌아와요.';
    else {
      const u = c && co.groupById[c.g];
      const left = u ? unitCards(co, u).filter(x => !S.progress[x.id]).length : 0;
      note = (p.dialogues || []).length ? '대화까지 직접 말해 봤어요. 이 장면은 며칠 뒤 다시 대화로 복습해요.'
        : left && u ? `‘${esc(u.name)}’ 장면의 표현 ${left}개를 더 배우면 대화 연습이 열려요.` : '내일 아침, 오늘 배운 표현이 빈칸이 되어 돌아와요.';
    }
    return [`<div class="done-wrap"><p class="eyebrow">${esc(co.name)} 완료 ${icon('check')}</p><p class="big-streak"><strong>${h.current}</strong>일 연속</p>${weekStrip(false, h)}
        ${milestoneBlock(p)}
        ${p.type === 'review' ? weekRecap(co, p) : c ? `<article class="deck">${HOLE}<p class="eyebrow">오늘 배운 ${esc(co.unitWord)}</p>${itemPreview(c)}</article>` : ''}
        <p class="hint">${note}</p></div>`,
      next
        ? `<div class="duo"><button class="btn" data-act="close-session">홈으로</button><button class="btn primary" data-act="start" data-id="${next.id}">다음: ${esc(next.name)}</button></div><button class="link" data-act="more" data-id="${co.id}">${esc(co.name)} 하나 더 배우기</button>`
        : `<div class="duo">${c ? copyBtn(c) : '<span></span>'}<button class="btn primary" data-act="close-session">홈으로</button></div><button class="link" data-act="more" data-id="${co.id}">하나 더 배우기</button>`];
  }
  function stepView(s, p) {
    const co = courseById[p.course];
    switch (s.t) {
      case 'check': return checkStep(s);
      case 'review': return reviewStep(s, cardById(s.id), p);
      case 'learn': return learnStep(cardById(s.id), p);
      case 'rewrite': return rewriteStep(cardById(s.id));
      case 'compose': return composeStep(cardById(s.id));
      case 'ask': return askStep(cardById(s.id));
      case 'weekthink': return weekthinkStep(s);
      case 'intent': return intentStep(cardById(resolveId(s, p)));
      case 'weekpick': return weekpickStep(s);
      case 'weekwrite': return weekwriteStep(s);
      case 'shadow': return shadowStep(s, co);
      case 'dialogue': return dialogueView(co, co.groupById[s.unit]);
      default: return doneStep(p);
    }
  }

  /* ---------- 시작 안내 ---------- */
  const onbSteps = () => ['welcome', 'courses'].concat(S.settings.courses.includes('sentence') && courseById.sentence ? ['contexts'] : []).concat(['amount', 'promise']);
  function yearTotals() {
    return activeCourses().map(co => co.kind === 'phrase' ? `${co.name} ${co.groups.length}장면` : `${co.name} ${co.data.cards.length}${co.unitWord}`).join(' · ');
  }
  function onboarding() {
    const steps = onbSteps();
    const step = steps[Math.min(ui.onb, steps.length - 1)];
    const n = steps.length - 1, k = steps.indexOf(step);
    const dots = `<div class="onb-dots" aria-hidden="true">${steps.map((_, i) => `<i class="${i <= k ? 'on' : ''}"></i>`).join('')}</div>`;
    const back = '<button class="btn" data-act="onb-back">이전</button>';
    let body, actions;
    if (step === 'welcome') {
      body = `<p class="eyebrow">애니띵 모닝</p>
        <h1 class="onb-title">아침 5분,<br>1년이면 달라져요.</h1>
        <p class="lead">사람을 움직이는 문장, 잊혀 가는 아름다운 우리말, 일본어와 영어 회화. 하루 하나씩 1년을 쌓으면 말이 풍성해지고, 간단한 대화가 열려요.</p>
        <ul class="course-list">${COURSES.map(co => `<li>${badge(co)}<div><b>${esc(co.name)}</b><span>${esc(co.desc)}</span></div></li>`).join('')}</ul>
        <ol class="method">
          <li><span><b>월~금 배우기</b>과정마다 하루 하나. 보고 듣고, 소리 내어 말해요.</span></li>
          <li><span><b>토요일 실전</b>이번 주 것을 대화, 글, 실천으로 직접 써 봐요.</span></li>
          <li><span><b>일요일 돌아보기</b>간격 복습으로 한 주를 정리해요.</span></li>
          <li><span><b>쉬어도 괜찮아요</b>7일에 하루는 빠져도 연속이 이어지고, 바쁜 날엔 1분이면 돼요.</span></li>
        </ol>`;
      actions = '<button class="btn primary wide" data-act="onb-next">시작하기</button>';
    } else if (step === 'courses') {
      body = `<p class="eyebrow">${k} / ${n}</p><h2 class="step-title">무엇을 공부할까요?</h2><p class="hint">여러 개 골라도 돼요. 고른 과정마다 오늘의 루틴이 생겨요. 나중에 설정에서 바꿀 수 있어요.</p>
        <div class="pick-list" role="group" aria-label="과정">${COURSES.map(co => `<button class="pick" data-act="onb-course" data-id="${co.id}" aria-pressed="${S.settings.courses.includes(co.id)}">${badge(co)}<span class="pick-body"><b>${esc(co.name)}</b><small>${esc(co.desc)}</small></span><span class="tick">${icon('check')}</span></button>`).join('')}</div>
        <p class="form-error" id="onb-err" hidden></p>`;
      actions = `<div class="duo">${back}<button class="btn primary" data-act="onb-next">다음</button></div>`;
    } else if (step === 'contexts') {
      body = `<p class="eyebrow">${k} / ${n}</p><h2 class="step-title">좋은 문장은 주로 누구에게 쓰나요?</h2><p class="hint">여러 개 골라도 돼요. 고른 대상에 맞는 문장부터 배워요.</p>
        <div class="chips big" role="group" aria-label="대상">${CONTEXTS.map(x => `<button class="chip" data-act="onb-ctx" data-id="${x.id}" aria-pressed="${S.settings.contexts.includes(x.id)}">${esc(x.name)}</button>`).join('')}</div>`;
      actions = `<div class="duo">${back}<button class="btn primary" data-act="onb-next">다음</button></div>`;
    } else if (step === 'amount') {
      body = `<p class="eyebrow">${k} / ${n}</p><h2 class="step-title">하루에 얼마나 배울까요?</h2>
        <div class="seg" role="group" aria-label="하루 분량">${LOAD_NAMES.map((nm, i) => `<button data-act="onb-load" data-id="${i + 1}" aria-pressed="${S.settings.load === i + 1}">${nm}</button>`).join('')}</div>
        <p class="hint">${LOAD_NAMES[S.settings.load - 1]} · 과정마다 하루 ${S.settings.load}개씩, ${LOAD_SPAN[S.settings.load - 1]}이면 완주해요.${S.settings.load === 1 ? ' 1년 동안 꾸준히 하기에 가장 좋은 양이에요.' : ''}</p>
        <div class="recap"><h3>1년 과정</h3><p>${esc(yearTotals())}</p><p class="hint">일본어·영어는 한 주에 한 장면씩, 첫걸음 → 일상 → 여행과 관계 → 내 이야기 4단계로 올라가요.</p></div>`;
      actions = `<div class="duo">${back}<button class="btn primary" data-act="onb-next">다음</button></div>`;
    } else {
      body = `<p class="eyebrow">${k} / ${n}</p><h2 class="step-title">1년 약속을 정해요.</h2>
        <p class="hint">매일 이미 하는 일 바로 뒤에 붙이면 잊지 않고 이어 가기 쉬워요.</p>
        <div class="chips" role="group" aria-label="언제">${ANCHORS.map(a => `<button class="chip" data-act="onb-anchor" data-id="${esc(a)}" aria-pressed="${S.settings.anchor === a}">${esc(a)}</button>`).join('')}</div>
        <label class="label" for="onb-anchor">직접 쓰기 (선택)</label><input id="onb-anchor" type="text" maxlength="40" value="${ANCHORS.includes(S.settings.anchor) ? '' : esc(S.settings.anchor)}" placeholder="예) 아이를 등원시키고 나서">
        <label class="label" for="onb-time">알림 시간</label><input id="onb-time" type="time" value="${esc(S.settings.time)}">
        <div class="seg" role="group" aria-label="주간 리듬"><button data-act="onb-rhythm" data-id="week" aria-pressed="${S.settings.rhythm === 'week'}">주 5일 배우기</button><button data-act="onb-rhythm" data-id="daily" aria-pressed="${S.settings.rhythm === 'daily'}">매일 배우기</button></div>
        <p class="hint">${S.settings.rhythm === 'week' ? '월~금은 배우고, 토요일은 실전, 일요일은 돌아봐요. 1년을 버티기 좋은 리듬이에요.' : '주말에도 새로 배워요. 더 빨리 끝나지만 복습이 많아져요.'}</p>`;
      actions = `<div class="duo">${back}<button class="btn primary" data-act="onb-start">1년 시작하기</button></div>`;
    }
    return `<div class="session-inner"><div class="session-top">${dots}</div><div class="session-body">${body}</div><div class="session-actions">${actions}</div></div>`;
  }

  /* ---------- 시트 ---------- */
  function cardSheet(c) {
    const co = courseOf(c), st = status(c.id), pr = S.progress[c.id], fav = !!S.favs[c.id];
    const rws = S.rewrites.filter(r => r.cardId === c.id && r.kind !== 'week');
    const usedN = S.intents.filter(i => i.cardId === c.id && i.result === 'used').length;
    const meta = [`<span class="pill ${st}">${STATUS_LABEL[st]}</span>`];
    if (pr) meta.push(`<span>다음 복습 ${pr.due <= today() ? '오늘' : shortDate(pr.due)}</span>`);
    if (usedN) meta.push(`<span>실전 ${usedN}회</span>`);
    const del = !c.custom ? '' : ui.confirm === 'delete:' + c.id
      ? `<div class="confirm"><p>이 문장과 복습 기록을 지울까요? 되돌릴 수 없어요.</p><div class="row"><button class="btn" data-act="cancel-confirm">취소</button><button class="btn danger solid" data-act="delete" data-id="${esc(c.id)}">지우기</button></div></div>`
      : `<button class="btn danger" data-act="ask-delete" data-id="${esc(c.id)}">이 문장 지우기</button>`;
    return `<div class="sheet-body">
      <p class="item-meta">${meta.join('')}</p>
      ${cardBlock(c, '핵심 단어', true)}
      <div class="row">${speakBtn(c)}${slowBtn(c)}${copyBtn(c)}<button class="btn" data-act="fav" data-id="${esc(c.id)}" aria-pressed="${fav}">${icon('star')}${fav ? '즐겨찾기 해제' : '즐겨찾기'}</button>${pr ? '' : `<button class="btn primary" data-act="enroll" data-id="${esc(c.id)}">학습에 추가</button>`}</div>
      ${rws.length ? `<section class="group"><h3>내가 쓴 문장</h3>${rws.map(r => `<p class="mine-line">${esc(r.text)} <span class="note-date">${shortDate(r.date)}</span></p>`).join('')}</section>` : ''}
      <div><label class="label" for="card-note">메모</label><textarea id="card-note" data-id="${esc(c.id)}" placeholder="${co.kind === 'sentence' ? '이 문장을 언제, 누구에게 쓰고 싶은지 적어 두세요.' : '헷갈리는 점이나 떠오르는 장면을 적어 두세요.'}">${esc(S.notes[c.id] || '')}</textarea></div>
      ${del}
    </div>`;
  }
  function settingsSheet() {
    const s = S.settings;
    const imp = ui.confirm === 'import' && ui.pendingImport
      ? `<div class="confirm"><p>백업으로 바꿀까요? 배운 것 ${Object.keys(ui.pendingImport.progress).length}개, 노트와 연속 기록이 들어 있어요. 지금 이 기기의 기록은 사라져요.</p><div class="row"><button class="btn" data-act="cancel-confirm">취소</button><button class="btn danger solid" data-act="apply-import">백업으로 바꾸기</button></div></div>`
      : '';
    const reset = ui.confirm === 'reset'
      ? '<div class="confirm"><p>배운 것, 노트, 연속 기록이 모두 지워져요. 되돌릴 수 없어요.</p><div class="row"><button class="btn" data-act="cancel-confirm">취소</button><button class="btn danger solid" data-act="reset">모두 지우기</button></div></div>'
      : '<button class="btn danger" data-act="ask-reset">모든 기록 지우기</button>';
    return `<div class="sheet-body">
      <section class="group"><h3>공부할 과정</h3><div class="chips">${COURSES.map(co => `<button class="chip course-chip" data-act="course-toggle" data-id="${co.id}" aria-pressed="${s.courses.includes(co.id)}">${badge(co)}${esc(co.name)}</button>`).join('')}</div><p class="hint">고른 과정마다 오늘의 루틴이 생겨요.</p></section>
      <section class="group"><h3>하루 분량</h3><div class="seg" role="group" aria-label="하루 분량">${LOAD_NAMES.map((nm, i) => `<button data-act="load" data-id="${i + 1}" aria-pressed="${s.load === i + 1}">${nm}</button>`).join('')}</div><p class="hint">과정마다 하루 ${s.load}개씩 · ${LOAD_SPAN[s.load - 1]}이면 완주해요.</p></section>
      <section class="group"><h3>주간 리듬</h3><div class="seg" role="group" aria-label="주간 리듬"><button data-act="rhythm" data-id="week" aria-pressed="${s.rhythm === 'week'}">주 5일 배우기</button><button data-act="rhythm" data-id="daily" aria-pressed="${s.rhythm === 'daily'}">매일 배우기</button></div><p class="hint">${s.rhythm === 'week' ? '월~금 배우는 날 · 토 실전의 날 · 일 돌아보는 날' : '주말에도 새로 배워요. 실전과 돌아보기는 따로 없어요.'}</p></section>
      <section class="group"><h3>1년 약속</h3><label class="label" for="set-anchor">언제 할까요?</label><input id="set-anchor" type="text" maxlength="40" value="${esc(s.anchor)}" placeholder="예) 아침 커피를 내린 뒤"><p class="hint">${s.start ? `${shortDate(s.start)}에 시작했어요.` : ''} 매일 이미 하는 일 바로 뒤에 붙이면 이어 가기 쉬워요.</p></section>
      ${s.courses.includes('sentence') && CONTEXTS.length ? `<section class="group"><h3>좋은 문장은 주로 누구에게?</h3><p class="hint">고른 대상에 맞는 문장이 먼저 나와요.</p><div class="chips">${CONTEXTS.map(x => `<button class="chip" data-act="ctx" data-id="${x.id}" aria-pressed="${s.contexts.includes(x.id)}">${esc(x.name)}</button>`).join('')}</div></section>` : ''}
      ${COURSES.some(co => co.kind === 'phrase') ? `<section class="group"><h3>한글 발음</h3><div class="seg" role="group" aria-label="한글 발음"><button data-act="pron" data-id="on" aria-pressed="${!!s.pron}">보이기</button><button data-act="pron" data-id="off" aria-pressed="${!s.pron}">숨기기</button></div><p class="hint">일본어·영어 표현 아래에 한글로 적은 발음을 보여 줘요. 익숙해지면 숨기고 귀로만 들어 보세요.</p></section>` : ''}
      <section class="group"><h3>아침 알림</h3><div class="row"><label class="label" for="set-time">알림 시간</label><input id="set-time" type="time" value="${esc(s.time)}"><button class="btn" data-act="ics">캘린더에 매일 알림 추가</button></div><p class="hint">캘린더 파일을 받아 열면 매일 이 시간에 알림이 와요.</p></section>
      <section class="group"><h3>화면</h3><div class="seg" role="group" aria-label="화면">${[['system', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']].map(([v, n]) => `<button data-act="theme" data-id="${v}" aria-pressed="${(s.theme || 'system') === v}">${n}</button>`).join('')}</div></section>
      <section class="group"><h3>기록 백업</h3><p class="hint">기록은 이 기기에만 저장돼요. 1년 기록을 지키려면 가끔 백업 파일을 저장해 두세요.</p><div class="row"><button class="btn" data-act="export">백업 파일 저장</button><button class="btn" data-act="import">백업 불러오기</button><input id="import-file" type="file" accept="application/json,.json" hidden></div>${imp}</section>
      <section class="group"><h3>처음부터 다시</h3>${reset}</section>
      <p class="about">애니띵 모닝 3.0 · 1년 과정 · ${esc(COURSES.map(co => co.kind === 'phrase' ? `${co.name} ${co.groups.length}장면` : `${co.name} ${co.data.cards.length}`).join(' · '))} — 모든 문장과 예문은 이 앱을 위해 새로 썼어요.</p>
    </div>`;
  }
  function addSheet() {
    const groups = courseById.sentence.groups;
    const def = courseById.sentence.groupById[ui.libFilter] ? ui.libFilter : (groups[0] && groups[0].id);
    return `<form id="add-form" class="form" novalidate>
      <p class="hint">책, 경기, 대화에서 만난 좋은 문장을 모아 두세요. 내일부터 복습에 나와요.</p>
      <label class="label" for="add-text">문장</label><textarea id="add-text" rows="3" placeholder="예) 결과보다 네가 버틴 시간을 먼저 말해 주고 싶어."></textarea>
      <label class="label" for="add-sit">언제 쓰나요? (선택)</label><input id="add-sit" type="text" placeholder="예) 시합에서 진 다음 날">
      <label class="label" for="add-cat">분류</label><select id="add-cat">${groups.map(g => `<option value="${g.id}"${g.id === def ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
      <label class="label" for="add-blank">복습할 때 가릴 핵심 구절 (선택)</label><input id="add-blank" type="text" placeholder="문장 안에 있는 말 그대로 적어 주세요">
      <label class="label" for="add-why">메모 (선택)</label><textarea id="add-why" rows="2" placeholder="어디서 들었는지, 왜 좋았는지"></textarea>
      <p class="form-error" id="add-error" hidden></p>
      <button class="btn primary wide" type="submit">저장하기</button>
    </form>`;
  }
  /* 글자 퀴즈: 기본 글자에서 10문제, 소리가 같은 を는 뺀다 */
  function quizPool() { return window.AM_KANA.basic.flat().filter(c => c && c[0] !== 'を'); }
  function newQuiz(set) { ui.quiz = { set, i: 0, score: 0, used: [], q: null, choices: [], picked: null }; nextQuestion(); }
  function nextQuestion() {
    const z = ui.quiz, pool = quizPool(), idx = z.set === 'kata' ? 1 : 0;
    const left = pool.filter(c => !z.used.includes(c[2]));
    const q = left[Math.floor(Math.random() * left.length)];
    z.used.push(q[2]);
    const wrong = shuffle(pool.map(c => c[2]).filter((v, i, a) => v !== q[2] && a.indexOf(v) === i)).slice(0, 3);
    z.q = { kana: q[idx], ans: q[2] }; z.choices = shuffle([q[2]].concat(wrong)); z.picked = null;
  }
  function quizSheet() {
    const z = ui.quiz;
    if (z.i >= 10) {
      const msg = z.score >= 9 ? '거의 다 알아요. 반대쪽 글자에도 도전해 보세요.' : z.score >= 6 ? '잘하고 있어요. 틀린 글자는 표에서 눌러 소리를 들어 보세요.' : '처음엔 누구나 헷갈려요. 표를 한 번 더 보고 다시 해 봐요.';
      return `<div class="sheet-body"><p class="big-streak"><strong>${z.score}</strong>/ 10</p><p>${msg}</p><div class="duo"><button class="btn" data-act="quiz-again">다시 하기</button><button class="btn primary" data-act="close-sheet">닫기</button></div></div>`;
    }
    return `<div class="sheet-body">
      <p class="eyebrow">${z.i + 1} / 10 · 맞힌 개수 ${z.score}</p>
      <p class="kana-q" lang="ja">${z.q.kana}</p>
      <p class="hint">이 글자의 소리는?</p>
      <div class="choices">${z.choices.map(ch => `<button class="choice${z.picked ? (ch === z.q.ans ? ' right' : ch === z.picked ? ' wrong' : '') : ''}" data-act="quiz-pick" data-id="${esc(ch)}"${z.picked ? ' disabled' : ''}>${esc(ch)}</button>`).join('')}</div>
      ${z.picked ? `<button class="btn primary wide" data-act="quiz-next">${z.i === 9 ? '결과 보기' : '다음 문제'}</button>` : ''}
    </div>`;
  }

  /* ---------- 그리기 ---------- */
  const root = $('app');
  root.innerHTML = '<main id="view" class="view"></main><nav id="tabs" class="tabs" aria-label="메뉴"></nav><div id="session" class="session" hidden></div><div id="sheet" class="sheet" hidden></div><div id="toast" class="toast" role="status" aria-live="polite" hidden></div>';
  const TABS = [['today', '오늘', 'sunrise'], ['library', '모음', 'book'], ['notes', '기록', 'cal']];

  function renderView() {
    const el = $('view');
    if (!S.settings.onboarded) { el.innerHTML = ''; return; }
    el.innerHTML = ({ today: viewToday, library: viewLibrary, notes: viewNotes }[ui.view] || viewToday)();
  }
  function renderTabs() {
    const el = $('tabs');
    el.hidden = !S.settings.onboarded;
    el.innerHTML = `<div class="tabs-inner">${TABS.map(([id, label, ic]) => `<button class="tab" data-act="tab" data-id="${id}"${ui.view === id ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('')}</div>`;
  }
  function markDone(p) {
    if (p.done) return;
    p.done = true;
    const day = S.days[p.date] || {};
    S.days[p.date] = { done: true, c: { ...(day.c || {}), [p.course]: true } };
    const total = Object.keys(S.days).filter(isDone).length;
    if (MILESTONES[total] && !S.mile[total]) { S.mile[total] = p.date; p.mile = total; }
    save();
  }
  function renderSession() {
    const el = $('session');
    if (!S.settings.onboarded) { el.hidden = false; el.innerHTML = onboarding(); return; }
    if (ui.practice) {
      const co = courseById[ui.practice.course], u = co && co.groupById[ui.practice.unit];
      if (!u) { ui.practice = null; renderSession(); return; }
      const [body, actions] = dialogueView(co, u);
      el.hidden = false;
      el.innerHTML = `<div class="session-inner"><div class="session-top"><button class="icon-btn" data-act="close-practice" aria-label="대화 연습 닫기">${icon('close')}</button>${badge(co)}<span class="step-count">${esc(co.name)}</span></div><div class="session-body">${body}</div><div class="session-actions">${actions}</div></div>`;
      if (ui.scrollEnd) { el.scrollTop = el.scrollHeight; ui.scrollEnd = false; }
      return;
    }
    if (!ui.session) { el.hidden = true; el.innerHTML = ''; return; }
    const p = sessionPlan();
    if (!p.steps) p.steps = buildSteps(p);
    while (p.pos < p.steps.length - 1 && !stepValid(p.steps[p.pos], p)) p.pos++;
    const step = p.steps[p.pos];
    if (step.t === 'done') markDone(p);
    const co = courseById[p.course] || QUICK;
    const total = p.steps.length;
    const pct = Math.round((p.pos / Math.max(1, total - 1)) * 100);
    const [body, actions] = stepView(step, p);
    el.hidden = false;
    el.innerHTML = `<div class="session-inner">
      <div class="session-top"><button class="icon-btn" data-act="close-session" aria-label="루틴 닫기">${icon('close')}</button>${badge(co)}<div class="progress" role="progressbar" aria-label="${esc(co.name)} 루틴 진행" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${p.pos + 1}"><span style="width:${pct}%"></span></div><span class="step-count">${p.pos + 1} / ${total}</span></div>
      ${p.type && p.type !== 'learn' && p.pos === 0 ? `<p class="day-line"><span class="day-chip ${p.type}">${DAY_LABEL[p.type]}</span></p>` : ''}
      <div class="session-body">${body}</div>
      <div class="session-actions">${actions}</div>
    </div>`;
    const key = p.course + ':' + p.date + ':' + p.pos;
    if (ui.stepKey !== key) { el.scrollTop = 0; ui.stepKey = key; }
    if (ui.scrollEnd) { el.scrollTop = el.scrollHeight; ui.scrollEnd = false; }
  }
  function renderSheet() {
    const el = $('sheet');
    if (!ui.sheet) { el.hidden = true; el.innerHTML = ''; ui.sheetKey = ''; return; }
    let title = '', body = '';
    if (ui.sheet === 'card') {
      const c = cardById(ui.sheetId);
      if (!c) { ui.sheet = null; renderSheet(); return; }
      title = `${courseOf(c).name} · ${groupName(c)}`; body = cardSheet(c);
    } else if (ui.sheet === 'settings') { title = '설정'; body = settingsSheet(); }
    else if (ui.sheet === 'quiz') { title = `${ui.quiz.set === 'kata' ? '가타카나' : '히라가나'} 퀴즈`; body = quizSheet(); }
    else { title = '내 문장 추가'; body = addSheet(); }
    const key = ui.sheet + ':' + (ui.sheetId || '');
    const prev = el.querySelector('.sheet-panel');
    const top = prev && ui.sheetKey === key ? prev.scrollTop : 0;
    el.hidden = false;
    el.innerHTML = `<button class="scrim" data-act="close-sheet" aria-label="닫기" tabindex="-1"></button><div class="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1"><div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2><button class="icon-btn" data-act="close-sheet" aria-label="닫기">${icon('close')}</button></div>${body}</div>`;
    const panel = el.querySelector('.sheet-panel');
    panel.scrollTop = top;
    if (ui.sheetKey !== key) panel.focus({ preventScroll: true });
    ui.sheetKey = key;
  }
  function render() {
    renderView(); renderTabs(); renderSession(); renderSheet();
    document.body.classList.toggle('locked', !$('session').hidden || !$('sheet').hidden);
  }
  function openSheet(name, id) { ui.sheet = name; ui.sheetId = id || null; ui.confirm = null; ui.pendingImport = null; render(); }

  /* ---------- 브라우저 기능 ---------- */
  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  let voices = [];
  const loadVoices = () => { try { voices = window.speechSynthesis.getVoices() || []; } catch (e) { voices = []; } };
  if (canSpeak) { loadVoices(); try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { /* 이벤트가 없어도 기본 목소리로 읽는다 */ } }
  const warnedLang = {};
  function speak(text, lang, rate) {
    if (!canSpeak) { toast('이 기기에서는 듣기를 쓸 수 없어요.'); return; }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang || 'ko-KR';
      u.rate = rate || (u.lang === 'ko-KR' ? 0.95 : 0.9);
      const norm = v => String(v.lang || '').replace('_', '-');
      const pre = u.lang.slice(0, 2);
      const v = voices.find(x => norm(x) === u.lang) || voices.find(x => norm(x).slice(0, 2) === pre);
      if (v) u.voice = v;
      else if (voices.length && !warnedLang[pre]) { warnedLang[pre] = true; toast(`이 기기에 ${LANG_NAME[pre]} 음성이 없어요. 기기 설정에서 ${LANG_NAME[pre]} 음성을 추가하면 더 정확해요.`); }
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch (e) { toast('이 기기에서는 듣기를 쓸 수 없어요.'); }
  }
  function fallbackCopy(text, okMsg) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? okMsg : '복사하지 못했어요. 글자를 길게 눌러 복사해 주세요.');
  }
  function copyText(text, okMsg) {
    const msg = okMsg || '복사했어요';
    try { navigator.clipboard.writeText(text).then(() => toast(msg), () => fallbackCopy(text, msg)); } catch (e) { fallbackCopy(text, msg); }
  }
  function download(name, mime, content) {
    try {
      const url = URL.createObjectURL(new Blob([content], { type: mime }));
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch (e) { return false; }
  }
  function applyTheme() {
    const r = document.documentElement, v = S.settings.theme;
    if (v === 'light' || v === 'dark') r.setAttribute('data-theme', v);
    else if (hostTheme) r.setAttribute('data-theme', hostTheme);
    else r.removeAttribute('data-theme');
  }
  function icsText() {
    const [hh, mm] = (S.settings.time || '07:00').split(':').map(Number);
    const now = new Date(), start = new Date();
    start.setHours(hh, mm, 0, 0);
    if (start <= now) start.setDate(start.getDate() + 1);
    const f = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const url = /^https?:/.test(location.href) && !inFrame ? [`URL:${location.href.split('#')[0]}`] : [];
    const desc = S.settings.anchor ? `${S.settings.anchor}\\, 5분.` : '오늘의 루틴을 시작해요.';
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Anything Morning//KO', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:anything-morning-${uid()}@anything-morning`, `DTSTAMP:${stamp}`, `DTSTART:${f(start)}`, 'DURATION:PT5M', 'RRULE:FREQ=DAILY;COUNT=365',
      'SUMMARY:애니띵 모닝 · 아침 5분', `DESCRIPTION:${desc}`, ...url,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:애니띵 모닝', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }
  function readImport(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        const st = d && d.app === 'anything-morning' ? d.state : null;
        if (!st || typeof st.progress !== 'object') throw new Error('not a backup');
        ui.pendingImport = migrate(st); ui.confirm = 'import'; renderSheet();
      } catch (e) { toast('애니띵 모닝 백업 파일이 아니에요. 파일을 다시 확인해 주세요.'); }
    };
    r.readAsText(file);
  }
  function saveCustom() {
    const v = id => (($(id) && $(id).value) || '').trim();
    const text = v('add-text'), blank = v('add-blank');
    const err = $('add-error');
    const fail = m => { err.hidden = false; err.textContent = m; };
    if (!text) return fail('문장을 적어 주세요.');
    if (blank && !text.includes(blank)) return fail('핵심 구절은 문장 안에 있는 말 그대로 적어 주세요.');
    const id = 'u-' + uid();
    const cat = v('add-cat') || courseById.sentence.groups[0].id;
    S.custom.push({ id, course: 'sentence', cat, g: cat, ctx: [], situation: v('add-sit'), avoid: '', text, blank, why: v('add-why'), word: null, custom: true, created: today() });
    learn(id); save();
    ui.sheet = null; ui.libCourse = 'sentence'; ui.libSub = 'items'; ui.libFilter = 'mine'; render();
    toast('내 문장에 추가했어요. 내일부터 복습에 나와요.');
  }
  function sayLine(courseId, unitId, i) {
    const co = courseById[courseId], u = co && co.groupById[unitId], l = u && u.dialogue[i];
    if (l) speak(l.t, co.lang);
  }
  const dlgUnit = () => (ui.practice ? { co: courseById[ui.practice.course], id: ui.practice.unit } : { co: courseById[ui.session], id: curStep().unit });

  /* ---------- 동작 ---------- */
  const advance = () => {
    const p = sessionPlan();
    p.pos = Math.min(p.pos + 1, p.steps.length - 1);
    resetStepUi(); save(); renderSession();
  };
  const toggle = (arr, id) => (arr.includes(id) ? arr.filter(x => x !== id) : arr.concat(id));
  const ACTIONS = {
    tab(id) { ui.view = id; render(); window.scrollTo(0, 0); },
    settings() { openSheet('settings'); },
    'close-sheet'() { ui.sheet = null; ui.confirm = null; ui.pendingImport = null; render(); },
    open(id) { openSheet('card', id); },
    find(id) { ui.view = 'library'; ui.libCourse = 'sentence'; ui.libSub = 'items'; ui.libFilter = id; ui.q = ''; ui.libCtx = ''; render(); window.scrollTo(0, 0); },
    'lib-course'(id) { ui.libCourse = id; ui.libSub = 'items'; ui.libFilter = 'all'; ui.q = ''; ui.libCtx = ''; renderView(); },
    'lib-sub'(id) { ui.libSub = id; renderView(); },
    'lib-filter'(id) { ui.libFilter = id; renderView(); },
    'unit-toggle'(id) {
      const co = libCourse(), cur = currentUnit(co);
      const now = ui.openUnits[id] != null ? ui.openUnits[id] : !!(cur && cur.id === id);
      ui.openUnits[id] = !now; renderView();
    },
    'words-mode'(id) { ui.wordsMode = id; renderView(); },
    'notes-mode'(id) { ui.notesMode = id; renderView(); },
    'kana-set'(id) { ui.kanaSet = id; renderView(); },
    'say-kana'(k) { speak(k, 'ja-JP', 0.8); },
    quiz() { newQuiz(ui.kanaSet); openSheet('quiz'); },
    'quiz-pick'(ch) {
      const z = ui.quiz;
      if (z.picked) return;
      z.picked = ch;
      if (ch === z.q.ans) z.score++;
      speak(z.q.kana, 'ja-JP', 0.8);
      renderSheet();
    },
    'quiz-next'() {
      const z = ui.quiz;
      z.i++;
      if (z.i < 10) nextQuestion();
      else { S.kana[z.set] = Math.max(S.kana[z.set] || 0, z.score); save(); renderView(); }
      renderSheet();
    },
    'quiz-again'() { newQuiz(ui.quiz.set); renderSheet(); },
    fav(id) { if (S.favs[id]) delete S.favs[id]; else S.favs[id] = true; save(); renderView(); renderSheet(); },
    add() { openSheet('add'); },
    start(cid) {
      const co = courseById[cid] || activeCourses()[0];
      const p = plan(co.id);
      if (!p.steps) p.steps = buildSteps(p);
      ui.session = co.id; ui.stepKey = ''; resetStepUi(); save(); render();
    },
    quick() {
      const p = quickPlan();
      if (p.done && p.pos >= p.steps.length - 1) { toast('오늘의 1분 루틴은 이미 했어요.'); return; }
      ui.session = 'quick'; ui.stepKey = ''; resetStepUi(); render();
    },
    'close-session'() { ui.session = null; render(); },
    reveal() {
      ui.revealed = true;
      const c = cardById(curStep().id);
      if (c && courseOf(c).kind === 'phrase') speakCard(c);
      renderSession();
    },
    grade(g) {
      const p = sessionPlan(), s = p.steps[p.pos];
      gradeCard(s.id, g);
      if (g === 'again') {
        // 바로 다시 보면 방금 본 답을 베끼게 되니, 남은 복습과 새 항목 뒤에 한 번 더 넣는다
        let i = p.pos + 1;
        while (i < p.steps.length && (p.steps[i].t === 'review' || p.steps[i].t === 'learn')) i++;
        p.steps.splice(i, 0, { t: 'review', id: s.id, again: true });
      }
      advance();
    },
    next() { advance(); },
    learned() { const s = curStep(); if (s) learn(s.id); advance(); },
    read() { ui.reads = Math.min(3, ui.reads + 1); renderSession(); },
    speak(id) { const c = cardById(id); if (c) speakCard(c); },
    'speak-slow'(id) { const c = cardById(id); if (c) speakCard(c, 0.65); },
    'speak-all'() {
      const s = curStep(), co = courseById[ui.session];
      if (!s || !s.ids || !co) return;
      speak(s.ids.map(cardById).filter(Boolean).map(c => c.t).join(co.lang === 'ja-JP' ? ' ' : ' ... '), co.lang, 0.85);
    },
    copy(id) { const c = cardById(id); if (c) copyCard(c); },
    check(r) {
      const it = S.intents.find(i => i.id === curStep().id);
      if (it) it.result = r;
      save();
      if (r === 'used') { ui.checkNote = true; renderSession(); }
      else { toast('괜찮아요. 오늘 또 기회가 있어요.'); advance(); }
    },
    'check-save'() {
      const it = S.intents.find(i => i.id === curStep().id);
      const v = (($('check-note') && $('check-note').value) || '').trim();
      if (it && v) it.note = v;
      advance();
    },
    'rewrite-save'() {
      const ta = $('rewrite'), v = ((ta && ta.value) || '').trim();
      if (!v) { if (ta) ta.focus(); toast('한 줄이라도 써 보세요. 건너뛰어도 괜찮아요.'); return; }
      const s = curStep();
      S.rewrites.push({ id: uid(), date: today(), cardId: s.id, course: ui.session, text: v, ...(s.t === 'weekwrite' || s.t === 'weekthink' ? { kind: 'week' } : {}) });
      toast('기록에 저장했어요');
      advance();
    },
    who(w) {
      ui.who = ui.who === w ? '' : w;
      document.querySelectorAll('[data-act="who"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === ui.who)));
    },
    pick(id) {
      ui.pick = id;
      document.querySelectorAll('[data-act="pick"]').forEach(b => { const on = String(b.dataset.id === id); b.setAttribute('aria-pressed', on); b.setAttribute('aria-checked', on); });
    },
    'pick-go'() {
      const p = sessionPlan(), s = curStep();
      p.pick = ui.pick || (s.ids.find(id => cardById(id)));
      advance();
    },
    'intent-save'() {
      const when = (($('intent-when') && $('intent-when').value) || '').trim();
      if (!ui.who && !when) { const er = $('intent-err'); er.hidden = false; er.textContent = '누구에게 쓸지 하나만 골라 주세요.'; return; }
      const p = sessionPlan();
      S.intents = S.intents.filter(i => i.date !== p.date);
      S.intents.push({ id: uid(), date: p.date, cardId: resolveId(curStep(), p), who: ui.who, when, result: null, note: '' });
      advance();
    },
    'say-line'(id) { const [c, u, i] = id.split('|'); sayLine(c, u, Number(i)); },
    'dlg-next'() {
      const { co, id } = dlgUnit(), u = co.groupById[id];
      ui.dlgLine = Math.min(ui.dlgLine + 1, u.dialogue.length - 1); ui.dlgRevealed = false; ui.scrollEnd = true;
      const l = u.dialogue[ui.dlgLine];
      if (l.who !== (ui.dlgSwap ? 'A' : 'B')) speak(l.t, co.lang);
      renderSession();
    },
    'dlg-reveal'() {
      const { co, id } = dlgUnit(), l = co.groupById[id].dialogue[ui.dlgLine];
      ui.dlgRevealed = true; ui.scrollEnd = true;
      speak(l.t, co.lang);
      renderSession();
    },
    'dlg-swap'() {
      const { co, id } = dlgUnit(), l = co.groupById[id].dialogue[0];
      ui.dlgSwap = !ui.dlgSwap; ui.dlgLine = 0; ui.dlgRevealed = false;
      if (l.who !== (ui.dlgSwap ? 'A' : 'B')) speak(l.t, co.lang);
      renderSession();
    },
    'dlg-done'() {
      const { id } = dlgUnit();
      S.dlg[id] = { n: ((S.dlg[id] || {}).n || 0) + 1, last: today() };
      save();
      if (ui.practice) { ui.practice = null; render(); toast('대화 연습을 마쳤어요'); } else advance();
    },
    practice(unitId) {
      ui.practice = { course: libCourse().id, unit: unitId };
      resetStepUi(); render();
    },
    'close-practice'() { ui.practice = null; render(); },
    more(cid) {
      const co = courseById[cid];
      const p = plan(co.id);
      const ids = pickNew(co, 1, p.fresh);
      if (!ids.length) { toast(`${co.name}의 ${co.unitWord}을 모두 배웠어요.`); return; }
      if (!p.steps) p.steps = buildSteps(p);
      p.fresh.push(ids[0]);
      const tail = [{ t: 'learn', id: ids[0] }];
      dialoguesFor(co, p.fresh).filter(u => !S.dlg[u] && !(p.dialogues || []).includes(u)).forEach(u => { tail.push({ t: 'dialogue', unit: u }); p.dialogues = (p.dialogues || []).concat(u); });
      p.steps.push(...tail, { t: 'done' });
      p.pos = p.steps.length - tail.length - 1;
      ui.session = co.id; ui.stepKey = ''; resetStepUi(); save(); render();
    },
    enroll(id) { learn(id); save(); toast('학습에 추가했어요. 내일 복습에 나와요.'); renderSheet(); renderView(); },
    'ask-delete'(id) { ui.confirm = 'delete:' + id; renderSheet(); },
    'cancel-confirm'() { ui.confirm = null; ui.pendingImport = null; renderSheet(); },
    delete(id) {
      S.custom = S.custom.filter(c => c.id !== id);
      delete S.progress[id]; delete S.favs[id]; delete S.notes[id];
      const p = S.plans.sentence;
      if (p) { p.review = p.review.filter(x => x !== id); p.fresh = p.fresh.filter(x => x !== id); }
      ui.sheet = null; ui.confirm = null; save(); render();
      toast('문장을 지웠어요');
    },
    'course-toggle'(id) {
      const next = toggle(S.settings.courses, id);
      if (!next.length) { toast('과정을 하나 이상 골라 주세요.'); return; }
      S.settings.courses = COURSES.map(co => co.id).filter(x => next.includes(x));
      save(); renderView(); renderSheet();
    },
    load(n) { S.settings.load = Number(n); refreshFresh(); save(); renderView(); renderSheet(); },
    rhythm(v) {
      S.settings.rhythm = v === 'daily' ? 'daily' : 'week';
      Object.keys(S.plans).forEach(k => { if (!S.plans[k].steps) delete S.plans[k]; });  // 아직 시작하지 않은 오늘 루틴은 새 리듬으로 다시 만든다
      save(); renderView(); renderSheet();
    },
    ctx(id) { S.settings.contexts = toggle(S.settings.contexts, id); refreshFresh(); save(); renderView(); renderSheet(); },
    pron(v) { S.settings.pron = v === 'on'; save(); renderView(); renderSheet(); },
    theme(v) { S.settings.theme = v; applyTheme(); save(); renderSheet(); },
    ics() {
      if (inFrame) { toast('미리보기에서는 파일을 받을 수 없어요. 앱에서 이용해 주세요.'); return; }
      download('anything-morning.ics', 'text/calendar;charset=utf-8', icsText());
      toast('캘린더 파일을 받았어요. 열어서 추가해 주세요.');
    },
    export() {
      const data = JSON.stringify({ app: 'anything-morning', exported: new Date().toISOString(), state: S }, null, 2);
      if (inFrame) { copyText(data, '백업 내용을 복사했어요. 메모장에 붙여 넣어 보관하세요.'); return; }
      download(`anything-morning-${today()}.json`, 'application/json', data);
      toast('백업 파일을 저장했어요');
    },
    import() { const f = $('import-file'); if (f) { f.value = ''; f.click(); } },
    'apply-import'() {
      if (!ui.pendingImport) return;
      S = ui.pendingImport; ui.pendingImport = null; ui.confirm = null; ui.sheet = null; ui.session = null; ui.practice = null;
      save(); applyTheme(); render();
      toast('백업을 불러왔어요');
    },
    'ask-reset'() { ui.confirm = 'reset'; renderSheet(); },
    reset() {
      S = fresh(); ui.sheet = null; ui.confirm = null; ui.session = null; ui.practice = null; ui.onb = 0; ui.view = 'today';
      save(); applyTheme(); render();
    },
    'onb-next'() {
      if (onbSteps()[ui.onb] === 'courses' && !S.settings.courses.length) {
        const er = $('onb-err'); er.hidden = false; er.textContent = '공부할 과정을 하나 이상 골라 주세요.'; return;
      }
      ui.onb = Math.min(onbSteps().length - 1, ui.onb + 1); save(); renderSession();
    },
    'onb-back'() { ui.onb = Math.max(0, ui.onb - 1); renderSession(); },
    'onb-course'(id) { S.settings.courses = COURSES.map(co => co.id).filter(x => toggle(S.settings.courses, id).includes(x)); renderSession(); },
    'onb-ctx'(id) { S.settings.contexts = toggle(S.settings.contexts, id); renderSession(); },
    'onb-load'(n) { S.settings.load = Number(n); renderSession(); },
    'onb-anchor'(a) { S.settings.anchor = S.settings.anchor === a ? '' : a; renderSession(); },
    'onb-rhythm'(v) { S.settings.rhythm = v === 'daily' ? 'daily' : 'week'; renderSession(); },
    'onb-start'() {
      const t = $('onb-time'), a = $('onb-anchor');
      if (t && /^\d{2}:\d{2}$/.test(t.value)) S.settings.time = t.value;
      if (a && a.value.trim()) S.settings.anchor = a.value.trim().slice(0, 40);
      S.settings.onboarded = true; S.settings.start = today(); S.plans = {};
      ACTIONS.start(activeCourses()[0].id);
    }
  };

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled || !ACTIONS[t.dataset.act]) return;
    e.preventDefault();
    ACTIONS[t.dataset.act](t.dataset.id, t);
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'lib-q') { ui.q = t.value; $('lib-list').innerHTML = libList(); }
    else if (t.id === 'card-note') { if (t.value.trim()) S.notes[t.dataset.id] = t.value; else delete S.notes[t.dataset.id]; save(); }
    else if (t.id === 'set-anchor') { S.settings.anchor = t.value.trim().slice(0, 40); save(); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'lib-ctx') { ui.libCtx = t.value; $('lib-list').innerHTML = libList(); }
    else if (t.id === 'set-time' || t.id === 'onb-time') { if (/^\d{2}:\d{2}$/.test(t.value)) { S.settings.time = t.value; save(); } }
    else if (t.id === 'set-anchor') renderView();
    else if (t.id === 'import-file') readImport(t.files && t.files[0]);
  });
  document.addEventListener('submit', e => { if (e.target.id === 'add-form') { e.preventDefault(); saveCustom(); } });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (ui.sheet) ACTIONS['close-sheet']();
    else if (ui.practice) ACTIONS['close-practice']();
    else if (ui.session && S.settings.onboarded) ACTIONS['close-session']();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const t = today();
    if (Object.values(S.plans).some(p => p.date !== t) || (S.quick && S.quick.date !== t)) { ui.session = null; render(); }
  });

  applyTheme();
  render();

  if ('serviceWorker' in navigator && !inFrame && /^(https:|http:\/\/localhost)/.test(location.href)) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* 오프라인 저장 없이도 동작한다 */ }
  }
})();
