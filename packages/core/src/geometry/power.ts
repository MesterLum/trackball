// Power switch opening, panel recess and cradle in the tray wall.
import {
  RESET_HOLDER,
  is_placement,
  is_reset,
  reset_hole_dia,
  type PowerSwitchPlacement,
  type ResetPlacement,
} from '../calculations/power.js';
import { cube, cylinder, multmatrix, union, type Shape } from '../scad/index.js';
import { EPS, half_space_above, to_world } from './common.js';
import { mul } from '../math.js';

/** Box around the body centre: du along the wall, v inward from the outer face, dw up. */
const box = (u0: number, u1: number, v0: number, v1: number, w0: number, w1: number): Shape =>
  cube([u1 - u0, v1 - v0, w1 - w0]).translate([u0, v0, w0]);

/** Body-centred shape -> level with the floor -> wall frame -> deck frame -> world. */
function place(
  d: any,
  p: Pick<PowerSwitchPlacement, 'frame' | 'u' | 'w_center' | 'roll'>,
  shape: Shape,
): Shape {
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
  // A pod's wall is its shell or base, without the tray's fitting gap.
  const wall = d.is_pod ? d.pod.wall : d.tray.wall;
  const panel = Math.min(type.panel, wall);
  const [bu, bw] = type.body;
  const cuts: Shape[] = [];
  if (type.hole.shape === 'rect') {
    // Snap-in bezels: the opening grows by the printer's fit on each side.
    const [hu, hw] = [type.hole.u + 2 * d.fit.gap, type.hole.w + 2 * d.fit.gap];
    cuts.push(box(-hu / 2, hu / 2, -1, wall + 1, -hw / 2, hw / 2));
  } else {
    cuts.push(
      cylinder(wall + 2, (type.hole.d + d.fit.hole) / 2, undefined, undefined, undefined, false, d.fn)
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
  const panel = Math.min(p.type.panel, d.is_pod ? d.pod.wall : d.tray.wall);
  const [bu, bw, bv] = p.type.body;
  return place(d, p, box(-bu / 2 + 0.3, bu / 2 - 0.3, panel, panel + bv, -bw / 2, bw / 2));
}

function reset_placement(d: any): ResetPlacement | null {
  const p = d.reset_switch_placement();
  return is_reset(p) ? p : null;
}
/**
 * Reset button holder and pin hole, [material to add, material to remove] in world coordinates.
 * The switch drops in from above between two cheeks, on a shelf, its plunger in the hole; a rib
 * behind it, between its legs, takes the press. Open on top, so it prints without support. Legs at
 * the body's ends leave behind it past the cheeks, so there the cheeks stop at the body's back.
 */
export function reset_switch_parts(d: any): [Shape | null, Shape | null] {
  const p = reset_placement(d);
  if (!p) return [null, null];
  const h = RESET_HOLDER,
    t = p.type,
    [su, sw] = [p.side_u, p.side_w],
    half = su / 2 + h.cheek,
    low = -sw / 2 - 40,
    back = p.v_body + t.depth + h.clear,
    cheek_end = t.legs === 'rows' ? p.v_rib : back;
  const holder = union()(
    box(-half, half, p.v_block, back, low, -sw / 2),
    box(-half, -su / 2, p.v_block, cheek_end, low, sw / 2),
    box(su / 2, half, p.v_block, cheek_end, low, sw / 2),
    box(-t.rib_w / 2, t.rib_w / 2, back - EPS, p.v_rib, low, sw / 2),
    ...(p.v_body > p.v_block ? [box(-half, half, p.v_block, p.v_body + EPS, low, sw / 2 + 1)] : []),
  );
  const keep = half_space_above(d.z_floor_top - EPS, [600, 600], [0, 0], 600);
  const hole = cylinder(
    p.v_body + 1 + EPS,
    (reset_hole_dia(t) + d.fit.hole) / 2,
    undefined,
    undefined,
    undefined,
    false,
    d.fn,
  )
    .rotate([-90, 0, 0])
    .translate([0, -1, 0]);
  const pocket = box(-su / 2, su / 2, p.v_body, back, -sw / 2, sw / 2 + 20);
  return [mul(place(d, p, holder), keep), place(d, p, union()(hole, pocket))];
}
/** Preview of the reset switch for the hardware view. */
export function reset_switch_preview(d: any): Shape | null {
  const p = reset_placement(d);
  if (!p) return null;
  const t = p.type,
    [bu, bw] = [t.body[0] / 2, t.body[1] / 2],
    [pu, pw] = [t.plunger[0] / 2, t.plunger[1] / 2];
  const plunger = t.round
    ? cylinder(t.proud, pu, undefined, undefined, undefined, false, 24)
        .rotate([-90, 0, 0])
        .translate([0, p.v_body - t.proud, 0])
    : box(-pu, pu, p.v_body - t.proud, p.v_body, -pw, pw);
  return place(d, p, union()(box(-bu, bu, p.v_body, p.v_body + t.depth, -bw, bw), plunger));
}
