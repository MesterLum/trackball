// Compact desk pod: a ball-only body whose shell wraps the cup, with steel weights in the base.

/** Shell wall thickness: clear filament prints evenly and looks tidy at a uniform, thicker wall. */
export const POD_WALL = { solid: 2.0, clear: 2.4 } as const;
/** Flat ring around the cup opening before the shell starts to fall away. */
export const POD_LIP = 1.5;
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

export type PodStyle = 'round' | 'cradle';
export class Pod {
  [key: string]: any;
  constructor(values: Record<string, any> = {}) {
    this.enabled = values.enabled ?? false;
    this.style = values.style ?? 'round';
    this.shell = values.shell ?? 'solid';
    this.weights = values.weights ?? 1;
  }
  get wall(): number {
    return POD_WALL[this.shell as keyof typeof POD_WALL] ?? POD_WALL.solid;
  }
  get cradle(): boolean {
    return this.enabled && this.style === 'cradle';
  }
}

/**
 * Cradle pod: rounded top edge of the base, concave fillet where the cup rises from it, rounded
 * rim lip, the front notch (width and depth as shares of the ball radius) and its bevel, and the
 * seam groove around the lower body.
 */
export const CRADLE = {
  edge: 4.0,
  fillet: 4.0,
  lip: 1.2,
  notch_w: 0.45,
  notch_depth: 0.6,
  bevel: 1.2,
  groove_depth: 0.7,
  groove_h: 0.8,
};

export interface CradleShape {
  /** Height of the base's top, where the cup rises from it. */
  edge: number;
  /** Height of the cup's flat rim. */
  rim: number;
  /** Outer radius of the cup, and the concave fillet where it meets the base. */
  cup_r: number;
  fillet: number;
  /** Half width of the front notch and the height of its rounded bottom. */
  notch_r: number;
  notch_bottom: number;
  /** Height of the seam groove. */
  seam: number;
}
/**
 * Cradle pod: a round cup with a flat rim (at the rim depth) rising from a low soft-square base,
 * with a U-shaped notch in front that leaves a horn on each side. The base's top just clears the
 * plates inside; the notch stops above it.
 */
export function cradle_shape(d: any): CradleShape {
  const R = d.ball.r,
    edge = d.z_carrier_top + d.pod.wall + 2,
    rim = -d.cup.rim_below_center;
  return {
    edge,
    rim,
    // Three millimetres over the cup wall keep the support bores inside it.
    cup_r: d.cavity_r + d.cup.wall + 3,
    // The fillet stays on the base's flat top, inside its rounded edge.
    fillet: Math.max(
      Math.min(
        CRADLE.fillet,
        Math.min(d.half_width, d.half_length) - CRADLE.edge - (d.cavity_r + d.cup.wall + 3) - 0.5,
      ),
      1,
    ),
    // As wide as the share allows, but clear of the two supports either side of the front.
    notch_r: Math.max(
      Math.min(
        CRADLE.notch_w * R,
        (R + 2) *
          Math.sin((d.cup.support_polar_deg * Math.PI) / 180) *
          Math.sin(Math.PI / Math.max(d.cup.support_count, 2)) -
          5.2,
      ),
      0.25 * R,
    ),
    notch_bottom: Math.max(rim - CRADLE.notch_depth * R, edge + 1.5),
    seam: d.z_floor_top + 1.5,
  };
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

/** Gap between the shell's inside and the plates it covers. */
export const POD_FIT = 0.3;
/** Small chamfer at the shell's bottom edge (also keeps the first layer from flaring). */
export const POD_FOOT_CHAMFER = 0.6;
/** Chamfer where the shell meets the ball opening. */
export const POD_RIM_CHAMFER = 1.0;
/** Share of the body height taken by the rounded shoulder up to the rim. */
export const POD_SHOULDER = 0.5;

/** Squircle outline (|x/a|^n + |y/b|^n = 1): n = 2 is an ellipse, larger n squarer. */
export function squircle(a: number, b: number, n: number, points = 72): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < points; i++) {
    const t = (2 * Math.PI * i) / points,
      c = Math.cos(t),
      s = Math.sin(t);
    out.push([a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return out;
}
export function inside_squircle(x: number, y: number, a: number, b: number, n: number): boolean {
  return Math.abs(x / a) ** n + Math.abs(y / b) ** n <= 1;
}
/** Plan shape of the pod's sides: a soft square. */
export const POD_SIDE_N = 4;

export interface PodLevel {
  z: number;
  /** Half sizes across (x) and along (y). */
  a: number;
  b: number;
  n: number;
  x: number;
  y: number;
}
/**
 * The shell's outside, bottom to top: straight sides on a soft-square plan, then a rounded
 * shoulder (a quarter ellipse) that turns the plan into a circle and ends flat at the rim.
 */
export function pod_levels(d: any, inset = 0, drop = 0, steps = 12): PodLevel[] {
  const [w, l, cx, cy] = d.footprint;
  const zb = d.z_floor_bottom,
    zr = -d.cup.rim_below_center;
  const top = d.cavity_r + d.cup.wall + POD_LIP;
  const zs = zr - POD_SHOULDER * (zr - zb);
  const levels: PodLevel[] = [
    {
      z: zb,
      a: w / 2 - POD_FOOT_CHAMFER - inset,
      b: l / 2 - POD_FOOT_CHAMFER - inset,
      n: POD_SIDE_N,
      x: cx,
      y: cy,
    },
    { z: zb + POD_FOOT_CHAMFER, a: w / 2 - inset, b: l / 2 - inset, n: POD_SIDE_N, x: cx, y: cy },
  ];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps,
      k = Math.sqrt(1 - u * u);
    levels.push({
      z: zs + (zr - drop - zs) * u,
      a: top + (w / 2 - top) * k - inset,
      b: top + (l / 2 - top) * k - inset,
      n: POD_SIDE_N - (POD_SIDE_N - 2) * u * u,
      x: cx * (1 - u),
      y: cy * (1 - u),
    });
  }
  return levels;
}

/**
 * Where the base posts (and the feet over their screws) go: on the diagonals, as far out as the
 * post still fits inside the shell with some margin.
 */
export function pod_post_points(d: any): number[][] {
  const [w, l, cx, cy] = d.footprint;
  const a = w / 2 - d.pod.wall - POD_FIT,
    b = l / 2 - d.pod.wall - POD_FIT;
  const r = Math.max(d.tray.post_dia, d.tray.feet_dia, d.carrier.screw_head_dia) / 2 + 0.8;
  const ring = squircle(r, r, 2, 24);
  let t = 1;
  for (let k = 0.99; k > 0.3; k -= 0.01) {
    const [x, y] = [a * k, b * k];
    if (ring.every(([dx, dy]) => inside_squircle(x + dx, y + dy, a, b, POD_SIDE_N))) {
      t = k;
      break;
    }
  }
  const [x, y] = [a * t, b * t];
  return [
    [cx - x, cy - y],
    [cx + x, cy - y],
    [cx - x, cy + y],
    [cx + x, cy + y],
  ];
}
