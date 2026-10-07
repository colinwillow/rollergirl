# Night log — the vertical build-out of the main world

One entry per build. Each says what it added, where it is, and the ➤ stop that takes you there.
Every build here was pushed only after `npm run check` and the full `node tools/sim.mjs` passed,
and every rideable link listed has a row in a sim case that rides it through the shipped physics.
None of it has been looked at on a GPU — **shipped unverified** applies to every line of this file.

The brief: *"more and more vertical, like a cube … buildings arranged with jumps so you launch up
one jump onto a building that has a half pipe or a bowl on top, pump for speed, then go on to a
higher building … lines — rafters, inside buildings, busting out windows, tunnels, the sewer
system, the sky rail, flying platforms, warehouses, fields, pyramids, alien UFOs."*

---

## r100 — THE STACK (south-east of the hub, past Orbital's north quay)

**➤ stops:** `the stack`, `stack 1` … `stack 5`, `summit`, `plunge 1`, `plunge 2`
**Sim:** `node tools/sim.mjs stack` (21 rows)

A row of five of his skyline buildings along z = -140, each one **6 m taller than the last and
butted against it**, from x 143 to 314:

| roof | his file | height | what is on it |
|---|---|---|---|
| 1 | BUILDING_08 ×1.45 | 16 m | landing QP M (6 m deck), flat, QP XL |
| 2 | BUILDING_14 ×1.57 | 22 m | the same |
| 3 | BUILDING_07 ×2.33 (turned) | 28 m | the same |
| 4 | BUILDING_03 ×2.43 | 34 m | the same |
| 5 | BUILDING_15 ×2.0 (turned) | 40 m | landing QP M, the summit pad, the helix's start |

**The way up is a transfer.** Pump a roof's half pipe until you are fast at the XL's lip
(~17 m/s is plenty — the sim pumps until then) and swipe up: you fly over the coping and come
down on the next building's landing deck, roll over its coping and drop into its pipe. Too slow
and you come back down on your own roof, never off the building. A pad on the street west of
roof 1 throws you onto it.

**THE SUMMIT** (BUILDING_09 ×2.88, south of roof 5): a bowl L sunk into a deck at **90 m**.
Two ways up from roof 5 — a pad at its east end (the quick way), or **THE HELIX**: a booster rail
off roof 5 that wraps 1.9 times round the summit tower, 40 m → 90 m, ~21 s of grind, dropping you
on the deck. Swipe down on roof 5 to catch it.

**THE PLUNGE** (west off the summit): a kicker at the deck's west edge, a 15 m gap, a long landing
ramp on a **60 m** roof, its run-out, off its west edge (no kicker — measured: a kicker there
threw her 45 m, clean over the next roof), a 15 m drop onto a landing ramp on a **45 m** roof, a
quarter pipe to turn round in. Then **the loop rail**: a down rail off that roof's north side,
over roof 1, onto roof 2's landing deck — straight back into the climb. **The street rail** off
roof 1's deck takes you down to the street (south of the lagoon, which starts at z -112).

His art: the pack's buildings, **scaled to the height the line needs** (the scale is the roof
height over the file's measured roof) and **cleared above the roof** (`skyArt`'s new `clip`), so
none of the planters, huts and masts he stood on them is in the middle of a half pipe. Until a
file arrives a plain block stands in. The chip says `NO SKY ART n/m` in this world now too.

---

## r101 — THE SKY RAIL (round the whole world, 60–91 m up)

**➤ stops:** `heights station`, `park station`, `peak station` (and `summit`, from r100)
**Sim:** `node tools/sim.mjs skyrail` (13 rows)

One closed **booster rail, 2 km round**, carried on a box girder with neon down both sides and
42 pylons (only on open ground or water — never on anything you ride). A hands-off lap is about
85 s at 22–24 m/s. Steepest grade 11%. It runs, in order:

- **across the Stack's summit** (r100), 1.3 m inside its south wall at deck height — gaps cut in the
  wall's corners for it. The summit is a station: swipe down to get on, tap to get off;
