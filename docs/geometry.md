# Geometry and hardware

## Frames

- **deck frame**: origin at the ball centre, +Z normal to the lid, sensor
  PCB hole axis along +Y, user at −Y. Cup, carrier, PCB and switches are
  modelled here, which is also their print orientation.
- **world frame**: deck frame rotated by `tilt` about X and `tent` about Y.
  The desk is horizontal here. The tray floor, MCU and battery live here.
  The tray walls stay perpendicular to the deck, so the sides lean with the
  deck. `Design.deck_to_world()` / `world_to_deck()` convert.

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
  `palm_corners square` (default) squares the lid's two front corners so they meet the
  fused rest flush; `rounded` keeps the lid shape and leaves a small notch at each corner.
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
  front and back scooped away so two side lobes cradle the ball.
  `block` is a rounded square scooped on all four sides, leaving four
  corner tabs. `cup_cut` is how deep the scoops go below the rim; `rim`
  (how far below the ball centre the rim sits) sets how much ball shows. The
  scoops must stay above the ball-support pockets, so deep cradles need
  small supports set low on the ball (`support ceramic-3 polar 42`); with
  7.5 mm BTUs the cut is limited to about 3 mm and auto-fit trims it.
  `cup_scoop` is the radius of the round scoops (narrower lobes with a
  smaller one). `cup_peak sharp` replaces them with V-shaped scoops whose
  walls reach the outer surface at the rim, so each lobe ends in a point
  (1 mm flat); with `rim 0` the points sit at the
  ball's equator, the highest they can go while the ball still drops in.
- **Tiles** (`buttons tiles switches 2|4|6|8`): instead of a row of
  key switches, the lid top is divided into large wedge keys that fill the
  deck around the ball: one per side (4), the front and
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
  `nice-nano`, `supermini`, `pro-micro`. Boards without mounting holes sit in
  a pocket that takes the plug's push and pull. By default (`mcu_hold clamp`)
  a separate printed bar (`mcu_clamp.stl`, 2.8 mm thick) is screwed over the
  board end opposite the USB with two M2x6 self-tapping screws into posts
  beside the pocket, so wiggling the cable cannot lever the board up. Only its
  pad touches the board: `clamp_length` (from that end, default 3 mm) by
  `clamp_width` (centred, default 8 mm); elsewhere the underside stays 1.4 mm
  up, clear of edge pads and wires. The posts sit 0.15 mm low, so tightening
  the screws flexes the bar and keeps the pad pressed. Check the default pad
  against your board: these boards have not been measured for part-free
  areas. Validation refuses a pad wider than the board, past its middle, or a
  bar over the RP2040-Zero BOOT button. `mcu_hold glue` keeps the plain pocket.
- Battery: `battery LxWxT` makes a framed pocket for that cell under the
  sensor (L along X, W along Y). Useful with the wireless boards
  (nice!nano, Supermini, XIAO nRF52840, Pico W with a LiPo shim).
- Power switch (`power_switch slide|rocker|toggle|none`, `power_wall
right|left|front|back`): the switch moves along the chosen wall to the first
  spot clear of the USB plug (a 12 mm moulded plug plus margin), controller,
  battery frame, lid posts, sensor PCB and the button bodies under the lid, and
  sits 1-1.5 mm above the floor. The front wall is refused while a palm rest is
  attached there. If nothing fits, validation says so instead of moving it.
  - `slide`: SS12D00 (8.6 x 3.6 x 3.5 mm). A body-height recess thins the wall
    to 1.2 mm around a 4.6 x 2.4 mm lever slot; printed cheeks and a shelf hold
    the body. Drop it in behind the wall, slide it outward, add a dab of glue.
  - `rocker`: KCD11 mini rocker, 13.2 x 8.8 mm snap-in cutout, wall thinned to
    1.5 mm for the tabs, about 16.5 mm deep inside with terminals.
  - `toggle`: MTS-102 (ON-OFF) or MTS-103 (ON-OFF-ON, same body), 6.3 mm hole,
    wall thinned to 2.5 mm for the nut, about 16 mm deep inside.
    These dimensions are typical datasheet values, not yet measured against
    real parts (`packages/core/src/calculations/power.ts`); print a test wall
    first.
