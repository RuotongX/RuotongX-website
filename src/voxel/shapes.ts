// The sculpture's forms, authored as signed distance fields (sign is what matters for voxels).
// Coordinates: y up, +z faces the viewer, everything roughly inside [-1, 1]^3.
import {
  Acc, box2, cappedCylinder, capsule, circle2, clamp, cylinderY, ellipsoid, extrude, roundBox, smin, sphere, taper,
} from './sdf';
import { MAT } from './materials';
import type { Grid, ShapeDef } from './voxelize';
import { AUCKLAND, NZ_RINGS } from '../data/nz';
import { PRINTER } from './printer';

const {
  PLASTER, STONE, INK, ACCENT, LED, SCREEN, WOOD, SAGE, GOLD, WAVE, SPRUCE, SNOW,
  TEAL, SKIN, PINK, SILVER, EYE, BLUSH, GANTRY, HEAD, BED, PRINT,
} = MAT;

// ---------------------------------------------------------------- Hatsune Miku as a fuwa petit ("fufu") plush
// Proportions traced from SEGA's front photo of the L plush: 1 unit = 400 px, floor at y = -1.
// Big mochi head, tiny sitting body, feet forward, two huge floppy twin tails.
const TAIL: ReadonlyArray<readonly [number, number, number, number]> = [
  // x (mirrored), y, z, radius
  [0.47, 0.46, -0.08, 0.1],
  [0.7, 0.35, -0.1, 0.145],
  [0.9, 0.05, -0.1, 0.195],
  [1.03, -0.32, -0.1, 0.205],
  [1.08, -0.62, -0.08, 0.17],
];
const TAIL_Z = 1.3; // the tails are puffier front-to-back than they look from the front

/** Lower edge of the hair over the face, traced in photo pixels (x -> y). */
function bangEdge(px: number) {
  if (px < 125) return 150;
  if (px < 265) return 140 + (px - 125) * 1.32; // the big swept bang, long diagonal side
  if (px < 300) return 325 - 5 * (px - 265); //   ...and its short steep side
  if (px < 350) return 150 + (px - 300) * 0.7;
  return 185 + 1.875 * (px - 350); // lock covering the right edge of the face
}
/** True where the face shows through the hair, seen from the front. */
function faceWindow(x: number, y: number) {
  const px = 400 * x + 235, py = 320 - 400 * y;
  return px > 100 && px < 410 && py > bangEdge(px);
}

