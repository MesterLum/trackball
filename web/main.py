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


def create_app(out_dir: Path | None = None) -> FastAPI:
    out = out_dir or Path(os.environ.get("TRACKBALL_OUT", ROOT / "out" / "web"))
    out.mkdir(parents=True, exist_ok=True)
    static_dir = Path(__file__).resolve().parent / "static"

    app = FastAPI(title="Trackball module configurator", version="0.3.0",
                  description="Parametric trackball module around the Bastardkb PMW3360 PCB. "
                              "Validate a configuration, render the printable parts, download STLs.")
    app.state.designs = DesignService(out)
    app.state.render = RenderQueue(out)
    app.state.static_dir = static_dir
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
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
        return {"ok": True, "out": str(out), "queue": app.state.render.pending}

    return app


app = create_app()
