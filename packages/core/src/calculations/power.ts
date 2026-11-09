// Battery power switch: catalogue, wall frames and collision-free placement.
// Dimensions come from typical datasheets and are NOT yet measured against real parts.
import { holder_boxes } from '../geometry/tiles.js';
import { POD_SIDE_N } from './pod.js';
import { CLAMP, CLAMP_SIDE_EXTRA } from './clamp.js';

export type PowerSwitchKind = 'none' | 'slide' | 'rocker' | 'toggle';
export type Wall = 'right' | 'left' | 'front' | 'back';
/** The power switch's wall setting: a wall, or the first one with room. */
export type PowerWall = Wall | 'auto';

export interface PowerSwitchType {
  /** Shown in the parts list. */
  name: string;
  /** Wall opening: a rectangle (u along the wall x w up) or a round hole. */
  hole: { shape: 'rect'; u: number; w: number } | { shape: 'round'; d: number };
  /** Wall thickness left at the opening (snap tabs, nut or lever length need it thin). */
  panel: number;
  /** Body behind the panel incl. clearance: along the wall, height, depth incl. terminals. */
  body: [number, number, number];
  /** Bezel, nut or lever footprint on the outside face (u, w). */
  outside: [number, number];
  /** Printed cheeks and shelf hold the body (slide); otherwise it mounts in the panel. */
  cradle: boolean;
}

export const POWER_SWITCHES: Record<Exclude<PowerSwitchKind, 'none'>, PowerSwitchType> = {
  // SS12D00: 8.6 x 3.6 x 3.5 mm body, lever through a slot; pins and wires take ~6 mm behind.
  slide: {
    name: 'SS12D00 mini slide switch',
    hole: { shape: 'rect', u: 4.6, w: 2.4 },
    panel: 1.2,
    body: [9.1, 4.1, 3.8 + 6.0],
    outside: [4.6, 2.4],
    cradle: true,
  },
  // KCD11 mini rocker: 15 x 10.5 mm bezel, ~13 x 8.5 mm snap-in cutout for a 1-2 mm panel.
  rocker: {
    name: 'KCD11 mini rocker switch',
    hole: { shape: 'rect', u: 13.2, w: 8.8 },
    panel: 1.5,
    body: [13.2, 8.8, 16.5],
    outside: [15.5, 10.8],
    cradle: false,
  },
  // MTS-102 / MTS-103: 6 mm threaded bushing with a nut outside, ~13 x 8 x 10 mm body + terminals.
  toggle: {
    name: 'MTS-102 / MTS-103 mini toggle switch',
    hole: { shape: 'round', d: 6.3 },
    panel: 2.5,
    body: [13.2, 8.2, 16.0],
    outside: [9.5, 9.5],
    cradle: false,
  },
};

/** Wall frame in deck coordinates: u runs along the wall, v points inward from the outer face. */
export interface WallFrame {
  origin: [number, number];
  u: [number, number];
  v: [number, number];
  /** Straight stretch of the outer face along u, before the corner rounding. */
  span: [number, number];
}

/** How far a pod's curved side may fall away from flat under a power switch, in mm. */
export const POD_FLAT = 0.15;

/**
 * How far a pod's outer face lies inside a wall frame's straight line at u along it (0 on a tray,
 * whose walls run straight along the span).
 */
export function wall_inset(d: any, f: WallFrame, wall: Wall, u: number): number {
  if (!d.is_pod) return 0;
  const [hw, front, back] = [d.half_width, d.front_length, d.back_length];
  const [cy, half_l] = [(back - front) / 2, (back + front) / 2];
  const side = wall === 'right' || wall === 'left';
  const [normal, along, t] = side ? [hw, half_l, u - cy] : [half_l, hw, u];
  const k = Math.min(Math.abs(t) / along, 1);
  return normal - normal * Math.pow(1 - Math.pow(k, POD_SIDE_N), 1 / POD_SIDE_N);
}

