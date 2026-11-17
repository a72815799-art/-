// 실험실 계산 모듈(sim.js) 테스트: 엔진과의 일치, 응답 양식 모형의 방향, 측정오차 시뮬레이션의 성질.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load.mjs';

const app = loadApp();
const { MMPI, MMPILAB: L, CASES } = app;
const CODE = ['Hs', 'D', 'Hy', 'Pd', 'Pa', 'Pt', 'Sc', 'Ma'];
const engineKey = (p, version) => {
  const r = MMPI.analyze(p, { setting: 'outpatient', sex: 'M', version });
  return r.code ? r.code.key : null;
};

describe('코드타입 결정: 실험실 모듈과 분석기 엔진이 같은 규칙을 쓴다', () => {
  test('20개 사례에서 일치', () => {
    for (const c of CASES) {
      const r = MMPI.analyze(c.p, { setting: c.setting, sex: c.sex, version: c.version });
      if (!r.code) continue; // 해석 불가 사례는 엔진이 코드를 정하지 않는다
      assert.equal(L.codeOf(c.p, c.version).key, r.code.key, c.id);
    }
  });
  for (const version of [undefined, 'A']) {
    test(`무작위 프로파일 2,000개에서 일치 (${version === 'A' ? 'MMPI-A' : 'MMPI-2'})`, () => {
      const g = L.rng(2024);
      for (let i = 0; i < 2000; i++) {
        const p = { CNS: 0, VRIN: 50, TRIN: 50, TRINdir: 'T', F: 50, F1: 50, F2: 50, Fb: 50, Fp: 50, L: 50, K: 50, S: 50, Mf: 50, Si: 50 };
        for (const k of CODE) p[k] = Math.round(45 + g() * 45);
        assert.equal(L.codeOf(p, version).key, engineKey(p, version), JSON.stringify(p));
      }
    });
  }
});

describe('응답 양식 모형', () => {
  const sim = mix => L.simulate({}, mix);
  test('왜곡이 없으면 사례 프로파일을 그대로 재현한다', () => {
    for (const c of CASES.filter(c => c.version !== 'A')) {
      const s = L.simulate(c.p, {});
      for (const k of Object.keys(L.MODEL)) {
        // 원점수 0점에 해당하는 T점수(바닥)보다 낮은 값은 모형으로 표현할 수 없으므로 제외한다
        const m = L.MODEL[k], floor = 50 - 10 * m.m * m.n / m.sd, ceil = 50 + 10 * (m.n - m.m * m.n) / m.sd;
        if (c.p[k] === undefined || c.p[k] < Math.max(32, floor + 1) || c.p[k] > Math.min(118, ceil - 1)) continue;
        assert.ok(Math.abs(s[k] - c.p[k]) <= 1, `${c.id} ${k}: ${c.p[k]} → ${s[k]}`);
      }
    }
  });
  test('완전 무선반응: VRIN이 해석 불가 수준이고 엔진이 해석을 중단한다', () => {
    const p = sim({ random: 1 });
    assert.ok(p.VRIN >= 80);
    assert.equal(MMPI.analyze(p, {}).validity, 'invalid');
  });
  test('무선반응 30%만으로도 VRIN이 주의 이상으로 오른다', () => {
    assert.ok(sim({ random: 0.3 }).VRIN >= 70);
  });
  test('모두 “그렇다”: TRIN-T 상승, L·K 하락', () => {
    const p = sim({ bias: 1 });
    assert.equal(p.TRINdir, 'T'); assert.ok(p.TRIN >= 80); assert.ok(p.L < 40 && p.K < 40);
  });
  test('모두 “아니다”: TRIN-F 상승, L 상승', () => {
    const p = sim({ bias: -1 });
    assert.equal(p.TRINdir, 'F'); assert.ok(p.TRIN >= 80); assert.ok(p.L >= 80);
  });
  test('과대보고: VRIN·TRIN은 정상인데 F·Fp가 오르고 엔진이 과대보고로 판정', () => {
    const p = sim({ over: 0.8 });
    assert.ok(p.VRIN < 70 && p.TRIN < 70); assert.ok(p.F >= 100 && p.Fp >= 100);
    const r = MMPI.analyze(p, {}); assert.equal(r.validity, 'invalid'); assert.equal(r.over, true);
  });
  test('좋게 보이기: L·K·S가 오르고 F가 내려가며 엔진이 과소보고로 판정', () => {
    const p = sim({ under: 0.5 });
    assert.ok(p.L > 60 && p.K > 55 && p.S > 55 && p.F < 50);
    assert.equal(MMPI.analyze(p, {}).under, true);
  });
  test('비율 합이 1을 넘으면 비율을 맞춰 계산한다(점수가 범위를 벗어나지 않는다)', () => {
    const p = sim({ random: 1, bias: 1 });
    for (const k of Object.keys(L.MODEL)) assert.ok(p[k] >= 30 && p[k] <= 120, k);
  });
});

describe('측정오차 시뮬레이션', () => {
  const wellDefined = { Hs: 50, D: 80, Hy: 50, Pd: 50, Pa: 50, Pt: 78, Sc: 55, Ma: 50 };
  const undefinedCode = { Hs: 50, D: 72, Hy: 50, Pd: 50, Pa: 50, Pt: 70, Sc: 69, Ma: 50 };
  test('같은 시드면 같은 결과(재현 가능)', () => {
    assert.deepEqual(JSON.stringify(L.retest(wellDefined, { seed: 3 })), JSON.stringify(L.retest(wellDefined, { seed: 3 })));
  });
  test('잘 정의된 코드는 2개 척도 코드가 대부분 유지된다', () => {
    assert.ok(L.retest(wellDefined, { sem: 5, seed: 1 }).pSamePair > 0.8);
  });
  test('정의되지 않은 코드는 절반 이상 바뀐다', () => {
    assert.ok(L.retest(undefinedCode, { sem: 5, seed: 1 }).pSame < 0.5);
  });
  test('SEM이 클수록 유지 확률이 낮다', () => {
    assert.ok(L.retest(wellDefined, { sem: 3, seed: 1 }).pSamePair > L.retest(wellDefined, { sem: 8, seed: 1 }).pSamePair);
  });
  test('정의 수준이 높을수록 유지 확률이 높다', () => {
    const c = L.definitionCurve({ sem: 5, n: 1500 });
    assert.ok(c[15].p > c[5].p && c[5].p > c[0].p);
  });
  test('RCI와 SEM 계산', () => {
    const o = L.rci(78, 66, 5);
    assert.ok(Math.abs(o.rci - (-12 / (Math.SQRT2 * 5))) < 1e-9);
    assert.equal(o.reliable, false); assert.equal(o.minChange, 14);
    assert.equal(L.rci(78, 60, 5).reliable, true);
    assert.ok(Math.abs(L.semFromReliability(0.75) - 5) < 1e-9);
  });
});
