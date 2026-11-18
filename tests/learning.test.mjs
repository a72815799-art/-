// 학습 효과·신뢰도 계산 테스트. 통계는 문헌의 공개 예제 값과 대조한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load.mjs';

const app = loadApp();
const { LEARN: L, ASSESS, BENCHMARK, GRADE_DOMAINS, CASES, CLASSDATA: C, QUIZ, MODULES } = app;
const plain = x => JSON.parse(JSON.stringify(x));
const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

describe('신뢰도 통계', () => {
  test('ICC(1,1)과 ICC(1,k): Shrout·Fleiss(1979) 예제 6명 × 평정자 4명', () => {
    const data = [[9,2,5,8],[6,1,3,2],[8,4,6,8],[7,1,2,6],[10,5,6,9],[6,2,4,7]];
    const r = L.icc1(data);
    close(r.single, 0.17); close(r.average, 0.44);
  });
  test('완전히 일관된 반복 채점은 ICC 1', () => assert.equal(L.icc1([[10,10],[20,20],[30,30]]).single, 1));
  test('이차 가중 카파: 완전 일치 1, 우연 수준 0, 반대 방향은 음수', () => {
    assert.equal(L.qwk([0,1,2,3,4,5],[0,1,2,3,4,5]), 1);
    assert.equal(L.qwk([0,0,1,1],[0,1,0,1],0,1), 0);
    assert.ok(L.qwk([0,1,2,3,4,5],[5,4,3,2,1,0]) < 0);
  });
  test('Spearman: 단조 관계 1, 동점은 평균 순위', () => {
    assert.equal(L.spearman([1,2,3,4],[10,20,30,100]), 1);
    assert.deepEqual(plain(L.ranks([10,20,20,30])), [1,2.5,2.5,4]);
  });
  test('Pearson과 MAE', () => { assert.equal(L.pearson([1,2,3],[2,4,6]), 1); assert.equal(L.mae([10,20],[12,17]), 2.5); });
});

describe('사전·사후 통계', () => {
  test('대응표본 차이, 효과크기, 95% 신뢰구간, 정규화 향상도', () => {
    const r = L.paired([40,50,60,70],[55,60,80,75]);   // 차이 15,10,20,5
    assert.equal(r.diff, 12.5); assert.equal(r.sd, 6.5);
    close(r.dz, 1.94); close(r.t, 3.87);
    assert.deepEqual(plain(r.ci), [2.2, 22.8]);
    close(r.hake, 0.28);
  });
  test('Hake 향상도', () => { assert.equal(L.hake(40, 70), 0.5); assert.equal(L.hake(100, 100), null); });
  test('평행형 배정은 서로 다른 형', () => { assert.equal(L.otherForm('A'), 'B'); assert.equal(L.otherForm('B'), 'A'); });
  test('채점과 영역 점수', () => {
    const items = ASSESS.forms.A; const all = items.map(it => it.c);
    const r = L.scoreForm(items, all); assert.equal(r.pct, 100);
    for (const d of ASSESS.domains) assert.equal(r.domains[d], 100);
    assert.equal(L.scoreForm(items, items.map(() => null)).pct, 0);
  });
});

describe('간격 반복(SM-2)', () => {
  const now = 0, D = L.DAY;
  test('맞히면 간격이 1일 → 6일 → 늘어난다', () => {
    let c = L.sm2(null, 4, now); assert.equal(c.interval, 1);
    c = L.sm2(c, 4, now); assert.equal(c.interval, 6);
    c = L.sm2(c, 4, now); assert.equal(c.interval, 15);
  });
  test('틀리면 처음부터, EF는 1.3 아래로 내려가지 않는다', () => {
    let c = L.sm2(null, 4, now); c = L.sm2(c, 4, now); c = L.sm2(c, 1, now);
    assert.equal(c.reps, 0); assert.equal(c.interval, 1);
    for (let i = 0; i < 20; i++) c = L.sm2(c, 0, now);
    assert.equal(c.ef, 1.3);
  });
  test('틀린 퀴즈만 복습 카드가 되고, 기한이 된 카드만 오늘의 복습', () => {
    const srs = L.seedFromQuiz({}, {0: true, 1: false, 2: false}, now);
    assert.deepEqual(Object.keys(srs).sort(), ['1', '2']);
    srs[2] = L.sm2(srs[2], 4, now);
    assert.deepEqual(plain(L.dueItems(srs, now)), [1]);
    assert.deepEqual(plain(L.dueItems(srs, now + D)).sort(), [1, 2]);
  });
});

