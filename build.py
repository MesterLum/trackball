#!/usr/bin/env python
"""Generate OpenSCAD files (and optionally STLs / PNGs) for the trackball module.

    uv run build.py                      # default: 34 mm ball, 7.5 mm BTUs, Pico, 2 Choc switches
    uv run build.py --mcu rp2040-zero --support ceramic-3 --ball 25
    uv run build.py --switches 2 --buttons sides
    uv run build.py --switch-type micro  # flexure paddles over Omron D2F microswitches
    uv run build.py --tilt 10 --palm 40 --battery 50x34x5 --mcu nice-nano
    uv run build.py --padding 10         # bigger body (the validator says when you need it)
    uv run build.py --mcu rp2040-zero --mcu-place under --switches 0   # smallest body
    uv run build.py --keycap-u 1.5 --switches 2 --no-mirror --usb back
    uv run build.py --stl                # also render STLs with openscad
    uv run build.py --png                # render photos of every part + placement views
    uv run build.py --open               # generate, then open the assembly in OpenSCAD
    uv run build.py --open png           # render the photos and open the contact sheet
    uv run build.py --explode 15 --open section   # exploded half-section
    uv run build.py --list               # show available options
"""
from __future__ import annotations

import argparse
import dataclasses
import os
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from trackball.assembly import (assembly, carrier_placement, cup_placement, section,
                                tray_placement)
from trackball.carrier import carrier
from trackball.config import (MCUS, PLACEMENTS, SENSOR_PCBS, SWITCH_TYPES, Ball, Battery,
                              Carrier, Cup, Deck, Design, SensorPCB, Switches, Tray)
from trackball.cup import cup
from trackball.palmrest import palmrest
from trackball.supports import SUPPORTS
from trackball.tray import tray

OUT = Path(__file__).parent / "out"

# name -> (caption, list of (view name, rot_x, rot_y, rot_z))
VIEWS: dict[str, tuple[str, list[tuple[str, float, float, float]]]] = {
    "assembly": ("Everything together", [("iso", 55, 0, 25), ("top", 0, 0, 0), ("front", 90, 0, 0),
                                         ("side (you sit at the left)", 90, 0, 90)]),
    "section": ("Cut at X=0: sensor stack, BTU seats, Pico under the lid", [("iso", 65, 0, 120)]),
    "cup": ("Print: ball cup", [("top", 55, 0, 25), ("bottom", 235, 0, 25)]),
    "cup_placement": ("Cup with ball and supports seated", [("top", 55, 0, 25), ("bottom", 235, 0, 25)]),
    "carrier": ("Print: lid / sensor carrier", [("top", 55, 0, 25), ("bottom", 235, 0, 25)]),
    "carrier_placement": ("Lid with the sensor PCB under it and the switches in place",
                          [("top", 55, 0, 25), ("bottom", 235, 0, 25)]),
    "tray": ("Print: base tray", [("top", 55, 0, 25), ("bottom", 235, 0, 25)]),
    "tray_placement": ("Tray with the MCU on its standoffs", [("top", 55, 0, 25), ("usb-side", 60, 0, 60)]),
    "palmrest": ("Print: separate palm rest (only with --palm)", [("top", 55, 0, 25)]),
}


def parse_battery(spec: str | None) -> Battery:
    if not spec:
        return Battery(enabled=False)
    try:
        l, w, t = (float(v) for v in spec.lower().split("x"))
    except ValueError:
        raise SystemExit(f"--battery expects LxWxT in mm, e.g. 50x34x5 (got {spec!r})")
    return Battery(enabled=True, length=l, width=w, thickness=t)


