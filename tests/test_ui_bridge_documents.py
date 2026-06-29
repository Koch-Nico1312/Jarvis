from __future__ import annotations

from collections import deque
from io import BytesIO
import threading


class UploadField:
    def __init__(self, filename: str, data: bytes):
        self.filename = filename
        self.file = BytesIO(data)


def make_ui_bridge():
    from ui_bridge import JarvisUI

    ui = object.__new__(JarvisUI)
    ui._lock = threading.RLock()
    ui._logs = deque(maxlen=20)
    return ui


def test_save_uploaded_files_analyzes_text_and_updates_payload(tmp_path, monkeypatch):
    import ui_bridge

    monkeypatch.setattr(ui_bridge, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(ui_bridge, "DOCUMENT_INDEX_PATH", tmp_path / "ui_documents.json")

    ui = make_ui_bridge()
    result = ui._save_uploaded_files(
        [UploadField("notes.txt", b"First useful line\nSecond line")],
        analyze=True,
        should_index=False,
    )

    assert result["status"] == "uploaded"
    assert result["errors"] == []
    assert result["indexed"] is False
    assert len(result["files"]) == 1
    assert result["files"][0]["name"] == "notes.txt"
    assert result["files"][0]["analysis"] == "First useful line"
    assert (tmp_path / "uploads" / "notes.txt").read_text(encoding="utf-8") == "First useful line\nSecond line"


def test_devices_payload_uses_lazy_psutil_import(monkeypatch):
    import ui_bridge

    ui = make_ui_bridge()
    monkeypatch.setattr(ui_bridge, "_psutil_module", None)

    result = ui._devices_payload()

    assert result["current"]["pid"]
    assert result["current"]["metrics_available"] is True
    assert result["items"][0]["status"] == "online"


def test_devices_payload_falls_back_without_psutil(monkeypatch):
    import ui_bridge

    ui = make_ui_bridge()
    monkeypatch.setattr(ui_bridge, "_get_psutil", lambda: None)

    result = ui._devices_payload()

    assert result["current"]["pid"]
    assert result["current"]["process"] == "python"
    assert result["current"]["metrics_available"] is False
    assert result["items"][0]["status"] == "online"
