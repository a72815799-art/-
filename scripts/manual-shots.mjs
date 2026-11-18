// 사용 설명서용 화면 캡처: 예시 학습 기록을 넣은 상태로 주요 화면을 찍어 docs/manual/img에 저장한다.
//   node scripts/manual-shots.mjs
// AI 화면은 예시 응답을 돌려주는 모의 객체로 찍는다(설명서 캡션에 “예시”로 표시).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execSync('node scripts/preview.mjs', { cwd: root, stdio: 'ignore' });
const URL = pathToFileURL(join(root, 'dist', 'index.html')).href;
const OUT = join(root, 'docs', 'manual', 'img'); mkdirSync(OUT, { recursive: true });

const D = 864e5, now = Date.now();
const day = k => now - k * D;
const draftC01 = {
  validity: '무응답 2개, VRIN 50·TRIN 57T로 문항을 읽고 일관되게 답했다. F 62로 경도 상승했으나 F(P) 48이 평균 이하라 과대보고가 아니라 현재 고통을 솔직히 보고한 것으로 본다. L 48·K 42로 방어는 낮다. 해석 가능.',
  code: '7-2 코드(Pt 80, D 78), 다음 척도 Sc 63과의 차이 15점으로 잘 정의됨. 신경증 3요소 중 2번이 높고 9번(42)이 낮아 에너지가 고갈된 불안-우울 혼재형.',
  elaboration: 'RCd 76으로 의기소침이 크다. RC2 68(낮은 긍정 정서)과 RC7 73(부정 정서)이 고유한 우울과 불안을 보여 준다. ANX 76, OBS 72, DEP 73, WRK 72, LSE 70: 반추, 자기비난, 업무 효능감 저하.',
  dx: '불안증을 동반한 우울장애, 범불안장애 감별. 강박적 성격 특성 확인.',
  risk: 'D 78과 DEP 73, 무망감 가능성: 자살 사고를 면담에서 직접 확인. 수면 문제와 음주 여부 확인.',
  tx: '고통이 커 치료 동기가 높고 예후는 양호하다. 인지행동치료로 반추와 완벽주의를 다루고, 수면 위생과 업무 조정을 병행한다. 약물 평가 의뢰 고려.',
  summary: '승진 후 책임 증가로 불안과 우울이 함께 커진 과잉책임형 직장인. 고통을 솔직히 드러내 치료 관계 형성이 쉽다.',
};
const seed = {
  prog: {
    mods: Object.fromEntries(['m01','m02','m03','m04','m05','m06','m07','m09','m11','m12','m13'].map(m => [m, true])),
    quiz: Object.fromEntries(Array.from({ length: 42 }, (_, i) => [i, i % 4 !== 1])),
    cases: { c01: { score: 67, at: day(26) }, c11: { score: 60, at: day(22) }, c02: { score: 71, at: day(18) }, c05: { score: 75, at: day(14) },
      c03: { score: 78, at: day(10) }, c06: { score: 80, at: day(7) }, c10: { score: 83, at: day(4) }, c13: { score: 60, at: day(2) } },
    srs: { 1: { ef: 2.5, reps: 0, interval: 0, due: day(1), at: day(2) }, 5: { ef: 2.5, reps: 0, interval: 0, due: day(1), at: day(2) } },
    prepost: { form: 'A', pre: { form: 'A', pct: 44, ok: 7, n: 16, at: day(30), domains: { '타당도 판단': 33, '코드타입': 50, '정교화(하위척도·RC)': 33, '내용·보충척도': 67, '위험·보고서': 50, '청소년(MMPI-A)': 33 } },
      post: { form: 'B', pct: 75, ok: 12, n: 16, at: day(1), domains: { '타당도 판단': 100, '코드타입': 75, '정교화(하위척도·RC)': 67, '내용·보충척도': 67, '위험·보고서': 75, '청소년(MMPI-A)': 50 } } },
  },
  activity: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [new Date(day(i * 1.1 + (i % 5 === 0 ? 0.4 : 0))).toISOString().slice(0, 10), (i * 7) % 9 + 1])),
  evRead: { 'ev-overreport': day(13), 'ev-underreport': day(8), 'ev-codedef': day(5), 'ev-rc': day(3) },
  'draft.c01': draftC01,
};

