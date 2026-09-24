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
    const off = up0 ? degBetween(up0, nWall) : -1;
    console.log(`  leaving a ${fix(wall, 0)} deg face: her own up is ${fix(off, 1)} deg off it`);
    if (!(off >= 0 && off < 2)) ok = false;
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
    if (phase !== 2) ok = false;
    if (v <= 13 && landZ > deck) ok = false;
  }
  return ok;
};
// ---------------------------------------------------------------- the stick turns the body
CASES.rotate = () => {
  const cases = [['spin right', 1, 0, [0, 1, 0]], ['spin left', -1, 0, [0, 1, 0]],
                 ['flip forward', 0, -1, [1, 0, 0]], ['flip back', 0, 1, [1, 0, 0]]];
  let ok = true;
  for (const [name, sx, sy, ax] of cases) {
    place(60, 1, -60, 0, 6);
    P.jump = 1;
    const q0 = P.bq.clone();
    run(0.5, () => { rg.cam.az = 0; rg.stick.L.x = sx; rg.stick.L.y = sy; });
    const d = q0.clone().invert().multiply(P.bq);
    const ang = 2 * Math.acos(Math.min(1, Math.abs(d.w))) * 180 / Math.PI;
    const along = Math.abs(new THREE.Vector3(d.x, d.y, d.z).normalize().dot(new THREE.Vector3(...ax))) * 100;
    console.log(`  ${name.padEnd(13)} ${fix(ang, 0)} deg in 0.5 s, ${fix(along, 0)}% about the expected axis`);
    if (!(ang > 55 && along > 96)) ok = false;
  }
  return ok;
};
// ---------------------------------------------------------------- and a bad landing is a bail
CASES.bail = () => {
  let ok = true;
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
  let bad = 0, worst = 0, lowest = 9;
  for (let seed = 0; seed < 6; seed++) {
    place((seed - 3) * 9, 2, -10 + seed * 7, seed, 4);
    let r = seed * 1234.5;
    run(25, (t, i) => {
      r = (r * 9301 + 49297) % 233280;
      if (i % 40 === 0) { rg.stick.L.x = (r / 233280) * 2 - 1; rg.stick.L.y = -0.9; rg.cam.az = (r / 233280) * 6.28; }
      if (i % 97 === 0) P.jump = 1;
      lowest = Math.min(lowest, P.pos.y);
      if (P.pos.y < -6) { bad++; if (bad < 4) console.log(`    fell at ${fix(P.pos.x)},${fix(P.pos.z)} (run ${seed})`); }
      worst = Math.max(worst, P.speed);
    });
  }
  console.log(`  6 runs x 25 s of scripted input: ${bad} frames under the world, lowest ${fix(lowest)} m, fastest ${fix(worst)} m/s`);
  return bad === 0 && worst < 40;
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
// NO HARNESS HERE CAN BUILD A SKIN -- her GLB is draco and `DRACOLoader` wants a Worker -- so
// the actions are FABRICATED, carrying the real clip durations read out of the file. That is
// enough, because the question is not what the clip looks like: it is what `girlAnim` ASKS the
// mixer for. A weight table and a time scale are numbers, and "she holds the pose" is a claim
// about numbers.
CASES.anim = () => {
  const LEN = { Idle: 17.667, coasting: 5.333, skate_fwd: 0.208, jump_start: 0.583, jump_in_air: 0.708 };
  const log = {};
  rg.girl.actions = {}; rg.girl.cw = {};
  for (const nm of Object.keys(LEN)) {
    const a = { w: 0, ts: 1, running: 0, resets: 0,
      reset() { this.resets++; this.running = 1; return this; }, play() { this.running = 1; return this; },
      stop() { this.running = 0; return this; }, isRunning() { return !!this.running; },
      setEffectiveWeight(v) { this.w = v; return this; }, getEffectiveWeight() { return this.w; },
      setEffectiveTimeScale(v) { this.ts = v; return this; }, setLoop(m, n) { this.loop = m; return this; } };
    rg.girl.actions[nm] = log[nm] = a;
  }
  rg.girl.clipLen = LEN; rg.girl.ready = true;
  place(60, 1, -60, 0, 0);
  const rows = [];
  let resets0 = 0, dutyUp = 0, dutyN = 0;
  run(7, (t, i) => {
    follow(); rg.stick.L.y = -1; rg.stick.L.x = 0;
    rg.girlAnim(DT);
    if (i % 60 === 0) rows.push(`${fix(t,1)}s v${fix(P.speed,1)} push${P.pushing ? 1 : 0} ` +
      `[idle ${fix(log.Idle.w)} coast ${fix(log.coasting.w)} skate ${fix(log.skate_fwd.w)}] ` +
      `x${fix(log.skate_fwd.ts)} period ${fix(P.pushPeriod)}`);
    // how much of each stride the push clip is actually up for -- it should be most of a
    // standing start and a minority of a cruise, because that is what a glide is
    if (t > 4) { dutyN++; if (log.skate_fwd.w > .5) dutyUp++; }
  });
  resets0 = log.skate_fwd.resets;
  for (const r of rows) console.log('  ' + r);
  const ts = log.skate_fwd.ts, cyc = LEN.skate_fwd / ts;
  // ONE STRIDE IS AN OUT-AND-BACK, so the cycle the player sees is TWO clip lengths.
  console.log(`  skate_fwd: ${LEN.skate_fwd}s of clip, x${fix(ts)} -> ${fix(cyc * 2)}s out-and-back ` +
              `against a ${fix(P.pushPeriod)}s stride, up ${fix(dutyUp / Math.max(1, dutyN) * 100, 0)}% of the time`);
  // A CLIP PLAYED AT A FIFTH SPEED IS A SLOW DRIFT INTO A POSE, not a stride -- and the
  // out-and-back has to LAND on the stride period, or the feet and the shove are on two clocks.
  if (ts < 0.3) { console.log('  -> slow motion'); return false; }
  if (Math.abs(cyc * 2 - P.pushPeriod) > 0.02) { console.log('  -> cycle does not match the stride'); return false; }
  // A CLIP REWOUND EVERY FRAME NEVER GETS PAST ITS FIRST KEY, which is a held pose exactly.
  return resets0 < 20;
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
  try { ok = CASES[k](); } catch (e) { console.error('  THREW', e); }
  if (!ok) { fail++; console.log('  -> FAIL'); }
}
console.log(fail ? `\n${fail} case(s) failed` : '\nall cases pass');
process.exit(fail ? 1 : 0);
