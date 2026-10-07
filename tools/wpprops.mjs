// npm run wpprops [visual.glb] -- CUTS HIS WEIRDPORT PROPS OUT OF HIS CITY FILE INTO A SMALL LIBRARY (r127).
//
// His toon city's visual GLB places every prop as a node pointing at ONE shared mesh per kind (183 soda cans, one
// mesh). So a library is one node per kind, and nothing has to be decoded or re-encoded: the draco primitives, the
// KTX2 images and the materials are copied byte for byte, and every bufferView nobody points at any more is dropped.
// Each node is written at the origin with no transform; his own scale for that kind (the median over every copy in his
// city, plus the range) goes in its extras, because the meshes are authored at tripo's unit size and the NODE carries
// the real size. Re-run it after every export of his city.
import fs from 'fs';

const SRC = process.argv[2] || (fs.existsSync('../colinwillow/weirdport/models/toon_city_kit/toon_city_visual_ktx2.glb')
  ? '../colinwillow/weirdport/models/toon_city_kit/toon_city_visual_ktx2.glb' : 'models/wpcity/toon_city_visual_ktx2.glb');
const OUT = 'models/wpprops/wp_props.glb';
const KEEP = /^(prop_planter|prop_crate|prop_dumpster|prop_cardboard_box|prop_tree_[a-z_]+?|debris_[a-z_]+?|plant_[a-z_]+?|brk_bench_intact|brk_lightpost_intact)$/;

const b = fs.readFileSync(SRC);
if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(SRC + ' is not a GLB');
const jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString());
const binOff = 20 + jl + 8, bin = b.slice(binOff, binOff + b.readUInt32LE(20 + jl));

// one node per kind, and every copy's scale
const fam = new Map();
j.nodes.forEach(n => {
  if (n.mesh == null) return;
  const f = (n.name || '').replace(/[._]\d+.*$/, '');
  if (!KEEP.test(f)) return;
  let F = fam.get(f); if (!F) fam.set(f, F = { mesh: n.mesh, s: [], extras: n.extras || {} });
  F.s.push(n.scale ? n.scale[0] : 1);
});

