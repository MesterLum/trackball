"""Sensor carrier / lid (deck frame).

This is the only printed part that knows the sensor PCB's hole pattern.
To use a different PMW3360 breakout later, change ``SensorPCB`` (or write a
new ``pcb_features`` function) and reprint only this part.

It also carries the click buttons: plate cutouts for key switches, or
flexure paddles with a microswitch holder bar for the "micro" type.
Buttons are built in a local frame with the ball toward +X, then rotated to
their row's inward angle.
"""
from __future__ import annotations

from solid2 import cube, cylinder, union

from .common import EPS, polar, rounded_rect, rounded_slab, zcyl
from .config import Design
from .cup import lens_window_size
from .tray import bootsel_deck_xy, lid_screw_points


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


def _box(x0, x1, y0, y1, z0, z1):
    return cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])


def _place(obj, x, y, ang):
    return obj.rotate([0, 0, ang]).translate([x, y, 0])


# ---- key switches (Choc / MX) ---------------------------------------------
def key_switch_cutters(d: Design):
    """Plate cutout plus a relief pocket from below so the clips can snap on a
    plate thicker than the switch expects."""
    sw, st = d.switches, d.switches.type
    z0, z1 = d.z_pcb_face, d.z_carrier_top
    cuts = []
    for x, y, _ in d.switch_positions():
        hole = cube([st.cutout, st.cutout, z1 - z0 + 2], center=True).translate([x, y, (z0 + z1) / 2])
        pocket = _box(-st.pocket / 2, st.pocket / 2, -st.pocket / 2, st.pocket / 2,
                      z0 - 1, z1 - st.plate_t).translate([x, y, 0])
        cuts.append(hole + pocket)
    return union()(*cuts)


# ---- microswitch paddles ----------------------------------------------------
def micro_geometry_local(d: Design):
    """(cutters_before, holder_bar, cutters_after) for one paddle at the
    origin, tip pointing +X (toward the ball), hinge at -X.

    The paddle is part of the lid: a U-shaped slot frees three sides, a thin
    bridge at the outer edge is the hinge, and a bar under the paddle tip
    holds the microswitch.
    """
    st = d.switches.type
    z0, z1 = d.z_pcb_face, d.z_carrier_top
    Lp, Wp = st.size_in, d.switches.size_across
    s = st.paddle_slot
    x_tip, x_h = Lp / 2, -Lp / 2

    # 1. U slot through the lid (three sides, hinge side stays)
    outer = _box(-Lp / 2 - s, Lp / 2 + s, -Wp / 2 - s, Wp / 2 + s, z0 - 1, z1 + 1)
    inner = _box(-Lp / 2, Lp / 2, -Wp / 2, Wp / 2, z0 - 2, z1 + 2)
    hinge_strip = _box(x_h - s - 1, x_h, -Wp / 2 - s - 1, Wp / 2 + s + 1, z0 - 2, z1 + 2)
    slot = outer - inner - hinge_strip

    # 2. thin the paddle from below, the hinge bridge even more
    thin = _box(-Lp / 2 - s, Lp / 2 + s, -Wp / 2 - s, Wp / 2 + s, z0 - 1, z1 - st.paddle_t)
    groove = _box(x_h - st.hinge_len / 2, x_h + st.hinge_len / 2, -Wp / 2 - s, Wp / 2 + s, z0 - 1, z1 - st.hinge_t)

    # 3. holder bar across, under the paddle tip, anchored in solid lid on both sides
    bl, bw, bh = st.body
    x_p = x_tip - st.plunger_inset
    bar_w = bw + 2 * st.holder_wall + 0.3
    bar_len = Wp + 2 * s + 2 * 6.0
    bar_top = z1 - st.paddle_t - st.paddle_gap
    body_top = z1 - st.paddle_t - st.plunger_h     # plunger just touches the paddle at rest
    bar_bot = body_top - bh
    bar = _box(x_p - bar_w / 2, x_p + bar_w / 2, -bar_len / 2, bar_len / 2, bar_bot, bar_top)

    # 4. microswitch pocket in the bar (open at the bottom) + plunger hole
    body_cy = -(bl / 2 - st.plunger_from_end)
    pocket = _box(x_p - (bw + 0.3) / 2, x_p + (bw + 0.3) / 2,
                  body_cy - (bl + 0.3) / 2, body_cy + (bl + 0.3) / 2, bar_bot - 1, body_top)
    plunger = zcyl(st.plunger_dia + 0.8, body_top - EPS, bar_top + EPS, d.fn).translate([x_p, 0, 0])
    return slot + thin + groove, bar, pocket + plunger


def micro_switch_parts(d: Design):
    before, bars, after = [], [], []
    for x, y, ang in d.switch_positions():
        b, bar, a = micro_geometry_local(d)
        before.append(_place(b, x, y, ang))
        bars.append(_place(bar, x, y, ang))
        after.append(_place(a, x, y, ang))
    return union()(*before), union()(*bars), union()(*after)


# ---- the lid ---------------------------------------------------------------
def carrier(d: Design):
    fn = d.fn
    cr = d.carrier
    z0, z1 = d.z_pcb_face, d.z_carrier_top
    w, l, cx, cy = d.footprint

    plate = rounded_slab(w, l, cr.corner_r, z1 - z0, cr.edge_round, fn).up(z0).translate([cx, cy, 0])

    cuts = []
    # lens opening (same outline as the cup window, straight through)
    ww, wl = lens_window_size(d)
    cuts.append(rounded_rect(ww, wl, d.lens.corner_r + d.lens.clearance, z1 - z0 + 2, fn).up(z0 - 1))

    # cup screws: clearance + counterbore from below
    for ang in d.cup.carrier_screw_angles:
        x, y = polar(d.cup.screw_radius(d.ball.r), ang)
        hole = zcyl(cr.screw_clear_dia, z0 - 1, z1 + 1, fn)
        cb = zcyl(cr.screw_head_dia, z0 - EPS, z0 + cr.screw_head_depth, fn)
        cuts.append((hole + cb).translate([x, y, 0]))

    # lid screws into the tray posts: clearance + counterbore from the top
    for x, y in lid_screw_points(d):
        hole = zcyl(cr.screw_clear_dia, z0 - 1, z1 + 1, fn)
        cb = zcyl(cr.screw_head_dia, z1 - cr.screw_head_depth, z1 + EPS, fn)
        cuts.append((hole + cb).translate([x, y, 0]))

    # BOOTSEL / reset access hole above the MCU
    bs = bootsel_deck_xy(d)
    if bs is not None:
        cuts.append(zcyl(cr.bootsel_hole_dia, z0 - 1, z1 + 1, fn).translate([bs[0], bs[1], 0]))

    cuts.append(pcb_features(d))

    body = plate - union()(*cuts)

    if d.switches.is_tiles:
        from .tiles import tile_cutters
        before, bars, after = tile_cutters(d)
        body = (body - before) + bars - after
    elif d.switches.count:
        if d.switches.type.kind == "key":
            body = body - key_switch_cutters(d)
        else:
            before, bars, after = micro_switch_parts(d)
            body = (body - before) + bars - after
    return body
