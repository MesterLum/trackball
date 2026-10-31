// Battery power switch: catalogue, wall frames and collision-free placement.
// Dimensions come from typical datasheets and are NOT yet measured against real parts.
import { holder_boxes } from '../geometry/tiles.js';

export type PowerSwitchKind = 'none' | 'slide' | 'rocker' | 'toggle';
export type Wall = 'right' | 'left' | 'front' | 'back';

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

export function wall_frame(d: any, wall: Wall): WallFrame {
  const r = d.carrier.corner_r;
  const [hw, front, back] = [d.half_width, d.front_length, d.back_length];
  const along_y: [number, number] = [-front + r, back - r];
  const along_x: [number, number] = [-hw + r, hw - r];
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
  { reason: 'palm' } | { reason: 'height'; needed: number; free: number } | { reason: 'room' };

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

/** Everything inside the tray the switch body (and its cradle) must stay clear of. */
function obstacles(d: any): Box[] {
  const t = d.tray;
  const z0 = d.z_pcb_face;
  const boxes: Box[] = [];
  const corners = d.mcu_mount_corners().map((p: number[]) => d.world_to_deck(p));
  const mcu = box_of(corners, 1.0);
  mcu[5] += t.mcu.component_height + 1.0;
  boxes.push(mcu);
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
  const post = t.post_dia / 2 + 0.5;
  for (const [x, y] of d.lid_screw_points()) boxes.push([x - post, x + post, y - post, y + post, -1e3, z0]);
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

/** Centre of the USB opening along `wall`, or null when the USB leaves through another wall. */
function usb_along(d: any, wall: Wall): number | null {
  const t = d.tray;
  const usb: Wall = t.usb_exit === 'back' ? 'back' : t.usb_side > 0 ? 'right' : 'left';
  if (usb !== wall) return null;
  const [x, y] = d.mcu_center();
  const [xd, yd] = d.world_to_deck([x, y, d.z_floor_top]);
  return usb === 'back' ? xd : yd;
}
/** Half the width of a USB cable's moulded plug, plus a finger's margin. */
const USB_PLUG_HALF = 6.0 + 1.5;

export function place_power_switch(d: any): PowerSwitchPlacement | PowerSwitchProblem | null {
  const b = d.battery;
  if (!b.enabled || b.power_switch === 'none') return null;
  const wall: Wall = b.power_wall;
  if (wall === 'front' && d.deck.palm_length > 0) return { reason: 'palm' };
  const type = POWER_SWITCHES[b.power_switch as Exclude<PowerSwitchKind, 'none'>];
  const f = wall_frame(d, wall);
  const wall_t = d.tray.wall;
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
  let free = 0;
  const fits = (u: number): PowerSwitchPlacement | null => {
    if (u - half_outside < f.span[0] || u + half_outside > f.span[1]) return null;
    if (usb !== null && Math.abs(u - usb) < half_outside + USB_PLUG_HALF) return null;
    // Lowest centre height that keeps the whole body above the (world-horizontal) floor.
    const trial = { type, wall, frame: f, u, w_center: 0, roll };
    const lowest = Math.min(...switch_corners(trial, 0, depth).map(world_z));
    const placed = { ...trial, w_center: (d.z_floor_top + lift - lowest) / rate };
    // The body must stay under the lid, whose underside sits at the sensor PCB face.
    const corners = switch_corners(placed, wall_t, depth, type.cradle ? 2 : 0);
    const top = Math.max(...corners.map((p) => p[2]));
    free = Math.max(free, z0 - 0.5 - (top - bw));
    if (top > z0 - 0.5) return null;
    if (boxes.some((o) => overlaps(box_of(corners), o))) return null;
    return placed;
  };

  // Prefer the old slot position in front of the sensor on side walls, the middle on the others.
  const preferred = wall === 'right' || wall === 'left' ? -(d.pcb.r + 6 + bu / 2) : 0;
  const reach = f.span[1] - f.span[0];
  for (let step = 0; step <= reach * 2; step++) {
    const u = preferred + (step % 2 ? -1 : 1) * Math.ceil(step / 2) * 0.5;
    const placed = fits(u);
    if (placed) return placed;
  }
  return free < bw ? { reason: 'height', needed: bw, free: Math.max(free, 0) } : { reason: 'room' };
}

export const is_placement = (p: ReturnType<typeof place_power_switch>): p is PowerSwitchPlacement =>
  p !== null && 'type' in p;