def make_design(args) -> Design:
    support = dataclasses.replace(SUPPORTS[args.support])
    return Design(
        ball=Ball(diameter=args.ball),
        cup=Cup(support=support, support_count=args.supports, support_polar_deg=args.polar),
        carrier=Carrier(padding=args.padding),
        pcb=dataclasses.replace(SENSOR_PCBS[args.sensor_pcb], header_height=args.header_height),
        tray=Tray(mcu=MCUS[args.mcu], mcu_place=args.mcu_place,
                  usb_exit="back" if args.usb == "back" else "side",
                  usb_side=-1 if args.usb == "left" else 1,
                  wall=args.wall, floor=args.floor, feet_dia=args.feet),
        switches=Switches(type=SWITCH_TYPES[args.switch_type], count=args.switches, placement=args.buttons,
                          keycap_u=args.keycap_u, gap=args.switch_gap, mirror=not args.no_mirror),
        deck=Deck(tilt_deg=args.tilt, tent_deg=args.tent, palm_length=args.palm,
                  palm_pad_recess=1.0 if args.palm_pad else 0.0),
        battery=parse_battery(args.battery),
        fn=args.fn,
    )


def variant_name(args) -> str:
    bits = [f"ball{args.ball:g}", args.support, args.mcu]
    if args.sensor_pcb != "bastardkb":
        bits.append(args.sensor_pcb)
    if args.padding != 9.0:
        bits.append(f"pad{args.padding:g}")
    if args.mcu_place == "under":
        bits.append("under")
    if args.usb != "right":
        bits.append(f"usb{args.usb}")
    if args.header_height != 9.0:
        bits.append(f"hdr{args.header_height:g}")
    if args.switches:
        u = f"{args.keycap_u:g}u" if args.keycap_u != 1 else ""
        g = f"gap{args.switch_gap:g}" if args.switch_gap else ""
        bits.append(f"{args.switches}{args.switch_type}{u}{g}-{args.buttons}" + ("-nomirror" if args.no_mirror else ""))
    if args.tilt or args.tent:
        bits.append(f"tilt{args.tilt:g}" + (f"tent{args.tent:g}" if args.tent else ""))
    if args.palm:
        bits.append(f"palm{args.palm:g}")
    if args.battery:
        bits.append("bat" + args.battery.lower())
    return "_".join(bits)


def find_openscad() -> str:
    """Path to the openscad executable (the GUI binary, not `open -a`)."""
    exe = shutil.which("openscad")
    if exe:
        return exe
    if sys.platform == "darwin":
        # Homebrew casks install as e.g. /Applications/OpenSCAD-2021.01.app
        apps = sorted(Path("/Applications").glob("OpenSCAD*.app"))
        if apps:
            return str(apps[-1] / "Contents" / "MacOS" / "OpenSCAD")
    return "openscad"


