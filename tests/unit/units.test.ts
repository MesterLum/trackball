import { describe, it, expect, afterEach } from 'vitest';
import {
  autofit,
  coerce,
  createDesign,
  defaults,
  optionApplies,
  setLanguage,
  translate,
} from '../../packages/core/src/index';
import { parseBattery } from '../../packages/core/src/config/options';
import {
  Ball,
  Battery,
  Carrier,
  Cup,
  Deck,
  Design,
  Lens,
  MCU,
  SensorPCB,
  Switches,
  SwitchType,
  Tray,
} from '../../packages/core/src/calculations/design';
import {
  BallSupport,
  PressFitBTU,
  RollerBearing,
  StaticBearing,
} from '../../packages/core/src/geometry/supports';
import { Tile } from '../../packages/core/src/geometry/tiles';
import { palm_joint_sample } from '../../packages/core/src/geometry/palmrest';
import { place_power_switch } from '../../packages/core/src/calculations/power';
import {
  add,
  contains,
  format,
  get,
  index,
  length,
  max,
  min,
  minBy,
  mod,
  range,
  round,
  truth,
} from '../../packages/core/src/math';
import {
  Shape,
  circle,
  color,
  cube,
  cylinder,
  hull,
  linear_extrude,
  offset,
  polygon,
  rotate_extrude,
  sphere,
} from '../../packages/core/src/scad/index';

describe('option input (shared links and the form)', () => {
  it('parses numbers, integers and booleans from strings', () => {
    const v = coerce({ ball: '44', supports: '3.9', no_mirror: 'yes' });
    expect(v.ball).toBe(44);
    expect(v.supports).toBe(3);
    expect(v.no_mirror).toBe(true);
    for (const off of ['0', 'false', 'no', 'off']) expect(coerce({ no_mirror: off }).no_mirror).toBe(false);
    expect(coerce({ no_mirror: true }).no_mirror).toBe(true);
    expect(coerce({ battery: null as any }).battery).toBe('');
  });

  it('rejects unknown options, bad choices, non-numbers and out-of-range values', () => {
    expect(() => coerce({ colour: 'red' })).toThrow('unknown option');
    expect(() => coerce({ mcu: 'arduino' })).toThrow('must be one of');
    expect(() => coerce({ ball: 'big' })).toThrow('enter a number');
    expect(() => coerce({ ball: 300 })).toThrow('outside supported range');
    expect(() => coerce({ battery: '50 by 30' })).toThrow('LxWxT');
  });

  it('forces microswitches under sculpted tiles', () => {
    expect(coerce({ buttons: 'tiles', switch_type: 'mx' }).switch_type).toBe('micro');
  });

  it('parses battery sizes with x, X or ×', () => {
    expect(parseBattery('').enabled).toBe(false);
    const b = parseBattery(' 50X34×5.5 ');
    expect([b.enabled, b.length, b.width, b.thickness]).toEqual([true, 50, 34, 5.5]);
  });

  it('shows options only where they apply', () => {
    const base = defaults();
    expect(optionApplies('ball', base)).toBe(true);
    expect(optionApplies('palm_attachment', base)).toBe(false);
    expect(optionApplies('palm_attachment', { ...base, palm: 30 })).toBe(true);
    expect(optionApplies('palm_corners', { ...base, palm: 30, palm_attachment: 'anchored' })).toBe(false);
    expect(optionApplies('palm_corners', { ...base, palm: 30, palm_attachment: 'fused' })).toBe(true);
    expect(optionApplies('power_switch', base)).toBe(false);
    expect(optionApplies('power_switch', { ...base, battery: '40x25x3' })).toBe(true);
    expect(optionApplies('power_wall', { ...base, battery: '40x25x3', power_switch: 'none' })).toBe(false);
    expect(optionApplies('power_wall', { ...base, battery: '40x25x3' })).toBe(true);
    expect(optionApplies('mcu_hold', base)).toBe(false); // the Pico has mounting holes
    expect(optionApplies('mcu_hold', { ...base, mcu: 'xiao' })).toBe(true);
    expect(optionApplies('clamp_length', { ...base, mcu: 'xiao', mcu_hold: 'glue' })).toBe(false);
    expect(optionApplies('clamp_width', { ...base, mcu: 'xiao' })).toBe(true);
  });

  it('auto fit takes the largest padding when several problems ask for more', () => {
    const tight = { mcu: 'nice-nano', battery: '50x34x5', switches: 0, padding: 4 };
    const asked = createDesign(tight)
      .problems()
      .map((p: any) => p.fix.padding)
      .filter((v: any) => v !== undefined);
    expect(asked.length).toBeGreaterThan(1);
    const { values, changes } = autofit(tight);
    expect(Number(values.padding)).toBeGreaterThanOrEqual(Math.max(...asked));
    expect(changes.find((c) => c.option === 'padding')?.from).toBe(4);
    expect(createDesign(values).validate()).toEqual([]);
  });
});

