// 연구 근거 데이터 무결성: 인용이 모두 문헌 목록에 있고, 연결된 척도·모듈·사례가 실제로 존재하는지.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load.mjs';

const app = loadApp();
const { REFS, EVIDENCE, CASE_EVIDENCE, VIDEOS, VIDEO_SCRIPTS, CASES, MODULES, SCALES, SCALES_A } = app;
const KINDS = ['meta', 'empirical', 'manual', 'book', 'review', 'korean'];
const ids = new Set(Object.keys(REFS));

describe('문헌 목록', () => {
  test('모든 문헌에 APA 서지, 짧은 인용, 종류가 있다', () => {
    for (const [id, r] of Object.entries(REFS)) {
      assert.ok(r.apa && r.apa.length > 30, id);
      assert.ok(r.short, id);
      assert.ok(KINDS.includes(r.kind), `${id}: ${r.kind}`);
      assert.match(r.apa, /\((19|20)\d\d[a-z]?(\/\d{4})?\)/, `${id}: 연도 표기`);
    }
  });
  test('DOI 형식', () => {
    for (const [id, r] of Object.entries(REFS)) if (r.doi) assert.match(r.doi, /^10\.\d{4,9}\/\S+$/, id);
  });
  test('학술지 논문(한국 자료·단행본 제외)은 DOI가 있다', () => {
    for (const [id, r] of Object.entries(REFS)) if (['meta', 'empirical', 'review'].includes(r.kind)) assert.ok(r.doi, id);
  });
  test('모든 문헌이 어딘가에서 인용된다', () => {
    const used = new Set();
    for (const t of EVIDENCE) { t.findings.forEach(f => f[1].forEach(x => used.add(x))); (t.numbers || []).forEach(n => (n[3] || []).forEach(x => used.add(x))); (t.extraRefs || []).forEach(x => used.add(x)); }
    for (const xs of Object.values(CASE_EVIDENCE)) xs.forEach(x => x[1].forEach(y => used.add(y)));
    const unused = [...ids].filter(i => !used.has(i));
    assert.deepEqual(unused, []);
  });
});

describe('연구 쟁점', () => {
  test('id가 고유하고 ev-로 시작한다', () => {
    const xs = EVIDENCE.map(t => t.id);
    assert.equal(new Set(xs).size, xs.length);
    xs.forEach(x => assert.match(x, /^ev-/));
  });
  for (const t of EVIDENCE) test(`${t.title}: 구성과 인용`, () => {
    for (const k of ['area', 'q', 'why']) assert.ok(t[k], k);
    assert.ok(t.findings.length >= 3, '주요 결과 3개 이상');
    assert.ok(t.practice.length >= 2 && t.seminar.length >= 2);
    for (const [txt, refs] of t.findings) { assert.ok(refs.length >= 1, txt); refs.forEach(r => assert.ok(ids.has(r), r)); }
    for (const n of t.numbers || []) { assert.equal(n.length, 4); n[3].forEach(r => assert.ok(ids.has(r), r)); }
    (t.extraRefs || []).forEach(r => assert.ok(ids.has(r), r));
    assert.ok(t.findings.some(f => f[1].some(r => ['meta', 'empirical'].includes(REFS[r].kind))), '실증 근거가 하나 이상');
  });
  test('연결된 척도·모듈·사례가 존재한다', () => {
    const sc = new Set(SCALES.map(s => s.id)), scA = new Set(SCALES_A.map(s => s.id)), mo = new Set(MODULES.map(m => m.id)), ca = new Set(CASES.map(c => c.id));
    for (const t of EVIDENCE) {
      (t.links.scales || []).forEach(x => assert.ok(sc.has(x), `${t.id} 척도 ${x}`));
      (t.links.scalesA || []).forEach(x => assert.ok(scA.has(x), `${t.id} 청소년 척도 ${x}`));
      (t.links.modules || []).forEach(x => assert.ok(mo.has(x), `${t.id} 모듈 ${x}`));
      (t.links.cases || []).forEach(x => assert.ok(ca.has(x), `${t.id} 사례 ${x}`));
    }
  });
});

describe('사례 근거 노트', () => {
  test('모든 사례에 근거 노트가 3개 이상 있다', () => {
    for (const c of CASES) assert.ok((CASE_EVIDENCE[c.id] || []).length >= 3, c.id);
  });
  test('인용이 모두 문헌 목록에 있다', () => {
    for (const [id, xs] of Object.entries(CASE_EVIDENCE)) for (const [claim, refs, note] of xs) {
      assert.ok(claim && note, id); assert.ok(refs.length, `${id}: ${claim}`); refs.forEach(r => assert.ok(ids.has(r), `${id}: ${r}`));
    }
  });
  test('근거 노트의 정의도 계산이 사례 점수와 맞다', () => {
    const order = ['Hs', 'D', 'Hy', 'Pd', 'Pa', 'Pt', 'Sc', 'Ma'];
    for (const [id, xs] of Object.entries(CASE_EVIDENCE)) for (const [claim] of xs) {
      const m = claim.match(/정의도 (\d+)점\((\d+)·(\d+) 대 (\d+)\)/); if (!m) continue;
      const c = CASES.find(x => x.id === id); const p = c.p;
      const [, def, a, b, nxt] = m.map(Number);
      assert.equal(a - 0 >= b ? b - nxt : a - nxt, def, `${id}: ${claim}`);
      const top = order.map(k => p[k]).sort((x, y) => y - x);
      assert.deepEqual([top[0], top[1], top[2]], [a, b, nxt], `${id}: 상위 세 척도`);
    }
  });
});

describe('영상 자료', () => {
  test('링크는 https, 대본은 장면마다 화면 문구와 내레이션', () => {
    for (const v of VIDEOS) { assert.match(v.url, /^https:\/\//); assert.ok(v.title && v.who && v.why); }
    for (const s of VIDEO_SCRIPTS) { assert.ok(s.scenes.length >= 5); s.scenes.forEach(x => assert.ok(x[0] && x[1].length > 10)); }
  });
});
