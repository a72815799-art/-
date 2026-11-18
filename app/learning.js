/* 학습 효과·신뢰도 계산 모듈 (화면과 분리된 순수 함수). window.LEARN
   - 간격 반복(SM-2), 사전·사후 평가 채점, 향상도(Hake 정규화 향상도, 대응표본 효과크기 dz)
   - 신뢰도: ICC(1,1)/ICC(1,k), Spearman 순위상관, Pearson r, 이차 가중 카파, MAE */
(function(){
const DAY = 864e5;
const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const sd = xs => { if (xs.length < 2) return null; const m = mean(xs); return Math.sqrt(xs.reduce((a,x)=>a+(x-m)**2,0)/(xs.length-1)); };
const round = (x, d=2) => x===null || x===undefined || !isFinite(x) ? null : Math.round(x * 10**d) / 10**d;

/* ── 간격 반복: SM-2 (Wozniak). quality 0~5, 3 미만이면 처음부터 다시 ── */
function sm2(card, quality, now){
  const c = Object.assign({ef:2.5, reps:0, interval:0, due:0}, card || {});
  const q = Math.max(0, Math.min(5, quality));
  if (q < 3) { c.reps = 0; c.interval = 1; }
  else { c.reps += 1; c.interval = c.reps === 1 ? 1 : c.reps === 2 ? 6 : Math.round(c.interval * c.ef); }
  c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  c.due = now + c.interval * DAY; c.at = now;
  return c;
}
/* 퀴즈 결과로 복습 카드 만들기: 틀린 문항은 지금 복습 대상, 맞힌 문항은 카드를 만들지 않는다 */
function seedFromQuiz(srs, quizMap, now){
  const out = Object.assign({}, srs);
  for (const [i, ok] of Object.entries(quizMap || {})) if (!ok && !out[i]) out[i] = {ef:2.5, reps:0, interval:0, due:now, at:now};
  return out;
}
const dueItems = (srs, now) => Object.entries(srs || {}).filter(([,c]) => c.due <= now).sort((a,b)=>a[1].due-b[1].due).map(([i])=>+i);

/* ── 사전·사후 평가 ── */
function scoreForm(items, answers){
  const domains = {}; let ok = 0;
  items.forEach((it, i) => {
    const d = domains[it.domain] || (domains[it.domain] = {ok:0, n:0});
    d.n++; if (answers[i] === it.c) { d.ok++; ok++; }
  });
  const dp = Object.fromEntries(Object.entries(domains).map(([k,v]) => [k, Math.round(v.ok / v.n * 100)]));
  return {ok, n: items.length, pct: Math.round(ok / items.length * 100), domains: dp};
}
/* 평행형 배정: 사전 A면 사후 B, 사전 B면 사후 A(순서 효과 상쇄) */
const otherForm = f => f === 'A' ? 'B' : 'A';
/* Hake 정규화 향상도: 얻을 수 있었던 향상 중 실제로 얻은 비율 */
const hake = (pre, post) => pre >= 100 ? null : (post - pre) / (100 - pre);

/* 대응표본 요약: 평균 차이, 표준편차, 효과크기 dz, 95% 신뢰구간(t 분포) */
const T975 = [null,12.71,4.30,3.18,2.78,2.57,2.45,2.36,2.31,2.26,2.23,2.20,2.18,2.16,2.14,2.13,2.12,2.11,2.10,2.09,2.09,2.08,2.07,2.07,2.06,2.06,2.06,2.05,2.05,2.05,2.04];
const tcrit = df => df < 1 ? null : df <= 30 ? T975[df] : df <= 60 ? 2.00 : 1.98;
function paired(pre, post){
  const n = Math.min(pre.length, post.length); if (n < 2) return {n};
  const d = pre.slice(0, n).map((x, i) => post[i] - x);
  const md = mean(d), s = sd(d), se = s / Math.sqrt(n), tc = tcrit(n - 1);
  const gains = pre.slice(0, n).map((x, i) => hake(x, post[i])).filter(g => g !== null);
  return {n, preMean: round(mean(pre.slice(0,n)),1), postMean: round(mean(post.slice(0,n)),1), diff: round(md,1), sd: round(s,1),
    dz: s > 0 ? round(md / s) : null, t: s > 0 ? round(md / se) : null, ci: s > 0 ? [round(md - tc * se,1), round(md + tc * se,1)] : null,
    hake: round(mean(gains))};
}
/* 효과크기 해석(Cohen 관례) */
const effectLabel = d => d === null ? '-' : Math.abs(d) < 0.2 ? '매우 작음' : Math.abs(d) < 0.5 ? '작음' : Math.abs(d) < 0.8 ? '중간' : '큼';

/* ── 신뢰도 ── */
/* ICC(1,1), ICC(1,k): 일원 무선효과. rows = 대상(답안), 각 행 = 같은 답안을 여러 번 채점한 점수 */
function icc1(rows){
  const R = rows.filter(r => r.length >= 2);
  if (R.length < 2) return null;
  const k = Math.min(...R.map(r => r.length)), M = R.map(r => r.slice(0, k)), n = M.length;
  const grand = mean(M.flat());
  const msb = k * M.reduce((a, r) => a + (mean(r) - grand) ** 2, 0) / (n - 1);
  const msw = M.reduce((a, r) => { const m = mean(r); return a + r.reduce((b, x) => b + (x - m) ** 2, 0); }, 0) / (n * (k - 1));
  if (msb + (k - 1) * msw === 0) return null;
  return {single: round((msb - msw) / (msb + (k - 1) * msw)), average: msb > 0 ? round((msb - msw) / msb) : null, n, k};
}
const iccLabel = v => v === null ? '-' : v < 0.5 ? '낮음' : v < 0.75 ? '보통' : v < 0.9 ? '좋음' : '매우 좋음';   // Koo & Li(2016)

function ranks(xs){
  const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = Array(xs.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; }
  return r;
}
function pearson(x, y){
  const n = Math.min(x.length, y.length); if (n < 3) return null;
  const mx = mean(x.slice(0,n)), my = mean(y.slice(0,n)); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i]-mx)*(y[i]-my); sxx += (x[i]-mx)**2; syy += (y[i]-my)**2; }
  return sxx && syy ? round(sxy / Math.sqrt(sxx * syy)) : null;
}
const spearman = (x, y) => pearson(ranks(x), ranks(y));
const mae = (x, y) => { const n = Math.min(x.length, y.length); return n ? round(x.slice(0,n).reduce((a, v, i) => a + Math.abs(v - y[i]), 0) / n) : null; };

