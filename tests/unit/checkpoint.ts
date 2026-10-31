import type { Values } from '../../packages/core/src/index';

/**
 * Settings added after the Python checkpoint, set to reproduce its behaviour, so the fixtures stay
 * a true parity check. Rows marked `rebaselined` follow deliberate changes with no such setting.
 */
export const CHECKPOINT: Partial<Values> = { mcu_hold: 'glue', palm_corners: 'rounded' };
