// Fit test: a small print with this design's fitted holes and joints, each in four columns from
// one step tighter than the current setting to two steps looser, so one print shows which way
// (and how far) to move the print fit settings.
import { add, sub } from '../math.js';
import { cube, cylinder, hull, union } from '../scad/index.js';
import { FIT_STEP, FIT_STEPS } from '../calculations/fit.js';
import { POD_FOOT_CHAMFER, POD_SCREW, WEIGHT_CAP, cap_clearance } from '../calculations/pod.js';
import { EPS, zcyl } from './common.js';
import { JOINT_CLEAR } from './palmrest.js';
import { thread_solid } from './thread.js';

/** Floor left under blind holes, margin around each hole, and the band holding the column dots. */
const FLOOR = 1.5;
const MARGIN = 3.5;
const DOTS = 2.5;
/** Side of the square plug and its sockets, and the threaded test's major radius. */
const PLUG = 12;
const THREAD_R = 7;

interface Row {
  /** Largest outline across the columns, and the bar's thickness. */
  size: number;
  height: number;
  /** The cut for a column, centred on the origin, the bar spanning z = 0..height. */
  cut: (step: number) => any;
}

function box(x: number, y: number, z: number, z0 = 0): any {
  return cube([x, y, z]).translate([-x / 2, -y / 2, z0]);
}
/** Dots engraved on the top face, as many as the column's number. */
function dots(count: number, height: number): any {
  return union()(
    ...Array.from({ length: count }, (_, i) =>
      zcyl(1.0, height - 0.4, height + 1, 16).translate([(i - (count - 1) / 2) * 1.6, 0, 0]),
    ),
  );
}

function rows(d: any): Row[] {
  const fn = d.fn,
    hole = (step: number) => step * FIT_STEP.hole,
    gap = (step: number) => step * FIT_STEP.gap;
  const out: Row[] = [];
  const s = d.cup.support;
  if (s.kind === 'btu') {
    const dia = s.shaft_dia + s.press_fit_oversize;
    out.push({
      size: dia,
      height: s.shaft_len + FLOOR,
      cut: (k) => zcyl(dia + hole(k), FLOOR, s.shaft_len + FLOOR + 1, fn),
    });
  }
  const insert = d.cup.insert_dia + d.fit.hole;
  out.push({
    size: insert,
    height: d.cup.insert_depth + FLOOR,
    cut: (k) => zcyl(insert + hole(k), FLOOR, d.cup.insert_depth + FLOOR + 1, fn),
  });
  const screw = (d.is_pod ? POD_SCREW.clear_dia : d.carrier.screw_clear_dia) + d.fit.hole;
  out.push({ size: screw, height: 3, cut: (k) => zcyl(screw + hole(k), -1, 4, fn) });
  if (d.is_pod) {
    const af = POD_SCREW.nut_af + d.fit.hole,
      h = POD_SCREW.nut_depth + FLOOR;
    out.push({
      size: af / Math.cos(Math.PI / 6),
      height: h,
      cut: (k) => {
        const r = (af + hole(k)) / 2 / Math.cos(Math.PI / 6);
        return add(
          zcyl(screw, -1, h + 1, fn),
          cylinder(POD_SCREW.nut_depth + 1, r, undefined, undefined, undefined, false, 6).up(FLOOR),
        );
      },
    });
  }
  // Square sockets for the plug: the shell over its base, or the palm rest's tongue joint.
  const slide = d.is_pod ? d.pod.fit : JOINT_CLEAR + d.fit.gap;
  out.push({
    size: PLUG + 2 * slide,
    height: 4,
    cut: (k) => box(PLUG + 2 * (slide + gap(k)), PLUG + 2 * (slide + gap(k)), 6, -1),
  });
  if (d.ballast?.cap === 'thread') {
    const t = WEIGHT_CAP.thread,
      h = 2 * t.pitch;
    out.push({
      size: 2 * THREAD_R,
      height: h,
      cut: (k) =>
        thread_solid(t, THREAD_R - t.depth + gap(k), h + 2 * t.pitch, fn).translate([0, 0, -t.pitch]),
    });
  }
  return out;
}

/** The parts to try in the sockets: the square plug and, with a threaded cap, a short bolt. */
function plugs(d: any): any[] {
  const k = POD_FOOT_CHAMFER;
  const out = [hull()(box(PLUG - 2 * k, PLUG - 2 * k, EPS), box(PLUG, PLUG, 8 - k, k))];
  if (d.ballast?.cap === 'thread') {
    const t = WEIGHT_CAP.thread;
    out.push(
      add(
        zcyl(2 * THREAD_R + 4, 0, 3, d.fn),
        thread_solid(t, THREAD_R - t.depth - cap_clearance(d), 3 * t.pitch, d.fn).up(3),
      ),
    );
  }
  return out;
}

/** The fit test, laid out flat for printing: the stepped plate, with its plugs beside it. */
export function fit_test(d: any): any {
  const bars: any[] = [];
  let y = 0,
    width = 0;
  for (const row of rows(d)) {
    const pitch = row.size + MARGIN,
      depth = row.size + MARGIN + DOTS;
    width = Math.max(width, FIT_STEPS.length * pitch);
    const cuts = FIT_STEPS.map((step, i) => {
      const x = (i - (FIT_STEPS.length - 1) / 2) * pitch;
      return union()(
        row.cut(step).translate([x, DOTS / 2, 0]),
        dots(i + 1, row.height).translate([x, -depth / 2 + DOTS / 2 + 0.3, 0]),
      );
    });
    bars.push(
      sub(box(FIT_STEPS.length * pitch, depth, row.height), union()(...cuts)).translate([
        0,
        y + depth / 2,
        0,
      ]),
    );
    y += depth;
  }
  let x = width / 2 + 4;
  const extra = plugs(d).map((p, i) => {
    const r = i === 0 ? PLUG / 2 : THREAD_R + 2;
    const placed = p.translate([x + r, r, 0]);
    x += 2 * r + 4;
    return placed;
  });
  return union()(...bars, ...extra);
}
