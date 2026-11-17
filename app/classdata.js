/* 클래스 모드 데이터 모듈 (화면·저장소와 분리된 순수 함수). window.CLASSDATA
   저장 구조 (artifact db):
     data/users/<id>/progress   개인 기록 전체(답안 포함). 본인만 읽고 씀 → 기기 간 동기화
     results/<id>               개인 성적 요약(답안 텍스트 없음). 본인이 쓰고, 운영자(소유자·편집자)만 읽음
     class/summary              반 통계(집계값만). 운영자가 계산해 쓰고, 모두 읽음
     class/assignments          과제 목록. 운영자가 쓰고, 모두 읽음 */
(function(){
const SCHEMA = 1;
const MIN_N = 3;   // 학생에게 반 통계를 보여 주는 최소 제출 인원(개인 식별 방지)

/* 로컬 기록 묶음: {prog:{mods,quiz,cases}, drafts:{caseId:{...,_at}}, drill:{i:bool}, labQuiz:{n,ok}} */
function emptyLocal(){ return {prog:{mods:{}, quiz:{}, cases:{}}, drafts:{}, drill:{}, labQuiz:{n:0, ok:0}}; }

/* 두 기기의 기록을 합친다. 원칙: 아무것도 잃지 않는다.
   - 완료한 모듈: 합집합
   - 퀴즈·O/X: 양쪽에 있으면 a(이 기기)를 우선, 한쪽에만 있으면 그것
   - 사례 점수·답안: 더 최근(at / _at) 것
   - 실험실 맞히기: 문항 수가 더 많은 쪽 */
function mergeLocal(a, b){
  a = a || emptyLocal(); b = b || emptyLocal();
  const out = emptyLocal();
  out.prog.mods = Object.assign({}, b.prog?.mods, a.prog?.mods);
  out.prog.quiz = Object.assign({}, b.prog?.quiz, a.prog?.quiz);
  const cases = Object.assign({}, b.prog?.cases);
  for (const [id, v] of Object.entries(a.prog?.cases || {})) if (!cases[id] || (v.at || 0) >= (cases[id].at || 0)) cases[id] = v;
  out.prog.cases = cases;
  const drafts = Object.assign({}, b.drafts);
  for (const [id, v] of Object.entries(a.drafts || {})) if (!drafts[id] || (v._at || 0) >= (drafts[id]._at || 0)) drafts[id] = v;
  out.drafts = drafts;
  out.drill = Object.assign({}, b.drill, a.drill);
  const la = a.labQuiz || {n:0, ok:0}, lb = b.labQuiz || {n:0, ok:0};
  out.labQuiz = la.n >= lb.n ? {n:la.n, ok:la.ok} : {n:lb.n, ok:lb.ok};
  return out;
}

/* 키워드 대조(사례 화면의 자가 점검과 같은 규칙) */
const norm = s => String(s || '').toLowerCase().replace(/[\s\-·]/g, '');
function keyPointHits(c, draft){
  const txt = norm(Object.entries(draft || {}).filter(([k]) => !k.startsWith('_')).map(([, v]) => v).join('\n'));
  return c.keyPoints.map(k => k.kw.some(w => txt.includes(norm(w))));
}

/* 학습 활동이 하나라도 있는지(페이지만 열어 본 사람은 명단과 통계에 넣지 않는다) */
function hasActivity(local){
  const L = local || {}; const p = L.prog || {};
  return Object.keys(p.mods || {}).length + Object.keys(p.quiz || {}).length + Object.keys(p.cases || {}).length + Object.keys(L.drill || {}).length + ((L.labQuiz && L.labQuiz.n) || 0) > 0;
}
const resultActive = r => !!r && ((r.mods || []).length + Object.keys(r.quiz || {}).length + Object.keys(r.cases || {}).length + Object.keys(r.drill || {}).length + ((r.labQuiz && r.labQuiz.n) || 0)) > 0;

/* 운영자에게 보내는 성적 요약. 답안 텍스트는 넣지 않는다. */
function buildResults(local, CASES, QUIZ, MODULES){
  const L = local || emptyLocal();
  const cases = {};
  for (const c of CASES) {
    const r = L.prog.cases[c.id]; if (!r) continue;
    cases[c.id] = {score: r.score || 0, at: r.at || 0, hits: keyPointHits(c, L.drafts[c.id]).map(h => h ? 1 : 0)};
  }
  const quiz = {};
  for (const [i, ok] of Object.entries(L.prog.quiz)) if (QUIZ[i]) quiz[i] = ok ? 1 : 0;
  const mods = Object.keys(L.prog.mods).filter(id => MODULES.some(m => m.id === id)).sort();
  return {v: SCHEMA, mods, quiz, cases, labQuiz: {n: L.labQuiz.n | 0, ok: L.labQuiz.ok | 0}, drill: Object.fromEntries(Object.entries(L.drill).map(([k, v]) => [k, v ? 1 : 0]))};
}

/* 개인 진도 요약 (명단 표시용) */
function personStats(r, CASES, QUIZ, MODULES){
  const cs = Object.values(r.cases || {});
  const q = Object.values(r.quiz || {});
  const last = Math.max(0, ...cs.map(c => c.at || 0), r.updatedAt ? Date.parse(r.updatedAt) || 0 : 0);
  return {
    mods: (r.mods || []).length, modsTotal: MODULES.length,
    cases: cs.length, casesTotal: CASES.length,
    avgCase: cs.length ? Math.round(cs.reduce((a, c) => a + c.score, 0) / cs.length) : null,
    quizN: q.length, quizRate: q.length ? q.reduce((a, b) => a + b, 0) / q.length : null,
    last,
  };
}

/* 반 통계: 결과 문서들 → 집계(개인을 식별할 수 있는 값 없음) */
function summarize(resultsList, CASES, QUIZ, MODULES){
  const rs = (resultsList || []).filter(r => r && r.v === SCHEMA && resultActive(r));
  const cases = {};
  for (const c of CASES) {
    const subs = rs.map(r => r.cases && r.cases[c.id]).filter(Boolean);
    if (!subs.length) { cases[c.id] = {n: 0}; continue; }
    const kp = c.keyPoints.map((_, i) => subs.reduce((a, s) => a + (s.hits && s.hits[i] ? 1 : 0), 0) / subs.length);
    cases[c.id] = {n: subs.length, mean: Math.round(subs.reduce((a, s) => a + s.score, 0) / subs.length), kp: kp.map(x => Math.round(x * 100) / 100)};
  }
  const quiz = {};
  QUIZ.forEach((_, i) => {
    const xs = rs.map(r => r.quiz && r.quiz[i]).filter(x => x === 0 || x === 1);
    if (xs.length) quiz[i] = {n: xs.length, rate: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 100) / 100};
  });
  const lab = rs.reduce((a, r) => ({n: a.n + (r.labQuiz?.n || 0), ok: a.ok + (r.labQuiz?.ok || 0)}), {n: 0, ok: 0});
  const ps = rs.map(r => personStats(r, CASES, QUIZ, MODULES));
  const avg = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  return {
    v: SCHEMA, students: rs.length,
    progress: {mods: avg(ps.map(p => p.mods / p.modsTotal)), cases: avg(ps.map(p => p.cases / p.casesTotal))},
    cases, quiz, lab,
  };
}

/* 학생에게 보여 줄 통계만 남긴다(제출 인원이 MIN_N 미만인 항목은 숨김) */
function visibleStat(stat){ return !!stat && stat.n >= MIN_N; }

/* 가장 많이 놓친 핵심 포인트 */
function weakestKeyPoints(summary, CASES, top = 3){
  const out = [];
  for (const c of CASES) {
    const s = summary?.cases?.[c.id]; if (!visibleStat(s)) continue;
    s.kp.forEach((rate, i) => out.push({caseId: c.id, i, rate, n: s.n, point: c.keyPoints[i].point, domain: c.keyPoints[i].domain}));
  }
  return out.sort((a, b) => a.rate - b.rate).slice(0, top);
}

/* 같은 내용인지(쓸데없는 쓰기를 막기 위해) */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

window.CLASSDATA = {SCHEMA, MIN_N, emptyLocal, hasActivity, resultActive, mergeLocal, keyPointHits, buildResults, personStats, summarize, visibleStat, weakestKeyPoints, same};
})();
