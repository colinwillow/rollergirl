// npm run sim -- DRIVES THE SHIPPED PHYSICS OVER THE REAL PARK, HEADLESS.
//
// Everything in this game that matters is reachable without a GPU: the collider is triangles
// in a grid, `stepPlayer` is arithmetic, and the character GLB is only needed to DRAW her. So
// the question "does a half pipe actually work" has an answer here in about two seconds, and
// it is an answer about the code that ships rather than about a restatement of it -- the probe
// calls `rg.stepPlayer`, never a copy of the rule.
//
// It reuses `tools/boot.mjs`'s STUBS block verbatim, lifted between its markers. A second
// harness with its own copy of the DOM stubs is two things to keep in step, and a harness that
// measures a page the game does not have is the oldest mistake there is.
import fs from 'fs'; import os from 'os'; import path from 'path';
import { pathToFileURL } from 'url';
import { readGLB, buildClips } from './glb.mjs';

if (!fs.existsSync('node_modules/three/package.json')) {
  fs.mkdirSync('node_modules/three', { recursive: true });
  fs.writeFileSync('node_modules/three/package.json', JSON.stringify({
    name: 'three', version: '0.180.0-vendored', type: 'module', main: 'index.js', exports: { '.': './index.js' } }));
  fs.writeFileSync('node_modules/three/index.js', "export * from '../../vendor/three.module.min.js';\n");
}
const TMP = path.join(os.tmpdir(), 'rollergirl-sim');
fs.mkdirSync(TMP, { recursive: true });
const ROOT = pathToFileURL(process.cwd() + '/').href;
fs.writeFileSync(path.join(TMP, 'three-shim.mjs'), `
export * from '${ROOT}vendor/three.module.min.js';
import * as T from '${ROOT}vendor/three.module.min.js';
class FakeTarget { constructor(w,h,o){ this.width=w; this.height=h; this.texture=new T.Texture(); } setSize(){} dispose(){} }
export { FakeTarget as WebGLRenderTarget };
class FakeRenderer { constructor(){ this.domElement = globalThis.document.createElement('canvas');
  this.shadowMap={enabled:false,type:0}; this.info={autoReset:true,render:{calls:0,triangles:0},reset(){}};
  this.capabilities={isWebGL2:true,getMaxAnisotropy:()=>1,precision:'highp'};
  this.outputColorSpace=''; this.toneMapping=0; this.toneMappingExposure=1; }
  setSize(){} setPixelRatio(){} setClearColor(){} setRenderTarget(){} clear(){} render(){} dispose(){}
  compile(){} getContext(){ return {getParameter:()=>0}; } getDrawingBufferSize(v){ return v.set(1280,720); } initTexture(){} }
export { FakeRenderer as WebGLRenderer };
class FakePMREM { constructor(){} fromEquirectangular(){ return { texture: new T.Texture() }; } compileEquirectangularShader(){} dispose(){} }
export { FakePMREM as PMREMGenerator };
`);
const boot = fs.readFileSync('tools/boot.mjs', 'utf8');
const stubs = boot.slice(boot.indexOf('// STUBS:START'), boot.indexOf('// STUBS:END'));
(0, eval)(stubs);
// r64: WHICH WORLD. Every case but `zones` measures the built-in park, and his zones stand on the same ground, so
// the page is booted in the world the case is about (`rg.world` is what the game reads at load).
globalThis.localStorage.setItem('rg.world', process.argv[2] === 'zones' ? '1' : (process.argv[2] === 'kit' || process.argv[2] === 'combos' || process.argv[2] === 'parkref' || process.argv[2] === 'parkdump') ? '2' : process.argv[2] === 'sky' ? '3' : '0');
// r90: the main world's north district is the skate park now; the City it replaced is one switch away, and `city` boots with it
if (process.argv[2] === 'city') globalThis.localStorage.setItem('rg.city', '1');

const html = fs.readFileSync('index.html', 'utf8');
let src = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
src = src.replace(/(from\s*)['"]three['"]/g, `$1'${pathToFileURL(path.join(TMP, 'three-shim.mjs')).href}'`)
         .replace(/(from\s*)['"]\.\/vendor\//g, `$1'${ROOT}vendor/`);
const f = path.join(TMP, 'sim.mjs'); fs.writeFileSync(f, src);
const quiet = console.warn; console.warn = () => {};
await import(pathToFileURL(f).href + '?t=' + Date.now());
for (let i = 0; i < 400 && !globalThis.rg.ready(); i++) await new Promise(r => setTimeout(r, 10));
console.warn = quiet;
const rg = globalThis.rg;
const THREE = await import(pathToFileURL(path.join(TMP, 'three-shim.mjs')).href);
if (!rg.ready()) { console.error('the module never became ready'); process.exit(1); }
// r71: THE GAME GRINDS ONLY ON A SWIPE DOWN NOW (`GRIND.intent`). Every case below except `intent` was written against
// the semi-automatic catch and measures the grind itself -- rails, joints, boosters, loops -- so they run with it off.
// `CASES.intent` is the one that drives the swipe.
rg.GRIND.intent = 0;
rg.CTRL.map = 1;      // r82: every case but `ctrl` was written against the old pad layout

// ---- driving ----
let DT = 1 / 60;   // a case may drop it: a phone is not 60 Hz and the gap between
                   // collider samples is speed x dt, which is the whole hazard
const P = rg.player;
function place(x, y, z, heading, speed) {
  P.pos.set(x, y, z); P.heading = P.faceH = heading; P.grounded = true;
  P.vel.set(Math.sin(heading) * (speed || 0), 0, Math.cos(heading) * (speed || 0));
  P.airT = 0; P.braked = 0; P.pushing = false; P.pushT = 0; P.pushOff = 9; P.shoveT = 0; P.n.set(0, 1, 0);
  P.bailT = 0; P.lean = 0; P.stance = 1; P.flip = null; P.shoveDir = 1; P.grind = null; P.grindCool = 0; P.grindLast = null;
  P.autoTurn = null; P.vertLock = 0; P.xferKick = null; P.stanceWhy = null; P.stanceAt = 0;
  P.mel = null; P.melQ = null; P.kickRail = null; P.kicked = 0; P.settleLatch = 0; P.xferArm = 0;
  const g = rg.groundAt(x, z, y + 3, 6);
  if (g.hit) { P.pos.y = g.floor; P.n.set(g.nx, g.ny, g.nz); }
  rg.groundQ(P.bq);        // standing on whatever she was just placed on
  rg.stick.L.x = rg.stick.L.y = 0; rg.stick.R.x = rg.stick.R.y = 0; rg.stick.R.down = 0;
  rg.cam.az = heading; bear = heading;
}
let bear = 0;
// "hold the thumb where the camera is pointing" -- and the camera follows travel, so this is
// the thumb a player actually holds. Latched when she is going nearly straight up a wall,
// where a horizontal bearing is noise.
function follow() {
  if (P.hSpeed > 0.5) bear = Math.atan2(P.vel.x, P.vel.z);
  rg.cam.az = bear;
}
function run(sec, fn) {
  const n = Math.round(sec / DT);
  for (let i = 0; i < n; i++) { if (fn) fn(i * DT, i); rg.stepPlayer(DT); }
}
// r109: A QUIET MOMENT at (x, z) (`quietAt`): the clock set to a time when neither the Crosstown tram nor a scout saucer will come within
// reach of that spot for the next `sec` seconds. Both run off `HT.t`, so a row that skates across their paths otherwise passes
// or fails by whatever time the cases before it left on the clock (the scout row's lesson, r107).
function quietAt(x, z, sec = 6, near = 26) {
  const T = rg.TRAM, U = rg.UFO, clear = t => { for (let u = 0; u <= sec; u += 0.25) {
      if (T.built) { const s = rg.tramS(t + u); for (const k of [-1, 0, 1]) { const q = rg.tramAt(s + k * T.half); if (Math.hypot(q.x - x, q.z - z) < near) return false; } }
      for (const S of U.list || []) { const a = S.S.a0 + (t + u) * S.S.w; if (Math.hypot(S.S.cx + S.S.R * Math.cos(a) - x, S.S.cz + S.S.R * Math.sin(a) - z) < near) return false; } }
    return true; };
  for (let t = 0; t < 4000; t += 0.5) if (clear(t)) { rg.HT.t = t; return t; }
  return -1;
}
const fix = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
// HIS SKELETON, REBUILT FROM THE GLB'S OWN NODES -- a skeleton needs no mesh, so draco never comes
// into it. Used wherever a case needs the real rig: mirroring, and the clip prep the game does.
function skelFromGLB(J) {
  const objs = J.nodes.map(n => { const o = new THREE.Bone(); o.name = n.name || '';
    if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale); return o; });
  const root = new THREE.Group(), kid = new Set();
  J.nodes.forEach(n => (n.children || []).forEach(c => kid.add(c)));
  J.nodes.forEach((n, i) => (n.children || []).forEach(c => objs[i].add(objs[c])));
  J.nodes.forEach((n, i) => { if (!kid.has(i)) root.add(objs[i]); });
  root.updateMatrixWorld(true);
  const by = {}; root.traverse(o => { if (o.name) by[o.name] = o; });
  return { root, by };
}
// HIS CLIPS PREPARED EXACTLY AS `buildGirl` PREPARES THEM -- the shipped `normaliseClips` and the
// shipped `prepClips`, on his real skeleton -- and the move table the game would build from them.
function gameClips(file) {
  const g = readGLB(file);
  const clips = rg.prepClips(rg.normaliseClips(buildClips(g, THREE)), skelFromGLB(g.json).root);
  const has = {}; for (const c of clips) has[c.name] = 1;
  return { g, clips, has, moves: rg.buildMoves(has), R: rg.clipRoles(clips) };
}

const CASES = {};
// r90: a piece as kind, size and options -- not its tint (the main world paints the park its own way), numbers to a millimetre
const parkSig = p => p.kind + ' ' + p.size + ' ' + JSON.stringify(Object.fromEntries(Object.entries(p.o || {}).filter(([k]) => k !== 'tint' && k !== 'bankTint').sort()), (k, v) => typeof v === 'number' ? +v.toFixed(3) : v);
// r84: THE ROUTE CASES RIDE THE r83 PUSH. They hold the stick down for a fixed time and then ask whether a line through a
// level comes out where it was tuned to: a gap cleared, a roof landed, a ring entered. With r84's quicker start every one of
// them arrives at a different speed and measures the acceleration curve instead of the route (W3 -> W4 overshot at 18.9 m/s
// instead of 17.2, the mega drop-in flew the ring). The PUSH is covered by `agile`, `push` and `ctrl84`. A stated gap: these
// routes are not re-proved at the new start, and a level line that is speed-critical wants a look on the phone.
const ROUTE = new Set(['orbital', 'shores', 'kit', 'zones']);
const R83PUSH = { hardK: 1, softK: 1, hardP: 1, softP: 1 };
const PUSH84 = { hardK: rg.SK.hardK, softK: rg.SK.softK, hardP: rg.SK.hardP, softP: rg.SK.softP };
// ---------------------------------------------------------------- the stride
CASES.push = () => {
  place(60, 1, -66, 0, 0);
  let prev = 0, worst = 0, top = 0, marks = [], air = 0;
  // 7 s, not 9: at the new top speed she crosses 140 m in nine and rides up the PERIMETER WALL,
  // and the number that came back was her speed after being launched off it. **Every case that
  // holds the stick forward has to be re-checked against the park whenever she gets faster.**
  run(7, t => {
    follow(); rg.stick.L.y = -1; rg.stick.L.x = 0;
    const d = Math.abs(P.speed - prev); if (t > 0.2 && d > worst) worst = d;
    prev = P.speed; top = Math.max(top, P.speed); if (!P.grounded) air++;
    if (Math.abs(t % 1.5) < DT / 2) marks.push(`${fix(t,1)}s ${fix(P.speed)}`);
  });
  console.log(`  ${marks.join('  ')}`);
  console.log(`  top ${fix(top)} m/s, worst one-frame jump ${fix(worst, 3)} m/s ` +
              `(a STROKE, not a step -- a staircase here is the bug), ${air} airborne frames`);
  return top > 14 && worst < 0.8 && air === 0;
};
// ---------------------------------------------------------------- letting go (r23)
// *"If you let go you continue rolling, but your momentum does fade."* Thumb off on open plaza:
// she keeps going, and loses speed faster than rolling drag alone -- `SK.coast` 0 is the control.
CASES.coast = () => {
  const ride = k => { const keep = rg.SK.coast; rg.SK.coast = k; place(60, 1, -60, 0, 12);
    run(4, () => { rg.cam.az = 0; rg.stick.L.x = rg.stick.L.y = 0; });
    rg.SK.coast = keep; return Math.hypot(P.vel.x, P.vel.z); };
  const off = ride(0), on = ride(rg.SK.coast);
  console.log(`  12 m/s, thumb off 4 s: ${fix(on, 2)} m/s with the fade (${fix(rg.SK.coast, 2)}/s), ${fix(off, 2)} on rolling drag alone`);
  return on > 3 && on < off - 1;
};
// ---------------------------------------------------------------- the brake
CASES.brake = () => {
  let ok = true;
  for (const v of [14, 8, 4]) {
    place(60, 1, -60, 0, v);
    // THE CAMERA IS HELD, because that is what braking actually is: the lens is behind her and
    // the thumb comes back. Feeding a follow camera here is a loop -- her bearing drives the
    // lens, the lens drives the thumb, and what gets measured is the harness.
    const h0 = P.heading; let stop = -1, yaw = 0, done = 0;
    run(3.5, t => {
      rg.cam.az = 0; rg.stick.L.y = 1; rg.stick.L.x = 0;
      // MEASURE THE CARVE WHILE SHE IS STILL BRAKING. Below `fakieAt` the held thumb stops
      // being a brake and becomes a turn-and-push, which is the design -- reading the yaw
      // through it measures that, not this.
      // LATCHED AT THE MOMENT SHE IS DOWN TO WALKING PACE. Below `fakieAt` the held thumb
      // stops being a brake and becomes a turn-and-push, which is the design -- reading the yaw
      // through that measures the turn, not the brake, and comes back 180 every time.
      if (!done) { yaw = Math.abs(P.heading - h0) * 180 / Math.PI; if (P.speed < 1.5) done = 1; }
      // UNDER 0.6, NOT 0.4 (r27): the brake hands over at 0.55 m/s and a quicker turn (turn 7, grip 30)
      // now carries that last half metre a second ROUND with her as she pivots to push off, instead
      // of letting it drain through zero -- a skater stopping and turning, read at walking pace.
      if (stop < 0 && t > 0.05 && P.speed < 0.6) stop = t;
    });
    console.log(`  from ${v} m/s: stopped at ${stop < 0 ? 'NEVER' : fix(stop) + 's'}, yaw ${fix(yaw, 1)} deg`);
    if (stop < 0 || yaw > 5) ok = false;
  }
  return ok;
};
// ---------------------------------------------------------------- carving
CASES.carve = () => {
  // THE STICK IS A HEADING, NOT A TORQUE, so a held sideways thumb turns her ninety degrees and
  // then she skates straight at it -- there is no circle to measure and looking for one measures
  // the harness. What matters is how fast she comes round and what the turn costs her.
  let ok = true;
  for (const v of [6, 14, 20]) {
    place(-60, 1, -60, 0, v);
    let t90 = -1, vOut = 0;
    // 1.6 s is all the turn needs; anything longer just skates her into the perimeter, which is
    // what the 6 m/s row was really measuring when it came back at 0.26 m/s.
    run(1.6, t => { rg.cam.az = Math.PI / 2; rg.stick.L.y = -1; rg.stick.L.x = 0;
      if (t90 < 0 && Math.abs(wrap(P.heading - Math.PI / 2)) < 0.09) { t90 = t; vOut = P.speed; } });
    console.log(`  at ${String(v).padStart(2)} m/s: 90 deg turn in ${t90 < 0 ? 'NEVER' : fix(t90) + 's'}, ` +
                `out at ${fix(vOut)} m/s`);
    if (t90 < 0 || t90 > 2.4) ok = false;
  }
  return ok;
};
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
// ---------------------------------------------------------------- the jump
CASES.jump = () => {
  place(60, 1, -60, 0, 8);
  const y0 = P.pos.y; P.jump = 1;
  let apex = -9, air = 0;
  run(3, () => { follow(); rg.stick.L.y = P.grounded ? -1 : 0;
    if (!P.grounded) { air += DT; apex = Math.max(apex, P.pos.y); } });
  console.log(`  apex ${fix(apex - y0)} m, airtime ${fix(air)} s, landed at ${fix(P.speed)} m/s` +
              (P.bailT > 0 ? ' -- BAILED' : ''));
  return apex - y0 > 1.2 && air > 0.6 && P.grounded;
};
const AIRLAND = 54;   // `AIR.land` in degrees -- the probe asserts against the shipped number
const bodyAxis = ax => new THREE.Vector3(...ax).applyQuaternion(P.bq);
const degBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180 / Math.PI;
// ---------------------------------------------------------------- she carries the ramp's angle
// "When you fly off a half pipe you are at a 90 degree angle from the ground." So the body has
// to leave holding the angle of the face it left, and the only honest check is the angle between
// her own up and that face's normal on the frame she goes.
CASES.carry = () => {
  // r74: a tap on a steep face is the TRANSFER now, not a pop; this case measures the body after a POP off each face
  const keepTX = rg.VERT.tapXfer; rg.VERT.tapXfer = 0;
  let ok = true;
  // the half pipe sits at oz = 30 running along +Z: flat bottom 27..33, right transition
  // 33..35.59 (the lip), coping to 35.69, deck to 37.39. Further up the wall is a steeper face.
  for (const z of [33.6, 34.6, 35.3]) {
    // LET HER SETTLE ON THE WALL FIRST. `place` gives her a HORIZONTAL velocity, and popping on
    // frame one launches her straight into a 62-degree face -- a state the game never produces,
    // and the probe then reports that she never left the ground. Four frames of `stepGround`
    // put her velocity ALONG the surface, which is what riding up a wall actually is.
    place(0, 3, z, 0, 10);
    let nWall = null, wall = 0, up0 = null;
    run(0.3, (t, i) => {
      rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
      if (i === 4) { nWall = new THREE.Vector3(P.n.x, P.n.y, P.n.z);
                     wall = degBetween(nWall, new THREE.Vector3(0, 1, 0)); P.jump = 1; }
      if (i > 4 && !P.grounded && !up0) up0 = bodyAxis([0, 1, 0]);
    });
    // SHE COMES UPRIGHT, which is the whole of what changed: a skater flying out of a wall is
    // upright going straight up, not lying along it. She still LEAVES holding the face's angle
    // -- that is `leaveGround` -- and eases to plumb from there.
    run(0.6, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0; });
    const plumb = degBetween(bodyAxis([0, 1, 0]), new THREE.Vector3(0, 1, 0));
    // r47: A LOCKED VERT AIR KEEPS THE WALL'S TILT (Tony Hawk) -- every one of these pops carries her over the lip
    // and locks; only an air off a gentler face rights to plumb (the kicker row below)
    const tilt = P.vertLock && P.vertN ? degBetween(bodyAxis([0, 1, 0]), P.vertN) : null;
    console.log(`  leaving a ${fix(wall, 0)} deg face: ` + (tilt != null ? `LOCKED vert air, ${fix(tilt, 1)} deg off the wall's normal 0.8 s later` : `${fix(plumb, 0)} deg off plumb 0.8 s later`) +
                (P.grounded ? ' (back on the ground)' : ''));
    if (!(tilt != null ? tilt < 3 : plumb < 14)) ok = false;
  }
  // off the kicker's 38 deg lip: not a vert air, so she rights to plumb as before
  { place(-11, 0, 8, 0, 11); let t0 = -1, plumb = 0, lock = 0;
    run(2, (t) => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
      if (!P.grounded && t0 < 0) { t0 = t; lock = P.vertLock; }
      if (t0 >= 0 && t - t0 > 0.55 && t - t0 < 0.57) plumb = degBetween(bodyAxis([0, 1, 0]), new THREE.Vector3(0, 1, 0)); });
    console.log(`  off the kicker's lip: ${lock ? 'LOCKED (wrong)' : 'not locked'}, ${fix(plumb, 0)} deg off plumb 0.55 s later`);
    if (lock || t0 < 0 || plumb > 14) ok = false; }
  rg.VERT.tapXfer = keepTX;
  return ok;
};
// ---------------------------------------------------------------- and comes back down the pipe
CASES.vert = () => {
  // "A jump that aims straight up like a pipe, the character will fall straight back down to
  // come back down the same pipe they went up." The deck starts at z = 35.69, so landing past
  // there is being thrown OUT over the coping, which is the thing that was wrong.
  let ok = true;
  // Ridden up from the FLAT BOTTOM, which is the only way she ever actually reaches the lip --
  // popped mid-wall she leaves at whatever angle that face happens to be and flying out over
  // the deck is then correct rather than a fault.
  // r25: *"If you tap, no matter what, you're constrained up and come back down"* -- and the way
  // OUT is a SWIPE UP on the right pad (`jump` 2). So: rolling over the lip, a tap, and a tap with
  // the left thumb held forward ALL come back into the pipe; a swipe, with or without the left
  // thumb, goes onto the deck. `pop` 1 is a tap, 2 is the swipe; `fwd` holds the left stick forward.
  const apexes = {};
  for (const [v, pop, fwd] of [[13, 0, 0], [17, 0, 0], [21, 0, 0], [13, 1, 0], [17, 1, 0], [17, 1, 1], [17, 0, 1],
                               [13, 2, 0], [17, 2, 0], [21, 2, 0], [17, 2, 1]]) {
    // r81: SWAPPED BACK. The right pad's SWIPE UP is the transfer (onto the deck); a TAP pops her straight up and she comes
    // back down the same wall. The swipe goes through the shipped `rightFlick`.
    const xfer = pop === 2;
    place(0, 3, 29, 0, v);
    let phase = 0, landZ = 0, apex = -9, fired = 0; P.dashed = 0;
    run(5, (t, i) => {
      rg.stick.L.x = 0; rg.stick.L.y = fwd ? -1 : 0; rg.cam.az = 0;
      // AT THE LIP, not merely near it. The band from 58 degrees to 88 is only 40 cm of z, so
      // a trigger at 35.2 pops her off a 58-degree face -- and flying out over the deck off a
      // 58-degree face is correct, not a fault. This is the LIP.
      if (pop && P.grounded && P.pos.z > 35.55 && !fired) { fired = 1; if (pop === 2) rg.rightFlick(0, -60); else P.jump = 1; }
      if (phase === 0 && !P.grounded) phase = 1;
      if (phase === 1) { apex = Math.max(apex, P.pos.y); if (P.grounded) { phase = 2; landZ = P.pos.z; } }
    });
    const lip = 30 + 3 + 2.6 * Math.sin(rg.PARK.hpSweep), deck = lip + rg.PARK.cope;
    const where = landZ > deck ? 'ON THE DECK' : 'back in the pipe';
    console.log(`  in at ${String(v).padStart(2)} m/s${pop === 2 ? ' + SWIPE' : pop ? ' + a tap' : '        '}${fwd ? ' + left fwd' : '           '}: ` +
                `apex ${fix(apex)} m (coping is ${fix(2.6 * (1 - Math.cos(rg.PARK.hpSweep)))}), ` +
                `down at z ${fix(landZ)}, lip ${fix(lip)} -- ${where}`);
    // WHAT MUST ALWAYS HOLD is that she LEAVES -- the lip must never eat her climb again. And since
    // r21's vert lock, *"you go straight up and come back down that same half pipe"* at ANY speed
    // with any pop, landing below the lip -- while the thumb held forward is the transfer, onto the
    // deck. (Before the lock every one of these drifted out: 13 m/s landed on the flat lip at deck
    // height and was labelled "back in the pipe" because the test measured z against the deck's
    // far edge rather than against the lip.)
    if (phase !== 2) ok = false;
    if (!xfer && landZ > lip) { console.log('    -> drifted out over the coping'); ok = false; }
    if (xfer && landZ <= deck) { console.log('    -> the swipe did not carry her out'); ok = false; }
    if (!pop && !fwd) apexes[v] = apex;
  }
  // AND THE BOWL, the other place he named: ridden from the middle up its wall, a tap at the lip
  // comes back in and a swipe goes out over the rim onto the plaza.
  const B = rg.BOWL;
  for (const [v, pop] of [[12, 1], [12, 2], [15, 2]]) {
    place(B.x, -2, B.z, Math.PI / 2, v); P.dashed = 0;
    let phase = 0, land = null, fired = 0;
    run(5, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
      if (!fired && P.grounded && P.n.y < 0.3 && P.vel.y > 0) { if (pop === 2) rg.rightFlick(0, -60); else P.jump = 1; fired = 1; }
      if (phase === 0 && !P.grounded) phase = 1;
      if (phase === 1 && P.grounded) { phase = 2; land = Math.hypot(P.pos.x - B.x, P.pos.z - B.z); } });
    const out = land !== null && land > B.r;
    console.log(`  bowl at ${v} m/s + ${pop === 2 ? 'SWIPE' : 'a tap'}: ${land === null ? 'never landed' : `down ${fix(land, 1)} m from the middle (rim ${B.r})`} -- ${out ? 'OUT' : 'back in the bowl'}`);
    if (!fired || land === null || out !== (pop === 2)) ok = false;      // r81: the swipe goes out, the tap comes back in
  }
  return ok;
};
// ---------------------------------------------------------------- A TAP IS A JUMP
// *"I'm having trouble jumping and I can't tell if it's a thumb location thing."* It was: with a
// fixed 132 px pad, `far` is measured from the CIRCLE's centre, so a thumb landing near the rim
// read as almost full travel before it had moved -- and the tap was rejected as a camera drag
// every time. This drives the SHIPPED `bindStick` through real dispatched pointer events on the
// real element, which nothing here could do before: the stub swallowed every listener.
CASES.tap = async () => {
  // r30: EVERY ORDINARY PRESS GOES THROUGH THE REAL SEQUENCE A PHONE SENDS -- the pointer event and
  // then the TouchEvent for the same finger, with the live `touches` list. r28's stuck-stick net
  // passed every row here and released every pad on the touch that started it, because no row
  // ever sent the touchstart that FOLLOWS a pointerdown. No control worked on the phone at all.
  const LIVE = new Map();
  const real = (el, e) => {
    el.dispatchEvent(e);
    const T = () => [...LIVE.entries()].map(([id, q]) => ({ identifier: id, clientX: q[0], clientY: q[1] }));
    const me = { identifier: e.pointerId, clientX: e.clientX, clientY: e.clientY };
    if (e.type === 'pointerdown') { LIVE.set(e.pointerId, [e.clientX, e.clientY]); globalThis.__win('touchstart', { touches: T(), changedTouches: [me] }); }
    else if (e.type === 'pointermove') { if (LIVE.has(e.pointerId)) LIVE.set(e.pointerId, [e.clientX, e.clientY]); }
    else if (e.type === 'pointerup') { LIVE.delete(e.pointerId); globalThis.__win('touchend', { touches: T(), changedTouches: [me] }); }
  };
  const pad = document.getElementById('stkR');
  const ev = (type, x, y) => ({ type, pointerId: 7, clientX: x, clientY: y,
    stopPropagation() {}, preventDefault() {}, target: pad });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rows = [
    ['dead centre, quick',        150, 150, 150, 150, 40],
    ['near the zone EDGE, quick',  72, 232,  72, 232, 40],   // <- the one that could never fire
    ['other edge, quick',         228,  72, 228,  72, 40],
    ['dragged 50 px',             150, 150, 200, 150, 40],
    ['held past tapT',            150, 150, 150, 150, 420],
    ['nudged 8 px, quick',        150, 150, 158, 150, 40],
  ];
  let ok = true;
  for (const [name, x0, y0, x1, y1, ms] of rows) {
    P.jump = 0;
    real(pad, ev('pointerdown', x0, y0));
    if (x1 !== x0 || y1 !== y0) real(pad, ev('pointermove', x1, y1));
    await wait(ms);
    real(pad, ev('pointerup', x1, y1));
    const got = !!P.jump;
    // a tap is a thumb that did not travel and did not linger; everything else is the camera
    const want = Math.hypot(x1 - x0, y1 - y0) / 52 < rg.AIR.tapFar && ms < rg.AIR.tapT * 1000;
    console.log(`  ${name.padEnd(26)} -> ${got ? 'JUMP' : 'no jump'}${got === want ? '' : '   <- WRONG'}`);
    if (got !== want) ok = false;
    P.jump = 0;
  }
  // THE LEFT PAD'S TAP IS THE SWIVEL (r23) -- through the shipped binding, for a fakie-capable skin
  { const L = document.getElementById('stkL'), keepLock = P.stanceLock;
    const evL = (type, x, y) => ({ type, pointerId: 8, clientX: x, clientY: y, stopPropagation() {}, preventDefault() {}, target: L });
    for (const [name, x1, ms, want] of [['left pad, quick tap', 150, 40, true], ['left pad, dragged', 200, 40, false], ['left pad, held', 150, 420, false]]) {
      P.stanceLock = true; place(60, 1, -60, 0, 5); P.stance = 1;
      real(L, evL('pointerdown', 150, 150));
      if (x1 !== 150) real(L, evL('pointermove', x1, 150));
      await wait(ms);
      real(L, evL('pointerup', x1, 150));
      const got = P.stance === -1;
      console.log(`  ${name.padEnd(26)} -> ${got ? 'SWIVEL' : 'no swivel'}${got === want ? '' : '   <- WRONG'}`);
      if (got !== want) ok = false;
    }
    // r46: ON A RAIL the same tap switches the grind's side instead, and a flick picks a trick grind
    { const R0 = rg.RAILS[0];
      P.stanceLock = true; place(60, 1, -60, 0, 5); P.stance = 1; P.grounded = true;
      P.grind = { rail: R0, side: 'left', s: 8, time: 1, t: 0.5, dir: 1 };
      real(L, evL('pointerdown', 150, 150)); await wait(40); real(L, evL('pointerup', 150, 150));
      const sw = P.grind && P.grind.side === 'right' && P.stance === 1;
      console.log(`  ${'left tap ON A RAIL'.padEnd(26)} -> ${sw ? 'switched to the right side, no swivel' : 'WRONG: side ' + (P.grind && P.grind.side) + ', stance ' + P.stance}`);
      if (!sw) ok = false;
      real(L, evL('pointerdown', 150, 150)); real(L, evL('pointermove', 150, 60)); await wait(30); real(L, evL('pointerup', 150, 60));
      const tr = P.grind && P.grind.trick === 'up';
      console.log(`  ${'left flick UP on a rail'.padEnd(26)} -> ${tr ? 'trick grind (up)' : 'WRONG: ' + (P.grind && P.grind.trick)}`);
      if (!tr) ok = false;
      P.grind = null; }
    P.stanceLock = keepLock; P.stance = 1; rg.stick.L.x = rg.stick.L.y = 0; rg.stick.L.down = 0; }
  // r30: A PLAIN HOLD, THE WAY A PHONE SENDS IT: the pad must still be held and steering after its
  // own touchstart. This is the row that was missing when r28 shipped "no controls work".
  { const L = document.getElementById('stkL');
    const evH = (type, x, y) => ({ type, pointerId: 31, clientX: x, clientY: y, stopPropagation() {}, preventDefault() {}, target: L });
    real(L, evH('pointerdown', 150, 150)); real(L, evH('pointermove', 150, 98));
    const good = rg.stick.L.down && rg.stick.L.y < -0.9;
    console.log(`  a normal held thumb (pointer + touch) -> ${good ? 'held, steering forward' : 'RELEASED -- no control works'}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
    real(L, evH('pointerup', 150, 98)); }
  const FRESH = 160;   // past index.html's FRESH_MS: how old a lost thumb is before the next touch
  // THE STUCK STICK (r28): a pointerdown on the left pad whose up NEVER arrives -- the bug. The next
  // touch event's `touches` list does not have that finger, so the pad lets go; and a finger that
  // was refused while the ghost held the pad is handed it. Through the shipped `bindStick` and the
  // shipped window handler.
  { const L = document.getElementById('stkL');
    const evL = (type, id, x, y) => ({ type, pointerId: id, clientX: x, clientY: y, stopPropagation() {}, preventDefault() {}, target: L });
    const T = (id, x, y) => ({ identifier: id, clientX: x, clientY: y });
    L.dispatchEvent(evL('pointerdown', 41, 150, 150)); L.dispatchEvent(evL('pointermove', 41, 150, 98));   // thumb pushed forward...
    await wait(FRESH);   // a ghost is OLD by the time anything touches the glass again (r30)
    // ...and lifted with no pointerup. The stick reads full forward with nobody on it:
    const stuck = rg.stick.L.down && rg.stick.L.y < -0.9;
    // another finger lands on the RIGHT pad: the glass now has one touch, not near the left thumb
    globalThis.__win('touchstart', { touches: [T(9, 900, 600)], changedTouches: [T(9, 900, 600)] });
    let good = stuck && !rg.stick.L.down && rg.stick.L.y === 0;
    console.log(`  left thumb lost with no pointerup -> ${stuck ? 'stuck forward' : 'NOT stuck (test broken)'}, next touch: ${rg.stick.L.down ? 'STILL STUCK' : 'released'}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
    globalThis.__win('touchend', { touches: [], changedTouches: [T(9, 900, 600)] });
    // stuck again, and this time the fix is touching the left pad itself, right where the ghost was
    L.dispatchEvent(evL('pointerdown', 42, 150, 150)); L.dispatchEvent(evL('pointermove', 42, 150, 98));
    await wait(FRESH);
    L.dispatchEvent(evL('pointerdown', 43, 150, 110));             // refused: the ghost holds the pad
    const refused = rg.stick.L.y < -0.9;
    globalThis.__win('touchstart', { touches: [T(43, 150, 110)], changedTouches: [T(43, 150, 110)] });
    L.dispatchEvent(evL('pointermove', 43, 202, 110));             // the NEW thumb steers right
    good = refused && rg.stick.L.down && rg.stick.L.x > 0.9 && Math.abs(rg.stick.L.y) < 0.1;
    console.log(`  touch the stuck stick again       -> ${good ? 'the new thumb has it' : `x ${fix(rg.stick.L.x)} y ${fix(rg.stick.L.y)} down ${rg.stick.L.down}`}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
    // and a REAL held thumb survives every check: still on the glass, so still steering
    await wait(FRESH);   // old enough that only its being ON THE GLASS can keep it
    globalThis.__win('touchstart', { touches: [T(43, 202, 110), T(9, 900, 600)], changedTouches: [T(9, 900, 600)] });
    good = rg.stick.L.down && rg.stick.L.x > 0.9;
    console.log(`  a real held thumb, other finger down -> ${good ? 'kept' : 'DROPPED'}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
    L.dispatchEvent(evL('pointerup', 43, 202, 110)); globalThis.__win('touchend', { touches: [], changedTouches: [] });
    }
  // THE RIGHT PAD ORBITS THE LENS, NOT HER (r28): left thumb held forward, right pad swinging the
  // camera round -- the direction the left thumb means must not move with it. Thumb up, they agree.
  { place(60, 1, -60, 0, 0); P.grounded = true;
    rg.cam.az = 0; rg.cam.steerAz = 0; rg.cam.idle = 0;
    Object.assign(rg.stick.L, { down: 1, x: 0, y: -1 }); Object.assign(rg.stick.R, { down: 1, x: 1, y: 0 });
    const w0 = rg.stickWorld();
    for (let i = 0; i < 30; i++) rg.stepCam(DT);
    const w1 = rg.stickWorld(), lens = rg.cam.az * 57.3, drift = Math.acos(Math.max(-1, Math.min(1, w0.x * w1.x + w0.z * w1.z))) * 57.3;
    let good = Math.abs(lens) > 30 && drift < 0.5;
    console.log(`  orbit the camera, left thumb held -> lens swung ${fix(lens, 0)} deg, her "forward" moved ${fix(drift, 1)} deg${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
    Object.assign(rg.stick.L, { down: 0, x: 0, y: -1 }); Object.assign(rg.stick.R, { down: 0, x: 0 });
    rg.stepCam(DT);
    const w2 = rg.stickWorld(), sa = Math.sin(rg.cam.az), ca = Math.cos(rg.cam.az);
    good = Math.abs(w2.x - sa) < 1e-6 && Math.abs(w2.z - ca) < 1e-6;
    console.log(`  ...and once the left thumb lifts    -> ${good ? 'steering frame back on the lens' : 'STILL OFF'}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
    rg.stick.L.y = 0; rg.cam.az = 0; rg.cam.steerAz = 0; }
  // THE RIGHT PAD'S SWIPE (r39): on FLAT ground it is the MELEE chain, any direction; a swipe UP on a
  // steep face is still the TRANSFER (`jump` 2); in the air it is the flying kick. Through the shipped
  // binding, real FLICK timing.
  { const swipe = async (dx, dy) => { P.jump = 0; P.mel = null; P.melQ = null; P.kicked = 0;
      real(pad, ev('pointerdown', 150, 150)); await wait(16);
      real(pad, ev('pointermove', 150 + dx, 150 + dy)); await wait(30);
      real(pad, ev('pointerup', 150 + dx, 150 + dy)); await wait(140); };   // past FLICK.gap
    const what = () => P.jump === 2 ? 'TRANSFER jump' : P.jump === 1 ? 'a tap jump' : P.mel ? `${P.mel.kind} ${P.mel.nm} (${fix(P.vel.length(), 1)} m/s)` : P.xferArm > 0 ? 'TRANSFER armed for the lip' : 'nothing';
    // r57: a swipe UP on flat ground is a strike again -- and every ground strike carries a boost
    place(60, 1, -60, 0, 6); await swipe(0, -52);
    let good = P.jump === 0 && P.mel && P.mel.kind === 'strike' && P.vel.length() > 6 + rg.MELEE.boost;
    console.log(`  swipe UP on flat ground       -> ${what()}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
    place(60, 1, -60, 0, 6); await swipe(52, 0);
    good = P.jump === 0 && P.mel && P.mel.kind === 'strike';
    console.log(`  swipe SIDEWAYS on the ground  -> ${what()}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
    // up the half pipe's wall, on a steep face: the swipe up IS the way out, at once (instead of the ollie)
    place(0, 3, 29, 0, 13); rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
    { let st = false; for (let i = 0; i < 180 && !st; i++) { rg.stepPlayer(DT); st = P.grounded && P.n.y < 0.6; }
      P.dashed = 0; P.xferArm = 0; await swipe(0, -52);
      good = st && P.xferArm > 0 && !P.dashed;      // r81: on the wall the swipe up is the transfer again (armed for the lip)
      console.log(`  swipe UP on the pipe's wall   -> ${st ? what() : 'never reached a steep face'}${good ? '' : '   <- WRONG'}`); }
    if (!good) ok = false;
    // r29: THE FLIPS ARE THE LEFT PAD'S. In the air the right swipe does nothing; the left one flips.
    const keepM = rg.girl.moves; rg.girl.moves = gameClips('models/alien_rollerskate_blue.glb').moves;
    const air = () => { place(60, 1, -60, 0, 6); P.grounded = false; P.coyote = 0; P.pos.y += 6; P.vel.y = 3; P.flip = null; };
    air(); await swipe(0, -52);
    good = P.jump === 0 && !P.flip && P.mel && P.mel.kind === 'strike' && P.mel.air;     // r44: the air melee
    console.log(`  RIGHT swipe up in the air     -> ${P.flip ? P.flip.dir + ' flip (WRONG)' : what()}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
    const L = document.getElementById('stkL');
    const evL = (type, x, y) => ({ type, pointerId: 77, clientX: x, clientY: y, stopPropagation() {}, preventDefault() {}, target: L });
    const swipeL = async (dx, dy) => { real(L, evL('pointerdown', 150, 150)); await wait(16);
      real(L, evL('pointermove', 150 + dx, 150 + dy)); await wait(30);
      real(L, evL('pointerup', 150 + dx, 150 + dy)); await wait(140); };
    for (const [dx, dy, want] of [[0, -52, 'up'], [0, 52, 'down'], [52, 0, 'right'], [-52, 0, 'left']]) {
      air(); await swipeL(dx, dy);
      good = P.flip && P.flip.dir === want;
      console.log(`  LEFT swipe ${want.padEnd(5)} in the air   -> ${P.flip ? P.flip.dir + ' flip' : 'nothing'}${good ? '' : '   <- WRONG'}`);
      if (!good) ok = false;
    }
    // r80: on the ground a swipe UP is the BOOST and a swipe DOWN the slide tackle -- never a flip, never the swivel
    for (const [dy, want] of [[-52, 'boost'], [52, 'slide']]) { const keepLock = P.stanceLock; P.stanceLock = true; place(60, 1, -60, 0, 6); P.stance = 1; P.flip = null; P.boostT = 0; P.boostCool = 0; P.mel = null;
      await swipeL(0, dy);
      const got = P.flip ? 'a FLIP' : P.stance < 0 ? 'a SWIVEL' : P.boostT > 0 ? 'boost' : P.mel ? P.mel.kind : 'nothing';
      good = got === want;
      console.log(`  LEFT swipe ${dy < 0 ? 'up  ' : 'down'} on the ground -> ${got}${good ? '' : '   <- WRONG'}`);
      P.mel = null; P.boostT = 0; P.boostFx = 0;
      if (!good) ok = false; P.stanceLock = keepLock; }
    rg.girl.moves = keepM; P.flip = null; P.jump = 0; }
  return ok;
};

// ---------------------------------------------------------------- the stick in the air
// X spins her, Y pushes her, and there is no flip any more. The thrust is what lets her clear
// the back of one ramp and reach the next, so what matters is how far it actually carries her.
CASES.airctl = () => {
  let ok = true;
  const keepAim = rg.AIR.aim;
  // r26's SPIN RATE (AIR.aim 0): X spins her, Y pushes her
  rg.AIR.aim = 0;
  for (const [name, sx, sy] of [['spin right', 1, 0], ['spin left', -1, 0], ['no input', 0, 0], ['hold forward', 0, -1]]) {
    place(60, 1, -60, 0, 10);
    P.jump = 1;
    const h0 = P.heading;
    let z0 = null, z1 = 0, air = 0, yaw = 0;
    run(1.4, () => {
      rg.cam.az = 0; rg.stick.L.x = P.grounded ? 0 : sx; rg.stick.L.y = P.grounded ? 0 : sy;
      // MEASURED IN THE AIR, not after. On landing her heading is re-taken from the body and
      // `atan2` wraps it into (-pi, pi], so a 296-degree spin read back as 114 -- the harness
      // measuring the wrap rather than the spin.
      if (!P.grounded) { if (z0 === null) z0 = P.pos.z; z1 = P.pos.z; air += DT;
                         yaw = (P.heading - h0) * 180 / Math.PI; }
    });
    console.log(`  rate  ${name.padEnd(13)} yaw ${fix(yaw, 0).padStart(5)} deg, carried ${fix(z1 - z0)} m over ${fix(air)} s of air`);
    // heading grows +Z toward +X, which turns her LEFT, so a thumb pushed RIGHT must DECREASE it
    if (name === 'spin right' && !(yaw < -240)) ok = false;
    if (name === 'spin left' && !(yaw > 240)) ok = false;
    if (name === 'no input' && Math.abs(yaw) > 1) ok = false;
    if (name === 'hold forward' && !(z1 - z0 > 16)) ok = false;
  }
  // r55: THE STICK IS A HEADING (AIR.aim 1). A thumb pushed right in the air points her right and she stays there;
  // a thumb circling the pad spins her with it; a thumb held forward from the run-up still carries her; and the
  // thumb only takes over once it has MOVED from where it was at takeoff.
  rg.AIR.aim = 1;
  const go = (name, thumb, check) => { place(60, 1, -60, 0, 10); P.jump = 1; const h0 = P.heading; let z0 = null, z1 = 0, air = 0, yaw = 0, t = 0, maxYaw = 0;
    run(1.4, () => { rg.cam.az = 0; rg.cam.steerAz = 0; const s = thumb(P.grounded, t); rg.stick.L.x = s[0]; rg.stick.L.y = s[1]; rg.stick.L.down = s[2] ? 1 : 0;
      if (!P.grounded) { t += DT; if (z0 === null) z0 = P.pos.z; z1 = P.pos.z; air += DT; yaw = (P.heading - h0) * 180 / Math.PI; maxYaw = Math.max(maxYaw, Math.abs(yaw)); } });
    rg.stick.L.down = 0;
    const good = check(yaw, z1 - z0, maxYaw); if (!good) ok = false;
    console.log(`  aim   ${name.padEnd(30)} yaw ${fix(yaw, 0).padStart(5)} deg, carried ${fix(z1 - z0)} m${good ? '' : '   <- WRONG'}`); };
  go('pushed right, held', (gr) => gr ? [0, 0, 0] : [1, 0, 1], (y) => Math.abs(y + 90) < 3);
  go('pushed left, held', (gr) => gr ? [0, 0, 0] : [-1, 0, 1], (y) => Math.abs(y - 90) < 3);
  go('pulled back, held', (gr) => gr ? [0, 0, 0] : [0, 1, 1], (y) => Math.abs(Math.abs(y) - 180) < 3);
  go('thumb circling, 1 turn a second', (gr, t) => gr ? [0, 0, 0] : [Math.sin(t * 6.283), -Math.cos(t * 6.283), 1], (y, d, m) => y < -300);
  go('held forward from the run-up', (gr) => [0, -1, 1], (y, d) => Math.abs(y) < 1 && d > 16);
  go('no input', () => [0, 0, 0], (y) => Math.abs(y) < 1);
  rg.AIR.aim = keepAim;
  return ok;
};
// ---------------------------------------------------------------- and a bad landing is a bail
CASES.bail = () => {
  let ok = true;
  // ARMED FOR THE TEST ONLY. `AIR.land` ships at 99 -- she is upright in the air now, so every
  // drop back into a transition is eighty degrees "out" and the check would fire on all of them.
  // The mechanism is kept for the day there is a flip again, and this is what proves it still
  // works rather than having quietly rotted.
  // ...AND `AIR.ease` OFF WITH IT, because the shipped air brings her back to plumb: without
  // that she is upright again long before she lands and every row reads "landed it", which is a
  // test that cannot fail.
  // r33: AND THE PRE-ALIGN OFF TOO -- it turns her onto the floor in the last couple of metres, so a
  // body held out of square never reaches the ground out of square and no row could ever bail.
  const was = rg.AIR.land, wasE = rg.AIR.ease, wasP = rg.AIR.preAlign; rg.AIR.land = 0.95; rg.AIR.ease = 0; rg.AIR.preAlign = 0;
  for (const deg of [0, 30, 50, 75, 120]) {
    place(60, 1, -60, 0, 8);
    P.pos.y = 6; rg.leaveGround(0); P.vel.set(0, 0, 8);
    P.bq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deg * Math.PI / 180));
    let bailed = -1, v1 = 0;
    run(2.5, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
      if (P.grounded && bailed < 0) { v1 = P.speed; bailed = P.bailT > 0 ? 1 : 0; } });
    console.log(`  ${String(deg).padStart(3)} deg out of square: ${bailed === 1 ? 'BAILED    ' : 'landed it '}` +
                ` (${fix((P.landOff || 0) * 180 / Math.PI, 0)} deg measured, ${fix(v1)} m/s left)`);
    if ((bailed === 1) !== (deg > AIRLAND)) ok = false;
  }
  rg.AIR.land = was; rg.AIR.ease = wasE; rg.AIR.preAlign = wasP;
  return ok;
};

// ---------------------------------------------------------------- THE HALF PIPE
// This is the one that says whether any of it works. She drops in off the deck with NO input
// at all and the only thing acting on her is the slope: if the transition is being handled
// honestly she swings up the far wall to nearly the height she started at, and keeps swinging.
// Speed bled a sliver at a time by re-projecting her velocity at every triangle boundary is
// exactly what "nothing ever gets to the coping" looks like, and it shows up here as the
// swings dying away.
CASES.pipe = () => {
  const H = 2.6 * (1 - Math.cos(rg.PARK.hpSweep));
  place(0, H + 0.2, 23.0, 0, 2.2);
  const peaks = []; let up = false, best = -9;
  run(14, () => {
    // no input at all: this is gravity and the geometry, nothing else
    rg.stick.L.x = rg.stick.L.y = 0;
    if (P.vel.y > 0.2) { up = true; best = Math.max(best, P.pos.y); }
    else if (up && P.vel.y < -0.2) { peaks.push(best); up = false; best = -9; }
  });
  console.log(`  dropped in from ${fix(H)} m with no input`);
  console.log(`  peaks: ${peaks.slice(0, 8).map(v => fix(v)).join(' ')} m`);
  const keep = peaks.length > 1 ? peaks[1] / peaks[0] : 0;
  console.log(`  ${peaks.length} swings in 14 s, second peak keeps ${fix(keep * 100, 0)}% of the first`);
  // 0.85, not 0.6: r23's coast fade on the pipe's flat bottom took this to 0.72 and the old mark
  // passed it while the ramp visibly died. Rolling drag alone keeps ~95%.
  return peaks.length >= 4 && keep > 0.85;
};
CASES.pump = () => {
  const H = 2.6 * (1 - Math.cos(rg.PARK.hpSweep));
  place(0, H + 0.2, 23.0, 0, 2.2);
  let best = -9, peaks = [], up = false, air = 0;
  run(16, () => {
    follow(); rg.stick.L.y = P.grounded ? -1 : 0; rg.stick.L.x = 0;   // and LET GO in the air:
                                                     // that thumb is the BODY once she is up
    if (!P.grounded) air = Math.max(air, P.pos.y);
    if (P.vel.y > 0.2) { up = true; best = Math.max(best, P.pos.y); }
    else if (up && P.vel.y < -0.2) { peaks.push(best); up = false; best = -9; }
  });
  console.log(`  pumping: peaks ${peaks.slice(0, 9).map(v => fix(v)).join(' ')} m (coping is ${fix(H)})`);
  console.log(`  highest point reached ${fix(Math.max(...peaks, air))} m`);
  // r40: TWO REAL SWINGS, not "more than two peaks" -- the old mark was passing on a 4 cm blip read as a
  // third peak where the half pipe's flat bottom (no longer drawn, r40) met the plaza.
  const real = peaks.filter(v => v > 0.5);
  return real.length >= 2 && Math.max(...peaks) > H * 0.9;
};
// ---------------------------------------------------------------- the kicker
CASES.kicker = () => {
  let ok = true;
  for (const v of [8, 14, 20]) {
    place(-11, 1, 8, 0, v);            // the kicker at (-11, 14) launches toward +Z
    // THE FIRST FLIGHT ONLY. She lands and rolls on and may leave the ground again; totting
    // all of that up measures the run, not the ramp.
    let air = 0, apex = -9, z0 = 0, z1 = 0, phase = 0;
    run(4, () => { follow(); rg.stick.L.y = P.grounded ? -1 : 0;
      if (phase === 0 && !P.grounded) { phase = 1; z0 = P.pos.z; }
      if (phase === 1) { if (P.grounded) phase = 2; else { air += DT; apex = Math.max(apex, P.pos.y); z1 = P.pos.z; } } });
    console.log(`  in at ${v} m/s: air ${fix(air)} s, apex ${fix(apex)} m, flew ${fix(z1 - z0)} m`);
    if (!(air > 0.25)) ok = false;
  }
  return ok;
};
// ---------------------------------------------------------------- the bowl
CASES.bowl = () => {
  const B = rg.BOWL;
  place(B.x, 1, B.z + B.r - 0.5, Math.PI, 6);       // over the rim, heading inward (-Z)
  let lowest = 9, out = 0, through = 0;
  run(18, () => {
    follow(); rg.stick.L.y = P.grounded ? -1 : 0; rg.stick.L.x = P.grounded ? 0.35 : 0;
    lowest = Math.min(lowest, P.pos.y);
    if (P.pos.y < -4) through++;
    if (Math.hypot(P.pos.x - B.x, P.pos.z - B.z) > B.r + 4) out++;
  });
  console.log(`  deepest ${fix(lowest)} m (bowl floor is -2.64), left the bowl on ${out} frames, ` +
              `below the floor on ${through}`);
  return through === 0 && lowest < -1.5;
};
// ---------------------------------------------------------------- nothing gets INSIDE a ramp
// "She kinda goes through them a little." Measurable, because every piece in this park is a
// single-valued height over the ground -- there is not one overhang in it -- so the TOP surface
// at any (x,z) is well defined and being under it means being inside the concrete.
// r84: A TRANSITION THAT RISES THROUGH HER BETWEEN TWO SAMPLES (`SK.faceCatch`). Jumps down the length of the half pipe at
// every speed and every moment, at a phone's 20 Hz: flying it end to end she came down into the top of the far wall and
// fell on INSIDE it, 1.9 m deep -- and the r83 push settings did it too, so `inside` passing before was luck of timing.
CASES.hpjump = () => {
  if (process.env.NOFACE) rg.SK.faceCatch = 0;      // the revert test: with the catch off this must fail
  DT = 1 / 20; let worst = 0, at = '';
  for (let v = 10; v <= 22; v += 1) for (let jt = 0.05; jt < 1.6; jt += 0.05) {
    place(0, 1, 14, 0, v); let deep = 0;
    run(2.5, (t) => { rg.stick.L.x = 0; rg.stick.L.y = P.grounded ? -1 : 0; rg.cam.az = 0; if (Math.abs(t - jt) < DT / 2) P.jump = 1;
      const g2 = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 2, 0), d = (g2.hit ? g2.floor : -1e9) - P.pos.y; if (d > deep) deep = d;
      });
    if (deep > worst) { worst = deep; at = `v ${v} jump at ${fix(jt)} s`; }
  }
  DT = 1 / 60; console.log(`  13 speeds x 31 jump moments at 20 Hz: deepest ${fix(worst, 3)} m inside (${at})`); return worst < 0.2;
};
CASES.inside = () => {
  const top = (x, z) => { const g = rg.groundAt(x, z, 60, 0); return g.hit ? g.floor : -1e9; };
  const runs = [
    ['half pipe, straight in', 0, 12, 0],  ['half pipe, fast',        0, 12, 0],
    ['quarter pipe (left)',  -10, 2, -Math.PI / 2], ['quarter pipe (right)', 10, 2, Math.PI / 2],
    ['funbox',                 0, -2, 0], ['kicker',                -11, 6, 0],
    ['perimeter wall',        60, 0, Math.PI / 2],  ['bowl rim',      -28, -12, Math.PI],
  ];
  let ok = true;
  for (const hz of [60, 30, 20]) {
   DT = 1 / hz;
   let worst = 0, worstAt = '';
   for (const [name, x, z, h] of runs) {
    for (const v of [8, 14, 20]) {
      place(x, 1, z, h, v);
      let deep = 0;
      run(3.2, (t, i) => {
        follow(); rg.stick.L.y = P.grounded ? -1 : 0; rg.stick.L.x = 0;
        if (i === 40 || i === 90) P.jump = 1;      // and at it in the air, rising
        // r59: only a surface within 2 m over her feet -- a floating island 12 m up is not concrete she is inside
        const g2 = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 2, 0), d = (g2.hit ? g2.floor : -1e9) - P.pos.y;
        if (d > deep) deep = d;
      });
      if (deep > worst) { worst = deep; worstAt = `${name} at ${v} m/s`; }
    }
   }
   console.log(`  ${String(hz).padStart(2)} Hz: 8 ramps x 3 speeds, skating and jumping into each -> ` +
               `deepest ${fix(worst, 3)} m inside the concrete ${worst > 0.001 ? '(' + worstAt + ')' : ''}`);
   // a few centimetres is the point sample catching up; a third of a metre is going through it
   if (worst >= 0.12) ok = false;
  }
  DT = 1 / 60;
  return ok;
};

// ---------------------------------------------------------------- nothing falls through
CASES.solid = () => {
  let bad = 0, off = 0, worst = 0, lowest = 9;
  for (let seed = 0; seed < 6; seed++) {
    place((seed - 3) * 9, 2, -10 + seed * 7, seed, 4);
    let r = seed * 1234.5;
    run(25, (t, i) => {
      r = (r * 9301 + 49297) % 233280;
      if (i % 40 === 0) { rg.stick.L.x = (r / 233280) * 2 - 1; rg.stick.L.y = -0.9; rg.cam.az = (r / 233280) * 6.28; }
      if (i % 97 === 0) P.jump = 1;
      lowest = Math.min(lowest, P.pos.y);
      // TWO DIFFERENT FAILURES, and only one of them is a bug. Under the world INSIDE the park
      // is a floor that should have been there and was not. Past the outer apron is her having
      // launched clean off the edge of the map at 24 m/s, which the respawn catches in a tenth
      // of a second -- worth reporting, not worth failing.
      const out = Math.max(Math.abs(P.pos.x), Math.abs(P.pos.z)) > rg.PARK.S + 46;
      if (P.pos.y < -6) {
        if (out) off++;
        else { bad++; if (bad < 5) console.log(`    FELL THROUGH at ${fix(P.pos.x)},${fix(P.pos.z)} y${fix(P.pos.y)}`); }
      }
      worst = Math.max(worst, P.speed);
    });
  }
  console.log(`  6 runs x 25 s of scripted input: ${bad} frames through a floor, ${off} frames off ` +
              `the edge of the map, lowest ${fix(lowest)} m, fastest ${fix(worst)} m/s`);
  // and the respawn must always catch her -- below the floor she is meant to fall to is a hang
  return bad === 0 && lowest > -9;
};

// ---------------------------------------------------------------- the clips survive loading
// THE ONE CASE THAT RUNS THE REAL CLIPS. Her GLB's mesh is draco so no harness here can build
// her SKIN -- but the animation samplers are not compressed, so the clips themselves are
// readable, and `normaliseClips` is the shipped function that decides what the mixer ever sees.
// It is built the way GLTFLoader builds it, SHARED TIME ARRAYS AND ALL, because that sharing is
// the entire bug: 198 channels reference two time accessors, the loader hands every track the
// same Float32Array, and shifting the start offset once per TRACK shifted it 183 times. The
// times went to -7.6, the duration came back NEGATIVE, and every track then evaluates past its
// last key and returns it -- a character frozen on the last frame of whatever clip is up.
// Three rounds of fixes to playback rates and loop modes could not touch it.
CASES.clips = () => {
  const AUTH = { coasting: 5.333, Idle: 17.667, jump_in_air: 0.708, jump_start: 0.583, skate_fwd: 0.208 };
  const g = readGLB('models/roller_girl.glb');
  const raw = buildClips(g, THREE);
  const shared = new Set(raw.flatMap(c => c.tracks.map(t => t.times))).size;
  console.log(`  ${raw.length} clips, ${raw[0].tracks.length} tracks each, ` +
              `${shared} distinct time arrays across the lot -- they SHARE`);
  const out = rg.normaliseClips(raw);
  let ok = true;
  for (const c of out) {
    const want = AUTH[c.name];
    const scale = c.tracks.filter(t => /\.scale$/.test(t.name)).length;
    const pos = c.tracks.filter(t => /\.position$/.test(t.name)).length;
    const bad = !(c.duration > 0.01) || (want && Math.abs(c.duration - want) > 0.06) || scale || pos > 1;
    if (bad) ok = false;
    console.log(`  ${c.name.padEnd(13)} dur ${fix(c.duration, 3)} (authored ${want ? fix(want, 3) : '?'})  ` +
                `${c.tracks.length} tracks, ${pos} position, ${scale} scale${bad ? '   <- WRONG' : ''}`);
  }
  if (out.some(c => c.name === 'CINEMA_4D_Main')) { console.log('  -> the one-frame residue clip survived'); ok = false; }
  return ok;
};
// ---------------------------------------------------------------- what the mixer is asked for
// NO HARNESS HERE CAN BUILD A SKIN -- the GLBs are draco and `DRACOLoader` wants a Worker -- so
// the actions are FABRICATED. That is enough, because the question is not what the clip looks
// like: it is what `girlAnim` ASKS the mixer for. A weight table and a time scale are numbers,
// and "she holds the pose" is a claim about numbers.
// **BUT THE CLIPS AND THE ROLES ARE REAL.** An earlier version of this case invented its own
// clip durations AND its own "one stride is two clip lengths", so it reported a correct rate on
// a clip the game was playing at half speed -- a harness measuring a path the game does not
// take, which is this repo's oldest mistake. The samplers are not compressed, so the clips are
// read out of the file and handed to the SHIPPED `normaliseClips` and `clipRoles`: the loop
// mode, the stride count, the fallback and the solo flag are the game's own answers, and the
// case now covers every character on the roster rather than the one it was written for.
CASES.anim = () => {
  let ok = true;
  for (const C of rg.CHARS) {
    if (!fs.existsSync(C.file)) { console.log(`  ${C.key}: ${C.file} is not here`); ok = false; continue; }
    const { clips, R, moves } = gameClips(C.file);
    // A SKIN WITH A MOVE TABLE DOES NOT GO THROUGH THIS PATH IN THE GAME -- `girlAnim` hands it to
    // `girlAnimMoves` -- so it is tested by `npm run sim moves`, not here. Testing it here measured
    // the one-clip path on a 49-clip skin, with `back_flip` as its "solo" clip.
    if (moves) { console.log(`  ${C.key}: has a move table -- see the moves case`); continue; }
    const log = {};
    rg.girl.actions = {}; rg.girl.cw = {};
    for (const c of clips) {
      const a = { w: 0, ts: 1, running: 0, resets: 0,
        reset() { this.resets++; this.running = 1; return this; }, play() { this.running = 1; return this; },
        stop() { this.running = 0; return this; }, isRunning() { return !!this.running; },
        setEffectiveWeight(v) { this.w = v; return this; }, getEffectiveWeight() { return this.w; },
        setEffectiveTimeScale(v) { this.ts = v; return this; }, setLoop(m, n) { this.loop = m; return this; } };
      rg.girl.actions[c.name] = log[c.name] = a;
    }
    rg.girl.clipLen = R.len; rg.girl.cyc = R.cyc; rg.girl.fallback = R.fallback;
    rg.girl.solo = R.solo; rg.girl.ready = true;
    const drive = R.solo || 'skate_fwd';
    console.log(`  ${C.key}: ${clips.length} clip(s), ` + clips.map(c =>
        `${c.name} x${R.cyc[c.name]}${R.pp[c.name] ? ' pingpong' : ''}`).join(', ') +
      `; fallback ${R.fallback}${R.solo ? `, SOLO on ${R.solo}` : ''}`);
    // 1. STANDING STILL SHE MUST NOT BE IN THE BIND POSE. A table that names nothing she has
    // sums to zero, and a zero-weight bone is blended back to its bind value -- the T-pose.
    place(60, 1, -60, 0, 0);
    rg.stick.L.x = rg.stick.L.y = 0;
    run(0.6, () => { rg.girlAnim(DT); });
    let tot = 0; for (const k in log) tot += log[k].w;
    const held = R.solo ? log[drive].ts : 0;
    console.log(`    stopped: total weight ${fix(tot)} on ${Object.keys(log).filter(k => log[k].w > .2).join('+') || 'NOTHING'}` +
                (R.solo ? `, rate x${fix(held)}` : ''));
    if (tot < 0.9) { console.log('    -> THE T-POSE: nothing is driving her'); ok = false; }
    // a one-clip character holds a POSE at a standstill rather than skating on the spot
    if (R.solo && held > 0.02) { console.log('    -> skating on the spot'); ok = false; }
    // 2a. A ONE-CLIP CHARACTER ANIMATES AT HER SPEED, NEVER AT THE STICK. *"Even though she's
    // not technically going that fast, if you push the stick all the way she animates like she's
    // going really fast."* So: the same speed with the thumb pushing and with it off the stick
    // must give the same rate, and the rate must climb with speed. `girlAnim` is called with the
    // state set directly -- the question is what it does with a given speed, not how she got it.
    if (R.solo) {
      const rateAt = (spd, push) => {
        P.grounded = true; P.speed = spd; P.pushing = push; P.pushPeriod = rg.SK.pushFast;
        rg.girlAnim(DT); return log[drive].ts;
      };
      const rows = [2, 5, 10, 18, 24].map(v => [v, rateAt(v, true), rateAt(v, false)]);
      console.log('    rate by SPEED, thumb pushing / off: ' +
                  rows.map(([v, a, b]) => `${v} m/s x${fix(a)}/x${fix(b)}`).join('   '));
      if (rows.some(([, a, b]) => Math.abs(a - b) > 1e-6)) { console.log('    -> the STICK changes her animation rate'); ok = false; }
      if (rows.some(([, a], k) => k && a <= rows[k - 1][1])) { console.log('    -> the rate does not climb with speed'); ok = false; }
      if (rows[rows.length - 1][1] > 2.5) { console.log('    -> a cartoon scramble at top speed'); ok = false; }
      continue;
    }
    // 2. THE STRIDE. The clip's own cycle has to land on the stride period, or the feet and
    // the shove are on two clocks -- and a clip at a fifth speed is a drift into a pose. (This
    // is roller_girl's push, which really IS synced to the shoves; the alien's mocap is a
    // continuous cycle and is tested on speed above.)
    place(60, 1, -60, 0, 0);
    const rows = [];
    run(7, (t, i) => {
      follow(); rg.stick.L.y = -1; rg.stick.L.x = 0;
      rg.girlAnim(DT);
      if (i % 120 === 0) rows.push(`${fix(t,1)}s v${fix(P.speed,1)} push${P.pushing ? 1 : 0} ` +
        `[${Object.keys(log).filter(k => log[k].w > .05).map(k => `${k} ${fix(log[k].w)}`).join(' ') || '-'}] ` +
        `x${fix(log[drive].ts)} period ${fix(P.pushPeriod)}`);
    });
    for (const r of rows) console.log('    ' + r);
    const ts = log[drive].ts, cyc = R.len[drive] / ts * (R.cyc[drive] || 1);
    console.log(`    ${drive}: ${fix(R.len[drive], 3)}s of clip x${fix(ts)} -> ${fix(cyc)}s per stride ` +
                `against a ${fix(P.pushPeriod)}s stride, ${log[drive].resets} rewinds in 7 s`);
    if (ts < 0.3) { console.log('    -> slow motion'); ok = false; }
    if (Math.abs(cyc - P.pushPeriod) > 0.02) { console.log('    -> the cycle does not match the stride'); ok = false; }
    // A CLIP REWOUND EVERY FRAME NEVER GETS PAST ITS FIRST KEY, which is a held pose exactly.
    if (log[drive].resets > 20) { console.log('    -> rewound every frame'); ok = false; }
  }
  return ok;
};

// ---------------------------------------------------------------- the tail
// THE SHIPPED `tailFind` AND `tailStep`, ON A FABRICATED CHAIN CARRYING THE REAL BONE OFFSETS
// read out of his export. The skin cannot be built here, and it does not have to be: the tail
// is a chain of `THREE.Bone` objects and the solver only ever reads their offsets and their
// world matrices, so everything that can be wrong about it -- the lengths, the anchor, the
// floor, the conversion back to quaternions -- is reachable.
// What is NOT covered is how it LOOKS against the Cinema 4D version, which is the whole reason
// it is being shipped for him to judge, and the baked-vs-procedural switch, which needs a clip
// that actually drives those bones.
CASES.tail = () => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const C = rg.CHARS.find(c => /alien/.test(c.key));
  if (!fs.existsSync(C.file)) { console.log(`  ${C.file} is not here`); return false; }
  const g = readGLB(C.file);
  // the chain straight out of the file: single matching child each step, offsets in armature
  // units, which is exactly what the game's own bone graph hands `tailFind`
  const N = g.json.nodes, kid = {};
  N.forEach((n, i) => (n.children || []).forEach(c => (kid[i] = kid[i] || []).push(c)));
  let root = N.findIndex(n => n.name === 'tail');
  if (root < 0) { console.log('  no `tail` node in the file'); return false; }
  const chain = [root];
  for (;;) {
    const nx = (kid[chain[chain.length - 1]] || []).find(c => /^tail/.test(N[c].name || ''));
    if (nx === undefined) break;
    chain.push(nx);
  }
  console.log(`  ${chain.length} bones: ${chain.map(i => N[i].name).join(' ')}`);
  // rebuild it as bones under a root group, the way the loader would, and SCALE the armature
  // the way the game does (0.01 in the file, then girl.scale on top)
  const hips = new THREE.Bone(); hips.name = 'mixamorig_Hips';
  const arm = new THREE.Group(); arm.scale.setScalar(0.01 * 1.70);
  arm.add(hips);
  const holder = new THREE.Group(); holder.add(arm);
  rg.scene.add(holder);
  let par = hips;
  for (const i of chain) {
    const b = new THREE.Bone(); b.name = N[i].name;
    const t = N[i].translation || [0, 0, 0], q = N[i].rotation;
    b.position.set(t[0], t[1], t[2]);
    if (q) b.quaternion.set(q[0], q[1], q[2], q[3]);
    par.add(b); par = b;
  }
  // TWO LEG BONES, so the body capsules have something to find. They hang off the holder rather
  // than the hips and are placed by world position later -- this case is about the collision,
  // not about where a leg is.
  const legA = new THREE.Bone(); legA.name = 'mixamorig_LeftUpLeg';
  const legB = new THREE.Bone(); legB.name = 'mixamorig_LeftLeg';
  holder.add(legA); holder.add(legB);
  legA.position.set(0, -50, 0); legB.position.set(0.01, -50, 0);     // out of the way for now
  rg.girl.tail = rg.tailFind(holder, []);
  const T = rg.girl.tail;
  if (T.n !== chain.length) { console.log(`  tailFind found ${T.n}, the file has ${chain.length}`); return false; }
  if (T.baked > 0.01) { console.log(`  tailFind says ${T.baked} deg of animation with no clips handed to it`); return false; }
  if (T.caps.length !== 1) { console.log(`  tailFind found ${T.caps.length} body capsules, the rig has 1`); return false; }
  let ok = true;
  // THIS CASE IS THE PHYSICS MODE. The default is 'wave' since r19, and every `Object.assign(rg.TAIL,
  // save)` below restores whatever `save` caught -- so the mode is set BEFORE it is caught.
  const modeWas = rg.TAIL.mode; rg.TAIL.mode = 'sim';
  const save = { ...rg.TAIL };
  const CH = () => T.len.reduce((a, b) => a + b, 0);
  const shown = () => { let w = 0; for (let k = 1; k <= T.n; k++) w = Math.max(w, T.G[k].distanceTo(T.D[k])); return w; };
  const simOff = () => { let w = 0; for (let k = 1; k <= T.n; k++) w = Math.max(w, T.G[k].distanceTo(T.P[k])); return w; };
  // 1. RIGID, IT REPRODUCES THE AUTHORED POSE. The self-consistency check the whole design rests
  // on: the goals ARE the rest pose, so a sim held hard to them must land on them.
  Object.assign(rg.TAIL, { posHold: 1, posK: 4000, damping: 40, grav: 0, rotHold: 0, strength: 1, pin: 0 });
  holder.position.set(60, 40, -60);
  for (let i = 0; i < 180; i++) rg.tailStep(1 / 60);
  console.log(`  rigid: worst point ${fix(simOff(), 4)} m off the authored pose, chain ${fix(CH(), 3)} m long`);
  if (simOff() > 0.02) { console.log('  -> the sim does not reproduce the pose it is given'); ok = false; }
  Object.assign(rg.TAIL, save);
  // 2. THE LENGTHS ARE HARD, AND THE PINNED BONES ARE THE ANIMATION'S. Whatever she is thrown
  // through, the tail may not stretch, and the first `pin` bones may not move off the pose.
  let stretch = 0, pinOff = 0, kink0 = 0, kink1 = 0;
  // HOW KINKED: each segment's bend against its parent, compared with the AUTHORED bend there.
  // A zig-zag is exactly what position hold alone allows and rotation hold exists to stop.
  // Measured as the 95th PERCENTILE over a skater's turn, not the single worst frame of a paint
  // shaker: the first version took the max across ten seconds of violent shaking and read 166
  // against 161, which is one extreme frame and says nothing about whether the curve holds.
  const kinks = (out) => {
    for (let k = Math.max(2, rg.TAIL.pin + 1); k <= T.n; k++) {
      const a = T.P[k - 1].clone().sub(T.P[k - 2]).normalize(), b = T.P[k].clone().sub(T.P[k - 1]).normalize();
      const ga = T.G[k - 1].clone().sub(T.G[k - 2]).normalize(), gb = T.G[k].clone().sub(T.G[k - 1]).normalize();
      out.push(Math.abs(Math.acos(clamp(a.dot(b), -1, 1)) - Math.acos(clamp(ga.dot(gb), -1, 1))) * 57.3);
    }
  };
  for (let i = 0; i < 600; i++) {
    const t = i / 60;
    holder.position.set(60 + Math.sin(t * 6) * 3, 40 + Math.sin(t * 9) * 2, -60 + Math.cos(t * 7) * 3);
    holder.rotation.y = Math.sin(t * 5) * 2;
    rg.tailStep(1 / 60);
    for (let k = 0; k < T.n; k++) stretch = Math.max(stretch, Math.abs(T.P[k].distanceTo(T.P[k + 1]) - T.len[k]) / T.len[k]);
    for (let k = 0; k <= Math.min(T.n, rg.TAIL.pin); k++) pinOff = Math.max(pinOff, T.P[k].distanceTo(T.G[k]));
  }
  // BOTH ends of the rotation-hold gradient go to zero for the baseline -- zeroing only the root
  // value left a stiff TIP in the "no rotation hold" run and the comparison measured nothing.
  const turnKink = (rot) => {
    rg.TAIL.rotHold = rot; rg.TAIL.rotTip = rot ? save.rotTip : 0;
    holder.position.set(60, 40, -60); holder.rotation.y = 0; T.live = 0;
    for (let i = 0; i < 120; i++) rg.tailStep(1 / 60);
    const all = [];
    for (let i = 0; i < 300; i++) { holder.rotation.y = Math.sin(i / 60 * 2.2) * 0.8; rg.tailStep(1 / 60); kinks(all); }
    all.sort((a, b) => a - b);
    return all[Math.floor(all.length * 0.95)];
  };
  kink0 = turnKink(0); kink1 = turnKink(save.rotHold);
  rg.TAIL.rotHold = save.rotHold; rg.TAIL.rotTip = save.rotTip; holder.rotation.y = 0;
  console.log(`  thrown about for 10 s: worst segment ${fix(stretch * 100, 2)}% off its length, ` +
              `pinned bones ${fix(pinOff, 5)} m off the pose`);
  console.log(`  kinking against the authored curve through a turn (95th pct): ${fix(kink0, 1)} deg ` +
              `with no rotation hold, ${fix(kink1, 1)} deg at rotHold ${save.rotHold} -> ${save.rotTip}`);
  if (stretch > 0.02) { console.log('  -> it stretches'); ok = false; }
  if (pinOff > 1e-4) { console.log('  -> the pinned bones are not following the animation'); ok = false; }
  if (!(kink1 < kink0 * 0.8)) { console.log('  -> rotation hold does not hold the curve'); ok = false; }
  // 3. IT SWINGS AND RECOVERS -- clear of the park and ACCELERATED rather than stepped, after
  // three probe faults here that each read as a solver that cannot recover (the tail dragging
  // on the plaza, a dash into the 6.6 m perimeter berm, and 0 -> 7.2 m/s in one frame).
  holder.position.set(20, 30, -60);
  T.live = 0;
  for (let i = 0; i < 240; i++) rg.tailStep(1 / 60);
  let swing = 0, settled = 0, vtip = 0, seen = 0, x = 20;
  for (let i = 0; i < 300; i++) {
    x += 7.2 * Math.min(1, i / 30) / 60;
    holder.position.x = x;
    rg.tailStep(1 / 60);
    vtip = Math.max(vtip, T.V[T.n].length());
    swing = Math.max(swing, simOff()); seen = Math.max(seen, shown());
    if (i > 240) settled = Math.max(settled, simOff());
  }
  console.log(`  dash to 7.2 m/s: the sim swung ${fix(swing, 3)} m and settled to ${fix(settled, 3)}; ` +
              `SHOWN at strength ${rg.TAIL.strength} that is ${fix(seen, 3)} m; tip ${fix(vtip, 1)} m/s ` +
              `(chain ${fix(CH(), 3)} m)`);
  if (swing < 0.05) { console.log('  -> it does not move independently at all'); ok = false; }
  if (settled > CH() * 0.45) { console.log('  -> it never recovers'); ok = false; }
  // energy arriving from nowhere shows up as the tip outrunning her absurdly, which on screen
  // is a snap
  if (vtip > 40) { console.log('  -> the tip is carrying energy from nowhere'); ok = false; }
  // the shown chain is the authored one moved `strength` of the way: it cannot exceed the sim
  if (seen > swing + 1e-6) { console.log('  -> strength shows MORE than the simulation did'); ok = false; }
  // 3b. AT A STEADY SPEED, WITH NOTHING PUSHING ON IT, IT SITS EXACTLY ON THE POSE. The spring
  // used to compare this frame's goal against last frame's position, so a tail tracking her
  // perfectly read one frame of travel as error and was shoved by exactly that -- 0.432 m at
  // 24 m/s, speed x 1/60 s to the millimetre, from r14 to r17. Ramped up at her own rate, then
  // read over the last second of a four-second cruise.
  Object.assign(rg.TAIL, { air: 0, grav: 0 });
  holder.position.set(-400, 30, -60); holder.rotation.y = 0; T.live = 0;
  for (let i = 0; i < 60; i++) rg.tailStep(1 / 60);
  let cx = -400, cu = 0, cruise = 0;
  while (cu < 24) { cu = Math.min(24, cu + 5 / 60); cx += cu / 60; holder.position.x = cx; rg.tailStep(1 / 60); }
  for (let i = 0; i < 240; i++) { cx += 24 / 60; holder.position.x = cx; rg.tailStep(1 / 60); if (i >= 180) cruise = Math.max(cruise, simOff()); }
  Object.assign(rg.TAIL, save);
  console.log(`  cruising at 24 m/s with no air and no gravity: ${fix(cruise, 4)} m off the pose`);
  if (cruise > 0.01) { console.log('  -> the spring is reading her travel as error'); ok = false; }
  // 4. IT STAYS OUT OF THE FLOOR, at twice gravity on purpose.
  holder.position.set(60, 0.9, -60);
  T.live = 0; rg.TAIL.grav = 2;
  let under = 0, lowest = 0;
  for (let i = 0; i < 300; i++) {
    rg.tailStep(1 / 60);
    for (let k = 1; k <= T.n; k++) {
      const gr = rg.groundAt(T.P[k].x, T.P[k].z, T.P[k].y, 0.4);
      if (gr.hit) { lowest = Math.min(lowest, T.P[k].y - gr.floor); if (T.P[k].y < gr.floor - 0.01) under++; }
    }
  }
  Object.assign(rg.TAIL, save);
  console.log(`  held over the plaza at 2x gravity: ${under} point-frames through the floor, lowest ${fix(lowest, 3)} m`);
  if (under) { console.log('  -> it goes through the ground'); ok = false; }
  // 5. AND IT STAYS OUT OF HER. A leg capsule laid across just under the middle of the tail,
  // clear of its AUTHORED pose, and the tail made heavy and loose so it falls onto it. The test
  // has to show CONTACT as well as no penetration -- a tail that never reached the capsule
  // passes "nothing went through" without the collider having done a thing.
  holder.position.set(60, 30, -60); holder.rotation.y = 0;
  T.live = 0; rg.tailStep(1 / 60);
  const m = T.G[Math.round(T.n * 0.55)].clone();
  holder.updateWorldMatrix(true, false);
  const inv = holder.matrixWorld.clone().invert();
  legA.position.copy(m.clone().add(new THREE.Vector3(-0.4, -0.14, 0)).applyMatrix4(inv));
  legB.position.copy(m.clone().add(new THREE.Vector3(0.4, -0.14, 0)).applyMatrix4(inv));
  Object.assign(rg.TAIL, { grav: 3, posHold: 0.05 });
  T.live = 0;
  let pen = 0, touch = 0;
  const c = T.caps[0];
  for (let i = 0; i < 300; i++) {
    rg.tailStep(1 / 60);
    for (let k = rg.TAIL.pin + 1; k <= T.n; k++) {
      const dG = rg.capDist(T.G[k], c.A, c.B, new THREE.Vector3());
      if (dG < c.R) continue;                          // authored inside: not ours, by design
      const d = rg.capDist(T.P[k], c.A, c.B, new THREE.Vector3());
      pen = Math.max(pen, c.R - d);
      if (d < c.R + 0.02) touch++;
    }
  }
  Object.assign(rg.TAIL, save);
  legA.position.set(0, -50, 0); legB.position.set(0.01, -50, 0);
  console.log(`  dropped onto a leg capsule: ${touch} point-frames in contact, deepest ${fix(Math.max(0, pen), 4)} m inside`);
  if (!touch) { console.log('  -> it never reached the capsule, so this proved nothing'); ok = false; }
  if (pen > 0.01) { console.log('  -> it goes through her'); ok = false; }
  // 6. AND THE BONES ACTUALLY TURNED. Every number above is about the POINTS; a broken
  // conversion back to quaternions passes all of them while nothing on screen moves.
  const q0 = T.bones.map(b => b.quaternion.clone());
  holder.position.set(60, 30, -60); T.live = 0;
  for (let i = 0; i < 120; i++) { holder.position.x = 60 + i * 0.15; rg.tailStep(1 / 60); }
  let turn = 0;
  for (let i = 0; i < T.n; i++) turn = Math.max(turn, 2 * Math.acos(Math.min(1, Math.abs(q0[i].dot(T.bones[i].quaternion)))) * 180 / Math.PI);
  console.log(`  bones written: worst ${fix(turn, 1)} deg away from where the last case left them`);
  if (turn < 1) { console.log('  -> the points moved and the BONES did not'); ok = false; }
  rg.TAIL.mode = modeWas;
  rg.scene.remove(holder); rg.girl.tail = null;
  return ok;
};

// ---------------------------------------------------------------- the tail, his way
// HIS VISUALIZER'S METHOD -- every joint easing toward where its parent carries it, slower toward
// the tip -- on the same fabricated chain carrying the real bone offsets. No physics, so the
// checks are about the SHAPE of the response: it holds the pose at rest, a wiggle at the root
// arrives at the tip, a long spin is capped, and the frame rate does not change any of it.
CASES.wave = () => {
  const C = rg.CHARS.find(c => /alien/.test(c.key));
  if (!fs.existsSync(C.file)) { console.log(`  ${C.file} is not here`); return false; }
  const g = readGLB(C.file), N = g.json.nodes, kid = {};
  N.forEach((n, i) => (n.children || []).forEach(c => (kid[i] = kid[i] || []).push(c)));
  const chain = [N.findIndex(n => n.name === 'tail')];
  for (;;) { const nx = (kid[chain[chain.length - 1]] || []).find(c => /^tail/.test(N[c].name || '')); if (nx === undefined) break; chain.push(nx); }
  const hips = new THREE.Bone(); hips.name = 'mixamorig_Hips';
  const arm = new THREE.Group(); arm.scale.setScalar(0.01 * 1.70); arm.add(hips);
  const holder = new THREE.Group(); holder.add(arm); rg.scene.add(holder);
  let par = hips;
  for (const i of chain) { const b = new THREE.Bone(); b.name = N[i].name;
    const t = N[i].translation || [0, 0, 0], q = N[i].rotation;
    b.position.set(t[0], t[1], t[2]); if (q) b.quaternion.set(q[0], q[1], q[2], q[3]); par.add(b); par = b; }
  const T = rg.girl.tail = rg.tailFind(holder, []);
  const modeWas = rg.TAIL.mode; rg.TAIL.mode = 'wave';
  const saveAll = { ...rg.TAIL };
  // THE CASCADE IS TESTED WITH THE DRIVERS OFF, then the drivers on their own: with a sway on,
  // "standing still is the authored pose" is false by design and the check would measure the sway.
  Object.assign(rg.TAIL, { sway: 0, turnSwing: 0, lift: 0, speedLift: 0 });
  const save = { ...rg.TAIL };
  let ok = true;
  const run = (sec, dt, f) => { const k = Math.round(sec / dt); for (let i = 0; i < k; i++) { if (f) f(i * dt); rg.tailStep(dt); } };
  const reset = (dt) => { holder.position.set(20, 30, -60); holder.rotation.y = 0; T.waveLive = 0; run(1, dt); };
  const shown = () => { let w = 0; for (let k = 1; k <= T.n; k++) w = Math.max(w, T.G[k].distanceTo(T.D[k])); return w; };
  // 1. STANDING STILL IT IS THE AUTHORED POSE, EXACTLY. An ease with nothing moving settles on
  // its target, and with gravity out of the picture there is nothing else for it to settle on.
  reset(1 / 60); run(2, 1 / 60);
  console.log(`  at rest: ${fix(shown(), 5)} m off the authored pose`);
  if (shown() > 1e-4) { console.log('  -> it does not settle on the pose'); ok = false; }
  // 2. HER STRIDE'S HIP TWIST SENDS A WAVE DOWN IT -- +-10 deg at 0.8 Hz, which is what her
  // mocap does every stride -- and the motion GROWS toward the tip, rather than the base and
  // the middle sitting still under a floppy end.
  reset(1 / 60);
  const pk = new Array(T.n + 1).fill(0);
  run(5, 1 / 60, t => { holder.rotation.y = 0.18 * Math.sin(t * 2 * Math.PI * 0.8);
    if (t > 2) for (let k = 0; k <= T.n; k++) pk[k] = Math.max(pk[k], T.G[k].distanceTo(T.D[k])); });
  const tip = pk[T.n], half = pk[Math.round(T.n / 2)];
  console.log(`  stride hip twist: tip moves ${fix(tip, 3)} m, the middle ${fix(half, 3)} m -- along the tail ` +
              pk.slice(1).map(v => Math.round(v / Math.max(1e-6, tip) * 9)).join(''));
  if (tip < 0.02) { console.log('  -> the stride does not reach the tail'); ok = false; }
  if (half < tip * 0.2) { console.log('  -> a stick with a floppy end: the middle is not moving'); ok = false; }
  // 3. THE FRAME RATE DOES NOT CHANGE IT. The same turn at 60 and at 20 Hz -- the first version
  // eased once per frame and moved 22% LESS at 20 Hz, because its targets move every frame.
  const turnAt = (dt) => { reset(dt); let w = 0; run(5, dt, t => { holder.rotation.y = 0.8 * Math.sin(t * 2.2); w = Math.max(w, shown()); }); return w; };
  const t60 = turnAt(1 / 60), t20 = turnAt(1 / 20);
  console.log(`  a skater's turn: tip moves ${fix(t60, 3)} m at 60 Hz, ${fix(t20, 3)} m at 20 Hz`);
  if (Math.abs(t20 - t60) > t60 * 0.05) { console.log('  -> the frame rate changes the tail'); ok = false; }
  // and with every driver ON -- they are differenced and smoothed per frame, so they are exactly
  // the kind of thing that quietly depends on the frame rate
  Object.assign(rg.TAIL, saveAll, { mode: 'wave' });
  const d60 = turnAt(1 / 60), d20 = turnAt(1 / 20);
  Object.assign(rg.TAIL, save);
  console.log(`  ...with the drivers on: ${fix(d60, 3)} m at 60 Hz, ${fix(d20, 3)} m at 20 Hz`);
  if (Math.abs(d20 - d60) > d60 * 0.08) { console.log('  -> the drivers change with the frame rate'); ok = false; }
  // 4. A LONG FAST SPIN IS CAPPED -- eases accumulate down a chain, so without `waveMax` a spin
  // curls the tail round on itself.
  reset(1 / 60);
  let a = 0, lag = 0;
  run(2, 1 / 60, () => { a += 5 / 60; holder.rotation.y = a; });
  for (let i = 0; i < T.n; i++) lag = Math.max(lag, T.bones[i].quaternion.angleTo(T.rest[i]) * 57.3);
  console.log(`  spinning at 5 rad/s: worst joint ${fix(lag, 1)} deg off its authored rotation (cap ${rg.TAIL.waveMax})`);
  if (lag > rg.TAIL.waveMax + 0.5) { console.log('  -> the cap does not hold'); ok = false; }
  // 5. THE CHAIN AS DRAWN KEEPS ITS LENGTHS -- it is rotations only, so anything else is the
  // conversion back to bone space being wrong -- AND FLIPPING MODES MID-RUN IS CLEAN.
  let bad = 0;
  for (let k = 0; k < T.n; k++) if (Math.abs(T.D[k].distanceTo(T.D[k + 1]) - T.len[k]) > 1e-4) bad++;
  rg.TAIL.mode = 'sim'; run(0.5, 1 / 60, t => { holder.rotation.y = a + t; });
  rg.TAIL.mode = 'wave'; run(0.5, 1 / 60, t => { holder.rotation.y = a - t; });
  const nan = T.bones.some(b => !Number.isFinite(b.quaternion.x + b.quaternion.y + b.quaternion.z + b.quaternion.w));
  console.log(`  drawn segments off their length: ${bad}; wave -> sim -> wave: ${nan ? 'NaN' : 'clean'}`);
  if (bad || nan) ok = false;
  // 6. THE DRIVERS, ONE AT A TIME, AND THEIR SIGNS -- which were MEASURED here rather than
  // derived, because this file gets handedness backwards half the time when it argues.
  const planAng = P => { const v = P[T.n].clone().sub(P[0]); return Math.atan2(v.x, v.z); };
  // the sway moves it with nobody moving at all -- his waveform at the base
  Object.assign(rg.TAIL, save, { sway: saveAll.sway, swayHz: saveAll.swayHz }); reset(1 / 60);
  let sw = 0; run(6, 1 / 60, t => { if (t > 1.5) sw = Math.max(sw, T.D[T.n].distanceTo(T.G[T.n])); });
  // a turn flings it OUT behind the turn: turning +, the tail sits at a NEGATIVE bearing
  Object.assign(rg.TAIL, save, { turnSwing: 20, waveRoot: 60, waveTip: 60 }); reset(1 / 60);
  let ya = 0; run(2, 1 / 60, () => { ya += 1 / 60; holder.rotation.y = ya; });
  const out = Math.atan2(Math.sin(planAng(T.D) - planAng(T.G)), Math.cos(planAng(T.D) - planAng(T.G))) * 57.3;
  // speed LIFTS it: cruising forward (the tail points -z, so forward is +z) the tip goes UP
  Object.assign(rg.TAIL, save, { speedLift: 1.5 });
  holder.position.set(0, 30, -300); holder.rotation.y = 0; T.waveLive = 0; run(0.5, 1 / 60);
  let zz = -300; run(4, 1 / 60, () => { zz += 10 / 60; holder.position.z = zz; });
  const rise = T.D[T.n].y - T.G[T.n].y;
  console.log(`  drivers: sway moves the tip ${fix(sw, 3)} m standing still; turning +1 rad/s puts it at ` +
              `${fix(out, 1)} deg (flung out behind); cruising at 10 m/s lifts the tip ${fix(rise, 3)} m`);
  if (sw < 0.02) { console.log('  -> the sway does not reach the tail'); ok = false; }
  if (!(out < -3)) { console.log('  -> a turn does not fling it out behind'); ok = false; }
  if (!(rise > 0.02)) { console.log('  -> speed does not lift it'); ok = false; }
  Object.assign(rg.TAIL, saveAll); rg.TAIL.mode = modeWas;
  rg.scene.remove(holder); rg.girl.tail = null;
  return ok;
};

// ---------------------------------------------------------------- the tail panel
// HE TUNES ON A PHONE WITH NO CONSOLE, SO THE PANEL IS THE ONLY WAY ANY DIAL GETS MOVED. Built
// and driven through the stub's real listeners: a slider dragged with a synthesised thumb, the
// mode buttons, RESET, and a reload of a saved store that has junk in it. Its first run found the
// panel never clearing itself between modes -- `firstChild` does not exist on the stub, and the
// clear loop is now written against `children`, which both the stub and a browser have.
CASES.panel = () => {
  const P = document.getElementById('tailP'), keep = { ...rg.TAIL }, store = localStorage.getItem('rg.tail');
  let ok = true;
  const rows = () => P.children.filter(c => c.className === 'row');
  const click = b => (b._h.click || []).forEach(f => f({}));
  Object.assign(rg.TAIL, rg.TAIL_DEF); rg.tailPanel();
  const nWave = rows().length;
  // r69: THE LEVEL KEY opens a picker of the three worlds on its own; tapped again it closes
  { const wk = document.getElementById('worldB'), down = () => (wk._h.pointerdown || []).forEach(f => f({ preventDefault() {}, stopPropagation() {} }));
    down(); const wb = P.children.filter(c => c.className && c.className.startsWith('wbtn')).map(b => b.textContent);
    const open1 = P.classList.contains('on'); down(); const shut = !P.classList.contains('on');
    const okW = open1 && shut && wb.length === 4 && ['SKATE PARK', 'SK8 SKY', 'RAMP KIT PARK', 'HIS ZONES'].every(t => wb.some(x => x.includes(t)));
    console.log(`  LEVEL key: opens ${open1 ? 'yes' : 'NO'}, ${wb.length} worlds (${wb.map(x => x.split(/[a-z]/)[0].trim()).join(' / ')}), closes on a second tap ${shut ? 'yes' : 'NO'}`); if (!okW) ok = false;
    rg.tailPanel(); }
  const wb = P.children.filter(c => c.className === 'btns').flatMap(c => c.children || []).map(b => b.textContent);
  const wOk = ['SKATE PARK', 'SK8 SKY', 'RAMP KIT PARK', 'HIS ZONES'].every(t => wb.includes(t));
  console.log(`  WORLD buttons at the top: ${wOk ? 'SKATE PARK / SK8 SKY / RAMP KIT PARK / HIS ZONES' : 'MISSING (' + wb.join(', ') + ')'}`); if (!wOk) ok = false;
  const sway = rows().find(r => r.children[0].textContent === 'Sway');
  if (!sway) { console.log('  -> no Sway slider in wave mode'); return false; }
  const trk = sway.children[1];
  const fire = (t, x) => (trk._h[t] || []).forEach(f => f({ type: t, pointerId: 7, clientX: x, preventDefault() {}, stopPropagation() {} }));
  fire('pointerdown', 150); fire('pointermove', 225); fire('pointerup', 225);
  const saved = JSON.parse(localStorage.getItem('rg.tail') || '{}');
  console.log(`  wave mode: ${nWave} sliders; Sway dragged to 75% -> ${rg.TAIL.sway}, saved ${saved['TAIL.sway']}`);
  if (rg.TAIL.sway !== 34 || saved['TAIL.sway'] !== 34) ok = false;
  // A DEGREES ROW STORES RADIANS. Landing window runs 20..85 deg, so the middle of the track is
  // 52.5 deg -> 53 at a step of 1 -> 0.925 rad. Shown as 53, stored as 0.925: if the units were
  // crossed the landing check would be handed 53 RADIANS and nothing would ever bail.
  const land = rows().find(r => r.children[0].textContent === 'Landing window');
  const lt = land.children[1], lfire = (t, x) => (lt._h[t] || []).forEach(f => f({ type: t, pointerId: 8, clientX: x, preventDefault() {}, stopPropagation() {} }));
  lfire('pointerdown', 150); lfire('pointerup', 150);
  console.log(`  Landing window to mid-track -> shows ${land.children[2].textContent}, LAND.ok = ${fix(rg.LAND.ok, 3)} rad`);
  if (Math.abs(rg.LAND.ok - 53 * Math.PI / 180) > 1e-6 || land.children[2].textContent !== '53') ok = false;
  // r68: the WORLD buttons sit above the modes now -- find the row by its button, not its position
  const modeRow = P.children.find(c => c.className === 'btns' && (c.children || []).some(b => b.textContent === 'PHYSICS'));
  click(modeRow.children.find(b => b.textContent === 'PHYSICS'));
  const simRows = rows().map(r => r.children[0].textContent);
  console.log(`  PHYSICS: mode ${rg.TAIL.mode}, ${simRows.length} sliders, Sway still shown: ${simRows.includes('Sway')}`);
  if (rg.TAIL.mode !== 'sim' || simRows.includes('Sway') || !simRows.includes('Strength')) ok = false;
  if (new Set(simRows).size !== simRows.length) { console.log('  -> a slider appears twice'); ok = false; }
  click(P.children[P.children.length - 1].children[0]);
  console.log(`  RESET: mode ${rg.TAIL.mode}, sway ${rg.TAIL.sway} (shipped ${rg.TAIL_DEF.sway}), landing window ${fix(rg.LAND.ok * 180 / Math.PI, 0)} deg (shipped ${fix(rg.UI_DEF['LAND.ok'] * 180 / Math.PI, 0)})`);
  if (rg.TAIL.mode !== rg.TAIL_DEF.mode || rg.TAIL.sway !== rg.TAIL_DEF.sway || rg.LAND.ok !== rg.UI_DEF['LAND.ok']) ok = false;
  localStorage.setItem('rg.tail', JSON.stringify({ mode: 'sim', sway: 7, waveRoot: 'junk', pin: null }));
  rg.tailLoad();
  console.log(`  a saved store with junk in it: mode ${rg.TAIL.mode}, sway ${rg.TAIL.sway}, waveRoot ${rg.TAIL.waveRoot}, pin ${rg.TAIL.pin}`);
  if (rg.TAIL.mode !== 'sim' || rg.TAIL.sway !== 7 || rg.TAIL.waveRoot !== rg.TAIL_DEF.waveRoot || rg.TAIL.pin !== rg.TAIL_DEF.pin) ok = false;
  Object.assign(rg.TAIL, keep); rg.LAND.ok = rg.UI_DEF['LAND.ok'];
  if (store == null) localStorage.removeItem('rg.tail'); else localStorage.setItem('rg.tail', store);
  return ok;
};

// ---------------------------------------------------------------- a mirrored clip
// THE SHIPPED `mirrorClip` ON HIS REAL SKELETON. The bones are rebuilt from the GLB's own nodes
// (the skeleton needs no mesh, so draco never comes into it), posed twice -- once by a clip, once
// by its mirror -- and every joint is checked against its partner on the other side, reflected
// across her centre plane. A mirror that is right on one rig and wrong on another (which is what
// reflecting raw local quaternions is) fails here rather than on the phone as a twisted spine.
CASES.mirror = () => {
  const f = 'models/alien_rollerskate_blue.glb';
  if (!fs.existsSync(f)) { console.log(`  ${f} is not here`); return false; }
  const g = readGLB(f), J = g.json;
  const build = () => skelFromGLB(J);
  const clips = rg.normaliseClips(buildClips(g, THREE));
  const A = build(), B = build();
  // the rest pose must itself be symmetric for a mirror to mean anything
  const names = Object.keys(A.by).filter(n => /mixamorig_/.test(n));
  let restAsym = 0;
  for (const n of names) { const m = rg.mirrorName(n); if (!A.by[m]) continue;
    const a = new THREE.Vector3().setFromMatrixPosition(A.by[n].matrixWorld), b = new THREE.Vector3().setFromMatrixPosition(A.by[m].matrixWorld);
    restAsym = Math.max(restAsym, Math.hypot(a.x + b.x, a.y - b.y, a.z - b.z)); }
  let ok = true, worstAll = 0;
  const test = ['front_twist_flip', 'blade_medium_forward', 'blade_onefootfront_L_forward', 'fall_to_knees'];
  for (const nm of test) {
    const clip = clips.find(c => c.name === nm); if (!clip) { console.log(`  ${nm}: not in the file`); ok = false; continue; }
    const mir = rg.mirrorClip(clip, build().root, nm + '__mirror');
    const mA = new THREE.AnimationMixer(A.root), mB = new THREE.AnimationMixer(B.root);
    const aA = mA.clipAction(clip), aB = mB.clipAction(mir); aA.play(); aB.play();
    let worst = 0;
    for (const t of [0, 0.21, 0.5, 0.77, 0.99]) {
      aA.time = aB.time = t * clip.duration; mA.update(0); mB.update(0);
      A.root.updateMatrixWorld(true); B.root.updateMatrixWorld(true);
      for (const n of names) { const m = rg.mirrorName(n); if (!B.by[m]) continue;
        const a = new THREE.Vector3().setFromMatrixPosition(A.by[n].matrixWorld), b = new THREE.Vector3().setFromMatrixPosition(B.by[m].matrixWorld);
        worst = Math.max(worst, Math.hypot(a.x + b.x, a.y - b.y, a.z - b.z)); }
    }
    mA.stopAllAction(); mB.stopAllAction();
    worstAll = Math.max(worstAll, worst);
    console.log(`  ${nm.padEnd(30)} worst joint ${fix(worst * 1000, 2)} mm off its partner, reflected (body is 1000 mm)`);
  }
  console.log(`  rest pose itself: worst ${fix(restAsym * 1000, 2)} mm asymmetric`);
  if (worstAll > restAsym + 0.002) { console.log('  -> the mirror does not mirror'); ok = false; }
  return ok;
};

// ---------------------------------------------------------------- stance, landings, flips, bails
// THE SHIPPED PHYSICS WITH `stanceLock` ON, as it is for a skin with backward clips. Each row puts
// her in the air over open plaza (x = 60, no ramps) and lets the real `stepPlayer` land her.
CASES.stance = () => {
  const { moves } = gameClips('models/alien_rollerskate_blue.glb');
  const keep = { moves: rg.girl.moves, lock: P.stanceLock, bail: rg.LAND.bail };
  rg.girl.moves = moves; P.stanceLock = true;
  rg.LAND.bail = 1;                       // the rows below test the bail MECHANISM; r23 ships it off
  let ok = true;
  const drop = (heading, travel, speed, setup) => {
    place(60, 1, -40, heading, 0);
    P.grounded = false; P.pos.y += 2.5; P.airT = 0.3;
    P.vel.set(Math.sin(travel) * speed, 0, Math.cos(travel) * speed);
    P.bq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    if (setup) setup();
    let landed = false, b0 = P.bailId;
    run(2, () => { rg.stick.L.x = rg.stick.L.y = 0; if (!landed && P.grounded) landed = true; });
    return { landed, stance: P.stance, bail: P.bailId !== b0, v: Math.hypot(P.vel.x, P.vel.z) };
  };
  const D = Math.PI / 180;
  const rows = [
    ['facing where she travels', 0, 0, 8, r => r.stance === 1 && !r.bail],
    ['30 deg off the nose', 30 * D, 0, 8, r => r.stance === 1 && !r.bail],
    ['spun 180 -- back first', Math.PI, 0, 8, r => r.stance === -1 && !r.bail],
    ['150 deg -- still fakie', 150 * D, 0, 8, r => r.stance === -1 && !r.bail],
    ['SIDEWAYS, 90 deg', 90 * D, 0, 8, r => r.bail],
    ['sideways but barely moving', 90 * D, 0, 1, r => !r.bail],
  ];
  for (const [label, h, tr, v, want] of rows) {
    const r = drop(h, tr, v);
    const good = r.landed && want(r);
    console.log(`  ${label.padEnd(28)} -> ${r.bail ? 'BAIL' : r.stance > 0 ? 'forward' : 'FAKIE'}, ${fix(r.v, 1)} m/s after${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
  }
  // a flip with enough air lands; one cut short by the ground is a bail
  const flip = (h0, label, wantBail) => {
    const r = drop(0, 0, 6, () => { P.pos.y += h0; P.vel.y = 4; if (!rg.startFlip('up')) console.log('  (startFlip refused)'); });
    const good = r.landed && r.bail === wantBail;
    console.log(`  ${label.padEnd(28)} -> ${r.bail ? 'BAIL' : 'landed it'}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
  };
  flip(3, 'front flip from high up', false);
  // too little air is NO flip at all, not a guaranteed bail
  { place(60, 1, -40, 0, 6); P.grounded = false; P.pos.y += 0.05; P.vel.y = -1;
    const took = rg.startFlip('up');
    console.log(`  flicked 5 cm off the ground   -> ${took ? 'FLIPPED (should refuse)' : 'refused, no flip'}`);
    if (took) ok = false; P.flip = null; }
  // a flip whose clock is short when she lands IS a bail: start one, then force an early landing
  { const r = drop(0, 0, 6, () => { P.pos.y += 3; P.vel.y = 2; rg.startFlip('down'); P.flip.dur = 9; });
    console.log(`  landed half way round a flip  -> ${r.bail ? 'BAIL' : 'landed it (should bail)'}`);
    if (!r.bail) ok = false; }
  // AS SHIPPED (r23): `LAND.bail` 0 -- however she comes down she rides away, on the nearer end
  rg.LAND.bail = 0;
  for (const [label, h, want] of [['bails off: 80 deg -> forward', 80 * D, 1], ['bails off: 100 deg -> FAKIE', 100 * D, -1]]) {
    const r = drop(h, 0, 8);
    const good = r.landed && !r.bail && r.stance === want && r.v > 4.5;   // squared onto her line, not skidded to a stop
    console.log(`  ${label.padEnd(28)} -> ${r.bail ? 'BAIL' : r.stance > 0 ? 'forward' : 'FAKIE'}, ${fix(r.v, 1)} m/s after${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
  }
  { const r = drop(0, 0, 6, () => { P.pos.y += 3; P.vel.y = 2; rg.startFlip('down'); P.flip.dur = 9; });
    console.log(`  bails off: half way round     -> ${r.bail ? 'BAIL (should land)' : 'landed it'}`);
    if (r.bail) ok = false; }
  rg.LAND.bail = 1;
  // STRAIGHT UP A VERT WALL AND BACK DOWN, NO SPIN. r32: with the AUTO-TURN (Tony Hawk's) she is
  // turned round on the way and comes down FORWARD; with it off she comes down FAKIE, which is the
  // physics. READ AT THE LANDING: seconds later she has ridden on to the far wall and back.
  for (const [auto, want] of [[1, 1], [0, -1]]) {
    const keepA = rg.VERT.autoTurn; rg.VERT.autoTurn = auto;
    place(0, 3, 29, 0, 13); let air = false, at = null, b0 = P.bailId;   // 13: back INTO the pipe
    run(5, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0; if (!P.grounded) air = true;
      if (air && P.grounded && !at) at = { stance: P.stance, bail: P.bailId !== b0, why: P.stanceWhy }; });
    rg.VERT.autoTurn = keepA;
    const good = at && at.stance === want && !at.bail;
    console.log(`  straight up the vert, auto-turn ${auto ? 'ON ' : 'off'} -> ${!at ? 'never landed' : at.bail ? 'BAIL' : at.stance < 0 ? 'FAKIE' : 'forward'} (${at && at.why})${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
  }
  // and spinning an extra 180 on top of the auto-turn is how you come down fakie on purpose
  // r47: DRIVEN THROUGH THE STICK, not by writing the heading -- on a held vert air the body turns about the
  // wall's normal (`vertSpin`) and a heading written from outside is a spin the game never sees
  { const keepAim = rg.AIR.aim; rg.AIR.aim = 0; place(0, 3, 29, 0, 13); let air = false, at = null, spun = 0;
    run(5, (t) => { rg.stick.L.y = 0; rg.cam.az = 0;
      if (!P.grounded && !air) air = true;
      rg.stick.L.x = (air && !P.grounded && spun < Math.PI / rg.AIR.spin) ? 1 : 0; if (rg.stick.L.x) spun += DT;
      if (air && P.grounded && !at) at = { stance: P.stance }; });
    const good = at && at.stance === -1;
    console.log(`  ...plus a 180 of her own spin    -> ${!at ? 'never landed' : at.stance < 0 ? 'FAKIE' : 'forward'}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false; rg.AIR.aim = keepAim; }
  // r55: with the stick as a heading, POINTING her back up the screen (out of the pipe) in the air does the same
  { place(0, 3, 29, 0, 13); let air = false, at = null;
    run(5, () => { rg.cam.az = 0; rg.cam.steerAz = 0; if (!P.grounded && !air) air = true;
      const on = air && !P.grounded; rg.stick.L.x = 0; rg.stick.L.y = on ? -1 : 0; rg.stick.L.down = on ? 1 : 0;
      if (air && P.grounded && !at) at = { stance: P.stance }; });
    rg.stick.L.down = 0; rg.stick.L.y = 0;
    const good = at && at.stance === -1;
    console.log(`  ...or the stick pointing her out -> ${!at ? 'never landed' : at.stance < 0 ? 'FAKIE' : 'forward'}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false; }
  // FAKIE, AND THE THUMB WHERE SHE IS GOING: she speeds up BACKWARDS, and stays fakie
  { place(60, 1, -60, Math.PI, 0); P.vel.set(0, 0, 2); P.stance = -1;
    run(3, () => { rg.cam.az = 0; rg.stick.L.x = 0; rg.stick.L.y = -1; });
    const vz = P.vel.z, fwd = Math.cos(P.heading);
    console.log(`  fakie, thumb toward her travel -> ${fix(vz, 1)} m/s along it after 3 s, stance ${P.stance < 0 ? 'FAKIE' : 'forward'}, nose ${fwd < 0 ? 'still BEHIND her' : 'turned round'}`);
    if (!(vz > 6 && P.stance === -1 && fwd < 0)) ok = false; }
  // AND WITHOUT `stanceLock` -- roller_girl -- the old rule is untouched: she turns to face forwards
  { P.stanceLock = false; place(60, 1, -60, Math.PI, 0); P.vel.set(0, 0, 0.5);
    run(3, () => { rg.cam.az = 0; rg.stick.L.x = 0; rg.stick.L.y = -1; });
    const fwd = Math.cos(P.heading);
    console.log(`  no stanceLock, slow, thumb fwd -> nose ${fwd > 0.9 ? 'turned to face it (as before)' : 'NOT turned'}`);
    if (!(fwd > 0.9)) ok = false; }
  // THE SWIVEL: a tap on the left pad swaps the end she leads with and leaves her travel alone
  { P.stanceLock = true; place(60, 1, -60, 0, 0); P.vel.set(0, 0, 6); P.stance = 1;
    const h0 = P.heading, v0 = P.vel.clone(), took = rg.swivel();
    const turned = Math.abs(Math.abs(Math.atan2(Math.sin(P.heading - h0), Math.cos(P.heading - h0))) - Math.PI) < 1e-6;
    const good = took && P.stance === -1 && turned && P.vel.distanceTo(v0) < 1e-9;
    console.log(`  swivel on the ground          -> ${took ? (P.stance < 0 ? 'FAKIE' : 'forward') : 'refused'}, heading ${turned ? '+180' : 'NOT turned'}, travel ${P.vel.distanceTo(v0) < 1e-9 ? 'unchanged' : 'CHANGED'}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
    run(1, () => { rg.cam.az = 0; rg.stick.L.x = rg.stick.L.y = 0; });
    console.log(`  ...a second later             -> ${P.stance < 0 ? 'still FAKIE' : 'turned back to forward'}, ${fix(P.vel.z, 1)} m/s along z${P.stance < 0 ? '' : '   <- WRONG'}`);
    if (P.stance !== -1) ok = false;
    P.grounded = false; const s1 = P.stance;
    const air = rg.swivel();
    console.log(`  swivel in the air             -> ${air ? 'SWIVELLED (should refuse)' : 'refused'}`);
    if (air || P.stance !== s1) ok = false;
    P.stanceLock = false; place(60, 1, -60, 0, 0); P.stance = 1;
    const nl = rg.swivel();
    console.log(`  swivel without stanceLock     -> ${nl ? 'SWIVELLED (should refuse)' : 'refused (roller_girl has no fakie clips)'}`);
    if (nl) ok = false; }
  rg.girl.moves = keep.moves; P.stanceLock = keep.lock; rg.LAND.bail = keep.bail;
  return ok;
};

// ---------------------------------------------------------------- the move brain
// THE SHIPPED `girlAnimMoves` on his real clip names and lengths, as the game prepares them. The
// actions are fabricated (no harness can build the draco skin), which is enough: the question is
// which clips the brain ASKS for, how hard, and at what rate.
// r46: A SLIDE TACKLE OUT OF FAKIE COMES UP SKATING FORWARD, and stays that way; going forward it changes nothing
CASES.slideflip = () => {
  let ok = true; const keep = P.stanceLock, keepR = rg.girl.ready; rg.girl.ready = false;
  for (const [label, st, flip, want] of [['fakie, slide', -1, 1, 1], ['forward, slide', 1, 1, 1], ['fakie, slide, switch off', -1, 0, -1]]) {
    P.stanceLock = true; place(60, 1, -60, 0, 0);
    // rolling +Z at 8 m/s; in fakie her NOSE points back (-Z)
    P.stance = st; P.heading = P.faceH = st < 0 ? Math.PI : 0; P.vel.set(0, 0, 8);
    const keepF = rg.MELEE.slideFlip; rg.MELEE.slideFlip = flip;
    rg.stepPlayer(DT); const did = rg.meleeSlide();
    let wobble = false; run(2.5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.stance !== want) wobble = true; });
    rg.MELEE.slideFlip = keepF;
    const fwd = Math.cos(P.heading - Math.atan2(P.vel.x, P.vel.z));
    const good = did && P.stance === want && !wobble && (want > 0 ? fwd > 0.9 : fwd < -0.9);
    console.log(`  ${label.padEnd(28)} ${good ? 'ok' : 'WRONG'} stance ${P.stance > 0 ? 'fwd' : 'FAKIE'} the whole way after, nose ${fwd > 0 ? 'along' : 'against'} her travel, ${fix(P.hSpeed, 1)} m/s`);
    if (!good) ok = false;
  }
  P.stanceLock = keep; P.stance = 1; rg.girl.ready = keepR;
  return ok;
};
CASES.moves = () => {
  const { clips, moves, R } = gameClips('models/alien_rollerskate_blue.glb');
  if (!moves) { console.log('  no move table built'); return false; }
  let ok = true;
  console.log(`  forward push ${moves.fwd.push.join(' / ')}, roll ${moves.fwd.roll}\n  backward push ${moves.back.push.join(' / ')}, roll ${moves.back.roll}`);
  console.log(`  idles ${moves.idleFwd.length} forward, ${moves.idleBack.join(',')} back; flips ${Object.keys(moves.flip).join(',')}; falls ${moves.falls.length}; fallback ${R.fallback}, solo ${R.solo}`);
  // r23: medium is gone; a hard push in fakie (which he has not drawn) borrows casual_backward
  if (moves.fwd.push.join() !== 'blade_casual_forward,blade_hard_forward' ||
      moves.back.push.join() !== 'blade_casual_backward,blade_casual_backward' ||
      moves.fwd.roll !== 'idle_normal' || moves.back.roll !== 'idle_backward') { console.log('  -> wrong push / roll clips'); ok = false; }
  if (Object.keys(moves.flip).length !== 4 || R.solo || !/^idle/.test(R.fallback)) ok = false;
  const keep = { a: rg.girl.actions, cw: rg.girl.cw, len: rg.girl.clipLen, m: rg.girl.moves, r: rg.girl.ready };
  const log = {};
  rg.girl.actions = {}; rg.girl.cw = {}; rg.girl.clipLen = R.len; rg.girl.moves = moves; rg.girl.ready = true;
  rg.girl.idle = null; rg.girl.bail = null;
  for (const c of clips) rg.girl.actions[c.name] = log[c.name] = { w: 0, ts: 1, running: 0, resets: 0,
    reset() { this.resets++; this.running = 1; return this; }, play() { this.running = 1; return this; },
    stop() { this.running = 0; return this; }, isRunning() { return !!this.running; },
    setEffectiveWeight(v) { this.w = v; return this; }, getEffectiveWeight() { return this.w; },
    setEffectiveTimeScale(v) { this.ts = v; return this; }, setLoop() { return this; } };
  const step = (sec, f) => { for (let i = 0; i < Math.round(sec / DT); i++) { if (f) f(i * DT); rg.girlAnimMoves(DT); } };
  const state = (o) => { P.grounded = true; P.flip = null; P.bailT = 0; P.landHard = 0; P.grind = null; Object.assign(P, o); };
  const top = () => rg.girl.top;
  const check = (label, cond, extra = '') => { console.log(`  ${label.padEnd(36)} ${cond ? 'ok' : 'WRONG'} ${extra}`); if (!cond) ok = false; };
  // standing, and the idles rotating
  state({ speed: 0, stance: 1 }); rg.girl.idle = null; step(1);
  check('standing forward', top() === 'idle_normal', top());
  const seen = [top()]; let repeat = false;
  for (let k = 0; k < 6; k++) { step(rg.MOVES.idleHold + 0.1); if (top() === seen[seen.length - 1]) repeat = true; seen.push(top()); }
  check('after a long stand, she shifts', new Set(seen).size >= 3 && !repeat, seen.join(' > '));
  state({ speed: 0, stance: -1 }); step(1);
  check('standing in FAKIE', top() === 'idle_backward', top());
  // ROLLING WITH THE THUMB OFF is the neutral pose; PUSHING eases casual -> hard with HOW HARD THE THUMB PUSHES (r84, `drive`)
  for (const [v, st, go, want, dv] of [[6, 1, false, 'idle_normal', 0], [6, -1, false, 'idle_backward', 0],
                                   [2, 1, true, 'blade_casual_forward', 0], [20, 1, true, 'blade_hard_forward', 1],
                                   [2, -1, true, 'blade_casual_backward', 0], [20, -1, true, 'blade_casual_backward', 1]]) {
    state({ speed: v, stance: st, thumbGo: go, drive: dv }); step(1.5);
    const a = log[want];
    check(`${v} m/s ${st > 0 ? 'forward' : 'FAKIE'}, thumb ${go ? (dv ? 'pushing hard' : 'pushing lightly') : 'off'}`, top() === want && a.w > 0.95, `${top()} x${fix(a.ts)} weight ${fix(a.w)}`);
  }
  // r80: BOOSTING she is in her speed skate -- the hard push, quickened -- even slow, even with the thumb off
  state({ speed: 6, stance: 1, thumbGo: false, boostFx: 1 }); step(0.8, () => { P.boostFx = 1; });
  check('boosting at 6 m/s, thumb off', top() === 'blade_hard_forward' && log.blade_hard_forward.ts >= rg.BOOST.rate - 0.01, `${top()} x${fix(log.blade_hard_forward.ts)}`);
  P.boostFx = 0;
  // r81: the swipe down in the air: the grind pose for the side she will land on, both ways
  for (const sd of ['left', 'right']) { state({ grounded: false, speed: 9, dive: { side: sd } }); step(0.3);
    check(`diving at a rail, ${sd} side`, top() === moves.grind[sd], `${top()} (want ${moves.grind[sd]})`); }
  P.dive = null; P.grounded = true;
  // half way between the two pushes BOTH play, and the weights still sum to one
  // r84: which push shows is the THUMB'S STRENGTH (`p.drive`), not the speed -- half a thumb blends both, a full thumb is
  // the speed skate even at a crawl
  { const V = rg.MOVES.pushV; state({ speed: (V[0] + V[1]) / 2, stance: 1, thumbGo: true }); P.drive = 0.5; step(2);
    const c = log.blade_casual_forward.w, h = log.blade_hard_forward.w;
    let sum = 0; for (const k in log) sum += log[k].w;
    check(`half a thumb pushing blends casual and hard`, c > 0.3 && h > 0.3 && Math.abs(sum - 1) < 0.02, `casual ${fix(c)} hard ${fix(h)}, all ${fix(sum)}`);
    state({ speed: 2, stance: 1, thumbGo: true }); P.drive = 1; step(2);
    check(`a full thumb at 2 m/s is the speed skate`, top() === 'blade_hard_forward', `${top()}`); P.drive = 0; }
  // and nothing in the table is the medium push any more
  check('medium never asked for', !Object.keys(log).some(k => /medium/.test(k) && log[k].w > 0.01), '');
  state({ thumbGo: false });
  // the air, a flip timed to the air left, and back to the air pose when it is done
  state({ grounded: false, speed: 6 }); step(1);
  check('in the air', top() === 'in_air', top());
  P.flip = { nm: 'front_twist_flip__mirror', dir: 'left', t: 0, dur: 0.9 };
  step(0.3, () => (P.flip.t += DT));
  const fa = log.front_twist_flip__mirror;
  check('flick left: the MIRRORED twist flip', top() === 'front_twist_flip__mirror' && fa.resets > 0,
        `x${fix(fa.ts)} (clip ${fix(R.len.front_twist_flip__mirror)} s into 0.9 s)`);
  step(0.8, () => (P.flip.t += DT));
  check('...and the air pose once it is round', top() === 'in_air', top());
  // PROCEDURAL (r25): mid-flip she is in his TUCK pose, not a flip clip
  P.flip = { nm: 'front_flip', dir: 'up', t: 0, dur: 1, proc: true };
  step(0.45, () => (P.flip.t += DT));
  { let sum = 0; for (const k in log) sum += log[k].w;
    check('procedural flip: tucked half way', top() === 'tuck' && log.front_flip.w < 0.01 && Math.abs(sum - 1) < 0.02, `${top()}, flip clip ${fix(log.front_flip.w)}, all ${fix(sum)}`); }
  step(0.3, () => (P.flip.t += DT));
  check('...opening out through flip_pose', log.flip_pose.w > 0.2 || top() === 'in_air', `${top()} flip_pose ${fix(log.flip_pose.w)}`);
  P.flip = null; step(0.5);
  // ON A RAIL: the side she came at it from picks the clip
  for (const side of ['right', 'left']) {
    state({ speed: 8, grounded: true }); P.grind = { side, s: 8, time: 1, t: 0.5, dir: 1 };
    step(0.6);
    check(`grinding, came at it ${side === 'right' ? 'moving RIGHT' : 'moving LEFT'}`, top() === 'grind_' + side, top());
    P.grind = null;
  }
  // r46: THE LEFT TAP SWITCHES SIDES ON A RAIL, AND THE LEFT FLICK PICKS A TRICK GRIND (same flick: back to plain)
  { state({ speed: 8, grounded: true, stance: 1 }); P.grind = { side: 'left', s: 8, time: 1, t: 0.5, dir: 1, rail: rg.RAILS[0] };
    step(0.6); const a0 = top(); rg.grindSwitch(); step(0.6); const a1 = top();
    check('rail: left tap switches the side', a0 === 'grind_left' && a1 === 'grind_right', `${a0} -> ${a1}`);
    const seen = [];
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { rg.grindTrick(dx, dy); step(0.6); seen.push(top()); }
    rg.grindTrick(1, 0); step(0.6); const back = top();
    P.stance = -1; rg.grindTrick(0, -1); step(0.6); const fk = top();
    check('rail: flicks pick four trick grinds', new Set(seen).size === 4 && seen.every(n => /^blade_/.test(n)), seen.join(' '));
    check('...the same flick again is the plain grind', back === 'grind_right', back);
    check('...and riding fakie takes the fakie one', /_backward$/.test(fk), fk);
    P.grind = null; P.stance = 1; }
  // a bail: down, then up, filling the bail
  state({ speed: 3, bailT: rg.LAND.bailT }); P.bailId++;
  step(0.2, () => (P.bailT -= DT));
  const down = top();
  step(rg.LAND.bailT * 0.6, () => (P.bailT -= DT));
  const up = top();
  check('a bail: down, then back up', /^fall_to/.test(down) && /^get_up/.test(up), `${down} > ${up}`);
  Object.assign(rg.girl, { actions: keep.a, cw: keep.cw, clipLen: keep.len, moves: keep.m, ready: keep.r, idle: null, bail: null });
  state({ speed: 0, stance: 1 });
  return ok;
};

// ---------------------------------------------------------------- which way the body faces (r24)
// *"My animations for riding backwards are themselves backward."* They were: the body inside every
// `*_backward` clip faces ~180 off the model's forward, so with the game ALSO turning her round for
// fakie she skated facing the way she was going. The SHIPPED `prepClips` takes the clip's half
// turn out; this poses his real skeleton through a real mixer -- an independent measurement, not
// the `bodyYaw` the fix uses -- and requires every skating and idle clip to face forward. It runs
// the prep twice, with the fix OFF first, so it is shown to be able to fail.
CASES.facing = () => {
  const f = 'models/alien_rollerskate_blue.glb', g = readGLB(f);
  const yawOf = (clips, nm) => {
    const S = skelFromGLB(g.json), clip = clips.find(c => c.name === nm);
    const m = new THREE.AnimationMixer(S.root), a = m.clipAction(clip); a.play(); a.time = 0.37 * clip.duration; m.update(0);
    S.root.updateMatrixWorld(true);
    const L = new THREE.Vector3().setFromMatrixPosition(S.by.mixamorig_LeftUpLeg.matrixWorld);
    const R = new THREE.Vector3().setFromMatrixPosition(S.by.mixamorig_RightUpLeg.matrixWorld);
    const fwd = new THREE.Vector3(0, 1, 0).cross(R.sub(L));
    return Math.atan2(fwd.x, fwd.z) * 180 / Math.PI;
  };
  const prep = on => { const keep = rg.FACEFIX.on; rg.FACEFIX.on = on;
    const c = rg.prepClips(rg.normaliseClips(buildClips(g, THREE)), skelFromGLB(g.json).root);
    rg.FACEFIX.on = keep; return c; };
  const names = prep(1).map(c => c.name).filter(n => /^(blade_|idle_)/.test(n));
  const raw = prep(0), fixd = prep(1);
  let ok = true, wasBack = 0;
  for (const nm of names) {
    const a = yawOf(raw, nm), b = yawOf(fixd, nm);
    if (Math.abs(a) > 90) wasBack++;
    const good = Math.abs(b) < 30;
    if (/_backward$/.test(nm) || !good) console.log(`  ${nm.padEnd(32)} as exported ${a.toFixed(0).padStart(5)} deg  ->  ${b.toFixed(0).padStart(4)}${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
  }
  console.log(`  ${wasBack} clips authored facing backwards, turned: ${rg.FACEFIX.turned.length}`);
  if (wasBack < 10) { console.log('  -> the unfixed export should read backwards; the measurement is not measuring'); ok = false; }
  return ok;
};

// ---------------------------------------------------------------- procedural flips (r25)
// THE SHIPPED `flipShape` / `flipTurn` / `flipQ`: the pose blend sums to 1 all the way through, the
// turn starts at 0 and lands EXACTLY on a full turn, it spins faster tucked than opened out, and a
// front flip takes her head FORWARD, a back flip backward. What no harness here can check is how it
// LOOKS -- `poseGirl` needs a skin, and the skin is draco.
CASES.flip = () => {
  let ok = true;
  const chk = (label, c, extra = '') => { console.log(`  ${label.padEnd(40)} ${c ? 'ok' : 'WRONG'} ${extra}`); if (!c) ok = false; };
  let worst = 0, mono = true, prev = -1;
  for (let i = 0; i <= 200; i++) { const u = i / 200, w = rg.flipShape(u), t = rg.flipTurn(u);
    worst = Math.max(worst, Math.abs(w.tuck + w.pose + w.air - 1), w.tuck < -1e-9 || w.pose < -1e-9 || w.air < -1e-9 ? 1 : 0);
    if (t < prev - 1e-12) mono = false; prev = t; }
  chk('pose weights sum to 1, none negative', worst < 1e-9, `worst ${worst.toExponential(1)}`);
  chk('turn 0 at the start, 1 at the end', Math.abs(rg.flipTurn(0)) < 1e-9 && Math.abs(rg.flipTurn(1) - 1) < 1e-9, `${fix(rg.flipTurn(1), 6)}`);
  chk('turn never goes backwards', mono);
  const rate = u => (rg.flipTurn(u + 0.005) - rg.flipTurn(u - 0.005)) / 0.01;
  const w45 = rg.flipShape(0.45);
  chk('tucked mid-flip', w45.tuck > 0.99, `tuck ${fix(w45.tuck)}`);
  chk('spins faster tucked than at the edges', rate(0.45) > 1.8 * rate(0.03), `x${fix(rate(0.45) / rate(0.03))}`);
  const head = (dir, u) => { const q = rg.flipQ({ dir, t: u, dur: 1 }, new THREE.Quaternion()); return new THREE.Vector3(0, 1, 0).applyQuaternion(q); };
  const hu = head('up', 0.2), hd = head('down', 0.2);
  chk('front flip: head goes FORWARD (+Z)', hu.z > 0.3, `head ${fix(hu.y)}, ${fix(hu.z)}`);
  chk('back flip: head goes BACK (-Z)', hd.z < -0.3, `head ${fix(hd.y)}, ${fix(hd.z)}`);
  for (const dir of ['up', 'down', 'right', 'left']) {
    const q = rg.flipQ({ dir, t: 1, dur: 1 }, new THREE.Quaternion());
    chk(`${dir}: back upright at the end`, Math.abs(Math.abs(q.w) - 1) < 1e-6, `w ${fix(q.w, 6)}`);
  }
  // the twist really twists: a quarter of the way round a right twist flip (a quarter twist too),
  // her nose is out of the flip's plane. (Half way round it has twisted 180 and is back IN it.)
  let uq = 0; while (rg.flipTurn(uq) < 0.25 && uq < 1) uq += 0.001;
  const q = rg.flipQ({ dir: 'right', t: uq, dur: 1 }, new THREE.Quaternion()), nose = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  chk('twist flip: the nose leaves the flip plane', Math.abs(nose.x) > 0.3, `nose x ${fix(nose.x)}`);
  // r29: SHE FLIPS ABOUT HER HIPS. `hipHeight` off his real skeleton is the hips bone's height, and
  // the old typed 0.62 m was well below it on a 1.7 m body.
  { const g = readGLB('models/alien_rollerskate_blue.glb'), S = skelFromGLB(g.json); S.root.updateMatrixWorld(true);
    const hl = new THREE.Vector3(); S.by.mixamorig_Hips.getWorldPosition(hl); S.root.worldToLocal(hl);
    const head = S.by.mixamorig_Head.getWorldPosition(new THREE.Vector3()).y, k = rg.RIG.height / (head * 1.12);   // crown ~ head joint x 1.12
    const hh = rg.hipHeight(hl, k, 0);
    chk('flip pivot is her hips, not her shins', Math.abs(rg.hipHeight(hl, 1, 0) - hl.y) < 1e-9 && hh > rg.RIG.pivot + 0.2,
        `hips ~${fix(hh, 2)} m up, the old pivot was ${fix(rg.RIG.pivot, 2)} m`); }
  // r32: A FLICK IS READ THROUGH THE CAMERA. Camera looking +Z; the flick in screen terms; her facing.
  { const keepAz = rg.cam.az; rg.cam.az = 0;
    for (const [h, dx, dy, want, label] of [[0, 0, -1, 'up', 'facing away, flick up'], [Math.PI, 0, -1, 'down', 'facing the CAMERA, flick up (away)'],
                                            [Math.PI, 0, 1, 'up', 'facing the camera, flick down'], [Math.PI, 1, 0, 'left', 'facing the camera, flick right'],
                                            [0, 1, 0, 'right', 'facing away, flick right'], [Math.PI / 2, 0, -1, 'right', 'side on (facing screen-left), flick up']]) {
      P.heading = h; const got = rg.flickFlip(dx, dy);
      chk(`${label}`.padEnd(40), got === want, `-> ${got}`);
    }
    rg.FLIPP.camRel = 0; P.heading = Math.PI; const raw = rg.flickFlip(0, -1); rg.FLIPP.camRel = 1;
    chk('camera-relative OFF: up is always front', raw === 'up', `-> ${raw}`);
    rg.cam.az = keepAz; P.heading = 0; }
  // and `startFlip` marks it procedural when the switch is on, a clip flip when it is off
  const keepM = rg.girl.moves; rg.girl.moves = gameClips('models/alien_rollerskate_blue.glb').moves;
  for (const on of [1, 0]) { rg.FLIPP.on = on; place(60, 1, -60, 0, 6); P.grounded = false; P.pos.y += 6; P.vel.y = 3; P.flip = null;
    rg.startFlip('up'); chk(`Procedural flips ${on}: flip is ${on ? 'procedural' : 'the clip'}`, P.flip && !!P.flip.proc === !!on); }
  rg.FLIPP.on = 1; P.flip = null; rg.girl.moves = keepM;
  return ok;
};

// ---------------------------------------------------------------- the feel (r27)
// *"She feels like a boat."* Four things fed that, and each is checked here against the SHIPPED code:
// the lean was away from the turn half the time, the turn axis was behind her, the air yaw was eased
// on top of an analog ramp, and the camera (that one is on the panel, not here -- it is taste).
// ---------------------------------------------------------------- a swivel mid-stroke (r35)
// A stroke is in the HEADING's frame, so a half turn under a live one used to push her the OTHER way:
// from a standstill she shot off backwards and her stance flipped straight back. Thumb forward, the
// first stroke starts, swivel, thumb still forward: she must roll forward (+Z) in fakie.
CASES.swivel = () => {
  const keepLock = P.stanceLock; P.stanceLock = true; place(60, 1, -60, 0, 0); P.stance = 1;
  const hold = sec => run(sec, () => { rg.cam.az = 0; rg.stick.L.x = 0; rg.stick.L.y = -1; rg.stick.L.down = 1; });
  hold(0.05); const went = rg.swivel(); hold(1.5);
  const bear = Math.atan2(P.vel.x, P.vel.z) * 57.3;
  console.log(`  swivel ${went ? 'taken' : 'REFUSED'} mid-stroke -> stance ${P.stance < 0 ? 'FAKIE' : 'fwd'}, travelling ${fix(bear, 1)} deg off +Z at ${fix(P.hSpeed, 1)} m/s`);
  const ok = went && P.stance < 0 && Math.abs(bear) < 5 && P.hSpeed > 3;
  P.stanceLock = keepLock; P.stance = 1; rg.stick.L.y = 0; rg.stick.L.down = 0;
  return ok;
};
// ---------------------------------------------------------------- r42: lean, camera, grabs, style, swivel
CASES.r42 = () => {
  let ok = true;
  const check = (label, cond, extra = '') => { console.log(`  ${label.padEnd(44)} ${cond ? 'ok' : 'WRONG'} ${extra}`); if (!cond) ok = false; };
  // THE CAMERA: she turns 90 deg on the spot; the spring must START slowly (the shot comes round AFTER her)
  // and never overshoot, where the old follow swings hardest on the very first frame
  const camRun = spring => { const keep = rg.CAM.spring; rg.CAM.spring = spring;
    place(60, 1, -60, 0, 12); rg.cam.az = 0; rg.cam.azV = 0; rg.cam.idle = 9;
    P.vel.set(12, 0, 0); P.hSpeed = 12; P.speed = 12;                    // travelling +X now: bearing pi/2
    const az = []; for (let i = 0; i < 180; i++) { rg.stepCam(DT); az.push(rg.cam.az); }
    rg.CAM.spring = keep; return az; };
  const sp = camRun(1), old = camRun(0), deg = v => v * 57.3;
  const r0 = a => deg(a[5] - a[0]) / (5 * DT), over = a => Math.max(0, deg(Math.max(...a) - Math.PI / 2));
  check('camera eases in: first 0.08 s', r0(sp) < r0(old) * 0.35, `spring ${fix(r0(sp), 0)} deg/s vs old ${fix(r0(old), 0)}`);
  check('...and does not overshoot', over(sp) < 1.5, `${fix(over(sp), 2)} deg past, at 3 s ${fix(deg(sp[179]), 1)} of 90`);
  // THE HIP LEAN tips her the same way the old whole-body lean did, about her forward axis, pivoting at the hips
  { const H = new THREE.Bone(); rg.bodyG.add(H); const keepH = rg.girl.hipsB; rg.girl.hipsB = H;
    place(60, 1, -60, 0, 8); P.grounded = true; P.lean = 0.25; rg.bodyG.quaternion.identity(); rg.bodyG.updateMatrixWorld(true);
    rg.hipLeanApply(); H.updateMatrixWorld(true);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(H.getWorldQuaternion(new THREE.Quaternion()));
    const want = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.25);
    const err = deg(up.angleTo(want)); rg.hipLeanUndo(); const back = deg(H.quaternion.angleTo(new THREE.Quaternion()));
    check('hip lean = the old lean, at the hips', err < 0.1 && back < 1e-6, `${fix(err, 3)} deg off; undone to ${fix(back, 6)}`);
    rg.bodyG.remove(H); rg.girl.hipsB = keepH; P.lean = 0; }
  // THE GRAB: held past grabAt in the air picks a pose by direction; a tap-length hold does not; a hard
  // DOWN hold is the settle, not a grab
  { const { moves } = gameClips('models/alien_rollerskate_blue.glb'); const keepM = rg.girl.moves; rg.girl.moves = moves;
    const air = (x, y, hold) => { place(60, 1, -60, 0, 6); P.grounded = false; P.coyote = 0; P.pos.y += 8; P.vel.y = 2; P.grab = null; P.settling = false; P.rHold = 0;
      Object.assign(rg.stick.R, { down: 1, x, y }); run(hold, () => {}); const g = P.grab; Object.assign(rg.stick.R, { down: 0, x: 0, y: 0 }); return g; };
    const c = air(0, 0, 0.45), u = air(0, -0.8, 0.45), t = air(0, 0, 0.2), d = air(0, 0.9, 0.6), l = air(-0.8, 0, 0.2), r = air(0.8, 0, 0.2);
    check('hold in the air = grab (centre)', c && c.nm === 'blade_pose_duck_R_forward', c ? c.nm : 'none');
    check('hold UP = a different grab', u && u.nm === 'blade_daffy_forward', u ? u.nm : 'none');
    check('a tap-length hold is not a grab', !t, t ? t.nm : 'none');
    check('r55: hold DOWN = the swan grab, not the settle', d && d.nm === 'blade_pose_swan_L_forward' && !P.settling, d ? d.nm : 'none');
    check('r55: pushed LEFT / RIGHT grab at once', l && r && l.nm === 'blade_onefootfront_L_forward' && r.nm === 'blade_onefootfront_R_forward', `${l && l.nm} / ${r && r.nm}`);
    { place(60, 1, -60, 0, 6); P.grounded = false; P.coyote = 0; P.pos.y += 8; P.vel.y = 2; P.grab = null; P.rHold = 0;
      Object.assign(rg.stick.R, { down: 1, x: 0, y: 0 }); run(0.4, () => {}); const g0 = P.grab && P.grab.k;
      Object.assign(rg.stick.R, { x: 0.8, y: 0 }); run(0.1, () => {}); const g1 = P.grab && P.grab.k;
      Object.assign(rg.stick.R, { x: 0, y: -0.8 }); run(0.1, () => {}); const g2 = P.grab && P.grab.k;
      Object.assign(rg.stick.R, { down: 0, x: 0, y: 0 });
      check('r55: the grab follows the thumb', g0 === 'centre' && g1 === 'right' && g2 === 'up', `${g0} -> ${g1} -> ${g2}`); }
    // r56: held down over the FLAT it is the grab and her speed is untouched; over a ramp it settles (the feel case)
    { place(60, 1, -60, 0, 6); P.grounded = false; P.coyote = 0; P.pos.y += 8; P.vel.set(0, 2, 6); P.grab = null; P.rHold = 0; P.airT = 0.3;
      Object.assign(rg.stick.R, { down: 1, x: 0, y: 0.9 }); run(0.6, () => { rg.stick.L.x = rg.stick.L.y = 0; }); const hs = Math.hypot(P.vel.x, P.vel.z), g = P.grab; Object.assign(rg.stick.R, { down: 0, x: 0, y: 0 });
      check('r56: hold DOWN over flat ground: a grab, no braking', g && !P.settling && hs > 5.9, `${g && g.nm}, ${fix(hs, 2)} m/s across (was 6)`); }
    { const az0 = rg.cam.az; place(60, 1, -60, 0, 6); P.grounded = false; P.pos.y += 8; Object.assign(rg.stick.R, { down: 1, x: 1, y: 0 });
      for (let i = 0; i < 30; i++) rg.stepCam(DT); Object.assign(rg.stick.R, { down: 0, x: 0, y: 0 });
      check('r55: a grab held sideways does not orbit the camera', Math.abs(wrap(rg.cam.az - az0)) < 0.05, `${fix(wrap(rg.cam.az - az0) * 57.3, 1)} deg`); }
    run(0.1, () => {}); check('let go and the grab ends', !P.grab);
    rg.girl.moves = keepM; }
  // THE TAP HOP: no kick
  { const R = rg.RAILS[0]; place((R.a.x + R.b.x) / 2 + 3, 1, (R.a.z + R.b.z) / 2, 0, 0); P.mel = null; rg.railHome();
    check('tap hop onto a rail plays no kick', !P.mel, P.mel ? P.mel.nm : 'no strike'); }
  // THE SWIVEL is eased: her body takes a while to come round (and still gets there)
  { const keepLock = P.stanceLock; P.stanceLock = true; place(60, 1, -60, 0, 6); P.stance = 1; P.faceH = 0;
    rg.swivel(); let t10 = null;
    run(1.2, (t) => { rg.stick.L.x = rg.stick.L.y = 0; if (t10 === null && Math.abs(Math.atan2(Math.sin(P.faceH - P.heading), Math.cos(P.faceH - P.heading))) < 10 / 57.3) t10 = t; });
    check('swivel eases round (not a snap)', t10 !== null && t10 > 0.25 && t10 < 1.0, t10 === null ? 'never' : `${fix(t10, 2)} s to within 10 deg`);
    P.stanceLock = keepLock; P.stance = 1; }
  // STYLE SKATES: cruising with the thumb off, after styleEvery a style clip takes over, then hands back
  { const { clips, moves, R } = gameClips('models/alien_rollerskate_blue.glb');
    const keep = { a: rg.girl.actions, cw: rg.girl.cw, len: rg.girl.clipLen, m: rg.girl.moves, r: rg.girl.ready };
    rg.girl.actions = {}; rg.girl.cw = {}; rg.girl.clipLen = R.len; rg.girl.moves = moves; rg.girl.ready = true; rg.girl.style = null; rg.girl.styleWait = 0;
    for (const c of clips) rg.girl.actions[c.name] = { w: 0, ts: 1, reset() { return this; }, play() { return this; }, stop() { return this; }, isRunning() { return 1; },
      setEffectiveWeight(v) { this.w = v; return this; }, getEffectiveWeight() { return this.w; }, setEffectiveTimeScale(v) { this.ts = v; return this; }, setLoop() { return this; } };
    Object.assign(P, { grounded: true, flip: null, bailT: 0, landHard: 0, grind: null, mel: null, speed: 10, stance: 1, thumbGo: false });
    const tops = []; for (let i = 0; i < Math.round(12 / DT); i++) { rg.girlAnimMoves(DT); if (i % 30 === 0) tops.push(rg.girl.top); }
    const styled = [...new Set(tops.filter(n => n && !/idle_normal/.test(n)))];
    check('cruising, she slips into style skates', styled.length >= 2 && tops.includes('idle_normal'), styled.join(', '));
    Object.assign(P, { speed: 2 }); for (let i = 0; i < Math.round(2 / DT); i++) rg.girlAnimMoves(DT);
    check('slow, she does not', rg.girl.top === 'idle_normal', rg.girl.top);
    Object.assign(rg.girl, { actions: keep.a, cw: keep.cw, clipLen: keep.len, moves: keep.m, ready: keep.r, style: null }); }
  return ok;
};
// ---------------------------------------------------------------- a tap near a rail (r41)
// *"Tap even though you're fairly high above it or off to the side, and she does the little kick over so
// she grinds on it."* Every rail: a tap from the ground 3.5 m to its side, from the air 6 m above it and
// 2.5 m off, and rolling past it at speed -- each must end up GRINDING that rail. Controls: the same taps
// with `GRIND.home` off do not, and a tap 9 m away is an ordinary jump.
// r45: HIS REAL FILES THROUGH THE REAL LOADER. Node has no image decoder, so the textures are cut out of
// the GLB before it is parsed -- which leaves exactly what the city code reads: nodes, meshes, materials,
// extras. A harness that fabricated the scene would be testing a scene he never exported.
function glbNoTex(file) {
  const b = fs.readFileSync(file), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const jl = dv.getUint32(12, true), json = JSON.parse(b.slice(20, 20 + jl).toString('utf8')), rest = b.slice(20 + jl);
  delete json.textures; delete json.images; delete json.samplers;
  for (const m of json.materials || []) {
    const pb = m.pbrMetallicRoughness || {}; delete pb.baseColorTexture; delete pb.metallicRoughnessTexture;
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; delete m.extensions;
  }
  for (const k of ['extensionsUsed', 'extensionsRequired']) if (json[k]) json[k] = json[k].filter(e => e !== 'EXT_texture_webp');
  let js = Buffer.from(JSON.stringify(json)); const pad = (4 - js.length % 4) % 4; js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
  const head = Buffer.alloc(20); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + js.length + rest.length, 8);
  head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4E4F534A, 16);
  const out = Buffer.concat([head, js, rest]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}
let _gltf = null;
async function realGLB(file) {
  if (!_gltf) { const { GLTFLoader } = await import(pathToFileURL(path.resolve('vendor/GLTFLoader.js')).href); _gltf = new GLTFLoader(); }
  return new Promise((res, rej) => _gltf.parse(glbNoTex(file), '', res, rej));
}
// r45: THE CITY. Walls that stop her, a gap that lands, the booster spiral to the tower roof, the loop
// (and that she is upside down at the top of it), the zip line off the roof, a hydrant's geyser lifting
// her past C's roof, gems, the camera kept out of buildings, and an IMPORT built in memory the way
// GLTFLoader hands one over, run through the shipped `levelIngest`.
CASES.city = async () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(44)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const S = rg.SOLID, path = n => rg.PATHS.find(q => q.name === n);
  console.log(`  ${S.all.length} solid boxes, ${rg.KIT.place.length} kit pieces placed, ${rg.PATHS.length} rail paths, ${rg.GEM.list.length} gems, ${rg.HYD.list.length} hydrants`);
  const inside = () => !!rg.solidAt(P.pos.x, P.pos.y + 0.5, P.pos.z, -0.05);
  // 0. NOTHING PLACED INSIDE ANYTHING ELSE: no gem in a wall, no rail through one, no hydrant in a building
  { const inGem = rg.GEM.list.filter(g => rg.solidAt(g.x, g.y, g.z, 0.3));
    const inRail = rg.RAILS.filter(R => R.path.name !== 'park' && rg.solidAt(R.mx, (R.a.y + R.b.y) / 2 - 0.1, R.mz, 0.05, b => b.tag !== 'bench' && !/wall$/.test(b.tag)));
    const inHyd = rg.HYD.list.filter(H => rg.solidAt(H.x, 0.4, H.z, 0.3, b => b.tag !== 'hydrant'));
    say('nothing placed inside anything', !inGem.length && !inRail.length && !inHyd.length,
      `${inGem.length} gems, ${inRail.length} rail segments, ${inHyd.length} hydrants inside a box` + (inGem.length ? ' -- gems at ' + inGem.map(g => `${fix(g.x, 1)},${fix(g.y, 1)},${fix(g.z, 1)} in ${rg.solidAt(g.x, g.y, g.z, 0.3).tag}`).join('; ') : '') + (inRail.length ? ' -- ' + inRail.map(R => { const b = rg.solidAt(R.mx, (R.a.y + R.b.y) / 2 - 0.1, R.mz, 0.05, b => b.tag !== 'bench' && !/wall$/.test(b.tag)); return `${R.path.name} at ${fix(R.mx, 1)},${fix((R.a.y + R.b.y) / 2, 2)},${fix(R.mz, 1)} in ${b.tag} top ${fix(b.y1, 2)}`; }).join('; ') : '')); }
  // 1. a wall: straight into B's west face at 10 m/s
  { place(54, 0, 150.5, Math.PI / 2, 10); let worst = 0, inAny = false;
    run(1.5, () => { worst = Math.max(worst, P.pos.x); inAny = inAny || inside(); });
    say('square into a wall at 10 m/s', worst < 60 - rg.SOLID.r + 0.03 && !inAny && P.hSpeed < 3, `stopped at x ${fix(worst)} (face at 60), ${fix(P.hSpeed)} m/s after`); }
  // 2. a graze: 15 degrees into the same wall at 12 m/s keeps most of it
  { place(57, 0, 149, Math.PI / 2 - 1.31, 12); let inAny = false;
    run(1.2, () => { inAny = inAny || inside(); });
    say('grazing it at 15 deg, 12 m/s', !inAny && P.hSpeed > 9, `${fix(P.hSpeed)} m/s along it, never inside`); }
  // 3. off a roof: east across B at 8 m/s, over the edge, down to the street
  { place(70, 9, 156, Math.PI / 2, 8); let left = false;
    run(3, () => { if (!P.grounded) left = true; });
    say('rolled off B\'s roof', left && P.grounded && P.pos.y < 0.3 && P.pos.x > 78, `landed at x ${fix(P.pos.x)} y ${fix(P.pos.y)}`); }
  // 4. up the first bank of the Steps at 12 m/s
  { place(-2, 0, 156, Math.PI / 2, 12); let top = 0, inAny = false;
    run(2.5, () => { top = Math.max(top, P.pos.y); inAny = inAny || inside(); });
    say('up the Steps\' first bank at 12 m/s', top > 2.9 && !inAny, `got to ${fix(top)} m (roof at 3), never inside`); }
  // 5. THE GAP: off the kicker on the Steps' top at 16 m/s, across the street onto B
  { place(40, 12, 156, Math.PI / 2, 16); let air = false, land = null;
    run(3, () => { if (!P.grounded) air = true; else if (air && !land) land = P.pos.clone(); });
    say('the gap: Steps (12 m) -> B (9 m) at 16 m/s', !!land && Math.abs(land.y - 9) < 0.3 && land.x > 60 && land.x < 78,
      land ? `landed at x ${fix(land.x)} y ${fix(land.y)}` : 'never landed'); }
  // 6. THE SPIRAL: a tap at its foot hops her on; it carries her to the roof
  { const sp = path('spiral'); place(-50, 0, 194.5, Math.PI / 2, 4); P.jump = 1; let on = false;
    run(2, () => { if (P.grind && P.grind.rail.path === sp) on = true; });
    say('a tap at the foot of the spiral', on, on ? 'hopped on' : 'missed it');
    place(-50, 1, 196, Math.PI / 2, 0);
    rg.enterGrind({ rail: sp.segs[0], t: 0.05, dir: 1, s: 10, side: 'left' });
    let t = 0, low = 99; run(40, () => { if (P.grind) { t += DT; low = Math.min(low, P.grind.s); } });
    const onRoof = P.grounded && Math.abs(P.pos.y - 30) < 0.3 && P.pos.x > -57.5 && P.pos.x < -42.5 && P.pos.z > 202.5 && P.pos.z < 217.5;
    say('the spiral, street to roof', onRoof, `${fix(t, 1)} s on it, slowest ${fix(low, 1)} m/s, ended at ${fix(P.pos.x, 1)}, ${fix(P.pos.y, 1)}, ${fix(P.pos.z, 1)}`); }
  // 7. THE LOOP: all the way round, upside down at the top, out the far end
  // r48: her up is read AFTER `bodyAlign`, the step `poseGirl` runs on the phone -- r45 read it straight after
  // `stepPlayer`, so it passed while `poseGirl` stood her back upright on every frame of the loop. And her up has to
  // point at the loop's CENTRE all the way round, not merely go negative somewhere.
  { const lp = path('loop'); place(30, 1, 227, 0, 0);
    rg.enterGrind({ rail: lp.segs[0], t: 0.1, dir: 1, s: 12, side: 'left' });
    let minUp = 1, done = false, slow = 99, worstC = 0, loopF = 0; const cy = lp.segs[0].a.y + 6, u = new THREE.Vector3();
    run(8, () => { rg.bodyAlign(DT); if (P.grind) { u.set(0, 1, 0).applyQuaternion(P.bq); minUp = Math.min(minUp, u.y); slow = Math.min(slow, P.grind.s);
      const dy = cy - P.pos.y, dz = 241 - P.pos.z, d = Math.hypot(dy, dz);
      if (P.pos.y > lp.segs[0].a.y + 0.5 && d > 4) { loopF++; worstC = Math.max(worstC, Math.acos(Math.max(-1, Math.min(1, (u.y * dy + u.z * dz) / d))) * 180 / Math.PI); } } else done = true; });
    say('the loop, round and out (as drawn)', done && minUp < -0.9 && P.pos.z > 254 && loopF > 10 && worstC < 12,
      `her up reached y ${fix(minUp)}, ${fix(worstC, 1)} deg worst off the loop's centre over ${loopF} frames, slowest ${fix(slow, 1)} m/s, out at z ${fix(P.pos.z, 1)}`); }
  // r48: THE RAILS ARE UP IN THE AIR. Every street rail he built for her stands at least 2.5 m over what is under it
  // (the bar's own posts measure down the same way), and the street rail beside the bench knocks the hydrant's cap
  // off as she grinds over it.
  { const apex = rg.AIR.jump * rg.AIR.jump / (2 * rg.SK.g); let low = null;
    for (const nm of ['B to C', 'street rail', 'loop', 'spiral']) {
      const q = path(nm).segs[0].a, g = rg.groundAt(q.x, q.z, q.y - 0.3, 0), top = g.hit ? g.floor : 0;
      const h = q.y - top; if (!low || h < low.h) low = { nm, h }; }
    say('the street rails are up in the air', low.h > 2.5, `lowest start: ${low.nm} ${fix(low.h, 2)} m over what is under it (apex ${fix(apex, 2)})`);
    const st = path('street rail'), H = rg.HYD.list.find(h => Math.abs(h.x + 20) < 0.1 && Math.abs(h.z - 250.4) < 0.1);
    place(-20, 0, 233, 0, 7); P.jump = 1; let on = false;
    run(5, () => { rg.stepCity(DT); if (P.grind && P.grind.rail.path === st) on = true; });
    say('a tap under the street rail, over the hydrant', on && !!H && H.broken, `${on ? 'grinded it' : 'never caught'}, hydrant ${H ? (H.broken ? 'cap off' : 'intact') : 'missing'}`); }
  // 8. THE TOWER RAIL (r45's zip line, a grind rail since r47): a tap at the gap in the tower's parapet; and rolling
  // off the gap with no tap
  { const zp = path('tower rail');
    for (const [label, tap] of [['tap at the roof\'s gap onto the tower rail', 1], ['roll off the gap onto it', 0]]) {
      place(-50, 30, tap ? 216 : 213, 0, tap ? 2 : 7); if (tap) P.jump = 1; let on = false, rode = 0, off = null, land = null;
      run(12, () => { if (P.grind && P.grind.rail.path === zp) { on = true; rode += DT; } else if (on && !off) off = P.pos.clone();
        if (off && !land && P.grounded) land = P.pos.clone(); });
      say(label, on && !!off && off.z > 295 && !!land && land.y < 0.3, `${on ? 'rode it ' + fix(rode, 1) + ' s, off at z ' + (off ? fix(off.z, 1) : '-') : 'never caught'}, landed ${land ? 'z ' + fix(land.z, 1) + ' y ' + fix(land.y, 1) : 'never'}`);
    } }
  // 9. A HYDRANT: skate into it and the cap comes off; stand in the water and it lifts her past C's roof
  { const H = rg.HYD.list[0]; place(H.x - 6, 0, H.z, Math.PI / 2, 9);
    run(1.5, () => rg.stepCity(DT));
    say('skated into the hydrant at 9 m/s', H.broken, H.broken ? 'cap off' : 'still intact');
    place(H.x - 0.7, 0, H.z, Math.PI / 2, 0); let top = 0;
    run(3, () => { rg.stepCity(DT); top = Math.max(top, P.pos.y); });
    say('...and its geyser lifts her', top > 6.5, `up to ${fix(top)} m (C's roof is at 6)`); }
  // 10. GEMS on the B -> C rail
  { const bc = path('B to C'), g0 = rg.GEM.got; place(69, 9, 160, 0, 0);
    rg.enterGrind({ rail: bc.segs[0], t: 0.05, dir: 1, s: 8, side: 'left' });
    run(4, () => rg.stepCity(DT));
    say('gems along the B -> C rail', rg.GEM.got - g0 >= 3, `${rg.GEM.got - g0} picked up`); }
  // THE EDGE OF THE WORLD: flat out at the far bank, she comes back rather than off
  { const E = rg.PARK.edge; let far = 0; place(0, 0, 300, 0, 24);
    run(6, () => { far = Math.max(far, P.pos.z); });
    say('flat out at the edge of the world', far < rg.PARK.S + E.u && P.pos.y > -1, `got to z ${fix(far, 1)} (the wall is at ${fix(rg.PARK.S + E.u, 1)}), ended y ${fix(P.pos.y, 1)}`); }
  // 11. THE CAMERA stays out of buildings
  say('camera inside the tower is blocked', rg.camBlocked(-50, 15, 210) && !rg.camBlocked(-50, 15, 190), 'in: blocked, out: clear');
  // 12. AN IMPORT, built in memory the way GLTFLoader builds one, through the shipped levelIngest
  { const before = S.all.length, railsBefore = rg.PATHS.length;
    const vis = new THREE.Group(), root = new THREE.Group(); root.name = 'TEST0';
    root.userData = { cells: '[[0, 0], [1, 0], [0, 1]]', heights: '{"0,0": 2, "1,0": 1, "0,1": 3}', bay_m: 3, floor_m: 3 };
    root.position.set(0, 0, 0); vis.add(root);
    const wallMat = new THREE.MeshStandardMaterial(); wallMat.name = 'brick';
    const pane = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.2).translate(3, 3, 0), wallMat); pane.name = 'TEST0_wall'; root.add(pane);
    const col = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2).translate(12, 1, -2), wallMat); deck.name = 'deck_test'; col.add(deck);
    const bx = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1).rotateY(0.5).translate(20, 1, -2), wallMat); bx.name = 'bld_test'; col.add(bx);
    const metal = new THREE.MeshStandardMaterial(); metal.name = 'metal';
    const rl = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 0.1).translate(12, 1.2, 6), metal); rl.name = 'solid_rail'; col.add(rl);
    const at = new THREE.Matrix4().makeTranslation(150, 0, -250);
    const st = rg.levelIngest(vis, col, at, 'test');
    const cell = rg.solidAt(151.5, 4, -251.5, 0), cell1 = rg.solidAt(154.5, 2, -251.5, 0), tall = rg.solidAt(151.5, 8, -254.5, 0);
    const g = rg.groundAt(162, -252, 1.2, 0.5);
    const b = rg.solidAt(170, 1, -252, 0);
    const yawOk = b && Math.abs(((b.yaw - 0.5) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2)) < 0.01 || (b && Math.abs(((b.yaw - 0.5) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2) - Math.PI / 2) < 0.01);
    const rp = rg.PATHS.slice(railsBefore).find(q => /test rail/.test(q.name));
    say('import: cells become walls of their height', cell && cell1 && tall && cell.y1 === 6 && cell1.y1 === 3 && tall.y1 === 9, `cells ${st.cells}, tops ${cell && cell.y1}/${cell1 && cell1.y1}/${tall && tall.y1}`);
    say('import: deck_ is a floor, bld_ a box at its own yaw', g.hit && Math.abs(g.floor - 1) < 0.01 && !!b && yawOk && Math.abs(Math.max(b.hx, b.hz) - 2) < 0.02,
      `floor ${g.hit ? fix(g.floor) : 'none'}, box yaw ${b ? fix(b.yaw * 180 / Math.PI, 1) : '-'} deg, half ${b ? fix(b.hx) + 'x' + fix(b.hz) : '-'}`);
    say('import: a metal box is a rail along its top', !!rp && Math.abs(rp.segs[0].a.y - 1.25) < 0.01, rp ? `${rp.segs.length} segments at y ${fix(rp.segs[0].a.y)}` : 'none');
    place(146, 0, -251.5, Math.PI / 2, 8); let worst = 0; run(1.5, () => { worst = Math.max(worst, P.pos.x); });
    say('import: she stops at an imported wall', worst < 150 - rg.SOLID.r + 0.03, `stopped at x ${fix(worst)} (face at 150)`);
    say('import: added boxes', S.all.length - before >= 4, `${S.all.length - before}`); }
  // 13. HIS REAL FILES: the kit pieces skin the district, his four generated buildings come in whole
  { const kit = await realGLB('models/kit/building_kit_pieces.glb');
    rg.kitFrom(kit.scene);
    const names = new Set(rg.KIT.place.map(q => q[0])), miss = [...names].filter(n => !rg.KIT.lib[n] || !rg.KIT.lib[n].length);
    say('kit: every piece the city asks for is in his file', !miss.length && rg.KIT.meshes.length > 0 && !rg.CITY.fallback.visible,
      `${names.size} piece kinds -> ${rg.KIT.meshes.length} instanced meshes${miss.length ? ', MISSING ' + miss.join(' ') : ''}, stand-in boxes hidden`);
    const L = rg.LEVEL.imports[0];
    const [vis, col] = await Promise.all([realGLB(L.vis), realGLB(L.col)]);
    const at = new THREE.Matrix4().makeTranslation(L.at[0], L.at[1], L.at[2]);
    const nMats = new Set(); vis.scene.traverse(o => { if (o.isMesh && !/^col_/.test(o.name)) nMats.add(o.material); });
    const st = rg.levelIngest(vis.scene, col.scene, at, L.name);
    say('his BKG0-3: drawn, one mesh per material', st.mats === nMats.size && st.meshes > 300, `${st.meshes} meshes -> ${st.mats} draws (${nMats.size} materials)`);
    say('his BKG0-3: cells -> walls, decks -> floors, bld -> boxes', st.cells === 35 && st.floors > 100 && st.boxes > 150, JSON.stringify(st));
    // up the bank onto BKG2, over its parapet, onto its roof
    place(-85.5, 0, 139, 0, 16); let top = 0, land = null;
    run(3, () => { top = Math.max(top, P.pos.y); if (P.grounded && !land && P.pos.z > 152.4 && Math.abs(P.pos.y - 3) < 0.1) land = P.pos.clone(); });
    say('up the bank onto his low building\'s roof at 16 m/s', !!land, land ? `over the parapet (top ${fix(top)} m), on the roof at ${fix(land.x, 1)}, ${fix(land.y)}, ${fix(land.z, 1)}` : `top ${fix(top)} m, never on the roof`);
    // a wall of his: straight at BKG0's south face
    place(-118.5, 0, 148, 0, 9); let worst = 0; run(1.2, () => { worst = Math.max(worst, P.pos.z); });
    say('his BKG0 is a wall', worst < 152 - rg.SOLID.r + 0.05, `stopped at z ${fix(worst)} (face at 152)`);
    const hyd = await realGLB('models/props/prop_hydrant.glb');
    rg.hydFrom(hyd.scene);
    say('his hydrant: a body and a cap', rg.HYD.parts.body.length > 0 && rg.HYD.parts.cap.length > 0, `${rg.HYD.parts.body.length} body parts, ${rg.HYD.parts.cap.length} cap parts`); }
  return ok;
};

// r47: A HELD THUMB IS A FIXED DIRECTION. The follow camera used to drag the steering frame round with it, so a
// held diagonal circled her for ever. Driven with the REAL camera stepping beside her, because the bug lived in
// the loop between the two: a harness without `stepCam` cannot see it at all.
CASES.steer = () => {
  let ok = true; const D = 180 / Math.PI;
  // r106: each row has its own start and a frame turned by A, picked off a measured clear corridor (`npm run sim` + a ray
  // probe) -- every district built since r100 has landed on the last spot. The whole test turns with A, so `travel` is
  // read relative to it.
  const go = (phases, latch, at = [-288, -72], A = Math.PI / 4) => {
    const keep = rg.CAM.steerLatch; rg.CAM.steerLatch = latch;
    place(at[0], 0, at[1], A, 10); rg.cam.az = rg.cam.steerAz = A; rg.cam.idle = 9; rg.cam.thA = null; rg.stick.L.down = 1;
    let turned = 0, last = P.heading, aim = 0;
    for (const [dur, fx] of phases) { const n = Math.round(dur / DT);
      for (let i = 0; i < n; i++) { const [x, y] = fx(i / n); rg.stick.L.x = x; rg.stick.L.y = y;
        rg.stepPlayer(DT); rg.stepCam(DT); turned += Math.abs(rg.wrapAngle(P.heading - last)); last = P.heading;
        const s = rg.stickWorld(); aim = Math.atan2(s.x, s.z); } }
    if (process.env.STP) console.log('    ends at', fix(P.pos.x, 1), fix(P.pos.z, 1), 'from', JSON.stringify(phases.map(q => q[0])));
    rg.stick.L.down = 0; rg.stick.L.x = rg.stick.L.y = 0; rg.CAM.steerLatch = keep;
    return { turned: turned * D, off: Math.abs(rg.wrapAngle(Math.atan2(P.vel.x, P.vel.z) - aim)) * D, travel: rg.wrapAngle(Math.atan2(P.vel.x, P.vel.z) - A) * D };
  };
  // r84: on the r83 push -- this measures the steering FRAME, and at the new acceleration the 2 s run reaches the obstacles
  // past this spot at 18 m/s and the row measures the crash instead
  const keepK = { hardK: rg.SK.hardK, hardP: rg.SK.hardP }; Object.assign(rg.SK, { hardK: 1, hardP: 1 });
  const diag = [[5, () => [-0.7, -0.7]]];
  const a = go(diag, 1), b = go(diag, 0);
  console.log(`  held up-left diagonal, 5 s:      turned ${fix(a.turned, 0)} deg, travel ${fix(a.travel, 0)} (asked 45)   [old frame: turned ${fix(b.turned, 0)} deg]`);
  if (!(a.turned < 70 && Math.abs(a.travel - 45) < 5 && b.turned > 200)) ok = false;
  const swing = [[2, () => [1, 0]], [0.25, u => [Math.cos(u * Math.PI), -Math.sin(u * Math.PI)]], [3, () => [-1, 0]]];
  const c = go(swing, 1, [-210, -72], 0);
  console.log(`  right 2 s, swung over to left:   ends ${fix(c.off, 1)} deg off where the thumb points, travel ${fix(c.travel, 0)}`);
  if (!(c.off < 5)) ok = false;
  Object.assign(rg.SK, keepK);
  return ok;
};
// r47: TONY HAWK'S VERT AIR. Up the half pipe and off the lip: square to the wall the whole way up and down (her up
// stays the wall's normal), back in, forward, nothing to snap at the landing. Holding the right stick UP partway
// through turns it into a transfer onto the deck, without becoming a grab.
// ---------------------------------------------------------------- r80: THE BOOST (left flick up) and the slide (left flick down)
// *"Make the slide tackle a flick down on the left stick, and a flick forward or up is the boost ... I want it to actually
// boost speed so you can really launch off a jump."* Through the shipped `boostStep` inside `stepPlayer`, and the two
// flicks through the real left pad.
CASES.boost = async () => {
  let ok = true; const say = (label, good, msg) => { console.log(`  ${label.padEnd(50)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const B = rg.BOOST, wait = ms => new Promise(r => setTimeout(r, ms));
  const coast = (sec, fn) => run(sec, () => { rg.stick.L.x = rg.stick.L.y = 0; if (fn) fn(); });
  // 1. cruising: the speed goes up by about `add`, as a stroke over `dur`, and stays
  // (against the SAME run with no boost, so the coast fade and the rolling drag are the same on both)
  place(60, 1, -60, 0, 12); P.boostCool = 0; P.boostT = 0; P.flatT = 0; coast(B.dur + 0.2); const vC = P.vel.length();
  place(60, 1, -60, 0, 12); P.boostCool = 0; P.flatT = 0; const v0 = P.vel.length(); let first = 0;
  let lastV = v0; const ok1 = rg.boostGo(); coast(B.dur + 0.2, () => { const v = P.vel.length(); first = Math.max(first, v - lastV); lastV = v; }); const v1 = P.vel.length();
  say(`cruising at 12 m/s: a boost takes her to ${fix(v1, 1)} m/s`, ok1 && v1 > vC + B.add * 0.85, `+${fix(v1 - vC, 1)} over the same run unboosted (add ${B.add})`);
  say('...spread over a stroke, not landed on one frame', first < B.add * 0.15, `biggest one-frame gain +${fix(first, 2)} m/s`);
  // 2. the cooldown, and the panel's speed cap
  say('a second boost straight away is refused (cooldown)', !rg.boostGo(), '');
  coast(B.cool); say(`after ${B.cool} s it boosts again`, rg.boostGo(), ''); coast(B.dur + 0.1);
  place(60, 1, -60, 0, B.cap - 3); P.boostCool = 0; rg.boostGo(); coast(B.dur + 0.1);
  say(`never past the cap (${B.cap} m/s)`, P.vel.length() < B.cap + 0.05, `${fix(P.vel.length(), 2)} m/s`);
  // 3. from a standstill she goes
  place(60, 1, -60, 0, 0); P.boostCool = 0; rg.boostGo(); coast(B.dur + 0.1);
  say('from a standstill a boost gets her moving', P.vel.length() > B.add * 0.8, `${fix(P.vel.length(), 1)} m/s`);
  // 4. LAUNCH: the park's kicker at (-11, 14), coasting in from 20 m back at 10 m/s, with and without a boost at the start
  const fly = boost => { place(-11, 1, -6, 0, 10); P.boostCool = 0; if (boost) rg.boostGo();
    let ph = 0, apex = -9, z0 = 0, z1 = 0; coast(5, () => { if (ph === 0 && !P.grounded && P.pos.z > 8) { ph = 1; z0 = P.pos.z; }
      if (ph === 1) { if (P.grounded) ph = 2; else { apex = Math.max(apex, P.pos.y); z1 = P.pos.z; } } }); return { apex, d: z1 - z0 }; };
  const a = fly(false), b = fly(true);
  say('off the kicker a boost really launches her', b.apex > a.apex + 1 && b.d > a.d * 1.4, `apex ${fix(a.apex)} -> ${fix(b.apex)} m, flew ${fix(a.d, 1)} -> ${fix(b.d, 1)} m`);
  // 5. the left pad: flick UP is the boost, flick DOWN is the slide tackle
  const L = document.getElementById('stkL'), keepR = rg.girl.ready; rg.girl.ready = false;      // headless: a slide runs without clips (`melOk`)
  const ev = (type, x, y) => ({ type, pointerId: 77, clientX: x, clientY: y, stopPropagation() {}, preventDefault() {}, target: L });
  for (const [name, y1, want] of [['flick UP', 60, 'boost'], ['flick DOWN', 240, 'slide']]) {
    place(60, 1, -60, 0, 8); P.boostCool = 0; P.boostT = 0; P.mel = null; await wait(400);      // past `FLICK.gap` since the last flick
    L.dispatchEvent(ev('pointerdown', 150, 150)); L.dispatchEvent(ev('pointermove', 150, y1)); await wait(30); L.dispatchEvent(ev('pointerup', 150, y1));
    const got = P.boostT > 0 ? 'boost' : P.mel && P.mel.kind === 'slide' ? 'slide' : P.mel ? P.mel.kind : 'nothing';
    say(`left pad on the ground, ${name}: ${want}`, got === want, got);
  }
  rg.stick.L.x = rg.stick.L.y = 0; rg.stick.L.down = 0; P.mel = null; rg.girl.ready = keepR;
  return ok;
};
// ---------------------------------------------------------------- r82: THE PADS SWAP JOBS (`CTRL.map` 2)
// *"Right stick controls rotation and flips; left stick the grabs; left stick on the ground the melee; right stick the
// speed boost; a flick down on the right stick switches fakie / regular."* Every gesture through the REAL pads and the
// shipped bindings; the other cases run on `map` 1, the layout they were written against (a stated gap, `intent`'s rule).
// r83: THE LEVEL-BUILDING NAMES A BLENDER SESSION CAN USE, through the shipped levelIngest on a scene built the way
// GLTFLoader hands one over: gems (a marker, and strung along a rail line), a trampoline, a boost lane, and a bld_
// roof whose edge is a lip she can grind with no rail authored. Up at y 80 so it overlaps nothing in the park.
CASES.levelkit = () => {
  let ok = true; const say = (label, good, msg) => { console.log(`  ${label.padEnd(52)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const col = new THREE.Group(), mat = new THREE.MeshStandardMaterial(); mat.name = 'concrete';
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), mat); fl.name = 'deck_floor'; col.add(fl);
  const bx = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6).translate(0, 2, -12), mat); bx.name = 'bld_tower'; col.add(bx);
  const E = (name, x, y, z, ud) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); o.userData = ud || {}; col.add(o); return o; };
  E('marker_gem_a', 5, 1, 0);
  E('rail_gemline', 0, 0, 0, { grind_path_gltf: JSON.stringify([[-12, 3.2, 8], [12, 3.2, 8]]), gems: 4 });
  E('marker_trampoline_t', 10, 0, -4, { radius: 2 });
  E('lane_test', 0, 0, 0, { path_gltf: JSON.stringify([[-15, 0, 2], [15, 0, 2]]), half_width: 2, speed: 22, accel: 16 });
  col.updateMatrixWorld(true);
  const ox = -300, oy = 80, oz = -300, at = new THREE.Matrix4().makeTranslation(ox, oy, oz);
  const g0 = rg.GEM.list.length, b0 = rg.ORB.bounce.length, l0 = rg.ORB.lanes.length, r0 = rg.PATHS.length;
  const st = rg.levelIngest(null, col, at, 'lk');
  say('a marker_gem_ and a rail_ with gems: 4 string gems', rg.GEM.list.length - g0 >= 6 && !!rg.GEM.mesh && rg.GEM.mesh.count === rg.GEM.list.length, `${rg.GEM.list.length - g0} gems, mesh holds ${rg.GEM.mesh ? rg.GEM.mesh.count : 0}`);
  const rp = rg.PATHS.slice(r0).find(q => /gemline/.test(q.name));
  say('the rail line grinds where it was drawn', !!rp && Math.abs(rp.segs[0].a.y - (oy + 3.2)) < 0.01, rp ? `y ${fix(rp.segs[0].a.y)}` : 'none');
  say('a marker_trampoline_ and a lane_ are registered', rg.ORB.bounce.length === b0 + 1 && rg.ORB.lanes.length === l0 + 1, `trampolines +${rg.ORB.bounce.length - b0}, lanes +${rg.ORB.lanes.length - l0}`);
  // the trampoline throws her up
  place(ox + 10, oy, oz - 4, 0, 0); let vy = 0; run(0.3, () => { rg.stepCity(DT); vy = Math.max(vy, P.vel.y); });
  say('  standing on the trampoline throws her up', vy > rg.ORB.bounceV * 0.8, `vy ${fix(vy, 1)} (bounceV ${rg.ORB.bounceV})`);
  // the lane pushes her along it
  place(ox - 12, oy, oz + 2, Math.PI / 2, 6); run(1.2, () => rg.stepCity(DT)); const vLane = Math.hypot(P.vel.x, P.vel.z);
  place(ox - 12, oy, oz + 8.5, Math.PI / 2, 6); run(1.2, () => rg.stepCity(DT)); const vOff = Math.hypot(P.vel.x, P.vel.z);
  say('  the lane pushes her toward its speed', vLane > vOff + 4 && vLane > 12, `on ${fix(vLane, 1)} m/s, beside it ${fix(vOff, 1)}`);
  // the roof edge is a lip with no rail authored
  const lips = rg.lipEdges(ox + 3, oz - 12, 1.5, oy + 3, oy + 5, 0.5);
  say('a bld_ roof edge is a grindable lip (no rail authored)', lips.some(e => Math.abs(e.a[1] - (oy + 4)) < 0.05 && Math.abs(e.b[1] - (oy + 4)) < 0.05), `${lips.length} lip edges, at y ${lips.map(e => fix(e.a[1])).join(' ')}`);
  // the gem is collected
  const gi = rg.GEM.list.findIndex((q, i) => i >= g0 && Math.abs(q.x - (ox + 5)) < 0.01); const got0 = rg.GEM.got;
  place(ox + 5, oy, oz - 3, 0, 4); run(1.2, () => rg.stepCity(DT));
  say('  skating through the gem picks it up', gi >= 0 && rg.GEM.list[gi].got && rg.GEM.got > got0, `got ${rg.GEM.got - got0}`);
  console.log(`  ingest: ${JSON.stringify(st)}`);
  // r85: A LIFT. A pad at the foot of a 24 m wide tower, the target in the middle of its roof, 14 m in: no parabola clears the tower's side,
  // so it goes straight up the column and across at the top (`launchSolve` 'lift', `stepOrbital`'s second half)
  { const c2 = new THREE.Group(); const tw = new THREE.Mesh(new THREE.BoxGeometry(24, 30, 24).translate(0, 15, -30), mat); tw.name = 'bld_tower2'; c2.add(tw);
    const f2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2).translate(10, 0, -30), mat); f2.name = 'deck_floor2'; c2.add(f2);
    const pd = new THREE.Object3D(); pd.name = 'marker_launcher_lift'; pd.position.set(14, 0, -30); pd.userData = { kind: 'launcher', target_gltf: JSON.stringify([0, 30.1, -30]), apex: 34, radius: 2 }; c2.add(pd);
    c2.updateMatrixWorld(true); rg.levelIngest(null, c2, new THREE.Matrix4().makeTranslation(-300, 80, -300), 'lk2');
    const L = rg.ORB.launch.at(-1); place(L.x, L.y, L.z, Math.PI, 0); let land = null, air = false;
    run(6, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.stepCity(DT); if (!P.grounded) air = true; else if (air && !land) land = P.pos.clone(); });
    say('a pad at the foot of a tower lifts her onto its roof', L.clear === 'lift' && !!land && Math.abs(land.y - L.ty) < 0.5 && Math.hypot(land.x - L.tx, land.z - L.tz) < 2,
      `arc ${L.clear}, ${land ? `landed ${fix(Math.hypot(land.x - L.tx, land.z - L.tz), 1)} m from the target at y ${fix(land.y, 1)} (roof ${fix(L.ty, 1)})` : 'never landed'}`); }
  return ok;
};
// r84: *"get her up to speed from a dead stop quicker ... really pull the stick hard and she speed skates ... a quick speed stop
// and then cut the other way ... harder turns, really agile."* Every row against the r83 numbers as the control, on the x = 60
// strip, the shipped `stepPlayer` all the way.
CASES.agile = () => {
  let ok = true; const say = (label, good, msg) => { console.log(`  ${label.padEnd(52)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const SK = rg.SK, keep = { ...SK }, OLD = { softK: 1, hardK: 1, softP: 1, hardP: 1, turn: 7, turnV: 2.4, gripA: 30, brake: 12 };
  const as = o => Object.assign(SK, o), back = () => Object.assign(SK, keep);
  const launch = (raw) => { place(60, 1, -66, 0, 0); P.drive = 0; let t10 = null, at1 = 0, at2 = 0, top = 0;
    run(3, (t) => { rg.stick.L.x = 0; rg.stick.L.y = -raw; if (t > 0 && t10 == null && P.speed >= 10) t10 = t; if (Math.abs(t - 1) < DT / 2) at1 = P.speed; if (Math.abs(t - 2) < DT / 2) at2 = P.speed; top = Math.max(top, P.speed); });
    return { t10, at1, at2, drive: P.drive }; };
  as(OLD); const o = launch(1); back(); const n = launch(1), l = launch(0.6);
  say('full stick from a standstill gets up to speed quicker', n.t10 != null && (o.t10 == null || n.t10 < o.t10 * 0.8),
    `10 m/s at ${n.t10 != null ? fix(n.t10) : '-'} s (r83 ${o.t10 != null ? fix(o.t10) : 'never'}); at 1 s ${fix(n.at1, 1)} vs ${fix(o.at1, 1)}, at 2 s ${fix(n.at2, 1)} vs ${fix(o.at2, 1)}`);
  say('  a light thumb is the casual stride, a full one the speed skate', l.drive < 0.2 && n.drive > 0.9 && l.at2 > 3 && l.at2 < n.at2 - 2, `drive ${fix(l.drive)} / ${fix(n.drive)}, at 2 s ${fix(l.at2, 1)} vs ${fix(n.at2, 1)} m/s`);
  // the speed stop
  place(60, 1, -66, 0, 18); rg.stick.L.x = rg.stick.L.y = 0; const z0 = P.pos.z; const okS = rg.speedStop(); let tS = null;
  run(1.5, (t) => { if (t > 0 && tS == null && P.speed < 0.6) tS = t; });
  as(OLD); place(60, 1, -66, 0, 18); let tB = null; run(3, (t) => { rg.stick.L.x = 0; rg.stick.L.y = 1; if (t > 0 && tB == null && P.speed < 0.6) tB = t; }); back();
  place(60, 1, -66, 0, 18); let tB2 = null; run(3, (t) => { rg.stick.L.x = 0; rg.stick.L.y = 1; if (t > 0 && tB2 == null && P.speed < 0.6) tB2 = t; });
  say('speed stop from 18 m/s', okS && tS != null && tS < 0.6, `stopped in ${tS != null ? fix(tS) : '-'} s (held brake: r83 ${tB != null ? fix(tB) : '-'} s, now ${tB2 != null ? fix(tB2) : '-'} s)`);
  // the cut: stop, then the thumb straight to her right -- she goes that way, at once
  place(60, 1, -66, 0, 15); rg.speedStop(); run(0.15, () => { rg.stick.L.x = rg.stick.L.y = 0; });
  const want = Math.atan2(rg.stickWorld ? 1 : 1, 0); let tC = null;
  run(2, (t) => { rg.stick.L.x = 1; rg.stick.L.y = 0; const w = rg.stickWorld(); const tgt = Math.atan2(w.x, w.z), trav = Math.atan2(P.vel.x, P.vel.z);
    if (tC == null && P.hSpeed > 8 && Math.abs(rg.wrapAngle(trav - tgt)) < 0.2) tC = t; });
  say('  ...and cut the other way', tC != null && tC < 1.2, `going 8 m/s toward the thumb ${tC != null ? fix(tC) : 'never'} s after it went down`);
  // the turn: 90 degrees at 15 m/s
  const turn = () => { place(60, 1, -66, 0, 15); let t90 = null; run(2, (t) => { rg.stick.L.x = 1; rg.stick.L.y = 0; rg.cam.az = 0; rg.cam.steerAz = 0;
      const trav = Math.atan2(P.vel.x, P.vel.z); if (t90 == null && Math.abs(Math.abs(trav) - Math.PI / 2) < 0.08) t90 = { t, v: P.hSpeed }; }); return t90; };
  as(OLD); const tO = turn(); back(); const tN = turn();
  say('a 90 degree carve at 15 m/s is quicker', tN && (!tO || tN.t < tO.t), `${tN ? fix(tN.t) + ' s, ' + fix(tN.v, 1) + ' m/s' : 'never'} (r83 ${tO ? fix(tO.t) + ' s, ' + fix(tO.v, 1) + ' m/s' : 'never'})`);
  back(); rg.stick.L.x = rg.stick.L.y = 0;
  return ok;
};
// r84: THE LAYOUT, THROUGH THE REAL PADS. Left flick down: the speed stop on the ground, the grind dive in the air (the slide
// tackle's pose, no shove forward); right flick: boost on the ground (sideways too), and a FLIP every way in the air.
CASES.ctrl84 = async () => {
  let ok = true; const say = (label, good, msg) => { console.log(`  ${label.padEnd(52)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  rg.CTRL.map = 3; const wait = ms => new Promise(r => setTimeout(r, ms));
  const keep = { m: rg.girl.moves, r: rg.girl.ready, lock: P.stanceLock };
  rg.girl.moves = gameClips('models/alien_rollerskate_blue.glb').moves; rg.girl.ready = false; P.stanceLock = true;
  const L = document.getElementById('stkL'), R = document.getElementById('stkR');
  const ev = (el, id) => (type, x, y) => ({ type, pointerId: id, clientX: x, clientY: y, stopPropagation() {}, preventDefault() {}, target: el });
  const eL = ev(L, 71), eR = ev(R, 72);
  const flick = async (e, el, dx, dy, frames) => { await wait(160); el.dispatchEvent(e('pointerdown', 150, 150)); el.dispatchEvent(e('pointermove', 150 + dx, 150 + dy));
    if (frames) run(frames); await wait(30); el.dispatchEvent(e('pointerup', 150 + dx, 150 + dy)); };
  const ground = (v) => { place(60, 1, -60, 0, v || 10); P.rHold = 0; P.lDown = 0; P.boostT = 0; P.boostCool = 0; P.mel = null; P.melQ = null; P.flip = null; P.stance = 1; P.stopT = 0; P.dive = null; rg.cam.az = 0; };
  const air = () => { ground(6); P.grounded = false; P.coyote = 0; P.pos.y += 7; P.vel.y = 2; P.airT = 0.3; };
  ground(14); await flick(eL, L, 0, 70); say('ground, LEFT flick down: the speed stop', P.stopT > 0 && !P.mel, `stopT ${fix(P.stopT || 0)}`);
  run(0.8); say('  ...and she has stopped', P.hSpeed < 0.6, `${fix(P.hSpeed)} m/s`);
  ground(); await flick(eL, L, 70, 0); say('ground, LEFT flick sideways: a strike', P.mel && P.mel.kind === 'strike', P.mel ? P.mel.kind : 'nothing');
  ground(); await flick(eR, R, 0, -70); say('ground, RIGHT flick up: the boost', P.boostT > 0, `boostT ${fix(P.boostT || 0, 2)}`);
  ground(); await flick(eR, R, 70, 0); say('ground, RIGHT flick sideways: the boost too', P.boostT > 0, `boostT ${fix(P.boostT || 0, 2)}`);
  ground(); await flick(eR, R, 0, 70); say('ground, RIGHT flick down: switch stance', P.stance === -1, `stance ${P.stance}`);
  for (const [dx, dy, want] of [[0, -70, 'up'], [0, 70, 'down'], [70, 0, 'right'], [-70, 0, 'left']]) {
    air(); await flick(eR, R, dx, dy, 0.15); say(`air, RIGHT flick ${want}: a flip`, P.flip && P.flip.dir === want && !P.dive, P.flip ? P.flip.dir + ' flip' : (P.dive ? 'a DIVE' : 'nothing')); }
  // the dive moved to the left pad: over rail 0 it lands her on it; over nothing it still drives her down
  { rg.GRIND.intent = 1; const R0 = rg.PATHS.find(Q => Q.name === 'park'), bar = R0.segs[0].a.y;
    air(); P.pos.set(-37, bar + 5, -3); P.vel.set(0, 2, 6); P.grindWant = 0; P.grindCool = 0; P.grindLast = null;
    await flick(eL, L, 0, 70); const dv = !!P.dive, hv = Math.hypot(P.vel.x, P.vel.z); let got = null; run(1.5, () => { if (P.grind && !got) got = P.grind.rail.path; });
    say('air over rail 0, LEFT flick down: the dive onto it', dv && !P.flip && got === R0, got === R0 ? 'grinding rail 0' : (P.flip ? 'a FLIP' : 'no grind'));
    air(); const h0 = Math.hypot(P.vel.x, P.vel.z); await flick(eL, L, 0, 70);
    say('  over nothing: an open dive, and no shove forward', !!P.dive && P.vel.y < -5 && Math.hypot(P.vel.x, P.vel.z) <= h0 + 0.05, `vy ${fix(P.vel.y, 1)}, speed ${fix(h0, 1)} -> ${fix(Math.hypot(P.vel.x, P.vel.z), 1)}`);
    rg.GRIND.intent = 0; }
  air(); await flick(eL, L, 70, 0); say('air, LEFT flick sideways: the air strike', P.mel && P.mel.kind === 'strike' && !P.flip, P.mel ? P.mel.kind : 'nothing');
  // r89: MAP 4 -- the same flicks, and the two air HOLDS swapped back: the left thumb turns her, the right one grabs
  if (rg.CTRL.map === 3) {
    rg.CTRL.map = 4; console.log('  -- map 4 (r89): every row above again, then the air holds');
    ground(14); await flick(eL, L, 0, 70); say('ground, LEFT flick down: the speed stop', P.stopT > 0 && !P.mel, `stopT ${fix(P.stopT || 0)}`);
    ground(); await flick(eR, R, 0, -70); say('ground, RIGHT flick up: the boost', P.boostT > 0, `boostT ${fix(P.boostT || 0, 2)}`);
    for (const [dx, dy, want] of [[0, -70, 'up'], [70, 0, 'right']]) {
      air(); await flick(eR, R, dx, dy, 0.15); say(`air, RIGHT flick ${want}: a flip, and no grab`, P.flip && P.flip.dir === want && !P.grab, P.flip ? P.flip.dir + ' flip' + (P.grab ? ' + GRAB' : '') : 'nothing'); }
    air(); await flick(eL, L, 70, 0); say('air, LEFT flick sideways: the air strike', P.mel && P.mel.kind === 'strike' && !P.flip, P.mel ? P.mel.kind : 'nothing');
    const hold = async (e, el, dx, dy, sec, fn) => { await wait(160); el.dispatchEvent(e('pointerdown', 150, 150)); el.dispatchEvent(e('pointermove', 150 + dx, 150 + dy)); run(sec, fn); el.dispatchEvent(e('pointerup', 150 + dx, 150 + dy)); };
    // LEFT HOLD: she turns to where the thumb points (through the camera), and no grab
    { air(); P.vel.y = 8; P.mel = null; let grab = null; const h0 = P.heading;
      await hold(eL, L, 70, 0, 0.6, () => { if (P.grab) grab = P.grab.k; });
      const want = -Math.PI / 2; say('air, LEFT thumb held right: she turns to it, no grab', Math.abs(rg.wrapAngle(P.heading - want)) < 0.15 && !grab, `heading ${fix(h0 * 57.3, 0)} -> ${fix(P.heading * 57.3, 0)} deg (thumb ${fix(want * 57.3, 0)})${grab ? ', GRAB ' + grab : ''}`); }
    // RIGHT HOLD pressed in the air: the grab by direction, and her heading left alone
    { air(); P.vel.y = 8; let grab = null; const h0 = P.heading;
      await hold(eR, R, 70, 0, 0.6, () => { if (P.grab && !grab) grab = P.grab.k; });
      say('air, RIGHT thumb held right (pressed in the air): the right grab', grab === 'right' && Math.abs(rg.wrapAngle(P.heading - h0)) < 0.05, `grab ${grab || 'NONE'}, turned ${fix(rg.wrapAngle(P.heading - h0) * 57.3, 1)} deg`); }
    // ...and a right thumb already down when she leaves the ground (a camera drag) never grabs
    { ground(8); let grab = null; R.dispatchEvent(eR('pointerdown', 150, 150)); R.dispatchEvent(eR('pointermove', 220, 150)); run(0.3);
      P.jump = 1; run(0.8, () => { if (!P.grounded && P.grab) grab = grab || P.grab.k; }); R.dispatchEvent(eR('pointerup', 220, 150));
      say('  a right thumb held from the ground through a jump: no grab', !grab, grab ? 'GRAB ' + grab : 'the air pose'); }
    // ...and one pressed IN the air and still held after she lands is spent: the next jump does not grab (r87's rule)
    { ground(8); P.jump = 1; run(0.15); R.dispatchEvent(eR('pointerdown', 150, 150)); R.dispatchEvent(eR('pointermove', 220, 150));
      let g1 = null, g2 = null; run(2.5, () => { if (!P.grounded && P.grab) g1 = g1 || P.grab.k; });
      const landed = P.grounded; P.jump = 1; run(0.8, () => { if (!P.grounded && P.grab) g2 = g2 || P.grab.k; }); R.dispatchEvent(eR('pointerup', 220, 150));
      say('  pressed in the air, held through the landing: the next jump does not grab', g1 === 'right' && landed && !g2, `first air ${g1 || 'no grab'}, ${landed ? 'landed' : 'NEVER LANDED'}, next air ${g2 ? 'GRAB ' + g2 : 'the air pose'}`); }
    rg.CTRL.map = 3;
  }
  rg.girl.moves = keep.m; rg.girl.ready = keep.r; P.stanceLock = keep.lock; P.mel = null; P.flip = null; P.dive = null; P.stopT = 0; P.grab = null; rg.CTRL.map = 1;
  return ok;
};
CASES.ctrl = async () => {
  let ok = true; const say = (label, good, msg) => { console.log(`  ${label.padEnd(52)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  rg.CTRL.map = 2; const wait = ms => new Promise(r => setTimeout(r, ms));
  const keep = { m: rg.girl.moves, r: rg.girl.ready, lock: P.stanceLock };
  rg.girl.moves = gameClips('models/alien_rollerskate_blue.glb').moves; rg.girl.ready = false; P.stanceLock = true;
  const L = document.getElementById('stkL'), R = document.getElementById('stkR');
  const ev = (el, id) => (type, x, y) => ({ type, pointerId: id, clientX: x, clientY: y, stopPropagation() {}, preventDefault() {}, target: el });
  const eL = ev(L, 61), eR = ev(R, 62);
  // `frames`: game time run while the thumb is across the pad, as a real flick spans several frames
  const flick = async (e, el, dx, dy, frames) => { await wait(160); el.dispatchEvent(e('pointerdown', 150, 150)); el.dispatchEvent(e('pointermove', 150 + dx, 150 + dy));
    if (frames) run(frames); await wait(30); el.dispatchEvent(e('pointerup', 150 + dx, 150 + dy)); };
  const ground = (v) => { place(60, 1, -60, 0, v || 6); P.rHold = 0; P.lDown = 0; P.boostT = 0; P.boostCool = 0; P.mel = null; P.melQ = null; P.flip = null; P.stance = 1; rg.cam.az = 0; };
  const air = () => { ground(6); P.grounded = false; P.coyote = 0; P.pos.y += 7; P.vel.y = 2; P.airT = 0.3; };
  // GROUND
  ground(); await flick(eR, R, 0, -70); say('ground, RIGHT flick up: the boost', P.boostT > 0 && !P.mel, `boostT ${fix(P.boostT || 0, 2)}`);
  ground(); await flick(eR, R, 0, 70); say('ground, RIGHT flick down: switch to fakie', P.stance === -1, `stance ${P.stance}`);
  await flick(eR, R, 0, 70); say('...and again: back to regular', P.stance === 1, `stance ${P.stance}`);
  ground(); await flick(eL, L, 0, 70); say('ground, LEFT flick down: the slide tackle', P.mel && P.mel.kind === 'slide', P.mel ? P.mel.kind : 'nothing');
  ground(); await flick(eL, L, 70, 0); say('ground, LEFT flick sideways: a strike', P.mel && P.mel.kind === 'strike', P.mel ? P.mel.kind : 'nothing');
  ground(); await flick(eL, L, 0, -70); say('ground, LEFT flick up: a strike (no boost on the left now)', P.mel && P.mel.kind === 'strike' && !(P.boostT > 0), P.mel ? P.mel.kind : 'nothing');
  // up the half pipe's wall the right swipe up is still the transfer
  place(0, 3, 29, 0, 13); rg.cam.az = 0; P.xferArm = 0; { let st = false; for (let i = 0; i < 180 && !st; i++) { rg.stepPlayer(DT); st = P.grounded && P.n.y < 0.6; }
    await flick(eR, R, 0, -70); say('on the pipe wall, RIGHT flick up: still the transfer', st && P.xferArm > 0 && !(P.boostT > 0), st ? (P.xferArm > 0 ? 'armed' : 'not armed') : 'never reached the wall'); }
  // AIR
  for (const [dx, dy, want] of [[0, -70, 'up'], [0, 70, 'down'], [70, 0, 'right'], [-70, 0, 'left']]) {
    air(); const h0 = P.heading; await flick(eR, R, dx, dy, 0.15);
    say(`air, RIGHT flick ${want}: a flip, and no spin from the flick`, P.flip && P.flip.dir === want && Math.abs(rg.wrapAngle(P.heading - h0)) < 0.05, `${P.flip ? P.flip.dir + ' flip' : 'nothing'}, turned ${fix(rg.wrapAngle(P.heading - h0) * 57.3, 1)} deg`); }
  // a flick DOWN with a rail in reach is r81's dive at it, not a back flip
  { rg.GRIND.intent = 1; const R0 = rg.PATHS.find(Q => Q.name === 'park'), bar = R0.segs[0].a.y; air(); P.pos.set(-37, bar + 5, -3); P.vel.set(0, 2, 6); P.grindWant = 0; P.grindCool = 0; P.grindLast = null;
    await flick(eR, R, 0, 70); let got = null; run(1.5, () => { if (P.grind && !got) got = P.grind.rail.path; });
    say('air over rail 0, RIGHT flick down: the dive onto it', !P.flip && got === R0, got === R0 ? 'grinding rail 0' : (P.flip ? 'a back FLIP' : 'no grind')); rg.GRIND.intent = 0; }
  air(); await flick(eL, L, 70, 0); say('air, LEFT flick: the air strike', P.mel && P.mel.kind === 'strike' && !P.flip, P.mel ? P.mel.kind : (P.flip ? 'a FLIP' : 'nothing'));
  // the RIGHT thumb HELD turns her to point where it points; the left held is a grab and pushes her nowhere
  air(); P.vel.y = 8; R.dispatchEvent(eR('pointerdown', 150, 150)); R.dispatchEvent(eR('pointermove', 210, 150));
  const want = Math.atan2(rg.padWorld(rg.stick.R).x, rg.padWorld(rg.stick.R).z); run(0.6, () => { rg.stick.L.x = rg.stick.L.y = 0; });
  R.dispatchEvent(eR('pointerup', 210, 150));
  say('air, RIGHT thumb held to the side: she turns to it', Math.abs(rg.wrapAngle(P.heading - want)) < 0.1, `${fix(rg.wrapAngle(P.heading - want) * 57.3, 1)} deg off the thumb`);
  air(); P.vel.y = 8; const hv0 = Math.hypot(P.vel.x, P.vel.z); let grab = null;
  L.dispatchEvent(eL('pointerdown', 150, 150)); L.dispatchEvent(eL('pointermove', 150, 90));
  run(0.5, () => { if (P.grab && !grab) grab = P.grab.k; }); L.dispatchEvent(eL('pointerup', 150, 90));
  const hv1 = Math.hypot(P.vel.x, P.vel.z);
  say('air, LEFT thumb held up: the up grab, and no thrust', grab === 'up' && Math.abs(hv1 - hv0) < 0.2, `grab ${grab || 'NONE'}, speed ${fix(hv0, 1)} -> ${fix(hv1, 1)}`);
  // and back on `map` 1 the left thumb still carries her, which says the test can tell the two apart
  rg.CTRL.map = 1; air(); P.vel.y = 8; P.lHold = 0; L.dispatchEvent(eL('pointerdown', 150, 150)); L.dispatchEvent(eL('pointermove', 150, 90));
  run(0.5); L.dispatchEvent(eL('pointerup', 150, 90)); const hv2 = Math.hypot(P.vel.x, P.vel.z); rg.CTRL.map = 2;
  say('...on the old layout the same hold pushes her', hv2 > hv0 + 0.5, `speed ${fix(hv0, 1)} -> ${fix(hv2, 1)}`);
  rg.stick.L.x = rg.stick.L.y = rg.stick.R.x = rg.stick.R.y = 0; rg.stick.L.down = rg.stick.R.down = 0;
  rg.girl.moves = keep.m; rg.girl.ready = keep.r; P.stanceLock = keep.lock; P.mel = null; P.flip = null; P.grab = null; rg.CTRL.map = 1;
  return ok;
};
CASES.vertair = () => {
  let ok = true; const D = 180 / Math.PI;
  const lip = 30 + 3 + 2.6 * Math.sin(rg.PARK.hpSweep) + rg.PARK.cope;
  const ride = (opt) => {
    const keep = { t: rg.VERT.holdTilt, x: rg.VERT.holdXferOn, f: rg.VERT.airFlickXfer };
    rg.VERT.holdTilt = opt.tilt; rg.VERT.holdXferOn = opt.xfer || 0; rg.VERT.airFlickXfer = opt.fx || 0;
    const keepRd = rg.girl.ready; rg.girl.ready = false;     // headless: strikes run without clips (`melOk`)
    place(0, 3, 29, 0, 17); P.dashed = 0; let swiped = null, v0 = 0; let air = false, t0 = 0, worst = 0, mid = 0, land = null, grab = false, flicked = null;
    run(5, (t) => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
      if (!P.grounded && !air) { air = true; t0 = t; }
      const hold = opt.hold && air && !land && t - t0 > 0.25;
      rg.stick.R.down = hold ? 1 : 0; rg.stick.R.y = hold ? -1 : 0; rg.stick.R.x = 0; P.rHold = hold ? P.rHold : 0;
      if (hold) rg.grabStep(); if (P.grab) grab = true;
      if (opt.flick && air && !land && flicked === null && t - t0 > 0.25) flicked = rg.rightFlick(0, -52);
      // r56: the GROUND swipe -- on the run-in (`run`) or once she is on the wall's face (`face`)
      if (opt.swipe && swiped === null && P.grounded && (opt.swipe === 'run' || P.n.y < 0.7)) { v0 = P.vel.length(); swiped = rg.rightFlick(0, -52); swiped += ` +${fix(P.vel.length() - v0, 1)} m/s`; }
      // r74: the TAP on the wall's face -- the transfer now
      if (opt.tap && swiped === null && P.grounded && P.n.y < 0.7) { swiped = 'tap'; P.jump = 1; }
      if (air && !P.grounded && !land && P.vertN) { const u = new THREE.Vector3(0, 1, 0).applyQuaternion(P.bq);
        const a = Math.acos(Math.max(-1, Math.min(1, u.dot(P.vertN)))) * D; if (P.vel.y > -2) worst = Math.max(worst, a); if (t - t0 > 0.6 && !mid) mid = a; }
      if (air && P.grounded && !land) land = { z: P.pos.z, off: P.landOff * D, stance: P.stance }; });
    rg.stick.R.down = 0; rg.stick.R.y = 0; Object.assign(rg.VERT, { holdTilt: keep.t, holdXferOn: keep.x, airFlickXfer: keep.f }); rg.girl.ready = keepRd;
    return { worst, mid, land, grab, flicked, swiped };
  };
  const a = ride({ tilt: 1, xfer: 1 }), b = ride({ tilt: 0, xfer: 1 });
  console.log(`  vert air, tilt held:   her up off the wall normal, up and over the top, worst ${fix(a.worst, 1)} deg; down at z ${fix(a.land.z, 2)} (deck ${fix(lip, 2)}), landing ${fix(a.land.off, 1)} deg out, ${a.land.stance > 0 ? 'forward' : 'FAKIE'}`);
  console.log(`  ...the old plumb air:  her up ${fix(b.mid, 0)} deg off the wall normal 0.6 s in`);
  if (!(a.worst < 3 && a.land.z < lip && a.land.off < 12 && a.land.stance > 0 && b.mid > 45)) ok = false;
  // r57: THE TRANSFER IS A SWIPE UP ON THE WALL'S FACE, instead of the ollie. On the run-in it is a strike (with its
  // boost), and she still comes back into the pipe -- it must never transfer her by accident. The air flick up is a strike.
  const g = ride({ tilt: 1, swipe: 'run' }), k = ride({ tilt: 1, swipe: 'face' });
  console.log(`  swipe UP on the run-in: ${g.swiped}, down at z ${fix(g.land.z, 2)} -- ${g.land.z > lip ? 'ON THE DECK' : 'back in'}, ${g.land.stance > 0 ? 'forward' : 'FAKIE'}`);
  console.log(`  swipe UP on the wall:   ${k.swiped}, down at z ${fix(k.land.z, 2)} -- ${k.land.z > lip ? 'ON THE DECK' : 'back in'}, ${k.land.stance > 0 ? 'forward' : 'FAKIE'}`);
  // r81: SWAPPED BACK -- the swipe up on the wall is the transfer (onto the deck, forward); the TAP pops her and she comes back in
  const tp = ride({ tilt: 1, tap: 1 });
  console.log(`  TAP on the wall:        down at z ${fix(tp.land.z, 2)} -- ${tp.land.z > lip ? 'ON THE DECK' : 'back in'}, ${tp.land.stance > 0 ? 'forward' : 'FAKIE'}`);
  if (!(g.land.z < lip && /strike/.test(g.swiped) && /transfer/.test(k.swiped) && k.land.z > lip + 1 && k.land.stance > 0 && tp.land.z < lip)) ok = false;
  const c = ride({ tilt: 1, flick: 1, fx: 1 }), d = ride({ tilt: 1, flick: 1 });
  console.log(`  flick UP in the air, old switch on: ${c.flicked}, down at z ${fix(c.land.z, 2)} -- ${c.land.z > lip ? 'ON THE DECK' : 'back in'}`);
  console.log(`  ...default:              ${d.flicked}, down at z ${fix(d.land.z, 2)} -- ${d.land.z > lip ? 'ON THE DECK' : 'back in the pipe'}`);
  if (!(c.flicked === 'transfer' && c.land.z > lip + 1 && d.flicked === 'transfer' && d.land.z > lip + 1)) ok = false;      // r81: an early air swipe up releases the lock
  // the boost on the flat, and its cooldown
  // r57: a ground strike in ANY direction shoots her forward along her travel; a flick queued mid-strike adds nothing yet
  { const keepR = rg.girl.ready; rg.girl.ready = false; place(60, 1, -60, 0, 8); P.mel = null; P.melQ = null; run(0.1, () => { rg.stick.L.x = rg.stick.L.y = 0; }); rg.cam.az = 0; const v0 = P.vel.length();
    const r1 = rg.rightFlick(52, 0); const v1 = P.vel.length(); const r2 = rg.rightFlick(52, 0); const v2 = P.vel.length();
    const fwd = P.vel.z;
    const good = r1 === 'strike' && fwd > v0 + rg.MELEE.boost * 0.9 && Math.abs(v2 - v1) < 1e-6;
    console.log(`  a sideways strike, rolling at 8: forward ${fix(v0, 1)} -> ${fix(fwd, 1)} m/s; a second flick queues (${fix(v2, 1)})${good ? '' : '   <- WRONG'}`); if (!good) ok = false; P.mel = null; P.melQ = null; rg.girl.ready = keepR; }
  const e = ride({ tilt: 1, hold: 1 }), f = ride({ tilt: 1, hold: 1, xfer: 1 });
  console.log(`  held right stick UP:   grab ${e.grab ? 'FIRED' : 'none'}, down at z ${fix(e.land.z, 2)} -- ${e.land.z > lip ? 'on the deck' : 'back in the pipe'}`);
  console.log(`  ...old hold transfer on: down at z ${fix(f.land.z, 2)} -- ${f.land.z > lip ? 'ON THE DECK' : 'back in'}, grab ${f.grab ? 'FIRED' : 'none'}`);
  if (!(e.grab && e.land.z < lip && f.land.z > lip + 1 && !f.grab)) ok = false;
  return ok;
};
// r98: *"Make the swipe down on the right stick the grind again, turn the left stick back into the flip stick, and the right
// stick the melee stick -- tap right to launch up vert, flick up launches you forward (transfer)."* THE SHIPPED DEFAULT
// (map 1, the flick-up boost off), through the real pads -- every row reads what the game ships, not what this file sets.
CASES.ctrl98 = async () => {
  let ok = true; const say = (label, good, msg) => { console.log(`  ${label.padEnd(56)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const D = rg.UI_DEF; say('shipped: map 1, flick-up boost off, swipe-up transfer on', D['CTRL.map'] === 1 && D['VERT.flickBoost'] === 0 && D['VERT.swipeXfer'] === 1, `map ${D['CTRL.map']}, flickBoost ${D['VERT.flickBoost']}, swipeXfer ${D['VERT.swipeXfer']}`);
  rg.CTRL.map = D['CTRL.map']; rg.VERT.flickBoost = D['VERT.flickBoost']; rg.VERT.swipeXfer = D['VERT.swipeXfer']; rg.GRIND.intent = 1;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const keep = { m: rg.girl.moves, r: rg.girl.ready, lock: P.stanceLock };
  rg.girl.moves = gameClips('models/alien_rollerskate_blue.glb').moves; rg.girl.ready = false; P.stanceLock = true;
  const L = document.getElementById('stkL'), R = document.getElementById('stkR');
  const ev = (el, id) => (type, x, y) => ({ type, pointerId: id, clientX: x, clientY: y, stopPropagation() {}, preventDefault() {}, target: el });
  const eL = ev(L, 81), eR = ev(R, 82);
  const flick = async (e, el, dx, dy, frames) => { await wait(160); el.dispatchEvent(e('pointerdown', 150, 150)); el.dispatchEvent(e('pointermove', 150 + dx, 150 + dy));
    if (frames) run(frames); await wait(30); el.dispatchEvent(e('pointerup', 150 + dx, 150 + dy)); };
  const tap = async (e, el) => { await wait(160); el.dispatchEvent(e('pointerdown', 150, 150)); await wait(20); el.dispatchEvent(e('pointerup', 150, 150)); };
  const clear = () => { P.rHold = 0; P.lDown = 0; P.boostT = 0; P.boostCool = 0; P.mel = null; P.melQ = null; P.flip = null; P.stance = 1; P.stopT = 0; P.dive = null; P.grab = null; P.grindWant = 0; P.grindCool = 0; P.grindLast = null; P.kickRail = null; rg.ledgeClear(); rg.cam.az = 0; };
  const ground = (v) => { place(60, 1, -60, 0, v == null ? 10 : v); clear(); };
  const air = () => { ground(6); P.grounded = false; P.coyote = 0; P.pos.y += 7; P.vel.y = 2; P.airT = 0.3; };
  // THE RIGHT PAD: melee, grind, jump
  ground(); await flick(eR, R, 70, 0); say('ground, RIGHT flick sideways: a melee strike', P.mel && P.mel.kind === 'strike' && !(P.boostT > 0), P.mel ? P.mel.kind : 'nothing');
  ground(); await flick(eR, R, 0, -70); say('ground (flat), RIGHT flick up: a melee strike, not a boost', P.mel && P.mel.kind === 'strike' && !(P.boostT > 0), P.mel ? P.mel.kind : (P.boostT > 0 ? 'a BOOST' : 'nothing'));
  const R0 = rg.PATHS.find(Q => Q.name === 'park'), a0 = R0.segs[0].a, b0 = R0.segs[0].b, ux = (b0.x - a0.x), uz = (b0.z - a0.z), ul = Math.hypot(ux, uz);
  { ground(4); const g = rg.groundAt(a0.x + uz / ul * 1.6 + ux / ul * 1.5, a0.z - ux / ul * 1.6 + uz / ul * 1.5, 5, 1);
    place(a0.x + uz / ul * 1.6 + ux / ul * 1.5, (g.hit ? g.floor : 0) + 0.1, a0.z - ux / ul * 1.6 + uz / ul * 1.5, Math.atan2(ux, uz), 4); clear();
    await flick(eR, R, 0, 70); let got = null; run(1.6, () => { if (P.grind && !got) got = P.grind.rail.path; });
    say('ground beside rail 0, RIGHT swipe down: hops onto it, grinds', got === R0, got === R0 ? 'grinding rail 0' : got ? 'grinding ' + got.name : 'no grind'); }
  { air(); P.pos.set(a0.x + ux / ul * 2, a0.y + 5, a0.z + uz / ul * 2); P.vel.set(ux / ul * 6, 2, uz / ul * 6); clear();
    await flick(eR, R, 0, 70); const dv = !!P.dive; let got = null; run(1.5, () => { if (P.grind && !got) got = P.grind.rail.path; });
    say('air over rail 0, RIGHT swipe down: the dive onto it', dv && !P.flip && got === R0, got === R0 ? 'grinding rail 0' : (P.flip ? 'a FLIP' : 'no grind')); }
  air(); await flick(eR, R, 70, 0, 0.1); say('air, RIGHT flick sideways: the air strike, no flip', P.mel && P.mel.kind === 'strike' && !P.flip, P.mel ? P.mel.kind : (P.flip ? 'a FLIP' : 'nothing'));
  ground(0); run(0.2); await tap(eR, R); run(0.1); say('ground, RIGHT tap: a jump', !P.grounded && P.vel.y > 3, `vy ${fix(P.vel.y, 1)}`);
  // THE LEFT PAD: the flips
  for (const [dx, dy, want] of [[0, -70, 'up'], [0, 70, 'down'], [70, 0, 'right'], [-70, 0, 'left']]) {
    air(); await flick(eL, L, dx, dy, 0.15); say(`air, LEFT flick ${want}: a flip`, P.flip && P.flip.dir === want && !P.mel, P.flip ? P.flip.dir + ' flip' : (P.mel ? 'a STRIKE' : 'nothing')); }
  ground(); await flick(eL, L, 0, -70); say('ground, LEFT flick up: the boost', P.boostT > 0, `boostT ${fix(P.boostT || 0, 2)}`);
  ground(); await flick(eL, L, 0, 70); say('ground, LEFT flick down: the slide', P.mel && P.mel.kind === 'slide', P.mel ? P.mel.kind : 'nothing');
  // VERT: a tap goes straight up and back in; a flick up on the wall launches her forward, out onto the deck
  { const lip = 30 + 3 + 2.6 * Math.sin(rg.PARK.hpSweep) + rg.PARK.cope;
    const vride = (opt) => { place(0, 3, 29, 0, 15); clear(); P.dashed = 0; let air2 = false, land = null, did = null;
      run(5, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
        if (!P.grounded && !air2) air2 = true;
        if (opt.tap && did === null && P.grounded && P.n.y < 0.7) { did = 'tap'; P.jump = 1; }
        if (opt.flick && did === null && P.grounded && P.n.y < 0.7) did = rg.rightFlick(0, -52);
        if (air2 && P.grounded && !land) land = { z: P.pos.z, stance: P.stance }; }); return { land, did }; };
    const where = r => r.land ? `down at z ${fix(r.land.z, 2)} -- ${r.land.z > lip ? 'ON THE DECK' : 'back in the pipe'}${r.land.z > lip ? (r.land.stance > 0 ? ', forward' : ', FAKIE') : ''}` : 'never landed';
    const t = vride({ tap: 1 }), f = vride({ flick: 1 });
    say('vert, RIGHT tap on the wall: straight up and back in', t.land && t.land.z < lip, where(t));
    say('vert, RIGHT flick up on the wall: the transfer, forward', f.did === 'transfer' && f.land && f.land.z > lip + 1 && f.land.stance > 0, `${f.did}, ${where(f)}`); }
  // THE AIR HOLDS: the right thumb pressed IN THE AIR grabs; one carried off the ground (a camera drag) never does
  { ground(8); run(0.1); let grab = null;
    run(0.3, () => { rg.stick.R.down = 1; rg.stick.R.x = 0; rg.stick.R.y = -1; }); P.jump = 1;
    run(0.9, () => { rg.stick.R.down = 1; rg.stick.R.x = 0; rg.stick.R.y = -1; if (!P.grounded && P.grab) grab = grab || P.grab.k; });
    say('right thumb held from the ground through a jump: no grab', !grab, grab ? `GRAB ${grab}` : 'the air pose');
    rg.stick.R.down = 0; rg.stick.R.y = 0; ground(8); run(0.1); P.jump = 1; run(0.15); grab = null;
    run(0.7, () => { rg.stick.R.down = 1; rg.stick.R.x = 0; rg.stick.R.y = -1; if (!P.grounded && P.grab) grab = grab || P.grab.k; });
    say('...pressed in the air and held: the grab', !!grab, grab ? `grab ${grab}` : 'NONE');
    rg.stick.R.down = 0; rg.stick.R.x = rg.stick.R.y = 0; P.grab = null; }
  rg.girl.moves = keep.m; rg.girl.ready = keep.r; P.stanceLock = keep.lock; clear(); rg.GRIND.intent = 0; rg.CTRL.map = 1; rg.VERT.flickBoost = 0;
  return ok;
};
// r86: *"Flick or tap the right stick, she launches off the vert straight up regardless -- the flick gets you a boost. Only
// if you then press and HOLD forward on the right stick in the air does she transfer out."* And *"she's not doing the in-air
// pose, she's just doing the idle pose"*: the left thumb (the grab since r82) is down on every takeoff because it steers.
CASES.vert86 = () => {
  let ok = true; const say = (label, good, msg) => { console.log(`  ${label.padEnd(56)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  rg.CTRL.map = 3; rg.VERT.flickBoost = 1;
  const lip = 30 + 3 + 2.6 * Math.sin(rg.PARK.hpSweep) + rg.PARK.cope;
  const keepRd = rg.girl.ready; rg.girl.ready = false;
  const ride = (opt) => {
    place(0, 3, 29, 0, 15); P.dashed = 0; P.boostCool = 0; P.boostT = 0; let air = false, t0 = 0, land = null, apex = -9, did = null, xfer = false, grabK = null; P.rHold = 0; P.grab = null;
    run(5, (t) => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
      if (!P.grounded && !air) { air = true; t0 = t; }
      if (air && !land) apex = Math.max(apex, P.pos.y);
      if (opt.tap && did === null && P.grounded && P.n.y < 0.7) { did = 'tap'; P.jump = 1; }
      if (opt.flick === 'face' && did === null && P.grounded && P.n.y < 0.7) did = rg.rightFlick(0, -52);
      if (opt.flick === 'air' && did === null && air && t - t0 > 0.05) did = rg.rightFlick(0, -52);
      // the thumb up on the right pad for `opt.hold` seconds, from `opt.at` into the air
      const h = opt.hold && air && !land && t - t0 > opt.at && t - t0 < opt.at + opt.hold;
      rg.stick.R.down = h ? 1 : 0; rg.stick.R.y = h ? -1 : 0; rg.stick.R.x = 0;
      if (opt.hold && opt.flickEnd && did === null && air && t - t0 >= opt.at + opt.hold) did = rg.rightFlick(0, -52);
      if (!P.vertLock && air && !land && opt.hold) xfer = xfer || P.pos.z > lip;
      if (air && !land && P.grab) grabK = grabK || P.grab.k;
      if (air && P.grounded && !land) land = { z: P.pos.z, stance: P.stance }; });
    rg.stick.R.down = 0; rg.stick.R.y = 0;
    return { land, apex, did, grab: grabK };
  };
  const where = r => r.land ? `down at z ${fix(r.land.z, 2)} -- ${r.land.z > lip ? 'ON THE DECK' : 'back in the pipe'}${r.land.z > lip ? (r.land.stance > 0 ? ', forward' : ', FAKIE') : ''}` : 'never landed';
  const none = ride({}), tap = ride({ tap: 1 }), fl = ride({ flick: 'face' }), fa = ride({ flick: 'air' });
  say('no input: straight up and back into the pipe', none.land && none.land.z < lip, `apex ${fix(none.apex, 1)}, ${where(none)}`);
  say('TAP on the wall: straight up, back in', tap.land && tap.land.z < lip, `apex ${fix(tap.apex, 1)}, ${where(tap)}`);
  say('FLICK up on the wall: a boost, higher, and back in', fl.did === 'boost' && fl.apex > none.apex + 0.5 && fl.land && fl.land.z < lip, `${fl.did}, apex ${fix(fl.apex, 1)}, ${where(fl)}`);
  say('FLICK up just after leaving: a boost, back in', fa.did === 'boost' && fa.land && fa.land.z < lip, `${fa.did}, apex ${fix(fa.apex, 1)}, ${where(fa)}`);
  const hd = ride({ hold: 1.5, at: 0.2 }), hfl = ride({ flick: 'face', hold: 1.5, at: 0.2 });
  say('HOLD the right stick up in the air: the transfer, forward', hd.land && hd.land.z > lip + 1 && hd.land.stance > 0, where(hd));
  { rg.CTRL.map = 4; let grabbed = false; const keepG = rg.grabStep; const h4 = ride({ hold: 1.5, at: 0.2 }); rg.CTRL.map = 3;
    say('  map 4 (r89): the same hold transfers and never grabs', h4.land && h4.land.z > lip + 1 && !h4.grab, `${where(h4)}${h4.grab ? ', GRABBED ' + h4.grab : ''}`); }
  say('flick on the wall, THEN hold up: boosted and transfers', hfl.did === 'boost' && hfl.land && hfl.land.z > lip + 1, `${hfl.did}, ${where(hfl)}`);
  // a flick's own travel is under `holdT`: the thumb up for 0.2 s then a flick up is a boost/flip, never a transfer
  const qf = ride({ hold: 0.2, at: 0.15, flickEnd: 1 });
  say('a quick thumb up and off in the air: no transfer', qf.land && qf.land.z < lip, `${qf.did}, ${where(qf)}`);
  // AND THE AIR POSE: the left thumb carried off the ground (steering) is not a grab; a fresh press in the air is
  { place(60, 1, -60, 0, 8); let grab = null;
    run(0.3, () => { rg.stick.L.down = 1; rg.stick.L.x = 0; rg.stick.L.y = -1; });
    P.jump = 1; run(1, () => { rg.stick.L.down = 1; rg.stick.L.x = 0; rg.stick.L.y = -1; if (!P.grounded && P.grab) grab = grab || P.grab.k; });
    say('left thumb held from the ground through a jump: no grab', !grab, grab ? `GRAB ${grab}` : 'the air pose');
    rg.stick.L.down = 0; rg.stick.L.y = 0; place(60, 1, -60, 0, 8); run(0.1); P.jump = 1; run(0.15); grab = null;
    run(0.6, () => { rg.stick.L.down = 1; rg.stick.L.x = 0; rg.stick.L.y = -1; if (!P.grounded && P.grab) grab = grab || P.grab.k; });
    say('...pressed again in the air: the grab', !!grab, grab ? `grab ${grab}` : 'NONE');
    // r87: ...and THAT thumb kept down through the landing and the next takeoff: no grab on the next jump
    run(2, () => { rg.stick.L.down = 1; rg.stick.L.x = 0; rg.stick.L.y = -1; }); const g0 = P.grounded; grab = null;
    P.jump = 1; run(0.8, () => { rg.stick.L.down = 1; rg.stick.L.x = 0; rg.stick.L.y = -1; if (!P.grounded && P.grab) grab = grab || P.grab.k; });
    say('...held on through the landing and the NEXT jump: no grab', g0 && !grab, !g0 ? 'never landed' : grab ? `GRAB ${grab}` : 'the air pose');
    rg.stick.L.down = 0; rg.stick.L.x = rg.stick.L.y = 0; P.grab = null; }
  rg.girl.ready = keepRd; rg.CTRL.map = 1;
  return ok;
};
// r87: *"Something keeps happening -- she's doing the in-air pose and then after I do something, a back skate or a transfer,
// she's just doing the idle pose in the air."* A randomized session through the shipped step AND the shipped move brain, on
// his real clip names (`gameClips`, the `moves` case's fakes): fakie, swivels, taps, flicks both pads, boosts, speed stops,
// dives, strikes, both thumbs held and lifted at random. Every free air frame (no flip, strike, dive, grind or bail running)
// must show the air pose -- or a grab the left thumb was pressed IN THE AIR for.
CASES.airpose = () => {
  const { clips, moves, R } = gameClips('models/alien_rollerskate_blue.glb'); if (!moves) return false;
  const keep = { a: rg.girl.actions, cw: rg.girl.cw, len: rg.girl.clipLen, m: rg.girl.moves, r: rg.girl.ready };
  rg.girl.actions = {}; rg.girl.cw = {}; rg.girl.clipLen = R.len; rg.girl.moves = moves; rg.girl.ready = true; rg.girl.idle = null; rg.girl.bail = null;
  for (const c of clips) rg.girl.actions[c.name] = { w: 0, ts: 1, time: 0, reset() { return this; }, play() { return this; }, stop() { return this; }, isRunning() { return true; },
    setEffectiveWeight(v) { this.w = v; return this; }, getEffectiveWeight() { return this.w; }, setEffectiveTimeScale(v) { this.ts = v; return this; }, setLoop() { return this; } };
  rg.VERT.flickBoost = 1; rg.GRIND.intent = 1;
  let allOk = true;
  for (const MAP of [3, 4]) { rg.CTRL.map = MAP;      // r89: map 4 grabs on the RIGHT thumb, so the fresh press is the right one's
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const bad = {}; let air = 0, nBad = 0, first = null; seed = 12345;
  const acts = [() => { P.jump = 1; }, () => rg.rightFlick(0, -52), () => rg.rightFlick(52, 0), () => rg.rightFlick(0, 52), () => rg.rightFlick(-52, 0),
    () => rg.swivel(), () => rg.speedStop && P.grounded && rg.speedStop(), () => !P.grounded && rg.grindDown(), () => rg.meleeStrike(Math.sin(P.heading), Math.cos(P.heading)), () => rg.boostGo()];
  for (let run_ = 0; run_ < 8; run_++) {
    const spots = [[0, 3, 29, 0, 15], [0, 3, 31, Math.PI, 15], [60, 1, -60, 0, 10], [-11, 1, -6, 0, 12], [-26, 1, -10, 1, 12], [0, 3, 29, 0.4, 18], [30, 1, 0, 2, 8], [-40, 1, 0, 0, 10]];
    place(...spots[run_]); let next = 0, wasL = 0, wasR = 0, pressR = -1, pressT = -1, airT0 = -1, lHold = 0, rHold = 0, lx = 0, ly = -1, rx = 0, ry = 0;
    run(15, (t) => {
      if (t >= next) { next = t + 0.15 + rnd() * 0.8; const r = rnd();
        if (r < 0.45) acts[Math.floor(rnd() * acts.length)]();
        else if (r < 0.65) { lHold = rnd() < 0.85; lx = rnd() * 2 - 1; ly = rnd() * 2 - 1.4; }      // a steering thumb: down nearly all the time, lifted now and then
        else if (r < 0.8) { rHold = rnd() < 0.4; rx = rnd() * 2 - 1; ry = rnd() * 2 - 1; }
        else { lHold = 1; lx = 0; ly = -1; } }
      rg.stick.L.down = lHold ? 1 : 0; rg.stick.L.x = lHold ? lx : 0; rg.stick.L.y = lHold ? ly : 0;
      // the harness's OWN record of when the left press began and when this airtime began -- never the game's flag
      if (lHold && !wasL) pressT = t; wasL = lHold; if (rHold && !wasR) pressR = t; wasR = rHold; if (P.grounded || P.grind) airT0 = -1; else if (airT0 < 0) airT0 = t;
      rg.stick.R.down = rHold ? 1 : 0; rg.stick.R.x = rHold ? rx : 0; rg.stick.R.y = rHold ? ry : 0;
      rg.girlAnimMoves(DT);
      const free = !P.grounded && !P.grind && !(P.bailT > 0) && !P.mel && !P.dive && !(P.flip && P.flip.t < P.flip.dur);
      if (!free) return; air++;
      const fresh = MAP === 4 ? (rHold && airT0 >= 0 && pressR >= airT0) : (lHold && airT0 >= 0 && pressT >= airT0), top = rg.girl.top, ok = top === moves.air || (P.grab && fresh && top === P.grab.nm);
      if (!ok) { nBad++; const k = `${top}${P.grab ? ' grab=' + P.grab.k + (fresh ? '' : ' with a press from before takeoff') : ''} stance ${P.stance}`; bad[k] = (bad[k] || 0) + 1;
        if (!first) first = `run ${run_} t ${fix(t, 2)} at ${fix(P.pos.x, 1)},${fix(P.pos.y, 1)},${fix(P.pos.z, 1)}`; }
    });
  }
  rg.stick.L.down = rg.stick.R.down = 0; rg.stick.L.x = rg.stick.L.y = rg.stick.R.x = rg.stick.R.y = 0;
  console.log(`  map ${MAP}: ${air} free air frames over 2 minutes of random play; ${nBad} not in the air pose${nBad ? ' -- first ' + first : ''}`);
  for (const k in bad) console.log(`    ${bad[k]} x ${k}`);
  if (!(air > 300 && nBad === 0)) allOk = false;
  }
  Object.assign(rg.girl, { actions: keep.a, cw: keep.cw, clipLen: keep.len, moves: keep.m, ready: keep.r }); P.grab = null; P.mel = null; P.flip = null; P.dive = null; rg.CTRL.map = 1;
  return allOk;
};
// r45: the PARK's four rails -- the city's paths (spirals, loops, a zip) have their own case
const parkRails = () => rg.RAILS.filter(R => R.path.name === 'park');
CASES.home = () => {
  let ok = true; const keep = rg.GRIND.home, R0 = parkRails();
  const grinds = (R, setup) => {
    setup(); P.jump = 1;
    let got = null; run(2.5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && !got) got = P.grind; });
    return !!got && got.rail === R;
  };
  const mid = (R, side, off) => [(R.a.x + R.b.x) / 2 - R.hz * off * side, (R.a.z + R.b.z) / 2 + R.hx * off * side];
  const ground = (R, side, off, v) => () => { const [x, z] = mid(R, side, off); place(x, 1, z, Math.atan2(R.hx, R.hz), v || 0); };
  const above = (R, side) => () => { const [x, z] = mid(R, side, 2.5); place(x, 1, z, Math.atan2(R.hx, R.hz), 3);
    const top = (R.a.y + R.b.y) / 2; P.grounded = false; P.coyote = 0; P.pos.y = top + 6; P.vel.y = -2; };
  const rows = [];
  R0.forEach((R, i) => {
    rg.GRIND.home = 1;
    const g1 = grinds(R, ground(R, 1, 3.5)), g2 = grinds(R, ground(R, -1, 3.5)), g3 = grinds(R, above(R, 1)), g4 = grinds(R, ground(R, 1, 2.5, 10));
    const far = grinds(R, ground(R, 1, 9));
    rg.GRIND.home = 0;
    const o1 = grinds(R, ground(R, 1, 3.5)), o3 = grinds(R, above(R, 1));
    rows.push(`${i}: side ${g1 && g2 ? 'GRIND' : 'missed'}, above ${g3 ? 'GRIND' : 'missed'}, rolling ${g4 ? 'GRIND' : 'missed'}, 9 m ${far ? 'grind (wrong)' : 'a jump'} | home off: ${o1 || o3 ? 'grind' : 'missed'}`);
    if (!(g1 && g2 && g3 && g4 && !far && !o1 && !o3)) ok = false;
  });
  rg.GRIND.home = keep;
  console.log('  ' + rows.join('\n  '));
  return ok;
};
// ---------------------------------------------------------------- no two surfaces on one plane (r40)
// *"A little bit of artifacting on the ramp -- I think it's a little too low, below the ground plane, and
// it's doing this weird triangle thing."* That is Z-FIGHTING: two drawn surfaces at the same height,
// trading pixels as the camera moves. The drawn park is scanned for flat triangles at plaza height
// whose colour is not the plaza's -- each one is a surface lying ON the floor, which is the fault.
CASES.zfight = () => {
  let plaza = null, park = null;
  rg.scene.traverse(o => { if (!o.isMesh || !o.geometry.attributes.color) return;
    if (o.name === 'plaza') plaza = o;
    else if (!park || o.geometry.attributes.position.count > park.geometry.attributes.position.count) park = o; });
  if (!plaza || !park) { console.log('  plaza or park mesh not found'); return false; }
  const Q = plaza.geometry.attributes.position.array, P3 = park.geometry.attributes.position.array, N = park.geometry.attributes.normal.array;
  const plz = [];
  // r90: THE HUB'S PLAZA ONLY. The plaza mesh carries the park district's floor now too (`PARKD`), pushed back in depth like
  // the plaza so the kit pieces standing on it win -- which is the arrangement this check exists to require, not a fault
  const S0 = rg.PARK.S + 0.01, hubT = o => [0, 3, 6].every(k => Math.abs(Q[o + k]) <= S0 && Math.abs(Q[o + k + 2]) <= S0);
  let dist = 0;
  for (let t = 0; t < Q.length / 9; t++) { const o = t * 9; if (Math.abs(Q[o + 1]) < 0.06) { if (hubT(o)) plz.push([Q[o], Q[o + 2], Q[o + 3], Q[o + 5], Q[o + 6], Q[o + 8], Q[o + 1]]); else dist++; } }
  const inTri = (x, z, q) => { const d = (q[3] - q[5]) * (q[0] - q[4]) + (q[4] - q[2]) * (q[1] - q[5]);
    const a = ((q[3] - q[5]) * (x - q[4]) + (q[4] - q[2]) * (z - q[5])) / d, b = ((q[5] - q[1]) * (x - q[4]) + (q[0] - q[4]) * (z - q[5])) / d;
    return a > 0 && b > 0 && a + b < 1; };
  // 1. NOTHING EXACTLY ON THE FLOOR: a flat, upward-facing park triangle at the plaza's height, over it
  // 2. AND THE TOES: low near-flat slivers that the floor's depth offset has to win against
  const exact = [], toes = [];
  for (let t = 0; t < P3.length / 9; t++) {
    const o = t * 9, ys = [P3[o + 1], P3[o + 4], P3[o + 7]];
    if (N[o + 1] < 0.9 || Math.max(...ys) > 0.03) continue;
    const x = (P3[o] + P3[o + 3] + P3[o + 6]) / 3, z = (P3[o + 2] + P3[o + 5] + P3[o + 8]) / 3;
    if (!plz.some(q => inTri(x, z, q))) continue;
    (Math.max(...ys) < 0.002 ? exact : toes).push(`${x.toFixed(1)},${z.toFixed(1)}`);
  }
  const off = plaza.material.polygonOffset && plaza.material.polygonOffsetFactor > 0;
  console.log(`  park triangles lying EXACTLY on the plaza: ${exact.length}${exact.length ? ' at ' + exact.slice(0, 8).join(' ') : ''}`);
  console.log(`  ramp toes within 3 cm of it: ${toes.length}, and the plaza is ${off ? 'pushed back in depth (polygonOffset)' : 'NOT offset -- they will fight'}`);
  const want = rg.PARKD.on && rg.PARKD.floorMesh ? rg.PARKD.floorMesh.pos.length / 9 : 0;
  console.log(`  the park district's floor and the apron round it in that offset mesh: ${dist} triangles (its floor alone is ${want})`);
  return exact.length === 0 && off && dist >= want;
};
// ---------------------------------------------------------------- Zap's melee (r39)
// The borrowed file (`npm run borrow`) prepared exactly as the game prepares hers; the chain, the slide,
// the flying kick, and -- the point of the kick -- that flicked toward any rail in the park from five
// metres off it, she lands ON it and grinds, where with the aim switched off she does not.
CASES.melee = () => {
  let ok = true;
  // headless there is no skin; an earlier case may have left fabricated actions on `girl`, which would
  // make every borrowed clip read as missing -- so this case runs as the game does with no skin at all
  const keepReady = rg.girl.ready; rg.girl.ready = false;
  try { return meleeCase(); } finally { rg.girl.ready = keepReady; }
};
function meleeCase() {
  let ok = true;
  const g = readGLB('models/melee_zap.glb'), alien = readGLB('models/alien_rollerskate_blue.glb').json;
  const bones = new Set(alien.nodes.map(n => n.name));
  const clips = rg.normaliseClips(buildClips(g, THREE));
  const unbound = clips.reduce((n, c) => n + c.tracks.filter(t => !bones.has(t.name.split('.')[0])).length, 0);
  const bad = clips.filter(c => !(c.duration > 0.3));
  console.log(`  ${clips.length} borrowed clips (${clips.map(c => c.name.replace('weapon_melee', 'wm')).join(' ')})`);
  console.log(`  tracks with no bone of hers to drive: ${unbound}; clips with a bad duration: ${bad.length}`);
  if (clips.length !== 12 || unbound || bad.length) ok = false;
  // HOW HIGH HER FEET END UP in the borrowed poses, on her real skeleton, as a fraction of her leg:
  // the hips were re-based on her rest and scaled by leg length, so a standing strike keeps a foot down
  { const { root, by } = skelFromGLB(alien);
    const mixer = new THREE.AnimationMixer(root), feet = [by.mixamorig_LeftFoot, by.mixamorig_RightFoot], V = () => new THREE.Vector3();
    root.updateMatrixWorld(true);
    const rest = Math.min(...feet.map(f => f.getWorldPosition(V()).y));
    const leg = by.mixamorig_LeftUpLeg.getWorldPosition(V()).distanceTo(by.mixamorig_LeftFoot.getWorldPosition(V()));
    const rows = [];
    for (const c of clips) {
      const a = mixer.clipAction(c); a.play(); let lo = Infinity, lomax = -Infinity;
      for (let i = 0; i <= 20; i++) { a.time = c.duration * i / 20; mixer.update(0); root.updateMatrixWorld(true);
        const l = Math.min(...feet.map(f => f.getWorldPosition(V()).y)) - rest; lo = Math.min(lo, l); lomax = Math.max(lomax, l); }
      a.stop(); rows.push([c.name, lo / leg, lomax / leg]);
    }
    console.log('  lower foot vs her floor, in legs (min..max over the clip): ' + rows.map(r => `${r[0].replace('weapon_melee', 'wm').replace('melee_', 'm')} ${fix(r[1])}..${fix(r[2])}`).join('  '));
    // Zap's OWN slide and low spin put a foot -0.37 / -0.44 of a leg under his floor (measured on his rig
    // at r39), so some depth is the source; the game lifts her during a strike. What must not happen is a
    // hips rescale gone wrong, which sinks her by whole legs.
    const sunk = rows.filter(r => r[1] < -0.8);
    if (sunk.length) { console.log('  SUNK through the floor: ' + sunk.map(r => r[0]).join(' ')); ok = false; }
  }
  const flat = () => place(60, 1, -60, 0, 8);
  // the chain: dealt in order, a flick during a strike QUEUED, never cutting it; body turns to the flick
  flat(); rg.girl.melDeal = 0; rg.cam.az = 0;
  const seen = []; let faced = 180;
  rg.rightFlick(52, 0); rg.rightFlick(52, 0);          // screen right = world -X with the lens down +Z
  run(2.5, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
    if (P.mel && seen[seen.length - 1] !== P.mel.nm) seen.push(P.mel.nm);
    if (P.mel) faced = Math.min(faced, Math.abs(Math.atan2(Math.sin(P.faceH + Math.PI / 2), Math.cos(P.faceH + Math.PI / 2))) * 57.3); });
  const tb = Math.abs(Math.atan2(P.vel.x, P.vel.z)) * 57.3;
  console.log(`  two right flicks: ${seen.join(' -> ')}; body came within ${fix(faced, 1)} deg of the flick; still rolling ${fix(tb, 1)} deg off her line`);
  if (!(seen.join() === 'melee_01,melee_02' && faced < 8 && tb < 20)) ok = false;
  // the slide tackle
  const sp = k => { const keep = rg.MELEE.slideV; rg.MELEE.slideV = k; flat(); rg.meleeSlide(); run(0.3, () => { rg.stick.L.x = rg.stick.L.y = 0; }); rg.MELEE.slideV = keep; return P.hSpeed; };
  const s0 = sp(0), s1 = sp(rg.MELEE.slideV);
  console.log(`  slide tackle: ${fix(s1, 1)} m/s against ${fix(s0, 1)} without the shove`);
  if (!(s1 > s0 + rg.MELEE.slideV * 0.7)) ok = false;
  // r44: THE AIR MELEE, open plaza: the same chain, shoved toward the flick, played from its AIRBORNE window,
  // a second flick queued and strung, and each one ends IN THE AIR -- back to the air pose, not a standing one
  flat(); P.grounded = false; P.coyote = 0; P.pos.y += 12; P.vel.set(0, 2, 2);
  rg.rightFlick(0, -52);                                   // up = away from the lens = +Z
  const first = P.mel && { ...P.mel }, kv = P.vel.z; rg.rightFlick(0, -52);
  const airSeen = []; let endedInAir = 0, groundedAtEnd = 0;
  run(2.5, () => { rg.stick.L.x = rg.stick.L.y = 0;
    if (P.mel && airSeen[airSeen.length - 1] !== P.mel.nm) airSeen.push(P.mel.nm);
    if (!P.mel && airSeen.length && !endedInAir) { endedInAir = 1; groundedAtEnd = P.grounded ? 1 : 0; } });
  const w = first ? first.win : null;
  console.log(`  air strike: ${first ? first.nm : 'none'} from its window ${w ? w.map(v => fix(v)).join('..') : '-'}, ${fix(kv, 1)} m/s toward the flick; strung: ${airSeen.join(' -> ')}; ended ${groundedAtEnd ? 'ON THE GROUND (wrong)' : 'in the air'}`);
  if (!(first && first.air && w && w[0] > 0 && kv > 4 && airSeen.length >= 2 && endedInAir && !groundedAtEnd)) ok = false;
  // ...and THE WINDOW TABLE IS STILL TRUE OF THE CLIPS: re-measured on her rig, the same rule the table states
  { const { root, by } = skelFromGLB(alien), mixer = new THREE.AnimationMixer(root), V = () => new THREE.Vector3();
    const ft = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map(n => by['mixamorig_' + n]); root.updateMatrixWorld(true);
    const rest = Math.min(...ft.map(f => f.getWorldPosition(V()).y));
    const leg = by.mixamorig_LeftUpLeg.getWorldPosition(V()).distanceTo(by.mixamorig_LeftFoot.getWorldPosition(V()));
    const bad = [];
    for (const nm of rg.MELEE.fist) {
      const c = clips.find(x => x.name === nm); if (!c) continue; const a = mixer.clipAction(c); a.play(); const N = 40, up = [];
      for (let i = 0; i <= N; i++) { a.time = c.duration * i / N; mixer.update(0); root.updateMatrixWorld(true); up.push((Math.min(...ft.map(f => f.getWorldPosition(V()).y)) - rest) / leg > 0.12); }
      a.stop(); let best = [0, -1], cur = -1;
      for (let i = 0; i <= N; i++) { if (up[i]) { if (cur < 0) cur = i; if (i - cur > best[1] - best[0]) best = [cur, i]; } else cur = -1; }
      const want = best[1] - best[0] >= 4 ? [Math.max(0, best[0] / N - 0.04), Math.min(1, best[1] / N + 0.04)] : rg.MELEE.airDef;
      const have = rg.MELEE.airWin[nm] || rg.MELEE.airDef;
      if (Math.abs(want[0] - have[0]) > 0.03 || Math.abs(want[1] - have[1]) > 0.03) bad.push(`${nm} measures ${want.map(v => fix(v)).join('..')}, table ${have.map(v => fix(v)).join('..')}`);
    }
    console.log(`  air windows against her rig: ${bad.length ? 'STALE -- ' + bad.join('; ') : 'all match'}`);
    if (bad.length) ok = false; }
  // ONTO EVERY RAIL: jump beside it, 5 m off, the lens turned so a flick UP points at it (r44: an AIR STRIKE now)
  const keepR = rg.MELEE.aimR;
  const tryRail = (R, side, aim) => {
    rg.MELEE.aimR = aim;
    const mx = (R.a.x + R.b.x) / 2, mz = (R.a.z + R.b.z) / 2;
    const px = mx - R.hz * 5 * side, pz = mz + R.hx * 5 * side;
    place(px, 1, pz, Math.atan2(R.hx, R.hz), 4); P.jump = 1;
    run(0.25, () => { rg.stick.L.x = rg.stick.L.y = 0; });
    rg.cam.az = Math.atan2(mx - P.pos.x, mz - P.pos.z);
    rg.rightFlick(0, -52);
    let got = null; run(2, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && !got) got = P.grind; });
    rg.MELEE.aimR = keepR;
    return got && got.rail === R;
  };
  const rows = parkRails().map((R, i) => `${i}: ${tryRail(R, 1, keepR) ? 'GRIND' : 'missed'}/${tryRail(R, -1, keepR) ? 'GRIND' : 'missed'} (aim off: ${tryRail(R, 1, 0) ? 'grind' : 'missed'})`);
  console.log('  kicked at each rail from either side: ' + rows.join('  '));
  if (rows.some(r => /missed\//.test(r) || /\/missed/.test(r))) ok = false;
  return ok;
}
// ---------------------------------------------------------------- feet on the ground (r36)
// The shipped `footFind` + `legIK` on a FABRICATED leg (a skin is draco and cannot be built here, but the
// IK only reads bone positions and world matrices). It must move the ankle where it is asked to, keep
// both bone lengths, lay a tilted foot flat, and stay finite when asked for the impossible.
CASES.footik = () => {
  const root = new THREE.Group(); let ok = true;
  const mk = (name, x, y, z, par) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); par.add(b); return b; };
  for (const [side, x] of [['Left', 0.1], ['Right', -0.1]]) {
    const up = mk(`mixamorig_${side}UpLeg`, x, 0.95, 0, root), kn = mk(`mixamorig_${side}Leg`, 0, -0.44, 0.20, up);
    mk(`mixamorig_${side}Foot`, 0, -0.43, -0.20, kn);   // a bent knee, as in a push
  }
  root.updateMatrixWorld(true);
  const F = rg.footFind(root, 0);
  if (!F) { console.log('  footFind found no legs'); return false; }
  const f = F[0], V = () => new THREE.Vector3(), N = new THREE.Vector3(0, 1, 0);
  const sole = () => f.ft.localToWorld(f.sole.clone());
  console.log(`  sole under the ankle at rest: y ${fix(sole().y, 4)} (the floor is 0)`);
  if (Math.abs(sole().y) > 1e-4) ok = false;
  const len = () => [f.up.getWorldPosition(V()).distanceTo(f.kn.getWorldPosition(V())), f.kn.getWorldPosition(V()).distanceTo(f.ft.getWorldPosition(V()))];
  const L0 = len(), a0 = f.ft.getWorldPosition(V());
  rg.legIK(f, new THREE.Vector3(0, -0.05, 0), N, 0);
  const a1 = f.ft.getWorldPosition(V()), L1 = len(), miss = a1.distanceTo(a0.clone().add(new THREE.Vector3(0, -0.05, 0)));
  console.log(`  ankle asked 5 cm down: missed by ${fix(miss * 1000, 2)} mm, thigh ${fix(L0[0], 4)} -> ${fix(L1[0], 4)}, shin ${fix(L0[1], 4)} -> ${fix(L1[1], 4)}`);
  if (!(miss < 1e-3 && Math.abs(L1[0] - L0[0]) < 1e-5 && Math.abs(L1[1] - L0[1]) < 1e-5)) ok = false;
  // a foot the clip has pointed 25 degrees toes-down: aligned, its sole lies on the surface's plane
  f.ft.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 25 * Math.PI / 180)); root.updateMatrixWorld(true);
  const tilt = () => f.upL.clone().applyQuaternion(f.ft.getWorldQuaternion(new THREE.Quaternion())).angleTo(N) * 57.3;
  const t0 = tilt(); rg.legIK(f, new THREE.Vector3(), N, 1); const t1 = tilt();
  console.log(`  a foot pointed ${fix(t0, 1)} deg off flat -> ${fix(t1, 2)} deg after align`);
  if (!(t0 > 10 && t1 < 0.5)) ok = false;
  // out of reach: clamped, never NaN
  // HER REAL RIG, skinned the way GLTFLoader skins it (joints are Bones, the armature above them is NOT),
  // so a `skeleton.pose()` inside `footFind` would do here exactly what it did on the phone in r36:
  // rewrite the root bone with the armature's scale and turn baked in, and she vanished. Every bone's
  // local transform must come out exactly as it went in.
  { const J = readGLB('models/alien_rollerskate_blue.glb').json, joints = new Set(J.skins[0].joints);
    const objs = J.nodes.map((n, i) => { const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D(); o.name = n.name || '';
      if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation);
      if (n.scale) o.scale.fromArray(n.scale); return o; });
    const rr = new THREE.Group(), kid = new Set();
    J.nodes.forEach(n => (n.children || []).forEach(c => kid.add(c)));
    J.nodes.forEach((n, i) => (n.children || []).forEach(c => objs[i].add(objs[c])));
    J.nodes.forEach((n, i) => { if (!kid.has(i)) rr.add(objs[i]); });
    rr.scale.setScalar(1.3); rr.updateMatrixWorld(true);
    const bones = J.skins[0].joints.map(i => objs[i]);
    const sm = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()); rr.add(sm); sm.bind(new THREE.Skeleton(bones));
    const snap = () => bones.map(b => [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]);
    const before = snap(), FF = rg.footFind(rr, 0), after = snap();
    let worst = 0; before.forEach((v, i) => v.forEach((x, k) => { worst = Math.max(worst, Math.abs(x - after[i][k])); }));
    console.log(`  her real rig: legs found ${!!FF}, worst change to any bone's local transform ${worst.toExponential(1)} (must be 0)`);
    if (!FF || worst > 1e-9) ok = false; }
  rg.legIK(f, new THREE.Vector3(0, -3, 0), N, 1);
  const a3 = f.ft.getWorldPosition(V());
  console.log(`  asked for 3 m: ankle at y ${fix(a3.y, 3)}, finite ${Number.isFinite(a3.x + a3.y + a3.z)}, leg ${fix(len()[0] + len()[1], 4)} long (straight is ${fix(L0[0] + L0[1], 4)})`);
  if (!Number.isFinite(a3.x + a3.y + a3.z) || Math.abs(len()[0] - L0[0]) > 1e-4) ok = false;
  return ok;
};
// ---------------------------------------------------------------- blade trails (r36)
// The shipped `trailBuild` on a fabricated skate path, and `trailAmount` against her state: none at
// a cruise, full at speed, full while spinning in the air; the strip tapers to nothing and fades.
CASES.trail = () => {
  let ok = true; const hist = [], now = 1;
  for (let i = 0; i <= 12; i++) hist.push({ x: -3 + i * 0.25, y: 0.02, z: 0, t: now - (12 - i) / 60 });
  const pos = new Float32Array(rg.TRAIL.n * 6), col = new Float32Array(rg.TRAIL.n * 8);
  const c = rg.trailBuild(hist, now, { x: 0, y: 2, z: -5 }, 1, pos, col);
  const wid = i => Math.hypot(pos[i * 6] - pos[i * 6 + 3], pos[i * 6 + 1] - pos[i * 6 + 4], pos[i * 6 + 2] - pos[i * 6 + 5]);
  const fin = [...pos.slice(0, c * 3)].every(Number.isFinite);
  console.log(`  ${c / 2} points, finite ${fin}; width at the skate ${fix(wid(12), 3)} m, at the tail ${fix(wid(0), 3)}; ` +
              `alpha ${fix(col[12 * 8 + 3])} -> ${fix(col[3])}`);
  if (!(fin && c === 26 && wid(12) > 0.05 && wid(0) < wid(12) * 0.5 && col[12 * 8 + 3] > col[3])) ok = false;
  if (rg.trailBuild(hist, now, { x: 0, y: 2, z: -5 }, 0, pos, col) !== 0) { console.log('  drawn with nothing earned'); ok = false; }
  const keep = { g: P.grounded, v: P.vel.clone(), hs: P.hSpeed, f: P.flip };
  const amt = (gr, hs, spin) => { P.grounded = gr; P.hSpeed = hs; P.flip = null; P.bailT = 0; rg.girl.yawRate = spin; return rg.trailAmount(); };
  const a1 = amt(true, 5, 0), a2 = amt(true, 20, 0), a3 = amt(false, 4, 10), a4 = amt(false, 4, 0);
  console.log(`  earned: rolling 5 m/s ${fix(a1)}, 20 m/s ${fix(a2)}, spinning in the air ${fix(a3)}, still in the air ${fix(a4)}`);
  if (!(a1 < 0.01 && a2 > 0.99 && a3 > 0.99 && a4 < 0.01)) ok = false;
  P.grounded = keep.g; P.hSpeed = keep.hs; P.flip = keep.f; rg.girl.yawRate = 0;
  return ok;
};
CASES.feel = () => {
  let ok = true;
  const chk = (label, c, extra = '') => { console.log(`  ${label.padEnd(44)} ${c ? 'ok' : 'WRONG'} ${extra}`); if (!c) ok = false; };
  const keepLock = P.stanceLock;
  // 1. LEAN INTO THE TURN, forward and fakie: her up tips toward where her travel is bending to
  const leanRun = (stance, label) => {
    P.stanceLock = true; place(60, 1, -60, stance > 0 ? 0 : Math.PI, 0); P.vel.set(0, 0, 10); P.stance = stance;
    let pv = P.vel.clone(), into = 0, n = 0, worst = 1, maxDeg = 0;
    run(0.6, t => { rg.cam.az = 0; rg.stick.L.x = 0.8; rg.stick.L.y = 0;
      if (t > 0.15) {
        const a = P.vel.clone().sub(pv); a.y = 0;
        const vh = new THREE.Vector3(P.vel.x, 0, P.vel.z).normalize(); a.addScaledVector(vh, -a.dot(vh));
        if (a.length() > 1e-4) {
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rg.groundQ(new THREE.Quaternion()));
          const c = new THREE.Vector3(up.x, 0, up.z).dot(a.normalize());
          into += c > 0 ? 1 : 0; n++; worst = Math.min(worst, c); maxDeg = Math.max(maxDeg, Math.asin(Math.min(1, Math.hypot(up.x, up.z))) * 57.3);
        }
      }
      pv.copy(P.vel); });
    chk(label, n > 5 && worst > 0, `leaning toward the centre on ${into} of ${n} frames, up to ${fix(maxDeg, 1)} deg`);
    return maxDeg;
  };
  const dF = leanRun(1, 'carving FORWARD: leans INTO the turn');
  const dB = leanRun(-1, 'carving FAKIE: leans INTO the turn too');
  chk('...and it is a lean you can see', dF > 4 && dB > 4, `${fix(dF, 1)} / ${fix(dB, 1)} deg`);
  // 2. THE TURN AXIS: his hips sit ahead of the export's root, and the offset puts them on the axis
  const g = readGLB('models/alien_rollerskate_blue.glb'), S = skelFromGLB(g.json);
  S.root.updateMatrixWorld(true);
  const hl = new THREE.Vector3(); S.by.mixamorig_Hips.getWorldPosition(hl); S.root.worldToLocal(hl);
  const off = rg.centreOffset(hl, 1, 0, 1, new THREE.Vector3());
  chk('hips ahead of the root in the export', hl.z > 0.05, `hips at z ${fix(hl.z, 3)} of a ${fix(S.by.mixamorig_Head.getWorldPosition(new THREE.Vector3()).y, 2)} head height`);
  chk('the offset puts them ON the turn axis', Math.hypot(hl.x + off.x, hl.z + off.z) < 1e-9);
  const half = rg.centreOffset(hl, 1, Math.PI / 2, 0.5, new THREE.Vector3()), r = hl.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  chk('...turned with the model, and by the dial', Math.abs(r.x * 0.5 + half.x) < 1e-9 && Math.abs(r.z * 0.5 + half.z) < 1e-9);
  // 3. THE AIR SPIN: full rate from 60% of the pad, and her body's yaw IS her heading, every frame
  const keepAimF = rg.AIR.aim; rg.AIR.aim = 0;     // r26's rate mode; r55's heading mode is `npm run sim airctl`
  place(60, 1, -60, 0, 0); P.grounded = false; P.pos.y += 30; P.vel.set(0, 0, 0); P.flip = null;
  const h0 = P.heading; let worstYaw = 0;
  run(0.1, () => { rg.stick.L.x = 0.6; rg.stick.L.y = 0;
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(P.bq);
    worstYaw = Math.max(worstYaw, Math.abs(wrap(Math.atan2(f.x, f.z) - P.heading)) * 57.3); });
  const spun = Math.abs(P.heading - h0); rg.AIR.aim = keepAimF;
  chk('air spin at 60% of the pad: full speed at once', spun > rg.AIR.spin * 0.1 * 0.9, `${fix(spun * 57.3, 0)} deg in 0.1 s`);
  chk('air spin: the body yaw IS the heading', worstYaw < 1.5, `worst ${fix(worstYaw, 2)} deg behind`);
  // 4. r33: THE PRE-ALIGN AND THE SETTLE, over the half pipe's steep transition (z ~34.6, x 0).
  { const n0 = rg.groundAt(0, 34.6, 20, 30), N = new THREE.Vector3(n0.nx, n0.ny, n0.nz);
    const face = Math.acos(N.y) * 57.3;
    const upOff = () => Math.acos(Math.max(-1, Math.min(1, new THREE.Vector3(0, 1, 0).applyQuaternion(P.bq).dot(
      (() => { const g = rg.groundAt(P.pos.x, P.pos.z, P.pos.y, 0.05); return new THREE.Vector3(g.nx, g.ny, g.nz); })())))) * 57.3;
    // dropped onto it from 6 m with no input: how square is she to the face on the frame she lands?
    const drop = (pre) => { const keepP = rg.AIR.preAlign; rg.AIR.preAlign = pre;
      place(0, 1, 34.6, Math.PI / 2, 0); P.grounded = false; P.pos.y = n0.floor + 6; P.vel.set(2, 0, 0); P.airT = 0.3;
      let off = null, last = 0;
      run(2, () => { rg.stick.L.x = rg.stick.L.y = 0; if (!P.grounded) last = upOff(); else if (off === null) off = last; });
      rg.AIR.preAlign = keepP; return off; };
    const on = drop(rg.AIR.preAlign), off = drop(0);
    chk('pre-align: lands already matching a ramp', on !== null && on < 12 && off !== null && off > face * 0.6,
        `${fix(on, 1)} deg out at touchdown, against ${fix(off, 1)} without it (the face is ${fix(face, 0)} deg)`);
    // the settle: high over it, moving, right pad held DOWN -- r61: she DIVES down the face, body squared to it, and
    // keeps the speed through the landing
    const keepSP = rg.AIR.settleRamp; rg.AIR.settleRamp = 1;     // r56: the pad settles only with a ramp below (this is one)
    place(0, 1, 34.6, 0, 0); P.grounded = false; P.pos.y = n0.floor + 6; P.vel.set(0, 2, 4); P.airT = 0.3;
    Object.assign(rg.stick.R, { down: 1, x: 0, y: 1 });
    let touch = null, so = 99, after = null;
    run(2, () => { rg.stick.L.x = rg.stick.L.y = 0; if (!touch) { so = upOff(); if (P.grounded) touch = P.speed; } else if (after === null) after = P.speed; });
    Object.assign(rg.stick.R, { down: 0, x: 0, y: 0 }); rg.AIR.settleRamp = keepSP;
    chk('settle: held down over a ramp, she dives onto it with speed', touch !== null && touch > 11 && after > 11 && so < 12,
        touch !== null ? `4 m/s across -> ${fix(touch, 1)} m/s at touchdown, ${fix(after, 1)} on the ramp, body ${fix(so, 1)} deg off the face` : 'never landed');
    { const keepS = rg.AIR.slam; rg.AIR.slam = 0; rg.AIR.settleRamp = 1;
      place(0, 1, 34.6, 0, 0); P.grounded = false; P.pos.y = n0.floor + 14; P.vel.set(0, 2, 8); P.airT = 0.3; P.rHold = 0;      // r99: a fresh press in the air (`place` runs no frame to clear it)
      Object.assign(rg.stick.R, { down: 1, x: 0, y: 1 }); run(0.7, () => { rg.stick.L.x = rg.stick.L.y = 0; });
      const hs = Math.hypot(P.vel.x, P.vel.z); Object.assign(rg.stick.R, { down: 0, x: 0, y: 0 }); rg.AIR.slam = keepS; rg.AIR.settleRamp = keepSP;
      chk('settle with the dive off is the old brake', hs < 1.5, `8 m/s -> ${fix(hs, 2)} m/s across`); }
    // from the flat, over the bowl's rim: ollie, hold down, drop in hot
    { const B = rg.BOWL; place(B.x, 0, B.z + B.r + 12, Math.PI, 10); let fired = 0, inB = null;
      run(3, () => { rg.cam.az = Math.PI; rg.stick.L.x = 0; rg.stick.L.y = P.grounded && !fired ? -1 : 0;
        if (!fired && P.pos.z < B.z + B.r + 2.2) { P.jump = 1; fired = 1; }
        if (fired && !P.grounded) Object.assign(rg.stick.R, { down: 1, x: 0, y: 1 }); else Object.assign(rg.stick.R, { down: 0, x: 0, y: 0 });
        if (fired && P.grounded && P.pos.y < -0.3 && !inB) inB = { v: P.speed, y: P.pos.y }; });
      Object.assign(rg.stick.R, { down: 0, x: 0, y: 0 });
      chk('ollie over the bowl rim, hold down: drops in fast', !!inB && inB.v > 12, inB ? `in the bowl at ${fix(inB.v, 1)} m/s (y ${fix(inB.y, 2)})` : 'never got into the bowl'); }
    // and the same without it is still upright up there
    place(0, 1, 34.6, 0, 0); P.grounded = false; P.pos.y = n0.floor + 14; P.vel.set(0, 2, 8); P.airT = 0.3;
    run(0.7, () => { rg.stick.L.x = rg.stick.L.y = 0; });
    chk('...and without it she flies on, upright', Math.hypot(P.vel.x, P.vel.z) > 6, `${fix(Math.hypot(P.vel.x, P.vel.z), 1)} m/s across`); }
  P.stanceLock = keepLock; rg.stick.L.x = rg.stick.L.y = 0;
  return ok;
};

// ---------------------------------------------------------------- the rails
// THE SHIPPED `railCatch` / `stepGrind` / `grindLeave` through the real `stepPlayer`, over the real
// rails `buildPark` built. Each row puts her in the air near a rail and lets the physics decide.
// r49: ORBITAL -- the canal quarter, the plaza, the rooftops, Nimbus and the sky. Every line of the district
// driven through the shipped `stepPlayer` + `stepCity` over the real collider: in through the gate, up the
// stairs, over a bridge, into the canal (and back out where she last stood), down to the plaza, off a mushroom,
// up the helix to the roof, along the sky rail, across the island gap, up the spire to the PEAK -- and the
// rooftop gaps, the halo, the train, a bowl.
CASES.orbital = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(46)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const O = rg.ORB, T = O.tower, [I1, I2, I3] = O.isl, path = n => rg.PATHS.find(q => q.name === n);
  const city = () => rg.stepCity(DT);
  const fwd = h => { rg.cam.az = h; rg.stick.L.x = 0; rg.stick.L.y = -1; };
  console.log(`  ${O.chunks} chunks, ${O.lanes.length} lanes, ${O.bounce.length} mushrooms, ${rg.PATHS.filter(q => /halo|monorail|nimbus|sky|spire|slime|loop|stair|bridge|canal|market|plaza/.test(q.name)).length} rail paths, ${rg.GEM.list.length} gems, ${O.bad} bad vertices`);
  { let tri = 0, n = 0; for (const m of O.meshes) { n++; m.traverse(o => { if (o.geometry && o.geometry.attributes.position) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); }); } console.log(`  ${n} meshes, ${Math.round(tri / 1000)}k triangles`); }
  say('the district built cleanly', O.built && O.bad === 0 && O.chunks > 4 && rg.SIGNS.every(s => rg.orbAtlas().rects[s[0]]), `${O.chunks} chunks, ${O.bad} NaN, atlas ${rg.orbAtlas().W}x${rg.orbAtlas().H}`);
  // 1. OUT THROUGH THE SOUTH GATE
  { place(0, 0, -50, Math.PI, 12); let low = 9, at = null; run(5, () => { fwd(Math.PI); city(); low = Math.min(low, P.pos.y); if (!at && P.pos.z < -99) at = P.pos.clone(); });
    say('out of the park through the south gate', !!at && Math.abs(at.y) < 0.3 && low > -0.5, at ? `out at z ${fix(at.z, 1)} y ${fix(at.y)}, lowest ${fix(low)}` : `stuck at z ${fix(P.pos.z, 1)}`); }
  // 2. UP THE GRAND STAIRS onto the north quay
  { quietAt(0, -108); city(); place(0, 0, -97, Math.PI, 9); let at = null; run(4, () => { fwd(Math.PI); city(); if (!at && P.pos.z < -124 && P.grounded) at = P.pos.clone(); });
    say('up the grand stairs onto the quay', !!at && Math.abs(at.y - O.nq.y) < 0.15, at ? `on the quay at z ${fix(at.z, 1)} y ${fix(at.y)}` : `got to z ${fix(P.pos.z, 1)} y ${fix(P.pos.y)}`); }
  // 3. OVER THE MIDDLE BRIDGE
  { const s0 = O.splashes; place(0, 4, -128, Math.PI, 10); let top = 0, at = null; run(3, () => { fwd(Math.PI); city(); top = Math.max(top, P.pos.y); if (!at && P.pos.z < -156 && P.grounded) at = P.pos.clone(); });
    say('over the middle bridge', !!at && Math.abs(at.y - O.sq.y) < 0.15 && O.splashes === s0 && top > 6, at ? `on the far quay at z ${fix(at.z, 1)} y ${fix(at.y)}, crest ${fix(top)}, splashes ${O.splashes - s0}` : `got to z ${fix(P.pos.z, 1)}`); }
  // 4. INTO THE CANAL -- and back where she last stood
  { const s0 = O.splashes; place(30, 4, -131, Math.PI, 8); let wet = false; run(3, () => { city(); if (O.splashes > s0) wet = true; });
    say('off the quay into the canal: put back', wet && Math.abs(P.pos.y - O.nq.y) < 0.2 && P.pos.z > O.nq.z0, `splashes ${O.splashes - s0}, back at z ${fix(P.pos.z, 1)} y ${fix(P.pos.y)}`); }
  // 5. DOWN THE PLAZA STAIRS
  { place(0, 4, -160, Math.PI, 8); run(3, () => { fwd(Math.PI); city(); });
    say('down the stairs into the plaza', P.pos.z < -183 && Math.abs(P.pos.y) < 0.15, `at z ${fix(P.pos.z, 1)} y ${fix(P.pos.y)}`); }
  // 6. A MUSHROOM throws her up
  { const M = O.bounce[0]; place(M.x + 0.5, M.y + 3, M.z, 0, 0); const y0 = P.pos.y; let top = y0;
    run(2.5, () => { city(); top = Math.max(top, P.pos.y); });
    say('a mushroom cap bounces her', y0 > M.y - 0.8 && top > y0 + 6, `stood at ${fix(y0)} (cap ${fix(M.y)}), thrown to ${fix(top)}`); }
  // 7. UP THE NIMBUS HELIX, steering along it the way a thumb would, to the roof
  { const s = rg.CITY.spots.nimbus; place(s[0], s[1], s[2], s[3], 6); let top = 0, t = 0, off = false;
    run(45, (tt) => { const a = Math.atan2(P.pos.z - T.z, P.pos.x - T.x), r = Math.hypot(P.pos.x - T.x, P.pos.z - T.z);
      if (P.pos.y > T.h - 0.3) fwd(Math.atan2(T.x - P.pos.x, T.z - P.pos.z));
      else { const e = r - (T.r + T.lane / 2), tx = -Math.sin(a) - Math.cos(a) * e * 0.25, tz = Math.cos(a) - Math.sin(a) * e * 0.25; fwd(Math.atan2(tx, tz)); }
      city(); if (P.pos.y > top) { top = P.pos.y; t = tt; } if (top > 4 && P.pos.y < top - 6) off = true; });
    const onRoof = Math.abs(P.pos.y - T.h) < 0.2 && Math.hypot(P.pos.x - T.x, P.pos.z - T.z) < T.r;
    say('up the helix to Nimbus\'s roof', onRoof && !off, `top ${fix(top, 1)} m at ${fix(t, 1)} s, ended ${fix(Math.hypot(P.pos.x - T.x, P.pos.z - T.z), 1)} m from the centre at y ${fix(P.pos.y, 1)}${off ? ', FELL OFF' : ''}`); }
  // 8. THE SKY RAIL to the first island
  { const sr = path('sky rail'); { const d = Math.hypot(I1.x - T.x, I1.z - T.z); place(T.x + (I1.x - T.x) / d * 3, T.h, T.z + (I1.z - T.z) / d * 3, Math.atan2(I1.x - T.x, I1.z - T.z), 0); } P.jump = 1;   // a tap on the roof near its start hops on
    let on = false; run(14, () => { city(); if (P.grind && P.grind.rail.path === sr) on = true; });
    const d = Math.hypot(P.pos.x - I1.x, P.pos.z - I1.z);
    say('a tap on the roof, the sky rail, onto island 1', on && P.grounded && Math.abs(P.pos.y - I1.y) < 0.2 && d < I1.r, `${on ? 'rode it' : 'never caught it'}, ended ${fix(d, 1)} m from I1 at y ${fix(P.pos.y, 1)}`); }
  // 9. THE RUNWAY AND THE KICKER, across the gap to island 2 -- no pop
  { const s = rg.CITY.spots.sky; place(s[0], s[1], s[2], s[3], 0); let air = false, land = null;
    run(7, () => { fwd(s[3]); city(); if (!P.grounded) air = true; else if (air && !land) land = P.pos.clone(); });
    const d = land ? Math.hypot(land.x - I2.x, land.z - I2.z) : 99;
    say('runway + kicker: island 1 -> island 2', !!land && Math.abs(land.y - I2.y) < 0.25 && d < I2.r, land ? `landed ${fix(d, 1)} m from I2's centre at y ${fix(land.y, 1)}` : 'never landed'); }
  // 10. THE SPIRE RAIL to the PEAK
  { const sr = path('spire rail'); O.peakGot = 0; place(I2.x, I2.y, I2.z, 0, 0);
    rg.enterGrind({ rail: sr.segs[0], t: 0.05, dir: 1, s: 8, side: 'left' });
    run(25, () => city());
    say('the spire rail onto the PEAK', O.peakGot === 1 && Math.abs(P.pos.y - I3.y) < 0.2, `peak ${O.peakGot ? 'REACHED' : 'not reached'}, ended y ${fix(P.pos.y, 1)}, ${fix(Math.hypot(P.pos.x - I3.x, P.pos.z - I3.z), 1)} m from I3`); }
  // 11. THE ROOFTOP GAPS, a tap at the edge
  for (const [label, x, z, h, nh, axis, edge, next] of [['W1 -> W2', -112, -175, Math.PI, 10.5, 'z', -192.5, O.roofs[1]], ['W2 -> W3', -112, -209, Math.PI, 13, 'z', -226.5, O.roofs[2]], ['W3 -> W4', -119, -250, Math.PI / 2, 15.5, 'x', -101.6, O.roofs[3]]]) {
    const y = O.roofs.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1).h; place(x, y, z, h, 5); let tapped = false, air = false, land = null;
    run(5, () => { fwd(h); city(); const past = axis === 'z' ? P.pos.z < edge : P.pos.x > edge;
      if (past && !tapped && P.grounded) { P.jump = 1; tapped = true; }
      if (!P.grounded) air = true; else if (air && !land) land = P.pos.clone(); });
    const inside = land && land.x > next.x0 && land.x < next.x1 && land.z > next.z0 && land.z < next.z1;
    say(`rooftop gap ${label}, a tap at the edge`, !!land && inside && Math.abs(land.y - nh) < 0.25, land ? `landed at ${fix(land.x, 1)}, ${fix(land.y, 1)}, ${fix(land.z, 1)}` : 'never landed');
  }
  // 12. ON THE STATION ROOF, a tap hops onto the monorail; and the train knocks her off it
  { const M = O.mono, mp = M.path, r4 = O.roofs[3]; place(r4.x1 - 1.5, r4.h, (r4.z0 + r4.z1) / 2, Math.PI / 2, 0); P.jump = 1;
    O.train.s = 0; const v0 = M.v; M.v = 0;
    let on = false; run(1.5, () => { city(); if (P.grind && P.grind.rail.path === mp) on = true; });
    say('station roof: a tap hops onto the monorail', on, on ? `grinding at ${fix(P.grind ? P.grind.s : 0, 1)} m/s` : 'never caught it');
    if (on && P.grind) { const her = P.grind.rail.s0 + P.grind.t * P.grind.rail.len; O.train.s = (her + P.grind.dir * 7 + mp.len) % mp.len + (P.grind.dir > 0 ? M.cars * (M.carL + M.gap) : 0);
      let hit = false; run(2, () => { city(); if (rg.CITY.goMsg === 'TRAIN!' && !P.grind) hit = true; });
      say('...and the train knocks her off it', hit, hit ? 'knocked off' : 'still grinding'); }
    M.v = v0; }
  // 13. THE HALO: a tap from the plinth catches it
  { const st = O.statue, hp = path('halo'); place(st.x, st.h, st.z + 4.6, Math.PI, 0); P.jump = 1; let on = false;
    run(2, () => { city(); if (P.grind && P.grind.rail.path === hp) on = true; });
    say('a tap on the plinth catches the halo', on, on ? 'round the statue' : 'missed'); }
  // 14. A BOWL: dropped in off the coping at 7 m/s, she rides it and stays out of the floor
  { const b = O.bowls[0]; place(b.x + 8.4, 3, b.z, -Math.PI / 2, 7); let low = 9, inside = false;
    run(4, () => { city(); low = Math.min(low, P.pos.y); if (Math.hypot(P.pos.x - b.x, P.pos.z - b.z) < 4) inside = true; });
    say('dropped into a bowl', low > -0.1 && inside, `lowest ${fix(low)}, crossed the middle: ${inside}`); }
  // 15. A LANE pushes: at the foot of the helix with no thumb
  { const s = rg.CITY.spots.nimbus; place(s[0], s[1], s[2] - 13, s[3], 2); run(2, () => city());
    say('a boost lane pushes her with no thumb', P.speed > 8, `${fix(P.speed, 1)} m/s after 2 s from 2`); }
  return ok;
};
// r50: NEON SHORES -- the district from his top-down map, every route ridden through the shipped `stepPlayer` +
// `stepCity`: the east gate and the causeway, the lagoon and a canal (and back), a bridge, the plaza's berm and
// ring rail, the alley's launcher and roof run onto the transit spiral, the spiral to the deck, the track to the
// Spire, the secret route down, the gardens (launcher, ramp, rail back), the lighthouse, the Overflow, the snake
// run into the bowls, the market skyway. `follow` steers at a point a few metres along a path, as a thumb would.
// r52: THE SLICE -- one street of the painting, built to a look. It still has to PLAY: the west gate, the ramp and the
// stairs up to the terrace, the bridge, the canal, a tap onto a quay rail.
CASES.slice = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(48)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const L = rg.SLC, O = rg.ORB, Q = L.Q, TER = L.TER, city = () => rg.stepCity(DT);
  const fwd = h => { rg.cam.az = h; rg.stick.L.x = 0; rg.stick.L.y = -1; };
  if (process.env.TRIS) for (const m of L.meshes) if (m.geometry && m.geometry.attributes.position) console.log('   ', m.name, Math.round(m.geometry.attributes.position.count / 3));
  console.log(`  built ${L.built}, ${L.meshes.length} meshes, ${Math.round(L.tris / 1000)}k tris, textures + meshes in ${L.ms} ms`);
  if (!L.built) return false;
  { const sp0 = O.splashes; place(-40, 0, 2.5, -Math.PI / 2, 12); let at = null, sp = 0; run(8, () => { fwd(-Math.PI / 2); city(); if (!at && P.pos.x < -112 && P.grounded) { at = P.pos.clone(); sp = O.splashes; } });
    say('west gate, up the entry ramp, onto the canal head', !!at && Math.abs(at.y - Q) < 0.15 && sp === sp0, at ? `on at x ${fix(at.x, 1)} y ${fix(at.y)}` : `got to x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}`); }
  { place(-115, Q, 18, -Math.PI / 2, 8); let at = null; run(6, () => { fwd(-Math.PI / 2); city(); if (!at && P.pos.x < -139 && P.grounded) at = P.pos.clone(); });
    say('up the ramp onto the terrace', !!at && Math.abs(at.y - TER) < 0.2, at ? `on at x ${fix(at.x, 1)} y ${fix(at.y)}` : `got to x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}`); }
  { place(-118, Q, 12.6, -Math.PI / 2, 8); let at = null; run(6, () => { fwd(-Math.PI / 2); city(); if (!at && P.pos.x < -139 && P.grounded) at = P.pos.clone(); });
    say('up the stairs onto the terrace', !!at && Math.abs(at.y - TER) < 0.2, at ? `on at x ${fix(at.x, 1)} y ${fix(at.y)}` : `got to x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}`); }
  { const sp0 = O.splashes; place(-150, Q, -22, 0, 7); let top = 0, at = null; run(5, () => { fwd(0); city(); top = Math.max(top, P.pos.y); if (!at && P.pos.z > 5 && P.grounded) at = P.pos.clone(); });
    say('over the arch bridge', !!at && top > Q + 1.5 && O.splashes === sp0 && Math.abs(at.y - Q) < 0.15, at ? `across, crest ${fix(top, 2)}` : `got to z ${fix(P.pos.z, 1)}, splashes ${O.splashes - sp0}`); }
  { const sp0 = O.splashes; place(-172, Q, 3, Math.PI, 0); run(0.5, () => city()); P.vel.set(0, 0, -8); P.heading = P.faceH = Math.PI;
    let wet = false; run(3, () => { city(); if (O.splashes > sp0) wet = true; });
    say('over the quay rail into the canal: put back', wet && Math.abs(P.pos.y - Q) < 0.2, `splashes ${O.splashes - sp0}, back at y ${fix(P.pos.y)}`); }
  { place(-128, Q, 2.2, -Math.PI / 2, 8); run(0.2, () => city()); P.jump = 1; let on = null; run(2.5, () => { city(); if (P.grind && !on) on = P.grind.rail.path.name; });
    say('a tap beside the quay rail onto it', on === 'slice', on ? `grinding '${on}'` : 'missed'); }
  { place(-120, Q, 11.6, -Math.PI / 2, 9); run(0.2, () => city()); P.jump = 1; let on = null, top = 0; run(3, () => { city(); if (P.grind && !on) on = P.grind.rail.path.name; top = Math.max(top, P.pos.y); });
    say('a tap onto the stair rail, grind it up', on === 'slice', on ? `grinding, highest ${fix(top, 1)}` : 'missed'); }
  // r53: THE LAYERS -- every new level reached by riding, never placed onto
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const along = (pts, ahead) => { let bi = 0, bd = 1e9; pts.forEach((q, i) => { const d = Math.hypot(q.x - P.pos.x, q.z - P.pos.z) + Math.abs(q.y - P.pos.y) * 0.5; if (d < bd) { bd = d; bi = i; } });
    const t = pts[Math.min(pts.length - 1, bi + (ahead || 2))]; fwd(Math.atan2(t.x - P.pos.x, t.z - P.pos.z)); return bi; };
  const ride = (label, start, h, v, route, sec, goal) => { const sp0 = O.splashes; place(start[0], start[1], start[2], h, v); let low = 99, hit = null;
    let kk = 0; run(sec, () => { along(route); if (P.grind) rg.stick.L.x = rg.stick.L.y = 0; city(); low = Math.min(low, P.pos.y); if (process.env.DBG === label.slice(0, 7) && kk++ % (process.env.DBGN ? +process.env.DBGN : 10) === 0) console.log('   ', fix(P.pos.x, 2), fix(P.pos.y, 2), fix(P.pos.z, 2), 'v', fix(P.speed), P.grounded ? 'G' : 'air', P.grind ? 'GRIND' : ''); if (!hit && goal(P.pos) && P.grounded) { hit = P.pos.clone(); hit.sp = O.splashes; } });
    say(label, !!hit && hit.sp === sp0, hit ? `there at ${fix(hit.x, 1)}, ${fix(hit.y, 2)}, ${fix(hit.z, 1)}` : `ended ${fix(P.pos.x, 1)}, ${fix(P.pos.y, 2)}, ${fix(P.pos.z, 1)}, splashes ${O.splashes - sp0}`); };
  const R1 = [V3(-192, Q, 6.6), V3(-185, Q + 0.75, 7.0), V3(-177.5, Q + 2.2, 6.2), V3(-169.6, 6, 4.3), V3(-166, 6, 3)];
  ride('north quay up the curving ramp onto the bastion', [-196, Q, 6.6], Math.PI / 2, 6, R1, 8, p => Math.hypot(p.x + 166, p.z - 3) < 3.5 && Math.abs(p.y - 6) < 0.2);
  const R2 = [V3(-155.4, TER, 17), V3(-155.6, TER, 14.6), V3(-156.1, TER, 12.0), V3(-157.2, TER - 0.2, 9.4), V3(-160.4, TER - 1.6, 7.0), V3(-164, 6, 5.7), V3(-166, 6, 3)];
  ride('terrace down the pier ramp onto the bastion', [-155.4, TER, 18], Math.PI, 4, R2, 8, p => Math.hypot(p.x + 166, p.z - 3) < 3.5 && Math.abs(p.y - 6) < 0.2);
  const CB = [V3(-166, 6, 3), V3(-166.5, 6, -0.6), V3(-168.4, 6.35, -5.4), V3(-172.4, 6.85, -11), V3(-177.4, 7.3, -16.4), V3(-180.3, 7.5, -20), V3(-181, 7.5, -22.4), V3(-181, 7.5, -24.2), V3(-172, 7.5, -22.4), V3(-164, 7.5, -23.2), V3(-152, 7.5, -24.25), V3(-143.5, 5.25, -24.15), V3(-135.6, Q, -23.9), V3(-130, Q, -23.9)];
  ride('bastion -> the crooked bridge -> the gallery', [-166, 6, 3], Math.PI, 3, CB, 10, p => p.z < -22.5 && Math.abs(p.y - 7.5) < 0.2);
  ride('bastion -> bridge -> gallery round the tower -> down to the quay', [-166, 6, 3], Math.PI, 3, CB, 22, p => p.x > -134 && Math.abs(p.y - Q) < 0.15);
  const VI = [V3(-165, TER, 17.6), V3(-167.5, TER, 17.6), V3(-179, TER + 2, 17.6), V3(-188.5, TER + 3.6, 16.6), V3(-194.6, TER + 4.7, 12.4), V3(-196.6, 14.6, 5), V3(-197, 15, -4), V3(-197, 15, -16), V3(-197, 15, -24), V3(-197, 14.7, -27.6), V3(-197, 14.04, -31.5), V3(-197, 14, -35)];
  ride('terrace -> the viaduct -> over the canal onto the west roof', [-163, TER, 17.6], -Math.PI / 2, 6, VI, 20, p => p.z < -29 && Math.abs(p.y - 14) < 0.2);
  const TP = [V3(-113, Q, -12.75), V3(-115.4, Q, -12.75), V3(-120, Q - 0.6, -12.8), V3(-126, 1.6, -12.8), V3(-133, 1.5, -12.8), V3(-144, 1.5, -12.8)];
  ride('canal head down the ramp onto the towpath', [-113, Q, -12.75], -Math.PI / 2, 4, TP, 6, p => p.x < -128 && Math.abs(p.y - 1.5) < 0.15);
  const GS = [V3(-194.2, 7.5, -24.25), V3(-192, 7.5, -24.25), V3(-192, 7.5, -22.6), V3(-192, Q, -15.4), V3(-192, Q, -14.9)];
  ride('down the gallery stairs to the quay', [-194.2, 7.5, -24.25], Math.PI / 2, 3, GS, 6, p => p.z > -16 && Math.abs(p.y - Q) < 0.15);
  { place(-178, 9.6, 17.1, -Math.PI / 2, 7); run(0.2, () => city()); P.jump = 1; let on = null; run(2.5, () => { city(); if (P.grind && !on) on = P.grind.rail.path.name; });
    say('a tap onto the viaduct parapet rail', on === 'slice', on ? `grinding '${on}'` : 'missed'); }
  // r54: THE NEXUS -- the bowl, the terraces, the fountain, all from where you would actually be
  { const N = rg.NEX, B = N.bowl, bx = (B.x0 + B.x1) / 2, bz = (B.z0 + B.z1) / 2, sp = rg.CITY.spots.slice, sp0 = O.splashes;
    place(sp[0], sp[1], sp[2], sp[3], 5); let low = 99; run(4, () => { fwd(sp[3]); city(); low = Math.min(low, P.pos.y); });
    say('from the spawn, roll straight into the bowl', low < B.floor + 0.15 && O.splashes === sp0, `lowest ${fix(low, 2)} (floor ${B.floor}), splashes ${O.splashes - sp0}`);
    // up the wall at speed: no pop comes back in; a tap at the lip hops onto the coping and grinds it (r41's
    // homing, and a coping grind is exactly what a tap at the lip of a bowl should be); a swipe goes out
    for (const [v, pop] of [[13, 0], [13, 1], [13, 2]]) { let kk = 0; const s0 = O.splashes; place(bx, B.floor, bz, 0, v); let phase = 0, land = null, fired = 0, top = 0, on = null;
      run(5, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0; top = Math.max(top, P.pos.y); if (P.grind && !on) on = P.grind.rail.path.name;
        if (pop && !fired && P.grounded && P.pos.y > rg.SLC.Q - 0.7 && P.vel.y > 0) { P.jump = pop; fired = 1; }
        if (phase === 0 && !P.grounded) phase = 1;
        if (phase === 1 && P.grounded && !P.grind) { phase = 2; land = P.pos.clone(); } if (process.env.DBG === 'bowl' && kk++ % 6 === 0) console.log('   ', fix(P.pos.y, 2), fix(P.pos.z, 2), fix(P.vel.y), P.grounded ? 'G' : 'air', P.grind ? 'GRIND' : ''); });
      const out = !!land && land.z > B.z1 && land.y > rg.SLC.Q - 0.1, inb = !!land && land.z < B.z1 && land.y < rg.SLC.Q - 0.3;
      const good = O.splashes === s0 && (pop === 0 ? inb && top > rg.SLC.Q : pop === 1 ? on === 'slice bowl' : out);
      say(`the bowl at ${v} m/s ${['with no pop: air, back in', '+ a tap at the lip: grinds the coping', '+ a SWIPE: out of the bowl'][pop]}`, good,
        pop === 1 ? (on ? `grinding '${on}'` : 'no grind') : land ? `up to ${fix(top, 1)}, down at z ${fix(land.z, 1)} y ${fix(land.y, 2)}` : 'never landed'); }
    { place(bx, rg.SLC.Q, B.z1 + 1.1, -Math.PI / 2, 6); run(0.2, () => city()); P.jump = 1; let on = null; run(2.5, () => { city(); if (P.grind && !on) on = P.grind.rail.path.name; });
      say('a tap on the walkway onto the bowl coping', on === 'slice bowl', on ? `grinding '${on}'` : 'missed'); }
    const T = N.tier, yT = rg.SLC.Q + T.n * T.dy;
    { place(-100.5, rg.SLC.Q, T.z - 1.2, 0, 6); let at = null; run(5, () => { fwd(0); city(); if (!at && P.pos.z > T.z + T.n * T.step && P.grounded) at = P.pos.clone(); });
      say('up the terrace steps, kerb by kerb, to the top', !!at && Math.abs(at.y - yT) < 0.1, at ? `on at z ${fix(at.z, 1)} y ${fix(at.y, 2)}` : `got to z ${fix(P.pos.z, 1)} y ${fix(P.pos.y, 2)}`); }
    { place(-94.2, rg.SLC.Q, 7, 0, 7); let at = null; run(5, () => { fwd(0); city(); if (!at && P.pos.z > 17 && P.grounded) at = P.pos.clone(); });
      say('up the bank onto the top platform', !!at && Math.abs(at.y - yT) < 0.1, at ? `on at z ${fix(at.z, 1)} y ${fix(at.y, 2)}` : `got to z ${fix(P.pos.z, 1)} y ${fix(P.pos.y, 2)}`); }
    { const hx = (T.x0 + T.x1) / 2; place(hx + 0.9, yT, T.z + (T.n - 1) * T.step + 2.6, Math.PI, 5); run(0.2, () => city()); P.jump = 1; let on = null, low = 99;
      run(3, () => { city(); if (P.grind && !on) on = P.grind.rail.path.name; if (P.grind) low = Math.min(low, P.pos.y); });
      say('a tap onto the hubba, grind it down the steps', on === 'slice' && low < yT - 1, on ? `grinding, down to ${fix(low, 1)}` : 'missed'); }
    { const F = N.fount; place(F.x, rg.SLC.Q, F.z + F.r[0] + 1.5, Math.PI, 5); let top = 0; run(3, () => { fwd(Math.PI); city(); if (P.grounded) top = Math.max(top, P.pos.y); });
      say('up the fountain rings to the basin', Math.abs(top - (rg.SLC.Q + F.r.length * F.dy)) < 0.05, `highest floor ${fix(top, 2)}`); } }
  return ok;
};
// r58: THE HUB, DRESSED -- the deck, the ledges, the plinth. Every piece through the shipped step, from where
// a player would come at it, with the thumb a player would hold.
CASES.hub = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(48)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const H = rg.HUB, D = H.deck, city = () => rg.stepCity(DT);
  const fwd = h => { rg.cam.az = h; rg.stick.L.x = 0; rg.stick.L.y = -1; };
  const near = (x, z, r) => Math.hypot(P.pos.x - x, P.pos.z - z) < r;
  if (!rg.SLC.built) { console.log('  the slice is off -- the hub is dressed with it'); return true; }
  // the deck: up the front bank, down the stairs, off the east end
  { place(-54, 0, 40, 0, 8); let at = null; run(4, () => { fwd(0); city(); if (!at && P.pos.z > D.z0 + 1 && P.grounded) at = P.pos.clone(); });
    say('up the front bank onto the deck', !!at && Math.abs(at.y - D.y) < 0.08, at ? `on at z ${fix(at.z, 1)} y ${fix(at.y)}` : `got to z ${fix(P.pos.z, 1)} y ${fix(P.pos.y)}`); }
  { place(-43, D.y, 58, Math.PI, 6); let at = null, low = 99; run(3, () => { fwd(Math.PI); city(); low = Math.min(low, P.pos.y); if (!at && P.pos.z < D.z0 - 7 && P.grounded) at = P.pos.clone(); });
    say('down the stairs to the plaza', !!at && Math.abs(at.y) < 0.08 && low > -0.1 && P.hSpeed > 4, at ? `down at z ${fix(at.z, 1)}, ${fix(P.hSpeed, 1)} m/s` : `got to z ${fix(P.pos.z, 1)} y ${fix(P.pos.y)}`); }
  { place(-40, D.y, 62, Math.PI / 2, 7); let at = null; run(3, () => { fwd(Math.PI / 2); city(); if (!at && P.pos.x > D.x1 + 9 && P.grounded) at = P.pos.clone(); });
    say('off the east bank to the plaza', !!at && Math.abs(at.y) < 0.08, at ? `down at x ${fix(at.x, 1)}` : `got to x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}`); }
  { const sx = (D.stairs[0] + D.stairs[1]) / 2; place(sx - 1.4, D.y, D.z0 + 2.2, Math.PI, 5); run(0.2, () => city()); P.jump = 1; let on = false, low = 99;
    run(3, () => { city(); if (P.grind) { on = true; low = Math.min(low, P.pos.y); } });
    say('a tap at the top of the stairs: grind the rail down', on && low < D.y - 1, on ? `grinding, down to ${fix(low, 1)}` : 'missed'); }
  { place(-38, D.y, 57.6, Math.PI / 2, 5); run(0.2, () => city()); P.jump = 1; let on = false; run(2, () => { city(); if (P.grind) on = true; });
    say('a tap beside the deck ledge: grind it', on, on ? 'grinding' : 'missed'); }
  // the ledges
  { const Pd = H.pad; place(31, 0, -26, Math.PI, 6); let top = 0; run(2, () => { fwd(Math.PI); city(); if (P.grounded && near(31, (Pd.z0 + Pd.z1) / 2, 1.2)) top = Math.max(top, P.pos.y); });
    say('rolls up onto the manual pad (a kerb)', Math.abs(top - Pd.y) < 0.03, `on the pad at ${fix(top, 2)}`); }
  { const L = H.ledge; place(36, 0, -40, Math.PI, 5); let minz = 99; run(1.5, () => { fwd(Math.PI); city(); minz = Math.min(minz, P.pos.z); });
    say('the ledge is a wall, not a kerb', minz > L.z1 - 0.1, `stopped at z ${fix(minz, 2)} (face ${L.z1})`);
    place(36, 0, -42.6, Math.PI / 2, 5); run(0.2, () => city()); P.jump = 1; let on = false; run(2, () => { city(); if (P.grind) on = true; });
    say('a tap beside the ledge: grind its edge', on, on ? 'grinding' : 'missed'); }
  { const Y = H.pyr; place(Y.x + 13, 0, Y.z - 0.6, -Math.PI / 2, 8); let top = 0, at = null, low = 9; run(4, () => { fwd(-Math.PI / 2); city(); top = Math.max(top, P.pos.y); low = Math.min(low, P.pos.y); if (!at && P.pos.x < Y.x - Y.r - 1 && P.grounded) at = P.pos.clone(); });
    say('up and over the pyramid', top > Y.top - 0.1 && !!at && Math.abs(at.y) < 0.08 && low > -0.1, at ? `over the top (${fix(top, 2)}), down at x ${fix(at.x, 1)}` : `got to x ${fix(P.pos.x, 1)}, top ${fix(top, 2)}`);
    place(Y.x + 1.3, 0, Y.z + Y.r + 3, Math.PI, 4); run(0.2, () => city()); P.jump = 1; let on = false; run(2, () => { city(); if (P.grind) on = true; });
    say('a tap onto the pyramid down rail', on, on ? 'grinding' : 'missed'); }
  { const R = H.bar; place(R.x + 1.4, 0, (R.z0 + R.z1) / 2, 0, 5); run(0.2, () => city()); P.jump = 1; let on = false; run(2, () => { city(); if (P.grind) on = true; });
    say('a tap beside the flat bar: grind it', on, on ? 'grinding' : 'missed'); }
  // the gap: at a run-up it clears the bed and lands on the far deck or its bank; slow, it does not
  { const G = H.gap, zl = G.z - G.r * Math.sin(G.sweep), bed1 = zl - 0.3 - G.bed;
    for (const [v, pop] of [[13, 0], [10, 1], [5, 0]]) { place(G.x, 0, G.z + 10, Math.PI, v); let land = null, air = false, inBed = false, fired = 0;
      run(3, () => { rg.cam.az = Math.PI; city(); if (pop && !fired && P.grounded && P.pos.y > 0.55) { P.jump = 1; fired = 1; }
        if (!P.grounded) air = true; if (air && P.grounded && !land) land = P.pos.clone(); if (P.pos.z < zl - 0.3 && P.pos.z > bed1 && P.grounded) inBed = true; });
      const over = !!land && land.z < bed1 && !inBed;
      say(`the gap at ${v} m/s${pop ? ' + a pop at the lip' : ''}: ${v > 8 ? 'clears the bed' : 'does not'}`, v > 8 ? over : !over, land ? `landed at z ${fix(land.z, 1)} y ${fix(land.y, 2)}${inBed ? ', in the bed' : ''}` : `no air, at z ${fix(P.pos.z, 1)}`); } }
  { const V = H.pav; place(V.x - V.hx - 6, 0, V.z - 1, Math.PI / 2, 7); let ok2 = true; run(2.5, () => { rg.cam.az = Math.PI / 2; city(); if (P.pos.y > 0.3) ok2 = false; });
    say('rolls under the pavilion roof', ok2 && P.pos.x > V.x + V.hx, `at x ${fix(P.pos.x, 1)} y ${fix(P.pos.y, 2)}`); }
  // the plinth
  { const G = H.ring; place(G.x + 3, 0, G.z + G.r + 4, Math.PI, 6); let top = 0; run(2.5, () => { fwd(Math.PI); city(); if (P.grounded && near(G.x + 3, G.z, 1.5)) top = Math.max(top, P.pos.y); });
    say('rolls up onto the plinth (a kerb)', Math.abs(top - G.y) < 0.03, `on the plinth at ${fix(top, 2)}`);
    place(G.x, 0, G.z + G.r + 1.4, Math.PI / 2, 4); run(0.2, () => city()); P.jump = 1; let on = null; run(2, () => { city(); if (P.grind && !on) on = P.grind.rail.path.name; });
    say('a tap beside the plinth: grind the coping ring', !!on, on ? `grinding '${on}'` : 'missed');
    place(G.x, 0, G.z + G.r + 4, Math.PI, 6); let minz = 99; run(2.5, () => { fwd(Math.PI); city(); minz = Math.min(minz, P.pos.z); });
    say('the pylon is solid', minz > G.z + 0.8, `stopped at z ${fix(minz, 2)}`); }
  return ok;
};
// r59: THE RAIL NETWORK AND THE SKYWAY. Joins, branches and connectors are counted and listed; then grinds are
// driven through them with the shipped `stepGrind`, the left stick doing what a thumb would.
CASES.network = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(50)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const N = rg.RAILNET, S = rg.SKYW, city = () => rg.stepCity(DT);
  const point = (dx, dz) => { rg.cam.az = Math.atan2(dx, dz); rg.stick.L.x = 0; rg.stick.L.y = -1; };
  const free = () => { rg.stick.L.x = rg.stick.L.y = 0; };
  console.log(`  ${rg.PATHS.length} paths, ${N.joins} joins, ${N.branches} branches, ${N.woven.length} connectors woven`);
  for (const w of N.woven) console.log(`    ${w.from} -> ${w.to} at ${fix(w.x, 1)},${fix(w.y, 1)},${fix(w.z, 1)}, ${fix(w.len, 1)} m${w.y2 ? ' (a Y, both ways)' : ''}`);
  if (process.env.WEAVE) for (const d of N.dbg) console.log('    ' + d);
  say('connectors were woven between railings', N.woven.length >= 3, `${N.woven.length}`);
  say('rail ends are joined', N.joins > 10 && N.branches > 3, `${N.joins} joins, ${N.branches} branches`);
  // a grind carried through a connector: put her on the start of each one's source and ride, stick off
  { let through = 0, tried = 0;
    for (const C of rg.PATHS.filter(P => P.link)) { tried++;
      const a = C.segs[0].a, n = (() => { let best = null; for (const P of rg.PATHS) { if (P === C || P.link) continue; for (const R of P.segs) { for (const [q, t] of [[R.a, 0], [R.b, 1]]) { const d = q.distanceTo(a); if (d < 0.1 && (!best || d < best.d)) best = { R, t, d }; } } } return best; })();
      if (!n) continue;
      place(a.x, a.y, a.z, 0, 0); free();
      // start 3 m back up the source rail, running toward the connector
      const dir = n.t === 1 ? 1 : -1, back = rg.railExit ? null : null;
      P.grind = { rail: n.R, t: n.t === 1 ? Math.max(0, 1 - 3 / n.R.len) : Math.min(1, 3 / n.R.len), dir, s: 7, side: 'left', time: 0 };
      P.grounded = true; let onC = false, after = false;
      const L = C.segs[C.segs.length - 1].d;   // the thumb down the connector's way out, which is how a Y is chosen
      run(2.5, () => { if (onC) free(); else point(L.x, L.z); city(); if (P.grind && P.grind.rail.path === C) onC = true; if (onC && P.grind && P.grind.rail.path !== C) after = true; });
      if (onC && after) through++;
    }
    say('a grind runs through every connector onto the next rail', tried > 0 && through === tried, `${through} of ${tried}`); }
  // THE SKYWAY, end to end: tap onto the up rail from the plaza, steer round the network to the helix and down
  { place(-18, 0, 12, 0, 8); run(0.25, () => { point(0, 1); city(); }); P.jump = 1; let names = [], low = 99, landed = null, t = 0;
    const want = [['sky ring', [1, 0]], ['sky bridge', [1, 0]], ['sky ring', [0, -1]], ['sky span', [0, -1]], ['sky ring', [-1, 0]], ['sky helix', [-1, 0]]];
    run(30, () => { t += DT; const nm = P.grind ? P.grind.rail.path.name : null;
      if (nm && names[names.length - 1] !== nm) names.push(nm);
      // the thumb: before a ring, point where the next leg leaves it
      const k = names.filter(x => x).length; let aim = null;
      if (nm === 'sky up' || (nm === 'sky ring' && names.indexOf('sky bridge') < 0)) aim = [1, 0];
      else if (nm === 'sky bridge' || (nm === 'sky ring' && names.indexOf('sky span') < 0)) aim = [0, -1];
      else if (nm === 'sky span' || (nm === 'sky ring' && names.indexOf('sky helix') < 0)) aim = [-1, 0];
      if (aim) point(aim[0], aim[1]); else free();
      city(); if (names.indexOf('sky helix') >= 0 && !P.grind && P.grounded && !landed) landed = P.pos.clone(); });
    const route = names.join(' > ');
    say('the skyway: up, round, across, to the spire, down the helix', ['sky up', 'sky ring', 'sky bridge', 'sky span', 'sky helix'].every(n => names.indexOf(n) >= 0) && !!landed && landed.y < 0.5,
      `${route}${landed ? ` -- down at ${fix(landed.x, 1)},${fix(landed.z, 1)}` : ''}`); }
  // on a ring with no stick she goes round and does NOT take a branch
  { const I = S.isl[1], R = I.ring; place(I.x, I.y, I.z, 0, 0); P.grind = { rail: R.segs[0], t: 0.1, dir: 1, s: 6, side: 'left', time: 0 }; P.grounded = true;
    let left = null; run(4, () => { free(); city(); if (P.grind && P.grind.rail.path !== R && !left) left = P.grind.rail.path.name; });
    say('round a ring with no stick: no branch taken', !left, left ? `took '${left}'` : `still on the ring, ${P.grind ? fix(P.grind.s, 1) + ' m/s' : 'off'}`); }
  // the two other ways down
  for (const [nm, P2, endY] of [['sky drop', S.drop, rg.HUB.deck.y + 7.6], ['sky chute', S.chute, rg.HUB.pav.y + 0.36]]) {
    const R0 = P2.segs[0]; place(R0.a.x, R0.a.y, R0.a.z, 0, 0); P.grind = { rail: R0, t: 0.02, dir: 1, s: 6, side: 'left', time: 0 }; P.grounded = true;
    let land = null; run(8, () => { free(); city(); if (!P.grind && P.grounded && !land) land = P.pos.clone(); });
    say(`${nm}: grind it down and land on the roof`, !!land && Math.abs(land.y - endY) < 0.15, land ? `landed at y ${fix(land.y, 2)}` : `at y ${fix(P.pos.y, 2)}`); }
  return ok;
};
// r62: TRICK POINTS -- a spun jump scores its spin and banks after landing; a grind scores; the vert air's automatic
// 180 is NOT a spin; a bail loses the combo.
CASES.score = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(48)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const S = rg.SCORE, seen = () => { const L = new Set(); return { L, take: () => S.list.forEach(n => L.add(n)) }; };
  // 1. a jump spun with the stick (the spin-rate mode, so the thumb is a steady rate)
  { const keepA = rg.AIR.aim; rg.AIR.aim = 0; S.total = 0; place(60, 1, -60, 0, 6); const w = seen();
    run(0.1); P.jump = 1; run(2.5, () => { rg.stick.L.y = 0; rg.stick.L.x = P.grounded ? 0 : 1; w.take(); });
    rg.AIR.aim = keepA; rg.stick.L.x = 0;
    const spin = [...w.L].find(n => /^\d+$/.test(n));
    say('a spun jump scores its spin, banked on landing', !!spin && S.total > 0 && S.combo === 0, `${[...w.L].join(', ')} -> total ${S.total}`); }
  // 2. a tap onto a rail: GRIND, held ticks, banked
  { S.total = 0; const R = rg.RAILS.find(r => r.path.name === 'park'); place(R.mx + 1.6, 0, R.mz, Math.atan2(R.hx, R.hz), 6); const w = seen();
    run(0.2); P.jump = 1; let ground = false; run(4, () => { w.take(); });
    say('a grind scores and banks', w.L.has('GRIND') && S.total >= rg.SCORE.grind, `${[...w.L].join(', ')} -> total ${S.total}`); }
  // 3. the vert air's automatic half turn is not a spin
  { S.total = 0; place(0, 3, 29, 0, 13); const w = seen(); let fired = 0, air = 0;
    run(4, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0; if (!fired && P.grounded && P.n.y < 0.4 && P.vel.y > 0) { P.jump = 1; fired = 1; } if (!P.grounded) air = 1; w.take(); });
    const spun = [...w.L].filter(n => /^\d+$/.test(n));
    say('a vert air\'s auto 180 does not score as a spin', fired && air && spun.length === 0, `${fired ? 'tapped on the wall' : 'never tapped'}, tricks: ${[...w.L].join(', ') || 'none'}`); }
  // r62: a right-pad swipe on a rail is a grind trick now (the left pad's flick already was)
  { const R = rg.RAILS.find(r => r.path.name === 'park'); place(R.mx, R.a.y, R.mz, 0, 0); P.grind = { rail: R, t: 0.5, dir: 1, s: 6, side: 'left', time: 0 }; P.grounded = true;
    const got = [[1, 0], [-1, 0], [0, 1]].map(([dx, dy]) => { const r = rg.rightFlick(dx, dy); return r + ':' + (P.grind && P.grind.trick); });
    say('right-pad swipes on a rail pick grind tricks', got.every(g => g.startsWith('grind trick:') && !g.endsWith('null')), got.join(' ')); P.grind = null; }
  // 4. a bail loses the combo
  { S.total = 0; place(60, 1, -60, 0, 0); S.combo = 120; S.n = 2; S.list.push('TEST'); P.bailT = 1; run(0.05); P.bailT = 0;
    say('a bail loses the combo', S.combo === 0 && S.total === 0, `combo ${S.combo}, total ${S.total}`); P.wasBail = false; }
  return ok;
};
// ---------------------------------------------------------------- his zones (r64)
// *"Import zone_skyline (visual + collision GLB) via LEVEL.imports at [0,0,0] ... spawn me at marker_spot spawn and
// run the headless sim over a few rails/launchers."* The page is booted in the ZONES world (no park, no districts),
// his real collision file goes through the real GLTFLoader and the shipped `levelIngest`, and she is driven over it.
// The VISUAL is draco and node has no Worker to decode it, so it is not loaded here: what is tested is everything
// she touches, which is the collision file and nothing else.
CASES.zones = async () => {
  // r85: HIS r83 SKYLINE -- the riding surfaces are the ramp kit now (244 `fn_` pieces), so the old rows that named his
  // bridges and chutes are gone with them. This answers his checklist, every row through the real loader and the shipped
  // `levelIngest`: does every kit piece build, does it stand where it should, does every walk join without a lip or a gap,
  // does every steep walk keep its floor, does every launcher land, and does the spawn work.
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(50)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  // WHAT HIS FILE SAYS, as opposed to what the game does with it: those rows report, they do not fail the build
  const warns = [], warn = (label, good, msg) => { console.log(`  ${label.padEnd(50)} ${good ? 'ok' : 'EXPORT'} ${msg}`); if (!good) warns.push(label.trim()); };
  if (!rg.WORLD.zones) { console.log('  booted in the park world -- run `npm run sim zones`'); return false; }
  const g = await realGLB('zones/zone_skyline/zone_skyline_collision.glb');
  let nFn = 0, nLaunch = 0; g.scene.traverse(o => { if (/^fn_/.test(o.name)) nFn++; if (/^marker_launcher_/.test(o.name)) nLaunch++; });
  const K = rg.KITW.pieces, k0 = K.length;
  const t0 = performance.now(), st = rg.levelIngest(null, g.scene, new THREE.Matrix4(), 'skyline');
  console.log(`  ingest ${fix(performance.now() - t0, 0)} ms: ${JSON.stringify({ ...st, bad: undefined })}`);
  console.log(`  rail network: ${rg.RAILNET.joins} joins, ${rg.RAILNET.branches} branches; ➤ stops: ${rg.LEVEL.go.length}`);
  const O = rg.ORB, city = () => rg.stepCity(DT);
  const fwd = h => { rg.cam.az = h; rg.stick.L.x = 0; rg.stick.L.y = -1; };
  // 1. EVERY KIT PIECE BUILDS
  say('every kit piece in the file builds', st.fn === nFn, `${st.fn} of ${nFn}` + (st.bad ? ' -- ' + st.bad.join('; ') : ''));
  say('every launcher is read', O.launch.length === nLaunch && nLaunch > 0, `${O.launch.length} of ${nLaunch}`);
  say('the spawn is his', rg.LEVEL.spawned === 'skyline', `at ${[rg.SPAWN.x, rg.SPAWN.y, rg.SPAWN.z].map(v => fix(v, 1)).join(',')} facing ${fix(rg.SPAWN.h * 57.3, 0)} deg`);
  const mine = K.slice(k0), walks = mine.filter(r => r.kind === 'walk'), others = mine.filter(r => !/^(walk|wall)$/.test(r.kind));
  // 2. EVERY OTHER PIECE STANDS ON WHAT IS UNDER IT: the floor half a metre back off its toe is the ground she rides in on
  { const off = [];
    for (const r of others) { const T = r.T, bx = T.x - Math.sin(T.yaw) * 0.5, bz = T.z - Math.cos(T.yaw) * 0.5, gq = rg.groundAt(bx, bz, T.y + 0.6, 0);
      const d = gq.hit ? T.y - gq.floor : Infinity; if (Math.abs(d) > 0.2) off.push(`${r.kind}_${r.size} at ${fix(T.x, 0)},${fix(T.y, 1)},${fix(T.z, 0)} ` + (gq.hit ? (d > 0 ? `${fix(d, 2)} m ABOVE the floor` : `${fix(-d, 2)} m BELOW it`) : 'over nothing')); }
    warn('every placed piece sits on the floor at its toe', !off.length, off.length ? `${off.length} of ${others.length}: ${off.slice(0, 12).join('; ')}${off.length > 12 ? ' ...' : ''}` : `${others.length} pieces`); }
  // 3. THE WALKS: stations along each centreline (its own control points, which the smoothing passes through)
  const W = walks.map(r => { const T = r.T, pts = r.o.pts.map(q => { const P3 = rg.kP ? rg.kP(T, q[0], q[2] ?? 0, q[1]) : null; return new THREE.Vector3(P3[0], P3[1], P3[2]); });
    const st = []; for (let i = 0; i < pts.length - 1; i++) { const n = Math.max(1, Math.ceil(pts[i].distanceTo(pts[i + 1]) / 1.5)); for (let k = 0; k < n; k++) st.push(pts[i].clone().lerp(pts[i + 1], k / n)); }
    st.push(pts.at(-1).clone()); let slope = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); if (d > 0.05) slope = Math.max(slope, Math.atan2(Math.abs(pts[i].y - pts[i - 1].y), d)); }
    return { r, pts, st, slope, name: r.o.src || 'walk' }; });
  // 3a. the floor is there all the way along -- nothing flattened, nothing rejected as too steep
  { const bad = []; for (const w of W) { let miss = 0; let first = null; for (const q of w.st) { const gq = rg.groundAt(q.x, q.z, q.y + 0.5, 0); if (!gq.hit || Math.abs(gq.floor - q.y) > 0.5) { miss++; first = first || q; } } if (miss) bad.push(`${w.name} (${fix(w.slope * 57.3, 0)} deg) ${miss}/${w.st.length} from ${fix(first.x, 0)},${fix(first.y, 1)},${fix(first.z, 0)}`); }
    const steep = W.filter(w => w.slope > 0.52).map(w => `${w.name} ${fix(w.slope * 57.3, 0)}`);
    warn('every walk has its floor all the way along', !bad.length, bad.length ? 'stations with no floor at the path: ' + bad.join('; ') : `${W.length} walks, steepest ${steep.join(', ') || 'none over 30 deg'}`); }
  // 3b. THE JOINS: just past each end of a walk, the floor she rolls onto -- a step up or down is a lip, nothing is a gap
  { const lips = [], gaps = [];
    for (const w of W) for (const [e, f] of [[w.pts[0], w.pts[1]], [w.pts.at(-1), w.pts.at(-2)]]) {
      const dx = e.x - f.x, dz = e.z - f.z, l = Math.hypot(dx, dz) || 1, ox = e.x + dx / l * 0.8, oz = e.z + dz / l * 0.8, gq = rg.groundAt(ox, oz, e.y + 0.5, 0);
      if (!gq.hit || e.y - gq.floor > 1.0) gaps.push(`${w.name} end at ${fix(e.x, 0)},${fix(e.y, 1)},${fix(e.z, 0)}` + (gq.hit ? ` drops ${fix(e.y - gq.floor, 1)} m` : ' (nothing)'));
      else if (Math.abs(gq.floor - e.y) > 0.12) lips.push(`${w.name} ${fix(gq.floor - e.y, 2)} m at ${fix(e.x, 0)},${fix(e.z, 0)}`); }
    warn('every walk end meets a floor (no gap)', !gaps.length, gaps.length ? `${gaps.length}: ${gaps.join('; ')}` : `${W.length * 2} ends`);
    warn('every walk end meets it level (no lip)', !lips.length, lips.length ? `${lips.length}: ${lips.join('; ')}` : `${W.length * 2} ends`); }
  // 3c. RIDE EVERY WALK, top end to bottom end, steering down its middle: she must never come off it
  { const bad = [];
    for (const w of W) { const S = w.st[0].y >= w.st.at(-1).y ? w.st : w.st.slice().reverse(), n = S.length - 1;
      place(S[0].x, S[0].y + 0.3, S[0].z, Math.atan2(S[Math.min(n, 2)].x - S[0].x, S[Math.min(n, 2)].z - S[0].z), 5);
      const f0 = O.falls || 0; let far = 0, off = 0, done = false; const len = w.st.length * 1.5;
      // nearest station in 3D, and only a few ahead of the last: a helix and a switchback lie over themselves in plan, and a
      // nearest-in-plan station jumps to another turn; and arriving STOPS her -- rolling on off the end is not the walk's fault
      let bi = 0;
      run(Math.min(40, len / 4 + 4), () => { if (done) { rg.stick.L.y = 0; P.vel.set(0, 0, 0); return; }
        let bd = 1e9, b0 = bi; for (let i = b0; i <= Math.min(n, b0 + 6); i++) { const q = S[i], d = Math.hypot(q.x - P.pos.x, (q.y - P.pos.y) * 2, q.z - P.pos.z); if (d < bd) { bd = d; bi = i; } }
        far = Math.max(far, bi); if (P.grounded && P.pos.y < S[bi].y - 1.5) off++; if (bi >= n - 1) done = true;
        const t = S[Math.min(n, bi + 3)]; fwd(Math.atan2(t.x - P.pos.x, t.z - P.pos.z)); city(); });
      const fell = (O.falls || 0) - f0, at = `${fix(P.pos.x, 0)},${fix(P.pos.y, 1)},${fix(P.pos.z, 0)}`, sb = rg.solidAt(P.pos.x, P.pos.y + 0.8, P.pos.z, 0.6);
      if (fell || far < n - 1 || off > 6) bad.push(`${w.name}: ${fell ? `FELL off near ${fix(S[far].x, 0)},${fix(S[far].y, 1)},${fix(S[far].z, 0)}` : far < n - 1 ? `stopped dead ${fix((n - far) * 1.5, 0)} m short, at ${at}${sb ? ' against ' + sb.tag.replace('col:', '') : ''}` : `came off its end onto ${at}`}`); }
    warn('every walk ridden end to end, downhill', !bad.length, bad.length ? `${bad.length} of ${W.length}: ${bad.join('; ')}` : `${W.length} walks`); }
  // 4. SPAWN: she drops in and stays
  { rg.respawn(); const y0 = P.pos.y; run(1.5, () => city());
    say('spawned at his marker, and stays there', P.grounded && Math.abs(P.pos.y - y0) < 0.05 && Math.abs(y0 - rg.SPAWN.y) < 0.5 && Math.hypot(P.pos.x - rg.SPAWN.x, P.pos.z - rg.SPAWN.z) < 0.5, `at ${fix(P.pos.x, 1)}, ${fix(P.pos.y, 2)}, ${fix(P.pos.z, 1)}`); }
  // 5. OFF THE EDGE: past -40 she is put back where she last stood
  { let hole = null; for (let r = 4; r < 160 && !hole; r += 2) for (let a = 0; a < 6.28 && !hole; a += 0.2) { const x = rg.SPAWN.x + Math.cos(a) * r, z = rg.SPAWN.z + Math.sin(a) * r; if (!rg.groundAt(x, z, 300, 0).hit) hole = [x, z]; }
    rg.respawn(); run(1, () => city()); const f0 = O.falls || 0, safe = O.safe && O.safe.pos.clone();
    if (hole) { P.pos.set(hole[0], 6, hole[1]); P.grounded = false; P.vel.set(0, 0, 0); let low = 99; run(5, () => { city(); low = Math.min(low, P.pos.y); });
      say('falling off an island: back where she stood', (O.falls || 0) === f0 + 1 && P.grounded && !!safe && P.pos.distanceTo(safe) < 0.01, `fell from ${fix(hole[0], 0)},${fix(hole[1], 0)} to ${fix(low, 1)} m, back at ${fix(P.pos.x, 1)},${fix(P.pos.y, 1)},${fix(P.pos.z, 1)}`); } }
  // 6. EVERY LAUNCHER, from its ➤ stop: roll onto the pad, land on what it aims at
  O.launch.forEach((L, i) => { rg.goSpot('skyline pad ' + (i + 1)); const h = P.heading; let air = false, land = null, top = -99, fired = null;
    run(9, () => { if (!air) fwd(h); else rg.stick.L.y = 0; city(); top = Math.max(top, P.pos.y); if (!fired && L.cool > 0.5) fired = P.vel.y; if (!P.grounded) air = true; else if (air && !land) land = P.pos.clone(); });
    const d = land ? Math.hypot(land.x - L.tx, land.z - L.tz) : 99;
    // what is over the pad: a floor in the column she climbs is a floor she lands on (going up through a floor stands her on it)
    const over = rg.groundAt(L.x, L.z, Math.max(L.ty, L.y) + L.apex + 2, 0), walkOver = over.hit && over.floor > L.y + 2.5 ? W.find(w => w.st.some(q => Math.hypot(q.x - L.x, q.z - L.z) < 6 && Math.abs(q.y - over.floor) < 1.5)) : null;
    const why = over.hit && over.floor > L.y + 2.5 && over.floor < L.ty - 1 ? ` -- a floor over the pad at ${fix(over.floor, 1)} m${walkOver ? ' (' + walkOver.name + ')' : ''}` : '';
    const dbg = `pad ${fix(L.x, 1)},${fix(L.y, 1)},${fix(L.z, 1)} -> ${fix(L.tx, 1)},${fix(L.ty, 1)},${fix(L.tz, 1)}`;
    warn(`${L.name.replace('marker_launcher_', 'pad ')} fires and lands on its target`, fired > 5 && !!land && d < 6 && Math.abs(land.y - L.ty) < 1.5,
      (!fired ? 'never fired' + (L.buried ? ` -- the pad is INSIDE ${L.buried}` : '') : land ? `landed ${fix(d, 1)} m from its target at y ${fix(land.y, 1)} (target ${fix(L.ty, 1)}), apex ${fix(top, 1)}${L.clear != null ? ', arc ' + L.clear : ''}` : `never landed`) + why + (d > 6 || !fired ? ' [' + dbg + ']' : '')); });
  if (warns.length) console.log(`  ${warns.length} thing(s) to fix in the EXPORT, not here`);
  return ok;
};
// ---------------------------------------------------------------- the ramp kit (r66)
// Every piece in the kit gallery, driven through the shipped step in the KIT world (a child process, like `zones`).
CASES.kit = async () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(52)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  if (rg.WORLD.zones !== 2) { console.log('  booted in another world -- run `npm run sim kit`'); return false; }
  const K = rg.KITW, city = () => rg.stepCity(DT);
  console.log(`  ${K.pieces.length} pieces: ` + K.pieces.map(p => p.kind + ' ' + p.size).join(', '));
  const g = rg.SK.g, KSZ = rg.KSZ;
  // a piece-local point (u along, w across) in the world, and a piece-local direction as a heading
  const L = (pc, u, w) => rg.kT(pc.T, u, w, 0), H = (pc, phi) => pc.T.yaw + phi;
  const find = (kind, size, n) => K.pieces.filter(p => p.kind === kind && (!size || p.size === size))[n || 0];
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.kicked = 0; P.drift = 0; rg.ORB.safe = null; P.kickRail = null; P.grindWant = 0; };
  const go = (pc, u, w, phi, v) => { reset(); const t = L(pc, u, w); place(t.x, 0.2, t.z, H(pc, phi), v); rg.stick.L.x = rg.stick.L.y = 0; };
  const fwd = h => { rg.cam.az = h; rg.cam.steerAz = h; rg.stick.L.x = 0; rg.stick.L.y = -1; };
  const loc = pc => { const fx = Math.sin(pc.T.yaw), fz = Math.cos(pc.T.yaw), dx = P.pos.x - pc.T.x, dz = P.pos.z - pc.T.z; return { u: dx * fx + dz * fz, w: dx * fz - dz * fx }; };
  // run with no input (or `drive`), tracking what happened
  const ride = (sec, drive) => { const r = { top: -99, air: 0, airMax: 0, falls: rg.ORB.falls || 0, bail: 0, minUp: 1, low: 99 }; let a = 0;
    const up = new THREE.Vector3();
    run(sec, (t) => { if (drive) drive(t); else rg.stick.L.x = rg.stick.L.y = 0; city(); r.top = Math.max(r.top, P.pos.y); r.low = Math.min(r.low, P.pos.y);
      if (!P.grounded && !P.grind) { a += DT; r.airMax = Math.max(r.airMax, a); } else a = 0;
      if (P.bailT > 0) r.bail = 1; if (P.grind) r.minUp = Math.min(r.minUp, up.set(0, 1, 0).applyQuaternion(P.bq).y); });
    r.falls = (rg.ORB.falls || 0) - r.falls; return r; };
  // 1. GEOMETRY: no NaN, and no cracks -- a point with no floor near it whose four neighbours a quarter of a metre away
  //    all have a raised floor is a hole between two pieces
  say('no NaN vertex anywhere', !rg.MESHBAD || !rg.MESHBAD(), '');
  for (const pc of K.pieces.filter(p => /pipe|pool|bowl|qp|elbow|tee/i.test(p.kind))) {
    let holes = 0, n = 0; const R = Math.max(pc.len || 8, pc.wid || 8) + 2, s = 0.25;
    const fl = (x, z) => { const q = rg.groundAt(x, z, 20, 0); return q.hit ? q.floor : -1; };
    for (let x = pc.T.x - R; x <= pc.T.x + R; x += s) for (let z = pc.T.z - R; z <= pc.T.z + R; z += s) {
      const c = fl(x, z); if (c > 0.05) continue; n++;
      if ([[s, 0], [-s, 0], [0, s], [0, -s]].every(([dx, dz]) => fl(x + dx, z + dz) > 0.3)) holes++;
    }
    if (holes) say(`${pc.label}: no cracks between pieces`, false, `${holes} holes`);
  }
  say('every pipe, pool, bowl and corner scanned for cracks', ok, '0.25 m grid over each footprint');
  // 2. QUARTER PIPES: straight at it, no input -- up, over the coping, and back down into the flat
  for (const sz of ['S', 'M', 'L', 'XL']) {
    const pc = find('qp', sz), S = KSZ[sz], v = Math.sqrt(2 * g * (S.H + 1.2)) + 1;
    go(pc, -12, 0, 0, v); const r = ride(5);
    say(`QP ${sz}: up the face, air over the coping, back in`, r.top > S.H + 0.25 && loc(pc).u < S.lip && !r.falls && !r.bail && P.grounded, `${fix(v, 1)} m/s in -> ${fix(r.top - S.H)} m over the coping, ${fix(r.airMax)} s air, ends ${fix(loc(pc).u, 1)} m out`);
  }
  // 3. CORNERS: diagonally into the pocket, and at the outside of the wrap
  for (const sz of ['S', 'M', 'L', 'XL']) {
    const S = KSZ[sz], v = Math.sqrt(2 * g * (S.H + 0.6)) + 1;
    const ci = find('qpIn', sz); go(ci, -8, -8, Math.PI / 4, v); const a = ride(5);
    const co = find('qpOut', sz), d = 1.5 + S.lip + 8; go(co, -d * Math.SQRT1_2, -d * Math.SQRT1_2, Math.PI / 4, v); const b = ride(5);
    say(`QP ${sz} corners: in the pocket / round the wrap`, a.top > S.H * 0.9 && b.top > S.H * 0.9 && !a.falls && !b.falls && !a.bail && !b.bail,
      `inside up to ${fix(a.top)} (H ${S.H}), outside up to ${fix(b.top)}`);
  }
  // 4. PIPES: swing in each with no input
  for (const [kind, sz] of [['halfpipe', 'M'], ['halfpipe', 'L'], ['halfpipe', 'XL'], ['pool', 'M']]) {
    const pc = find(kind, sz), S = KSZ[sz]; go(pc, 0, 0, 0, Math.sqrt(2 * g * S.H) + 2);
    let peaks = 0, wasUp = false; const r = ride(10, () => { rg.stick.L.x = rg.stick.L.y = 0; const up = P.pos.y > S.H * 0.6; if (up && !wasUp) peaks++; wasUp = up; });
    const l = loc(pc);
    say(`${pc.label}: swings, stays in`, peaks >= 3 && !r.falls && Math.abs(l.u) < (pc.len / 2) && !r.bail, `${peaks} walls in 10 s, ends ${fix(l.u, 1)},${fix(l.w, 1)}`);
  }
  // the pool's end: along the pipe into the cap and back
  { const pc = find('pool', 'M'), S = KSZ.M; go(pc, 0, 0, Math.PI / 2, Math.sqrt(2 * g * S.H) + 1.5); const r = ride(5);
    say('pool M: into the end cap and back', r.top > S.H * 0.9 && Math.abs(loc(pc).w) < pc.wid / 2 && !r.falls, `up to ${fix(r.top)}, ends w ${fix(loc(pc).w, 1)}`); }
  // bowls: straight across, and carving round the wall
  for (const sz of ['M', 'L']) { const pc = find('bowl', sz), S = KSZ[sz]; go(pc, 0, 0, 0.3, Math.sqrt(2 * g * S.H) + 2); const r = ride(8);
    say(`round bowl ${sz}: across and back`, r.top > S.H * 0.8 && Math.hypot(loc(pc).u, loc(pc).w) < (pc.o.rc || 4) + S.lip && !r.falls, `up to ${fix(r.top)}, ends ${fix(Math.hypot(loc(pc).u, loc(pc).w), 1)} m from the middle`); }
  // 5. JUNCTIONS: along the flat through the bend of the L, and through the T into the branch
  { const pc = find('pipeL', 'M'), S = KSZ.M, rIn = 1.5 + S.lip, mid = rIn + 3;
    const route = []; for (let w = -8; w <= 0; w += 0.5) route.push([mid, w]); for (let a = 0; a <= Math.PI / 2; a += 0.1) route.push([mid * Math.cos(a), mid * Math.sin(a)]); for (let u = 0; u >= -8; u -= 0.5) route.push([u, mid]);
    const pts = route.map(([u, w]) => L(pc, u, w));
    go(pc, mid, -8, Math.PI / 2, 5); let hi = 0, done = false;
    const r = ride(12, () => { let bi = 0, bd = 1e9; pts.forEach((q, i) => { const d = Math.hypot(q.x - P.pos.x, q.z - P.pos.z); if (d < bd) { bd = d; bi = i; } });
      const t = pts[Math.min(pts.length - 1, bi + 4)]; if (bi >= pts.length - 3) done = true; fwd(Math.atan2(t.x - P.pos.x, t.z - P.pos.z)); hi = Math.max(hi, P.pos.y); });
    say('L-pipe M: along the flat round the bend', done && !r.falls, `${done ? 'through' : 'stuck at ' + fix(loc(pc).u, 1) + ',' + fix(loc(pc).w, 1)}, highest ${fix(hi)}`); }
  { const pc = find('pipeT', 'M'), S = KSZ.M, c = 3 + S.lip + 1.5;
    const pts = [...Array(13).keys()].map(i => L(pc, 0, -12 + i)).concat([...Array(12).keys()].map(i => L(pc, 1 + i * 1.2, 0.0)));
    go(pc, 0, -12, Math.PI / 2, 5); let done = false;
    const r = ride(12, () => { let bi = 0, bd = 1e9; pts.forEach((q, i) => { const d = Math.hypot(q.x - P.pos.x, q.z - P.pos.z); if (d < bd) { bd = d; bi = i; } });
      const t = pts[Math.min(pts.length - 1, bi + 3)]; if (bi >= pts.length - 2) done = true; fwd(Math.atan2(t.x - P.pos.x, t.z - P.pos.z)); });
    say('T-pipe M: along the main pipe and into the branch', done && !r.falls, done ? `in the branch at u ${fix(loc(pc).u, 1)}` : `stuck at ${fix(loc(pc).u, 1)},${fix(loc(pc).w, 1)}`); }
  // 6. BANKS: push up onto the platform
  for (const sz of ['S', 'M', 'L', 'XL']) { const pc = find('bankDeck', sz), S = KSZ[sz]; go(pc, -6, 0, 0, Math.sqrt(2 * g * (S.H * 1.25 + 0.6))); let on = 0;
    // in at about the speed the climb needs, coasting -- a hard push all the way carries her clean over a 4 m deck
    const r = ride(6, t => { rg.stick.L.x = rg.stick.L.y = 0; if (on) P.vel.multiplyScalar(0.9);
      const l = loc(pc); if (P.grounded && Math.abs(P.pos.y - S.H) < 0.1 && l.u > pc.len - 4 && l.u < pc.len) on = 1; });
    say(`bank ${sz}: rolls up onto its platform`, on && !r.falls, on ? `on the platform at y ${fix(P.pos.y)}` : `never got on (ends y ${fix(P.pos.y)} at u ${fix(loc(pc).u, 1)})`); }
  // 7. ROLL-INS: drop off the deck and come out fast
  for (const sz of ['L', 'XL']) { const pc = find('rollin', sz), S = KSZ[sz]; go(pc, pc.top + 1.2, 0, Math.PI, 1); P.pos.y = S.H; P.grounded = true;
    let vOut = 0, tr = []; const r = ride(5, (t) => { rg.stick.L.x = rg.stick.L.y = 0; if (P.pos.y < 0.1 && P.grounded) vOut = Math.max(vOut, P.speed);
      if (process.env.TRACE && Math.round(t * 60) % 12 === 0) tr.push(`u${fix(loc(pc).u)} y${fix(P.pos.y)} v${fix(P.hSpeed, 1)} sp${fix(P.speed || 0, 1)} ${P.grounded ? 'g' : 'a'}`); });
    if (process.env.TRACE) console.log(tr.join(' | '));
    say(`roll-in ${sz}: drop in, out fast`, vOut > 0.75 * Math.sqrt(2 * g * S.H) && !r.falls && !r.bail, `${fix(vOut, 1)} m/s at the bottom (free fall from ${S.H} m is ${fix(Math.sqrt(2 * g * S.H), 1)})`); }
  // 8. SPINES: a small one rolls over; a vert one sends her straight back
  { const pc = find('spine', 'S'); go(pc, -8, 0, 0, 9); const r = ride(3);
    say('spine S: rolls over the top', loc(pc).u > pc.len && !r.falls && !r.bail, `ends u ${fix(loc(pc).u, 1)} (spine ${fix(pc.len, 1)} m)`); }
  { const pc = find('spine', 'M'), S = KSZ.M; go(pc, -10, 0, 0, 12); const r = ride(4);
    say('spine M: vert -- straight up and back', r.top > S.H && loc(pc).u < S.lip && !r.falls, `up to ${fix(r.top)}, ends u ${fix(loc(pc).u, 1)}`); }
  // 9. JUMPS: air off every kicker and launch, scaling with the size; the table and the gap cleared
  for (const [kind, sz, v, need] of [['kicker', 'S', 11, 0.35], ['kicker', 'M', 12, 0.55], ['kicker', 'L', 14, 0.7], ['launch', 'S', 11, 0.4]]) {
    const pc = find(kind, sz); go(pc, -10, 0, 0, v); const r = ride(4);
    say(`${kind} ${sz} at ${v} m/s: air`, r.airMax > need && !r.falls && !r.bail && P.grounded, `${fix(r.airMax)} s of air, lands ${fix(loc(pc).u - pc.len, 1)} m past the lip`);
  }
  { const pc = find('table', 'M'); go(pc, -10, 0, 0, 13); const r = ride(4);
    say('table-top M at 13 m/s: over the table', r.airMax > 0.35 && loc(pc).u > pc.len && !r.bail, `${fix(r.airMax)} s air, ends u ${fix(loc(pc).u, 1)}`); }
  { const pc = find('gap', 'M'), hk = 1.44, u0 = pc.len - 3 - hk / Math.tan(18 * Math.PI / 180); let land = null; go(pc, -10, 0, 0, 15);
    // landed = grounded on the landing (on its deck, or anywhere down its slope) -- not in the gap at floor level
    // pushing all the way in, the way you would at a gap; let go at the kicker
    let vLip = 0; const r = ride(5, () => { const l = loc(pc); rg.stick.L.x = rg.stick.L.y = 0; if (l.u < 4.4) vLip = P.speed; if (!land && P.grounded && l.u > u0 - 0.5 && P.pos.y > 0.05) land = l; });
    say('gap M (5 m), rolling in: cleared', !!land && land.u > u0 - 0.2 && !r.bail, (land ? `landed at u ${fix(land.u, 1)} (landing starts ${fix(u0, 1)})` : 'never landed') + `, ${fix(vLip, 1)} m/s at the lip`); }
  // 10. BOXES: over the funbox and the pyramid, across the hip
  for (const [i, lbl, phi, v] of [[0, 'funbox S', 0, 9], [1, 'pyramid M', 0, 12], [2, 'hip M', Math.PI / 4, 12]]) {
    const pc = K.pieces.filter(p => p.kind === 'frustum')[i]; const t = loc(pc);
    const su = phi ? -6 : -8, sw = phi ? -6 : 0; go(pc, su, sw, phi, v); const r = ride(3.5);
    const l = loc(pc), dist = Math.hypot(l.u - (su + 2), l.w - sw);
    say(`${lbl}: up, over, down`, r.top > KSZ[pc.size].H * 0.9 && !r.falls && !r.bail && dist > 10, `up to ${fix(r.top)}, travelled ${fix(dist, 1)} m`);
  }
  // 11. LOOPS: on at the start, round, upside down at the top; the 180 ends on its deck
  { const pc = find('loop360'), S0 = pc.rail.segs[0]; place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 8); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 10, side: 'left' }); const r = ride(3);
    say('loop 360: round it, upside down at the top', r.minUp < -0.6 && !r.falls, `her up got to ${fix(r.minUp)}`); }
  { const pc = find('loop180'), S0 = pc.rail.segs[0]; place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 8); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 10, side: 'left' }); let deck = 0; const r = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; if (!P.grind && P.grounded && P.pos.y > 5) deck = 1; });
    say('loop 180: up, over, rolled upright, out onto its deck', r.minUp < -0.6 && deck && !r.falls, `her up got to ${fix(r.minUp)}, ${deck ? 'landed on the deck' : 'missed the deck'}`); }
  // 12. A PLATFORM IS A WALL from the side
  { const pc = find('bankDeck', 'L'); go(pc, pc.len - 2, -8, Math.PI / 2, 8); const r = ride(2);
    const l = loc(pc); say('a platform side is a wall', !(Math.abs(l.w) < 2 && l.u > pc.len - 4 && P.pos.y < 1), `ends at u ${fix(l.u, 1)} w ${fix(l.w, 1)} y ${fix(P.pos.y, 1)}`); }
  // ---- r67: THE RAIL KIT ----------------------------------------------------------------------------------------------
  // R1. EVERY RAIL, END TO END: on at its higher end (a stair rail climbed at grind speed stalls, which is skating), no
  //     stick, and she has to reach the far end of THAT path without coming off it -- a ring has to go round
  { const rp = K.pieces.slice(0, K.nGallery).filter(p => p.rails && p.rails.length); let bad = [], n = 0;
    for (const pc of rp) for (const R of pc.rails) {
      const a = R.segs[0], z = R.segs[R.segs.length - 1], up = z.b.y > a.a.y + 0.05;
      const S0 = up ? z : a, t0 = up ? 1 : 0, dir = up ? -1 : 1, goal = up ? a : z, q = up ? S0.b : S0.a;
      reset(); place(q.x, q.y, q.z, Math.atan2(S0.hx * dir, S0.hz * dir), 9); P.grounded = false;
      rg.enterGrind({ rail: S0, t: t0, dir, s: 9, side: 'left' });
      let reached = 0, off = 0, dist = 0, last = P.pos.clone();
      run(R.closed ? 4 : 6, () => { rg.stick.L.x = rg.stick.L.y = 0; city();
        dist += P.pos.distanceTo(last); last.copy(P.pos);
        if (P.grind && P.grind.rail.path === R) { if (!R.closed && P.grind.rail === goal && (up ? P.grind.t < 0.25 : P.grind.t > 0.75)) reached = 1; }
        else if (!reached) off = 1; });
      const ok1 = R.closed ? (!off && dist > 2 * Math.PI * 4 * 1.05) : reached; n++;
      if (!ok1) bad.push(`${pc.label}/${R.name}: ${R.closed ? 'went ' + fix(dist, 1) + ' m' : off ? 'came off' : 'never reached the end'}`);
    }
    say(`every kit rail grinds end to end (${n} paths)`, n > 20 && !bad.length, bad.join('; ') || 'all of them'); }
  // R2. A TAP FROM THE GROUND BESIDE ONE, the way a player gets on
  for (const [kind, size, lbl, o] of [['rail', 'S'], ['rail', 'M'], ['railDown', 'M'], ['ledge', 'S', 'ledge 0.6 m', { h: 0.6 }], ['ledge', 'S']]) {
    const pc = K.pieces.slice(0, K.nGallery).find(p => p.kind === kind && p.size === size && (o ? p.o.h === o.h : p.o.h == null)), paths = new Set(pc.rails);
    go(pc, 1, 2.6, 0, 6); P.jump = 1; let on = 0; run(2.5, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grind && paths.has(P.grind.rail.path)) on = 1; });
    say(`  a tap beside ${lbl || pc.label} grinds it`, on, on ? 'grinding' : `ended at y ${fix(P.pos.y)}`); }
  // R3. STAIRS: down from the landing, and up from the street
  for (const sz of ['S', 'M', 'L']) {
    const pc = K.pieces.find(p => p.kind === 'stairs' && p.size === sz), Hs = KSZ[sz].H, run0 = pc.len - 3;
    go(pc, run0 + 2, 0, Math.PI, 5); let low = 0; const r = ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); const l = loc(pc);
      if (l.u > 0 && l.u < run0) { const want = Hs * l.u / run0; low = Math.min(low, P.pos.y - want); } });
    const l = loc(pc); say(`  stairs ${sz}: rolled down the flight`, l.u < 0 && P.pos.y < 0.1 && !r.bail && low > -0.05, `at u ${fix(l.u, 1)} y ${fix(P.pos.y)}, worst ${fix(low)} under the noses`);
    go(pc, -6, 0, 0, Math.sqrt(2 * g * Hs) + 1.5); let land = 0; ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); const l = loc(pc);
      if (P.grounded && Math.abs(P.pos.y - Hs) < 0.05 && l.u > run0 && l.u < run0 + 3) land = 1; });
    say(`  stairs ${sz}: rolled up onto the landing`, land, land ? 'rolled onto it' : `never; ends y ${fix(P.pos.y)}`);
    const R = pc.rails[1], top = R.segs[R.segs.length - 1]; go(pc, run0 + 2, pc.rails[1].segs[0].a.distanceTo(pc.rails[0].segs[0].a) / 2 - 1.6, Math.PI, 6);
    P.jump = 1; let on = 0, bottom = 0; run(4, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grind && P.grind.rail.path === R) { on = 1; if (P.grind.rail === R.segs[0] || P.grind.rail === R.segs[1]) bottom = 1; } });
    say(`  stairs ${sz}: a tap on the landing, down the handrail`, on && bottom, on ? (bottom ? 'top to bottom' : 'came off on the way down') : 'never caught it'); }
  // R4. THE CHAIN: every piece snapped off the one before; one grind from the first to the last
  { const C = K.chain, gap = Math.max(...C.slice(1).map((pc, i) => { const e = C[i].rails[0], E = e.segs[e.segs.length - 1].b; return E.distanceTo(pc.rails[0].segs[0].a); }));
    const S0 = C[0].rails[0].segs[0], seen = [];
    reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 10); P.grounded = false; rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 10, side: 'left' });
    run(8, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grind) { const i = C.findIndex(pc => pc.rails[0] === P.grind.rail.path); if (i >= 0 && seen[seen.length - 1] !== i) seen.push(i); } });
    const all = seen.length === C.length && seen.every((v, i) => v === i);
    say('the rail chain: snapped end to end, one grind through all of it', gap < 0.01 && all, `ends ${fix(gap, 3)} m apart, rode pieces ${seen.join(' > ')} of 0..${C.length - 1}`); }
  // R5. THE Y: straight on with no stick, down the branch with it
  { const pc = find('railY'), [M, B] = pc.rails, S0 = M.segs[0], h0 = Math.atan2(S0.hx, S0.hz), hb = H(pc, 80 * Math.PI / 180);
    const go2 = st => { reset(); place(S0.a.x, S0.a.y, S0.a.z, h0, 9); P.grounded = false; rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 9, side: 'left' });
      let br = 0; run(1.5, () => { if (st) fwd(hb); else rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grind && P.grind.rail.path === B) br = 1; }); return br; };
    const a = go2(0), b = go2(1);
    say('the Y: straight on alone, the branch with the stick', !a && b, `no stick ${a ? 'BRANCHED' : 'straight'}, stick ${b ? 'branched' : 'stayed on the main'}`); }
  // R6. THE BOOSTER pulls her up to its speed; R7. A LEDGE is a block you stand on and a wall from the side
  { const pc = K.pieces.find(p => p.kind === 'rail' && p.o.boost), S0 = pc.rails[0].segs[0]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 5); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 5, side: 'left' }); let top = 0; run(1, () => { city(); if (P.grind) top = Math.max(top, P.grind.s); });
    say('a booster rail speeds her up', top > 10, `5 -> ${fix(top, 1)} m/s`); }
  { const pc = K.pieces.find(p => p.kind === 'ledge' && !p.o.h); go(pc, 3, 0, 0, 0); P.pos.y = 2; P.grounded = false; ride(1);
    const stood = Math.abs(P.pos.y - pc.h) < 0.03 && P.grounded; go(pc, 4, -5, Math.PI / 2, 7); ride(1.5, () => { fwd(H(pc, Math.PI / 2)); city(); });
    const l = loc(pc); say('a ledge: stood on top, a wall from the side', stood && !(Math.abs(l.w) < 0.6 && P.pos.y < pc.h - 0.2), `on top ${stood ? 'yes' : 'no'}; side run ends w ${fix(l.w, 2)} y ${fix(P.pos.y)}`); }
  // ---- r70: THE MEGA PARK ---------------------------------------------------------------------------------------------
  const KP = rg.KPARK, M = KSZ.M;
  // P1. NOTHING SITS INSIDE ANYTHING ELSE unless it was built to touch (same `group`)
  { const pkz = K.pieces.filter(p => p.park && !p.park.startsWith('sheet')), bad = [];      // r73: the sheet park has its own (S1)
    for (let i = 0; i < pkz.length; i++) for (let j = i + 1; j < pkz.length; j++) { const a = pkz[i], b = pkz[j];
      if (!a.bb || !b.bb || (a.group && a.group === b.group)) continue;
      const o = [0, 1, 2].map(k => Math.min(a.bb[k + 3], b.bb[k + 3]) - Math.max(a.bb[k], b.bb[k]));
      if (o.every(v => v > 0.3)) bad.push(`${a.label} x ${b.label}`); }
    say(`mega park: ${pkz.length} pieces, none placed inside another`, pkz.length > 80 && !bad.length, bad.slice(0, 4).join('; ') || 'clear'); }
  // steer down a centreline [x, z] polyline: aim a few metres ahead of the nearest point, push; returns how far along it got
  const follow = (pts, sec, o = {}) => { let far = 0, offMax = 0, lowest = 99; const r = ride(sec, () => {
      let bi = 0, bd = 1e9; for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - P.pos.x, pts[i][1] - P.pos.z); if (d < bd && i >= far - 20) { bd = d; bi = i; } }
      far = Math.max(far, bi); if (bd > offMax && bi < pts.length - 10) { offMax = bd; o.at = `x${fix(P.pos.x, 1)} z${fix(P.pos.z, 1)} y${fix(P.pos.y)} v${fix(P.hSpeed, 1)} ${P.grounded ? 'g' : 'a'} near pt ${bi}`; } lowest = Math.min(lowest, P.pos.y);
      const t = pts[Math.min(pts.length - 1, bi + (o.ahead || 6))]; fwd(Math.atan2(t[0] - P.pos.x, t[1] - P.pos.z)); if (o.coast && P.hSpeed > o.coast) rg.stick.L.y = 0; city(); });
    return { ...r, far, offMax, lowest }; };
  const line = recs => { const out = []; for (const r of recs) for (const q of r.cl || []) { const l = out[out.length - 1];
      if (!l) { out.push(q); continue; } const d = Math.hypot(l[0] - q[0], l[1] - q[1]); if (d < 0.5) continue;
      const n = Math.ceil(d); for (let i = 1; i <= n; i++) out.push([l[0] + (q[0] - l[0]) * i / n, l[1] + (q[1] - l[1]) * i / n]); } return out; };
    // ---- r74: THE PATH PIECES (gallery row 'path pieces'): each shape is a LINE, ridden here
    { const lab = t => K.pieces.find(p => p.label === t), cen = pc => ({ x: pc.T.x, z: pc.T.z });
      // a bowl drawn as a path: dropped in from its deck at four bearings, it swings and nothing falls through
      { const b = lab('bowl from a path L (4 lobes, 2.4 to 3.6 deep)'), bad = []; let deepest = 99;
        for (const h of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { reset(); const R = 10 * 1.07 + 1.4, x = b.T.x + Math.sin(h) * R, z = b.T.z + Math.cos(h) * R;
          place(x, 3.6 + 0.4, z, h + Math.PI, 3); const r = ride(8); deepest = Math.min(deepest, r.low);
          if (r.falls || r.bail || r.low < -0.05 || r.top < 2.2) bad.push(`at ${fix(h * 180 / Math.PI, 0)}: low ${fix(r.low)} top ${fix(r.top)}${r.falls ? ' FELL' : ''}`); }
        say('path bowl L: dropped in from four sides, swings', !bad.length && deepest < 0.15, bad.join('; ') || `deepest ${fix(deepest)}`); }
      // the kidney pool decked to a square: in from its deck it swings; at its outer wall from outside it is a wall
      { const k = lab('kidney pool M, decked to a square'); reset(); place(k.T.x + 9.5, 2.8, k.T.z - 1, -Math.PI / 2, 2); const r = ride(6);
        say('path kidney M: dropped in, swings', !r.falls && !r.bail && r.low < 0.1 && r.top > 1.6, `low ${fix(r.low)} top ${fix(r.top)}`);
        reset(); place(k.T.x + 20, 0.2, k.T.z, -Math.PI / 2, 8); ride(2, () => { fwd(-Math.PI / 2); city(); });      // (u is z, w is x: the square is x +-12)
        say('path kidney M: its outer wall stops her', P.pos.x > k.T.x + 11.5 && P.pos.y < 0.3, `ends x ${fix(P.pos.x - k.T.x, 1)} (wall at 12)`); }
      // the S-spine, crossed at right angles: up one face to near the ridge, no fall
      { const sp = lab('S-spine L'); reset(); const h = Math.atan2(1, -1); place(sp.T.x - 7 * Math.sin(h), 0.2, sp.T.z - 7 * Math.cos(h), h, Math.sqrt(2 * g * 3.6) + 1.5); const r = ride(3);
        say('path S-spine L: ridden at, up a face', !r.falls && !r.bail && r.top > 3.0, `top ${fix(r.top)}`); }
      // the horseshoe funbox: from inside the U, up the bank onto its flat top
      { const f = lab('horseshoe funbox S'); reset(); place(f.T.x, 0.2, f.T.z - 2, Math.PI, 8.5); let top = 0;      // the bank costs more than the ideal climb: 7.2 stalls at 0.94
        const rr = ride(2.5, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.pos.y > 1.15) top = 1; }); if (rr.falls || rr.low < -0.05) top = 0;
        say('path horseshoe funbox S: up its bank to the top', top, top ? 'reached the 1.2 m top' : `y ${fix(P.pos.y)}`); }
      // the curved QP: from the middle of its curve, up its face at three bearings
      { const q = lab('curved QP L'), bad = []; for (const a of [-40, 0, 40]) { reset(); const h = Math.atan2(Math.sin(a * (Math.PI / 180)), Math.cos(a * (Math.PI / 180))) ;
          const fx = Math.cos(a * (Math.PI / 180)), fz = Math.sin(a * (Math.PI / 180));      // piece-local u,w -> world via its yaw 0: u = +z, w = +x
          place(q.T.x + fz * 2, 0.2, q.T.z + fx * 2, Math.atan2(fz, fx), Math.sqrt(2 * g * 3.6) + 2.5); const r = ride(4);
          if (r.falls || r.bail || r.top < 3.6 * 0.85) bad.push(`${a}: top ${fix(r.top)}`); }
        say('path curved QP L: up its face at three bearings', !bad.length, bad.join('; ') || 'all three'); }
      // the curved ledge and the deck: walls from the side, floors on top
      { const l = lab('curved ledge 0.6'); reset(); place(l.T.x - 6, 0.2, l.T.z, Math.PI / 2, 6); ride(2, () => { fwd(Math.PI / 2); city(); });
        // the ledge runs on the diagonal through the middle, so she meets it and SLIDES ALONG it -- the test is that she
        // never gets to the far side (the line from x -6, z -4 to x 6, z 4 near the middle)
        const lx = P.pos.x - l.T.x, lz = P.pos.z - l.T.z, side = 12 * lz - 8 * lx;
        say('path curved ledge: a wall from the side', side > 0 && P.pos.y < 0.3, `ends x ${fix(lx, 2)} z ${fix(lz, 2)} -- ${side > 0 ? 'her own side' : 'THROUGH IT'}`);
        const d = lab('deck M, any outline'); reset(); place(d.T.x - 16, 0.2, d.T.z, Math.PI / 2, 8); ride(2, () => { fwd(Math.PI / 2); city(); });
        const dx = P.pos.x - d.T.x; reset(); place(d.T.x, 2.9, d.T.z - 4, 0, 0); let stood = 0; ride(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grounded && Math.abs(P.pos.y - 2.4) < 0.05) stood = 1; });
        say('path deck M: a wall from outside, a floor on top', dx < -7.5 && stood, `side run ends x ${fix(dx, 1)} (edge -8); on top ${stood ? 'yes' : 'no'}`); }
      // the walkway: pushed up it from the ground to the top
      { const w = lab('walkway climbing to L'), pts = w.o.pts.map(([u, ww]) => [w.T.x + ww, w.T.z + u]); reset(); place(pts[0][0], 0.2, pts[0][1], Math.atan2(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), 7);
        const so = {}; let top = 0; const r = follow(pts.flatMap((p, i) => i ? Array.from({ length: 8 }, (_, k) => [pts[i - 1][0] + (p[0] - pts[i - 1][0]) * (k + 1) / 8, pts[i - 1][1] + (p[1] - pts[i - 1][1]) * (k + 1) / 8]) : [p]), 7, { ...so, ahead: 3 });
        say('path walkway: pushed up it to the top', P.pos.y > 3.4 || r.top > 3.4, `top ${fix(r.top)}${r.falls ? ' FELL' : ''}`); }
      // ---- r75: THE DETAIL PIECES
      const D2R = Math.PI / 180;
      // terrain: no face steeper than its limit, and ridden across at four bearings it carries her over, never through
      for (const t of ['terrain 24 x 22 (noise)', 'terrain: two hills (bumps)']) { const k = lab(t); let worst = 0;
        for (let x = k.bb[0]; x < k.bb[3]; x += 0.37) for (let z = k.bb[2]; z < k.bb[5]; z += 0.37) { const e = 0.05, gx = (k.hAt(x + e, z) - k.hAt(x - e, z)) / (2 * e), gz = (k.hAt(x, z + e) - k.hAt(x, z - e)) / (2 * e);
          worst = Math.max(worst, Math.atan(Math.hypot(gx, gz)) / D2R); }
        const bad = []; let top = 0; const cx = (k.bb[0] + k.bb[3]) / 2, cz = (k.bb[2] + k.bb[5]) / 2;
        for (const h of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { reset(); place(cx - Math.sin(h) * 15, 0.2, cz - Math.cos(h) * 15, h, 7); let under = 0;
          const inB = () => P.pos.x > k.bb[0] && P.pos.x < k.bb[3] && P.pos.z > k.bb[2] && P.pos.z < k.bb[5];
          const r = ride(3, () => { const past = (P.pos.x - cx) * Math.sin(h) + (P.pos.z - cz) * Math.cos(h); if (past < 12) fwd(h); else rg.stick.L.x = rg.stick.L.y = 0; city();
            if (inB()) under = Math.min(under, P.pos.y - k.hAt(P.pos.x, P.pos.z)); });      // (past the far edge she coasts: the kit floor ends 30 m on)
          top = Math.max(top, r.top); const past = (P.pos.x - cx) * Math.sin(h) + (P.pos.z - cz) * Math.cos(h);
          if (r.falls || under < -0.06 || past < 10) bad.push(`${fix(h / D2R, 0)}: past ${fix(past, 1)}, ${fix(-under)} under`); }
        say(`${t}: ${k.tris} tris, steepest ${fix(worst, 1)} deg, ridden across four ways`, worst < k.slope + 1.5 && k.h > 1 && top > 0.8 && !bad.length, bad.join('; ') || `up to ${fix(top)}, peak ${fix(k.h)}`); }
      // the kerb terraces: rolled up tier by tier from a slow push
      for (const t of ['kerb terrace M (0.4 m tiers)', 'kerb terrace L']) { const k = lab(t); go(k, -3, 0, 0, 3); let top = 0;
        const r = ride(7, () => { fwd(H(k, 0)); city(); if (P.grounded) top = Math.max(top, P.pos.y); });
        say(`${t}: rolled up every tier`, top > k.h - 0.05 && !r.falls && !r.bail, `top ${fix(top)} of ${fix(k.h)}`); }
      // stairs + bank: up the bank onto the landing, and down the flight beside it
      { const k = lab('stairs M + bank'), M2 = KSZ.M; go(k, -6, (k.o.bw || 3) / 2 + 2.5, 0, Math.sqrt(2 * g * M2.H) + 2); let up = 0;
        ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grounded && Math.abs(P.pos.y - M2.H) < 0.08) up = 1; });
        go(k, k.len - 0.5, -(k.o.bw || 3) / 2, Math.PI, 5); P.pos.y = M2.H + 0.2; const r = ride(3);
        say('stairs M + bank: up the bank, down the stairs', up && P.pos.y < 0.1 && !r.bail, `bank ${up ? 'to the top' : 'NO'}, stairs end y ${fix(P.pos.y)}`); }
      // the planted island: a curb from the side, a floor on top
      { const k = lab('planted island'); reset(); place(k.T.x + 1, 0.2, k.T.z - 12, 0, 6); ride(2.5, () => { fwd(0); city(); });
        const blocked = P.pos.z < k.T.z + 2 && P.pos.y < 0.3, dz = P.pos.z - k.T.z; reset(); place(k.T.x, 1, k.T.z + 5, 0, 0); let stood = 0; ride(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grounded && Math.abs(P.pos.y - k.h) < 0.05) stood = 1; });
        say('planted island: its curb stops her, its top is a floor', blocked && stood, `side run ends dz ${fix(dz, 1)} (curb at ~1.9); on top ${stood ? 'yes' : 'no'}`); } }
  // P2. THE DROP-IN: off the spawn deck, down the roll-in, up the bank M onto the ring's deck and into the pipe
  { const S0 = { x: KP.spawn[0], y: KP.spawn[1], z: KP.spawn[2] }, wx = 220; reset(); place(S0.x, S0.y + 0.5, S0.z, Math.PI / 2, 0); let inPipe = 0, top = 0;      // r72: the spawn is the sheet park's now, so the r70 park's own
    const r = ride(8, () => { if (P.pos.x < wx - 9) fwd(Math.PI / 2); else rg.stick.L.x = rg.stick.L.y = 0; city(); top = Math.max(top, P.pos.x > 205 ? P.pos.y : 0);
      if (P.grounded && Math.abs(P.pos.x - wx) < 6 && P.pos.y < 2.2) inPipe = 1; });
    say('mega drop-in: roll-in XL, bank M, over the coping into the ring', inPipe && !r.falls && !r.bail, inPipe ? `in the pipe (got to ${fix(top)} m on the way over)` : `never reached the pipe -- ends x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}`); }
  // P3. ROUND THE RING: a full lap of straights, four elbows and two tees, steering down the middle of the flat
  { const L0 = line(KP.ring), pts = L0.concat(L0.slice(1, 40)), s0 = pts[2];
    reset(); place(s0[0], 0.2, s0[1], 0, 11); const ro = {}; const r = follow(pts, 40, ro);
    say('mega ring: a full lap, every elbow and both tees', r.far >= L0.length && !r.falls && !r.bail && r.offMax < M.lip + 3 && r.low > -0.05,
      `${r.far}/${L0.length} of the line, worst ${fix(r.offMax, 1)} m off its middle (${ro.at}), ${r.falls ? 'FELL' : 'no falls'}`); }
  // P4. THE SOUTH SNAKE: out of the tee and along the snake to its half-bowl end
  { const tee = KP.ring.find(r => r.kind === 'tee' && /south/.test(r.label)), c = rg.kT(tee.T, tee.out.u / 2, 0, 0);
    const pts = line([{ cl: [[c.x, c.z]] }].concat(KP.runs.south)); reset(); place(c.x, 0.2, c.z, Math.atan2(pts[3][0] - c.x, pts[3][1] - c.z), 8);
    const so = { coast: 10 }; const r = follow(pts, 14, so);
    say('mega south snake: tee > elbow > pipe > elbow > end', r.far >= pts.length - 4 && !r.falls && !r.bail && r.low > -0.05, `${r.far}/${pts.length} of the line, worst ${fix(r.offMax, 1)} m off its middle (${so.at})`); }
  // P5. THE PLATEAU: a drop into the sunken bowl; the raised level up and down; the rail running on down the handrail
  { const [X0, Z0, X1, Z1] = KP.plateau, b = KP.bowl; reset(); place(b.T.x, 3, b.bb[5] + 3, Math.PI, 7); let inB = 0;
    const r = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grounded && P.pos.y < 1 && P.pos.x > b.bb[0] && P.pos.x < b.bb[3] && P.pos.z > b.bb[2] && P.pos.z < b.bb[5]) inB = 1; });
    say('mega plateau: off the plateau into the sunken bowl', inB && !r.falls && !r.bail && r.low > -0.05, inB ? 'dropped in' : `never got down into it (y ${fix(P.pos.y)})`); }
  { const st = K.pieces.find(p => p.park === 'plateau' && p.kind === 'stairs'), bk = K.pieces.find(p => p.park === 'plateau' && p.kind === 'bank');
    reset(); place(bk.T.x - 6, 3, bk.T.z, Math.PI / 2, Math.sqrt(2 * g * 1.2) + 2.5); let deck = 0, down = 0;
    const r = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grounded && Math.abs(P.pos.y - 3.6) < 0.05) deck = 1; if (deck && P.grounded && Math.abs(P.pos.y - 2.4) < 0.05 && P.pos.x > st.T.x) down = 1; });
    say('mega plateau: bank S up to the raised deck, down the stairs', deck && down && !r.bail && !r.falls, `deck ${deck ? 'yes' : 'no'}, back on the plateau past the stairs ${down ? 'yes' : 'no'}`);
    const rl = K.pieces.find(p => p.park === 'plateau' && p.kind === 'rail' && p.group === 'raised'), R0 = rl.rails[0].segs[0], hrs = new Set(st.rails), feet = new Set(st.rails.map(R => R.segs[0]));
    reset(); place(R0.a.x, R0.a.y, R0.a.z, Math.atan2(-R0.hx, -R0.hz), 8); P.grounded = false; rg.enterGrind({ rail: R0, t: 0.05, dir: -1, s: 8, side: 'left' });
    let on = 0, foot = 0; run(3, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grind && hrs.has(P.grind.rail.path)) { on = 1; if (feet.has(P.grind.rail)) foot = 1; } });
    say('mega plateau: the deck rail runs on down the handrail', on && foot, on ? (foot ? 'to the foot' : 'came off') : 'never crossed onto it'); }
  // P6. EAST: off the ring's deck platform, down the stairs M to the street; P7. THE TIERS up to XL and the bank down
  { const es = K.pieces.find(p => p.park === 'east' && p.kind === 'stairs'), pl = K.pieces.find(p => p.park === 'east' && p.kind === 'platform');
    reset(); place(pl.T.x + 2, 3, 0, Math.PI / 2, 6); let st = 0; const r = ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grounded && P.pos.y < 0.05 && P.pos.x > es.T.x) st = 1; });
    say('mega east: off the deck, down the stairs M to the street', st && !r.bail && !r.falls, st ? 'on the street' : `ends x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}`); }
  { const tb = K.pieces.find(p => p.park === 'tiers'); reset(); place(tb.T.x - 12, 0.2, tb.T.z, Math.PI / 2, 6); let xl = 0, back = 0;
    let tr = []; const r = ride(9, (t) => { if (!xl && P.hSpeed < 8.5) fwd(Math.PI / 2); else { rg.stick.L.x = 0; rg.stick.L.y = 0; rg.cam.az = Math.PI / 2; } city(); if (P.grounded && Math.abs(P.pos.y - 4.8) < 0.08) xl = 1; if (xl && P.grounded && P.pos.y < 0.05) back = 1;
      if (process.env.TRACE && Math.round(t * 60) % 15 === 0) tr.push(`x${fix(P.pos.x, 1)} y${fix(P.pos.y)} v${fix(P.hSpeed, 1)} ${P.grounded ? 'g' : 'a'}`); });
    if (process.env.TRACE) console.log(tr.join(' | '));
    say('mega tiers: M > L > XL decks, then the bank XL down', xl && back && !r.bail && !r.falls, `XL deck ${xl ? 'yes' : 'no'}, down the far side ${back ? 'yes' : 'no'}`); }
  // P8. EVERY TRANSITIONED PLACE, hands off: in at speed, four ways round -- no falling out, under, or bailing
  { const bad = [], spots = [];
    for (const r of K.pieces.filter(p => p.park && p.cl && /^(pipe|elbow|tee|pipeEnd)$/.test(p.kind))) { const m = r.cl[Math.floor(r.cl.length / 2)]; spots.push([r.label, m[0], m[1]]); }
    spots.push(['bowl', KP.bowl.T.x, KP.bowl.T.z], ['pool', KP.pool.T.x, KP.pool.T.z], ['spine box', 250, 146], ['big pipe', 320, 130], ['XL corner', 388, 112], ['pool L', 430, 190]);
    let n = 0; for (const [nm, x, z] of spots) for (const h of [0, Math.PI / 2, Math.PI, -Math.PI / 4]) { n++;
      reset(); place(x, 0.2, z, h, 11); const r = ride(5); if (r.falls || r.bail || r.low < -0.05) bad.push(`${nm} h${fix(h, 1)}: ${r.falls ? 'fell out' : r.bail ? 'bailed' : 'under the floor ' + fix(r.low)}`); }
    say(`mega park: ${n} hands-off rides through every pipe, elbow, tee, end, bowl and pool`, !bad.length, bad.slice(0, 5).join('; ') || 'all swung clean'); }
  // P9 (r71). THE SWIPE DOWN GRINDS THE KIT'S COPINGS AND DECK EDGES -- nothing in the kit is a rail along a coping, the
  // ledge finder reads them off the collider. Up every pipe's wall both ways, and into the sunk bowl, the pool and the
  // XL pipe: swipe down on the way up and she must be grinding a ledge at that piece's deck height.
  { rg.GRIND.intent = 1; const bad = [], good = []; let n = 0;
    const upAndSwipe = (nm, x, z, h, deck, v) => { n++; reset(); place(x, 0.2, z, h, v || 9); P.grindCool = 0; P.grindLast = null; P.grindWant = 0;
      let sw = null, got = null;
      run(3, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (!sw && P.grounded && P.pos.y > deck * 0.35 && P.vel.y > 0) sw = rg.rightFlick(0, 60) || 'none';
        if (P.grind && !got) { const R = P.grind.rail, t = P.grind.t; got = { y: R.a.y + (R.b.y - R.a.y) * t, ledge: !!R.path.ledge }; } });
      if (got && got.ledge && Math.abs(got.y - deck) < 0.2) good.push(nm); else bad.push(`${nm}: ${sw || 'never swiped'}, ${got ? `grinding at ${fix(got.y)}` : 'no grind'}`); };
    for (const pc of K.pieces.filter(p => p.park && p.kind === 'pipe' && p.cl)) { const m = pc.cl[Math.floor(pc.cl.length / 2)], S = KSZ[pc.size];
      for (const sd of [1, -1]) upAndSwipe(`${pc.label || 'pipe'} ${sd > 0 ? '+w' : '-w'}`, m[0], m[1], pc.T.yaw + (sd > 0 ? Math.PI / 2 : -Math.PI / 2), S.H); }
    for (const [nm, pc] of [['bowl M', KP.bowl], ['pool M', KP.pool]]) for (const h of [0, Math.PI / 2, Math.PI]) upAndSwipe(`${nm} h${fix(h, 1)}`, pc.T.x, pc.T.z, h, KSZ.M.H, 8);
    say(`mega park: swipe down up ${n} walls grinds the coping`, !bad.length, bad.slice(0, 4).join('; ') || `${good.length} copings`);
    rg.ledgeClear(); rg.GRIND.intent = 0; }
  // ---- r72: THE SHEET PARK and THE PIECES IT NEEDED -----------------------------------------------------------------------
  { const SH = rg.SHEET, A = SH.at, sheetP = K.pieces.filter(p => p.park && p.park.startsWith('sheet'));
    // S0. every new piece in the gallery rides: the adapters, the free bowl, the square bowl, the bridge over and under, the berm
    { const pa = find('pipeAdapt'); go(pa, 1, 0, 0, 9); const r = ride(3, () => { fwd(pa.T.yaw); city(); });
      const l = loc(pa); say('pipe adapter M > L: along it, M walls to L walls', l.u > pa.len - 1 && !r.falls && !r.bail && r.low > -0.05, `ends u ${fix(l.u, 1)} of ${fix(pa.len, 1)}`); }
    { const qa = find('qpAdapt'); for (const w of [-3, 0, 3]) { const Ht = KSZ.M.H + (KSZ.XL.H - KSZ.M.H) * (w + 4) / 8; go(qa, -12, w, 0, Math.sqrt(2 * g * Ht) + 2); const r = ride(4);
      say(`QP adapter M > XL at w ${w}: up the face (${fix(Ht, 1)} m there)`, r.top > Ht * 0.9 && !r.falls && !r.bail && r.low > -0.05, `up to ${fix(r.top)}`); } }
    { const fb = find('freeBowl', 'XL'); for (const h of [0, Math.PI / 2, Math.PI]) { reset(); const Rr = fb.R * (1 + 0.2 * Math.cos(2 * h)) + 1.2, t = rg.kT(fb.T, Rr * Math.cos(h), Rr * Math.sin(h), 0);
        place(t.x, KSZ.XL.H + 0.5, t.z, 0, 0); P.heading = P.faceH = Math.atan2(fb.T.x - t.x, fb.T.z - t.z); P.vel.set(Math.sin(P.heading) * 3, 0, Math.cos(P.heading) * 3);
        const r = ride(8); say(`peanut bowl XL: dropped in at ${fix(h * 180 / Math.PI, 0)} deg, swings`, r.low < 1.2 && !r.falls && !r.bail && r.low > -0.05 && r.top > 3, `down to ${fix(r.low)}, up to ${fix(r.top)}`); } }
    { const sq = find('squareBowl'); go(sq, -2, 0.3, 0, Math.sqrt(2 * g * 2.4) + 1.5); const r = ride(10); say('square bowl M: swings, stays in', r.top > 2.2 && !r.falls && !r.bail && r.low > -0.05, `up to ${fix(r.top)}`); }
    { const br = find('bridge'); go(br, -8, 0, 0, 10); const r1 = ride(4); const l1 = loc(br);
      say('bridge M: ridden UNDER at ground level', l1.u > br.len + 2 && P.pos.y < 0.2 && !r1.bail, `ends u ${fix(l1.u, 1)} y ${fix(P.pos.y)}`);
      reset(); const t = rg.kT(br.T, 1, 0, 0); place(t.x, br.h + 0.3, t.z, br.T.yaw, 8); let on = 0; ride(1.5, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grounded && Math.abs(P.pos.y - br.h) < 0.05) on = 1; });
      say('bridge M: ridden OVER on its deck', on, on ? 'on the deck' : `y ${fix(P.pos.y)}`); }
    { const bm = find('berm'); go(bm, -6, 0, 0, 10); const r = ride(3, () => { fwd(P.heading); city(); }); const turned = Math.abs(rg.wrapAngle ? rg.wrapAngle(P.heading - bm.T.yaw) : 0);
      say('berm M 90: round it on the bank', !r.falls && !r.bail && r.top > 0.2 && r.low > -0.05, `up to ${fix(r.top)} on the bank`); }
    // ---- r73: THE PARK HIS SCHEMATIC DESCRIBES (`parks/mega_skatepark.json`, `kitSheet`). Every piece below is found by the
    // `id` the schematic gives it, so moving a piece in the file moves its test with it.
    const at = id => { const r = A[id]; if (!r) say(`schematic has "${id}"`, false, 'missing'); return r; };
    const onAt = (yy, tol) => P.grounded && Math.abs(P.pos.y - yy) < (tol || 0.08);
    // S0b. r79: THE PARK FLOOR'S HOLES ARE SIMPLE AND THE CUT FLOOR HAS THE RIGHT AREA. A sunk piece cuts its outline out of
    // the ground; r77 cut the coping offset by a flat deck width, which crossed itself at the clover bowl's two hips, and
    // the triangulator laid ground across the bowl -- the flap at the wall. Any garbage triangle shows up as extra area.
    { const X = (p, q, r, t) => { const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return d(p, q, r) * d(p, q, t) < 0 && d(r, t, p) * d(r, t, q) < 0; };
      const area = P2 => { let a = 0; for (let i = 0; i < P2.length; i++) { const p = P2[i], q = P2[(i + 1) % P2.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
      SH.holes.forEach((H, k) => { let c = 0; const n = H.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1) && X(H[i], H[(i + 1) % n], H[j], H[(j + 1) % n])) c++;
        say(`sunk piece ${k}: its hole in the park floor does not cross itself`, c === 0, `${c} crossings`); });
      if (SH.floor) { const V = SH.floor.concat(...SH.holes), tris = THREE.ShapeUtils.triangulateShape(SH.floor.map(([x, z]) => new THREE.Vector2(x, z)), SH.holes.map(H => H.map(([x, z]) => new THREE.Vector2(x, z))));
        const got = tris.reduce((s2, [a, b, c]) => s2 + area([V[a], V[b], V[c]]), 0), want = area(SH.floor) - SH.holes.reduce((s2, H) => s2 + area(H), 0);
        say('the park floor, cut by the sunk pieces, covers its outline less the holes and nothing else', Math.abs(got - want) < 2, `${fix(got, 0)} m2 of ${fix(want, 0)}`); } }
    // S1. NOTHING IN ONE AREA INSIDE A PIECE OF ANOTHER, and nothing outside the fence
    { const bad = [], out = [];
      for (let i = 0; i < sheetP.length; i++) { const a = sheetP[i]; if (!a.bb) continue;
        if (a.kind !== 'fence' && (a.bb[0] < SH.x0 - 0.5 || a.bb[3] > SH.x1 + 0.5 || a.bb[2] < SH.z0 - 0.5 || a.bb[5] > SH.z1 + 0.5)) out.push(a.label + ' (outside)');
        for (let j = i + 1; j < sheetP.length; j++) { const b = sheetP[j]; if (!b.bb || (a.group && a.group === b.group) || a.ground || b.ground) continue;      // r75: terrain is ground, trees stand on it
          const o = [0, 1, 2].map(k => Math.min(a.bb[k + 3], b.bb[k + 3]) - Math.max(a.bb[k], b.bb[k])); if (!o.every(v => v > 0.3)) continue;
          // r74: a CURVED piece's box is not its shape -- an S-spine's box takes in half the bowl beside it. A path piece is
          // tested by points across its real cross-section (its line, out to the toe on the ridden side and back over the
          // deck) against the other piece's box, both ways round
          // r75: a deck or an island of any outline is tested by its outline and a grid inside it, the same way
          const pts = r => { if (r.poly) { const O = r.poly, xs = O.map(p => p[0]), zs = O.map(p => p[1]), out = O.slice();
              const inP = (x, z) => { let c = 0; for (let i = 0, j = O.length - 1; i < O.length; j = i++) if ((O[i][1] > z) !== (O[j][1] > z) && x < (O[j][0] - O[i][0]) * (z - O[i][1]) / (O[j][1] - O[i][1]) + O[i][0]) c ^= 1; return c; };
              for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.5) if (inP(x, z)) out.push([x, z]); return out; }
            if (!r.line) return null; const S = KSZ[r.size] || KSZ.M, lip = S.lip, dk = r.o.deck != null ? r.o.deck : 1.5, out = [];
            r.line.forEach((q, k) => { const sd = r.side[k]; for (const d of r.o.face === 'both' ? [-lip, 0, lip] : [-dk, 0, lip]) out.push([q[0] + sd[0] * d, q[1] + sd[1] * d]); }); return out; };
          const inBox = (P2, r) => P2 && P2.some(([x, z]) => x > r.bb[0] + 0.3 && x < r.bb[3] - 0.3 && z > r.bb[2] + 0.3 && z < r.bb[5] - 0.3);
          const sh = r => r.line || r.poly;
          if ((sh(a) || sh(b)) && !(sh(a) && inBox(pts(a), b)) && !(sh(b) && inBox(pts(b), a))) continue;
          if (sh(a) && sh(b) && !(inBox(pts(a), b) && inBox(pts(b), a))) continue;
          bad.push(`${a.label} x ${b.label}`); } }
      say(`sheet park: ${sheetP.length} pieces from the schematic, none inside another, all inside the fence`, sheetP.length > 80 && !bad.length && !out.length, (bad.concat(out)).slice(0, 4).join('; ') || 'clear'); }
    // S2. THE MAIN ENTRY: off the landing down the grand stairs (south), and down the bank off its far side (north)
    { const st = at('entryStairs'), run = KSZ.L.H / Math.tan(32 * Math.PI / 180), bk = at('entryBank');
      reset(); let t = L(st, run + 1.5, 0); place(t.x, KSZ.L.H + 0.3, t.z, H(st, Math.PI), 4); let down = 0;
      let r = ride(4, () => { fwd(H(st, Math.PI)); city(); if (onAt(0, 0.05) && loc(st).u < -1) down = 1; });
      say('sheet entry: off the landing, down the grand stairs L', down && !r.bail && !r.falls, down ? 'at the foot' : `ends u ${fix(loc(st).u, 1)} y ${fix(P.pos.y)}`);
      reset(); t = L(st, run + 1.5, 0); place(t.x, KSZ.L.H + 0.3, t.z, H(st, 0), 4); down = 0;
      r = ride(4, () => { fwd(H(st, 0)); city(); if (onAt(0, 0.05) && loc(bk).u < -1) down = 1; });
      say('sheet entry: off the landing, down the bank L the other way', down && !r.bail && !r.falls, down ? 'on the street' : `ends y ${fix(P.pos.y)}`); }
    // S3. THE NORTH STREET (r76: his new render has no quarter pipe row there -- it is a bank up to a terrace along the north
    // fence, stairs beside a planter, hubba ledges and a stair box): up the bank onto the terrace, down the stairs off it
    { const bk = at('northBank'), st = at('northStairs'), Mh = KSZ.M.H; go(bk, -6, 0, 0, Math.sqrt(2 * g * Mh) + 2.5); let up = 0;
      ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (onAt(Mh)) up = 1; });
      const run0 = st.len - 0.3; go(st, run0 + 0.2, 0, Math.PI, 5); P.pos.y = Mh + 0.2; const r = ride(3);
      say('sheet north street: up the bank onto the terrace, down the stairs', up && loc(st).u < 0 && P.pos.y < 0.1 && !r.bail, `bank ${up ? 'to the top' : `NO (y ${fix(P.pos.y)})`}, stairs end u ${fix(loc(st).u, 1)} y ${fix(P.pos.y)}`); }
    // r74: the path pieces report their traced line (`line`, world x,z) and the ridden side (`side`), so these ride them
    // generically: DROP IN off a closed wall's deck at k points round it, and RIDE AT an open wall from its ridden side
    const W = SH.W, J = SH.data, hd = s => Math.atan2(s[0], s[1]);
    // (r77: a SUNK piece's floor is below the ground -- measured from its own floor, `rimY - h`)
    const dropIn = (r, k, sec) => { const bad = [], fl = r.sunk ? r.rimY - r.h : 0; let deepest = 99, top = -99;
      for (let j = 0; j < k; j++) { const i = Math.floor((j + 0.37) * r.line.length / k), q = r.line[i], sd = r.side[i]; reset();
        place(q[0] - sd[0] * 1.4, r.rimY + 0.4, q[1] - sd[1] * 1.4, hd(sd), 3); const t = ride(sec || 8); deepest = Math.min(deepest, t.low - fl); top = Math.max(top, t.top - fl);
        if (t.falls || t.bail || t.low < fl - 0.05 || t.top - fl < (r.rimY - fl) * 0.6) bad.push(`#${i}: low ${fix(t.low)} top ${fix(t.top)}${t.falls ? ' FELL' : ''}${t.bail ? ' BAIL' : ''}`); }
      return { bad, deepest, top }; };
    const rideAt = (r, D, v, need, frac) => { const i = Math.floor((frac != null ? frac : 0.5) * (r.line.length - 1)), q = r.line[i], sd = r.side[i]; reset();
      place(q[0] + sd[0] * D, 0.2, q[1] + sd[1] * D, hd([-sd[0], -sd[1]]), v); const t = ride(4); return { ok: !t.falls && !t.bail && t.low > -0.05 && t.top >= need, t }; };
    // S4. THE VERT: off its 7 m deck down the MEGA face, over the flat, up the bank L onto the bowl deck; and up the stairs MEGA
    { const v = at('vert'), mid = v.line[Math.floor(v.line.length / 2)], sd = v.side[Math.floor(v.line.length / 2)], S = KSZ.MEGA, bz = v.line[0][1] + 30;      // r77: 30 m out from the coping, past the vert's own flat
      reset(); place(mid[0] - sd[0] * 3.5, v.rimY + 0.3, mid[1] - sd[1] * 3.5, hd(sd), 3);      // (r78: its own deck height -- it is a 14.4 m mega ramp now)
      // (r77: the bowl is sunk now, so the run-out is the flat at grade and then the bowl itself)
      let bottom = 0, deck = 0; const r = ride(8, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.pos.y < 0.3) bottom = 1; if (bottom && P.pos.z > bz) deck = 1; });
      say(`sheet vert: drop in off the ${fix(v.rimY, 1)} m deck, down the face and out across the flat`, bottom && deck && !r.falls && !r.bail, `bottom ${bottom ? 'yes' : 'no'}, out past the vert's flat ${deck ? 'yes' : 'no'}`);
      const st = at('vertStairs'); reset(); const t2 = L(st, -4, 0); place(t2.x, 0.3, t2.z, st.T.yaw, 10); let up = 0;
      ride(7, () => { fwd(st.T.yaw); city(); if (onAt(S.H)) up = 1; });
      say('sheet advanced line: up the stairs MEGA onto the platform', up, up ? 'on the platform at 9.6' : `ends y ${fix(P.pos.y)}`);
      // r78: and on up the stairs XL from the platform onto the mega ramp's own deck
      const s2 = at('vertStairsTop'); reset(); const t3 = L(s2, -2, 0); place(t3.x, S.H + 0.3, t3.z, s2.T.yaw, Math.sqrt(2 * g * KSZ.XL.H) + 2); let top = 0;
      ride(4, () => { fwd(s2.T.yaw); city(); if (onAt(v.rimY)) top = 1; });
      say('sheet advanced line: on up the stairs XL onto the mega ramp deck', top, top ? `on the deck at ${fix(v.rimY, 1)}` : `ends y ${fix(P.pos.y)}`); }
    // S5. THE BOWL (his outline): dropped in from six points round it, it swings, reaches the deep end, nothing falls through;
    // and up each of its three banks onto the deck
    { const b = at('bowl'), d = dropIn(b, 6);
      say('sheet bowl: dropped in from six points round his outline, swings', !d.bad.length && d.deepest < 0.3, d.bad.join('; ') || `deep end ${fix(d.deepest)}, up to ${fix(d.top)}`);
      // and its berm, ridden over from the flat
      { const k = at('bowlBerm'), i = Math.floor(k.line.length / 2), q = k.line[i], sd = k.side[i]; reset(); place(q[0] + sd[0] * 9, 0.2, q[1] + sd[1] * 9, hd([-sd[0], -sd[1]]), 8.5);
        const t = ride(2.5); say('sheet bowl: its berm ridden over from the flat', t.top > 1.0 && !t.falls && !t.bail, `up to ${fix(t.top)}`); } }
    // S6. THE BRIDGE: up its stairs, along the raised walkway, down the ramp; and ridden under the walkway between its posts
    { const st = at('bridgeStairs'), wp = J.areas.find(a => a.id === 9).pieces.filter(q => q.kind === 'walk').flatMap(q => q.pts.map(pp => W(pp)));
      const pts = []; const s0 = L(st, -3, 0), path = [[s0.x, s0.z], ...wp]; for (let i = 1; i < path.length; i++) for (let k = 0; k < 10; k++) pts.push([path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k / 10, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k / 10]);
      pts.push(path[path.length - 1]); reset(); place(s0.x, 0.3, s0.z, st.T.yaw, 9); let on = 0, down = 0;
      const r = follow(pts, 9, { ahead: 4, coast: 8 }); for (let k = 0; k < 1; k++) {}
      // re-ride watching the heights
      reset(); place(s0.x, 0.3, s0.z, st.T.yaw, 9); let far = 0;
      ride(9, () => { let bi = 0, bd = 1e9; for (let i = Math.max(0, far - 10); i < pts.length; i++) { const dd = Math.hypot(pts[i][0] - P.pos.x, pts[i][1] - P.pos.z); if (dd < bd) { bd = dd; bi = i; } } far = Math.max(far, bi);
        const t = pts[Math.min(pts.length - 1, bi + 4)]; fwd(Math.atan2(t[0] - P.pos.x, t[1] - P.pos.z)); if (P.hSpeed > 8) rg.stick.L.y = 0; city();
        if (onAt(KSZ.L.H) && bi > 12 && bi < 30) on = 1; if (on && onAt(0, 0.05) && bi > pts.length - 6) down = 1; if (process.env.DBGB && bi > pts.length - 12) console.log("B", bi, fix(P.pos.x, 1), fix(P.pos.z, 1), fix(P.pos.y), P.grounded ? "g" : "a"); });
      say('sheet bridge: up the stairs, along the raised walkway, down the ramp', on && down, `walkway ${on ? 'yes' : 'no'}, down ${down ? 'yes' : 'no'} (got to ${far}/${pts.length}, ends y ${fix(P.pos.y)} ${P.grounded ? "grounded" : "air"})`);
      const A0 = wp[0], A1 = wp[2], mx = A0[0] + (A1[0] - A0[0]) * 0.375, mz = A0[1] + (A1[1] - A0[1]) * 0.375, dl = Math.hypot(A1[0] - A0[0], A1[1] - A0[1]), nx = -(A1[1] - A0[1]) / dl, nz = (A1[0] - A0[0]) / dl;
      reset(); place(mx - nx * 9, 0.3, mz - nz * 9, Math.atan2(nx, nz), 8); let under = 0;
      ride(2.5, () => { fwd(Math.atan2(nx, nz)); city(); if ((P.pos.x - mx) * nx + (P.pos.z - mz) * nz > 4 && P.pos.y < 0.2) under = 1; });
      say('sheet bridge: ridden under the walkway', under, under ? 'came out the far side' : `ends y ${fix(P.pos.y)}`); }
    // S7. THE SNAKE RUN (his pill) and THE POOL (his kidney): dropped in round them; THE C BANK, the S-SPINE, the U FUNBOX and
    // the curved QP ridden at from their ridden sides
    // S5c. r80: THE VERT AIR FOLLOWS THE LIP. *"In Tony Hawk if you launch off a vert ramp and the bowl curves around, your
    // character follows the edge of the lip, so you come back down the ramp even if you go round a curve."* Across the floor
    // at the wall on a SLANT, no input: she goes up it and off the coping in a locked air whose line is mostly along the
    // coping -- a tangent, which leaves a curved bowl. With the follow she comes back down inside; the same run with it off
    // is printed beside it, so the difference is on the page.
    { const keep = rg.VERT.follow;
      const lipRun = (r, fr, ang, fol) => { rg.VERT.follow = fol; const n = r.line.length, i = Math.floor(fr * n), q = r.line[i], sd = r.side[i], q2 = r.line[(i + 1) % n];
        const fl = r.sunk ? r.rimY - r.h : r.rimY - r.h, tl = Math.hypot(q2[0] - q[0], q2[1] - q[1]) || 1, tg = [(q2[0] - q[0]) / tl, (q2[1] - q[1]) / tl];
        const D = r.h * 1.05 + 2.5, dir = [-sd[0] * Math.cos(ang) + tg[0] * Math.sin(ang), -sd[1] * Math.cos(ang) + tg[1] * Math.sin(ang)];
        const v = Math.sqrt(2 * g * (r.h + 1.8)) / Math.cos(ang);
        reset(); place(q[0] + sd[0] * D, fl + 0.3, q[1] + sd[1] * D, hd(dir), v);
        let st = 0, lk = 0, lip = 0, land = null, along = 0, x0 = 0, z0 = 0;
        const t = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; city();
          if (st === 0 && !P.grounded && P.pos.y > r.rimY - 0.5) { st = 1; lk = P.vertLock; lip = P.vlip ? 1 : 0; x0 = P.pos.x; z0 = P.pos.z; }
          if (st === 1 && P.grounded) { st = 2; land = P.pos.y - r.rimY; along = Math.hypot(P.pos.x - x0, P.pos.z - z0); } });
        return { lk, lip, land, along, t };
      };
      for (const [id, fr, ang] of [['bowl', 0.12, 0.75], ['bowl', 0.62, 0.75], ['pool', 0.3, 0.75], ['pool', 0.55, 0.7], ['snake', 0.5, 0.7]]) { const r = at(id); if (!r) continue;
        const A = lipRun(r, fr, ang, 1), B = lipRun(r, fr, ang, 0), inA = A.land != null && A.land < -0.3, inB = B.land != null && B.land < -0.3;
        say(`${id} at ${fix(fr, 2)} round, ${fix(ang * 180 / Math.PI, 0)} deg off square: the vert air follows the coping and comes back IN`, A.lk && A.lip && inA && !A.t.bail && !A.t.falls,
          `top ${fix(A.t.top)} low ${fix(A.t.low)} ${A.t.bail?'BAIL ':''}${A.t.falls?'FELL ':''}${A.lk ? 'locked' : 'NOT locked'}, lip ${A.lip ? 'found' : 'NOT found'}, lands ${A.land == null ? 'never' : fix(A.land) + ' m from the rim'} ${fix(A.along, 1)} m round -- without the follow ${B.land == null ? 'never lands' : inB ? 'also in (' + fix(B.land) + ')' : 'OUT on the deck (' + fix(B.land) + ')'}`); }
      rg.VERT.follow = keep; }
    for (const [id, name] of [['snake', 'snake run, his pill'], ['pool', 'pool, his kidney']]) { const d = dropIn(at(id), 5);
      say(`sheet ${name}: dropped in from five points, swings`, !d.bad.length && d.deepest < 0.3, d.bad.join('; ') || `floor ${fix(d.deepest)}, up to ${fix(d.top)}`); }
    { const bad = []; for (const [id, D, v, need] of [['flowC', 5, Math.sqrt(2 * g * 2.4) + 2, 2.0], ['spine', 8, Math.sqrt(2 * g * 3.6) + 1.5, 3.0], ['funbox', 6, 8.5, 1.15], ['curvedQP', 6, Math.sqrt(2 * g * 2.4) + 2, 2.0]]) {
        const r = rideAt(at(id), D, v, need); if (!r.ok) bad.push(`${id}: top ${fix(r.t.top)}${r.t.falls ? ' FELL' : ''}${r.t.bail ? ' BAIL' : ''}`); }
      say('sheet: C bank, S-spine, U funbox, curved QP ridden at', !bad.length, bad.join('; ') || 'all four'); }
    // S8. THE HUBBAS: a swipe down on the landing beside the grand stairs grinds one down them
    { const st = at('entryStairs'), rl = KSZ.L.H / Math.tan(32 * Math.PI / 180); rg.GRIND.intent = 1; rg.ledgeClear();
      reset(); const t = L(st, rl + 1.5, 4); place(t.x, KSZ.L.H + 0.3, t.z, H(st, Math.PI), 6); P.grindCool = 0; P.grindLast = null;
      const w = rg.rightFlick(0, 60); let hub = 0, low = 99; run(2.5, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grind && (/hubba/.test(P.grind.rail.path.name) || P.grind.rail.path.ledge)) { hub = 1; low = Math.min(low, P.pos.y); } });
      say('sheet entry: a swipe down beside the stairs grinds a hubba down them', hub && low < 1.2, `${w}, ${hub ? 'on the hubba, down to ' + fix(low) : 'NO HUBBA'}`);
      rg.ledgeClear(); rg.GRIND.intent = 0; }
    // S9. THE MINI RAMP and THE POOL: dropped in off one deck, they swing to the other wall
    for (const id of ['mini']) { const q = at(id), S = KSZ[q.size], F = q.o.flat || 6; reset(); const t = L(q, F / 2 + S.lip + 0.8, 0); place(t.x, S.H + 0.3, t.z, H(q, Math.PI), 2);
      let far = 0; const r = ride(6, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (loc(q).u < -F / 2) far = Math.max(far, P.pos.y); });
      say(`sheet ${id === 'mini' ? 'mini ramp: half pipe M' : 'gap and drop: pool L'}, dropped in, swings to the far wall`, far > S.H * 0.6 && !r.falls && !r.bail && r.low > -0.05, `far wall up to ${fix(far)} of ${S.H}`); }
    // r75: THE UPPER PLAZA -- up its stairs-and-bank onto the deck and across onto the pool deck; up the kerb terrace tier by
    // tier; down the west stairs; and the planted island and the south hills
    { const k = at('plazaStairsS'), Lz = { H: at('upperPlaza').h }, bw = k.o.bw || 3; go(k, -6, (k.o.w || 5) / 2, 0, Math.sqrt(2 * g * Lz.H) + 2.5); let plaza = 0, pool = 0;
      // r84: `y > 3` was the 3.6 m plaza's; r78 brought it down to M and this never steered again -- she rode straight off the
      // south edge, fell THROUGH the stair-bank's slope to the ground (r84's face catch now lands her on it) and passed by luck
      ride(4, () => { if (P.grounded && P.pos.y > Lz.H - 0.5) fwd(H(k, -Math.PI / 2 + 0.25)); else rg.stick.L.x = rg.stick.L.y = 0; city(); if (onAt(Lz.H)) plaza = 1;
        if (plaza && P.pos.y < 0.3) pool = 1; });      // (r77: the pool is sunk, so off the plaza's east edge is a drop to the ground)
      say('sheet upper plaza: up the bank beside the stairs, across and off its east edge', plaza && pool, `plaza ${plaza ? 'yes' : 'no'}, dropped off ${pool ? 'yes' : `no, ends x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}`}`); }
    { const k = at('plazaTerrace'), n = k.o.n, rise = k.o.rise; go(k, -3, 0, 0, 3); let tier = 0;
      const r = ride(6, () => { fwd(H(k, 0)); city(); if (P.grounded) tier = Math.max(tier, Math.round(P.pos.y / rise)); });
      say('sheet upper plaza: rolled up the kerb terrace, every tier, to the deck', tier >= n && !r.falls && !r.bail, `reached tier ${tier} of ${n} (y ${fix(P.pos.y)})`); }
    { const k = at('plazaStairsW'), run0 = k.len - 0.3; go(k, run0 + 0.2, 0, Math.PI, 5); P.pos.y = at('upperPlaza').h + 0.2; const r = ride(3);
      say('sheet upper plaza: down the west stairs', loc(k).u < 0 && P.pos.y < 0.1 && !r.bail && !r.falls, `at u ${fix(loc(k).u, 1)} y ${fix(P.pos.y)}`); }
    { const k = at('hubIsland'), c = k.poly.reduce((a, p) => [a[0] + p[0] / k.poly.length, a[1] + p[1] / k.poly.length], [0, 0]); reset();
      place(c[0], 1, c[1], 0, 0); let stood = 0; ride(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (onAt(k.h, 0.05)) stood = 1; });
      reset(); place(c[0] - 14, 0.2, c[1], Math.PI / 2, 6); ride(3, () => { fwd(Math.PI / 2); city(); });
      const inside = (() => { const O = k.poly, x = P.pos.x, z = P.pos.z; let n = 0; for (let i = 0, j = O.length - 1; i < O.length; j = i++) if ((O[i][1] > z) !== (O[j][1] > z) && x < (O[j][0] - O[i][0]) * (z - O[i][1]) / (O[j][1] - O[i][1]) + O[i][0]) n ^= 1; return n; })();
      say('sheet central hub: the planted island, stood on, and its curb a wall', stood && !(inside && P.pos.y < 0.3), `on top ${stood ? 'yes' : 'no'}; ridden at ends ${inside ? (P.pos.y < 0.3 ? 'INSIDE IT' : 'on it') : 'outside'}`); }
    { const k = at('southHills'), bad = []; let up = 0; for (const [x, z, h] of [[k.bb[0] + 1, (k.bb[2] + k.bb[5]) / 2, Math.PI / 2], [k.bb[3] - 1, (k.bb[2] + k.bb[5]) / 2 + 2, -Math.PI / 2]]) {
        reset(); place(x, 0.2, z, h, 8); const x0 = P.pos.x; let under = 0;
        ride(6, () => { fwd(h); city(); under = Math.min(under, P.pos.y - k.hAt(P.pos.x, P.pos.z)); up = Math.max(up, P.pos.y); });
        if (under < -0.06 || Math.abs(P.pos.x - x0) < 30) bad.push(`from ${h > 0 ? 'west' : 'east'}: ${fix(Math.abs(P.pos.x - x0), 1)} m, ${fix(-under)} under`); }
      say('sheet landscaping: ridden over the hills both ways, never under them', !bad.length && up > 0.5, bad.join('; ') || `up to ${fix(up)}`); }
    // S10. THE ROOFTOP: up the bank XL onto the roof, and down the stairs XL off it
    // (r76: his new render draws the stairs off the roof BETWEEN two banks -- a `stairBank` with `side` 0 -- so the banks are
    // what she rides up)
    { const k = at('roofStairs'), XL = KSZ.XL, bad = [];
      for (const sg of [-1, 1]) { go(k, -6, sg * (k.o.w + k.o.bw) / 2, 0, Math.sqrt(2 * g * XL.H) + 3); let roof = 0; ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (onAt(XL.H)) roof = 1; }); if (!roof) bad.push(`${sg > 0 ? '+w' : '-w'} bank top ${fix(P.pos.y)}`); }
      say('sheet rooftop: up either bank beside the stairs onto the roof', !bad.length, bad.join('; ') || 'both');
      const st = k, run = st.len - (st.o.land || 2); reset(); const t = L(st, run + 1.5, 0); place(t.x, XL.H + 0.3, t.z, H(st, Math.PI), 4); let down = 0;
      const r = ride(4, () => { fwd(H(st, Math.PI)); city(); if (onAt(0, 0.05) && loc(st).u < 0) down = 1; });
      say('sheet rooftop: down the stairs XL', down && !r.bail && !r.falls, down ? 'at the foot' : `ends y ${fix(P.pos.y)}`); }
    // S11. THE SPINE, THE FUNBOX, THE PYRAMID, THE HUB QP: each ridden straight at, no bail, nothing fallen through
    { const bad = []; for (const [id, v, need, from] of [['pyramid', 12, 2.0, -12], ['hubQP', 8, 1.0, -10],
        ['beginBox', 8, 1.0, -6], ['flowBox', 9, 1.0, -10], ['flowHip', 9, 1.0, -10]]) {      // the beginner box starts past its kicker
        const q = at(id); if (!q) continue; go(q, from, 0, 0, v); const r = ride(4);
        if (r.bail || r.falls || r.low < -0.05 || r.top < need) bad.push(`${id}: up to ${fix(r.top)}${r.bail ? ' BAIL' : ''}${r.falls ? ' FELL' : ''}`); }
      say('sheet: pyramid, hub QP, beginner box, flow boxes ridden', !bad.length, bad.join('; ') || 'all of them'); }
    // S12. THE FENCE holds her in, and every ➤ stop in the sheet park stands her on a floor
    { const zm = (SH.z0 + SH.z1) / 2; reset(); place(SH.x0 + 12, 0.2, zm, -Math.PI / 2, 16); const r = ride(3, () => { fwd(-Math.PI / 2); city(); });
      say('sheet fence: ridden into at 16 m/s, holds', P.pos.x > SH.x0 && !r.falls, `ends x ${fix(P.pos.x, 1)} (fence ${fix(SH.x0, 1)})`); }
    { const bad = []; for (const n of K.go.filter(n => /^sheet /.test(n))) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
        run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; });
        if (gr < 30 || Math.abs(P.pos.y - y0) > 0.1) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
      say('sheet park: every ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${K.go.filter(n => /^sheet /.test(n)).length} stops`); }
  }
  // P5. EVERY ➤ STOP IN THE PARK puts her on a floor, standing, and she stays there
  { const bad = []; for (const n of K.go.filter(n => /^park /.test(n))) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; });
      if (gr < 30 || Math.abs(P.pos.y - y0) > 0.1) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('kit park: every ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${K.go.filter(n => /^park /.test(n)).length} stops`); }
  // 13. AN `fn_` MARKER IN A GLB IS REBUILT AS ITS PIECE: a scene the way GLTFLoader hands one over, through the shipped
  //     levelIngest -- one by its name alone, turned 90 degrees, and one by its extras with an option
  { const root = new THREE.Group(), n0 = K.pieces.length;
    const a = new THREE.Object3D(); a.name = 'fn_qp_M_7'; a.position.set(0, 0, -412); a.rotation.y = Math.PI / 2; root.add(a);      // r72: z 385 is under the giants row now, and its floor was sampled as theirs
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); b.name = 'fn_marker_whatever'; b.userData = { fn: 'qpIn', size: 'L', rc: 3 }; b.position.set(60, 0, -412); root.add(b);
    root.updateMatrixWorld(true);
    const st = rg.levelIngest(null, root, new THREE.Matrix4(), 'fntest'), S = KSZ.M, Sl = KSZ.L;
    // the qp turned +90: its +u runs along world +x, so its deck is at x = lip + 0.8
    // (groundAt hands back ONE shared object, so each answer is copied before the next question)
    const gf = (x, z) => ({ ...rg.groundAt(x, z, 10, 0) }), d1 = gf(S.lip + 0.8, -412), d0 = gf(-0.8, -412), d2 = gf(60 + 3 + Sl.lip + 0.8, -412 + 0.3);
    say('fn_ markers rebuild their pieces where they stand', st.fn === 2 && K.pieces.length === n0 + 2 && Math.abs(d1.floor - S.H) < 0.02 && d0.floor < 0.01 && Math.abs(d2.floor - Sl.H) < 0.05,
      `${st.fn} built; qp deck at ${fix(d1.floor)} (H ${S.H}), behind its toe ${fix(d0.floor)}; corner deck ${fix(d2.floor)} (H ${Sl.H})`);
    const pc = K.pieces[n0]; go(pc, -12, 0, 0, Math.sqrt(2 * g * (S.H + 1.2)) + 1); const r = ride(5);
    say('  and the rebuilt one rides like the gallery one', r.top > S.H + 0.25 && !r.falls && !r.bail, `${fix(r.top - S.H)} m over its coping`); }
  // 13b. r83: AN OPTION GIVEN AS JSON TEXT (the easy way to write a path or a list as a Blender custom property) is parsed
  { const root = new THREE.Group(), n0 = K.pieces.length;
    const c = new THREE.Object3D(); c.name = 'fn_frustum_S_json'; c.userData = { banks: '[1, 0, 1, 0]', len: 7 }; c.position.set(120, 0, -412); root.add(c);
    root.updateMatrixWorld(true); rg.levelIngest(null, root, new THREE.Matrix4(), 'fnjson');
    const pc = K.pieces[n0], bk = pc && pc.o.banks;
    say('fn_ option as JSON text arrives as the list it spells', Array.isArray(bk) && bk.join() === '1,0,1,0' && pc.o.len === 7, pc ? JSON.stringify(pc.o) : 'not built'); }
  // 14. THE EXPORT ROUND TRIP: `npm run export kit` written, parsed back through the vendored GLTFLoader, and handed to the
  //     shipped levelIngest TURNED 180 AND MOVED -- every piece has to come back the same kind, size and options, and
  //     every raised floor of the gallery has to be at the same height at the matching point of the copy. This is the
  //     file he takes into Blender; if it does not rebuild the kit here it will not rebuild it on top of his level.
  { const { spawnSync } = await import('child_process');
    const ex = spawnSync(process.execPath, ['tools/export.mjs', 'kit'], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const file = 'exports/rollergirl_kit.glb';
    if (ex.status !== 0 || !fs.existsSync(file)) say('export kit runs', false, (ex.stderr || '').split('\n').slice(-4).join(' | '));
    else {
      const gal = K.pieces.slice(0, K.nGallery), n0 = K.pieces.length, gl = await realGLB(file);
      // r70: SAMPLE THE ORIGINALS FIRST, then clear the collider and ingest the copy alone -- the world spans 600 m now
      // and a turned copy cannot land anywhere it does not overlap something else
      const gf = (x, z) => { const q = rg.groundAt(x, z, 30, 0); return q.hit ? q.floor : -1; }, samp = [];
      // r72: OVER EACH PIECE'S OWN DRAWN BOX (+1 m), not a square of its length round its origin -- a 190 m fence's square
      // took in the floors of the marker test's pieces, which belong to nothing in the gallery
      for (const pc of gal) { if (!pc.bb) continue;
        // offset off the round numbers every edge in the kit sits on: a sample EXACTLY on a triangle's edge is a rounding
        // tie, inside on one side of a 180-degree turn and outside on the other
        for (let x = pc.bb[0] - 1 + 0.0137; x <= pc.bb[3] + 1; x += 0.6) for (let z = pc.bb[2] - 1 + 0.0291; z <= pc.bb[5] + 1; z += 0.6) { const a = gf(x, z); if (a >= 0.05) samp.push([-x, -z + 30, a, pc.label, x, z]); } }
      rg.colliderReset();
      gl.scene.updateMatrixWorld(true);
      const place = new THREE.Matrix4().makeTranslation(0, 0, 30).multiply(new THREE.Matrix4().makeRotationY(Math.PI));     // r72: +30, not -70 -- the giants row at z 412 turned to -482, off the collider's grid
      const st = rg.levelIngest(gl.scene, gl.scene, place, 'kitglb'), got = K.pieces.slice(n0);
      const sig = p => p.kind + ' ' + p.size + ' ' + JSON.stringify(Object.fromEntries(Object.entries(p.o || {}).filter(([k]) => k !== 'yaw').sort()));
      const A = gal.map(sig).sort().join('|'), B = got.map(sig).sort().join('|');
      if (A !== B) { const a = gal.map(sig).sort(), b = got.map(sig).sort(); a.forEach((x, i) => { if (x !== b[i]) console.log('    gallery ' + x + '\n    copy    ' + b[i]); }); }
      say('the exported kit rebuilds: same pieces, same options', st.fn === gal.length && got.length === gal.length && A === B, `${st.fn} fn_ nodes, ${got.length} pieces` + (A === B ? '' : ' -- DIFFER'));
      let n = 0, bad = 0, worst = 0;
      const offs = {}; for (const [x, z, a, lb, ox, oz] of samp) { const b = gf(x, z); n++; const d = Math.abs(a - b); worst = Math.max(worst, d); if (d > 0.02) { bad++; offs[lb] = offs[lb] || `${lb} at ${fix(ox, 1)},${fix(oz, 1)}: ${fix(a)} vs ${fix(b)}`; } }
      if (bad) console.log('      ' + Object.values(offs).join('\n      '));
      if (bad && process.env.DBG) { const at = (x, z, L) => L.filter(p => p.bb && x >= p.bb[0] && x <= p.bb[3] && z >= p.bb[2] && z <= p.bb[5]).map(p => p.label + ' ' + JSON.stringify(p.o) + ' bb ' + p.bb.map(v => fix(v, 1)).join(','));
        const f = samp.find(q => Math.abs(q[2] - gf(q[0], q[1])) > 0.02); console.log('      originals:', at(f[4], f[5], gal)); console.log('      copies:', at(f[0], f[1], got)); }
      say('  every raised floor at the same height on the copy', n > 1000 && bad === 0, `${n} points, ${bad} off, worst ${fix(worst, 3)} m`);
      // r67: AND EVERY RAIL: same number of paths per piece, both ends where the gallery's are once turned and moved
      let rn = 0, rbad = 0, rworst = 0;
      gal.forEach((pc, i) => { const A = pc.rails || [], B = (got[i] && got[i].rails) || []; if (A.length !== B.length) { rbad++; return; }
        A.forEach((R, j) => { const Q = B[j], e = [[R.segs[0].a, Q.segs[0].a], [R.segs[R.segs.length - 1].b, Q.segs[Q.segs.length - 1].b]];
          for (const [a, b] of e) { const d = Math.hypot(-a.x - b.x, a.y - b.y, -a.z + 30 - b.z); rn++; rworst = Math.max(rworst, d); if (d > 0.01) rbad++; } }); });
      say('  every rail comes back with both ends in place', rn > 60 && !rbad, `${rn} rail ends, ${rbad} off, worst ${fix(rworst, 3)} m`);
      const lp = got.filter(p => /^loop/.test(p.kind));
      say('  its loops come back as booster rails that turn over', lp.length === gal.filter(p => /^loop/.test(p.kind)).length && lp.every(p => p.rail && p.rail.boost && p.rail.ups && p.rail.segs.length > 20), `${lp.length} loops`);
    }
  }
  return ok;
};
// r88: THE REFERENCE PARK RE-IMPORTED. *"Export the current skate park as a guide"* -- for a Blender session rebuilding parks
// from images, so the file has to BE the park: `npm run export:park` written, parsed back through the vendored loader,
// and handed to the shipped `levelIngest` TURNED 180 into an EMPTY collider. Every floor height, every solid and every
// rail end inside the park has to come back where it was; if it does not rebuild here it will not rebuild on his level.
CASES.parkref = async () => {
  let ok = true; const say = (label, good, msg) => { console.log(`  ${label.padEnd(52)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const { spawnSync } = await import('child_process');
  const ex = spawnSync(process.execPath, ['tools/export.mjs', 'park'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const S = rg.SHEET, file = 'handoff/park_reference/' + S.url.match(/([^/]+)\.json$/)[1] + '.glb';
  if (ex.status !== 0 || !fs.existsSync(file)) { say('export:park runs', false, (ex.stderr || '').split('\n').slice(-4).join(' | ')); return false; }
  console.log('  ' + (ex.stdout.split('\n').filter(l => /^park:|ramp to/.test(l)).join('\n  ')));
  const K = rg.KITW, orig = K.pieces.filter(pc => pc.park && /^sheet /.test(pc.park)), n0 = K.pieces.length, gl = await realGLB(file);
  const cx = (S.x0 + S.x1) / 2, cz = (S.z0 + S.z1) / 2, TURN = process.env.NOTURN ? 1 : -1, map = (x, z) => [TURN * (x - cx), TURN * (z - cz)];      // the copy: re-centred, turned 180
  // inside the floor he drew (outside it is the kit world's own floor, which the copy rightly does not carry)
  const inPoly = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const gf = (x, z) => { const q = rg.groundAt(x, z, 40, 0); return q.hit ? q.floor : null; };
  const solid = (x, y, z) => !!rg.solidAt(x, y, z, 0);
  const samp = [];
  for (let x = S.x0 + 0.0137; x <= S.x1; x += 0.7) for (let z = S.z0 + 0.0291; z <= S.z1; z += 0.7) if (inPoly(x, z, S.floor))
    samp.push([x, z, gf(x, z), solid(x, 0.6, z), solid(x, 3, z), solid(x, 9, z)]);
  const triAt = (x, z) => { const T = rg.TRI, out = [], i = Math.floor((x - T.x0) / T.cell), k = Math.floor((z - T.z0) / T.cell), c = T.cells[k * T.w + i] || [];
    for (const t of c) { const o = t * 12, V = T.v, ax = V[o], az = V[o + 2], bx = V[o + 3], bz = V[o + 5], cx2 = V[o + 6], cz2 = V[o + 8], d = (bz - cz2) * (ax - cx2) + (cx2 - bx) * (az - cz2);
      const l1 = ((bz - cz2) * (x - cx2) + (cx2 - bx) * (z - cz2)) / d, l2 = ((cz2 - az) * (x - cx2) + (ax - cx2) * (z - cz2)) / d;
      if (l1 >= -1e-6 && l2 >= -1e-6 && l1 + l2 <= 1 + 1e-6) out.push([...V.slice(o, o + 9)].map(v => fix(v, 2)).join(',')); } return out; };
  const probe = process.env.DBG ? samp.slice() : null, triOrig = {};
  if (probe) for (const q of probe) triOrig[q[0] + ',' + q[1]] = triAt(q[0], q[1]);
  const spawn0 = S.spawn.slice(), rails0 = orig.flatMap(pc => pc.rails || (pc.rail ? [pc.rail] : []));
  rg.colliderReset();
  gl.scene.updateMatrixWorld(true);
  const st = rg.levelIngest(gl.scene, gl.scene, new THREE.Matrix4().makeRotationY(process.env.NOTURN ? 0 : Math.PI), 'parkref'), got = K.pieces.slice(n0);
  const sig = p => p.kind + ' ' + p.size + ' ' + JSON.stringify(Object.fromEntries(Object.entries(p.o || {}).filter(([k]) => k !== 'yaw').sort()));
  const A = orig.map(sig).sort(), B = got.map(sig).sort();
  if (A.join('|') !== B.join('|')) A.forEach((x, i) => { if (x !== B[i]) console.log('    original ' + x + '\n    copy     ' + B[i]); });
  say('every piece comes back: same kind, size and options', st.fn === orig.length && A.join('|') === B.join('|') && !(st.bad && st.bad.length), `${st.fn} fn_ nodes for ${orig.length} pieces${st.bad ? ', REFUSED ' + st.bad.join('; ') : ''}`);
  let n = 0, fb = 0, sb = 0, worst = 0, sunk = 0; const offs = [];
  for (const [x, z, a, s1, s2, s3] of samp) { const [X, Z] = map(x, z), b = gf(X, Z); n++; if (a != null && a < -0.3) sunk++;
    // A SAMPLE ON AN EDGE IS A ROUNDING TIE (r70's lesson): the move puts a hair of float error into every coordinate, and on
    // the line between two surfaces that decides which one it reads. So a miss is re-read 2 cm either way on the copy, and
    // counts only if no nudge agrees -- a real hole is wider than that. A BLENDED floor (`hAt` over a bowl's toes, in the sunk
    // bowl and the pool on the deck) is triangulated afresh at the new coordinates and may differ by a few cm, so the
    // tolerance is 5 cm -- a tenth of a kerb, against a missing piece that reads metres.
    const tol = 0.05;
    const near1 = (A, B) => A == null || B == null ? (A === B ? 0 : 99) : Math.abs(A - B);
    let d = near1(a, b); if (d > tol) for (const [ex, ez] of [[0.02, 0], [-0.02, 0], [0, 0.02], [0, -0.02]]) d = Math.min(d, near1(a, gf(X + ex, Z + ez)));
    worst = Math.max(worst, d);
    if (d > tol) { fb++; if (offs.length < (process.env.DBG ? 200 : 4)) offs.push(`${fix(x, 1)},${fix(z, 1)}: ${a == null ? '-' : fix(a)} vs ${b == null ? '-' : fix(b)}`); }
    const sAt = (x2, z2) => [solid(x2, 0.6, z2), solid(x2, 3, z2), solid(x2, 9, z2)].join();
    if (sAt(X, Z) !== [s1, s2, s3].join() && ![[0.02, 0], [-0.02, 0], [0, 0.02], [0, -0.02]].some(([ex, ez]) => sAt(X + ex, Z + ez) === [s1, s2, s3].join())) sb++; }
  if (offs.length) console.log('      ' + offs.join('\n      '));
  if (fb && process.env.DBG) { const at = (x, z, L) => L.filter(p => p.bb && x >= p.bb[0] - 0.5 && x <= p.bb[3] + 0.5 && z >= p.bb[2] - 0.5 && z <= p.bb[5] + 0.5).map(p => p.label + ' T ' + [p.T.x, p.T.y, p.T.z, p.T.yaw].map(v => fix(v, 2)).join(',') + ' ' + JSON.stringify(p.o).slice(0, 300));
    const f = samp.find(q => { const [X, Z] = map(q[0], q[1]), b = gf(X, Z); return q[2] == null ? b != null : b == null || Math.abs(q[2] - b) > 0.02; });
    const [X, Z] = map(f[0], f[1]);
    console.log('      collider tris at the point, ORIGINAL:\n        ' + (triOrig[f[0] + ',' + f[1]] || []).join('\n        '));
    console.log('      collider tris at the point, COPY:\n        ' + triAt(X, Z).join('\n        '));
    console.log('      originals:\n        ' + at(f[0], f[1], K.pieces.slice(0, n0)).join('\n        ')); console.log('      copies:\n        ' + at(X, Z, got).join('\n        ')); }
  say('  every floor in the park at the same height', n > 20000 && fb === 0, `${n} points (${sunk} down in a sunk bowl), ${fb} off, worst ${fix(worst, 3)} m`);
  say('  every solid where it was (0.6, 3 and 9 m up)', sb === 0, `${sb} of ${n} columns differ`);
  const rails1 = got.flatMap(pc => pc.rails || (pc.rail ? [pc.rail] : []));
  let rn = 0, rbad = 0;
  for (const R of rails0) for (const e of [R.segs[0].a, R.segs[R.segs.length - 1].b]) { rn++; const [X, Z] = map(e.x, e.z);
    if (!rails1.some(Q => [Q.segs[0].a, Q.segs[Q.segs.length - 1].b].some(f => Math.hypot(f.x - X, f.y - e.y, f.z - Z) < 0.01))) rbad++; }
  say('  every rail end where it was', rn > 10 && rails1.length === rails0.length && !rbad, `${rails1.length} rails, ${rn} ends, ${rbad} off`);
  const sp = rg.CITY.spots['parkref park'], [X, Z] = map(spawn0[0], spawn0[2]);
  say('  the spawn marker lands on its spot', !!sp && Math.hypot(sp[0] - X, sp[2] - Z) < 0.01 && Math.abs(sp[1] - spawn0[1]) < 0.01, sp ? `at ${fix(sp[0], 1)},${fix(sp[1], 1)},${fix(sp[2], 1)}` : 'NONE');
  return ok;
};
// ---------------------------------------------------------------- r90: THE PARK DISTRICT
// *"Build out more of the level like this AND integrate the skatepark layout."* The schematic park is built a second time, in
// the main world north of the hub, turned to face the gate. This holds it to the kit world's park -- the reference that rides --
// through a child process booted in that world (`parkdump`), then rides the joins only this world has: out of the gate into the
// entry, down into the sunk bowl through the apron it is cut out of, and across the seam where the park's floor meets the apron.
CASES.parkd = async () => {
  let ok = true; const say = (label, good, msg) => { console.log(`  ${label.padEnd(52)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const S = rg.SHEET, D = rg.PARKD;
  if (!D.on || !S.toW || !D.pieces || !D.pieces.length) { say('the park district is built', false, `on ${D.on}, ${D.pieces ? D.pieces.length : 0} pieces`); return false; }
  const { spawnSync } = await import('child_process'), tmp = path.join(TMP, 'parkdump.json');
  const r = spawnSync(process.execPath, [process.argv[1], 'parkdump', tmp], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0 || !fs.existsSync(tmp)) { say('the kit world dumps its park', false, (r.stderr || '').split('\n').slice(-4).join(' | ')); return false; }
  const K = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  const A = K.pieces.slice().sort(), B = D.pieces.map(parkSig).sort();
  say('every piece the kit world builds, built here', A.length === B.length && A.join('|') === B.join('|'), `${B.length} here, ${A.length} there` + (A.join('|') === B.join('|') ? '' : ` -- first difference: ${A.find((x, i) => x !== B[i])}`));
  // r102: the moving floors (the scout saucers circle over the park at 28 m) are not the park's -- sampled with them out of the way
  const dynKeep = rg.DYN.list.slice(); rg.DYN.list.length = 0;
  const gf = (x, z, y) => { const q = rg.groundAt(x, z, y, 0); return q.hit ? q.floor : null; }, so = (x, y, z) => rg.solidAt(x, y, z, 0) ? 1 : 0;
  const near1 = (a, b) => a == null || b == null ? (a === b ? 0 : 99) : Math.abs(a - b), NUDGE = [[0.02, 0], [-0.02, 0], [0, 0.02], [0, -0.02]];
  let n = 0, fb = 0, lb = 0, sb = 0, worst = 0, sunk = 0; const offs = [];
  for (const [x, z, a, a2, s1, s2, s3] of K.pts) { const [X, Z] = S.toW(x, z); n++; if (a != null && a < -0.3) sunk++;
    // the same tolerance and the same rounding-tie nudge as `parkref`: the turn puts a hair of float error into every coordinate
    let d = near1(a, gf(X, Z, 40)); if (d > 0.05) for (const [ex, ez] of NUDGE) d = Math.min(d, near1(a, gf(X + ex, Z + ez, 40)));
    let d2 = near1(a2, gf(X, Z, 0.5)); if (d2 > 0.05) for (const [ex, ez] of NUDGE) d2 = Math.min(d2, near1(a2, gf(X + ex, Z + ez, 0.5)));
    worst = Math.max(worst, d, d2);
    if (d > 0.05) { fb++; if (offs.length < 4) offs.push(`${fix(X, 1)},${fix(Z, 1)}: ${a == null ? '-' : fix(a)} there, ${fix(gf(X, Z, 40) ?? NaN)} here`); }
    if (d2 > 0.05) { lb++; if (offs.length < 4) offs.push(`${fix(X, 1)},${fix(Z, 1)} (under 0.5): ${a2 == null ? '-' : fix(a2)} there, ${fix(gf(X, Z, 0.5) ?? NaN)} here`); }
    const want = [s1, s2, s3].join(), sAt = (x2, z2) => [so(x2, 0.6, z2), so(x2, 3, z2), so(x2, 9, z2)].join();
    if (sAt(X, Z) !== want && !NUDGE.some(([ex, ez]) => sAt(X + ex, Z + ez) === want)) sb++; }
  if (offs.length) console.log('      ' + offs.join('\n      '));
  say('  every floor at the same height (top and under 0.5 m)', n > 20000 && sunk > 300 && !fb && !lb, `${n} points (${sunk} down in a sunk bowl), ${fb} + ${lb} off, worst ${fix(worst, 3)} m`);
  say('  every solid where it is there', sb === 0, `${sb} of ${n} columns differ`);
  const R1 = D.pieces.flatMap(pc => pc.rails || (pc.rail ? [pc.rail] : [])).map(R => [R.segs[0].a, R.segs[R.segs.length - 1].b]);
  let rbad = 0; for (const ends of K.rails) for (const [x, y, z] of ends) { const [X, Z] = S.toW(x, z);
    if (!R1.some(E => E.some(e => Math.hypot(e.x - X, e.y - y, e.z - Z) < 0.01))) rbad++; }
  say('  every rail end where it is there', K.rails.length > 10 && R1.length === K.rails.length && !rbad, `${R1.length} rails, ${rbad} ends off`);
  // nothing from another district in its box
  // (the dressing stands round it, outside the fence -- inside the floor he drew is the park's alone)
  const foreign = {}, inOut = (x, z) => { let c = false; const Q = S.floor; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const [xi, zi] = Q[i], [xj, zj] = Q[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  for (const b of rg.SOLID.all) if (!/^kit /.test(b.tag) && [[0, 0], [b.hx, b.hz], [-b.hx, b.hz], [b.hx, -b.hz], [-b.hx, -b.hz]].some(([u, v]) => inOut(b.cx + u * b.c + v * b.s, b.cz - u * b.s + v * b.c)))
    foreign[b.tag || '(untagged)'] = (foreign[b.tag || '(untagged)'] || 0) + 1;
  say('  nothing else stands in the district', !Object.keys(foreign).length, Object.keys(foreign).length ? JSON.stringify(foreign) : `inside the floor he drew, x ${fix(S.x0, 0)}..${fix(S.x1, 0)} z ${fix(S.z0, 0)}..${fix(S.z1, 0)}`);
  // THE SEAM: the apron just outside the park's floor is there, and the floor just inside is the park's (never a hole, never a step)
  { const P = S.floor; let m = 0, out0 = 0, in0 = 0, step = 0;
    for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx2, bz] = P[(i + 1) % P.length], L = Math.hypot(bx2 - ax, bz - az), nx = (bz - az) / L, nz = -(bx2 - ax) / L;
      for (let t = 0.5; t < L - 0.5; t += 1.3) { const x = ax + (bx2 - ax) * t / L, z = az + (bz - az) * t / L; m++;
        const o1 = gf(x + nx * 0.3, z + nz * 0.3, 0.3), o2 = gf(x - nx * 0.3, z - nz * 0.3, 0.3);
        const outside = Math.abs(o1 ?? 9) < 0.01 ? o1 : o2, inside = outside === o1 ? o2 : o1;    // which side is which, without trusting the winding
        if (outside == null || Math.abs(outside) > 0.01) out0++;
        if (inside == null || inside < -0.01) in0++;
        else if (Math.abs(inside) < 0.06 && Math.abs(inside - outside) > 0.02) step++; } }
    say('  the seam: apron outside, floor inside, no step', m > 100 && !out0 && !in0 && !step, `${m} points along the outline, ${out0} with no apron, ${in0} with a hole, ${step} stepped`); }
  // and the apron round it is still the ground (except where r112's Northway and its interchange come down onto it)
  const underNW = (x, z) => rg.NW && rg.NW.built && [rg.NW.main, rg.NW.hx].some(D => D.P.some(p => Math.hypot(p.x - x, p.z - z) < 5));
  { let miss = 0, k = 0; for (let x = -300.3; x < 300; x += 7.1) for (let z = 98.7; z < 320; z += 7.1) { if (x > S.x0 - 3 && x < S.x1 + 3 && z > S.z0 - 3 && z < S.z1 + 3) continue;
      const rr = Math.hypot(Math.max(0, Math.abs(x) - rg.PARK.S), Math.max(0, z - rg.PARK.S)); if (rr < rg.PARK.apronU + 0.5 || rr > rg.PARK.apronEnd - 0.5) continue;
      k++; const f = gf(x, z, 0.5); if (f == null || Math.abs(f) > 0.01) { if (!rg.SOLID.all.some(b => Math.abs(b.cx - x) < b.hx + b.hz + 1 && Math.abs(b.cz - z) < b.hx + b.hz + 1) && !underNW(x, z)) miss++; } }
    say('  the north apron round it is still floor', k > 500 && !miss, `${k} points, ${miss} without a floor at 0`); }
  rg.DYN.list.push(...dynKeep);
  // THE DRESSING (`parkDress`): the gateway, the shop row behind the north fence -- and the street between them still rides
  { const tag = t => rg.SOLID.all.filter(b => b.tag === t);
    const gate = tag('park gate').length, row = tag('slice bld').filter(b => b.cz > 250).length;
    place(10, 0, 253.6, -Math.PI / 2, 9); let endX = null, stopped = 0;
    run(9, (t, i) => { rg.cam.az = -Math.PI / 2; rg.stick.L.x = 0; rg.stick.L.y = -1; if (i > 0 && P.speed < 1) stopped++; });
    rg.stick.L.y = 0; endX = P.pos.x;
    say('the dressing: a gateway, a shop row, its street clear', gate === 3 && row >= 10 && endX < -100 && !stopped,
        `${gate} gateway boxes, ${row} buildings in the north row, ${rg.SLC.meshes.length} slice meshes; rode the north street from x 10 to ${fix(endX, 1)}${stopped ? `, stopped ${stopped} frames` : ''}`); }
  // RIDE: out of the north gate's corridor, straight on into the entry
  { place(0, 0, 76, 0, 9); let low = 9, inZ = null, fellBelow = 0;
    run(5, () => { rg.cam.az = 0; rg.stick.L.x = 0; rg.stick.L.y = -1; low = Math.min(low, P.pos.y);
      const g = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 0.3, 0); if (g.hit && P.pos.y < g.floor - 0.1) fellBelow++;
      if (inZ == null && P.pos.z > S.spawn[2] + 6) inZ = P.pos.clone(); });
    rg.stick.L.y = 0;
    say('ride: out of the north gate into the entry', !!inZ && low > -0.2 && !fellBelow, inZ ? `in at ${fix(inZ.x, 1)},${fix(inZ.y)},${fix(inZ.z, 1)}, lowest ${fix(low)}` : `got to ${fix(P.pos.x, 1)},${fix(P.pos.y)},${fix(P.pos.z, 1)}`); }
  // RIDE: into each sunk bowl from the park floor, over its rim -- the apron must not be a lid
  for (const H of S.holes) { let cx = 0, cz = 0; for (const [x, z] of H) { cx += x; cz += z; } cx /= H.length; cz /= H.length;
    const lid = gf(cx, cz, 0.5); let best = null;
    // start 2 m outside the hole on the side with open floor between, heading for the middle
    for (let i = 0; i < H.length && !best; i += Math.max(1, Math.floor(H.length / 24))) { const [hx, hz] = H[i], dx = hx - cx, dz = hz - cz, L = Math.hypot(dx, dz), sx = hx + dx / L * 2.2, sz = hz + dz / L * 2.2;
      const f = gf(sx, sz, 0.4); if (f != null && Math.abs(f) < 0.01 && !rg.solidAt(sx, 0.6, sz, 0.4)) best = [sx, sz, Math.atan2(cx - sx, cz - sz)]; }
    if (!best) { say('ride: into a sunk bowl', false, 'no open floor beside it'); continue; }
    place(best[0], 0, best[1], best[2], 7); let low = 9, below = 0;
    run(2.5, () => { rg.cam.az = best[2]; rg.stick.L.x = rg.stick.L.y = 0; low = Math.min(low, P.pos.y);
      const g = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 0.3, 0); if (P.grounded && g.hit && P.pos.y < g.floor - 0.1) below++; });
    say(`ride: into the sunk bowl at ${fix(cx, 0)},${fix(cz, 0)}`, lid != null && lid < -1 && low < -1 && low > -6 && !below, `floor in the middle ${lid == null ? '-' : fix(lid)}, she got down to ${fix(low)}${below ? `, ${below} frames under it` : ''}`); }
  return ok;
};
CASES.shores = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(48)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const S = rg.SH, O = rg.ORB, Y = S.y, T = S.transit, path = n => rg.PATHS.find(q => q.name === n), city = () => rg.stepCity(DT);
  const fwd = h => { rg.cam.az = h; rg.stick.L.x = 0; rg.stick.L.y = -1; };
  const along = (pts, ahead) => { let bi = 0, bd = 1e9; pts.forEach((q, i) => { const d = Math.hypot(q.x - P.pos.x, q.z - P.pos.z) + Math.abs(q.y - P.pos.y) * 0.5; if (d < bd) { bd = d; bi = i; } });
    const t = pts[Math.min(pts.length - 1, bi + (ahead || 3))]; fwd(Math.atan2(t.x - P.pos.x, t.z - P.pos.z)); return bi; };
  const ride = (pts, sec, ahead) => { let low = 99, last = 0; run(sec, () => { last = along(pts, ahead); city(); low = Math.min(low, P.pos.y); }); return { low, last }; };
  console.log(`  plateau ${S.nx}x${S.nz} cells, ${O.launch.length} launchers, ${O.water.length} water rects`);
  // 1. OUT OF THE EAST GATE AND UP THE CAUSEWAY
  { const sp0 = O.splashes; place(40, 0, 0, Math.PI / 2, 12); let at = null; run(8, () => { fwd(Math.PI / 2); city(); if (!at && P.pos.x > S.x0 + 4 && P.grounded) at = P.pos.clone(); });
    say('east gate, the causeway, onto the plateau', !!at && Math.abs(at.y - Y) < 0.15 && O.splashes === sp0, at ? `on at x ${fix(at.x, 1)} y ${fix(at.y)}` : `got to x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}, splashes ${O.splashes - sp0}`); }
  // 2. OFF THE WEST CLIFF INTO THE LAGOON, and back
  { const sp0 = O.splashes; place(152, Y, 12, -Math.PI / 2, 0); run(0.5, () => city()); P.vel.set(-9, 0, 0); P.heading = P.faceH = -Math.PI / 2;
    let wet = false; run(3, () => { city(); if (O.splashes > sp0) wet = true; });
    say('off the cliff into the lagoon: put back', wet && Math.abs(P.pos.y - Y) < 0.2 && P.pos.x > S.x0 + 1, `splashes ${O.splashes - sp0}, back at x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}`); }
  // 3. INTO A CANAL, and back; and OVER IT on the bridge
  { const sp0 = O.splashes; place(165, Y, -40, Math.PI / 2, 0); run(0.5, () => city()); P.vel.set(8, 0, 0);
    let wet = false; run(3, () => { city(); if (O.splashes > sp0) wet = true; });
    say('into a canal: put back', wet && Math.abs(P.pos.y - Y) < 0.2, `splashes ${O.splashes - sp0}, back at y ${fix(P.pos.y)}`);
    const sp1 = O.splashes; place(164, Y, -30, Math.PI / 2, 9); let at = null; run(2.5, () => { fwd(Math.PI / 2); city(); if (!at && P.pos.x > 182 && P.grounded) at = P.pos.clone(); });
    say('over the canal on a bridge', !!at && Math.abs(at.y - Y) < 0.15 && O.splashes === sp1, at ? `across at x ${fix(at.x, 1)}` : `got to x ${fix(P.pos.x, 1)}, splashes ${O.splashes - sp1}`); }
  // 4. THE PLAZA: carve the berm; tap onto the ring rail from the plinth
  { const Pz = S.plaza; place(Pz.x + 23, Y, Pz.z - 8, 0, 12); let top = 0; const cx = Pz.x, cz = Pz.z;
    run(3, () => { const a = Math.atan2(P.pos.z - cz, P.pos.x - cx); fwd(Math.atan2(-Math.sin(a) - Math.cos(a) * 0.15, Math.cos(a) - Math.sin(a) * 0.15)); city(); top = Math.max(top, P.pos.y); });
    say('carving round the plaza berm', top > Y + 1.0 && P.pos.y > Y - 0.1, `up to ${fix(top - Y)} m on the bank`);
    const rr = path('nova ring'); place(Pz.x, Y + Pz.pedH, Pz.z - 5.6, Math.PI / 2, 0); P.jump = 1; let on = false;
    run(2, () => { city(); if (P.grind && P.grind.rail.path === rr) on = true; });
    say('a tap on the plinth onto the ring rail', on, on ? 'grinding round the globe' : 'missed'); }
  // 5. THE ALLEY LAUNCHER onto the roof run, along the roofs, onto the spiral, up to the deck
  { place(179, Y, 6, 0, 3); let air = false, land = null; run(4, () => { fwd(0); city(); if (!P.grounded) air = true; else if (air && !land) land = P.pos.clone(); });
    say('the alley launcher onto the roof run', !!land && Math.abs(land.y - S.roofY) < 0.2, land ? `landed at z ${fix(land.z, 1)} y ${fix(land.y, 1)}` : 'never landed');
    const route = []; for (let z = 22; z < 126; z += 2) route.push(new THREE.Vector3(179, S.roofY, z));
    route.push(...S.link.map(q => q.clone())); const L = S.link[S.link.length - 1]; route.push(new THREE.Vector3(T.x + (L.x - T.x) * 0.75, T.deck, T.z + (L.z - T.z) * 0.75));
    place(179, S.roofY, 26, 0, 8); let kk = 0; const r = { low: 99 }; run(40, () => { along(route, 3); city(); r.low = Math.min(r.low, P.pos.y); if (process.env.DBG && kk++ % 20 === 0) console.log('   R', fix(kk / 60, 1), fix(P.pos.x, 1), fix(P.pos.y, 2), fix(P.pos.z, 1), 'v', fix(P.speed), P.grounded, P.grind ? 'GRIND' : ''); });
    const onDeck = Math.abs(P.pos.y - T.deck) < 0.3;
    say('roof run -> the link -> the transit deck', onDeck && r.low > S.roofY - 1, `ended y ${fix(P.pos.y, 1)}, lowest ${fix(r.low, 1)}`); }
  // 6. THE SPIRAL from the street
  { const s = rg.CITY.spots.transit; place(s[0], s[1], s[2], s[3], 6); const r = ride(S.spiral.pts, 40, 3);
    say('up the transit spiral from the street', Math.abs(P.pos.y - T.deck) < 0.3 && r.low > Y - 0.3, `ended y ${fix(P.pos.y, 1)} at ${fix(Math.hypot(P.pos.x - T.x, P.pos.z - T.z), 1)} m from the tower`); }
  // 7. THE TRACK TO THE SPIRE
  { S.peakGot = 0; const s = rg.CITY.spots['transit deck']; place(s[0], s[1], s[2], s[3], 4); const r = ride(S.track, 20, 3);
    run(2, () => { fwd(P.heading); city(); });
    say('the elevated track up to THE SPIRE', S.peakGot === 1 && Math.abs(P.pos.y - S.spire.y) < 0.2, `spire ${S.peakGot ? 'REACHED' : 'not reached'}, y ${fix(P.pos.y, 1)}, lowest ${fix(r.low, 1)}`); }
  // 8. THE SECRET ROUTE down to the market roof
  { const sr = path('secret route'); place(sr.segs[0].a.x, S.spire.y, sr.segs[0].a.z + 1.5, Math.atan2(sr.segs[0].d.x, sr.segs[0].d.z), 0); P.jump = 1; let on = false;
    run(14, () => { city(); if (P.grind && P.grind.rail.path === sr) on = true; });
    const m2 = S.market[1], inM = P.pos.x > m2[0] && P.pos.x < m2[1] && P.pos.z > S.market[0][2] && P.pos.z < m2[3];
    say('the secret route onto the market roof', on && P.grounded && inM && P.pos.y > 13.5, `${on ? 'rode it' : 'never caught'}, ended ${fix(P.pos.x, 1)}, ${fix(P.pos.y, 1)}, ${fix(P.pos.z, 1)}`); }
  // 9. THE GARDENS: launcher up, the ramp across, the rail back to the deck
  { const [G1, G2] = S.gardens, s = rg.CITY.spots.gardens; place(s[0], s[1], s[2], 0, 3); let air = false, land = null;
    run(4, () => { fwd(0); city(); if (!P.grounded) air = true; else if (air && !land) land = P.pos.clone(); });
    say('the launcher up to the first garden', !!land && Math.abs(land.y - G1.y) < 1 && Math.hypot(land.x - G1.x, land.z - G1.z) < G1.r, land ? `landed y ${fix(land.y, 1)}, ${fix(Math.hypot(land.x - G1.x, land.z - G1.z), 1)} m from its centre` : 'never landed');
    place(G1.x, G1.y, G1.z, Math.atan2(G2.x - G1.x, G2.z - G1.z), 3); let got = false;
    run(6, () => { if (!got) along(S.gardenRamp, 2); else rg.stick.L.y = 0; city(); if (P.grounded && Math.abs(P.pos.y - G2.y) < 0.2 && Math.hypot(P.pos.x - G2.x, P.pos.z - G2.z) < G2.r - 2) got = true; });
    say('the boost ramp up to the high garden', got, got ? 'on the high garden' : `ended y ${fix(P.pos.y, 1)}`);
    const gr = path('garden rail'), a = gr.segs[0].a; place(a.x, G2.y, a.z, Math.atan2(gr.segs[0].d.x, gr.segs[0].d.z), 0); P.jump = 1; let on = false;
    run(12, () => { city(); if (P.grind && P.grind.rail.path === gr) on = true; });
    say('the garden rail back down to the transit deck', on && Math.abs(P.pos.y - T.deck) < 0.3, `${on ? 'rode it' : 'never caught'}, ended y ${fix(P.pos.y, 1)}`); }
  // 10. THE LIGHTHOUSE: over its bridge, the pad throws her up, the rail down to the catwalk
  { const L = S.light; place(198, Y, L.z, -Math.PI / 2, 6); let top = 0, up = false; run(5, () => { if (!P.grounded) up = true; if (up) rg.stick.L.y = 0; else fwd(-Math.PI / 2); city(); top = Math.max(top, P.pos.y); });
    say('lighthouse bridge + pad to the top deck', Math.abs(P.pos.y - L.top) < 0.3, `ended y ${fix(P.pos.y, 1)} (top ${fix(top, 1)})`);
    const lr = path('lighthouse rail'), a = lr.segs[0].a; place(a.x - 0.5, L.top, a.z, Math.atan2(lr.segs[0].d.x, lr.segs[0].d.z), 0); P.jump = 1; let on = false;
    run(8, () => { city(); if (P.grind && P.grind.rail.path === lr) on = true; });
    say('the lighthouse rail down to the catwalk', on && Math.abs(P.pos.y - S.catwalk.y) < 0.3, `${on ? 'rode it' : 'never caught'}, ended y ${fix(P.pos.y, 1)}`); }
  // 11. THE OVERFLOW pad up to the catwalk
  { place(216, Y, -70, Math.PI, 3); let air = false, land = null; run(4, () => { fwd(Math.PI); city(); if (!P.grounded) air = true; else if (air && !land) land = P.pos.clone(); });
    say('the Overflow launcher up to the catwalk', !!land && Math.abs(land.y - S.catwalk.y) < 0.2, land ? `landed at ${fix(land.x, 1)}, ${fix(land.y, 1)}, ${fix(land.z, 1)}` : 'never landed'); }
  // 12. THE SNAKE RUN, off the catwalk's end and down into the bowls
  { place(S.catwalk.x1 + 2, S.catwalk.y, -92, Math.PI / 2, 6); const r = ride(S.snake, 22, 3);
    const e = S.snake[S.snake.length - 1];
    say('the snake run, catwalk down to the bowls', Math.abs(P.pos.y - Y) < 0.3 && Math.hypot(P.pos.x - e.x, P.pos.z - e.z) < 25 && r.last > S.snake.length - 6, `ended ${fix(Math.hypot(P.pos.x - e.x, P.pos.z - e.z), 1)} m from its end at y ${fix(P.pos.y, 1)}, got to point ${r.last}/${S.snake.length - 1}`); }
  // 13. THE BIG BOWL
  { const b = S.bowlsMade[0]; place(b.x + b.rim + 0.4, Y + 3, b.z, -Math.PI / 2, 8); let low = 99, inside = false;
    run(4, () => { city(); low = Math.min(low, P.pos.y); if (Math.hypot(P.pos.x - b.x, P.pos.z - b.z) < 4) inside = true; });
    say('dropped into the big bowl', low > Y - 0.1 && inside, `lowest ${fix(low - Y)} above the plateau, crossed the middle: ${inside}`); }
  // 14. THE MARKET SKYWAY
  // r55: judged on ARRIVING on the roof. Past the path's last point the harness's thumb swings round to point back at
  // it, and with the stick as an air heading (r55) that turns her round in the hop over the crest -- a thumb nobody holds
  { place(277, Y, 122, Math.PI, 6); let on = null; run(6, () => { along(S.marketSky, 2); city(); if (!on && P.grounded && Math.abs(P.pos.y - S.market[1][4]) < 0.2) on = P.pos.clone(); });
    say('the market skyway onto the roof', !!on, on ? `on the roof at z ${fix(on.z, 1)}` : `ended y ${fix(P.pos.y, 1)}`); }
  return ok;
};
CASES.grind = () => {
  let ok = true;
  const R = parkRails();
  console.log(`  ${R.length} rails`);
  // r33: HOW HIGH SHE ACTUALLY GOES, measured by jumping on open flat ground -- the rails are judged
  // against THIS, not against the formula that places them.
  let APEX = 0; { place(60, 1, -60, 0, 0); const y0 = P.pos.y; P.jump = 1;
    run(2, () => { rg.stick.L.x = rg.stick.L.y = 0; APEX = Math.max(APEX, P.pos.y - y0); }); }
  console.log(`  her flat-ground apex: ${fix(APEX, 2)} m`);
  // 1. every rail floats over flat ground, at a height an ollie reaches
  for (const [i, r] of R.entries()) {
    const ga = rg.groundAt(r.a.x, r.a.z, r.a.y, 0.01), gb = rg.groundAt(r.b.x, r.b.z, r.b.y, 0.01);
    const ca = r.a.y - ga.floor, cb = r.b.y - gb.floor;
    // r33: *"just a little bit below the apex of her jump"* -- between 60% and 97% of what she reaches
    const good = ga.hit && gb.hit && ca > 0.6 * APEX && cb > 0.6 * APEX && ca < 0.97 * APEX && cb < 0.97 * APEX;
    console.log(`  rail ${i}: ${fix(r.len, 1)} m, ${fix(ca, 2)}..${fix(cb, 2)} m off the ground (${fix(ca / APEX * 100, 0)}..${fix(cb / APEX * 100, 0)}% of her apex)${good ? '' : '   <- WRONG'}`);
    if (!good) ok = false;
  }
  const keepLock = P.stanceLock; P.stanceLock = true;
  // THE HEIGHT OF RAIL i's TOP AT (x, z) -- so every row below is placed RELATIVE to the bar, and
  // raising the rails (r25) moves the test with them instead of dropping her through empty air
  const top = (i, x, z) => { const r = R[i]; const u = Math.max(0, Math.min(1, ((x - r.a.x) * r.hx + (z - r.a.z) * r.hz) / r.hl));
    return r.a.y + (r.b.y - r.a.y) * u; };
  // in the air at (x, y, z) with velocity v; run and watch
  const go = (x, y, z, v, sec, during) => {
    place(x, 1, z, Math.atan2(v[0], v[2]), 0);
    P.grounded = false; P.pos.y = y; P.airT = 0.3; P.vel.set(...v); P.grindCool = 0; P.grindLast = null;
    let caught = null, s0 = 0, sMax = 0, tGr = 0, exitAt = null, t = 0, vyWas = 0;
    run(sec, () => {
      const g = P.grind;
      if (g && !caught) { caught = { side: g.side, rail: R.indexOf(g.rail), s: g.s, vy: vyWas }; s0 = g.s; }
      vyWas = P.vel.y;                               // what she was doing on the frame she caught it
      rg.stick.L.x = rg.stick.L.y = 0;
      if (during) during(t);
      if (g) { tGr += DT; sMax = Math.max(sMax, g.s); }
      if (caught && !g && !exitAt) exitAt = { x: P.pos.x, y: P.pos.y, z: P.pos.z, vy: P.vel.y, air: !P.grounded, v: Math.hypot(P.vel.x, P.vel.z) };
      t += DT;
    });
    return { caught, s0, sMax, tGr, exitAt };
  };
  const row = (label, r, good, extra) => { console.log(`  ${label.padEnd(34)} ${good ? '' : 'WRONG  '}${extra}`); if (!good) ok = false; };
  // 2. dropped onto the flat rail along it: catches, grinds the length, flies off the end
  let r = go(-40, top(0, -40, -3) + 1, -3, [0, 0, 8], 4);
  row('dropped onto rail 0, along it', r, r.caught && r.caught.rail === 0 && r.exitAt && r.exitAt.z > 15.5 && r.exitAt.air,
      r.caught ? `caught at ${fix(r.s0, 1)} m/s, ${fix(r.tGr, 2)} s on it, off at z ${fix(r.exitAt && r.exitAt.z, 2)} (end 16) ${r.exitAt && r.exitAt.air ? 'into the air' : ''}` : 'NO CATCH');
  // 3. crossing it square is a jump over
  r = go(-42, top(0, -40, 5) + 1, 5, [8, 0, 0], 2);
  row('crossing it square, 90 deg', r, !r.caught, r.caught ? 'CAUGHT' : 'passed over, no grind');
  // 4. the side: moving to her right onto it is a RIGHT grind, to her left a LEFT one
  r = go(-39.5, top(0, -40, -3) + 1, -3, [-2, 0, 8], 3);
  const sR = r.caught && r.caught.side;
  r = go(-40.5, top(0, -40, -3) + 1, -3, [2, 0, 8], 3);
  const sL = r.caught && r.caught.side;
  row('from its left, moving right', null, sR === 'right', sR || 'no catch');
  row('from its right, moving left', null, sL === 'left', sL || 'no catch');
  // ...and the same, going the OTHER way along it (her right flips with her)
  // GOING -Z HER RIGHT IS +X, so drifting -X onto the rail from the +X side is moving to HER LEFT:
  // the side is judged against her travel, not against the world
  r = go(-39.5, top(0, -40, 12) + 1, 12, [-2, 0, -8], 3);
  row('going -Z, drifting -X (her LEFT)', null, r.caught && r.caught.side === 'left', r.caught ? r.caught.side : 'no catch');
  // 5. a tap on the rail pops her off it
  r = go(-40, top(0, -40, -3) + 1, -3, [0, 0, 8], 2, t => { if (t > 0.6 && t < 0.62 && P.grind) P.jump = 1; });
  row('a tap mid-rail pops her off', r, r.exitAt && r.exitAt.z < 14 && r.exitAt.vy > 6,
      r.exitAt ? `off at z ${fix(r.exitAt.z, 1)}, rising at ${fix(r.exitAt.vy, 1)} m/s` : 'never left');
  // 6. the DOWN rail speeds her up, and going UP it slowly she runs out and drops off
  r = go(38, top(2, 38, 3) + 0.86, 3, [0, 0, 6], 4);
  row('down rail 2, downhill', r, r.caught && r.exitAt && r.exitAt.v > r.s0 + 0.5,
      r.caught ? `${fix(r.s0, 1)} m/s on, ${fix(r.exitAt && r.exitAt.v, 1)} off the bottom` : 'NO CATCH');
  r = go(38, top(2, 38, 17) + 0.74, 17, [0, 0, -4.5], 4);
  row('down rail 2, UPHILL and slow', r, r.caught && r.exitAt && r.exitAt.z > 2.6,
      r.caught ? `dropped off at z ${fix(r.exitAt && r.exitAt.z, 1)} before the top (2.0)` : 'NO CATCH');
  // 7. the diagonal rail, so nothing assumes an axis
  { const d = R[3], u = 0.3, x = d.a.x + (d.b.x - d.a.x) * u, z = d.a.z + (d.b.z - d.a.z) * u;
    r = go(x, top(3, x, z) + 1, z, [d.hx * 8, 0, d.hz * 8], 4);
    row('diagonal rail 3, along it', r, r.caught && r.caught.rail === 3 && r.tGr > 0.8, r.caught ? `${fix(r.tGr, 2)} s on it` : 'NO CATCH'); }
  // 8. FAST, AT A PHONE'S FRAME RATE: the catch is swept, so a quarter metre a frame still finds it
  { const keepDT = DT; DT = 1 / 20;
    r = go(-8, top(1, -8, -46) + 0.25, -46, [16, -3, 0], 2);
    DT = keepDT;
    row('16 m/s onto rail 1, at 20 Hz', r, r.caught && r.caught.rail === 1, r.caught ? `caught at ${fix(r.s0, 1)} m/s` : 'MISSED IT'); }
  // 9. rising fast past it is a jump over, not a grind
  // 9. RISING FAST PAST IT IS A JUMP OVER. She comes back down onto it later, which is a perfectly
  // good catch -- so what is checked is her vertical speed AT the catch, not whether one happened.
  r = go(-40, top(0, -40, 2) - 0.15, 2, [0, 5, 6], 2);      // INSIDE the catch band, rising -- the gate is all that stops it
  // THE TEST'S OWN DEFINITION OF "RISING FAST", NOT `GRIND.rise`. Read off the live value, a gate
  // turned off (rise 99) also moved the pass mark to 99 and the row went on passing while she was
  // caught climbing at 5 m/s -- a check that takes its threshold from the thing under test cannot fail.
  const RISING = 2;
  row('rising fast up past it', r, !r.caught || r.caught.vy <= RISING,
      !r.caught ? 'no catch' : r.caught.vy > RISING ? `CAUGHT RISING at ${fix(r.caught.vy, 1)} m/s` : `went over, caught it coming DOWN at ${fix(r.caught.vy, 1)} m/s`);
  // 11. r32: A RAIL SETS HER STANCE FROM HER BODY. In the air with her back to her travel (spun 180) and
  // a stance left over from the ground: the catch must make her FAKIE and leave her body where it is,
  // not snap her round to the stale stance.
  { place(-40, 1, -3, Math.PI, 0); P.grindCool = 0; P.grindLast = null; P.stance = 1;
    P.grounded = false; P.pos.y = top(0, -40, -3) + 1; P.airT = 0.3; P.vel.set(0, 0, 8);
    let caught = null;
    run(1.2, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && !caught) caught = { st: P.stance, h: P.heading }; });
    const facing = caught && Math.abs(Math.cos(caught.h) + 1) < 0.01;
    row('caught a rail with her BACK to it', null, caught && caught.st === -1 && facing,
        caught ? `stance ${caught.st < 0 ? 'FAKIE' : 'forward (stale)'}, body ${facing ? 'kept facing back' : 'SNAPPED round'}` : 'NO CATCH'); }
  // 10. *"So you can really jump up into them"*: skating beside rail 0 on the ground, angled in a
  // little, ONE TAP -- she goes up past it, comes down onto it and grinds. The whole point of r25.
  { const h = Math.atan2(1.2, 8);
    place(-41.3, 1, -4, h, Math.hypot(1.2, 8)); P.grindCool = 0; P.grindLast = null;
    let caught = null, apex = 0, t = 0;
    run(2.5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (t < DT * 1.5) P.jump = 1;
      apex = Math.max(apex, P.pos.y); if (P.grind && !caught) caught = { y: P.pos.y, vy: P.vel.y }; t += DT; });
    row('one tap from the ground, onto rail 0', null, !!caught,
        caught ? `apex ${fix(apex, 2)} m, came down onto the ${fix(top(0, -40, 0), 1)} m bar` : `NO CATCH (apex ${fix(apex, 2)} m)`); }
  P.stanceLock = keepLock;
  return ok;
};

// r71: A GRIND IS ASKED FOR. *"Make it so you have to swipe down to grind something -- that way you can launch off a
// ramp. A swipe up or a tap off a ramp will always launch you off ... in the air, swipe down and she shoots downward as
// if she's going to hit the rail ... grind the tops of boxes, the sides of boxes, the tops of half pipes and quarter
// pipes."* Every other case runs with `GRIND.intent` 0 (set at the top), because they measure the grind ITSELF and
// were written against the semi-automatic catch; this one turns it on and drives the swipe through the shipped
// `rightFlick`. A flick's (dx, dy) is screen space: +dy is DOWN.
CASES.intent = () => {
  const G = rg.GRIND; G.intent = 1; rg.ledgeClear();
  let ok = true;
  const row = (name, pass, msg) => { console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name.padEnd(46)} ${msg}`); if (!pass) ok = false; };
  const R0 = rg.PATHS.find(P => P.name === 'park'), bar = R0.segs[0].a.y;      // rail 0: along Z at x -40
  const fresh = () => { P.grindCool = 0; P.grindLast = null; P.grindWant = 0; };
  const watch = (sec, fn) => { let got = null, minVy = 99, t = 0;
    run(sec, () => { rg.stick.L.x = rg.stick.L.y = 0; if (fn) fn(t); t += DT; if (!P.grounded) minVy = Math.min(minVy, P.vel.y);
      if (P.grind && !got) { const g = P.grind, R = g.rail; got = { path: R.path, y: R.a.y + (R.b.y - R.a.y) * g.t, x: R.a.x + (R.b.x - R.a.x) * g.t, z: R.a.z + (R.b.z - R.a.z) * g.t, t }; } });
    return { got, minVy }; };
  const air = (x, y, z, vx, vy, vz) => { place(x, 1, z, Math.atan2(vx, vz), 0); fresh(); P.grounded = false; P.pos.set(x, y, z); P.vel.set(vx, vy, vz); P.airT = 0.3; };
  // 1. DROPPING ONTO A RAIL WITH NO SWIPE: she lands through it -- and with `intent` off the same drop grinds, which is
  // what says it is the gate doing it and not a miss
  air(-40, bar + 1.2, -2, 0, 0, 7);
  let r = watch(1.5);
  row('dropped onto rail 0, no swipe', !r.got, r.got ? 'GRINDED' : 'flew past it');
  G.intent = 0; air(-40, bar + 1.2, -2, 0, 0, 7); r = watch(1.5); G.intent = 1;
  row('...the same drop with intent off', !!r.got, r.got ? 'grinds (so the gate is what stopped it)' : 'NO CATCH');
  // 2. A TAP BESIDE IT IS A JUMP, never the r41 hop
  place(-41.3, 1, -4, Math.atan2(1.2, 8), Math.hypot(1.2, 8)); fresh();
  r = watch(2.5, t => { if (t < DT * 1.5) P.jump = 1; });
  row('tap beside rail 0', !r.got, r.got ? 'HOMED ONTO IT' : 'a jump');
  // 3. SWIPE DOWN ON THE GROUND beside it: the hop onto it
  place(-41.5, 1, -4, 0, 7); fresh();
  let what = rg.rightFlick(0, 60); r = watch(2);
  row('swipe down on the ground beside rail 0', what === 'grind' && r.got && r.got.path === R0, `${what}, ${r.got ? 'grinding rail 0' : 'NO GRIND'}`);
  // 4. SWIPE DOWN IN THE AIR, above and off to the side: she SHOOTS DOWN at it
  air(-37, bar + 5, -3, 0, 2, 6);
  what = rg.rightFlick(0, 60); const vy0 = P.vel.y, dive0 = P.dive && P.dive.side, trail0 = rg.trailAmount(); let gside = null; r = watch(1.5, () => { if (P.grind && !gside) gside = P.grind.side; });
  row('swipe down 5 m over it, 3 m to the side', what === 'grind' && vy0 < -1 && r.got && r.got.path === R0,
      `${what}, left at vy ${fix(vy0, 1)}, ${r.got ? `on it in ${fix(r.got.t, 2)} s` : 'NO GRIND'}`);
  // r81: ...IN THE GRIND POSE for the side she will land on, with the hand and blade trails up, and the pose gone once she is on
  row('...shot down in the grind pose, trails up (r81)', dive0 && dive0 === gside && trail0 === 1 && !P.dive,
      `pose ${dive0 || 'NONE'}, grinds ${gside || '-'}, trails ${fix(trail0, 2)}, ${P.dive ? 'STILL IN THE DIVE POSE' : 'pose released on the rail'}`);
  // 5. SWIPE DOWN IN THE AIR WITH NOTHING NEAR: a dive, and she lands
  air(60, 6, -62, 0, 3, 8);         // (60, -40) is not open: a 0.6 m planter at x 66 is a ledge within reach
  what = rg.rightFlick(0, 60); const vy1 = P.vel.y, dive1 = !!P.dive; r = watch(1.5);
  row('swipe down in open air', what === 'dive' && vy1 <= -G.diveVy + 1e-6 && !r.got && P.grounded, `${what}, vy ${fix(vy1, 1)}, ${P.grounded ? 'landed' : 'STILL UP'}`);
  row('...in the grind pose until she lands, trails gone after (r81)', dive1 && !P.dive && !(P.diveFx > 0), `${dive1 ? 'posed' : 'NO POSE'}, ${P.dive ? 'STILL POSED' : 'released'}, trails ${P.diveFx > 0 ? 'STILL UP' : 'down'}`);
  // 5b. r74: FLOWN OFF THE END OF A RAIL, nothing ahead -- the swipe must NOT turn her round onto the rail behind her.
  // *"She reverses her velocity backwards and grinds the other way -- that's not physically accurate."*
  { const end = R0.segs[R0.segs.length - 1].b, beg = R0.segs[0].a, sz = Math.sign(end.z - beg.z) || 1;
    air(end.x, bar + 1.6, end.z + sz * 1.5, 0, 1, sz * 7);
    what = rg.rightFlick(0, 60); const vz = P.vel.z; r = watch(1.2);
    const back = r.got && r.got.path === R0;      // something further AHEAD (a ledge) is fair game; rail 0 behind her is not
    row('off the end of rail 0, swipe down: no U-turn', vz * sz > 6.5 && !back, `${what}, vz ${fix(vz, 1)} (was ${fix(sz * 7, 1)}), ${back ? 'TURNED BACK ONTO IT' : r.got ? 'onto ' + (r.got.path.name || 'a ledge') + ' ahead' : 'carried on'}`);
    // ...and with rail still AHEAD of her it is a grind onto it, the way she was already going
    air(beg.x - 0.6, bar + 2.5, beg.z - sz * 2, 0, 1, sz * 7);
    what = rg.rightFlick(0, 60); const vz2 = P.vel.z; r = watch(1.5);
    row('rail ahead of her, swipe down: back on, same way', what === 'grind' && vz2 * sz > 0 && r.got, `${what}, vz ${fix(vz2, 1)}, ${r.got ? 'grinding' : 'NO GRIND'}`); }
  // 6. ...and a dive that crosses a rail takes it
  air(-40, bar + 3.5, -5, 0, 1, 7);
  what = rg.rightFlick(0, 60); r = watch(1.5);
  row('swipe down right over the rail', !!r.got, `${what}, ${r.got ? 'grinding' : 'NO GRIND'}`);
  // 7. THE HALF PIPE'S COPING: ride up the wall and swipe down on the way up -- the coping is found off the collider
  const H = 2.6 * (1 - Math.cos(rg.PARK.hpSweep));
  place(1, 1, 28.5, Math.PI + 0.25, 9); fresh();
  let swiped = null, peakY = 0;
  r = watch(3, () => { peakY = Math.max(peakY, P.pos.y); if (!swiped && P.grounded && P.pos.y > 0.8 && P.vel.y > 0) swiped = rg.rightFlick(0, 60); });
  row('up the half pipe wall, swipe down', swiped === 'ledge' && r.got && r.got.path.ledge && Math.abs(r.got.y - H) < 0.2,
      `${swiped}, ${r.got ? `grinding the coping at ${fix(r.got.y, 2)} m (deck ${fix(H, 2)}) at ${fix(r.got.x, 1)},${fix(r.got.z, 1)}` : `NO GRIND (peak ${fix(peakY, 2)})`}`);
  // ...and it GRINDS ALONG it rather than stopping dead
  if (P.grind) { const x0 = P.pos.x; run(0.4, () => { rg.stick.L.x = rg.stick.L.y = 0; });
    row('...and travels along it', Math.abs(P.pos.x - x0) > 0.8 || !P.grind, `${fix(Math.abs(P.pos.x - x0), 2)} m in 0.4 s`); }
  // 8. THE SAME RIDE WITH NO SWIPE: an air, back into the pipe -- the coping never catches her
  place(1, 1, 28.5, Math.PI + 0.25, 9); fresh();
  r = watch(3);
  row('up the wall with no swipe', !r.got, r.got ? 'CAUGHT THE COPING' : 'an air, no grind');
  // 9. THE BOWL'S RIM, from inside, and it is ONE LOOP
  const B = rg.BOWL;
  place(B.x, 1, B.z + B.r - 1.6, 0, 7); fresh();
  swiped = null;
  r = watch(3, () => { if (!swiped && P.grounded && P.pos.y > -1.4 && P.vel.y > 0 && P.n.y < 0.9) swiped = rg.rightFlick(0, 60); });
  row('up the bowl wall, swipe down', !!(r.got && r.got.path.ledge), `${swiped}, ${r.got ? `on the rim at ${fix(r.got.y, 2)}, ${r.got.path.closed ? 'a closed loop' : 'OPEN'} of ${r.got.path.segs.length} segs` : 'NO GRIND'}`);
  // 10. A BOX TOP: the hub deck's edge, ridden up to from the ground alongside it
  { const s = rg.CITY.spots['hub deck'], L = rg.lipEdges(s[0], s[2], 12, 2.0, 2.6).filter(E => Math.hypot(E.b[0] - E.a[0], E.b[2] - E.a[2]) > 4 && Math.abs(E.a[1] - E.b[1]) < 0.02).sort((a, b) => a.d - b.d);
    const E = L[0];
    if (!E) row('the hub deck edge', false, 'NO LIP FOUND');
    // a point near one END of the front edge: its middle has the bank and the stair set in front of it, whose sloped
    // SIDES are nearer lips and rightly win
    else { const mx = E.a[0] + (E.b[0] - E.a[0]) * 0.12, mz = E.a[2] + (E.b[2] - E.a[2]) * 0.12, ex = E.b[0] - E.a[0], ez = E.b[2] - E.a[2];
      place(mx + E.ox * 1.6, 1, mz + E.oz * 1.6, Math.atan2(ex, ez), 6); fresh();
      what = rg.rightFlick(0, 60); r = watch(2);
      // r92: a RAILING standing on that edge now wins over the edge itself (`GRIND.ledgePen`) -- either is that edge, in plan
      const ex2 = E.b[0] - E.a[0], ez2 = E.b[2] - E.a[2], el = Math.hypot(ex2, ez2), off = r.got ? Math.abs((r.got.x - E.a[0]) * ez2 - (r.got.z - E.a[2]) * ex2) / el : 9;
      row('beside the hub deck, swipe down', r.got && off < 0.8 && ((what === 'ledge' && Math.abs(r.got.y - E.a[1]) < 0.15) || (what === 'grind' && r.got.y > E.a[1] + 0.3)),
          `${what}, ${r.got ? `grinding at ${fix(r.got.y, 2)} (${fix(r.got.x, 1)},${fix(r.got.z, 1)}) for the ${fix(E.a[1], 2)} m edge from ${fix(mx + E.ox * 1.6, 1)},${fix(mz + E.oz * 1.6, 1)}` : 'NO GRIND'}`); } }
  // 11. NOTHING NEAR ON THE GROUND: the swipe is the strike it always was
  place(60, 1, -60, 0, 5); fresh(); rg.girl.ready = false;
  what = rg.rightFlick(0, 60);
  row('swipe down on open ground', what === 'strike', String(what));
  P.mel = null; P.melQ = null;
  row('ledges kept to LEDGE.max', rg.LEDGE.paths.length <= rg.LEDGE.max, `${rg.LEDGE.paths.length} kept, ${rg.LEDGE.made} made`);
  rg.ledgeClear(); G.intent = 0;
  return ok;
};

// r92: THE ACROPOLIS -- every link between its four levels ridden through the shipped step, every rail end to end through its
// square corners, and the launcher, the boosters and the descent each delivering her where they say
CASES.acro = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const A = rg.ACR; if (!A.built) { console.log('  the Acropolis was not built'); return false; }
  const city = () => rg.stepCity(DT), g = rg.SK.g;
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.kicked = 0; P.drift = 0; rg.ORB.safe = null; P.kickRail = null; P.grindWant = 0; P.jump = 0; P.lift = null; };
  const go = (x, z, h, v, y) => { reset(); P.flatT = 0; place(x, (y || 0) + 0.3, z, h, v); const q = rg.groundAt(x, z, (y || 0) + 0.6, 1); if (q.hit) P.pos.y = q.floor; };
  const ride = (sec, drive) => { const r = { top: -99, bail: 0, deep: 0, falls: rg.ORB.falls || 0, grind: new Set(), vmax: 0 };
    run(sec, (t, i) => { if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city(); r.top = Math.max(r.top, P.pos.y); if (P.bailT > 0) r.bail = 1; r.vmax = Math.max(r.vmax, P.speed || 0);
      if (P.grind) r.grind.add(P.grind.rail.path);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 2, 0); if (q.hit && !P.grind) r.deep = Math.max(r.deep, q.floor - P.pos.y); });
    r.falls = (rg.ORB.falls || 0) - r.falls; r.clean = !r.bail && !r.falls && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.falls ? ' FELL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const steer = h => { rg.cam.az = h; rg.cam.steerAz = h; rg.stick.L.x = 0; rg.stick.L.y = -1; };
  const W = -Math.PI / 2, E = Math.PI / 2, N = 0, S = Math.PI, cz = (A.P.z0 + A.P.z1) / 2;
  const on = (y, tol) => P.grounded && Math.abs(P.pos.y - y) < (tol || 0.08);
  say('no NaN vertex anywhere', !rg.MESHBAD || !rg.MESHBAD(), '');
  { const bad = []; for (let i = 0; i < A.kit.length; i++) for (let j = i + 1; j < A.kit.length; j++) { const a = A.kit[i], b = A.kit[j]; if (!a.bb || !b.bb || (a.nest && a.nest === b.nest)) continue;
      if ([0, 1, 2].every(k => Math.min(a.bb[k + 3], b.bb[k + 3]) - Math.max(a.bb[k], b.bb[k]) > 0.05)) bad.push(a.label + ' x ' + b.label); }
    // and nothing of the kit's stands on a rail's line: every booster and the descent clear of every piece by a body
    for (const R of A.paths.filter(P0 => /ascent|sky stair|descent|sky bridge|cascade|roofline|hub run|mega drop/.test(P0.name))) for (const sg of R.segs) for (const k of A.kit) if (k.bb && sg.a.x > k.bb[0] - 0.8 && sg.a.x < k.bb[3] + 0.8 && sg.a.z > k.bb[2] - 0.8 && sg.a.z < k.bb[5] + 0.8 && sg.a.y < k.bb[4] + 1.8 && sg.a.y > k.bb[1] - 0.5) { bad.push(k.label + ' on the ' + R.name); break; }
    say('the Acropolis kit: nothing inside anything, nothing on a rail\'s line', !bad.length, bad.slice(0, 4).join('; ') || `${A.kit.length} pieces`); }
  // 0. EVERY ➤ STOP stands her on a floor
  { const bad = []; for (const n of A.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.1) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every Acropolis ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${A.stops.length} stops`); }
  // 1. THE GRAND STAIR'S BANKS: up one, up both, and back down both, hands off
  { go(-150, cz, W, Math.sqrt(2 * g * 4) + 2.5); let t4 = 0, tr = []; const r = ride(4, (t, i) => { rg.stick.L.x = rg.stick.L.y = 0; if (on(4) && P.pos.x < -183) t4 = 1; if (process.env.ATRACE && i % 10 === 0) tr.push(`x${fix(P.pos.x, 1)} y${fix(P.pos.y)} v${fix(P.speed || 0, 1)}${P.grounded ? 'g' : 'a'}`); });
    if (tr.length) console.log('    ' + tr.join(' | '));
    say('grand stair: the agora up the bank onto the terrace', t4 && r.clean, `${t4 ? 'on the terrace' : 'never'}, up to ${fix(r.top)}${cl(r)}`); }
  { go(-140, cz, W, 12); let t8 = 0; const r = ride(6, () => { steer(W); if (on(8) && P.pos.x < -203) t8 = 1; });
    say('grand stair: pushing up both banks, onto the stylobate', t8 && r.clean, `${t8 ? 'on the stylobate' : 'never'}, up to ${fix(r.top)}${cl(r)}`); }
  { go(-206, cz, E, 6, 8); const r = ride(5); say('grand stair: down both banks from the stylobate, hands off', P.pos.x > -175 && on(0) && r.clean, `ends x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}, top speed ${fix(r.vmax, 1)}${cl(r)}`); }
  // 2. THE ZIGGURAT RAMPS: north and south, ground to terrace and terrace to stylobate, each onto its landing
  for (const R of A.ramps) { const nm = R.sg > 0 ? 'north' : 'south';
    go(R.a.x + 4, R.a.z, W, Math.sqrt(2 * g * 4) + 2); let la = 0; const ra = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; if (on(4, 0.1) && P.pos.x < R.a.to.x + 4.5) la = 1; });
    say(`${nm} face: ramp from the ground onto its landing at 4 m`, la && ra.clean, `${la ? 'on the landing' : 'never'}, ends x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}${cl(ra)}`);
    go(R.b.x - 4, R.b.z, E, Math.sqrt(2 * g * 4) + 2, 4); let lb = 0; const rb = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; if (on(8, 0.1) && P.pos.x > R.b.to.x - 4.5) lb = 1; });
    say(`${nm} face: ramp from the terrace onto its landing at 8 m`, lb && rb.clean, `${lb ? 'on the landing' : 'never'}, ends x ${fix(P.pos.x, 1)} y ${fix(P.pos.y)}${cl(rb)}`); }
  // 3. THE TEMPLE: up its bank from the stylobate, hands off
  { const TP = A.TP; go(-205, (TP.z0 + TP.z1) / 2, W, Math.sqrt(2 * g * 4) + 2.5, 8); let t12 = 0; const r = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; if (on(12) && P.pos.x < TP.x1 - 0.5) t12 = 1; });
    say('temple: up its bank onto the podium', t12 && r.clean, `${t12 ? 'on the podium' : 'never'}, up to ${fix(r.top)}${cl(r)}`); }
  // 4. EVERY U RAIL END TO END: on at its upper end, no stick -- along the edge, square down the flight, square along the bottom
  { const U = A.paths.filter(P0 => P0.name === 'kit acro stair rail' || P0.name === 'acro stair rail'), bad = [];
    for (const R of U) { const S0 = R.segs[0], goal = R.segs[R.segs.length - 1]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 7); P.grounded = false;
      rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 7, side: 'left' }); let reached = 0, off = 0;
      run(6, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grind && P.grind.rail.path === R) { if (P.grind.rail === goal) reached = 1; } else if (!reached) off = 1; });
      if (!reached) bad.push(`${fix(S0.a.x, 1)},${fix(S0.a.z, 1)}: ${off ? 'came off' : 'never reached the end'}`); }
    say(`every U rail grinds end to end through both corners (${U.length})`, U.length === 6 && !bad.length, bad.join('; ') || 'all of them'); }
  // a tap riding along the upper edge toward the stair -- the way a player gets on
  { const R = A.paths.find(P0 => /stair rail/.test(P0.name)), S0 = R.segs[0], h = Math.atan2(S0.hx, S0.hz), yd = S0.a.y - 0.9;
    // beside it ON THE UPPER LEVEL: the side of the rail that has the deck under it, not the drop
    const sd = [1, -1].find(k => { const q = rg.groundAt(S0.a.x + Math.sin(h) * 1.5 + Math.cos(h) * 0.9 * k, S0.a.z + Math.cos(h) * 1.5 - Math.sin(h) * 0.9 * k, yd + 0.5, 0); return q.hit && Math.abs(q.floor - yd) < 0.1; }) || 1;
    const bx = S0.a.x + Math.sin(h) * 1.5 + Math.cos(h) * 0.9 * sd, bz = S0.a.z + Math.cos(h) * 1.5 - Math.sin(h) * 0.9 * sd;
    rg.GRIND.intent = 0; rg.ledgeClear(); go(bx, bz, h, 6, yd); P.jump = 1;
    const r = ride(3); say('a tap riding beside it along the upper edge catches the U rail', r.grind.has(R) && r.clean, r.grind.has(R) ? 'grinding it' : `ends y ${fix(P.pos.y)}${cl(r)}`);
    // and the shipped swipe down from the same spot, on the ground and just after an ollie
    rg.GRIND.intent = 1; rg.ledgeClear(); go(bx, bz, h, 6, yd); rg.girl.ready = false;
    const wg = rg.rightFlick(0, 60), r2 = ride(3);
    rg.ledgeClear(); go(bx, bz, h, 6, yd); P.jump = 1; let wa = null;
    const r3 = ride(3, (t, i) => { rg.stick.L.x = rg.stick.L.y = 0; if (i === 12) wa = rg.rightFlick(0, 60); });
    say('the shipped swipe down beside the U rail takes it (ground / air)', r2.grind.has(R) && r3.grind.has(R), `ground: ${r2.grind.has(R) ? 'the rail' : (wg || 'nothing')}, air: ${r3.grind.has(R) ? 'the rail' : (wa || 'nothing')}`); rg.GRIND.intent = 0; }
  // 5. THE ASCENT: a tap from the agora beside its foot, and the booster carries her onto the stylobate
  { const R = A.paths.find(P0 => /ascent/.test(P0.name)); rg.GRIND.intent = 0; rg.ledgeClear(); go(-148, 87.2, W, 7); P.jump = 1; let land = 0;
    const r = ride(8, () => { rg.stick.L.x = rg.stick.L.y = 0; if (!P.grind && on(8) && P.pos.x < -203) land = 1; });
    say('the ascent: a tap at its foot, boosted up onto the stylobate', r.grind.has(R) && land && r.clean, `${r.grind.has(R) ? 'grinding' : 'NEVER CAUGHT'}, ${land ? 'landed on the stylobate' : 'ends y ' + fix(P.pos.y)}${cl(r)}`); }
  // 6. THE LAUNCHER: stood on it, she lands on the island
  { go(A.launch.x, A.launch.z, N, 0, 8); let isl = 0; const r = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (on(A.IS.y, 0.12) && Math.abs(P.pos.z - A.IS.z) < A.IS.h) isl = 1; });
    say('the launcher throws her onto the sky island', isl && r.clean, `${isl ? 'on the island' : 'ends ' + fix(P.pos.x, 1) + ',' + fix(P.pos.y, 1) + ',' + fix(P.pos.z, 1)}, up to ${fix(r.top)}${cl(r)}`); }
  // 7. THE SKY STAIR: from its foot, the booster takes her up onto the island
  { const R = A.paths.find(P0 => /sky stair/.test(P0.name)), S0 = R.segs[0]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 6); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 6, side: 'left' }); let isl = 0; const r = ride(8, () => { rg.stick.L.x = rg.stick.L.y = 0; if (!P.grind && on(A.IS.y, 0.12)) isl = 1; });
    say('the sky stair: boosted up from the stylobate onto the island', isl && r.clean, `${isl ? 'on the island' : 'ends y ' + fix(P.pos.y)}, top speed ${fix(r.vmax, 1)}${cl(r)}`); }
  // 8. THE DESCENT: off the island, round and round the obelisk, onto the ground -- without coming off
  { const R = A.paths.find(P0 => /descent/.test(P0.name)), S0 = R.segs[0], goal = R.segs[R.segs.length - 1]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 5); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 5, side: 'left' }); let reached = 0, off = 0, tE = 0, gr = 0; const r = ride(40, (t) => { rg.stick.L.x = rg.stick.L.y = 0;
      if (P.grind && P.grind.rail.path === R) { if (P.grind.rail === goal && !reached) { reached = 1; tE = t; } } else if (!reached) off = 1; if (reached && on(0, 0.1)) gr = 1; });
    say('the descent: off the island, four laps round the obelisk, onto the ground', reached && gr && !r.bail, `${reached ? 'reached the end in ' + fix(tE, 1) + ' s' : off ? 'CAME OFF at y ' + fix(P.pos.y) : 'never reached the end'}, top speed ${fix(r.vmax, 1)}, ${gr ? 'rolling on the ground' : 'ends y ' + fix(P.pos.y)}`); }
  // 9. THE QUARTER PIPES up top, hands off: up the face and back onto the level they stand on
  for (const k of A.kit.filter(p => p.kind === 'qp')) { const T = k.T, S2 = rg.KSZ[k.size], fx = Math.sin(T.yaw), fz = Math.cos(T.yaw);
    go(T.x - fx * 8, T.z - fz * 8, T.yaw, Math.sqrt(2 * g * (S2.H + 1)) + 1, T.y); let back = 0, pk = 0;
    const r = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.pos.y > T.y + S2.H * 0.85) pk = 1; if (pk && on(T.y, 0.12)) back = 1; });
    if (process.env.ATRACE && !back) console.log('    ', k.label, fix(P.pos.x, 1), fix(P.pos.y, 2), fix(P.pos.z, 1));
    say(`${k.label}: up the face and back down onto its level`, pk && back && r.clean, `up to ${fix(r.top - T.y)} over its level, ${back ? 'back down' : 'NEVER BACK, ends y ' + fix(P.pos.y)}${cl(r)}`); }
  // 10. r93: THE PANTHEON -- the third level, 46 m up
  const C = A.PN, onP = () => Math.hypot(P.pos.x - C.x, P.pos.z - C.z) < C.R - 0.6 && P.pos.y > C.y - 2.5 && P.grounded;
  // the sky bridge: on at its foot on the sky agora, boosted up and in through the west gap -- and she stays up there
  { const R = A.paths.find(P0 => /sky bridge/.test(P0.name)), S0 = R.segs[0]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 6); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 6, side: 'left' }); let isl = 0, low = 99; const r = ride(9, () => { rg.stick.L.x = rg.stick.L.y = 0; if (!P.grind && onP()) isl = 1; if (isl) low = Math.min(low, P.pos.y); });
    say('the sky bridge: boosted from the sky agora into the Pantheon, and stays up', isl && low > C.y - 2.5 && r.clean, `${isl ? 'in the Pantheon, never under ' + fix(low) : 'ends ' + fix(P.pos.x, 1) + ',' + fix(P.pos.y, 1) + ',' + fix(P.pos.z, 1)}, top speed ${fix(r.vmax, 1)}${cl(r)}`); }
  // a tap beside the sky bridge's foot catches it
  { const R = A.paths.find(P0 => /sky bridge/.test(P0.name)), S0 = R.segs[0]; rg.GRIND.intent = 0; rg.ledgeClear(); go(S0.a.x + 1, S0.a.z - 1.1, E, 5, A.IS.y); P.jump = 1;
    const r = ride(3); say('a tap beside the sky bridge\'s foot catches it', r.grind.has(R), r.grind.has(R) ? 'grinding it' : `ends y ${fix(P.pos.y)}${cl(r)}`); }
  // the launcher on the agora throws her onto the ambulatory
  { go(A.plaunch.x, A.plaunch.z, N, 0); let isl = 0; const r = ride(6, () => { rg.stick.L.x = rg.stick.L.y = 0; if (onP()) isl = 1; });
    say('the agora launcher throws her into the Pantheon', isl && r.clean, `${isl ? 'in the Pantheon' : 'ends ' + fix(P.pos.x, 1) + ',' + fix(P.pos.y, 1) + ',' + fix(P.pos.z, 1)}, up to ${fix(r.top)}${cl(r)}`); }
  // the bowl: dropped in from the ambulatory hands-off, over the volcano, and it stays in; then at the sky bridge's speed
  for (const v of [3, 15]) { go(C.x - C.Rb - 0.6, C.z + 0.3, E, v, C.y); let over = 0, inB = 1;
    const r = ride(6, (t) => { rg.stick.L.x = rg.stick.L.y = 0; if (Math.hypot(P.pos.x - C.x, P.pos.z - C.z) < 1.5 && P.pos.y > C.y - 2.4 + 0.7) over = 1; if (t > 1 && Math.hypot(P.pos.x - C.x, P.pos.z - C.z) > C.Rb + 0.5) inB = 0; });
    say(`the Pantheon bowl: dropped in at ${v} m/s hands-off, over the volcano, stays in`, over && inB && P.pos.y > C.y - 3 && r.clean, `${over ? 'over the top' : 'MISSED IT'}, ${inB ? 'stays in' : 'OUT at ' + fix(Math.hypot(P.pos.x - C.x, P.pos.z - C.z), 1)}, up to ${fix(r.top - C.y)} over the deck${cl(r)}`); }
  // the halo: once round on it with no stick, and a tap from the ambulatory catches it
  { const R = A.paths.find(P0 => /halo/.test(P0.name)), S0 = R.segs[R.segs.length - 6]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 8); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 8, side: 'left' }); let off = 0, dist = 0, seam = 0, lx = P.pos.x, lz = P.pos.z;
    run(8, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (!P.grind || P.grind.rail.path !== R) off = 1; else { dist += Math.hypot(P.pos.x - lx, P.pos.z - lz); if (P.grind.rail === R.segs[2]) seam = 1; } lx = P.pos.x; lz = P.pos.z; });
    say('the halo: round the rim on it, hands off, through the seam where the ring closes', !off && seam && R.closed, `${off ? 'CAME OFF' : 'on it'}, ${seam ? 'through the seam' : 'NEVER CROSSED THE SEAM'}, ${fix(dist, 0)} m in 8 s`);
    const a = Math.PI * 0.75, rr = C.R - 1.7; rg.GRIND.intent = 0; rg.ledgeClear(); go(C.x + rr * Math.sin(a), C.z + rr * Math.cos(a), a + Math.PI / 2, 5, C.y); P.jump = 1;
    const r = ride(3); say('a tap in the ambulatory catches the halo', r.grind.has(R), r.grind.has(R) ? 'grinding it' : `${[...r.grind].map(p => p.name).join('+') || 'nothing'}, ends y ${fix(P.pos.y)}${cl(r)}`); }
  // the cascade: from its start in the north gap, through every right angle, onto the ground
  { const R = A.paths.find(P0 => /cascade/.test(P0.name)), S0 = R.segs[0], goal = R.segs[R.segs.length - 1]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 5); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 5, side: 'left' }); let reached = 0, off = 0, tE = 0, gr = 0; const r = ride(30, (t) => { rg.stick.L.x = rg.stick.L.y = 0;
      if (P.grind && P.grind.rail.path === R) { if (P.grind.rail === goal && !reached) { reached = 1; tE = t; } } else if (!reached) off = 1; if (reached && on(0, 0.1)) gr = 1; });
    say('the cascade: off the Pantheon, every right angle, onto the ground', reached && gr && !r.bail, `${reached ? 'reached the end in ' + fix(tE, 1) + ' s' : off ? 'CAME OFF at ' + fix(P.pos.x, 1) + ',' + fix(P.pos.y, 1) + ',' + fix(P.pos.z, 1) : 'never reached the end'}, top speed ${fix(r.vmax, 1)}, ${gr ? 'rolling on the ground' : 'ends y ' + fix(P.pos.y)}`);
    const rr = (C.col + C.R - 0.7) / 2; rg.GRIND.intent = 0; rg.ledgeClear(); go(C.x - 1.1, C.z + rr - 2.5, N, 5, C.y); P.jump = 1;
    const r2 = ride(3); say('a tap beside the cascade\'s start catches it', r2.grind.has(R), r2.grind.has(R) ? 'grinding it' : `${[...r2.grind].map(p => p.name).join('+') || 'nothing'}, ends y ${fix(P.pos.y)}${cl(r2)}`); }
  // the mega drop: out of the east gap, over the street, off the end into the park's mega vert -- and down it
  { const R = A.paths.find(P0 => /mega drop/.test(P0.name)), S0 = R.segs[0], G = R.segs[R.segs.length - 1]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 5); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 5, side: 'left' }); let reached = 0, off = 0, down = 0, tE = 0; const r = ride(14, (t) => { rg.stick.L.x = rg.stick.L.y = 0;
      if (P.grind && P.grind.rail.path === R) { if (Math.hypot(P.pos.x - G.b.x, P.pos.z - G.b.z) < 2 && !reached) { reached = 1; tE = t; } } else if (!reached && !off) off = [P.pos.x, P.pos.y, P.pos.z];
      if (reached && P.grounded && P.pos.y < 1 && P.pos.x > -107 && P.pos.x < -84) down = Math.max(down, P.speed || 0); });
    say('the mega drop: off the Pantheon onto the mega vert, and down it', reached && down && !r.bail, `${reached ? 'end in ' + fix(tE, 1) + ' s' : off ? 'CAME OFF at ' + off.map(v => fix(v, 1)).join(',') : 'never reached the end'}, ${down ? fix(down, 1) + ' m/s at the bottom of the vert' : 'NEVER DOWN, ends ' + fix(P.pos.x, 1) + ',' + fix(P.pos.y, 1) + ',' + fix(P.pos.z, 1)}${r.bail ? ' BAIL' : ''}`);
    const rr = (C.col + C.R - 0.7) / 2; rg.GRIND.intent = 0; rg.ledgeClear(); go(C.x + rr - 2.5, C.z - 1.1, E, 5, C.y); P.jump = 1;
    const r2 = ride(3); say('a tap beside the mega drop\'s start catches it', r2.grind.has(R), r2.grind.has(R) ? 'grinding it' : `${[...r2.grind].map(p => p.name).join('+') || 'nothing'}, ends y ${fix(P.pos.y)}${cl(r2)}`); }
  // 11. THE AGORA: into the stoa over its step and stopped by its wall; the fountain's rim is a wall, its water a floor
  { const T = A.STOA; go(-157, 80, S, 8); let up = 0; const r = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && Math.abs(P.pos.y - 0.28) < 0.05) up = 1; });
    say('the stoa: rolled in under the colonnade, up its step, stopped by the back wall', up && P.pos.z > T.z0 - 0.05 && r.clean, `${up ? 'on its floor' : 'NEVER UP'}, ends z ${fix(P.pos.z, 2)} (wall ${T.z0})${cl(r)}`); }
  { const F = A.FT; go(F.x + F.r + 6, F.z, W, 7); const r = ride(2); const d = Math.hypot(P.pos.x - F.x, P.pos.z - F.z);
    say('the fountain: its rim is a wall from outside', d > F.r - 0.05, `ends ${fix(d, 2)} m from its middle (rim ${F.r})${cl(r)}`);
    go(F.x + 2.4, F.z, N, 0, 0.4); const r2 = ride(1); say('the fountain: the water is a floor at 0.4', on(0.4, 0.03), `stands at y ${fix(P.pos.y)}${cl(r2)}`); }
  // 12. r94: THE ROOFLINE -- Acropolis to the canal street's roofs to the hub, without touching the ground
  { const RA = A.RL.A, RD = A.RL.D, inD = () => P.pos.x > RD.x0 && P.pos.x < RD.x1 && P.pos.z > RD.z0 && P.pos.z < RD.z1 && Math.abs(P.pos.y - RD.y) < 0.1 && P.grounded;
    const R = A.paths.find(P0 => /roofline/.test(P0.name)), S0 = R.segs[0], goal = R.segs[R.segs.length - 1]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 6); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 6, side: 'left' }); let reached = 0, off = 0, land = 0, tE = 0;
    const r = ride(14, (t) => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && P.grind.rail.path === R) { if (P.grind.rail === goal && !reached) { reached = 1; tE = t; } } else if (!reached && !off) off = [P.pos.x, P.pos.y, P.pos.z]; if (reached && inD()) land = 1; });
    say('the roofline: stylobate up onto the roofs, along them, onto the rooftop park', reached && land && r.clean, `${reached ? 'end in ' + fix(tE, 1) + ' s' : off ? 'CAME OFF at ' + off.map(v => fix(v, 1)).join(',') : 'never reached the end'}, ${land ? 'on the 17 m roof' : 'ends ' + fix(P.pos.x, 1) + ',' + fix(P.pos.y, 1) + ',' + fix(P.pos.z, 1)}, top speed ${fix(r.vmax, 1)}${cl(r)}`);
    rg.GRIND.intent = 0; rg.ledgeClear(); go(S0.a.x + 1.1, S0.a.z - 0.4, S, 4, 8); P.jump = 1;
    const r2 = ride(3); say('a tap beside the roofline\'s foot catches it', r2.grind.has(R), r2.grind.has(R) ? 'grinding it' : `${[...r2.grind].map(p => p.name).join('+') || 'nothing'}, ends y ${fix(P.pos.y)}${cl(r2)}`);
    // on roof A: rolled at each parapet, she stays on the roof
    const bad = []; for (const [x, z, h] of [[-188, 26, S], [-188, 34, N], [-198, 30, W], [-178, 26, E]]) { go(x, z, h, 9, RA.y); const r3 = ride(2); if (P.pos.y < RA.y - 0.1 || r3.falls) bad.push(`${x},${z} -> y ${fix(P.pos.y)}`); }
    say('roof A: a parapet on every side, she stays up', !bad.length, bad.join('; ') || 'four sides');
    // the rooftop half pipe: east up the QP and back, west up the other and back, still on the roof
    go(-118, 27.5, E, 12, RD.y); let ups = 0, side = 0; const r4 = ride(12, (t, i) => { if (process.env.ATRACE && i % 20 === 0) console.log("    hp", fix(P.pos.x, 1), fix(P.pos.y), fix(P.pos.z, 1), fix(P.speed || 0, 1)); rg.stick.L.x = rg.stick.L.y = 0; if (P.pos.y > RD.y + 0.8) { const sd = P.pos.x > -116 ? 1 : -1; if (sd !== side) { ups++; side = sd; } } });
    say('the rooftop half pipe: up one end, across, up the other, hands off', ups >= 2 && P.pos.y > RD.y - 0.1 && P.pos.y < RD.y + 3 && r4.clean, `${ups} walls, ends y ${fix(P.pos.y)}${cl(r4)}`);
    // the hub run: off the roof's corner onto the hub deck
    const H = A.paths.find(P0 => /hub run/.test(P0.name)), H0 = H.segs[0], hg = H.segs[H.segs.length - 1]; reset(); place(H0.a.x, H0.a.y, H0.a.z, Math.atan2(H0.hx, H0.hz), 5); P.grounded = false;
    rg.enterGrind({ rail: H0, t: 0, dir: 1, s: 5, side: 'left' }); let hr = 0, hoff = 0, deck = 0; const r5 = ride(8, () => { rg.stick.L.x = rg.stick.L.y = 0;
      if (P.grind && P.grind.rail.path === H) { if (Math.hypot(P.pos.x - hg.b.x, P.pos.z - hg.b.z) < 2) hr = 1; } else if (!hr && !hoff) hoff = [P.pos.x, P.pos.y, P.pos.z]; if (hr && on(2.4, 0.08) && P.pos.x > -64 && P.pos.x < -30) deck = 1; });
    say('the hub run: off the rooftop park, over the hub\'s bank, onto the hub deck', hr && deck && !r5.bail, `${hr ? 'reached the end' : hoff ? 'CAME OFF at ' + hoff.map(v => fix(v, 1)).join(',') : 'never reached the end'}, ${deck ? 'on the hub deck' : 'ends ' + fix(P.pos.x, 1) + ',' + fix(P.pos.y, 1) + ',' + fix(P.pos.z, 1)}, top speed ${fix(r5.vmax, 1)}`);
    rg.GRIND.intent = 0; rg.ledgeClear(); go(H0.a.x - 1.5, H0.a.z - 1.0, E, 4, RD.y); P.jump = 1;
    const r6 = ride(3); say('a tap on the rooftop park catches the hub run', r6.grind.has(H), r6.grind.has(H) ? 'grinding it' : `${[...r6.grind].map(p => p.name).join('+') || 'nothing'}, ends y ${fix(P.pos.y)}${cl(r6)}`); }
  // 13. r94: THE CRYPT -- in through the doorway, down the tunnel, into the chamber, round the gems; the floors above intact
  { const CR = A.CRYPT, g0 = rg.GEM.got; go(-174, (CR.t0 + CR.t1) / 2, W, 8); let inC = 0, hi = 0;
    const r = ride(6, (t) => { const c = A.crypt, a = t * 1.6, tx = c.x + Math.cos(a) * 4.2, tz = c.z + Math.sin(a) * 4.2;
      if (P.pos.x < CR.tx - 2) { inC = 1; steer(Math.atan2(tx - P.pos.x, tz - P.pos.z)); } else { rg.stick.L.x = rg.stick.L.y = 0; } hi = Math.max(hi, P.pos.y); });
    const got = rg.GEM.got - g0;
    say('the crypt: in through the doorway, down the tunnel, into the chamber', inC && hi < CR.h - 1.5 && r.clean, `${inC ? 'in the chamber' : 'NEVER IN, ends ' + fix(P.pos.x, 1) + ',' + fix(P.pos.z, 1)}, highest y ${fix(hi)}, ${got} gems${cl(r)}`);
    say('the crypt: gems down the tunnel and round the obelisk', got >= 3, `${got} picked up`);
    const bad = []; for (const [x, z, y] of [[-190, 100, 4], [-200, 95, 4], [-220, 100, 8], [-228, 92, 8]]) { const q = rg.groundAt(x, z, y + 0.5, 0); if (!q.hit || Math.abs(q.floor - y) > 0.02) bad.push(`${x},${z}: ${q.hit ? fix(q.floor) : 'none'}`); }
    say('over the crypt the terrace and the stylobate are still floors', !bad.length, bad.join('; ') || '4 points'); }
  rg.GRIND.intent = 0;
  return ok;
};
// r95: THE LINKS -- the bridges between districts, ridden both ways through the shipped step: steered down the deck's own
// centreline (a player follows the road), and every crossing of the lagoon is dry
CASES.links = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const L = rg.LINKS; if (!L.decks.length) { console.log('  no links were built'); return false; }
  const city = () => rg.stepCity(DT), g = rg.SK.g;
  const go = (x, y, z, h, v) => { P.mel = null; P.flip = null; P.grab = null; P.jump = 0; rg.ORB.safe = null; P.flatT = 0; place(x, y + 0.3, z, h, v); const q = rg.groundAt(x, z, y + 0.6, 1); if (q.hit) P.pos.y = q.floor; };
  const follow = (D, dir) => { const pts = D.P.map(p => [p.x, p.z]); if (dir < 0) pts.reverse(); return () => { let bi = 0, bd = 1e9;
      for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - P.pos.x, pts[i][1] - P.pos.z); if (d < bd) { bd = d; bi = i; } }
      const t = pts[Math.min(pts.length - 1, bi + 5)], e = pts[pts.length - 1], tx = bi + 5 >= pts.length ? e[0] + (e[0] - pts[pts.length - 2][0]) * 4 : t[0], tz = bi + 5 >= pts.length ? e[1] + (e[1] - pts[pts.length - 2][1]) * 4 : t[1];
      const h = Math.atan2(tx - P.pos.x, tz - P.pos.z); rg.cam.az = h; rg.cam.steerAz = h; rg.stick.L.x = 0; rg.stick.L.y = -1; }; };
  const ride = (sec, drive) => { const r = { falls: rg.ORB.falls || 0, bail: 0, deep: 0, low: 99 }; run(sec, () => { drive(); city(); if (P.bailT > 0) r.bail = 1;
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 2, 0); if (q.hit) r.deep = Math.max(r.deep, q.floor - P.pos.y); r.low = Math.min(r.low, P.pos.y); });
    r.falls = (rg.ORB.falls || 0) - r.falls; r.clean = !r.bail && !r.falls && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.falls ? ' SPLASH' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const N = L.decks.find(d => d.name === 'north causeway'), S = L.decks.find(d => d.name === 'south causeway');
  { const p0 = N.P[0]; go(p0.x + 0.5, 0, p0.z, Math.PI / 2, 6); const r = ride(9, follow(N, 1));
    say('north causeway: from the park\'s east side, up and over the lagoon into Neon Alley', P.pos.x > L.north.x1 + 2 && Math.abs(P.pos.y - 8) < 0.1 && r.clean, `ends ${fix(P.pos.x, 1)},${fix(P.pos.y)},${fix(P.pos.z, 1)}${cl(r)}`); }
  { const e = N.P[N.P.length - 1]; go(e.x + 4, 8, e.z, -Math.PI / 2, 5); const r = ride(9, follow(N, -1));
    say('north causeway: back from the alley, down to the ground beside the park', P.pos.x < L.north.x0 && P.pos.y < 0.1 && r.clean, `ends ${fix(P.pos.x, 1)},${fix(P.pos.y)},${fix(P.pos.z, 1)}${cl(r)}`); }
  { const p0 = S.P[0]; go(p0.x, 8, p0.z + 2, Math.PI, 5); const r = ride(10, follow(S, 1));
    say('south causeway: off the plateau, over the lagoon, onto Orbital\'s north quay', P.pos.x < 125 && Math.abs(P.pos.y - 4) < 0.1 && r.clean, `ends ${fix(P.pos.x, 1)},${fix(P.pos.y)},${fix(P.pos.z, 1)}${cl(r)}`); }
  { const e = S.P[S.P.length - 1]; go(e.x - 3, 4, e.z - 2, Math.atan2(S.P[S.P.length - 6].x - e.x, S.P[S.P.length - 6].z - e.z), 5); const r = ride(10, follow(S, -1));
    say('south causeway: from the quay, up onto Neon Shores', P.pos.z > -100 && Math.abs(P.pos.y - 8) < 0.1 && r.clean, `ends ${fix(P.pos.x, 1)},${fix(P.pos.y)},${fix(P.pos.z, 1)}${cl(r)}`); }
  { const bad = []; for (const n of ['north causeway', 'south causeway']) { P.mel = null; rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('both causeway ➤ stops stand her on a floor', !bad.length, bad.join('; ') || 'both'); }
  // and a wall: square at the parapet half way over, she stays on the bridge
  { const m = N.P[Math.floor(N.P.length * 0.7)]; go(m.x, m.y, m.z, 0, 8); const r = ride(2, () => { rg.stick.L.x = rg.stick.L.y = 0; });
    say('north causeway: its parapet holds her over the water', Math.abs(P.pos.y - m.y) < 0.3 && r.clean, `ends y ${fix(P.pos.y)}, ${fix(Math.abs(P.pos.z - m.z), 2)} m off the centre${cl(r)}`); }
  return ok;
};
// r96: THE HEIGHTS -- the skyscraper district: towers, docks, the two-deck sky line and its trains, the lifts, the air base
// r100: THE STACK -- his buildings, each a step taller, a half pipe on every roof. Every link ridden through the shipped step:
// the street pad onto the first roof, each roof's transfer (pump until the lip speed is there, then the swipe up) onto the
// next, a weak transfer falling back onto its own roof rather than off the building, the summit pad and the helix, the bowl,
// the plunge west off the summit with a held push, both down rails -- and his art loaded through the real loader, every
// roof collider checked against the roof in the file.
// r101: THE SKY RAIL -- one booster rail round the whole world, 60 to 91 m up. Its numbers (length, grade, pylons), nothing
// solid on the line but the places it is meant to run along, a lap hands-off past all four stations, getting ON at each
// (the swipe down) and OFF at each (a tap pops her onto the deck), both lifts from the street, and a train knocking her off.
// r102: THE MOTHERSHIP -- the beam up from the street onto its porch, the dish ridden, rolled off the porch into the beam and
// let down 120 m with no bail, the rim ring ground, and a scout saucer's beam lifting her onto its back and carrying her.
// r103: THE WORKS -- in through the door, up the bank to the mezzanine, off its kicker through a window onto the annex, the
// rafters caught from the mezzanine and ridden off the end through a window, a pane that is a wall when met slowly, the hall's
// quarter pipe launching her up among the rafters, the annex's bank back down, and the panes coming back.
// r104: THE DRAIN -- in off the street through the mouth and along the channel under the tunnel roof, dropped in off the
// plateau, the half pipe pumped, up the bank onto the plateau, down the branch into its half bowl, and the tunnel's roof a
// ceiling (a vert air under it does not come out through the top).
CASES.blend = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const B = rg.BLEND; if (!B.dressed) { console.log('  the seams were not dressed'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT);
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; rg.GRIND.intent = 0; };
  // the shader: what detailPatch splices in, run against a stand-in of three's chunks -- the uniforms are bound and the
  // ground blend is in the fragment shader (a GL compile is not possible here; `glslangValidator` passed it offline)
  { const m = rg.detailPatch(new THREE.MeshStandardMaterial()), sh = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: 'void main(){\n#include <map_fragment>\n#include <normal_fragment_maps>\n}' };
    m.onBeforeCompile(sh, {}); const f = sh.fragmentShader, open = (f.match(/\{/g) || []).length, close = (f.match(/\}/g) || []).length;
    say(`the ground blend: ${B.d.length} districts in the detail shader`, sh.uniforms.bD && sh.uniforms.bD.value.length === 16 && /uniform vec4 bD\[16\]/.test(f) && /bC\[i\] \* w_/.test(f) && open === close && rg.blendW(0, 0).length === B.d.length,
      `${open} { against ${close} }, strength ${B.k}`); }
  // the weights are each district's own at its centre: the gradient has its peaks where the districts are
  { const bad = B.d.filter((q, i) => { const w = rg.blendW(q.x, q.z); return w.indexOf(Math.max(...w)) !== i; }); say('each district is its own colour at its centre', !bad.length, bad.map(q => q.key).join(', ') || `${B.d.length} of ${B.d.length}`); }
  { const c = {}; for (const p of B.placed) c[p[2]] = (c[p[2]] || 0) + 1;
    say(`${B.placed.length} props in the seams, ${B.spotList.length} seam spots`, B.placed.length > 100 && B.spotList.length >= 4 && Object.keys(c).length >= 5, JSON.stringify(c)); }
  // nothing dressed where a stop or a pad stands, or on the steer run
  { const bad = []; for (const [x, z] of [...B.placed, ...B.spotList.map(s => [s.x, s.z])]) { for (const [n, sp] of Object.entries(rg.CITY.spots)) if (Math.hypot(x - sp[0], z - sp[2]) < B.keep - 6) bad.push(`${n} ${fix(Math.hypot(x - sp[0], z - sp[2]), 1)} m`);
      for (const L of rg.ORB.launch) if (Math.hypot(x - L.x, z - L.z) < 10) bad.push(`pad ${L.name || ''}`); }
    say('nothing dressed on a ➤ stop or a launch pad', !bad.length, bad.slice(0, 4).join('; ') || 'clear'); }
  // every seam spot skates: through it along its own axis, over the funbox, past the ledge and the bar
  { const bad = []; for (const S of B.spotList) for (const lane of [0, 11]) { reset(); const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), rx = Math.cos(S.yaw), rz = -Math.sin(S.yaw);
      place(S.x - fx * 14 + rx * lane, 0.3, S.z - fz * 14 + rz * lane, S.yaw, 10); let air = 0;     // (the spot is checked open 18 m round its middle)
      const r = { bail: 0, deep: 0 }; let kq = 0; run(4, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (process.env.BT && S === B.spotList[0] && kq++ % 6 === 0) console.log('    ', fix((P.pos.x - S.x) * fx + (P.pos.z - S.z) * fz, 2), fix(P.pos.y, 2), P.grounded ? 'G' : 'a', fix(P.speed, 1)); if (P.bailT > 0) r.bail = 1; if (!P.grounded) air = 1;
        const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 1.5, 0); if (q.hit && !P.grind && q.floor - P.pos.y < 1.5) r.deep = Math.max(r.deep, q.floor - P.pos.y); });
      const past = (P.pos.x - S.x) * fx + (P.pos.z - S.z) * fz; if (r.bail || r.deep > 0.12 || past < 2) bad.push(`${S.key}@${fix(S.x, 0)},${fix(S.z, 0)} ${lane ? 'kicker' : 'funbox'}: ${r.bail ? 'BAIL ' : ''}${r.deep > 0.12 ? 'INSIDE ' + fix(r.deep) + ' ' : ''}past ${fix(past, 1)}`); }
    say('every seam spot rolls through: over the funbox, off the kicker', !bad.length, bad.join('; ') || `${B.spotList.length} spots, both lanes`); }
  return ok;
};
// r114: THE CANNONS -- every pad, rolled onto from its stop: thrown, and down on the other district's deck.
CASES.cannons = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const C = rg.CANNON; if (!C.built) { console.log('  no cannons'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT);
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; P.beamOff = 0; rg.GRIND.intent = 0; };
  say(`${C.made.length} cannons`, C.made.length === C.list.length, C.made.map(m => `${m.name} -> ${m.to}`).join('; '));
  for (const m of C.made) { reset(); m.L.cool = 0; rg.goSpot(m.name); const sp = P.pos.clone(); place(sp.x, 0.3, sp.z, rg.CITY.spots[m.name][3], 3); P.pos.y = 0;
    let up = 0, land = null, top = 0, bail = 0;
    run(14, () => { if (land) return; rg.stick.L.x = rg.stick.L.y = 0; city(); if (!P.grounded) up = 1; top = Math.max(top, P.pos.y); if (P.bailT > 0) bail = 1;
      if (up && P.grounded && !land) land = P.pos.clone(); });
    let stay = null; if (land) { run(3, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); stay = P.pos.clone(); }
    const there = land && Math.abs(land.y - (m.ty - 0.6)) < 0.35 && Math.hypot(land.x - m.tx, land.z - m.tz) < 10;
    const kept = stay && stay.y > m.ty - 3;     // still up there (a lane may carry her along it, a bowl round it)
    say(`${m.name}: thrown onto the ${m.to}, and stays on it`, there && !bail && kept, `${up ? 'thrown' : 'NEVER THROWN'} (${m.L.clear === 'lift' ? 'a lift' : m.L.clear === -1 ? 'NO CLEAR ARC' : '+' + m.L.clear + ' m'}), top ${fix(top, 1)}, ${land ? 'down at ' + at(land) : 'never down'}, 3 s later ${stay ? at(stay) : '-'}${bail ? ' BAIL' : ''}`); }
  return ok;
};
// r113: THE AIR -- standing in a district for a while, the fog, the sky light and the rim lamp come round to its colour;
// back at the hub they go back; with it off they are the plain sky's.
CASES.atmo = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const A = rg.ATMO, B = rg.BLEND; if (!A || !rg.scene.fog) { console.log('  no air'); return false; }
  const hex = c => '#' + c.getHexString(), dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  const settle = (x, z, sec = 8) => { const t = { x, y: 2, z }; for (let i = 0; i < sec * 30; i++) rg.stepAtmo(1 / 30, t); };
  settle(0, 8); const base = A.base.fog.clone();
  const rows = []; let worse = 0;
  for (const key of ['acro', 'stack', 'pyramids', 'orbital', 'works']) { const q = B.d.find(d => d.key === key); if (!q) continue; settle(q.x, q.z);
    const c = new THREE.Color(q.col), f = rg.scene.fog.color.clone(); if (dist(f, c) >= dist(base, c) - 0.01) worse++; rows.push(`${key} ${hex(f)}`); }
  say('in each district the fog comes round toward its colour', !worse && rows.length === 5, rows.join(', '));
  { const q = B.d.find(d => d.key === 'stack'); settle(q.x, q.z); const r0 = rg.rimLight.color.clone(); settle(-215, 150); const r1 = rg.rimLight.color.clone();
    say('the rim lamp takes the district\'s hue', dist(r0, r1) > 0.05, `stack ${hex(r0)}, acropolis ${hex(r1)}`); }
  { A.on = 0; settle(160, 250, 1); const off = rg.scene.fog.color.clone(); A.on = 1; settle(0, 8);
    say('switched off, the fog is the plain sky\'s', dist(off, A.base.fog) < 1e-6, `${hex(off)} against ${hex(A.base.fog)}`); }
  { const t0 = rg.scene.fog.color.clone(); const q = B.d.find(d => d.key === 'pyramids'); rg.stepAtmo(1 / 60, { x: q.x, y: 2, z: q.z }); const t1 = rg.scene.fog.color.clone();
    say('it eases: one frame moves it a little, not all the way', dist(t0, t1) > 0 && dist(t0, t1) < 0.02, `one frame moved it ${dist(t0, t1).toFixed(4)}`); }
  return ok;
};
// r112: THE NORTHWAY -- its deck clear and continuous, both ways end to end (the sky agora to the Great Pyramid's top and
// back), the express lanes, UP the interchange from the street onto the highway and DOWN it again, the stops, a parapet grind.
CASES.northway = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const N = rg.NW; if (!N.built) { console.log('  the northway was not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT), H = N.helix, G = rg.PYR.ps[0], I = rg.ACR.IS;
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; P.beamOff = 0; rg.GRIND.intent = 0; };
  // steers down a deck's own line (offset `off` across it: a lane), looking further ahead the faster she goes
  const follow = (D, dir, off = 0) => { const pts = D.P.map((p, i) => [p.x + D.R[i][0] * off, p.z + D.R[i][1] * off]); if (dir < 0) pts.reverse(); return () => { let bi = 0, bd = 1e9;
      for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - P.pos.x, pts[i][1] - P.pos.z); if (d < bd) { bd = d; bi = i; } }
      const la = Math.round(4 + P.speed * 0.6), t = pts[Math.min(pts.length - 1, bi + la)], e = pts[pts.length - 1], tx = bi + la >= pts.length ? e[0] + (e[0] - pts[pts.length - 2][0]) * 4 : t[0], tz = bi + la >= pts.length ? e[1] + (e[1] - pts[pts.length - 2][1]) * 4 : t[1];
      const h = Math.atan2(tx - P.pos.x, tz - P.pos.z); rg.cam.az = h; rg.cam.steerAz = h; rg.stick.L.x = 0; rg.stick.L.y = P.speed < 9 ? -1 : 0; }; };
  const ride = (sec, drive, stop) => { const r = { bail: 0, deep: 0, low: 999 }; let kq = 0, done = 0; run(sec, (t, i) => { if (done) return; if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (process.env.NT && kq++ % (+process.env.NT) === 0) console.log('    ', at(P.pos), P.grounded ? 'G' : 'a', P.onLane || '', fix(P.speed, 1));
      if (P.bailT > 0) r.bail = 1; r.low = Math.min(r.low, P.pos.y);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 1.5, 0); if (q.hit && !P.grind && q.floor - P.pos.y < 1.5) r.deep = Math.max(r.deep, q.floor - P.pos.y); if (stop && stop()) done = 1; }); r.clean = !r.bail && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const len = D => D.P.reduce((a, p, i) => i ? a + p.distanceTo(D.P[i - 1]) : 0, 0);
  say(`${fix(len(N.main), 0)} m of highway, a ${fix(len(N.hx), 0)} m interchange, ${rg.ORB.lanes.filter(l => /northway|interchange/.test(l.name)).length} lanes`, len(N.main) > 350 && rg.ORB.lanes.filter(l => /northway|interchange/.test(l.name)).length === 3, `from ${at(N.main.P[0])} to ${at(N.main.P[N.main.P.length - 1])}`);
  // the deck: a floor at its own height all along, nothing solid across it but its parapets
  { let gaps = 0, worst = 0; const bad = new Map();
    for (const D of [N.main, N.hx]) D.P.forEach((p, i) => { for (const o of [-1.9, 0, 1.9]) { const x = p.x + D.R[i][0] * o, z = p.z + D.R[i][1] * o, g = rg.groundAt(x, z, p.y + 0.4, 0);
      if (!g.hit || Math.abs(g.floor - p.y) > 0.08) { gaps++; worst = Math.max(worst, g.hit ? Math.abs(g.floor - p.y) : 99); } for (const dy of [0.5, 1.5]) { const b = rg.solidAt(x, p.y + dy, z, 0.3); if (b && b.tag !== 'interchange end') bad.set(b.tag, at(p)); } } });     // (the stub's end wall is meant to be there)
    say('the deck is a floor all along, nothing standing on it', !gaps && !bad.size, `${gaps} gaps (worst ${fix(worst)}); ${[...bad].map(([k, v]) => k + ' at ' + v).join('; ') || 'clear'}`); }
  { const bad = []; for (const n of N.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every Northway ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${N.stops.length} stops`); }
  // EAST: off the sky agora's north edge, the whole way, onto the Great Pyramid's top
  { reset(); place(N.main.P[0].x, I.y + 0.3, N.main.P[0].z - 8, 0, 6); P.pos.y = I.y; let top = null;
    const r = ride(60, follow(N.main, 1, 1.9), () => { if (!top && P.grounded && P.pos.y > G.h - 0.3 && Math.abs(P.pos.x - G.x) < G.t + 0.5 && Math.abs(P.pos.z - G.z) < G.t + 0.5) top = P.pos.clone(); return top; });     // (at 18 m/s she is across the 10 m top in half a second)
    say('east: the sky agora to the top of the Great Pyramid', top && r.clean && r.low > G.h - 0.5, top ? `on the top at ${at(top)}, lowest ${fix(r.low)}${cl(r)}` : `ends ${at(P.pos)}, lowest ${fix(r.low)}${cl(r)}`); }
  // WEST: off the pyramid's top, back the whole way to the sky agora
  { reset(); place(G.x, G.h + 0.3, G.z, 0, 5); P.pos.y = G.h; let home = null;
    const r = ride(60, follow(N.main, -1, -1.9), () => { if (!home && P.grounded && Math.abs(P.pos.y - I.y) < 0.15 && P.pos.z < N.main.P[0].z - 1) home = P.pos.clone(); return home; });
    say('west: the pyramid\'s top back to the sky agora', home && r.clean && r.low > G.h - 0.5, home ? `on the sky agora at ${at(home)}, lowest ${fix(r.low)}${cl(r)}` : `ends ${at(P.pos)}, lowest ${fix(r.low)}${cl(r)}`); }
  // the express lanes: hands off, each carries her up to speed its way
  for (const [nm, pts] of [['northway east', N.east], ['northway west', N.west]]) { reset(); const k = Math.floor(pts.length * 0.3), a = pts[k], b = pts[k + 2];
    place(a.x, a.y + 0.3, a.z, Math.atan2(b.x - a.x, b.z - a.z), 2); P.pos.y = a.y; let hi = 0, onl = 0;
    const r = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; hi = Math.max(hi, P.speed); if (P.onLane === nm) onl = 1; });
    say(`hands off on the ${nm} lane: carried up to speed`, onl && hi > 15 && r.clean, `peak ${fix(hi, 1)} m/s, ends ${at(P.pos)}${cl(r)}`); }
  // UP the interchange from the street, onto the highway
  { reset(); rg.goSpot('interchange'); P.vel.set(0, 0, 0); place(P.pos.x, P.pos.y + 0.3, P.pos.z, -Math.PI / 2, 4); P.pos.y = 0.02; let up = null;
    const r = ride(40, follow(N.hx, -1), () => { if (!up && P.grounded && P.pos.y > N.hx.P[0].y - 0.4 && Math.abs(P.pos.x - (H.x - H.merge)) < 6) up = P.pos.clone(); return up; });
    say('up the interchange from the street onto the highway', up && r.clean, up ? `on the highway at ${at(up)}` : `ends ${at(P.pos)}${cl(r)}`); }
  // DOWN it from the highway to the street
  { reset(); const a = N.hx.P[2], b = N.hx.P[6]; place(a.x, a.y + 0.3, a.z, Math.atan2(b.x - a.x, b.z - a.z), 5); P.pos.y = a.y; let down = null, air = 0;
    const r = ride(40, () => { follow(N.hx, 1)(); if (!P.grounded) air += DT; }, () => { if (!down && P.grounded && P.pos.y < 0.2) down = P.pos.clone(); return down; });
    const zc = N.hx.P[N.hx.P.length - 1].z;
    say('down the interchange from the highway to the street', down && r.clean && air < 0.8 && Math.hypot(down.x - H.x, down.z - zc) < 14, down ? `down at ${at(down)}, ${fix(air, 2)} s in the air on the way` : `ends ${at(P.pos)}${cl(r)}`); }
  return ok;
};
// r111: THE HIGH WIRES -- every wire that was strung: each end over its deck, and ridden BOTH ways, on with a swipe down off the
// deck and hands off from there, down on the deck at the other end.
CASES.wires = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const W = rg.WIRE; if (!W.built) { console.log('  no wire was strung'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT);
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; P.beamOff = 0; rg.GRIND.intent = 0; };
  const ride = (sec, drive, stop) => { const r = { bail: 0, deep: 0, vmax: 0 }; let kq = 0, done = 0; run(sec, (t, i) => { if (done) return; if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (process.env.WT && kq++ % (+process.env.WT) === 0) console.log('    ', at(P.pos), P.grounded ? 'G' : 'a', P.grind ? 'GR ' + P.grind.rail.path.name : '', fix(P.speed, 1));
      if (P.bailT > 0) r.bail = 1; r.vmax = Math.max(r.vmax, P.speed);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 1.5, 0); if (q.hit && !P.grind && q.floor - P.pos.y < 1.5) r.deep = Math.max(r.deep, q.floor - P.pos.y); if (stop && stop()) done = 1; }); r.clean = !r.bail && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  console.log(`  strung: ${W.made.map(m => `${m.a} - ${m.b} ${fix(m.L, 0)} m`).join('; ')}${W.skipped.length ? '\n  left out: ' + W.skipped.join('; ') : ''}`);
  say(`${W.made.length} wires strung between districts' decks`, W.made.length >= 3, `${W.skipped.length} left out (each one says why)`);
  { const bad = []; for (const m of W.made) for (const e of (m.rail ? [m.eb] : [m.ea, m.eb])) { const g = rg.groundAt(e.x, e.z, e.y, 0); if (!g.hit || Math.abs(e.y - 0.95 - g.floor) > 0.05) bad.push(`${m.a} - ${m.b} at ${fix(e.x, 0)},${fix(e.z, 0)}`); }
    say('every wire ends over a deck, 0.95 m up', !bad.length, bad.join('; ') || `${W.made.length * 2} ends`); }
  for (const m of W.made) for (const [e, f, nm] of (m.rail ? [[m.eb, m.ea, m.a]] : [[m.ea, m.eb, m.b], [m.eb, m.ea, m.a]])) {
    reset(); const h = Math.atan2(f.x - e.x, f.z - e.z); place(e.x - Math.sin(h) * 1.5, e.y - 0.95 + 0.3, e.z - Math.cos(h) * 1.5, h, 3); P.pos.y = e.y - 0.95;
    rg.GRIND.intent = 1; rg.ledgeClear(); run(0.15, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); rg.rightFlick(0, 60);
    let on = 0, land = null, merged = 0; const r = ride(40, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && P.grind.rail.path === m.path) on = 1;
      if (on && m.rail && P.grind && P.grind.rail.path.name === m.rail && !land) { merged = 1; land = P.pos.clone(); }
      if (on && !P.grind && P.grounded && !land) land = P.pos.clone(); }, () => land || (on && !P.grind && P.pos.y < Math.min(e.y, f.y) - 8));
    const there = land && (f === m.ea && m.rail ? merged : Math.hypot(land.x - f.x, land.z - f.z) < 14 && Math.abs(land.y - (f.y - 0.95)) < 0.3);
    if (process.env.WSTAY && land) { run(4, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); console.log(`      4 s later: ${at(P.pos)}`); }
    say(`along the wire to ${nm}`, on && there && r.clean, `${on ? 'on it' : 'NEVER ON IT'}, ${land ? 'down at ' + at(land) + (there ? '' : ' (NOT the deck)') : 'never down -- ends ' + at(P.pos)}, fastest ${fix(r.vmax, 1)}${cl(r)}`); }
  // r113: a wire off a rail -- grinding that rail toward the branch point, the stick toward the wire takes it; hands off, not
  for (const m of W.made.filter(q => q.rail)) for (const stick of [true, false]) {
    reset(); const K = rg.RAILS.filter(q => q.path && q.path.name === m.rail), J = m.ea, wx = m.eb.x - J.x, wz = m.eb.z - J.z, wl = Math.hypot(wx, wz);
    // a segment ~30 m back from J, ridden so that she arrives travelling the way the wire leaves
    let q0 = null, bd = 1e9; for (const q of K) { const d = Math.abs(Math.hypot(q.a.x - J.x, q.a.z - J.z) - 30), ahead = ((J.x - q.a.x) * wx + (J.z - q.a.z) * wz) / wl; if (ahead > 20 && d < bd) { bd = d; q0 = q; } }
    if (!q0) { say(`off the ${m.rail} onto the ${m.a} - ${m.b} wire`, false, 'no rail behind the branch'); continue; }
    const fw = (q0.b.x - q0.a.x) * wx + (q0.b.z - q0.a.z) * wz > 0, s0 = fw ? q0.a : q0.b, s1 = fw ? q0.b : q0.a, h = Math.atan2(s1.x - s0.x, s1.z - s0.z);
    rg.HT.trains.filter(tr => tr.path === q0.path).forEach((tr, i) => tr.s = tr.path.len * (0.25 + 0.5 * i));
    place(s0.x, s0.y + 0.4, s0.z, h, 16); P.pos.set(s0.x, s0.y + 0.4, s0.z); P.grounded = false; P.vel.y = -1;
    const side = Math.sign(Math.sin(h) * wz - Math.cos(h) * wx) || 1;     // the wire leaves to her right (+1) or left
    let took = 0, land = null, past = 0;
    const r = ride(30, () => { if (stick && P.grind) { rg.cam.az = Math.atan2(P.grind.rail.d.x * P.grind.dir, P.grind.rail.d.z * P.grind.dir) - side * Math.PI / 2; rg.stick.L.x = 0; rg.stick.L.y = -1; } else rg.stick.L.x = rg.stick.L.y = 0;     // square out to its side: the branch is only ~18 deg off the rail
      if (P.grind && P.grind.rail.path === m.path) took = 1; if (!took && P.grind && P.grind.rail.path === q0.path && Math.hypot(P.pos.x - J.x, P.pos.z - J.z) > 25 && ((P.pos.x - J.x) * wx + (P.pos.z - J.z) * wz) > 0) past = 1;
      if (took && !P.grind && P.grounded && !land) land = P.pos.clone(); }, () => land || past);
    const there = land && Math.hypot(land.x - m.eb.x, land.z - m.eb.z) < 14;
    if (stick) say(`off the ${m.rail}, stick out: onto the wire to ${m.b}`, took && there && r.clean, `${took ? 'on the wire' : 'NEVER TOOK IT'}, ${land ? 'down at ' + at(land) : 'never down -- ends ' + at(P.pos)}${cl(r)}`);
    else say(`hands off, she carries on along the ${m.rail}`, !took && past, took ? 'TOOK THE WIRE' : past ? 'carried on' : `ends ${at(P.pos)}`); }
  return ok;
};
// r110: THE STATION -- the deck at 210 m: the corkscrew joined to the sky rail, its line clear of the mothership and everything
// else, the stop, the parapet holding her in, UP the corkscrew off the sky rail with the stick (and hands off she carries on
// past it), DOWN it from the deck onto the sky rail, the bowl, the parapet's grind ring.
CASES.station = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const S = rg.STN; if (!S.built || !S.corkRail) { console.log('  the station was not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT), K = rg.SKR, U = rg.UFO, g = S.g;
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; P.beamOff = 0; rg.GRIND.intent = 0; };
  const away = () => { const Tr = rg.HT.trains.filter(tr => tr.path === K.path); Tr.forEach((tr, i) => tr.s = K.path.len * (0.15 + 0.5 * i)); };
  const ride = (sec, drive, stop) => { const r = { bail: 0, deep: 0, top: -99, vmax: 0 }; let kq = 0, done = 0; run(sec, (t, i) => { if (done) return; if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (process.env.ST && kq++ % (+process.env.ST) === 0) console.log('    ', at(P.pos), P.grounded ? 'G' : 'a', P.grind ? 'GR ' + P.grind.rail.path.name : '', fix(P.speed, 1));
      if (P.bailT > 0) r.bail = 1; r.top = Math.max(r.top, P.pos.y); r.vmax = Math.max(r.vmax, P.speed);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 1.5, 0); if (q.hit && !P.grind && q.floor - P.pos.y < 1.5) r.deep = Math.max(r.deep, q.floor - P.pos.y); if (stop && stop()) done = 1; }); r.clean = !r.bail && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const segs = S.corkRail.segs, len = segs.reduce((a, q) => a + q.len, 0), p0 = segs[0].a;
  let dSky = 1e9; for (const q of K.path.segs) { const dx = q.b.x - q.a.x, dz = q.b.z - q.a.z, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((p0.x - q.a.x) * dx + (p0.z - q.a.z) * dz) / l2)); dSky = Math.min(dSky, Math.hypot(q.a.x + dx * t - p0.x, q.a.y + (q.b.y - q.a.y) * t - p0.y, q.a.z + dz * t - p0.z)); }
  say(`deck r ${S.r} at ${S.y} m; corkscrew ${fix(len, 0)} m, ${fix(g.sweep / 2 / Math.PI, 2)} turns, R ${fix(g.R, 1)}`, dSky < 0.1 && S.gap && segs[segs.length - 1].b.y > S.y, `starts ${fix(dSky, 3)} m from the sky rail, gap ${S.gap ? 'cut' : 'NONE'}, ends at ${at(segs[segs.length - 1].b)}`);
  // its line: nothing solid on it, and round the mothership's dish with room to spare
  { const bad = new Map(); let ship = 1e9; for (const q of segs) { for (const dy of [0.5, 1.2, 2.0]) { const b = rg.solidAt(q.a.x, q.a.y + dy, q.a.z, 0.2); if (b && !/^station/.test(b.tag)) bad.set(b.tag, at(q.a)); }
      if (Math.abs(q.a.y - U.y) < 12) ship = Math.min(ship, Math.hypot(q.a.x - U.x, q.a.z - U.z) - U.R); }
    say('nothing solid on the corkscrew, and it clears the mothership', !bad.size && ship > 8, `${[...bad].map(([k, v]) => `${k} at ${v}`).join('; ') || 'clear'}, ${fix(ship, 1)} m off the dish at its height`); }
  { const bad = []; for (const n of S.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('the Station ➤ stop stands her on the deck', !bad.length, bad.join('; ') || `${S.stops.length} stop`); }
  // the parapet holds her in (rolled at it away from the gap)
  { reset(); const A = S.gap ? (S.gap[0] + S.gap[1]) / 2 + Math.PI : 0; place(S.x + 8 * Math.sin(A), S.y + 0.3, S.z + 8 * Math.cos(A), A, 8);
    const r = ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; }); const d = Math.hypot(P.pos.x - S.x, P.pos.z - S.z);
    say('the parapet holds her on the deck', d < S.r && Math.abs(P.pos.y - S.y) < 0.3 && r.clean, `ends ${fix(d, 1)} m out at ${at(P.pos)}${cl(r)}`); }
  // UP: grinding the sky rail toward J, the stick toward the branch takes the corkscrew and the booster climbs her onto the deck
  const J = g.J, ri = (() => { let b = 0, bd = 1e9; K.path.segs.forEach((q, i) => { const d = Math.hypot(q.a.x - J.x, q.a.z - J.z); if (d < bd) { bd = d; b = i; } }); return b; })();
  const sky = (stick) => { away(); reset(); const q = K.path.segs[(ri - 30 + K.path.segs.length) % K.path.segs.length], h = Math.atan2(q.b.x - q.a.x, q.b.z - q.a.z);
    place(q.a.x, q.a.y + 0.4, q.a.z, h, 18); P.pos.set(q.a.x, q.a.y + 0.4, q.a.z); P.grounded = false; P.vel.y = -1;
    let on = 0, deck = null, past = 0;
    const r = ride(60, () => { if (stick && P.grind) { rg.cam.az = Math.atan2(P.grind.rail.d.x * P.grind.dir, P.grind.rail.d.z * P.grind.dir) - g.side * 75 * Math.PI / 180; rg.stick.L.x = 0; rg.stick.L.y = -1; } else rg.stick.L.x = rg.stick.L.y = 0;
      if (P.grind && P.grind.rail.path === S.corkRail) on = 1; if (!on && P.grind && P.grind.rail.path === K.path && Math.hypot(P.pos.x - J.x, P.pos.z - J.z) > 30 && Math.hypot(P.pos.x - q.a.x, P.pos.z - q.a.z) > 40) past = 1;
      if (on && !deck && P.grounded && !P.grind && Math.abs(P.pos.y - S.y) < 0.3) deck = P.pos.clone(); if (on && !P.grind && P.pos.y < S.y - 5 && !P.grounded) on = 2; }, () => deck || past || on === 2);
    return { r, on, deck, past }; };
  { const o = sky(true); say('off the sky rail, stick out: UP the corkscrew onto the station', o.on === 1 && o.deck && o.r.clean, `${o.on ? 'on the corkscrew' : 'NEVER TOOK IT'}${o.on === 2 ? ' and FELL OFF it' : ''}, ${o.deck ? 'on the deck at ' + at(o.deck) : 'never on the deck -- ends ' + at(P.pos) + ', top ' + fix(o.r.top)}${cl(o.r)}`); }
  { const o = sky(false); say('hands off, she carries straight on along the sky rail', !o.on && o.past, o.on ? 'TOOK THE CORKSCREW' : o.past ? 'carried on' : `ends ${at(P.pos)}`); }
  // DOWN: from its end on the deck, a swipe down onto it, all the way round and onto the sky rail
  { away(); reset(); const e = segs[segs.length - 1], h = Math.atan2(e.a.x - e.b.x, e.a.z - e.b.z); place(e.b.x - Math.sin(h) * 1.5, S.y + 0.3, e.b.z - Math.cos(h) * 1.5, h, 4); P.pos.y = S.y;
    rg.GRIND.intent = 1; rg.ledgeClear(); run(0.15, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); rg.rightFlick(0, 60);
    let on = 0, skyAt = null, tOn = 0;
    const r = ride(80, (t) => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && P.grind.rail.path === S.corkRail) { if (!on) tOn = t; on = 1; } if (on && P.grind && P.grind.rail.path === K.path && !skyAt) skyAt = [t - tOn, P.pos.clone()]; }, () => skyAt || (on && !P.grind && P.pos.y < S.y - 20));
    say('the swipe down onto the corkscrew: 135 m down onto the sky rail', on && skyAt && r.clean, `${on ? 'on it' : 'NEVER ON IT'}, ${skyAt ? 'on the sky rail after ' + fix(skyAt[0], 1) + ' s at ' + at(skyAt[1]) + ', fastest ' + fix(r.vmax, 1) : 'never on the sky rail -- ends ' + at(P.pos)}${cl(r)}`); }
  // the bowl and the parapet's ring
  { reset(); place(S.x - 7, S.y + 0.3, S.z, Math.PI / 2, 9); let hi = 0, side = 0, sw = 0;
    const r = ride(6, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.pos.y > S.y - 2) { const sd = Math.sign(P.pos.x - S.x); if (sd !== side && Math.abs(P.pos.x - S.x) > 4) { sw++; side = sd; } hi = Math.max(hi, P.pos.y - S.y); } });
    say('the station bowl: across it wall to wall', sw >= 2 && r.clean && P.pos.y > S.y - 5, `${sw} walls, highest ${fix(hi)} over the deck, ends ${at(P.pos)}${cl(r)}`); }
  { reset(); const R = S.rims.reduce((m, q) => q.segs.length > m.segs.length ? q : m), q = R.segs[5], h = Math.atan2(q.b.x - q.a.x, q.b.z - q.a.z);
    place(q.a.x, q.a.y + 0.4, q.a.z, h, 7); P.pos.set(q.a.x, q.a.y + 0.4, q.a.z); P.grounded = false; P.vel.y = -1; let d = 0;
    run(5, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grind && S.rims.includes(P.grind.rail.path)) d += P.speed * DT; });
    say('the parapet\'s grind ring', d > 15, `${fix(d, 0)} m on it`); }
  return ok;
};
// r109: THE CROSSTOWN -- the line clear of everything, the three platforms, boarding at the middle (from the side) and at
// the east end (along it) and being carried off, a moving tram knocking a skater off the track, both express lanes.
CASES.tram = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const T = rg.TRAM; if (!T.built) { console.log('  the tram was not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT);
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; rg.GRIND.intent = 0; T.cool = 0; };
  const ride = (sec, drive, stop) => { const r = { bail: 0, deep: 0 }; let kq = 0, done = 0; run(sec, (t, i) => { if (done) return; if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (process.env.TT && kq++ % (+process.env.TT) === 0) console.log('    ', at(P.pos), P.grounded ? 'G' : 'a', P.onLane || '', fix(P.speed, 1), 'v', fix(P.vel.x, 2), fix(P.vel.y, 2), fix(P.vel.z, 2), 'tram s', fix(rg.tramS(rg.HT.t), 1), P.onDyn ? P.onDyn.kind : '');
      if (P.bailT > 0) r.bail = 1; const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 1.5, 0); if (q.hit && !P.grind && q.floor - P.pos.y < 1.5) r.deep = Math.max(r.deep, q.floor - P.pos.y); if (stop && stop()) done = 1; }); r.clean = !r.bail && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const onPod = (m = 0) => T.list.some(D => Math.hypot(P.pos.x - D.x, P.pos.z - D.z) < D.cr + 0.05 - m) && Math.abs(P.pos.y - T.roof) < 0.25 && P.grounded;
  const when = s => { for (let t = 0; t < T.cycle; t += 0.05) if (Math.abs(rg.tramS(t) - s) < 1e-6) return t; return -1; };     // the first moment of a dwell
  say(`${T.cars} cars (${T.list.length} floor discs) on ${fix(T.L, 0)} m of line, a ${fix(T.cycle, 0)} s round trip`, T.list.length === T.cars * (T.discs + 1) - 1 && T.carM.length === T.cars && T.L > 300 && T.legs.length === 4,
    `stops at s ${fix(T.sA, 1)} / ${fix(T.sM, 1)} / ${fix(T.sB, 1)}`);
  // the bed and the lanes: nothing solid on them, no raised floor, none of it in the lagoon, clear of the Mothership's beam
  { const bad = new Map(), U = rg.UFO, lanes = rg.ORB.lanes.filter(l => /crosstown/.test(l.name)); let wet = 0, nb = 1e9;
    for (let s = 0; s < T.L; s += 2) { const q = rg.tramAt(s); for (const w of [-2.2, 0, 2.2]) { const x = q.x + q.hz * w, z = q.z - q.hx * w;
      for (const y of [0.5, 2]) { const b = rg.solidAt(x, y, z, 0); if (b && !/^tram/.test(b.tag)) bad.set(b.tag, 1); } const g = rg.groundAt(x, z, 1.5, 0); if (g.floor > 0.1) bad.set(`raised ${fix(g.floor)} @${fix(x, 0)},${fix(z, 0)}`, 1); } }
    for (const l of lanes) for (const q of l.pts) for (const [ax, az] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const x = q.x + ax * l.hw, z = q.z + az * l.hw;
      if (rg.inWater(x, 0.05, z)) wet++; nb = Math.min(nb, Math.hypot(x - U.bx, z - U.bz)); for (const y of [0.5, 2]) { const b = rg.solidAt(x, y, z, 0); if (b && !/^tram/.test(b.tag)) bad.set('lane: ' + b.tag, 1); } }
    say('the line and both express lanes clear: no solid, no water, off the beam', !bad.size && !wet && nb > U.beamR + 3 && lanes.length === 4, `${[...bad.keys()].slice(0, 4).join('; ') || 'clear'}, ${wet} wet, beam ${fix(nb, 1)} m away`); }
  { const bad = []; for (const n of T.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15 || Math.abs(y0 - T.roof) > 0.05) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every tram ➤ stop is a platform at the roof\'s height', !bad.length, bad.join('; ') || `${T.stops.length} stops`); }
  // dwelling at each stop the end pods sit 0.25 m off the end platforms and the side of the train 0.25 m off the middle one
  { const tA = when(T.sA), tM = when(T.sM), tB = when(T.sB), pods = () => T.list.filter(D => D.car), top = () => Math.max(...pods().map(D => D.z + D.cr));
    rg.HT.t = tA + 1; city(); const gA = T.P[0][1] - top();
    rg.HT.t = tB + 1; city(); const gB = T.P[T.P.length - 1][1] - top();
    rg.HT.t = tM + 1; city(); const mx = pods().map(D => D.x), mid = (Math.min(...mx) + Math.max(...mx)) / 2, dm = Math.max(...pods().map(D => Math.abs(D.z + 101.5)));
    say('at each stop the train sits beside its platform', tA >= 0 && tM > tA && tB > tM && Math.abs(gA - 0.25) < 0.05 && Math.abs(gB - 0.25) < 0.05 && Math.abs(mid - T.midX) < 0.5 && dm < 0.01,
      `dwells from ${fix(tA, 1)} / ${fix(tM, 1)} / ${fix(tB, 1)} s; end gaps ${fix(gA, 2)} / ${fix(gB, 2)} m; middle centred on x ${fix(mid, 1)}`); }
  // board at the middle: roll off the platform onto the roof, stop, and be carried away when it leaves
  { reset(); const tM = when(T.sM); rg.HT.t = tM + 0.5; city(); place(T.midX + 1, T.roof + 0.1, -105.2, 0, 2.5); let on = null;
    let r = ride(4, null, () => { if (onPod(0.6)) { on = P.pos.clone(); P.vel.set(0, 0, 0); return true; } });     // stopped HERE: `run` steps on past a stop
    const r2 = on ? ride(14, () => { rg.stick.L.x = rg.stick.L.y = 0; }) : r; const still = on && onPod(), moved = on ? Math.hypot(P.pos.x - on.x, P.pos.z - on.z) : 0;
    say('boarding at the Orbital stop from the side, then carried off', on && still && moved > 25 && r.clean && r2.clean, on ? `on at ${at(on)}, carried ${fix(moved, 1)} m, ${still ? 'still on the roof' : 'OFF at ' + at(P.pos)}${cl(r2)}` : `never on -- ends ${at(P.pos)}${cl(r)}`); }
  // board at the east end, rolling straight down the platform onto the head pod
  { reset(); const tA = when(T.sA); rg.HT.t = tA + 0.5; city(); rg.goSpot('tram shores'); P.vel.set(0, 0, 0); place(P.pos.x, P.pos.y + 0.1, P.pos.z, Math.PI, 2.5); let on = null;
    const r = ride(4, null, () => { if (onPod(0.6)) { on = P.pos.clone(); P.vel.set(0, 0, 0); return true; } });     // stopped HERE: `run` steps on past a stop
    const r2 = on ? ride(14, () => { rg.stick.L.x = rg.stick.L.y = 0; }) : r; const still = on && onPod(), moved = on ? Math.hypot(P.pos.x - on.x, P.pos.z - on.z) : 0;
    say('boarding at the Shores end along the line, then carried off', on && still && moved > 25 && r.clean && r2.clean, on ? `on at ${at(on)}, carried ${fix(moved, 1)} m, ${still ? 'still on the roof' : 'OFF at ' + at(P.pos)}${cl(r2)}` : `never on -- ends ${at(P.pos)}${cl(r)}`); }
  // standing on the track ahead of a moving tram: knocked off it
  { reset(); let t0 = -1; for (let t = 0; t < T.cycle; t += 0.1) { const s0 = rg.tramS(t), q = rg.tramAt(s0); if (Math.abs(q.z + 101.5) < 0.01 && q.x < 60 && q.x > 20 && rg.tramS(t + 0.1) < s0 - 1) { t0 = t; break; } }     // heading west, at speed
    rg.HT.t = t0; city(); const s = rg.tramS(rg.HT.t), q = { ...rg.tramAt(s - T.half - 14) }; place(q.x, 0.2, q.z, Math.atan2(q.hx, q.hz), 0); const k0 = T.knocks; let air = 0;
    const r = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (!P.grounded) air = 1; });
    say('standing on the track ahead of the tram: TRAM!, knocked off it', T.knocks > k0 && air && r.clean, `${T.knocks - k0} knock${T.knocks - k0 === 1 ? '' : 's'}, ends ${at(P.pos)}${cl(r)}`); }
  // the express lanes carry her both ways
  for (const [nm, x, z, h] of [['crosstown express west', 101 + T.inner.off, -24, Math.PI], ['crosstown express east', 101 + T.outer.off, -80, 0]]) {
    reset(); place(x, 0.2, z, h, 2); let hi = 0, onl = 0; const r = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; hi = Math.max(hi, P.speed); if (P.onLane === nm) onl = 1; });
    say(`hands off on the ${nm}: carried up to speed`, onl && hi > 13 && r.clean, `peak ${fix(hi, 1)} m/s, ends ${at(P.pos)}${cl(r)}`); }
  // up the bank onto the middle platform
  { reset(); place(T.midX, 0.2, -115, 0, 10); let up = null; const r = ride(4, null, () => { if (P.grounded && Math.abs(P.pos.y - T.roof) < 0.1 && P.pos.z > -106.1) { up = P.pos.clone(); return true; } });
    say('up the bank onto the Orbital platform', up && r.clean, up ? `on it at ${at(up)}` : `ends ${at(P.pos)}${cl(r)}`); }
  return ok;
};
CASES.garage = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const G = rg.GAR; if (!G.built) { console.log('  the garage was not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT), top = G.n * G.lv;
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; rg.GRIND.intent = 0; };
  const ride = (sec, drive, stop) => { const r = { bail: 0, deep: 0, top: -99 }; let kq = 0, done = 0; run(sec, (t, i) => { if (done) return; if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (process.env.GT && kq++ % 15 === 0) console.log('    ', at(P.pos), P.grounded ? 'G' : 'a', P.grind ? 'GR ' + P.grind.rail.path.name : '', P.onLane || '', fix(P.speed, 1));
      if (P.bailT > 0) r.bail = 1; r.top = Math.max(r.top, P.pos.y);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 1.5, 0); if (q.hit && !P.grind && q.floor - P.pos.y < 1.5) r.deep = Math.max(r.deep, q.floor - P.pos.y); if (stop && stop()) done = 1; }); r.clean = !r.bail && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  say(`${G.n} decks every ${G.lv} m, ${G.ramps.length} ramps (lanes), roof ${top} m`, G.ramps.length === G.n && G.levels.length === G.n && rg.ORB.lanes.filter(L => /^garage ramp/.test(L.name)).length === G.n && G.rail, G.rail ? 'a rail onto the Table' : 'NO RAIL');
  // every deck is a floor at its height (away from the holes), and the underside clears the ramp beneath it
  { const bad = []; for (const Lv of G.levels) { const g = rg.groundAt((G.x0 + G.x1) / 2, G.z1 - 1.5, Lv.y + 0.5, 0); if (!g.hit || Math.abs(g.floor - Lv.y) > 0.05) bad.push(`deck ${Lv.j}: ${g.hit ? fix(g.floor) : '-'}`); }
    for (const R of G.ramps) for (let f = 0.05; f < 1; f += 0.1) { const z = R.zs + (R.ze - R.zs) * f, y = R.y0 + (R.y1 - R.y0) * f; for (const dy of [0.6, 1.4, 2.0]) { const b = rg.solidAt(R.x, y + dy, z, 0.25); if (b) { bad.push(`ramp ${R.i} at ${fix(z, 0)}: ${b.tag} ${fix(dy, 1)} over it`); break; } } }
    say('every deck a floor; nothing solid over a ramp at her height', !bad.length, bad.slice(0, 4).join('; ') || 'clear'); }
  { const bad = []; for (const n of G.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every Garage ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${G.stops.length} stops`); }
  // a lane carries her up a ramp with no push
  { reset(); const R = G.ramps[0]; place(R.x, 0.3, R.zs + 0.5, R.ze > R.zs ? 0 : Math.PI, 1); let up = 0;
    const r = ride(8, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && P.pos.y > R.y1 - 0.1) up = 1; }, () => up);
    say('hands off at the foot of a ramp, its lane carries her up a level', up && r.clean, up ? `up at ${at(P.pos)}` : `ends ${at(P.pos)}${cl(r)}`); }
  // the whole climb: up every ramp, across each deck's end to the next, onto the roof
  { reset(); const R0 = G.ramps[0], wp = []; for (const R of G.ramps) { wp.push([R.x, R.zs]); wp.push([R.x, R.ze + Math.sign(R.ze - R.zs) * 0.8]); }
    place(R0.x, 0.3, R0.zs - 3, 0, 4); let k = 0, roof = null, worst = 0;
    const r = ride(70, () => { const [tx, tz] = wp[Math.min(k, wp.length - 1)], dx = tx - P.pos.x, dz = tz - P.pos.z; if (Math.hypot(dx, dz) < 1.6 && k < wp.length - 1) k++;
      rg.cam.az = rg.cam.steerAz = Math.atan2(dx, dz); rg.stick.L.x = 0; rg.stick.L.y = P.grounded ? -0.55 : 0;
      const lv = Math.floor((P.pos.y + 0.5) / G.lv); worst = Math.max(worst, k / 2 - lv);
      if (P.grounded && P.pos.y > top - 0.1 && !roof) roof = P.pos.clone(); }, () => roof);
    say('the climb: up all five ramps through the building onto the roof', roof && r.clean, roof ? `on the roof at ${at(roof)}` : `ends ${at(P.pos)}, waypoint ${k}/${wp.length}${cl(r)}`); }
  // the roof bowl: dropped in, swinging wall to wall
  { reset(); const B = G.bowl, cx = (G.x0 + G.x1) / 2 - 3, cz = (G.z0 + G.z1) / 2 - 1; place(cx, top + 0.3, cz, Math.PI / 2, 9); let hi = 0, side = 0, sw = 0;
    const r = ride(8, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.pos.y > top + 1.2) { const sd = Math.sign(P.pos.x - cx); if (sd !== side) { sw++; side = sd; } hi = Math.max(hi, P.pos.y - top); } });
    void B; say('the roof bowl: rolled across it, wall to wall', sw >= 2 && r.clean && P.pos.y > top - 0.5, `${sw} walls, highest ${fix(hi)} over the roof, ends ${at(P.pos)}${cl(r)}`); }
  // the down rail off the roof onto the Table
  { reset(); const a = G.rail.segs[1].a, T = rg.PYR.ps[1]; place(a.x + 1.2, top + 0.3, a.z - 1.2, -Math.PI / 4, 3); rg.GRIND.intent = 1; rg.ledgeClear(); run(0.15, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); rg.rightFlick(0, 60);
    let on = 0, land = null; const r = ride(12, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && P.grind.rail.path === G.rail) on = 1; if (on && !P.grind && P.grounded && !land) land = P.pos.clone(); }, () => land);
    const onT = land && Math.max(Math.abs(land.x - T.x), Math.abs(land.z - T.z)) < T.B;
    say('off the roof\'s corner: the down rail onto the Table', on && onT && r.clean, `${on ? 'on the rail' : 'NEVER ON IT'}, ${land ? 'down at ' + at(land) + (onT ? ' (the Table)' : ' (NOT the Table)') : 'never down -- ends ' + at(P.pos)}${cl(r)}`); }
  return ok;
};
CASES.launch = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const L = rg.LCH; if (!L.built || !L.spiralRail) { console.log('  the launch was not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT), S = rg.SKR;
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; rg.GRIND.intent = 0; };
  const away = () => { const Tr = rg.HT.trains.filter(tr => tr.path === S.path); Tr.forEach((tr, i) => tr.s = S.path.len * (0.15 + 0.5 * i)); };
  const ride = (sec, drive, stop) => { const r = { bail: 0, deep: 0, top: -99, vmax: 0 }; let kq = 0, done = 0; run(sec, (t, i) => { if (done) return; if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (process.env.LT && kq++ % 12 === 0) console.log('    ', at(P.pos), P.grounded ? 'G' : 'a', P.grind ? 'GR ' + P.grind.rail.path.name : '', fix(P.speed, 1));
      if (P.bailT > 0) r.bail = 1; r.top = Math.max(r.top, P.pos.y); r.vmax = Math.max(r.vmax, P.speed);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 1.5, 0); if (q.hit && !P.grind && q.floor - P.pos.y < 1.5) r.deep = Math.max(r.deep, q.floor - P.pos.y); if (stop && stop()) done = 1; }); r.clean = !r.bail && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const onDeck = p => Math.abs(p.x - L.x) < L.half - 0.2 && Math.abs(p.z - L.z) < L.half - 0.2 && Math.abs(p.y - L.top) < 0.15;
  const j = L.spiralRail.segs[0].jx, drops = rg.PATHS.filter(q => q.name === 'launch drop rail');
  say(`deck at ${L.top} m, the drop ${fix(L.Lt, 0)} m, gap ${L.gap} m, spiral ${fix(L.sweep / 2 / Math.PI, 2)} turns`, drops.length === 2 && j && j.a.some(q => q.at === 'm'), j && j.a.some(q => q.at === 'm') ? 'branches off the sky rail' : 'NOT JOINED TO THE SKY RAIL');
  { const bad = []; for (const n of L.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every Launch ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${L.stops.length} stops`); }
  // the lift: on at the bottom, up, off south onto the deck
  { reset(); const D = L.liftP, Pd = D.fn(0); rg.HT.t = Math.ceil(rg.HT.t / 26 + 1) * 26 + 1; city(); place(D.x, 0.6, D.z, Math.PI, 0); let up = 0, deck = null;
    const r = ride(24, () => { if (D.y > L.top - 0.1) up = 1; rg.cam.az = Math.PI; rg.stick.L.x = 0; rg.stick.L.y = up ? -0.7 : 0; if (P.grounded && onDeck(P.pos) && !deck) deck = P.pos.clone(); }, () => deck);
    void Pd; say('the lift up the north side, off onto the deck', up && deck && r.clean, `${up ? 'up' : 'NEVER UP'}, ${deck ? 'on the deck at ' + at(deck) : 'not on the deck -- ends ' + at(P.pos)}${cl(r)}`); }
  // THE DROP: off the deck, down the bank, the kicker, over the gap onto the landing
  { reset(); place(L.x - L.half + 1.5, L.top + 0.3, L.z, -Math.PI / 2, 3); let air = null, land = null, vt = 0;
    const r = ride(12, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.pos.x < L.toe + 1 && !vt) vt = P.speed; if (P.pos.x < L.lip && !P.grounded && !air) air = P.pos.clone(); if (air && P.grounded && !land) land = P.pos.clone(); }, () => land);
    say('down the drop, off the kicker, over the gap onto the landing', air && land && land.x < L.landTop - 0.5 && r.clean, `${fix(vt, 1)} m/s at the foot, ${land ? 'down at ' + at(land) + ', ' + fix(L.lip - land.x, 1) + ' m from the lip' : 'never down -- ends ' + at(P.pos)}, top ${fix(r.top)}${cl(r)}`); }
  // a drop wall's rail, from the top to the field
  { reset(); const R = drops[0], a = R.segs[1].a; place(L.x - L.half - 0.5, L.top + 0.3, a.z + (a.z > L.z ? -1.4 : 1.4), -Math.PI / 2, 4); rg.GRIND.intent = 1; rg.ledgeClear(); run(0.15, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); rg.rightFlick(0, 60);
    let on = 0, down = null; const r = ride(10, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && drops.includes(P.grind.rail.path)) on = 1; if (on && !P.grind && P.grounded && P.pos.y < 3.5 && !down) down = P.pos.clone(); }, () => down);
    say('the swipe down onto a drop wall\'s rail: all the way down', on && down && r.clean, `${on ? 'on the rail' : 'NEVER ON IT'}, ${down ? 'down at ' + at(down) : 'never down -- ends ' + at(P.pos)}${cl(r)}`); }
  // off the sky rail, round the needle onto the deck -- and on, down the drop and over the gap
  const J = L.J, ri = (() => { let b = 0, bd = 1e9; S.path.segs.forEach((q, i) => { const d = Math.hypot(q.a.x - J.x, q.a.z - J.z); if (d < bd) { bd = d; b = i; } }); return b; })();
  const sky = (stick) => { away(); reset(); const q = S.path.segs[(ri - 12 + S.path.segs.length) % S.path.segs.length], h = Math.atan2(q.b.x - q.a.x, q.b.z - q.a.z);
    place(q.a.x, q.a.y + 0.4, q.a.z, h, 20); P.pos.set(q.a.x, q.a.y + 0.4, q.a.z); P.grounded = false; P.vel.y = -1;
    let sp = 0, deck = null, land = null, past = 0;
    const r = ride(30, () => { if (stick && P.grind) { rg.cam.az = Math.atan2(P.grind.rail.d.x * P.grind.dir, P.grind.rail.d.z * P.grind.dir) - L.side * 75 * Math.PI / 180; rg.stick.L.x = 0; rg.stick.L.y = -1; } else rg.stick.L.x = rg.stick.L.y = 0;
      if (P.grind && P.grind.rail.path === L.spiralRail) sp = 1; if (P.grind && P.grind.rail.path === S.path && Math.hypot(P.pos.x - J.x, P.pos.z - J.z) > 25 && !sp && P.pos.x < J.x) past = 1;
      if (sp && P.grounded && onDeck(P.pos) && !deck) deck = P.pos.clone(); if (deck && P.pos.x < L.lip - 2 && P.grounded && !land) land = P.pos.clone(); }, () => land || past);
    return { r, sp, deck, land, past }; };
  { const o = sky(true);
    say('off the sky rail, stick out: round the needle onto the deck', o.sp && o.deck && o.r.clean, `${o.sp ? 'on the spiral' : 'NEVER TOOK IT'}, ${o.deck ? 'on the deck at ' + at(o.deck) : 'never on the deck -- ends ' + at(P.pos)}${cl(o.r)}`);
    say('... and straight on down the drop and over the gap', o.land && o.land.x < L.landTop - 0.5 && o.r.clean, o.land ? `down at ${at(o.land)}` : `ends ${at(P.pos)}`); }
  { const o = sky(false); say('hands off, she carries straight on along the sky rail', !o.sp && o.past, o.sp ? 'TOOK THE SPIRAL' : o.past ? 'carried on' : `ends ${at(P.pos)}`); }
  return ok;
};
CASES.pyramids = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const Y = rg.PYR; if (!Y.built || !Y.dropRail) { console.log('  the pyramids were not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT), [G, T] = Y.ps, S = rg.SKR;
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; rg.GRIND.intent = 0; };
  const away = () => { const Tr = rg.HT.trains.filter(tr => tr.path === S.path); Tr.forEach((tr, i) => tr.s = S.path.len * (0.15 + 0.5 * i)); };
  const ride = (sec, drive, stop) => { const r = { bail: 0, deep: 0, top: -99 }; let kq = 0, done = 0; run(sec, (t, i) => { if (done) return; if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (process.env.PYT && kq++ % 12 === 0) console.log('    ', at(P.pos), P.grounded ? 'G' : 'a', P.grind ? 'GR ' + P.grind.rail.path.name : '', fix(P.speed, 1));
      if (P.bailT > 0) r.bail = 1; r.top = Math.max(r.top, P.pos.y);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 1.5, 0); if (q.hit && !P.grind && q.floor - P.pos.y < 1.5) r.deep = Math.max(r.deep, q.floor - P.pos.y); if (stop && stop()) done = 1; }); r.clean = !r.bail && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const onTop = (Q, p) => Math.max(Math.abs(p.x - Q.x), Math.abs(p.z - Q.z)) < Q.t + 0.2 && Math.abs(p.y - Q.h) < 0.15;
  const j = Y.dropRail.segs[0].jx;
  say(`${Y.ps.length} pyramids, ${Y.hips.length} hip rails, the drop ${fix(Y.dropRail.segs.length * 1.5, 0)} m, ${fix(Y.sweep / 2 / Math.PI, 2)} turns`, Y.hips.length === 8 && j && j.a.some(q => q.at === 'm'), j && j.a.some(q => q.at === 'm') ? 'branches off the sky rail' : 'NOT JOINED TO THE SKY RAIL');
  // the faces are the floor: the height on a face is the pyramid's own slope
  { const bad = []; for (const Q of Y.ps) for (const [dx, dz] of [[0.5, 0], [0, -0.7], [-0.3, 0.3], [0.8, 0.8]]) { const d = Q.t + (Q.B - Q.t) * Math.max(Math.abs(dx), Math.abs(dz)), x = Q.x + dx * (Q.B - Q.t) + Math.sign(dx) * Q.t, z = Q.z + dz * (Q.B - Q.t) + Math.sign(dz) * Q.t;
      const want = Q.h - (Math.max(Math.abs(x - Q.x), Math.abs(z - Q.z)) - Q.t) * Q.k, g = rg.groundAt(x, z, 40, 0); void d; if (!g.hit || Math.abs(g.floor - want) > 0.08) bad.push(`${Q.key} ${fix(x, 0)},${fix(z, 0)} ${g.hit ? fix(g.floor) : '-'} want ${fix(want)}`); }
    say('a face is the floor at the pyramid\'s own slope', !bad.length, bad.join('; ') || 'all 8 points'); }
  { const bad = []; for (const n of Y.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every Pyramids ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${Y.stops.length} stops`); }
  // the pad throws her onto the top
  { reset(); place(Y.pad.x, 0.3, Y.pad.z - 6, 0, 4); let top = null;
    const r = ride(7, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && onTop(G, P.pos) && !top) top = P.pos.clone(); }, () => top);
    say('the pad on the field throws her onto the Great Pyramid\'s top', top && r.clean, top ? `on top at ${at(top)}` : `ends ${at(P.pos)}${cl(r)}`); }
  // up the south-west hip on the booster
  { reset(); const a = Y.upHip.segs[0].a; place(a.x + 0.8, 0.3, a.z - 1.2, Math.PI / 4, 3); rg.GRIND.intent = 1; rg.ledgeClear(); run(0.15, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); rg.rightFlick(0, 60);
    let on = 0, top = 0; const r = ride(9, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && P.grind.rail.path === Y.upHip) on = 1; if (on && !P.grind && P.grounded && onTop(G, P.pos)) top = 1; }, () => top);
    say('the swipe down onto the hip booster grinds her up onto the top', on && top && r.clean, `${on ? 'on the booster' : 'NEVER ON IT'}, ${top ? 'on top' : 'never on top -- ends ' + at(P.pos)}${cl(r)}`); }
  // down the north-west hip
  { reset(); const H = Y.hips.find(R => R.name === 'pyramid hip' && R.segs[0].a.x < G.x && R.segs[0].a.z > G.z && Math.abs(R.segs[0].a.x - G.x) < 6);
    place(G.x - G.t + 1.5, G.h + 0.3, G.z + G.t - 0.4, -Math.PI / 4, 3); rg.GRIND.intent = 1; rg.ledgeClear(); run(0.15, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); rg.rightFlick(0, 60);
    let on = 0, down = 0; const r = ride(8, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && P.grind.rail.path === H) on = 1; if (on && !P.grind && P.grounded && P.pos.y < 0.3 && !down) down = P.pos.clone(); }, () => down);
    say('the swipe down onto a hip rail: down the edge to the field', on && down && r.clean, `${on ? 'on the hip' : 'NEVER ON IT'}, ${down ? 'down at ' + at(down) : 'never down -- ends ' + at(P.pos)}${cl(r)}`); }
  // the table-top: off the Great Pyramid's east edge, down its face, across the valley, up the Table and over its top
  { reset(); place(G.x + G.t - 0.5, G.h + 0.3, G.z, Math.PI / 2, 3); let over = 0, land = null;
    const r = ride(8, () => { rg.stick.L.x = rg.stick.L.y = 0; if (!P.grounded && Math.abs(P.pos.x - T.x) < T.t && P.pos.y > T.h + 0.8) over = 1; if (over && P.grounded && !land) land = P.pos.clone(); }, () => land && P.pos.y < 0.3);
    say('down the face, up the Table: the air carries her over its top', over && land && land.x > T.x + T.t - 0.5 && r.clean, `${over ? 'over the top' : 'NEVER OVER'}, ${land ? 'down at ' + at(land) : 'never down'}, top ${fix(r.top)}${cl(r)}`); }
  // the obelisk drop: grinding the sky rail toward it, the stick out to the side takes the branch; hands off does not
  const J = Y.J, ri = (() => { let b = 0, bd = 1e9; S.path.segs.forEach((q, i) => { const d = Math.hypot(q.a.x - J.x, q.a.z - J.z); if (d < bd) { bd = d; b = i; } }); return b; })();
  const sky = (stick) => { away(); reset(); const q = S.path.segs[(ri - 12 + S.path.segs.length) % S.path.segs.length], h = Math.atan2(q.b.x - q.a.x, q.b.z - q.a.z);
    place(q.a.x, q.a.y + 0.4, q.a.z, h, 20); P.pos.set(q.a.x, q.a.y + 0.4, q.a.z); P.grounded = false; P.vel.y = -1;
    let drop = 0, land = null, past = 0;
    const r = ride(16, () => { if (stick && P.grind) { rg.cam.az = Math.atan2(P.grind.rail.d.x * P.grind.dir, P.grind.rail.d.z * P.grind.dir) - Y.side * 75 * Math.PI / 180; rg.stick.L.x = 0; rg.stick.L.y = -1; } else rg.stick.L.x = rg.stick.L.y = 0;
      if (P.grind && P.grind.rail.path === Y.dropRail) drop = 1; if (P.grind && P.grind.rail.path === S.path && Math.hypot(P.pos.x - J.x, P.pos.z - J.z) > 25 && drop === 0 && P.pos.x > J.x) past = 1;
      if (drop && !P.grind && P.grounded && !land) land = P.pos.clone(); }, () => land || past);
    return { r, drop, land, past }; };
  { const o = sky(true), onG = o.land && Math.max(Math.abs(o.land.x - G.x), Math.abs(o.land.z - G.z)) < G.B && o.land.y > 6;
    say('off the sky rail, stick out: the obelisk drop onto the Great Pyramid', o.drop && onG && o.r.clean, `${o.drop ? 'on the drop' : 'NEVER TOOK IT'}, ${o.land ? 'down at ' + at(o.land) : 'never down -- ends ' + at(P.pos)}${cl(o.r)}`); }
  { const o = sky(false); say('hands off, she carries straight on along the sky rail', !o.drop && o.past, o.drop ? 'TOOK THE DROP' : o.past ? 'carried on' : `ends ${at(P.pos)}`); }
  return ok;
};
CASES.drain = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const D = rg.DRN; if (!D.built) { console.log('  the drain was not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT), H = rg.KSZ[D.size].H;
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; };
  const ride = (sec, drive) => { const r = { bail: 0, deep: 0, top: -99, low: 99 }; let kq = 0; run(sec, (t, i) => { if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (process.env.DRT && kq++ % 12 === 0) console.log('    ', at(P.pos), P.grounded ? 'G' : 'a', fix(P.speed, 1), fix(Math.atan2(P.vel.x, P.vel.z), 2));
      if (P.bailT > 0) r.bail = 1; r.top = Math.max(r.top, P.pos.y); r.low = Math.min(r.low, P.pos.y);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 1.5, 0); if (q.hit && !P.grind && q.floor - P.pos.y < 1.5) r.deep = Math.max(r.deep, q.floor - P.pos.y); }); r.clean = !r.bail && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  say(`${D.pieces.length} channel pieces, ${D.blocks} plateau rows, ${D.roofs.length} tunnels`, D.pieces.length === 8 && D.roofs.length === 2 && D.blocks > 30, '');
  { const bad = []; for (const n of D.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every Drain ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${D.stops.length} stops`); }
  // in through the mouth, along under the tunnel roof
  { reset(); place(D.x1 + 12, 0.3, D.z, -Math.PI / 2, 10); let tun = 0, far = 0;
    const r = ride(5, () => { rg.cam.az = -Math.PI / 2; rg.stick.L.x = 0; rg.stick.L.y = P.grounded ? -0.6 : 0;
      const rf = D.roofs[0]; if (P.pos.x > rf[0] && P.pos.x < rf[2] && P.pos.y < 0.5) tun = 1; if (P.pos.x < 180 && P.pos.y < 1) far = 1; });
    say('in off the street through the mouth, along under the tunnel', tun && far && r.clean, `${tun ? 'through the tunnel' : 'NEVER IN THE TUNNEL'}, ${far ? 'on down the channel' : 'stopped'} -- ends ${at(P.pos)}${cl(r)}`); }
  // the tunnel's roof is a ceiling over the channel and a floor on top (groundAt hands back ONE shared object: copy it)
  { const rf = D.roofs[0], x = (rf[0] + rf[2]) / 2, z = D.z, a = { ...rg.groundAt(x, z, 1, 0) }, b = { ...rg.groundAt(x, z, H + 1, 0) }, lid = rg.solidAt(x, H - 0.3, z, 0), air = !rg.solidAt(x, H - 1.2, z, 0);
    say('under the tunnel roof: the channel floor, the roof a ceiling; on it, a floor', a.hit && a.floor < 0.1 && lid && air && b.hit && Math.abs(b.floor - H) < 0.05, `floor ${a.hit ? fix(a.floor) : '-'}, ${lid ? 'roof solid' : 'NO ROOF'}, ${air ? 'air under it' : 'SOLID UNDER IT'}, on top ${b.hit ? fix(b.floor) : '-'}`); }
  // dropped in off the plateau, down into the channel, across, up the far wall and back -- hands off
  { reset(); const x = 158; place(x, H + 0.3, D.z1 - 2, Math.PI, 5); P.pos.y = H; let inn = 0, swings = 0, side = 0;
    const r = ride(10, () => { rg.stick.L.x = rg.stick.L.y = 0;
      if (P.pos.y < 0.3 && Math.abs(P.pos.z - D.z) < 4) inn = 1; if (inn) { const sd = P.pos.z > D.z ? 1 : -1; if (P.pos.y > 2 && sd !== side) { swings++; side = sd; } } });
    say('dropped in off the plateau, wall to wall across the channel', inn && swings >= 2 && r.clean, `${inn ? 'in' : 'NEVER IN'}, ${swings} walls ridden, ends ${at(P.pos)}${cl(r)}`); }
  // up a bank onto the plateau from the street
  { reset(); place(D.x1 + 18, 0.3, -262, -Math.PI / 2, 15); let up = 0;
    const r = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && P.pos.y > H - 0.1 && P.pos.x < D.x1) up = 1; });
    say('up a bank from the street onto the plateau', up && r.clean, (up ? `up, ends ${at(P.pos)}` : `ends ${at(P.pos)}`) + cl(r)); }
  // the branch: down its tunnel and round its half bowl
  { reset(); const t = D.cl.find(L => L.kind === 'pipeEnd'), bx = t.pts[0][0]; place(bx, 0.3, D.z - 4, Math.PI, 14); let bowl = 0;
    const r = ride(6, () => { rg.cam.az = Math.PI; rg.stick.L.x = 0; rg.stick.L.y = 0; if (P.pos.z < t.pts[0][1] - 3 && P.pos.y > 1.5) bowl = 1; });
    say('down the branch, under its tunnel, up into its half bowl', bowl && r.clean, bowl ? `up the bowl's wall, top ${fix(r.top)}` : `ends ${at(P.pos)}${cl(r)}`); }
  // a vert air under the tunnel roof does not come out through it
  { reset(); const rf = D.roofs[0], x = (rf[0] + rf[2]) / 2; place(x, 0.3, D.z, 0, 14); P.pos.y = 0; P.n.set(0, 1, 0); const r = ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; });
    say('a fast air up the wall under the tunnel stays under its roof', r.top < H - 0.5 && r.clean, `top ${fix(r.top)} (roof underside ${fix(H - 0.6)})${cl(r)}`); }
  return ok;
};
CASES.works = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const W = rg.WRK; if (!W.built || !W.rafters) { console.log('  the works were not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT), A = W.annex, M = W.mez;
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; };
  const mend = () => { for (const q of W.panes) { q.broke = 0; q.b.live = true; } };
  const onAnnex = p => p.x > A.x0 && p.x < A.x1 && p.z > A.z0 && p.z < A.z1 && p.y > A.y - 0.1;
  const steerZ = (x) => { rg.cam.az = 0; rg.stick.L.y = P.grounded ? -1 : 0; rg.stick.L.x = P.grounded ? -0.3 * (x - P.pos.x) : 0; };
  say(`${W.panes.length} panes, ${W.rafters.length} rafters, mezzanine at ${M.y}, annex at ${A.y}`, W.panes.length >= 12 && W.rafters.length === W.raft.xs.length, '');
  { const bad = []; for (const n of W.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every Works ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${W.stops.length} stops`); }
  // in through the door
  { mend(); reset(); rg.goSpot('the works'); P.vel.set(-6, 0, 0); const r0 = (W.door[0] + W.door[1]) / 2; let inn = 0;
    run(5, () => { rg.cam.az = -Math.PI / 2; rg.stick.L.y = -0.8; rg.stick.L.x = 0.3 * (r0 - P.pos.z); city(); if (P.pos.x < W.x1 - 6 && P.pos.y < 0.5) inn = 1; });
    say('in through the big door into the hall', inn, inn ? `in, at ${at(P.pos)}` : `stopped at ${at(P.pos)}`); }
  // a pane met slowly is a wall; met fast, it goes
  { mend(); reset(); const q = W.panes[6]; place(q.cx, 7, q.z - 3, 0, 3); P.pos.y = 7; P.grounded = false; P.vel.set(0, 2, 3);
    run(0.8, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); const slow = P.pos.z < q.z && q.b.live;
    mend(); reset(); place(q.cx, 7, q.z - 3, 0, 10); P.pos.y = 7; P.grounded = false; P.vel.set(0, 2, 10);
    run(0.8, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); const fast = P.pos.z > q.z + 1 && !q.b.live;
    say('a pane is a wall at 3 m/s and smashes at 10', slow && fast, `${slow ? 'stopped at 3' : 'went THROUGH at 3'}, ${fast ? 'smashed at 10' : 'NOT smashed at 10'}`); }
  // up the bank, along the mezzanine, off its kicker, through a window, onto the annex
  { mend(); reset(); const xm = (M.x0 + M.x1) / 2, s0 = W.smashes || 0; place(xm, 0.3, W.z0 + 1.2, 0, 11); let mez = 0, land = null;
    let kk = 0; run(6, () => { if (land) return; steerZ(xm); if (process.env.WT && kk++ % 10 === 0) console.log('   ', at(P.pos), P.grounded ? 'G' : 'a', fix(P.speed, 1)); city(); if (P.grounded && P.pos.y > M.y - 0.1 && P.pos.z > M.z0) mez = 1; if (mez && P.pos.z > W.z1 && P.grounded && !land) land = P.pos.clone(); });
    say('the bank, the mezzanine, its kicker: smash out onto the annex', mez && land && onAnnex(land) && (W.smashes || 0) > s0, `${mez ? 'on the mezzanine' : 'NEVER UP'}, ${(W.smashes || 0) > s0 ? 'SMASH' : 'no smash'}, ${land ? 'down at ' + at(land) : 'never down'}`); }
  // the rafters: off the mezzanine with the swipe down, along one, off its end through a window, onto the annex
  { mend(); reset(); rg.GRIND.intent = 1; rg.ledgeClear(); const xm = (M.x0 + M.x1) / 2, s0 = W.smashes || 0; place(W.raft.xs[0], M.y + 0.3, M.z0 + 3, 0, 8); P.pos.y = M.y;     // place() asks for the highest floor within 9 m: that is the hall's roof
    run(0.2, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); rg.rightFlick(0, 60); let raft = null, land = null, kq = 0;
    run(8, () => { if (land) return; rg.stick.L.x = rg.stick.L.y = 0; if (process.env.WR && kq++ % 6 === 0) console.log('   ', at(P.pos), P.grounded ? 'G' : 'a', P.grind ? 'GR' : '', fix(P.speed, 1)); city(); if (P.grind && W.rafters.includes(P.grind.rail.path)) raft = P.grind.rail.path; if (raft && !P.grind && P.grounded && !land) land = P.pos.clone(); });
    rg.GRIND.intent = 0; void xm;
    say('the swipe down onto a rafter, off its end through a window', raft && land && onAnnex(land) && (W.smashes || 0) > s0, `${raft ? 'on a rafter' : 'NEVER ON ONE -- ' + at(P.pos)}, ${(W.smashes || 0) > s0 ? 'SMASH' : 'no smash'}, ${land ? 'down at ' + at(land) : 'never down'}`); }
  // the hall's quarter pipe sends her up among the rafters
  { mend(); reset(); place(-278, 0.3, -20, Math.PI, 19); let top = 0;
    run(4, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); top = Math.max(top, P.pos.y); });
    say('the hall\'s quarter pipe sends her up level with the rafters', top > W.raft.y - 0.5 && P.pos.y < 2 && P.bailT <= 0, `top ${fix(top)} (rafters ${W.raft.y}), ends ${at(P.pos)}`); }
  // the annex's bank down into the yard
  { mend(); reset(); place(A.x1 - 6, A.y + 0.3, 20, Math.PI / 2, 6); let down = 0;
    run(5, () => { rg.cam.az = Math.PI / 2; rg.stick.L.y = 0; rg.stick.L.x = 0; city(); if (P.grounded && P.pos.y < 0.2 && P.pos.x > A.x1 + 2) down = 1; });
    say('off the annex down its bank into the yard', down && P.bailT <= 0, down ? `in the yard at ${at(P.pos)}` : `ends ${at(P.pos)}`); }
  // the panes come back -- once she is away
  { const q = W.panes[3]; q.b.live = false; q.broke = 1; q.t = 0; reset(); place(-240, 0.3, 60, 0, 0); run(W.back + 1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); });
    say('a smashed pane comes back', q.b.live && !q.broke, q.b.live ? 'back' : 'still out'); }
  mend(); return ok;
};
CASES.ufo = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const U = rg.UFO; if (!U.built || !U.beam) { console.log('  the mothership was not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT);
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; P.beamUp = 0; };
  const onShip = p => Math.hypot(p.x - U.x, p.z - U.z) < U.R + U.porch + 0.5 && p.y > U.floorY - 0.2;
  say(`dish r ${U.rc} at ${U.floorY}, deck ${U.y}, ${U.list.length} scouts, beam at ${fix(U.bx, 0)},${fix(U.bz, 0)}`, U.list.length === 3 && !!U.bowl && !!U.volcano, '');
  { const bad = []; for (const [nm, x, z, y] of [['dish floor', U.x + 12, U.z, U.floorY], ['deck ring', U.x + (U.R - 0.7), U.z, U.y], ['porch', U.x + (U.R + 2.5) * Math.sin(U.beamA), U.z + (U.R + 2.5) * Math.cos(U.beamA), U.y]]) {
      const g = rg.groundAt(x, z, y + 0.5, 0); if (!g.hit || Math.abs(g.floor - y) > 0.06) bad.push(`${nm} ${g.hit ? fix(g.floor) : '-'} vs ${y}`); }
    say('the dish floor, its deck ring and the porch are floors', !bad.length, bad.join('; ') || 'all three'); }
  { const bad = []; for (const n of U.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every mothership ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${U.stops.length} stops`); }
  // UP: skate into the beam's foot from the street
  { reset(); const h = U.beamA + Math.PI; place(U.bx + 8 * Math.sin(U.beamA), 0.3, U.bz + 8 * Math.cos(U.beamA), h, 5); let down = null, top = 0, air = 0, bail = 0;
    run(14, () => { if (down) return; rg.stick.L.x = rg.stick.L.y = 0; city(); top = Math.max(top, P.pos.y); if (!P.grounded) air = 1; if (P.bailT > 0) bail = 1; if (air && P.grounded && P.pos.y > 10) down = P.pos.clone(); });
    say('skate into the beam: carried up and put down on the ship', down && onShip(down) && !bail, down ? `down at ${at(down)}, top ${fix(top)}` : `never down up there -- ${at(P.pos)}, top ${fix(top)}`); }
  // the dish: off the porch, in, round it -- she stays on the ship
  { reset(); const sa = Math.sin(U.beamA), ca = Math.cos(U.beamA); place(U.x + (U.R + 2) * sa, U.y + 0.3, U.z + (U.R + 2) * ca, U.beamA + Math.PI, 6); let low = 999, inn = 0, bail = 0;
    run(10, (t) => { rg.cam.az = P.hSpeed > 0.5 ? Math.atan2(P.vel.x, P.vel.z) : rg.cam.az; rg.stick.L.x = t > 1 ? 0.35 : 0; rg.stick.L.y = P.grounded ? -0.7 : 0; city(); low = Math.min(low, P.pos.y); if (P.bailT > 0) bail = 1;
      if (Math.hypot(P.pos.x - U.x, P.pos.z - U.z) < U.rc - 2 && P.pos.y < U.floorY + 0.3) inn = 1; });
    say('drop into the dish and ride it: she stays on the ship', inn && low > U.floorY - 0.2 && !bail && onShip(P.pos), `${inn ? 'in the dish' : 'never in'}, lowest ${fix(low)}, ends ${at(P.pos)}`); }
  // DOWN: off the porch's end into the beam, let down gently
  { reset(); const sa = Math.sin(U.beamA), ca = Math.cos(U.beamA); place(U.x + (U.R + 1) * sa, U.y + 0.3, U.z + (U.R + 1) * ca, U.beamA, 5); let fast = 0, down = null, bail = 0, inb = 0;
    let kq = 0; run(30, () => { if (down) return; rg.stick.L.x = rg.stick.L.y = 0; if (process.env.SD && kq++ % 10 === 0) console.log('   ', at(P.pos), P.grounded ? 'G' : 'a', fix(P.vel.y), P.beamUp, fix(Math.hypot(P.pos.x - U.x, P.pos.z - U.z))); city(); if (P.pos.y < U.y - 5) { fast = Math.min(fast, P.vel.y); if (Math.hypot(P.pos.x - U.bx, P.pos.z - U.bz) < U.beamR) inb = 1; }
      if (P.bailT > 0) bail = 1; if (P.grounded && P.pos.y < 2) down = P.pos.clone(); });
    say('roll off the porch into the beam: let down 120 m, no bail', down && !bail && inb && fast > -10, down ? `down at ${at(down)}, fastest fall ${fix(-fast, 1)} m/s` : `never down -- ${at(P.pos)}`); }
  // the rim ring
  { reset(); rg.GRIND.intent = 0; const R = U.rimRail, a = R.segs[10].a, b = R.segs[10].b, h = Math.atan2(b.x - a.x, b.z - a.z);
    place(a.x, a.y + 0.4, a.z, h, 7); P.pos.set(a.x, a.y + 0.4, a.z); P.grounded = false; P.vel.y = -1; let on = 0, s = 0;
    run(6, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grind && P.grind.rail.path === R) { on = 1; s += P.speed * DT; } });
    say('the rim ring grinds', on && s > 20, `${fix(s, 0)} m on it`); }
  // a scout: wait on the street under its path, its beam lifts her onto its back and it carries her
  // SCT=<t> starts the row's clock there: the row depends on where earlier cases left HT.t
  { reset(); if (process.env.SCT) rg.HT.t = +process.env.SCT; const S = U.list[0]; let tc = rg.HT.t + 4;
    // a moment when its path is over open street with nothing between the street and the saucer (over a roof, the roof is in the way)
    const open = t => { const [x, y, z] = S.fn(t); for (let k = 0; k < 6; k++) { const [x2, y2, z2] = S.fn(t + k); const g = rg.groundAt(x2, z2, 1, 0); if (g.hit && g.floor > 0.2) return false;
        const g2 = rg.groundAt(x2, z2, y2 - 1.5, 0); if (g2.hit && g2.floor > 0.2) return false;
        for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]) { const g3 = rg.groundAt(x2 + dx, z2 + dz, 1, 0); if (g3.hit && g3.floor > 0.04) return false; }     // and FLAT: on a bank's toe she rolls off the scout's path while she waits     // r107: a FLOOR overhead (a monorail beam, a roof) stops the beam too -- the old check only asked about solids
        for (let yy = 1; yy < y - 1; yy += 1.5) for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) if (rg.solidAt(x2 + dx, yy, z2 + dz, 0)) return false; } return true; };
    while (!open(tc) && tc < rg.HT.t + 200) tc += 0.5;
    const [x, , z] = S.fn(tc); place(x, 0.3, z, 0, 0); let top = 0, on = 0, carried = 0, x0 = null;
    let kk = 0; run(tc - rg.HT.t + 9, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (process.env.SC && kk++ % 15 === 0) console.log('   ', at(P.pos), P.grounded ? 'G' : 'a', P.onDyn ? P.onDyn.kind : '-', 'S', at(S), P.beamUp); top = Math.max(top, P.pos.y); if (P.grounded && P.onDyn === S && Math.abs(P.pos.y - S.y) < 0.3) { on = 1; if (!x0) x0 = P.pos.clone(); carried = Math.max(carried, Math.hypot(P.pos.x - x0.x, P.pos.z - x0.z)); } });
    say('a scout\'s beam lifts her onto its back and it carries her', on && carried > 8, on ? `on it, carried ${fix(carried, 1)} m at ${fix(S.y, 1)} m up` : `never on -- top ${fix(top)}, ends ${at(P.pos)}`); }
  return ok;
};
CASES.skyrail = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const S = rg.SKR; if (!S.built || !S.path) { console.log('  the sky rail was not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT);
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; P.grindCool = 0; };
  const away = () => { for (const tr of rg.HT.trains) if (tr.path === S.path) tr.s = (tr.s0 == null ? (tr.s0 = tr.s) : tr.s0); const T = rg.HT.trains.filter(tr => tr.path === S.path); T.forEach((tr, i) => tr.s = S.path.len * (0.15 + 0.5 * i)); };
  const trains = rg.HT.trains.filter(tr => tr.path === S.path), D = rg.DYN.list.filter(d => S.lifts.includes(d));
  say(`${fix(S.len, 0)} m round, ${S.pts.length} points, ${S.pylons} pylons, ${trains.length} trains, ${D.length} lifts`, S.len > 1500 && S.pylons >= 25 && trains.length === 2 && D.length === 2, '');
  say('no grade on it steeper than 15%', S.maxGrade <= 0.15, `steepest ${fix(S.maxGrade * 100, 1)}%`);
  // nothing solid on the line except where it is meant to run along something
  { const ok2 = /^(summit deck|summit wall|sky station|sky station wall|rim)$/, bad = new Map();
    for (const p of S.pts) for (const dy of [-1.2, -0.6, 0.4, 1.2, 2.2]) { const b = rg.solidAt(p.x, p.y + dy, p.z, 0.2); if (b && !ok2.test(b.tag)) bad.set(b.tag, at(p)); }
    say('nothing solid on the line but the summit, the stations, the peak', !bad.size, [...bad].map(([k, v]) => `${k} at ${v}`).join('; ') || 'clear'); }
  // the stops
  { const bad = []; for (const n of S.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every sky rail ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${S.stops.length} stops`); }
  // the stations: where each is on the path
  const St = [['summit', S.plan[0], S.plan[1]], ['peak', S.plan[6], S.plan[7]], ['heights', S.plan[12], S.plan[13]], ['park', S.plan[22], S.plan[23]]];
  // a lap, hands off, from the summit chord
  { away(); reset(); const a = S.path.segs[0].a, b = S.path.segs[0].b, h = Math.atan2(b.x - a.x, b.z - a.z);
    place(a.x, a.y + 0.4, a.z, h, 10); P.pos.set(a.x, a.y + 0.4, a.z); P.grounded = false; P.vel.y = -1;
    let on = 0, off = null, t = 0; const near = St.map(() => 1e9);
    run(100, () => { if (off) return; t += DT; rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grind && P.grind.rail.path === S.path) on = 1; if (on && !P.grind) off = [t, P.pos.clone()];
      St.forEach(([, p, q], i) => { near[i] = Math.min(near[i], Math.hypot(P.pos.x - (p[0] + q[0]) / 2, P.pos.z - (p[1] + q[1]) / 2)); }); });
    say('a lap, hands off: on it the whole way round, past every station', on && (!off || off[0] > 80) && near.every(d => d < 3), `${off ? 'off after ' + fix(off[0], 1) + ' s at ' + at(off[1]) : 'still on after 100 s'}; nearest each station ${near.map(d => fix(d, 1)).join('/')} m`); }
  // ON at each station: standing on it beside the rail, the swipe down
  for (const [nm, p, q] of St) { away(); reset(); rg.GRIND.intent = 1; rg.ledgeClear();
    const mx = p[0] + (q[0] - p[0]) * 0.15, mz = p[1] + (q[1] - p[1]) * 0.15, ux = q[0] - p[0], uz = q[1] - p[1], ul = Math.hypot(ux, uz), h = Math.atan2(ux, uz);
    // her spot: 1.6 m in from the rail (toward the deck / roof / island centre), heading along it
    const cands = [[-uz / ul, ux / ul], [uz / ul, -ux / ul]].map(([nx, nz]) => { const x = mx + nx * 1.6, z = mz + nz * 1.6, g = rg.groundAt(x, z, p[2] + 0.5, 0); return { x, z, y: g.hit ? g.floor : -99 }; }).sort((A, B) => Math.abs(A.y - p[2] + 0.95) - Math.abs(B.y - p[2] + 0.95));
    const c = cands[0]; place(c.x, c.y + 0.3, c.z, h, 4); const g = rg.groundAt(c.x, c.z, c.y + 0.5, 1); if (g.hit) P.pos.y = g.floor;
    run(0.15, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); rg.rightFlick(0, 60); let on = 0;
    let tapAt = null, kq2 = 0; run(2, () => { rg.stick.L.x = rg.stick.L.y = 0; if (on && !tapAt) { P.jump = 1; tapAt = P.pos.clone(); } city(); if (P.grind && P.grind.rail.path === S.path) on = 1; if (process.env.DON && kq2++ % 6 === 0) console.log('    ', at(P.pos), P.grind ? 'GR ' + P.grind.rail.path.name : '', P.grounded ? 'G' : 'a', fix(P.speed, 1), P.kickRail ? 'kick ' + (P.kickRail.path ? P.kickRail.path.name : '?') : ''); });
    // and OFF: a tap pops her off -- she must come down on the station, not off it
    let down = null; if (on) { let k = 0; run(3, () => { rg.stick.L.x = rg.stick.L.y = 0; if (process.env.DOFF && k++ % 6 === 0) console.log('    ', at(P.pos), P.grind ? 'GR' : '', P.grounded ? 'G' : 'a', fix(P.speed, 1)); city(); if (!P.grind && P.grounded && !down) down = P.pos.clone(); }); }
    rg.GRIND.intent = 0; void tapAt;
    say(`${nm} station: on with the swipe down, off with a tap onto it`, on && down && down.y > p[2] - 3, `${on ? 'on' : 'NEVER ON from ' + at(P.pos)}${on ? (down ? ', down at ' + at(down) : ', never down') : ''}`); }
  // the lifts: on at the street, up to the deck
  for (const L of D) { reset(); rg.HT.t = 0; L.x = L.S.lx; L.y = 0; L.z = L.S.lz; place(L.S.lx + 1, 0.3, L.S.lz, 0, 0); let top = 0, t = 0;
    run(rg.SKR.lift.period * 0.6, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); t += DT; top = Math.max(top, P.grounded ? P.pos.y : 0); });
    say(`${L.S.name}'s lift: on at the street, carried up to the deck`, top > L.S.y - 0.2, `carried to ${fix(top)} (deck ${fix(L.S.y)})`); }
  // a train catches a grinder from behind and knocks her off
  { reset(); const T = trains[0], k0 = rg.HT.knocks || 0, s = S.path.len * 0.3; for (const tr of trains) tr.s = s - (tr === T ? 40 : -600);
    let seg = null, acc = 0; for (const sg of S.path.segs) { if (acc + sg.len > s) { seg = sg; break; } acc += sg.len; }
    const a = seg.a, h = Math.atan2(seg.b.x - a.x, seg.b.z - a.z); place(a.x, a.y + 0.4, a.z, h, 10); P.pos.set(a.x, a.y + 0.4, a.z); P.grounded = false; P.vel.y = -1;
    run(15, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); });
    say('a train catches her from behind and knocks her off', (rg.HT.knocks || 0) > k0, `${(rg.HT.knocks || 0) - k0} knock(s)`); }
  away(); return ok;
};
CASES.stack = async () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const S = rg.STK; if (!S.built) { console.log('  the Stack was not built'); return false; }
  const at = p => `${fix(p.x, 1)},${fix(p.y, 2)},${fix(p.z, 1)}`, city = () => rg.stepCity(DT);
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; P.rHold = 0; };
  const go = (x, z, h, v, y) => { reset(); place(x, (y || 0) + 0.3, z, h, v); const q = rg.groundAt(x, z, (y || 0) + 0.6, 1); if (q.hit) P.pos.y = q.floor; };
  const ride = (sec, drive, stop) => { const r = { bail: 0, deep: 0, grind: new Set(), top: -99, low: 999 }; let k = 0;
    run(sec, (t, i) => { if (stop && stop()) return; if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (P.bailT > 0) r.bail = 1; if (P.grind) r.grind.add(P.grind.rail.path); r.top = Math.max(r.top, P.pos.y); r.low = Math.min(r.low, P.pos.y);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 2, 0); if (q.hit && !P.grind && q.floor - P.pos.y < 2) r.deep = Math.max(r.deep, q.floor - P.pos.y); k++; }); r.clean = !r.bail && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const inR = (r, p, m) => p.x > r.x0 - (m || 0) && p.x < r.x1 + (m || 0) && p.z > r.z0 - (m || 0) && p.z < r.z1 + (m || 0);
  const L = S.roofs.slice(0, S.line.length), M = S.summit, D = S.plunge.roofs;
  // the line's own numbers: each roof a step up and butted against the last
  { const bad = []; L.forEach((r, i) => { if (i && (Math.abs(r.x0 - L[i - 1].x1) > 0.01 || Math.abs(r.y - L[i - 1].y - S.rise) > 0.01)) bad.push(r.name);
      const q = rg.groundAt((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.y + 0.5, 0); if (!q.hit || Math.abs(q.floor - r.y) > 0.01) bad.push(r.name + ' floor ' + (q.hit ? fix(q.floor) : '-')); });
    say(`${L.length} roofs, ${fix(L[0].y, 0)} m to ${fix(L[L.length - 1].y, 0)} m, summit ${M.y}, plunge ${D.map(r => r.y).join('/')}`, !bad.length && L.length === 5 && D.length === 2, bad.join('; ') || 'each one ' + S.rise + ' m up, butted, floored'); }
  say('no NaN vertex anywhere', !rg.MESHBAD || !rg.MESHBAD(), '');
  // every stop stands her on a floor
  { const bad = []; for (const n of S.go) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every Stack ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${S.go.length} stops`); }
  // a building is a wall from the street
  { const r = L[2]; go(r.x0 + 6, r.z0 - 8, 0, 9); ride(2.5); say('a building is a wall from the street', P.pos.z < r.z0 + 0.05 && P.pos.y < 1, `ends ${at(P.pos)} (face z ${fix(r.z0)})`); }
  // the street pad onto roof 1's landing deck
  { go(S.pad.x, S.pad.z, Math.PI / 2, 0); let up = 0; const r1 = L[0];
    const r = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && inR(r1, P.pos) && P.pos.y > r1.y - 0.1) up = 1; });
    say('the street pad throws her onto the first roof', up && !r.bail, up ? `on roof 1, top ${fix(r.top)}` : `ends ${at(P.pos)}`); }
  // THE TRANSFERS: pump the half pipe (thumb along her travel on the ground, a nudge back to the middle), and at the XL's lip,
  // once she is going fast enough, the swipe up. She must come down on the next roof.
  const pumpUp = (r, need, maxT) => { const cz = (r.z0 + r.z1) / 2, lipX = r.up.T.x + rg.KSZ.XL.lip; let fired = 0, vl = 0, land = null, air = 0, bail = 0, t = 0;
    run(maxT, () => { if (land) return; t += DT; const az = rg.cam.az = P.hSpeed > 0.5 ? Math.atan2(P.vel.x, P.vel.z) : rg.cam.az, fx = Math.sin(az), fz = Math.cos(az), dx = Math.sign(P.vel.x || 1), dz = 0.12 * (cz - P.pos.z), dl = Math.hypot(dx, dz);
      rg.stick.L.y = P.grounded && !fired ? -((dx * fx + dz * fz) / dl) : 0; rg.stick.L.x = P.grounded && !fired ? ((dx * -fz + dz * fx) / dl) : 0;
      if (!fired && P.grounded && P.pos.x > lipX - 0.6 && P.vel.y > 0.5 && P.speed >= need) { fired = 1; vl = P.speed; rg.rightFlick(0, -60); }
      city(); if (P.bailT > 0) bail = 1; if (fired && !P.grounded) air = 1; if (fired && air && P.grounded) land = P.pos.clone(); });
    return { fired, vl, land, bail }; };
  for (let i = 0; i < L.length - 1; i++) { const r = L[i], n = L[i + 1]; go(r.x0 + 2, (r.z0 + r.z1) / 2, Math.PI / 2, 3, r.y + rg.KSZ.M.H);
    const o = pumpUp(r, 17, 40), good = o.land && inR(n, o.land) && o.land.y > n.y - 0.05 && !o.bail;
    say(`${r.name} -> ${n.name}: pump, then transfer onto the next roof`, good, o.fired ? `swipe at ${fix(o.vl, 1)} m/s, down at ${o.land ? at(o.land) : 'never'}${o.bail ? ' BAIL' : ''}` : 'never fast enough at the lip'); }
  // a weak transfer: too slow to make it -- she comes down on her own roof, not off the building
  { const r = L[2]; go(r.up.T.x - 3, (r.z0 + r.z1) / 2, Math.PI / 2, 14.5, r.y); let fired = 0, air = 0, land = null;
    ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = Math.PI / 2; if (!fired && P.grounded && P.pos.x > r.up.T.x + rg.KSZ.XL.lip - 0.6) { fired = 1; rg.rightFlick(0, -60); } if (fired && !P.grounded) air = 1; if (air && P.grounded && !land) land = P.pos.clone(); });
    say('a transfer that is too slow comes down on its own roof', land && inR(r, land) && land.y >= r.y - 0.05, land ? `down at ${at(land)}` : 'never landed'); }
  // the summit pad
  { const q = S.pad5; go(q.x, q.z, 0, 0, q.y); let up = 0; const r = ride(6, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && inR(M.r, P.pos) && P.pos.y > M.y - 4) up = 1; });
    say('the top roof\'s pad throws her onto the summit', up && !r.bail, up ? `up to ${fix(r.top)}` : `ends ${at(P.pos)}`); }
  // the helix, caught off the top roof with the swipe down, hands-off round the tower onto the summit deck
  { rg.GRIND.intent = 1; rg.ledgeClear(); const H = S.helix, a = H.segs[0].a, r5 = L[L.length - 1];
    go(a.x - 1.2, a.z + 3, Math.PI, 5, r5.y); run(0.2, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); rg.rightFlick(0, 60);
    let on = 0, t1 = -1, t = 0, down = null; const r = ride(40, () => { t += DT; rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && P.grind.rail.path === H) on = 1; if (on && !P.grind && t1 < 0) t1 = t; if (t1 > 0 && P.grounded && !down) down = P.pos.clone(); }, () => !!down);
    rg.GRIND.intent = 0;
    say('the helix: swipe down onto it, round the tower to the summit', on && down && inR(M.r, down) && down.y > M.y - KSZ_L() - 0.05 && !r.bail, on ? `${fix(t1, 1)} s on it, down at ${down ? at(down) : 'never'}` : `never caught -- ${at(P.pos)}`); }
  // the summit bowl: dropped in off its deck, she stays in and rides it
  { const b = M.bowl.T, R = M.rc + rg.KSZ.L.lip; go(b.x - R - 1, b.z, Math.PI / 2, 5, M.y); let inb = 0;
    const r = ride(8, () => { rg.stick.L.x = 0.3; rg.stick.L.y = P.grounded ? -0.6 : 0; rg.cam.az = Math.atan2(P.vel.x, P.vel.z) || 0; if (Math.hypot(P.pos.x - b.x, P.pos.z - b.z) < M.rc && P.pos.y < M.y - 3.4) inb = 1; });
    say('the summit bowl: drop in, ride it, stay up on the summit', inb && r.clean && r.low > M.y - 4, `${inb ? 'in the bowl' : 'never in'}, lowest ${fix(r.low)}${cl(r)}`); }
  // THE PLUNGE: off the summit's kicker with a held push, onto the 60 m roof, off its edge onto the 45 m one
  for (const v of [8, 14, 20]) { go(M.x + M.bx - 13, M.z, -Math.PI / 2, v, M.y); let on1 = 0, on2 = 0;
    const r = ride(10, () => { rg.cam.az = -Math.PI / 2; rg.stick.L.x = P.grounded ? -0.25 * (M.z - P.pos.z) : 0; rg.stick.L.y = P.grounded ? -1 : 0;
      if (P.grounded && inR(D[0], P.pos) && P.pos.y > D[0].y - 0.1) on1 = 1; if (P.grounded && inR(D[1], P.pos) && P.pos.y > D[1].y - 0.1) on2 = 1; });
    say(`the plunge at ${v} m/s, pushing: summit -> ${D[0].y} m -> ${D[1].y} m`, on1 && on2 && r.low > D[1].y - 0.2 && !r.bail, `${on1 ? 'roof 1' : 'MISSED the 60'}, ${on2 ? 'roof 2' : 'MISSED the 45'}, ends ${at(P.pos)}${cl(r)}`); }
  // the down rails: the loop back onto roof 2's deck, the street rail off roof 1
  for (const [R, nm, ok2] of [[S.loopRail, 'off the 45 m roof onto roof 2\'s deck (the loop)', p => inR(L[1], p) && p.y > L[1].y - 0.05], [S.streetRail, 'off roof 1 down into the street', p => p.y < 0.2]]) {
    rg.GRIND.intent = 1; rg.ledgeClear(); const a = R.segs[0].a, b = R.segs[0].b, h = Math.atan2(b.x - a.x, b.z - a.z);
    go(a.x - Math.sin(h) * 2.5, a.z - Math.cos(h) * 2.5, h, 5, a.y - 0.6); run(0.2, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); }); rg.rightFlick(0, 60);
    let on = 0, off = 0, down = null, kk = 0; const r = ride(12, () => { rg.stick.L.x = rg.stick.L.y = 0; if (process.env.STR && kk++ % 10 === 0) console.log('   ', at(P.pos), P.grounded ? 'G' : 'a', P.grind ? 'GR' : ''); if (P.grind && P.grind.rail.path === R) on = 1; if (on && !P.grind) off = 1; if (off && P.grounded && !down) down = P.pos.clone(); }, () => !!down);
    rg.GRIND.intent = 0; say('the down rail ' + nm, on && down && ok2(down) && !r.bail, on ? `down at ${down ? at(down) : 'never'}` : `never caught -- ${at(P.pos)}`); }
  // HIS ART, through the real loader and the shipped skyIngest/skyFlush: every roof collider sits on the art's own roof
  { const A = rg.SKYART, files = [...new Set(A.place.map(q => q.f))], miss = [];
    for (const f of files) { try { rg.skyIngest(f, (await realGLB(A.dir + f + '.glb')).scene); } catch (e) { miss.push(f + ' ' + e.message); } }
    rg.skyFlush(); let tris = 0; const T = [];
    for (const me of A.mesh.values()) { const g = me.geometry, Pp = g.attributes.position.array, I = g.index.array; tris += I.length / 3; for (let i = 0; i < I.length; i += 3) T.push(I[i] * 3, I[i + 1] * 3, I[i + 2] * 3, Pp); }
    say(`his art: ${files.length} files, ${A.mesh.size} meshes, ${Math.round(tris / 1000)}k triangles, ${A.mats.size} materials`, !miss.length && A.mesh.size < 90, miss.join('; '));
    const artAt = (x, z, y) => { let best = null; for (let t = 0; t < T.length; t += 4) { const Pp = T[t + 3], a = T[t], b = T[t + 1], c = T[t + 2];
        const ax = Pp[a], az = Pp[a + 2], ux = Pp[b] - ax, uz = Pp[b + 2] - az, vx = Pp[c] - ax, vz = Pp[c + 2] - az, det = ux * vz - uz * vx; if (Math.abs(det) < 1e-9) continue;
        const sc = ((x - ax) * vz - (z - az) * vx) / det, tc = (ux * (z - az) - uz * (x - ax)) / det; if (sc < 0 || tc < 0 || sc + tc > 1) continue;
        const hh = Pp[a + 1] + sc * (Pp[b + 1] - Pp[a + 1]) + tc * (Pp[c + 1] - Pp[a + 1]); if (Math.abs(hh - y) < 3 && (best == null || Math.abs(hh - y) < Math.abs(best - y))) best = hh; } return best; };
    const bad = []; let n = 0, high = 0;
    for (const r of S.roofs) for (const [fx, fz] of [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]]) { const x = r.x0 + (r.x1 - r.x0) * fx, z = r.z0 + (r.z1 - r.z0) * fz, h = artAt(x, z, r.y); n++;
      if (h == null || Math.abs(h - r.y) > 0.06) bad.push(`${r.name} at ${fix(fx * 100, 0)}/${fix(fz * 100, 0)}%: art ${h == null ? 'none' : fix(h)} vs ${fix(r.y)}`); }
    // and nothing of his is left standing on a roof the game rides (the clip): no art triangle over a roof's middle, above it
    for (const r of S.roofs) for (let t = 0; t < T.length; t += 4) { const Pp = T[t + 3], a = T[t]; const x = Pp[a], y = Pp[a + 1], z = Pp[a + 2];
      if (x > r.x0 + 2 && x < r.x1 - 2 && z > r.z0 + 2 && z < r.z1 - 2 && y > r.y + 0.1 && y < r.y + 40) { high++; break; } }
    say('every roof collider sits on his roof, and his roofs are cleared', !bad.length && !high, (bad.join('; ') || `${n} spots within 6 cm`) + (high ? `, ${high} roofs with art standing on them` : '')); }
  return ok;
};
function KSZ_L() { return rg.KSZ.L.H; }
CASES.heights = () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  const H = rg.HT; if (!H.built) { console.log('  the Heights were not built'); return false; }
  const city = () => rg.stepCity(DT);
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; };
  const go = (x, z, h, v, y) => { reset(); place(x, (y || 0) + 0.3, z, h, v); const q = rg.groundAt(x, z, (y || 0) + 0.6, 1); if (q.hit) P.pos.y = q.floor; };
  const ride = (sec, drive) => { const r = { bail: 0, deep: 0, grind: new Set(), top: -99 }; run(sec, (t, i) => { if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (P.bailT > 0) r.bail = 1; if (P.grind) r.grind.add(P.grind.rail.path); r.top = Math.max(r.top, P.pos.y);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 2, 0); if (q.hit && !P.grind) r.deep = Math.max(r.deep, q.floor - P.pos.y); }); r.clean = !r.bail && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const onDock = (y) => H.docks.some(D => D.y === y && P.pos.x > D.x0 && P.pos.x < D.x1 && P.pos.z > D.z0 && P.pos.z < D.z1) && P.grounded && Math.abs(P.pos.y - y) < 0.1;
  say(`${H.towers.length} towers, ${H.docks.length} docks, ${H.pylons} pylons, ${H.trains.filter(tr => tr.path === H.lowPath || tr.path === H.highPath).length} trains (r101: the sky rail runs its own on the same machinery), ${H.lifts.length} lifts`, H.docks.length === 8 && H.lifts.length === 4 && H.trains.filter(tr => tr.path === H.lowPath || tr.path === H.highPath).length === 2, '');
  say('no NaN vertex anywhere', !rg.MESHBAD || !rg.MESHBAD(), '');
  // the stops
  { const bad = []; for (const n of H.stops) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every Heights ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${H.stops.length} stops`); }
  // a tower is a wall
  { const T = H.towers[0]; go(T.x + 20, T.z, -Math.PI / 2, 9); const r = ride(2.5); say('a tower is a wall from the street', P.pos.x > T.x + H.half - 0.05, `ends x ${fix(P.pos.x, 2)} (face ${T.x + H.half})${cl(r)}`); }
  // every pad throws her onto its low dock
  { const bad = []; for (const pd of H.pads) { go(pd.x, pd.z, 0, 0); let up = 0; ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (onDock(H.low)) up = 1; }); if (!up) bad.push(`${pd.D.T.name}: ends ${fix(P.pos.x, 1)},${fix(P.pos.y, 1)},${fix(P.pos.z, 1)}`); }
    say('every plaza pad throws her onto its tower\'s low dock', !bad.length, bad.join('; ') || `${H.pads.length} pads`); }
  // from a dock, a tap catches the line beside it; then hands-off round it on the booster
  for (const [y, path, nm] of [[H.low, H.lowPath, 'low'], [H.high, H.highPath, 'high']]) { const D = H.docks.find(d => d.y === y && d.T === H.towers[0]);
    rg.GRIND.intent = 0; rg.ledgeClear(); for (const tr of H.trains) tr.s = (tr.path === path ? path.len * 0.5 : tr.s);
    go(D.T.x + 2, D.z0 + 1.1, Math.PI / 2, 5, y); P.jump = 1; let lap = 0, s0 = null; const r = ride(6, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && P.grind.rail.path === path) lap++; });
    say(`the ${nm} line: a tap from the dock catches the beam, and she rides it`, r.grind.has(path) && lap > 120, `${r.grind.has(path) ? 'on it for ' + fix(lap / 60, 1) + ' s' : 'NEVER CAUGHT, ends y ' + fix(P.pos.y)}${cl(r)}`); }
  // the train: grinding the low line just ahead of it, it comes round and knocks her off
  { const tr = H.trains[0], Pth = tr.path, S0 = Pth.segs[10]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 4); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 4, side: 'left' }); tr.s = (S0.s0 - 8 + Pth.len) % Pth.len; const k0 = H.knocks || 0; let tOff = -1;
    run(4, (t) => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (tOff < 0 && (H.knocks || 0) > k0) tOff = t; });
    say('the train comes round and knocks her off the line', tOff >= 0, tOff >= 0 ? `knocked off after ${fix(tOff, 1)} s` : 'never knocked off'); }
  // a lift: on at the bottom, carried up to the high dock, steps off onto it
  { const Lf = H.lifts[0], D = Lf.D, P2 = H.period;
    let tw = 0; for (let k = 0; k < 400; k++) { const [, y] = Lf.fn(H.t + k * 0.05); if (Math.abs(y - H.low) < 0.01) { tw = k * 0.05; break; } }
    run(tw, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); });
    reset(); place(Lf.x, Lf.y + 0.05, Lf.z, -D.sx * Math.PI / 2, 0); P.vel.set(0, 0, 0); let hi = -1, stay = 1, upT = -1;
    run(9, (t) => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (!P.grounded) stay = 0; if (P.pos.y > H.high - 0.1 && upT < 0) upT = t; });
    const rode = upT >= 0 && stay; let off = 0;
    if (rode) { const h = D.sx > 0 ? -Math.PI / 2 : Math.PI / 2; run(2.5, () => { rg.cam.az = h; rg.cam.steerAz = h; rg.stick.L.x = 0; rg.stick.L.y = -1; city(); if (onDock(H.high)) off = 1; }); }
    say('a lift carries her from the low dock up to the high dock, and she steps off onto it', rode && off, `${rode ? 'up at ' + fix(upT, 1) + ' s' : stay ? 'never reached 52, y ' + fix(P.pos.y) : 'FELL OFF at y ' + fix(P.pos.y)}, ${off ? 'on the high dock' : 'never on the dock'}`); }
  // the air base: stood on it, it carries her round and she stays on
  { const B = H.airBase; reset(); place(B.x, B.y + 0.05, B.z, 0, 0); P.vel.set(0, 0, 0); let stay = 1, x0 = P.pos.x, z0 = P.pos.z;
    run(6, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (!P.grounded || Math.hypot(P.pos.x - B.x, P.pos.z - B.z) > B.cr) stay = 0; });
    say('the air base carries her round, she stays on it', stay && Math.hypot(P.pos.x - x0, P.pos.z - z0) > 8, `${stay ? 'on it' : 'CAME OFF'}, carried ${fix(Math.hypot(P.pos.x - x0, P.pos.z - z0), 1)} m, y ${fix(P.pos.y)}`); }
  // and a drop from the high line lands on it when it passes under
  { const B = H.airBase, tf = Math.sqrt(2 * (H.high + 0.95 - B.y) / rg.SK.g); let tt = 0;
    for (let k = Math.ceil(tf / 0.05) + 2; k < 2400; k++) { const [x, , z] = B.fn(H.t + k * 0.05); if (Math.abs(z - H.loop.z1) < 2 && Math.abs(x - (H.loop.x0 + H.loop.x1) / 2) < 6) { tt = k * 0.05; break; } }
    run(tt - tf, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); });
    reset(); const [bx, , bz] = B.fn(H.t + tf); place(bx, H.high + 0.95, bz, 0, 0); P.vel.set(0, 0, 0); P.grounded = false; let land = 0;
    run(4, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (P.grounded && Math.abs(P.pos.y - B.y) < 0.3) land = 1; });
    say('timed right, a drop from the high line lands on the passing air base', land, land ? 'on it' : `missed, ends y ${fix(P.pos.y)}`); }
  rg.GRIND.intent = 0;
  return ok;
};
// r97: SK8 SKY -- the floating skate city (world 3), every link ridden
CASES.sky = async () => {
  let ok = true;
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(62)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false; };
  if (rg.WORLD.zones !== 3) { console.log('  booted in another world -- run `npm run sim sky`'); return false; }
  const S = rg.S3; if (!S.built) { console.log('  sk8 sky was not built'); return false; }
  if (process.env.SKYPROBE) { const mod = await import(pathToFileURL(path.resolve(process.env.SKYPROBE)).href); await mod.default(rg, THREE); }
  say(`built: ${rg.KITW.pieces.length} kit pieces, ${rg.COMBOS.list.length} combos, ${S.paths.length} rails, ${rg.DYN.list.length} moving floors, ${rg.SKYART.place.length} art placements of ${new Set(rg.SKYART.place.map(q => q.f)).size} files`, rg.COMBOS.list.length === 6 && rg.DYN.list.length === 3 && rg.SKYART.place.length > 40, '');
  say('no NaN vertex anywhere', !rg.MESHBAD || !rg.MESHBAD(), '');
  const city = () => rg.stepCity(DT), g = rg.SK.g;
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.jump = 0; P.kickRail = null; P.grindWant = 0; P.lift = null; rg.ORB.safe = null; P.flatT = 0; };
  const go = (x, z, h, v, y) => { reset(); place(x, (y || 0) + 0.3, z, h, v); const q = rg.groundAt(x, z, (y || 0) + 0.6, 1); if (q.hit) P.pos.y = q.floor; };
  const ride = (sec, drive) => { const r = { bail: 0, deep: 0, grind: new Set(), top: -99, falls: rg.ORB.falls || 0, vmax: 0 }; run(sec, (t, i) => { if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city();
      if (P.bailT > 0) r.bail = 1; if (P.grind) r.grind.add(P.grind.rail.path); r.top = Math.max(r.top, P.pos.y); r.vmax = Math.max(r.vmax, P.speed || 0);
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 2, 0); if (q.hit && !P.grind) r.deep = Math.max(r.deep, q.floor - P.pos.y); }); r.falls = (rg.ORB.falls || 0) - r.falls; r.clean = !r.bail && !r.falls && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.falls ? ' FELL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const on = (y, tol) => P.grounded && Math.abs(P.pos.y - y) < (tol || 0.1);
  const steerTo = (x, z) => { const h = Math.atan2(x - P.pos.x, z - P.pos.z); rg.cam.az = h; rg.cam.steerAz = h; rg.stick.L.x = 0; rg.stick.L.y = -1; };
  const grindAll = (Pth, v, sec, after) => { const S0 = Pth.segs[0], G = Pth.segs[Pth.segs.length - 1]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), v); P.grounded = false;
    rg.enterGrind({ rail: S0, t: 0, dir: 1, s: v, side: 'left' }); let reached = 0, off = null, tE = 0, done = 0;
    const r = ride(sec, (t) => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && P.grind.rail.path === Pth) { if (Math.hypot(P.pos.x - G.b.x, P.pos.z - G.b.z) < 2 && !reached) { reached = 1; tE = t; } } else if (!reached && !off) off = [P.pos.x, P.pos.y, P.pos.z];
      if (reached && after && after()) done = 1; }); return { r, reached, off, tE, done }; };
  const at = o => o ? o.map(v => fix(v, 1)).join(',') : '';
  // the stops
  { const bad = []; for (const n of S.go) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; }); if (gr < 30 || Math.abs(P.pos.y - y0) > 0.15) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every ➤ stop stands her on a floor', !bad.length, bad.join('; ') || `${S.go.length} stops`); }
  const Cp = S.core.pads, inPad = (q, tol) => P.grounded && Math.abs(P.pos.y - q[4]) < (tol || 0.12) && P.pos.x > q[0] && P.pos.x < q[1] && P.pos.z > q[2] && P.pos.z < q[3];
  // THE LIFTS (r98): wait for one at the ground, stand on it, ride it to a stop, roll off onto the art's deck or pad there
  const liftRide = (Lf, want, exit, done, label) => { let tw = 0; for (let k = 0; k < 2000; k++) { const [, y] = Lf.fn(S.t + k * 0.05); if (y < 0.3) { tw = k * 0.05; break; } }
    run(tw + 0.3, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); });
    reset(); place(Lf.x, Lf.y + 0.05, Lf.z, 0, 0); P.vel.set(0, 0, 0); let up = -1, stay = 1;
    for (let t = 0; t < 40 && up < 0; t += DT) { rg.stick.L.x = rg.stick.L.y = 0; city(); rg.stepPlayer(DT); if (!P.grounded) stay = 0; if (P.pos.y > want - 0.1) up = t; }
    let off = 0; if (up >= 0) run(2.5, () => { steerTo(exit[0], exit[1]); city(); if (done()) off = 1; });
    say(label, up >= 0 && stay && off, `${up >= 0 ? 'up at ' + fix(up, 1) + ' s' : 'never up, y ' + fix(P.pos.y)}${stay ? '' : ', FELL OFF'}, ${off ? 'off onto it' : 'not on it, ends ' + at([P.pos.x, P.pos.y, P.pos.z])}`); };
  { const LA = S.lifts[0], LB = S.lifts[1], c = q => [(q[0] + q[1]) / 2, (q[2] + q[3]) / 2];
    liftRide(LA, 24, [c(Cp[0])[0], c(Cp[0])[1] + 2], () => inPad(Cp[0]), 'the cargo lift: ground to the 24 m pad, off north onto it');
    liftRide(LA, 32, [c(Cp[1])[0], c(Cp[1])[1] - 2], () => inPad(Cp[1]), 'the cargo lift: ground to the 32 m pad, off south onto it');
    liftRide(LB, 50, [LB.x, 13], () => on(S.tower.deck) && Math.hypot(P.pos.x, P.pos.z) < S.tower.dr - 0.5, 'the deck lift: ground to the 50 m deck, off onto it'); }
  // the art's deck: its railing is a wall (she rolls into it and stays on the deck), and its rail grinds end to end
  { go(0, 13, Math.PI / 2, 7, S.tower.deck); const r = ride(3, () => { rg.stick.L.x = 1; rg.stick.L.y = 0; rg.cam.az = rg.cam.steerAz = 0; });
    say('the deck\'s railing holds her on the deck', on(S.tower.deck) && r.clean, `ends ${at([P.pos.x, P.pos.y, P.pos.z])} r ${fix(Math.hypot(P.pos.x, P.pos.z), 1)}${cl(r)}`); }
  for (const Pth of S.paths.filter(q => q.name === 'sk8 deck rail')) { const o = grindAll(Pth, 8, 8);
    say('a deck rail grinds its arc end to end', o.reached && !o.r.bail, o.reached ? 'end in ' + fix(o.tE, 1) + ' s' : 'CAME OFF at ' + at(o.off)); }
  // the drop: from the art's 24 m pad, hands off, down the bank, up the QP XL and back, still on the base
  { go((Cp[0][0] + Cp[0][1]) / 2 + 2, S.dropZ, Math.PI / 2, 3, 24); let qp = 0; const r = ride(9, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.pos.x > 86 && P.pos.y > 3) qp = 1; });
    say('THE DROP: off the 24 m pad, down the bank, up the QP XL', qp && r.clean && P.pos.y < 6, `${fix(r.vmax, 1)} m/s at the bottom, ${qp ? 'up the QP' : 'NEVER UP THE QP'}, ends ${at([P.pos.x, P.pos.y, P.pos.z])}${cl(r)}`); }
  for (const Pth of S.paths.filter(q => q.name === 'sky drop rail')) { const o = grindAll(Pth, 4, 8, () => on(0, 0.15));
    say('a drop rail: grinds from the pad to the floor', o.reached && o.done && !o.r.bail, `${o.reached ? 'end in ' + fix(o.tE, 1) + ' s' : 'CAME OFF at ' + at(o.off)}, ${o.done ? 'on the floor' : 'ends ' + at([P.pos.x, P.pos.y, P.pos.z])}`); }
  // the bridges: off the deck (north) and the art's 32 m pads (west, south), out to each pad
  for (const [i, nm, from] of [[0, 'north', 'the deck'], [1, 'west', 'the north 32 m pad'], [2, 'south', 'the south-east 32 m pad']]) { const D = S.bridges[i], pd = S.pads.find(q => q.key === nm), pts = D.P.map(q => [q.x, q.z]);
    reset(); const p0 = D.P[2]; go(p0.x, p0.z, Math.atan2(D.P[6].x - p0.x, D.P[6].z - p0.z), 7, p0.y); let on2 = 0;
    const r = ride(16, () => { const e = pts[pts.length - 1]; steerTo(e[0] + (e[0] - pts[0][0]) * 0.05, e[1] + (e[1] - pts[0][1]) * 0.05);
      if (P.grounded && Math.abs(P.pos.y - pd.y) < 0.12 && Math.abs(P.pos.x - pd.x) < pd.h && Math.abs(P.pos.z - pd.z) < pd.h) on2 = 1; });
    say(`the ${nm} bridge: from ${from} out to the ${nm} pad`, on2 && r.clean, `${on2 ? 'on the pad' : 'ends ' + at([P.pos.x, P.pos.y, P.pos.z])}${cl(r)}`); }
  // the pads that throw her: the ground up to the north 32 m pad, the west pad over to isle T, the south pad over to isle H
  { const L = S.towerPad; go(L.x, L.z, Math.PI, 0); let got = 0; const r = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (inPad(Cp[2])) got = 1; });
    say('the tower pad throws her up onto the north 32 m pad', got && r.clean, got ? 'on it' : `ends ${at([P.pos.x, P.pos.y, P.pos.z])}, up to ${fix(r.top)}${cl(r)}`); }
  for (const [L, I] of [[S.isleT, rg.S3ISLES[0]], [S.isleH, rg.S3ISLES[1]]]) { go(L.x, L.z, 0, 0, L.y); let got = 0;
    const tr = []; const r = ride(8, (t, i) => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && Math.abs(P.pos.y - I.y) < 0.15 && Math.hypot(P.pos.x - I.x, P.pos.z - I.z) < I.r) got = 1; if (process.env.ISLETR && i % 6 === 0) tr.push(at([P.pos.x, P.pos.y, P.pos.z]) + (P.grounded ? 'g' : '') + (P.lift ? 'L' : '')); }); if (tr.length) console.log('    ' + tr.join(' | '));
    say(`isle ${I.key}: the pad throws her over and she lands on it, and stays`, got && !r.bail && !r.falls && Math.hypot(P.pos.x - I.x, P.pos.z - I.z) < I.r, `${got ? 'landed' : 'never on it'}, ends ${at([P.pos.x, P.pos.y, P.pos.z])}, up to ${fix(r.top)}${cl(r)}`); }
  { const I = rg.S3ISLES[0], N = S.pads.find(q => q.key === 'north'), o = grindAll(S.paths.find(q => q.name === 'isle T rail'), 5, 16, () => P.grounded && Math.abs(P.pos.y - N.y) < 0.12);
    say('isle T rail: off the isle down onto the north pad', o.reached && o.done && !o.r.bail, `${o.reached ? 'end in ' + fix(o.tE, 1) + ' s' : 'CAME OFF at ' + at(o.off)}, ${o.done ? 'on the pad' : 'ends ' + at([P.pos.x, P.pos.y, P.pos.z])}`); }
  { const o = grindAll(S.paths.find(q => q.name === 'isle H rail'), 5, 12, () => on(rg.KSZ.XL.H));
    say('isle H rail: off the isle down onto the bowl terrace', o.reached && o.done && !o.r.bail, `${o.reached ? 'end in ' + fix(o.tE, 1) + ' s' : 'CAME OFF at ' + at(o.off)}, ${o.done ? 'on the terrace' : 'ends ' + at([P.pos.x, P.pos.y, P.pos.z])}`); }
  for (const nm of ['sky isle T', 'sky isle H', 'plaza coping']) { const o = grindAll(S.paths.find(q => q.name === nm), nm === 'plaza coping' ? 5 : 8, 5);
    say(`${nm}: the ring grinds round`, !o.off && !o.r.bail, o.off ? 'CAME OFF at ' + at(o.off) : 'still on it after 5 s'); }
  // the plaza's planter is a solid kerb
  { const Pz = S.plaza; go(Pz.x - 9, Pz.z, Math.PI / 2, 5); const r = ride(2.5, () => { rg.stick.L.x = rg.stick.L.y = 0; });
    say('the plaza planter is solid', Math.hypot(P.pos.x - Pz.x, P.pos.z - Pz.z) > 2.9 || P.pos.y > 0.85, `ends ${fix(Math.hypot(P.pos.x - Pz.x, P.pos.z - Pz.z), 2)} m from its middle at y ${fix(P.pos.y)}${cl(r)}`); }
  // the booster up to the high pad, and the long rail back down to the base
  { const B = S.paths.find(q => q.name === 'sky booster'), NE = S.pads.find(q => q.key === 'ne'); const o = grindAll(B, 6, 14, () => P.grounded && Math.abs(P.pos.y - NE.y) < 0.12);
    say('the booster: from the north pad up onto the high pad', o.reached && o.done && o.r.clean, `${o.reached ? 'end in ' + fix(o.tE, 1) + ' s' : 'CAME OFF at ' + at(o.off)}, ${o.done ? 'on the high pad' : 'ends ' + at([P.pos.x, P.pos.y, P.pos.z])}${cl(o.r)}`); }
  { const B = S.paths.find(q => q.name === 'sky long rail'); const o = grindAll(B, 5, 16, () => on(0, 0.15));
    say('the long rail: off the high pad, over the sea, down onto the base', o.reached && o.done && !o.r.bail, `${o.reached ? 'end in ' + fix(o.tE, 1) + ' s' : 'CAME OFF at ' + at(o.off)}, top speed ${fix(o.r.vmax, 1)}, ${o.done ? 'on the base' : 'ends ' + at([P.pos.x, P.pos.y, P.pos.z])}`); }
  // the ferry: stood on it at the west pad, it carries her to the south pad
  { const F = S.ferry; let tw = 0; for (let k = 0; k < 800; k++) { const u = ((S.t + k * 0.05) % 28) / 28; if (u > 0.02 && u < 0.08) { tw = k * 0.05; break; } }
    run(tw, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); });
    reset(); place(F.x, F.y + 0.05, F.z, 0, 0); P.vel.set(0, 0, 0); const x0 = P.pos.x, z0 = P.pos.z; let stay = 1;
    run(13, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); if (!P.grounded || Math.hypot(P.pos.x - F.x, P.pos.z - F.z) > F.cr) stay = 0; });
    say('the ferry carries her from the west pad to the south pad', stay && Math.hypot(P.pos.x - x0, P.pos.z - z0) > 100, `${stay ? 'on it' : 'CAME OFF'}, carried ${fix(Math.hypot(P.pos.x - x0, P.pos.z - z0), 0)} m, ends ${at([P.pos.x, P.pos.y, P.pos.z])}`); }
  // the halo: the pad throws her up to it and she catches it
  { const H = S.halo; rg.GRIND.intent = 0; rg.ledgeClear(); go(H.pad[0], H.pad[1], 0, 0); const R = S.paths.find(q => q.name === 'sky halo');
    const r = ride(5); say('the halo pad throws her up and she catches the ring', r.grind.has(R), r.grind.has(R) ? 'on the halo' : `ends ${at([P.pos.x, P.pos.y, P.pos.z])}, up to ${fix(r.top)}`); }
  // the bowl terrace: up its north bank, into the bowl, stays in
  { const B = S.bowl; go(57, -6, Math.PI, Math.sqrt(2 * g * 4.8) + 3); let up = 0, inb = 0;
    const r = ride(6, () => { rg.stick.L.x = rg.stick.L.y = 0; if (on(4.8)) up = 1; if (Math.hypot(P.pos.x - B.x, P.pos.z - B.z) < B.rc && P.pos.y < 0.3) inb = 1; });
    say('the bowl terrace: up its bank, into the bowl XL', up && inb && r.clean, `${up ? 'up' : 'NEVER UP'}, ${inb ? 'in the bowl' : 'never in the bowl'}, ends ${at([P.pos.x, P.pos.y, P.pos.z])}${cl(r)}`); }
  // the rim rail: on it and round
  { const R = S.paths.find(q => q.name === 'sky rim'); const o = grindAll(R, 10, 6);
    say('the rim rail grinds round the base\'s edge', !o.off, o.off ? 'CAME OFF at ' + at(o.off) : `still on it after 6 s`); }
  // off a pad's edge into the sea: she is put back
  { const N = S.pads.find(q => q.key === 'north'); go(N.x - 4, N.z - 6, 0, 0, N.y); run(1.5, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); });
    const f0 = rg.ORB.falls || 0; place(N.x - 4, N.y - 6, N.z + N.h + 6, 0, 0); P.grounded = false; run(4, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); });
    say('off a pad into the sea: put back where she stood', (rg.ORB.falls || 0) > f0 && P.pos.y > 0, `${(rg.ORB.falls || 0) > f0 ? 'put back' : 'never'} at ${at([P.pos.x, P.pos.y, P.pos.z])}`); }
  // r98: HIS ART, THROUGH THE REAL LOADER AND THE SHIPPED `skyIngest`/`skyFlush` (textures cut: node decodes no images) --
  // every placed file merges, and the colliders typed from the measurement sit ON the art: at each the art's own up-facing
  // surface is found under the point and must be at the collider's height. A quarter turn the wrong way fails every row.
  { const A = rg.SKYART, files = [...new Set(A.place.map(q => q.f))], miss = [];
    for (const f of files) { try { rg.skyIngest(f, (await realGLB(A.dir + f + '.glb')).scene); } catch (e) { miss.push(f + ' ' + e.message); } }
    rg.skyFlush(); let tris = 0, near = 0; const T = [];
    for (const me of A.mesh.values()) { const g = me.geometry, P = g.attributes.position.array, I = g.index.array; tris += I.length / 3; if (!me.name.endsWith('|far')) near++;
      if (!me.name.endsWith('|far')) for (let i = 0; i < I.length; i += 3) T.push(I[i] * 3, I[i + 1] * 3, I[i + 2] * 3, P); }
    say(`his art: ${files.length} files merge into ${A.mesh.size} meshes (${near} near), ${Math.round(tris / 1000)}k triangles, ${A.mats.size} materials`, !miss.length && A.mesh.size === A.bk.size && A.mesh.size < 90, miss.join('; '));
    // the art's surface under (x, z): the highest up-facing triangle within 3 m of `y`
    const artAt = (x, z, y) => { let best = null; for (let t = 0; t < T.length; t += 4) { const P = T[t + 3], a = T[t], b = T[t + 1], c = T[t + 2];
        const ax = P[a], az = P[a + 2], ux = P[b] - ax, uz = P[b + 2] - az, vx = P[c] - ax, vz = P[c + 2] - az, det = ux * vz - uz * vx; if (Math.abs(det) < 1e-9) continue;
        const sc = ((x - ax) * vz - (z - az) * vx) / det, tc = (ux * (z - az) - uz * (x - ax)) / det; if (sc < 0 || tc < 0 || sc + tc > 1) continue;
        const h = P[a + 1] + sc * (P[b + 1] - P[a + 1]) + tc * (P[c + 1] - P[a + 1]); if (Math.abs(h - y) < 3 && (best == null || Math.abs(h - y) < Math.abs(best - y))) best = h; } return best; };
    const C = S.core, Pz = S.plaza, rows = [];
    for (const q of C.pads) rows.push([`pad ${q[5]}`, (q[0] + q[1]) / 2, (q[2] + q[3]) / 2, q[4]]);
    for (const [x0, x1, z0, z1, y] of C.blocks) rows.push([`block at ${fix((x0 + x1) / 2, 0)},${fix((z0 + z1) / 2, 0)}`, (x0 + x1) / 2, (z0 + z1) / 2, y]);
    for (const A2 of [0, 90, 180, 270]) rows.push([`deck at ${A2} deg`, 13 * Math.sin(A2 * Math.PI / 180), 13 * Math.cos(A2 * Math.PI / 180), S.tower.deck]);
    rows.push(['plaza planter', Pz.x + 1, Pz.z + 1, 0.89], ['plaza floor', Pz.x + 8, Pz.z - 3, 0.02]);
    for (const I of rg.S3ISLES) rows.push([`isle ${I.key}`, I.x + 4, I.z - 4, I.y]);
    const bad = []; for (const [nm, x, z, y] of rows) { const h = artAt(x, z, y); if (h == null || Math.abs(h - y) > 0.06) bad.push(`${nm}: art ${h == null ? 'none' : fix(h)} vs ${fix(y)}`); }
    say('every collider typed from the art sits on the art', !bad.length, bad.join('; ') || `${rows.length} spots, all within 6 cm`); }
  rg.GRIND.intent = 0;
  return ok;
};
// r91: THE COMBOS AND THE ROUND PIECES, each ridden through the shipped step -- hands off wherever the thing can be ridden
// hands off, and with the one input it is about (a swipe for a transfer, a tap for a grind or an ollie) where it cannot
CASES.combos = async () => {
  let ok = true;
  let cur = 'all'; const tested = {};
  const say = (label, good, msg) => { console.log(`  ${label.padEnd(60)} ${good ? 'ok' : 'FAIL'} ${msg}`); if (!good) ok = false;
    (tested[cur] = tested[cur] || []).push({ test: label.replace(/^[^:]*: /, ''), pass: !!good, measured: msg.trim() }); };
  if (rg.WORLD.zones !== 2) { console.log('  booted in another world -- run `npm run sim combos`'); return false; }
  const K = rg.KITW, C = rg.COMBOS, g = rg.SK.g, KSZ = rg.KSZ, city = () => rg.stepCity(DT), PI = Math.PI, P2 = Math.PI / 2;
  const reset = () => { P.mel = null; P.melQ = null; P.flip = null; P.grab = null; P.kicked = 0; P.drift = 0; rg.ORB.safe = null; P.kickRail = null; P.grindWant = 0; P.jump = 0; };
  const L = (T, u, w) => rg.kT(T, u, w, 0);
  let trT = null;
  const go = (T, u, w, phi, v, y) => { trT = T; reset(); const t = L(T, u, w); place(t.x, y != null ? y + 0.2 : 0.2, t.z, T.yaw + phi, v); if (y != null) { const q = rg.groundAt(t.x, t.z, y + 0.5, 1); if (q.hit) P.pos.y = q.floor; } };
  const loc = T => { const fx = Math.sin(T.yaw), fz = Math.cos(T.yaw), dx = P.pos.x - T.x, dz = P.pos.z - T.z; return { u: dx * fx + dz * fz, w: dx * fz - dz * fx }; };
  const steer = h => { rg.cam.az = h; rg.cam.steerAz = h; rg.stick.L.x = 0; rg.stick.L.y = -1; };
  // run, recording what happened -- and how deep she ever got inside a surface (a surface within 2 m over her feet)
  const tr = [];
  const ride = (sec, drive) => { const r = { top: -99, airMax: 0, falls: rg.ORB.falls || 0, bail: 0, deep: 0, grind: new Set(), minUp: 1 }; let a = 0; const up = new THREE.Vector3();
    run(sec, (t, i) => { if (drive) drive(t, i); else rg.stick.L.x = rg.stick.L.y = 0; city(); r.top = Math.max(r.top, P.pos.y);
      if (!P.grounded && !P.grind) { a += DT; r.airMax = Math.max(r.airMax, a); } else a = 0; if (P.bailT > 0) r.bail = 1;
      if (P.grind) { r.grind.add(P.grind.rail.path); r.minUp = Math.min(r.minUp, up.set(0, 1, 0).applyQuaternion(P.bq).y); }
      const q = rg.groundAt(P.pos.x, P.pos.z, P.pos.y + 2, 0); if (q.hit && !P.grind) r.deep = Math.max(r.deep, q.floor - P.pos.y);
      if (process.env.CTRACE && trT && i % 6 === 0) { const l = loc(trT); tr.push(`u${fix(l.u, 1)} w${fix(l.w, 1)} y${fix(P.pos.y)} v${fix(P.speed || 0, 1)}${P.grounded ? 'g' : P.grind ? 'R' : 'a'}${P.vertLock ? 'L' : ''}`); } });
    if (process.env.CTRACE) { console.log('    ' + tr.join(' | ')); tr.length = 0; }
    r.falls = (rg.ORB.falls || 0) - r.falls; r.clean = !r.bail && !r.falls && r.deep < 0.12; return r; };
  const cl = r => `${r.bail ? ' BAIL' : ''}${r.falls ? ' FELL' : ''}${r.deep >= 0.12 ? ' INSIDE ' + fix(r.deep) : ''}`;
  const pathsOf = recs => new Set(recs.flatMap(r => r.rails || (r.rail ? [r.rail] : [])));
  // THE WAY A PLAYER GETS ON (r71): a tap beside it -- with the shipped `GRIND.intent` on, so nothing is caught on
  // its own and every hands-off ride above it is honest (with it off she auto-caught the A-frame's ridge bar and rode it)
  // Pass/fail is the harness's established TAP (`railHome`, `GRIND.intent` 0 -- `kit`'s R2/R3 rule), because what is under
  // test is whether the rail is REACHABLE where it was put. The shipped swipe (intent on) is run from the same spot and
  // REPORTED: it takes the nearest thing, and a ledge's edge at her feet can outrank a rail over her head (see the wishlist).
  const swipes = [];
  const tapGrind = (T, recs, u, w, phi, v, sec, y) => { const want = pathsOf(recs), nm = ps => [...ps].map(p => (p.name || '?').replace(/^kit /, '')).join('+');
    go(T, u, w, phi, v, y); rg.girl.ready = false; const what = rg.rightFlick(0, 60); const s0 = ride(sec || 2.5);
    const sw = [...s0.grind].some(p => want.has(p)) ? 'the rail' : s0.grind.size ? nm(s0.grind) : String(what || 'nothing');
    rg.GRIND.intent = 0; rg.ledgeClear(); go(T, u, w, phi, v, y); P.jump = 1; const r = ride(sec || 2.5); rg.GRIND.intent = 1;
    r.on = [...r.grind].some(p => want.has(p)); r.got = r.grind.size ? nm(r.grind) : 'no grind'; swipes.push(`${recs[0].label.replace(/^combo /, '')}: swipe -> ${sw}`); return r; };
  rg.GRIND.intent = 1;
  // 0. THEY ARE THERE, IN THEIR CELLS, AND ON NOTHING ELSE
  const D = rg.COMBO_DEFS;
  say(`${C.list.length} combos built (${D.length} defined), every one with pieces`, C.list.length === D.length && C.list.every(c => c.recs.length), C.list.map(c => c.key + ':' + c.recs.length).join(' '));
  { const bad = []; for (const c of C.list) { const f = c.fp; if (f[0] < -1.5 || f[1] - f[0] > 64 || f[2] < -29 || f[3] > 29) bad.push(`${c.key} [${f.join(', ')}]`); }
    say('every combo inside its 60 x 64 m cell, entered from u 0', !bad.length, bad.join('; ') || C.list.map(c => `${c.key} ${fix(c.fp[1] - c.fp[0], 0)}x${fix(c.fp[3] - c.fp[2], 0)}`).join(' ')); }
  { const ours = K.pieces.filter(p => p.combo || rg.KIT_ROUND_ROW.some(r => r[3] === p.label)), others = K.pieces.filter(p => !ours.includes(p)), bad = [];
    for (const a of ours) for (const b of others) { if (!a.bb || !b.bb) continue; const o = [0, 1, 2].map(k => Math.min(a.bb[k + 3], b.bb[k + 3]) - Math.max(a.bb[k], b.bb[k])); if (o.every(v => v > 0.05)) bad.push(`${a.label} x ${b.label}`); }
    say('nothing of theirs overlaps the rest of the kit world', !bad.length, bad.slice(0, 4).join('; ') || `${ours.length} pieces clear of ${others.length}`); }
  say('no NaN vertex anywhere', !rg.MESHBAD || !rg.MESHBAD(), '');
  { const mine = K.go.filter(n => /^combo |^kit round/.test(n)), bad = [];
    for (const n of mine) { reset(); rg.goSpot(n); P.vel.set(0, 0, 0); const y0 = P.pos.y; let gr = 0;
      run(1, () => { rg.stick.L.x = rg.stick.L.y = 0; city(); gr = P.grounded ? gr + 1 : gr; });
      if (gr < 30 || Math.abs(P.pos.y - y0) > 0.1) bad.push(`${n} (y ${fix(y0)} -> ${fix(P.pos.y)})`); }
    say('every combo ➤ stop stands her on a floor, and they come first', !bad.length && K.go[0] === 'kit round pieces' && mine.length === C.list.length + 1, bad.join('; ') || `${mine.length} stops, first on the key`); }
  // 1. THE ROUND PIECES
  cur = 'round';
  const RP = rg.KIT_ROUND_ROW.map(r => K.pieces.find(p => p.label === r[3]));
  const RT = pc => ({ x: pc.T.x, y: 0, z: pc.T.z, yaw: 0 });
  for (const i of [0, 1, 2]) { const pc = RP[i], T = RT(pc), v = Math.sqrt(2 * g * pc.h) + 4; go(T, -pc.R - 6, 0.3, 0, v); const r = ride(3.5);
    say(`${pc.label}: rolled straight over it`, r.top > pc.h * 0.85 && loc(T).u > pc.R && r.clean, `${fix(v, 1)} m/s in, up to ${fix(r.top)} (h ${fix(pc.h)}), ends u ${fix(loc(T).u, 1)}${cl(r)}`); }
  { const pc = RP[1], T = RT(pc); const r = tapGrind(T, [pc], -(pc.o.top || 2) - 3, 0.6, 0, 6);
    say(`${pc.label}: a tap beside the rim grinds it`, r.on && r.clean, r.on ? 'grinding the rim' : `${r.got || ''} ends y ${fix(P.pos.y)}${cl(r)}`); }
  for (const i of [3, 4, 5]) { const pc = RP[i], T = RT(pc); go(T, -pc.R - 6, 0, 0, 8); const r = ride(2);
    const d = Math.hypot(loc(T).u, loc(T).w);
    say(`${pc.label}: a wall from the side`, d > pc.R - 0.05 || P.pos.y > pc.h - 0.05, `ends ${fix(d, 2)} m from its middle (R ${pc.R}) at y ${fix(P.pos.y)}${cl(r)}`); }
  { const pc = RP[4], T = RT(pc); const r = tapGrind(T, [pc], -pc.R - 1.6, 0.8, 0, 5);
    say(`${pc.label}: a tap beside it grinds the ring`, r.on && r.clean, r.on ? 'on the coping ring' : `${r.got || ''} ends y ${fix(P.pos.y)}${cl(r)}`); }
  // 2. THE COMBOS
  const by = C.by, T_ = k => (cur = k, by[k].T), at = k => by[k].at;
  // MINI RAMP + SPINE: drop in off deck A with no input -- over the spine, up B, and it stays in the mini; then the stairs
  { const T = T_('mini_spine'), A = at('mini_spine'); go(T, A.deckA, 0, 0, 3, KSZ.M.H); let over = 0, up = 0;
    const r = ride(8, () => { rg.stick.L.x = rg.stick.L.y = 0; const l = loc(T); if (l.u > A.spine + 1) over = 1; if (l.u > A.flatB && P.pos.y > 1.2) up = 1; });
    const l = loc(T); say('mini ramp: dropped in hands-off, over the hump and up B', over && up && l.u > A.deckA - 1 && l.u < A.deckB + 1 && r.clean, `${over ? 'over the hump' : 'NEVER OVER'}, ${up ? 'up B' : 'never up B'}, ends u ${fix(l.u, 1)}${cl(r)}`);
    go(T, -6, 0, 0, Math.sqrt(2 * g * KSZ.M.H) + 2); let on = 0; const r2 = ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && Math.abs(P.pos.y - KSZ.M.H) < 0.06) on = 1; });
    say('mini ramp: up the stairs onto deck A', on && r2.clean, on ? 'on the deck' : `${r2.got || ''} ends y ${fix(P.pos.y)}${cl(r2)}`); }
  // SPINE WAVE: rolls over all three hands-off
  { const T = T_('spine_wave'), A = at('spine_wave'), rid = by.spine_wave.ridges; go(T, A.start, 0, 0, Math.sqrt(2 * g * KSZ.M.H) + 2.5); let n = 0;
    const r = ride(6, () => { rg.stick.L.x = rg.stick.L.y = 0; while (n < 3 && loc(T).u > rid[n] + 0.5) n++; });
    say('spine wave: over all three spines, hands-off', n === 3 && r.clean, `crossed ${n} of 3, ends u ${fix(loc(T).u, 1)}${cl(r)}`); }
  // SPINE TRANSFER: hands-off she comes back; a swipe up the spine's face takes her over
  { const T = T_('spine_transfer'), A = at('spine_transfer'), v = Math.sqrt(2 * g * KSZ.M.H) + 1.5;
    go(T, A.A - 1, 0, 0, v); let max = -9; const r = ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; max = Math.max(max, loc(T).u); });
    say('spine transfer: hands-off, straight up and back', max < A.ridge && r.clean, `furthest u ${fix(max, 1)} (ridge ${fix(A.ridge, 1)})${cl(r)}`);
    go(T, A.A - 1, 0, 0, v); let sw = 0; const r2 = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; if (!sw && P.grounded && P.n.y < 0.5 && P.vel.y > 0) { rg.rightFlick(0, -52); sw = 1; } });
    const l = loc(T); say('spine transfer: a swipe up the face takes her over', sw && l.u > A.ridge + 1 && r2.clean, `${sw ? 'swiped' : 'never swiped'}, ends u ${fix(l.u, 1)} (pit B ${fix(A.B, 1)})${cl(r2)}`); }
  // ROLL-IN TO VERT: off the deck with no input, across, and up the XL wall
  { const T = T_('vert_rollin'), A = at('vert_rollin'); go(T, A.deck, 0, 0, 1.5, KSZ.XL.H); let vb = 0;
    const r = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && P.pos.y < 0.1) vb = Math.max(vb, P.speed); });
    say('roll-in to vert: dropped in hands-off, up the XL wall', r.top > KSZ.XL.H * 0.85 && loc(T).u > A.toe && r.clean, `${fix(vb, 1)} m/s at the bottom, up the wall to ${fix(r.top)} (H ${KSZ.XL.H})${cl(r)}`); }
  // RACETRACK: dropped in, it stays in; then steered round the lane, a whole lap
  { const T = T_('donut'), A = at('donut'); go(T, 0.4, 0, 0, 3, KSZ.M.H); let maxR = 0;
    const r = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; });
    const l = loc(T); say('racetrack: dropped in hands-off, stays in the bowl', l.u > 1 && l.u < 41 && r.clean, `ends u ${fix(l.u, 1)} w ${fix(l.w, 1)}${cl(r)}`);
    const a0 = 13.25, b0 = 7.8, lane = t => L(T, A.centre + a0 * Math.cos(t), b0 * Math.sin(t)); let th = -Math.PI / 2, swept = 0;
    { const s = lane(th); reset(); place(s.x, 0.2, s.z, T.yaw + 0, 8); }
    const r2 = ride(14, () => { const l2 = loc(T), t = Math.atan2(l2.w / b0, (l2.u - A.centre) / a0); let d = t - th; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; swept += d; th = t;
      const q = lane(t + 0.35); steer(Math.atan2(q.x - P.pos.x, q.z - P.pos.z)); maxR = Math.max(maxR, Math.hypot((l2.u - A.centre) / (a0 + 3), l2.w / (b0 + 3))); });
    say('racetrack: steered round the island, a whole lap', swept > 2 * Math.PI && r2.clean, `swept ${fix(swept / Math.PI * 180, 0)} deg${cl(r2)}`); }
  // VOLCANO BOWL: dropped in, over the volcano, up the far wall, still in
  { const T = T_('volcano_bowl'), A = at('volcano_bowl'); go(T, 0.4, 0.4, 0, 3, KSZ.M.H); let over = 0;
    const r = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (Math.hypot(loc(T).u - A.c, loc(T).w) < 1.5 && P.pos.y > 1) over = 1; });
    const d = Math.hypot(loc(T).u - A.c, loc(T).w); say('volcano bowl: dropped in hands-off, over the volcano, stays in', over && d < A.R && r.clean, `${over ? 'over the top' : 'MISSED IT'}, up to ${fix(r.top)}, ends ${fix(d, 1)} m from the middle${cl(r)}`); }
  // DRUM BOWL: dropped in beside the drum, across and back; a tap at the drum grinds its ring
  { const T = T_('drum_bowl'), A = at('drum_bowl'); go(T, 0.4, 4, 0, 3, KSZ.L.H); const r = ride(5);
    const d = Math.hypot(loc(T).u - A.c, loc(T).w); say('drum bowl: dropped in hands-off past the drum, stays in', d < A.R && d > 2.1 && r.clean && r.top > KSZ.L.H * 0.8, `up to ${fix(r.top)}, ends ${fix(d, 1)} m from the middle${cl(r)}`);
    const pc = by.drum_bowl.recs.find(p => p.kind === 'drum'); const r2 = tapGrind(T, [pc], A.c - 4, 0.8, 0, 5);
    say('drum bowl: a tap beside the drum grinds its ring', r2.on && r2.clean, r2.on ? 'on the ring' : `${r2.got || ''} ends y ${fix(P.pos.y)}${cl(r2)}`); }
  // A-FRAME: straight over it hands-off; a tap beside the ridge grinds the bar
  { const T = T_('aframe'), A = at('aframe'); go(T, -8, 0, 0, Math.sqrt(2 * g * KSZ.M.H) + 3); const r = ride(4);
    say('A-frame: up, along the ridge, down, hands-off', r.top > KSZ.M.H * 0.9 && loc(T).u > A.end && r.clean, `up to ${fix(r.top)}, ends u ${fix(loc(T).u, 1)}${cl(r)}`);
    const r2 = tapGrind(T, by.aframe.recs, A.top - 2, 2.6, 0, 7);
    say('A-frame: a tap from the bank grinds a rail', r2.on && r2.clean, r2.on ? 'grinding' : `${r2.got || ''} ends y ${fix(P.pos.y)}${cl(r2)}`); }
  // STAIR SETS: up the stairs and down the hubba set, hands-off; up the bank; a tap onto a handrail, a hubba, the ledge
  { const T = T_('stair_sets'), A = at('stair_sets'), Hm = KSZ.M.H, v = Math.sqrt(2 * g * Hm) + 2;
    go(T, -6, 0, 0, v); let deck = 0; const r = ride(5, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && Math.abs(P.pos.y - Hm) < 0.06) deck = 1; });
    say('stair sets: up the stairs, across, down the hubba set, hands-off', deck && loc(T).u > A.end && P.pos.y < 0.1 && r.clean, `${deck ? 'over the deck' : 'never on the deck'}, ends u ${fix(loc(T).u, 1)} y ${fix(P.pos.y)}${cl(r)}`);
    go(T, -6, -6, 0, v); let d2 = 0; const r2 = ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && Math.abs(P.pos.y - Hm) < 0.06) d2 = 1; });
    say('stair sets: up the bank onto the deck', d2 && r2.clean, d2 ? 'on the deck' : `${r2.got || ''} ends y ${fix(P.pos.y)}${cl(r2)}`);
    const recs = by.stair_sets.recs, st = recs[0], hb = recs.find(p => p.o.hubba), le = recs.find(p => p.kind === 'ledge');
    const a = tapGrind(T, [st], A.top + 1, 0, PI, 5, 3, Hm); say('stair sets: a tap on the landing takes a handrail down', a.on && a.clean, a.on ? 'grinding' : `${a.got || ''} ends y ${fix(P.pos.y)}${cl(a)}`);
    const b = tapGrind(T, [hb], A.top + 4.5, 0.8, 0, 5, 3, Hm); say('stair sets: a tap at the top of the far set takes a hubba', b.on && b.clean, b.on ? 'grinding' : `${b.got || ''} ends y ${fix(P.pos.y)}${cl(b)}`);
    const c2 = tapGrind(T, [le], 2, 4.2, 0, 6); say('stair sets: a tap beside the ledge grinds it', c2.on && c2.clean, c2.on ? 'grinding' : `${c2.got || ''} ends y ${fix(P.pos.y)}${cl(c2)}`); }
  // FUNBOX + GAPS: over the funbox hands-off; both gaps cleared rolling in; a tap onto the funbox rail
  { const T = T_('funbox_gaps'), A = at('funbox_gaps'); go(T, -6, 0, 0, Math.sqrt(2 * g * KSZ.M.H) + 2.5); const r = ride(6);
    say('funbox + gaps: over the funbox, hands-off', r.top > KSZ.M.H * 0.9 && loc(T).u > A.end && r.clean, `up to ${fix(r.top)}, ends u ${fix(loc(T).u, 1)}${cl(r)}`);
    for (const sd of [-8.5, 8.5]) { const gp = by.funbox_gaps.recs.find(p => p.kind === 'gap' && Math.abs(loc(T).w) >= 0 && Math.abs(((p.T.x - T.x) * Math.cos(T.yaw) - (p.T.z - T.z) * Math.sin(T.yaw)) - sd) < 0.1);
      const hk = KSZ.S.H * 0.6, u0 = 2 + gp.len - 3 - hk / Math.tan(18 * Math.PI / 180); let land = null; go(T, -8, sd, 0, 12);
      const r2 = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; const l = loc(T); if (!land && P.grounded && l.u > u0 - 0.5 && P.pos.y > 0.05) land = l; });
      say(`funbox + gaps: the ${sd < 0 ? 'west' : 'east'} gap cleared at 12 m/s`, !!land && r2.clean, land ? `landed at u ${fix(land.u, 1)} (landing from ${fix(u0, 1)})` : `never landed${cl(r2)}`); }
    const r3 = tapGrind(T, [by.funbox_gaps.recs[0]], A.box - 3, 1.6, 0, 7);
    say('funbox + gaps: a tap from the front bank grinds a rail', r3.on && r3.clean, r3.on ? 'grinding' : `${r3.got || ''} ends y ${fix(P.pos.y)}${cl(r3)}`); }
  // WAVE WALL: hit it square at a low point and at a high point, hands-off -- up the face and back off it
  { const T = T_('wave_wall'), A = at('wave_wall'); for (const w of [-15, -10, 0]) { const H0 = Math.abs(w / 5) % 2 ? 2.4 : 1.2; go(T, A.u - 8, w, 0, Math.sqrt(2 * g * H0) + 2); const r = ride(3);
      say(`wave wall: square at w ${w} (coping ${H0} m), up and back`, r.top > H0 * 0.8 && loc(T).u < A.u && r.clean, `up to ${fix(r.top)}, ends u ${fix(loc(T).u, 1)}${cl(r)}`); }
    go(T, A.u - 4, -17, P2 - 0.35, 10); const r = ride(4); const l = loc(T);
    say('wave wall: carved along it at a slant, hands-off', l.w > -8 && r.clean, `travelled to w ${fix(l.w, 1)}, up to ${fix(r.top)}${cl(r)}`); }
  // EURO GAP: up the bank, along the deck, a tap at the lip -- onto the landing; and no ollie is the gap
  { const T = T_('euro_gap'), A = at('euro_gap'), v = Math.sqrt(2 * g * KSZ.M.H) + 1.5; let land = null, popped = 0;
    go(T, -6, 0, 0, v); const r = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; const l = loc(T); if (!popped && P.grounded && l.u > A.lip - 0.8) { P.jump = 1; popped = 1; }
      if (!land && popped && P.grounded && l.u > A.land && P.pos.y > 0.05) land = l; });
    say('euro gap: an ollie off the lip clears the gap', !!land && r.clean, land ? `landed at u ${fix(land.u, 1)} y ${fix(P.pos.y)} (the landing's top at ${fix(A.land, 1)})` : `never landed${cl(r)}`);
    go(T, -6, 0, 0, v); let lo = 0; const r2 = ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; const l = loc(T); if (l.u > A.lip + 0.5 && l.u < A.land && P.pos.y < 1.2 && P.grounded) lo = 1; });
    say('euro gap: no ollie, and she is in the gap', lo || loc(T).u < A.land, `ends u ${fix(loc(T).u, 1)} y ${fix(P.pos.y)}`); }
  // THREAD THE NEEDLE: round the loop; and the rail straight through the middle of it
  { const T = T_('thread_needle'), A = at('thread_needle'), lp = by.thread_needle.recs.find(p => p.kind === 'loop360'), rl = by.thread_needle.recs.find(p => p.kind === 'rail');
    const S0 = lp.rail.segs[0]; reset(); place(S0.a.x, S0.a.y, S0.a.z, Math.atan2(S0.hx, S0.hz), 8); P.grounded = false; rg.enterGrind({ rail: S0, t: 0, dir: 1, s: 10, side: 'left' });
    const r = ride(3); say('thread the needle: round the loop, upside down at the top', r.minUp < -0.6 && !r.falls, `her up got to ${fix(r.minUp)}`);
    const R0 = rl.rails[0]; let through = 0; const r2 = tapGrind(T, [rl], A.centre - 2.6, -13, P2, 6, 4);
    reset(); const S1 = R0.segs[0]; place(S1.a.x, S1.a.y, S1.a.z, Math.atan2(S1.hx, S1.hz), 8); P.grounded = false; rg.enterGrind({ rail: S1, t: 0, dir: 1, s: 8, side: 'left' });
    const r3 = ride(4, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind && loc(T).w > -1) through = 1; });
    say('thread the needle: a tap from the ground catches the rail', r2.on && r2.clean, r2.on ? 'grinding' : `${r2.got || ''} ends y ${fix(P.pos.y)}${cl(r2)}`);
    say('thread the needle: the rail runs straight through the loop', through && !r3.falls, through ? `through the loop at y ${fix(A.railY)} (loop centre ${fix(1 + A.R)})` : 'came off before the loop'); }
  // CORKSCREW: up the bank to the deck; a tap at the deck edge, two turns down, onto the Y
  { const T = T_('corkscrew'), A = at('corkscrew'), Hl = KSZ.L.H; go(T, -6, -3, 0, Math.sqrt(2 * g * Hl) + 2); let deck = 0;
    const r = ride(3, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grounded && Math.abs(P.pos.y - Hl) < 0.06) { deck = 1; P.vel.multiplyScalar(0.9); } });
    say('corkscrew: up the bank onto the deck', deck && r.clean, deck ? 'on the deck' : `${r.got || ''} ends y ${fix(P.pos.y)}${cl(r)}`);
    const hx = by.corkscrew.recs.find(p => p.kind === 'helix'), y = by.corkscrew.recs.find(p => p.kind === 'railY'); let onY = 0, lowH = 99;
    const r2 = tapGrind(T, [hx], A.start - 1.5, -0.8, 0, 4, 0.6, Hl); let onH = r2.on;
    if (onH) { const r3 = ride(6, () => { rg.stick.L.x = rg.stick.L.y = 0; if (P.grind) { if (y.rails.includes(P.grind.rail.path)) onY = 1; else lowH = Math.min(lowH, P.pos.y); } });
      say('corkscrew: a tap at the deck edge, two turns down, onto the Y', onY && r3.clean, `${onY ? 'onto the Y' : 'never reached the Y'}, helix down to ${fix(lowH)}${cl(r3)}`); }
    else say('corkscrew: a tap at the deck edge catches the helix', false, `${r2.got || ''} ends y ${fix(P.pos.y)}${cl(r2)}`); }
  // PUMP TRACK: steered round the loop of rollers and berms, a whole lap
  { const T = T_('pump_track'), r0 = at('pump_track').r; const cx = 17, way = []; for (let i = 0; i <= 40; i++) { const s = i / 40 * 2;
      // a stadium: straight w -r from u 12 -> 22, round (22, 0), back along w +r, round (12, 0)
      if (s < 0.5) way.push([12 + 20 * s, -r0]); else if (s < 1) { const a = (s - 0.5) * 2 * Math.PI; way.push([22 + r0 * Math.sin(a), -r0 * Math.cos(a)]); }
      else if (s < 1.5) way.push([22 - 20 * (s - 1), r0]); else { const a = (s - 1.5) * 2 * Math.PI; way.push([12 - r0 * Math.sin(a), r0 * Math.cos(a)]); } }
    go(T, 12.5, -r0, 0, 8); let k = 0, laps = 0;
    const r = ride(16, () => { const l = loc(T); let bi = k; for (let j = 0; j < 6; j++) { const q = way[(k + j) % way.length]; if (Math.hypot(q[0] - l.u, q[1] - l.w) < 2.2) bi = k + j + 1; } if (bi >= way.length) laps++; k = bi % way.length;
      const q = way[(k + 1) % way.length], t = L(T, q[0], q[1]); steer(Math.atan2(t.x - P.pos.x, t.z - P.pos.z)); });
    say('pump track: steered round the berms, a whole lap', laps >= 1 && r.clean, `${laps} lap(s), ${k} of ${way.length} waypoints, top ${fix(r.top)}${cl(r)}`); void cx; }
  console.log('  the shipped swipe down from the same spots (reported, not judged):');
  for (const l of swipes) console.log('    ' + l);
  // WHAT WAS MEASURED GOES OUT WITH THE LIBRARY: `export:lib` puts each combo's rows on its group node and in the JSON
  fs.writeFileSync('handoff/rollergirl_combo_tests.json', JSON.stringify({ note: 'written by `npm run sim combos`: every ride through the shipped step', tests: tested, swipes }, null, 1) + '\n');
  // 3. THE LIBRARY ROUND TRIP: `npm run export:lib` written, parsed back through the vendored GLTFLoader, and its COMBOS
  //    alone handed to the shipped `levelIngest` turned 180 and moved -- every combo group comes back with its pieces, the
  //    same kinds and options, every raised floor at the same height and every rail end in place. This is the file he
  //    takes into Blender; the group nodes are what he moves, and the pieces have to follow them.
  cur = 'library';
  { const { spawnSync } = await import('child_process');
    const ex = spawnSync(process.execPath, ['tools/export.mjs', 'kit', 'lib'], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const file = 'handoff/rollergirl_kit_library.glb';
    if (ex.status !== 0 || !fs.existsSync(file)) { say('export:lib runs', false, (ex.stderr || '').split('\n').slice(-4).join(' | ')); return ok; }
    const gl = await realGLB(file), J = JSON.parse(fs.readFileSync('handoff/rollergirl_kit_library.json', 'utf8'));
    const groups = []; gl.scene.traverse(o => { if (/^combo_/.test(o.name || (o.userData && o.userData.name) || '')) groups.push(o); });
    const kids = g => { let n = 0; g.traverse(o => { if (o !== g && o.userData && o.userData.fn) n++; }); return n; };
    say('every combo is a group node in the library, its pieces under it', groups.length === C.list.length && groups.every((g, i) => kids(g) === C.list[i].recs.length) && J.combos.length === C.list.length,
      `${groups.length} groups, ${groups.map(kids).reduce((p, q) => p + q, 0)} pieces under them; JSON lists ${J.combos.length} with entries, exits and heights`);
    const all = C.list.flatMap(c => c.recs), gf = (x, z) => { const q = rg.groundAt(x, z, 30, 0); return q.hit ? q.floor : -1; }, samp = [];
    for (const pc of all) { if (!pc.bb) continue; for (let x = pc.bb[0] - 1 + 0.0137; x <= pc.bb[3] + 1; x += 0.6) for (let z = pc.bb[2] - 1 + 0.0291; z <= pc.bb[5] + 1; z += 0.6) { const a = gf(x, z); if (a >= 0.05) samp.push([-x - 300, -z + 300, a, pc.label]); } }
    const ends = all.flatMap(pc => (pc.rails || (pc.rail ? [pc.rail] : [])).map(R => [R.segs[0].a, R.segs[R.segs.length - 1].b].map(v => [-v.x - 300, v.y, -v.z + 300])));
    rg.colliderReset(); const n0 = K.pieces.length, root = new THREE.Group(); for (const g of groups) root.add(g.clone()); root.updateMatrixWorld(true);
    const place = new THREE.Matrix4().makeTranslation(-300, 0, 300).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
    const st = rg.levelIngest(root, root, place, 'libglb'), got = K.pieces.slice(n0);
    const sig = p => p.kind + ' ' + p.size + ' ' + JSON.stringify(Object.fromEntries(Object.entries(p.o || {}).filter(([k]) => k !== 'yaw').sort()));
    const A = all.map(sig).sort().join('|'), B = got.map(sig).sort().join('|');
    say('its combos rebuild: same pieces, same options', got.length === all.length && A === B, `${st.fn} fn_ nodes -> ${got.length} pieces (${all.length} in the gallery)`);
    let bad = 0, worst = 0; for (const [x, z, a] of samp) { const d = Math.abs(a - gf(x, z)); worst = Math.max(worst, d); if (d > 0.02) bad++; }
    say('every raised floor of every combo at the same height on the copy', samp.length > 5000 && !bad, `${samp.length} points, ${bad} off, worst ${fix(worst, 3)} m`);
    const gotEnds = got.flatMap(pc => (pc.rails || (pc.rail ? [pc.rail] : [])).flatMap(R => [R.segs[0].a, R.segs[R.segs.length - 1].b]));
    let rbad = 0; for (const e of ends.flat()) { const d = Math.min(...gotEnds.map(v => Math.hypot(v.x - e[0], v.y - e[1], v.z - e[2]))); if (d > 0.01) rbad++; }
    say('every combo rail comes back with both ends in place', ends.length > 10 && !rbad, `${ends.length * 2} rail ends, ${rbad} off`); }
  return ok;
};

// A one-off trace, so a question that is not worth a permanent case still gets measured
// rather than reasoned about: SIM_PROBE=tools/probe-lip.mjs npm run sim
if (process.env.SIM_PROBE) {
  const mod = await import(pathToFileURL(path.resolve(process.env.SIM_PROBE)).href);
  await mod.default(rg, THREE);
  process.exit(0);
}
// r90: THE KIT WORLD'S PARK, DUMPED, so `parkd` (in the main world) can hold its copy to it -- the same file built by the same
// code in another world, sampled in the schematic's own (kit) coordinates
if (process.argv[2] === 'parkdump') {
  const S = rg.SHEET, out = { floor: S.floor, pts: [], pieces: [], rails: [] };
  const inPoly = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const gf = (x, z, y) => { const q = rg.groundAt(x, z, y, 0); return q.hit ? +q.floor.toFixed(4) : null; }, so = (x, y, z) => rg.solidAt(x, y, z, 0) ? 1 : 0;
  for (let x = S.x0 + 0.0137; x <= S.x1; x += 0.8) for (let z = S.z0 + 0.0291; z <= S.z1; z += 0.8) if (inPoly(x, z, S.floor))
    out.pts.push([+x.toFixed(4), +z.toFixed(4), gf(x, z, 40), gf(x, z, 0.5), so(x, 0.6, z), so(x, 3, z), so(x, 9, z)]);
  const sheet = rg.KITW.pieces.filter(pc => pc.park && /^sheet /.test(pc.park));
  out.pieces = sheet.map(parkSig);
  for (const pc of sheet) for (const R of pc.rails || (pc.rail ? [pc.rail] : [])) out.rails.push([R.segs[0].a, R.segs[R.segs.length - 1].b].map(e => [e.x, e.y, e.z]));
  fs.writeFileSync(process.argv[3], JSON.stringify(out)); process.exit(0);
}
const only = process.argv[2];
let fail = 0;
for (const k of Object.keys(CASES)) {
  if (only && k !== only) continue;
  console.log(`\n== ${k} ==`);
  let ok = false;
  // the zones case needs a page booted in the OTHER world, so a full run hands it to a process of its own
  if ((k === 'zones' || k === 'kit' || k === 'combos' || k === 'parkref' || k === 'city' || k === 'sky') && !only) {
    const { spawnSync } = await import('child_process');
    const r = spawnSync(process.execPath, [process.argv[1], k], { encoding: 'utf8', maxBuffer: 64 << 20 });
    process.stdout.write((r.stdout || '').split('\n').filter(l => !/^== (zones|kit|combos|parkref|city|sky) ==|all cases pass|case\(s\) failed/.test(l)).join('\n'));
    ok = r.status === 0;
  } else
  try { rg.GRIND.intent = 0; rg.CTRL.map = 1; rg.VERT.flickBoost = k === 'vert86' ? 1 : 0; Object.assign(rg.SK, ROUTE.has(k) ? R83PUSH : PUSH84); if (process.env.SKOLD) Object.assign(rg.SK, JSON.parse(process.env.SKOLD)); if (process.env.NOFACE) rg.SK.faceCatch = 0; ok = await CASES[k](); } catch (e) { console.error('  THREW', e); }      // r71: and again before every case -- `panel` presses RESET, which puts it back on
  if (!ok) { fail++; console.log('  -> FAIL'); }
}
console.log(fail ? `\n${fail} case(s) failed` : '\nall cases pass');
process.exit(fail ? 1 : 0);
