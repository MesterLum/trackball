import { describe, it, expect } from 'vitest';
import { autofit, createDesign, MCUS } from '../../packages/core/src/index';
import type { Values } from '../../packages/core/src/index';
import { mcu_point, mcu_pose, tray, usb_cutout } from '../../packages/core/src/geometry/tray';

/** Physical clearance rules carried over from the Python checkpoint tests. */
describe('horizontal MCU in a sloping tray', () => {
  const angles = [
    [0, 0],
    [15, 12],
    [-15, -12],
  ];
  for (const mcu of ['pico', 'rp2040-zero', 'nice-nano'])
    for (const usb of ['right', 'left', 'back'])
      for (const place of ['behind', 'under'])
        for (const [tilt, tent] of angles)
          it(`${mcu} usb=${usb} ${place} tilt=${tilt} tent=${tent}`, () => {
            const d = createDesign({ mcu, usb, mcu_place: place, tilt, tent, padding: 30 });
            const [axis, sign] = usb === 'back' ? [1, 1] : [0, usb === 'left' ? -1 : 1];
            const limit = (axis ? d.back_length : d.half_width) - d.tray.wall;
            const gaps = d.mcu_mount_corners().map((p: number[]) => limit - sign * d.world_to_deck(p)[axis]);
            // The mount stops at the actual wall, not inside it.
            expect(Math.min(...gaps)).toBeCloseTo(0.3, 6);
            // The whole component stack stays below the lid underside.
            const [mx, my, z0] = mcu_pose(d);
            const m = d.tray.mcu;
            const z =
              z0 +
              m.thickness +
              Math.max(m.component_height, d.usb_z_offset + d.usb_height) +
              d.tray.clearance;
            const [sx, sy] = d.mcu_xy_size;
            const top = Math.max(
              ...[-sx / 2, sx / 2].flatMap((x) =>
                [-sy / 2, sy / 2].map((y) => d.world_to_deck([mx + x, my + y, z])[2]),
              ),
            );
            expect(top).toBeLessThanOrEqual(d.z_pcb_face + 1e-5);
          });
});

describe('every board auto-fits every USB wall', () => {
  for (const mcu of Object.keys(MCUS))
    it(mcu, () => {
      for (const usb of ['right', 'left', 'back']) {
        const d = createDesign(autofit({ mcu, usb, tilt: 10, tent: -8 }).values);
        expect(d.validate(), usb).toEqual([]);
        expect(d.mcu_fit_deficit()).toBeLessThanOrEqual(0.01);
      }
    });
});

it('small board connector reaches through the wall', () => {
  const d = createDesign({ mcu: 'rp2040-zero' });
  const [x] = mcu_point(d, d.tray.mcu.length / 2, 0);
  expect(d.inner_half_width - x).toBeCloseTo(0.3, 6);
  const [nose] = mcu_point(d, d.tray.mcu.length / 2 + d.tray.mcu.usb_overhang, 0);
  expect(nose).toBeGreaterThan(d.inner_half_width);
});

describe('USB connector defaults and overrides', () => {
  const defaults: Record<string, string> = {
    pico: 'micro-usb',
    'pico-w': 'micro-usb',
    pico2: 'micro-usb',
    'pro-micro': 'micro-usb',
    'rp2040-zero': 'usb-c',
    xiao: 'usb-c',
    'nice-nano': 'usb-c',
    supermini: 'usb-c',
  };
  for (const [mcu, kind] of Object.entries(defaults))
    it(mcu, () => {
      expect(createDesign({ mcu }).usb_kind).toBe(kind);
      for (const usb_type of ['micro-usb', 'usb-c']) {
        const d = createDesign({ mcu, usb_type });
        expect(d.usb_kind).toBe(usb_type);
        expect(String(usb_cutout(d))).toContain('linear_extrude');
      }
      expect(String(tray(createDesign({ mcu, usb_type: 'micro-usb' })))).not.toBe(
        String(tray(createDesign({ mcu, usb_type: 'usb-c' }))),
      );
    });
});

it('keeps verified board outlines', () => {
  expect([MCUS.xiao.length, MCUS.xiao.width]).toEqual([21, 17.8]);
  expect([MCUS['pro-micro'].length, MCUS['pro-micro'].width]).toEqual([33.02, 17.78]);
});

it('left USB rotates asymmetric board points like the preview', () => {
  const d = createDesign({ usb: 'left' });
  const [x, y] = mcu_pose(d);
  expect(mcu_point(d, 13, -3.5)).toEqual([x - 13, y + 3.5]);
});

describe('palm-rest attachment', () => {
  for (const [mode, gap] of [
    ['separate', 0.5],
    ['anchored', 0.5],
    ['fused', 0],
  ] as const)
    it(`${mode} follows an asymmetric front edge`, () => {
      const d = createDesign({
        palm: 40,
        palm_attachment: mode,
        no_mirror: true,
        mcu: 'rp2040-zero',
        mcu_place: 'under',
      });
      const [y0, y1] = d.palm_y_range;
      expect(y1).toBeCloseTo(-d.front_length - gap, 6);
      expect(y1 - y0).toBeCloseTo(40, 6);
      expect(d.front_length).not.toBe(d.back_length);
    });

  it('auto fit adds enough material for the anchor', () => {
    const { values, changes } = autofit({ palm: 10, palm_attachment: 'anchored', floor: 1.5 });
    expect(values.palm).toBe(18);
    expect(values.floor).toBe(2.5);
    expect(createDesign(values).validate()).toEqual([]);
    expect(changes.map((c) => c.option)).toEqual(expect.arrayContaining(['palm', 'floor']));
  });
});

describe('rubber feet', () => {
  const feet = (values: Partial<Values>) => {
    const d = createDesign(values);
    return [d.feet_xy().length, d.palm_feet_xy().length];
  };
  it('a fused palm rest is one part with four corner feet', () => {
    expect(feet({ palm: 40, palm_attachment: 'fused' })).toEqual([2, 2]);
    const d = createDesign({ palm: 40, palm_attachment: 'fused' });
    const [, y0] = d.palm_feet_xy()[0];
    const [, y1] = d.feet_xy()[0];
    // Back pair under the tray, front pair under the far end of the rest.
    expect(y1).toBeGreaterThan(0);
    expect(y0).toBeLessThan(d.palm_y_range[0] + d.tray.feet_inset + 1);
  });
  it('separate and anchored rests keep their own feet', () => {
    for (const palm_attachment of ['separate', 'anchored'])
      expect(feet({ palm: 40, palm_attachment })).toEqual([4, 4]);
    expect(feet({})).toEqual([4, 0]);
  });
});
