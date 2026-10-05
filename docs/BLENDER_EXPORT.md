# Rollergirl world export (game → Blender)

`npm run export` boots the real game headless, lets it build every district, and writes two files to `exports/`:

| file | what it is |
|---|---|
| `rollergirl_world.glb` (~24 MB) | the picture, plus rails and markers |
| `rollergirl_collision.glb` (~3 MB) | what she actually collides with, kept separate so the visuals can be redone freely |

Both are **uncompressed** (no Draco), in **metres** (1 unit = 1 m), with +Y up. Blender's glTF importer turns that into
Z up. Everything is baked into world space, so object transforms are identity, apart from the marker empties.
Re-run the export after any change to the world.

## `rollergirl_world.glb`

**Top-level groups**
- `hub` (the starting park), `slice` (the canal street, west), `orbital` (south), `shores` (Neon Shores, east),
  `city` (north) and `backdrop` (the far towers).
- The district a mesh lands in is decided by where it is.
- Object names are the game's own: `slice:paving@-3,0` is the slice's paving chunk in 48 m cell (-3, 0); `orb:…` is
  Orbital; `sky rails`; and so on.

**`rails`**
- Every grind rail, as an **edge polyline** (no faces), named `rail_<name>_<n>`.
- extras: `boost` (booster speed, 0 if none), `closed` (a loop), `link` (an auto-generated connector), `district`.
- The drawn tube meshes are in the district groups too. The polylines are the actual lines she grinds.

**`markers`**
- `markers_spots`: `spawn` and every ➤ stop as `spot_<name>` empties, rotated to the heading she faces there.
  extras: `kind: spot`, `spot`, `heading`.
- `markers_water`: `zone_water_<n>` flat quads at the water surface. extras: `kind: water`, `splash` (true means
  falling in puts her back where she stood), `surface_y`.
- `markers_launchers`: extras `kind: launcher`, `radius`, `target` (where it throws her), `apex`.
- `markers_boost_lanes`: centrelines. extras: `half_width`, `speed`, `accel`, `governed`.
- `markers_trampolines`, `markers_hydrants`, `markers_gems`: empties.

**Materials**
- Vertex colours plus PBR factors.
- The generated textures (paving, sandstone, masonry, plaster, wood, foliage, windows) and their normal maps are
  embedded as PNG.
- UVs on the slice pieces are world-projected in metres, with repeat wrapping.

**Not in the file**
- Her.
- His weirdport kit pieces and BKG0–3. Those are his Blender files already; the plain stand-in boxes are exported
  where the kit sits.
- The canvas-painted sign and mural atlas. There is no 2D canvas headless, so signs come out as bare quads.
- Particles, glow cards, the sky, the planet.
- The runtime detail shader (the world-projected paving, concrete and plaster on the park).

## `rollergirl_collision.glb`

It uses the same naming `levelIngest` reads back (see `BLENDER_HANDOFF.md`):

- **`deck_<district>`**: every floor triangle in that district. That is the ground, every ramp, bank, bowl and
  stair slope, and the top of every solid box.
- **`bld_<district>_<tag>_<n>`**: every solid as a box, turned about Y only.
  - extras: `kind: solid`, `tag` (what built it: `slice bld`, `hub deck`, `sky isle`, `bank end`, …),
    `top_is_floor`, `yaw`.

## Coming back

- **New buildings and pieces** come home through `LEVEL.imports`: a visual GLB plus a collision GLB in the handoff's
  naming, one line each.
- **Editing the procedural districts themselves** (moving a building the code generates) does not flow back
  automatically. The code would still generate the old one. Either that district switches from generated to
  imported, or the game session reads the moved positions back out of the edited file. Decide that per district
  when it comes up.
