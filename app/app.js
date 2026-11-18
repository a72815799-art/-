(function(){
const $ = (s,el=document)=>el.querySelector(s);
const app = $('#app');
// claude.ai 뷰어 밖(HTML 파일로 열었을 때)에는 window.claude가 없다
const STANDALONE = !window.claude;
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S = {}; SCALES.forEach(s=>S[s.id]=s);
const NUM = MMPI.NUM;

/* ── 개인 진도 (브라우저 저장, 실패해도 동작) ── */
const store = {
  get(k,d){ try{ const v=localStorage.getItem('mmpi.'+k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem('mmpi.'+k, JSON.stringify(v)); }catch(e){} if(/^(prog|draft\.|drill|lab$)/.test(k)) Sync.changed(); },
  keys(prefix){ try{ return Object.keys(localStorage).filter(k=>k.startsWith('mmpi.'+prefix)).map(k=>k.slice(5)); }catch(e){ return []; } }
};
let prog = store.get('prog', {mods:{}, quiz:{}, cases:{}});
const saveProg = ()=> store.set('prog', prog);

/* ── 클래스 모드 동기화 (artifact db). 쓸 수 없으면 이 브라우저 저장만으로 계속 동작한다 ── */
const Sync = {
  status:'connecting', reason:'', db:null, user:null, uid:null, admin:false,
  assignments:[], timer:null, busy:false, again:false, lastProgress:null, lastResults:null, subs:[],
  changed(){ if(this.status!=='synced') return; clearTimeout(this.timer); this.timer=setTimeout(()=>this.push(), 2000); },
  notify(){ const el=document.getElementById('sync'); if(!el) return;
    const map={connecting:['','연결 중'], synced:['ok','동기화됨'], local:['', '이 브라우저에만 저장'], readonly:['warn','읽기 전용']};
    const [cls,txt]=map[this.status]||map.local; el.className='chip sync-chip '+cls; el.textContent=txt; el.title=this.reason||''; el.hidden=false; },
  async push(){
    if(this.status!=='synced') return;
    if(this.busy){ this.again=true; return; }
    this.busy=true;
    try{
      const L = gatherLocal();
      if(!CLASSDATA.hasActivity(L)){ this.busy=false; return; }
      if(!CLASSDATA.same(L, this.lastProgress)){ await this.db.doc(`data/users/${this.uid}/progress`).set({v:CLASSDATA.SCHEMA, local:L, updatedAt:new Date().toISOString()}); this.lastProgress=L; }
      const R = CLASSDATA.buildResults(L, CASES, QUIZ, MODULES);
      if(!CLASSDATA.same(R, this.lastResults)){ await this.db.doc(`results/${this.uid}`).set(Object.assign({}, R, {updatedAt:new Date().toISOString()})); this.lastResults=R; }
    }catch(e){ this.fail(e); }
    this.busy=false; if(this.again){ this.again=false; this.push(); }
  },
  fail(e){
    const code = e && e.code;
    if(code==='invalid_argument'){ this.status='readonly'; this.reason='이 문서에서는 기록을 저장할 권한이 없습니다. 운영자에게 “기여자(Contributor)” 이상으로 공유해 달라고 요청하세요. 기록은 이 브라우저에 계속 저장됩니다.'; }
    else if(code==='quota_exceeded'){ this.status='readonly'; this.reason='공유 저장소 용량이 가득 찼습니다. 운영자에게 알려 주세요. 기록은 이 브라우저에 계속 저장됩니다.'; }
    else if(code==='unavailable'){ return; }
    else { this.status='local'; this.reason='공유 저장소에 연결하지 못했습니다. 기록은 이 브라우저에 저장됩니다.'; }
    this.notify();
  },
};

/* 이 브라우저의 기록 묶음 */
function gatherLocal(){
  const drafts={}; for(const k of store.keys('draft.')){ const d=store.get(k,null); if(d) drafts[k.slice(6)]=d; }
  const lab = store.get('lab', {});
  return {prog:{mods:prog.mods||{}, quiz:prog.quiz||{}, cases:prog.cases||{}}, drafts, drill:store.get('drill',{}), labQuiz:(lab.quiz||{n:0,ok:0})};
}
/* 합친 기록을 이 브라우저에 반영(동기화 신호는 보내지 않는다) */
function applyLocal(L){
  const raw=(k,v)=>{ try{ localStorage.setItem('mmpi.'+k, JSON.stringify(v)); }catch(e){} };
  prog = {mods:L.prog.mods, quiz:L.prog.quiz, cases:L.prog.cases}; raw('prog', prog);
  for(const [id,d] of Object.entries(L.drafts)) raw('draft.'+id, d);
  raw('drill', L.drill);
  const lab = store.get('lab', null); if(lab){ lab.quiz = L.labQuiz; raw('lab', lab); } else raw('lab', {base:'', sex:'M', mix:{random:0,bias:0,over:0,under:0}, quiz:L.labQuiz});
  if(typeof labState!=='undefined' && labState) labState.quiz = L.labQuiz;
}

async function initSync(){
  try{
    const [db,user] = window.claude?.use ? await Promise.all([window.claude.use('db'), window.claude.use('user')]) : [null,null];
    if(!db || !user){ Sync.status='local'; Sync.reason='이 화면에서는 공유 저장소를 쓸 수 없습니다(로그인하지 않았거나 claude.ai 밖에서 열었습니다). 기록은 이 브라우저에 저장됩니다.'; Sync.notify(); return; }
    Sync.db=db; Sync.user=user; Sync.uid = await user.id(); Sync.admin = await user.canEdit();
    const canWrite = await user.can('data.write');   // null = 플랫폼이 알려 주지 않음 → 쓰기를 시도해 보고 거부되면 판단
    if(canWrite===false && !Sync.admin){ Sync.fail({code:'invalid_argument'}); try{ const a = await db.doc('class/assignments').get(); Sync.assignments = a.exists ? (a.data().items||[]) : []; }catch(e){} return; }
    if(!Sync.uid){ Sync.status='local'; Sync.reason='이 문서에서 사용자 정보를 받을 수 없어 기록을 이 브라우저에만 저장합니다.'; Sync.notify(); return; }
    let remote=null;
    try{ const snap = await db.doc(`data/users/${Sync.uid}/progress`).get(); if(snap.exists) remote = snap.data().local || null; }
    catch(e){ Sync.fail(e); return; }
    const merged = CLASSDATA.mergeLocal(gatherLocal(), remote);
    const changedHere = !CLASSDATA.same(merged, gatherLocal());
    applyLocal(merged);
    Sync.lastProgress = remote;
    Sync.status='synced'; Sync.reason='학습 기록이 계정에 저장되어 다른 기기에서도 이어집니다.'; Sync.notify();
    await Sync.push();
    try{ const a = await db.doc('class/assignments').get(); Sync.assignments = a.exists ? (a.data().items||[]) : []; }catch(e){}
    const r=(location.hash||'#home').slice(1);
    if(changedHere || ['home','class','cases'].includes(r)) route();
  }catch(e){ Sync.status='local'; Sync.reason='공유 저장소에 연결하지 못했습니다. 기록은 이 브라우저에 저장됩니다.'; Sync.notify(); }
}


/* ── Claude(sample) ── */
let samplePromise = null;
function getSample(){ if(!samplePromise) samplePromise = (window.claude?.use ? window.claude.use('sample') : Promise.resolve(null)).catch(()=>null); return samplePromise; }
const errCopy = c => ({not_granted:'Claude 사용이 허용되지 않았습니다. 이 기능은 이번 방문에서 숨깁니다.', rate_limited:'요청이 많습니다. 잠시 후 다시 시도하세요.', session_expired:'로그인이 만료되었습니다. 다시 로그인하세요.', refused:'이 요청에는 답할 수 없습니다. 내용을 바꿔 다시 시도하세요.', sampling_disabled:'이 계정에서는 Claude를 사용할 수 없습니다.', prompt_too_large:'입력이 너무 깁니다. 답안을 줄여 보세요.'}[c] || '연결에 문제가 있습니다. 다시 시도하세요.');

/* ── 간단한 마크다운 렌더러 ── */
function md(src){
  const lines = esc(src).split('\n'); let out=''; let i=0; let list=null;
  const inline = t => t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>');
  const close = ()=>{ if(list){ out+=`</${list}>`; list=null; } };
  while(i<lines.length){
    const l = lines[i];
    if(/^\s*\|.*\|\s*$/.test(l) && i+1<lines.length && /^\s*\|[\s:\-|]+\|\s*$/.test(lines[i+1])){
      close(); const row = r=> r.trim().replace(/^\||\|$/g,'').split('|').map(c=>inline(c.trim()));
      const h=row(l); i+=2; let body='';
      while(i<lines.length && /^\s*\|.*\|\s*$/.test(lines[i])){ body+='<tr>'+row(lines[i]).map(c=>`<td>${c}</td>`).join('')+'</tr>'; i++; }
      out+=`<div class="tblwrap"><table><tr>${h.map(c=>`<th>${c}</th>`).join('')}</tr>${body}</table></div>`; continue;
    }
    let m;
    if((m=l.match(/^#{1,4}\s+(.*)/))){ close(); out+=`<h3>${inline(m[1])}</h3>`; }
    else if((m=l.match(/^\s*[-*]\s+(.*)/))){ if(list!=='ul'){ close(); out+='<ul>'; list='ul'; } out+=`<li>${inline(m[1])}</li>`; }
    else if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){ if(list!=='ol'){ close(); out+='<ol>'; list='ol'; } out+=`<li>${inline(m[1])}</li>`; }
    else if(l.trim()===''){ close(); }
    else { close(); out+=`<p>${inline(l)}</p>`; }
    i++;
  }
  close(); return out;
}

/* ── 프로파일 차트(SVG) ── */
function chart(p, opt={}){
  const VAL= opt.ver==='A' ? ['VRIN','TRIN','F1','F2','F','L','K'] : ['VRIN','TRIN','F','Fb','Fp','FBS','L','K','S'], CLI=['Hs','D','Hy','Pd','Mf','Pa','Pt','Sc','Ma','Si'];
  const VL={Fb:'F(B)',Fp:'F(P)'}; const W=760, H=opt.h||300, top=18, bot=46, left=40, right=12;
  const gap=26, colW=(W-left-right-gap)/(VAL.length+CLI.length);
  const y = t => { const c=Math.max(20,Math.min(120,t)); return top + (120-c)/100*(H-top-bot); };
  const xs = i => left + colW*(i+.5) + (i>=VAL.length?gap:0);
  let g='';
  for(let t=20;t<=120;t+=10){ const yy=y(t); const strong = t===65||t===50;
    g+=`<line x1="${left}" x2="${W-right}" y1="${yy}" y2="${yy}" stroke="${t===65?'var(--plot)':'var(--line)'}" stroke-width="${strong?1.4:0.7}" ${t===50?'stroke-dasharray="4 3"':''}/>`;
    g+=`<text x="${left-6}" y="${yy+4}" text-anchor="end" font-size="10.5" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${t}</text>`; }
  const sep = left+colW*VAL.length+gap/2;
  g+=`<line x1="${sep}" x2="${sep}" y1="${top}" y2="${H-bot}" stroke="var(--line)" stroke-width="1"/>`;
  const all=[...VAL,...CLI];
  all.forEach((k,i)=>{ const lab = CLI.includes(k)? NUM[k] : (VL[k]||k);
    g+=`<text x="${xs(i)}" y="${H-bot+16}" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--ink)" font-family="IBM Plex Mono, monospace">${lab}</text>`;
    if(CLI.includes(k)) g+=`<text x="${xs(i)}" y="${H-bot+30}" text-anchor="middle" font-size="9.5" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${S[k].abbr}</text>`;
  });
  const line = (keys, off)=>{ const pts = keys.map((k,i)=>[k,i+off]).filter(([k])=>MMPI.has(p,k));
    if(!pts.length) return '';
    let s = `<polyline fill="none" stroke="var(--ink)" stroke-width="1.6" points="${pts.map(([k,i])=>`${xs(i).toFixed(1)},${y(+p[k]).toFixed(1)}`).join(' ')}"/>`;
    pts.forEach(([k,i])=>{ const t=+p[k], h=t>=65; s+=`<circle cx="${xs(i).toFixed(1)}" cy="${y(t).toFixed(1)}" r="${h?4.2:3.4}" fill="${h?'var(--plot)':'var(--surface)'}" stroke="${h?'var(--plot)':'var(--ink)'}" stroke-width="1.5"/>`;
      if(opt.labels!==false) s+=`<text x="${xs(i).toFixed(1)}" y="${(y(t)-8).toFixed(1)}" text-anchor="middle" font-size="10" fill="${h?'var(--plot)':'var(--muted)'}" font-family="IBM Plex Mono, monospace">${t}</text>`; });
    return s; };
  if(opt.band){ const b=1.96*opt.band; CLI.forEach((k,j)=>{ if(!MMPI.has(p,k)) return; const i=j+VAL.length, t=+p[k], x=xs(i);
      g+=`<rect x="${(x-6).toFixed(1)}" y="${y(t+b).toFixed(1)}" width="12" height="${(y(t-b)-y(t+b)).toFixed(1)}" rx="3" fill="var(--accent)" fill-opacity="0.16"/>`; }); }
  if(opt.ghost){ const gl=(keys,off)=>{ const pts=keys.map((k,i)=>[k,i+off]).filter(([k])=>MMPI.has(opt.ghost,k)); return pts.length?`<polyline fill="none" stroke="var(--muted)" stroke-width="1.3" stroke-dasharray="5 4" points="${pts.map(([k,i])=>`${xs(i).toFixed(1)},${y(+opt.ghost[k]).toFixed(1)}`).join(' ')}"/>`:''; };
    g+=gl(VAL,0)+gl(CLI,VAL.length); }
  g += line(VAL,0) + line(CLI,VAL.length);
  g+=`<text x="${left-6}" y="${y(65)+4}" text-anchor="end" font-size="10.5" font-weight="600" fill="var(--plot)" font-family="IBM Plex Mono, monospace">65</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="MMPI-2 프로파일 차트">${g}</svg>`;
}

/* ── 점수표 ── */
const GROUPS = [
  ['타당도',['CNS','VRIN','TRIN','F','Fb','Fp','FBS','L','K','S']],
  ['임상',['Hs','D','Hy','Pd','Mf','Pa','Pt','Sc','Ma','Si']],
  ['RC',['RCd','RC1','RC2','RC3','RC4','RC6','RC7','RC8','RC9']],
  ['내용',['ANX','FRS','OBS','DEP','HEA','BIZ','ANG','CYN','ASP','TPA','LSE','SOD','FAM','WRK','TRT']],
  ['보충',['A','R','Es','Do','Re','Mt','PK','MDS','Ho','OH','MACR','AAS','APS','GM','GF']],
  ['PSY-5',['AGGR','PSYC','DISC','NEGE','INTR']],
  ['하위척도',Object.keys(SUBSCALES)],
];
const lab = k => MMPI.LAB_A[k] ? MMPI.LAB_A[k] : k==='CNS'?'?':k==='Fb'?'F(B)':k==='Fp'?'F(P)':k==='OH'?'O-H':k==='MACR'?'MAC-R':(NUM[k]&&S[k]?NUM[k]+' '+S[k].abbr:k);
const groupsFor = ver => ver==='A' ? MMPI.GROUPS_A : GROUPS;
function scoreTable(p, ver){
  return `<div class="scoretbl stack" style="gap:10px">${groupsFor(ver).map(([g,ks])=>{ const xs=ks.filter(k=>MMPI.has(p,k)); if(!xs.length) return '';
    return `<table><tr><th class="gl">${g}</th>${xs.map(k=>`<th>${esc(lab(k))}</th>`).join('')}</tr><tr><td></td>${xs.map(k=>{ const t=+p[k]; const h = k!=='CNS' && (t>=65 || (k==='MDS'&&t>=60) || (k==='AAS'&&t>=60)); return `<td class="${h?'h':''}">${t}${k==='TRIN'?(p.TRINdir||'T'):''}</td>`; }).join('')}</tr></table>`; }).join('')}</div>`;
}

/* ── 라우터 ── */
const routes = {home:viewHome, theory:viewTheory, scales:viewScales, codes:viewCodes, analyzer:viewAnalyzer, cases:viewCases, quiz:viewQuiz, mentor:viewMentor, compare:viewCompare, lab:viewLab, stability:viewStability, class:viewClass};
function route(){
  const h = (location.hash||'#home').slice(1);
  let r = h, arg=null;
  if(h.startsWith('module-')){ r='theory'; arg=h.slice(7); }
  else if(h.startsWith('case-')){ r='cases'; arg=h.slice(5); }
  else if(h==='cases-teen'){ r='cases'; arg='#teen'; }
  if(!routes[r]) r='home';
  const tab = r==='stability' ? 'lab' : r;
  document.querySelectorAll('#tabs a').forEach(a=>a.classList.toggle('on', a.dataset.r===tab));
  app.innerHTML=''; routes[r](arg); window.scrollTo(0,0);
}
window.addEventListener('hashchange', route);

/* ════════ 커리큘럼(홈) ════════ */
function viewHome(){
  const sample = CASES[0];
  const modsDone = Object.keys(prog.mods).length, casesDone = Object.keys(prog.cases).length;
  const qAns = Object.keys(prog.quiz).length, qRight = Object.values(prog.quiz).filter(Boolean).length;
  const casesBest = Object.values(prog.cases).map(c=>c.score||0);
  const avgCase = casesBest.length? Math.round(casesBest.reduce((a,b)=>a+b,0)/casesBest.length):0;
  const crit = [
    [modsDone>=MODULES.length, `이론 모듈 ${MODULES.length}개 완료 (${modsDone}/${MODULES.length})`],
    [qAns>=QUIZ.length && qRight/QUIZ.length>=0.85, `퀴즈 정답률 85% 이상 (${qRight}/${QUIZ.length})`],
    [casesDone>=CASES.length, `사례 ${CASES.length}개 해석 제출 (${casesDone}/${CASES.length})`],
    [casesDone>=CASES.length && avgCase>=80, `사례 핵심 포인트 평균 80% 이상 (현재 ${avgCase}%)`],
  ];
  app.innerHTML = `
  ${STANDALONE ? `<div class="panel" style="border-left:3px solid var(--warn); margin-bottom:24px"><h3 style="font-size:16px">오프라인 파일 버전입니다</h3><p class="note" style="margin:6px 0 0">이론, 사전, 분석기, 실험실, 사례 실습(자가 점검·모범 해석), 퀴즈를 모두 쓸 수 있습니다. AI 슈퍼바이저 코칭과 우리 반(기록 동기화·반 통계)은 claude.ai 링크 버전에서만 동작합니다. 학습 기록은 이 브라우저에 저장되므로 같은 기기, 같은 브라우저로 열어야 이어집니다.</p></div>` : ''}
  <section class="hero">
    <div>
      <div class="eyebrow">대학원 수련생을 위한 MMPI-2 해석 훈련</div>
      <h1 style="margin-top:8px">척도 하나가 아니라<br>프로파일 전체를 읽는 법</h1>
      <p class="lede">이론, 척도 사전, 코드타입, 규칙 기반 프로파일 분석기, 성인 ${CASES.filter(c=>c.version!=='A').length}개·청소년 ${CASES.filter(c=>c.version==='A').length}개 가상 사례 실습, 슈퍼바이저 코칭을 8단계로 구성했습니다. 성인용 MMPI-2와 청소년용 MMPI-A를 함께 다룹니다. 숙련된 임상가가 프로파일을 볼 때 따르는 순서인 타당도 → 코드타입 → 하위척도·RC로 검증 → 내용·보충척도로 확인 → 위험 평가 → 통합을 반복해서 연습합니다.</p>
      <div class="row" style="margin-top:16px">
        <a class="btn pri" href="#module-m01">1단계부터 시작</a>
        <a class="btn" href="#case-c01">첫 사례 풀어 보기</a>
        <a class="btn" href="#analyzer">분석기 열기</a>
      </div>
    </div>
    <div class="chartwrap">
      <div class="row" style="justify-content:space-between; padding:2px 6px 4px"><span class="eyebrow">예시 프로파일 · 사례 1</span><span class="chip acc">7-2 코드</span></div>
      ${chart(sample.p,{h:260})}
    </div>
  </section>
  <div class="grid2" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); align-items:start">
    <section class="stack">
      <h2>8단계 커리큘럼</h2>
      <div class="level-list">${LEVELS.map(L=>{
        const mods = MODULES.filter(m=>m.level===L.n);
        let links = mods.map(m=>`<a href="#module-${m.id}" class="${prog.mods[m.id]?'done':''}">${prog.mods[m.id]?'✓ ':''}${esc(m.title)}</a>`).join('');
        let tot = mods.length, done = mods.filter(m=>prog.mods[m.id]).length;
        if(L.n===2) links += `<a href="#quiz">타당도 퀴즈</a><a href="#lab">응답 양식 실험실</a>`;
        if(L.n===3) links += `<a href="#scales">척도 사전</a>`;
        if(L.n===4) links += `<a href="#codes">코드타입 사전</a><a href="#stability">코드타입 안정성 실험</a>`;
        if(L.n===6) links += `<a href="#analyzer">프로파일 분석기</a>`;
        if(L.n===7){ const ad=CASES.filter(c=>c.version!=='A'); tot=ad.length; done=ad.filter(c=>prog.cases[c.id]).length; links = `<a href="#cases">성인 사례 ${ad.length}개</a><a href="#mentor">슈퍼바이저에게 질문</a>`; }
        if(L.n===8){ const ac=CASES.filter(c=>c.version==='A'); links += `<a href="#compare">성인 vs 청소년 비교</a><a href="#cases-teen">청소년 사례 ${ac.length}개</a>`; tot+=ac.length; done+=ac.filter(c=>prog.cases[c.id]).length; }
        const pct = tot? Math.round(done/tot*100):0;
        return `<div class="level"><div class="lv">단계<b>${L.n}</b></div><div style="min-width:0"><h3>${esc(L.name)}</h3><div class="goal">${esc(L.goal)}</div><div class="links">${links}</div></div><div class="meterbox"><div class="meter"><i style="width:${pct}%"></i></div><div class="note mono" style="text-align:right">${done}/${tot}</div></div></div>`;
      }).join('')}</div>
    </section>
    <aside class="stack">
      <div class="panel">
        <h3>수료 기준</h3>
        <p class="note">네 가지를 모두 충족하면 이 과정의 목표 수준에 도달한 것입니다.</p>
        <ul class="kp" style="margin-top:8px">${crit.map(([ok,t])=>`<li class="${ok?'hit':'miss'}" style="grid-template-columns:22px minmax(0,1fr)"><span class="mk">${ok?'✓':'○'}</span><span>${esc(t)}</span></li>`).join('')}</ul>
      </div>
      <div class="panel">
        <h3>공부하는 방법</h3>
        <ol style="padding-left:20px; margin:8px 0 0; font-size:14px">
          <li>각 단계의 이론을 읽고 퀴즈로 확인합니다.</li>
          <li>사례는 <b>분석기를 보기 전에</b> 직접 해석합니다.</li>
          <li>자가 점검으로 놓친 포인트를 확인합니다.</li>
          <li>슈퍼바이저 코칭을 받고 모범 해석과 비교합니다.</li>
          <li>같은 사례를 일주일 뒤 다시 풀어 봅니다.</li>
        </ol>
      </div>
      <div class="panel flat note">
        모든 사례는 교육용으로 만든 가상 자료입니다. 검사 문항은 저작권 보호 대상이라 담지 않았습니다. 해석 기준은 Graham(2012), Greene(2011), Butcher 외(2001), Ben-Porath(2012), Friedman 외(2015) 등 출판된 문헌을 요약했습니다. 실제 임상 판단에는 공식 매뉴얼, 한국 규준, 자격을 갖춘 전문가의 감독이 필요합니다. 학습 진도는 이 브라우저에만 저장됩니다.
      </div>
    </aside>
  </div>
  <footer>MMPI-2는 미네소타 대학교의 등록상표입니다. 이 학습 도구는 출판사와 관련이 없습니다.</footer>`;
}

/* ════════ 이론 ════════ */
function viewTheory(id){
  if(id){
    const m = MODULES.find(x=>x.id===id); if(!m){ location.hash='#theory'; return; }
    const idx = MODULES.indexOf(m), next = MODULES[idx+1], prev = MODULES[idx-1];
    const lv = LEVELS.find(L=>L.n===m.level);
    app.innerHTML = `<article class="module stack">
      <div><a href="#theory" class="note">← 이론 목록</a></div>
      <div><div class="eyebrow">단계 ${m.level} · ${esc(lv.name)} · 약 ${m.min}분</div><h1 style="margin-top:6px; font-size:32px">${esc(m.title)}</h1></div>
      <div class="body">${m.html.replace(/<table class="tbl">/g,'<div class="tblwrap"><table class="tbl">').replace(/<\/table>/g,'</table></div>')}</div>
      <div class="row" style="justify-content:space-between; border-top:1px solid var(--line); padding-top:16px">
        <button class="btn ${prog.mods[m.id]?'':'pri'}" id="done">${prog.mods[m.id]?'✓ 학습 완료됨':'학습 완료로 표시'}</button>
        <div class="row">${prev?`<a class="btn" href="#module-${prev.id}">← 이전</a>`:''}${next?`<a class="btn" href="#module-${next.id}">다음: ${esc(next.title)} →</a>`:`<a class="btn" href="#cases">사례 실습으로 →</a>`}</div>
      </div></article>`;
    $('#done').onclick = e=>{ prog.mods[m.id]=true; saveProg(); e.target.textContent='✓ 학습 완료됨'; e.target.classList.remove('pri'); };
    return;
  }
  app.innerHTML = `<div class="stack" style="max-width:820px"><div><div class="eyebrow">이론</div><h1 style="margin-top:6px">해석의 원리</h1><p class="lede" style="margin-top:8px">단계 순서대로 읽기를 권합니다. 각 모듈 끝의 슈퍼바이저 노트에는 수련 현장에서 반복해서 강조하는 판단 기준을 담았습니다.</p></div>
    ${LEVELS.filter(L=>MODULES.some(m=>m.level===L.n)).map(L=>`<section class="stack" style="gap:8px"><h3>단계 ${L.n} · ${esc(L.name)}</h3><div class="modlist">${MODULES.filter(m=>m.level===L.n).map(m=>`<a href="#module-${m.id}"><span>${prog.mods[m.id]?'<span style="color:var(--ok)">✓</span> ':''}${esc(m.title)}</span><span class="m-meta">${m.min}분</span></a>`).join('')}</div></section>`).join('')}
  </div>`;
}

/* ════════ 척도 사전 ════════ */
function viewScales(){
  const G = [['all','전체'],['validity','타당도'],['clinical','임상'],['rc','RC'],['content','내용'],['supp','보충'],['psy5','PSY-5']];
  let g = store.get('scaleGroup','all'), q='', ver = store.get('scaleVer','2');
  app.innerHTML = `<div class="stack"><div><div class="eyebrow">척도 사전</div><h1 style="margin-top:6px">척도별 의미와 전문가 해석</h1><p class="lede" style="margin-top:8px">상승 수준별 기술, 하위척도, 전문가 해석 포인트, 흔한 오류를 담았습니다. 척도를 누르면 펼쳐집니다. 청소년용(MMPI-A)을 고르면 청소년 고유 척도와 같은 척도의 청소년 해석 차이를 볼 수 있습니다.</p></div>
  <div class="seg" id="vseg"><button data-v="2" class="${ver!=='A'?'on':''}">MMPI-2 성인</button><button data-v="A" class="${ver==='A'?'on':''}">MMPI-A 청소년</button></div>
  <div class="row" style="justify-content:space-between"><div class="seg" id="seg"></div><input type="search" id="sq" placeholder="척도 검색 (예: Pd, 우울, A-sch)" style="max-width:280px"></div>
  <div class="stack" id="list" style="gap:8px"></div></div>`;
  const bandName = {invalid:'해석불가', caution:'주의', normal:'정상', low:'낮음', mod:'60~64', high:'높음', vhigh:'매우 높음'};
  const GN = {validity:'타당도',clinical:'임상',rc:'RC',content:'내용',supp:'보충',psy5:'PSY-5'};
  const listFor = ()=> ver==='A' ? SCALES_A.map(x=> x.ref ? Object.assign({}, S[x.ref], {aNote:x.aNote, shared:true}) : Object.assign({}, x, {only:!S[x.id]})) : SCALES;
  const drawSeg = ()=>{ const gs = G.filter(([k])=> k==='all' || listFor().some(s=>s.group===k)); if(!gs.some(([k])=>k===g)) g='all';
    $('#seg').innerHTML = gs.map(([k,n])=>`<button data-g="${k}" class="${k===g?'on':''}">${n}</button>`).join(''); };
  const draw = ()=>{
    const ql = q.trim().toLowerCase();
    const xs = listFor().filter(s=>(g==='all'||s.group===g) && (!ql || (s.abbr+s.id+s.name+s.measures).toLowerCase().includes(ql)));
    $('#list').innerHTML = xs.map(s=>`<details class="scale-card"><summary><span class="ab">${s.num?s.num+' ':''}${esc(s.abbr)}</span><span class="nm">${esc(s.name)}</span><span class="chip ${ver==='A'&&s.only?'warn':''}">${GN[s.group]}${ver==='A'&&s.only&&!['VRIN','TRIN','F','L','K'].includes(s.id)?' · 청소년 고유':''}${ver==='A'&&s.group==='validity'?' · 청소년 기준':''}${ver!=='A'&&s.kcorr?' · '+s.kcorr:''}</span><span class="ms">${esc(s.measures)}</span></summary>
      <div class="in"><div class="bands">${Object.entries(s.bands).map(([k,t])=>`<div><span class="k">${bandName[k]||k}</span><span>${esc(t)}</span></div>`).join('')}</div>
      ${s.aNote?`<div class="expert" style="background:var(--warn-soft)"><b style="color:var(--warn)">청소년(MMPI-A)에서는</b> ${esc(s.aNote)}</div>`:''}
      ${s.hl?`<div class="note" style="margin-top:6px">하위척도</div><div class="bands">${s.hl.map(h=>`<div><span class="k">${h}</span><span><b>${esc(SUBSCALES[h].name)}</b> — ${esc(SUBSCALES[h].desc)}</span></div>`).join('')}</div>`:''}
      ${s.expert?`<div class="expert"><b>전문가 포인트</b> ${esc(s.expert)}</div>`:''}
      ${s.pitfalls&&s.pitfalls.length?`<div class="note" style="margin-top:8px">흔한 오류: ${s.pitfalls.map(esc).join(' / ')}</div>`:''}</div></details>`).join('') || '<p class="note">검색 결과가 없습니다.</p>';
  };
  $('#vseg').onclick = e=>{ const b=e.target.closest('button'); if(!b) return; ver=b.dataset.v; store.set('scaleVer',ver); document.querySelectorAll('#vseg button').forEach(x=>x.classList.toggle('on',x===b)); drawSeg(); draw(); };
  $('#seg').onclick = e=>{ const b=e.target.closest('button'); if(!b) return; g=b.dataset.g; store.set('scaleGroup',g); document.querySelectorAll('#seg button').forEach(x=>x.classList.toggle('on',x===b)); draw(); };
  $('#sq').oninput = e=>{ q=e.target.value; draw(); };
  drawSeg(); draw();
}

/* ════════ 코드타입 ════════ */
function viewCodes(){
  let ver = store.get('codeVer','2');
  app.innerHTML = `<div class="stack"><div><div class="eyebrow">코드타입 사전</div><h1 style="margin-top:6px">코드타입별 핵심 특징</h1><p class="lede" style="margin-top:8px">코드타입의 기술 내용은 확정된 사실이 아니라 가설입니다. 정의 수준, 상승도, 하위척도, RC 척도로 이 사람에게 맞는지 검증한 뒤 사용합니다. 청소년용에서는 각 코드가 성인과 어떻게 다르게 해석되는지 함께 보여 줍니다.</p></div>
  <div class="seg" id="cvseg"><button data-v="2" class="${ver!=='A'?'on':''}">MMPI-2 성인</button><button data-v="A" class="${ver==='A'?'on':''}">MMPI-A 청소년</button></div>
  <div id="cd"></div><div id="cgrid" class="stack"></div></div>`;
  const draw = ()=>{
    if(ver==='A'){ const keys=Object.keys(CODETYPES_A);
      $('#cgrid').innerHTML = `<p class="note">청소년 코드타입은 재검사 안정성이 낮습니다. 잘 정의된 코드(5T 이상)에만 신중하게 적용하세요.</p><div class="codegrid">${keys.map(k=>`<button class="code-card" data-k="${k}"><span class="cn">${esc(CODETYPES_A[k].title.split(' (')[0])}</span><span class="cc">${esc(CODETYPES_A[k].core)}</span></button>`).join('')}</div>`;
    } else { const keys=Object.keys(CODETYPES); const grp=[['spike','단독 상승'],['two','2개 척도 코드'],['three','3개 척도 코드'],['wnl','정상 범위']];
      $('#cgrid').innerHTML = grp.map(([t,n])=>`<section class="stack" style="gap:10px"><h3>${n}</h3><div class="codegrid">${keys.filter(k=>CODETYPES[k].type===t).map(k=>`<button class="code-card" data-k="${k}"><span class="cn">${esc(CODETYPES[k].title.split(' ')[0])}</span><span class="cc">${esc(CODETYPES[k].core)}</span></button>`).join('')}</div></section>`).join(''); }
  };
  $('#cvseg').onclick = e=>{ const b=e.target.closest('button'); if(!b) return; ver=b.dataset.v; store.set('codeVer',ver); document.querySelectorAll('#cvseg button').forEach(x=>x.classList.toggle('on',x===b)); $('#cd').innerHTML=''; draw(); };
  $('#cgrid').addEventListener('click', e=>{ const b=e.target.closest('.code-card'); if(!b) return; showCode(b.dataset.k); });
  function showCode(k){
    if(ver==='A'){ const c=CODETYPES_A[k], ad=CODETYPES[k];
      $('#cd').innerHTML = `<div class="panel code-detail"><div class="row" style="justify-content:space-between"><h2>${esc(c.title)}</h2><button class="btn sm" id="cdx">닫기</button></div>
      <p style="margin-top:8px; font-size:15.5px">${esc(c.core)}</p>
      <div class="grid2" style="margin-top:6px"><div><h4>청소년에서의 주요 특징</h4><ul>${c.features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul><h4>치료 시사점</h4><p>${esc(c.tx)}</p></div>
      <div><h4>성인과 무엇이 다른가</h4><div class="expert" style="background:var(--warn-soft); margin-top:0">${esc(c.adult)}</div>${ad?`<h4>참고: 성인 ${esc(ad.title)}</h4><p class="note">${esc(ad.core)}</p>`:''}</div></div></div>`;
    } else { const c=CODETYPES[k];
      $('#cd').innerHTML = `<div class="panel code-detail"><div class="row" style="justify-content:space-between"><h2>${esc(c.title)}</h2><button class="btn sm" id="cdx">닫기</button></div>
      <p style="margin-top:8px; font-size:15.5px">${esc(c.core)}</p>
      <div class="grid2" style="margin-top:6px"><div><h4>주요 특징</h4><ul>${c.features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>${c.order?`<h4>순서의 의미</h4><p>${esc(c.order)}</p>`:''}</div>
      <div>${c.dx.length?`<h4>감별할 진단</h4><div class="row" style="gap:6px">${c.dx.map(d=>`<span class="chip acc">${esc(d)}</span>`).join('')}</div>`:''}${c.tx?`<h4>치료 시사점</h4><p>${esc(c.tx)}</p>`:''}</div></div>
      ${c.expert?`<div class="expert"><b>전문가 포인트</b> ${esc(c.expert)}</div>`:''}${CODETYPES_A[k]?`<div class="note" style="margin-top:10px">청소년(MMPI-A)에서는 해석이 다릅니다. 위에서 “MMPI-A 청소년”을 선택해 비교하세요.</div>`:''}</div>`; }
    $('#cdx').onclick=()=>$('#cd').innerHTML=''; $('#cd').scrollIntoView({behavior:'smooth', block:'start'}); }
  draw();
}

/* ════════ 성인 vs 청소년 ════════ */
function viewCompare(){
  const C = COMPARE;
  const tbl = (head, rows)=>`<div class="tblwrap"><table class="tbl"><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===0?' style="font-weight:600; white-space:nowrap"':''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const drill = store.get('drill',{});
  const demoA = CASES.find(c=>c.id==='c13');
  app.innerHTML = `<div class="stack" style="max-width:980px">
    <div><div class="eyebrow">8단계 · 비교 학습</div><h1 style="margin-top:6px">성인용과 청소년용은 무엇이 다른가</h1><p class="lede" style="margin-top:8px">MMPI-2와 MMPI-A는 척도 이름이 같아도 규준, 타당도 기준, 해석의 의미가 다릅니다. 구조를 비교하고, 같은 프로파일 모양을 두 관점에서 읽어 본 뒤, O/X 연습으로 확인하세요.</p></div>
    <section class="panel stack" style="gap:6px"><h2>한눈에 비교</h2>${tbl(['항목','MMPI-2 (성인)','MMPI-A (청소년)'], C.overview)}</section>
    <section class="panel stack" style="gap:6px"><h2>척도 대응표</h2><p class="note">개념이 같은 척도, 청소년에게만 있는 척도, 청소년용에는 없는 척도를 구분하세요.</p>${tbl(['범주','MMPI-2','MMPI-A','비고'], C.crosswalk)}</section>
    <section class="panel stack" style="gap:10px"><h2>같은 모양, 다른 해석</h2>
      <p>아래는 청소년 사례 13번의 프로파일입니다(4-9 코드). 같은 4-9 모양을 성인 관점과 청소년 관점에서 각각 읽으면 결론이 이렇게 달라집니다.</p>
      <div class="chartwrap">${chart(demoA.p,{ver:'A',h:250})}</div>
      <div class="grid2">
        <div class="panel" style="background:var(--stop-soft); border-color:transparent"><h3 style="font-size:16px">성인 해석을 그대로 적용하면</h3><ul style="padding-left:18px; margin:8px 0 0; font-size:14px"><li>반사회성 성격 양식, 죄책감 결여</li><li>“예후가 매우 나쁘다”</li><li>외부 구조 외에는 개입 효과가 낮다</li><li>성격장애 진단을 시사</li></ul></div>
        <div class="panel" style="background:var(--ok-soft); border-color:transparent"><h3 style="font-size:16px">청소년 관점으로 읽으면</h3><ul style="padding-left:18px; margin:8px 0 0; font-size:14px"><li>청소년기에 시작된 품행 문제(발병 시기 확인)</li><li>IMM 68: 발달적 미성숙과 충동성</li><li>A-fam, A-sch: 가족 감독과 학교 적응이 핵심 개입 지점</li><li>다체계 개입으로 변화 가능성이 있다. 성격장애 진단은 하지 않는다</li></ul></div>
      </div>
      <p class="note">규준 선택도 결과를 바꿉니다. 정상 청소년의 응답을 성인 규준으로 채점하면 F, 4, 8, 9번이 높아지는 경향이 보고되었습니다. 검사지를 받으면 어떤 규준으로 채점되었는지부터 확인하세요.</p>
    </section>
    <section class="panel stack" style="gap:10px"><div class="row" style="justify-content:space-between"><h2>O/X 연습</h2><span class="chip mono" id="dscore"></span></div>
      <div class="stack" id="drill" style="gap:8px">${C.drill.map((d,i)=>`<div class="q" data-i="${i}" style="padding:14px"><p style="margin:0; font-weight:600">${i+1}. ${esc(d.q)}</p><div class="row" style="margin-top:8px"><button class="btn sm" data-a="1">O 맞다</button><button class="btn sm" data-a="0">X 틀리다</button></div><div class="ex" hidden></div></div>`).join('')}</div>
      <button class="btn sm" id="dreset" style="align-self:flex-start">다시 풀기</button></section>
    <div class="row"><a class="btn" href="#module-m12">8단계 이론 읽기</a><a class="btn" href="#codes">코드타입 사전</a><a class="btn pri" href="#cases-teen">청소년 사례 풀기</a></div>
  </div>`;
  const show = (box, i, ans)=>{ const d=C.drill[i]; const ok = (ans===1)===d.a;
    box.querySelectorAll('button[data-a]').forEach(b=>{ b.disabled=true; if(+b.dataset.a===(d.a?1:0)) b.classList.add('pri'); });
    const ex=box.querySelector('.ex'); ex.hidden=false; ex.innerHTML=`<b>${ok?'정답':'오답'} · 답은 ${d.a?'O':'X'}.</b> ${esc(d.e)}`; };
  const score = ()=>{ const ks=Object.keys(drill); $('#dscore').textContent=`정답 ${ks.filter(k=>drill[k]===C.drill[k].a).length} / ${C.drill.length}`; };
  document.querySelectorAll('#drill .q').forEach(box=>{ const i=+box.dataset.i; if(drill[i]!==undefined) show(box,i, drill[i]===C.drill[i].a?(C.drill[i].a?1:0):(C.drill[i].a?0:1)); });
  $('#drill').addEventListener('click', e=>{ const b=e.target.closest('button[data-a]'); if(!b||b.disabled) return; const box=b.closest('.q'); const i=+box.dataset.i; const a=+b.dataset.a; drill[i] = (a===1); store.set('drill',drill); show(box,i,a); score(); });
  $('#dreset').onclick = ()=>{ store.set('drill',{}); viewCompare(); };
  score();
}

/* ════════ 프로파일 분석기 ════════ */
let azState = store.get('az', {p:Object.assign({}, CASES[0].p), setting:CASES[0].setting, sex:CASES[0].sex, preset:'c01', ver:'2'});
const caseState = c => ({p:Object.assign({},c.p), setting:c.setting, sex:c.sex, preset:c.id, ver:c.version==='A'?'A':'2'});
function viewAnalyzer(){
  const st = azState;
  app.innerHTML = `<div class="stack"><div><div class="eyebrow">프로파일 분석기</div><h1 style="margin-top:6px">전문가의 8단계로 읽는 프로파일</h1><p class="lede" style="margin-top:8px">T점수를 입력하면 규칙 기반 엔진이 타당도부터 치료 시사점까지 숙련된 임상가의 사고 순서대로 가설과 근거를 정리합니다. 결과는 가설 목록이니 맥락에 맞게 고르고 통합하세요. 빈칸은 입력하지 않은 척도로 처리합니다.</p></div>
  <div class="az">
    <aside class="panel inputs" style="padding:16px">
      <div class="stack" style="gap:10px">
        <label class="f">검사<select id="ver"><option value="2" ${st.ver!=='A'?'selected':''}>MMPI-2 (성인)</option><option value="A" ${st.ver==='A'?'selected':''}>MMPI-A (청소년, 14~18세)</option></select></label>
        <label class="f">사례 불러오기<select id="preset"><option value="">직접 입력</option>${CASES.map(c=>`<option value="${c.id}" ${st.preset===c.id?'selected':''}>${c.version==='A'?'[A] ':''}사례 ${+c.id.slice(1)} · ${esc(c.title)}</option>`).join('')}</select></label>
        <div class="row" style="gap:8px; flex-wrap:nowrap"><label class="f" style="flex:1">장면<select id="setting">${Object.entries(MMPI.SETTINGS).map(([k,n])=>`<option value="${k}" ${st.setting===k?'selected':''}>${n}</option>`).join('')}</select></label>
        <label class="f" style="width:90px">성별<select id="sex"><option value="M" ${st.sex==='M'?'selected':''}>남</option><option value="F" ${st.sex==='F'?'selected':''}>여</option></select></label></div>
        <button class="btn sm" id="clear" style="align-self:flex-start">모든 점수 지우기</button>
      </div>
      <div style="margin-top:10px">${groupsFor(st.ver).map(([g,ks],gi)=>`<details ${gi<2?'open':''}><summary>${g}</summary><div class="ingrid">${ks.map(k=>`<label>${esc(lab(k))}${k==='TRIN'?'':''}<input type="number" inputmode="numeric" id="in-${k}" data-k="${k}" value="${MMPI.has(st.p,k)?st.p[k]:''}"></label>`).join('')}${g==='타당도'?`<label>TRIN 방향<select id="trindir" style="padding:5px 4px; font-size:13px"><option value="T" ${st.p.TRINdir!=='F'?'selected':''}>T</option><option value="F" ${st.p.TRINdir==='F'?'selected':''}>F</option></select></label>`:''}</div></details>`).join('')}</div>
    </aside>
    <section class="stack" style="min-width:0">
      <div class="panel chartwrap" style="padding:12px 10px 6px" id="chart"></div>
      <div class="row" style="justify-content:space-between"><div class="row" id="sumchips"></div><div class="row"><button class="btn" id="copy">보고서 초안 복사</button><button class="btn pri" id="ai" hidden>AI 슈퍼바이저 통합 해석</button></div></div>
      <div id="aiout"></div>
      <div class="stack" id="steps" style="gap:12px"></div>
    </section>
  </div></div>`;
  const save = ()=> store.set('az', azState);
  const run = ()=>{
    document.querySelectorAll('.ingrid input').forEach(i=>{ const k=i.dataset.k; i.classList.toggle('hi', k!=='CNS' && i.value!=='' && +i.value>=65); });
    $('#chart').innerHTML = chart(st.p,{ver:st.ver});
    const r = MMPI.analyze(st.p, {setting:st.setting, sex:st.sex, version:st.ver});
    const vc = r.validity==='invalid'?'stop':r.validity==='caution'?'warn':'ok';
    $('#sumchips').innerHTML = `<span class="chip ${vc}">타당도: ${r.vText}</span>${r.code?`<span class="chip acc">${esc(r.code.label)}</span>`:''}${r.flags.map(f=>`<span class="chip warn">${({suicide:'자살 위험 평가',violence:'공격성 평가',substance:'물질 평가',psychosis:'정신증 평가',mood:'기분 삽화 평가'})[f]}</span>`).join('')}`;
    $('#steps').innerHTML = r.steps.map(s=>`<div class="stepbox"><div class="sh"><span><span class="n">${s.n}</span>${esc(s.title)}</span>${s.verdict?`<span class="chip ${vc}">${s.verdict}</span>`:''}</div><ul>${s.items.filter(i=>i.text).map(i=>`<li class="${i.tag}"><span>${i.text}</span></li>`).join('')}</ul></div>`).join('');
    azState.last = r;
  };
  app.querySelectorAll('.ingrid input').forEach(i=> i.addEventListener('input', ()=>{ const k=i.dataset.k; if(i.value==='') delete st.p[k]; else st.p[k]=+i.value; st.preset=''; $('#preset').value=''; save(); run(); }));
  $('#trindir').onchange = e=>{ st.p.TRINdir=e.target.value; save(); run(); };
  $('#setting').onchange = e=>{ st.setting=e.target.value; save(); run(); };
  $('#sex').onchange = e=>{ st.sex=e.target.value; save(); run(); };
  $('#preset').onchange = e=>{ const c=CASES.find(x=>x.id===e.target.value); if(!c) return; azState=caseState(c); save(); viewAnalyzer(); };
  $('#ver').onchange = e=>{ azState={p:{TRINdir:'T'}, setting:st.setting, sex:st.sex, preset:'', ver:e.target.value}; save(); viewAnalyzer(); };
  $('#clear').onclick = ()=>{ azState={p:{TRINdir:'T'}, setting:st.setting, sex:st.sex, preset:'', ver:st.ver}; save(); viewAnalyzer(); };
  $('#copy').onclick = async e=>{
    const r = azState.last; if(!r) return;
    const txt = r.steps.map(s=>`[${s.n}. ${s.title}]\n`+s.items.map(i=>'- '+i.text.replace(/<br>/g,' ').replace(/<[^>]+>/g,'')).join('\n')).join('\n\n');
    try{ await navigator.clipboard.writeText(txt); e.target.textContent='복사됨'; }catch(_){ $('#aiout').innerHTML=`<div class="panel"><p class="note">클립보드 접근이 막혀 있습니다. 아래 내용을 선택해 복사하세요.</p><textarea style="min-height:240px">${esc(txt)}</textarea></div>`; }
    setTimeout(()=>e.target.textContent='보고서 초안 복사',1500);
  };
  run();
  getSample().then(sample=>{ if(!sample) return; const b=$('#ai'); if(!b) return; b.hidden=false;
    b.onclick = ()=>{
      const r = azState.last; const c = CASES.find(x=>x.id===st.preset);
      const ctx = c? `사례 배경(가상): ${c.demo}. 의뢰: ${c.referral} 배경: ${c.background}` : '사례 배경 정보 없음(점수만 제공됨).';
      const eng = r.steps.map(s=>`${s.n}. ${s.title}: `+s.items.map(i=>i.text.replace(/<[^>]+>/g,'')).join(' / ')).join('\n');
      const VN = st.ver==='A' ? 'MMPI-A(청소년용, 청소년 규준, K 교정 없음, T 60~64 경계 범위 해석, VRIN·TRIN 해석 불가 기준 75, Fp 없음, RC 척도 없음)' : 'MMPI-2';
      const prompt = `당신은 MMPI-2와 MMPI-A 해석 경력 25년의 임상심리전문가이자 대학원 수련 감독자입니다. 아래 ${VN} 프로파일을 전문가 수준으로 통합 해석해 주세요. 교육용 가상 자료입니다.${st.ver==='A'?' 청소년의 발달 단계를 고려하고, 성인 해석을 그대로 적용하지 말며, 성인과 다르게 해석해야 하는 지점을 명시하세요.':''}

[장면] ${MMPI.SETTINGS[st.setting]} / 성별 ${st.sex==='F'?'여성':'남성'}
[맥락] ${ctx}
[T점수]
${MMPI.profileText(st.p, st.ver)}

[규칙 기반 엔진의 1차 가설 — 그대로 옮기지 말고 검증·선별·통합할 것]
${eng}

다음 형식의 한국어 마크다운으로 작성하세요.
## 검사 태도와 타당도
## 코드타입과 핵심 특징 (정의 수준, 상승도 고려)
## 정교화: 하위척도·RC 척도로 본 상승 이유 (지표 간 수렴과 불일치를 설명)
## 내용·보충척도와 PSY-5로 본 추가 정보
## 진단적 고려 (감별 포함, 확정하지 말 것)
## 위험 요인과 면담에서 확인할 것
## 치료 시사점
## 전문가의 한 줄 사례 개념화
## 수련생을 위한 해석 포인트 (이 프로파일에서 초심자가 흔히 놓치거나 오해하는 것 3가지)
규칙: 확률적 언어를 쓰고, 근거 척도를 괄호로 표시하세요. 검사 문항 내용은 인용하지 마세요. 타당도상 해석이 불가하면 그 이유와 권고만 쓰세요.`;
      streamTo($('#aiout'), prompt, {modelTier:'complex', title:'AI 슈퍼바이저 통합 해석'});
    };
  });
}

/* 공용: 스트리밍 출력 */
function streamTo(box, input, opt={}){
  getSample().then(sample=>{
    if(!sample){ box.innerHTML='<div class="panel note">이 화면에서는 Claude를 사용할 수 없습니다.</div>'; return; }
    const ctl = new AbortController();
    box.innerHTML = `<div class="panel stack" style="gap:8px"><div class="row" style="justify-content:space-between"><h3>${esc(opt.title||'슈퍼바이저 응답')}</h3><button class="btn sm" data-stop>중지</button></div><div class="md"><p class="thinking">슈퍼바이저가 검토하고 있습니다. 깊이 검토하므로 30초~1분 정도 걸릴 수 있습니다</p></div><p class="note" data-n></p></div>`;
    const out = box.querySelector('.md'), note = box.querySelector('[data-n]'), stop = box.querySelector('[data-stop]');
    stop.onclick = ()=>ctl.abort();
    sample(input, {modelTier:opt.modelTier||'default', signal:ctl.signal, cache:opt.cache, onText:({text})=>{ out.innerHTML = md(text); }})
      .then(res=>{ stop.remove(); if(res.truncated) note.textContent='응답이 길어 중간에 끊겼습니다.'; opt.done && opt.done(res.text); })
      .catch(e=>{ stop.remove(); if(e.text) out.innerHTML = md(e.text); else if(e.code!=='cancelled') out.innerHTML=''; if(e.code!=='cancelled') note.textContent = errCopy(e.code); if(e.code==='not_granted'||e.code==='sampling_disabled') document.querySelectorAll('[data-ai]').forEach(b=>b.hidden=true); });
  });
}

/* ════════ 사례 실습 ════════ */
const FIELDS = [
  ['validity','1. 검사 태도와 타당도','무응답, VRIN·TRIN, F 계열, L·K·S를 순서대로 판단'],
  ['code','2. 코드타입과 상승도','코드, 정의 수준, 전체 상승도, 프로파일 모양'],
  ['elaboration','3. 정교화','하위척도와 RC로 본 상승 이유, 내용·보충척도, PSY-5'],
  ['dx','4. 진단적 고려','감별 진단(확정하지 말 것)'],
  ['risk','5. 위험 요인','자살, 공격성, 물질, 정신증, 면담에서 확인할 것'],
  ['tx','6. 치료 시사점','동기, 예후, 개입 방향, 치료 관계의 주의점'],
  ['summary','7. 종합 (사례 개념화)','두세 문장 요약'],
];
const norm = s => String(s||'').toLowerCase().replace(/[\s\-·]/g,'');
function viewCases(id){
  if(id && id[0]!=='#') return viewCase(id);
  if(id==='#teen') setTimeout(()=>{ const t=document.getElementById('teen'); t&&t.scrollIntoView(); },0);
  app.innerHTML = `<div class="stack"><div><div class="eyebrow">사례 실습</div><h1 style="margin-top:6px">가상 사례 ${CASES.length}개</h1><p class="lede" style="margin-top:8px">배경과 점수만 보고 직접 해석을 작성하세요. 제출하면 핵심 포인트로 자가 점검을 하고, AI 슈퍼바이저에게 영역별 피드백을 받은 뒤 모범 해석과 비교합니다. 사례 제목만으로 코드타입을 짐작하지 않도록 코드는 제출 후에 공개됩니다.</p></div>
  ${[1,2,3,'A'].map(lv=>`<section class="stack" style="gap:10px" ${lv==='A'?'id="teen"':''}><h3>${lv==='A'?'청소년 사례 (MMPI-A)':['','기초','중급','고급'][lv]+' 사례 (MMPI-2)'}</h3>${lv==='A'?'<p class="note">8단계 모듈과 성인 vs 청소년 비교를 먼저 학습하세요. 같은 척도라도 청소년에게는 기준과 의미가 다릅니다.</p>':''}<div class="casegrid">${CASES.filter(c=>lv==='A'?c.version==='A':(c.version!=='A'&&c.level===lv)).map(c=>{ const d=prog.cases[c.id];
    return `<a class="case-card" href="#case-${c.id}"><div class="row" style="justify-content:space-between"><span class="eyebrow">사례 ${+c.id.slice(1)}</span>${d?`<span class="chip ok">제출 · ${d.score}%</span>`:'<span class="chip">미제출</span>'}</div><h3 style="font-size:17px">${esc(c.title)}</h3><div class="demo">${esc(c.demo)}</div><div class="row" style="gap:6px">${(()=>{ const a=Sync.assignments.find(x=>x.caseId===c.id); return a?`<span class="chip acc">과제${a.due?' · '+esc(a.due):''}</span>`:''; })()}${c.version==='A'?'<span class="chip warn">MMPI-A</span>':''}<span class="chip">${MMPI.SETTINGS[c.setting]}</span>${d?`<span class="chip acc">${esc(c.code)}</span>`:''}</div></a>`; }).join('')}</div></section>`).join('')}</div>`;
}
function viewCase(id){
  const c = CASES.find(x=>x.id===id); if(!c){ location.hash='#cases'; return; }
  const drafts = store.get('draft.'+c.id, {});
  const submitted = !!prog.cases[c.id];
  const idx = CASES.indexOf(c), next=CASES[idx+1];
  app.innerHTML = `<div class="stack">
    <div class="row" style="justify-content:space-between"><a href="#cases" class="note">← 사례 목록</a>${next?`<a class="note" href="#case-${next.id}">다음 사례 →</a>`:''}</div>
    <div><div class="eyebrow">사례 ${+c.id.slice(1)} · ${c.version==='A'?'MMPI-A 청소년':'MMPI-2 성인'} · ${['','기초','중급','고급'][c.level]} · ${MMPI.SETTINGS[c.setting]}</div><h1 style="margin-top:6px; font-size:32px">${esc(c.title)}</h1></div>
    <div class="grid2" style="align-items:start">
      <div class="panel"><dl class="facts"><dt>인적 사항</dt><dd>${esc(c.demo)}</dd><dt>의뢰</dt><dd>${esc(c.referral)}</dd><dt>배경</dt><dd>${esc(c.background)}</dd></dl></div>
      <div class="panel chartwrap" style="padding:12px 10px 6px">${chart(c.p,{ver:c.version})}</div>
    </div>
    <details class="panel" open><summary style="cursor:pointer; font-weight:600">전체 점수표</summary><div style="margin-top:10px">${scoreTable(c.p,c.version)}</div></details>
    <section class="panel answer stack">
      <div class="row" style="justify-content:space-between"><h2>나의 해석</h2><span class="note" id="saved"></span></div>
      <p class="note">척도 이름보다 행동과 경험의 언어로, 근거 척도를 괄호에 적어 쓰세요. 작성 내용은 이 브라우저에 자동 저장됩니다.</p>
      ${FIELDS.map(([k,t,h])=>`<label class="f">${t} <small>${h}</small><textarea id="a-${k}" data-k="${k}">${esc(drafts[k]||'')}</textarea></label>`).join('')}
      <div class="row"><button class="btn pri" id="check">제출하고 자가 점검</button><button class="btn" id="coach" data-ai hidden>AI 슈퍼바이저 코칭</button><button class="btn" id="model">${submitted?'모범 해석 보기':'모범 해석 (제출 후 공개)'}</button><a class="btn" id="toaz" href="#analyzer" ${submitted?'':'hidden'}>분석기에서 열기</a></div>
    </section>
    <div id="res" class="stack"></div><div id="coachout"></div><div id="modelout"></div>
  </div>`;
  const allText = ()=> FIELDS.map(([k])=>$('#a-'+k).value).join('\n');
  let t=null;
  app.querySelectorAll('textarea[data-k]').forEach(ta=>ta.addEventListener('input', ()=>{ const d={}; FIELDS.forEach(([k])=>d[k]=$('#a-'+k).value); d._at=Date.now(); store.set('draft.'+c.id, d); clearTimeout(t); $('#saved').textContent='저장됨'; t=setTimeout(()=>$('#saved').textContent='',1200); }));
  const check = ()=>{
    const txt = norm(allText());
    const res = c.keyPoints.map(k=>({...k, hit:k.kw.some(w=>txt.includes(norm(w)))}));
    const score = Math.round(res.filter(r=>r.hit).length/res.length*100);
    $('#res').innerHTML = `<div class="panel stack" style="gap:10px"><div class="row" style="justify-content:space-between"><h3>자가 점검 · 핵심 포인트 ${res.filter(r=>r.hit).length}/${res.length}</h3><span class="chip ${score>=80?'ok':score>=50?'warn':'stop'} mono">${score}%</span></div>
      <div class="scorebar"><i style="width:${score}%"></i></div>
      <ul class="kp">${res.map(r=>`<li class="${r.hit?'hit':'miss'}"><span class="mk">${r.hit?'✓':'✗'}</span><span class="dm">${esc(r.domain)}</span><span>${esc(r.point)}</span></li>`).join('')}</ul>
      <p class="note">키워드 대조 방식이라 표현이 다르면 놓친 것으로 표시될 수 있습니다. 논리의 질은 AI 슈퍼바이저 코칭에서 평가합니다.</p>
      <div class="note"><b>이 사례에서 흔한 오류</b>: ${c.pitfalls.map(esc).join(' / ')}</div></div>`;
    return score;
  };
  $('#check').onclick = ()=>{
    if(allText().trim().length<40){ $('#res').innerHTML='<div class="panel note">해석을 조금 더 작성한 뒤 제출하세요. 최소한 타당도와 코드타입은 적어 주세요.</div>'; return; }
    const score = check(); prog.cases[c.id]={score, at:Date.now()}; saveProg();
    $('#model').textContent='모범 해석 보기'; $('#toaz').hidden=false;
    $('#toaz').onclick = ()=>{ azState=caseState(c); store.set('az',azState); };
    $('#res').scrollIntoView({behavior:'smooth', block:'start'});
  };
  if(submitted){ $('#toaz').onclick = ()=>{ azState=caseState(c); store.set('az',azState); }; }
  $('#model').onclick = ()=>{
    if(!prog.cases[c.id]){ $('#modelout').innerHTML='<div class="panel note">먼저 자신의 해석을 제출하세요. 모범 해석을 먼저 보면 학습 효과가 크게 줄어듭니다.</div>'; return; }
    const e=c.expert;
    $('#modelout').innerHTML = `<div class="panel stack" style="gap:6px"><div class="row" style="justify-content:space-between"><h2>모범 해석</h2><span class="chip acc">${esc(c.code)}</span></div>
      ${FIELDS.map(([k,tl])=>e[k]?`<h4>${tl}</h4><p>${esc(e[k])}</p>`:'').join('')}</div>`;
    $('#modelout').scrollIntoView({behavior:'smooth', block:'start'});
  };
  getSample().then(sample=>{ if(!sample) return; const b=$('#coach'); if(!b) return; b.hidden=false;
    b.onclick = ()=>{
      if(allText().trim().length<40){ $('#coachout').innerHTML='<div class="panel note">코칭을 받으려면 먼저 해석을 작성하세요.</div>'; return; }
      if(!prog.cases[c.id]){ const s=check(); prog.cases[c.id]={score:s, at:Date.now()}; saveProg(); $('#model').textContent='모범 해석 보기'; $('#toaz').hidden=false; }
      const ans = FIELDS.map(([k,tl])=>`### ${tl}\n${$('#a-'+k).value.trim()||'(작성하지 않음)'}`).join('\n\n');
      const e = c.expert;
      const prompt = `당신은 MMPI-2와 MMPI-A 해석 경력 25년의 임상심리전문가이며 대학원 수련생을 지도하는 슈퍼바이저입니다. 이 사례의 검사는 ${c.version==='A'?'MMPI-A(청소년용: 청소년 규준, K 교정 없음, T 60~64 경계 범위, VRIN·TRIN 기준 75, Fp·RC 없음)이며, 수련생이 성인 기준이나 성인 해석을 잘못 적용했는지 특히 점검하세요':'MMPI-2(성인용)입니다'}. 따뜻하지만 기준이 엄격합니다. 아래 가상 사례에 대해 수련생이 작성한 해석을 평가하고 코칭하세요.

[사례 — 교육용 가상 자료]
인적 사항: ${c.demo}
장면: ${MMPI.SETTINGS[c.setting]}
의뢰: ${c.referral}
배경: ${c.background}

[T점수]
${MMPI.profileText(c.p, c.version)}

[채점 기준: 전문가 핵심 포인트]
${c.keyPoints.map((k,i)=>`${i+1}. (${k.domain}) ${k.point}`).join('\n')}

[전문가 모범 해석 요약 — 수련생에게 통째로 보여 주지 말고 비교 기준으로만 쓸 것]
타당도: ${e.validity}
코드: ${e.code}
정교화: ${e.elaboration}
진단: ${e.dx}
위험: ${e.risk}
치료: ${e.tx}

[이 사례의 흔한 오류]
${c.pitfalls.join(' / ')}

[수련생의 해석]
${ans}

다음 형식의 한국어 마크다운으로 답하세요.
## 총평
(2~3문장. 현재 수준을 솔직하게 평가)
## 영역별 평가
| 영역 | 점수(0~5) | 코멘트 |
(영역: 타당도 판단, 코드타입·상승도, 정교화(하위척도·RC${c.version==='A'?'·청소년 고유 척도':''}), 내용·보충·PSY-5 통합, 배경·맥락${c.version==='A'?'·발달적 관점':''} 통합, 진단적 추론, 위험 평가, 치료 시사점, 보고서 언어) 표 아래에 **총점 /45**를 적으세요.
## 잘한 점
(구체적으로, 수련생이 실제로 쓴 문장을 근거로)
## 놓쳤거나 고쳐야 할 점
(근거 척도와 점수를 명시. 과잉해석, 근거 없는 단정, 진단 확정, 척도 이름을 진단명처럼 쓴 표현, 낙인적 표현을 지적하고 고쳐 쓴 예시 문장을 제시)
## 전문가는 이 프로파일을 이렇게 본다
(이 사례를 보는 사고 순서를 5~7단계로. 각 단계에서 어떤 척도를 보고 무엇을 결정하는지)
## 다음 학습 과제
(2~3개. 다음 모듈 중 해당하는 것을 이름으로 추천: ${MODULES.map(m=>m.title).join(', ')})

규칙: 수련생이 쓰지 않은 내용을 썼다고 하지 마세요. 검사 문항 내용은 인용하지 마세요. 이 사례는 교육용 가상 자료입니다.`;
      streamTo($('#coachout'), prompt, {modelTier:'complex', title:'슈퍼바이저 코칭', cache:false});
      $('#coachout').scrollIntoView({behavior:'smooth', block:'start'});
    };
  });
}

/* ════════ 퀴즈 ════════ */
function viewQuiz(){
  let lv = store.get('quizLv', 0);
  app.innerHTML = `<div class="stack" style="max-width:820px"><div><div class="eyebrow">퀴즈</div><h1 style="margin-top:6px">개념 확인 퀴즈</h1><p class="lede" style="margin-top:8px">${QUIZ.length}문항. 답을 고르면 바로 해설이 나옵니다. 가장 최근 답이 진도에 기록됩니다.</p></div>
  <div class="row" style="justify-content:space-between"><div class="seg" id="qseg">${[[0,'전체'],...LEVELS.filter(L=>QUIZ.some(q=>q.lv===L.n)).map(L=>[L.n,`${L.n}단계`])].map(([k,n])=>`<button data-l="${k}" class="${k===lv?'on':''}">${n}</button>`).join('')}</div><span class="chip mono" id="qscore"></span></div>
  <div class="stack" id="qs" style="gap:12px"></div><button class="btn" id="qreset" style="align-self:flex-start">이 범위 기록 초기화</button></div>`;
  const draw = ()=>{
    const list = QUIZ.map((q,i)=>({...q,i})).filter(q=>!lv||q.lv===lv);
    const ans = list.filter(q=>prog.quiz[q.i]!==undefined), right = ans.filter(q=>prog.quiz[q.i]);
    $('#qscore').textContent = `정답 ${right.length} / ${list.length}`;
    $('#qs').innerHTML = list.map((q,n)=>`<div class="q" data-i="${q.i}"><div class="row" style="justify-content:space-between"><span class="eyebrow">문항 ${n+1} · ${q.lv}단계</span>${prog.quiz[q.i]===undefined?'':prog.quiz[q.i]?'<span class="chip ok">정답</span>':'<span class="chip stop">오답</span>'}</div><p style="margin:6px 0 0; font-weight:600">${esc(q.q)}</p><div class="opts">${q.a.map((a,j)=>`<button data-j="${j}">${String.fromCharCode(9312+j)} ${esc(a)}</button>`).join('')}</div><div class="ex" hidden></div></div>`).join('');
  };
  $('#qs').addEventListener('click', e=>{ const b=e.target.closest('.opts button'); if(!b||b.disabled) return; const box=b.closest('.q'); const q=QUIZ[+box.dataset.i]; const j=+b.dataset.j;
    box.querySelectorAll('.opts button').forEach((x,k)=>{ x.disabled=true; if(k===q.c) x.classList.add('right'); else if(k===j) x.classList.add('wrong'); });
    const ex=box.querySelector('.ex'); ex.hidden=false; ex.innerHTML=`<b>${j===q.c?'정답입니다.':'오답입니다.'}</b> ${esc(q.e)}`;
    prog.quiz[q.i] = j===q.c; saveProg();
    const list = QUIZ.map((q,i)=>({...q,i})).filter(q=>!lv||q.lv===lv); $('#qscore').textContent = `정답 ${list.filter(q=>prog.quiz[q.i]).length} / ${list.length}`; });
  $('#qseg').onclick = e=>{ const b=e.target.closest('button'); if(!b) return; lv=+b.dataset.l; store.set('quizLv',lv); document.querySelectorAll('#qseg button').forEach(x=>x.classList.toggle('on',x===b)); draw(); };
  $('#qreset').onclick = ()=>{ QUIZ.forEach((q,i)=>{ if(!lv||q.lv===lv) delete prog.quiz[i]; }); saveProg(); draw(); };
  draw();
}

/* ════════ 슈퍼바이저 질문 ════════ */
let turns = [];
function viewMentor(){
  const SUG = ['F가 높을 때 과대보고와 실제 병리를 구분하는 순서를 알려 주세요','8번이 높은데 RC8이 정상이면 어떻게 해석하나요?','2-7 코드와 2-7-8 코드는 임상적으로 무엇이 다른가요?','4번 상승에서 Pd1과 Pd2를 왜 구분해야 하나요?','양육권 평가에서 방어적인 프로파일을 보고서에 어떻게 쓰나요?','MMPI-2 보고서에서 자살 위험은 어떻게 기술하나요?','MMPI-A와 MMPI-2의 타당도 기준은 왜 다른가요?','청소년에게 성인 규준을 쓰면 어떤 문제가 생기나요?','MMPI-A에서 IMM 척도는 어떻게 활용하나요?'];
  app.innerHTML = `<div class="stack" style="max-width:860px"><div><div class="eyebrow">슈퍼바이저</div><h1 style="margin-top:6px">무엇이든 물어보세요</h1><p class="lede" style="margin-top:8px">경력 25년의 MMPI 슈퍼바이저 역할을 맡은 Claude가 답합니다. 해석 원리, 감별, 보고서 문장 다듬기 등을 물어볼 수 있습니다. 실제 내담자의 식별 정보는 입력하지 마세요.</p></div>
  <div class="chat" id="chat"></div>
  <div class="sugg" id="sugg">${SUG.map(s=>`<button>${esc(s)}</button>`).join('')}</div>
  <form id="mf" class="stack" style="gap:8px"><textarea id="mq" placeholder="질문을 입력하세요" style="min-height:80px"></textarea><div class="row"><button class="btn pri" id="msend" type="submit">질문하기</button><button class="btn" type="button" id="mclear">대화 지우기</button><span class="note" id="mnote"></span></div></form></div>`;
  const chatEl = $('#chat');
  const render = ()=>{ chatEl.innerHTML = turns.length? turns.map(t=>t.role==='user'?`<div class="msg u">${esc(t.content)}</div>`:`<div class="msg a md">${md(t.content)}</div>`).join('') : '<div class="panel flat note">아래 예시 질문을 누르거나 직접 질문하세요.</div>'; };
  render();
  const RULES = `당신은 MMPI-2, MMPI-2-RF, MMPI-3, MMPI-A, MMPI-A-RF 해석 경력 25년의 한국 임상심리전문가이며, 대학원 수련생을 지도하는 슈퍼바이저입니다. 한국어로 답합니다. Graham, Greene, Butcher, Ben-Porath, Friedman, Archer(청소년) 등 표준 문헌에 근거해 정확하게 답하고, 근거가 불확실하면 그렇다고 말합니다. 구체적인 척도, 절단점, 예시를 들되, 검사 문항 내용은 저작권 때문에 인용하지 않습니다. 수련생이 스스로 생각하도록 마지막에 확인 질문을 하나 던지세요. 실제 내담자 진단을 대신하지 않습니다. 답은 마크다운으로, 필요한 만큼만 길게 씁니다.`;
  getSample().then(sample=>{
    if(!sample){ $('#msend').disabled=true; $('#mnote').textContent='이 화면에서는 Claude를 사용할 수 없습니다.'; return; }
    let busy=false;
    const ask = q=>{
      if(busy||!q.trim()) return; busy=true; $('#msend').disabled=true; $('#mnote').textContent='';
      turns.push({role:'user', content:q.trim()}); if(turns.length>16) turns=turns.slice(-16); if(turns[0].role!=='user') turns.shift();
      render(); const bub=document.createElement('div'); bub.className='msg a md'; bub.innerHTML='<p class="thinking">생각하고 있습니다</p>'; chatEl.appendChild(bub); bub.scrollIntoView({block:'nearest'});
      sample([{role:'user',content:RULES}, ...turns], {cache:false, onText:({text})=>{ bub.innerHTML=md(text); }})
        .then(r=>{ turns.push({role:'assistant', content:r.text}); })
        .catch(e=>{ if(e.text){ bub.innerHTML=md(e.text); turns.push({role:'assistant',content:e.text}); } else bub.remove(); $('#mnote').textContent=errCopy(e.code); })
        .finally(()=>{ busy=false; $('#msend').disabled=false; });
    };
    $('#mf').onsubmit = e=>{ e.preventDefault(); const q=$('#mq').value; $('#mq').value=''; ask(q); };
    $('#sugg').onclick = e=>{ const b=e.target.closest('button'); if(b) ask(b.textContent); };
  });
  $('#mclear').onclick = ()=>{ turns=[]; render(); };
}

/* ════════ 실험실 ════════ */
const LAB_NOTE = '교육용 단순화 모형입니다. 척도별 문항 수는 MMPI-2 공개 자료를 따랐지만, “그렇다” 채점 비율과 규준 평균·표준편차는 방향과 크기를 보여 주기 위한 근사치이며 실제 채점 키나 규준이 아닙니다. K 교정은 반영하지 않습니다. 정확한 점수가 아니라 “어떤 척도가 어느 방향으로 움직이는가”를 배우는 용도로 쓰세요.';
const labTabs = cur => `<div class="seg" style="margin-top:4px"><a class="btn sm ${cur==='lab'?'pri':''}" href="#lab">응답 양식 실험실</a><a class="btn sm ${cur==='stability'?'pri':''}" href="#stability">측정오차와 코드타입 안정성</a></div>`;
const ADULT = () => CASES.filter(c=>c.version!=='A');
const pct = x => Math.round(x*100)+'%';
const STYLES = [
  {id:'none', name:'왜곡 없음(내용대로 응답)', mix:()=>({})},
  {id:'random', name:'무선반응', mix:i=>({random:i})},
  {id:'yea', name:'“그렇다” 고정반응(묵종)', mix:i=>({bias:i})},
  {id:'nay', name:'“아니다” 고정반응', mix:i=>({bias:-i})},
  {id:'over', name:'증상 과대보고', mix:i=>({over:i})},
  {id:'under', name:'좋게 보이기(과소보고)', mix:i=>({under:i})},
];
const STYLE_WHY = {
  none:'응답 양식의 왜곡이 없습니다. VRIN·TRIN이 정상이고 F 계열과 L·K·S도 극단적이지 않다면 내용대로 응답했다고 판단합니다.',
  random:'무선반응은 VRIN을 가장 먼저, 가장 크게 올립니다. 동시에 F 계열이 오르고 임상척도 전반이 60~80대로 올라 “모든 척도가 고르게 높은” 모양이 됩니다. VRIN을 먼저 보지 않으면 심한 정신병리로 오해합니다.',
  yea:'“그렇다”로 몰아서 답하면 TRIN이 T 방향으로 오르고, “그렇다”로 채점되는 문항이 많은 F, 6·7·8·9번이 오릅니다. 반대로 대부분 “아니다”로 채점되는 L·K·S는 바닥으로 내려갑니다. 과대보고와 비슷해 보이지만 TRIN이 단서입니다.',
  nay:'“아니다”로 몰아서 답하면 TRIN이 F 방향으로 오르고, “아니다”로 채점되는 L·K·S와 1·2·3번이 오릅니다. 방어적인 프로파일처럼 보이지만 TRIN이 단서입니다.',
  over:'증상을 과장하면 VRIN·TRIN은 정상인데 F, F(B), Fp가 함께 오르고 K·S는 내려갑니다. 정신과 환자도 드물게 응답하는 Fp가 오르는 것이 실제 심한 병리와 구분되는 핵심입니다.',
  under:'좋게 보이려 하면 L·K·S가 오르고 F와 임상척도가 내려갑니다. 정상 범위 프로파일이 나와도 실제 문제가 없다는 뜻이 아닙니다. 3번은 부인 문항 때문에 덜 내려가거나 오히려 오를 수 있습니다.',
};
const VAL_KEYS = ['VRIN','TRIN','F','Fb','Fp','FBS','L','K','S'], CLI_KEYS = ['Hs','D','Hy','Pd','Pa','Pt','Sc','Ma','Si'];

let labState = store.get('lab', {base:'', sex:'M', mix:{random:0,bias:0,over:0,under:0}, quiz:{n:0,ok:0}});
function viewLab(){
  const st = labState; const save = ()=>store.set('lab', labState);
  const L = MMPILAB;
  app.innerHTML = `<div class="stack"><div><div class="eyebrow">실험실</div><h1 style="margin-top:6px">응답 양식 실험실</h1>
    <p class="lede" style="margin-top:8px">같은 사람이 무작위로, 한쪽으로 몰아서, 과장해서, 좋게 보이려고 답하면 프로파일이 어떻게 바뀔까요? 슬라이더로 응답 양식을 섞으면 척도 점수와 해석 엔진의 타당도 판정이 실시간으로 바뀝니다. 점선은 왜곡 전의 기준 프로파일입니다.</p>${labTabs('lab')}</div>
  <div class="az">
    <aside class="panel stack" style="gap:12px; padding:16px">
      <label class="f">기준 프로파일 (왜곡 전의 실제 상태)<select id="lb-base"><option value="">평균 응답자 (모든 척도 T 50)</option>${ADULT().map(c=>`<option value="${c.id}" ${st.base===c.id?'selected':''}>사례 ${+c.id.slice(1)} · ${esc(c.title)}</option>`).join('')}</select></label>
      ${[['random','무선반응','문항을 읽지 않고 아무렇게나 답한 비율',0,100],['bias','고정반응','← “아니다”로 몰기 · “그렇다”로 몰기 →',-100,100],['over','증상 과대보고','증상을 실제보다 나쁘게 보이려는 정도',0,100],['under','좋게 보이기','문제를 숨기고 바람직하게 보이려는 정도',0,100]].map(([k,n,h,mn,mx])=>`<label class="f" style="gap:2px"><span class="row" style="justify-content:space-between"><b style="color:var(--ink)">${n}</b><span class="mono" id="lv-${k}"></span></span><input type="range" id="lr-${k}" min="${mn}" max="${mx}" step="5" value="${Math.round((st.mix[k]||0)*100)}"><small>${h}</small></label>`).join('')}
      <div><div class="note" style="margin-bottom:6px">빠른 설정</div><div class="row" style="gap:6px">
        <button class="btn sm" data-pre='{}'>왜곡 없음</button><button class="btn sm" data-pre='{"random":0.3}'>무선 30%</button><button class="btn sm" data-pre='{"random":1}'>완전 무선</button><button class="btn sm" data-pre='{"bias":1}'>모두 그렇다</button><button class="btn sm" data-pre='{"bias":-1}'>모두 아니다</button><button class="btn sm" data-pre='{"over":0.6}'>과장 60%</button><button class="btn sm" data-pre='{"under":0.6}'>좋게 60%</button></div></div>
      <p class="note" style="margin:0">${LAB_NOTE}</p>
    </aside>
    <section class="stack" style="min-width:0">
      <div class="panel chartwrap" style="padding:12px 10px 6px" id="lb-chart"></div>
      <div class="row" id="lb-chips"></div>
      <div class="grid2" style="align-items:start">
        <div class="stepbox"><div class="sh"><span>엔진의 타당도 판정</span></div><ul id="lb-valid"></ul></div>
        <div class="stepbox"><div class="sh"><span>가장 많이 움직인 척도</span></div><ul id="lb-moved"></ul></div>
      </div>
      <div class="panel" id="lb-why"></div>
    </section>
  </div>
  <section class="panel stack" style="gap:10px"><div class="row" style="justify-content:space-between"><h2>응답 양식 맞히기</h2><span class="chip mono" id="lq-score"></span></div>
    <p class="note" style="margin:0">무작위로 고른 사례에 숨은 응답 양식을 섞었습니다. 프로파일만 보고 어떤 응답 양식인지 고르세요. 타당도 척도를 어떤 순서로 보는지가 실력입니다.</p>
    <div id="lq"></div><button class="btn pri" id="lq-new" style="align-self:flex-start">새 문제</button></section>
  </div>`;
  const base = ()=> st.base ? CASES.find(c=>c.id===st.base).p : {};
  const draw = ()=>{
    ['random','bias','over','under'].forEach(k=>{ const v=st.mix[k]||0; $('#lv-'+k).textContent = k==='bias' ? (v===0?'0':(v>0?'그렇다 ':'아니다 ')+Math.round(Math.abs(v)*100)+'%') : Math.round(v*100)+'%'; });
    const b = base(), sim = L.simulate(b, st.mix);
    $('#lb-chart').innerHTML = chart(sim, {ghost: Object.keys(b).length? b : Object.fromEntries([...VAL_KEYS,...CLI_KEYS,'Mf'].map(k=>[k,50]))});
    const r = MMPI.analyze(sim, {setting:'outpatient', sex:'M'});
    const vc = r.validity==='invalid'?'stop':r.validity==='caution'?'warn':'ok';
    $('#lb-chips').innerHTML = `<span class="chip ${vc}">타당도: ${r.vText}</span>${r.code?`<span class="chip acc">${esc(r.code.label)}</span>`:'<span class="chip">임상 해석 보류</span>'}${r.over?'<span class="chip warn">과대보고 신호</span>':''}${r.under?'<span class="chip warn">과소보고 신호</span>':''}`;
    $('#lb-valid').innerHTML = r.steps[1].items.map(i=>`<li class="${i.tag}"><span>${i.text}</span></li>`).join('');
    const ref = Object.keys(b).length? b : {};
    const moved = [...VAL_KEYS,...CLI_KEYS].map(k=>({k, d: sim[k] - (ref[k]===undefined?50:+ref[k])})).filter(x=>x.d!==0).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,6);
    $('#lb-moved').innerHTML = moved.length ? moved.map(x=>`<li class="${x.d>0?'warn':'info'}"><span><b class="mono">${esc(lab(x.k))}${x.k==='TRIN'?' '+sim.TRINdir:''}</b> ${x.d>0?'+':''}${x.d} <span class="note">(${ref[x.k]===undefined?50:ref[x.k]} → ${sim[x.k]})</span></span></li>`).join('') : '<li class="ok"><span>왜곡이 없어 기준 프로파일과 같습니다.</span></li>';
    const dom = ['random','over','under'].map(k=>[k, st.mix[k]||0]).concat([[ (st.mix.bias||0)>=0?'yea':'nay', Math.abs(st.mix.bias||0)]]).sort((a,b)=>b[1]-a[1])[0];
    const key = dom[1]>0 ? dom[0] : 'none';
    $('#lb-why').innerHTML = `<h3 style="font-size:16px">${esc(STYLES.find(s=>s.id===key).name)}에서 일어나는 일</h3><p style="margin:6px 0 0">${STYLE_WHY[key]}</p>${(st.mix.random||0)>0 && (st.mix.random||0)<0.35 ? '<p class="note" style="margin-top:6px">무선반응 비율이 낮을 때는 VRIN이 주의 범위(70~79)에 머물 수 있습니다. 일부 문항만 대충 답한 경우를 VRIN이 완전히 잡아내지 못한다는 점도 기억하세요.</p>':''}`;
  };
  ['random','bias','over','under'].forEach(k=> $('#lr-'+k).addEventListener('input', e=>{ st.mix[k] = +e.target.value/100; save(); draw(); }));
  $('#lb-base').onchange = e=>{ st.base=e.target.value; save(); draw(); };
  app.querySelectorAll('[data-pre]').forEach(b=> b.onclick = ()=>{ st.mix = Object.assign({random:0,bias:0,over:0,under:0}, JSON.parse(b.dataset.pre)); ['random','bias','over','under'].forEach(k=>$('#lr-'+k).value=Math.round(st.mix[k]*100)); save(); draw(); });
  draw();

  // 맞히기 문제
  const score = ()=>{ $('#lq-score').textContent = `정답 ${st.quiz.ok} / ${st.quiz.n}`; };
  const newQ = ()=>{
    const cs = ADULT(), c = cs[Math.floor(Math.random()*cs.length)], sty = STYLES[Math.floor(Math.random()*STYLES.length)];
    const inten = 0.45 + Math.random()*0.45, sim = L.simulate(c.p, sty.mix(Math.round(inten*20)/20));
    const opts = STYLES.slice().sort(()=>Math.random()-0.5);
    $('#lq').innerHTML = `<div class="chartwrap">${chart(sim,{h:260})}</div><div class="row" style="gap:6px; margin-top:8px">${opts.map(o=>`<button class="btn sm" data-a="${o.id}">${esc(o.name)}</button>`).join('')}</div><div id="lq-res"></div>`;
    $('#lq').querySelectorAll('[data-a]').forEach(btn=> btn.onclick = ()=>{
      const ok = btn.dataset.a===sty.id; st.quiz.n++; if(ok) st.quiz.ok++; save(); score();
      $('#lq').querySelectorAll('[data-a]').forEach(b=>{ b.disabled=true; if(b.dataset.a===sty.id) b.classList.add('pri'); });
      const r = MMPI.analyze(sim,{setting:'outpatient',sex:'M'});
      $('#lq-res').innerHTML = `<div class="q" style="margin-top:10px; padding:14px"><b>${ok?'정답입니다.':'오답입니다.'}</b> 정답은 <b>${esc(sty.name)}</b>${sty.id==='none'?'':` (강도 ${pct(Math.round(inten*20)/20)})`}이고, 기준 프로파일은 사례 ${+c.id.slice(1)}(${esc(c.code)})였습니다.<p style="margin:8px 0 0">${STYLE_WHY[sty.id]}</p><p class="note" style="margin:6px 0 0">엔진 판정: ${r.vText}${r.code?' · '+esc(r.code.label):''}</p></div>`;
    });
  };
  $('#lq-new').onclick = newQ; score(); newQ();
}

let stabState = store.get('stab', {src:'c01', sem:5, seed:1, x1:78, x2:66});
function viewStability(){
  const st = stabState; const save = ()=>store.set('stab', stabState); const L = MMPILAB;
  app.innerHTML = `<div class="stack"><div><div class="eyebrow">실험실</div><h1 style="margin-top:6px">측정오차와 코드타입 안정성</h1>
    <p class="lede" style="margin-top:8px">모든 점수에는 측정오차가 있습니다. 같은 사람이 다시 검사를 받으면 코드타입은 얼마나 유지될까요? 각 척도에 측정오차만큼 무작위 잡음을 넣어 재검사를 2,000번 시뮬레이션합니다. “잘 정의된 코드(5T 이상)만 믿으라”는 규칙이 왜 필요한지 숫자로 확인하세요.</p>${labTabs('stability')}</div>
  <div class="az">
    <aside class="panel stack" style="gap:12px; padding:16px">
      <label class="f">프로파일<select id="sb-src"><option value="az" ${st.src==='az'?'selected':''}>프로파일 분석기의 현재 점수</option>${CASES.map(c=>`<option value="${c.id}" ${st.src===c.id?'selected':''}>${c.version==='A'?'[A] ':''}사례 ${+c.id.slice(1)} · ${esc(c.title)}</option>`).join('')}</select></label>
      <label class="f" style="gap:2px"><span class="row" style="justify-content:space-between"><b style="color:var(--ink)">측정의 표준오차(SEM)</b><span class="mono" id="sb-semv"></span></span><input type="range" id="sb-sem" min="2" max="9" step="0.5" value="${st.sem}"><small>T점수 단위. 차트의 띠는 ±1.96 SEM(95% 구간)입니다.</small></label>
      <div class="row" style="gap:6px; align-items:flex-end; flex-wrap:nowrap"><label class="f" style="flex:1">재검사 신뢰도 r로 계산<input type="number" id="sb-r" min="0.5" max="0.99" step="0.01" value="0.80"></label><button class="btn sm" id="sb-rapply">SEM에 적용</button></div>
      <p class="note" style="margin:0">SEM = 10 × √(1 − r). MMPI-2 임상척도의 단기 재검사 신뢰도는 대체로 0.7~0.9대로 보고되며, 그에 해당하는 SEM은 약 3~5.5입니다. 정확한 값은 매뉴얼의 척도별 신뢰도를 확인하세요. 재검사 차이의 표준편차는 √2 × SEM으로 계산합니다.</p>
      <button class="btn pri" id="sb-run">재검사 2,000번 시뮬레이션</button>
    </aside>
    <section class="stack" style="min-width:0">
      <div class="panel chartwrap" style="padding:12px 10px 6px" id="sb-chart"></div>
      <div class="panel" id="sb-res"></div>
    </section>
  </div>
  <div class="grid2" style="align-items:start">
    <section class="panel stack" style="gap:8px"><h2>정의 수준이 안정성을 결정한다</h2><p class="note" style="margin:0">2번 75, 7번 74인 2-7 프로파일에서 세 번째 척도(8번)만 낮춰 가며, 재검사에서도 2·7번이 상위 두 척도로 남을 확률을 계산했습니다. 가로축은 정의 수준(두 번째 척도와 세 번째 척도의 차이)입니다.</p><div class="chartwrap" id="sb-curve"></div></section>
    <section class="panel stack" style="gap:8px"><h2>신뢰할 수 있는 변화 지수 (RCI)</h2><p class="note" style="margin:0">치료 전후 점수 차이가 측정오차를 넘어서는 “진짜 변화”인지 판정합니다. RCI = (재검사 − 처음) ÷ (√2 × SEM), |RCI| ≥ 1.96이면 95% 수준에서 의미 있는 변화입니다(Jacobson·Truax).</p>
      <div class="row" style="gap:8px; flex-wrap:nowrap"><label class="f" style="flex:1">처음 T점수<input type="number" id="rc-1" value="${st.x1}"></label><label class="f" style="flex:1">재검사 T점수<input type="number" id="rc-2" value="${st.x2}"></label></div><div id="rc-out"></div></section>
  </div></div>`;
  const src = ()=>{ if(st.src==='az') return {p:azState.p||{}, ver:azState.ver}; const c=CASES.find(x=>x.id===st.src)||CASES[0]; return {p:c.p, ver:c.version==='A'?'A':'2'}; };
  const drawChart = ()=>{ const s=src(); $('#sb-semv').textContent = st.sem.toFixed(1)+' T'; $('#sb-chart').innerHTML = chart(s.p,{ver:s.ver, band:st.sem}); };
  const run = ()=>{
    const s=src(); const res = L.retest(s.p, {sem:st.sem, n:2000, seed:st.seed, version:s.ver==='A'?'A':undefined});
    const top = res.dist.slice(0,6); const other = 1 - top.reduce((a,x)=>a+x.p,0);
    const def = res.orig.def;
    const msg = res.orig.key===null ? '코드타입을 정할 수 있는 임상척도 점수가 부족합니다.' :
      (()=>{ const key = res.pSamePair!==null ? res.pSamePair : res.pSame;
      return `같은 사람이 다시 검사를 받으면 <b>약 ${pct(res.pSame)}</b>의 확률로 정확히 같은 코드(${esc(L.codeLabel(res.orig.key))})가 나오고${res.pSamePair!==null?`, 같은 2개 척도 코드(상위 두 척도가 같고 둘 다 65 이상)는 <b>${pct(res.pSamePair)}</b>`:''}, 가장 높은 척도는 <b>${pct(res.pSameHigh)}</b>의 확률로 유지됩니다.${def!==null?` 이 프로파일의 정의 수준은 ${def}T입니다.`:''} ${key>=0.75?'코드타입의 기술 내용을 비교적 확신을 갖고 적용할 수 있습니다.':key>=0.5?'코드타입은 가설로 쓰되, 인접 척도의 의미를 함께 고려하세요.':'코드타입이 측정오차만으로도 쉽게 바뀝니다. 개별 척도 중심으로 해석하세요.'}`; })();
    $('#sb-res').innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="font-size:16px">시뮬레이션 결과</h3><button class="btn sm" id="sb-again">다른 난수로 다시</button></div><p style="margin:8px 0 12px">${msg}</p>
      <div class="stack" style="gap:6px">${top.map(x=>`<div style="display:grid; grid-template-columns:96px minmax(0,1fr) 48px; gap:10px; align-items:center"><span class="mono" style="font-weight:${x.key===res.orig.key?700:400}; color:${x.key===res.orig.key?'var(--plot)':'var(--ink)'}">${esc(L.codeLabel(x.key))}</span><div class="scorebar"><i style="width:${(x.p*100).toFixed(1)}%; background:${x.key===res.orig.key?'var(--plot)':'var(--accent)'}"></i></div><span class="mono note" style="text-align:right">${pct(x.p)}</span></div>`).join('')}${other>0.005?`<div class="note">그 밖의 코드 ${pct(other)}</div>`:''}</div>
      <p class="note" style="margin-top:10px">시뮬레이션 ${res.n.toLocaleString()}회, SEM ${res.sem}T. 코드 결정 규칙은 분석기 엔진과 같습니다(테스트로 일치를 검증). 척도마다 SEM이 같다고 가정한 단순화 모형입니다.</p>`;
    $('#sb-again').onclick = ()=>{ st.seed++; save(); run(); };
  };
  const curve = ()=>{
    const pts = L.definitionCurve({sem:st.sem, n:1500});
    const W=560,H=250,l=46,r=16,t=16,b=40, X=d=>l+d/15*(W-l-r), Y=p=>t+(1-p)*(H-t-b);
    let g=''; for(let p=0;p<=1.001;p+=0.25){ g+=`<line x1="${l}" x2="${W-r}" y1="${Y(p)}" y2="${Y(p)}" stroke="var(--line)" stroke-width="0.7"/><text x="${l-6}" y="${Y(p)+4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${Math.round(p*100)}%</text>`; }
    for(let d=0;d<=15;d+=5) g+=`<text x="${X(d)}" y="${H-b+16}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${d}T</text>`;
    g+=`<line x1="${X(5)}" x2="${X(5)}" y1="${t}" y2="${H-b}" stroke="var(--plot)" stroke-dasharray="4 3"/><text x="${X(5)+5}" y="${t+12}" font-size="11" fill="var(--plot)">잘 정의된 코드 기준(5T)</text>`;
    g+=`<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.map(q=>`${X(q.def).toFixed(1)},${Y(q.p).toFixed(1)}`).join(' ')}"/>`;
    pts.forEach(q=>{ g+=`<circle cx="${X(q.def).toFixed(1)}" cy="${Y(q.p).toFixed(1)}" r="${q.def===5?4.5:3}" fill="${q.def===5?'var(--plot)':'var(--accent)'}"/>`; });
    const p5=pts[5].p, p0=pts[0].p, p10=pts[10].p;
    g+=`<text x="${W/2}" y="${H-6}" text-anchor="middle" font-size="11.5" fill="var(--muted)">정의 수준 (두 번째 − 세 번째 척도)</text>`;
    $('#sb-curve').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="정의 수준별 코드 유지 확률">${g}</svg><p class="note" style="margin:6px 0 0">SEM ${st.sem}T일 때 유지 확률: 정의 수준 0T ${pct(p0)}, 5T ${pct(p5)}, 10T ${pct(p10)}.</p>`;
  };
  const rcOut = ()=>{ st.x1=+$('#rc-1').value; st.x2=+$('#rc-2').value; save(); const o=L.rci(st.x1, st.x2, st.sem);
    $('#rc-out').innerHTML = `<div class="q" style="padding:12px"><span class="mono">RCI = ${o.rci.toFixed(2)}</span> → <b style="color:${o.reliable?'var(--ok)':'var(--warn)'}">${o.reliable?'측정오차를 넘어서는 의미 있는 변화':'측정오차 범위 안의 변화일 수 있음'}</b><p class="note" style="margin:6px 0 0">SEM ${st.sem}T에서 의미 있는 변화로 보려면 최소 약 ${o.minChange}T 이상 차이가 나야 합니다.</p></div>`; };
  $('#sb-src').onchange = e=>{ st.src=e.target.value; save(); drawChart(); run(); };
  $('#sb-sem').addEventListener('input', e=>{ st.sem=+e.target.value; save(); drawChart(); rcOut(); });
  $('#sb-sem').addEventListener('change', ()=>{ run(); curve(); });
  $('#sb-rapply').onclick = ()=>{ const r=+$('#sb-r').value; if(!(r>0&&r<1)) return; st.sem=Math.round(L.semFromReliability(r)*2)/2; $('#sb-sem').value=st.sem; save(); drawChart(); run(); curve(); rcOut(); };
  $('#sb-run').onclick = run;
  ['rc-1','rc-2'].forEach(id=> $('#'+id).addEventListener('input', rcOut));
  drawChart(); run(); curve(); rcOut();
}

/* ════════ 우리 반 ════════ */
const fmtDate = ms => { if(!ms) return '-'; const d=new Date(ms); return `${d.getMonth()+1}월 ${d.getDate()}일`; };
const caseName = id => { const c=CASES.find(x=>x.id===id); return c ? `사례 ${+id.slice(1)} · ${c.title}` : id; };
function viewClass(){
  const C = CLASSDATA, mine = prog;
  const statusBox = ()=>{
    const s = Sync.status;
    const title = s==='synced' ? '계정에 동기화되고 있습니다' : s==='readonly' ? '읽기 전용으로 연결되었습니다' : s==='connecting' ? '공유 저장소에 연결하고 있습니다' : '이 브라우저에만 저장되고 있습니다';
    return `<div class="panel" style="border-left:3px solid ${s==='synced'?'var(--ok)':s==='readonly'?'var(--warn)':'var(--line)'}"><h3 style="font-size:16px">${title}</h3><p class="note" style="margin:6px 0 0">${esc(Sync.reason||'')}</p></div>`;
  };
  app.innerHTML = `<div class="stack"><div><div class="eyebrow">클래스 모드</div><h1 style="margin-top:6px">우리 반</h1>
    <p class="lede" style="margin-top:8px">같은 문서를 쓰는 학우들의 학습 현황을 모아 봅니다. 학생에게는 반 전체의 집계만 보이고, 개인 성적과 답안은 다른 학생에게 보이지 않습니다. 반 통계는 제출한 사람이 ${C.MIN_N}명 이상인 항목만 표시합니다.</p></div>
    ${statusBox()}
    <div id="cl-admin"></div>
    <div id="cl-assign"></div>
    <div id="cl-stats"></div>
  </div>`;
  if(Sync.status!=='synced' && Sync.status!=='readonly'){
    $('#cl-stats').innerHTML = `<div class="panel flat note">${Sync.status==='connecting'?'연결되면 반 통계를 불러옵니다.':'공유 저장소를 쓸 수 없어 반 통계를 볼 수 없습니다. 개인 학습 기능은 모두 그대로 쓸 수 있습니다.'}</div>`;
    return;
  }
  const alive = ()=> document.getElementById('cl-stats');
  const load = async ()=>{
    let summary=null;
    try{ const s = await Sync.db.doc('class/summary').get(); summary = s.exists ? s.data() : null; }catch(e){}
    try{ const a = await Sync.db.doc('class/assignments').get(); Sync.assignments = a.exists ? (a.data().items||[]) : []; }catch(e){}
    if(Sync.admin) summary = await adminPanel(summary) || summary;
    if(!alive()) return;
    drawAssignments(); drawStats(summary);
  };

  function drawAssignments(){
    const items = Sync.assignments.slice().sort((a,b)=>(a.due||'').localeCompare(b.due||''));
    $('#cl-assign').innerHTML = `<section class="panel stack" style="gap:8px"><h2>과제</h2>${items.length ? `<div class="stack" style="gap:6px">${items.map(a=>{ const d=mine.cases[a.caseId]; return `<a class="case-card" href="#case-${esc(a.caseId)}" style="flex-direction:row; justify-content:space-between; align-items:center; padding:12px 14px"><span><b>${esc(caseName(a.caseId))}</b>${a.note?`<span class="note"> · ${esc(a.note)}</span>`:''}</span><span class="row" style="gap:6px">${a.due?`<span class="chip">마감 ${esc(a.due)}</span>`:''}${d?`<span class="chip ok">제출 · ${d.score}%</span>`:'<span class="chip warn">미제출</span>'}</span></a>`; }).join('')}</div>` : '<p class="note" style="margin:0">아직 등록된 과제가 없습니다.</p>'}</section>`;
  }

  function drawStats(sm){
    if(!sm || !sm.students){ $('#cl-stats').innerHTML = `<div class="panel flat note">아직 반 통계가 없습니다. 운영자가 우리 반 화면을 열면 통계가 계산됩니다.</div>`; return; }
    const n = sm.students, vis = C.visibleStat;
    const rows = CASES.map(c=>{ const s=sm.cases[c.id]||{n:0}; const m=mine.cases[c.id];
      return `<tr><td><a href="#case-${c.id}">${esc(caseName(c.id))}</a></td><td class="num">${s.n||0}</td><td class="num">${vis(s)?s.mean+'%':'<span class="note">-</span>'}</td><td class="num">${m?`<b style="color:${vis(s)&&m.score<s.mean?'var(--warn)':'var(--ok)'}">${m.score}%</b>`:'<span class="note">미제출</span>'}</td></tr>`; }).join('');
    const weak = C.weakestKeyPoints(sm, CASES, 5);
    const hardQ = Object.entries(sm.quiz||{}).filter(([,q])=>q.n>=C.MIN_N).sort((a,b)=>a[1].rate-b[1].rate).slice(0,5);
    $('#cl-stats').innerHTML = `<section class="stack" style="gap:14px">
      <div class="grid3">
        <div class="panel"><div class="eyebrow">참여 학생</div><div class="num" style="font-size:28px; font-weight:600">${n}명</div></div>
        <div class="panel"><div class="eyebrow">평균 이론 진도</div><div class="num" style="font-size:28px; font-weight:600">${sm.progress.mods!==null?Math.round(sm.progress.mods*100)+'%':'-'}</div><div class="note">나: ${Math.round(Object.keys(mine.mods).length/MODULES.length*100)}%</div></div>
        <div class="panel"><div class="eyebrow">평균 사례 제출</div><div class="num" style="font-size:28px; font-weight:600">${sm.progress.cases!==null?Math.round(sm.progress.cases*100)+'%':'-'}</div><div class="note">나: ${Math.round(Object.keys(mine.cases).length/CASES.length*100)}%</div></div>
      </div>
      ${n<C.MIN_N?`<div class="panel flat note">참여 학생이 ${C.MIN_N}명 이상이 되면 사례별 평균과 반이 놓친 포인트가 표시됩니다.</div>`:''}
      <section class="panel stack" style="gap:8px"><h2>반이 가장 많이 놓친 핵심 포인트</h2>${weak.length?`<ul class="kp">${weak.map(w=>`<li class="miss" style="grid-template-columns:52px 86px minmax(0,1fr)"><span class="mk num">${Math.round(w.rate*100)}%</span><span class="dm">${esc(w.domain)}</span><span>${esc(w.point)} <a class="note" href="#case-${w.caseId}">사례 ${+w.caseId.slice(1)}</a></span></li>`).join('')}</ul><p class="note" style="margin:0">퍼센트는 그 포인트를 답안에 언급한 학생의 비율입니다.</p>`:'<p class="note" style="margin:0">표시할 만큼 제출된 사례가 아직 없습니다.</p>'}</section>
      <section class="panel stack" style="gap:8px"><h2>사례별 반 평균과 내 점수</h2><div class="tblwrap"><table class="tbl"><tr><th>사례</th><th>제출</th><th>반 평균</th><th>나</th></tr>${rows}</table></div><p class="note" style="margin:0">점수는 자가 점검의 핵심 포인트 비율입니다. 반 평균보다 낮은 내 점수는 주황색으로 표시합니다.</p></section>
      <section class="panel stack" style="gap:8px"><h2>반이 가장 어려워한 퀴즈</h2>${hardQ.length?`<ul class="kp">${hardQ.map(([i,q])=>{ const my=mine.quiz[i]; return `<li class="${my?'hit':'miss'}" style="grid-template-columns:52px minmax(0,1fr)"><span class="mk num">${Math.round(q.rate*100)}%</span><span>${esc(QUIZ[i].q)} <span class="note">· 나: ${my===undefined?'안 풂':my?'정답':'오답'}</span></span></li>`; }).join('')}</ul><a class="btn sm" href="#quiz" style="align-self:flex-start">퀴즈 풀러 가기</a>`:'<p class="note" style="margin:0">표시할 만큼 응답이 쌓이지 않았습니다.</p>'}</section>
      ${sm.lab&&sm.lab.n>=C.MIN_N*3?`<section class="panel"><h3 style="font-size:16px">응답 양식 맞히기 반 정답률</h3><p style="margin:6px 0 0"><b class="num">${Math.round(sm.lab.ok/sm.lab.n*100)}%</b> <span class="note">(${sm.lab.n}문항)</span></p></section>`:''}
      <p class="note">통계 갱신: ${sm.updatedAt?new Date(sm.updatedAt).toLocaleString('ko-KR'):'-'}</p>
    </section>`;
  }

  async function adminPanel(prevSummary){
    let docs=[];
    try{ const q = await Sync.db.collection('results').get(); docs = q.docs.filter(d=>d.exists).map(d=>({id:d.id, ...d.data()})); }
    catch(e){ if(alive()) $('#cl-admin').innerHTML = `<div class="panel note">학생 결과를 불러오지 못했습니다(${esc(e.code||'오류')}).</div>`; return null; }
    const summary = C.summarize(docs, CASES, QUIZ, MODULES);
    const prev = prevSummary ? Object.assign({}, prevSummary) : null; if(prev) delete prev.updatedAt;
    let written = prevSummary;
    if(!C.same(summary, prev)){ try{ written = Object.assign({}, summary, {updatedAt:new Date().toISOString()}); await Sync.db.doc('class/summary').set(written); }catch(e){ written = prevSummary; } }
    if(!alive()) return written;
    const ids = docs.filter(C.resultActive).map(d=>d.id);
    const ps = ids.length ? await Sync.user.profiles(ids) : {};
    const people = docs.filter(C.resultActive).map(d=>({id:d.id, ...C.personStats(d, CASES, QUIZ, MODULES)})).sort((a,b)=>b.last-a.last);
    const box = $('#cl-admin'); if(!box) return written;
    box.innerHTML = `<section class="panel stack" style="gap:12px; border-color:var(--accent)">
      <div class="row" style="justify-content:space-between"><h2>운영자 화면</h2><span class="chip acc">운영자에게만 보입니다</span></div>
      <p class="note" style="margin:0">문서 소유자와 편집자만 이 화면과 학생별 결과를 볼 수 있습니다. 학생들은 아래쪽의 반 통계만 봅니다. 화면을 열 때마다 반 통계를 다시 계산해 학생들에게 공개합니다.</p>
      <div class="tblwrap"><table class="tbl"><tr><th>학생</th><th>이론</th><th>사례</th><th>사례 평균</th><th>퀴즈 정답률</th><th>최근 활동</th></tr>
        ${people.length?people.map(p=>`<tr><td data-uid="${esc(p.id)}"></td><td class="num">${p.mods}/${p.modsTotal}</td><td class="num">${p.cases}/${p.casesTotal}</td><td class="num">${p.avgCase===null?'-':p.avgCase+'%'}</td><td class="num">${p.quizRate===null?'-':Math.round(p.quizRate*100)+'% ('+p.quizN+')'}</td><td>${fmtDate(p.last)}</td></tr>`).join(''):'<tr><td colspan="6" class="note">아직 기록을 저장한 학생이 없습니다.</td></tr>'}
      </table></div>
      <div class="stack" style="gap:8px"><h3 style="font-size:16px">과제 관리</h3>
        <div id="as-list" class="stack" style="gap:6px"></div>
        <div class="row" style="gap:8px; align-items:flex-end">
          <label class="f" style="flex:2; min-width:220px">사례<select id="as-case">${CASES.map(c=>`<option value="${c.id}">${esc(caseName(c.id))}</option>`).join('')}</select></label>
          <label class="f" style="flex:1; min-width:140px">마감일<input type="date" id="as-due"></label>
          <label class="f" style="flex:2; min-width:180px">메모(선택)<input type="text" id="as-note" maxlength="80" placeholder="예: 다음 수업 토론 사례"></label>
          <button class="btn pri" id="as-add">과제 추가</button></div>
        <p class="note" id="as-msg" style="margin:0"></p></div>
      <details><summary style="cursor:pointer; font-weight:600">학우들과 함께 쓰는 방법</summary><ol style="padding-left:20px; font-size:14px; margin:8px 0 0">
        <li>이 페이지 오른쪽 위의 공유 메뉴에서 학우들을 <b>기여자(Contributor)</b>로 초대합니다. 보기 전용(Viewer)이나 댓글 작성자로는 기록을 저장할 수 없습니다.</li>
        <li>학우들이 같은 claude.ai 조직(학교의 Team·Enterprise·Education 플랜 등)에 속해 있어야 기여자로서 기록을 저장할 수 있습니다. 조직 밖의 사람은 읽기만 가능합니다.</li>
        <li>편집자(Editor)로 초대하면 운영자 화면과 모든 학생의 결과를 볼 수 있으므로 조교나 지도교수에게만 주세요.</li>
      </ol></details>
    </section>`;
    // 이름은 저장하지 않고, 볼 때마다 id로 조회한다
    box.querySelectorAll('[data-uid]').forEach(td=>{ const p=ps[td.dataset.uid]; td.textContent = (p&&p.name) || '이름을 볼 수 없는 학생'; });
    const drawList = ()=>{ const items=Sync.assignments; $('#as-list').innerHTML = items.length ? items.map((a,i)=>`<div class="row" style="justify-content:space-between; border:1px solid var(--line); border-radius:8px; padding:8px 12px"><span>${esc(caseName(a.caseId))}${a.due?` · 마감 ${esc(a.due)}`:''}${a.note?` · <span class="note">${esc(a.note)}</span>`:''}</span><button class="btn sm" data-del="${i}">삭제</button></div>`).join('') : '<p class="note" style="margin:0">등록된 과제가 없습니다.</p>'; };
    const saveAssign = async items=>{ $('#as-msg').textContent='저장 중'; try{ await Sync.db.doc('class/assignments').set({items}); Sync.assignments=items; $('#as-msg').textContent='저장했습니다. 학생들의 우리 반·사례 화면에 표시됩니다.'; drawList(); drawAssignments(); }catch(e){ $('#as-msg').textContent='저장하지 못했습니다. 잠시 후 다시 시도하세요.'; } };
    $('#as-add').onclick = ()=>{ const caseId=$('#as-case').value, due=$('#as-due').value, note=$('#as-note').value.trim(); if(Sync.assignments.some(a=>a.caseId===caseId)){ $('#as-msg').textContent='이미 과제로 등록된 사례입니다.'; return; } saveAssign([...Sync.assignments, {caseId, due, note, at:Date.now()}]); $('#as-note').value=''; };
    $('#as-list').addEventListener('click', e=>{ const b=e.target.closest('[data-del]'); if(!b) return; saveAssign(Sync.assignments.filter((_,i)=>i!==+b.dataset.del)); });
    drawList();
    return written;
  }

  load();
}

route();
initSync();
})();
