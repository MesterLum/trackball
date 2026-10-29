"""Ball supports: the things the trackball rolls on.

Each support is defined in its own LOCAL frame:
  * origin = the "seat point": where the support's reference plane meets the
    support axis (for a flanged BTU that is the flange underside, for a
    static bearing it is the bearing centre)
  * +Z     = toward the trackball centre
A support only needs to tell the cup two things:
  * ``contact_height``: distance from the seat point to where it touches the
    trackball, measured along +Z
  * ``cutter()``: the volume the cup must remove to host it
Add a new rolling option by subclassing ``BallSupport``.
"""
from __future__ import annotations

from dataclasses import dataclass

from solid2 import cylinder, sphere, union, color

BIG = 60.0  # "cut all the way" length


class BallSupport:
    contact_height: float = 0.0

    def prepare(self, ball_r: float, polar_deg: float, r_out: float) -> None:
        """Called by the cup before cutter(): where on the cup the support sits."""

    def cutter(self, fn: int):
        raise NotImplementedError

    def body_reach(self) -> float:
        """How far the cutter extends along -Z (away from the ball)."""
        raise NotImplementedError

    def body_radius(self) -> float:
        """Largest radius of the cutter around the axis."""
        raise NotImplementedError

    def preview(self, fn: int):
        """Optional visual model for the assembly view."""
        return None

    def describe(self) -> str:
        return type(self).__name__


@dataclass
class PressFitBTU(BallSupport):
    """Flanged, press-fit ball transfer unit (Veichu VCN310 7.5 mm by default).

    Defaults were taken from Bastardkb's "Veichu drop-in" part, which copies
    the VCN310 envelope: Ø7.5 shaft, Ø9 flange, rolling ball top 1.6 mm above
    the flange underside. Measure your own units and override.
    """
    shaft_dia: float = 7.5
    shaft_len: float = 5.0        # hole depth; a bit more than the real shaft is fine
    flange_dia: float = 9.0
    flange_h: float = 1.1
    ball_top_above_flange: float = 1.6
    press_fit_oversize: float = 0.1   # hole = shaft + this (FDM: 0.0..0.2)
    flange_clear: float = 0.4

    @property
    def contact_height(self) -> float:  # type: ignore[override]
        return self.ball_top_above_flange

    def body_reach(self) -> float:
        return self.shaft_len

    def body_radius(self) -> float:
        # radius of the deepest element (the shaft hole); the flange pocket
        # sits above the seat, toward the ball
        return (self.shaft_dia + self.press_fit_oversize) / 2

    def cutter(self, fn: int):
        hole = cylinder(d=self.shaft_dia + self.press_fit_oversize,
                        h=self.shaft_len + 0.01, _fn=fn).down(self.shaft_len)
        # pocket above the seat so the flange + ball can reach the trackball
        pocket = cylinder(d=self.flange_dia + self.flange_clear,
                          h=self.contact_height + 2.0, _fn=fn)
        return hole + pocket

    def preview(self, fn: int):
        shaft = cylinder(d=self.shaft_dia, h=self.shaft_len, _fn=fn).down(self.shaft_len)
        flange = cylinder(d=self.flange_dia, h=self.flange_h, _fn=fn)
        ball_d = 2 * (self.ball_top_above_flange - self.flange_h) + 1.0
        ball = sphere(d=ball_d, _fn=fn).up(self.ball_top_above_flange - ball_d / 2)
        return color("silver")(shaft + flange + ball)

    def describe(self) -> str:
        return f"BTU Ø{self.shaft_dia} press-fit"


@dataclass
class StaticBearing(BallSupport):
    """A single ceramic ball pressed into a printed socket (Charybdis-style).

    Seat point is the bearing centre. The opening toward the trackball is
    slightly smaller than the bearing so it snaps in and stays.
    """
    ball_dia: float = 3.0
    socket_oversize: float = 0.1
    opening_undersize: float = 0.3

    @property
    def contact_height(self) -> float:  # type: ignore[override]
        return self.ball_dia / 2

    def body_reach(self) -> float:
        return self.ball_dia / 2 + self.socket_oversize

    def body_radius(self) -> float:
        return self.ball_dia / 2 + self.socket_oversize

    def cutter(self, fn: int):
        socket = sphere(d=self.ball_dia + self.socket_oversize, _fn=fn)
        opening = cylinder(d=self.ball_dia - self.opening_undersize,
                           h=self.ball_dia, _fn=fn)
        return socket + opening

    def preview(self, fn: int):
        return color("white")(sphere(d=self.ball_dia, _fn=fn))

    def describe(self) -> str:
        return f"static ceramic Ø{self.ball_dia}"


