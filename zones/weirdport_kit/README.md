# Weirdport kit v1

Everything that makes Weirdport look like Weirdport, split into a kit instead of a level. It covers the painted street tiles (road, yellow chipped curbs, slab sidewalks, grass), the props, debris, plants and trees, the poles, signs, streetlights and bus stops, the breakables, the modular building pieces in every colourway, the 60 finished buildings, and the decal sheets.

The source is `3_LEVELS/toon_city/toon_city_kit.blend`. The kit was built in a copy, `weirdport_kit_build.blend`, so the original is untouched.

## How it's organised (and why)

Each file is a category, and every piece in it is a named root node. Load a file once, then clone pieces by name:

```js
const props = await loader.loadAsync('props/props.glb');
const dumpster = props.scene.getObjectByName('dumpster').clone();
dumpster.position.set(x, 0, z);
```

Pieces in one file share their textures, so the browser downloads and uploads each paint texture once rather than once per prop. Every root's mesh is centred on its footprint with its base on the ground. The files are laid out in rows so they're easy to look at in a viewer. Set the position when you place a piece.

The whole kit is about 25 MB of GLBs:
- Textures are WebP, 1024 px or smaller.
- There's no Draco or meshopt, so no decoder is needed. It also keeps the buildings' custom `_CHUNK` and `_HOST` attributes and the node positions exactly as they were.
- Run `npm run ktx` as with the other city files.

| File | Size | Contents |
|---|---|---|
| `streets/street_tiles.glb` | 2.7 MB | 22 × 22 m tiles: `street_straight`, `street_cross`, `street_tee`, `street_corner`, `street_deadend`, `street_lot` (grass). |
| `props/street_furniture.glb` | 1.3 MB | `telephone_pole`, `telephone_pole_transformer`, `streetlight`, `bus_stop`, and `street_sign_00` to `street_sign_24`. |
| `props/props.glb` | 0.7 MB | Building-side props: `planter`, `crate`, `dumpster`, `cardboard_box`, `ac_unit`, `vent`, `duct_elbow`, `electric_box`. Debris: `debris_hydrant`, `debris_rubble`, `debris_barrel`, `debris_bag_pile`, `debris_trash_bin`, `debris_trash_bag`, `debris_soda_can`, `debris_cup`. |
| `props/plants.glb` | 0.3 MB | 12 weeds, bushes, clover, dandelions, dry leaves and dirt clumps (`plant_*`). |
| `props/trees.glb` | 0.5 MB | `tree_round_tree`, `tree_pink_blossom`, `tree_banana_plant`, `tree_palm_small`, `tree_palm_mid`, `tree_palm_bushy`. |
| `props/breakables.glb` | 1.3 MB | The breakable set, unchanged from the city: lightpost, bench, trash bin, hydrant, dumpster, crate and barrel. Each has `brk_*_intact` and `brk_*_broken` chunk sets with `col_*` colliders. |
| `buildings/building_pieces.glb` | 2.5 MB | The modular building kit in all 15 colourways (default brick, bluecrete, oldbrick, mustard, pink, tin, teal, firehouse, police, redbrick, coral, sky, sage, bluewash, lilac and mint). It has walls (solid, window, door L/C/R, wide with shutter, parapet), corners, floor, floor hole, roof, roof hatch, stair and ladders, plus the breakable `wallB_*` twins with chunk data. |
| `buildings/kit_buildings.glb` | 14.5 MB | The 60 finished buildings, `kit_000` to `kit_059`, each with its pipes, AC units, signs, ivy, doors, glass and marker empties. They're laid out on a grid with no rotation, and the origin is at the building's front-left corner. |
| `materials/detile_carriers.glb` | 0.5 MB | Tiny hidden meshes that carry the partner textures (grass_b, sidewalk_b, brick_b and the worn variants) used by the anti-tiling shader. |
| `decals/` | | `paint_atlas.png` + `paint_atlas.json` (the paint globs, murals and graffiti), `graffiti_paint_sheet.png`, `sticker_sheet_6x6.png`. |
| `js/` | | `weirdkit_tint.js`, `weirdkit_detile.js`, `weirdkit_iridescent.js`: the shader patches that make three.js match the Blender look. |
| `buildings/BUILDING_KIT_NOTES.md`, `CITY_KIT_NOTES.md` | | The original notes on doors, glass, chunked walls, markers and colliders. They still apply. |
| `catalog.json` | | Every node in every file, with its size in metres. |

## Making it look like Weirdport in the game (important)

The look isn't just in the textures. Three things have to happen after loading:

1. **Tint:** call `applyWeirdKit(root)` on every loaded file. Materials carry `wk_tint` extras, and the paint parts of the texture are tinted by the vertex colour. Without this, buildings and curbs come out plain white (the old "white buildings" bug).
2. **Anti-tiling:** call `applyDetile([...all roots, carriersRoot])` after the tint, and include `detile_carriers.glb` in that list. Materials carry `wk_detile` extras.
3. **Iridescent crystals:** `applyIridescent(root)`, only where those materials appear.

Vertex alpha is grime and ambient occlusion, so keep `vertexColors` on.

## Collision and the street grid

- Nodes named `col_*` are colliders. Hide them and use them as collision. They're on the breakables and on the building pieces' moving parts.
- Building walls and floors use the conventions in BUILDING_KIT_NOTES.md: `bld_`, `deck_`, `climb_` and `ramp_` built from the piece extras.
- Street tiles have no colliders. The road is at height 0, curbs are 0.34 m (under her 0.42 m roll-up limit), and the sidewalk and grass sit at about 0.2 to 0.33 m.
- Street tiles are a 22 m grid: a 10 m road, 0.55 m curb, 3.6 m sidewalk and 2.4 m of grass each side.
- Straight tiles run along X. Rotate them in 90° steps. Edges line up with any other tile's road edge.

## Known gaps

- Overhead wires between poles aren't in the kit (they were one merged mesh across the whole city). A simple line or tube between pole crossarms would replace them.
- `brk_dumpster_*` in `breakables.glb` is at its original small scale (0.32 m), as it is in the city file. Scale it about 4.4× to match `dumpster`.
- Yellow centre dashes don't phase-match perfectly between two straight tiles.
- Untested in the game.
