// Compact desk pod: one rounded shell from the ball down to the desk, over a flat base plate.
import { add, sub } from '../math.js';
import {
  circle,
  cylinder,
  hull,
  linear_extrude,
  polygon,
  polyhedron,
  rotate_extrude,
  square,
  union,
} from '../scad/index.js';
import {
  CRADLE,
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
/**
 * Solid lofted through outlines stacked bottom to top. Every outline has the same number of points
 * at the same angles, so neighbouring rings join with quads: an exact mesh, no hull (which CGAL can
 * fail on near-flat slices).
 */
function body(levels: PodLevel[]): any {
  const rings = levels.map((lv) => squircle(lv.a, lv.b, lv.n).map(([x, y]) => [x + lv.x, y + lv.y, lv.z]));
  const n = rings[0].length;
  const at = (i: number, j: number) => i * n + (j % n);
  const faces: number[][] = [Array.from({ length: n }, (_, j) => at(0, j))];
  for (let i = 0; i + 1 < rings.length; i++)
    for (let j = 0; j < n; j++) {
      faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1)]);
      faces.push([at(i, j), at(i + 1, j + 1), at(i, j + 1)]);
    }
  faces.push(Array.from({ length: n }, (_, j) => at(rings.length - 1, n - 1 - j)));
  return polyhedron(rings.flat(), faces);
}

/**
 * The pod's shell: hollow underneath with an even wall, its inside straight down to the desk so
 * the base plate drops in. The cup is added to it and the cavity, supports and openings are cut
 * afterwards, so they cut both.
 */
