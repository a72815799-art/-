/* 실험실 계산 모듈 (화면과 분리된 순수 함수). window.MMPILAB
   1) 응답 양식 모형: 무선반응·고정반응·과대보고·과소보고가 척도 점수를 어떻게 움직이는지 계산
   2) 측정오차 모형: 재검사에서 코드타입이 유지될 확률(몬테카를로), 신뢰할 수 있는 변화 지수(RCI)

   주의: 교육용 단순화 모형이다. 척도별 문항 수는 MMPI-2 공개 자료, "그렇다" 채점 비율과 규준 평균·표준편차는
   방향과 크기를 보여 주기 위한 근사치이며 실제 채점 키나 규준이 아니다. K 교정은 반영하지 않는다. */
(function(){
const NUM = {Hs:'1',D:'2',Hy:'3',Pd:'4',Mf:'5',Pa:'6',Pt:'7',Sc:'8',Ma:'9',Si:'0'};
const CODE_SCALES = ['Hs','D','Hy','Pd','Pa','Pt','Sc','Ma'];

/* ── 척도 모형 ──
   n: 문항 수, tk: "그렇다"로 채점되는 문항 비율(근사), m: 규준 집단의 평균 채점 비율(근사), sd: 규준 원점수 표준편차(근사)
   bad: 증상을 과장할 때 채점 방향으로 응답하는 비율, good: 좋게 보이려 할 때 채점 방향으로 응답하는 비율 */
const MODEL = {
  L:  {n:15, tk:0.00, m:0.23, sd:2.2, bad:0.10, good:0.75},
  F:  {n:60, tk:0.70, m:0.07, sd:3.5, bad:0.55, good:0.01},
  Fb: {n:40, tk:0.75, m:0.05, sd:2.5, bad:0.55, good:0.01},
  Fp: {n:27, tk:0.75, m:0.04, sd:1.2, bad:0.45, good:0.00},
  FBS:{n:43, tk:0.50, m:0.28, sd:4.5, bad:0.70, good:0.15},
  K:  {n:30, tk:0.03, m:0.50, sd:5.0, bad:0.15, good:0.85},
  S:  {n:50, tk:0.02, m:0.60, sd:7.0, bad:0.15, good:0.90},
  Hs: {n:32, tk:0.34, m:0.16, sd:4.0, bad:0.75, good:0.03},
  D:  {n:57, tk:0.35, m:0.32, sd:5.0, bad:0.75, good:0.15},
  Hy: {n:60, tk:0.22, m:0.35, sd:5.0, bad:0.70, good:0.45},
  Pd: {n:50, tk:0.48, m:0.30, sd:4.5, bad:0.75, good:0.12},
  Mf: {n:56, tk:0.45, m:0.46, sd:5.0, bad:null, good:null},
  Pa: {n:40, tk:0.63, m:0.25, sd:3.0, bad:0.75, good:0.15},
  Pt: {n:48, tk:0.81, m:0.23, sd:7.0, bad:0.80, good:0.02},
  Sc: {n:78, tk:0.76, m:0.14, sd:8.0, bad:0.75, good:0.02},
  Ma: {n:46, tk:0.76, m:0.37, sd:4.5, bad:0.60, good:0.20},
  Si: {n:69, tk:0.32, m:0.36, sd:9.0, bad:0.60, good:0.15},
};
const VRIN_PAIRS = 67, VRIN_BASE = 5, VRIN_SD = 2.5;   // 비일관 응답 쌍 수(근사)
const TRIN_PAIRS = 23, TRIN_SD = 2.2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = x => Math.round(x);

/* 기준 프로파일의 T점수 → 내용에 맞게 응답할 때 채점 방향으로 응답할 확률 */
function contentProb(k, T){
  const s = MODEL[k];
  const t = (T===undefined || T===null || T==='') ? 50 : Number(T);
  return clamp(s.m + (t - 50) / 10 * s.sd / s.n, 0, 1);
}
/* 채점 방향 응답 확률 → T점수 (화면 표시 범위 30~120) */
function toT(k, p){
  const s = MODEL[k];
  return clamp(round(50 + 10 * (p * s.n - s.m * s.n) / s.sd), 30, 120);
}

/* 응답 양식을 섞어 기대 프로파일을 계산한다.
   mix = {random 0~1, bias -1(모두 아니다)~1(모두 그렇다), over 0~1, under 0~1}
   random + |bias| 는 1을 넘지 않도록 비율을 맞춘다. 나머지는 내용에 따른 응답이며, 여기에 과대·과소보고가 작용한다. */
function simulate(base, mix){
  let r = clamp(mix.random || 0, 0, 1), b = clamp(mix.bias || 0, -1, 1);
  const tot = r + Math.abs(b); if (tot > 1) { r /= tot; b /= tot; }
  const yea = Math.max(b, 0), nay = Math.max(-b, 0), content = 1 - r - yea - nay;
  const over = clamp(mix.over || 0, 0, 1), under = clamp(mix.under || 0, 0, 1);
  const out = {CNS: 0, TRINdir: b >= 0 ? 'T' : 'F'};
  for (const k of Object.keys(MODEL)) {
    const s = MODEL[k];
    let pc = contentProb(k, base[k]);
    if (s.bad !== null) pc = pc * (1 - over) + s.bad * over;
    if (s.good !== null) pc = pc * (1 - under) + s.good * under;
    const p = content * pc + r * 0.5 + yea * s.tk + nay * (1 - s.tk);
    out[k] = toT(k, p);
  }
  // VRIN: 무선반응일수록 짝 문항에 반대로 답한다. 내용 응답자의 기본 비일관성은 기준 VRIN에서 가져온다.
  const baseInc = VRIN_BASE + ((base.VRIN ?? 50) - 50) / 10 * VRIN_SD;
  const inc = (content + yea + nay) * baseInc + r * VRIN_PAIRS * 0.5;
  out.VRIN = clamp(round(50 + 10 * (inc - VRIN_BASE) / VRIN_SD), 30, 120);
  // TRIN: 한쪽으로 몰아 답한 정도
  const dev = (yea - nay) * TRIN_PAIRS * 0.9;
  out.TRIN = clamp(round(50 + 10 * Math.abs(dev) / TRIN_SD), 50, 120);
  return out;
}

/* ── 코드타입 결정 (engine.js의 analyze와 같은 규칙; 테스트로 일치를 검증한다) ── */
function codeOf(p, version, codetypes){
  const CT = codetypes || (typeof window !== 'undefined' ? window.CODETYPES : {}) || {};
  const r = CODE_SCALES.filter(k => p[k] !== undefined && p[k] !== null && p[k] !== '')
    .map(k => ({k, t: Number(p[k])})).sort((a, b) => b.t - a.t);
  if (r.length < 3) return {key: null, def: null};
  const [top, sec, thd, fth] = r;
  if (version === 'A') {
    if (top.t < 65) return {key: 'WNL', def: null};
    if (sec.t < 65) return {key: NUM[top.k], def: top.t - sec.t};
    return {key: [NUM[top.k], NUM[sec.k]].sort().join(''), def: thd ? sec.t - thd.t : null};
  }
  if (top.t < 65) return {key: 'WNL', def: null};
  if (sec.t < 65) return {key: NUM[top.k], def: top.t - sec.t};
  if (thd && thd.t >= 65) {
    const k3 = [NUM[top.k], NUM[sec.k], NUM[thd.k]].sort().join('');
    if (CT[k3]) return {key: k3, def: fth ? thd.t - fth.t : null};
  }
  return {key: [NUM[top.k], NUM[sec.k]].sort().join(''), def: thd ? sec.t - thd.t : null};
}
function codeLabel(key){
  if (!key) return '-';
  if (key === 'WNL') return '정상 범위';
  if (key.length === 1) return key + ' 단독';
  return key.split('').join('-');
}

/* ── 난수: 시드 고정(같은 입력이면 같은 결과, 테스트 가능) ── */
function rng(seed){
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let spare = null;
  u.normal = () => { if (spare !== null) { const s = spare; spare = null; return s; }
    let x, y, q; do { x = u() * 2 - 1; y = u() * 2 - 1; q = x * x + y * y; } while (q === 0 || q >= 1);
    const f = Math.sqrt(-2 * Math.log(q) / q); spare = y * f; return x * f; };
  return u;
}

/* 재검사 시뮬레이션: 각 척도에 재검사 차이의 표준편차(√2 × SEM)만큼 잡음을 더해 코드타입을 다시 정한다.
   반환: 원래 코드, 유지 확률, 가장 높은 척도 유지 확률, 재검사 코드 분포(빈도순) */
function retest(p, {sem = 5, n = 2000, seed = 1, version} = {}){
  const g = rng(seed), sd = Math.SQRT2 * sem;
  const orig = codeOf(p, version);
  const hiOf = q => CODE_SCALES.filter(k => q[k] !== undefined).reduce((a, k) => (a === null || Number(q[k]) > Number(q[a])) ? k : a, null);
  const origHi = hiOf(p);
  // 2개 척도 코드 기준 유지: 원래 코드의 상위 두 척도가 재검사에서도 상위 두 척도이고 둘 다 65 이상(세 번째 척도가 65를 넘어 3개 척도 코드가 되어도 유지로 본다)
  const top2 = q => CODE_SCALES.filter(k => q[k] !== undefined).sort((a, b) => Number(q[b]) - Number(q[a])).slice(0, 2);
  const origPair = top2(p).sort().join(','), pairOk = top2(p).every(k => Number(p[k]) >= 65);
  const counts = {}; let same = 0, sameHi = 0, samePair = 0;
  for (let i = 0; i < n; i++) {
    const q = {};
    for (const k of CODE_SCALES) if (p[k] !== undefined && p[k] !== null && p[k] !== '') q[k] = Math.round(Number(p[k]) + g.normal() * sd);
    const c = codeOf(q, version).key;
    counts[c] = (counts[c] || 0) + 1;
    if (c === orig.key) same++;
    if (hiOf(q) === origHi) sameHi++;
    const t2 = top2(q); if (pairOk && t2.sort().join(',') === origPair && t2.every(k => q[k] >= 65)) samePair++;
  }
  const dist = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, c]) => ({key, p: c / n}));
  return {orig, pSame: same / n, pSameHigh: sameHi / n, pSamePair: pairOk ? samePair / n : null, dist, n, sem};
}

