import test from 'node:test'; import assert from 'node:assert/strict'; import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const qs = fs.readdirSync(root + '/questions').filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(fs.readFileSync(root + '/questions/' + f, 'utf8')));
const content = fs.readdirSync(root + '/content').filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(root + '/content/' + f, 'utf8')));
test('규격 검사기 오류 0 (정답 집합=in_answer, 극성, 보기 수, 출처 필드)', () => { const out = execFileSync('node', [root + '/scripts/validate.mjs']).toString(); assert.match(out, /errors=0/); });
test('4개 영역 콘텐츠와 33개 단원', () => { assert.equal(content.length, 4); assert.equal(content.reduce((n, c) => n + c.disorders.length, 0), 33); });
test('모든 단원에 문제가 1개 이상 연결', () => { const ids = content.flatMap(c => c.disorders.map(d => d.id)); const missing = ids.filter(id => !qs.some(q => q.disorder === id || (q.related || []).includes(id))); assert.deepEqual(missing, []); });
test('ID 고유, 정답이 비어 있지 않음, 복수정답 2~4개', () => { assert.equal(new Set(qs.map(q => q.id)).size, qs.length); for (const q of qs) { assert.ok(q.answer.length >= 1); if (q.type === 'multi') assert.ok(q.answer.length >= 2 && q.answer.length <= 4, q.id); } });
test('교재 대조 표시 없음(전부 교재 미대조)', () => { assert.equal(qs.filter(q => q.textbook_compared).length, 0); });
