# The reference park (r88)

This is the park that rides well: **MEGA SKATEPARK**, built in the game from one generated top-down image. It is here
so a Blender session can see exactly what it is made of, rebuild parks the same way, and check its rebuilds against it.

Regenerate everything here with `npm run export:park` (or `npm run export:park -- <name>` for any `parks/<name>.json`).
`npm run sim parkref` re-imports the GLB turned 180 degrees into an empty world and checks it rebuilds the same park:
110 of 110 pieces, 61,660 floor points within 5 cm, every solid, all 96 rail ends, and the spawn.

## What is in the folder

| file | what it is |
|------|------------|
| `mega_skatepark.glb` | The park as kit pieces. Open it in Blender (File > Import > glTF). Every riding piece is an `fn_<kind>_<size>_<n>` node, grouped under `area_<id>_<name>`, with the kind, size and options in its custom properties. The game rebuilds each node into the tested piece; the mesh on the node is only a placeholder to look at. |
| `mega_skatepark_layout.json` | Every piece (area, kind, size, position, turn, options, footprint) and the **layout numbers** measured off the park (below). |
| `mega_skatepark_plan.png` | A top-down height map read off the game's collider: what she rides, not what is drawn. Grey is floor, peach to red is height up to 15 m, blue is sunk. Black lines are rails. 20 m scale bar. |
| `mega_skatepark.webp` | The image the park was built from. |
| `mega_skatepark_oblique.webp` | His angled view of the same park, which set the heights (sunk bowl and pool, the 14.4 m vert). |
| `mega_skatepark_v1.webp` | An earlier render of the same image. |
| `mega_skatepark_schematic.json` | **The actual recipe.** Every piece placed in the image's pixels. This is what the game builds the park from. |
| `RAMP_KIT.md` | The kit's spec: sizes, the piece frame, every kind and its options, and the schematic format (section "Schematics"). |

The kit library itself (every piece at every size, to duplicate from) is one folder up: `../rollergirl_kit_library.glb`.

## Three things in the GLB that are not kit pieces, and why they matter

- **`deck_park_ground`** is the park's floor, with a hole cut for every sunk bowl and pool. The sunk pieces' floors sit
  below zero. Put them on a plain flat floor and there is a lid over each bowl. Any park with a sunk piece needs its
  ground cut the same way: a `deck_` mesh with the holes. Without it, 38,229 of the 61,660 test points come back wrong.
- **`art_ground_<n>`** is the grass and paint from the drawing. It is a picture only and is never collided (the game
  ignores names it does not know for collision).
- **`marker_spawn_park` and `marker_spot_<area>`** are where she drops in and each area's fast-travel stop.

The root node `park_mega_skatepark` moves the park so its middle is at the origin. Its children are in the game's world
frame. In Blender's top view, +X is right and the game's +Z is down the screen, which is also the image's way up.

## How the park was made (this is the process to copy)

1. **One image of a whole skate park, drawn from above.** It was a generated image of a real-looking park, not a level.
   Every area in it is skate park: there is no road, building or scenery anywhere on the riding surface.
2. **Pick a scale.** `mpp` is metres per pixel. This park uses 0.156 on the current image. The scale was chosen to
   exaggerate the park: on the first render it came to 1.75 times what the image's scale bar said. She is fast (top
   speed about 25 m/s) and jumps about 3.8 m, so a park at true scale feels cramped.
3. **Split it into areas** the way the image does: main entry, street course, bowl complex, vert, snake run, mini ramp,
   and so on. Each area is a group of pieces with its own stop.
4. **Place kit pieces on the image's pixels.** Each piece gets a kind, a size, a pixel position and a direction on the
   page. Curved shapes (the clover bowl, the kidney pool, the snake run, the U funbox, the S spine) are a traced line of
   pixels with a `wall` kind. The schematic file is exactly this list.
5. **Build it and ride it.** The game builds every piece, the harness rides each one, and whatever does not work moves.
   Everything that misbehaved along the way is written up in `RAMP_KIT.md`.

The kit does the hard part. Every piece is already tested, so a layout of kit pieces gets working transitions, copings
that grind, and decks that meet. The layout is the only thing left to design.

## The layout numbers (measured on the collider, so any park can be compared)

| | this park |
|---|---|
| size inside the fence | 210 x 147 m |
| pieces | 110, of which 54 are riding pieces (the rest are planters, lamps, fence, shade) |
| grind rails | 48 |
| ramp faces that run into another rise within 60 m | **81%** |
| run-out from the foot of a ramp to the next rise | p10 2.4 m, p25 6.3, **median 12**, p75 24.6, p90 38.5 |
| gap from a riding piece to its nearest neighbour | p10 0.4 m, **median 3.8**, p90 15.8 |

