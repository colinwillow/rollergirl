# The ramp kit (r66)

A set of modular skate pieces built and tested in the game. They are white placeholders, labelled by size. In Blender
you place them where the level wants them, then export. The game rebuilds every one from its name, so the ramps ride
exactly as tested whatever the art on top of them looks like.

- **In game:** tap the **LEVEL** key (top right) and choose **RAMP KIT PARK**, or open the page with `?world=kit`. You
  spawn at the top of a roll-in in the **mega park** (below). The ➤ key walks the park's areas first, then the gallery
  rows of single pieces.
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
