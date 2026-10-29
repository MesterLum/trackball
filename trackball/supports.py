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


# Presets -------------------------------------------------------------------
BTU_7_5 = PressFitBTU()
# Bastardkb's BTU mod uses 4.8 mm units (RS 7431408). Envelope is a guess:
# measure before printing.
BTU_4_8 = PressFitBTU(shaft_dia=4.8, shaft_len=4.0, flange_dia=6.0,
                      flange_h=1.0, ball_top_above_flange=1.3)
CERAMIC_3 = StaticBearing(ball_dia=3.0)
CERAMIC_2_5 = StaticBearing(ball_dia=2.5)

SUPPORTS = {
    "btu-7.5": BTU_7_5,
    "btu-4.8": BTU_4_8,
    "ceramic-3": CERAMIC_3,
    "ceramic-2.5": CERAMIC_2_5,
}
