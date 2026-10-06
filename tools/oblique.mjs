// npm run oblique -- <angled render> [parks/<name>.json]   FITS THE CAMERA OF A TILTED VIEW OF THE SAME PARK (r77).
// His top-down plan says where everything is and nothing about how tall it is; a view from about 45 degrees down says
// both, but only once you know where the camera was. This finds it: every pixel of the angled view is cast as a ray onto
// the ground plane, looked up in the top-down drawing through the schematic's own `pin` / `mpp`, and the camera
// (position, yaw, pitch, roll, focal length) that makes the two pictures agree best (correlation of their greyscale)
// wins -- a grid of starting guesses, then Nelder-Mead. The ground is most of either picture, so tall things disagreeing
// does not throw it off. It writes `oblique: { image, cam, fit }` into the schematic and copies the view in beside the
// plan; `npm run plan` then renders the BUILD from that same camera, so his angled view and ours sit side by side and a
// ramp drawn taller or shorter than it is built is read straight off the pair.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const args = process.argv.slice(2), file = args.find(a => a.endsWith('.json')) || 'parks/mega_skatepark.json', img = args.find(a => !a.endsWith('.json'));
if (!img) { console.error('usage: npm run oblique -- <angled render> [parks/<name>.json]'); process.exit(1); }
const J = JSON.parse(fs.readFileSync(file, 'utf8'));
const k = 4;
const ld = async (f) => { const m = await sharp(f).metadata(); const r = await sharp(f).greyscale().resize(Math.round(m.width / k), Math.round(m.height / k)).blur(0.8).raw().toBuffer({ resolveWithObject: true }); return { d: r.data, w: r.info.width, h: r.info.height, W: m.width, H: m.height }; };
const TD = await ld(J.image), OB = await ld(img);
const smp = (I, x, y) => { x /= k; y /= k; const xi = Math.floor(x), yi = Math.floor(y); if (xi < 0 || yi < 0 || xi >= I.w - 1 || yi >= I.h - 1) return null; const fx = x - xi, fy = y - yi, d = I.d, w = I.w;
  return d[yi * w + xi] * (1 - fx) * (1 - fy) + d[yi * w + xi + 1] * fx * (1 - fy) + d[(yi + 1) * w + xi] * (1 - fx) * fy + d[(yi + 1) * w + xi + 1] * fx * fy; };
const m = J.mpp, [px0, py0] = J.pin.px, [wx0, wz0] = J.pin.world;
// camera: position (x, y, z), yaw (0 = looking -z, north), pitch (negative down), roll, f (px, at full res)
function rayGround(p, u, v) { const [cx, cy, cz, yaw, pitch, roll, f] = p; const W = OB.W, H = OB.H;
  let dx = (u - W / 2) / f, dy = -(v - H / 2) / f, dz = -1;
  // roll about z, pitch about x, yaw about y
  const cr = Math.cos(roll), sr = Math.sin(roll); [dx, dy] = [dx * cr - dy * sr, dx * sr + dy * cr];
  const cp = Math.cos(pitch), sp = Math.sin(pitch); [dy, dz] = [dy * cp - dz * sp, dy * sp + dz * cp];
  const cyw = Math.cos(yaw), syw = Math.sin(yaw); [dx, dz] = [dx * cyw + dz * syw, -dx * syw + dz * cyw];
  if (dy >= -1e-6) return null; const t = -cy / dy; return [cx + dx * t, cz + dz * t]; }
// sample the middle of the angled view: its edges are mostly trees outside the park
const pts = []; for (let v = OB.H * 0.12; v < OB.H * 0.8; v += 8) for (let u = OB.W * 0.05; u < OB.W * 0.95; u += 8) pts.push([u, v]);
function score(p) { let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  for (const [u, v] of pts) { const g = rayGround(p, u, v); if (!g) continue; const X = px0 + (g[0] - wx0) / m, Y = py0 + (g[1] - wz0) / m;
    const a = smp(TD, X, Y), b = smp(OB, u, v); if (a == null || b == null) continue; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++; }
  if (n < pts.length * 0.5) return -1; const ma = sa / n, mb = sb / n; return (sab / n - ma * mb) / Math.sqrt((saa / n - ma * ma) * (sbb / n - mb * mb)); }
