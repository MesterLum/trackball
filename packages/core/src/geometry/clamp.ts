// Controller clamp: screw posts on the tray pocket and the separate clamp bar.
import { CLAMP, clamp_layout, type ClampLayout } from '../calculations/clamp.js';
import { cube, difference, union, type Shape } from '../scad/index.js';
import { EPS, zcyl } from './common.js';
import { mcu_pose } from './tray.js';

/** Box in board-local coordinates (a along the board, c across, world z). */
const box = (a0: number, a1: number, c0: number, c1: number, z0: number, z1: number): Shape =>
  cube([a1 - a0, c1 - c0, z1 - z0]).translate([a0, c0, z0]);

const post_a = (l: ClampLayout) => (l.a0 + l.a1) / 2;

/** Board-local frame -> world, matching the pocket in the tray. */
export function board_to_world(d: any, shape: Shape): Shape {
  const t = d.tray;
  const rot = t.usb_exit === 'back' ? 90.0 : t.usb_side > 0 ? 0.0 : 180.0;
  const [mx, my] = mcu_pose(d);
  return shape.rotate([0, 0, rot]).translate([mx, my, 0]);
}

/** [posts, pilot holes] in board-local coordinates, to merge into the pocket frame. */
export function clamp_posts(d: any): [Shape, Shape] | null {
  const l = clamp_layout(d);
  if (!l) return null;
  const a = post_a(l);
  const posts: Shape[] = [];
  const pilots: Shape[] = [];
  for (const c of [-l.post_c, l.post_c]) {
    posts.push(zcyl(CLAMP.post_dia, d.z_floor_top - EPS, l.post_top, d.fn).translate([a, c, 0]));
    pilots.push(
      zcyl(CLAMP.pilot_dia, l.post_top - CLAMP.pilot_depth, l.post_top + 1, d.fn).translate([a, c, 0]),
    );
  }
  return [union()(...posts), union()(...pilots)];
}

/**
 * The clamp bar, in place on the board (world coordinates). Print it upside down, flat top on
 * the bed. Its pad presses only on the set contact area; elsewhere the underside stays raised.
 */
export function mcu_clamp(d: any): Shape | null {
  const l = clamp_layout(d);
  if (!l) return null;
  const a = post_a(l);
  const plate = box(l.a0, l.a1, -l.half_c, l.half_c, l.board_top + CLAMP.relief, l.bar_top);
  const pad = box(
    l.far_end,
    l.pad_a1,
    -l.pad_half_c,
    l.pad_half_c,
    l.board_top,
    l.board_top + CLAMP.relief + EPS,
  );
  const holes = [-l.post_c, l.post_c].map((c) =>
    zcyl(CLAMP.clear_dia, l.board_top, l.bar_top + 1, d.fn).translate([a, c, 0]),
  );
  return board_to_world(d, difference()(union()(plate, pad), ...holes));
}
