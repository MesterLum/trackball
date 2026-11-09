import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { autofit, createDesign, generateParts, MCUS } from '../../packages/core/src/index';
import type { Values } from '../../packages/core/src/index';
import { tray } from '../../packages/core/src/geometry/tray';
import { CLAMP, clamp_layout, clamp_post_points } from '../../packages/core/src/calculations/clamp';

const holeless = Object.keys(MCUS).filter((name) => !MCUS[name].holes.length);
const names = (values: Partial<Values>) => generateParts(createDesign(values)).map((p) => p.name);

describe('controller clamp', () => {
  it('is a separate part only for boards without mounting holes', () => {
    for (const mcu of holeless) expect(names({ mcu }), mcu).toContain('mcu_clamp');
    expect(names({ mcu: 'pico' })).not.toContain('mcu_clamp');
    expect(names({ mcu: 'xiao', mcu_hold: 'glue' })).not.toContain('mcu_clamp');
  });

  for (const mcu of holeless)
    it(`${mcu}: stays inside the room above the board and preloads the pad`, () => {
      const d = createDesign(autofit({ mcu }).values);
      const l = clamp_layout(d)!;
      const m = d.tray.mcu;
      expect(l.bar_top).toBeLessThanOrEqual(l.board_top + m.component_height + d.tray.clearance);
      // Pad touches the board; the bar arms sit just above the posts until the screws pull them down.
      expect(l.post_top).toBeCloseTo(l.board_top + CLAMP.relief - CLAMP.preload, 6);
      expect(l.pad_half_c * 2).toBeLessThanOrEqual(m.width - 1);
      expect(d.validate()).toEqual([]);
    });

  it('reports a pad wider than the board or past its middle', () => {
    expect(createDesign({ mcu: 'xiao', clamp_width: 17 }).validate().join('\n')).toContain(
      'wider than the xiao',
    );
    expect(createDesign({ mcu: 'xiao', clamp_length: 12 }).validate().join('\n')).toContain(
      'past the middle',
    );
  });

  it('keeps the BOOT button free', () => {
    expect(createDesign(autofit({ mcu: 'rp2040-zero' }).values).validate()).toEqual([]);
    expect(
      createDesign(autofit({ mcu: 'rp2040-zero', clamp_length: 7 }).values)
        .validate()
        .join('\n'),
    ).toContain('BOOT button');
  });

  it('lists two M3 inserts and button-head screws for the clamp', () => {
    const inserts = (mcu: string) =>
      createDesign({ mcu })
        .bom()
        .find((b: any) => b.item === 'M3 heat-set inserts (Ø4 x 5 mm)').qty;
    expect(inserts('nice-nano')).toBe(inserts('pico') + 2);
    const screws = (mcu: string) =>
      createDesign({ mcu })
        .bom()
        .find((b: any) => b.item === 'M3x8 button-head screws');
    expect(screws('nice-nano')?.qty).toBe(2);
    expect(screws('pico')).toBeUndefined();
  });

  it('gives each insert a solid wall and a floor under it, clear of the weight chamber', () => {
    for (const v of [
      { mcu: 'xiao' },
      { mcu: 'rp2040-zero' },
      { build: 'cradle', mcu: 'xiao', usb: 'back', padding: 6, skirt: 8, rim: 1, header_height: 3 },
      { build: 'cradle', mcu: 'rp2040-zero', usb: 'back', padding: 6, skirt: 8, rim: 1, header_height: 3 },
      { build: 'pod', mcu: 'xiao' },
      { build: 'cradle', mcu: 'supermini', weight_cap: 'bayonet' },
    ] as Values[]) {
      const d = createDesign(autofit(v).values);
      expect(d.validate(), JSON.stringify(v)).toEqual([]);
      const l = clamp_layout(d)!;
      // At least 1.5 mm of wall around the insert, and the post clear of the pocket.
      expect((CLAMP.post_dia - CLAMP.insert_dia - d.fit.hole) / 2).toBeGreaterThanOrEqual(1.5 - 1e-9);
      expect(l.post_c - CLAMP.post_dia / 2).toBeGreaterThan(l.post_c - CLAMP.post_offset);
      // The insert hole keeps a floor over the weight chamber.
      const b = d.ballast;
      if (b) {
        const [, , cx, cy] = d.footprint;
        const bottom = l.post_top - CLAMP.insert_depth,
          chamber_top = d.z_floor_bottom + b.total;
        for (const [x, y] of clamp_post_points(d))
          if (Math.hypot(x - cx, y - cy) < b.outer_r + CLAMP.insert_dia / 2)
            expect(bottom - chamber_top, JSON.stringify(v)).toBeGreaterThanOrEqual(CLAMP.insert_floor - 1e-9);
      }
      // Under the sensor board (a pod's controller), a button head on the bar stays below it.
      const sensor_bottom = d.z_pcb_face - d.pcb.thickness - d.pcb.header_height;
      if (clamp_post_points(d).some(([x, y]) => Math.hypot(x, y) < d.pcb.r + CLAMP.post_dia / 2))
        expect(l.bar_top + CLAMP.head_h, JSON.stringify(v)).toBeLessThan(sensor_bottom);
    }
  });
});

