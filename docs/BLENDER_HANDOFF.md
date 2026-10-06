# Rollergirl: building handoff (Blender → game)

> **r83: the level-building brief is `handoff/LEVEL_BUILDING.md`.** It covers every name the importer reads now
> (rails, lanes, markers, gems, trampolines, kit pieces). The art, material and budget rules below are still current.

This is a brief for a **separate Claude session working in Blender** on custom buildings for Rollergirl
(github: colinwillow/rollergirl, single-file Three.js r180 game, `index.html`). It describes exactly what the game's
importer does with a GLB, so what comes back drops in with one line of code and needs no guessing.

Give this whole file to the Blender session. When the buildings are done, hand back the files in the
**Return package** section (at the end) to the game session.

---

## 1. How the game reads an imported building

Each building set is one entry in `LEVEL.imports` in `index.html`:

```js
{ name: 'his buildings (BKG0-3)', vis: 'models/kit/building_kit_generated_visual.glb',
  col: 'models/kit/building_kit_collision.glb', at: [-125, 0, 175], yaw: 0 },
```

- `vis` is the picture and `col` is the collider. Collider objects can also go inside the `vis` file instead,
  as long as their names start with `col_` (those are never drawn).
- `at` / `yaw` place the whole file in the world: metres, plus a turn about +Y in radians. The game session
  picks the spot by measuring open ground, so **you do not need to know world coordinates**.

### The picture (`vis`)

1. **The hierarchy is flattened and merged PER MATERIAL.** Every mesh is baked into world space, and all meshes
   that share a material become one draw call. So:
   - **The material count is the draw-call count.** That is the whole reason to atlas, and atlasing pays off
     directly here.
   - Nothing stays a separate object. There are no animations, no moving parts and no per-object visibility.
     Tell the game session about anything that needs to move or break, and it will be handled separately (the
     fire hydrant is the only example so far).
2. **Only four vertex attributes survive: `position`, `normal`, `uv` (the first UV set), `color`.**
   - **A second UV set is dropped**, so a baked lightmap or AO map on UV2 will not show. Bake AO and dirt
     **into the base-colour atlas** (or into vertex colour) instead. If UV2 lightmaps are really wanted, the
     importer needs a small change first, so ask.
   - Tangents are dropped. Normal maps still work, because three.js derives tangents per pixel. Export with
     tangents off.
   - Vertex colour multiplies the base colour, so it is a cheap way to tint one atlas many ways.
3. **Materials are used as exported** (glTF PBR → `MeshStandardMaterial`): base colour, normal, roughness and
   metalness (ORM packed is fine), and emissive. The scene is lit by a painted sky environment map, a warm sun,
   a cool fill, a pink rim light and NEUTRAL tone mapping. In practice:
   - **Metalness 0** on almost everything (pure metal looks black without a matching environment).
   - Roughness 0.6–0.95 for plaster, brick and concrete.
   - **Emissive works well** for windows, neon and signs. It reads as lit in daylight with no bloom pass.
4. **Transparency: use alpha MASK (cutout), never BLEND.** A blended material sorts against itself and looks
   see-through. This is also how foliage, railings with holes, and decals with ragged edges should be done.
   (The current kit has one `BLEND` material, `WK_M_shop_signs`. Prefer MASK on new art.)
5. **Decals and signs:** imported materials get no depth offset, so a decal exactly on a wall will z-fight.
   **Float decals 1–2 cm off the surface.** Keep all decals and signs on **one atlas material** (MASK) so they
   cost one draw call.

### The collider (`col`, or `col_*` objects)

The importer reads **object names**. The prefix decides what each object is:

| name prefix | becomes | rules |
|---|---|---|
| `deck_` `ramp_` `ground_` `road_` | **floor triangles**, ridden exactly as modelled | Normals must face **up**. Anything up to ~88° counts as a floor, so ramps, banks and quarter pipes work. Downward faces are ignored. **Stairs: model a smooth SLOPE** under the step noses (on skates, real steps are a stammer). |
| `bld_` `solid_` `prop_` | an **oriented box** (a wall she bounces off, and **its top is a floor** she can land and ride on) | Each object is reduced to the smallest box around its vertices, **turned about Y only**. So make each collider a box, aligned or rotated in plan, never tilted. Split L-shapes and overhangs into several boxes. A box whose top is within **0.42 m** of the ground is a kerb she rolls up. |
| any of the above with a material named `*metal*`, longer than 1.2 m | also a **grind rail** along the top of its long side | This is how rails, ledges and copings become grindable. Rails fully inside a building are skipped. |
| anything else | ignored | e.g. `climb_` (ladders: planned, not read yet) |

