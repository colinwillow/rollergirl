# Toon city with kit buildings: handoff

These files are in `3_LEVELS/toon_city/exports/toon_city_kit/`. They replace the files in `exports/toon_city/` if you switch over. The old set still works, so you can compare the two. Keep using `weirdkit_tint.js` from the old folder; it hasn't changed. Run `npm run ktx` after copying.

| File | Size | What it is |
|---|---|---|
| `toon_city_visual.glb` | 7.2 MB, Draco | The city: streets, props, trees, signs, the 11 hero buildings, and all kit-building pipes (`kit_###_pipes`, world space). |
| `toon_city_kit_buildings.glb` | 9.9 MB, no Draco (custom attributes) | The 60 kit buildings `kit_000` to `kit_059`. Each is a root empty with its pieces, doors, glass, AC units, ivy, dressing and markers underneath. |
| `toon_city_kit_pieces.glb` | 5.7 MB, no Draco | The piece library for all 7 styles, including the chunked `wallB_*` walls. Use these for swap-on-damage. |
| `toon_city_collision.glb` | 4.4 MB | The whole city's collision. The old building hulls are gone and the kit colliders are in, with the same prefixes as before. |

The kit buildings sit on exactly the lots the old buildings used. Each one faces its street, snapped to the 3 m grid and rotated with the lot. Ground props next to the buildings were kept: planters, dumpsters, crates and boxes. The wall AC units, shop signs and rooftop billboards from the old buildings were removed. The kit buildings bring their own AC units and signs.

The old OBB file (`toon_city_obb.json`) is out of date for buildings. Use the collision GLB for the kit buildings; its colliders are real rotated boxes.

## Intact vs. breakable walls (important, and new)

- To keep the draw and vertex budget sane, walls in the city use the cheap intact pieces (`wall_window`, `wall_solid` and so on). They have simple geometry and static `bld_` colliders in the collision GLB.
- Each wall has extras `breakable_as`, for example `"wallB_window"`, plus `style`. That names its chunked twin in `toon_city_kit_pieces.glb`. The twin has the same size, the same openings, the same pivot, and the same `chunks` table and `_CHUNK` vertex attribute as described in BUILDING_KIT_NOTES.md.
- On the first hit on a wall:
  1. Hide it.
  2. Spawn the matching `wallB_*` piece of the same style with the same world transform.
  3. Delete that wall's static colliders. Every kit collider has `piece_id` in its extras, the same as the wall's `piece_id`.
  4. Build chunk colliders from the twin's `chunks` table.
  5. From then on, break chunks as before.
- Ivy leaves, awnings, signs and AC units store the host wall's `piece_id` plus a chunk id. Chunk ids are identical between a wall and its twin, so hiding things when a chunk breaks works the same way.

## Everything else

The rest is unchanged from BUILDING_KIT_NOTES.md:
- doors, glass, shutters and hatch lids with hinge extras
- ladders with `climb_` volumes
- stairs as `ramp_`
- `deck_` floors and roofs
- markers: rooms/fire, door in/out, repair, ladder ends, truck, hose and police, prefixed with the building name