function miku(x: number, y: number, z: number, a: Acc) {
  const ax = Math.abs(x);

  // ---- legs straight out, round teal boots
  for (const s of [-1, 1]) {
    a.add(capsule(x, y, z, s * 0.25, -0.86, -0.05, s * 0.29, -0.88, 0.26, 0.1), INK);
    a.add(ellipsoid(x - s * 0.3, y + 0.88, z - 0.35, 0.125, 0.115, 0.115), TEAL);
  }
  // ---- skirt: dark, flared, teal hem
  const skirtT = clamp((-0.62 - y) / 0.26, 0, 1);
  const skirtRz = 0.22 + 0.06 * skirtT;
  {
    const rx = 0.3 + 0.1 * skirtT;
    const d = Math.max(Math.hypot(x / rx, z / skirtRz) - 1, (Math.abs(y + 0.75) - 0.13) / 0.25) * 0.25;
    a.add(d, INK);
    if (d <= 0 && y < -0.84) a.paint(-1, TEAL);
  }
  // ---- grey sleeveless shirt: teal collar edge and dashed piping
  a.add(roundBox(x, y + 0.47, z, 0.24, 0.23, 0.17, 0.1), SILVER);
  if (a.d <= 0 && a.m === SILVER) {
    if (y > -0.37 && y < -0.33 && ax > 0.05 && ax < 0.2 && z > 0) a.paint(-1, TEAL);
    if (y < -0.63 && y > -0.67 && Math.floor((x + 1) / 0.05) % 2 === 0) a.paint(-1, TEAL);
  }
  // ---- the big teal tie, lying on the shirt and then the skirt
  {
    const ty = -y;
    let hw = -1;
    if (ty >= 0.25 && ty < 0.33) hw = 0.04;
    else if (ty >= 0.33 && ty < 0.68) hw = 0.03 + (ty - 0.33) * 0.19;
    else if (ty >= 0.68 && ty < 0.8) hw = (0.096 * (0.8 - ty)) / 0.12;
    if (hw > 0) {
      const zc = Math.max(0.17, y < -0.62 ? skirtRz : 0) + 0.005;
      a.add(Math.max(Math.abs(x - 0.02 * (ty - 0.25)) - hw, Math.abs(z - zc) - 0.03), TEAL);
    }
  }
  // ---- arms: skin shoulders, long dark sleeves with teal cuffs, tiny hands
  for (const s of [-1, 1]) {
    a.add(capsule(x, y, z, s * 0.22, -0.32, 0, s * 0.4, -0.47, 0.04, 0.07), SKIN);
    const d = taper(x, y, z, s * 0.37, -0.45, 0.04, s * 0.63, -0.74, 0.12, 0.08, 0.1);
    a.add(d, INK);
    // teal cuff: the last stretch of the sleeve
    const t = ((ax - 0.37) * 0.26 + (-0.45 - y) * 0.29) / (0.26 * 0.26 + 0.29 * 0.29);
    if (d <= 0 && x * s > 0 && t > 0.8) a.paint(-1, TEAL);
    a.add(sphere(x - s * 0.67, y + 0.81, z - 0.13, 0.06), SKIN);
  }
  if (a.d <= 0 && a.m === SKIN && sphere(x - 0.33, y + 0.39, z - 0.06, 0.03) < 0) a.paint(-1, ACCENT); // the "01"

  // ---- head: a pale face under a teal hair dome; the face shows through a window under the bangs
  a.add(ellipsoid(x, y - 0.25, z - 0.02, 0.47, 0.49, 0.44), SKIN);
  if (!(z > 0.08 && faceWindow(x, y))) a.add(ellipsoid(x, y - 0.28, z, 0.53, 0.52, 0.5), TEAL);
  a.add(taper(x, y, z, -0.42, 0.35, 0.22, -0.4, -0.33, 0.18, 0.07, 0.02), TEAL); // long lock, left
  a.add(taper(x, y, z, 0.43, 0.05, 0.22, 0.38, -0.42, 0.2, 0.035, 0.012), TEAL); // thin strand, right

  // face
  if (a.d <= 0 && a.m === SKIN && z > 0.2) {
    for (const s of [-1, 1]) {
      if (((x - s * 0.235) / 0.042) ** 2 + ((y - 0.035) / 0.068) ** 2 < 1) a.paint(-1, EYE);
      const bx = (x - s * 0.26) / 0.045;
      if (Math.abs(bx) < 1 && Math.abs(y - 0.3 - 0.02 * (1 - bx * bx)) < 0.014) a.paint(-1, EYE); // brows
      if (((x - s * 0.28) / 0.06) ** 2 + ((y + 0.08) / 0.032) ** 2 < 1) a.paint(-1, BLUSH);
    }
    // open smile: a D shape, flat on top, brown outline
    const mx = x / 0.095, my = (y + 0.09) / 0.1, r2 = mx * mx + my * my;
    if (my < 0 && r2 < 1) a.paint(-1, r2 > 0.55 || my > -0.25 ? EYE : BLUSH);
  }

  // ---- hair ties: dark tubes on top of the head, tilted outward, pink band
  for (const s of [-1, 1]) {
    const bx = s * 0.37, by = 0.46, tx = s * 0.52, ty = 0.77;
    const d = cappedCylinder(x, y, z, bx, by, -0.05, tx, ty, -0.05, 0.1);
    a.add(d, INK);
    if (d <= 0) {
      const t = ((x - bx) * (tx - bx) + (y - by) * (ty - by)) / ((tx - bx) ** 2 + (ty - by) ** 2);
      if (t > 0.5 && t < 0.76) a.paint(-1, PINK);
    }
  }
  // ---- headphones: dark ovals on the sides, pink rim at the back
  {
    const e = Math.hypot((y - 0.05) / 0.19, z / 0.155);
    const d = Math.max((e - 1) * 0.155, Math.abs(ax - 0.52) - 0.065);
    a.add(d, INK);
    if (d <= 0 && ax > 0.55 && e > 0.62 && z < 0.06) a.paint(-1, PINK);
  }
  // ---- twin tails: puffy paddles from the ties down to the floor
  let best = 1e9;
  for (let i = 0; i < TAIL.length - 1; i++) {
    const [x0, y0, z0, r0] = TAIL[i], [x1, y1, z1, r1] = TAIL[i + 1];
    best = Math.min(best, taper(ax, y, z / TAIL_Z, x0, y0, z0 / TAIL_Z, x1, y1, z1 / TAIL_Z, r0, r1));
  }
  a.add(best, TEAL);
}

