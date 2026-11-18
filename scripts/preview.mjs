// 로컬 미리보기: app/을 dist/로 복사하고, 배포 시 플랫폼이 붙여 주는 HTML 뼈대를 직접 씌운다.
//   npm run preview  →  dist/index.html을 브라우저로 연다
import { mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app'), dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });
for (const f of readdirSync(app)) if (f.endsWith('.js')) copyFileSync(join(app, f), join(dist, f));
const body = readFileSync(join(app, 'index.html'), 'utf8');
writeFileSync(join(dist, 'index.html'),
  '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' +
  body + '</body></html>');
console.log('dist/index.html 생성. 브라우저로 여세요 (AI 기능은 공유 링크에서만 동작합니다).');
