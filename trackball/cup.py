"""The ball cup: cavity, ball supports, lens window, carrier inserts."""
from __future__ import annotations

import warnings

from solid2 import cylinder, hull, sphere, union

from .common import (EPS, place_on_ball, polar, rounded_rect, support_frames,
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

    # --- outer body: hull of a wide base disk and the dome ring at the rim
    # the straight skirt must be at least as tall as the insert holes
    base = zcyl(c.base_dia, z_bot, z_bot + c.insert_depth + 1.5, fn)
    # the hull overshoots the rim by 1 mm so the opening cut leaves no coplanar faces
    top = zcyl(2 * dome_r, -c.base_top_below_center, z_rim + 1.0, fn)
    body = hull()(base, top)

    # --- cavity + opening
    cavity = sphere(r=d.cavity_r, _fn=fn)
    opening = zcyl(2 * d.cavity_r + 2 * c.wall + 2, z_rim, R + 10, fn)

    # --- lens window: open rectangle under the ball, straight through the floor
    ww, wl = lens_window_size(d)
    window = rounded_rect(ww, wl, d.lens.corner_r + d.lens.clearance,
                          (-c.base_top_below_center) - (z_bot - 1), fn).up(z_bot - 1)

    # --- ball supports
    sup = c.support
    cutters = []
    for az, pol in support_frames(c.support_count, c.support_polar_deg, c.support_azimuth_deg):
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
        x, y = polar(c.carrier_screw_radius, ang)
        inserts.append(zcyl(c.insert_dia, z_bot - EPS, z_bot + c.insert_depth, fn).translate([x, y, 0]))

    return body - cavity - opening - window - union()(*cutters) - union()(*inserts)


def supports_preview(d: Design):
    """Visual models of the supports in place (assembly view only)."""
    c = d.cup
    parts = []
    for az, pol in support_frames(c.support_count, c.support_polar_deg, c.support_azimuth_deg):
        p = c.support.preview(d.fn)
        if p is not None:
            parts.append(place_on_ball(p, d.ball.r, c.support.contact_height, az, pol))
    return union()(*parts) if parts else None
