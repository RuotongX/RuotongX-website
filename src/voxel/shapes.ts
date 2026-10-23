// The sculpture's forms, authored as signed distance fields (sign is what matters for voxels).
// Coordinates: y up, +z faces the viewer, everything roughly inside [-1, 1]^3.
import {
  Acc, box2, capsule, circle2, clamp, cylinderY, ellipsoid, extrude, roundBox, smin, sphere, taper,
} from './sdf';
import { MAT } from './materials';
import type { Grid, ShapeDef } from './voxelize';
import { AUCKLAND, NZ_RINGS } from '../data/nz';

const {
  PLASTER, STONE, INK, ACCENT, LED, SCREEN, WOOD, SAGE, GOLD, WAVE, SPRUCE, SNOW,
  TEAL, SKIN, PINK, SILVER, TEAL_DEEP, EYE,
} = MAT;

// ---------------------------------------------------------------- Hatsune Miku, fumo-plush proportions
// Big squashy head, tiny sitting body, legs straight out, twin tails down to the floor.
// twin-tail spine (x mirrored): [x, y, z, radius]
const TAIL: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.42, 0.3, -0.1, 0.12],
  [0.6, 0.14, -0.15, 0.17],
  [0.7, -0.3, -0.13, 0.175],
  [0.68, -0.72, -0.06, 0.15],
  [0.62, -0.9, 0.06, 0.11],
];
const HEAD_Y = -0.06;
const tri = (v: number) => Math.abs((((v % 1) + 1) % 1) - 0.5) * 2; // 0..1 zig-zag

