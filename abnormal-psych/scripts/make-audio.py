"""오프라인 오디오 묶음 생성: 각 장애의 '핵심 요약 + 시험 핵심 + 혼동 주의'를 eSpeak NG(한국어)로 합성해 MP3로 저장.
화면 잠금/백그라운드에서도 재생되는 <audio> 방식용. 음질은 기계음.
실행: python3 scripts/make-audio.py   (espeak-ng, ffmpeg 필요)"""
import json, os, subprocess, glob, tempfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'app', 'dist', 'audio'); os.makedirs(out, exist_ok=True)
order = ['anxiety', 'ocd', 'trauma', 'personality']
contents = sorted([json.load(open(f, encoding='utf-8')) for f in glob.glob(os.path.join(root, 'content', '*.json'))], key=lambda c: order.index(c['domain']))
manifest = []; n = 0
for c in contents:
    for d in c['disorders']:
        n += 1
        s = d['sections']
        text = f"{c['title']}. {d['name']}. 핵심 요약. {d['summary']} 시험 핵심. " + ' '.join(s.get('exam_points', [])) + ' 혼동하기 쉬운 내용. ' + ' '.join(s.get('confusions', []))
        fn = f"{n:02d}-{d['id']}.mp3"; dst = os.path.join(out, fn)
        with tempfile.TemporaryDirectory() as td:
            txt = os.path.join(td, 't.txt'); open(txt, 'w', encoding='utf-8').write(text)
            wav = os.path.join(td, 'a.wav')
            subprocess.run(['espeak-ng', '-v', 'ko', '-s', '165', '-f', txt, '-w', wav], check=True)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '22050', '-b:a', '32k', dst], check=True)
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst], capture_output=True, text=True).stdout.strip() or 0)
        manifest.append({'src': 'audio/' + fn, 'title': d['name'] + ' 핵심 요약', 'domain': c['domain'], 'disorder': d['id'], 'seconds': round(dur), 'chars': len(text)})
        print(fn, round(dur), 's')
json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('total', len(manifest), 'files', round(sum(m['seconds'] for m in manifest) / 60), 'min')
