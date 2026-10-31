export { makeDesign as createDesign, autofit, coerce, defaults, OPTIONS, BY_NAME } from './config/options.js';
export type { Values, Option, Adjustment } from './config/options.js';
export { Design, MCUS, SENSOR_PCBS } from './calculations/design.js';
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
export type PrintablePartName = 'cup' | 'carrier' | 'tray' | 'palmrest' | 'palm_key';
export type PartName = PrintablePartName | 'mcu' | 'sensor' | 'switches' | 'battery';
export interface ModelPart {
  name: PartName;
  scad: string;
  frame: 'deck' | 'world';
  color: string;
  lift: number;
}
const builders = { cup, carrier, tray, palmrest, palm_key };
const styles: Record<PrintablePartName, [ModelPart['frame'], string, number]> = {
  cup: ['deck', '#4682b4', 2],
  carrier: ['deck', '#daa520', 1],
  tray: ['world', '#808080', 0],
  palmrest: ['world', '#cd853f', 0],
  palm_key: ['world', '#008080', 0],
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
/** Assembly references are preview-only; printable exports use generateParts. */
export function generatePreviewParts(design: Design): ModelPart[] {
  const hardware: [PartName, Shape | null, ModelPart['frame'], string][] = [
    ['mcu', mcu_preview(design), 'world', '#2d986c'],
    ['sensor', pcb_preview(design), 'deck', '#376e4b'],
    ['switches', switches_preview(design), 'deck', '#b8bec9'],
    ['battery', battery_preview(design), 'world', '#b6becb'],
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