export function wall_frame(d: any, wall: Wall): WallFrame {
  const r = d.carrier.corner_r;
  const [hw, front, back] = [d.half_width, d.front_length, d.back_length];
  let along_y: [number, number] = [-front + r, back - r];
  let along_x: [number, number] = [-hw + r, hw - r];
  if (d.is_pod) {
    // A pod's sides are a soft square (|x/a|^n + |y/b|^n = 1), curving in away from the middle:
    // only the stretch within POD_FLAT of the flat line counts as wall.
    const flat = (a: number, b: number) =>
      b * Math.pow(1 - Math.pow(1 - POD_FLAT / a, POD_SIDE_N), 1 / POD_SIDE_N);
    const [cy, half_l] = [(back - front) / 2, (back + front) / 2];
    along_y = [cy - flat(hw, half_l), cy + flat(hw, half_l)];
    along_x = [-flat(half_l, hw), flat(half_l, hw)];
  }
  switch (wall) {
    case 'right':
      return { origin: [hw, 0], u: [0, 1], v: [-1, 0], span: along_y };
    case 'left':
      return { origin: [-hw, 0], u: [0, 1], v: [1, 0], span: along_y };
    case 'front':
      return { origin: [0, -front], u: [1, 0], v: [0, 1], span: along_x };
    case 'back':
      return { origin: [0, back], u: [1, 0], v: [0, -1], span: along_x };
  }
}

export interface PowerSwitchPlacement {
  type: PowerSwitchType;
  wall: Wall;
  frame: WallFrame;
  /** Body centre along the wall. */
  u: number;
  /** Deck-frame height of the body centre. */
  w_center: number;
  /** Rotation (degrees) about the wall normal that keeps the switch level with the floor. */
  roll: number;
}

export type PowerSwitchProblem =
  { reason: 'palm' } | { reason: 'height'; needed: number; free: number } | { reason: 'room'; wall: Wall };

type Box = [number, number, number, number, number, number]; // x0 x1 y0 y1 z0 z1 (deck frame)

function box_of(points: number[][], grow = 0): Box {
  const axis = (i: number) => points.map((p) => p[i]);
  return [
    Math.min(...axis(0)) - grow,
    Math.max(...axis(0)) + grow,
    Math.min(...axis(1)) - grow,
    Math.max(...axis(1)) + grow,
    Math.min(...axis(2)) - grow,
    Math.max(...axis(2)) + grow,
  ];
}
const overlaps = (a: Box, b: Box) =>
  a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3] && a[4] < b[5] && b[4] < a[5];

/** Map a local (u, v, w) point into the deck frame. */
export function wall_point(f: WallFrame, u: number, v: number, w: number): [number, number, number] {
  return [f.origin[0] + u * f.u[0] + v * f.v[0], f.origin[1] + u * f.u[1] + v * f.v[1], w];
}

/**
 * Roll about the wall normal that makes the wall's u axis horizontal in the world. Walls stand
 * perpendicular to the tilted deck, but the switch sits on the level floor and should line up with it.
 */
export function wall_roll(d: any, f: WallFrame): number {
  const uz = d.deck_to_world([f.u[0], f.u[1], 0])[2];
  const wz = d.deck_to_world([0, 0, 1])[2];
  return (Math.atan2(uz, wz) * 180) / Math.PI;
}

/** Deck-frame point of a switch-local offset (du along, v inward, dw up) from the body centre. */
export function switch_point(
  p: Omit<PowerSwitchPlacement, 'type' | 'wall'>,
  du: number,
  v: number,
  dw: number,
) {
  const a = (p.roll * Math.PI) / 180;
  // Same convention as OpenSCAD rotate([0, roll, 0]).
  const x = du * Math.cos(a) + dw * Math.sin(a);
  const z = -du * Math.sin(a) + dw * Math.cos(a);
  return wall_point(p.frame, p.u + x, v, p.w_center + z);
}

/** Deck-frame corners of the switch body (plus cheeks and the shelf for a cradle). */
export function switch_corners(p: PowerSwitchPlacement, v0: number, v1: number, below = 0): number[][] {
  const [bu, bw] = p.type.body;
  const half = bu / 2 + (p.type.cradle ? 1.6 : 1.0);
  const pts = [];
  for (const du of [-half, half])
    for (const v of [v0, v1])
      for (const dw of [-bw / 2 - below, bw / 2]) pts.push(switch_point(p, du, v, dw));
  return pts;
}