@dataclass
class RollerBearing(BallSupport):
    """A small ball bearing (MR63RS: 3 x 6 x 2.5 mm by default) on an M3 screw,
    the Charybdis "static-bearing-screws" idea. The bearing's outer race
    rolls on the trackball. Its axle is horizontal (tangent to the cup) and
    the screw comes in from the outside of the cup skirt: clearance hole up
    to the bearing, then a thread-forming hole beyond it.

    Local frame: origin at the bearing centre, +Z toward the trackball,
    the axle along local Y.
    """
    od: float = 6.0
    width: float = 2.5
    bore: float = 3.0
    slot_clear: float = 0.3           # per side of the bearing width
    radial_clear: float = 0.6         # around the outer race
    screw_clear_dia: float = 3.3      # clearance hole, outside -> bearing
    screw_tap_dia: float = 2.6        # thread-forming hole beyond the bearing
    screw_tap_len: float = 6.0
    head_dia: float = 6.0
    _exit: float = 20.0               # distance seat -> outer skirt along the axle (set by prepare)

    @property
    def contact_height(self) -> float:  # type: ignore[override]
        return self.od / 2

    def prepare(self, ball_r: float, polar_deg: float, r_out: float) -> None:
        import math
        r_seat = (ball_r + self.contact_height) * math.sin(math.radians(polar_deg))
        self._exit = math.sqrt(max(r_out * r_out - r_seat * r_seat, 1.0))

    def body_reach(self) -> float:
        return self.od / 2 + 1.0

    def body_radius(self) -> float:
        return self.od / 2 + self.radial_clear

    def cutter(self, fn: int):
        from solid2 import cube
        w = self.width + 2 * self.slot_clear
        r = self.od / 2 + self.radial_clear
        # slot: the bearing disc in the XZ plane, open toward the ball (+Z)
        slot = cube([2 * r, w, r + self.od]).translate([-r, -w / 2, -r])
        # screw: clearance from the outside (+Y) to the slot, tapped hole beyond (-Y)
        clear = cylinder(d=self.screw_clear_dia, h=self._exit + 5, _fn=fn).rotate([-90, 0, 0])
        tap = cylinder(d=self.screw_tap_dia, h=self.screw_tap_len + w / 2, _fn=fn).rotate([90, 0, 0])
        head = cylinder(d=self.head_dia, h=10, _fn=fn).rotate([-90, 0, 0]).translate([0, self._exit, 0])
        return slot + clear + tap + head

    def preview(self, fn: int):
        ring = cylinder(d=self.od, h=self.width, _fn=fn).translate([0, 0, -self.width / 2]).rotate([-90, 0, 0])
        screw = cylinder(d=self.bore, h=self._exit + self.screw_tap_len, _fn=fn).rotate([90, 0, 0]) \
            .translate([0, self._exit, 0])
        return color("silver")(ring) + color("dimgray")(screw)

    def describe(self) -> str:
        return f"bearing {self.bore:g}x{self.od:g}x{self.width:g} on M3"


# Presets -------------------------------------------------------------------
BTU_7_5 = PressFitBTU()
# Bastardkb's BTU mod uses 4.8 mm units (RS 7431408). Envelope is a guess:
# measure before printing.
BTU_4_8 = PressFitBTU(shaft_dia=4.8, shaft_len=4.0, flange_dia=6.0,
                      flange_h=1.0, ball_top_above_flange=1.3)
CERAMIC_3 = StaticBearing(ball_dia=3.0)
CERAMIC_2_5 = StaticBearing(ball_dia=2.5)

MR63 = RollerBearing(od=6.0, width=2.5, bore=3.0)      # MR63RS 3x6x2.5
MR83 = RollerBearing(od=8.0, width=3.0, bore=3.0)      # MR83RS 3x8x3
MR84 = RollerBearing(od=8.0, width=3.0, bore=4.0, screw_clear_dia=4.3, screw_tap_dia=3.5)  # MR84RS 4x8x3 on M4

SUPPORTS = {
    "btu-7.5": BTU_7_5,
    "btu-4.8": BTU_4_8,
    "ceramic-3": CERAMIC_3,
    "ceramic-2.5": CERAMIC_2_5,
    "mr63": MR63,
    "mr83": MR83,
    "mr84": MR84,
}
