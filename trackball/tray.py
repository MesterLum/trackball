"""The base tray (world frame): a wedge whose walls stand perpendicular to the
deck and whose floor is level with the desk. Holds the MCU (lying across
behind the ball, USB out of a side wall) and the battery (flat under the
sensor)."""
from __future__ import annotations

import math

from solid2 import cube, cylinder, linear_extrude, polygon, union

from .common import EPS, half_space_above, rounded_rect, to_world, zcyl
from .config import Design


def lid_screw_points(d: Design):
    """Deck-frame XY of the four lid screws / tray posts (see Design.lid_screw_points)."""
    return d.lid_screw_points()


def mcu_pose(d: Design):
    """World-frame (x, y, z_board_bottom). See mcu_point for the orientation."""
    x, y = d.mcu_center()
    return x, y, d.z_floor_top + d.mcu_standoff_h


def mcu_point(d: Design, along: float, across: float) -> tuple[float, float]:
    """Board-relative (along the USB axis toward the USB, across) -> world XY.
    usb_exit="side": USB points to usb_side on X. usb_exit="back": USB points +Y."""
    x, y, _ = mcu_pose(d)
    if d.tray.usb_exit == "back":
        return x - across, y + along
    return x + d.tray.usb_side * along, y + d.tray.usb_side * across


def bootsel_deck_xy(d: Design):
    mcu = d.tray.mcu
    if mcu.bootsel is None:
        return None
    bx, by = mcu_point(d, *mcu.bootsel)
    _, _, zb = mcu_pose(d)
    xd, yd, _ = d.world_to_deck((bx, by, zb + mcu.thickness))
    return xd, yd


def _box(x0, x1, y0, y1, z0, z1):
    return cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])


def tray(d: Design):
    fn = d.fn
    t = d.tray
    mcu = t.mcu
    w, l, cx, cy = d.footprint
    z0 = d.z_pcb_face
    zf_top, zf_bot = d.z_floor_top, d.z_floor_bottom
    # how far the deck-frame prisms must reach down to pass the desk plane everywhere
    sag = (w + l) * (math.sin(math.radians(abs(d.deck.tilt_deg))) + math.sin(math.radians(abs(d.deck.tent_deg))))
    tall = (z0 - zf_bot) + sag + 10.0
    box = (w + 2 * sag + 20.0, l + 2 * sag + 20.0)   # half-space boxes, kept tight for --viewall
    hs_bot = half_space_above(zf_bot, box, (cx, cy), tall)
    hs_top = half_space_above(zf_top, box, (cx, cy), tall)

    # shell: deck-frame prism (walls perpendicular to the deck) cut by the desk plane
    outline = rounded_rect(w, l, d.carrier.corner_r, tall, fn).up(z0 - tall).translate([cx, cy, 0])
    if d.deck.palm_length > 0 and d.deck.palm_attachment == "fused":
        # These front corners become internal to one continuous footprint.
        # Square only this end; the normal inner cavity stays unchanged.
        outline += cube([w, d.carrier.corner_r + EPS, tall]).translate(
            [-w / 2, -d.front_length, z0 - tall])
    outer = to_world(outline, d.deck)
    inner = to_world(rounded_rect(w - 2 * t.wall, l - 2 * t.wall, max(d.carrier.corner_r - t.wall, 1), tall + 1, fn)
                     .up(z0 - tall).translate([cx, cy, 0]), d.deck)
    body = outer * hs_bot - inner * hs_top

    # corner posts with inserts for the lid screws (perpendicular to the deck)
    posts, post_holes = [], []
    for x, y in lid_screw_points(d):
        posts.append(to_world(zcyl(t.post_dia, z0 - tall, z0, fn).translate([x, y, 0]), d.deck))
        post_holes.append(to_world(zcyl(t.post_insert_dia, z0 - t.post_insert_depth, z0 + 1, fn)
                                   .translate([x, y, 0]), d.deck))
    posts_w = union()(*posts) * half_space_above(zf_top - EPS, box, (cx, cy), tall)

    adds, cuts = [posts_w], [union()(*post_holes)]

    # ---- MCU mount (world frame) ----
    mx, my, zb = mcu_pose(d)
    if mcu.holes:
        for along, across in mcu.holes:
            hx, hy = mcu_point(d, along, across)
            adds.append(zcyl(t.standoff_dia, zf_top - EPS, zb, fn).translate([hx, hy, 0]))
            cuts.append(zcyl(t.standoff_screw_dia, zf_top - EPS, zb + 1, fn).translate([hx, hy, 0]))
    else:
        # friction pocket, built with the USB toward +X then rotated like the board
        pl = mcu.length + 2 * t.pocket_clear
        pw = mcu.width + 2 * t.pocket_clear
        sh = d.mcu_standoff_h
        frame_h = sh + mcu.thickness + 1.0
        frame = _box(-(pl + 3) / 2, mcu.length / 2, -(pw + 3) / 2, (pw + 3) / 2, zf_top - EPS, zf_top + frame_h)
        pocket = _box(-pl / 2, pl / 2, -pw / 2, pw / 2, zf_top + sh, zf_top + frame_h + 1)
        usb_end = _box(pl / 2 - 1, pl / 2 + 5, -pw / 2, pw / 2, zf_top + sh, zf_top + frame_h + 1)
        local = frame - pocket - usb_end
        rot = 90.0 if t.usb_exit == "back" else (0.0 if t.usb_side > 0 else 180.0)
        adds.append(local.rotate([0, 0, rot]).translate([mx, my, 0]))

    # Socket neck follows the horizontal connector, through the sloping wall.
    # The outer counterbore reaches the nose so the cable moulding can seat.
    cuts.append(usb_cutout(d))

    # ---- battery: flat on the floor under the sensor ----
    if d.battery.enabled:
        b = d.battery
        bx, by = d.battery_center()
        il, iw = b.length + 2 * b.clearance, b.width + 2 * b.clearance
        fh = b.thickness + b.frame_extra_h
        frame = _box(-il / 2 - b.frame_wall, il / 2 + b.frame_wall, -iw / 2 - b.frame_wall, iw / 2 + b.frame_wall,
                     zf_top - EPS, zf_top + fh)
        pocket = _box(-il / 2, il / 2, -iw / 2, iw / 2, zf_top, zf_top + fh + 1)
        wires = _box(-4, 4, iw / 2 - 1, iw / 2 + b.frame_wall + 1, zf_top + 1, zf_top + fh + 1)
        adds.append((frame - pocket - wires).translate([bx, by, 0]))
        if b.power_switch:
            # slide-switch slot in the +X wall, in front of the ball axis
            sw_w, sw_h = b.power_switch_slot
            sy = -(d.pcb.r + 6 + sw_w / 2)
            x_in, x_far = d.half_width - t.wall - 2, d.half_width + 4 * t.wall
            cuts.append(_box(x_in, x_far, sy - sw_w / 2, sy + sw_w / 2, zf_top + 3, zf_top + 3 + sw_h))

    # rubber-foot recesses in the bottom
    for fx, fy in d.feet_xy():
        cuts.append(zcyl(t.feet_dia, zf_bot - 1, zf_bot + t.feet_depth, fn).translate([fx, fy, 0]))

    result = body + union()(*adds) - union()(*cuts)
    from .palmrest import tray_palm_joint
    extra, slots = tray_palm_joint(d)
    if extra is not None:
        result += extra
    if slots is not None:
        result -= slots
    return result


