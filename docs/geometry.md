# Geometry and hardware

## Frames

- **deck frame**: origin at the ball centre, +Z normal to the lid, sensor
  PCB hole axis along +Y, user at −Y. Cup, carrier, PCB and switches are
  modelled here, which is also their print orientation.
- **world frame**: deck frame rotated by `tilt` about X and `tent` about Y.
  The desk is horizontal here. The tray floor, MCU and battery live here.
  The tray walls stay perpendicular to the deck, so the sides lean like the
  ProtoArc EM06's. `Design.deck_to_world()` / `world_to_deck()` convert.

## Sizing rules

- **Body = cup skirt + `padding`** on every side (default 9 mm; auto fit raises it to fit the chosen hardware). The cup
  skirt follows the ball, so a 34 mm ball gives a nominal 67.6 mm wide body, a 55 mm
  ball an 88.6 mm one before fit adjustments. The ball is at the centre.
- **Buttons in front** (`buttons front`, the default) add one strip
  (gap + button depth) to the front. The back gets the same strip so the
  body stays symmetric and the ball centred; that strip is where the MCU
  lives. `no_mirror` skips the back strip (smaller, ball off-centre).
  `left`, `right` and `sides` widen the body instead. `keycap_u 1.5`
  scales keycap width and pitch (Choc 18 mm/u, MX 19.05 mm/u) and
  `switch_gap 2` adds space between neighbouring buttons.
- **MCU placement**: `mcu_place behind` (default) lies across behind the
  sensor; `mcu_place under` puts it on the floor under the sensor so the
  body can stay ball + padding, and the tray grows by the board's stack
  height (about 8.5 mm). `usb back` turns the board so the cable leaves
  the back wall instead of the side; for a Pico that needs a lot of padding
  behind, for small boards it is free.
- **USB fit**: `usb_type auto` (default) selects Micro-USB for Pico / Pico W /
  Pico 2 / original Pro Micro, and USB-C for the other controllers. Use
  `usb_type micro-usb` or `usb_type usb-c` for a connector variant; the
  same selector appears under Electronics in the web editor. The socket opening
  follows the board position: a rounded USB-C slot or chamfered Micro-B profile,
  with 0.3 mm clearance per side and an outer recess for the cable housing
  (at least 12 × 7 mm). Extra-large cable mouldings may need a larger recess.
  PCB and printed supports stop 0.3 mm from the actual inside USB wall,
  accounting for tilt and tenting. Screw standoffs or the sloping wall can
  determine the limit before the PCB edge does. Small-board pockets are open
  at the USB end. Fit checks include the rounded walls and lid posts.
  Changing connector type changes the socket envelope and opening, not the PCB
  outline or the connector overhang of a particular manufacturer's variant.
- **Electronics never grow the body by themselves.** `Design.validate()`
  checks that the MCU fits behind the sensor, that the battery fits under it
  and that the button row fits the width. Each problem carries its own fix;
  with the auto-fit toggle (on by default) the
  padding is raised to the smallest value that fits and the change is shown.
  Without auto fit, invalid designs show the required adjustments and cannot be exported.
- **Battery** lies flat on the floor under the sensor (`L` along X, `W`
  along Y); the tray grows by the cell thickness + 1 mm, nothing else moves.
- **Palm rest** (`palm MM`) is a separate printed block in front of the
  body: same width, same lean, top 2 mm below the deck plane. `palm_pad MM`
  adds a recess of that depth for a leather/foam pad.
  `palm_attachment separate` keeps it freely positioned (default);
  `anchored` adds two alignment tongues and a replaceable underside snap key;
  `fused` combines the palm rest and base into `tray.stl`, keeping the lid removable.
  Its joint has a square rear edge and straight side walls through the seam;
  only the exterior front corners remain rounded. The palm height/drop setting
  still controls its top relative to the lid.
  In the web editor the attachment selector appears after enabling the palm rest.
  Anchored mode needs at least 18 mm palm length and 2.5 mm floor thickness;
  auto-fit can apply these adjustments. Slide the rest toward the body, then
  press `palm_key.stl` into the underside pockets. Remove the key before pulling
  the rest away. Both pieces retain their rubber feet so palm loads go into the
  desk. Print the key flat in PETG and test its snap fit before a full print;
  the joint has 0.25 mm tongue clearance per side and 0.2 mm at the key mouth.
  Fused mode produces a larger single print; check the total size against the
  printer bed. The rest follows the actual front edge, including `no_mirror`.
- The tray floor height is computed from everything under the lid: sensor
  header, switch bodies, MCU. With tilt the back gets taller automatically.
  The summary prints the breakdown (ball radius + 6 mm optics + PCB and
  header + air + floor ...). The one soft number is the sensor header:
  `header_height 3` for soldered wires or a right-angle header lowers
  the module by up to 6 mm.
