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
  TEAL_DEEP: 16, // shading inside the twin tails
  EYE: 17, // glowing teal eyes
} as const;

export const MAT_COUNT = 18;

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
  '#fbe1cf', // skin
  '#e2507e', // pink
  '#c9ced4', // silver
  '#249a92', // teal deep
  '#1f9d94', // eye
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
  '#d7b7a3', // skin
  '#ff5c8f', // pink
  '#8d949c', // silver
  '#1d7f78', // teal deep
  '#5cf2e4', // eye
];

/** How much each material glows (0..1) in [day, night]. */
export const EMISSIVE: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0, 0], [0, 0], [0.05, 0.3], [0.85, 1], [0.05, 0.45],
  [0, 0], [0, 0], [0.05, 0.2], [0.5, 1], [0, 0], [0, 0.05],
  [0, 0.1], [0, 0], [0.1, 0.5], [0, 0], [0, 0.05], [0.2, 0.9],
];
