import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createDesign, generateParts } from '../../packages/core/src/index';
import type { Values } from '../../packages/core/src/index';
import { SENSORS } from '../../packages/core/src/calculations/sensor';
import { support_frames } from '../../packages/core/src/geometry/common';

const exec = promisify(execFile);
const runtime = resolve('.cache/openscad-node/openscad.js');

type Tri = { c: number[]; n: number[]; area: number };

/** Renders a part and returns its triangles (centroid, unit normal, area). */
async function mesh(scad: string): Promise<Tri[]> {
  const dir = await mkdtemp(join(tmpdir(), 'trackball-sensor-'));
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
    );
    const bytes = await readFile(join(dir, 'm.stl'));
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tris: Tri[] = [];
    for (let i = 0; i < data.getUint32(80, true); i++) {
      const p = [0, 1, 2].map((k) =>
        [0, 1, 2].map((a) => data.getFloat32(84 + i * 50 + 12 + k * 12 + a * 4, true)),
      );
      const [u, v] = [1, 2].map((k) => p[k].map((x, a) => x - p[0][a]));
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(...n);
      if (len < 1e-9) continue;
      tris.push({
        c: [0, 1, 2].map((a) => (p[0][a] + p[1][a] + p[2][a]) / 3),
        n: n.map((x) => x / len),
        area: len / 2,
      });
    }
    return tris;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Lens-to-ball distance measured on the rendered parts, not taken from the design's formula: the
 * support seats in the cup (or shell) set where the ball rests, the plate's top meets the cup's
 * underside over the sensor, and the board lies on the plate's underside, or on the shell's
 * underside when the shell holds it.
 */
async function measured(values: Partial<Values>) {
  const d = createDesign(values);
  const parts = generateParts(d);
  const cup = await mesh(parts.find((p) => p.name === (d.is_pod ? 'shell' : 'cup'))!.scad);
  const carrier = parts.find((p) => p.name === 'carrier');
  const plate = carrier ? await mesh(carrier.scad) : null;
  const c = d.cup,
    s = c.support,
    r = d.ball.r;
  // Each support's seat: the flat face across its axis nearest the ball, facing it.
  const seats = support_frames(c.support_count, c.support_polar_deg, c.azimuth0).map(
    ([az, pol]: number[]) => {
      const [th, ph] = [(pol * Math.PI) / 180, (az * Math.PI) / 180];
      const u = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), -Math.cos(th)];
      const faces = cup.filter((t) => dot(t.n, u) < -0.999 && dot(t.c, u) > r);
      return { u, at: Math.min(...faces.map((t) => dot(t.c, u))) };
    },
  );
  // The ball rests on the support tips: solve for its centre on the axis.
  const a = seats[0].at - s.contact_height,
    th = (c.support_polar_deg * Math.PI) / 180;
  const centre = -a * Math.cos(th) + Math.sqrt(r * r - (a * Math.sin(th)) ** 2);
  // The cup's underside over the sensor board, less the plate's thickness; a shell that holds
  // the board seats it on that underside.
  const over = (t: Tri) => Math.hypot(t.c[0], t.c[1]) < d.pcb.r;
  const contact = Math.min(...cup.filter((t) => t.n[2] < -0.999 && over(t)).map((t) => t.c[2]));
  const zs = plate ? plate.filter(over).map((t) => t.c[2]) : [0];
  const pcb_face = contact - (Math.max(...zs) - Math.min(...zs));
  return { d, seats, distance: centre - r - (pcb_face + d.pcb.lens.top_above_pcb) };
}

describe('lens-to-ball distance measured on the parts', () => {
  for (const values of [
    {},
    { build: 'cradle' },
    { build: 'cradle', sensor_mount: 'plate' },
    { build: 'pod' },
    { build: 'cradle', sensor_pcb: 'pmw3389-round' },
  ] as Partial<Values>[])
    it(
      JSON.stringify(values),
      async () => {
        const { d, seats, distance } = await measured(values);
        const sensor = SENSORS[d.pcb.sensor];
        for (const seat of seats) expect(seat.at).toBeCloseTo(d.ball.r + d.cup.support.contact_height, 2);
        expect(distance).toBeCloseTo(sensor.z.typ, 2);
        expect(distance).toBeCloseTo(d.sensor_distance, 2);
      },
      300000,
    );
});

describe("sensors' datasheet stacks", () => {
  it('puts the lens 3.4 mm over a 1.6 mm board and 2.4 mm from the ball', () => {
    const d = createDesign({});
    expect(d.pcb.lens.top_above_pcb).toBeCloseTo(3.4, 6);
    expect(d.sensor_distance).toBeCloseTo(2.4, 6);
    expect(d.validate()).toEqual([]);
  });
  it('warns when the adjustment leaves the datasheet range', () => {
    expect(createDesign({ sensor_adjust: 0.2 }).validate()).toEqual([]);
    for (const sensor_adjust of [-0.3, 0.3])
      expect(createDesign({ sensor_adjust }).validate().join()).toContain('datasheet range of 2.2 to 2.6 mm');
  });
});
