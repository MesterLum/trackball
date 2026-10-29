# Parametric trackball module

A standalone trackball module built around the Bastard Keyboards
Charybdis PMW3360 sensor PCB, generated with Python (SolidPython2) and
rendered by OpenSCAD. Three printed parts, every dimension in one place.

```
 top view (you sit at the bottom)            side view, tilt > 0 (you at the left)
 ┌──────────────────────┐
 │   MCU lying across   │ USB out       _______________________
 │   ====================│ the side     /                       | <- back rises
 │       (  ball  )     │              /   ball    MCU          |
 │   battery under it   │             /   buttons               |
 │  [btn] [btn] [btn]   │            /___________________________|
 │     hand rest        │
 └──────────────────────┘
```

- The ball sits at the centre of the footprint, both ways.
- **cup**: ball cavity, swappable ball supports, lens window, 4 inserts.
- **carrier / lid**: the ONLY part that knows the sensor PCB hole pattern.
  Also carries the click buttons and the optional hand-rest pad recess.
- **tray**: wedge base holding the MCU (behind the ball) and the battery
  (flat under the sensor), posts for the lid screws.
- **palm rest** (optional): separate block in front, continues the deck plane.

## Usage

```sh
uv sync
uv run build.py                      # 34 mm ball, 7.5 mm BTUs, Pico, 2 Choc switches
uv run build.py --list               # every option
uv run build.py --ball 44            # cup, lid and switch row scale with the ball
uv run build.py --mcu nice-nano --battery 50x34x5    # LiPo pocket + power-switch slot
uv run build.py --tilt 10            # deck rises toward the back by 10°
uv run build.py --tilt 8 --tent 5 --palm 40          # tented, plus a separate 40 mm palm rest
uv run build.py --padding 10                         # bigger body; the validator tells you when
uv run build.py --mcu rp2040-zero --mcu-place under --switches 0 --padding 4   # smallest body
uv run build.py --mcu rp2040-zero --mcu-place under --usb back --keycap-u 1.5 --switches 2 --no-mirror
uv run build.py --header-height 3 --wall 4 --floor 4 --feet 12   # lower, thicker, bigger feet
uv run build.py --support mr63 --switch-gap 2                     # bearing rollers, spaced buttons
uv run build.py --sensor-pcb pmw3389-round                        # other sensor breakout
uv run build.py --switch-type mx --buttons sides     # MX buttons left and right of the ball
uv run build.py --switch-type micro  # flat paddles over Omron D2F microswitches
uv run build.py --support ceramic-3 --polar 50
uv run build.py --stl                # also export STLs via openscad
uv run build.py --png                # photos of every part + placement views
uv run build.py --open png           # render photos and open the contact sheet
uv run build.py --open               # generate, then open the assembly in OpenSCAD
uv run build.py --explode 15 --open section   # exploded half-section
uv run demo.py --open                # gallery of 15 configurations side by side
```

Output goes to `out/<variant>/`:

| file                      | purpose                                              |
|---------------------------|------------------------------------------------------|
| `cup.scad`                | print (flat, deck frame)                             |
| `carrier.scad`            | print (flat, deck frame)                             |
| `tray.scad`               | print (floor down, world frame)                      |
| `palmrest.scad`           | print (only with `--palm`), separate block           |
| `assembly.scad`           | preview with ball, PCB, lens, MCU, battery, switches |
| `section.scad`            | assembly cut at X=0 to inspect the sensor stack      |
| `*_placement.scad`        | one part plus the hardware that goes in it           |
| `png/index.html`          | contact sheet of all rendered views (`--png`)        |

Open any `.scad` in OpenSCAD and press F5 for a preview, F6 to render.
OpenSCAD 2021.01 renders each part in 10 to 25 s at `$fn=96`. A 2025
snapshot with Manifold is much faster if you iterate a lot.

## Web configurator (Flask API + Alpine.js + Three.js)

```sh
docker compose up --build        # then open http://localhost:8321
# or without Docker (needs openscad on PATH):
uv run flask --app web.app run   # http://127.0.0.1:5000
```

One page, no build step: Tailwind + daisyUI for the controls, Alpine.js
for state, Three.js for the 3D view. The form is generated from
`build.py`'s options. Every change calls `POST /api/design`, which
validates and returns the summary instantly; if the design fits, the
printable parts are queued (`POST /api/design/<id>/render`) and the page
follows `GET /api/design/<id>/events` (server-sent events), swapping each
STL into the viewer as OpenSCAD finishes it. STLs are cached per part by
the hash of that part's SCAD text, so changing the tilt re-renders the
tray and palm rest only. Download buttons give the STL and SCAD zips.
Generated files land in `out/web/` (`./out/web` is mounted into the
container); `out/web/cache/` holds the per-part STL cache.

API: `GET /api/options`, `POST /api/design`, `POST /api/design/<id>/render`,
`GET /api/design/<id>/status`, `GET /api/design/<id>/events`,
`GET /stl/<id>`, `GET /scad/<id>`, `GET /file/<id>/<name>`.

