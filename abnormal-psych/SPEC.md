# 데이터 규격 (Schema v1)

모든 파일은 UTF-8 JSON. 확인일(checked_date)은 "2026-11-20".

## 영역(domain) 및 장애 ID (고정 — 반드시 이 ID 사용)
- anxiety (불안장애): anxiety_overview, gad, specific_phobia, social_anxiety, panic, agoraphobia, separation_anxiety, selective_mutism
- ocd (강박 및 관련 장애): ocd_overview, ocd, bdd, hoarding, trichotillomania, excoriation
- trauma (외상 및 스트레스 관련 장애): trauma_overview, ptsd, asd, adjustment, rad, dsed, prolonged_grief
- personality (성격장애): pd_general, paranoid, schizoid, schizotypal, antisocial, borderline, histrionic, narcissistic, avoidant, dependent, ocpd, pd_alternative_model

## 출처 객체 (Source)
{
  "source_name": "MSD 매뉴얼 전문가판",          // 기관/문헌명
  "ref": "https://www.msdmanuals.com/...",       // URL 또는 서지
  "unit": "공황발작 및 공황장애",                // 관련 단원
  "basis": "공황장애 진단: 1개월 이상의 걱정 또는 행동 변화",  // 근거가 되는 내용(독자적 요약)
  "checked_date": "2026-11-20",
  "source_verified": false,   // 이 세션에서 실제 웹검색 결과/원문으로 해당 내용을 확인했을 때만 true
  "verify_method": "WebSearch 결과 요약 확인" | "원문 열람" | "미확인(모델 지식)",
  "textbook_compared": false  // 권석만 교재와 대조하지 못했으므로 항상 false
}

## content/<domain>.json
{
  "schema_version": 1,
  "domain": "anxiety",
  "title": "불안장애",
  "textbook_chapter_note": "권석만 『현대 이상심리학』 3판 기준 제4장으로 알려짐(판본·목차 미확인)",
  "overview": "영역 개관(여러 문단)",
  "disorders": [
    {
      "id": "panic", "name": "공황장애", "name_en": "Panic Disorder",
      "summary": "핵심 요약: 8~15문장. 빠른 복습용",
      "sections": {
        "definition": "...", "features": "...", "subtypes": "...", "core_symptoms": "...",
        "criteria": ["진단 기준 A ...", "B ..."],     // 독자적 문장으로 재구성. DSM 원문 전재 금지
        "duration": "...", "exceptions": "...",
        "etiology_development": "...", "biological": "...", "psychodynamic": "...", "cbt": "...",
        "theorists": [{"name": "D. M. Clark", "theory": "파국적 오해석 모형 ..."}],
        "maintenance": "...", "treatment": "...",
        "differential": [{"vs": "광장공포증", "point": "..."}],
        "case": {"title": "...", "text": "가상 사례", "discussion": "진단적 판단 해설"},
        "exam_points": ["..."], "confusions": ["..."]
      },
      "deep": "심화 이론: 이론 비교·감별·사례 적용 (여러 문단)",
      "dsm_version_notes": "DSM-IV / DSM-5 / DSM-5-TR 차이 (해당 시)",
      "sources": [Source, ...]
    }
  ],
  "comparison_tables": [{"title": "...", "headers": ["..."], "rows": [["..."]]}]
}
각 텍스트 필드는 음성 낭독에 적합하도록 2~6문장 단위 문단. 개관용 항목(anxiety_overview 등)은 sections 중 해당 없는 칸에 "해당 없음"이 아니라 영역 공통 내용(분류 변화, 공통 원인론 등)을 작성.

## questions/<domain>-<n>.json  — 배열 [Question, ...]
{
  "id": "ANX-L3-007",               // 영역약어(ANX/OCD/TRM/PD)-난이도-일련번호, 전체에서 고유
  "domain": "anxiety",
  "disorder": "panic",              // 위 장애 ID. 여러 장애를 비교하면 주된 하나 + "related": ["agoraphobia"]
  "related": [],
  "level": 1,                       // 1 O/X, 2 일반 객관식, 3 감별진단, 4 임상사례, 5 최상위 복수정답
  "type": "ox" | "single" | "multi",
  "polarity": "correct" | "incorrect",  // 옳은 것을 고르는가 / 옳지 않은(틀린) 것을 고르는가. ox는 "correct"
  "case": "사례 본문 (level 4, 일부 5)" | null,
  "stem": "질문 본문",
  "options": [
    {"key": "1", "text": "...", "is_true": true, "in_answer": true, "explanation": "왜 맞는지/틀린지 구체적 해설"}
  ],
  "answer": ["1"],                  // in_answer=true 인 key 목록과 정확히 일치
  "theory": "관련 이론/개념",
  "concept": "개념 태그(유사문제 묶음용, 예: '공황-지속기간')",
  "explanation": "문항 전체 해설",
  "sources": [Source, ...],
  "verification_status": "출처확인" | "자체검토(출처 미검증)",
  "textbook_compared": false
}
규칙:
- ox: options는 정확히 [{"key":"O",...},{"key":"X",...}], 정답 하나. is_true = in_answer. 각 해설에 진술이 왜 참/거짓인지.
- single/multi: options 정확히 5개, key "1"~"5".
- single: in_answer 정확히 1개. polarity=correct이면 정답 보기 is_true=true, 나머지 false. polarity=incorrect(옳지 않은 것은?)이면 정답 보기 is_true=false, 나머지 true.
- multi: stem에 "옳은 것을 모두 고르시오" 또는 "옳지 않은 것을 모두 고르시오" 명시. polarity=correct → in_answer = is_true, incorrect → in_answer = !is_true. 정답 개수 2~4개(0개·5개 금지).
- 사례형에서 is_true는 "해당 진술/판단이 사례에 비추어 적절한가".
- 같은 문제를 표현만 바꿔 반복 금지. 근거가 불확실한 사실로 문제 만들지 말 것.
- verification_status "출처확인"은 이 세션에서 WebSearch 등으로 핵심 사실을 실제 확인했을 때만.

## 검토 관련 선택 필드 (문항)
- "review_note": 독립 검토 후 수정된 문항에만 존재. 수정 내용 요약.
- "independent_review": 검토 상태 문자열(AI 독립 검토, 사람 전문가 검토 아님).
