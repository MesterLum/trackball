#!/usr/bin/env python
"""Render every preset into a self-contained bundle:

    out/presets/<key>/
        cup.stl carrier.stl tray.stl [palmrest.stl]   full quality
        assembly_iso.png assembly_top.png assembly_side.png section_iso.png
        summary.txt   bom.md   design.json   command.txt   <key>.zip
    out/presets/index.html                            gallery of all bundles

    uv run presets_bundle.py                 # all presets
    uv run presets_bundle.py em06 minimal    # some of them
    uv run presets_bundle.py --no-photos     # STLs only (no display needed)

STLs go through the same per-part cache as the web app (out/web/cache), so
re-running after a geometry change only re-renders what changed.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import shlex
import shutil
import sys
import time
import zipfile
from pathlib import Path

from build import camera_for, render_png
from trackball import options
from trackball.assembly import assembly, section
from trackball.presets import PRESETS
from web.services.designs import DesignService
from web.services.render import PART_STYLE, RenderQueue
from web.settings import Settings

ROOT = Path(__file__).resolve().parent
VIEWS = [("assembly", "iso", (55, 0, 25)), ("assembly", "top", (0, 0, 0)),
         ("assembly", "side", (90, 0, 90)), ("section", "iso", (65, 0, 120))]


def bom_markdown(title: str, cmd: str, bom: list[dict], summary: str) -> str:
    lines = [f"# {title}", "", "```", cmd, "```", "", "## Parts to buy", "", "| qty | item | note |", "|---|---|---|"]
    lines += [f"| {b['qty']} | {b['item']} | {b['note']} |" for b in bom]
    lines += ["", "## Printed parts", "", "- cup.stl (deck frame, print as is)", "- carrier.stl (lid, print as is)",
              "- tray.stl (floor down; includes the palm rest in fused mode)",
              "- palmrest.stl (separate or anchored palm rest only)",
              "- palm_key.stl (anchored mode only; press into the underside after joining)", "",
              "## Dimensions", "", "```", summary, "```", "",
              "Assembly order and the numbers that still need measuring are in the project README."]
    return "\n".join(lines) + "\n"


def build_bundle(key: str, settings: Settings, designs: DesignService, rq: RenderQueue, photos: bool) -> dict:
    preset = next(p for p in PRESETS if p.key == key)
    res = designs.prepare(preset.values, quality="final")
    if not res.fits:
        raise SystemExit(f"{key}: preset does not fit: {res.problems}")
    out = settings.presets_dir / key
    out.mkdir(parents=True, exist_ok=True)
    payload = res.payload()

    # STLs through the shared queue/cache
    names = designs.part_names(res.id)
    rq.submit(res.id, names)
    t0 = time.time()
    while not rq.status(res.id)["done"]:
        time.sleep(0.5)
    st = rq.status(res.id)
    if not st["ok"]:
        raise SystemExit(f"{key}: render failed: {st}")
    for n in names:
        shutil.copyfile(res.dir / f"{n}.stl", out / f"{n}.stl")
    secs = round(time.time() - t0, 1)

    # photos
    if photos:
        d = res.design
        assembly(d).save_as_scad(str(out / "assembly.scad"))
        section(d).save_as_scad(str(out / "section.scad"))
        cam = camera_for(d)
        for part, view, rot in VIEWS:
            render_png(out / f"{part}.scad", out / f"{part}_{view}.png", rot, size=(1200, 900), camera=cam)
        (out / "assembly.scad").unlink(missing_ok=True)
        (out / "section.scad").unlink(missing_ok=True)

    (out / "summary.txt").write_text(payload["summary"] + "\n")
    (out / "bom.md").write_text(bom_markdown(preset.title, payload["cmd"], payload["bom"], payload["summary"]))
    (out / "design.json").write_text(json.dumps(res.values, indent=1, sort_keys=True))
    (out / "command.txt").write_text(payload["cmd"] + "\n")
    with zipfile.ZipFile(out / f"{key}.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(out.iterdir()):
            if f.suffix != ".zip":
                z.write(f, f.name)
    meta = {"key": key, "title": preset.title, "blurb": preset.blurb, "tags": list(preset.tags),
            "footprint": payload["footprint"], "height": payload["height"], "cmd": payload["cmd"],
            "parts": names, "render_seconds": secs, "photos": photos}
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    return meta


def write_gallery(settings: Settings, metas: list[dict]) -> Path:
    cards = []
    for m in metas:
        k = m["key"]
        img = f'<img src="{k}/assembly_iso.png" alt="{html.escape(m["title"])}">' if m["photos"] else ""
        cards.append(f"""<article>
  {img}
  <h2>{html.escape(m['title'])}</h2>
  <p>{html.escape(m['blurb'])}</p>
  <p class=meta>{m['footprint'][0]} × {m['footprint'][1]} mm · {m['height']} mm tall · parts: {', '.join(m['parts'])}</p>
  <p><a class=btn href="{k}/{k}.zip">Download bundle (STL + BOM)</a> <a href="{k}/bom.md">BOM</a> · <a href="{k}/summary.txt">dimensions</a></p>
  <code>{html.escape(m['cmd'])}</code>
