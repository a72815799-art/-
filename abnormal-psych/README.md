# 현대 이상심리학 기말고사 학습 프로그램

권석만 『현대 이상심리학』으로 기말고사(오픈북 객관식)를 준비하는 상담학 대학원생을 위한 학습 웹앱입니다. 시험 범위는 불안장애, 강박 및 관련 장애, 외상 및 스트레스 관련 장애, 성격장애입니다.

> 학습 내용은 공개 전문자료와 DSM-5 지식을 바탕으로 **독자적으로 재구성**했습니다. 권석만 교재와 직접 대조하지 않았으므로(전 항목 `교재 미대조`), 시험 전에 교재로 핵심을 확인하세요. 교육용이며 실제 진단이나 치료를 대신하지 않습니다.

## 1. 실행 방법

| 방법 | 절차 | 되는 기능 |
|---|---|---|
| **파일로 바로 열기 (권장)** | ZIP의 `app/index.html`(저장소에서는 `app/dist/index.html`)을 크롬·엣지·삼성인터넷으로 엽니다. 설치는 필요 없습니다. | 학습실, 문제 풀이, 모의고사, 오답노트, 통계, 백업, 검색 도우미, 브라우저 음성 낭독, 오디오 파일 재생(`audio/` 폴더가 옆에 있을 때) |
| 로컬 서버로 열기 | 폴더에서 `python3 -m http.server 8080`을 실행하고 `http://localhost:8080/app/`에 접속합니다. | 위 기능 전부. 브라우저에 따라 `file://`에서 막히는 **음성 인식(마이크)**은 `http://localhost`나 `https`에서 동작합니다. |
| 안드로이드 | ZIP의 `app/` 폴더를 휴대폰에 복사해 크롬으로 `index.html`을 엽니다. 마이크까지 쓰려면 https 주소로 배포된 사본이 필요합니다. 외부 배포는 사용자 승인 전이라 하지 않았습니다. | 위와 같음 |

학습 기록은 브라우저 저장소(localStorage)에 자동 저장됩니다. **설정 › JSON 백업 받기**로 주기적으로 백업하세요.

## 2. 폴더 구조

```
abnormal-psych/
  app/src/          소스 (core.js 로직, ui.js 화면, voice.js 음성, ai.js AI 연동, styles.css)
  app/dist/         빌드 결과: index.html(단일 파일, 데이터 포함), audio/(MP3 33개, git 제외·ZIP 포함)
  content/          학습 콘텐츠 JSON 4개 (33개 단원)
  questions/        문제은행 JSON 16개 (400문항)
  scripts/          build, validate, data-report, make-audio.py, evidence-video, apply-fixes 등
  tests/unit/       Node 단위 테스트
  tests/e2e/        Playwright 브라우저 종단 테스트
  tests/results/    테스트 원본 결과(JSON, TAP, 대화 기록)
  screenshots/      PC·모바일(에뮬레이션) 화면 캡처
  voice-evidence/   음성 기능 화면 녹화(webm)와 대화 기록
  reports/          기능 상태, 테스트 보고서, 데이터 보고서, 독립 검토 결과, 제한사항
  SPEC.md           데이터 규격
```

## 3. 다시 빌드하고 검증하는 방법

```bash
cd abnormal-psych
node scripts/validate.mjs            # 데이터 규격 검사(정답 집합·극성·출처 필드)
node --test tests/unit/*.test.mjs    # 단위 테스트
node scripts/build.mjs               # app/dist/index.html 생성
python3 scripts/make-audio.py        # (선택) 오디오 묶음 생성: espeak-ng, ffmpeg 필요
node tests/e2e/run.mjs               # 브라우저 테스트 + 화면 캡처 (playwright 필요)
node scripts/data-report.mjs         # 콘텐츠·문제은행 통계
node scripts/test-report.mjs         # 테스트 보고서 생성
```

## 4. 외부 평가자가 확인하는 방법

- 문제 데이터 `questions/*.json`은 모두 같은 구조입니다(`SPEC.md`). 각 문항에 `answer`(정답 키 집합)가 있고, 보기마다 `is_true`(진술의 정오), `in_answer`(정답 포함 여부), `explanation`이 있습니다. 문항에는 `sources`, `verification_status`, `textbook_compared`가 붙어 있습니다.
- `node scripts/validate.mjs`를 실행하면 정답 집합과 보기 표시가 일치하는지 자동으로 검사합니다.
- 테스트 결과: `reports/test-report.md`, 원본 `tests/results/e2e-results.json`
- 기능 상태와 제한사항: `reports/feature-status.md`, `reports/limitations.md`

## 5. 무료 기능과 유료 기능

- **무료(API 불필요):** 학습실, 문제 풀이·채점, 모의고사, 오답노트, 통계, 백업, 검색 기반 학습 도우미, 브라우저 음성 낭독·인식, 오디오 파일 재생
- **유료(선택):** AI 개인교수(Claude API)입니다. 설정에서 사용자가 API 키를 넣고 켰을 때만 호출하며, 요청마다 사용자 계정에 요금이 청구됩니다. 개발 중에는 실제로 호출하지 않았습니다(**연동 준비 완료 · 실호출 미검증**).
