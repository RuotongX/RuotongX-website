import './style.css';
import Lenis from 'lenis';
import { Stage } from './scene/stage';
import type { VoxelRequest, VoxelResponse } from './voxel/voxel.worker';
import VoxelWorker from './voxel/voxel.worker?worker';
import { startClock } from './ui/clock';
import { initLamp } from './ui/lamp';

const root = document.documentElement;
root.classList.add('js');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fmt = (n: number) => n.toLocaleString('en-NZ');

const FIG_NAMES = [
  'Hatsune Miku, on a stand',
  'Two chat bubbles',
  'Acoustic guitar',
  'Home lab rack',
  'Mortarboard and diploma',
  'New Zealand, Auckland pinned',
];
const LAB_FORM = 3;
/** forms whose layout leaves room for the museum placard */
const PLACARD_FORMS = new Set([0, 2, 4, 5]);

const sections = [...document.querySelectorAll<HTMLElement>('[data-form]')];
const lenis = new Lenis({ autoRaf: true, lerp: reducedMotion ? 1 : 0.11, anchors: true });

// ---------------------------------------------------------------- scroll -> chapter coordinate
// Morph k-1 -> k plays while section k's top travels from 95% to 20% of the viewport.
let windows: Array<[number, number]> = [];
let vh = window.innerHeight;
function measure() {
  vh = window.innerHeight;
  windows = sections.slice(1).map((s) => {
    const top = s.getBoundingClientRect().top + window.scrollY;
    return [top - vh * 0.95, top - vh * 0.2];
  });
}
function chapterAt(y: number) {
  let c = 0;
  for (const [a, b] of windows) c += clamp01((y - a) / (b - a));
  return c;
}

// ---------------------------------------------------------------- chapter rail + placard
const railList = document.querySelector<HTMLOListElement>('.rail ol')!;
const railLinks = sections.map((s, i) => {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = `#chapter-${i}`;
  a.setAttribute('aria-label', s.dataset.title ?? `Chapter ${i}`);
  a.innerHTML = `<span class="rail-title">${s.dataset.title ?? ''}</span><span class="rail-num">${String(i).padStart(2, '0')}</span>`;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const target = i === 0 ? 0 : (windows[i - 1]?.[1] ?? 0) + vh * 0.08;
    lenis.scrollTo(target, { duration: reducedMotion ? 0 : 1.6 });
  });
  li.append(a);
  railList.append(li);
  return a;
});
const placard = document.querySelector<HTMLElement>('.placard')!;
let placardText: string[] = [];
let current = -1;
function setCurrent(c: number) {
  placard.classList.toggle('is-on', Math.abs(c - Math.round(c)) < 0.08 && placardText.length > 0 && PLACARD_FORMS.has(Math.round(c)));
  const i = Math.round(c);
  if (i === current) return;
  current = i;
  railLinks.forEach((a, k) => a.setAttribute('aria-current', String(k === i)));
  if (placardText[i]) {
    placard.innerHTML = placardText[i];
  }
}

// ---------------------------------------------------------------- reveal on enter
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  },
  { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
);
for (const s of sections) {
  s.querySelectorAll<HTMLElement>('.reveal').forEach((el, i) => {
    el.style.setProperty('--i', String(i));
    io.observe(el);
  });
}

// ---------------------------------------------------------------- word-by-word scrub
const scrubWords: HTMLElement[] = [];
const scrubEl = document.querySelector<HTMLElement>('[data-scrub]');
if (scrubEl) {
  const wrap = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of (child.textContent ?? '').split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const span = document.createElement('span');
          span.className = 'w';
          span.textContent = part;
          scrubWords.push(span);
          frag.append(span);
        }
        child.replaceWith(frag);
      } else wrap(child);
    }
  };
  wrap(scrubEl);
}

// ---------------------------------------------------------------- scroll-linked bits
const duo = document.querySelector<HTMLElement>('.duo');
const browser = document.querySelector<HTMLElement>('.browser');
const honours = document.querySelector<HTMLElement>('.honours');
const lab = document.querySelector<HTMLElement>('.lab')!;
let labQ = 0;

function scrollLinked() {
  if (scrubEl) {
    const r = scrubEl.getBoundingClientRect();
    const t = clamp01((vh * 0.85 - r.top) / (vh * 0.85 - vh * 0.35 + r.height * 0.5));
    const n = scrubWords.length;
    scrubWords.forEach((w, i) => w.style.setProperty('--o', String(0.14 + 0.86 * clamp01(t * n - i))));
  }
  if (duo) {
    const r = duo.getBoundingClientRect();
    duo.style.setProperty('--p', String(((vh - r.top) / (vh + r.height)) * 2 - 1));
  }
  if (browser) {
    const r = browser.getBoundingClientRect();
    browser.style.setProperty('--enter', String(reducedMotion ? 1 : clamp01((vh * 0.95 - r.top) / (vh * 0.6))));
  }
  if (honours) {
    const r = honours.getBoundingClientRect();
    honours.style.setProperty('--p', String(clamp01((vh * 0.98 - r.top) / (vh * 0.6))));
  }
  const lr = lab.getBoundingClientRect();
  labQ = clamp01(-lr.top / Math.max(1, lr.height - vh));
}

// ---------------------------------------------------------------- the sculpture
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const gl = document.createElement('canvas').getContext('webgl2');
let stage: Stage | null = null;

