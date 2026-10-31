// Power switch opening, panel recess and cradle in the tray wall.
import { is_placement, type PowerSwitchPlacement } from '../calculations/power.js';
import { cube, cylinder, multmatrix, union, type Shape } from '../scad/index.js';
import { EPS, half_space_above, to_world } from './common.js';
import { mul } from '../math.js';

/** Box around the body centre: du along the wall, v inward from the outer face, dw up. */
const box = (u0: number, u1: number, v0: number, v1: number, w0: number, w1: number): Shape =>
  cube([u1 - u0, v1 - v0, w1 - w0]).translate([u0, v0, w0]);

/** Body-centred shape -> level with the floor -> wall frame -> deck frame -> world. */
function place(d: any, p: PowerSwitchPlacement, shape: Shape): Shape {
  const { origin, u, v } = p.frame;
  const m = [
    [u[0], v[0], 0, origin[0]],
    [u[1], v[1], 0, origin[1]],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  return to_world(multmatrix(m)(shape.rotate([0, p.roll, 0]).translate([p.u, 0, p.w_center])), d.deck);
}

function placement(d: any): PowerSwitchPlacement | null {
  const p = d.power_switch_placement();
  return is_placement(p) ? p : null;
}

/** [material to add, material to remove], already in world coordinates; null without a switch. */
export function power_switch_parts(d: any): [Shape | null, Shape | null] {
  const p = placement(d);
  if (!p) return [null, null];
  const { type } = p;
  const wall = d.tray.wall;
  const panel = Math.min(type.panel, wall);
  const [bu, bw] = type.body;
  const cuts: Shape[] = [];
  if (type.hole.shape === 'rect') {
    const { u: hu, w: hw } = type.hole;
    cuts.push(box(-hu / 2, hu / 2, -1, wall + 1, -hw / 2, hw / 2));
  } else {
    cuts.push(
      cylinder(wall + 2, type.hole.d / 2, undefined, undefined, undefined, false, d.fn)
        .rotate([-90, 0, 0])
        .translate([0, -1, 0]),
    );
  }
  let adds: Shape | null = null;
  if (type.cradle) {
    // Cheeks at both ends and a shelf underneath, open on top and at the back (pins). The switch
    // drops in behind the wall, then slides outward into a body-height recess in the wall.
    const reach = wall + 3.8;
    const cheek = 1.6;
    const block = box(-bu / 2 - cheek, bu / 2 + cheek, wall - EPS, reach, -bw / 2 - 40, bw / 2);
    const keep = half_space_above(d.z_floor_top - EPS, [600, 600], [0, 0], 600);
    adds = mul(place(d, p, block), keep);
    cuts.push(box(-bu / 2, bu / 2, panel, wall + EPS, -bw / 2, bw / 2));
    cuts.push(box(-bu / 2, bu / 2, wall, reach + 1, -bw / 2, bw / 2 + 20));
  } else if (panel < wall) {
    // Thin the wall from inside so snap tabs or the nut can reach.
    cuts.push(box(-bu / 2 - 1, bu / 2 + 1, panel, wall + 1, -bw / 2 - 1, bw / 2 + 1));
  }
  return [adds, place(d, p, union()(...cuts))];
}

/** Preview of the switch body for the hardware view. */
export function power_switch_preview(d: any): Shape | null {
  const p = placement(d);
  if (!p) return null;
  const panel = Math.min(p.type.panel, d.tray.wall);
  const [bu, bw, bv] = p.type.body;
  return place(d, p, box(-bu / 2 + 0.3, bu / 2 - 0.3, panel, panel + bv, -bw / 2, bw / 2));
}