// ---------------------------------------------------------------- two chat bubbles (building with an AI pair)
function chat(x: number, y: number, z: number, a: Acc) {
  // mine: big teal bubble, tail bottom-left
  const bx = x + 0.2, by = y - 0.3, bz = z + 0.08;
  const b2 = Math.min(box2(bx, by, 0.6, 0.32, 0.3), capsule(bx, by, 0, -0.3, -0.18, 0, -0.5, -0.46, 0, 0.07));
  a.add(extrude(b2 + 0.05, bz, 0.075) - 0.05, TEAL);
  if (a.d <= 0 && a.m === TEAL && bz > 0.07) {
    if (Math.abs(by - 0.1) < 0.035 && Math.abs(bx + 0.02) < 0.38) a.paint(-1, PLASTER);
    if (Math.abs(by + 0.04) < 0.035 && Math.abs(bx + 0.12) < 0.28) a.paint(-1, PLASTER);
  }
  // the reply: smaller paper bubble in front, tail bottom-right, typing dots
  const rx = x - 0.32, ry = y + 0.32, rz = z - 0.16;
  const r2 = Math.min(box2(rx, ry, 0.36, 0.2, 0.2), capsule(rx, ry, 0, 0.2, -0.1, 0, 0.36, -0.32, 0, 0.055));
  a.add(extrude(r2 + 0.04, rz, 0.065) - 0.04, PLASTER);
  for (const dx of [-0.13, 0, 0.13]) a.add(roundBox(rx - dx, ry, rz - 0.12, 0.045, 0.045, 0.045, 0.012), INK);
}

// ---------------------------------------------------------------- acoustic guitar
function guitar(x: number, y: number, z: number, a: Acc) {
  const d2 = smin(circle2(x, y + 0.5, 0.4), circle2(x, y - 0.05, 0.3), 0.18);
  a.add(extrude(d2 + 0.03, z, 0.08) - 0.03, WOOD);
  if (a.d <= 0 && z > 0.07) {
    a.paint(-1, SPRUCE);
    if (d2 > -0.02) a.paint(-1, INK); // binding
    const r = circle2(x, y + 0.12, 0);
    if (r > 0.12 && r < 0.155) a.paint(-1, ACCENT); // rosette
  }
  // sound hole
  a.cut(Math.max(circle2(x, y + 0.12, 0.115), -(z - 0.03)), INK);
  // bridge + saddle
  a.add(roundBox(x, y + 0.64, z - 0.12, 0.16, 0.035, 0.03, 0.012), INK);
  a.add(roundBox(x, y + 0.625, z - 0.15, 0.1, 0.012, 0.02), GOLD);
  // neck, fretboard, frets
  a.add(roundBox(x, y - 0.62, z - 0.03, 0.06, 0.4, 0.05, 0.025), WOOD);
  if (a.d <= 0 && z > 0.035 && y > 0.22 && y < 1.02) {
    a.paint(-1, INK);
    if ((((y - 0.25) / 0.08) % 1) < 0.24) a.paint(-1, GOLD);
  }
  // headstock + tuners
  a.add(roundBox(x, y - 1.13, z, 0.095, 0.12, 0.035, 0.03), INK);
  for (const s of [-1, 1]) for (const ty of [1.05, 1.13, 1.21]) a.add(roundBox(x - s * 0.13, y - ty, z, 0.035, 0.02, 0.02, 0.008), GOLD);
  // strings over the body (two visible lines between bridge and neck)
  for (const sx of [-0.03, 0.03]) a.add(roundBox(x - sx, y + 0.2, z - 0.135, 0.012, 0.44, 0.012), PLASTER);
}

