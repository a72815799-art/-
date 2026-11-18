// 콘텐츠 무결성 테스트. 사례·퀴즈·사전을 추가하거나 고칠 때 흔히 생기는 실수를 잡는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadApp, scriptOrder, APP_DIR } from './load.mjs';

const app = loadApp();
const { CASES, QUIZ, MODULES, LEVELS, SCALES, SCALES_A, SUBSCALES, CODETYPES, CODETYPES_A, COMPARE, MMPI } = app;

// 샌드박스(vm)에서 만든 배열은 다른 realm이라 deepEqual이 실패하므로 지역 배열로 복사해 비교한다.
const local = xs => [...xs];
const unique = (xs, what) => {
  const dup = local(xs).filter((x, i) => xs.indexOf(x) !== i);
  assert.deepEqual(dup, [], `${what} 중복: ${dup.join(', ')}`);
};

test('index.html이 불러오는 스크립트 파일이 모두 있다', () => {
  for (const f of scriptOrder()) assert.ok(existsSync(join(APP_DIR, f)), `${f} 없음`);
});

test('id가 중복되지 않는다', () => {
  unique(CASES.map(c => c.id), '사례 id');
  unique(MODULES.map(m => m.id), '모듈 id');
  unique(SCALES.map(s => s.id), '척도 id');
});

test('모든 모듈이 존재하는 커리큘럼 단계에 속하고, 단계 순서로 정렬되어 있다', () => {
  const lv = new Set(LEVELS.map(l => l.n));
  for (const m of MODULES) assert.ok(lv.has(m.level), `${m.id}의 단계 ${m.level} 없음`);
  const levels = local(MODULES.map(m => m.level));
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b), '이전/다음 이동이 단계 순서를 따라야 한다');
});

test('퀴즈: 보기 4개, 정답 번호가 범위 안, 해설이 있다', () => {
  QUIZ.forEach((q, i) => {
    assert.equal(q.a.length, 4, `퀴즈 ${i + 1}`);
    assert.ok(Number.isInteger(q.c) && q.c >= 0 && q.c < q.a.length, `퀴즈 ${i + 1} 정답 번호`);
    assert.ok(q.e && q.e.length > 5, `퀴즈 ${i + 1} 해설`);
    assert.ok(LEVELS.some(l => l.n === q.lv), `퀴즈 ${i + 1} 단계`);
  });
});

test('O/X 연습: 답이 true/false이고 해설이 있다', () => {
  for (const d of COMPARE.drill) {
    assert.equal(typeof d.a, 'boolean', d.q);
    assert.ok(d.e, d.q);
  }
});

// 성인/청소년 검사에서 사례 점수에 쓸 수 있는 척도 이름
const ADULT_KEYS = new Set(['CNS', 'TRINdir', ...SCALES.map(s => s.id), ...Object.keys(SUBSCALES)]);
const TEEN_KEYS = new Set(['TRINdir', ...MMPI.GROUPS_A.flatMap(([, ks]) => ks)]);

for (const c of CASES) {
  test(`${c.id} 사례 구조`, () => {
    const keys = c.version === 'A' ? TEEN_KEYS : ADULT_KEYS;
    for (const [k, v] of Object.entries(c.p)) {
      assert.ok(keys.has(k), `${c.id}: 알 수 없는 척도 ${k} (${c.version === 'A' ? 'MMPI-A' : 'MMPI-2'})`);
      if (k === 'TRINdir') assert.ok(v === 'T' || v === 'F', `${c.id}: TRIN 방향은 T 또는 F`);
      else if (k === 'CNS') assert.ok(v >= 0 && v <= 100, `${c.id}: 무응답 원점수 범위`);
      else assert.ok(v >= 20 && v <= 120, `${c.id}: ${k}=${v}는 T점수 범위(20~120)를 벗어남`);
    }
    for (const k of ['VRIN', 'TRIN', 'F', 'L', 'K', 'Hs', 'D', 'Hy', 'Pd', 'Pa', 'Pt', 'Sc', 'Ma'])
      assert.ok(k in c.p, `${c.id}: 필수 척도 ${k} 누락`);
    if (c.version === 'A') assert.ok(!('Fp' in c.p) && !('RC8' in c.p), `${c.id}: MMPI-A에는 Fp·RC 척도가 없다`);
    assert.ok([1, 2, 3].includes(c.level), `${c.id}: 난이도`);
    assert.ok(MMPI.SETTINGS[c.setting], `${c.id}: 장면 ${c.setting}`);
    assert.ok(c.keyPoints.length >= 5, `${c.id}: 핵심 포인트가 5개 이상이어야 한다`);
    for (const kp of c.keyPoints) assert.ok(kp.domain && kp.point && kp.kw.length, `${c.id}: 핵심 포인트 형식`);
    for (const f of ['validity', 'code', 'elaboration', 'dx', 'risk', 'tx', 'summary'])
      assert.ok(c.expert[f], `${c.id}: 모범 해석 ${f} 누락`);
    assert.ok(c.pitfalls.length >= 1, `${c.id}: 흔한 오류`);
  });
}

