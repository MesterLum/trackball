import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { autofit, createDesign, generateParts, POWER_SWITCHES } from '../../packages/core/src/index';
import { is_placement, switch_corners, switch_point } from '../../packages/core/src/calculations/power';

const battery = { battery: '50x34x5', mcu: 'nice-nano' };

describe('power switch placement', () => {
  for (const power_switch of Object.keys(POWER_SWITCHES))
    for (const power_wall of ['right', 'left', 'back'])
      it(`${power_switch} on the ${power_wall} wall of a roomy body`, () => {
        const d = createDesign({ ...battery, power_switch, power_wall, padding: 20 });
        const p = d.power_switch_placement();
        expect(is_placement(p), JSON.stringify(p)).toBe(true);
        expect(d.validate()).toEqual([]);
      });

  it('stays clear of the USB plug on the same wall', () => {
    let checked = 0;
    for (const mcu_place of ['behind', 'under'])
      for (const power_switch of Object.keys(POWER_SWITCHES)) {
        const values = { ...battery, mcu: 'rp2040-zero', mcu_place, usb: 'right', power_switch, padding: 20 };
        const d = createDesign(autofit(values).values);
        const p = d.power_switch_placement();
        if (!is_placement(p)) continue; // reported as a fit problem instead
        checked++;
        const [x, y] = d.mcu_center();
        const usb = d.world_to_deck([x, y, d.z_floor_top])[1];
        expect(Math.abs(p.u - usb)).toBeGreaterThanOrEqual(p.type.outside[0] / 2 + 6);
      }
    expect(checked).toBeGreaterThan(3);
  });

  it('keeps the body under the lid and above the floor', () => {
    const d = createDesign({ ...battery, tilt: 15, tent: -10, power_switch: 'rocker', padding: 20 });
    const p = d.power_switch_placement();
    expect(is_placement(p)).toBe(true);
    if (!is_placement(p)) return;
    const corners = switch_corners(p, d.tray.wall, 10);
    expect(Math.max(...corners.map((c) => c[2]))).toBeLessThanOrEqual(d.z_pcb_face);
    const floor = Math.min(...switch_corners(p, 0, 10).map((c) => d.deck_to_world(c)[2]));
    expect(floor).toBeGreaterThanOrEqual(d.z_floor_top + 1 - 1e-6);
  });

  it('sits level with the floor on tilted and tented walls', () => {
    for (const power_wall of ['right', 'left', 'back'])
      for (const [tilt, tent] of [
        [12, 0],
        [0, -10],
        [15, 8],
      ]) {
        const d = createDesign({ ...battery, tilt, tent, power_wall, padding: 20 });
        const p = d.power_switch_placement();
        expect(is_placement(p), `${power_wall} ${tilt}/${tent}`).toBe(true);
        if (!is_placement(p)) continue;
        // Both ends of the body's long edge at the same world height.
        const [a, b] = [switch_point(p, -4, 0, 0), switch_point(p, 4, 0, 0)].map(
          (c) => d.deck_to_world(c)[2],
        );
        expect(a).toBeCloseTo(b, 6);
      }
  });

  it('refuses the front wall when a palm rest is attached there', () => {
    const d = createDesign({ ...battery, palm: 40, power_wall: 'front' });
    expect(d.validate().join('\n')).toContain('palm rest covers the front wall');
  });

  it('adds no switch without a battery or with none chosen', () => {
    expect(createDesign({ power_switch: 'rocker' }).power_switch_placement()).toBeNull();
    const d = createDesign({ ...battery, power_switch: 'none' });
    expect(d.power_switch_placement()).toBeNull();
    expect(d.bom().map((b: any) => b.note)).toContain('no power switch: unplug the battery to turn it off');
  });

  it('lists the chosen switch in the parts list', () => {
    const items = createDesign({ ...battery, power_switch: 'toggle' })
      .bom()
      .map((b: any) => b.item);
    expect(items).toContain(POWER_SWITCHES.toggle.name);
  });
});

const exec = promisify(execFile);
const runtime = resolve('.cache/openscad-node/openscad.js');
async function volume(scad: string) {
  const dir = await mkdtemp(join(tmpdir(), 'trackball-power-'));
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
      {
        timeout: 120000,
      },
    );
    const bytes = await readFile(join(dir, 'm.stl'));
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
const tray = (values: Record<string, unknown>) =>
  generateParts(createDesign({ ...battery, fn: 32, ...values })).find((p) => p.name === 'tray')!.scad;

it('every switch style renders into the tray wall', async () => {
  const plain = await volume(tray({ power_switch: 'none' }));
  for (const power_switch of Object.keys(POWER_SWITCHES)) {
    const v = await volume(tray({ power_switch }));
    expect(v, power_switch).toBeGreaterThan(0);
    expect(Math.abs(v - plain), power_switch).toBeGreaterThan(1);
  }
}, 240000);

it('square fused corners fill the notch next to the palm rest', async () => {
  const lid = (palm_corners: string) =>
    generateParts(createDesign({ palm: 40, palm_attachment: 'fused', palm_corners, fn: 32 })).find(
      (p) => p.name === 'carrier',
    )!.scad;
  expect(await volume(lid('square'))).toBeGreaterThan((await volume(lid('rounded'))) + 10);
}, 240000);
