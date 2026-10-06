# Wishlist: what the r91 kit could not do yet

Things his park photos (and his combo list) asked for that the kit does not have, or has only as a stand-in. Each line
says why, so the next attempt starts from the reason and not from scratch.

## Can't be built on this collider

- **Wall rides, over-vert, anything vertical or overhanging.** The collider answers "the floor under this x,z". A vertical
  face has no footprint in plan, and a surface she rides upside down has no floor under it. Transitions top out at 85-88 deg.
- **A loop as a surface.** The 360 and the 180 are booster RAILS for the same reason. A ridden loop needs a different
  collider (a swept surface with its own up vector), not a new piece.

## Not built yet (buildable)

- **A spine with a rounded ridge.** Every spine here has a crease at the top, which launches her (see RAMP_KIT.md,
  Combos). The mini ramp's centre and the triple wave use rollers instead. A rounded ridge (the roll-in's `lipR`, on both
  sides) would let the mini ramp and the wave be spines again. Photos 3, 4, 6.
- **Tunnels** (photo 3). She can already roll under a floor (that is how bridges work), so a tunnel is a berm or a deck
  with a channel under it and walls each side. Not attempted.
- **Pocket bowls: a bowl inside a bowl, two depths joined by a wall** (photos 3, 7). `freeBowl` has a deep end and a
  shallow end, but not a stepped pocket with its own coping.
- **A hip QP corner and a mini ramp pair with a hip** (photo 6, his list). `qpOut` is the convex corner; a hip between two
  mini ramps is two of them and a deck. Not assembled.
- **Pumping.** The pump track rides when steered, but there is no pump: she coasts round it on the speed she brought.
  Hands off she rides straight up the first berm, because a banked turn does not steer a skater by itself.
- **Scaffold towers, fences, shade structures as art** (photo 4). These are Blender art over kit pieces, not physics.

## Found, not fixed (a gameplay call for him)

- **The swipe down picks a ledge's edge at her feet over a rail above her.** `grindTarget` scores by distance with height
  counted at half, plus 0.15 m for a ledge. A handrail 1.2 m up therefore loses to the stair set's own side edge 0.25 m
  away. In the combo tests the swipe took a lip, not the rail, beside the A-frame, the stair handrails, the hubbas, the
  funbox bar and the helix start. The tap reached every one. Raising the ledge penalty, or preferring a rail whenever
  one is above her, would change it; both change which edge wins everywhere else too.
