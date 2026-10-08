# Building kit: handoff for the game side

These files are in `3_LEVELS/toon_city/exports/building_kit/`:

- **building_kit_test_visual.glb**: one test house, two floors plus a roof, built from kit pieces. It includes the moving parts, the colliders for those moving parts, and the marker empties.
- **building_kit_test_collision.glb**: the static colliders for that house, baked to world space the same way as `toon_city_collision.glb`.
- **building_kit_pieces.glb**: the raw kit, one object per piece. The game can use it to assemble its own buildings.

None of these files use Draco compression. That is on purpose: Draco can reorder vertices and may drop the custom `_CHUNK` attribute. Textures are WebP at 1024. Run `npm run ktx` after importing, as with the city files.

Blender is Z-up and the glTF files are Y-up, as usual. All sizes below are in Blender terms. The house root sits at the origin.

## Grid

- A bay is 3 m wide and a floor is 3 m tall.
- Walls are 0.25 m thick. Floor slabs are 0.2 m thick, and their walkable top is the floor height.
- In a wall piece's local space, the wall runs along +X from 0 to 3. The outside face is at y = 0, and the inside is toward +Y.
- The pieces are placed at 90° yaw steps around the footprint.

## Every placed piece: extras

- `piece`: the kit piece name, for example `wallB_window`, `floor_hole`, `stair` or `ladder_2f`.
- `slot`: where it sits. `L1_S0_B2` means level 1, side 0 (front), bay 2. `L1_F0_1` is the floor cell at x 0, y 1. `X#` means an extra piece such as a stair or ladder.
- `piece_id`: `BK_TestHouse/<slot>`, unique within the city.
- `state`: `"intact"`. Suggested other values are `damaged`, `destroyed`, `burning`, `burnt` and `repairing`.
- The building root (the empty `BK_TestHouse`) has `building`, `footprint_bays` [3, 2], `bay_m`, `floor_m`, `levels` and `state`.

## Moving parts (child objects, pivot on the hinge)

Each moving part has its own box collider as a child, named `col_*` with `collider: true`. This follows the same convention as the breakables GLB.

**Hinged door** (`door: "hinged"`)
- It rotates around its local Z (up), and the pivot is the hinge edge.
- `open_min_deg` is -100 and `open_max_deg` is 100, so it swings both ways.
- `width` is 1.04 m. `breakable: "door"`, `hp` 40.
- Door wall variants are `_door_L`, `_door_C` and `_door_R`, depending on where the door sits in the bay.

**Window glass** (`breakable: "glass"`, `hp` 5, `blowout: true`, `panes: 2`)
- It is a clear pane now, using material `BK_M_glass`: light blue, alpha 0.32, alpha-blended and double-sided. It has three white toon glint streaks (`BK_M_glint`) that belong to the glass object, so they vanish with it.
- The window frame (sash) and the center mullion are part of the wall, never break, and split the window visually into two panes.
- The pivot is at the center of the pane.
- On break, hide it and spawn glass shards or particles.

**Roll-up shutter** on the wide opening (`door: "rollup"`)
- The pivot is on the top edge.
- `travel` is 2.6 m. Slide or scale it up by that amount to open it.
- `breakable: "shutter"`, `hp` 80.

**Roof hatch lid** (`door: "hatch"`)
- It rotates around its local X, from 0 to 110°. `hp` 60.

## Breakable walls (the `wallB_*` pieces)