/**
 * The controller's room as deck boxes: one box over its mount; or, finer, the pocket frame along
 * the board and the clamp's posts and bar only at its far end.
 */
function mcu_boxes(d: any, fine: boolean): Box[] {
  const t = d.tray;
  const grow = (b: Box) => {
    b[5] += t.mcu.component_height + 1.0;
    return b;
  };
  const corners = d.mcu_mount_corners().map((p: number[]) => d.world_to_deck(p));
  if (!fine || !d.mcu_clamped) return [grow(box_of(corners, 1.0))];
  const [lo, hi, across] = d.mcu_mount_bounds();
  const [x, y] = d.mcu_center();
  const zs = corners.map((p: number[]) => p[2]);
  const board = (a0: number, a1: number, c: number): Box => {
    const pts = [];
    for (const a of [a0, a1])
      for (const b of [-c, c])
        for (const z of [Math.min(...zs), Math.max(...zs)])
          pts.push(
            d.world_to_deck(
              t.usb_exit === 'back' ? [x - b, y + a, z] : [x + t.usb_side * a, y + t.usb_side * b, z],
            ),
          );
    return grow(box_of(pts, 1.0));
  };
  const far = -t.mcu.length / 2 + Math.max(t.clamp_length, CLAMP.min_span) + CLAMP.post_dia / 2;
  return [board(lo, hi, across - CLAMP_SIDE_EXTRA), board(lo, far, across)];
}

/** The base posts, with a margin. */
function post_boxes(d: any): Box[] {
  const post = d.tray.post_dia / 2 + 0.5;
  return d
    .lid_screw_points()
    .map(([x, y]: number[]): Box => [x - post, x + post, y - post, y + post, -1e3, d.z_pcb_face]);
}

/** Everything inside the tray the switch body (and its cradle) must stay clear of. */
function obstacles(d: any, fine = false, posts = true): Box[] {
  const t = d.tray;
  const z0 = d.z_pcb_face;
  const boxes: Box[] = [...mcu_boxes(d, fine)];
  if (d.battery.enabled) {
    const b = d.battery;
    const [bx, by] = d.battery_center();
    const [bl, bw] = b.outer;
    const top = d.z_floor_top + b.thickness + b.frame_extra_h;
    const pts = [];
    for (const x of [-bl / 2, bl / 2])
      for (const y of [-bw / 2, bw / 2])
        for (const z of [d.z_floor_top, top]) pts.push(d.world_to_deck([bx + x, by + y, z]));
    boxes.push(box_of(pts, 0.5));
  }
  if (posts) boxes.push(...post_boxes(d));
  const r = d.pcb.r + 1.0;
  boxes.push([-r, r, -r, r, z0 - d.pcb.thickness - d.pcb.header_height - 1.0, z0]);
  const below = d.switches.depth_below_lid(d.carrier.thickness);
  if (d.switches.count && below > 0) {
    const zb = z0 - below - t.clearance;
    if (d.switches.is_tiles)
      for (const [x0, x1, y0, y1] of holder_boxes(d)) boxes.push([x0, x1, y0, y1, zb, z0]);
    else {
      const h = d.switches.type.size_in / 2 + 1.0;
      for (const [x, y] of d.switch_positions()) boxes.push([x - h, x + h, y - h, y + h, zb, z0]);
    }
  }
  return boxes;
}

/** The wall the USB plug leaves through. */
export function usb_wall(d: any): Wall {
  const t = d.tray;
  return t.usb_exit === 'back' ? 'back' : t.usb_side > 0 ? 'right' : 'left';
}
/** Centre of the USB opening along `wall`, or null when the USB leaves through another wall. */
function usb_along(d: any, wall: Wall): number | null {
  const usb = usb_wall(d);
  if (usb !== wall) return null;
  const [x, y] = d.mcu_center();
  const [xd, yd] = d.world_to_deck([x, y, d.z_floor_top]);
  return usb === 'back' ? xd : yd;
}
/** Half the width of a USB cable's moulded plug, plus a finger's margin. */
const USB_PLUG_HALF = 6.0 + 1.5;

