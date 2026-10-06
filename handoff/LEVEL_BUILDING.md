# Rollergirl level building: the brief for the Blender session (r83)

This brief is for a Claude session that builds Rollergirl levels in Blender (over MCP).

**Rollergirl** is a mobile rollerblading game: one Three.js file (`index.html`) in `colinwillow/rollergirl`. The game reads
a level from two GLB files and decides what each object is **by its name**. So a level that follows the names below
works with **no code written on the game side**: no guessing, and no rebuild.

The game session tests every level before it ships. It loads the level headless, drives her over it through the real
physics, and reports anything that does not work.

## The files in this package

| file | what it is |
|---|---|
| `handoff/LEVEL_BUILDING.md` | **this brief.** Start here. |
| `handoff/rollergirl_blender.py` | Blender helpers. They write the names and properties below for you: `rail()`, `lane()`, `spawn()`, `spot()`, `launcher()`, `trampoline()`, `gem()`, `water()`, `floor()`, `box()`, `box_new()`, `kit()`, `piece_local()`, `check()`, `export_zone()`. **Not yet run inside Blender** (the game session has no Blender), so if a call errors, this brief says what its result must be. |
| `handoff/rollergirl_kit_library.glb` (+ `.json`) | **The ramp kit**: 103 tested pieces, every kind at its sizes, laid out in rows. Import it, then duplicate and place pieces. |
| `docs/RAMP_KIT.md` | Every kit piece's options, the piece frame, and how pieces snap together. |
| `docs/BLENDER_HANDOFF.md` | Art rules: materials, transparency, decals, UVs, budgets, export settings. **Still current.** Section 1's naming table is superseded by section 3 here. |
| `zones/ZONES_README.md` | Your own notes from the first zone export (`zone_skyline`). |

---

## 1. What a level is

A level is one or more **zones**. Each zone is a folder holding two files:

```
zones/zone_<name>/zone_<name>_visual.glb      the picture: draco + WebP textures
zones/zone_<name>/zone_<name>_collision.glb   what she rides, plus rails, markers and kit pieces (plain, uncompressed)
```

- **World coordinates, metres, Blender Z-up.** The glTF exporter writes +Y up, which is what the game reads.
- Every zone is placed at the origin, so zones that sit side by side in Blender line up in the game.
- **One `marker_spawn_` per level** sets where she starts. Without one she starts at the origin.
- **Falling below y = −40 m** puts her back where she last stood safely. So the space under floating islands needs no
  floor: a fall off one costs a moment, not a life. Keep everything playable above −40.
- The collision file has to load before she can drop in. The visual file streams in after.
  - Keep `col` small (tens of thousands of triangles, not hundreds of thousands).
  - Keep `vis` within the budgets in `BLENDER_HANDOFF.md` §3. That means 2–6 materials per zone, and **shared atlases**:
    texture memory is what kills a phone tab.
- Collision objects may instead sit inside the visual file if their names start with `col_` (those are never drawn).
  Two files are cleaner, though.

`export_zone(folder, 'mynewzone')` in the helper script writes both files with the right settings, from two collections:
`VISUAL` and `COLLISION`. **`export_extras=True` is essential.** Every rail, marker and kit piece is carried in custom
properties, and without extras the game sees bare empties.

## 2. How she moves (design numbers)

Gravity is 20 m/s² (a game value, not 9.81). Everything below follows from it.

| | value | what it means for a level |
|---|---|---|
| her height / body | 1.6 m tall, collider 1.7 m | an overhang she should roll under starts above ~2 m |
| pop (jump) | 12.5 m/s up, **on top of** her own velocity | **flat-ground apex ≈ 3.9 m**, 1.25 s of air |
| top pushing speed | ~24 m/s | a boost adds +8 m/s (cap 36) for a launch |
| distance of a flat jump | 1.25 s × speed | 10 m/s → 12 m, 18 m/s → 22 m, 24 m/s → 30 m |
| kerb | a step under **0.42 m** she rolls straight up | taller than that is a wall, or a ledge to grind |
| floors | any face within **88°** of flat is ridden | quarter pipes, banks, domes and walls up to near-vertical all work |
| air off vert | a QP sends her up `v²/40` m over its coping | 20 m/s up an XL (4.8 m) QP reaches a ~10 m roof (a swipe-up transfer carries her onto the deck behind) |
| air control | she turns in the air, flips, and grabs | air time is the currency: every trick wants ~1 s |

**Reaching a roof.** A plain jump tops out near 3.9 m. Anything taller needs one of these:
- a **bank or stairs** onto it (kit `bankDeck`, `stairs`, `stairBank`, or your own `ramp_`);
- a **quarter pipe** against it;
- a **launcher**;
- a **booster rail** climbing to it;
- a **trampoline**.

