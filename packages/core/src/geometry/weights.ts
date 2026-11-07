// A pod's weight chamber under the base and the cap that closes it.
import { add, sub } from '../math.js';
import { cube, cylinder, rotate_extrude, square, union } from '../scad/index.js';
import { WEIGHT_CAP } from '../calculations/pod.js';
import { EPS, zcyl } from './common.js';
import { thread_solid } from './thread.js';

const LUG_ANGLES = [90, 210, 330];

/** Annular sector from radius r0 to r1, height z0..z1, spanning a0..a1 degrees. */
function sector(r0: number, r1: number, z0: number, z1: number, a0: number, a1: number, fn: number): any {
  return rotate_extrude(fn, a1 - a0)(square([r1 - r0, z1 - z0]).translate([r0, z0])).rotate([0, 0, a0]);
}
/** Half the angle a bayonet lug spans at radius r, plus its clearance (degrees). */
function lug_half(r: number): number {
  const k = WEIGHT_CAP;
  return ((k.lug.width / 2 + k.clearance) / r) * (180 / Math.PI);
}

/** What the chamber and its closure remove from the base, in place under it. */
export function weight_chamber(d: any): any | null {
  const b = d.ballast;
  if (!b) return null;
  const k = WEIGHT_CAP,
    fn = d.fn,
    zb = d.z_floor_bottom;
  const [, , cx, cy] = d.footprint;
  const cuts = [zcyl(b.dia, zb + b.seat - EPS, zb + b.total, fn)];
  if (b.cap === 'none') cuts.push(zcyl(b.dia, zb - 1, zb + b.total, fn));
  else if (b.cap === 'thread') {
    // The cap's thread grown by the clearance, a whole pitch lower so both keep the same phase.
    const p = k.thread.pitch;
    cuts.push(
      thread_solid(k.thread, b.outer_r - k.thread.depth, b.seat + 2 * p, fn).translate([0, 0, zb - p]),
    );
    // Lead-in chamfer at the opening.
    cuts.push(
      cylinder(1 + EPS, undefined, undefined, b.outer_r + 0.6, b.outer_r - k.thread.depth, false, fn).up(
        zb - EPS,
      ),
    );
  } else {
    // Bayonet: the cap's body, an entry slot per lug, and a groove each lug turns into.
    const rh = b.dia / 2 + k.clearance,
      top = zb + b.seat;
    cuts.push(zcyl(2 * rh, zb - 1, top, fn));
    for (const a of LUG_ANGLES) {
      const h = lug_half(rh);
      cuts.push(sector(rh - 0.1, b.outer_r, zb - 1, top, a - h, a + h, fn));
      cuts.push(
        sector(
          rh - 0.1,
          b.outer_r,
          top - k.lug.height - k.clearance,
          top + EPS,
          a - h,
          a + k.lug.turn + h,
          fn,
        ),
      );
    }
  }
  return union()(...cuts).translate([cx, cy, 0]);
}

/** The printed cap, in place under the base (a bayonet cap shown turned into its lock). */
export function weight_cap(d: any): any | null {
  const b = d.ballast;
  if (!b || b.cap === 'none') return null;
  const k = WEIGHT_CAP,
    fn = d.fn,
    zb = d.z_floor_bottom;
  const [, , cx, cy] = d.footprint;
  let cap: any;
  if (b.cap === 'thread') cap = thread_solid(k.thread, b.outer_r - k.thread.depth - k.clearance, b.seat, fn);
  else {
    const r = b.dia / 2;
    const lugs = LUG_ANGLES.map((a) => {
      const h = lug_half(r) - (k.clearance / r) * (180 / Math.PI);
      return sector(r - 0.5, b.outer_r - k.clearance, b.seat - k.lug.height, b.seat, a - h, a + h, fn);
    });
    cap = add(zcyl(2 * r, 0, b.seat, fn), union()(...lugs)).rotate([0, 0, k.lug.turn]);
  }
  // A slot across the bottom to turn it with a coin.
  const s = k.slot;
  cap = sub(cap, cube([s.length, s.width, 2 * s.depth], true));
  return cap.translate([cx, cy, zb]);
}
