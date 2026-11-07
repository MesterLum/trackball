// Printable screw threads: a helical ridge built as an exact mesh around a core cylinder.
import { add, mul } from '../math.js';
import { polyhedron } from '../scad/index.js';
import { zcyl } from './common.js';

/** A coarse thread that prints well on FDM: 45° flanks, flat crest and root. */
export interface ThreadSpec {
  pitch: number;
  /** Radial depth of the ridge. */
  depth: number;
}

/**
 * Threaded solid from z = 0 to length: a core of radius r_minor with a right-hand ridge reaching
 * r_minor + depth. A nut is cut with the same solid grown by its clearance, so both share the
 * phase and mesh.
 */
export function thread_solid(spec: ThreadSpec, r_minor: number, length: number, fn: number): any {
  const { pitch, depth } = spec;
  const crest = Math.max(pitch / 2 - depth, 0.2);
  // Profile in (radius, height): up the lower flank, along the crest, down the upper flank.
  const profile = [
    [r_minor - 0.05, 0],
    [r_minor + depth, depth],
    [r_minor + depth, depth + crest],
    [r_minor - 0.05, 2 * depth + crest],
  ];
  const steps = Math.max(fn, 48);
  // Start a turn below and end a turn above, then trim to the length.
  const turns = length / pitch + 2;
  const count = Math.ceil(turns * steps);
  const points: number[][] = [];
  for (let k = 0; k <= count; k++) {
    const a = (2 * Math.PI * k) / steps,
      z = -pitch + (pitch * k) / steps;
    for (const [r, h] of profile) points.push([r * Math.cos(a), r * Math.sin(a), z + h]);
  }
  const at = (k: number, i: number) => k * 4 + i;
  const faces: number[][] = [[at(0, 3), at(0, 2), at(0, 1), at(0, 0)]];
  for (let k = 0; k < count; k++)
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      faces.push([at(k, i), at(k, j), at(k + 1, j), at(k + 1, i)]);
    }
  faces.push([at(count, 0), at(count, 1), at(count, 2), at(count, 3)]);
  const ridge = polyhedron(points, faces);
  const outer = 2 * (r_minor + depth) + 2;
  return mul(add(ridge, zcyl(2 * r_minor, -pitch, length + pitch, fn)), zcyl(outer, 0, length, fn));
}