const COACH = `## 슈퍼바이저 코칭 (예시)

| 영역 | 점수 | 한 줄 평 |
|---|---|---|
| 타당도 판단 | 5 | F와 F(P)를 함께 보고 과대보고를 배제한 순서가 정확합니다 |
| 코드타입 | 5 | 정의도 15점까지 계산했습니다 |
| 정교화 | 4 | RCd와 RC2·RC7을 구분했습니다. Harris-Lingoes D1·D4를 더하면 좋습니다 |
| 위험 평가 | 4 | 자살 사고 확인을 적었습니다. 확인할 질문을 구체적으로 쓰세요 |
| 치료 시사점 | 4 | 동기와 예후 판단이 근거와 연결됩니다 |

**잘한 점**: 타당도 → 코드 → 정교화 순서를 지켰고, 숫자를 근거로 판단했습니다.

**고칠 점**: “무망감 가능성”은 근거 척도가 빠졌습니다.
고친 문장: “D 78, DEP 73, 낮은 9번(42)이 함께 나타나 무망감이 클 수 있으므로 자살 사고와 계획을 면담에서 직접 확인한다.”

**다음에 읽을 모듈**: 재검사와 변화 해석, 결정적 문항`;
const MENTOR = `좋은 질문입니다. 순서는 **비내용 반응 → 과대보고 → 과소보고**입니다.

1. **VRIN·TRIN**: 문항을 읽고 답했는지부터 봅니다. 여기서 무효면 F는 해석하지 않습니다.
2. **F**: 높다면 실제 고통, 도움 요청, 과장 중 무엇인지 가설을 세웁니다.
3. **F(P)**: 정신과 환자도 드물게 답하는 문항이라, F는 높은데 F(P)가 평균이면 실제 병리 쪽 가설이 강해집니다.

입원 장면이라면 F 80대는 흔합니다. 장면의 기저율을 보고서에 함께 적으세요.`;

function mock(o) {
  const S = o.store; const clone = x => JSON.parse(JSON.stringify(x));
  const db = { doc: p => ({ get: async () => ({ exists: p in S, data: () => clone(S[p]) }), set: async d => { S[p] = clone(d); } }),
    collection: p => ({ get: async () => ({ docs: Object.keys(S).filter(k => k.startsWith(p + '/') && k.split('/').length === 2).map(k => ({ id: k.split('/')[1], exists: true, data: () => clone(S[k]) })) }) }) };
  const user = { id: async () => 'u_owner', canEdit: async () => true, can: async () => true, profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: i }])) };
  const sample = async (input, opts = {}) => { const s = JSON.stringify(input); const t = /질문|\[질문\]|role/.test(s) && !/수련생 답안/.test(s) ? o.mentor : o.coach; opts.onText && opts.onText({ text: t }); return { text: t }; };
  let calls = 0; sample.json = async (prompt) => { calls++; const part = String(prompt).split('[수련생 답안]')[1] || ''; const len = part.replace(/\(작성하지 않음\)/g, '').length; const base = Math.max(0, Math.min(5, Math.round(len / 160))); const jit = calls % 3 === 0 ? -1 : calls % 5 === 0 ? 1 : 0; return Object.fromEntries(['validity','code','elaboration','integration','context','diagnosis','risk','treatment','language'].map(k => [k, Math.max(0, Math.min(5, base + jit))])); };
  const downloads = { save: async () => ({ status: 'saved' }) };
  window.claude = { use: async n => ({ db, user, sample, downloads })[n] || null };
}
const classStore = () => {
  const mk = (cases, pre, post, quiz) => ({ v: 1, mods: ['m01', 'm02', 'm03'], quiz, cases, labQuiz: { n: 6, ok: 4 }, consent: true,
    prepost: { pre: { form: 'A', pct: pre, domains: {} }, post: post ? { form: 'B', pct: post, domains: {} } : undefined } });
  const q = (ok) => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, i % ok !== 0]));
  return { 'class/assignments': { items: [{ caseId: 'c05', due: '2026-11-25', note: '과대보고 판단 근거를 척도별로 쓸 것' }, { caseId: 'c13', due: '2026-12-02', note: '' }] },
    'results/u_s1': mk({ c01: { score: 67 }, c05: { score: 75 }, c13: { score: 60 } }, 44, 75, q(4)),
    'results/u_s2': mk({ c01: { score: 58 }, c05: { score: 50 }, c13: { score: 40 } }, 38, 63, q(3)),
    'results/u_s3': mk({ c01: { score: 83 }, c05: { score: 75 }, c13: { score: 80 } }, 56, 81, q(5)),
    'results/u_s4': mk({ c01: { score: 50 }, c05: { score: 63 } }, 31, 56, q(3)) };
};

