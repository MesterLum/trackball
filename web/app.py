"""Interactive configurator: a small JSON API around build.py plus a single
Alpine.js page (Tailwind + daisyUI) with a live Three.js view.

    uv run flask --app web.app run          # http://127.0.0.1:5000
    docker compose up --build               # http://localhost:8321

Flow: every form change -> POST /api/design (validate + summary, instant)
-> POST /api/design/<id>/render (queues the printable parts) -> the page
follows GET /api/design/<id>/events (server-sent events) and swaps each
STL into the viewer as it is finished. STLs are cached per part by the
hash of that part's SCAD text, so changing the tilt re-renders only the
tray and palm rest, not the cup.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import queue
import shlex
import shutil
import sys
import threading
import time
import zipfile
from pathlib import Path

from flask import Flask, Response, abort, jsonify, render_template_string, request, send_file

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from solid2 import scad_render  # noqa: E402

from build import build_parser, make_design, render_stl, variant_name  # noqa: E402
from trackball.carrier import carrier  # noqa: E402
from trackball.cup import cup  # noqa: E402
from trackball.palmrest import palmrest  # noqa: E402
from trackball.tray import tray  # noqa: E402

OUT = Path(os.environ.get("TRACKBALL_OUT", ROOT / "out" / "web"))
CACHE = OUT / "cache"
app = Flask(__name__)

SKIP = {"help", "stl", "png", "open", "list", "explode", "force"}
GROUPS = [
    ("Ball & cup", ["ball", "support", "supports", "polar", "sensor_pcb", "header_height"]),
    ("Buttons", ["switches", "switch_type", "buttons", "keycap_u", "switch_gap", "no_mirror"]),
    ("Electronics", ["mcu", "mcu_place", "usb", "battery"]),
    ("Body", ["padding", "wall", "floor", "feet", "fn"]),
    ("Deck", ["tilt", "tent", "palm", "palm_pad"]),
]
# name -> (colour, frame, explode lift)
PARTS = {"cup": ("#4682b4", "deck", 2.0), "carrier": ("#daa520", "deck", 1.0),
         "tray": ("#808080", "world", 0.0), "palmrest": ("#cd853f", "world", 0.0)}


# ---------------------------------------------------------------- options
def fields() -> list[dict]:
    out = []
    for a in build_parser()._actions:
        if a.dest in SKIP or not a.option_strings:
            continue
        kind = "flag" if isinstance(a, argparse._StoreTrueAction) else ("choice" if a.choices else "value")
        step = 1 if a.type is int else (0.5 if a.type is float else None)
        out.append({"dest": a.dest, "flag": a.option_strings[-1], "kind": kind,
                    "choices": list(a.choices or []), "default": a.default, "help": a.help or "",
                    "number": a.type in (int, float), "step": step})
    return out


def cfg_to_argv(cfg: dict) -> list[str]:
    argv: list[str] = []
    for f in fields():
        v = cfg.get(f["dest"], f["default"])
        if f["kind"] == "flag":
            if v in (True, "true", "1", 1, "on"):
                argv.append(f["flag"])
        elif v not in ("", None) and str(v) != str(f["default"]):
            argv += [f["flag"], str(v)]
    return argv


def design_id(argv: list[str]) -> str:
    args = build_parser().parse_args(argv)
    return variant_name(args) + "-" + hashlib.sha1(" ".join(argv).encode()).hexdigest()[:6]


# ---------------------------------------------------------------- render queue
STATUS: dict[str, dict[str, dict]] = {}       # design id -> part -> {state, url, error}
STATUS_LOCK = threading.Lock()
JOBS: "queue.Queue[tuple[str, str, Path, Path]]" = queue.Queue()


def _set(did: str, part: str, **kw):
    with STATUS_LOCK:
        STATUS.setdefault(did, {}).setdefault(part, {}).update(kw)


def _worker():
    while True:
        did, part, scad, stl = JOBS.get()
        try:
            if not stl.exists():
                _set(did, part, state="rendering")
                t0 = time.time()
                ok = render_stl(scad, stl)
                if not ok or not stl.exists():
                    raise RuntimeError("openscad failed")
                _set(did, part, seconds=round(time.time() - t0, 1))
            link = OUT / did / f"{part}.stl"
            if not link.exists():
                shutil.copyfile(stl, link)
            _set(did, part, state="done", url=f"/file/{did}/{part}.stl")
        except Exception as e:  # noqa: BLE001
            _set(did, part, state="error", error=str(e))
        finally:
            JOBS.task_done()


threading.Thread(target=_worker, daemon=True, name="openscad-worker").start()


def prepare(cfg: dict):
    """Validate and write the SCAD files. Returns (id, design, problems, argv)."""
    argv = cfg_to_argv(cfg)
    args = build_parser().parse_args(argv)
    d = make_design(args)
    problems = d.validate()
    did = design_id(argv)
    out = OUT / did
    out.mkdir(parents=True, exist_ok=True)
    (out / "args.txt").write_text(" ".join(shlex.quote(a) for a in argv))
    if not problems:
        parts = {"cup": cup(d), "carrier": carrier(d), "tray": tray(d)}
        if d.deck.palm_length > 0:
            parts["palmrest"] = palmrest(d)
        for name, obj in parts.items():
            text = scad_render(obj)
            h = hashlib.sha1(text.encode()).hexdigest()[:12]
            (out / f"{name}.scad").write_text(text)
            (out / f"{name}.hash").write_text(h)
    return did, d, problems, argv


def enqueue(did: str) -> dict:
    out = OUT / did
    CACHE.mkdir(parents=True, exist_ok=True)
    with STATUS_LOCK:
        STATUS[did] = {}
    for part in PARTS:
        scad = out / f"{part}.scad"
        if not scad.exists():
            continue
        h = (out / f"{part}.hash").read_text()
        cached = CACHE / f"{part}-{h}.stl"
        if cached.exists():
            link = out / f"{part}.stl"
            if not link.exists():
                shutil.copyfile(cached, link)
            _set(did, part, state="done", url=f"/file/{did}/{part}.stl", cached=True)
        else:
            _set(did, part, state="queued")
            JOBS.put((did, part, scad, cached))
    return status_of(did)


def status_of(did: str) -> dict:
    with STATUS_LOCK:
        st = {k: dict(v) for k, v in STATUS.get(did, {}).items()}
    for name, (color, frame, lift) in PARTS.items():
        if name in st:
            st[name].update(color=color, frame=frame, lift=lift)
    return st


def design_payload(did: str, d, problems: list[str], argv: list[str]) -> dict:
    return {"id": did, "summary": d.summary(), "problems": problems,
            "cmd": "uv run build.py " + " ".join(shlex.quote(a) for a in argv),
            "tilt": d.deck.tilt_deg, "tent": d.deck.tent_deg, "ball_r": d.ball.r,
            "floor_z": d.z_floor_bottom, "footprint": d.footprint[:2],
            "height": round(d.ball.r - d.z_floor_bottom, 1)}


# ---------------------------------------------------------------- API
@app.get("/api/options")
def api_options():
    return jsonify({"fields": fields(), "groups": GROUPS})


@app.post("/api/design")
def api_design():
    cfg = request.get_json(force=True, silent=True) or {}
    try:
        did, d, problems, argv = prepare(cfg)
    except SystemExit:
        return jsonify({"error": "bad option value"}), 400
    return jsonify(design_payload(did, d, problems, argv))


@app.post("/api/design/<did>/render")
def api_render(did: str):
    if not (OUT / did / "cup.scad").exists():
        abort(404)
    return jsonify(enqueue(did))


@app.get("/api/design/<did>/status")
def api_status(did: str):
    return jsonify(status_of(did))


@app.get("/api/design/<did>/events")
def api_events(did: str):
    def stream():
        last = None
        for _ in range(1200):                      # 10 minutes max
            st = status_of(did)
            if st != last:
                yield f"data: {json.dumps(st)}\n\n"
                last = st
            if st and all(p["state"] in ("done", "error") for p in st.values()):
                yield "event: end\ndata: {}\n\n"
                return
            time.sleep(0.5)
    return Response(stream(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/file/<did>/<name>")
def file(did: str, name: str):
    p = OUT / did / name
    if ".." in name or not p.exists():
        abort(404)
    return send_file(p)


def _zip(paths: list[Path], extra: dict[str, str]) -> io.BytesIO:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p in paths:
            z.write(p, p.name)
        for name, text in extra.items():
            z.writestr(name, text)
    buf.seek(0)
    return buf


@app.get("/scad/<did>")
def scad_zip(did: str):
    out = OUT / did
    if not out.exists():
        abort(404)
    return send_file(_zip(sorted(out.glob("*.scad")), {"command.txt": (out / "args.txt").read_text()}),
                     download_name=f"{did}-scad.zip", as_attachment=True)


@app.get("/stl/<did>")
def stl_zip(did: str):
    out = OUT / did
    stls = [out / f"{p}.stl" for p in PARTS if (out / f"{p}.stl").exists()]
    if not stls:
        abort(404, "no STLs rendered yet")
    return send_file(_zip(stls, {"command.txt": (out / "args.txt").read_text()}),
                     download_name=f"{did}-stl.zip", as_attachment=True)


@app.get("/health")
def health():
    return {"ok": True, "out": str(OUT), "queue": JOBS.qsize()}


# ---------------------------------------------------------------- page
PAGE = r"""<!doctype html><html lang=en data-theme=corporate><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Trackball configurator</title>
<link href="https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.1/build/three.module.js",
"three/addons/":"https://unpkg.com/three@0.160.1/examples/jsm/"}}</script>
<style>#viewer canvas{display:block}[x-cloak]{display:none!important}</style>
</head><body class="bg-base-200 min-h-screen">

