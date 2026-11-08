// How a printer's parts come out against their nominal size, added to every fitted joint. FDM
// lines squish wider than drawn and small holes print as polygons, so holes shrink and sliding
// parts get tight; how much depends on the printer, filament and slicer.

/** Fit test: the columns sit this many steps around the current setting (tighter, the setting,
 * looser, looser still). */
export const FIT_STEPS = [-1, 0, 1, 2];
/** One step: on a hole's diameter, and on each side of a sliding fit (the same 0.05 mm per wall). */
export const FIT_STEP = { hole: 0.1, gap: 0.05 };

export class Fit {
  /** Added to the diameter of every hole a bought part goes into: BTUs, inserts, screws, nuts. */
  hole: number;
  /** Added on each side where printed parts slide or screw together. */
  gap: number;
  constructor(values: { hole?: number; gap?: number } = {}) {
    this.hole = values.hole ?? 0;
    this.gap = values.gap ?? 0;
  }
}
