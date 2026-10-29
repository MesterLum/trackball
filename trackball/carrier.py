"""Sensor carrier / lid.

This is the only printed part that knows the sensor PCB's hole pattern.
To use a different PMW3360 breakout later, change ``SensorPCB`` (or write a
new ``pcb_features`` function) and reprint only this part.
"""
from __future__ import annotations

from solid2 import cube, cylinder, union

from .common import EPS, polar, rounded_rect, zcyl
from .config import Design
from .cup import lens_window_size
from .tray import lid_screw_points, mcu_center


def pcb_features(d: Design):
    """Cutters specific to the Bastardkb PMW3360 PCB: two M3 inserts."""
    fn = d.fn
    cr = d.carrier
    z0 = d.z_pcb_face
    cuts = []
    for sy in (-1, 1):
        y = sy * d.pcb.hole_spacing / 2
        cuts.append(zcyl(cr.pcb_insert_dia, z0 - EPS, z0 + cr.pcb_insert_depth, fn).translate([0, y, 0]))
    return union()(*cuts)


def switch_cutters(d: Design):
    """Plate cutout plus a relief pocket from below so the clips can snap on a
    plate thicker than the switch expects."""
    sw = d.switches
    if not sw.count:
        return None
    st = sw.type
    z0, z1 = d.z_pcb_face, d.z_carrier_top
    cuts = []
    for x, y in sw.positions(d.cup.base_dia):
        hole = cube([st.cutout, st.cutout, z1 - z0 + 2], center=True).translate([0, 0, (z0 + z1) / 2])
        pocket = cube([st.pocket, st.pocket, (z1 - st.plate_t) - (z0 - 1)]).translate(
            [-st.pocket / 2, -st.pocket / 2, z0 - 1])
        cuts.append((hole + pocket).translate([x, y, 0]))
    return union()(*cuts).rotate([0, 0, sw.rotate_deg])


def carrier(d: Design):
    fn = d.fn
    cr = d.carrier
    z0, z1 = d.z_pcb_face, d.z_carrier_top
    w, l, cx, cy = d.footprint

    plate = rounded_rect(w, l, cr.corner_r, z1 - z0, fn).up(z0).translate([cx, cy, 0])

    # lens opening (same outline as the cup window, straight through)
    ww, wl = lens_window_size(d)
    lens = rounded_rect(ww, wl, d.lens.corner_r + d.lens.clearance, z1 - z0 + 2, fn).up(z0 - 1)

    # cup screws: clearance + counterbore from below
    cup_screws = []
    for ang in d.cup.carrier_screw_angles:
        x, y = polar(d.cup.carrier_screw_radius, ang)
        hole = zcyl(cr.screw_clear_dia, z0 - 1, z1 + 1, fn)
        cb = zcyl(cr.cup_screw_head_dia, z0 - EPS, z0 + cr.cup_screw_head_depth, fn)
        cup_screws.append((hole + cb).translate([x, y, 0]))

    # lid screws into the tray posts: clearance + counterbore from the top
    lid_screws = []
    for x, y in lid_screw_points(d):
        hole = zcyl(cr.screw_clear_dia, z0 - 1, z1 + 1, fn)
        cb = zcyl(cr.cup_screw_head_dia, z1 - cr.cup_screw_head_depth, z1 + EPS, fn)
        lid_screws.append((hole + cb).translate([x, y, 0]))

    # BOOTSEL / reset access hole above the MCU
    extras = []
    mcu = d.tray.mcu
    if mcu.bootsel is not None:
        mx, my = mcu_center(d)
        bx, by = mcu.bootsel
        extras.append(zcyl(cr.bootsel_hole_dia, z0 - 1, z1 + 1, fn).translate([mx + bx, my + by, 0]))

    sw = switch_cutters(d)
    if sw is not None:
        extras.append(sw)

    return (plate - lens - union()(*cup_screws) - union()(*lid_screws)
            - pcb_features(d) - union()(*extras))
