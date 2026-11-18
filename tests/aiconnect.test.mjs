// 개인 API 키 연결 모듈 테스트: 요청 모양, 응답 해석, 오류 분류, JSON 추출. fetch는 모의 객체.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './load.mjs';

const { AICONNECT: A } = loadApp();
const plain = x => JSON.parse(JSON.stringify(x));
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const geminiOK = t => res(200, { candidates: [{ content: { parts: [{ text: t }] }, finishReason: 'STOP' }] });
const openaiOK = t => res(200, { choices: [{ message: { content: t }, finish_reason: 'stop' }] });

describe('요청 만들기', () => {
  test('같은 역할이 이어지면 한 차례로 합친다', () => {
    assert.deepEqual(plain(A.toTurns([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }])),
      [{ role: 'user', content: 'a\n\nb' }, { role: 'assistant', content: 'c' }]);
    assert.deepEqual(plain(A.toTurns('질문')), [{ role: 'user', content: '질문' }]);
  });
  test('Gemini: 키는 헤더로, 역할은 user/model, JSON 모드', () => {
    const { url, init } = A.buildRequest('gemini', 'gemini-2.5-flash', 'K', [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }], { json: true });
    assert.match(url, /models\/gemini-2\.5-flash:generateContent$/);
    assert.ok(!url.includes('K'), '키가 주소에 들어가면 안 된다');
    assert.equal(init.headers['x-goog-api-key'], 'K');
    const b = JSON.parse(init.body);
    assert.deepEqual(b.contents.map(c => c.role), ['user', 'model']);
    assert.equal(b.generationConfig.responseMimeType, 'application/json');
  });
  test('OpenAI: Bearer 헤더, messages, JSON 모드', () => {
    const { url, init } = A.buildRequest('openai', 'gpt-4o-mini', 'K', [{ role: 'user', content: 'q' }], { json: true });
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer K');
    const b = JSON.parse(init.body);
    assert.equal(b.model, 'gpt-4o-mini'); assert.equal(b.messages[0].content, 'q');
    assert.equal(b.response_format.type, 'json_object');
  });
  test('알 수 없는 제공자는 거부', () => assert.throws(() => A.buildRequest('x', 'm', 'k', []), e => e.code === 'invalid_request'));
});

describe('응답과 오류', () => {
  test('응답 텍스트와 잘림 표시', () => {
    assert.deepEqual(plain(A.parseResponse('gemini', { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] }, finishReason: 'MAX_TOKENS' }] })), { text: 'ab', truncated: true });
    assert.deepEqual(plain(A.parseResponse('openai', { choices: [{ message: { content: 'x' }, finish_reason: 'stop' }] })), { text: 'x', truncated: false });
    assert.throws(() => A.parseResponse('gemini', { candidates: [{ finishReason: 'SAFETY' }] }), e => e.code === 'refused');
  });
  test('HTTP 상태 → 앱 오류 코드', () => {
    assert.equal(A.errorFrom(401, {}).code, 'bad_key');
    assert.equal(A.errorFrom(400, { error: { message: 'API key not valid' } }).code, 'bad_key');
    assert.equal(A.errorFrom(404, {}).code, 'bad_model');
    assert.equal(A.errorFrom(429, {}).code, 'rate_limited');
    assert.equal(A.errorFrom(500, null).code, 'upstream_error');
  });
  test('JSON 추출: 그대로, 코드 블록, 앞뒤 설명 섞임', () => {
    assert.deepEqual(plain(A.extractJSON('{"a":1}')), { a: 1 });
    assert.deepEqual(plain(A.extractJSON('결과:\n```json\n{"a":2}\n```')), { a: 2 });
    assert.deepEqual(plain(A.extractJSON('점수는 {"a":3} 입니다')), { a: 3 });
    assert.throws(() => A.extractJSON('없음'), e => e.code === 'invalid_json');
  });
});

describe('어댑터', () => {
  test('텍스트 호출, onText 콜백, 기본 모델', async () => {
    const calls = []; const f = async (u, i) => { calls.push([u, i]); return geminiOK('안녕'); };
    const ad = A.makeAdapter({ provider: 'gemini', key: 'K', fetchImpl: f });
    let seen = ''; const r = await ad('q', { onText: e => { seen = e.text; } });
    assert.equal(r.text, '안녕'); assert.equal(seen, '안녕');
    assert.match(calls[0][0], /gemini-2\.5-flash/);
  });
  test('json 호출은 객체를 돌려준다', async () => {
    const ad = A.makeAdapter({ provider: 'openai', key: 'K', model: 'gpt-x', fetchImpl: async () => openaiOK('```json\n{"validity":4}\n```') });
    assert.deepEqual(plain(await ad.json('q')), { validity: 4 });
  });
  test('네트워크 실패, 중지, HTTP 오류', async () => {
    await assert.rejects(A.makeAdapter({ provider: 'gemini', key: 'K', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } })('q'), e => e.code === 'network');
    await assert.rejects(A.makeAdapter({ provider: 'gemini', key: 'K', fetchImpl: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; } })('q'), e => e.code === 'cancelled');
    await assert.rejects(A.makeAdapter({ provider: 'openai', key: 'bad', fetchImpl: async () => res(401, { error: { message: 'Incorrect API key' } }) })('q'), e => e.code === 'bad_key');
  });
});
