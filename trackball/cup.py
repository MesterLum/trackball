"""The ball cup: cavity, ball supports, lens window, carrier inserts."""
from __future__ import annotations

import warnings

from solid2 import circle, cube, cylinder, hull, intersection, offset, rotate_extrude, sphere, square, union

from .common import (EPS, place_on_ball, polar, rounded_rect, rounded_slab, support_frames,
                     support_lowest_z, zcyl)
from .config import Design


def lens_window_size(d: Design) -> tuple[float, float]:
    c = d.lens.clearance
    return d.lens.width + 2 * c, d.lens.length + 2 * c


def cup(d: Design):
    fn = d.fn
    c = d.cup
    R = d.ball.r
    z_bot = d.z_cup_bottom
    z_rim = -c.rim_below_center
    dome_r = d.cavity_r + c.wall

    # --- outer body. The straight skirt must be at least as tall as the insert holes.
    base = zcyl(d.skirt_dia, z_bot, z_bot + c.insert_depth + 1.5, fn)
    rr = min(c.round, c.wall - 0.5) if c.round > 0 else 0.0
    if c.shape == "cone":
        if rr > 0:
            # torus whose top is tangent to the rim plane: the cone's top edge comes out rounded
            ring = rotate_extrude(_fn=fn)(circle(r=rr, _fn=fn // 2).translate([dome_r - rr, z_rim - rr]))
            body = hull()(base, ring)
        else:
            top = zcyl(2 * dome_r, -c.base_top_below_center, z_rim + 1.0, fn)
            body = hull()(base, top)
    elif c.shape == "dome":
        # lathe of the shell profile (radial x, height y) clipped at the rim, outer top corner rounded
        big = 4 * dome_r
        prof = intersection()(circle(r=dome_r, _fn=fn), square([big, big]).translate([0, z_rim - big]))
        if rr > 0:
            prof = offset(r=rr, _fn=fn // 2)(offset(r=-rr, _fn=fn // 2)(prof))
        body = hull()(base, rotate_extrude(_fn=fn)(prof))
    else:  # block
        side = 2 * dome_r
        blk = rounded_slab(side, side, 7.0, z_rim - z_bot, rr, fn).up(z_bot)
        body = hull()(base, blk)

    # --- cavity + opening above the rim
    cavity = sphere(r=d.cavity_r, _fn=fn)
    big = 2 * d.skirt_dia
    opening = cube([big, big, R + 20]).translate([-big / 2, -big / 2, z_rim])

    # --- scoops: horizontal cylinders that lower the front/back (dome) or all four sides (block)
    scoops = []
    zc = c.scoop_floor() + c.saddle_r
    for axis in c.scoop_axes:
        cyl = cylinder(r=c.saddle_r, h=big, _fn=fn).translate([0, 0, -big / 2])
        cyl = cyl.rotate([90, 0, 0]) if axis == "y" else cyl.rotate([0, 90, 0])
        scoops.append(cyl.translate([0, 0, zc]))

    # --- lens window: open rectangle under the ball, straight through the floor
    ww, wl = lens_window_size(d)
    window = rounded_rect(ww, wl, d.lens.corner_r + d.lens.clearance,
                          (-c.base_top_below_center) - (z_bot - 1), fn).up(z_bot - 1)

    # --- ball supports
    sup = c.support
    sup.prepare(R, c.support_polar_deg, d.skirt_dia / 2)
    cutters = []
    for az, pol in support_frames(c.support_count, c.support_polar_deg, c.azimuth0):
        cutters.append(place_on_ball(sup.cutter(fn), R, sup.contact_height, az, pol))
    low = support_lowest_z(R, sup.contact_height, c.support_polar_deg,
                           sup.body_reach(), sup.body_radius())
    if low < z_bot + 0.8:
        warnings.warn(
            f"support cutter reaches z={low:.2f} but the cup bottom is at z={z_bot:.2f}; "
            "raise support_polar_deg, shorten the support, or thin the carrier",
            stacklevel=2,
        )

    # --- heat-set inserts for the carrier screws (from below)
    inserts = []
    for ang in c.carrier_screw_angles:
        x, y = polar(c.screw_radius(R), ang)
        inserts.append(zcyl(c.insert_dia, z_bot - EPS, z_bot + c.insert_depth, fn).translate([x, y, 0]))

    result = body - cavity - opening - window - union()(*cutters) - union()(*inserts)
    if scoops:
        result = result - union()(*scoops)
    return result


def supports_preview(d: Design):
    """Visual models of the supports in place (assembly view only)."""
    c = d.cup
    c.support.prepare(d.ball.r, c.support_polar_deg, d.skirt_dia / 2)
    parts = []
    for az, pol in support_frames(c.support_count, c.support_polar_deg, c.azimuth0):
        p = c.support.preview(d.fn)
        if p is not None:
            parts.append(place_on_ball(p, d.ball.r, c.support.contact_height, az, pol))
    return union()(*parts) if parts else None
