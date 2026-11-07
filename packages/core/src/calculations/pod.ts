// Compact desk pod: a ball-only body whose shell wraps the cup, with steel weights in the base.

/** Shell wall thickness: clear filament prints evenly and looks tidy at a uniform, thicker wall. */
export const POD_WALL = { solid: 2.0, clear: 2.4 } as const;
/** Flat ring around the cup opening before the shell starts to fall away. */
export const POD_LIP = 1.5;
/** Short controller standoffs in a pod; their screw holes continue into the floor below. */
export const POD_STANDOFF = 1.0;
export const POD_STANDOFF_SINK = 2.5;
/** Floor left over a pod's weight cup: the cup has its own bottom, so the floor above it is thin. */
export const POD_CUP_CEILING = 1.2;
/**
 * Short screws from under the base into the sensor plate: the post is pocketed from below so an
 * M3x8 machine screw's head sits near its top, passes the post's solid top and the plate, and
 * bites an M3 hex nut dropped into a pocket on top of the plate.
 */
export const POD_SCREW = {
  length: 8,
  clear_dia: 3.4,
  head_dia: 6.4,
  /** Solid top of the post under the screw head. */
  top: 3.0,
  /** Across flats and depth of the nut pocket (M3 nut: 5.5 x 2.4). */
  nut_af: 5.7,
  nut_depth: 2.6,
  /** Posts are thick enough to pocket the head. */
  post_dia: 9.0,
};
/** A pod's feet sit in deeper recesses, and must be wide enough to cover the screw pockets. */
export const POD_FEET = { depth: 1.5, min_dia: POD_SCREW.head_dia + 1.6 };

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
    /** Depth of the weight chamber under the base (0 = none) and how it closes. */
    this.weight_depth = values.weight_depth ?? 6;
    this.weight_cap = values.weight_cap ?? 'thread';
    /** Cradle pod: a walled base meeting the shell at a seam, or the shell down to the desk. */
    this.base = values.base ?? 'walled';
    /** Cradle pod: design on the lower wall. */
    this.side = values.side ?? 'band';
  }
  get walled(): boolean {
    return this.cradle && this.base === 'walled';
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
 * chamfer on both sides of the seam between the shell and the walled base.
 */
export const CRADLE = {
  edge: 5.0,
  /** The cup rises at least this far above the base: on small balls the rim moves up for it. */
  min_cup: 10.0,
  fillet: 4.0,
  lip: 1.2,
  notch_w: 0.45,
  notch_depth: 0.6,
  bevel: 1.2,
  /** Chamfer on both edges of the seam; 0 makes the shell and base meet flush. */
  seam_chamfer: 0,
  /** The cup is at least this share of the body's half width. */
  cup_share: 0.72,
  /** Recessed band around the lower wall: depth and its span as shares of the wall's height. */
  band_depth: 0.6,
  band_from: 0.3,
  band_to: 0.7,
  /** Grooves around the lower wall: count, depth and half height of their V. */
  grooves: 3,
  groove_depth: 0.5,
  groove_half: 0.5,
};

export interface CradleShape {
  /** Height of the base's top, where the cup rises from it. */
  edge: number;
  /** Height of the cup's flat rim. */
  rim: number;
  /** Outer radius of the cup, the concave fillet where it meets the base, and the bevel from the
   * rim down into the ball (zero when the rim is narrow). */
  cup_r: number;
  fillet: number;
  funnel: number;
  /** Half width of the front notch and the height of its rounded bottom. */
  notch_r: number;
  notch_bottom: number;
  /** Height of the seam: the base's wall rises to it, the shell starts there. */
  seam: number;
}
/**
 * Cradle pod: a round cup with a flat rim (at the rim depth) rising from a low soft-square base,
 * with a U-shaped notch in front that leaves a horn on each side. The base's top just clears the
 * plates inside; the notch stops above it.
 */
export function cradle_shape(d: any): CradleShape {
  // The top just covers the sensor plate (wall plus a fitting gap) ...
  const R = d.ball.r,
    edge = d.z_carrier_top + d.pod.wall + POD_FIT,
    // ... and the cup keeps a minimum height, so a small ball's rim rises above its middle (the
    // wall is straight there, so the ball still lifts out).
    rim = Math.max(-d.cup.rim_below_center, edge + CRADLE.min_cup);
  // Three millimetres over the cup wall keep the support bores inside it; with a small ball the
  // body is set by the sensor board, so the cup follows the body instead to stay in proportion.
  const half = Math.min(d.half_width, d.half_length),
    cup_r = Math.max(d.cavity_r + d.cup.wall + 3, CRADLE.cup_share * half);
  return {
    edge,
    rim,
    cup_r,
    // The fillet stays on the base's flat top, inside its rounded edge.
    fillet: Math.max(Math.min(CRADLE.fillet, half - CRADLE.edge - cup_r - 0.5), 1),
    // A wide rim falls into the ball through a bevel.
    funnel: Math.min(Math.max((cup_r - d.cavity_r - d.cup.wall - 3) * 0.5, 0), 4),
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
    // The notch floor stays above the base and over the shell's insert holes beside it.
    notch_bottom: Math.max(
      rim - CRADLE.notch_depth * R,
      edge + 1.5,
      d.z_cup_bottom + d.cup.insert_depth + 1.5,
    ),
    // Just under the sensor plate's underside, so the base's wall closes the electronics bay; with
    // the shell down to the desk there is no seam above the floor.
    seam: d.pod.walled ? d.z_pcb_face - 1 : d.z_floor_bottom,
  };
}

/**
 * The weight cap: a small cup that holds the weights and screws (or locks) into the underside of
 * the base, flush with it, the base's floor closing it from above. A printed screw thread or a
 * bayonet (three lugs, push in and turn), with a slot to turn it with a coin. Clearances suit FDM.
 */
export const WEIGHT_CAP = {
  /** Bottom and side walls of the cup. */
  bottom: 1.6,
  wall: 1.6,
  thread: { pitch: 3.0, depth: 0.9 },
  clearance: 0.35,
  lug: { count: 3, width: 6.0, radial: 1.6, height: 2.2, turn: 60 },
  slot: { length: 18, width: 1.8, depth: 0.8 },
};
export type WeightCap = 'thread' | 'bayonet' | 'none';
export interface Ballast {
  cap: WeightCap;
  /** The space for weights: inside the cap's cup, or an open pocket without a cap. */
  dia: number;
  depth: number;
  /** The cup's bottom under that space (0 without a cap) and the total height under the floor. */
  seat: number;
  total: number;
  /** Outermost radius the closure cuts into the base (thread with clearance, or bayonet slots). */
  outer_r: number;
  /** Largest standard washer that fits, and how many stack in the chamber (null if none fits). */
  washer: Washer | null;
  count: number;
  mass: number;
}

/**
 * Weight pocket under the base: the largest washer whose pocket keeps a solid rim inside the
 * walls and clears the feet over the corner screws.
 */
export function pod_ballast(d: any): Ballast | null {
  const pod: Pod = d.pod;
  if (!pod.enabled || pod.weight_depth <= 0) return null;
  const t = d.tray;
  const half = Math.min(d.half_width, d.half_length);
  const [x, y] = d.lid_screw_points()[3];
  const keep = Math.max(t.feet_dia, d.carrier.screw_head_dia) / 2 + 1.0;
  const room = Math.min(half - t.wall - 1.0, Math.hypot(x, y - d.footprint[3]) - keep);
  const cap: WeightCap = pod.weight_cap;
  const k = WEIGHT_CAP;
  // The space for weights is the inside of the cup: inside its thread or lugs and its wall.
  const r =
    cap === 'thread'
      ? room - k.thread.depth - k.clearance - k.wall
      : cap === 'bayonet'
        ? room - k.lug.radial - k.clearance - k.wall
        : room;
  if (r < 8) return null;
  const seat = cap === 'none' ? 0 : k.bottom;
  const depth = pod.weight_depth;
  const fits = WASHERS.filter((w) => w.od + 0.6 <= 2 * r);
  const washer = fits[fits.length - 1] ?? null;
  const count = washer ? Math.floor((depth - 0.2) / washer.t) : 0;
  return {
    cap,
    dia: 2 * r,
    depth,
    seat,
    total: depth + seat,
    outer_r: room,
    washer,
    count,
    mass: washer ? count * washer_mass(washer) : 0,
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
