# Parametric trackball module

A standalone trackball module built around the Bastard Keyboards
Charybdis PMW3360 sensor PCB, generated with Python (SolidPython2) and
rendered by OpenSCAD. Three printed parts, every dimension in one place.

```
          ball (34 mm)
     ┌───────────────────┐
     │  cup              │  ball supports (BTU / ceramic), lens window,
     │                   │  4x M3 inserts for the carrier
     └───────────────────┘
 ════╧═══════════════════╧════  carrier / lid: the ONLY part that knows
 │   sensor PCB + lens        │  the sensor PCB hole pattern
 │                 ┌────────┐ │
 │   tray          │  MCU   │ │  Pico / RP2040-Zero / nice!nano
 └─────────────────┴────────┴─┘
```

## Usage

```sh
uv sync
uv run build.py                      # 34 mm ball, 7.5 mm BTUs, Pico, 2 Choc switches
uv run build.py --list               # options
uv run build.py --mcu rp2040-zero
uv run build.py --support ceramic-3 --polar 50
uv run build.py --ball 25 --support btu-4.8
uv run build.py --switches 3 --switch-side +1   # 3 buttons, on the USB side
uv run build.py --switches 0         # no buttons
uv run build.py --stl                # also export STLs via openscad
uv run build.py --png                # photos of every part + placement views
uv run build.py --open png           # render photos and open the contact sheet
uv run build.py --explode 15         # exploded assembly view
uv run build.py --open               # generate, then open the assembly in OpenSCAD
uv run build.py --explode 15 --open section   # exploded half-section
```

Output goes to `out/<variant>/`:

| file                      | purpose                                              |
|---------------------------|------------------------------------------------------|
| `cup.scad`                | print                                                |
| `carrier.scad`            | print                                                |
| `tray.scad`               | print                                                |
| `assembly.scad`           | preview with ball, PCB, lens, MCU, supports, switches|
| `section.scad`            | assembly cut at X=0 to inspect the sensor stack      |
| `*_placement.scad`        | one part plus the hardware that goes in it           |
| `png/index.html`          | contact sheet of all rendered views (`--png`)        |

Open any `.scad` in OpenSCAD and press F5 for a preview, F6 to render.
OpenSCAD 2021.01 renders the cup in ~20 s at `$fn=96`. A 2025 snapshot
with Manifold is much faster if you iterate a lot.

## Code layout

| module                  | what it owns                                             |
|-------------------------|----------------------------------------------------------|
| `trackball/config.py`   | every dimension, derived Z levels, MCU presets           |
| `trackball/supports.py` | rolling options (`PressFitBTU`, `StaticBearing`, presets)|
| `trackball/cup.py`      | ball cup                                                 |
| `trackball/carrier.py`  | lid + sensor PCB mount                                   |
| `trackball/tray.py`     | base tray + MCU mount                                    |
| `trackball/assembly.py` | preview/section views                                    |
| `build.py`              | CLI                                                      |

Coordinates: origin at the ball centre, +Z up, sensor PCB hole axis along +Y.

### Adding a rolling option

Subclass `BallSupport` in `supports.py`. Define the local frame with the
origin at the seat point and +Z toward the ball, then provide
`contact_height`, `cutter()`, `body_reach()`, `body_radius()` and
optionally `preview()`. Register it in `SUPPORTS`. The cup positions it
from `support_count`, `support_polar_deg` and `support_azimuth_deg`.

### Using another sensor breakout

Edit `SensorPCB` in `config.py` (or write a new `pcb_features()` in
`carrier.py`) and reprint only the carrier. The cup window fits any
PMW3360/PMW3389 board that uses the LM19-LSI lens. A PMW3610 board needs
a smaller window: change `Lens`.

## Hardware

- Sensor PCB: Bastardkb `charybdis-pmw-3360-sensor-pcb`, round Ø41.8 mm,
  two M3 holes 37 mm apart, header and sensor body on the back, lens
  through the front. Mounted lens-side up against the carrier.
- Supports: 3x Veichu VCN310 7.5 mm BTUs, press fit (default), or 3 mm
  ceramic balls (`ceramic-3`), or 4.8 mm BTUs (`btu-4.8`).
- Screws: M3 heat-set inserts (Ø4 hole): 4 in the cup, 2 in the carrier,
  4 in the tray posts. M3x8 for cup and lid, M3x6 for the PCB.
  M2x6 self-tapping for the Pico.
- MCU: Raspberry Pi Pico (default), Waveshare RP2040-Zero or nice!nano
  (friction pocket, add a dab of glue or tape).
- Click switches: 2x Kailh Choc v1 (default) in the lid beside the ball, on
  the side away from the USB. The lid is 5 mm thick, so each cutout has a
  relief pocket underneath leaving a 1.3 mm plate for the clips. Wire each
  switch between a Pico GPIO and GND and use the internal pull-up.
  `--switch-type mx` gives 14 mm MX cutouts instead.

## Assembly

1. Press inserts: 4 in the cup bottom, 2 in the carrier underside,
   4 in the tray posts.
2. Press the BTUs into the cup until the flange seats.
3. Screw the sensor PCB to the carrier underside, lens pointing up
   through the window. The header hangs down into the tray.
   Snap the switches into the lid from the top.
4. Screw the cup onto the carrier (4 screws from below).
5. Mount the MCU in the tray, wire the sensor header
   (GND, MISO, SCLK, MOSI, NCS, 5V) to SPI pins, route the USB out the
   side cutout.
6. Drop the carrier onto the tray and fix the 4 corner screws.
7. Drop the ball in.

## Numbers to verify before trusting a print

- **Lens stack**: `Lens.top_above_pcb = 3.6` and `Lens.lens_to_ball = 2.4`
  put the ball surface 6.0 mm above the PCB front face. These come from the
  PMW3360 datasheet assembly drawing (via community OpenSCAD models), not
  from measuring a Bastardkb board. Check Figure 4/5 of the PMW3360
  datasheet or measure your lens. If tracking is poor, tune
  `lens_to_ball` in ±0.2 mm steps.
- **BTU envelope**: `PressFitBTU` defaults (Ø7.5 shaft, Ø9 flange, contact
  1.6 mm above the flange) were taken from Bastardkb's Veichu drop-in part,
  not from a VCN310 datasheet. Measure one unit: shaft diameter and length,
  flange diameter, ball top above flange. `shaft_len` only needs to be at
  least the real shaft length.
- **Press fit**: `press_fit_oversize = 0.1`. Print one cup at low `$fn` first.
