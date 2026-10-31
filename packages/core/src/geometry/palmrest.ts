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
import { cube, linear_extrude, multmatrix, offset, square, union } from '../scad/index.js';
import { EPS, half_space_above, rounded_rect, rounded_slab, to_world, zcyl } from './common.js';
export function _palm_body(d: any): any {
  let L: any,
    block: any,
    body: any,
    cy: any,
    dk: any,
    feet: any,
    fn: any,
    keep: any,
    pad: any,
    rear: any,
    sag: any,
    tall: any,
    w: any,
    y0: any,
    y1: any,
    z_top: any,
    zf_bot: any;
  dk = d.deck;
  if (truth(dk.palm_length <= 0)) {
    return null;
  }
  fn = d.fn;
  w = mul(2, d.half_width);
  [y0, y1] = d.palm_y_range;
  cy = add(y0, y1) / 2;
  L = sub(y1, y0);
  z_top = sub(d.z_carrier_top, dk.palm_drop);
  zf_bot = d.z_floor_bottom;
  sag = mul(
    add(add(w, L), mul(2, d.half_length)),
    add(math.sin(math.radians(abs(dk.tilt_deg))), math.sin(math.radians(abs(dk.tent_deg)))),
  );
  tall = add(add(sub(z_top, zf_bot), sag), 10.0);
  rear = truth(dk.palm_attachment === 'fused') ? mul(2, add(add(d.carrier.corner_r, dk.palm_round), 1)) : 0;
  block = rounded_slab(w, add(L, rear), d.carrier.corner_r, tall, dk.palm_round, fn)
    .up(sub(z_top, tall))
    .translate([0, add(cy, rear / 2), 0]);
  if (truth(rear)) {
    block = mul(
      block,
      cube([add(w, 2), add(add(L, 1), EPS), add(tall, 2)]).translate([
        sub(-w / 2, 1),
        sub(y0, 1),
        sub(sub(z_top, tall), 1),
      ]),
    );
  }
  if (truth(dk.palm_pad_recess > 0)) {
    pad = rounded_rect(
      sub(w, mul(2, dk.palm_pad_inset)),
      sub(L, mul(2, dk.palm_pad_inset)),
      4.0,
      add(dk.palm_pad_recess, 1),
      fn,
    )
      .up(sub(z_top, dk.palm_pad_recess))
      .translate([0, cy, 0]);
    block = sub(block, pad);
  }
  keep = half_space_above(
    zf_bot,
    [add(add(w, mul(2, sag)), 20), add(add(L, mul(2, sag)), 20)],
    [0, cy],
    tall,
  );
  body = mul(to_world(block, dk), keep);
  feet = (() => {
    const result: any = [];
    for (const [fx, fy] of d.palm_feet_xy()) {
      result.push(
        zcyl(d.tray.feet_dia, sub(zf_bot, 1), add(zf_bot, d.tray.feet_depth), fn).translate([fx, fy, 0]),
      );
    }
    return result;
  })();
  return truth(feet) ? sub(body, union()(...feet)) : body;
}
export const TONGUE_W = 8.0;
export const TONGUE_H = 1.5;
export const JOINT_CLEAR = 0.25;
export const KEY_H = 1.2;
export const KEY_POCKET_H = 1.6;
export function _floor_shape(d: any, shape: any, height: any, lift: any = 0.0): any {
  let matrix: any, ox: any, oy: any, xx: any, xy: any, yx: any, yy: any;
  [ox, oy] = d.floor_xy(0, 0);
  [xx, xy] = d.floor_xy(1, 0);
  [yx, yy] = d.floor_xy(0, 1);
  matrix = [
    [sub(xx, ox), sub(yx, ox), 0, ox],
    [sub(xy, oy), sub(yy, oy), 0, oy],
    [0, 0, 1, add(d.z_floor_bottom, lift)],
    [0, 0, 0, 1],
  ];
  return multmatrix(matrix)(linear_extrude(height)(shape));
}
export function _joint_centres(d: any): any {
  return [mul(-0.45, d.half_width), mul(0.45, d.half_width)];
}
export function _tongues(d: any, clearance: any = 0.0): any {
  let seam: any;
  seam = -d.front_length;
  return union()(
    ...(() => {
      const result: any = [];
      for (const x of _joint_centres(d)) {
        result.push(
          _floor_shape(
            d,
            square([add(TONGUE_W, mul(2, clearance)), add(9.5, mul(2, clearance))], true).translate([
              x,
              add(seam, 0.25),
            ]),
            add(add(TONGUE_H, clearance), 0.01),
            -0.01,
          ),
        );
      }
      return result;
    })(),
  );
}
export function _key_outline(d: any): any {
  let ends: any, neck: any, seam: any;
  seam = -d.front_length;
  neck = square([6, 16], true).translate([0, seam]);
  ends = (() => {
    const result: any = [];
    for (const sign of [-1, 1]) {
      result.push(square([12, 6], true).translate([0, add(seam, mul(sign, 8))]));
    }
    return result;
  })();
  return union()(neck, ...ends);
}
export function palm_key_socket(d: any): any {
  let chamber: any, mouth: any, outline: any;
  outline = _key_outline(d);
  mouth = _floor_shape(d, offset(0.2)(outline), add(KEY_POCKET_H, 0.01), -0.01);
  chamber = _floor_shape(d, offset(0.5)(outline), sub(KEY_POCKET_H, 0.8), 0.8);
  return add(mouth, chamber);
}
export function palm_key(d: any): any {
  let body: any, nubs: any, reliefs: any, seam: any, sx: any, sy: any;
  if (truth(truth(d.deck.palm_length <= 0) || truth(d.deck.palm_attachment !== 'anchored'))) {
    return null;
  }
  seam = -d.front_length;
  body = _floor_shape(d, _key_outline(d), KEY_H);
  [reliefs, nubs] = [[], []];
  for (sy of [-1, 1]) {
    for (sx of [-1, 1]) {
      reliefs.push(
        _floor_shape(
          d,
          square([0.7, 4.8], true).translate([mul(sx, 4.6), add(seam, mul(sy, 8.7))]),
          add(KEY_H, 0.1),
          -0.05,
        ),
      );
      nubs.push(
        _floor_shape(
          d,
          square([0.5, 1.4], true).translate([mul(sx, 6.1), add(seam, mul(sy, 9.8))]),
          0.4,
          0.8,
        ),
      );
    }
  }
  return sub(add(body, union()(...nubs)), union()(...reliefs));
}
export function palmrest(d: any): any {
  let body: any;
  if (truth(truth(d.deck.palm_length <= 0) || truth(d.deck.palm_attachment === 'fused'))) {
    return null;
  }
  body = _palm_body(d);
  if (truth(d.deck.palm_attachment === 'anchored')) {
    body = sub(add(body, _tongues(d)), palm_key_socket(d));
  }
  return body;
}
export function tray_palm_joint(d: any): any {
  if (truth(truth(d.deck.palm_length <= 0) || truth(d.deck.palm_attachment === 'separate'))) {
    return [null, null];
  }
  if (truth(d.deck.palm_attachment === 'anchored')) {
    return [null, add(_tongues(d, JOINT_CLEAR), palm_key_socket(d))];
  }
  return [_palm_body(d), null];
}
export function palm_joint_sample(d: any): any {
  let palm_block: any, seam: any, sockets: any, tray_block: any, width: any;
  if (truth(truth(d.deck.palm_attachment !== 'anchored') || truth(d.deck.palm_length <= 0))) {
    return null;
  }
  seam = -d.front_length;
  width = mul(
    2,
    add(
      add(
        max(
          (() => {
            const result: any = [];
            for (const x of _joint_centres(d)) {
              result.push(abs(x));
            }
            return result;
          })(),
        ),
        TONGUE_W / 2,
      ),
      3,
    ),
  );
  tray_block = _floor_shape(d, square([width, 14], true).translate([0, add(seam, 7)]), d.tray.floor);
  palm_block = _floor_shape(d, square([width, 14], true).translate([0, sub(seam, 7.5)]), d.tray.floor);
  sockets = add(_tongues(d, JOINT_CLEAR), palm_key_socket(d));
  tray_block = sub(tray_block, sockets);
  palm_block = sub(add(palm_block, _tongues(d)), palm_key_socket(d));
  return add(add(tray_block, palm_block.translate([0, -15, 0])), palm_key(d).translate([width, 0, 0]));
}
