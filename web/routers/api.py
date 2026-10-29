"""JSON API."""
from __future__ import annotations

import asyncio
import io
import json
import zipfile
from pathlib import Path

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from trackball.presets import PRESETS
from web.schemas import (DesignRequest, DesignResponse, OptionsResponse, PresetSchema, RenderStatus,
                         SettingsResponse, options_response)

router = APIRouter(prefix="/api", tags=["design"])


def _svc(request: Request):
    return request.app.state.designs, request.app.state.render


@router.get("/options", response_model=OptionsResponse, summary="Every option with ranges and choices")
def get_options():
    return options_response()


@router.get("/settings", response_model=SettingsResponse, summary="Render quality tiers and worker count")
def get_settings(request: Request):
    return request.app.state.settings.public()


def preset_entries(app) -> list[dict]:
    static = Path(app.state.static_dir) / "presets"
    bundles = Path(app.state.settings.presets_dir)
    out = []
    for p in PRESETS:
        out.append({"key": p.key, "title": p.title, "blurb": p.blurb, "tags": list(p.tags), "values": p.values,
                    "thumb": f"/static/presets/{p.key}.jpg" if (static / f"{p.key}.jpg").exists() else None,
                    "bundle": f"/presets/{p.key}/{p.key}.zip" if (bundles / p.key / f"{p.key}.zip").exists() else None})
    return out


@router.get("/presets", response_model=list[PresetSchema], summary="Proposed configurations")
def get_presets(request: Request):
    return preset_entries(request.app)


@router.post("/design", response_model=DesignResponse,
             summary="Validate a configuration and prepare its SCAD files (instant)")
def post_design(body: DesignRequest, request: Request,  # type: ignore[valid-type]
                quality: Literal["preview", "final", "custom"] = Query(
                    "custom", description="preview/final override $fn with the server's tiers; custom keeps the request's fn")):
    designs, _ = _svc(request)
    try:
        res = designs.prepare(body.model_dump(), quality=quality)
    except ValueError as e:
        # options.coerce reports "name: message"
        name, _, msg = str(e).partition(": ")
        field = name if name in body.model_fields else "battery" if "battery" in str(e) else "_"
        return JSONResponse(status_code=422, content={"detail": str(e), "fields": {field: msg or str(e)}})
    return res.payload()


@router.post("/design/{did}/render", response_model=RenderStatus, summary="Queue the printable parts")
def post_render(did: str, request: Request,
                supersedes: str | None = Query(None, description="design id whose pending renders should be cancelled")):
    designs, rq = _svc(request)
    names = designs.part_names(did)
    if not names:
        raise HTTPException(404, "unknown design, or it does not fit (nothing to render)")
    if supersedes and supersedes != did:
        rq.cancel(supersedes)
    return rq.submit(did, names)


@router.delete("/design/{did}/render", summary="Cancel pending renders of a design")
def delete_render(did: str, request: Request):
    _, rq = _svc(request)
    return {"cancelled": rq.cancel(did)}


@router.get("/design/{did}/status", response_model=RenderStatus)
def get_status(did: str, request: Request):
    _, rq = _svc(request)
    st = rq.status(did)
    if not st["parts"]:
        raise HTTPException(404, "no render queued for this design")
    return st


@router.get("/design/{did}/events", summary="Server-sent events with per-part progress")
async def get_events(did: str, request: Request):
    _, rq = _svc(request)

    async def stream():
        last = None
        for _ in range(2400):                       # 20 minutes max
            if await request.is_disconnected():
                return
            st = rq.status(did)
            if st != last:
                yield f"data: {json.dumps(st)}\n\n"
                last = st
            if st["done"]:
                yield "event: end\ndata: {}\n\n"
                return
            await asyncio.sleep(0.5)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/design/{did}/file/{name}", summary="One generated file (stl, scad)")
def get_file(did: str, name: str, request: Request):
    designs, _ = _svc(request)
    p = designs.out / did / name
    if ".." in name or "/" in name or not p.exists():
        raise HTTPException(404)
    media = "model/stl" if name.endswith(".stl") else "text/plain"
    return FileResponse(p, media_type=media)


def _zip(paths: list[Path], extra: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p in paths:
            z.write(p, p.name)
        for n, text in extra.items():
            z.writestr(n, text)
    return buf.getvalue()


def _bundle(request: Request, did: str, suffix: str):
    designs, _ = _svc(request)
    res = designs.load(did)
    if res is None:
        raise HTTPException(404)
    paths = sorted(res.dir.glob(f"*{suffix}"))
    if not paths:
        raise HTTPException(404, f"no {suffix} files yet")
    data = _zip(paths, {"command.txt": res.payload()["cmd"] + "\n", "design.json": (res.dir / "design.json").read_text()})
    return StreamingResponse(io.BytesIO(data), media_type="application/zip",
                             headers={"Content-Disposition": f'attachment; filename="{did}{suffix}.zip"'})


@router.get("/design/{did}/stl.zip", summary="All printable STLs")
def get_stl_zip(did: str, request: Request):
    return _bundle(request, did, ".stl")


@router.get("/design/{did}/scad.zip", summary="All SCAD sources")
def get_scad_zip(did: str, request: Request):
    return _bundle(request, did, ".scad")
