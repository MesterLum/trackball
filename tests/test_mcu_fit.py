"""Physical clearance regressions for horizontal MCUs in sloping trays."""
from itertools import product

import pytest

from trackball.config import MCUS
from trackball import options
from trackball.tray import mcu_point, mcu_pose, tray, usb_cutout
from solid2 import scad_render


@pytest.mark.parametrize('mcu,usb,place,angles', tuple(product(
    ('pico', 'rp2040-zero', 'nice-nano'), ('right', 'left', 'back'),
    ('behind', 'under'), ((0, 0), (15, 12), (-15, -12)))))
def test_mount_stops_at_actual_wall(mcu, usb, place, angles):
    d = options.make_design(dict(mcu=mcu, usb=usb, mcu_place=place,
                                 tilt=angles[0], tent=angles[1], padding=30))
    axis, sign = (1, 1) if usb == 'back' else (0, -1 if usb == 'left' else 1)
    limit = (d.back_length if axis else d.half_width) - d.tray.wall
    gaps = [limit - sign * d.world_to_deck(p)[axis] for p in d.mcu_mount_corners()]
    assert min(gaps) == pytest.approx(0.3, abs=1e-6)
    # The entire component stack must remain below the lid underside.
    mx, my, z = mcu_pose(d)
    z += d.tray.mcu.thickness + max(d.tray.mcu.component_height, d.usb_z_offset + d.usb_height) + d.tray.clearance
    sx, sy = d.mcu_xy_size
    assert max(d.world_to_deck((mx + x, my + y, z))[2]
               for x in (-sx/2, sx/2) for y in (-sy/2, sy/2)) <= d.z_pcb_face + 1e-5


@pytest.mark.parametrize('name', MCUS)
def test_every_board_autofits_all_usb_walls(name):
    for usb in ('right', 'left', 'back'):
        v, _ = options.autofit(dict(mcu=name, usb=usb, tilt=10, tent=-8))
        d = options.make_design(v)
        assert d.validate() == [], (name, usb, d.validate())
        assert d.mcu_fit_deficit() <= 0.01


def test_small_board_connector_is_no_longer_recessed_inside_wall():
    d = options.make_design({'mcu': 'rp2040-zero'})
    x, _ = mcu_point(d, d.tray.mcu.length / 2, 0)
    assert d.inner_half_width - x == pytest.approx(0.3)
    nose_x, _ = mcu_point(d, d.tray.mcu.length / 2 + d.tray.mcu.usb_overhang, 0)
    assert nose_x > d.inner_half_width


@pytest.mark.parametrize('name,kind', [('pico', 'micro-usb'), ('pico-w', 'micro-usb'),
    ('pico2', 'micro-usb'), ('pro-micro', 'micro-usb'), ('rp2040-zero', 'usb-c'),
    ('xiao', 'usb-c'), ('nice-nano', 'usb-c'), ('supermini', 'usb-c')])
def test_connector_defaults_and_overrides(name, kind):
    assert options.make_design({'mcu': name}).usb_kind == kind
    for override in ('micro-usb', 'usb-c'):
        values = dict(mcu=name, usb_type=override)
        d = options.make_design(values)
        assert d.usb_kind == override
        assert '--usb-type' in options.to_argv(values)
        assert override in options.variant_name(values)
        # Both profiles generate valid SCAD and change the resulting cutout.
        assert 'linear_extrude' in scad_render(usb_cutout(d))
    assert scad_render(tray(options.make_design(dict(mcu=name, usb_type='micro-usb')))) != scad_render(tray(options.make_design(dict(mcu=name, usb_type='usb-c'))))


def test_verified_board_outlines():
    assert (MCUS['xiao'].length, MCUS['xiao'].width) == (21, 17.8)
    assert (MCUS['pro-micro'].length, MCUS['pro-micro'].width) == (33.02, 17.78)


def test_left_usb_rotates_asymmetric_board_points_with_preview():
    d = options.make_design({'usb': 'left'})
    x, y, _ = mcu_pose(d)
    assert mcu_point(d, 13, -3.5) == (x - 13, y + 3.5)
