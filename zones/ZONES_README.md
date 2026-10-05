# Rollergirl skate world: zone packages

These are built in Blender from `skate_city/skate_world.blend` (scene **World**) by the scripts in `skate_city/scripts/`.

## Setup

- Each zone is one set: `exports/zone_<name>/zone_<name>_visual.glb` plus `zone_<name>_collision.glb`.
- **All zones use world coordinates.**
  - Each set's origin is the world origin, so import every one at `at: [0, 0, 0], yaw: 0` and they line up with each other.
  - Units are metres, +Y up.
- The zones are floating islands. Below the islands is open sky down to about −60 m. Treat falling below about −40 m as "respawn at the last spot".

## Zones

| Zone | Where | Visual | Collision | Triangles | Rail lines |
|---|---|---|---|---|---|
| zone_skyline (centre: Skyline Skate City) | centre | 7.1 MB | 2.2 MB | 549k | 251 |
| zone_neon (Neon Block District) | east | 6.1 MB | 0.7 MB | 425k | 54 |
| zone_refinery (Refinery Riot) | south-east | 4.8 MB | 0.6 MB | 252k | 50 |
| zone_dustbloom (Dustbloom County) | west | 4.0 MB | 0.17 MB | 89k | 23 |
| zone_pyramid (Ancient Alien Pyramid Zone) | north | 3.8 MB | 0.42 MB | 123k | 19 |
| zone_canal (Canal Quarter and Bay Docks) | south-west | 4.5 MB | 0.49 MB | 175k | 49 |
| zone_steeps (The Steeps) | north-west | 5.7 MB | 0.38 MB | 320k | 42 |
| zone_skytrain (Sky Train loop + stations) | ring around everything | 0.76 MB | 0.03 MB | 47k | 2 |

Triangle counts are well over the handoff's per-building budget, because each file is a whole district. For phones, plan to stream zones by distance. Generated buildings are about 4.5k triangles each and are the obvious thing to LOD or decimate next.

## What is in each collision file

- **`bld_*`**: yaw-only boxes. Their tops are floors. This covers island decks, buildings, containers, tanks and the rest.
- **`prop_*`** (material `metal`): grindable ledges and copings, plus fence boxes under railings.
- **`ramp_*`**: floor triangles, normals up. This covers ramps, banks, bowls, quarter pipes and the pyramid faces. Every stair set is exported as a smooth slope.
- **`rail_*`**: edge polylines, glTF LINES. These are the exact grind lines: sloped, curved, spiral and looped. They are the same format as the world export's rails.
  - extras: `kind: rail`, `closed`, `boost: 0`, `grind_radius`, `grind_path_gltf`.
  - **The importer needs to read these.** Most of the good lines are curved, spiral or looped, so the metal-box rule can't express them.
- **`zone_water_*`**: water surfaces as flat quads. extras: `kind: water`, `splash`, `surface_y`, and `hazard: lava` on the refinery smelter pit.
- **`marker_launcher_*`**: launch pads.
  - extras: `radius`, `apex`, `pos_gltf`, `target_gltf`, where `target_gltf` is the landing point in game axes.
  - Every launcher has a real landing spot: a roof, a sky island, a crane top or a station.
- **`marker_spot_*` / `marker_spawn_*`**: spawn and fast-travel spots, with `spot` names.

## Game-side notes

1. **Read `rail_` polylines.** Without this, spiral rails (refinery stacks, silos, lighthouse), loops and every sky chute won't grind.
2. **Loop-de-loops and upside-down.** There are loop tracks in every zone, plus the ferris wheel rim in the Canal zone (a vertical circle grind). They need the "stick to surface above a speed threshold" physics change.
3. **Launchers.** Pads use `target_gltf` + `apex`, the same idea as the existing launchers.
4. **Shared textures.** Every set embeds the same `WK_G_*` tile images (concrete, plaster, brick, metal and so on). Cache textures by name so phone memory pays for each tile once.
5. **Glow.** Neon edges, rails and signs are emissive through the atlas emissive map. They read best at dusk or night.
6. **Hero buildings** (Skate HQ, Kickflip, Cosmic Fuel, Sci-Fi Tower, Skate Park, Skate Platform, Float Island, Alien Island) are baked into `zone_skyline`.
