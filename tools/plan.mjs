// npm run plan [parks/<name>.json] -- THE SCHEMATIC AGAINST THE DRAWING IT WAS TRACED FROM.
// Renders the park the schematic builds from straight above, at the drawing's own scale and orientation, in headless
// chromium (tools/shot.mjs), and writes three pictures beside the schematic's drawing:
//   shots/plan_<name>_side.png     the drawing | the build, the same region side by side
//   shots/plan_<name>_overlay.png  the build laid over the drawing at half strength -- where a piece is off, it shows
//   shots/plan_<name>_persp.png    a perspective of the build from the south-west, as his sheet draws one
// The camera is set from the schematic's own `mpp` and `pin`, so a pixel of the render IS a pixel of the drawing: the
// overlay is the test that the trace is where he drew it, and it is the step a new schematic is checked with.
// Slow (software GL, ~30 s) -- run it when a schematic changes, not on every build.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const file = process.argv[2] || 'parks/mega_skatepark.json';
const J = JSON.parse(fs.readFileSync(file, 'utf8'));
const name = path.basename(file, '.json');
// the region: everything the schematic draws on, plus a margin
const P = [];
for (const G of J.ground || []) P.push(...G.pts);
for (const A of J.areas) for (const q of A.pieces || []) { if (q.pts) P.push(...q.pts); if (q.p) P.push(q.p); if (q.c) P.push(q.c); }
const pad = 14, x0 = Math.floor(Math.min(...P.map(p => p[0])) - pad), x1 = Math.ceil(Math.max(...P.map(p => p[0])) + pad);
const y0 = Math.floor(Math.min(...P.map(p => p[1])) - pad), y1 = Math.ceil(Math.max(...P.map(p => p[1])) + pad);
const K = 2, Wpx = (x1 - x0) * K, Hpx = (y1 - y0) * K;
const m = J.mpp, [px0, py0] = J.pin.px, [wx0, wz0] = J.pin.world, W = (x, y) => [wx0 + (x - px0) * m, wz0 + (y - py0) * m];
const [cx, cz] = W((x0 + x1) / 2, (y0 + y1) / 2), hM = (y1 - y0) * m, fov = 6, D = (hM / 2) / Math.tan(fov / 2 * Math.PI / 180);
const shots = [
  { name: `plan_${name}_top`, query: '?world=kit', view: [Wpx, Hpx], at: [...W(...J.spawn.p).slice(0, 1), 0.2, W(...J.spawn.p)[1], 0],
    pos: [cx, D, cz + 0.001], look: [cx, 0, cz], up: [0, 0, -1], fov, near: D - 120, far: D + 40, fog: false, wait: 5000 },
  { name: `plan_${name}_persp`, query: '?world=kit', view: [1600, 900], at: [...W(...J.spawn.p).slice(0, 1), 0.2, W(...J.spawn.p)[1], 0],
    pos: [...(() => { const [a, b] = W(x0 - 60, y1 + 90); return [a, 95, b]; })()], look: [cx + 8, 0, cz - 8], up: [0, 1, 0], fov: 48, far: 2000, fog: false, wait: 2500 }
];
// r77: his angled view, from the camera `npm run oblique` fitted to it -- the same rotations, in the same order
if (J.oblique) { const [x, y, z, yaw, pitch, roll, f] = J.oblique.cam, [OW, OH] = J.oblique.size;
  const rot = ([dx, dy, dz]) => { const cr = Math.cos(roll), sr = Math.sin(roll); [dx, dy] = [dx * cr - dy * sr, dx * sr + dy * cr];
    const cp = Math.cos(pitch), sp = Math.sin(pitch); [dy, dz] = [dy * cp - dz * sp, dy * sp + dz * cp];
    const cy = Math.cos(yaw), sy = Math.sin(yaw); [dx, dz] = [dx * cy + dz * sy, -dx * sy + dz * cy]; return [dx, dy, dz]; };
  const F = rot([0, 0, -1]), U = rot([0, 1, 0]), Dd = Math.hypot(x - cx, y, z - cz);
  shots.push({ name: `plan_${name}_oblique`, query: '?world=kit', view: [OW, OH], at: shots[0].at, pos: [x, y, z], look: [x + F[0] * Dd, y + F[1] * Dd, z + F[2] * Dd], up: U,
    fov: 2 * Math.atan(OH / 2 / f) * 180 / Math.PI, near: Math.max(1, Dd - 400), far: Dd + 400, fog: false, wait: 2500 }); }
fs.mkdirSync('shots', { recursive: true });
fs.writeFileSync('shots/_plan.json', JSON.stringify(shots));
const r = spawnSync(process.execPath, ['tools/shot.mjs', '--json', 'shots/_plan.json'], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);

const img = J.image;
const drawing = await sharp(img).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).resize(Wpx, Hpx).png().toBuffer();
const render = fs.readFileSync(`shots/plan_${name}_top.png`);
const title = (t, w) => Buffer.from(`<svg width="${w}" height="56" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1d1b2c"/>` +
  `<text x="18" y="38" font-family="sans-serif" font-size="28" font-weight="bold" fill="#ffffff">${t}</text></svg>`);
const gap = 24;
await sharp({ create: { width: Wpx * 2 + gap, height: Hpx + 56, channels: 3, background: '#1d1b2c' } })
  .composite([{ input: title('HIS PLAN', Wpx), left: 0, top: 0 }, { input: title(`BUILT FROM ${name}.json -- ${J.areas.reduce((n, a) => n + (a.pieces || []).length, 0)} schematic entries`, Wpx), left: Wpx + gap, top: 0 },
    { input: drawing, left: 0, top: 56 }, { input: render, left: Wpx + gap, top: 56 }])
  .png().toFile(`shots/plan_${name}_side.png`);
const faded = await sharp(render).ensureAlpha(0.55).png().toBuffer();
await sharp(drawing).composite([{ input: faded, blend: 'over' }]).png().toFile(`shots/plan_${name}_overlay.png`);
if (J.oblique) { const [OW, OH] = J.oblique.size, ob = fs.readFileSync(`shots/plan_${name}_oblique.png`), his = await sharp(J.oblique.image).resize(OW, OH).png().toBuffer();
  await sharp({ create: { width: OW * 2 + gap, height: OH + 56, channels: 3, background: '#1d1b2c' } })
    .composite([{ input: title('HIS ANGLED VIEW', OW), left: 0, top: 0 }, { input: title(`THE BUILD, FROM HIS CAMERA (fit ${J.oblique.fit})`, OW), left: OW + gap, top: 0 },
      { input: his, left: 0, top: 56 }, { input: ob, left: OW + gap, top: 56 }]).png().toFile(`shots/plan_${name}_oblique_side.png`);
  await sharp(his).composite([{ input: await sharp(ob).ensureAlpha(0.55).png().toBuffer(), blend: 'over' }]).png().toFile(`shots/plan_${name}_oblique_overlay.png`); }
console.log(`plan: region ${x0},${y0} .. ${x1},${y1} px = ${((x1 - x0) * m).toFixed(0)} x ${((y1 - y0) * m).toFixed(0)} m; ` +
  `shots/plan_${name}_side.png, _overlay.png, _persp.png`);
