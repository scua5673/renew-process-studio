// 영어 번역 재기 — node scripts/i18n-coverage.mjs [--missing <영역>] [--write-baseline] [--json] [--base-only]
// --base-only 는 studio/i18n/en-*.js 없이 app.html 의 기본 사전만으로 잰다(전 · 후 견주기).
// 영역마다(그리고 전체) 뽑힌 한국어 글 중 영어가 있는 수. 기준(tests/i18n-baseline.json)은 --write-baseline 으로 다시 적는다.
import fs from 'node:fs';
import path from 'node:path';
import {root,coverage,extractAll,loadDictionaries,AREAS,OTHER_AREAS} from './i18n-lib.mjs';
const args=process.argv.slice(2),cov=coverage(extractAll(),loadDictionaries({packs:!args.includes('--base-only')}));
const table={};
for(const a of [...AREAS,...OTHER_AREAS]){const c=cov.areas[a];table[a]={total:c.total,translated:c.translated,untranslated:c.untranslated,pct:c.pct};}
table['app (9 areas)']={total:cov.app.total,translated:cov.app.translated,untranslated:cov.app.total-cov.app.translated,pct:cov.app.pct};
table['all']={total:cov.all.total,translated:cov.all.translated,untranslated:cov.all.total-cov.all.translated,pct:cov.all.pct};
if(args.includes('--json')){console.log(JSON.stringify(table));}
else console.table(table);
const mi=args.indexOf('--missing');
if(mi>=0){const a=args[mi+1];for(const s of (cov.areas[a]||{missing:[]}).missing)console.log(JSON.stringify(s));}
if(args.includes('--write-baseline')){
  const base={note:'node scripts/i18n-coverage.mjs --write-baseline — 영역마다 번역 안 된 글 수(늘면 시험이 막는다) · 앱 전체 번역 비율(내려가면 막는다)',areas:{},app:{total:cov.app.total,translated:cov.app.translated,pct:cov.app.pct}};
  for(const a of AREAS)base.areas[a]={total:cov.areas[a].total,untranslated:cov.areas[a].untranslated};
  fs.writeFileSync(path.join(root,'tests/i18n-baseline.json'),JSON.stringify(base,null,1)+'\n');
  console.log('wrote tests/i18n-baseline.json');
}
