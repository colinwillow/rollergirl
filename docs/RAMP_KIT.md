# The ramp kit (r66)

A set of modular skate pieces built and tested in the game. They are white placeholders, labelled by size. In Blender
you place them where the level wants them, then export. The game rebuilds every one from its name, so the ramps ride
exactly as tested whatever the art on top of them looks like.

- **In game:** tap ⚙ and choose **RAMP KIT PARK** under WORLD at the top (or open the page with `?world=kit`). You spawn
  at the top of a roll-in in the **example park** (below). The ➤ key walks the park's areas first, then the gallery rows.
  Tap **SKATE PARK** to go back.
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

## The example park (r68)

There are 48 pieces in 13 areas, built from the same `kitPiece` calls an `fn_` node makes and placed so they connect. It
shows the kit in use, and the export puts it in its own `example_park` group (one child per area), separate from the
`ramp_kit` gallery.

| area | what fits together |
|------|--------------------|
| drop-in (spawn) | roll-in XL → table-top M → kicker M → a 12 m wide QP L. One line from the deck to the QP. |
| plaza | bank M up → platform M → the stairs M landing → down the stairs → a 0.36 m manual pad. The bank top, platform and landing are all at M height. The stair handrails' tops (3.6) run on as a **rail L** across the platform and a **down rail L** over the bank: one grind from the bank to the stair foot. Ledges S and 0.6 beside. |
| boxes | pyramid M, hip M, a funbox S with a rail along its top |
| pool / T-pipe / bowl / L-pipe | the assemblies: pool M, T-pipe M, round bowl L, L-pipe M |
| mini | half pipe S and a spine S |
| XL corner | a QP XL straight, an inside corner XL and another straight, placed by the corner's own rule (each straight's toe is `rc` out from the corner's centre) |
| big pipe | half pipe XL and a pool L |
| rails | the snapped chain, a ring, a helix, a Y, a rainbow, a booster and a ledge |
| jumps | launch S, kicker M, gap M, table-top M |
| loops | the 360 and the 180 |

**Tested in `npm run sim kit`:**
- No two park pieces sit inside each other, except sets built to touch.
- The drop-in line rides from the spawn (push off, let go past the kicker) to 8.2 m of air off the QP L.
- The plaza line rides bank → deck → stairs → pad, never under the step noses.
- The rail L grinds on down the handrail to its foot.
- 36 hands-off rides through every pool, pipe, bowl and corner: none fall out, go under the floor or bail.
- Every ➤ stop stands her on a floor.
