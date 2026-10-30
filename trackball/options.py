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
from .i18n import N_, _
from .supports import SUPPORTS

# words the summary translates at runtime (keeps them in the catalog)
_DYNAMIC_WORDS = (N_("front"), N_("left"), N_("right"), N_("sides"), N_("tiles"), N_("behind"), N_("under"))

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
        """UI label, translated."""
        return _(self.label) if self.label else self.name.replace("_", " ")

    @property
    def help_text(self) -> str:
        return _(self.help)

    @property
    def group_title(self) -> str:
        return _(self.group)


OPTIONS: tuple[Option, ...] = (
    # ---- ball & cup
    Option("ball", "float", 34.0, N_("ball diameter"), N_("Ball & cup"), min=20, max=60, step=0.5, unit="mm", label=N_("ball")),
    Option("support", "choice", "btu-7.5", N_("what the ball rolls on"), N_("Ball & cup"), choices=tuple(sorted(SUPPORTS)), label=N_("support")),
    Option("supports", "int", 3, N_("number of ball supports"), N_("Ball & cup"), min=3, max=4, label=N_("supports")),
    Option("polar", "float", 55.0, N_("support angle from the downward axis"), N_("Ball & cup"), min=35, max=70, step=1, unit="°", label=N_("support angle")),
    Option("cup_shape", "choice", "cone", N_("cone: open all around; dome: side lobes, open front/back (Nano style); "
           "block: square with four corner tabs"), N_("Ball & cup"), choices=("cone", "dome", "block"), label=N_("cup shape")),
    Option("cup_cut", "float", 6.0, N_("depth of the openings below the rim (dome / block)"), N_("Ball & cup"), min=0, max=20,
           step=0.5, unit="mm", label=N_("opening depth")),
    Option("cup_round", "float", 2.0, N_("round-over radius of the cup rim edge"), N_("Ball & cup"), min=0, max=4, step=0.5, unit="mm",
           label=N_("rim round-over")),
    Option("ball_gap", "float", 0.8, N_("air between the ball and the cup cavity"), N_("Ball & cup"), min=0.4, max=2.0, step=0.1, unit="mm",
           label=N_("ball clearance")),
    Option("cup_wall", "float", 3.0, N_("wall thickness of the cup dome"), N_("Ball & cup"), min=2, max=5, step=0.5, unit="mm", label=N_("cup wall")),
    Option("rim", "float", 5.0, N_("how far below the ball's equator the cup opening sits (more = ball sits deeper)"),
           N_("Ball & cup"), min=0, max=12, step=0.5, unit="mm", label=N_("rim depth")),
    Option("skirt", "float", 14.0, N_("extra width of the cup skirt around the dome (room for the supports and screws)"),
           N_("Ball & cup"), min=8, max=30, step=1, unit="mm", label=N_("skirt width")),
    Option("sensor_pcb", "choice", "bastardkb", N_("which sensor breakout the carrier is cut for"), N_("Ball & cup"),
           choices=tuple(sorted(SENSOR_PCBS)), label=N_("sensor PCB")),
    Option("header_height", "float", 9.0, N_("how far the sensor connector hangs below the PCB: 9 for the vertical "
           "header, 3 for soldered wires or a right-angle header"), N_("Ball & cup"), min=0, max=15, step=0.5, unit="mm", label=N_("header height")),
    # ---- buttons
    Option("switches", "int", 3, N_("click switches per row (0 = none); with tiles: 2, 4, 6 or 8 tiles in total"),
           N_("Buttons"), min=0, max=8, label=N_("switches")),
    Option("switch_type", "choice", "choc-v1", N_("key switch or microswitch paddle"), N_("Buttons"),
           choices=tuple(sorted(SWITCH_TYPES)), label=N_("switch type")),
    Option("buttons", "choice", "front", N_("where the row goes: front (between you and the ball), left, right, sides; "
           "tiles: large sculpted keys filling the deck around the ball, over microswitches (EM06 style)"),
           N_("Buttons"), choices=tuple(PLACEMENTS), label=N_("placement")),
    Option("tile_gap", "float", 3.5, N_("tiles: visible gap between neighbouring keys"), N_("Buttons"), min=2.5, max=8, step=0.5,
           unit="mm", label=N_("tile gap")),
    Option("tile_frame", "float", 4.0, N_("tiles: solid rim around the lid where the keys hinge"), N_("Buttons"), min=2, max=10,
           step=0.5, unit="mm", label=N_("tile frame")),
    Option("keycap_u", "float", 1.0, N_("keycap size in units (1, 1.25, 1.5, 2)"), N_("Buttons"), min=1, max=3, step=0.25, unit="u", label=N_("keycap size")),
    Option("switch_gap", "float", 0.0, N_("extra space between neighbouring buttons"), N_("Buttons"), min=0, max=10, step=0.5, unit="mm", label=N_("switch gap")),
    Option("no_mirror", "bool", False, N_("front row: do not add the matching strip at the back (ball off-centre)"), N_("Buttons"),
           label=N_("front strip only")),
    # ---- electronics
    Option("mcu", "choice", "pico", N_("controller board"), N_("Electronics"), choices=tuple(sorted(MCUS)), label=N_("controller")),
    Option("mcu_place", "choice", "behind", N_("behind the sensor, or under it (taller tray, smaller body)"), N_("Electronics"),
           choices=("behind", "under"), label=N_("MCU placement")),
    Option("usb", "choice", "right", N_("which wall the USB cable leaves"), N_("Electronics"), choices=("right", "left", "back"), label=N_("USB exit")),
    Option("battery", "str", "", N_("LiPo under the sensor as LxWxT in mm, e.g. 50x34x5 (empty = none)"), N_("Electronics"),
           pattern=BATTERY_RE.pattern, label=N_("battery")),
    # ---- body
    Option("edge_round", "float", 2.0, N_("round-over of the lid and palm-rest top edges"), N_("Body"), min=0, max=4, step=0.5, unit="mm",
           label=N_("edge round-over")),
    Option("padding", "float", 9.0, N_("body = cup skirt + this on every side"), N_("Body"), min=2, max=40, step=0.5, unit="mm", label=N_("padding")),
    Option("wall", "float", 3.0, N_("tray wall thickness"), N_("Body"), min=1.5, max=6, step=0.5, unit="mm", label=N_("wall")),
    Option("floor", "float", 3.0, N_("tray floor thickness"), N_("Body"), min=1.5, max=6, step=0.5, unit="mm", label=N_("floor")),
    Option("feet", "float", 10.0, N_("rubber-foot recess diameter (0 = none)"), N_("Body"), min=0, max=20, step=1, unit="mm", label=N_("feet")),
    Option("fn", "int", 96, N_("OpenSCAD $fn (curve smoothness; lower = faster)"), N_("Body"), min=24, max=200, label=N_("$fn")),
    # ---- deck
    Option("tilt", "float", 0.0, N_("deck tilt; the far edge rises"), N_("Deck"), min=-20, max=25, step=1, unit="°", label=N_("tilt")),
    Option("tent", "float", 0.0, N_("deck tenting; the left (-X) side rises"), N_("Deck"), min=-20, max=20, step=1, unit="°", label=N_("tent")),
    Option("palm", "float", 0.0, N_("separate palm rest of this length in front (0 = none)"), N_("Deck"), min=0, max=100, step=5, unit="mm",
           label=N_("palm rest length")),
    Option("palm_drop", "float", 2.0, N_("how far the palm rest top sits below the deck"), N_("Deck"), min=0, max=15, step=0.5, unit="mm",
           label=N_("palm rest drop")),
    Option("palm_pad", "float", 0.0, N_("depth of the recess on the palm rest for a leather/foam pad (0 = none)"), N_("Deck"),
           min=0, max=6, step=0.5, unit="mm", label=N_("pad recess")),
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
    if out["buttons"] == "tiles":
        out["switch_type"] = "micro"          # tiles are paddles over microswitches by definition
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
                          keycap_u=v["keycap_u"], gap=v["switch_gap"], mirror=not v["no_mirror"],
                          tile_gap=v["tile_gap"], tile_frame=v["tile_frame"]),
        deck=Deck(tilt_deg=v["tilt"], tent_deg=v["tent"], palm_length=v["palm"], palm_drop=v["palm_drop"],
                  palm_round=v["edge_round"], palm_pad_recess=v["palm_pad"]),
        battery=parse_battery(v["battery"]),
        fn=v["fn"],
    )


def autofit(values: dict[str, Any], max_rounds: int = 8) -> tuple[dict[str, Any], list[dict]]:
    """Apply the validator's own suggested fixes (today: raise padding) until the
    design fits or nothing more can be done. Returns (values, changes)."""
    v = coerce(values)
    changes: list[dict] = []
    for _round in range(max_rounds):
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
    if v["switches"] and v["buttons"] == "tiles":
        bits.append(f"{v['switches']}tiles")
    elif v["switches"]:
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
        kw: dict[str, Any] = {"help": o.help_text, "dest": o.name}
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
