// 단일 HTML(독립 실행) 빌드: content/*.json + questions/*.json + app/src/* → app/dist/index.html
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = p => fs.readFileSync(path.join(root, p), 'utf8');
const content = fs.readdirSync(path.join(root, 'content')).filter(f => f.endsWith('.json')).map(f => JSON.parse(rd('content/' + f)));
const questions = fs.readdirSync(path.join(root, 'questions')).filter(f => f.endsWith('.json')).sort().flatMap(f => JSON.parse(rd('questions/' + f)));
const audioDir = path.join(root, 'app/dist/audio'); let audio = [];
if (fs.existsSync(path.join(audioDir, 'manifest.json'))) audio = JSON.parse(fs.readFileSync(path.join(audioDir, 'manifest.json'), 'utf8'));
const meta = { version: JSON.parse(rd('package.json')).version, built: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', counts: { content: content.length, questions: questions.length } };
const safe = s => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
let html = rd('app/src/index.template.html');
const rep = (k, v) => { html = html.split(k).join(v); };
rep('/*STYLES*/', rd('app/src/styles.css'));
rep('/*DATA*/', 'window.APP_DATA=' + safe(JSON.stringify({ content, questions, meta, audio })) + ';');
rep('/*CORE*/', safe(rd('app/src/core.js'))); rep('/*VOICE*/', safe(rd('app/src/voice.js'))); rep('/*AI*/', safe(rd('app/src/ai.js'))); rep('/*UI*/', safe(rd('app/src/ui.js')));
fs.mkdirSync(path.join(root, 'app/dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'app/dist/index.html'), html);
console.log(`built app/dist/index.html (${(html.length / 1024).toFixed(0)} KB) content=${content.length} questions=${questions.length} audio=${audio.length}`);
