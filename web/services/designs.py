"""Turn option values into a validated Design plus its SCAD files on disk."""
from __future__ import annotations

import hashlib
import json
import shlex
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from solid2 import scad_render

from trackball import options
from trackball.carrier import carrier
from trackball.config import Design
from trackball.cup import cup
from trackball.palmrest import palm_key, palmrest
from trackball.tray import tray

PART_BUILDERS = {"cup": cup, "carrier": carrier, "tray": tray, "palmrest": palmrest, "palm_key": palm_key}


@lru_cache(maxsize=1)
def geometry_revision() -> str:
    """Invalidate saved designs after a CAD source change / server reload."""
    digest = hashlib.sha256()
    root = Path(options.__file__).resolve().parent
    for path in sorted(root.rglob("*.py")):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


@dataclass
class DesignResult:
    id: str
    variant: str
    values: dict[str, Any]
    design: Design
    problems: list[str]
    argv: list[str]
    dir: Path
    adjusted: list[dict] | None = None

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
            "fn": self.values["fn"], "bom": d.bom(), "adjusted": self.adjusted or [],
        }


class DesignService:
    def __init__(self, out_dir: Path, fn_tiers: dict[str, int] | None = None):
        self.out = out_dir
        self.fn_tiers = fn_tiers or {}

    @staticmethod
    def design_id(values: dict[str, Any]) -> str:
        v = options.coerce(values)
        digest = hashlib.sha1((geometry_revision() + json.dumps(v, sort_keys=True)).encode()).hexdigest()[:8]
        return f"{options.variant_name(v)}-{digest}"

    def load(self, did: str) -> DesignResult | None:
        p = self.out / did / "design.json"
        if not p.exists():
            return None
        res = self.prepare(json.loads(p.read_text()), write=False)
        # Older downloads still refer to their original generated files.
        res.id, res.dir = did, p.parent
        return res

    def prepare(self, values: dict[str, Any], write: bool = True, quality: str | None = None,
                autofit: bool = False) -> DesignResult:
        """Validate (ValueError on bad values) and write SCAD files when the design fits.
        ``quality`` ("preview" / "final") overrides $fn with the configured tier.
        ``autofit`` applies the validator's suggested fixes (e.g. more padding) first."""
        v = options.coerce(values)
        adjusted: list[dict] = []
        if autofit:
            v, adjusted = options.autofit(v)
        requested_fn = v["fn"]
        if quality in self.fn_tiers:
            v["fn"] = self.fn_tiers[quality]
        d = options.make_design(v)
        problems = d.validate()
        did = self.design_id(v)
        out = self.out / did
        # the reproducible command keeps the user's $fn, not the preview tier's
        argv = options.to_argv({**v, "fn": requested_fn})
        res = DesignResult(did, options.variant_name(v), v, d, problems, argv, out)
        res.adjusted = adjusted
        if write:
            out.mkdir(parents=True, exist_ok=True)
            (out / "design.json").write_text(json.dumps(v, indent=1, sort_keys=True))
            if not problems:
                self._write_parts(res)
        return res

    def _write_parts(self, res: DesignResult) -> None:
        d = res.design
        for name, build in PART_BUILDERS.items():
            scad = res.dir / f"{name}.scad"
            if scad.exists():
                continue
            shape = build(d)
            if shape is None:
                continue
            text = scad_render(shape)
            scad.write_text(text)
            (res.dir / f"{name}.hash").write_text(hashlib.sha1(text.encode()).hexdigest()[:12])

    def part_names(self, did: str) -> list[str]:
        return [n for n in PART_BUILDERS if (self.out / did / f"{n}.scad").exists()]
