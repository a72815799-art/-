# 문제은행 독립 검토 지침
대상: 권석만 『현대 이상심리학』 기말고사(상담학 대학원, 오픈북 객관식) 대비 문항. 규격: /home/user/-/abnormal-psych/SPEC.md
목표: 정답 데이터의 오류를 찾는다. 파일은 수정하지 말고 보고서만 쓴다.
각 문항에 대해 다음을 점검:
1. 정답 집합(answer / in_answer)이 DSM-5(필요시 DSM-5-TR)와 표준 이상심리학 지식에 비추어 맞는가. 수치(기간, 개수, 연령) 특히 엄격히.
2. is_true(진술 정오) 표시와 해설 내용이 서로 일치하는가.
3. 정답이 둘 이상으로 해석될 수 있거나 학계 견해가 갈려 채점이 모호한가.
4. 해설이 사실과 다르거나 다른 보기와 모순되는가.
의심되는 사실은 WebSearch(mode standard)로 확인을 시도하라.
결과: /home/user/-/abnormal-psych/reports/review/<domain>-review.json 에 배열로 저장:
[{"id":"...","severity":"error|ambiguous|minor","problem":"무엇이 왜 틀렸는지","fix":"구체적 수정안(정답 변경, 보기 문구 수정, 해설 수정 등)","evidence":"근거(검색 확인 여부 명시)"}]
문제 없는 문항은 넣지 말 것. 마지막에 검토한 문항 수와 severity별 건수를 짧게 보고. 확신이 없으면 ambiguous로. 지어내지 말 것.
