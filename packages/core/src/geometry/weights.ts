// A pod's weight chamber under the base and the cap that closes it.
import { add, mul, sub } from '../math.js';
import { cube, cylinder, rotate_extrude, square, union } from '../scad/index.js';
import { WEIGHT_CAP, cap_clearance } from '../calculations/pod.js';
import { EPS, zcyl } from './common.js';
import { thread_solid } from './thread.js';

const LUG_ANGLES = [90, 210, 330];

/** Annular sector from radius r0 to r1, height z0..z1, spanning a0..a1 degrees. */
function sector(r0: number, r1: number, z0: number, z1: number, a0: number, a1: number, fn: number): any {
  return rotate_extrude(fn, a1 - a0)(square([r1 - r0, z1 - z0]).translate([r0, z0])).rotate([0, 0, a0]);
}
/** Half the angle a bayonet lug spans at radius r, plus its clearance (degrees). */
function lug_half(r: number, clear: number): number {
  return ((WEIGHT_CAP.lug.width / 2 + clear) / r) * (180 / Math.PI);
}

/** What the cap (or the open pocket) removes from the base, in place under it. */
export function weight_chamber(d: any): any | null {
  const b = d.ballast;
  if (!b) return null;
  const k = WEIGHT_CAP,
    clear = cap_clearance(d),
    fn = d.fn,
    zb = d.z_floor_bottom,
    top = zb + b.total;
  const [, , cx, cy] = d.footprint;
  const cuts = [];
  if (b.cap === 'none') cuts.push(zcyl(b.dia, zb - 1, top, fn));
  else if (b.cap === 'thread') {
    // The cap's thread grown by the clearance, a whole pitch lower so both keep the same phase.
    const p = k.thread.pitch;
    cuts.push(
      mul(
        thread_solid(k.thread, b.outer_r - k.thread.depth, b.total + 2 * p, fn).translate([0, 0, zb - p]),
        zcyl(2 * b.outer_r + 2, zb - 1, top, fn),
      ),
    );
    // Lead-in chamfer at the opening.
    cuts.push(
      cylinder(1 + EPS, undefined, undefined, b.outer_r + 0.6, b.outer_r - k.thread.depth, false, fn).up(
        zb - EPS,
      ),
    );
  } else {
    // Bayonet: the cup, an entry slot per lug, and a groove each lug turns into at the top.
    const rh = cup_radius(b) + clear;
    cuts.push(zcyl(2 * rh, zb - 1, top, fn));
    for (const a of LUG_ANGLES) {
      const h = lug_half(rh, clear);
      cuts.push(sector(rh - 0.1, b.outer_r, zb - 1, top, a - h, a + h, fn));
      cuts.push(sector(rh - 0.1, b.outer_r, top - k.lug.height - clear, top, a - h, a + k.lug.turn + h, fn));
    }
  }
  return union()(...cuts).translate([cx, cy, 0]);
}

/** Outer radius of the cap's cup body (inside the thread ridge or the lugs). */
function cup_radius(b: any): number {
  return b.dia / 2 + WEIGHT_CAP.wall;
}

/** The printed cap, a cup open at the top, in place under the base (a bayonet cap shown locked). */
export function weight_cap(d: any): any | null {
  const b = d.ballast;
  if (!b || b.cap === 'none') return null;
  const k = WEIGHT_CAP,
    clear = cap_clearance(d),
    fn = d.fn,
    zb = d.z_floor_bottom;
  const [, , cx, cy] = d.footprint;
  let cap: any;
  if (b.cap === 'thread') cap = thread_solid(k.thread, b.outer_r - k.thread.depth - clear, b.total, fn);
  else {
    const r = cup_radius(b);
    const lugs = LUG_ANGLES.map((a) => {
      const h = lug_half(r, clear) - (clear / r) * (180 / Math.PI);
      return sector(r - 0.5, b.outer_r - clear, b.total - k.lug.height, b.total, a - h, a + h, fn);
    });
    cap = add(zcyl(2 * r, 0, b.total, fn), union()(...lugs)).rotate([0, 0, k.lug.turn]);
  }
  // Hollow it into a cup for the weights, and cut a slot across the bottom to turn it with a coin.
  const s = k.slot;
  cap = sub(cap, union()(zcyl(b.dia, b.seat, b.total + 1, fn), cube([s.length, s.width, 2 * s.depth], true)));
  return cap.translate([cx, cy, zb]);
}
