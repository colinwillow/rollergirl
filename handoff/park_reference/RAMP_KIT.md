# The ramp kit (r66)

A set of modular skate pieces built and tested in the game. They are white placeholders, labelled by size. In Blender
you place them where the level wants them, then export. The game rebuilds every one from its name, so the ramps ride
exactly as tested whatever the art on top of them looks like.

- **In game:** tap the **LEVEL** key (top right) and choose **RAMP KIT PARK**, or open the page with `?world=kit`. You
  spawn at the top of a roll-in in the **mega park** (below). The ➤ key walks the park's areas first, then the gallery
  rows of single pieces.
- **The library to hand over (r83):** `npm run export:lib` writes the gallery alone (103 pieces, no example parks) to
  `handoff/rollergirl_kit_library.glb` + `.json`, the file the Blender brief (`handoff/LEVEL_BUILDING.md`) points at.
- **Out of the game:** `npm run export:kit` writes:
  - `exports/rollergirl_kit.glb`: one object per piece, placed as in the gallery.
  - `exports/rollergirl_kit.json`: the same, as data.
- **Tested:** `npm run sim kit` rides every piece. It also exports the kit, reads the GLB back turned 180° and moved,
  and checks that every raised floor of the copy matches the gallery: 8417 points, 0 off.

The **rail kit** (r67) is the second half of this file. Roads are next.

## Sizes: a size is a HEIGHT

Pieces of the same size meet at the same deck height, so they fit together.

| size | H (deck) | transition radius r | lip (toe → coping) | sweep | tint   |
|------|----------|---------------------|--------------------|-------|--------|
| S    | 1.2 m    | 1.82                | 1.71               | 70°   | mint   |
| M    | 2.4 m    | 2.90                | 2.86               | 80°   | blue   |
| L    | 3.6 m    | 3.94                | 3.93               | 85°   | lilac  |
| XL   | 4.8 m    | 4.97                | 4.97               | 88°   | peach  |
| XXL  | 7.2 m    | 7.46                | 7.46               | 88°   | cream  |
| MEGA | 9.6 m    | 9.95                | 9.94               | 88°   | pink   |

XXL and MEGA (r72) are the big end: vert you fly out of, a 7.2 m bowl deck, a 9.6 m mega ramp. Everything that took a
size before takes these too.

Every straight piece is **4 m wide**. A quarter pipe's deck runs **1.5 m** behind the coping, and the coping is 0.3 m.

## The piece frame

A piece's **origin is on the ground, at the middle of its front edge (the toe)**:

- **Local +Z** is the way the rider goes UP it (in the game, `u`).
- **Local +X** is across it (`w`), ±2 m for a straight.
- **Y** is up.

Turn the object about Z-up in Blender (Y-up in glTF) and the piece turns with it. Only a turn about the vertical is
read. Tilting a piece does nothing, because ramps stand on level ground.

## Naming: this is what the game reads

An object is a piece if:

- its **name** is `fn_<kind>_<size>`, optionally followed by `_` or `.` and anything (`fn_qp_M_3`, `fn_qp_M.001`), or
- its **custom properties** carry `fn` and `size`, in which case the name can be anything.

A list or object option may also be written as JSON TEXT (`pts: "[[0,0],[4,2]]"`, r83), which is the easy way to
set one from a Blender custom property.

Any other custom property that matches an option below is passed to the piece, for example `rc` on a corner, `flat`
on a half pipe, or `banks` (an array) on a frustum. `info`, `label`, `name` and `footprint` are for reference only and
are ignored.

Set `draw` to `false` and the game builds the COLLIDER only, with nothing drawn. Use this when your own art is the
picture and this piece is the physics under it.

The game rebuilds the piece from the name. **The placeholder's own mesh is never used**, so it can be scaled,
re-modelled or deleted from the export without changing anything. Only the node's position and its turn matter.

The `guide_…` line under each loop is the shape of the rail, for reference only. It is ignored on import.

## Pieces and options

**Single pieces:**

| kind | what | options (default) |
|------|------|-------------------|
| `qp` | quarter pipe, straight | `w` 4, `deck` 1.5 |
| `qpIn` | inside corner (concave), a quarter of a bowl. Revolved about the origin from +Z to +X; a straight continuing it has its toe at `rc` | `rc` 1.5, `a0` 0, `a1` π/2 (radians), `deck` |
| `qpOut` | outside corner (convex), the wall wrapping round. Centred where two straights' BACK edges meet | `a0` π, `a1` 1.5π, `deck` |
| `bank` | straight slope up to H | `angle` 25°, `w` |
| `platform` | solid block H tall | `w` 4, `d` 4 |
| `frustum` | flat top with a bank or a wall on each side: funbox, pyramid, hip | `len` 6, `w` 6, `angle` 25, `banks` [−Z, +Z, −X, +X] as 1/0 |
| `rollin` | the tall drop-in for speed: deck, a ROUNDED lip (so a pushing start stays on the face), steep face, transition, and a climbable back bank | `angle` 42, `r` 4, `deck` 3, `back` 20, `lipR` 5 (0 = a sharp lip) |
| `kicker` | an arc that ENDS at its lip. H is half the size | `angle` 38, `h`, `w` 3 |
| `launch` | a plank with no top | `angle` 30, `w` 3 |
| `table` | kicker, flat table, landing | `angle` 32, `table` 6, `land` 22 |
| `gap` | kicker, gap, landing that starts at the kicker's height | `gap` 5 |
| `spine` | two transitions back to back. S rolls over; M and up is a transfer | `sweep`, `w` |

