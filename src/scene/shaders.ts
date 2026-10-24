// Voxel morph shaders. One instanced cube per voxel (plus extra copies for the flight).
// At rest every instance is a solid cube in the current form. While the sculpture changes
// shape, cubes stretch into thin threads that ride a shared vortex, so the swarm reads as
// silk rather than gravel, then condense back into cubes in the next form.
import { MAT, MAT_COUNT } from '../voxel/materials';

export const vertexShader = /* glsl */ `
precision highp float;
#define MATS ${MAT_COUNT}
#define M_GANTRY ${MAT.GANTRY}
#define M_HEAD ${MAT.HEAD}
#define M_BED ${MAT.BED}
#define M_PRINT ${MAT.PRINT}

attribute vec4 aFrom;   // xyz + material id
attribute vec4 aTo;
attribute vec2 aAO;     // ao in from / to
attribute vec4 aRnd;

uniform float uMix;
uniform float uTime;
uniform float uCellA;
uniform float uCellB;
uniform float uTheme;
uniform float uIntro;
uniform float uSwirl;
uniform vec3 uMouseO;
uniform vec3 uMouseD;
uniform float uMouseK;
uniform vec3 uKeyDir;
uniform vec3 uPalDay[MATS];
uniform vec3 uPalNight[MATS];
uniform vec2 uEmis[MATS];
// 3D printer form: which side of the current morph is the printer, print progress, layer range
uniform float uFromP;
uniform float uToP;
uniform float uPrintH;
uniform vec2 uPrintRange; // bed top, top of the finished print (form space)

varying vec3 vColor;
varying vec3 vN;
varying vec3 vLocal;
varying float vAO;
varying float vEmis;
varying float vThread;
varying float vSheen;

const float PI = 3.14159265;

float smoother(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }

vec3 matColor(float id) {
  int i = int(id + 0.5);
  return mix(uPalDay[i], uPalNight[i], uTheme);
}
float matEmis(float id, vec3 p) {
  int i = int(id + 0.5);
  float e = mix(uEmis[i].x, uEmis[i].y, uTheme);
  if (i == 4) e *= 0.35 + 0.65 * step(0.42, fract(uTime * (0.35 + aRnd.y * 1.6) + aRnd.z)); // LEDs blink
  if (i == 9) e *= 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 3.0 - length(p) * 9.0));         // rings pulse
  return e;
}

float printLayer() { return mix(uPrintRange.x, uPrintRange.y, uPrintH); }
float printActive() { return smoothstep(0.0, 0.02, uPrintH) * (1.0 - smoothstep(0.97, 1.0, uPrintH)); }

// Moves the printer's parts for the current print progress. Returns 0 for print voxels above the
// current layer (not printed yet), and writes a "hot plastic" glow for the layer being laid down.
float printerAnim(inout vec3 q, float id, out float hot) {
  int i = int(id + 0.5);
  float h = printLayer();
  float act = printActive();
  float vis = 1.0;
  hot = 0.0;
  if (i == M_PRINT) {
    vis = step(q.y, h + 0.011);
    hot = act * (1.0 - smoothstep(0.0, 0.035, abs(q.y - h)));
  }
  if (i == M_BED || i == M_PRINT) q.z += sin(uTime * 2.6) * 0.085 * act;   // bed slides front/back
  if (i == M_GANTRY || i == M_HEAD) q.y += h - uPrintRange.y;            // authored at the last layer
  if (i == M_HEAD) q.x += sin(uTime * 3.7) * 0.13 * act;                  // toolhead sweeps
  return vis;
}

// Where a particle is at flight time t on its way from a to b.
vec3 flowPos(float t, vec3 a, vec3 b) {
  float e = smoother(t);
  float f = sin(PI * t);
  vec3 p = mix(a, b, e);
  vec3 mid = (a + b) * 0.5;
  // the whole cloud turns together around the vertical axis -> ribbons, not noise
  p = rotY(p, f * (1.5 + 0.45 * aRnd.y) * uSwirl);
  p += vec3(mid.x, 0.0, mid.z) * (0.5 + 0.4 * aRnd.x) * f * uSwirl;
  p.y += (0.16 + 0.22 * aRnd.w) * f * uSwirl * sin(mid.x * 2.2 + mid.z * 1.3 + uTime * 0.35);
  // smooth flow field: neighbours get almost the same push
  vec3 q = mid * 1.6 + vec3(0.0, uTime * 0.1, 0.0);
  vec3 flow = vec3(
    sin(q.y * 2.3 + cos(q.z * 1.7)),
    sin(q.z * 2.1 + cos(q.x * 1.9)) * 0.6,
    sin(q.x * 1.9 + cos(q.y * 2.2))
  );
  p += flow * 0.3 * f * uSwirl;
  p += (aRnd.yzw - 0.5) * 0.1 * f;
  return p;
}

void main() {
  float delay = clamp(aRnd.x * 0.42 + (aFrom.y + 1.0) * 0.1, 0.0, 0.55);
  float lt = clamp((uMix - delay) / 0.45, 0.0, 1.0);

  vec3 a = aFrom.xyz, b = aTo.xyz;
  float visA = 1.0, visB = 1.0, hotA = 0.0, hotB = 0.0;
  if (uFromP > 0.5) visA = printerAnim(a, aFrom.w, hotA);
  if (uToP > 0.5) visB = printerAnim(b, aTo.w, hotB);

  vec3 p = flowPos(lt, a, b);
  vec3 tan3 = flowPos(min(lt + 0.012, 1.0), a, b) - flowPos(max(lt - 0.012, 0.0), a, b);
  float fly = sin(PI * lt);
  float e = smoother(lt);
  float vis = mix(visA, visB, e);

  // intro: the figure pops out of the floor with a springy overshoot (no threads)
  float pop = 1.0;
  if (uIntro > 0.0) {
    float t = 1.0 - uIntro;
    float d = (aFrom.y + 1.0) * 0.16 + length(aFrom.xz) * 0.12 + aRnd.x * 0.06;
    float li = clamp((t - d) / 0.5, 0.0, 1.0);
    pop = li <= 0.0 ? 0.0 : 1.0 - exp(-5.5 * li) * cos(11.0 * li);
    vec3 base = vec3(0.0, -1.0, 0.0);
    p = base + (p - base) * pop;
    tan3 = vec3(0.0, 1.0, 0.0);
  }

  // pointer: voxels lean away from the cursor ray
  vec3 v = p - uMouseO;
  vec3 diff = p - (uMouseO + uMouseD * dot(v, uMouseD));
  float dist = length(diff);
  float push = uMouseK * smoothstep(0.38, 0.0, dist) * (1.0 - fly);
  p += diff / max(dist, 1e-4) * push * 0.16;

  float cell = mix(uCellA, uCellB, e);
  float th = smoothstep(0.02, 0.3, fly);

  // cube at rest
  vec3 cubeLocal = position * cell * (1.0 - 0.18 * push) * clamp(pop * 1.3, 0.0, 1.15) * vis;
  // thread in flight: thin box stretched along the path tangent
  float speed = length(tan3);
  vec3 fwd = speed > 1e-5 ? tan3 / speed : vec3(0.0, 1.0, 0.0);
  vec3 ref = abs(fwd.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 side = normalize(cross(fwd, ref));
  vec3 up2 = cross(side, fwd);
  float w = cell * 0.2;
  float len = clamp(speed * 7.0, cell * 0.8, 0.55);
  vec3 threadLocal = side * position.x * w + up2 * position.y * w + fwd * position.z * len;

  vec3 local = mix(cubeLocal, threadLocal * max(vis, step(0.5, fly)), th);
  vec4 mv = modelViewMatrix * vec4(p + local, 1.0);
  gl_Position = projectionMatrix * mv;

  vec3 nThread = side * normal.x + up2 * normal.y + fwd * normal.z;
  vN = normalize(normalMatrix * normalize(mix(normal, nThread, th)));
  vLocal = position;
  vAO = mix(aAO.x, aAO.y, e);
  vColor = mix(matColor(aFrom.w), matColor(aTo.w), e);
  vEmis = mix(matEmis(aFrom.w, aFrom.xyz), matEmis(aTo.w, aTo.xyz), e) + mix(hotA, hotB, e) * 0.7;
  vThread = th;

  // Kajiya-Kay style sheen: threads catch the light when they lie across it
  vec3 tv = normalize(normalMatrix * fwd);
  vec3 h = normalize(uKeyDir + vec3(0.0, 0.0, 1.0));
  float th2 = dot(tv, h);
  vSheen = pow(sqrt(max(0.0, 1.0 - th2 * th2)), 18.0);
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

uniform float uTheme;
uniform vec3 uKeyDir;
uniform vec3 uFillDir;

varying vec3 vColor;
varying vec3 vN;
varying vec3 vLocal;
varying float vAO;
varying float vEmis;
varying float vThread;
varying float vSheen;

void main() {
  vec3 N = normalize(vN);
  float key = max(dot(N, uKeyDir), 0.0);
  float fill = max(dot(N, uFillDir), 0.0);
  float sky = 0.5 + 0.5 * N.y;
  float rim = pow(1.0 - max(N.z, 0.0), 2.0);
  float ao = vAO;

  vec3 day = vColor * (
      vec3(0.93, 0.95, 1.0) * (0.5 * sky * ao + 0.1)
    + vec3(1.0, 0.96, 0.9) * (0.66 * key * mix(0.6, 1.0, ao))
    + vec3(0.9, 0.93, 1.0) * (0.16 * fill * ao)
  );
  vec3 night = vColor * (
      vec3(0.55, 0.63, 0.82) * (0.3 * sky * ao + 0.05)
    + vec3(1.0, 0.84, 0.66) * (1.05 * key * mix(0.45, 1.0, ao))
    + vec3(0.6, 0.7, 1.0) * (0.12 * fill * ao)
  ) + vec3(1.0, 0.5, 0.3) * rim * 0.2 * ao;
  vec3 col = mix(day, night, uTheme);

  // a whisper of bevel so a flat face still reads as stacked cubes, without a grid
  vec3 q = abs(vLocal) * 2.0;
  float mx = max(q.x, max(q.y, q.z));
  float mn = min(q.x, min(q.y, q.z));
  float second = q.x + q.y + q.z - mx - mn;
  float edge = smoothstep(0.8, 0.98, second) * (1.0 - vThread);
  col *= 1.0 - edge * mix(0.06, 0.12, uTheme);
  col = mix(col, vColor * 1.2, clamp(vEmis, 0.0, 1.0));

  // silk
  vec3 inked = mix(vColor, vec3(0.13, 0.14, 0.16), 0.35);
  vec3 silkDay = inked * 0.85 + vec3(1.0, 0.98, 0.94) * vSheen * 0.55;
  vec3 silkNight = vColor * (0.75 + 1.6 * vSheen) + vec3(0.25, 0.9, 0.85) * vSheen * 0.25;
  col = mix(col, mix(silkDay, silkNight, uTheme), vThread);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
