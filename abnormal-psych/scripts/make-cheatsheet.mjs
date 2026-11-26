// 오픈북 시험용 인쇄 요약집(A4) PDF 생성
// 사용: node scripts/make-cheatsheet.mjs <원고폴더(anxiety.json 등)> <출력.pdf> [목표쪽수=10]
// 브라우저에서 실제 높이를 재며 쪽을 나누고(영역별 색 탭·머리글·쪽번호), 목표 쪽수에 맞을 때까지 글자 크기를 줄인다.
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [srcDir, outPdf, targetArg] = process.argv.slice(2); const TARGET = Number(targetArg || 10);
const DOMS = [['anxiety', '불안장애', '#2f6f9f'], ['ocd', '강박 및 관련 장애', '#7a5aa6'], ['trauma', '외상·스트레스 관련 장애', '#b5651d'], ['personality', '성격장애', '#2e7d4f']];
const data = DOMS.map(([d]) => JSON.parse(fs.readFileSync(path.join(srcDir, d + '.json'), 'utf8')));

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
@page{size:A4;margin:0}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:"Noto Sans CJK KR","NanumGothic",sans-serif;color:#111;font-size:var(--fs);line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;padding:9mm 15mm 9mm 9mm}
.page:last-child{page-break-after:auto}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.6pt solid var(--c);padding-bottom:1.2mm;margin-bottom:2mm;height:8mm}
.hdr .t{font-weight:900;font-size:13pt;color:var(--c)}.hdr .s{font-size:7.5pt;color:#555;max-width:120mm;text-align:right;line-height:1.25}
.pno{position:absolute;bottom:4mm;left:0;right:0;text-align:center;font-size:8pt;color:#555}
.tab{position:absolute;right:0;width:10mm;height:38mm;background:var(--c);color:#fff;writing-mode:vertical-rl;font-weight:900;font-size:9.5pt;display:flex;align-items:center;justify-content:center;letter-spacing:1px;border-radius:2mm 0 0 2mm}
.cols{display:flex;gap:4mm;height:calc(297mm - 18mm - 10mm - 6mm)}
.col{flex:1;min-width:0;overflow:hidden}
.unit{border:0.8pt solid var(--c);border-radius:1.5mm;margin-bottom:1.8mm;break-inside:avoid}
.uh{background:var(--c);color:#fff;padding:0.6mm 1.8mm;display:flex;justify-content:space-between;gap:2mm;align-items:baseline}
.uh b{font-size:calc(var(--fs) + 2.2pt);font-weight:900}.uh i{font-style:normal;font-size:calc(var(--fs) - 1pt);opacity:.9}
.uh .tg{font-size:calc(var(--fs) - 0.5pt);background:#fff;color:var(--c);border-radius:1mm;padding:0 1.2mm;font-weight:700;white-space:nowrap}
.blk{display:flex;gap:1.4mm;padding:0.5mm 1.5mm;border-top:0.4pt dotted #bbb}.blk:first-of-type{border-top:0}
.bh{flex:0 0 10.5mm;font-weight:900;color:var(--c);font-size:calc(var(--fs) - 0.6pt)}
.bl{flex:1;min-width:0}.bl div{padding-left:2.2mm;text-indent:-2.2mm}.bl div:before{content:"· ";color:var(--c)}
b{font-weight:900}.bl b{background:linear-gradient(transparent 55%,#fff1a8 55%)}
.cont .uh b:after{content:" (계속)";font-size:7pt;font-weight:400}
table{border-collapse:collapse;width:100%}th,td{border:0.5pt solid #999;padding:0.6mm 1.1mm;vertical-align:top;text-align:left}th{background:#eee;font-weight:900}
.small{font-size:calc(var(--fs) - 0.4pt)}
h2{font-size:10.5pt;margin:1.8mm 0 1mm;color:#222;border-left:2.2mm solid #333;padding-left:1.5mm}
.idx{column-count:3;column-gap:4mm;font-size:8.6pt;line-height:1.45}.idx div{break-inside:avoid;display:flex;justify-content:space-between;border-bottom:0.4pt dotted #ccc}
.idx .g{font-weight:900;color:#fff;background:#555;padding:0 1mm;margin-top:1mm;border:0}
.dot{display:inline-block;width:2.4mm;height:2.4mm;border-radius:50%;margin-right:1mm;vertical-align:middle}
.legend{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm 5mm;font-size:8.6pt}
.note{background:#f4f4f4;border-radius:1.5mm;padding:2mm 3mm;font-size:8.4pt;line-height:1.45}
</style></head><body></body></html>`;

const browser = await chromium.launch(); const page = await browser.newPage();
await page.setContent(html); await page.evaluate(() => document.fonts.ready);
const result = await page.evaluate(({ DOMS, data, TARGET }) => {
  const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const color = Object.fromEntries(DOMS.map(d => [d[0], d[2]])); const dname = Object.fromEntries(DOMS.map(d => [d[0], d[1]]));
  const TABTOP = { anxiety: 22, ocd: 64, trauma: 106, personality: 148, front: 190 };
  function mkPage(dom, title, sub) {
    const p = document.createElement('div'); p.className = 'page'; p.style.setProperty('--c', dom ? color[dom] : '#333');
    p.innerHTML = `<div class="hdr"><span class="t">${esc(title)}</span><span class="s">${esc(sub || '')}</span></div><div class="tab" style="top:${TABTOP[dom || 'front']}mm">${esc(dom ? dname[dom] : '색인·총정리')}</div><div class="pno"></div>`;
    document.body.appendChild(p); return p;
  }
  function run(fs) {
    document.body.innerHTML = ''; document.body.style.setProperty('--fs', fs + 'pt');
    const pages = []; const where = {}; // 장애명 → 쪽
    // 1쪽 색인(나중에 채움), 2쪽 숫자 총정리
    const p1 = mkPage(null, '현대 이상심리학 기말 · 오픈북 요약집', '불안 · 강박 · 외상 · 성격장애 | DSM-5 기준(TR 차이 표시) | 교재 미대조 — 교재 쪽수와 함께 쓰세요'); pages.push({ el: p1, dom: null });
    const p2 = mkPage(null, '숫자·기준 한눈에 (역치·기간·연령)', '시험에서 가장 많이 찾는 숫자. 굵은 글씨 = 최소 역치'); pages.push({ el: p2, dom: null });
    const rows = data.map((d, i) => { const dom = DOMS[i][0]; return `<tr><th colspan="5" style="background:${color[dom]};color:#fff">${esc(dname[dom])}</th></tr>` + (d.numbers || []).map(n => `<tr><td style="border-left:2mm solid ${color[dom]}"><b>${esc(n.name)}</b></td><td>${md(n.criteria)}</td><td>${md(n.duration)}</td><td>${md(n.age)}</td><td>${md(n.note)}</td></tr>`).join(''); }).join('');
    p2.insertAdjacentHTML('beforeend', `<table class="small" id="numtbl"><thead><tr><th style="width:21%">장애</th><th style="width:25%">증상 수 / 역치</th><th style="width:19%">기간</th><th style="width:11%">연령</th><th>핵심 배제·특이점</th></tr></thead><tbody>${rows}</tbody></table>`);
    // 영역 본문
    data.forEach((d, di) => {
      const dom = DOMS[di][0]; let pg, cols, ci;
      const newPage = () => { const names = []; pg = mkPage(dom, dname[dom], ''); pg.insertAdjacentHTML('beforeend', '<div class="cols"><div class="col"></div><div class="col"></div></div>'); cols = [...pg.querySelectorAll('.col')]; ci = 0; pages.push({ el: pg, dom, names }); };
      const cur = () => cols[ci]; const over = () => cur().scrollHeight > cur().clientHeight + 0.5;
      const nextCol = () => { if (ci === 0) ci = 1; else newPage(); };
      newPage();
      for (const u of d.units) {
        let box = null; const head = (cont) => { box = document.createElement('div'); box.className = 'unit' + (cont ? ' cont' : ''); box.innerHTML = `<div class="uh"><b>${esc(u.name)} <i>${esc(u.en || '')}</i></b>${u.tag ? `<span class="tg">${esc(u.tag)}</span>` : ''}</div>`; cur().appendChild(box); };
        head(false); if (over()) { box.remove(); nextCol(); head(false); }
        const pIdx = pages.length; where[u.name] = where[u.name] || pIdx; pages[pages.length - 1].names.push(u.name);
        for (const b of u.blocks) {
          for (let k = 0; k < b.items.length; k++) {
            // 블록 머리 + 항목을 하나씩 넣다가 넘치면 다음 단으로
            let blk = box.querySelector('.blk:last-child'); const needNew = !blk || blk.dataset.h !== b.h;
            if (needNew) { blk = document.createElement('div'); blk.className = 'blk'; blk.dataset.h = b.h; blk.innerHTML = `<div class="bh">${esc(b.h)}</div><div class="bl"></div>`; box.appendChild(blk); }
            const it = document.createElement('div'); it.innerHTML = md(b.items[k]); blk.querySelector('.bl').appendChild(it);
            if (over()) { it.remove(); if (!blk.querySelector('.bl').children.length) blk.remove(); if (!box.querySelector('.blk')) box.remove(); nextCol(); head(true); if (!pages[pages.length - 1].names.includes(u.name)) pages[pages.length - 1].names.push(u.name); k--; continue; }
          }
        }
      }
    });
    // 마지막 쪽: 감별 + 이론가 색인
    const pl = mkPage(null, '감별진단 쌍 · 이론가 색인', '이론가는 가나다순 · 오른쪽 숫자 = 이 요약집 쪽'); pages.push({ el: pl, dom: null });
    const diffs = data.flatMap((d, i) => (d.differentials || []).map(x => ({ ...x, dom: DOMS[i][0] })));
    const ths = data.flatMap((d, i) => (d.theorists || []).map(x => ({ ...x, dom: DOMS[i][0] }))).sort((a, b) => (a.ko || a.name).localeCompare(b.ko || b.name, 'ko'));
    pl.insertAdjacentHTML('beforeend', `<h2>헷갈리는 감별쌍</h2><table class="small"><tbody>${diffs.map(x => `<tr><td style="width:30%;border-left:2mm solid ${color[x.dom]}"><b>${esc(x.a)}</b> vs <b>${esc(x.b)}</b></td><td>${md(x.point)}</td></tr>`).join('')}</tbody></table><h2>이론가 색인</h2><div class="idx small" style="font-size:calc(var(--fs) - 0.3pt);line-height:1.3">${ths.map(t => `<div style="display:block;border-bottom:0.4pt dotted #ccc"><span class="dot" style="background:${color[t.dom]}"></span><b>${esc(t.ko || t.name)}</b> ${esc(t.ko ? t.name : '')} — ${esc(t.idea)} <span style="color:#666">(${esc(t.disorder)} p.${where[t.disorder] || '·'})</span></div>`).join('')}</div>`);
    // 1쪽 색인
    const entries = Object.entries(where).sort((a, b) => a[0].localeCompare(b[0], 'ko'));
    const domOf = n => { for (let i = 0; i < data.length; i++) if (data[i].units.some(u => u.name === n)) return DOMS[i][0]; };
    const map = DOMS.map(([dom, name, c]) => { const ps = pages.map((p, i) => ({ ...p, n: i + 1 })).filter(p => p.dom === dom); return `<div><span class="dot" style="background:${c}"></span><b>${esc(name)}</b> p.${ps[0].n}–${ps[ps.length - 1].n} · 오른쪽 탭 ${['맨 위', '두 번째', '세 번째', '네 번째'][DOMS.findIndex(d => d[0] === dom)]}</div>`; }).join('');
    p1.insertAdjacentHTML('beforeend', `<h2>영역 찾기 (오른쪽 가장자리 색 탭 위치)</h2><div class="legend">${map}<div><span class="dot" style="background:#333"></span><b>숫자 총정리</b> p.2 · <b>감별·이론가</b> p.${pages.length}</div></div>
      <h2>장애·단원 색인 (가나다)</h2><div class="idx">${entries.map(([n, p]) => `<div><span><span class="dot" style="background:${color[domOf(n)]}"></span>${esc(n)}</span><b>${p}</b></div>`).join('')}</div>
      <h2>쪽별 내용</h2><div class="idx" style="font-size:8pt">${pages.map((p, i) => `<div style="display:block"><b>p.${i + 1}</b> ${esc(i === 0 ? '색인' : i === 1 ? '숫자·기준 총정리' : i === pages.length - 1 ? '감별쌍·이론가 색인' : p.names.join(', '))}</div>`).join('')}</div>
      <h2>시험장에서 쓰는 법</h2><div class="note">① 문제의 <b>장애명</b> → 이 쪽 색인에서 쪽 번호 → 해당 색 탭으로 바로 이동. ② <b>숫자</b>(몇 개 중 몇 개, 기간, 연령)를 묻는 문제 → p.2 표. ③ <b>학자 이름</b>이 나오면 → 마지막 쪽 이론가 색인. ④ "옳은/옳지 않은 것을 <b>모두</b>" → 각 장애 박스의 <b>감별·함정</b> 줄과 대조. ⑤ 본문 노란 밑줄(굵게) = 최소 역치·핵심어. ⑥ 이 요약집은 공개 전문자료로 만든 것이라 교재 표현·쪽수와 다를 수 있습니다. 교재 해당 쪽을 이 옆 여백에 적어 두세요.</div>
      <h2>교재 쪽 메모</h2><table class="small"><tr><th>불안장애</th><th>강박 및 관련</th><th>외상·스트레스</th><th>성격장애</th></tr><tr><td style="height:16mm"></td><td></td><td></td><td></td></tr></table>`);
    pages.forEach((p, i) => { p.el.querySelector('.pno').textContent = (i + 1) + ' / ' + pages.length; if (p.dom) p.el.querySelector('.hdr .s').textContent = p.names.join(' · '); });
    const ovf = [p1, p2, pl].map(el => el.scrollHeight > el.clientHeight + 1);
    return { n: pages.length, ovf };
  }
  let fs = 8.6, r;
  for (; fs >= 6.9; fs = Math.round((fs - 0.1) * 10) / 10) { r = run(fs); if (r.n <= TARGET && !r.ovf.some(Boolean)) break; }
  return { fs, ...r };
}, { DOMS, data, TARGET });
console.log('font', result.fs, 'pt, pages', result.n, 'overflow(p1,p2,last)', result.ovf);
await page.pdf({ path: outPdf, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await page.screenshot({ path: outPdf.replace(/\.pdf$/, '-preview.png'), fullPage: false });
await browser.close();
