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
