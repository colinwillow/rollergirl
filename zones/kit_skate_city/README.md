# Skate City kit v1

The first skate city environment from `skate_world.blend` (scene "Scene"), split into 68 standalone textured pieces. It
is a kit, not a level: buildings, ramps, rails and highway/bridge pieces you can place anywhere.

## Files

Everything is in `skate_city/exports/kit_skate_city/`:

| Folder | Pieces | What it is |
|---|---|---|
| `buildings/` | 9 | The hero buildings from his reference images: `SciFiTower`, `SkatePark`, `KickflipShop`, `FloatIsland`, `SkatePlatform`, `CosmicFuel`, `SkyBridge`, `AlienIsland`, `SkateHQ`. Each is 12 to 37 m across and 12 to 32 m tall, fully dressed with railings, lights, stairs, signs, decals and paint. |
| `ramps/` | 38 | The painted ramp kit: quarter pipe, half pipe, bowl, bank, funbox, spine, launch ramp, wall ride, curved wall, stair set, ledge, manual pad, hubba, stair rail, kicker, wedge, hump, mini quarter, rails (flat, round, kink, curve), big wedge, tall kicker, loop, and the `Plat_*` and `RG_*` variants. |
| `rails/` | 10 | Rail shapes: S-curve, kink, rainbow, spiral, over-funbox, double, angle ledge, flat bar, bracket, HQ slide. |
| `highway/` | 11 | The neon bridge/highway kit: four hubs (9 to 21 m tall columns with decks), spans between hubs, a loop span, ramp in, ramp out, and a 130 m demo path. |
| `catalog.json` | | Every piece's file, size (w × d × h in metres), part count, file size and a note. |

Units are metres, Y-up. Each piece's origin is at the centre of its footprint, on its lowest point. Files are compressed: about 28 MB for the whole kit, 1 to 3 MB per building and under 0.5 MB per ramp.

## Loading (one line needed)

Meshes use meshopt compression, so the loader needs the meshopt decoder. It ships with three.js and needs no extra files:

```js
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
loader.setMeshoptDecoder(MeshoptDecoder);
```

Textures are WebP, capped at 1024 px on buildings and highway pieces and 512 px on ramps and rails. Each piece's parts are merged by material, so a building is about 10 to 20 draw calls instead of hundreds.

## The important part: these are ART, not riding surfaces

These ramps came from the early Blender work, before the game kit existed. Ridden as raw geometry they rode badly. Use
them as the **look**, with the **game's tested `fn_` pieces underneath as `draw:false` colliders**, sized to match:

| Art piece | Matching game kit piece (collider) |
|---|---|
| `QuarterPipe` (3.4 m) | `qp L` |
| `MiniQuarter` (1.2 m) | `qp S` |
| `HalfPipe` (3.9 m) | `halfpipe L` |
| `Bowl` (2.3 m, 12 m across) | `bowl M` / `freeBowl M` |
| `BankRamp`, `RG_Bank` | `bank S` |
| `Funbox`, `RG_Funbox` | `frustum M` / `frustum L` |
| `SpineRamp` | `spine M` |
| `LaunchRamp`, `Kicker`, `TallKicker`, `Wedge`, `BigWedge` | `kicker S` / `kicker M` / `launch` |
| `StairSet`, `RG_Stairs`, `StairRail`, `HubbaLedge` | `stairs M` (with `hubba`) |
| `Ledge`, `ManualPad`, `RG_Ledge` | `ledge S` |
| `Loop` | `loop360 M` |
| `WallRide`, `CurvedWall` | `wall` (open path, facing in) |
| rails and the `rails/` folder | `rail_` lines along the bar, as the r83 spec describes |

Where an art piece doesn't match a kit size exactly, scale the art to the collider, not the other way round. The
collider is what she rides.

**Buildings** need `bld_` boxes (or `deck_` floors) for any wall she hits or roof and deck she should land on.
**Highway** spans want a kit `walk` (or a `deck_`) under the deck surface, plus `rail_` lines on the railings.

## Ideas for using it

- Hero buildings as landmarks in the open regions, with kit quarter pipes against their walls.
- The highway hubs and spans as an elevated neon route across a region. The loop span makes a showpiece.
- Ramp art over the kit pieces in any park, so the parks look painted instead of placeholder white.
