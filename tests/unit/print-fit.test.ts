import { describe, it, expect } from 'vitest';
import { createDesign, generateFitTest, generateParts, PRESETS } from '../../packages/core/src/index';
import type { Values } from '../../packages/core/src/index';
import { POD_FIT, WEIGHT_CAP, cap_clearance } from '../../packages/core/src/calculations/pod';

const preset = (key: string) => PRESETS.find((p) => p.key === key)!.values as Partial<Values>;
const cradle = { ...preset('cradle-pod'), build: 'cradle' };
/** Every cylinder diameter in a part's source. */
const diameters = (scad: string) =>
  new Set([...scad.matchAll(/\bd=([\d.]+)/g)].map((m) => Math.round(Number(m[1]) * 1000) / 1000));

describe('print fit', () => {
  it('changes nothing at its defaults', () => {
    const d = createDesign({});
    expect([d.fit.hole, d.fit.gap]).toEqual([0, 0]);
    expect(createDesign(cradle).pod.fit).toBe(POD_FIT);
    expect(cap_clearance(createDesign(cradle))).toBe(WEIGHT_CAP.clearance);
  });

  it('grows the support bores and sockets by the hole fit', () => {
    expect(createDesign({ fit_hole: 0.2 }).cup.support.press_fit_oversize).toBeCloseTo(0.3);
    expect(createDesign({ support: 'mr63', fit_hole: 0.2 }).cup.support.screw_clear_dia).toBeCloseTo(3.5);
    expect(createDesign({ support: 'ceramic-3', fit_hole: 0.2 }).cup.support.socket_oversize).toBeCloseTo(
      0.3,
    );
    // The shared support stays as it was.
    expect(createDesign({}).cup.support.press_fit_oversize).toBeCloseTo(0.1);
  });

  it('grows the insert and screw holes in the parts', () => {
    const before = generateParts(createDesign({})),
      after = generateParts(createDesign({ fit_hole: 0.2 }));
    const cup = (parts: typeof before) => diameters(parts.find((p) => p.name === 'cup')!.scad);
    expect(cup(before).has(4)).toBe(true);
    expect(cup(after).has(4.2)).toBe(true);
    expect(cup(after).has(4)).toBe(false);
  });

  it('opens the pod fit and the cap clearance by the slide fit', () => {
    const tight = createDesign(cradle),
      loose = createDesign({ ...cradle, fit_gap: 0.1 });
    expect(loose.pod.fit).toBeCloseTo(POD_FIT + 0.1);
    expect(loose.tray.wall - tight.tray.wall).toBeCloseTo(0.1);
    expect(cap_clearance(loose)).toBeCloseTo(WEIGHT_CAP.clearance + 0.1);
    // The cap's cup gives up the extra clearance, and the room inside the walls shrinks by as much.
    expect(tight.ballast!.dia - loose.ballast!.dia).toBeCloseTo(0.4, 1);
  });
});

describe('fit test', () => {
  it('grades each hole around the current setting', () => {
    const scad = generateFitTest(createDesign({ fit_hole: 0.1 })).scad;
    // Heat-set insert holes: Ø4 + 0.1, from one step tighter to two looser.
    for (const d of [4.0, 4.1, 4.2, 4.3]) expect(diameters(scad).has(d)).toBe(true);
    // A full trackball has no nut pocket or cap thread.
    expect(scad).not.toContain('$fn=6');
    expect(scad).not.toContain('polyhedron');
  });

  it('adds the nut pockets and the cap thread for a pod', () => {
    const scad = generateFitTest(createDesign(cradle)).scad;
    expect(scad).toContain('$fn=6');
    expect(scad).toContain('polyhedron');
    expect(generateFitTest(createDesign({ ...cradle, weight_cap: 'bayonet' })).scad).not.toContain(
      'polyhedron',
    );
  });

  it('leaves out the BTU row for other supports', () => {
    const btu = generateFitTest(createDesign({})).scad,
      bearing = generateFitTest(createDesign({ support: 'mr63' })).scad;
    expect(diameters(btu).has(7.5)).toBe(true);
    expect(diameters(bearing).has(7.5)).toBe(false);
  });
});
