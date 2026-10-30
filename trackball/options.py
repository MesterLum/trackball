"""The one place that declares every user-facing design option.

Both the CLI parser (build.py) and the web API schema (web/schemas.py) are
generated from OPTIONS, so names, defaults, ranges and choices cannot drift
apart. Values flow:  dict/args  ->  design_kwargs()  ->  config dataclasses.
"""
from __future__ import annotations

import dataclasses
import re
from dataclasses import dataclass
from typing import Any

from .config import (MCUS, PLACEMENTS, SENSOR_PCBS, SWITCH_TYPES, Ball, Battery, Carrier, Cup, Deck,
                     Design, Switches, Tray)
from .supports import SUPPORTS

BATTERY_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*$")


@dataclass(frozen=True)
class Option:
    name: str                    # python / JSON name
    kind: str                    # float | int | bool | choice | str
    default: Any
    help: str
    group: str
    flag: str | None = None      # CLI flag, defaults to --name-with-dashes
    choices: tuple[str, ...] = ()
    min: float | None = None
    max: float | None = None
    step: float | None = None
    unit: str = ""
    pattern: str | None = None   # for str kinds
    label: str = ""              # UI label, defaults to the name

    @property
    def cli_flag(self) -> str:
        return self.flag or "--" + self.name.replace("_", "-")

    @property
    def title(self) -> str:
        return self.label or self.name.replace("_", " ")


OPTIONS: tuple[Option, ...] = (
    # ---- ball & cup
    Option("ball", "float", 34.0, "ball diameter", "Ball & cup", min=20, max=60, step=0.5, unit="mm"),
    Option("support", "choice", "btu-7.5", "what the ball rolls on", "Ball & cup", choices=tuple(sorted(SUPPORTS))),
    Option("supports", "int", 3, "number of ball supports", "Ball & cup", min=3, max=4),
    Option("polar", "float", 55.0, "support angle from the downward axis", "Ball & cup", min=35, max=70, step=1, unit="°"),
    Option("cup_shape", "choice", "cone", "cone: open all around; dome: side lobes, open front/back (Nano style); "
           "block: square with four corner tabs", "Ball & cup", choices=("cone", "dome", "block")),
    Option("cup_cut", "float", 6.0, "depth of the openings below the rim (dome / block)", "Ball & cup", min=0, max=20,
           step=0.5, unit="mm", label="opening depth"),
    Option("cup_round", "float", 2.0, "round-over radius of the cup rim edge", "Ball & cup", min=0, max=4, step=0.5, unit="mm",
           label="rim round-over"),
    Option("ball_gap", "float", 0.8, "air between the ball and the cup cavity", "Ball & cup", min=0.4, max=2.0, step=0.1, unit="mm",
           label="ball clearance"),
    Option("cup_wall", "float", 3.0, "wall thickness of the cup dome", "Ball & cup", min=2, max=5, step=0.5, unit="mm"),
    Option("rim", "float", 5.0, "how far below the ball's equator the cup opening sits (more = ball sits deeper)",
           "Ball & cup", min=0, max=12, step=0.5, unit="mm", label="rim depth"),
    Option("skirt", "float", 14.0, "extra width of the cup skirt around the dome (room for the supports and screws)",
           "Ball & cup", min=8, max=30, step=1, unit="mm", label="skirt width"),
    Option("sensor_pcb", "choice", "bastardkb", "which sensor breakout the carrier is cut for", "Ball & cup",
           choices=tuple(sorted(SENSOR_PCBS)), label="sensor PCB"),
    Option("header_height", "float", 9.0, "how far the sensor connector hangs below the PCB: 9 for the vertical "
           "header, 3 for soldered wires or a right-angle header", "Ball & cup", min=0, max=15, step=0.5, unit="mm"),
    # ---- buttons
    Option("switches", "int", 3, "click switches per row (0 = none)", "Buttons", min=0, max=6),
    Option("switch_type", "choice", "choc-v1", "key switch or microswitch paddle", "Buttons",
           choices=tuple(sorted(SWITCH_TYPES))),
    Option("buttons", "choice", "front", "where the row goes: front (between you and the ball), left, right, sides",
           "Buttons", choices=tuple(PLACEMENTS), label="placement"),
    Option("keycap_u", "float", 1.0, "keycap size in units (1, 1.25, 1.5, 2)", "Buttons", min=1, max=3, step=0.25, unit="u"),
    Option("switch_gap", "float", 0.0, "extra space between neighbouring buttons", "Buttons", min=0, max=10, step=0.5, unit="mm"),
    Option("no_mirror", "bool", False, "front row: do not add the matching strip at the back (ball off-centre)", "Buttons",
           label="front strip only"),
    # ---- electronics
    Option("mcu", "choice", "pico", "controller board", "Electronics", choices=tuple(sorted(MCUS))),
    Option("mcu_place", "choice", "behind", "behind the sensor, or under it (taller tray, smaller body)", "Electronics",
           choices=("behind", "under"), label="MCU placement"),
    Option("usb", "choice", "right", "which wall the USB cable leaves", "Electronics", choices=("right", "left", "back")),
    Option("battery", "str", "", "LiPo under the sensor as LxWxT in mm, e.g. 50x34x5 (empty = none)", "Electronics",
           pattern=BATTERY_RE.pattern),
    # ---- body
    Option("edge_round", "float", 2.0, "round-over of the lid and palm-rest top edges", "Body", min=0, max=4, step=0.5, unit="mm",
           label="edge round-over"),
    Option("padding", "float", 9.0, "body = cup skirt + this on every side", "Body", min=2, max=40, step=0.5, unit="mm"),
    Option("wall", "float", 3.0, "tray wall thickness", "Body", min=1.5, max=6, step=0.5, unit="mm"),
    Option("floor", "float", 3.0, "tray floor thickness", "Body", min=1.5, max=6, step=0.5, unit="mm"),
    Option("feet", "float", 10.0, "rubber-foot recess diameter (0 = none)", "Body", min=0, max=20, step=1, unit="mm"),
    Option("fn", "int", 96, "OpenSCAD $fn (curve smoothness; lower = faster)", "Body", min=24, max=200, label="$fn"),
    # ---- deck
    Option("tilt", "float", 0.0, "deck tilt; the far edge rises", "Deck", min=-20, max=25, step=1, unit="°"),
    Option("tent", "float", 0.0, "deck tenting; the left (-X) side rises", "Deck", min=-20, max=20, step=1, unit="°"),
    Option("palm", "float", 0.0, "separate palm rest of this length in front (0 = none)", "Deck", min=0, max=100, step=5, unit="mm",
           label="palm rest length"),
    Option("palm_drop", "float", 2.0, "how far the palm rest top sits below the deck", "Deck", min=0, max=15, step=0.5, unit="mm",
           label="palm rest drop"),
    Option("palm_pad", "bool", False, "1 mm recess on the palm rest for a leather/foam pad", "Deck", label="pad recess"),
)
BY_NAME = {o.name: o for o in OPTIONS}
GROUPS = tuple(dict.fromkeys(o.group for o in OPTIONS))


