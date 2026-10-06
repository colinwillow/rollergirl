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
- `zones/` — **his Blender skate world (r64)**, one folder per zone (`zone_<name>_visual.glb` draco + webp,
  `zone_<name>_collision.glb` plain), all in WORLD coordinates, plus `ZONES_README.md` (his Blender session's notes).
  `bump.mjs` hashes every subfolder of `zones/` on its own, so a new zone needs no `DIRS` edit.
- `models/kit/` — **his weirdport building kit (r45)**, copied from `../colinwillow/weirdport/models/building_kit/`:
  `building_kit_pieces.glb` (the piece library: `wall_window`, `wall_solid`, `wall_door_C`, `wall_wide`, `wall_parapet`,
  `corner`, `roof` ... on a 3 m bay / 3 m floor) skins every procedural building, and
  `building_kit_generated_visual.glb` + `building_kit_collision.glb` are his four generated buildings BKG0-3, imported
  whole. No draco (custom attributes), WebP textures. `models/props/prop_hydrant.glb` is his hydrant.
- `vendor/` — three r180 (module + core), GLTFLoader, DRACOLoader + wasm, BufferGeometryUtils,
  SkeletonUtils. From the city repo.
- `tools/` — `syntax.mjs`, `boot.mjs`, `bump.mjs`, `sim.mjs`, `clips.mjs`, `export.mjs` (`npm run export`, the world as GLB for Blender; `npm run export:kit`, the ramp kit -- see `docs/RAMP_KIT.md`).
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

- **HIS ANGLED VIEW HAS A CAMERA, AND `npm run oblique` FINDS IT (r77, `tools/oblique.mjs`, `tools/heights.mjs`, `sink`).**
  *"Use this in conjunction with the top-down view."*
  - **The fit casts every pixel of his view onto the ground and looks it up in the top-down plan** through the schematic's
    own pin/mpp. The camera that makes the two agree wins: **0.85** correlation, 55 deg down.
  - `npm run plan` then renders OUR build from his camera, side by side with his view.
  - **What it showed first: his pool and bowl are sunk, rims at grade**, where r73-r76 had them on 3.6 m decks.
  - **`sink: 1` on a closed `wall`** puts its rim at the ground. The park's first `ground` polygon becomes the collided floor,
    with a hole per sunk piece, and `kitFloor` drops its cells there.
  - Harness rows now measure a sunk piece from its own floor (`rimY - h`), not from zero.
  - **AN AI RENDER IS NOT CONSISTENT GEOMETRY:** his "top-down" is itself tilted, so heights read off `npm run heights` are a
    guide, not a measurement.
  - **`shot.mjs` used ONE viewport per query group**, so the perspective shot had been rendering at the top-down's size all
    along. Each shot's `view` is applied now.
- **HIS SECOND PLAN IS A RE-RENDER, NOT AN UPSCALE, AND `npm run rebase` SAYS SO (r76, `tools/rebase.mjs`, `trace --over`).**
  *"I'm wondering if this better image will help."* It does: twice the detail, and the same park redrawn.
  - **The rebase registers it against the old drawing** (cross-correlation; correlation **0.48**, an upscale would read near
    1). It rewrites every pixel field, re-pins and rescales, so the world stays put. The old drawing is kept as
    `parks/mega_skatepark_v1.webp`.
  - **Then every area was checked on `trace --over` zooms.** The middle of the park agreed to within a few metres. The north
    centre did NOT: it is a street, not a quarter-pipe row. The vert, the bowl, the spine and the fence had drifted 5-10 m.
  - **TWO HARNESS ROWS HAD OLD-DRAWING PIXELS TYPED INTO THEM** (`W([823, 176])` for where the bowl deck starts, and
    `SH.W([458, 0])` for the pool deck's edge), and a rebase silently moved what they meant. They read the pieces' own boxes
    now. **A harness must never hold a drawing coordinate**: ask the piece.
  - **The export round trip failed on ONE sample** exactly on a diagonal edge of the bowl deck. That is the r70 rounding tie
    again; the corner is square now.
- **DETAIL PIECES: TERRAIN, KERB TERRACES, STAIRS + BANK, PLANTED ISLANDS (r75, `terrain`, `terrace`, `stairBank`, `island`,
  `kNoise`).** *"Lots of little ups and downs ... take a 50 x 50 plane and deform it by large noises and small noises."*
  - **`terrain` is that plane.** It is a grid of a broad noise, a fine noise and hand-placed `bumps`, faded to the ground over
    `edge`, and drawn only where it is above the ground (the plaza is the lows).
    - The noise is hashed from the seed and the piece's LOCAL coordinates, so a harness measures the same hills the game
      draws.
    - `maxSlope` (28 deg) is enforced by LOWERING peaks until no grid step is too steep. That bounds every triangle's own
      slope, so every face is a ramp she can ride.
    - It returns `hAt`, and `npm run sim kit` requires she is never under it. It returns `ground: 1`, so the overlap check
      lets trees and lamps stand on it.
  - **`terrace`** is tiers of 0.4 m. That is under `SK.step`, so she ROLLS up them. Each tier is a full-height column: a
    wall from the side, a floor on top.
  - **`stairBank`** is stairs with a bank over the same run (`angle` sets both).
  - **`island`** is a 0.45 m curbed bed with trees.
  - **His NW corner is rebuilt as the UPPER PLAZA**, a deck at 3.6 m joined to the pool deck: terrace north, stairs west,
    long stairs + bank south. The roof's bank moved to the roof's south side, where his drawing has it; it was sitting in
    the plaza's footprint. The poolWalk is gone, because the plaza does that job now.
  - **The schematic overlap check (S1) tests a `deck`/`island` by its outline (`poly`)**, not its box. A diagonal stair's
    box covers half the hub, and the island beside it read as inside it.
- **PATH PIECES, THE DASH, THE TAP TRANSFER, AND A DIVE THAT NEVER TURNS HER ROUND (r74, `wall`/`deck`/`walk`, `kProfile`,
  `kPathSample`, `kOutline`, `DASH`, `dashOk`/`dashGo`, `VERT.tapXfer`, `GRIND.aheadCos`, `npm run trace`).**
  *"I need a fully modular kit system ... you see those odd shapes, we gotta be able to build those."* Every curved piece
  before this was a revolve about a centre.
  - **`wall` sweeps a cross-section along a traced coping line.** It can be open or closed, `qp`, `bank` or `box`, one-sided
    or `both`, with its height varying along it. So a bowl of ANY outline, a kidney pool, a snake pill, an S-spine, a U
    funbox, a curved ledge and a C bank are one kind.
  - **`deck`** is a platform of any outline; **`walk`** is a ribbon with a height at every point.
  - **The schematic's bowl, pool, snake, funbox, spine, C bank, vert, walkways and roof are now his traced shapes.**
    Details are in `docs/RAMP_KIT.md`.

  Three faults the sim found in the new pieces, each the same lesson:
  - **A solid with no walkable top is a wall at every edge she rides up onto.** The deck bands, the walkway joints and a
    funbox's core all stopped her a body's width short.
  - **`top` meant two things** (a bowl's rim height and a ridge's flat width) and floated every ledge 0.8 m off the ground.
    The rim is `rim` now.
  - **An open path that repeats its end point bunches its samples there.** The first rail segment was 0.22 m and a 13 m/s
    grind stepped over it.

  *"I jump off the edge, swipe down, and she reverses her velocity and grinds the other way."* **In the air the dive only
  takes what is within 50 deg of her line** (`aheadCos`). With nothing ahead she drops and keeps her speed.
  Revert-tested: without the rule, off the end of rail 0 she U-turns back onto it at vz -9.

  *"If you swipe off a jump you go flying off it ... a tap on the right stick to transfer, we're reversing it."*
  - **A SWIPE UP on a ramp, or within `DASH.win` of leaving one, is the DASH:** +4.5 m/s along her travel, the blade
    trails, once per ramp.
  - **A TAP on a steep face is the TRANSFER**, armed and fired at the lip. Just off the lip it fires at once; in the first
    `tapWin` of a locked air it releases the lock.
  - On the flat, a swipe up is still a strike.
  - `npm run sim vert` and `vertair` assert the swap. `carry` sets `tapXfer` 0, because it measures a POP off each face.
- **A PARK FROM A SCHEMATIC (r73, `parks/mega_skatepark.json`, `kitSheet(J)`, `schematicLoad`, `npm run plan`).** *"I'm not really
  seeing the park ... what I wanna be able to do is take a schematic of a park and be able to build the whole thing from
  our modular parts."* He was right not to see it: r72 had every feature but **laid out by hand, its own way, scattered
  over 290 x 420 m**, and the top-down render (`npm run shot` with a top lens) showed islands on an empty floor.
  - **The park is now a FILE.** It places kit pieces in the PIXELS OF HIS DRAWING (`mpp` metres per pixel, a `pin`,
    `dir` in degrees on the page). The game fetches it before `buildPark` in the kit world. The format is in
    `docs/RAMP_KIT.md`.
  - **`pipePath` turns a line drawn down a snake run into straights and elbows at each corner's own angle.** That is the
    "we might need a 20 degree elbow" from r72, answered by the drawing instead of by a catalogue.
  - **`npm run plan` is the check.** It renders the build from straight above with the camera derived from `mpp` and
    `pin`, so a render pixel is a drawing pixel, then writes side-by-side and overlay images.
  - **`check:boot`'s `fetch` reads `parks/*.json` off the disk now (`STUBS`).** Without that, every harness would measure
    a kit world with no park in it. Every other asset is still offline.
  - **`npm run sim kit`'s sheet tests find pieces by the schematic's `id`,** so moving a piece in the file moves its test.

  Two traps the first runs hit:
  - **An overlap check on axis-aligned boxes calls a lamp inside a diagonal fence segment's box an overlap.** The lamp
    moved; the check is right for everything else.
  - **A planter traced from the drawing stood in front of the QP XL,** so the ride test hit the tree and read "up to
    0.00". The drawing's oval planter sits where riders would need run-up; the tree moved.
- **THE SHEET PARK: HIS STYLE SHEET BUILT FROM THE KIT, AND THE PIECES IT WAS MISSING (r72, `kitSheet`, `SHEET`, `KIT_NEW_ROWS`,
  `qpAdapt`, `pipeAdapt`, `freeBowl`, `squareBowl`, `bridge`, `roller`, `berm`, sizes `XXL`/`MEGA`).** *"See if you can build
  it with the pieces that you have ... how the edges of each modular piece go together ... we might need a 45 degree elbow
  ... I want this game to feel very big and exaggerated."* The kit world now SPAWNS at the main entry of a fenced 290 x 420 m
  park at its west end (134 pieces, the sheet's 24 features; the map is in `docs/RAMP_KIT.md`), and ➤ walks its 'sheet' stops
  first. Missing and built:
  - `elbow` takes any `deg`, so 45 and 22.5 are included.
  - Connectors between sizes: `qpAdapt` (height changes across a QP's width) and `pipeAdapt` (walls grow along a pipe).
  - Free-form bowls with a shallow end and a deep end; a square bowl; a bridge you ride over and under.
  - Pump-track rollers and berms of any angle.
  - Hubbas on stairs, rails on a funbox, and a taller landing on a gap.
  - Placeholder fence, shade, bleachers, planters and lamps.
  - Two bigger sizes: XXL 7.2 m and MEGA 9.6 m.

  What it found:
  - **A gap XL's 9 m landing is overshot at MEGA speed**: she slammed the flat, and QP MEGA reached 6.5 of 9.6. `landH`/`landDeg` give it a 4.8 m landing at 15 deg, and she now airs 1.5 m over it.
  - **67 m of flat between a roll-in and its kicker bled 25 m/s to 18 (the coast fade)**, so the kicker sits at the roll-in's foot.
  - The kit world's grid had to grow to x +/-470, z -420..470.

  **THREE HARNESS MISTAKES, NONE IN THE GAME:**
  - **A `//` comment pasted mid-line ate the statements after it**, twice: a `ReferenceError` on a variable whose declaration had been commented out.
  - **A local `const run` shadowed the harness's `run()`.**
  - **The export round trip's sample grid had to follow each piece's own box.** A 190 m fence's square round its origin sampled the marker test's floors. And the turned copy's offset had to move to +30, because -70 put the giants row off the collider grid.

  A swipe beside a hubba grinds the ledge's LIP, not its steel, because the lip is 8 cm nearer. Both are the hubba, and the test accepts either.
- **A GRIND IS ASKED FOR: SWIPE DOWN (r71, `GRIND.intent`, `grindDown`, `grindTarget`, `lipEdges`, `lipTrace`, `ledgePath`,
  `LEDGE`).** *"Make it so that you have to swipe down to grind something -- that way you can launch off a ramp ... a swipe
  up or a tap off a ramp will always launch you off ... in the air swipe down and she shoots downward as if she's gonna
  hit the rail ... grind the tops of boxes, the sides of boxes, the tops of half pipes and quarter pipes."*
  With `intent` on nothing catches her on its own: the air catch is gated on `p.grindWant` / a solved `p.kickRail`, a tap
  is always a jump (r41's `railHome` only runs with `intent` 0), and the air strike no longer aims at rails. The right
  pad's SWIPE DOWN: on the ground a solved hop onto the nearest rail or ledge (r41's maths; with nothing in reach it is
  the strike it always was); in the air she SHOOTS DOWN at it (the time is never more than `diveK` of a free fall, so
  she leaves heading down), and with nothing in reach she dives anyway (`diveVy`) and takes whatever she crosses.
  Just off a lip (coyote) it is the air version; on a rail it is still the grind trick.
  **LEDGES ARE FOUND, NOT AUTHORED.** Every box top, roof rim, deck coping, bowl rim and ramp side is already an edge of
  a floor triangle. An edge is a LIP when, measured from its own triangle's plane carried on (`gr`), the floor 6 cm out
  has already started to fall and 0.35 / 0.7 m out has fallen `lipDrop`, with no ceiling or solid there. **The plane
  matters twice**: without it the line between two bands of one slope is an "edge", and so is the crease at the foot of a
  transition. **And the 6 cm sample matters**: the park half pipe's coping band is 1.8 m of flat with a diagonal across
  each quad, and a single 0.3 m sample from the diagonal landed past the back edge and called it a lip. The two
  distances are because a ROUNDED coping falls away slowly and a box edge all at once -- one sample at 0.3 m missed the
  park half pipe's coping completely. A lip is only looked for under a swipe, traced along its neighbours (same corner,
  within 40 deg, facing the same way) into one path -- round a bowl that is a closed loop, at a box corner it stops --
  set `lipIn` back onto the top, and kept among the last `LEDGE.max` (8): a city of boxes as rails up front would be a
  hundred thousand segments for the catch to walk.
  `npm run sim intent` (13 rows: no swipe flies past a rail and the same drop with intent off grinds, tap = jump,
  ground and air swipes onto rail 0, the open-air dive, the half pipe coping, the bowl rim loop, the hub deck edge) and
  `npm run sim kit` P9 (32 walls: every mega-park pipe both ways, the sunk bowl and pool -- each grinds its coping at
  deck height). **Every OTHER case runs with `intent` 0**, set before each case -- `panel` presses RESET, which puts it
  back on, and that turned 19 rows of four cases red before the runner did it per case. Stated gap: those cases measure
  the grind with the old catch, not with the swipe.
  **What a swipe picks is the NEAREST thing**: beside the hub deck's front, the bank's and the stair set's sloped SIDES
  are nearer lips than the deck edge and rightly win -- a sloped side is a hubba.
- **THE MEGA PARK AND THE PIPE MODULES (r70, `kitPark`, `kitRun`, `kitSlab`, `pipe`/`elbow`/`tee`/`pipeEnd`, `colliderReset`).**
  *"A lot of singular ramps sitting out everywhere ... build me a mega park out of the kit so we can see where its
  limitations are and curate it before I hand over the kit."* r68's thirteen islands are gone; the kit world spawns her
  in ONE connected park: a closed RING of pipe M (straights, four elbows, two tees) round a PLATEAU at M deck height with
  a bowl M and a pool M SUNK into it (holes cut by `kitSlab`, which tiles platform M round rectangles) and a street on
  top, spurs off the tees (a stub to a half-bowl end; a snake), a roll-in XL lining up a bank onto the ring's deck (the
  spawn), a platform + stairs M off the east deck to a street, tiers M -> L -> XL, a mini snake S, a spine box, XL pieces,
  jumps, loops and a rail garden. **The pipes are SNAPPED**: four new kinds whose origin is the flat's entry and which
  return `out` (the tee also `out2`), so a pipe of any shape is a list run by `kitRun` -- which also writes each piece's
  centreline (`rec.cl`) so the sim can steer down the middle.
  **WHAT IT FOUND** (the list is in `docs/RAMP_KIT.md`): every slope-to-flat crease is a kicker at speed (the tiers were
  flown, not climbed); pipes only turn 90 and never rise or change size; a sunk piece only sinks to its own height; the
  world has edges -- the tiers first ran her off the white floor at 24 m/s and were moved north for run-out.
  **THE EXPORT ROUND TRIP SAMPLES FIRST AND INGESTS THE COPY ALONE NOW** (`colliderReset`): the world spans 600 m, so a turned
  copy overlaps something wherever it goes. **And its sample grid is offset off round numbers**: a sample exactly on a
  triangle's edge is a rounding tie, inside on one side of a 180-degree turn and outside on the other -- 18 "lost floor"
  points on an elbow's corner that were nothing of the kind. **A harness's own grid lining up with the geometry's grid is a
  false failure waiting to happen.**
- **THE LEVEL KEY (r69, `#worldB`, `WORLDS`, `worldPanel`, `worldGo`).** *"I'm not seeing a control button in the game to
  switch levels."* r68 put the switch at the top of the ⚙ panel -- a panel of tail dials nobody opens to change level, so
  it was not there as far as he could see. It is its own labelled, coloured **LEVEL** key now (left of ➤), opening only a
  list of the three worlds with a line each; a tap reloads into one by URL. The ⚙ panel keeps its row too.
  **AND `check:boot`'s STUB `classList` ANSWERED "NO" TO EVERY `contains`**, so no harness could tell an open panel from a
  shut one -- the same fault as a stub that answers every id. It is a real set now; `npm run sim panel` taps the key twice
  and requires open, three worlds, then shut.
- **THE KIT PARK (r68, `kitPark`, `pk`, `KPARK`, the ⚙ WORLD buttons).** *"I'm not really sure how to go test the kit. I
  thought you were gonna build a white world where I could ride the ramps -- an example skate park that's pretty complex,
  just placing the ramps to see how they go together."* The kit world now spawns her at the top of a roll-in in a
  48-piece park of 13 areas (drop-in line, plaza, boxes, pool, T-pipe, bowl, mini, L-pipe, XL corner, big pipe, rails,
  jumps, loops) east of the gallery, every piece a `kitPiece` placed so they MEET (bank top = platform deck = stair
  landing; handrail top runs on as a rail L and a down rail L; straights carried out of an inside corner by its rule).
  ➤ walks the park first. **And the way in is three buttons at the top of ⚙ (SKATE PARK / RAMP KIT PARK / HIS ZONES)**,
  each reloading with `?world=` -- the 0/1/2 slider halfway down the panel was the only way before, and he could not find
  it. Export groups the park as `example_park/park_<area>`. `rec.bb` (each piece's drawn box) feeds an overlap check;
  `rec.group` exempts sets built to touch.
  **THE ROLL-IN THREW HER OFF ITS OWN LIP.** A sharp 42-degree crease at the top launched her at any pushing speed (8.6 m/s
  off the deck = a flight to the flat and the drop's speed lost on landing). The lip is a 5 m convex curve now (`lipR`;
  she stays on while v^2/R < g) -- the line went from 11 m/s at the bottom to 17.8.
  **A HARNESS THAT HOLDS FORWARD THROUGH A VERT AIR DRIFTS HER ALONG THE COPING** (a locked air thrusts along it only), and
  off the side of a 12 m QP onto the flat beside it -- which read as a fall-through until the trace printed x. The drop-in
  row lets go past the kicker, like a player.
- **THE RAIL KIT (r67, `KIT_RAIL_ROWS`, `kRail`, `kArcPts`, `kCol`, `KIT_CHAIN`, `RAILKIT`).** *"We'll do the same
  thing with a rail system."* Same world, same `fn_` export, rows behind the spawn: straights S-XL, down rails, kinks,
  curves (90 left / 45 right / r 6), S-bend, rainbow, ring, helix, a Y, a booster, two ledges, three stair sets with
  handrails, and a CHAIN of pieces snapped end to end. **A rail's height is ABSOLUTE and on the ramps' ladder** (S 1.2 ..
  XL 4.8), origin on the ground under the bar's start, +u along it; every piece returns `out` (and the Y `out2`) -- the
  frame the next piece's origin goes in -- and `railLink` joins ends within 0.75 m, so snapped pieces ARE one grind with
  no connector piece. The export writes `info.out` in glTF local terms and a six-sided tube per rail as the placeholder
  (a rail-only piece was otherwise an empty in Blender). `draw: false` on an import also leaves the rails undrawn.
  **TWO THINGS ONLY THE SIM SAW:** the stair slope (collider-only, through the step noses) was wound DOWN and thrown out
  by `triAdd`, so she flew over every flight -- `kCol` winds it up whatever order it arrives in; and a Y whose branch
  leaves TANGENT to the main line can never be chosen, because a thumb pushed down it scores within `RAILNET.brMargin`
  of carrying straight on -- the branch kicks off at 20 deg now. `npm run sim kit` grinds all 34 gallery rail paths end to
  end from their high end (a stair rail climbed at grind speed stalls -- that is skating), taps onto rails and ledges
  from the ground, rolls every stair set down and up, grinds the 7-piece chain as one, takes the Y by the stick, and the
  export round trip puts all 68 rail ends back to 0.000 m. **Rolling UP a stair set fast launches her off the top** --
  32 deg ending in a flat is a kicker; the test coasts in at just over the climb.
- **THE RAMP KIT IS A THIRD WORLD, AND IT IS THE SPEC FOR HIS BLENDER LEVELS (r66, `KITW`, `KSZ`, `KIT_KINDS`, `kitPiece`,
  `kitWorld`, `levelFn`, `docs/RAMP_KIT.md`).** *"Build a set of modular ramp designs ... the corner piece of a half pipe,
  the straight, a junction where another tube meets it at 90, a bowl, a half bowl for an end, ramps in and out, taller
  things you run down to get speed, quarter pipes, all the jumps, loops 180 and 360, different sizes labelled ... make sure
  all of them function correctly, and then that kit we can export ... placeholders, a spec for where everything goes."*
  `WORLD.zones` is 0 park / 1 his zones / **2 the kit** (⚙ or `?world=kit`): a white gallery of 40 pieces in nine rows,
  each labelled, ➤ walks the rows. **A SIZE IS A HEIGHT** (S 1.2 / M 2.4 / L 3.6 / XL 4.8 m, radius from the sweep) so
  pieces of one size meet at one deck. Every piece is built in its OWN frame (origin on the ground at the middle of the
  toe, +u up it = world `(sin yaw, cos yaw)`, +w across = `(cos yaw, -sin yaw)`); corners and bowls are revolves, pipes,
  pools, L and T junctions are ASSEMBLIES of `qp` / `qpIn` / `qpOut` on one centre. Walls are drawn and not collided
  (a ramp is a floor); decks behind a coping, platforms and box tops are `solidAdd` boxes -- **its yaw is `T.yaw` with hx
  along w and hz along u**, which I got wrong first and which put every deck sideways. The loops are booster rails with
  `ups`, the city loop's mechanism.
  **`npm run sim kit` RIDES EVERY ONE**: crack scan over every pipe and corner, every QP size gets air over its coping,
  both corners, three half pipes and the pool swing, both bowls, the L and T routes, banks onto platforms, roll-ins
  (exit speed near free fall), spine S over / M back, kickers, launch, table, the gap clears at 15 m/s, the frustums, the
  360 inverts her, the 180 lands on its deck, a platform side is a wall.
  **`npm run export:kit` WRITES THE SPEC**: `exports/rollergirl_kit.glb` (one node per piece, `fn_<kind>_<size>_<n>`,
  mesh in the piece's own frame, local +Z = u, +X = w, turned about Y by the yaw; extras = kind, size and the options it
  was built with, plus an `info` object of reference numbers) and `rollergirl_kit.json`. **`levelIngest` rebuilds any
  `fn_` node** (by name, or by `fn`/`size` extras; `draw: false` = collider only) from either the visual or the collision
  file, once per node -- so a placeholder he moves in Blender comes back as the tested piece and his art goes on top.
  **THE ROUND TRIP IS TESTED THROUGH THE REAL LOADER, AND IT FOUND TWO BUGS THE FABRICATED-SCENE TEST COULD NOT:**
  GLTFLoader puts the original node name into `userData.name` (it arrived as a build option), and the option filter
  dropped every object -- including ARRAYS, so a hip came back as a funbox. The sim now exports, parses the GLB back,
  ingests it turned 180 and moved, and compares 8417 raised-floor points against the gallery: 0 off.
  **REFERENCE NUMBERS GO UNDER `info`, NEVER AT THE TOP OF THE EXTRAS**: a roll-in reads `o.r` and `o.deck`, so the size's
  radius written beside them would build a different piece on the way back in. And the loop's guide line is `guide_`,
  not `rail_`, or the import adds a second, plain rail on top of the booster.
  **`groundAt` HANDS BACK ONE SHARED OBJECT** -- three calls in a row and all three read the last answer. Copy it.
  **`export.mjs`'s `prim` closed over the world writer `W`**, declared after the kit block (TDZ); it takes the writer.
- **HIS ZONES ARE THE WORLD NOW, AND THE BUILT-IN PARK IS THE OTHER ONE (r64, `WORLD`, `LEVEL.zones`, `levelIngest`).**
  *"Import zone_skyline via LEVEL.imports at [0,0,0] ... rail_ edge polylines, launchers, spots, water and lava, fall
  below -40 -> respawn at the last spot, spawn me at the spawn marker."* His zones are in world coordinates and
  zone_skyline alone covers x/z +/-133 -- the hub, the bowl and three districts' gates -- so the two worlds cannot both
  stand. `WORLD.zones` (1 his, **0 the built-in park -- the default again since r65**: *"your build is way better from a
  functionality standpoint"*; his blockout was not fun to skate) is read at LOAD from `rg.world` (or
  `?world=park|zones`), and in zones mode
  `buildPark` builds NOTHING but the empty grids, Orbital's water/launcher/put-back machinery and the splash points.
  ⚙ "World 1 his zones 0 built-in park (reload)" switches. `init` starts the zones' collision files right after
  `buildPark` and WAITS for them before she drops in (no floor otherwise); the visuals land whenever they land.
  **What `levelIngest` reads from a collision file now:**
      rail_*            `grind_path_gltf` (an ordered line, a JSON string) -> a `railPath`, `railLoop` if `closed`.
                        A bare LINES primitive with no extras is chained from its own segments (`lineChain`).
                        A line that turns over gets `ups` by PARALLEL TRANSPORT (`railUps`: a flat curve keeps
                        world up, a loop turns with the track) and `LEVEL.loopBoost`, the city loop's booster.
                        `LEVEL.railMaxV` 32 caps them -- his sky chute is 67 m of drop and reached 43.5 m/s.
                        Then `railLink()` again, so his lines join each other and anything already there.
      marker_launcher_* `ORB.launch`. HIS `apex` IS A WORLD HEIGHT (34 over a target at 30.5), the launcher's is
                        metres over the higher end, so it is converted. The pad is re-seated on the COLLIDER's floor
                        under it (a tower box a metre taller than the picture buried one), and a ➤ stop is put a few
                        metres short of every pad on open floor at its height, facing it.
      marker_spot_* / marker_spawn_*  `CITY.spots['<zone> <spot>']`, `heading` in DEGREES (game sense). The first
                        spawn sets `SPAWN` and `SPAWN.h` (respawn faces it). The ➤ key walks `LEVEL.go` in zones mode.
      zone_water_*      `ORB.water` with its TRIANGLES (`tris`, tested by `inTris`), `hazard: lava` -> LAVA!
      prop_* metal      still a rail along the top -- only up to `LEVEL.railW` half width (a wide metal box is a
                        block), and NOT when one of his rail lines runs within `LEVEL.dedupe` of both ends (the fence
                        boxes under his railings: 147 of them in skyline).
  **FALLING**: in zones mode, under `WORLD.fallY` (-40) she is `putBack` where she last stood (`ORB.safe`, the
  splash's own rule, now one function), toast FELL!; the park keeps its old -8 respawn.
  **THE VISUAL IS MERGED INDEXED NOW.** `toNonIndexed` tripled every vertex; a zone is 549k triangles.
- **HIS EXPORTER WRITES SLOPED PIECES AS THEIR BOUNDING BOXES, AND THEY ARE REBUILT (r64, `LEVEL.slopeFix`).**
  Every bridge, sky bridge, the loop track and four stairs in skyline come out as yaw-only boxes -- SK_B_HQ_Dock_Deck
  is a 21 m SOLID BLOCK between two islands. A `*_Deck`/`*_RailMid`/`*_Caps` box thicker than `LEVEL.slopeH` (2.5 m)
  is not added; a Deck with two `*_RailTop` lines is rebuilt as the RIBBON between them (`levelRibbon`, dropped by the
  rails' measured height over the island they start from, wound so the first quad faces up and KEPT, so a loop's
  upside-down half is thrown out rather than becoming a floor on top of it, and lifted onto a deck it arrives on
  when it runs into that deck's side); one with none is a stair (`levelStair`, one slope to the floor beyond its
  high end). **Checked against his VISUAL, decoded with the vendored draco wasm in node**: every ribbon sits within
  0.25-0.5 m of his concrete decks. Delete the whole rule the day his collision export writes them as `ramp_`.
- **A RAMP RUNNING UP UNDER A SLAB IS A WALL, NOT A CEILING (r64, `solidPush`).** The "from underneath" push put her
  `hgt` under the slab's bottom -- and a ramp rising under one meets it, so that push went THROUGH the floor she was on
  and she fell out of the world (skyline's HQ->Dock bridge runs under the dock deck in his own scene; the visual says
  so: concrete 24->28 under metal at 28.4/30). If the push would go under her floor she is turned back instead.
- **LAUNCH ARCS ARE CLEARED (r64, `launchSolve`, `ORB.launchClear` 20).** The arc is sampled against the solids, feet
  to head, and raised a metre at a time until clear; nothing clears -> his authored arc. Skyline pad 37 needed +10 m
  over a container stack. `L.clear` says what happened.
- **`npm run sim zones` RUNS IN THE OTHER WORLD**, so the harness sets `rg.world` from the case before the import and a
  full run hands `zones` to a child process. His real collision file through the real loader; the visual is draco and
  is not loaded. `warn()` rows (EXPORT, not FAIL) are things to fix in HIS file, not here. **Skyline, r64:**
      pad 229          sits beside the hangar; the arc meets it -- lands 27 m off
      pad 249 / 262    aim at a point beside the alien spire / under a canopy: no clear arc, land 9 / 4 m off
      HQ->Dock bridge  runs UNDER the dock deck in his scene -- she rides up to it and is turned back
      ramp_SK_Bowl     the node has NO MESH: the bowl island has no bowl in its collider, only the deck at 4
      SK_Bridge_T*     a tower's box top is 42 against a roof at 41.02 in the picture (a bounding box with a parapet
                       or antenna in it); SK_Dock_Deck's yaw-only box covers corners the deck does not have
  `tools/export.mjs` sets `rg.world` 0: the export is of the world this file builds.

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
- **r62 MADE THE STICKS VANISH, AND IT WAS ONE CSS CLASS NAME (fixed r63).** *"They turned invisible, then show up when
  you make swipes, but higher up -- I didn't ask you to change anything."* He did not, and it was not a setting: the
  score popups were styled with a GLOBAL `.pop { animation: popup ... forwards }`, and `.pop` is also the class a stick
  pad is given for a moment whenever a gesture fires (`.pad.pop .ring`, the little ring pulse). So every tap or flick
  ran the popup's rise-and-fade ON THE STICK and left it at opacity 0, 30 px up. The popups are `#pops .tpop` now.
  **`npm run check:syntax` FAILS A BARE CLASS RULE THAT SHARES A NAME WITH A STATE CLASS** (one used as `.a.b`
  anywhere in the stylesheet) -- verified by putting `.pop{` back: it fails. No harness here renders the HUD, so a
  source-shape check is the only gate that can see this class of fault.
- **TRICK POINTS (r62, `SCORE`, `trick`, `scoreStep`, `scoreBank`, `#score`, `#pops`).** *"Every time you do a trick ...
  +15 +10 +25 +100, flips, air tricks, grabs, spins, grinds."* THPS's shape: every trick in one line goes into a COMBO
  (shown beside the star total as it builds), BANKED times the number of tricks in it (cap `multMax`) once she has been
  on the ground `bankAfter` s, LOST on a bail or a respawn. Popups float up the middle of the screen; held grabs and
  grinds add quietly per tick. Sources, each one line at the place the event already happens: spins (scored at
  landing / rail catch, nearest 180 with `spinSlack`), flips (when they are far enough round), grabs (start + held),
  grinds (catch, held, `RAIL LINK` on every junction taken, SWITCH, grind tricks), air and ground strikes (named per
  clip), TRANSFER, DIVE, BIG AIR. **THE VERT AIR'S AUTO 180 IS TAKEN OUT OF THE SPIN COUNT** where it is applied (and
  put back where `vertRelease` undoes it) -- the game turned her, not the thumb. `npm run sim score`.
  **GRIND TRICKS WERE ALREADY THERE (r46) -- ON THE LEFT PAD'S FLICK.** He remembered asking and could not find them;
  the right pad's swipe on a rail did nothing but the transfer (up). Right-pad left/right/down on a rail pick grind
  tricks now too, up stays the transfer.
- **THE SETTLE DIVES NOW, AND THE PLAIN PUNCH IS OUT OF THE CHAIN (r61, `AIR.slam*`, `p.slamN`, `p.slamS`).**
  *"It slows you way down -- you transfer into the bowl but you're not going very fast. I want it to give you speed, like
  you just hit some velocity down the ramp."* Over a ramp, the held-down settle turns her velocity DOWN THE FACE (the fall
  line, tipped `slamIn` into it), at least `slamMin` 12 m/s and gaining `slamAdd` a second while held, up to `slamMax`.
  **STEERING THE AIR VELOCITY WAS NOT ENOUGH ON ITS OWN**: from any height a dive meets the flatter bottom of the curve
  nearly square and the landing projection threw the speed away (18 m/s in, 6.9 out). So the dive's speed is handed
  over on touchdown (`slamKeep` .85, along the way she rolls). `npm run sim feel`: 4 m/s over the half pipe -> 15.8 on
  the ramp; ollie off the flat over the bowl rim and hold down -> in the bowl at 15.1; `slam` 0 is the old brake.
  **THE PUNCH**: *"one of my melees is just a punch ... I like the acrobatic stuff."* Measured by posing Zap's rig through
  every strike (head over hips, how far the body turns, how far hands and feet travel): `melee_02` goes fully upside
  down (the handspring), `melee_05` nearly (the flip), `melee_04` half way; `melee_01` and `melee_03` stay upright but
  use the whole body (a deep lean, a 175 deg spin); **`melee_extra` is the punch -- one second, the feet never move, no
  flip** -- and is dropped from `MELEE.fist`. It stays in `melee_zap.glb`.
- **`npm run export` WRITES THE WORLD AS A GLB FOR BLENDER (r60, `tools/export.mjs`, `docs/BLENDER_EXPORT.md`).**
  *"Is there any way to get this scene into a Blender file?"* It boots the real module headless (the sim's page),
  lets `init()` build every district and writes `exports/rollergirl_world.glb` (the picture -- one object per chunk,
  grouped by district, generated textures embedded as PNG, rails as EDGE polylines with extras, every spot / water zone
  / launcher / lane / trampoline / hydrant / gem as a named marker with extras) and `exports/rollergirl_collision.glb`
  (`deck_<district>` floors and every solid as a `bld_` box, the handoff's naming). Uncompressed, metres, ~1.6 s.
  `exports/` is gitignored -- regenerate, never commit. **Its own minimal glTF writer** (no gltf-transform in this
  repo); checked by parsing both files back through the vendored `GLTFLoader` and rendering them.
  **A PLANET GROUP'S SPHERES ARE UNNAMED**, so the skip test walks the ancestors; and a ring of far towers has its
  centre at the world's middle, so district is decided by size first (radius > 250 is `backdrop`).
- **THE RAIL NETWORK (r59, `RAILNET`, `railLink`, `railWeave`, `railPick`, `railExit`).** *"It would be really cool if the
  railings attached to each other so they looped around -- you just continue grinding down the stairs and then along the
  railing along the water ... make the grind rail system way more complex."* Built once, after every rail is in:
      JOINS     a path END within `linkR` (0.75 m) of another path is joined to it -- end to end she runs straight on
                (a join may FLIP the direction she runs the next segment in, so `stepGrind` carries `G.dir` across);
                end to the MIDDLE of another path is a T, and she carries on whichever way is straighter
      BRANCHES  the other half of a T: riding the long rail past where another leaves, she takes it only if the LEFT
                STICK points down it by `brMargin` more than straight on. With no stick, never.
      WEAVE     a railing that stops within `weaveR` (3.6 m) of another, pointing at it, gets a CONNECTOR: a curved
                orange rail (a quarter circle onto it when it meets it square -- a Y onto BOTH ways, the stick picks;
                a longer S when it meets it at a slant). Only between `weaveNames` paths (slice/hub/sky) and only
                where nothing solid is in the way. The gallery stairs onto the south quay's water rail is his spot.
  `npm run sim network` lists every join, branch and connector and rides a grind through each connector.
  **A HARNESS THAT STEERS WHILE GRINDING NOW STEERS THE GRIND.** The slice's `ride()` pointed the stick at its route
  the whole time, and on a rail that is a junction choice: "down the gallery stairs" grinded the stair rail, the
  connector, and then -- stick pointing back at the stairs -- branched up the OTHER stair rail. `ride()` lets go of
  the stick while grinding, which is what a player steering on foot does.
- **THE SKYWAY (r59, `SKYW`, `hubSky`, `skyRails`).** *"More upper levels, like floating buildings you can get up to."*
  Three floating islands over the hub (12, 17 and 24 m), every one ringed by a closed grind rail and reached by rail:
  `sky up` (a booster off a low flat start by the plinth), `sky bridge` (island 1 -> 2), `sky span` (2 -> the spire),
  and three ways down: `sky helix` (off the spire, 1.75 turns to the plaza), `sky drop` (island 1 -> the skate shop
  roof), `sky chute` (island 2 -> the pavilion roof). Arriving on a ring she goes round it; the stick takes the next
  leg. Island tops are floors. A noodle bar on 1, palms on 2, a neon spire on 3. ➤ stops: skyway, skyway spire.
  **THE ORBITAL DISTRICT ALREADY OWNS `CITY.spots.sky`**, and the first version overwrote it -- which sent Orbital's
  runway test 354 m off course. Spot names are one namespace across every district.
  **`npm run sim inside` MEASURES ONLY SURFACES WITHIN 2 m OVER HER FEET NOW**: it took the HIGHEST floor at her
  x,z, so skating under a floating island read as 15.8 m inside the concrete.
- **THE HUB IS DRESSED (r58, `HUB`, `hubDress`).** *"A texture and detail pass, or more objects, buildings, park
  features."* The park she spawns in was a bare lavender floor with eight ramps on it -- every district since was built
  somewhere else. `hubDress` (called from `buildSlice`, so it shares the slice's buckets, textures, chunking and rail
  queue -- **turn the slice off and the hub goes bare with it**) adds, all on ground probed empty first:
      THE DECK      NW against the north bank, 2.4 m: a bank up the front, a stair set with a rail down each side, a
                    bank off the east end, a grind ledge on top, a railing that grinds, the BLADES skate shop and a
                    mural block behind it, vending machines, palms, lamps
      THE LEDGES    SE: a manual pad (0.36 m -- a kerb she rolls up), a 0.62 m ledge with steel on both edges (a wall),
                    a pyramid with a down rail on its north face, a flat bar
      THE GAP       SW: a kicker, a flower bed, a landing deck and a bank -- 13 m/s clears it, 10 m/s + a pop at the
                    lip clears it, 5 m/s rolls back
      THE PLINTH    a round 0.38 m dais (a kerb) with a steel coping that is a closed grind ring, a neon pylon (solid)
      also          a shade pavilion with festoon bulbs (roof is a floor you can land on, she rolls under it), a tree
                    island, lamps and palms round the plaza edge and the bowl, floor graffiti
  **KEPT CLEAR ON PURPOSE: the x = 60 strip, the z = 0 / x = 0 corridors and the gate runs**, because `npm run sim`
  skates down them. A bench at the bowl's north rim deflected the `inside` case's bowl-rim run into a 1.37 m dip
  through the bowl's edge; moving the bench was the fix, but **that dip is a pre-existing weakness of the bowl's
  rim at an odd entry angle** and is worth a look of its own.
  **A RAIL ALONG A BOX'S TOP EDGE SITS 0.11 m OUTSIDE IT**, or `npm run sim city`'s "nothing placed inside anything"
  reads it as buried in the box. `npm run sim hub` rides every piece. ➤ stops: hub deck, hub ledges, hub plinth, hub gap.
- **THE TRANSFER IS A SWIPE UP ON THE WALL'S FACE, AND THE MELEE IS THE BOOST (r57, corrects r56; `MELEE.boost`,
  `p.xferArm`, `VERT.faceArm`).** r56 made every ground swipe up a boost that ARMED the transfer from the flat. Wrong
  twice: *"I still wanted the melee to happen -- I just meant the melee shoots you forward"*, and *"it only makes you
  transfer if you literally swipe as you're going off the jump, instead of the ollie -- very intentional. I don't want to
  gain speed with a melee on the ground and then launch off the end if I didn't mean to."* So:
      on the flat, any direction   a melee strike, and every GROUND strike adds `MELEE.boost` (2.5 m/s) along her
                                   travel (along the flick if she is still), never past `boostCap`
      up, on a steep face          (`n.y < MELEE.xferN`) the transfer, ARMED for `faceArm` (0.6 s) and fired when she
                                   leaves the lip NATURALLY (`leaveGround` with `xfer` undefined; a tap's pop passes
                                   false). Armed rather than popped at once because a pop mid-face just hops her back
                                   onto the wall. Back on the flat (`n.y > 0.97`) it is cleared; every leave clears it.
      in the coyote moment / rail  still the immediate transfer (`jump` 2)
      in the air                   a strike; r51's air-flick transfer is off (`VERT.airFlickXfer`, a new key)
  `npm run sim vertair`: a strike on the run-in still comes back into the pipe; the wall swipe lands on the deck forward;
  a sideways strike at 8 m/s takes her forward speed to 10.4. **The harness sets `girl.ready` false around strikes** --
  headless, `melOk` refuses every clip once an earlier case has marked her ready, and the row then measured nothing.
- **THE SETTLE ONLY HAPPENS OVER A RAMP (r56, `AIR.settleRamp`, `settleN`, `p.settleLatch`).** *"If you're not over a ramp
  it just slows you down in the air -- I only want it if you're about to transfer into vert."* The right pad held DOWN
  in the air settles only when the face straight below (`groundAt`) is steeper than `settleN`; over flat ground it is
  the down grab and her momentum is untouched. Once it starts over a ramp it LATCHES while the thumb stays down -- a vert
  face is a fraction of a second of flight wide, and she would otherwise get her speed back the moment she drifted past
  it. Key F settles anywhere. (r55's `settlePad` row is gone.)
- **IN THE AIR THE LEFT STICK IS A HEADING NOW (r55, `AIR.aim`, `aimRate`/`aimK`/`aimArm`/`aimFresh`/`aimSteady`).**
  *"She points in whatever direction the stick is turned, so you can rotate your thumb round in a circle to rotate
  her."* The stick is read through the camera exactly as on the ground (`stickWorld`) and she turns onto it at up to
  `aimRate` 14 rad/s -- a thumb circling the pad once a second is a 416 deg spin in an ordinary air. It TAKES OVER only
  once the thumb has moved `aimArm` from where it was at takeoff, or was pushed less than `aimFresh` before it:
  **a thumb still held forward from the run-up up a pipe would otherwise pin her nose and cancel the vert air's auto
  180** (`npm run sim stance` has both: the auto-turn lands forward, pointing her out of the pipe lands fakie). Until
  it takes over the run-up's thumb carries her as before; after, the push is along where she points, faded out while
  the thumb is circling (`aimSteady`), so a spin is not also a shove round in a circle. Taking over cancels the auto
  180. `AIR.aim` 0 on the panel is r26's spin rate. `npm run sim airctl` tables both modes.
- **THE GRABS WORK (r55, `grabStep`, `MOVES.grabMin`/`grabPush`).** *"The grabs don't really work."* Two faults. The
  direction was picked ONCE at `grabAt` (0.3 s) after the press -- and the stick FLOATS, so the thumb lands as the
  centre and had often not moved yet: every grab was the centre one and pushing over afterwards changed nothing. And
  held DOWN was the settle. Now a thumb pushed past `grabPush` grabs after `grabMin` (0.12 s), the centre one still
  waits `grabAt`, the grab FOLLOWS the thumb (with a little hysteresis), down is the swan grab, and the settle is key F
  or `AIR.settlePad` 1 on the panel. **And the right pad no longer orbits the camera in the air** -- held sideways
  for a grab it was swinging the lens round her for the whole flight. `npm run sim r42` drives all of it.
- **THE DETAIL PASS IS A SHADER ON EVERY VERTEX-COLOURED WORLD MATERIAL (r55, `DETAIL`, `detailPatch`, `detailTex`).**
  The park, the city's stand-in boxes, Orbital and Neon Shores had no UVs and no material ids, so the slice's generated
  textures go on in the fragment shader, projected in world metres: PAVING on flat floors (`paveT` 5 m, so a slab is
  1.25 m and the tiles line up with the park's 5 m cells), CONCRETE on ramps, PLASTER on walls (triplanar on x/z), each
  with its normal map. The texture is applied as LUMINANCE over its own mean (`texMeanLum`), so vertex colours keep
  their hue. Four colour and four normal fetches a fragment; `DETAIL.k` / `nrm` on the panel. The slice reuses the same
  three textures (`DT.p/f/w`), so they are generated and held once.
- **THE BANK'S END WALLS AT EVERY GATE ARE SOLID (r55, tag `bank end`).** A ramp is a floor, not a solid, and there is
  no floor UNDER a bank -- so riding into a bank's end from a gate corridor took her inside it and she fell out of the
  world. `npm run sim solid`'s random runs found it once the air steering changed their paths. 1 m boxes inside each
  end, each topped just under the surface above it (the back slope is one 14 m segment, so it is cut into pieces or its
  low end sits at zero and is skipped).
- **THE NEXUS: THE ARRIVAL IS A SUNK BOWL IN A TERRACED PLAZA (r54, `NEX`, `sliceNexus`, `slSunkBowl`, `slRound`).**
  *"More layering in the foreground ... a sunken bowl / terraced plaza like the second painting."* The start view
  looked across 20 m of flat paving. The entry ramp moved down into the gate's own corridor (x -79 -> -93, under a
  NEXUS gateway) and the head of the canal is a plaza at quay height with: a BOWL sunk into it (rim at Q, floor
  0.4 -- the street at 0 is the only floor below it, so 2.6 m is as deep as it goes), a teal tile band and a steel
  coping that is a CLOSED grind loop (`SLC.railC`, named `slice bowl`); six TERRACES of 0.4 m off its north side
  (under `SK.step` 0.42, so every step is a kerb she rolls up -- each tier is a full-height column in the collider so
  the side walls stand), a bank up their east end, a grind ledge on the top nose and a hubba down the middle; a
  stepped FOUNTAIN terrace (three 0.35 m rings, a basin, an orb, arcs of slime) off its south side. The spawn
  (`slice`) is at the bowl's east lip facing down the canal. The mural wall is SOLID now and runs to x -91: without
  it a ride up the bank launched off its top and out over the back of the platform.
  **A TAP AT THE BOWL'S LIP GRINDS THE COPING** -- r41's homing finds the coping rail, which is what a tap there
  should do. A plain air comes back in (vert lock, the wall is 78 deg at the top); a swipe goes out, onto the
  terraces. `npm run sim slice` rides all of it: spawn into the bowl, the air, the coping, the swipe, up the
  terraces kerb by kerb, up the bank, the hubba, the fountain rings.
  **THE SLICE IS CHUNKED BY POSITION** (`SLC.chunk` 48 m, buckets over `chunkMin` 2400 triangles): one mesh per
  material spanned the whole street, so its bounding sphere was always on screen and culling never dropped any of it.
  **AND ITS GLOW CARDS ARE ONE `Points` DRAW** (sized in world metres through `uK`, fogged by alpha) instead of a
  Sprite each -- about ninety draw calls, more than the rest of the street. 76 slice draws (was ~180), 89k triangles.
- **THE SLICE IN LAYERS (r53, `slDeck`, `slBastion`, `slStairs`, `sliceLayers`).** *"One raised level leads to a ramp
  that goes up to another level, kind of cock-eyed, that goes to a bridge -- very organic, layers upon layers."* Every new
  level is ONE generator, `slDeck`: a Catmull-Rom centreline with a width, parapet walls (solid, per-segment rotated
  `solidAdd`s so a curved ramp keeps her on it) or edge railings, LED strips under the rails, piers or a solid skirt,
  stickers on the parapets, ivy off the edges, lamps. Its rails are QUEUED (`SLC.railQ`) and registered in
  `sliceRails`, after the collider. The street is now a loop of levels:
      quay 3 -> curving ramp R1 -> the BASTION (a round tower top at 6, openings where decks cross its rim)
      terrace 9 -> pier ramp R2 out over the quay -> the bastion
      bastion -> the CROOKED BRIDGE skewed across the canal -> the GALLERY at 7.5 on piers along the south
        facades, bulging round the NIMBUS drum -> ramping back down to the quay (and stairs off it mid-way)
      terrace -> the VIADUCT climbing over the far quay, across the canal at 15 m, onto the west block's roof (14),
        banners hanging off it -> a down rail from the roof to the quay
      canal head -> a ramp down to the TOWPATH at 1.5 m along the foot of the south wall, boats moored on it
      a curved concrete LEDGE in the head plaza, its edge a grind
  plus pink and violet palms (`slPalm`, frond texture), glowing mushrooms (`slShroom`). `npm run sim slice` rides every
  one of those links from where you would actually start, through the shipped step, and checks there was no splash on
  the way. **A deck mouth on the edge of a platform has to start BACK from the edge, straight**: the first pier ramp
  started at the terrace's lip and a rider coming at it diagonally cut the corner, went past the parapet's end and fell
  6 m. **The bastion's openings are measured where each deck CROSSES THE RIM, plus its half width** -- typed from the
  deck's end point, the R2 opening was 0.04 rad from a merlon and she stopped dead against it.
- **THE SLICE: ONE STREET OF HIS PAINTING BUILT TO A LOOK, AS A TEST OF WHETHER CODE CAN GET THERE (r52, `SLC`,
  `buildSlice`, `sliceRails`, `sliceMeshes`).** *"Why don't you build the slice -- I just wanted to compare it, to see if
  it even makes sense to go the Blender route."* West of the park through a FOURTH gate (`perimeter` gates all four
  edges now): an entry ramp up onto a canal quay, a grand stair and a skate ramp side by side up to a terrace (a
  concave bank along the mural wall to carve), the SKATE FURTHER TOGETHER cat wall, a glowing canal, a stone arch
  bridge with orange rails, shopfronts with awnings and neon, the NIMBUS drum with the alien mural, a slime pipe
  pouring into the canal, festoon lights, boats, a tunnel at the far end under FLOW THROUGH TOGETHER. ➤ stops `slice`,
  `slice bridge`, `slice terrace` are first in the list. Self-contained: delete the block and its four call sites and
  it is gone.
  **WHAT MAKES IT LOOK DIFFERENT, ALL TECHNIQUE AND NO FILES:** materials generated into typed arrays at load
  (sandstone ashlar, canal masonry, paving, concrete, plaster, wood, leaves, windows) each with a NORMAL MAP from its own
  height field (`slTexOut`); UVs projected in WORLD METRES (`slTri`) so texel density is constant; CHAMFERED boxes
  (`slBox`, the bevel is what catches light on an edge); an `aH` attribute (height above the surface the face stands on)
  that darkens every wall into its floor per FRAGMENT (`slAO`) -- contact AO with no extra pass; a water SHADER (two
  scrolling normal layers + a fine one, fresnel to the sky, sun glint, caustics, foam at the walls); additive glow
  cards on lamps and neon so they read as lit in daylight with no bloom pass. ~80k triangles (r53, after cutting tube and trim detail) in ~87 meshes; the textures
  and meshes take ~0.55 s in node, so expect 1-2 s more load on a phone.
  **IT STILL PLAYS THROUGH THE EXISTING MACHINERY:** quays/terrace/buildings are `solidAdd` boxes, the ramps, stairs (a
  slope under the step noses) and bridge deck are collider triangles, the railings are `railPath`s, the canal is an
  `ORB.water` rect with `draw: false` (orbMeshes skips it; the slice draws its own shader water). `npm run sim slice`:
  the gate, ramp and stairs to the terrace, the bridge, a splash and put back, taps onto the quay and stair rails.
  **WINDOWS SIT IN FRONT OF THE WALL, NEVER BEHIND IT.** The first pass recessed the glass 6 cm into a wall with no hole
  in it, so every window in the street was inside the plaster and the facades read as blank. **And a chamfer on a face
  you skipped leaves a slot**: skipping a box's face also skips its edge strips, so two bevelled platforms butted
  together showed the park floor through an 8 cm groove (a rainbow line across the plaza). Platforms that butt are
  `bev: 0`. **ExtrudeGeometry's bevel grows the caps outward** too, so anything placed flush on an extruded face needs
  the bevel thickness added or it is behind it. **A basis matrix with determinant -1 mirrors the winding** and every
  face of the bridge points inward -- extrude toward -x with a right-handed basis.
  **`npm run shot` (tools/shot.mjs + tools/shots.json) RENDERS THE REAL PAGE IN HEADLESS CHROMIUM (swiftshader)** -- a
  spot to stand her at and an optional fixed lens (`window.__shotCam`, one line before `renderer.render`). ~40 s for a
  handful. It exists because art cannot be made blind: every fix above was found by LOOKING. For art passes only, and
  only when he has asked for one; `shots/` is not committed.
- **THE TRANSFER IS A FLICK UP AGAIN, AND THE HOLD IS THE GRAB AGAIN (r51, `VERT.flickXfer`, `rightFlick`).** *"I'm
  intuitively going off it and flicking forward instead of just jumping up ... which means we can restore the hold up
  on the right stick in the air to do some grab."* During a LOCKED vert air the right pad's FLICK UP calls
  `vertRelease(true)` -- the auto-turn is taken back, the outward kick fires once she is above the lip she left (so a
  late flick on the way down still works), she lands forward on the deck. The flick before she leaves (on the wall,
  or the coyote moment off the lip) was already the transfer (`p.jump` 2) and is unchanged. A HOLD up is the 'up'
  grab again. r47's hold transfer survives as `VERT.holdXferOn` (off) -- **renamed, not just defaulted**, because the
  panel saves every row and a phone that saved the old `holdXfer` 1 would have kept it for ever. Any other air flick
  in a locked air is still a melee strike, and its `airLunge` now has its outward part removed the way the thrust's
  is (with the flick transfer off, a flick up was a strike that lunged her out onto the deck anyway).
  `npm run sim vertair`: flick -> deck, forward; switch off -> back in; hold -> grab, back in; old hold on -> deck.
- **NEON SHORES: THE SECOND DISTRICT, FROM HIS TOP-DOWN MAP (r50, `SH`, `buildShores`, `shPlateau`).** *"Just a random
  generated top-down view -- use it as a framework ... this could operate next to the thing we already have, we could
  build multiple sections."* EAST of the park through a new gate in the east bank (`perimeter` now gates edges 0, 1 and
  2 -- the pieces offset along the edge itself, x for north/south and z for east), up a walled CAUSEWAY over a glowing
  LAGOON onto a raised plateau at 8 m, laid out as his map is, map-north to world-north:
      NOVA PLAZA      a dish ringed by a BERM you carve round (four street gaps), the alien globe on a rideable plinth
                      with a ring rail round its base
      NEON ALLEY      two rows of shops and neon either side of a street with a high rail down it; the inner row's
                      roofs at 18 m are a ROOF RUN, bridged over the cross streets, reached by a LAUNCHER, and carrying
                      straight on into the ROOF LINK up to the transit deck
      ORBITAL TRANSIT the tower; a SPIRAL ROAD (one turn, boost lane, outer wall) up to a RING DECK at 24 m
      THE SPIRE       up the walled elevated TRACK from the deck to a floating island at 36 m with the alien on it --
                      the district's high point (`SH.peak`, THE SPIRE! toast) -- and the SECRET ROUTE: a 100 m rail
                      down onto the market roof
      SKY GARDENS     two floating groves of pink trees: a launcher up from the plateau's corner, a boost ramp between
                      them, a booster rail from the high one back to the deck
      ORBITAL MARKET  two halls, a skyway onto their roofs, a bridge between them, a parapet to stop the secret route's
                      landing, stalls on the street
      CANAL DISTRICT  canals CUT into the plateau (`SH.canals`, water at 5 m), five bridges (`shBridge`, the Orbital
                      bridge made general), a lighthouse island with a launcher to its top and a rail down to the
                      Overflow, boats, the canal spilling off the edge into the lagoon as two waterfalls
      THE OVERFLOW    tanks, two pipe rails on racks, a launcher up to a catwalk at 20 m
      GRAVITY BOWLS   three raised bowls on the plateau (`obBowl` takes a base height now) and a SNAKE RUN: a U-channel
                      (`shSweep`, a ribbon with any cross-section) winding 12 m down from the catwalk into them
  **THE LAGOON IS THE EDGE** -- off the plateau anywhere is water, and water puts her back where she stood. **The safe
  spot is now generic**: one with floor at her height 2 m out in all four directions, so it is never a brink.
  **THE PLATEAU IS A GRID OF 5 m CELLS** (`shSolid`): canals are cells left out, corners are rounded off, the solids
  are the rest merged into rectangles, tops tiled by ZONE (`shTile`), and every exposed side drawn as a CLIFF to the
  lagoon or a masonry wall to a canal -- the coastline, the canal walls and the collider come from one map.
  **LAUNCHERS** (`ORB.launch`, `shPad`, the map's "lift / launcher"): stand on one and it SOLVES the throw onto its
  target. **The launch caps her air drift** (`p.drift = AIR.driftMax`): the sim's first Overflow launch, with the thumb
  held forward as a player holds it, overshot the catwalk by 29 m into the lagoon.
  **A LANE IS A CONVEYOR, NOT A RUNWAY (`lane.gov`)**: on the transit spiral she pushed on top of the lane to 23 m/s
  round a 19.5 m radius, hopped off the creases (a helix's quads are twisted -- its inner edge is steeper than its
  outer) and slid out of the bend. A governed lane bleeds anything over `v + gov`; the spiral, the track and the Nimbus
  helix are governed. Ribbons are also cut into six strips across now, which halves every crease.
  **A GAP IN A SPIRAL'S WALL IS A DOOR SHE SLIDES OUT OF AT SPEED.** The roof run first merged onto the spiral through
  a gap, and the street-to-deck ride left by it every time. It goes to the deck over the spiral instead, and the
  spiral is sealed. **And a mouth on a roof's flank is a corner she flies past** -- the link starts ON the roof, in
  line with the run, walled.
  `npm run sim shores`: twenty routes, every one through the shipped step -- the gate and causeway, the lagoon and a
  canal and back, a bridge, the berm and the ring rail, the alley launcher, the roof run to the deck, the spiral from
  the street, the track to THE SPIRE, the secret route, the gardens up and back, the lighthouse and its rail, the
  Overflow launcher, the snake run end to end, the big bowl, the market skyway.
  The ➤ key's first stops are Neon Shores: shores, alley, nova, transit, transit deck, spire, gardens, canals, overflow,
  bowls. Both districts together: 172k triangles in 70 meshes, chunked; the sign atlas is 2048x2176 (about 24 MB on
  the GPU with mips) -- **if a phone reloads in the city, the atlas and the kit textures are the first suspects.**
- **ORBITAL: THE DISTRICT FROM HIS CONCEPT PAINTINGS (r49, `ORB`, `buildOrbital`, `orbitalRails`, `orbMeshes`,
  `stepOrbital`).** *"I'm just gonna give you these concept images ... first and foremost a giant skate park world ...
  jump from one building to another, but don't fall between the buildings ... get up to the highest peak ... loop grind
  rails ... an open world."* South of the park through a NEW GATE in the south bank (`perimeter`, edges 0 and 2), one
  connected line from the street to a floating island 60 m up, all of it measured in `npm run sim orbital`:
      THE CANAL QUARTER  quays at 4 m (`ORB.nq`/`sq`) either side of a glowing slime canal (`ORB.canal`, water 1.4 m),
                         grand stairs + bank + a curved launch up from the gate, three humped ARCH bridges with orange
                         rails down both edges, the ORBITAL COMMONS gate, slime pipes pouring into the water, a fat
                         glowing pipe arching over the canal whose top is a booster rail, canal-side rails on both quays
      NEXUS PLAZA        stairs down, the statue on a rideable plinth with the HALO (a closed booster ring round the two
                         figures, its low side over the plinth's ramp, `ORB.halo`), two RAISED bowls with the alien
                         painted on the floor, SIX MUSHROOMS that are trampolines (`ORB.bounceV`), the fountain terrace
                         (SOL TOGETHER), Nexus Hall, palms (some pink), planters, banners, a booster vertical loop
      THE ROOFTOP RUN    `ORB.roofs`: 8 -> 10.5 -> 13 -> 15.5 m, a skyway up from the south quay, a boost lane and a lip
                         to each edge; 8-10 m alleys between them are the "don't fall". The last roof is the station.
      THE MONORAIL       a closed rounded-rectangle BEAM round the plaza at 17 m (`ORB.mono`), and the beam top is a
                         booster grind rail -- with a TRAIN running on it that knocks you off (`stepOrbital`). Reached
                         from the station roof or from two mushrooms under it.
      NIMBUS             the mural tower (`ORB.tower`, 36 m): a boost-lane HELIX three times round it to the roof, a
                         barrier up its outer edge (solid, with a booster rail on top), an end wall at the top; plus a
                         rail off the Market's roof onto the helix
      THE SKY            a booster rail off Nimbus's roof to island 1 (44 m), a runway (boost lane to 24 m/s) and a
                         kicker across a 16 m gap to island 2, a spiral rail round its crystal spire to island 3 -- THE
                         PEAK (60 m), with a turning crown and a pillar of light you can see from the whole city. Each
                         island has a RIM on its far side so a fast landing bonks rather than falls.
  **THE WATER IS THE "DON'T FALL".** `ORB.water` rects with `splash`: under the surface she is put back where she last
  stood (`ORB.safe`, saved every `safeEvery` s while grounded -- but never within 1.5 m of the canal's edge), with a
  splash and a SPLASH! toast. Falling between roofs is not punished beyond the climb back.
  **EVERYTHING IS A FLOOR, A WALL OR A RAIL THE PHYSICS ALREADY HAD.** Nothing needed new collision: slabs and blocks are
  `solidAdd` boxes (tops are floors), a round tower or plinth is a RING of boxes (`cylSolid`) with a disc on top, stairs
  are a SLOPE in the collider with the steps drawn on it (rolling up steps on blades would be a stammer), a ribbon
  (`obRibbon`, the helix, the skyways) is triangles, a bowl is built UP (`obBowl`) because the city floor is one plane.
  **A RING OF BOXES NEEDS FLOOR TOPS or a ramp onto it meets a 10 cm lip it cannot climb**: a lidless box has no
  `SK.step` allowance, and the plinth's bank arrived 9 cm under the box top. `cylSolid` boxes are floors now.
  **NEW GENERATORS, ALL INTO BUFFERS (`OB`)**: `obQuad` takes the direction a face should LOOK and fixes the winding
  itself (the bug the park's skirts and corners each cost a round over), `obGeo` bakes any three.js geometry flat into a
  buffer (palms, pylons, statues, spires are one draw call with their buffer), `obRev`/`obExtrude`/`obRibbon`/`obStairs`/
  `obBlock`/`obSlab`/`obBowl`/`obShroom`/`obIsland`. The lit buffer is CHUNKED by position (`ORB.chunk`, 96 m) so what
  is behind the camera is culled in both passes. **93k triangles, ~40 draw calls** for the whole district.
  **EVERY SIGN, MURAL AND TAG IS PAINTED ON ONE CANVAS AT LOAD (`SIGNS`, `orbAtlas`)** -- neon as a blurred glow under a
  white core, graffiti as a fat outline under a hot fill, the aliens, the cat, the bunny and the crown from a few curves.
  One texture (2048x1728), one material, one draw call, no files. Add a sign = one entry in `SIGNS` + an `obSign`.
  `obWrap` wraps one round a cylinder: **seen from OUTSIDE a growing angle runs to the viewer's LEFT**, so the u runs
  the other way round or the mural reads mirrored.
  **THE FAR CITY** (`obBackdrop`): 84 towers, mushroom towers and ring stations on a ring 400-550 m out, plus two arcs
  of elevated road, in a LAMBERT material whose fog is CAPPED (`fogCap`, one line in the fog chunk) -- past the fog's far
  plane by design, fully fogged it would be a wall of fog colour. The ringed PLANET rides with the camera at 600 m (so
  it is at the same infinite distance from anywhere, and inside the far plane); a space whale and a flight of craft
  circle the district; the stand-in sky dome draws first (`renderOrder` -100) so nothing is ever behind it.
  **RAILS ARE MERGED BY MATERIAL** (`railDraw`'s `into`): thirty paths are four draw calls. `o.mat` picks
  'orange' (the paintings' handrails), 'boost' or 'bar'. **A CLOSED PATH** links its last segment to its first
  (`spec.closed`) -- the halo and the monorail -- and `stepGrind`'s walk across joints needed nothing.
  **ON A RAIL THE DIRECTION IS HER HEADING AT THE TAP**: `npm run sim orbital`'s sky-rail row first faced away from
  the island and duly rode the 2 m back to the rail's start. A player faces where they are going.
  `npm run sim orbital`: the gate, the stairs, a bridge, the canal (and back), the plaza stairs, a mushroom (17.5 m),
  the helix to the roof (15 s), the sky rail, the island gap with no pop, the spire to the PEAK, all three rooftop gaps
  with a tap, the monorail from the station and the train knocking her off, the halo from the plinth, a bowl, a lane.
  The ➤ key's first stops are the new district: gate, canal, nexus, rooftops, nimbus, nimbus top, sky, peak.
  **NOT YET**: no interiors, no destructible anything here, the water is a flat scrolling texture, and the look of all
  of it is unverified by any harness -- there is no GPU here. It is placeholder art for his own asset packs.
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
