/* 애니띵 모닝 — 하루 5분, 마음을 움직이는 문장 하나.
   하루 루틴: 어제 약속 확인 → 간격 복습(빈칸 떠올리기) → 새 문장(피할 말과 비교, 소리 내어 읽기)
            → 내 말로 바꾸기 → 오늘 누구에게 쓸지 약속.
   기록은 모두 이 기기의 localStorage 한 곳(KEY)에만 둔다. 서버는 없다. */
(() => {
  'use strict';

  const D = window.AM_DATA || { categories: [], contexts: [], cards: [] };
  const KEY = 'anything-morning.v1';
  const DAY_START_HOUR = 4;                    // 새벽 4시 전까지는 전날 루틴으로 친다
  const INTERVALS = [1, 2, 4, 7, 15, 30, 60];  // 상자 번호별 다음 복습까지의 날짜
  const MASTERED_BOX = 4;                      // 15일 간격까지 기억하면 '익힘'
  const MAX_REVIEW = 8;                        // 하루 복습 상한 — 루틴이 5분 안에 끝나게
  const WHO = { coach: '선수', work: '동료·팀원', parent: '아이', teacher: '학생', friend: '친구·연인', self: '나 자신' };
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const STATUS_LABEL = { new: '처음', learning: '학습 중', mastered: '익힘' };
  const HOLE = '<span class="hole" aria-hidden="true"></span>';
  const canSpeak = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  const inFrame = window.top !== window.self;
  const hostTheme = document.documentElement.getAttribute('data-theme');
  const catById = Object.fromEntries(D.categories.map(c => [c.id, c]));
  const builtin = new Map(D.cards.map(c => [c.id, c]));
  const orderInCat = {};
  {
    const seen = {};
    D.cards.forEach(c => { seen[c.cat] = (seen[c.cat] || 0); orderInCat[c.id] = seen[c.cat]++; });
  }

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

  const ICONS = {
    sunrise: '<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 6v3M5.2 10.2 7 11.5M18.8 10.2 17 11.5"/>',
    book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19v3H7.5"/>',
    ring: '<rect x="4" y="8" width="16" height="12" rx="2"/><circle cx="8.5" cy="12" r="1.3"/><path d="M8.5 10.7V6a2.5 2.5 0 0 1 5 0v1"/>',
    pen: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    speaker: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    star: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

  /* ---------- 저장 ---------- */
  function fresh() {
    return {
      v: 1,
      settings: { contexts: [], newPerDay: 1, time: '07:00', theme: 'system', onboarded: false },
      progress: {},   // 카드 id → { box, due, seen, last, reps, lapses }
      days: {},       // 'YYYY-MM-DD' → { done: true }
      plan: null,     // 오늘의 루틴(날짜가 바뀌면 새로 만든다)
      intents: [],    // 실천 약속 { id, date, cardId, who, when, result: null|'used'|'notyet', note }
      rewrites: [],   // 내 말로 바꾼 문장 { id, date, cardId, text }
      custom: [],     // 사용자가 추가한 문장(카드와 같은 모양, custom: true)
      favs: {},
      notes: {}
    };
  }
  function migrate(s) {
    const f = fresh();
    if (!s || typeof s !== 'object') return f;
    const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const arr = v => (Array.isArray(v) ? v : []);
    const st = {
      ...f,
      settings: { ...f.settings, ...obj(s.settings) },
      progress: obj(s.progress), days: obj(s.days), favs: obj(s.favs), notes: obj(s.notes),
      intents: arr(s.intents), rewrites: arr(s.rewrites), custom: arr(s.custom),
      plan: s.plan && typeof s.plan === 'object' && Array.isArray(s.plan.review) && Array.isArray(s.plan.fresh) ? s.plan : null
    };
    if (!Array.isArray(st.settings.contexts)) st.settings.contexts = [];
    st.settings.newPerDay = [1, 2, 3].includes(+st.settings.newPerDay) ? +st.settings.newPerDay : 1;
    return st;
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
    view: 'today', libFilter: 'all', libCtx: '', q: '', wordsMode: 'learned', notesMode: 'rewrites',
    session: false, revealed: false, reads: 0, checkNote: false, who: '', stepKey: '',
    sheet: null, sheetId: null, sheetKey: '', confirm: null, pendingImport: null, onb: 0
  };

  /* ---------- 카드와 진도 ---------- */
  const cardById = id => builtin.get(id) || S.custom.find(c => c.id === id) || null;
  const allCards = () => D.cards.concat(S.custom);
  const catName = c => (catById[c.cat] ? catById[c.cat].name : '내 문장');
  const status = id => { const p = S.progress[id]; return !p ? 'new' : p.box >= MASTERED_BOX ? 'mastered' : 'learning'; };
  const nextBox = (p, g) => (g === 'again' ? 0 : g === 'hard' ? p.box : Math.min(p.box + 1, INTERVALS.length - 1));

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
  function streak() {
    let t = today(), n = 0;
    if (!(S.days[t] && S.days[t].done)) t = addDays(t, -1);
    while (S.days[t] && S.days[t].done) { n++; t = addDays(t, -1); }
    return n;
  }

  /* 새 문장 고르기: 고른 대상에 맞는 문장 먼저, 분류를 번갈아 가며 */
  function pickNew(n, exclude) {
    const prefs = S.settings.contexts;
    const cats = D.categories.map(c => c.id);
    return D.cards
      .filter(c => !S.progress[c.id] && !exclude.includes(c.id))
      .map(c => ({ c, miss: prefs.length && !c.ctx.some(x => prefs.includes(x)) ? 1 : 0 }))
      .sort((a, b) => a.miss - b.miss || orderInCat[a.c.id] - orderInCat[b.c.id] || cats.indexOf(a.c.cat) - cats.indexOf(b.c.cat))
      .slice(0, n)
      .map(x => x.c.id);
  }
  function pendingIntent(t) {
    return S.intents
      .filter(i => !i.result && i.date < t && daysBetween(i.date, t) <= 3)
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }
  function plan() {
    const t = today();
    if (S.plan && S.plan.date === t) return S.plan;
    const review = Object.keys(S.progress)
      .filter(id => cardById(id) && S.progress[id].due <= t)
      .sort((a, b) => S.progress[a].due.localeCompare(S.progress[b].due) || S.progress[a].box - S.progress[b].box)
      .slice(0, MAX_REVIEW);
    const pending = pendingIntent(t);
    S.plan = { date: t, review, fresh: pickNew(S.settings.newPerDay, []), check: pending ? pending.id : null, steps: null, pos: 0, done: false };
    save();
    return S.plan;
  }
  function refreshFresh() {
    const p = S.plan;
    if (p && p.date === today() && !p.steps) p.fresh = pickNew(S.settings.newPerDay, []);
  }
  function buildSteps(p) {
    const steps = [];
    if (p.check) steps.push({ t: 'check', id: p.check });
    p.review.forEach(id => steps.push({ t: 'review', id }));
    p.fresh.forEach(id => steps.push({ t: 'learn', id }));
    if (p.fresh[0]) steps.push({ t: 'rewrite', id: p.fresh[0] });
    if (p.fresh[0] || p.review[0]) steps.push({ t: 'intent', id: p.fresh[0] || p.review[0] });
    steps.push({ t: 'done' });
    return steps;
  }
  function stepValid(s) {
    if (s.t === 'done') return true;
    if (s.t === 'check') { const it = S.intents.find(i => i.id === s.id); return !!(it && !it.result && cardById(it.cardId)) || ui.checkNote; }
    return !!cardById(s.id);
  }
  const curStep = () => { const p = plan(); return p.steps ? p.steps[p.pos] : null; };
  const defaultWho = () => WHO[S.settings.contexts[0]] || '';
  function resetStepUi() { ui.revealed = false; ui.reads = 0; ui.checkNote = false; ui.who = defaultWho(); }
  function intentLabel(it) { return [it.who && `${it.who}에게`, it.when].filter(Boolean).join(' · '); }

  /* ---------- 문장 표시 ---------- */
  function marked(c, mode, reveal) {
    const text = c.text || '';
    const b = c.blank && text.includes(c.blank) ? c.blank : '';
    if (!b) {
      if (mode !== 'blank') return esc(text);
      const first = text.split(/\s+/)[0] || '';
      const len = Math.min(12, Math.max(4, [...text].length - [...first].length));
      return `${esc(first)} <span class="blank" style="--len:${len}" role="img" aria-label="빈칸"></span>`;
    }
    const i = text.indexOf(b);
    const pre = esc(text.slice(0, i)), post = esc(text.slice(i + b.length));
    if (mode === 'blank') return `${pre}<span class="blank" style="--len:${[...b].length}" role="img" aria-label="빈칸"></span>${post}`;
    return `${pre}<mark${reveal ? ' class="reveal"' : ''}>${esc(b)}</mark>${post}`;
  }
  function cardBlock(c, wordLabel) {
    return `${c.situation ? `<p class="situation">${esc(c.situation)}</p>` : ''}
      ${c.avoid ? `<div class="avoid"><span class="label">이렇게 말하는 대신</span><p>${esc(c.avoid)}</p></div>` : ''}
      <div class="better"><span class="label">${c.avoid ? '이렇게 말해 보세요' : '좋은 문장'}</span><blockquote class="quote">${marked(c, 'mark')}</blockquote></div>
      ${c.why ? `<div class="why"><span class="label">${c.custom ? '메모' : '왜 마음이 움직일까'}</span><p>${esc(c.why)}</p></div>` : ''}
      ${c.word && c.word.term ? `<div class="word"><span class="label">${wordLabel}</span><p class="term">${esc(c.word.term)}</p><p>${esc(c.word.meaning)}</p>${c.word.example ? `<p class="ex">${esc(c.word.example)}</p>` : ''}</div>` : ''}`;
  }
  const speakBtn = c => (canSpeak ? `<button class="btn" data-act="speak" data-id="${esc(c.id)}">${icon('speaker')}듣기</button>` : '');
  const copyBtn = (c, label) => `<button class="btn" data-act="copy" data-id="${esc(c.id)}">${icon('copy')}${label || '복사'}</button>`;
  const head = (sub, title) => `<header class="top"><div><p class="date">${sub}</p><h1 class="greet">${title}</h1></div><button class="icon-btn" data-act="settings" aria-label="설정">${icon('sliders')}</button></header>`;
  const empty = (msg, extra) => `<div class="empty"><p>${msg}</p>${extra || ''}</div>`;

  /* ---------- 화면: 오늘 ---------- */
  function greeting(now) {
    const h = now.getHours();
    return h < 5 ? '고요한 새벽이에요' : h < 11 ? '좋은 아침이에요' : h < 17 ? '좋은 오후예요' : '좋은 저녁이에요';
  }
  function weekStrip(withCount) {
    const t = today(), days = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(t, -i), done = !!(S.days[d] && S.days[d].done);
      days.push(`<li class="day${done ? ' done' : ''}${i === 0 ? ' now' : ''}"><span class="wd">${WEEKDAYS[parse(d).getDay()]}</span><span class="dot">${done ? icon('check') : ''}</span></li>`);
    }
    return `<section class="week" aria-label="최근 7일 기록"><ol>${days.join('')}</ol>${withCount ? `<p class="streak"><strong>${streak()}</strong>일 연속</p>` : ''}</section>`;
  }
  function routineCard(p) {
    const steps = p.steps || buildSteps(p);
    const doneOf = t => {
      const idx = steps.map((s, i) => (s.t === t ? i : -1)).filter(i => i >= 0);
      return !!p.steps && idx.length > 0 && idx.every(i => i < p.pos);
    };
    const items = [];
    if (p.check) items.push(['check', '어제 약속 확인']);
    if (p.review.length) items.push(['review', `복습 ${p.review.length}문장`]);
    if (p.fresh.length) items.push(['learn', `새 문장 ${p.fresh.length}개`], ['rewrite', '내 말로 바꾸기']);
    if (p.fresh.length || p.review.length) items.push(['intent', '오늘 누구에게 쓸지 정하기']);
    if (!items.length) {
      return `<article class="deck">${HOLE}<p class="eyebrow">오늘의 루틴</p><h2 class="deck-title">오늘은 복습할 문장도, 새 문장도 없어요.</h2><p class="muted">문장집에서 마음에 드는 문장을 학습에 추가하거나, 직접 모은 문장을 적어 보세요.</p><button class="btn primary wide" data-act="tab" data-id="library">문장집 열기</button></article>`;
    }
    const mins = Math.max(2, Math.round((p.check ? 0.5 : 0) + p.review.length * 0.5 + p.fresh.length * 1.5 + (p.fresh.length ? 1.5 : 0)));
    const first = cardById(p.fresh[0]);
    return `<article class="deck">${HOLE}
      <p class="eyebrow">오늘의 루틴 · 약 ${mins}분</p>
      <h2 class="deck-title">${first ? `오늘은 ‘${esc(catName(first))}’ 문장을 배워요` : '오늘은 복습하는 날이에요'}</h2>
      ${first ? `<p class="situation">${esc(first.situation)}</p>` : ''}
      <ul class="todo">${items.map(([t, label]) => `<li class="${doneOf(t) ? 'ok' : ''}"><span class="box">${doneOf(t) ? icon('check') : ''}</span>${label}</li>`).join('')}</ul>
      <button class="btn primary wide" data-act="start">${p.steps && p.pos > 0 ? '이어서 하기' : '시작하기'}</button>
    </article>`;
  }
  function doneCard(p) {
    const id = p.fresh[p.fresh.length - 1] || p.review[0];
    const c = id && cardById(id);
    const it = S.intents.find(i => i.date === p.date);
    return `<article class="deck">${HOLE}
      <p class="eyebrow">오늘의 루틴 완료 ${icon('check')}</p>
      ${c ? `<blockquote class="quote">${marked(c, 'mark')}</blockquote>` : '<h2 class="deck-title">오늘 할 일을 모두 마쳤어요.</h2>'}
      ${it ? `<p class="intent-line">오늘의 약속 · ${esc(intentLabel(it))}</p>` : ''}
      ${c ? `<div class="row"><button class="btn" data-act="open" data-id="${esc(c.id)}">자세히</button>${copyBtn(c)}${speakBtn(c)}</div>` : ''}
      <button class="link" data-act="more">새 문장 하나 더 배우기</button>
    </article>`;
  }
  function viewToday() {
    const p = plan();
    const now = new Date();
    const ids = Object.keys(S.progress).filter(id => cardById(id));
    const mastered = ids.filter(id => S.progress[id].box >= MASTERED_BOX).length;
    const used = S.intents.filter(i => i.result === 'used').length;
    return `${head(`${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`, greeting(now))}
      ${weekStrip(true)}
      ${p.done ? doneCard(p) : routineCard(p)}
      <p class="stats"><span>배운 문장<b>${ids.length}</b></span><span>익힌 문장<b>${mastered}</b></span><span>실전에서 쓴 횟수<b>${used}</b></span></p>
      <section><h2 class="sec-title">지금 필요한 말 찾기</h2><div class="chips">${D.categories.map(c => `<button class="chip" data-act="find" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div></section>`;
  }

  /* ---------- 화면: 문장집 ---------- */
  function libItems() {
    const q = ui.q.trim().toLowerCase();
    return allCards().filter(c => {
      if (ui.libFilter === 'fav') { if (!S.favs[c.id]) return false; }
      else if (ui.libFilter === 'mine') { if (!c.custom) return false; }
      else if (ui.libFilter !== 'all' && c.cat !== ui.libFilter) return false;
      if (ui.libCtx && !(c.ctx || []).includes(ui.libCtx)) return false;
      if (!q) return true;
      return [c.text, c.situation, c.avoid, c.why, c.word && c.word.term, c.word && c.word.meaning, catName(c)]
        .some(v => v && v.toLowerCase().includes(q));
    });
  }
  function itemRow(c) {
    const st = status(c.id), fav = !!S.favs[c.id];
    return `<li><button class="item" data-act="open" data-id="${esc(c.id)}">
        <span class="item-meta"><span>${esc(catName(c))}</span><span class="pill ${st}">${STATUS_LABEL[st]}</span>${c.custom ? '<span class="pill mine">내 문장</span>' : ''}</span>
        <span class="item-text">${esc(c.text)}</span>
        ${c.situation ? `<span class="item-sit">${esc(c.situation)}</span>` : ''}
      </button><button class="star${fav ? ' on' : ''}" data-act="fav" data-id="${esc(c.id)}" aria-pressed="${fav}" aria-label="즐겨찾기">${icon('star')}</button></li>`;
  }
  function libList() {
    const items = libItems();
    if (!items.length) {
      if (ui.libFilter === 'mine') return empty('아직 직접 추가한 문장이 없어요. 책, 경기, 대화에서 만난 좋은 문장을 모아 보세요.', '<button class="btn primary" data-act="add">내 문장 추가</button>');
      if (ui.libFilter === 'fav') return empty('즐겨찾기한 문장이 없어요. 문장 옆 별을 눌러 자주 쓸 말을 모아 두세요.');
      return empty('찾는 문장이 없어요. 다른 말로 찾아보거나 분류를 바꿔 보세요.');
    }
    return `<p class="count">${items.length}개 문장</p><ul class="list">${items.map(itemRow).join('')}</ul>`;
  }
  function viewLibrary() {
    const filters = [['all', '전체'], ['fav', '즐겨찾기'], ['mine', '내 문장']].concat(D.categories.map(c => [c.id, c.name]));
    return `${head('상황별로 찾아 쓰는', '문장집')}
      <div class="lib-tools">
        <label class="search">${icon('search')}<input id="lib-q" type="search" placeholder="상황이나 단어로 찾기 (예: 긴장, 실수)" value="${esc(ui.q)}" aria-label="문장 찾기"></label>
        <select id="lib-ctx" aria-label="대상">${[['', '대상 전체']].concat(D.contexts.map(x => [x.id, x.name])).map(([v, n]) => `<option value="${v}"${ui.libCtx === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <button class="btn" data-act="add">${icon('plus')}내 문장</button>
      </div>
      <div class="chips scroll">${filters.map(([id, name]) => `<button class="chip" data-act="lib-filter" data-id="${id}" aria-pressed="${ui.libFilter === id}">${esc(name)}</button>`).join('')}</div>
      <div id="lib-list" class="sheet-body">${libList()}</div>`;
  }

  /* ---------- 화면: 단어장 ---------- */
  function viewWords() {
    const all = allCards().filter(c => c.word && c.word.term);
    const learned = all.filter(c => S.progress[c.id]);
    const list = ui.wordsMode === 'all' ? all : learned;
    return `${head('문장에서 건진', '단어장')}
      <div class="seg" role="group" aria-label="보기"><button data-act="words-mode" data-id="learned" aria-pressed="${ui.wordsMode === 'learned'}">배운 단어 ${learned.length}</button><button data-act="words-mode" data-id="all" aria-pressed="${ui.wordsMode === 'all'}">전체 ${all.length}</button></div>
      ${list.length
        ? `<ul class="words">${list.map(c => `<li><button class="word-item" data-act="open" data-id="${esc(c.id)}"><span class="term"><mark>${esc(c.word.term)}</mark></span><span class="meaning">${esc(c.word.meaning)}</span><span class="ex">${esc(c.word.example)}</span></button></li>`).join('')}</ul>`
        : empty('아직 배운 단어가 없어요. 오늘의 루틴을 마치면 문장 속 좋은 단어가 여기에 쌓여요.', '<button class="btn" data-act="words-mode" data-id="all">전체 단어 미리 보기</button>')}`;
  }

  /* ---------- 화면: 내 노트 ---------- */
  function intentPill(i) {
    if (i.result === 'used') return '<span class="pill used">써봤어요</span>';
    if (i.result === 'notyet') return '<span class="pill">아직</span>';
    if (i.date === today()) return '<span class="pill today">오늘의 약속</span>';
    return '<span class="pill">확인 안 함</span>';
  }
  function viewNotes() {
    const rw = S.rewrites.slice().reverse(), its = S.intents.slice().reverse();
    let body;
    if (ui.notesMode === 'rewrites') {
      body = rw.length
        ? `<ul class="notes">${rw.map(r => { const c = cardById(r.cardId); return `<li><button class="note" data-act="open" data-id="${esc(r.cardId)}"><span class="note-date">${shortDate(r.date)}</span><span class="note-text">${esc(r.text)}</span>${c ? `<span class="note-src">원문 · ${esc(c.text)}</span>` : ''}</button></li>`; }).join('')}</ul>`
        : empty('아직 바꿔 쓴 문장이 없어요. 루틴의 ‘내 말로 바꾸기’에서 쓴 문장이 여기에 모여요.');
    } else {
      body = its.length
        ? `<ul class="notes">${its.map(i => { const c = cardById(i.cardId); return `<li><button class="note" data-act="open" data-id="${esc(i.cardId)}"><span class="note-date">${shortDate(i.date)}${intentLabel(i) ? ` · ${esc(intentLabel(i))}` : ''}</span>${c ? `<span class="note-text">${esc(c.text)}</span>` : ''}${i.note ? `<span class="note-src">${esc(i.note)}</span>` : ''}${intentPill(i)}</button></li>`; }).join('')}</ul>`
        : empty('아직 실천 기록이 없어요. 루틴 끝에 오늘 누구에게 쓸지 정하면 여기에 남아요.');
    }
    return `${head('내가 쓰고, 실제로 써 본', '내 노트')}
      <div class="seg" role="group" aria-label="보기"><button data-act="notes-mode" data-id="rewrites" aria-pressed="${ui.notesMode === 'rewrites'}">바꿔 쓴 문장 ${rw.length}</button><button data-act="notes-mode" data-id="intents" aria-pressed="${ui.notesMode === 'intents'}">실천 기록 ${its.length}</button></div>
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
    return [`<p class="eyebrow">${title}</p><h2 class="step-title">${it.who ? `${esc(it.who)}에게 ` : ''}이 말을 써 보기로 했어요. 써 봤나요?</h2>${it.when ? `<p class="situation">${esc(it.when)}</p>` : ''}<blockquote class="quote">${marked(c, 'mark')}</blockquote><p class="hint">실제로 입 밖에 낸 문장이 가장 오래 남아요.</p>`,
      '<div class="duo"><button class="btn" data-act="check" data-id="notyet">아직이요</button><button class="btn primary" data-act="check" data-id="used">써 봤어요</button></div>'];
  }
  function reviewStep(s, c, p) {
    const reviews = p.steps.filter(x => x.t === 'review');
    const idx = p.steps.slice(0, p.pos + 1).filter(x => x.t === 'review').length;
    const body = `<p class="eyebrow">복습 ${idx} / ${reviews.length} · ${esc(catName(c))}</p>
      <p class="situation">${esc(c.situation || '언제 쓰려고 모아 둔 문장인지 떠올려 보세요.')}</p>
      ${c.avoid ? `<div class="avoid"><span class="label">이렇게 말하는 대신</span><p>${esc(c.avoid)}</p></div>` : ''}
      <div class="better"><span class="label">이렇게 말해 보세요</span><blockquote class="quote">${ui.revealed ? marked(c, 'mark', true) : marked(c, 'blank')}</blockquote></div>
      ${ui.revealed
        ? (c.word && c.word.term ? `<p class="hint">핵심 단어 · <b>${esc(c.word.term)}</b> — ${esc(c.word.meaning)}</p>` : '')
        : '<p class="hint">빈칸에 들어갈 말을 먼저 소리 내어 말해 본 뒤 확인하세요.</p>'}`;
    if (!ui.revealed) return [body, '<button class="btn primary wide" data-act="reveal">정답 확인</button>'];
    if (s.again) return [body, '<button class="btn primary wide" data-act="next">다음</button>'];
    const pr = S.progress[c.id] || { box: 0 };
    const when = g => { const n = INTERVALS[nextBox(pr, g)]; return n === 1 ? '내일' : `${n}일 뒤`; };
    return [body, `<div class="grades" role="group" aria-label="얼마나 기억났나요?">
        <button class="grade again" data-act="grade" data-id="again">다시<small>오늘 한 번 더</small></button>
        <button class="grade" data-act="grade" data-id="hard">헷갈림<small>${when('hard')}</small></button>
        <button class="grade good" data-act="grade" data-id="good">기억남<small>${when('good')}</small></button>
      </div>`];
  }
  function learnStep(c) {
    return [`<p class="eyebrow">오늘의 문장 · ${esc(catName(c))}</p>${cardBlock(c, '오늘의 단어')}
      <div class="row"><button class="btn" data-act="read">소리 내어 읽기 <span class="reads" aria-label="${ui.reads}번 읽음">${[0, 1, 2].map(i => `<i class="${i < ui.reads ? 'on' : ''}"></i>`).join('')}</span></button>${speakBtn(c)}</div>
      <p class="hint">${ui.reads >= 3 ? '세 번 읽었어요. 입으로 말한 문장이 눈으로만 본 문장보다 오래 남아요.' : '실제로 그 사람 앞에서 말하듯, 천천히 세 번 읽어 보세요.'}</p>`,
      '<button class="btn primary wide" data-act="learned">다음</button>'];
  }
  function rewriteStep(c) {
    const who = defaultWho();
    return [`<p class="eyebrow">내 말로 바꾸기</p><h2 class="step-title">${who && who !== '나 자신' ? `내 ${esc(who)}에게` : '내가 실제로 말할 사람에게'} 맞게 바꿔 써 보세요.</h2><blockquote class="quote small">${esc(c.text)}</blockquote><label class="label" for="rewrite">내 문장</label><textarea id="rewrite" placeholder="이름, 상황, 내 말투를 넣어 보세요."></textarea><p class="hint">내 상황으로 다시 만든 문장은 그대로 외운 문장보다 훨씬 쉽게 떠올라요.</p>`,
      '<div class="duo"><button class="btn" data-act="next">건너뛰기</button><button class="btn primary" data-act="rewrite-save">저장하고 다음</button></div>'];
  }
  function intentStep(c) {
    return [`<p class="eyebrow">오늘의 실천</p><h2 class="step-title">오늘 누구에게 이 말을 써 볼까요?</h2><blockquote class="quote small">${esc(c.text)}</blockquote>
      <div class="chips" role="group" aria-label="대상">${D.contexts.map(x => WHO[x.id]).filter(Boolean).map(w => `<button class="chip" data-act="who" data-id="${esc(w)}" aria-pressed="${ui.who === w}">${esc(w)}</button>`).join('')}</div>
      <label class="label" for="intent-when">언제, 어디서? (선택)</label><input id="intent-when" type="text" placeholder="예) 저녁 훈련 끝나고 민준이에게">
      <p class="form-error" id="intent-err" hidden></p>
      <p class="hint">언제, 누구에게 쓸지 정해 두면 실제로 쓸 가능성이 높아져요. 내일 아침에 어땠는지 물어볼게요.</p>`,
      '<div class="duo"><button class="btn" data-act="next">오늘은 건너뛰기</button><button class="btn primary" data-act="intent-save">약속하기</button></div>'];
  }
  function doneStep(p) {
    const id = p.fresh[p.fresh.length - 1] || p.review[0];
    const c = id && cardById(id);
    const it = S.intents.find(i => i.date === p.date);
    return [`<div class="done-wrap"><p class="eyebrow">오늘의 모닝 완료 ${icon('check')}</p><p class="big-streak"><strong>${streak()}</strong>일 연속</p>${weekStrip(false)}
        ${c ? `<article class="deck">${HOLE}<p class="eyebrow">오늘의 문장</p><blockquote class="quote">${marked(c, 'mark')}</blockquote></article>` : ''}
        <p class="hint">${it ? `오늘의 약속 · ${esc(intentLabel(it))}. 내일 아침에 어땠는지 물어볼게요.` : '내일 아침, 오늘 배운 문장이 빈칸이 되어 돌아와요.'}</p></div>`,
      `<div class="duo">${c ? copyBtn(c, '문장 복사') : '<span></span>'}<button class="btn primary" data-act="close-session">홈으로</button></div><button class="link" data-act="more">새 문장 하나 더 배우기</button>`];
  }
  function stepView(s, p) {
    switch (s.t) {
      case 'check': return checkStep(s);
      case 'review': return reviewStep(s, cardById(s.id), p);
      case 'learn': return learnStep(cardById(s.id));
      case 'rewrite': return rewriteStep(cardById(s.id));
      case 'intent': return intentStep(cardById(s.id));
      default: return doneStep(p);
    }
  }

  /* ---------- 시작 안내 ---------- */
  function onboarding() {
    const sample = D.cards.find(c => c.cat === 'setback') || D.cards[0];
    const dots = `<div class="onb-dots" aria-hidden="true">${[0, 1, 2].map(i => `<i class="${i <= ui.onb ? 'on' : ''}"></i>`).join('')}</div>`;
    let body, actions;
    if (ui.onb === 0) {
      body = `<p class="eyebrow">애니띵 모닝</p>
        <h1 class="onb-title">하루 5분,<br>마음을 움직이는 문장 하나.</h1>
        <p class="lead">코치가 선수에게, 부모가 아이에게, 리더가 팀에게. 사람을 움직이는 말은 타고나는 게 아니라 연습으로 늘어요.</p>
        ${sample ? `<article class="deck">${HOLE}<p class="eyebrow">예시 · ${esc(catName(sample))}</p>${sample.avoid ? `<div class="avoid"><span class="label">이렇게 말하는 대신</span><p>${esc(sample.avoid)}</p></div>` : ''}<blockquote class="quote">${marked(sample, 'mark')}</blockquote></article>` : ''}
        <ol class="method">
          <li><span><b>비교하며 읽기</b>흔히 하는 말과 좋은 말을 나란히 봐요.</span></li>
          <li><span><b>떠올리기</b>1·2·4·7일… 간격을 두고 빈칸으로 복습해요.</span></li>
          <li><span><b>내 말로 바꾸기</b>내 상황, 내 말투로 다시 써요.</span></li>
          <li><span><b>실제로 써 보기</b>오늘 누구에게 쓸지 정하고, 다음 날 확인해요.</span></li>
        </ol>`;
      actions = '<button class="btn primary wide" data-act="onb-next">시작하기</button>';
    } else if (ui.onb === 1) {
      body = `<p class="eyebrow">1 / 2</p><h2 class="step-title">주로 누구에게 말을 하나요?</h2><p class="hint">여러 개 골라도 돼요. 고른 대상에 맞는 문장부터 배워요.</p>
        <div class="chips big" role="group" aria-label="대상">${D.contexts.map(x => `<button class="chip" data-act="onb-ctx" data-id="${x.id}" aria-pressed="${S.settings.contexts.includes(x.id)}">${esc(x.name)}</button>`).join('')}</div>`;
      actions = '<div class="duo"><button class="btn" data-act="onb-back">이전</button><button class="btn primary" data-act="onb-next">다음</button></div>';
    } else {
      body = `<p class="eyebrow">2 / 2</p><h2 class="step-title">하루에 몇 문장씩 배울까요?</h2>
        <div class="seg" role="group" aria-label="하루 새 문장">${[1, 2, 3].map(n => `<button data-act="onb-per" data-id="${n}" aria-pressed="${S.settings.newPerDay === n}">${n}문장</button>`).join('')}</div>
        <p class="hint">하루 1문장을 추천해요. 복습이 쌓이기 때문에 적게, 매일 하는 쪽이 오래 갑니다.</p>
        <label class="label" for="onb-time">연습할 시간</label><input id="onb-time" type="time" value="${esc(S.settings.time)}">
        <p class="hint">설정에서 이 시간으로 매일 캘린더 알림을 추가할 수 있어요.</p>`;
      actions = '<div class="duo"><button class="btn" data-act="onb-back">이전</button><button class="btn primary" data-act="onb-start">첫 루틴 시작</button></div>';
    }
    return `<div class="session-inner"><div class="session-top">${dots}</div><div class="session-body">${body}</div><div class="session-actions">${actions}</div></div>`;
  }

  /* ---------- 시트 ---------- */
  function cardSheet(c) {
    const st = status(c.id), pr = S.progress[c.id], fav = !!S.favs[c.id];
    const rws = S.rewrites.filter(r => r.cardId === c.id);
    const usedN = S.intents.filter(i => i.cardId === c.id && i.result === 'used').length;
    const meta = [`<span class="pill ${st}">${STATUS_LABEL[st]}</span>`];
    if (pr && pr.box < MASTERED_BOX) meta.push(`<span>다음 복습 ${pr.due <= today() ? '오늘' : shortDate(pr.due)}</span>`);
    if (usedN) meta.push(`<span>실전 ${usedN}회</span>`);
    const del = !c.custom ? '' : ui.confirm === 'delete:' + c.id
      ? `<div class="confirm"><p>이 문장과 복습 기록을 지울까요? 되돌릴 수 없어요.</p><div class="row"><button class="btn" data-act="cancel-confirm">취소</button><button class="btn danger solid" data-act="delete" data-id="${esc(c.id)}">지우기</button></div></div>`
      : `<button class="btn danger" data-act="ask-delete" data-id="${esc(c.id)}">이 문장 지우기</button>`;
    return `<div class="sheet-body">
      <p class="item-meta">${meta.join('')}</p>
      ${cardBlock(c, '핵심 단어')}
      <div class="row">${speakBtn(c)}${copyBtn(c)}<button class="btn" data-act="fav" data-id="${esc(c.id)}" aria-pressed="${fav}">${icon('star')}${fav ? '즐겨찾기 해제' : '즐겨찾기'}</button>${pr ? '' : `<button class="btn primary" data-act="enroll" data-id="${esc(c.id)}">학습에 추가</button>`}</div>
      ${rws.length ? `<section class="group"><h3>내가 바꿔 쓴 문장</h3>${rws.map(r => `<p class="mine-line">${esc(r.text)} <span class="note-date">${shortDate(r.date)}</span></p>`).join('')}</section>` : ''}
      <div><label class="label" for="card-note">메모</label><textarea id="card-note" data-id="${esc(c.id)}" placeholder="이 문장을 언제, 누구에게 쓰고 싶은지 적어 두세요.">${esc(S.notes[c.id] || '')}</textarea></div>
      ${del}
    </div>`;
  }
  function settingsSheet() {
    const s = S.settings;
    const imp = ui.confirm === 'import' && ui.pendingImport
      ? `<div class="confirm"><p>백업으로 바꿀까요? 배운 문장 ${Object.keys(ui.pendingImport.progress).length}개, 노트와 연속 기록이 들어 있어요. 지금 이 기기의 기록은 사라져요.</p><div class="row"><button class="btn" data-act="cancel-confirm">취소</button><button class="btn danger solid" data-act="apply-import">백업으로 바꾸기</button></div></div>`
      : '';
    const reset = ui.confirm === 'reset'
      ? '<div class="confirm"><p>배운 문장, 노트, 연속 기록이 모두 지워져요. 되돌릴 수 없어요.</p><div class="row"><button class="btn" data-act="cancel-confirm">취소</button><button class="btn danger solid" data-act="reset">모두 지우기</button></div></div>'
      : '<button class="btn danger" data-act="ask-reset">모든 기록 지우기</button>';
    return `<div class="sheet-body">
      <section class="group"><h3>주로 누구에게 말하나요?</h3><p class="hint">고른 대상에 맞는 문장이 먼저 나와요.</p><div class="chips">${D.contexts.map(x => `<button class="chip" data-act="ctx" data-id="${x.id}" aria-pressed="${s.contexts.includes(x.id)}">${esc(x.name)}</button>`).join('')}</div></section>
      <section class="group"><h3>하루 새 문장</h3><div class="seg" role="group" aria-label="하루 새 문장">${[1, 2, 3].map(n => `<button data-act="per-day" data-id="${n}" aria-pressed="${s.newPerDay === n}">${n}문장</button>`).join('')}</div><p class="hint">하루 1문장을 추천해요. 적게, 매일 하는 쪽이 오래 갑니다.</p></section>
      <section class="group"><h3>아침 알림</h3><div class="row"><label class="label" for="set-time">연습 시간</label><input id="set-time" type="time" value="${esc(s.time)}"><button class="btn" data-act="ics">캘린더에 매일 알림 추가</button></div><p class="hint">캘린더 파일을 받아 열면 매일 이 시간에 알림이 와요.</p></section>
      <section class="group"><h3>화면</h3><div class="seg" role="group" aria-label="화면">${[['system', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']].map(([v, n]) => `<button data-act="theme" data-id="${v}" aria-pressed="${(s.theme || 'system') === v}">${n}</button>`).join('')}</div></section>
      <section class="group"><h3>기록 백업</h3><p class="hint">기록은 이 기기에만 저장돼요. 기기를 바꾸기 전에 백업 파일을 저장해 두세요.</p><div class="row"><button class="btn" data-act="export">백업 파일 저장</button><button class="btn" data-act="import">백업 불러오기</button><input id="import-file" type="file" accept="application/json,.json" hidden></div>${imp}</section>
      <section class="group"><h3>처음부터 다시</h3>${reset}</section>
      <p class="about">애니띵 모닝 1.0 · 기본 문장 ${D.cards.length}개는 모두 이 앱을 위해 새로 쓴 문장이에요.</p>
    </div>`;
  }
  function addSheet() {
    const def = catById[ui.libFilter] ? ui.libFilter : (D.categories[0] && D.categories[0].id);
    return `<form id="add-form" class="form" novalidate>
      <p class="hint">책, 경기, 대화에서 만난 좋은 문장을 모아 두세요. 내일부터 복습에 나와요.</p>
      <label class="label" for="add-text">문장</label><textarea id="add-text" rows="3" placeholder="예) 결과보다 네가 버틴 시간을 먼저 말해 주고 싶어."></textarea>
      <label class="label" for="add-sit">언제 쓰나요? (선택)</label><input id="add-sit" type="text" placeholder="예) 시합에서 진 다음 날">
      <label class="label" for="add-cat">분류</label><select id="add-cat">${D.categories.map(c => `<option value="${c.id}"${c.id === def ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <label class="label" for="add-blank">복습할 때 가릴 핵심 구절 (선택)</label><input id="add-blank" type="text" placeholder="문장 안에 있는 말 그대로 적어 주세요">
      <label class="label" for="add-why">메모 (선택)</label><textarea id="add-why" rows="2" placeholder="어디서 들었는지, 왜 좋았는지"></textarea>
      <p class="form-error" id="add-error" hidden></p>
      <button class="btn primary wide" type="submit">저장하기</button>
    </form>`;
  }

  /* ---------- 그리기 ---------- */
  const root = $('app');
  root.innerHTML = '<main id="view" class="view"></main><nav id="tabs" class="tabs" aria-label="메뉴"></nav><div id="session" class="session" hidden></div><div id="sheet" class="sheet" hidden></div><div id="toast" class="toast" role="status" aria-live="polite" hidden></div>';
  const TABS = [['today', '오늘', 'sunrise'], ['library', '문장집', 'book'], ['words', '단어장', 'ring'], ['notes', '내 노트', 'pen']];

  function renderView() {
    const el = $('view');
    if (!S.settings.onboarded) { el.innerHTML = ''; return; }
    el.innerHTML = ({ today: viewToday, library: viewLibrary, words: viewWords, notes: viewNotes }[ui.view] || viewToday)();
  }
  function renderTabs() {
    const el = $('tabs');
    el.hidden = !S.settings.onboarded;
    el.innerHTML = `<div class="tabs-inner">${TABS.map(([id, label, ic]) => `<button class="tab" data-act="tab" data-id="${id}"${ui.view === id ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('')}</div>`;
  }
  function renderSession() {
    const el = $('session');
    if (!S.settings.onboarded) { el.hidden = false; el.innerHTML = onboarding(); return; }
    if (!ui.session) { el.hidden = true; el.innerHTML = ''; return; }
    const p = plan();
    if (!p.steps) p.steps = buildSteps(p);
    while (p.pos < p.steps.length - 1 && !stepValid(p.steps[p.pos])) p.pos++;
    const step = p.steps[p.pos];
    if (step.t === 'done' && !p.done) { p.done = true; S.days[p.date] = { done: true }; save(); }
    const total = p.steps.length;
    const pct = Math.round((p.pos / Math.max(1, total - 1)) * 100);
    const [body, actions] = stepView(step, p);
    el.hidden = false;
    el.innerHTML = `<div class="session-inner">
      <div class="session-top"><button class="icon-btn" data-act="close-session" aria-label="루틴 닫기">${icon('close')}</button><div class="progress" role="progressbar" aria-label="루틴 진행" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${p.pos + 1}"><span style="width:${pct}%"></span></div><span class="step-count">${p.pos + 1} / ${total}</span></div>
      <div class="session-body">${body}</div>
      <div class="session-actions">${actions}</div>
    </div>`;
    const key = p.date + ':' + p.pos;
    if (ui.stepKey !== key) { el.scrollTop = 0; ui.stepKey = key; }
  }
  function renderSheet() {
    const el = $('sheet');
    if (!ui.sheet) { el.hidden = true; el.innerHTML = ''; ui.sheetKey = ''; return; }
    let title = '', body = '';
    if (ui.sheet === 'card') {
      const c = cardById(ui.sheetId);
      if (!c) { ui.sheet = null; renderSheet(); return; }
      title = catName(c); body = cardSheet(c);
    } else if (ui.sheet === 'settings') { title = '설정'; body = settingsSheet(); }
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
  function speak(text) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = 0.95;
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
    toast(ok ? okMsg : '복사하지 못했어요. 문장을 길게 눌러 복사해 주세요.');
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
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Anything Morning//KO', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:anything-morning-${uid()}@anything-morning`, `DTSTAMP:${stamp}`, `DTSTART:${f(start)}`, 'DURATION:PT5M', 'RRULE:FREQ=DAILY',
      'SUMMARY:애니띵 모닝 · 오늘의 문장', 'DESCRIPTION:하루 5분\\, 마음을 움직이는 문장 하나.', ...url,
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
    S.custom.push({ id, cat: v('add-cat') || 'motivate', ctx: [], situation: v('add-sit'), avoid: '', text, blank, why: v('add-why'), word: null, custom: true, created: today() });
    learn(id); save();
    ui.sheet = null; ui.libFilter = 'mine'; render();
    toast('내 문장에 추가했어요. 내일부터 복습에 나와요.');
  }

  /* ---------- 동작 ---------- */
  const advance = () => {
    const p = plan();
    p.pos = Math.min(p.pos + 1, p.steps.length - 1);
    resetStepUi(); save(); renderSession();
  };
  const ACTIONS = {
    tab(id) { ui.view = id; render(); window.scrollTo(0, 0); },
    settings() { openSheet('settings'); },
    'close-sheet'() { ui.sheet = null; ui.confirm = null; ui.pendingImport = null; render(); },
    open(id) { openSheet('card', id); },
    find(id) { ui.view = 'library'; ui.libFilter = id; ui.q = ''; ui.libCtx = ''; render(); window.scrollTo(0, 0); },
    'lib-filter'(id) { ui.libFilter = id; renderView(); },
    'words-mode'(id) { ui.wordsMode = id; renderView(); },
    'notes-mode'(id) { ui.notesMode = id; renderView(); },
    fav(id) { if (S.favs[id]) delete S.favs[id]; else S.favs[id] = true; save(); renderView(); renderSheet(); },
    add() { openSheet('add'); },
    start() { const p = plan(); if (!p.steps) p.steps = buildSteps(p); ui.session = true; resetStepUi(); save(); render(); },
    'close-session'() { ui.session = false; render(); },
    reveal() { ui.revealed = true; renderSession(); },
    grade(g) {
      const p = plan(), s = p.steps[p.pos];
      gradeCard(s.id, g);
      if (g === 'again') {
        // 바로 다시 보면 방금 본 답을 베끼게 되니, 남은 복습과 새 문장 뒤에 한 번 더 넣는다
        let i = p.pos + 1;
        while (i < p.steps.length && (p.steps[i].t === 'review' || p.steps[i].t === 'learn')) i++;
        p.steps.splice(i, 0, { t: 'review', id: s.id, again: true });
      }
      advance();
    },
    next() { advance(); },
    learned() { const s = curStep(); if (s) learn(s.id); advance(); },
    read() { ui.reads = Math.min(3, ui.reads + 1); renderSession(); },
    speak(id) { const c = cardById(id); if (c) speak(c.text); },
    copy(id) { const c = cardById(id); if (c) copyText(`“${c.text}”`); },
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
      S.rewrites.push({ id: uid(), date: today(), cardId: curStep().id, text: v });
      toast('내 노트에 저장했어요');
      advance();
    },
    who(w) {
      ui.who = ui.who === w ? '' : w;
      document.querySelectorAll('[data-act="who"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === ui.who)));
    },
    'intent-save'() {
      const when = (($('intent-when') && $('intent-when').value) || '').trim();
      if (!ui.who && !when) { const er = $('intent-err'); er.hidden = false; er.textContent = '누구에게 쓸지 하나만 골라 주세요.'; return; }
      const p = plan();
      S.intents = S.intents.filter(i => i.date !== p.date);
      S.intents.push({ id: uid(), date: p.date, cardId: curStep().id, who: ui.who, when, result: null, note: '' });
      advance();
    },
    more() {
      const p = plan();
      const ids = pickNew(1, p.fresh);
      if (!ids.length) { toast('기본 문장을 모두 배웠어요. 문장집에서 내 문장을 추가해 보세요.'); return; }
      if (!p.steps) p.steps = buildSteps(p);
      p.fresh.push(ids[0]);
      p.steps.push({ t: 'learn', id: ids[0] }, { t: 'done' });
      p.pos = p.steps.length - 2;
      ui.session = true; resetStepUi(); save(); render();
    },
    enroll(id) { learn(id); save(); toast('학습에 추가했어요. 내일 복습에 나와요.'); renderSheet(); renderView(); },
    'ask-delete'(id) { ui.confirm = 'delete:' + id; renderSheet(); },
    'cancel-confirm'() { ui.confirm = null; ui.pendingImport = null; renderSheet(); },
    delete(id) {
      S.custom = S.custom.filter(c => c.id !== id);
      delete S.progress[id]; delete S.favs[id]; delete S.notes[id];
      if (S.plan) { S.plan.review = S.plan.review.filter(x => x !== id); S.plan.fresh = S.plan.fresh.filter(x => x !== id); }
      ui.sheet = null; ui.confirm = null; save(); render();
      toast('문장을 지웠어요');
    },
    ctx(id) {
      const a = S.settings.contexts;
      S.settings.contexts = a.includes(id) ? a.filter(x => x !== id) : a.concat(id);
      refreshFresh(); save(); renderView(); renderSheet();
    },
    'per-day'(n) { S.settings.newPerDay = Number(n); refreshFresh(); save(); renderView(); renderSheet(); },
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
      S = ui.pendingImport; ui.pendingImport = null; ui.confirm = null; ui.sheet = null; ui.session = false;
      save(); applyTheme(); render();
      toast('백업을 불러왔어요');
    },
    'ask-reset'() { ui.confirm = 'reset'; renderSheet(); },
    reset() {
      S = fresh(); ui.sheet = null; ui.confirm = null; ui.session = false; ui.onb = 0; ui.view = 'today';
      save(); applyTheme(); render();
    },
    'onb-next'() { ui.onb = Math.min(2, ui.onb + 1); save(); renderSession(); },
    'onb-back'() { ui.onb = Math.max(0, ui.onb - 1); renderSession(); },
    'onb-ctx'(id) {
      const a = S.settings.contexts;
      S.settings.contexts = a.includes(id) ? a.filter(x => x !== id) : a.concat(id);
      renderSession();
    },
    'onb-per'(n) { S.settings.newPerDay = Number(n); renderSession(); },
    'onb-start'() {
      const t = $('onb-time');
      if (t && /^\d{2}:\d{2}$/.test(t.value)) S.settings.time = t.value;
      S.settings.onboarded = true; S.plan = null;
      const p = plan(); p.steps = buildSteps(p);
      ui.session = true; resetStepUi(); save(); render();
    }
  };

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || !ACTIONS[t.dataset.act]) return;
    e.preventDefault();
    ACTIONS[t.dataset.act](t.dataset.id, t);
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'lib-q') { ui.q = t.value; $('lib-list').innerHTML = libList(); }
    else if (t.id === 'card-note') { if (t.value.trim()) S.notes[t.dataset.id] = t.value; else delete S.notes[t.dataset.id]; save(); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'lib-ctx') { ui.libCtx = t.value; $('lib-list').innerHTML = libList(); }
    else if (t.id === 'set-time' || t.id === 'onb-time') { if (/^\d{2}:\d{2}$/.test(t.value)) { S.settings.time = t.value; save(); } }
    else if (t.id === 'import-file') readImport(t.files && t.files[0]);
  });
  document.addEventListener('submit', e => { if (e.target.id === 'add-form') { e.preventDefault(); saveCustom(); } });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (ui.sheet) ACTIONS['close-sheet']();
    else if (ui.session && S.settings.onboarded) ACTIONS['close-session']();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.plan && S.plan.date !== today()) { ui.session = false; render(); }
  });

  applyTheme();
  render();

  if ('serviceWorker' in navigator && !inFrame && /^(https:|http:\/\/localhost)/.test(location.href)) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* 오프라인 저장 없이도 동작한다 */ }
  }
})();