describe('model defaults', () => {
  it('builds a complete design from defaults alone', () => {
    const d = new Design();
    for (const part of [d.ball, d.cup, d.lens, d.pcb, d.carrier, d.tray, d.switches, d.deck, d.battery])
      expect(part).toBeTruthy();
    expect(d.fn).toBe(96);
    expect(d.bom().length).toBeGreaterThan(3);
    expect(d.summary()).toContain('mm');
  });

  it('every part class has defaults for every field', () => {
    for (const make of [
      () => new Ball(),
      () => new Cup(),
      () => new Lens(),
      () => new SensorPCB(),
      () => new Carrier(),
      () => new Tray(),
      () => new Switches(),
      () => new SwitchType(),
      () => new Deck(),
      () => new Battery(),
      () => new MCU(),
      () => new PressFitBTU(),
      () => new StaticBearing(),
      () => new RollerBearing(),
      () => new Tile(),
    ]) {
      const part = make();
      // Every field the constructor sets is defined (null is a deliberate "none").
      for (const [k, v] of Object.entries(part))
        expect(v, `${part.constructor.name}.${k}`).not.toBeUndefined();
    }
  });

  it('support types must implement the geometry operations', () => {
    const base = new BallSupport();
    expect(() => base.cutter(32)).toThrow('Unsupported');
    expect(() => base.body_reach()).toThrow('Unsupported');
    expect(() => base.body_radius()).toThrow('Unsupported');
    expect(base.preview(32)).toBeNull();
    expect(base.describe()).toBe('BallSupport');
  });
});

describe('extras', () => {
  it('builds a printable test piece for the anchored palm-rest joint', () => {
    expect(palm_joint_sample(createDesign({ palm: 40, palm_attachment: 'anchored' }))).toBeInstanceOf(Shape);
    expect(palm_joint_sample(createDesign({ palm: 40, palm_attachment: 'fused' }))).toBeNull();
    expect(palm_joint_sample(createDesign({ palm: 0, palm_attachment: 'anchored' }))).toBeNull();
  });

  it('reports a switch that is taller than the wall', () => {
    // A shallow tray: small ball, wires instead of a header, rocker switch.
    const d = createDesign({
      ball: 25,
      support: 'btu-4.8',
      header_height: 3,
      battery: '20x15x2',
      mcu: 'xiao',
      mcu_place: 'under',
      power_switch: 'rocker',
      padding: 25,
    });
    const p = place_power_switch(d);
    if (p && 'reason' in p && p.reason === 'height') {
      expect(p.free).toBeLessThan(p.needed);
      expect(d.validate().join('\n')).toContain('wall height');
    } else {
      // The tray turned out tall enough; then the rocker must be placed.
      expect(p && 'type' in p).toBe(true);
    }
  });
});

describe('language', () => {
  afterEach(() => setLanguage('en'));
  it('translates with the current or an explicit language and falls back to English', () => {
    expect(translate('Height', 'es')).toBe('Altura');
    setLanguage('es');
    expect(translate('Height')).toBe('Altura');
    expect(translate('no such message')).toBe('no such message');
    expect(translate('Height', 'en')).toBe('Height');
  });
});