// ---------------------------------------------------------------- home lab rack
function rack(x: number, y: number, z: number, a: Acc) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) a.add(roundBox(x - sx * 0.5, y + 0.05, z - sz * 0.4, 0.04, 0.92, 0.04, 0.012), INK);
  a.add(roundBox(x, y - 0.9, z, 0.56, 0.035, 0.46, 0.012), INK);
  a.add(roundBox(x, y + 0.97, z, 0.56, 0.035, 0.46, 0.012), INK);

  // 1U switch
  a.add(roundBox(x, y - 0.67, z, 0.46, 0.09, 0.36, 0.012), PLASTER);
  for (let i = 0; i < 6; i++) {
    const px = -0.36 + i * 0.13;
    a.cut(roundBox(x - px, y - 0.64, z - 0.37, 0.045, 0.035, 0.05), INK);
    if (z > 0.33) a.paint(box2(x - px, y - 0.72, 0.035, 0.016), LED);
  }
  // 2U server with drive bays
  a.add(roundBox(x, y - 0.27, z, 0.46, 0.24, 0.36, 0.015), PLASTER);
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) {
      const bx = -0.28 + c * 0.28, by = 0.37 - r * 0.2;
      a.cut(roundBox(x - bx, y - by, z - 0.37, 0.115, 0.07, 0.05), INK);
      a.add(roundBox(x - bx + 0.01, y - by + 0.025, z - 0.335, 0.08, 0.017, 0.017), STONE);
      a.add(roundBox(x - bx - 0.085, y - by - 0.035, z - 0.335, 0.018, 0.018, 0.018), LED);
    }
  // NAS / UPS
  a.add(roundBox(x, y + 0.47, z, 0.46, 0.38, 0.36, 0.015), STONE);
  if (z > 0.33) a.paint(box2(x + 0.17, y + 0.22, 0.2, 0.075), SCREEN);
  for (let k = 0; k < 5; k++) a.cut(roundBox(x, y + 0.48 + k * 0.075, z - 0.37, 0.38, 0.017, 0.04), INK);
  a.add(capsule(x, y, z, 0.32, -0.22, 0.33, 0.32, -0.22, 0.4, 0.045), ACCENT);
  // a cable that escaped
  a.add(capsule(x, y, z, 0.3, -0.62, -0.38, 0.62, -0.76, -0.3, 0.026), INK);
  a.add(capsule(x, y, z, 0.62, -0.76, -0.3, 0.7, -0.98, 0.0, 0.026), INK);
}

// ---------------------------------------------------------------- tower crane over a half-built frame (RF Sons)
// Lower floors are built; the top floors exist only as the teal wireframe of the 3D model.
const FLOOR = 0.3, FLOORS = 4, BX = -0.32, BHX = 0.3, BHZ = 0.3;
function crane(x: number, y: number, z: number, a: Acc) {
  a.add(roundBox(x + 0.05, y + 0.975, z, 0.86, 0.025, 0.45, 0.01), STONE);
  // building frame
  const lx = x - BX;
  for (let i = 0; i <= FLOORS; i++) {
    const fy = -0.95 + i * FLOOR;
    const built = i <= 2;
    if (built) a.add(roundBox(lx, y - fy, z, BHX + 0.03, 0.022, BHZ + 0.03, 0.005), PLASTER);
    else {
      // wireframe slab outline
      for (const sz of [-1, 1]) a.add(capsule(lx, y, z, -BHX, fy, sz * BHZ, BHX, fy, sz * BHZ, 0.017), TEAL);
      for (const sx of [-1, 1]) a.add(capsule(lx, y, z, sx * BHX, fy, -BHZ, sx * BHX, fy, BHZ, 0.017), TEAL);
    }
  }
  for (const sx of [-1, 0, 1])
    for (const sz of [-1, 1]) {
      const cx = sx * BHX, cz2 = sz * BHZ;
      const top = -0.95 + FLOORS * FLOOR;
      const mid = -0.95 + 2 * FLOOR;
      a.add(roundBox(lx - cx, y - (-0.95 + mid) / 2, z - cz2, 0.026, (mid + 0.95) / 2, 0.026), STONE);
      a.add(capsule(lx, y, z, cx, mid, cz2, cx, top, cz2, 0.017), TEAL);
    }
  if (a.d <= 0 && a.m === PLASTER && z > BHZ + 0.01 && y < -0.95 + 2 * FLOOR) a.paint(-1, STONE);

  // tower crane mast: a box with windows cut through every face -> lattice
  const mx = x - 0.48;
  if (Math.abs(mx) < 0.08 && Math.abs(z) < 0.08 && y < 0.76) {
    let d = roundBox(mx, y - (-0.94 + 0.76) / 2, z, 0.065, (0.76 + 0.94) / 2, 0.065);
    const f = (((y + 1) / 0.14) % 1 + 1) % 1;
    // between the rungs only the four corner chords survive
    if (f > 0.22 && f < 0.82 && (Math.abs(mx) < 0.035 || Math.abs(z) < 0.035)) d = 1;
    a.add(d, GOLD);
  }
  // slewing unit + cab
  a.add(roundBox(mx, y - 0.79, z, 0.085, 0.035, 0.085, 0.01), INK);
  a.add(roundBox(mx - 0.02, y - 0.72, z - 0.11, 0.06, 0.06, 0.05, 0.015), PLASTER);
  if (a.d <= 0 && a.m === PLASTER && z > 0.14 && y > 0.7) a.paint(-1, SCREEN);
  // jib toward the building + counter-jib with its weight
  {
    const jy = y - 0.84;
    let d = roundBox(x + 0.06, jy, z, 0.6, 0.032, 0.032, 0.005);
    const f = (((x + 2) / 0.1) % 1 + 1) % 1;
    if (f > 0.25 && f < 0.75 && Math.abs(jy) < 0.016 && x < 0.4) d = 1;
    a.add(d, GOLD);
    a.add(roundBox(x - 0.75, jy, z, 0.18, 0.03, 0.04, 0.005), GOLD);
    a.add(roundBox(x - 0.86, y - 0.76, z, 0.06, 0.06, 0.06, 0.01), STONE);
  }
  // apex and ties
  a.add(taper(x, y, z, 0.48, 0.86, 0, 0.48, 1.04, 0, 0.04, 0.02), GOLD);
  a.add(capsule(x, y, z, 0.48, 1.03, 0, -0.45, 0.88, 0, 0.022), INK);
  a.add(capsule(x, y, z, 0.48, 1.03, 0, 0.88, 0.88, 0, 0.022), INK);
  // hook carrying the next beam to the top floor
  a.add(capsule(x, y, z, -0.12, 0.82, 0, -0.12, 0.45, 0, 0.012), INK);
  a.add(roundBox(x + 0.12, y - 0.42, z, 0.03, 0.03, 0.03, 0.008), ACCENT);
  a.add(roundBox(x + 0.12, y - 0.36, z, 0.2, 0.025, 0.035, 0.005), ACCENT);
}

