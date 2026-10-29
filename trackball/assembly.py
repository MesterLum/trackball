"""Assembly and placement previews: printed parts plus reference models of
the ball, sensor PCB, lens, MCU, supports and switches. Not for printing."""
from __future__ import annotations

from solid2 import cube, cylinder, sphere, union

from .carrier import carrier
from .common import rounded_rect, zcyl
from .config import Design
from .cup import cup, supports_preview
from .tray import mcu_preview, tray


# ---- reference models ------------------------------------------------------
def ball_preview(d: Design, alpha: float = 0.35):
    return sphere(r=d.ball.r, _fn=d.fn).color("crimson", alpha)


def pcb_preview(d: Design):
    """Sensor PCB with lens (front/top) and header (back/bottom)."""
    fn = d.fn
    z = d.z_pcb_face
    pcb = zcyl(d.pcb.diameter, z - d.pcb.thickness, z, fn)
    holes = union()(*[zcyl(d.pcb.hole_dia, z - 2, z + 1, fn).translate([0, sy * d.pcb.hole_spacing / 2, 0])
                      for sy in (-1, 1)])
    pcb = (pcb - holes).color("darkgreen")
    lens = rounded_rect(d.lens.width, d.lens.length, d.lens.corner_r,
                        d.lens.top_above_pcb, fn).up(z).color("black", 0.85)
    hx, hy = d.pcb.header_center
    header = cube([2.54, 2.54 * d.pcb.header_pins, d.pcb.header_height]).translate(
        [hx - 1.27, hy - 2.54 * d.pcb.header_pins / 2, z - d.pcb.thickness - d.pcb.header_height]).color("black")
    fx, fy = d.pcb.fpc_center
    fw, fl = d.pcb.fpc_size
    fpc = cube([fw, fl, d.pcb.fpc_height]).translate(
        [fx - fw / 2, fy - fl / 2, z - d.pcb.thickness - d.pcb.fpc_height]).color("tan")
    return union()(pcb, lens, header, fpc)


def switches_preview(d: Design):
    sw = d.switches
    if not sw.count:
        return None
    st = sw.type
    z1 = d.z_carrier_top
    parts = []
    for x, y in sw.positions(d.cup.base_dia):
        plate_top = z1
        housing = cube([st.pocket - 0.2, st.pocket - 0.2, st.above_plate + st.plate_t]).translate(
            [-(st.pocket - 0.2) / 2, -(st.pocket - 0.2) / 2, plate_top - st.plate_t]).color("dimgray")
        below = cube([st.cutout - 0.2, st.cutout - 0.2, st.below_plate]).translate(
            [-(st.cutout - 0.2) / 2, -(st.cutout - 0.2) / 2, plate_top - st.plate_t - st.below_plate]).color("dimgray")
        kw, kl = st.keycap
        cap = cube([kw, kl, st.keycap_h]).translate(
            [-kw / 2, -kl / 2, plate_top + st.above_plate]).color("white", 0.9)
        parts.append((housing + below + cap).translate([x, y, 0]))
    return union()(*parts).rotate([0, 0, sw.rotate_deg])


def reference_models(d: Design):
    parts = [ball_preview(d), pcb_preview(d), mcu_preview(d)]
    for p in (supports_preview(d), switches_preview(d)):
        if p is not None:
            parts.append(p)
    return union()(*parts)


# ---- views -----------------------------------------------------------------
def assembly(d: Design, explode: float = 0.0):
    e = explode
    return union()(
        cup(d).color("steelblue", 0.9).up(2 * e),
        carrier(d).color("goldenrod", 0.9).up(e),
        tray(d).color("gray", 0.9),
        reference_models(d).up(2 * e),
    )


def section(d: Design, explode: float = 0.0):
    """Assembly cut in half along X=0 so the sensor stack is visible.

    Keeps the X<0 half (intersection previews reliably in OpenCSG, a big
    difference does not)."""
    w, l, cx, cy = d.footprint
    x0 = cx - w / 2 - 5
    y0, y1 = cy - l / 2 - 5, cy + l / 2 + 5
    z0, z1 = d.z_tray_bottom - 5, d.ball.r + 3 * explode + 5
    keep = cube([-x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])
    return assembly(d, explode) * keep


def cup_placement(d: Design):
    """Cup with the ball (ghosted) and the supports seated."""
    parts = [cup(d).color("steelblue"), ball_preview(d, 0.25)]
    sp = supports_preview(d)
    if sp is not None:
        parts.append(sp)
    return union()(*parts)


def carrier_placement(d: Design):
    """Lid with the sensor PCB screwed under it and the switches in place."""
    parts = [carrier(d).color("goldenrod"), pcb_preview(d)]
    sp = switches_preview(d)
    if sp is not None:
        parts.append(sp)
    return union()(*parts)


def tray_placement(d: Design):
    """Tray with the MCU on its standoffs."""
    return union()(tray(d).color("gray"), mcu_preview(d))
