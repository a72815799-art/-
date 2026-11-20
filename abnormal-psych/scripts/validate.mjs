// 문제은행·콘텐츠 무결성 검사: node scripts/validate.mjs [files...]
import fs from 'node:fs'; import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname) + '/..';
const IDS = {
  anxiety: ['anxiety_overview','gad','specific_phobia','social_anxiety','panic','agoraphobia','separation_anxiety','selective_mutism'],
  ocd: ['ocd_overview','ocd','bdd','hoarding','trichotillomania','excoriation'],
  trauma: ['trauma_overview','ptsd','asd','adjustment','rad','dsed','prolonged_grief'],
  personality: ['pd_general','paranoid','schizoid','schizotypal','antisocial','borderline','histrionic','narcissistic','avoidant','dependent','ocpd','pd_alternative_model'],
};
const errors = []; const err = (f, m) => errors.push(`${f}: ${m}`);
function checkSource(f, s) {
  for (const k of ['source_name','ref','unit','basis','checked_date','source_verified','textbook_compared']) if (!(k in s)) err(f, `source missing ${k}`);
  if (s.textbook_compared !== false) err(f, 'textbook_compared must be false');
}
export function validateQuestion(q, f = 'q') {
  const t = `${f}#${q.id}`;
  for (const k of ['id','domain','disorder','level','type','polarity','stem','options','answer','explanation','sources','verification_status','concept']) if (q[k] === undefined) err(t, `missing ${k}`);
  if (!IDS[q.domain]) err(t, 'bad domain'); else {
    if (!IDS[q.domain].includes(q.disorder)) err(t, `bad disorder ${q.disorder}`);
    for (const r of q.related || []) if (!Object.values(IDS).flat().includes(r)) err(t, `bad related ${r}`);
  }
  if (![1,2,3,4,5].includes(q.level)) err(t, 'bad level');
  const opts = q.options || [];
  const keys = opts.map(o => o.key);
  if (q.type === 'ox') { if (keys.join() !== 'O,X') err(t, 'ox keys must be O,X'); }
  else if (q.type === 'single' || q.type === 'multi') { if (keys.join() !== '1,2,3,4,5') err(t, 'keys must be 1..5'); }
  else err(t, 'bad type');
  for (const o of opts) {
    if (!o.text || o.text.length < 1) err(t, `opt ${o.key} empty text`);
    if (!o.explanation || o.explanation.length < 8) err(t, `opt ${o.key} short explanation`);
    if (typeof o.is_true !== 'boolean' || typeof o.in_answer !== 'boolean') err(t, `opt ${o.key} flags`);
  }
  const inAns = opts.filter(o => o.in_answer).map(o => o.key);
  if (JSON.stringify([...q.answer].sort()) !== JSON.stringify(inAns.sort())) err(t, `answer ${q.answer} != in_answer ${inAns}`);
  if (q.type === 'ox') { if (inAns.length !== 1) err(t, 'ox needs 1 answer'); for (const o of opts) if (o.is_true !== o.in_answer) err(t, 'ox is_true must equal in_answer'); }
  if (q.type === 'single') {
    if (inAns.length !== 1) err(t, 'single needs exactly 1 answer');
    for (const o of opts) { const exp = q.polarity === 'correct' ? o.in_answer : !o.in_answer; if (o.is_true !== exp) err(t, `single polarity mismatch opt ${o.key}`); }
  }
  if (q.type === 'multi') {
    if (inAns.length < 2 || inAns.length > 4) err(t, `multi answer count ${inAns.length}`);
    for (const o of opts) { const exp = q.polarity === 'correct' ? o.is_true : !o.is_true; if (o.in_answer !== exp) err(t, `multi polarity mismatch opt ${o.key}`); }
    if (!/모두/.test(q.stem)) err(t, 'multi stem should say 모두');
  }
  if (!['correct','incorrect'].includes(q.polarity)) err(t, 'bad polarity');
  if (!['출처확인','자체검토(출처 미검증)'].includes(q.verification_status)) err(t, 'bad verification_status');
  if (q.textbook_compared !== false) err(t, 'textbook_compared must be false');
  for (const s of q.sources || []) checkSource(t, s);
  if (!(q.sources || []).length) err(t, 'no sources');
}
export function validateContent(c, f) {
  if (!IDS[c.domain]) return err(f, 'bad domain');
  const got = c.disorders.map(d => d.id);
  for (const id of IDS[c.domain]) if (!got.includes(id)) err(f, `missing disorder ${id}`);
  const req = ['definition','features','subtypes','core_symptoms','criteria','duration','exceptions','etiology_development','biological','psychodynamic','cbt','theorists','maintenance','treatment','differential','case','exam_points','confusions'];
  for (const d of c.disorders) {
    for (const k of req) if (!d.sections || d.sections[k] === undefined || (typeof d.sections[k] === 'string' && d.sections[k].length < 10)) err(f, `${d.id} section ${k} missing/short`);
    if (!d.summary || d.summary.length < 200) err(f, `${d.id} summary short`);
    if (!d.deep || d.deep.length < 200) err(f, `${d.id} deep short`);
    if (!(d.sources || []).length) err(f, `${d.id} no sources`);
    for (const s of d.sources || []) checkSource(`${f}/${d.id}`, s);
  }
}
if (process.argv[1] && process.argv[1].endsWith('validate.mjs')) {
  let files = process.argv.slice(2);
  if (!files.length) files = [...fs.readdirSync(root + '/content').map(x => root + '/content/' + x), ...fs.readdirSync(root + '/questions').map(x => root + '/questions/' + x)].filter(x => x.endsWith('.json'));
  const seen = new Map(); let nq = 0;
  for (const f of files) {
    let data; try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err(f, 'JSON parse: ' + e.message); continue; }
    if (Array.isArray(data)) { for (const q of data) { nq++; if (seen.has(q.id)) err(f, `dup id ${q.id} (also ${seen.get(q.id)})`); seen.set(q.id, path.basename(f)); validateQuestion(q, path.basename(f)); } }
    else validateContent(data, path.basename(f));
  }
  console.log(`files=${files.length} questions=${nq} errors=${errors.length}`);
  for (const e of errors.slice(0, 200)) console.log('  ' + e);
  process.exit(errors.length ? 1 : 0);
}