def render_stl(scad: Path, stl: Path) -> bool:
    cmd = [find_openscad(), "-o", str(stl), str(scad)]
    print("  ", " ".join(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        return False
    return True


def camera_for(d: Design) -> tuple[tuple[float, float, float], float]:
    """Look-at point and distance that frame the whole module. (--viewall is
    unreliable here: it also frames the hidden helper boxes of intersections.)"""
    w, l, cx, cy = d.footprint
    l += d.deck.palm_length
    cy -= d.deck.palm_length / 2
    h = d.ball.r - d.z_floor_bottom
    center = (cx, cy, (d.ball.r + d.z_floor_bottom) / 2)
    return center, 2.6 * max(w, l, h) + 30


def render_png(scad: Path, png: Path, rot: tuple[float, float, float], size=(1200, 900),
               camera: tuple[tuple[float, float, float], float] | None = None) -> bool:
    rx, ry, rz = rot
    if camera is None:
        cam = [f"--camera=0,0,0,{rx},{ry},{rz},0", "--viewall", "--autocenter"]
    else:
        (tx, ty, tz), dist = camera
        cam = [f"--camera={tx},{ty},{tz},{rx},{ry},{rz},{dist}"]
    cmd = [find_openscad(), "-o", str(png), f"--imgsize={size[0]},{size[1]}", *cam,
           "--colorscheme=Tomorrow", str(scad)]
    # headless Linux (CI, Docker): OpenSCAD needs a display for PNG export
    if sys.platform.startswith("linux") and not os.environ.get("DISPLAY") and shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a", *cmd]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
    return r.returncode == 0


def render_all_png(out: Path, d: Design) -> Path:
    png_dir = out / "png"
    png_dir.mkdir(exist_ok=True)
    cam = camera_for(d)
    jobs = []
    for name, (_, views) in VIEWS.items():
        if not (out / f"{name}.scad").exists():
            continue
        for view, rx, ry, rz in views:
            # whole-module views get the fixed camera; single parts are auto-framed
            c = cam if name in ("assembly", "section") else None
            jobs.append((out / f"{name}.scad", png_dir / f"{name}_{view.split()[0]}.png", (rx, ry, rz), c))
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda j: render_png(j[0], j[1], j[2], camera=j[3]), jobs))
    for (_, png, _, _), ok in zip(jobs, results):
        print("  ", "ok    " if ok else "FAILED", png.name)

    rows = []
    for name, (caption, views) in VIEWS.items():
        if not (out / f"{name}.scad").exists():
            continue
        imgs = "".join(
            f'<figure><img src="{name}_{v.split()[0]}.png" loading="lazy"><figcaption>{v}</figcaption></figure>'
            for v, *_ in views)
        rows.append(f"<section><h2>{name}</h2><p>{caption}</p><div class=row>{imgs}</div></section>")
    html = f"""<!doctype html><meta charset=utf-8><title>Trackball module: {out.name}</title>
<style>
body{{font:15px/1.4 system-ui;margin:24px;max-width:1400px;background:#fafafa;color:#222}}
pre{{background:#eee;padding:12px;border-radius:6px;white-space:pre-wrap}}
.row{{display:flex;flex-wrap:wrap;gap:12px}} figure{{margin:0}}
img{{width:440px;max-width:100%;border:1px solid #ddd;border-radius:6px;background:#fff}}
figcaption{{text-align:center;color:#666;font-size:13px}} h2{{margin:28px 0 4px}} p{{margin:0 0 8px;color:#444}}
</style>
<h1>Trackball module: {out.name}</h1>
<pre>{d.summary()}</pre>
<p>Printed parts are <b>cup</b>, <b>carrier</b> and <b>tray</b>. The <i>placement</i> views add the
non-printed parts (ball, sensor PCB with lens and header, MCU, BTUs, switches) so you can see where
everything sits.</p>
{''.join(rows)}
"""
    index = png_dir / "index.html"
    index.write_text(html)
    return index


