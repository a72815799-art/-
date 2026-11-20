#!/usr/bin/env bash
# 최종 검증 자료 ZIP 생성 → release/abnormal-psych-final.zip
set -euo pipefail
cd "$(dirname "$0")/.."
R=release/abnormal-psych-final; rm -rf release; mkdir -p "$R"
mkdir -p "$R/app" && cp app/dist/index.html "$R/app/" && cp -r app/dist/audio "$R/app/audio"
cp -r content questions screenshots voice-evidence reports "$R/"
mkdir -p "$R/tests" && cp -r tests/unit tests/e2e "$R/tests/" && mkdir -p "$R/tests/results" && cp tests/results/e2e-results.json tests/results/unit.tap tests/results/voice-quiz-transcript.json tests/results/tutor-local-answers.txt "$R/tests/results/"
[ -f tests/results/backup-sample.json ] && cp tests/results/backup-sample.json "$R/tests/results/backup-sample(test-data).json"
mkdir -p "$R/source" && cp -r app/src scripts SPEC.md package.json "$R/source/"
cp README.md "$R/README.md"
grep -rIl "sk-ant-[A-Za-z0-9]\{10,\}" "$R" && { echo "SECRET FOUND"; exit 1; } || true
(cd release && zip -qr abnormal-psych-final.zip abnormal-psych-final)
ls -la release/abnormal-psych-final.zip