def usb_profile(d: Design, width: float, height: float):
    """Cross-section in XY: horizontal width, vertical height."""
    if d.usb_kind == "usb-c":
        # A capsule, rather than a square opening around a USB-C socket.
        from solid2 import hull, circle
        r = height / 2
        return hull()(*[circle(r=r, _fn=d.fn).translate([side * (width - height) / 2, 0]) for side in (-1, 1)])
    # Micro-B shell: wider at the PCB side, chamfered upper shoulders.
    shoulder = min(1.0, height / 3)
    return polygon([[-width / 2, -height / 2], [width / 2, -height / 2],
                    [width / 2, height / 2 - shoulder], [width / 2 - shoulder, height / 2],
                    [-width / 2 + shoulder, height / 2], [-width / 2, height / 2 - shoulder]])


def usb_cutout(d: Design):
    """Socket-shaped neck plus cable recess, defined in the board's frame."""
    m, t = d.tray.mcu, d.tray
    mx, my, zb = mcu_pose(d)
    nose = m.length / 2 + m.usb_overhang
    z = zb + m.thickness + d.usb_z_offset + d.usb_height / 2
    # Reach beyond the complete shell even at the maximum tilt/tent angles.
    reach = max(d.footprint[:2]) + abs(d.z_floor_bottom) + 20
    def tunnel(width, height, a0, a1):
        # Profile X -> local across, Y -> world Z, extrusion -> along USB.
        return linear_extrude(a1 - a0)(usb_profile(d, width, height)).rotate([90, 0, 90]).translate([a0, 0, z])
    neck = tunnel(d.usb_width + 2 * t.usb_clear, d.usb_height + 2 * t.usb_clear,
                  m.length / 2 - 6, reach)
    recess = tunnel(max(d.usb_width + 3, 12), max(d.usb_height + 3, 7), nose + t.usb_clear, reach)
    rot = 90 if t.usb_exit == "back" else (0 if t.usb_side > 0 else 180)
    return (neck + recess).rotate([0, 0, rot]).translate([mx, my, 0])


def mcu_preview(d: Design):
    t = d.tray
    mcu = t.mcu
    mx, my, zb = mcu_pose(d)
    board = _box(-mcu.length / 2, mcu.length / 2, -mcu.width / 2, mcu.width / 2, 0, mcu.thickness).color("green")
    usb = (linear_extrude(6 + mcu.usb_overhang)(usb_profile(d, d.usb_width, d.usb_height))
           .rotate([90, 0, 90])
           .translate([mcu.length / 2 - 6, 0, mcu.thickness + d.usb_z_offset + d.usb_height / 2])
           .color("silver"))
    rot = 90.0 if t.usb_exit == "back" else (0.0 if t.usb_side > 0 else 180.0)
    return (board + usb).rotate([0, 0, rot]).translate([mx, my, zb])


def battery_preview(d: Design):
    if not d.battery.enabled:
        return None
    b = d.battery
    bx, by = d.battery_center()
    cell = _box(-b.length / 2, b.length / 2, -b.width / 2, b.width / 2, 0, b.thickness).color("slateblue")
    return cell.translate([bx, by, d.z_floor_top])
