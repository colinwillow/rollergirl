# THE SPILLWAY (r132, `?world=spillway`, the LEVEL key)

A hydroelectric dam skated from the crest to the harbour. An arch dam in three facets -- a 140 m centre and two 85 m
wings turned 22 degrees toward the reservoir -- stepped into three terraces 12 m apart, a 35-degree face up to the crest
road at 60 m, the reservoir behind it. THE CHUTE is a U-channel spillway cut straight down the middle of the dam, from the
crest to a kicker on the plaza that throws her over the tailrace onto the turbine hall's landing bank. South of the dam: the
plaza at its foot, the turbine hall, the harbour promenade, the lighthouse on its mole, the sea round everything. Behind it:
his floating islands over the reservoir.

Everything is placed in FACET coordinates (`u` along the dam, `v` toward the reservoir, `spwP(F, u, v, y)` converts), so the
wings' terraces, risers, parapets, rails and lifts are the centre's code run in a turned frame.

**Line map:** `docs/spillway_map.svg` and **side elevation:** `docs/spillway_elevation.svg` -- both drawn off the BUILT world
(every rail, lane, pad, piece and island as the collider has them; the sections are `groundAt` along z), not off the pitch. **Harness:** `npm run sim spillway`, 24 rows, every one through the shipped physics. **Export:**
`npm run export:spillway` -> `exports/rollergirl_spillway.glb` (the picture, grouped dam / plaza / harbour / reservoir) and
`exports/rollergirl_spillway_collision.glb` (`deck_` floors, `bld_` boxes, lanes, launchers, spots, water).

## Heights

| level | y | v (facet depth) |
| --- | --- | --- |
| sea | -6 | |
| tailrace | -1.5 | -52..-44, x -30..30 |
| plaza / harbour yard | 0 | -84..0 |
| promenade | 2 | -92..-84 |
| landing deck | 6 | the block x -20..6, v -78..-72 |
| turbine hall roof | 10.6 | x 6..40, v -84..-56 |
| terrace 1 | 12 | 0..34 |
| terrace 2 | 24 | 34..68 |
| terrace 3 | 36 | 68..102 |
| the face | 36 -> 60 | 102..136, 35 degrees |
| crest road | 60 | 136..152 |
| reservoir | 58 | beyond the crest |
| islands | 96 / 91 / 86 / 80 / 76 | over the reservoir |

## The lines

**L1 THE CHUTE (the hero).** ➤ `spillway crest`. Push off the crest road into the channel's flat lead-in; the lip is rounded
(a running mean over the piecewise profile, so no crease is a kicker). 35 degrees down the face, 19.4 degrees across the
three terraces -- the terraces are cut round the corridor, their edges railed -- then flat across the plaza to the kicker.
Four SLUICE GATES (governed lanes, neon chevrons) hold her near 22 m/s on the way down and a stilling basin sets her up for
the kicker at 20; the kicker (XL, 3.2 m lip at 34 degrees) throws her over the tailrace onto the landing bank, up the bank to
the 6 m deck, into the QP XL at its end. *Harness: hands off from the crest, 34 m/s top, off the kicker at 20.1, down on the
bank at 0,1.9,-61.* Steer in the channel; the walls are quarter pipes (80 degrees) you can ride up.

**L8 THE STAIRCASE.** ➤ `spillway plaza`, then each terrace. A MEGA quarter pipe (9.6 m) against every riser at x -40 (and a
second pair on the plaza at +40), a landing QP S at the lip above it facing back down, and a SURGE STRIP (boost lane, 26 m/s)
across each terrace into the MEGA's toe. Ride the strip, up the MEGA, swipe up at its lip: the transfer carries her 3.6 m up
and over onto the next terrace, into the S. Three risers to the top terrace, then the crest pad. *Harness: all three risers,
swipe at 24.5 m/s, down on each terrace.*

**L2 THE FISH LADDER.** ➤ `spillway fish ladder`. A boosted rail (16 m/s) zigzagging up the east wing: four legs, each climbing
one riser along the wing, the turns a metre over the terrace just reached, out onto the top terrace. *Harness: foot to top,
17 s.*

**L3 THE PENSTOCK.** Off the crest beside the chute (x 12), a pipe with a rail on top: down the face at 35 degrees, over each
terrace a metre above it, in through the turbine hall's north window, along a rafter, out through the south door, onto the
promenade short of the harbour ledge. *Harness: crest to the promenade, 16 s.* The HARBOUR LEDGE is a knee-high wall along
the sea edge with a boosted rail on top, the whole length of the promenade (broken for the causeway).

**L4 THE TERRACE STREET.** ➤ `spillway street`. The east wing's second terrace as a street: four of his buildings against the
riser, a quarter pipe XL on three shopfronts, a funbox with rails, a ledge, a kicker gap onto a landing, a flat rail by the
terrace's end. *Harness: the street hands on, clean; the gap at 15 m/s onto the landing.*

