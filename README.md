# Rollergirl

A mobile-first rollerblading game. Single-file Three.js r180 in `index.html` — native ES
modules, an import map, vendored three, **no build step**. Open the file and it runs.

- **Left stick on the ground** — where she goes. It is a *heading*, not a torque: she comes
  round onto it and skates away. Held forward she pushes; held behind she brakes, and once she
  has stopped the same held thumb turns her round and pushes off the other way.
- **Left stick in the air** — the *body*. Left/right spins her, up/down flips her, both about
  her own axes. She leaves a ramp holding the angle of the face she left, so off a vert wall she
  is sideways until you turn her. Land more than about 54 degrees out of square with whatever
  you come down on and she loses it.
- **Right stick** — **tap** to jump, **drag** to orbit the camera. Yaw only, in a circle;
  there is no pitch on that stick by design. Let go and the lens comes back behind her.
- Keyboard: WASD / arrows, space to jump, R to respawn.

The park is procedural — a plaza, a half pipe with its own roll-in, two quarter pipes, two
funboxes, two kickers, a bowl, and a banked wall round the lot. Every ramp's collider is the
same triangles the picture is made of, so there is one description of each surface and nothing
to keep in step.

## Working on it

```sh
npm run check    # ~4s: the module parses AND evaluates. Run before every push.
npm run sim      # ~3s: drives the SHIPPED physics over the REAL park, headless.
npm run bump     # raises BUILD, hashes the assets, writes version.json. Run before every push.
```

`npm run sim <case>` runs one of `push brake carve jump carry vert rotate bail pipe pump kicker
bowl inside solid anim clips`. `SIM_PROBE=tools/x.mjs npm run sim` runs a one-off trace instead.
`npm run clips` reads what is actually in each animation — how many bones move, and by how much.

Everything tunable is on `window.rg` — `rg.SK`, `rg.AIR`, `rg.CAM`, `rg.RIG` — live, from the
console. `rg.pipe()`, `rg.bowl()` and `rg.tp(x, z)` drop her where you want to look.
