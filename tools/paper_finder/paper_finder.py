#!/usr/bin/env python3
"""
논문 검색 · 다운로드 · 요약 프로그램

예)
  python paper_finder.py "transformer time series forecasting" -o ./papers -n 10
  python paper_finder.py "graph neural network" --year-from 2023 --sources arxiv,openalex --no-summary
  python paper_finder.py --summarize-only ./papers        # 이미 받은 PDF만 요약
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, asdict
from http.cookiejar import MozillaCookieJar
from pathlib import Path
from urllib.parse import urlparse, quote

import requests

try:
    import yaml
except ImportError:
    yaml = None

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).with_name(".env"))
except ImportError:
    pass

UA = "Mozilla/5.0 (paper-finder; research use)"
MODEL = os.environ.get("PAPER_FINDER_MODEL", "claude-opus-5-5")


def _safe_console():
    """Windows 콘솔(cp949/cp1252)에서 한글·기호 출력 때문에 멈추지 않도록."""
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


# ----------------------------------------------------------------------------
# 데이터 구조
# ----------------------------------------------------------------------------
@dataclass
class Paper:
    title: str
    authors: list[str] = field(default_factory=list)
    year: int | None = None
    abstract: str = ""
    doi: str | None = None
    url: str | None = None          # 논문 페이지
    pdf_urls: list[str] = field(default_factory=list)  # 다운로드 후보
    source: str = ""
    citations: int | None = None
    venue: str = ""
    pdf_path: str | None = None
    summary_path: str | None = None
    fulltext: list[dict] = field(default_factory=list)  # RISS 원문 링크 (브라우저로 처리)

    def keys(self) -> list[str]:
        ks = ["t:" + re.sub(r"[^\w]", "", self.title.lower())[:80]]
        if self.doi:
            ks.append("doi:" + self.doi.lower())
        return ks


def safe_filename(p: Paper) -> str:
    first = (p.authors[0].split()[-1] if p.authors else "unknown")
    title = re.sub(r"[\\/:*?\"<>|\n\r\t]", " ", p.title)
    title = re.sub(r"\s+", " ", title).strip()[:90]
    return f"{p.year or 'nd'}_{first}_{title}".replace(" ", "_")


# ----------------------------------------------------------------------------
# 검색 소스 (모두 무료 공개 API)
# ----------------------------------------------------------------------------
def search_arxiv(q: str, n: int, year_from: int | None, year_to: int | None) -> list[Paper]:
    r = requests.get(
        "https://export.arxiv.org/api/query",
        params={"search_query": f"all:{q}", "start": 0, "max_results": n * 2,
                "sortBy": "relevance"},
        headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    for e in ET.fromstring(r.text).findall("a:entry", ns):
        year = int(e.findtext("a:published", "0000", ns)[:4])
        if (year_from and year < year_from) or (year_to and year > year_to):
            continue
        abs_url = e.findtext("a:id", "", ns)
        pdf = abs_url.replace("/abs/", "/pdf/")
        doi_el = e.find("{http://arxiv.org/schemas/atom}doi")
        out.append(Paper(
            title=" ".join(e.findtext("a:title", "", ns).split()),
            authors=[a.findtext("a:name", "", ns) for a in e.findall("a:author", ns)],
            year=year,
            abstract=" ".join(e.findtext("a:summary", "", ns).split()),
            doi=doi_el.text if doi_el is not None else None,
            url=abs_url, pdf_urls=[pdf], source="arXiv", venue="arXiv"))
    return out[:n]


def search_openalex(q: str, n: int, year_from: int | None, year_to: int | None,
                    oa_only: bool) -> list[Paper]:
    flt = []
    if year_from:
        flt.append(f"from_publication_date:{year_from}-01-01")
    if year_to:
        flt.append(f"to_publication_date:{year_to}-12-31")
    if oa_only:
        flt.append("is_oa:true")
    params = {"search": q, "per-page": min(n, 50)}
    if flt:
        params["filter"] = ",".join(flt)
    mail = os.environ.get("CONTACT_EMAIL")
    if mail:
        params["mailto"] = mail
    r = requests.get("https://api.openalex.org/works", params=params,
                     headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    out = []
    for w in r.json().get("results", []):
        pdfs = []
        for loc in [w.get("best_oa_location")] + (w.get("locations") or []):
            if loc and loc.get("pdf_url") and loc["pdf_url"] not in pdfs:
                pdfs.append(loc["pdf_url"])
        doi = (w.get("doi") or "").replace("https://doi.org/", "") or None
        # abstract_inverted_index → 문장 복원
        abstract = ""
        inv = w.get("abstract_inverted_index")
        if inv:
            pos = {i: word for word, idx in inv.items() for i in idx}
            abstract = " ".join(pos[i] for i in sorted(pos))
        src = (w.get("primary_location") or {}).get("source") or {}
        out.append(Paper(
            title=w.get("title") or "",
            authors=[a["author"]["display_name"] for a in w.get("authorships", [])],
            year=w.get("publication_year"), abstract=abstract, doi=doi,
            url=w.get("doi") or w.get("id"), pdf_urls=pdfs, source="OpenAlex",
            citations=w.get("cited_by_count"), venue=src.get("display_name") or ""))
    return out


def search_semantic_scholar(q: str, n: int, year_from: int | None, year_to: int | None,
                            oa_only: bool) -> list[Paper]:
    params = {"query": q, "limit": min(n, 100),
              "fields": "title,authors,year,abstract,externalIds,url,openAccessPdf,"
                        "citationCount,venue"}
    if year_from or year_to:
        params["year"] = f"{year_from or ''}-{year_to or ''}"
    if oa_only:
        params["openAccessPdf"] = ""
    headers = {"User-Agent": UA}
    if os.environ.get("S2_API_KEY"):
        headers["x-api-key"] = os.environ["S2_API_KEY"]
    for attempt in range(3):
        r = requests.get("https://api.semanticscholar.org/graph/v1/paper/search",
                         params=params, headers=headers, timeout=30)
        if r.status_code != 429:
            break
        time.sleep(3 * (attempt + 1))
    r.raise_for_status()
    out = []
    for d in r.json().get("data", []):
        ext = d.get("externalIds") or {}
        pdfs = [d["openAccessPdf"]["url"]] if (d.get("openAccessPdf") or {}).get("url") else []
        if ext.get("ArXiv"):
            pdfs.append(f"https://arxiv.org/pdf/{ext['ArXiv']}")
        out.append(Paper(
            title=d.get("title") or "", authors=[a["name"] for a in d.get("authors", [])],
            year=d.get("year"), abstract=d.get("abstract") or "", doi=ext.get("DOI"),
            url=d.get("url"), pdf_urls=pdfs, source="SemanticScholar",
            citations=d.get("citationCount"), venue=d.get("venue") or ""))
    return out


RISS_KINDS = ["thesis", "kor"]


def search_riss(q, n, year_from, year_to, oa_only) -> list[Paper]:
    import riss
    out = []
    for r in riss.search(q, n, kinds=RISS_KINDS, year_from=year_from, year_to=year_to):
        if oa_only and not any(l["price"] == "무료" for l in r["fulltext"]):
            continue
        out.append(Paper(title=r["title"], authors=r["authors"], year=r["year"],
                         abstract=r["abstract"], url=r["detail_url"], venue=r["venue"],
                         source=riss.TYPE_LABEL[r["type"]], fulltext=r["fulltext"]))
    return out


SOURCES = {
    "riss": search_riss,
    "arxiv": lambda q, n, yf, yt, oa: search_arxiv(q, n, yf, yt),
    "openalex": search_openalex,
    "semanticscholar": search_semantic_scholar,
}


def search_all(q, n, sources, year_from, year_to, oa_only) -> list[Paper]:
    merged: dict[str, Paper] = {}   # key -> Paper (제목·DOI 둘 다로 색인)
    order: list[Paper] = []
    for s in sources:
        try:
            res = SOURCES[s](q, n, year_from, year_to, oa_only)
            print(f"  [{s}] {len(res)}건")
        except Exception as e:
            print(f"  [{s}] 검색 실패: {e}")
            continue
        for p in res:
            if not p.title:
                continue
            m = next((merged[k] for k in p.keys() if k in merged), None)
            if m:  # 중복이면 PDF 후보·정보 합치기
                m.pdf_urls += [u for u in p.pdf_urls if u not in m.pdf_urls]
                m.abstract = m.abstract or p.abstract
                m.fulltext += [l for l in p.fulltext if l not in m.fulltext]
                m.doi = m.doi or p.doi
                m.citations = max(m.citations or 0, p.citations or 0) or None
                m.venue = m.venue if m.venue and m.venue != "arXiv" else (p.venue or m.venue)
            else:
                m = p
                order.append(p)
            for k in m.keys():
                merged[k] = m
    return order


# ----------------------------------------------------------------------------
# 사이트 로그인 / 다운로드
# ----------------------------------------------------------------------------
class SiteSessions:
    """sites.yaml 설정에 따라 사이트별 로그인 세션을 관리."""

    def __init__(self, config_path: Path | None):
        self.default = requests.Session()
        self.default.headers["User-Agent"] = UA
        self.sites: list[dict] = []
        self.sessions: dict[str, requests.Session] = {}
        if config_path and config_path.exists():
            if yaml is None:
                sys.exit("sites.yaml 을 쓰려면 pip install pyyaml 이 필요합니다.")
            self.sites = (yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}).get("sites", [])

    @staticmethod
    def _env(name: str | None) -> str:
        if not name:
            return ""
        v = os.environ.get(name, "")
        if not v:
            print(f"    ! 환경변수 {name} 이(가) 비어 있습니다 (.env 확인)")
        return v

    def _login(self, site: dict) -> requests.Session:
        s = requests.Session()
        s.headers["User-Agent"] = UA
        if site.get("cookies_file"):
            jar = MozillaCookieJar(site["cookies_file"])
            jar.load(ignore_discard=True, ignore_expires=True)
            s.cookies.update(jar)
            print(f"    [{site['name']}] 쿠키 파일 로드")
        if site.get("login_url"):
            data = dict(site.get("extra_fields") or {})
            data[site.get("username_field", "username")] = self._env(site.get("username_env"))
            data[site.get("password_field", "password")] = self._env(site.get("password_env"))
            if site.get("login_page_url"):  # CSRF 토큰 등 쿠키 확보용 사전 방문
                s.get(site["login_page_url"], timeout=30)
            r = s.post(site["login_url"], data=data, timeout=30, allow_redirects=True)
            ok = r.ok and not re.search(site.get("fail_pattern", r"$^"), r.text)
            print(f"    [{site['name']}] 로그인 {'성공' if ok else '실패 가능성 (HTTP %d)' % r.status_code}")
        return s

    def session_for(self, url: str) -> tuple[requests.Session, str]:
        host = urlparse(url).netloc.lower()
        for site in self.sites:
            if any(host.endswith(d.lower()) for d in site.get("domains", [])):
                name = site["name"]
                if name not in self.sessions:
                    self.sessions[name] = self._login(site)
                prefix = site.get("proxy_prefix")
                return self.sessions[name], (prefix + quote(url, safe="") if prefix else url)
        return self.default, url

    def proxy_sites(self) -> list[dict]:
        return [s for s in self.sites if s.get("proxy_prefix") and s.get("use_for_doi")]


def _find_pdf_link(page_html: str, base: str) -> str | None:
    m = re.search(r'<meta[^>]+name=["\']citation_pdf_url["\'][^>]+content=["\']([^"\']+)', page_html, re.I) \
        or re.search(r'content=["\']([^"\']+)["\'][^>]+name=["\']citation_pdf_url', page_html, re.I)
    if m:
        return requests.compat.urljoin(base, html.unescape(m.group(1)))
    return None


def download_pdf(p: Paper, out_dir: Path, sites: SiteSessions, browser=None) -> bool:
    candidates = list(p.pdf_urls)
    if p.doi:
        candidates.append(f"https://doi.org/{p.doi}")
        for ps in sites.proxy_sites():  # 기관 프록시(EZproxy 등) 경유
            candidates.append(ps["proxy_prefix"] + quote(f"https://doi.org/{p.doi}", safe=""))
    target = out_dir / (safe_filename(p) + ".pdf")
    if target.exists():
        p.pdf_path = str(target)
        return True
    tried = set()
    while candidates:
        url = candidates.pop(0)
        if url in tried:
            continue
        tried.add(url)
        sess, real = sites.session_for(url)
        try:
            r = sess.get(real, timeout=60, allow_redirects=True)
        except requests.RequestException as e:
            print(f"    - {url[:70]}… 실패: {e.__class__.__name__}")
            continue
        if r.ok and r.content[:5] == b"%PDF-":
            target.write_bytes(r.content)
            p.pdf_path = str(target)
            print(f"    ✓ 다운로드: {target.name}")
            return True
        if r.ok and "html" in r.headers.get("content-type", ""):
            link = _find_pdf_link(r.text, r.url)  # 랜딩페이지의 PDF 링크 추적
            if link and link not in tried:
                candidates.insert(0, link)

    # 브라우저 단계: RISS 원문 링크 → (단국대 프록시 경유) DOI
    if browser is not None:
        # 무료 원문은 직접, 그 외(소속기관 구독/RISS 원문)는 단국대 프록시 경유
        steps = [(l["url"], f"RISS {l['provider']} {l['price']}".strip(), l["price"] != "무료")
                 for l in p.fulltext]
        if p.doi and browser.use_dku_proxy:
            steps.append((f"https://doi.org/{p.doi}", "DOI(단국대 프록시)", True))
        for url, label, via_proxy in steps:
            print(f"    … 브라우저 시도: {label}{' [단국대 프록시]' if via_proxy and browser.use_dku_proxy else ''}")
            if browser.fetch_pdf(url, target, via_proxy=via_proxy):
                p.pdf_path = str(target)
                print(f"    ✓ 다운로드: {target.name}")
                time.sleep(2)  # 사이트 부담을 줄이기 위한 간격
                return True
    elif p.fulltext:
        print("    (RISS 원문은 --browser 옵션으로 받을 수 있습니다)")
    print("    ✗ PDF를 찾지 못함 (유료/로그인 필요 가능)")
    return False


# ----------------------------------------------------------------------------
# Claude 요약
# ----------------------------------------------------------------------------
SUMMARY_PROMPT = """다음 논문을 한국어로 요약해 주세요. 마크다운으로 아래 형식을 따르세요.

