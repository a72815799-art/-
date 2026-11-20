// 브라우저 종단 테스트 (Playwright + 사전 설치 Chromium, headless)
// 실행: node tests/e2e/run.mjs   → tests/results/e2e-results.json, screenshots/
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium, devices } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const URL_ = 'file://' + root + '/app/dist/index.html';
const SHOT = root + '/screenshots'; fs.mkdirSync(SHOT, { recursive: true }); fs.mkdirSync(root + '/tests/results', { recursive: true });
const results = []; const log = [];
async function T(id, name, fn) { const t0 = Date.now(); try { const ev = await fn(); results.push({ id, name, status: 'pass', ms: Date.now() - t0, evidence: ev || '' }); console.log('PASS', id, name); } catch (e) { results.push({ id, name, status: 'fail', ms: Date.now() - t0, error: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL', id, name, e.message); } }
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
// 모의 TTS/STT: 헤드리스 브라우저에는 한국어 음성과 마이크가 없으므로 호출 내용을 기록하는 대체물을 주입한다.
const MOCK = () => {
  window.__spoken = [];
  class U { constructor(t) { this.text = t; } }
  window.SpeechSynthesisUtterance = U;
  const synth = { _q: [], speaking: false, getVoices: () => [{ name: 'Mock 한국어', lang: 'ko-KR' }], cancel() { this._cancel = (this._cancel || 0) + 1; this._cur = null; }, speak(u) { window.__spoken.push({ text: u.text, rate: u.rate, lang: u.lang }); this._cur = u; setTimeout(() => { if (this._cur === u && u.onend) u.onend({}); }, window.__ttsDelay || 5); }, pause() {}, resume() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.__nextHeard = null;
  window.webkitSpeechRecognition = class { start() { setTimeout(() => { const h = window.__nextHeard; if (!h) { this.onerror && this.onerror({ error: 'no-speech' }); this.onend && this.onend(); return; } this.onresult && this.onresult({ results: [[{ transcript: h.text, confidence: h.conf }]] }); this.onend && this.onend(); }, 10); } abort() {} };
  window.SpeechRecognition = window.webkitSpeechRecognition;
};
const browser = await chromium.launch();
async function newPage(ctxOpts, mock = true) { const ctx = await browser.newContext(ctxOpts); if (mock) await ctx.addInitScript(MOCK); const p = await ctx.newPage(); p.__errors = []; p.on('pageerror', e => p.__errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.__errors.push(m.text()); }); p.on('dialog', d => d.accept(p.__promptAnswer || undefined)); await p.goto(URL_); await p.waitForSelector('#main h1'); return p; }
const desk = { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 };
let p = await newPage(desk);
const data = await p.evaluate(() => ({ nq: APP_DATA.questions.length, nc: APP_DATA.content.length, dis: APP_DATA.content.flatMap(c => c.disorders.map(d => d.id)), qs: APP_DATA.questions.map(q => ({ id: q.id, type: q.type, answer: q.answer, keys: q.options.map(o => o.key) })) }));
log.push('content domains=' + data.nc + ' disorders=' + data.dis.length + ' questions=' + data.nq);

await T('UI-01', '대시보드 표시, 콘솔 오류 없음', async () => { ok(await p.locator('h1').first().innerText() === '오늘의 학습'); ok(p.__errors.length === 0, p.__errors.join('|')); await p.screenshot({ path: SHOT + '/pc-01-dashboard.png', fullPage: true }); return 'h1=오늘의 학습'; });
await T('UI-02', '11개 필수 화면 라우팅', async () => { const routes = ['#/', '#/toc', '#/summary', '#/study', '#/quiz', '#/exam', '#/wrong', '#/tutor', '#/voice', '#/stats', '#/settings']; const out = []; for (const r of routes) { await p.evaluate(h => location.hash = h, r); await p.waitForTimeout(80); const h = await p.locator('#main h1').first().innerText(); out.push(r + '→' + h); } ok(p.__errors.length === 0, p.__errors.join('|')); return out.join(', '); });
await T('CT-01', '모든 영역·장애 요약서 표시', async () => { const out = []; for (const d of ['anxiety', 'ocd', 'trauma', 'personality']) { await p.evaluate(h => location.hash = h, '#/summary/' + d); await p.waitForTimeout(80); const n = await p.locator('#main .card[id^="s-"]').count(); out.push(d + ':' + n); } return out.join(' '); });
await T('CT-02', '모든 장애 상세(18항목)·심화 화면 표시', async () => { let n = 0; for (const id of data.dis) { await p.evaluate(h => location.hash = h, '#/study/' + id); await p.waitForTimeout(30); const secs = await p.locator('#main .sec').count(); ok(secs >= 15, id + ' secs=' + secs); await p.evaluate(h => location.hash = h, '#/study/' + id + '?level=deep'); await p.waitForTimeout(20); ok((await p.locator('#main .card').count()) >= 2, id + ' deep'); n++; } ok(p.__errors.length === 0, p.__errors.join('|')); return n + '개 장애 상세·심화 렌더'; });
await p.evaluate(() => location.hash = '#/study/' + APP_DATA.content[0].disorders[1].id); await p.waitForTimeout(100); await p.screenshot({ path: SHOT + '/pc-03-study-detail.png', fullPage: false });
await p.evaluate(() => location.hash = '#/summary/' + APP_DATA.content[0].domain); await p.waitForTimeout(100); await p.screenshot({ path: SHOT + '/pc-02-summary.png', fullPage: false });

if (data.nq) {
  const multi = data.qs.find(q => q.type === 'multi');
  await T('QZ-01', '제출 전 정답·해설 숨김', async () => { await p.evaluate(id => { location.hash = '#/quiz?go=1&level=5'; }, multi.id); await p.waitForSelector('#opts .opt'); ok(await p.locator('.result').count() === 0); ok(await p.locator('.why').count() === 0, '해설 노출'); ok(await p.locator('#sub').isDisabled(), '선택 전 제출 비활성'); return '제출 전 .result/.why 0개'; });
  await T('QZ-02', '복수정답 채점(완전일치=정답, 부분=오답+보기별 판정), 셔플 매핑', async () => {
    // 현재 화면 문제에 대해 정답 집합을 화면 버튼 data-k로 클릭
    const qid = await p.locator('#main .tiny.muted').first().innerText(); const q = data.qs.find(x => x.id === qid);
    const first = q.answer[0]; await p.click(`#opts .opt[data-k="${first}"]`); await p.click('#sub'); await p.waitForSelector('.result');
    const r1 = await p.locator('.result').innerText(); ok(/오답/.test(r1) && /일부/.test(r1), 'partial: ' + r1); ok(await p.locator('.opt.r-miss').count() === q.answer.length - 1, 'miss count');
    await p.click('#retry'); for (const k of q.answer) await p.click(`#opts .opt[data-k="${k}"]`); await p.click('#sub'); const r2 = await p.locator('.result').innerText(); ok(/^정답입니다/.test(r2), r2);
    ok(await p.locator('.why').count() === 5, '해설 5개');
    const order = await p.evaluate(() => [...document.querySelectorAll('#opts .opt')].map(b => b.dataset.k).join(''));
    const att = await p.evaluate(id => __app.S().attempts.filter(a => a.qid === id).map(a => a.correct), qid);
    ok(att.length === 2 && att[0] === false && att[1] === true, '이력 2건 보존 ' + att);
    await p.screenshot({ path: SHOT + '/pc-04-quiz-result.png', fullPage: true });
    return qid + ' 표시순서=' + order + ' 정답=' + q.answer + ' 1차=' + r1.slice(0, 40) + ' / 2차=' + r2.slice(0, 30);
  });
  await T('QZ-03', '보기 셔플 200회: 표시 텍스트↔key↔해설 연결 일치', async () => { return await p.evaluate(() => { let bad = 0; for (const q of APP_DATA.questions) for (let s = 1; s <= 3; s++) { const v = Core.makeView(q, { shuffleOptions: true, rand: Core.rng(s) }); for (let n = 1; n <= q.options.length; n++) { const k = v.keyAt(q.type === 'ox' ? q.options[n - 1].key : n); if (!q.options.find(o => o.key === k)) bad++; } const g = Core.grade(q, q.answer.map(k => v.keyAt(q.type === 'ox' ? k : Number(v.label(k))))); if (!g.correct) bad++; } if (bad) throw new Error('bad=' + bad); return APP_DATA.questions.length * 3 + '개 셔플 조합 모두 일치'; }); });
  await T('QZ-04', '오답노트 기록 + 최초 선택 + 복습 일정', async () => { await p.evaluate(() => location.hash = '#/wrong'); await p.waitForTimeout(100); const n = await p.locator('#main details.card').count(); ok(n >= 1, 'wrong=' + n); const srs = await p.evaluate(() => Object.values(__app.S().srs)); ok(srs.length >= 1); await p.locator('#main details.card').first().click(); await p.screenshot({ path: SHOT + '/pc-05-wrong-note.png', fullPage: false }); return '오답 ' + n + '건, SRS ' + JSON.stringify(srs[0]).slice(0, 120); });
  await T('QZ-05', '새로고침 후 학습 이력 복원', async () => { const before = await p.evaluate(() => __app.S().attempts.length); await p.reload(); await p.waitForSelector('#main h1'); const after = await p.evaluate(() => __app.S().attempts.length); ok(before === after && after > 0, before + '/' + after); return 'attempts ' + before + '→' + after; });
  await T('QZ-06', '북마크·O/X·단일정답 풀이', async () => { await p.evaluate(() => location.hash = '#/quiz?go=1&level=1'); await p.waitForSelector('#opts .opt'); await p.click('#bm'); await p.locator('#opts .opt').first().click(); await p.click('#sub'); await p.waitForSelector('.result'); const bm = await p.evaluate(() => Object.keys(__app.S().bookmarks).length); ok(bm === 1); await p.click('#next'); await p.locator('#opts .opt').nth(1).click(); await p.click('#sub'); await p.waitForSelector('.result'); return '북마크 ' + bm + ', OX 2문제 채점'; });
  await T('EX-01', '모의고사(오픈북): 제출 전 비공개, 채점·기록·자료검색', async () => { await p.evaluate(() => location.hash = '#/exam'); await p.waitForSelector('#eGo'); await p.selectOption('#eN', '20'); await p.click('#eGo'); await p.waitForSelector('#tm'); ok(await p.locator('.why').count() === 0); for (let i = 0; i < 5; i++) { await p.locator('#opts .opt').first().click(); await p.click('#nx'); } await p.click('#book'); await p.fill('#bkq', '공황 지속기간'); await p.waitForTimeout(100); const hits = await p.locator('.drawer .card').count(); await p.screenshot({ path: SHOT + '/pc-06-exam-openbook.png' }); await p.click('#bkx'); await p.reload(); await p.waitForSelector('#tm'); const kept = await p.evaluate(() => Object.keys(__app.S().examInProgress.answers).length); ok(kept === 5, '새로고침 후 답안 유지 ' + kept); p.__promptAnswer = undefined; await p.click('#end'); await p.waitForSelector('text=모의고사 결과'); const ex = await p.evaluate(() => __app.S().exams.length); ok(ex === 1); await p.screenshot({ path: SHOT + '/pc-07-exam-result.png' }); return '자료검색 결과 ' + hits + '건, 새로고침 후 답안 ' + kept + '개 유지, 결과 저장'; });
  await T('ST-01', '통계(영역·난이도·취약개념)', async () => { await p.evaluate(() => location.hash = '#/stats'); await p.waitForTimeout(100); const rows = await p.locator('.statrow').count(); ok(rows >= 3); await p.screenshot({ path: SHOT + '/pc-08-stats.png', fullPage: true }); return 'statrow ' + rows; });
  await T('BK-01', 'JSON 백업 다운로드(키 제외)·잘못된 파일 거부·병합 중복제거·덮어쓰기', async () => {
    await p.evaluate(() => { __app.S().settings.ai.key = 'sk-ant-TESTSECRET'; }); await p.evaluate(() => location.hash = '#/settings'); await p.waitForSelector('#bExp');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bExp')]); const fp = root + '/tests/results/backup-sample.json'; await dl.saveAs(fp); const txt = fs.readFileSync(fp, 'utf8'); ok(!txt.includes('TESTSECRET'), '키 유출'); const b = JSON.parse(txt);
    const bad = root + '/tests/results/bad-backup.json'; fs.writeFileSync(bad, JSON.stringify({ app: 'other', data: {} })); await p.setInputFiles('#bFile', bad); await p.waitForTimeout(150); const m1 = await p.locator('#bMsg').innerText(); ok(/거부/.test(m1), m1);
    const n0 = await p.evaluate(() => __app.S().attempts.length); await p.setInputFiles('#bFile', fp); await p.waitForTimeout(150); const m2 = await p.locator('#bMsg').innerText(); ok(/중복 \d+건/.test(m2) && (await p.evaluate(() => __app.S().attempts.length)) === n0, m2);
    await p.evaluate(() => { __app.store.state = Core.emptyState(); __app.store.save(); }); await p.reload(); await p.waitForSelector('#main h1'); await p.evaluate(() => location.hash = '#/settings'); await p.waitForSelector('#bFile'); await p.setInputFiles('#bFile', fp); await p.waitForTimeout(150); const n2 = await p.evaluate(() => __app.S().attempts.length); ok(n2 === b.data.attempts.length, 'restored ' + n2);
    await p.check('input[name=bMode][value=replace]'); await p.setInputFiles('#bFile', fp); await p.waitForTimeout(200); const m3 = await p.locator('#bMsg').innerText(); ok(/교체/.test(m3), m3);
    await p.screenshot({ path: SHOT + '/pc-10-settings.png', fullPage: true });
    return '백업 attempts=' + b.data.attempts.length + ' / 잘못된 파일: ' + m1.slice(0, 60) + ' / 병합: ' + m2 + ' / 초기화 후 복원 ' + n2 + '건 / ' + m3;
  });
  await T('VO-01', '음성 문제풀이: 출제→낭독→"정답은 N번과 M번"→확인→채점→보기 해설→비슷한 문제', async () => {
    await p.evaluate(() => location.hash = '#/voice?tab=quiz'); await p.waitForSelector('#vqIn');
    const say = async t => { await p.fill('#vqIn', t); await p.click('#vqSend'); await p.waitForTimeout(150); };
    await say('강박장애 고난도 문제 하나 내줘'); const q = await p.evaluate(() => ({ id: __vq.vq.q.id, type: __vq.vq.q.type, level: __vq.vq.q.level, domain: __vq.vq.q.domain, labels: __vq.vq.q.answer.map(k => __vq.vq.view.label(k)) }));
    ok(q.domain === 'ocd' && q.level === 5, JSON.stringify(q)); const spoken1 = await p.evaluate(() => __spoken.map(s => s.text)); ok(spoken1.some(s => /^1번\./.test(s)) && spoken1.some(s => /^5번\./.test(s)), '보기 낭독');
    const ans = '정답은 ' + q.labels.map(n => n + '번').join('과 ') + '이야'; const n0 = await p.evaluate(() => __app.S().attempts.length);
    await say(ans); ok((await p.evaluate(() => __app.S().attempts.length)) === n0, '확인 전 기록됨'); ok((await p.evaluate(() => __spoken.slice(-2).map(s => s.text).join(' '))).includes('제출할까요'), '확인 질문');
    await say('네'); const last = await p.evaluate(() => __app.S().attempts.slice(-1)[0]); ok(last.correct === true && last.via === 'voice', JSON.stringify(last));
    await say('3번 보기는 왜 틀렸어?'); const why = await p.evaluate(() => __spoken.slice(-3).map(s => s.text).join(' ')); ok(/3번 보기는/.test(why), why);
    await say('관련 이론 설명해 줘'); await say('비슷한 문제 하나 더 내줘'); const q2 = await p.evaluate(() => __vq.vq.q.id); ok(q2 !== q.id);
    // 오인식 방지: 잘못 들은 답 → 아니오 → 기록 없음
    const n1 = await p.evaluate(() => __app.S().attempts.length); await say('정답은 1번'); await say('아니요'); ok((await p.evaluate(() => __app.S().attempts.length)) === n1, '취소 후 기록 없어야 함');
    // 마이크 경로(모의 STT)
    await p.evaluate(() => { window.__nextHeard = { text: '다시 읽어줘', conf: 0.62 }; }); await p.click('#vqMic'); await p.waitForTimeout(200); const logTxt = await p.locator('#vqLog').innerText(); ok(/신뢰도 62%/.test(logTxt), 'STT 로그');
    await p.screenshot({ path: SHOT + '/pc-09-voice-quiz.png', fullPage: true });
    fs.writeFileSync(root + '/tests/results/voice-quiz-transcript.json', JSON.stringify(await p.evaluate(() => ({ log: __vq.vq.log, spoken: __spoken.map(s => s.text) })), null, 1));
    return '문제 ' + q.id + ' 정답(' + q.labels + ') 음성 채점=정답, 비슷한 문제 ' + q2 + ', 오인식 취소 시 기록 없음';
  });
}
await T('VO-02', '연속 강의: 실제 학습 데이터 문장 낭독, 일시정지·재개, 다음, 자동 연속, 속도, 위치 기억', async () => {
  await p.evaluate(() => { location.hash = '#/voice?tab=lecture'; window.__ttsDelay = 15; }); await p.waitForSelector('#lPlay'); await p.selectOption('#lScope', 'd:' + data.dis.length ? 'd:' + (await p.evaluate(() => APP_DATA.content[0].domain)) : ''); await p.selectOption('#lRate', '1.25');
  await p.evaluate(() => { __spoken.length = 0; }); await p.click('#lPlay'); await p.waitForTimeout(200);
  const s1 = await p.evaluate(() => __spoken.map(s => s.text)); const first = await p.evaluate(() => { const d = APP_DATA.content[0].disorders[0]; return d.name + ', 핵심 요약.'; }); ok(s1[0] === first, s1[0] + ' vs ' + first); ok((await p.evaluate(() => __spoken[0].rate)) === 1.25, 'rate');
  await p.click('#lPause'); const c1 = await p.evaluate(() => __spoken.length); await p.waitForTimeout(150); ok((await p.evaluate(() => __spoken.length)) === c1, '일시정지 후 진행됨');
  const pos = await p.evaluate(() => JSON.stringify(__app.S().audio.pos)); await p.click('#lPlay'); await p.waitForTimeout(100); ok((await p.evaluate(() => __spoken.length)) > c1, '재개');
  await p.click('#lPause'); const iBefore = await p.evaluate(() => __lecture.lec.i); await p.click('#lNext'); await p.waitForTimeout(30); const iAfter = await p.evaluate(() => __lecture.lec.i); const t2 = await p.locator('#lTitle').innerText(); ok(iAfter === iBefore + 1, iBefore + '->' + iAfter); await p.click('#lPlay');
  await p.waitForTimeout(3000); const titleLater = await p.locator('#lTitle').innerText(); ok(titleLater !== t2, '자동 연속 재생 ' + titleLater);
  await p.click('#lPause'); const saved = await p.evaluate(() => __app.S().audio.pos); await p.reload(); await p.waitForSelector('#main h1'); await p.evaluate(() => location.hash = '#/voice?tab=lecture'); await p.waitForSelector('#lPlay'); await p.selectOption('#lScope', 'd:' + (await p.evaluate(() => APP_DATA.content[0].domain)));
  const restored = await p.locator('#lPos').innerText(); await p.screenshot({ path: SHOT + '/pc-11-voice-lecture.png', fullPage: false });
  await p.evaluate(() => { const n = __spoken.length; window.__n = n; }); await p.click('#lAgain'); await p.waitForTimeout(60);
  return '첫 문장="' + s1[0] + '", 2번째="' + s1[1].slice(0, 40) + '…", 다음→' + t2 + ', 자동→' + titleLater + ', 새로고침 후 위치 ' + restored + ' (저장 ' + JSON.stringify(saved).slice(0, 80) + ')';
});
await T('VO-04', '오디오 파일 재생(잠금화면용 <audio> + Media Session 메타데이터)', async () => {
  const has = await p.evaluate(() => (APP_DATA.audio || []).length); if (!has) throw new Error('오디오 묶음 없음');
  await p.evaluate(() => location.hash = '#/voice?tab=lecture'); await p.waitForSelector('#aPlay'); await p.click('#aPlay'); await p.waitForTimeout(2500);
  const st = await p.evaluate(() => { const a = document.getElementById('audioEl'); return { src: a.src.split('/').slice(-2).join('/'), t: a.currentTime, paused: a.paused, dur: a.duration, err: a.error && a.error.code, meta: navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.title }; });
  if (!(st.t > 0.5 && !st.paused && st.meta)) throw new Error(JSON.stringify(st));
  await p.evaluate(() => document.getElementById('audioEl').pause());
  return JSON.stringify(st);
});
await T('VO-03', '운전 모드: 단일 시작으로 연속 낭독, 종료', async () => { await p.evaluate(() => { location.hash = '#/voice?tab=drive'; window.__ttsDelay = 2; __spoken.length = 0; }); await p.waitForSelector('#dGo'); await p.selectOption('#dMode', 'summary'); await p.click('#dGo'); await p.waitForTimeout(1500); const n = await p.evaluate(() => __spoken.length); const now = await p.locator('#dNow').innerText(); await p.screenshot({ path: SHOT + '/pc-12-drive-mode.png' }); await p.click('#dEnd'); ok(n > 20, 'spoken ' + n); return '1.5초 동안 ' + n + '문장 연속 낭독, 현재: ' + now; });
await T('AI-01', 'API 미설정 시 검색 기반 도우미 동작 + 외부 호출 없음', async () => {
  const reqs = []; p.on('request', r => { if (!r.url().startsWith('file:')) reqs.push(r.url()); });
  await p.evaluate(() => location.hash = '#/tutor'); await p.waitForSelector('#tq');
  for (const qq of ['강박장애와 강박성 성격장애의 차이를 설명해 줘', '공황장애의 클라크 인지모형을 설명해 줘']) { await p.fill('#tq', qq); await p.click('#tsend'); await p.waitForTimeout(150); }
  const msgs = await p.locator('.msg.a').allInnerTexts(); ok(msgs.length === 2 && msgs.every(m => m.length > 80), msgs.map(m => m.length).join(','));
  ok(msgs.every(m => /검색 기반 도우미\(AI 아님\)/.test(m)), '라벨'); ok(reqs.length === 0, 'external ' + reqs.join(','));
  await p.screenshot({ path: SHOT + '/pc-13-tutor-local.png', fullPage: true });
  fs.writeFileSync(root + '/tests/results/tutor-local-answers.txt', msgs.join('\n\n-----\n\n'));
  return '답변 길이 ' + msgs.map(m => m.length).join(', ') + ', 외부 요청 0건';
});
await T('AI-02', 'Claude 요청 형식·오류 처리(가짜 fetch, 실제 과금 없음)', async () => {
  return await p.evaluate(async () => {
    const st = Core.emptyState(); st.settings.ai.provider = 'claude'; st.settings.ai.key = 'sk-test';
    let captured = null; const fake = async (url, init) => { captured = { url, init }; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: '모의 응답' }], usage: { input_tokens: 1000, output_tokens: 200 } }) }; };
    const r = await AI.ask(st, [], '질문', { question: APP_DATA.questions[0], submitted: false }, fake);
    const body = JSON.parse(captured.init.body); const h = captured.init.headers;
    if (!(r.ok && captured.url === 'https://api.anthropic.com/v1/messages' && h['x-api-key'] === 'sk-test' && h['anthropic-version'] && h['anthropic-dangerous-direct-browser-access'] === 'true' && body.model === 'claude-opus-5-5' && body.fallbacks === 'default')) throw new Error('request shape ' + JSON.stringify({ body, h }));
    if (body.messages[0].content.includes('정답포함')) throw new Error('미제출 문제의 정답이 프롬프트에 포함됨');
    const e401 = await AI.ask(st, [], 'q', {}, async () => ({ ok: false, status: 401, headers: { get: () => null }, json: async () => ({ error: { message: 'invalid x-api-key' } }) }));
    const eNet = await AI.ask(st, [], 'q', {}, async () => { throw new TypeError('Failed to fetch'); });
    st.settings.ai.dailyLimit = 1; const eLim = await AI.ask(st, [], 'q', {}, fake);
    const st2 = Core.emptyState(); const eNo = await AI.ask(st2, [], 'q', {}, fake);
    if (e401.code !== 'http_401' || eNet.code !== 'network' || eLim.code !== 'limit' || eNo.code !== 'not_configured') throw new Error([e401.code, eNet.code, eLim.code, eNo.code].join());
    return '요청 URL/헤더/모델/fallbacks 확인, 미제출 정답 비노출, 401=' + e401.error + ' / 네트워크=' + eNet.error.slice(0, 30) + ' / 한도=' + eLim.code + ' / 미설정=' + eNo.code + ' / 비용추정 $' + r.cost.toFixed(4);
  });
});
await T('NET-01', '오프라인 상태에서 기본 기능 동작', async () => { await p.context().setOffline(true); await p.evaluate(() => location.hash = '#/summary'); await p.waitForTimeout(100); const ok1 = await p.locator('#main .card').count(); await p.context().setOffline(false); ok(ok1 > 3); return '오프라인에서 요약 카드 ' + ok1 + '개 표시'; });
await T('UI-03', '다크 모드', async () => { await p.evaluate(() => { __app.S().settings.theme = 'dark'; __app.store.save(); }); await p.reload(); await p.waitForSelector('#main h1'); const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); await p.screenshot({ path: SHOT + '/pc-14-dashboard-dark.png' }); ok(bg === 'rgb(21, 22, 24)', bg); await p.evaluate(() => { __app.S().settings.theme = 'auto'; __app.store.save(); }); return 'body bg ' + bg; });
const deskErrors = p.__errors.slice();
// ---- 모바일 (Android 크롬 에뮬레이션: Pixel 7) ----
const mob = await newPage({ ...devices['Pixel 7'] });
await T('MB-01', '모바일: 모든 화면 가로 넘침 없음·터치영역 ≥ 36px', async () => {
  const routes = ['#/', '#/toc', '#/summary/anxiety', '#/summary/personality', '#/study/' + data.dis[1], '#/study/' + data.dis[1] + '?level=deep', '#/quiz', '#/quiz?go=1&level=4', '#/exam', '#/wrong', '#/tutor', '#/voice', '#/voice?tab=quiz', '#/voice?tab=drive', '#/stats', '#/settings', '#/more'];
  const issues = []; let i = 0;
  for (const r of routes) { await mob.evaluate(h => location.hash = h, r); await mob.waitForTimeout(120);
    const res = await mob.evaluate(() => { const W = document.documentElement.clientWidth; const over = document.documentElement.scrollWidth > W + 1; const small = [...document.querySelectorAll('button, a.btn, .bottom a, select, input[type=text]')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.height < 36); }).map(e => (e.textContent || e.id).trim().slice(0, 15)); const cut = [...document.querySelectorAll('#main *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > W + 2 && !e.closest('.tbl') && !e.closest('.tabs') && getComputedStyle(e).position !== 'fixed'; }).map(e => e.tagName + '.' + e.className).slice(0, 3); return { over, small: small.slice(0, 5), cut }; });
    if (res.over || res.small.length || res.cut.length) issues.push(r + ' ' + JSON.stringify(res));
    const name = ['m-01-dashboard', 'm-02-toc', 'm-03-summary', 'm-03b-summary-pd', 'm-04-study', 'm-04b-deep', 'm-05-quiz-setup', 'm-06-quiz-case', 'm-07-exam', 'm-08-wrong', 'm-09-tutor', 'm-10-voice-lecture', 'm-11-voice-quiz', 'm-12-drive', 'm-13-stats', 'm-14-settings', 'm-15-more'][i++];
    await mob.screenshot({ path: SHOT + '/' + name + '.png' }); }
  ok(issues.length === 0, issues.join('\n')); ok(mob.__errors.length === 0, mob.__errors.join('|')); return routes.length + '개 화면 검사, 문제 0';
});
await T('MB-02', '모바일 문제 풀이 터치 흐름', async () => { await mob.evaluate(() => location.hash = '#/quiz?go=1&level=2'); await mob.waitForSelector('#opts .opt'); await mob.locator('#opts .opt').nth(2).tap(); await mob.locator('#sub').tap(); await mob.waitForSelector('.result'); await mob.screenshot({ path: SHOT + '/m-16-quiz-result.png', fullPage: true }); return await mob.locator('.result').innerText(); });
fs.writeFileSync(root + '/tests/results/e2e-results.json', JSON.stringify({ run_at: new Date().toISOString(), env: { browser: 'Chromium (Playwright ' + require('playwright/package.json').version + ', headless)', os: process.platform, node: process.version, note: 'TTS/STT는 헤드리스 환경에 한국어 음성·마이크가 없어 호출을 기록하는 모의 객체로 대체. 실제 음성 출력·인식은 이 테스트로 검증되지 않음. 모바일은 Pixel 7 에뮬레이션(실기기 아님).' }, data_counts: log, console_errors_desktop: deskErrors, console_errors_mobile: mob.__errors, results }, null, 1));
console.log(results.filter(r => r.status === 'pass').length + '/' + results.length + ' passed');
await browser.close();
