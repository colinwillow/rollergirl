# The ramp kit (r66)

A set of modular skate pieces built and tested in the game. They are white placeholders, labelled by size. In Blender
you place them where the level wants them, then export. The game rebuilds every one from its name, so the ramps ride
exactly as tested whatever the art on top of them looks like.

- **In game:** ⚙ → *World 2 ramp kit* (reload), or open the page with `?world=kit`. The ➤ key walks the rows.
- **Out of the game:** `npm run export:kit` writes:
  - `exports/rollergirl_kit.glb`: one object per piece, placed as in the gallery.
  - `exports/rollergirl_kit.json`: the same, as data.
- **Tested:** `npm run sim kit` rides every piece. It also exports the kit, reads the GLB back turned 180° and moved,
  and checks that every raised floor of the copy matches the gallery: 8417 points, 0 off.

Rails and roads are the next kits. This one is ramps only.

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
| `rollin` | the tall drop-in for speed: deck, steep face, transition, and a climbable back bank | `angle` 42, `r` 4, `deck` 3, `back` 20 |
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
