import { Acc } from './sdf';

/** A shape is authored either as an SDF (sampled on a grid) or by filling the grid directly. */
export interface ShapeDef {
  id: string;
  /** Voxel edge length in sculpture units (the whole thing lives in roughly [-1, 1]^3). */
  cell: number;
  /** Authoring bounds [minX, maxX, minY, maxY, minZ, maxZ]. */
  bounds: readonly [number, number, number, number, number, number];
  sdf?: (x: number, y: number, z: number, acc: Acc) => void;
  fill?: (grid: Grid) => void;
  /** Shift so the lowest voxel rests on y = -1 (default true). */
  ground?: boolean;
}

export class Grid {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly occ: Uint8Array; // 0 = empty, else material + 1
  readonly x0: number;
  readonly y0: number;
  readonly z0: number;
  constructor(readonly def: ShapeDef) {
    const [ax, bx, ay, by, az, bz] = def.bounds;
    const c = def.cell;
    this.nx = Math.ceil((bx - ax) / c);
    this.ny = Math.ceil((by - ay) / c);
    this.nz = Math.ceil((bz - az) / c);
    this.x0 = ax + c / 2;
    this.y0 = ay + c / 2;
    this.z0 = az + c / 2;
    this.occ = new Uint8Array(this.nx * this.ny * this.nz);
  }
  idx(i: number, j: number, k: number) {
    return i + this.nx * (j + this.ny * k);
  }
  get(i: number, j: number, k: number) {
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return 0;
    return this.occ[i + this.nx * (j + this.ny * k)];
  }
  set(i: number, j: number, k: number, v: number) {
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return;
    this.occ[i + this.nx * (j + this.ny * k)] = v;
  }
  cx(i: number) { return this.x0 + i * this.def.cell; }
  cy(j: number) { return this.y0 + j * this.def.cell; }
  cz(k: number) { return this.z0 + k * this.def.cell; }
}

export interface VoxelShape {
  id: string;
  count: number;
  cell: number;
  /** xyz per voxel, sorted for coherent morph correspondence */
  pos: Float32Array;
  /** material id per voxel */
  mat: Uint8Array;
  /** ambient occlusion 0..1 (1 = fully open) */
  ao: Float32Array;
  /** how far the form was moved up to stand on y = -1 */
  yShift: number;
}

export function voxelize(def: ShapeDef): VoxelShape {
  const g = new Grid(def);
  const c = def.cell;
  if (def.sdf) {
    const acc = new Acc();
    for (let k = 0; k < g.nz; k++) {
      const z = g.cz(k);
      for (let j = 0; j < g.ny; j++) {
        const y = g.cy(j);
        for (let i = 0; i < g.nx; i++) {
          acc.reset();
          def.sdf(g.cx(i), y, z, acc);
          if (acc.d <= 0) g.occ[g.idx(i, j, k)] = acc.m + 1;
        }
      }
    }
  }
  def.fill?.(g);

  // Surface voxels = solid with at least one empty face neighbour.
  const pick: number[] = [];
  for (let k = 0; k < g.nz; k++)
    for (let j = 0; j < g.ny; j++)
      for (let i = 0; i < g.nx; i++) {
        if (!g.occ[g.idx(i, j, k)]) continue;
        if (
          !g.get(i + 1, j, k) || !g.get(i - 1, j, k) ||
          !g.get(i, j + 1, k) || !g.get(i, j - 1, k) ||
          !g.get(i, j, k + 1) || !g.get(i, j, k - 1)
        ) pick.push(i, j, k);
      }

  const count = pick.length / 3;
  const raw = new Float32Array(count * 3);
  const mat = new Uint8Array(count);
  const ao = new Float32Array(count);
  let minY = Infinity;
  const R = 2;
  const total = (2 * R + 1) ** 3 - 1;
  for (let n = 0; n < count; n++) {
    const i = pick[n * 3], j = pick[n * 3 + 1], k = pick[n * 3 + 2];
    raw[n * 3] = g.cx(i);
    raw[n * 3 + 1] = g.cy(j);
    raw[n * 3 + 2] = g.cz(k);
    minY = Math.min(minY, raw[n * 3 + 1]);
    mat[n] = g.occ[g.idx(i, j, k)] - 1;
    // Occupancy of the 5x5x5 neighbourhood: creases are dark, ridges are bright.
    let filled = 0;
    for (let dz = -R; dz <= R; dz++)
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          if (!dx && !dy && !dz) continue;
          if (g.get(i + dx, j + dy, k + dz)) filled++;
        }
    const f = filled / total;
    ao[n] = Math.min(1, Math.max(0.25, 1.25 - f * 1.35));
  }

  const yShift = def.ground !== false ? -1 + c / 2 - minY : 0;
  for (let n = 0; n < count; n++) raw[n * 3 + 1] += yShift;

  // Sort bottom-to-top, then around the vertical axis, so voxel n of shape A
  // flies to a voxel in a similar place in shape B (coherent "re-sculpting").
  const order = new Uint32Array(count);
  const key = new Float64Array(count);
  for (let n = 0; n < count; n++) {
    order[n] = n;
    const band = Math.floor((raw[n * 3 + 1] + 1.2) * 14);
    const ang = Math.atan2(raw[n * 3 + 2], raw[n * 3]) / Math.PI; // -1..1
    key[n] = band * 4 + ang;
  }
  order.sort((a, b) => key[a] - key[b]);

  const pos = new Float32Array(count * 3);
  const mat2 = new Uint8Array(count);
  const ao2 = new Float32Array(count);
  for (let n = 0; n < count; n++) {
    const o = order[n];
    pos[n * 3] = raw[o * 3];
    pos[n * 3 + 1] = raw[o * 3 + 1];
    pos[n * 3 + 2] = raw[o * 3 + 2];
    mat2[n] = mat[o];
    ao2[n] = ao[o];
  }
  return { id: def.id, count, cell: c, pos, mat: mat2, ao: ao2, yShift };
}
