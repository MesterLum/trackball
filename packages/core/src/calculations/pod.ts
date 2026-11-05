// Compact desk pod: a ball-only body whose shell wraps the cup, with steel weights in the base.

/** Shell wall thickness: clear filament prints evenly and looks tidy at a uniform, thicker wall. */
export const POD_WALL = { solid: 2.0, clear: 2.4 } as const;
/** Flat ring around the cup opening before the shell starts to fall away. */
export const POD_LIP = 1.5;
/** Vertical slices that approximate the shell's rounded profile. */
export const POD_SLICES = 10;
/** Screws from under the base into the sensor plate: thread-forming M3 into a pilot hole. */
export const POD_SCREW = { pilot_dia: 2.6, pilot_depth: 4.0 };

export interface Washer {
  size: string;
  od: number;
  id: number;
  t: number;
}
/** Plain steel washers (DIN 125 / ISO 7089), the largest that fits is used as weight. */
export const WASHERS: Washer[] = [
  { size: 'M10', od: 20, id: 10.5, t: 2 },
  { size: 'M12', od: 24, id: 13, t: 2.5 },
  { size: 'M16', od: 30, id: 17, t: 3 },
  { size: 'M20', od: 37, id: 21, t: 3 },
  { size: 'M24', od: 44, id: 25, t: 4 },
  { size: 'M30', od: 56, id: 31, t: 4 },
];
const STEEL = 7.85e-3; // g/mm³

export function washer_mass(w: Washer): number {
  return (Math.PI / 4) * (w.od ** 2 - w.id ** 2) * w.t * STEEL;
}

export class Pod {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.enabled = values.enabled ?? false;
    this.shell = values.shell ?? 'solid';
    this.weights = values.weights ?? 1;
  }
  get wall(): number {
    return POD_WALL[this.shell as keyof typeof POD_WALL] ?? POD_WALL.solid;
  }
}

export interface Ballast {
  washer: Washer;
  count: number;
  /** Round pocket in the underside of the base. */
  dia: number;
  depth: number;
  mass: number;
}

/**
 * Weight pocket under the base: the largest washer whose pocket keeps a solid rim inside the
 * walls and clears the feet over the corner screws.
 */
export function pod_ballast(d: any): Ballast | null {
  const pod: Pod = d.pod;
  if (!pod.enabled || pod.weights <= 0) return null;
  const t = d.tray;
  const half = Math.min(d.half_width, d.half_length);
  const [x, y] = d.lid_screw_points()[3];
  const keep = Math.max(t.feet_dia, d.carrier.screw_head_dia) / 2 + 1.0;
  const room = Math.min(half - t.wall - 1.0, Math.hypot(x, y - d.footprint[3]) - keep);
  const fits = WASHERS.filter((w) => w.od + 0.6 <= 2 * room);
  const washer = fits[fits.length - 1];
  if (!washer) return null;
  const count = pod.weights;
  return {
    washer,
    count,
    dia: washer.od + 0.6,
    depth: count * washer.t + 0.2,
    mass: count * washer_mass(washer),
  };
}

/** Outline of the shell at height fraction s (0 = sitting on the plate, 1 = the cup rim). */
export function pod_outline(d: any, s: number, inset = 0) {
  const [w, l, cx, cy] = d.footprint;
  const top = d.cavity_r + d.cup.wall + POD_LIP;
  // Quarter ellipse: vertical where it meets the plate, flat at the rim.
  const k = Math.sqrt(Math.max(1 - s * s, 0));
  const hw = top + (w / 2 - top) * k - inset;
  const hl = top + (l / 2 - top) * k - inset;
  const r0 = Math.max(d.carrier.corner_r - inset, 0.5);
  const r = r0 + (Math.min(hw, hl) - r0) * s * s;
  return { w: 2 * hw, l: 2 * hl, r, x: cx * (1 - s), y: cy * (1 - s) };
}
