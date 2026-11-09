import data from './options-data.json' with { type: 'json' };
import {
  Ball,
  Battery,
  Carrier,
  Cup,
  Deck,
  Design,
  Lens,
  Switches,
  Tray,
  MCUS,
  SENSOR_PCBS,
  SWITCH_TYPES,
} from '../calculations/design.js';
import { SUPPORTS } from '../geometry/supports.js';
import { Fit } from '../calculations/fit.js';
import { POD_FEET, POD_FIT, POD_SCREW, POD_STANDOFF, POD_WALL, Pod } from '../calculations/pod.js';
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
export const TRANSLATED_CHOICES = new Set([
  'build',
  'sensor_pcb',
  'shell',
  'weight_cap',
  'pod_base',
  'sensor_mount',
  'reset_switch',
  'pod_side',
  'mcu_hold',
  'palm_attachment',
  'palm_corners',
  'power_switch',
  'power_wall',
]);
/** A pod has no buttons, palm rest, tilt or battery; its controller sits under the sensor. */
const POD_FIXED: Values = {
  switches: 0,
  palm: 0,
  tilt: 0,
  tent: 0,
  mcu_place: 'under',
  cup_shape: 'cone',
};
const POD_HIDDEN = new Set([
  ...Object.keys(POD_FIXED),
  'cup_cut',
  'cup_scoop',
  'cup_peak',
  'cup_round',
  'wall',
  'edge_round',
]);
/** Options that only matter for some configurations, hidden otherwise. */
export function optionApplies(name: string, v: Partial<Values>): boolean {
  // The build is chosen with its own picker, above the settings.
  if (name === 'build') return false;
  const pod = v.build === 'pod' || v.build === 'cradle';
  if (name === 'shell' || name === 'weight_depth') return pod;
  if (name === 'weight_cap') return pod && Number(v.weight_depth ?? 8) > 0;
  if (name === 'pod_base' || name === 'pod_side') return v.build === 'cradle';
  if (name === 'reset_switch') return pod;
  if (name === 'sensor_mount') return v.build === 'cradle' && v.pod_base !== 'covered';
  if (pod && (POD_HIDDEN.has(name) || ['Buttons', 'Deck'].includes(BY_NAME[name]?.group))) return false;
  const holeless = !MCUS[String(v.mcu)]?.holes?.length;
  if (name === 'mcu_hold') return holeless;
  if (name === 'clamp_length' || name === 'clamp_width') return holeless && v.mcu_hold !== 'glue';
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
  if (out.build !== 'full') Object.assign(out, POD_FIXED);
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
/** A support with its bore or socket grown by the printer's hole fit. */
function fittedSupport(support: object, hole: number): object {
  const s = support as Record<string, number>,
    grown: Record<string, number> = {};
  for (const key of ['press_fit_oversize', 'socket_oversize', 'screw_clear_dia'])
    if (key in s) grown[key] = s[key] + hole;
  return copy(support, grown);
}
export function makeDesign(values: Partial<Values>): Design {
  const v = coerce(values);
  const pcb = SENSOR_PCBS[String(v.sensor_pcb) as keyof typeof SENSOR_PCBS];
  const podFit = POD_FIT + Number(v.fit_gap);
  return new Design({
    ball: new Ball({ diameter: v.ball }),
    cup: new Cup({
      support: fittedSupport(SUPPORTS[String(v.support) as keyof typeof SUPPORTS], Number(v.fit_hole)),
      support_count: v.supports,
      support_polar_deg: v.polar,
      gap: v.ball_gap,
      wall: v.cup_wall,
      rim_below_center: v.rim,
      skirt_extra: v.skirt,
      // A cradle pod's front notch sits between two supports.
      support_azimuth_deg: v.build === 'cradle' ? 270 + 180 / Number(v.supports) : undefined,
      shape: v.cup_shape,
      cut: v.cup_cut,
      round: v.cup_round,
      saddle_r: v.cup_scoop,
      peak: v.cup_peak,
    }),
    pcb: copy(pcb, { header_height: v.header_height }),
    // The board's datasheet distance plus the builder's adjustment.
    lens: new Lens({
      top_above_pcb: pcb.lens.top_above_pcb,
      lens_to_ball: pcb.lens.lens_to_ball + Number(v.sensor_adjust),
    }),
    carrier: new Carrier({ padding: v.padding, edge_round: v.edge_round, sensor_relief: v.sensor_relief }),
    tray: new Tray({
      mcu: copy(MCUS[String(v.mcu)]),
      mcu_place: v.mcu_place,
      usb_type: v.usb_type,
      mcu_hold: v.mcu_hold,
      reset_switch: v.build !== 'full' ? v.reset_switch : 'none',
      clamp_length: v.clamp_length,
      clamp_width: v.clamp_width,
      usb_exit: v.usb === 'back' ? 'back' : 'side',
      usb_side: v.usb === 'left' ? -1 : 1,
      // A pod's walls are its shell: the room inside ends at the shell plus a fitting gap.
      wall: v.build !== 'full' ? POD_WALL[v.shell as keyof typeof POD_WALL] + podFit : v.wall,
      post_dia: v.build !== 'full' ? POD_SCREW.post_dia : undefined,
      feet_depth: v.build !== 'full' ? POD_FEET.depth : undefined,
      // In a pod the electronics bay is kept low: a board without mounting holes lies flat in its
      // clamped pocket, one with holes sits on short standoffs whose screw holes run into the floor.
      standoff_h: v.build !== 'full' ? (MCUS[String(v.mcu)]?.holes?.length ? POD_STANDOFF : 0) : undefined,
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
      beside: v.build !== 'full',
    }),
    pod: new Pod({
      enabled: v.build !== 'full',
      style: v.build === 'cradle' ? 'cradle' : 'round',
      shell: v.shell,
      weight_depth: v.weight_depth,
      weight_cap: v.weight_cap,
      base: v.pod_base,
      mount: v.sensor_mount,
      side: v.pod_side,
      fit: podFit,
    }),
    fit: new Fit({ hole: v.fit_hole as number, gap: v.fit_gap as number }),
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
