# Rollergirl — working rules

Mobile-first rollerblading game. Single-file Three.js r180 in `index.html` (native ES modules,
import map, **no build step**).

**PUSH STRAIGHT TO `main`. Always.** Pages serves `main`, and the owner previews live on a
phone -- so a change sitting on a branch cannot be tested, which means it is not done. Branch
all you like while working; end on `main`. Do not open a pull request unless he asks for one:
it is an extra click between the work and the phone it has to run on.

He previews live, so **run `npm run bump` before every push** — it raises `BUILD` in both places and rewrites `version.json`. Pages caches
`index.html` for ten minutes and a home-screen shortcut caches it harder, so a build that does
not announce itself cannot be told apart from the one before it. The build number is the big
cyan figure top-left; a running copy polls `version.json` every 15 s and puts a
"build ready · tap" pill on screen when the server has moved on.

## Verification budget

**The owner tests the game. You do not.** Make the change, `npm run bump`, run `npm run check`,
push, and say "shipped unverified" **with the build number** so he knows what to look for.
No screenshots, no playwright unless he asks for it by name.

**Two gates, and both are cheap:**

- **`npm run check:syntax` ONLY PARSES.** It cannot see a `const` read above its own
  declaration, a throw at module top level, or a missing identifier — and all three of those
  are a BLANK PAGE.
- **`npm run check:boot` RUNS THE REAL MODULE.** `three` resolves to the vendored build through
  a shim that swaps `WebGLRenderer`/`WebGLRenderTarget`/`PMREMGenerator` for fakes, because a
  headless node has no GL context and those are the only things that need one. It caught a
  missing `vendor/BufferGeometryUtils.js` on its first run — a file `GLTFLoader.js` imports and
  nothing else mentions, which would have been a blank page on the phone and nothing on screen
  to say why. **The GLB failing to load is the environment, not the code** (node has no
  relative-URL base, so every `loadGLB` rejects with `ERR_INVALID_URL`); anything else that
  rejects is a real fault.

**`npm run sim` IS THE THIRD, AND IT IS THE ONE THAT PAYS.** Everything that matters here is
reachable without a GPU: the collider is triangles in a grid and `stepPlayer` is arithmetic, so
"does a half pipe actually work" has an answer in three seconds. **It calls `rg.stepPlayer`, it
never restates the rule** — a harness with its own copy of the code is the oldest mistake there
is. Run it on any change under `stepGround`, `stepAir`, the park builders or the collider. In
one sitting it found: a NaN that made the whole world invisible, a bowl with no floor in the
collider, four holes at the corners of the bowl's cut-out, a kicker that launched nobody, and a
carve that ate two thirds of her speed. **Not one of those was visible from reading the code.**

## Layout

- `index.html` — everything: renderer, the procedural park, the collider, the skating model,
  the camera, the pads, her rig and her clips.
- `models/roller_girl.glb` — his export. 66-joint Mixamo rig (`mixamorig_*`), armature scaled
  0.01, 9857 tris, one material, draco + `EXT_texture_webp`. Six clips at 24 fps:
  `Idle` (17.7 s), `coasting` (5.4), `skate_fwd` (0.25 — **six frames**), `jump_start` (0.63),
  `jump_in_air` (0.75), and `CINEMA_4D_Main`, which is one-frame exporter residue and is
  dropped. **Every clip starts at 1/24 s rather than zero**, which is one held frame at the top
  of every loop; `normaliseClips` shifts the track times back.
- `models/alien_rollerskate_blue.glb` — **the alien, r21 onward.** 81 joints (65 Mixamo + 15
  tail), 49 clips named as a schema the move brain reads: `blade_<soft|medium|hard|casual>_<forward|
  backward>` (r23 uses only casual and hard; no `blade_hard_backward` -- a hard fakie borrows casual), `idle_*` (5 forward +
  `idle_backward`), `in_air`, `tuck`, `flip_pose`, `front_flip`/`back_flip`/`front_twist_flip`,
  `fall_to_*` + `get_up_*`/`kip_up_from_back`, `grind_left/right`, and the variety skates
  (`casual`, `daffy`, `swizzle`, `tiptoe`, `onefoot*`, `pose_duck/swan`) not yet triggered.
  `alien_rollerskate_blue_test.glb` is the one-clip test export and is no longer on the roster.
- `models/melee_zap.glb` — **Zap's melee set, borrowed from weirdport (r39)** by `npm run borrow` (`tools/borrow.mjs`,
  reads `../colinwillow/weirdport/models/characters/zap.glb` or a path you pass): nodes + 12 animations, no mesh,
  632 KB. Re-run it if he re-exports Zap. Delete it the day she has her own melee clips.
- `models/kit/` — **his weirdport building kit (r45)**, copied from `../colinwillow/weirdport/models/building_kit/`:
  `building_kit_pieces.glb` (the piece library: `wall_window`, `wall_solid`, `wall_door_C`, `wall_wide`, `wall_parapet`,
  `corner`, `roof` ... on a 3 m bay / 3 m floor) skins every procedural building, and
  `building_kit_generated_visual.glb` + `building_kit_collision.glb` are his four generated buildings BKG0-3, imported
  whole. No draco (custom attributes), WebP textures. `models/props/prop_hydrant.glb` is his hydrant.
- `vendor/` — three r180 (module + core), GLTFLoader, DRACOLoader + wasm, BufferGeometryUtils,
  SkeletonUtils. From the city repo.
- `tools/` — `syntax.mjs`, `boot.mjs`, `bump.mjs`, `sim.mjs`, `clips.mjs`.
- `icons/` — `npm run icons [art.png]` (`tools/icons.mjs`, City's tool, needs the `sharp` dev dependency)
  turns one square artwork (`icons/source.png`, his alien-on-skates art since r31) into the 180/167/152
  apple-touch icons, 192/512 for the manifest and the 32 favicon. **THE VERSION IS IN THE FILENAME
  (`-v3`), NEVER A QUERY STRING** -- iOS drops an apple-touch-icon link whose href carries one. Raise
  `V` with new art, re-run, repoint `index.html` and `manifest.webmanifest`. iOS only re-reads the icon
  when the home-screen shortcut is removed and re-added.

**`npm run clips` READS WHAT IS ACTUALLY IN EACH ANIMATION**, straight out of the GLB's samplers
— they are NOT draco compressed, draco only touches mesh primitives — so "she holds the pose" is
answerable in a second. It reports how many bones genuinely MOVE and by how much. **A QUATERNION
COMPONENT DELTA IS NOT A ROTATION**: `q` and `-q` are the same rotation, so a component swinging
from −1 to +1 reads as a delta of 2 and is a sign flip that three's interpolant takes the short
way round. Measuring components made a six-frame stride and a static clip look identical; the
honest number is `2·acos(|dot|)`, which is sign-insensitive by construction.

## Landmines

- **THE ROSTER, AND WHICH CLIPS PING-PONG IS NOW MEASURED RATHER THAN LISTED (r11, `CHARS`,
  `clipRoles`, `clipCyclic`).** `models/alien_rollerskate_blue_test.glb` is the second
  character: 80 joints, one 1.833 s / 56-key mocap clip also called `skate_fwd`, and a 15-bone
  tail. One is loaded at a time -- a swap is a menu action, not a parade -- and the pick lives
  in `localStorage`. A swap is LOAD-THEN-DROP, so the character on screen goes on skating for
  the whole download instead of leaving a blank street.
  **A HARD-CODED `PINGPONG` LIST WAS RIGHT FOR ONE EXPORT AND WRONG FOR THE OTHER, UNDER THE
  SAME CLIP NAME.** First key against last, averaged over the bones that actually move:
      roller_girl skate_fwd   mean 45.5 deg / worst 106   -- ONE PUSH, must ping-pong
      alien       skate_fwd   mean  0.6 deg / worst   8   -- a CYCLE, a plain loop
  Ping-ponged, a clip that already closes is played at half the rate it should be, which is
  what "she holds the pose" looked like for three builds. `girl.cyc[name]` (1 or 2) comes out
  of the same measurement, so the rate cannot drift from the loop mode.
  **AND THE T-POSE FALLBACK CANNOT BE `Idle`.** The alien has exactly one clip, so a table
  naming three she has not got sums to zero -- and a zero-weight bone is blended back to its
  BIND value, which is the T-pose exactly. The fallback is the skin's OWN clip, and a skin with
  neither an idle nor a coast drives itself entirely from that one clip (`girl.solo`): weight 1
  for ever, and **the RATE is the animation** -- fitted to the stride while pushing, ticking
  over with her speed while coasting, and a time scale of ZERO at a standstill, which holds a
  pose rather than skating on the spot.
  **`clipRoles` IS ONE SHIPPED FUNCTION THAT BOTH `buildGirl` AND `npm run sim anim` CALL.** The
  harness cannot build a skin (draco wants a Worker) but it can read the clips, so the one
  thing it must not do is restate the decision -- and the previous version of that case invented
  its own durations AND its own "one stride is two clip lengths", so it reported a correct rate
  on a clip the game was playing at half speed. It covers every character on the roster now.
- **THE TAIL IS A CHAIN OF POINTS IN WORLD SPACE, SOLVED AND CONVERTED BACK TO BONE ROTATIONS
  (r11, `TAIL`, `tailFind`, `tailStep`).** He drives the chain in Cinema 4D with an IK and
  dynamics on; the choice is between solving it live here and baking that motion into the
  joints, so this is the live half for him to compare against. **Baking is a drop-in**:
  `tailFind` measures how far any tail bone turns in any clip and `tailStep` stands itself down
  once that is real, so a baked export needs no code change.
  **THE REST POSE IS READ EVERY FRAME AND NOTHING IS TYPED IN METRES.** The bones are put back
  to their rest rotations, the subtree's world matrices are updated, and the goal positions AND
  the segment lengths are measured off that -- so a re-export at any size or any shape lands
  right, and at full stiffness the sim reproduces the authored pose to **0.0000 m**, which is
  the self-consistency check the whole design rests on.
  **RESET THE BONES EXPLICITLY; DO NOT TRUST THE MIXER TO REWRITE THEM.** It only writes a bone
  a playing clip has TRACKS for, and a relative edit on a bone nothing rewrites accumulates a
  few degrees a frame, which is a bone spinning. (Shredworld paid for exactly that with its aim
  twist, on clips whose spine tracks had been stripped.)
  **TWO DRAGS, BECAUSE ONE NUMBER CANNOT DO BOTH JOBS.** `drag` damps the velocity RELATIVE TO
  HER BODY -- the chain's own internal friction, and relative is the point, because a tail
  travelling along with her is not moving as far as that friction is concerned. Damped against
  the WORLD instead, keeping up with her IS motion to be damped, so the spring and the drag
  settle a long way behind the pose and it never comes back: a dash left the tail **1.51 m off
  a chain only 0.879 m long**, permanently flattened out behind her. `air` is the other one and
  it is small: drag against still air, which is what makes a tail trail at speed at all.
  **NO ITERATION COUNT, AND NO SUBSTEPPING, AND BOTH OF THOSE ARE MEASUREMENTS.** The length
  projection is root-outward and DIRECT, so one pass is exact -- 3 passes and 10 gave
  byte-identical numbers, which is what said the residual was never the problem. And
  substepping, the standard answer to a marginal chain, made the violent cases WORSE (a
  5.6 rad/s shake went 35 -> 169 m/s at the tip as `sub` went 1 to 8), because the ground clamp
  and the length projection are POSITION corrections whose size does not shrink with the step
  while the velocity recovered from them is divided by it.
  **THE SAME CONSTRAINT IS APPLIED AT THE VELOCITY LEVEL TOO**: a rod that cannot stretch
  cannot have relative velocity along it either, or the positions are legal while the
  velocities are not and every step puts back the violation the projection just corrected.
  **AND `npm run sim tail` RUNS THE SHIPPED SOLVER ON A FABRICATED CHAIN CARRYING THE REAL BONE
  OFFSETS**, which is enough because the solver only ever reads offsets and world matrices.
  Five checks: it reproduces the pose when rigid, the lengths hold to **0.00%** through ten
  seconds of being thrown about, it swings and recovers, it stays out of the floor at 2x
  gravity, and -- the one that matters most -- **the BONES actually turned**, because every
  other number is about the POINTS and a broken conversion back to quaternions passes all of
  them while nothing on screen moves.
  **THREE SEPARATE PROBE FAULTS IN THAT CASE EACH READ AS A SOLVER THAT CANNOT RECOVER**, and
  they cost most of the round: the tail dragging on the plaza (so the number measured the
  ground clamp), a 36 m dash from x = 60 straight into the **6.6 m perimeter berm** -- this
  file's own written-down landmine about a probe on a site with a ramp in it -- and a dash that
  reached 7.2 m/s in ONE FRAME, which is an infinite acceleration no skater does. The solver
  was fine the whole time: the velocity profile along the chain is a clean monotone whip, 7.2
  at the root to about 20 at the tip, which is what a 15-link chain does.

- **THE ALIEN'S HIPS: NO UP-AND-DOWN IS THE EXPORT, AND THE ROTATION IS THERE (r15).** *"Did you
  remove the hips rotation, or is that just the animation?"* Read straight out of the file:
      mixamorig_Hips.translation   2 keys, CONSTANT (0, 1.307, -43.504)   -- no bob was exported
      mixamorig_Hips.rotation      56 keys: twist 21.3 deg, side-roll 9.2, pitch 2.5
      (roller_girl, for scale:     twist 11.7, side-roll 15.5, pitch 2.9, and 6.3 units of bob)
  Nothing here strips either: every quaternion track is kept, and `KEEPPOS` keeps the Hips
  translation precisely so a re-export WITH a bob arrives untouched. The rotation is mostly
  TWIST, which is the hardest axis to see from a camera sitting behind her. **Check the file
  before the pipeline when an animation looks flat** -- `npm run clips` plus a per-axis
  breakdown answers it in a second.
- **THE TAIL'S FLOP WAS THE DAMPING MORE THAN THE SPRING (r15, `TAIL.drag` 3.4 -> 6, `stiff`
  70 -> 140).** Swept against the shipped solver, a ramped 7.2 m/s dash at 30 m up:
      stiff  70 drag 3.4   swing 1.26 m   tip 31 m/s      stiff  70 drag 6   swing 0.26   tip 8.6
      stiff 140 drag 3.4   swing 0.99     tip 25          stiff 140 drag 6   swing 0.12   tip 8.0
      stiff 320 drag 3.4   swing 0.61     tip 17          stiff 320 drag 6   swing 0.14   tip 7.9
  Underdamped, the chain whips -- the tip outruns her three or four times over -- at EVERY
  stiffness; raising `stiff` alone only shortens the whip. Past `drag` 6 nothing more is bought.

