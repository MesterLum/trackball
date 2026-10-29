"""Turn option values into a validated Design plus its SCAD files on disk."""
from __future__ import annotations

import hashlib
import json
import shlex
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from solid2 import scad_render

from trackball import options
from trackball.carrier import carrier
from trackball.config import Design
from trackball.cup import cup
from trackball.palmrest import palmrest
from trackball.tray import tray

PART_BUILDERS = {"cup": cup, "carrier": carrier, "tray": tray, "palmrest": palmrest}


@dataclass
class DesignResult:
    id: str
    variant: str
    values: dict[str, Any]
    design: Design
    problems: list[str]
    argv: list[str]
    dir: Path

    @property
    def fits(self) -> bool:
        return not self.problems

    def payload(self) -> dict[str, Any]:
        d = self.design
        return {
            "id": self.id, "variant": self.variant, "summary": d.summary(), "problems": self.problems,
            "fits": self.fits, "cmd": ("uv run build.py " + " ".join(shlex.quote(a) for a in self.argv)).strip(),
            "tilt": d.deck.tilt_deg, "tent": d.deck.tent_deg, "ball_r": d.ball.r,
            "floor_z": d.z_floor_bottom, "footprint": tuple(round(x, 1) for x in d.footprint[:2]),
            "height": round(d.ball.r - d.z_floor_bottom, 1), "values": self.values,
        }


class DesignService:
    def __init__(self, out_dir: Path):
        self.out = out_dir

    @staticmethod
    def design_id(values: dict[str, Any]) -> str:
        v = options.coerce(values)
        digest = hashlib.sha1(json.dumps(v, sort_keys=True).encode()).hexdigest()[:8]
        return f"{options.variant_name(v)}-{digest}"

    def load(self, did: str) -> DesignResult | None:
        p = self.out / did / "design.json"
        if not p.exists():
            return None
        return self.prepare(json.loads(p.read_text()), write=False)

    def prepare(self, values: dict[str, Any], write: bool = True) -> DesignResult:
        """Validate (ValueError on bad values) and write SCAD files when the design fits."""
        v = options.coerce(values)
        d = options.make_design(v)
        problems = d.validate()
        did = self.design_id(v)
        out = self.out / did
        res = DesignResult(did, options.variant_name(v), v, d, problems, options.to_argv(v), out)
        if write:
            out.mkdir(parents=True, exist_ok=True)
            (out / "design.json").write_text(json.dumps(v, indent=1, sort_keys=True))
            if not problems:
                self._write_parts(res)
        return res

    def _write_parts(self, res: DesignResult) -> None:
        d = res.design
        for name, build in PART_BUILDERS.items():
            if name == "palmrest" and d.deck.palm_length <= 0:
                continue
            scad = res.dir / f"{name}.scad"
            if scad.exists():
                continue
            text = scad_render(build(d))
            scad.write_text(text)
            (res.dir / f"{name}.hash").write_text(hashlib.sha1(text.encode()).hexdigest()[:12])

    def part_names(self, did: str) -> list[str]:
        return [n for n in PART_BUILDERS if (self.out / did / f"{n}.scad").exists()]
