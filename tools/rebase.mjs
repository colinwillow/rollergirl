// npm run rebase -- <new drawing> [--apply] [parks/<name>.json]
// MOVES A SCHEMATIC ONTO A NEW RENDER OF THE SAME PARK. He sends a sharper or re-generated plan; every position in the
// schematic is a pixel of the OLD drawing, so before anything can be retraced at the new detail the whole file has to be
// carried across. This finds the scale and offset that best line the two drawings up (normalised cross-correlation of
// their greyscale, coarse then fine), prints it, and with --apply rewrites every pixel field in the schematic into the new
// drawing's pixels, re-pins it so the same pixel lands on the same world point, sets `mpp` from the scale, and copies the
// new drawing in as `parks/<name>.webp` (the old one is kept as `<name>_v<n>.webp`).
// THE WORLD DOES NOT MOVE: only the pixels change, so the park builds where it did and a piece the new render draws in a
// slightly different place shows up in `npm run plan`'s overlay, which is where retracing starts.
// A REGENERATED render is not an upscale: the fit is a compromise and local features drift (the correlation it prints
// says how much). An upscale of the same picture correlates near 1.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2), apply = args.includes('--apply');
const file = args.find(a => a.endsWith('.json')) || 'parks/mega_skatepark.json';
const img = args.find(a => !a.startsWith('--') && !a.endsWith('.json'));
if (!img) { console.error('usage: npm run rebase -- <new drawing> [--apply] [parks/<name>.json]'); process.exit(1); }
const J = JSON.parse(fs.readFileSync(file, 'utf8'));

// the region the schematic draws on, in the old drawing
const P = [];
for (const G of J.ground || []) P.push(...G.pts);
for (const A of J.areas) for (const q of A.pieces || []) { if (q.pts) P.push(...q.pts); if (q.p) P.push(q.p); if (q.c) P.push(q.c); }
const bx0 = Math.min(...P.map(p => p[0])), bx1 = Math.max(...P.map(p => p[0])), by0 = Math.min(...P.map(p => p[1])), by1 = Math.max(...P.map(p => p[1]));

const k = 4;
const nm = await sharp(img).metadata();
const nw = await sharp(img).greyscale().resize(Math.round(nm.width / k), Math.round(nm.height / k)).raw().toBuffer({ resolveWithObject: true });
const ol = await sharp(J.image).greyscale().raw().toBuffer({ resolveWithObject: true });
const NW = nw.info.width, NH = nw.info.height, OW = ol.info.width, OH = ol.info.height;
const O = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, d = ol.data;
  if (xi < 0 || yi < 0 || xi >= OW - 1 || yi >= OH - 1) return 0;
  const a = d[yi * OW + xi], b = d[yi * OW + xi + 1], c = d[(yi + 1) * OW + xi], e = d[(yi + 1) * OW + xi + 1]; return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + e * fx * fy; };
// model: old = o + new / s, per axis
function score(sx, sy, ox, oy, step) { let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  for (let y = 2; y < NH - 2; y += step) for (let x = 2; x < NW - 2; x += step) { const X = ox + x * k / sx, Y = oy + y * k / sy;
    if (X < bx0 || Y < by0 || X > bx1 || Y > by1) continue;
    const a = nw.data[y * NW + x], b = O(X, Y); sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++; }
  if (n < 200) return -1; const ma = sa / n, mb = sb / n; return (sab / n - ma * mb) / Math.sqrt((saa / n - ma * ma) * (sbb / n - mb * mb)); }
// the scale guess: the new drawing's width over the old region's, searched 15% either side
const s0 = nm.width / (bx1 - bx0 + 40);
let best = [-2];
for (let sc = s0 * 0.85; sc <= s0 * 1.15; sc += s0 * 0.01)      // one scale first, then the two axes apart
  for (let ox = bx0 - 40; ox <= bx0 + 20; ox += 4) for (let oy = by0 - 40; oy <= by0 + 20; oy += 4) { const s = score(sc, sc, ox, oy, 3); if (s > best[0]) best = [s, sc, sc, ox, oy]; }
for (const [ds, dof] of [[0.01, 2], [0.004, 1], [0.0015, 0.5], [0.0005, 0.25]]) { const [, SX, SY, OX, OY] = best;
  for (let sx = SX - 4 * ds; sx <= SX + 4 * ds; sx += ds) for (let sy = SY - 4 * ds; sy <= SY + 4 * ds; sy += ds)
    for (let ox = OX - 4 * dof; ox <= OX + 4 * dof; ox += dof) for (let oy = OY - 4 * dof; oy <= OY + 4 * dof; oy += dof) { const s = score(sx, sy, ox, oy, 2); if (s > best[0]) best = [s, sx, sy, ox, oy]; } }
const [cor, sx, sy, ox, oy] = best;
console.log(`fit: old = (${ox.toFixed(2)}, ${oy.toFixed(2)}) + new / (${sx.toFixed(4)}, ${sy.toFixed(4)})   correlation ${cor.toFixed(3)}` +
  (cor < 0.8 ? '  -- a re-render, not an upscale: expect local drift' : ''));
if (!apply) process.exit(0);

const r1 = v => Math.round(v * 10) / 10, X = x => r1((x - ox) * sx), Y = y => r1((y - oy) * sy);
const pt = p => [X(p[0]), Y(p[1]), ...p.slice(2)];
for (const G of J.ground || []) G.pts = G.pts.map(pt);
for (const A of J.areas) {
  if (A.label) A.label = pt(A.label); if (A.stop) A.stop.p = pt(A.stop.p);
  for (const q of A.pieces || []) {
    for (const f of ['p', 'c']) if (q[f]) q[f] = pt(q[f]);
    if (Array.isArray(q.face)) q.face = pt(q.face);
    for (const f of ['pts', 'outer', 'trees', 'bumps']) if (q[f]) q[f] = q[f].map(pt);
    if (q.holes) q.holes = q.holes.map(H => H.map(pt));
  }
}
if (J.spawn) J.spawn.p = pt(J.spawn.p);
const [px0, py0] = J.pin.px; J.pin.px = [r1((px0 - ox) * sx), r1((py0 - oy) * sy)];
J.mpp = +(J.mpp / ((sx + sy) / 2)).toFixed(5);
const base = path.join(path.dirname(J.image), path.basename(file, '.json'));
let v = 1; while (fs.existsSync(`${base}_v${v}.webp`)) v++;
fs.copyFileSync(J.image, `${base}_v${v}.webp`);
await sharp(img).webp({ quality: 90 }).toFile(base + '.webp');
J.image = base + '.webp';
J.source = (J.source || '') + ` Rebased onto a new render (old drawing kept as ${base}_v${v}.webp; fit correlation ${cor.toFixed(2)}).`;
fs.writeFileSync(file, JSON.stringify(J, null, 1) + '\n');
console.log(`rebased ${file}: pin ${J.pin.px} -> ${J.pin.world}, mpp ${J.mpp}; old drawing kept as ${base}_v${v}.webp`);
