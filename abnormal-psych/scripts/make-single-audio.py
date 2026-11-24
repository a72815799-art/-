"""시험 범위 전체 강의를 MP3 한 파일로 생성(운전 중 연속 청취용).
- 내용: 앱의 '연속 강의 듣기'와 같은 순서(영역 개관 → 단원별 핵심 요약, 18개 항목, 심화 이론)
- 음성: eSpeak NG 한국어(오프라인, 기계음)
- 단원별 챕터(ID3 CHAP)와 시간표(.txt)를 함께 생성
실행: python3 scripts/make-single-audio.py [--summary] [--speed 165]
필요: espeak-ng, ffmpeg, node(재생목록 생성)"""
import json, os, re, subprocess, sys, tempfile, concurrent.futures as cf

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUMMARY = '--summary' in sys.argv
SPEED = sys.argv[sys.argv.index('--speed') + 1] if '--speed' in sys.argv else '165'
out_dir = os.path.join(root, 'app', 'dist', 'audio-single'); os.makedirs(out_dir, exist_ok=True)
name = '이상심리학_핵심요약_전체' if SUMMARY else '이상심리학_전체강의'
SR = 22050

# ---------- 낭독용 텍스트 정리 ----------
NAMES = {'Clark':'클라크','Kernberg':'컨버그','Freud':'프로이트','Beck':'벡','Millon':'밀론','Barlow':'발로','Mowrer':'마우러','Bowlby':'볼비','Wells':'웰스','Foa':'포아','Ehlers':'엘러스','Kohut':'코헛','Rachman':'라크먼','Klein':'클라인','Mahler':'말러','Shapiro':'샤피로','Watson':'왓슨','Borkovec':'보르코벡','Horowitz':'호로위츠','Brewin':'브루인','Heimberg':'하임버그','Salkovskis':'살코프스키스','Frost':'프로스트','Masterson':'매스터슨','Young':'영','Seligman':'셀리그먼','Ainsworth':'에인스워스','Rapee':'라피','Linehan':'리네한','Kagan':'케이건','Wolpe':'울프','Dugas':'듀가스','Wegner':'웨그너','Hartl':'하틀','Janoff-Bulman':'재노프 불먼','Guntrip':'건트립','Meehl':'밀','Cleckley':'클레클리','Hare':'헤어','Lykken':'리켄','Raine':'레인','Bornstein':'본스타인','Bandura':'반두라','Reiss':'라이스','Goldstein':'골드스타인','Azrin':'아즈린','Lazarus':'라자루스','Cameron':'캐머런','Schreber':'슈레버','Fairbairn':'페어베언','Fowles':'파울스','Fonagy':'포나기','Kozak':'코작','Busch':'부시','Chambless':'챔블리스','de Silva':'드 실바','Silva':'실바','Meyer':'마이어','Veale':'빌','Resick':'레식','Bryant':'브라이언트','Zeanah':'지나','Stroebe':'슈트뢰베','Widiger':'위디거','Moffitt':'모핏','Gray':'그레이','Abraham':'아브라함','Salzman':'살즈만','Kendall':'켄달','Kussmaul':'쿠스마울','Tramer':'트라머','Black':'블랙','Uhde':'우데','Bergman':'버그먼','Rayner':'레이너','Öhman':'외만','Mineka':'미네카','Craske':'크래스크','Hope':'호프','Gorman':'고먼','Milrod':'밀로드','Sanderson':'샌더슨','Mennin':'메닌','Morselli':'모르셀리','Phillips':'필립스','Steketee':'스테케티','Tolin':'톨린','Nunn':'넌','Hallopeau':'알로포','Mansueto':'만수에토','Wilson':'윌슨','Harvey':'하비','Folkman':'포크먼','Holmes':'홈스','Rahe':'라헤','Selye':'셀리에','Spitz':'스피츠','Main':'메인','Harlow':'할로','Tizard':'티자드','Rutter':'러터','Schut':'슈트','Shear':'시어','Prigerson':'프리저슨','Costa':'코스타','McCrae':'매크레이','Colby':'콜비','Turkat':'터캣','Bleuler':'블로일러','Kretschmer':'크레치머','Rado':'라도','Caspi':'카스피','Patterson':'패터슨','Stern':'스턴','Adler':'아들러','Buie':'부이','Bateman':'베이트먼','Gunderson':'건더슨','Charcot':'샤르코','Gabbard':'개버드','Skodol':'스코돌','Bender':'벤더','Morey':'모리','Krueger':'크루거','Grant':'그랜트','Rayner':'레이너','Gross':'그로스','Hayes':'헤이즈','Kraepelin':'크레펠린','Janet':'자네','Pavlov':'파블로프','Skinner':'스키너','Ellis':'엘리스','Hans':'한스','Little':'꼬마','GABA':'가바'}
LET = dict(zip('ABCDEFGHIJKLMNOPQRSTUVWXYZ', '에이 비 씨 디 이 에프 지 에이치 아이 제이 케이 엘 엠 엔 오 피 큐 알 에스 티 유 브이 더블유 엑스 와이 지'.split()))
ROMAN = {'III-R': '3 개정판', 'IV-TR': '4 개정판', 'III': '3', 'IV': '4', 'II': '2'}

