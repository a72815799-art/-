/* AI 개인교수 모듈 (유료·선택 기능)
 * - 사용자가 직접 API 키를 입력하고 '사용'으로 설정하기 전에는 어떤 외부 호출도 하지 않는다.
 * - 정답 판정은 문제은행 데이터만 사용한다. AI 응답은 정답을 바꾸지 않는다.
 */
(function (G) {
  'use strict';
  const PRICES = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.10, 0.50] }; // USD / 1M tokens (입력, 출력), 2026-11 기준 공개 단가
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';

  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function usageToday(state) { const u = state.usage.ai[today()] || { requests: 0, input: 0, output: 0, errors: 0 }; return u; }
  function estCost(model, inp, out) { const p = PRICES[model] || PRICES['claude-opus-5-5']; return (inp * p[0] + out * p[1]) / 1e6; }
  function isConfigured(settings) { return settings.ai.provider === 'claude' && !!(settings.ai.key || G.__sessionKey); }
  function getKey(settings) { return settings.ai.key || G.__sessionKey || ''; }

  const SYSTEM = [
    '당신은 권석만 『현대 이상심리학』으로 기말고사(오픈북 객관식, 상담학 대학원)를 준비하는 학습자를 돕는 이상심리학 개인교수입니다.',
    '시험 범위: 불안장애, 강박 및 관련 장애, 외상 및 스트레스 관련 장애, 성격장애.',
    '규칙:',
    '1. 아래 <학습자료>로 제공된 프로그램 내 검증 자료를 우선 근거로 사용하고, 사용한 자료의 단원명을 답변 끝에 "근거:"로 밝히세요.',
    '2. 교재 원문은 제공되지 않았습니다. 교재에 그렇게 쓰여 있다고 단정하지 말고, 교재 확인이 필요한 부분은 그렇다고 말하세요.',
    '3. 근거가 부족하거나 학계 견해가 갈리면 불확실하다고 분명히 말하세요. 지어내지 마세요.',
    '4. 문제의 정답은 <현재문제>의 정답 데이터가 기준입니다. 정답이 틀렸다고 생각되면 정답을 바꾸지 말고 "정답 데이터 재검토 필요"라고 표시하고 이유를 설명하세요.',
    '5. 학습자가 아직 답을 제출하지 않은 문제라면 정답을 알려주지 말고 생각을 돕는 힌트만 주세요.',
    '6. 쉬운 설명에서 시작하고, 학습자가 "더 자세히", "심화" 등을 요청하면 대학원 수준으로 확장하세요. 음성으로 들을 수 있도록 표와 기호는 최소화하세요.',
    '7. 교육용입니다. 실제 개인의 진단이나 치료 조언은 하지 말고 전문가 상담을 권하세요.'
  ].join('\n');

  function buildContext(ctx) {
    const parts = [];
    if (ctx.question) {
      const q = ctx.question, v = ctx.view;
      const lines = ['<현재문제 id="' + q.id + '" 난이도="' + q.level + '" 제출여부="' + (ctx.submitted ? '제출함' : '미제출') + '">'];
      if (q.case) lines.push('사례: ' + q.case);
      lines.push('질문: ' + q.stem);
      (v ? v.order : q.options.map(o => o.key)).forEach((k, i) => { const o = q.options.find(x => x.key === k); lines.push((q.type === 'ox' ? k : (i + 1) + '번') + ': ' + o.text + (ctx.submitted ? ' [정답포함:' + (o.in_answer ? '예' : '아니오') + '] 해설: ' + o.explanation : '')); });
      if (ctx.submitted) { lines.push('정답: ' + q.answer.map(k => q.type === 'ox' ? k : (v ? v.label(k) : k) + '번').join(', ')); lines.push('전체 해설: ' + q.explanation); if (ctx.selected) lines.push('학습자 선택: ' + ctx.selected.map(k => q.type === 'ox' ? k : (v ? v.label(k) : k) + '번').join(', ')); }
      lines.push('</현재문제>'); parts.push(lines.join('\n'));
    }
    if (ctx.unit) parts.push('<현재단원>' + ctx.unit + '</현재단원>');
    if (ctx.passages && ctx.passages.length) parts.push('<학습자료>\n' + ctx.passages.map(p => '[' + p.name + ' — ' + p.secName + '] ' + p.text.slice(0, 1800)).join('\n\n') + '\n</학습자료>');
    if (ctx.weak && ctx.weak.length) parts.push('<취약개념>' + ctx.weak.slice(0, 6).map(w => w.concept + '(정답률 ' + Math.round(w.rate * 100) + '%)').join(', ') + '</취약개념>');
    return parts.join('\n\n');
  }

  // 실제 호출. fetchImpl은 테스트에서 주입 가능(실제 과금 없이 요청 형식만 검증).
  async function ask(state, history, userText, ctx, fetchImpl) {
    const s = state.settings.ai;
    if (!isConfigured(state.settings)) return { ok: false, error: 'AI가 설정되지 않았습니다. 설정 화면에서 API 키를 입력하고 사용을 켜세요.', code: 'not_configured' };
    const u = usageToday(state);
    if (u.requests >= (s.dailyLimit || 30)) return { ok: false, error: '오늘의 AI 요청 한도(' + s.dailyLimit + '회)에 도달했습니다. 설정에서 한도를 바꿀 수 있습니다.', code: 'limit' };
    const messages = history.slice(-8).concat([{ role: 'user', content: buildContext(ctx) + '\n\n질문: ' + userText }]);
    const body = { model: s.model, max_tokens: 4000, system: SYSTEM, messages, output_config: { effort: s.effort || 'medium' } };
    const headers = { 'content-type': 'application/json', 'x-api-key': getKey(state.settings), 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' };
    if (s.fallbacks && s.model !== 'claude-haiku-5-5') { headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; body.fallbacks = 'default'; }
    let res, data;
    const f = fetchImpl || G.fetch.bind(G);
    try { res = await f(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) }); }
    catch (e) { u.errors++; state.usage.ai[today()] = u; return { ok: false, error: '인터넷에 연결할 수 없습니다. 기본 학습 기능(요약·문제·검색 도우미)은 계속 사용할 수 있습니다.', code: 'network' }; }
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      u.errors++; state.usage.ai[today()] = u;
      const msg = data && data.error && data.error.message ? data.error.message : '';
      const map = { 400: '요청 형식 오류', 401: 'API 키가 올바르지 않습니다', 403: '이 키로는 권한이 없습니다', 404: '모델을 찾을 수 없습니다', 413: '요청이 너무 깁니다', 429: '사용량 한도 초과(잠시 후 다시 시도)', 500: 'AI 서버 오류', 529: 'AI 서버가 혼잡합니다' };
      return { ok: false, error: (map[res.status] || ('오류 ' + res.status)) + (msg ? ': ' + msg : ''), code: 'http_' + res.status, retryAfter: res.headers && res.headers.get ? res.headers.get('retry-after') : null };
    }
    u.requests++; u.input += (data.usage && data.usage.input_tokens) || 0; u.output += (data.usage && data.usage.output_tokens) || 0; state.usage.ai[today()] = u;
    if (data.stop_reason === 'refusal') return { ok: false, error: 'AI가 이 요청에 답하지 않았습니다(안전 정책). 질문을 바꿔 보세요.', code: 'refusal' };
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return { ok: true, text: text + (data.stop_reason === 'max_tokens' ? '\n\n(답변이 길어 중간에 끊겼습니다. "이어서"라고 물어보세요.)' : ''), usage: data.usage, model: data.model, cost: estCost(s.model, (data.usage || {}).input_tokens || 0, (data.usage || {}).output_tokens || 0) };
  }

  G.AI = { ask, buildContext, isConfigured, usageToday, estCost, PRICES, SYSTEM, today };
})(typeof globalThis !== 'undefined' ? globalThis : this);
