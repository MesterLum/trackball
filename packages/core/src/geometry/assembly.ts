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
import { cube, sphere, union } from '../scad/index.js';
import { carrier } from './carrier.js';
import { rounded_rect, to_world, zcyl } from './common.js';
import { cup, supports_preview } from './cup.js';
import { palm_key, palmrest } from './palmrest.js';
import { battery_preview, mcu_preview, tray } from './tray.js';
export function _box(x0: any, x1: any, y0: any, y1: any, z0: any, z1: any): any {
  return cube([sub(x1, x0), sub(y1, y0), sub(z1, z0)]).translate([x0, y0, z0]);
}
export function ball_preview(d: any, alpha: any = 0.35): any {
  return sphere(d.ball.r, undefined, d.fn).color('crimson', alpha);
}
export function pcb_preview(d: any): any {
  let fl: any,
    fn: any,
    fw: any,
    fx: any,
    fy: any,
    header: any,
    holes: any,
    hx: any,
    hy: any,
    lens: any,
    parts: any,
    pcb: any,
    z: any;
  fn = d.fn;
  z = d.z_pcb_face;
  pcb = zcyl(d.pcb.diameter, sub(z, d.pcb.thickness), z, fn);
  holes = union()(
    ...(() => {
      const result: any = [];
      for (const sy of [-1, 1]) {
        result.push(
          zcyl(d.pcb.hole_dia, sub(z, 2), add(z, 1), fn).translate([0, mul(sy, d.pcb.hole_spacing) / 2, 0]),
        );
      }
      return result;
    })(),
  );
  pcb = sub(pcb, holes).color('darkgreen');
  lens = rounded_rect(d.lens.width, d.lens.length, d.lens.corner_r, d.lens.top_above_pcb, fn)
    .up(z)
    .color('black', 0.85);
  [hx, hy] = d.pcb.header_center;
  header = cube([2.54, mul(2.54, d.pcb.header_pins), d.pcb.header_height])
    .translate([
      sub(hx, 1.27),
      sub(hy, mul(2.54, d.pcb.header_pins) / 2),
      sub(sub(z, d.pcb.thickness), d.pcb.header_height),
    ])
    .color('black');
  parts = [pcb, lens, header];
  [fx, fy] = d.pcb.fpc_center;
  [fw, fl] = d.pcb.fpc_size;
  if (truth(truth(fw > 0) && truth(fl > 0))) {
    parts.push(
      cube([fw, fl, d.pcb.fpc_height])
        .translate([sub(fx, fw / 2), sub(fy, fl / 2), sub(sub(z, d.pcb.thickness), d.pcb.fpc_height)])
        .color('tan'),
    );
  }
  return union()(...parts);
}
export function switches_preview(d: any): any {
  let ang: any,
    below: any,
    bh: any,
    bl: any,
    body: any,
    body_cy: any,
    body_top: any,
    bw: any,
    cap: any,
    housing: any,
    kl: any,
    kw: any,
    local: any,
    parts: any,
    plunger: any,
    st: any,
    sw: any,
    x: any,
    x_p: any,
    y: any,
    z1: any;
  sw = d.switches;
  if (truth(!truth(sw.count))) {
    return null;
  }
  st = sw.type;
  z1 = d.z_carrier_top;
  parts = [];
  for ([x, y, ang] of d.switch_positions()) {
    if (truth(st.kind === 'key')) {
      housing = cube([sub(st.pocket, 0.2), sub(st.pocket, 0.2), add(st.above_plate, st.plate_t)])
        .translate([-sub(st.pocket, 0.2) / 2, -sub(st.pocket, 0.2) / 2, sub(z1, st.plate_t)])
        .color('dimgray');
      below = cube([sub(st.cutout, 0.2), sub(st.cutout, 0.2), st.below_plate])
        .translate([
          -sub(st.cutout, 0.2) / 2,
          -sub(st.cutout, 0.2) / 2,
          sub(sub(z1, st.plate_t), st.below_plate),
        ])
        .color('dimgray');
      [kl, kw] = [st.size_in, sw.size_across];
      cap = cube([kl, kw, st.keycap_h])
        .translate([-kl / 2, -kw / 2, add(z1, st.above_plate)])
        .color('white', 0.9);
      local = add(add(housing, below), cap);
    } else {
      x_p = truth(sw.is_tiles) ? 0.0 : sub(st.size_in / 2, st.plunger_inset);
      [bl, bw, bh] = st.body;
      body_top = sub(sub(z1, st.paddle_t), st.plunger_h);
      body_cy = -sub(bl / 2, st.plunger_from_end);
      body = _box(-bw / 2, bw / 2, -bl / 2, bl / 2, -bh, 0).color('dimgray');
      plunger = zcyl(st.plunger_dia, 0, st.plunger_h, d.fn)
        .translate([0, sub(bl / 2, st.plunger_from_end), 0])
        .color('white');
      local = add(body, plunger).translate([x_p, body_cy, body_top]);
    }
    parts.push(local.rotate([0, 0, ang]).translate([x, y, 0]));
  }
  return union()(...parts);
}
export function reference_models(d: any): any {
  let bp: any, deck_parts: any, p: any, parts: any;
  deck_parts = [ball_preview(d), pcb_preview(d)];
  for (p of [supports_preview(d), switches_preview(d)]) {
    if (truth(p !== null)) {
      deck_parts.push(p);
    }
  }
  parts = [to_world(union()(...deck_parts), d.deck), mcu_preview(d)];
  bp = battery_preview(d);
  if (truth(bp !== null)) {
    parts.push(bp);
  }
  return union()(...parts);
}
export function assembly(d: any, explode: any = 0.0): any {
  let e: any, key: any, parts: any, pr: any, top: any;
  e = explode;
  top = union()(cup(d).color('steelblue').up(mul(2, e)), carrier(d).color('goldenrod').up(e));
  parts = [to_world(top, d.deck), tray(d).color('gray'), reference_models(d).up(mul(2, e))];
  pr = palmrest(d);
  if (truth(pr !== null)) {
    parts.push(pr.color('peru'));
  }
  key = palm_key(d);
  if (truth(key !== null)) {
    parts.push(key.color('teal'));
  }
  return union()(...parts);
}
export function section(d: any, explode: any = 0.0): any {
  let cx: any,
    cy: any,
    keep: any,
    l: any,
    pts: any,
    w: any,
    x0: any,
    y0: any,
    y1: any,
    y_lo: any,
    z0: any,
    z1: any;
  [w, l, cx, cy] = d.footprint;
  y_lo = sub(sub(cy, l / 2), d.deck.palm_length);
  pts = (() => {
    const result: any = [];
    for (const sx of [-1, 1]) {
      for (const yy of [y_lo, add(cy, l / 2)]) {
        for (const z of [d.z_carrier_top, sub(d.z_floor_top, 20)]) {
          result.push(d.deck_to_world([add(cx, mul(sx, w) / 2), yy, z]));
        }
      }
    }
    return result;
  })();
  x0 = sub(
    min(
      (() => {
        const result: any = [];
        for (const p of pts) {
          result.push(index(p, 0));
        }
        return result;
      })(),
    ),
    5,
  );
  [y0, y1] = [
    sub(
      min(
        (() => {
          const result: any = [];
          for (const p of pts) {
            result.push(index(p, 1));
          }
          return result;
        })(),
      ),
      5,
    ),
    add(
      max(
        (() => {
          const result: any = [];
          for (const p of pts) {
            result.push(index(p, 1));
          }
          return result;
        })(),
      ),
      5,
    ),
  ];
  [z0, z1] = [sub(d.z_floor_bottom, 5), add(add(d.ball.r, mul(3, explode)), 10)];
  keep = cube([-x0, sub(y1, y0), sub(z1, z0)]).translate([x0, y0, z0]);
  return mul(assembly(d, explode), keep);
}
export function cup_placement(d: any): any {
  let parts: any, sp: any;
  parts = [cup(d).color('steelblue'), ball_preview(d, 0.25)];
  sp = supports_preview(d);
  if (truth(sp !== null)) {
    parts.push(sp);
  }
  return union()(...parts);
}
export function carrier_placement(d: any): any {
  let parts: any, sp: any;
  parts = [carrier(d).color('goldenrod'), pcb_preview(d)];
  sp = switches_preview(d);
  if (truth(sp !== null)) {
    parts.push(sp);
  }
  return union()(...parts);
}
export function tray_placement(d: any): any {
  let bp: any, parts: any;
  parts = [tray(d).color('gray'), mcu_preview(d)];
  bp = battery_preview(d);
  if (truth(bp !== null)) {
    parts.push(bp);
  }
  return union()(...parts);
}
