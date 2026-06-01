from __future__ import annotations

import contextlib
import json
import mimetypes
import shutil
import subprocess
import threading
import time
import webbrowser
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import unquote, urlparse

import psutil

from config.config_loader import get_config
from core.logger import get_logger
from core.paths import project_path, resolve_project_root
from core.performance_monitor import get_performance_monitor
from core.performance_tracker import get_performance_tracker
from core.session_manager import get_session_manager
from core.ui_theme import C

try:
    from PyQt6.QtCore import QUrl
    from PyQt6.QtWidgets import QApplication, QMainWindow
    from PyQt6.QtWebEngineWidgets import QWebEngineView

    QT_WEBENGINE_AVAILABLE = True
except Exception:
    QUrl = None  # type: ignore[assignment]
    QApplication = None  # type: ignore[assignment]
    QMainWindow = object  # type: ignore[assignment]
    QWebEngineView = None  # type: ignore[assignment]
    QT_WEBENGINE_AVAILABLE = False


logger = get_logger(__name__)


BASE_DIR = resolve_project_root()
UI_DIR = project_path("UI")
UI_DIST_DIR = UI_DIR / "dist"
VITE_BIN = UI_DIR / "node_modules" / "vite" / "bin" / "vite.js"


def _find_node_executable() -> Optional[str]:
    node = shutil.which("node")
    if node:
        return node

    for candidate in (
        Path(r"C:\Program Files\nodejs\node.exe"),
        Path(r"C:\Program Files (x86)\nodejs\node.exe"),
    ):
        if candidate.exists():
            return str(candidate)

    return None


class _JARVISWindow(QMainWindow):
    def __init__(self, ui: "JarvisUI", url: str):
        super().__init__()
        self._ui = ui
        self.setWindowTitle("J.A.R.V.I.S")
        self.resize(1460, 960)
        self.setMinimumSize(1180, 760)

        if QWebEngineView is None:
            raise RuntimeError("Qt WebEngine is not available")

        self._web = QWebEngineView(self)
        self.setCentralWidget(self._web)
        self._web.setUrl(QUrl(url))

    def closeEvent(self, event):  # noqa: N802
        try:
            self._ui.shutdown()
        finally:
            super().closeEvent(event)


