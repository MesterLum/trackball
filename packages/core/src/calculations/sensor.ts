// Optical sensors and their lens stack, from PixArt's datasheets: the assembly drawing (top of the
// PCB to the navigation surface, with a 1.60 mm PCB) and the Z row of the operating conditions
// (lens reference plane, the bottom of the lens flange, to the surface).
//   PMW3360DM-T2QU datasheet v1.30, Figure 4 and Table 3.
//   PMW3389DM-T3QU datasheet v1.0, Figure 5 and the operating conditions.
//   PMW3610DM-SUDU datasheet R2.4, Figure 4 and the operating conditions.

export interface Sensor {
  name: string;
  lens: string;
  /** Top of the PCB (the sensor's side) to the navigation surface, the ball. */
  pcb_top_to_surface: number;
  /** Lens reference plane to the surface: the datasheet's minimum, typical and maximum. */
  z: { min: number; typ: number; max: number };
}

const Z = { min: 2.2, typ: 2.4, max: 2.6 };

export const SENSORS: Record<string, Sensor> = {
  pmw3360: { name: 'PMW3360', lens: 'LM19-LSI', pcb_top_to_surface: 7.4, z: Z },
  pmw3389: { name: 'PMW3389', lens: 'LM19-LSI', pcb_top_to_surface: 7.4, z: Z },
  pmw3610: { name: 'PMW3610', lens: 'LM18-LSI', pcb_top_to_surface: 7.4, z: Z },
};

/**
 * The lens stack on a board of the given thickness: the lens reference plane above the board's
 * lens side, and its typical distance to the ball. The sensor sits on the board's other side and
 * the lens clips to it, so a thicker board brings its lens side closer to the lens.
 */
export function lens_stack(sensor: Sensor, pcb_thickness: number) {
  return {
    top_above_pcb: sensor.pcb_top_to_surface - sensor.z.typ - pcb_thickness,
    lens_to_ball: sensor.z.typ,
  };
}
