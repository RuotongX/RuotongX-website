// Material ids shared by the voxelizer (worker) and the renderer (palette uniforms).
export const MAT = {
  PLASTER: 0, // main body
  STONE: 1, // secondary / plinths
  INK: 2, // details, boots, skirt
  ACCENT: 3, // falu red
  LED: 4, // blinking emissive
  SCREEN: 5, // dark glass
  WOOD: 6,
  SAGE: 7,
  GOLD: 8,
  WAVE: 9, // pulsing emissive accent
  SPRUCE: 10, // pale wood
  SNOW: 11,
  TEAL: 12, // Miku
  SKIN: 13,
  PINK: 14,
  SILVER: 15,
  TEAL_DEEP: 16, // spare darker teal
  EYE: 17, // brown eyes / face lines
  BLUSH: 18, // cheeks, inside of the smile
  // 3D printer parts: the shader animates these by id (see printerAnim in shaders.ts)
  GANTRY: 19, // X gantry: rises with the print
  HEAD: 20, // toolhead: rises and sweeps left/right
  BED: 21, // build plate: slides front/back
  PRINT: 22, // the part being printed: hidden above the current layer
} as const;

export const MAT_COUNT = 23;

// sRGB hex palettes. Index = material id.
export const PALETTE_DAY = [
  '#f4f0e8', // plaster
  '#d6cec0', // stone
  '#2a2a2e', // ink
  '#b0412b', // accent (falu red)
  '#4fb06d', // led
  '#2b2b2e', // screen
  '#b98352', // wood
  '#7f9a7d', // sage
  '#c79a43', // gold
  '#c4482f', // wave
  '#ead6ad', // spruce
  '#ffffff', // snow
  '#3cc4ba', // teal (Miku #39C5BB)
  '#f8e8de', // skin
  '#e2507e', // pink
  '#c9ced4', // silver
  '#249a92', // teal deep
  '#4a2a20', // eye (brown)
  '#f3a4b2', // blush
  '#34363a', // gantry
  '#f3f2ee', // toolhead
  '#4d4641', // bed (textured PEI)
  '#3cc4ba', // print (teal PLA)
];

export const PALETTE_NIGHT = [
  '#77736b', // plaster -> warm graphite
  '#4f4c46', // stone
  '#18181b', // ink
  '#ec6a45', // accent
  '#69ff9c', // led
  '#22324a', // screen
  '#93613a', // wood
  '#62816a', // sage
  '#e0b257', // gold
  '#ff7a50', // wave
  '#a58b62', // spruce
  '#e6ebf2', // snow
  '#33b5ab', // teal
  '#cdb6a8', // skin
  '#ff5c8f', // pink
  '#8d949c', // silver
  '#1d7f78', // teal deep
  '#3a221b', // eye (brown)
  '#e88a9c', // blush
  '#1c1d20', // gantry
  '#b9b7b1', // toolhead
  '#2c2826', // bed
  '#33b5ab', // print (teal PLA)
];

/** How much each material glows (0..1) in [day, night]. */
export const EMISSIVE: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0, 0], [0, 0], [0.05, 0.3], [0.85, 1], [0.05, 0.45],
  [0, 0], [0, 0], [0.05, 0.2], [0.5, 1], [0, 0], [0, 0.05],
  [0, 0.1], [0, 0], [0.1, 0.5], [0, 0], [0, 0.05], [0, 0],
  [0.05, 0.25],
  [0, 0], [0, 0.05], [0, 0], [0, 0.1],
];
