"""Interactive configurator: pick every option in a form, see the photos,
download the SCAD files and (on request) the printable STLs.

    uv run flask --app web.app run          # http://127.0.0.1:5000
    docker compose up --build               # same, in a container with OpenSCAD

The form is generated from build.py's argument parser, so every new CLI
option shows up here automatically.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import io
import os
import shlex
import sys
import threading
import zipfile
from pathlib import Path

from flask import Flask, abort, redirect, render_template_string, request, send_file, url_for

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from build import build_parser, camera_for, make_design, render_png, render_stl, variant_name  # noqa: E402
from trackball.assembly import assembly, carrier_placement, cup_placement, section, tray_placement  # noqa: E402
from trackball.carrier import carrier  # noqa: E402
from trackball.cup import cup  # noqa: E402
from trackball.palmrest import palmrest  # noqa: E402
from trackball.tray import tray  # noqa: E402

OUT = Path(os.environ.get("TRACKBALL_OUT", ROOT / "out" / "web"))
app = Flask(__name__)
RENDER_LOCK = threading.Lock()          # OpenSCAD renders are CPU bound; one at a time

SKIP = {"help", "stl", "png", "open", "list", "explode"}
PHOTOS = [("assembly", "iso", (55, 0, 25)), ("assembly", "top", (0, 0, 0)),
          ("assembly", "side", (90, 0, 90)), ("assembly", "bottom", (235, 0, 25)),
          ("section", "iso", (65, 0, 120)),
          ("cup_placement", "top", (55, 0, 25)), ("carrier_placement", "bottom", (235, 0, 25)),
          ("tray_placement", "top", (55, 0, 25))]
PRINT_PARTS = ("cup", "carrier", "tray", "palmrest")


# ---------------------------------------------------------------- form model
def fields():
    """Describe build.py's options for the form."""
    out = []
    for a in build_parser()._actions:
        if a.dest in SKIP or not a.option_strings:
            continue
        flag = a.option_strings[-1]
        kind = "flag" if isinstance(a, argparse._StoreTrueAction) else ("choice" if a.choices else "value")
        out.append({"dest": a.dest, "flag": flag, "kind": kind, "choices": list(a.choices or []),
                    "default": a.default, "help": a.help or "", "type": a.type})
    return out


def form_to_argv(form) -> list[str]:
    argv: list[str] = []
    for f in fields():
        v = form.get(f["dest"], "")
        if f["kind"] == "flag":
            if v:
                argv.append(f["flag"])
        elif v not in ("", None) and str(v) != str(f["default"]):
            argv += [f["flag"], str(v)]
    return argv


def variant_id(argv: list[str]) -> str:
    args = build_parser().parse_args(argv)
    return variant_name(args) + "-" + hashlib.sha1(" ".join(argv).encode()).hexdigest()[:6]


# ---------------------------------------------------------------- generation
def generate(argv: list[str]):
    """Write SCAD files + photos for argv. Returns (dir, design, problems, args)."""
    args = build_parser().parse_args(argv)
    d = make_design(args)
    problems = d.validate()
    if problems and not args.force:
        return None, d, problems, args
    vid = variant_id(argv)
    out = OUT / vid
    out.mkdir(parents=True, exist_ok=True)
    (out / "args.txt").write_text(" ".join(shlex.quote(a) for a in argv))
    if not (out / "assembly.scad").exists():
        parts = {"cup": cup(d), "carrier": carrier(d), "tray": tray(d),
                 "assembly": assembly(d), "section": section(d),
                 "cup_placement": cup_placement(d), "carrier_placement": carrier_placement(d),
                 "tray_placement": tray_placement(d)}
        if d.deck.palm_length > 0:
            parts["palmrest"] = palmrest(d)
        for name, obj in parts.items():
            obj.save_as_scad(str(out / f"{name}.scad"))
    cam = camera_for(d)
    with RENDER_LOCK:
        for part, view, rot in PHOTOS:
            png = out / f"{part}_{view}.png"
            if not png.exists():
                render_png(out / f"{part}.scad", png, rot, size=(900, 675),
                           camera=cam if part in ("assembly", "section") else None)
    return out, d, problems, args


def render_stls(out: Path) -> list[Path]:
    done = []
    with RENDER_LOCK:
        for part in PRINT_PARTS:
            scad = out / f"{part}.scad"
            if not scad.exists():
                continue
            stl = out / f"{part}.stl"
            if not stl.exists():
                render_stl(scad, stl)
            if stl.exists():
                done.append(stl)
    return done


# ---------------------------------------------------------------- templates
BASE_CSS = """
body{font:15px/1.45 system-ui;margin:0;background:#f5f5f7;color:#222}
header{background:#1d1d1f;color:#fff;padding:14px 24px}header a{color:#fff;text-decoration:none}
main{max-width:1300px;margin:0 auto;padding:20px 24px}
form.cfg{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px 18px}
form.cfg label{display:flex;flex-direction:column;font-size:13px;color:#444}
form.cfg input,form.cfg select{margin-top:4px;padding:6px 8px;font-size:14px;border:1px solid #ccc;border-radius:5px}
form.cfg .flag{flex-direction:row;align-items:center;gap:8px;margin-top:18px}
.actions{grid-column:1/-1;display:flex;gap:12px;align-items:center;margin-top:8px}
button,.btn{background:#0a66c2;color:#fff;border:0;padding:10px 18px;border-radius:6px;font-size:15px;cursor:pointer;text-decoration:none}
.btn.alt{background:#555}
pre{background:#eee;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:13px}
.bad{color:#b00020;font-weight:600}
.row{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}
img{width:400px;max-width:100%;border:1px solid #ddd;border-radius:6px;background:#fff}
figcaption{text-align:center;color:#666;font-size:12px}
code{background:#eef;padding:3px 6px;border-radius:4px}
"""

