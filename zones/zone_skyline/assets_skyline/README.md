# Skyline asset pack v1

48 drop-in models in the Skyline style: pastel stucco, pink and lavender trim, glowing windows, stickers, moss, trees,
crystals and waterfalls. Each one is its own GLB, so the world can place them anywhere.

They are **art only**. Nothing here is a riding surface or a collider. Put tested ramp-kit pieces, `bld_` boxes or
`deck_` floors under or around them where she needs to ride or bump into something.

## Files

Everything is in `skate_city/exports/assets_skyline/`:
- `<NAME>.glb`, one per asset;
- `catalog.json`, which lists every asset with its kind, size (w × d × h in metres), how far it hangs below its origin, file size and a one-line description.

Units are metres, Y-up (glTF). Each asset's origin is at the centre of its base, except:
- **sky islands and gardens:** the origin is on the walkable top deck, and the rock, crystals and waterfalls hang below it;
- **waterfalls:** the origin is at the top, and the water hangs down.

## Materials

There are about 20 shared materials: stucco, tile, concrete, iron, panels, moss, rock, crystal and glow. The colour
variety comes from **vertex colours** (tint and baked AO) multiplied over the base textures. Each GLB embeds its WebP
textures, which is most of its size (about 1.5 to 3 MB each).

The glTF exporter warns about one thing: vertex colours across several materials. Read `COLOR_0` and multiply it into
every material's base colour.

## What's in the pack

| Kind | Assets | Notes |
|---|---|---|
| Landmark | `SK8_TOWER` | The skate HQ castle: 102 m tall, crown, 50 m deck, SK8 signs. |
| Landmark | `MARKET_WEST` | Stacked shop pile, 47 m. Stairs, billboard, awnings. |
| Landmark | `MARKET_EAST` | Shop stack, 36 m. Balcony and roof ledge. |
| Landmark | `START_PLAZA` | Logo plaza with rings, star totem and lamps. It also has a tall light beacon (95 m). |
| Landmark | `GARDEN_NORTH`, `GARDEN_SOUTH` | Alien garden islands with an egg pod, crystals and trees. Waterfalls hang 60 m below. |
| Tower | `TOWER_A` to `TOWER_H` | Lighthouse-style towers, 22 to 90 m. Round or square bodies, ring decks with railings, lanterns and spires, glass lift tubes, moss, planters. |
| Building | `BUILDING_01` to `BUILDING_16` | Pastel blocks, 10 to 34 m tall, from small shops to wide warehouses. Windows (some lit), stickers, trim bands, AC units, drainpipes, and a roof planter, water tank or antenna. Every one is different. |
| Sky island | `SKY_ISLAND_01` to `SKY_ISLAND_12` | Floating rock islands with grass and planters on top, crystals and moss underneath. Small ones are about 12 m across; big ones (08 to 12) are 18 to 35 m. Number 10 carries the crystal spire (61 m). |
| Waterfall | `WATERFALL_*` | Six waterfall ribbons, 45 to 70 m long. Hang them off island edges. |

## Using them to fill the ground world

- **Skylines at region edges:** clusters of 3 to 6 `BUILDING_*`, with a `TOWER_*` behind them, along the borders of open regions. They give height and silhouette without cluttering the riding space.
- **Centrepieces:** one landmark per region, such as the SK8 tower or a market stack, with open space around it for ramps.
- **The sky layer:** `SKY_ISLAND_*` at 30 to 90 m above the ground, with `WATERFALL_*` off their edges and the towers' ring decks as stepping stones.
- **Riding them:** for a roof she should land on, place a `bld_` box (or kit deck) matching the asset's w × d × h from `catalog.json`. Then put quarter pipes against it, the same way as the stage briefs.

## Rebuilding or making more

The Blender file is `skate_city/skyline_assets_v1.blend` (scene `Assets`), and the script is `asset_factory_v1.py`. Change the
`BUILD` (w, d, h) and `TOWERS` lists and re-run to get more variants. Every building and tower is generated from its
size plus a seed, so new ones are free.
