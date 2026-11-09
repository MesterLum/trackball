export {
  makeDesign as createDesign,
  autofit,
  coerce,
  defaults,
  OPTIONS,
  BY_NAME,
  TRANSLATED_CHOICES,
  optionApplies,
} from './config/options.js';
export type { Values, Option, Adjustment } from './config/options.js';
export { Design, MCUS, SENSOR_PCBS } from './calculations/design.js';
export { POWER_SWITCHES } from './calculations/power.js';
export { setLanguage, _ as translate } from './i18n.js';
export { Shape } from './scad/index.js';
import presets from './config/presets.json' with { type: 'json' };
export const PRESETS = presets;
import { Design } from './calculations/design.js';
import { Shape } from './scad/index.js';
import { cup } from './geometry/cup.js';
import { carrier } from './geometry/carrier.js';
import { tray } from './geometry/tray.js';
import { palmrest, palm_key } from './geometry/palmrest.js';
import {
  assembly,
  section,
  cup_placement,
  carrier_placement,
  tray_placement,
  pcb_preview,
  switches_preview,
} from './geometry/assembly.js';
import { mcu_preview, battery_preview } from './geometry/tray.js';
import { power_switch_preview, reset_switch_preview } from './geometry/power.js';
import { mcu_clamp } from './geometry/clamp.js';
import { weight_cap } from './geometry/weights.js';
import { fit_test } from './geometry/fit_test.js';
export type PrintablePartName =
  'cup' | 'shell' | 'carrier' | 'tray' | 'weight_cap' | 'palmrest' | 'palm_key' | 'mcu_clamp';
export type PartName =
  | PrintablePartName
  | 'fit_test'
  | 'mcu'
  | 'sensor'
  | 'switches'
  | 'battery'
  | 'power_switch'
  | 'reset_switch';
export interface ModelPart {
  name: PartName;
  scad: string;
  frame: 'deck' | 'world';
  color: string;
  lift: number;
}
// A pod's cup grows into the whole top shell, so it is exported under that name.
const builders = {
  cup: (d: Design) => (d.is_pod ? null : cup(d)),
  shell: (d: Design) => (d.is_pod ? cup(d) : null),
  // A shell that holds the sensor board leaves no sensor plate.
  carrier: (d: Design) => (d.pod.shell_mount ? null : carrier(d)),
  tray,
  weight_cap,
  palmrest,
  palm_key,
  mcu_clamp,
};
const styles: Record<PrintablePartName, [ModelPart['frame'], string, number]> = {
  cup: ['deck', '#4682b4', 2],
  shell: ['deck', '#7fa7c4', 2],
  carrier: ['deck', '#daa520', 1],
  tray: ['world', '#808080', 0],
  // Drops below the base when the view is exploded.
  weight_cap: ['world', '#9aa0a8', -1],
  palmrest: ['world', '#cd853f', 0],
  palm_key: ['world', '#008080', 0],
  mcu_clamp: ['world', '#5b6ee1', 0],
};
export function generateParts(design: Design): ModelPart[] {
  return (Object.entries(builders) as [PrintablePartName, (d: Design) => Shape | null][]).flatMap(
    ([name, build]) => {
      const shape = build(design);
      if (!shape) return [];
      const [frame, color, lift] = styles[name];
      return [{ name, scad: `// Trackball configurator — ${name}\n${shape}\n`, frame, color, lift }];
    },
  );
}
/** The fit test for this design's holes and joints, printed before the parts. */
export function generateFitTest(design: Design): ModelPart {
  return {
    name: 'fit_test',
    scad: `// Trackball configurator — fit test\n${fit_test(design)}\n`,
    frame: 'world',
    color: '#9aa0a8',
    lift: 0,
  };
}
/** Assembly references are preview-only; printable exports use generateParts. */
export function generatePreviewParts(design: Design): ModelPart[] {
  const hardware: [PartName, Shape | null, ModelPart['frame'], string][] = [
    ['mcu', mcu_preview(design), 'world', '#2d986c'],
    ['sensor', pcb_preview(design), 'deck', '#376e4b'],
    ['switches', switches_preview(design), 'deck', '#b8bec9'],
    ['battery', battery_preview(design), 'world', '#b6becb'],
    ['power_switch', power_switch_preview(design), 'world', '#3b3f45'],
    ['reset_switch', reset_switch_preview(design), 'world', '#3b3f45'],
  ];
  return [
    ...generateParts(design),
    ...hardware.flatMap(([name, shape, frame, color]) =>
      shape ? [{ name, scad: String(shape), frame, color, lift: 0 }] : [],
    ),
  ];
}
export function generateViews(design: Design): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ assembly, section, cup_placement, carrier_placement, tray_placement }).map(
      ([name, build]) => [name + '.scad', String(build(design)) + '\n'],
    ),
  );
}