def open_in_openscad(path: Path) -> None:
    """Launch the OpenSCAD GUI on a file, detached from this process.

    Calling the binary with the file as argument opens it directly; on macOS
    `open -a OpenSCAD file` only brings up the app without loading the file.
    """
    subprocess.Popen([find_openscad(), str(path.resolve())],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     start_new_session=True)
    print("opened", path, "in OpenSCAD (press F5 to preview)")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ball", type=float, default=34.0, help="ball diameter in mm")
    p.add_argument("--support", choices=sorted(SUPPORTS), default="btu-7.5")
    p.add_argument("--supports", type=int, default=3, help="number of ball supports")
    p.add_argument("--polar", type=float, default=55.0, help="support angle from the downward axis, degrees")
    p.add_argument("--mcu", choices=sorted(MCUS), default="pico")
    p.add_argument("--switches", type=int, default=3, help="number of click switches per row (0 = none)")
    p.add_argument("--switch-type", choices=sorted(SWITCH_TYPES), default="choc-v1")
    p.add_argument("--buttons", choices=PLACEMENTS, default="front",
                   help="where the button row goes: front (between you and the ball), left, right, sides")
    p.add_argument("--keycap-u", type=float, default=1.0, metavar="U", help="keycap size in units: 1, 1.25, 1.5, 2")
    p.add_argument("--switch-gap", type=float, default=0.0, metavar="MM", help="extra space between neighbouring buttons")
    p.add_argument("--sensor-pcb", choices=sorted(SENSOR_PCBS), default="bastardkb",
                   help="which sensor breakout the carrier is cut for")
    p.add_argument("--no-mirror", action="store_true",
                   help="front buttons: do not add the matching strip at the back (ball ends up off-centre)")
    p.add_argument("--mcu-place", choices=("behind", "under"), default="behind",
                   help="behind the sensor (default) or under it (tray gets taller, body stays ball + padding)")
    p.add_argument("--usb", choices=("right", "left", "back"), default="right", help="which wall the USB exits")
    p.add_argument("--header-height", type=float, default=9.0, metavar="MM",
                   help="how far the sensor PCB's connector hangs below it: 9 for the vertical header, "
                        "3 if you solder wires / use a right-angle header (lowers the whole module)")
    p.add_argument("--wall", type=float, default=3.0, metavar="MM", help="tray wall thickness")
    p.add_argument("--floor", type=float, default=3.0, metavar="MM", help="tray floor thickness")
    p.add_argument("--feet", type=float, default=10.0, metavar="DIA", help="rubber-foot recess diameter (0 = none)")
    p.add_argument("--palm-pad", action="store_true", help="1 mm recess on the palm rest for a leather/foam pad")
    p.add_argument("--tilt", type=float, default=0.0, help="deck tilt in degrees; the back (far edge) rises")
    p.add_argument("--tent", type=float, default=0.0, help="deck tenting in degrees; the -X side rises")
    p.add_argument("--padding", type=float, default=9.0, metavar="MM",
                   help="body = cup skirt + this on every side (default 9). The validator tells you when to raise it")
    p.add_argument("--palm", type=float, default=0.0, metavar="MM",
                   help="print a separate palm rest of this length for the front of the body")
    p.add_argument("--force", action="store_true", help="generate even if the validator reports problems")
    p.add_argument("--battery", metavar="LxWxT", help="LiPo under the sensor, e.g. 50x34x5; tray grows by T+1")
    p.add_argument("--fn", type=int, default=96, help="OpenSCAD $fn")
    p.add_argument("--explode", type=float, default=0.0, help="exploded view distance for assembly")
    p.add_argument("--stl", action="store_true", help="render STLs with openscad (slow on 2021.01)")
    p.add_argument("--png", action="store_true", help="render PNG photos of every part and placement view")
    p.add_argument("--open", nargs="?", const="assembly",
                   choices=sorted(VIEWS) + ["png"],
                   help="launch OpenSCAD on this view after generating (default: assembly); "
                        "'png' renders the photos and opens the contact sheet instead")
    p.add_argument("--list", action="store_true")
    return p


def main() -> int:
    args = build_parser().parse_args()

    if args.list:
        print("supports     :", ", ".join(sorted(SUPPORTS)))
        print("mcus         :", ", ".join(sorted(MCUS)))
        print("switch types :", ", ".join(sorted(SWITCH_TYPES)))
        print("views        :", ", ".join(VIEWS))
        return 0

    d = make_design(args)
    print(d.summary())
    problems = d.validate()
    for msg in problems:
        print("PROBLEM:", msg, file=sys.stderr)
    if problems and not args.force:
        print("nothing generated (use --force to override)", file=sys.stderr)
        return 2

    out = OUT / variant_name(args)
    out.mkdir(parents=True, exist_ok=True)
    parts = {
        "cup": cup(d),
        "carrier": carrier(d),
        "tray": tray(d),
        "assembly": assembly(d, args.explode),
        "section": section(d, args.explode),
        "cup_placement": cup_placement(d),
        "carrier_placement": carrier_placement(d),
        "tray_placement": tray_placement(d),
    }
    if d.deck.palm_length > 0:
        parts["palmrest"] = palmrest(d)
    for name, obj in parts.items():
        path = out / f"{name}.scad"
        obj.save_as_scad(str(path))
        print("wrote", path.relative_to(Path.cwd()) if path.is_relative_to(Path.cwd()) else path)

    if args.stl:
        for name in ("cup", "carrier", "tray"):
            ok = render_stl(out / f"{name}.scad", out / f"{name}.stl")
            print("  ->", "ok" if ok else "FAILED", out / f"{name}.stl")

    index = None
    if args.png or args.open == "png":
        print("rendering photos ...")
        index = render_all_png(out, d)
        print("photos:", index)

    if args.open == "png":
        if index is not None:
            if sys.platform == "darwin":
                subprocess.Popen(["open", str(index)])
            else:
                import webbrowser
                webbrowser.open(index.as_uri())
    elif args.open:
        open_in_openscad(out / f"{args.open}.scad")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
