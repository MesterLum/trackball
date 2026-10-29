"""All dimensions live here. Everything else derives geometry from these.

Numbers marked [kicad] were read from the Bastardkb
charybdis-pmw-3360-sensor-pcb KiCad board file.
Numbers marked [pmw3360] come from the PixArt PMW3360 / LM19-LSI assembly
drawing (via xythobuz's datasheet-derived constants). Verify against the
datasheet Figure 4/5 if your tracking is off; lens_to_ball is the one to tune.
"""
from __future__ import annotations

from dataclasses import dataclass, field

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
    # 1x6 2.54 mm header on the back, centre offset from board centre (x, y),
    # pins run along Y. [kicad]
    header_center: tuple[float, float] = (17.9, -6.4)
    header_pins: int = 6
    header_height: float = 9.0        # vertical header + pins below the back face
    # FPC connector on the opposite edge (back side). [kicad]
    fpc_center: tuple[float, float] = (-16.75, 0.0)
    fpc_size: tuple[float, float] = (6.0, 12.0)
    fpc_height: float = 3.0


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
    base_dia: float = 56.0            # cylindrical skirt that holds the supports
    base_top_below_center: float = 7.0
    carrier_screw_radius: float = 24.5
    carrier_screw_angles: tuple[float, ...] = (65, 115, 245, 295)
    insert_dia: float = 4.0           # M3 heat-set insert hole
    insert_depth: float = 5.0
    # ball supports
    support: BallSupport = field(default_factory=PressFitBTU)
    support_count: int = 3
    support_polar_deg: float = 55.0   # angle from the downward axis to contact point
    support_azimuth_deg: float = 90.0 # azimuth of the first support


# --------------------------------------------------------------------------
# Sensor carrier (the only part that knows the sensor PCB hole pattern)
# --------------------------------------------------------------------------
@dataclass
class Carrier:
    thickness: float = 5.0
    # Footprint is computed from the cup, MCU and switches unless you pin it:
    size: tuple[float, float] | None = None    # overall lid footprint (x, y)
    center: tuple[float, float] | None = None  # footprint centre vs ball axis
    margin: float = 8.0               # lid beyond the cup skirt / keycaps
    corner_r: float = 6.0
    pcb_insert_dia: float = 4.0       # M3 insert, pressed from below
    pcb_insert_depth: float = 4.5
    screw_clear_dia: float = 3.4      # M3 clearance for cup screws
    cup_screw_head_dia: float = 6.0
    cup_screw_head_depth: float = 3.0
    lid_screw_inset: float = 5.0      # corner screws into the tray posts
    bootsel_hole_dia: float = 4.0


# --------------------------------------------------------------------------
# MCU boards + tray
# --------------------------------------------------------------------------
@dataclass
class MCU:
    name: str
    length: float                     # along the USB axis
    width: float
    thickness: float = 1.0
    holes: tuple[tuple[float, float], ...] = ()   # (x, y) from board centre, x along length
    hole_dia: float = 2.1
    usb_width: float = 9.0
    usb_height: float = 3.4
    usb_overhang: float = 1.3
    component_height: float = 3.5     # tallest part on top
    bootsel: tuple[float, float] | None = None    # from board centre


PICO = MCU(
    name="pico",
    length=51.0, width=21.0,
    holes=((-23.5, -5.7), (-23.5, 5.7), (23.5, -5.7), (23.5, 5.7)),  # 47 x 11.4
    hole_dia=2.1,
    usb_width=8.0, usb_height=2.8, usb_overhang=1.3,
    bootsel=(-13.0, -3.5),   # ~12 mm from USB end, offset to one side
)

# Waveshare RP2040-Zero: no mounting holes, held by a friction pocket.
RP2040_ZERO = MCU(
    name="rp2040-zero",
    length=23.5, width=18.0,
    holes=(),
    usb_width=9.0, usb_height=3.3, usb_overhang=1.0,
    bootsel=(-8.0, 0.0),
)

# nice!nano v2 (also fits Supermini nRF52840 clones).
NICE_NANO = MCU(
    name="nice-nano",
    length=33.0, width=18.0,
    holes=(),
    usb_width=9.0, usb_height=3.3, usb_overhang=1.5,
    component_height=2.0,
)

MCUS = {m.name: m for m in (PICO, RP2040_ZERO, NICE_NANO)}


@dataclass
class Tray:
    mcu: MCU = field(default_factory=lambda: PICO)
    wall: float = 2.5
    floor: float = 2.5
    standoff_h: float = 3.0
    standoff_dia: float = 5.0
    standoff_screw_dia: float = 1.8   # M2 self-tapping into plastic
    post_dia: float = 7.0
    post_insert_dia: float = 4.0
    post_insert_depth: float = 6.0
    pocket_clear: float = 0.4         # per side, for hole-less boards
    mcu_offset_y: float = 32.0        # board centre from ball axis
    usb_side: int = +1                # +1 -> USB exits +X wall, -1 -> -X wall
    clearance: float = 1.0            # air above the tallest thing under the lid


