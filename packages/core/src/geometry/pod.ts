// Compact desk pod: the shell that wraps the cup and the parts that change in the base and plate.
import { sub } from '../math.js';
import { hull } from '../scad/index.js';
import { POD_SCREW, POD_SLICES, pod_outline } from '../calculations/pod.js';
import { EPS, rounded_rect, zcyl } from './common.js';

/** Thin slices of the shell profile from the plate (z0) up to z1, hulled into a smooth body. */
function body(d: any, z0: number, z1: number, inset: number): any {
  const slices = [];
  for (let i = 0; i <= POD_SLICES; i++) {
    const s = i / POD_SLICES;
    const o = pod_outline(d, s, inset);
    const z = z0 + (z1 - z0) * s;
    slices.push(
      rounded_rect(o.w, o.l, o.r, EPS, d.fn)
        .translate([o.x, o.y, 0])
        .up(i === POD_SLICES ? z - EPS : z),
    );
  }
  return hull()(...slices);
}

/**
 * Rounded-square shell from the sensor plate up to the cup rim, hollow underneath. The cup is
 * added to it and the cavity, supports and openings are cut afterwards, so they cut both.
 */
export function pod_shroud(d: any): any {
  const wall = d.pod.wall;
  const [z0, z1] = [d.z_cup_bottom, -d.cup.rim_below_center];
  const outer = body(d, z0, z1, 0);
  const inner = body(d, z0 - 1, z1 - wall, wall);
  return sub(outer, inner);
}

/** Pilot holes in the sensor plate's underside for the screws coming up through the base. */
export function pod_plate_holes(d: any, points: number[][]): any[] {
  const z0 = d.z_pcb_face;
  return points.map(([x, y]) =>
    zcyl(POD_SCREW.pilot_dia, z0 - EPS, z0 + POD_SCREW.pilot_depth, d.fn).translate([x, y, 0]),
  );
}
