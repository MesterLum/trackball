"""HTML pages."""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from jinja2 import Environment, FileSystemLoader, select_autoescape

from trackball.i18n import LANGUAGES, N_, _, get_language, ngettext, normalize
from web.i18n import COOKIE
from web.routers.api import preset_entries
from web.schemas import options_response

router = APIRouter(tags=["pages"])
_env = Environment(loader=FileSystemLoader(str(Path(__file__).resolve().parent.parent / "templates")),
                   extensions=["jinja2.ext.i18n"], autoescape=select_autoescape(["html"]))
_env.install_gettext_callables(gettext=_, ngettext=ngettext, newstyle=True)  # type: ignore[attr-defined]
templates = Jinja2Templates(env=_env)

# Strings the Alpine.js code shows at runtime (app.js uses t('...') with these exact keys).
JS_STRINGS = [
    N_("rendering"), N_("fits"), N_("does not fit"), N_("queued"), N_("failed"), N_("Loaded"), N_("Load"),
    N_("Download STLs"), N_("Rendering {done}/{total}…"), N_("Server unreachable"), N_("Server error {status}"),
    N_("Could not prepare the final design"), N_("Final render failed"), N_("Link copied"), N_("Command copied"),
    N_("Loaded \"{title}\""), N_("toggle {part}"), N_("ball"), N_("full quality ($fn {fn}), rendered on request"),
    N_("behind"), N_("under"), N_("{place} the sensor"), N_(", battery {battery}"),
]


def js_strings() -> dict[str, str]:
    return {s: _(s) for s in JS_STRINGS}


@router.get("/", response_class=HTMLResponse, include_in_schema=False)
def index(request: Request):
    lang = get_language()
    boot = {"options": options_response().model_dump(), "presets": preset_entries(request.app),
            "settings": request.app.state.settings.public(), "lang": lang, "i18n": js_strings()}
    # "</" would end the <script> block early
    response = templates.TemplateResponse(request, "index.html", {
        "boot": json.dumps(boot, ensure_ascii=False).replace("</", "<\\/"),
        "lang": lang, "languages": LANGUAGES})
    if normalize(request.query_params.get(COOKIE)):
        response.set_cookie(COOKIE, lang, max_age=365 * 24 * 3600, samesite="lax")
    return response
