"""HTML pages."""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from web.routers.api import preset_entries
from web.schemas import options_response

router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent.parent / "templates"))


@router.get("/", response_class=HTMLResponse, include_in_schema=False)
def index(request: Request):
    boot = {"options": options_response().model_dump(), "presets": preset_entries(request.app),
            "settings": request.app.state.settings.public()}
    # "</" would end the <script> block early
    return templates.TemplateResponse(request, "index.html", {"boot": json.dumps(boot).replace("</", "<\\/")})
