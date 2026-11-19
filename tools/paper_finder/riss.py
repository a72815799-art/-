"""RISS(www.riss.kr) 검색 결과 파서.

RISS 는 공식 공개 API 대신 검색 결과 HTML 을 파싱합니다.
검색 유형(colName):
  thesis : 학위논문 (bib_t)
  kor    : 국내학술논문 (re_a_kor)
  over   : 해외학술논문 (re_a_over)
"""
from __future__ import annotations

import html as htmlmod
import re
from urllib.parse import urlencode

import requests

BASE = "https://www.riss.kr"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
COLLECTIONS = {"thesis": "bib_t", "kor": "re_a_kor", "over": "re_a_over"}
TYPE_LABEL = {"thesis": "RISS-학위논문", "kor": "RISS-국내학술", "over": "RISS-해외학술"}


def _text(fragment: str) -> str:
    t = re.sub(r"<[^>]+>", "", fragment)
    t = htmlmod.unescape(t).replace("\r", "")
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*", "\n", t)).strip()


def _args(js_args: str) -> list[str]:
    return [a.strip().strip("'\"") for a in js_args.split(",")]


def _parse_block(b: str, kind: str) -> dict | None:
    m = re.search(r'<p class="title"><a href="([^"]+)"[^>]*>(.*?)</a>', b, re.S)
    if not m:
        return None
    rec = {"type": kind, "detail_url": BASE + htmlmod.unescape(m.group(1)), "title": _text(m.group(2))}

    etc = re.search(r'<p class="etc">(.*?)</p>', b, re.S)
    etc = etc.group(1) if etc else ""
    w = re.search(r'<span class="writer">(.*?)</span>', etc, re.S)
    rec["authors"] = [_text(a) for a in re.findall(r"<a[^>]*>(.*?)</a>", w.group(1), re.S)] if w else []
    if w and not rec["authors"]:
        rec["authors"] = [x.strip() for x in _text(w.group(1)).split(",") if x.strip()]
    a = re.search(r'<span class="assigned">(.*?)</span>', etc, re.S)
    rec["publisher"] = _text(a.group(1)) if a else ""
    # writer/assigned 이외의 <span> 들: 연도, 학술지명, 권호, 학위구분 순
    rest = re.sub(r'<span class="(writer|assigned)">.*?</span>', "", etc, flags=re.S)
    spans = [_text(s) for s in re.findall(r"<span>(.*?)</span>", rest, re.S)]
    spans = [s for s in spans if s]
    rec["year"] = next((int(s) for s in spans if re.fullmatch(r"(19|20)\d\d", s)), None)
    others = [s for s in spans if not re.fullmatch(r"(19|20)\d\d", s)]
    if kind == "thesis":
        rec["degree"] = next((s for s in others if "석사" in s or "박사" in s), "")
        rec["venue"] = rec["publisher"] + (f" ({rec['degree']})" if rec["degree"] else "")
    else:
        rec["venue"] = " ".join(others[:2])
    rec["kci"] = "KCI등재" in b

    ab = re.search(r'<p class="preAbstract">(.*?)</p>', b, re.S)
    rec["abstract"] = _text(ab.group(1)) if ab else ""

    # 원문 링크 후보
    links = []
    for m in re.finditer(r"openFulltext\(([^)]*)\)[^>]*>(.*?)</a>", b, re.S):
        ctrl, org, mingan, urltype, mingan_cd, gubun = (_args(m.group(1)) + [""] * 6)[:6]
        label = m.group(2)
        alt = re.search(r'alt="([^"]*)"', label)
        q = urlencode({"control_no": ctrl, "org_storage": org, "mingan_org_storage": mingan,
                       "url_type": urltype, "gubun": gubun})
        if mingan_cd == "07" and gubun == "KYOBO":
            q += "&loginFlag=1"
        links.append({"url": f"{BASE}/search/download/openFullText.do?{q}",
                      "price": alt.group(1) if alt else "",
                      "provider": _text(re.sub(r"<img[^>]*>", "", label)) or "원문보기"})
    for m in re.finditer(r"ButtonSet\.fulltextDownload\(([^)]*)\)", b):
        ctrl, mat, submat, kind_, tg = (_args(m.group(1)) + [""] * 5)[:5]
        q = urlencode({"control_no": ctrl, "p_mat_type": mat, "p_submat_type": submat,
                       "fulltext_kind": kind_, "t_gubun": tg, "loginFlag": "1"})
        links.append({"url": f"{BASE}/search/download/FullTextDownload.do?{q}",
                      "price": "", "provider": "RISS 원문"})
    # 무료 → 표시없음(소속기관 구독 가능) → 유료 순으로 시도
    order = {"무료": 0, "": 1}
    links.sort(key=lambda l: order.get(l["price"], 2))
    rec["fulltext"] = links
    return rec


def search(query: str, n: int = 10, kinds=("thesis", "kor"), year_from=None, year_to=None,
           sort: str = "relevance", session: requests.Session | None = None) -> list[dict]:
    s = session or requests.Session()
    s.headers.setdefault("User-Agent", UA)
    out = []
    for kind in kinds:
        col = COLLECTIONS[kind]
        params = {
            "isDetailSearch": "N", "searchGubun": "true", "viewYn": "OP",
            "strQuery": query, "query": query, "colName": col, "icate": col,
            "strSort": "DATE" if sort == "year" else "RANK", "order": "/DESC",
            "p_year1": year_from or "", "p_year2": year_to or "",
            "iStartCount": 0, "pageScale": min(max(n, 10), 100), "pageNumber": 1,
            "sflag": 1, "isTab": "Y",
        }
        r = s.get(f"{BASE}/search/Search.do", params=params, timeout=30)
        r.raise_for_status()
        body = r.text
        i = body.find("srchResultListW")
        if i < 0:
            continue
        body = body[i:]
        body = body[: body.find('class="paging"')] if 'class="paging"' in body else body
        blocks = re.split(r'<input type="checkbox" class="chkBoxType1" name="control_no"', body)[1:]
        for b in blocks[:n]:
            rec = _parse_block(b, kind)
            if rec:
                out.append(rec)
    return out
