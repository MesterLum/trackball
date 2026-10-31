// Parametric model algorithms ported from checkpoint 1ed1441. All execution is TypeScript.
import { add, sub, mul, max, format, math } from '../math.js';
import { _ } from '../i18n.js';
import { color, cube, cylinder, sphere } from '../scad/index.js';
export const BIG = 60.0;
export class BallSupport {
  [key: string]: any;
  constructor(_values: Record<string, any> = {}) {}
  prepare(_ball_r: any, _polar_deg: any, _r_out: any): any {}
  cutter(_fn: any): any {
    throw new Error('Unsupported support operation');
  }
  body_reach(): any {
    throw new Error('Unsupported support operation');
  }
  body_radius(): any {
    throw new Error('Unsupported support operation');
  }
  preview(_fn: any): any {
    return null;
  }
  describe(): any {
    return this.constructor.name;
  }
}
export class PressFitBTU extends BallSupport {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    super();
    this.shaft_dia = values.shaft_dia ?? 7.5;
    this.shaft_len = values.shaft_len ?? 5.0;
    this.flange_dia = values.flange_dia ?? 9.0;
    this.flange_h = values.flange_h ?? 1.1;
    this.ball_top_above_flange = values.ball_top_above_flange ?? 1.6;
    this.press_fit_oversize = values.press_fit_oversize ?? 0.1;
    this.flange_clear = values.flange_clear ?? 0.4;
    this.kind = values.kind ?? 'btu';
  }
  get contact_height(): any {
    return this.ball_top_above_flange;
  }
  body_reach(): any {
    return this.shaft_len;
  }
  body_radius(): any {
    return add(this.shaft_dia, this.press_fit_oversize) / 2;
  }
  cutter(fn: any): any {
    let hole: any, pocket: any;
    hole = cylinder(
      add(this.shaft_len, 0.01),
      undefined,
      add(this.shaft_dia, this.press_fit_oversize),
      undefined,
      undefined,
      undefined,
      fn,
    ).down(this.shaft_len);
    pocket = cylinder(
      add(this.contact_height, 2.0),
      undefined,
      add(this.flange_dia, this.flange_clear),
      undefined,
      undefined,
      undefined,
      fn,
    );
    return add(hole, pocket);
  }
  preview(fn: any): any {
    let ball: any, ball_d: any, flange: any, shaft: any;
    shaft = cylinder(this.shaft_len, undefined, this.shaft_dia, undefined, undefined, undefined, fn).down(
      this.shaft_len,
    );
    flange = cylinder(this.flange_h, undefined, this.flange_dia, undefined, undefined, undefined, fn);
    ball_d = add(mul(2, sub(this.ball_top_above_flange, this.flange_h)), 1.0);
    ball = sphere(undefined, ball_d, fn).up(sub(this.ball_top_above_flange, ball_d / 2));
    return color('silver')(add(add(shaft, flange), ball));
  }
  describe(): any {
    return format(_('BTU Ø{d} press-fit'), { d: this.shaft_dia });
  }
}
export class StaticBearing extends BallSupport {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    super();
    this.ball_dia = values.ball_dia ?? 3.0;
    this.socket_oversize = values.socket_oversize ?? 0.1;
    this.opening_undersize = values.opening_undersize ?? 0.3;
    this.kind = values.kind ?? 'ceramic';
  }
  get contact_height(): any {
    return this.ball_dia / 2;
  }
  body_reach(): any {
    return add(this.ball_dia / 2, this.socket_oversize);
  }
  body_radius(): any {
    return add(this.ball_dia / 2, this.socket_oversize);
  }
  cutter(fn: any): any {
    let opening: any, socket: any;
    socket = sphere(undefined, add(this.ball_dia, this.socket_oversize), fn);
    opening = cylinder(
      this.ball_dia,
      undefined,
      sub(this.ball_dia, this.opening_undersize),
      undefined,
      undefined,
      undefined,
      fn,
    );
    return add(socket, opening);
  }
  preview(fn: any): any {
    return color('white')(sphere(undefined, this.ball_dia, fn));
  }
  describe(): any {
    return format(_('static ceramic Ø{d}'), {
      d: Number.isInteger(this.ball_dia) ? this.ball_dia.toFixed(1) : this.ball_dia,
    });
  }
}
export class RollerBearing extends BallSupport {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    super();
    this.od = values.od ?? 6.0;
    this.width = values.width ?? 2.5;
    this.bore = values.bore ?? 3.0;
    this.slot_clear = values.slot_clear ?? 0.3;
    this.radial_clear = values.radial_clear ?? 0.6;
    this.screw_clear_dia = values.screw_clear_dia ?? 3.3;
    this.screw_tap_dia = values.screw_tap_dia ?? 2.6;
    this.screw_tap_len = values.screw_tap_len ?? 6.0;
    this.head_dia = values.head_dia ?? 6.0;
    this._exit = values._exit ?? 20.0;
    this.kind = values.kind ?? 'bearing';
  }
  get contact_height(): any {
    return this.od / 2;
  }
  prepare(ball_r: any, polar_deg: any, r_out: any): any {
    let r_seat: any;
    r_seat = mul(add(ball_r, this.contact_height), math.sin(math.radians(polar_deg)));
    this._exit = math.sqrt(max(sub(mul(r_out, r_out), mul(r_seat, r_seat)), 1.0));
  }
  body_reach(): any {
    return add(this.od / 2, 1.0);
  }
  body_radius(): any {
    return add(this.od / 2, this.radial_clear);
  }
  cutter(fn: any): any {
    let clear: any, head: any, r: any, slot: any, tap: any, w: any;
    w = add(this.width, mul(2, this.slot_clear));
    r = add(this.od / 2, this.radial_clear);
    slot = cube([mul(2, r), w, add(r, this.od)]).translate([-r, -w / 2, -r]);
    clear = cylinder(
      add(this._exit, 5),
      undefined,
      this.screw_clear_dia,
      undefined,
      undefined,
      undefined,
      fn,
    ).rotate([-90, 0, 0]);
    tap = cylinder(
      add(this.screw_tap_len, w / 2),
      undefined,
      this.screw_tap_dia,
      undefined,
      undefined,
      undefined,
      fn,
    ).rotate([90, 0, 0]);
    head = cylinder(10, undefined, this.head_dia, undefined, undefined, undefined, fn)
      .rotate([-90, 0, 0])
      .translate([0, this._exit, 0]);
    return add(add(add(slot, clear), tap), head);
  }
  preview(fn: any): any {
    let ring: any, screw: any;
    ring = cylinder(this.width, undefined, this.od, undefined, undefined, undefined, fn)
      .translate([0, 0, -this.width / 2])
      .rotate([-90, 0, 0]);
    screw = cylinder(
      add(this._exit, this.screw_tap_len),
      undefined,
      this.bore,
      undefined,
      undefined,
      undefined,
      fn,
    )
      .rotate([90, 0, 0])
      .translate([0, this._exit, 0]);
    return add(color('silver')(ring), color('dimgray')(screw));
  }
  describe(): any {
    return format(_('bearing {bore:g}x{od:g}x{w:g} on M3'), { bore: this.bore, od: this.od, w: this.width });
  }
}
export const BTU_7_5 = new PressFitBTU({});
export const BTU_4_8 = new PressFitBTU({
  shaft_dia: 4.8,
  shaft_len: 4.0,
  flange_dia: 6.0,
  flange_h: 1.0,
  ball_top_above_flange: 1.3,
});
export const CERAMIC_3 = new StaticBearing({ ball_dia: 3.0 });
export const CERAMIC_2_5 = new StaticBearing({ ball_dia: 2.5 });
export const MR63 = new RollerBearing({ od: 6.0, width: 2.5, bore: 3.0 });
export const MR83 = new RollerBearing({ od: 8.0, width: 3.0, bore: 3.0 });
export const MR84 = new RollerBearing({
  od: 8.0,
  width: 3.0,
  bore: 4.0,
  screw_clear_dia: 4.3,
  screw_tap_dia: 3.5,
});
export const SUPPORTS = {
  ['btu-7.5']: BTU_7_5,
  ['btu-4.8']: BTU_4_8,
  ['ceramic-3']: CERAMIC_3,
  ['ceramic-2.5']: CERAMIC_2_5,
  ['mr63']: MR63,
  ['mr83']: MR83,
  ['mr84']: MR84,
};