A level is fun when every roof has at least one way up and one way down that is a line rather than a fall.

## 3. The names the game reads (collision file)

The prefix of an object's name decides what it is. Custom properties are written as glTF *extras*, so turn
`export_extras` on.

### Surfaces and solids

| name prefix | becomes | rules |
|---|---|---|
| `deck_` `ramp_` `ground_` `road_` | **floor triangles**, ridden exactly as modelled | Faces must point **up**; down-facing faces are thrown away. Up to 88° counts as a floor. Model stairs as a smooth **slope** under the step noses. Apply transforms; **never negative scale** (a mirrored floor faces down and vanishes, so she falls through it). |
| `bld_` `solid_` `prop_` | a **solid box**: she bounces off its walls, and **its top is a floor** | Each object is reduced to the smallest box around it, **turned about Z only**. Tilt is discarded. Split L-shapes and overhangs into several boxes. A round tower becomes a square of its diameter, so use 2–3 boxes for an octagon. |
| any `bld_/solid_/prop_` with a material whose name contains **`metal`**, under 1.2 m wide | also a **grind rail** along the top of its long side | handrails, ledges, bench edges, pipes |

- **A walkway, bridge or ramp must NEVER be a `bld_` box.** A box of a sloped thing is a solid block from its lowest
  point to its highest. Your skyline export had a 21 m solid block between two islands for exactly this reason.
  Walkways are `deck_`/`ramp_` triangles. `check()` flags it.
- **No antennas, domes or spires inside a roof box.** The box grows to include them, and the roof floor ends up in the
  air. Give each its own box, or leave it out of the collider.

### Rails, lanes and markers