const browser = await chromium.launch();
async function ctx({ link = false, store = {}, vp = { width: 1280, height: 860 } } = {}) {
  const c = await browser.newContext({ viewport: vp, deviceScaleFactor: 1.6 });
  await c.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await c.newPage(); page.on('pageerror', e => console.error('pageerror', e.message));
  await page.addInitScript(d => { for (const [k, v] of Object.entries(d)) localStorage.setItem('mmpi.' + k, JSON.stringify(v)); }, seed);
  if (link) await page.addInitScript(mock, { store, coach: COACH, mentor: MENTOR });
  return { c, page };
}
const go = async (page, hash, wait = 450) => { await page.goto(URL + hash); await page.waitForTimeout(wait); };
const shot = async (page, name, opt = {}) => {
  if (opt.el) { const el = typeof opt.el === 'string' ? await page.$(opt.el) : opt.el; await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: join(OUT, name + '.png') }); }
  else await page.screenshot({ path: join(OUT, name + '.png'), fullPage: !!opt.full, clip: opt.clip });
  console.log('  ', name);
};
const scrollTo = async (page, sel, dy = -70) => { await page.evaluate(([s, dy]) => { const e = document.querySelector(s); if (e) window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY + dy); }, [sel, dy]); await page.waitForTimeout(200); };