export function pod_shroud(d: any): any {
  const wall = d.pod.wall;
  // Holding the sensor, the shell is solid from the seam up, so it has no ceiling to support.
  if (d.pod.shell_mount) return cradle_body(d);
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
 * Bands between soft-square outlines of the same shape and centre. A smaller outline is an exact
 * scaled copy, so each band is one scaled extrusion: no hull, which CGAL can fail on near-flat
 * slices.
 */
function banded(levels: PodLevel[]): any {
  // Outlines at the same height (a zero chamfer) add no band.
  const kept = levels.filter((lv, i) => i === 0 || lv.z - levels[i - 1].z > EPS);
  return union()(
    ...kept.slice(1).map((top, i) => {
      const low = kept[i];
      return linear_extrude(top.z - low.z, false, undefined, undefined, undefined, [
        top.a / low.a,
        top.b / low.b,
      ])(polygon(squircle(low.a, low.b, low.n))).translate([low.x, low.y, low.z]);
    }),
  );
}

/**
 * Cradle pod shell: from the seam up, a soft-square body with a rounded top edge, and a round cup
 * rising from it on a concave fillet up to a flat rim with a rounded lip.
 */
function cradle_body(d: any): any {
  const c = cradle_shape(d),
    e = CRADLE.edge,
    f = c.fillet,
    l = CRADLE.lip,
    // At the seam the shell meets the base flush; down at the desk it keeps a foot chamfer.
    k = d.pod.walled ? CRADLE.seam_chamfer : POD_FOOT_CHAMFER;
  const levels = [plan(d, k, c.seam), plan(d, 0, c.seam + k)];
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * (Math.PI / 2);
    levels.push(plan(d, e - e * Math.cos(t), c.edge - e + e * Math.sin(t)));
  }
  const base = banded(levels);
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
/** Cradle pod shell inside: open from the seam up to just above the sensor plate, which drops
 * in. The cup stays solid, so the notch never opens into the inside. */
function cradle_inside(d: any): any {
  const c = cradle_shape(d),
    wall = d.pod.wall;
  return slab(plan(d, wall, c.seam - 1), c.edge - wall - c.seam + 1);
}
/**
 * Cradle pod base: a tray whose solid wall closes the electronics bay up to the seam, chamfered at
 * the desk and at the seam.
 */
export function cradle_base(d: any): any {
  const c = cradle_shape(d),
    k = CRADLE.seam_chamfer,
    zb = d.z_floor_bottom;
  const outside = banded([
    plan(d, POD_FOOT_CHAMFER, zb),
    plan(d, 0, zb + POD_FOOT_CHAMFER),
    plan(d, 0, c.seam - k),
    plan(d, k, c.seam),
  ]);
  return sub(
    outside,
    union()(slab(plan(d, d.pod.wall, d.z_floor_top), c.seam - d.z_floor_top + 1), ...cradle_side(d)),
  );
}
/**
 * Design on the cradle's lower wall (the base's wall, or the shell's straight sides when it comes
 * down to the desk): a shallow recessed band or a few V grooves, all with 45° edges so they print
 * without support and leave the wall solid.
 */
export function cradle_side(d: any): any[] {
  const c = cradle_shape(d),
    zb = d.z_floor_bottom,
    top = d.pod.walled ? c.seam : c.edge - CRADLE.edge;
  // Cut what lies outside the recessed surface, within z0..z1.
  const recess = (levels: PodLevel[]) =>
    sub(
      slab(plan(d, -1, levels[0].z + EPS), levels[levels.length - 1].z - levels[0].z - 2 * EPS),
      banded(levels),
    );
  if (d.pod.side === 'band') {
    const t = CRADLE.band_depth,
      z0 = zb + (top - zb) * CRADLE.band_from,
      z1 = zb + (top - zb) * CRADLE.band_to;
    return [recess([plan(d, 0, z0), plan(d, t, z0 + t), plan(d, t, z1 - t), plan(d, 0, z1)])];
  }
  if (d.pod.side === 'grooves') {
    const g = CRADLE.groove_depth,
      h = CRADLE.groove_half;
    return Array.from({ length: CRADLE.grooves }, (_, i) => {
      const z = zb + ((top - zb) * (i + 1)) / (CRADLE.grooves + 1);
      return recess([plan(d, 0, z - h), plan(d, g, z), plan(d, 0, z + h)]);
    });
  }
  return [];
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
 * Cradle pod cuts: the bevelled front notch and a straight shaft above the ball's equator (the rim
 * may sit above it, yet the ball still lifts out).
 */
export function cradle_cuts(d: any): any {
  const c = cradle_shape(d),
    b = CRADLE.bevel;
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
  // Without a walled base, the side design goes on the shell's own lower wall.
  const cuts = [notch, shaft, ...(d.pod.walled ? [] : cradle_side(d))];
  if (c.funnel > 0) {
    const r = Math.sqrt(Math.max(d.cavity_r ** 2 - Math.min(c.rim, 0) ** 2, 1));
    cuts.push(
      cylinder(c.funnel + EPS, undefined, undefined, r, r + c.funnel + EPS, undefined, d.fn).translate([
        0,
        0,
        c.rim - c.funnel,
      ]),
    );
  }
  return union()(...cuts);
}

/** A plate that fits inside the shell (base or sensor plate), from z0 to z1. */
export function pod_plate(d: any, z0: number, z1: number): any {
  const [w, l, cx, cy] = d.footprint;
  const inset = d.pod.wall + d.pod.fit;
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

/** Holes through the sensor plate for the screws coming up through the base, each with a hex
 * pocket on top for its nut. */
export function pod_plate_holes(d: any, points: number[][]): any[] {
  const [z0, z1] = [d.z_pcb_face, d.z_carrier_top];
  const r = (POD_SCREW.nut_af + d.fit.hole) / 2 / Math.cos(Math.PI / 6);
  return points.map(([x, y]) =>
    add(
      zcyl(POD_SCREW.clear_dia + d.fit.hole, z0 - 1, z1 + 1, d.fn),
      cylinder(POD_SCREW.nut_depth + 1, r, undefined, undefined, undefined, false, 6).up(
        z1 - POD_SCREW.nut_depth,
      ),
    ).translate([x, y, 0]),
  );
}
