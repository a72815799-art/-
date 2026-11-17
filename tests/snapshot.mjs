// 사례 하나를 엔진에 넣고, 테스트로 고정할 핵심 판정만 뽑는다.
export function snapshot(app, c) {
  const r = app.MMPI.analyze(c.p, { setting: c.setting, sex: c.sex, version: c.version });
  return {
    title: c.title,
    intended: c.code,
    version: c.version === 'A' ? 'MMPI-A' : 'MMPI-2',
    validity: r.validity,
    code: r.code ? r.code.label : null,
    definition: r.code ? r.code.def : null,
    flags: [...r.flags].sort(),
  };
}
