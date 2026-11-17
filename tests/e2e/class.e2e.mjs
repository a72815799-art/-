// 클래스 모드 브라우저 종단 테스트 (Playwright 필요: npm run e2e).
// claude.ai의 db·user 기능을 메모리 모의 객체로 대신해, 실제 화면에서 동기화·권한·통계가 동작하는지 확인한다.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
execSync('node scripts/preview.mjs', { cwd: root, stdio: 'ignore' });
const URL = pathToFileURL(join(root, 'dist', 'index.html')).href;

// 페이지 안에서 실행되는 모의 플랫폼. 규칙: results는 운영자만 읽음, class/*는 운영자만 씀, data/users/<id>는 본인만.
function mockPlatform({ uid, admin, store, readonly }) {
  const S = store;
  const clone = x => JSON.parse(JSON.stringify(x));
  const canRead = p => !(p.startsWith('results/') && !admin && p !== 'results/' + uid) && !(p.startsWith('data/users/') && !p.startsWith('data/users/' + uid + '/'));
  const canWrite = p => !readonly && (p.startsWith('data/users/' + uid + '/') || p === 'results/' + uid || (admin && p.startsWith('class/')));
  const deny = () => Promise.reject({ code: 'invalid_argument', message: 'denied' });
  const db = {
    doc: p => ({ get: async () => ({ exists: canRead(p) && p in S, data: () => canRead(p) ? clone(S[p]) : undefined }),
                 set: async d => { if (!canWrite(p)) return deny(); S[p] = clone(d); } }),
    collection: p => ({ get: async () => ({ docs: Object.keys(S).filter(k => k.startsWith(p + '/') && k.split('/').length === p.split('/').length + 1 && canRead(k)).map(k => ({ id: k.split('/').pop(), exists: true, data: () => clone(S[k]) })) }) }),
  };
  const user = { id: async () => uid, canEdit: async () => admin, can: async n => n === 'data.write' ? !readonly : null, profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: '학생-' + i.slice(-1) }])) };
  window.__store = S;
  window.claude = { use: async n => n === 'db' ? db : n === 'user' ? user : null };
}

const browser = await chromium.launch();
async function open(opts, hash = '#home', localState) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(mockPlatform, opts);
  if (localState) await page.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, localState);
  await page.goto(URL + hash);
  await page.waitForFunction(() => { const el = document.getElementById('sync'); return el && !el.hidden && !/연결 중/.test(el.textContent); });
  return { page, ctx, errors };
}
const settle = p => p.waitForTimeout(2600); // 저장은 2초 디바운스
let store = {};
let passed = 0; const ok = name => { passed++; console.log('  ✓', name); };

// 1) 학생 A가 기기 1에서 사례를 제출한다
{
  const { page, ctx, errors } = await open({ uid: 'u_a', admin: false, store }, '#case-c01');
  assert.equal(await page.textContent('#sync'), '동기화됨');
  await page.fill('#a-validity', '타당한 프로파일이다. VRIN TRIN 정상, 솔직하게 보고했다.');
  await page.fill('#a-code', '7-2 코드, 잘 정의됨. 불안과 우울, 완벽주의와 반추.');
  await page.fill('#a-risk', '자살사고를 직접 평가한다.');
  await page.click('#check');
  await settle(page);
  store = await page.evaluate(() => window.__store);
  assert.ok(store['data/users/u_a/progress'], '개인 기록이 저장되어야 한다');
  assert.ok(store['results/u_a'].cases.c01.score > 0, '결과 요약이 저장되어야 한다');
  assert.ok(!JSON.stringify(store['results/u_a']).includes('완벽주의와 반추'), '결과 요약에 답안 텍스트가 없어야 한다');
  assert.deepEqual(errors, []);
  ok('제출하면 개인 기록과 결과 요약이 저장되고, 결과 요약에는 답안 텍스트가 없다');
  await ctx.close();
}

// 2) 같은 학생이 기기 2(빈 브라우저)에서 열면 답안과 점수가 복원된다
{
  const { page, ctx } = await open({ uid: 'u_a', admin: false, store }, '#case-c01');
  await page.waitForTimeout(300);
  assert.match(await page.inputValue('#a-code'), /7-2 코드/);
  assert.match(await page.textContent('#model'), /모범 해석 보기/, '제출 상태도 복원되어야 한다');
  ok('다른 기기에서 답안과 제출 상태가 복원된다');
  await ctx.close();
}

