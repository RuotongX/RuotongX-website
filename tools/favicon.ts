// Renders the favicon straight from the Miku SDF: a front-on, orthographic, pixel-art view of her head.
// Run: npm run favicon   (writes public/favicon.svg)
import { writeFileSync } from 'node:fs';
import { Acc } from '../src/voxel/sdf';
import { SHAPES } from '../src/voxel/shapes';
import { PALETTE_DAY } from '../src/voxel/materials';

const def = SHAPES.find((s) => s.id === 'miku');
if (!def?.sdf) throw new Error('miku shape not found');

const N = 32; // pixels per side
const X0 = -0.68, X1 = 0.68, Y1 = 0.86; // square crop around the head, sculpture units
const SIZE = X1 - X0, Y0 = Y1 - SIZE, PX = SIZE / N;

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const shade = (h: string, k: number) => {
  const n = parseInt(h.slice(1), 16);
  return hex(((n >> 16) & 255) * k, ((n >> 8) & 255) * k, (n & 255) * k);
};

const acc = new Acc();
const rows: string[][] = [];
for (let j = 0; j < N; j++) {
  const row: string[] = [];
  const y = Y1 - (j + 0.5) * PX;
  for (let i = 0; i < N; i++) {
    const x = X0 + (i + 0.5) * PX;
    let col = '';
    // march from the viewer into the scene; the first solid sample wins
    for (let z = 0.62; z > -0.6; z -= 0.004) {
      acc.reset();
      def.sdf(x, y, z, acc);
      if (acc.d <= 0) {
        const depth = Math.min(1, Math.max(0, (z + 0.15) / 0.62)); // nearer = brighter: a little roundness
        col = shade(PALETTE_DAY[acc.m], 0.8 + 0.2 * depth);
        break;
      }
    }
    row.push(col);
  }
  rows.push(row);
}

// merge horizontal runs into rects
const rects: string[] = [];
rows.forEach((row, j) => {
  for (let i = 0; i < N; ) {
    const c = row[i];
    let k = i + 1;
    while (k < N && row[k] === c) k++;
    if (c) rects.push(`<rect x="${i}" y="${j}" width="${k - i}" height="1" fill="${c}"/>`);
    i = k;
  }
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">${rects.join('')}</svg>\n`;
writeFileSync('public/favicon.svg', svg);
console.log(`favicon.svg: ${rects.length} rects, ${svg.length} bytes`);
for (const row of rows) console.log(row.map((c) => (c ? '█' : '·')).join(''));
