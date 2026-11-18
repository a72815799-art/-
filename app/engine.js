/* MMPI-2 규칙 기반 해석 엔진.
   전문가의 8단계 사고 순서를 따라 "가설 목록"과 근거를 생성한다. */
(function(){
const S = {}; (window.SCALES||[]).forEach(s=>S[s.id]=s);
const CODE_SCALES = ['Hs','D','Hy','Pd','Pa','Pt','Sc','Ma'];
const NUM = {Hs:'1',D:'2',Hy:'3',Pd:'4',Mf:'5',Pa:'6',Pt:'7',Sc:'8',Ma:'9',Si:'0'};
const SETTINGS = {outpatient:'외래·상담', inpatient:'정신과 입원', forensic:'법정·감정', custody:'양육권 평가', personnel:'인사 선발', medical:'의료·통증', college:'대학 상담'};
const has = (p,k)=> p[k]!==undefined && p[k]!==null && p[k]!=='' && !isNaN(p[k]);
const v = (p,k)=> has(p,k)? Number(p[k]) : null;
const hi = (p,k,t=65)=> has(p,k) && Number(p[k])>=t;
const lo = (p,k,t=40)=> has(p,k) && Number(p[k])<t;
function band(x){ if(x>=75) return 'vhigh'; if(x>=65) return 'high'; if(x>=60) return 'mod'; if(x<40) return 'low'; return 'normal'; }
function fmt(p,k){ return (S[k]?.abbr||k)+' '+p[k]; }

function analyze(p, ctx){
  ctx = ctx||{};
  if(ctx.version==='A') return analyzeA(p, ctx);
  const setting = ctx.setting||'outpatient', sex = ctx.sex||'M';
  const steps = []; const flags = []; let validity = 'valid'; let stopClinical = false; let limitLate = false; let under = false; let over = false;
  const add = (st, tag, text)=> st.items.push({tag, text});

  /* 1. 맥락 */
  const s1 = {n:1, title:'맥락 확인', items:[]}; steps.push(s1);
  add(s1,'info',`장면: ${SETTINGS[setting]||setting}. 성별: ${sex==='F'?'여성':'남성'}. 이 장면의 기저율을 기준으로 타당도와 상승 수준을 판단한다.`);
  if(setting==='custody'||setting==='personnel') add(s1,'info','자신을 좋게 보이려는 동기가 있는 장면이다. L·K·S가 중간 정도로 오르는 것은 흔하다.');
  if(setting==='forensic') add(s1,'info','외적 동기(감경, 보상)가 있을 수 있는 장면이다. 과대보고와 과소보고 모두에 주의한다.');
  if(setting==='inpatient') add(s1,'info','입원 장면은 F 상승의 기저율이 높다. F 80~99가 실제 병리를 반영할 수 있다.');
  if(setting==='medical') add(s1,'info','실제 신체 질환이 1·3번, HEA, FBS를 올릴 수 있다.');

  /* 2. 타당도 */
  const s2 = {n:2, title:'타당도 판단 (결정 나무)', items:[]}; steps.push(s2);
  if(has(p,'CNS')){ const c=v(p,'CNS');
    if(c>=30){ add(s2,'stop',`무응답 ${c}개(≥30): 프로파일을 해석하지 않는다.`); validity='invalid'; stopClinical=true; }
    else if(c>=10) { add(s2,'warn',`무응답 ${c}개(10~29): 결측 문항이 특정 척도에 몰렸는지 확인한다.`); if(validity==='valid') validity='caution'; }
    else add(s2,'ok',`무응답 ${c}개: 문제없음.`); }
  if(has(p,'VRIN')){ const x=v(p,'VRIN');
    if(x>=80){ add(s2,'stop',`VRIN ${x}(≥80): 무선반응. 해석을 중단한다.`); validity='invalid'; stopClinical=true; }
    else if(x>=70){ add(s2,'warn',`VRIN ${x}(70~79): 비일관 응답 가능성이 있다. 해석에 주의한다.`); if(validity==='valid') validity='caution'; }
    else add(s2,'ok',`VRIN ${x}: 내용에 맞게 일관되게 응답했다.`); }
  if(has(p,'TRIN')){ const x=v(p,'TRIN'), d=p.TRINdir||'T';
    if(x>=80){ add(s2,'stop',`TRIN ${x}${d}(≥80): ${d==='T'?'묵종(“그렇다”)':'부정(“아니다”)'} 고정반응. 해석을 중단한다.`); validity='invalid'; stopClinical=true; }
    else if(x>=70){ add(s2,'warn',`TRIN ${x}${d}: ${d==='T'?'“그렇다” 경향이 있어 F와 임상척도가 다소 높아졌을':'“아니다” 경향이 있어 L·K가 다소 높아졌을'} 수 있다.`); if(validity==='valid') validity='caution'; }
    else add(s2,'ok',`TRIN ${x}${d}: 고정반응이 없다.`); }

  if(!stopClinical){
    const F=v(p,'F'), Fp=v(p,'Fp'), Fb=v(p,'Fb');
    if(F!==null){
      if(F>=100){
        if(Fp!==null && Fp>=100){ add(s2,'stop',`F ${F}, Fp ${Fp}: 내용 무관 응답이 배제된 상태에서 Fp까지 100 이상이다. 증상 과대보고로 보고 임상척도를 증상의 지표로 해석하지 않는다.`); validity='invalid'; stopClinical=true; over=true; }
        else if(Fp!==null && Fp>=70){ add(s2,'warn',`F ${F}, Fp ${Fp}: 과대보고 가능성이 있다. 해석할 때 증상이 과장되었을 가능성을 명시한다.`); validity='caution'; over=true; }
        else if(Fp!==null){ add(s2,'warn',`F ${F}이지만 Fp ${Fp}로 정상이다. ${setting==='inpatient'?'입원 장면의 실제 심한 정신병리를 반영할 가능성이 크다.':'실제 심한 고통 또는 도움 요청일 가능성이 있다. 외래 장면에서는 드문 수준이므로 면담 정보와 대조한다.'}`); if(validity==='valid') validity='caution'; }
        else { add(s2,'warn',`F ${F}(≥100): Fp 점수가 없으면 과대보고와 실제 병리를 구분할 수 없다. Fp를 입력한다.`); validity='caution'; }
      } else if(F>=80){
        if(Fp!==null && Fp>=70){ add(s2,'warn',`F ${F}, Fp ${Fp}: 증상을 다소 과장했을 수 있다.`); if(validity==='valid') validity='caution'; over=true; }
        else add(s2,'info',`F ${F}: 심한 고통이나 정신병리를 인정한다${Fp!==null?` (Fp ${Fp} 정상, 과대보고 근거 없음)`:''}. ${setting==='inpatient'?'입원 장면에서는 흔하다.':'도움 요청(cry for help) 여부를 고려한다.'}`);
      } else if(F>=65) add(s2,'info',`F ${F}: 자신의 문제와 고통을 인정한다.`);
      else add(s2,'ok',`F ${F}: 비전형 응답이 없다.`);
    }
    if(Fp!==null && !(F!==null && F>=80) && Fp>=100){ add(s2,'stop',`Fp ${Fp}(≥100): 과대보고. 해석하지 않는다.`); validity='invalid'; stopClinical=true; over=true; }
    if(Fb!==null){ const lim = setting==='inpatient'?110:90;
      if(Fb>=110){ add(s2,'warn',`F(B) ${Fb}(≥110): 검사 후반부의 응답을 신뢰하기 어렵다. 내용척도, 보충척도, PSY-5는 해석하지 않는다.`); limitLate=true; if(validity==='valid') validity='caution'; }
      else if(Fb>=lim && (F===null || Fb-F>=10)){ add(s2,'warn',`F(B) ${Fb}: 후반부에서 비전형 응답이 늘었다. 내용·보충척도를 조심스럽게 해석한다.`); }
    }
    if(has(p,'FBS')){ const x=v(p,'FBS');
      if(x>=100) add(s2, setting==='medical'?'info':'warn', `FBS ${x}: 신체·인지 증상을 과대보고했을 가능성이 높다${setting==='medical'?'. 다만 의료 장면의 실제 질환자에게서도 오를 수 있다':' (법의학 장면에서 의미가 크다)'}.`);
      else if(x>=80) add(s2,'info',`FBS ${x}: 신체·인지 증상을 과대보고했을 가능성이 있다${setting==='medical'?'. 의료 장면이므로 비중을 낮춘다':''}.`);
    }
    const L=v(p,'L'), K=v(p,'K'), Ss=v(p,'S');
    if(L!==null){
      if(L>=80){ add(s2,'stop',`L ${L}(≥80): 과소보고. 해석하지 않는다.`); validity='invalid'; stopClinical=true; under=true; }
      else if(L>=65){ add(s2,'warn',`L ${L}: 사소한 결점까지 부인한다. 과소보고 가능성이 있어 임상척도가 실제 문제를 과소평가했을 수 있다.`); under=true; if(validity==='valid') validity='caution'; }
      else if(L>=60) add(s2,'info',`L ${L}: 관습적이고 도덕적인 자기제시를 한다${(setting==='custody'||setting==='personnel')?' (이 장면에서는 흔하다)':''}.`);
    }
    if(K!==null){
      const kcut = (setting==='personnel'||setting==='custody')?70:65;
      if(K>=kcut){ add(s2,'warn',`K ${K}: 방어적이며 심리적 문제를 축소한다. 임상척도가 과소평가되었을 수 있다.`); under=true; if(validity==='valid') validity='caution'; }
      else if(K>=60) add(s2,'info',`K ${K}: ${(setting==='personnel'||setting==='custody')?'이 장면의 기저율 범위이며, 적응 자원을 반영할 수 있다.':'다소 방어적이거나 자기 통제가 강하다.'}`);
      else if(K<40) add(s2,'info',`K ${K}: 자기비판적이고 자원이 고갈되어 있으며 고통을 강하게 호소한다.`);
    }
    if(Ss!==null && Ss>=70){ add(s2,'warn',`S ${Ss}(≥70): 자신을 매우 바람직하게 제시한다. 낮은 임상척도를 “문제없음”으로 해석할 수 없다.`); under=true; if(validity==='valid') validity='caution'; }
    if(F!==null && L!==null && K!==null){
      if(L<55 && K<50 && F>=65) add(s2,'info','타당도 모양: 삿갓형(L·K 낮고 F 높음). 문제를 인정하고 도움을 요청하는 모습이다.');
      else if(L>=60 && K>=60 && F<55) add(s2,'info','타당도 모양: V형(L·K 높고 F 낮음). 방어적이며 문제를 부인한다.');
    }
  }
  const vText = validity==='invalid'?'해석 불가': validity==='caution'?'해석 가능(주의)':'타당';
  s2.verdict = vText;

  /* 3~ 임상 해석 */
  let code = null;
  if(stopClinical){
    steps.push({n:3, title:'임상 해석 보류', items:[{tag:'stop', text:'타당도 판단 결과, 임상척도·RC·내용척도를 증상이나 성격의 지표로 해석하지 않는다. 보고서에는 응답 양식과 그 함의, 추가 평가 권고를 기술한다.'}]});
    if(over) steps[2].items.push({tag:'info', text:'과대보고는 “측정의 한계”에 대한 진술이다. 실제 증상이 있는지는 이 결과로 판단할 수 없다. 꾀병 여부는 외적 동기, 행동 관찰, 증상 타당성 도구(SIRS-2 등)를 종합해 판단한다.'});
    return {steps, validity, vText, code:null, flags, stopClinical, under, over};
  }

  /* 3. 상승도와 모양 */
  const s3 = {n:3, title:'전체 상승도와 프로파일 모양', items:[]}; steps.push(s3);
  const avail = CODE_SCALES.filter(k=>has(p,k));
  if(avail.length){
    const mean = avail.reduce((a,k)=>a+v(p,k),0)/avail.length;
    const n65 = avail.filter(k=>v(p,k)>=65).length;
    add(s3,'info',`8개 임상척도 평균 T = ${mean.toFixed(1)}, T 65 이상인 척도 ${n65}개. ${mean>=70?'전반적인 고통과 기능 손상이 심하다.':mean>=60?'고통과 문제가 상당하다.':mean>=50?'중간 수준이다.':'전반적으로 낮다.'}`);
    if(has(p,'Hs')&&has(p,'D')&&has(p,'Hy')){
      const a=v(p,'Hs'), b=v(p,'D'), c=v(p,'Hy');
      if(a>=65 && c>=65 && b<=Math.min(a,c)-10) add(s3,'warn',`전환 V: 1번(${a})·3번(${c})이 높고 2번(${b})이 뚜렷이 낮다. 정서적 고통이 신체 증상으로 전환되어 고통을 덜 느낀다.`);
      else if(b>=65 && b>a && b>c && (a>=60||c>=60)) add(s3,'info','신경증 3요소에서 2번이 가장 높다(역V/정점형). 고통을 실제로 많이 느낀다.');
    }
    const psy = ['Pa','Pt','Sc','Ma'].filter(k=>hi(p,k)).length;
    if(psy>=3) add(s3,'warn',`정신증 4요소(6·7·8·9) 중 ${psy}개가 상승했다. 사고와 현실 검증 문제를 평가한다.`);
    if(hi(p,'Pa',70)&&hi(p,'Sc',70)&&has(p,'Pt')&&v(p,'Pt')<=Math.min(v(p,'Pa'),v(p,'Sc'))-10) add(s3,'warn','편집증적 계곡: 6·8번이 높고 7번이 뚜렷이 낮다. 정신증 가능성을 높이는 형태다.');
    if(has(p,'L')&&has(p,'Pa')&&has(p,'Sc')&&has(p,'Hy')&&has(p,'Pt')){
      const g = v(p,'L')+v(p,'Pa')+v(p,'Sc')-v(p,'Hy')-v(p,'Pt');
      add(s3, g>=45?'warn':'info', `Goldberg 지표(L+Pa+Sc−Hy−Pt) = ${g}. ${g>=45?'정신증 방향(≥45).':'신경증 방향(<45).'} 원판 MMPI 정신과 환자 자료에서 개발되었으므로 보조 지표로만 쓴다.`);
    }
    if(sex==='F' && hi(p,'Pd') && hi(p,'Pa') && lo(p,'Mf')) add(s3,'info','여성 프로파일에서 4·6번이 높고 5번이 낮다(수동-공격적 V). 분노를 요구, 불평, 원망으로 간접 표출하는 양식이다.');
  }

  /* 4. 코드타입 */
  const s4 = {n:4, title:'코드타입 결정', items:[]}; steps.push(s4);
  if(avail.length>=3){
    const r = avail.map(k=>({k, t:v(p,k)})).sort((a,b)=>b.t-a.t);
    const top=r[0], sec=r[1], thd=r[2], fth=r[3];
    let key='WNL', label='정상 범위 (WNL)', def=null, members=[];
    if(top.t<65){
      add(s4,'info',`가장 높은 척도가 ${NUM[top.k]}번(${top.t})으로 T 65 미만인 정상 범위 프로파일이다.${top.t>=60?` T 60~64인 ${r.filter(x=>x.t>=60).map(x=>NUM[x.k]+'번').join(', ')}은 경향성 수준으로 서술한다.`:''}`);
      if(under) add(s4,'warn','과소보고 지표가 있으므로, 정상 범위라는 결과를 “문제없음”으로 해석해서는 안 된다.');
    } else if(sec.t<65){ // 두 번째 척도가 65 미만일 때만 단독 상승(Graham). 둘 다 65 이상이면 차이가 커도 2개 척도 코드
      key = NUM[top.k]; label = `${NUM[top.k]} 단독 상승 (spike)`; members=[top.k];
      def = top.t-sec.t;
      add(s4,'info',`${NUM[top.k]}번(${top.t}) 단독 상승. 두 번째 척도 ${NUM[sec.k]}번(${sec.t})과 ${def}T 차이.`);
    } else {
      members=[top.k, sec.k];
      const two = [NUM[top.k],NUM[sec.k]];
      let tri = false;
      if(thd && thd.t>=65){
        const k3 = [NUM[top.k],NUM[sec.k],NUM[thd.k]].sort().join('');
        if(window.CODETYPES[k3]){ tri=true; key=k3; members.push(thd.k); label=`${NUM[top.k]}-${NUM[sec.k]}-${NUM[thd.k]} (3개 척도 코드)`; def = fth? thd.t-fth.t : null; }
      }
      if(!tri){ key = two.slice().sort().join(''); label = `${two[0]}-${two[1]} 코드`; def = thd? sec.t-thd.t : null; }
      add(s4,'info',`${label}: ${members.map(k=>NUM[k]+'번 '+v(p,k)).join(', ')}.`);
      if(!tri && thd && thd.t>=65){
        const k3 = [NUM[top.k],NUM[sec.k],NUM[thd.k]].sort().join('');
        add(s4,'info',`세 번째 척도 ${NUM[thd.k]}번(${thd.t})도 65 이상이다. 3개 척도 조합${window.CODETYPES[k3]?'('+window.CODETYPES[k3].title+')':''}도 함께 고려한다.`);
      }
    }
    if(def!==null && members.length){
      if(def>=5) add(s4,'ok',`정의 수준 ${def}T(≥5): 잘 정의된 코드다. 문헌의 기술 내용을 비교적 확신을 갖고 적용할 수 있다.`);
      else add(s4,'warn',`정의 수준 ${def}T(<5): 정의되지 않은 코드다. 인접 척도를 함께 고려하고 개별 척도의 의미를 더 많이 활용한다.`);
    }
    if(members.length===3){ const k2=[NUM[members[0]],NUM[members[1]]].sort().join(''); const c2=window.CODETYPES[k2];
      if(c2) add(s4,'info',`2개 척도로 보면 <b>${c2.title}</b> — ${c2.core} 세 번째 척도가 이 특징을 어떻게 바꾸는지 함께 고려한다.`); }
    const ct = window.CODETYPES[key];
    if(ct){
      add(s4,'info',`<b>${ct.title}</b> — ${ct.core}`);
      if(ct.order && members.length>=2) add(s4,'info','순서: '+ct.order);
      if(ct.expert) add(s4,'info','전문가 포인트: '+ct.expert);
    } else if(key!=='WNL') add(s4,'info','이 조합은 코드타입 사전에 없다. 각 척도의 의미를 결합해 해석한다.');
    if(members.length && members.every(k=>v(p,k)<70) && key!=='WNL') add(s4,'info','코드 척도가 T 65~69 범위에 있다. 문헌의 기술 내용 중 극단적인 특징보다 경향성을 중심으로 적용한다.');
    code = {key, label, def, members, ct};
  }

  /* 5. 척도별 정교화 */
  const s5 = {n:5, title:'척도별 의미와 정교화 (하위척도·RC)', items:[]}; steps.push(s5);
  ['Hs','D','Hy','Pd','Mf','Pa','Pt','Sc','Ma','Si'].forEach(k=>{
    if(!has(p,k)) return; const t=v(p,k), b=band(t), sc=S[k];
    let txt=null;
    if(k==='Mf'){ if(t>=65||t<40) txt = sc.bands[t>=65?'high':'low']; }
    else if(b==='vhigh') txt = sc.bands.vhigh||sc.bands.high;
    else if(b==='high') txt = sc.bands.high;
    else if(b==='low' && ['D','Ma','Si','Pd'].includes(k)) txt = sc.bands.low;
    if(!txt) return;
    let t2 = `<b>${NUM[k]}번 ${sc.abbr} ${t}</b> — ${txt}`;
    if(sc.hl && t>=65){
      const hs = sc.hl.filter(h=>hi(p,h)).map(h=>`${h} ${window.SUBSCALES[h].name}(${p[h]})`);
      const any = sc.hl.some(h=>has(p,h));
      if(hs.length) t2 += `<br><span class="sub">하위척도: ${hs.join(', ')} 상승 → ${sc.hl.filter(h=>hi(p,h)).map(h=>window.SUBSCALES[h].desc).join(' ')}</span>`;
      else if(any) t2 += `<br><span class="sub">하위척도 중 T 65 이상인 척도가 없다. 상승이 여러 요소에 고르게 걸쳐 있다.</span>`;
    }
    add(s5, b==='low'?'info':(t>=75?'warn':'info'), t2);
  });
  // 4번 상승 원인 감별
  if(hi(p,'Pd') && has(p,'Pd1') && has(p,'Pd2')){
    if(v(p,'Pd1')>=65 && v(p,'Pd2')<65) add(s5,'warn','4번 상승은 Pd1(가족 불화)이 주도하고 Pd2(권위 불화)는 정상이다. 반사회적 행동보다 가족 갈등을 반영하므로 “반사회적”이라고 서술하지 않는다.');
    else if(v(p,'Pd2')>=65) add(s5,'info','Pd2(권위 불화)가 상승했다. 규칙 위반과 권위 갈등의 과거력을 확인한다.');
  }
  if(hi(p,'Pa') && has(p,'Pa1')){
    if(v(p,'Pa1')>=65) add(s5,'warn','Pa1(피해의식)이 상승했다. 피해적 사고가 6번 상승의 핵심이다.');
    else if(hi(p,'Pa2')) add(s5,'info','6번 상승은 피해의식보다 Pa2(예민성)가 주도한다. 정서적 취약성과 상처받음으로 해석한다.');
  }
  if(hi(p,'Sc') && has(p,'Sc6')){
    if(v(p,'Sc6')<65 && (hi(p,'Sc1')||hi(p,'Sc2')||hi(p,'Sc4'))) add(s5,'warn','8번 상승은 Sc6(기태적 감각 경험)보다 소외와 무감동(Sc1·Sc2·Sc4)이 주도한다. 정신증보다 극심한 고통과 소외 쪽 가설이 우세하다.');
    else if(v(p,'Sc6')>=65 && hi(p,'Sc3')) add(s5,'warn','Sc6(기태적 감각 경험)와 Sc3(인지적 자아통합 결여)가 함께 상승했다. 지각 이상과 사고 통제의 상실이 있다.');
  }
  // 조합 조절
  if(hi(p,'D') && lo(p,'Ma',45)) add(s5,'warn',`2번 상승과 9번 저하(${p.Ma})가 함께 있다. 활력이 고갈된 우울이며, 자살 위험 평가가 필요하다.`);
  if(hi(p,'D') && hi(p,'Ma')) add(s5,'warn','2번과 9번이 함께 상승했다. 초조성 우울이나 혼재성 기분 상태를 평가한다.');
  if(hi(p,'Pt') && hi(p,'Sc')) add(s5,'info', v(p,'Pt')>=v(p,'Sc') ? '7번 ≥ 8번: 혼란에 대해 아직 불안해하며 싸우고 있다(자아이질적). 예후가 상대적으로 낫다.' : '8번 > 7번: 혼란이 더 만성화되었거나 받아들여진 상태다. 더 심각한 양상이다.');
  if(hi(p,'Pd') && has(p,'D') && has(p,'Pt') && v(p,'D')<55 && v(p,'Pt')<55) add(s5,'warn','4번이 높은데 2·7번이 낮다. 불편감과 죄책감이 거의 없어 변화 동기가 낮다.');
  if(hi(p,'Pd') && lo(p,'Si',45)) add(s5,'info','4번 상승에 0번이 낮다. 외향적이고 사교적인 행동화 양식으로, 첫인상이 좋을 수 있다.');
  if(sex==='M' && hi(p,'Pd') && has(p,'Mf')) add(s5,'info', v(p,'Mf')>=60 ? '남성 4번 상승에 5번이 높다. 행동화가 더 세련되고 간접적인 형태로 나타날 수 있다.' : (v(p,'Mf')<45 ? '남성 4번 상승에 5번이 낮다. 행동화가 더 직접적이고 거친 형태일 수 있다.' : ''));

  // RC 비교
  const pairs=[['Hs','RC1','신체 증상 호소'],['D','RC2','낮은 긍정 정서(무쾌감)'],['Pd','RC4','반사회적 행동'],['Pa','RC6','피해의식'],['Pt','RC7','역기능적 부정 정서'],['Sc','RC8','기태적 경험'],['Ma','RC9','경조증적 활성화']];
  const rcItems=[];
  if(has(p,'RCd')){ const x=v(p,'RCd'); if(x>=80) rcItems.push({tag:'warn',text:`RCd ${x}: 극심한 의기소침과 무력감이 있다. 자살사고 평가가 필요하다.`}); else if(x>=65) rcItems.push({tag:'info',text:`RCd ${x}: 불행하고 의기소침하며 상황에 압도되어 있다. 여러 임상척도에 비특이적 고통이 섞여 있다.`}); }
  pairs.forEach(([c,rc,name])=>{
    if(!has(p,c)||!has(p,rc)) return; const ct=v(p,c), rt=v(p,rc);
    if(ct>=65 && rt>=65) rcItems.push({tag:'ok',text:`${NUM[c]}번 ${ct} · ${rc} ${rt}: 핵심 구성개념(${name})이 확인된다.`});
    else if(ct>=65 && rt<65) rcItems.push({tag:'warn',text:`${NUM[c]}번 ${ct}이지만 ${rc} ${rt}: ${name}은 약하다. ${hi(p,'RCd')?'상승은 주로 의기소침(RCd)':'상승은 다른 요소(하위척도 확인)'} 때문일 가능성이 있다.`});
    else if(ct<65 && rt>=65) rcItems.push({tag:'info',text:`${rc} ${rt}이지만 ${NUM[c]}번 ${ct}: ${name}이 존재하지만 임상척도에서는 희석되었다.`});
  });
  if(has(p,'Hy')&&has(p,'RC3')){
    if(hi(p,'Hy') && v(p,'RC3')<45) rcItems.push({tag:'info',text:`3번 ${p.Hy} · RC3 ${p.RC3}: 냉소를 부인하고 타인을 순진하게 신뢰한다. 히스테리형 부인 양식이다.`});
    if(hi(p,'RC3')) rcItems.push({tag:'info',text:`RC3 ${p.RC3}: 타인이 이기적이고 믿을 수 없다는 냉소적 신념이 있다.`});
  }
  if(rcItems.length){ const s5b={n:'5b', title:'RC 척도 검증', items:rcItems}; steps.push(s5b); }

  /* 6. 내용·보충·PSY-5 */
  const s6 = {n:6, title:'내용·보충척도·PSY-5로 확인 및 보완', items:[]}; steps.push(s6);
  if(limitLate) add(s6,'warn','F(B)가 높아 이 단계의 척도는 참고만 한다.');
  ['ANX','FRS','OBS','DEP','HEA','BIZ','ANG','CYN','ASP','TPA','LSE','SOD','FAM','WRK','TRT'].forEach(k=>{
    if(hi(p,k)){ const sc=S[k]; add(s6, (k==='BIZ'||k==='DEP'||k==='ANG')&&v(p,k)>=75?'warn':'info', `<b>${sc.abbr} ${p[k]}</b> (${sc.name}) — ${(v(p,k)>=75&&sc.bands.vhigh)||sc.bands.high}`); }
  });
  if(has(p,'A')&&has(p,'R')){
    const A=v(p,'A'), R=v(p,'R'); let q=null;
    if(A>=60 && R<60) q='A↑R↓: 고통을 드러내는 유형이다. 불편감이 치료 동기가 된다.';
    else if(A<60 && R>=60) q='A↓R↑: 부인과 억압이 주된 방어다. 고통을 인정하지 않는다.';
    else if(A>=60 && R>=60) q='A↑R↑: 고통스럽지만 억제되어 있다. 내면의 불안을 드러내지 않는다.';
    if(q) add(s6,'info',`A ${A} · R ${R} — ${q}`);
  }
  if(has(p,'Es')){ const x=v(p,'Es'); if(x<40) add(s6,'warn',`Es ${x}: 심리적 자원이 고갈되어 있다. 초기에는 지지와 안정화가 필요하고, 통찰 지향 치료의 예후는 신중하게 판단한다.`); else if(x>=65 && avail.filter(k=>v(p,k)>=65).length>=2) add(s6,'info',`Es ${x}: 심리적 자원이 있으나, 여러 척도가 상승한 상태에서는 문제를 부인하는 것일 수 있다.`); else if(x>=60) add(s6,'ok',`Es ${x}: 적응 자원이 양호하다.`); }
  if(lo(p,'Re')&& hi(p,'Pd')) add(s6,'info',`Re ${p.Re}: 사회 규범과 책임을 거부한다. 4번 상승의 반사회적 측면을 지지한다.`);
  if(lo(p,'Do')) add(s6,'info',`Do ${p.Do}: 자신감과 주도성이 부족하다.`);
  if(hi(p,'Mt')) add(s6,'info',`Mt ${p.Mt}: 대학생이라면 학업 적응에 어려움이 있다(비효율감, 비관).`);
  if(hi(p,'PK')) add(s6,'info',`PK ${p.PK}: 정서적 고통이 강하다. PTSD에 특이적이지 않으므로 외상 노출력을 확인한다.`);
  if(hi(p,'MDS',60)) add(s6,'info',`MDS ${p.MDS}: 결혼생활의 불화(기혼자에게만 해석).`);
  if(hi(p,'OH')) add(s6,'info',`O-H ${p.OH}: 분노를 과잉통제하다가 드물게 폭발할 수 있다.`);
  if(hi(p,'Ho')) add(s6,'info',`Ho ${p.Ho}: 냉소적 적대감과 불신.`);
  // 물질
  const mac=v(p,'MACR'), aas=v(p,'AAS'), aps=v(p,'APS');
  if(mac!==null||aas!==null||aps!==null){
    const m = mac!==null&&mac>=65, a2 = aas!==null&&aas>=60, ap = aps!==null&&aps>=65;
    if(m&&a2) add(s6,'warn',`MAC-R ${mac} · AAS ${aas}${aps!==null?' · APS '+aps:''}: 물질 남용의 성격적 취약성이 있고 문제를 인정한다. 물질 남용 가능성이 매우 높다.`);
    else if(m&&!a2) add(s6,'warn',`MAC-R ${mac} 상승, AAS ${aas??'-'} 정상: 취약성은 있으나 인정하지 않는다. 부인하거나 위양성일 수 있다(외향적이고 활동적인 사람).`);
    else if(!m&&a2) add(s6,'warn',`AAS ${aas} 상승: 물질 사용 문제를 인정한다. 면담으로 확인한다.`);
    else if(ap) add(s6,'info',`APS ${aps}: 물질 남용자와 유사한 생활양식이 있다.`);
  }
  // PSY-5
  ['AGGR','PSYC','DISC','NEGE','INTR'].forEach(k=>{ if(hi(p,k)) add(s6,'info',`<b>${k} ${p[k]}</b> (${S[k].name}) — ${S[k].bands.high}`); });
  if(lo(p,'DISC')) add(s6,'info',`DISC ${p.DISC}: 과잉통제되어 있고 규칙을 중시하며 위험을 회피한다.`);
  if(lo(p,'INTR')) add(s6,'info',`INTR ${p.INTR}: 긍정 정서가 풍부하고 사교적이다${hi(p,'Ma')?'. 9번 상승과 함께라면 고양된 기분일 수 있다':''}.`);
  if(hi(p,'RC2') && hi(p,'INTR')) add(s6,'info','RC2와 INTR이 모두 높다. 기질적으로 낮은 긍정 정서 위에 우울이 생겼다.');
  if(!s6.items.length) add(s6,'ok','내용·보충척도에서 특이 사항이 없다.');

  /* 7. 위험 지표 */
  const s7 = {n:7, title:'위험 지표 점검 (면담으로 확인)', items:[]}; steps.push(s7);
  const ck = code?code.key:'';
  const sui = []; if(hi(p,'D',75)) sui.push('D '+p.D); if(hi(p,'RCd',75)) sui.push('RCd '+p.RCd); if(hi(p,'DEP',75)) sui.push('DEP '+p.DEP); if(['28','278','27','24'].includes(ck)) sui.push(ck.split('').join('-')+' 코드'); if(hi(p,'D')&&lo(p,'Ma',45)) sui.push('2↑ 9↓'); if(hi(p,'Sc2')) sui.push('Sc2 '+p.Sc2);
  if(sui.length){ add(s7,'warn',`자살: ${sui.join(', ')} → 자살사고, 계획, 수단, 과거 시도, 보호 요인을 직접 평가한다. DEP4와 결정적 문항을 검토한다.`); flags.push('suicide'); }
  const agg=[]; if(hi(p,'Pd',75)&&hi(p,'Ma',70)) agg.push('4·9 고상승'); if(hi(p,'AGGR')) agg.push('AGGR '+p.AGGR); if(hi(p,'ANG',70)) agg.push('ANG '+p.ANG); if(hi(p,'OH',70)) agg.push('O-H '+p.OH); if(hi(p,'RC4',75)) agg.push('RC4 '+p.RC4);
  if(agg.length){ add(s7,'warn',`공격성·폭력: ${agg.join(', ')} → 폭력 과거력과 표적, 물질과의 결합을 확인한다. 위험성 평가는 별도의 구조화된 도구로 한다.`); flags.push('violence'); }
  const sub=[]; if(hi(p,'MACR')) sub.push('MAC-R '+p.MACR); if(hi(p,'AAS',60)) sub.push('AAS '+p.AAS); if(hi(p,'APS')) sub.push('APS '+p.APS); if(['24','49','247'].includes(ck)) sub.push(ck.split('').join('-')+' 코드');
  if(sub.length){ add(s7,'warn',`물질 사용: ${sub.join(', ')} → 사용 빈도와 양, 기능 손상, 금단을 평가한다.`); flags.push('substance'); }
  const psy=[]; if(hi(p,'RC8')) psy.push('RC8 '+p.RC8); if(hi(p,'BIZ',70)) psy.push('BIZ '+p.BIZ); if(hi(p,'PSYC')) psy.push('PSYC '+p.PSYC); if(hi(p,'RC6',70)) psy.push('RC6 '+p.RC6); if(['68','89','689','69','48'].includes(ck)) psy.push(ck.split('').join('-')+' 코드');
  if(psy.length){ add(s7,'warn',`정신증: ${psy.join(', ')} → 환각, 망상, 사고장애를 면담에서 평가하고 약물 평가를 고려한다.`); flags.push('psychosis'); }
  const mood=[]; if(hi(p,'Ma',80)) mood.push('9번 '+p.Ma); if(hi(p,'RC9',75)) mood.push('RC9 '+p.RC9); if(hi(p,'D')&&hi(p,'Ma')) mood.push('2·9 동반 상승');
  if(mood.length){ add(s7,'warn',`기분 삽화: ${mood.join(', ')} → 수면 욕구 감소, 과대성, 과소비, 사고 비약, 과거 우울 삽화를 확인하고 양극성장애 평가를 의뢰한다.`); flags.push('mood'); }
  if(!s7.items.length) add(s7,'ok','두드러진 위험 지표가 없다(위험이 없다는 결론이 아니라 지표가 없다는 뜻이다).');

  /* 8. 치료 시사점 */
  const s8 = {n:8, title:'치료 시사점', items:[]}; steps.push(s8);
  if(code && code.ct && code.ct.tx) add(s8,'info',code.ct.tx);
  const distress = (hi(p,'D')||hi(p,'Pt')||hi(p,'RCd')||hi(p,'A'));
  if(distress) add(s8,'ok','고통이 있어 변화 동기로 작용할 수 있다.');
  if(hi(p,'TRT')) add(s8,'warn',`TRT ${p.TRT}: 치료에 부정적이며 조기 종결 위험이 있다. 초기 회기에 동기를 강화하고 치료 동맹 형성에 공을 들인다.`);
  if(hi(p,'Si')) add(s8,'info','0번이 높아 치료 관계를 형성하는 속도가 느리다. 집단치료보다 개인치료로 시작하는 것을 고려한다.');
  if(hi(p,'Pa')||hi(p,'RC6')) add(s8,'info','의심과 예민성이 있으므로 투명하고 예측 가능한 구조를 제공하고, 직면하지 않는다.');
  if(hi(p,'Hs')||hi(p,'Hy')) add(s8,'info','신체 증상의 실재성을 인정하고 행동의학적 틀(통증과 스트레스 관리)에서 시작한다.');
  if((hi(p,'Pd')||hi(p,'Ma')) && !distress) add(s8,'warn','행동화 경향이 있고 불편감이 낮다. 외부 구조와 결과 중심 계약이 필요하다.');
  if(under) add(s8,'info','방어적 응답 양식이 있었다. 피드백할 때 강점을 먼저 인정하면 저항이 줄어든다.');

  return {steps, validity, vText, code, flags, stopClinical, under, over};
}


/* ───────── MMPI-A(청소년) 해석 ───────── */
function analyzeA(p, ctx){
  const SA = {}; (window.SCALES_A||[]).forEach(s=>{ if(s.id) SA[s.id]=s; });
  const setting = ctx.setting||'outpatient', sex = ctx.sex||'M';
  const steps=[], flags=[]; let validity='valid', stop=false, limitLate=false, under=false, over=false;
  const add=(st,tag,text)=>st.items.push({tag,text});
  const gz = (k)=> has(p,k) && v(p,k)>=60 && v(p,k)<65;

  const s1={n:1,title:'맥락 확인 (청소년)',items:[]}; steps.push(s1);
  add(s1,'info',`MMPI-A 청소년 규준(14~18세)으로 해석한다. 장면: ${SETTINGS[setting]||setting}. 성별: ${sex==='F'?'여자':'남자'}.`);
  add(s1,'info','K 교정을 하지 않는다. T ≥ 65를 임상적 상승으로, T 60~64를 경계(음영) 범위로 해석에 포함한다.');
  add(s1,'info','청소년은 대부분 의뢰되어 온다(부모, 학교, 법원). 의뢰한 사람이 누구인지가 응답 태도에 영향을 준다. 독해력을 확인했는지 점검한다.');

  const s2={n:2,title:'타당도 판단 (MMPI-A 기준)',items:[]}; steps.push(s2);
  if(has(p,'CNS')){ const c=v(p,'CNS'); if(c>=30){ add(s2,'stop',`무응답 ${c}개(≥30): 해석하지 않는다.`); validity='invalid'; stop=true; } else if(c>=10){ add(s2,'warn',`무응답 ${c}개: 결측이 몰린 척도를 확인한다. 독해 곤란과 관련될 수 있다.`); validity='caution'; } else add(s2,'ok',`무응답 ${c}개: 문제없음.`); }
  if(has(p,'VRIN')){ const x=v(p,'VRIN'); if(x>=75){ add(s2,'stop',`VRIN ${x}(≥75, 청소년 기준): 무선반응으로 해석하지 않는다. 독해력, 주의력, 피로, 동기를 확인하고, 필요하면 문항을 읽어 주는 방식으로 재검사한다.`); validity='invalid'; stop=true; } else if(x>=70){ add(s2,'warn',`VRIN ${x}(70~74): 비일관 응답 가능성이 있다.`); if(validity==='valid') validity='caution'; } else add(s2,'ok',`VRIN ${x}: 일관되게 응답했다.`); }
  if(has(p,'TRIN')){ const x=v(p,'TRIN'), d=p.TRINdir||'T'; if(x>=75){ add(s2,'stop',`TRIN ${x}${d}(≥75): 고정반응으로 해석하지 않는다.`); validity='invalid'; stop=true; } else if(x>=70){ add(s2,'warn',`TRIN ${x}${d}: 고정반응 경향이 있다.`); if(validity==='valid') validity='caution'; } else add(s2,'ok',`TRIN ${x}${d}: 고정반응이 없다.`); }
  if(!stop){
    const F=v(p,'F'), F1=v(p,'F1'), F2=v(p,'F2');
    if(F!==null){
      if(F>=90){ add(s2,'warn',`F ${F}(≥90): 내용 무관 응답은 배제되었다. MMPI-A에는 Fp가 없으므로 과대보고(도움 요청, 이차 이득)와 매우 심한 정신병리를 면담, 부모·학교 정보, 행동 관찰로 감별한다.`); validity='caution'; over=true; }
      else if(F>=80) add(s2,'info',`F ${F}: 심한 고통이나 정신병리를 인정한다${setting==='inpatient'?' (입원 장면에서는 흔하다)':''}. 외부 자료와 일치하는지 확인한다.`);
      else if(F>=65) add(s2,'info',`F ${F}: 문제와 고통을 인정한다. 반항적이고 비관습적인 태도도 F를 올릴 수 있다.`);
      else add(s2,'ok',`F ${F}: 비전형 응답이 없다.`);
    }
    if(F1!==null && F2!==null){
      if(F2>=90 && F1<80){ add(s2,'warn',`F2 ${F2}이 F1 ${F1}보다 높다: 후반부에서 응답의 질이 떨어졌다(피로, 주의). 기본 임상척도는 해석하고 내용·보충척도는 제한한다.`); limitLate=true; }
      else if(F1>=90 && F2<80) add(s2,'warn',`F1 ${F1}이 F2 ${F2}보다 높다: 전반부(기본 임상척도) 응답을 조심스럽게 해석한다.`);
    }
    const L=v(p,'L'), K=v(p,'K');
    if(L!==null){ if(L>=65){ add(s2,'warn',`L ${L}: 과소보고 가능성이 있다. 의뢰한 어른에게 “문제없음”을 보이려는 시도인지, 순진하고 미성숙한 자기제시인지(IMM 확인) 구분한다.`); under=true; if(validity==='valid') validity='caution'; } else if(L>=60) add(s2,'info',`L ${L}(경계): 다소 관습적이고 방어적인 자기제시를 한다.`); }
    if(K!==null){ if(K>=65){ add(s2,'warn',`K ${K}: 방어적이며 문제를 축소한다. MMPI-A는 K 교정을 하지 않으므로 임상척도에 보정이 들어가지 않는다.`); under=true; if(validity==='valid') validity='caution'; } else if(K<=40) add(s2,'info',`K ${K}: 자기비판적이고 자원이 고갈되어 있으며 고통을 강하게 호소한다.`); }
  }
  const vText = validity==='invalid'?'해석 불가':validity==='caution'?'해석 가능(주의)':'타당';
  s2.verdict=vText;
  if(stop){ steps.push({n:3,title:'임상 해석 보류',items:[{tag:'stop',text:'타당도 기준을 충족하지 않아 임상척도와 내용척도를 해석하지 않는다. 높은 임상 점수가 보여도 응답 양식의 결과이므로 병리의 근거로 기술하지 않는다.'},{tag:'info',text:'청소년의 무효 프로파일은 그 자체로 정보다. 독해 곤란, 주의력 문제, 피로, 검사 거부의 의미를 평가하고 재검사 계획을 세운다.'}]}); return {steps,validity,vText,code:null,flags,stopClinical:true,under,over,version:'A'}; }

  const s3={n:3,title:'상승도와 프로파일 모양',items:[]}; steps.push(s3);
  const avail=CODE_SCALES.filter(k=>has(p,k));
  let code=null;
  if(avail.length){
    const mean=avail.reduce((a,k)=>a+v(p,k),0)/avail.length;
    const n65=avail.filter(k=>v(p,k)>=65).length, n60=avail.filter(k=>v(p,k)>=60&&v(p,k)<65).length;
    add(s3,'info',`8개 임상척도 평균 T = ${mean.toFixed(1)}. T 65 이상 ${n65}개, 경계 범위(60~64) ${n60}개.`);
    if(n65===0 && n60>0) add(s3,'warn','청소년 임상 집단에서는 실제 문제가 있어도 정상 범위 프로파일이 흔하다. 경계 범위 척도를 의미 있게 해석한다.');
  }
  const s4={n:4,title:'코드타입 (청소년 적용 원칙)',items:[]}; steps.push(s4);
  if(avail.length>=3){
    const r=avail.map(k=>({k,t:v(p,k)})).sort((a,b)=>b.t-a.t); const [top,sec,thd]=r;
    let key='WNL', label='정상 범위 (WNL)', def=null, members=[];
    if(top.t<60){ add(s4,'info','모든 임상척도가 T 60 미만이다. 과소보고와 의뢰 맥락을 확인한다.'); }
    else if(top.t<65){ add(s4,'info',`가장 높은 척도가 ${NUM[top.k]}번(${top.t})으로 경계 범위다. 코드타입 대신 경계 범위 척도의 의미를 중심으로 해석한다.`); label='경계 범위 프로파일'; }
    else if(sec.t<65){ key=NUM[top.k]; members=[top.k]; def=top.t-sec.t; label=`${NUM[top.k]} 단독 상승`; add(s4,'info',`${NUM[top.k]}번(${top.t}) 단독 상승. 두 번째 척도와 ${def}T 차이.`); }
    else { members=[top.k,sec.k]; key=[NUM[top.k],NUM[sec.k]].sort().join(''); def=thd?sec.t-thd.t:null; label=`${NUM[top.k]}-${NUM[sec.k]} 코드`; add(s4,'info',`${label}: ${NUM[top.k]}번 ${top.t}, ${NUM[sec.k]}번 ${sec.t}.`); if(thd&&thd.t>=65) add(s4,'info',`세 번째 척도 ${NUM[thd.k]}번(${thd.t})도 65 이상이다. 함께 고려한다.`); }
    if(def!==null && members.length){ if(def>=5) add(s4,'ok',`정의 수준 ${def}T: 잘 정의된 코드다. 청소년 코드타입 기술을 신중하게 적용한다.`); else add(s4,'warn',`정의 수준 ${def}T(<5): 청소년은 코드 안정성이 낮다. 코드타입보다 개별 척도를 중심으로 해석한다.`); }
    const ca=(window.CODETYPES_A||{})[key];
    if(ca){ add(s4,'info',`<b>${ca.title}</b> — ${ca.core}`); add(s4,'warn','성인과의 차이: '+ca.adult); }
    else if(members.length){ const c2=window.CODETYPES[key]; if(c2) add(s4,'info',`성인 코드타입(${c2.title}) 문헌을 참고하되, 청소년에게 그대로 적용하지 않는다. 핵심: ${c2.core}`); }
    code={key,label,def,members,ct:ca?{tx:ca.tx}:null};
  }

  const s5={n:5,title:'척도별 의미와 청소년 관점',items:[]}; steps.push(s5);
  const ANOTE={}; (window.SCALES_A||[]).forEach(s=>{ if(s.ref) ANOTE[s.ref]=s.aNote; });
  ['Hs','D','Hy','Pd','Mf','Pa','Pt','Sc','Ma','Si'].forEach(k=>{
    if(!has(p,k)) return; const t=v(p,k); if(k==='Mf' || t<60) return; const sc=S[k];
    let txt = t>=75?(sc.bands.vhigh||sc.bands.high):t>=65?sc.bands.high:sc.bands.mod;
    let s = `<b>${NUM[k]}번 ${sc.abbr} ${t}${t<65?' (경계)':''}</b> — ${txt}<br><span class="sub">청소년: ${ANOTE[k]||''}</span>`;
    if(sc.hl && t>=65){ const hs=sc.hl.filter(h=>hi(p,h)); if(hs.length) s+=`<br><span class="sub">하위척도: ${hs.map(h=>`${h} ${window.SUBSCALES[h].name}(${p[h]})`).join(', ')}</span>`; }
    add(s5, t>=75?'warn':'info', s);
  });
  if((hi(p,'Pd')||gz('Pd'))){
    const fam = hi(p,'Afam')||hi(p,'Pd1'), con = hi(p,'Acon');
    if(fam && !con) add(s5,'warn','4번 상승은 가족 갈등(A-fam, Pd1)이 주도하고 품행 문제(A-con)는 정상이다. “비행”이나 “반사회적”이라고 기술하지 않는다.');
    else if(con) add(s5,'info','A-con이 상승했다. 4번 상승이 실제 품행 문제(규칙 위반, 절도, 무단결석 등)와 관련된다.');
  }
  if(hi(p,'Sc')){
    const psy = hi(p,'Abiz')||hi(p,'Sc6')||hi(p,'PSYC');
    if(psy && (hi(p,'Abiz')&&(hi(p,'Sc6')||hi(p,'PSYC')))) add(s5,'warn','8번 상승에 A-biz와 Sc6·PSYC가 함께 올랐다. 청소년이라도 정신증 가능성을 진지하게 평가한다. 물질 사용(ACK, PRO, 약물 검사)을 배제한다.');
    else add(s5,'info','청소년의 8번 상승은 소외, 정체성 혼란, 학대 경험, 극심한 고통에서 비롯되는 경우가 많다. A-biz와 Sc6가 높지 않으면 정신증보다 이쪽 가설이 우세하다.');
  }
  if(hi(p,'D') && (hi(p,'Pd')||hi(p,'Aang'))) add(s5,'info','우울과 함께 4번 또는 분노가 상승했다. 청소년 우울이 짜증, 분노, 행동 문제로 표현되는 양상이다.');
  if(hi(p,'Pd') && hi(p,'Ma')) add(s5,'warn','4·9번 동반 상승: 행동화가 실행될 에너지가 있다. 규칙 위반과 위험 행동을 확인한다.');
  if(hi(p,'Si')) add(s5,'info','0번 상승은 또래 관계의 어려움과 위축을 반영하며, 행동화를 억제하는 방향으로 작용한다.');

  const s6={n:6,title:'내용·보충척도와 PSY-5',items:[]}; steps.push(s6);
  if(limitLate) add(s6,'warn','F2가 높아 이 단계의 척도는 참고만 한다.');
  ['Aanx','Aobs','Adep','Ahea','Aaln','Abiz','Aang','Acyn','Acon','Alse','Alas','Asod','Afam','Asch','Atrt'].forEach(k=>{
    if(!has(p,k)) return; const t=v(p,k); const sc=SA[k];
    if(t>=65) add(s6, (k==='Adep'||k==='Abiz')&&t>=70?'warn':'info', `<b>${sc.abbr} ${t}</b> (${sc.name}) — ${sc.bands.high}`);
    else if(t>=60 && ['Adep','Afam','Asch','Acon','Aaln'].includes(k)) add(s6,'info',`${sc.abbr} ${t}(경계): ${sc.name} 영역의 어려움이 시사된다.`);
  });
  const mac=v(p,'MACR'), ack=v(p,'ACK'), pro=v(p,'PRO');
  if(mac!==null||ack!==null||pro!==null){
    const m=mac!==null&&mac>=65, a=ack!==null&&ack>=65, pr=pro!==null&&pro>=65, ag=ack!==null&&ack>=60&&ack<65;
    if((m||pr)&&a) add(s6,'warn',`물질: MAC-R ${mac??'-'}, PRO ${pro??'-'}, ACK ${ack}. 취약성(또는 위험 환경)이 있고 사용을 인정한다. 물질 사용 문제 가능성이 높다.`);
    else if((m||pr)&&!a) add(s6,'warn',`물질: MAC-R ${mac??'-'}, PRO ${pro??'-'}${ag?`, ACK ${ack}(경계, 일부 인정)`:`, ACK ${ack??'-'}`}. 위험 특성은 있으나 충분히 인정하지 않는다. 부인이거나 문제가 시작되기 전 단계일 수 있다(예방적 개입).`);
    else if(a) add(s6,'warn',`ACK ${ack}: 물질 사용 문제를 인정한다. 면담으로 확인한다.`);
  }
  if(hi(p,'IMM')) add(s6,'info',`<b>IMM ${p.IMM}</b> — ${SA.IMM.bands.high} 행동 문제를 고착된 성격보다 발달 수준의 관점에서 이해하고, 기술 훈련과 구조 제공 중심으로 개입한다.`);
  if(has(p,'A')&&has(p,'R')){ const A=v(p,'A'),R=v(p,'R'); if(A>=60&&R<60) add(s6,'info',`A ${A} · R ${R}: 고통을 드러내는 유형이다.`); else if(A<60&&R>=60) add(s6,'info',`A ${A} · R ${R}: 억압하고 부인하는 유형이다.`); }
  ['AGGR','PSYC','DISC','NEGE','INTR'].forEach(k=>{ if(hi(p,k)) add(s6,'info',`<b>${k} ${p[k]}</b> (${S[k].name}) — ${S[k].bands.high}`); });
  if(!s6.items.length) add(s6,'ok','특이 사항이 없다.');

  const s7={n:7,title:'위험 지표 점검 (청소년)',items:[]}; steps.push(s7);
  const ck=code?code.key:'';
  const sui=[]; if(hi(p,'D',70)) sui.push('D '+p.D); if(hi(p,'Adep')) sui.push('A-dep '+p.Adep); if(hi(p,'Aaln',70)) sui.push('A-aln '+p.Aaln); if(['28','24'].includes(ck)) sui.push(ck.split('').join('-')+' 코드'); if(hi(p,'D')&&lo(p,'Ma',45)) sui.push('2↑ 9↓');
  if(sui.length){ add(s7,'warn',`자해·자살: ${sui.join(', ')} → 자살사고, 계획, 자해 과거력을 즉시 평가하고 결정적 문항(우울·자살사고 영역)을 확인한다. 비밀보장의 한계에 따라 보호자에게 알린다.`); flags.push('suicide'); }
  const agg=[]; if(hi(p,'Acon',70)) agg.push('A-con '+p.Acon); if(hi(p,'Aang',70)) agg.push('A-ang '+p.Aang); if(hi(p,'AGGR')) agg.push('AGGR '+p.AGGR); if(ck==='49') agg.push('4-9 코드');
  if(agg.length){ add(s7,'warn',`공격성·비행: ${agg.join(', ')} → 폭력, 무기, 괴롭힘(가해/피해), 비행 또래를 확인한다.`); flags.push('violence'); }
  const sub=[]; if(hi(p,'MACR')) sub.push('MAC-R '+p.MACR); if(hi(p,'ACK',60)) sub.push('ACK '+p.ACK); if(hi(p,'PRO')) sub.push('PRO '+p.PRO);
  if(sub.length){ add(s7,'warn',`물질: ${sub.join(', ')} → 사용 물질, 빈도, 또래 맥락, 기능 손상을 평가한다.`); flags.push('substance'); }
  const ps=[]; if(hi(p,'Abiz')) ps.push('A-biz '+p.Abiz); if(hi(p,'PSYC')) ps.push('PSYC '+p.PSYC); if(hi(p,'Sc',75)&&hi(p,'Sc6')) ps.push('Sc·Sc6');
  if(ps.length){ add(s7,'warn',`정신증: ${ps.join(', ')} → 환각, 망상, 사고장애를 평가한다. 청소년은 위양성이 많으므로 약물과 외상을 함께 감별한다.`); flags.push('psychosis'); }
  const sch=[]; if(hi(p,'Asch')) sch.push('A-sch '+p.Asch); if(hi(p,'Alas')) sch.push('A-las '+p.Alas);
  if(sch.length){ add(s7,'warn',`학업 중단: ${sch.join(', ')} → 출결, 성적 변화, 학습장애·ADHD 가능성을 확인한다.`); flags.push('school'); }
  if(hi(p,'Afam',70)) add(s7,'info',`A-fam ${p.Afam}: 가출 위험과 가정 내 학대 가능성을 확인한다.`);
  if(!s7.items.length) add(s7,'ok','두드러진 위험 지표가 없다.');

  const s8={n:8,title:'치료 시사점 (청소년)',items:[]}; steps.push(s8);
  if(code&&code.ct&&code.ct.tx) add(s8,'info',code.ct.tx);
  if(hi(p,'Afam')||hi(p,'Pd1')) add(s8,'info','가족 갈등이 핵심이다. 가족 치료나 부모 교육을 치료 계획에 포함한다.');
  if(hi(p,'Asch')||hi(p,'Alas')) add(s8,'info','학교와 협력한다(출결, 학습 지원, 대안 교육). 진로 목표와 연결해 동기를 높인다.');
  if(hi(p,'Atrt')) add(s8,'warn',`A-trt ${p.Atrt}: 어른의 도움을 믿지 않는다. 청소년이 원하는 목표에서 시작하는 동기강화 접근을 쓴다.`);
  if(hi(p,'IMM')) add(s8,'info','미성숙 수준에 맞춰 구체적이고 짧은 목표, 즉각적인 피드백, 기술 훈련 중심으로 구성한다.');
  add(s8,'info','다중 정보원(부모·교사 보고, 학교 기록)과 통합하고, 보고서에는 “이 시점의 상태”임을 명시한다. 18세 미만에게는 성격장애 진단을 신중하게 다룬다.');
  return {steps,validity,vText,code,flags,stopClinical:false,under,over,version:'A'};
}

/* 프로파일을 AI 프롬프트용 텍스트로 */
function profileText(p, ver){
  if(ver==='A') return GROUPS_A.map(([g,ks])=>{ const xs=ks.filter(k=>has(p,k)).map(k=>`${LAB_A[k]||k}=${p[k]}${k==='TRIN'?(p.TRINdir||'T'):''}`); return xs.length? `${g}: ${xs.join(', ')}`:''; }).filter(Boolean).join('\n');
  const groups = [['타당도',['CNS','VRIN','TRIN','F','Fb','Fp','FBS','L','K','S']],['임상',['Hs','D','Hy','Pd','Mf','Pa','Pt','Sc','Ma','Si']],['RC',['RCd','RC1','RC2','RC3','RC4','RC6','RC7','RC8','RC9']],['내용',['ANX','FRS','OBS','DEP','HEA','BIZ','ANG','CYN','ASP','TPA','LSE','SOD','FAM','WRK','TRT']],['보충',['A','R','Es','Do','Re','Mt','PK','MDS','Ho','OH','MACR','AAS','APS','GM','GF']],['PSY-5',['AGGR','PSYC','DISC','NEGE','INTR']],['하위척도',Object.keys(window.SUBSCALES)]];
  return groups.map(([g,ks])=>{ const xs=ks.filter(k=>has(p,k)).map(k=>`${k}=${p[k]}${k==='TRIN'?(p.TRINdir||'T'):''}`); return xs.length? `${g}: ${xs.join(', ')}`:''; }).filter(Boolean).join('\n');
}

const GROUPS_A = [
  ['타당도',['CNS','VRIN','TRIN','F1','F2','F','L','K']],
  ['임상',['Hs','D','Hy','Pd','Mf','Pa','Pt','Sc','Ma','Si']],
  ['내용',['Aanx','Aobs','Adep','Ahea','Aaln','Abiz','Aang','Acyn','Acon','Alse','Alas','Asod','Afam','Asch','Atrt']],
  ['보충',['MACR','ACK','PRO','IMM','A','R']],
  ['PSY-5',['AGGR','PSYC','DISC','NEGE','INTR']],
  ['하위척도',['D1','D2','D3','D4','D5','Hy1','Hy2','Hy3','Hy4','Hy5','Pd1','Pd2','Pd3','Pd4','Pd5','Pa1','Pa2','Pa3','Sc1','Sc2','Sc3','Sc4','Sc5','Sc6','Ma1','Ma2','Ma3','Ma4','Si1','Si2','Si3']],
];
const LAB_A = {Aanx:'A-anx',Aobs:'A-obs',Adep:'A-dep',Ahea:'A-hea',Aaln:'A-aln',Abiz:'A-biz',Aang:'A-ang',Acyn:'A-cyn',Acon:'A-con',Alse:'A-lse',Alas:'A-las',Asod:'A-sod',Afam:'A-fam',Asch:'A-sch',Atrt:'A-trt',MACR:'MAC-R'};
window.MMPI = {analyze, profileText, NUM, SETTINGS, has, GROUPS_A, LAB_A};
})();
