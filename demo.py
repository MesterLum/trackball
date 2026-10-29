#!/usr/bin/env python
"""Render a gallery of several configurations side by side.

    uv run demo.py            # writes out/demo/index.html
    uv run demo.py --open     # ... and opens it
"""
from __future__ import annotations

import html
import shlex
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from build import OUT, build_parser, camera_for, make_design, render_png, variant_name
from trackball.assembly import assembly, section

DEMOS: list[tuple[str, list[str]]] = [
    ("EM06 style: 10° tilt, 2 x 1.5u MX in front, separate 40 mm palm rest, nice!nano + battery under the sensor",
     ["--tilt", "10", "--switch-type", "mx", "--switches", "2", "--keycap-u", "1.5", "--palm", "40",
      "--mcu", "nice-nano", "--battery", "50x34x5"]),
    ("Default: 34 mm ball, 7.5 mm BTUs, Pico, 3 Choc buttons in front, padding 9", []),
    ("Minimal: 34 mm ball, RP2040-Zero under the sensor, no buttons, padding 4",
     ["--mcu", "rp2040-zero", "--mcu-place", "under", "--switches", "0", "--padding", "4"]),
    ("Minimal with buttons: RP2040-Zero under, USB at the back, 2 x 1.5u Choc, front strip only",
     ["--mcu", "rp2040-zero", "--mcu-place", "under", "--usb", "back", "--switches", "2",
      "--keycap-u", "1.5", "--no-mirror"]),
    ("Low profile: same as default but wires soldered to the sensor (--header-height 3), 6 mm lower",
     ["--header-height", "3"]),
    ("Flat paddles: 3 microswitch paddles in front, Pico, no tilt",
     ["--switch-type", "micro"]),
    ("MX 3 x 1.25u, Pico 2, 6° tilt, padding 12",
     ["--switch-type", "mx", "--keycap-u", "1.25", "--mcu", "pico2", "--tilt", "6", "--padding", "12"]),
    ("44 mm ball, Pico W under the sensor, 2 MX buttons on each side",
     ["--ball", "44", "--mcu", "pico-w", "--mcu-place", "under", "--switch-type", "mx", "--switches", "2", "--buttons", "sides"]),
    ("55 mm ball, ceramic bearings, RP2040-Zero, 3 Choc in front",
     ["--ball", "55", "--support", "ceramic-3", "--mcu", "rp2040-zero"]),
    ("Compact wireless: XIAO, 3 mm battery, 2 flat paddles",
     ["--mcu", "xiao", "--battery", "40x25x3", "--switch-type", "micro", "--switches", "2"]),
    ("Big wireless: 12° tilt, 60x40x6 battery, Supermini, 3 Choc, 50 mm palm rest with pad recess",
     ["--tilt", "12", "--battery", "60x40x6", "--mcu", "supermini", "--palm", "50", "--palm-pad"]),
    ("Tilt 8° + tent 6°, 4 Choc buttons in front, Supermini, padding 12",
     ["--tilt", "8", "--tent", "6", "--switches", "4", "--mcu", "supermini", "--padding", "12"]),
    ("Left-handed cable: USB out of the left wall, thicker 4 mm walls, 12 mm feet",
     ["--usb", "left", "--wall", "4", "--floor", "4", "--feet", "12"]),
    ("Validator demo: 25 mm ball, no buttons, Pro Micro does NOT fit behind at padding 9 (rendered with --force)",
     ["--ball", "25", "--support", "btu-4.8", "--mcu", "pro-micro", "--switches", "0", "--force"]),
    ("Same 25 mm ball with the Pro Micro under the sensor instead: body stays small, tray 8.5 mm taller",
     ["--ball", "25", "--support", "btu-4.8", "--mcu", "pro-micro", "--switches", "0", "--mcu-place", "under"]),
]

