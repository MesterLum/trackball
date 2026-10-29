"""Pydantic models for the API. The request model is generated from the
option registry so the web form, the CLI and the validator agree."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, create_model, field_validator

from trackball.options import BATTERY_RE, GROUPS, OPTIONS, Option


def _field(o: Option):
    desc = o.help
    if o.kind == "float":
        return float, Field(o.default, ge=o.min, le=o.max, description=desc)
    if o.kind == "int":
        return int, Field(o.default, ge=o.min, le=o.max, description=desc)
    if o.kind == "bool":
        return bool, Field(o.default, description=desc)
    if o.kind == "choice":
        return Literal[o.choices], Field(o.default, description=desc)  # type: ignore[valid-type]
    return str, Field(o.default, description=desc, max_length=40)


def _battery_ok(cls, v: str) -> str:
    v = (v or "").strip()
    if v and not BATTERY_RE.match(v):
        raise ValueError("battery must be LxWxT in mm, e.g. 50x34x5")
    return v


DesignRequest = create_model(
    "DesignRequest",
    __config__=ConfigDict(extra="forbid"),
    __validators__={"battery_ok": field_validator("battery")(_battery_ok)},
    **{o.name: _field(o) for o in OPTIONS},
)
DesignRequest.__doc__ = "Every design option. Omitted fields take their defaults."


class OptionSchema(BaseModel):
    name: str
    label: str
    kind: str
    default: Any
    help: str
    choices: list[str] = []
    min: float | None = None
    max: float | None = None
    step: float | None = None
    unit: str = ""
    flag: str


class OptionGroup(BaseModel):
    name: str
    options: list[OptionSchema]


class OptionsResponse(BaseModel):
    groups: list[OptionGroup]


class PresetSchema(BaseModel):
    key: str
    title: str
    blurb: str
    tags: list[str]
    values: dict[str, Any]
    thumb: str | None = None
    bundle: str | None = None       # prebuilt zip with STLs, photos and BOM, when available


class BomItem(BaseModel):
    item: str
    qty: int
    note: str = ""


class DesignResponse(BaseModel):
    id: str
    variant: str
    summary: str
    problems: list[str]
    fits: bool
    cmd: str
    tilt: float
    tent: float
    ball_r: float
    floor_z: float
    footprint: tuple[float, float]
    height: float
    values: dict[str, Any]
    fn: int
    bom: list[BomItem]


class SettingsResponse(BaseModel):
    fn_preview: int
    fn_final: int
    workers: int
    auto_render: bool


class PartStatus(BaseModel):
    name: str
    state: Literal["queued", "rendering", "done", "error", "cancelled"]
    url: str | None = None
    color: str
    frame: Literal["deck", "world"]
    lift: float
    seconds: float | None = None
    cached: bool = False
    error: str | None = None


class RenderStatus(BaseModel):
    id: str
    parts: list[PartStatus]
    done: bool
    ok: bool


def options_response() -> OptionsResponse:
    groups = []
    for g in GROUPS:
        opts = [OptionSchema(name=o.name, label=o.title, kind=o.kind, default=o.default, help=o.help,
                             choices=list(o.choices), min=o.min, max=o.max, step=o.step, unit=o.unit,
                             flag=o.cli_flag) for o in OPTIONS if o.group == g]
        groups.append(OptionGroup(name=g, options=opts))
    return OptionsResponse(groups=groups)
