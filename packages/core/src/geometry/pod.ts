// Compact desk pod: one rounded shell from the ball down to the desk, over a flat base plate.
import { add, sub } from '../math.js';
import {
  circle,
  cylinder,
  hull,
  linear_extrude,
  polygon,
  rotate_extrude,
  square,
  union,
} from '../scad/index.js';
import {
  CRADLE,
  POD_FIT,
  POD_FOOT_CHAMFER,
  POD_RIM_CHAMFER,
  POD_SCREW,
  POD_SIDE_N,
  cradle_shape,
  type CradleShape,
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
 * Cradle pod outside: a low soft-square base with a rounded top edge, and a round cup rising
 * from it on a concave fillet up to a flat rim with a rounded lip.
 */
function cradle_body(d: any): any {
  const c = cradle_shape(d),
    e = CRADLE.edge,
    f = c.fillet,
    l = CRADLE.lip,
    zb = d.z_floor_bottom;
  const levels = [plan(d, POD_FOOT_CHAMFER, zb), plan(d, 0, zb + POD_FOOT_CHAMFER)];
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * (Math.PI / 2);
    levels.push(plan(d, e - e * Math.cos(t), c.edge - e + e * Math.sin(t)));
  }
  // Banded: one small hull per pair of levels is robust where one big hull of near-flat slices
  // trips CGAL.
  const base = union()(
    ...levels.slice(1).map((lv, i) => hull()(slab(levels[i], EPS), slab({ ...lv, z: lv.z - EPS }, EPS))),
  );
  // Cup profile (radius, height), reaching into the base: the wall, a foot that the fillet circle
  // hollows into a concave curve, and the rim's outer corner rounded into a lip.
  let profile = union()(
    square([c.cup_r, c.rim - c.edge + 4]).translate([0, c.edge - 4]),
    square([c.cup_r + f, f + 4]).translate([0, c.edge - 4]),
  );
  profile = sub(profile, circle(f, undefined, d.fn).translate([c.cup_r + f, c.edge + f]));
  profile = add(
    sub(profile, square([l + EPS, l + EPS]).translate([c.cup_r - l, c.rim - l])),
    circle(l, undefined, 24).translate([c.cup_r - l, c.rim - l]),
  );
  return union()(base, rotate_extrude(d.fn)(profile));
}
/** Cradle pod inside: straight down from just above the sensor plate, so the plates drop in. The
 * cup stays solid, so the notch never opens into the inside. */
function cradle_inside(d: any): any {
  const wall = d.pod.wall,
    zb = d.z_floor_bottom;
  return slab(plan(d, wall, zb - 1), cradle_shape(d).edge - wall - zb + 1);
}
/** U shape (in x and height) of the front notch, widened by grow. */
function notch_profile(c: CradleShape, grow: number): any {
  const r = c.notch_r + grow;
  return hull()(
    circle(r, undefined, 48).translate([0, c.notch_bottom + c.notch_r]),
    square([2 * r, 1]).translate([-r, c.rim + 20]),
  );
}
/**
 * Cradle pod cuts: the bevelled front notch, a straight shaft above the ball's equator (the rim
 * may sit above it, yet the ball still lifts out) and a shallow seam groove around the lower body.
 */
export function cradle_cuts(d: any): any {
  const c = cradle_shape(d),
    b = CRADLE.bevel,
    g = CRADLE.groove_h / 2;
  // Extruded towards the front (-y); the wider slice at the cup's face bevels the notch edge.
  const along = (shape: any, y0: number, y1: number) =>
    linear_extrude(y1 - y0)(shape)
      .translate([0, 0, y0])
      .rotate([90, 0, 0]);
  const notch = hull()(
    along(notch_profile(c, 0), 0, c.cup_r - b),
    along(notch_profile(c, b + 0.6), c.cup_r + 0.6, c.cup_r + 0.6 + EPS),
  );
  const shaft = zcyl(2 * d.cavity_r, 0, c.rim + 40, d.fn);
  const seam = sub(
    slab(plan(d, -1, c.seam - g), 2 * g),
    slab(plan(d, CRADLE.groove_depth, c.seam - g - EPS), 2 * g + 2 * EPS),
  );
  return union()(notch, shaft, seam);
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