// ---------------------------------------------------------------- rubbish truck + wheelie bin (Rubbish Direct)
function truck(x: number, y: number, z: number, a: Acc) {
  // wheels (axis along z)
  for (const wx of [-0.52, -0.2, 0.52])
    for (const sz of [-1, 1]) {
      const r = Math.hypot(x - wx, y + 0.83);
      const d = Math.max(r - 0.15, Math.abs(z - sz * 0.22) - 0.065);
      a.add(d, INK);
      if (d <= 0 && r < 0.065 && Math.abs(z) > 0.25) a.paint(-1, SILVER);
    }
  a.add(roundBox(x - 0.05, y + 0.7, z, 0.78, 0.04, 0.2, 0.01), INK); // chassis
  // compactor body
  a.add(roundBox(x + 0.12, y + 0.37, z, 0.5, 0.3, 0.25, 0.06), SAGE);
  if (a.d <= 0 && a.m === SAGE) {
    if (Math.abs(y + 0.47) < 0.03) a.paint(-1, PLASTER); // stripe
    if (Math.abs(z) > 0.24 && Math.abs(x + 0.12) < 0.38 && Math.abs(y + 0.28) < 0.11) {
      // a little recycling mark: three chevrons
      const u = x + 0.12, v = y + 0.28;
      if (Math.abs(Math.abs(u) * 0.8 + v * 0.9 - 0.05) < 0.018 && Math.abs(u) < 0.09) a.paint(-1, PLASTER);
    }
  }
  // tailgate / hopper
  a.add(roundBox(x + 0.7, y + 0.42, z, 0.1, 0.27, 0.24, 0.05), STONE);
  if (a.d <= 0 && a.m === STONE && x < -0.72 && (((y + 2) / 0.09) % 1) < 0.3) a.paint(-1, INK);
  // cab
  a.add(roundBox(x - 0.58, y + 0.44, z, 0.17, 0.23, 0.23, 0.06), PLASTER);
  if (a.d <= 0 && a.m === PLASTER) {
    if (x > 0.71 && y > -0.42 && y < -0.26 && Math.abs(z) < 0.19) a.paint(-1, SCREEN); // windscreen
    if (Math.abs(z) > 0.2 && x > 0.48 && x < 0.69 && y > -0.42 && y < -0.28) a.paint(-1, SCREEN);
  }
  a.add(roundBox(x - 0.77, y + 0.66, z, 0.03, 0.05, 0.2, 0.01), INK); // bumper
  for (const sz of [-1, 1]) a.add(roundBox(x - 0.76, y + 0.56, z - sz * 0.15, 0.02, 0.025, 0.035), GOLD);
  a.add(roundBox(x - 0.58, y + 0.19, z, 0.08, 0.02, 0.1, 0.01), ACCENT); // beacon bar
  // wheelie bin waiting at the kerb (yellow lid = recycling)
  const bx = x + 1.02, bz = z - 0.22;
  const w = 0.11 + (y + 1) * 0.06;
  a.add(roundBox(bx, y + 0.76, bz, w, 0.24, w * 1.05, 0.02), INK);
  a.add(roundBox(bx + 0.01, y + 0.5, bz, 0.15, 0.022, 0.15, 0.01), GOLD);
  a.add(Math.max(Math.hypot(bx - 0.11, y + 0.96) - 0.04, Math.abs(bz) - 0.12), STONE);
}

