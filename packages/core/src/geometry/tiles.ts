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
import { circle, cube, linear_extrude, offset, polygon, square, union } from '../scad/index.js';
import { EPS, zcyl } from './common.js';
export const SIDES = { ['right']: 0.0, ['back']: 90.0, ['left']: 180.0, ['front']: 270.0 };
export const TILE_COUNTS = [2, 4, 6, 8];
export const TILE_DEPTH_MIN = 18.0;
export class Tile {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.side = values.side ?? null;
    this.a0 = values.a0 ?? null;
    this.a1 = values.a1 ?? null;
    this.x = values.x ?? null;
    this.y = values.y ?? null;
    this.inward = values.inward ?? null;
  }
}
export function segments_per_side(count: any): any {
  let k: any;
  if (truth(count === 2)) {
    return { ['left']: 1, ['right']: 1 };
  }
  k = index({ [4]: 1, [6]: 2, [8]: 3 }, count);
  return { ['front']: k, ['back']: k, ['left']: 1, ['right']: 1 };
}
export function ring_radius(d: any): any {
  return add(d.skirt_dia / 2, d.switches.tile_ring);
}
export function plunger_radius(d: any): any {
  return add(add(ring_radius(d), d.switches.tile_slot), d.switches.type.plunger_inset);
}
export function tile_depth(d: any): any {
  return sub(sub(d.half_width, d.switches.tile_frame), ring_radius(d));
}
export function tiles(d: any): any {
  let a0: any,
    a1: any,
    am: any,
    b0: any,
    b1: any,
    c: any,
    half_span: any,
    hl: any,
    hs: any,
    hw: any,
    j: any,
    k: any,
    mid: any,
    out: any,
    r_p: any,
    side: any,
    sw: any,
    x: any,
    y: any;
  sw = d.switches;
  if (truth(truth(sw.placement !== 'tiles') || truth(!contains(TILE_COUNTS, sw.count)))) {
    return [];
  }
  [hw, hl] = [d.half_width, d.half_length];
  c = math.degrees(math.atan2(hl, hw));
  half_span = { ['right']: c, ['left']: c, ['back']: sub(90.0, c), ['front']: sub(90.0, c) };
  r_p = plunger_radius(d);
  out = [];
  for ([side, k] of Object.entries(segments_per_side(sw.count))) {
    [mid, hs] = [index(SIDES, side), index(half_span, side)];
    [a0, a1] = [sub(mid, hs), add(mid, hs)];
    for (j of range(k)) {
      b0 = add(a0, mul(sub(a1, a0), j) / k);
      b1 = add(a0, mul(sub(a1, a0), add(j, 1)) / k);
      am = add(b0, b1) / 2;
      [x, y] = [mul(r_p, math.cos(math.radians(am))), mul(r_p, math.sin(math.radians(am)))];
      out.push(new Tile({ side: side, a0: b0, a1: b1, x: x, y: y, inward: mod(add(am, 180.0), 360.0) }));
    }
  }
  return out;
}
export function positions(d: any): any {
  return (() => {
    const result: any = [];
    for (const t of tiles(d)) {
      result.push([t.x, t.y, t.inward]);
    }
    return result;
  })();
}
export function holder_reach(d: any): any {
  let st: any;
  st = d.switches.type;
  return add(add(add(index(st.body, 0), mul(2, st.holder_wall)), 0.3) / 2, 1.0);
}
export function holder_boxes(d: any): any {
  let r: any;
  r = holder_reach(d);
  return (() => {
    const result: any = [];
    for (const t of tiles(d)) {
      result.push([sub(t.x, r), add(t.x, r), sub(t.y, r), add(t.y, r)]);
    }
    return result;
  })();
}
export function _sector(a0: any, a1: any, R: any): any {
  let n: any, pts: any;
  n = max(2, add(Math.trunc(sub(a1, a0) / 5), 1));
  pts = add(
    [[0.0, 0.0]],
    (() => {
      const result: any = [];
      for (const i of range(add(n, 1))) {
        result.push([
          mul(R, math.cos(math.radians(add(a0, mul(sub(a1, a0), i) / n)))),
          mul(R, math.sin(math.radians(add(a0, mul(sub(a1, a0), i) / n)))),
        ]);
      }
      return result;
    })(),
  );
  return polygon(pts);
}
export function _hinge_line(side: any, d: any): any {
  let f: any;
  f = d.switches.tile_frame;
  return index(
    {
      ['front']: ['y', -sub(d.half_length, f)],
      ['back']: ['y', sub(d.half_length, f)],
      ['left']: ['x', -sub(d.half_width, f)],
      ['right']: ['x', sub(d.half_width, f)],
    },
    side,
  );
}
export function _band(side: any, d: any, half: any): any {
  let axis: any, big: any, c: any;
  [axis, c] = _hinge_line(side, d);
  big = mul(4, max(d.half_width, d.half_length));
  if (truth(axis === 'y')) {
    return square([big, mul(2, half)], true).translate([0, c]);
  }
  return square([mul(2, half), big], true).translate([c, 0]);
}
export function _frame_region(side: any, d: any): any {
  let axis: any, big: any, c: any, outward: any;
  [axis, c] = _hinge_line(side, d);
  big = mul(4, max(d.half_width, d.half_length));
  outward = truth(c > 0) ? 1 : -1;
  if (truth(axis === 'y')) {
    return square([big, big]).translate([-big / 2, truth(outward > 0) ? c : sub(c, big)]);
  }
  return square([big, big]).translate([truth(outward > 0) ? c : sub(c, big), -big / 2]);
}
export function _mirror_about_hinge(obj: any, side: any, d: any): any {
  let axis: any, c: any;
  [axis, c] = _hinge_line(side, d);
  if (truth(axis === 'y')) {
    return obj.translate([0, -c]).mirror([0, 1]).translate([0, c]);
  }
  return obj.translate([-c, 0]).mirror([1, 0]).translate([c, 0]);
}
export function tile_cutters(d: any): any {
  let R: any,
    after: any,
    around: any,
    band: any,
    bar: any,
    bar_bot: any,
    bar_len: any,
    bar_top: any,
    bar_w: any,
    bh: any,
    bl: any,
    body_cy: any,
    body_top: any,
    bosses2d: any,
    bw: any,
    core: any,
    cr: any,
    cutters: any,
    cx: any,
    cy: any,
    f: any,
    fn: any,
    gap: any,
    groove2d: any,
    hl: any,
    holder_cut_local: any,
    holder_local: any,
    holders: any,
    hw: any,
    inner2d: any,
    l: any,
    lid2d: any,
    plunger: any,
    pocket: any,
    ring2d: any,
    s: any,
    slot2d: any,
    st: any,
    stem: any,
    sw: any,
    t: any,
    thin2d: any,
    tile2d: any,
    w: any,
    x_end: any,
    z0: any,
    z1: any;
  [sw, st, cr] = [d.switches, d.switches.type, d.carrier];
  fn = d.fn;
  [z0, z1] = [d.z_pcb_face, d.z_carrier_top];
  [hw, hl] = [d.half_width, d.half_length];
  [w, l, cx, cy] = d.footprint;
  [s, gap, f] = [sw.tile_slot, sw.tile_gap, sw.tile_frame];
  R = mul(3, max(hw, hl));
  lid2d = offset(
    cr.corner_r,
    undefined,
    fn,
  )(square([sub(w, mul(2, cr.corner_r)), sub(l, mul(2, cr.corner_r))], true)).translate([cx, cy]);
  inner2d = offset(undefined, -f)(lid2d);
  ring2d = circle(ring_radius(d), undefined, fn);
  bosses2d = union()(
    ...(() => {
      const result: any = [];
      for (const [x, y] of d.lid_screw_points()) {
        result.push(circle(add(cr.screw_head_dia / 2, 1.5), undefined, fn).translate([x, y]));
      }
      return result;
    })(),
  );
  [bl, bw, bh] = st.body;
  bar_w = add(add(bw, mul(2, st.holder_wall)), 0.3);
  bar_len = add(add(bl, mul(2, st.holder_wall)), 0.3);
  bar_top = sub(sub(z1, st.paddle_t), st.paddle_gap);
  body_top = sub(sub(z1, st.paddle_t), st.plunger_h);
  bar_bot = sub(body_top, bh);
  x_end = add(sub(plunger_radius(d), ring_radius(d)), 1.5);
  bar = cube([bar_w, bar_len, sub(bar_top, bar_bot)]).translate([-bar_w / 2, -bar_len / 2, bar_bot]);
  stem = cube([add(x_end, bar_w / 2), 10.0, sub(bar_top, bar_bot)]).translate([-bar_w / 2, -5.0, bar_bot]);
  body_cy = -sub(bl / 2, st.plunger_from_end);
  pocket = cube([add(bw, 0.3), add(bl, 0.3), add(sub(body_top, bar_bot), 1)]).translate([
    -add(bw, 0.3) / 2,
    sub(body_cy, add(bl, 0.3) / 2),
    sub(bar_bot, 1),
  ]);
  plunger = zcyl(add(st.plunger_dia, 0.8), sub(body_top, EPS), add(bar_top, EPS), fn);
  holder_local = add(bar, stem);
  holder_cut_local = add(pocket, plunger);
  [cutters, holders, after] = [[], [], []];
  for (t of tiles(d)) {
    core = offset(undefined, -gap / 2)(_sector(t.a0, t.a1, R));
    tile2d = sub(sub(mul(core, inner2d), ring2d), bosses2d);
    around = offset(s, undefined, max(8, Math.floor(fn / 4)))(tile2d);
    band = _band(t.side, d, st.hinge_len / 2);
    slot2d = sub(sub(around, tile2d), _band(t.side, d, sub(st.hinge_len / 2, 0.5)));
    thin2d = sub(around, _frame_region(t.side, d));
    groove2d = sub(
      mul(offset(undefined, add(s, 0.3))(add(tile2d, _mirror_about_hinge(tile2d, t.side, d))), band),
      offset(0.3, undefined, 8)(bosses2d),
    );
    cutters.push(linear_extrude(add(sub(z1, z0), 4))(slot2d).up(sub(z0, 2)));
    cutters.push(linear_extrude(sub(sub(z1, st.paddle_t), sub(z0, 1)))(thin2d).up(sub(z0, 1)));
    cutters.push(linear_extrude(sub(sub(z1, st.hinge_t), sub(z0, 1)))(groove2d).up(sub(z0, 1)));
    holders.push(holder_local.rotate([0, 0, t.inward]).translate([t.x, t.y, 0]));
    after.push(holder_cut_local.rotate([0, 0, t.inward]).translate([t.x, t.y, 0]));
  }
  return [union()(...cutters), union()(...holders), union()(...after)];
}
