// 해석 규칙의 경계값 테스트. 절단점 하나하나가 문헌 기준대로 동작하는지 확인한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load.mjs';

const { MMPI } = loadApp();

// 모든 척도가 평균(T 50)인 기준 프로파일
const BASE2 = { CNS: 0, VRIN: 50, TRIN: 50, TRINdir: 'T', F: 50, Fb: 50, Fp: 50, FBS: 50, L: 50, K: 50, S: 50,
  Hs: 50, D: 50, Hy: 50, Pd: 50, Mf: 50, Pa: 50, Pt: 50, Sc: 50, Ma: 50, Si: 50 };
const BASEA = { CNS: 0, VRIN: 50, TRIN: 50, TRINdir: 'T', F1: 50, F2: 50, F: 50, L: 50, K: 50,
  Hs: 50, D: 50, Hy: 50, Pd: 50, Mf: 50, Pa: 50, Pt: 50, Sc: 50, Ma: 50, Si: 50 };
const run2 = (patch, ctx = {}) => MMPI.analyze({ ...BASE2, ...patch }, { setting: 'outpatient', sex: 'M', ...ctx });
const runA = (patch, ctx = {}) => MMPI.analyze({ ...BASEA, ...patch }, { setting: 'outpatient', sex: 'M', version: 'A', ...ctx });
const texts = r => r.steps.flatMap(s => s.items.map(i => i.text)).join('\n');

describe('MMPI-2 타당도 절단점', () => {
  test('평균 프로파일은 타당하고 정상 범위다', () => {
    const r = run2({});
    assert.equal(r.validity, 'valid');
    assert.equal(r.code.key, 'WNL');
  });
  test('무응답 29개는 주의, 30개는 해석 불가', () => {
    assert.equal(run2({ CNS: 29 }).validity, 'caution');
    assert.equal(run2({ CNS: 30 }).validity, 'invalid');
  });
  test('VRIN 79는 주의, 80은 해석 불가', () => {
    assert.equal(run2({ VRIN: 79 }).validity, 'caution');
    assert.equal(run2({ VRIN: 80 }).validity, 'invalid');
  });
  test('TRIN 80 이상은 방향과 관계없이 해석 불가', () => {
    assert.equal(run2({ TRIN: 80, TRINdir: 'T' }).validity, 'invalid');
    assert.equal(run2({ TRIN: 80, TRINdir: 'F' }).validity, 'invalid');
  });
  test('F ≥ 100이어도 Fp가 정상이면 해석 가능(주의)', () => {
    const r = run2({ F: 105, Fp: 60 });
    assert.equal(r.validity, 'caution');
    assert.equal(r.over, false);
  });
  test('F ≥ 100이고 Fp ≥ 100이면 과대보고로 해석 불가', () => {
    const r = run2({ F: 105, Fp: 100 });
    assert.equal(r.validity, 'invalid');
    assert.equal(r.over, true);
    assert.equal(r.code, null);
  });
  test('무선반응이 먼저 판정되면 F 해석 단계로 가지 않는다', () => {
    const r = run2({ VRIN: 85, F: 110, Fp: 110 });
    assert.equal(r.validity, 'invalid');
    assert.equal(r.over, false, 'VRIN으로 중단된 프로파일을 과대보고로 판정하면 안 된다');
  });
  test('L 79는 주의(과소보고), 80은 해석 불가', () => {
    assert.equal(run2({ L: 79 }).validity, 'caution');
    assert.equal(run2({ L: 80 }).validity, 'invalid');
  });
  test('K 65는 외래에서 과소보고 주의, 인사 선발 장면에서는 기준이 70', () => {
    assert.equal(run2({ K: 65 }).under, true);
    assert.equal(run2({ K: 65 }, { setting: 'personnel' }).under, false);
    assert.equal(run2({ K: 70 }, { setting: 'personnel' }).under, true);
  });
  test('S 70 이상은 과소보고 주의', () => {
    assert.equal(run2({ S: 70 }).under, true);
  });
});

