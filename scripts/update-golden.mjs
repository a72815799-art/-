// 정답 사례(골든셋) 기대값을 현재 엔진 결과로 다시 기록한다.
// 규칙을 "의도적으로" 바꾼 뒤에만 실행하고, git diff로 바뀐 판정을 하나씩 검토한 뒤 커밋한다.
//   npm run golden:update
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadApp } from '../tests/load.mjs';
import { snapshot } from '../tests/snapshot.mjs';

const app = loadApp();
const out = {};
for (const c of app.CASES) out[c.id] = snapshot(app, c);

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'golden.json');
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
console.log(`golden.json: ${Object.keys(out).length}개 사례 기록`);
