import { describe, it, expect } from 'vitest';
import reference from '../fixtures/python-dimensions.json';
import { createDesign, autofit, generateParts, defaults, coerce } from '../../packages/core/src/index';
import type { Values } from '../../packages/core/src/index';
function close(actual: any, expected: any): void {
  if (typeof expected === 'number') expect(actual).toBeCloseTo(expected, 7);
  else if (Array.isArray(expected)) {
    expect(actual).toHaveLength(expected.length);
    expected.forEach((v, i) => close(actual[i], v));
  } else expect(actual).toEqual(expected);
}
describe('Python checkpoint dimension parity', () => {
  for (const row of reference)
    it(row.name, () => {
      const fit = autofit(row.input as Partial<Values>);
      // Options added after the checkpoint keep their defaults.
      expect(fit.values).toEqual({ ...defaults(), ...row.values });
      const d = createDesign(fit.values);
      close(d.footprint, row.footprint);
      close(d.z_floor_top, row.floor);
      const [x, y] = d.mcu_center();
      close([x, y, d.z_floor_top + d.mcu_standoff_h], row.mcu);
      close(d.palm_y_range, row.palm);
      close(d.switch_positions(), row.switches);
      expect(d.problems()).toEqual(row.problems);
      expect(d.bom()).toEqual(row.bom);
      if (!d.validate().length) {
        const parts = generateParts(d);
        expect(parts.length).toBeGreaterThanOrEqual(3);
        for (const p of parts) expect(p.scad).not.toMatch(/NaN|undefined|Infinity/);
      }
    });
});
it('validates unknown fields and ranges', () => {
  expect(() => coerce({ ball: 3 })).toThrow();
  expect(() => coerce({ unknown: 1 })).toThrow();
  expect(defaults().mcu).toBe('pico');
});
it('exports only printable attachment parts', () => {
  for (const mode of ['separate', 'anchored', 'fused']) {
    const names = generateParts(createDesign({ palm: 40, palm_attachment: mode })).map((p) => p.name);
    expect(names.includes('palmrest')).toBe(mode !== 'fused');
    expect(names.includes('palm_key')).toBe(mode === 'anchored');
  }
});
