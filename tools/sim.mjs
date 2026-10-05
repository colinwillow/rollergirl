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
  for (const [v, pop, fwd] of [[13, 0, 0], [17, 0, 0], [21, 0, 0], [13, 1, 0], [17, 1, 0], [17, 1, 1], [17, 0, 1],
                               [13, 2, 0], [17, 2, 0], [21, 2, 0], [17, 2, 1]]) {
    const xfer = pop === 2;
    place(0, 3, 29, 0, v);
    let phase = 0, landZ = 0, apex = -9;
    run(5, (t, i) => {
      rg.stick.L.x = 0; rg.stick.L.y = fwd ? -1 : 0; rg.cam.az = 0;
      // AT THE LIP, not merely near it. The band from 58 degrees to 88 is only 40 cm of z, so
      // a trigger at 35.2 pops her off a 58-degree face -- and flying out over the deck off a
      // 58-degree face is correct, not a fault. This is the LIP.
      if (pop && P.grounded && P.pos.z > 35.55) P.jump = pop;
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
  }
  // AND THE BOWL, the other place he named: ridden from the middle up its wall, a tap at the lip
  // comes back in and a swipe goes out over the rim onto the plaza.
  const B = rg.BOWL;
  for (const [v, pop] of [[12, 1], [12, 2], [15, 2]]) {
    place(B.x, -2, B.z, Math.PI / 2, v);
    let phase = 0, land = null, fired = 0;
    run(5, () => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
      if (!fired && P.grounded && P.n.y < 0.3 && P.vel.y > 0) { P.jump = pop; fired = 1; }
      if (phase === 0 && !P.grounded) phase = 1;
      if (phase === 1 && P.grounded) { phase = 2; land = Math.hypot(P.pos.x - B.x, P.pos.z - B.z); } });
    const out = land !== null && land > B.r;
    console.log(`  bowl at ${v} m/s + ${pop === 2 ? 'SWIPE' : 'a tap'}: ${land === null ? 'never landed' : `down ${fix(land, 1)} m from the middle (rim ${B.r})`} -- ${out ? 'OUT' : 'back in the bowl'}`);
    if (!fired || land === null || out !== (pop === 2)) ok = false;
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
      await swipe(0, -52);
      good = st && P.xferArm > 0;
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
    { const keepLock = P.stanceLock; P.stanceLock = true; place(60, 1, -60, 0, 6); P.stance = 1; P.flip = null;
      await swipeL(0, -52);
      good = !P.flip && P.stance === 1 && P.mel && P.mel.kind === 'slide';
      console.log(`  LEFT swipe on the ground      -> ${P.flip ? 'a FLIP' : P.stance < 0 ? 'a SWIVEL' : P.mel ? 'the ' + P.mel.kind : 'nothing'}${good ? '' : '   <- WRONG'}`);
      P.mel = null;
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
        const d = top(P.pos.x, P.pos.z) - P.pos.y;
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
  click(P.children[0].children[1]);
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
  // ROLLING WITH THE THUMB OFF is the neutral pose; PUSHING eases casual -> hard with her speed
  for (const [v, st, go, want] of [[6, 1, false, 'idle_normal'], [6, -1, false, 'idle_backward'],
                                   [2, 1, true, 'blade_casual_forward'], [20, 1, true, 'blade_hard_forward'],
                                   [2, -1, true, 'blade_casual_backward'], [20, -1, true, 'blade_casual_backward']]) {
    state({ speed: v, stance: st, thumbGo: go }); step(1.5);
    const a = log[want];
    check(`${v} m/s ${st > 0 ? 'forward' : 'FAKIE'}, thumb ${go ? 'pushing' : 'off'}`, top() === want && a.w > 0.95, `${top()} x${fix(a.ts)} weight ${fix(a.w)}`);
  }
  // half way between the two pushes BOTH play, and the weights still sum to one
  { const V = rg.MOVES.pushV; state({ speed: (V[0] + V[1]) / 2, stance: 1, thumbGo: true }); step(2);
    const c = log.blade_casual_forward.w, h = log.blade_hard_forward.w;
    let sum = 0; for (const k in log) sum += log[k].w;
    check(`${fix((V[0] + V[1]) / 2, 0)} m/s pushing blends casual and hard`, c > 0.3 && h > 0.3 && Math.abs(sum - 1) < 0.02, `casual ${fix(c)} hard ${fix(h)}, all ${fix(sum)}`); }
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
  const go = (phases, latch) => {
    const keep = rg.CAM.steerLatch; rg.CAM.steerLatch = latch;
    place(150, 0, -200, 0, 10); rg.cam.az = rg.cam.steerAz = 0; rg.cam.idle = 9; rg.cam.thA = null; rg.stick.L.down = 1;
    let turned = 0, last = P.heading, aim = 0;
    for (const [dur, fx] of phases) { const n = Math.round(dur / DT);
      for (let i = 0; i < n; i++) { const [x, y] = fx(i / n); rg.stick.L.x = x; rg.stick.L.y = y;
        rg.stepPlayer(DT); rg.stepCam(DT); turned += Math.abs(rg.wrapAngle(P.heading - last)); last = P.heading;
        const s = rg.stickWorld(); aim = Math.atan2(s.x, s.z); } }
    rg.stick.L.down = 0; rg.stick.L.x = rg.stick.L.y = 0; rg.CAM.steerLatch = keep;
    return { turned: turned * D, off: Math.abs(rg.wrapAngle(Math.atan2(P.vel.x, P.vel.z) - aim)) * D, travel: Math.atan2(P.vel.x, P.vel.z) * D };
  };
  const diag = [[5, () => [-0.7, -0.7]]];
  const a = go(diag, 1), b = go(diag, 0);
  console.log(`  held up-left diagonal, 5 s:      turned ${fix(a.turned, 0)} deg, travel ${fix(a.travel, 0)} (asked 45)   [old frame: turned ${fix(b.turned, 0)} deg]`);
  if (!(a.turned < 70 && Math.abs(a.travel - 45) < 5 && b.turned > 200)) ok = false;
  const swing = [[2, () => [1, 0]], [0.25, u => [Math.cos(u * Math.PI), -Math.sin(u * Math.PI)]], [3, () => [-1, 0]]];
  const c = go(swing, 1);
  console.log(`  right 2 s, swung over to left:   ends ${fix(c.off, 1)} deg off where the thumb points, travel ${fix(c.travel, 0)}`);
  if (!(c.off < 5)) ok = false;
  return ok;
};
// r47: TONY HAWK'S VERT AIR. Up the half pipe and off the lip: square to the wall the whole way up and down (her up
// stays the wall's normal), back in, forward, nothing to snap at the landing. Holding the right stick UP partway
// through turns it into a transfer onto the deck, without becoming a grab.
CASES.vertair = () => {
  let ok = true; const D = 180 / Math.PI;
  const lip = 30 + 3 + 2.6 * Math.sin(rg.PARK.hpSweep) + rg.PARK.cope;
  const ride = (opt) => {
    const keep = { t: rg.VERT.holdTilt, x: rg.VERT.holdXferOn, f: rg.VERT.airFlickXfer };
    rg.VERT.holdTilt = opt.tilt; rg.VERT.holdXferOn = opt.xfer || 0; rg.VERT.airFlickXfer = opt.fx || 0;
    const keepRd = rg.girl.ready; rg.girl.ready = false;     // headless: strikes run without clips (`melOk`)
    place(0, 3, 29, 0, 17); let swiped = null, v0 = 0; let air = false, t0 = 0, worst = 0, mid = 0, land = null, grab = false, flicked = null;
    run(5, (t) => { rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
      if (!P.grounded && !air) { air = true; t0 = t; }
      const hold = opt.hold && air && !land && t - t0 > 0.25;
      rg.stick.R.down = hold ? 1 : 0; rg.stick.R.y = hold ? -1 : 0; rg.stick.R.x = 0; P.rHold = hold ? P.rHold : 0;
      if (hold) rg.grabStep(); if (P.grab) grab = true;
      if (opt.flick && air && !land && flicked === null && t - t0 > 0.25) flicked = rg.rightFlick(0, -52);
      // r56: the GROUND swipe -- on the run-in (`run`) or once she is on the wall's face (`face`)
      if (opt.swipe && swiped === null && P.grounded && (opt.swipe === 'run' || P.n.y < 0.7)) { v0 = P.vel.length(); swiped = rg.rightFlick(0, -52); swiped += ` +${fix(P.vel.length() - v0, 1)} m/s`; }
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
  if (!(g.land.z < lip && /strike/.test(g.swiped) && /transfer/.test(k.swiped) && k.land.z > lip + 1 && k.land.stance > 0)) ok = false;
  const c = ride({ tilt: 1, flick: 1, fx: 1 }), d = ride({ tilt: 1, flick: 1 });
  console.log(`  flick UP in the air, old switch on: ${c.flicked}, down at z ${fix(c.land.z, 2)} -- ${c.land.z > lip ? 'ON THE DECK' : 'back in'}`);
  console.log(`  ...default (off):        ${d.flicked}, down at z ${fix(d.land.z, 2)} -- ${d.land.z > lip ? 'on the deck' : 'back in the pipe'}`);
  if (!(c.flicked === 'transfer' && c.land.z > lip + 1 && d.flicked !== 'transfer' && d.land.z < lip)) ok = false;
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
  for (let t = 0; t < Q.length / 9; t++) { const o = t * 9; if (Math.abs(Q[o + 1]) < 0.06) plz.push([Q[o], Q[o + 2], Q[o + 3], Q[o + 5], Q[o + 6], Q[o + 8], Q[o + 1]]); }
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
  return exact.length === 0 && off;
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
    // the settle: high over it, moving, right pad held DOWN -- speed bleeds off, body squares to the face
    const keepSP = rg.AIR.settleRamp; rg.AIR.settleRamp = 1;     // r56: the pad settles only with a ramp below (this is one)
    place(0, 1, 34.6, 0, 0); P.grounded = false; P.pos.y = n0.floor + 14; P.vel.set(0, 2, 8); P.airT = 0.3;
    Object.assign(rg.stick.R, { down: 1, x: 0, y: 1 });
    run(0.7, () => { rg.stick.L.x = rg.stick.L.y = 0; });
    const hs = Math.hypot(P.vel.x, P.vel.z), so = upOff(), high = P.pos.y - n0.floor;
    Object.assign(rg.stick.R, { down: 0, x: 0, y: 0 }); rg.AIR.settleRamp = keepSP;
    chk('settle: right pad held down, high over a ramp', hs < 1.5 && so < 10 && high > 3,
        `8 m/s -> ${fix(hs, 2)} m/s across, body ${fix(so, 1)} deg off the face, still ${fix(high, 1)} m up`);
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
  { place(0, 0, -97, Math.PI, 9); let at = null; run(4, () => { fwd(Math.PI); city(); if (!at && P.pos.z < -124 && P.grounded) at = P.pos.clone(); });
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
    let kk = 0; run(sec, () => { along(route); city(); low = Math.min(low, P.pos.y); if (process.env.DBG === label.slice(0, 7) && kk++ % (process.env.DBGN ? +process.env.DBGN : 10) === 0) console.log('   ', fix(P.pos.x, 2), fix(P.pos.y, 2), fix(P.pos.z, 2), 'v', fix(P.speed), P.grounded ? 'G' : 'air', P.grind ? 'GRIND' : ''); if (!hit && goal(P.pos) && P.grounded) { hit = P.pos.clone(); hit.sp = O.splashes; } });
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

// A one-off trace, so a question that is not worth a permanent case still gets measured
// rather than reasoned about: SIM_PROBE=tools/probe-lip.mjs npm run sim
if (process.env.SIM_PROBE) {
  const mod = await import(pathToFileURL(path.resolve(process.env.SIM_PROBE)).href);
  await mod.default(rg, THREE);
  process.exit(0);
}
const only = process.argv[2];
let fail = 0;
for (const k of Object.keys(CASES)) {
  if (only && k !== only) continue;
  console.log(`\n== ${k} ==`);
  let ok = false;
  try { ok = await CASES[k](); } catch (e) { console.error('  THREW', e); }
  if (!ok) { fail++; console.log('  -> FAIL'); }
}
console.log(fail ? `\n${fail} case(s) failed` : '\nall cases pass');
process.exit(fail ? 1 : 0);
