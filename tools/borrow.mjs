// npm run borrow -- ZAP'S MELEE SET, LIFTED INTO A FILE THE ALIEN CAN WEAR (r39).
//
// *"I wanna borrow some animations until I can natively put them in for the roller girl alien -- I
// love his melee system."* They are Zap's (the player in weirdport, `models/characters/zap.glb`):
// six unarmed melees, four blaster melees, `slide_kick` and `flying_kick`.
//
// WHY THIS CAN BE A STRAIGHT COPY: measured before a line was written, the two rigs share 58 joints
// and their REST ROTATIONS AGREE TO 0.03 DEGREES -- the same bind pose. So every rotation key means
// the same thing on her as on him and is copied as it is. What differs is PROPORTION: her legs are
// much longer, so the one translation track that matters -- the Hips, which is how far the body is
// off the ground in every crouch and slide -- is re-based on HER rest pose and its movement scaled by
// the ratio of the two LEG LENGTHS (thigh + shin, read out of both files, nothing typed).
// Everything else is dropped: position tracks bake the source's bone lengths (Shredworld's rule),
// scale tracks are no-ops at best, and his weapon joints mean nothing on her.
//
// The output is a GLB with NODES AND ANIMATIONS ONLY -- no mesh, no skin, a few hundred KB -- and the
// game appends its clips to hers by bone name.
import fs from 'fs';
import { readGLB } from './glb.mjs';

const SRC = process.argv[2] || '../colinwillow/weirdport/models/characters/zap.glb';
const DST_RIG = 'models/alien_rollerskate_blue.glb';
const OUT = 'models/melee_zap.glb';
const CLIPS = ['melee_01', 'melee_02', 'melee_03', 'melee_04', 'melee_05', 'melee_extra',
  'weapon_melee_01', 'weapon_melee_02', 'weapon_melee_03', 'weapon_melee_04', 'slide_kick', 'flying_kick'];

if (!fs.existsSync(SRC)) { console.error(`no source at ${SRC} -- clone colinwillow/weirdport beside this repo, or pass the path`); process.exit(1); }
const Z = readGLB(SRC), A = readGLB(DST_RIG);
const byName = J => new Map(J.json.nodes.map((n, i) => [n.name, n]));
const zn = byName(Z), an = byName(A);
const legLen = m => ['mixamorig_LeftLeg', 'mixamorig_LeftFoot'].reduce((s, k) => s + Math.hypot(...(m.get(k).translation || [0, 0, 0])), 0);
const k = legLen(an) / legLen(zn);
const zh = zn.get('mixamorig_Hips').translation, ah = an.get('mixamorig_Hips').translation;
console.log(`legs: zap ${legLen(zn).toFixed(2)}  alien ${legLen(an).toFixed(2)}  -> hips movement x${k.toFixed(3)}`);
console.log(`hips rest: zap ${zh.map(v => v.toFixed(2))}  alien ${ah.map(v => v.toFixed(2))}`);

// ---- write ----
const json = { asset: { version: '2.0', generator: 'rollergirl borrow.mjs' }, scene: 0, scenes: [{ nodes: [] }],
  nodes: [], animations: [], accessors: [], bufferViews: [], buffers: [] };
const chunks = []; let off = 0;
function acc(arr, type, extra) {
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  const pad = (4 - (buf.length % 4)) % 4;
  json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length });
  chunks.push(buf, Buffer.alloc(pad)); off += buf.length + pad;
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
  json.accessors.push(Object.assign({ bufferView: json.bufferViews.length - 1, componentType: 5126, count: arr.length / n, type }, extra || {}));
  return json.accessors.length - 1;
}
// the skeleton as NODES ONLY: names, rest transforms, hierarchy -- no meshes, no skins
const zj = Z.json, keep = zj.nodes.map(n => !n.mesh && !n.camera);
const remap = new Map(); zj.nodes.forEach((n, i) => { if (keep[i]) remap.set(i, remap.size); });
zj.nodes.forEach((n, i) => {
  if (!keep[i]) return;
  const o = { name: n.name };
  for (const f of ['translation', 'rotation', 'scale']) if (n[f]) o[f] = n[f];
  const ch = (n.children || []).filter(c => remap.has(c)).map(c => remap.get(c)); if (ch.length) o.children = ch;
  json.nodes.push(o);
});
const kid = new Set(); json.nodes.forEach(n => (n.children || []).forEach(c => kid.add(c)));
json.scenes[0].nodes = json.nodes.map((n, i) => i).filter(i => !kid.has(i));

const missing = [];
for (const nm of CLIPS) {
  const a = (zj.animations || []).find(x => x.name === nm);
  if (!a) { missing.push(nm); continue; }
  const out = { name: nm, samplers: [], channels: [] };
  let kept = 0, dropped = 0;
  for (const ch of a.channels) {
    const node = zj.nodes[ch.target.node], s = a.samplers[ch.sampler];
    const isHipsT = ch.target.path === 'translation' && node.name === 'mixamorig_Hips';
    if (!(ch.target.path === 'rotation' || isHipsT) || !remap.has(ch.target.node) || !an.has(node.name)) { dropped++; continue; }
    const tIn = Z.read(s.input), v = Float32Array.from(Z.read(s.output));
    if (isHipsT) {
      const st = (s.interpolation === 'CUBICSPLINE') ? 9 : 3, o = (s.interpolation === 'CUBICSPLINE') ? 3 : 0;
      for (let i = 0; i < v.length; i += st) for (let c = 0; c < 3; c++) v[i + o + c] = ah[c] + (v[i + o + c] - zh[c]) * k;
    }
    let mn = Infinity, mx = -Infinity; for (const t of tIn) { mn = Math.min(mn, t); mx = Math.max(mx, t); }
    const ia = acc(Float32Array.from(tIn), 'SCALAR', { min: [mn], max: [mx] });
    const oa = acc(v, ch.target.path === 'rotation' ? 'VEC4' : 'VEC3');
    out.samplers.push({ input: ia, output: oa, interpolation: s.interpolation || 'LINEAR' });
    out.channels.push({ sampler: out.samplers.length - 1, target: { node: remap.get(ch.target.node), path: ch.target.path } });
    kept++;
  }
  json.animations.push(out);
  console.log(`  ${nm.padEnd(16)} ${kept} channels kept, ${dropped} dropped`);
}
if (missing.length) console.log('  NOT IN THE SOURCE: ' + missing.join(' '));
const bin = Buffer.concat(chunks);
json.buffers.push({ byteLength: bin.length });
let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const h1 = Buffer.alloc(8); h1.writeUInt32LE(js.length, 0); h1.writeUInt32LE(0x4E4F534A, 4);
const h2 = Buffer.alloc(8); h2.writeUInt32LE(bin.length, 0); h2.writeUInt32LE(0x004E4942, 4);
fs.writeFileSync(OUT, Buffer.concat([head, h1, js, h2, bin]));
console.log(`wrote ${OUT}: ${json.animations.length} clips, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
