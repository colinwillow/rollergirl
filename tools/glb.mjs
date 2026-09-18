// Reading a GLB with no dependencies. The animation samplers are NOT draco compressed -- draco
// only touches mesh primitives -- so every clip in this file is readable here even though the
// mesh is not, which is what makes the animation tools possible at all.
//
// ONE COPY. `clips.mjs` and `sim.mjs` both read the file through this; a tool with its own
// reader is a tool that can disagree with the other one about what is in the asset.
import fs from 'fs';
const COMP = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export function readGLB(file) {
  const b = fs.readFileSync(file);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let off = 12, json = null, bin = null;
  while (off < b.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4E4F534A) json = JSON.parse(b.slice(off + 8, off + 8 + len).toString('utf8'));
    else if (type === 0x004E4942) bin = b.subarray(off + 8, off + 8 + len);
    off += 8 + len;
  }
  // CACHED BY ACCESSOR INDEX, WHICH IS THE WHOLE POINT. GLTFLoader resolves each accessor once
  // and hands the SAME array to every track that references it -- so a harness that reads a
  // fresh copy per channel cannot reproduce the one bug this is here to catch.
  const cache = new Map();
  const read = i => {
    if (cache.has(i)) return cache.get(i);
    const a = json.accessors[i], n = NUM[a.type], [T, sz] = COMP[a.componentType];
    let out;
    if (a.bufferView == null) out = new Float32Array(a.count * n);
    else {
      const bv = json.bufferViews[a.bufferView];
      const base = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * sz;
      out = new Float32Array(a.count * n);
      for (let k = 0; k < a.count; k++) {
        const v = new T(bin.buffer, bin.byteOffset + base + k * stride, n);
        for (let c = 0; c < n; c++) out[k * n + c] = v[c];
      }
    }
    cache.set(i, out); return out;
  };
  return { json, bin, read };
}

// Real THREE.AnimationClips out of the file, built the way GLTFLoader builds them -- same track
// types, same node names, and crucially the same SHARED time arrays.
export function buildClips(g, THREE) {
  const TYPE = { translation: THREE.VectorKeyframeTrack, rotation: THREE.QuaternionKeyframeTrack, scale: THREE.VectorKeyframeTrack };
  const SUF = { translation: 'position', rotation: 'quaternion', scale: 'scale' };
  return (g.json.animations || []).map(a => {
    const tracks = [];
    for (const ch of a.channels) {
      const s = a.samplers[ch.sampler], node = g.json.nodes[ch.target.node];
      if (!node) continue;
      tracks.push(new TYPE[ch.target.path](`${node.name}.${SUF[ch.target.path]}`, g.read(s.input), g.read(s.output)));
    }
    return new THREE.AnimationClip(a.name, -1, tracks);
  });
}