def clean(t):
    t = t.replace('Ö', 'Ö')
    t = re.sub(r'\(([^()가-힣]*)\)', '', t)                    # 영어만 있는 괄호 설명 제거: (Panic Disorder)
    t = re.sub(r'((?:\b[A-Z]\.\s*){1,3})(?=[A-Z][a-z])', '', t) # 이름 앞 이니셜 제거: D. M. Clark
    t = re.sub(r'DSM-(III-R|IV-TR|III|IV|II)', lambda m: 'DSM ' + ROMAN[m.group(1)], t)
    t = re.sub(r'ICD-(\d+)', r'ICD \1', t)
    t = re.sub(r'DSM-(\d)', r'DSM \1', t)
    for k in sorted(NAMES, key=len, reverse=True): t = re.sub(r'(?<![A-Za-z])' + re.escape(k) + r'(?![a-z])', NAMES[k], t)
    t = re.sub(r'(?<![A-Za-z])([A-Z]{2,})s?(?![A-Za-z])', lambda m: ''.join(LET[c] for c in m.group(1)), t)  # 약어 철자 읽기
    t = re.sub(r'(?<![A-Za-z])([A-Z])(?![A-Za-z])', lambda m: LET[m.group(1)], t)      # 기준 A → 기준 에이
    t = t.replace('-TR', ' 티알').replace('%', ' 퍼센트').replace('~', '에서 ').replace('·', ', ').replace('/', ' 또는 ').replace('→', ', ')
    t = re.sub(r'[()\[\]{}"“”‘’]', ', ', t).replace('…', '.')
    t = re.sub(r'\s*,\s*(,\s*)+', ', ', t)
    return re.sub(r'\s+', ' ', t).strip()

# ---------- 재생목록(앱과 동일) ----------
js = """const C=require(process.argv[1]+'/app/src/core.js');const fs=require('fs');const o=['anxiety','ocd','trauma','personality'];
const content=o.map(d=>JSON.parse(fs.readFileSync(process.argv[1]+'/content/'+d+'.json')));
const out=[];for(const c of content){out.push({kind:'domain',domain:c.domain,title:c.title,text:c.title+'. '+(process.argv[2]==='1'?'':c.overview)});
const pl=C.buildPlaylist([c],{mode:process.argv[2]==='1'?'summary':'full'});for(const t of pl)out.push({kind:'sec',disorder:t.disorder,title:t.title,text:t.sentences.join(' ')});}
console.log(JSON.stringify(out));"""
items = json.loads(subprocess.run(['node', '-e', js, root, '1' if SUMMARY else '0'], capture_output=True, text=True, check=True).stdout)
names = {}
for f in os.listdir(os.path.join(root, 'content')):
    for d in json.load(open(os.path.join(root, 'content', f), encoding='utf-8'))['disorders']: names[d['id']] = d['name']

