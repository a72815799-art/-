/* 연구 근거: 문헌(REFS), 연구 쟁점(EVIDENCE), 사례 근거 노트(CASE_EVIDENCE), 영상 자료(VIDEOS, VIDEO_SCRIPTS).
   원칙
   - 서지 정보(저자, 연도, 제목, 학술지, 권(호), 쪽, DOI)는 Crossref 메타데이터와 PubMed 기록으로 대조했다.
   - 본문의 수치는 초록에서 확인한 것만 쓴다. 초록에서 확인하지 못한 수치는 쓰지 않는다.
   - 한국 문헌은 학회지 목록과 인용 논문으로 서지를 확인했고, 세부 수치는 원문 대조를 권한다(note에 표시).
   kind: meta 메타분석 / empirical 실증 연구 / manual 공식 매뉴얼 / book 해석서 / review 개관·논쟁 / korean 한국 자료 */
(function(){
const R = (short, apa, kind, doi, note) => ({short, apa, kind, doi: doi || '', note: note || ''});
window.REFS = {
  /* ── 매뉴얼과 해석서 ── */
  butcher1989: R('Butcher 외, 1989', 'Butcher, J. N., Dahlstrom, W. G., Graham, J. R., Tellegen, A., & Kaemmer, B. (1989). MMPI-2: Manual for administration and scoring. University of Minnesota Press.', 'manual', '', '규준 집단 2,600명(남 1,138, 여 1,462), 18~80세. 1990년 미국 인구조사와 대체로 맞지만 학력이 높다.'),
  butcher2001: R('Butcher 외, 2001', 'Butcher, J. N., Graham, J. R., Ben-Porath, Y. S., Tellegen, A., Dahlstrom, W. G., & Kaemmer, B. (2001). MMPI-2: Manual for administration, scoring, and interpretation (Rev. ed.). University of Minnesota Press.', 'manual', '', '개정 매뉴얼. 저자 순서가 1989년판과 다르다.'),
  butcher1992: R('Butcher 외, 1992', 'Butcher, J. N., Williams, C. L., Graham, J. R., Archer, R. P., Tellegen, A., Ben-Porath, Y. S., & Kaemmer, B. (1992). MMPI-A: Manual for administration, scoring, and interpretation. University of Minnesota Press.', 'manual', '', '478문항 청소년용의 원 매뉴얼(미국판 14~18세).'),
  benporath2008: R('Ben-Porath·Tellegen, 2008/2011', 'Ben-Porath, Y. S., & Tellegen, A. (2008/2011). MMPI-2-RF: Manual for administration, scoring, and interpretation. University of Minnesota Press.', 'manual', '', 'MMPI-2의 567문항 중 338문항, 51개 척도. 기술 매뉴얼(Tellegen & Ben-Porath, 2008/2011)은 별도 책이다.'),
  benporath2020: R('Ben-Porath·Tellegen, 2020', 'Ben-Porath, Y. S., & Tellegen, A. (2020). MMPI-3: Manual for administration, scoring, and interpretation. University of Minnesota Press.', 'manual', '', '335문항(새 문항 72, 고친 문항 24), 52개 척도, 규준 1,620명(남녀 각 810).'),
  archer2016rf: R('Archer 외, 2016', 'Archer, R. P., Handel, R. W., Ben-Porath, Y. S., & Tellegen, A. (2016). MMPI-A-RF: Administration, scoring, interpretation, and technical manual. University of Minnesota Press.', 'manual', '', '241문항, 48개 척도.'),
  tellegen2003: R('Tellegen 외, 2003', 'Tellegen, A., Ben-Porath, Y. S., McNulty, J. L., Arbisi, P. A., Graham, J. R., & Kaemmer, B. (2003). The MMPI-2 Restructured Clinical (RC) scales: Development, validation, and interpretation. University of Minnesota Press.', 'manual', '', 'RC 척도 개발 단행본. 의기소침(RCd)을 먼저 추출한 뒤 각 임상척도의 핵심을 남기는 방식.'),
  butcher1990: R('Butcher 외, 1990', 'Butcher, J. N., Graham, J. R., Williams, C. L., & Ben-Porath, Y. S. (1990). Development and use of the MMPI-2 content scales. University of Minnesota Press.', 'manual', '', '합리적·통계적 방법으로 만든 15개 내용척도.'),
  graham1999book: R('Graham 외, 1999', 'Graham, J. R., Ben-Porath, Y. S., & McNulty, J. L. (1999). MMPI-2 correlates for outpatient community mental health settings. University of Minnesota Press.', 'book', '', '외래 지역정신건강 장면의 경험적 상관물 표. 코드타입·척도별 기술의 주요 출처.'),
  graham2012: R('Graham, 2012', 'Graham, J. R. (2012). MMPI-2: Assessing personality and psychopathology (5th ed.). Oxford University Press.', 'book'),
  greene2011: R('Greene, 2011', 'Greene, R. L. (2011). The MMPI-2/MMPI-2-RF: An interpretive manual (3rd ed.). Pearson.', 'book'),
  friedman2015: R('Friedman 외, 2015', 'Friedman, A. F., Bolinskey, P. K., Levak, R. W., & Nichols, D. S. (2015). Psychological assessment with the MMPI-2/MMPI-2-RF (3rd ed.). Routledge.', 'book'),
  benporath2012: R('Ben-Porath, 2012', 'Ben-Porath, Y. S. (2012). Interpreting the MMPI-2-RF. University of Minnesota Press.', 'book'),
  archer2017: R('Archer, 2017', 'Archer, R. P. (2017). Assessing adolescent psychopathology: MMPI-A/MMPI-A-RF (4th ed.). Routledge.', 'book', '10.4324/9781315737010', '2016년 출간, 2017년 판권. 소장본의 표기에 맞춰 인용한다.'),

  /* ── 과대보고 ── */
  berry1991: R('Berry 외, 1991', 'Berry, D. T. R., Baer, R. A., & Harris, M. J. (1991). Detection of malingering on the MMPI: A meta-analysis. Clinical Psychology Review, 11(5), 585–598.', 'meta', '10.1016/0272-7358(91)90005-F'),
  rogers2003: R('Rogers 외, 2003', 'Rogers, R., Sewell, K. W., Martin, M. A., & Vitacco, M. J. (2003). Detection of feigned mental disorders: A meta-analysis of the MMPI-2 and malingering. Assessment, 10(2), 160–177.', 'meta', '10.1177/1073191103010002007'),
  arbisi1995: R('Arbisi·Ben-Porath, 1995', 'Arbisi, P. A., & Ben-Porath, Y. S. (1995). An MMPI-2 infrequent response scale for use with psychopathological populations: The Infrequency-Psychopathology Scale, F(p). Psychological Assessment, 7(4), 424–431.', 'empirical', '10.1037/1040-3590.7.4.424'),
  arbisi1998: R('Arbisi·Ben-Porath, 1998', 'Arbisi, P. A., & Ben-Porath, Y. S. (1998). The ability of Minnesota Multiphasic Personality Inventory–2 validity scales to detect fake-bad responses in psychiatric inpatients. Psychological Assessment, 10(3), 221–228.', 'empirical', '10.1037/1040-3590.10.3.221'),
  graham1991fake: R('Graham 외, 1991a', 'Graham, J. R., Watts, D., & Timbrook, R. E. (1991). Detecting fake-good and fake-bad MMPI-2 profiles. Journal of Personality Assessment, 57(2), 264–277.', 'empirical', '10.1207/s15327752jpa5702_6'),
  ingram2016: R('Ingram·Ternes, 2016', 'Ingram, P. B., & Ternes, M. S. (2016). The detection of content-based invalid responding: A meta-analysis of the MMPI-2-Restructured Form\'s (MMPI-2-RF) over-reporting validity scales. The Clinical Neuropsychologist, 30(4), 473–496.', 'meta', '10.1080/13854046.2016.1187769'),
  sharf2017: R('Sharf 외, 2017', 'Sharf, A. J., Rogers, R., Williams, M. M., & Henry, S. A. (2017). The effectiveness of the MMPI-2-RF in detecting feigned mental disorders and cognitive deficits: A meta-analysis. Journal of Psychopathology and Behavioral Assessment, 39(3), 441–455.', 'meta', '10.1007/s10862-017-9590-1'),
  aparcero2023: R('Aparcero 외, 2023', 'Aparcero, M., Picard, E. H., Nijdam-Jones, A., & Rosenfeld, B. (2023). Comparing the ability of MMPI-2 and MMPI-2-RF validity scales to detect feigning: A meta-analysis. Assessment, 30(3), 744–760.', 'meta', '10.1177/10731911211067535', '온라인 선공개 2022.'),

  /* ── 신체·인지 증상 과대보고와 FBS ── */
  leeshaley1991: R('Lees-Haley 외, 1991', 'Lees-Haley, P. R., English, L. T., & Glenn, W. J. (1991). A fake bad scale on the MMPI-2 for personal injury claimants. Psychological Reports, 68(1), 203–210.', 'empirical', '10.2466/pr0.1991.68.1.203'),
  nelson2006: R('Nelson 외, 2006', 'Nelson, N. W., Sweet, J. J., & Demakis, G. J. (2006). Meta-analysis of the MMPI-2 Fake Bad Scale: Utility in forensic practice. The Clinical Neuropsychologist, 20(1), 39–58.', 'meta', '10.1080/13854040500459322'),
  nelson2010: R('Nelson 외, 2010', 'Nelson, N. W., Hoelzle, J. B., Sweet, J. J., Arbisi, P. A., & Demakis, G. J. (2010). Updated meta-analysis of the MMPI-2 Symptom Validity Scale (FBS): Verified utility in forensic practice. The Clinical Neuropsychologist, 24(4), 701–724.', 'meta', '10.1080/13854040903482863'),
  butcher2003: R('Butcher 외, 2003', 'Butcher, J. N., Arbisi, P. A., Atlis, M. M., & McNulty, J. L. (2003). The construct validity of the Lees-Haley Fake Bad Scale: Does this scale measure somatic malingering and feigned emotional distress? Archives of Clinical Neuropsychology, 18(5), 473–485.', 'review', '10.1093/arclin/18.5.473', '학술지가 표 1에 MMPI-2 문항을 실은 저작권 문제로 철회 표시 후 2008년 같은 학술지 23(7–8)에 다시 실었다. 자료 자체의 문제는 아니라고 밝혔다.'),
  butcher2008: R('Butcher 외, 2008', 'Butcher, J. N., Gass, C. S., Cumella, E., Kally, Z., & Williams, C. L. (2008). Potential for bias in MMPI-2 assessments using the Fake Bad Scale (FBS). Psychological Injury and Law, 1(3), 191–209.', 'review', '10.1007/s12207-007-9002-z'),
  benporath2009: R('Ben-Porath 외, 2009', 'Ben-Porath, Y. S., Greve, K. W., Bianchini, K. J., & Kaufmann, P. M. (2009). The MMPI-2 Symptom Validity Scale (FBS) is an empirically validated measure of overreporting in personal injury litigants and claimants: Reply to Butcher et al. (2008). Psychological Injury and Law, 2(1), 62–85.', 'review', '10.1007/s12207-009-9037-4'),
  williams2009: R('Williams 외, 2009', 'Williams, C. L., Butcher, J. N., Gass, C. S., Cumella, E., & Kally, Z. (2009). Inaccuracies about the MMPI-2 Fake Bad Scale in the reply by Ben-Porath, Greve, Bianchini, and Kaufman (2009). Psychological Injury and Law, 2(2), 182–197.', 'review', '10.1007/s12207-009-9046-3'),
  gass2010: R('Gass 외, 2010', 'Gass, C. S., Williams, C. L., Cumella, E., Butcher, J. N., & Kally, Z. (2010). Ambiguous measures of unknown constructs: The MMPI-2 Fake Bad Scale (aka Symptom Validity Scale, FBS, FBS-r). Psychological Injury and Law, 3(1), 81–85.', 'review', '10.1007/s12207-009-9063-2'),
  gervais2007: R('Gervais 외, 2007', 'Gervais, R. O., Ben-Porath, Y. S., Wygant, D. B., & Green, P. (2007). Development and validation of a Response Bias Scale (RBS) for the MMPI-2. Assessment, 14(2), 196–208.', 'empirical', '10.1177/1073191106295861'),
  wygant2010: R('Wygant 외, 2010', 'Wygant, D. B., Sellbom, M., Gervais, R. O., Ben-Porath, Y. S., Stafford, K. P., Freeman, D. B., & Heilbronner, R. L. (2010). Further validation of the MMPI-2 and MMPI-2-RF Response Bias Scale: Findings from disability and criminal forensic settings. Psychological Assessment, 22(4), 745–756.', 'empirical', '10.1037/a0020042'),

  /* ── 과소보고 ── */
  baer1992: R('Baer 외, 1992', 'Baer, R. A., Wetter, M. W., & Berry, D. T. R. (1992). Detection of underreporting of psychopathology on the MMPI: A meta-analysis. Clinical Psychology Review, 12(5), 509–525.', 'meta', '10.1016/0272-7358(92)90069-K'),
  baer2002: R('Baer·Miller, 2002', 'Baer, R. A., & Miller, J. (2002). Underreporting of psychopathology on the MMPI-2: A meta-analytic review. Psychological Assessment, 14(1), 16–26.', 'meta', '10.1037/1040-3590.14.1.16'),
  picard2023: R('Picard 외, 2023', 'Picard, E. H., Aparcero, M., Nijdam-Jones, A., & Rosenfeld, B. (2023). Identifying positive impression management using the MMPI-2 and the MMPI-2-RF: A meta-analysis. The Clinical Neuropsychologist, 37(3), 545–561.', 'meta', '10.1080/13854046.2022.2077237', '온라인 선공개 2022.'),
  bathurst1997: R('Bathurst 외, 1997', 'Bathurst, K., Gottfried, A. W., & Gottfried, A. E. (1997). Normative data for the MMPI-2 in child custody litigation. Psychological Assessment, 9(3), 205–211.', 'empirical', '10.1037/1040-3590.9.3.205'),

  /* ── 비내용 반응 ── */
  berry1991r: R('Berry 외, 1991b', 'Berry, D. T. R., Wetter, M. W., Baer, R. A., Widiger, T. A., Sumpter, J. C., Reynolds, S. K., & Hallam, R. A. (1991). Detection of random responding on the MMPI-2: Utility of F, back F, and VRIN scales. Psychological Assessment, 3(3), 418–423.', 'empirical', '10.1037/1040-3590.3.3.418'),
  handel2010: R('Handel 외, 2010', 'Handel, R. W., Ben-Porath, Y. S., Tellegen, A., & Archer, R. P. (2010). Psychometric functioning of the MMPI-2-RF VRIN-r and TRIN-r scales with varying degrees of randomness, acquiescence, and counter-acquiescence. Psychological Assessment, 22(1), 87–95.', 'empirical', '10.1037/a0017061'),
  baer1997: R('Baer 외, 1997', 'Baer, R. A., Ballenger, J. F., Berry, D. T. R., & Wetter, M. W. (1997). Detection of random responding on the MMPI-A. Journal of Personality Assessment, 68(1), 139–151.', 'empirical', '10.1207/s15327752jpa6801_11'),
  baer1998: R('Baer 외, 1998', 'Baer, R. A., Ballenger, J. F., & Kroll, L. S. (1998). Detection of underreporting on the MMPI-A in clinical and community samples. Journal of Personality Assessment, 71(1), 98–113.', 'empirical', '10.1207/s15327752jpa7101_7'),

  /* ── 코드타입과 측정 ── */
  graham1986: R('Graham 외, 1986', 'Graham, J. R., Smith, R. L., & Schwartz, G. F. (1986). Stability of MMPI configurations for psychiatric inpatients. Journal of Consulting and Clinical Psychology, 54(3), 375–380.', 'empirical', '10.1037/0022-006X.54.3.375', '저자 순서는 Crossref 기록을 따랐다.'),
  graham1991cong: R('Graham 외, 1991b', 'Graham, J. R., Timbrook, R. E., Ben-Porath, Y. S., & Butcher, J. N. (1991). Code-type congruence between MMPI and MMPI-2: Separating fact from artifact. Journal of Personality Assessment, 57(2), 205–215.', 'empirical', '10.1207/s15327752jpa5702_2'),
  tellegen1992: R('Tellegen·Ben-Porath, 1992', 'Tellegen, A., & Ben-Porath, Y. S. (1992). The new uniform T scores for the MMPI-2: Rationale, derivation, and appraisal. Psychological Assessment, 4(2), 145–155.', 'empirical', '10.1037/1040-3590.4.2.145'),
  mcnulty1998: R('McNulty 외, 1998', 'McNulty, J. L., Ben-Porath, Y. S., & Graham, J. R. (1998). An empirical examination of the correlates of well-defined and not defined MMPI-2 codetypes. Journal of Personality Assessment, 71(3), 393–410.', 'empirical', '10.1207/s15327752jpa7103_8'),
  munley1991: R('Munley, 1991', 'Munley, P. H. (1991). Confidence intervals for the MMPI-2. Journal of Personality Assessment, 57(1), 52–60.', 'empirical', '10.1207/s15327752jpa5701_8'),
  munley2004: R('Munley 외, 2004', 'Munley, P. H., Germain, J. M., Tovar-Murray, D., & Borgman, A. L. (2004). MMPI-2 profile code types and measurement error. Journal of Personality Assessment, 82(2), 179–188.', 'empirical', '10.1207/s15327752jpa8202_6'),
  mcgrath1999a: R('McGrath·Ingersoll, 1999a', 'McGrath, R. E., & Ingersoll, J. (1999a). Writing a good cookbook: I. A review of MMPI high-point code system studies. Journal of Personality Assessment, 73(2), 149–178.', 'review', '10.1207/s15327752jpa7302_1'),
  mcgrath1999b: R('McGrath·Ingersoll, 1999b', 'McGrath, R. E., & Ingersoll, J. (1999b). Writing a good cookbook: II. A synthesis of MMPI high-point code system study effect sizes. Journal of Personality Assessment, 73(2), 179–198.', 'meta', '10.1207/s15327752jpa7302_2'),

  /* ── RC, 내용, PSY-5 ── */
  simms2005: R('Simms 외, 2005', 'Simms, L. J., Casillas, A., Clark, L. A., Watson, D., & Doebbeling, B. N. (2005). Psychometric evaluation of the restructured clinical scales of the MMPI-2. Psychological Assessment, 17(3), 345–358.', 'empirical', '10.1037/1040-3590.17.3.345'),
  sellbom2006: R('Sellbom 외, 2006', 'Sellbom, M., Ben-Porath, Y. S., & Graham, J. R. (2006). Correlates of the MMPI-2 Restructured Clinical (RC) scales in a college counseling setting. Journal of Personality Assessment, 86(1), 88–99.', 'empirical', '10.1207/s15327752jpa8601_10'),
  nichols2006: R('Nichols, 2006', 'Nichols, D. S. (2006). The trials of separating bath water from baby: A review and critique of the MMPI-2 Restructured Clinical scales. Journal of Personality Assessment, 87(2), 121–138.', 'review', '10.1207/s15327752jpa8702_02'),
  rogers2006: R('Rogers 외, 2006', 'Rogers, R., Sewell, K. W., Harrison, K. S., & Jordan, M. J. (2006). The MMPI-2 Restructured Clinical scales: A paradigmatic shift in scale development. Journal of Personality Assessment, 87(2), 139–147.', 'review', '10.1207/s15327752jpa8702_03'),
  tellegen2006: R('Tellegen 외, 2006', 'Tellegen, A., Ben-Porath, Y. S., Sellbom, M., Arbisi, P. A., McNulty, J. L., & Graham, J. R. (2006). Further evidence on the validity of the MMPI-2 Restructured Clinical (RC) scales: Addressing questions raised by Rogers, Sewell, Harrison, and Jordan and Nichols. Journal of Personality Assessment, 87(2), 148–171.', 'review', '10.1207/s15327752jpa8702_04'),
  harkness1995: R('Harkness 외, 1995', 'Harkness, A. R., McNulty, J. L., & Ben-Porath, Y. S. (1995). The Personality Psychopathology Five (PSY-5): Constructs and MMPI-2 scales. Psychological Assessment, 7(1), 104–114.', 'empirical', '10.1037/1040-3590.7.1.104'),
  benporath1991: R('Ben-Porath 외, 1991', 'Ben-Porath, Y. S., Butcher, J. N., & Graham, J. R. (1991). Contribution of the MMPI-2 content scales to the differential diagnosis of schizophrenia and major depression. Psychological Assessment, 3(4), 634–640.', 'empirical', '10.1037/1040-3590.3.4.634'),
  benporath1993: R('Ben-Porath 외, 1993', 'Ben-Porath, Y. S., McCully, E., & Almagor, M. (1993). Incremental validity of the MMPI-2 content scales in the assessment of personality and psychopathology by self-report. Journal of Personality Assessment, 61(3), 557–575.', 'empirical', '10.1207/s15327752jpa6103_12'),

  /* ── 청소년 ── */
  fontaine2001: R('Fontaine 외, 2001', 'Fontaine, J. L., Archer, R. P., Elkins, D. E., & Johansen, J. (2001). The effects of MMPI-A T-score elevation on classification accuracy for normal and clinical adolescent samples. Journal of Personality Assessment, 76(2), 264–281.', 'empirical', '10.1207/S15327752JPA7602_09'),
  archer2001: R('Archer 외, 2001', 'Archer, R. P., Handel, R. W., & Lynch, K. D. (2001). The effectiveness of MMPI-A items in discriminating between normative and clinical samples. Journal of Personality Assessment, 77(3), 420–435.', 'empirical', '10.1207/S15327752JPA7703_04'),
  janus1996: R('Janus 외, 1996', 'Janus, M.-D., Tolbert, H., Calestro, K., & Toepfer, S. (1996). Clinical accuracy ratings of MMPI approaches for adolescents: Adding ten years and the MMPI-A. Journal of Personality Assessment, 67(2), 364–383.', 'empirical', '10.1207/s15327752jpa6702_11'),
  stokes2018: R('Stokes 외, 2018', 'Stokes, J., Pogge, D. L., & Archer, R. P. (2018). Comparisons between the Minnesota Multiphasic Personality Inventory–Adolescent–Restructured Form (MMPI-A-RF) and MMPI-A in adolescent psychiatric inpatients. Psychological Assessment, 30(3), 370–382.', 'empirical', '10.1037/pas0000488', '온라인 선공개 2017.'),

  /* ── 문화와 한국 자료 ── */
  hall1999: R('Hall 외, 1999', 'Hall, G. C. N., Bansal, A., & Lopez, I. R. (1999). Ethnicity and psychopathology: A meta-analytic review of 31 years of comparative MMPI/MMPI-2 research. Psychological Assessment, 11(2), 186–197.', 'meta', '10.1037/1040-3590.11.2.186', '비교 대상은 미국 내 아프리카계·라틴계와 유럽계 집단이다. 아시아계 비교는 거의 포함되지 않았다.'),
  han1996: R('Han, 1996', 'Han, K. (1996). The Korean MMPI-2. In J. N. Butcher (Ed.), International adaptations of the MMPI-2: Research and clinical applications (pp. 88–136). University of Minnesota Press.', 'korean', '', '한국판 번안과 등가성 평가를 영어로 소개한 대표 문헌(저자의 1993년 미네소타대 박사논문에 기초).'),
  kim2005: R('김중술 외, 2005', '김중술, 한경희, 임지영, 이정흠, 민병배, 문경주 (2005). 다면적 인성검사 II 매뉴얼. 마음사랑.', 'korean', '', '서지는 인용 논문들로 확인. 개정판 여부와 규준 표본 크기는 매뉴얼 원본으로 확인하세요.'),
  kim2005a: R('김중술 외, 2005b', '김중술, 한경희, 임지영, 민병배, 이정흠, 문경주 (2005). 다면적 인성검사-청소년용 매뉴얼. 마음사랑.', 'korean', '', '서지는 인용 논문들로 확인(일부 논문은 2006으로 표기). 원본 대조를 권합니다.'),
  han2006: R('한경희 외, 2006', '한경희, 임지영, 민병배, 이정흠, 문경주, 김중술 (2006). 한국판 MMPI-2의 개발 연구. 한국심리학회지: 임상, 25(2), 533–564.', 'korean', '', '2000년 인구센서스 기준 규준. 초록 요지: 미국 규준으로 채점하면 한국인 평균이 평균 약 1 표준편차 높게 나온다.'),
  lim2006: R('임지영 외, 2006', '임지영, 한경희, 민병배, 이정흠, 문경주, 김중술 (2006). 한국판 MMPI-A의 개발 연구. 한국심리학회지: 임상, 25(2), 565–586.', 'korean', '', '초록 요지: 한국 청소년의 평균 T점수는 미국 청소년 평균에서 1 표준편차 이내였다(성인보다 문화 차이가 작다).'),
  han2002: R('한경희 외, 2002', '한경희, 임지영, 한정원 (2002). 한국판 MMPI-2의 임상적 유용성. 한국심리학회지: 임상, 21(4), 827–842.', 'korean', '', '한국 규준이 나오기 전, 미국 규준으로 채점했을 때의 문제를 보여 준 예비 연구.'),
  hwang2010: R('황순택 외, 2010', '황순택, 조혜선, 남지숙 (2010). MMPI와 MMPI-2 프로파일 비교. 한국심리학회지: 임상, 29(2), 525–539.', 'korean', '', '대학생 156명이 1주 간격으로 두 검사를 받음. 상승 척도 1개 코드 일치 36.5%, 2개 코드 일치 19.2%(초록).'),
  lee2011: R('이승연·장은영, 2011', '이승연, 장은영 (2011). MMPI-2 재구성임상척도의 타당도 연구: 정신과 내원 환자들을 대상으로. 한국심리학회지: 임상, 30(4), 871–.', 'korean', '', '정신과 환자 121명. 끝 쪽수는 원문으로 확인하세요.'),
};

/* 연구 쟁점. findings: [문장, [문헌 id]] / numbers: [지표, 수치, 의미, [문헌 id]] / myths: [오해, 연구 결과]
   links: scales(MMPI-2 척도 id), scalesA(MMPI-A 척도 id), modules, cases */
window.EVIDENCE = [
{
  id:'ev-overreport', area:'타당도와 반응 왜곡', title:'정신과 증상 과대보고: F, F(B), F(P)는 각각 무엇을 잡는가',
  q:'F가 높을 때 “실제로 심하게 아픈 사람”과 “아픈 척하는 사람”을 무엇으로 가르는가?',
  why:'법정·보상 장면에서 과대보고 판단은 사람의 법적 지위와 금전을 바꾼다. 반대로 입원 환자에게 F가 높다고 “과장”이라 쓰면 실제 중증 정신병리를 놓치고 신뢰 관계도 깨진다. 같은 F 상승이 장면에 따라 정반대 의미가 되기 때문에, 어느 척도가 어떤 비교에서 강한지를 연구로 알고 있어야 한다.',
  findings:[
    ['F 척도 계열의 탐지력은 원판 MMPI 시절부터 메타분석으로 검토되었고, 대체로 큰 효과크기를 보였다. MMPI-2 연구는 이 전통 위에서 척도별 차이를 따지는 방향으로 발전했다.', ['berry1991']],
    ['MMPI-2 가장 연구 65편과 진단 연구 11편을 묶은 메타분석에서, 정신과 환자도 드물게 답하는 문항으로 만든 F(P)가 진단 집단 전반에서 특히 효과적이었다(Cohen\'s d = 2.02). 절단점도 다른 지표보다 일관되었다. F는 효과적이었지만 F(B)를 일상적으로 쓰는 것에는 의문을 제기했다.', ['rogers2003']],
    ['F(P)는 정상인과 정신과 환자 모두 드물게 답하는 27문항으로 만들어, 정신병리 기저율이 높은 장면에서 F를 보완하도록 설계되었다.', ['arbisi1995']],
    ['정신과 입원 환자를 대상으로 한 후속 연구에서도 F(P)가 F보다 가장 응답을 더 잘 가려냈다. 입원 장면에서 F 상승은 실제 병리를 반영할 수 있으므로 F(P)를 먼저 확인해야 한다는 근거다.', ['arbisi1998']],
    ['대학생과 정신과 환자에게 정직 응답과 가장 응답을 지시한 연구에서, 가장 응답은 정확히 가려졌지만 최적 절단점은 대학생과 환자 집단에서 달랐다. 절단점이 장면에 따라 달라야 한다는 고전적 근거다.', ['graham1991fake']],
    ['MMPI-2-RF 과대보고 척도 25편 메타분석에서 척도별 효과크기는 1.08(FBS-r)부터 1.43(Fp-r)까지였다. 저자들은 정직 집단과 가장 집단의 실제 점수 차이가 전통적 절단점이 시사하는 것보다 훨씬 좁다고 지적했다.', ['ingram2016']],
    ['MMPI-2-RF 30편 메타분석에서 Fp-r은 가장된 정신병리와 실제 정신병리를 효과적으로 구별했고(d > .90), 인지 결함 가장에는 FBS-r의 효과가 컸다(M d = 1.41).', ['sharf2017']],
    ['MMPI-2 109편과 MMPI-2-RF 41편을 비교한 최신 메타분석에서, 연구 설계와 가장한 증상 종류를 통제하면 두 판의 차이는 유의하지 않았다. 정신과 증상 가장에는 F와 Fp-r이, 신체 증상 과장에는 FBS와 RBS가 가장 큰 효과를 보였다.', ['aparcero2023']],
  ],
  numbers:[
    ['F(P) 효과크기', 'd = 2.02', '정신과 증상 가장 탐지, 진단 집단 전반', ['rogers2003']],
    ['MMPI-2-RF 과대보고 척도', 'd = 1.08 ~ 1.43', 'FBS-r이 가장 작고 Fp-r이 가장 큼', ['ingram2016']],
    ['Fp-r: 가장 대 실제 정신병리', 'd > .90', '실제 환자와 비교해도 효과가 유지됨', ['sharf2017']],
    ['FBS-r: 인지 결함 가장', 'M d = 1.41', '인지·신경심리 장면에서 강함', ['sharf2017']],
    ['메타분석 연구 수', 'MMPI-2 109편, RF 41편', '이 중 56.46%는 이전 메타분석에 없던 연구', ['aparcero2023']],
  ],
  practice:[
    'F가 높으면 먼저 VRIN·TRIN으로 비내용 반응을 배제하고, 그다음 F(P)를 본다. F는 높지만 F(P)가 평균 범위라면 “고통을 솔직히 보고한 실제 병리”가 첫 가설이다.',
    '장면의 기저율을 적는다. 입원 병동의 F 80과 인사 선발의 F 80은 의미가 다르다. 절단점은 연구된 집단이 내 내담자와 비슷할 때만 그대로 쓴다.',
    '“증상을 가장했다(malingering)”는 의도에 대한 판단이므로 MMPI만으로 결론 내리지 않는다. 보고서에는 “과대보고 가능성이 높아 임상척도 해석을 유보한다”처럼 검사가 말할 수 있는 범위까지만 쓴다.',
    '가장한 증상의 종류를 구분한다. 정신과 증상(환청, 편집 사고 등)은 F·F(P), 신체·인지 증상은 FBS·RBS가 더 민감하다.',
  ],
  myths:[
    ['F가 높으면 꾀병이다.', 'F는 실제 중증 정신병리, 극심한 고통, 도움 요청에서도 오른다. 정신과 장면에서는 F(P)가 실제 병리와 가장을 더 잘 가른다.'],
    ['F(B)는 F와 같은 정도로 믿을 수 있다.', '메타분석은 F(B)의 일상적 사용에 의문을 제기했다. 후반부 문항의 응답 태도 변화를 보는 보조 지표로 쓴다.'],
    ['MMPI-2-RF 타당도 척도는 MMPI-2보다 약하다.', '설계와 증상 유형을 통제하면 두 판의 효과는 유의하게 다르지 않았다.'],
  ],
  debate:'메타분석의 효과크기는 대부분 “지시받은 대학생 가장 집단”과 “정직한 환자 집단”을 비교한 연구에서 나온다. 실제 소송인처럼 동기가 강하고 증상 정보를 미리 공부한 사람에게는 효과가 줄어들 수 있다. 또 효과크기가 크다는 것과 개별 사례에서 절단점이 맞는다는 것은 다른 문제다. 연구된 집단과 기저율이 다르면 같은 절단점의 오분류율이 크게 달라진다.',
  korea:'국내 법정 장면의 MMPI-2 과대보고 연구는 아직 많지 않다. 외국 연구의 원점수·T점수 절단점을 한국 규준 점수에 그대로 옮기면 안 된다. 규준이 다르면 같은 T점수가 같은 원점수를 뜻하지 않는다. 한국 규준의 T점수로 판단하되, 절단점은 “참고 범위”로만 쓰고 면담, 기록, 수행 타당도 검사와 함께 판단하는 것이 안전하다.',
  seminar:[
    '입원 환자의 F 90, F(P) 55 프로파일을 보고서에 어떻게 기술하겠는가? “과대보고”라는 단어를 쓸 수 있는가?',
    '메타분석의 효과크기 d = 2.02는 개별 내담자의 판단에 어떤 정보를 주고, 어떤 정보를 주지 못하는가?',
    '같은 F 상승이 법정 장면과 입원 장면에서 다르게 해석되어야 하는 이유를 기저율과 오분류 비용의 관점에서 설명하라.',
  ],
  links:{scales:['F','Fb','Fp','VRIN','TRIN'], scalesA:['F','F1','F2'], modules:['m03','m10'], cases:['c04','c05','c10','c18']},
},
{
  id:'ev-fbs', area:'타당도와 반응 왜곡', title:'신체·인지 증상 과대보고와 FBS 논쟁',
  q:'FBS가 높으면 과장인가, 아니면 실제로 아픈 사람의 신체 호소인가?',
  why:'산재·교통사고·장해 평가처럼 신체와 인지 증상이 쟁점인 장면에서 FBS는 거의 항상 계산된다. 그런데 이 척도는 개발 직후부터 “실제 환자, 특히 여성과 외상 경험자에게 거짓 양성이 많다”는 비판을 받았다. 수련생이 한쪽 주장만 알면 법정에서 쉽게 반박당한다.',
  findings:[
    ['FBS는 개인 상해 소송인의 자료를 바탕으로 합리적으로 문항을 골라 만든 척도로, 신체·정서 증상을 과장하는 소송 장면의 반응을 잡기 위해 제안되었다.', ['leeshaley1991']],
    ['19편(과대보고 1,615명, 비교 2,049명)을 묶은 메타분석에서 전체 효과크기는 FBS .96, O-S .88, Dsr2 .79, F-K .69, F .63 순으로, 신경심리·법정 장면에서는 FBS가 F 계열 이상의 변별력을 보였다. 인지적 노력 부족이 큰 조절 변인이었다.', ['nelson2006']],
    ['갱신된 메타분석(32편, 과대보고 2,218명, 비교 3,123명)에서도 FBS의 효과가 컸고, 노력이 부족한 것이 확인된 경우와 외상성 뇌손상 평가 장면에서 F 계열보다 효과가 더 컸다.', ['nelson2010']],
    ['비판 측은 여러 장면의 자료로 FBS가 꾀병보다는 일반적 부적응과 신체 호소를 측정하며, 특히 정신과 장면에서 거짓 양성이 받아들일 수 없을 만큼 많다고 주장했다. 이 논문은 문항 저작권 문제로 철회 표시 후 재게재되었다.', ['butcher2003', 'butcher2008']],
    ['지지 측은 소송인과 청구인 연구를 근거로 FBS가 경험적으로 타당화된 과대보고 척도라고 반박했고, 비판 측이 재반박하며 논쟁이 이어졌다.', ['benporath2009', 'williams2009', 'gass2010']],
    ['RBS는 수행 타당도 검사(WMT, CARB, TOMM)를 통과한 집단과 실패한 집단을 가르는 28문항으로 만들어, 인지적 반응 편향과 관련된 증상 호소를 잡도록 설계되었다.', ['gervais2007']],
    ['장해 청구인과 형사 피고인 표본에서 RBS는 인지적 반응 편향 탐지에 큰 효과(d = 1.24, 1.48)를 보였고, 기존 MMPI-2·RF 과대보고 척도에 더해 증분 예측력을 보였다.', ['wygant2010']],
  ],
  numbers:[
    ['FBS 전체 효과크기(2006)', '.96', '같은 분석에서 F는 .63', ['nelson2006']],
    ['갱신 메타분석 표본', '과대보고 2,218명 · 비교 3,123명', '32편', ['nelson2010']],
    ['RBS 효과크기', 'd = 1.24(장해), 1.48(형사)', '인지적 반응 편향 탐지', ['wygant2010']],
    ['신체 증상 과장 탐지', 'FBS·RBS가 가장 큼', '정신과 증상 가장은 F·Fp-r이 큼', ['aparcero2023']],
  ],
  practice:[
    'FBS 상승은 “신체·인지 증상을 실제보다 크게 보고했을 가능성”을 뜻한다. 정신과 증상 가장의 지표로 쓰지 않는다.',
    '진짜 신체 질환자(만성 통증, 수술 후, 섬유근통 등)는 신체 문항에 많이 답하므로 FBS가 오를 수 있다. 의무기록과 객관적 소견을 반드시 함께 본다.',
    '인지 증상이 쟁점이면 FBS·RBS만으로 결론 내리지 말고 수행 타당도 검사(PVT) 결과와 함께 본다. 노력 부족이 확인되면 FBS 해석의 확신이 커진다.',
    '보고서에서 이 논쟁을 숨기지 않는다. 법정에서는 “이 척도의 거짓 양성 논쟁을 알고 있으며 그래서 다른 자료와 수렴하는지를 확인했다”는 문장이 평가자의 신뢰를 높인다.',
  ],
  myths:[
    ['FBS는 “가짜 나쁜 척”이니 높으면 거짓말이다.', '척도 이름과 달리 측정 내용은 신체·인지 증상 보고다. 이후 Symptom Validity Scale로 이름이 바뀌었고, 의도 판단은 다른 자료가 필요하다.'],
    ['논쟁이 있으니 FBS는 쓰면 안 된다.', '메타분석은 법정·신경심리 장면의 유용성을 지지한다. 쟁점은 “쓸 것인가”보다 “어떤 장면에서, 무엇과 함께, 얼마나 확신하며 쓸 것인가”다.'],
  ],
  debate:'논쟁의 핵심은 거짓 양성이다. 실제로 아픈 사람, 특히 외상 경험이 있거나 신체 질환이 있는 사람의 FBS가 얼마나 자주 절단점을 넘는가에 대해 양측의 자료 해석이 엇갈린다. 메타분석은 “과대보고 집단과 비교 집단의 평균 차이”를 보여 주지만, 특정 질환군에서의 거짓 양성률은 그 질환군을 직접 연구한 자료로 확인해야 한다.',
  korea:'국내 신체·인지 과대보고 연구는 드물다. 한국 산재·교통사고 장면의 기저율 자료가 없으므로, FBS는 단독 판단이 아닌 “추가 확인이 필요하다는 신호”로 쓰는 것이 보수적이다.',
  seminar:[
    '수술 후 만성 통증 환자의 FBS 72, F(P) 46 프로파일을 어떻게 해석하겠는가? 무엇을 더 확인해야 하는가?',
    'Butcher 측과 Ben-Porath 측의 주장 중 어느 쪽이 더 설득력 있는가? 판단 기준을 먼저 정하고 토론하라.',
    '법정에서 “FBS는 여성에게 편향되어 있지 않습니까?”라는 반대신문을 받았다. 어떻게 답하겠는가?',
  ],
  links:{scales:['FBS','F','Fp'], modules:['m03','m10'], cases:['c05','c02','c12']},
},
{
  id:'ev-underreport', area:'타당도와 반응 왜곡', title:'과소보고와 방어: L, K, S와 양육권·인사 장면',
  q:'L·K가 높으면 “숨겼다”고 말할 수 있는가? 양육권 소송 부모의 방어는 어디까지 정상인가?',
  why:'양육권 평가와 인사 선발에서는 거의 모든 수검자가 좋게 보이려 한다. 방어를 무조건 “해석 불가”로 처리하면 평가가 성립하지 않고, 반대로 무시하면 낮은 임상척도를 “건강하다”로 잘못 읽는다. 장면별 기대 수준을 알아야 한다.',
  findings:[
    ['원판 MMPI의 과소보고 연구 25편 메타분석에서 정직 집단과 과소보고 집단의 평균 효과크기는 1.05였다.', ['baer1992']],
    ['MMPI-2 과소보고 메타분석에서 전통적·보조적 지표의 평균 효과크기는 1.25로, 과소보고 집단은 정직 집단과 평균 1 표준편차가 조금 넘게 달랐다. 여러 척도가 중간 정도로 효과적이었지만, 타당도 척도에 대해 코칭을 받으면 정확도가 떨어졌다.', ['baer2002']],
    ['좋은 인상 관리(PIM) 27편 메타분석에서 MMPI-2 L의 효과가 가장 컸고(g = 1.30), S(g = 1.23), K(g = 1.01), RF의 L-r(g = 1.16), K-r(g = 1.21)도 중간 이상의 효과를 보였다. 두 판의 차이는 유의하지 않았다. 저자들은 방어와 관련된 상승 폭이 크지 않으므로 T점수를 보수적으로 해석하라고 권했다.', ['picard2023']],
    ['양육권 소송 부모 508명의 MMPI-2 규준 자료에서 방어적 과소보고와 자기 호의적 응답이 흔했고, 임상척도의 임상 범위 상승은 일반적이지 않았다.', ['bathurst1997']],
    ['청소년에서도 L과 K는 임상·지역사회 표본 모두에서 과소보고 탐지에 계속 쓸 수 있다는 결과가 나왔다.', ['baer1998']],
  ],
  numbers:[
    ['MMPI 과소보고 효과크기', '1.05', '25편, 원판 MMPI', ['baer1992']],
    ['MMPI-2 과소보고 효과크기', '1.25', '코칭을 받으면 정확도 감소', ['baer2002']],
    ['L / S / K', 'g = 1.30 / 1.23 / 1.01', 'MMPI-2 좋은 인상 관리 탐지', ['picard2023']],
    ['L-r / K-r', 'g = 1.16 / 1.21', 'MMPI-2-RF, 판 간 차이 유의하지 않음', ['picard2023']],
    ['양육권 소송 규준 표본', '508명', '방어적 응답이 흔함', ['bathurst1997']],
  ],
  practice:[
    '양육권·인사 장면에서는 L·K·S의 “경도 상승”이 그 장면의 평균에 가깝다. 장면 규준과 비교해 “이 장면에서 기대되는 수준 이상인가”를 판단한다.',
    '방어 프로파일에서 임상척도가 60 이상으로 오른 척도는 오히려 중요하다. 숨기려 했는데도 드러난 문제이므로 면담에서 우선 확인한다.',
    '방어가 클수록 낮은 임상척도는 “문제가 없다”가 아니라 “문제 여부를 알 수 없다”로 기술한다.',
    '코칭을 받았을 가능성(변호사·인터넷 정보)이 있는 장면에서는 타당도 척도가 정상이어도 과소보고를 완전히 배제할 수 없다.',
  ],
  myths:[
    ['L이 65를 넘으면 거짓말을 했다.', 'L은 세련되지 않은 방식의 좋은 인상 관리와 전통적·종교적 가치관에서도 오른다. 의도적 거짓말의 직접 측정치가 아니다.'],
    ['방어 프로파일은 해석할 수 없으니 보고서에 쓸 것이 없다.', '방어의 정도와 방식, 그럼에도 오른 척도, 장면 규준과의 비교가 모두 해석 정보다.'],
  ],
  debate:'과소보고 연구의 대부분은 “좋게 보이라”는 지시를 받은 정상인 표본이다. 실제 양육권 부모나 지원자는 동기가 더 강하고 정보도 더 많다. 또 문화적으로 겸손과 자기 통제를 중시하는 집단에서는 L·K가 방어가 아닌 가치관을 반영할 수 있다는 점이 충분히 연구되지 않았다.',
  korea:'한국 규준에서 L·K의 평균과 분포는 미국과 다를 수 있으므로 외국의 장면 규준 수치를 그대로 쓰지 않는다. 국내 인사 선발·양육권 장면의 공개된 규준 자료는 제한적이다. 기관 내부 자료가 있다면 그 분포와 비교하는 것이 가장 정확하다.',
  seminar:[
    '양육권 소송 중인 어머니의 L 72, K 70, Hy 62 프로파일을 판사에게 어떻게 설명하겠는가?',
    '인사 선발 장면에서 “타당도 정상, 임상척도 모두 50 이하” 프로파일은 무엇을 말해 주고 무엇을 말해 주지 못하는가?',
    '코칭 효과에 대한 연구 결과는 평가 절차(사전 안내, 검사 환경)를 어떻게 바꾸어야 한다고 시사하는가?',
  ],
  links:{scales:['L','K','S'], scalesA:['L','K'], modules:['m03','m10'], cases:['c06','c11','c17','c20']},
},
{
  id:'ev-noncontent', area:'타당도와 반응 왜곡', title:'비내용 반응: 무선반응과 고정반응',
  q:'문항을 읽지 않고 답한 프로파일은 어떻게 알아보고, 얼마나 망가지는가?',
  why:'무선·고정 반응은 내용과 상관없이 F와 임상척도를 끌어올려 “심한 정신병리”처럼 보이게 만든다. 이것을 먼저 거르지 않으면 이후의 모든 해석이 틀린다. 타당도 판단의 첫 단계가 비내용 반응인 이유다.',
  findings:[
    ['MMPI-2에서 무선 응답을 섞은 연구는 F, F(B), VRIN이 무선 응답을 탐지하는 데 유용함을 보였다. 특히 검사 후반부만 무선으로 답한 경우를 F(B)와 VRIN이 잡아낼 수 있다.', ['berry1991r']],
    ['무선·고정(전부 “그렇다”, 전부 “아니다”) 응답을 단계적으로 섞은 시뮬레이션에서 VRIN-r은 무선 응답, TRIN-r은 고정 응답의 지표로 해석할 수 있음이 지지되었다. 중간 정도의 비내용 반응에서는 RC 척도의 타당도 계수가 비교적 유지되었다.', ['handel2010']],
    ['지역사회 청소년 106명을 대상으로 한 MMPI-A 연구에서 타당도 척도는 정상 프로토콜과 전체·부분 무선 프로토콜을 구별했다. 대부분의 청소년이 한 문항 이상 무선으로 답했다고 인정했고, 인정한 무선 응답 수는 F와는 상관이 있었지만 VRIN과는 없었다.', ['baer1997']],
  ],
  numbers:[
    ['MMPI-A 무선반응 연구 표본', '지역사회 청소년 106명', '대부분이 일부 무선 응답을 인정', ['baer1997']],
  ],
  practice:[
    '해석 순서는 항상 무응답(?) → VRIN → TRIN → F 계열이다. 앞 단계가 무효면 뒤를 해석하지 않는다.',
    'VRIN이 정상인데 F가 매우 높으면 무선반응보다 내용에 근거한 과대보고 또는 실제 병리를 먼저 생각한다.',
    'TRIN이 “그렇다” 방향으로 크게 높으면 F와 임상척도의 상승을 해석하지 않는다. 고령, 시력, 독해력, 인지 저하를 확인한다.',
    '청소년은 검사 중 주의가 흐트러지기 쉽다. 검사 소요 시간과 수검 태도를 기록하고, 필요하면 쉬는 시간을 두고 재실시한다.',
  ],
  myths:[
    ['VRIN이 정상이면 무선반응은 없다.', '청소년 연구에서 스스로 인정한 무선 응답 수는 VRIN과 상관이 없었다. 부분 무선 응답은 놓칠 수 있다.'],
    ['임상척도가 많이 올랐으니 매우 심한 환자다.', '무선·고정 반응만으로도 임상척도가 전반적으로 오른다. 타당도 확인 전에는 상승을 해석하지 않는다.'],
  ],
  debate:'무선 응답의 “비율”과 척도 점수 변화의 관계는 대부분 시뮬레이션 연구에서 나왔다. 실제 수검자의 무선 응답은 특정 구간(후반부, 어려운 문항)에 몰리는 경향이 있어 시뮬레이션과 다를 수 있다.',
  korea:'한국판에서도 해석 순서와 원리는 같다. 다만 고령·저학력 수검자의 독해 문제로 생기는 비일관 반응은 국내 임상에서 흔하므로, 필요하면 문항을 읽어 주는 실시 방식과 그 사실을 보고서에 기록한다.',
  seminar:[
    'VRIN 82, F1 86, F2 96인 청소년 프로파일을 받았다. 무엇을 하고, 보호자에게 어떻게 설명하겠는가?',
    'TRIN 86T인 70대 수검자에게 재검사를 권할 때 어떤 조건을 바꾸겠는가?',
  ],
  links:{scales:['VRIN','TRIN','F','Fb','CNS'], scalesA:['VRIN','TRIN','F1','F2'], modules:['m03','m14'], cases:['c15','c19']},
},
{
  id:'ev-codedef', area:'코드타입과 측정', title:'코드타입 정의도와 측정오차: “5점 규칙”의 근거',
  q:'상승한 두 척도와 세 번째 척도의 차이가 몇 점이어야 코드타입으로 해석할 수 있는가?',
  why:'코드타입 해석은 MMPI 해석의 중심이지만, 두 척도의 차이가 1~2점이면 재검사에서 다른 코드가 나올 가능성이 크다. 숙련가가 “잘 정의된(well-defined) 코드”를 먼저 따지는 이유가 이 연구들에 있다.',
  findings:[
    ['정신과 입원 환자의 MMPI 형태(configuration) 안정성 연구는 코드타입이 시간에 따라 완전히 안정적이지 않다는 점을 보여 주었다.', ['graham1986']],
    ['MMPI와 MMPI-2의 코드타입 일치도 연구(규준 2,600명, 정신과 환자 423명)에서 코드 정의 기준을 엄격하게 할수록 일치도가 높아졌고, 5 T점 이상으로 정의된 코드의 일치도는 매뉴얼이 처음 보고한 것보다 상당히 컸다. 한 번의 실시 안에서 두 판의 일치도는 두 번 실시한 같은 판의 일치도보다 훨씬 컸다. 즉 불일치의 상당 부분은 재표준화가 아니라 시간에 따른 불안정 때문이었다.', ['graham1991cong']],
    ['외래 환자 301명에서 잘 정의된 코드타입은 개념적으로 관련된 상관물과 더 강하게 연결되었다. 정의되지 않은 코드에도 기술을 쓸 수는 있지만 들어맞을 가능성이 낮다.', ['mcnulty1998']],
    ['매뉴얼의 신뢰도로 MMPI-2 점수의 추정 진점수, 측정의 표준오차, 95% 신뢰구간을 계산한 연구는 측정오차가 상승 척도와 코드타입 정의에 영향을 준다는 점을 보였다.', ['munley1991']],
    ['측정오차를 반영한 시뮬레이션에서, 같은 두 척도가 다시 최고점으로 나올 비율은 정의도 3점에서 27~37%, 5점에서 37~49%, 7점에서 46~61%, 10점에서 63~78%, 13점에서 78~89%, 15점에서 83~93%였다.', ['munley2004']],
    ['MMPI-2의 동형 T점수(uniform T)는 척도마다 같은 T점수가 같은 백분위를 뜻하도록 만들어, 척도 간 상승 비교를 가능하게 했다.', ['tellegen1992']],
  ],
  numbers:[
    ['정의도 3점', '27~37%', '같은 두 척도가 다시 최고점일 비율(시뮬레이션)', ['munley2004']],
    ['정의도 5점', '37~49%', '“5점 규칙”도 안정성을 보장하지는 않음', ['munley2004']],
    ['정의도 10점', '63~78%', '', ['munley2004']],
    ['정의도 15점', '83~93%', '', ['munley2004']],
    ['코드 일치도 연구 표본', '규준 2,600명, 환자 423명', '5점 이상 정의 시 일치도 크게 증가', ['graham1991cong']],
    ['상관물 연구 표본', '외래 환자 301명', '잘 정의된 코드의 상관물이 더 강함', ['mcnulty1998']],
  ],
  practice:[
    '코드타입을 쓰기 전에 정의도를 계산한다: 코드를 이루는 척도 중 가장 낮은 점수 − 그다음으로 높은 임상척도(5번과 0번 제외).',
    '정의도 5점 미만이면 코드타입 기술을 “가설”로만 쓰고, 개별 척도와 내용척도·RC 척도 해석의 비중을 높인다.',
    '정의도가 높아도(10점 이상) 재검사에서 같은 코드가 나올 확률은 100%가 아니다. 변화 해석을 할 때 측정오차를 먼저 생각한다.',
    '보고서에 정의도를 적는다(예: “2-7 코드, 정의도 15점으로 잘 정의됨”). 독자가 해석의 확신 정도를 알 수 있다.',
  ],
  myths:[
    ['5점 이상이면 안정적인 코드다.', '시뮬레이션에서 정의도 5점의 안정 비율은 37~49%에 그쳤다. 5점은 “해석할 만하다”의 최소 기준이지 안정성 보장이 아니다.'],
    ['MMPI에서 MMPI-2로 바뀌면서 코드타입이 달라졌으니 옛 연구는 쓸 수 없다.', '불일치의 상당 부분은 시간에 따른 불안정 때문이었고, 잘 정의된 코드의 일치도는 높았다.'],
  ],
  debate:'5점 기준이 지나치게 엄격하다는 비판과, 오히려 부족하다는 시뮬레이션 결과가 함께 있다. 또 세 척도 코드(예: 2-4-7)의 정의도를 어떻게 계산할지에 대해서는 연구가 적다. 임상에서는 정의도를 “있다/없다”가 아니라 연속적인 확신의 정도로 다루는 것이 현실적이다.',
  korea:'국내 대학생 156명이 1주 간격으로 MMPI와 MMPI-2를 받은 연구에서 1개 코드 일치는 36.5%, 2개 코드 일치는 19.2%였다. 옛 MMPI의 코드타입 규칙을 한국판 MMPI-2에 그대로 옮기지 말아야 한다는 근거이고, 동시에 측정오차의 크기를 보여 주는 국내 자료다.',
  seminar:[
    '7번 84, 8번 80, 6번 76인 프로파일은 7-8 코드인가? 보고서에 어떻게 쓰겠는가?',
    '정의도 4점인 2-1-3 코드를 해석할 때 무엇을 근거로 삼겠는가?',
    'Munley 등(2004)의 시뮬레이션 결과는 치료 전후 비교 평가의 해석을 어떻게 바꾸어야 한다고 시사하는가?',
  ],
  extraRefs:['hwang2010'],
  links:{modules:['m02','m05','m20'], cases:['c01','c10','c12','c18','c07']},
},
{
  id:'ev-cookbook', area:'코드타입과 측정', title:'코드타입 기술의 경험적 근거와 한계',
  q:'해석서에 적힌 코드타입 기술은 얼마나 정확한가?',
  why:'수련생은 해석서의 코드타입 기술을 그대로 옮겨 적기 쉽다. 그 기술들이 어떤 표본에서, 얼마나 강한 관계로 나온 것인지 알면 “이 내담자에게도 들어맞는가”를 비판적으로 따질 수 있다.',
  findings:[
    ['MMPI 상승 코드 연구를 개관한 결과, 연구마다 코드를 정의하는 전략이 놀라울 만큼 달랐다.', ['mcgrath1999a']],
    ['이 연구들의 효과크기를 종합한 메타분석에서 평균 효과는 작았다. 저자들은 기존 연구 방법이 코드의 실제 타당도를 충분히 반영하지 못했을 수 있다고 보았다.', ['mcgrath1999b']],
    ['외래 지역정신건강 장면의 대규모 상관물 연구는 현재 해석서들이 인용하는 척도·코드타입 기술의 주요 출처다. 출판사 소개에 따르면 외래 장면의 상관물은 다른 장면과 대체로 비슷했다.', ['graham1999book']],
    ['잘 정의된 코드타입일수록 개념적으로 관련된 상관물이 강했다. 해석서 기술의 정확도는 코드의 정의도에 달려 있다.', ['mcnulty1998']],
  ],
  practice:[
    '해석서의 기술은 “이 코드를 가진 집단에서 평균보다 자주 관찰된 특성”이다. 개인에게는 가설로 쓰고 면담으로 확인한다.',
    '기술의 출처 표본(입원, 외래, 대학 상담, 법정)과 내 내담자의 장면을 비교한다.',
    '여러 기술 중 다른 척도(내용, RC, 보충)와 수렴하는 것만 보고서에 남긴다. 이것이 숙련가의 “통합” 단계다.',
  ],
  myths:[
    ['해석서의 기술은 이 코드를 가진 모든 사람에게 해당된다.', '코드 연구의 평균 효과는 작았다. 같은 코드 안에서도 개인차가 크다.'],
  ],
  debate:'코드타입 접근은 MMPI의 경험적 전통의 핵심이지만, RC 척도와 MMPI-2-RF는 코드 대신 개별 척도의 구성 타당도를 강조하는 방향으로 이동했다. 두 접근은 서로 대체가 아니라 보완 관계로 쓰는 것이 현재 실무의 대세다.',
  korea:'한국 표본에서 코드타입별 상관물을 체계적으로 수집한 대규모 연구는 드물다. 국내 해석은 주로 외국 상관물에 기대므로, 문화적으로 다르게 표현되는 증상(신체화, 가족 관계)을 해석할 때 특히 면담 확인이 중요하다.',
  seminar:[
    '해석서의 4-9 코드 기술 중 법원 명령으로 온 22세에게 들어맞는 것과 들어맞지 않을 수 있는 것을 구분해 보라.',
    '작은 평균 효과크기에도 불구하고 코드타입 해석이 임상에서 유용할 수 있는 이유는 무엇인가?',
  ],
  extraRefs:['graham2012','greene2011','friedman2015','butcher2001'],
  links:{modules:['m05','m09','m11'], cases:['c03','c08','c09','c17']},
},
{
  id:'ev-rc', area:'척도 체계의 발전', title:'RC 척도와 의기소침: 장점과 비판',
  q:'여러 임상척도가 함께 오를 때, 그것은 여러 문제인가 아니면 하나의 공통 고통인가?',
  why:'임상척도들은 서로 상관이 높아 우울한 사람은 1, 2, 3, 7, 8번이 함께 오르기 쉽다. RC 척도는 이 공통 요인(의기소침)을 분리해 각 척도의 고유한 의미를 보려는 시도다. 동시에 “임상척도와 다른 것을 재고 있다”는 비판도 거세다. 양쪽을 알아야 보고서에서 RC를 적절히 쓴다.',
  findings:[
    ['RC 척도는 먼저 의기소침(RCd) 요인을 추출하고, 각 임상척도에서 이 요인을 덜어 낸 핵심 성분을 찾아 MMPI-2 전체 문항에서 척도를 만드는 방식으로 개발되었다. 결과는 RCd와 8개 RC 척도다.', ['tellegen2003']],
    ['심리 클리닉 내담자 285명과 퇴역 군인 567명 연구에서 RC 척도는 60% 적은 문항으로 더 나은 수렴·변별 타당도를 보였다. 다만 RC 척도와 임상척도는 서로 바꾸어 쓸 수 없다.', ['simms2005']],
    ['대학 상담 장면(남 228명, 여 522명)의 치료자 평정 상관물 연구에서 RC 척도는 개념적으로 관련된 기준과 강하게, 관련 없는 기준과는 거의 상관을 보이지 않았고, 임상척도보다 변별 타당도가 개선되었다.', ['sellbom2006']],
    ['비판 측은 RC 척도가 기존 내용척도와 중복이 크고, 특히 RC7·RC9가 원래의 Pt·Ma와 다른 구성개념으로 “표류(construct drift)”했다고 주장했다.', ['nichols2006']],
    ['또 다른 비판은 Caldwell 자료의 임상 사례 7,330명으로 교차 타당화하며, RC 척도가 경험적 문항 선정에서 구성 타당화로 패러다임을 바꾼 것이라 평가했다.', ['rogers2006']],
    ['개발자들은 새 자료로 의기소침이 MMPI 전반에 퍼진 차원임을 보이고 구성개념 표류 주장을 반박했다.', ['tellegen2006']],
  ],
  numbers:[
    ['RC 척도 문항 수', '임상척도보다 60% 적음', '타당도는 오히려 개선', ['simms2005']],
    ['대학 상담 표본', '남 228명, 여 522명', '변별 타당도 개선', ['sellbom2006']],
    ['교차 타당화 사례 수', '7,330명', '비판 측 자료', ['rogers2006']],
  ],
  practice:[
    '임상척도가 3~4개 이상 함께 올랐으면 RCd부터 본다. RCd가 높고 RC 척도가 대부분 낮다면 “여러 장애”보다 “전반적 의기소침”이 핵심이다.',
    '임상척도와 해당 RC 척도의 차이를 해석한다. 예를 들어 8번은 높고 RC8은 낮으면 기이한 경험보다 소외감·혼란·의기소침이 8번을 끌어올렸을 가능성이 크다.',
    'RC3(냉소)는 3번(히스테리)과 거의 반대 방향일 수 있다. 3번의 “순진한 낙관”과 RC3의 “타인 불신”을 혼동하지 않는다.',
    'RC 척도에 임상척도의 상관물(코드타입 기술)을 그대로 붙이지 않는다.',
  ],
  myths:[
    ['RC 척도가 임상척도를 대체한다.', '두 척도군은 서로 바꾸어 쓸 수 없다. MMPI-2에서는 함께 해석하는 것이 원칙이다.'],
    ['RC가 낮으면 임상척도 상승은 무시해도 된다.', '차이는 “무엇이 상승을 만들었는가”에 대한 가설을 준다. 무시가 아니라 해석의 재료다.'],
  ],
  debate:'핵심 쟁점은 두 가지다. 첫째, RC7과 RC9처럼 원 척도와 의미가 달라진 척도를 “임상척도의 재구성”이라 부를 수 있는가. 둘째, 의기소침을 분리하는 것이 실제 임상 판단(진단, 치료 계획)의 정확도를 높이는가. 상관물 연구는 RC를 지지하지만, 결정 정확도에 대한 직접 비교 연구는 상대적으로 적다.',
  korea:'국내 정신과 환자 121명(정신증 39, 우울 36, 불안 46) 연구에서 RC 척도는 각각의 모 임상척도와 높은 상관을 보이면서도, RC 척도끼리의 상관은 임상척도끼리보다 낮았다. 한국 임상 표본에서도 RC 척도의 변별성이 확인된 것이다.',
  seminar:[
    'D 78, Pt 80, RCd 76, RC2 68, RC7 73인 프로파일에서 의기소침과 고유한 우울·불안을 어떻게 구분해 기술하겠는가?',
    'Nichols(2006)의 “구성개념 표류” 비판은 임상 보고서 작성에 어떤 주의를 요구하는가?',
    'Sc 84, RC8 62인 프로파일과 Sc 84, RC8 80인 프로파일의 해석 차이를 설명하라.',
  ],
  extraRefs:['lee2011'],
  links:{modules:['m06','m17'], cases:['c01','c10','c18','c04','c12']},
},
{
  id:'ev-content', area:'척도 체계의 발전', title:'내용척도와 PSY-5: 임상척도에 무엇을 더하는가',
  q:'임상척도로 충분하지 않은가? 내용척도와 PSY-5는 어떤 추가 정보를 주는가?',
  why:'임상척도는 경험적으로 만들어져 문항 내용이 섞여 있다. 내용척도는 “내담자가 스스로 무엇을 말했는가”를, PSY-5는 성격 특성 차원을 보여 준다. 언제 이 척도들이 판단을 바꾸는지 알면 보고서가 구체적이 된다.',
  findings:[
    ['MMPI-2 내용척도 15개는 합리적·통계적 방법으로 만들어져 내적 동질성이 높고, 문항 내용이 수검자에게 명확하다.', ['butcher1990']],
    ['내용척도는 조현병과 주요우울증의 감별 진단에 기여했다.', ['benporath1991']],
    ['자기보고에 의한 성격·정신병리 평가에서 내용척도는 임상척도에 더해 증분 타당도를 보였다.', ['benporath1993']],
    ['PSY-5(공격성, 정신증, 통제 결여, 부정적 정서성/신경증, 내향성/낮은 긍정 정서성)는 MMPI-2 문항으로 만든 성격병리 차원 척도로, 임상 집단과 정상 집단 모두에서 내적 일관성이 양호했다.', ['harkness1995']],
  ],
  practice:[
    '임상척도 상승의 “내용”을 내용척도로 확인한다. 예를 들어 4번이 높을 때 FAM이 높으면 가족 갈등, ASP가 높으면 반사회적 태도 쪽으로 해석의 무게가 실린다.',
    '내용척도는 문항이 명확해 인상 관리에 민감하다. 방어 프로파일에서는 내용척도가 낮아도 문제를 부인했을 가능성을 고려한다.',
    'PSY-5는 진단보다 치료 계획에 유용하다. 예를 들어 INTR이 높으면 긍정 정서가 낮아 행동 활성화가 우선, NEGE가 높으면 정서 조절 기술이 우선이 된다.',
    'BIZ와 8번, PSYC가 함께 높으면 정신증적 경험의 가능성이 커진다. 8번만 높으면 소외감과 혼란을 먼저 생각한다.',
  ],
  myths:[
    ['내용척도는 단순히 자기보고라 임상척도보다 덜 중요하다.', '연구는 내용척도가 임상척도에 더해 설명력을 높인다는 것을 보였다. 특히 감별 진단에서 쓸모가 있다.'],
  ],
  debate:'내용척도와 RC 척도, PSY-5는 서로 겹치는 부분이 있어 어느 척도를 중심으로 해석할지 혼란이 생긴다. Nichols(2006)는 RC 척도가 내용척도와 중복된다고 비판했다. 실무에서는 같은 결론에 수렴하는 척도가 많을수록 확신을 높이는 방식으로 쓰는 것이 현실적이다.',
  korea:'한국판 MMPI-2에도 내용척도, 보충척도, PSY-5가 포함되어 있다. 한국 문화에서 가족 관련 문항(FAM)과 신체 호소(HEA)는 미국과 다르게 기능할 수 있으므로, 이 척도가 높을 때는 문화적 맥락을 면담에서 확인한다.',
  seminar:[
    'Pd 82, FAM 66, ASP 74인 사람과 Pd 77, FAM 72, ASP 60인 사람의 4번 해석은 어떻게 달라지는가?',
    'PSY-5 결과를 치료 계획에 연결하는 예를 두 가지 들어 보라.',
  ],
  links:{modules:['m07','m08'], cases:['c03','c08','c16','c07']},
},
{
  id:'ev-rf3', area:'척도 체계의 발전', title:'MMPI-2-RF와 MMPI-3: 무엇이 달라졌고 무엇이 그대로인가',
  q:'새 판이 나왔는데 MMPI-2를 계속 배워야 하는가?',
  why:'해외 연구와 실무는 MMPI-2-RF와 MMPI-3로 빠르게 옮겨 가고 있다. 국내 실무는 여전히 MMPI-2가 중심이지만, 최신 논문을 읽고 교수·동료와 토론하려면 판 사이의 구조 차이를 정확히 알아야 한다.',
  findings:[
    ['MMPI-2-RF는 MMPI-2의 567문항 중 338문항으로 51개 척도를 구성했다. RC 척도를 중심으로 상위 차원(정서·사고·행동)과 세부 척도를 위계적으로 배치했다.', ['benporath2008', 'benporath2012']],
    ['MMPI-3는 335문항(새 문항 72, 고친 문항 24)과 52개 척도로 구성되었고, 새 규준 표본 1,620명(남녀 각 810명)을 사용한다.', ['benporath2020']],
    ['연구 설계와 증상 유형을 통제하면 MMPI-2와 MMPI-2-RF 타당도 척도의 과대보고 탐지력은 유의하게 다르지 않았다.', ['aparcero2023']],
    ['좋은 인상 관리 탐지에서도 두 판의 효과크기 차이는 유의하지 않았다.', ['picard2023']],
    ['청소년 입원 환자 연구에서 MMPI-A-RF는 RC 척도 간 상관이 낮아 여러 척도가 동시에 오르는 프로파일이 적었고, 조정된 절단점에서 “정상 범위” 프로파일이 MMPI-A보다 5.5% 적었다. 타당/무효 판정의 일치율은 92.5%였다.', ['stokes2018']],
  ],
  numbers:[
    ['MMPI-2-RF', '338문항 · 51척도', 'MMPI-2 문항의 부분집합', ['benporath2008']],
    ['MMPI-3', '335문항 · 52척도 · 규준 1,620명', '새 문항 72, 고친 문항 24', ['benporath2020']],
    ['MMPI-A-RF', '241문항 · 48척도', '', ['archer2016rf']],
    ['MMPI-A-RF와 MMPI-A 타당성 판정 일치', '92.5%', '청소년 입원 환자 2,798명', ['stokes2018']],
  ],
  practice:[
    'RF와 MMPI-3의 점수는 MMPI-2 임상척도 점수와 바꾸어 쓸 수 없다. 코드타입 해석도 그대로 옮겨지지 않는다.',
    'MMPI-2로 배운 타당도 판단의 원리(비내용 → 과대 → 과소)와 RC·PSY-5 해석은 새 판에도 그대로 이어진다. 이 프로그램의 타당도·RC 학습이 새 판으로 가는 다리다.',
    '외국 논문을 읽을 때 어느 판의 어떤 척도인지(F와 F-r, Fp와 Fp-r)를 먼저 확인한다.',
  ],
  debate:'경험적 문항 선정으로 만든 임상척도와 코드타입의 풍부한 상관물 전통을 포기하는 것이 득인지 실인지는 여전히 논쟁 중이다. RC 비판(Nichols, 2006; Rogers 외, 2006)은 RF 체계 전체에 대한 비판으로도 읽힌다.',
  korea:'한국판 MMPI-2-RF와 MMPI-A-RF가 출판되어 있지만, 국내 임상과 연구에서는 여전히 MMPI-2와 MMPI-A가 주로 쓰인다. MMPI-3의 한국판 출판 여부는 출판사에 직접 확인하세요.',
  seminar:[
    '국내 기관이 MMPI-2에서 MMPI-2-RF로 바꾼다면 얻는 것과 잃는 것은 무엇인가?',
    'MMPI-2 코드타입 해석에 익숙한 임상가가 RF 보고서를 읽을 때 가장 흔히 저지를 오류는 무엇인가?',
  ],
  links:{modules:['m17','m06'], cases:[]},
},
{
  id:'ev-adolescent', area:'청소년과 문화', title:'MMPI-A가 “정상”으로 나오는 이유와 회색 지대',
  q:'명백히 힘든 청소년인데 왜 MMPI-A 임상척도는 60 아래로 나오는가?',
  why:'청소년 입원 환자에게서도 MMPI-A 임상척도가 정상 범위로 나오는 일이 흔하다. 이것을 모르면 “검사상 문제없음”이라는 위험한 보고서를 쓰게 된다. 청소년 평가에서 가장 중요한 연구 쟁점이다.',
  findings:[
    ['MMPI-A는 청소년 입원 환자처럼 상당한 정신병리가 있는 경우에도 정상 범위의 기본 척도 프로파일을 자주 만든다. 문항 반응률을 비교한 결과 정상 표본과 임상 표본에서 차이가 없는 문항이 상당수였고, 기본·내용척도의 “효과적인 문항” 비율이 MMPI-2보다 훨씬 낮았다.', ['archer2001']],
    ['청소년 입원 환자 203명과 규준 표본을 비교해 T ≥ 60과 T ≥ 65 기준의 분류 정확도를 검토한 결과, 기저율이 정확도에 영향을 주었지만 T 65 기준이 정상·임상 사례의 오분류를 모두 줄이며 전체 정확도가 더 높았다. 저자들은 이 결과를 MMPI-A “회색 지대(T 60~64)” 사용에 연결해 논의했다.', ['fontaine2001']],
    ['청소년 입원 환자 134명의 임상 정확도 평정에서 청소년 규준(MMPI-A 또는 Marks & Briggs)으로 얻은 코드타입이 성인 K 교정 규준으로 얻은 코드타입보다 정확하다고 평가되었다.', ['janus1996']],
    ['MMPI-A-RF는 조정된 절단점에서 “정상 범위” 프로파일을 MMPI-A보다 5.5% 줄였다. 문제를 완화하지만 해결하지는 못한다.', ['stokes2018']],
  ],
  numbers:[
    ['회색 지대', 'T 60~64', '청소년에서 잠정적으로 해석하는 범위', ['butcher1992', 'fontaine2001']],
    ['분류 정확도 연구 표본', '입원 청소년 203명', 'T 65 기준이 전체 정확도 높음', ['fontaine2001']],
    ['정상 범위 프로파일 감소', '5.5%', 'MMPI-A-RF 대 MMPI-A', ['stokes2018']],
  ],
  practice:[
    '의뢰된 청소년의 정상 범위 프로파일은 “문제없음”이 아니라 “검사가 문제를 포착하지 못했을 가능성”으로 기술한다. 면담, 보호자·교사 보고, 행동 관찰과 반드시 대조한다.',
    'T 60~64는 무시하지도 확정하지도 않는다. 다른 자료와 수렴할 때만 해석에 포함한다.',
    '청소년에게 성인 규준을 쓰지 않는다. 18세는 상황(학생, 독립 여부)에 따라 판을 고른다.',
    '방어(L·K 상승)가 있는 청소년 프로파일은 정상 범위 문제를 더 키운다. 섭식, 자해처럼 숨기기 쉬운 문제는 구조화 면담으로 직접 묻는다.',
  ],
  myths:[
    ['MMPI-A가 정상으로 나왔으니 입원은 과잉 대응이다.', 'MMPI-A는 입원 청소년에게서도 정상 범위 프로파일을 자주 만든다. 검사의 한계이지 증상의 부재가 아니다.'],
    ['청소년도 성인과 같은 65 기준만 보면 된다.', '청소년은 60~64를 회색 지대로 따로 다룬다.'],
  ],
  debate:'정상 범위 문제의 원인이 문항(청소년의 높은 기저 반응률)인지 규준인지, 또는 청소년기 정신병리 자체의 특성인지는 아직 정리되지 않았다. RF 판은 일부 개선을 보였지만, 청소년의 자기보고 한계를 어떻게 보완할지는 계속 연구 중이다.',
  korea:'한국판 MMPI-A 개발 연구에서 한국 청소년의 평균 T점수는 미국 청소년 평균에서 1 표준편차 이내로, 성인보다 문화 차이가 작았다. 한국판 MMPI-A에는 K 교정과 RC 척도가 없다는 점도 기억해 두자. 정상 범위 문제는 국내 임상에서도 같은 원리로 주의해야 한다.',
  seminar:[
    '완벽한 성적과 줄어드는 체중의 16세 여학생이 L·K 상승과 정상 범위 임상척도를 보였다. 보호자 피드백을 어떻게 하겠는가?',
    'Archer 등(2001)의 문항 분석 결과는 청소년 평가 배터리 구성에 어떤 시사점을 주는가?',
    '회색 지대의 척도가 3개 있을 때 보고서에 어떻게 쓰겠는가?',
  ],
  extraRefs:['archer2017', 'baer1998', 'lim2006'],
  links:{scalesA:['L','K','F1','F2'], modules:['m12','m13','m14','m16'], cases:['c13','c14','c16','c20','c15']},
},
{
  id:'ev-culture', area:'청소년과 문화', title:'문화와 규준: 왜 한국판 규준이어야 하는가',
  q:'미국 규준으로 채점한 한국인의 프로파일은 무엇이 문제인가?',
  why:'번역만 한 검사를 외국 규준으로 채점하면 한 문화 전체가 “병리적”으로 보일 수 있다. 한국판 MMPI-2가 따로 표준화된 이유와 그 근거를 알아야 외국 연구를 국내 사례에 옮길 때 무엇을 조심할지 판단할 수 있다.',
  findings:[
    ['31년간의 MMPI/MMPI-2 비교 연구 메타분석에서 미국 내 아프리카계·라틴계와 유럽계 집단의 차이는 작았고, 저자들은 이 검사가 이들 집단을 부당하게 병리적으로 그리지 않는다고 결론지었다. 다만 이 결과는 미국 내 소수 집단에 관한 것이다.', ['hall1999']],
    ['한국판 MMPI-2의 번안과 등가성 평가는 Butcher가 엮은 국제 번안 연구서에 영어로 소개되어 있다.', ['han1996']],
    ['한국판 MMPI-2 개발 연구에서 한국인을 미국 규준으로 채점하면 평균이 미국 평균보다 약 1 표준편차 높았다. 한국과 미국의 문항 반응 차이는 컸지만 성별 차이의 양상은 두 나라가 비슷했고, 신뢰도는 미국 자료와 비슷했다.', ['han2006']],
    ['한국 규준이 나오기 전의 예비 연구는 미국 규준으로 채점할 때 한국 대학생과 정신과 환자의 차이가 작게 보이는 문제를 보여 주었다.', ['han2002']],
    ['한국판 MMPI-A 개발 연구에서 한국 청소년의 평균 T점수는 미국 청소년 평균에서 1 표준편차 이내로, 성인보다 문화 차이가 작았다.', ['lim2006']],
  ],
  numbers:[
    ['미국 규준으로 채점한 한국 성인', '평균 약 +1 SD', '한국 규준이 필수인 이유', ['han2006']],
    ['한국 청소년(미국 청소년 규준 대비)', '1 SD 이내', '성인보다 문화 차이가 작음', ['lim2006']],
    ['MMPI → MMPI-2 코드 일치(국내 대학생)', '1개 코드 36.5%, 2개 코드 19.2%', '옛 규칙을 옮기지 말아야 할 근거', ['hwang2010']],
  ],
  practice:[
    '한국 성인은 반드시 한국 규준으로 채점한다. 외국 연구의 T점수 절단점을 인용할 때는 “미국 규준 기준”임을 밝힌다.',
    '외국 해석서의 상관물은 문화적으로 다르게 표현되는 영역(신체 증상, 가족 의무, 감정 표현)에서 특히 면담으로 확인한다.',
    '한국 규준은 2000년 인구센서스를 기준으로 만들어졌다. 20년이 넘은 규준이므로, 세대 차이가 큰 문항 영역(성 역할, 가족)은 해석을 보수적으로 한다.',
  ],
  myths:[
    ['메타분석에서 인종 차이가 작았으니 미국 규준을 한국인에게 써도 된다.', 'Hall 등(1999)은 미국 내 소수 집단 비교이고, 한국 자료는 미국 규준으로 채점할 때 약 1 SD의 차이를 보였다.'],
  ],
  debate:'한국 규준 자체가 오래되었다는 점과, 문화 차이가 “측정의 편향”인지 “실제 정신건강 수준의 차이”인지를 가르는 연구는 아직 부족하다. 문항 수준의 차별 기능(DIF) 분석이 더 필요하다.',
  korea:'이 쟁점 자체가 한국 실무의 출발점이다. 서지 정보는 학회지 목록과 인용 논문으로 확인했으며, 표본 크기 등 세부 수치는 매뉴얼과 원문으로 확인한 뒤 인용하세요.',
  seminar:[
    '외국 논문의 F(P) 절단점을 한국 사례 보고서에 인용하려면 어떤 단서를 달아야 하는가?',
    '한국 규준이 오래되었다는 문제는 어떤 척도 해석에서 가장 크게 드러날 것이라 예상하는가?',
  ],
  extraRefs:['kim2005', 'kim2005a', 'butcher1989'],
  links:{modules:['m01','m02','m13'], cases:['c11','c06']},
},
];

/* 사례 근거 노트: [해석 판단, [문헌 id], 연구가 말하는 것과 한계] */
window.CASE_EVIDENCE = {
  c01:[
    ['F 62, F(P) 48이므로 과대보고가 아니라 고통의 솔직한 보고로 본다', ['arbisi1995','rogers2003'], 'F(P)는 실제 정신과 환자도 드물게 답하는 문항이다. F(P)가 평균 이하이면 F의 경도 상승을 실제 고통으로 읽는 것이 연구와 일치한다.'],
    ['7-2 코드는 정의도 15점(80·78 대 63)으로 잘 정의되어 코드타입 기술을 비교적 확신 있게 쓴다', ['mcnulty1998','munley2004'], '잘 정의된 코드일수록 상관물이 강했다. 그래도 정의도 15점의 재검사 안정 비율은 시뮬레이션에서 83~93%로, 100%가 아니다.'],
    ['RCd 76이 높아 여러 척도 상승의 상당 부분은 의기소침이 만든 것이고, RC2 68·RC7 73이 고유한 우울과 불안을 보여 준다', ['tellegen2003','sellbom2006'], 'RC 척도는 의기소침을 분리해 변별 타당도를 높였다. RC7과 Pt가 완전히 같은 구성개념은 아니라는 비판(Nichols, 2006)도 기억해 둔다.'],
  ],
  c02:[
    ['FBS 72는 신체 질환자의 신체 호소로 오를 수 있으므로 과장으로 단정하지 않는다', ['nelson2010','butcher2008','aparcero2023'], 'FBS는 법정·신경심리 장면에서 효과가 크지만, 실제 신체 질환자의 거짓 양성이 논쟁의 핵심이다. F(P) 46이 정상이라 정신과 증상의 과장 근거도 없다.'],
    ['L·K가 60대 초반인 상태의 3-1 전환 V는 심리적 문제를 신체로 표현하고 부인하는 양식과 일치한다', ['graham1999book','baer2002'], '방어 지표의 경도 상승은 과소보고 효과크기 연구와 맞물려, 낮은 정서 척도를 “문제없음”으로 읽지 말라는 근거가 된다.'],
    ['3-1 코드는 정의도 16점(82·76 대 60)으로 잘 정의되었다', ['mcnulty1998'], '코드 기술은 가설이며, 의무기록과 신체 검사 결과로 확인한다.'],
  ],
  c03:[
    ['4-9 코드는 정의도 16점(82·76 대 60)으로 잘 정의되어 코드타입 기술을 적용할 수 있다', ['mcnulty1998','graham1991cong'], '잘 정의된 코드에서 상관물이 더 잘 들어맞는다. 법원 명령 장면은 상관물 연구의 외래 표본과 다르다는 점을 함께 적는다.'],
    ['ASP 74, AAS 76, MACR 72가 반사회적 태도와 물질 사용을 지지한다', ['benporath1993','butcher1990'], '내용척도는 임상척도에 더해 증분 타당도를 보였다. 다만 문항이 명확해 법정 장면에서는 축소 보고 가능성도 있다.'],
    ['DISC(통제 결여) 등 PSY-5는 치료 계획의 표적을 정하는 데 쓴다', ['harkness1995'], 'PSY-5는 성격병리의 차원 기술이다. 진단보다는 개입 표적을 고르는 데 강하다.'],
  ],
  c04:[
    ['F 88은 높지만 F(P) 62로 과대보고 기준에 미치지 않아, 입원 환자의 실제 중증 정신병리로 본다', ['arbisi1998','rogers2003'], '입원 환자에서는 F보다 F(P)가 가장과 실제 병리를 더 잘 가른다는 것이 핵심 근거다.'],
    ['6-8 코드는 정의도 18점(86·84 대 66)으로 잘 정의되었다', ['mcnulty1998','munley2004'], '정의도가 높아 코드타입 기술의 확신이 크다.'],
    ['RC6 84, RC8 80, BIZ 86이 함께 높아 피해 사고와 기이한 경험이 의기소침만으로 설명되지 않는다', ['sellbom2006','simms2005'], 'RC6·RC8은 고유한 정신증적 내용을 반영한다. 임상척도 상승이 RC에서도 유지되는 것이 중요하다.'],
  ],
  c05:[
    ['F 118, F(B) 112, F(P) 104가 함께 극단적으로 높아 정신과 증상 과대보고 가능성이 매우 크다', ['rogers2003','arbisi1995','aparcero2023'], 'F(P)는 실제 정신과 환자와 가장을 가르는 가장 강한 지표다. 단, “꾀병”은 의도 판단이므로 검사만으로 결론 내리지 않는다.'],
    ['FBS 102는 신체·인지 증상의 과장 가능성도 시사한다', ['nelson2006','nelson2010'], '장해 평가 장면에서 FBS의 효과가 크다. 수행 타당도 검사(PVT)와 함께 보아야 한다.'],
    ['과대보고 판단이 서면 임상척도와 내용척도의 상승을 해석하지 않는다', ['ingram2016'], '정직 집단과 가장 집단의 점수 차는 전통적 절단점보다 좁을 수 있으므로, 보고서에는 “해석 유보”와 그 근거를 함께 쓴다.'],
  ],
  c06:[
    ['L 72, K 70, S 72는 양육권 소송 부모에게 흔한 방어적 응답 양식이다', ['bathurst1997','picard2023'], '양육권 소송인 규준 자료에서 방어적 응답이 흔했다. 장면 기대치와 비교해 판단한다.'],
    ['방어에도 불구하고 Hy 62가 오른 것은 의미 있는 정보로 다룬다', ['baer2002'], '과소보고 집단은 정직 집단과 약 1 SD 다르다. 숨기려 했는데도 드러난 상승은 면담에서 우선 확인할 주제다.'],
    ['낮은 임상척도를 “정신병리 없음”으로 쓰지 않는다', ['baer2002','picard2023'], '코칭을 받은 수검자는 탐지가 더 어렵다. 보고서에는 “문제 여부를 판단하기 어렵다”로 쓴다.'],
  ],
  c07:[
    ['4-2-7 세 척도 코드는 세 번째 척도(71)와 다음 척도(62)의 차이가 9점으로 정의되었다', ['mcnulty1998','munley2004'], '세 척도 코드의 정의도 연구는 적다. 두 척도 코드(4-2)와 개별 척도 해석을 함께 쓴다.'],
    ['RCd 70이 함께 높아 현재의 고통이 4번 상승을 키웠을 가능성을 고려한다', ['tellegen2003','sellbom2006'], 'RC4 74가 유지되므로 반사회적 행동 경향이 의기소침만의 산물은 아니다.'],
    ['MDS 76, AAS 74, MACR 70이 결혼 갈등과 물질 문제를 지지한다', ['benporath1993'], '보충·내용척도는 임상척도의 상승 이유를 구체화한다.'],
  ],
  c08:[
    ['4-6 코드는 정의도 11점(77·75 대 64)으로 잘 정의되었다', ['mcnulty1998'], '잘 정의된 코드라 상관물을 적용할 근거가 있다.'],
    ['RC6 68과 CYN 72, Ho 70이 대인 불신과 적대감을 수렴해서 지지한다', ['sellbom2006','benporath1993'], '여러 척도군이 같은 결론에 수렴할 때 확신이 커진다.'],
    ['코드타입 기술은 집단 평균에서 나온 것이므로 개인에게는 가설로 쓴다', ['mcgrath1999b'], '코드 연구의 평균 효과크기는 작았다. 관계 패턴은 면담으로 확인한다.'],
  ],
  c09:[
    ['9번 단독 상승(84, 다음 척도 60)은 정의도가 매우 높다', ['munley2004'], '단독 상승의 안정성은 두 척도 코드보다 판단하기 쉽다.'],
    ['RC9 82가 Ma와 함께 높아 활성화가 의기소침 없이(RCd 42) 나타난다', ['tellegen2003','nichols2006'], 'RC9와 Ma가 완전히 같은 구성개념은 아니라는 비판이 있으므로 두 척도를 함께 읽는다.'],
    ['TRIN 62(그렇다 방향)는 해석에 영향을 줄 수준은 아니지만 기록해 둔다', ['handel2010'], 'TRIN은 고정 반응의 지표다. 경도 상승은 해석을 막지 않는다.'],
  ],
  c10:[
    ['F 82, F(P) 60으로 고통이 크지만 과대보고 근거는 약하다', ['arbisi1995','rogers2003'], '대학생 장면에서 F 상승은 실제 고통일 가능성이 크다. F(P)로 확인했다.'],
    ['8-7-2 코드는 정의도 6점으로 겨우 기준을 넘었다', ['mcnulty1998','munley2004'], '정의도 5~7점의 재검사 안정 비율은 시뮬레이션에서 37~61%다. 코드 기술을 가설로 쓰고 RC로 확인한다.'],
    ['Sc 84이지만 RC8 62, BIZ 60으로, 8번 상승은 기이한 경험보다 소외와 의기소침(RCd 82)이 주도한다', ['tellegen2003','simms2005'], '임상척도와 RC 척도의 차이는 “무엇이 상승을 만들었는가”의 단서다.'],
  ],
  c11:[
    ['인사 선발 장면의 L 62, K 64, S 66은 지원자에게 기대되는 수준의 방어다', ['picard2023','baer2002'], '방어 관련 상승 폭은 크지 않으므로 T점수를 보수적으로 해석하라는 권고가 있다.'],
    ['임상척도가 모두 정상 범위여도 “적응 문제가 없다”가 아니라 “검사상 드러난 문제가 없다”로 쓴다', ['baer2002'], '코칭을 받은 지원자는 탐지가 더 어렵다.'],
    ['한국 규준으로 채점해야 정상 범위 판단이 의미 있다', ['han2006'], '미국 규준으로 채점하면 한국 성인의 평균이 약 1 SD 높게 나온다.'],
  ],
  c12:[
    ['2-1-3 세 척도 코드는 세 번째 척도(68)와 다음 척도(64)의 차이가 4점이라 잘 정의되지 않았다', ['mcnulty1998','munley2004'], '정의도 5점 미만에서는 코드 기술의 적용 가능성이 낮다. 2-1 코드(정의도 7점)와 개별 척도 해석을 중심에 둔다.'],
    ['FBS 66은 심장 수술 후의 실제 신체 증상으로 오를 수 있다', ['nelson2010','butcher2008'], '신체 질환자의 거짓 양성은 FBS 논쟁의 핵심이다. 과장으로 단정하지 않는다.'],
    ['RC2 72(낮은 긍정 정서)가 의욕 상실의 핵심을 보여 준다', ['tellegen2003','sellbom2006'], 'RC2는 우울의 무쾌감 성분을 반영한다. 행동 활성화가 치료 표적이 된다.'],
  ],
  c13:[
    ['청소년에게는 청소년 규준(MMPI-A)을 쓴다', ['janus1996','butcher1992'], '청소년 규준으로 얻은 코드타입이 성인 규준보다 정확하다고 평정되었다.'],
    ['4-9 코드는 정의도 12점(76·70 대 58)으로 잘 정의되었다', ['mcnulty1998'], '청소년 코드타입의 정의도 연구는 성인보다 적다. 성인 연구의 원리를 참고로 적용한다.'],
    ['A-con 74, A-sch 76, PRO 72가 품행 문제와 학교 부적응을 수렴해서 지지한다', ['archer2017'], 'MMPI-A 내용·보충척도는 청소년 고유의 문제 영역을 직접 측정한다.'],
  ],
  c14:[
    ['2-4 코드는 정의도 6점으로 겨우 기준을 넘었다', ['mcnulty1998','munley2004'], '개별 척도(D, Pd)와 내용척도 해석의 비중을 높인다.'],
    ['손목의 상처가 있으므로 검사 점수와 상관없이 자해·자살 위험을 직접 평가한다', ['archer2001','fontaine2001'], 'MMPI-A는 실제 문제가 있어도 낮게 나올 수 있다. 위험 평가는 검사 결과에 의존하지 않는다.'],
    ['A-fam 78, A-dep 76이 가족 갈등과 우울을 지지한다', ['archer2017'], '청소년 내용척도는 문제 영역을 구체화해 개입 표적을 정한다.'],
  ],
  c15:[
    ['VRIN 82로 무선반응이 강하게 시사되어 나머지 척도를 해석하지 않는다', ['baer1997','berry1991r'], 'MMPI-A 타당도 척도는 무선 프로토콜을 구별했다. 비내용 반응이 확인되면 해석을 멈추는 것이 원칙이다.'],
    ['15분 만에 끝낸 수검 행동이 무선반응 판단을 뒷받침한다', ['baer1997'], '청소년 대부분이 일부 무선 응답을 인정했다. 소요 시간과 태도는 중요한 보조 자료다.'],
    ['재실시 시 쉬는 시간과 동기 면담을 함께 계획한다', ['archer2017'], '청소년 수검 태도는 실시 조건에 크게 좌우된다.'],
  ],
  c16:[
    ['8-6 코드는 정의도 8점(80·74 대 66)으로 정의되었다', ['mcnulty1998'], '정의된 코드이지만 청소년에서는 발달적 요인을 함께 고려한다.'],
    ['A-biz 80, PSYC 82가 정신증적 경험을 수렴해서 지지한다', ['harkness1995','archer2017'], '여러 척도군이 수렴하므로 정신증 평가를 위한 정밀 면담이 필요하다.'],
    ['입원 청소년도 MMPI-A가 낮게 나오는 경향을 고려하면, 이 정도 상승은 임상적으로 무겁게 받아들인다', ['archer2001'], 'MMPI-A의 낮은 민감도를 감안하면 뚜렷한 상승은 의미가 크다.'],
  ],
  c17:[
    ['3-4 코드는 정의도 6점으로 겨우 기준을 넘었다', ['mcnulty1998'], '코드 기술보다 O-H 80과 방어 지표를 중심으로 해석한다.'],
    ['L 64, K 63의 방어와 함께 O-H 80이 과잉통제형 적대감 가설을 지지한다', ['graham2012','greene2011'], 'O-H는 평소 분노를 과도하게 억제하다 드물게 폭발하는 사람을 가리기 위해 만들어진 보충척도다. 해석서의 기술은 가설이며, 폭력 위험 판단은 과거 행동 자료가 우선이다.'],
    ['ANG 48, CYN 40처럼 분노 관련 내용척도가 낮은 것은 분노를 의식적으로 부인하는 양식과 일치한다', ['benporath1993','baer2002'], '내용척도는 문항이 명확해 방어에 민감하다.'],
  ],
  c18:[
    ['F 84, F(P) 60으로 외상 후 고통의 실제 보고로 본다', ['arbisi1998','rogers2003'], 'F(P)가 기준 이하이면 F 상승은 실제 고통으로 읽는 것이 첫 가설이다.'],
    ['7-8 코드는 정의도 4점(84·80 대 76)으로 잘 정의되지 않았다', ['mcnulty1998','munley2004'], '정의도 3~5점의 재검사 안정 비율은 시뮬레이션에서 27~49%다. 코드 기술보다 RC·내용척도를 중심에 둔다.'],
    ['RCd 82, RC7 80, RC8 64로, 8번 상승은 기이한 사고보다 극심한 불안과 의기소침이 주도한다', ['tellegen2003','sellbom2006'], '“목소리가 들린다”는 호소는 외상 관련 침투 경험인지 정신증인지를 면담으로 감별한다.'],
  ],
  c19:[
    ['TRIN 86T(그렇다 방향)로 고정반응이 강하게 시사되어 F와 임상척도 상승을 해석하지 않는다', ['handel2010'], 'TRIN은 고정 반응의 지표로 지지되었다. 고정 반응은 내용과 무관하게 척도를 끌어올린다.'],
    ['VRIN 66도 경계 수준이라 비내용 반응 가능성을 함께 고려한다', ['berry1991r','handel2010'], '무선과 고정 반응이 섞일 수 있다.'],
    ['고령 수검자는 시력, 독해, 인지 저하를 확인하고 문항을 읽어 주는 방식으로 재실시를 고려한다', ['handel2010'], '재실시 조건과 그 사실을 보고서에 기록한다.'],
  ],
  c20:[
    ['L 66, K 66의 방어가 청소년 프로파일을 더 낮게 만든다', ['baer1998'], '청소년에서도 L·K는 과소보고 탐지에 쓸 수 있다.'],
    ['Pt 64, Hy 62, D 62는 회색 지대(60~64)로 잠정적으로 해석한다', ['fontaine2001','butcher1992'], '회색 지대는 무시하지도 확정하지도 않고 다른 자료와 수렴할 때 해석한다.'],
    ['완벽주의와 체중 감소는 검사 결과와 상관없이 섭식 문제를 구조화 면담으로 평가한다', ['archer2001','stokes2018'], 'MMPI-A는 실제 문제가 있어도 정상 범위로 나오는 경우가 많다.'],
  ],
};

/* 영상 자료: 공식 기관·저자가 공개한 강의. 링크는 정리 시점에 목록 페이지로 확인했다. */
window.VIDEOS = [
  {title:'Ben-Porath·Tellegen 대담 1부: 소개와 Tellegen의 배경', who:'University of Minnesota Press · 미네소타대 디지털 보존소(2016년 촬영, 7부작)', lang:'영어', free:true, len:'', url:'https://hdl.handle.net/11299/187609', why:'RC 척도와 MMPI-2-RF를 만든 두 사람이 직접 개발 과정을 설명한다. 교육 목적의 비상업적 사용이 허용된다.'},
  {title:'대담 2부: 원판 MMPI의 저자 Starke Hathaway', who:'University of Minnesota Press', lang:'영어', free:true, len:'', url:'https://conservancy.umn.edu/items/46cab91a-08fd-40ba-96f3-9fed9d429bb5', why:'경험적 문항 선정법이 어떤 문제의식에서 나왔는지, 이론 모듈 1과 함께 보면 좋다.'},
  {title:'대담 3부: MMPI의 재표준화(MMPI-2)', who:'University of Minnesota Press', lang:'영어', free:true, len:'', url:'https://conservancy.umn.edu/items/a7ff9dd4-bf3d-4685-a4f5-bd913df3c362', why:'1989년 재표준화의 결정 과정. 동형 T점수와 코드 일치도 논쟁의 배경이다.'},
  {title:'대담 4부: 임상척도와 재구성 임상(RC) 척도', who:'University of Minnesota Press', lang:'영어', free:true, len:'', url:'https://conservancy.umn.edu/items/56ca4a2f-cdea-4997-906c-d6ade09bb854', why:'의기소침 개념과 RC 척도 개발의 논리를 개발자에게서 직접 듣는다. “RC 척도와 의기소침” 쟁점과 함께 보라.'},
  {title:'대담 7부: MPQ와 MMPI-2-RF', who:'University of Minnesota Press', lang:'영어', free:true, len:'', url:'https://conservancy.umn.edu/items/6e03cf59-7502-443b-a509-e087e4a5442d', why:'RF 체계가 성격 연구(MPQ)와 어떻게 이어지는지.'},
  {title:'MMPI-A-RF 기본 개관 웨비나(녹화)', who:'Pearson · Richard W. Handel(2018)', lang:'영어', free:false, len:'', url:'https://pearsonassessments.com/professional-assessments/blog-webinars/webinars/2018/08/mmpi-a-rf-basic-overview.html', why:'청소년 RF 판의 구조. 비용과 시청 조건은 페이지에서 확인하세요.'},
  {title:'MMPI-3 개관 웨비나(녹화)', who:'Pearson · Yossef S. Ben-Porath(2020)', lang:'영어', free:false, len:'', url:'https://www.pearsonassessments.com/professional-assessments/blog-webinars/webinars/2020/07/an-mmpi-3-overview.html', why:'최신 판의 변화. 비용과 시청 조건은 페이지에서 확인하세요.'},
  {title:'MMPI-3의 법정 활용 웨비나(녹화)', who:'Pearson(2021)', lang:'영어', free:false, len:'', url:'https://www.pearsonassessments.com/professional-assessments/blog-webinars/webinars/2021/02/use-of-the-mmpi-3-in-forensic-settings1.html', why:'타당도 척도의 법정 실무 적용.'},
  {title:'MMPI-2, MMPI-A의 이해와 활용(PDF 자료)', who:'한국청소년상담복지개발원(2014)', lang:'한국어', free:true, len:'문서', url:'https://www.kyci.or.kr/fileup/lib_pdf/2014-82.pdf', why:'국내 기관이 공개한 한국어 입문 자료. 한국판 MMPI-A에 K 교정과 RC 척도가 없다는 점 등 국내 실무 정보.'},
];

/* 직접 만드는 짧은 강의 영상 대본(CapCut 등): [화면 문구, 내레이션] */
window.VIDEO_SCRIPTS = [
  {title:'1편. F가 높으면 꾀병일까? (약 2분)', len:'약 2분', scenes:[
    ['F가 높으면 꾀병일까?', 'MMPI-2 프로파일에서 F가 90을 넘었습니다. 많은 수련생이 여기서 “과장했다”고 씁니다. 오늘은 그 판단이 왜 위험한지, 연구가 무엇을 말하는지 2분 안에 정리합니다.'],
    ['F는 “드문 응답”일 뿐', 'F는 정상인이 거의 답하지 않는 문항입니다. 그런데 실제로 심하게 아픈 사람도 이 문항에 답합니다. 그래서 입원 병동의 F 상승은 꾀병보다 실제 병리일 가능성이 큽니다.'],
    ['F(P): 환자도 드물게 답하는 문항', '그래서 만든 척도가 F(P)입니다. 정상인뿐 아니라 정신과 환자도 드물게 답하는 27문항입니다. 환자도 답하지 않는 문항에 답했다면 그때 과대보고를 의심합니다.'],
    ['메타분석: F(P) d = 2.02', '65편의 가장 연구를 묶은 메타분석에서 F(P)는 진단 집단 전반에서 특히 효과적이었고 절단점도 일관되었습니다. 반면 F(B)를 일상적으로 쓰는 것에는 의문이 제기되었습니다. (Rogers 외, 2003)'],
    ['순서: VRIN·TRIN → F → F(P)', '해석 순서를 기억하세요. 먼저 VRIN과 TRIN으로 문항을 읽고 답했는지 확인하고, F를 본 다음, F(P)로 실제 병리와 과장을 가릅니다.'],
    ['보고서 문장', '과대보고가 의심되어도 “꾀병”이라고 쓰지 않습니다. “증상을 실제보다 크게 보고했을 가능성이 높아 임상척도 해석을 유보한다.” 검사가 말할 수 있는 범위까지만 씁니다.'],
    ['오늘의 한 줄', 'F는 경보, F(P)는 판정. 장면의 기저율을 함께 적으세요.'],
  ]},
  {title:'2편. 코드타입 “5점 규칙”의 진실 (약 2분)', len:'약 2분', scenes:[
    ['7번 84, 8번 80, 6번 76', '이 프로파일은 7-8 코드일까요? 7-8 코드 기술을 그대로 옮겨 쓰기 전에 꼭 확인할 숫자가 있습니다. 정의도입니다.'],
    ['정의도 = 코드의 낮은 척도 − 다음 척도', '정의도는 코드를 이루는 척도 중 낮은 점수에서 그다음으로 높은 임상척도를 뺀 값입니다. 이 프로파일은 80에서 76을 빼서 4점입니다.'],
    ['5점 이상: 잘 정의된 코드', '연구는 5점 이상으로 정의된 코드에서 상관물이 더 잘 들어맞고, 판 사이의 일치도도 훨씬 높다는 것을 보였습니다. (Graham 외, 1991; McNulty 외, 1998)'],
    ['5점이어도 안정 비율 37~49%', '하지만 5점이 안정성을 보장하지는 않습니다. 측정오차를 반영한 시뮬레이션에서 같은 두 척도가 다시 최고점으로 나올 비율은 5점일 때 37~49%, 10점일 때 63~78%였습니다. (Munley 외, 2004)'],
    ['정의도가 낮으면?', '코드 기술은 가설로만 쓰고, RC 척도와 내용척도, 개별 척도 해석의 비중을 높입니다. 보고서에는 정의도를 숫자로 적어 독자가 확신의 정도를 알게 합니다.'],
    ['오늘의 한 줄', '코드를 말하기 전에 정의도를 말하라.'],
  ]},
  {title:'3편. MMPI-A가 정상으로 나오는 이유 (약 2분)', len:'약 2분', scenes:[
    ['입원한 청소년, 모든 척도가 60 아래', '명백히 힘든 청소년인데 MMPI-A 임상척도가 모두 60 아래로 나왔습니다. 검사상 문제없음이라고 써도 될까요?'],
    ['MMPI-A의 알려진 한계', '연구에 따르면 MMPI-A는 입원 청소년에게서도 정상 범위 프로파일을 자주 만듭니다. 정상 청소년과 임상 청소년의 반응률이 비슷한 문항이 많기 때문입니다. (Archer 외, 2001)'],
    ['회색 지대: T 60~64', '그래서 청소년은 60에서 64를 회색 지대로 따로 다룹니다. 무시하지도 확정하지도 않고, 면담과 다른 자료와 수렴할 때 해석에 넣습니다. (Fontaine 외, 2001)'],
    ['방어가 더해지면', 'L과 K가 높은 방어적 청소년은 점수가 더 낮아집니다. 섭식 문제나 자해처럼 숨기기 쉬운 문제는 검사와 상관없이 구조화 면담으로 직접 묻습니다.'],
    ['보고서 문장', '“검사 결과 정상 범위이나, 이는 MMPI-A의 알려진 한계와 방어적 수검 태도를 고려할 때 문제의 부재를 뜻하지 않는다.”'],
    ['오늘의 한 줄', '청소년의 정상 프로파일은 “문제없음”이 아니라 “포착되지 않음”일 수 있다.'],
  ]},
];
})();
