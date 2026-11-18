// 단일 HTML 파일 만들기: 모든 스크립트를 한 파일에 넣어 카톡·메일로 보낼 수 있게 한다.
//   npm run bundle  →  dist/mmpi-academy-v<버전>.html
// 이 파일은 공유 링크 밖에서 열리므로 AI 기능과 클래스 모드는 꺼지고(화면에 안내), 나머지는 오프라인으로 동작한다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
let body = readFileSync(join(app, 'index.html'), 'utf8');
body = body.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => {
  const js = readFileSync(join(app, f), 'utf8');
  if (/<\/script/i.test(js)) throw new Error(`${f}에 </script 문자열이 있어 인라인할 수 없습니다`);
  return `<script>/* ${f} */\n${js}\n</script>`;
});
// 오프라인 파일은 호스팅 플랫폼을 쓰지 않으므로 플랫폼 연결 코드와 플랫폼 전용 메타 태그를 지운다
// (연결 객체를 다른 이름으로 바꾸면 항상 비어 있어 오프라인 모드로 동작한다)
body = body.replace(/<meta name="[a-z]+:viewport-fit-sides"[^>]*>\n?/, '').replace(/window\.claude/g, 'window.__platform');
if (/claude/i.test(body)) throw new Error('오프라인 파일에 플랫폼 이름이 남아 있습니다');
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' +
  body + '</body></html>';
mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', `mmpi-academy-v${version}.html`);
writeFileSync(out, html);
console.log(`${out} (${Math.round(html.length / 1024)}KB)`);