VIEWS = [("assembly", "iso", (55, 0, 25)), ("assembly", "top", (0, 0, 0)),
         ("assembly", "side (you sit at the left)", (90, 0, 90)), ("section", "iso", (65, 0, 120)),
         ("assembly", "bottom", (235, 0, 25))]


def main() -> int:
    want_open = "--open" in sys.argv[1:]
    root = OUT / "demo"
    root.mkdir(parents=True, exist_ok=True)
    # drop folders from configurations that are no longer in DEMOS
    current = {variant_name(build_parser().parse_args(argv)) for _, argv in DEMOS}
    for stale in root.iterdir():
        if stale.is_dir() and stale.name not in current:
            shutil.rmtree(stale)

    jobs, entries = [], []
    for title, argv in DEMOS:
        args = build_parser().parse_args(argv)
        d = make_design(args)
        name = variant_name(args)
        out = root / name
        out.mkdir(exist_ok=True)
        assembly(d).save_as_scad(str(out / "assembly.scad"))
        section(d).save_as_scad(str(out / "section.scad"))
        imgs = []
        cam = camera_for(d)
        for part, view, rot in VIEWS:
            png = out / f"{part}_{view.split()[0]}.png"
            jobs.append((out / f"{part}.scad", png, rot, cam))
            imgs.append((f"{part} {view}", png.relative_to(root)))
        cmd = "uv run build.py " + " ".join(shlex.quote(a) for a in argv)
        problems = d.validate()
        entries.append((title, cmd.strip(), d.summary(), imgs, problems))
        print("prepared", name)

    print(f"rendering {len(jobs)} views ...")
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda j: render_png(j[0], j[1], j[2], camera=j[3]), jobs))
    for (_, png, _, _), ok in zip(jobs, results):
        print("  ", "ok    " if ok else "FAILED", png.relative_to(root))

    sections = []
    for title, cmd, summary, imgs, problems in entries:
        figs = "".join(f'<figure><img src="{p}" loading="lazy"><figcaption>{html.escape(c)}</figcaption></figure>'
                       for c, p in imgs)
        probs = "".join(f"<p class=bad>PROBLEM: {html.escape(m)}</p>" for m in problems)
        sections.append(
            f"<section><h2>{html.escape(title)}</h2><code>{html.escape(cmd)}</code>"
            f"<pre>{html.escape(summary)}</pre>{probs}<div class=row>{figs}</div></section>")
    page = f"""<!doctype html><meta charset=utf-8><title>Trackball module: configurations</title>
<style>
body{{font:15px/1.4 system-ui;margin:24px;max-width:1500px;background:#fafafa;color:#222}}
code{{display:inline-block;background:#eef;padding:4px 8px;border-radius:4px;margin:4px 0}}
pre{{background:#eee;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:13px}}
.row{{display:flex;flex-wrap:wrap;gap:10px}} figure{{margin:0}}
img{{width:350px;max-width:100%;border:1px solid #ddd;border-radius:6px;background:#fff}}
figcaption{{text-align:center;color:#666;font-size:12px}} h2{{margin:34px 0 4px}}
section{{border-top:1px solid #ddd;padding-top:6px}} .bad{{color:#b00020;font-weight:600;margin:4px 0}}
</style>
<h1>Trackball module: {len(entries)} configurations</h1>
<p>You sit at the bottom of the top view and at the left of the side view. Blue = cup,
gold = lid/carrier, gray = tray, brown = separate palm rest. Red ball, green sensor PCB
and MCU, purple battery, white keycaps. The section view keeps the X&lt;0 half.
Body = cup skirt + padding, ball at the centre; buttons add a strip in front, mirrored
at the back; electronics must fit or the validator says how much padding to add.</p>
{''.join(sections)}
"""
    index = root / "index.html"
    index.write_text(page)
    print("gallery:", index)
    if want_open:
        if sys.platform == "darwin":
            subprocess.Popen(["open", str(index)])
        else:
            import webbrowser
            webbrowser.open(index.as_uri())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
