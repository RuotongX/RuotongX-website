import * as THREE from 'three';
import { fragmentShader, vertexShader } from './shaders';
import { EMISSIVE, MAT_COUNT, PALETTE_DAY, PALETTE_NIGHT } from '../voxel/materials';
import type { VoxelShape } from '../voxel/voxelize';

/**
 * Every form gets the same number of instances N, a few times the biggest form's voxel
 * count. At rest the extra copies sit exactly on top of each other (invisible); in flight
 * each cube splits into several threads, which is what makes the swarm look like silk.
 */
export class VoxelSculpture {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  private readonly n: number;
  private readonly from: THREE.InstancedBufferAttribute;
  private readonly to: THREE.InstancedBufferAttribute;
  private readonly ao: THREE.InstancedBufferAttribute;
  private readonly packed: Array<{ id: string; pos4: Float32Array; ao: Float32Array; cell: number }>;
  private seg = -1;

  constructor(shapes: VoxelShape[], threadBudget: number) {
    const maxCount = Math.max(...shapes.map((s) => s.count));
    this.n = Math.max(maxCount, Math.min(threadBudget, maxCount * 3));
    const n = this.n;
    this.packed = shapes.map((s) => {
      const pos4 = new Float32Array(n * 4);
      const ao = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const j = Math.floor((i * s.count) / n);
        pos4[i * 4] = s.pos[j * 3];
        pos4[i * 4 + 1] = s.pos[j * 3 + 1];
        pos4[i * 4 + 2] = s.pos[j * 3 + 2];
        pos4[i * 4 + 3] = s.mat[j];
        ao[i] = s.ao[j];
      }
      return { id: s.id, pos4, ao, cell: s.cell };
    });

    const box = new THREE.BoxGeometry(1, 1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = box.index;
    geo.setAttribute('position', box.getAttribute('position'));
    geo.setAttribute('normal', box.getAttribute('normal'));
    geo.instanceCount = n;

    this.from = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.to = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.ao = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
    const rnd = new Float32Array(n * 4);
    for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
    geo.setAttribute('aFrom', this.from);
    geo.setAttribute('aTo', this.to);
    geo.setAttribute('aAO', this.ao);
    geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 4));

    const pal = (hexes: string[]) => hexes.map((h) => new THREE.Color(h));
    if (MAT_COUNT !== PALETTE_DAY.length || MAT_COUNT !== PALETTE_NIGHT.length || MAT_COUNT !== EMISSIVE.length) {
      throw new Error('palette size mismatch');
    }
    this.uniforms = {
      uMix: { value: 0 },
      uTime: { value: 0 },
      uCellA: { value: 0.03 },
      uCellB: { value: 0.03 },
      uTheme: { value: 0 },
      uIntro: { value: 1 },
      uSwirl: { value: 1 },
      uMouseO: { value: new THREE.Vector3(0, 0, 50) },
      uMouseD: { value: new THREE.Vector3(0, 0, -1) },
      uMouseK: { value: 0 },
      uFromP: { value: 0 },
      uToP: { value: 0 },
      uPrintH: { value: 0 },
      uPrintRange: { value: new THREE.Vector2(-0.86, -0.66) },
      uPalDay: { value: pal(PALETTE_DAY) },
      uPalNight: { value: pal(PALETTE_NIGHT) },
      uEmis: { value: EMISSIVE.map(([d, n2]) => new THREE.Vector2(d, n2)) },
      uKeyDir: { value: new THREE.Vector3(-0.45, 0.75, 0.55).normalize() },
      uFillDir: { value: new THREE.Vector3(0.75, -0.1, 0.45).normalize() },
    };

    const mat = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: this.uniforms });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.setSegment(0);
  }

  get count() { return this.n; }
  get forms() { return this.packed.length; }

  /** Show the morph between form `seg` and `seg + 1`. */
  setSegment(seg: number) {
    seg = Math.max(0, Math.min(this.packed.length - 2, seg));
    if (seg === this.seg) return;
    this.seg = seg;
    const a = this.packed[seg], b = this.packed[seg + 1];
    (this.from.array as Float32Array).set(a.pos4);
    (this.to.array as Float32Array).set(b.pos4);
    const ao = this.ao.array as Float32Array;
    for (let i = 0; i < this.n; i++) { ao[i * 2] = a.ao[i]; ao[i * 2 + 1] = b.ao[i]; }
    this.from.needsUpdate = this.to.needsUpdate = this.ao.needsUpdate = true;
    this.uniforms.uCellA.value = a.cell;
    this.uniforms.uCellB.value = b.cell;
    this.uniforms.uFromP.value = a.id === 'printer' ? 1 : 0;
    this.uniforms.uToP.value = b.id === 'printer' ? 1 : 0;
  }
}
