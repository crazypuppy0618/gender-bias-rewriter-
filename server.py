import http.server
import json
import os
import sys
import time
import uuid
import threading
import urllib.parse
from datetime import datetime, timezone
from socketserver import ThreadingMixIn

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR", ROOT)
os.makedirs(DATA_DIR, exist_ok=True)
DATA_FILE = os.path.join(DATA_DIR, "shared_data.json")
APP_VERSION = "3.0"
MAX_RECORDS = 100000
MAX_FILE_BYTES = 50 * 1024 * 1024

DATA_LOCK = threading.Lock()


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def now_ms():
    return int(time.time() * 1000)


def empty_store():
    return {
        "schema": "gbr-shared-v1",
        "appVersion": APP_VERSION,
        "created": now_iso(),
        "lastUpdated": now_iso(),
        "stats": {
            "total": 0,
            "byType": {},
            "byAppVersion": {},
            "byLanguage": {},
        },
        "records": [],
    }


def load_store():
    if not os.path.exists(DATA_FILE):
        return empty_store()
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or "records" not in data:
            return empty_store()
        if "stats" not in data:
            data["stats"] = {"total": 0, "byType": {}, "byAppVersion": {}, "byLanguage": {}}
        return data
    except (json.JSONDecodeError, OSError) as e:
        sys.stderr.write(f"[shared-store] load error: {e}\n")
        return empty_store()


def save_store(data):
    if os.path.exists(DATA_FILE) and os.path.getsize(DATA_FILE) > MAX_FILE_BYTES:
        archive = DATA_FILE + f".archive.{now_ms()}.json"
        try:
            os.rename(DATA_FILE, archive)
            sys.stderr.write(f"[shared-store] archived to {archive}\n")
        except OSError:
            pass
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DATA_FILE)