## 한 줄 요약
## 연구 배경 및 문제
## 제안 방법
## 실험 및 주요 결과 (수치 포함)
## 기여점
## 한계 및 향후 과제
## 키워드

{focus}"""


def summarize(p: Paper, focus: str = "") -> str:
    import anthropic
    client = anthropic.Anthropic()
    focus_txt = f"특히 다음 관점에 주목해 주세요: {focus}" if focus else ""
    content: list[dict] = []
    if p.pdf_path:
        data = base64.standard_b64encode(Path(p.pdf_path).read_bytes()).decode()
        content.append({"type": "document",
                        "source": {"type": "base64", "media_type": "application/pdf", "data": data}})
    else:  # PDF가 없으면 초록 기반
        content.append({"type": "text",
                        "text": f"제목: {p.title}\n저자: {', '.join(p.authors)}\n초록: {p.abstract}\n"
                                "(본문 없이 초록만 있으니, 초록 기반 요약임을 명시하세요.)"})
    content.append({"type": "text", "text": SUMMARY_PROMPT.format(focus=focus_txt)})

    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=16000,
        output_config={"effort": "medium"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": content}],
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        return "_요약이 거절되었습니다._"
    return "".join(b.text for b in msg.content if b.type == "text")


def write_summary(p: Paper, out_dir: Path, focus: str):
    target = out_dir / (safe_filename(p) + ".summary.md")
    if target.exists():
        p.summary_path = str(target)
        return
    try:
        text = summarize(p, focus)
    except Exception as e:
        print(f"    ✗ 요약 실패: {e}")
        return
    header = (f"# {p.title}\n\n- 저자: {', '.join(p.authors[:8])}{' 외' if len(p.authors) > 8 else ''}\n"
              f"- 연도: {p.year}  |  게재처: {p.venue}  |  인용수: {p.citations}\n"
              f"- DOI: {p.doi}  |  링크: {p.url}\n- 요약 근거: {'PDF 본문' if p.pdf_path else '초록'}\n\n")
    target.write_text(header + text, encoding="utf-8")
    p.summary_path = str(target)
    print(f"    ✓ 요약: {target.name}")


# ----------------------------------------------------------------------------
# 메인
# ----------------------------------------------------------------------------
def write_index(papers: list[Paper], out_dir: Path, query: str):
    (out_dir / "results.json").write_text(
        json.dumps([asdict(p) for p in papers], ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [f"# 검색 결과: {query}\n", "| # | 연도 | 제목 | 인용 | PDF | 요약 |", "|---|---|---|---|---|---|"]
    for i, p in enumerate(papers, 1):
        pdf = f"[PDF]({Path(p.pdf_path).name})" if p.pdf_path else "-"
        sm = f"[요약]({Path(p.summary_path).name})" if p.summary_path else "-"
        lines.append(f"| {i} | {p.year or ''} | [{p.title}]({p.url}) | {p.citations or ''} | {pdf} | {sm} |")
    (out_dir / "INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


# 사용자 확인 대기 함수 (명령줄: Enter 입력 / 화면 앱: 확인 버튼으로 교체됨)
CONFIRM = lambda msg: input(f"{msg}  (완료 후 Enter) ")


def main(argv=None):
    _safe_console()
    ap = argparse.ArgumentParser(description="논문 검색·다운로드·요약")
    ap.add_argument("query", nargs="?", help="검색어 (예: \"diffusion model medical imaging\")")
    ap.add_argument("-o", "--out", default="./papers", help="저장 폴더")
    ap.add_argument("-n", "--num", type=int, default=10, help="가져올 논문 수")
    ap.add_argument("--sources", default="riss,openalex,semanticscholar",
                    help="riss, openalex, semanticscholar, arxiv 중 선택 (쉼표 구분)")
    ap.add_argument("--riss-type", default="thesis,kor",
                    help="RISS 검색 유형: thesis(학위논문), kor(국내학술), over(해외학술)")
    ap.add_argument("--browser", action="store_true",
                    help="브라우저로 RISS 원문/기관구독 논문 다운로드 (--login 지정 시 자동 켜짐)")
    ap.add_argument("--login", default="", help="로그인할 곳: dankook, riss (쉼표 구분)")
    ap.add_argument("--login-only", action="store_true", help="로그인만 하고 종료 (최초 설정용)")
    ap.add_argument("--headless", action="store_true", help="브라우저 창을 띄우지 않음")
    ap.add_argument("--profile", default=str(Path(__file__).with_name(".browser_profile")),
                    help="브라우저 로그인 상태 저장 폴더")
    ap.add_argument("--year-from", type=int)
    ap.add_argument("--year-to", type=int)
    ap.add_argument("--oa-only", action="store_true", help="오픈액세스 논문만")
    ap.add_argument("--sort", choices=["relevance", "citations", "year"], default="relevance")
    ap.add_argument("--must", default="", help="제목/초록에 반드시 포함될 단어(쉼표 구분)")
    ap.add_argument("--exclude", default="", help="제외할 단어(쉼표 구분)")
    ap.add_argument("--focus", default="", help="요약 시 중점 관점 (예: '실험 방법과 데이터셋')")
    ap.add_argument("--no-download", action="store_true")
    ap.add_argument("--no-summary", action="store_true")
    ap.add_argument("--sites", default=str(Path(__file__).with_name("sites.yaml")),
                    help="로그인 사이트 설정 파일")
    ap.add_argument("--summarize-only", metavar="FOLDER", help="폴더 안 PDF들만 요약")
    ap.add_argument("--manual-login", action="append", default=[], metavar="URL",
                    help="브라우저로 열어 직접 로그인할 사이트 주소 (여러 번 지정 가능)")
    a = ap.parse_args(argv)

    if a.summarize_only:
        folder = Path(a.summarize_only)
        for pdf in sorted(folder.glob("*.pdf")):
            print(f"- {pdf.name}")
            p = Paper(title=pdf.stem, pdf_path=str(pdf))
            t = pdf.with_suffix(".summary.md")
            if not t.exists():
                t.write_text(f"# {pdf.stem}\n\n" + summarize(p, a.focus), encoding="utf-8")
                print(f"    ✓ 요약: {t.name}")
        return

    logins = [x.strip().lower() for x in a.login.split(",") if x.strip()]
    browser = None
    if a.browser or logins or a.login_only or a.manual_login:
        try:
            from browser_dl import BrowserSession
        except ImportError:
            sys.exit("브라우저 기능에는 pip install playwright && playwright install chromium 이 필요합니다.")
        print("🌐 브라우저 시작")
        browser = BrowserSession(a.profile, headless=a.headless)
        if "dankook" in logins:
            if browser.login_dankook(os.environ.get("DKU_ID", ""), os.environ.get("DKU_PW", "")):
                browser.login_riss_organ()
        if "riss" in logins:
            browser.login_riss_personal(os.environ.get("RISS_ID", ""), os.environ.get("RISS_PW", ""))
        for url in a.manual_login:
            print(f"    [직접 로그인] {url}")
            browser.open_page(url)
            CONFIRM(f"브라우저 창에서 {urlparse(url).netloc} 로그인을 마쳐 주세요.")
    try:
        run_search(a, ap, browser)
    finally:
        if browser:
            browser.close()


def run_search(a, ap, browser):
    if a.login_only:
        print("로그인 완료. 이후 실행에서 로그인 상태가 재사용됩니다.")
        return
    if not a.query:
        ap.error("검색어를 입력하세요")
    RISS_KINDS[:] = [k.strip() for k in a.riss_type.split(",") if k.strip()]
    out = Path(a.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)

    print(f"🔎 검색: {a.query}")
    papers = search_all(a.query, a.num, [s.strip() for s in a.sources.split(",")],
                        a.year_from, a.year_to, a.oa_only)
    must = [w.strip().lower() for w in a.must.split(",") if w.strip()]
    excl = [w.strip().lower() for w in a.exclude.split(",") if w.strip()]
    def ok(p):
        txt = (p.title + " " + p.abstract).lower()
        return all(w in txt for w in must) and not any(w in txt for w in excl)
    papers = [p for p in papers if ok(p)]
    if a.sort == "citations":
        papers.sort(key=lambda p: p.citations or 0, reverse=True)
    elif a.sort == "year":
        papers.sort(key=lambda p: p.year or 0, reverse=True)
    papers = papers[:a.num]
    print(f"총 {len(papers)}편 선정\n")

    sites = SiteSessions(Path(a.sites))
    for i, p in enumerate(papers, 1):
        print(f"[{i}/{len(papers)}] [{p.source}] {p.title[:80]} ({p.year})")
        if not a.no_download:
            download_pdf(p, out, sites, browser)
        if not a.no_summary:
            write_summary(p, out, a.focus)
    write_index(papers, out, a.query)
    print(f"\n완료 → {out.resolve()}/INDEX.md")


if __name__ == "__main__":
    main()
