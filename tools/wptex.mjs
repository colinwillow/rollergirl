// npm run wptex [weirdport toon_city_kit dir] -- HIS PAINTED SURFACES FOR ROLLERGIRL'S OWN MATERIALS (r129).
//
// The main world's look is generated: a concrete, a plaster and a paving texture made in code (`detailTex`), plus the slice's
// stone, masonry, dark concrete and wood (`sliceMeshes`). This takes the matching painted textures out of his weirdport kit --
// the WebP in his raw GLBs, by MATERIAL NAME, so a repaint under the same name is picked up by re-running this -- cuts each to
// `SIZE` px, derives a normal map from its luminance (his kit carries no normal maps; the convention is `slTexOut`'s exactly:
// row 0 is v 0, +x right, +y up the rows, so the loader sets flipY false), and writes the mean LINEAR colour of each into
// `wptex.json`. The game needs that mean twice: the detail pass divides by the luminance (it applies a texture as luminance over
// its own mean), and the slice tints his texture by (our mean / his mean) so a sandstone wall stays sandstone with his surface.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DIR = process.argv[2] || '../colinwillow/weirdport/models/toon_city_kit';
const OUT = 'models/wpprops/tex', SIZE = 512;
// slot -> his material, the file it lives in, and how hard its relief is (the normal map's slope per unit of luminance)
const SLOTS = {
  floor: ['WK_M_stucco_or_plaster', 'toon_city_kit_pieces.glb', 1.0],     // ramps and sloped floors; the slice's concrete and plaster
  wall: ['WK_M_concrete', 'toon_city_kit_pieces.glb', 3.2],               // walls; the slice's ashlar
  pave: ['WR_Stone', 'toon_city_visual.glb', 1.2],                        // flat floors; the slice's paving
  brick: ['WK_M_brick', 'toon_city_kit_pieces.glb', 3.5],                 // the slice's canal masonry
  curb: ['WR_Curb', 'toon_city_visual.glb', 2.6],                         // the slice's dark concrete
  wood: ['WK_M_vertical_wood_planks', 'toon_city_kit_pieces.glb', 2.4],   // the slice's wood
};

const glbs = {};
function img(file, name) {
  if (!glbs[file]) { const b = fs.readFileSync(path.join(DIR, file)), jl = b.readUInt32LE(12);
    glbs[file] = { j: JSON.parse(b.slice(20, 20 + jl).toString()), bin: b.slice(20 + jl + 8) }; }
  const { j, bin } = glbs[file], m = (j.materials || []).find(m => m.name === name);
  if (!m) throw new Error(`${name} is not a material in ${file}`);
  const t = j.textures[m.pbrMetallicRoughness.baseColorTexture.index];
  const im = j.images[t.source ?? Object.values(t.extensions || {})[0].source], v = j.bufferViews[im.bufferView];
  return bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
}
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };

fs.mkdirSync(OUT, { recursive: true });
const J = { size: SIZE, from: DIR, slots: {} };
for (const [slot, [name, file, ns]] of Object.entries(SLOTS)) {
  const { data } = await sharp(img(file, name)).removeAlpha().resize(SIZE, SIZE, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const N = SIZE, mean = [0, 0, 0], h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) { const r = lin(data[i * 3]), g = lin(data[i * 3 + 1]), b = lin(data[i * 3 + 2]);
    mean[0] += r; mean[1] += g; mean[2] += b; h[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  for (let k = 0; k < 3; k++) mean[k] /= N * N;
  // a 3x3 box first, or the normal map is the WebP's own block noise; then normalised so `ns` means the same on a dark
  // asphalt and a white plaster
  const sm = new Float32Array(N * N); let lo = 1e9, hi = -1e9;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += h[((y + dy + N) % N) * N + ((x + dx + N) % N)];
    sm[y * N + x] = s / 9; }
  const sorted = Float32Array.from(sm).sort(); lo = sorted[(N * N * 0.02) | 0]; hi = sorted[(N * N * 0.98) | 0];
  const H = (i, j) => (sm[((j + N) % N) * N + ((i + N) % N)] - lo) / Math.max(1e-4, hi - lo);
  const nb = Buffer.alloc(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * ns, dy = (H(x, y + 1) - H(x, y - 1)) * ns, l = Math.hypot(dx, dy, 1), o = (y * N + x) * 3;
    nb[o] = (-dx / l * 0.5 + 0.5) * 255; nb[o + 1] = (dy / l * 0.5 + 0.5) * 255; nb[o + 2] = (1 / l * 0.5 + 0.5) * 255;
  }
  await sharp(data, { raw: { width: N, height: N, channels: 3 } }).webp({ quality: 88 }).toFile(`${OUT}/${slot}.webp`);
  await sharp(nb, { raw: { width: N, height: N, channels: 3 } }).webp({ quality: 92 }).toFile(`${OUT}/${slot}_n.webp`);
  J.slots[slot] = { mat: name, mean: mean.map(v => +v.toFixed(5)), lum: +(0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]).toFixed(5) };
  console.log(slot.padEnd(6), name.padEnd(28), 'mean lin', J.slots[slot].mean.join(' '), ' ',
    (fs.statSync(`${OUT}/${slot}.webp`).size / 1024).toFixed(0) + ' KB +', (fs.statSync(`${OUT}/${slot}_n.webp`).size / 1024).toFixed(0) + ' KB normal');
}
// r130: HIS TWO DECAL SHEETS, whole, with their alpha -- a 4 x 4 grid each. Street decals (cracks, potholes, manholes, oil, puddles,
// patches, paint arrows and stripes, tyre marks) go on the floors; the graffiti (sixteen drippy tags) goes on the walls.
J.atlas = {};
for (const [k, name, file] of [['decals', 'WK_M_street_decals', 'toon_city_visual.glb'], ['graffiti', 'WK_M_graffiti', 'toon_city_visual.glb']]) {
  await sharp(img(file, name)).ensureAlpha().resize(1024, 1024, { kernel: 'lanczos3' }).webp({ quality: 86, alphaQuality: 90 }).toFile(`${OUT}/${k}.webp`);
  J.atlas[k] = { mat: name, n: 4 };
  console.log(k.padEnd(9), name.padEnd(28), (fs.statSync(`${OUT}/${k}.webp`).size / 1024).toFixed(0) + ' KB');
}
fs.writeFileSync(`${OUT}/wptex.json`, JSON.stringify(J, null, 1) + '\n');
console.log(`${OUT}/wptex.json`);