- **Cup shape** (`cup_shape`): `cone` is a plain cone from skirt to rim,
  open all around. `dome` is a spherical shell that follows the ball, with the
  front and back scooped away so two side lobes cradle the ball (Ploopy Nano
  look). `block` is a rounded square scooped on all four sides, leaving four
  corner tabs. `cup_cut` is how deep the scoops go below the rim; `rim`
  (how far below the ball centre the rim sits) sets how much ball shows. The
  scoops must stay above the ball-support pockets, so deep cradles need
  small supports set low on the ball (`support ceramic-3 polar 42`); with
  7.5 mm BTUs the cut is limited to about 3 mm and auto-fit trims it.
  `cup_scoop` is the radius of the round scoops (narrower lobes with a
  smaller one). `cup_peak sharp` replaces them with V-shaped scoops whose
  walls reach the outer surface at the rim, so each lobe ends in a point
  (1 mm flat) like the Ploopy Nano; with `rim 0` the points sit at the
  ball's equator, the highest they can go while the ball still drops in.
- **Tiles** (`buttons tiles switches 2|4|6|8`): instead of a row of
  key switches, the lid top is divided into large wedge keys that fill the
  deck around the ball, ProtoArc EM06 style: one per side (4), the front and
  back split in two (6) or three (8), or only the two sides (2). Each tile is
  a flexure paddle printed into the lid, hinged along the body edge, with an
  Omron D2F microswitch in a holder block that hangs from the ring around the
  cup, so the click point is near the ball where the finger lands. The solid
  spokes between the tiles run to the corner screw bosses and keep the lid
  stiff. `tile_gap` is the visible gap between keys, `tile_frame` the
  solid rim where they hinge. Tiles need about 25 mm of padding (the
  validator says how much); with the MCU behind the sensor the tray grows a
  few mm so the back tile's holder clears the board. Print the lid in PETG.
- **Soft edges**: `cup_round` rounds the cup rim, `edge_round` rounds the
  top edges of the lid and the palm rest (both 2 mm by default, 0 = sharp).
  They are built from hulls and lathed profiles, not `minkowski`, so renders
  stay fast. Surface smoothness itself is `$fn` (`fn`, or the preview /
  final tiers in the web app).
- **Walls**: tray wall and floor 3 mm (`wall`, `floor`), lid 5 mm, cup 3 mm.
- **Feet**: four rubber-foot recesses in the bottom, `feet DIA` (default
  10 mm, 1 mm deep, 0 = none). They follow the leaning walls. The palm rest
  gets the same feet, four of them (two when it is too short).
- **USB**: `usb right|left|back` picks the wall the cable leaves.

## Adding a rolling option

Subclass `BallSupport` in `geometry/supports.ts`. Define the local frame with the
origin at the seat point and +Z toward the ball, then provide
`contact_height`, `cutter()`, `body_reach()`, `body_radius()` and
optionally `preview()`. Register it in `SUPPORTS`.

## Using another sensor breakout

Edit `SensorPCB` in `calculations/design.ts` (or write a new `pcb_features()` in
`geometry/carrier.ts`) and reprint only the carrier. The cup window fits any
PMW3360/PMW3389 board that uses the LM19-LSI lens. A PMW3610 board needs
a smaller window: change `Lens`.

## Adding an MCU

Add an `MCU(...)` preset in `calculations/design.ts`: length along the USB axis, width,
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
- Sensor board: `sensor_pcb bastardkb` (default, measured from the KiCad
  file) or `pmw3389-round` (generic round PMW3389 module, same lens;
  dimensions are a guess from the photo, measure yours and edit
  `PMW3389_ROUND` in `calculations/design.ts`). The carrier is the only part that changes.
- Screws: M3 heat-set inserts (Ø4 hole): 4 in the cup, 2 in the carrier,
  4 in the tray posts. M3x8 for cup and lid, M3x6 for the PCB.
  M2x6 self-tapping for Pico-style boards.
- MCU dimension references (L along USB × W, mm):
  [Pico physical drawing](https://datasheets.raspberrypi.com/pico/pico-product-brief.pdf)
  confirms 51 × 21 and 47 × 11.4 mounting-hole spacing;
  [Seeed XIAO nRF52840](https://wiki.seeedstudio.com/XIAO_BLE/) specifies
  21 × 17.8 (updated from 17.5);
  [SparkFun original Pro Micro](https://learn.sparkfun.com/tutorials/pro-microfio_v3-hookup-guide/all)
  specifies 1.30 × 0.70 inches, or 33.02 × 17.78 (updated from 33 × 18).
  [Waveshare RP2040-Zero](https://www.waveshare.com/wiki/RP2040-Zero)
  uses USB-C; its existing 23.5 × 18 envelope is retained.
  [nice!nano](https://nicekeyboards.com/docs/nice-nano/) documents a mid-mount
  USB-C connector; its 33 × 18 outline and the
  [Supermini](https://www.nologo.tech/en/product/otherboard/NRF52840.html)
  33.5 × 18 outline remain nominal presets. Socket overhangs, shell dimensions,
  and the nice!nano socket vertical offset are approximations; check the actual
  board revision before printing. Adjust `MCU` in `packages/core/src/calculations/design.ts` for
  different outlines, connector overhang or mid-mount offsets. A connector-type
  override alone cannot describe every clone's mechanical differences.
- MCU presets: `pico`, `pico-w`, `pico2`, `rp2040-zero`, `xiao`,
  `nice-nano`, `supermini`, `pro-micro`. Boards without mounting holes get
  a friction pocket; add a dab of glue or tape.
- Battery: `battery LxWxT` makes a framed pocket for that cell under the
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
