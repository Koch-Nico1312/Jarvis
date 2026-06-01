"""
Session Context Manager for JARVIS
Maintains conversation context across reconnections and persists chat history.
"""

from __future__ import annotations

import json
import threading
import uuid
from collections import deque
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

from core.logger import get_logger

logger = get_logger(__name__)


def _base_dir() -> Path:
    return Path(__file__).resolve().parent.parent


BASE_DIR = _base_dir()
CHAT_HISTORY_PATH = BASE_DIR / "data" / "chat_history.json"


class SessionContextManager:
    """
    Maintains conversation context across Gemini Live reconnections and
    persists a readable transcript history for the UI.
    """

    def __init__(
        self,
        max_messages: int = 200,
        max_tool_results: int = 25,
        max_sessions: int = 40,
    ):
        self.max_messages = max_messages
        self.max_tool_results = max_tool_results
        self.max_sessions = max_sessions

        self._history_path = CHAT_HISTORY_PATH
        self._messages: Deque[Dict[str, Any]] = deque(maxlen=max_messages)
        self._tool_results: Deque[Dict[str, Any]] = deque(maxlen=max_tool_results)
        self._sessions: Deque[Dict[str, Any]] = deque(maxlen=max_sessions)
        self._current_session: Optional[Dict[str, Any]] = None
        self._session_token: Optional[str] = None
        self._session_start: Optional[datetime] = None
        self._reconnect_count: int = 0
        self._lock = threading.RLock()

        self._load_history()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------
    def _load_history(self) -> None:
        """Load persisted chat history from disk."""
        if not self._history_path.exists():
            return

        try:
            raw = json.loads(self._history_path.read_text(encoding="utf-8"))
            sessions = raw.get("sessions", [])
            if isinstance(sessions, list):
                for session in sessions[: self.max_sessions]:
                    if isinstance(session, dict):
                        self._sessions.append(session)

            current_session = raw.get("current_session")
            if isinstance(current_session, dict) and current_session.get("id"):
                self._current_session = current_session
                self._messages = deque(
                    self._message_list_from_session(current_session),
                    maxlen=self.max_messages,
                )
                self._tool_results = deque(
                    current_session.get("tool_results", []),
                    maxlen=self.max_tool_results,
                )
                self._session_start = self._parse_dt(current_session.get("started_at"))
                logger.info(
                    "[Session] Loaded active session %s with %s messages",
                    current_session.get("id"),
                    len(self._messages),
                )
        except Exception as exc:
            logger.warning("[Session] Could not load chat history: %s", exc)

    def _save_history(self) -> None:
        """Persist chat history to disk."""
        try:
            self._history_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "current_session": self._current_session,
                "sessions": list(self._sessions),
                "updated_at": datetime.now().isoformat(),
            }
            tmp_path = self._history_path.with_suffix(".tmp")
            tmp_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            tmp_path.replace(self._history_path)
        except Exception as exc:
            logger.warning("[Session] Could not save chat history: %s", exc)

    @staticmethod
    def _parse_dt(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except Exception:
            return None

    @staticmethod
    def _message_list_from_session(session: Dict[str, Any]) -> List[Dict[str, Any]]:
        messages = session.get("messages", [])
        return messages if isinstance(messages, list) else []

    def _ensure_current_session(self, force_new: bool = False) -> Dict[str, Any]:
        """Create or reuse the active session."""
        if self._current_session and not force_new:
            return self._current_session

        if self._current_session and force_new and self._current_session.get("messages"):
            self._archive_current_session()

        now = datetime.now().isoformat()
        session_id = f"{datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:8]}"
        self._current_session = {
            "id": session_id,
            "title": "Voice session",
            "started_at": now,
            "updated_at": now,
            "ended_at": None,
            "messages": [],
            "tool_results": [],
            "summary": "",
            "status": "active",
        }
        self._messages.clear()
        self._tool_results.clear()
        self._session_start = datetime.now()
        logger.info("[Session] New session started: %s", session_id)
        self._save_history()
        return self._current_session

    def _archive_current_session(self, summary: Optional[str] = None) -> Optional[str]:
        """Move the current session into the archive list."""
        if not self._current_session:
            return None

        session = deepcopy(self._current_session)
        messages = self._message_list_from_session(session)
        if not messages:
            self._current_session = None
            self._messages.clear()
            self._tool_results.clear()
            self._save_history()
            return None

        now = datetime.now().isoformat()
        session["ended_at"] = now
        session["updated_at"] = now
        session["status"] = "completed"

        if summary:
            session["summary"] = summary
        elif not session.get("summary"):
            session["summary"] = self._build_session_summary(session)

        try:
            from memory.conversation_compression import get_compressor

            compressor = get_compressor()
            compressor.store_conversation(
                session["id"],
                messages,
                tags=["jarvis", "session", "transcript"],
            )
        except Exception as exc:
            logger.debug("[Session] Conversation compression unavailable: %s", exc)

        self._sessions.appendleft(session)
        self._current_session = None
        self._messages.clear()
        self._tool_results.clear()
        self._session_start = None
        self._save_history()
        logger.info("[Session] Archived session %s", session.get("id"))
        return session.get("id")

    def _build_session_summary(self, session: Dict[str, Any]) -> str:
        messages = self._message_list_from_session(session)
        if not messages:
            return ""

        first_user = next((m for m in messages if m.get("role") == "user"), None)
        if first_user:
            content = str(first_user.get("content", "")).strip()
            if content:
                return content[:140]

        last_message = messages[-1]
        content = str(last_message.get("content", "")).strip()
        return content[:140] if content else "Jarvis session"

    def _append_message(self, role: str, text: str, extra: Optional[Dict[str, Any]] = None) -> None:
        text = str(text or "").strip()
        if not text:
            return

        with self._lock:
            session = self._ensure_current_session()

            message: Dict[str, Any] = {
                "id": uuid.uuid4().hex,
                "role": role,
                "content": text,
                "timestamp": datetime.now().isoformat(),
            }
            if extra:
                message.update(extra)

            session["messages"].append(message)
            session["updated_at"] = message["timestamp"]

            if role == "user" and session.get("title") in {"Voice session", "", None}:
                session["title"] = text[:80] or "Voice session"
            elif role == "assistant" and not session.get("title"):
                session["title"] = "Jarvis conversation"

            self._messages.append(message)
            if role == "tool":
                self._tool_results.append(message)

            if len(session["messages"]) > self.max_messages:
                session["messages"] = session["messages"][-self.max_messages :]

            self._save_history()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def start_session(self, force: bool = False) -> str:
        """Mark the start of a new session and return its ID."""
        with self._lock:
            session = self._ensure_current_session(force_new=force)
            return str(session["id"])

    def finalize_session(self, summary: Optional[str] = None) -> Optional[str]:
        """Archive the active session and persist it for later reading."""
        with self._lock:
            return self._archive_current_session(summary=summary)

    def record_user_message(self, text: str) -> None:
        """Record a user message."""
        self._append_message("user", text)

    def record_jarvis_response(self, text: str) -> None:
        """Record a JARVIS response."""
        self._append_message("assistant", text)

    def record_tool_execution(self, tool_name: str, args: dict, result: str) -> None:
        """Record a tool execution result."""
        summary = {
            "tool": tool_name,
            "args_summary": str(args)[:200],
            "result_summary": str(result)[:300],
        }
        self._append_message(
            "tool",
            f"{tool_name}: {str(result).strip()}",
            extra=summary,
        )

    def save_session_token(self, token: str) -> None:
        """Save Gemini session resumption token."""
        self._session_token = token

    def get_session_token(self) -> Optional[str]:
        """Get saved session resumption token."""
        return self._session_token

    def mark_reconnect(self) -> None:
        """Mark that a reconnection occurred."""
        self._reconnect_count += 1
        logger.info("[Session] Reconnection #%s", self._reconnect_count)

    def build_context_summary(self) -> str:
        """
        Build a context summary string for injection into the system prompt.
        """
        with self._lock:
            if not self._messages and not self._tool_results:
                return ""

            lines: List[str] = []
            lines.append("[CONVERSATION CONTEXT - Resumed session, continue naturally]")
            lines.append(
                f"Session reconnection #{self._reconnect_count}. Continue as if uninterrupted."
            )
            lines.append("")

            if self._messages:
                lines.append("Recent conversation:")
                for msg in list(self._messages)[-15:]:
                    role = msg.get("role", "assistant")
                    if role == "user":
                        label = "User"
                    elif role == "tool":
                        label = "Tool"
                    else:
                        label = "JARVIS"
                    content = str(msg.get("content", ""))[:250]
                    lines.append(f"  {label}: {content}")
                lines.append("")

            if self._tool_results:
                lines.append("Recent actions taken:")
                for tool in list(self._tool_results)[-5:]:
                    lines.append(
                        f"  - {tool.get('tool', 'tool')}: {str(tool.get('result_summary', ''))[:150]}"
                    )
                lines.append("")

            lines.append(
                "Continue the conversation naturally. Do NOT say 'welcome back' or mention reconnection."
            )

            result = "\n".join(lines)
            if len(result) > 2500:
                result = result[:2497] + "..."
            return result + "\n"

    def get_current_session(self) -> Optional[Dict[str, Any]]:
        """Return the active session snapshot."""
        with self._lock:
            if self._current_session is None:
                return None
            return deepcopy(self._current_session)

    def get_current_messages(self) -> List[Dict[str, Any]]:
        """Return the active transcript messages."""
        with self._lock:
            return deepcopy(list(self._messages))

    def get_recent_sessions(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Return recent archived sessions plus the active session if present."""
        with self._lock:
            sessions = []

            if self._current_session:
                current = deepcopy(self._current_session)
                current["status"] = "active"
                current["message_count"] = len(self._message_list_from_session(current))
                current["preview"] = self._build_session_summary(current)
                current.pop("messages", None)
                current.pop("tool_results", None)
                sessions.append(current)

            for session in list(self._sessions)[: max(0, limit - len(sessions))]:
                item = deepcopy(session)
                item["message_count"] = len(self._message_list_from_session(item))
                item["preview"] = self._build_session_summary(item)
                item.pop("messages", None)
                item.pop("tool_results", None)
                sessions.append(item)

            return sessions[:limit]

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Return a specific session by ID."""
        with self._lock:
            if self._current_session and self._current_session.get("id") == session_id:
                return deepcopy(self._current_session)

            for session in self._sessions:
                if session.get("id") == session_id:
                    return deepcopy(session)

        return None

    def clear(self) -> None:
        """Clear the active session context without deleting archived history."""
        with self._lock:
            self._current_session = None
            self._messages.clear()
            self._tool_results.clear()
            self._session_token = None
            self._reconnect_count = 0
            self._session_start = None
            self._save_history()


# Global instance
_session_manager: Optional[SessionContextManager] = None
_manager_lock = threading.Lock()


def get_session_manager() -> SessionContextManager:
    """Get the global session context manager."""
    global _session_manager
    if _session_manager is None:
        with _manager_lock:
            if _session_manager is None:
                _session_manager = SessionContextManager()
    return _session_manager
