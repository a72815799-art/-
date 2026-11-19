"""브라우저(Playwright) 기반 로그인·원문 다운로드.

단국대 통합로그인(포털) → 도서관 → 교외접속 프록시(libproxy) → RISS 기관인증 처럼
리다이렉트·자바스크립트·추가인증이 섞인 흐름을 실제 브라우저로 처리합니다.
로그인 상태는 프로필 폴더(.browser_profile)에 저장되어 다음 실행 때 재사용됩니다.
"""
from __future__ import annotations

import os
import re
import time
from pathlib import Path

DKU_LOGIN = "https://lib.dankook.ac.kr/login"
DKU_PROXY = "https://libproxy.dankook.ac.kr/_Lib_Proxy_Url/"
RISS_ORGAN_LOGIN = "https://www.riss.kr/OrganLogin.do"
RISS_LOGIN = "https://www.riss.kr/LoginRedirect.do"

# 원문 페이지에서 눌러볼 버튼 문구 (KCI·DBpia·KISS·스콜라·학회 사이트 등). 앞쪽일수록 우선.
CLICK_PATTERNS = [
    re.compile(r"원문\s*(내려받기|다운|저장)|PDF\s*(다운|내려받기|저장)|다운받기|Download\s*PDF|Full\s*text\s*PDF", re.I),
    re.compile(r"원문보기|원문\s*열람|PDF\s*보기|View\s*PDF|^PDF$", re.I),
    re.compile(r"다운로드|Download", re.I),
]
# 엉뚱한 파일(설명자료·저작권·텍스트 내보내기 등)을 받지 않도록 제외
CLICK_EXCLUDE = re.compile(r"설명|양식|매뉴얼|저작권|copyright|텍스트|서지|내보내기|export|인용|cite|목록|앱|app|프로그램|뷰어|viewer|reader", re.I)
RESP_EXCLUDE = re.compile(r"/resources/|copyright|manual|guide|_filed\.pdf", re.I)