How the ramp-to-ramp numbers are measured: from every ramp face, roll down its fall line, across whatever floor is at
its foot, and record how far it is until the ground rises again. They describe rhythm. Most ramps lead into another
feature 6 to 25 m away, which is about one to two seconds of riding at her cruising speed. Very little space is
dead. A rebuilt park should come out with numbers in the same range.

The areas, their sizes and what they are built from:

| id | area | size (m) | tallest (m) | pieces |
|---|---|---|---|---|
| 1 | main entry | 34 x 45 | 8.3 | stairs L, bank L, planters, lamps |
| 2 | street course | 40 x 25 | 2.4 | stairs M, ledges |
| 3 | central hub | 25 x 12 | 5.5 | frustum S, island |
| 4 | bowl complex | 61 x 53 | sunk | wall L (clover, sunk), wall S |
| 5 | flow park | 75 x 45 | 2.4 | wall M, ledges, rail, frustum S, bank M |
| 6 | vert | 22 x 25 | 14.4 | wall MEGA |
| 7 | spine | 16 x 17 | 3.6 | wall L (S spine) |
| 8 | snake run | 66 x 30 | 1.5 | wall S (pill), bank S |
| 9 | bridge | 43 x 21 | 3.6 | stairs L, walk L |
| 10 | gap and drop | 38 x 21 | sunk | wall L (kidney pool, sunk) |
| 13 | north street | 79 x 23 | 8.3 | deck M, bank M, stairs, island, ledges, wall M |
| 14 | funbox | 22 x 20 | 1.2 | wall S (U funbox) |
| 15 | pyramid | 15 x 15 | 2.4 | frustum M |
| 16 | mini ramp | 19 x 14 | 2.4 | halfpipe M |
| 17 | rooftop | 29 x 41 | 5.4 | deck XL, stairBank XL, ledge, rail |
| 18 | advanced line | 25 x 28 | 15.1 | deck MEGA, stairs MEGA, stairs XL |
| 19 | beginner line | 19 x 11 | 1.2 | kicker S, frustum S |
| 20 | spectators | 36 x 15 | 3 | bleachers |
| 25 | upper plaza | 30 x 39 | 8.3 | deck M, terrace M, stairs M, stairBank M, rail |

## Rules of thumb this park follows

These are observations from this park and from building it, not laws:

- **Every area is a skate park area.** There are no paths between features: the space between ramps is floor you push
  across, and it is short.
- **Ramps lead into ramps.** A typical run-out is 6 to 25 m, and 81% of faces lead somewhere.
- **Features sit close but not touching.** The median gap between neighbours is about 4 m: room to push, not room to
  get lost.
- **Use the kit's pieces at the kit's sizes.** Every size is a height on one 1.2 m ladder (S 1.2, M 2.4, L 3.6, XL 4.8,
  XXL 7.2, MEGA 9.6), so pieces of one size meet at one deck height.
- **Bowls are a closed `wall` facing in.** Sunk ones need the cut ground described above. For the game's own bowl, the
  tested sizes are the safe choice.
- **Furniture never goes on a riding line.** A planter traced from the image once stood in front of the QP XL and the
  ride test hit the tree.

## A note on "launching out of a bowl stops at the top"

In this game that is the intended behaviour, not a broken piece. Any air off a face steeper than 65 degrees is a vert
air: she goes straight up and comes back down the same wall, like Tony Hawk. To leave, **hold the right stick up in the
air** (build r86 onward). A flick up on the wall is a speed boost that still comes back in. So when a bowl does not let
her out on a tap, check the controls before the geometry.

## Two ways to build the next parks

**A. In Blender, from the kit library.** Duplicate `fn_` placeholders from `../rollergirl_kit_library.glb`, place and
turn them, set options as custom properties, and export. The game rebuilds every `fn_` node. A park with sunk pieces
also needs its `deck_` ground with holes.

**B. As a schematic, with no Blender at all.** Write a `parks/<name>.json` like `mega_skatepark_schematic.json`, placing
pieces on the image's pixels. This is literally the process that made this park, and it is plain text, so it is the
fastest way to batch many parks. Drop the file and its image into the game's `parks/`. Then:
- `?world=kit&park=<name>` in the URL builds it in the kit world, so it can be skated straight away;
- `npm run export:park -- <name>` writes it out as a GLB like this one, ready to wrap a level around in Blender.

Either way, send the result back. It gets imported into the game and checked with the same tools: every piece built,
floors and rails where they should be, and the layout numbers above measured for comparison.