- Each wall is ONE mesh. Every vertex has a float attribute holding the chunk id. The exporter upper-cased its name, so in three.js it is `geometry.attributes._CHUNK` (the wall's `chunk_attr` extra says the same).
- Vertices with `-1` belong to the trim that never breaks: window and door frames, sills, and the floor band. Door frames and corners stay standing, as intended.
- The object extras hold `chunks`, a JSON string with a list of chunk records. Each record has:
  - `id`
  - `box`: [x0, y0, z0, x1, y1, z1] in the wall's local space
  - `hp`: 20
  - `anchored`: true when the chunk touches the floor or the bay's side edges
  - `nb`: the ids of neighbouring chunks
- A 3 × 3 m bay is about 4 × 4 chunks, fewer around openings. Each chunk is a closed jittered block. Its broken edges use a concrete "core" material, and chunks that border an opening use trim.
- Chunk boxes are in Blender axes (Z-up). To get three.js local space, map each corner (x, y, z) to (x, z, -y) and re-sort the min and max, then apply the wall's world matrix.
- Walls have NO baked collider. The game builds colliders from the chunk boxes: convert each `box` as above and multiply it by the wall's world matrix, which gives an oriented box.

Suggested runtime:
1. On the first hit on a wall instance, clone its geometry. Instances share mesh data.
2. When a chunk's hp reaches 0, collapse or hide its triangles and remove its collider box.
3. Spawn a debris copy of those triangles with a little impulse and spin, around the center of its `box`.
4. Then flood-fill from the anchored chunks through `nb`. Any chunk that is no longer connected falls as debris too.
5. Add impact decals from `impact_marks` as before.

## Static collision (building_kit_test_collision.glb)

This uses the same prefixes as the city:

- `deck_`: walkable floor and roof slabs.
- `ramp_`: the stair ramp. It is walkable and has a slope of 3 m over 5.4 m, plus a landing.
- `bld_`: solid parts: parapets, corner posts and the hatch curb.
- `solid_` with material `metal`: the stair-hole railing. It is a grind rail.
- `climb_`: NEW. This is a ladder volume box with extras `climb: true` and `climb_top` (world Z of the top in Blender units, which is Y in glTF). While the player is inside it and pushing forward, switch to climbing. Moving up past `climb_top` sends the player to the matching `nav_ladder_top` marker.

## Markers (empties in the visual GLB, all parented under the building root)

| Marker | What it is |
|---|---|
| `room_L<lv>_<x>_<y>` | Center of each floor cell, 1 m up. `marker: "room"`, `fire_spawn: true`, `room`, `level`. Use these for fire spread (grid neighbours) and for firemen's targets. |
| `nav_door_out__<slot>` / `nav_door_in__<slot>` | Standing points 1.3 m outside and inside each door and wide opening. `door_piece` gives the door's `piece_id`. |
| `nav_repair__<slot>` | A ground point 1.2 m out from each wall bay, for workers. `wall_piece` is the wall's `piece_id`, and `work_z` is the height of that wall's floor (for a scaffold or lift). |
| `nav_ladder_bottom__X#` / `nav_ladder_top__X#` | The ends of each ladder. |
| `nav_fire_truck` | Truck parking spot 7 m in front of the building. |
| `nav_hose` | Where the fire hose stands. |
| `nav_police` | Where police stand. |

## Test house layout

- **Size:** 3 bays wide by 2 deep (9 × 6 m), with two floors and a roof with a parapet.
- **Ground floor:** the front has a window, a center door, and the wide shutter opening. The back has a center door.
- **Stairs:** they run along the back wall and come up through the `floor_hole` cells onto the second floor. A railing runs along the hole.
- **Interior ladder:** from the second floor up through the roof hatch, in the front-right corner.
- **Exterior ladder:** on the right wall, from the ground over the parapet onto the roof.

## Pipes and ivy (new)

- **`BK_TestHouse_pipes`**: one mesh per building, parented to the root.
  - A walker generates the pipe runs on a 0.5 m grid over the outside walls. It only moves straight or turns 90°, so each run is straight segments joined by elbows, with collars.
  - A run steers around windows, doors and the ladder, and wraps around corners.
  - Each run either dives into the wall or hooks over the parapet onto the roof.
  - Extras: `pipes` is the number of runs. It doesn't break yet, so treat it as decoration, or use the wall colliders.
- **`BK_TestHouse_ivy`**: one mesh per building.
  - Every leaf vertex has `_HOST`, an index into the object's `hosts` extras, which is a JSON list of wall `piece_id`s. It also has `_CHUNK`, the chunk id on that wall.
  - When a wall chunk is destroyed, hide the ivy leaves whose host and chunk match, so ivy never floats in mid-air.
  - `-1` means the leaf isn't on a breakable chunk: it's on a parapet or trim, and it stays.

## Generated buildings (new)

The files:
- **building_kit_generated_visual.glb**: four buildings made by the generator (`BKG0` to `BKG3`), built from the same kit pieces.
- **building_kit_collision.glb**: the static collision for the generated buildings plus the test house, with the same prefixes as before. It replaces `building_kit_test_collision.glb`.

Building roots:
- Each root empty has extras `building`, `seed`, `cells` (a JSON list of [x, y] 3 m grid cells) and `heights` (JSON: "x,y" to the number of floors).
- A building is any footprint of 3 m cells (rectangle, L, notch or step) and each cell can have a different height, so there are setbacks with lower roofs.

Slot names for walls are `L<lv>_W<x>_<y>_<s|e|n|w>` (level, cell, which side of the cell). Corners, floors and extras work as before.

What every generated building gets:
- A stair between each pair of floors, alternating direction, with the stair hole and railing.
- A roof hatch with an interior ladder.
- One exterior ladder that runs the full height of a side or back wall.
- Parapets on every roof edge that drops away, and corner posts wherever the wall turns.

Dressing, all parented under the root:
- **`<name>_pipes`**: pipe runs made by the grid walker, as described above.
- **`<name>_ivy`**: ivy leaves, tagged with `_HOST` and `_CHUNK`, as described above.
- **`<name>_dressing`**: one mesh holding awnings and shop signs, tagged with `_HOST` and `_CHUNK` the same way as the ivy. When the chunk an awning or sign hangs on is destroyed, drop or hide the faces tagged with it.
- **`<name>_ac#`**: AC units. These are separate objects using the AC model from the city. Extras: `breakable: "ac_unit"`, `hp` 30, `host` (a wall `piece_id`) and `host_chunk`. When that chunk goes, the AC unit falls.

Markers are the same set as on the test house (rooms/fire, door in/out, repair, ladder ends, truck, hose, police), and they are prefixed with the building name.

## Styles (new)

- Each generated building has a style. There are seven: `brick`, `teal`, `mustard`, `pink`, `bluecrete`, `oldbrick` and `tin`.
- A style picks the exterior wall tile, the paint color, the trim and window-frame colors, and the interior and floor materials.
- The building root and every piece carry `style` in their extras.
- Every style has the same geometry, chunk tables and colliders. Only the materials and vertex colors differ, so the game logic doesn't care about style.
- The demo now has six buildings (`BKG0` to `BKG5`), one per style except `tin`.