- Click switches, three types:
  - `choc-v1` (default): 13.8 mm plate cutout with a relief pocket under
    the 5 mm lid, leaving a 1.3 mm plate for the clips.
  - `mx`: 14 mm cutout, 1.5 mm plate. Deeper body, the tray floor adapts.
  - `micro`: flat paddles printed into the lid. Each paddle is
    2.5 mm thick, freed on three sides by a 0.8 mm slot, hinged at the
    outer edge by a 0.8 mm flexure. A bar under the paddle tip holds an
    Omron D2F / Kailh GM microswitch (12.8 x 5.8 x 6.5 mm) pushed in from
    below; the plunger touches the paddle at rest and the paddle bottoms
    out on the bar after 0.5 mm. Print the lid in PETG for the flexures.
    Wire each switch between a GPIO and GND and use the internal pull-up.

## Compact pod

`build cradle` and `build pod` turn the model into a ball-only desk pod.
Buttons, palm rest, tilt and tent are dropped (`POD_FIXED` in
`config/options.ts`) and the controller sits under the sensor, flat on the
floor when it has no mounting holes, on 1 mm standoffs when it has.

- **Battery** (wireless controller): it lies beside the controller under the
  sensor, in front of it, instead of under it (`Battery.beside`); the taller
  of the two sets the floor. Auto fit adds padding until the frame clears the
  corner posts and stays inside the shell. The power switch goes in the base
  wall, below the seam, or through the shell when it comes down to the desk.

- **Cradle** (`build cradle`): a low soft-square base with a rounded top edge,
  and a round cup rising from it on a concave fillet up to a flat rim (at the
  rim depth) with a rounded lip (`cradle_shape`). The base's top just covers
  the sensor plate, and the cup rises at least 10 mm above it: on small balls
  the rim moves above the ball's middle for that, so less of the ball shows.
  The cup is also at least 72% of the body's half width, so it stays in
  proportion when the sensor board, not the ball, sets the body's size. A bevelled U-shaped notch in
  the front of the cup shows more of the ball and leaves a horn on each side;
  it narrows to stay clear of the supports either side of the front, which the
  cradle turns so the front falls between two of them. The cup wall is 3 mm
  thicker than `cup_wall` so the support bores stay inside it. The rim may sit
  above the ball's middle, so only a straight shaft above the equator is
  cleared and the ball still lifts out. The shell's top just clears the
  sensor plate and the cup stays solid, so the notch never opens into the
  inside. The base is a tray whose solid wall closes the electronics bay up to
  a seam 1 mm under the sensor plate, where the shell starts; the two meet
  flush, so the outside reads as one wall. `pod_base covered` instead brings the shell down to
  the desk over a flat base plate. `pod_side` adds a design to the lower wall
  (the base's wall, or the shell's straight sides): a shallow recessed band
  (0.6 mm) or three V grooves, all with 45° edges. Rounded edges are built as bands of scaled extrusions
  (a smaller soft square is an exact scaled copy), never as hulls, which CGAL
  can fail on.
- **Sensor in the shell** (`sensor_mount shell`, the default with a walled
  base): the shell ends at the sensor board's lens side, so the seam moves up
  to `z_pcb_face` and the shell prints from there on the bed. Its underside is
  solid and flat, with the plate's features cut from below: the board's two
  inserts, the solder relief and its pads, the lens window, and an insert over
  each base post (6 mm deep, `SHELL_POST_INSERT_DEPTH`). The board seats on a
  bed face and the supports are in the same part, so print accuracy holds the
  lens-to-ball distance with no sensor plate, nuts or shell screws. Solid from
  the bed up, the shell has nothing to print on supports: the only roofs are
  bridges over the solder relief and the insert holes. The base screws, M3x8
  up through the posts, bite 5 mm of the shell's inserts. `sensor_mount plate`
  keeps the separate sensor plate; the rounded pod and `pod_base covered` always
  use it, since their shell's bed face is at the desk.
