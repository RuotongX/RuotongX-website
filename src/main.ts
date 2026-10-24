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
  'Hatsune Miku, fuwa petit plush',
  'Two chat bubbles',
  'Acoustic guitar',
  'Home lab rack',
  'Mortarboard and diploma',
  'Tower crane over a half-built model',
  'Rubbish truck and a wheelie bin',
  'New Zealand, Auckland pinned',
];
const LAB_FORM = 3;
/** forms whose layout leaves room for the museum placard */
const PLACARD_FORMS = new Set([2, 7]); // the hero has its own note; the route has its own line

const sections = [...document.querySelectorAll<HTMLElement>('[data-form]')];
const lenis = new Lenis({ autoRaf: true, lerp: reducedMotion ? 1 : 0.11, anchors: true });

// ---------------------------------------------------------------- scroll -> chapter coordinate
// Morph into a section's first form plays while its top travels from 95% to 20% of the viewport.
// A pinned section with data-steps="n" holds n forms; the extra morphs happen inside its pin,
// one every STEP viewports.
const STEP = 1.2;
let windows: Array<[number, number]> = [];
/** form index -> section index (for the rail) */
const formSection: number[] = [];
/** form index where each section starts */
const sectionForm: number[] = [];
sections.forEach((s, i) => {
  sectionForm[i] = formSection.length;
  for (let k = 0; k < Number(s.dataset.steps ?? 1); k++) formSection.push(i);
});
let vh = window.innerHeight;
function measure() {
  vh = window.innerHeight;
  windows = [];
  sections.forEach((s, i) => {
    const top = s.getBoundingClientRect().top + window.scrollY;
    if (i > 0) windows.push([top - vh * 0.95, top - vh * 0.2]);
    const steps = Number(s.dataset.steps ?? 1);
    for (let j = 1; j < steps; j++) windows.push([top + (STEP * j - 0.5) * vh, top + (STEP * j + 0.1) * vh]);
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
    const f = sectionForm[i];
    const target = f === 0 ? 0 : (windows[f - 1]?.[1] ?? 0) + vh * 0.08;
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
  const sec = formSection[i] ?? 0;
  railLinks.forEach((a, k) => a.setAttribute('aria-current', String(k === sec)));
  if (placardText[i]) placard.innerHTML = placardText[i];
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
const lab = document.querySelector<HTMLElement>('.lab')!;
let labQ = 0;
const route = document.querySelector<HTMLElement>('.route')!;
const routeForm = Number(route.dataset.form);
const stops = [...route.querySelectorAll<HTMLElement>('.stop')];
const routeDots = [...route.querySelectorAll<HTMLElement>('.route-stop')];
let routeStop = -1;
function updateRoute(c: number) {
  const local = Math.min(stops.length - 1, Math.max(0, c - routeForm));
  route.style.setProperty('--route', String(local / (stops.length - 1)));
  const here = Math.round(local);
  routeDots.forEach((d, k) => { d.classList.toggle('is-on', k <= local + 0.01); d.classList.toggle('is-here', k === here); });
  if (here === routeStop) return;
  routeStop = here;
  stops.forEach((st, k) => {
    st.classList.toggle('is-active', k === here);
    st.classList.toggle('is-past', k < here);
  });
}

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
  const lr = lab.getBoundingClientRect();
  labQ = clamp01(-lr.top / Math.max(1, lr.height - vh));
}

// ---------------------------------------------------------------- the sculpture
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const gl = document.createElement('canvas').getContext('webgl2');
let stage: Stage | null = null;

const lamp = initLamp(document.querySelector('.lamp')!, (night) => stage?.setTheme(night));
startClock(document.querySelector('.clock')!);
new IntersectionObserver(([e]) => root.classList.toggle('at-end', e.isIntersecting)).observe(document.querySelector('.colophon')!);
const shaEl = document.querySelector<HTMLAnchorElement>('.build-sha');
if (shaEl) {
  shaEl.textContent = __BUILD__;
  if (__BUILD__ !== 'dev') shaEl.href = `https://github.com/RuotongX/RuotongX-website/commit/${__BUILD__}`;
}
const yearEl = document.querySelector('.year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

function onScroll() {
  const c = chapterAt(window.scrollY);
  if (stage) {
    stage.progress = c;
    stage.spin = reducedMotion ? 0 : (labQ - 0.5) * 1.3;
  }
  root.classList.toggle('in-hero', c < 0.35);
  updateRoute(c);
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
// ---------------------------------------------------------------- 'my favourite' note, pinned to Miku's head
const note = document.querySelector<HTMLElement>('.miku-note')!;
let introDone = false;
function updateNote(s: Stage) {
  const anchored = !s.isMobile;
  note.classList.toggle('is-anchored', anchored);
  if (!anchored) return;
  const vis = introDone ? Math.max(0, 1 - s.shownForm * 3) : 0;
  note.style.setProperty('--note-vis', vis.toFixed(3));
  note.classList.toggle('is-on', vis > 0.5);
  const pt = s.project(0, 0.6, 0.82, -0.05); // top of her right hair tie
  note.style.setProperty('--x', `${(pt.x + 18).toFixed(1)}px`);
  note.style.setProperty('--y', `${(pt.y - 6).toFixed(1)}px`);
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
    st.onFrame = () => { updateCallouts(st); updateNote(st); };

    placardText = shapes.map((s, i) => `<b>Fig. ${String(i).padStart(2, '0')} — ${FIG_NAMES[i] ?? s.id}</b>${fmt(s.count)} cubes, placed live`);
    current = -1;
    onScroll();
    const lc = document.querySelector('.lede-count');
    if (lc) lc.textContent = fmt(shapes[0].count);
    const vc = document.querySelector('.voxel-count');
    if (vc) vc.textContent = fmt(st.sculpture.count);

    root.classList.add('is-ready');
    intro(st, reducedMotion ? 0.01 : 1.7);
    setTimeout(() => { introDone = true; }, reducedMotion ? 0 : 1500);
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
