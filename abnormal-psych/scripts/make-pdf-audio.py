"""시험장용 요약집(print/exam-source) 내용을 MP3 한 파일로 생성 — 운전 중 연속 청취용.
순서: 영역별 장애(블록 제목 → 항목) → 숫자 총정리 → 감별진단 쌍 → 이론가 색인. 단원별 챕터와 시간표 포함.
실행: python3 scripts/make-pdf-audio.py [원고폴더=print/exam-source] [--speed 165]"""
import json, os, re, subprocess, sys, tempfile, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tts_text import clean
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
src = os.path.join(root, args[0] if args else 'print/exam-source')
SPEED = sys.argv[sys.argv.index('--speed') + 1] if '--speed' in sys.argv else '165'
out_dir = os.path.join(root, 'app', 'dist', 'audio-single'); os.makedirs(out_dir, exist_ok=True)
name = '이상심리학_시험장용요약집_음성'; SR = 22050
DOMS = [('anxiety', '불안장애'), ('ocd', '강박 및 관련 장애'), ('trauma', '외상 및 스트레스 관련 장애'), ('personality', '성격장애')]

def speak(t):
    """요약집 기호를 말로 바꾼 뒤 공용 정리 적용"""
    t = t.replace('**', '')
    t = re.sub(r'^★\s*', '필수. ', t).replace('★', '')
    t = re.sub(r'[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]', lambda m: str('①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'.index(m.group(0)) + 1) + '번, ', t)
    t = re.sub(r'(\d+)\s*중\s*(\d+)', r'\1개 중 \2개', t)
    t = re.sub(r'^\s*vs\.?\s*([^:：,]+)[:：]', r'\1과 감별, ', t)
    t = re.sub(r'\s*vs\.?\s*', ', 대, ', t)
    t = t.replace('≥', ' 이상 ').replace('≤', ' 이하 ').replace('↑', ' 이상').replace('↓', ' 감소').replace('⇒', ', 그래서 ').replace('→', ', 그래서 ').replace('↔', ' 와 ').replace('×', ' 곱하기 ')
    t = re.sub(r'\s=\s|=', ' 은 ', t)
    t = re.sub(r'\s\+\s|\+', ' 그리고 ', t)
    t = re.sub(r'(?<=[가-힣\s)])X(?=[\s,.;)]|$)', ' 아님', t)
    t = re.sub(r'(?<=[가-힣\s)])O(?=[\s,.;)]|$)', ' 맞음', t)
    t = t.replace(';', '. ').replace(':', ', ')
    t = clean(t)
    t = re.sub(r'\s+,', ',', t).strip(' ,')
    return t if re.search(r'[.?!]$', t) else t + '.'

items = []   # (kind, title, text)
for d, dn in DOMS:
    j = json.load(open(os.path.join(src, d + '.json'), encoding='utf-8'))
    items.append(('domain', dn, f'{dn}.'))
    for u in j['units']:
        parts = [f"{u['name']}."]
        for b in u['blocks']:
            parts.append(speak(b['h']))
            parts += [speak(x) for x in b['items']]
        items.append(('unit', u['name'], ' '.join(parts)))
items.append(('domain', '숫자 총정리', '숫자 총정리. 장애별 증상 수와 역치, 기간, 연령입니다.'))
for d, dn in DOMS:
    j = json.load(open(os.path.join(src, d + '.json'), encoding='utf-8'))
    rows = [speak(f"{n['name']}. 역치 {n['criteria']}. 기간 {n['duration']}. 연령 {n['age']}. {n['note']}") for n in j.get('numbers', [])]
    items.append(('unit', '숫자 총정리 · ' + dn, dn + '. ' + ' '.join(rows)))
items.append(('domain', '감별진단 쌍', '헷갈리는 감별진단 쌍.'))
for d, dn in DOMS:
    j = json.load(open(os.path.join(src, d + '.json'), encoding='utf-8'))
    items.append(('unit', '감별 · ' + dn, dn + ' 감별. ' + ' '.join(speak(f"{x['a']} 대 {x['b']}. {x['point']}") for x in j.get('differentials', []))))