/* 이차 가중 카파: 정수 점수 a, b (같은 길이), 범위 lo~hi */
function qwk(a, b, lo = 0, hi = 5){
  const n = Math.min(a.length, b.length); if (n < 2) return null;
  const K = hi - lo + 1, O = Array.from({length:K}, () => Array(K).fill(0)), ha = Array(K).fill(0), hb = Array(K).fill(0);
  for (let i = 0; i < n; i++) { const x = Math.round(a[i]) - lo, y = Math.round(b[i]) - lo; if (x < 0 || y < 0 || x >= K || y >= K) continue; O[x][y]++; ha[x]++; hb[y]++; }
  let num = 0, den = 0;
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) { const w = (i - j) ** 2 / (K - 1) ** 2; num += w * O[i][j]; den += w * ha[i] * hb[j] / n; }
  return den === 0 ? null : round(1 - num / den);
}
const kappaLabel = k => k === null ? '-' : k < 0.2 ? '약함' : k < 0.4 ? '보통 이하' : k < 0.6 ? '보통' : k < 0.8 ? '상당함' : '거의 완전';   // Landis & Koch(1977)

/* ── 학습 대시보드: 영역별 숙달도, 활동 일수, 추천 ── */
const DOMAIN_MAP = [
  {k:'기초 이론', mods:['m01','m02'], lv:[1], cases:[], ev:[]},
  {k:'타당도 판단', mods:['m03'], lv:[2], cases:['c05','c06','c11','c15','c19','c20'], ev:['ev-overreport','ev-fbs','ev-underreport','ev-noncontent'], assess:'타당도 판단'},
  {k:'코드타입', mods:['m04','m05'], lv:[3,4], cases:['c01','c02','c03','c04','c07','c08','c09','c17'], ev:['ev-codedef','ev-cookbook'], assess:'코드타입'},
  {k:'정교화(하위척도·RC)', mods:['m06','m17'], lv:[5], cases:['c10','c12','c18'], ev:['ev-rc','ev-rf3'], assess:'정교화(하위척도·RC)'},
  {k:'내용·보충척도', mods:['m07','m08'], lv:[5], cases:['c03','c07','c17'], ev:['ev-content'], assess:'내용·보충척도'},
  {k:'위험·보고서', mods:['m09','m10','m11','m18','m19','m20'], lv:[6], cases:['c14','c12','c05'], ev:['ev-culture'], assess:'위험·보고서'},
  {k:'청소년(MMPI-A)', mods:['m12','m13','m14','m15','m16'], lv:[8], cases:['c13','c14','c15','c16','c20'], ev:['ev-adolescent'], assess:'청소년(MMPI-A)'},
];
/* 영역별 기록. score는 있는 지표(퀴즈 정답률, 사례 평균, 평가 점수)의 평균이며, 지표가 하나도 없으면 null */
function domainStats(prog, quiz, evRead){
  const P = prog || {}, Q = quiz || [], E = evRead || {};
  const pp = P.prepost || {}; const latest = pp.post || pp.pre || null;
  return DOMAIN_MAP.map(d => {
    const modsDone = d.mods.filter(m => (P.mods || {})[m]).length;
    const qi = Q.map((q, i) => [q, i]).filter(([q]) => d.lv.includes(q.lv)).map(([, i]) => i);
    const qa = qi.filter(i => (P.quiz || {})[i] !== undefined); const qok = qa.filter(i => P.quiz[i]).length;
    const cs = d.cases.map(c => (P.cases || {})[c]).filter(Boolean);
    const quizPct = qa.length ? Math.round(qok / qa.length * 100) : null;
    const casePct = cs.length ? Math.round(mean(cs.map(c => c.score))) : null;
    const assessPct = latest && d.assess && latest.domains && latest.domains[d.assess] !== undefined ? latest.domains[d.assess] : null;
    const parts = [quizPct, casePct, assessPct].filter(x => x !== null);
    return {k: d.k, mods: [modsDone, d.mods.length], quiz: {n: qa.length, total: qi.length, pct: quizPct}, cases: {n: cs.length, total: d.cases.length, pct: casePct},
      assess: assessPct, ev: [d.ev.filter(e => E[e]).length, d.ev.length], score: parts.length ? Math.round(mean(parts)) : null,
      coverage: Math.round((modsDone + cs.length + d.ev.filter(e => E[e]).length) / Math.max(1, d.mods.length + d.cases.length + d.ev.length) * 100)};
  });
}
/* 보완할 영역: 점수가 있으면 가장 낮은 점수, 없으면 가장 덜 다룬 영역(기초는 끝났으면 제외) */
function weakest(stats){
  const scored = stats.filter(s => s.score !== null);
  if (scored.length) return scored.slice().sort((a, b) => a.score - b.score || a.coverage - b.coverage)[0];
  return stats.slice().sort((a, b) => a.coverage - b.coverage)[0];
}
/* 영역의 다음 학습 거리: 아직 안 한 모듈, 사례, 연구 쟁점 중 첫 번째 */
function nextSteps(domainKey, prog, evRead){
  const d = DOMAIN_MAP.find(x => x.k === domainKey); if (!d) return {};
  const P = prog || {}, E = evRead || {};
  return {module: d.mods.find(m => !(P.mods || {})[m]) || null, case: d.cases.find(c => !(P.cases || {})[c]) || null, ev: d.ev.find(e => !E[e]) || null};
}
/* 활동한 날(YYYY-MM-DD 집합)에서 총 일수와 오늘(또는 어제)까지 이어진 연속 일수 */
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function streak(days, now){
  const set = new Set(days); let n = 0; let t = now;
  if (!set.has(ymd(t))) t -= DAY;            // 오늘 아직 안 했어도 어제까지 이어졌으면 유지
  while (set.has(ymd(t))) { n++; t -= DAY; }
  return {total: set.size, current: n};
}

window.LEARN = {DOMAIN_MAP, domainStats, weakest, nextSteps, ymd, streak, DAY, mean, sd, round, sm2, seedFromQuiz, dueItems, scoreForm, otherForm, hake, paired, effectLabel, icc1, iccLabel, ranks, pearson, spearman, mae, qwk, kappaLabel, tcrit};
})();
