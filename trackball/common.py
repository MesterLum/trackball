"""Small geometry helpers shared by the parts."""
from __future__ import annotations

import math

from solid2 import cube, cylinder, hull, linear_extrude, offset, sphere, square

EPS = 0.01


def rounded_rect(w: float, l: float, r: float, h: float, fn: int, center_z: bool = False):
    """Rounded rectangle prism centred on XY, from z=0 up (or centred)."""
    r = min(r, w / 2 - EPS, l / 2 - EPS)
    prism = linear_extrude(h)(
        offset(r=r, _fn=fn)(square([w - 2 * r, l - 2 * r], center=True))
    )
    return prism.down(h / 2) if center_z else prism


def rounded_slab(w: float, l: float, corner_r: float, h: float, edge_r: float, fn: int):
    """Rounded-rectangle slab from z=0 to h whose TOP perimeter edge is rounded
    with ``edge_r`` (hull of four cylinders and four spheres). edge_r=0 gives
    a plain rounded_rect."""
    if edge_r <= 0:
        return rounded_rect(w, l, corner_r, h, fn)
    r = max(corner_r, edge_r + 0.5)
    r = min(r, w / 2 - EPS, l / 2 - EPS)
    e = min(edge_r, h - EPS, r - EPS)
    parts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * (w / 2 - r), sy * (l / 2 - r)
            parts.append(cylinder(r=r, h=h - e, _fn=fn).translate([cx, cy, 0]))
            # a ring of the corner radius at the top, rounded by the sphere radius
            parts.append(cylinder(r=r - e, h=EPS, _fn=fn).translate([cx, cy, h - EPS]))
            for k in range(0, 360, 30):
                a = math.radians(k)
                parts.append(sphere(r=e, _fn=max(12, fn // 4)).translate([cx + (r - e) * math.cos(a), cy + (r - e) * math.sin(a), h - e]))
    return hull()(*parts)


def zcyl(d: float, z0: float, z1: float, fn: int):
    """Vertical cylinder between two absolute Z levels."""
    return cylinder(d=d, h=z1 - z0, _fn=fn).up(z0)


def polar(radius: float, angle_deg: float) -> tuple[float, float]:
    a = math.radians(angle_deg)
    return radius * math.cos(a), radius * math.sin(a)


def support_frames(count: int, polar_deg: float, azimuth0_deg: float):
    """(azimuth, polar) pairs for evenly spaced supports."""
    return [((azimuth0_deg + 360.0 * i / count) % 360.0, polar_deg) for i in range(count)]


def place_on_ball(obj, ball_r: float, seat_offset: float, azimuth_deg: float, polar_deg: float):
    """Move an object defined in a support's local frame (origin at seat point,
    +Z toward the ball centre) onto the ball.

    The seat point ends up at distance ``ball_r + seat_offset`` from the ball
    centre, in direction (azimuth, polar) where polar is measured from -Z.
    """
    dist = ball_r + seat_offset
    th = math.radians(polar_deg)
    ph = math.radians(azimuth_deg)
    seat = (dist * math.sin(th) * math.cos(ph),
            dist * math.sin(th) * math.sin(ph),
            -dist * math.cos(th))
    # +Z -> rotate about Y by -polar -> (-sin th, 0, cos th) -> rotate about Z by azimuth
    return obj.rotate([0, -polar_deg, 0]).rotate([0, 0, azimuth_deg]).translate(seat)


def to_world(obj, deck):
    """Deck frame -> world frame (tilt about X, then tent about Y)."""
    return obj.rotate([deck.tilt_deg, 0, 0]).rotate([0, deck.tent_deg, 0])


def half_space_above(z: float, size=(600.0, 600.0), center=(0.0, 0.0), height: float = 600.0):
    """Box whose bottom face is at world z (for intersections). Keep it only as
    big as needed: OpenSCAD's --viewall frames every primitive, even the
    operands of an intersection."""
    sx, sy = size
    return cube([sx, sy, height]).translate([center[0] - sx / 2, center[1] - sy / 2, z])


def support_lowest_z(ball_r: float, seat_offset: float, polar_deg: float,
                     reach: float, radius: float) -> float:
    """Lowest Z touched by a support cutter (for sanity checks)."""
    th = math.radians(polar_deg)
    axis_end = ball_r + seat_offset + reach
    return -axis_end * math.cos(th) - radius * math.sin(th)
