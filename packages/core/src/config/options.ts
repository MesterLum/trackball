import data from './options-data.json' with { type: 'json' };
import {
  Ball,
  Battery,
  Carrier,
  Cup,
  Deck,
  Design,
  Switches,
  Tray,
  MCUS,
  SENSOR_PCBS,
  SWITCH_TYPES,
  SensorPCB,
} from '../calculations/design.js';
import { SUPPORTS } from '../geometry/supports.js';
export interface Option {
  name: string;
  kind: string;
  default: string | number | boolean;
  help: string;
  group: string;
  flag: string | null;
  choices: string[];
  min: number | null;
  max: number | null;
  step: number | null;
  unit: string;
  pattern: string | null;
  label: string;
  /** Display names for choices whose values are codes (kept stable for shared links). */
  choice_labels?: Record<string, string>;
}
export type Values = Record<string, string | number | boolean>;
export const OPTIONS = data as Option[];
export const BY_NAME = Object.fromEntries(OPTIONS.map((o) => [o.name, o]));
/** Choice options whose values are shown as words (translated) rather than part numbers. */
export const TRANSLATED_CHOICES = new Set(['palm_attachment', 'palm_corners', 'power_switch', 'power_wall']);
/** Options that only matter for some configurations, hidden otherwise. */
export function optionApplies(name: string, v: Partial<Values>): boolean {
  if (name === 'palm_attachment') return Number(v.palm) > 0;
  if (name === 'palm_corners') return Number(v.palm) > 0 && v.palm_attachment === 'fused';
  if (name === 'power_switch') return String(v.battery ?? '').trim() !== '';
  if (name === 'power_wall') return String(v.battery ?? '').trim() !== '' && v.power_switch !== 'none';
  return true;
}
export const defaults = (): Values => Object.fromEntries(OPTIONS.map((o) => [o.name, o.default]));
function copy<T extends object>(value: T, updates: Record<string, unknown> = {}): T {
  return Object.assign(Object.create(Object.getPrototypeOf(value)), value, updates);
}
export function coerce(values: Partial<Values>): Values {
  const out = defaults();
  for (const [name, value] of Object.entries(values)) {
    const o = BY_NAME[name];
    if (!o) throw new Error(`${name}: unknown option`);
    let v: any = value;
    if (o.kind === 'float' || o.kind === 'int') {
      v = Number(value);
      if (!Number.isFinite(v)) throw new Error(`${name}: enter a number`);
      if (o.kind === 'int') v = Math.trunc(v);
    } else if (o.kind === 'bool')
      v =
        typeof value === 'boolean' ? value : ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
    else v = value == null ? '' : String(value);
    if (o.kind === 'choice' && !o.choices.includes(v))
      throw new Error(`${name}: must be one of ${o.choices.join(', ')}`);
    if (typeof v === 'number' && ((o.min !== null && v < o.min) || (o.max !== null && v > o.max)))
      throw new Error(`${name}: outside supported range`);
    out[name] = v;
  }
  if (out.buttons === 'tiles') out.switch_type = 'micro';
  if (out.battery) parseBattery(String(out.battery));
  return out;
}
export function parseBattery(spec: string): Battery {
  if (!spec.trim()) return new Battery({ enabled: false });
  const match = spec.match(/^\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*$/);
  if (!match) throw new Error('battery: use LxWxT in millimetres');
  return new Battery({
    enabled: true,
    length: Number(match[1]),
    width: Number(match[2]),
    thickness: Number(match[3]),
  });
}
export function makeDesign(values: Partial<Values>): Design {
  const v = coerce(values);
  return new Design({
    ball: new Ball({ diameter: v.ball }),
    cup: new Cup({
      support: copy(SUPPORTS[String(v.support) as keyof typeof SUPPORTS]),
      support_count: v.supports,
      support_polar_deg: v.polar,
      gap: v.ball_gap,
      wall: v.cup_wall,
      rim_below_center: v.rim,
      skirt_extra: v.skirt,
      shape: v.cup_shape,
      cut: v.cup_cut,
      round: v.cup_round,
      saddle_r: v.cup_scoop,
      peak: v.cup_peak,
    }),
    pcb: copy(SENSOR_PCBS[String(v.sensor_pcb) as keyof typeof SENSOR_PCBS], {
      header_height: v.header_height,
    }),
    carrier: new Carrier({ padding: v.padding, edge_round: v.edge_round }),
    tray: new Tray({
      mcu: copy(MCUS[String(v.mcu)]),
      mcu_place: v.mcu_place,
      usb_type: v.usb_type,
      usb_exit: v.usb === 'back' ? 'back' : 'side',
      usb_side: v.usb === 'left' ? -1 : 1,
      wall: v.wall,
      floor: v.floor,
      feet_dia: v.feet,
    }),
    switches: new Switches({
      type: copy(SWITCH_TYPES[String(v.switch_type)]),
      count: v.switches,
      placement: v.buttons,
      keycap_u: v.keycap_u,
      gap: v.switch_gap,
      mirror: !v.no_mirror,
      tile_gap: v.tile_gap,
      tile_frame: v.tile_frame,
    }),
    deck: new Deck({
      tilt_deg: v.tilt,
      tent_deg: v.tent,
      palm_length: v.palm,
      palm_attachment: v.palm_attachment,
      palm_drop: v.palm_drop,
      palm_round: v.edge_round,
      palm_pad_recess: v.palm_pad,
      palm_corners: v.palm_corners,
    }),
    battery: copy(parseBattery(String(v.battery)), {
      power_switch: v.power_switch,
      power_wall: v.power_wall,
    }),
    fn: v.fn,
  });
}
export interface Adjustment {
  option: string;
  from: string | number | boolean;
  to: number;
}
export function autofit(values: Partial<Values>): { values: Values; changes: Adjustment[] } {
  const v = coerce(values),
    changes: Adjustment[] = [];
  for (let round = 0; round < 8; round++) {
    const problems = makeDesign(v).problems() as { message: string; fix: Record<string, number> }[];
    const fixes: Record<string, number> = {};
    for (const problem of problems)
      for (const [name, value] of Object.entries(problem.fix))
        fixes[name] =
          fixes[name] === undefined
            ? value
            : value > Number(v[name])
              ? Math.max(fixes[name], value)
              : Math.min(fixes[name], value);
    let changed = false;
    for (const [name, value] of Object.entries(fixes)) {
      const o = BY_NAME[name],
        next = Math.max(o.min ?? -Infinity, Math.min(o.max ?? Infinity, value));
      if (next !== v[name]) {
        changes.push({ option: name, from: v[name], to: next });
        v[name] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { values: v, changes };
}
