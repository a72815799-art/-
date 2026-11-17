// 브라우저 없이 앱의 데이터와 해석 엔진을 불러오는 테스트용 로더.
// index.html의 <script> 순서를 그대로 읽어 같은 순서로 실행한다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

export function scriptOrder() {
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
}

export function loadApp({ exclude = ['app.js'] } = {}) {
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of scriptOrder()) {
    if (exclude.includes(f)) continue;
    vm.runInContext(readFileSync(join(APP, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

export const APP_DIR = APP;