// ---------------------------------------------------------------- mortarboard + diploma (AUT)
const Q = Math.SQRT1_2;
function grad(x: number, y: number, z: number, a: Acc) {
  a.add(cylinderY(x, y + 0.32, z, 0.38, 0.27, 0.05), INK); // skull
  const rx = Q * x - Q * z, rz = Q * x + Q * z;
  a.add(roundBox(rx, y + 0.02, rz, 0.6, 0.035, 0.6, 0.01), INK); // board
  a.add(cylinderY(x, y - 0.04, z, 0.06, 0.03, 0.015), GOLD); // button
  // tassel: along the board to a corner, then hanging
  a.add(capsule(x, y, z, 0, 0.04, 0, 0.82, 0.04, 0, 0.024), GOLD);
  a.add(capsule(x, y, z, 0.84, 0.03, 0, 0.86, -0.36, 0.0, 0.026), GOLD);
  a.add(taper(x, y, z, 0.86, -0.36, 0, 0.86, -0.64, 0, 0.05, 0.085), GOLD);
  // rolled diploma on the floor
  const dx = x + 0.12, dz = z - 0.42;
  const ux = 0.94 * dx + 0.34 * dz, uz = -0.34 * dx + 0.94 * dz;
  const roll = Math.max(Math.hypot(y + 0.86, uz) - 0.12, Math.abs(ux) - 0.42);
  a.add(roll, PLASTER);
  if (roll < 0.02 && Math.abs(ux) < 0.05) a.paint(-1, ACCENT);
}

// ---------------------------------------------------------------- Bambu Lab A1 printing a camera, with an AMS lite beside it
// The shader animates GANTRY / HEAD / BED / PRINT voxels (shaders.ts → printerAnim) using these heights.
const BED_TOP = PRINTER.bedTop;