- **Rounded** (`build pod`): the pebble described below; the internals are the
  same for both.

- **Shell**: one rounded cover from the desk to the ball (`geometry/pod.ts`),
  hulled from slices of a profile (`pod_levels`): straight sides on a
  soft-square plan (a squircle, exponent 4), then a quarter-ellipse shoulder
  that turns the plan into a circle and ends flat at the rim, with small
  chamfers at the foot and at the ball opening. It is hollow with an even
  wall, 2.0 mm `solid` or 2.4 mm `clear`, and carries the cup, so it is
  exported as `shell` and screwed to the sensor plate from below like the cup.
  The USB opening is cut through it. Printed in clear filament it shows the
  sensor, controller and wiring inside.
- **Plates**: the sensor plate (`carrier`) and the base plate (`tray`) are flat
  squircle slabs that fit inside the shell with a 0.3 mm gap. The tray's wall
  thickness becomes the shell wall plus that gap, so the usual fit checks use
  the room inside the shell.
- **Posts and screws**: four posts stand on the base plate's diagonals, as far
  out as the shell allows (`pod_post_points`), and must clear the round sensor
  board; auto fit adds padding when they do not, which sets the minimum size
  for small balls. Only short screws are used: each post is pocketed from
  below, so an M3x8 machine screw's head sits near its top, passes the post's
  3 mm top and the sensor plate, and bites an M3 nut in a hex pocket on top of
  the plate (or an insert in the shell, when it holds the sensor). The pocket's
  roof steps through a slot and a square, 0.4 mm each, as wide as the screw
  hole (`pocket_bridges`), so each layer bridges between solid edges. Rubber
  feet cover the pockets.
- **Weights**: the weights go in a small cup, `weight_cap`, that screws (or
  locks) into the underside of the base, flush with it; the base's floor
  closes it from above. The cup sinks up into the floor, which over it is only
  a 1.2 mm cover (thicker under a controller with mounting holes, for its
  standoff screws), so the pod grows by `weight_depth` + 1.6 mm bottom + 1.2 mm
  cover - `floor`. The cup is as wide as fits inside the walls and
  between the feet. `weight_cap` sets how it holds: a printed thread (3 mm
  pitch, 45° flanks, 0.35 mm clearance, `geometry/thread.ts`, a helical
  polyhedron), a bayonet (three lugs at the rim that enter through slots and
  turn 60° into a groove) or none (an open pocket, weights glued in). A slot
  across the bottom turns it with a coin.

Pod assembly with the sensor in the shell: inserts in the shell's underside
(2 for the sensor, 4 over the posts), BTUs into the shell, sensor screwed to
the shell (M3x6, lens up into its window), controller on the base, wires,
shell onto the base (4 M3x8 screws up through the posts), weights, feet, ball.

With a sensor plate: inserts in the shell and sensor plate, BTUs into the shell,
sensor on the plate, nuts into their pockets on the plate, shell onto the
plate (4 screws from below), controller on the base, wires, plate onto the
base (4 M3x8 screws up through the posts), weights into the cup and the cup
screwed in, feet over the screw pockets, ball in. Flash the controller before
closing the pod: its BOOT button ends up inside.

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
   (GND, MISO, SCLK, MOSI, NCS, 5V) to SPI pins, route the USB out its
   wall opening. Without mounting holes, seat the board USB-first, then
   screw the clamp bar (printed upside down, flat top on the bed) over its far end.
6. Wireless: drop the battery in its frame, wires toward the MCU, and fit the
   power switch: drop a slide switch into its holder and slide it outward into
   the wall recess (a dab of glue holds it), snap a rocker in from outside, or fix
   a toggle with its nut.
7. Drop the carrier onto the tray and fix the 4 corner screws.
8. Drop the ball in.

### Sensor solder relief