/** Walls an automatic power switch tries in turn: the USB wall last, so the two stay apart. */
export function auto_power_walls(d: any): Wall[] {
  const usb = usb_wall(d);
  return [...(['right', 'left', 'back', 'front'] as Wall[]).filter((w) => w !== usb), usb];
}

export function place_power_switch(d: any): PowerSwitchPlacement | PowerSwitchProblem | null {
  const b = d.battery;
  if (!b.enabled || b.power_switch === 'none') return null;
  if (b.power_wall !== 'auto') return place_power_on(d, b.power_wall);
  let first: PowerSwitchProblem | null = null;
  for (const wall of auto_power_walls(d)) {
    const p = place_power_on(d, wall);
    if (is_placement(p)) return p;
    first ??= p as PowerSwitchProblem;
  }
  return first;
}

function place_power_on(d: any, wall: Wall): PowerSwitchPlacement | PowerSwitchProblem {
  const b = d.battery;
  if (wall === 'front' && d.deck.palm_length > 0) return { reason: 'palm' };
  const type = POWER_SWITCHES[b.power_switch as Exclude<PowerSwitchKind, 'none'>];
  const f = wall_frame(d, wall);
  // A pod's wall is its shell or base: thinner than the tray wall, which includes a fitting gap.
  const wall_t = d.is_pod ? d.pod.wall : d.tray.wall;
  const [bu, bw, bv] = type.body;
  const half_outside = Math.max(type.outside[0], bu) / 2;
  const depth = Math.min(type.panel, wall_t) + bv;
  const lift = type.cradle ? 1.0 : 1.5;
  const z0 = d.z_pcb_face;
  const roll = wall_roll(d, f);
  const rate = d.deck_to_world([0, 0, 1])[2];
  const world_z = (p: number[]) => d.deck_to_world(p)[2];

  const boxes = obstacles(d);
  const usb = usb_along(d, wall);
  // Free height, from the spots that clear the wall's ends and the USB plug: when none do, the
  // wall lacks room along it, not height.
  let free = 0,
    checked = false;
  const fits = (u: number): PowerSwitchPlacement | null => {
    if (u - half_outside < f.span[0] || u + half_outside > f.span[1]) return null;
    if (usb !== null && Math.abs(u - usb) < half_outside + USB_PLUG_HALF) return null;
    checked = true;
    // Lowest centre height that keeps the whole body above the (world-horizontal) floor.
    const trial = { type, wall, frame: f, u, w_center: 0, roll };
    const lowest = Math.min(...switch_corners(trial, 0, depth).map(world_z));
    const placed = { ...trial, w_center: (d.z_floor_top + lift - lowest) / rate };
    // The body must stay under the lid, whose underside sits at the sensor PCB face; in a walled pod
    // base, also clear of the seam a millimetre lower.
    const ceiling = d.pod?.walled ? z0 - 2 : z0 - 0.5;
    const corners = switch_corners(placed, wall_t, depth, type.cradle ? 2 : 0);
    const top = Math.max(...corners.map((p) => p[2]));
    free = Math.max(free, ceiling - (top - bw));
    if (top > ceiling) return null;
    if (boxes.some((o) => overlaps(box_of(corners), o))) return null;
    return placed;
  };

  // Prefer the old slot position in front of the sensor on side walls, the middle on the others.
  // (clamped onto the usable stretch, which is short on a pod's curved sides).
  const preferred = Math.min(
    Math.max(wall === 'right' || wall === 'left' ? -(d.pcb.r + 6 + bu / 2) : 0, f.span[0] + half_outside),
    f.span[1] - half_outside,
  );
  const reach = f.span[1] - f.span[0];
  for (let step = 0; step <= reach * 2; step++) {
    const u = preferred + (step % 2 ? -1 : 1) * Math.ceil(step / 2) * 0.5;
    const placed = fits(u);
    if (placed) return placed;
  }
  return checked && free < bw
    ? { reason: 'height', needed: bw, free: Math.max(free, 0) }
    : { reason: 'room', wall };
}

