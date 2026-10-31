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
  sum,
  any,
  all,
  round,
  minBy,
  maxBy,
  enumerate,
  format,
  formatValue,
  math,
} from '../math.js';
import { _ } from '../i18n.js';
import {
  circle,
  cube,
  cylinder,
  hull,
  intersection,
  linear_extrude,
  offset,
  polygon,
  rotate_extrude,
  sphere,
  square,
  union,
} from '../scad/index.js';
import {
  EPS,
  place_on_ball,
  polar,
  rounded_rect,
  rounded_slab,
  support_frames,
  support_lowest_z,
  zcyl,
} from './common.js';
export function lens_window_size(d: any): any {
  let c: any;
  c = d.lens.clearance;
  return [add(d.lens.width, mul(2, c)), add(d.lens.length, mul(2, c))];
}
export function cup(d: any): any {
  let R: any,
    ang: any,
    axis: any,
    az: any,
    base: any,
    big: any,
    blk: any,
    body: any,
    c: any,
    cavity: any,
    cutters: any,
    dome_r: any,
    ext: any,
    fn: any,
    h: any,
    inserts: any,
    low: any,
    opening: any,
    pol: any,
    prof: any,
    result: any,
    rr: any,
    scoops: any,
    side: any,
    sup: any,
    top: any,
    trough: any,
    w: any,
    window: any,
    wl: any,
    ww: any,
    x: any,
    y: any,
    z_bot: any,
    z_rim: any,
    z_sk: any,
    zf: any;
  fn = d.fn;
  c = d.cup;
  R = d.ball.r;
  z_bot = d.z_cup_bottom;
  z_rim = -c.rim_below_center;
  dome_r = add(d.cavity_r, c.wall);
  base = zcyl(d.skirt_dia, z_bot, add(add(z_bot, c.insert_depth), 1.5), fn);
  rr = truth(c.round > 0) ? min(c.round, sub(c.wall, 0.5)) : 0.0;
  if (truth(c.shape === 'cone')) {
    if (truth(rr > 0)) {
      z_sk = add(add(z_bot, c.insert_depth), 1.5);
      ext = mul(3, rr);
      prof = polygon([
        [-ext, sub(z_bot, ext)],
        [d.skirt_dia / 2, sub(z_bot, ext)],
        [d.skirt_dia / 2, z_sk],
        [dome_r, z_rim],
        [-ext, z_rim],
      ]);
      prof = offset(rr, undefined, Math.floor(fn / 2))(offset(-rr, undefined, Math.floor(fn / 2))(prof));
      prof = intersection()(
        prof,
        square([add(dome_r, ext), add(sub(z_rim, z_bot), 1)]).translate([0, z_bot]),
      );
      body = rotate_extrude(fn)(prof);
    } else {
      top = zcyl(mul(2, dome_r), -c.base_top_below_center, add(z_rim, 1.0), fn);
      body = hull()(base, top);
    }
  } else {
    if (truth(c.shape === 'dome')) {
      big = mul(4, dome_r);
      prof = intersection()(
        circle(dome_r, undefined, fn),
        square([big, big]).translate([0, sub(z_rim, big)]),
      );
      if (truth(rr > 0)) {
        prof = offset(rr, undefined, Math.floor(fn / 2))(offset(-rr, undefined, Math.floor(fn / 2))(prof));
      }
      body = hull()(base, rotate_extrude(fn)(prof));
    } else {
      side = mul(2, dome_r);
      blk = rounded_slab(side, side, 7.0, sub(z_rim, z_bot), rr, fn).up(z_bot);
      body = hull()(base, blk);
    }
  }
  cavity = sphere(d.cavity_r, undefined, fn);
  big = mul(2, d.skirt_dia);
  opening = cube([big, big, add(R, 20)]).translate([-big / 2, -big / 2, z_rim]);
  scoops = [];
  zf = c.scoop_floor();
  for (axis of c.scoop_axes) {
    if (truth(c.peak === 'sharp')) {
      w = c.rim_half_width(R);
      h = mul(4, R);
      prof = polygon([
        [0, zf],
        [mul(w, h) / c.cut, add(zf, h)],
        [mul(-w, h) / c.cut, add(zf, h)],
      ]);
      trough = linear_extrude(big)(prof)
        .translate([0, 0, -big / 2])
        .rotate([90, 0, 0]);
    } else {
      trough = cylinder(big, c.saddle_r, undefined, undefined, undefined, undefined, fn)
        .translate([0, 0, -big / 2])
        .rotate([90, 0, 0]);
      trough = trough.translate([0, 0, add(zf, c.saddle_r)]);
    }
    scoops.push(truth(axis === 'y') ? trough : trough.rotate([0, 0, 90]));
  }
  [ww, wl] = lens_window_size(d);
  window = rounded_rect(
    ww,
    wl,
    add(d.lens.corner_r, d.lens.clearance),
    sub(-c.base_top_below_center, sub(z_bot, 1)),
    fn,
  ).up(sub(z_bot, 1));
  sup = c.support;
  sup.prepare(R, c.support_polar_deg, d.skirt_dia / 2);
  cutters = [];
  for ([az, pol] of support_frames(c.support_count, c.support_polar_deg, c.azimuth0)) {
    cutters.push(place_on_ball(sup.cutter(fn), R, sup.contact_height, az, pol));
  }
  low = support_lowest_z(R, sup.contact_height, c.support_polar_deg, sup.body_reach(), sup.body_radius());
  if (truth(low < add(z_bot, 0.8))) {
    undefined;
  }
  inserts = [];
  for (ang of c.carrier_screw_angles) {
    [x, y] = polar(c.screw_radius(R), ang);
    inserts.push(zcyl(c.insert_dia, sub(z_bot, EPS), add(z_bot, c.insert_depth), fn).translate([x, y, 0]));
  }
  result = sub(sub(sub(sub(sub(body, cavity), opening), window), union()(...cutters)), union()(...inserts));
  if (truth(scoops)) {
    result = sub(result, union()(...scoops));
  }
  return result;
}
export function supports_preview(d: any): any {
  let az: any, c: any, p: any, parts: any, pol: any;
  c = d.cup;
  c.support.prepare(d.ball.r, c.support_polar_deg, d.skirt_dia / 2);
  parts = [];
  for ([az, pol] of support_frames(c.support_count, c.support_polar_deg, c.azimuth0)) {
    p = c.support.preview(d.fn);
    if (truth(p !== null)) {
      parts.push(place_on_ball(p, d.ball.r, c.support.contact_height, az, pol));
    }
  }
  return truth(parts) ? union()(...parts) : null;
}