// 3) 기기 2에만 있던 기록과 합쳐진다(어느 쪽도 잃지 않는다)
{
  const local = { 'mmpi.prog': JSON.stringify({ mods: { m05: true }, quiz: {}, cases: {} }) };
  const { page, ctx } = await open({ uid: 'u_a', admin: false, store }, '#home', local);
  await settle(page);
  const s = await page.evaluate(() => window.__store);
  const mods = Object.keys(s['data/users/u_a/progress'].local.prog.mods);
  assert.ok(mods.includes('m05'), '이 기기의 모듈 완료가 합쳐져야 한다');
  assert.ok(s['data/users/u_a/progress'].local.prog.cases.c01, '다른 기기의 사례 기록도 남아야 한다');
  store = s;
  ok('두 기기의 기록이 합쳐진다');
  await ctx.close();
}

// 4) 학생 B, C의 결과를 넣고, 학생이 다른 학생의 결과를 읽을 수 없는지 확인
store['results/u_b'] = { v: 1, mods: ['m01'], quiz: { 0: 0 }, cases: { c01: { score: 40, at: 5, hits: Array(11).fill(0) } }, labQuiz: { n: 0, ok: 0 } };
store['results/u_c'] = { v: 1, mods: [], quiz: { 0: 1 }, cases: { c01: { score: 80, at: 6, hits: Array(11).fill(1) } }, labQuiz: { n: 0, ok: 0 } };
{
  const { page, ctx } = await open({ uid: 'u_d', admin: false, store }, '#class');
  await page.waitForTimeout(500);
  assert.equal((await page.evaluate(() => window.__store))['results/u_d'], undefined, '활동이 없으면 결과 문서를 만들지 않는다');
  assert.equal(await page.$('#cl-admin table'), null, '학생에게는 운영자 화면이 없어야 한다');
  assert.match(await page.textContent('#cl-stats'), /아직 반 통계가 없습니다/);
  ok('학생에게는 운영자 화면과 다른 학생 결과가 보이지 않는다');
  await ctx.close();
}

// 5) 운영자가 우리 반을 열면 명단을 보고 반 통계를 계산·공개한다
{
  const { page, ctx, errors } = await open({ uid: 'u_owner', admin: true, store }, '#class');
  await page.waitForSelector('#cl-admin table');
  const names = await page.$$eval('[data-uid]', tds => tds.map(t => t.textContent));
  assert.equal(names.length, 3);
  assert.ok(names.every(n => n.startsWith('학생-')), '이름은 저장하지 않고 id로 조회해 표시');
  store = await page.evaluate(() => window.__store);
  assert.equal(store['class/summary'].students, 3);
  assert.equal(store['class/summary'].cases.c01.n, 3);
  assert.ok(!JSON.stringify(store['class/summary']).includes('u_a'), '반 통계에 학생 id가 없어야 한다');
  await page.selectOption('#as-case', 'c10');
  await page.fill('#as-due', '2026-12-01');
  await page.click('#as-add');
  await page.waitForFunction(() => /저장했습니다/.test(document.getElementById('as-msg').textContent));
  store = await page.evaluate(() => window.__store);
  assert.equal(store['class/assignments'].items[0].caseId, 'c10');
  assert.deepEqual(errors, []);
  ok('운영자: 명단 표시, 반 통계 공개, 과제 등록');
  await ctx.close();
}

// 6) 학생이 반 통계와 과제를 본다
{
  const { page, ctx } = await open({ uid: 'u_b', admin: false, store }, '#class');
  await page.waitForSelector('#cl-stats table');
  const txt = await page.textContent('#cl-stats');
  assert.match(txt, /3명/);
  assert.match(txt, /반이 가장 많이 놓친 핵심 포인트/);
  assert.match(await page.textContent('#cl-assign'), /사례 10/);
  await page.goto(URL + '#cases'); await page.waitForTimeout(300);
  assert.match(await page.textContent('.case-card[href="#case-c10"]'), /과제/);
  ok('학생: 반 통계와 과제, 사례 목록의 과제 표시');
  await ctx.close();
}

// 7) 보기 전용(쓰기 거부)이면 읽기 전용으로 표시하고 이 브라우저에서 계속 동작한다
{
  const { page, ctx, errors } = await open({ uid: 'u_v', admin: false, store: {}, readonly: true }, '#home');
  await page.waitForTimeout(300);
  assert.equal(await page.textContent('#sync'), '읽기 전용');
  await page.goto(URL + '#module-m01'); await page.click('#done');
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('mmpi.prog')).mods.m01));
  assert.deepEqual(errors, []);
  ok('쓰기 권한이 없으면 읽기 전용으로 표시하고 로컬 저장으로 계속 동작');
  await ctx.close();
}

// 8) 플랫폼 기능이 없으면(claude.ai 밖) 로컬 모드
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(URL + '#class');
  await page.waitForFunction(() => /이 브라우저에만/.test(document.getElementById('sync').textContent));
  ok('claude.ai 밖에서는 로컬 모드로 동작');
  await ctx.close();
}

await browser.close();
console.log(`클래스 모드 종단 테스트 ${passed}개 통과`);
