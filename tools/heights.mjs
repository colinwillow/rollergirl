// npm run heights -- '[["name", px, py], ...]' [out.png]   HOW TALL DID HE DRAW IT? (r77)
// For each point of the top-down plan, marks where that point would appear in his ANGLED view (the camera `npm run oblique`
// fitted) at 0, 2, 4 ... m up -- red is the ground. Read off which mark the drawn top of the thing sits on. HS='[0,4,8]'
// changes the heights. A caution that the first use taught: his top-down picture is itself a slightly tilted render, so a
// tall thing's top is drawn north of where its foot is -- probe the FOOT of a wall and read its top against the marks.
import fs from 'node:fs'; import sharp from 'sharp';
const J = JSON.parse(fs.readFileSync('parks/mega_skatepark.json', 'utf8')), [x, y, z, yaw, pitch, roll, f] = J.oblique.cam, [OW, OH] = J.oblique.size;
const m = J.mpp, [px0, py0] = J.pin.px, [wx0, wz0] = J.pin.world;
// world -> oblique pixel: invert the camera rotations
function proj(X, Y, Z) { let dx = X - x, dy = Y - y, dz = Z - z;
  const cy = Math.cos(-yaw), sy = Math.sin(-yaw); [dx, dz] = [dx * cy + dz * sy, -dx * sy + dz * cy];
  const cp = Math.cos(-pitch), sp = Math.sin(-pitch); [dy, dz] = [dy * cp - dz * sp, dy * sp + dz * cp];
  const cr = Math.cos(-roll), sr = Math.sin(-roll); [dx, dy] = [dx * cr - dy * sr, dx * sr + dy * cr];
  return [OW / 2 + f * dx / -dz, OH / 2 - f * dy / -dz]; }
const L = JSON.parse(process.argv[2]), out = process.argv[3] || 'shots/heights.png';
const tiles = [];
for (const [name, px, py] of L) { const X = wx0 + (px - px0) * m, Z = wz0 + (py - py0) * m, P = (process.env.HS ? JSON.parse(process.env.HS) : [0, 2, 4, 6, 8, 10, 12]).map(h => [h, ...proj(X, h, Z)]);
  const cx = P[0][1], cy0 = P[0][2], R = 70, x0 = Math.max(0, Math.min(OW - 2 * R, Math.round(cx - R))), y0 = Math.max(0, Math.min(OH - 2.5 * R, Math.round(cy0 - 2 * R))), K = 3;
  let svg = `<svg width="${2 * R * K}" height="${2.5 * R * K}" xmlns="http://www.w3.org/2000/svg">`;
  for (const [h, u, v] of P) { const X2 = (u - x0) * K, Y2 = (v - y0) * K; svg += `<circle cx="${X2}" cy="${Y2}" r="4" fill="${h ? 'yellow' : 'red'}" stroke="black"/><text x="${X2 + 7}" y="${Y2 + 4}" font-size="14" fill="yellow" stroke="black" stroke-width=".6">${h}</text>`; }
  svg += `<text x="4" y="16" font-size="15" fill="white" stroke="black" stroke-width=".7">${name}</text></svg>`;
  tiles.push(await sharp(J.oblique.image).extract({ left: x0, top: y0, width: 2 * R, height: 2.5 * R }).resize(2 * R * K, 2.5 * R * K).composite([{ input: Buffer.from(svg) }]).png().toBuffer()); }
const w = 420, h = 525, cols = 4, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * w, height: rows * h, channels: 3, background: '#222' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * w, top: Math.floor(i / cols) * h }))).png().toFile(out);
console.log(out);
