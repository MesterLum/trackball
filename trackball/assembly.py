"""Assembly and placement previews: printed parts plus reference models of
the ball, sensor PCB, lens, MCU, battery, supports and switches.
Not for printing. Everything is returned in the WORLD frame."""
from __future__ import annotations

from solid2 import cube, cylinder, sphere, union

from .carrier import carrier
from .common import rounded_rect, to_world, zcyl
from .config import Design
from .cup import cup, supports_preview
from .palmrest import palmrest
from .tray import battery_preview, mcu_preview, tray


def _box(x0, x1, y0, y1, z0, z1):
    return cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])


# ---- reference models (deck frame unless noted) ---------------------------
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
    parts = [pcb, lens, header]
    fx, fy = d.pcb.fpc_center
    fw, fl = d.pcb.fpc_size
    if fw > 0 and fl > 0:
        parts.append(cube([fw, fl, d.pcb.fpc_height]).translate(
            [fx - fw / 2, fy - fl / 2, z - d.pcb.thickness - d.pcb.fpc_height]).color("tan"))
    return union()(*parts)


def switches_preview(d: Design):
    sw = d.switches
    if not sw.count:
        return None
    st = sw.type
    z1 = d.z_carrier_top
    parts = []
    for x, y, ang in sw.positions(d.skirt_dia):
        # local frame: ball toward +X
        if st.kind == "key":
            housing = cube([st.pocket - 0.2, st.pocket - 0.2, st.above_plate + st.plate_t]).translate(
                [-(st.pocket - 0.2) / 2, -(st.pocket - 0.2) / 2, z1 - st.plate_t]).color("dimgray")
            below = cube([st.cutout - 0.2, st.cutout - 0.2, st.below_plate]).translate(
                [-(st.cutout - 0.2) / 2, -(st.cutout - 0.2) / 2, z1 - st.plate_t - st.below_plate]).color("dimgray")
            kl, kw = st.size_in, sw.size_across
            cap = cube([kl, kw, st.keycap_h]).translate([-kl / 2, -kw / 2, z1 + st.above_plate]).color("white", 0.9)
            local = housing + below + cap
        else:
            # microswitch body sitting in the holder bar under the paddle tip
            x_p = st.size_in / 2 - st.plunger_inset
            bl, bw, bh = st.body
            body_top = z1 - st.paddle_t - st.plunger_h
            body_cy = -(bl / 2 - st.plunger_from_end)
            body = _box(-bw / 2, bw / 2, -bl / 2, bl / 2, -bh, 0).color("dimgray")
            plunger = zcyl(st.plunger_dia, 0, st.plunger_h, d.fn).translate([0, bl / 2 - st.plunger_from_end, 0]).color("white")
            local = (body + plunger).translate([x_p, body_cy, body_top])
        parts.append(local.rotate([0, 0, ang]).translate([x, y, 0]))
    return union()(*parts)


def reference_models(d: Design):
    """Deck-frame references rotated to world, plus the world-frame ones."""
    deck_parts = [ball_preview(d), pcb_preview(d)]
    for p in (supports_preview(d), switches_preview(d)):
        if p is not None:
            deck_parts.append(p)
    parts = [to_world(union()(*deck_parts), d.deck), mcu_preview(d)]
    bp = battery_preview(d)
    if bp is not None:
        parts.append(bp)
    return union()(*parts)


# ---- views (world frame) ---------------------------------------------------
def assembly(d: Design, explode: float = 0.0):
    e = explode
    top = union()(
        cup(d).color("steelblue").up(2 * e),
        carrier(d).color("goldenrod").up(e),
    )
    parts = [to_world(top, d.deck), tray(d).color("gray"), reference_models(d).up(2 * e)]
    pr = palmrest(d)
    if pr is not None:
        parts.append(pr.color("peru"))
    return union()(*parts)


def section(d: Design, explode: float = 0.0):
    """Assembly cut in half along X=0 so the sensor stack is visible (keeps X<0)."""
    w, l, cx, cy = d.footprint
    # world bounding box of the deck outline (lid top and a floor-level guess)
    y_lo = cy - l / 2 - d.deck.palm_length
    pts = [d.deck_to_world((cx + sx * w / 2, yy, z))
           for sx in (-1, 1) for yy in (y_lo, cy + l / 2) for z in (d.z_carrier_top, d.z_floor_top - 20)]
    x0 = min(p[0] for p in pts) - 5
    y0, y1 = min(p[1] for p in pts) - 5, max(p[1] for p in pts) + 5
    z0, z1 = d.z_floor_bottom - 5, d.ball.r + 3 * explode + 10
    keep = cube([-x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])
    return assembly(d, explode) * keep


def cup_placement(d: Design):
    """Cup with the ball (ghosted) and the supports seated (deck frame)."""
    parts = [cup(d).color("steelblue"), ball_preview(d, 0.25)]
    sp = supports_preview(d)
    if sp is not None:
        parts.append(sp)
    return union()(*parts)


def carrier_placement(d: Design):
    """Lid with the sensor PCB screwed under it and the switches in place (deck frame)."""
    parts = [carrier(d).color("goldenrod"), pcb_preview(d)]
    sp = switches_preview(d)
    if sp is not None:
        parts.append(sp)
    return union()(*parts)


def tray_placement(d: Design):
    """Tray with the MCU and battery on the floor (world frame)."""
    parts = [tray(d).color("gray"), mcu_preview(d)]
    bp = battery_preview(d)
    if bp is not None:
        parts.append(bp)
    return union()(*parts)