Building roots also carry `replaces` (the old building's name), `style`, `seed`, `cells` and `heights`.

## Performance: please watch this

- There are 60 buildings and about 9,600 nodes in the kit GLB. Most of them are pieces that share meshes, plus marker empties.
- Rendered one mesh per piece, this is thousands of draw calls, which is far too many for the phone.
- Suggested approach:
  1. At load, merge each building's static pieces by material (BufferGeometryUtils.mergeGeometries). Keep a per-vertex wall index so one wall can be cut out when it gets swapped for its chunked twin.
  2. Or use InstancedMesh per (piece mesh, style).
  3. Skip interior meshes (floors, stairs, interior faces) for buildings the player isn't near, or near-cull them.
- Marker empties need no draw calls, but don't add them to the scene graph as Object3Ds if you don't need to. Read their positions into a table instead.
- The collision GLB has about 7,700 small objects. Merging static boxes per building on load will help. Keep the wall boxes separate by `piece_id`, because walls need to be removable.

## Stations (new)

Two kit buildings were replaced by stations. Each station is a normal kit building, with the same pieces, chunks, markers and collision rules, plus a few extras.

**`fire_station`** (style `firehouse`, red brick, 3 × 3 cells, 2 floors plus a 4-floor hose tower at the back corner)
- The ground-floor front has two roll-up garage doors and a door. The stairs are in the back row, so the garage floor is clear for trucks.
- `fire_station_emblem` is the Maltese-cross plate on the front and the two red beacon lamps (material `BK_M_beacon_red`, emissive). It has `host`/`host_chunk` extras like the AC units.
- `fire_station_letters` is "FIRE DEPT" on the front parapet.
- Markers:
  - `fire_station_truck_home_0` and `_1`: `marker: "fire_truck_home"`, inside each garage bay. `garage_piece` is that bay's `piece_id`, so the game can open the right shutter.
  - `fire_station_firemen_spawn`.
- The upper floors of the hose tower are for looks only; no stairs reach them.

**`police_station`** (style `police`, blue-gray concrete, 4 × 3 cells, 2 floors)
- The front has a double entrance: a `door_R` and a `door_L` meeting in the middle, with blue lamps on both sides (`BK_M_beacon_blue`).
- A badge emblem (star on a gold shield) sits above the entrance.
- "POLICE" letters are on the parapet, and a flagpole stands out front. All of these are in `police_station_emblem` and `police_station_letters`.
- Markers:
  - `police_station_police_spawn`: inside the entrance.
  - `police_station_car_park_0` and `_1`: `marker: "police_car_park"`, at the curb.

Both roots carry `station: "fire"` or `"police"` and `replaces` (the kit building they replaced).

## Anti-tiling (new): weirdkit_detile.js

- **What it's for:** tiled ground and wall textures looked obviously repeated. This shader patch breaks that up with world-space noise.
- **How to call it:** after all the GLBs are loaded and after `applyWeirdKit(...)`, call `applyDetile([cityVisualRoot, kitBuildingsRoot])`. The patch chains any existing `onBeforeCompile`, so the tint patch keeps working.
- **What it reads:** `material.userData.wk_detile`, a JSON string from the Blender material extras.
- **Modes:**
  - `reveal` (used on `WK_M_brick_peeking_through_plaster`): shows clean plaster (`WK_M_stucco_or_plaster`) everywhere, with the brick-peeking texture only in random patches.
  - `self` (grass, dirt, asphalt, concrete, roof gravel): blends the texture with a rotated and rescaled copy of itself in soft patches.
  - `macro` (brick, stucco, siding, tin, floors, sidewalk): only a slow brightness wobble.
  - Grass also gets dirt patches from `WR_Dirt`.
- **Cost:** 1 to 3 texture samples and a few value-noise evaluations per pixel, on those materials only. If the phone struggles, `applyDetile(roots, { macroScale: 0 })` removes the macro wobble. Skipping the call entirely restores the old look.
- **Tuning:** every parameter (`freq`, `coverage`, `edge`, `macro`, `uv_rot_deg`, `uv_scale`) lives in the extras, so it can be tuned in Blender or overridden in code.

### Variation tiles (update)

- **New mode `mix`:** the material's own texture shows everywhere, and a partner texture shows in noise patches. The partner may be rotated or offset through `uv_rot_deg`, `uv_scale` and `uv_offset`.
- **New pairs:**
  - painted brick `WK_M_brick` with `WK_M_brick_b` (a second paint pattern), plus `WK_M_brick_raw` (raw red brick) as an extra patch layer
  - siding `WK_M_horizontal_wood_siding` with `WK_M_siding_b` (peeling)
  - grass `WR_Lot` with `WR_Grass_b` (clover and flowers), plus dirt
  - sidewalk `WR_Stone` with `WR_Sidewalk_b` (stained)
- **Carrier meshes:** these partner textures aren't used by any visible mesh, so the visual GLB has tiny meshes named `dt_carrier_*`, with extras `dt_carrier: true`, that only carry them. `applyDetile` hides them automatically. Keep them loaded.
- **New `redbrick` style:** six former `brick` buildings (`kit_001`, `008`, `018`, `028`, `034`, `044`) now use the untinted raw red brick (`WK_M_brick_raw`, vertex tint white). Their `style` extras say `redbrick`, and the chunked twins for that style are in the pieces GLB.
