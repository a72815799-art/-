// 화면 시연 영상(webm, 무음) 녹화: 음성 문제풀이·연속 강의·운전 모드.
// 헤드리스 환경에는 한국어 음성 출력·마이크가 없어 TTS/STT는 모의 객체로 대체하고, 화면에 '낭독 중 문장'을 자막으로 표시한다.
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium, devices } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const out = root + '/voice-evidence'; fs.mkdirSync(out, { recursive: true });
const MOCK = () => { window.__spoken = []; class U { constructor(t) { this.text = t; } } window.SpeechSynthesisUtterance = U;
  const cap = () => { let d = document.getElementById('__cap'); if (!d && document.body) { d = document.createElement('div'); d.id = '__cap'; d.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:999;background:rgba(0,0,0,.82);color:#fff;padding:8px 10px;border-radius:8px;font-size:14px;line-height:1.4'; document.body.appendChild(d); } return d; };
  const synth = { getVoices: () => [{ name: 'Mock ko', lang: 'ko-KR' }], cancel() { this._cur = null; }, speak(u) { window.__spoken.push(u.text); this._cur = u; const c = cap(); if (c) c.textContent = '🔊 (모의 TTS 낭독) ' + u.text; setTimeout(() => { if (this._cur === u && u.onend) u.onend({}); }, Math.min(2600, 250 + u.text.length * 22)); }, pause() {}, resume() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => { const h = window.__nextHeard; const c = cap(); if (c) c.textContent = '🎤 (모의 음성인식) "' + h + '"'; this.onresult && this.onresult({ results: [[{ transcript: h, confidence: 0.9 }]] }); this.onend && this.onend(); }, 900); } abort() {} }; };
const b = await chromium.launch();
async function rec(name, ctxOpts, fn) { const ctx = await b.newContext({ ...ctxOpts, recordVideo: { dir: out + '/tmp', size: ctxOpts.viewport } }); await ctx.addInitScript(MOCK); const p = await ctx.newPage(); await p.goto('file://' + root + '/app/dist/index.html'); await p.waitForSelector('#main h1'); await fn(p); const v = p.video(); await ctx.close(); fs.renameSync(await v.path(), out + '/' + name + '.webm'); console.log('saved', name); }
const say = async (p, t) => { await p.evaluate(x => window.__nextHeard = x, t); await p.click('#vqMic'); await p.waitForTimeout(1300); };
const waitIdle = async (p, ms) => { await p.waitForTimeout(ms); };
await rec('01-voice-quiz-mobile', { ...devices['Pixel 7'] }, async p => {
  await p.evaluate(() => location.hash = '#/voice?tab=quiz'); await p.waitForSelector('#vqMic'); await p.waitForTimeout(800);
  await say(p, '강박장애 고난도 문제 하나 내줘'); await waitIdle(p, 9000);
  const labels = await p.evaluate(() => __vq.vq.q.answer.map(k => __vq.vq.view.label(k)));
  await say(p, '정답은 ' + labels.map(n => n + '번').join('과 ') + '이야'); await waitIdle(p, 4000);
  await say(p, '네'); await waitIdle(p, 5000);
  await say(p, '3번 보기는 왜 틀렸어?'); await waitIdle(p, 4000);
  await say(p, '비슷한 문제 하나 더 내줘'); await waitIdle(p, 6000);
  fs.writeFileSync(out + '/01-voice-quiz-transcript.json', JSON.stringify(await p.evaluate(() => __vq.vq.log), null, 1));
});
await rec('02-lecture-pc', { viewport: { width: 1280, height: 800 } }, async p => {
  await p.evaluate(() => location.hash = '#/voice?tab=lecture'); await p.waitForSelector('#lPlay'); await p.selectOption('#lScope', 'x:panic'); await p.waitForTimeout(500);
  await p.click('#lPlay'); await p.waitForTimeout(9000); await p.click('#lPause'); await p.waitForTimeout(1500); await p.click('#lPlay'); await p.waitForTimeout(3000); await p.click('#lNext'); await p.waitForTimeout(5000);
});
await rec('03-drive-mode-mobile', { ...devices['Pixel 7'] }, async p => {
  await p.evaluate(() => location.hash = '#/voice?tab=drive'); await p.waitForSelector('#dGo'); await p.selectOption('#dMode', 'listenquiz'); await p.waitForTimeout(500); await p.click('#dGo'); await p.waitForTimeout(16000);
});
fs.rmSync(out + '/tmp', { recursive: true, force: true }); await b.close();