describe('MMPI-2 코드타입 결정', () => {
  test('5번과 0번은 코드타입에서 제외한다', () => {
    const r = run2({ Mf: 90, Si: 85, D: 70 });
    assert.equal(r.code.key, '2');
  });
  test('두 척도가 65 이상이고 차이가 10 미만이면 2개 척도 코드', () => {
    const r = run2({ D: 75, Pt: 72 });
    assert.equal(r.code.key, '27');
    assert.equal(r.code.def, 72 - 50);
  });
  test('두 번째 척도가 65 미만일 때만 단독 상승', () => {
    assert.equal(run2({ Ma: 85, Pd: 64 }).code.key, '9');
  });
  test('두 척도가 모두 65 이상이면 차이가 10T 이상이어도 2개 척도 코드 (Graham)', () => {
    assert.equal(run2({ D: 85, Pt: 70 }).code.key, '27');
    assert.equal(runA({ Pd: 85, Ma: 70 }).code.key, '49');
  });
  test('세 번째 척도도 65 이상이고 사전에 있는 조합이면 3개 척도 코드', () => {
    assert.equal(run2({ D: 78, Pt: 75, Sc: 72 }).code.key, '278');
  });
  test('정의 수준 5T 미만이면 경고한다', () => {
    const r = run2({ D: 72, Pt: 70, Hs: 67 }); // 1-2-7은 사전에 없는 조합이라 2-7 코드, 정의 수준 3T
    assert.ok(r.code.def < 5);
    assert.match(texts(r), /정의되지 않은 코드/);
  });
  test('전환 V: 1·3번이 65 이상이고 2번이 10T 이상 낮다', () => {
    // 코드타입 설명에도 '전환 V'라는 말이 있으므로 형태 판정 문장만 찾는다
    assert.match(texts(run2({ Hs: 75, Hy: 78, D: 60 })), /전환 V: 1번/);
    assert.doesNotMatch(texts(run2({ Hs: 75, Hy: 78, D: 70 })), /전환 V: 1번/);
  });
  test('Goldberg 지표 45를 기준으로 방향을 판정한다', () => {
    // L+Pa+Sc−Hy−Pt = 50+70+75−50−50 = 95
    assert.match(texts(run2({ Pa: 70, Sc: 75 })), /Goldberg 지표.*= 95. 정신증 방향/);
  });
  test('수동-공격적 V는 여성 프로파일에만 적용한다', () => {
    const p = { Pd: 72, Pa: 70, Mf: 35 };
    const rule = /여성 프로파일에서 4·6번이 높고 5번이 낮다/;
    assert.match(texts(run2(p, { sex: 'F' })), rule);
    assert.doesNotMatch(texts(run2(p, { sex: 'M' })), rule);
  });
});

describe('MMPI-2 정교화와 위험 지표', () => {
  test('4번 상승이 Pd1 주도이고 Pd2가 정상이면 반사회성으로 기술하지 않도록 경고', () => {
    assert.match(texts(run2({ Pd: 72, Pd1: 70, Pd2: 55 })), /반사회적”이라고 서술하지 않는다/);
  });
  test('8번이 높고 RC8이 정상이면 핵심 구성개념이 약하다고 표시', () => {
    assert.match(texts(run2({ Sc: 78, RC8: 55, RCd: 75 })), /기태적 경험은 약하다/);
  });
  test('2번 상승 + 9번 저하는 자살 위험 플래그', () => {
    assert.ok(run2({ D: 70, Ma: 38 }).flags.includes('suicide'));
  });
  test('MAC-R 상승 + AAS 상승은 물질 플래그', () => {
    assert.ok(run2({ MACR: 70, AAS: 65 }).flags.includes('substance'));
  });
  test('O-H 70 이상은 공격성 플래그', () => {
    assert.ok(run2({ OH: 75 }).flags.includes('violence'));
  });
  test('평균 프로파일에는 위험 플래그가 없다', () => {
    assert.deepEqual([...run2({}).flags], []);
  });
});

describe('MMPI-A(청소년) 규칙은 성인과 다르다', () => {
  test('VRIN 75부터 해석 불가(성인은 80)', () => {
    assert.equal(runA({ VRIN: 74 }).validity, 'caution');
    assert.equal(runA({ VRIN: 75 }).validity, 'invalid');
    assert.equal(run2({ VRIN: 75 }).validity, 'caution');
  });
  test('TRIN 75부터 해석 불가', () => {
    assert.equal(runA({ TRIN: 75 }).validity, 'invalid');
  });
  test('F ≥ 90이면 Fp가 없으므로 외부 자료로 감별하라고 안내', () => {
    const r = runA({ F: 92 });
    assert.equal(r.validity, 'caution');
    assert.match(texts(r), /Fp가 없으므로/);
  });
  test('F2만 높으면 내용·보충척도를 제한한다', () => {
    assert.match(texts(runA({ F2: 95, F1: 60 })), /내용·보충척도는 제한/);
  });
  test('T 60~64만 있으면 경계 범위 프로파일로 판정', () => {
    assert.equal(runA({ Pt: 63 }).code.label, '경계 범위 프로파일');
  });
  test('청소년 해석에는 K 교정을 하지 않는다는 안내가 있다', () => {
    assert.match(texts(runA({})), /K 교정을 하지 않는다/);
  });
  test('청소년 코드타입에는 성인과의 차이를 함께 보여 준다', () => {
    assert.match(texts(runA({ Pd: 78, Ma: 72 })), /성인과의 차이/);
  });
  test('A-sch 상승은 학업 중단 플래그', () => {
    assert.ok(runA({ Asch: 70 }).flags.includes('school'));
  });
  test('성인 엔진에는 학업 중단 플래그가 없다', () => {
    assert.ok(!run2({ Asch: 70 }).flags.includes('school'));
  });
});
