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
  /** Screw posts beside the pocket. */
  post_dia: 5.0,
  /** Post centre beyond the pocket edge. */
  post_offset: 3.0,
  pilot_dia: 1.8,
  pilot_depth: 6.0,
  clear_dia: 2.4,
  /** Half the size of a tactile button, for the BOOT button check. */
  button_half: 1.5,
};

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
