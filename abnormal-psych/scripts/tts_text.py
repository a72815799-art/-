"""낭독용 텍스트 정리(영문 이름·약어 한글화, 기호 처리) — make-*-audio 스크립트 공용"""
import re
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

