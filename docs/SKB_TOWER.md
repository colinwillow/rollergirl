# The SKB tower (r148)

Built from his front-view concept painting with the slice's own builders (`buildSkb` in `index.html`). Local frame: x across the
front (left to right), z toward the viewer, y up; the lot is centred at world (-256, -67), front facing +z.

## Levels and the line

| level | height | what |
|---|---|---|
| plinth | 0.15 | grey slab, kerb height |
| podium (L1) | 4.95 | deck over the shutter; QP XL at each end with its coping flush (drop in) |
| left balcony | 8.15 | bunny pier under it, glass pod over it |
| L2 | 10.15 | tower side deck + deck across the tower front + SKB block roof |
| right balcony | 8.15 | mushroom pier, beacon pole; open front drops to the podium |
| top-right pod roof | 16.15 | wings only |
| top-left dish deck | 16.55 | wings only |

Stairs + bank (front left) -> podium -> R1 -> left balcony -> R2 -> L2 -> R3 -> right balcony -> drop to podium. Every orange
railing is a grind rail and a 0.9 m wall.

## Art it needs (everything on it now is a placeholder)

Paint/texture sets (tiling, ~1024 px, plus a normal or height map if he has one):
1. **Cream weathered concrete** -- the main walls (podium, tower, SKB block, piers), with drips and grime toward the bottom.
2. **Teal painted metal/panel** -- the panels, pier faces, pod sills, fascia under every deck.
3. **Orange painted trim** -- deck edge bands, pod lids, the tower cap (can be flat colour + grime).
4. **Rolling shutter** -- grey corrugated, tiling vertically.
5. **Pod glass** -- teal-tinted window with frames and a little reflection; and the tower's big window band.
6. **Grey slab / plinth concrete** with joints.
7. **Ramp/QP surface** -- the purple QP faces and the grey ramp decks (the QP faces want their graffiti baked in, see below).

Decals (PNG with alpha, square-ish, drawn flat-on):
1. **Crown smiley** -- teal face with a purple crown on a cream panel (the tower's centre sign). Now: atlas `cat`.
2. **Pink smiley** -- the shutter. Now: atlas `smile` (yellow).
3. **Yellow bunny** -- the left pier. Now: atlas `bunny`.
4. **"SKB" graffiti tag** -- orange/purple bubble letters on the SKB block. Now: atlas `sk8` (neon sign).
5. **Pink mushroom** -- the right pier. Now: atlas `alien`.
6. **Pink squid/octopus** -- the small one by the left door.
7. **Peace sign** -- right side, low.
8. **Small tag** ("BRKE" or similar) under the pod on the SKB block.
9. **Two QP graffiti pieces** -- the big purple/pink/yellow splash on each quarter pipe face (shaped to the QP side profile).
10. **Grime / water-stain strips** -- vertical drips for under every deck edge and down the tower.
11. **Ivy / hanging vines** -- the existing `vine` card works; a denser hanging-moss card would match the painting better.

Props that would replace procedural stand-ins: AC unit (3-fan and 1-fan), wall utility boxes, the satellite dish, antennas
with the red ball, bins, the bench, potted plants, the beacon pole.
