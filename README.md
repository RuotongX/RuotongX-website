# ruotongxu-site

Personal site for Ruotong (Sam) Xu. It has one voxel sculpture that re-sculpts itself as you scroll. Nothing is pre-rendered: every form is defined as a signed distance field, voxelised in a Web Worker on page load, and drawn as a single instanced mesh.

```
Miku (fuwa petit plush) → two chat bubbles → guitar → home-lab rack → mortarboard → tower crane → rubbish truck → Bambu Lab A1 printing a camera → New Zealand
```

This repo used to hold the 2022 React/antd profile site; that version lives in git history (last commit `d2dbbda`).

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5320  (uses node ./node_modules/vite/bin/vite.js — `npx vite` is broken on this PC)
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ on :5321
npm run probe      # voxelise every form in Node: voxel counts, timings, materials
```

## Deploy: push to `master`

Cloudflare **Workers Builds** watches this repo. Every push to `master` runs:

1. `npm ci`. The Node version comes from `.node-version`, which is 22.
2. `npm run build`, which runs `tsc --noEmit` and then the vite build into `dist/`.
3. `npx wrangler deploy`, which uploads `dist/` as static assets for the Worker `ruotongxu-site`, configured in `wrangler.jsonc`.

Pushes to any other branch upload a preview version and do not change the live site. Build logs are in the dashboard under Workers & Pages → ruotongxu-site → Deployments → View build history.

- **One-time setup (dashboard):** Workers & Pages → ruotongxu-site → Settings → Builds → Connect → GitHub → `RuotongX/RuotongX-website`. Set the branch to `master`, the build command to `npm run build`, and the deploy command to `npx wrangler deploy`.
- **Manual deploy from this PC (fallback):** `npm run deploy`. Run `node ./node_modules/wrangler/bin/wrangler.js login` once first.
- **Domains:** `ruotongxu.dpdns.org` is a Custom Domain on the Worker. `ruotongxu-site.bagadiyi.workers.dev` stays on as a preview.
- **Hosting files:** `public/_headers` gives the hashed `/assets/*` files a long cache, and `public/404.html` is the not-found page.
- **Favicon:** `npm run favicon` re-renders `public/favicon.svg` from the Miku SDF as a pixel-art front view of her head.

## How it works

| Piece | File | Notes |
|---|---|---|
| SDF toolkit | `src/voxel/sdf.ts` | Primitives from Inigo Quilez, plus `Acc`, an accumulator that carries a material id. It supports union, smooth union, cut and paint. |
| The forms | `src/voxel/shapes.ts` | One function per form. `cell` is the voxel size. The NZ map is filled from `src/data/nz.ts`, the Natural Earth coastline, with fake relief for the Alps, Ruapehu and Taranaki. |
| Voxeliser | `src/voxel/voxelize.ts` | Samples the SDF on a grid and keeps only surface voxels. It computes 5×5×5 ambient occlusion and sorts by height then angle so that morphs stay coherent. |
| Worker | `src/voxel/voxel.worker.ts` | All 9 forms take about 0.4 s off the main thread. Small screens and ≤4-core devices use voxels 1.28× bigger, which gives about half the count. |
| Morph | `src/scene/sculpture.ts`, `shaders.ts` | Every instance has a `from` and a `to` position. There are up to 3× more instances than the biggest form has voxels: at rest the copies overlap; in flight each cube stretches into thin threads that ride a shared vortex (the "silk"). |
| Choreography | `src/scene/stage.ts` | `POSES[]` sets the screen position, scale and rotation for each form. Scroll progress is damped, and on mobile the sculpture sits above the copy card. |
| Page | `index.html`, `src/style.css`, `src/main.ts` | The copy is plain HTML. Each `data-form="n"` section maps to form n. The morph into form n plays while section n travels from 95% to 20% of the viewport. The home-lab section is pinned for 3 screens while the rack turns; its `<li data-pt="x,y,z">` items become callouts anchored to those points on the rack. |

### Adding or changing a form

1. Write an SDF function in `shapes.ts` and add it to `SHAPES` at the position you want.
2. Add a matching entry to `POSES` in `stage.ts`. The two arrays must stay the same length and order.
3. Add a section with the next `data-form` index to `index.html`, and a name to `FIG_NAMES` in `main.ts`.
4. Run `npm run probe` to check the voxel count. Keep each form under about 15k; the largest form sets the instance count.

### Theme

Click the lamp button to switch themes. The choice is saved in `localStorage['rx-theme']`, and the OS preference is the default. The 3D palettes live in `src/voxel/materials.ts`. The CSS tokens are at the top of `style.css`.

### Pinned multi-form sections

A section with `data-steps="n"` holds n consecutive forms. Inside its sticky pin, one extra morph plays every 1.2 viewports (`STEP` in `main.ts`), so the section needs about `(n - 1) * 1.2 + 1.9` viewports of height. The "Since graduating" route uses this: AUT → RF Sons → Rubbish Direct.

### Off the clock (photos + the printer)

- `npm run photos -- "<folder with the originals>"` reads `tools/photos.json` for the order and captions. It writes `public/photos/<id>-<h>.webp` at two heights, removing all EXIF data including GPS, and rewrites the figures between `<!-- photos:start -->` and `<!-- photos:end -->` in `index.html`. The originals never enter the repo.
- On desktop the section is pinned. The first 0.8 viewport of scroll runs the print, then the strip slides sideways by exactly the remaining scroll, with the sculpture moving along with it. Phones get a vertical list, and the sculpture fades out while photos are on screen.
- The print animation runs in the vertex shader (`printerAnim`), keyed on the material ids GANTRY, HEAD, BED and PRINT:
  - PRINT voxels above the current layer are hidden, and the layer being laid down glows.
  - The gantry and head are authored at the last layer and lowered to the current one.
  - The bed slides and the head sweeps.
  - The heights live in `src/voxel/printer.ts`. Parts that move separately keep their touching faces as surfaces (`MOTION_GROUP` in `voxelize.ts`).