- south-west over the Orbital sky islands to **the peak**: across the peak island's north side and
  on over a new 29 m platform at the island's height (the island alone is only 20 m across);
- north to **THE HEIGHTS STATION**, a 46 m deck at 77 m hanging between the four towers, with a
  **lift from the Heights plaza** to it (a hex platform, 30 s round trip);
- up the west side, round the Acropolis and the Pantheon to **THE PARK STATION**, a 46 m deck at
  69 m north of the skate park district, with its own lift from the street;
- down the east side past Neon Shores' spire and back onto the summit.

**Two trains** run on it at 28 m/s — faster than the booster, so one catches you from behind and
knocks you off (the Heights' rule, on the same machinery).

**Getting off is a tap**, and the station decks are long on purpose: off a booster at 24 m/s a tap
carries her twenty-odd metres before she is down, so a deck shorter than that is a 70 m fall.

---

## r102 — THE MOTHERSHIP (120 m over the open ground between the hub and the Heights)

**➤ stops:** `mothership beam` (its foot, on the street), `mothership` (in the dish)
**Sim:** `node tools/sim.mjs ufo` (8 rows)

A saucer 64 m across hanging at **120 m** over (-150, -60). Its whole top is a **dish**: a bowl XL
(floor 44 m across, 4.8 m walls), a volcano in the middle, a deck ring, and a rim wall with a
**grind ring** on it.

**THE TRACTOR BEAM** is the way up and the way down. A column of green light from the street
(foot at -125, -85) to a porch sticking out of the rim: skate into its foot and it carries you up
the side of the ship and puts you down on the porch. Roll off the porch's end into it and it lets
you down gently — 9 m/s the whole 120 m, no bail. (It will not lift you straight back up after
riding it down until you step out of it.)

**THREE SCOUTS**: small saucers circling lower (34, 46 and 28 m) over Orbital, the hub's east side
and the park, each dragging its own beam. Skate under one and it lifts you onto its back, and it
carries you round until you jump. Over a roof the roof is in the way — catch them over open street.

---

## r103 — THE WORKS (a warehouse on the open west strip, x -322..-258)

**➤ stops:** `the works` (the yard by the door), `works mezzanine`, `works annex`
**Sim:** `node tools/sim.mjs works` (9 rows)

A 64 × 40 m hall, 13 m tall, with a roof you can land on. **In through the big door** in its east
wall. Inside: a quarter pipe L along the south wall (pushed hard it puts you up level with the
rafters), a funbox, a ledge — and the line:

- **up the bank to the MEZZANINE** along the west wall (5 m);
- **the RAFTERS**: nine steel beams at 8.5 m, their tops are grind rails. The first runs right over
  the mezzanine — swipe down and you are up on it;
- **BUST OUT A WINDOW**: the north wall's upper band is sixteen glass panes. Glass is a solid that
  **breaks if you hit it at 6 m/s or more** (and is a wall if you are slower). Fly off a rafter's end
  or the mezzanine's kicker and you go straight through — SMASH, +150 — across the alley onto the
  **ANNEX** roof (6 m): a quarter pipe L, a pyramid, a flat bar, and a bank back down to the yard.
- The panes come back 25 s later (never on top of you), so the line is there next time round.

---

## r104 — THE DRAIN (south of the Stack, x 125..222, z -282..-212)

**➤ stops:** `the drain` (the street outside the mouth), `drain tunnel`, `drain top`
**Sim:** `node tools/sim.mjs drain` (8 rows)

A sewer: a network of **XL half-pipe channels** (the kit's `pipe` / `tee` / `elbow` / `pipeEnd`, 4.8 m walls)
cut into a concrete **plateau exactly as tall as their walls** — from above a paved block with trenches in it,
from inside a storm drain. It opens at the **MOUTH** on its east edge at street level: ride straight in off the
street. Inside:

- the main run goes west 90 m, then turns south into a **half bowl**;
- a **branch** leaves it south through its own tunnel into a second half bowl;
- two stretches are **roofed** — the **TUNNELS**, lit with green strips. Under a roof the walls are still
  walls, but the ceiling stops an air (it stays inside);
- on top: grates, and two **banks** up from the street (east and south edges). Drop in off the edge of any
  trench and you're in the channel.

(The mouth faces east because Orbital's Nimbus tower stands 7 m off the plateau's west edge.)

---

## r105 — THE PYRAMIDS (the open field north-east of the park district, under the sky rail)

**➤ stops:** `pyramids` (the field, by the pad), `great pyramid` (its top), `pyramid valley`
**Sim:** `node tools/sim.mjs pyramids` (9 rows)

Two smooth sandstone pyramids with gold hips. **Every face is floor**: ride up one from any side; where two faces
meet is a hip.

- **THE GREAT PYRAMID**, 22 m, faces at 34°. A **pad** on the field south of it throws you onto the top deck. Its
  south-west hip is a **booster rail** — swipe down at the corner and it grinds you up to the top. The other three
  hips are **down rails**, running from the top deck all the way out onto the field.
- **THE TABLE**, 8 m, across a 6 m valley from the Great Pyramid's east face. Drop off the top, down the east face,
  across the valley and up the Table's face, and its top edge kicks you: **the air carries you right over its top
  deck** onto its east face (measured: 22 m drop in, landing on the far side).
- **THE OBELISK DROP**: a 60 m obelisk stands beside the sky rail. Grinding the sky rail past it, **push the stick out
  toward it** and you take a branch off the rail that spirals 2.6 times round the obelisk and runs on over the Great
  Pyramid's north-east face onto its top deck. Hands off, you carry straight on round the sky rail.

The sky rail now comes down to the field: sky rail → obelisk → pyramid top → face or hip → field.

---

## r106 — THE LAUNCH (the open south-west field, south of the Heights, under the sky rail)

**➤ stops:** `the launch` (the street by the lift), `launch deck`, `launch gap`
**Sim:** `node tools/sim.mjs launch` (8 rows)

A tower with a **36 m deck**, a needle mast out of its middle with a beacon on top.

- **The sky rail comes down onto it.** Grinding the sky rail past the tower, push the stick out toward it and a branch
  spirals almost twice round the needle and the last half turn closes in, finishing **heading west over the deck** —
  pointed straight at the drop.
- **A cargo lift** up the north side from the street to the deck.
- **THE DROP**: off the deck's west edge, a walled 27° bank all the way to the field, with a down rail on each wall.
  36 m of fall, **32 m/s at the bottom**, straight into a big kicker, a **30 m gap** and a 7 m landing ramp. Hands
  off, you come down on the ramp 35 m from the lip. Coming in off the sky rail you're faster still and the world's edge
  bank catches you like a quarter pipe.

The full line: sky rail → round the needle → deck → the drop → the gap — tested end to end.

---

## r107 — THE GARAGE (the north-east field, east of the pyramids)

**➤ stops:** `the garage` (the foot of the first ramp), `garage roof`
**Sim:** `node tools/sim.mjs garage` (7 rows)

An open parking structure, **five decks every 7 m**, that you ride up **inside**. A ramp per level climbs one side and
the next climbs the other side the other way, so the line zig-zags up through the building. Every ramp is a
**conveyor** (the neon stripe): stand on one with no push and it carries you up a level. Every deck has something on
it — a funbox, a mini half pipe of two quarter pipes, a ledge and a flat bar, a pyramid — and **the roof at 35 m is a
bowl** behind a parapet.

Off the roof's **north-west corner** (the one gap in the parapet) a **down rail** runs over the field and drops you on
the **Table's top deck**: from there it's down into the pyramid valley and up the Great Pyramid's face.

Measured: hands off at the first ramp's foot, the lane takes you up a level; following the route, up all five ramps
onto the roof; the roof bowl wall to wall; the rail off the corner onto the Table.

---

## r108 — THE BLEND (every seam between districts)

**Sim:** `node tools/sim.mjs blend` (5 rows) · **Panel:** `District colour blend`

The districts stop being islands. Two layers, both reading one table of 14 district centres (`BLEND.d`: where each is,
how far its culture reaches, its colour, its culture):

- **THE GROUND DRIFTS.** Every flat floor in the world is tinted by a gaussian mix of the nearby districts' colours, in
  the detail shader (`detailPatch`): lavender round the hub, mint toward the park, warm stone toward the Acropolis,
  terracotta along the canal, steel by the Works and the Drain, rose round the Stack, gold out by the pyramids. It is a
  HUE shift at constant brightness, so the textures and the lighting are untouched. Ramps and walls keep their own colour.
- **THE SEAMS ARE DRESSED.** The ground between districts (not a district's own core, not the hub, not inside the park's
  fence, not the lagoon) gets 106 props picked by the same weights, so walking from the Acropolis toward the canal the
  cypresses and braziers thin out as the benches and planters thicken: greek, neon, canal, iron, tower, desert and alien.
- **SEAM SPOTS.** Six little skate spots out in the gaps between districts (a funbox, a ledge, a flat bar and a kicker,
  tinted in the local culture's colour), so crossing between areas has something on the way.

Nothing is placed on a ➤ stop, a launch pad, a conveyor, the water, or the steer test's run, and every spot is ridden
through both lanes in the sim.

---

## r109 — THE CROSSTOWN (the tram round the hub's south side)

**➤ stops:** `tram shores`, `tram orbital`, `tram mothership` (the three platforms)
**Sim:** `node tools/sim.mjs tram` (10 rows)

A tram line at street level in the belt between the hub and the districts, about 360 m long. It runs from **just outside
the hub's east gate** (Neon Shores' causeway), south past the **Orbital gate**, and west and north to the foot of the
**Mothership's beam**. Three cars run out and back with a 7 s stop at each platform, a 103 s round trip.

- **RIDE ON THE ROOF.** Every platform is at roof height (2.4 m), with a bank up to it. Roll off the platform onto the
  cars and you're carried: on at the Orbital stop, off 75 m down the line. The end platforms sit across the line, so
  you roll straight down the platform onto the front car; at the Orbital stop you roll on from the side.
- **TWO EXPRESS LANES** run beside it the whole way, one each direction (the neon chevrons). Stand on one and it takes
  you up to 16 m/s. They break for 48 m where the Orbital gate's ramps come down.
- **IT KNOCKS YOU OFF.** Stand on the track when it comes: TRAM!

The belt was mapped before anything was placed: the hub's outer bank on one side, the lagoon at x 112 and the Orbital
ramps at z −106 on the other. Nothing else in the world stands on the line or the lanes (tested).

---

## r110 — THE STATION (210 m up, over the Mothership)

**➤ stop:** `the station` · **Sim:** `node tools/sim.mjs station` (9 rows)

The highest floor in the world: a round deck 44 m across at **210 m**, floating over the Mothership on a hanging rock
with a glowing crystal under it. A bowl on top, a grind ring round its parapet, a beacon on a mast.

**THE CORKSCREW** is the way up and the way down: one **booster rail**, 710 m long, wrapped 2.2 times round the
station's axis at a 28% grade, from the sky rail up through a gap in the parapet.

- **Up:** ride the sky rail past the Mothership and push the stick toward it as you reach the branch (the same move as
  the obelisk drop and the Launch spiral). The booster climbs you 135 m onto the deck.
- **Down:** swipe down onto it from the deck and you're carried round and down onto the sky rail, 38 s, never over
  19 m/s. Hands off on the sky rail, you go straight past it.

Its circle clears the Mothership's dish by 13 m at the dish's height. Nothing else is on its line (tested).

**Two fixes underneath, both general:**
- A sky-rail branch's junction is now found where its circle actually **crosses** the rail. On a curving stretch it
  used to land off the circle and the first piece of rail pointed backwards; the obelisk drop and the Launch spiral
  still pass.
- A floor drawn as a disc from its exact centre (`acDisc` from radius 0) was facing down, so it didn't exist to the
  physics. It does now.

---

## r111 — THE HIGH WIRES (between districts, at roof height)

**Sim:** `node tools/sim.mjs wires` (8 rows)

Booster rails strung between decks of **different districts that stand at the same height**, so a roof in one is a
ride from a roof in the next. Three went up:

| from | to | length | height |
|---|---|---|---|
| **Launch deck** | **Nimbus** roof (Orbital) | 223 m | 36 m |
| **Acropolis sky agora** | the canal street's **roofline** | 191 m | 28 → 25 m |
| **Garage roof** | the **Shores spire** island | 39 m | 35 → 36 m |

Each is a booster both ways (about 16 m/s), so either end is a start: swipe down onto it from the deck. It sags a little
in the middle, carries gems, and drops you on the other deck.

**The ends are found, not typed.** From each deck it walks toward the other until the deck ends or something blocks,
then checks the whole wire against everything solid and every floor, trying a few side-shifts. An end must also be at
least 5 m from any other rail, so a swipe there finds this one. A wire that can't be strung cleanly is left out and
says why. Seven candidates were left out. The best of them, the Orbital peak to the Stack's 60 m roof (247 m, dead
level, clear the whole way), lost only because the sky rail's peak station is on the same small island and the swipe
there grabbed the wire.

**Watch for:** you arrive at ~16 m/s. On the Garage roof, hands off, you roll straight across and off the far side.
Brake or turn when you land. Off the Launch end you roll into the big drop, which is a line in itself.

---

## r112 — THE NORTHWAY (the elevated highway across the north field)

**➤ stops:** `northway` (on the deck), `interchange` (the street end of the helix)
**Sim:** `node tools/sim.mjs northway` (9 rows)

A skate highway 25–28 m up across the open north field, 378 m long. It starts at the north edge of the **Acropolis
sky agora**, swings round and runs east under the sky rail's line, and comes down onto the **top of the Great
Pyramid**. From there you drop straight down the pyramid's face into the valley and the table-top jump.

- **Two express lanes** (the chevrons), one each way. Stand on one and it takes you to 18 m/s.
- **Parapets you can grind** the whole way, lamps, and piers down to whatever is underneath (the pyramid's own face at
  the east end).
- **THE INTERCHANGE**, near the east end on the north side: a helix two turns round a drum, down to the street, with a
  conveyor UP it. The street is on the highway too: ride in at the `interchange` stop and it carries you up. At the top
  it runs alongside the highway; that stub has a wall across its far end so you can't sail off it.

Measured end to end both ways (sky agora → pyramid top, pyramid top → sky agora), both lanes, up the interchange from
the street and down it again. The route was moved off its first line because the sky rail's park-station lift stands
at (0, 297), right where the deck would have been.

**Small knock-ons:** the seam dressing keeps off the highway (4 seam spots now, was 6). The highway's railings stop
short of the pyramid's top so a swipe there still finds the hip rail.

---

## r113 — THE PEAK BRANCH, and THE AIR

**Sim:** `node tools/sim.mjs wires` (now 14 rows), `node tools/sim.mjs atmo` (4 rows)

**The best high wire is back, as a branch off the sky rail.** The Orbital peak to the Stack's 60 m roof (221 m, dead
level) was left out of r111 because its end sat beside the sky rail's peak station. Now it **starts on the sky rail
itself**, just east of the station. Grinding the sky rail east past it, hold the stick out to the right (square out;
the branch is only about 18° off the rail) and you're on the wire to the Stack. Hands off, you carry on along the sky
rail. Coming back from the Stack, the wire drops you onto the sky rail.

