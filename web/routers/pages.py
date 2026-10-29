"""HTML pages."""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from trackball.presets import PRESETS
from web.schemas import options_response

router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent.parent / "templates"))


@router.get("/", response_class=HTMLResponse, include_in_schema=False)
def index(request: Request):
    static = Path(request.app.state.static_dir) / "presets"
    presets = [{"key": p.key, "title": p.title, "blurb": p.blurb, "tags": list(p.tags), "values": p.values,
                "thumb": f"/static/presets/{p.key}.jpg" if (static / f"{p.key}.jpg").exists() else None}
               for p in PRESETS]
    boot = {"options": options_response().model_dump(), "presets": presets}
    # "</" would end the <script> block early
    return templates.TemplateResponse(request, "index.html", {"boot": json.dumps(boot).replace("</", "<\\/")})