tmp = tempfile.mkdtemp(prefix='aud', dir=os.environ.get('TMPDIR'))
def synth(i_it):
    i, it = i_it
    txt = os.path.join(tmp, f'{i:04d}.txt'); wav = os.path.join(tmp, f'{i:04d}.wav')
    open(txt, 'w', encoding='utf-8').write(clean(it['text']))
    subprocess.run(['espeak-ng', '-v', 'ko', '-s', SPEED, '-g', '4', '-f', txt, '-w', wav], check=True)
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], capture_output=True, text=True)
    return i, float(r.stdout.strip())
with cf.ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as ex: durs = dict(ex.map(synth, enumerate(items)))

def silence(sec):
    p = os.path.join(tmp, f'sil{sec}.wav')
    if not os.path.exists(p): subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', f'anullsrc=r={SR}:cl=mono', '-t', str(sec), '-c:a', 'pcm_s16le', p], check=True)
    return p

# 순서 결합 + 챕터(단원 단위)
lst, t, chapters, toc, prev_dis = [], 0.0, [], [], None
for i, it in enumerate(items):
    gap = 3.0 if it['kind'] == 'domain' else (2.0 if it.get('disorder') != prev_dis else 0.8)
    if i: lst.append(silence(gap)); t += gap
    if it['kind'] == 'domain':
        chapters.append([t, it['title']]); toc.append((t, '■ ' + it['title'])); prev_dis = None
    elif it['disorder'] != prev_dis:
        chapters.append([t, names.get(it['disorder'], it['disorder'])]); toc.append((t, '   ' + names.get(it['disorder'], it['disorder']))); prev_dis = it['disorder']
    lst.append(os.path.join(tmp, f'{i:04d}.wav')); t += durs[i]
total = t
with open(os.path.join(tmp, 'list.txt'), 'w') as f: f.writelines(f"file '{p}'\n" for p in lst)
meta = os.path.join(tmp, 'meta.txt')
with open(meta, 'w', encoding='utf-8') as f:
    f.write(';FFMETADATA1\ntitle=' + ('현대 이상심리학 기말 핵심 요약 전체' if SUMMARY else '현대 이상심리학 기말 전체 강의') + '\nartist=이상심리학 기말 학습\nalbum=불안·강박·외상·성격장애\ngenre=Speech\n')
    for k, (st, title) in enumerate(chapters):
        en = chapters[k + 1][0] if k + 1 < len(chapters) else total
        f.write(f'[CHAPTER]\nTIMEBASE=1/1000\nSTART={int(st*1000)}\nEND={int(en*1000)}\ntitle={title}\n')
mp3 = os.path.join(out_dir, name + '.mp3')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', os.path.join(tmp, 'list.txt'), '-i', meta, '-map_metadata', '1', '-map_chapters', '1', '-ac', '1', '-ar', str(SR), '-b:a', '32k', '-id3v2_version', '3', mp3], check=True)
fmt = lambda s: f'{int(s//3600)}:{int(s%3600//60):02d}:{int(s%60):02d}'
with open(os.path.join(out_dir, name + '_시간표.txt'), 'w', encoding='utf-8') as f:
    f.write(f'{name}.mp3 — 총 {fmt(total)}\n음성: eSpeak NG 한국어(오프라인 합성, 기계음) · 속도 {SPEED}\n순서: 영역 개관 → 단원별 핵심 요약' + ('' if SUMMARY else ', 정의~혼동 주의 18개 항목, 심화 이론') + '\n\n')
    f.writelines(f'{fmt(s)}  {title}\n' for s, title in toc)
print(mp3, fmt(total), round(os.path.getsize(mp3) / 1e6, 1), 'MB', len(chapters), 'chapters')
