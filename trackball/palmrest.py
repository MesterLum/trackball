"""Palm rest: a separate printed block in front of the body (world frame).

It is built like the tray: a deck-frame prism cut by the desk plane, so its
sides lean the same way as the body and its top continues the (tilted) deck
plane, ``palm_drop`` lower. A shallow recess on top takes a leather/foam pad.
"""
from __future__ import annotations

import math

from .common import half_space_above, rounded_rect, to_world
from .config import Design


def palmrest(d: Design):
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
    block = rounded_rect(w, L, d.carrier.corner_r, tall, fn).up(z_top - tall).translate([0, cy, 0])
    if dk.palm_pad_recess > 0:
        pad = rounded_rect(w - 2 * dk.palm_pad_inset, L - 2 * dk.palm_pad_inset, 4.0,
                           dk.palm_pad_recess + 1, fn).up(z_top - dk.palm_pad_recess).translate([0, cy, 0])
        block = block - pad
    keep = half_space_above(zf_bot, (w + 2 * sag + 20, L + 2 * sag + 20), (0, cy), tall)
    return to_world(block, dk) * keep
