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
  pod_levels,
  pod_post_points,
  inside_squircle,
  POD_FIT,
  POD_SIDE_N,
  POD_FEET,
  POD_CUP_CEILING,
  WEIGHT_CAP,
  CRADLE,
  POD_STANDOFF,
  POD_STANDOFF_SINK,
  cradle_shape,
  washer_mass,
} from '../../packages/core/src/calculations/pod';
import { SENSOR_PAD_DIA } from '../../packages/core/src/geometry/carrier';
import { SHELL_POST_INSERT_DEPTH } from '../../packages/core/src/geometry/cup';
import { POD_FLAT, wall_frame, type PowerSwitchPlacement } from '../../packages/core/src/calculations/power';

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
    expect(full).not.toContain('weight_depth');
    expect(compact).toEqual(
      expect.arrayContaining(['shell', 'weight_depth', 'weight_cap', 'ball', 'mcu', 'sensor_adjust']),
    );
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
  it('opens a chamber under the base that grows the pod by its height', () => {
    const none = pod({ weight_depth: 0 });
    expect(none.ballast).toBeNull();
    expect(generateParts(none).map((p) => p.name)).not.toContain('weight_cap');
    for (const weight_cap of ['thread', 'bayonet', 'none']) {
      const d = pod({ weight_depth: 10, weight_cap });
      const b = d.ballast!;
      expect(b.cap).toBe(weight_cap);
      expect(b.depth).toBe(10);
      expect(b.seat).toBe(weight_cap === 'none' ? 0 : WEIGHT_CAP.bottom);
      // The cup sinks up into the floor, leaving a thin cover over it.
      expect(none.z_floor_bottom - d.z_floor_bottom).toBeCloseTo(b.total + POD_CUP_CEILING - d.tray.floor, 6);
      expect(d.z_floor_top - (d.z_floor_bottom + b.total)).toBeCloseTo(POD_CUP_CEILING, 6);
      expect(d.height_breakdown()).toContain('weights');
      // The chamber opens through the closure, inside the outermost cut.
      expect(b.dia / 2).toBeLessThanOrEqual(b.outer_r);
      if (b.washer) {
        expect(b.washer.od + 0.6).toBeLessThanOrEqual(b.dia + 1e-9);
        expect(b.count * b.washer.t).toBeLessThanOrEqual(b.depth);
        expect(b.mass).toBeCloseTo(b.count * washer_mass(b.washer), 6);
      }
      const names = generateParts(d).map((p) => p.name);
      expect(names.includes('weight_cap')).toBe(weight_cap !== 'none');
    }
  });
  it('keeps the floor thick enough for standoff screws over the cup', () => {
    const d = pod({ mcu: 'pico', weight_depth: 6 }),
      b = d.ballast!;
    expect(d.z_floor_top - (d.z_floor_bottom + b.total)).toBeCloseTo(POD_STANDOFF_SINK + 0.8, 6);
  });
  it('cuts the matching closure into the base', () => {
    const parts = (weight_cap: string) =>
      Object.fromEntries(generateParts(pod({ weight_cap })).map((p) => [p.name, p.scad]));
    const thread = parts('thread'),
      bayonet = parts('bayonet');
    // The thread is a polyhedron helix in both the cap and the base; the bayonet uses swept sectors.
    expect(thread.weight_cap).toContain('polyhedron');
    expect(thread.tray).toContain('polyhedron');
    expect(bayonet.tray).toContain('rotate_extrude(angle=');
    expect(bayonet.weight_cap).toContain('rotate_extrude(angle=');
  });
  it('bigger balls take bigger or equal washers', () => {
    const sizes = [25, 34, 44, 55].map((ball) => pod({ ball }).ballast!.washer!.od);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
  });
  it('sinks the feet deeper and asks for feet wide enough to cover the screw pockets', () => {
    expect(pod().tray.feet_depth).toBe(POD_FEET.depth);
    expect(createDesign({}).tray.feet_depth).toBe(1);
    const small = createDesign({ ...POD, feet: 6 });
    expect(small.validate().some((m: string) => m.includes('do not cover the screw pockets'))).toBe(true);
    expect(POD_FEET.min_dia).toBeGreaterThan(POD_SCREW.head_dia);
    const { values, changes } = autofit({ ...POD, feet: 6 });
    expect(changes).toContainEqual({ option: 'feet', from: 6, to: POD_FEET.min_dia });
    expect(createDesign(values).validate()).toEqual([]);
    expect(
      createDesign({ ...POD, feet: 0 })
        .validate()
        .some((m: string) => m.includes('screw pockets')),
    ).toBe(false);
  });

  it('uses only short screws: M3x8 through the post top into a nut on the plate or the shell', () => {
    for (const d of [
      pod(),
      pod({ build: 'cradle', sensor_mount: 'plate' }),
      pod({ build: 'cradle' }),
      pod({ build: 'cradle', ball: 55 }),
    ]) {
      const items = d.bom().map((i: { item: string }) => i.item);
      expect(items.some((i: string) => i.startsWith('Steel washers'))).toBe(true);
      expect(items.some((i: string) => /thread-forming|M3x(1[0-9]|[2-9][0-9])/.test(i))).toBe(false);
      if (d.pod.shell_mount) {
        // Post top, then an insert in the shell: 5 mm of thread, inside its hole.
        expect(items).not.toContain('M3 hex nuts');
        expect(d.pod_screw_length - POD_SCREW.top).toBeCloseTo(5, 6);
        expect(d.pod_screw_length - POD_SCREW.top).toBeLessThan(SHELL_POST_INSERT_DEPTH);
        expect(SHELL_POST_INSERT_DEPTH).toBeLessThan(cradle_shape(d).edge - d.z_pcb_face - 1);
      } else {
        expect(items).toContain('M3 hex nuts');
        // Post top + plate below the nut pocket + the nut: the M3x8 ends flush with the plate top.
        const grip = POD_SCREW.top + d.carrier.thickness - POD_SCREW.nut_depth + 2.4;
        expect(d.pod_screw_length).toBeGreaterThanOrEqual(grip);
        expect(d.pod_screw_length).toBeLessThanOrEqual(POD_SCREW.top + d.carrier.thickness + 0.3);
      }
      // The head pocket leaves a wall around it in the post.
      expect((d.tray.post_dia - POD_SCREW.head_dia) / 2).toBeGreaterThanOrEqual(1.2);
    }
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

  it('hides the shell screws inside the cup, clear of the supports and the sensor screws', () => {
    for (const ball of [20, 25, 34, 44, 60])
      for (const skirt of [8, 14, 30])
        for (const supports of [3, 4]) {
          const d = cradle({ ball, skirt, supports }),
            c = cradle_shape(d);
          const step = 360 / supports;
          const supports_at = Array.from({ length: supports }, (_, i) => d.cup.azimuth0 + i * step);
          for (const [x, y] of d.shell_screw_points()) {
            // Inside the cup, with a wall around the insert.
            expect(Math.hypot(x, y)).toBeLessThanOrEqual(c.cup_r - d.cup.insert_dia / 2 - 1.5 + 1e-9);
            const a = (Math.atan2(y, x) * 180) / Math.PI;
            for (const s of supports_at)
              expect(Math.abs(((a - s + 540) % 360) - 180)).toBeGreaterThanOrEqual(19.9);
            for (const sy of [-1, 1])
              expect(Math.hypot(x, y - (sy * d.pcb.hole_spacing) / 2)).toBeGreaterThan(
                d.carrier.screw_head_dia / 2 + d.carrier.pcb_insert_dia / 2,
              );
          }
        }
    // Other builds keep the classic positions.
    expect(createDesign({}).shell_screw_points()).toHaveLength(4);
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
    // The notch floor covers the insert holes for the shell screws at every size.
    for (const ball of [20, 25, 30, 34, 44, 60]) {
      const d = cradle({ ball });
      expect(cradle_shape(d).notch_bottom).toBeGreaterThanOrEqual(
        d.z_cup_bottom + d.cup.insert_depth + 1.5 - 1e-9,
      );
    }
    expect(cl.rim).toBeCloseTo(-1, 6);
  });

  it('a walled base closes the electronics bay up to the seam under the sensor plate', () => {
    const d = cradle({ sensor_mount: 'plate' }),
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

describe('sensor in the shell', () => {
  const CRADLE_POD: Values = { ...POD, build: 'cradle', padding: 6, rim: 1 };
  const cradle = (extra: Values = {}) => createDesign(autofit({ ...CRADLE_POD, ...extra }).values);

  it('is the default for a walled cradle, and only offered there', () => {
    expect(cradle().pod.shell_mount).toBe(true);
    expect(cradle({ sensor_mount: 'plate' }).pod.shell_mount).toBe(false);
    expect(cradle({ pod_base: 'covered' }).pod.shell_mount).toBe(false);
    expect(pod().pod.shell_mount).toBe(false);
    expect(optionApplies('sensor_mount', coerce({ build: 'cradle' }))).toBe(true);
    for (const v of [{ build: 'cradle', pod_base: 'covered' }, { build: 'pod' }, {}] as Values[])
      expect(optionApplies('sensor_mount', coerce(v))).toBe(false);
  });

  it('ends the shell at the board, so the board seats on its bed face, with no plate', () => {
    const d = cradle();
    expect(cradle_shape(d).seam).toBeCloseTo(d.z_pcb_face, 9);
    expect(d.validate()).toEqual([]);
    const parts = generateParts(d);
    expect(parts.map((p) => p.name)).not.toContain('carrier');
    // The shell takes the board's inserts and solder pads, and an insert over each base post.
    const shell = parts.find((p) => p.name === 'shell')!.scad;
    expect(shell).toContain(`d=${SENSOR_PAD_DIA}`);
    // The same lens distance as on a plate: only the parts that set it change.
    expect(d.sensor_distance).toBeCloseTo(cradle({ sensor_mount: 'plate' }).sensor_distance, 9);
  });

  it('lists inserts and screws for the shell and no nuts', () => {
    const items = (d: ReturnType<typeof cradle>) =>
      d.bom().map((i: { item: string; qty: number }) => [i.item, i.qty]);
    const held = Object.fromEntries(items(cradle())),
      plate = Object.fromEntries(items(cradle({ sensor_mount: 'plate' })));
    expect(held['M3 heat-set inserts (Ø4 x 5 mm)']).toBe(6);
    expect(held['M3x8 screws']).toBe(4);
    expect(held['M3 hex nuts']).toBeUndefined();
    expect(plate['M3x8 screws']).toBe(8);
    expect(plate['M3 hex nuts']).toBe(4);
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
      const p = d.power_switch_placement() as PowerSwitchPlacement;
      expect(p && 'u' in p).toBe(true);
      const parts = Object.fromEntries(generateParts(d).map((x) => [x.name, x.scad]));
      const plain = Object.fromEntries(
        generateParts(createDesign(fitted({ pod_base, power_switch: 'none' }).values)).map((x) => [
          x.name,
          x.scad,
        ]),
      );
      // On the nearly flat middle of the curved side, so the panel and recess never break through.
      const f = wall_frame(d, p.wall);
      const a = d.half_width;
      const half = Math.max(p.type.outside[0], p.type.body[0]) / 2;
      for (const u of [p.u - half, p.u + half]) {
        const along = Math.abs(u - (p.wall === 'right' || p.wall === 'left' ? d.footprint[3] : 0));
        const b = p.wall === 'right' || p.wall === 'left' ? d.half_length : d.half_width;
        expect(a - a * Math.pow(1 - Math.pow(along / b, 4), 0.25)).toBeLessThanOrEqual(POD_FLAT + 1e-6);
      }
      expect(f.span[1] - f.span[0]).toBeGreaterThan(0);
      // Without a walled base the switch opening is cut through the shell as well.
      expect(parts.shell === plain.shell).toBe(pod_base === 'walled');
    });
});

describe('sensor solder relief', () => {
  it('pockets the plate under the board and keeps pads at its screws', () => {
    const plate = (sensor_relief: number, extra: Values = {}) =>
      generateParts(createDesign({ ...extra, sensor_relief })).find((p) => p.name === 'carrier')!.scad;
    expect(createDesign({}).carrier.sensor_relief).toBe(2);
    for (const extra of [{}, { sensor_pcb: 'pmw3389-round' }, POD]) {
      const flat = plate(0, extra),
        relieved = plate(2, extra);
      expect(relieved).not.toEqual(flat);
      // The pads sit at the screw holes, so the board still rests at the designed distance.
      expect(relieved).toContain(`d=${SENSOR_PAD_DIA}`);
    }
    // The board's face stays where it was: the relief only removes plate material behind it.
    expect(createDesign({ sensor_relief: 3 }).z_pcb_face).toBeCloseTo(
      createDesign({ sensor_relief: 0 }).z_pcb_face,
      9,
    );
  });
});

describe('pod sensor plate', () => {
  it('has no BOOT button hole under the shell, while a full build keeps it', () => {
    const plate = (v: Values) =>
      generateParts(createDesign(autofit(v).values)).find((p) => p.name === 'carrier')!.scad;
    // 4 mm holes: the sensor's two insert holes, plus the BOOT hole on a full build.
    const holes = (v: Values) => plate(v).split('d=4,').length - 1;
    expect(holes({ mcu: 'rp2040-zero' })).toBe(3);
    expect(holes({ ...POD, mcu: 'rp2040-zero' })).toBe(2);
  });
});
