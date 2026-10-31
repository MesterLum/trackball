/** Arithmetic shared by the calculation and CSG ports. No Python runtime. */
import { Shape, union, difference, intersection } from './scad/index.js';
export const add = (...values: any[]): any =>
  values.reduce((a, b) => (a instanceof Shape ? union()(a, b) : Array.isArray(a) ? [...a, ...b] : a + b));
export const sub = (a: any, b: any): any => (a instanceof Shape ? difference()(a, b) : a - b);
export const mul = (a: any, b: any): any => (a instanceof Shape ? intersection()(a, b) : a * b);
export const mod = (a: number, b: number) => ((a % b) + b) % b;
export function index(value: any, key: any): any {
  if (Array.isArray(key)) return value.slice(key[0] ?? 0, key[1] ?? value.length);
  return typeof key === 'number' && key < 0 ? value.at(key) : value[key];
}
export const get = (o: any, k: any, fallback: any = null): any => o[k] ?? fallback;
export const truth = (v: any): boolean =>
  v === null || v === undefined
    ? false
    : Array.isArray(v)
      ? v.length > 0
      : typeof v === 'object' && !(v instanceof Shape)
        ? Object.keys(v).length > 0
        : Boolean(v);
export const contains = (values: any, value: any) =>
  Array.isArray(values) || typeof values === 'string' ? values.includes(value) : value in values;
export function range(start: number, end?: number, step = 1): number[] {
  if (end === undefined) {
    end = start;
    start = 0;
  }
  return Array.from({ length: Math.max(0, Math.ceil((end - start) / step)) }, (_, i) => start + i * step);
}
export const length = (v: any) =>
  Array.isArray(v) || typeof v === 'string' ? v.length : Object.keys(v).length;
export const abs = Math.abs;
const flattened = (v: any[]) => (v.length === 1 && Array.isArray(v[0]) ? v[0] : v);
export const min = (...v: any[]) => Math.min(...flattened(v));
export const max = (...v: any[]) => Math.max(...flattened(v));
export function round(v: number, digits = 0): number {
  // Round the exact IEEE-754 value, including halfway-to-even cases.
  // Decimal multiplication first can erase the information needed at a tie.
  if (!Number.isFinite(v) || v === 0) return v;
  const data = new DataView(new ArrayBuffer(8));
  data.setFloat64(0, Math.abs(v));
  const bits = data.getBigUint64(0),
    exponent = Number((bits >> 52n) & 2047n);
  let numerator = (bits & ((1n << 52n) - 1n)) | (exponent ? 1n << 52n : 0n);
  let denominator = 1n;
  const shift = (exponent ? exponent - 1023 : 1 - 1023) - 52;
  if (shift >= 0) numerator <<= BigInt(shift);
  else denominator <<= BigInt(-shift);
  if (digits >= 0) numerator *= 10n ** BigInt(digits);
  else denominator *= 10n ** BigInt(-digits);
  let quotient = numerator / denominator;
  const twice = (numerator % denominator) * 2n;
  if (twice > denominator || (twice === denominator && quotient % 2n !== 0n)) quotient++;
  return (Math.sign(v) * Number(quotient)) / 10 ** digits;
}
export const minBy = (v: any[], key: (v: any) => any) => [...v].sort((a, b) => compare(key(a), key(b)))[0];
function compare(a: any, b: any): number {
  if (Array.isArray(a)) {
    for (let i = 0; i < a.length; i++) {
      const c = compare(a[i], b[i]);
      if (c) return c;
    }
    return 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}
export const math = {
  ...Object.fromEntries(['sin', 'cos', 'sqrt', 'atan2', 'hypot'].map((k) => [k, (Math as any)[k]])),
  pi: Math.PI,
  inf: Infinity,
  radians: (v: number) => (v * Math.PI) / 180,
  degrees: (v: number) => (v * 180) / Math.PI,
} as Record<string, any>;
export function formatValue(v: any, spec = ''): string {
  if (spec.endsWith('f')) {
    // Python's '.Nf' rounds the exact value half to even; toFixed alone rounds 2.25 up to 2.3.
    const digits = Number(spec.slice(1, -1));
    return round(Number(v), digits).toFixed(digits);
  }
  return String(v);
}
export const format = (s: string, values: Record<string, any>): string =>
  s.replace(/\{([^}:]+)(?::([^}]+))?\}/g, (_, key, spec) => formatValue(values[key], spec));
