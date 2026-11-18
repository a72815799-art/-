// 오프라인 HTML 파일에서 AI 연결: 요청 복사와 답변 붙여넣기, 개인 API 키 저장·연결 테스트·코칭.
// 외부 AI 서버는 page.route로 가로채 모의 응답을 준다(실제 네트워크 요청 없음).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
execSync('node scripts/bundle.mjs', { cwd: root, stdio: 'ignore' });
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const URL = pathToFileURL(join(root, 'dist', `mmpi-academy-v${version}.html`)).href;

const browser = await chromium.launch();
let passed = 0; const ok = n => { passed++; console.log('  ✓', n); };
const open = async (hash) => {
  const ctx = await browser.newContext(); await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const hits = [];
  await page.route('https://generativelanguage.googleapis.com/**', async r => {
    const req = r.request(); hits.push({ url: req.url(), key: req.headers()['x-goog-api-key'], body: req.postData() });
    if (req.headers()['x-goog-api-key'] !== 'GOOD') return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'API key not valid' } }) });
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '## 코칭\n연결되었습니다. 잘한 점: **타당도 판단**' }] }, finishReason: 'STOP' }] }) });
  });
  await page.goto(URL + hash); await page.waitForTimeout(300);
  return { page, ctx, errors, hits };
};

// 1) 요청 복사 → 붙여넣기 → 정리 보기
{
  const { page, ctx, errors } = await open('#case-c01');
  await page.fill('textarea >> nth=0', '타당도는 양호하다. 2-7 코드타입으로 우울과 불안이 함께 나타나며 반추와 자기비난이 두드러진다. 자살 위험 평가가 필요하다.');
  await page.click('#coachcopy'); await page.waitForTimeout(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clip, /수련생/, '복사된 요청에 수련생 답안이 들어 있어야 한다');
  assert.match(await page.textContent('#coachout'), /요청이 복사되었습니다/);
  await page.fill('#coachout .paste-in', '### 총평\n**좋습니다**');
  await page.click('#coachout .paste-show');
  assert.equal(await page.textContent('#coachout .paste-out b'), '좋습니다');
  assert.deepEqual(errors, []);
  ok('사례 코칭 요청 복사와 답변 붙여넣기');
  await ctx.close();
}

// 2) 분석기·슈퍼바이저 요청 복사
{
  const { page, ctx, errors } = await open('#analyzer');
  await page.click('#azcopy'); await page.waitForTimeout(200);
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /MMPI/);
  await page.goto(URL + '#mentor'); await page.waitForTimeout(200);
  await page.fill('#mq', 'F 척도가 높으면 무엇을 먼저 보나요?');
  await page.click('#mcopy'); await page.waitForTimeout(200);
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /F 척도가 높으면/);
  assert.ok(await page.$('#mpaste .paste-in'));
  assert.deepEqual(errors, []);
  ok('분석기·슈퍼바이저 요청 복사');
  await ctx.close();
}

// 3) 개인 API 키: 잘못된 키 → 실패 안내, 올바른 키 → 저장 → 코칭이 해당 AI로
{
  const { page, ctx, errors, hits } = await open('#ai-connect');
  await page.click('#ac-prov button[data-p="gemini"]');
  assert.equal(await page.inputValue('#ac-model'), 'gemini-2.5-flash');
  await page.fill('#ac-key', 'WRONG'); await page.click('#ac-test');
  await page.waitForFunction(() => /연결 실패/.test(document.getElementById('ac-msg').textContent));
  assert.match(await page.textContent('#ac-msg'), /API 키가 올바르지/);
  await page.fill('#ac-key', 'GOOD'); await page.click('#ac-test');
  await page.waitForFunction(() => /연결 성공/.test(document.getElementById('ac-msg').textContent));
  await page.click('#ac-save');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mmpi.ai')));
  assert.equal(saved.provider, 'gemini'); assert.equal(saved.key, 'GOOD');
  await page.goto(URL + '#case-c01'); await page.waitForTimeout(300);
  assert.ok(await page.isVisible('#coach'), '키를 저장하면 AI 코칭 버튼이 나타난다');
  await page.fill('textarea >> nth=0', '타당도는 양호하다. 2-7 코드타입으로 우울과 불안이 함께 나타나며 반추와 자기비난이 두드러진다.');
  await page.click('#coach');
  await page.waitForFunction(() => /타당도 판단/.test(document.getElementById('coachout').textContent), null, { timeout: 5000 });
  assert.ok(hits.at(-1).body.includes('수련생'), '코칭 요청이 외부 AI로 전송');
  // 키 지우기
  await page.goto(URL + '#ai-connect'); await page.waitForTimeout(200);
  await page.click('#ac-del');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mmpi.ai')).key), '');
  const sync = await page.evaluate(() => Object.keys(localStorage));
  assert.ok(sync.includes('mmpi.ai'));
  assert.deepEqual(errors, []);
  ok('개인 API 키: 연결 테스트(실패·성공), 저장, 코칭 연결, 키 지우기');
  await ctx.close();
}

await browser.close();
console.log(`AI 연결 종단 테스트 ${passed}개 통과`);
