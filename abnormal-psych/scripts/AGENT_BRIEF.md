# 작업 공통 지침 (콘텐츠·문제 제작 담당)
목적: 권석만 『현대 이상심리학』(3판 추정)으로 기말고사(오픈북 객관식, 상담학 대학원)를 준비하는 학습자용 학습 데이터 제작.
시험 범위: 불안장애, 강박 및 관련 장애, 외상 및 스트레스 관련 장애, 성격장애. 교수는 교과서 중심 출제.
- 반드시 /home/user/-/abnormal-psych/SPEC.md 의 규격과 장애 ID를 따를 것.
- 교재 원문은 없다. 교재의 페이지·문장을 추측해 만들지 말 것. "교재에 따르면" 같은 단정 금지. textbook_compared는 항상 false.
- 권석만 교재에서 자주 다루는 것으로 널리 알려진 이론(예: Barlow 삼중취약성, Clark 공황 인지모형, Mowrer 2요인 이론, Salkovskis 사고억제/책임감, Rachman, Wegner 흰곰, Foa 정서처리, Horowitz, Ehlers-Clark, Brewin 이중표상, Kernberg, Kohut, Millon, Beck 성격장애 도식, Linehan DBT, Bowlby, Freud 등)을 충실히 다루되, 정신역동·행동·인지·생물학적 설명을 모두 포함.
- DSM-5 기준을 기본으로 하고 DSM-5-TR의 변경점(예: 지속성 비탄장애 신설, 일부 문구 변경)은 dsm_version_notes / 해설에서 구분. 권석만 3판은 DSM-5 기준으로 알려져 있음(미확인).
- DSM 진단 기준은 원문 전재 금지, 독자적 한국어로 재구성. 숫자(지속기간, 증상 개수, 연령)는 정확히.
- 출처 우선순위: 국가정신건강정보포털/국립정신건강센터, DSM-5-TR 공개자료(APA), MSD 매뉴얼 전문가판, NIMH, PubMed 논문(NCBI StatPearls 포함), 대학·학회 자료. 블로그·커뮤니티 금지.
- 핵심 수치/기준은 WebSearch(도구 있음; mode "standard")로 확인을 시도하라. 실제로 검색결과에서 내용을 확인한 경우에만 source_verified=true, verify_method="WebSearch 결과 요약 확인". 확인 못한 것은 false, "미확인(모델 지식)". 확인하지 않은 것을 확인했다고 쓰지 말 것. (curl 등 직접 접속은 차단됨)
- 모든 문장은 한국어, 전문용어는 처음에 영문 병기 가능. 음성 낭독에 적합하도록 괄호·기호 남발 금지.
- 결과 JSON은 Write 도구로 저장 후 `node /home/user/-/abnormal-psych/scripts/validate.mjs <파일>`로 검사하여 오류 0이 될 때까지 수정(동일 오류 수정 최대 3회).
- 다른 파일은 건드리지 말 것. 최종 보고: 작성 파일, 항목 수, 실제 검색 확인한 사실 목록과 확인 못한 것, 불확실하거나 교재와 다를 수 있는 점. 짧게.