const out = { asset: { version: '2.0', generator: 'rollergirl tools/wpprops.mjs' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [],
  accessors: [], bufferViews: [], buffers: [], materials: [], textures: [], images: [], samplers: [] };
const map = { mesh: new Map(), acc: new Map(), bv: new Map(), mat: new Map(), tex: new Map(), img: new Map(), smp: new Map() };
const chunks = []; let off = 0;
const bv = i => { if (map.bv.has(i)) return map.bv.get(i);
  const v = j.bufferViews[i], data = bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), pad = (4 - (off % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
  const nv = { buffer: 0, byteOffset: off, byteLength: v.byteLength }; if (v.byteStride) nv.byteStride = v.byteStride; if (v.target) nv.target = v.target;
  chunks.push(data); off += v.byteLength; out.bufferViews.push(nv); map.bv.set(i, out.bufferViews.length - 1); return out.bufferViews.length - 1; };
const acc = i => { if (map.acc.has(i)) return map.acc.get(i);
  const a = { ...j.accessors[i] }; if (a.bufferView != null) a.bufferView = bv(a.bufferView); if (a.sparse) throw new Error('sparse accessor');
  out.accessors.push(a); map.acc.set(i, out.accessors.length - 1); return out.accessors.length - 1; };
const smp = i => { if (map.smp.has(i)) return map.smp.get(i); out.samplers.push(j.samplers[i]); map.smp.set(i, out.samplers.length - 1); return out.samplers.length - 1; };
const img = i => { if (map.img.has(i)) return map.img.get(i);
  const m = { ...j.images[i] }; if (m.bufferView != null) m.bufferView = bv(m.bufferView); out.images.push(m); map.img.set(i, out.images.length - 1); return out.images.length - 1; };
const tex = i => { if (map.tex.has(i)) return map.tex.get(i);
  const t = JSON.parse(JSON.stringify(j.textures[i]));
  if (t.source != null) t.source = img(t.source);
  if (t.extensions) for (const k in t.extensions) if (t.extensions[k].source != null) t.extensions[k].source = img(t.extensions[k].source);
  if (t.sampler != null) t.sampler = smp(t.sampler);
  out.textures.push(t); map.tex.set(i, out.textures.length - 1); return out.textures.length - 1; };
const walkTex = o => { if (!o || typeof o !== 'object') return; for (const k in o) { const v = o[k];
  if (v && typeof v === 'object' && /Texture$/.test(k) && v.index != null) v.index = tex(v.index); else walkTex(v); } };
const mat = i => { if (map.mat.has(i)) return map.mat.get(i);
  const m = JSON.parse(JSON.stringify(j.materials[i])); walkTex(m); out.materials.push(m); map.mat.set(i, out.materials.length - 1); return out.materials.length - 1; };
const mesh = i => { if (map.mesh.has(i)) return map.mesh.get(i);
  const m = JSON.parse(JSON.stringify(j.meshes[i]));
  for (const p of m.primitives) {
    for (const k in p.attributes) p.attributes[k] = acc(p.attributes[k]);
    if (p.indices != null) p.indices = acc(p.indices);
    if (p.material != null) p.material = mat(p.material);
    const d = p.extensions && p.extensions.KHR_draco_mesh_compression; if (d) d.bufferView = bv(d.bufferView);
    if (p.targets) throw new Error('morph targets');
  }
  out.meshes.push(m); map.mesh.set(i, out.meshes.length - 1); return out.meshes.length - 1; };

const rows = [];
for (const [f, F] of [...fam].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
  const s = F.s.slice().sort((x, y) => x - y), med = s[s.length >> 1];
  out.nodes.push({ name: 'wp_' + f, mesh: mesh(F.mesh), extras: { fam: f, sMed: +med.toFixed(4), sMin: +s[0].toFixed(4), sMax: +s[s.length - 1].toFixed(4), n: s.length } });
  out.scenes[0].nodes.push(out.nodes.length - 1);
  rows.push(f.padEnd(26) + ' x' + String(s.length).padStart(4) + '  scale ' + s[0].toFixed(2) + ' / ' + med.toFixed(2) + ' / ' + s[s.length - 1].toFixed(2));
}
for (const k of ['samplers', 'images', 'textures']) if (!out[k].length) delete out[k];
const used = new Set(); const scan = o => { if (!o || typeof o !== 'object') return; if (o.extensions) for (const k in o.extensions) used.add(k); for (const k in o) scan(o[k]); };
scan({ m: out.meshes, t: out.textures, mt: out.materials });
out.extensionsUsed = (j.extensionsUsed || []).filter(e => used.has(e));
const req = (j.extensionsRequired || []).filter(e => used.has(e)); if (req.length) out.extensionsRequired = req;
const BIN = Buffer.concat(chunks.concat(Buffer.alloc((4 - (off % 4)) % 4)));
out.buffers.push({ byteLength: BIN.length });
let J = Buffer.from(JSON.stringify(out)); J = Buffer.concat([J, Buffer.alloc((4 - (J.length % 4)) % 4, 0x20)]);
const H = Buffer.alloc(12), JH = Buffer.alloc(8), BH = Buffer.alloc(8);
H.writeUInt32LE(0x46546c67, 0); H.writeUInt32LE(2, 4); H.writeUInt32LE(12 + 8 + J.length + 8 + BIN.length, 8);
JH.writeUInt32LE(J.length, 0); JH.writeUInt32LE(0x4e4f534a, 4); BH.writeUInt32LE(BIN.length, 0); BH.writeUInt32LE(0x004e4942, 4);
fs.mkdirSync('models/wpprops', { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([H, JH, J, BH, BIN]));
console.log(rows.join('\n'));
console.log(`${OUT}: ${out.nodes.length} kinds, ${out.meshes.length} meshes, ${out.materials.length} materials, ${(out.images || []).length} images, ` +
  `${(fs.statSync(OUT).size / 1048576).toFixed(2)} MB (from ${SRC}, ${(b.length / 1048576).toFixed(1)} MB)`);