const exec = promisify(execFile);
const runtime = resolve('.cache/openscad-node/openscad.js');
async function volume(scad: string) {
  const dir = await mkdtemp(join(tmpdir(), 'trackball-clamp-'));
  try {
    await writeFile(join(dir, 'm.scad'), scad);
    await exec(
      process.execPath,
      [
        runtime,
        join(dir, 'm.scad'),
        '-o',
        join(dir, 'm.stl'),
        '--backend=Manifold',
        '--export-format=binstl',
      ],
      { timeout: 120000 },
    ).catch((e) => {
      // An empty result (no overlap) is not an error for an intersection.
      if (!String(e.stderr).includes('Current top level object is empty')) throw e;
    });
    const bytes = await readFile(join(dir, 'm.stl')).catch(() => null);
    if (!bytes || bytes.byteLength < 84) return 0;
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let v = 0;
    for (let i = 0; i < data.getUint32(80, true); i++) {
      const p = (k: number, a: number) => data.getFloat32(84 + i * 50 + 12 + k * 12 + a * 4, true);
      v +=
        (p(0, 0) * (p(1, 1) * p(2, 2) - p(1, 2) * p(2, 1)) +
          p(0, 1) * (p(1, 2) * p(2, 0) - p(1, 0) * p(2, 2)) +
          p(0, 2) * (p(1, 0) * p(2, 1) - p(1, 1) * p(2, 0))) /
        6;
    }
    return Math.abs(v);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

it('renders a clamp that does not collide with the tray', async () => {
  for (const values of [
    { mcu: 'xiao' },
    { mcu: 'nice-nano', usb: 'back', tilt: 10 },
    { mcu: 'rp2040-zero', mcu_place: 'under' },
  ]) {
    const parts = generateParts(createDesign({ ...autofit(values).values, fn: 32 }));
    const body = (name: string) =>
      parts
        .find((p) => p.name === name)!
        .scad.split('\n')
        .slice(1)
        .join('\n');
    expect(await volume(body('mcu_clamp')), JSON.stringify(values)).toBeGreaterThan(20);
    expect(
      await volume(`intersection(){\n${body('tray')}\n${body('mcu_clamp')}\n}`),
      JSON.stringify(values),
    ).toBeLessThan(0.01);
  }
}, 240000);

describe('parts on the back of a pocketed board', () => {
  it('seats the RP2040-Zero on a ledge over a recess for its chip', () => {
    const full = createDesign({ mcu: 'rp2040-zero' }),
      pod = createDesign({ build: 'cradle', mcu: 'rp2040-zero' });
    expect(full.mcu_under_relief).toBeCloseTo(1.85);
    // A full build's 3 mm seat already clears it; a pod's flat bay rises just enough.
    expect(full.mcu_standoff_h).toBe(3);
    expect(pod.mcu_standoff_h).toBeCloseTo(1.85);
  });
  it('leaves boards with a flat back or mounting holes as they were', () => {
    expect(createDesign({ build: 'cradle', mcu: 'xiao' }).mcu_standoff_h).toBe(0);
    expect(createDesign({ mcu: 'pico' }).mcu_under_relief).toBe(0);
  });
  it('keeps the pocket corners clear of the first pin', () => {
    const corner = (mcu: string) => createDesign({ mcu }).mcu_corner;
    expect(corner('rp2040-zero')).toBeCloseTo(0.6);
    expect(corner('xiao')).toBeCloseTo(1.88);
    expect(corner('nice-nano')).toBeCloseTo(1.53);
  });
  it('opens the pocket sides for wires on the edge pins', () => {
    for (const mcu of ['rp2040-zero', 'xiao']) {
      const d = createDesign({ build: 'cradle', mcu }),
        open = String(tray(d));
      d.tray.wire_gaps = false;
      expect(open).not.toBe(String(tray(d)));
    }
  });
});
