// Parametric model algorithms ported from checkpoint 1ed1441. All execution is TypeScript.
import {
  add,
  sub,
  mul,
  mod,
  index,
  get,
  truth,
  contains,
  range,
  length,
  abs,
  min,
  max,
  round,
  minBy,
  format,
  formatValue,
  math,
} from '../math.js';
import { _ } from '../i18n.js';
import { cube, union } from '../scad/index.js';
import { EPS, polar, rounded_rect, rounded_slab, zcyl } from './common.js';
import { lens_window_size } from './cup.js';
import { bootsel_deck_xy, lid_screw_points } from './tray.js';
import { tile_cutters } from './tiles.js';
export function pcb_features(d: any): any {
  let cr: any, cuts: any, fn: any, sy: any, y: any, z0: any;
  fn = d.fn;
  cr = d.carrier;
  z0 = d.z_pcb_face;
  cuts = [];
  for (sy of [-1, 1]) {
    y = mul(sy, d.pcb.hole_spacing) / 2;
    cuts.push(zcyl(cr.pcb_insert_dia, sub(z0, EPS), add(z0, cr.pcb_insert_depth), fn).translate([0, y, 0]));
  }
  return union()(...cuts);
}
export function _box(x0: any, x1: any, y0: any, y1: any, z0: any, z1: any): any {
  return cube([sub(x1, x0), sub(y1, y0), sub(z1, z0)]).translate([x0, y0, z0]);
}
export function _place(obj: any, x: any, y: any, ang: any): any {
  return obj.rotate([0, 0, ang]).translate([x, y, 0]);
}
export function key_switch_cutters(d: any): any {
  let _: any, cuts: any, hole: any, pocket: any, st: any, sw: any, x: any, y: any, z0: any, z1: any;
  [sw, st] = [d.switches, d.switches.type];
  [z0, z1] = [d.z_pcb_face, d.z_carrier_top];
  cuts = [];
  for ([x, y, _] of d.switch_positions()) {
    hole = cube([st.cutout, st.cutout, add(sub(z1, z0), 2)], true).translate([x, y, add(z0, z1) / 2]);
    pocket = _box(
      -st.pocket / 2,
      st.pocket / 2,
      -st.pocket / 2,
      st.pocket / 2,
      sub(z0, 1),
      sub(z1, st.plate_t),
    ).translate([x, y, 0]);
    cuts.push(add(hole, pocket));
  }
  return union()(...cuts);
}
export function micro_geometry_local(d: any): any {
  let Lp: any,
    Wp: any,
    bar: any,
    bar_bot: any,
    bar_len: any,
    bar_top: any,
    bar_w: any,
    bh: any,
    bl: any,
    body_cy: any,
    body_top: any,
    bw: any,
    groove: any,
    hinge_strip: any,
    inner: any,
    outer: any,
    plunger: any,
    pocket: any,
    s: any,
    slot: any,
    st: any,
    thin: any,
    x_h: any,
    x_p: any,
    x_tip: any,
    z0: any,
    z1: any;
  st = d.switches.type;
  [z0, z1] = [d.z_pcb_face, d.z_carrier_top];
  [Lp, Wp] = [st.size_in, d.switches.size_across];
  s = st.paddle_slot;
  [x_tip, x_h] = [Lp / 2, -Lp / 2];
  outer = _box(sub(-Lp / 2, s), add(Lp / 2, s), sub(-Wp / 2, s), add(Wp / 2, s), sub(z0, 1), add(z1, 1));
  inner = _box(-Lp / 2, Lp / 2, -Wp / 2, Wp / 2, sub(z0, 2), add(z1, 2));
  hinge_strip = _box(
    sub(sub(x_h, s), 1),
    x_h,
    sub(sub(-Wp / 2, s), 1),
    add(add(Wp / 2, s), 1),
    sub(z0, 2),
    add(z1, 2),
  );
  slot = sub(sub(outer, inner), hinge_strip);
  thin = _box(
    sub(-Lp / 2, s),
    add(Lp / 2, s),
    sub(-Wp / 2, s),
    add(Wp / 2, s),
    sub(z0, 1),
    sub(z1, st.paddle_t),
  );
  groove = _box(
    sub(x_h, st.hinge_len / 2),
    add(x_h, st.hinge_len / 2),
    sub(-Wp / 2, s),
    add(Wp / 2, s),
    sub(z0, 1),
    sub(z1, st.hinge_t),
  );
  [bl, bw, bh] = st.body;
  x_p = sub(x_tip, st.plunger_inset);
  bar_w = add(add(bw, mul(2, st.holder_wall)), 0.3);
  bar_len = add(add(Wp, mul(2, s)), mul(2, 6.0));
  bar_top = sub(sub(z1, st.paddle_t), st.paddle_gap);
  body_top = sub(sub(z1, st.paddle_t), st.plunger_h);
  bar_bot = sub(body_top, bh);
  bar = _box(sub(x_p, bar_w / 2), add(x_p, bar_w / 2), -bar_len / 2, bar_len / 2, bar_bot, bar_top);
  body_cy = -sub(bl / 2, st.plunger_from_end);
  pocket = _box(
    sub(x_p, add(bw, 0.3) / 2),
    add(x_p, add(bw, 0.3) / 2),
    sub(body_cy, add(bl, 0.3) / 2),
    add(body_cy, add(bl, 0.3) / 2),
    sub(bar_bot, 1),
    body_top,
  );
  plunger = zcyl(add(st.plunger_dia, 0.8), sub(body_top, EPS), add(bar_top, EPS), d.fn).translate([
    x_p,
    0,
    0,
  ]);
  return [add(add(slot, thin), groove), bar, add(pocket, plunger)];
}
export function micro_switch_parts(d: any): any {
  let a: any, after: any, ang: any, b: any, bar: any, bars: any, before: any, x: any, y: any;
  [before, bars, after] = [[], [], []];
  for ([x, y, ang] of d.switch_positions()) {
    [b, bar, a] = micro_geometry_local(d);
    before.push(_place(b, x, y, ang));
    bars.push(_place(bar, x, y, ang));
    after.push(_place(a, x, y, ang));
  }
  return [union()(...before), union()(...bars), union()(...after)];
}
export function carrier(d: any): any {
  let after: any,
    ang: any,
    bars: any,
    before: any,
    body: any,
    bs: any,
    cb: any,
    cr: any,
    cuts: any,
    cx: any,
    cy: any,
    fn: any,
    hole: any,
    l: any,
    plate: any,
    w: any,
    wl: any,
    ww: any,
    x: any,
    y: any,
    z0: any,
    z1: any;
  fn = d.fn;
  cr = d.carrier;
  [z0, z1] = [d.z_pcb_face, d.z_carrier_top];
  [w, l, cx, cy] = d.footprint;
  plate = rounded_slab(w, l, cr.corner_r, sub(z1, z0), cr.edge_round, fn).up(z0).translate([cx, cy, 0]);
  if (d.palm_square_corners) {
    // A fused palm rest continues the tray straight forward: square the lid's front corners to
    // meet it, keeping only the edge round-over (corner radius 0 lets it pick the smallest).
    const front = mul(
      rounded_slab(w, l, 0, sub(z1, z0), cr.edge_round, fn).up(z0).translate([cx, cy, 0]),
      cube([add(w, 2), add(cr.corner_r, 1), add(sub(z1, z0), 2)]).translate([
        sub(-w / 2, 1),
        sub(-d.front_length, 1),
        sub(z0, 1),
      ]),
    );
    plate = add(plate, front);
  }
  cuts = [];
  [ww, wl] = lens_window_size(d);
  cuts.push(
    rounded_rect(ww, wl, add(d.lens.corner_r, d.lens.clearance), add(sub(z1, z0), 2), fn).up(sub(z0, 1)),
  );
  for (ang of d.cup.carrier_screw_angles) {
    [x, y] = polar(d.cup.screw_radius(d.ball.r), ang);
    hole = zcyl(cr.screw_clear_dia, sub(z0, 1), add(z1, 1), fn);
    cb = zcyl(cr.screw_head_dia, sub(z0, EPS), add(z0, cr.screw_head_depth), fn);
    cuts.push(add(hole, cb).translate([x, y, 0]));
  }
  for ([x, y] of lid_screw_points(d)) {
    hole = zcyl(cr.screw_clear_dia, sub(z0, 1), add(z1, 1), fn);
    cb = zcyl(cr.screw_head_dia, sub(z1, cr.screw_head_depth), add(z1, EPS), fn);
    cuts.push(add(hole, cb).translate([x, y, 0]));
  }
  bs = bootsel_deck_xy(d);
  if (truth(bs !== null)) {
    cuts.push(
      zcyl(cr.bootsel_hole_dia, sub(z0, 1), add(z1, 1), fn).translate([index(bs, 0), index(bs, 1), 0]),
    );
  }
  cuts.push(pcb_features(d));
  body = sub(plate, union()(...cuts));
  if (truth(d.switches.is_tiles)) {
    [before, bars, after] = tile_cutters(d);
    body = sub(add(sub(body, before), bars), after);
  } else {
    if (truth(d.switches.count)) {
      if (truth(d.switches.type.kind === 'key')) {
        body = sub(body, key_switch_cutters(d));
      } else {
        [before, bars, after] = micro_switch_parts(d);
        body = sub(add(sub(body, before), bars), after);
      }
    }
  }
  return body;
}
