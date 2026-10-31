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
import { cube, cylinder, hull, linear_extrude, offset, sphere, square } from '../scad/index.js';
export const EPS = 0.01;
export function rounded_rect(w: any, l: any, r: any, h: any, fn: any, center_z: any = false): any {
  let prism: any;
  r = min(r, sub(w / 2, EPS), sub(l / 2, EPS));
  prism = linear_extrude(h)(offset(r, undefined, fn)(square([sub(w, mul(2, r)), sub(l, mul(2, r))], true)));
  return truth(center_z) ? prism.down(h / 2) : prism;
}
export function rounded_slab(w: any, l: any, corner_r: any, h: any, edge_r: any, fn: any): any {
  let a: any, cx: any, cy: any, e: any, k: any, parts: any, r: any, sx: any, sy: any;
  if (truth(edge_r <= 0)) {
    return rounded_rect(w, l, corner_r, h, fn);
  }
  r = max(corner_r, add(edge_r, 0.5));
  r = min(r, sub(w / 2, EPS), sub(l / 2, EPS));
  e = min(edge_r, sub(h, EPS), sub(r, EPS));
  parts = [];
  for (sx of [-1, 1]) {
    for (sy of [-1, 1]) {
      [cx, cy] = [mul(sx, sub(w / 2, r)), mul(sy, sub(l / 2, r))];
      parts.push(
        cylinder(sub(h, e), r, undefined, undefined, undefined, undefined, fn).translate([cx, cy, 0]),
      );
      parts.push(
        cylinder(EPS, sub(r, e), undefined, undefined, undefined, undefined, fn).translate([
          cx,
          cy,
          sub(h, EPS),
        ]),
      );
      for (k of range(0, 360, 30)) {
        a = math.radians(k);
        parts.push(
          sphere(e, undefined, max(12, Math.floor(fn / 4))).translate([
            add(cx, mul(sub(r, e), math.cos(a))),
            add(cy, mul(sub(r, e), math.sin(a))),
            sub(h, e),
          ]),
        );
      }
    }
  }
  return hull()(...parts);
}
export function zcyl(d: any, z0: any, z1: any, fn: any): any {
  return cylinder(sub(z1, z0), undefined, d, undefined, undefined, undefined, fn).up(z0);
}
export function polar(radius: any, angle_deg: any): any {
  let a: any;
  a = math.radians(angle_deg);
  return [mul(radius, math.cos(a)), mul(radius, math.sin(a))];
}
export function support_frames(count: any, polar_deg: any, azimuth0_deg: any): any {
  return (() => {
    const result: any = [];
    for (const i of range(count)) {
      result.push([mod(add(azimuth0_deg, mul(360.0, i) / count), 360.0), polar_deg]);
    }
    return result;
  })();
}
export function place_on_ball(
  obj: any,
  ball_r: any,
  seat_offset: any,
  azimuth_deg: any,
  polar_deg: any,
): any {
  let dist: any, ph: any, seat: any, th: any;
  dist = add(ball_r, seat_offset);
  th = math.radians(polar_deg);
  ph = math.radians(azimuth_deg);
  seat = [
    mul(mul(dist, math.sin(th)), math.cos(ph)),
    mul(mul(dist, math.sin(th)), math.sin(ph)),
    mul(-dist, math.cos(th)),
  ];
  return obj.rotate([0, -polar_deg, 0]).rotate([0, 0, azimuth_deg]).translate(seat);
}
export function to_world(obj: any, deck: any): any {
  return obj.rotate([deck.tilt_deg, 0, 0]).rotate([0, deck.tent_deg, 0]);
}
export function half_space_above(
  z: any,
  size: any = [600.0, 600.0],
  center: any = [0.0, 0.0],
  height: any = 600.0,
): any {
  let sx: any, sy: any;
  [sx, sy] = size;
  return cube([sx, sy, height]).translate([sub(index(center, 0), sx / 2), sub(index(center, 1), sy / 2), z]);
}
export function support_lowest_z(
  ball_r: any,
  seat_offset: any,
  polar_deg: any,
  reach: any,
  radius: any,
): any {
  let axis_end: any, th: any;
  th = math.radians(polar_deg);
  axis_end = add(add(ball_r, seat_offset), reach);
  return sub(mul(-axis_end, math.cos(th)), mul(radius, math.sin(th)));
}