test('하위척도가 존재하는 상위 척도를 가리킨다', () => {
  const ids = new Set(SCALES.map(s => s.id));
  for (const [k, s] of Object.entries(SUBSCALES)) assert.ok(ids.has(s.parent), `${k}.parent=${s.parent}`);
  for (const s of SCALES) for (const h of s.hl || []) assert.ok(SUBSCALES[h], `${s.id}의 하위척도 ${h} 없음`);
});

test('청소년 척도 사전의 참조(ref)가 성인 척도에 있다', () => {
  const ids = new Set(SCALES.map(s => s.id));
  for (const s of SCALES_A) if (s.ref) assert.ok(ids.has(s.ref), `ref ${s.ref} 없음`);
});

test('코드타입 키는 척도 번호를 오름차순으로 쓴다', () => {
  for (const k of [...Object.keys(CODETYPES), ...Object.keys(CODETYPES_A)]) {
    if (k === 'WNL') continue;
    assert.match(k, /^[1-9]{1,3}$/, k);
    assert.equal(k, [...k].sort().join(''), `${k}는 정렬된 키여야 한다`);
  }
});

/* 심화 콘텐츠 완결성: 새 사례·모듈·척도를 추가할 때 심화 해설이 빠지지 않게 한다 */
const { CASE_DEEP, MODULE_DEEP, SCALE_DEEP, SCALE_DEV, GROUP_INTRO } = app;
const rowsOk = (rows, cols, min, where) => {
  assert.ok(Array.isArray(rows) && rows.length >= min, `${where}: ${min}행 이상 필요`);
  rows.forEach((r, i) => assert.equal(r.length, cols, `${where} ${i + 1}행은 ${cols}열이어야 한다`));
};
for (const c of CASES) {
  test(`${c.id} 심화 해설`, () => {
    const d = CASE_DEEP[c.id];
    assert.ok(d, `${c.id}: CASE_DEEP 없음`);
    assert.ok(d.firstLook.length > 100, '첫 30초');
    rowsOk(d.walk, 3, 5, '척도별 분석');
    rowsOk(d.hypotheses, 4, 3, '가설 수렴표');
    rowsOk(d.differential, 4, 1, '감별 진단');
    assert.ok(d.interview.length >= 2, '면담 질문');
    assert.ok(d.report.length > 300, '보고서 문단');
    rowsOk(d.feedback, 2, 1, '피드백');
    rowsOk(d.plan, 3, 1, '개입 계획');
    assert.ok(d.supervisor.length > 200, '슈퍼바이저 코멘트');
  });
}
test('모든 이론 모듈에 심화 영역이 있다', () => {
  for (const m of MODULES) assert.ok(MODULE_DEEP[m.id] && MODULE_DEEP[m.id].length > 400, `${m.id} 심화 없음`);
});
test('타당도·임상척도는 심화 해설 6항목, 나머지는 개발 배경이 있다', () => {
  for (const s of SCALES) {
    if (s.group === 'validity' || s.group === 'clinical') {
      const d = SCALE_DEEP[s.id];
      assert.ok(d, `${s.id} 심화 없음`);
      for (const f of ['dev', 'items', 'role', 'diff', 'research', 'vignette']) assert.ok(d[f], `${s.id}.${f}`);
    } else assert.ok(SCALE_DEV[s.id], `${s.id} 개발 배경 없음`);
  }
  for (const g of ['validity', 'clinical', 'rc', 'content', 'supp', 'psy5']) assert.ok(GROUP_INTRO[g], `군 개요 ${g}`);
});

test('화면 문구와 주석에 개발 도구·플랫폼 이름이 없다(플랫폼 연결 코드 제외)', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  for (const f of readdirSync(APP_DIR).filter(f => /\.(js|html)$/.test(f))) {
    const src = readFileSync(join(APP_DIR, f), 'utf8')
      .replace(/window\.claude/g, '')                          // 플랫폼 API 연결(공유 링크 버전에 필요)
      .replace(/<meta name="claude:viewport-fit-sides"[^>]*>/, ''); // 플랫폼 레이아웃 메타(오프라인 파일에서는 제거됨)
    assert.ok(!/claude|anthropic/i.test(src), `${f}에 플랫폼 이름이 있다`);
  }
});
