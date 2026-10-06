// npm run trace -- <image> <x0> <y0> <x1> <y1> [zoom] [out.png]   A GRIDDED ZOOM OF A PLAN, FOR TRACING A SCHEMATIC.
// Every 10 px of the drawing gets a faint line and every 50 a labelled one, in the drawing's OWN pixel coordinates -- the
// numbers a schematic's `p` / `c` / `pts` are written in. Reading an outline off this is how parks/*.json is made.
// `--over [parks/<name>.json]` lays the last `npm run plan` render of that schematic over the drawing at half strength,
// so what the build has wrong is read on the same grid as what he drew (r76).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const argv = process.argv.slice(2), oi = argv.indexOf('--over');
let over = null; if (oi >= 0) { over = argv[oi + 1] && argv[oi + 1].endsWith('.json') ? argv.splice(oi, 2)[1] : (argv.splice(oi, 1), 'parks/mega_skatepark.json'); }
const [img, a, b, c, d, z, out] = argv;
if (!img || d == null) { console.log('npm run trace -- <image> <x0> <y0> <x1> <y1> [zoom 4] [out]'); process.exit(1); }
const X0 = +a, Y0 = +b, X1 = +c, Y1 = +d, K = +(z || 4), w = Math.round((X1 - X0) * K), h = Math.round((Y1 - Y0) * K);
let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`;
for (let x = Math.ceil(X0 / 10) * 10; x < X1; x += 10) { const X = (x - X0) * K, M = x % 50 === 0;
  svg += `<line x1="${X}" y1="0" x2="${X}" y2="${h}" stroke="${M ? 'red' : 'rgba(255,0,0,0.3)'}" stroke-width="${M ? 1.5 : 0.7}"/>`;
  if (M) for (const Y of [12, h / 2, h - 4]) svg += `<text x="${X + 2}" y="${Y}" font-size="13" font-family="sans-serif" fill="red" stroke="white" stroke-width="0.4">${x}</text>`; }
for (let y = Math.ceil(Y0 / 10) * 10; y < Y1; y += 10) { const Y = (y - Y0) * K, M = y % 50 === 0;
  svg += `<line x1="0" y1="${Y}" x2="${w}" y2="${Y}" stroke="${M ? 'blue' : 'rgba(0,0,255,0.3)'}" stroke-width="${M ? 1.5 : 0.7}"/>`;
  if (M) for (const X of [2, w / 2, w - 34]) svg += `<text x="${X}" y="${Y - 2}" font-size="13" font-family="sans-serif" fill="blue" stroke="white" stroke-width="0.4">${y}</text>`; }
svg += '</svg>';
const file = out || `shots/trace_${X0}_${Y0}.png`;
const layers = [];
if (over) {      // the region plan.mjs renders, worked out the same way it does
  const J = JSON.parse(fs.readFileSync(over, 'utf8')), P = [];
  for (const G of J.ground || []) P.push(...G.pts);
  for (const A of J.areas) for (const q of A.pieces || []) { if (q.pts) P.push(...q.pts); if (q.p) P.push(q.p); if (q.c) P.push(q.c); }
  const rx = Math.floor(Math.min(...P.map(p => p[0])) - 14), ry = Math.floor(Math.min(...P.map(p => p[1])) - 14);
  const top = `shots/plan_${path.basename(over, '.json')}_top.png`, m = await sharp(top).metadata();
  const L = Math.max(0, (X0 - rx) * 2), T = Math.max(0, (Y0 - ry) * 2), W = Math.min(m.width - L, (X1 - X0) * 2), H = Math.min(m.height - T, (Y1 - Y0) * 2);
  const r = await sharp(top).extract({ left: L, top: T, width: W, height: H }).resize(Math.round(W * K / 2), Math.round(H * K / 2)).ensureAlpha(0.5).png().toBuffer();
  layers.push({ input: r, left: Math.round(Math.max(0, rx - X0) * K), top: Math.round(Math.max(0, ry - Y0) * K) });
}
layers.push({ input: Buffer.from(svg) });
await sharp(img).extract({ left: X0, top: Y0, width: X1 - X0, height: Y1 - Y0 }).resize(w, h, { kernel: 'lanczos3' })
  .composite(layers).png().toFile(file);
console.log(file);
