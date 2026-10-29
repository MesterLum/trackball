"""Proposed configurations. Used by the web page (presets gallery) and by
demo.py (photo gallery). Values are option names from trackball.options."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Preset:
    key: str
    title: str
    blurb: str
    values: dict[str, Any] = field(default_factory=dict)
    tags: tuple[str, ...] = ()


PRESETS: tuple[Preset, ...] = (
    Preset("em06", "EM06 style", "10° tilt, two 1.5u MX keys in front, 40 mm palm rest, nice!nano with a battery under the sensor.",
           {"tilt": 10, "switch_type": "mx", "switches": 2, "keycap_u": 1.5, "palm": 40, "mcu": "nice-nano",
            "battery": "50x34x5"}, ("tilt", "wireless", "palm rest")),
    Preset("default", "Default", "34 mm ball on 7.5 mm BTUs, Raspberry Pi Pico behind the ball, three Choc buttons in front.",
           {}, ("wired", "choc")),
    Preset("minimal", "Minimal", "Just ball plus padding: RP2040-Zero under the sensor, no buttons, 4 mm padding.",
           {"mcu": "rp2040-zero", "mcu_place": "under", "switches": 0, "padding": 4}, ("tiny",)),
    Preset("minimal-buttons", "Minimal with buttons",
           "RP2040-Zero under the sensor, USB at the back, two 1.5u Choc keys, front strip only.",
           {"mcu": "rp2040-zero", "mcu_place": "under", "usb": "back", "switches": 2, "keycap_u": 1.5, "no_mirror": True},
           ("tiny", "choc")),
    Preset("low-profile", "Low profile", "The default with wires soldered to the sensor instead of the header: 3 mm lower.",
           {"header_height": 3}, ("wired", "choc")),
    Preset("paddles", "Flat paddles", "Three microswitch paddles printed into the lid, flat body, Pico.",
           {"switch_type": "micro"}, ("wired", "microswitch")),
    Preset("ball44-sides", "44 mm, buttons at the sides", "44 mm ball, Pico W under the sensor, two MX keys on each side.",
           {"ball": 44, "mcu": "pico-w", "mcu_place": "under", "switch_type": "mx", "switches": 2, "buttons": "sides"},
           ("big ball", "mx")),
    Preset("ball55", "55 mm, ceramic bearings", "55 mm ball on 3 mm ceramic balls, RP2040-Zero, three Choc keys.",
           {"ball": 55, "support": "ceramic-3", "mcu": "rp2040-zero"}, ("big ball", "choc")),
    Preset("compact-wireless", "Compact wireless", "XIAO nRF52840, a 3 mm battery, two flat paddles.",
           {"mcu": "xiao", "battery": "40x25x3", "switch_type": "micro", "switches": 2}, ("wireless", "tiny")),
    Preset("big-wireless", "Big wireless", "12° tilt, 60x40x6 battery, Supermini, three Choc keys, 50 mm padded palm rest.",
           {"tilt": 12, "battery": "60x40x6", "mcu": "supermini", "palm": 50, "palm_pad": True},
           ("tilt", "wireless", "palm rest")),
    Preset("tented", "Tilted and tented", "8° tilt plus 6° tent, four Choc keys, Supermini, 12 mm padding.",
           {"tilt": 8, "tent": 6, "switches": 4, "mcu": "supermini", "padding": 12}, ("tilt", "choc")),
    Preset("bearings", "Bearing rollers", "Three MR63 bearings on M3 screws instead of BTUs, 2 mm between the keys.",
           {"support": "mr63", "switch_gap": 2}, ("bearings", "choc")),
)
BY_KEY = {p.key: p for p in PRESETS}