**One more wire went up**: the Stack's roof 2 (22 m) to the Shores transit deck (24 m), 280 m north over the Shores
plateau. That makes five: peak–Stack, Launch–Nimbus, Acropolis sky agora–roofline, Garage–Shores spire, and
Stack–Shores transit.

**THE AIR changes with the district.** The fog, the sky light and the coloured rim lamp all ease toward the colour of
whichever districts you're among, from the same table the ground tint uses: warm stone toward the Acropolis, rose over
the Stack, gold out by the pyramids, steel by the Works. Out in a seam it's a mix. The rim lamp (the coloured edge on
you) takes the local hue most strongly, which is the clearest cue that you've crossed into somewhere else.

---

## r114 — THE CANNONS

**Sim:** `node tools/sim.mjs cannons` (5 rows)

**Four launch pads out in the seams, each one throwing you across to a different district's deck.** Look for the green
beacon on a pole beside each pad; they're on the ➤ key as `shores cannon`, `acro cannon`, `northway cannon` and
`garage cannon`.

- **Shores cannon** (hub's east strip, 106, 50): 150 m over the lagoon onto the Shores transit tower's ring deck at 24 m.
- **Acro cannon** (west seam, -108, 60): 190 m onto the Acropolis sky agora at 28 m.
- **Northway cannon** (north field, -60, 305): up onto the Northway at 27 m, where the lane picks you up.
- **Garage cannon** (north-east field, 200, 278): into the bowl on the Garage roof at 35 m.

Each throw is solved the moment you stand on the pad, against what's actually in the way, like every other launcher.
**Landing catches you at 8 m/s**, so you arrive on a 7 m ring deck instead of shooting straight off the other side.

---

## r115 — THE DONUT

**Sim:** `node tools/sim.mjs donut` (9 rows), plus a fifth row in `cannons`

**A half pipe bent into a ring, floating 72 m over the hub.** Pink frosting, sprinkles on both decks, a dough body with a
glowing ring under it so it reads from the street. The channel is 10 m wide between an inner wall around the hole and an
outer wall, with a deck on each side and a parapet on each edge. Both parapets have grind rings on top: **the halo**
(outside) and **the hole** (inside).

- **Up:** the **donut cannon** on the hub plaza (-40, -40), with a green beacon like the others. It throws you into the channel.
- **Down: THE DUNK.** Grind the halo and push the stick out, away from the middle: a booster rail branches off and winds 1.1
  turns down around the hub onto the skyway spire's ring, where the sky helix carries on down to the plaza. Hands off, you
  just keep going round the halo.
- **The dunk also works upward.** Catch it low and the booster carries you all the way back up onto the halo.

The ➤ key's first stop is `the donut`, and the cannon is `donut cannon`.

---

## r116 — THE SAUCERS

**Sim:** `node tools/sim.mjs saucers` (10 rows); the three new wires are ridden both ways in `wires`

**Three saucer-topped towers in the west seam**, between the hub and the Acropolis/Heights, each with a lift up the side
from the street (stand on the disc at its foot):

- **Saucer A** (-125, 48), 72 m: level with the donut. Clear deck, the hub of the three wires.
- **Saucer B** (-150, 140), 84 m, the big one (21 m across): **a giant curved wall** around its north half, a 7.2 m
  quarter pipe swept through 150°. Hit it at 19 m/s and you air over the coping and come back down onto the saucer.
- **Saucer C** (-190, -60), 55 m: a volcano on the deck.

**Wires tie them together and to the donut:** grind the donut's halo and push the stick out on the west side to branch onto
a 91 m wire across to saucer A; A climbs to B (49 m), and A drops to C (123 m). All are boosters, rideable both ways.
So the line in the sky is now: plaza cannon → donut → halo → saucer A → B or C, or the dunk → skyway spire → sky helix → plaza.

The ➤ key has `saucer a/b/c` (the decks) and `saucer a/b/c lift` (the lift feet).

---

## r117 — THE WEB

**Sim:** `node tools/sim.mjs wires` (now 30 rows)

**Two more wires tie the saucers into the lines already in the sky:**

- **Heights high line → saucer C** (57 m): grinding the Heights' high line (53 m), push the stick out at the north-east
  corner and you branch onto a wire up to saucer C.
- **Sky rail → saucer A** (134 m): grinding the sky rail south-east past the station, stick out (to the right) just
  after the station corkscrew's junction, and a wire drops you onto saucer A.

Ridden the other way, from either saucer, the wire merges you onto the high line or the sky rail.

**A real grind fix came out of this:** at booster speed she covers ~0.4 m a frame, so a junction a few tenths of a metre into
the next rail segment was skipped and could never be taken. Branches are now checked on the segment she enters too.
(The sky rail branch turned out to have a second reason: from the north-west it leaves *behind* you, and a branch behind
your direction of travel can never be picked. Ride it south-east.)

Saucer C's lift moved to its west side and its volcano east of the middle, so its wires leave from the flat west half.

## r118 — THE ORB TOWER (and its loop)

From the second reference sheet ("main plaza: tower with a glowing orb and rings", "loop tower: a giant vertical loop beside
a tower"). One tower in the open NE field, under the sky rail, between the Garage and the Table pyramid (238, 252):

- **The tower**: a 40 m deck (r 9, parapet all round) on a tapering neon-banded shaft, with a **lift** up its north side.
- **The orb**: a glowing ball on a mast 11 m over the deck, three rings turning round it on different axes.
- **The loop**: hop onto the flat rail beside the ➤ stop (`orb tower`). It's a booster coaster out south, round a **9 m
  vertical loop** (59 m up at the top), a U-turn east, back north, and in over the deck's east edge through a **brake run**
  (the orange rail) that sets you down on the deck at a walking pace. It never touches the ground.
- **The pad**: on the deck's west side (`orb tower pad`). Roll over it and it throws you 108 m west onto the **Great
  Pyramid's top**, and from there onto the Northway.

➤ stops: `orb tower`, `orb tower lift`, `orb tower pad`.

## r119 — DOWNTOWN (the Heights gets streets)

From the third reference ("big tall buildings and a complex roadway street system between them ... ramps at the bottom
of the buildings, stuff still in the sky"). The Heights already had the tall towers and the two-deck skylane with its
trains, the ships and the air base. Now it has streets:

- **The main street** runs north-south through the middle (120 m) and **the cross street** runs east-west (100 m). They
  meet at a square round the sky-rail station's lift. Asphalt, a double yellow line, white edge lines, zebra crossings,
  sidewalks, and planted medians round the skylane pylons where the elevated line crosses overhead.
- **Eight storefront blocks** (16–26 m) line both streets, with the towers standing behind them. Each has shop glass,
  a neon band, a sign (KICKFLIP RECORDS, MONSTER MART, COSMIC FUEL, スケート, BLADES, MARKET), windows, and murals up
  the long faces. Big signs go up the towers' street-facing sides too.
- **Ramps at the building bases**: 8 quarter pipes backed onto the shop walls, 3 stairs-and-bank sets up onto shop
  terraces, ledges, a manual pad and a flat bar, plus palms in planters, benches and lamps.

➤ stops: `downtown` (the north end of the main street), `downtown square`.

## r120 — DOWNTOWN GOES UP (onto the buildings)

From the street-side reference: the jumps at the building bases lead up onto the buildings.

- **Terraces**: the four long blocks on the main street are now a podium with the tower set back above it, leaving a
  4 m terrace along the street at 3.6 m. Each has a railing you can grind along its edge, and a quarter pipe at one end.
- **The way up**: a long bank runs along each podium's sidewalk, from the street up onto a platform level with the
  terrace. Ride up it and carve onto the terrace.
- **The bridges**: two booster rails cross the main street diagonally, terrace railing to terrace railing, at z -108 and
  z -196. Grind a terrace railing and push the stick across the street to take one. Hands-off you stay on the railing.

New ➤ stop: `downtown terrace`.

## r121 — THE COASTER PARK (islands in the sky)

From the coaster reference sheet. Four floating islands over the north park, 50–62 m up, each with its own attraction and
tied together by booster coasters you grind:

- **The gate** (0, 132, 50): a neon arch and a giant alien. The donut halo's high wire comes in through the arch (89 m).
- **The vert** (-62, 178, 56): a half pipe L across the island.
- **The core** (-5, 222, 62): a tower with a saucer on top.
- **The wheel** (58, 182, 50): a ferris wheel. Its eight cabins are moving floors, so step on one at the bottom and it
  carries you 22 m up and round.
- **The tracks**: gate → vert has a 9 m vertical loop. Vert → core has a banked helix. Core → wheel has a 10 m loop.
  Wheel → gate is a camelback. Ride them both ways; on the loops you go upside down.
- **The big drop**: off the wheel island, over a hump and down onto the Great Pyramid's top. Ride it back up from there.
- **Brake runs**: every track starts and ends on 12 m of level orange rail that eases you to a roll (a walk onto the
  pyramid). You get off on the island instead of flying off the far side.

➤ stops: `coaster gate`, `coaster vert`, `coaster core`, `coaster wheel`.

## r122 — THE RIGHT STICK, SORTED (stance switch, melee, speed skate)

- **Right stick flick down on the ground swaps regular and fakie again.** To grind, jump and then swipe down in the air,
  the way the dive already works. (Panel: "R flick down on the ground" puts the old ground hop back.)
- **Right stick flick up (or any other way) on the ground is still the melee**, and every ground strike still gives a
  little boost.
- **Hold the right stick up on the ground to speed skate**: she goes into the hard pump with the trails and the lens
  effect, and keeps gaining speed for as long as you hold, up to 31 m/s (above her normal top speed). A quick flick up is
  still the strike. Panel: "Speed skate push", "Speed skate top speed".
- **Left stick flick up is still the one-shot boost.**

## r123 — SK8 SKY: LIGHT GRAVITY, WALL RIDES, A LOOP YOU SKATE ROUND, THE ANNEX

**Sim:** `node tools/sim.mjs sky` (the rows from "SK8 Sky's gravity" on)

- **Lighter gravity in SK8 Sky** (15 against the main world's 20). Every jump floats: a flat ollie goes up 5.1 m. Panel row
  "SK8 Sky gravity".
- **The drop can be skated UP now.** The solid fill under the 24 m bank was topped 5 cm under its surface, so her round body
  caught the low end of each box and she stopped dead. They sit 60 cm under now. Pushing from the toe, she makes the 24 m pad.
- **Wall rides.** Hit a wall fast enough (8.5 m/s, at least 2.2 m/s into it) and you ride along it under lighter gravity,
  climbing with how hard you came in. You come off over the top onto the roof, at the end, back down to the floor, or when
  you slow down. Tap to plant off it. Push the stick away from the wall to let go. Panel: "Wall ride", "Wall ride from",
  "Wall ride gravity", "Wall ride in every world" (off: it is SK8 Sky only for now).
- **Bowl shells.** A kit bowl built UP had no outside: you saw through it until you were in it. Every raised bowl now has
  four outer walls, and they are solid.
- **In-ground bowls, a new kit piece (`bowlIn`).** Same bowl, sunk: the rim is the floor and the floor is 4.8 m down (XL).
  `handoff/LEVEL_BUILDING.md` says how to use it in Blender (the floor round it needs a hole).
- **THE ANNEX**: a second octagon south of the base, down a 90 m causeway from the base's south edge (x -44).
  - **The loop**: a 10 m surface you skate right round, upside down at the top. A boost strip (the chevrons) on its run-in
    takes you to 25 m/s, which is plenty. Too slow and you roll back down, or drop off near the top.
  - **The walls**: two long blocks (4.4 and 3.6 m) with an alley between. Ride up their faces; come over onto the roofs.
    Their roof edges are rails.
  - **The sunk bowl**: XL, in the floor, with a coping ring to grind.
  - A QP XL along the south edge, a volcano, a flat rail and a funbox.

➤ stops: `sk8 annex`, `sk8 loop`, `sk8 walls`, `sk8 sunk bowl`.