| name prefix | becomes | custom properties (`helper`) |
|---|---|---|
| `rail_` | **a grind rail exactly along a line**: curves, spirals, loops, anything | `grind_path_gltf`: JSON `[[x,y,z],…]` in glTF terms, FILE frame (the top of the bar). `closed`: true for a ring. `boost`: m/s for a booster (put it on anything that climbs). `gems`: a gem every N metres along it. (`rail()`, `rail_from_curve()`) |
| `lane_` (or `zone_boost_`) | **a boost lane**: a centreline on a floor. Grounded and going its way, she is pushed up to `speed`. | `path_gltf` (like a rail). `half_width` (2), `speed` (20), `accel` (14), `governed` (0; above 0 it also caps her near `speed`, which spirals need). (`lane()`) |
| `marker_spawn_<name>` | where she starts | `heading`: **degrees**, game sense. 0 faces Blender −Y, 90 faces +X. (`spawn()`) |
| `marker_spot_<name>` | a fast-travel stop (the ➤ key) | `heading`. Stand it ON a floor a few metres short of a feature. (`spot()`) |
| `marker_launcher_<name>` | a launch pad: stand on it and it throws her onto a target | `target_gltf` `[x,y,z]`, `apex` (the arc's top as a WORLD height), `radius` (2). The game raises the arc if it would hit something, and re-seats the pad on the floor under it. (`launcher()`) |
| `marker_trampoline_<name>` | **new in r83.** Land on it and she goes ~9 m up | `radius` (2). It needs a floor at its height too. (`trampoline()`) |
| `marker_gem_<name>` | **new in r83.** A collectible (◆ counter on screen) | Put it ~0.9 m over the surface. For a string of them, use `gems` on a rail. (`gem()`) |
| `zone_water_<name>` | water: falling in puts her back where she stood | A flat mesh at the surface. `hazard: "lava"` makes it lava. `splash: false` disables the put-back. (`water()`) |
| `fn_<kind>_<size>_<n>` | **a kit piece, rebuilt from its name** (§4) | the piece's options; `draw: false` |
| anything else (`guide_…`, art) | ignored | |

**Rails are invisible in the game.** The rail line is physics only, so model the tube yourself in `VISUAL`. Other rail
behaviour:
- Rail ends within 0.75 m of each other join, so she grinds straight from one onto the next.
- Where a rail's end meets the middle of another, it is a junction, and the left stick picks the way.
- A rail that turns upside down (a vertical loop) is detected and gets a booster and an upside-down body automatically.

## 4. Grinding: most of it is free

**Every edge is grindable with no rail authored.** In the air, or from the ground near an edge, a swipe down on the
right stick finds the nearest ledge and grinds it. A ledge is any edge of a floor (a `deck_` triangle or a `bld_` box
top) where the floor drops away by **0.35 m or more** just beyond it, with no wall going up there. That covers:

- **roof edges**, parapet tops, balcony edges and walkway edges;
- box and bench tops, planters, and kerbs over 0.35 m;
- every quarter pipe and bowl **coping**, and pool rims;
- the sloped sides of banks and stairs (hubbas).

**So you do not need to put rails along roofs or copings.** Two things make it work:
- **The roof must be in the collider at the height it is drawn.** If a parapet is only in the picture, she grinds the
  roof edge *inside* it. Give a parapet its own `bld_` box: its top becomes the ledge and the roof inside stays a floor.
- **Edges must be close to flat (within ~37°).** A steep rock rim is not a ledge. Give it a `rail_` line instead.

Use `rail_` lines where there is no edge:
- free-standing handrails;
- railings along walkways (one rail per railing);
- rings and loops;
- long cables between islands;
- booster rails up to places a jump cannot reach.

**Rail height:** a rail she should reach from the ground wants its top at about **3.3 m** over the floor beside it (85% of
her jump). Lower is a kerb-rail (fine on a ledge); a rail she is meant to drop onto from above can be anywhere.

## 5. Ramps: the kit, or your own

**Option A: kit pieces (recommended for anything rideable).** Each piece is tested in the headless sim (ridden end to
end, air over every coping, no cracks in the surface). Import `handoff/rollergirl_kit_library.glb`, duplicate a piece,
and place it.

On export the game **rebuilds each piece from its name**:
- **The mesh you see is never used.** Only the node's position and its turn about Z are read.
- With the custom property **`draw: false`**, it is physics only and your art is the picture. Model the ramp's look
  however you like over it.

**How kit pieces fit:**
- **Sizes are heights:** S 1.2, M 2.4, L 3.6, XL 4.8, XXL 7.2, MEGA 9.6 m. Pieces of one size meet at one deck height,
  so an M bank reaches an M platform, which reaches an M quarter pipe's deck.
- **The piece frame:**
  - origin on the ground at the middle of its front edge;
  - the rider climbs toward the piece's **local −Y in Blender** (glTF +Z);
  - local +X runs across it.
- Rail pieces and pipe modules carry `info.out`: where the next piece's origin goes, so they snap end to end.

**What is in the kit** (options: `docs/RAMP_KIT.md`):

| group | pieces |
|---|---|
| transitions | quarter pipes, inside and outside corners, half pipes, pools, bowls, free-form and square bowls |
| pipes | snap-together pipes, elbows at any angle, tees, ends, size adapters |
| slopes and decks | banks onto decks, platforms, roll-ins (big drops for speed), spines |
| jumps | kickers, launch ramps, table tops, gaps, funboxes, pyramids and hips (`frustum`) |
| loops | 360 and 180 loops |
| rails | straight, down, kinked, curved, S, rainbow, ring, helix, Y |
| obstacles | ledges, stairs with handrails, stairs with a bank, kerb terraces, rollers, berms, a bridge |
| shaped pieces | **shapes drawn as a line**: `wall` (a quarter pipe swept along any path, open or closed: a clover pool, a kidney bowl, a snake run, a curved ledge, an S-spine), `deck` (a platform of any outline), `walk` (a ribbon with a height at every point: an elevated walkway), `terrain` (a noise-deformed plane: little ups and downs), planted islands |

**Path options must be in the piece's own [u, w] frame.**
- Use `piece_local(points, loc, yaw)` to convert Blender points.
- Lists and dicts can be written as **JSON text** in a custom property (new in r83), which is the easy way from Blender.
  `kit()` in the helper does this for you.

**Option B: your own `ramp_` mesh.** Model the riding surface, normals up, and name it `ramp_`. It rides exactly as
modelled. Rules learned the hard way:

- **Any crease from a slope onto a flat is a kicker at speed.** A bank meeting a deck at a sharp edge launches her off
  it. Round the top of anything she should stay on: a few segments over a metre or two. Keep adjacent faces along a
  riding line within ~6° of each other.
- **A ramp's side walls are not collided.** Steep faces are thrown out, so she passes through a ramp side-on. To stop
  her, add a `bld_` box.
- **A transition's top must reach near-vertical** (85–88°), or every air drifts out of the pipe. 16+ segments over the
  curve.
- **Every solid under a deck needs a walkable top**, or it is a wall she stops against a body's width short of the edge.
- **No gaps between pieces.** Meeting edges must share vertices or overlap slightly. A 5 cm crack is a place her wheels
  find.

## 6. Your world (the screenshots), feature by feature

| what is in the scene | collider | notes |
|---|---|---|
| floating lavender rock islands | the **top surface** as `ground_` (or `deck_`) triangles. If she should not pass through the rock from the side or below, add `bld_` boxes inside the rock. | Falling off is fine: below −40 she is put back. Leave the waterfalls out of the collider; the pool at the bottom can be `zone_water_`. |
| tan towers | one `bld_` box per tower, or 2–3 boxes for a round one. Its **top is the roof**, with grindable edges. | Every tower she should reach needs a way up (§2). A bank or QP against the base, or a booster rail from a neighbouring roof, works well. |
| pink domes on the towers | either leave them out (the box top is a flat roof), **or** model the dome as a `deck_` mesh over the roof, which makes it rideable: a little bowl-in-reverse to carve over | A dome as a `deck_` is a great spot. Put its steepest band under ~80°. |
| winding pink walkways (ribbons) | the ribbon surface as `deck_` (flat) / `ramp_` (sloped) triangles; **one `rail_` per railing**, along the top of the rail | Smooth joints (§5). Where a walkway reaches a roof or deck, its end must meet that floor within 0.42 m. A walkway that climbs a lot can carry a `lane_` (`governed`) so she does not need to push. Kit `walk` does all of this from one line of points: `pts` as [u, w, y] (`piece_local(..., with_y=True)`), `w` its width, `rails: true` for a grind rail along both edges `hr` (1 m) up. |
| pink ring loops | a `rail_` with `closed: true` along the inside of the ring | A **vertical** ring becomes a loop automatically (booster plus upside-down body). Add `boost: 16` on any ring she should climb round. |
| the clover-shaped pool / bowl | kit `wall` with the clover outline (`closed: true`, `face: "in"`, `floor: true`), or your own `ramp_` transitions plus a floor | Its rim grinds by itself. Build a sunken pool by giving the surrounding deck a hole, or raise the pool on a deck at its size height. |
| crystal spire, palm trees, SK8 signs | art only, or a thin `prop_` box if she should hit them | Do not box a palm canopy (it would become a ceiling); box the trunk. |
| long drops between islands | `rail_` lines, booster rails, `marker_launcher_`s, or kit `rollin`s / kickers lined up across the gap | Air distance ≈ 1.25 s × speed off flat, plus whatever a ramp adds. |
| "put ramps everywhere" | kit pieces with `draw: false` under your art, or `draw: true` (white placeholder) to try a layout first | One `fn_` empty per ramp. |

**Also available, in any combination:** boost lanes on long climbs, trampolines on rooftops, gem strings along rail
lines (`gems: 6`), lava pools, fast-travel spots at every area.

## 7. Faults from the last export (`zone_skyline`, r64): avoid these

1. **Sloped pieces exported as bounding boxes.** Bridges, sky bridges, the loop track and stairs came out as
   `bld_` boxes, making solid blocks. The game guesses a fix today (`*_Deck` between two `*_RailTop` lines becomes a
   ribbon). **Export them as `deck_`/`ramp_` triangles and the guess is never needed.**
2. **`ramp_SK_Bowl` had no mesh.** The bowl island had no bowl in its collider. Every `ramp_` must carry geometry.
3. **Tower box tops taller than the drawn roof** (a parapet or antenna inside the box). See §3.
4. **Launchers aimed beside or under things.** Two pads had no clear arc to their target. Keep the straight line from
   pad to target clear, and aim the target ON a floor.
5. **A bridge ramp running under the deck it arrives at.** A ramp must arrive *on top of* the floor it joins.
6. A sky chute with 67 m of drop ran away with her (the game caps rails at 32 m/s). Long drops are fine; just know
   she arrives fast.

Run `check()` before every export. It flags:
- names the game ignores;
- mirrored objects, tilted boxes, and walkways exported as boxes;
- down-facing floors;
- empty rails and launchers with no target;
- a missing spawn;
- too many materials, and textures over 2048.

## 8. The return package

Hand back to the game session:

1. `zones/zone_<name>/zone_<name>_visual.glb` and `zone_<name>_collision.glb`, one folder per zone.
2. A short README per zone covering:
   - what is in it, and where the spawn is;
   - **every line you intend to be skated** (e.g. "spawn → bank → tower 3 roof → ring rail → walkway down to the bowl"),
     because the game session drives exactly those lines in the headless sim and reports any that break;
   - materials and texture sizes, triangle counts, file sizes.
3. A couple of Blender screenshots from roughly the player's height, to compare against the game.

On the game side the session:
- adds one line per zone to `LEVEL.zones`;
- loads the collision file through the real loader in the sim (`npm run sim zones`);
- rides every listed line;
- reports what it found as **EXPORT** notes (things to fix in the file) or game fixes (things the game should handle).

The level is then one ⚙ / LEVEL switch away on his phone.
