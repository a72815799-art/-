// 학습 효과 화면 브라우저 종단 테스트: 사전·사후 평가, 오늘의 복습, AI 채점 신뢰도, 운영자 연구 데이터 내보내기.
// claude.ai의 sample(AI)·db·user·downloads 기능을 모의 객체로 대신한다.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
execSync('node scripts/preview.mjs', { cwd: root, stdio: 'ignore' });
const URL = pathToFileURL(join(root, 'dist', 'index.html')).href;

function mock({ admin, store }) {
  const S = store; const clone = x => JSON.parse(JSON.stringify(x));
  const db = { doc: p => ({ get: async () => ({ exists: p in S, data: () => clone(S[p]) }), set: async d => { S[p] = clone(d); } }),
    collection: p => ({ get: async () => ({ docs: Object.keys(S).filter(k => k.startsWith(p + '/') && k.split('/').length === 2).map(k => ({ id: k.split('/')[1], exists: true, data: () => clone(S[k]) })) }) }) };
  const user = { id: async () => admin ? 'u_owner' : 'u_s1', canEdit: async () => admin, can: async () => true, profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: i }])) };
  // 모의 AI 채점: 답안 길이에 비례한 점수(우수 > 보통 > 미흡)에 약간의 흔들림
  let calls = 0;
  const sample = async () => ({ text: '' });
  sample.json = async (prompt) => { calls++; const part = prompt.split('[수련생 답안]')[1] || ''; const len = part.replace(/\(작성하지 않음\)/g, '').length;
    const base = Math.max(0, Math.min(5, Math.round(len / 160))); const jit = calls % 3 === 0 ? -1 : 0;
    return Object.fromEntries(['validity','code','elaboration','integration','context','diagnosis','risk','treatment','language'].map(k => [k, Math.max(0, base + jit)])); };
  window.__saved = [];
  const downloads = { save: async ({ filename, data }) => { window.__saved.push({ filename, data: String(data) }); return { status: 'saved' }; } };
  window.__store = S;
  window.claude = { use: async n => ({ db, user, sample, downloads })[n] || null };
}

const browser = await chromium.launch();
let passed = 0; const ok = n => { passed++; console.log('  ✓', n); };
const open = async (opts, hash, local) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(mock, opts);
  if (local) await page.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, local);
  await page.goto(URL + hash); await page.waitForTimeout(500); return { page, ctx, errors };
};
const answerAll = async (page, pickCorrect) => {
  const n = await page.$$eval('#pp .q', qs => qs.length);
  for (let i = 0; i < n; i++) await page.click(`#pp .q[data-i="${i}"] .opts button:nth-child(${pickCorrect ? 1 : 2})`);
};
let store = {};

// 1) 사전 평가 → 결과, 사후 평가 → 비교, 다른 형 배정
{
  const { page, ctx, errors } = await open({ admin: false, store }, '#research');
  await page.click('#pp-start');
  assert.equal(await page.$$eval('#pp .q', q => q.length), 16);
  assert.ok(await page.$eval('#pp-submit', b => b.disabled), '모두 답하기 전에는 제출 불가');
  await answerAll(page, false); await page.click('#pp-submit'); await page.waitForTimeout(200);
  assert.match(await page.textContent('#pp'), /사전 평가 결과/);
  await page.click('#pp-post'); await answerAll(page, true); await page.click('#pp-submit'); await page.waitForTimeout(200);
  assert.match(await page.textContent('#pp'), /사전 → 사후 비교/);
  const pp = await page.evaluate(() => JSON.parse(localStorage.getItem('mmpi.prog')).prepost);
  assert.notEqual(pp.pre.form, pp.post.form, '사전과 사후는 서로 다른 평행형');
  await page.check('#pp-consent'); await page.waitForTimeout(2600);
  store = await page.evaluate(() => window.__store);
  assert.equal(store['results/u_s1'].consent, true);
  assert.ok(store['results/u_s1'].prepost.post, '결과 요약에 사후 점수가 있어야 한다');
  assert.ok(!('answers' in store['results/u_s1'].prepost.pre), '결과 요약에 문항별 답은 없어야 한다');
  assert.deepEqual(errors, []);
  ok('사전 → 사후 평가, 평행형 배정, 동의, 결과 요약 저장');
  await ctx.close();
}