export const is_placement = (p: ReturnType<typeof place_power_switch>): p is PowerSwitchPlacement =>
  p !== null && 'type' in p;

/**
 * Reset button: a through-hole tactile switch behind the USB wall (or, without room there, a wall
 * beside it, near the USB corner), pressed with a pin through a hole, so flashing (plug in, double
 * press reset) happens close to the plug. Sizes from the common
 * 6x6 mm part: body 6 x 6 x 3.5 mm, a 3.5 mm plunger 0.8 mm proud (4.3 mm overall), and two rows
 * of legs 6.5 mm apart, 4.5 mm apart within a row, 4 mm long behind the body.
 */
export interface ResetSwitchType {
  name: string;
  /** Body side and depth, plunger diameter and how far it stands proud of the body. */
  side: number;
  depth: number;
  plunger: number;
  proud: number;
  /** Legs: spacing within a row (along the wall, the rows above and below the body) and length. */
  leg_pitch: number;
  leg_length: number;
}
export const RESET_SWITCHES: Record<string, ResetSwitchType> = {
  'tact-6x6': {
    name: 'Tactile switch 6x6 mm, 4.3 mm tall (through-hole)',
    side: 6.0,
    depth: 3.5,
    plunger: 3.5,
    proud: 0.8,
    leg_pitch: 4.5,
    leg_length: 4.0,
  },
};
/** Holder around the switch: clearance on its body, cheek and back rib thickness, rib width, and
 * the room behind the body: the legs trimmed to 1.5 mm with the wires soldered on and led up. */
export const RESET_HOLDER = {
  clear: 0.3,
  cheek: 1.2,
  rib: 1.6,
  rib_w: 2.4,
  trim: 1.5,
  wires: 1.0,
  lift: 1.0,
};
/** The pin hole: the plunger plus clearance. */
export const RESET_HOLE_CLEAR = 0.4;

export interface ResetPlacement {
  type: ResetSwitchType;
  wall: Wall;
  frame: WallFrame;
  /** Body centre along the wall, its deck-frame height, and the roll that keeps it level. */
  u: number;
  w_center: number;
  roll: number;
  /** Body side with clearance, where the holder starts and where the body's front sits (v). */
  side: number;
  v_block: number;
  v_body: number;
  /** Behind the body: the back of the rib, and the end of the room for legs and wires. */
  v_rib: number;
  v_end: number;
}
export type ResetProblem = { reason: 'height'; needed: number; free: number } | { reason: 'room' };

/** The USB wall first, then its neighbours (the ends nearest the USB wall first). */
const RESET_WALLS: Record<Wall, Wall[]> = {
  back: ['back', 'right', 'left'],
  right: ['right', 'back', 'front'],
  left: ['left', 'back', 'front'],
  front: ['front', 'right', 'left'],
};

export function place_reset_switch(d: any): ResetPlacement | ResetProblem | null {
  const type: ResetSwitchType | undefined = RESET_SWITCHES[d.tray.reset_switch];
  if (!type || !d.is_pod) return null;
  const usb = usb_wall(d);
  let free = 0;
  for (const wall of RESET_WALLS[usb]) {
    const placed = reset_on_wall(d, type, wall, usb, (f) => (free = Math.max(free, f)));
    if (placed) return placed;
  }
  const side = type.side + 2 * RESET_HOLDER.clear + d.fit.gap;
  return free < side ? { reason: 'height', needed: side, free: Math.max(free, 0) } : { reason: 'room' };
}

