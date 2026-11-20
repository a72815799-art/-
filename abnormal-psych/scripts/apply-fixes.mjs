// 검토 결과 수정 적용 도구: node scripts/apply-fixes.mjs fixes.json
// fixes: [{id, set: {"explanation": "...", "options.4.text": "...", ...}, replace: [{path, from, to}]}]
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fixes = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const byId = Object.fromEntries(fixes.map(f => [f.id, f])); let n = 0;
const get = (o, p) => p.split('.').reduce((x, k) => x[k], o); const set = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; };
for (const f of fs.readdirSync(root + '/questions').filter(f => f.endsWith('.json'))) {
  const qs = JSON.parse(fs.readFileSync(root + '/questions/' + f, 'utf8')); let ch = false;
  for (const q of qs) { const fx = byId[q.id]; if (!fx) continue;
    for (const [p, v] of Object.entries(fx.set || {})) { set(q, p, v); }
    for (const r of fx.replace || []) { const cur = get(q, r.path); if (!cur.includes(r.from)) throw new Error(q.id + ' ' + r.path + ' missing: ' + r.from); set(q, r.path, cur.split(r.from).join(r.to)); }
    q.review_note = (q.review_note ? q.review_note + ' / ' : '') + (fx.note || '독립 검토 후 수정'); ch = true; n++; delete byId[q.id]; }
  if (ch) fs.writeFileSync(root + '/questions/' + f, JSON.stringify(qs, null, 1));
}
if (Object.keys(byId).length) console.log('NOT FOUND:', Object.keys(byId)); console.log('applied', n);