## Code layout

| module                  | what it owns                                               |
|-------------------------|------------------------------------------------------------|
| `trackball/config.py`   | every dimension, layout, derived Z levels, MCU presets     |
| `trackball/supports.py` | rolling options (`PressFitBTU`, `StaticBearing`, presets)  |
| `trackball/cup.py`      | ball cup                                                   |
| `trackball/carrier.py`  | lid: sensor PCB mount, switch cutouts / paddles, palm pad  |
| `trackball/tray.py`     | wedge tray, MCU mount, battery frame, USB and switch slots |
| `trackball/assembly.py` | preview / section / placement views                        |
| `build.py`              | CLI                                                        |
| `demo.py`               | gallery of configurations                                  |
| `web/app.py`            | JSON API + Alpine/Three.js configurator page                |

### Frames

- **deck frame**: origin at the ball centre, +Z normal to the lid, sensor
  PCB hole axis along +Y, user at −Y. Cup, carrier, PCB and switches are
  modelled here, which is also their print orientation.
- **world frame**: deck frame rotated by `tilt` about X and `tent` about Y.
  The desk is horizontal here. The tray floor, MCU and battery live here.
  The tray walls stay perpendicular to the deck, so the sides lean like the
  ProtoArc EM06's. `Design.deck_to_world()` / `world_to_deck()` convert.

### Sizing rules

- **Body = cup skirt + `--padding`** on every side (default 9 mm). The cup
  skirt follows the ball, so a 34 mm ball gives a 67.6 mm wide body, a 55 mm
  ball an 88.6 mm one. The ball is at the centre.
- **Buttons in front** (`--buttons front`, the default) add one strip
  (gap + button depth) to the front. The back gets the same strip so the
  body stays symmetric and the ball centred; that strip is where the MCU
  lives. `--no-mirror` skips the back strip (smaller, ball off-centre).
  `left`, `right` and `sides` widen the body instead. `--keycap-u 1.5`
  scales keycap width and pitch (Choc 18 mm/u, MX 19.05 mm/u) and
  `--switch-gap 2` adds space between neighbouring buttons.
- **MCU placement**: `--mcu-place behind` (default) lies across behind the
  sensor; `--mcu-place under` puts it on the floor under the sensor so the
  body can stay ball + padding, and the tray grows by the board's stack
  height (about 8.5 mm). `--usb back` turns the board so the cable leaves
  the back wall instead of the side; for a Pico that needs a lot of padding
  behind, for small boards it is free.
- **Electronics never grow the body.** `Design.validate()` checks that the
  MCU fits behind the sensor, that the battery fits under it and that the
  button row fits the width. If not, `build.py` stops and prints the
  `--padding` value that makes it fit (`--force` overrides).
- **Battery** lies flat on the floor under the sensor (`L` along X, `W`
  along Y); the tray grows by the cell thickness + 1 mm, nothing else moves.
- **Palm rest** (`--palm MM`) is a separate printed block in front of the
  body: same width, same lean, top 2 mm below the deck plane. `--palm-pad`
  adds a 1 mm recess for a leather/foam pad. It does not change the body.
- The tray floor height is computed from everything under the lid: sensor
  header, switch bodies, MCU. With tilt the back gets taller automatically.
  The summary prints the breakdown (ball radius + 6 mm optics + PCB and
  header + air + floor ...). The one soft number is the sensor header:
  `--header-height 3` for soldered wires or a right-angle header lowers
  the module by up to 6 mm.
- **Walls**: tray wall and floor 3 mm (`--wall`, `--floor`), lid 5 mm, cup 3 mm.
- **Feet**: four rubber-foot recesses in the bottom, `--feet DIA` (default
  10 mm, 1 mm deep, 0 = none). They follow the leaning walls.
- **USB**: `--usb right|left|back` picks the wall the cable leaves.

### Adding a rolling option

Subclass `BallSupport` in `supports.py`. Define the local frame with the
origin at the seat point and +Z toward the ball, then provide
`contact_height`, `cutter()`, `body_reach()`, `body_radius()` and
optionally `preview()`. Register it in `SUPPORTS`.

### Using another sensor breakout

Edit `SensorPCB` in `config.py` (or write a new `pcb_features()` in
`carrier.py`) and reprint only the carrier. The cup window fits any
PMW3360/PMW3389 board that uses the LM19-LSI lens. A PMW3610 board needs
a smaller window: change `Lens`.

### Adding an MCU

Add an `MCU(...)` preset in `config.py`: length along the USB axis, width,
mounting holes as (along, across) from the board centre (empty tuple gives
a friction pocket), USB size, tallest component, BOOTSEL position.

## Hardware

- Sensor PCB: Bastardkb `charybdis-pmw-3360-sensor-pcb`, round Ø41.8 mm,
  two M3 holes 37 mm apart, header and sensor body on the back, lens
  through the front. Mounted lens-side up against the carrier.
