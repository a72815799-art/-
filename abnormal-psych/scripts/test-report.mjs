// tests/results/*.json → reports/test-report.md (테스트 ID·대상·조건·환경·절차·기대·실제·상태·증거)
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const e2e = JSON.parse(fs.readFileSync(root + '/tests/results/e2e-results.json', 'utf8'));
const unit = fs.existsSync(root + '/tests/results/unit.tap') ? fs.readFileSync(root + '/tests/results/unit.tap', 'utf8') : '';
const M = {
  'UI-01': ['대시보드', 'PC 1366×900', '앱 열기', '대시보드 표시, 콘솔 오류 0', 'pc-01-dashboard.png'],
  'UI-02': ['11개 필수 화면', 'PC', '각 라우트로 이동해 제목 확인', '모든 화면 제목 표시·오류 0', ''],
  'CT-01': ['핵심 요약 학습실', 'PC', '4개 영역 요약 화면 열기', '영역별 장애 카드 전부 표시', 'pc-02-summary.png'],
  'CT-02': ['상세·심화 학습실', 'PC', '33개 단원 상세/심화 열기', '단원마다 15개 이상 항목, 심화 카드 표시', 'pc-03-study-detail.png'],
  'QZ-01': ['정답 비공개', '5단계 문제', '문제 열고 선택 전 상태 확인', '해설·결과 미표시, 제출 비활성', ''],
  'QZ-02': ['복수정답 채점·셔플', '보기 섞기 켬', '정답 1개만 선택→제출, 다시 풀기→정답 전체 선택→제출', '1차 부분일치=오답, 2차 정답, 이력 2건', 'pc-04-quiz-result.png'],
  'QZ-03': ['셔플 매핑 무결성', '전체 문항×3 시드', '셔플된 표시번호로 정답 선택 후 채점', '모두 정답 처리', ''],
  'QZ-04': ['오답노트·복습', '앞선 오답 존재', '오답노트 열기', '오답 카드·최초 선택·SRS 일정', 'pc-05-wrong-note.png'],
  'QZ-05': ['이력 보존', '풀이 후', '새로고침', '풀이 기록 수 동일', ''],
  'QZ-06': ['북마크·O/X', '1단계', '북마크 후 O/X 2문제 풀이', '북마크 저장, 채점', ''],
  'EX-01': ['모의고사·오픈북', '20문항', '5문항 답→자료검색→새로고침→제출', '답안 유지, 결과·기록 저장', 'pc-06-exam-openbook.png, pc-07-exam-result.png'],
  'ST-01': ['학습 통계', '풀이 기록 존재', '통계 열기', '영역·난이도 막대 표시', 'pc-08-stats.png'],
  'BK-01': ['JSON 백업·복원', '가짜 API 키 주입', '백업 받기, 잘못된 파일, 병합, 초기화 후 복원, 덮어쓰기', '키 미포함, 거부, 중복 제거, 복원', 'tests/results/backup-sample.json(로컬), pc-10-settings.png'],
  'VO-01': ['음성 문제풀이', '모의 TTS·STT', '명령 입력·모의 마이크로 출제→답→확인→채점→해설→비슷한 문제→오인식 취소', '확인 전 미기록, 정답 채점, 취소 시 미기록', 'voice-quiz-transcript.json, pc-09-voice-quiz.png'],
  'VO-02': ['연속 강의', '모의 TTS', '재생·일시정지·재개·다음·자동연속·속도·새로고침', '실제 콘텐츠 문장 낭독, 위치 복원', 'pc-11-voice-lecture.png'],
  'VO-04': ['오디오 파일 재생', '실제 MP3, Chromium', '오디오 재생 버튼', '<audio> 재생 진행, Media Session 메타데이터 설정', ''],
  'VO-03': ['운전 모드', '모의 TTS', '시작 1회 후 대기', '연속 낭독', 'pc-12-drive-mode.png'],
  'AI-01': ['API 미연결 도우미', 'AI 미설정', '질문 2개', '근거 기반 답변, 외부 요청 0', 'tutor-local-answers.txt, pc-13-tutor-local.png'],
  'AI-02': ['Claude 연동 모듈', '가짜 fetch(과금 없음)', '요청 생성·401·네트워크·한도·미설정', '요청 형식 정확, 오류 메시지', ''],
  'NET-01': ['오프라인', '네트워크 차단', '요약 화면 열기', '정상 표시', ''],
  'UI-03': ['다크 모드', '테마 dark', '새로고침', '어두운 배경', 'pc-14-dashboard-dark.png'],
  'MB-01': ['모바일 UI', 'Pixel 7 에뮬레이션', '17개 화면 검사', '가로 넘침·잘림 0, 터치 높이 ≥36px', 'm-*.png'],
  'MB-02': ['모바일 풀이', 'Pixel 7 에뮬레이션', '탭으로 선택·제출', '결과 표시', 'm-16-quiz-result.png'],
};
let md = '# 기능별 테스트 결과\n\n실행: ' + e2e.run_at + '\n\n환경: ' + e2e.env.browser + ' / ' + e2e.env.os + ' / Node ' + e2e.env.node + '\n\n> ' + e2e.env.note + '\n\n데이터: ' + e2e.data_counts.join(', ') + '\n\n';
md += '## 1. 단위 테스트 (Node test runner)\n\n```\n' + (unit.split('\n').filter(l => /^(ok|not ok|# (tests|pass|fail))/.test(l)).join('\n') || '(unit.tap 없음)') + '\n```\n\n';
md += '## 2. 브라우저 종단 테스트 (자동, 헤드리스)\n\n| ID | 대상 기능 | 조건 | 절차 | 기대 결과 | 실제 결과 | 상태 | 증거 |\n|---|---|---|---|---|---|---|---|\n';
for (const r of e2e.results) { const m = M[r.id] || [r.name, '', '', '', '']; md += `| ${r.id} | ${m[0]} | ${m[1]} | ${m[2]} | ${m[3]} | ${(r.evidence || r.error || '').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 300)} | ${r.status === 'pass' ? '성공(자동)' : r.status === 'skip' ? '미검증(건너뜀)' : '실패'} | ${m[4]} |\n`; }
md += '\n콘솔 오류(PC): ' + (e2e.console_errors_desktop.length ? e2e.console_errors_desktop.join(' / ') : '없음') + ' · (모바일): ' + (e2e.console_errors_mobile.length ? e2e.console_errors_mobile.join(' / ') : '없음') + '\n';
fs.writeFileSync(root + '/reports/test-report-auto.md', md); console.log('written', e2e.results.length, 'e2e rows');