**Gotchas**
- **Apply all transforms, and never use negative scale.** A mirrored object flips its winding. Its floor then
  faces down and is silently dropped, which reads in game as falling through the roof.
- **A roof is a `bld_` box top.** There is no need for a separate deck on top of a solid box. Use `deck_` for
  walkable things that are not on top of a box: balconies, bridges, walkways and sloped roofs.
- **There is no ceiling-only collider.** If she should go under an overhang, its box must start above head
  height (her capsule is 1.7 m tall).
- The collider should be *simpler* than the picture: tens of boxes per building, not hundreds. Keep it a little
  inside the visual walls, so she never visibly stops in mid-air.

### Optional: the generator's cell grid
The existing kit's building roots carry glTF `extras`: `cells` (a JSON list of `[x, y]` bays), `heights`
(JSON `{"x,y": floors}`), `bay_m` (3) and `floor_m` (3). If these are present, the game builds the wall
colliders from the grid itself: cell `x` maps to +X and cell `y` to −Z, from the root. This is only useful if
you keep using that generator. Hand-made buildings should use `bld_` boxes instead.

---

## 2. Units, axes, export settings

- **1 Blender unit = 1 metre.** For scale, she is about 1.6 m tall, jumps about 3.8 m high on the flat, and the
  grind rails in the park are 0.5–3.5 m up.
- Street level is **y = 0** at the building's origin. Put the origin at the **centre of the footprint, on the
  ground**.
- glTF export: **+Y Up on**, Apply Modifiers on, Selected Objects (one building set per file), no cameras or
  lights, no animation, **tangents off**, UV2 not needed.
- Compression:
  - **Draco: supported** (the decoder ships with the game). Use it on `vis`. Leave `col` uncompressed, because
    it is small anyway and it is easier to check.
  - **Textures as WebP** (`EXT_texture_webp`, already used by the kit). Quality 80–90 for colour; normal maps a
    little higher.
  - **Not supported yet: Meshopt and KTX2/Basis.** Do not use them unless you also tell the game session to add
    the decoders.

---

## 3. Budgets (it runs on a phone)

| per building set (one GLB) | target | hard ceiling |
|---|---|---|
| materials (= draw calls) | 2–4 (e.g. facade atlas, trim/props atlas, decal/sign atlas, glass/emissive) | 6 |
| triangles | 5–15k per building | 30k |
| texture size | 2048² per atlas | 2048² (no 4K) |
| file size (draco + webp) | 1–3 MB | 5 MB |

**Texture memory is the real limit on a phone**, not triangles. A 2048² RGBA texture is about 21 MB on the GPU
with mips, so ten of them is over 200 MB, and iOS kills the tab rather than throwing an error. **Share atlases
between buildings**: one facade atlas, one trim atlas and one decal atlas for the whole set is ideal. Reuse
beats variety here, and vertex colour can tint the reused atlas.

---

## 4. Style notes (so it matches what is already in the game)

- The world is a bright, painterly sci-fi city (pastel lavender plaza, peach ramps, pink/teal/purple neon,
  sandstone and plaster facades, palms). His concept paintings are the reference.
- Chamfer the edges a few cm. Bevels catch light, and sharp boxes read as CG.
- **Contact AO matters a lot:** darken walls toward their base in the baked colour. The procedural buildings do
  this per pixel, so imported buildings without it will look pasted on.
- Window frames and sills should stand proud of the wall. Glass goes slightly in front of the wall, not
  recessed into a solid wall.
- Skate-ability is the point. Ledges, planters, low walls and stair sets with handrails make good spots. Give
  them a `metal` collider box so they grind. Roofs at about 3–8 m are reachable with jumps and rails.

---

## 5. Return package (hand this back to the game session)

1. `models/<set>/<set>_visual.glb`: draco + WebP, as above.
2. `models/<set>/<set>_collision.glb`: named `deck_/ramp_/bld_/solid_/prop_` with `metal` rails. Or put
   `col_*` objects inside the visual file.
3. A short **README** for the set, containing:
   - each building's name, footprint (x by z metres) and height;
   - where its origin is;
   - which edges or objects are meant to be grindable or rideable (so the game session can test them);
   - any interactive or breakable parts;
   - material list with texture sizes, plus total triangles and file size;
   - suggested placement if there is a preference (e.g. "the north district", "beside the hub deck").
4. **Optional:** a screenshot or two from Blender, so the in-game result can be compared against it.

On the game side, the session then adds one `LEVEL.imports` line per set, picks open ground with its probe,
rides every listed feature through its headless physics harness (`npm run sim`), and fixes anything the
importer does not handle yet.
