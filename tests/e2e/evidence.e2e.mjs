// 연구 근거 화면 종단 테스트: 쟁점 목록 → 쟁점 상세 → 인용을 눌러 문헌 목록으로, 사례 근거 노트, 척도 사전의 근거 연결.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
execSync('node scripts/preview.mjs', { cwd: root, stdio: 'ignore' });
const URL = pathToFileURL(join(root, 'dist', 'index.html')).href;
const browser = await chromium.launch();
let passed = 0; const ok = n => { passed++; console.log('  ✓', n); };
const ctx = await browser.newContext(); const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('mmpi.prog', JSON.stringify({ mods: {}, quiz: {}, cases: { c05: { score: 40, at: 1 } } })));

await page.goto(URL + '#evidence'); await page.waitForTimeout(300);
const n = await page.$$eval('#evbody a.card-link', a => a.length);
assert.ok(n >= 10, `쟁점 ${n}개`);
await page.click('#evbody a.card-link >> nth=0'); await page.waitForTimeout(200);
assert.match(page.url(), /#ev-overreport$/);
assert.match(await page.textContent('h1'), /과대보고/);
const ref = await page.getAttribute('a.cite >> nth=0', 'data-ref');
await page.click('a.cite >> nth=0'); await page.waitForTimeout(400);
assert.match(page.url(), /#refs$/);
assert.ok(await page.isVisible(`#ref-${ref}`), '인용한 문헌으로 이동');
ok('쟁점 목록 → 상세 → 인용 → 문헌 목록');

await page.fill('#rq', 'Munley'); await page.waitForTimeout(100);
assert.equal(await page.$$eval('#rlist .ref', r => r.length), 2);
await page.click('#evseg button[data-t="videos"]');
assert.ok(await page.$$eval('#evbody a.card-link', a => a.length) >= 5);
assert.match(await page.textContent('#evbody'), /직접 만드는 짧은 강의 영상/);
ok('문헌 검색, 영상 자료와 영상 대본');

await page.goto(URL + '#case-c05'); await page.waitForTimeout(300);
await page.click('#model'); await page.waitForTimeout(200);
assert.match(await page.textContent('#modelout'), /근거 노트/);
assert.ok(await page.$$eval('#modelout a.cite', a => a.length) >= 6);
ok('사례 근거 노트');

await page.goto(URL + '#scales'); await page.waitForTimeout(300);
await page.fill('#sq', 'Fp'); await page.waitForTimeout(100);
await page.click('details.scale-card >> nth=0');
assert.match(await page.textContent('details.scale-card >> nth=0'), /연구 근거/);
ok('척도 사전의 연구 근거 연결');

assert.deepEqual(errors, []);
await browser.close();
console.log(`연구 근거 종단 테스트 ${passed}개 통과`);