describe('math helpers', () => {
  it('truthiness follows Python semantics', () => {
    for (const v of [null, undefined, [], {}, 0, '']) expect(truth(v)).toBe(false);
    for (const v of [[0], { a: 1 }, 1, 'x', cube(1)]) expect(truth(v)).toBe(true);
  });
  it('indexes, slices, ranges and measures', () => {
    expect(index([1, 2, 3], -1)).toBe(3);
    expect(index([1, 2, 3, 4], [1, 3])).toEqual([2, 3]);
    expect(index([1, 2, 3], [undefined, 2])).toEqual([1, 2]);
    expect(index({ a: 5 }, 'a')).toBe(5);
    expect(range(3)).toEqual([0, 1, 2]);
    expect(range(0, 10, 4)).toEqual([0, 4, 8]);
    expect(range(5, 2)).toEqual([]);
    expect([length('abc'), length([1]), length({ a: 1, b: 2 })]).toEqual([3, 1, 2]);
    expect([contains('abc', 'b'), contains([1], 2), contains({ k: 1 }, 'k')]).toEqual([true, false, true]);
    expect(get({ a: 1 }, 'b', 7)).toBe(7);
    expect(mod(-1, 4)).toBe(3);
  });
  it('min, max and minBy accept lists or arguments', () => {
    expect(min([3, 1, 2])).toBe(1);
    expect(max(3, 1, 2)).toBe(3);
    expect(
      minBy(
        [
          [2, 'b'],
          [1, 'z'],
          [1, 'a'],
        ],
        (v) => v,
      ),
    ).toEqual([1, 'a']);
    expect(add([1], [2])).toEqual([1, 2]);
  });
  it('rounds the exact binary value, halves to even, like Python', () => {
    expect(round(2.5)).toBe(2);
    expect(round(3.5)).toBe(4);
    expect(round(2.675, 2)).toBe(2.67); // 2.675 is stored just below the half
    expect(round(-1.25, 1)).toBe(-1.2);
    expect(round(1250, -2)).toBe(1200);
    expect(round(0)).toBe(0);
    expect(round(Infinity)).toBe(Infinity);
    expect(round(5e-324, 2)).toBe(0); // subnormal
  });
  it('formats placeholders with fixed decimals', () => {
    expect(format('{a:.1f} and {b:g} and {c}', { a: 2.25, b: 3, c: 'x' })).toBe('2.2 and 3 and x');
  });
});

describe('OpenSCAD syntax tree', () => {
  it('serialises values and the fluent transforms', () => {
    const s = cube([1, -0, 2], true).right(1).left(2).forward(3).back(4).up(5).down(6).mirror([1, 0, 0]);
    const text = String(s.color('red', 0.5));
    expect(text).toContain('cube(size=[1,0,2],center=true);');
    expect(text).toContain('translate(v=[1,0,0])');
    expect(text).toContain('translate(v=[-2,0,0])');
    expect(text).toContain('translate(v=[0,-4,0])');
    expect(text).toContain('mirror(v=[1,0,0])');
    expect(text).toContain('color(c="red",alpha=0.5)');
    expect(() => String(cube([Infinity, 1, 1]))).toThrow('Non-finite');
  });
  it('builds every primitive with optional parameters left out', () => {
    const parts = [
      sphere(undefined, 4, 16),
      circle(2),
      cylinder(3, undefined, 2, undefined, undefined, true),
      polygon([
        [0, 0],
        [1, 0],
        [0, 1],
      ]),
      offset(undefined, 0.5)(circle(1)),
      linear_extrude(2, true, 4, 10, 3, 0.5)(circle(1)),
      rotate_extrude(32)(circle(1)),
      color('blue')(cube(1)),
      hull()(cube(1), sphere(1)),
    ].map(String);
    expect(parts[0]).toBe('sphere(d=4,$fn=16);');
    expect(parts[1]).toBe('circle(r=2);');
    expect(parts[2]).toBe('cylinder(h=3,d=2,center=true);');
    expect(parts[3]).toBe('polygon(points=[[0,0],[1,0],[0,1]]);');
    expect(parts[4]).toContain('offset(delta=0.5)');
    expect(parts[5]).toContain(
      'linear_extrude(height=2,center=true,convexity=4,twist=10,slices=3,scale=0.5)',
    );
    expect(parts[6]).toContain('rotate_extrude($fn=32)');
    expect(parts[7]).toContain('color(c="blue",alpha=1)');
    expect(parts[8]).toMatch(/^hull\(\)\{/);
  });
});