function printer(x: number, y: number, z: number, a: Acc) {
  // base unit with the touchscreen at the front right
  a.add(roundBox(x, y + 0.95, z - 0.02, 0.6, 0.05, 0.5, 0.03), PLASTER);
  a.add(roundBox(x - 0.42, y + 0.94, z - 0.53, 0.11, 0.032, 0.02, 0.01), SCREEN);
  // build plate (slides front/back)
  a.add(roundBox(x, y - (BED_TOP - 0.014), z, 0.44, 0.014, 0.42, 0.01), BED);
  // arch frame: two columns and a top bar, set back a little
  for (const s of [-1, 1]) a.add(roundBox(x - s * 0.56, y + 0.22, z + 0.02, 0.04, 0.68, 0.05, 0.012), STONE);
  a.add(roundBox(x, y - 0.46, z + 0.02, 0.6, 0.04, 0.05, 0.012), STONE);
  // X gantry + toolhead, authored at the LAST layer (nozzle just above the finished print) so they
  // never overlap the print in authoring space; the shader moves them down to the current layer.
  const top = PRINTER.printTop;
  a.add(roundBox(x, y - (top + 0.2), z + 0.02, 0.54, 0.028, 0.035, 0.008), GANTRY);
  a.add(roundBox(x, y - (top + 0.13), z - 0.1, 0.1, 0.1, 0.08, 0.03), HEAD);
  a.add(taper(x, y, z, 0, top + 0.035, -0.1, 0, top + 0.004, -0.1, 0.03, 0.014), HEAD);
  // the print: a little DSLR (body, prism hump, grip, lens with a hood), lens facing the viewer
  const py = BED_TOP;
  let d = roundBox(x, y - (py + 0.105), z + 0.02, 0.22, 0.105, 0.075, 0.03);
  d = Math.min(d, roundBox(x + 0.01, y - (py + 0.235), z + 0.02, 0.075, 0.05, 0.06, 0.02));
  d = Math.min(d, roundBox(x + 0.185, y - (py + 0.1), z - 0.04, 0.055, 0.1, 0.06, 0.025));
  d = Math.min(d, cappedCylinder(x, y, z, -0.02, py + 0.105, 0.05, -0.02, py + 0.105, 0.2, 0.08));
  d = Math.min(d, cappedCylinder(x, y, z, -0.02, py + 0.105, 0.2, -0.02, py + 0.105, 0.25, 0.092));
  d = Math.max(d, -cappedCylinder(x, y, z, -0.02, py + 0.105, 0.22, -0.02, py + 0.105, 0.3, 0.06)); // hollow hood
  a.add(d, PRINT);
  // AMS lite: a stand with four spools, teal / red / gold / pink
  a.add(roundBox(x + 0.88, y + 0.97, z + 0.05, 0.14, 0.03, 0.14, 0.01), STONE);
  a.add(roundBox(x + 0.88, y + 0.62, z + 0.05, 0.025, 0.36, 0.025, 0.008), STONE);
  const spools: Array<[number, number, number]> = [[-0.98, -0.18, TEAL], [-0.78, -0.18, ACCENT], [-0.98, -0.42, GOLD], [-0.78, -0.42, PINK]];
  for (const [sx, sy, m] of spools) {
    const r = Math.hypot(x - sx, y - sy);
    const dd = Math.max(r - 0.095, Math.abs(z - 0.08) - 0.045);
    a.add(dd, m);
    if (dd <= 0 && (r < 0.035 || Math.abs(z - 0.08) > 0.035)) a.paint(-1, STONE); // hub + flanges
  }
}

// ---------------------------------------------------------------- New Zealand relief
const LAT0 = -40.9, LON0 = 172.5, KX = Math.cos((40.9 * Math.PI) / 180), S = 1 / 6.6;
const toX = (lon: number) => (lon - LON0) * KX * S;
const toZ = (lat: number) => -(lat - LAT0) * S;
const toLon = (x: number) => x / (KX * S) + LON0;
const toLat = (z: number) => -z / S + LAT0;

function inside(lon: number, lat: number) {
  let hit = false;
  for (const ring of NZ_RINGS) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax, vy = by - ay;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}
const ALPS: Array<[number, number]> = [[166.9, -45.9], [167.6, -45.2], [168.7, -44.4], [170.1, -43.6], [171.5, -42.95], [172.5, -42.35], [173.4, -42.0]];
const NI_RANGE: Array<[number, number]> = [[175.1, -41.2], [175.7, -40.4], [176.5, -39.5], [177.4, -38.4]];
function elevation(lon: number, lat: number, coastDeg: number) {
  let h = 0.03 + 0.06 * (1 - Math.exp(-coastDeg / 0.25));
  const kx = Math.cos((lat * Math.PI) / 180);
  let dA = 9;
  for (let i = 0; i < ALPS.length - 1; i++) dA = Math.min(dA, segDist(lon * kx, lat, ALPS[i][0] * kx, ALPS[i][1], ALPS[i + 1][0] * kx, ALPS[i + 1][1]));
  h += 0.2 * Math.exp(-((dA / 0.42) ** 2));
  let dN = 9;
  for (let i = 0; i < NI_RANGE.length - 1; i++) dN = Math.min(dN, segDist(lon * kx, lat, NI_RANGE[i][0] * kx, NI_RANGE[i][1], NI_RANGE[i + 1][0] * kx, NI_RANGE[i + 1][1]));
  h += 0.07 * Math.exp(-((dN / 0.3) ** 2));
  h += 0.17 * Math.exp(-(((lon - 175.57) * kx) ** 2 + (lat + 39.28) ** 2) / 0.09); // Ruapehu
  h += 0.15 * Math.exp(-(((lon - 174.06) * kx) ** 2 + (lat + 39.3) ** 2) / 0.02); // Taranaki
  h += 0.012 * Math.sin(lon * 9.1) * Math.sin(lat * 7.3); // texture
  return h;
}

