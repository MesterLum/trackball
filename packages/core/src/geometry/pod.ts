// Compact desk pod: one rounded shell from the ball down to the desk, over a flat base plate.
import { sub } from '../math.js';
import { circle, cylinder, hull, linear_extrude, polygon, rotate_extrude, union } from '../scad/index.js';
import {
  CRADLE,
  POD_FIT,
  POD_FOOT_CHAMFER,
  POD_RIM_CHAMFER,
  POD_SCREW,
  POD_SIDE_N,
  cradle_shape,
  pod_levels,
  squircle,
  type PodLevel,
} from '../calculations/pod.js';
import { EPS, zcyl } from './common.js';

function slab(lv: PodLevel, h: number): any {
  return linear_extrude(h)(polygon(squircle(lv.a, lv.b, lv.n))).translate([lv.x, lv.y, lv.z]);
}
function body(levels: PodLevel[]): any {
  return hull()(...levels.map((lv, i) => slab(i === levels.length - 1 ? { ...lv, z: lv.z - EPS } : lv, EPS)));
}

/**
 * The pod's shell: hollow underneath with an even wall, its inside straight down to the desk so
 * the base plate drops in. The cup is added to it and the cavity, supports and openings are cut
 * afterwards, so they cut both.
 */
export function pod_shroud(d: any): any {
  const wall = d.pod.wall;
  if (d.pod.cradle) return sub(cradle_body(d), cradle_inside(d));
  const inner = pod_levels(d, wall, wall);
  // Straight inside down past the bottom chamfer, so the base plate fits all the way in.
  inner[0] = { ...inner[1], z: d.z_floor_bottom - 1 };
  return sub(body(pod_levels(d)), body(inner));
}

function plan(d: any, inset: number, z: number): PodLevel {
  const [w, l, cx, cy] = d.footprint;
  return { z, a: w / 2 - inset, b: l / 2 - inset, n: POD_SIDE_N, x: cx, y: cy };
}

/**
 * Cradle pod outside: straight sides on the soft-square plan with a rounded top edge, hulled
 * with a collar around the ball. The saddle cut (cradle_cuts) then carves the top into a valley
 * front and back with wings at the sides.
 */
function cradle_body(d: any): any {
  const c = cradle_shape(d),
    e = CRADLE.edge,
    zb = d.z_floor_bottom;
  const levels = [plan(d, POD_FOOT_CHAMFER, zb), plan(d, 0, zb + POD_FOOT_CHAMFER)];
  for (let i = 0; i <= 4; i++) {
    const t = (i / 4) * (Math.PI / 2);
    levels.push(plan(d, e - e * Math.cos(t), c.edge - e + e * Math.sin(t)));
  }
  const collar = rotate_extrude(d.fn)(
    circle(CRADLE.tube, undefined, Math.max(Math.floor(d.fn / 4), 12)).translate([c.ring, 0]),
  ).translate([0, 0, c.wing - CRADLE.tube]);
  return hull()(...levels.map((lv) => slab(lv, EPS)), collar);
}
/** Cradle pod inside: straight down from just above the sensor plate, so the plates drop in. The
 * collar stays solid, so the saddle cut never opens into the inside. */
function cradle_inside(d: any): any {
  const wall = d.pod.wall,
    zb = d.z_floor_bottom;
  return slab(plan(d, wall, zb - 1), cradle_shape(d).edge - wall - zb + 1);
}
/**
 * Cradle pod cuts: the saddle, a straight shaft above the ball's equator (the wings may rise past
 * it, yet the ball still lifts out) and a shallow seam groove around the lower body.
 */
export function cradle_cuts(d: any): any {
  const c = cradle_shape(d),
    big = 4 * d.half_length + 40,
    g = CRADLE.groove_h / 2;
  const saddle = cylinder(big, c.saddle, undefined, undefined, undefined, undefined, d.fn * 2)
    .translate([0, 0, -big / 2])
    .rotate([90, 0, 0])
    .translate([0, 0, c.valley + c.saddle]);
  const shaft = zcyl(2 * d.cavity_r, 0, c.wing + 40, d.fn);
  const seam = sub(
    slab(plan(d, -1, c.seam - g), 2 * g),
    slab(plan(d, CRADLE.groove_depth, c.seam - g - EPS), 2 * g + 2 * EPS),
  );
  return union()(saddle, shaft, seam);
}

/** A plate that fits inside the shell (base or sensor plate), from z0 to z1. */
export function pod_plate(d: any, z0: number, z1: number): any {
  const [w, l, cx, cy] = d.footprint;
  const inset = d.pod.wall + POD_FIT;
  return slab({ z: z0, a: w / 2 - inset, b: l / 2 - inset, n: POD_SIDE_N, x: cx, y: cy }, z1 - z0);
}

/** Soft edge where the shell meets the ball opening. */
export function pod_rim_chamfer(d: any): any {
  const z = -d.cup.rim_below_center,
    r = Math.sqrt(Math.max(d.cavity_r ** 2 - z ** 2, 1));
  return cylinder(
    POD_RIM_CHAMFER + EPS,
    undefined,
    undefined,
    r,
    r + POD_RIM_CHAMFER + EPS,
    undefined,
    d.fn,
  ).translate([0, 0, z - POD_RIM_CHAMFER]);
}

/** Pilot holes in the sensor plate's underside for the screws coming up through the base. */
export function pod_plate_holes(d: any, points: number[][]): any[] {
  const z0 = d.z_pcb_face;
  return points.map(([x, y]) =>
    zcyl(POD_SCREW.pilot_dia, z0 - EPS, z0 + POD_SCREW.pilot_depth, d.fn).translate([x, y, 0]),
  );
}
