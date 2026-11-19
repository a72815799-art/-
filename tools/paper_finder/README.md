# 논문 검색 · 다운로드 · 요약 (paper_finder)

검색어와 조건을 주면 **RISS(학위논문·국내학술)**, OpenAlex, Semantic Scholar(필요하면 arXiv)에서 논문을 찾습니다. 그다음 **단국대학교 도서관 교외접속 + RISS 기관인증**으로 원문 PDF를 받아 지정 폴더에 저장하고, **Claude로 한국어 요약**(`.summary.md`)을 만듭니다. 전체 목록은 `INDEX.md`·`results.json`에 저장됩니다.

## 1. 설치 (처음 한 번)
```bash
pip install -r requirements.txt
playwright install chromium
cp .env.example .env        # 메모장으로 열어 API 키, 단국대 학번/비번 입력
```

## 2. 단국대 로그인 (처음 한 번)
```bash
python paper_finder.py --login dankook --login-only
```
- 브라우저 창이 열리고 `.env`의 학번과 비밀번호로 자동 로그인합니다.
- 추가 인증(본인확인 등)이 뜨면 **그 창에서 직접 처리**하세요. 3분 기다립니다.
- 로그인 상태는 `.browser_profile/` 폴더에 저장되어 다음부터 재사용됩니다.

## 3. 검색 · 다운로드 · 요약
```bash
# RISS 학위논문+국내학술 10편, 단국대 권한으로 원문 받기, 요약
python paper_finder.py "MMPI-2-RF 우울" -o D:/논문/MMPI --login dankook

# 조건 지정: 2020년 이후, 최신순, 국내학술만, '청소년' 포함·'아동' 제외, 요약 관점 지정
python paper_finder.py "MMPI-2 자살" --riss-type kor --year-from 2020 --sort year \
    --must 청소년 --exclude 아동 --focus "척도별 결과 수치와 임상적 시사점" --login dankook

# 해외 논문까지 (OpenAlex/Semantic Scholar DOI → 단국대 프록시로 출판사 원문)
python paper_finder.py "MMPI-2-RF validity scales" --sources riss,openalex,semanticscholar \
    --riss-type thesis,kor,over --login dankook

# 로그인 없이 무료 원문만
python paper_finder.py "MMPI-2" --browser

# 이미 가지고 있는 PDF 폴더만 요약
python paper_finder.py --summarize-only D:/논문/MMPI
```

| 옵션 | 설명 |
|---|---|
| `-o` | 저장 폴더 (기본 `./papers`) |
| `-n` | 논문 수 (기본 10) |
| `--sources` | `riss,openalex,semanticscholar,arxiv` 중 선택 (기본: 앞의 3개) |
| `--riss-type` | `thesis`(학위논문), `kor`(국내학술), `over`(해외학술) |
| `--year-from/--year-to` | 출판 연도 범위 |
| `--sort` | `relevance` / `citations` / `year` |
| `--must` / `--exclude` | 제목·초록 포함/제외 단어 (쉼표 구분) |
| `--oa-only` | 무료 원문만 |
| `--focus` | 요약할 때 중점 관점 |
| `--login` | `dankook`, `riss` (RISS 개인계정: `.env`의 RISS_ID/RISS_PW) |
| `--browser` | 로그인 없이 브라우저로 원문 받기 |
| `--headless` | 브라우저 창 숨기기 (로그인 상태가 저장된 뒤에 권장) |
| `--no-download` / `--no-summary` | 단계 생략 |

## 다운로드 순서
1. 바로 받을 수 있는 공개 PDF (OpenAlex/Semantic Scholar/arXiv)
2. RISS 원문 링크: **무료 → 소속기관 구독 → 유료** 순서. 무료는 직접 받고, 나머지는 단국대 교외접속 프록시(`libproxy.dankook.ac.kr`)를 거칩니다. RISS는 KCI·DBpia·KISS·스콜라·학회·대학 리포지토리(dCollection) 등 실제 제공처로 연결하고, 프로그램이 그 페이지에서 PDF 다운로드 버튼을 찾아 누릅니다.
3. DOI가 있으면 단국대 프록시로 출판사 사이트 시도

PDF를 못 받은 논문은 초록으로 요약하고, 요약 파일에 "요약 근거: 초록"이라고 표시합니다. 다운로드 사이에는 2초 간격을 둡니다.

## 주의
- 학교 도서관과 각 DB(RISS, DBpia 등)의 **이용약관 범위 안에서** 사용하세요. 대량 일괄 다운로드는 계정 정지 사유가 될 수 있습니다.
- `.env`와 `.browser_profile/`에는 계정 정보와 로그인 상태가 들어 있으니 공유하지 마세요.
- 단국대 포털은 로그인 실패가 반복되면 잠길 수 있습니다. 실패하면 비밀번호부터 확인하세요.
