import * as THREE from 'three';
import { VoxelSculpture } from './sculpture';
import type { VoxelShape } from '../voxel/voxelize';

/** Where the sculpture sits for each form. x is a fraction of the half-viewport width. */
export interface Pose {
  x: number; y: number; s: number;
  yaw: number; pitch: number; roll: number;
  shadow: number;
}

const POSES: Pose[] = [
  { x: 0.16, y: -0.1, s: 1.12, yaw: -0.3, pitch: 0.05, roll: 0, shadow: 1 }, // miku (hero)
  { x: 0.0, y: -0.66, s: 0.6, yaw: -0.3, pitch: 0.12, roll: 0, shadow: 0.5 }, // chat bubbles, under the statement / between the screenshots
  { x: 0.64, y: -0.08, s: 0.95, yaw: 0.35, pitch: 0.05, roll: -0.3, shadow: 0.7 }, // guitar, leaning on the browser
  { x: 0.0, y: -0.36, s: 0.9, yaw: 0.0, pitch: 0.12, roll: 0, shadow: 1 }, // rack, centre stage under the title
  { x: 0.02, y: 0.36, s: 0.72, yaw: 0.55, pitch: 0.34, roll: 0.06, shadow: 0 }, // mortarboard resting between the two lines
  { x: 0.42, y: -0.1, s: 1.3, yaw: -0.32, pitch: 0.95, roll: 0, shadow: 0 }, // nz (tilted toward viewer)
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const damp = (cur: number, target: number, lambda: number, dt: number) =>
  lerp(cur, target, 1 - Math.exp(-lambda * dt));

export interface StageOptions {
  canvas: HTMLCanvasElement;
  shapes: VoxelShape[];
  reducedMotion: boolean;
  threadBudget: number;
}

export class Stage {
  readonly sculpture: VoxelSculpture;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private readonly pivot = new THREE.Group();
  private readonly shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly inv = new THREE.Matrix4();
  private readonly tmp = new THREE.Vector3();
  private readonly yShift: number[];

  /** Continuous chapter coordinate: 0 = hero form, 1 = second form, ... */
  progress = 0;
  private shown = 0;
  private pointer = new THREE.Vector2(0, 0);
  private pointerSmooth = new THREE.Vector2(0, 0);
  private pointerActiveUntil = 0;
  private mobile = false;
  private running = true;
  private theme = 0;
  private themeTarget = 0;
  /** extra yaw (radians) applied while form `spinForm` is showing */
  spin = 0;
  spinForm = 3;
  /** called after every rendered frame (for DOM overlays that track the sculpture) */
  onFrame: (() => void) | null = null;

  constructor(opts: StageOptions) {
    const { canvas } = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.sculpture = new VoxelSculpture(opts.shapes, opts.threadBudget);
    this.yShift = opts.shapes.map((sh) => sh.yShift);
    if (opts.reducedMotion) this.sculpture.uniforms.uSwirl.value = 0.25;
    this.pivot.add(this.sculpture.mesh);
    this.scene.add(this.pivot);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: 0x3a2a1a }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    this.camera.position.set(0, 0.2, 7.2);
    this.camera.lookAt(0, 0, 0);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.pointerActiveUntil = performance.now() + 1400;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      if (this.running) { this.clock.getDelta(); requestAnimationFrame(this.tick); }
    });
    this.resize();
    requestAnimationFrame(this.tick);
  }

  setTheme(night: boolean) { this.themeTarget = night ? 1 : 0; }
  get isMobile() { return this.mobile; }
  /** Continuous form coordinate actually on screen (damped). */
  get shownForm() { return this.shown; }

  /** Screen position (CSS px) of a point given in a form's authoring space. */
  project(form: number, x: number, y: number, z: number) {
    const v = this.tmp.set(x, y + (this.yShift[form] ?? 0), z);
    v.applyMatrix4(this.sculpture.mesh.matrixWorld).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }
  setIntro(v: number) { this.sculpture.uniforms.uIntro.value = v; }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.mobile = w / h < 0.9 || w < 720;
    this.camera.fov = this.mobile ? 36 : 30;
    this.camera.updateProjectionMatrix();
  }

  private pose(): Pose {
    const n = POSES.length;
    const c = Math.max(0, Math.min(n - 1, this.shown));
    const i = Math.min(n - 2, Math.floor(c));
    const t = ease(c - i);
    const a = POSES[i], b = POSES[i + 1];
    return {
      x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t),
      yaw: lerp(a.yaw, b.yaw, t), pitch: lerp(a.pitch, b.pitch, t), roll: lerp(a.roll, b.roll, t),
      shadow: lerp(a.shadow, b.shadow, t),
    };
  }

  private tick = () => {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;
    const u = this.sculpture.uniforms;

    // scroll -> morph (lightly damped so fast flicks still read as a morph)
    this.shown = damp(this.shown, this.progress, 7, dt);
    if (Math.abs(this.shown - this.progress) < 1e-4) this.shown = this.progress;
    const seg = Math.min(this.sculpture.forms - 2, Math.floor(this.shown));
    this.sculpture.setSegment(seg);
    u.uMix.value = Math.min(1, Math.max(0, this.shown - seg));
    u.uTime.value = time;

    this.theme = damp(this.theme, this.themeTarget, 4, dt);
    u.uTheme.value = this.theme;

    // pose
    const p = this.pose();
    const dist = this.camera.position.z;
    const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * dist;
    const halfW = halfH * this.camera.aspect;
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-3 * dt));
    let x = p.x * halfW, y = p.y, s = p.s;
    if (this.mobile) {
      s = p.s * Math.min(1, (halfW * 0.9) / 1.2);
      x = 0;
      // hero: stand below the name; chapters: sit above the copy
      const hero = Math.max(0, 1 - this.shown);
      y = lerp(halfH * 0.4, -halfH * 0.12, hero) + p.y * 0.25;
    }
    const spinW = Math.max(0, 1 - Math.abs(this.shown - this.spinForm));
    const sway = Math.sin(time * 0.35) * 0.12;
    this.pivot.position.set(x, y, 0);
    this.pivot.scale.setScalar(s);
    this.pivot.rotation.set(
      p.pitch - this.pointerSmooth.y * 0.08,
      p.yaw + sway * (1 - spinW) + this.spin * spinW + this.pointerSmooth.x * 0.3,
      p.roll,
      'YXZ',
    );

    // contact shadow follows position/scale only
    const sh = this.shadow;
    sh.position.set(x, y - 1.02 * s, 0);
    sh.scale.setScalar(s);
    sh.material.opacity = p.shadow * lerp(0.42, 0.55, this.theme) * (1 - u.uIntro.value);
    sh.material.color.setRGB(lerp(0.23, 0, this.theme), lerp(0.16, 0, this.theme), lerp(0.1, 0, this.theme));

    // pointer ray in sculpture space
    this.pivot.updateMatrixWorld();
    const active = performance.now() < this.pointerActiveUntil && !this.mobile;
    u.uMouseK.value = damp(u.uMouseK.value, active ? 1 : 0, active ? 6 : 1.5, dt);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.inv.copy(this.sculpture.mesh.matrixWorld).invert();
    (u.uMouseO.value as THREE.Vector3).copy(this.raycaster.ray.origin).applyMatrix4(this.inv);
    (u.uMouseD.value as THREE.Vector3).copy(this.raycaster.ray.direction).transformDirection(this.inv);

    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
    requestAnimationFrame(this.tick);
  };
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
