"""FastAPI application.

    uv run uvicorn web.main:app --reload     # http://127.0.0.1:8000 (docs at /docs)
    docker compose up --build                # http://localhost:8321
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from web.routers import api, pages  # noqa: E402
from web.services.designs import DesignService  # noqa: E402
from web.services.render import RenderQueue  # noqa: E402
from web.settings import Settings  # noqa: E402


def create_app(out_dir: Path | None = None, settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    if out_dir is not None:
        import dataclasses
        settings = dataclasses.replace(settings, out=out_dir, presets_dir=out_dir.parent / "presets")
    out = settings.out
    out.mkdir(parents=True, exist_ok=True)
    static_dir = Path(__file__).resolve().parent / "static"

    app = FastAPI(title="Trackball module configurator", version="0.3.0",
                  description="Parametric, printable trackball module (PMW3360 / PMW3389 sensor boards). "
                              "Validate a configuration, render the printable parts, download STLs.")
    app.state.settings = settings
    app.state.designs = DesignService(out, {"preview": settings.fn_preview, "final": settings.fn_final})
    app.state.render = RenderQueue(out, workers=settings.workers)
    app.state.static_dir = static_dir
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    if settings.presets_dir.exists():
        app.mount("/presets", StaticFiles(directory=str(settings.presets_dir), html=True), name="presets")
    app.include_router(api.router)
    app.include_router(pages.router)

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(request: Request, exc: RequestValidationError):
        """422 with a per-field map in addition to FastAPI's detail list."""
        fields: dict[str, str] = {}
        for err in exc.errors():
            loc = [str(x) for x in err.get("loc", []) if x != "body"]
            fields[loc[-1] if loc else "_"] = err.get("msg", "invalid")
        return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors()), "fields": fields})

    @app.get("/health", include_in_schema=False)
    def health():
        return {"ok": True, "out": str(out), "queue": app.state.render.pending, **settings.public()}

    return app


app = create_app()
