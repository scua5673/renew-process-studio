import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PS_PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.PS_TEST_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const build = fs.readFileSync(path.join(root, 'studio/app.html'), 'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
const out = process.env.PS_TEST_OUTPUT || path.join(root, 'test-results/guidance');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  let file;
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    file = path.resolve(root, '.' + pathname);
  } catch { response.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    const bytes = fs.readFileSync(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PS_CHROME_PATH ? { executablePath: process.env.PS_CHROME_PATH } : {}) });
  for (const spec of [
    { name: '375-phone', width: 375, height: 812, touch: true, mobile: true },
    { name: '768-tablet', width: 768, height: 600, touch: true },
    { name: '1100-tablet', width: 1100, height: 820, touch: true },
    { name: '1280-desktop', width: 1280, height: 900 }
  ]) {
    const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, hasTouch: !!spec.touch, isMobile: !!spec.mobile, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.stack || String(error)));
    await page.goto(base + '/studio/app.html' + (spec.mobile ? '?layout=mobile' : ''), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expected => window.PS_BUILD === expected && document.getElementById('guideOpen'), build);
    // Activate the shipped help handler without signing into an account. All help controls below use real pointer/keyboard input.
    await page.evaluate(() => document.getElementById('guideOpen').click());
    await page.locator('#guideOv').waitFor({ state: 'visible' });
    const languages = [];
    for (const lang of ['ko', 'ja', 'en', 'zh', 'es', 'pt']) {
      await page.locator(`#gdLangs button[data-l="${lang}"]`).click();
      const layout = await page.evaluate(lang => {
        const active = document.querySelector('#guideOv .gd-body .L.on');
        const body = document.querySelector('#guideOv .gd-body');
        const panel = document.querySelector('#guideOv .gd-panel');
        const rect = panel.getBoundingClientRect();
        const badAnchors = [...active.querySelectorAll('a[href^="#"]')].filter(a => {
          const id = decodeURIComponent(a.getAttribute('href').slice(1));
          return !active.contains(document.getElementById(id));
        }).map(a => a.getAttribute('href'));
        return { language: active.dataset.l, expected: lang, textLength: active.innerText.length, badAnchors,
          panelFits: rect.left >= -1 && rect.right <= innerWidth + 1,
          bodyFits: body.scrollWidth <= body.clientWidth + 1 };
      }, lang);
      assert.equal(layout.language, lang);
      assert.ok(layout.textLength > 300, 'the selected language contains a complete guide');
      assert.deepEqual(layout.badAnchors, []);
      assert.ok(layout.panelFits && layout.bodyFits, `${spec.name} ${lang}: help fits horizontally`);
      languages.push(layout);
    }
    await page.locator('#gdLangs button[data-l="ko"]').click();
    await page.screenshot({ path: path.join(out, `${spec.name}-help.png`) });
    await page.locator('#guideClose').click();
    await page.locator('#guideOv').waitFor({ state: 'hidden' });
    await page.evaluate(() => { localStorage.setItem('cs_lang', 'pt'); document.getElementById('guideOpen').click(); });
    assert.equal(await page.locator('#guideOv .gd-body .L.on').getAttribute('data-l'), 'pt');
    await page.keyboard.press('Escape');
    await page.locator('#guideOv').waitFor({ state: 'hidden' });

    const documents = [];
    for (const [name, url] of [['team-start', '/start/'], ['player-start', '/start/idp.html'], ['manual', '/guide/']]) {
      const response = await page.goto(base + url, { waitUntil: 'load' });
      assert.equal(response.status(), 200);
      const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        title: document.title, brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(a => {
          const id = decodeURIComponent(a.getAttribute('href').slice(1)); return id && !document.getElementById(id);
        }).map(a => a.getAttribute('href')) }));
      assert.ok(layout.scrollWidth <= layout.width + 1, `${name} fits at ${spec.name}`);
      assert.deepEqual(layout.brokenAnchors, []);
      await page.screenshot({ path: path.join(out, `${spec.name}-${name}.png`) });
      documents.push({ name, ...layout });
    }
    assert.deepEqual(errors, [], 'no uncaught application JavaScript errors');
    results.push({ viewport: spec.name, languages, documents, pageErrors: errors });
    await context.close();
  }
  fs.writeFileSync(path.join(out, 'guidance-results.json'), JSON.stringify({ ok: true, build, method: 'Isolated local Chrome; no accounts; all non-local requests blocked', results }, null, 2));
  console.log(JSON.stringify({ ok: true, output: out, viewports: results.map(r => r.viewport), languages: 6, documents: 3 }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