# --------------------------------------------------------------------------
# Click switches (mounted in the lid, hanging into the tray)
# --------------------------------------------------------------------------
@dataclass
class SwitchType:
    name: str
    cutout: float                     # square plate cutout
    plate_t: float                    # plate thickness the clips expect
    pocket: float                     # relief under the plate so clips can snap
    below_plate: float                # housing + pins under the plate
    above_plate: float                # housing above the plate (no cap)
    keycap: tuple[float, float]       # keycap footprint (x, y)
    keycap_h: float                   # cap top above the housing top
    pitch: tuple[float, float]        # key spacing (x, y)


CHOC_V1 = SwitchType("choc-v1", cutout=13.8, plate_t=1.3, pocket=15.2,
                     below_plate=5.2, above_plate=5.0, keycap=(17.5, 16.5),
                     keycap_h=3.0, pitch=(18.0, 17.0))
MX = SwitchType("mx", cutout=14.0, plate_t=1.5, pocket=15.6,
                below_plate=8.3, above_plate=6.6, keycap=(18.0, 18.0),
                keycap_h=8.0, pitch=(19.05, 19.05))
SWITCH_TYPES = {s.name: s for s in (CHOC_V1, MX)}


@dataclass
class Switches:
    type: SwitchType = field(default_factory=lambda: CHOC_V1)
    count: int = 2                    # 0 disables the buttons
    side: int = -1                    # -1 -> row on the -X side of the ball, +1 -> +X
    gap_to_cup: float = 2.0           # keycap edge to cup skirt
    row_center_y: float = 0.0         # row centred on the ball axis
    rotate_deg: float = 0.0           # rotate the whole row about the ball axis

    def row_x(self, cup_base_dia: float) -> float:
        return self.side * (cup_base_dia / 2 + self.gap_to_cup + self.type.keycap[0] / 2)

    def positions(self, cup_base_dia: float) -> list[tuple[float, float]]:
        """Switch centres (x, y) in module coordinates, before rotate_deg."""
        x = self.row_x(cup_base_dia)
        py = self.type.pitch[1]
        return [(x, self.row_center_y + (i - (self.count - 1) / 2) * py) for i in range(self.count)]


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
    fn: int = 96                      # OpenSCAD $fn for curved surfaces

    # ---- footprint shared by carrier and tray ----
    @property
    def footprint(self) -> tuple[float, float, float, float]:
        """(width, length, centre_x, centre_y) of the lid/tray outline."""
        cr = self.carrier
        if cr.size is not None and cr.center is not None:
            return (*cr.size, *cr.center)
        half = self.cup.base_dia / 2
        x_min, x_max = -(half + cr.margin), half + cr.margin
        y_min = -(half + 2.5)
        y_max = self.tray.mcu_offset_y + self.tray.mcu.width / 2 + 10.0
        sw = self.switches
        if sw.count:
            ext = abs(sw.row_x(self.cup.base_dia)) + sw.type.keycap[0] / 2 + cr.margin - 2.0
            if sw.side < 0:
                x_min = min(x_min, -ext)
            else:
                x_max = max(x_max, ext)
        return x_max - x_min, y_max - y_min, (x_max + x_min) / 2, (y_max + y_min) / 2

    # ---- derived Z levels (all relative to ball centre) ----
    @property
    def z_pcb_face(self) -> float:
        """Front face of the sensor PCB (lens side)."""
        return -(self.ball.r + self.lens.ball_above_pcb)

    @property
    def z_carrier_top(self) -> float:
        return self.z_pcb_face + self.carrier.thickness

    @property
    def z_cup_bottom(self) -> float:
        return self.z_carrier_top

    @property
    def z_tray_floor_top(self) -> float:
        """Inside floor level. Must clear the sensor header and the MCU."""
        t = self.tray
        under_pcb = self.z_pcb_face - self.pcb.thickness - self.pcb.header_height - t.clearance
        under_mcu = (self.z_pcb_face - t.clearance - t.mcu.component_height
                     - t.mcu.thickness - t.standoff_h)
        return min(under_pcb, under_mcu)

    @property
    def z_tray_bottom(self) -> float:
        return self.z_tray_floor_top - self.tray.floor

    @property
    def cavity_r(self) -> float:
        return self.ball.r + self.cup.gap

    def summary(self) -> str:
        w, l, _, _ = self.footprint
        sw = self.switches
        lines = [
            f"ball Ø{self.ball.diameter}  support={self.cup.support.describe()} x{self.cup.support_count} @ {self.cup.support_polar_deg}°",
            f"ball centre above PCB front face : {self.lens.ball_above_pcb:.2f} mm",
            f"z PCB face / carrier top          : {self.z_pcb_face:.2f} / {self.z_carrier_top:.2f}",
            f"z tray floor top / bottom         : {self.z_tray_floor_top:.2f} / {self.z_tray_bottom:.2f}",
            f"total height (ball top -> bottom) : {self.ball.r - self.z_tray_bottom:.1f} mm",
            f"footprint                         : {w:.1f} x {l:.1f} mm",
            f"MCU                               : {self.tray.mcu.name}",
            f"switches                          : {sw.count} x {sw.type.name} on {'-X' if sw.side < 0 else '+X'} side",
        ]
        return "\n".join(lines)
