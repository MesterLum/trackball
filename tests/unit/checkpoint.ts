import type { Values } from '../../packages/core/src/index';

/**
 * Settings added after the Python checkpoint, set to reproduce its behaviour, so the fixtures stay
 * a true parity check. Rows marked `rebaselined` follow deliberate changes with no such setting.
 */
export const CHECKPOINT: Partial<Values> = {
  mcu_hold: 'glue',
  palm_corners: 'rounded',
  sensor_relief: 0,
  // The checkpoint put the lens 3.6 mm over the board, not the datasheets' 3.4: the same ball
  // height over the board is 0.2 mm more lens-to-ball distance.
  sensor_adjust: 0.2,
  sensor_mount: 'plate',
};
