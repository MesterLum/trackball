// Compact desk pod: one rounded shell from the ball down to the desk, over a flat base plate.
import { sub } from '../math.js';
import { cylinder, hull, linear_extrude, polygon } from '../scad/index.js';
import {
  POD_FIT,
  POD_RIM_CHAMFER,
  POD_SCREW,
  POD_SIDE_N,
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
  const inner = pod_levels(d, wall, wall);
  // Straight inside down past the bottom chamfer, so the base plate fits all the way in.
  inner[0] = { ...inner[1], z: d.z_floor_bottom - 1 };
  return sub(body(pod_levels(d)), body(inner));
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
