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
import { BallSupport, PressFitBTU } from '../geometry/supports.js';
import { TILE_COUNTS, TILE_DEPTH_MIN, holder_boxes, positions, tile_depth } from '../geometry/tiles.js';
export class SensorPCB {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.name = values.name ?? 'bastardkb-pmw3360';
    this.diameter = values.diameter ?? 41.8;
    this.thickness = values.thickness ?? 1.6;
    this.hole_spacing = values.hole_spacing ?? 37.0;
    this.hole_dia = values.hole_dia ?? 3.2;
    this.header_center = values.header_center ?? [17.9, -6.4];
    this.header_pins = values.header_pins ?? 6;
    this.header_height = values.header_height ?? 9.0;
    this.fpc_center = values.fpc_center ?? [-16.75, 0.0];
    this.fpc_size = values.fpc_size ?? [6.0, 12.0];
    this.fpc_height = values.fpc_height ?? 3.0;
  }
  get r(): any {
    return this.diameter / 2;
  }
}
export const BASTARDKB_PMW3360 = new SensorPCB({});
export const PMW3389_ROUND = new SensorPCB({
  name: 'pmw3389-round',
  diameter: 32.0,
  thickness: 1.6,
  hole_spacing: 26.0,
  hole_dia: 3.2,
  header_center: [13.0, 0.0],
  header_pins: 6,
  header_height: 9.0,
  fpc_center: [0.0, 0.0],
  fpc_size: [0.0, 0.0],
  fpc_height: 0.0,
});
export const SENSOR_PCBS = { ['bastardkb']: BASTARDKB_PMW3360, ['pmw3389-round']: PMW3389_ROUND };
export class Lens {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.length = values.length ?? 21.35;
    this.width = values.width ?? 19.0;
    this.corner_r = values.corner_r ?? 3.0;
    this.top_above_pcb = values.top_above_pcb ?? 3.6;
    this.lens_to_ball = values.lens_to_ball ?? 2.4;
    this.clearance = values.clearance ?? 0.5;
  }
  get ball_above_pcb(): any {
    return add(this.top_above_pcb, this.lens_to_ball);
  }
}
export class Ball {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.diameter = values.diameter ?? 34.0;
  }
  get r(): any {
    return this.diameter / 2;
  }
}
export class Cup {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.gap = values.gap ?? 0.8;
    this.wall = values.wall ?? 3.0;
    this.rim_below_center = values.rim_below_center ?? 5.0;
    this.skirt_extra = values.skirt_extra ?? 14.0;
    this.base_dia = values.base_dia ?? null;
    this.base_top_below_center = values.base_top_below_center ?? 7.0;
    this.carrier_screw_angles = values.carrier_screw_angles ?? [65, 115, 245, 295];
    this.insert_dia = values.insert_dia ?? 4.0;
    this.insert_depth = values.insert_depth ?? 5.0;
    this.shape = values.shape ?? 'cone';
    this.round = values.round ?? 2.0;
    this.cut = values.cut ?? 6.0;
    this.saddle_r = values.saddle_r ?? 16.0;
    this.peak = values.peak ?? 'round';
    this.tip_flat = values.tip_flat ?? 1.0;
    this.support = values.support ?? new PressFitBTU();
    this.support_count = values.support_count ?? 3;
    this.support_polar_deg = values.support_polar_deg ?? 55.0;
    this.support_azimuth_deg = values.support_azimuth_deg ?? 90.0;
  }
  skirt_dia(ball_r: any): any {
    if (truth(this.base_dia !== null)) {
      return this.base_dia;
    }
    return add(mul(2, add(add(ball_r, this.gap), this.wall)), this.skirt_extra);
  }
  get azimuth0(): any {
    return get({ ['dome']: 0.0, ['block']: 45.0 }, this.shape, this.support_azimuth_deg);
  }
  get scoop_axes(): any {
    return get({ ['dome']: ['y'], ['block']: ['x', 'y'] }, this.shape, []);
  }
  scoop_floor(): any {
    return sub(-this.rim_below_center, this.cut);
  }
  rim_half_width(ball_r: any): any {
    let r: any, r_out: any, z_rim: any;
    if (truth(this.peak === 'sharp')) {
      z_rim = -this.rim_below_center;
      r_out = math.sqrt(max(sub(add(add(ball_r, this.gap), this.wall) ** 2, z_rim ** 2), 1.0));
      return max(sub(r_out, this.tip_flat), 2.0);
    }
    r = this.saddle_r;
    return truth(this.cut < r) ? math.sqrt(max(sub(r ** 2, sub(r, this.cut) ** 2), 0.0)) : r;
  }
  cut_surface_z(x: any, y: any, ball_r: any): any {
    let axis: any, t: any, w: any, z: any, zf: any;
    z = math.inf;
    zf = this.scoop_floor();
    for (axis of this.scoop_axes) {
      t = abs(truth(axis === 'y') ? x : y);
      if (truth(this.peak === 'sharp')) {
        w = this.rim_half_width(ball_r);
        z = min(z, add(zf, mul(t, this.cut) / w));
      } else {
        if (truth(t < this.saddle_r)) {
          z = min(z, sub(add(zf, this.saddle_r), math.sqrt(sub(this.saddle_r ** 2, t ** 2))));
        }
      }
    }
    return z;
  }
  screw_radius(ball_r: any): any {
    return sub(this.skirt_dia(ball_r) / 2, 3.5);
  }
}
export class Carrier {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.thickness = values.thickness ?? 5.0;
    this.edge_round = values.edge_round ?? 2.0;
    this.padding = values.padding ?? 9.0;
    this.corner_r = values.corner_r ?? 8.0;
    this.pcb_insert_dia = values.pcb_insert_dia ?? 4.0;
    this.pcb_insert_depth = values.pcb_insert_depth ?? 4.5;
    this.screw_clear_dia = values.screw_clear_dia ?? 3.4;
    this.screw_head_dia = values.screw_head_dia ?? 6.0;
    this.screw_head_depth = values.screw_head_depth ?? 3.0;
    this.lid_screw_inset = values.lid_screw_inset ?? 5.0;
    this.bootsel_hole_dia = values.bootsel_hole_dia ?? 4.0;
  }
}
export class Deck {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.tilt_deg = values.tilt_deg ?? 0.0;
    this.tent_deg = values.tent_deg ?? 0.0;
    this.palm_attachment = values.palm_attachment ?? 'separate';
    this.palm_length = values.palm_length ?? 0.0;
    this.palm_drop = values.palm_drop ?? 2.0;
    this.palm_round = values.palm_round ?? 2.0;
    this.palm_pad_recess = values.palm_pad_recess ?? 0.0;
    this.palm_pad_inset = values.palm_pad_inset ?? 5.0;
  }
}
export class MCU {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.name = values.name ?? null;
    this.length = values.length ?? null;
    this.width = values.width ?? null;
    this.thickness = values.thickness ?? 1.0;
    this.holes = values.holes ?? [];
    this.hole_dia = values.hole_dia ?? 2.1;
    this.usb_width = values.usb_width ?? 9.0;
    this.usb_height = values.usb_height ?? 3.3;
    this.usb_overhang = values.usb_overhang ?? 1.3;
    this.component_height = values.component_height ?? 3.5;
    this.bootsel = values.bootsel ?? null;
    this.wireless = values.wireless ?? false;
    this.usb_type = values.usb_type ?? 'usb-c';
    this.usb_z_offset = values.usb_z_offset ?? 0.0;
  }
}
export const _PICO_HOLES = [
  [-23.5, -5.7],
  [-23.5, 5.7],
  [23.5, -5.7],
  [23.5, 5.7],
];
export const PICO = new MCU({
  name: 'pico',
  length: 51.0,
  width: 21.0,
  holes: _PICO_HOLES,
  usb_width: 8.0,
  usb_height: 2.8,
  bootsel: [13.0, -3.5],
  usb_type: 'micro-usb',
});
export const PICO_W = new MCU({
  name: 'pico-w',
  length: 51.0,
  width: 21.0,
  holes: _PICO_HOLES,
  usb_width: 8.0,
  usb_height: 2.8,
  bootsel: [13.0, -3.5],
  wireless: true,
  usb_type: 'micro-usb',
});
export const PICO_2 = new MCU({
  name: 'pico2',
  length: 51.0,
  width: 21.0,
  holes: _PICO_HOLES,
  usb_width: 8.0,
  usb_height: 2.8,
  bootsel: [13.0, -3.5],
  usb_type: 'micro-usb',
});
export const RP2040_ZERO = new MCU({
  name: 'rp2040-zero',
  length: 23.5,
  width: 18.0,
  usb_width: 9.0,
  usb_height: 3.3,
  usb_overhang: 1.0,
  bootsel: [-5.0, 0.0],
});
export const XIAO = new MCU({
  name: 'xiao',
  length: 21.0,
  width: 17.8,
  usb_width: 9.0,
  usb_height: 3.3,
  usb_overhang: 1.2,
  wireless: true,
});
export const NICE_NANO = new MCU({
  name: 'nice-nano',
  length: 33.0,
  width: 18.0,
  usb_width: 9.0,
  usb_height: 3.3,
  usb_overhang: 1.5,
  component_height: 2.0,
  wireless: true,
  usb_z_offset: -1.1,
});
export const SUPERMINI = new MCU({
  name: 'supermini',
  length: 33.5,
  width: 18.0,
  usb_width: 9.0,
  usb_height: 3.3,
  usb_overhang: 1.5,
  component_height: 2.0,
  wireless: true,
});
export const PRO_MICRO = new MCU({
  name: 'pro-micro',
  length: 33.02,
  width: 17.78,
  usb_width: 8.0,
  usb_height: 3.0,
  usb_overhang: 1.5,
  component_height: 3.0,
  usb_type: 'micro-usb',
});
export const MCUS = (() => {
  const result: any = {};
  for (const m of [PICO, PICO_W, PICO_2, RP2040_ZERO, XIAO, NICE_NANO, SUPERMINI, PRO_MICRO]) {
    result[m.name] = m;
  }
  return result;
})();
export class Battery {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.enabled = values.enabled ?? false;
    this.length = values.length ?? 50.0;
    this.width = values.width ?? 34.0;
    this.thickness = values.thickness ?? 5.0;
    this.clearance = values.clearance ?? 0.5;
    this.frame_wall = values.frame_wall ?? 1.5;
    this.frame_extra_h = values.frame_extra_h ?? 1.0;
    this.power_switch = values.power_switch ?? true;
    this.power_switch_slot = values.power_switch_slot ?? [9.0, 4.5];
  }
  get outer(): any {
    let f: any;
    f = mul(2, add(this.clearance, this.frame_wall));
    return [add(this.length, f), add(this.width, f)];
  }
  get extra_height(): any {
    return truth(this.enabled) ? add(this.thickness, this.frame_extra_h) : 0.0;
  }
}
export class SwitchType {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.name = values.name ?? null;
    this.kind = values.kind ?? null;
    this.size_in = values.size_in ?? null;
    this.size_across = values.size_across ?? null;
    this.pitch = values.pitch ?? null;
    this.cutout = values.cutout ?? 0.0;
    this.plate_t = values.plate_t ?? 0.0;
    this.pocket = values.pocket ?? 0.0;
    this.below_plate = values.below_plate ?? 0.0;
    this.above_plate = values.above_plate ?? 0.0;
    this.keycap_h = values.keycap_h ?? 0.0;
    this.body = values.body ?? [12.8, 5.8, 6.5];
    this.plunger_dia = values.plunger_dia ?? 2.5;
    this.plunger_h = values.plunger_h ?? 1.5;
    this.plunger_from_end = values.plunger_from_end ?? 3.2;
    this.paddle_t = values.paddle_t ?? 2.5;
    this.paddle_slot = values.paddle_slot ?? 0.8;
    this.paddle_gap = values.paddle_gap ?? 0.5;
    this.hinge_len = values.hinge_len ?? 3.0;
    this.hinge_t = values.hinge_t ?? 0.8;
    this.holder_wall = values.holder_wall ?? 1.5;
    this.plunger_inset = values.plunger_inset ?? 3.5;
  }
}
export const CHOC_V1 = new SwitchType({
  name: 'choc-v1',
  kind: 'key',
  size_in: 16.5,
  size_across: 17.5,
  pitch: 18.0,
  cutout: 13.8,
  plate_t: 1.3,
  pocket: 15.2,
  below_plate: 5.2,
  above_plate: 5.0,
  keycap_h: 3.0,
});
export const MX = new SwitchType({
  name: 'mx',
  kind: 'key',
  size_in: 18.0,
  size_across: 18.0,
  pitch: 19.05,
  cutout: 14.0,
  plate_t: 1.5,
  pocket: 15.6,
  below_plate: 8.3,
  above_plate: 6.6,
  keycap_h: 8.0,
});
export const MICRO = new SwitchType({
  name: 'micro',
  kind: 'micro',
  size_in: 24.0,
  size_across: 16.0,
  pitch: 18.0,
});
export const SWITCH_TYPES = (() => {
  const result: any = {};
  for (const s of [CHOC_V1, MX, MICRO]) {
    result[s.name] = s;
  }
  return result;
})();
export const PLACEMENTS = ['front', 'left', 'right', 'sides', 'tiles'];
export class Switches {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.type = values.type ?? CHOC_V1;
    this.count = values.count ?? 3;
    this.placement = values.placement ?? 'front';
    this.gap_to_cup = values.gap_to_cup ?? 2.0;
    this.keycap_u = values.keycap_u ?? 1.0;
    this.gap = values.gap ?? 0.0;
    this.mirror = values.mirror ?? true;
    this.tile_gap = values.tile_gap ?? 3.5;
    this.tile_frame = values.tile_frame ?? 4.0;
    this.tile_ring = values.tile_ring ?? 3.0;
    this.tile_slot = values.tile_slot ?? 0.6;
  }
  get is_tiles(): any {
    return truth(this.placement === 'tiles') && truth(this.count > 0);
  }
  get pitch(): any {
    return add(mul(this.type.pitch, this.keycap_u), this.gap);
  }
  get size_across(): any {
    return truth(this.type.kind === 'micro')
      ? mul(this.type.size_across, this.keycap_u)
      : sub(this.pitch, 0.5);
  }
  get rows(): any {
    if (truth(truth(!truth(this.count)) || truth(this.placement === 'tiles'))) {
      return [];
    }
    return index(
      { ['front']: [90.0], ['left']: [0.0], ['right']: [180.0], ['sides']: [0.0, 180.0] },
      this.placement,
    );
  }
  row_distance(skirt_dia: any): any {
    return add(add(skirt_dia / 2, this.gap_to_cup), this.type.size_in / 2);
  }
  positions(skirt_dia: any): any {
    let a: any, ang: any, cx: any, cy: any, dist: any, i: any, o: any, out: any, ux: any, uy: any;
    out = [];
    dist = this.row_distance(skirt_dia);
    for (ang of this.rows) {
      a = math.radians(ang);
      [cx, cy] = [mul(-dist, math.cos(a)), mul(-dist, math.sin(a))];
      [ux, uy] = [-math.sin(a), math.cos(a)];
      for (i of range(this.count)) {
        o = mul(sub(i, sub(this.count, 1) / 2), this.pitch);
        out.push([add(cx, mul(ux, o)), add(cy, mul(uy, o)), ang]);
      }
    }
    return out;
  }
  row_half_width(): any {
    return add(mul(sub(this.count, 1) / 2, this.pitch), this.size_across / 2);
  }
  reach(skirt_dia: any): any {
    return add(this.row_distance(skirt_dia), this.type.size_in / 2);
  }
  depth_below_lid(lid_t: any): any {
    let bar_h: any, st: any;
    st = this.type;
    if (truth(st.kind === 'key')) {
      return max(0.0, sub(st.below_plate, sub(lid_t, st.plate_t)));
    }
    bar_h = sub(add(index(st.body, 2), st.plunger_h), st.paddle_gap);
    return max(0.0, sub(add(add(st.paddle_t, st.paddle_gap), bar_h), lid_t));
  }
}
export class Tray {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.mcu = values.mcu ?? PICO;
    this.mcu_place = values.mcu_place ?? 'behind';
    this.usb_exit = values.usb_exit ?? 'side';
    this.usb_side = values.usb_side ?? +1;
    this.usb_type = values.usb_type ?? 'auto';
    this.mcu_wall_clear = values.mcu_wall_clear ?? 0.3;
    this.usb_clear = values.usb_clear ?? 0.3;
    this.wall = values.wall ?? 3.0;
    this.floor = values.floor ?? 3.0;
    this.feet_dia = values.feet_dia ?? 10.0;
    this.feet_depth = values.feet_depth ?? 1.0;
    this.feet_inset = values.feet_inset ?? 9.0;
    this.standoff_h = values.standoff_h ?? 3.0;
    this.standoff_dia = values.standoff_dia ?? 5.0;
    this.standoff_screw_dia = values.standoff_screw_dia ?? 1.8;
    this.post_dia = values.post_dia ?? 7.5;
    this.post_insert_dia = values.post_insert_dia ?? 4.0;
    this.post_insert_depth = values.post_insert_depth ?? 6.0;
    this.pocket_clear = values.pocket_clear ?? 0.4;
    this.bay_gap = values.bay_gap ?? 3.0;
    this.clearance = values.clearance ?? 1.0;
  }
}
export class Design {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.ball = values.ball ?? new Ball();
    this.cup = values.cup ?? new Cup();
    this.lens = values.lens ?? new Lens();
    this.pcb = values.pcb ?? new SensorPCB();
    this.carrier = values.carrier ?? new Carrier();
    this.tray = values.tray ?? new Tray();
    this.switches = values.switches ?? new Switches();
    this.deck = values.deck ?? new Deck();
    this.battery = values.battery ?? new Battery();
    this.fn = values.fn ?? 96;
  }
  get skirt_dia(): any {
    return this.cup.skirt_dia(this.ball.r);
  }
  get cavity_r(): any {
    return add(this.ball.r, this.cup.gap);
  }
  get z_pcb_face(): any {
    return -add(this.ball.r, this.lens.ball_above_pcb);
  }
  get z_carrier_top(): any {
    return add(this.z_pcb_face, this.carrier.thickness);
  }
  get z_cup_bottom(): any {
    return this.z_carrier_top;
  }
  deck_to_world(p: any): any {
    let a: any, t: any, x: any, y: any, z: any;
    [t, a] = [math.radians(this.deck.tilt_deg), math.radians(this.deck.tent_deg)];
    [x, y, z] = p;
    [y, z] = [sub(mul(y, math.cos(t)), mul(z, math.sin(t))), add(mul(y, math.sin(t)), mul(z, math.cos(t)))];
    [x, z] = [add(mul(x, math.cos(a)), mul(z, math.sin(a))), add(mul(-x, math.sin(a)), mul(z, math.cos(a)))];
    return [x, y, z];
  }
  world_to_deck(p: any): any {
    let a: any, t: any, x: any, y: any, z: any;
    [t, a] = [math.radians(this.deck.tilt_deg), math.radians(this.deck.tent_deg)];
    [x, y, z] = p;
    [x, z] = [sub(mul(x, math.cos(a)), mul(z, math.sin(a))), add(mul(x, math.sin(a)), mul(z, math.cos(a)))];
    [y, z] = [add(mul(y, math.cos(t)), mul(z, math.sin(t))), add(mul(-y, math.sin(t)), mul(z, math.cos(t)))];
    return [x, y, z];
  }
  get bay_y0(): any {
    let depth: any, t: any;
    t = math.radians(abs(this.deck.tilt_deg));
    depth = add(this.pcb.thickness, this.pcb.header_height);
    return add(add(this.pcb.r, this.tray.bay_gap), mul(depth, math.sin(t)));
  }
  get mcu_rot(): any {
    return truth(this.tray.usb_exit === 'back') ? 90.0 : 0.0;
  }
  get mcu_xy_size(): any {
    let a: any, b: any, extra: any, m: any;
    m = this.tray.mcu;
    extra = truth(m.holes) ? 0.0 : add(3.0, mul(2, this.tray.pocket_clear));
    [a, b] = [add(m.length, extra), add(m.width, extra)];
    return truth(this.mcu_rot === 0) ? [a, b] : [b, a];
  }
  get mcu_stack(): any {
    let t: any;
    t = this.tray;
    return add(add(add(t.standoff_h, t.mcu.thickness), t.mcu.component_height), t.clearance);
  }
  get bay_depth(): any {
    return add(index(this.mcu_xy_size, 1), 1.0);
  }
  get post_r(): any {
    return this.tray.post_dia / 2;
  }
  switch_positions(): any {
    if (truth(this.switches.is_tiles)) {
      return positions(this);
    }
    return this.switches.positions(this.skirt_dia);
  }
  lid_screw_points(): any {
    let cr: any, sw: any, x: any, y_back: any, y_front: any;
    cr = this.carrier;
    x = sub(this.half_width, cr.lid_screw_inset);
    y_back = sub(this.back_length, cr.lid_screw_inset);
    y_front = -sub(this.front_length, cr.lid_screw_inset);
    sw = this.switches;
    if (truth(truth(sw.count) && truth(sw.placement === 'front'))) {
      y_front = add(add(-add(this.skirt_dia / 2, sw.gap_to_cup), cr.screw_head_dia / 2), 1.0);
    }
    return [
      [-x, y_front],
      [x, y_front],
      [-x, y_back],
      [x, y_back],
    ];
  }
  get button_strip(): any {
    let sw: any;
    sw = this.switches;
    if (truth(truth(!truth(sw.count)) || truth(sw.is_tiles))) {
      return 0.0;
    }
    return add(sw.gap_to_cup, sw.type.size_in);
  }
  get half_width(): any {
    let hw: any, sw: any;
    hw = add(this.skirt_dia / 2, this.carrier.padding);
    sw = this.switches;
    if (truth(truth(sw.count) && truth(!contains(['front', 'tiles'], sw.placement)))) {
      hw = add(hw, add(sw.gap_to_cup, sw.type.size_in));
    }
    return hw;
  }
  get front_length(): any {
    let hl: any;
    hl = add(this.skirt_dia / 2, this.carrier.padding);
    if (truth(truth(this.switches.count) && truth(this.switches.placement === 'front'))) {
      hl = add(hl, this.button_strip);
    }
    return hl;
  }
  get back_length(): any {
    if (
      truth(
        truth(this.switches.count) &&
          truth(this.switches.placement === 'front') &&
          truth(!truth(this.switches.mirror)),
      )
    ) {
      return add(this.skirt_dia / 2, this.carrier.padding);
    }
    return this.front_length;
  }
  get half_length(): any {
    return add(this.front_length, this.back_length) / 2;
  }
  get footprint(): any {
    return [
      mul(2, this.half_width),
      add(this.front_length, this.back_length),
      0.0,
      sub(this.back_length, this.front_length) / 2,
    ];
  }
  get inner_half_width(): any {
    return sub(this.half_width, this.tray.wall);
  }
  get back_space(): any {
    let t: any, tilt: any, y_deck: any, y_world: any;
    tilt = math.radians(this.deck.tilt_deg);
    t = this.tray;
    y_deck = sub(sub(this.back_length, t.wall), 1.0);
    if (truth(t.usb_exit === 'side')) {
      y_deck = min(y_deck, sub(sub(sub(this.back_length, this.carrier.lid_screw_inset), this.post_r), 0.5));
    }
    y_world = sub(y_deck, mul(this.z_floor_top_nobat, math.sin(tilt))) / max(math.cos(tilt), 1e-6);
    return sub(y_world, this.bay_y0);
  }
  get front_space(): any {
    let tilt: any, y_deck: any, y_world: any;
    tilt = math.radians(this.deck.tilt_deg);
    y_deck = -sub(this.front_length, this.tray.wall);
    y_world = sub(y_deck, mul(this.z_floor_top_nobat, math.sin(tilt))) / max(math.cos(tilt), 1e-6);
    if (truth(this.tray.mcu_place === 'under')) {
      return sub(sub(sub(this.back_length, this.tray.wall), 1.0), y_world);
    }
    return sub(sub(this.bay_y0, 1.0), y_world);
  }
  problems(): any {
    let az: any,
      bl: any,
      bw: any,
      cr: any,
      cup: any,
      deficit: any,
      depth: any,
      dist: any,
      i: any,
      inner_l: any,
      inner_w: any,
      limit: any,
      m: any,
      min_x: any,
      mx: any,
      my: any,
      near: any,
      pad: any,
      pocket_top: any,
      probs: any,
      sup: any,
      sw: any,
      sx: any,
      sy: any,
      t: any,
      th: any,
      worst: any,
      x_screw: any,
      zc: any;
    probs = [];
    t = this.tray;
    pad = this.carrier.padding;
    inner_w = mul(2, this.inner_half_width);
    function report(msg: any, padding_needed: any = null, alt: any = ''): any {
      let fix: any, hint: any;
      fix = truth(padding_needed !== null) ? { ['padding']: round(add(padding_needed, 0.25), 1) } : {};
      hint = truth(fix) ? format(_('use --padding {value:g} or more'), { value: index(fix, 'padding') }) : '';
      if (truth(alt)) {
        hint = truth(hint) ? format(_('{hint}, or {alternative}'), { hint: hint, alternative: alt }) : alt;
      }
      probs.push({ ['message']: truth(hint) ? add(String(msg), ': ', String(hint)) : msg, ['fix']: fix });
    }
    sw = this.switches;
    cr = this.carrier;
    if (truth(truth(sw.count) && truth(sw.placement === 'front'))) {
      limit = sub(sub(this.half_width, t.wall), 0.5);
      if (truth(sw.row_half_width() > limit)) {
        report(
          format(
            _('button row ({count} x {u:g}u {switch} = {width:.1f} mm) is wider than the inside of the body'),
            { count: sw.count, u: sw.keycap_u, switch: sw.type.name, width: mul(2, sw.row_half_width()) },
          ),
          add(pad, sub(sw.row_half_width(), limit)),
        );
      }
      x_screw = sub(this.half_width, cr.lid_screw_inset);
      min_x = add(add(this.skirt_dia / 2, cr.screw_head_dia / 2), 0.5);
      if (truth(x_screw < min_x)) {
        report(
          _('the front lid screws (beside the cup) would hit the cup skirt'),
          add(pad, sub(min_x, x_screw)),
        );
      }
    }
    if (truth(sw.is_tiles)) {
      if (truth(!contains(TILE_COUNTS, sw.count))) {
        near = minBy(TILE_COUNTS, (n: any) => [abs(sub(n, sw.count)), n]);
        probs.push({
          ['message']: format(_('tiles come in {counts}: use --switches {near}'), {
            counts: TILE_COUNTS.map(String).join(', '),
            near: near,
          }),
          ['fix']: { ['switches']: near },
        });
      } else {
        depth = tile_depth(this);
        if (truth(depth < sub(TILE_DEPTH_MIN, 0.05))) {
          report(
            format(
              _(
                'the tiles are only {depth:.1f} mm deep between the cup ring and the hinge ({needed:g} mm needed for the finger and the microswitch)',
              ),
              { depth: depth, needed: TILE_DEPTH_MIN },
            ),
            add(pad, sub(TILE_DEPTH_MIN, depth)),
          );
        }
      }
    }
    m = t.mcu;
    [mx, my] = this.mcu_xy_size;
    if (truth(add(mx, 2.0) > inner_w)) {
      report(
        format(_('MCU {mcu} needs {needed:.1f} mm across but the inside is {inside:.1f} mm wide'), {
          mcu: m.name,
          needed: add(mx, 2.0),
          inside: inner_w,
        }),
        add(pad, sub(add(mx, 2.0), inner_w) / 2),
      );
    }
    if (truth(truth(t.mcu_place === 'behind') && truth(this.bay_depth > this.back_space))) {
      report(
        format(
          _(
            'MCU {mcu} needs {needed:.1f} mm behind the sensor but only {free:.1f} mm are free before the back posts',
          ),
          { mcu: m.name, needed: this.bay_depth, free: max(this.back_space, 0.0) },
        ),
        add(pad, sub(this.bay_depth, this.back_space)),
        _('put it under the sensor with --mcu-place under'),
      );
    }
    if (
      truth(
        truth(t.usb_exit === 'back') &&
          truth(add(mx / 2, 0.5) > sub(sub(this.half_width, cr.lid_screw_inset), this.post_r)),
      )
    ) {
      report(
        format(_('MCU {mcu} (turned for a back USB) runs into the back corner posts'), { mcu: m.name }),
        add(pad, sub(add(mx / 2, 0.5), sub(sub(this.half_width, cr.lid_screw_inset), this.post_r))),
      );
    }
    if (truth(t.mcu_place === 'under')) {
      inner_l = sub(add(this.front_length, this.back_length), mul(2, t.wall));
      if (truth(add(my, 2.0) > inner_l)) {
        report(
          format(
            _(
              'MCU {mcu} needs {needed:.1f} mm front-to-back under the sensor but the inside is {inside:.1f} mm',
            ),
            { mcu: m.name, needed: add(my, 2.0), inside: inner_l },
          ),
          add(pad, sub(add(my, 2.0), inner_l) / 2),
        );
      }
    }
    deficit = this.mcu_fit_deficit();
    if (truth(deficit > 0.01)) {
      report(
        format(_('MCU {mcu} mount needs more clearance from the walls, sensor or lid posts'), {
          mcu: m.name,
        }),
        add(add(pad, deficit), 0.25),
      );
    }
    if (truth(truth(this.deck.palm_length > 0) && truth(this.deck.palm_attachment === 'anchored'))) {
      if (truth(this.deck.palm_length < 18)) {
        probs.push({
          ['message']: _('anchored palm rest needs at least 18 mm length'),
          ['fix']: { ['palm']: 18.0 },
        });
      }
      if (truth(t.floor < 2.5)) {
        probs.push({
          ['message']: _('anchored palm rest needs at least 2.5 mm floor thickness'),
          ['fix']: { ['floor']: 2.5 },
        });
      }
    }
    cup = this.cup;
    if (truth(cup.scoop_axes)) {
      sup = cup.support;
      dist = add(this.ball.r, sup.contact_height);
      th = math.radians(cup.support_polar_deg);
      worst = 0.0;
      for (i of range(cup.support_count)) {
        az = math.radians(add(cup.azimuth0, mul(360.0, i) / cup.support_count));
        [sx, sy] = [mul(mul(dist, math.sin(th)), math.cos(az)), mul(mul(dist, math.sin(th)), math.sin(az))];
        pocket_top = add(add(mul(-dist, math.cos(th)), mul(sup.body_radius(), math.sin(th))), 1.0);
        zc = cup.cut_surface_z(sx, sy, this.ball.r);
        if (truth(zc < pocket_top)) {
          worst = max(worst, sub(pocket_top, zc));
        }
      }
      if (truth(worst > 0)) {
        probs.push({
          ['message']: format(
            _(
              'the cup scoops cut into the ball-support pockets: use --cup-cut {value:.1f} or less, or lower --polar / use smaller supports',
            ),
            { value: max(sub(cup.cut, worst), 0) },
          ),
          ['fix']: { ['cup_cut']: round(max(sub(sub(cup.cut, worst), 0.25), 0.0), 1) },
        });
      }
    }
    if (truth(this.battery.enabled)) {
      [bl, bw] = this.battery.outer;
      if (truth(bl > sub(inner_w, 2.0))) {
        report(
          format(_('battery {length:g} mm long does not fit the {inside:.1f} mm wide inside'), {
            length: this.battery.length,
            inside: inner_w,
          }),
          add(pad, sub(add(bl, 2.0), inner_w) / 2),
        );
      }
      if (truth(bw > this.front_space)) {
        report(
          format(
            _(
              'battery {width:g} mm wide needs {needed:.1f} mm under the sensor but only {free:.1f} mm are free before the MCU',
            ),
            { width: this.battery.width, needed: bw, free: this.front_space },
          ),
          add(pad, sub(bw, this.front_space)),
        );
      }
    }
    return probs;
  }
  validate(): any {
    return (() => {
      const result: any = [];
      for (const p of this.problems()) {
        result.push(index(p, 'message'));
      }
      return result;
    })();
  }
  get z_floor_top_nobat(): any {
    return add(
      add(this.z_floor_top, this.battery.extra_height),
      truth(this.tray.mcu_place === 'under') ? this.mcu_stack : 0,
    );
  }
  holder_over_mcu(center: any = null): any {
    let corners: any, cxm: any, cym: any, mx: any, my: any, x0: any, x1: any, y0: any, y1: any, z: any;
    if (truth(truth(!truth(this.switches.is_tiles)) || truth(this.tray.mcu_place !== 'behind'))) {
      return 0.0;
    }
    [mx, my] = this.mcu_xy_size;
    [cxm, cym] = truth(center === null) ? this.mcu_center() : center;
    z = sub(this.z_pcb_face, this.switches.depth_below_lid(this.carrier.thickness));
    corners = (() => {
      const result: any = [];
      for (const x of [-mx / 2, mx / 2]) {
        for (const y of [-my / 2, my / 2]) {
          result.push(this.world_to_deck([add(cxm, x), add(cym, y), z]));
        }
      }
      return result;
    })();
    for ([x0, x1, y0, y1] of holder_boxes(this)) {
      if (
        truth(
          truth(
            x0 <
              max(
                (() => {
                  const result: any = [];
                  for (const p of corners) {
                    result.push(index(p, 0));
                  }
                  return result;
                })(),
              ),
          ) &&
            truth(
              x1 >
                min(
                  (() => {
                    const result: any = [];
                    for (const p of corners) {
                      result.push(index(p, 0));
                    }
                    return result;
                  })(),
                ),
            ) &&
            truth(
              y0 <
                max(
                  (() => {
                    const result: any = [];
                    for (const p of corners) {
                      result.push(index(p, 1));
                    }
                    return result;
                  })(),
                ),
            ) &&
            truth(
              y1 >
                min(
                  (() => {
                    const result: any = [];
                    for (const p of corners) {
                      result.push(index(p, 1));
                    }
                    return result;
                  })(),
                ),
            ),
        )
      ) {
        return add(this.switches.depth_below_lid(this.carrier.thickness), this.tray.clearance);
      }
    }
    return 0.0;
  }
  get z_floor_top(): any {
    let _: any,
      a: any,
      allowance: any,
      cx: any,
      cy: any,
      depth: any,
      dx: any,
      dy: any,
      extra: any,
      floor: any,
      k: any,
      needs: any,
      over: any,
      radius: any,
      sx: any,
      sy: any,
      t: any,
      top: any,
      x: any,
      y: any;
    t = this.tray;
    needs = [];
    for (k of range(8)) {
      a = math.radians(mul(45, k));
      needs.push([
        mul(this.pcb.r, math.cos(a)),
        mul(this.pcb.r, math.sin(a)),
        add(add(this.pcb.thickness, this.pcb.header_height), t.clearance),
      ]);
    }
    if (truth(this.switches.count)) {
      depth = add(this.switches.depth_below_lid(this.carrier.thickness), t.clearance);
      radius = max(this.switches.type.size_in, this.switches.size_across) / 2;
      for ([x, y, _] of this.switch_positions()) {
        for (dx of [-radius, radius]) {
          for (dy of [-radius, radius]) {
            needs.push([add(x, dx), add(y, dy), depth]);
          }
        }
      }
    }
    allowance = add(this.battery.extra_height, truth(t.mcu_place === 'under') ? this.mcu_stack : 0);
    floor = sub(
      min(
        (() => {
          const result: any = [];
          for (const [x, y, depth] of needs) {
            result.push(sub(index(this.deck_to_world([x, y, this.z_pcb_face]), 2), depth));
          }
          return result;
        })(),
      ),
      allowance,
    );
    for (_ of range(40)) {
      [cx, cy] = this.mcu_center(floor);
      [sx, sy] = this.mcu_xy_size;
      extra = this.holder_over_mcu([cx, cy]);
      top = add(
        add(
          add(
            add(add(floor, this.mcu_standoff_h), t.mcu.thickness),
            max(t.mcu.component_height, add(this.usb_height, this.usb_z_offset)),
          ),
          t.clearance,
        ),
        extra,
      );
      over = max(
        (() => {
          const result: any = [];
          for (const dx of [-sx / 2, sx / 2]) {
            for (const dy of [-sy / 2, sy / 2]) {
              result.push(
                sub(index(this.world_to_deck([add(cx, dx), add(cy, dy), top]), 2), this.z_pcb_face),
              );
            }
          }
          return result;
        })(),
      );
      if (truth(over <= 1e-7)) {
        break;
      }
      floor = sub(floor, add(over / index(this.world_to_deck([0, 0, 1]), 2), 1e-6));
    }
    return floor;
  }
  get mcu_standoff_h(): any {
    let t: any;
    t = this.tray;
    if (truth(truth(t.mcu_place === 'under') && truth(this.battery.enabled))) {
      return add(t.standoff_h, this.battery.extra_height);
    }
    return t.standoff_h;
  }
  get z_floor_bottom(): any {
    return sub(this.z_floor_top, this.tray.floor);
  }
  get usb_kind(): any {
    return truth(this.tray.usb_type === 'auto') ? this.tray.mcu.usb_type : this.tray.usb_type;
  }
  get usb_width(): any {
    if (truth(truth(this.tray.usb_type === 'auto') || truth(this.usb_kind === this.tray.mcu.usb_type))) {
      return this.tray.mcu.usb_width;
    }
    return truth(this.usb_kind === 'micro-usb') ? 8.0 : 9.0;
  }
  get usb_height(): any {
    if (truth(truth(this.tray.usb_type === 'auto') || truth(this.usb_kind === this.tray.mcu.usb_type))) {
      return this.tray.mcu.usb_height;
    }
    return truth(this.usb_kind === 'micro-usb') ? 2.8 : 3.3;
  }
  get usb_z_offset(): any {
    return truth(this.usb_kind === this.tray.mcu.usb_type) ? this.tray.mcu.usb_z_offset : 0.0;
  }
  mcu_mount_bounds(): any {
    let extra: any, m: any, r: any, t: any;
    [t, m] = [this.tray, this.tray.mcu];
    if (truth(m.holes)) {
      r = t.standoff_dia / 2;
      return [
        min(
          -m.length / 2,
          min(
            (() => {
              const result: any = [];
              for (const [a, b] of m.holes) {
                result.push(sub(a, r));
              }
              return result;
            })(),
          ),
        ),
        max(
          m.length / 2,
          max(
            (() => {
              const result: any = [];
              for (const [a, b] of m.holes) {
                result.push(add(a, r));
              }
              return result;
            })(),
          ),
        ),
        max(
          m.width / 2,
          max(
            (() => {
              const result: any = [];
              for (const [a, b] of m.holes) {
                result.push(add(abs(b), r));
              }
              return result;
            })(),
          ),
        ),
      ];
    }
    extra = add(t.pocket_clear, 1.5);
    return [sub(-m.length / 2, extra), m.length / 2, add(m.width / 2, extra)];
  }
  mcu_center(floor_z: any = null): any {
    let a: any,
      across: any,
      axis: any,
      b: any,
      direction: any,
      farthest: any,
      floor: any,
      height: any,
      hi: any,
      limit: any,
      lo: any,
      m: any,
      points: any,
      rate: any,
      sign: any,
      t: any,
      travel: any,
      x: any,
      y: any,
      z: any;
    [t, m] = [this.tray, this.tray.mcu];
    floor = truth(floor_z === null) ? this.z_floor_top : floor_z;
    [lo, hi, across] = this.mcu_mount_bounds();
    [x, y] = truth(t.usb_exit === 'back')
      ? [0.0, 0.0]
      : [0.0, truth(t.mcu_place === 'behind') ? add(this.bay_y0, index(this.mcu_xy_size, 1) / 2) : 0.0];
    axis = truth(t.usb_exit === 'back') ? 1 : 0;
    direction = truth(axis === 1) ? [0, 1, 0] : [t.usb_side, 0, 0];
    sign = truth(axis === 1) ? 1 : t.usb_side;
    limit = sub(sub(truth(axis === 1) ? this.back_length : this.half_width, t.wall), t.mcu_wall_clear);
    height = add(add(this.mcu_standoff_h, m.thickness), truth(m.holes) ? 0 : 1);
    points = [];
    for (a of [lo, hi]) {
      for (b of [-across, across]) {
        for (z of [floor, add(floor, height)]) {
          points.push(
            truth(axis === 1)
              ? [sub(x, b), add(y, a), z]
              : [add(x, mul(t.usb_side, a)), add(y, mul(t.usb_side, b)), z],
          );
        }
      }
    }
    farthest = max(
      (() => {
        const result: any = [];
        for (const p of points) {
          result.push(mul(sign, index(this.world_to_deck(p), axis)));
        }
        return result;
      })(),
    );
    rate = mul(sign, index(this.world_to_deck(direction), axis));
    travel = sub(limit, farthest) / rate;
    return [add(x, mul(index(direction, 0), travel)), add(y, mul(index(direction, 1), travel))];
  }
  mcu_mount_corners(floor_z: any = null): any {
    let across: any, floor: any, height: any, hi: any, lo: any, x: any, y: any;
    floor = truth(floor_z === null) ? this.z_floor_top : floor_z;
    [x, y] = this.mcu_center(floor);
    [lo, hi, across] = this.mcu_mount_bounds();
    height = add(add(this.mcu_standoff_h, this.tray.mcu.thickness), truth(this.tray.mcu.holes) ? 0 : 1);
    return (() => {
      const result: any = [];
      for (const a of [lo, hi]) {
        for (const b of [-across, across]) {
          for (const z of [floor, add(floor, height)]) {
            result.push(
              truth(this.tray.usb_exit === 'back')
                ? [sub(x, b), add(y, a), z]
                : [add(x, mul(this.tray.usb_side, a)), add(y, mul(this.tray.usb_side, b)), z],
            );
          }
        }
      }
      return result;
    })();
  }
  mcu_fit_deficit(): any {
    let corners: any,
      cx: any,
      cy: any,
      deck: any,
      deficit: any,
      distance: any,
      hx: any,
      hy: any,
      l: any,
      qx: any,
      qy: any,
      r: any,
      t: any,
      w: any,
      x0: any,
      x1: any,
      x: any,
      y0: any,
      y1: any,
      y: any,
      z: any;
    t = this.tray;
    corners = this.mcu_mount_corners();
    deck = (() => {
      const result: any = [];
      for (const p of corners) {
        result.push(this.world_to_deck(p));
      }
      return result;
    })();
    [w, l, cx, cy] = this.footprint;
    [hx, hy] = [sub(w / 2, t.wall), sub(l / 2, t.wall)];
    r = max(sub(this.carrier.corner_r, t.wall), 1);
    deficit = 0.0;
    for ([x, y, z] of deck) {
      [qx, qy] = [sub(abs(sub(x, cx)), sub(hx, r)), sub(abs(sub(y, cy)), sub(hy, r))];
      distance = sub(add(math.hypot(max(qx, 0), max(qy, 0)), min(max(qx, qy), 0)), r);
      deficit = max(deficit, add(distance, t.mcu_wall_clear));
    }
    [x0, x1] = [
      min(
        (() => {
          const result: any = [];
          for (const p of deck) {
            result.push(index(p, 0));
          }
          return result;
        })(),
      ),
      max(
        (() => {
          const result: any = [];
          for (const p of deck) {
            result.push(index(p, 0));
          }
          return result;
        })(),
      ),
    ];
    [y0, y1] = [
      min(
        (() => {
          const result: any = [];
          for (const p of deck) {
            result.push(index(p, 1));
          }
          return result;
        })(),
      ),
      max(
        (() => {
          const result: any = [];
          for (const p of deck) {
            result.push(index(p, 1));
          }
          return result;
        })(),
      ),
    ];
    for ([x, y] of this.lid_screw_points()) {
      distance = math.hypot(max(sub(x0, x), sub(x, x1), 0), max(sub(y0, y), sub(y, y1), 0));
      deficit = max(deficit, sub(add(this.post_r, t.mcu_wall_clear), distance));
    }
    if (truth(t.mcu_place === 'behind')) {
      deficit = max(
        deficit,
        sub(
          this.bay_y0,
          min(
            (() => {
              const result: any = [];
              for (const p of corners) {
                result.push(index(p, 1));
              }
              return result;
            })(),
          ),
        ),
      );
    }
    return deficit;
  }
  battery_center(): any {
    let b: any, y: any;
    b = this.battery;
    y = min(0.0, sub(sub(this.bay_y0, 1.0), index(b.outer, 1) / 2));
    return [0.0, y];
  }
  floor_xy(xd: any, yd: any): any {
    let _i: any, w: any, zd: any;
    zd = this.z_pcb_face;
    for (_i of range(8)) {
      w = this.deck_to_world([xd, yd, zd]);
      zd = add(zd, sub(this.z_floor_bottom, index(w, 2)));
    }
    w = this.deck_to_world([xd, yd, zd]);
    return [index(w, 0), index(w, 1)];
  }
  feet_xy(): any {
    let i: any, pts: any;
    if (truth(this.tray.feet_dia <= 0)) {
      return [];
    }
    i = this.tray.feet_inset;
    pts = (() => {
      const result: any = [];
      for (const sx of [-1, 1]) {
        for (const yy of [-sub(this.front_length, i), sub(this.back_length, i)]) {
          result.push([mul(sx, sub(this.half_width, i)), yy]);
        }
      }
      return result;
    })();
    return (() => {
      const result: any = [];
      for (const [x, y] of pts) {
        result.push(this.floor_xy(x, y));
      }
      return result;
    })();
  }
  palm_feet_xy(): any {
    let i: any, pts: any, y0: any, y1: any, ys: any;
    if (truth(truth(this.tray.feet_dia <= 0) || truth(this.deck.palm_length <= 0))) {
      return [];
    }
    i = this.tray.feet_inset;
    [y0, y1] = this.palm_y_range;
    ys = truth(sub(y1, y0) >= add(mul(2, i), this.tray.feet_dia))
      ? [add(y0, i), sub(y1, i)]
      : [add(y0, y1) / 2];
    pts = (() => {
      const result: any = [];
      for (const sx of [-1, 1]) {
        for (const y of ys) {
          result.push([mul(sx, sub(this.half_width, i)), y]);
        }
      }
      return result;
    })();
    return (() => {
      const result: any = [];
      for (const [x, y] of pts) {
        result.push(this.floor_xy(x, y));
      }
      return result;
    })();
  }
  height_breakdown(): any {
    let note: any, parts: any, t: any;
    t = this.tray;
    parts = [
      format(_('ball r {v:g}'), { v: this.ball.r }),
      format(_('optics {v:g}'), { v: this.lens.ball_above_pcb }),
      format(_('PCB+header {v:g}'), { v: add(this.pcb.thickness, this.pcb.header_height) }),
      format(_('air {v:g}'), { v: t.clearance }),
      format(_('floor {v:g}'), { v: t.floor }),
    ];
    if (truth(this.battery.enabled)) {
      parts.push(format(_('battery {v:g}'), { v: this.battery.extra_height }));
    }
    if (truth(t.mcu_place === 'under')) {
      parts.push(format(_('MCU under {v:g}'), { v: this.mcu_stack }));
    }
    note = '';
    if (
      truth(
        truth(t.mcu_place === 'behind') &&
          truth(this.mcu_stack > add(add(this.pcb.thickness, this.pcb.header_height), t.clearance)),
      )
    ) {
      note = format(_('; the MCU stack ({v:g} mm) sets the floor, not the header'), { v: this.mcu_stack });
    }
    return add(parts.join(' + '), note);
  }
  get palm_y_range(): any {
    let y1: any;
    y1 = sub(-this.front_length, truth(this.deck.palm_attachment === 'fused') ? 0.0 : 0.5);
    return [sub(y1, this.deck.palm_length), y1];
  }
  bom(): any {
    let b: any, items: any, kind: any, n: any, sup: any, sw: any, t: any;
    [sw, t, b] = [this.switches, this.tray, this.battery];
    items = [
      {
        ['item']: format(_('Trackball Ø{d:g} mm'), { d: this.ball.diameter }),
        ['qty']: 1,
        ['note']: _('a two-colour or speckled ball tracks best'),
      },
      {
        ['item']: format(_('Sensor board: {name}'), { name: this.pcb.name }),
        ['qty']: 1,
        ['note']: _('PMW3360 / PMW3389 with the LM19-LSI lens'),
      },
      {
        ['item']: format(_('Controller: {name}'), { name: t.mcu.name }),
        ['qty']: 1,
        ['note']: add(
          truth(t.mcu.wireless) ? _('wireless capable') : 'USB',
          truth(t.mcu.holes) ? _(', on 4x M2x6 self-tapping screws') : _(', friction pocket (dab of glue)'),
        ),
      },
    ];
    sup = this.cup.support;
    kind = sup.kind;
    items.push({
      ['item']: format(_('Ball support: {support}'), { support: sup.describe() }),
      ['qty']: this.cup.support_count,
      ['note']: truth(kind === 'btu')
        ? _('press fit')
        : truth(kind === 'bearing')
          ? _('plus one M3x25 screw each as axle')
          : _('snap into the printed sockets'),
    });
    if (truth(sw.count)) {
      n = truth(sw.is_tiles) ? sw.count : mul(sw.count, truth(sw.placement === 'sides') ? 2 : 1);
      if (truth(sw.type.kind === 'key')) {
        items.push({
          ['item']: format(_('{switch} switches'), { switch: sw.type.name }),
          ['qty']: n,
          ['note']: _('wired GPIO to GND, internal pull-up'),
        });
        items.push({
          ['item']: format(_('keycaps {u:g}u'), { u: sw.keycap_u }),
          ['qty']: n,
          ['note']: _('any profile'),
        });
      } else {
        items.push({
          ['item']: _('Omron D2F / Kailh GM microswitches'),
          ['qty']: n,
          ['note']: truth(sw.is_tiles)
            ? _('pushed into the holder blocks under the tiles')
            : _('pushed into the holder bars'),
        });
      }
    }
    if (truth(b.enabled)) {
      items.push({
        ['item']: format(_('LiPo {l:g}x{w:g}x{t:g} mm'), { l: b.length, w: b.width, t: b.thickness }),
        ['qty']: 1,
        ['note']: _('plus a slide switch for the side-wall slot'),
      });
    }
    items = add(items, [
      {
        ['item']: _('M3 heat-set inserts (Ø4 x 5 mm)'),
        ['qty']: 10,
        ['note']: _('4 cup, 2 sensor PCB, 4 tray posts'),
      },
      { ['item']: _('M3x8 screws'), ['qty']: 8, ['note']: _('cup to carrier (4), lid to tray (4)') },
      { ['item']: _('M3x6 screws'), ['qty']: 2, ['note']: _('sensor PCB to carrier') },
      {
        ['item']: format(_('Rubber feet Ø{d:g} mm'), { d: t.feet_dia }),
        ['qty']: add(length(this.feet_xy()), length(this.palm_feet_xy())),
        ['note']: _('self-adhesive; 4 under the tray, the rest under the palm rest'),
      },
      {
        ['item']: _('Wire (6 for the sensor SPI, 2 per switch)'),
        ['qty']: 1,
        ['note']: _('JST or direct solder'),
      },
    ]);
    return (() => {
      const result: any = [];
      for (const i of items) {
        if (!truth(index(i, 'qty'))) continue;
        result.push(i);
      }
      return result;
    })();
  }
  summary(): any {
    let _cx: any,
      _cy: any,
      centred: any,
      corners: any,
      l: any,
      lines: any,
      sw: any,
      sw_line: any,
      top: any,
      usb: any,
      w: any;
    [w, l, _cx, _cy] = this.footprint;
    sw = this.switches;
    corners = (() => {
      const result: any = [];
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          result.push([mul(sx, w) / 2, mul(sy, l) / 2]);
        }
      }
      return result;
    })();
    top = max(
      (() => {
        const result: any = [];
        for (const [x, y] of corners) {
          result.push(index(this.deck_to_world([x, y, this.z_carrier_top]), 2));
        }
        return result;
      })(),
    );
    top = max(top, this.ball.r);
    if (truth(sw.is_tiles)) {
      sw_line = format(_('{n} tiles around the ball over microswitches'), { n: sw.count });
    } else {
      if (truth(sw.count)) {
        sw_line = format(_('{n} x {switch} at the {placement}'), {
          n: sw.count,
          switch: sw.type.name,
          placement: _(sw.placement),
        });
      } else {
        sw_line = _('none');
      }
    }
    centred = truth(index(this.footprint, 3) === 0)
      ? _('ball centred')
      : format(_('ball {d:.1f} mm behind centre'), { d: -index(this.footprint, 3) });
    usb = truth(this.tray.usb_exit === 'back')
      ? _('back')
      : format(_('{sign}X side'), { sign: truth(this.tray.usb_side > 0) ? '+' : '-' });
    lines = [
      format(_('ball Ø{d}  support={support} x{n} @ {polar}°'), {
        d: this.ball.diameter,
        support: this.cup.support.describe(),
        n: this.cup.support_count,
        polar: this.cup.support_polar_deg,
      }),
      format(_('cup {shape}, skirt Ø{skirt:.1f}   ball centre {h:.2f} mm above PCB front'), {
        shape: this.cup.shape,
        skirt: this.skirt_dia,
        h: this.lens.ball_above_pcb,
      }),
      add(
        format(_('deck tilt/tent                    : {tilt}° / {tent}°'), {
          tilt: this.deck.tilt_deg,
          tent: this.deck.tent_deg,
        }),
        truth(this.deck.palm_length)
          ? format(_(', palm rest {l:g} mm ({attachment})'), {
              l: this.deck.palm_length,
              attachment: _(this.deck.palm_attachment),
            })
          : '',
      ),
      format(
        _(
          'body ({centred}, padding {pad:g}) : {w:.1f} x {l:.1f} mm; free behind sensor {free:.1f} mm, MCU needs {need:.1f}',
        ),
        {
          centred: centred,
          pad: this.carrier.padding,
          w: w,
          l: l,
          free: this.back_space,
          need: this.bay_depth,
        },
      ),
      format(_('height: floor -> ball top / back  : {a:.1f} / {b:.1f} mm  ({breakdown})'), {
        a: sub(this.ball.r, this.z_floor_bottom),
        b: sub(top, this.z_floor_bottom),
        breakdown: this.height_breakdown(),
      }),
      add(
        format(_('walls: tray {wall:g}, floor {floor:g}, lid {lid:g}, cup {cup:g} mm'), {
          wall: this.tray.wall,
          floor: this.tray.floor,
          lid: this.carrier.thickness,
          cup: this.cup.wall,
        }),
        truth(this.tray.feet_dia > 0)
          ? format(_('; {n} feet Ø{d:g}'), {
              n: add(length(this.feet_xy()), length(this.palm_feet_xy())),
              d: this.tray.feet_dia,
            })
          : '',
      ),
      add(
        add(
          format(_('MCU                               : {mcu} {place} the sensor, USB out the {usb}'), {
            mcu: this.tray.mcu.name,
            place: _(this.tray.mcu_place),
            usb: usb,
          }),
          truth(this.tray.mcu_place === 'under')
            ? format(_(' (+{h:g} mm height)'), { h: this.mcu_stack })
            : '',
        ),
        truth(this.battery.enabled)
          ? format(_('; battery {l:g}x{w:g}x{t:g} under the sensor (+{h:g} mm)'), {
              l: this.battery.length,
              w: this.battery.width,
              t: this.battery.thickness,
              h: this.battery.extra_height,
            })
          : '',
      ),
      add(
        add(
          format(_('switches                          : {line}'), { line: sw_line }),
          truth(truth(sw.count) && truth(sw.keycap_u !== 1))
            ? format(_(', {u:g}u caps'), { u: sw.keycap_u })
            : '',
        ),
        truth(truth(sw.count) && truth(sw.placement === 'front') && truth(!truth(sw.mirror)))
          ? _(', front strip only')
          : '',
      ),
    ];
    return lines.join('\n');
  }
}
