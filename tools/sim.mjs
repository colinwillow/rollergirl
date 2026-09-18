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
if (!rg.ready()) { console.error('the module never became ready'); process.exit(1); }

// ---- driving ----
const DT = 1 / 60;
const P = rg.player;
function place(x, y, z, heading, speed) {
  P.pos.set(x, y, z); P.heading = P.faceH = heading; P.grounded = true;
  P.vel.set(Math.sin(heading) * (speed || 0), 0, Math.cos(heading) * (speed || 0));
  P.airT = 0; P.braked = 0; P.pushing = false; P.pushT = 0; P.pushOff = 9; P.shoveT = 0; P.n.set(0, 1, 0);
  const g = rg.groundAt(x, z, y + 3, 6);
  if (g.hit) { P.pos.y = g.floor; P.n.set(g.nx, g.ny, g.nz); }
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
  place(60, 1, -60, 0, 0);
  let prev = 0, worst = 0, marks = [];
  run(9, t => {
    follow(); rg.stick.L.y = -1; rg.stick.L.x = 0;
    const d = Math.abs(P.speed - prev); if (t > 0.2 && d > worst) worst = d;
    prev = P.speed;
    if (Math.abs(t % 1.5) < DT / 2) marks.push(`${fix(t,1)}s ${fix(P.speed)}`);
  });
  console.log(`  ${marks.join('  ')}`);
  console.log(`  top ${fix(P.speed)} m/s, worst one-frame jump ${fix(worst, 3)} m/s ` +
              `(a STROKE, not a step -- a staircase here is the bug)`);
  return P.speed > 9 && worst < 0.8;
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
    place(60, 1, -60, 0, v);
    const v0 = v; let t90 = -1;
    run(3, t => { rg.cam.az = Math.PI / 2; rg.stick.L.y = -1; rg.stick.L.x = 0;
      if (t90 < 0 && Math.abs(wrap(P.heading - Math.PI / 2)) < 0.09) t90 = t; });
    console.log(`  at ${v0} m/s: 90 deg turn in ${t90 < 0 ? 'NEVER' : fix(t90) + 's'}, ` +
                `out at ${fix(P.speed)} m/s`);
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
  run(3, () => { follow(); rg.stick.L.y = -1; if (!P.grounded) { air += DT; apex = Math.max(apex, P.pos.y); } });
  console.log(`  apex ${fix(apex - y0)} m, airtime ${fix(air)} s, landed at ${fix(P.speed)} m/s`);
  return apex - y0 > 1.2 && air > 0.6 && P.grounded;
};
// ---------------------------------------------------------------- THE HALF PIPE
// This is the one that says whether any of it works. She drops in off the deck with NO input
// at all and the only thing acting on her is the slope: if the transition is being handled
// honestly she swings up the far wall to nearly the height she started at, and keeps swinging.
// Speed bled a sliver at a time by re-projecting her velocity at every triangle boundary is
// exactly what "nothing ever gets to the coping" looks like, and it shows up here as the
// swings dying away.
CASES.pipe = () => {
  const H = 2.6 * (1 - Math.cos(85 * Math.PI / 180));
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
  const H = 2.6 * (1 - Math.cos(85 * Math.PI / 180));
  place(0, H + 0.2, 23.0, 0, 2.2);
  let best = -9, peaks = [], up = false, air = 0;
  run(16, () => {
    follow(); rg.stick.L.y = -1; rg.stick.L.x = 0;     // hold the thumb the way she is going
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
    run(4, () => { follow(); rg.stick.L.y = -1;
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
    follow(); rg.stick.L.y = -1; rg.stick.L.x = 0.35;   // hold a carve, the way you ride a bowl
    lowest = Math.min(lowest, P.pos.y);
    if (P.pos.y < -4) through++;
    if (Math.hypot(P.pos.x - B.x, P.pos.z - B.z) > B.r + 4) out++;
  });
  console.log(`  deepest ${fix(lowest)} m (bowl floor is -2.64), left the bowl on ${out} frames, ` +
              `below the floor on ${through}`);
  return through === 0 && lowest < -1.5;
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
      setEffectiveTimeScale(v) { this.ts = v; return this; } };
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
  console.log(`  skate_fwd: ${LEN.skate_fwd}s of clip played over ${fix(cyc)}s (x${fix(ts)}), ` +
              `replayed ${resets0} times in 7 s, up for ${fix(dutyUp / Math.max(1, dutyN) * 100, 0)}% of a cruising stride`);
  // A CLIP PLAYED AT A FIFTH SPEED AND LOOPED IS A SLOW DRIFT INTO A POSE, not a stride. It has
  // to run near its authored rate, and it has to be REPLAYED once per push rather than wrapped.
  if (ts < 0.45) { console.log('  -> slow motion'); return false; }
  if (resets0 < 3) { console.log('  -> not being replayed per push'); return false; }
  // A CLIP REWOUND EVERY FRAME NEVER GETS PAST ITS FIRST KEY, which is a held pose exactly.
  return resets0 < 20;
};

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