def parse_battery(spec: str | None) -> Battery:
    if not spec or not str(spec).strip():
        return Battery(enabled=False)
    m = BATTERY_RE.match(str(spec))
    if not m:
        raise ValueError(f"battery must be LxWxT in mm, e.g. 50x34x5 (got {spec!r})")
    l, w, t = (float(v) for v in m.groups())
    return Battery(enabled=True, length=l, width=w, thickness=t)


def defaults() -> dict[str, Any]:
    return {o.name: o.default for o in OPTIONS}


def coerce(values: dict[str, Any]) -> dict[str, Any]:
    """Fill defaults and cast strings (from forms / CLI) to the declared kinds.
    Raises ValueError with a readable message on the first bad value."""
    out = defaults()
    for name, v in values.items():
        if name not in BY_NAME or v is None:
            continue
        o = BY_NAME[name]
        try:
            if o.kind == "float":
                v = float(v)
            elif o.kind == "int":
                v = int(float(v))
            elif o.kind == "bool":
                v = v if isinstance(v, bool) else str(v).lower() in ("1", "true", "on", "yes")
            elif o.kind == "choice":
                v = str(v)
                if v not in o.choices:
                    raise ValueError(f"must be one of {', '.join(o.choices)}")
            else:
                v = "" if v is None else str(v)
        except (TypeError, ValueError) as e:
            raise ValueError(f"{name}: {e}") from None
        if o.min is not None and isinstance(v, (int, float)) and v < o.min:
            raise ValueError(f"{name}: must be >= {o.min:g}")
        if o.max is not None and isinstance(v, (int, float)) and v > o.max:
            raise ValueError(f"{name}: must be <= {o.max:g}")
        out[name] = v
    if out["battery"]:
        parse_battery(out["battery"])       # raises if malformed
    return out