**L5 THE ISLANDS.** ➤ `spillway islands`, or the island pad on the crest at x 24. A launcher throws her from the crest onto the
first island (SKY_ISLAND_10, 96 m, 40 m over the water); on each island a surge strip runs her at a kicker on the rim aimed at
the next (rim gaps at arrival and departure, ring rails on the rims); five islands, each a step lower; off the last, THE
ISLAND DROP, a rail at 33 degrees down onto the top terrace. Every island's top is measured off its file. *Harness: the pad,
all four hops (off at 14 m/s, landed), the drop rail onto the terrace.*

**L6 THE DRAIN.** ➤ `spillway drain`. A second, smaller chute off the west wing's first terrace, over its riser, down onto the
plaza, a surge strip to 26 m/s, straight into a SURFACE LOOP (r 5 -- wants 22 m/s at g 20, and gets it), out past the
lighthouse's causeway. *Harness: on the loop, inverted, out on the plaza.*

**L7 THE LIGHTHOUSE.** ➤ `spillway lighthouse` / `spillway lantern`. A round mole in the harbour on a causeway off the
promenade, his TOWER_E on it (lantern deck at 24 m, measured), a lift up its south side to a dock slab on the deck, and THE
HELIX -- a booster rail two and a half turns round the tower down to the mole, a QP L at its end to catch her. *Harness: the
lift, the helix end to end (10 s), the causeway home.*

**THE WEST PARK (r134).** ➤ `spillway west park`. The west wing's second terrace: a quarter pipe XL against the riser and
another at the lip, so the whole terrace is a half pipe coping to coping; a spine M to transfer over, a pyramid with rails, a
flat rail. *Harness: pumped over both copings.*

**THE INTAKE (r134).** ➤ `spillway intake`. East of the turbine hall on the plaza, two XXL quarter pipes 40 m apart facing
each other, 7.2 m copings, a surge strip between them: the biggest vert in the game. *Harness: pumped over both copings.*

**THE LIP RAILS (r134).** Every terrace's south edge carries a knee-high parapet with a rail on top, the length of the dam,
broken only where a line crosses the lip (the chute, the staircase's landings, the drain, the fish ladder's turns, the
penstock). *"No dead edges"*: riding off a terrace is a thing you do down a line. *Harness: terrace 2's 78 m run end to end.*
A line of light runs along every riser's top edge under the lip. His buildings stand against the risers of every terrace on
both wings and the centre, where no line runs.

**THE CREST ROAD (r136).** A pump track of rollers along the centre's crest toward the chute, and THE RAINBOW: a rail arched
across the chute's mouth 3 m over the road -- a grind over the top of the hero line, and a drop-in off it into the channel.
*Harness: the rollers hands on, the rainbow end to end at 9 m/s.*

**WALL RIDES (r135).** On here, as in SK8 Sky: a 12 m riser or a building's face ridden at speed and an angle is a wall
ride (`WALL.v` 8.5 m/s, `into` 2.2). *Harness: 14 m/s at 30 degrees into the second riser, rides it, lands on the terrace.*
A trail of gems runs down the chute and the drain.

**The lifts.** An inclined car at each wing's open end climbs the line of the dam from the plaza to the crest, stopping beside
every terrace (12 / 24 / 36 / 60); she rolls off onto the terrace's end through a gap in its parapet. **The pads:** plaza ->
terrace 2 on each wing, terrace 3 -> the crest, the crest -> the islands. **The crest rail** runs the length of the crest road.

## New pieces

- `kChute(centreline, { hw, r, sweep, deck, base })` -- a U cross-section (flat floor, quarter-round walls, decks) swept along a
  3D polyline with a horizontal right vector; floor, walls and decks collided, skirts drawn, a solid box under each deck.
- `spwRing` -- a round parapet with gaps and a rail on top. `spwParapet`, `spwStrip`, `spwBody`, `spwRiser` -- the facet frame's
  strips, bodies and faces. `spwRailPts` -- a filleted polyline in facet coordinates with heights by arc length.

## What the harness rode clean (30 of 30)

L1, L8 x3, L2, L3, the crest rail, the harbour ledge, the east lift, three pads, L5 (the pad, four hops, the drop), L6, L7
(lift, helix, causeway), L4 (the street, the gap), the lip rails, the west half pipe, the intake, a riser wall ride, the crest rollers, the rainbow, plus every
➤ stop standing her on a floor.

## Not done, said plainly

- **Nothing has been looked at on a GPU.** The art placements (46), the water planes, the neon and the lighting are unverified.
- The sluice gates hold the chute near 25 m/s only inside each gate; between gates she accelerates to ~34. A tuning
  decision for the phone: longer gates or a lower `gov` in `SPW.gates`.
- The west wing's first and third terraces, and the centre's, carry buildings and rails but no pieces of their own.
- His weirdport props and decals run here as in world 0 (r133): clutter at the foot of every tall box, decals on flat
  floor, tags on the risers -- unverified by eye like everything else.
- The chute's walls are quarter pipes (80 degrees), not wall rides; the risers and the buildings are.
