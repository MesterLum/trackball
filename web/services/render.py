"""Background OpenSCAD rendering with a per-part cache, parallel workers and
cancellation.

* N worker threads, each running one `openscad` process (OpenSCAD itself is
  single threaded, the parts are independent).
* Each part's STL is cached by the hash of its SCAD text (which includes
  `$fn`), so unchanged parts of a new design come back instantly.
* `cancel(design_id)` drops queued parts and kills a running process:
  "latest wins" when the user keeps editing.
"""
from __future__ import annotations

import queue
import shutil
import subprocess
import sys
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from build import find_openscad

PART_STYLE = {  # name -> (colour, frame, explode lift)
    "cup": ("#4682b4", "deck", 2.0),
    "carrier": ("#daa520", "deck", 1.0),
    "tray": ("#808080", "world", 0.0),
    "palmrest": ("#cd853f", "world", 0.0),
    "palm_key": ("#008080", "world", 0.0),
}


@dataclass
class Part:
    name: str
    state: str = "queued"          # queued | rendering | done | error | cancelled
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
    cancelled: bool = False
    proc: subprocess.Popen | None = None


class RenderQueue:
    def __init__(self, out_dir: Path, workers: int = 1):
        self.out = out_dir
        self.cache = out_dir / "cache"
        self.cache.mkdir(parents=True, exist_ok=True)
        self._status: dict[str, dict[str, Part]] = {}
        self._jobs_by_design: dict[str, list[Job]] = {}
        self._lock = threading.Lock()
        self._queue: "queue.Queue[Job]" = queue.Queue()
        self.workers = max(1, workers)
        for i in range(self.workers):
            threading.Thread(target=self._run, daemon=True, name=f"openscad-{i}").start()

    # ---- public --------------------------------------------------------
    def submit(self, design_id: str, part_names: list[str]) -> dict:
        out = self.out / design_id
        with self._lock:
            parts = self._status.setdefault(design_id, {})
            jobs = self._jobs_by_design.setdefault(design_id, [])
        for name in part_names:
            with self._lock:
                cur = parts.get(name)
                if cur and cur.state in ("done", "rendering", "queued"):
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
                job = Job(design_id, name, out / f"{name}.scad", cached, link)
                with self._lock:
                    parts[name] = part
                    jobs.append(job)
                self._queue.put(job)
        return self.status(design_id)

    def cancel(self, design_id: str) -> int:
        """Drop queued parts of a design and kill its running renders."""
        n = 0
        with self._lock:
            jobs = self._jobs_by_design.get(design_id, [])
            for job in jobs:
                part = self._status[design_id][job.part]
                if part.state in ("queued", "rendering"):
                    job.cancelled = True
                    part.state = "cancelled"
                    n += 1
                    if job.proc and job.proc.poll() is None:
                        try:
                            job.proc.terminate()
                        except OSError:
                            pass
        return n

    def status(self, design_id: str) -> dict:
        with self._lock:
            parts = [p.view() for p in self._status.get(design_id, {}).values()]
        states = [p["state"] for p in parts]
        done = bool(parts) and all(s in ("done", "error", "cancelled") for s in states)
        return {"id": design_id, "parts": parts, "done": done,
                "ok": done and all(s == "done" for s in states)}

    @property
    def pending(self) -> int:
        return self._queue.qsize()

    # ---- worker --------------------------------------------------------
    @staticmethod
    def _url(design_id: str, name: str) -> str:
        return f"/api/design/{design_id}/file/{name}.stl"

    def _set(self, job: Job, **kw):
        with self._lock:
            part = self._status[job.design_id][job.part]
            for k, v in kw.items():
                setattr(part, k, v)

    def _openscad(self, job: Job) -> bool:
        tmp = job.cached_stl.with_suffix(".part")
        cmd = [find_openscad(), "-o", str(tmp), "--export-format", "binstl", str(job.scad)]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        with self._lock:
            job.proc = proc
        _, err = proc.communicate()
        if proc.returncode != 0 or not tmp.exists():
            if not job.cancelled:
                print(f"openscad failed for {job.scad.name}: {err[-400:]}", file=sys.stderr)
            tmp.unlink(missing_ok=True)
            return False
        tmp.replace(job.cached_stl)
        return True

    def _run(self):
        while True:
            job = self._queue.get()
            try:
                if job.cancelled:
                    continue
                if not job.cached_stl.exists():
                    self._set(job, state="rendering")
                    t0 = time.time()
                    ok = self._openscad(job)
                    if job.cancelled:
                        continue
                    if not ok:
                        raise RuntimeError("OpenSCAD failed, see server log")
                    self._set(job, seconds=round(time.time() - t0, 1))
                if not job.link.exists():
                    shutil.copyfile(job.cached_stl, job.link)
                self._set(job, state="done", url=self._url(job.design_id, job.part))
            except Exception as e:  # noqa: BLE001
                if not job.cancelled:
                    self._set(job, state="error", error=str(e))
            finally:
                self._queue.task_done()