- **THE TAIL SPEAKS HIS CINEMA 4D VOCABULARY NOW (r16, `TAIL.strength/posHold/rotHold/damping/
  pin/body`) -- AND THE CONCEPTS TRANSLATE WHILE THE NUMBERS DO NOT.** C4D integrates per frame
  in its own units; this integrates per second in metres. So the dials carry his names and
  start near his values, and what each one IS carries over exactly:
      strength   how much of the sim you SEE: the authored chain moved that far toward the
                 simulated one, blended as POINTS in the world -- never as bone quaternions,
                 because a slerp blends the TWIST too and a half-twisted parent throws every
                 child off the direction it was authored for
      posHold    the spring to the animated pose (`posK` is what 1.0 means)
      rotHold    bending stiffness against the PARENT segment -- the solver had none
      damping    internal friction, relative to her body
      pin        "I started the IK a joint or two further down": those bones are the animation's
      body       capsules between her own bones, which C4D's collider tag gave him for free
  **ROTATION HOLD HAS TO RUN AFTER THE VELOCITY IS TAKEN.** Before it, the bend correction was
  recovered AS velocity like every other correction, which made it a stiff undamped spring
  fighting position hold over two ideas of where the tail should be: rotHold 0.3 took a gentle
  dash's tip from 7.9 m/s to **33.8** and made the kinking WORSE. A HOLD may only take energy
  out, and a correction that moves the shape without counting as motion is exactly that. After
  the move: 95th-percentile kink through a turn **7.9 -> 4.7 deg** at no energy cost.
  **AND THEN THE COLLIDER NEEDS THE LAST WORD**, or the hold walks points back inside her --
  2.7 cm into a leg with collision in only one place. `tailCollide` runs after both.
  **A point whose AUTHORED position is already inside a capsule is left alone** -- the root of a
  tail lives inside the pelvis by construction, and pushing it out would fight the animation.
  **HIS LITERAL 100% HOLD UNDER 30% STRENGTH IS A TAIL WELDED ON**: a stiff sim shown at 30%
  moves the visible tail **2 cm** through a turn. His look was a loose sim shown small, so
  `posHold` ships at 0.30 (0.26 m shown in a dash, 0.06 in a turn, kink still 6.3 deg).
  **GRAVITY IS OFF (r17), ON HIS C4D SETUP, AND IT IS FREE**: the same swing (0.25 m shown in a
  dash), half the kinking (6.3 -> 3.0 deg), and no sag at rest -- standing still the tail IS the
  authored pose. Gravity was a constant load the holds spent their effort fighting. The floor
  and body checks in `npm run sim tail` set their own gravity explicitly, so they still test
  the collision rather than a tail that never falls onto anything.
  **`npm run sim tail` MEASURES THE SHOWN CHAIN (`T.D`) AS WELL AS THE SIMULATED ONE (`T.P`)**,
  because with `strength` they are no longer the same chain and only one of them is on screen.
  Its kink check is the 95th percentile over a skater's turn: the first version took the single
  worst frame of a paint-shaker test and read 166 against 161 deg, which says nothing. And the
  body check requires CONTACT as well as no penetration, or a tail that never reached the
  capsule passes "nothing went through" without the collider doing a thing.

- **THE TAIL'S SPRING READ HER TRAVEL AS ERROR FOR FOUR BUILDS (r14-r17, fixed r18).** Position
  hold compared THIS frame's goal against LAST frame's position, so a tail tracking her perfectly
  saw one frame of her motion as error and was shoved by exactly that. Found because a sweep
  showed the tail streaming back further with air drag OFF than ON, which cannot happen at a
  steady speed; with air and gravity both off it sat **0.143 / 0.272 / 0.432 m** off the pose at
  8 / 15 / 24 m/s -- speed x 1/60 s, to the millimetre. The goal is now the one from the START
  of the step (last frame's, eased toward this frame's across substeps). **Every tail number
  measured before r18 carried this**, which is why the r18 tuning was redone from scratch.
  `npm run sim tail` cruises at 24 m/s with nothing pushing on the tail and requires it to sit
  on the pose; **verified by putting the bug back**: 0.49 m off and a fail.
  **A RESULT THAT CANNOT HAPPEN IS A BUG REPORT, NOT A DATA POINT.** Less drag streaming the
  tail back further was the tell, and taking it seriously instead of tuning around it is what
  found this.
- **"A LONG STICK WITH THE END FLOPPY" IS UNIFORM STIFFNESS (r18, `rotTip`, `posTip`).** Measured:
  46% of all the bending in the last 3 of 13 joints (even is ~23%), 4 cm of motion through a
  turn. The tip is the least held-in and the longest lever, so with the same stiffness
  everywhere the bend pools there. Rotation hold soft at the root and stiff at the tip (.15 ->
  .70), with position hold fading to half at the tip, puts it back in the middle: 24% in the
  last 3, a curve that grows smoothly root to tip, and kinking against the authored curve
  13.6 -> 2.2 deg through a turn. Graded by ARC LENGTH, because his last three segments are the
  longest. `air` came down 0.9 -> 0.4: since the spring fix it is the only thing that sweeps
  the tail back at speed, and at 0.9 it held half the chain back at 24 m/s.
- **A ONE-CLIP CHARACTER ANIMATES AT HER SPEED, NEVER AT THE STICK (r18, `ANIM.soloRef/soloMax`).**
  *"If you push the stick all the way she animates like she's going really fast."* The rate came
  off the push cadence while the thumb was forward -- SHORTEST at a standstill, so x3.5 on her
  mocap from a stop, x1.75 at cruise -- and off a different rule the moment it let go (x0.55 at
  most). Now `soloMax * (1 - exp(-speed / soloRef))`: x0.42 at 2 m/s up to x1.64 at 24, the same
  with the thumb on or off. A ceiling, because a skater going faster glides longer rather than
  striding faster. `npm run sim anim` asserts the thumb-independence directly. **roller_girl's
  push is untouched**: her six-frame clip IS synced to the actual shoves, so the cadence is
  right for her.

- **THE TAIL HAS TWO MODES AND THE DEFAULT IS HIS VISUALIZER'S (r19, `TAIL.mode`, `tailWave`).**
  *"Every subsequent position in the arm looks at the previous one and eases to it, but the rate
  it eases is slower than the layer above -- like a wave down a rope, it dissipates."* `'wave'`
  is that and nothing else: each bone's WORLD orientation eases toward where its parent, as
  drawn, would carry it rigidly, at a rate falling geometrically root to tip by arc length
  (`waveRoot` 30 -> `waveTip` 7 per second). No physics, so it cannot go unstable -- an ease is a
  weighted average and an average cannot overshoot. The drivers are her turning and the 21 deg
  of hip twist in every stride of her mocap: the stride alone sends a 7 cm wave to the tip, a
  turn bends it 23 cm in a curve that grows smoothly root to tip, and standing still it is the
  authored pose to 0.00000 m. `'sim'` is the physics with the C4D-named dials, kept for the A/B,
  and the chip says which is running (`TAIL wave` / `TAIL sim`).
  **AN EASE IS FRAME-RATE INDEPENDENT ONLY WHILE ITS TARGET HOLDS STILL**, and in a cascade every
  target is a parent that moves every frame -- so eased once per frame, the fast joints near the
  root jumped most of the way in one step at 20 Hz and the tail moved **22% less** through the
  same turn than at 60 Hz. The cascade runs at 240 Hz with the body's motion slid across the
  substeps, quaternion arithmetic only: 0.232 m at 60 Hz, 0.231 at 20. `npm run sim wave`
  asserts it within 5%, and **was verified by turning the substepping off**: 0.213 vs 0.166, fail.
  **EASES ACCUMULATE DOWN A CHAIN** -- a steady spin leaves each joint about `w / rate` behind,
  and thirteen of those add up -- so `waveMax` (14 deg) caps any one joint's lag, which is also
  what stands in for a body collider in this mode.
  **His visualizer repo (`colinwillow/visualizer`) is public and was cloned, but reading its
  `index.html` was blocked by this session's permission rules**, so `tailWave` is built from his
  description and not from his code. Worth comparing against his arm the next time a session can
  read that file.

- **THE MOVE BRAIN (r21, `girlAnimMoves`, `buildMoves`, `MOVES`).** His naming IS the schema, read
  once at load into a move table; a skin with no `blade_*_forward` keeps the old path. One weight
  table a frame, top down: a BAIL (a fall, then its get-up, filling `LAND.bailT`), the AIR (a flip
  if one was flicked, else `in_air`; a flip that finishes before she lands hands back to `in_air`),
  then the ground -- standing (`idle_normal`, shifting to another idle every `idleHold` s, never
  the same twice; `idle_backward` in fakie) and skating (r23: a roll pose with the thumb off,
  casual -> hard with it on -- see below). Every row sums to 1. The chip names the clip that is up.
  `npm run sim moves` drives it on his REAL clip names and lengths, prepared by the SHIPPED
  `prepClips` -- and the `anim` case now skips a moves skin, because it had been testing his
  49-clip export down the one-clip path with `back_flip` as its "solo" clip.