function reset_on_wall(
  d: any,
  type: ResetSwitchType,
  wall: Wall,
  usb_side: Wall,
  report_free: (free: number) => void,
): ResetPlacement | null {
  const h = RESET_HOLDER;
  const f = wall_frame(d, wall);
  // Room along the wall: past the flat stretch the curved side only sets the switch further back.
  const [hw, front, back] = [d.half_width, d.front_length, d.back_length];
  const along: [number, number] =
    wall === 'right' || wall === 'left' ? [-front + 4, back - 4] : [-hw + 4, hw - 4];
  const shell_wall = !d.pod.walled;
  const wall_t = d.pod.wall;
  const side = type.side + 2 * h.clear + d.fit.gap;
  const half = side / 2 + h.cheek;
  const roll = wall_roll(d, f);
  const rate = d.deck_to_world([0, 0, 1])[2];
  const world_z = (p: number[]) => d.deck_to_world(p)[2];
  const z0 = d.z_pcb_face;
  // Under the seam of a walled base, which rises to the sensor board when the shell holds it.
  const ceiling = d.pod.walled && !d.pod.shell_mount ? z0 - 2 : z0 - 0.5;
  // The holder is base material like the posts and may merge with them; only the switch, its legs
  // and wires must clear them.
  const boxes = obstacles(d, true, false);
  const posts = post_boxes(d);
  const power = d.power_switch_placement();
  if (power !== null && is_placement(power)) {
    const [, , bv] = power.type.body;
    boxes.push(box_of(switch_corners(power, 0, d.pod.wall + bv), 1.0));
  }
  const usb = usb_along(d, wall);
  const fits = (u: number): ResetPlacement | null => {
    if (u - half < along[0] || u + half > along[1]) return null;
    // Beside the plug, its hole clear of the cable's moulded plug.
    if (usb !== null && Math.abs(u - usb) < type.plunger / 2 + 1 + USB_PLUG_HALF) return null;
    // Behind the deepest point of the curved side under the holder; a shell wall is a separate
    // part, so the holder (on the base) stops its fitting gap short of it.
    const inset = Math.max(wall_inset(d, f, wall, u - half), wall_inset(d, f, wall, u + half));
    if (inset > 2.5) return null;
    const v_body = inset + wall_t + (shell_wall ? d.pod.fit : 0);
    // Behind a base wall the holder fills in from inside the wall (clear of any side design).
    const v_block = shell_wall ? v_body : inset + 1.0;
    const v_back = v_body + type.depth + h.clear;
    const placed: ResetPlacement = {
      type,
      wall,
      frame: f,
      u,
      w_center: 0,
      roll,
      side,
      v_block,
      v_body,
      v_rib: v_back + h.rib,
      v_end: v_back + Math.max(h.rib, h.trim + h.wires),
    };
    const corners = (p: ResetPlacement, below: number) => {
      const pts = [];
      for (const du of [-half, half])
        for (const v of [p.v_block, p.v_end])
          for (const dw of [-side / 2 - below, side / 2]) pts.push(switch_point(p, du, v, dw));
      return pts;
    };
    const lowest = Math.min(...corners(placed, 0).map(world_z));
    placed.w_center = (d.z_floor_top + h.lift - lowest) / rate;
    const pts = corners(placed, h.lift);
    const top = Math.max(...pts.map((p) => p[2]));
    report_free(ceiling - (top - side));
    if (top > ceiling + 1e-6) return null;
    if (boxes.some((o) => overlaps(box_of(pts), o))) return null;
    // The legs, trimmed short, stand about 0.3 mm past the body across the rows.
    const a = side / 2,
      legs: number[][] = [];
    for (const du of [-a, a])
      for (const v of [placed.v_body, placed.v_end])
        for (const dw of [-a - 0.3, a + 0.3]) legs.push(switch_point(placed, du, v, dw));
    if (posts.some((o) => overlaps(box_of(legs), o))) return null;
    return placed;
  };
  // On the USB wall as close to the plug as the controller and posts allow; on a neighbour, from
  // its end at the USB wall.
  if (usb !== null) {
    for (let step = 0; step <= (along[1] - along[0]) * 2; step++) {
      const placed = fits(usb + (step % 2 ? -1 : 1) * Math.ceil(step / 2) * 0.5);
      if (placed) return placed;
    }
    return null;
  }
  const toward_usb =
    wall === 'right' || wall === 'left' ? (usb_side === 'front' ? -1 : 1) : usb_side === 'left' ? -1 : 1;
  for (let u = toward_usb * along[1]; Math.abs(u) <= along[1] + 1e-9; u -= toward_usb * 0.5) {
    const placed = fits(u);
    if (placed) return placed;
  }
  return null;
}

export const is_reset = (p: ReturnType<typeof place_reset_switch>): p is ResetPlacement =>
  p !== null && 'type' in p;
