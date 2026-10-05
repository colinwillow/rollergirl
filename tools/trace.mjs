// npm run trace -- <image> <x0> <y0> <x1> <y1> [zoom] [out.png]   A GRIDDED ZOOM OF A PLAN, FOR TRACING A SCHEMATIC.
// Every 10 px of the drawing gets a faint line and every 50 a labelled one, in the drawing's OWN pixel coordinates -- the
// numbers a schematic's `p` / `c` / `pts` are written in. Reading an outline off this is how parks/*.json is made.
import sharp from 'sharp';
const [img, a, b, c, d, z, out] = process.argv.slice(2);
if (!img || d == null) { console.log('npm run trace -- <image> <x0> <y0> <x1> <y1> [zoom 4] [out]'); process.exit(1); }
const X0 = +a, Y0 = +b, X1 = +c, Y1 = +d, K = +(z || 4), w = (X1 - X0) * K, h = (Y1 - Y0) * K;
let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`;
for (let x = Math.ceil(X0 / 10) * 10; x < X1; x += 10) { const X = (x - X0) * K, M = x % 50 === 0;
  svg += `<line x1="${X}" y1="0" x2="${X}" y2="${h}" stroke="${M ? 'red' : 'rgba(255,0,0,0.3)'}" stroke-width="${M ? 1.5 : 0.7}"/>`;
  if (M) for (const Y of [12, h / 2, h - 4]) svg += `<text x="${X + 2}" y="${Y}" font-size="13" font-family="sans-serif" fill="red" stroke="white" stroke-width="0.4">${x}</text>`; }
for (let y = Math.ceil(Y0 / 10) * 10; y < Y1; y += 10) { const Y = (y - Y0) * K, M = y % 50 === 0;
  svg += `<line x1="0" y1="${Y}" x2="${w}" y2="${Y}" stroke="${M ? 'blue' : 'rgba(0,0,255,0.3)'}" stroke-width="${M ? 1.5 : 0.7}"/>`;
  if (M) for (const X of [2, w / 2, w - 34]) svg += `<text x="${X}" y="${Y - 2}" font-size="13" font-family="sans-serif" fill="blue" stroke="white" stroke-width="0.4">${y}</text>`; }
svg += '</svg>';
const file = out || `shots/trace_${X0}_${Y0}.png`;
await sharp(img).extract({ left: X0, top: Y0, width: X1 - X0, height: Y1 - Y0 }).resize(w, h, { kernel: 'lanczos3' })
  .composite([{ input: Buffer.from(svg) }]).png().toFile(file);
console.log(file);
