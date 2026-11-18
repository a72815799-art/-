// 짧은 강의 영상 제작 키트: app/data-evidence.js의 VIDEO_SCRIPTS로 장면별 슬라이드(1920×1080 PNG),
// 내레이션 대본(txt), 자막(srt)을 만든다. CapCut 등 편집 프로그램에 그대로 불러올 수 있다.
//   node scripts/video-kit.mjs  →  dist/video-kit/<편>/scene-01.png …, narration.txt, captions.srt
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from '../tests/load.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'video-kit');
const { VIDEO_SCRIPTS } = loadApp();
const CPS = 5;   // 한국어 내레이션 속도(초당 글자 수) 추정
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ts = t => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
// 자막은 한 줄 40자 안팎의 문장 단위로 나눈다
const chunks = text => text.split(/(?<=[.?!])\s+/).flatMap(s => s.length <= 44 ? [s] : s.split(/(?<=,)\s+/));

const slide = (series, i, n, head, cite) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@500;700&family=Nanum+Myeongjo:wght@800&display=swap">
<style>body{margin:0;width:1920px;height:1080px;background:#F4F1EA;color:#16202B;font-family:'IBM Plex Sans KR',sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 160px;box-sizing:border-box;position:relative}
.s{position:absolute;top:80px;left:160px;font-size:30px;color:#1E5A87;font-weight:700;letter-spacing:.02em}
.h{font-family:'Nanum Myeongjo',serif;font-size:${head.length > 22 ? 84 : 104}px;line-height:1.3;font-weight:800;max-width:1500px;word-break:keep-all}
.bar{width:140px;height:10px;background:#B5372C;margin-bottom:56px}
.c{position:absolute;bottom:80px;left:160px;font-size:28px;color:#5B6672}.p{position:absolute;bottom:80px;right:160px;font-size:28px;color:#5B6672}</style></head>
<body><div class="s">${esc(series)}</div><div class="bar"></div><div class="h">${esc(head)}</div>${cite ? `<div class="c">${esc(cite)}</div>` : ''}<div class="p">${i}/${n}</div></body></html>`;

rmSync(out, { recursive: true, force: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [k, v] of VIDEO_SCRIPTS.entries()) {
  const dir = join(out, `${String(k + 1).padStart(2, '0')}`); mkdirSync(dir, { recursive: true });
  const series = v.title.replace(/\s*\(.*\)$/, '');
  let t = 0, srt = '', idx = 1, txt = `${v.title}\n\n`;
  for (const [j, [head, narr]] of v.scenes.entries()) {
    const cite = (narr.match(/\(([^()]*\d{4}[^()]*)\)\s*$/) || [])[1] || '';
    await page.setContent(slide(series, j + 1, v.scenes.length, head, cite), { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(dir, `scene-${String(j + 1).padStart(2, '0')}.png`) });
    const dur = Math.max(4, narr.length / CPS);
    txt += `[장면 ${j + 1} · 약 ${Math.round(dur)}초] 화면: ${head}\n${narr}\n\n`;
    const parts = chunks(narr); const total = parts.reduce((a, p) => a + p.length, 0);
    let s = t; for (const p of parts) { const d = dur * p.length / total; srt += `${idx++}\n${ts(s)} --> ${ts(s + d)}\n${p}\n\n`; s += d; }
    t += dur;
  }
  txt += `총 길이 약 ${Math.round(t / 60 * 10) / 10}분(초당 ${CPS}자 기준)\n`;
  writeFileSync(join(dir, 'narration.txt'), txt); writeFileSync(join(dir, 'captions.srt'), srt);
  console.log(`${v.title}: 장면 ${v.scenes.length}개, 약 ${Math.round(t)}초 → ${dir}`);
}
writeFileSync(join(out, '사용법.txt'), `CapCut으로 짧은 강의 영상 만들기

1. 새 프로젝트를 만들고 한 편의 폴더(01, 02, 03)에서 scene-01.png부터 순서대로 불러옵니다(16:9).
2. narration.txt의 [장면 n · 약 m초]에 맞춰 각 이미지의 길이를 조정합니다.
3. 내레이션: 대본을 직접 녹음하거나, CapCut의 텍스트 음성 변환(TTS)에 장면별 문단을 붙여 넣습니다.
4. 자막: CapCut의 자막 가져오기에서 captions.srt를 불러온 뒤 녹음 길이에 맞게 미세 조정합니다.
   (자막 시간은 초당 ${CPS}자 기준 추정치입니다. 자동 자막 기능을 쓰면 녹음에 맞춰 다시 만들 수 있습니다.)
5. 배경음악은 저작권이 해결된 음원만 사용하세요.

내용의 근거 문헌은 프로그램의 “연구 근거” 메뉴에서 확인할 수 있습니다.
`);
await browser.close();