// 2) 오늘의 복습: 틀린 퀴즈가 복습에 나오고, 맞히면 사라진다
{
  const local = { 'mmpi.prog': JSON.stringify({ mods: {}, quiz: { 0: false, 1: true }, cases: {} }), 'mmpi.quizLv': '"R"' };
  const { page, ctx, errors } = await open({ admin: false, store: {} }, '#quiz', local);
  assert.match(await page.textContent('#qseg'), /오늘의 복습 \(1\)/);
  assert.equal(await page.$$eval('#qs .q', q => q.length), 1);
  const c = await page.evaluate(() => QUIZ[0].c);
  await page.click(`#qs .q .opts button[data-j="${c}"]`);
  assert.match(await page.textContent('#qs .ex'), /다음 복습: 내일/);
  assert.match(await page.textContent('#qseg'), /오늘의 복습 \(0\)/);
  assert.deepEqual(errors, []);
  ok('틀린 퀴즈의 간격 반복 복습');
  await ctx.close();
}

// 3) AI 채점 신뢰도: 반복 채점 → ICC·변별력, 사람 채점 → 가중 카파, CSV 저장
{
  const { page, ctx, errors } = await open({ admin: false, store: {} }, '#reliability');
  await page.selectOption('#rl-k', '2');
  await page.click('#rl-run');
  await page.waitForFunction(() => /완료/.test(document.getElementById('rl-msg').textContent), null, { timeout: 15000 });
  const runs = await page.evaluate(() => JSON.parse(localStorage.getItem('mmpi.airel')).length);
  assert.equal(runs, 12, '기준 답안 6개 × 2회');
  const txt = await page.textContent('#rl-res');
  assert.match(txt, /일관성 ICC\(1,1\)/);
  const rho = await page.$eval('#rl-res .grid3 .panel:nth-child(2) .num', e => e.textContent);
  assert.ok(+rho > 0.8, `변별력 ρ=${rho}: 우수·보통·미흡 순서를 재현해야 한다`);
  // 사람 채점 입력(첫 답안)
  const first = await page.$('#rl-res details.q'); await first.click('summary');
  for (const sel of await first.$$('select[data-k]')) await sel.selectOption('4');
  await page.waitForTimeout(200);
  assert.match(await page.textContent('#rl-res .grid3 .panel:nth-child(3)'), /답안 1개/);
  await page.click('#rl-csv'); await page.waitForTimeout(200);
  const saved = await page.evaluate(() => window.__saved);
  assert.equal(saved[0].filename, 'ai-grading-reliability.csv');
  assert.ok(saved[0].data.includes('타당도 판단'));
  assert.deepEqual(errors, []);
  ok('AI 채점 반복 실행, ICC·변별력·사람 채점 일치, CSV 저장');
  await ctx.close();
}

// 4) 운영자: 연구 데이터 통계와 익명 CSV(동의자만)
{
  const mk = (a, b, consent) => ({ v: 1, mods: ['m01'], quiz: {}, cases: {}, labQuiz: { n: 0, ok: 0 }, consent, prepost: { pre: { form: 'A', pct: a, domains: {} }, post: { form: 'B', pct: b, domains: {} } } });
  store['results/u_s2'] = mk(40, 70, true); store['results/u_s3'] = mk(60, 65, false); store['results/u_s4'] = mk(30, 60, true);
  const { page, ctx, errors } = await open({ admin: true, store }, '#class');
  await page.waitForSelector('#rs-csv:not([hidden])');
  assert.match(await page.textContent('#cl-admin'), /사전·사후 모두 응시/);
  await page.click('#rs-csv'); await page.waitForTimeout(200);
  const saved = await page.evaluate(() => window.__saved);
  const csv = saved[0].data; const lines = csv.trim().split('\n');
  assert.equal(lines.length, 1 + 3, '동의한 3명(u_s1, u_s2, u_s4)만');
  assert.ok(!/u_s\d/.test(csv), 'CSV에 학생 id가 없어야 한다');
  assert.match(await page.textContent('#cl-stats'), /우리 반 학습 효과/);
  assert.deepEqual(errors, []);
  ok('운영자: 대응표본 통계, 동의자만의 익명 CSV, 학생 화면의 반 학습 효과');
  await ctx.close();
}

await browser.close();
console.log(`학습 효과 종단 테스트 ${passed}개 통과`);
