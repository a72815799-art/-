// 클래스 모드 데이터 모듈 테스트: 기기 간 병합에서 기록을 잃지 않는지, 운영자에게 가는 결과에 답안이 없는지, 집계가 맞는지.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load.mjs';

const app = loadApp();
const { CLASSDATA: C, CASES, QUIZ, MODULES } = app;
const plain = x => JSON.parse(JSON.stringify(x)); // 샌드박스 객체를 일반 객체로

describe('기기 간 기록 병합', () => {
  const here = {
    prog: { mods: { m01: true, m02: true }, quiz: { 0: true, 1: false }, cases: { c01: { score: 60, at: 200 }, c02: { score: 40, at: 100 } } },
    drafts: { c01: { validity: '이 기기 최신', _at: 200 }, c02: { validity: '이 기기 예전', _at: 100 } },
    drill: { 0: true }, labQuiz: { n: 5, ok: 3 },
  };
  const there = {
    prog: { mods: { m03: true }, quiz: { 1: true, 2: true }, cases: { c02: { score: 90, at: 300 }, c03: { score: 70, at: 50 } } },
    drafts: { c02: { validity: '다른 기기 최신', _at: 300 }, c03: { validity: '다른 기기만', _at: 50 } },
    drill: { 1: false }, labQuiz: { n: 9, ok: 7 },
  };
  const m = plain(C.mergeLocal(here, there));
  test('완료한 모듈은 합집합', () => assert.deepEqual(Object.keys(m.prog.mods).sort(), ['m01', 'm02', 'm03']));
  test('사례 점수는 더 최근 것', () => {
    assert.equal(m.prog.cases.c01.score, 60);
    assert.equal(m.prog.cases.c02.score, 90);
    assert.equal(m.prog.cases.c03.score, 70);
  });
  test('답안은 더 최근 것, 한쪽에만 있으면 보존', () => {
    assert.equal(m.drafts.c01.validity, '이 기기 최신');
    assert.equal(m.drafts.c02.validity, '다른 기기 최신');
    assert.equal(m.drafts.c03.validity, '다른 기기만');
  });
  test('퀴즈는 충돌 시 이 기기 우선, 나머지는 보존', () => assert.deepEqual(m.prog.quiz, { 0: true, 1: false, 2: true }));
  test('O/X와 실험실 기록 보존', () => {
    assert.deepEqual(m.drill, { 0: true, 1: false });
    assert.deepEqual(m.labQuiz, { n: 9, ok: 7 });
  });
  test('한쪽이 비어 있어도 동작한다', () => {
    assert.deepEqual(plain(C.mergeLocal(here, null)).prog.cases, here.prog.cases);
    assert.deepEqual(plain(C.mergeLocal(null, there)).prog.cases, there.prog.cases);
  });
});

describe('운영자에게 보내는 결과', () => {
  const c1 = CASES.find(c => c.id === 'c01');
  const secret = '이 문장은 학생의 답안이며 결과 문서에 들어가면 안 된다 72 코드 자살 평가';
  const local = {
    prog: { mods: { m01: true, zz99: true }, quiz: { 0: true, 3: false, 9999: true }, cases: { c01: { score: 55, at: 10 }, nope: { score: 1, at: 1 } } },
    drafts: { c01: { validity: secret, code: '', _at: 10 } }, drill: { 2: true }, labQuiz: { n: 4, ok: 2 },
  };
  const r = plain(C.buildResults(local, CASES, QUIZ, MODULES));
  test('답안 텍스트가 들어 있지 않다', () => assert.ok(!JSON.stringify(r).includes('학생의 답안')));
  test('핵심 포인트 적중을 0/1로만 기록한다', () => {
    assert.equal(r.cases.c01.hits.length, c1.keyPoints.length);
    assert.ok(r.cases.c01.hits.every(h => h === 0 || h === 1));
    const iCode = c1.keyPoints.findIndex(k => k.domain === '코드타입');
    const iRisk = c1.keyPoints.findIndex(k => k.domain === '위험');
    assert.equal(r.cases.c01.hits[iCode], 1, '“72”를 썼으므로 코드타입 포인트 적중');
    assert.equal(r.cases.c01.hits[iRisk], 1, '“자살”을 썼으므로 위험 포인트 적중');
  });
  test('없는 사례·퀴즈·모듈 id는 버린다', () => {
    assert.ok(!('nope' in r.cases));
    assert.ok(!('9999' in r.quiz));
    assert.deepEqual(r.mods, ['m01']);
  });
});

describe('반 통계 집계', () => {
  const mk = (score, hits, quiz0) => ({ v: C.SCHEMA, mods: ['m01'], quiz: { 0: quiz0 }, cases: { c01: { score, at: 1, hits } }, labQuiz: { n: 2, ok: 1 } });
  const n1 = CASES.find(c => c.id === 'c01').keyPoints.length;
  const allHit = Array(n1).fill(1), noneHit = Array(n1).fill(0);
  const rs = [mk(100, allHit, 1), mk(50, noneHit, 0), mk(60, noneHit, 1), { v: 999, cases: {} }];
  const s = plain(C.summarize(rs, CASES, QUIZ, MODULES));
  test('스키마가 다른 문서는 제외하고 인원을 센다', () => assert.equal(s.students, 3));
  test('활동이 없는 결과(페이지만 열어 본 사람)는 통계에서 뺀다', () => {
    const empty = { v: C.SCHEMA, mods: [], quiz: {}, cases: {}, labQuiz: { n: 0, ok: 0 } };
    assert.equal(plain(C.summarize([...rs, empty], CASES, QUIZ, MODULES)).students, 3);
    assert.equal(C.hasActivity(C.emptyLocal()), false);
  });
  test('사례 평균과 핵심 포인트 비율', () => {
    assert.equal(s.cases.c01.n, 3);
    assert.equal(s.cases.c01.mean, 70);
    assert.ok(s.cases.c01.kp.every(x => Math.abs(x - 0.33) < 0.01));
    assert.equal(s.cases.c02.n, 0);
  });
  test('퀴즈 정답률', () => assert.deepEqual(s.quiz[0], { n: 3, rate: 0.67 }));
  test('3명 미만이면 학생에게 숨긴다', () => {
    assert.equal(C.visibleStat({ n: 2 }), false);
    assert.equal(C.visibleStat({ n: 3 }), true);
    const s2 = plain(C.summarize(rs.slice(0, 2), CASES, QUIZ, MODULES));
    assert.deepEqual(plain(C.weakestKeyPoints(s2, CASES)), []);
    assert.equal(C.weakestKeyPoints(s, CASES, 2).length, 2);
  });
  test('집계에는 학생 id나 개인 점수가 없다', () => {
    assert.ok(!JSON.stringify(s).includes('"100"') && !('people' in s) && !('ids' in s));
  });
});
