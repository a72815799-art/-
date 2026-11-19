"""논문 찾기 도우미 - 화면(웹 UI) 실행기.

실행하면 내 PC 에서만 접속되는 작은 웹서버(127.0.0.1)를 열고 브라우저로 입력 화면을 띄웁니다.
화면에서 로그인 정보·검색 조건을 입력하고 [시작]을 누르면
로그인 → 검색 → PDF 다운로드 → 요약까지 한 번에 진행합니다.
"""
from __future__ import annotations

import json
import os
import secrets
import socket
import sys
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

APP_NAME = "PaperFinder"
KEYRING_SERVICE = "PaperFinder"
SECRET_FIELDS = ("dku_pw", "riss_pw", "api_key")


def resource_path(name: str) -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))
    return base / name


def data_dir() -> Path:
    root = os.environ.get("APPDATA") or os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    d = Path(root) / APP_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


SETTINGS = data_dir() / "settings.json"
PROFILE = data_dir() / "browser_profile"
DEFAULT_OUT = str(Path.home() / "Documents" / "논문")


# ---------------------------------------------------------------- 설정 저장
def _keyring():
    try:
        import keyring
        return keyring
    except Exception:
        return None


def load_settings() -> dict:
    try:
        st = json.loads(SETTINGS.read_text(encoding="utf-8"))
    except Exception:
        st = {}
    kr = _keyring()
    if kr and st.get("remember_secrets"):
        for f in SECRET_FIELDS:
            try:
                st[f] = kr.get_password(KEYRING_SERVICE, f) or ""
            except Exception:
                pass
    st.setdefault("out_dir", DEFAULT_OUT)
    st["keyring_available"] = kr is not None
    return st


