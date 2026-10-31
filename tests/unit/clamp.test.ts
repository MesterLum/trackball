import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { autofit, createDesign, generateParts, MCUS } from '../../packages/core/src/index';
import type { Values } from '../../packages/core/src/index';
import { CLAMP, clamp_layout } from '../../packages/core/src/calculations/clamp';

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

  it('lists two M2 screws for the clamp', () => {
    const bom = createDesign({ mcu: 'nice-nano' }).bom();
    expect(bom.find((b: any) => b.item === 'M2x6 self-tapping screws')?.qty).toBe(2);
    expect(
      createDesign({ mcu: 'pico' })
        .bom()
        .some((b: any) => b.item === 'M2x6 self-tapping screws'),
    ).toBe(false);
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
