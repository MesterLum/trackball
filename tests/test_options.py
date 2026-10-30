from __future__ import annotations

import pytest

from trackball import options
from trackball.presets import PRESETS


def test_defaults_round_trip_to_empty_argv():
    assert options.to_argv(options.defaults()) == []


def test_argv_reproduces_values():
    v = {"tilt": 10, "switch_type": "mx", "switches": 2, "keycap_u": 1.5, "palm": 40, "battery": "50x34x5"}
    assert options.to_argv(v) == ["--switches", "2", "--switch-type", "mx", "--keycap-u", "1.5",
                                  "--battery", "50x34x5", "--tilt", "10", "--palm", "40"]


def test_coerce_casts_and_checks_ranges():
    v = options.coerce({"ball": "44", "switches": "2", "no_mirror": "true"})
    assert v["ball"] == 44.0 and v["switches"] == 2 and v["no_mirror"] is True
    with pytest.raises(ValueError):
        options.coerce({"ball": 5})
    with pytest.raises(ValueError):
        options.coerce({"support": "nope"})
    with pytest.raises(ValueError):
        options.coerce({"battery": "50x34"})


def test_every_preset_validates():
    for p in PRESETS:
        d = options.make_design(p.values)
        assert d.validate() == [], p.key


def test_cli_parser_matches_registry():
    from build import build_parser
    args = build_parser().parse_args(["--ball", "44", "--mcu-place", "under", "--palm-pad", "2"])
    assert args.ball == 44.0 and args.mcu_place == "under" and args.palm_pad == 2.0