ths = []
for d, dn in DOMS: ths += json.load(open(os.path.join(src, d + '.json'), encoding='utf-8')).get('theorists', [])
ths.sort(key=lambda t: t.get('ko') or t['name'])
items.append(('domain', '이론가 색인', '이론가 색인. 가나다 순입니다.'))
for k in range(0, len(ths), 25):
    chunk = ths[k:k + 25]
    items.append(('unit', f"이론가 {k + 1}~{k + len(chunk)}", ' '.join(speak(f"{t.get('ko') or t['name']}. {t['idea']}. 관련 장애, {t['disorder']}") for t in chunk)))

tmp = tempfile.mkdtemp(prefix='pdfaud', dir=os.environ.get('TMPDIR'))
def synth(ix):
    i, it = ix; txt = os.path.join(tmp, f'{i:04d}.txt'); wav = os.path.join(tmp, f'{i:04d}.wav')
    open(txt, 'w', encoding='utf-8').write(it[2])
    subprocess.run(['espeak-ng', '-v', 'ko', '-s', SPEED, '-g', '4', '-f', txt, '-w', wav], check=True)
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], capture_output=True, text=True)
    return i, float(r.stdout.strip())
with cf.ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as ex: durs = dict(ex.map(synth, enumerate(items)))
def silence(sec):
    p = os.path.join(tmp, f'sil{sec}.wav')
    if not os.path.exists(p): subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', f'anullsrc=r={SR}:cl=mono', '-t', str(sec), '-c:a', 'pcm_s16le', p], check=True)
    return p
lst, t, chapters = [], 0.0, []
for i, it in enumerate(items):
    if i: g = 3.0 if it[0] == 'domain' else 2.0; lst.append(silence(g)); t += g
    chapters.append([t, ('■ ' if it[0] == 'domain' else '   ') + it[1]])
    lst.append(os.path.join(tmp, f'{i:04d}.wav')); t += durs[i]
total = t
open(os.path.join(tmp, 'list.txt'), 'w').writelines(f"file '{p}'\n" for p in lst)
meta = os.path.join(tmp, 'meta.txt')
with open(meta, 'w', encoding='utf-8') as f:
    f.write(';FFMETADATA1\ntitle=현대 이상심리학 기말 시험장용 요약집 음성\nartist=이상심리학 기말 학습\nalbum=시험장용 요약집\ngenre=Speech\n')
    for k, (st, title) in enumerate(chapters):
        en = chapters[k + 1][0] if k + 1 < len(chapters) else total
        f.write(f'[CHAPTER]\nTIMEBASE=1/1000\nSTART={int(st*1000)}\nEND={int(en*1000)}\ntitle={title.strip()}\n')
mp3 = os.path.join(out_dir, name + '.mp3')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', os.path.join(tmp, 'list.txt'), '-i', meta, '-map_metadata', '1', '-map_chapters', '1', '-ac', '1', '-ar', str(SR), '-b:a', '32k', '-id3v2_version', '3', mp3], check=True)
fmt = lambda s: f'{int(s//3600)}:{int(s%3600//60):02d}:{int(s%60):02d}'
with open(os.path.join(out_dir, name + '_시간표.txt'), 'w', encoding='utf-8') as f:
    f.write(f'{name}.mp3 — 총 {fmt(total)}\n시험장용 요약집(23쪽) 내용 낭독 · eSpeak NG 한국어(기계음) · 속도 {SPEED}\n★ 항목은 "필수"라고 읽습니다.\n\n')
    f.writelines(f'{fmt(s)}  {title}\n' for s, title in chapters)
print(mp3, fmt(total), round(os.path.getsize(mp3) / 1e6, 1), 'MB', len(chapters), 'chapters')
