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
  P.bailT = 0; P.lean = 0;
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
      if (stop < 0 && t > 0.05 && P.speed < 0.4) stop = t;
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
    console.log(`  leaving a ${fix(wall, 0)} deg face: ${fix(plumb, 0)} deg off plumb 0.8 s later` +
                (P.grounded ? ' (back on the ground)' : ''));
    if (!(plumb < 14)) ok = false;
  }
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
  for (const [v, pop] of [[13, 0], [17, 0], [21, 0], [13, 1], [17, 1]]) {
    place(0, 3, 29, 0, v);
    let phase = 0, landZ = 0, apex = -9;
    run(5, (t, i) => {
      rg.stick.L.x = rg.stick.L.y = 0; rg.cam.az = 0;
      // AT THE LIP, not merely near it. The band from 58 degrees to 88 is only 40 cm of z, so
      // a trigger at 35.2 pops her off a 58-degree face -- and flying out over the deck off a
      // 58-degree face is correct, not a fault. This is the LIP.
      if (pop && P.grounded && P.pos.z > 35.55) P.jump = 1;
      if (phase === 0 && !P.grounded) phase = 1;
      if (phase === 1) { apex = Math.max(apex, P.pos.y); if (P.grounded) { phase = 2; landZ = P.pos.z; } }
    });
    const lip = 30 + 3 + 2.6 * Math.sin(rg.PARK.hpSweep), deck = lip + rg.PARK.cope;
    const where = landZ > deck ? 'ON THE DECK' : 'back in the pipe';
    console.log(`  in at ${String(v).padStart(2)} m/s${pop ? ' + a pop' : '       '}: ` +
                `apex ${fix(apex)} m (coping is ${fix(2.6 * (1 - Math.cos(rg.PARK.hpSweep)))}), ` +
                `down at z ${fix(landZ)}, lip ${fix(lip)} -- ${where}`);
    // AT A REALISTIC AIR SHE COMES BACK IN; a 21 m/s launch that goes ten metres above the
    // coping genuinely overshoots onto the platform, and that is skating rather than a bug.
    // What must ALWAYS hold is that she LEAVES -- the lip must never eat her climb again.
    // WHAT MUST ALWAYS HOLD is that she LEAVES -- the lip must never eat her climb again -- and
    // that the slowest realistic ride out comes back in. Past that, a launch twenty metres over
    // the coping genuinely overshoots onto the platform, and that is speed rather than a fault.
    if (phase !== 2) ok = false;
    if (v === 13 && !pop && landZ > deck) ok = false;
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
    pad.dispatchEvent(ev('pointerdown', x0, y0));
    if (x1 !== x0 || y1 !== y0) pad.dispatchEvent(ev('pointermove', x1, y1));
    await wait(ms);
    pad.dispatchEvent(ev('pointerup', x1, y1));
    const got = !!P.jump;
    // a tap is a thumb that did not travel and did not linger; everything else is the camera
    const want = Math.hypot(x1 - x0, y1 - y0) / 52 < rg.AIR.tapFar && ms < rg.AIR.tapT * 1000;
    console.log(`  ${name.padEnd(26)} -> ${got ? 'JUMP' : 'no jump'}${got === want ? '' : '   <- WRONG'}`);
    if (got !== want) ok = false;
    P.jump = 0;
  }
  return ok;
};

// ---------------------------------------------------------------- the stick in the air
// X spins her, Y pushes her, and there is no flip any more. The thrust is what lets her clear
// the back of one ramp and reach the next, so what matters is how far it actually carries her.
CASES.airctl = () => {
  let ok = true;
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
    console.log(`  ${name.padEnd(13)} yaw ${fix(yaw, 0).padStart(5)} deg, carried ${fix(z1 - z0)} m over ${fix(air)} s of air`);
    // heading grows +Z toward +X, which turns her LEFT, so a thumb pushed RIGHT must DECREASE it
    if (name === 'spin right' && !(yaw < -240)) ok = false;
    if (name === 'spin left' && !(yaw > 240)) ok = false;
    if (name === 'no input' && Math.abs(yaw) > 1) ok = false;
    if (name === 'hold forward' && !(z1 - z0 > 16)) ok = false;
  }
  // and the thrust has to be worth holding: it is the difference between the last two rows
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
  const was = rg.AIR.land, wasE = rg.AIR.ease; rg.AIR.land = 0.95; rg.AIR.ease = 0;
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
  rg.AIR.land = was; rg.AIR.ease = wasE;
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
  return peaks.length >= 4 && keep > 0.6;
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
  return peaks.length > 2 && Math.max(...peaks) > H * 0.9;
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
    const clips = rg.normaliseClips(buildClips(readGLB(C.file), THREE));
    const R = rg.clipRoles(clips);
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
  rg.scene.remove(holder); rg.girl.tail = null;
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