{ // 공유 링크 버전 화면(기본 AI 연결 상태)
  const { c, page } = await ctx({ link: true, store: classStore() });
  await go(page, '#home'); await shot(page, '01-home');
  await go(page, '#dashboard', 700); await shot(page, '02-dashboard');
  await scrollTo(page, 'table.dom'); await shot(page, '03-dashboard-domains');
  await scrollTo(page, '#dtrend'); await shot(page, '04-dashboard-charts');
  await go(page, '#module-m05'); await shot(page, '05-module');
  await go(page, '#scales'); await page.click('#seg button[data-g="clinical"]'); await page.waitForTimeout(150);
  const pt = page.locator('details.scale-card', { hasText: '강박' }).first(); await pt.locator('summary').first().click(); await page.waitForTimeout(150);
  await pt.locator('details.deep-scale > summary').click(); await page.waitForTimeout(150); await pt.evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70)); await page.waitForTimeout(150); await page.waitForTimeout(150); await shot(page, '06-scales');
  await go(page, '#codes'); await page.click('.code-card[data-k="27"]'); await page.waitForTimeout(300); await scrollTo(page, '#cd'); await shot(page, '07-codes');
  await go(page, '#compare'); await shot(page, '08-compare');
  await go(page, '#analyzer', 700); await shot(page, '09-analyzer');
  await scrollTo(page, '#steps'); await shot(page, '10-analyzer-steps');
  await go(page, '#lab', 700); await page.click('button[data-pre=\'{"over":0.6}\']').catch(() => {}); await page.waitForTimeout(400); await shot(page, '11-lab');
  await go(page, '#stability', 600); await page.click('#sb-run'); await page.waitForTimeout(2500); await shot(page, '12-stability');
  await go(page, '#cases'); await shot(page, '13-cases');
  await go(page, '#case-c01', 600); await shot(page, '14-case');
  await scrollTo(page, 'textarea[data-k]'); await shot(page, '15-case-write');
  await page.click('#check'); await page.waitForTimeout(400); await scrollTo(page, '#res'); await shot(page, '16-case-check');
  await page.click('#coach'); await page.waitForTimeout(500); await scrollTo(page, '#coachout'); await shot(page, '17-case-coach');
  await page.click('#model'); await page.waitForTimeout(500); await scrollTo(page, '.deep-case'); await shot(page, '18-case-deep');
  await scrollTo(page, '.deep-case h3:nth-of-type(3)'); await shot(page, '19-case-deep2');
  await page.evaluate(() => { const h = [...document.querySelectorAll('#modelout h2')].find(x => /근거 노트/.test(x.textContent)); window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 70); }); await page.waitForTimeout(200); await shot(page, '20-case-evidence');
  await go(page, '#quiz'); await page.click('#qs .q .opts button >> nth=0').catch(() => {}); await page.waitForTimeout(200); await shot(page, '21-quiz');
  await go(page, '#evidence'); await page.click('#evseg button[data-t="topics"]'); await page.waitForTimeout(200); await shot(page, '22-evidence');
  await go(page, '#ev-overreport'); await shot(page, '23-evidence-topic');
  await page.evaluate(() => { const h = [...document.querySelectorAll('h2')].find(x => /수치로 보기/.test(x.textContent)); window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 90); }); await page.waitForTimeout(150); await shot(page, '24-evidence-numbers');
  await go(page, '#refs', 500); await shot(page, '25-refs');
  await go(page, '#evidence'); await page.click('#evseg button[data-t="videos"]'); await page.waitForTimeout(200); await shot(page, '26-videos');
  await go(page, '#research', 700); await shot(page, '27-research');
  await go(page, '#reliability', 600); await page.selectOption('#rl-k', '2').catch(() => {}); await page.click('#rl-run').catch(() => {});
  await page.waitForFunction(() => /완료/.test((document.getElementById('rl-msg') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  await scrollTo(page, '#rl-res'); await shot(page, '28-reliability');
  await go(page, '#mentor', 500); await page.fill('#mq', '입원 환자의 F가 85인데 과대보고인지 어떻게 판단하나요?'); await page.click('#msend'); await page.waitForTimeout(600); await shot(page, '29-mentor');
  await go(page, '#class', 1500); await go(page, '#home', 300); await go(page, '#class', 1500); await scrollTo(page, '#cl-stats', -60); await shot(page, '30-class');
  await scrollTo(page, '#cl-admin', -60); await shot(page, '31-class-admin');
  await c.close();
}
{ // 오프라인 HTML 버전 화면
  const { c, page } = await ctx();
  await go(page, '#home'); await shot(page, '32-offline-home');
  await go(page, '#ai-connect'); await page.click('#ac-prov button[data-p="gemini"]'); await page.waitForTimeout(150); await shot(page, '33-ai-connect');
  await go(page, '#case-c01', 500); await page.click('#coachcopy'); await page.waitForTimeout(400); await scrollTo(page, '#coachout'); await shot(page, '34-copy-request');
  await c.close();
}
{ // 휴대폰 화면
  const { c, page } = await ctx({ vp: { width: 390, height: 844 } });
  await go(page, '#dashboard', 600); await shot(page, '35-mobile');
  await c.close();
}
await browser.close();
