"""Development-only browser refresh; Uvicorn handles Python process reloads."""
from __future__ import annotations

import hashlib
import time
from pathlib import Path

from fastapi import FastAPI, Request

SOURCE_SUFFIXES = {'.py', '.html', '.js', '.css', '.po'}


def source_revision(root: Path) -> str:
    digest = hashlib.sha256()
    paths = [p for folder in ('trackball', 'web') for p in (root / folder).rglob('*')
             if p.is_file() and p.suffix in SOURCE_SUFFIXES]
    for path in sorted(paths):
        stat = path.stat()
        digest.update(f'{path.relative_to(root)}:{stat.st_mtime_ns}:{stat.st_size}'.encode())
    return digest.hexdigest()


def install_dev_reload(app: FastAPI, root: Path) -> None:
    instance = str(time.time_ns())

    @app.middleware('http')
    async def disable_browser_cache(request: Request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/__dev__/revision', include_in_schema=False)
    def revision():
        return {'revision': instance + ':' + source_revision(root)}