def recalc_stats(data):
    by_type = {}
    by_ver = {}
    by_lang = {}
    for r in data["records"]:
        t = r.get("type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1
        v = r.get("appVersion", "unknown")
        by_ver[v] = by_ver.get(v, 0) + 1
        lang = r.get("data", {}).get("language", "unknown")
        by_lang[lang] = by_lang.get(lang, 0) + 1
    data["stats"] = {
        "total": len(data["records"]),
        "byType": by_type,
        "byAppVersion": by_ver,
        "byLanguage": by_lang,
    }


def make_record(record_type, payload):
    if not isinstance(payload, dict):
        payload = {"value": payload}
    return {
        "id": f"{record_type[:3]}_{uuid.uuid4().hex[:12]}",
        "type": record_type,
        "appVersion": payload.pop("__appVersion", APP_VERSION),
        "ts": now_ms(),
        "data": payload,
    }


VALID_TYPES = {"detection", "customPattern", "edit", "corpus", "vote"}


def validate_record(record):
    if not isinstance(record, dict):
        return False, "Record must be an object"
    if "type" not in record or record["type"] not in VALID_TYPES:
        return False, f"Invalid type. Must be one of {sorted(VALID_TYPES)}"
    if "data" not in record or not isinstance(record["data"], dict):
        return False, "Missing data field"
    return True, None


def sanitize_record(record):
    data = record["data"]
    if record["type"] == "detection":
        text = data.pop("text", None)
        if text is not None:
            data["textLength"] = len(text)
            data["textHash"] = str(hash(text))[-8:]
        findings = data.get("findings", [])
        if isinstance(findings, list) and findings:
            data["findingPhrases"] = [f.get("phrase", "") for f in findings if isinstance(f, dict)][:20]
            data["findingTypes"] = list({f.get("type", "") for f in findings if isinstance(f, dict)})
            data.pop("findings", None)
    elif record["type"] == "customPattern":
        for k in ("author", "email", "userId", "name", "ip"):
            data.pop(k, None)
    elif record["type"] == "corpus":
        for k in ("author", "email", "userId", "ip"):
            data.pop(k, None)
    elif record["type"] == "edit":
        for k in ("author", "email", "userId", "ip"):
            data.pop(k, None)
    return record


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write(f"[{datetime.now().strftime('%H:%M:%S')}] {fmt % args}\n")

    def _send_json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, code, path, content_type=None):
        if not os.path.exists(path):
            self.send_error(404, "Not Found")
            return
        try:
            with open(path, "rb") as f:
                body = f.read()
        except OSError:
            self.send_error(500, "Read Error")
            return
        self.send_response(code)
        if content_type is None:
            if path.endswith(".html"):
                content_type = "text/html; charset=utf-8"
            elif path.endswith(".js") or path.endswith(".mjs"):
                content_type = "application/javascript; charset=utf-8"
            elif path.endswith(".css"):
                content_type = "text/css; charset=utf-8"
            elif path.endswith(".json"):
                content_type = "application/json; charset=utf-8"
            elif path.endswith(".svg"):
                content_type = "image/svg+xml"
            else:
                content_type = "application/octet-stream"
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(204, {})

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/api/records":
            return self._handle_get_records(qs)
        if path == "/api/stats":
            return self._handle_get_stats()
        if path == "/api/patterns":
            return self._handle_get_patterns()
        if path == "/api/corpus":
            return self._handle_get_corpus()
        if path == "/api/health":
            return self._send_json(200, {"ok": True, "version": APP_VERSION, "ts": now_ms()})
        if path == "/api/export":
            return self._handle_export()

        if path == "/" or path == "":
            path = "/index.html"

        safe = self._safe_path(path)
        if safe is None:
            self.send_error(403, "Forbidden")
            return
        self._send_file(200, os.path.join(ROOT, safe.lstrip("/")))

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/records":
            return self._handle_post_record()
        self.send_error(404, "Not Found")

    def _safe_path(self, path):
        decoded = urllib.parse.unquote(path)
        if ".." in decoded or decoded.startswith("//"):
            return None
        if not decoded.startswith("/"):
            decoded = "/" + decoded
        return decoded

    def _handle_get_records(self, qs):
        record_type = qs.get("type", [None])[0]
        try:
            limit = int(qs.get("limit", [1000])[0])
        except ValueError:
            limit = 1000
        limit = max(1, min(limit, 5000))
        with DATA_LOCK:
            data = load_store()
        records = data["records"]
        if record_type:
            records = [r for r in records if r.get("type") == record_type]
        records = records[-limit:]
        self._send_json(200, {
            "ok": True,
            "version": APP_VERSION,
            "total": len(records),
            "stats": data["stats"],
            "records": records,
        })

    def _handle_get_stats(self):
        with DATA_LOCK:
            data = load_store()
        recalc_stats(data)
        self._send_json(200, {"ok": True, "version": APP_VERSION, "stats": data["stats"]})

    def _handle_get_patterns(self):
        with DATA_LOCK:
            data = load_store()
        patterns = [r for r in data["records"] if r.get("type") == "customPattern"]
        patterns = patterns[-500:]
        self._send_json(200, {
            "ok": True,
            "version": APP_VERSION,
            "count": len(patterns),
            "patterns": [{"id": r["id"], "ts": r["ts"], "appVersion": r["appVersion"], **r["data"]} for r in patterns],
        })

    def _handle_get_corpus(self):
        with DATA_LOCK:
            data = load_store()
        corpus = [r for r in data["records"] if r.get("type") == "corpus"]
        corpus = corpus[-500:]
        self._send_json(200, {
            "ok": True,
            "version": APP_VERSION,
            "count": len(corpus),
            "corpus": [{"id": r["id"], "ts": r["ts"], "appVersion": r["appVersion"], **r["data"]} for r in corpus],
        })

    def _handle_export(self):
        with DATA_LOCK:
            data = load_store()
        self._send_json(200, data)

    def _handle_post_record(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 100 * 1024:
                self._send_json(400, {"ok": False, "error": "Invalid Content-Length"})
                return
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError as e:
                self._send_json(400, {"ok": False, "error": f"Invalid JSON: {e}"})
                return
        except Exception as e:
            self._send_json(400, {"ok": False, "error": str(e)})
            return

        record = make_record(payload.get("type"), payload.get("data", {}))
        ok, err = validate_record(record)
        if not ok:
            self._send_json(400, {"ok": False, "error": err})
            return
        record = sanitize_record(record)

        with DATA_LOCK:
            data = load_store()
            if len(data["records"]) >= MAX_RECORDS:
                data["records"] = data["records"][-MAX_RECORDS // 2 :]
            data["records"].append(record)
            data["lastUpdated"] = now_iso()
            data["appVersion"] = APP_VERSION
            recalc_stats(data)
            try:
                save_store(data)
            except OSError as e:
                self._send_json(500, {"ok": False, "error": f"Save failed: {e}"})
                return
        self._send_json(200, {
            "ok": True,
            "id": record["id"],
            "ts": record["ts"],
            "totalAfter": data["stats"]["total"],
        })


class ThreadedHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    port = int(os.environ.get("PORT", "8765"))
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(empty_store(), f, ensure_ascii=False, indent=2)
    server = ThreadedHTTPServer(("0.0.0.0", port), Handler)
    print(f"[shared-store] data file: {DATA_FILE}")
    print(f"[shared-store] app version: {APP_VERSION}")
    print(f"[shared-store] serving on http://0.0.0.0:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
