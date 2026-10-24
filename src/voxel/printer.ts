// Heights of the 3D-printer form, shared by the SDF (worker) and the stage (print animation uniforms).
// Kept in its own module so the main bundle doesn't pull in every shape.
const BED_TOP = -0.856;
export const PRINTER = { bedTop: BED_TOP, printTop: BED_TOP + 0.3 } as const;
