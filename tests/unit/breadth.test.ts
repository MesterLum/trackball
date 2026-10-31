import { describe, it, expect } from 'vitest';
import {
  autofit,
  createDesign,
  generateParts,
  generatePreviewParts,
  generateViews,
  OPTIONS,
  PRESETS,
} from '../../packages/core/src/index';
import type { Values } from '../../packages/core/src/index';

/** Generate every output for a configuration and check it is well formed. */
function exercise(input: Partial<Values>) {
  const { values } = autofit(input);
  const d = createDesign({ ...values, fn: 24 });
  const scad = [
    ...generateParts(d).map((p) => p.scad),
    ...generatePreviewParts(d).map((p) => p.scad),
    ...Object.values(generateViews(d)),
  ];
  for (const s of scad) expect(s).not.toMatch(/NaN|undefined|Infinity/);
  expect(d.bom().length).toBeGreaterThan(3);
  expect(d.summary().length).toBeGreaterThan(20);
  expect(Array.isArray(d.validate())).toBe(true);
  return d;
}

describe('every choice of every option', () => {
  for (const o of OPTIONS)
    for (const value of o.kind === 'bool' ? [true, false] : o.choices)
      it(`${o.name}=${value}`, () => {
        // Some options only act with a battery or a palm rest present.
        exercise({ battery: '40x25x3', palm: 30, [o.name]: value });
      });
});

describe('combinations', () => {
  const cases: Partial<Values>[] = [
    { cup_shape: 'dome', cup_peak: 'sharp', rim: 0, support: 'ceramic-3', polar: 42, cup_cut: 9 },
    { cup_shape: 'block', support: 'mr84', supports: 4 },
    { cup_shape: 'dome', support: 'btu-7.5', cup_cut: 9 },
    { buttons: 'tiles', switches: 2 },
    { buttons: 'tiles', switches: 6, mcu_place: 'behind' },
    { buttons: 'tiles', switches: 8, tilt: 10, palm: 45, palm_pad: 2 },
    { buttons: 'sides', switch_type: 'mx', keycap_u: 1.5, switches: 2 },
    { buttons: 'left', switch_type: 'micro', switches: 3 },
    { buttons: 'right', switch_type: 'mx', switches: 2, switch_gap: 2 },
    { buttons: 'front', switches: 0 },
    { buttons: 'front', switches: 3, no_mirror: true, tilt: -15, tent: 12 },
    { tilt: 20, tent: -15, palm: 50, palm_attachment: 'anchored', palm_drop: 4 },
    { tilt: -10, tent: 18, palm: 40, palm_attachment: 'fused', palm_corners: 'rounded' },
    { mcu: 'pico-w', mcu_place: 'under', usb: 'back', battery: '50x34x5' },
    { mcu: 'pro-micro', usb: 'left', usb_type: 'micro-usb' },
    { mcu: 'xiao', usb: 'back', usb_type: 'usb-c', mcu_place: 'under' },
    { mcu: 'supermini', battery: '60x40x6', power_switch: 'toggle', power_wall: 'back' },
    { mcu: 'nice-nano', battery: '30x20x4', power_switch: 'rocker', power_wall: 'left', tilt: 12 },
    { sensor_pcb: 'pmw3389-round', header_height: 3, ball: 55 },
    { ball: 25, support: 'btu-4.8', padding: 4, feet: 0, edge_round: 0 },
    { ball: 44, support: 'mr63', supports: 4, cup_round: 0 },
    { wall: 4, floor: 4, feet: 12, fn: 48 },
  ];
  for (const c of cases) it(JSON.stringify(c), () => exercise(c));
  for (const p of PRESETS) it(`preset ${p.key}`, () => exercise(p.values as Partial<Values>));
});

it('reports problems without auto fit', () => {
  // Deliberately tight: tiny padding with a large controller and battery.
  const d = createDesign({ padding: 2, mcu: 'pico', battery: '60x40x6', switches: 3, switch_type: 'mx' });
  expect(d.validate().length).toBeGreaterThan(0);
  expect(d.problems().some((p: any) => Object.keys(p.fix).length)).toBe(true);
});
