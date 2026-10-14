// 커뮤니티 «프로세스» 칸의 사본(studio/packs/)을 다시 만든다.
//   node scripts/proc-snapshot.mjs <훈련 세션 사이트의 packs 폴더 | https://…/packs/>
// 앱은 평소 훈련 세션 사이트에서 읽고, 그 사이트가 닫혀 있으면 이 사본을 읽는다(community.html PROC_LOCAL).
// 사본에는 목록(index.json) · 팩(NN.json, 그림 칸은 뺀다 — 앱은 팩 안의 그림을 쓰지 않는다) · 카드 그림(thumbs/NN-K.svg)만 둔다.
// 그림은 우리 사이트에서 열리는 파일이 된다 — 실행되는 것·바깥 주소가 하나라도 있으면 멈춘다.
// 3.018 — 앱이 장면을 보강한 세션(지금 사본 목록의 own:1 · scripts/proc-scenes.mjs)은 덮지 않는다: 그 줄과 팩·그림을 그대로 둔다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'studio', 'packs');

export function svgProblem(svg) {
  if (typeof svg !== 'string' || !/^\s*<svg[\s>]/i.test(svg)) return 'not an svg';
  if (/<\s*(script|foreignObject|iframe|object|embed|use|image|animate|set|style|link|a)\b/i.test(svg)) return 'active or linking element';
  if (/\son[a-z]+\s*=/i.test(svg)) return 'event handler';
  if (/(?:href|src)\s*=|url\(\s*['"]?\s*(?!#)|javascript:|data:/i.test(svg)) return 'address';
  return '';
}
export function stripThumbs(v) {
  if (Array.isArray(v)) return v.map(stripThumbs);
  if (!v || typeof v !== 'object') return v;
  const o = {};
  for (const k of Object.keys(v)) if (k !== 'thumb') o[k] = stripThumbs(v[k]);
  return o;
}
const nn = n => (n < 10 ? '0' : '') + n;
/* 사이트 목록에 지금 사본의 보강 세션(own:1)을 얹는다 — 같은 호는 사본의 줄, 사이트에 없는 보강 세션도 남긴다 */
export function keepOwn(prev, next) {
  const own = (prev && Array.isArray(prev.sessions) ? prev.sessions : []).filter(s => s && s.own === 1);
  const byN = new Map(own.map(s => [s.n, s]));
  const sessions = next.sessions.map(s => byN.get(s.n) || s);
  for (const s of own) if (!sessions.includes(s)) sessions.push(s);
  sessions.sort((a, b) => a.n - b.n);
  return { ...next, sessions };
}

async function reader(from) {
  if (/^https:\/\//.test(from)) {
    const base = from.endsWith('/') ? from : from + '/';
    return async rel => { const r = await fetch(base + rel, { redirect: 'error' }); if (!r.ok) throw Error(rel + ' → ' + r.status); return r.text(); };
  }
  return async rel => fs.readFileSync(path.join(from, rel), 'utf8');
}

async function main() {
  const from = process.argv[2];
  if (!from) throw Error('어디서 읽을지 적어 주세요 — packs 폴더나 https://…/packs/');
  const read = await reader(from);
  const site = JSON.parse(await read('index.json'));
  if (site.type !== 'process-studio-pack-index' || !Array.isArray(site.sessions) || !site.sessions.length) throw Error('index.json 모양이 다릅니다');
  let prev = null; try { prev = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8')); } catch (_) {}
  const index = keepOwn(prev, site);
  const files = new Map([['index.json', JSON.stringify(index)]]);
  for (const s of index.sessions) {
    if (s.own === 1) {   /* 보강한 세션 — 지금 사본의 팩·그림을 그대로 */
      files.set(nn(s.n) + '.json', fs.readFileSync(path.join(out, nn(s.n) + '.json'), 'utf8'));
      for (let k = 1; k <= s.trainings.length; k++) { const rel = 'thumbs/' + nn(s.n) + '-' + k + '.svg'; files.set(rel, fs.readFileSync(path.join(out, rel), 'utf8')); }
      continue;
    }
    if (!Number.isInteger(s.n) || s.n < 1 || s.n > 99 || !Array.isArray(s.trainings) || !s.trainings.length) throw Error('목록의 줄이 이상합니다: ' + JSON.stringify(s).slice(0, 80));
    const pack = JSON.parse(await read(nn(s.n) + '.json'));
    const d = pack && pack.type === 'process-studio-drillpack' && Array.isArray(pack.drills) && pack.drills.length === 1 ? pack.drills[0] : null;
    if (!d || !Array.isArray(d.trainings) || d.trainings.length !== s.trainings.length || !d.letter || d.letter.issue !== s.n) throw Error(nn(s.n) + '.json 이 목록과 다릅니다');
    files.set(nn(s.n) + '.json', JSON.stringify(stripThumbs(pack)));
    for (let k = 1; k <= s.trainings.length; k++) {
      const rel = 'thumbs/' + nn(s.n) + '-' + k + '.svg', svg = await read(rel), bad = svgProblem(svg);
      if (bad) throw Error(rel + ': ' + bad);
      files.set(rel, svg);
    }
  }
  fs.rmSync(out, { recursive: true, force: true });
  let bytes = 0;
  for (const [rel, text] of files) { const p = path.join(out, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); bytes += Buffer.byteLength(text); }
  console.log('세션 ' + index.sessions.length + ' · 파일 ' + files.size + ' · ' + (bytes / 1048576).toFixed(1) + 'MB → studio/packs/');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(String(e && e.message || e)); process.exit(1); });
