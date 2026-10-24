// Turns full-size photos into web copies for the "Off the clock" strip and writes the strip's HTML.
//
//   npm run photos -- "C:\Users\SamXu\Downloads"
//
// - Reads tools/photos.json (order, captions). `file` is looked up in the source folder.
// - Writes public/photos/<id>-<h>.webp at two heights. All metadata (incl. any GPS) is dropped.
// - Replaces everything between <!-- photos:start --> and <!-- photos:end --> in index.html.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error('usage: npm run photos -- <folder with the original photos>');
  process.exit(1);
}
sharp.cache(false);
const list = JSON.parse(readFileSync('tools/photos.json', 'utf8'));
mkdirSync('public/photos', { recursive: true });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const figures = [];
let total = 0;
for (const [i, p] of list.entries()) {
  const input = join(src, p.file);
  const heights = p.wide ? [560, 960] : [700, 1200];
  const variants = [];
  for (const h of heights) {
    const out = `public/photos/${p.id}-${h}.webp`;
    const info = await sharp(input, { limitInputPixels: false })
      .rotate()
      .resize({ height: h, withoutEnlargement: true })
      .webp({ quality: p.wide ? 70 : 76, effort: 5 })
      .toFile(out);
    total += info.size;
    variants.push({ url: `/photos/${p.id}-${h}.webp`, w: info.width, h: info.height, kb: Math.round(info.size / 1024) });
  }
  const big = variants[variants.length - 1];
  const ar = big.w / big.h;
  // strip height is 62vh on desktop; on phones the photo is ~92vw wide
  const sizes = `(max-width: 860px) 92vw, ${Math.round(62 * ar)}vh`;
  figures.push(
    `          <figure class="oc-photo${p.wide ? ' is-wide' : ''}" style="--ar: ${ar.toFixed(3)}">\n` +
      `            <img src="${variants[0].url}" srcset="${variants.map((v) => `${v.url} ${v.w}w`).join(', ')}" sizes="${sizes}"\n` +
      `              width="${big.w}" height="${big.h}" ${i < 2 ? 'loading="eager"' : 'loading="lazy"'} decoding="async" alt="${esc(p.title)}" />\n` +
      `            <figcaption><b>${esc(p.title)}</b><span>${esc(p.meta)}</span></figcaption>\n` +
      `          </figure>`,
  );
  console.log(`${p.id.padEnd(13)} ${variants.map((v) => `${v.w}x${v.h} ${v.kb}KB`).join('  ')}`);
}

const html = readFileSync('index.html', 'utf8');
const re = /(<!-- photos:start -->)[\s\S]*?(\s*<!-- photos:end -->)/;
if (!re.test(html)) throw new Error('photo markers not found in index.html');
writeFileSync('index.html', html.replace(re, `$1\n${figures.join('\n')}$2`));
console.log(`${list.length} photos, ${Math.round(total / 1024)} KB total`);
