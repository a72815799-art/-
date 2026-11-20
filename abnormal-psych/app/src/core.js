/* 이상심리학 학습앱 — 순수 로직(채점·셔플·저장·복습·음성명령 해석·검색 도우미)
 * 브라우저와 Node(vm) 양쪽에서 동작하도록 전역 Core 객체로 노출한다. */
(function (G) {
  'use strict';
  const SCHEMA_VERSION = 2;
  const STORE_KEY = 'apsy.final.v1';
  const SRS_DAYS = [1, 3, 7, 14];
  const DAY = 86400000;

  // ---------- 유틸 ----------
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function rng(seed) { // mulberry32 — 시드 고정 셔플(테스트 재현용)
    let a = (seed >>> 0) || 1;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(arr, rand) { const a = arr.slice(); rand = rand || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function setEq(a, b) { if (a.length !== b.length) return false; const s = new Set(a); return b.every(x => s.has(x)); }

  // ---------- 문제 표시 순서 ----------
  // 표시 번호(1..5) → 원래 key. 채점·기록은 항상 원래 key로 한다.
  function makeView(q, opts) {
    opts = opts || {};
    let order = q.options.map(o => o.key);
    if (q.type !== 'ox' && opts.shuffleOptions) order = shuffle(order, opts.rand);
    return { qid: q.id, order, label: k => (q.type === 'ox' ? k : String(order.indexOf(k) + 1)), keyAt: n => (q.type === 'ox' ? n : order[n - 1]) };
  }

  // ---------- 채점 ----------
  function grade(q, selectedKeys) {
    const sel = Array.from(new Set(selectedKeys || []));
    const ans = q.answer.slice();
    const perOption = q.options.map(o => {
      const picked = sel.includes(o.key);
      let status;
      if (o.in_answer && picked) status = 'hit';            // 정답 보기를 고름
      else if (o.in_answer && !picked) status = 'miss';      // 정답 보기를 놓침
      else if (!o.in_answer && picked) status = 'wrong_pick';// 오답 보기를 고름
      else status = 'ok';                                   // 오답 보기를 고르지 않음
      return { key: o.key, picked, in_answer: o.in_answer, is_true: o.is_true, status };
    });
    const correct = sel.length > 0 && setEq(sel, ans);
    const hits = perOption.filter(p => p.status === 'hit').length;
    return { correct, selected: sel, answer: ans, perOption, partial: !correct && hits > 0 };
  }

  // ---------- 저장소 ----------
  function emptyState() {
    return { schema_version: SCHEMA_VERSION, created: Date.now(), attempts: [], bookmarks: {}, srs: {}, read: {}, exams: [], audio: { pos: {}, rate: 1, auto: true }, settings: { theme: 'auto', shuffleOptions: true, ai: { provider: 'none', model: 'claude-opus-5-5', effort: 'medium', saveKey: false, dailyLimit: 30, fallbacks: true } }, usage: { ai: {} }, voiceLog: [] };
  }
  function migrate(s) {
    if (!s || typeof s !== 'object') return emptyState();
    const base = emptyState();
    let v = s.schema_version || 1;
    if (v === 1) { // v1 → v2: attempts에 mode 기본값, voiceLog/usage 추가
      (s.attempts || []).forEach(a => { if (!a.mode) a.mode = 'practice'; });
      v = 2;
    }
    const out = Object.assign(base, s, { schema_version: SCHEMA_VERSION });
    out.settings = Object.assign(base.settings, s.settings || {});
    out.settings.ai = Object.assign(emptyState().settings.ai, (s.settings || {}).ai || {});
    out.audio = Object.assign(base.audio, s.audio || {});
    out.usage = Object.assign({ ai: {} }, s.usage || {});
    for (const k of ['attempts', 'exams', 'voiceLog']) if (!Array.isArray(out[k])) out[k] = [];
    for (const k of ['bookmarks', 'srs', 'read']) if (!out[k] || typeof out[k] !== 'object') out[k] = {};
    return out;
  }
  function Store(storage) {
    this.storage = storage; this.lastError = null; this.state = emptyState();
  }
  Store.prototype.load = function () {
    try { const raw = this.storage.getItem(STORE_KEY); this.state = raw ? migrate(JSON.parse(raw)) : emptyState(); }
    catch (e) { this.lastError = '저장된 기록을 읽지 못했습니다: ' + e.message; this.state = emptyState(); }
    return this.state;
  };
  Store.prototype.save = function () {
    try { this.storage.setItem(STORE_KEY, JSON.stringify(this.state)); this.lastError = null; return true; }
    catch (e) { this.lastError = '저장 실패(' + (e.name || 'Error') + '): 저장 공간이 부족하거나 브라우저가 저장을 막았습니다. 설정에서 JSON 백업을 받아 두세요.'; return false; }
  };
  // 풀이 기록: 기존 기록을 덮어쓰지 않고 항상 추가한다.
  Store.prototype.recordAttempt = function (q, g, extra) {
    extra = extra || {};
    const prev = this.state.attempts.filter(a => a.qid === q.id);
    const a = { id: uid(), qid: q.id, ts: extra.ts || Date.now(), selected: g.selected, correct: g.correct, partial: g.partial, mode: extra.mode || 'practice', first: prev.length === 0, order: extra.order || null, ms: extra.ms || null, via: extra.via || 'touch' };
    this.state.attempts.push(a);
    updateSrs(this.state, q.id, g.correct, a.ts);
    this.save();
    return a;
  };
  function updateSrs(state, qid, correct, ts) {
    const cur = state.srs[qid];
    if (!correct) { state.srs[qid] = { stage: 0, due: ts + SRS_DAYS[0] * DAY, wrongs: (cur ? cur.wrongs : 0) + 1, done: false, last: ts }; return; }
    if (!cur || cur.done) return; // 오답 이력이 없는 문제는 복습 대상 아님
    if (ts + 1000 < cur.due - DAY / 2 && cur.stage > 0) { cur.last = ts; return; } // 예정일 전 조기 정답은 단계 유지
    const next = cur.stage + 1;
    if (next >= SRS_DAYS.length) { cur.done = true; cur.stage = next; cur.due = null; }
    else { cur.stage = next; cur.due = ts + SRS_DAYS[next] * DAY; }
    cur.last = ts;
  }
  function dueReviews(state, now) {
    now = now || Date.now();
    return Object.entries(state.srs).filter(([, s]) => !s.done && s.due && s.due <= now).map(([qid, s]) => ({ qid, ...s })).sort((a, b) => a.due - b.due);
  }

  // ---------- 백업/복원 ----------
  function exportBackup(state, meta) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.settings && s.settings.ai) delete s.settings.ai.key; // API 키는 백업에서 제외
    return { app: 'abnormal-psych-final', schema_version: SCHEMA_VERSION, exported_at: new Date().toISOString(), meta: meta || {}, data: s };
  }
  function validateBackup(obj) {
    const errs = [];
    if (!obj || typeof obj !== 'object') errs.push('JSON 객체가 아닙니다.');
    else {
      if (obj.app !== 'abnormal-psych-final') errs.push('이 프로그램의 백업 파일이 아닙니다(app 식별자 불일치).');
      if (typeof obj.schema_version !== 'number') errs.push('schema_version이 없습니다.');
      else if (obj.schema_version > SCHEMA_VERSION) errs.push('더 새로운 버전에서 만든 백업입니다(v' + obj.schema_version + '). 프로그램을 업데이트하세요.');
      const d = obj.data;
      if (!d || typeof d !== 'object') errs.push('data 항목이 없습니다.');
      else {
        if (!Array.isArray(d.attempts)) errs.push('attempts(풀이 이력)가 배열이 아닙니다.');
        else d.attempts.forEach((a, i) => { if (!a || typeof a.qid !== 'string' || typeof a.ts !== 'number' || !Array.isArray(a.selected) || typeof a.correct !== 'boolean') { if (errs.length < 8) errs.push('풀이 기록 ' + (i + 1) + '번 형식 오류'); } });
      }
    }
    return errs;
  }
  // mode: 'merge'(중복 제거 병합) | 'replace'
  function importBackup(state, obj, mode) {
    const errs = validateBackup(obj);
    if (errs.length) return { ok: false, errors: errs };
    const inc = migrate(JSON.parse(JSON.stringify(obj.data)));
    if (mode === 'replace') { if (state.settings && state.settings.ai && state.settings.ai.key) inc.settings.ai.key = state.settings.ai.key; return { ok: true, state: inc, added: inc.attempts.length, dup: 0 }; }
    const out = migrate(JSON.parse(JSON.stringify(state)));
    const sig = a => a.id || (a.qid + '|' + a.ts + '|' + a.selected.join(','));
    const have = new Set(out.attempts.map(sig));
    let added = 0, dup = 0;
    for (const a of inc.attempts) { if (have.has(sig(a))) { dup++; continue; } out.attempts.push(a); have.add(sig(a)); added++; }
    out.attempts.sort((x, y) => x.ts - y.ts);
    Object.assign(out.bookmarks, inc.bookmarks);
    for (const [k, v] of Object.entries(inc.read)) out.read[k] = Object.assign({}, v, out.read[k] || {});
    const exIds = new Set(out.exams.map(e => e.id)); for (const e of inc.exams) if (!exIds.has(e.id)) out.exams.push(e);
    // SRS는 병합된 이력으로 재계산
    out.srs = {}; for (const a of out.attempts) updateSrs(out, a.qid, a.correct, a.ts);
    return { ok: true, state: out, added, dup };
  }

  // ---------- 통계 ----------
  function stats(state, qIndex) {
    const by = (keyFn) => { const m = {}; for (const a of state.attempts) { const q = qIndex[a.qid]; if (!q) continue; const k = keyFn(q); if (!m[k]) m[k] = { n: 0, c: 0 }; m[k].n++; if (a.correct) m[k].c++; } return m; };
    const tot = state.attempts.length, cor = state.attempts.filter(a => a.correct).length;
    const firstTry = state.attempts.filter(a => a.first); const firstC = firstTry.filter(a => a.correct).length;
    const concept = by(q => q.concept || q.disorder);
    const weak = Object.entries(concept).filter(([, v]) => v.n >= 2 && v.c / v.n < 0.7).map(([k, v]) => ({ concept: k, n: v.n, rate: v.c / v.n })).sort((a, b) => a.rate - b.rate || b.n - a.n);
    const wrongCount = {}; for (const a of state.attempts) if (!a.correct) wrongCount[a.qid] = (wrongCount[a.qid] || 0) + 1;
    const solved = new Set(state.attempts.map(a => a.qid));
    return { total: tot, correct: cor, rate: tot ? cor / tot : 0, firstRate: firstTry.length ? firstC / firstTry.length : 0, byDomain: by(q => q.domain), byLevel: by(q => q.level), byDisorder: by(q => q.disorder), weak, wrongCount, solvedCount: solved.size };
  }
  function wrongNote(state, qIndex) {
    const map = {};
    for (const a of state.attempts) {
      const q = qIndex[a.qid]; if (!q) continue;
      if (!map[a.qid]) map[a.qid] = { qid: a.qid, attempts: [], wrongs: 0, firstSelected: null, firstWrongTs: null, lastCorrect: null };
      const e = map[a.qid]; e.attempts.push(a);
      if (!a.correct) { e.wrongs++; if (!e.firstSelected) { e.firstSelected = a.selected; e.firstWrongTs = a.ts; } }
      e.lastCorrect = a.correct;
    }
    return Object.values(map).filter(e => e.wrongs > 0).sort((a, b) => b.wrongs - a.wrongs || b.firstWrongTs - a.firstWrongTs);
  }

  // ---------- 문제 선택 ----------
  function filterQuestions(qs, f, state) {
    f = f || {};
    let r = qs.filter(q => (!f.domain || q.domain === f.domain) && (!f.disorder || q.disorder === f.disorder || (q.related || []).includes(f.disorder)) && (!f.level || q.level === Number(f.level)) && (!f.type || q.type === f.type) && (!f.concept || q.concept === f.concept));
    if (f.caseOnly) r = r.filter(q => q.case);
    if (f.bookmarked) r = r.filter(q => state.bookmarks[q.id]);
    if (f.wrongOnly) { const w = new Set(state.attempts.filter(a => !a.correct).map(a => a.qid)); r = r.filter(q => w.has(q.id)); }
    if (f.unsolved) { const s = new Set(state.attempts.map(a => a.qid)); r = r.filter(q => !s.has(q.id)); }
    return r;
  }
  function similar(q, qs, exclude) {
    exclude = new Set(exclude || []); exclude.add(q.id);
    const pool = qs.filter(x => !exclude.has(x.id));
    const score = x => (x.concept === q.concept ? 4 : 0) + (x.disorder === q.disorder ? 2 : 0) + ((x.related || []).includes(q.disorder) ? 1 : 0) + (x.level === q.level ? 1 : 0);
    const best = pool.map(x => [score(x), x]).filter(([s]) => s >= 2).sort((a, b) => b[0] - a[0]);
    if (!best.length) return null;
    const top = best.filter(([s]) => s === best[0][0]).map(([, x]) => x);
    return top[Math.floor(Math.random() * top.length)];
  }

  // ---------- 음성 명령 해석 ----------
  const NUMW = { '일': 1, '이': 2, '삼': 3, '사': 4, '오': 5, '하나': 1, '한': 1, '둘': 2, '두': 2, '셋': 3, '세': 3, '넷': 4, '네': 4, '다섯': 5, '첫': 1, '첫째': 1, '첫번째': 1, '두번째': 2, '세번째': 3, '네번째': 4, '다섯번째': 5 };
  function extractNumbers(t) {
    const out = [];
    const s = t.replace(/\s+/g, ' ');
    const re = /([1-5])\s*(?:번|,|과|와|이랑|하고|및|그리고|$|\s)|(다섯|하나|첫|둘|셋|넷|일|이|삼|사|오)\s*번/g;
    let m; while ((m = re.exec(s))) { const n = m[1] ? Number(m[1]) : NUMW[m[2]]; if (n && !out.includes(n)) out.push(n); }
    return out;
  }
  const DOMAIN_WORDS = [['anxiety', /불안장애|불안 장애|불안/], ['ocd', /강박 및 관련|강박관련|강박 관련/], ['trauma', /외상|트라우마|스트레스 관련/], ['personality', /성격장애|성격 장애/]];
  function parseCommand(raw, ctx) {
    ctx = ctx || {};
    const t = (raw || '').trim().replace(/[.?!。]+$/g, '');
    const n = t.replace(/\s+/g, '');
    if (!t) return { type: 'empty' };
    if (ctx.awaitingConfirm) {
      if (/^(네|예|응|맞아|맞아요|그래|좋아|확인|제출|어|넵|네맞아요)/.test(n)) return { type: 'confirm_yes' };
      if (/^(아니|아니요|아뇨|취소|다시|틀렸)/.test(n)) return { type: 'confirm_no' };
    }
    if (/일시정지|멈춰|정지|그만|잠깐/.test(n)) return { type: 'pause' };
    if (/이어서|계속|재개/.test(n)) return { type: 'resume' };
    if (/강의시작|강의들려|강의해|강의재생|읽어줘요약|요약읽어/.test(n) && !/다시/.test(n)) return { type: 'lecture_start', domain: detectDomain(t) };
    if (/보기만/.test(n)) return { type: 'read_options' };
    if (/다시읽|한번더읽|문제다시/.test(n)) return { type: 'repeat' };
    if (/오답복습|틀린문제복습|오답노트/.test(n)) return { type: 'wrong_review' };
    if (/비슷한문제|유사한문제|비슷한거|같은개념/.test(n)) return { type: 'similar' };
    if (/다음문제|다음으로|넘어가/.test(n)) return { type: 'next' };
    const why = t.match(/([1-5])\s*번\s*(?:보기)?.*(왜|이유|설명)/);
    if (why) return { type: 'why_option', number: Number(why[1]) };
    // 정답 제출
    if (/정답|답은|답이|고를게|선택|번이야|번이요|번입니다|^[1-5]번/.test(n) || (ctx.qType === 'ox' && /^(오|o|엑스|x|맞다|맞음|틀리다|틀림|참|거짓)$/i.test(n))) {
      if (ctx.qType === 'ox') {
        if (/(^|정답은?|답은?)(오|o|참|맞)/i.test(n) && !/엑스|x|거짓|틀/i.test(n)) return { type: 'answer', keys: ['O'], heard: t };
        if (/엑스|x|거짓|틀/i.test(n)) return { type: 'answer', keys: ['X'], heard: t };
      }
      const nums = extractNumbers(t);
      if (nums.length) return { type: 'answer', numbers: nums, heard: t };
    }
    if (/더자세히|자세히|심화/.test(n)) return { type: 'more' };
    if (/관련이론|이론설명/.test(n)) return { type: 'theory' };
    if (/해설|설명해/.test(n) && !/차이|비교|무엇|뭐|어떻/.test(n)) return { type: 'explain' };
    if (/문제(하나|한개|좀|를)?(내|줘|출제)|문제내|퀴즈/.test(n)) {
      let level = null; if (/고난도|최상위|어려운|어렵게|복수정답/.test(n)) level = 5; else if (/사례/.test(n)) level = 4; else if (/감별/.test(n)) level = 3; else if (/쉬운|기초|오엑스|ox/i.test(n)) level = 1;
      return { type: 'quiz', domain: detectDomain(t), disorderText: t, level };
    }
    return { type: 'ask', text: t };
  }
  function detectDomain(t) {
    if (/강박성\s*성격/.test(t)) return 'personality';
    for (const [d, re] of DOMAIN_WORDS) if (re.test(t)) return d;
    if (/강박|신체이형|저장|발모|털뽑|피부뜯/.test(t)) return 'ocd';
    if (/공황|공포|범불안|분리불안|무언증/.test(t)) return 'anxiety';
    if (/PTSD|적응장애|애착|비탄/i.test(t)) return 'trauma';
    return null;
  }

  // ---------- 검색 기반 학습 도우미(AI 아님) ----------
  function grams(s) { s = (s || '').toLowerCase().replace(/[^0-9a-z가-힣]+/g, ' '); const out = new Set(); for (const w of s.split(' ')) { if (!w) continue; if (w.length === 1) { out.add(w); continue; } for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2)); } return out; }
  const STOP = new Set(['설명', '명해', '해줘', '알려', '려줘', '차이', '이를', '무엇', '엇인', '인가', '가요', '대해', '해서', '비교', '교해', '장애', '애의', '애와', '애를', '애는']);
  function buildIndex(content) {
    const docs = [];
    const SEC = { definition: '정의', features: '주요 특징', subtypes: '하위 유형', core_symptoms: '핵심 증상', criteria: '진단 기준', duration: '지속기간', exceptions: '진단 조건과 예외', etiology_development: '원인과 발달', biological: '생물학적 설명', psychodynamic: '정신역동적 설명', cbt: '행동·인지적 설명', theorists: '주요 학자와 이론', maintenance: '증상 유지 기제', treatment: '치료', differential: '감별진단', case: '임상 사례', exam_points: '시험 핵심', confusions: '혼동 주의' };
    for (const c of content) for (const d of c.disorders) {
      docs.push({ domain: c.domain, disorder: d.id, name: d.name, sec: 'summary', secName: '핵심 요약', text: d.summary, sources: d.sources });
      docs.push({ domain: c.domain, disorder: d.id, name: d.name, sec: 'deep', secName: '심화 이론', text: d.deep, sources: d.sources });
      for (const [k, label] of Object.entries(SEC)) docs.push({ domain: c.domain, disorder: d.id, name: d.name, sec: k, secName: label, text: sectionText(d.sections[k]), sources: d.sources });
    }
    for (const c of content) for (const tb of c.comparison_tables || []) docs.push({ domain: c.domain, disorder: null, name: c.title, sec: 'table', secName: '비교표: ' + tb.title, text: tb.title + '. ' + tb.headers.join(', ') + '. ' + tb.rows.map(r => r.join(' / ')).join('. '), sources: [] });
    docs.forEach(d => { d.g = grams(d.name + ' ' + d.name + ' ' + d.secName + ' ' + d.text); d.ng = grams(d.name); });
    return docs;
  }
  function sectionText(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(x => typeof x === 'string' ? x : (x.name ? x.name + ': ' + x.theory : x.vs ? x.vs + '와의 감별: ' + x.point : JSON.stringify(x))).join(' ');
    if (v.text) return (v.title ? v.title + '. ' : '') + v.text + ' ' + (v.discussion || '');
    return JSON.stringify(v);
  }
  function search(index, query, k) {
    const qg = [...grams(query)].filter(g => !STOP.has(g)); if (!qg.length) return [];
    const res = index.map(d => { let s = 0; for (const g of qg) if (d.g.has(g)) s += 1; let nameHit = 0; for (const g of qg) if (d.ng.has(g)) nameHit++; s += nameHit * 2; return { d, s: s / Math.sqrt(qg.length) + (d.sec === 'differential' && /차이|감별|비교|구별/.test(query) ? 1.5 : 0) + (d.sec === 'theorists' && /이론|모형|모델|학자/.test(query) ? 1 : 0) }; });
    return res.filter(r => r.s > 1).sort((a, b) => b.s - a.s).slice(0, k || 4);
  }

  // ---------- 강의 재생목록 ----------
  const LECTURE_ORDER = [['summary', '핵심 요약'], ['definition', '정의'], ['features', '주요 특징'], ['subtypes', '하위 유형'], ['core_symptoms', '핵심 증상'], ['criteria', '진단 기준'], ['duration', '지속기간'], ['exceptions', '진단 조건과 예외'], ['etiology_development', '원인과 발달'], ['biological', '생물학적 설명'], ['psychodynamic', '정신역동적 설명'], ['cbt', '행동주의와 인지행동적 설명'], ['theorists', '주요 학자와 이론'], ['maintenance', '증상 유지 기제'], ['treatment', '치료'], ['differential', '감별진단'], ['case', '임상 사례'], ['exam_points', '시험 핵심'], ['confusions', '혼동하기 쉬운 내용'], ['deep', '심화 이론']];
  function splitSentences(text) {
    return (text || '').replace(/\s+/g, ' ').split(/(?<=[.!?。]|다\.|요\.)\s+/).map(s => s.trim()).filter(s => s.length > 0).flatMap(s => s.length > 220 ? s.split(/(?<=[,;:])\s+/) : [s]);
  }
  function buildPlaylist(content, opts) {
    opts = opts || {}; const list = [];
    for (const c of content) {
      if (opts.domain && c.domain !== opts.domain) continue;
      for (const d of c.disorders) {
        if (opts.disorder && d.id !== opts.disorder) continue;
        const secs = opts.mode === 'summary' ? [['summary', '핵심 요약']] : LECTURE_ORDER;
        for (const [k, label] of secs) {
          const txt = k === 'summary' ? d.summary : k === 'deep' ? d.deep : speakable(k, d.sections[k]);
          if (!txt) continue;
          list.push({ id: d.id + ':' + k, domain: c.domain, disorder: d.id, title: d.name + ' — ' + label, sentences: [d.name + ', ' + label + '.'].concat(splitSentences(txt)) });
        }
      }
    }
    return list;
  }
  function speakable(k, v) {
    if (Array.isArray(v)) {
      if (k === 'criteria') return v.map((x, i) => (i + 1) + '. ' + x).join(' ');
      return v.map(x => typeof x === 'string' ? x : x.name ? x.name + '. ' + x.theory : x.vs ? x.vs + '와의 감별. ' + x.point : '').join(' ');
    }
    if (v && typeof v === 'object') return '사례. ' + v.text + ' 해설. ' + v.discussion;
    return v || '';
  }
  function questionSpeech(q, view, includeOptions) {
    const parts = [];
    if (q.case) parts.push('사례. ' + q.case);
    parts.push('문제. ' + q.stem);
    if (includeOptions !== false) {
      if (q.type === 'ox') parts.push('오 또는 엑스로 답하세요.');
      else view.order.forEach((k, i) => { const o = q.options.find(x => x.key === k); parts.push((i + 1) + '번. ' + o.text); });
    }
    return parts;
  }

  const Core = { SCHEMA_VERSION, STORE_KEY, SRS_DAYS, DAY, uid, rng, shuffle, setEq, makeView, grade, emptyState, migrate, Store, updateSrs, dueReviews, exportBackup, validateBackup, importBackup, stats, wrongNote, filterQuestions, similar, parseCommand, extractNumbers, detectDomain, buildIndex, search, sectionText, buildPlaylist, splitSentences, questionSpeech, LECTURE_ORDER };
  G.Core = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof globalThis !== 'undefined' ? globalThis : this);