def save_settings(form: dict):
    keep = {k: v for k, v in form.items() if k not in SECRET_FIELDS}
    kr = _keyring()
    if kr:
        for f in SECRET_FIELDS:
            try:
                if form.get("remember_secrets") and form.get(f):
                    kr.set_password(KEYRING_SERVICE, f, form[f])
                elif not form.get("remember_secrets"):
                    kr.delete_password(KEYRING_SERVICE, f)
            except Exception:
                pass
    SETTINGS.write_text(json.dumps(keep, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------- 작업 실행
class Job:
    def __init__(self):
        self.lines: list[str] = []
        self.running = False
        self.waiting: str | None = None
        self._confirm = threading.Event()
        self.out_dir: str | None = None
        self.lock = threading.Lock()

    # sys.stdout 대체
    def write(self, text: str):
        with self.lock:
            self._buf = getattr(self, "_buf", "") + text
            while "\n" in self._buf:
                line, self._buf = self._buf.split("\n", 1)
                self.lines.append(line)
        return len(text)

    def flush(self):
        with self.lock:
            if getattr(self, "_buf", ""):
                self.lines.append(self._buf)
                self._buf = ""

    def confirm(self, msg: str):
        self._confirm.clear()
        self.waiting = msg
        print(f"⏸  {msg}  → 화면의 [로그인 완료] 버튼을 눌러 주세요.")
        self._confirm.wait()
        self.waiting = None

    def release(self):
        self._confirm.set()


JOB = Job()


def build_argv(f: dict) -> list[str]:
    argv = [f["query"].strip(), "-o", f.get("out_dir") or DEFAULT_OUT, "-n", str(int(f.get("num") or 10)),
            "--profile", str(PROFILE)]
    sources = [s for s in ("riss", "openalex", "semanticscholar", "arxiv") if f.get(f"src_{s}")]
    if not sources:
        raise ValueError("검색할 사이트를 하나 이상 선택하세요.")
    argv += ["--sources", ",".join(sources)]
    if "riss" in sources:
        kinds = [k for k in ("thesis", "kor", "over") if f.get(f"riss_{k}")]
        if not kinds:
            raise ValueError("RISS 검색 유형(학위/국내/해외)을 하나 이상 선택하세요.")
        argv += ["--riss-type", ",".join(kinds)]
    for key, opt in (("year_from", "--year-from"), ("year_to", "--year-to")):
        if str(f.get(key) or "").strip():
            argv += [opt, str(int(f[key]))]
    argv += ["--sort", f.get("sort") or "relevance"]
    for key, opt in (("must", "--must"), ("exclude", "--exclude"), ("focus", "--focus")):
        if (f.get(key) or "").strip():
            argv += [opt, f[key].strip()]
    if f.get("oa_only"):
        argv.append("--oa-only")
    if not f.get("do_summary"):
        argv.append("--no-summary")
    logins = []
    if f.get("use_dku"):
        logins.append("dankook")
    if f.get("use_riss"):
        logins.append("riss")
    if logins:
        argv += ["--login", ",".join(logins)]
    argv.append("--browser")
    for url in (f.get("manual_urls") or "").splitlines():
        url = url.strip()
        if url:
            argv += ["--manual-login", url if url.startswith("http") else "https://" + url]
    return argv


def run_job(form: dict):
    import paper_finder
    old = sys.stdout
    sys.stdout = JOB
    try:
        os.environ["DKU_ID"] = form.get("dku_id", "").strip()
        os.environ["DKU_PW"] = form.get("dku_pw", "")
        os.environ["RISS_ID"] = form.get("riss_id", "").strip()
        os.environ["RISS_PW"] = form.get("riss_pw", "")
        if form.get("api_key"):
            os.environ["ANTHROPIC_API_KEY"] = form["api_key"].strip()
        if form.get("do_summary") and not os.environ.get("ANTHROPIC_API_KEY"):
            print("⚠ Claude API 키가 없어 요약은 건너뜁니다.")
            form["do_summary"] = False
        argv = build_argv(form)
        JOB.out_dir = str(Path(argv[2]).expanduser())
        paper_finder.CONFIRM = JOB.confirm
        paper_finder.main(argv)
        print("\n✅ 모든 작업이 끝났습니다.")
    except SystemExit as e:
        if e.code not in (0, None):
            print(f"❌ {e.code}")
    except Exception as e:
        print(f"❌ 오류: {e}")
        print(traceback.format_exc(limit=3))
    finally:
        JOB.flush()
        sys.stdout = old
        JOB.running = False
        JOB.waiting = None


# ---------------------------------------------------------------- 웹 서버
TOKEN = secrets.token_urlsafe(16)


def _results() -> list[dict]:
    if not JOB.out_dir:
        return []
    f = Path(JOB.out_dir) / "results.json"
    try:
        rows = json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return []
    return [{"title": r["title"], "year": r.get("year"), "source": r.get("source"),
             "venue": r.get("venue"), "url": r.get("url"),
             "pdf": Path(r["pdf_path"]).name if r.get("pdf_path") else None,
             "summary": Path(r["summary_path"]).name if r.get("summary_path") else None} for r in rows]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code: int, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else (
            body.encode("utf-8") if isinstance(body, str) else json.dumps(body, ensure_ascii=False).encode("utf-8"))
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self) -> bool:
        return self.headers.get("X-Token") == TOKEN

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/":
            q = parse_qs(u.query)
            if q.get("t", [""])[0] != TOKEN:
                return self._send(403, "프로그램 창에 표시된 주소로 접속해 주세요.", "text/plain; charset=utf-8")
            html = resource_path("ui.html").read_text(encoding="utf-8").replace("__TOKEN__", TOKEN)
            return self._send(200, html, "text/html; charset=utf-8")
        if not self._authorized():
            return self._send(403, {"error": "forbidden"})
        if u.path == "/api/settings":
            return self._send(200, load_settings())
        if u.path == "/api/status":
            since = int(parse_qs(u.query).get("since", ["0"])[0])
            with JOB.lock:
                lines = JOB.lines[since:]
                n = len(JOB.lines)
            return self._send(200, {"lines": lines, "next": n, "running": JOB.running,
                                    "waiting": JOB.waiting, "out_dir": JOB.out_dir,
                                    "results": [] if JOB.running else _results()})
        if u.path == "/api/summary":
            name = parse_qs(u.query).get("name", [""])[0]
            f = (Path(JOB.out_dir or ".") / name)
            if not JOB.out_dir or Path(name).name != name or not name.endswith(".summary.md") or not f.exists():
                return self._send(404, {"error": "not found"})
            return self._send(200, {"text": f.read_text(encoding="utf-8")})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if not self._authorized():
            return self._send(403, {"error": "forbidden"})
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            body = {}
        path = urlparse(self.path).path
        if path == "/api/start":
            if JOB.running:
                return self._send(409, {"error": "이미 실행 중입니다."})
            if not (body.get("query") or "").strip():
                return self._send(400, {"error": "검색어를 입력하세요."})
            try:
                build_argv(body)
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            save_settings(body)
            JOB.lines, JOB.running, JOB.out_dir = [], True, None
            threading.Thread(target=run_job, args=(dict(body),), daemon=True).start()
            return self._send(200, {"ok": True})
        if path == "/api/confirm":
            JOB.release()
            return self._send(200, {"ok": True})
        if path == "/api/open-folder":
            d = body.get("dir") or JOB.out_dir
            if d and Path(d).exists():
                open_path(Path(d))
                return self._send(200, {"ok": True})
            return self._send(404, {"error": "폴더가 아직 없습니다."})
        if path == "/api/open-file":
            name = body.get("name", "")
            f = Path(JOB.out_dir or ".") / name
            if JOB.out_dir and Path(name).name == name and f.exists():
                open_path(f)
                return self._send(200, {"ok": True})
            return self._send(404, {"error": "파일이 없습니다."})
        if path == "/api/pick-folder":
            return self._send(200, {"dir": pick_folder(body.get("dir"))})
        if path == "/api/quit":
            self._send(200, {"ok": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        self._send(404, {"error": "not found"})


def open_path(p: Path):
    if sys.platform.startswith("win"):
        os.startfile(str(p))  # noqa
    elif sys.platform == "darwin":
        os.system(f'open "{p}"')
    else:
        os.system(f'xdg-open "{p}" >/dev/null 2>&1 &')


def pick_folder(initial: str | None) -> str | None:
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        d = filedialog.askdirectory(initialdir=initial or DEFAULT_OUT, title="저장 폴더 선택")
        root.destroy()
        return d or None
    except Exception:
        return None


def free_port(start=8765) -> int:
    for port in range(start, start + 50):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return 0


def selftest() -> int:
    """빌드 확인용: 내장 모듈과 브라우저(Edge/Chrome) 실행, RISS 검색이 되는지 점검."""
    import tempfile
    import paper_finder  # noqa: F401
    import riss
    from browser_dl import BrowserSession
    print("RISS 검색:", len(riss.search("MMPI", n=2, kinds=("kor",))), "건")
    b = BrowserSession(tempfile.mkdtemp(), headless=True)
    try:
        b.open_page("https://www.riss.kr/")
        print("브라우저 페이지:", b._page().title())
    finally:
        b.close()
    print("SELFTEST OK")
    return 0


def main():
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    port = free_port()
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{srv.server_address[1]}/?t={TOKEN}"
    print("=" * 60)
    print(" 논문 찾기 도우미가 실행되었습니다.")
    print(f" 브라우저가 자동으로 열리지 않으면 아래 주소를 복사해 여세요:\n   {url}")
    print(" 이 창을 닫으면 프로그램이 종료됩니다.")
    print("=" * 60)
    if not os.environ.get("PAPER_FINDER_NO_BROWSER"):
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