- **MELEE, BORROWED FROM ZAP (r39, `MELEE`, `rightFlick`, `meleeStrike`, `meleeSlide`, `meleeKick`, `kickTarget`).**
  *"I love his melee system -- right stick flick on the ground strings them the way he does; left stick
  flick is the slide tackle; in the air a right flick is the flying kick, and near a grind pole flicked
  toward it she targets the pole and kicks into a grind, because it's really hard to grind right now."*
  He said Clancy; the set is ZAP's (Clancy is the dog, with one punch). **Same bind pose**: 58 shared
  joints, rest rotations equal to 0.03 deg, so rotations copy as they are; the Hips translation is
  re-based on HER rest and its movement scaled by the leg-length ratio (x1.79, both read from the files).
  Measured on both rigs the hips drop the same fraction of a leg (-1.15 / -1.25 in `melee_02` / the
  slide), and **Zap's own feet go under his floor in those two** (-0.37 / -0.44 legs) -- so during a
  ground strike `footGround` only LIFTS her (`MELEE.liftMax`) until the lowest skate is on the surface,
  and never runs the leg IK.
  RIGHT FLICK on flat ground: the next clip of the pool (`fist`, plus `weap` if `useWeap`), dealt in order
  so none repeats until all have played, at `rate` 1.75 clamped to a .55-1.3 s beat (weirdport's numbers),
  her BODY turned to the flick (through the camera) while the wheels keep their line, a `lunge` of speed;
  a flick during a strike is QUEUED and never cuts it. **A swipe UP on a steep face (`xferN`), a rail or
  off a lip is still the transfer** -- on FLAT ground up is a strike now. LEFT FLICK on the ground: the
  slide tackle along her travel, `slideV` of shove. RIGHT FLICK in the air: the flying kick, driven toward
  the flick at `airV`, once per airtime -- and if a rail lies within `aimR` / `aimCone`, she is SOLVED onto
  it (nearest point led `lead` along the rail so she arrives sliding along it; horizontal speed from the
  distance, vertical speed that meets the bar's top at the same moment) and `railCatch` relaxes its gates
  for THAT rail and grinds her the way she was aimed. Air thrust is off for a solved kick. Strikes,
  slides and kicks all draw the blade trails. `npm run sim melee`: every rail, from either side, GRIND --
  and with the aim switched off every one misses; plus the chain, the queue, the slide, the open kick and
  the borrowed clips binding to her bones. `NO MELEE GLB` in the chip if the file fails.
- **THE LOOP TURNED HER UPSIDE DOWN IN THE PHYSICS AND NEVER ON SCREEN (r48, `bodyAlign`).** *"Her head just
  always points up."* A grind counts as grounded with `p.n` straight up, and `poseGirl`'s grounded block rebuilt
  `p.bq` upright from that every frame -- throwing away the tangent-and-up body `stepGrind` builds from an `ups`
  rail. r45's sim read `p.bq` straight after `stepPlayer`, before that overwrite, so it passed on a bug the phone
  showed every time. The block is `bodyAlign(dt)` now (callable without a skin), skips an `ups` rail, and sets
  `wasGr` false there so the landing after the loop eases from the body she left it with. `npm run sim city` calls it
  every frame and requires her up within 12 deg of the loop's centre all the way round (4.1 measured).
  Revert-tested: with the skip removed it reads 24 deg and fails.
  **A HARNESS THAT READS STATE BEFORE THE LAST WRITER HAS RUN IS MEASURING A FRAME NOBODY SEES.**
- **THE STREET RAILS ARE UP IN THE AIR (r48, `CITY.railK`).** *"The new grind rails are very low -- they want to be up
  in the air cause she jumps really high."* r45 typed them 0.4-1 m over what was under them. Every city rail now
  starts `CITY.railK` (.85) of her apex (3.3 m) over its surface, the park rails' rule: B -> C over the roofs, the
  loop's lead-in and exit, the spiral's foot. The low bench rail is gone; the bench is just a box now (moved to
  x -16.5) and a high STREET RAIL beside it runs on OVER the hydrant, whose grind check takes anything up to
  `HYD.grindOver` (4.8 m) above it, so grinding over it still knocks the cap off. `npm run sim city`: lowest
  rail start 3.32 m over its surface, and a tap under the street rail grinds it and breaks the hydrant.
- **A HELD LEFT THUMB IS A FIXED DIRECTION (r47, `CAM.steerLatch`, `CAM.steerRe`, `cam.thA`).** *"I'm pushing
  this direction and she's not going that direction -- I'll be holding left and she's still going right."* The
  follow camera dragged the steering frame round with it (`cam.steerAz += d`, since r28), so a thumb held STILL
  pointed somewhere new every frame: a held diagonal circled her for ever -- **416 deg in 5 s, measured** -- and a
  thumb swung across after a long turn pointed nowhere near where it looked. Now the frame only catches up with the
  camera when the THUMB MOVES (fully after `steerRe` rad of travel), so a held direction stays put while the camera
  swings in behind her -- the held diagonal becomes her straight -- and the next real move of the thumb reads against
  the new view. The right pad's orbit still never steers. **`npm run sim steer` steps `stepCam` beside `stepPlayer`**,
  because the bug lived in the loop between the two and no case without the camera could see it: held diagonal 45 deg
  of turn and on line (old frame: 416), right-then-swung-left ends 0.0 deg off the thumb. `steerLatch` 0 is r46.
- **TONY HAWK'S VERT AIR (r47, `VERT.holdTilt`, `vertQ`/`vertN`/`vertSpin`).** *"Your rotation should stay congruent
  with how you went off the jump unless you transfer -- perpendicular to the ramp, so when you come down the vert
  you're lined up."* On a LOCKED air (anything leaving steeper than `VERT.at`) she keeps the orientation she left the
  wall with, and every turn -- the auto 180 and the stick's spin -- is about HER OWN UP, the wall's normal: nose up
  on the way up, nose down on the way down, square to the wall throughout (0.0 deg off its normal over the top,
  against 79 deg with the old ease-to-plumb). She drifts in off the lip and lands lower down the curve (a 39 deg face
  at 17 m/s), so inside `AIR.preAlign` seconds of contact she is turned onto the face below by time-to-contact --
  lands 0.0 deg out. Non-locked airs still right to plumb (r8). **A heading written from outside is not a spin here**:
  `npm run sim stance`'s extra-180 row had to drive the stick, because on a held air the body turns by `vertSpin`;
  `npm run sim carry` now expects a LOCKED air to keep the wall's normal and only the kicker's lip to right to plumb.
- **HOLD THE RIGHT STICK UP TO TRANSFER (r47, `VERT.holdXfer`, `vertRelease`, `p.xferHold`).** *"Jump, then hold
  forward on the right stick and the trajectory changes from straight up to forward."* During a locked air the right
  pad held up past `xferAt` releases the lock: the auto-turn already applied is taken back (a transfer lands
  forward), the left stick's thrust may carry her out, the swipe's outward kick fires (judged by height above the lip
  she left, `lipY`, since a held transfer can come on the way down), she rights to plumb, and the same hold does NOT
  also become the 'up' grab. A plain jump with only the left stick held still comes straight back down (r25).
  `npm run sim vertair`: held -> on the deck at z 40.8, forward, no grab; switch off -> back in the pipe.
- **THE ZIP LINE IS A GRIND RAIL (r47).** *"We can grind, so we can just grind down."* The tower's line is a plain
  `railPath` on poles now (`'tower rail'`, `postMax` 40, a wide catch for rolling off the parapet gap). The `hang`
  path option stays in `railPath`/`railDraw` for the day a zip line comes back with a hang clip.
- **ON A RAIL THE LEFT PAD IS THE GRIND (r46, `grindSwitch`, `grindTrick`, `MOVES.grindTricks`).** *"When you're
  grinding, tap the left stick and she switches from a left side grind to a right side. And if you flick, she goes into
  a different grind -- for now use the trick rides like ducky."* The left TAP on a rail flips `p.grind.side` (and drops
  any trick, so it lands on the other plain grind) -- off a rail the same tap is still the swivel, and key Q does
  both. The left FLICK on a rail sets `p.grind.trick` by its screen direction (up daffy, down swan, left/right the two
  ducks, `_backward` versions in fakie); the same direction again takes it off. A zip line has neither. Placeholders
  until he draws grinds: swap the names in `MOVES.grindTricks`. The right pad on a rail is unchanged (tap pops off,
  swipe up is the transfer). `npm run sim moves` checks the clips, `npm run sim tap` drives both through the real pad.
- **A SLIDE OUT OF FAKIE COMES UP FORWARD (r46, `MELEE.slideFlip`).** *"She does a slide tackle and then she goes back
  to skating backwards -- I think a swipe is another way to basically reverse her."* The slide always turned her BODY
  onto her travel; now her stance and heading stay there when it ends (the swivel's own three lines: stance, heading,
  `shoveDir`). Only with real travel (`hSpeed > 1`), so a slide from a standstill changes nothing. `slideFlip` 0 on the
  panel puts the old behaviour back. `npm run sim slideflip`.
- **THE CITY (r45, `SOLID`, `building`, `KIT`, `LEVEL`, `railPath`, `HYD`/`GEY`, `GEM`, `buildCity`, `cityRails`).**
  *"Start building out the level -- a system where I can bring in custom textures or meshes, like weirdport ... extremely
  multilevel, buildings with sections of different height, jump onto another building, grind a rail to another, a zip
  line, rails with twists and turns to impossible heights, fire hydrants that spew, loops with collectibles."* First pass:
  a district NORTH of the park, out through a GATE in the north bank (`PARK.gate`, the half width), standing on the
  apron, which now runs 230 m out in every direction and ends in an outer bank (9 m, nearly vert) with an invisible wall
  on its deck (`PARK.edge`) -- the world is bounded, `npm run sim solid` reads 0 frames off the map.
  **SOLIDS** are oriented boxes (`solidAdd`): the TOP goes into the floor collider (a roof is ridden like the plaza),
  the SIDES push her out along the face she is least deep into (`solidPush`, after every sub-step, never on a rail),
  `bounce` of the into-speed sent back, a ceiling from underneath, and a box top within `SK.step` is a kerb she rolls up.
  **A graze turns her nose along the wall** (the leading end, so fakie too): left pointing into it the wheels steer the
  velocity back into the face every frame and the face takes it away -- a scrape that ate the run (12 -> 8.6 m/s in
  1.2 s). `hydrant` boxes have NO floor (`top: false`) and are walls all the way up.
  **BUILDINGS ARE STRINGS** (`building(x0, z0, rows, o)`): one string per 3 m row, a character per cell, `'1'..'9'`
  floors, `'a'` = 10, `'.'` empty -- so the Steps are `'111222333444'`. Runs merge into boxes for collision; the PICTURE
  is his kit instanced on the same grid (`kitPut`, `kitBuild`): walls on every exposed face at every level, corners
  where two exposed faces meet, a roof on every cell, parapets where `o.parapet(i, k, di, dk)` says (each with its own
  0.25 x 1.02 m box). **One InstancedMesh per piece per material: 650 pieces are 23 draw calls.** The conventions were
  CHECKED against his own BKG export rather than derived: a wall runs +X 0..3 with its outside face at z = 0 looking
  +Z; west = yaw -90 at the cell's min-z corner, +Z = yaw 0 at the max-z corner, corner yaw 0 at (min x, max z), roof
  origin (min x, max z) -- all four match his file. Until the kit arrives (and on a phone where it fails) the city is
  plain vertex-coloured boxes (`CITY.fallback`), hidden the moment it lands; the chip says `NO KIT GLB` if it never does.
  **IMPORTS** (`LEVEL.imports`, `levelIngest`): any GLB he exports, placed with `at`/`yaw`, read with weirdport's own
  naming -- `deck_` `ramp_` `ground_` `road_` are floor triangles, `bld_` `solid_` `prop_` are boxes (`obbOf` finds the
  yaw that makes the points' box smallest, so a rotated box comes back as that box), a `metal` box is a grind rail along
  its top, and a root with `cells`/`heights` extras (his generator) gets its WALLS from those, because the export bakes
  no collider for an intact wall. The visual is merged per material after cutting every member down to
  position/normal/uv/colour (Float32, filled in where missing) -- `mergeGeometries` refuses a mixed bucket and a
  refused bucket is a material that silently vanishes. A metal rail INSIDE a building (stair railings) is dropped, and
  the cells have to be in the grid (`solidBuild`) before that filter asks -- the first run kept 18 such rails.
  His BKG0-3: 1306 meshes -> 14 draws, 35 cells, 176 boxes, 1992 floor triangles, at (-125, 0, 175), with a bank onto
  BKG2's roof (to its parapet top, 4.06 m).
  **RAILS ARE PATHS** (`railPath(points, o)`): `RAILS` holds SEGMENTS, each with the fields a straight rail always had
  plus `prev`/`next` and its path, so the catch, the tap hop and the air strike's aim needed only "skip a steep
  segment" and "same PATH, not same segment". A grind walks across joints carrying the overshoot. Path options:
  `boost` (her speed is pulled to it, `RAILX.boostK`/`boostV` on the panel -- the only way up 31 m), `ups` (per-point
  up vectors: her body is built from the tangent and this, so a LOOP turns her upside down), `hang` (a ZIP LINE: the
  segments are her feet, the cable is drawn `hang` above; she holds the air pose -- a placeholder for a hang clip),
  `maxV`, `drag`, `catchR`, `catchBelow` (the zip's wide catch, so rolling off the gap catches it). `railLine` cuts a
  straight run into 2 m segments so a tap near ANY part finds a near point (`railHome` clamps inside a segment).
  **THE DISTRICT** (all measured in `npm run sim city`): the STEPS (3/6/9/12 m, a bank up each, a kicker off the top),
  the GAP (Steps' kicker at 16 m/s lands on B at x 62), the B -> C down rail, the TOWER (30 m, a 2.75-turn booster
  SPIRAL to the roof, 17 s, ending heading for the east parapet -- the first version curled straight out through the
  zip's gap and fell 30 m; the top had to clear the parapet, 31.4 m), the ZIP LINE from the roof's parapet gap to
  z 300 (a grind rail since r47), the LOOP (booster, `boostK` 12, upside down at the top), a bench rail ending at a hydrant, five hydrants.
  `CITY.spots` + the **➤ key** walk her round them (he has no console), and the chip names where she went.
  **HYDRANTS** (`hydrant`, `hydBreak`): skate into one past `HYD.breakV`, strike it, or grind within `grindReach`, and the
  cap flies; the GEYSER is a column of points that LIFTS her (`GEY.acc` to `GEY.vmax` while inside `r`/`h`) -- 11.5 m
  from the one at the foot of C, whose roof is at 6. His model has one mesh and no separate cap, so the cap is the
  triangles above `HYD.seam` (`hydFrom`).
  **GEMS** (`gem`, `gemsAlong`): strung along the lines (`◆ n/N` under the speed), picked up by her body centre.
  **`npm run sim city` LOADS HIS REAL FILES** through the vendored GLTFLoader with the textures cut out of the GLB
  (`glbNoTex` -- node has no image decoder and a texture that never decodes is a load that never ends): the kit's
  every requested piece exists, BKG0-3 merge per material and block her, the hydrant splits into body and cap. Plus a
  check that nothing is placed inside anything (it caught the spiral's top running through the tower's parapet and the
  B -> C rail 13 cm into B's roof). Revert-tested: `solidPush` off fails every wall row.
  **NOT YET**: destructible walls (his `wallB_*` pieces carry `_CHUNK` and chunk tables for exactly that), fire and
  explosions, a real LOOP surface (the collider answers "height at x,z", so a surface you ride upside down needs a
  different collider -- the loop is a rail for that reason), climbing his `climb_` ladders, KTX2 textures (weirdport
  ships `_ktx2` variants because ~80 MB of decoded 1024 WebP is a lot for a phone -- **if the phone reloads in the city,
  suspect texture memory first**), and per-building styles.
- **r44: THE AIR FLICK IS THE MELEE CHAIN, PLAYED FROM EACH CLIP'S AIRBORNE WINDOW (`MELEE.airWin`).**
  *"The animation just holds on the last pose and the last pose is her standing on the ground -- she
  looks like she's standing in the air."* Zap's strikes are GROUND clips: several open with a run-up
  hop and every one ends planted. So in the air only the part of each clip where her feet are off
  the floor is played -- measured on her rig as the longest run with the lower foot above 0.12 of a
  leg, padded 0.04 (`melee_01` .26-.72, `_02` .26-.61, `_03` .34-.64, `_04` .31-.64, `_05` .06-.94;
  `airDef` for anything unlisted) -- squeezed into the same beat, and the strike ENDS at the window's
  end and hands back to `in_air`. `npm run sim melee` re-measures the table against her rig and fails
  if a window drifts. **The flying kick is gone from the air flick**: a right flick in the air is the
  next strike of the chain (strung, queued, never cutting), with a little `airLunge` toward the flick
  and an `airLift` on the first of an airtime; aimed at a rail inside `aimR`/`aimCone` it is still
  SOLVED onto it and grinds (`airAim`). The left-flick slide tackle on the ground is unchanged.
  A GROUND strike that leaves the ground (off a lip) now ends at `airDef[1]` of its beat instead of
  playing its planted finish in mid-air.
  **AND THE TAP HOP NEVER CLEARED `p.kickRail` (r41-r43)**, which turns the air thrust off -- so after
  any tap onto a rail, holding forward in the air did nothing for the rest of the session. It clears
  on touching the ground now.
- **r42: THE LEAN IS AT THE HIPS, THE CAMERA EASES IN, GRABS, STYLE SKATES, A SOFTER SWIVEL.**
  - *"The rotation at the origin makes it feel like a boat -- lean at the hips and the legs compensate, she bends
    her inside knee."* `RIG.hipLean` 1 takes the turn lean off the whole body (`p.bq`'s Z term) and puts the SAME
    angle about the SAME axis (her forward) onto the Hips bone after the mixer (`hipLeanApply`), undone before
    the next update (`hipLeanUndo`). The legs swing out under her and `footGround` sets the skates back down,
    bending the knee that has to bend. 0 is the old whole-body lean. `npm run sim r42` checks it tips her
    exactly as the old lean did (0.000 deg) and undoes to identity.
  - *"When you turn the whole camera turns every time -- I want her to turn and then the camera compensates."*
    A first-order follow swings hardest on the first frame of a turn, so the lens turns WITH her. `CAM.spring` 1
    is a critically damped spring on the bearing (natural frequency `CAM.follow`): it starts from rest -- 64 deg/s
    in the first 0.08 s of a 90 deg turn against the old 273 -- and never overshoots.
  - **The tap hop onto a rail (r41) plays NO kick now** -- *"if you're just tapping onto it it doesn't need the
    kick."* The flying kick (right flick in the air) still has it.
  - **AIR GRABS (`MOVES.grab`, `grabStep`, `p.grab`)**: the right pad HELD in the air past `grabAt` (.3 s, longer
    than a tap, so a grab is never also a tap -- and never a rail hop) holds one of his style skates as the air
    pose, picked by the thumb's direction when the hold starts (`MOVES.grabs`: centre duck, up daffy, left/right
    one-foot, down swan; fakie takes the `_backward` one). A hard DOWN hold is still the settle. It replaces the
    pose under a procedural flip and a spin; a clip flip keeps its clip. Placeholders until he draws grabs.
  - **STYLE SKATES ON THEIR OWN (`MOVES.style*`)**: rolling without pushing above `styleV` (or still pushing past
    `styleCruise`) for `styleEvery` s, she slips into one of `MOVES.styles` for `styleHold` s, never the same
    twice running, then back; the clip weights' damping is the blend.
  - **THE SWIVEL EASES** (`SK.swivelT` / `swivelRate`): ~0.5 s to come round instead of a snap, through the same
    `faceSlowT` the landing ease uses (which now carries its own rate, `p.faceSlowRate`).
  - Not done: the skid stop (*"pull back, she jumps and turns to the side and skids"*) -- waiting on his clip.
- **A TAP NEAR A RAIL IS A HOP ONTO IT (r41, `railHome`, `GRIND.home*`).** *"It's really hard to get onto a
  grind unless you hit it perfectly -- if you're in the vicinity and you tap, she should do the little kick
  over so she grinds on it."* A right-pad TAP (never the swipe/transfer) within `homeR` 4.5 m of a rail in
  plan, from `homeUp` 7 m above its top to `homeBelow` 4 m under it, on the ground or in the air, replaces
  the jump with a SOLVED hop: a pop to `homeHop` over the higher of her and the bar, the descending moment
  she is at the bar's height, and the horizontal speed that covers the gap in that time -- landing on the
  nearest point led `homeLead` along the rail the way she is going. The catch is relaxed for that rail
  (`p.kickRail`, the flying kick's mechanism) and she grinds at the speed she had, at least
  `MELEE.grindV`. Zap's `flying_kick` plays for the hop if the skin has it. Off a rail she just left
  (`grindCool`) it does not re-home onto the same one. `npm run sim home`: every rail from either side
  on the ground, from 6 m above, and rolling past at 10 m/s all GRIND; a tap 9 m away is a jump; with
  `home` off none of them grind.
- **HER FEET ON THE GROUND (r36, `FOOTIK`, `footFind`, `legIK`, `footGround`).** *"The feet don't quite touch
  the ground -- it feels like she's floating slightly."* The alien's Hips TRANSLATION is constant in every
  clip, so every bent knee folds her legs up under a pelvis held at standing height and lifts the skates
  (Shredworld's borrowed-clip landmine). On the ground, after the mixer: each skate's SOLE is a point fixed
  in the foot bone's frame (measured at load in the REST pose as the floor under the ankle), the body drops
  until the lower sole touches (`maxDrop` .25, eased), a two-bone IK pulls the other skate down if it is
  within `near` (.16 m) -- higher than that is a stride or a trick, left alone -- and both feet turn flat to
  the surface. It is undone before the next mixer update (`footUndo`), the tail's rule. Eases out in the air,
  on a rail and in a bail. `npm run sim footik` drives the shipped IK on a fabricated bent leg: 0.00 mm miss,
  lengths kept, a tilted foot laid flat, finite when asked for 3 m; revert-tested on the knee sign (119 mm
  miss). **How it LOOKS needs her skin, which is draco -- that half is his.**
  **r36 MADE HER INVISIBLE AND r38 IS WHY: `footFind` CALLED `skeleton.pose()`.** That rebuilds every bone's
  LOCAL transform from the bind matrices, and for the ROOT bone -- whose parent is the 0.01 armature, not a
  Bone -- it writes the WORLD bind matrix in as the local one, so the armature's scale and turn land twice.
  Her clips carry no scale tracks (dropped at load), so nothing ever put the Hips back and the whole body
  was drawn at the wrong size. **A measurement must leave what it measures exactly as it found it.**
  `npm run sim footik` now builds her REAL rig the way GLTFLoader skins it (joints are Bones, the armature
  is not), runs `footFind`, and requires every bone's local transform unchanged: 0 with the fix, 1.1 with
  r36's line put back. No offline gate had caught it because no harness here ever built a skinned rig.
- **BLADE TRAILS (r36, `TRAIL`, `trailBuild`, `trailStep`).** A camera-facing ribbon off each SOLE (the same
  points the IK uses): the last `life` .22 s, widest at the skate and tapering to a point, white fading to a
  cool cyan, NOT additive (a pale floor turns additive into a smear). Earned by speed on the ground (9 -> 18
  m/s) and by SPIN or a flip in the air (`girl.yawRate`, off `faceH`). `npm run sim trail`.
- **THE SIDE SKATE WAS TRIED AND TAKEN OUT (r35 in, r37 out).** Right pad = which way her body faces, left
  pad = travel. *"It's too much, too crazy for a mobile -- there might be a way to do it better, but as it
  stands we need to revert that dynamic."* The code is gone (git has it at r35/r36, `TWIN`, `twinStep`); the
  right pad is the camera again. If it comes back, it wants a gentler shape than a held stick.
  **A STROKE IN FLIGHT IS IN THE HEADING'S FRAME, SO A HALF TURN HAS TO TURN IT TOO.** `p.shoveDir`
  is +1/-1 along `p.heading`; flip the heading under a live stroke and the rest of it pushes her the
  OTHER way. The side-skate test caught it from a standstill (she shot off backwards and the stance
  flipped back to fwd as "reversed"); the swivel had the same latent fault and negates `shoveDir` now.
  `npm run sim swivel` keeps it covered (revert-tested).
- **THE LOOK IS WEIRDPORT'S (r35, `LOOK.style` 2, `stepLights`, `skyBand`), AND r34 COPIED THE WRONG
  GAME.** *"That's what the screenshots were from and that's the one I like the look of the most."* His
  reference was WEIRDPORT, not Robits. Ported from weirdport's own measured numbers: his painted sky
  `images/hdri_game.png` (1774x887 8-bit, copied over) at `bgI` 1.35 with the bounce at .35 of that,
  NEUTRAL tone mapping at 1.0 (weirdport: ACES desaturates as it rolls off), the key sun dropped to
  30 deg on the same bearing, hemi 0xe4f0ff over dark purple 0x2a1f3d at 1.75, a cool fill opposite the
  sun, a PINK RIM 40 m beyond her along the lens shining back (it follows `cam.az`, so whatever she is
  in front of gets the edge), a TEAL bounce straight up, and the fog colour SAMPLED off the sky's
  horizon band in linear. The sky is drawn full resolution (`blurW` 0). `LOOK.style` 0 dusk / 1 robits /
  2 weirdport is read at load and remembered under `rg.style`. **The panel saves every row**, so look
  dials saved under another style (or under r34, before styles) are SKIPPED on load (`lookStyle` in
  `rg.tail`) -- otherwise r34's exposure 1.15 / sky 1.0 would sit on weirdport's sky. `NO SKY IMG` in the
  chip if it fails. Not ported: weirdport's toon/paint/outline shading, its characters and its kits.
- **THE BRIGHT LOOK IS ROBITS' (r34, `LOOK`, `PALS`, `loadSky`).** *"I like this bright, illuminated
  aesthetic -- ours is dreary and dark."* His reference screenshot is Robits. Borrowed from it:
  `images/HDRI_01_2K.jpg` (copied from the robits repo) is the sky AND -- the part that matters --
  prefiltered by `PMREMGenerator` into `scene.environment`, so every PBR surface is lit by the sky
  rather than only by two lights. Colour space is set BEFORE the prefilter (City's landmine: done
  after, the sky goes into the environment undecoded and everything gets a white sheen). The
  BACKGROUND is a 384x192 copy, which is the blur -- `ctx.filter` does not exist on iOS Safari.
  The park is pale (`PALS.bright`: lavender plaza, peach ramps, cyan coping), the hemisphere's
  ground colour is pale to match, ACES is 1.15, the fog is a light sky haze, and the camera sits
  at 5.2 m (was 6.0). `LOOK.bright` 0 is r33's dusk; it is read at LOAD because the park's colours
  are baked into its vertices, so the panel row says "reload" and the choice is remembered under
  its own key, `rg.look`. The chip says `NO SKY JPG` if the HDRI fails. Exposure, sky light, sky
  brightness and camera distance are live on the panel. **None of it is visible to any harness** --
  there is no GPU here -- so the look is his to judge.
- **RAILS ARE A FRACTION OF HER APEX, AND SHE CAN SETTLE ONTO A RAMP (r33, `RAIL_DEF`, `AIR.settle*`,
  `AIR.preAlign`).** *"She jumps so high it's hard to land on a rail -- put it just below her apex."*
  A rail's middle number is now the fraction of her flat-ground apex (`AIR.jump^2 / 2g`) above the
  ground under each end: 84-90% (3.3-3.5 m against a measured 3.81). Retune the jump and they follow.
  `npm run sim grind` MEASURES the apex by jumping and judges the rails against that, 60-97%.
  **THE SETTLE** (*"in Tony Hawk you hold a trigger in the air and the character stops its momentum and
  falls straight down onto the ramp"*): the right pad held DOWN in the air (key F) bleeds her
  horizontal speed at `settleDrag` and turns her square onto whatever face is straight below her
  (`groundAt`), from any height -- 8 m/s to 0.5 in 0.7 s, 0.4 deg off the face, still 8 m up.
  **THE PRE-ALIGN**: always, within `preAlign` SECONDS of touchdown she turns onto the face she is
  about to land on, at a rate that closes the gap by contact -- 0.0 deg out landing on a 39 deg
  transition, against 38 without it. **By TIME, not height**: a 2.4 m band left her 26 deg out,
  because a fast fall crosses a fixed height too quickly to turn in it. The dormant bail test has
  to switch it off too, or a body held out of square never reaches the ground out of square.
  **AND THE GROUND TILT EASES** (`RIG.tiltRate` 12 -> 7, on the panel) and a landing that squares her
  onto her line turns her BODY at `SK.landYaw` for half a second instead of snapping. Foot-level IK
  (feet flat on the surface, body as an additive layer) is not done -- the rotation is still the
  whole body about her hips.
- **"IT THINKS I'M BACKWARDS" HAD THREE SOURCES, AND THE CHIP NOW NAMES WHICH ONE FIRED (r32,
  `setStance`, `VERT.autoTurn`, `flickFlip`).** *"Every now and again it puts you in one of the two
  states."* Every stance write goes through `setStance(st, why)`; for 4 s after a change the chip
  reads `FAKIE·land` / `fwd·swivel` / `FAKIE·reversed` / `FAKIE·rail`.
  1. **A RAIL KEPT THE STANCE FROM THE GROUND.** Spin 180 in the air onto a rail and `stepGrind`
     snapped her heading back to the stale stance and carried it off the end. `enterGrind` now sets
     the stance from her body against the direction she grinds, the way a landing does.
  2. **COMING BACK DOWN THE WALL YOU WENT UP IS FAKIE, AND TONY HAWK HIDES THAT.** A vert air turns
     the skater round automatically. Now a LOCKED air (a tap, or rolling over the lip) turns her 180
     over `turnFrac` of the air she has, in the direction she is drifting; her own spin rides on top,
     so an extra 180 is fakie on purpose. `VERT.autoTurn` 0 (panel: Auto-turn on vert airs) is the
     old physics. Not on the swipe transfer, which goes OUT and lands forward anyway.
  3. **A QUICK LEFT TAP IS THE SWIVEL** -- easy to hit by accident; the chip says `swivel` when it is.
  **FLIPS ARE READ THROUGH THE CAMERA** (`flickFlip`, `FLIPP.camRel`): *"if she's in fakie and I flick
  away from the camera, I want a backflip."* The flick becomes a world direction by `stickWorld`'s
  own mapping and is then read against her body: toward her nose front, her back a back flip, her
  sides the twists. `npm run sim flip` tables six facings; `npm run sim grind` has the
  backwards-onto-a-rail row (revert-tested); `npm run sim stance` has the vert air both ways.
- **r28's STUCK-STICK NET KILLED EVERY CONTROL, AND EVERY TEST PASSED (fixed r30, `FRESH_MS`).** *"No
  controls work now lol."* A phone sends the pointerdown and THEN the touchstart for the same finger.
  On that touchstart the pad is already held by a finger in `changedTouches` -- which the "a finger
  that just landed cannot vouch for a ghost" rule refused to count -- so EVERY pad was released by
  the very touch that started it: no steer, no jump, no flip. A pad younger than `FRESH_MS` is now
  skipped on a touchstart (a ghost is by definition older than the event in hand).
  **THE HARNESS NEVER SENT THE TOUCHSTART THAT FOLLOWS A POINTERDOWN** -- only pointer events, plus
  hand-built touch events for the ghost rows -- so it tested a phone that does not exist. Every
  ordinary press in `npm run sim tap` now goes through `real()`, which sends both in the phone's
  order with a live `touches` list, and there is a row for a plain held thumb. Revert-tested: with
  the fix out, every tap, swivel, hold and flick row fails -- his report, reproduced exactly.
  **When a fix adds a listener for a NEW event family, the harness has to send that family for the
  ORDINARY case too, not only for the case the fix is about.**
- **FLIPS ARE THE LEFT PAD'S FLICK NOW, AND SHE FLIPS ABOUT HER HIPS (r29, `airPivot`).** *"You jump
  with the right, then flip with the left."* Up front, down back, right/left the twist and its
  mirror; a flick is a fast move AND a release, so a held spin or thrust is never one, and on the
  ground it does nothing (a fired flick eats the swivel tap). The RIGHT pad's flick in the air is
  now free (grabs, melee); on the ground its swipe up is still the transfer.
  *"She rotates about her root instead of her hips."* The air pivot was a typed `RIG.pivot` 0.62 m
  -- knee height on her (hips measure ~1.05 m). It is `girl.foot + hipsLocal.y * scale`, read off
  the rig at load like r27's turn axis, with `RIG.pivotAdj` on the panel (Flip pivot vs hips).
- **A STUCK STICK IS UN-STUCK BY ASKING THE GLASS, AND THE RIGHT PAD NO LONGER STEERS (r28,
  `stickCheck`, `cam.steerAz`).** *"My left stick just got stuck in this position. Also the right
  stick is making her turn."* His screenshot: left knob parked full forward, nobody on it, 28.9 m/s
  up the berm. Four ways an up goes missing were already closed and a fifth got through; rather
  than guess a sixth, every `touchstart`/`touchend`/`touchcancel` now checks `e.touches` -- the
  browser's own list of the fingers on the screen RIGHT NOW, correct even when an earlier event was
  lost -- and a pad whose thumb is not within `STICK_NEAR` px of any of them lets go. **It is not a
  timer**: a held, motionless thumb is IN that list, so it can never be dropped, which is the whole
  reason the watchdog was forbidden. A finger that has only just landed does not vouch for a ghost
  (putting a thumb back where the stuck one was), and a finger REFUSED by the ghost (one thumb per
  pad) is handed the pad -- so touching a stuck stick un-sticks it and steers in one move.
  `npm run sim tap` drives it with a pointerdown whose up never comes; revert-tested.
  **THE RIGHT PAD TURNED HER THROUGH THE CAMERA.** The left stick is screen-relative, so orbiting the
  lens rotated "forward" under a held thumb and she followed it. While the left thumb is down,
  steering reads `cam.steerAz`, which the follow camera moves and the right pad does not; with the
  thumb up it IS `cam.az`. (`boot.mjs`'s stub records window listeners now -- `__win(type, e)` --
  so the window-level net can be driven at all.)
- **"SHE FEELS LIKE A BOAT" WAS FOUR THINGS (r27, `RIG.centre`, `leanWant`, `swingOf`, `npm run sim
  feel`).** *"Responsive and exaggerated, like Jet Set Radio -- right now there's this laggy boat
  feeling."*
  1. **THE TURN AXIS WAS BEHIND HER.** His root was added after the animations: the hips sit 0.117
     export units (~0.2 m) IN FRONT of the root in every clip, so she swung round a point behind
     her. `RIG.centre` 1 slides the model so the HIPS are on the axis -- read off the rig at load.
  2. **THE LEAN WAS AWAY FROM THE TURN IN FAKIE.** It was `-steer * speed`: the sign of which way her
     NOSE turned, which is right facing forward and backwards in fakie. Revert-tested: the old rule
     leans in forward (5.6 deg) and OUT in fakie. Now it is physical -- the bend rate of her TRAVEL
     times her speed is the sideways acceleration, the lean is `atan(a / g) * leanK` toward its
     centre, flipped by which end leads. Into the turn both ways, up to 17 deg.
  3. **THE YAW WAS EASED TWICE.** `faceH` eased onto the heading and then the whole pose was slerped
     onto that at `tiltRate` -- on the ground and (at `AIR.ease`) in the air. Only the TILT is eased
     now (`girl.alignQ`, and `swingOf` in the air); the yaw goes on exact. And the air spin read the
     raw thumb, so a thumb on its way out was a slow spin: full rate now at `spinFull` of the pad.
  4. **THE TURN ITSELF WAS SLOW.** 1.35 rad/s at speed and 18 m/s^2 of grip is over a second for a
     90; now 2.4 and 30 -- 0.6 s at 14-20 m/s, and `turnBrake` halved so the carve keeps her speed.
  The camera is the fifth suspect and it is TASTE, so it is on the panel rather than decided:
  `Camera follow` (0 is off), `Camera lag`, `Follow after`. **`npm run sim brake` reads "stopped" at
  0.6 m/s now**: a quicker pivot carries the brake's last half metre a second round with her rather
  than letting it drain through zero, which is a skater stopping and turning.
- **THE WAY OUT OF A PIPE IS A SWIPE; A TAP ALWAYS COMES BACK (r25, `leaveGround(coy, xfer)`,
  `p.jump` 2, `VERT.kick`).** *"Jumping out of half pipes or bowls is a swipe forward on the right
  stick instead of a tap. If you tap, no matter what, you're constrained up and come back down."*
  The r21 "left thumb held forward as she leaves" exception is gone, and so is the other way out
  nobody asked for: the air thrust (left stick forward) used to carry a LOCKED air out over the
  coping -- `npm run sim vert` read a tap + left-forward landing at z 56, on the deck. Under the
  lock the thrust may only carry her ALONG the coping now. The right pad's swipe UP on the ground
  (or a rail, or the coyote moment off a lip) is `jump` 2; in the air it is still the front flip.
  **THE KICK WAITS UNTIL SHE HAS CLEARED THE LIP, AND SO DOES THE SPEED SHE ALREADY HAD.** She leaves
  a few centimetres BELOW the coping, so any outward speed on that frame puts her under the deck's
  surface, and the below-the-surface landing test stands her on it mid-launch. That is what the
  first version did: a 21 m/s swipe "apexed" lower than rolling off with no pop at all, because she
  had been landed on the deck and popped again off it. The outward part is held back on the frame
  she leaves and `stepAir` applies `kick` once there is air under her outward. Pipe and BOWL both
  in `npm run sim vert`: taps land inside, swipes 10-14 m out.
- **THE RAILS ARE 1.8-2.7 m NOW (r25).** An ollie on the flat tops out near 3.9 m, so 0.6-0.8 was a
  kerb. `npm run sim grind` places every row RELATIVE to the bar's top (`top(i, x, z)`), so moving a
  rail moves the test with it, and has a row that skates beside rail 0 on the GROUND and taps once:
  up past it to 3.8 m, down onto it, grinding.
- **PROCEDURAL FLIPS (r25, `FLIPP`, `flipShape`, `flipTurn`, `flipQ`).** *"Start driving the flips
  procedurally as a test, using the tuck and flip poses."* `tuck` and `flip_pose` are HELD poses (the
  first and last keys are identical) -- tuck is hands on the shins, 0.31 m head to foot; flip_pose
  the same crouch with the arms swept back and the feet opened, 0.40. The turn is ours, multiplied
  onto `bodyG` after `p.bq`, about the air pivot. Pose: in_air -> flip_pose -> tuck -> flip_pose ->
  in_air on the flip's own clock; spin rate `1 / (1 - spinK * tuck)` integrated and normalised, so
  tucked she turns 2.4x faster than opened out and the turn still lands exactly on 360. Landed
  short (bails off), the leftover rotation UNWINDS the short way at `settle` rather than snapping.
  Front flip = head forward = +X turn in her frame (local +Z forward); the twist is about her own
  spine, inside the flip. `npm run sim flip` checks all of that; how it LOOKS needs a skin, which is
  draco, so that half is his. `FLIPP.on` 0 (panel: Procedural flips) puts his flip clips back.
- **HIS `*_backward` CLIPS ARE AUTHORED FACING BACKWARDS, AND THE GAME TURNED HER ROUND TOO (r24,
  `faceForward`, `bodyYaw`, `FACEFIX`).** *"Whenever you put the character into fakie physically,
  the animation is also fakie, which makes the rider forward again."* Exactly right. Measured off
  his skeleton through a real mixer: every `*_forward` clip's body faces -17..18 deg off the
  model's forward, and 14 of the 15 `*_backward` clips face 165-180. The game's heading IS her
  nose and is already flipped in fakie, so the two half turns cancelled: a backward stroke, facing
  the way she was going.
  **NOT FIXED BY DROPPING THE CLIPS** (his first suggestion): the forward clips in fakie are a
  forward stroke while she rolls backwards. The clip's own half turn comes out at LOAD -- a
  constant `C = P^-1 Ry(pi) P` on the front of every Hips key, in the Hips' parent frame, which
  turns her about her own hips without moving them -- so `heading = nose` holds for every clip and
  the backward leg motion is kept. **Decided by measurement, per clip**: only a `_backward` clip
  whose body actually faces away is turned, so a re-export that fixes it at source needs no edit.
  `blade_onefootback_L_backward` is the odd one out -- it already faces forward (1 deg) and is left
  alone, with a console line; worth a look in the export, since its R twin is turned.
  `MOVES.useBack` (panel: Backward clips in fakie) 0 is his suggestion, kept for the A/B.
  `npm run sim facing` poses every skating and idle clip with the fix OFF then ON, and requires
  every one within 30 deg of forward after -- and at least ten backwards before, or the
  measurement is not measuring.
- **r23: PUSH IS THE THUMB, MEDIUM IS GONE, AND NOBODY FALLS OVER.** *"Blade medium looks weird --
  arms swinging big and the feet barely moving."* The ground row is now two states, not three
  tiers: thumb OFF is the neutral roll pose (`idle_normal`, `idle_backward` in fakie, held -- the
  standing idles still rotate only when she is still); thumb ON eases `blade_casual_*` into
  `blade_hard_*` across `MOVES.pushV` (4 -> 14 m/s), each played x0.55-1.35 by speed against its
  own reference. `p.thumbGo` (set in `stepGround`, false while braking) is what the brain reads,
  so the push clip and the push PHYSICS cannot disagree. He has not drawn `blade_hard_backward`,
  so a hard fakie push borrows `blade_casual_backward`.
  **THE COAST FADE (`SK.coast`) IS GATED ON TIME ON THE FLAT (`coastAfter`, `p.flatT`), AND THAT
  GATE IS THE DESIGN.** *"If you let go you continue rolling, but your momentum does fade."* A
  half pipe's bottom is flat too: fading on `n.y > 0.97` alone took a no-input swing from 95% of
  its peak kept to 72% -- the ramp dying under her -- and `npm run sim pipe`'s old pass mark (0.6)
  passed it. The mark is 0.85 now, verified by setting `coastAfter` 0: fail.
  **`LAND.bail` 0 (on the panel as Bails on landing).** A sideways landing takes the NEARER end AND
  is squared onto her line -- without the squaring she rode away with her wheels across her travel
  and skidded from 8 to 1.1 m/s, which is a bail by another name (`npm run sim stance` catches
  that: verified by removing it). An unfinished flip lands. The bail rows in that case set
  `LAND.bail = 1` explicitly, because they test the mechanism, which is kept.
  **THE SWIVEL (`swivel`, a tap on the LEFT pad, key Q).** Stance flips, heading turns 180, travel is
  untouched, so she rolls the same line the other way up. Ground only, off a rail, not mid-bail,
  and only for a skin with backward clips. `npm run sim tap` drives it through the real binding.
- **ONE-SHOTS ARE ONE-SHOTS BY NAME (`ONCE_RE`), AND THE PING-PONG THRESHOLD IS 30, NOT 12.** Flips,
  falls and get-ups measured 15-48 deg "open" as loops and were classified ping-pong -- every fall
  would have played forwards then backwards. Real loops in his export close to 9-18 deg, so 12
  split matched forward/backward pairs (`swizzle_forward` 18 pingpong, `swizzle_backward` 8.9
  loop); the only genuine out-and-back is still roller_girl's push at 45.5.
- **TWO OF HIS LOOPS DO NOT CLOSE IN POSITION** (measured through the armature, in metres):
  `blade_casual_*` ends its hips 0.144 m from where they start, `blade_swizzle_forward` 0.196 m.
  Each will jump once per loop. Not fixable here; worth a look in the export. Medium / soft / hard
  close exactly, with 0.38 / 0.17 / 0.26 m of the side-to-side hip travel he baked in.
- **STANCE IS A STATE (`p.stance`, `p.stanceLock`, `landStance`).** *"Land with your back forward and
  you're in fakie -- even pushing forward she's still going forward, just backwards."* A landing
  compares her BODY's forward with her travel IN THE PLANE SHE LANDED ON (so coming straight down
  a vert wall is judged in the wall's plane): within `LAND.ok` (55 deg) of the nose is forward,
  of the tail is fakie, between is a BAIL; slower than `minV` along the surface there is no
  direction to be wrong against. On the ground the stance flips only when her travel genuinely
  reverses against it (up a wall forwards, back down fakie). She PUSHES in fakie: the stroke goes
  along the leading end. **All of it only for a skin with backward clips** -- roller_girl keeps
  the old "always turn back to forwards below `fakieAt`", and `npm run sim stance` asserts both.
- **FLIPS ARE A FLICK IN THE AIR (`startFlip`) -- the LEFT pad since r29, the right before.** Up front, down back, right the
  twist flip, left the twist flip MIRRORED. Timed to the air she has LEFT when flicked (85% of
  the time to come back down to what is under her), so a late flick is quick and an early one
  takes its time; too little air is NO flip, never a guaranteed bail. Landing under 80% round is
  a bail. **His flips are standing flips** -- the hips rise 1.55 m in `front_flip` -- so
  `prepClips` strips their hips TRAVEL and keeps the rotation: the arc is the physics' job.
- **A MIRRORED CLIP IS REFLECTED AS DELTAS FROM THE BIND POSE, IN THE MODEL'S FRAME (`mirrorClip`).**
  Each key becomes a delta from its bone's rest, is turned into the model's frame, reflected
  across her centre plane, and handed to the partner bone in the PARTNER's own axes -- right
  whatever the rig did with its left and right axes. `npm run sim mirror` poses his real skeleton
  (rebuilt from the GLB's nodes; a skeleton needs no mesh, so draco never comes into it) both ways:
  every joint within **0.15 mm** of its partner reflected, which is the rest pose's own asymmetry
  (0.14). Against the UNmirrored clip it reads 625 mm, so the test can fail. The naive
  raw-quaternion flip also passes on HIS rig (his left and right axes are authored as mirror
  images); the delta form is there for the rig that is not.
- **THE VERT LOCK (r21, `VERT`, in `leaveGround`).** *"Off a half pipe you go straight up and come
  back down that same half pipe -- if you're holding forward and you ollie, you shoot over it."*
  The collider cannot hold a vertical face, so she left vert at its last band's ~85 deg and EVERY
  straight air drifted out -- the `vert` case labelled 13 m/s "back in the pipe" while it landed
  on the flat lip at deck height, because it measured against the deck's FAR edge, not the lip.
  Leaving anything steeper than `VERT.at` (65 deg), her speed out over the coping is removed and
  `inward` 0.6 m/s sent back in; sideways along the coping is kept. A thumb forward at the moment
  she leaves skips it -- the transfer -- and the existing hold-forward air push carries her over.
  13/17/21 m/s and both pops now land below the lip, FAKIE (no spin); holding forward lands on
  the deck, 15-29 m past the lip, which is `AIR.driftMax` and is on the panel as Transfer push.
- **GRIND RAILS (r22, `RAIL_DEF`, `RAILS`, `railCatch`, `stepGrind`, `grindLeave`).** Four rails --
  flat along Z (x -40), flat along X (z -46), a DOWN rail (x 38, 1.5 -> 0.5 m), and a diagonal --
  each on flat open plaza with 3 m clear either side, MEASURED with `groundAt` before any was
  placed, and away from the x = +/-60 strips the sim skates. **A rail is NOT in the collider**:
  she catches it, she does not stand on it or stop against it, so riding past one cannot snag her.
  **CAUGHT IN THE AIR ONLY**, swept along the frame's travel (three samples) because at 16 m/s a
  20 Hz frame is most of a metre: within `catchR` in plan, inside a band around the bar's top, not
  rising faster than `rise`, and not crossing it squarer than `minCos` (that is a jump over). On
  it she is locked to the line, `drag` 0.08/s (0.35 took 8 m/s down to 2.4 over one rail), sped up
  or slowed by the slope, and off when she runs out of rail (into the air with her speed), runs
  out of speed (tipped off the side she came from, with `cool` before she can re-catch it), or
  taps -- an ollie off the rail.
  **WHICH CLIP IS THE SIDE SHE CAME FROM, RELATIVE TO HER TRAVEL.** *"Approaching from the left
  side, going at an angle toward the right, she goes into a right side."* Her sideways speed
  against the direction she will grind decides it; landing dead straight on, which side of the bar
  she came down on. Going -Z her right is +X, so the same world drift is the OPPOSITE grind going
  the other way -- `npm run sim grind` has a row for exactly that. `GRIND.swap` (on the panel)
  flips the convention if the clips turn out to be named the other way round.
  **SPARKS** are a ring of additive points thrown off her wheels at a rate that follows her speed,
  faded toward BLACK -- invisible under additive blending, so no per-point alpha and no shader.
  **A CHECK THAT TAKES ITS PASS MARK FROM THE THING UNDER TEST CANNOT FAIL.** The "rising fast past
  the rail" row first compared against the live `GRIND.rise`; with the gate removed (rise 99) the
  pass mark moved to 99 too and the row passed while she was caught climbing at 5 m/s. It uses its
  own definition now, and was verified by removing the gate: fail, then pass with it restored.
- **THE PANEL IS PATHS NOW (`TAILUI`, `UIOBJ`, the ⚙ key).** A row names `OBJ.key[.index]`, so one
  table drives TAIL, LAND, MOVES, VERT and AIR. A `deg` row is shown in degrees and STORED in
  radians -- crossed units would hand the landing check 53 radians and nothing would ever bail,
  and `npm run sim panel` checks exactly that. `UI_DEF` snapshots every row before anything saved
  is applied; r20's bare saved keys (`sway`) still load.
- **HE TUNES ON A PHONE WITH NO CONSOLE, SO EVERY DIAL IS ON SCREEN (r20, `#tailB`, `TAILUI`).**
  *"I can't type the things into the console, so you've got to put buttons on the screen."*
  `rg.TAIL.x = ...` was useless advice. The `∿` key opens a panel of sliders built from ONE table
  (`TAILUI`), so a new dial is one line; the mode buttons pick which rows show; RESET restores
  `TAIL_DEF`, captured BEFORE `tailLoad` applies anything saved (read later, it would be his
  phone's store, which is the opposite of a default). Saved under its OWN key, `rg.tail`.
  **CUSTOM SLIDERS, NOT `<input type=range>`**: the root is `touch-action: none` (that is the iOS
  double-tap fix), and a native range input under it is unreliable to drag on Safari. Pointer
  events always fire, so the track reads the thumb itself. **Offer a control he can reach, not a
  console command he cannot** -- the same rule as `missing()` in Shredworld, one step on.
  `npm run sim panel` drives it through real listeners. Its first run caught the panel never
  clearing between modes: the stub has no `firstChild`, and clearing by `children` is the form
  both the stub and a browser support, so the harness now runs the phone's path.
- **THE WAVE TAIL WAS STIFF BECAUSE NOTHING DROVE ITS BASE (r20, `tailDrive`, `TAIL.sway` ...).**
  His visualizer's arm was driven by a WAVEFORM at the first segment; this one only by her hips,
  and *"there's no natural rotation in the hips really."* Four drivers now feed the base, and
  the cascade turns each into a wave: `sway` (two sines at an awkward ratio, his waveform,
  standing in for hip travel the mocap lacks), `turnSwing` (flung out behind a turn), `lift`
  (forward acceleration) and `speedLift` (streams up with speed). All read off the tail ROOT's
  own motion -- forward is root-minus-tip in plan -- so any rig works and the harness drives
  them. Signs MEASURED: turning +1 rad/s puts it at -25 deg, cruising at 10 m/s lifts the tip
  0.14 m, and the sway moves it 8 cm standing still. Still frame-rate independent with all of
  them on: 0.389 m at 60 Hz, 0.391 at 20.
  **SLOWER EASING MOVES THE TAIL LESS, NOT MORE.** Easing in WORLD space means a slow tail barely
  follows the base, so it soaks the motion up: sway 20 at 30/7 moves the tip 8 cm, at 12/4 only
  3.4. Amplitude is the drivers' job; the ease rates set the CHARACTER of the wave.

- **THE STICKS ARE STYLED (r43, CSS only).** *"More stylized, more visible, look cool -- weirdport has nice ones."*
  Weirdport's shape in this game's colours: a coloured rim (`--pc`: cyan left, pink right -- different controls,
  different hues) with eight ticks from one masked conic gradient, a dark ink outline so it reads on the pale floor
  (the old white-on-glass rings vanished there), and a solid knob drawn as a skate WHEEL. Pseudo-elements only, so
  `bindStick`'s `.ring` / `.knob` lookups and every gesture are unchanged; nothing animates under a resting thumb.
- **THE STICKS FLOAT, AND A FIXED PAD IS WHY SHE COULD NOT JUMP.** *"I'm having trouble jumping
  and I can't tell if it's a thumb location thing."* It was exactly that. The pad used to be a
  132 px circle and `far` — how far the thumb has travelled — was measured **from the circle's
  centre**, so a thumb coming down near the rim read as almost full deflection *before it had
  moved at all*, and the tap was rejected as a camera drag every single time. The pad is a ZONE
  now (half the screen, invisible) and the stick draws itself wherever the thumb lands, so `far`
  means "did the thumb move" rather than "did the thumb land in the middle of something you
  cannot see". A faint ring rests at a home position so it is still discoverable; the moment a
  thumb lands, THAT is the centre.
  Measured through the shipped `bindStick`, and **verified by reverting to the fixed centre**:
      floating   dead centre JUMP   near either zone EDGE JUMP   dragged 50 px no   held 420 ms no
      fixed      dead centre JUMP   near either zone EDGE **NO JUMP**
- **AND THE HARNESS CAN DRIVE THE PADS NOW.** Several reports have lived in there — the stuck
  stick, the tap that would not jump — and not one was reachable by any tool here, because the
  DOM stub swallowed every listener. It records them and dispatches for real, so `npm run sim
  tap` drives the SHIPPED `bindStick` with synthesised pointer events. The stub's rect had to grow
  from 100 to 300 square, because a half-screen zone clamps its origin 70 px inside its own edges
  and a 100 px rect leaves no interior to press.
- **A STUB THAT ANSWERS `null` FOR EVERY SELECTOR CANNOT CATCH A WRONG ONE**, which is the same
  fault as answering every id, pointed the other way. `check:boot`'s `querySelector` resolves a
  class that really is in the page and returns null for one that is not — so `.knob` works and a
  renamed child is a caught TypeError rather than a blank page on the phone. Verified by renaming
  it: `Cannot read properties of null (reading 'style')`.

- **THE BODY IS A QUATERNION (`p.bq`), AND IN THE AIR IT IS UPRIGHT.** The old tilt/yaw/lean
  chain could not express a free body at all: three Euler angles in a fixed order only ever
  describe a skater standing on something. `groundQ` builds the orientation from the surface she
  is on; `leaveGround` freezes that as she goes; and from there she eases to PLUMB over
  `AIR.ease`, yawed to her heading.
  **r8 ALIGNED HER TO THE RAMP'S NORMAL IN THE AIR AND THAT WAS WRONG** — *"her rotation is
  matching the normals of the ramp, I don't think I meant that"*. Right: a skater flying out of a
  vert wall is UPRIGHT going straight up, not lying on her side parallel to the wall. She still
  LEAVES holding the face's angle, which is what makes the departure read, and straightens out
  over about a third of a second. Measured: leaving a 27 / 49 / 68 degree face she is **2-3
  degrees off plumb** 0.8 s later. `AIR.pitch` leans her into the arc instead, if that is ever
  wanted; 0 is plumb.
- **THE LEFT STICK IN THE AIR IS X = SPIN, Y = THRUST. THERE IS NO FLIP.** *"I'm not sold on the
  flip -- maybe we'll just have her rotate in the air for now, left and right"*, and *"in the air
  you'll hold forward"*, which is how you get over the back of one ramp and reach the next. Both
  read RAW off the pad rather than through `cam.az`: a spin is relative to her body and the
  thrust is along her nose, and neither is a question about where the lens is. Measured: **523
  degrees of spin** in 1.23 s of air (r26, `AIR.spin` 4.2 -> 7.5: *"she needs to rotate in the air
  faster"*; flips likewise capped at `LAND.flipMax` 1.0 s, was 2.4), and holding forward carries her **19.0 m against 12.2**.
  `AIR.driftMax` caps the total so a long flight is not a free flight.
- **THE BAIL IS DORMANT, AND IT CANNOT FIRE WHILE SHE IS UPRIGHT.** It compares her own up to the
  face she lands on, which only means anything while the body is free — upright in the air, every
  drop back into a transition is eighty degrees "out" and she would lose it every single time. So
  `AIR.land` ships at 99. **The mechanism is kept for the day there is a flip again**, and
  `npm run sim bail` proves it still works by arming `AIR.land` AND turning `AIR.ease` off for
  the duration: without that second half she is upright again long before she lands and every row
  reads "landed it", which is a test that cannot fail.
- **`SK.stick` MUST BE DERIVED, NOT TYPED — AND A FLAT 0.14 m GLUED HER TO THE LIP.** Moving `l`
  along a curve of radius R the tangent leaves the surface by exactly `l^2 / 2R`, so that IS the
  threshold for "is she still tracking this". A flat number was far too sticky near a vertical
  wall, where her step is almost entirely VERTICAL and the surface only creeps forward: she
  stayed glued past the arc, met the flat coping still grounded, and the re-projection took the
  whole of her climb — **18.4 m/s of vertical annihilated in one frame**, with nothing on screen
  to say why. Which is the kicker's flat-coping landmine again, **on the one ramp this file
  argued was safe from it**.
- **AND A HEIGHT TEST CANNOT SEE A SLOPE CHANGE (`SK.leave`).** Where a transition meets its
  coping the surface HEIGHT barely moves and the ANGLE jumps ninety degrees, so `drop` stays tiny
  whatever it is set to. The honest question is whether the new face is still pushing her onto
  it: `vel . n` is negative while she tracks a concave curve and goes sharply positive the moment
  the surface turns away under her. One rule for every convex crease in the park — a coping, a
  kicker's lip, the top edge of a funbox — checked BEFORE the snap and before the projection,
  because both of those are what would quietly eat the climb she is leaving on.
- **A VERTICAL WALL CANNOT BE REPRESENTED BY THIS COLLIDER, AND THAT SETS THE HALF PIPE.** The
  collider answers "what is the surface height at this x,z", so a 90 degree face has no footprint
  in plan and simply is not there. 88 degrees is as vertical as it goes. That matters because the
  outward drift over a flight is `v^2 sin(2T) / g` where T is the launch angle: at 90 it is zero,
  which is why real vert ramps are vertical and you come straight back down the pipe you went up.
  **And she can only ever leave at the last BAND's chord angle, not at the sweep** — 16 segments
  over 88 degrees makes that chord 85.3, so the segment count is worth as much here as the sweep.
  Measured at 28 segments: a realistic air comes back into the pipe, a 21 m/s launch that goes
  ten metres above the coping overshoots onto the platform. That last one is skating, not a bug.
- **THE POP GOES WHERE SHE IS ALREADY GOING, AND IT ADDS (`popDir`, `AIR.popTravel`).**
  *"Velocity needs to carry in the jump, it just adds to it, so the jump should kinda launch you
  in the direction of the tip of the ramp."* So the pop is along her travel over the SURFACE,
  blended toward world up by `k` — the vertical part of that travel direction:
      flat, or descending    k = 0   -> straight up, the only thing a jump can mean there
      up a 38 degree kicker  k = .62 -> 58 degrees, steeper than the ramp but along it
      up an 88 degree wall   k = 1   -> straight up, and she comes back down the same pipe
  One expression, and the vert case and the flat case fall out of it rather than being cases. It
  replaced `popNorm`, which asked about the surface NORMAL — on a wall that points sideways INTO
  the pipe, which is the opposite of where she is going.
- **THE PERIMETER HAS TO BE TALL, NOT STEEP — AND STEEPNESS IS THE INSTINCT THAT DOES NOT WORK.**
  She carries 24 m/s, which is **14.4 m of climb**, so a 4 m berm is something she flies straight
  over: six scripted runs put her off the edge of the world for 334 frames. A bank only has to be
  steep enough to turn her round; what stops her is HEIGHT. 6.6 m holds anything arriving under
  about 11.5 m/s and takes most of the speed off the rest, there is a 30 m apron behind it for
  the launches that do get over, and `respawn` catches her at **y < -8 rather than -40** — two
  seconds of falling reads as the game breaking.
  **AND `npm run sim solid` SPLITS THE TWO FAILURES, because only one of them is a bug**: under
  the world INSIDE the park is a floor that should have been there and was not; past the apron is
  her launching off the edge of the map at 24 m/s, which the respawn catches in a tenth of a
  second. Zero of the first, six frames of the second across 150 s of scripted flailing.
- **SHE IS FASTER NOW, SO THE RUNWAY IS SHORTER.** Top speed 14.2 -> 19.7 -> **24.3 m/s**, and two probe
  cases silently started measuring the PERIMETER WALL: `push` ran nine seconds, crossed 140 m,
  rode up the wall and reported her speed after being launched off it (11.6 instead of 19.7);
  `carve` ran the 6 m/s row into the same wall and came back at 0.26 m/s. **Every case that holds
  the stick forward has to be re-checked against the park whenever she gets faster.**

- **A KEYFRAME TRACK'S `times` ARRAY IS SHARED, AND MUTATING IT IN PLACE IS THE WORST BUG THIS
  REPO HAS HAD.** *"She just holds the pose."* — three times, across three builds, and every fix
  was aimed at the wrong layer.
  Her 198 channels reference **two** distinct time accessors. GLTFLoader resolves each accessor
  once and caches it, and `KeyframeTrack` keeps the `Float32Array` **by reference** —
  `convertArray` returns it as-is when the constructor already matches. So `normaliseClips`,
  shifting the 1/24 s start offset off "each track", subtracted it **183 times from one array**.
  The times went to −7.6, `resetDuration()` came back NEGATIVE, and a track evaluated past its
  last key returns that key: **every clip in the file frozen on its final frame, for ever.**
  Ping-pong, playback rates, weight tables and loop modes were all fine and all irrelevant.
  Clone before you mutate: `t.times = Float32Array.from(t.times)`. And a clip whose duration
  comes back non-positive now says so in the console, because that is the signature.
  **`npm run sim clips` IS THE GATE, AND IT REPRODUCES THE SHARING ON PURPOSE.** It builds real
  `AnimationClip`s out of the GLB the way GLTFLoader builds them — same track types, same names,
  **same shared arrays** — and runs the SHIPPED `normaliseClips` over them, then checks every
  duration against the authored length. A harness that read a fresh copy per channel could not
  reproduce this at all. **Verified by reverting the fix in place**: `skate_fwd` and
  `jump_in_air` come back at duration **0.000**. Check the revert anchor actually matched before
  believing a test that says it caught something.
  **AND THE OTHER PROBE SAID EVERYTHING WAS FINE.** `npm run sim anim` fabricates actions with
  the authored durations and never runs `normaliseClips` — so it reported perfect weights and a
  correct time scale on a clip the game had frozen. **A harness that measures a path the game
  does not take measures a different game**, which is this repo's oldest mistake and the only
  one it has now made twice.
- **A SKELETON DOES NOT WANT SCALE TRACKS, AND `jump_start`'s ARE ZERO.** *"Before the
  jump_in_air animation her upper half body shrinks to 0."* Exactly that: 54 scale tracks pinned
  at **0.00** — Spine, Spine1, Spine2, both shoulders, both arms, both hands and every finger.
  Two keys each, both zero. **A metric that asks whether a track CHANGES says it does not move**,
  which is how `npm run clips` missed it the first time: it is not changing, it is constantly
  nothing. Read VALUES, not deltas, when the question is "is this track sane". Every other clip
  has all 66 scale tracks at a flat 1.000, so they are no-ops and dropping the lot costs nothing.

Each of these cost a round in the build that found it.

- **THE SURFACE IS THE FRAME, NOT THE WORLD.** Her velocity is decomposed against the face she
  is standing on — forward along the wheels, sideways across them, nothing into the surface.
  That one choice is what makes transitions work with no special case: on a quarter pipe
  "forward" is up the wall, the wheels roll freely along it, the edges still bite across it,
  and gravity's component ALONG the wall is what slows her on the way up and hands it back on
  the way down. **A half pipe is not a feature here; it is the flat ground at a different
  angle.** Anything that reasons about `vel.y` on the ground is reasoning in the wrong frame.
- **THE WHEELS REDIRECT HER SPEED, THEY DO NOT DELETE IT.** The first version decomposed the
  velocity in the frame she *started* the frame in, turned the heading, and rebuilt in the same
  old frame — so the velocity never followed the skates, the lateral component piled up, and
  `grip` scrubbed it off. Measured: **14 m/s into a 90 degree turn came out at 4.2.** Now the
  decomposition is in the old frame, the rebuild is in the NEW one, and `gripA` (the most
  lateral acceleration the edges can supply) limits how fast the velocity may be rotated —
  `gripA / v` rad/s. Ask for less and the carve costs nothing but `turnBrake`; ask for more and
  the surplus is a slip angle, which is a drift. **One number, both behaviours.** After:
  14 → 11.5, 20 → 19.0.
- **ROLLING DRAG IS WHAT KILLS A HALF PIPE, AND IT IS NOT AN OBVIOUS SUSPECT.** `SK.roll` 0.16
  is a 4.3 s half life, which is a third of her energy per swing of a transition — the ramp
  visibly died under her and it reads as "the ramp is wrong". Measured, dropped in from the
  2.37 m coping with **no input at all**:
      roll .07   peaks 1.70 1.45 1.21 1.01 0.82 0.67
      roll .04   peaks 2.23 2.10 1.98 1.84 1.74 1.61   <- shipped
      roll .03   peaks 2.29 2.31 2.30 2.28 2.26 2.27   (perpetual motion; too good)
  Pumping tops out at **5.7 m**, well over the coping.
- **A FLAT COPING BAND ON TOP OF A KICKER IS A LANDING PAD.** Ten centimetres of flat on a
  38 degree lip: she meets it with her velocity pointing 38 degrees up, the re-projection takes
  the whole normal component, and she leaves the ramp with no vertical speed at all. It read as
  **0.28 s of air at 8 m/s and 0.28 s at 20**, which is the tell — a launch that does not scale
  with the run-up is not a launch. A kicker's lip IS the end of the arc. (The half pipe's
  coping is fine: she is airborne above it by then.)
- **`revolve`'s WINDING DEPENDS ON WHICH WAY THE PROFILE MARCHES.** A profile going OUTWARD and
  one going INWARD produce opposite windings from the same angular sweep — so the bowl (inward)
  came out right and the perimeter corners (outward) came out upside down. **A floor wound the
  wrong way is thrown out by `triAdd` as "not a floor" AND drawn facing down**, which is a hole
  in the world that still looks like concrete from above. `revolve` asks the profile now.
- **A POLE NEEDS A TRIANGLE WITH THREE DISTINCT CORNERS.** Taking `(A, B, C)` at the inner pole
  of a revolve takes the same point twice — zero area, `det` rounds to nothing, point-in-triangle
  never matches, and **the entire flat bottom of the bowl was missing from the collider while
  still being drawn.** She fell straight through it, at (-26, -24.75), which is the only reason
  it was found.
- **A FAN TO A BOX BOUNDARY MUST SAMPLE THE BOX'S CORNERS.** Without them, every angular wedge
  that straddles a corner is a straight chord cutting it off — four triangular holes in the
  floor, in ground that looks exactly like the rest of it.
- **A SINGLE NaN VERTEX IS AN INVISIBLE WORLD AND NOTHING ON SCREEN SAYS SO.** The geometry's
  bounding sphere comes back NaN and three culls the whole park. `plaza` shipped one because it
  read `hole.r` off an object that spelt it `rim`: `undefined` propagates silently through
  arithmetic, and the SAME typo also meant the bowl's hole was never cut, so she skated across
  the top of it. **One word, two bugs, neither of them visible in the code.** `pushTri` rejects
  and reports a non-finite vertex now.
- **AND THE HALF PIPE'S FLAT BOTTOM WAS STILL ONE (fixed r40), WHICH IS WHY THIS IS A TEST NOW.** *"Artifacting
  on the ramp -- it's a little too low, below the ground plane."* 15 x 6 m of peach at exactly y = 0 between the
  two transitions, fighting the plaza: the stripes in his screenshot. Two fixes, both general: `extrude` no
  longer draws a strip lying flat on the plaza (the plaza already draws AND collides there; off the plaza's
  square, e.g. the apron, a flat strip is still drawn because it is the only floor), and the plaza is its OWN
  mesh with `polygonOffset`, so every ramp's toe -- which starts at y = 0 and is coplanar with the floor to
  within depth precision for its first few millimetres -- wins over it. The offset moves only the depth test,
  never her skates or the collider. `npm run sim zfight` scans the drawn park for any upward triangle lying
  exactly on the plaza and checks the offset; revert-tested (the strip put back reads 2 and fails).
  **AND `npm run sim pump` HAD BEEN PASSING ON A BLIP**: "more than two peaks" counted a 4 cm bump where that
  strip met the plaza as a third swing. It asks for two real swings over the coping now.
- **A `y = 0` APRON IS COPLANAR WITH THE PLAZA THAT IS ALREADY UNDER IT.** Every ramp used to
  start and end with a few metres of flat run-up in its own profile, at exactly the height of
  the ground beneath — two surfaces fighting for the same pixels, which reads as patches of a
  ramp shading wrongly and flickering as the camera moves. **Every piece starts where it LEAVES
  the ground.** It is also why the bowl's outer ring went: the plaza's fan already reaches its
  rim.
- **BOTH RAMP SKIRTS WERE WOUND INWARD AND SO WERE NEVER DRAWN AT ALL.** With `FrontSide` culling
  you looked straight through the flank of every ramp in the park, saw the inside of its deck
  (culled too) and so saw the world behind it. Worked out rather than flipped and re-flipped:
  `F x up` is `-S`, so the `+halfW` face needs the vertex order that puts its normal along `+S`.
  **When a face is invisible, suspect its winding before its normal** — they are the same fact
  here, since `pushTri` derives the normal from the winding.
- **BELOW THE SURFACE IS BELOW THE SURFACE, WHICHEVER WAY SHE IS GOING (the `under` test).**
  *"Her collisions with the ramps is faulty, she kinda goes through them a little."* The landing
  test required `vel.y <= 0`, which is right for falling onto a deck and wrong for everything
  else: **jump at a transition while still RISING and nothing tested her against the thing she
  was climbing into**, so she went in and out the far side. Measured through the shipped step,
  eight ramps x three speeds, skating and jumping into each: **0.879 m inside the concrete**
  before, 0.000 after.
- **AND THE COLLIDER IS SAMPLED AT A POINT, so how far she moves between samples is how far she
  can get into something before anything notices (`SK.sub`).** At 20 m/s a 60 Hz frame is a third
  of a metre and a near-vertical transition is a few centimetres wide in plan. Sub-stepping by
  DISTANCE rather than time is what makes a 20 Hz phone play the same game as a 60 Hz one --
  and the test that shows it has to run at the phone's rate, because at 60 Hz it contributes
  almost nothing (0.879 -> 0.854) and at 20 Hz it is the whole difference (**0.547 m -> 0.000**).
  **A collider test at 60 Hz is a flattering test.**
- **THE BANK IS A HINT, NOT A PHYSICS DEMONSTRATION.** `SK.lean` 0.085 with a 0.62 rad ceiling let
  her lie over THIRTY-FIVE DEGREES in a hard carve, which reads as a motorcycle and fights
  whatever the clip is doing. 0.016 and about six degrees. `rg.SK.lean = 0` removes it.
- **A RAMP IS A FLOOR, NOT A SOLID, AND THAT IS ON PURPOSE.** `triAdd` throws away a face
  steeper than `TRI.up`, so a ramp's SIDE WALLS are not in the collider: meet one side-on and
  you pass through it, roll at it up the slope and you ride it. The alternative is a box you
  stop dead against, which is worse. The skirts are drawn and not collided with.
- **`SK.stick` IS THE ONE NUMBER THAT SEPARATES A TRANSITION FROM A LAUNCH.** How far the
  surface may fall away under her in one frame before she is airborne. On a 2.6 m transition at
  10 m/s that gap is under a centimetre; off the lip of a kicker it is a metre.
- **A LANDING THAT GRAZES THE SURFACE KEEPS NEARLY EVERYTHING AND A SLAM KEEPS ALMOST NOTHING**
  (`SK.landKeep`, scaled by the graze angle squared). Dropping back into a transition at the
  angle of the wall is the whole sport; taxing it the way a flat slam is taxed makes a ramp feel
  like glue.
- **A HELD BRAKE IS A BRAKE UNTIL THE THUMB LEAVES IT** (`p.braked`). Without the latch she
  carves round to face the thumb, the forward component flips positive, the brake becomes a
  push, and a held brake reads as a 180 into an acceleration. **And the latch needs a real ZONE,
  not a sign test**: a thumb held exactly sideways puts the forward component at ±1e-17, so
  whether she is "leading with her back" would be decided by rounding, and one frame of that
  kills the steering for the rest of the session.
- **FAKIE IS A DIRECTION OF TRAVEL, NOT A MISTAKE — AND IN A HALF PIPE IT IS HALF OF EVERY RUN.**
  She rides up the far wall, stops, and comes back down BACKWARDS. Written against her nose,
  every control is inverted for that whole half. The thumb is measured against the LEADING END
  (`lead`, `rel`). **And `lead` only goes negative past `SK.fakieAt`**, so she can never be left
  trickling backwards with the controls mirrored and no clip to sell it.
- **A PUSH IS A STROKE, NOT A STEP.** Each shove spread over `strokeDur` on a half sine — the
  integral of `(π/2)sin(πu)` over one cycle is exactly 1, so the top speed is unchanged.
  Measured: worst one-frame jump **0.40 m/s**. A staircase on the speedometer is the bug.
  **And `pushT` is a PHASE in [0,1), not raw seconds** — the period moves with speed, and
  `T / P(now)` and the integral of `dt / P(t)` are the same number only while P is constant.
- **IN THE AIR THE STICK IS A RATE, NOT A TARGET.** Held as a target it is a 45 degree turn and
  then nothing. **The sign is negated** — heading grows +Z toward +X, which turns her LEFT, so
  a thumb pushed right has to DECREASE it. Checked, not derived; the handedness argument comes
  out backwards half the time. Forward is `(sin h, cos h)`, her right is `(-fz, fx)`.
- **NEVER SCRUB A VELOCITY WITH A BARE `*= k` PER FRAME.** `Math.exp(-k * dt)`, always —
  otherwise the half life depends on the frame rate and a 120 Hz phone plays a different game.
- **A STUCK STICK IS ALWAYS A MISSING `pointerup`**, and there are several ways one goes missing
  on a phone: a second finger overwriting the pad's id, `setPointerCapture` throwing after the
  pointer has gone, capture lost without `lostpointercapture`, and the app backgrounded
  mid-touch. All four are closed. **There is no watchdog and there must not be**: a pointer that
  is not moving generates no events, so "no events" and "no thumb" are the same observation —
  a test that cannot tell its two answers apart is not a test, and its false positive (dropping
  a hold the player is in the middle of) is worse than the bug.
- **MEASURE HER WITH GEOMETRY BOUNDS, NEVER `Box3.setFromObject`.** A skinned mesh ignores its
  node transform but `setFromObject` applies it anyway — her armature is scaled 0.01 and turned
  a quarter turn, so the box comes back a hundredth of her size and on its side. GLTFLoader
  binds every skin with the IDENTITY matrix, so at rest a vertex's geometry position IS its
  world position and the bounds are already metres.
- **HER MATERIAL EXPORTS AS `BLEND` + `doubleSided`**, which is the Blender default whenever the
  texture carries an alpha channel — and a transparent double-sided skin sorts against itself,
  so her far side draws over her near side and she reads as see-through. It becomes a CUTOUT
  (`RIG.alphaTest`), which does the same job for hair and eyelashes and writes depth like
  anything else.
- **NEVER ASK `action.isRunning()` WHETHER A CLIP STILL MATTERS — ASK ITS WEIGHT.** three ends a
  `LoopOnce` clip with `clampWhenFinished ? paused = true`, so `isRunning()` is false from the
  instant it finishes and a clip shut down inside `else if (a.isRunning())` keeps the 1.0 it was
  last given for the rest of the session. **And re-entering a `ONCE` clip has to rewind it, on
  the STATE and not on the damped weight** — jump, land, jump again, and the second jump never
  plays.
- **THE TARGET WEIGHTS MUST SUM TO 1.** A zero-weight bone is blended back to its BIND value by
  the mixer, which is the T-pose exactly, so a table that dips below 1 mid-crossfade bleeds the
  bind pose in. All the clips damp with the same half life, so a table summing to 1 stays
  summing to 1.
- **WHICH WAY HER EXPORT FACES IS THE ONE THING NO OFFLINE CHECK HERE CAN SETTLE.** `RIG.spin`
  is applied every frame rather than baked in at load, so `rg.RIG.spin = Math.PI` turns her
  round on the phone with no rebuild and no push.
- **A PROBE ON A TEST SITE WITH A RAMP IN IT MEASURES THE RAMP.** The first push run started at
  the spawn and skated straight into the funbox, the kickers and then the half pipe — a fine
  ride and a useless number. `x = 60` is open plaza from end to end. Likewise: feeding a
  FOLLOW camera into a brake test is a loop (her bearing drives the lens, the lens drives the
  thumb) and what gets measured is the harness; and a "carve circle" does not exist, because
  the stick is a HEADING — she turns onto it and skates straight, so the number worth having is
  the turn response.

- **A BONE POSITION TRACK IS A LANDMINE, AND `jump_start` IS A LIVE ONE.** Measured over every
  clip in the file: **only the HIPS legitimately translates** — 1 cm in `coasting`, 11 in
  `skate_fwd`, 19 in `Idle` — and that one is the body's height off the ground, which every
  crouch and landing needs. `jump_start` carries **fifty-four more of them, travelling up to
  twenty-five metres**: both shoulders, an arm, most of the fingers. Its ROTATION tracks on those
  same bones have two keys and do not move, so this is an exporter writing noise into channels
  that should not exist rather than anything authored — and played, it tears her apart on the
  frame she jumps. `normaliseClips` strips every non-Hips position track, which is a **no-op on
  the four clean clips** (their keys hold the rest value the bone falls back to anyway) and is
  the whole fix for the broken one. Delete it the day the export stops emitting them, not before.
- **`skate_fwd` IS AUTHORED OUT-AND-BACK AND PING-PONGS, AND ONE STRIDE IS THEREFORE TWO CLIP
  LENGTHS (`ANIM.cycles`, `PINGPONG`).** *"She holds the pose instead of looping when you hold
  stick."* Measured with `npm run clips`: 0.208 s, six keys, fourteen bones turning up to 106
  degrees — a real and quite violent push, **not** a static clip. Two things were wrong with how
  it was played, and the first is the one to remember:
  **IT IS NOT CYCLIC AND IT WAS NEVER MEANT TO BE.** The arm ends 106 degrees round and the hips
  19, so `LoopRepeat` snapped them back every pass. `LoopPingPong` makes it cyclic BY
  CONSTRUCTION — the forward pass is the push, the reverse is the recovery — and that is how the
  clip was drawn. **Ask before inventing a workaround for a clip that is not looping: it may be
  meant to ping-pong.** The first fix here was a push-then-glide window built to dodge the snap,
  which was a whole design decision taken to work around a one-word loop mode.
  **AND THE PING-PONG DOUBLES THE CYCLE**, so the scale that puts the stride on `pushPeriod` is
  twice what a one-way loop needs. Fitted one-way it ran at **×0.20** at a cruise — five times
  slow motion, which is a slow drift into a pose exactly as reported. It is ×0.40 now and the
  out-and-back lands on the stride period to a hundredth.
  **THE PROBE COULD NOT HAVE FOUND THIS AND THE CLIP READER COULD NOT EITHER.** `npm run sim anim`
  said the weight sat at 1.0 and the clip was rewound once in seven seconds — looping correctly,
  exactly as written. The fault was in the NUMBER it was played at and the LOOP MODE it was played
  under, and neither means anything without what is inside the clip. Two tools, one answer.
  **AND NOTHING HERE TESTS `setLoop` ITSELF**, because no harness can run `buildGirl` — her GLB is
  draco and `DRACOLoader` wants a Worker. A stated gap. What can be checked is that
  `THREE.LoopPingPong` is a real export (2202) and not a typo that `setLoop` would swallow as
  `undefined`, which it is.
- **iOS SAFARI HAS IGNORED `user-scalable=no` SINCE iOS 10**, so the viewport meta is not the fix
  for double-tap zoom and never was. `touch-action: none` on the root is — it is not inherited,
  but the browser intersects the values from the hit element up through its ancestors, so it
  covers every descendant that does not override, and clicks still fire. The buttons take
  `manipulation` instead (taps yes, double-tap zoom no). **And the PINCH gesture is a separate
  event family `touch-action` does not cover**: Safari fires its own non-standard `gesturestart`
  / `gesturechange` / `gestureend` for two fingers and they zoom the page whatever the CSS says.

## Not there yet

- **The rest of his r21 plan**, in roughly his order: grabs on the other stick, the half pipe's
  coping as a grindable rail, rail poses / a balance bar,
  trick points (+10 +25 ...), hand/foot trails, a speed tunnel / blur, landing and bail
  shake, a swivel CLIP (the swivel itself is r23, on `faceH`'s ease), and the variety skates (`onefoot*`,
  `daffy`, `swizzle`, `tiptoe`, `pose_duck/swan`) which have no trigger yet. `tuck` and
  `flip_pose` are loaded and unused.
- No audio at all.
- `skate_fwd` is six frames of one push, ping-ponged. `SK.pushDur` / `SK.pushFast` are the
  stride period and the clip is fitted to it; a clip authored as a FULL cycle drops straight in
  by taking it out of `PINGPONG` and setting `ANIM.cycles = 1`.
- There is no glide between pushes any more — she strides continuously while the thumb is
  forward, and `coasting` shows the moment it is not. A push-and-glide rhythm wants its own clip
  rather than a weight window.
- `jump_start` is only usable with its position tracks stripped (see above). It is also the
  clip with the most to gain from a re-export.
- No `landing` clip, no `coasting_fakie`, no grind pose. `girlAnim` is a weight table; naming a
  clip is all a new one needs.
