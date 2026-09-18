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
- `vendor/` — three r180 (module + core), GLTFLoader, DRACOLoader + wasm, BufferGeometryUtils,
  SkeletonUtils. From the city repo.
- `tools/` — `syntax.mjs`, `boot.mjs`, `bump.mjs`, `sim.mjs`, `clips.mjs`.

**`npm run clips` READS WHAT IS ACTUALLY IN EACH ANIMATION**, straight out of the GLB's samplers
— they are NOT draco compressed, draco only touches mesh primitives — so "she holds the pose" is
answerable in a second. It reports how many bones genuinely MOVE and by how much. **A QUATERNION
COMPONENT DELTA IS NOT A ROTATION**: `q` and `-q` are the same rotation, so a component swinging
from −1 to +1 reads as a delta of 2 and is a sign flip that three's interpolant takes the short
way round. Measuring components made a six-frame stride and a static clip look identical; the
honest number is `2·acos(|dot|)`, which is sign-insensitive by construction.

## Landmines

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

- No grinds, no tricks, no spins scored — **the right pad's FLICK is deliberately unspent** and
  `FLICK` is already wired for it.
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