function miku(x: number, y: number, z: number, a: Acc) {
  const ax = Math.abs(x);

  // ---- body (sitting)
  // legs straight out in front: boots ink, teal band at the top, teal soles
  for (const lx of [-0.12, 0.12]) {
    a.add(capsule(x, y, z, lx, -0.86, -0.02, lx * 1.1, -0.87, 0.36, 0.085), INK);
    a.add(roundBox(x - lx * 1.1, y + 0.87, z - 0.44, 0.07, 0.075, 0.025, 0.02), TEAL);
  }
  if (a.d <= 0 && a.m === INK && z > 0.1 && z < 0.15) a.paint(-1, TEAL);
  // pleated skirt with a teal hem
  {
    const r = 0.2 + clamp(-0.72 - y, 0, 0.16) * 0.7;
    const pleat = 0.012 * Math.cos(Math.atan2(z, x) * 12);
    const d = Math.max(Math.hypot(x, z) - r - pleat, Math.abs(y + 0.8) - 0.09);
    a.add(d, INK);
    if (d <= 0 && y < -0.855) a.paint(-1, TEAL);
  }
  // torso: grey sleeveless top, teal tie and collar
  a.add(roundBox(x, y + 0.6, z, 0.16, 0.13, 0.13, 0.1), SILVER);
  if (a.d <= 0 && a.m === SILVER && z > 0.08) {
    if (y < -0.52 && y > -0.7 && ax < 0.028 + (-0.52 - y) * 0.14) a.paint(-1, TEAL);
    if (y > -0.53 && ax < 0.1) a.paint(-1, TEAL);
  }
  // stubby arms resting on the skirt: black sleeves, teal cuffs, tiny hands
  for (const sx of [-1, 1]) {
    a.add(taper(x, y, z, sx * 0.15, -0.52, 0.0, sx * 0.25, -0.72, 0.1, 0.06, 0.075), INK);
    a.add(sphere(x - sx * 0.27, y + 0.76, z - 0.13, 0.048), SKIN);
  }
  if (a.d <= 0 && a.m === INK && y > -0.76 && y < -0.67 && ax > 0.2 && z > 0.04) a.paint(-1, TEAL);

  // ---- head
  const hy = y - HEAD_Y;
  a.add(ellipsoid(x, hy, z, 0.5, 0.42, 0.43), SKIN);
  // hair: a slightly bigger dome with a face window under zig-zag bangs
  let hair = ellipsoid(x, hy - 0.03, z + 0.025, 0.535, 0.465, 0.465);
  const bangs = 0.1 - 0.075 * tri(x * 6.2 + 0.5);
  if (z > 0.06 && hy < bangs && ax < 0.39) hair = 1;
  a.add(hair, TEAL);
  // side locks framing the face
  a.add(taper(ax, y, z, 0.38, HEAD_Y + 0.1, 0.24, 0.4, HEAD_Y - 0.4, 0.24, 0.075, 0.05), TEAL);

  // face
  if (a.d <= 0 && a.m === SKIN && z > 0.2) {
    const ex = ax - 0.17, ey = hy + 0.11;
    if ((ex / 0.085) ** 2 + (ey / 0.11) ** 2 < 1) {
      a.paint(-1, ey > 0.045 ? INK : EYE);
      if (Math.hypot(ax - 0.145, ey - 0.0) < 0.03) a.paint(-1, SNOW);
    }
    if ((ax - 0.3) ** 2 / 0.06 ** 2 + (hy + 0.25) ** 2 / 0.03 ** 2 < 1) a.paint(-1, PINK);
    if (ax < 0.035 && Math.abs(hy + 0.27) < 0.018) a.paint(-1, INK);
  }

  // headset ear pieces
  a.add(Math.max(Math.hypot(hy + 0.06, z - 0.05) - 0.1, Math.abs(ax - 0.5) - 0.045), SILVER);
  if (a.d <= 0 && a.m === SILVER && ax > 0.53 && Math.hypot(hy + 0.06, z - 0.05) < 0.05) a.paint(-1, TEAL);

  // hair ties: dark with a pink face
  a.add(roundBox(ax - 0.44, y - 0.3, z + 0.08, 0.06, 0.09, 0.08, 0.025), INK);
  if (a.d <= 0 && a.m === INK && ax > 0.495 && y > 0.22) a.paint(-1, PINK);

  // twin tails: thick plush tubes down to the floor, darker teal on the back
  let best = 1e9, cz = 0;
  for (let i = 0; i < TAIL.length - 1; i++) {
    const [x0, y0, z0, r0] = TAIL[i], [x1, y1, z1, r1] = TAIL[i + 1];
    const d = taper(ax, y, z, x0, y0, z0, x1, y1, z1, r0, r1);
    if (d < best) { best = d; cz = z0 + (z1 - z0) * clamp((y0 - y) / (y0 - y1), 0, 1); }
  }
  a.add(best, TEAL);
  if (best <= 0 && a.m === TEAL && z < cz - 0.06) a.paint(-1, TEAL_DEEP);
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
  { id: 'miku', cell: 0.03, bounds: [-0.92, 0.92, -1.0, 0.5, -0.45, 0.55], sdf: miku },
  { id: 'chat', cell: 0.036, bounds: [-1.0, 0.95, -0.95, 0.75, -0.3, 0.3], sdf: chat },
  { id: 'guitar', cell: 0.028, bounds: [-0.48, 0.48, -0.95, 1.3, -0.2, 0.2], sdf: guitar },
  { id: 'rack', cell: 0.04, bounds: [-0.62, 0.8, -1.02, 1.02, -0.5, 0.5], sdf: rack },
  { id: 'grad', cell: 0.036, bounds: [-0.9, 1.0, -1.0, 0.12, -0.9, 0.9], sdf: grad },
  { id: 'crane', cell: 0.03, bounds: [-0.82, 1.0, -1.0, 1.08, -0.47, 0.47], sdf: crane },
  { id: 'truck', cell: 0.032, bounds: [-1.2, 0.86, -1.0, 0.12, -0.42, 0.42], sdf: truck },
  { id: 'nz', cell: 0.024, bounds: [-0.72, 0.72, -0.06, 0.6, -1.0, 1.0], fill: fillNZ, ground: false },
];
