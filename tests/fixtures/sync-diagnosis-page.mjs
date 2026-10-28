import fs from 'node:fs';
import path from 'node:path';
export function diagnosisPage(root){
  const app=fs.readFileSync(path.join(root,'studio/app.html'),'utf8');
  const styles=[...app.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g),...app.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)].map(m=>m[0]).join('\n');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<link rel="stylesheet" href="sync-diagnosis.css"><style>body{margin:0}#fixture-result{white-space:pre-wrap}</style></head><body><button id="psDiagOpen">진단 보기</button><span id="psDiagLine"></span><button id="fixture-run">검증 실행</button><pre id="fixture-result"></pre><script src="sync-diagnosis.js"></script><script src="sync-diagnosis-ui.js"></script><script src="/tests/fixtures/sync-diagnosis-preview.js"></script></body></html>`;
}