</article>""")
    page = f"""<!doctype html><meta charset=utf-8><title>Trackball module: prebuilt presets</title>
<style>
body{{font:15px/1.45 system-ui;margin:0;background:#0f172a;color:#e2e8f0}}
header{{padding:28px 32px;background:#111c33}} h1{{margin:0}} p{{margin:4px 0}}
main{{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px;padding:24px 32px}}
article{{background:#1e293b;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgb(0 0 0/.35)}}
article img{{width:100%;aspect-ratio:4/3;object-fit:cover;background:#111}} article h2{{margin:12px 16px 4px;font-size:18px}}
article p{{margin:4px 16px}} .meta{{color:#94a3b8;font-size:13px}} code{{display:block;margin:10px 16px 16px;font-size:11px;color:#94a3b8;word-break:break-all}}
a{{color:#7dd3fc}} .btn{{display:inline-block;background:#0ea5e9;color:#fff;padding:7px 12px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px}}
</style>
<header><h1>Trackball module: prebuilt presets</h1>
<p>{len(metas)} configurations rendered at full quality. Each bundle has the STLs, photos, a bill of materials and the command to reproduce it.</p></header>
<main>{''.join(cards)}</main>"""
    index = settings.presets_dir / "index.html"
    index.write_text(page)
    return index


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("keys", nargs="*", help="preset keys (default: all)")
    ap.add_argument("--no-photos", action="store_true", help="skip PNG renders (no display needed)")
    args = ap.parse_args()
    settings = Settings()
    settings.presets_dir.mkdir(parents=True, exist_ok=True)
    designs = DesignService(settings.out, {"preview": settings.fn_preview, "final": settings.fn_final})
    rq = RenderQueue(settings.out, workers=settings.workers)
    keys = args.keys or [p.key for p in PRESETS]
    unknown = [k for k in keys if k not in {p.key for p in PRESETS}]
    if unknown:
        raise SystemExit(f"unknown preset(s): {unknown}; known: {[p.key for p in PRESETS]}")
    metas = []
    for k in keys:
        print(f"== {k}", flush=True)
        m = build_bundle(k, settings, designs, rq, photos=not args.no_photos)
        print(f"   {m['footprint'][0]} x {m['footprint'][1]} mm, STLs in {m['render_seconds']} s", flush=True)
        metas.append(m)
    # gallery over every bundle present on disk (not only the ones built now)
    all_meta = []
    for p in PRESETS:
        mp = settings.presets_dir / p.key / "meta.json"
        if mp.exists():
            all_meta.append(json.loads(mp.read_text()))
    index = write_gallery(settings, all_meta)
    print("gallery:", index)
    return 0


if __name__ == "__main__":
    sys.exit(main())
