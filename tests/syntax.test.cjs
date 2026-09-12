'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

for (const file of ['studio/app.html', 'studio/process.html', 'studio/scout.html', 'studio/idp.html', 'studio/board.html', 'start/index.html', 'start/idp.html', 'guide/index.html']) {
  test(`${file}: inline JavaScript parses`, () => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    let count = 0;
    for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(match[1])) continue;
      const type = match[1].match(/\btype\s*=\s*["']([^"']+)/i);
      if (type && !/^(?:text|application)\/javascript$/i.test(type[1])) continue;
      const line = source.slice(0, match.index).split('\n').length;
      new vm.Script(match[2], { filename: `${file}:${line}` });
      count++;
    }
    if (file.startsWith('studio/')) assert.ok(count > 0, 'inline application scripts must be discovered');
  });
}

for (const file of ['studio/storage.js', 'studio/sync.js', 'studio/review-training.js', 'studio/review-training-schedule.js', 'studio/idp-evidence.js', 'studio/first-work.js', 'studio/session-focus.js', 'studio/daily-effort.js', 'sw.js']) {
  test(`${file}: JavaScript parses`, () => {
    new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
  });
}

test('application and service worker use the same release version', () => {
  const app = fs.readFileSync(path.join(root, 'studio/app.html'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const build = app.match(/window\.PS_BUILD='([^']+)'/);
  const cache = worker.match(/const CACHE = 'process-([^']+)'/);
  assert.ok(build && cache, 'both release markers must exist');
  assert.equal(build[1], cache[1]);
});
