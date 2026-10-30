"""Proposed configurations. Used by the web page (presets gallery) and by
demo.py (photo gallery). Values are option names from trackball.options."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .i18n import N_


@dataclass(frozen=True)
class Preset:
    key: str
    title: str
    blurb: str
    values: dict[str, Any] = field(default_factory=dict)
    tags: tuple[str, ...] = ()


PRESETS: tuple[Preset, ...] = (
    Preset("em06", N_("EM06 style"), N_("10° tilt, two 1.5u MX keys in front, 40 mm palm rest, nice!nano with a battery under the sensor."),
           {"tilt": 10, "switch_type": "mx", "switches": 2, "keycap_u": 1.5, "palm": 40, "mcu": "nice-nano",
            "battery": "50x34x5"}, ("tilt", "wireless", "palm rest")),
    Preset("em06-tiles", N_("EM06 tiles"), N_("Eight sculpted keys filling the deck around the ball over microswitches, "
           "10° tilt, 45 mm palm rest with a pad recess, nice!nano with a battery under the sensor."),
           {"buttons": "tiles", "switches": 8, "padding": 26, "tilt": 10, "palm": 45, "palm_pad": 1.5,
            "mcu": "nice-nano", "battery": "50x34x5"}, ("tiles", "tilt", "wireless", "palm rest")),
    Preset("four-tiles", N_("Four tiles"), N_("One big key on each side of the ball, printed into the lid over microswitches; "
           "RP2040-Zero under the sensor, no palm rest."),
           {"buttons": "tiles", "switches": 4, "padding": 25, "mcu": "rp2040-zero", "mcu_place": "under"}, ("tiles",)),
    Preset("nano-cradle", N_("Nano cradle"), N_("Dome cup with side lobes and deep front/back openings, 3 mm ceramic bearings set low, "
           "RP2040-Zero under the sensor, no buttons."),
           {"cup_shape": "dome", "cup_cut": 9, "rim": 2, "support": "ceramic-3", "polar": 42, "mcu": "rp2040-zero",
            "mcu_place": "under", "switches": 0, "padding": 5}, ("tiny", "cradle")),
    Preset("nano-pikes", N_("Nano pikes"), N_("Dome cup with two pointed side lobes rising to the ball's equator, V scoops front and "
           "back, sharp edges, 3 mm ceramic bearings set low, RP2040-Zero under the sensor, no buttons."),
           {"cup_shape": "dome", "cup_peak": "sharp", "cup_cut": 10, "rim": 0, "cup_round": 0, "support": "ceramic-3",
            "polar": 42, "mcu": "rp2040-zero", "mcu_place": "under", "switches": 0, "padding": 5}, ("tiny", "cradle")),
    Preset("block-cradle", N_("Block cradle"), N_("Square cup with four corner tabs holding the ball, ceramic bearings, three Choc keys."),
           {"cup_shape": "block", "cup_cut": 8, "rim": 2, "support": "ceramic-3", "supports": 4, "polar": 42},
           ("cradle", "choc")),
    Preset("default", N_("Default"), N_("34 mm ball on 7.5 mm BTUs, Raspberry Pi Pico behind the ball, three Choc buttons in front."),
           {}, ("wired", "choc")),
    Preset("minimal", N_("Minimal"), N_("Just ball plus padding: RP2040-Zero under the sensor, no buttons, 4 mm padding."),
           {"mcu": "rp2040-zero", "mcu_place": "under", "switches": 0, "padding": 4}, ("tiny",)),
    Preset("minimal-buttons", N_("Minimal with buttons"),
           N_("RP2040-Zero under the sensor, USB at the back, two 1.5u Choc keys, front strip only."),
           {"mcu": "rp2040-zero", "mcu_place": "under", "usb": "back", "switches": 2, "keycap_u": 1.5, "no_mirror": True},
           ("tiny", "choc")),
    Preset("low-profile", N_("Low profile"), N_("The default with wires soldered to the sensor instead of the header: 3 mm lower."),
           {"header_height": 3}, ("wired", "choc")),
    Preset("paddles", N_("Flat paddles"), N_("Three microswitch paddles printed into the lid, flat body, Pico."),
           {"switch_type": "micro"}, ("wired", "microswitch")),
    Preset("ball44-sides", N_("44 mm, buttons at the sides"), N_("44 mm ball, Pico W under the sensor, two MX keys on each side."),
           {"ball": 44, "mcu": "pico-w", "mcu_place": "under", "switch_type": "mx", "switches": 2, "buttons": "sides"},
           ("big ball", "mx")),
    Preset("ball55", N_("55 mm, ceramic bearings"), N_("55 mm ball on 3 mm ceramic balls, RP2040-Zero, three Choc keys."),
           {"ball": 55, "support": "ceramic-3", "mcu": "rp2040-zero"}, ("big ball", "choc")),
    Preset("compact-wireless", N_("Compact wireless"), N_("XIAO nRF52840, a 3 mm battery, two flat paddles."),
           {"mcu": "xiao", "battery": "40x25x3", "switch_type": "micro", "switches": 2}, ("wireless", "tiny")),
    Preset("big-wireless", N_("Big wireless"), N_("12° tilt, 60x40x6 battery, Supermini, three Choc keys, 50 mm padded palm rest."),
           {"tilt": 12, "battery": "60x40x6", "mcu": "supermini", "palm": 50, "palm_pad": 1},
           ("tilt", "wireless", "palm rest")),
    Preset("tented", N_("Tilted and tented"), N_("8° tilt plus 6° tent, four Choc keys, Supermini, 12 mm padding."),
           {"tilt": 8, "tent": 6, "switches": 4, "mcu": "supermini", "padding": 12}, ("tilt", "choc")),
    Preset("bearings", N_("Bearing rollers"), N_("Three MR63 bearings on M3 screws instead of BTUs, 2 mm between the keys."),
           {"support": "mr63", "switch_gap": 2}, ("bearings", "choc")),
    Preset("mx-wide", N_("MX 1.25u"), N_("Three 1.25u MX keys, Pico 2, 6° tilt, 12 mm padding."),
           {"switch_type": "mx", "keycap_u": 1.25, "mcu": "pico2", "tilt": 6, "padding": 12}, ("tilt", "mx")),
    Preset("left-cable", N_("Left cable, thick walls"), N_("USB out of the left wall, 4 mm walls and floor, 12 mm feet."),
           {"usb": "left", "wall": 4, "floor": 4, "feet": 12}, ("wired", "choc")),
    Preset("ball44-bearings", N_("44 mm on bearings"), N_("44 mm ball on MR83 bearings, Pico under the sensor, three Choc keys with 2 mm gaps."),
           {"ball": 44, "support": "mr83", "mcu_place": "under", "switch_gap": 2}, ("big ball", "bearings")),
    Preset("bare25", N_("Bare 25 mm"), N_("Smallest module: 25 mm ball on 4.8 mm BTUs, Pro Micro under the sensor, no buttons."),
           {"ball": 25, "support": "btu-4.8", "mcu": "pro-micro", "mcu_place": "under", "switches": 0, "padding": 5}, ("tiny",)),
)
BY_KEY = {p.key: p for p in PRESETS}
