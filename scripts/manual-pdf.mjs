// 사용 설명서 PDF 만들기: docs/manual/manual.html → dist/MMPI-해석-수련실-사용-설명서.pdf (A4, 쪽 번호)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'MMPI-해석-수련실-사용-설명서.pdf');
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(pathToFileURL(join(root, 'docs', 'manual', 'manual.html')).href, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>', footerTemplate: '<div style="width:100%;text-align:center;font-size:8px;color:#777"><span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
await b.close(); console.log(out);