<script type=module>
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const el = document.getElementById('viewer');
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf7f7f9);
const camera = new THREE.PerspectiveCamera(40, 1, 1, 3000); camera.up.set(0, 0, 1);
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(devicePixelRatio);
el.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.1));
const s1 = new THREE.DirectionalLight(0xffffff, 1.2); s1.position.set(80, -120, 160); scene.add(s1);
const s2 = new THREE.DirectionalLight(0xffffff, 0.5); s2.position.set(-100, 80, 60); scene.add(s2);
const grid = new THREE.GridHelper(300, 30, 0xbbbbbb, 0xdddddd).rotateX(Math.PI / 2); scene.add(grid);
const loader = new STLLoader();
const meshes = {}; let frame = { tilt: 0, tent: 0, ball_r: 17, floor_z: -37 }; let explode = 0; let framed = false;
const ball = new THREE.Mesh(new THREE.SphereGeometry(17, 48, 32),
  new THREE.MeshStandardMaterial({ color: 0xdc143c, transparent: true, opacity: 0.45, roughness: 0.3 }));
scene.add(ball);

function resize() { const w = el.clientWidth, h = Math.max(380, Math.round(w * 0.62));
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
(function loop() { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();

function place() {
  const t = THREE.MathUtils.degToRad(frame.tilt), a = THREE.MathUtils.degToRad(frame.tent);
  for (const m of Object.values(meshes)) {
    if (m.userData.frame === 'deck') { m.rotation.order = 'YXZ'; m.rotation.x = t; m.rotation.y = a; }
    m.position.set(0, 0, m.userData.lift * explode);
  }
  ball.position.z = 2 * explode;
  ball.scale.setScalar(frame.ball_r / 17);
  grid.position.z = frame.floor_z;
}
function fit() {
  const box = new THREE.Box3(); for (const m of Object.values(meshes)) if (m.visible) box.expandByObject(m);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), r = Math.max(size.x, size.y, size.z);
  camera.position.set(c.x + r * 0.9, c.y - r * 1.3, c.z + r * 0.9); controls.target.copy(c);
  camera.near = r / 100; camera.far = r * 20; camera.updateProjectionMatrix(); framed = true;
}
window.viewer = {
  setFrame(f) { frame = { ...frame, ...f }; place(); },
  setExplode(e) { explode = e; place(); },
  setVisible(name, v) { if (meshes[name]) meshes[name].visible = v; if (name === 'ball') ball.visible = v; },
  clear(keep) { for (const [n, m] of Object.entries(meshes)) if (!keep.includes(n)) { scene.remove(m); m.geometry.dispose(); delete meshes[n]; } },
  async load(name, url, color, fr, lift) {
    const geo = await loader.loadAsync(url + '?v=' + Date.now()); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.7 }));
    mesh.userData = { frame: fr, lift };
    if (meshes[name]) { scene.remove(meshes[name]); meshes[name].geometry.dispose(); }
    meshes[name] = mesh; scene.add(mesh); place();
    if (!framed || name === 'tray') fit();
  },
  fit,
};
</script>