class BrowserSession:
    def __init__(self, profile_dir: str | Path, headless: bool = False):
        from playwright.sync_api import sync_playwright
        self._pw = sync_playwright().start()
        kw = dict(user_data_dir=str(profile_dir), headless=headless, accept_downloads=True,
                  locale="ko-KR", viewport={"width": 1280, "height": 900})
        self.ctx = None
        errors = []
        for opt in self._launch_options():
            try:
                self.ctx = self._pw.chromium.launch_persistent_context(**kw, **opt)
                break
            except Exception as e:
                errors.append(f"{opt or 'chromium'}: {str(e).splitlines()[0][:120]}")
        if self.ctx is None:
            self._pw.stop()
            raise RuntimeError("브라우저를 시작하지 못했습니다. Microsoft Edge 또는 Chrome 이 설치되어 있는지 확인하세요.\n"
                               + "\n".join(errors))
        self.ctx.set_default_timeout(30000)
        self.use_dku_proxy = False

    @staticmethod
    def _launch_options() -> list[dict]:
        """사용할 브라우저 후보: 지정 경로 → (실행파일이면) PC의 Edge/Chrome → 내장 Chromium."""
        exe = os.environ.get("PAPER_FINDER_CHROMIUM")
        if exe:
            return [{"executable_path": exe}]
        ch = os.environ.get("PAPER_FINDER_CHANNEL")
        if ch:
            return [{"channel": ch}]
        import sys
        system = [{"channel": "msedge"}, {"channel": "chrome"}]
        return system + [{}] if getattr(sys, "frozen", False) else [{}] + system

    def open_page(self, url: str):
        page = self._page()
        try:
            page.goto(url, wait_until="domcontentloaded")
        except Exception as e:
            print(f"    페이지 열기 실패: {e.__class__.__name__}")
        page.bring_to_front()

    def close(self):
        try:
            self.ctx.close()
        finally:
            self._pw.stop()

    # ------------------------------------------------------------------ 로그인
    def _page(self):
        return self.ctx.pages[0] if self.ctx.pages else self.ctx.new_page()

    def login_dankook(self, user: str, pw: str, wait_manual: int = 180) -> bool:
        """단국대 포털 통합로그인. 추가인증이 뜨면 브라우저 창에서 직접 처리할 시간을 줌."""
        page = self._page()
        page.goto(DKU_LOGIN, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        if "lib.dankook.ac.kr" in page.url and self._dku_logged_in(page):
            print("    [단국대] 이미 로그인되어 있음")
            self.use_dku_proxy = True
            return True
        if "portal.dankook.ac.kr" in page.url and page.locator("#user_id").count():
            if user and pw:
                page.fill("input#user_id[type=text]", user)
                page.fill("#user_password", pw)
                page.evaluate("doLogin()")
            else:
                print("    [단국대] DKU_ID/DKU_PW 가 없어 브라우저 창에서 직접 로그인해 주세요.")
        deadline = time.time() + wait_manual
        warned = False
        while time.time() < deadline:
            time.sleep(1)
            try:
                url = page.url
                if "lib.dankook.ac.kr" in url and self._dku_logged_in(page):
                    print("    [단국대] 로그인 성공")
                    self.use_dku_proxy = True
                    return True
                if not warned and "portal.dankook.ac.kr" in url and time.time() > deadline - wait_manual + 8:
                    print("    [단국대] 추가 인증/오류 화면일 수 있습니다. 브라우저 창을 확인해 주세요.")
                    warned = True
            except Exception:
                pass
        print("    [단국대] 로그인 확인 실패")
        return False

    @staticmethod
    def _dku_logged_in(page) -> bool:
        try:
            return bool(re.search(r"로그아웃|Logout", page.content(), re.I))
        except Exception:
            return False

    def login_riss_organ(self) -> bool:
        """단국대 프록시 경유로 RISS 기관(소속) 인증."""
        page = self._page()
        try:
            page.goto(DKU_PROXY + RISS_ORGAN_LOGIN, wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle", timeout=30000)
            print(f"    [RISS] 기관인증 페이지 도착: {page.url[:80]}")
            return True
        except Exception as e:
            print(f"    [RISS] 기관인증 실패: {e.__class__.__name__}")
            return False

    def login_riss_personal(self, kid: str, pwd: str) -> bool:
        page = self._page()
        page.goto(RISS_LOGIN, wait_until="domcontentloaded")
        if not page.locator("input[name=kid]").count():
            print("    [RISS] 이미 로그인되어 있음")
            return True
        page.fill("input[name=kid]", kid)
        page.fill("input[name=pwd]", pwd)
        page.click("form[name=f] input[type=submit]")
        page.wait_for_load_state("domcontentloaded")
        ok = "login_error" not in page.url
        print(f"    [RISS] 개인 로그인 {'성공' if ok else '실패 (아이디/비밀번호 확인)'}")
        return ok

    # ---------------------------------------------------------------- 다운로드
    def proxied(self, url: str) -> str:
        return DKU_PROXY + url if self.use_dku_proxy and "libproxy" not in url else url

    def fetch_pdf(self, url: str, target: Path, timeout: int = 60, via_proxy: bool = True) -> bool:
        """url 에서 시작해 리다이렉트/팝업/버튼을 따라가며 PDF 를 찾아 저장."""
        got = {"done": False}
        start_pages = set(self.ctx.pages)

        def on_response(resp):
            if got["done"]:
                return
            try:
                ct = resp.headers.get("content-type", "")
                if ("pdf" in ct or "octet-stream" in ct) and not RESP_EXCLUDE.search(resp.url):
                    body = resp.body()
                    if body[:5] == b"%PDF-":
                        target.write_bytes(body)
                        got["done"] = True
            except Exception:
                pass

        def on_download(dl):
            if got["done"]:
                return
            if RESP_EXCLUDE.search(dl.url):
                return
            try:
                tmp = target.with_suffix(".part")
                dl.save_as(tmp)
                if tmp.read_bytes()[:5] == b"%PDF-":
                    tmp.replace(target)
                    got["done"] = True
                else:
                    tmp.unlink(missing_ok=True)
            except Exception:
                pass

        def hook(p):
            p.on("download", on_download)

        self.ctx.on("response", on_response)
        self.ctx.on("page", hook)
        page = self.ctx.new_page()
        hook(page)
        try:
            try:
                page.goto(self.proxied(url) if via_proxy else url, wait_until="domcontentloaded")
            except Exception:
                pass  # 바로 다운로드가 시작되면 goto 가 예외를 냄
            deadline = time.time() + timeout
            clicked: set[str] = set()
            while time.time() < deadline and not got["done"]:
                time.sleep(2)
                for p in list(self.ctx.pages):
                    if got["done"] or p.is_closed():
                        continue
                    self._try_click(p, clicked)
        finally:
            self.ctx.remove_listener("response", on_response)
            self.ctx.remove_listener("page", hook)
            for p in list(self.ctx.pages):
                if p not in start_pages and not p.is_closed():
                    try:
                        p.close()
                    except Exception:
                        pass
        return got["done"]

    @staticmethod
    def _try_click(page, clicked: set):
        """다운로드 버튼으로 보이는 요소를 우선순위대로 한 번씩 눌러 봄."""
        try:
            elems = []
            for frame in page.frames:
                for el in frame.query_selector_all("a, button, input[type=button]")[:500]:
                    try:
                        txt = " ".join((el.inner_text() or el.get_attribute("value") or "").split())
                    except Exception:
                        continue
                    if txt and len(txt) <= 25 and not CLICK_EXCLUDE.search(txt):
                        elems.append((frame, el, txt))
            for pat in CLICK_PATTERNS:
                for frame, el, txt in elems:
                    key = f"{frame.url}|{txt}"
                    if key in clicked or not pat.search(txt):
                        continue
                    try:
                        if not el.is_visible():
                            continue
                        clicked.add(key)
                        el.click(timeout=3000, no_wait_after=True)
                        return
                    except Exception:
                        continue
        except Exception:
            pass
