"""The base tray: holds the MCU, closes the module, carries the lid posts."""
from __future__ import annotations

from solid2 import cube, cylinder, union

from .common import EPS, rounded_rect, zcyl
from .config import Design


def mcu_center(d: Design) -> tuple[float, float]:
    """MCU board centre in module XY. Long axis runs along X, USB toward
    ``usb_side``; the USB end is parked 1 mm from the inner wall."""
    t = d.tray
    w, _, cx, _ = d.footprint
    inner_half = w / 2 - t.wall
    x = t.usb_side * (inner_half - 1.0 - t.mcu.length / 2) + cx
    return x, t.mcu_offset_y


def lid_screw_points(d: Design):
    w, l, cx, cy = d.footprint
    i = d.carrier.lid_screw_inset
    return [(cx + sx * (w / 2 - i), cy + sy * (l / 2 - i)) for sx in (-1, 1) for sy in (-1, 1)]


def tray(d: Design):
    fn = d.fn
    t = d.tray
    mcu = t.mcu
    w, l, cx, cy = d.footprint
    z_bot, z_floor, z_top = d.z_tray_bottom, d.z_tray_floor_top, d.z_pcb_face

    shell = rounded_rect(w, l, d.carrier.corner_r, z_top - z_bot, fn).up(z_bot).translate([cx, cy, 0])
    inner = rounded_rect(w - 2 * t.wall, l - 2 * t.wall, max(d.carrier.corner_r - t.wall, 1),
                         z_top - z_floor + 1, fn).up(z_floor).translate([cx, cy, 0])
    body = shell - inner

    # corner posts with inserts for the lid screws
    posts, post_holes = [], []
    for x, y in lid_screw_points(d):
        posts.append(zcyl(t.post_dia, z_floor - EPS, z_top, fn).translate([x, y, 0]))
        post_holes.append(zcyl(t.post_insert_dia, z_top - t.post_insert_depth, z_top + 1, fn).translate([x, y, 0]))

    # MCU mount
    mx, my = mcu_center(d)
    mounts, mount_holes = [], []
    if mcu.holes:
        for hx, hy in mcu.holes:
            mounts.append(zcyl(t.standoff_dia, z_floor - EPS, z_floor + t.standoff_h, fn).translate([mx + hx, my + hy, 0]))
            mount_holes.append(zcyl(t.standoff_screw_dia, z_floor - EPS, z_floor + t.standoff_h + 1, fn).translate([mx + hx, my + hy, 0]))
    else:
        # friction pocket for hole-less boards (RP2040-Zero, nice!nano)
        pw = mcu.length + 2 * t.pocket_clear
        pl = mcu.width + 2 * t.pocket_clear
        frame_h = t.standoff_h + mcu.thickness + 1.0
        frame = cube([pw + 3.0, pl + 3.0, frame_h]).translate([-(pw + 3.0) / 2, -(pl + 3.0) / 2, 0])
        pocket = cube([pw, pl, frame_h]).translate([-pw / 2, -pl / 2, t.standoff_h])
        # open the USB end of the frame
        end = cube([5, pl, frame_h + 1]).translate([t.usb_side * (pw / 2 + 1.5) - 2.5, -pl / 2, t.standoff_h])
        mounts.append((frame - pocket - end).up(z_floor - EPS).translate([mx, my, 0]))

    # USB cutout through the side wall
    z_usb_mid = z_floor + t.standoff_h + mcu.thickness + mcu.usb_height / 2
    usb_w, usb_h = mcu.usb_width + 4.0, mcu.usb_height + 4.0
    wall_x = cx + t.usb_side * (w / 2 - t.wall / 2)
    usb = cube([t.wall + 2, usb_w, usb_h], center=True).translate([wall_x, my, z_usb_mid])

    return body + union()(*posts) + union()(*mounts) - union()(*post_holes) - union()(*mount_holes) - usb


def mcu_preview(d: Design):
    t = d.tray
    mcu = t.mcu
    mx, my = mcu_center(d)
    z = d.z_tray_floor_top + t.standoff_h
    board = cube([mcu.length, mcu.width, mcu.thickness]).translate([-mcu.length / 2, -mcu.width / 2, 0])
    usb = cube([6.0 + mcu.usb_overhang, mcu.usb_width, mcu.usb_height]).translate(
        [t.usb_side * (mcu.length / 2 + mcu.usb_overhang) - (6.0 + mcu.usb_overhang if t.usb_side > 0 else 0),
         -mcu.usb_width / 2, mcu.thickness])
    return (board.color("green") + usb.color("silver")).up(z).translate([mx, my, 0])