<div x-data="app()" x-init="init()" x-cloak class="flex flex-col lg:flex-row min-h-screen">

  <!-- sidebar: configuration -->
  <aside class="lg:w-96 bg-base-100 border-r border-base-300 p-4 overflow-y-auto lg:h-screen lg:sticky lg:top-0">
    <h1 class="text-xl font-bold mb-1">Trackball module</h1>
    <p class="text-xs opacity-70 mb-4">Every change re-validates instantly; parts re-render in the background.</p>
    <template x-for="[title, keys] in groups" :key="title">
      <div class="collapse collapse-arrow bg-base-200 mb-2">
        <input type=checkbox checked>
        <div class="collapse-title font-semibold py-2 min-h-0" x-text="title"></div>
        <div class="collapse-content grid grid-cols-2 gap-x-3 gap-y-2">
          <template x-for="f in keys.map(k => byDest[k]).filter(Boolean)" :key="f.dest">
            <div :class="f.kind === 'flag' ? 'col-span-2' : ''">
              <template x-if="f.kind === 'flag'">
                <label class="label cursor-pointer justify-start gap-3 py-1">
                  <input type=checkbox class="toggle toggle-primary toggle-sm" x-model="cfg[f.dest]" @change="update()">
                  <span class="label-text"><span class="font-mono text-xs" x-text="f.flag"></span>
                    <span class="block text-xs opacity-60" x-text="f.help"></span></span>
                </label>
              </template>
              <template x-if="f.kind === 'choice'">
                <label class="form-control">
                  <span class="label-text text-xs font-mono" x-text="f.flag" :title="f.help"></span>
                  <select class="select select-bordered select-sm" x-model="cfg[f.dest]" @change="update()">
                    <template x-for="c in f.choices" :key="c"><option :value="c" x-text="c" :selected="String(c) === String(cfg[f.dest])"></option></template>
                  </select>
                </label>
              </template>
              <template x-if="f.kind === 'value'">
                <label class="form-control">
                  <span class="label-text text-xs font-mono" x-text="f.flag" :title="f.help"></span>
                  <input :type="f.number ? 'number' : 'text'" :step="f.step" class="input input-bordered input-sm"
                         x-model="cfg[f.dest]" @input.debounce.400ms="update()" :placeholder="f.help.slice(0, 40)">
                </label>
              </template>
            </div>
          </template>
        </div>
      </div>
    </template>
    <div class="flex gap-2 mt-2">
      <button class="btn btn-sm btn-outline flex-1" @click="reset()">Reset to defaults</button>
      <button class="btn btn-sm btn-outline flex-1" @click="copyCmd()" x-text="copied ? 'Copied!' : 'Copy CLI command'"></button>
    </div>
  </aside>

  <!-- main: viewer + status -->
  <main class="flex-1 p-4 space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <span class="badge badge-lg" :class="busy ? 'badge-warning' : (problems.length ? 'badge-error' : 'badge-success')"
            x-text="busy ? 'rendering…' : (problems.length ? 'does not fit' : 'ready')"></span>
      <template x-for="(p, name) in parts" :key="name">
        <span class="badge gap-1" :class="{'badge-ghost': p.state==='queued', 'badge-warning': p.state==='rendering', 'badge-success': p.state==='done', 'badge-error': p.state==='error'}">
          <span class="inline-block w-2 h-2 rounded-sm" :style="'background:' + p.color"></span>
          <span x-text="name"></span>
          <span class="loading loading-spinner loading-xs" x-show="p.state==='rendering'"></span>
          <span class="opacity-70" x-show="p.seconds" x-text="p.seconds + 's'"></span>
        </span>
      </template>
      <span class="flex-1"></span>
      <a class="btn btn-sm btn-primary" :class="{'btn-disabled': !allDone}" :href="'/stl/' + id">Download STLs</a>
      <a class="btn btn-sm" :class="{'btn-disabled': !id}" :href="'/scad/' + id">SCAD files</a>
    </div>

    <template x-if="problems.length">
      <div class="alert alert-error text-sm">
        <ul class="list-disc ml-4"><template x-for="p in problems"><li x-text="p"></li></template></ul>
      </div>
    </template>

    <div class="card bg-base-100 shadow">
      <div class="card-body p-3">
        <div class="flex flex-wrap items-center gap-4 text-sm mb-2">
          <label class="flex items-center gap-2">explode
            <input type=range min=0 max=40 step=1 class="range range-xs range-primary w-40" x-model.number="explode" @input="viewer.setExplode(explode)"></label>
          <template x-for="name in ['cup','carrier','tray','palmrest','ball']" :key="name">
            <label class="flex items-center gap-1 cursor-pointer">
              <input type=checkbox class="checkbox checkbox-xs" checked @change="viewer.setVisible(name, $event.target.checked)"><span x-text="name"></span>
            </label>
          </template>
          <button class="btn btn-xs" @click="viewer.fit()">fit view</button>
          <span class="opacity-60">drag: orbit · wheel: zoom · right-drag: pan</span>
        </div>
        <div id=viewer class="rounded-lg overflow-hidden border border-base-300"></div>
      </div>
    </div>

    <div class="grid md:grid-cols-3 gap-3">
      <div class="stat bg-base-100 rounded-lg shadow"><div class="stat-title">Footprint</div>
        <div class="stat-value text-2xl" x-text="footprint ? footprint[0].toFixed(1) + ' × ' + footprint[1].toFixed(1) + ' mm' : '–'"></div></div>
      <div class="stat bg-base-100 rounded-lg shadow"><div class="stat-title">Height (floor → ball top)</div>
        <div class="stat-value text-2xl" x-text="height ? height + ' mm' : '–'"></div></div>
      <div class="stat bg-base-100 rounded-lg shadow"><div class="stat-title">Command</div>
        <div class="text-xs font-mono break-all" x-text="cmd"></div></div>
    </div>
    <pre class="bg-base-100 rounded-lg shadow p-3 text-xs whitespace-pre-wrap" x-text="summary"></pre>
  </main>
