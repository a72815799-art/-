// 정답 사례(골든셋) 테스트: 20개 사례의 판정이 기록된 기대값과 같아야 한다.
// 규칙을 바꿨는데 이 테스트가 깨지면, 의도한 변화인지 검토한 뒤 `npm run golden:update`로 갱신한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadApp } from './load.mjs';
import { snapshot } from './snapshot.mjs';

const app = loadApp();
const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'golden.json'), 'utf8'));

test('모든 사례에 기대값이 있고, 기대값의 모든 사례가 존재한다', () => {
  assert.deepEqual([...app.CASES.map(c => c.id)].sort(), Object.keys(golden).sort());
});

for (const c of app.CASES) {
  test(`${c.id} ${c.title}: 엔진 판정이 기대값과 같다`, () => {
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot(app, c))), golden[c.id]);
  });
}

/* 기대값 자체가 사례 설계 의도와 맞는지 확인한다(골든셋을 잘못 갱신하는 것을 막는 2차 안전장치). */
const INTENT = {
  c01: { validity: 'valid', code: '7-2' },
  c02: { validity: 'valid', code: '3-1' },
  c03: { validity: 'valid', code: '4-9' },
  c04: { validity: 'valid', code: '6-8' },
  c05: { validity: 'invalid' },
  c06: { validity: 'caution', code: '정상 범위' },
  c07: { validity: 'valid', code: '4-2-7' },
  c08: { validity: 'valid', code: '4-6' },
  c09: { validity: 'valid', code: '9 단독' },
  c10: { validity: 'valid', code: '8-7-2' },
  c11: { validity: 'valid', code: '정상 범위' },
  c12: { validity: 'valid', code: '2-1-3' },
  c13: { validity: 'valid', code: '4-9' },
  c14: { validity: 'valid', code: '4-2' },
  c15: { validity: 'invalid' },
  c16: { validity: 'valid', code: '8-6' },
  c17: { validity: 'valid', code: '3-4' },
  c18: { validity: 'valid', code: '7-8' },
  c19: { validity: 'invalid' },
  c20: { validity: 'caution', code: '경계 범위' },
};

for (const [id, want] of Object.entries(INTENT)) {
  test(`${id}: 사례 설계 의도(${want.validity}${want.code ? ', ' + want.code : ''})와 일치한다`, () => {
    const g = golden[id];
    assert.equal(g.validity, want.validity);
    if (want.code) assert.ok(g.code && g.code.startsWith(want.code), `코드 ${g.code}는 ${want.code}로 시작해야 한다`);
    else assert.equal(g.code, null, '해석 불가 사례에는 코드타입이 없어야 한다');
  });
}
