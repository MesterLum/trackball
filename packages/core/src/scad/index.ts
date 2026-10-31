/** Small immutable OpenSCAD syntax tree. Geometry is evaluated only by WASM. */
export type ScadValue = number | string | boolean | null | ScadValue[];
const literal = (v: ScadValue): string =>
  Array.isArray(v)
    ? `[${v.map(literal).join(',')}]`
    : typeof v === 'number'
      ? Number.isFinite(v)
        ? String(Object.is(v, -0) ? 0 : v)
        : (() => {
            throw new Error('Non-finite CAD coordinate');
          })()
      : JSON.stringify(v);
export class Shape {
  constructor(
    readonly operation: string,
    readonly parameters: Record<string, ScadValue> = {},
    readonly children: Shape[] = [],
  ) {}
  translate(v: number[]): Shape {
    return new Shape('translate', { v }, [this]);
  }
  rotate(a: number[]): Shape {
    return new Shape('rotate', { a }, [this]);
  }
  mirror(v: number[]): Shape {
    return new Shape('mirror', { v }, [this]);
  }
  color(c: string, alpha = 1): Shape {
    return new Shape('color', { c, alpha }, [this]);
  }
  up(z: number): Shape {
    return this.translate([0, 0, z]);
  }
  down(z: number): Shape {
    return this.up(-z);
  }
  right(x: number): Shape {
    return this.translate([x, 0, 0]);
  }
  left(x: number): Shape {
    return this.right(-x);
  }
  forward(y: number): Shape {
    return this.translate([0, y, 0]);
  }
  back(y: number): Shape {
    return this.forward(-y);
  }
  toString(): string {
    const args = Object.entries(this.parameters)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${literal(v)}`)
      .join(',');
    return this.children.length
      ? `${this.operation}(${args}){\n${this.children.map(String).join('\n')}\n}`
      : `${this.operation}(${args});`;
  }
}
const shape = (op: string, args: Record<string, any>) => new Shape(op, args);
const children =
  (op: string) =>
  (...parts: Shape[]) =>
    new Shape(op, {}, parts.filter(Boolean));
export const union = () => children('union');
export const difference = () => children('difference');
export const intersection = () => children('intersection');
export const hull = () => children('hull');
export const cube = (size: any, center = false) => shape('cube', { size, center });
export const square = (size: any, center = false) => shape('square', { size, center });
export const sphere = (r?: number, d?: number, fn?: number) => shape('sphere', { r, d, $fn: fn });
export const circle = (r?: number, d?: number, fn?: number) => shape('circle', { r, d, $fn: fn });
export const cylinder = (
  h: number,
  r?: number,
  d?: number,
  r1?: number,
  r2?: number,
  center = false,
  fn?: number,
) => shape('cylinder', { h, r, d, r1, r2, center, $fn: fn });
export const polygon = (points: number[][]) => shape('polygon', { points });
export const offset = (r?: number, delta?: number, fn?: number) => (part: Shape) =>
  new Shape('offset', { r, delta, $fn: fn } as any, [part]);
export const linear_extrude =
  (height: number, center = false, convexity?: number, twist?: number, slices?: number, scale?: number) =>
  (part: Shape) =>
    new Shape('linear_extrude', { height, center, convexity, twist, slices, scale } as any, [part]);
export const rotate_extrude = (fn?: number) => (part: Shape) =>
  new Shape('rotate_extrude', { $fn: fn } as any, [part]);
export const multmatrix = (m: number[][]) => (part: Shape) => new Shape('multmatrix', { m }, [part]);
export const color =
  (c: string, alpha = 1) =>
  (part: Shape) =>
    part.color(c, alpha);