FORM = """<!doctype html><meta charset=utf-8><title>Trackball configurator</title><style>{{css}}</style>
<header><a href="/">Trackball module configurator</a></header><main>
{% if problems %}<h3 class=bad>Does not fit:</h3>{% for p in problems %}<p class=bad>{{p}}</p>{% endfor %}
<p>Fix the values below or tick <b>force</b> to generate anyway.</p>{% endif %}
<form class=cfg method=post action="/generate">
{% for f in fields %}
  {% if f.kind == 'flag' %}
    <label class=flag><input type=checkbox name="{{f.dest}}" value=1 {% if values.get(f.dest) %}checked{% endif %}>
      <span><b>{{f.flag}}</b><br><small>{{f.help}}</small></span></label>
  {% elif f.kind == 'choice' %}
    <label><b>{{f.flag}}</b><small>{{f.help}}</small>
      <select name="{{f.dest}}">{% for c in f.choices %}<option value="{{c}}" {% if str(values.get(f.dest, f.default)) == str(c) %}selected{% endif %}>{{c}}</option>{% endfor %}</select></label>
  {% else %}
    <label><b>{{f.flag}}</b><small>{{f.help}}</small>
      <input name="{{f.dest}}" value="{{values.get(f.dest, '' if f.default is none else f.default)}}"></label>
  {% endif %}
{% endfor %}
<div class=actions><button type=submit>Generate photos</button>
<span>Photos take ~20 s. STLs are rendered on request afterwards (1 to 2 min).</span></div>
</form></main>"""

RESULT = """<!doctype html><meta charset=utf-8><title>Trackball: {{vid}}</title><style>{{css}}</style>
<header><a href="/">Trackball module configurator</a></header><main>
<p><a class="btn alt" href="/?{{query}}">&larr; change values</a>
<a class=btn href="/stl/{{vid}}">Render + download STLs</a>
<a class="btn alt" href="/scad/{{vid}}">Download SCAD files</a></p>
<code>uv run build.py {{cmd}}</code>
<pre>{{summary}}</pre>
{% for p in problems %}<p class=bad>PROBLEM (forced): {{p}}</p>{% endfor %}
<div class=row>{% for name, cap in photos %}<figure><img src="/file/{{vid}}/{{name}}"><figcaption>{{cap}}</figcaption></figure>{% endfor %}</div>
</main>"""


# ---------------------------------------------------------------- routes
@app.get("/")
def index():
    return render_template_string(FORM, css=BASE_CSS, fields=fields(), values=request.args, problems=[], str=str)


@app.post("/generate")
def generate_route():
    argv = form_to_argv(request.form)
    try:
        out, d, problems, args = generate(argv)
    except SystemExit:
        abort(400, "bad option value")
    if out is None:
        return render_template_string(FORM, css=BASE_CSS, fields=fields(), values=request.form,
                                      problems=problems, str=str), 422
    return redirect(url_for("result", vid=out.name))


@app.get("/result/<vid>")
def result(vid: str):
    out = OUT / vid
    if not (out / "args.txt").exists():
        abort(404)
    argv = shlex.split((out / "args.txt").read_text())
    args = build_parser().parse_args(argv)
    d = make_design(args)
    photos = [(f"{p}_{v}.png", f"{p} {v}") for p, v, _ in PHOTOS if (out / f"{p}_{v}.png").exists()]
    query = "&".join(f"{f['dest']}={html.escape(str(getattr(args, f['dest'])))}" for f in fields()
                     if f["kind"] != "flag" and getattr(args, f["dest"]) is not None)
    query += "".join(f"&{f['dest']}=1" for f in fields() if f["kind"] == "flag" and getattr(args, f["dest"]))
    return render_template_string(RESULT, css=BASE_CSS, vid=vid, cmd=" ".join(shlex.quote(a) for a in argv),
                                  summary=d.summary(), problems=d.validate() if args.force else [],
                                  photos=photos, query=query)


@app.get("/file/<vid>/<name>")
def file(vid: str, name: str):
    p = OUT / vid / name
    if not p.exists() or ".." in name:
        abort(404)
    return send_file(p)


def _zip(paths: list[Path], extra: dict[str, str] | None = None) -> io.BytesIO:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p in paths:
            z.write(p, p.name)
        for name, text in (extra or {}).items():
            z.writestr(name, text)
    buf.seek(0)
    return buf


@app.get("/scad/<vid>")
def scad_zip(vid: str):
    out = OUT / vid
    if not out.exists():
        abort(404)
    files = sorted(out.glob("*.scad"))
    return send_file(_zip(files, {"command.txt": (out / "args.txt").read_text()}),
                     download_name=f"{vid}-scad.zip", as_attachment=True)


@app.get("/stl/<vid>")
def stl_zip(vid: str):
    out = OUT / vid
    if not out.exists():
        abort(404)
    stls = render_stls(out)
    if not stls:
        abort(500, "STL rendering failed; check that openscad is installed")
    return send_file(_zip(stls, {"command.txt": (out / "args.txt").read_text()}),
                     download_name=f"{vid}-stl.zip", as_attachment=True)


@app.get("/health")
def health():
    return {"ok": True, "out": str(OUT)}
