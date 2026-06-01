"""Compatibility shim for legacy `ui` imports.

The runtime UI now lives in `ui_bridge.JarvisUI` and the shared theme
constants live in `core.ui_theme.C`.
"""

from core.ui_theme import C

__all__ = ["C", "JarvisUI"]


def __getattr__(name: str):
    if name == "JarvisUI":
        from ui_bridge import JarvisUI as _JarvisUI

        return _JarvisUI
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