class JarvisUI:
    """
    Small Python bridge that launches the React UI in a dedicated window and
    exposes the runtime state for the frontend.
    """

    def __init__(self, face_path: str, size=None):
        self.face_path = Path(face_path)
        self.size = size
        self.root = self

        self._lock = threading.RLock()
        self._muted = False
        self._current_file: Optional[str] = None
        self._state = "LISTENING"
        self._logs = deque(maxlen=500)
        self._on_text_command = None
        self._shutdown_event = threading.Event()
        self._server: Optional[ThreadingHTTPServer] = None
        self._server_thread: Optional[threading.Thread] = None
        self._server_url: Optional[str] = None
        self._app = None
        self._window = None
        self._config = get_config()
        self._session_manager = get_session_manager()

        self._ensure_ui_assets()
        self._start_http_server()
        self._log("SYS: UI bridge ready.")

    # ------------------------------------------------------------------
    # Compatibility API used by JarvisLive
    # ------------------------------------------------------------------
    @property
    def muted(self) -> bool:
        with self._lock:
            return self._muted

    @muted.setter
    def muted(self, value: bool) -> None:
        with self._lock:
            self._muted = bool(value)
        self._log(f"SYS: Microphone {'muted' if value else 'active'}.")

    @property
    def current_file(self) -> str | None:
        with self._lock:
            return self._current_file

    @current_file.setter
    def current_file(self, value: str | None) -> None:
        with self._lock:
            self._current_file = value

    @property
    def on_text_command(self):
        return self._on_text_command

    @on_text_command.setter
    def on_text_command(self, cb):
        self._on_text_command = cb

    def set_state(self, state: str):
        with self._lock:
            self._state = state
        self._log(f"SYS: State changed to {state}.")

    def write_log(self, text: str):
        self._log(text)

    def wait_for_api_key(self):
        api_key = str(self._config.get_api_key("gemini") or "").strip()
        if api_key:
            return

        api_file = BASE_DIR / "config" / "api_keys.json"
        if api_file.exists():
            try:
                data = json.loads(api_file.read_text(encoding="utf-8"))
                if str(data.get("gemini_api_key", "")).strip():
                    return
            except Exception:
                pass

        logger.warning(
            "No Gemini API key found. The UI will start, but live voice mode may fail until a key is configured."
        )

    def start_speaking(self):
        self.set_state("SPEAKING")

    def stop_speaking(self):
        if not self.muted:
            self.set_state("LISTENING")

    def protocol(self, *_args, **_kwargs):
        """Compatibility shim for the old Tk-style root API."""
        return None

    def mainloop(self):
        if QT_WEBENGINE_AVAILABLE:
            self._run_qt_window()
            return

        if self._server_url:
            webbrowser.open(self._server_url, new=1, autoraise=True)
        logger.warning(
            "Qt WebEngine is not available. Falling back to the system browser."
        )
        try:
            while not self._shutdown_event.wait(0.25):
                pass
        except KeyboardInterrupt:
            pass
        finally:
            self.shutdown()

    def shutdown(self):
        if self._shutdown_event.is_set():
            return

        self._shutdown_event.set()

        with contextlib.suppress(Exception):
            if self._server is not None:
                self._server.shutdown()
                self._server.server_close()
        self._server = None

        with contextlib.suppress(Exception):
            if self._app is not None:
                app = QApplication.instance() if QApplication else None
                if app is not None:
                    app.quit()

    # ------------------------------------------------------------------
    # UI state endpoints
    # ------------------------------------------------------------------
    def _log(self, text: str) -> None:
        entry = {
            "timestamp": time.time(),
            "text": str(text).strip(),
        }
        with self._lock:
            self._logs.append(entry)

    def _current_state(self) -> Dict[str, Any]:
        with self._lock:
            state = self._state
            muted = self._muted
            current_file = self._current_file
        voice_first = bool(self._config.get("ui.voice_first", True))

        session = self._session_manager.get_current_session()
        recent_sessions = self._session_manager.get_recent_sessions(limit=16)
        return {
            "state": state,
            "muted": muted,
            "speaking": state == "SPEAKING",
            "current_file": current_file,
            "voice_focus": voice_first,
            "default_view": self._config.get("ui.default_view", "voice"),
            "logs": list(self._logs)[-80:],
            "session": session,
            "recent_sessions": recent_sessions,
        }

    def _resource_snapshot(self) -> Dict[str, Any]:
        cpu = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()
        disk_root = Path("C:\\") if Path("C:\\").exists() else Path("/")
        disk = psutil.disk_usage(str(disk_root))
        proc = psutil.Process()

        perf_monitor = get_performance_monitor()
        perf_tracker = get_performance_tracker()
        perf_summary = perf_tracker.get_performance_summary()

        try:
            recent_resource_stats = perf_monitor.get_resource_stats(minutes=15)
        except Exception as exc:
            recent_resource_stats = {"error": str(exc)}

        return {
            "cpu_percent": round(cpu, 1),
            "memory_percent": round(memory.percent, 1),
            "memory_mb": round(memory.used / (1024 * 1024), 1),
            "disk_percent": round(disk.percent, 1),
            "threads": proc.num_threads(),
            "processes": len(psutil.pids()),
            "uptime_seconds": int(time.time() - psutil.boot_time()),
            "performance": perf_summary,
            "resource_trend": recent_resource_stats,
        }

    def _settings_payload(self) -> Dict[str, Any]:
        return {
            "ui": {
                "default_view": self._config.get("ui.default_view", "voice"),
                "voice_first": bool(self._config.get("ui.voice_first", True)),
            },
            "calendar": {
                "enabled": bool(self._config.get("calendar.enabled", True)),
                "credentials_path": str(
                    self._config.get(
                        "calendar.credentials_path",
                        str(project_path("config", "gmail_credentials.json")),
                    )
                ),
                "token_path": str(
                    self._config.get(
                        "calendar.token_path",
                        str(project_path("config", "calendar_token.json")),
                    )
                ),
            },
        }

    def _calendar_payload(self) -> Dict[str, Any]:
        calendar_cfg = self._settings_payload()["calendar"]
        credentials = Path(calendar_cfg["credentials_path"])
        token = Path(calendar_cfg["token_path"])
        if not credentials.is_absolute():
            credentials = BASE_DIR / credentials
        if not token.is_absolute():
            token = BASE_DIR / token

        return {
            "enabled": calendar_cfg["enabled"],
            "configured": credentials.exists(),
            "authenticated": token.exists(),
            "credentials_path": str(credentials),
            "token_path": str(token),
        }

    def _dashboard_payload(self) -> Dict[str, Any]:
        return {
            "state": self._current_state(),
            "resources": self._resource_snapshot(),
            "settings": self._settings_payload(),
            "calendar": self._calendar_payload(),
            "current_session": self._session_manager.get_current_session(),
            "recent_sessions": self._session_manager.get_recent_sessions(limit=12),
        }

    def _recent_chats_payload(self) -> Dict[str, Any]:
        return {
            "sessions": self._session_manager.get_recent_sessions(limit=30),
            "current_session_id": (
                self._session_manager.get_current_session() or {}
            ).get("id"),
        }

    # ------------------------------------------------------------------
    # HTTP server
    # ------------------------------------------------------------------
    def _ensure_ui_assets(self) -> None:
        index_html = UI_DIST_DIR / "index.html"
        if index_html.exists():
            return

        if not UI_DIR.exists():
            raise RuntimeError("UI/ directory is missing")

        logger.info("Building React UI bundle...")
        if not VITE_BIN.exists():
            raise RuntimeError(
                "UI build toolchain is missing. Run 'npm install' in UI/ first."
            )

        node_executable = _find_node_executable()
        if not node_executable:
            raise RuntimeError(
                "Node.js is not available. Install Node.js or add it to PATH, "
                "then run 'npm install' in UI/."
            )

        result = subprocess.run(
            [node_executable, str(VITE_BIN), "build", "--configLoader", "native"],
            cwd=str(UI_DIR),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            logger.error(result.stdout)
            logger.error(result.stderr)
            raise RuntimeError(
                "UI build failed. Run 'npm install' and 'npm run build' in UI/."
            )

    def _start_http_server(self) -> None:
        ui = self

        class Handler(BaseHTTPRequestHandler):
            server_version = "JarvisUI/1.0"

            def log_message(self, format, *args):  # noqa: A003
                logger.debug("[UI] " + format, *args)

            def _read_json(self) -> Dict[str, Any]:
                length = int(self.headers.get("Content-Length", "0") or "0")
                if length <= 0:
                    return {}
                raw = self.rfile.read(length).decode("utf-8")
                if not raw.strip():
                    return {}
                return json.loads(raw)

            def _send_json(self, status: int, payload: Dict[str, Any]) -> None:
                blob = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(blob)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(blob)

            def _send_bytes(self, status: int, blob: bytes, content_type: str) -> None:
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(blob)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(blob)

            def do_GET(self):  # noqa: N802
                ui._handle_get(self)

            def do_POST(self):  # noqa: N802
                ui._handle_post(self)

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._server.daemon_threads = True
        self._server_thread = threading.Thread(
            target=self._server.serve_forever,
            daemon=True,
            name="JarvisUIHttpServer",
        )
        self._server_thread.start()
        port = self._server.server_address[1]
        self._server_url = f"http://127.0.0.1:{port}"
        logger.info("UI server listening on %s", self._server_url)

    def _handle_get(self, request: BaseHTTPRequestHandler) -> None:
        path = urlparse(request.path).path

        if path == "/api/dashboard":
            return request._send_json(200, self._dashboard_payload())  # type: ignore[attr-defined]
        if path == "/api/state":
            return request._send_json(200, self._current_state())  # type: ignore[attr-defined]
        if path == "/api/resources":
            return request._send_json(200, self._resource_snapshot())  # type: ignore[attr-defined]
        if path == "/api/chats":
            return request._send_json(200, self._recent_chats_payload())  # type: ignore[attr-defined]
        if path.startswith("/api/chats/"):
            session_id = path.split("/api/chats/", 1)[1].strip("/")
            session = self._session_manager.get_session(session_id)
            if not session:
                return request._send_json(404, {"error": "chat not found"})  # type: ignore[attr-defined]
            return request._send_json(200, {"session": session})  # type: ignore[attr-defined]
        if path == "/api/settings":
            return request._send_json(200, self._settings_payload())  # type: ignore[attr-defined]
        if path == "/api/calendar/status":
            return request._send_json(200, self._calendar_payload())  # type: ignore[attr-defined]
        if path == "/api/logs":
            return request._send_json(200, {"logs": list(self._logs)[-150:]})  # type: ignore[attr-defined]

        return self._serve_static(request, path)

    def _handle_post(self, request: BaseHTTPRequestHandler) -> None:
        path = urlparse(request.path).path
        try:
            payload = request._read_json()  # type: ignore[attr-defined]
        except Exception as exc:
            return request._send_json(400, {"error": f"invalid json: {exc}"})  # type: ignore[attr-defined]

        if path == "/api/command":
            text = str(payload.get("text", "")).strip()
            if not text:
                return request._send_json(400, {"error": "missing text"})  # type: ignore[attr-defined]

            if callable(self._on_text_command):
                threading.Thread(
                    target=self._on_text_command,
                    args=(text,),
                    daemon=True,
                    name="JarvisTextCommand",
                ).start()
            return request._send_json(202, {"status": "queued"})  # type: ignore[attr-defined]

        if path == "/api/mute":
            muted = bool(payload.get("muted", False))
            self.muted = muted
            return request._send_json(200, {"muted": self.muted})  # type: ignore[attr-defined]

        if path == "/api/session/new":
            session_id = self._session_manager.start_session(force=True)
            return request._send_json(
                200,
                {
                    "session_id": session_id,
                    "current_session": self._session_manager.get_current_session(),
                },
            )  # type: ignore[attr-defined]

        if path == "/api/session/end":
            session_id = self._session_manager.finalize_session(
                summary=str(payload.get("summary", "")).strip() or None
            )
            return request._send_json(
                200,
                {
                    "session_id": session_id,
                    "current_session": self._session_manager.get_current_session(),
                },
            )  # type: ignore[attr-defined]

        if path == "/api/settings":
            updates = payload if isinstance(payload, dict) else {}
            changed = get_config().update_local_settings(updates)

            if "calendar" in updates:
                with contextlib.suppress(Exception):
                    from actions.calendar_manager import reset_calendar_manager

                    reset_calendar_manager()

            return request._send_json(
                200,
                {
                    "status": "saved",
                    "settings": self._settings_payload(),
                    "raw": changed,
                },
            )  # type: ignore[attr-defined]

        if path == "/api/calendar/connect":
            updates = payload if isinstance(payload, dict) else {}
            if updates:
                get_config().update_local_settings({"calendar": updates})

            with contextlib.suppress(Exception):
                from actions.calendar_manager import reset_calendar_manager

                reset_calendar_manager()

            try:
                from actions.calendar_manager import get_calendar_manager

                manager = get_calendar_manager()
                if not manager.enabled:
                    return request._send_json(
                        200,
                        {
                            "status": "disabled",
                            "message": "Calendar integration is disabled.",
                            "calendar": self._calendar_payload(),
                        },
                    )  # type: ignore[attr-defined]

                if manager.service:
                    return request._send_json(
                        200,
                        {
                            "status": "connected",
                            "message": "Google Calendar is connected.",
                            "calendar": self._calendar_payload(),
                        },
                    )  # type: ignore[attr-defined]

                return request._send_json(
                    200,
                    {
                        "status": "pending",
                        "message": "Calendar setup is pending. Check credentials/token paths.",
                        "calendar": self._calendar_payload(),
                    },
                )  # type: ignore[attr-defined]
            except Exception as exc:
                return request._send_json(
                    500,
                    {
                        "status": "error",
                        "message": str(exc),
                        "calendar": self._calendar_payload(),
                    },
                )  # type: ignore[attr-defined]

        return request._send_json(404, {"error": "unknown endpoint"})  # type: ignore[attr-defined]

    def _serve_static(self, request: BaseHTTPRequestHandler, path: str) -> None:
        if path in {"", "/"}:
            candidate = UI_DIST_DIR / "index.html"
        else:
            candidate = (UI_DIST_DIR / unquote(path.lstrip("/"))).resolve()
            try:
                candidate.relative_to(UI_DIST_DIR.resolve())
            except Exception:
                candidate = UI_DIST_DIR / "index.html"

        if not candidate.exists() or candidate.is_dir():
            candidate = UI_DIST_DIR / "index.html"

        if not candidate.exists():
            return request._send_json(404, {"error": "frontend not built"})  # type: ignore[attr-defined]

        content_type = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
        data = candidate.read_bytes()
        return request._send_bytes(200, data, content_type)  # type: ignore[attr-defined]

    def _run_qt_window(self) -> None:
        if QApplication is None or QWebEngineView is None:
            raise RuntimeError("Qt WebEngine is not available")

        if not self._server_url:
            raise RuntimeError("UI server has not started")

        app = QApplication.instance() or QApplication([])
        app.setApplicationName("JARVIS")
        self._app = app

        self._window = _JARVISWindow(self, self._server_url)
        self._window.show()

        try:
            app.exec()
        finally:
            self.shutdown()
