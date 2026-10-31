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
import { circle, cube, hull, linear_extrude, polygon, union } from '../scad/index.js';
import { EPS, half_space_above, rounded_rect, to_world, zcyl } from './common.js';
import { tray_palm_joint } from './palmrest.js';
export function lid_screw_points(d: any): any {
  return d.lid_screw_points();
}
export function mcu_pose(d: any): any {
  let x: any, y: any;
  [x, y] = d.mcu_center();
  return [x, y, add(d.z_floor_top, d.mcu_standoff_h)];
}
export function mcu_point(d: any, along: any, across: any): any {
  let _: any, x: any, y: any;
  [x, y, _] = mcu_pose(d);
  if (truth(d.tray.usb_exit === 'back')) {
    return [sub(x, across), add(y, along)];
  }
  return [add(x, mul(d.tray.usb_side, along)), add(y, mul(d.tray.usb_side, across))];
}
export function bootsel_deck_xy(d: any): any {
  let _: any, bx: any, by: any, mcu: any, xd: any, yd: any, zb: any;
  mcu = d.tray.mcu;
  if (truth(mcu.bootsel === null)) {
    return null;
  }
  [bx, by] = mcu_point(d, mcu.bootsel[0], mcu.bootsel[1]);
  [_, _, zb] = mcu_pose(d);
  [xd, yd, _] = d.world_to_deck([bx, by, add(zb, mcu.thickness)]);
  return [xd, yd];
}
export function _box(x0: any, x1: any, y0: any, y1: any, z0: any, z1: any): any {
  return cube([sub(x1, x0), sub(y1, y0), sub(z1, z0)]).translate([x0, y0, z0]);
}
export function tray(d: any): any {
  let across: any,
    adds: any,
    along: any,
    b: any,
    body: any,
    box: any,
    bx: any,
    by: any,
    cuts: any,
    cx: any,
    cy: any,
    extra: any,
    fh: any,
    fn: any,
    frame: any,
    frame_h: any,
    fx: any,
    fy: any,
    hs_bot: any,
    hs_top: any,
    hx: any,
    hy: any,
    il: any,
    inner: any,
    iw: any,
    l: any,
    local: any,
    mcu: any,
    mx: any,
    my: any,
    outer: any,
    outline: any,
    pl: any,
    pocket: any,
    post_holes: any,
    posts: any,
    posts_w: any,
    pw: any,
    result: any,
    rot: any,
    sag: any,
    sh: any,
    slots: any,
    sw_h: any,
    sw_w: any,
    sy: any,
    t: any,
    tall: any,
    usb_end: any,
    w: any,
    wires: any,
    x: any,
    x_far: any,
    x_in: any,
    y: any,
    z0: any,
    zb: any,
    zf_bot: any,
    zf_top: any;
  fn = d.fn;
  t = d.tray;
  mcu = t.mcu;
  [w, l, cx, cy] = d.footprint;
  z0 = d.z_pcb_face;
  [zf_top, zf_bot] = [d.z_floor_top, d.z_floor_bottom];
  sag = mul(
    add(w, l),
    add(math.sin(math.radians(abs(d.deck.tilt_deg))), math.sin(math.radians(abs(d.deck.tent_deg)))),
  );
  tall = add(add(sub(z0, zf_bot), sag), 10.0);
  box = [add(add(w, mul(2, sag)), 20.0), add(add(l, mul(2, sag)), 20.0)];
  hs_bot = half_space_above(zf_bot, box, [cx, cy], tall);
  hs_top = half_space_above(zf_top, box, [cx, cy], tall);
  outline = rounded_rect(w, l, d.carrier.corner_r, tall, fn).up(sub(z0, tall)).translate([cx, cy, 0]);
  if (truth(truth(d.deck.palm_length > 0) && truth(d.deck.palm_attachment === 'fused'))) {
    outline = add(
      outline,
      cube([w, add(d.carrier.corner_r, EPS), tall]).translate([-w / 2, -d.front_length, sub(z0, tall)]),
    );
  }
  outer = to_world(outline, d.deck);
  inner = to_world(
    rounded_rect(
      sub(w, mul(2, t.wall)),
      sub(l, mul(2, t.wall)),
      max(sub(d.carrier.corner_r, t.wall), 1),
      add(tall, 1),
      fn,
    )
      .up(sub(z0, tall))
      .translate([cx, cy, 0]),
    d.deck,
  );
  body = sub(mul(outer, hs_bot), mul(inner, hs_top));
  [posts, post_holes] = [[], []];
  for ([x, y] of lid_screw_points(d)) {
    posts.push(to_world(zcyl(t.post_dia, sub(z0, tall), z0, fn).translate([x, y, 0]), d.deck));
    post_holes.push(
      to_world(
        zcyl(t.post_insert_dia, sub(z0, t.post_insert_depth), add(z0, 1), fn).translate([x, y, 0]),
        d.deck,
      ),
    );
  }
  posts_w = mul(union()(...posts), half_space_above(sub(zf_top, EPS), box, [cx, cy], tall));
  [adds, cuts] = [[posts_w], [union()(...post_holes)]];
  [mx, my, zb] = mcu_pose(d);
  if (truth(mcu.holes)) {
    for ([along, across] of mcu.holes) {
      [hx, hy] = mcu_point(d, along, across);
      adds.push(zcyl(t.standoff_dia, sub(zf_top, EPS), zb, fn).translate([hx, hy, 0]));
      cuts.push(zcyl(t.standoff_screw_dia, sub(zf_top, EPS), add(zb, 1), fn).translate([hx, hy, 0]));
    }
  } else {
    pl = add(mcu.length, mul(2, t.pocket_clear));
    pw = add(mcu.width, mul(2, t.pocket_clear));
    sh = d.mcu_standoff_h;
    frame_h = add(add(sh, mcu.thickness), 1.0);
    frame = _box(
      -add(pl, 3) / 2,
      mcu.length / 2,
      -add(pw, 3) / 2,
      add(pw, 3) / 2,
      sub(zf_top, EPS),
      add(zf_top, frame_h),
    );
    pocket = _box(-pl / 2, pl / 2, -pw / 2, pw / 2, add(zf_top, sh), add(add(zf_top, frame_h), 1));
    usb_end = _box(
      sub(pl / 2, 1),
      add(pl / 2, 5),
      -pw / 2,
      pw / 2,
      add(zf_top, sh),
      add(add(zf_top, frame_h), 1),
    );
    local = sub(sub(frame, pocket), usb_end);
    rot = truth(t.usb_exit === 'back') ? 90.0 : truth(t.usb_side > 0) ? 0.0 : 180.0;
    adds.push(local.rotate([0, 0, rot]).translate([mx, my, 0]));
  }
  cuts.push(usb_cutout(d));
  if (truth(d.battery.enabled)) {
    b = d.battery;
    [bx, by] = d.battery_center();
    [il, iw] = [add(b.length, mul(2, b.clearance)), add(b.width, mul(2, b.clearance))];
    fh = add(b.thickness, b.frame_extra_h);
    frame = _box(
      sub(-il / 2, b.frame_wall),
      add(il / 2, b.frame_wall),
      sub(-iw / 2, b.frame_wall),
      add(iw / 2, b.frame_wall),
      sub(zf_top, EPS),
      add(zf_top, fh),
    );
    pocket = _box(-il / 2, il / 2, -iw / 2, iw / 2, zf_top, add(add(zf_top, fh), 1));
    wires = _box(
      -4,
      4,
      sub(iw / 2, 1),
      add(add(iw / 2, b.frame_wall), 1),
      add(zf_top, 1),
      add(add(zf_top, fh), 1),
    );
    adds.push(sub(sub(frame, pocket), wires).translate([bx, by, 0]));
    if (truth(b.power_switch)) {
      [sw_w, sw_h] = b.power_switch_slot;
      sy = -add(add(d.pcb.r, 6), sw_w / 2);
      [x_in, x_far] = [sub(sub(d.half_width, t.wall), 2), add(d.half_width, mul(4, t.wall))];
      cuts.push(
        _box(x_in, x_far, sub(sy, sw_w / 2), add(sy, sw_w / 2), add(zf_top, 3), add(add(zf_top, 3), sw_h)),
      );
    }
  }
  for ([fx, fy] of d.feet_xy()) {
    cuts.push(zcyl(t.feet_dia, sub(zf_bot, 1), add(zf_bot, t.feet_depth), fn).translate([fx, fy, 0]));
  }
  result = sub(add(body, union()(...adds)), union()(...cuts));
  [extra, slots] = tray_palm_joint(d);
  if (truth(extra !== null)) {
    result = add(result, extra);
  }
  if (truth(slots !== null)) {
    result = sub(result, slots);
  }
  return result;
}
export function usb_profile(d: any, width: any, height: any): any {
  let r: any, shoulder: any;
  if (truth(d.usb_kind === 'usb-c')) {
    r = height / 2;
    return hull()(
      ...(() => {
        const result: any = [];
        for (const side of [-1, 1]) {
          result.push(circle(r, undefined, d.fn).translate([mul(side, sub(width, height)) / 2, 0]));
        }
        return result;
      })(),
    );
  }
  shoulder = min(1.0, height / 3);
  return polygon([
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, sub(height / 2, shoulder)],
    [sub(width / 2, shoulder), height / 2],
    [add(-width / 2, shoulder), height / 2],
    [-width / 2, sub(height / 2, shoulder)],
  ]);
}
export function usb_cutout(d: any): any {
  let m: any,
    mx: any,
    my: any,
    neck: any,
    nose: any,
    reach: any,
    recess: any,
    rot: any,
    t: any,
    z: any,
    zb: any;
  [m, t] = [d.tray.mcu, d.tray];
  [mx, my, zb] = mcu_pose(d);
  nose = add(m.length / 2, m.usb_overhang);
  z = add(add(add(zb, m.thickness), d.usb_z_offset), d.usb_height / 2);
  reach = add(add(max(index(d.footprint, [null, 2, null])), abs(d.z_floor_bottom)), 20);
  function tunnel(width: any, height: any, a0: any, a1: any): any {
    return linear_extrude(sub(a1, a0))(usb_profile(d, width, height))
      .rotate([90, 0, 90])
      .translate([a0, 0, z]);
  }
  neck = tunnel(
    add(d.usb_width, mul(2, t.usb_clear)),
    add(d.usb_height, mul(2, t.usb_clear)),
    sub(m.length / 2, 6),
    reach,
  );
  recess = tunnel(max(add(d.usb_width, 3), 12), max(add(d.usb_height, 3), 7), add(nose, t.usb_clear), reach);
  rot = truth(t.usb_exit === 'back') ? 90 : truth(t.usb_side > 0) ? 0 : 180;
  return add(neck, recess).rotate([0, 0, rot]).translate([mx, my, 0]);
}
export function mcu_preview(d: any): any {
  let board: any, mcu: any, mx: any, my: any, rot: any, t: any, usb: any, zb: any;
  t = d.tray;
  mcu = t.mcu;
  [mx, my, zb] = mcu_pose(d);
  board = _box(-mcu.length / 2, mcu.length / 2, -mcu.width / 2, mcu.width / 2, 0, mcu.thickness).color(
    'green',
  );
  usb = linear_extrude(add(6, mcu.usb_overhang))(usb_profile(d, d.usb_width, d.usb_height))
    .rotate([90, 0, 90])
    .translate([sub(mcu.length / 2, 6), 0, add(add(mcu.thickness, d.usb_z_offset), d.usb_height / 2)])
    .color('silver');
  rot = truth(t.usb_exit === 'back') ? 90.0 : truth(t.usb_side > 0) ? 0.0 : 180.0;
  return add(board, usb).rotate([0, 0, rot]).translate([mx, my, zb]);
}
export function battery_preview(d: any): any {
  let b: any, bx: any, by: any, cell: any;
  if (truth(!truth(d.battery.enabled))) {
    return null;
  }
  b = d.battery;
  [bx, by] = d.battery_center();
  cell = _box(-b.length / 2, b.length / 2, -b.width / 2, b.width / 2, 0, b.thickness).color('slateblue');
  return cell.translate([bx, by, d.z_floor_top]);
}
