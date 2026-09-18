// npm run clips -- WHAT IS ACTUALLY IN EACH ANIMATION.
//
// "She holds the pose instead of looping" is a claim about a clip, and a clip is data. This
// reads the GLB's animation samplers straight out of the buffer -- they are NOT draco
// compressed, draco only touches mesh primitives -- and reports, per clip, how many bones
// genuinely MOVE and by how much. A channel with two identical keys is a channel that animates
// nothing, and a clip made almost entirely of those is a held pose however it is played.
import { readGLB } from './glb.mjs';
const file = process.argv[2] || 'models/roller_girl.glb';
const G = readGLB(file);
const g = G.json, read = G.read;
const short = s => (s || '').replace(/^mixamorig_/, '');
console.log(`${file}\n`);
for (const a of g.animations) {
  let t0 = Infinity, t1 = -Infinity, keys = 0;
  const moved = [];
  for (const ch of a.channels) {
    const s = a.samplers[ch.sampler];
    const ti = read(s.input), vo = read(s.output);
    t0 = Math.min(t0, ti[0]); t1 = Math.max(t1, ti[ti.length - 1]); keys = Math.max(keys, ti.length);
    const n = vo.length / ti.length;
    // A QUATERNION COMPONENT DELTA IS NOT A ROTATION. q and -q are the SAME rotation, so a
    // component that swings from -1 to +1 reads as a delta of 2 and is a sign flip -- three's
    // `QuaternionLinearInterpolant` takes the short way round and nothing moves. Measuring
    // components said `Idle` swings a thigh by "1.99" and `skate_fwd` by "1.90", which is how a
    // stub and a stride came out looking identical. The honest number is the ANGLE, and it is
    // sign-insensitive by construction: 2*acos(|dot|).
    let d = 0, unit = '';
    if (ch.target.path === 'rotation') {
      unit = 'deg';
      for (let k = 1; k < ti.length; k++) {
        let dot = 0; for (let c = 0; c < 4; c++) dot += vo[k * 4 + c] * vo[c];
        d = Math.max(d, 2 * Math.acos(Math.min(1, Math.abs(dot))) * 180 / Math.PI);
      }
    } else {
      // translations are in ARMATURE units, and the armature carries the 0.01 -- so a bone
      // track of 54 is half a metre, not fifty
      unit = 'cm';
      for (let k = 1; k < ti.length; k++) for (let c = 0; c < n; c++)
        d = Math.max(d, Math.abs(vo[k * n + c] - vo[c]) * (ch.target.path === 'translation' ? 1.71 : 100));
    }
    const eps = ch.target.path === 'rotation' ? 0.5 : 0.2;
    if (d > eps) moved.push({ node: short(g.nodes[ch.target.node].name), path: ch.target.path, d, unit });
  }
  const bones = new Set(moved.map(m => m.node));
  moved.sort((x, y) => y.d - x.d);
  console.log(`${(a.name || '').padEnd(16)} ${(t1 - t0).toFixed(3)}s  ${keys} keys  ` +
              `${a.channels.length} channels, ${moved.length} of them MOVE, across ${bones.size} bones`);
  const rot = moved.filter(m => m.path === 'rotation');
  if (rot.length) console.log(`    rotation: ${rot.length} bones turn, biggest ${rot[0] ? '' : ''}` +
    `${Math.max(...rot.map(m => m.d)).toFixed(0)} deg, median ${rot.map(m => m.d).sort((x, y) => x - y)[rot.length >> 1].toFixed(0)} deg`);
  if (moved.length) console.log('    biggest: ' + moved.slice(0, 8).map(m => `${m.node}.${m.path[0]} ${m.d.toFixed(0)}${m.unit}`).join('  '));
  else console.log('    *** NOTHING IN THIS CLIP MOVES ***');
}