function nm(f, x0, s0, it) { let P = [x0]; for (let i = 0; i < x0.length; i++) { const x = x0.slice(); x[i] += s0[i]; P.push(x); }
  let F = P.map(f); for (let t = 0; t < it; t++) { const o = F.map((v, i) => i).sort((a, b) => F[b] - F[a]); P = o.map(i => P[i]); F = o.map(i => F[i]);
    const n = x0.length, c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += P[i][j] / n;
    const R = c.map((v, j) => v + (v - P[n][j])), fr = f(R);
    if (fr > F[0]) { const E = c.map((v, j) => v + 2 * (v - P[n][j])), fe = f(E); if (fe > fr) { P[n] = E; F[n] = fe; } else { P[n] = R; F[n] = fr; } }
    else if (fr > F[n - 1]) { P[n] = R; F[n] = fr; }
    else { const C = c.map((v, j) => v + 0.5 * (P[n][j] - v)), fc = f(C); if (fc > F[n]) { P[n] = C; F[n] = fc; } else { for (let i = 1; i <= n; i++) { P[i] = P[i].map((v, j) => P[0][j] + 0.5 * (v - P[0][j])); F[i] = f(P[i]); } } } }
  const o = F.map((v, i) => i).sort((a, b) => F[b] - F[a]); return [P[o[0]], F[o[0]]]; }
let best = null;
for (const el of [45, 55, 65]) for (const fov of [20, 35, 50]) {
  const P2 = J.ground[0].pts, gx = P2.map(q => q[0]), gy = P2.map(q => q[1]), wide = (Math.max(...gx) - Math.min(...gx)) * m;
  const f = OB.H / 2 / Math.tan(fov / 2 * Math.PI / 180), D = f / (OB.W * 0.93 / wide), cx = wx0 + ((Math.max(...gx) + Math.min(...gx)) / 2 - px0) * m, cz0 = wz0 + ((Math.max(...gy) + Math.min(...gy)) / 2 - py0) * m, e = el * Math.PI / 180;
  const p0 = [cx, D * Math.sin(e), cz0 + D * Math.cos(e), 0, -e, 0, f];
  const [p, s] = nm(score, p0, [10, 20, 20, 0.05, 0.05, 0.02, f * 0.1], 300); 
  if (!best || s > best[1]) best = [p, s]; }
let [p, s] = best; for (let r = 0; r < 3; r++) { [p, s] = nm(score, p, [3, 6, 6, 0.01, 0.01, 0.005, p[6] * 0.03], 400); }
const base = path.join(path.dirname(J.image), path.basename(file, '.json') + '_oblique.webp');
if (path.resolve(img) !== path.resolve(base)) await sharp(img).webp({ quality: 90 }).toFile(base);
J.oblique = { image: base, size: [OB.W, OB.H], cam: p.map(v => +v.toFixed(4)), fit: +s.toFixed(3),
  note: 'camera [x, y, z, yaw, pitch, roll, focal px] fitted by npm run oblique; npm run plan renders the build from it' };
fs.writeFileSync(file, JSON.stringify(J, null, 1) + '\n');
const el = Math.atan2(p[1], Math.hypot(p[0] - wx0, p[2] - wz0)) / Math.PI * 180;
console.log(`oblique: fit ${s.toFixed(3)} -- camera ${p.slice(0, 3).map(v => v.toFixed(0)).join(', ')}, looking ${(-p[4] / Math.PI * 180).toFixed(1)} deg down, ` +
  `vertical fov ${(2 * Math.atan(OB.H / 2 / p[6]) / Math.PI * 180).toFixed(1)} deg` + (s < 0.6 ? '  -- POOR FIT: is it the same park?' : ''));
