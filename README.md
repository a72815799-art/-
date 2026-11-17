# MMPI 해석 수련실

대학원 수련생이 MMPI-2(성인)와 MMPI-A(청소년) 프로파일을 숙련된 임상가의 사고 순서대로 해석하도록 훈련하는 학습 프로그램입니다.

- **사용하기:** [MMPI 해석 수련실](https://claude.ai/artifact/WmZTheLGidZC1qejCiVwrM) (claude.ai 로그인 필요, 공유받은 사람만 열람 가능)
- **사용 매뉴얼:** [MMPI 해석 수련실 사용 매뉴얼](https://claude.ai/artifact/7fkVx5kZrCe7iBWpc1f9Bd)
- **오류 신고·제안:** 이 저장소의 [Issues](../../issues/new/choose)

> 학습용 프로그램입니다. 모든 사례는 가상 자료이고, 검사 문항은 저작권 때문에 포함하지 않았습니다. 실제 평가와 진단에 사용하지 마세요.

## 구성

| 영역 | 내용 |
| --- | --- |
| 커리큘럼 | 8단계(기초 → 타당도 → 임상척도 → 코드타입 → RC·내용·보충 → 통합 해석 → 사례 → MMPI-A) |
| 이론 | 모듈 20개 |
| 척도 사전 | MMPI-2 척도 64개 + 하위척도 31개, MMPI-A 척도(청소년 기준과 차이 포함) |
| 코드타입 사전 | 성인 39개, 청소년 10개 |
| 프로파일 분석기 | 규칙 기반 8단계 해석 엔진(MMPI-2 / MMPI-A) |
| 실험실 | 응답 양식 실험실(무선·고정반응·과대·과소보고 시뮬레이션, 맞히기 문제), 측정오차와 코드타입 안정성(재검사 몬테카를로, 정의 수준 곡선, RCI 계산기) |
| 사례 실습 | 가상 사례 20개(성인 15, 청소년 5), 자가 점검, AI 슈퍼바이저 코칭, 모범 해석 |
| 퀴즈 | 57문항 + 성인 vs 청소년 O/X 12문항 |

## 폴더 구조

```
app/                      배포되는 프로그램 (빌드 단계 없음)
  index.html              화면 뼈대와 스타일. <script> 순서가 곧 로딩 순서
  data-scales.js          MMPI-2 척도·하위척도 사전
  data-codetypes.js       성인 코드타입 사전
  data-theory.js          커리큘럼 단계, 이론 모듈, 퀴즈
  data-cases.js           성인 사례 1~12
  data-mmpia.js           MMPI-A 척도·코드타입·모듈·사례·비교표
  data-extra.js           보완 모듈·코드타입·사례 17~20·퀴즈
  engine.js               해석 엔진 (MMPI.analyze)
  sim.js                  실험실 계산 모듈 (응답 양식 모형, 재검사 시뮬레이션, RCI). 화면과 분리된 순수 함수
  app.js                  화면(라우팅, 차트, 분석기, 사례, 퀴즈, AI 연동)
tests/
  golden.test.mjs         정답 사례(골든셋): 20개 사례의 판정 고정
  rules.test.mjs          절단점 경계값 테스트 (MMPI-2 / MMPI-A)
  data.test.mjs           콘텐츠 무결성 (id 중복, 척도 이름, 점수 범위, 필수 항목)
  sim.test.mjs            실험실 모듈: 엔진과 코드 규칙 일치(무작위 프로파일 4,000개), 응답 양식 방향, 시뮬레이션 성질
  fixtures/golden.json    골든셋 기대값
scripts/
  update-golden.mjs       골든셋 기대값 다시 기록
  preview.mjs             로컬 미리보기 생성
```

## 개발

Node.js 20 이상만 있으면 됩니다. 외부 패키지는 없습니다.

```bash
npm test               # 전체 테스트
npm run check          # app/*.js 문법 검사
npm run preview        # dist/index.html 생성 후 브라우저로 열기
npm run golden:update  # 규칙을 의도적으로 바꾼 뒤 골든셋 갱신
```

푸시와 풀 리퀘스트마다 GitHub Actions가 문법 검사와 테스트를 실행합니다.

### 해석 규칙을 바꿀 때

1. `app/engine.js`의 규칙을 수정합니다.
2. `npm test`를 실행합니다. 골든셋 테스트가 깨지면 **어떤 사례의 판정이 바뀌었는지** 확인합니다.
3. 의도한 변화라면 `npm run golden:update`로 기대값을 갱신하고, `git diff tests/fixtures/golden.json`으로 바뀐 판정을 하나씩 검토합니다.
4. 절단점을 바꿨다면 `tests/rules.test.mjs`의 경계값 테스트도 함께 고칩니다.
5. 커밋 메시지에 근거 문헌(매뉴얼 쪽수 등)을 적습니다.

`golden.test.mjs`의 `INTENT` 표는 각 사례의 설계 의도(타당도 판정, 코드타입)를 따로 고정합니다. 골든셋을 잘못 갱신해도 여기서 한 번 더 걸러집니다.

### 사례를 추가할 때

`app/data-extra.js`(또는 새 데이터 파일)에 사례를 추가하면 `data.test.mjs`가 척도 이름, 점수 범위, 필수 필드, 모범 해석 7개 영역을 검사합니다. 그다음 `golden.test.mjs`의 `INTENT`에 의도를 적고 `npm run golden:update`를 실행합니다.

### 배포

프로그램은 claude.ai Artifact로 배포됩니다. `app/` 폴더의 파일을 그대로 올리며, 플랫폼이 HTML 뼈대(doctype, head)를 붙이므로 `index.html`에는 본문만 있습니다. AI 기능(코칭, 통합 해석, 슈퍼바이저)은 claude.ai 안에서 열었을 때만 동작합니다.

### 실험실 모형의 한계

`sim.js`의 응답 양식 모형은 교육용 단순화 모형입니다. 척도별 문항 수는 MMPI-2 공개 자료를 따랐지만 "그렇다" 채점 비율과 규준 평균·표준편차는 근사치이며, 실제 채점 키나 규준이 아닙니다. 점수의 정확한 값이 아니라 응답 양식에 따라 어떤 척도가 어느 방향으로 움직이는지를 보여 주는 것이 목적입니다. 재검사 시뮬레이션은 모든 척도의 SEM이 같고 오차가 독립이라고 가정합니다.

## 근거 문헌

Graham(2012), Greene(2011), Butcher 외(2001) MMPI-2 매뉴얼, Ben-Porath(2012), Friedman 외(2015), Butcher 외(1992) MMPI-A 매뉴얼, Archer(2017), Finn(2007), Jacobson·Truax(1991, RCI). 해석 기준은 이 문헌들을 요약·재서술한 것이며, 한국판 매뉴얼과 규준에 따라 다를 수 있습니다. 내용 검토는 Issues의 "내용 오류 신고"로 요청해 주세요.

MMPI-2와 MMPI-A는 미네소타 대학교의 등록상표이며, 이 프로젝트는 출판사와 관련이 없습니다.
