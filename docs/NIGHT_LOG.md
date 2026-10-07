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
