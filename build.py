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
import os
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from trackball.assembly import (assembly, carrier_placement, cup_placement, section,
                                tray_placement)
from trackball.carrier import carrier
from trackball import options
from trackball.config import MCUS, SENSOR_PCBS, SWITCH_TYPES, Design
from trackball.options import OPTIONS, add_to_parser
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


def make_design(args) -> Design:
    return options.make_design(args_values(args))


def variant_name(args) -> str:
    return options.variant_name(args_values(args))


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
    cmd = [find_openscad(), "-o", str(stl), "--export-format", "binstl", str(scad)]
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
    add_to_parser(p)
    p.add_argument("--force", action="store_true", help="generate even if the validator reports problems")
    p.add_argument("--explode", type=float, default=0.0, help="exploded view distance for assembly")
    p.add_argument("--stl", action="store_true", help="render STLs with openscad (slow on 2021.01)")
    p.add_argument("--png", action="store_true", help="render PNG photos of every part and placement view")
    p.add_argument("--open", nargs="?", const="assembly",
                   choices=sorted(VIEWS) + ["png"],
                   help="launch OpenSCAD on this view after generating (default: assembly); "
                        "'png' renders the photos and opens the contact sheet instead")
    p.add_argument("--list", action="store_true")
    return p


def args_values(args) -> dict:
    """Option values from a parsed namespace."""
    return {o.name: getattr(args, o.name) for o in OPTIONS}


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
