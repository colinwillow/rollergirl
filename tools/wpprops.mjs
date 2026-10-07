// npm run wpprops [visual.glb] [buildings.glb] -- CUTS HIS WEIRDPORT PROPS (r127) AND HIS BUILDING KIT (r128) OUT OF HIS CITY FILES.
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


// THE CUTTER. `picks` is a list of { name, node, extras, scale }: each picked node is copied with its children (minus his
// `col_*` colliders and the marker empties), written at the origin, and everything they point at comes along byte for byte.
function cut(src, pickFn, out) {
  const b = fs.readFileSync(src);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(src + ' is not a GLB');
  const jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString());
  const binOff = 20 + jl + 8, bin = b.slice(binOff, binOff + b.readUInt32LE(20 + jl));
  const picks = pickFn(j);
  const o = { asset: { version: '2.0', generator: 'rollergirl tools/wpprops.mjs' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [],
    accessors: [], bufferViews: [], buffers: [], materials: [], textures: [], images: [], samplers: [] };
  const map = { mesh: new Map(), acc: new Map(), bv: new Map(), mat: new Map(), tex: new Map(), img: new Map(), smp: new Map() };
  const chunks = []; let off = 0;
  const bv = i => { if (map.bv.has(i)) return map.bv.get(i);
    const v = j.bufferViews[i], data = bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), pad = (4 - (off % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
    const nv = { buffer: 0, byteOffset: off, byteLength: v.byteLength }; if (v.byteStride) nv.byteStride = v.byteStride; if (v.target) nv.target = v.target;
    chunks.push(data); off += v.byteLength; o.bufferViews.push(nv); map.bv.set(i, o.bufferViews.length - 1); return o.bufferViews.length - 1; };
  const acc = i => { if (map.acc.has(i)) return map.acc.get(i);
    const a = { ...j.accessors[i] }; if (a.bufferView != null) a.bufferView = bv(a.bufferView); if (a.sparse) throw new Error('sparse accessor');
    o.accessors.push(a); map.acc.set(i, o.accessors.length - 1); return o.accessors.length - 1; };
  const smp = i => { if (map.smp.has(i)) return map.smp.get(i); o.samplers.push(j.samplers[i]); map.smp.set(i, o.samplers.length - 1); return o.samplers.length - 1; };
  const img = i => { if (map.img.has(i)) return map.img.get(i);
    const m = { ...j.images[i] }; if (m.bufferView != null) m.bufferView = bv(m.bufferView); o.images.push(m); map.img.set(i, o.images.length - 1); return o.images.length - 1; };
  const tex = i => { if (map.tex.has(i)) return map.tex.get(i);
    const t = JSON.parse(JSON.stringify(j.textures[i]));
    if (t.source != null) t.source = img(t.source);
    if (t.extensions) for (const k in t.extensions) if (t.extensions[k].source != null) t.extensions[k].source = img(t.extensions[k].source);
    if (t.sampler != null) t.sampler = smp(t.sampler);
    o.textures.push(t); map.tex.set(i, o.textures.length - 1); return o.textures.length - 1; };
  const walkTex = x => { if (!x || typeof x !== 'object') return; for (const k in x) { const v = x[k];
    if (v && typeof v === 'object' && /Texture$/.test(k) && v.index != null) v.index = tex(v.index); else walkTex(v); } };
  const mat = i => { if (map.mat.has(i)) return map.mat.get(i);
    const m = JSON.parse(JSON.stringify(j.materials[i])); walkTex(m); o.materials.push(m); map.mat.set(i, o.materials.length - 1); return o.materials.length - 1; };
  const mesh = i => { if (map.mesh.has(i)) return map.mesh.get(i);
    const m = JSON.parse(JSON.stringify(j.meshes[i]));
    for (const p of m.primitives) {
      for (const k in p.attributes) p.attributes[k] = acc(p.attributes[k]);
      if (p.indices != null) p.indices = acc(p.indices);
      if (p.material != null) p.material = mat(p.material);
      const d = p.extensions && p.extensions.KHR_draco_mesh_compression; if (d) d.bufferView = bv(d.bufferView);
      if (p.targets) throw new Error('morph targets');
    }
    o.meshes.push(m); map.mesh.set(i, o.meshes.length - 1); return o.meshes.length - 1; };
  const skip = n => /^col_/.test(n.name || '') || (n.extras && n.extras.collider) || (n.mesh == null && !(n.children || []).length);
  const node = (i, root) => {
    const n = j.nodes[i], c = { name: n.name };
    if (!root) { for (const k of ['translation', 'rotation', 'scale', 'matrix']) if (n[k]) c[k] = n[k]; }
    if (n.mesh != null) c.mesh = mesh(n.mesh);
    const kids = (n.children || []).filter(k => !skip(j.nodes[k])).map(k => node(k, false));
    if (kids.length) c.children = kids;
    o.nodes.push(c); return o.nodes.length - 1;
  };
  for (const P of picks) {
    const k = node(P.node, true), r = o.nodes[k]; r.name = P.name; r.extras = P.extras || {};
    if (P.scale) r.scale = P.scale;
    o.scenes[0].nodes.push(k);
  }
  for (const k of ['samplers', 'images', 'textures']) if (!o[k].length) delete o[k];
  const used = new Set(); const scan = x => { if (!x || typeof x !== 'object') return; if (x.extensions) for (const k in x.extensions) used.add(k); for (const k in x) scan(x[k]); };
  scan({ m: o.meshes, t: o.textures, mt: o.materials });
  o.extensionsUsed = (j.extensionsUsed || []).filter(e => used.has(e));
  const req = (j.extensionsRequired || []).filter(e => used.has(e)); if (req.length) o.extensionsRequired = req;
  const BIN = Buffer.concat(chunks.concat(Buffer.alloc((4 - (off % 4)) % 4)));
  o.buffers.push({ byteLength: BIN.length });
  let J = Buffer.from(JSON.stringify(o)); J = Buffer.concat([J, Buffer.alloc((4 - (J.length % 4)) % 4, 0x20)]);
  const H = Buffer.alloc(12), JH = Buffer.alloc(8), BH = Buffer.alloc(8);
  H.writeUInt32LE(0x46546c67, 0); H.writeUInt32LE(2, 4); H.writeUInt32LE(12 + 8 + J.length + 8 + BIN.length, 8);
  JH.writeUInt32LE(J.length, 0); JH.writeUInt32LE(0x4e4f534a, 4); BH.writeUInt32LE(BIN.length, 0); BH.writeUInt32LE(0x004e4942, 4);
  fs.mkdirSync('models/wpprops', { recursive: true });
  fs.writeFileSync(out, Buffer.concat([H, JH, J, BH, BIN]));
  console.log(`${out}: ${picks.length} nodes, ${o.meshes.length} meshes, ${o.materials.length} materials, ${(o.images || []).length} images, ` +
    `${(fs.statSync(out).size / 1048576).toFixed(2)} MB (from ${src}, ${(b.length / 1048576).toFixed(1)} MB)`);
}

// 1. THE PROPS: one node per kind, his median scale in the extras
cut(SRC, j => {
  const fam = new Map();
  j.nodes.forEach((n, i) => {
    if (n.mesh == null) return;
    const f = (n.name || '').replace(/[._]\d+.*$/, '');
    if (!KEEP.test(f)) return;
    let F = fam.get(f); if (!F) fam.set(f, F = { node: i, s: [] });
    F.s.push(n.scale ? n.scale[0] : 1);
  });
  return [...fam].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([f, F]) => { const s = F.s.slice().sort((x, y) => x - y), med = s[s.length >> 1];
    console.log(f.padEnd(26) + ' x' + String(s.length).padStart(4) + '  scale ' + s[0].toFixed(2) + ' / ' + med.toFixed(2) + ' / ' + s[s.length - 1].toFixed(2));
    return { name: 'wp_' + f, node: F.node, extras: { fam: f, sMed: +med.toFixed(4), sMin: +s[0].toFixed(4), sMax: +s[s.length - 1].toFixed(4), n: s.length } }; });
}, OUT);

