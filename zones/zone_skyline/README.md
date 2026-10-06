# zone_skyline (r83, park phase 1): Skyline Skate City

The world skeleton and hero art from before, now with the **tested ramp kit** placed over it as `fn_` pieces. The game builds each one from its own kit, so they should ride the same as your kit test level. `check()` came back clean. **Not ridden yet.**

## Files

- `zone_skyline_collision.glb`: 1.4 MB, uncompressed, extras on.
  - 9,593 custom triangles: island tops, tower decks, junction pads and building boxes.
  - 244 `fn_` kit pieces (see below).
  - 169 rails: 84 with `boost`, 19 closed.
  - 21 launchers, 4 trampolines, 1 spawn, 10 fast-travel spots.
- `zone_skyline_visual.glb`: 4.9 MB, Draco + WebP.
  - One mesh, about 342k triangles.
  - 6 materials: `WK_G_plaster`, `WK_G_tile`, `WK_G_rock`, `WK_G_moss`, `WK_G_metal` and the zone atlas.

Place it at the origin. Blender coordinates; glTF = (x, z, −y). Spawn is at the start plaza (Blender −103, −64, 0).

## What changed: the kit does the riding now

Every surface you skate on, apart from the flat island tops and decks, is now a kit piece.

| Kit piece | Count | Drawn? | What it is |
|---|---|---|---|
| `walk` | 64 | no (art drawn over it) | Every walkway, sky road and ramp road. The path is a smoothed centreline, with kit rails on the edges. The roads are 35% wider than before, 9 m minimum. |
| `wall` | 2 | no | The clover bowl (XL, 4.8 m deep) and the back-lot pool (L, 3.6 m deep), rebuilt from the kit's bowl wall. |
| `qp` | 51 | yes | 35 quarter pipes against building walls (XL, XXL or MEGA, sized to the building's height, up to 3 per building) and 16 L quarter pipes around island rims, facing inward. |
| `halfpipe` | 2 | yes | The back-lot halfpipes. |
| `kicker` | 21 | yes | |
| `frustum` | 7 | yes | Funboxes. |
| `spine` | 10 | yes | |
| `ledge` | 37 | yes | |
| `rail`, `railKink`, `rainbow` | 16, 16, 17 | yes | |
| `loop360` | 1 | yes | |

The drawn pieces are plain kit placeholders for now. In phase 2, art goes over them and they switch to `draw:false`.

The old custom bowl, halfpipe, kicker and funbox meshes are gone from the collision. The old road floors are gone too, so the kit walks replace them.

## Lines to skate

1. **Start plaza:** spawn → across the plaza → `rail_Rail_Snake` (gems) to the core → the square-spiral walk around the SK8 tower, up to 30 m.
2. **Building bases:** ride around any block in the SW streets, S streets or plaza. The QPs on the walls take you up to the roofs. The tall ones are MEGA.
3. **Bowl island:** the core → the bowl walk → the kit clover bowl. The rim QPs and scattered kickers, ledges and rails are on the same island.
4. **Back lot:** the core → the centre lot → the kit halfpipes, the kit pool and the loop.
5. **The 38 m walkway, the sky roads, the helix and the halo rings:** the same routes as before, now as kit walks with rails on their edges. Launchers still replace the lifts.

## Known risks (please report)

- **Walk joins.** Each walk starts and ends on the deck it meets. Tell me if any join has a lip or a gap.
- **Steep walks:** the big slide (about 41°) and some sky links (25–30°) are now kit walks. Tell me if the kit rejects or flattens any of them.
- **Density.** Only about 180 drawn pieces fit. Big pieces such as the rollin, the pipe and the free bowl failed the space checks, so the decks are not packed yet. Tell me where it feels empty.
- **Boost:** 84 rails have it, including some downhill ones.
- **Launcher arcs** may clip lanterns or bridges. Tell me which ones fail.