- Supports: 3x Veichu VCN310 7.5 mm BTUs, press fit (default), 3 mm
  ceramic balls (`ceramic-3`), 4.8 mm BTUs (`btu-4.8`), or small ball
  bearings on M3 screws (`mr63` = MR63RS 3x6x2.5, `mr83`, `mr84`). The
  bearing sits in a slot with its axle horizontal; the screw enters from
  the outside of the cup skirt through a clearance hole and bites into a
  thread-forming hole beyond the bearing.
- Sensor board: `--sensor-pcb bastardkb` (default, measured from the KiCad
  file) or `pmw3389-round` (generic round PMW3389 module, same lens;
  dimensions are a guess from the photo, measure yours and edit
  `PMW3389_ROUND` in `config.py`). The carrier is the only part that changes.
- Screws: M3 heat-set inserts (Ø4 hole): 4 in the cup, 2 in the carrier,
  4 in the tray posts. M3x8 for cup and lid, M3x6 for the PCB.
  M2x6 self-tapping for Pico-style boards.
- MCU presets: `pico`, `pico-w`, `pico2`, `rp2040-zero`, `xiao`,
  `nice-nano`, `supermini`, `pro-micro`. Boards without mounting holes get
  a friction pocket; add a dab of glue or tape.
- Battery: `--battery LxWxT` makes a framed pocket for that cell under the
  sensor (L along X, W along Y) plus a slide-switch slot in the USB wall. Useful with the wireless boards
  (nice!nano, Supermini, XIAO nRF52840, Pico W with a LiPo shim).
- Click switches, three types:
  - `choc-v1` (default): 13.8 mm plate cutout with a relief pocket under
    the 5 mm lid, leaving a 1.3 mm plate for the clips.
  - `mx`: 14 mm cutout, 1.5 mm plate. Deeper body, the tray floor adapts.
  - `micro`: EM06-style flat paddles printed into the lid. Each paddle is
    2.5 mm thick, freed on three sides by a 0.8 mm slot, hinged at the
    outer edge by a 0.8 mm flexure. A bar under the paddle tip holds an
    Omron D2F / Kailh GM microswitch (12.8 x 5.8 x 6.5 mm) pushed in from
    below; the plunger touches the paddle at rest and the paddle bottoms
    out on the bar after 0.5 mm. Print the lid in PETG for the flexures.
  Wire each switch between a GPIO and GND and use the internal pull-up.

## Assembly

1. Press inserts: 4 in the cup bottom, 2 in the carrier underside,
   4 in the tray posts.
2. Press the BTUs into the cup until the flange seats.
3. Screw the sensor PCB to the carrier underside, lens pointing up
   through the window. The header hangs down into the tray.
   Snap key switches in from the top, or push microswitches up into their
   bars and fix with a drop of glue.
4. Screw the cup onto the carrier (4 screws from below).
5. Mount the MCU in the tray, wire the sensor header
   (GND, MISO, SCLK, MOSI, NCS, 5V) to SPI pins, route the USB out the
   back cutout. Drop the battery in its frame, wires toward the MCU.
6. Drop the carrier onto the tray and fix the 4 corner screws.
7. Drop the ball in.

## Numbers to verify before trusting a print

- **Lens stack**: `Lens.top_above_pcb = 3.6` and `Lens.lens_to_ball = 2.4`
  put the ball surface 6.0 mm above the PCB front face. These come from the
  PMW3360 datasheet assembly drawing (via community OpenSCAD models), not
  from measuring a Bastardkb board. Check Figure 4/5 of the PMW3360
  datasheet or measure your lens. If tracking is poor, tune
  `lens_to_ball` in ±0.2 mm steps.
- **Bearing rollers**: `RollerBearing` assumes an M3 screw as the axle
  (3.3 mm clearance hole, 2.6 mm thread-forming hole). Check the screw
  length: it is the skirt-to-bearing distance printed by the cup plus 6 mm.
- **PMW3389 round module**: diameter, hole spacing and header position in
  `PMW3389_ROUND` are placeholders.
- **BTU envelope**: `PressFitBTU` defaults (Ø7.5 shaft, Ø9 flange, contact
  1.6 mm above the flange) were taken from Bastardkb's Veichu drop-in part,
  not from a VCN310 datasheet. Measure one unit: shaft diameter and length,
  flange diameter, ball top above flange. `shaft_len` only needs to be at
  least the real shaft length.
- **Press fit**: `press_fit_oversize = 0.1`. Print one cup at low `$fn` first.
- **Microswitch**: `SwitchType.body`, `plunger_h` and `plunger_from_end`
  are generic D2F numbers. Measure your switch, and print one lid to tune
  `paddle_gap` and `hinge_t` for the click feel.
- **MCU presets**: board sizes are nominal; BOOTSEL positions are
  approximate (the access hole is Ø4 so there is slack).