Wires or a header soldered from the back of the sensor board leave pin tips and
joints on its lens side, which faces the plate. `sensor_relief` (default 2 mm,
0 to 3) pockets the plate's underside over the board, leaving two 8 mm pads
around its screws: the board rests on the pads, at the same height as on a flat
plate, so its distance to the ball does not change.

### Parts on a controller's back

A controller without mounting holes lies in a pocket. When it carries parts on
its back (`MCU.under_height`), it rests on a 1.5 mm ledge around its edge over
a recess `under_height + 0.4` deep. The RP2040-Zero carries its RP2040 (0.9 mm),
crystal and RT9013 regulator (SOT-23-5, up to 1.45 mm) on the back, per
Waveshare's photos and schematic, and its USB-C, buttons, LED and flash on the
front. A full build's 3 mm seat already has the room;
a pod's flat bay rises by the recess depth.

Wires soldered to a pocketed board's edge pins stick out sideways, so the
pocket's side walls stay only at the corners (`Design.mcu_corner`): up to 1 mm
short of the first pin's centre, from the board's pins per side (`side_pins`,
2.54 mm apart and centred), and at least 0.6 mm. That is 0.6 mm on the
RP2040-Zero, about 1.5 mm on the 33 mm boards and 1.9 mm on the XIAO. The end walls and corners still locate
the board. With a recess, the side ledges go too, so solder under the edge
can't lift the board; it rests on its two end ledges. The clamp posts still
stand about 0.9 mm out from the board edge at the far end, so route the wires
on the pins beside them upward.

## Print fit

FDM prints come out a little off their drawn size: extruded lines squish wider,
so walls grow and holes shrink, and small holes print as polygons that cut the
circle. The clearances above suit a well-tuned printer; two settings in the
Print fit tab shift them for another printer or filament. The web app
remembers them on the device and keeps them when switching builds or resetting.

- `fit_hole` is added to the diameter of every hole a bought part goes into:
  BTU bores (and ceramic sockets, bearing screw holes), heat-set insert holes,
  screw clearance holes, the pod's nut pockets and a toggle switch's hole.
- `fit_gap` is added on each side where printed parts slide or screw
  together: the pod shell over its plates (`POD_FIT`), the weight cap's thread
  or bayonet, the palm rest joint and a snap-in switch opening.

The **fit test** (Print fit tab, `generateFitTest`) prints this design's
fitted features in rows of four columns, marked with one to four dots: one
step tighter than the current settings, the settings, and one and two steps
looser. A step is 0.1 mm on a hole's diameter and 0.05 mm on each side of a
sliding fit. The rows are the BTU bore (BTU supports only), the insert hole,
the screw hole, the nut pocket (pods), square sockets for a loose plug, and
threaded holes for a short bolt (pods with a threaded cap). The tightest
column that still fits by hand gives the setting: one step per dot away from
the two-dot column.

## Numbers to verify before trusting a print

- **Lens stack** (`calculations/sensor.ts`): from PixArt's datasheets, which
  agree for the PMW3360 (v1.30, Figure 4 and Table 3), PMW3389 (v1.0,
  Figure 5) and PMW3610 (R2.4, Figure 4, LM18-LSI lens): the top of a 1.60 mm
  PCB is 7.40 mm from the navigation surface and the lens reference plane (the
  bottom of the lens flange) 2.40 mm, tracking from 2.2 to 2.6 mm. The lens
  clips to the sensor on the board's other side, so the ball sits
  `7.40 - board thickness` = 5.80 mm from the board's lens side. Each sensor
  board names its sensor (`SensorPCB.sensor`). `sensor_adjust` moves the ball
  on top of that; past ±0.2 mm the design warns, since the ball would sit
  outside the datasheet range unless a gap in the printed parts makes up for
  it. `tests/unit/sensor-distance.test.ts` renders the cup or shell and the
  plate and measures the distance on the meshes: the support seats, the
  plate's thickness and where it meets the cup. Before this, the model used
  3.6 mm from the board to the lens (6.0 mm to the ball), a guess from
  community models, which put the ball 2.6 mm from the lens, at the far edge
  of the range.
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
