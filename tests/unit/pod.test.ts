import { describe, it, expect } from 'vitest';
import {
  autofit,
  coerce,
  createDesign,
  generateParts,
  optionApplies,
  OPTIONS,
} from '../../packages/core/src/index';
import type { Values } from '../../packages/core/src/index';
import {
  POD_SCREW,
  POD_WALL,
  WASHERS,
  pod_outline,
  washer_mass,
} from '../../packages/core/src/calculations/pod';

const POD: Values = {
  build: 'pod',
  mcu: 'xiao',
  usb: 'back',
  padding: 2,
  skirt: 8,
  rim: 3,
  header_height: 3,
};
const pod = (extra: Values = {}) => createDesign(autofit({ ...POD, ...extra }).values);

describe('compact pod settings', () => {
  it('drops buttons, palm rest, tilt and battery', () => {
    const v = coerce({ build: 'pod', switches: 4, palm: 40, tilt: 10, tent: 5, battery: '30x20x5' });
    expect([v.switches, v.palm, v.tilt, v.tent, v.battery, v.mcu_place]).toEqual([0, 0, 0, 0, '', 'under']);
  });
  it('shows only the settings that apply', () => {
    const shown = (v: Values) => OPTIONS.filter((o) => optionApplies(o.name, v)).map((o) => o.name);
    const full = shown({ build: 'full' }),
      compact = shown({ build: 'pod' });
    expect(full).not.toContain('shell');
    expect(full).not.toContain('weights');
    expect(compact).toEqual(expect.arrayContaining(['shell', 'weights', 'ball', 'mcu', 'sensor_adjust']));
    for (const name of ['switches', 'buttons', 'palm', 'tilt', 'mcu_place', 'battery', 'cup_shape'])
      expect(compact).not.toContain(name);
  });
  it('a full build is unchanged', () => {
    expect(createDesign({}).is_pod).toBe(false);
    expect(createDesign({}).ballast).toBeNull();
  });
});

describe('compact pod geometry', () => {
  for (const ball of [20, 25, 34, 44, 55, 60])
    it(`fits a ${ball} mm ball`, () => {
      const d = pod({ ball });
      expect(d.validate()).toEqual([]);
      // The body hugs the cup: no wider than the cup or sensor board plus the walls.
      const [w, l] = d.footprint;
      expect(w).toBeCloseTo(l, 6);
      expect(w).toBeLessThanOrEqual(Math.max(d.skirt_dia, d.pcb.diameter + 2 * d.tray.wall) + 2 * 6 + 1e-6);
    });

  it('exports a shell instead of a cup', () => {
    const names = generateParts(pod()).map((p) => p.name);
    expect(names).toContain('shell');
    expect(names).not.toContain('cup');
    expect(generateParts(createDesign({})).map((p) => p.name)).toContain('cup');
  });

  it('shell narrows from the plate to the rim', () => {
    const d = pod();
    const bottom = pod_outline(d, 0),
      top = pod_outline(d, 1);
    expect(bottom.w).toBeCloseTo(d.footprint[0], 6);
    expect(top.w / 2).toBeCloseTo(d.cavity_r + d.cup.wall + 1.5, 6);
    // Fully round at the rim.
    expect(top.r).toBeCloseTo(top.w / 2, 6);
  });

  it('clear shells get thicker walls', () => {
    expect(pod({ shell: 'clear' }).pod.wall).toBe(POD_WALL.clear);
    expect(pod().pod.wall).toBe(POD_WALL.solid);
  });

  it('feet cover the screw heads, inside the rounded corners', () => {
    const d = pod();
    const feet = d.feet_xy(),
      screws = d.lid_screw_points();
    expect(feet).toHaveLength(4);
    feet.forEach(([x, y]: number[], i: number) => {
      expect(x).toBeCloseTo(screws[i][0], 6);
      expect(y).toBeCloseTo(screws[i][1], 6);
    });
    const corner = d.half_width - d.carrier.corner_r,
      [x, y] = feet[3];
    expect(Math.hypot(Math.abs(x) - corner, Math.abs(y) - corner) + d.tray.feet_dia / 2).toBeLessThan(
      d.carrier.corner_r,
    );
  });
});

describe('pod weights', () => {
  it('uses the largest washer that fits, stacked', () => {
    const d = pod({ weights: 2 });
    const b = d.ballast!;
    expect(b.count).toBe(2);
    expect(b.depth).toBeCloseTo(2 * b.washer.t + 0.2, 6);
    expect(b.mass).toBeCloseTo(2 * washer_mass(b.washer), 6);
    const bigger = WASHERS.find((w) => w.od > b.washer.od);
    // The next size up would cut into the walls or the feet over the corner screws.
    const [x, y] = d.lid_screw_points()[3];
    const room = Math.min(
      d.half_width - d.tray.wall - 1,
      Math.hypot(x, y) - Math.max(d.tray.feet_dia, d.carrier.screw_head_dia) / 2 - 1,
    );
    if (bigger) expect(bigger.od + 0.6).toBeGreaterThan(2 * room);
  });
  it('lowers the floor by the pocket depth', () => {
    const none = pod({ weights: 0 }),
      one = pod({ weights: 1 });
    expect(none.ballast).toBeNull();
    expect(none.z_floor_bottom - one.z_floor_bottom).toBeCloseTo(one.ballast!.depth, 6);
    expect(one.height_breakdown()).toContain('weights');
  });
  it('bigger balls take bigger or equal washers', () => {
    const sizes = [25, 34, 44, 55].map((ball) => pod({ ball }).ballast!.washer.od);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
  });
  it('lists washers and the screws from below', () => {
    const d = pod();
    const items = d.bom().map((i: { item: string }) => i.item);
    expect(items.some((i: string) => i.startsWith('Steel washers'))).toBe(true);
    expect(items).toContain(`M3x${d.pod_screw_length} thread-forming screws`);
    const grip = d.z_pcb_face - (d.z_floor_bottom + d.carrier.screw_head_depth);
    expect(d.pod_screw_length).toBeLessThanOrEqual(grip + POD_SCREW.pilot_depth);
    expect(d.pod_screw_length).toBeGreaterThan(grip);
  });
});