def make_design(values: dict[str, Any]) -> Design:
    """Build a Design from option values (already coerced or raw)."""
    v = coerce(values)
    return Design(
        ball=Ball(diameter=v["ball"]),
        cup=Cup(support=dataclasses.replace(SUPPORTS[v["support"]]), support_count=v["supports"],
                support_polar_deg=v["polar"], gap=v["ball_gap"], wall=v["cup_wall"],
                rim_below_center=v["rim"], skirt_extra=v["skirt"], shape=v["cup_shape"], cut=v["cup_cut"],
                round=v["cup_round"]),
        pcb=dataclasses.replace(SENSOR_PCBS[v["sensor_pcb"]], header_height=v["header_height"]),
        carrier=Carrier(padding=v["padding"], edge_round=v["edge_round"]),
        tray=Tray(mcu=MCUS[v["mcu"]], mcu_place=v["mcu_place"],
                  usb_exit="back" if v["usb"] == "back" else "side",
                  usb_side=-1 if v["usb"] == "left" else 1,
                  wall=v["wall"], floor=v["floor"], feet_dia=v["feet"]),
        switches=Switches(type=SWITCH_TYPES[v["switch_type"]], count=v["switches"], placement=v["buttons"],
                          keycap_u=v["keycap_u"], gap=v["switch_gap"], mirror=not v["no_mirror"]),
        deck=Deck(tilt_deg=v["tilt"], tent_deg=v["tent"], palm_length=v["palm"], palm_drop=v["palm_drop"],
                  palm_round=v["edge_round"], palm_pad_recess=1.0 if v["palm_pad"] else 0.0),
        battery=parse_battery(v["battery"]),
        fn=v["fn"],
    )


def autofit(values: dict[str, Any], max_rounds: int = 8) -> tuple[dict[str, Any], list[dict]]:
    """Apply the validator's own suggested fixes (today: raise padding) until the
    design fits or nothing more can be done. Returns (values, changes)."""
    v = coerce(values)
    changes: list[dict] = []
    for _ in range(max_rounds):
        probs = make_design(v).problems()
        fixes: dict[str, float] = {}
        for pr in probs:
            for opt, val in pr["fix"].items():
                # the most restrictive suggestion wins: highest when raising, lowest when lowering
                cur = v[opt]
                prev = fixes.get(opt)
                if prev is None:
                    fixes[opt] = val
                else:
                    fixes[opt] = max(prev, val) if val > cur else min(prev, val)
        if not fixes:
            break
        for opt, val in fixes.items():
            o = BY_NAME[opt]
            if o.max is not None:
                val = min(val, o.max)
            if o.min is not None:
                val = max(val, o.min)
            if val == v[opt]:
                return v, changes          # cannot improve further (at a limit)
            changes.append({"option": opt, "from": v[opt], "to": val,
                            "reason": "; ".join(pr["message"].split(":")[0] for pr in probs if opt in pr["fix"])})
            v[opt] = val
    return v, changes


def to_argv(values: dict[str, Any]) -> list[str]:
    """CLI arguments that reproduce these values (non-defaults only)."""
    v = coerce(values)
    argv: list[str] = []
    for o in OPTIONS:
        val = v[o.name]
        if val == o.default or (o.kind == "str" and not val):
            continue
        if o.kind == "bool":
            argv.append(o.cli_flag)
        else:
            argv += [o.cli_flag, f"{val:g}" if isinstance(val, float) else str(val)]
    return argv


def variant_name(values: dict[str, Any]) -> str:
    """Short, file-system friendly name describing the non-default choices."""
    v = coerce(values)
    bits = [f"ball{v['ball']:g}", v["support"], v["mcu"]]
    if v["cup_shape"] != "cone":
        bits.append(v["cup_shape"])
    if v["sensor_pcb"] != "bastardkb":
        bits.append(v["sensor_pcb"])
    if v["padding"] != BY_NAME["padding"].default:
        bits.append(f"pad{v['padding']:g}")
    if v["mcu_place"] == "under":
        bits.append("under")
    if v["usb"] != "right":
        bits.append(f"usb{v['usb']}")
    if v["header_height"] != BY_NAME["header_height"].default:
        bits.append(f"hdr{v['header_height']:g}")
    if v["switches"]:
        u = f"{v['keycap_u']:g}u" if v["keycap_u"] != 1 else ""
        g = f"gap{v['switch_gap']:g}" if v["switch_gap"] else ""
        bits.append(f"{v['switches']}{v['switch_type']}{u}{g}-{v['buttons']}" + ("-nomirror" if v["no_mirror"] else ""))
    if v["tilt"] or v["tent"]:
        bits.append(f"tilt{v['tilt']:g}" + (f"tent{v['tent']:g}" if v["tent"] else ""))
    if v["palm"]:
        bits.append(f"palm{v['palm']:g}")
    if v["battery"]:
        bits.append("bat" + v["battery"].lower().replace(" ", ""))
    return "_".join(bits)


def add_to_parser(p) -> None:
    """Register every option on an argparse parser."""
    for o in OPTIONS:
        kw: dict[str, Any] = {"help": o.help, "dest": o.name}
        if o.kind == "bool":
            p.add_argument(o.cli_flag, action="store_true", **kw)
            continue
        if o.kind == "choice":
            kw["choices"] = o.choices
        elif o.kind == "float":
            kw["type"] = float
        elif o.kind == "int":
            kw["type"] = int
        if o.unit:
            kw["metavar"] = o.unit.upper() if o.unit.isalpha() else "N"
        if o.kind == "str":
            kw["metavar"] = "LxWxT"
        p.add_argument(o.cli_flag, default=o.default, **kw)
