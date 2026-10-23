// Tiny signed-distance-field toolkit used to author the voxel sculptures.
// All functions are allocation-free so the voxelizer can call them ~1M times per shape.
// Formulas follow Inigo Quilez's reference (iquilezles.org/articles/distfunctions).

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const len2 = (x: number, y: number) => Math.sqrt(x * x + y * y);
const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);

export function sphere(x: number, y: number, z: number, r: number) {
  return len3(x, y, z) - r;
}

/** Axis-aligned box with half-extents (bx,by,bz) and corner radius r. */
export function roundBox(x: number, y: number, z: number, bx: number, by: number, bz: number, r = 0) {
  const qx = Math.abs(x) - bx + r;
  const qy = Math.abs(y) - by + r;
  const qz = Math.abs(z) - bz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return len3(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** Capsule between points a and b. */
export function capsule(
  x: number, y: number, z: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  r: number,
) {
  const pax = x - ax, pay = y - ay, paz = z - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}

/** Cone-ish capsule whose radius goes from r1 (at a) to r2 (at b). Cheap approximation, fine for voxels. */
export function taper(
  x: number, y: number, z: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  r1: number, r2: number,
) {
  const pax = x - ax, pay = y - ay, paz = z - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - (r1 + (r2 - r1) * h);
}

/** Cylinder with flat caps between points a and b. */
export function cappedCylinder(
  x: number, y: number, z: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  r: number,
) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const pax = x - ax, pay = y - ay, paz = z - az;
  const baba = bax * bax + bay * bay + baz * baz;
  const paba = pax * bax + pay * bay + paz * baz;
  const cx = len3(pax * baba - bax * paba, pay * baba - bay * paba, paz * baba - baz * paba) - r * baba;
  const cy = Math.abs(paba - baba * 0.5) - baba * 0.5;
  const x2 = cx * cx, y2 = cy * cy * baba;
  const d = Math.max(cx, cy) < 0 ? -Math.min(x2, y2) : (cx > 0 ? x2 : 0) + (cy > 0 ? y2 : 0);
  return (Math.sign(d) * Math.sqrt(Math.abs(d))) / baba;
}

/** Vertical (y-axis) cylinder, half height h, radius r, with optional edge rounding. */
export function cylinderY(x: number, y: number, z: number, r: number, h: number, round = 0) {
  const dx = len2(x, z) - r + round;
  const dy = Math.abs(y) - h + round;
  return Math.min(Math.max(dx, dy), 0) + len2(Math.max(dx, 0), Math.max(dy, 0)) - round;
}

/** Torus in the XZ plane (ring radius R, tube radius r). */
export function torusY(x: number, y: number, z: number, R: number, r: number) {
  return len2(len2(x, z) - R, y) - r;
}

/** Ellipsoid approximation (good enough for voxelisation). */
export function ellipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  const k0 = len3(x / rx, y / ry, z / rz);
  const k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

/** 2D circle / box helpers for extrusions. */
export const circle2 = (x: number, y: number, r: number) => len2(x, y) - r;
export function box2(x: number, y: number, bx: number, by: number, r = 0) {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r;
  return len2(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
/** Extrude a 2D distance along z with half-thickness h. */
export function extrude(d2: number, z: number, h: number) {
  const wx = d2, wy = Math.abs(z) - h;
  return Math.min(Math.max(wx, wy), 0) + len2(Math.max(wx, 0), Math.max(wy, 0));
}

export function smin(a: number, b: number, k: number) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

/**
 * Distance accumulator with a material channel.
 * add() = union, smooth() = smooth union, cut() = subtraction, paint() recolours voxels inside a region.
 */
export class Acc {
  d = 1e9;
  m = 0;
  reset() { this.d = 1e9; this.m = 0; return this; }
  add(d: number, m: number) {
    if (d < this.d) { this.d = d; this.m = m; }
    return this;
  }
  smooth(d: number, m: number, k: number) {
    if (d < this.d) this.m = m;
    this.d = smin(this.d, d, k);
    return this;
  }
  cut(d: number, mInside = -1) {
    const nd = Math.max(this.d, -d);
    if (mInside >= 0 && -d > this.d) this.m = mInside;
    this.d = nd;
    return this;
  }
  /** Recolour the solid where region distance < 0 (no change to shape). */
  paint(d: number, m: number) {
    if (d < 0) this.m = m;
    return this;
  }
}

/** Rotate (x,y) by angle a, writing into out[0], out[1]. */
export function rot2(x: number, y: number, a: number, out: Float64Array, i0 = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  out[i0] = c * x - s * y;
  out[i0 + 1] = s * x + c * y;
}