function fillNZ(g: Grid) {
  const c = g.def.cell;
  const land = new Uint8Array(g.nx * g.nz);
  for (let k = 0; k < g.nz; k++)
    for (let i = 0; i < g.nx; i++) land[i + g.nx * k] = inside(toLon(g.cx(i)), toLat(g.cz(k))) ? 1 : 0;
  // distance to coast (cells), 8-neighbour BFS
  const dist = new Float32Array(g.nx * g.nz).fill(1e9);
  const q: number[] = [];
  for (let n = 0; n < land.length; n++) if (!land[n]) { dist[n] = 0; q.push(n); }
  for (let h = 0; h < q.length; h++) {
    const n = q[h], i = n % g.nx, k = (n / g.nx) | 0;
    for (let dk = -1; dk <= 1; dk++)
      for (let di = -1; di <= 1; di++) {
        const ii = i + di, kk = k + dk;
        if (ii < 0 || kk < 0 || ii >= g.nx || kk >= g.nz) continue;
        const m = ii + g.nx * kk;
        const nd = dist[n] + (di && dk ? 1.414 : 1);
        if (nd < dist[m]) { dist[m] = nd; q.push(m); }
      }
  }
  const ax = toX(AUCKLAND[0]), az = toZ(AUCKLAND[1]);
  const degPerCell = c / S;
  let aklTop = 0;
  for (let k = 0; k < g.nz; k++)
    for (let i = 0; i < g.nx; i++) {
      if (!land[i + g.nx * k]) continue;
      const lon = toLon(g.cx(i)), lat = toLat(g.cz(k));
      const h = elevation(lon, lat, dist[i + g.nx * k] * degPerCell);
      const r = Math.hypot(g.cx(i) - ax, g.cz(k) - az);
      const top: number = h > 0.21 ? SNOW : h > 0.12 ? STONE : SAGE;
      if (r < 0.03) aklTop = Math.max(aklTop, h);
      for (let j = 0; j < g.ny; j++) {
        const y = g.cy(j);
        if (y < -0.05 || y > h) continue;
        let m = y > h - c ? top : STONE;
        if (y > h - c && r > 0.045 && r < 0.068) m = WAVE;
        g.set(i, j, k, m + 1);
      }
    }
  // the pin
  const acc = new Acc();
  for (let k = 0; k < g.nz; k++)
    for (let j = 0; j < g.ny; j++)
      for (let i = 0; i < g.nx; i++) {
        const x = g.cx(i) - ax, y = g.cy(j), z = g.cz(k) - az;
        if (Math.abs(x) > 0.12 || Math.abs(z) > 0.12) continue;
        acc.reset();
        acc.add(capsule(x, y, z, 0, aklTop, 0, 0, aklTop + 0.36, 0, 0.018), INK);
        acc.add(sphere(x, y - aklTop - 0.4, z, 0.065), ACCENT);
        if (acc.d <= 0) g.set(i, j, k, acc.m + 1);
      }
}

export const SHAPES: ShapeDef[] = [
  { id: 'miku', cell: 0.026, bounds: [-1.3, 1.3, -1.0, 0.9, -0.52, 0.5], sdf: miku },
  { id: 'chat', cell: 0.036, bounds: [-1.0, 0.95, -0.95, 0.75, -0.3, 0.3], sdf: chat },
  { id: 'guitar', cell: 0.028, bounds: [-0.48, 0.48, -0.95, 1.3, -0.2, 0.2], sdf: guitar },
  { id: 'rack', cell: 0.04, bounds: [-0.62, 0.8, -1.02, 1.02, -0.5, 0.5], sdf: rack },
  { id: 'grad', cell: 0.036, bounds: [-0.9, 1.0, -1.0, 0.12, -0.9, 0.9], sdf: grad },
  { id: 'crane', cell: 0.03, bounds: [-0.82, 1.0, -1.0, 1.08, -0.47, 0.47], sdf: crane },
  { id: 'truck', cell: 0.032, bounds: [-1.2, 0.86, -1.0, 0.12, -0.42, 0.42], sdf: truck },
  { id: 'printer', cell: 0.022, bounds: [-1.1, 0.66, -1.0, 0.92, -0.56, 0.5], sdf: printer },
  { id: 'nz', cell: 0.024, bounds: [-0.72, 0.72, -0.06, 0.6, -1.0, 1.0], fill: fillNZ, ground: false },
];
