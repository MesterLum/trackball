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
  pod_levels,
  pod_post_points,
  inside_squircle,
  POD_FIT,
  POD_SIDE_N,
  CRADLE,
  POD_STANDOFF,
  POD_STANDOFF_SINK,
  cradle_shape,
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
  it('drops buttons, palm rest and tilt, keeps the battery', () => {
    const v = coerce({ build: 'pod', switches: 4, palm: 40, tilt: 10, tent: 5, battery: '30x20x5' });
    expect([v.switches, v.palm, v.tilt, v.tent, v.battery, v.mcu_place]).toEqual([
      0,
      0,
      0,
      0,
      '30x20x5',
      'under',
    ]);
  });
  it('shows only the settings that apply', () => {
    const shown = (v: Values) => OPTIONS.filter((o) => optionApplies(o.name, v)).map((o) => o.name);
    const full = shown({ build: 'full' }),
      compact = shown({ build: 'pod' });
    expect(full).not.toContain('shell');
    expect(full).not.toContain('weights');
    expect(compact).toEqual(expect.arrayContaining(['shell', 'weights', 'ball', 'mcu', 'sensor_adjust']));
    for (const name of ['switches', 'buttons', 'palm', 'tilt', 'mcu_place', 'cup_shape'])
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
      // The body hugs the cup, or for small balls the sensor board with the posts beside it.
      const [w, l] = d.footprint;
      expect(w).toBeCloseTo(l, 6);
      expect(w).toBeLessThanOrEqual(Math.max(d.skirt_dia + 12, d.pcb.diameter + 2 * (d.tray.post_dia + 6)));
    });

  it('exports a shell instead of a cup', () => {
    const names = generateParts(pod()).map((p) => p.name);
    expect(names).toContain('shell');
    expect(names).not.toContain('cup');
    expect(generateParts(createDesign({})).map((p) => p.name)).toContain('cup');
  });

  it('shell runs from the desk to the rim, round at the top', () => {
    const d = pod();
    const levels = pod_levels(d),
      top = levels[levels.length - 1];
    expect(levels[0].z).toBeCloseTo(d.z_floor_bottom, 6);
    expect(levels[1].a).toBeCloseTo(d.footprint[0] / 2, 6);
    expect(top.z).toBeCloseTo(-d.cup.rim_below_center, 6);
    expect(top.a).toBeCloseTo(d.cavity_r + d.cup.wall + 1.5, 6);
    expect(top.n).toBe(2);
  });

  it('posts and feet stay inside the shell and clear the sensor board', () => {
    for (const ball of [20, 34, 55]) {
      const d = pod({ ball });
      const a = d.footprint[0] / 2 - d.pod.wall - POD_FIT;
      const r = Math.max(d.tray.post_dia, d.tray.feet_dia) / 2;
      for (const [x, y] of pod_post_points(d)) {
        expect(
          inside_squircle(Math.abs(x) + r / Math.SQRT2, Math.abs(y) + r / Math.SQRT2, a, a, POD_SIDE_N),
        ).toBe(true);
        expect(Math.hypot(x, y) - d.post_r).toBeGreaterThanOrEqual(d.pcb.r + 0.5);
      }
    }
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

describe('cradle pod', () => {
  const CRADLE_POD: Values = { ...POD, build: 'cradle', padding: 6, rim: 1 };
  const cradle = (extra: Values = {}) => createDesign(autofit({ ...CRADLE_POD, ...extra }).values);

  for (const ball of [20, 34, 44, 60])
    it(`fits a ${ball} mm ball`, () => {
      expect(cradle({ ball }).validate()).toEqual([]);
    });

  it('a round cup with a flat rim rises from the base, notched in front', () => {
    const d = cradle(),
      c = cradle_shape(d);
    expect(c.rim).toBeCloseTo(-1, 6);
    expect(c.cup_r).toBeCloseTo(d.cavity_r + d.cup.wall + 3, 6);
    // The fillet stays on the base's flat top.
    expect(c.cup_r + c.fillet).toBeLessThanOrEqual(d.half_width - 4 - 0.5 + 1e-9);
    // The notch dips below the rim but stops above the base, which clears the plates inside.
    expect(c.notch_bottom).toBeLessThan(c.rim);
    expect(c.notch_bottom).toBeGreaterThan(c.edge);
    expect(c.edge - d.pod.wall).toBeGreaterThan(d.z_carrier_top);
    expect(c.seam).toBeGreaterThan(d.z_floor_top);
  });

  it('offers a walled base or the shell down to the desk, with a side design', () => {
    const shown = (v: Values) => OPTIONS.filter((o) => optionApplies(o.name, v)).map((o) => o.name);
    expect(shown({ build: 'cradle' })).toEqual(expect.arrayContaining(['pod_base', 'pod_side']));
    expect(shown({ build: 'pod' })).not.toContain('pod_base');
    const walled = cradle(),
      covered = cradle({ pod_base: 'covered' });
    expect(walled.pod.walled).toBe(true);
    expect(covered.pod.walled).toBe(false);
    expect(cradle_shape(covered).seam).toBeCloseTo(covered.z_floor_bottom, 6);
    // Covered: the base is a flat plate and the side design is cut into the shell instead.
    const parts = (d: any) => Object.fromEntries(generateParts(d).map((p) => [p.name, p.scad]));
    const grooves = parts(cradle({ pod_base: 'covered', pod_side: 'grooves' })),
      plain = parts(cradle({ pod_base: 'covered', pod_side: 'none' }));
    expect(grooves.shell.length).toBeGreaterThan(plain.shell.length);
    expect(grooves.tray).toEqual(plain.tray);
    const banded = parts(cradle({ pod_side: 'band' })),
      bare = parts(cradle({ pod_side: 'none' }));
    expect(banded.tray.length).toBeGreaterThan(bare.tray.length);
    expect(banded.shell).toEqual(bare.shell);
  });

  it('keeps the cup in proportion with the body for small balls', () => {
    const small = cradle({ ball: 20 }),
      large = cradle({ ball: 44 });
    const cs = cradle_shape(small),
      cl = cradle_shape(large);
    const half = (d: any) => Math.min(d.half_width, d.half_length);
    // A small ball's body is set by the sensor board; its cup follows the body, with a bevel down
    // into the ball, while a large ball's cup follows the ball.
    expect(cs.cup_r).toBeCloseTo(CRADLE.cup_share * half(small), 6);
    expect(cs.funnel).toBeGreaterThan(0);
    expect(cl.cup_r).toBeCloseTo(large.cavity_r + large.cup.wall + 3, 6);
    expect(cl.funnel).toBe(0);
    expect(cs.cup_r + cs.fillet).toBeLessThanOrEqual(half(small) - CRADLE.edge);
    // Every cup rises a minimum height above the base: a small ball's rim moves above its middle.
    for (const d of [small, large]) {
      const c = cradle_shape(d);
      expect(c.rim - c.edge).toBeGreaterThanOrEqual(CRADLE.min_cup - 1e-9);
      expect(c.edge).toBeCloseTo(d.z_carrier_top + d.pod.wall + POD_FIT, 6);
    }
    expect(cs.rim).toBeGreaterThan(0);
    expect(cl.rim).toBeCloseTo(-1, 6);
  });

  it('a walled base closes the electronics bay up to the seam under the sensor plate', () => {
    const d = cradle(),
      c = cradle_shape(d);
    expect(c.seam).toBeCloseTo(d.z_pcb_face - 1, 6);
    // The controller stack and the sensor below its plate stay inside the walled base.
    expect(d.z_floor_top + d.mcu_stack).toBeLessThanOrEqual(c.seam + 1);
    const base = generateParts(d).find((p) => p.name === 'tray')!.scad;
    // Built from scaled extrusions, never one big hull; the recessed band leaves the wall solid.
    expect(base).toContain('scale=[');
    expect(CRADLE.band_depth).toBeLessThan(d.pod.wall - 1);
    expect(CRADLE.band_from).toBeLessThan(CRADLE.band_to);
  });

  it('keeps the front notch between two ball supports', () => {
    for (const supports of [3, 4]) {
      const d = cradle({ supports }),
        c = cradle_shape(d);
      const step = 360 / supports;
      const angles = Array.from({ length: supports }, (_, i) => (d.cup.azimuth0 + i * step) % 360);
      // Nearest support to the front (270°) is half a step away, outside the notch's angle.
      const nearest = Math.min(...angles.map((a) => Math.abs(((a - 270 + 540) % 360) - 180)));
      expect(nearest).toBeCloseTo(step / 2, 6);
      const reach = (d.ball.r + 1.6) * Math.sin((d.cup.support_polar_deg * Math.PI) / 180);
      expect(reach * Math.sin((nearest * Math.PI) / 180)).toBeGreaterThan(c.notch_r + 3.75);
    }
  });

  it('exports a shell instead of a cup', () => {
    const d = cradle();
    expect(d.pod.cradle).toBe(true);
    const names = generateParts(d).map((p) => p.name);
    expect(names).toContain('shell');
    expect(names).not.toContain('cup');
    expect(generateParts(d).find((p) => p.name === 'shell')!.scad).toContain('rotate_extrude');
  });
});

describe('pod electronics bay', () => {
  it('keeps boards low: flat without holes, short standoffs with holes', () => {
    const flat = createDesign(autofit({ ...POD, mcu: 'xiao' }).values),
      held = createDesign(autofit({ ...POD, mcu: 'pico' }).values);
    expect(flat.tray.standoff_h).toBe(0);
    expect(held.tray.standoff_h).toBe(POD_STANDOFF);
    expect(createDesign({ mcu: 'pico' }).tray.standoff_h).toBe(3);
    // The screw holes of the short standoffs continue into the floor.
    const tray = generateParts(held).find((p) => p.name === 'tray')!.scad;
    expect(tray).toContain(
      `h=${(held.mcu_standoff_h + POD_STANDOFF_SINK + 1).toFixed(1).replace(/\.0$/, '')}`,
    );
  });
});

describe('pod battery', () => {
  const WIRELESS: Values = { ...POD, build: 'cradle', padding: 6, rim: 1, battery: '30x20x5' };
  const fitted = (extra: Values = {}) => autofit({ ...WIRELESS, ...extra });

  it('lies beside the controller without stacking under it', () => {
    const d = createDesign(fitted().values),
      bare = createDesign(fitted({ battery: '' }).values);
    expect(d.validate()).toEqual([]);
    expect(d.battery_beside).toBe(true);
    expect(d.battery.extra_height).toBe(0);
    expect(d.mcu_standoff_h).toBe(bare.mcu_standoff_h);
    // In front of the controller, inside the shell and clear of the posts.
    const front = Math.min(...d.mcu_mount_corners().map((p: number[]) => p[1]));
    expect(d.battery_center()[1] + d.battery.outer[1] / 2).toBeLessThanOrEqual(front - 1 + 1e-6);
    expect(d.pod_battery_fits()).toBe(true);
    // Only as much taller as the battery is over the controller.
    expect(bare.z_floor_top - d.z_floor_top).toBeCloseTo(
      Math.max(d.battery.stack + d.tray.clearance - d.mcu_stack, 0),
      6,
    );
    expect(d.height_breakdown()).toContain('MCU and battery under');
  });

  it('asks for room when the battery does not fit', () => {
    const { values, changes } = fitted({ battery: '30x30x5' });
    expect(changes.map((c) => c.option)).toContain('padding');
    expect(createDesign(values).validate()).toEqual([]);
    const tight = createDesign({ ...values, padding: 2 } as Values);
    expect(tight.validate().some((m: string) => m.includes('does not fit beside the controller'))).toBe(true);
  });

  for (const pod_base of ['walled', 'covered'])
    it(`places a power switch through the ${pod_base} base`, () => {
      const d = createDesign(fitted({ pod_base }).values);
      const p = d.power_switch_placement();
      expect(p && 'u' in p).toBe(true);
      const parts = Object.fromEntries(generateParts(d).map((x) => [x.name, x.scad]));
      const plain = Object.fromEntries(
        generateParts(createDesign(fitted({ pod_base, power_switch: 'none' }).values)).map((x) => [
          x.name,
          x.scad,
        ]),
      );
      // Without a walled base the switch opening is cut through the shell as well.
      expect(parts.shell === plain.shell).toBe(pod_base === 'walled');
    });
});
