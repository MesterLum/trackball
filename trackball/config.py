"""All dimensions live here. Everything else derives geometry from these.

Numbers marked [kicad] were read from the Bastardkb
charybdis-pmw-3360-sensor-pcb KiCad board file.
Numbers marked [pmw3360] come from the PixArt PMW3360 / LM19-LSI assembly
drawing (via xythobuz's datasheet-derived constants). Verify against the
datasheet Figure 4/5 if your tracking is off; lens_to_ball is the one to tune.

Frames
------
* deck frame : origin at the ball centre, +Z normal to the deck (lid top),
               sensor PCB hole axis along +Y, the user sits at -Y. The cup,
               carrier, PCB and switches are modelled here (= print frame).
* world frame: deck frame rotated by Deck.tilt_deg about X and Deck.tent_deg
               about Y. The desk is horizontal here; the tray floor, MCU and
               battery live here.

Layout (top view, user at the bottom)
-------------------------------------
    +Y  ┌──────────────────────────┐
        │   MCU lying across, USB  │  back half: electronics
        │   out of the +X wall     │
        │        (  ball  )        │  ball at the centre of the footprint
        │   battery flat under it  │
        │   [btn] [btn] [btn]      │  front half: buttons + hand area
    -Y  └──────────────────────────┘
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from .i18n import _

from .supports import BallSupport, PressFitBTU


# --------------------------------------------------------------------------
# Sensor board + optics
# --------------------------------------------------------------------------
@dataclass
class SensorPCB:
    """Bastardkb Charybdis PMW3360 sensor PCB.

    The lens pokes through the board cutout to the FRONT (F.Cu) side; the
    sensor body, header and every SMD part are on the BACK. The front is flat
    and mounts against the carrier.
    """
    name: str = "bastardkb-pmw3360"
    diameter: float = 41.8            # [kicad] round outline
    thickness: float = 1.6            # [kicad]
    hole_spacing: float = 37.0        # [kicad] two M3 holes on the Y axis
    hole_dia: float = 3.2             # [kicad]
    header_center: tuple[float, float] = (17.9, -6.4)   # [kicad] back side, pins along Y
    header_pins: int = 6
    header_height: float = 9.0        # vertical header + pins below the back face
    fpc_center: tuple[float, float] = (-16.75, 0.0)     # [kicad] back side
    fpc_size: tuple[float, float] = (6.0, 12.0)
    fpc_height: float = 3.0

    @property
    def r(self) -> float:
        return self.diameter / 2


BASTARDKB_PMW3360 = SensorPCB()
# Generic round "PMW3389 module" (AliExpress, silkscreen "PAW3360/3389-Module").
# Same LM19-LSI lens as the PMW3360. Numbers are a first guess from the
# product photo: MEASURE your board and adjust before printing.
PMW3389_ROUND = SensorPCB(
    name="pmw3389-round",
    diameter=32.0, thickness=1.6,
    hole_spacing=26.0, hole_dia=3.2,
    header_center=(13.0, 0.0), header_pins=6, header_height=9.0,
    fpc_center=(0.0, 0.0), fpc_size=(0.0, 0.0), fpc_height=0.0,
)
SENSOR_PCBS = {"bastardkb": BASTARDKB_PMW3360, "pmw3389-round": PMW3389_ROUND}


@dataclass
class Lens:
    """PMW3360 + LM19-LSI optics as seen from the PCB front face."""
    length: float = 21.35             # [pmw3360] along Y (parallel to pin rows)
    width: float = 19.0               # [pmw3360] along X
    corner_r: float = 3.0
    top_above_pcb: float = 3.6        # [pmw3360] lens reference plane above PCB front
    lens_to_ball: float = 2.4         # [pmw3360] reference plane -> tracking surface
    clearance: float = 0.5            # per side, pocket oversize

    @property
    def ball_above_pcb(self) -> float:
        return self.top_above_pcb + self.lens_to_ball


# --------------------------------------------------------------------------
# Ball + cup
# --------------------------------------------------------------------------
@dataclass
class Ball:
    diameter: float = 34.0

    @property
    def r(self) -> float:
        return self.diameter / 2


@dataclass
class Cup:
    gap: float = 0.8                  # radial air between ball and cup cavity
    wall: float = 3.0                 # dome wall thickness
    rim_below_center: float = 5.0     # how far below the equator the opening sits
    skirt_extra: float = 14.0         # skirt diameter = dome diameter + this
    base_dia: float | None = None     # pin the skirt diameter instead of deriving it
    base_top_below_center: float = 7.0
    carrier_screw_angles: tuple[float, ...] = (65, 115, 245, 295)
    insert_dia: float = 4.0           # M3 heat-set insert hole
    insert_depth: float = 5.0
    # shape of the part above the skirt:
    #   cone  - straight cone from skirt to rim (openings all around)
    #   dome  - spherical shell following the ball, scooped front and back -> two side lobes
    #   block - rounded square block, scooped on all four sides -> four corner tabs
    shape: str = "cone"
    round: float = 2.0                # round-over radius of the rim edge
    cut: float = 6.0                  # how far below the rim the scoops go (dome / block)
    saddle_r: float = 16.0            # radius of the round scoops (smaller = narrower lobes)
    peak: str = "round"               # round: cylindrical scoops; sharp: V scoops, the lobes end in points
    tip_flat: float = 1.0             # width of the flat on a sharp lobe tip (printable, not painful)
    # ball supports
    support: BallSupport = field(default_factory=PressFitBTU)
    support_count: int = 3
    support_polar_deg: float = 55.0   # angle from the downward axis to contact point
    support_azimuth_deg: float = 90.0 # azimuth of the first support

    def skirt_dia(self, ball_r: float) -> float:
        if self.base_dia is not None:
            return self.base_dia
        return 2 * (ball_r + self.gap + self.wall) + self.skirt_extra

    @property
    def azimuth0(self) -> float:
        """First support azimuth: under a lobe (dome) or a tab (block), else as configured."""
        return {"dome": 0.0, "block": 45.0}.get(self.shape, self.support_azimuth_deg)

    @property
    def scoop_axes(self) -> tuple[str, ...]:
        return {"dome": ("y",), "block": ("x", "y")}.get(self.shape, ())

    def scoop_floor(self) -> float:
        """Lowest point of the scoops (deck z, relative to the ball centre)."""
        return -self.rim_below_center - self.cut

    def rim_half_width(self, ball_r: float) -> float:
        """Half-width of a scoop where it meets the rim plane."""
        if self.peak == "sharp":
            # the V walls reach the outer surface at the rim, leaving only the tip flat
            z_rim = -self.rim_below_center
            r_out = math.sqrt(max((ball_r + self.gap + self.wall) ** 2 - z_rim ** 2, 1.0))
            return max(r_out - self.tip_flat, 2.0)
        r = self.saddle_r
        return math.sqrt(max(r ** 2 - (r - self.cut) ** 2, 0.0)) if self.cut < r else r

    def cut_surface_z(self, x: float, y: float, ball_r: float) -> float:
        """Height of the cup surface after the scoops at plan position (x, y);
        +inf where no scoop reaches."""
        z = math.inf
        zf = self.scoop_floor()
        for axis in self.scoop_axes:
            t = abs(x if axis == "y" else y)     # distance from the scoop's axis plane
            if self.peak == "sharp":
                w = self.rim_half_width(ball_r)
                z = min(z, zf + t * self.cut / w)
            elif t < self.saddle_r:
                z = min(z, zf + self.saddle_r - math.sqrt(self.saddle_r ** 2 - t ** 2))
        return z

    def screw_radius(self, ball_r: float) -> float:
        return self.skirt_dia(ball_r) / 2 - 3.5


# --------------------------------------------------------------------------
# Sensor carrier / lid (the only part that knows the sensor PCB hole pattern)
# --------------------------------------------------------------------------
@dataclass
class Carrier:
    thickness: float = 5.0
    edge_round: float = 2.0           # round-over of the lid's top edge
    padding: float = 9.0              # body = cup skirt + padding on every side (the one size knob)
    corner_r: float = 8.0
    pcb_insert_dia: float = 4.0       # M3 insert, pressed from below
    pcb_insert_depth: float = 4.5
    screw_clear_dia: float = 3.4      # M3 clearance
    screw_head_dia: float = 6.0
    screw_head_depth: float = 3.0
    lid_screw_inset: float = 5.0      # corner screws into the tray posts
    bootsel_hole_dia: float = 4.0


# --------------------------------------------------------------------------
# Deck shape: tilt / tent / hand rest
# --------------------------------------------------------------------------
@dataclass
class Deck:
    tilt_deg: float = 0.0             # about X through the ball; + raises the back (+Y)
    tent_deg: float = 0.0             # about Y through the ball; + raises the -X side
    # palm rest: a SEPARATE printed block in front of the body that continues
    # the deck plane (same width, same lean), 0 = none
    palm_length: float = 0.0
    palm_drop: float = 2.0            # its top sits this far below the deck
    palm_round: float = 2.0           # round-over of its top edge
    palm_pad_recess: float = 0.0      # shallow pocket for a leather/foam pad (0 = plain top)
    palm_pad_inset: float = 5.0


# --------------------------------------------------------------------------
# MCU boards
# --------------------------------------------------------------------------
@dataclass
class MCU:
    name: str
    length: float                     # along the USB axis
    width: float
    thickness: float = 1.0
    holes: tuple[tuple[float, float], ...] = ()   # (along, across) from board centre
    hole_dia: float = 2.1
    usb_width: float = 9.0
    usb_height: float = 3.3
    usb_overhang: float = 1.3
    component_height: float = 3.5     # tallest part on top
    bootsel: tuple[float, float] | None = None    # (along, across) from centre; along>0 = toward USB
    wireless: bool = False


_PICO_HOLES = ((-23.5, -5.7), (-23.5, 5.7), (23.5, -5.7), (23.5, 5.7))   # 47 x 11.4
PICO = MCU("pico", 51.0, 21.0, holes=_PICO_HOLES, usb_width=8.0, usb_height=2.8, bootsel=(13.0, -3.5))
PICO_W = MCU("pico-w", 51.0, 21.0, holes=_PICO_HOLES, usb_width=8.0, usb_height=2.8, bootsel=(13.0, -3.5), wireless=True)
PICO_2 = MCU("pico2", 51.0, 21.0, holes=_PICO_HOLES, usb_width=8.0, usb_height=2.8, bootsel=(13.0, -3.5))
RP2040_ZERO = MCU("rp2040-zero", 23.5, 18.0, usb_width=9.0, usb_height=3.3, usb_overhang=1.0, bootsel=(-5.0, 0.0))
XIAO = MCU("xiao", 21.0, 17.5, usb_width=9.0, usb_height=3.3, usb_overhang=1.2, wireless=True)  # XIAO nRF52840 / RP2040
NICE_NANO = MCU("nice-nano", 33.0, 18.0, usb_width=9.0, usb_height=3.3, usb_overhang=1.5, component_height=2.0, wireless=True)
SUPERMINI = MCU("supermini", 33.5, 18.0, usb_width=9.0, usb_height=3.3, usb_overhang=1.5, component_height=2.0, wireless=True)
PRO_MICRO = MCU("pro-micro", 33.0, 18.0, usb_width=8.0, usb_height=3.0, usb_overhang=1.5, component_height=3.0)

MCUS = {m.name: m for m in (PICO, PICO_W, PICO_2, RP2040_ZERO, XIAO, NICE_NANO, SUPERMINI, PRO_MICRO)}


# --------------------------------------------------------------------------
# Battery: lies flat on the tray floor under the sensor, the tray grows by
# its thickness.
# --------------------------------------------------------------------------
@dataclass
class Battery:
    enabled: bool = False
    length: float = 50.0              # along X
    width: float = 34.0               # along Y
    thickness: float = 5.0
    clearance: float = 0.5            # per side
    frame_wall: float = 1.5
    frame_extra_h: float = 1.0        # frame rises this much above the cell
    power_switch: bool = True         # slide switch slot in the USB side wall
    power_switch_slot: tuple[float, float] = (9.0, 4.5)   # (width, height)

    @property
    def outer(self) -> tuple[float, float]:
        f = 2 * (self.clearance + self.frame_wall)
        return self.length + f, self.width + f

    @property
    def extra_height(self) -> float:
        """How much taller the tray gets."""
        return self.thickness + self.frame_extra_h if self.enabled else 0.0


# --------------------------------------------------------------------------
# Click switches (mounted in the lid, hanging into the tray)
# --------------------------------------------------------------------------
@dataclass
class SwitchType:
    name: str
    kind: str                         # "key" (plate mount) or "micro" (paddle + microswitch)
    size_in: float                    # button extent toward the ball
    size_across: float                # button extent along the row (1u)
    pitch: float                      # centre spacing along the row (1u) = the keycap unit
    # --- key switches ---
    cutout: float = 0.0               # square plate cutout
    plate_t: float = 0.0              # plate thickness the clips expect
    pocket: float = 0.0               # relief under the plate so clips can snap
    below_plate: float = 0.0          # housing + pins under the plate
    above_plate: float = 0.0          # housing above the plate (no cap)
    keycap_h: float = 0.0             # cap top above the housing top
    # --- microswitch + paddle ---
    body: tuple[float, float, float] = (12.8, 5.8, 6.5)   # Omron D2F / Kailh GM (L, W, H)
    plunger_dia: float = 2.5
    plunger_h: float = 1.5            # plunger above the body, released
    plunger_from_end: float = 3.2     # plunger centre from the body end nearest the paddle tip
    paddle_t: float = 2.5
    paddle_slot: float = 0.8          # gap around the paddle
    paddle_gap: float = 0.5           # paddle underside above the holder bar (= travel stop)
    hinge_len: float = 3.0
    hinge_t: float = 0.8
    holder_wall: float = 1.5
    plunger_inset: float = 3.5        # plunger centre from the paddle tip


CHOC_V1 = SwitchType("choc-v1", "key", size_in=16.5, size_across=17.5, pitch=18.0,
                     cutout=13.8, plate_t=1.3, pocket=15.2, below_plate=5.2, above_plate=5.0, keycap_h=3.0)
MX = SwitchType("mx", "key", size_in=18.0, size_across=18.0, pitch=19.05,
                cutout=14.0, plate_t=1.5, pocket=15.6, below_plate=8.3, above_plate=6.6, keycap_h=8.0)
MICRO = SwitchType("micro", "micro", size_in=24.0, size_across=16.0, pitch=18.0)
SWITCH_TYPES = {s.name: s for s in (CHOC_V1, MX, MICRO)}

PLACEMENTS = ("front", "left", "right", "sides", "tiles")


@dataclass
class Switches:
    type: SwitchType = field(default_factory=lambda: CHOC_V1)
    count: int = 3                    # per row; 0 disables the buttons
    placement: str = "front"          # front | left | right | sides (left + right)
    gap_to_cup: float = 2.0           # button edge to cup skirt
    keycap_u: float = 1.0             # 1, 1.25, 1.5, 2 ... scales keycap width and pitch
    gap: float = 0.0                  # extra space between neighbouring buttons
    mirror: bool = True               # front row: also add the strip at the back (keeps the ball centred)
    # --- "tiles": sculpted wedge keys around the ball (count = 2, 4, 6 or 8 tiles in total)
    tile_gap: float = 3.5             # visible gap between neighbouring tiles (solid spoke + two slots)
    tile_frame: float = 4.0           # full-thickness rim around the lid; the hinge line sits here
    tile_ring: float = 3.0            # solid ring between the cup skirt and the tiles
    tile_slot: float = 0.6            # through slot freeing a tile

    @property
    def is_tiles(self) -> bool:
        return self.placement == "tiles" and self.count > 0

    @property
    def pitch(self) -> float:
        return self.type.pitch * self.keycap_u + self.gap

    @property
    def size_across(self) -> float:
        return self.type.size_across * self.keycap_u if self.type.kind == "micro" else self.pitch - 0.5

    @property
    def rows(self) -> tuple[float, ...]:
        """Inward direction (degrees, pointing at the ball) of every row."""
        if not self.count or self.placement == "tiles":
            return ()
        return {"front": (90.0,), "left": (0.0,), "right": (180.0,), "sides": (0.0, 180.0)}[self.placement]

    def row_distance(self, skirt_dia: float) -> float:
        """Ball axis -> button centre."""
        return skirt_dia / 2 + self.gap_to_cup + self.type.size_in / 2

    def positions(self, skirt_dia: float) -> list[tuple[float, float, float]]:
        """(x, y, inward_angle_deg) of every button in deck coordinates."""
        out = []
        dist = self.row_distance(skirt_dia)
        for ang in self.rows:
            a = math.radians(ang)
            # row centre lies opposite to the inward direction
            cx, cy = -dist * math.cos(a), -dist * math.sin(a)
            # the row runs perpendicular to the inward direction
            ux, uy = -math.sin(a), math.cos(a)
            for i in range(self.count):
                o = (i - (self.count - 1) / 2) * self.pitch
                out.append((cx + ux * o, cy + uy * o, ang))
        return out

    def row_half_width(self) -> float:
        return (self.count - 1) / 2 * self.pitch + self.size_across / 2

    def reach(self, skirt_dia: float) -> float:
        """Ball axis -> outer edge of a row."""
        return self.row_distance(skirt_dia) + self.type.size_in / 2

    def depth_below_lid(self, lid_t: float) -> float:
        """How far the switch reaches below the lid underside."""
        st = self.type
        if st.kind == "key":
            return max(0.0, st.below_plate - (lid_t - st.plate_t))
        bar_h = st.body[2] + st.plunger_h - st.paddle_gap
        return max(0.0, st.paddle_t + st.paddle_gap + bar_h - lid_t)


# --------------------------------------------------------------------------
# Tray
# --------------------------------------------------------------------------
@dataclass
class Tray:
    mcu: MCU = field(default_factory=lambda: PICO)
    mcu_place: str = "behind"         # behind the sensor PCB, or "under" it (tray gets taller, body stays small)
    usb_exit: str = "side"            # "side": board lies across, USB out of the usb_side wall; "back": turned 90°
    usb_side: int = +1                # +X (1) or -X (-1) wall for usb_exit="side"
    wall: float = 3.0
    floor: float = 3.0
    feet_dia: float = 10.0            # rubber-foot recesses in the bottom (0 = none)
    feet_depth: float = 1.0
    feet_inset: float = 9.0           # foot centre from the body edge
    standoff_h: float = 3.0
    standoff_dia: float = 5.0
    standoff_screw_dia: float = 1.8   # M2 self-tapping into plastic
    post_dia: float = 7.5
    post_insert_dia: float = 4.0
    post_insert_depth: float = 6.0
    pocket_clear: float = 0.4         # per side, for hole-less boards
    bay_gap: float = 3.0              # sensor PCB edge -> MCU
    clearance: float = 1.0            # air above the tallest thing under the lid


# --------------------------------------------------------------------------
# Whole module
# --------------------------------------------------------------------------
@dataclass
class Design:
    ball: Ball = field(default_factory=Ball)
    cup: Cup = field(default_factory=Cup)
    lens: Lens = field(default_factory=Lens)
    pcb: SensorPCB = field(default_factory=SensorPCB)
    carrier: Carrier = field(default_factory=Carrier)
    tray: Tray = field(default_factory=Tray)
    switches: Switches = field(default_factory=Switches)
    deck: Deck = field(default_factory=Deck)
    battery: Battery = field(default_factory=Battery)
    fn: int = 96                      # OpenSCAD $fn for curved surfaces

    # ---- derived sizes ----
    @property
    def skirt_dia(self) -> float:
        return self.cup.skirt_dia(self.ball.r)

    @property
    def cavity_r(self) -> float:
        return self.ball.r + self.cup.gap

    # ---- Z levels in the deck frame (relative to ball centre) ----
    @property
    def z_pcb_face(self) -> float:
        """Front face of the sensor PCB = lid underside."""
        return -(self.ball.r + self.lens.ball_above_pcb)

    @property
    def z_carrier_top(self) -> float:
        return self.z_pcb_face + self.carrier.thickness

    @property
    def z_cup_bottom(self) -> float:
        return self.z_carrier_top

    # ---- frame conversion ----
    def deck_to_world(self, p: tuple[float, float, float]) -> tuple[float, float, float]:
        t, a = math.radians(self.deck.tilt_deg), math.radians(self.deck.tent_deg)
        x, y, z = p
        y, z = y * math.cos(t) - z * math.sin(t), y * math.sin(t) + z * math.cos(t)      # Rx(tilt)
        x, z = x * math.cos(a) + z * math.sin(a), -x * math.sin(a) + z * math.cos(a)     # Ry(tent)
        return x, y, z

    def world_to_deck(self, p: tuple[float, float, float]) -> tuple[float, float, float]:
        t, a = math.radians(self.deck.tilt_deg), math.radians(self.deck.tent_deg)
        x, y, z = p
        x, z = x * math.cos(a) - z * math.sin(a), x * math.sin(a) + z * math.cos(a)      # Ry(-tent)
        y, z = y * math.cos(t) + z * math.sin(t), -y * math.sin(t) + z * math.cos(t)     # Rx(-tilt)
        return x, y, z

    # ---- electronics bay (world frame, behind the sensor PCB) ----
    @property
    def bay_y0(self) -> float:
        """World Y where the MCU may start, measured at floor level."""
        t = math.radians(abs(self.deck.tilt_deg))
        depth = self.pcb.thickness + self.pcb.header_height
        return self.pcb.r + self.tray.bay_gap + depth * math.sin(t)

    @property
    def mcu_rot(self) -> float:
        """0 = long axis along X (USB out of a side wall), 90 = along Y (USB out of the back)."""
        return 90.0 if self.tray.usb_exit == "back" else 0.0

    @property
    def mcu_xy_size(self) -> tuple[float, float]:
        """Footprint of the board on the floor (x, y) including a friction frame if any."""
        m = self.tray.mcu
        extra = 0.0 if m.holes else 3.0 + 2 * self.tray.pocket_clear
        a, b = m.length + extra, m.width + extra
        return (a, b) if self.mcu_rot == 0 else (b, a)

    @property
    def mcu_stack(self) -> float:
        """Floor -> top of the tallest component on the MCU, plus air."""
        t = self.tray
        return t.standoff_h + t.mcu.thickness + t.mcu.component_height + t.clearance

    @property
    def bay_depth(self) -> float:
        """Y extent the MCU needs behind the sensor (board + 1 mm)."""
        return self.mcu_xy_size[1] + 1.0

    @property
    def post_r(self) -> float:
        return self.tray.post_dia / 2

    def switch_positions(self) -> list[tuple[float, float, float]]:
        """(x, y, inward angle) of every button: row buttons or tile plungers."""
        if self.switches.is_tiles:
            from .tiles import positions
            return positions(self)
        return self.switches.positions(self.skirt_dia)

    def lid_screw_points(self) -> list[tuple[float, float]]:
        """Deck-frame XY of the four lid screws / tray posts. With a front
        button row the front pair sits just inside that strip, beside the
        cup, so the keycaps can reach the body edge."""
        cr = self.carrier
        x = self.half_width - cr.lid_screw_inset
        y_back = self.back_length - cr.lid_screw_inset
        y_front = -(self.front_length - cr.lid_screw_inset)
        sw = self.switches
        if sw.count and sw.placement == "front":
            y_front = -(self.skirt_dia / 2 + sw.gap_to_cup) + cr.screw_head_dia / 2 + 1.0
        return [(-x, y_front), (x, y_front), (-x, y_back), (x, y_back)]

    # ---- plan layout (deck frame), ball at the origin = centre ----
    # The body is the cup skirt plus padding on every side. A button row at the
    # front adds a strip there, mirrored at the back so the ball stays centred.
    # Electronics do NOT grow the body: validate() tells you what padding they need.
    @property
    def button_strip(self) -> float:
        """Extra length a front button row needs (gap + button depth)."""
        sw = self.switches
        if not sw.count or sw.is_tiles:
            return 0.0
        return sw.gap_to_cup + sw.type.size_in

    @property
    def half_width(self) -> float:
        hw = self.skirt_dia / 2 + self.carrier.padding
        sw = self.switches
        if sw.count and sw.placement not in ("front", "tiles"):
            hw += sw.gap_to_cup + sw.type.size_in
        return hw

    @property
    def front_length(self) -> float:
        """Ball axis -> front edge."""
        hl = self.skirt_dia / 2 + self.carrier.padding
        if self.switches.count and self.switches.placement == "front":
            hl += self.button_strip
        return hl

    @property
    def back_length(self) -> float:
        """Ball axis -> back edge (= front when the button strip is mirrored)."""
        if self.switches.count and self.switches.placement == "front" and not self.switches.mirror:
            return self.skirt_dia / 2 + self.carrier.padding
        return self.front_length

    @property
    def half_length(self) -> float:
        return (self.front_length + self.back_length) / 2

    @property
    def footprint(self) -> tuple[float, float, float, float]:
        """(width, length, centre_x, centre_y) of the lid outline, deck frame."""
        return (2 * self.half_width, self.front_length + self.back_length,
                0.0, (self.back_length - self.front_length) / 2)

    # ---- what fits inside (world frame, at floor level) ----
    @property
    def inner_half_width(self) -> float:
        return self.half_width - self.tray.wall

    @property
    def back_space(self) -> float:
        """Usable floor space behind the sensor PCB for the MCU (world Y).
        A board against a side wall must also stop before the back corner post."""
        tilt = math.radians(self.deck.tilt_deg)
        t = self.tray
        y_deck = self.back_length - t.wall - 1.0
        if t.usb_exit == "side":
            y_deck = min(y_deck, self.back_length - self.carrier.lid_screw_inset - self.post_r - 0.5)
        y_world = (y_deck - self.z_floor_top_nobat * math.sin(tilt)) / max(math.cos(tilt), 1e-6)
        return y_world - self.bay_y0

    @property
    def front_space(self) -> float:
        """Floor space in front of the MCU bay for the battery (world Y)."""
        tilt = math.radians(self.deck.tilt_deg)
        y_deck = -(self.front_length - self.tray.wall)
        y_world = (y_deck - self.z_floor_top_nobat * math.sin(tilt)) / max(math.cos(tilt), 1e-6)
        if self.tray.mcu_place == "under":
            return (self.back_length - self.tray.wall - 1.0) - y_world
        return (self.bay_y0 - 1.0) - y_world

    def problems(self) -> list[dict]:
        """Structured fit problems: {"message", "fix": {option: value}}.
        ``fix`` is the smallest change that makes this problem go away."""
        probs: list[dict] = []
        t = self.tray
        pad = self.carrier.padding
        inner_w = 2 * self.inner_half_width

        def add(msg: str, padding_needed: float | None = None, alt: str = ""):
            fix = {"padding": round(padding_needed + 0.25, 1)} if padding_needed is not None else {}
            hint = _("use --padding {value:g} or more").format(value=fix["padding"]) if fix else ""
            if alt:
                hint = _("{hint}, or {alternative}").format(hint=hint, alternative=alt) if hint else alt
            probs.append({"message": f"{msg}: {hint}" if hint else msg, "fix": fix})

        # front button row: fits the width, and the front lid screws clear the cup skirt
        sw = self.switches
        cr = self.carrier
        if sw.count and sw.placement == "front":
            limit = self.half_width - t.wall - 0.5
            if sw.row_half_width() > limit:
                add(_("button row ({count} x {u:g}u {switch} = {width:.1f} mm) is wider than the inside of the body").format(
                    count=sw.count, u=sw.keycap_u, switch=sw.type.name, width=2 * sw.row_half_width()),
                    pad + (sw.row_half_width() - limit))
            x_screw = self.half_width - cr.lid_screw_inset
            min_x = self.skirt_dia / 2 + cr.screw_head_dia / 2 + 0.5
            if x_screw < min_x:
                add(_("the front lid screws (beside the cup) would hit the cup skirt"), pad + (min_x - x_screw))
        # tiles: a valid count, and room between the ring and the hinge for the finger and the switch
        if sw.is_tiles:
            from .tiles import TILE_COUNTS, TILE_DEPTH_MIN, tile_depth
            if sw.count not in TILE_COUNTS:
                near = min(TILE_COUNTS, key=lambda n: (abs(n - sw.count), n))
                probs.append({"message": _("tiles come in {counts}: use --switches {near}").format(
                    counts=", ".join(map(str, TILE_COUNTS)), near=near), "fix": {"switches": near}})
            else:
                depth = tile_depth(self)
                if depth < TILE_DEPTH_MIN - 0.05:
                    add(_("the tiles are only {depth:.1f} mm deep between the cup ring and the hinge "
                          "({needed:g} mm needed for the finger and the microswitch)").format(depth=depth, needed=TILE_DEPTH_MIN),
                        pad + (TILE_DEPTH_MIN - depth))
        # MCU
        m = t.mcu
        mx, my = self.mcu_xy_size
        if mx + 2.0 > inner_w:
            add(_("MCU {mcu} needs {needed:.1f} mm across but the inside is {inside:.1f} mm wide").format(
                mcu=m.name, needed=mx + 2.0, inside=inner_w), pad + (mx + 2.0 - inner_w) / 2)
        if t.mcu_place == "behind" and self.bay_depth > self.back_space:
            add(_("MCU {mcu} needs {needed:.1f} mm behind the sensor but only {free:.1f} mm are free before the back posts").format(
                mcu=m.name, needed=self.bay_depth, free=max(self.back_space, 0.0)),
                pad + (self.bay_depth - self.back_space), _("put it under the sensor with --mcu-place under"))
        if t.usb_exit == "back" and mx / 2 + 0.5 > self.half_width - cr.lid_screw_inset - self.post_r:
            add(_("MCU {mcu} (turned for a back USB) runs into the back corner posts").format(mcu=m.name),
                pad + (mx / 2 + 0.5 - (self.half_width - cr.lid_screw_inset - self.post_r)))
        if t.mcu_place == "under":
            inner_l = self.front_length + self.back_length - 2 * t.wall
            if my + 2.0 > inner_l:
                add(_("MCU {mcu} needs {needed:.1f} mm front-to-back under the sensor but the inside is {inside:.1f} mm").format(
                    mcu=m.name, needed=my + 2.0, inside=inner_l), pad + (my + 2.0 - inner_l) / 2)
        # cup scoops (dome / block) must stay above the ball-support pockets
        cup = self.cup
        if cup.scoop_axes:
            sup = cup.support
            dist = self.ball.r + sup.contact_height
            th = math.radians(cup.support_polar_deg)
            worst = 0.0
            for i in range(cup.support_count):
                az = math.radians(cup.azimuth0 + 360.0 * i / cup.support_count)
                sx, sy = dist * math.sin(th) * math.cos(az), dist * math.sin(th) * math.sin(az)
                pocket_top = -dist * math.cos(th) + sup.body_radius() * math.sin(th) + 1.0
                zc = cup.cut_surface_z(sx, sy, self.ball.r)
                if zc < pocket_top:
                    worst = max(worst, pocket_top - zc)
            if worst > 0:
                probs.append({"message": _("the cup scoops cut into the ball-support pockets: use --cup-cut {value:.1f} or less, "
                                           "or lower --polar / use smaller supports").format(value=max(cup.cut - worst, 0)),
                              "fix": {"cup_cut": round(max(cup.cut - worst - 0.25, 0.0), 1)}})
        # battery
        if self.battery.enabled:
            bl, bw = self.battery.outer
            if bl > inner_w - 2.0:
                add(_("battery {length:g} mm long does not fit the {inside:.1f} mm wide inside").format(
                    length=self.battery.length, inside=inner_w), pad + (bl + 2.0 - inner_w) / 2)
            if bw > self.front_space:
                add(_("battery {width:g} mm wide needs {needed:.1f} mm under the sensor but only {free:.1f} mm are free before the MCU").format(
                    width=self.battery.width, needed=bw, free=self.front_space), pad + (bw - self.front_space))
        return probs

    def validate(self) -> list[str]:
        """Human-readable problems. Empty list = everything fits."""
        return [p["message"] for p in self.problems()]

    # ---- world frame Z levels ----
    @property
    def z_floor_top_nobat(self) -> float:
        z0 = self.z_pcb_face
        t = self.tray
        needs: list[tuple[tuple[float, float], float]] = []
        for k in range(8):   # sensor PCB + header
            a = math.radians(45 * k)
            needs.append(((self.pcb.r * math.cos(a), self.pcb.r * math.sin(a)),
                          self.pcb.thickness + self.pcb.header_height + t.clearance))
        if self.switches.count:
            dsw = self.switches.depth_below_lid(self.carrier.thickness) + t.clearance
            s = max(self.switches.type.size_in, self.switches.size_across) / 2
            for x, y, _ang in self.switch_positions():
                for sx in (-1, 1):
                    for sy in (-1, 1):
                        needs.append(((x + sx * s, y + sy * s), dsw))
        if t.mcu_place == "behind":
            hw = self.mcu_xy_size[0] / 2
            stack = self.mcu_stack + self.holder_over_mcu()
            for y in (self.bay_y0, self.bay_y0 + self.bay_depth):
                for x in (-hw, hw):
                    needs.append(((x, y), stack))
        return min(self.deck_to_world((x, y, z0))[2] - depth for (x, y), depth in needs)

    def holder_over_mcu(self) -> float:
        """Extra depth the MCU bay needs when a tile's switch holder hangs above the board."""
        if not self.switches.is_tiles or self.tray.mcu_place != "behind":
            return 0.0
        from .tiles import holder_boxes
        mx, my = self.mcu_xy_size
        cxm, cym = self.mcu_center()
        bx0, bx1, by0, by1 = cxm - mx / 2, cxm + mx / 2, cym - my / 2, cym + my / 2
        for x0, x1, y0, y1 in holder_boxes(self):
            if x0 < bx1 and x1 > bx0 and y0 < by1 and y1 > by0:
                return self.switches.depth_below_lid(self.carrier.thickness) + self.tray.clearance
        return 0.0

    @property
    def z_floor_top(self) -> float:
        """World Z of the tray floor's inside face. A battery (and an MCU
        placed under the sensor) lowers it by exactly its own height."""
        z = self.z_floor_top_nobat - self.battery.extra_height
        if self.tray.mcu_place == "under":
            z -= self.mcu_stack
        return z

    @property
    def mcu_standoff_h(self) -> float:
        """Standoffs grow when the MCU sits above a battery."""
        t = self.tray
        if t.mcu_place == "under" and self.battery.enabled:
            return t.standoff_h + self.battery.extra_height
        return t.standoff_h

    @property
    def z_floor_bottom(self) -> float:
        return self.z_floor_top - self.tray.floor

    # ---- world-frame floor positions ----
    def mcu_center(self) -> tuple[float, float]:
        """World XY of the board centre. The USB end is parked 1 mm from its wall."""
        t = self.tray
        sx, sy = self.mcu_xy_size
        if t.usb_exit == "back":
            x = 0.0
            y = self.back_length - t.wall - 1.0 - sy / 2
            if t.mcu_place == "behind" and self.bay_y0 + sy / 2 > y:
                y = self.bay_y0 + sy / 2
            return x, y
        x = t.usb_side * (self.inner_half_width - 1.0 - sx / 2)
        y = self.bay_y0 + sy / 2 if t.mcu_place == "behind" else 0.0
        return x, y

    def battery_center(self) -> tuple[float, float]:
        b = self.battery
        y = min(0.0, self.bay_y0 - 1.0 - b.outer[1] / 2)
        return 0.0, y

    # ---- floor plane helpers (world frame) ----
    def floor_xy(self, xd: float, yd: float) -> tuple[float, float]:
        """World XY where the deck-frame vertical through (xd, yd) meets the
        tray bottom plane (the walls lean with tilt/tent)."""
        zd = self.z_pcb_face
        for _i in range(8):
            w = self.deck_to_world((xd, yd, zd))
            zd += self.z_floor_bottom - w[2]
        w = self.deck_to_world((xd, yd, zd))
        return w[0], w[1]

    def feet_xy(self) -> list[tuple[float, float]]:
        if self.tray.feet_dia <= 0:
            return []
        i = self.tray.feet_inset
        pts = [(sx * (self.half_width - i), yy) for sx in (-1, 1)
               for yy in (-(self.front_length - i), self.back_length - i)]
        return [self.floor_xy(x, y) for x, y in pts]

    def height_breakdown(self) -> str:
        t = self.tray
        parts = [_("ball r {v:g}").format(v=self.ball.r), _("optics {v:g}").format(v=self.lens.ball_above_pcb),
                 _("PCB+header {v:g}").format(v=self.pcb.thickness + self.pcb.header_height),
                 _("air {v:g}").format(v=t.clearance), _("floor {v:g}").format(v=t.floor)]
        if self.battery.enabled:
            parts.append(_("battery {v:g}").format(v=self.battery.extra_height))
        if t.mcu_place == "under":
            parts.append(_("MCU under {v:g}").format(v=self.mcu_stack))
        note = ""
        if t.mcu_place == "behind" and self.mcu_stack > self.pcb.thickness + self.pcb.header_height + t.clearance:
            note = _("; the MCU stack ({v:g} mm) sets the floor, not the header").format(v=self.mcu_stack)
        return " + ".join(parts) + note

    # ---- palm rest (separate part, deck frame outline) ----
    @property
    def palm_y_range(self) -> tuple[float, float]:
        y1 = -self.half_length - 0.5          # 0.5 mm gap to the body
        return y1 - self.deck.palm_length, y1

    def bom(self) -> list[dict]:
        """Bill of materials: everything that is not printed."""
        sw, t, b = self.switches, self.tray, self.battery
        items: list[dict] = [
            {"item": _("Trackball Ø{d:g} mm").format(d=self.ball.diameter), "qty": 1,
             "note": _("a two-colour or speckled ball tracks best")},
            {"item": _("Sensor board: {name}").format(name=self.pcb.name), "qty": 1,
             "note": _("PMW3360 / PMW3389 with the LM19-LSI lens")},
            {"item": _("Controller: {name}").format(name=t.mcu.name), "qty": 1,
             "note": (_("wireless capable") if t.mcu.wireless else "USB") +
             (_(", on 4x M2x6 self-tapping screws") if t.mcu.holes else _(", friction pocket (dab of glue)"))},
        ]
        sup = self.cup.support
        kind = sup.kind
        items.append({"item": _("Ball support: {support}").format(support=sup.describe()), "qty": self.cup.support_count,
                      "note": _("press fit") if kind == "btu" else (_("plus one M3x25 screw each as axle") if kind == "bearing"
                                                                    else _("snap into the printed sockets"))})
        if sw.count:
            n = sw.count if sw.is_tiles else sw.count * (2 if sw.placement == "sides" else 1)
            if sw.type.kind == "key":
                items.append({"item": _("{switch} switches").format(switch=sw.type.name), "qty": n,
                              "note": _("wired GPIO to GND, internal pull-up")})
                items.append({"item": _("keycaps {u:g}u").format(u=sw.keycap_u), "qty": n, "note": _("any profile")})
            else:
                items.append({"item": _("Omron D2F / Kailh GM microswitches"), "qty": n,
                              "note": _("pushed into the holder blocks under the tiles") if sw.is_tiles else _("pushed into the holder bars")})
        if b.enabled:
            items.append({"item": _("LiPo {l:g}x{w:g}x{t:g} mm").format(l=b.length, w=b.width, t=b.thickness), "qty": 1,
                          "note": _("plus a slide switch for the side-wall slot")})
        items += [
            {"item": _("M3 heat-set inserts (Ø4 x 5 mm)"), "qty": 10, "note": _("4 cup, 2 sensor PCB, 4 tray posts")},
            {"item": _("M3x8 screws"), "qty": 8, "note": _("cup to carrier (4), lid to tray (4)")},
            {"item": _("M3x6 screws"), "qty": 2, "note": _("sensor PCB to carrier")},
            {"item": _("Rubber feet Ø{d:g} mm").format(d=t.feet_dia), "qty": 4 if t.feet_dia > 0 else 0, "note": _("self-adhesive")},
            {"item": _("Wire (6 for the sensor SPI, 2 per switch)"), "qty": 1, "note": _("JST or direct solder")},
        ]
        return [i for i in items if i["qty"]]

    def summary(self) -> str:
        w, l, _cx, _cy = self.footprint
        sw = self.switches
        corners = [(sx * w / 2, sy * l / 2) for sx in (-1, 1) for sy in (-1, 1)]
        top = max(self.deck_to_world((x, y, self.z_carrier_top))[2] for x, y in corners)
        top = max(top, self.ball.r)
        if sw.is_tiles:
            sw_line = _("{n} tiles around the ball over microswitches").format(n=sw.count)
        elif sw.count:
            sw_line = _("{n} x {switch} at the {placement}").format(n=sw.count, switch=sw.type.name, placement=_(sw.placement))
        else:
            sw_line = _("none")
        centred = (_("ball centred") if self.footprint[3] == 0
                   else _("ball {d:.1f} mm behind centre").format(d=-self.footprint[3]))
        usb = _("back") if self.tray.usb_exit == "back" else _("{sign}X side").format(sign="+" if self.tray.usb_side > 0 else "-")
        lines = [
            _("ball Ø{d}  support={support} x{n} @ {polar}°").format(
                d=self.ball.diameter, support=self.cup.support.describe(), n=self.cup.support_count, polar=self.cup.support_polar_deg),
            _("cup {shape}, skirt Ø{skirt:.1f}   ball centre {h:.2f} mm above PCB front").format(
                shape=self.cup.shape, skirt=self.skirt_dia, h=self.lens.ball_above_pcb),
            _("deck tilt/tent                    : {tilt}° / {tent}°").format(tilt=self.deck.tilt_deg, tent=self.deck.tent_deg)
            + (_(", separate palm rest {l:g} mm").format(l=self.deck.palm_length) if self.deck.palm_length else ""),
            _("body ({centred}, padding {pad:g}) : {w:.1f} x {l:.1f} mm; free behind sensor {free:.1f} mm, MCU needs {need:.1f}").format(
                centred=centred, pad=self.carrier.padding, w=w, l=l, free=self.back_space, need=self.bay_depth),
            _("height: floor -> ball top / back  : {a:.1f} / {b:.1f} mm  ({breakdown})").format(
                a=self.ball.r - self.z_floor_bottom, b=top - self.z_floor_bottom, breakdown=self.height_breakdown()),
            _("walls: tray {wall:g}, floor {floor:g}, lid {lid:g}, cup {cup:g} mm").format(
                wall=self.tray.wall, floor=self.tray.floor, lid=self.carrier.thickness, cup=self.cup.wall)
            + (_("; {n} feet Ø{d:g}").format(n=len(self.feet_xy()), d=self.tray.feet_dia) if self.tray.feet_dia > 0 else ""),
            _("MCU                               : {mcu} {place} the sensor, USB out the {usb}").format(
                mcu=self.tray.mcu.name, place=_(self.tray.mcu_place), usb=usb)
            + (_(" (+{h:g} mm height)").format(h=self.mcu_stack) if self.tray.mcu_place == "under" else "")
            + (_("; battery {l:g}x{w:g}x{t:g} under the sensor (+{h:g} mm)").format(
                l=self.battery.length, w=self.battery.width, t=self.battery.thickness, h=self.battery.extra_height)
               if self.battery.enabled else ""),
            _("switches                          : {line}").format(line=sw_line)
            + (_(", {u:g}u caps").format(u=sw.keycap_u) if sw.count and sw.keycap_u != 1 else "")
            + (_(", front strip only") if sw.count and sw.placement == "front" and not sw.mirror else ""),
        ]
        return "\n".join(lines)
