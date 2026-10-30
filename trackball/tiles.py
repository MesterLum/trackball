"""Sculpted tile keys around the ball (ProtoArc EM06 style), placement "tiles".

The lid top is divided into large wedge keys that fill the deck around the
cup: one per side (4), the front and back split in two (6) or three (8), or
just the two sides (2). The solid spokes between the tiles run from the ring
around the cup to the corner screw bosses and keep the lid stiff. Each tile
is a flexure paddle printed into the lid: a through slot frees it on three
sides, a thinned groove along the body edge is the hinge, and a holder block
hanging from the ring carries an Omron D2F style microswitch under the tile,
near the ball, where the finger lands.

Everything here is in the deck frame with the ball at the origin.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from solid2 import circle, cube, linear_extrude, offset, polygon, square, union

from .common import EPS, zcyl
from .config import Design

SIDES = {"right": 0.0, "back": 90.0, "left": 180.0, "front": 270.0}
TILE_COUNTS = (2, 4, 6, 8)
TILE_DEPTH_MIN = 18.0            # radial room a tile needs between the ring and the hinge


@dataclass(frozen=True)
class Tile:
    side: str
    a0: float                    # angular range (deg, ccw)
    a1: float
    x: float                     # plunger / microswitch position
    y: float
    inward: float                # direction from the plunger toward the ball (deg)


def segments_per_side(count: int) -> dict[str, int]:
    if count == 2:
        return {"left": 1, "right": 1}
    k = {4: 1, 6: 2, 8: 3}[count]
    return {"front": k, "back": k, "left": 1, "right": 1}


def ring_radius(d: Design) -> float:
    return d.skirt_dia / 2 + d.switches.tile_ring


def plunger_radius(d: Design) -> float:
    return ring_radius(d) + d.switches.tile_slot + d.switches.type.plunger_inset


def tile_depth(d: Design) -> float:
    """Radial room at mid-side between the ring and the hinge line."""
    return d.half_width - d.switches.tile_frame - ring_radius(d)


def tiles(d: Design) -> list[Tile]:
    sw = d.switches
    if sw.placement != "tiles" or sw.count not in TILE_COUNTS:
        return []
    hw, hl = d.half_width, d.half_length
    c = math.degrees(math.atan2(hl, hw))      # corner angle, 45° on a square body
    half_span = {"right": c, "left": c, "back": 90.0 - c, "front": 90.0 - c}
    r_p = plunger_radius(d)
    out = []
    for side, k in segments_per_side(sw.count).items():
        mid, hs = SIDES[side], half_span[side]
        a0, a1 = mid - hs, mid + hs
        for j in range(k):
            b0 = a0 + (a1 - a0) * j / k
            b1 = a0 + (a1 - a0) * (j + 1) / k
            am = (b0 + b1) / 2
            x, y = r_p * math.cos(math.radians(am)), r_p * math.sin(math.radians(am))
            out.append(Tile(side, b0, b1, x, y, (am + 180.0) % 360.0))
    return out


def positions(d: Design) -> list[tuple[float, float, float]]:
    """(x, y, inward angle) of every microswitch plunger, like Switches.positions."""
    return [(t.x, t.y, t.inward) for t in tiles(d)]


def holder_reach(d: Design) -> float:
    st = d.switches.type
    return (st.body[0] + 2 * st.holder_wall + 0.3) / 2 + 1.0


def holder_boxes(d: Design) -> list[tuple[float, float, float, float]]:
    """Deck-frame XY boxes (x0, x1, y0, y1) around the holder blocks, for clash checks."""
    r = holder_reach(d)
    return [(t.x - r, t.x + r, t.y - r, t.y + r) for t in tiles(d)]


# ---- 2D construction -------------------------------------------------------
def _sector(a0: float, a1: float, R: float):
    n = max(2, int((a1 - a0) / 5) + 1)
    pts = [[0.0, 0.0]] + [[R * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
                          R * math.sin(math.radians(a0 + (a1 - a0) * i / n))] for i in range(n + 1)]
    return polygon(pts)


def _hinge_line(side: str, d: Design) -> tuple[str, float]:
    """(axis, coordinate) of the hinge line: the lid edge inset by the frame width."""
    f = d.switches.tile_frame
    return {"front": ("y", -(d.half_length - f)), "back": ("y", d.half_length - f),
            "left": ("x", -(d.half_width - f)), "right": ("x", d.half_width - f)}[side]


def _band(side: str, d: Design, half: float):
    """Strip 2*half wide centred on the hinge line, spanning the whole lid."""
    axis, c = _hinge_line(side, d)
    big = 4 * max(d.half_width, d.half_length)
    if axis == "y":
        return square([big, 2 * half], center=True).translate([0, c])
    return square([2 * half, big], center=True).translate([c, 0])


def _frame_region(side: str, d: Design):
    """The lid beyond the hinge line (stays full thickness)."""
    axis, c = _hinge_line(side, d)
    big = 4 * max(d.half_width, d.half_length)
    outward = 1 if c > 0 else -1
    if axis == "y":
        return square([big, big]).translate([-big / 2, c if outward > 0 else c - big])
    return square([big, big]).translate([c if outward > 0 else c - big, -big / 2])


def _mirror_about_hinge(obj, side: str, d: Design):
    axis, c = _hinge_line(side, d)
    if axis == "y":
        return obj.translate([0, -c]).mirror([0, 1]).translate([0, c])
    return obj.translate([-c, 0]).mirror([1, 0]).translate([c, 0])


def tile_cutters(d: Design):
    """(cutters, holders, holder_cutters) for the whole lid: subtract the first,
    add the holders, subtract the last (same protocol as the paddles)."""
    sw, st, cr = d.switches, d.switches.type, d.carrier
    fn = d.fn
    z0, z1 = d.z_pcb_face, d.z_carrier_top
    hw, hl = d.half_width, d.half_length
    w, l, cx, cy = d.footprint
    s, gap, f = sw.tile_slot, sw.tile_gap, sw.tile_frame
    R = 3 * max(hw, hl)

    lid2d = offset(r=cr.corner_r, _fn=fn)(square([w - 2 * cr.corner_r, l - 2 * cr.corner_r], center=True)).translate([cx, cy])
    inner2d = offset(delta=-f)(lid2d)
    ring2d = circle(r=ring_radius(d), _fn=fn)
    bosses2d = union()(*[circle(r=cr.screw_head_dia / 2 + 1.5, _fn=fn).translate([x, y])
                         for x, y in d.lid_screw_points()])

    # holder block in the tile's local frame: plunger at the origin, +X toward the ball
    bl, bw, bh = st.body
    bar_w = bw + 2 * st.holder_wall + 0.3
    bar_len = bl + 2 * st.holder_wall + 0.3
    bar_top = z1 - st.paddle_t - st.paddle_gap
    body_top = z1 - st.paddle_t - st.plunger_h
    bar_bot = body_top - bh
    x_end = (plunger_radius(d) - ring_radius(d)) + 1.5        # stem reaches 1.5 mm into the ring
    bar = cube([bar_w, bar_len, bar_top - bar_bot]).translate([-bar_w / 2, -bar_len / 2, bar_bot])
    stem = cube([x_end + bar_w / 2, 10.0, bar_top - bar_bot]).translate([-bar_w / 2, -5.0, bar_bot])
    body_cy = -(bl / 2 - st.plunger_from_end)
    pocket = cube([bw + 0.3, bl + 0.3, body_top - bar_bot + 1]).translate(
        [-(bw + 0.3) / 2, body_cy - (bl + 0.3) / 2, bar_bot - 1])
    plunger = zcyl(st.plunger_dia + 0.8, body_top - EPS, bar_top + EPS, fn)
    holder_local = bar + stem
    holder_cut_local = pocket + plunger

    cutters, holders, after = [], [], []
    for t in tiles(d):
        core = offset(delta=-gap / 2)(_sector(t.a0, t.a1, R))
        tile2d = ((core * inner2d) - ring2d) - bosses2d
        around = offset(r=s, _fn=max(8, fn // 4))(tile2d)
        band = _band(t.side, d, st.hinge_len / 2)
        # the slot runs 0.5 mm into the groove and the groove is 0.3 mm wider than the slot, so
        # the two cuts overlap instead of meeting face to face (keeps the CGAL result manifold)
        slot2d = (around - tile2d) - _band(t.side, d, st.hinge_len / 2 - 0.5)
        thin2d = around - _frame_region(t.side, d)
        groove2d = (offset(delta=s + 0.3)(tile2d + _mirror_about_hinge(tile2d, t.side, d)) * band) - offset(r=0.3, _fn=8)(bosses2d)
        cutters.append(linear_extrude(z1 - z0 + 4)(slot2d).up(z0 - 2))
        cutters.append(linear_extrude((z1 - st.paddle_t) - (z0 - 1))(thin2d).up(z0 - 1))
        cutters.append(linear_extrude((z1 - st.hinge_t) - (z0 - 1))(groove2d).up(z0 - 1))
        holders.append(holder_local.rotate([0, 0, t.inward]).translate([t.x, t.y, 0]))
        after.append(holder_cut_local.rotate([0, 0, t.inward]).translate([t.x, t.y, 0]))
    return union()(*cutters), union()(*holders), union()(*after)