// 2. THE KIT (r128): one node per STYLE x PIECE out of his sixty buildings -- walls with their glass and door children, the
// corners, parapets, roof and floor slabs -- in the piece's own frame (a wall runs +X 0..3, outside face at z 0), plus one AC unit
// at his scale. These are the same meshes his buildings share, so the KTX2 textures and the tint colours come with them.
const BSRC = process.argv[3] || SRC.replace('toon_city_visual_ktx2.glb', 'toon_city_kit_buildings_ktx2.glb');
const PIECES = ['wall_solid', 'wall_window', 'wall_door_C', 'wall_wide', 'wall_parapet', 'corner', 'corner_parapet', 'roof', 'floor'];
cut(BSRC, j => {
  const got = new Map(), out = []; let ac = null;
  j.nodes.forEach((n, i) => { const e = n.extras || {};
    if (e.breakable === 'ac_unit' && n.mesh != null && !ac) ac = { name: 'wk_ac', node: i, extras: { kind: 'ac' }, scale: n.scale };
    if (!e.piece || !e.style || !PIECES.includes(e.piece) || e.state !== 'intact') return;
    const k = e.style + ':' + e.piece; if (got.has(k)) return; got.set(k, 1);
    out.push({ name: 'wk_' + e.style + '_' + e.piece, node: i, extras: { style: e.style, piece: e.piece } }); });
  const st = [...new Set(out.map(p => p.extras.style))];
  console.log(`kit: ${st.length} styles (${st.join(' ')}), ${out.length} pieces` + (ac ? ', an AC unit' : ''));
  if (ac) out.push(ac);
  return out;
}, 'models/wpprops/wp_kit.glb');
