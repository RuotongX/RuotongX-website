// Dev probe: voxelize every shape in Node and print counts + timings.
// Run: npm run probe
import { SHAPES } from '../src/voxel/shapes';
import { voxelize } from '../src/voxel/voxelize';

let total = 0;
for (const def of SHAPES) {
  const t = performance.now();
  const v = voxelize(def);
  const ms = performance.now() - t;
  total += ms;
  const mats = new Map<number, number>();
  for (const m of v.mat) mats.set(m, (mats.get(m) ?? 0) + 1);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < v.pos.length; i += 3) { minY = Math.min(minY, v.pos[i]); maxY = Math.max(maxY, v.pos[i]); }
  console.log(
    def.id.padEnd(8), String(v.count).padStart(6), `${ms.toFixed(0)}ms`.padStart(7),
    `y ${minY.toFixed(2)}..${maxY.toFixed(2)}`,
    [...mats.entries()].sort((a, b) => a[0] - b[0]).map(([m, n]) => `${m}:${n}`).join(' '),
  );
}
console.log('total', total.toFixed(0), 'ms');
