"""Palm rest and detachable/fused joints in front of the body (world frame).

It is built like the tray: a deck-frame prism cut by the desk plane, so its
sides lean the same way as the body and its top continues the (tilted) deck
plane, ``palm_drop`` lower. A shallow recess on top takes a leather/foam pad.
"""
from __future__ import annotations

import math

from solid2 import cube, linear_extrude, multmatrix, offset, square, union

from .common import EPS, half_space_above, rounded_rect, rounded_slab, to_world, zcyl
from .config import Design


def _palm_body(d: Design):
    dk = d.deck
    if dk.palm_length <= 0:
        return None
    fn = d.fn
    w = 2 * d.half_width
    y0, y1 = d.palm_y_range
    cy = (y0 + y1) / 2
    L = y1 - y0
    z_top = d.z_carrier_top - dk.palm_drop
    zf_bot = d.z_floor_bottom

    sag = (w + L + 2 * d.half_length) * (math.sin(math.radians(abs(dk.tilt_deg))) + math.sin(math.radians(abs(dk.tent_deg))))
    tall = (z_top - zf_bot) + sag + 10.0
    # The fused rest has only FRONT corners. Extend the rounded slab into
    # the tray and trim its back square, so the joint has straight side walls.
    rear = 2 * (d.carrier.corner_r + dk.palm_round + 1) if dk.palm_attachment == "fused" else 0
    block = rounded_slab(w, L + rear, d.carrier.corner_r, tall, dk.palm_round, fn).up(z_top - tall).translate([0, cy + rear / 2, 0])
    if rear:
        block *= cube([w + 2, L + 1 + EPS, tall + 2]).translate([-w / 2 - 1, y0 - 1, z_top - tall - 1])
    if dk.palm_pad_recess > 0:
        pad = rounded_rect(w - 2 * dk.palm_pad_inset, L - 2 * dk.palm_pad_inset, 4.0,
                           dk.palm_pad_recess + 1, fn).up(z_top - dk.palm_pad_recess).translate([0, cy, 0])
        block = block - pad
    keep = half_space_above(zf_bot, (w + 2 * sag + 20, L + 2 * sag + 20), (0, cy), tall)
    body = to_world(block, dk) * keep
    # rubber-foot recesses in the bottom, same feet as the tray (world frame, flat floor)
    feet = [zcyl(d.tray.feet_dia, zf_bot - 1, zf_bot + d.tray.feet_depth, fn).translate([fx, fy, 0])
            for fx, fy in d.palm_feet_xy()]
    return body - union()(*feet) if feet else body


# Joint dimensions are millimetres. Tongues print on the bed; their sockets
# open underneath. The separate key snaps into shallow pockets in both bases.
TONGUE_W = 8.0
TONGUE_H = 1.5
JOINT_CLEAR = 0.25
KEY_H = 1.2
KEY_POCKET_H = 1.6


def _floor_shape(d: Design, shape, height: float, lift: float = 0.0):
    """Deck XY projected onto the desk, extruded vertically (flat print base)."""
    ox, oy = d.floor_xy(0, 0)
    xx, xy = d.floor_xy(1, 0)
    yx, yy = d.floor_xy(0, 1)
    matrix = [[xx - ox, yx - ox, 0, ox], [xy - oy, yy - oy, 0, oy],
              [0, 0, 1, d.z_floor_bottom + lift], [0, 0, 0, 1]]
    return multmatrix(matrix)(linear_extrude(height)(shape))


def _joint_centres(d: Design):
    return (-0.45 * d.half_width, 0.45 * d.half_width)


def _tongues(d: Design, clearance=0.0):
    seam = -d.front_length
    return union()(*[_floor_shape(d,
        square([TONGUE_W + 2 * clearance, 9.5 + 2 * clearance], center=True)
        .translate([x, seam + 0.25]), TONGUE_H + clearance + 0.01, -0.01)
        for x in _joint_centres(d)])


def _key_outline(d: Design):
    seam = -d.front_length
    neck = square([6, 16], center=True).translate([0, seam])
    ends = [square([12, 6], center=True).translate([0, seam + sign * 8]) for sign in (-1, 1)]
    return union()(neck, *ends)


def palm_key_socket(d: Design):
    """Open underside pocket and slightly wider upper chamber for snap nubs."""
    outline = _key_outline(d)
    mouth = _floor_shape(d, offset(r=0.2)(outline), KEY_POCKET_H + 0.01, -0.01)
    chamber = _floor_shape(d, offset(r=0.5)(outline), KEY_POCKET_H - 0.8, 0.8)
    return mouth + chamber


def palm_key(d: Design):
    """Replaceable dog-bone retaining key, in its assembled world position."""
    if d.deck.palm_length <= 0 or d.deck.palm_attachment != "anchored":
        return None
    seam = -d.front_length
    body = _floor_shape(d, _key_outline(d), KEY_H)
    reliefs, nubs = [], []
    for sy in (-1, 1):
        for sx in (-1, 1):
            # Slots open at the distal ends, leaving flexible side fingers.
            reliefs.append(_floor_shape(d, square([0.7, 4.8], center=True)
                .translate([sx * 4.6, seam + sy * 8.7]), KEY_H + 0.1, -0.05))
            nubs.append(_floor_shape(d, square([0.5, 1.4], center=True)
                .translate([sx * 6.1, seam + sy * 9.8]), 0.4, 0.8))
    return body + union()(*nubs) - union()(*reliefs)


def palmrest(d: Design):
    """Separate printable palm rest; fused mode belongs to tray.stl."""
    if d.deck.palm_length <= 0 or d.deck.palm_attachment == "fused":
        return None
    body = _palm_body(d)
    if d.deck.palm_attachment == "anchored":
        body = body + _tongues(d) - palm_key_socket(d)
    return body


def tray_palm_joint(d: Design):
    """Additions and cuts applied to the completed tray."""
    if d.deck.palm_length <= 0 or d.deck.palm_attachment == "separate":
        return None, None
    if d.deck.palm_attachment == "anchored":
        return None, _tongues(d, JOINT_CLEAR) + palm_key_socket(d)
    # Its square back overlaps the straightened tray front by EPS. No
    # inset bridge or two opposing rounded corners remain at the seam.
    return _palm_body(d), None


def palm_joint_sample(d: Design):
    """Small mating floor sections and key, spaced for a fit-test print."""
    if d.deck.palm_attachment != "anchored" or d.deck.palm_length <= 0:
        return None
    seam = -d.front_length
    width = 2 * (max(abs(x) for x in _joint_centres(d)) + TONGUE_W / 2 + 3)
    tray_block = _floor_shape(d, square([width, 14], center=True).translate([0, seam + 7]), d.tray.floor)
    palm_block = _floor_shape(d, square([width, 14], center=True).translate([0, seam - 7.5]), d.tray.floor)
    sockets = _tongues(d, JOINT_CLEAR) + palm_key_socket(d)
    tray_block -= sockets
    palm_block = palm_block + _tongues(d) - palm_key_socket(d)
    return tray_block + palm_block.translate([0, -15, 0]) + palm_key(d).translate([width, 0, 0])