**Assemblies:**

| kind | what | options (default) |
|------|------|-------------------|
| `halfpipe` | two `qp` facing across `flat`, running along X | `flat` 6, `len` 8 |
| `pool` | half pipe with both ends capped by inside corners (the "half bowl" end) | `flat`, `len` |
| `bowl` | round bowl, four inside corners on one centre | `rc` 4 |
| `pipeL` | a pipe turning 90° (concave outer wall, convex inner) | `flat` 6, `leg` 8 |
| `pipeT` | a pipe with a second one leaving it at 90° | `flat` 6, `len` 28, `leg` 10 |
| `bankDeck` | a bank and a 4 m platform behind it | `angle` |

**Loops** (`loop360`, `loop180`) are **booster grind rails**: tap onto the start, as with the city's loop. The 180
rolls upright at the top and lands on its own deck. Options: `R` (radius, 1.25 H), `boost` 16.

## Fitting pieces together

- **Straight to straight:** two `qp` of one size side by side, 4 m apart along X.
- **Inside corner to straight:** the straight's toe is at `rc` from the corner's origin, on the corner's +Z edge
  (running toward −X) or its +X edge (running toward −Z). The corner's deck is filled out to the square, so the two
  decks meet.
- **Outside corner:** its origin is where the two straights' back edges meet.
- **Bank and platform:** a `bank` of size S reaches exactly the top of a `platform` of size S.
- **Spot or launch target:** a `deck_`/`ground_` surface at a size's H is level with every piece of that size.

## Pipe modules (r70): snap-together pipes

`halfpipe`, `pipeL`, `pipeT` and `pool` are each one object laid out ACROSS their own frame. They are fine to drop in
but can't be chained. These four are the same straights and corners as **snap-together** pieces. The origin is the
middle of the flat where the channel ENTERS, local +Z is the way it runs, and `info.out` is where the next piece's origin
goes (the tee also has `out2`, its branch). A pipe of any shape is then a list of pieces, each placed at the last one's
`out`.

| kind | what | options (default) |
|------|------|-------------------|
| `pipe` | straight: two QPs facing across the flat | `flat` 6, `len` 8 |
| `elbow` | 90° bend: an inside corner on the outside of the bend and an outside corner on the inside, same centre | `flat` 6, `right` 1 turns toward −X (default +X) |
| `tee` | a pipe with a second leaving its middle at 90°. `out` carries straight on, `out2` is the end of the branch | `flat` 6, `len` 20 (at least 2·(flat/2 + lip + 1.5) + 2), `leg` 8, `right` 1 |
| `pipeEnd` | the half bowl that closes a pipe | `flat` 6 |

**Keep `flat` the same along a run.** Every piece is built on its size's quarter pipe, so the decks meet at that size's
H and the flat keeps its width round every bend.

## Coming back in

Export the level's placeholders, in their own GLB or inside the collision GLB, and list the file in `LEVEL.imports`.
`levelIngest` rebuilds every `fn_` node it finds, in the visual file or the collision file, and builds each node only
once. Each placement turn is read from the node's world matrix.

## The rail kit (r67)

The rails live in the same world, behind the spawn (➤ walks their rows, plus a **rail chain**), and are exported in the
same GLB under the same `fn_` naming.

**A rail's height comes off the same ladder.** Its top is S 1.2 / M 2.4 / L 3.6 / XL 4.8 m above the piece's origin, so a
rail M is level with every M deck and coping. Override it with `h` for anything else (the 0.6 m ledge is `h: 0.6`).

**The frame:**
- Each rail piece's origin is on the ground **under the start of its bar**, and local +Z runs along the bar.
- Each piece's custom properties carry `info.out`: where the NEXT piece's origin goes, given in this piece's own frame
  (`at` = [x across, y, z along]) along with the turn about up (`yaw_deg`).
- **To snap two pieces together**, put the second one's origin at the first one's `out` and turn it by `yaw_deg`. The
  game joins rail ends that sit within 0.75 m of each other, so pieces placed end to end grind as one rail. No
  connector pieces are needed.
- A Y junction has a second exit, `out2`, at the end of its branch.

**Pieces and options:**

