/* 화면(라우팅·학습실·문제풀이·모의고사·오답노트·AI교수·음성·통계·설정) */
(function () {
  'use strict';
  const C = window.Core, V = window.Voice, AI = window.AI;
  const DATA = window.APP_DATA || { content: [], questions: [], meta: {} };
  const CONTENT = DATA.content.slice().sort((a, b) => ['anxiety', 'ocd', 'trauma', 'personality'].indexOf(a.domain) - ['anxiety', 'ocd', 'trauma', 'personality'].indexOf(b.domain));
  const QS = DATA.questions;
  const QI = Object.fromEntries(QS.map(q => [q.id, q]));
  const DOMAINS = { anxiety: '불안장애', ocd: '강박 및 관련 장애', trauma: '외상 및 스트레스 관련 장애', personality: '성격장애' };
  const LEVELS = { 1: '1단계 O/X 기초', 2: '2단계 일반 객관식', 3: '3단계 감별진단', 4: '4단계 임상사례', 5: '5단계 최상위 복수정답' };
  const DIS = {}; for (const c of CONTENT) for (const d of c.disorders) DIS[d.id] = Object.assign({ domain: c.domain }, d);
  const store = new C.Store(safeStorage()); const S = store.load();
  const speaker = new V.Speaker(); const recog = new V.Recognizer();
  let INDEX = null; const index = () => (INDEX || (INDEX = C.buildIndex(CONTENT)));
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const para = s => esc(s).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  const pct = x => Math.round(x * 100) + '%';
  function safeStorage() { try { const k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { const m = {}; return { getItem: k => m[k] || null, setItem: (k, v) => { m[k] = v; } }; } }
  function toast(msg, ms) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms || 2600); }
  function save() { if (!store.save()) toast(store.lastError, 6000); }
  window.__app = { store, S: () => store.state, QS, CONTENT, speaker, C };

  // ---------- 테마 ----------
  function applyTheme() { const t = store.state.settings.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
  applyTheme();

  // ---------- 라우팅 ----------
  const NAV = [['#/', '⌂', '대시보드'], ['#/toc', '☰', '시험 범위 목차'], ['#/summary', '✎', '핵심 요약'], ['#/study', '📖', '상세 이론'], ['#/quiz', '✓', '문제 풀이'], ['#/exam', '⏱', '모의고사'], ['#/wrong', '✗', '오답노트'], ['#/tutor', '💬', 'AI 개인교수'], ['#/voice', '🔊', '음성 학습'], ['#/stats', '📊', '학습 통계'], ['#/settings', '⚙', '설정·백업']];
  const BOTTOM = [['#/', '⌂', '홈'], ['#/summary', '✎', '요약'], ['#/quiz', '✓', '문제'], ['#/voice', '🔊', '음성'], ['#/more', '⋯', '더보기']];
  function shell() {
    document.body.innerHTML = '<div class="topbar"><b>이상심리학 기말 학습</b><button class="btn sm" id="themeBtn" aria-label="테마 전환">◐</button></div><div class="app"><nav class="side" aria-label="주 메뉴"><div class="brand">현대 이상심리학<small>기말고사 학습 프로그램</small></div><div class="nav">' + NAV.map(n => '<a href="' + n[0] + '"><span class="ic">' + n[1] + '</span>' + n[2] + '</a>').join('') + '</div><div style="padding:12px"><button class="btn sm" id="themeBtn2">◐ 라이트/다크</button></div></nav><main id="main" tabindex="-1"></main></div><nav class="bottom" aria-label="하단 메뉴">' + BOTTOM.map(n => '<a href="' + n[0] + '"><span class="ic">' + n[1] + '</span>' + n[2] + '</a>').join('') + '</nav><audio id="audioEl" preload="none"></audio>';
    const cycle = () => { const o = ['auto', 'light', 'dark']; const s = store.state.settings; s.theme = o[(o.indexOf(s.theme) + 1) % 3]; save(); applyTheme(); toast('테마: ' + { auto: '시스템 설정', light: '라이트', dark: '다크' }[s.theme]); };
    $('#themeBtn').onclick = cycle; $('#themeBtn2').onclick = cycle;
  }
  function route() {
    const h = location.hash || '#/'; const [path, qs] = h.slice(1).split('?'); const parts = path.split('/').filter(Boolean); const params = new URLSearchParams(qs || '');
    document.querySelectorAll('.nav a,.bottom a').forEach(a => { const p = a.getAttribute('href'); a.classList.toggle('on', p === '#/' ? parts.length === 0 : h.startsWith(p)); });
    if (exam && exam.running && parts[0] !== 'exam') { /* 시험 진행 중 다른 화면 이동 허용(오픈북), 타이머 유지 */ }
    const view = VIEWS[parts[0] || 'home'] || VIEWS.home;
    const m = $('#main'); m.innerHTML = ''; window.scrollTo(0, 0);
    view(m, parts.slice(1), params);
    m.focus({ preventScroll: true });
  }
  function nav(h) { if (location.hash === h) route(); else location.hash = h; }

  // ---------- 공통 렌더 ----------
  function srcList(sources) {
    if (!sources || !sources.length) return '';
    return '<details class="src"><summary>출처 ' + sources.length + '건 · 검증 상태 보기</summary><ul class="tight">' + sources.map(s => '<li><b>' + esc(s.source_name) + '</b> — ' + (/^https?:/.test(s.ref) ? '<a href="' + esc(s.ref) + '" target="_blank" rel="noopener">' + esc(s.ref) + '</a>' : esc(s.ref)) + '<br>단원: ' + esc(s.unit) + ' · 근거: ' + esc(s.basis) + '<br>확인일 ' + esc(s.checked_date) + ' · ' + (s.source_verified ? '<span class="badge good">출처 확인(' + esc(s.verify_method || '') + ')</span>' : '<span class="badge warn">출처 미검증</span>') + ' ' + (s.textbook_compared ? '<span class="badge good">교재 대조</span>' : '<span class="badge warn">교재 미대조</span>') + '</li>').join('') + '</ul></details>';
  }
  function verBadge(q) { return (q.verification_status === '출처확인' ? '<span class="badge good">출처확인</span>' : '<span class="badge warn">자체검토·출처 미검증</span>') + ' <span class="badge warn">교재 미대조</span>'; }
  function markRead(disId, sec) { const r = store.state.read; r[disId] = r[disId] || {}; if (!r[disId][sec]) { r[disId][sec] = Date.now(); save(); } }
  function progress() { const all = CONTENT.reduce((n, c) => n + c.disorders.length, 0); const done = Object.values(store.state.read).filter(x => x.detail || x.summary).length; return { all, done }; }

  // ---------- 대시보드 ----------
  function vHome(m) {
    const st = C.stats(store.state, QI); const due = C.dueReviews(store.state); const pr = progress(); const wn = C.wrongNote(store.state, QI);
    m.innerHTML = '<h1>오늘의 학습</h1>' + (store.lastError ? '<p class="hl-note">' + esc(store.lastError) + '</p>' : '') +
      '<div class="kpi"><div><b>' + st.solvedCount + '<small class="muted small"> / ' + QS.length + '</small></b><span>푼 문제(고유)</span></div><div><b>' + (st.total ? pct(st.rate) : '–') + '</b><span>전체 정답률 (' + st.total + '회 풀이)</span></div><div><b>' + due.length + '</b><span>오늘 복습할 오답</span></div><div><b>' + pr.done + '<small class="muted small"> / ' + pr.all + '</small></b><span>학습한 단원</span></div></div>' +
      '<div class="row" style="margin:14px 0">' + (due.length ? '<a class="btn pri" href="#/quiz?review=1">오늘 복습 ' + due.length + '문제 시작</a>' : '') + '<a class="btn ' + (due.length ? '' : 'pri') + '" href="#/quiz?auto=1">무작위 10문제</a><a class="btn" href="#/voice">🔊 강의 듣기</a><a class="btn" href="#/exam">⏱ 모의고사</a></div>' +
      '<h2>시험 영역</h2><div class="grid">' + CONTENT.map(c => { const s = st.byDomain[c.domain]; const n = QS.filter(q => q.domain === c.domain).length; return '<a class="tile" href="#/summary/' + c.domain + '"><b>' + esc(c.title) + '</b><span>장애 ' + c.disorders.length + '개 · 문제 ' + n + '개' + (s ? ' · 정답률 ' + pct(s.c / s.n) : '') + '</span></a>'; }).join('') + '</div>' +
      (st.weak.length ? '<h2>취약 개념</h2><div class="card"><ul class="tight">' + st.weak.slice(0, 6).map(w => '<li>' + esc(w.concept) + ' — 정답률 ' + pct(w.rate) + ' (' + w.n + '회) <a href="#/quiz?concept=' + encodeURIComponent(w.concept) + '">다시 풀기</a></li>').join('') + '</ul></div>' : '') +
      (wn.length ? '<p><a href="#/wrong">오답노트 ' + wn.length + '문제 보기 →</a></p>' : '') +
      '<div class="card small muted">이 프로그램의 학습 내용은 공개 전문자료를 바탕으로 독자적으로 재구성했습니다. 권석만 교재와 직접 대조하지 않았으므로(<b>교재 미대조</b>), 시험 전 교재에서 핵심 사항을 확인하세요. 교육용이며 실제 진단·치료를 대신하지 않습니다.<br>데이터: 콘텐츠 ' + pr.all + '개 단원 · 문제 ' + QS.length + '개 · 빌드 ' + esc(DATA.meta.built || '') + '</div>';
  }
  function vMore(m) { m.innerHTML = '<h1>전체 메뉴</h1><div class="grid">' + NAV.map(n => '<a class="tile" href="' + n[0] + '"><b>' + n[1] + ' ' + n[2] + '</b></a>').join('') + '</div>'; }

  // ---------- 목차 ----------
  function vToc(m) {
    m.innerHTML = '<h1>전체 시험 범위 목차</h1><p class="muted small">교재 장 번호는 3판 기준으로 알려진 대응이며 판본·세부 목차는 확인되지 않았습니다.</p>' + CONTENT.map(c => '<div class="card"><h2 style="margin-top:0">' + esc(c.title) + '</h2><p class="small muted">' + esc(c.textbook_chapter_note || '') + '</p><ul class="tight">' + c.disorders.map(d => { const r = store.state.read[d.id] || {}; const n = QS.filter(q => q.disorder === d.id).length; return '<li><a href="#/study/' + d.id + '">' + esc(d.name) + '</a> <span class="muted small">' + esc(d.name_en || '') + '</span> ' + (r.detail ? '<span class="badge good">상세 학습</span>' : r.summary ? '<span class="badge acc">요약 학습</span>' : '') + ' <a class="small" href="#/quiz?disorder=' + d.id + '">문제 ' + n + '</a></li>'; }).join('') + '</ul><div class="row"><a class="btn sm" href="#/summary/' + c.domain + '">핵심 요약</a><a class="btn sm" href="#/voice?domain=' + c.domain + '">🔊 이 영역 듣기</a><a class="btn sm" href="#/quiz?domain=' + c.domain + '">이 영역 문제</a></div></div>').join('');
  }

  // ---------- 핵심 요약 학습실 ----------
  function vSummary(m, args) {
    const dom = args[0] || CONTENT[0] && CONTENT[0].domain; const c = CONTENT.find(x => x.domain === dom);
    if (!c) { m.innerHTML = '<p>콘텐츠가 없습니다.</p>'; return; }
    m.innerHTML = '<h1>핵심 요약 학습실</h1><div class="tabs">' + CONTENT.map(x => '<a class="btn sm ' + (x.domain === dom ? 'on' : '') + '" href="#/summary/' + x.domain + '">' + esc(x.title) + '</a>').join('') + '</div>' +
      '<div class="card"><h2 style="margin-top:0">' + esc(c.title) + ' 개관</h2><p>' + para(c.overview) + '</p></div>' +
      c.disorders.map(d => { markRead(d.id, 'summary'); const s = d.sections; return '<div class="card" id="s-' + d.id + '"><div class="row sp"><h2 style="margin:0">' + esc(d.name) + ' <span class="muted small">' + esc(d.name_en || '') + '</span></h2><span class="row"><button class="btn sm" data-say="' + d.id + '">🔊 듣기</button><a class="btn sm" href="#/study/' + d.id + '">상세 →</a></span></div><p>' + para(d.summary) + '</p>' +
        (s.duration ? '<p><b>지속기간</b> · ' + para(s.duration) + '</p>' : '') +
        (s.exam_points && s.exam_points.length ? '<h3>시험 핵심</h3><ul class="tight">' + s.exam_points.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
        (s.confusions && s.confusions.length ? '<h3>혼동 주의</h3><ul class="tight">' + s.confusions.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + srcList(d.sources) + '</div>'; }).join('') +
      (c.comparison_tables || []).map(tableHtml).join('');
    m.querySelectorAll('[data-say]').forEach(b => b.onclick = () => { const d = DIS[b.dataset.say]; speaker.say([d.name + ' 핵심 요약.'].concat(C.splitSentences(d.summary))); toast('읽는 중 — 음성 학습실에서 연속 재생과 위치 기억을 사용할 수 있습니다.'); });
  }
  function tableHtml(t) { return '<div class="card"><h3 style="margin-top:0">비교표 · ' + esc(t.title) + '</h3><div class="tbl"><table><thead><tr>' + t.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + t.rows.map(r => '<tr>' + r.map(x => '<td>' + esc(x) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></div>'; }

  // ---------- 상세/심화 학습실 ----------
  const SEC_LABEL = { definition: '1. 정의', features: '2. 주요 특징', subtypes: '3. 하위 유형 및 분류', core_symptoms: '4. 핵심 증상', criteria: '5. 진단 기준(독자적 재구성)', duration: '6. 증상 지속기간', exceptions: '7. 진단 조건과 예외', etiology_development: '8. 원인 및 발달 과정', biological: '9. 생물학적 설명', psychodynamic: '10. 정신역동적 설명', cbt: '11. 행동주의 및 인지행동적 설명', theorists: '12. 주요 학자와 이론', maintenance: '13. 증상 유지 기제', treatment: '14. 치료 방법과 치료 원리', differential: '15. 유사 장애와 감별진단', case: '16. 가상 임상 사례', exam_points: '17. 시험 핵심 개념', confusions: '18. 혼동하기 쉬운 내용' };
  function secHtml(k, v) {
    if (Array.isArray(v)) {
      if (k === 'criteria') return '<ol class="tight">' + v.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>';
      if (k === 'theorists') return '<ul class="tight">' + v.map(x => '<li><b>' + esc(x.name) + '</b> — ' + esc(x.theory) + '</li>').join('') + '</ul>';
      if (k === 'differential') return '<div class="tbl"><table><thead><tr><th style="width:28%">비교 대상</th><th>감별 포인트</th></tr></thead><tbody>' + v.map(x => '<tr><td>' + esc(x.vs) + '</td><td>' + esc(x.point) + '</td></tr>').join('') + '</tbody></table></div>';
      return '<ul class="tight">' + v.map(x => '<li>' + esc(typeof x === 'string' ? x : JSON.stringify(x)) + '</li>').join('') + '</ul>';
    }
    if (v && typeof v === 'object') return '<div class="case"><b>' + esc(v.title || '사례') + '</b>\n' + esc(v.text) + '</div><p><b>진단적 판단</b> ' + para(v.discussion) + '</p>';
    return '<p class="para">' + para(v) + '</p>';
  }
  function vStudy(m, args, params) {
    const id = args[0];
    if (!id || !DIS[id]) { m.innerHTML = '<h1>상세 이론 학습실</h1><p class="muted">단원을 고르세요.</p>' + CONTENT.map(c => '<h2>' + esc(c.title) + '</h2><div class="grid">' + c.disorders.map(d => '<a class="tile" href="#/study/' + d.id + '"><b>' + esc(d.name) + '</b><span>' + esc(d.name_en || '') + '</span></a>').join('') + '</div>').join(''); return; }
    const d = DIS[id]; const lv = params.get('level') || 'detail'; markRead(id, lv === 'deep' ? 'deep' : 'detail');
    const list = CONTENT.find(c => c.domain === d.domain).disorders; const i = list.findIndex(x => x.id === id);
    m.innerHTML = '<p class="small"><a href="#/toc">목차</a> › ' + esc(DOMAINS[d.domain]) + '</p><h1>' + esc(d.name) + ' <span class="muted small">' + esc(d.name_en || '') + '</span></h1>' +
      '<div class="tabs"><a class="btn sm ' + (lv === 'summary' ? 'on' : '') + '" href="#/study/' + id + '?level=summary">핵심 요약</a><a class="btn sm ' + (lv === 'detail' ? 'on' : '') + '" href="#/study/' + id + '?level=detail">상세 학습</a><a class="btn sm ' + (lv === 'deep' ? 'on' : '') + '" href="#/study/' + id + '?level=deep">심화 이론</a></div>' +
      '<div class="row"><a class="btn sm" href="#/voice?disorder=' + id + '">🔊 이 단원 강의 듣기</a><a class="btn sm" href="#/quiz?disorder=' + id + '">이 장애 문제 (' + QS.filter(q => q.disorder === id || (q.related || []).includes(id)).length + ')</a><a class="btn sm" href="#/tutor?unit=' + id + '">💬 이 단원 질문</a></div>' +
      (lv === 'summary' ? '<div class="card"><p>' + para(d.summary) + '</p></div>' : '') +
      (lv === 'detail' ? Object.keys(SEC_LABEL).filter(k => d.sections[k] != null).map(k => '<div class="sec" id="sec-' + k + '"><h3>' + SEC_LABEL[k] + '</h3>' + secHtml(k, d.sections[k]) + '</div>').join('') : '') +
      (lv === 'deep' ? '<div class="card"><h2 style="margin-top:0">심화 이론 — 이론 비교 · 감별 · 사례 적용</h2><p>' + para(d.deep) + '</p></div>' + (d.dsm_version_notes ? '<div class="card"><h3 style="margin-top:0">DSM 판본 차이</h3><p>' + para(d.dsm_version_notes) + '</p></div>' : '') + '<div class="sec"><h3>' + SEC_LABEL.differential + '</h3>' + secHtml('differential', d.sections.differential || []) + '</div><div class="sec"><h3>' + SEC_LABEL.case + '</h3>' + secHtml('case', d.sections.case) + '</div>' : '') +
      '<div class="card">' + srcList(d.sources) + '<p class="tiny muted">진단 기준은 DSM 원문을 옮긴 것이 아니라 학습용으로 재구성한 문장입니다. 정확한 문구는 DSM-5/DSM-5-TR 원본과 교재를 확인하세요.</p></div>' +
      '<div class="row sp">' + (i > 0 ? '<a class="btn" href="#/study/' + list[i - 1].id + '?level=' + lv + '">← ' + esc(list[i - 1].name) + '</a>' : '<span></span>') + (i < list.length - 1 ? '<a class="btn" href="#/study/' + list[i + 1].id + '?level=' + lv + '">' + esc(list[i + 1].name) + ' →</a>' : '') + '</div>';
    const anchor = params.get('sec'); if (anchor) setTimeout(() => { const el = document.getElementById('sec-' + anchor); if (el) el.scrollIntoView(); }, 50);
  }

  // ---------- 문제 풀이 ----------
  let quiz = null; // {list, idx, view, selected, graded, t0, mode}
  function startQuiz(list, mode) { quiz = { list, idx: 0, mode: mode || 'practice', selected: [], graded: null }; prepQ(); }
  function prepQ() { const q = QI[quiz.list[quiz.idx]]; quiz.view = C.makeView(q, { shuffleOptions: store.state.settings.shuffleOptions }); quiz.selected = []; quiz.graded = null; quiz.t0 = Date.now(); window.__ctxQuestion = { q, view: quiz.view, submitted: false }; }
  function vQuiz(m, args, params) {
    const f = { domain: params.get('domain') || '', disorder: params.get('disorder') || '', level: params.get('level') || '', type: params.get('type') || '', concept: params.get('concept') || '' };
    if (params.get('review')) { const due = C.dueReviews(store.state).map(d => d.qid).filter(id => QI[id]); if (due.length) { startQuiz(due, 'review'); history.replaceState(null, '', '#/quiz/run'); return renderQ(m); } }
    if (params.get('auto') || f.disorder || f.concept || params.get('go')) { const list = pick(f, params); if (list.length) { startQuiz(list, 'practice'); history.replaceState(null, '', '#/quiz/run'); return renderQ(m); } }
    if (args[0] === 'run' && quiz) return renderQ(m);
    const opt = (o, v) => Object.entries(o).map(([k, t]) => '<option value="' + k + '"' + (String(v) === k ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    m.innerHTML = '<h1>문제 풀이</h1><div class="card"><div class="row">' +
      '<label class="f">영역<select id="fDomain"><option value="">전체</option>' + opt(DOMAINS, f.domain) + '</select></label>' +
      '<label class="f">장애<select id="fDis"><option value="">전체</option></select></label>' +
      '<label class="f">난이도<select id="fLevel"><option value="">전체</option>' + opt(LEVELS, f.level) + '</select></label>' +
      '<label class="f">유형<select id="fType"><option value="">전체</option>' + opt({ ox: 'O/X', single: '단일정답 5지선다', multi: '복수정답 5지선다' }, f.type) + '</select></label></div>' +
      '<div class="row"><label class="chk"><input type="checkbox" id="fCase">임상사례형만</label><label class="chk"><input type="checkbox" id="fBm">북마크만</label><label class="chk"><input type="checkbox" id="fWrong">틀렸던 문제만</label><label class="chk"><input type="checkbox" id="fNew">안 푼 문제만</label></div>' +
      '<div class="row"><label class="chk"><input type="checkbox" id="fRand" checked>출제 순서 섞기</label><label class="chk"><input type="checkbox" id="fShuf"' + (store.state.settings.shuffleOptions ? ' checked' : '') + '>보기 순서 섞기</label><label class="f" style="max-width:140px">문제 수<select id="fN"><option>10</option><option>20</option><option>40</option><option value="999">전부</option></select></label></div>' +
      '<p id="fCount" class="muted small"></p><button class="btn pri" id="go">풀기 시작</button></div>' +
      '<div class="grid">' + Object.entries(LEVELS).map(([k, t]) => '<a class="tile" href="#/quiz?go=1&level=' + k + '"><b>' + t + '</b><span>' + QS.filter(q => q.level === Number(k)).length + '문제</span></a>').join('') + '</div>';
    const fillDis = () => { const d = $('#fDomain').value; $('#fDis').innerHTML = '<option value="">전체</option>' + Object.values(DIS).filter(x => !d || x.domain === d).map(x => '<option value="' + x.id + '">' + esc(x.name) + '</option>').join(''); };
    const read = () => ({ domain: $('#fDomain').value, disorder: $('#fDis').value, level: $('#fLevel').value, type: $('#fType').value, caseOnly: $('#fCase').checked, bookmarked: $('#fBm').checked, wrongOnly: $('#fWrong').checked, unsolved: $('#fNew').checked });
    const upd = () => { $('#fCount').textContent = '조건에 맞는 문제: ' + C.filterQuestions(QS, read(), store.state).length + '개'; };
    fillDis(); $('#fDomain').onchange = () => { fillDis(); upd(); }; m.querySelectorAll('select,input').forEach(e => e.addEventListener('change', upd)); upd();
    $('#go').onclick = () => { store.state.settings.shuffleOptions = $('#fShuf').checked; save(); let list = C.filterQuestions(QS, read(), store.state).map(q => q.id); if (!list.length) return toast('조건에 맞는 문제가 없습니다.'); if ($('#fRand').checked) list = C.shuffle(list); list = list.slice(0, Number($('#fN').value)); startQuiz(list); history.replaceState(null, '', '#/quiz/run'); renderQ(m); };
  }
  function pick(f, params) { let l = C.filterQuestions(QS, f, store.state).map(q => q.id); l = C.shuffle(l); return params && params.get('auto') ? l.slice(0, 10) : l.slice(0, 40); }
  function optionButtons(q, view, selected, graded, showWhy) {
    return view.order.map((k, i) => {
      const o = q.options.find(x => x.key === k); const lab = q.type === 'ox' ? k : String(i + 1);
      let cls = 'opt'; if (selected.includes(k)) cls += ' sel';
      let why = '';
      if (graded) { const p = graded.perOption.find(x => x.key === k); cls += ' r-' + p.status; const mark = { hit: '<span class="badge good">정답 · 선택함</span>', miss: '<span class="badge good">정답 · 놓침</span>', wrong_pick: '<span class="badge bad">오답 · 선택함</span>', ok: '<span class="badge">오답 · 선택 안 함</span>' }[p.status]; if (showWhy) why = '<span class="why">' + mark + (q.type !== 'ox' ? ' <span class="badge ' + (o.is_true ? 'acc' : '') + '">진술: ' + (o.is_true ? '옳음' : '옳지 않음') + '</span>' : '') + '<br>' + esc(o.explanation) + '</span>'; }
      return '<button class="' + cls + '" data-k="' + k + '" aria-pressed="' + selected.includes(k) + '"' + (graded ? ' disabled' : '') + '><span class="n">' + lab + '</span><span class="t">' + esc(o.text) + why + '</span></button>';
    }).join('');
  }
  function qHead(q) { return '<div class="row"><span class="badge acc">' + esc(DOMAINS[q.domain]) + '</span><span class="badge">' + esc((DIS[q.disorder] || {}).name || q.disorder) + '</span><span class="badge">' + LEVELS[q.level] + '</span><span class="badge">' + ({ ox: 'O/X', single: '단일정답', multi: '복수정답' })[q.type] + '</span><span class="tiny muted">' + q.id + '</span></div>'; }
  function renderQ(m) {
    const q = QI[quiz.list[quiz.idx]]; const v = quiz.view; const g = quiz.graded;
    const bm = !!store.state.bookmarks[q.id];
    const prevAttempts = store.state.attempts.filter(a => a.qid === q.id);
    m.innerHTML = '<div class="row sp"><h1 style="margin:0">' + ({ practice: '문제 풀이', review: '오답 복습' })[quiz.mode] + ' <span class="muted small">' + (quiz.idx + 1) + ' / ' + quiz.list.length + '</span></h1><button class="btn sm" id="bm" aria-pressed="' + bm + '">' + (bm ? '★ 북마크됨' : '☆ 북마크') + '</button></div>' + qHead(q) +
      (q.case ? '<div class="case"><b>사례</b>\n' + esc(q.case) + '</div>' : '') + '<div class="stem">' + esc(q.stem) + '</div>' +
      (q.type === 'multi' ? '<p class="small muted">해당하는 보기를 모두 선택한 뒤 제출하세요. 선택 집합이 정답 집합과 완전히 같아야 정답입니다.</p>' : '') +
      (g ? '<div class="result ' + (g.correct ? 'good' : 'bad') + '" id="resBox" tabindex="-1">' + (g.correct ? '정답입니다' : g.partial ? '오답 (일부 보기만 일치) — 최종 판정은 오답입니다' : '오답입니다') + ' · 정답: ' + q.answer.map(k => v.label(k)).sort().join(', ') + ' · 내 선택: ' + (g.selected.map(k => v.label(k)).sort().join(', ') || '없음') + '</div>' : '') +
      '<div id="opts">' + optionButtons(q, v, quiz.selected, g, true) + '</div>' +
      (g ? '<div class="card"><h3 style="margin-top:0">해설</h3><p>' + para(q.explanation) + '</p>' + (q.theory ? '<p><b>관련 이론</b> · ' + esc(q.theory) + '</p>' : '') + '<p class="small">' + verBadge(q) + ' <a href="#/study/' + q.disorder + '">관련 단원: ' + esc((DIS[q.disorder] || {}).name || '') + ' →</a></p>' + srcList(q.sources) + '<p class="tiny muted">이 문제의 풀이 기록 ' + prevAttempts.length + '회 (정답 ' + prevAttempts.filter(a => a.correct).length + '회)</p></div>' : '') +
      '<div class="row" style="margin-top:12px">' + (g ? '<button class="btn" id="retry">다시 풀기</button>' + (quiz.idx < quiz.list.length - 1 ? '<button class="btn pri" id="next">다음 문제 →</button>' : '<button class="btn pri" id="fin">풀이 종료</button>') + '<button class="btn" id="sim">비슷한 문제</button><a class="btn" href="#/tutor">💬 AI에게 묻기</a>' : '<button class="btn pri" id="sub" ' + (quiz.selected.length ? '' : 'disabled') + '>제출</button>' + (quiz.idx < quiz.list.length - 1 ? '<button class="btn" id="skip">건너뛰기</button>' : '')) + '<button class="btn" id="sayQ">🔊 문제 읽기</button></div>';
    m.querySelectorAll('#opts .opt').forEach(b => b.onclick = () => { const k = b.dataset.k; if (q.type === 'multi') { quiz.selected = quiz.selected.includes(k) ? quiz.selected.filter(x => x !== k) : quiz.selected.concat(k); } else quiz.selected = [k]; renderQ(m); });
    const on = (id, fn) => { const e = $('#' + id, m); if (e) e.onclick = fn; };
    on('bm', () => { if (bm) delete store.state.bookmarks[q.id]; else store.state.bookmarks[q.id] = Date.now(); save(); renderQ(m); });
    on('sub', () => { quiz.graded = C.grade(q, quiz.selected); store.recordAttempt(q, quiz.graded, { mode: quiz.mode, order: v.order, ms: Date.now() - quiz.t0 }); if (store.lastError) toast(store.lastError, 6000); window.__ctxQuestion = { q, view: v, submitted: true, selected: quiz.selected }; renderQ(m); const rb = $('#resBox'); if (rb) { rb.scrollIntoView({ block: 'center' }); rb.focus({ preventScroll: true }); } });
    on('retry', () => { prepQ(); renderQ(m); });
    on('next', () => { quiz.idx++; prepQ(); renderQ(m); });
    on('skip', () => { quiz.idx++; prepQ(); renderQ(m); });
    on('fin', () => { const ids = new Set(quiz.list); const rec = store.state.attempts.filter(a => ids.has(a.qid) && a.ts >= (quiz.started || 0)); toast('풀이를 마쳤습니다.'); quiz = null; nav('#/stats'); });
    on('sim', () => { const s = C.similar(q, QS, quiz.list); if (!s) return toast('같은 개념의 다른 문제가 없습니다.'); quiz.list.splice(quiz.idx + 1, 0, s.id); quiz.idx++; prepQ(); renderQ(m); });
    on('sayQ', () => speaker.say(C.questionSpeech(q, v)));
  }

  // ---------- 모의고사 ----------
  let exam = null; let examTimer = null;
  function persistExam() { store.state.examInProgress = exam; save(); }
  function vExam(m) {
    if (!exam && store.state.examInProgress && store.state.examInProgress.running) exam = store.state.examInProgress;
    if (exam && exam.running) return renderExam(m);
    if (exam && exam.result) return renderExamResult(m);
    m.innerHTML = '<h1>모의고사</h1><div class="card"><p>실제 시험처럼 시간 제한 안에 풀고, 제출 후 한꺼번에 채점합니다. 제출 전에는 정답과 해설이 보이지 않습니다.</p><div class="row">' +
      Object.entries(DOMAINS).map(([k, t]) => '<label class="chk"><input type="checkbox" class="eDom" value="' + k + '" checked>' + t + '</label>').join('') + '</div><div class="row">' +
      '<label class="f">문항 수<select id="eN"><option>20</option><option selected>40</option><option>60</option></select></label><label class="f">제한 시간(분)<select id="eT"><option>20</option><option selected>50</option><option>75</option><option>100</option></select></label><label class="f">난이도 구성<select id="eMix"><option value="exam">실전형(2~5단계 위주)</option><option value="all">전체 무작위</option><option value="hard">고난도(4~5단계)</option></select></label></div>' +
      '<label class="chk"><input type="checkbox" id="eOpen" checked>오픈북 실전 모드 (시험 중 학습자료 검색 창 사용 가능)</label><p><button class="btn pri" id="eGo">시작</button></p></div>' +
      (store.state.exams.length ? '<h2>지난 모의고사</h2><div class="card"><ul class="tight">' + store.state.exams.slice().reverse().map(e => '<li>' + new Date(e.ts).toLocaleString('ko-KR') + ' — ' + e.score + ' / ' + e.n + ' (' + pct(e.score / e.n) + ') · ' + Math.round(e.sec / 60) + '분' + (e.open ? ' · 오픈북' : '') + '</li>').join('') + '</ul></div>' : '');
    $('#eGo').onclick = () => {
      const doms = [...m.querySelectorAll('.eDom:checked')].map(x => x.value); if (!doms.length) return toast('영역을 하나 이상 고르세요.');
      const n = Number($('#eN').value), mix = $('#eMix').value; let pool = QS.filter(q => doms.includes(q.domain));
      if (mix === 'exam') pool = pool.filter(q => q.level >= 2); if (mix === 'hard') pool = pool.filter(q => q.level >= 4);
      // 영역 균형 추출
      const per = {}; for (const q of C.shuffle(pool)) (per[q.domain] = per[q.domain] || []).push(q.id);
      const ids = []; while (ids.length < n && Object.values(per).some(a => a.length)) for (const d of doms) if (per[d] && per[d].length && ids.length < n) ids.push(per[d].shift());
      const orders = {}; for (const id of ids) orders[id] = C.makeView(QI[id], { shuffleOptions: true }).order;
      exam = { id: C.uid(), running: true, ids: C.shuffle(ids), orders, answers: {}, idx: 0, start: Date.now(), limit: Number($('#eT').value) * 60, open: $('#eOpen').checked };
      persistExam(); renderExam(m);
    };
  }
  function viewFromOrder(q, order) { return { qid: q.id, order, label: k => (q.type === 'ox' ? k : String(order.indexOf(k) + 1)), keyAt: n => (q.type === 'ox' ? n : order[n - 1]) }; }
  function renderExam(m) {
    const q = QI[exam.ids[exam.idx]]; const v = viewFromOrder(q, exam.orders[q.id]); const sel = exam.answers[q.id] || [];
    window.__ctxQuestion = { q, view: v, submitted: false };
    m.innerHTML = '<div class="row sp"><h1 style="margin:0">모의고사 ' + (exam.open ? '<span class="badge acc">오픈북</span>' : '') + '</h1><span class="timer" id="tm"></span></div><div class="qnav" style="margin:10px 0">' + exam.ids.map((id, i) => '<button class="' + (exam.answers[id] && exam.answers[id].length ? 'done ' : '') + (i === exam.idx ? 'cur' : '') + '" data-i="' + i + '" aria-label="' + (i + 1) + '번 문제">' + (i + 1) + '</button>').join('') + '</div>' + qHead(q).replace(/<span class="tiny muted">.*?<\/span>/, '') +
      (q.case ? '<div class="case"><b>사례</b>\n' + esc(q.case) + '</div>' : '') + '<div class="stem">' + (exam.idx + 1) + '. ' + esc(q.stem) + '</div><div id="opts">' + optionButtons(q, v, sel, null, false) + '</div>' +
      '<div class="row"><button class="btn" id="pv" ' + (exam.idx ? '' : 'disabled') + '>← 이전</button><button class="btn" id="nx" ' + (exam.idx < exam.ids.length - 1 ? '' : 'disabled') + '>다음 →</button>' + (exam.open ? '<button class="btn" id="book">📖 자료 검색</button>' : '') + '<button class="btn pri" id="end">제출하고 채점</button><button class="btn danger" id="quit">중단</button></div>';
    m.querySelectorAll('.qnav button').forEach(b => b.onclick = () => { exam.idx = Number(b.dataset.i); persistExam(); renderExam(m); });
    m.querySelectorAll('#opts .opt').forEach(b => b.onclick = () => { const k = b.dataset.k; let s = exam.answers[q.id] || []; s = q.type === 'multi' ? (s.includes(k) ? s.filter(x => x !== k) : s.concat(k)) : [k]; exam.answers[q.id] = s; persistExam(); renderExam(m); });
    $('#pv').onclick = () => { exam.idx--; persistExam(); renderExam(m); }; $('#nx').onclick = () => { exam.idx++; persistExam(); renderExam(m); };
    $('#end').onclick = () => { const un = exam.ids.filter(id => !(exam.answers[id] || []).length).length; if (un && !confirm('답하지 않은 문제가 ' + un + '개 있습니다. 제출할까요?')) return; finishExam(m); };
    $('#quit').onclick = () => { if (!confirm('모의고사를 중단할까요? 이번 답안은 기록되지 않습니다.')) return; exam = null; store.state.examInProgress = null; save(); clearInterval(examTimer); nav('#/exam'); };
    if ($('#book')) $('#book').onclick = openBook;
    clearInterval(examTimer); const tick = () => { if (!exam || !exam.running) return clearInterval(examTimer); const left = exam.limit - Math.floor((Date.now() - exam.start) / 1000); const el = $('#tm'); if (left <= 0) { clearInterval(examTimer); toast('시간이 끝나 자동 제출합니다.'); return finishExam($('#main')); } if (el) el.textContent = '남은 시간 ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); }; tick(); examTimer = setInterval(tick, 1000);
  }
  function finishExam(m) {
    clearInterval(examTimer); let score = 0; const items = [];
    for (const id of exam.ids) { const q = QI[id]; const sel = exam.answers[id] || []; const g = C.grade(q, sel); if (g.correct) score++; items.push({ id, g }); if (sel.length) store.recordAttempt(q, g, { mode: 'exam', order: exam.orders[id] }); else store.recordAttempt(q, g, { mode: 'exam-blank', order: exam.orders[id] }); }
    const sec = Math.round((Date.now() - exam.start) / 1000);
    store.state.exams.push({ id: exam.id, ts: Date.now(), n: exam.ids.length, score, sec, open: exam.open, ids: exam.ids, answers: exam.answers });
    exam.running = false; exam.result = { score, items, sec }; store.state.examInProgress = null; save(); renderExamResult(m);
  }
  function renderExamResult(m) {
    const r = exam.result; const byDom = {}; for (const it of r.items) { const d = QI[it.id].domain; byDom[d] = byDom[d] || { n: 0, c: 0 }; byDom[d].n++; if (it.g.correct) byDom[d].c++; }
    m.innerHTML = '<h1>모의고사 결과</h1><div class="kpi"><div><b>' + r.score + ' / ' + r.items.length + '</b><span>점수</span></div><div><b>' + pct(r.score / r.items.length) + '</b><span>정답률</span></div><div><b>' + Math.round(r.sec / 60) + '분</b><span>소요 시간</span></div></div><div class="card">' + Object.entries(byDom).map(([d, s]) => '<div class="statrow"><span class="lb">' + DOMAINS[d] + '</span><span class="bar"><i style="width:' + pct(s.c / s.n) + '"></i></span><span class="v">' + s.c + '/' + s.n + '</span></div>').join('') + '</div>' +
      '<h2>문항별 검토</h2>' + r.items.map((it, i) => { const q = QI[it.id]; const v = viewFromOrder(q, exam.orders[it.id]); return '<details class="card"><summary>' + (i + 1) + '. ' + (it.g.correct ? '<span class="badge good">정답</span>' : '<span class="badge bad">오답</span>') + '&nbsp;' + esc(q.stem.slice(0, 60)) + '…</summary>' + qHead(q) + (q.case ? '<div class="case">' + esc(q.case) + '</div>' : '') + '<div class="stem">' + esc(q.stem) + '</div>' + optionButtons(q, v, it.g.selected, it.g, true) + '<p>' + para(q.explanation) + '</p>' + srcList(q.sources) + '</details>'; }).join('') +
      '<div class="row"><button class="btn pri" id="again">새 모의고사</button><a class="btn" href="#/wrong">오답노트</a></div>';
    $('#again').onclick = () => { exam = null; nav('#/exam'); };
  }
  function openBook() {
    const d = document.createElement('div'); d.className = 'drawer'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', '오픈북 자료 검색');
    d.innerHTML = '<div class="row sp"><b>📖 오픈북 자료 검색</b><button class="btn sm" id="bkx">닫기</button></div><p class="small muted">시험 중에도 타이머는 계속 흐릅니다.</p><input type="text" id="bkq" placeholder="예: 공황장애 지속기간, Kernberg 분리"><div id="bkr"></div>';
    document.body.appendChild(d); $('#bkx', d).onclick = () => d.remove(); const inp = $('#bkq', d); inp.focus();
    inp.oninput = () => { const r = C.search(index(), inp.value, 6); $('#bkr', d).innerHTML = r.map(x => '<div class="card"><b>' + esc(x.d.name) + ' · ' + esc(x.d.secName) + '</b><p class="small">' + esc(x.d.text.slice(0, 700)) + (x.d.text.length > 700 ? '…' : '') + '</p></div>').join('') || '<p class="muted small">검색 결과 없음</p>'; };
  }

  // ---------- 오답노트 ----------
  function vWrong(m) {
    const wn = C.wrongNote(store.state, QI); const due = new Set(C.dueReviews(store.state).map(x => x.qid));
    m.innerHTML = '<h1>오답노트</h1><div class="row"><a class="btn pri" href="#/quiz?review=1">오늘 복습 (' + due.size + ')</a><button class="btn" id="wAll">오답 전체 다시 풀기</button><button class="btn" id="wSay">🔊 오답노트 듣기</button></div><p class="small muted">틀린 문제는 1·3·7·14일 간격으로 다시 출제됩니다. 복습일에 맞히면 다음 단계로, 다시 틀리면 1일부터 다시 시작합니다.</p>' +
      (wn.length ? wn.map(e => { const q = QI[e.qid]; const sr = store.state.srs[e.qid] || {}; const v = C.makeView(q, {}); return '<details class="card"><summary><span class="badge bad">틀린 횟수 ' + e.wrongs + '</span>&nbsp;' + (due.has(e.qid) ? '<span class="badge warn">오늘 복습</span>&nbsp;' : '') + (sr.done ? '<span class="badge good">복습 완료</span>&nbsp;' : sr.due ? '<span class="badge">다음 복습 ' + new Date(sr.due).toLocaleDateString('ko-KR') + '</span>&nbsp;' : '') + esc(q.stem.slice(0, 70)) + '</summary>' + qHead(q) + (q.case ? '<div class="case">' + esc(q.case) + '</div>' : '') + '<div class="stem">' + esc(q.stem) + '</div>' + optionButtons(q, v, e.firstSelected || [], C.grade(q, e.firstSelected || []), true) + '<p class="small">최초 오답 선택: <b>' + (e.firstSelected || []).join(', ') + '</b> (' + new Date(e.firstWrongTs).toLocaleString('ko-KR') + ') · 정답: <b>' + q.answer.join(', ') + '</b> · 풀이 ' + e.attempts.length + '회 · 최근 ' + (e.lastCorrect ? '정답' : '오답') + '</p><p>' + para(q.explanation) + '</p><div class="row"><a class="btn sm" href="#/study/' + q.disorder + '">관련 단원</a><button class="btn sm" data-re="' + q.id + '">다시 풀기</button></div>' + srcList(q.sources) + '</details>'; }).join('') : '<div class="card muted">아직 틀린 문제가 없습니다.</div>');
    m.querySelectorAll('[data-re]').forEach(b => b.onclick = () => { startQuiz([b.dataset.re], 'review'); history.replaceState(null, '', '#/quiz/run'); renderQ($('#main')); });
    $('#wAll').onclick = () => { if (!wn.length) return toast('오답이 없습니다.'); startQuiz(wn.map(e => e.qid), 'review'); history.replaceState(null, '', '#/quiz/run'); renderQ($('#main')); };
    $('#wSay').onclick = () => { if (!wn.length) return toast('오답이 없습니다.'); nav('#/voice?wrong=1'); };
  }

  // ---------- 통계 ----------
  function bars(obj, labels) { return Object.keys(labels).filter(k => obj[k]).map(k => '<div class="statrow"><span class="lb">' + esc(labels[k]) + '</span><span class="bar"><i style="width:' + pct(obj[k].c / obj[k].n) + '"></i></span><span class="v">' + pct(obj[k].c / obj[k].n) + ' (' + obj[k].c + '/' + obj[k].n + ')</span></div>').join('') || '<p class="muted small">기록 없음</p>'; }
  function vStats(m) {
    const st = C.stats(store.state, QI); const pr = progress(); const disLabels = Object.fromEntries(Object.values(DIS).map(d => [d.id, d.name]));
    const days = {}; for (const a of store.state.attempts) { const k = new Date(a.ts).toLocaleDateString('ko-KR'); days[k] = (days[k] || 0) + 1; }
    m.innerHTML = '<h1>학습 통계</h1><div class="kpi"><div><b>' + st.total + '</b><span>총 풀이 횟수</span></div><div><b>' + (st.total ? pct(st.rate) : '–') + '</b><span>전체 정답률</span></div><div><b>' + (st.total ? pct(st.firstRate) : '–') + '</b><span>첫 시도 정답률</span></div><div><b>' + st.solvedCount + '/' + QS.length + '</b><span>문제 진도</span></div><div><b>' + pr.done + '/' + pr.all + '</b><span>단원 진도</span></div></div>' +
      '<h2>영역별 정답률</h2><div class="card">' + bars(st.byDomain, DOMAINS) + '</div><h2>난이도별 정답률</h2><div class="card">' + bars(st.byLevel, LEVELS) + '</div>' +
      '<h2>취약 개념 (2회 이상 풀고 정답률 70% 미만)</h2><div class="card">' + (st.weak.length ? '<ul class="tight">' + st.weak.map(w => '<li>' + esc(w.concept) + ' — ' + pct(w.rate) + ' (' + w.n + '회) <a href="#/quiz?concept=' + encodeURIComponent(w.concept) + '">다시 풀기</a></li>').join('') + '</ul>' : '<p class="muted small">아직 분석할 기록이 부족합니다.</p>') + '</div>' +
      '<h2>장애별 정답률</h2><div class="card">' + bars(st.byDisorder, disLabels) + '</div><h2>날짜별 풀이 수</h2><div class="card small">' + (Object.entries(days).map(([d, n]) => d + ': ' + n + '회').join(' · ') || '기록 없음') + '</div>';
  }

  // ---------- AI 개인교수 ----------
  const chat = []; // {role, text, meta}
  const apiHistory = [];
  function localAnswer(text, ctx) {
    const cmd = C.parseCommand(text, { qType: ctx.q && ctx.q.type });
    const q = ctx.q, v = ctx.view;
    if (q && cmd.type === 'why_option') {
      if (!ctx.submitted) return { text: '아직 답을 제출하지 않은 문제라 보기별 정오 해설은 제출 후에 보여드립니다. 힌트: 관련 단원 「' + (DIS[q.disorder] || {}).name + '」의 진단 기준과 감별진단을 다시 확인해 보세요.', src: '문제은행' };
      const k = v.keyAt(cmd.number); const o = q.options.find(x => x.key === k);
      if (!o) return { text: '그 번호의 보기가 없습니다.' };
      return { text: cmd.number + '번 보기는 ' + (o.in_answer ? '정답에 포함됩니다' : '정답이 아닙니다') + (q.type !== 'ox' ? '(진술 자체는 ' + (o.is_true ? '옳음' : '옳지 않음') + ')' : '') + '.\n\n' + o.explanation + (q.theory ? '\n\n관련 이론: ' + q.theory : ''), src: '문제은행 ' + q.id + ' 검증 해설 (' + q.verification_status + ', 교재 미대조)' };
    }
    if (q && ctx.submitted && (cmd.type === 'explain')) return { text: q.explanation, src: '문제은행 ' + q.id };
    if (/자주\s*틀리|취약|약한\s*부분/.test(text)) {
      const st = C.stats(store.state, QI); if (!st.weak.length) return { text: '아직 취약 개념을 판단할 풀이 기록이 부족합니다. 같은 개념 문제를 2회 이상 풀면 분석됩니다.' };
      const out = st.weak.slice(0, 3).map(w => { const qq = QS.find(x => x.concept === w.concept); const d = qq && DIS[qq.disorder]; return '■ ' + w.concept + ' (정답률 ' + pct(w.rate) + ')\n' + (d ? d.name + ' 시험 핵심: ' + (d.sections.exam_points || []).slice(0, 4).join(' / ') + '\n혼동 주의: ' + (d.sections.confusions || []).slice(0, 3).join(' / ') : ''); });
      return { text: '자주 틀리는 개념을 다시 정리합니다.\n\n' + out.join('\n\n'), src: '내 풀이 기록 + 학습 콘텐츠' };
    }
    if (/더\s*필요|추가.*정보|어떤 정보/.test(text) && q) { const d = DIS[q.disorder]; return { text: d.name + ' 진단을 확정하려면 다음을 확인해야 합니다.\n\n진단 기준: ' + (d.sections.criteria || []).join(' ') + '\n\n지속기간: ' + d.sections.duration + '\n\n배제·예외: ' + d.sections.exceptions + '\n\n감별할 장애: ' + (d.sections.differential || []).map(x => x.vs).join(', '), src: d.name + ' 단원' }; }
    // 두 장애 비교
    const names = Object.values(DIS).filter(d => d.id.indexOf('overview') < 0 && d.id !== 'pd_general').map(d => ({ d, idx: text.indexOf(d.name.replace(/\s/g, '')) >= 0 ? text.indexOf(d.name.replace(/\s/g, '')) : text.indexOf(d.name) })).filter(x => x.idx >= 0);
    const uniq = names.filter((x, i) => !names.some((y, j) => j !== i && y.d.name.length > x.d.name.length && y.d.name.includes(x.d.name)));
    if (uniq.length >= 2 && /차이|비교|구별|감별|다른/.test(text)) {
      const [a, b] = uniq.sort((x, y) => x.idx - y.idx).map(x => x.d);
      const da = (a.sections.differential || []).filter(x => x.vs.includes(b.name.replace(/ /g, '')) || x.vs.includes(b.name) || b.name.includes(x.vs));
      const db = (b.sections.differential || []).filter(x => x.vs.includes(a.name) || a.name.includes(x.vs));
      let t = a.name + '와(과) ' + b.name + ' 비교\n\n';
      if (da.length || db.length) t += da.concat(db).map(x => '• ' + x.point).join('\n') + '\n\n';
      t += '■ ' + a.name + ': ' + C.splitSentences(a.summary).slice(0, 3).join(' ') + '\n\n■ ' + b.name + ': ' + C.splitSentences(b.summary).slice(0, 3).join(' ');
      return { text: t, src: a.name + ' · ' + b.name + ' 단원(감별진단, 핵심 요약)' };
    }
    const r = C.search(index(), text + ' ' + (ctx.unit ? DIS[ctx.unit].name : ''), 3);
    if (!r.length) return { text: '프로그램 안의 학습자료에서 관련 내용을 찾지 못했습니다. 질문을 장애 이름이나 이론가 이름을 넣어 다시 해 보세요. (근거 없는 내용을 지어내지 않기 위해 검색 결과가 없으면 답하지 않습니다.)' };
    return { text: r.map(x => '■ ' + x.d.name + ' · ' + x.d.secName + '\n' + x.d.text.slice(0, 900) + (x.d.text.length > 900 ? '…' : '')).join('\n\n'), src: r.map(x => x.d.name + '/' + x.d.secName).join(', ') + ' (출처 상태는 각 단원 참조, 교재 미대조)' };
  }
  async function tutorAnswer(text, ctx, preferAI) {
    if (preferAI && AI.isConfigured(store.state.settings)) {
      const passages = C.search(index(), text + ' ' + (ctx.q ? (DIS[ctx.q.disorder] || {}).name + ' ' + ctx.q.stem : '') + ' ' + (ctx.unit ? DIS[ctx.unit].name : ''), 4).map(x => x.d);
      const r = await AI.ask(store.state, apiHistory, text, { question: ctx.q, view: ctx.view, submitted: ctx.submitted, selected: ctx.selected, unit: ctx.unit ? DIS[ctx.unit].name : null, passages, weak: C.stats(store.state, QI).weak }); save();
      if (r.ok) { apiHistory.push({ role: 'user', content: text }, { role: 'assistant', content: r.text }); return { text: r.text, src: 'Claude AI(' + r.model + ') · 참고자료: ' + passages.map(p => p.name + '/' + p.secName).join(', ') + ' · 예상 비용 $' + r.cost.toFixed(4), ai: true }; }
      const loc = localAnswer(text, ctx); return { text: '[AI 응답 실패: ' + r.error + ']\n검색 기반 도우미의 답변으로 대신합니다.\n\n' + loc.text, src: loc.src };
    }
    return localAnswer(text, ctx);
  }
  function vTutor(m, args, params) {
    const unit = params.get('unit'); const cq = window.__ctxQuestion;
    const aiOn = AI.isConfigured(store.state.settings);
    m.innerHTML = '<h1>AI 개인교수</h1><div class="card small">' + (aiOn ? '<span class="badge good">Claude AI 연결됨(유료, 사용자 키)</span> 질문할 때마다 API 요금이 발생합니다. 오늘 ' + AI.usageToday(store.state).requests + '/' + store.state.settings.ai.dailyLimit + '회 사용.' : '<span class="badge warn">AI 미연결</span> 지금은 <b>검색 기반 학습 도우미</b>(무료, 인터넷 불필요)가 프로그램 안의 학습자료와 문제 해설에서 근거를 찾아 답합니다. 생성형 AI가 아니므로 자유로운 설명은 제한됩니다. 실제 AI 대화는 설정에서 API 키를 입력하면 사용할 수 있습니다(연동 준비 완료 · 실호출 미검증).') +
      '<br>현재 맥락: ' + (cq ? '문제 ' + cq.q.id + (cq.submitted ? '(제출함)' : '(미제출 — 정답 비공개)') : '없음') + (unit && DIS[unit] ? ' · 단원 ' + DIS[unit].name : '') + '</div>' +
      '<div class="row tiny">' + ['강박장애와 강박성 성격장애의 차이를 설명해 줘', '공황장애의 클라크 인지모형을 설명해 줘', '3번 보기가 왜 오답인지 알려줘', '성격장애 A군과 C군을 비교해 줘', '내가 자주 틀리는 부분을 다시 강의해 줘', '이 진단을 내리려면 어떤 정보가 더 필요해?'].map(s => '<button class="btn sm ex">' + esc(s) + '</button>').join('') + '</div>' +
      '<div class="chat card" id="chat" aria-live="polite">' + (chat.length ? chat.map(msgHtml).join('') : '<p class="muted small">질문을 입력하세요.</p>') + '</div>' +
      '<div class="row"><input type="text" id="tq" placeholder="질문을 입력하세요" style="flex:1;min-width:200px"><button class="btn pri" id="tsend">보내기</button><button class="btn" id="tmic" aria-label="음성으로 질문">🎤</button><label class="chk"><input type="checkbox" id="tsay">답변 읽어주기</label></div>';
    const send = async (text) => { if (!text.trim()) return; chat.push({ role: 'u', text }); render(); const ctx = cq ? { q: cq.q, view: cq.view, submitted: cq.submitted, selected: cq.selected, unit } : { unit }; const a = await tutorAnswer(text, ctx, true); chat.push({ role: 'a', text: a.text, meta: (a.ai ? '' : '검색 기반 도우미(AI 아님) · ') + '근거: ' + (a.src || '—') }); render(); if ($('#tsay').checked) speaker.say(a.text.replace(/[■•]/g, '')); };
    const render = () => { $('#chat').innerHTML = chat.map(msgHtml).join(''); const c = $('#chat'); c.scrollTop = c.scrollHeight; };
    $('#tsend').onclick = () => { const t = $('#tq').value; $('#tq').value = ''; send(t); };
    $('#tq').onkeydown = e => { if (e.key === 'Enter') $('#tsend').click(); };
    m.querySelectorAll('.ex').forEach(b => b.onclick = () => send(b.textContent));
    $('#tmic').onclick = () => { toast('듣는 중…'); recog.listenOnce(r => { if (r.error) return toast(r.error, 5000); $('#tq').value = r.text; send(r.text); }); };
  }
  function msgHtml(x) { return '<div class="msg ' + x.role + '">' + esc(x.text) + (x.meta ? '<span class="meta">' + esc(x.meta) + '</span>' : '') + '</div>'; }

  // ---------- 음성 학습실 ----------
  const lec = { list: [], i: 0, s: 0, scope: '', engine: 'tts' };
  function scopeKey(o) { return [o.domain || 'all', o.disorder || '', o.mode || 'full', o.wrong ? 'wrong' : ''].join('|'); }
  function wrongPlaylist() {
    return C.wrongNote(store.state, QI).map(e => { const q = QI[e.qid]; const v = C.makeView(q, {}); return { id: 'w:' + q.id, title: '오답 ' + q.id, sentences: C.questionSpeech(q, v).concat(['정답은 ' + q.answer.map(k => q.type === 'ox' ? k : k + '번').join(', ') + '입니다.']).concat(C.splitSentences(q.explanation)) }; });
  }
  function vVoice(m, args, params) {
    const o = { domain: params.get('domain') || '', disorder: params.get('disorder') || '', mode: params.get('mode') || 'full', wrong: params.get('wrong') === '1' };
    const tab = params.get('tab') || 'lecture';
    m.innerHTML = '<h1>음성 학습실</h1><div class="tabs"><a class="btn sm ' + (tab === 'lecture' ? 'on' : '') + '" href="#/voice?tab=lecture">연속 강의 듣기</a><a class="btn sm ' + (tab === 'quiz' ? 'on' : '') + '" href="#/voice?tab=quiz">음성 문제 풀이</a><a class="btn sm ' + (tab === 'drive' ? 'on' : '') + '" href="#/voice?tab=drive">운전 중 청취</a></div><div id="vbody"></div>';
    if (!speaker.supported) $('#vbody').insertAdjacentHTML('beforebegin', '<p class="hl-note">이 브라우저는 음성 합성을 지원하지 않습니다.</p>');
    else if (!speaker.hasKorean()) $('#vbody').insertAdjacentHTML('beforebegin', '<p class="hl-note small">한국어 음성이 아직 확인되지 않았습니다. 재생이 안 되면 기기 설정에서 한국어 TTS 음성을 설치하세요(안드로이드: 설정 › 접근성/일반 › 텍스트 음성 변환 › Google 음성 › 한국어).</p>');
    if (tab === 'quiz') return voiceQuiz($('#vbody'));
    if (tab === 'drive') return driveMode($('#vbody'));
    lecture($('#vbody'), o);
  }
  function lecture(b, o) {
    const files = (DATA.audio || []);
    b.innerHTML = '<div class="card"><div class="row"><label class="f">범위<select id="lScope"><option value="">전체 영역 순차 듣기</option>' + CONTENT.map(c => '<option value="d:' + c.domain + '">' + esc(c.title) + '</option>' + c.disorders.map(d => '<option value="x:' + d.id + '">　· ' + esc(d.name) + '</option>').join('')).join('') + '<option value="w:">오답노트</option></select></label><label class="f">내용<select id="lMode"><option value="full">상세 강의(요약+18개 항목+심화)</option><option value="summary">핵심 요약만</option></select></label><label class="f" style="max-width:150px">속도<select id="lRate">' + [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2].map(r => '<option value="' + r + '"' + (store.state.audio.rate == r ? ' selected' : '') + '>' + r + '배</option>').join('') + '</select></label></div>' +
      '<div class="row"><label class="chk"><input type="checkbox" id="lAuto"' + (store.state.audio.auto ? ' checked' : '') + '>자동 연속 재생</label><label class="chk"><input type="checkbox" id="lRep">현재 항목 반복</label></div>' +
      '<div class="row" style="margin:8px 0"><button class="btn" id="lPrev" aria-label="이전 항목">⏮ 이전</button><button class="btn pri" id="lPlay">▶ 재생</button><button class="btn" id="lPause">⏸ 일시정지</button><button class="btn" id="lAgain">↺ 다시 읽기</button><button class="btn" id="lNext" aria-label="다음 항목">다음 ⏭</button></div>' +
      '<p class="small"><b id="lTitle">—</b> <span class="muted" id="lPos"></span></p><div class="lecture-box" id="lText" aria-live="off"></div></div>' +
      '<details class="card"><summary>재생 목록</summary><ol class="tight small" id="lList"></ol></details>' +
      '<div class="card small"><b>화면 잠금·백그라운드 재생 안내</b><br>브라우저 TTS는 기기에서 음성을 합성하므로 인터넷 없이도 동작하지만, 안드로이드에서 화면을 끄거나 다른 앱으로 전환하면 재생이 멈출 수 있습니다(실기기 미검증). 운전 중에는 화면을 켜 둔 채 거치하거나 아래 <b>오디오 파일</b> 방식을 사용하세요.' + (files.length ? '<div class="row" style="margin-top:8px"><button class="btn" id="aPlay">🎧 오디오 파일로 재생(' + files.length + '개, 잠금화면 제어 지원)</button></div><p class="tiny muted">오디오 파일은 오프라인 음성합성기(eSpeak NG)로 만든 핵심 요약 음성입니다. 음질이 기계적입니다.</p>' : '<p class="tiny muted">오디오 파일 묶음(audio 폴더)이 함께 배포되면 여기서 재생할 수 있습니다.</p>') + '</div>';
    const scopeSel = $('#lScope'); if (o.wrong) scopeSel.value = 'w:'; else if (o.disorder) scopeSel.value = 'x:' + o.disorder; else if (o.domain) scopeSel.value = 'd:' + o.domain; $('#lMode').value = o.mode;
    const build = () => { const v = scopeSel.value; const mode = $('#lMode').value; const opt = { mode }; if (v.startsWith('d:')) opt.domain = v.slice(2); if (v.startsWith('x:')) opt.disorder = v.slice(2); if (v === 'w:') opt.wrong = true; lec.scope = scopeKey(opt); lec.list = opt.wrong ? wrongPlaylist() : C.buildPlaylist(CONTENT, opt); const p = store.state.audio.pos[lec.scope] || { i: 0, s: 0 }; lec.i = Math.min(p.i, Math.max(0, lec.list.length - 1)); lec.s = p.s || 0; showList(); show(); };
    const showList = () => { $('#lList').innerHTML = lec.list.map((t, i) => '<li><a href="javascript:void 0" data-i="' + i + '">' + esc(t.title) + '</a></li>').join(''); $('#lList').querySelectorAll('a').forEach(a => a.onclick = () => { lec.i = Number(a.dataset.i); lec.s = 0; play(); }); };
    const show = () => { const t = lec.list[lec.i]; if (!t) { $('#lTitle').textContent = '재생할 내용이 없습니다'; $('#lText').innerHTML = ''; return; } $('#lTitle').textContent = t.title; $('#lPos').textContent = '(' + (lec.i + 1) + '/' + lec.list.length + ' 항목, 문장 ' + (lec.s + 1) + '/' + t.sentences.length + ')'; $('#lText').innerHTML = t.sentences.map((s, i) => '<span class="sent' + (i === lec.s ? ' on' : '') + '" data-s="' + i + '">' + esc(s) + '</span> ').join(''); const on = $('#lText .sent.on'); if (on) on.scrollIntoView({ block: 'nearest' }); $('#lText').querySelectorAll('.sent').forEach(sp => sp.onclick = () => { lec.s = Number(sp.dataset.s); play(); }); };
    const savePos = () => { store.state.audio.pos[lec.scope] = { i: lec.i, s: lec.s, ts: Date.now() }; save(); };
    const play = () => { const t = lec.list[lec.i]; if (!t) return; speaker.rate = Number($('#lRate').value); speaker.speakList(t.sentences, { startAt: lec.s, onSentence: (i) => { lec.s = i; savePos(); if ($('#lText')) show(); }, onEnd: (r) => { if (r && r.error) return toast(r.error); if ($('#lRep') && $('#lRep').checked) { lec.s = 0; return play(); } if (store.state.audio.auto && lec.i < lec.list.length - 1) { lec.i++; lec.s = 0; savePos(); if ($('#lText')) show(); play(); } else { lec.s = 0; savePos(); toast('재생을 마쳤습니다.'); } } }); };
    scopeSel.onchange = () => { speaker.stop(); build(); }; $('#lMode').onchange = scopeSel.onchange;
    $('#lRate').onchange = () => { store.state.audio.rate = Number($('#lRate').value); save(); if (speaker.playing && !speaker.paused) play(); };
    $('#lAuto').onchange = () => { store.state.audio.auto = $('#lAuto').checked; save(); };
    $('#lPlay').onclick = () => { if (speaker.playing && speaker.paused) speaker.resume(); else play(); };
    $('#lPause').onclick = () => speaker.pause();
    $('#lAgain').onclick = () => { if (speaker.playing) speaker.repeatSentence(); else play(); };
    $('#lPrev').onclick = () => { if (lec.i > 0) { lec.i--; lec.s = 0; savePos(); show(); if (speaker.playing) play(); } };
    $('#lNext').onclick = () => { if (lec.i < lec.list.length - 1) { lec.i++; lec.s = 0; savePos(); show(); if (speaker.playing) play(); } };
    if ($('#aPlay')) $('#aPlay').onclick = () => { speaker.stop(); const ap = audioPlayer(); ap.load(files.map(f => ({ src: f.src, title: f.title, album: DOMAINS[f.domain] }))); const pos = store.state.audio.pos.__files || { i: 0, t: 0 }; ap.play(pos.i, pos.t).catch(e => toast('오디오 재생 실패: ' + e.message)); toast('오디오 파일 재생: 잠금화면/알림창에서 일시정지·다음 항목 조작 가능'); };
    build();
    window.__lecture = { lec, play, build };
  }
  let AP = null; function audioPlayer() { if (!AP) { AP = new V.AudioPlayer($('#audioEl')); AP.el.addEventListener('timeupdate', () => { if (Math.floor(AP.el.currentTime) % 10 === 0) { store.state.audio.pos.__files = { i: AP.i, t: AP.el.currentTime }; save(); } }); } return AP; }

  // 음성 문제 풀이 컨트롤러
  const vq = { q: null, view: null, submitted: false, graded: null, pending: null, filter: {}, seen: [], log: [], queue: null };
  function vqSay(text, then) { const lines = Array.isArray(text) ? text : C.splitSentences(text); vq.log.push({ who: '프로그램', text: lines.join(' ') }); renderVqLog(); speaker.speakList(lines, { onEnd: () => then && then() }); }
  function vqLog(who, text) { vq.log.push({ who, text }); store.state.voiceLog.push({ ts: Date.now(), who, text }); if (store.state.voiceLog.length > 500) store.state.voiceLog.splice(0, store.state.voiceLog.length - 500); save(); renderVqLog(); }
  function renderVqLog() { const el = $('#vqLog'); if (!el) return; el.innerHTML = vq.log.slice(-30).map(x => '<div class="msg ' + (x.who === '나' ? 'u' : 'a') + '"><b class="tiny">' + esc(x.who) + '</b> ' + esc(x.text) + '</div>').join(''); el.scrollTop = el.scrollHeight; const qq = $('#vqQ'); if (qq) qq.innerHTML = vq.q ? qHead(vq.q) + (vq.q.case ? '<div class="case">' + esc(vq.q.case) + '</div>' : '') + '<div class="stem">' + esc(vq.q.stem) + '</div>' + optionButtons(vq.q, vq.view, vq.graded ? vq.graded.selected : (vq.pending || []), vq.graded, !!vq.graded) : '<p class="muted small">아직 출제된 문제가 없습니다. "강박장애 고난도 문제 하나 내줘"처럼 말하거나 입력하세요.</p>'; }
  function vqPose(q) { vq.q = q; vq.view = C.makeView(q, { shuffleOptions: store.state.settings.shuffleOptions }); vq.submitted = false; vq.graded = null; vq.pending = null; vq.seen.push(q.id); window.__ctxQuestion = { q, view: vq.view, submitted: false }; vqSay(C.questionSpeech(q, vq.view).concat([q.type === 'multi' ? '해당하는 번호를 모두 말해 주세요.' : q.type === 'ox' ? '' : '정답 번호를 말해 주세요.'].filter(Boolean))); }
  function vqPick(f) { let pool = QS.filter(q => !vq.seen.includes(q.id)); pool = C.filterQuestions(pool, f, store.state); if (!pool.length) pool = C.filterQuestions(QS, f, store.state); return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null; }
  async function vqHandle(text, conf) {
    vqLog('나', text + (conf != null && conf < 1 ? ' (인식 신뢰도 ' + Math.round(conf * 100) + '%)' : ''));
    const cmd = C.parseCommand(text, { awaitingConfirm: !!vq.pending, qType: vq.q && vq.q.type });
    if (vq.pending && cmd.type === 'confirm_yes') { const q = vq.q; const g = C.grade(q, vq.pending); vq.graded = g; vq.submitted = true; vq.pending = null; store.recordAttempt(q, g, { mode: 'voice', via: 'voice', order: vq.view.order }); window.__ctxQuestion = { q, view: vq.view, submitted: true, selected: g.selected }; const wrongPicks = g.perOption.filter(p => p.status === 'wrong_pick').map(p => vq.view.label(p.key)); const miss = g.perOption.filter(p => p.status === 'miss').map(p => vq.view.label(p.key)); return vqSay((g.correct ? '정답입니다. ' : '오답입니다. ') + '정답은 ' + q.answer.map(k => vq.view.label(k)).sort().join('번, ') + (q.type === 'ox' ? '' : '번') + '입니다. ' + (wrongPicks.length ? wrongPicks.join(', ') + '번은 정답이 아닙니다. ' : '') + (miss.length ? miss.join(', ') + '번을 놓쳤습니다. ' : '') + '해설을 들으려면 해설해 줘, 보기별 이유는 몇 번 보기는 왜 틀렸어, 라고 말하세요.'); }
    if (vq.pending && cmd.type === 'confirm_no') { vq.pending = null; return vqSay('취소했습니다. 정답 번호를 다시 말해 주세요.'); }
    if (vq.pending && cmd.type !== 'answer') { /* 확인 대기 중 다른 명령 → 대기 해제 */ vq.pending = null; }
    switch (cmd.type) {
      case 'quiz': { const f = {}; if (cmd.domain) f.domain = cmd.domain; if (cmd.level) f.level = cmd.level; const dn = Object.values(DIS).sort((a, b) => b.name.length - a.name.length).find(d => text.replace(/\s/g, '').includes(d.name.replace(/\s/g, ''))); if (dn && dn.id.indexOf('overview') < 0) f.disorder = dn.id; vq.filter = f; const q = vqPick(f); return q ? vqPose(q) : vqSay('조건에 맞는 문제가 없습니다.'); }
      case 'next': { const q = vqPick(vq.queue ? {} : vq.filter); if (vq.queue && vq.queue.length) return vqPose(QI[vq.queue.shift()]); return q ? vqPose(q) : vqSay('더 낼 문제가 없습니다.'); }
      case 'similar': { if (!vq.q) return vqSay('먼저 문제를 하나 풀어 주세요.'); const s = C.similar(vq.q, QS, vq.seen); return s ? vqPose(s) : vqSay('같은 개념의 다른 문제가 없습니다. 다음 문제라고 말하면 같은 영역에서 냅니다.'); }
      case 'wrong_review': { const due = C.dueReviews(store.state).map(d => d.qid); const all = C.wrongNote(store.state, QI).map(e => e.qid); vq.queue = (due.length ? due : all).filter(id => QI[id]); if (!vq.queue.length) return vqSay('복습할 오답이 없습니다.'); vqSay('오답 복습을 시작합니다. ' + vq.queue.length + '문제입니다.', () => vqPose(QI[vq.queue.shift()])); return; }
      case 'repeat': return vq.q ? vqSay(C.questionSpeech(vq.q, vq.view)) : vqSay('읽을 문제가 없습니다.');
      case 'read_options': return vq.q ? vqSay(C.questionSpeech(vq.q, vq.view).filter(s => /^\d번\.|오 또는/.test(s))) : vqSay('읽을 문제가 없습니다.');
      case 'answer': {
        if (!vq.q) return vqSay('아직 문제가 없습니다. 문제 내 줘, 라고 말해 보세요.');
        if (vq.submitted) return vqSay('이미 채점한 문제입니다. 다음 문제, 또는 비슷한 문제, 라고 말하세요.');
        let keys = cmd.keys || (cmd.numbers || []).map(n => vq.view.keyAt(n)).filter(Boolean);
        if (vq.q.type !== 'ox' && (cmd.numbers || []).some(n => n < 1 || n > 5)) keys = [];
        if (!keys.length) return vqSay('번호를 알아듣지 못했습니다. 예를 들어 정답은 2번과 4번, 처럼 말해 주세요.');
        if (vq.q.type !== 'multi' && keys.length > 1) return vqSay('이 문제는 하나만 고르는 문제입니다. 번호를 하나만 말해 주세요.');
        vq.pending = keys; renderVqLog();
        return vqSay('제가 들은 답은 ' + keys.map(k => vq.view.label(k)).join('번, ') + (vq.q.type === 'ox' ? '' : '번') + '입니다. 이대로 제출할까요? 네 또는 아니오로 답해 주세요.');
      }
      case 'why_option': { if (!vq.q) return vqSay('문제가 없습니다.'); if (!vq.submitted) return vqSay('보기별 해설은 답을 제출한 뒤에 들려드립니다.'); const k = vq.view.keyAt(cmd.number); const o = vq.q.options.find(x => x.key === k); return o ? vqSay(cmd.number + '번 보기는 ' + (o.in_answer ? '정답에 포함됩니다. ' : '정답이 아닙니다. ') + o.explanation) : vqSay('그 번호의 보기가 없습니다.'); }
      case 'explain': if (!vq.q) return vqSay('문제가 없습니다.'); if (!vq.submitted) return vqSay('해설은 답을 제출한 뒤에 들려드립니다.'); return vqSay(vq.q.explanation);
      case 'more': { if (!vq.q) return vqSay('문제가 없습니다.'); const d = DIS[vq.q.disorder]; return vqSay(d.name + ' 심화 설명입니다. ' + C.splitSentences(d.deep).slice(0, 8).join(' ')); }
      case 'theory': { if (!vq.q) return vqSay('문제가 없습니다.'); const d = DIS[vq.q.disorder]; return vqSay((vq.q.theory ? '이 문제의 관련 이론은 ' + vq.q.theory + '입니다. ' : '') + (d.sections.theorists || []).slice(0, 3).map(t => t.name + '. ' + t.theory).join(' ')); }
      case 'pause': speaker.pause(); return;
      case 'resume': speaker.resume(); return;
      case 'lecture_start': nav('#/voice?tab=lecture' + (cmd.domain ? '&domain=' + cmd.domain : '')); setTimeout(() => window.__lecture && window.__lecture.play(), 300); return;
      case 'empty': return;
      default: { const ctx = vq.q ? { q: vq.q, view: vq.view, submitted: vq.submitted, selected: vq.graded && vq.graded.selected } : {}; const a = await tutorAnswer(text, ctx, true); return vqSay((a.ai ? '' : '검색 기반 도우미의 답변입니다. ') + a.text.replace(/[■•]/g, '').slice(0, 1500)); }
    }
  }
  function voiceQuiz(b) {
    b.innerHTML = '<div class="card small">마이크 버튼을 누르고 말하세요. 예: "강박장애 고난도 문제 하나 내줘" → "정답은 2번과 4번이야" → "네" → "3번 보기는 왜 틀렸어?" → "비슷한 문제 하나 더 내줘". 답은 항상 <b>확인 후</b> 채점하므로 잘못 알아들은 답이 기록되지 않습니다. ' + (recog.supported ? '' : '<br><span class="badge warn">이 브라우저는 음성 인식 미지원 — 아래 입력창을 사용하세요.</span>') + '</div>' +
      '<div class="row"><button class="btn pri" id="vqMic" style="min-width:160px">🎤 말하기</button><label class="chk"><input type="checkbox" id="vqAuto">답을 읽은 뒤 자동으로 듣기</label></div><div class="row" style="margin-top:8px"><input type="text" id="vqIn" placeholder="명령을 입력해도 됩니다 (예: 정답은 1번과 3번)" style="flex:1;min-width:200px"><button class="btn" id="vqSend">보내기</button></div>' +
      '<div class="row tiny" style="margin-top:6px">' + ['불안장애 문제 하나 내줘', '강박장애 고난도 문제 하나 내줘', '다시 읽어줘', '보기만 읽어줘', '해설해 줘', '더 자세히', '관련 이론 설명해 줘', '다음 문제', '비슷한 문제 하나 더 내줘', '오답 복습 시작', '일시정지', '이어서'].map(s => '<button class="btn sm vqx">' + s + '</button>').join('') + '</div>' +
      '<div class="card" id="vqQ"></div><div class="chat card" id="vqLog" style="max-height:360px;overflow-y:auto"></div>';
    const listen = () => { $('#vqMic').textContent = '🎙 듣는 중…'; speaker.stop(); recog.listenOnce(r => { $('#vqMic').textContent = '🎤 말하기'; if (r.error) return vqLog('시스템', r.error); vqHandle(r.text, r.confidence); }); };
    $('#vqMic').onclick = listen;
    $('#vqSend').onclick = () => { const t = $('#vqIn').value; $('#vqIn').value = ''; vqHandle(t); };
    $('#vqIn').onkeydown = e => { if (e.key === 'Enter') $('#vqSend').click(); };
    b.querySelectorAll('.vqx').forEach(x => x.onclick = () => vqHandle(x.textContent));
    renderVqLog();
    window.__vq = { vq, vqHandle };
  }
  // 운전 모드: 화면 조작 없이 연속 청취. 강의 연속 재생 또는 '듣기 퀴즈'(문제→생각할 시간→정답·해설).
  function driveMode(b) {
    b.innerHTML = '<div class="card"><p><b>운전 중에는 화면을 보거나 조작하지 마세요.</b> 출발 전에 한 번만 시작하면 끝까지 연속 재생됩니다.</p><div class="row"><label class="f">내용<select id="dMode"><option value="lecture">전체 강의 이어 듣기</option><option value="summary">핵심 요약 연속 듣기</option><option value="listenquiz">듣기 퀴즈(문제 → 8초 생각 → 정답·해설)</option><option value="wrong">오답노트 듣기</option></select></label><label class="f">영역<select id="dDom"><option value="">전체</option>' + Object.entries(DOMAINS).map(([k, t]) => '<option value="' + k + '">' + t + '</option>').join('') + '</select></label></div><p><button class="btn pri" id="dGo">운전 모드 시작</button></p><p class="small muted">화면 꺼짐 방지(Wake Lock)를 요청합니다. 지원되지 않으면 기기 설정에서 화면 자동 꺼짐 시간을 늘리세요. 안드로이드 화면 잠금 상태의 TTS 지속 재생은 실기기에서 검증하지 못했습니다.</p></div>';
    $('#dGo').onclick = async () => {
      const mode = $('#dMode').value, dom = $('#dDom').value; let lock = null;
      try { if (navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); } catch (e) { }
      const ov = document.createElement('div'); ov.className = 'drive'; ov.innerHTML = '<div class="now" id="dNow">준비 중…</div><button class="big" id="dBig">일시정지</button><button class="btn" id="dEnd" style="background:#333;color:#eee;border-color:#555">운전 모드 종료</button>'; document.body.appendChild(ov);
      let paused = false; const stopAll = () => { speaker.stop(); clearTimeout(timer); if (lock) lock.release().catch(() => { }); ov.remove(); };
      let timer = null; let items;
      if (mode === 'listenquiz') { items = C.shuffle(QS.filter(q => !dom || q.domain === dom)).map(q => { const v = C.makeView(q, {}); return { title: q.id, sentences: C.questionSpeech(q, v), after: ['정답은 ' + q.answer.map(k => q.type === 'ox' ? k : k + '번').join(', ') + '입니다.'].concat(C.splitSentences(q.explanation)) }; }); }
      else if (mode === 'wrong') items = wrongPlaylist();
      else items = C.buildPlaylist(CONTENT, { domain: dom || undefined, mode: mode === 'summary' ? 'summary' : 'full' });
      const key = 'drive|' + mode + '|' + dom; let i = (store.state.audio.pos[key] || {}).i || 0; if (i >= items.length) i = 0;
      const step = () => { if (!document.body.contains(ov)) return; if (i >= items.length) { $('#dNow', ov).textContent = '모두 들었습니다.'; return speaker.say('모두 들었습니다. 운전 모드를 마칩니다.'); } const it = items[i]; $('#dNow', ov).textContent = (i + 1) + '/' + items.length + ' · ' + it.title; store.state.audio.pos[key] = { i }; save(); speaker.rate = store.state.audio.rate; speaker.speakList(it.sentences, { onEnd: () => { if (it.after) { speaker.speakList(['생각할 시간 8초.'], { onEnd: () => { timer = setTimeout(() => speaker.speakList(it.after, { onEnd: () => { i++; step(); } }), 8000); } }); } else { i++; step(); } } }); };
      $('#dBig', ov).onclick = () => { paused = !paused; if (paused) { speaker.pause(); clearTimeout(timer); $('#dBig', ov).textContent = '이어 듣기'; } else { $('#dBig', ov).textContent = '일시정지'; if (speaker.playing) speaker.resume(); else step(); } };
      $('#dEnd', ov).onclick = stopAll;
      step();
    };
  }

  // ---------- 설정·백업 ----------
  function vSettings(m) {
    const s = store.state.settings, ai = s.ai; const u = AI.usageToday(store.state);
    const totals = Object.values(store.state.usage.ai).reduce((t, x) => ({ r: t.r + x.requests, i: t.i + x.input, o: t.o + x.output }), { r: 0, i: 0, o: 0 });
    m.innerHTML = '<h1>설정 및 데이터 백업</h1>' +
      '<div class="card"><h2 style="margin-top:0">화면</h2><div class="row"><label class="f">테마<select id="sTheme"><option value="auto">시스템 설정 따름</option><option value="light">라이트</option><option value="dark">다크</option></select></label><label class="chk"><input type="checkbox" id="sShuf"' + (s.shuffleOptions ? ' checked' : '') + '>보기 순서 섞기(기본)</label></div></div>' +
      '<div class="card"><h2 style="margin-top:0">학습 데이터 백업</h2><p class="small muted">풀이 이력 ' + store.state.attempts.length + '건 · 북마크 ' + Object.keys(store.state.bookmarks).length + ' · 모의고사 ' + store.state.exams.length + '회 · 데이터 구조 v' + store.state.schema_version + '. 기록은 이 브라우저에 자동 저장됩니다. 브라우저 데이터를 지우면 사라지므로 주기적으로 백업하세요. 백업 파일에는 API 키가 포함되지 않습니다.</p><div class="row"><button class="btn pri" id="bExp">JSON 백업 받기</button><label class="btn" for="bFile">JSON 가져오기</label><input type="file" id="bFile" accept="application/json,.json" class="sr"><label class="chk"><input type="radio" name="bMode" value="merge" checked>병합(중복 제거)</label><label class="chk"><input type="radio" name="bMode" value="replace">덮어쓰기</label></div><p id="bMsg" class="small"></p></div>' +
      '<div class="card"><h2 style="margin-top:0">AI 개인교수 연결 (선택 · 유료)</h2><p class="small">기본 학습·문제 풀이·채점·오답노트·검색 도우미·브라우저 음성은 <b>무료</b>이며 API 없이 동작합니다. 아래를 설정하면 AI 개인교수와 음성 질의응답이 Claude API를 호출하며, <b>호출마다 사용자 계정에 요금이 청구됩니다</b>. 개발 중 실제 호출 검증은 하지 않았습니다(연동 준비 완료 · 미검증).</p>' +
      '<div class="row"><label class="f">사용<select id="aProv"><option value="none">사용 안 함</option><option value="claude">Claude API 사용</option></select></label><label class="f">모델<select id="aModel"><option value="claude-opus-5-5">Claude Opus 5.5 (입력 $4 / 출력 $20 per 1M 토큰)</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5 ($2 / $10)</option><option value="claude-haiku-5-5">Claude Haiku 5.5 ($0.10 / $0.50)</option></select></label><label class="f">추론 강도<select id="aEff"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></label><label class="f" style="max-width:160px">하루 요청 한도<input type="number" id="aLim" min="1" max="1000" value="' + ai.dailyLimit + '"></label></div>' +
      '<div class="row"><label class="f">API 키<input type="password" id="aKey" autocomplete="off" placeholder="' + (ai.key || window.__sessionKey ? '•••• 설정됨 (바꾸려면 새로 입력)' : 'sk-ant-...') + '"></label></div><div class="row"><label class="chk"><input type="checkbox" id="aSave"' + (ai.saveKey ? ' checked' : '') + '>이 기기에 키 저장(체크 해제 시 이 탭을 닫으면 삭제)</label><label class="chk"><input type="checkbox" id="aFb"' + (ai.fallbacks ? ' checked' : '') + '>안전정책 거절 시 서버 측 대체 모델 사용</label></div><div class="row"><button class="btn pri" id="aApply">AI 설정 저장</button><button class="btn danger" id="aDel">키 삭제</button></div>' +
      '<p class="tiny muted">키는 브라우저에서 api.anthropic.com으로만 전송됩니다. 공용 PC에서는 키를 저장하지 마세요. 키는 백업 파일·화면 캡처·로그에 남기지 않습니다.</p><h3>사용량</h3><p class="small">오늘: 요청 ' + u.requests + '회 · 입력 ' + u.input + ' · 출력 ' + u.output + ' 토큰 · 오류 ' + u.errors + '회 · 예상 비용 $' + AI.estCost(ai.model, u.input, u.output).toFixed(4) + '<br>누적: 요청 ' + totals.r + '회 · 예상 비용 $' + AI.estCost(ai.model, totals.i, totals.o).toFixed(4) + '</p></div>' +
      '<div class="card"><h2 style="margin-top:0">초기화</h2><p class="small">모든 풀이 이력·북마크·복습 일정·설정을 지웁니다. 되돌릴 수 없으니 먼저 백업하세요.</p><button class="btn danger" id="rst">학습 기록 초기화…</button></div>' +
      '<div class="card small muted">프로그램 v' + esc(DATA.meta.version || '1.0.0') + ' · 빌드 ' + esc(DATA.meta.built || '') + ' · 콘텐츠 ' + CONTENT.length + '개 영역 · 문제 ' + QS.length + '개 (출처확인 ' + QS.filter(q => q.verification_status === '출처확인').length + ' / 자체검토 ' + QS.filter(q => q.verification_status !== '출처확인').length + ')</div>';
    $('#sTheme').value = s.theme; $('#aProv').value = ai.provider; $('#aModel').value = ai.model; $('#aEff').value = ai.effort;
    $('#sTheme').onchange = () => { s.theme = $('#sTheme').value; save(); applyTheme(); };
    $('#sShuf').onchange = () => { s.shuffleOptions = $('#sShuf').checked; save(); };
    $('#bExp').onclick = () => { const b = C.exportBackup(store.state, { questions: QS.length }); const blob = new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'abnormal-psych-backup-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); $('#bMsg').textContent = '백업 파일을 만들었습니다(풀이 ' + b.data.attempts.length + '건).'; };
    $('#bFile').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; let obj; try { obj = JSON.parse(await f.text()); } catch (err) { $('#bMsg').innerHTML = '<span class="badge bad">실패</span> JSON 형식이 아닙니다: ' + esc(err.message); return; } const mode = m.querySelector('input[name=bMode]:checked').value; const errs = C.validateBackup(obj); if (errs.length) { $('#bMsg').innerHTML = '<span class="badge bad">가져오기 거부</span> ' + errs.map(esc).join(' / '); return; } if (mode === 'replace' && !confirm('현재 기록(' + store.state.attempts.length + '건)을 백업 파일 내용으로 덮어씁니다. 계속할까요?')) return; const r = C.importBackup(store.state, obj, mode); if (!r.ok) { $('#bMsg').textContent = r.errors.join(' / '); return; } store.state = r.state; save(); $('#bMsg').innerHTML = '<span class="badge good">완료</span> ' + (mode === 'merge' ? '새 기록 ' + r.added + '건 추가, 중복 ' + r.dup + '건 건너뜀.' : '기록 ' + r.added + '건으로 교체했습니다.'); e.target.value = ''; };
    $('#aApply').onclick = () => { ai.provider = $('#aProv').value; ai.model = $('#aModel').value; ai.effort = $('#aEff').value; ai.dailyLimit = Math.max(1, Number($('#aLim').value) || 30); ai.saveKey = $('#aSave').checked; ai.fallbacks = $('#aFb').checked; const k = $('#aKey').value.trim(); if (k) { if (ai.saveKey) { ai.key = k; window.__sessionKey = null; } else { window.__sessionKey = k; delete ai.key; } } else if (!ai.saveKey && ai.key) { window.__sessionKey = ai.key; delete ai.key; } save(); toast(ai.provider === 'claude' ? (AI.isConfigured(s) ? 'AI 사용 설정됨 — 질문할 때마다 요금이 발생합니다.' : 'API 키를 입력하세요.') : 'AI 사용 안 함'); vSettings(m); };
    $('#aDel').onclick = () => { delete ai.key; window.__sessionKey = null; save(); toast('키를 삭제했습니다.'); vSettings(m); };
    $('#rst').onclick = () => { const t = prompt('정말 초기화하려면 "초기화"라고 입력하세요. (먼저 백업을 권장합니다)'); if (t !== '초기화') return toast('초기화를 취소했습니다.'); store.state = C.emptyState(); save(); toast('초기화했습니다.'); vSettings(m); };
  }

  const VIEWS = { home: vHome, more: vMore, toc: vToc, summary: vSummary, study: vStudy, quiz: vQuiz, exam: vExam, wrong: vWrong, tutor: vTutor, voice: vVoice, stats: vStats, settings: vSettings };
  shell(); window.addEventListener('hashchange', route); route();
  window.addEventListener('online', () => toast('인터넷에 다시 연결되었습니다.'));
  window.addEventListener('offline', () => toast('인터넷 연결이 끊겼습니다. 기본 학습 기능은 계속 사용할 수 있습니다.'));
})();
