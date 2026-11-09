// Screwed clamp bar that holds a controller without mounting holes in its pocket.
// The pad presses only on a user-set, part-free area at the board's far end (away from the USB).

/** Fixed clamp dimensions in mm. */
export const CLAMP = {
  /** Bar thickness; its top stays inside the component + clearance room above the board. */
  bar: 2.8,
  /** Bar underside above the board outside the pad, so it clears pads and wires. */
  relief: 1.4,
  /** The bar flexes this much when the screws are tight, which keeps the pad pressed. */
  preload: 0.15,
  /** Minimum bar width along the board (covers the screw holes). */
  min_span: 5.0,
  /**
   * Screw posts beside the pocket, for the build's M3 heat-set inserts (Ø4 x 5 mm): 1.5 mm of wall
   * around the insert (solid with 4 perimeters), a 45° foot into the floor, and the post's centre
   * this far from the pocket's edge, which leaves 0.6 mm of frame between them.
   */
  post_dia: 7.0,
  post_foot: 1.5,
  post_offset: 4.1,
  insert_dia: 4.0,
  /** The insert's hole, from the post top: its 5 mm and a little room under it. */
  insert_depth: 5.5,
  /** Floor left between an insert hole and a weight chamber under it. */
  insert_floor: 0.8,
  /** M3 clearance through the bar, and the round boss around each hole at the bar's ends. */
  clear_dia: 3.4,
  /** M3x8 button-head screw: the head's height over the bar. */
  head_h: 1.7,
  /** Half the size of a tactile button, for the BOOT button check. */
  button_half: 1.5,
};

/** Air left over the clamp screws' heads, under the sensor board. */
export const CLAMP_TOP_CLEAR = 0.5;
/** Extra width on each side of the pocket frame taken by the screw posts. */
export const CLAMP_SIDE_EXTRA = CLAMP.post_offset + CLAMP.post_dia / 2 - 1.5;

export interface ClampLayout {
  /** Board-local coordinates: a along the board (USB end at +length/2), c across, z up. */
  far_end: number;
  /** Bar extent along the board. */
  a0: number;
  a1: number;
  /** Pad extent along and across. */
  pad_a1: number;
  pad_half_c: number;
  /** Screw post centres across the board. */
  post_c: number;
  /** Bar extent across. */
  half_c: number;
  /** Board top, post top and bar top (world z). */
  board_top: number;
  post_top: number;
  bar_top: number;
}

export function clamp_layout(d: any): ClampLayout | null {
  if (!d.mcu_clamped) return null;
  const t = d.tray;
  const m = t.mcu;
  const pw = m.width + 2 * t.pocket_clear;
  const far_end = -m.length / 2;
  const span = Math.max(t.clamp_length, CLAMP.min_span);
  const post_c = pw / 2 + CLAMP.post_offset;
  const board_top = d.z_floor_top + d.mcu_standoff_h + m.thickness;
  return {
    far_end,
    a0: far_end,
    a1: far_end + span,
    pad_a1: far_end + t.clamp_length,
    pad_half_c: t.clamp_width / 2,
    post_c,
    half_c: post_c + CLAMP.post_dia / 2,
    board_top,
    post_top: board_top + CLAMP.relief - CLAMP.preload,
    bar_top: board_top + CLAMP.bar,
  };
}

/** World xy of the clamp's two screw posts (the board's frame turned as in the tray). */
export function clamp_post_points(d: any): number[][] {
  const l = clamp_layout(d);
  if (!l) return [];
  const t = d.tray;
  const a = (l.a0 + l.a1) / 2;
  const [x, y] = d.mcu_center();
  return [-l.post_c, l.post_c].map((c) =>
    t.usb_exit === 'back' ? [x - c, y + a] : [x + t.usb_side * a, y + t.usb_side * c],
  );
}
/** How far the insert holes reach below the floor's top (0 when they stay in the post). */
export function clamp_insert_sink(d: any): number {
  const l = clamp_layout(d);
  if (!l) return 0;
  return Math.max(CLAMP.insert_depth - (l.post_top - d.z_floor_top), 0);
}