/* 정의 수준별 안정성 곡선: 두 척도 T 75와 (75-def)… 대신, 코드 두 척도는 75·74, 세 번째 척도를 74-def로 둔 가상 프로파일 */
function definitionCurve({sem = 5, n = 1000, seed = 7, maxDef = 15} = {}){
  const pts = [];
  for (let d = 0; d <= maxDef; d++) {
    const p = {Hs: 50, D: 75, Hy: 50, Pd: 50, Pa: 50, Pt: 74, Sc: 74 - d, Ma: 50};
    // 3개 척도 코드(2-7-8)가 사전에 있으므로, 세 번째 척도가 65 이상이면 엔진이 3개 척도 코드로 본다.
    // 곡선은 "2-7 계열이 유지되는가"를 보기 위해 2·7이 상위 두 척도로 남는 비율을 센다.
    const g = rng(seed + d), sd = Math.SQRT2 * sem; let keep = 0;
    for (let i = 0; i < n; i++) {
      const q = {}; for (const k of CODE_SCALES) q[k] = p[k] + g.normal() * sd;
      const top2 = CODE_SCALES.slice().sort((a, b) => q[b] - q[a]).slice(0, 2).sort().join(',');
      if (top2 === 'D,Pt') keep++;
    }
    pts.push({def: d, p: keep / n});
  }
  return pts;
}

/* 신뢰할 수 있는 변화 지수 (Jacobson & Truax): RCI = (x2 - x1) / (√2 × SEM) */
function rci(x1, x2, sem){
  const v = (Number(x2) - Number(x1)) / (Math.SQRT2 * Number(sem));
  return {rci: v, reliable: Math.abs(v) >= 1.96, minChange: Math.ceil(1.96 * Math.SQRT2 * Number(sem))};
}
/* 신뢰도로부터 SEM: SEM = SD × √(1 - r), T점수 SD = 10 */
const semFromReliability = r => 10 * Math.sqrt(1 - Number(r));

window.MMPILAB = {MODEL, simulate, codeOf, codeLabel, retest, definitionCurve, rci, semFromReliability, rng, CODE_SCALES};
})();
