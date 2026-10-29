"""Runtime settings, all overridable through environment variables.

    TRACKBALL_OUT          where generated designs, caches and bundles go (default ./out/web)
    TRACKBALL_FN_PREVIEW   $fn for the live preview renders (default 48)
    TRACKBALL_FN_FINAL     $fn for downloadable / printable STLs (default 96)
    TRACKBALL_WORKERS      parallel OpenSCAD processes (default min(3, cpu count))
    TRACKBALL_AUTO_RENDER  1 = render previews as you edit, 0 = only on request (default 1)
    TRACKBALL_PRESETS      directory with prebuilt preset bundles (default <OUT>/../presets)
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    out: Path = field(default_factory=lambda: Path(os.environ.get("TRACKBALL_OUT", ROOT / "out" / "web")))
    fn_preview: int = field(default_factory=lambda: _int("TRACKBALL_FN_PREVIEW", 48))
    fn_final: int = field(default_factory=lambda: _int("TRACKBALL_FN_FINAL", 96))
    workers: int = field(default_factory=lambda: _int("TRACKBALL_WORKERS", min(3, os.cpu_count() or 1)))
    auto_render: bool = field(default_factory=lambda: os.environ.get("TRACKBALL_AUTO_RENDER", "1") not in ("0", "false", "no"))
    presets_dir: Path = field(default_factory=lambda: Path(os.environ.get(
        "TRACKBALL_PRESETS", Path(os.environ.get("TRACKBALL_OUT", ROOT / "out" / "web")).parent / "presets")))

    def fn_for(self, quality: str) -> int | None:
        """$fn override for a quality tier; None keeps the value from the request."""
        return {"preview": self.fn_preview, "final": self.fn_final}.get(quality)

    def public(self) -> dict:
        return {"fn_preview": self.fn_preview, "fn_final": self.fn_final, "workers": self.workers,
                "auto_render": self.auto_render}