| kind | what | options (default) |
|------|------|-------------------|
| `rail` | straight | `len` 8, `h`, `boost` (a booster rail's target speed, e.g. 14) |
| `railDown` | down one step of the ladder (an M ends at S height; S drops 0.6) | `len` 6, `drop` |
| `railKink` | flat, down a step, flat | `flat` 2.5, `run` 4, `drop` |
| `railCurve` | flat curve turning LEFT (toward +X) | `deg` 90, `r` 4, `right` 1 turns the other way |
| `railS` | S-bend: sideways by `off`, leaving parallel | `off` 3, `len` 10, `right` |
| `rainbow` | up and over; both ends at the size's height | `rise` 1.2, `len` 8 |
| `railRing` | closed circle through the origin, centred toward +X | `r` 4 |
| `helix` | spiral, one step down per turn, ending under where it began | `r` 4, `turns` 1 |
| `railY` | a straight with a branch forking off toward +X at 20°, curving to 40°. The left stick picks; with no stick she goes straight on | `len` 10, `at` 3, `r` 6, `deg` 40, `kick` 20 |
| `ledge` | solid block of the size's height, steel along both top edges (they grind, the top is a floor) | `len` 8, `w` 1.2, `h` |
| `stairs` | a flight rising the size's H at 32° to a 3 m landing, a handrail down each side 1.2 m over the step noses. The handrail's top is at H + 1.2 (the next size up) and its foot at 1.2, so it snaps into the ladder too. Origin at the BOTTOM step; +Z goes up the flight | `angle` 32, `land` 3, `w` 4, `hr` 1.2, `rails: false` |

**Things that fit:**
- A flat rail of a size meets any other rail, curve or ring of that size.
- A down rail or kink of a size ends at the next size down.
- A stair set's handrail top meets a flat rail one size up, standing on its landing.
- The `rail chain` row is a worked example: rail M, curve M, down M, rail S, curve S right, kink S, then rail at 0.6 m.
  It is ground as ONE grind in the test.

**In Blender each rail is a tube on its piece** (its top is the line she rides), with a `guide_` line per rail for
reference. On import the game rebuilds the rails from the piece. With `draw: false` on the piece, the rails are
ground but not drawn, because your art is the rail.

**Tested in `npm run sim kit`:**
- Every rail path in the gallery is ground end to end from its higher end, and the ring goes round.
- A tap from the ground beside a rail, a down rail and both ledges gets her onto it.
- Every stair set: rolled down without dropping below the step noses, rolled up onto its landing, and its handrail
  ground from the landing to the bottom.
- The chain is ridden end to end, the Y follows the stick, the booster speeds her up, and a ledge is a floor on top
  and a wall from the side.
- The export round trip puts all 68 rail ends back within 0.000 m.

## The mega park (r70)

One connected park of 97 pieces, east and north of the gallery, built entirely from `kitPiece` calls, the same call an
`fn_` node makes. The export puts it in its own `example_park` group, one child per area.

| area | how it is put together |
|------|------------------------|
| ring | a closed loop of pipe M: 40 m straights, four elbows, and on the north and south sides 20 m straight + tee + 20 m straight. The whole ring is ONE list, each piece placed at the last one's `out`. |
| plateau | the ring's inside (the rectangle of its four elbow centres) filled with platform M at deck height, flush with every inner deck. A **bowl M** and a **pool M** are SUNK into it (their decks are at M height, so they are holes in the plateau). On top: a raised S level (bank S up, deck, stair landing, stairs S down, handrails running on as a rail and a down rail), a 0.6 m ledge, a manual pad, a funbox with a rail, a kink rail. |
| north spur / south snake | off the two tees: north a short pipe to a half-bowl end; south an elbow, a straight, an elbow the other way, a straight and a half-bowl end |
| drop-in (spawn) | roll-in XL → 18 m → a bank M up to the ring's west outer deck → over the coping into the pipe |
| east | a platform M off the ring's east outer deck, stairs M down to a street (ledges, kink, rainbow, pyramid, hip, funbox + rail), the handrails running back along the deck as rails |
| tiers | bank M → deck M → bank S → deck L → bank S → deck XL → a long bank XL down |
| mini snake | pipe S with three elbows, capped at both ends |
| spine box / big pipe / XL corner / pool L | a spine between two QPs, the half pipe XL, an XL vert corner, a pool L |
| jumps / loops / rails | launch, kicker, gap, table-top; the 360 and 180; the rail chain, ring, helix, Y, booster |

**Tested in `npm run sim kit`:**
- No piece sits inside another.
- From the spawn, she drops in, climbs the bank and goes over the coping into the ring.
- A full lap of the ring, steering down the middle of the flat.
- The south snake from its tee to its end.
- A drop off the plateau into the sunken bowl.
- The raised level: up, across and down the stairs; the deck rail grinds on down the handrail.
- Off the east deck and down the stairs M to the street.
- The tiers up to the XL deck and down.
- 132 hands-off rides through every pipe, elbow, tee, end, bowl and pool.
- The export round trip (sampled, then the copy ingested alone): 146,515 floor points and 138 rail ends exact.

## Limitations the mega park found (to curate before the handoff)

1. **Every crease from a slope onto a flat is a kicker.** Banks onto decks, stairs onto landings, a bank up to a coping
   and over it: at speed she leaves the ground at every top edge. The tiers were flown rather than climbed until she
   rode them slower. Only the roll-in has a rounded lip (`lipR`). A rounded top for banks and stairs may be wanted.
2. **Pipes only turn 90°.** There are no 45° elbows, no branch at any other angle, no pipe that rises or falls (a
   downhill snake), and no adapter between sizes (an S pipe cannot run into an M pipe).
3. **Sunk pieces only sink to their own height.** A bowl M is flush with an M plateau because everything is built up from
   the ground. Sinking a bowl into an L plateau means a bowl L, or a plateau at a different height.
4. **The world has edges.** The collider grid is ±480 m and the white floor is narrower. Off the end of the tiers at
   24 m/s she rolled off the floor until they were moved; big levels need run-out (or a bigger grid).
5. **Ramp sides are not walls.** As everywhere in this game, a ramp's side is drawn but not collided, so you pass
   through one side-on. Decks, platforms and box tops ARE solid.
6. **Loops are rails.** The collider is "the floor under this point", so nothing can be ridden upside down as a
   surface.
7. **Pieces must meet exactly.** Nothing snaps them together after the fact: in Blender, place each one at the last
   one's `out` (or at the fitting rules above).


## Grinding the kit (r71)

Grinding is a **swipe down** on the right pad now. Nothing has to be authored for a coping or a deck edge to be
grindable: every pipe and quarter pipe coping, bowl and pool rim, platform and box edge, and the sloped sides of banks
and stairs is found off the collider when she swipes (`lipEdges`). So the kit needs **no rail along a coping**. Rails
(`rail_` lines, the rail kit) are still rails; put one where there is no edge to grind, or where you want a bar standing
proud of the deck.


## The sheet park (r72): building his style sheet out of the kit

**Superseded at r73 by the schematic below.** r72 built every feature on the sheet but laid them out by hand, its own
way; the table is kept because it is the list of what each feature is made of.

| # | sheet feature | built from |
|---|---------------|------------|
| 1 | main entry | platform L deck (spawn), grand stairs L with hubbas, a bank L either side, a bank out through the fence gap |
| 2 | street course | two blocks at M: stairs + handrails, stairs + hubbas; ledges, a manual pad, kink, down rail, flat rail |
| 3 | hub | the open floor at the foot of the grand stairs that every area opens onto |
| 4 | bowl complex | **freeBowl XXL** clover (3 lobes, 4 m shallow end to 7.2 m deep end); **freeBowl XL** round, raised on platform M so its deck meets the clover's; bank XXL up to the deck |
| 5 | flow park | hips L, bank-to-bank L, rollers into a **berm** 90 and out, pyramid M |
| 6 | vert / mega ramp | **halfpipe MEGA** with a 4 m deck and stairs MEGA up to it; the MEGA line: **rollin MEGA**, a gap XL with a tall landing, **qp MEGA** |
| 7 | spine | QP XL > spine XL > QP XL |
| 8 | snake run / pump track | pipe L through **four 45° elbows**; a **roller** and **berm** 180 pump loop |
| 9 | elevated bridge | **bridge** XXL off the clover's deck to a platform XXL tower, bank XXL down; ridden under at ground level |
| 10 | gap / drop | gap XL (12 m), a drop deck L |
| 11 | hubba / manual pads | **stairs `hubba`**, ledges S at 0.3 / 0.6 m |
| 12 | handrails | stairs handrails, kink, down rails |
| 13 | QPs of varied height | a row: qp S, **qpAdapt** S>M, qp M, ... qp XL, qpAdapt XL>XXL, qp XXL |
| 14 | funbox with rails | **frustum `rails`** |
| 15 | pyramid / euro gap | frustum L pyramid; the euro gap is composed from a frustum and a bank, not a piece |
| 16 | mini ramp | halfpipe M |
| 17 | rooftop | platform XL 24 x 24 with a ledge and rail on it, bank XL up, stairs XL down |
| 18 / 19 | advanced / beginner line | the rooftop stairs XL; an S line of kicker, ledge, funbox, QP |
| 20-24 | seating, shade, landscaping, lighting, fence | **bleachers, shade, planter, lamp, fence**: placeholders, solid where you would hit them |

**Pieces the sheet needed and the kit did not have (all built, in the gallery's 'new pieces (r72)' row at z -340 and
the 'giants (r72)' row at z 412):**

| kind | what | options (default) |
|------|------|-------------------|
| `elbow` | now ANY angle, `deg` 90 (45 and 22.5 in the gallery). `out` turns by `deg`. | `deg` 90, `right`, `flat` 6 |
| `qpAdapt` | a quarter pipe whose height changes across its width: size S at -w, `to` at +w. The connector between two QPs of different sizes | `to`, `w` 6, `deck` |
| `pipeAdapt` | a pipe whose walls grow from S to `to` along its length: the connector between two pipe sizes | `to`, `flat` 6, `len` 8 |
| `freeBowl` | a bowl with a free-form rim (`lobes` x `amp`: a peanut is 2 lobes, a clover 3, 0 is round) and a depth that runs from `shallow` to H, deepest at `deepAt` degrees | `R` lip + 6, `lobes` 3, `amp` .18, `phase`, `shallow` .55 H, `deepAt` 0, `deck` 3 |
| `squareBowl` | four straights and four inside corners on one centre | `side` 10, `rc` 3 |
| `bridge` | a deck at H on posts, railings that grind, rideable underneath | `len` 16, `w` 5, `h` |
| `roller` | a sine hump for a pump track | `h` .7, `len` 5, `w` 4 |
| `berm` | a banked turn of any angle; snaps like an elbow | `deg` 180, `r` 7, `w` 4, `h` .6 H, `right` |
| `stairs` `hubba` | ledges down both sides of a flight instead of handrails | `hh` .6, `hw` .7 |
| `frustum` `rails` | a rail along the top and down rails over the banks | |
| `gap` `landH`, `landDeg`, `landW` | a taller, flatter landing for a big gap | |
| `fence`, `shade`, `bleachers`, `planter`, `lamp` | the sheet's site furniture | `len`, `h`, `rows`, ... |

**Tested in `npm run sim kit`:**
- Every new gallery piece is ridden: along the pipe adapter; up the QP adapter at three widths; the peanut bowl from
  three sides; the square bowl; under and over the bridge; round the berm.
- The sheet: no piece inside another and all of it inside the fence.
- Down the grand stairs from the spawn.
- All 9 faces of the QP row.
- The MEGA vert to 8.3 of its 9.6 m far wall; up the stairs MEGA.
- Up the bank XXL; the clover from five sides; the raised round bowl.
- Across and under the bridge.
- The snake end to end; a pump-track lap; the flow line.
- A swipe-down hubba grind.
- The MEGA line: 25 m/s, cleared, 11.2 m up the 9.6 m QP.
- The gap XL at 22 m/s; the rooftop stairs.
- The fence; every ➤ stop.

## What the sheet park found

1. **Elbows needed other angles.** A snake that only turns 90° is a grid. 45° and 22.5° are in; any `deg` works.
2. **Sizes needed connectors.** Two pipes or two QPs of different sizes could not meet. `pipeAdapt` and `qpAdapt` are
   those connectors.
3. **Big gaps need big landings.** At MEGA speed (25 m/s) a gap XL's 9 m landing is overshot and she slams the flat
   (QP MEGA reached 6.5 m of 9.6). A 4.8 m landing at 15° catches the whole range.
4. **A long flat between a drop and its kicker eats the drop.** 67 m of flat bled 25 m/s to 18 (the coast fade). Put the
   kicker at the roll-in's foot.
5. **Bowls are still built up, not sunk.** The round bowl shares the clover's 7.2 m deck by standing on a platform M;
   anything sunk into a floor has to be sized to it.
6. **Still not there:** a pipe that rises or falls (a downhill snake), a branch at an angle other than 90°, a euro gap
   piece, a bowl hip or a spined bowl, a bowl extension between two bowls. The furniture is placeholder art.


## Schematics (r73): a park built from a plan drawing

A **schematic** is a JSON file in `parks/` that places kit pieces **in the pixels of a plan drawing**. Trace a top-down plan,
write the file, and the kit world builds it. Nothing about a particular park is in the code. `parks/mega_skatepark.json` is
his MEGA SKATEPARK sheet (drawing: `parks/mega_skatepark.webp`): 105 pieces in 23 areas, and the kit world spawns at its
main entry.

```json
{ "name": "MEGA SKATEPARK", "image": "parks/mega_skatepark.webp",
  "mpp": 0.3,                                     // metres per pixel of the drawing
  "pin": { "px": [575, 312], "world": [-305, -60] },   // one pixel and where it lands
  "spawn": { "p": [538, 548], "dir": 0 },
  "tints": { "wood": "#dca76f", "concrete": "#c9cdd5" },
  "ground": [ { "color": "grass", "pts": [[x, y], ...] } ],      // flat colour, drawn only
  "areas": [ { "id": 6, "name": "vert", "label": [x, y], "stop": { "p": [x, y], "dir": 180, "y": 9.6 },
               "pieces": [ { "kind": "qp", "size": "MEGA", "p": [821, 150], "dir": 0, "o": { "w": 32, "deck": 4 }, "tint": "wood", "id": "vert" } ] } ] }
```

- **`p`** is the piece's own origin, as in the piece frame above: a ramp's toe, a bowl's, pool's or half pipe's centre, a
  platform's front edge, a pipe's entry, a stair set's foot. **`c`** instead is the middle of what it covers, for platform,
  frustum, ledge, bleachers, shade and rail.
- **`dir`** is degrees on the drawing: 0 is up the page, 90 is right. It is the way the piece's +u points: up a ramp's
  face, up a flight of stairs, along a rail. A quarter pipe drawn with its deck at the top of the page is `dir 0`.
- **`o`** holds the piece's options in metres, exactly as the kit takes them.
- **`y`** puts a piece on top of something; a ledge on a roof is `"y": 4.8`.
- Per-piece extras:
  - `tint`: a name from `tints`, or a colour.
  - `id`: names the piece for the harness.
  - `group`: pieces built to touch.
- Kinds that only exist in a schematic:
  - `pipePath`: `pts` is a line drawn down the middle of a pipe. It becomes straights plus an **elbow at each corner's own
    angle**, with a half-bowl end at each end (`ends: [1, 1]`). A corner too sharp for its legs is reported in the console.
  - `run`: `steps` snapped piece to piece from `p`/`dir`, as `kitRun` (e.g. roller, berm 180, roller).
  - `fence` along a polyline, `trees` (a planter at each point), `lamps`.

**Checking a trace: `npm run plan [parks/<name>.json]`** (about 30 s, headless chromium). It renders the built park from
straight above, at the drawing's own scale and orientation (the camera comes from `mpp` and `pin`), and writes:
- `shots/plan_<name>_side.png`: the plan and the build, side by side;
- `shots/plan_<name>_overlay.png`: the build laid over the plan at half strength, so a misplaced piece shows;
- `shots/plan_<name>_persp.png`: a view from the south-west, as his sheet has.

**Making a new one:**
1. Put the drawing in `parks/`.
2. Pick `mpp` from its scale bar (times the exaggeration you want: his sheet's bar says 0.17 m/px; 0.30 is 1.75x).
3. Pick a `pin` somewhere open in the kit world.
4. Read pixel positions off the drawing. A gridded zoom of it is the quickest way.
5. Write the areas, then run `npm run plan` and move whatever the overlay shows is off.
6. Run `npm run sim kit`. Every piece with an `id` can have a ride test, and the sheet tests find their pieces by id.

**What his plan has that the kit still cannot draw:**
- the S-curved spine (7) and the U-shaped funbox (14): there is no curved spine and no horseshoe bank;
- the long raised walkway with railings from the rooftop to the quarter pipe deck: there is no sloped deck;
- bowls sunk into the plaza: the bowl is a raised block with banks up to its deck;
- the planted islands: they are only grass colour and box planters.
Each of these would be a new kind, then a line in the schematic.


## Path pieces (r74): shapes drawn as lines

Every curved piece before r74 was a revolve about a centre, so a shape that is not a circle or a pill could not be built.
These three take **a line** instead, which is what a plan draws:

| kind | what | options (default) |
|------|------|-------------------|
| `wall` | a cross-section **swept along a path**; the path is the COPING | `pts` [[u, w], ...]; `closed`; `smooth` (on for a loop); `profile` `qp` / `bank` / `box`; `face`: a point on the ridden side, or `in` / `out` for a loop, or `both`; `H` (a number, or one per point); `sweep`; `angle` (bank); `deck` 1.5; `top` (the flat on a `both` ridge, 0.2); `rim` (with per-point `H`: the deck stays at `rim` and the floor drops, so a bowl has a shallow end); `floor` (a loop facing in is filled); `outer` (a polygon the deck is filled out to and walled) |
| `deck` | a platform of **any outline** | `pts`, `h` (the size's height), `holes` |
| `walk` | a ribbon along a path, **every point its own height** | `pts` [[u, w, y], ...], `w` 4, `rails`, `under` `solid` / `posts`, `smooth` |

One `wall` covers many shapes:
- a closed loop facing `in` with a floor is **a bowl of any outline**: his clover, the kidney pool, the snake run's pill;
- `face: 'both'` is an S-spine (qp), a U or horseshoe funbox (`bank`, with a `top`), or a curved ledge (`box`);
- an open line facing a point is a curved QP or a C bank.

Copings and edges grind for free, because r71's lips find them.

**Two things the geometry does for you:**
- **A bend tighter than the cross-section is deep would fold** (a lobe tip, the inside of a berm). Each section is squeezed
  to fit the bend it sits on, tapered along the path.
- **A floor whose depth changes is blended:** inner points take the toes' heights by nearness. Without that, a deep end and
  a shallow end were joined by a few long facets.

**And three things the first runs caught:**
- **Every solid under a deck, a ledge or a walkway needs a walkable top.** Without one it stops her a body's width short of
  every edge she rides up onto, and at every joint of a climbing walkway.
- **A bank or transition ridge has no core.** Its sides are ramps; a core under a funbox's top stopped her dead at the edge.
- **An open path's ends are reflected, not repeated,** or the samples bunch up and a grind steps over the first segment.

The gallery row `path pieces (r74)` at z -385 has one of each, and `npm run sim kit` rides all of them.

## Detail pieces (r75): ups and downs

His plan is full of small changes of level: a raised plaza with steps off it, stairs with a bank beside them, curbed beds,
and his idea of a noise-deformed plane. Four new kinds:

| kind | what | options (default) |
|------|------|-------------------|
| `terrain` | **a grid deformed by noise**: a broad noise, a fine noise and hand-placed bumps, faded to the ground at its edges | `w` 20 x `d` 20, or an outline `pts`; `res` 1 m; `amp` 1.0 over `scale` 8 m; `amp2` 0.18 over `scale2` 2.2 m; `base` (amp x 0.6); `bumps` [[u, w, r, h]] (a negative h is a dip); `edge` 3 m; `seed`; `maxSlope` 28 deg |
| `terrace` | **kerb steps**: `n` tiers, each `rise` 0.4 m (under the 0.42 m she rolls over) and `run` 1.2 m deep, `w` 6 | `n` (size height / rise), `rise`, `run`, `w`, `land` |
| `stairBank` | **a flight of stairs with a bank beside it**, both rising over the same run; handrail on the far side | `w` 5 (the stairs), `bw` 3 (the bank), `side` +1 (bank on +w), `angle` (the stairs', 32), `land` 2, `bankTint` |
| `island` | **a raised bed** of any outline, `h` 0.45 (a curb: too tall to roll up, a lip to grind), grass on top, trees | `pts`, `h`, `trees` [[u, w, height]] |

How terrain behaves:
- **It is deterministic.** The noise is hashed from the piece's seed and its own local coordinates, so the same options
  make the same hills wherever the piece is placed.
- **Nothing goes below the ground.** Where the hills fall under it, the grid is simply not drawn and the plaza shows
  through. Those are the lows.
- **No face is steeper than `maxSlope`.** Peaks are lowered until no step is too steep, so every face is a ramp she can
  ride over. The gallery's two reach 25 and 26.5 deg.
- **In a schematic it takes `pts`, `bumps` and `trees` in drawing pixels**, like the path pieces. Things may stand on it:
  the overlap check skips it.

The gallery row `detail pieces (r75)` at z -440 has one of each. `npm run sim kit` rides them:
- both terrains are crossed four ways and never ridden through;
- both terraces are rolled up tier by tier from 3 m/s;
- the stair-bank is ridden up its bank and down its stairs;
- the island's curb stops her, and she can stand on top.

**His sheet as of r75:** the north-west corner is rebuilt level by level from the zoom. It is the **upper plaza**, a deck at
3.6 m that joins the pool deck, with:
- a kerb terrace down its north side;
- stairs down its west side;
- a long stair-and-bank (22 deg) down its south side;
- a rail on top.

Elsewhere:
- **Rooftop:** the bank up to the roof moved to the roof's south side, where he drew it. The old walkway up to the pool
  deck is gone, because the plaza does that job now.
- **Central hub:** the planted island in the middle of it, curbed.
- **South:** the grass strip is a field of low landscaped hills.

## Tracing (r74): `npm run trace`

`npm run trace -- <image> <x0> <y0> <x1> <y1> [zoom]` writes a gridded zoom of a region of the drawing, every 10 px
lined and every 50 labelled, in the drawing's own pixels. That is how the outlines in `parks/mega_skatepark.json` were read.

**His sheet as of r74:** the bowl complex, the pool (kidney), the snake run (pill), the funbox (U), the spine (S), the C
bank, the vert, the raised walkway with its ramp, the walkway up to the pool deck, and the rooftop are all traced shapes now.
**Still to close the gap with his picture (after r75):**
- the inner hips inside his bowl;
- the long walkway system from the rooftop to the quarter-pipe deck;
- the rest of his planted beds;
- the colours and materials, which the kit draws in pastel.

## Rebasing onto a new render (r76): `npm run rebase`

`npm run rebase -- <new drawing> [--apply]` moves the schematic onto a new render of the same plan. Every position in a
schematic is a pixel of its drawing, so a sharper picture cannot be traced against until the file is carried across.

What it does:
- It finds the scale and offset that line the two drawings up (normalised cross-correlation of their greyscale, coarse
  then fine) and prints them.
- With `--apply` it rewrites every pixel field into the new drawing's pixels, re-pins so the same pixel lands on the same
  world point, and sets `mpp` from the scale.
- It copies the new drawing in as the schematic's image and keeps the old one as `<name>_v<n>.webp`.

**The world does not move**, only the pixels. A piece the new render draws somewhere slightly different shows up in
`npm run plan`'s overlay.

**Check the correlation it prints.** An upscale of the same picture scores near 1; a fresh render of the same design does not.
His second plan (1448 x 1086, about twice the detail) scored **0.48**. It is the same park redrawn, so local features had
drifted by up to 10 m and had to be retraced. **`npm run trace -- --over <drawing> ...`** lays the last plan render over the
zoom at half strength, so the build's errors are read on the same grid as his drawing.

**What the r76 retrace changed:**
- **North centre:** the new picture has no quarter-pipe row. It is a street: a bank up to a terrace along the north fence,
  stairs beside a raised planter, two diagonal hubba ledges, a stair box and a bench ledge. The QP row is gone.
- **The vert** is traced where he drew it, its top cut to 70 deg so its face runs further into the flat. Beside it is a
  9.6 m platform with a long flight of MEGA stairs (26 deg) coming down from it.
- **The bowl** is retraced as his peanut and clover joined into one bowl. Banks run down its west and south edges (`wall`
  with `profile: 'bank'`, his tan band), and the bank from the vert's flat still comes up the north side.
- **The spine** follows his ridge.
- **The rooftop stairs** are a flight between two banks (`stairBank` with `side: 0`).
- **The shades and the fence** are retraced.

## His angled view (r77): `npm run oblique`, `npm run heights`

A top-down plan says where everything is and nothing about how tall it is. His second picture is the same park from
roughly 55 degrees down, and it shows the heights — but only once you know where the camera was.

- **`npm run oblique -- <angled render>` fits that camera.**
  - Every pixel of the angled view is cast as a ray onto the ground.
  - Each ray is looked up in the top-down plan through the schematic's own `pin` and `mpp`.
  - The camera position, yaw, pitch, roll and focal length that make the two pictures agree best wins (a grid of starting
    guesses, then Nelder-Mead).
  - It writes `oblique: { image, size, cam, fit }` into the schematic.
  - His picture fits at **0.85**: camera about 690 m out, 55 deg down, a 16 deg lens.
- **`npm run plan` renders the build from that camera.** It writes `shots/plan_<name>_oblique_side.png` (his | ours) and
  `_oblique_overlay.png`.
- **`npm run heights -- '[["name", px, py], ...]'`** marks where a plan point would appear in his angled view at 0, 2, 4 ...
  m up. Probe the FOOT of a wall and read its drawn top against the marks.
  - **His top-down picture is itself slightly tilted**, so tall things are drawn north of their feet in it too. AI renders
    are not consistent geometry, so read heights as a guide, not as a measurement.

**What it showed:**
- **His pool and his big bowl are SUNK.** Their rims are at the ground; there is no raised deck with walls around them.
- **The vert is the tallest thing in the park by a distance.**

**A sunk piece is a closed `wall` with `sink: 1` in the schematic.**
- Its rim is set at the ground, its floor `rim` metres below, and its piece origin at `y - rim`.
- The park's FIRST `ground` polygon becomes its floor: it collides, and it is triangulated with a hole the shape of each
  sunk piece's deck back edge.
  - r79: that edge is the one the wall actually BUILT (`r.back`: the miter and the fold squeeze included). It is not the coping
    offset by `deck`, which crosses itself at any notch tighter than the deck is wide and lays ground across the bowl.
- `kitFloor` leaves out the checker cells wholly inside that polygon. A cell under the hole would put the floor back across
  the bowl.
- Because the pool deck is gone:
  - the upper plaza's east edge is now a drop;
  - the bowl's banks are gone, and a berm along its south side is his tan wave;
  - the bridge's ramp now carries straight on off the walkway's end toward the bowl.

**r78: what the angled view changed next.**
- **The vert is a 14.4 m mega ramp.** Probed with `npm run heights`, it is drawn well over the 9.6 m MEGA size, and its
  face runs most of the way to where the plan draws its toe.
  - It is a `wall` with `H: 14.4` (the size ladder's next rung), keeping the 70 deg top.
  - The 9.6 m platform beside it gets a flight of XL stairs on to the 14.4 m deck. Dropped in from the top she reaches
    the flat at about 24 m/s.
- **The upper plaza is M (2.4 m), not L.** His stairs off it count about ten treads, against the fourteen-plus on the
  rooftop's 4.8 m flight. Its terrace, stairs and stair-bank were re-fitted to the lower deck.
- **The south-east, retraced from a close zoom:**
  - the hub QP was an A-frame (`frustum`, a 0.4 m top, 15 deg banks);
  - the C bank follows his L of quarter pipes;
  - a launch bank M sits where his grey wedge is, and a bank M beside the south fence;
  - a low berm is his crescent north of the bowl.

