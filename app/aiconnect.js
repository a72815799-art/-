/* 개인 API 키로 외부 AI(Google Gemini, OpenAI GPT)에 연결하는 모듈. window.AICONNECT
   오프라인 HTML 파일에서만 쓴다(공유 링크 페이지는 보안 정책상 외부 서버로 요청을 보낼 수 없다).
   makeAdapter()는 앱의 다른 AI 기능과 같은 모양의 함수를 돌려준다: fn(input, {onText, signal}) → {text}, fn.json(input, opts) → 객체 */
(function(){
const PROVIDERS = {
  gemini: {name:'Google Gemini', defaultModel:'gemini-2.5-flash', keyUrl:'https://aistudio.google.com/app/apikey',
    keyHelp:'Google AI Studio에서 무료로 API 키를 만들 수 있습니다. 무료 사용 한도가 있습니다.'},
  openai: {name:'OpenAI GPT', defaultModel:'gpt-4o-mini', keyUrl:'https://platform.openai.com/api-keys',
    keyHelp:'OpenAI 플랫폼에서 API 키를 만듭니다. ChatGPT Plus 구독과 별개이며 사용한 만큼 요금이 나옵니다.'},
};

/* 입력(문자열 또는 [{role, content}])을 대화 차례로. 같은 역할이 이어지면 합친다 */
function toTurns(input){
  const raw = typeof input === 'string' ? [{role:'user', content:input}] : (input || []);
  const out = [];
  for (const t of raw) {
    const role = t.role === 'assistant' ? 'assistant' : 'user';
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n\n' + t.content;
    else out.push({role, content: String(t.content)});
  }
  return out;
}

function buildRequest(provider, model, key, turns, {json = false} = {}){
  if (provider === 'gemini') {
    const body = {contents: turns.map(t => ({role: t.role === 'assistant' ? 'model' : 'user', parts: [{text: t.content}]}))};
    if (json) body.generationConfig = {responseMimeType: 'application/json'};
    return {url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      init: {method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': key}, body: JSON.stringify(body)}};
  }
  if (provider === 'openai') {
    const body = {model, messages: turns.map(t => ({role: t.role, content: t.content}))};
    if (json) body.response_format = {type: 'json_object'};
    return {url: 'https://api.openai.com/v1/chat/completions',
      init: {method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key}, body: JSON.stringify(body)}};
  }
  throw {code: 'invalid_request', message: '알 수 없는 AI 제공자'};
}

function parseResponse(provider, data){
  if (provider === 'gemini') {
    const c = data && data.candidates && data.candidates[0];
    const text = c && c.content && (c.content.parts || []).map(p => p.text || '').join('');
    if (!text) throw {code: c && c.finishReason === 'SAFETY' ? 'refused' : 'empty_completion', message: '응답이 비어 있습니다'};
    return {text, truncated: c.finishReason === 'MAX_TOKENS'};
  }
  const ch = data && data.choices && data.choices[0];
  const text = ch && ch.message && ch.message.content;
  if (!text) throw {code: ch && ch.finish_reason === 'content_filter' ? 'refused' : 'empty_completion', message: '응답이 비어 있습니다'};
  return {text, truncated: ch.finish_reason === 'length'};
}

/* HTTP 오류 → 앱 공통 오류 코드 */
function errorFrom(status, body){
  const msg = (body && (body.error && (body.error.message || body.error.status))) || '';
  if (status === 401 || status === 403 || /api key/i.test(msg)) return {code: 'bad_key', message: msg};
  if (status === 404) return {code: 'bad_model', message: msg};
  if (status === 429) return {code: 'rate_limited', message: msg};
  if (status === 400) return {code: /model/i.test(msg) ? 'bad_model' : 'invalid_request', message: msg};
  return {code: 'upstream_error', message: msg || ('HTTP ' + status)};
}

/* 답변에서 JSON 하나를 관대하게 꺼낸다: 전체 → 코드 블록 → 첫 { 부터 마지막 } */
function extractJSON(text){
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch (e) {} }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  throw {code: 'invalid_json', message: 'JSON을 찾을 수 없습니다', text: t};
}

function makeAdapter({provider, model, key, fetchImpl}){
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  const mdl = model || PROVIDERS[provider].defaultModel;
  const call = async (input, opts = {}, json = false) => {
    const {url, init} = buildRequest(provider, mdl, key, toTurns(input), {json});
    let res;
    try { res = await f(url, Object.assign({}, init, {signal: opts.signal})); }
    catch (e) { if (e && e.name === 'AbortError') throw {code: 'cancelled', message: '중지됨'}; throw {code: 'network', message: String(e && e.message || e)}; }
    let data = null; try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw errorFrom(res.status, data);
    const out = parseResponse(provider, data);
    if (opts.onText) opts.onText({text: out.text, delta: out.text});
    return out;
  };
  const fn = (input, opts) => call(input, opts, false);
  fn.json = async (input, opts) => extractJSON((await call(input, opts, true)).text);
  fn.limits = async () => ({maxPromptBytes: 262144});
  fn.provider = provider; fn.model = mdl;
  return fn;
}

window.AICONNECT = {PROVIDERS, toTurns, buildRequest, parseResponse, errorFrom, extractJSON, makeAdapter};
})();
