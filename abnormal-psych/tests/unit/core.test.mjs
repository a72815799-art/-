import test from 'node:test'; import assert from 'node:assert/strict';
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const Core = require('../../app/src/core.js');
const mk = (over) => Object.assign({ id: 'T-1', domain: 'anxiety', disorder: 'panic', level: 5, type: 'multi', polarity: 'correct', stem: '옳은 것을 모두 고르시오', concept: 'c1',
  options: [1,2,3,4,5].map(i => ({ key: String(i), text: 'opt' + i, is_true: i === 2 || i === 4, in_answer: i === 2 || i === 4, explanation: 'exp' + i })), answer: ['2','4'] }, over);
function mem() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; }

test('복수정답: 완전 일치만 정답', () => {
  const q = mk();
  assert.equal(Core.grade(q, ['2','4']).correct, true);
  assert.equal(Core.grade(q, ['4','2']).correct, true);
  const p = Core.grade(q, ['2']); assert.equal(p.correct, false); assert.equal(p.partial, true);
  assert.deepEqual(p.perOption.map(x => x.status), ['ok','hit','ok','miss','ok']);
  const w = Core.grade(q, ['2','4','5']); assert.equal(w.correct, false); assert.equal(w.perOption[4].status, 'wrong_pick');
  assert.equal(Core.grade(q, []).correct, false);
});
test('셔플 후에도 표시번호→원래 key 매핑으로 채점이 유지', () => {
  const q = mk();
  for (let seed = 1; seed < 200; seed++) {
    const v = Core.makeView(q, { shuffleOptions: true, rand: Core.rng(seed) });
    assert.deepEqual([...v.order].sort(), ['1','2','3','4','5']);
    const picks = [v.label('2'), v.label('4')].map(Number).map(v.keyAt);
    assert.equal(Core.grade(q, picks).correct, true);
    // 표시된 보기 텍스트는 원래 key의 텍스트와 일치
    for (let n = 1; n <= 5; n++) assert.equal(q.options.find(o => o.key === v.keyAt(n)).text, 'opt' + v.keyAt(n));
  }
});
test('풀이 이력은 덮어쓰지 않고 누적, 1-3-7-14 복습', () => {
  const s = new Core.Store(mem()); s.load(); const q = mk(); const t0 = Date.UTC(2026, 10, 1);
  s.recordAttempt(q, Core.grade(q, ['2']), { ts: t0 });
  assert.equal(s.state.srs['T-1'].due, t0 + Core.DAY);
  s.recordAttempt(q, Core.grade(q, ['2','4']), { ts: t0 + Core.DAY });
  assert.equal(s.state.srs['T-1'].stage, 1); assert.equal(s.state.srs['T-1'].due, t0 + 4 * Core.DAY);
  s.recordAttempt(q, Core.grade(q, ['2','4']), { ts: t0 + 4 * Core.DAY });
  assert.equal(s.state.srs['T-1'].due, t0 + 11 * Core.DAY);
  s.recordAttempt(q, Core.grade(q, ['2','4']), { ts: t0 + 11 * Core.DAY });
  assert.equal(s.state.srs['T-1'].due, t0 + 25 * Core.DAY);
  s.recordAttempt(q, Core.grade(q, ['2','4']), { ts: t0 + 25 * Core.DAY });
  assert.equal(s.state.srs['T-1'].done, true);
  assert.equal(s.state.attempts.length, 5); assert.equal(s.state.attempts[0].first, true); assert.equal(s.state.attempts[1].first, false);
  const wn = Core.wrongNote(s.state, { 'T-1': q }); assert.equal(wn[0].wrongs, 1); assert.deepEqual(wn[0].firstSelected, ['2']);
  // 새로고침(재로드) 후 복원
  const s2 = new Core.Store(s.storage); s2.load(); assert.equal(s2.state.attempts.length, 5);
});
test('저장 실패 처리', () => {
  const st = { getItem: () => null, setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } };
  const s = new Core.Store(st); s.load(); assert.equal(s.save(), false); assert.match(s.lastError, /QuotaExceededError/);
});
test('백업: 키 제외, 검증, 병합 중복 제거, 교체', () => {
  const s = new Core.Store(mem()); s.load(); const q = mk();
  s.state.settings.ai.key = 'sk-secret';
  s.recordAttempt(q, Core.grade(q, ['1']), { ts: 1000 });
  const b = Core.exportBackup(s.state); assert.equal(JSON.stringify(b).includes('sk-secret'), false);
  assert.ok(Core.validateBackup({}).length > 0);
  assert.ok(Core.validateBackup({ app: 'x', schema_version: 1, data: {} }).length > 0);
  assert.ok(Core.validateBackup({ app: 'abnormal-psych-final', schema_version: 99, data: { attempts: [] } }).some(e => /새로운 버전/.test(e)));
  const r = Core.importBackup(s.state, b, 'merge'); assert.equal(r.ok, true); assert.equal(r.dup, 1); assert.equal(r.added, 0); assert.equal(r.state.attempts.length, 1);
  const s3 = new Core.Store(mem()); s3.load(); s3.recordAttempt(q, Core.grade(q, ['2','4']), { ts: 5000 });
  const r2 = Core.importBackup(s3.state, b, 'merge'); assert.equal(r2.state.attempts.length, 2); assert.equal(r2.added, 1);
  const r3 = Core.importBackup(s3.state, b, 'replace'); assert.equal(r3.state.attempts.length, 1);
});
test('v1 데이터 마이그레이션', () => {
  const m = Core.migrate({ schema_version: 1, attempts: [{ qid: 'a', ts: 1, selected: ['1'], correct: true }] });
  assert.equal(m.schema_version, Core.SCHEMA_VERSION); assert.equal(m.attempts[0].mode, 'practice'); assert.ok(Array.isArray(m.voiceLog));
});
test('음성 명령 해석', () => {
  const P = Core.parseCommand;
  assert.deepEqual(P('정답은 2번과 4번이야').numbers, [2, 4]);
  assert.deepEqual(P('정답은 1번과 3번').numbers, [1, 3]);
  assert.deepEqual(P('정답은 이번이랑 사번').numbers, [2, 4]);
  assert.deepEqual(P('3번이야').numbers, [3]);
  assert.equal(P('3번 보기는 왜 틀렸어?').type, 'why_option'); assert.equal(P('3번 보기는 왜 틀렸어?').number, 3);
  assert.equal(P('강박장애 고난도 문제 하나 내줘').type, 'quiz'); assert.equal(P('강박장애 고난도 문제 하나 내줘').level, 5); assert.equal(P('강박장애 고난도 문제 하나 내줘').domain, 'ocd');
  assert.equal(P('강박성 성격장애 문제 내줘').domain, 'personality');
  assert.equal(P('비슷한 문제 하나 더 내줘').type, 'similar');
  assert.equal(P('강의 시작').type, 'lecture_start');
  for (const [s, t] of [['일시정지', 'pause'], ['이어서', 'resume'], ['다시 읽어줘', 'repeat'], ['보기만 읽어줘', 'read_options'], ['해설해 줘', 'explain'], ['더 자세히', 'more'], ['관련 이론 설명해 줘', 'theory'], ['다음 문제', 'next'], ['오답 복습 시작', 'wrong_review']]) assert.equal(P(s).type, t, s);
  assert.equal(P('네', { awaitingConfirm: true }).type, 'confirm_yes');
  assert.equal(P('아니요', { awaitingConfirm: true }).type, 'confirm_no');
  assert.deepEqual(P('정답은 오', { qType: 'ox' }).keys, ['O']);
  assert.deepEqual(P('엑스', { qType: 'ox' }).keys, ['X']);
  assert.equal(P('강박장애와 강박성 성격장애의 차이를 설명해 줘').type, 'ask');
});
test('문장 분할과 재생목록', () => {
  const s = Core.splitSentences('공황장애는 반복된다. 둘째 문장입니다. 셋째?');
  assert.equal(s.length, 3);
});
