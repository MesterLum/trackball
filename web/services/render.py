"""Background OpenSCAD rendering with a per-part cache.

One worker thread (OpenSCAD is CPU bound and single threaded). Each part's
STL is cached by the hash of its SCAD text, so unchanged parts of a new
design come back instantly.
"""
from __future__ import annotations

import queue
import shutil
import threading
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

from build import render_stl

PART_STYLE = {  # name -> (colour, frame, explode lift)
    "cup": ("#4682b4", "deck", 2.0),
    "carrier": ("#daa520", "deck", 1.0),
    "tray": ("#808080", "world", 0.0),
    "palmrest": ("#cd853f", "world", 0.0),
}


@dataclass
class Part:
    name: str
    state: str = "queued"
    url: str | None = None
    seconds: float | None = None
    cached: bool = False
    error: str | None = None

    def view(self) -> dict:
        color, frame, lift = PART_STYLE[self.name]
        return {**asdict(self), "color": color, "frame": frame, "lift": lift}


@dataclass
class Job:
    design_id: str
    part: str
    scad: Path
    cached_stl: Path
    link: Path


class RenderQueue:
    def __init__(self, out_dir: Path):
        self.out = out_dir
        self.cache = out_dir / "cache"
        self.cache.mkdir(parents=True, exist_ok=True)
        self._status: dict[str, dict[str, Part]] = {}
        self._lock = threading.Lock()
        self._jobs: "queue.Queue[Job]" = queue.Queue()
        self._thread = threading.Thread(target=self._run, daemon=True, name="openscad-worker")
        self._thread.start()

    # ---- public
    def submit(self, design_id: str, part_names: list[str]) -> dict:
        out = self.out / design_id
        with self._lock:
            parts = self._status.setdefault(design_id, {})
        for name in part_names:
            if name in parts and parts[name].state in ("done", "rendering", "queued"):
                continue
            h = (out / f"{name}.hash").read_text()
            cached = self.cache / f"{name}-{h}.stl"
            link = out / f"{name}.stl"
            part = Part(name)
            if cached.exists():
                if not link.exists():
                    shutil.copyfile(cached, link)
                part.state, part.url, part.cached = "done", self._url(design_id, name), True
                with self._lock:
                    parts[name] = part
            else:
                with self._lock:
                    parts[name] = part
                self._jobs.put(Job(design_id, name, out / f"{name}.scad", cached, link))
        return self.status(design_id)

    def status(self, design_id: str) -> dict:
        with self._lock:
            parts = [p.view() for p in self._status.get(design_id, {}).values()]
        states = [p["state"] for p in parts]
        done = bool(parts) and all(s in ("done", "error") for s in states)
        return {"id": design_id, "parts": parts, "done": done, "ok": done and all(s == "done" for s in states)}

    @property
    def pending(self) -> int:
        return self._jobs.qsize()

    # ---- worker
    @staticmethod
    def _url(design_id: str, name: str) -> str:
        return f"/api/design/{design_id}/file/{name}.stl"

    def _set(self, job: Job, **kw):
        with self._lock:
            part = self._status[job.design_id][job.part]
            for k, v in kw.items():
                setattr(part, k, v)

    def _run(self):
        while True:
            job = self._jobs.get()
            try:
                if not job.cached_stl.exists():
                    self._set(job, state="rendering")
                    t0 = time.time()
                    ok = render_stl(job.scad, job.cached_stl)
                    if not ok or not job.cached_stl.exists():
                        raise RuntimeError("OpenSCAD failed, see server log")
                    self._set(job, seconds=round(time.time() - t0, 1))
                if not job.link.exists():
                    shutil.copyfile(job.cached_stl, job.link)
                self._set(job, state="done", url=self._url(job.design_id, job.part))
            except Exception as e:  # noqa: BLE001
                self._set(job, state="error", error=str(e))
            finally:
                self._jobs.task_done()