describe('평가 문항과 기준 답안 데이터', () => {
  for (const f of ['A', 'B']) test(`${f}형: 16문항, 영역 배치, 정답 범위`, () => {
    const items = ASSESS.forms[f];
    assert.equal(items.length, 16);
    for (const it of items) { assert.ok(ASSESS.domains.includes(it.domain), it.q); assert.ok(it.c >= 0 && it.c < it.a.length, it.q); }
  });
  test('A형과 B형은 같은 번호에서 같은 영역을 묻는다(평행형)', () => {
    ASSESS.forms.A.forEach((it, i) => assert.equal(it.domain, ASSESS.forms.B[i].domain, `${i + 1}번`));
  });
  test('평가 문항은 퀴즈와 중복되지 않는다', () => {
    const qs = new Set(QUIZ.map(q => q.q));
    for (const f of ['A', 'B']) for (const it of ASSESS.forms[f]) assert.ok(!qs.has(it.q), it.q);
  });
  test('평가 문항의 정답이 분석기 엔진의 판정과 일치한다(코드타입 문항)', () => {
    const code = (p) => app.MMPI.analyze(Object.assign({VRIN:50,TRIN:50,F:50,Fb:50,Fp:50,L:50,K:50,S:50,Mf:50,Si:50}, p), {}).code;
    assert.equal(code({Hs:60,D:76,Hy:58,Pd:62,Pa:59,Pt:73,Sc:61,Ma:45}).key, '27');
    assert.equal(code({Hs:60,D:76,Hy:58,Pd:62,Pa:59,Pt:73,Sc:61,Ma:45}).def, 11);
    assert.equal(code({Hs:55,D:52,Hy:58,Pd:79,Pa:60,Pt:54,Sc:61,Ma:74}).def, 13);
    assert.equal(code({Hs:50,D:71,Hy:50,Pd:50,Pa:50,Pt:70,Sc:69,Ma:50}).key, '278');
    assert.equal(code({Hs:50,D:50,Hy:50,Pd:72,Pa:71,Pt:50,Sc:70,Ma:50}).key, '468');
  });
  test('기준 답안: 사례가 존재하고 우수·보통·미흡이 모두 있다', () => {
    for (const b of BENCHMARK) { assert.ok(CASES.some(c => c.id === b.caseId), b.id); assert.ok([1, 2, 3].includes(b.level)); }
    for (const id of new Set(BENCHMARK.map(b => b.caseId))) assert.deepEqual(plain(BENCHMARK.filter(b => b.caseId === id).map(b => b.level)).sort(), [1, 2, 3]);
    assert.equal(GRADE_DOMAINS.length, 9);
  });
});

describe('클래스 데이터: 사전·사후와 연구 데이터', () => {
  const pre = {form:'A', pct:50, ok:8, n:16, domains:{'타당도 판단':33}, at:10, answers:[1]};
  const post = {form:'B', pct:75, ok:12, n:16, domains:{'타당도 판단':67}, at:20, answers:[1]};
  test('병합: 사전은 먼저 본 것, 사후는 나중 것, 동의는 최근 의사', () => {
    const a = {prog:{mods:{}, quiz:{}, cases:{}, prepost:{form:'A', pre, consent:{value:true, at:30}}}, drafts:{}, drill:{}, labQuiz:{n:0,ok:0}};
    const b = {prog:{mods:{}, quiz:{}, cases:{}, prepost:{form:'A', pre:{...pre, at:5, pct:40}, post, consent:{value:false, at:40}}}, drafts:{}, drill:{}, labQuiz:{n:0,ok:0}};
    const m = plain(C.mergeLocal(a, b)).prog.prepost;
    assert.equal(m.pre.pct, 40); assert.equal(m.post.pct, 75); assert.equal(m.consent.value, false);
  });
  test('결과 요약에는 점수만, 답안 선택은 들어가지 않는다', () => {
    const L0 = C.emptyLocal(); L0.prog.prepost = {form:'A', pre, post, consent:{value:true, at:1}};
    const r = plain(C.buildResults(L0, CASES, QUIZ, MODULES));
    assert.equal(r.prepost.pre.pct, 50); assert.equal(r.consent, true);
    assert.ok(!('answers' in r.prepost.pre));
    assert.ok(C.resultActive(r), '사전 평가만 봐도 활동으로 센다');
  });
  test('반 통계의 대응표본 집계와 동의자만의 익명 연구 데이터', () => {
    const mk = (a, b, consent) => ({v:1, mods:[], quiz:{}, cases:{}, labQuiz:{n:0,ok:0}, consent, prepost:{pre:{form:'A', pct:a, domains:{}}, post:{form:'B', pct:b, domains:{}}}});
    const rs = [mk(40,55,true), mk(50,60,false), mk(60,80,true), mk(70,75,true)];
    const s = plain(C.summarize(rs, CASES, QUIZ, MODULES));
    assert.equal(s.prepost.nPaired, 4); assert.equal(s.prepost.diff, 12.5);
    const out = plain(C.researchRows(rs, CASES, QUIZ, MODULES, ASSESS.domains));
    assert.equal(out.rows.length, 3, '동의한 3명만');
    assert.deepEqual(out.rows.map(r => r[0]), ['P01','P02','P03']);
    assert.ok(!JSON.stringify(out).includes('u_'), '학생 id가 없어야 한다');
    const csv = C.toCSV(out); assert.ok(csv.startsWith('﻿참여자,'), '엑셀 한글 깨짐 방지 BOM');
  });
});
