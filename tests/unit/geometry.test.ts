import { it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import reference from '../fixtures/python-geometry.json';
import { createDesign, generateParts } from '../../packages/core/src/index';
import type { Values } from '../../packages/core/src/index';
const exec = promisify(execFile);
const runtime = resolve('.cache/openscad-node/openscad.js');

/** Compare the actual solid, independently of AST layout and mesh triangulation. */
function measure(bytes: Uint8Array) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = data.getUint32(80, true);
  expect(bytes.byteLength).toBe(84 + count * 50);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  let volume = 0;
  for (let i = 0; i < count; i++) {
    const vertices = Array.from({ length: 3 }, (_, v) =>
      Array.from({ length: 3 }, (_, a) => data.getFloat32(84 + i * 50 + 12 + v * 12 + a * 4, true)),
    );
    for (const p of vertices)
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], p[a]);
        max[a] = Math.max(max[a], p[a]);
      }
    const [a, b, c] = vertices;
    volume +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
  }
  return { min, max, volume: Math.abs(volume) };
}
for (const row of reference)
  it(`solid parity: ${row.name}/${row.part}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'trackball-parity-'));
    try {
      // Settings added after the checkpoint, set to reproduce its behaviour where one exists.
      const values = { palm_corners: 'rounded', ...row.values } as Values;
      const part = generateParts(createDesign(values)).find((p) => p.name === row.part)!;
      const metrics = [];
      for (const [name, scad] of [
        ['reference', row.scad],
        ['typescript', part.scad],
      ]) {
        const input = join(dir, name + '.scad'),
          output = join(dir, name + '.stl');
        await writeFile(input, scad);
        await exec(
          process.execPath,
          [runtime, input, '-o', output, '--backend=Manifold', '--export-format=binstl'],
          { timeout: 120000, maxBuffer: 1024 * 1024 },
        );
        metrics.push(measure(await readFile(output)));
      }
      for (const key of ['min', 'max'] as const)
        for (let a = 0; a < 3; a++) expect(metrics[1][key][a]).toBeCloseTo(metrics[0][key][a], 4);
      expect(metrics[1].volume).toBeGreaterThan(0);
      expect(Math.abs(metrics[1].volume - metrics[0].volume) / metrics[0].volume).toBeLessThan(0.0001);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 250000);