</div>

<script>
function app() {
  return {
    fields: [], groups: [], byDest: {}, cfg: {}, id: null, summary: '', problems: [], cmd: '',
    footprint: null, height: null, parts: {}, busy: false, explode: 0, copied: false, es: null, seq: 0,
    get allDone() { const v = Object.values(this.parts); return v.length > 0 && v.every(p => p.state === 'done'); },
    async init() {
      const o = await (await fetch('/api/options')).json();
      this.fields = o.fields; this.groups = o.groups;
      for (const f of this.fields) this.byDest[f.dest] = f;
      this.reset();
    },
    defaults() { const c = {}; for (const f of this.fields) c[f.dest] = f.kind === 'flag' ? false : (f.default ?? ''); return c; },
    reset() { this.cfg = this.defaults(); this.update(); },
    async update() {
      const seq = ++this.seq;
      const r = await fetch('/api/design', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.cfg) });
      if (seq !== this.seq) return;                       // a newer edit superseded this one
      if (!r.ok) { this.problems = ['bad option value']; return; }
      const d = await r.json();
      Object.assign(this, { id: d.id, summary: d.summary, problems: d.problems, cmd: d.cmd, footprint: d.footprint, height: d.height });
      viewer.setFrame({ tilt: d.tilt, tent: d.tent, ball_r: d.ball_r, floor_z: d.floor_z });
      if (d.problems.length) { this.busy = false; return; }
      this.render(d.id);
    },
    async render(id) {
      if (this.es) { this.es.close(); this.es = null; }
      this.busy = true;
      this.parts = await (await fetch('/api/design/' + id + '/render', { method: 'POST' })).json();
      viewer.clear(Object.keys(this.parts));
      const loaded = new Set();
      const apply = (st) => {
        this.parts = st;
        for (const [name, p] of Object.entries(st))
          if (p.state === 'done' && !loaded.has(name)) { loaded.add(name); viewer.load(name, p.url, p.color, p.frame, p.lift); }
      };
      apply(this.parts);
      if (this.allDone) { this.busy = false; return; }
      this.es = new EventSource('/api/design/' + id + '/events');
      this.es.onmessage = (e) => { if (this.id === id) apply(JSON.parse(e.data)); };
      this.es.addEventListener('end', () => { this.busy = false; this.es.close(); this.es = null; });
    },
    copyCmd() { navigator.clipboard.writeText(this.cmd); this.copied = true; setTimeout(() => this.copied = false, 1500); },
  };
}
</script>
<script defer src="https://unpkg.com/alpinejs@3.14.1/dist/cdn.min.js"></script>
</body></html>"""


@app.get("/")
def index():
    return render_template_string(PAGE)
