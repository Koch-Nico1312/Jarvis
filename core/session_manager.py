"""
Session Context Manager for JARVIS
Maintains conversation context across reconnections.
"""
import json
import threading
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Deque
from core.logger import get_logger
logger = get_logger(__name__)

class SessionContextManager:
    """
    Maintains conversation context across Gemini Live reconnections.
    Stores recent messages and generates context summaries for reconnection.
    """
    
    def __init__(self, max_messages: int = 30, max_tool_results: int = 10):
        self.max_messages = max_messages
        self.max_tool_results = max_tool_results
        self._messages: Deque[Dict[str, Any]] = deque(maxlen=max_messages)
        self._tool_results: Deque[Dict[str, Any]] = deque(maxlen=max_tool_results)
        self._session_token: Optional[str] = None
        self._session_start: Optional[datetime] = None
        self._reconnect_count: int = 0
        self._lock = threading.Lock()
    
    def start_session(self) -> None:
        """Mark the start of a new session."""
        self._session_start = datetime.now()
        logger.info("[Session] New session started")
    
    def record_user_message(self, text: str) -> None:
        """Record a user message."""
        if not text or not text.strip():
            return
        with self._lock:
            self._messages.append({
                "role": "user",
                "content": text.strip(),
                "timestamp": datetime.now().isoformat()
            })
    
    def record_jarvis_response(self, text: str) -> None:
        """Record a JARVIS response."""
        if not text or not text.strip():
            return
        with self._lock:
            self._messages.append({
                "role": "jarvis",
                "content": text.strip(),
                "timestamp": datetime.now().isoformat()
            })
    
    def record_tool_execution(self, tool_name: str, args: dict, result: str) -> None:
        """Record a tool execution result."""
        with self._lock:
            self._tool_results.append({
                "tool": tool_name,
                "args_summary": str(args)[:200],
                "result_summary": str(result)[:300],
                "timestamp": datetime.now().isoformat()
            })
    
    def save_session_token(self, token: str) -> None:
        """Save Gemini session resumption token."""
        self._session_token = token
    
    def get_session_token(self) -> Optional[str]:
        """Get saved session resumption token."""
        return self._session_token
    
    def mark_reconnect(self) -> None:
        """Mark that a reconnection occurred."""
        self._reconnect_count += 1
        logger.info(f"[Session] Reconnection #{self._reconnect_count}")
    
    def build_context_summary(self) -> str:
        """
        Build a context summary string for injection into the system prompt
        after a reconnection.
        """
        with self._lock:
            if not self._messages and not self._tool_results:
                return ""
            
            lines = []
            lines.append("[CONVERSATION CONTEXT — Resumed session, continue naturally]")
            lines.append(f"Session reconnection #{self._reconnect_count}. Continue as if uninterrupted.")
            lines.append("")
            
            # Recent conversation
            if self._messages:
                lines.append("Recent conversation:")
                for msg in list(self._messages)[-15:]:  # Last 15 messages
                    role = "User" if msg["role"] == "user" else "JARVIS"
                    content = msg["content"][:250]
                    lines.append(f"  {role}: {content}")
                lines.append("")
            
            # Recent tool executions
            if self._tool_results:
                lines.append("Recent actions taken:")
                for tool in list(self._tool_results)[-5:]:  # Last 5 tools
                    lines.append(f"  - {tool['tool']}: {tool['result_summary'][:150]}")
                lines.append("")
            
            lines.append("Continue the conversation naturally. Do NOT say 'welcome back' or mention reconnection.")
            
            result = "\n".join(lines)
            # Limit total size
            if len(result) > 2500:
                result = result[:2497] + "..."
            
            return result + "\n"
    
    def clear(self) -> None:
        """Clear all session context."""
        with self._lock:
            self._messages.clear()
            self._tool_results.clear()
            self._session_token = None
            self._reconnect_count = 0

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