const lamp = initLamp(document.querySelector('.lamp')!, (night) => stage?.setTheme(night));
startClock(document.querySelector('.clock')!);
const yearEl = document.querySelector('.year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

function onScroll() {
  const c = chapterAt(window.scrollY);
  if (stage) {
    stage.progress = c;
    stage.spin = reducedMotion ? 0 : (labQ - 0.5) * 1.3;
  }
  root.classList.toggle('in-hero', c < 0.35);
  root.classList.toggle('is-scrolled', window.scrollY > 40);
  setCurrent(c);
  scrollLinked();
}
lenis.on('scroll', onScroll);
window.addEventListener('resize', () => { measure(); onScroll(); });
document.fonts?.ready.then(() => { measure(); onScroll(); });
measure();
onScroll();

// ---------------------------------------------------------------- home-lab callouts
interface Callout { el: HTMLElement; pt: [number, number, number]; side: 'left' | 'right'; dot: SVGCircleElement; path: SVGPathElement }
const layer = document.querySelector<HTMLElement>('.callout-layer')!;
const svg = layer.querySelector('svg')!;
const callouts: Callout[] = [];
function buildCallouts() {
  const NS = 'http://www.w3.org/2000/svg';
  document.querySelectorAll<HTMLLIElement>('.lab-list li').forEach((li) => {
    const el = document.createElement('div');
    el.className = 'callout';
    el.dataset.side = li.dataset.side;
    el.innerHTML = li.innerHTML;
    layer.append(el);
    const path = document.createElementNS(NS, 'path');
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', '4');
    svg.append(path, dot);
    const pt = (li.dataset.pt ?? '0,0,0').split(',').map(Number) as [number, number, number];
    callouts.push({ el, pt, side: li.dataset.side === 'left' ? 'left' : 'right', dot, path });
  });
  root.classList.add('has-callouts');
}
function updateCallouts(s: Stage) {
  const near = clamp01(1 - Math.abs(s.shownForm - LAB_FORM) * 4);
  const vis = s.isMobile ? 0 : near * clamp01(labQ * 12) * clamp01((1 - labQ) * 10);
  layer.style.setProperty('--lab-vis', vis.toFixed(3));
  if (vis <= 0) return;
  const c = s.project(LAB_FORM, 0, 0.1, 0);
  const gap = Math.min(window.innerWidth * 0.22, 340);
  callouts.forEach((co, i) => {
    const p = s.project(LAB_FORM, co.pt[0], co.pt[1], co.pt[2]);
    const dir = co.side === 'left' ? -1 : 1;
    const lx = c.x + dir * gap;
    const on = labQ > 0.08 + i * 0.1;
    co.el.classList.toggle('is-on', on);
    co.el.style.setProperty('--x', `${lx + dir * 14}px`);
    co.el.style.setProperty('--y', `${p.y}px`);
    const ex = lx - dir * 6;
    co.path.setAttribute('d', on ? `M${p.x.toFixed(1)},${p.y.toFixed(1)} L${ex.toFixed(1)},${p.y.toFixed(1)}` : '');
    co.dot.setAttribute('cx', p.x.toFixed(1));
    co.dot.setAttribute('cy', p.y.toFixed(1));
    co.dot.style.opacity = on ? '1' : '0';
  });
}

if (!gl) {
  root.classList.add('no-webgl', 'is-ready');
} else {
  const small = window.innerWidth < 720 || (navigator.hardwareConcurrency ?? 8) <= 4;
  const worker = new VoxelWorker();
  const req: VoxelRequest = { scale: small ? 1.25 : 1 };
  worker.postMessage(req);
  worker.onmessage = (ev: MessageEvent<VoxelResponse>) => {
    worker.terminate();
    const { shapes, ms } = ev.data;
    stage = new Stage({ canvas, shapes, reducedMotion, threadBudget: small ? 12000 : 26000 });
    stage.setTheme(lamp.night);
    stage.progress = chapterAt(window.scrollY);
    buildCallouts();
    const st = stage;
    st.onFrame = () => updateCallouts(st);

    placardText = shapes.map((s, i) => `<b>Fig. ${String(i).padStart(2, '0')} — ${FIG_NAMES[i] ?? s.id}</b>${fmt(s.count)} cubes, placed live`);
    current = -1;
    onScroll();
    const lc = document.querySelector('.lede-count');
    if (lc) lc.textContent = fmt(shapes[0].count);
    const vc = document.querySelector('.voxel-count');
    if (vc) vc.textContent = fmt(st.sculpture.count);

    root.classList.add('is-ready');
    intro(st, reducedMotion ? 0.01 : 2.8);
    console.info(`[voxels] ${shapes.length} forms, ${st.sculpture.count} instances, built in ${ms.toFixed(0)} ms`);
  };
}

function intro(s: Stage, seconds: number) {
  const t0 = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / (seconds * 1000));
    s.setIntro(1 - t);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

console.log(
  '%cOh hi. You opened devtools — we would probably get along.\n%cEverything here is a few thousand cubes and one shader. ruotong_xu@outlook.com',
  'font: 600 14px/1.6 Georgia, serif; color: #0f6f6a',
  'font: 12px/1.6 ui-monospace, monospace; color: #7a746a',
);
