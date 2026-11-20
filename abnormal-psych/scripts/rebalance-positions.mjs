// 단일정답 문항의 정답 위치 편중 해소: 보기를 회전시켜 정답 위치를 1~5에 고르게 배분(해설·정오는 보기와 함께 이동).
// 사용: node scripts/rebalance-positions.mjs questions/trauma-*.json
import fs from 'node:fs';
let idx = 0; const log = [];
for (const f of process.argv.slice(2)) {
  const qs = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const q of qs) {
    if (q.type !== 'single') continue;
    const target = (idx++ % 5); // 0..4
    const cur = q.options.findIndex(o => o.in_answer);
    const shift = (target - cur + 5) % 5;
    if (!shift) continue;
    const texts = q.options.map(({ key, ...rest }) => rest);
    const rotated = texts.map((_, i) => texts[(i - shift + 5) % 5]);
    q.options = rotated.map((o, i) => ({ key: String(i + 1), ...o }));
    q.answer = q.options.filter(o => o.in_answer).map(o => o.key);
    log.push(q.id + ': ' + (cur + 1) + '→' + q.answer[0]);
  }
  fs.writeFileSync(f, JSON.stringify(qs, null, 1));
}
console.log(log.length + ' questions rotated'); console.log(log.slice(0, 5).join('\n'));
